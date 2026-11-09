import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync,
  statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { HARNESSES } from "../src/harness/profile.ts";
import { agyPlugin, exact } from "../src/register.ts";
import type { HarnessId } from "../src/types.ts";

// MULTI-HARNESS §6.2, the machine commands: the compiled binary runs `setup`, `update`, `uninstall`
// and `doctor` on a machine that lives in one temporary folder (HOME, XDG_*, CODEX_HOME, GROK_HOME,
// TMPDIR), with the five CLIs faked on a PATH of their own. The fake `codex app-server`
// (fixtures/codex-app-server.ts) keeps Codex's trust rules; the configs already on the machine are
// the real ones of test/fixtures/configs.

setDefaultTimeout(120_000);

const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-machine-")));
const BIN = join(TMP, "dist/pregate");
const CONFIGS = join(import.meta.dir, "fixtures/configs");
const APP_SERVER = join(import.meta.dir, "fixtures/codex-app-server.ts");
const ALL = Object.keys(HARNESSES) as HarnessId[];
const EVENTS = ["PreToolUse", "Stop", "SessionStart"];
const TOOLS = ["cp", "git", "gzip", "mkdir", "rm", "sed", "tar"];

beforeAll(() => compileBinary(hostTarget(), BIN));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

test("D25: setup installs versioned skills; doctor detects missing/stale copies; uninstall removes them", () => {
  const m = machine(["claude-code"]);
  ok(pregate(m, "setup"), "setup");
  const folders = [".agents/skills", ".claude/skills", ".codex/skills", ".cursor/skills", ".grok/skills", ".gemini/antigravity-cli/skills"];
  for (const folder of folders) {
    const file = join(m.home, folder, "pregate/SKILL.md");
    expect(read(file)).toContain(`description: "${pkg.version} — PREGATE:`);
    expect(read(file)).not.toContain("@ENGINE_VERSION@");
  }
  const file = join(m.home, ".agents/skills/pregate/SKILL.md");
  put(file, "---\nname: pregate\ndescription: old\n---\n");
  expect(pregate(m, "doctor").stdout).toContain(`Stale /pregate skill at ${file}`);
  rmSync(file);
  expect(pregate(m, "doctor").stdout).toContain(`Missing /pregate skill at ${file}`);
  ok(pregate(m, "setup"), "repair skill");
  ok(uninstall(m), "uninstall");
  for (const folder of folders) expect(existsSync(join(m.home, folder, "pregate"))).toBe(false);
});

type Json = Record<string, any>;
interface Out { code: number | null; stdout: string; stderr: string }
interface Machine {
  root: string; home: string; data: string; state: string; codex: string; env: Record<string, string>;
  settings: string; hooks: string; plugin: string; launcher: string; link: string;
}

let machines = 0;
// A machine where `found` are installed: each CLI on the PATH, its home with the user's real config.
function machine(found: HarnessId[], fakes: Partial<Record<string, string>> = {}): Machine {
  const root = join(TMP, `m${++machines}`);
  const home = join(root, "home");
  const codex = join(home, ".codex");
  const bin = join(root, "bin");
  for (const d of [bin, join(root, "tmp"), join(home, ".config"), join(home, ".cache")]) mkdirSync(d, { recursive: true });
  // Only the fixture CLIs and these utilities are reachable, even if a real harness lives in /usr/bin.
  for (const name of TOOLS) {
    const tool = Bun.which(name);
    if (tool === null) throw new Error(`${name} is required by the machine e2e`);
    symlinkSync(tool, join(bin, name));
  }
  const env = {
    HOME: home, XDG_DATA_HOME: join(home, ".local/share"), XDG_STATE_HOME: join(home, ".local/state"), XDG_CONFIG_HOME: join(home, ".config"),
    XDG_CACHE_HOME: join(home, ".cache"), TMPDIR: join(root, "tmp"), CODEX_HOME: codex, GROK_HOME: join(home, ".grok"),
    PATH: `${bin}:${home}/.local/bin`, SHELL: "/bin/zsh", LOG: join(root, "log"),
    // The fixture replaces the process environment. CI is the product's existing non-interactive
    // channel for --yes; this machine is not an agent in a consumer project.
    CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
  };
  const m: Machine = {
    root, home, data: join(env.XDG_DATA_HOME, "pregate"), state: join(env.XDG_STATE_HOME, "pregate"), codex, env,
    settings: join(home, ".claude/settings.json"), hooks: join(codex, "hooks.json"), plugin: join(home, ".gemini/config/plugins/pregate-global"),
    launcher: join(env.XDG_DATA_HOME, "pregate/bin/pregate"), link: join(home, ".local/bin/pregate"),
  };
  const configs: Record<HarnessId, [string, string][]> = {
    "claude-code": [["claude-settings.json", m.settings]], cursor: [], grok: [["grok-config.toml", join(home, ".grok/config.toml")]],
    codex: [["codex-hooks.json", m.hooks], ["codex-config.toml", join(codex, "config.toml")]],
    agy: [["gemini-config.json", join(home, ".gemini/config/config.json")]],
  };
  for (const h of found) {
    for (const [from, to] of configs[h]) put(to, readFileSync(join(CONFIGS, from), "utf8"));
    const name = { "claude-code": "claude", codex: "codex", cursor: "cursor-agent", grok: "grok", agy: "agy" }[h];
    put(join(bin, name), fakes[name] ?? FAKES[h], 0o755);
  }
  for (const [name, text] of Object.entries(fakes)) if (!existsSync(join(bin, name))) put(join(bin, name), text!, 0o755);
  if (found.includes("codex")) ok(run(["codex", "trust-all"], m), "trust-all");   // the user approved Orca's hooks in /hooks
  return m;
}

const version = (h: HarnessId, text: string): string => `#!/bin/sh\n[ "$1" = --version ] && echo '${text.replace("@", HARNESSES[h].VERIFIED)}'\nexit 0\n`;
const FAKES: Record<HarnessId, string> = {
  "claude-code": version("claude-code", "@ (Claude Code)"),
  cursor: version("cursor", "@"),
  grok: version("grok", "grok @"),
  codex: `#!/bin/sh\n[ "$1" = --version ] && { echo 'codex-cli ${HARNESSES.codex.VERIFIED}'; exit 0; }\nexec '${process.execPath}' '${APP_SERVER}' "$@"\n`,
  // `agy plugin install <dir>` copies it into ~/.gemini/config/plugins/<dir name>/ (harness-agy-live §1).
  agy: `#!/bin/sh\necho "agy $*" >> "$LOG"\ncase "$1 $2" in\n"--version ") echo '${HARNESSES.agy.VERIFIED}' ;;\n`
    + `"plugin install") p="$HOME/.gemini/config/plugins/\${3##*/}"; rm -rf "$p"; mkdir -p "\${p%/*}"; cp -R "$3" "$p" ;;\n`
    + `"plugin uninstall") rm -rf "$HOME/.gemini/config/plugins/$3" ;;\nesac\n`,
};

function put(path: string, text: string, mode = 0o644): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { mode });
  chmodSync(path, mode);
}

function run(cmd: string[], m: Machine, cwd = m.home): Out {
  const r = Bun.spawnSync(cmd, { cwd, env: m.env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 100_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function ok(o: Out, what: string): Out {
  if (o.code !== 0) throw new Error(`${what} exited ${o.code}\n${o.stdout}\n${o.stderr}`);
  return o;
}

const pregate = (m: Machine, ...args: string[]): Out => run([BIN, ...args], m);
// uninstall asks the human for y on the terminal; a CI job passes --yes instead.
const human = (m: Machine, cmd: string[]): Out => run(cmd, { ...m, env: { ...m.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" } });
const uninstall = (m: Machine, ...args: string[]): Out => human(m, [BIN, "uninstall", "--yes", ...args]);
const read = (path: string): string | null => (existsSync(path) ? readFileSync(path, "utf8") : null);
const json = (path: string): Json => JSON.parse(read(path)!) as Json;
const marker = (m: Machine): string => `'${m.data}/bin/pregate'`;
const ours = (m: Machine, g: unknown): boolean => JSON.stringify(g).includes(marker(m));
const foreign = (m: Machine, o: Json): Json => {
  const copy = structuredClone(o);
  for (const e of Object.keys(copy.hooks ?? {})) copy.hooks[e] = copy.hooks[e].filter((g: unknown) => !ours(m, g));
  return copy;
};
// Every file setup may write, as bytes plus mtime: equal stamps mean nothing was written.
function stamps(m: Machine): Record<string, string> {
  const files = [m.settings, m.hooks, join(m.codex, "config.toml"), join(m.plugin, "hooks.json"), join(m.plugin, "plugin.json"),
    join(m.state, "codex-trust.json"), m.launcher, join(m.data, pkg.version, "pregate")];
  return Object.fromEntries(files.map((f) => [f, existsSync(f) ? `${statSync(f).mtimeMs} ${createHash("sha256").update(readFileSync(f)).digest("hex")}` : "absent"]));
}

// What the fake app-server says of each hook of hooks.json, by <event>:<group>:<hook>.
function trust(m: Machine): Record<string, string> {
  const p = Bun.spawnSync(["codex", "app-server"], {
    env: m.env, stdout: "pipe", stdin: Buffer.from(`${JSON.stringify({ id: 1, method: "hooks/list", params: { cwds: [] } })}\n`),
  });
  const hooks = (JSON.parse(p.stdout.toString()) as Json).result.data[0].hooks as { key: string; trustStatus: string }[];
  return Object.fromEntries(hooks.map((h) => [h.key.slice(m.hooks.length + 1), h.trustStatus]));
}

describe("setup", () => {
  test("with the five found: every registration in place, foreign config untouched, Codex trusted; a second run writes nothing", () => {
    const m = machine(ALL);
    const before = { settings: json(m.settings), hooks: json(m.hooks), trust: trust(m) };
    const out = ok(pregate(m, "setup"), "setup");
    expect(out.stdout).not.toContain("ERROR");
    expect(readlinkSync(m.link)).toBe(m.launcher);
    expect(read(m.launcher)).toContain(`version=${pkg.version}\n`);
    expect(statSync(m.launcher).mode & 0o777).toBe(0o755);
    for (const [file, t] of [[m.settings, "shared"], [m.hooks, "codex"]] as const) {
      const after = json(file);
      expect(foreign(m, after)).toEqual(file === m.settings ? before.settings : before.hooks);
      for (const e of EVENTS) expect(exact(after.hooks[e].at(-1), t, m.data)).toBe(true);
      expect(read(`${file}.pregate.bak`)).toBe(readFileSync(join(CONFIGS, file === m.settings ? "claude-settings.json" : "codex-hooks.json"), "utf8"));
    }
    // Ours are trusted, and every foreign hook keeps the trust it had.
    const after = trust(m);
    for (const [k, s] of Object.entries(before.trust)) expect(after[k]).toBe(s);
    const mine = EVENTS.map((e) => `${{ PreToolUse: "pre_tool_use", Stop: "stop", SessionStart: "session_start" }[e]}:${json(m.hooks).hooks[e].length - 1}:0`);
    for (const k of mine) expect(after[k]).toBe("trusted");
    expect(Object.keys(json(join(m.state, "codex-trust.json"))).sort()).toEqual(mine.map((k) => `${m.hooks}:${k}`).sort());
    for (const [f, text] of Object.entries(agyPlugin(m.data))) expect(read(join(m.plugin, f))).toBe(text);

    const stamped = stamps(m);
    const again = ok(run([m.link, "setup"], m), "setup through the CLI link");
    expect(again.stdout).not.toContain("ERROR");
    expect(stamps(m)).toEqual(stamped);
    expect(trust(m)).toEqual(after);
  });

  test("a foreign Codex hook that would lose its trust: hooks.json goes back to its bytes and setup fails", () => {
    const m = machine(["codex"]);
    // Two groups of an older PREGATE ahead of a foreign one: replacing them in place drops the second,
    // so the foreign group moves up one index.
    const old = { hooks: [{ type: "command", command: `f=${marker(m)}; exec "$f" hook pre --harness codex`, timeout: 10 }] };
    const other = { hooks: [{ type: "command", command: "/usr/local/bin/other", timeout: 5 }] };
    const text = `${JSON.stringify({ hooks: { PreToolUse: [old, old, other] } }, null, 2)}\n`;
    put(m.hooks, text);
    ok(run(["codex", "trust-all"], m), "trust-all");
    const out = pregate(m, "setup");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain(`ERROR: Codex: these third-party hooks lost trust: ${m.hooks}:pre_tool_use:2:0. Left ${m.hooks} unchanged.`);
    expect(read(m.hooks)).toBe(text);
    expect(trust(m)["pre_tool_use:2:0"]).toBe("trusted");
    expect(existsSync(join(m.state, "codex-trust.json"))).toBe(false);
  });

  test("an older group of ours dropped beside a foreign one keeps that hook's trust", () => {
    const m = machine(["codex"]);
    const old = { hooks: [{ type: "command", command: `f=${marker(m)}; exec "$f" hook pre --harness codex`, timeout: 10 }] };
    const other = { hooks: [{ type: "command", command: "/usr/local/bin/other", timeout: 5 }] };
    put(m.hooks, `${JSON.stringify({ hooks: { PreToolUse: [old, other, old] } }, null, 2)}\n`);
    ok(run(["codex", "trust-all"], m), "trust-all");
    const out = ok(pregate(m, "setup"), "setup");
    expect(out.stdout).toContain("Codex: hooks registered");
    const groups = json(m.hooks).hooks.PreToolUse;
    expect(exact(groups[0], "codex", m.data)).toBe(true);
    expect(groups[1]).toEqual(other);
    expect(trust(m)["pre_tool_use:1:0"]).toBe("trusted");
  });

  test("Codex whose app-server does not answer: hooks.json is not written", () => {
    const m = machine(["codex"], {
      codex: `#!/bin/sh\n[ "$1" = --version ] && { echo 'codex-cli ${HARNESSES.codex.VERIFIED}'; exit 0; }\n[ "$1" = app-server ] && exit 1\nexec '${process.execPath}' '${APP_SERVER}' "$@"\n`,
    });
    const text = read(m.hooks);
    const out = pregate(m, "setup");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("ERROR: Codex: codex app-server exited without answering");
    expect(out.stderr).toBe("");
    expect(read(m.hooks)).toBe(text);
  });

  test("Codex app-server's own reason for exiting reaches the setup error", () => {
    const m = machine(["codex"], {
      codex: `#!/bin/sh\n[ "$1" = --version ] && { echo 'codex-cli ${HARNESSES.codex.VERIFIED}'; exit 0; }\n[ "$1" = app-server ] && { echo 'WARN noise' >&2; echo 'Error: config.toml is unreadable' >&2; exit 1; }\nexec '${process.execPath}' '${APP_SERVER}' "$@"\n`,
    });
    const out = pregate(m, "setup");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("ERROR: Codex: codex app-server exited without answering initialize (Error: config.toml is unreadable)");
  });

  test("Codex installed but never opened: setup creates CODEX_HOME before asking app-server", () => {
    const m = machine(["codex"], {
      // Like codex 0.159: an explicit CODEX_HOME that does not exist stops app-server at startup.
      codex: `#!/bin/sh\n[ "$1" = --version ] && { echo 'codex-cli ${HARNESSES.codex.VERIFIED}'; exit 0; }\n[ "$1" = app-server ] && [ ! -d "$CODEX_HOME" ] && { echo "Error: CODEX_HOME points to $CODEX_HOME, but that path does not exist" >&2; exit 1; }\nexec '${process.execPath}' '${APP_SERVER}' "$@"\n`,
    });
    rmSync(m.codex, { recursive: true, force: true });
    const out = ok(pregate(m, "setup"), "setup");
    expect(out.stdout).toContain("Codex: hooks registered");
    expect(existsSync(m.hooks)).toBe(true);
  });

  test.each(["initialize", "initialized", "hooks/list", "config/batchWrite"])("Codex app-server dies at %s: setup reports the error and preserves hooks and trust", (method) => {
    const m = machine(["codex"]);
    m.env.CODEX_FAKE_DIE_ON = method;
    const hooks = read(m.hooks);
    const config = read(join(m.codex, "config.toml"));
    const out = pregate(m, "setup");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("ERROR: Codex: codex app-server exited without answering");
    expect(out.stderr).toBe("");
    expect(read(m.hooks)).toBe(hooks);
    expect(read(join(m.codex, "config.toml"))).toBe(config);
    expect(existsSync(join(m.state, "codex-trust.json"))).toBe(false);
  });

  test("Codex and agy without their binaries: setup registers the Codex hooks (an IDE may bundle codex), skips agy; doctor does not fail", () => {
    const m = machine([]);
    put(join(m.codex, "config.toml"), "");
    put(join(m.home, ".gemini/antigravity-cli/settings.json"), "{}");
    // An interrupted install left a copy whose process is gone; one whose process runs is kept.
    const stale = join(m.data, pkg.version, "pregate.2147483646.tmp"), live = join(m.data, pkg.version, `pregate.${process.pid}.tmp`);
    put(stale, "partial"); put(live, "partial");
    const out = ok(pregate(m, "setup"), "setup");
    expect(out.stdout).toContain("Removed 1 engine copy left by an interrupted install.");
    expect([existsSync(stale), existsSync(live)]).toEqual([false, true]);
    expect(out.stdout).toContain(`INFO: codex: binary not on PATH; hooks registered in ${m.hooks} but not trusted.`);
    expect(out.stdout).toContain("INFO: agy: binary not on PATH; skipped. Install it and rerun pregate setup.");
    expect(EVENTS.every((e) => (json(m.hooks).hooks[e] as unknown[]).some((g) => exact(g, "codex", m.data)))).toBe(true);
    expect(existsSync(m.plugin)).toBe(false);
    const doctor = ok(pregate(m, "doctor"), "doctor");
    expect(doctor.stdout).toContain(`INFO: codex: PREGATE hooks registered in ${m.hooks}; their trust cannot be verified without codex on PATH.`);
    expect(doctor.stdout).toContain("WARNING: No harness with its binary on PATH; PREGATE gates nothing yet.");
    expect(doctor.stdout).not.toContain("ERROR");
    // A Codex home whose hooks.json lost the PREGATE groups is not reported as healthy.
    put(m.hooks, "{}");
    expect(ok(pregate(m, "doctor"), "doctor").stdout).toContain(`WARNING: codex: ${m.hooks} has no PREGATE hooks; Codex sessions an IDE launches from its bundled binary are not protected.`);
  });

  test("a trusted Codex hooks.json left behind without its binary does not fail doctor", () => {
    const m = machine(["codex"]);
    ok(pregate(m, "setup"), "setup");
    rmSync(join(m.root, "bin/codex"));
    const doctor = ok(pregate(m, "doctor"), "doctor");
    expect(doctor.stdout).toContain("INFO: codex: config found but its binary is not on PATH; not checked.");
    expect(doctor.stdout).not.toContain("codex: canary");
  });

  test("a settings.json that is not JSON is left as it is, and setup fails", () => {
    const m = machine(["claude-code"]);
    put(m.settings, "{ not json");
    const out = pregate(m, "setup");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain(`ERROR: ${m.settings} must be a JSON object`);
    expect(read(m.settings)).toBe("{ not json");
  });

  test("dotfiles in a symlink: the registration is written into its target", () => {
    const m = machine(["claude-code"]);
    const target = join(m.root, "dotfiles/claude-settings.json");
    put(target, read(m.settings)!);
    rmSync(m.settings);
    Bun.spawnSync(["ln", "-s", target, m.settings]);
    ok(pregate(m, "setup"), "setup");
    expect(lstatSync(m.settings).isSymbolicLink()).toBe(true);
    expect(exact(json(target).hooks.PreToolUse.at(-1), "shared", m.data)).toBe(true);
  });

  test("nothing found: the engine, the launcher and the link, and no registration", () => {
    const m = machine([]);
    const out = pregate(m, "setup");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("WARNING: No Claude Code, Codex, Cursor, Grok or agy found");
    expect(out.stdout).not.toContain("ERROR:");
    expect(existsSync(join(m.data, pkg.version, "pregate"))).toBe(true);
    expect(existsSync(m.launcher)).toBe(true);
    expect(existsSync(m.link)).toBe(true);
    expect(existsSync(m.settings) || existsSync(m.hooks) || existsSync(m.plugin)).toBe(false);
  });

  test("Claude wired and Codex trust not confirmed: exit 0, Codex left unchanged, warning names /hooks", () => {
    const m = machine(["claude-code", "codex"]);
    m.env.CODEX_FAKE_REFUSE_TRUST = "1";
    const hooks = read(m.hooks);
    const out = pregate(m, "setup");
    expect(out.code).toBe(0);
    expect(out.stdout).toContain(`Hooks registered in ${m.settings}.`);
    expect(out.stdout).toContain(`WARNING: Codex: Codex did not confirm trust for the PREGATE hooks. Left ${m.hooks} unchanged. Approve them in Codex with /hooks, then rerun pregate setup.`);
    expect(out.stdout).not.toContain("ERROR:");
    expect(read(m.hooks)).toBe(hooks);
    expect(exact(json(m.settings).hooks.PreToolUse.at(-1), "shared", m.data)).toBe(true);
    expect(existsSync(join(m.state, "codex-trust.json"))).toBe(false);
  });

  test("Codex trust not confirmed and no other harness: hooks.json stays, setup exits non-zero", () => {
    const m = machine(["codex"]);
    m.env.CODEX_FAKE_REFUSE_TRUST = "1";
    const hooks = read(m.hooks);
    const out = pregate(m, "setup");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain(`WARNING: Codex: Codex did not confirm trust for the PREGATE hooks. Left ${m.hooks} unchanged. Approve them in Codex with /hooks, then rerun pregate setup.`);
    expect(out.stdout).not.toContain("ERROR:");
    expect(read(m.hooks)).toBe(hooks);
    expect(existsSync(m.settings)).toBe(false);
  });
});

describe("doctor", () => {
  test("after setup: the registrations, Codex trust and every harness's canary through $SHELL -c", () => {
    const m = machine(ALL);
    ok(pregate(m, "setup"), "setup");
    const out = pregate(m, "doctor");
    for (const h of ALL) expect(out.stdout).toContain(`${h} ${HARNESSES[h].VERIFIED}.`);
    expect(out.stdout).toContain(`Launcher at ${m.launcher} with engine ${pkg.version}.`);
    expect(out.stdout).toContain("Codex runs the PREGATE hooks (trusted).");
    expect(out.stdout).toContain(`pregate on PATH: ${m.link}.`);
    expect(out.stdout).toContain("Hook supervision: required launcher commands are registered.");
    expect(out.stdout).toContain("Grok PreToolUse: failClosed is set");
    for (const h of ALL) expect(out.stdout).toContain(`${h}: canary denied in its native dialect.`);
    expect(out.stdout.split("\n").filter((l) => l.startsWith("ERROR"))).toEqual([]);
    expect(out.code).toBe(0);
  });

  test("drift, a disabled plugin, lost trust and a CLI version that changed are reported", () => {
    const m = machine(ALL, { grok: version("grok", "grok 9.9.9") });
    ok(pregate(m, "setup"), "setup");
    put(join(m.codex, "config.toml"), read(join(m.codex, "config.toml"))!.replaceAll(/trusted_hash = "sha256:[0-9a-f]+"/g, 'trusted_hash = "sha256:0"'));
    const config = join(m.home, ".gemini/config/config.json");
    put(config, JSON.stringify({ plugins: { ...json(config).plugins, "pregate-global": { enabled: false } } }));
    const settings = json(m.settings);
    settings.hooks.Stop.pop();
    put(m.settings, JSON.stringify(settings));
    const out = pregate(m, "doctor");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("ERROR: ~/.claude/settings.json: PREGATE hooks missing or modified (Stop)");
    expect(out.stdout).toContain("ERROR: agy: pregate-global is disabled");
    expect(out.stdout).toContain("ERROR: Codex runs 0 of 3 PREGATE hooks");
    expect(out.stdout).toContain("WARNING: grok: version grok 9.9.9; hooks verified with 1.0.49.");
  });

  test("a launcher that is gone: the installation and the canary fail", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    rmSync(m.launcher);
    const out = pregate(m, "doctor");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain(`ERROR: Missing launcher ${m.launcher}; run pregate setup.`);
    expect(out.stdout).toContain("ERROR: claude-code: canary was not denied in its native dialect (exit 2;");
  });

  test("a direct engine hook is not admitted as supervised even when the wrapper canary passes", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    const settings = json(m.settings);
    const hook = settings.hooks.PreToolUse.flatMap((group: { hooks: { command: string }[] }) => group.hooks)
      .find((hook: { command: string }) => hook.command.includes(m.launcher));
    expect(hook).toBeDefined();
    hook.command = `'${join(m.data, pkg.version, "pregate")}' hook pre --harness claude-code`;
    put(m.settings, JSON.stringify(settings));
    const out = pregate(m, "doctor");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("PREGATE hooks missing or modified (PreToolUse)");
    expect(out.stdout).toContain("WARNING: Hook supervision is not established for every detected harness.");
    expect(out.stdout).toContain("Direct engine hook calls have no launcher crash/timeout protection.");
    expect(out.stdout).toContain("claude-code: canary denied in its native dialect.");
  });
});

describe("uninstall", () => {
  test("restores Orca and ArkGate configs byte for byte, including Codex trust it did not grant", () => {
    const m = machine(ALL);
    const settings = withGroups(read(m.settings)!, join(CONFIGS, "arkgate/.claude/settings.json"));
    const hooks = withGroups(read(m.hooks)!, join(CONFIGS, "arkgate/.codex/hooks.json"));
    put(m.settings, settings);
    put(m.hooks, hooks);
    ok(run(["codex", "trust-all"], m), "trust-all");
    const toml = read(join(m.codex, "config.toml"))!;
    const grok = read(join(m.home, ".grok/config.toml"));
    const gemini = read(join(m.home, ".gemini/config/config.json"));
    ok(pregate(m, "setup"), "setup");
    const diagnosis = ok(pregate(m, "doctor"), "doctor");
    for (const h of ALL) expect(diagnosis.stdout).toContain(`${h}: canary denied in its native dialect.`);
    ok(human(m, [m.link, "uninstall", "--yes"]), "uninstall");
    expect(read(m.settings)).toBe(settings);
    expect(read(m.hooks)).toBe(hooks);
    expect(read(join(m.codex, "config.toml"))).toBe(toml);
    expect(read(join(m.home, ".grok/config.toml"))).toBe(grok);
    expect(read(join(m.home, ".gemini/config/config.json"))).toBe(gemini);
    expect(read(`${m.settings}.pregate.bak`)).toBe(settings);
    expect(read(`${m.hooks}.pregate.bak`)).toBe(hooks);
    for (const text of [settings, hooks]) {
      expect(text).toContain("orca");
      expect(text).toContain("ark-mcp.mjs");
    }
    expect(toml).toContain('"/Users/user/Desktop/ARK/v1"');
  });

  test("restores every config to its foreign content, lists moved Codex hooks, and leaves the repos and backups", () => {
    const m = machine(ALL);
    const original = { settings: json(m.settings), hooks: json(m.hooks), toml: read(join(m.codex, "config.toml")) };
    const repo = join(m.home, "repo/.pregate/preset.json");
    put(repo, "{}\n");
    ok(pregate(m, "setup"), "setup");
    // A foreign group added after ours moves up one index when ours goes.
    const later = json(m.hooks);
    later.hooks.Stop.push({ hooks: [{ type: "command", command: "/usr/local/bin/later", timeout: 5 }] });
    put(m.hooks, JSON.stringify(later, null, 2));
    const out = ok(human(m, [m.link, "uninstall", "--yes"]), "uninstall");
    expect(json(m.settings)).toEqual(original.settings);
    expect(json(m.hooks)).toEqual({ hooks: { ...original.hooks.hooks, Stop: [...(original.hooks.hooks.Stop ?? []), later.hooks.Stop.at(-1)] } });
    expect(out.stdout).toContain(`Codex requires approval in /hooks: ${m.hooks}:stop:${(original.hooks.hooks.Stop ?? []).length}:0.`);
    expect(out.stdout).toContain(`${m.settings}.pregate.bak`);
    expect(read(join(m.codex, "config.toml"))).not.toBeNull();
    for (const gone of [m.plugin, m.link, m.data, join(m.state, "codex-trust.json")]) expect(existsSync(gone)).toBe(false);
    expect(read(repo)).toBe("{}\n");
    expect(read(join(m.root, "log"))).toContain("agy plugin uninstall pregate");
  });

  test("--purge also removes the state; a link that is not ours stays", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    mkdirSync(join(m.state, "sessions/s1"), { recursive: true });
    rmSync(m.link);
    put(m.link, "#!/bin/sh\n", 0o755);
    // Without a terminal and without CI, uninstall refuses and changes nothing.
    const refused = pregate(m, "uninstall", "--purge");
    expect(refused.code).toBe(1);
    expect(refused.stdout).toContain("human-only command");
    expect(existsSync(m.state)).toBe(true);
    ok(uninstall(m, "--purge"), "uninstall --purge");
    expect(existsSync(m.state)).toBe(false);
    expect(read(m.link)).toBe("#!/bin/sh\n");
    expect(foreign(m, json(m.settings))).toEqual(json(m.settings));
  });
});

describe("update", () => {
  const NEXT = "9.9.9";
  const TAR = `pregate-${NEXT}-${hostTarget()}.tar.gz`;

  // A release of NEXT whose engine logs, when it answers --version and when it runs setup, the version
  // the launcher names at that moment; `gh` serves it from a folder.
  function release(m: Machine, sums?: string): string {
    const dir = join(m.root, "release");
    put(join(dir, "x/pregate"), `#!/bin/sh\nv=$(sed -n 's/^version=//p' '${m.launcher}')\n`
      + `case $1 in --version) echo "warm-up, launcher $v" >> "$LOG"; echo 'pregate ${NEXT}' ;; setup) echo "setup, launcher $v" >> "$LOG"; echo 'setup ${NEXT}' ;; esac\n`, 0o755);
    ok(run(["tar", "-czf", join(dir, TAR), "-C", join(dir, "x"), "pregate"], m), "tar");
    put(join(dir, "SHA256SUMS"), sums ?? `${createHash("sha256").update(readFileSync(join(dir, TAR))).digest("hex")}  ${TAR}\n`);
    return dir;
  }

  test("the engine lands and warms up before the launcher names it; then that engine's setup runs; the old engine stays", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    put(join(m.root, "bin/gh"), ghOf(release(m)), 0o755);
    const out = ok(run([m.link, "update"], m), "update");
    expect(out.stdout).toContain(`Engine ${NEXT} installed at ${join(m.data, NEXT)}; the launcher now uses it.\nsetup ${NEXT}`);
    expect(logOf(m).filter((l) => !l.startsWith("gh "))).toEqual([`warm-up, launcher ${pkg.version}`, `setup, launcher ${NEXT}`]);
    expect(logOf(m).filter((l) => l.startsWith("gh "))[1]).toBe(`gh release download v${NEXT} --repo pedroknigge/pregate --pattern ${TAR} --pattern SHA256SUMS --dir ${logOf(m).find((l) => l.startsWith("gh release download"))!.split("--dir ")[1]}`);
    expect(existsSync(join(m.data, pkg.version, "pregate"))).toBe(true);
  });

  test("--engine installs that engine and leaves the launcher", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    put(join(m.root, "bin/gh"), ghOf(release(m)), 0o755);
    const launcher = read(m.launcher);
    ok(run([m.link, "update", "--engine", `v${NEXT}`], m), "update --engine");
    expect(existsSync(join(m.data, NEXT, "pregate"))).toBe(true);
    expect(read(m.launcher)).toBe(launcher);
    expect(logOf(m).some((l) => l.startsWith("setup"))).toBe(false);
  });

  test("update keeps going when setup only warns that no harness was wired", () => {
    const m = machine([]);
    const first = pregate(m, "setup");
    expect(first.code).toBe(1);
    expect(first.stdout).toContain("WARNING: No Claude Code");
    expect(first.stdout).not.toContain("ERROR:");
    const root = join(m.root, "project");
    mkdirSync(root);
    ok(run([BIN, "init", "--yes", "--preset", "integrity-only"], m, root), "init");
    const lock = join(root, ".pregate/pregate.lock.json");
    put(lock, JSON.stringify({ ...json(lock), engine: "0.0.0" }));
    const out = ok(run([m.link, "update", "--version", pkg.version], m, root), "update");
    expect(out.stdout).toContain("WARNING: No Claude Code");
    expect(out.stdout).toContain("1 project reviews prepared");
    expect(out.stdout).not.toContain("ERROR:");
  });

  test("update stops when setup reports a real error and does not prepare project reviews", () => {
    const m = machine(["claude-code"]);
    put(m.settings, "{");
    const first = pregate(m, "setup");
    expect(first.code).toBe(1);
    expect(first.stdout).toContain("ERROR:");
    const root = join(m.root, "project");
    mkdirSync(root);
    ok(run([BIN, "init", "--yes", "--preset", "integrity-only"], m, root), "init");
    const lock = join(root, ".pregate/pregate.lock.json");
    put(lock, JSON.stringify({ ...json(lock), engine: "0.0.0" }));
    const out = run([m.link, "update", "--version", pkg.version], m, root);
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("ERROR:");
    expect(out.stdout).not.toContain("project reviews prepared");
  });

  test("updating inside a project automatically prepares one review without applying the project contract", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    const root = join(m.root, "project");
    mkdirSync(root);
    ok(run([BIN, "init", "--yes", "--preset", "integrity-only"], m, root), "init");
    const files = ["preset.json", "pregate.lock.json"].map(file => join(root, ".pregate", file));
    // Exercise a migration, not the current-contract no-op.
    for (const file of files) {
      const old = JSON.parse(read(file)!); old.engine = "0.0.0";
      put(file, JSON.stringify(old));
    }
    const before = files.map(read);
    const consentFiles = readdirSync(join(m.data, "consent")).sort().map(file => join(m.data, "consent", file));
    const consent = consentFiles.map(read);
    const out = ok(run([m.link, "update", "--version", pkg.version], m, root), "update");
    expect(out.stdout).toContain("Approval commits the preset and lock");
    expect(out.stdout).toContain("Digest:");
    expect(out.stdout).toContain("1 project reviews prepared");
    expect(out.stdout).toContain("preset, lock and consent remain unchanged until approval");
    expect(out.stdout).toContain("pregate status to inspect effective protection");
    expect(files.map(read)).toEqual(before);
    expect(consentFiles.map(read)).toEqual(consent);
  });

  test("update reviews every enabled registered project that pins an older engine, from any directory, in one preview", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    const projects = ["registered a", "registered b", "registered current"].map((name) => join(m.root, name)) as [string, string, string];
    for (const root of projects) {
      mkdirSync(root);
      ok(run([BIN, "init", "--yes", "--preset", "integrity-only"], m, root), "init");
    }
    for (const root of projects.slice(0, 2)) {
      const lock = join(root, ".pregate/pregate.lock.json");
      put(lock, JSON.stringify({ ...json(lock), engine: "0.0.0" }));
    }
    ok(run([BIN, "disable", "--yes"], m, projects[1]), "disable");
    const out = ok(run([m.link, "update", "--version", pkg.version], m), "update");
    expect(out.stdout).toContain(`Project: ${projects[0]}`);
    expect(out.stdout).not.toContain(`Project: ${projects[1]}`);
    expect(out.stdout).not.toContain(`Project: ${projects[2]}`);
    expect(out.stdout).toContain("1 project reviews prepared");
    ok(run([BIN, "enable", "--yes"], m, projects[1]), "enable");
    const lock = join(projects[0], ".pregate/pregate.lock.json");
    put(lock, JSON.stringify({ ...json(lock), engine: "99.0.0" }));
    const again = ok(run([m.link, "update", "--version", pkg.version], m), "update again");
    expect(again.stdout).toContain(`Project: ${projects[1]}`);
    expect(again.stdout).not.toContain(`Project: ${projects[0]}`);
  });

  test("update removes engines no registered project pins and keeps the pinned, previous and new ones", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    for (const v of ["0.0.0", "0.0.1"]) put(join(m.data, v, "pregate"), "#!/bin/sh\n", 0o755);
    const root = join(m.root, "pinned");
    mkdirSync(root);
    ok(run([BIN, "init", "--yes", "--preset", "integrity-only"], m, root), "init");
    const lock = join(root, ".pregate/pregate.lock.json");
    put(lock, JSON.stringify({ ...json(lock), engine: "0.0.1" }));
    put(join(m.root, "bin/gh"), ghOf(release(m)), 0o755);
    const out = ok(run([m.link, "update"], m), "update");
    expect(out.stdout).toContain(`Removed 1 older engines (0.0.0); kept ${["0.0.1", pkg.version, NEXT].sort().join(", ")}.`);
    expect(existsSync(join(m.data, "0.0.0"))).toBe(false);
    for (const v of ["0.0.1", pkg.version, NEXT]) expect(existsSync(join(m.data, v, "pregate"))).toBe(true);
  });

  test("update keeps the engine a worktree pins through repository consent after the consented worktree is removed", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    put(join(m.data, "0.0.1", "pregate"), "#!/bin/sh\n", 0o755);
    const main = join(m.root, "repo main"), agent = join(m.root, "agent wt");
    mkdirSync(main);
    const git = (...args: string[]) => ok(run(["git", "-c", "user.name=W", "-c", "user.email=w@example.com", "-c", "commit.gpgsign=false", ...args], m, main), args[0]!);
    git("init", "-q"); git("commit", "-q", "--allow-empty", "-m", "init"); git("worktree", "add", "-q", "-b", "agent", agent);
    ok(run([BIN, "init", "--yes", "--preset", "integrity-only"], m, agent), "init in the agent worktree");
    put(join(main, ".pregate/pregate.lock.json"), JSON.stringify({ engine: "0.0.1" }));
    git("worktree", "remove", "--force", agent);
    put(join(m.root, "bin/gh"), ghOf(release(m)), 0o755);
    const out = ok(run([m.link, "update"], m), "update");
    expect(out.stdout).not.toContain("0.0.1)");
    expect(existsSync(join(m.data, "0.0.1", "pregate"))).toBe(true);
    // The inheriting checkout is reviewed too (the fake release engine prints no preview).
    expect(out.stdout).toContain("Each project's preset, lock and consent remain unchanged until approval.");
  });

  test("a registered project that cannot be previewed does not fail the update of a healthy current project", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    const [broken, healthy] = ["broken registered", "healthy current"].map((name) => join(m.root, name)) as [string, string];
    for (const root of [broken, healthy]) {
      mkdirSync(root);
      ok(run([BIN, "init", "--yes", "--preset", "integrity-only"], m, root), "init");
      const lock = join(root, ".pregate/pregate.lock.json");
      put(lock, JSON.stringify({ ...json(lock), engine: "0.0.0" }));
    }
    const preset = join(broken, ".pregate/preset.json");
    put(preset, JSON.stringify({ ...json(preset), sources: [...json(preset).sources, { ns: "missing-pack", kind: "library", version: "1.0.0" }] }));
    const out = ok(run([m.link, "update", "--version", pkg.version], m, healthy), "update");
    expect(out.stdout).toContain(`Project: ${realpathSync(healthy)}`);
    expect(out.stdout).toContain("1 project reviews prepared");
    expect(out.stdout).toContain(`1 project reviews failed: ${realpathSync(broken)}.`);
    expect(out.stdout).toContain("WARNING: Some registered project reviews failed (named above).");
  });

  test("a tar that does not match SHA256SUMS installs nothing", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    put(join(m.root, "bin/gh"), ghOf(release(m, `${"0".repeat(64)}  ${TAR}\n`)), 0o755);
    const launcher = read(m.launcher);
    const out = run([m.link, "update"], m);
    expect(out.code).toBe(1);
    expect(out.stdout).toBe(`SHA-256 of ${TAR} differs from SHA256SUMS; nothing installed.\n`);
    expect(existsSync(join(m.data, NEXT))).toBe(false);
    expect(read(m.launcher)).toBe(launcher);
  });

  test("an invalid version is refused before anything is downloaded", () => {
    const m = machine(["claude-code"]);
    ok(pregate(m, "setup"), "setup");
    const out = run([m.link, "update", "--version", "main"], m);
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("Invalid version: main");
    expect(readdirSync(m.data).sort()).toEqual([pkg.version, "bin"].sort());
  });
});

// gh serving one folder: `release view` names NEXT, `release download` copies the patterns to --dir.
function ghOf(dir: string): string {
  return `#!/bin/sh\necho "gh $*" >> "$LOG"\ncase "$1 $2" in\n"release view") echo 'v9.9.9' ;;\n`
    + `"release download") prev=; for a; do [ "$prev" = --dir ] && out=$a; prev=$a; done\n`
    + `  prev=; for a; do [ "$prev" = --pattern ] && cp '${dir}'/"$a" "$out/"; prev=$a; done ;;\n*) exit 1 ;;\nesac\n`;
}

function logOf(m: Machine): string[] {
  return (read(join(m.root, "log")) ?? "").trim().split("\n");
}

// The ArkGate groups, appended, so the Orca entries stay at the indexes Codex already trusted.
function withGroups(base: string, extraPath: string): string {
  const a = JSON.parse(base) as Json;
  const extra = JSON.parse(readFileSync(extraPath, "utf8")) as Json;
  a.hooks ??= {};
  for (const [event, groups] of Object.entries(extra.hooks as Record<string, unknown[]>)) {
    a.hooks[event] = [...(a.hooks[event] ?? []), ...groups];
  }
  return `${JSON.stringify(a, null, 2)}\n`;
}
