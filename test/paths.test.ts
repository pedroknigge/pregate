import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { canonical, findRoot } from "../src/disk.ts";
import { REQUESTS, inScope, layerOf, machineGlobs, matches, pathKey, protectedGlobs, protects, ruleApplies, scopeUnder } from "../src/paths.ts";
import type { Layer, Lock } from "../src/types.ts";

function lock(scope: Lock["scope"], layers: Record<string, Layer> = {}): Lock {
  return {
    lockVersion: 1, engine: "0.1.0", core: "0.1.0", coreHash: "", presetHash: "", sourcesHash: "",
    preset: { name: "t", version: "0.1.0", methodologies: [] }, enforcement: "enforce",
    scope, generatedMarkers: [], layers, sourceDirs: [], ratchet: "no-new",
    loop: { maxDenialsPerFileRule: 3, maxDenialsPerTurn: 15, noProgressLimit: 2, maxStopBlocks: 2, allowAsk: true, maxDetailedViolations: 5 },
    ownedByArkgate: [], rules: [],
  };
}

describe("matches (A26)", () => {
  const cases: [string, string, boolean][] = [
    ["src/**", "src/a/b.ts", true],
    ["src/**", "SRC/A.ts", true],
    ["SRC/Domain/**", "src/domain/x.ts", true],
    ["src/*.ts", "src/a/b.ts", false],
    ["**/*.test.ts", "a.test.ts", true],
    ["**/.pregate/**", "/r/x/.PREGATE/preset.json", true],
    ["src/**", "src", false],
    ["src/**", "lib/a.ts", false],
    // #66: a literal Next.js route path matches itself, not a path its brackets read as classes.
    ["src/app/(d)/sales/[view]/[[...rest]]/b.tsx", "src/app/(d)/sales/[view]/[[...rest]]/b.tsx", true],
    ["src/app/(d)/sales/[view]/[[...rest]]/b.tsx", "src/app/(d)/sales/v/r/b.tsx", false],
    ["src/app/\\[view\\]/**", "src/app/[view]/x.tsx", true],
    ["src/[ab].ts", "src/a.ts", true],
    // The fallback is a raw compare: a backslash escape or a drive glob is not normalized into a match.
    ["src\\secret.ts", "src/secret.ts", false],
    ["c:/r/a.", "C:/r/a", false],
    ["C:/r/x/../y.ts", "C:/r/y.ts", false],
  ];
  for (const [glob, rel, expected] of cases) test(`${glob} ~ ${rel}`, () => expect(matches(glob, rel)).toBe(expected));
});

describe("ruleApplies with a literal bracket path (#66)", () => {
  const page = "src/app/(dashboard)/sales/[view]/[[...rest]]/page.tsx";
  const rule = (exclude: string[]) => ({ params: { paths: ["src/**/*.tsx"], exclude } });
  test("an exact-path exclude removes that file", () => expect(ruleApplies(rule([page]), page)).toBe(false));
  test("other files stay covered", () => expect(ruleApplies(rule([page]), "src/app/(dashboard)/sales/[view]/other.tsx")).toBe(true));
  test("without the exclude the rule applies", () => expect(ruleApplies(rule([]), page)).toBe(true));
});

describe("protects", () => {
  test.each([
    "C:\\Repo\\.PREGATE\\preset.json",
    "\\\\?\\C:\\Repo\\.PREGATE\\preset.json",
    "C:\\Repo\\.PREGATE. \\preset.json",
    "\\\\server\\share\\Repo\\.PREGATE\\preset.json",
    "\\\\?\\UNC\\server\\share\\Repo\\.PREGATE\\preset.json",
  ])("Windows protected paths retain normalized matching: %s", (path) => {
    expect(protects(path, ["/unrelated/**", "**/.pregate/**"])).toBe(true);
    expect(protects(path.replace(/\.PREGATE/gi, "src"), ["/unrelated/**", "**/.pregate/**"])).toBe(false);
  });
  const dirs = { home: "/Users/u", data: "/Users/u/.local/state/pregate", engine: "/Users/u/.local/share/pregate" };
  const globs = protectedGlobs("/repo", ["rules", "../shared/rules/", "/opt/team-rules"], dirs);
  const cases: [string, boolean][] = [
    ["/repo/.pregate/preset.json", true],
    ["/repo/.pregate", true],
    ["/repo/.Pregate/Preset.json", true],
    ["/repo/packages/app/.pregate/preset.json", true],                // nested root, any depth
    ["/repo/.pregate/requests/r1.json", true],                        // the gate validates REQUESTS first
    ["/repo/.git/config", true],
    ["/repo/.git", true],
    ["/repo/sub/.GIT/hooks/pre-commit", true],
    ["/repo/.claude/settings.json", true],
    ["/repo/.claude/settings.local.json", true],
    ["/repo/.Claude/Settings.json", true],
    ["/Users/u/.claude/settings.json", true],
    ["/repo/.claude/commands/x.md", false],
    ["/Users/u/.local/state/pregate", true],
    ["/Users/u/.local/state/pregate/sessions/s/events/e.json", true],
    ["/Users/u/.local/share/pregate/0.1.0/pregate", true],
    ["/repo/~/.local/state/pregate/sessions/s", true],               // the shell guard's `~/…`
    ["/repo/HOME/.local/share/pregate", true],                       // and `$HOME/…`, in pieces
    ["/repo/rules/x/check.json", true],
    ["/repo/rules", true],
    ["/shared/rules/check.json", true],
    ["/opt/team-rules/source.json", true],
    ["/repo/src/a.ts", false],
    ["/repo/.gitignore", false],
    ["/repo/x.pregate/a", false],
    ["/repo/rulesets/a.json", false],
    // MH-30: what switches off or bypasses the hooks of the other harnesses, at any depth
    ["/repo/.codex/hooks.json", true],
    ["/Users/u/.codex/config.toml", true],
    ["/repo/.cursor/hooks.json", true],
    ["/repo/.cursor/cli-config.json", true],
    ["/repo/.cursor/managed/active-team-hooks/hooks.json", true],
    ["/repo/.grok/hooks", true],
    ["/repo/.grok/hooks/aa.json", true],
    ["/repo/.grok/config.toml", true],
    ["/repo/.agents/hooks.json", true],
    ["/repo/_agent/plugins.json", true],
    ["/repo/.agent/plugins/pregate/hooks.json", true],
    ["/repo/.codex/prompts/x.md", false],
    ["/repo/.cursor/rules/x.mdc", false],
    ["/repo/.agents/skills/x/SKILL.md", false],
  ];
  for (const [abs, expected] of cases) test(abs, () => expect(protects(abs, globs)).toBe(expected));

  test("without a root, fixed protections still apply and source dirs do not", () => {
    const fixed = protectedGlobs(null, ["rules"], dirs);
    expect(protects("/anywhere/.pregate/preset.json", fixed)).toBe(true);
    expect(protects("/repo/rules/x.json", fixed)).toBe(false);
  });

  test("glob metacharacters in a directory are literal", () => {
    const odd = protectedGlobs("/w/[a]", ["r{1}"], { home: "/h*", data: "/h*/d?", engine: "/e" });
    expect(protects("/w/[a]/r{1}/x.json", odd)).toBe(true);
    expect(protects("/w/a/r1/x.json", odd)).toBe(false);
    expect(protects("/h*/d?/y", odd)).toBe(true);
    expect(protects("/r/~/d?/y", odd)).toBe(true);
    expect(protects("/hx/dx/y", odd)).toBe(false);
    expect(protects("/r/~/dx/y", odd)).toBe(false);
  });

  test("REQUESTS is anchored at the root", () => {
    expect(matches(REQUESTS, ".pregate/requests/r1.json")).toBe(true);
    expect(matches(REQUESTS, "pkg/.pregate/requests/r1.json")).toBe(false);
    expect(matches(REQUESTS, ".pregate/requests/sub/r1.json")).toBe(false);
  });
});

describe("inScope", () => {
  const l = lock({ include: ["src/**", "test/**"], exclude: ["src/gen/**"] });
  const cases: [string, boolean][] = [
    ["src/a.ts", true],
    ["Src/A.ts", true],
    ["test/a.test.ts", true],
    ["src/gen/x.ts", false],
    ["SRC/GEN/x.ts", false],
    ["lib/a.ts", false],
    ["README.md", false],
  ];
  for (const [rel, expected] of cases) test(rel, () => expect(inScope(l, rel)).toBe(expected));
  test("without a valid lock everything is in scope", () => expect(inScope(null, "anything/at/all")).toBe(true));
  test("a literal bracket path in scope.exclude excludes that file (#66)", () => {
    const page = "src/app/[locale]/[[...slug]]/page.tsx";
    const bracket = lock({ include: ["src/**"], exclude: [page] });
    expect(inScope(bracket, page)).toBe(false);
    expect(inScope(bracket, "src/app/[locale]/layout.tsx")).toBe(true);
  });
});

describe("scopeUnder: an in-scope path can lie at or below a directory", () => {
  const l = lock({ include: ["src/**", "lib/**/*.ts", "README.md"], exclude: ["src/gen/**"] });
  const cases: [string, boolean][] = [
    ["", true],               // the root holds everything
    ["src", true],
    ["SRC", true],
    ["src/a.ts", true],
    ["src/gen", true],        // excludes are ignored: the answer only errs towards true
    ["lib", true],
    ["lib/deep/dir", true],   // below a literal prefix, the wildcard reaches anything
    ["docs", false],
    ["srcx", false],
    ["README.md/x", false],
  ];
  for (const [rel, expected] of cases) test(JSON.stringify(rel), () => expect(scopeUnder(l, rel)).toBe(expected));
  test("a glob with no literal prefix reaches every directory", () => expect(scopeUnder(lock({ include: ["**/*.ts"], exclude: [] }), "docs")).toBe(true));
  test("without a valid lock everything is in scope", () => expect(scopeUnder(null, "docs")).toBe(true));
});

describe("layerOf", () => {
  const layer = (paths: string[]): Layer => ({ paths, mayImport: [], kind: "core" });
  const l = lock({ include: ["**"], exclude: [] }, {
    app: layer(["src/**"]),
    domain: layer(["src/domain/**"]),
    tests: layer(["**/*.test.ts"]),
    first: layer(["lib/*/x.ts"]),
    second: layer(["lib/a/*.ts"]),
  });
  const cases: [string, string | null][] = [
    ["src/a.ts", "app"],
    ["src/domain/money.ts", "domain"],
    ["SRC/Domain/Money.ts", "domain"],
    ["src/domain/money.test.ts", "domain"],     // 11 literal characters against 9
    ["src/a.test.ts", "tests"],                 // 9 against 4
    ["lib/a/x.ts", "first"],                    // tie: declaration order
    ["docs/a.md", null],
  ];
  for (const [rel, expected] of cases) test(rel, () => expect(layerOf(l, rel)).toBe(expected));
});

describe("disk.canonical and findRoot", () => {
  const base = canonical(mkdtempSync(`${tmpdir()}/pregate-paths-`));
  afterAll(() => rmSync(base, { recursive: true, force: true }));
  const repo = `${base}/repo`;
  mkdirSync(`${repo}/.pregate`, { recursive: true });
  mkdirSync(`${repo}/src`, { recursive: true });
  mkdirSync(`${repo}/pkg/.pregate`, { recursive: true });
  writeFileSync(`${repo}/.pregate/preset.json`, "{}");
  writeFileSync(`${repo}/pkg/.pregate/preset.json`, "{}");
  writeFileSync(`${repo}/src/a.ts`, "");
  symlinkSync(`${repo}/.pregate/preset.json`, `${repo}/src/link.ts`);
  symlinkSync(`../.pregate/new.json`, `${repo}/src/dangling.ts`);
  symlinkSync(`${repo}/.pregate`, `${repo}/src/dir-link`, "dir");
  symlinkSync(`${repo}/nowhere/deeper`, `${repo}/src/dangling-dir`, "dir");
  symlinkSync(`${repo}/src/loop-b`, `${repo}/src/loop-a`);
  symlinkSync(`${repo}/src/loop-a`, `${repo}/src/loop-b`);
  const globs = protectedGlobs(repo, [], { home: "/h", data: "/d", engine: "/e" });
  // Filesystem case spelling varies; canonical paths share the engine's case-insensitive identity.
  const folds = existsSync(`${repo}/SRC`);

  const cases: [string, string, string][] = [
    ["existing file", `${repo}/src/a.ts`, `${repo}/src/a.ts`],
    ["new file", `${repo}/src/new/b.ts`, `${repo}/src/new/b.ts`],
    ["case of an existing file", `${repo}/SRC/A.ts`, folds ? `${repo}/src/a.ts` : `${repo}/SRC/A.ts`],
    ["case of a new file's directory", `${repo}/SRC/b.ts`, folds ? `${repo}/src/b.ts` : `${repo}/SRC/b.ts`],
    ["symlink to a protected file", `${repo}/src/link.ts`, `${repo}/.pregate/preset.json`],
    ["dangling symlink is its target", `${repo}/src/dangling.ts`, `${repo}/.pregate/new.json`],
    ["new file through a directory symlink", `${repo}/src/dir-link/lock.json`, `${repo}/.pregate/lock.json`],
    ["new file through a dangling directory symlink", `${repo}/src/dangling-dir/x.ts`, `${repo}/nowhere/deeper/x.ts`],
    ["a file used as a directory", `${repo}/src/a.ts/x`, `${repo}/src/a.ts/x`],
  ];
  for (const [name, abs, expected] of cases) test(name, () => {
    expect(name.startsWith("case of") ? pathKey(canonical(abs)) : canonical(abs)).toBe(name.startsWith("case of") ? pathKey(expected) : expected);
  });

  test("every symlink route to .pregate/ is protected", () => {
    for (const p of ["src/link.ts", "src/dangling.ts", "src/dir-link/lock.json"]) {
      expect(protects(canonical(`${repo}/${p}`), globs)).toBe(true);
    }
  });

  test("a symlink loop throws", () => expect(() => canonical(`${repo}/src/loop-a`)).toThrow());

  test("the nearest accepted root wins; an unaccepted one is skipped", () => {
    expect(findRoot(`${repo}/pkg/src/x.ts`, () => true)).toBe(`${repo}/pkg`);
    expect(findRoot(`${repo}/pkg/src/x.ts`, (root) => root === repo)).toBe(repo);
    expect(findRoot(`${repo}/src/a.ts`, () => true)).toBe(repo);
    expect(findRoot(`${repo}`, () => true)).toBe(repo);
    expect(findRoot(`${base}/elsewhere/x.ts`, () => true)).toBeNull();
  });
});

// MH-17: the machine's protections hold with or without a root, under every name the gate can see
// a file by. The home here has its configuration in symlinked dotfiles.
describe("machineGlobs", () => {
  const base = canonical(mkdtempSync(`${tmpdir()}/pregate-machine-`));
  afterAll(() => rmSync(base, { recursive: true, force: true }));
  const home = `${base}/home`;
  const dot = `${base}/dotfiles`;
  for (const d of [`${dot}/claude`, `${dot}/grok-hooks`, `${home}/.codex`, `${home}/.grok`, `${home}/.local/bin`]) mkdirSync(d, { recursive: true });
  writeFileSync(`${dot}/claude/settings.json`, "{}");
  writeFileSync(`${dot}/codex.toml`, "");
  symlinkSync(`${dot}/claude`, `${home}/.claude`, "dir");             // a folder in dotfiles
  symlinkSync(`${dot}/codex.toml`, `${home}/.codex/config.toml`);     // a single file in dotfiles
  symlinkSync(`${dot}/grok-hooks`, `${home}/.grok/hooks`, "dir");
  const env = { codexHome: `${home}/.codex`, grokHome: `${home}/.grok`, claudeConfig: null, data: `${home}/.local/share/pregate`, state: `${home}/.local/state/pregate` };
  const globs = machineGlobs(home, env, canonical);
  const guarded = (p: string): boolean => protects(canonical(p), globs);

  test("the registrations of the five harnesses, through their symlinks", () => {
    for (const p of [
      ".claude/settings.json", ".claude/settings.local.json", ".codex/hooks.json", ".codex/config.toml", ".codex/requirements.toml",
      ".grok/config.toml", ".grok/hooks-paths", ".grok/managed_config.toml", ".grok/requirements.toml", ".grok/hooks/aa.json",
      ".gemini/config/hooks.json", ".gemini/config/config.json", ".gemini/config/plugins/pregate/hooks.json",
      ".cursor/hooks.json", ".cursor/cli-config.json", ".cursor/managed/hooks.json",
    ]) expect(guarded(`${home}/${p}`)).toBe(true);
    expect(canonical(`${home}/.codex/config.toml`)).toBe(`${dot}/codex.toml`);
    expect(guarded(`${dot}/codex.toml`)).toBe(true);
    expect(guarded(`${dot}/claude/settings.json`)).toBe(true);
  });

  test("the installation and every .pregate folder", () => {
    for (const p of [env.data, `${env.data}/0.2.0/pregate`, `${env.data}/bin/pregate`, env.state, `${env.state}/sessions/s/e.json`, `${home}/.local/bin/pregate`, "/any/repo/.pregate/preset.json"]) {
      expect(guarded(p)).toBe(true);
    }
  });

  test("a command's spelling of home or of the variable, as the shell guard resolves it", () => {
    for (const p of ["/cwd/~/.claude/settings.json", "/~/.codex/hooks.json", "/cwd/~/.grok/hooks/x.json", "/cwd/~/.local/share/pregate/bin/pregate"]) {
      expect(protects(p, globs)).toBe(true);
    }
  });

  test("what needs a root is not the machine's", () => {
    for (const p of ["/repo/.git/config", "/repo/.claude/settings.json", "/repo/.codex/config.toml", `${home}/.claude/agents/x.md`, `${home}/.codex/auth.json`, `${home}/.gemini/config/skills.json`, `${home}/notes.txt`]) {
      expect(guarded(p)).toBe(false);
    }
  });

  test("relocated configuration: CODEX_HOME, GROK_HOME and CLAUDE_CONFIG_DIR", () => {
    const moved = machineGlobs(home, { ...env, codexHome: "/opt/codex", grokHome: `${home}/grok`, claudeConfig: "/etc/claude" }, (p) => p);
    for (const p of ["/opt/codex/hooks.json", `${home}/grok/config.toml`, "/cwd/~/grok/hooks/x", "/etc/claude/settings.json", "/cwd/~/.codex/hooks.json"]) {
      expect(protects(p, moved)).toBe(true);
    }
    expect(protects("/opt/codex/auth.json", moved)).toBe(false);
  });
});
