import { beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { VERIFIED } from "../src/harness/cursor.ts";

// Compiled binary, real git repositories. Enable proposes folders and writes them only after
// approval. CI without the unattended opt-in does not. Audit names a folder added later and
// leaves the contract alone. Excluded trees produce no findings; source still does.

setDefaultTimeout(180_000);

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-exclude-")));
const home = join(area, "home");
const binary = join(area, "install", "0.0.12", ENGINE_FILE);
const baseEnv = {
  ...process.env, HOME: home, USERPROFILE: home,
  XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
  GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
  GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  CI: "1", PATH: process.env.PATH,
};

const JS = "function bad(a, b, c, d, e, f) { return a + b + c + d + e + f; }\n";
const GO = "package p\n\nfunc Bad(a, b, c, d, e int) int { return a }\n";

interface Out { code: number; stdout: string; stderr: string }

function run(cwd: string, args: string[], env: Record<string, string | undefined> = baseEnv, stdin = ""): Out {
  const r = Bun.spawnSync([binary, ...args], {
    cwd, env: env as Record<string, string>, stdin: Buffer.from(stdin), stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  return { code: r.exitCode ?? -1, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function git(cwd: string, args: string[]): void {
  const r = Bun.spawnSync(["git", ...args], { cwd, env: baseEnv, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")} -> ${r.exitCode}\n${r.stderr.toString()}`);
}

function repo(name: string): string {
  const root = join(area, name);
  mkdirSync(root, { recursive: true });
  git(root, ["init", "-q"]);
  return root;
}

function preset(root: string): { scope?: { include?: string[]; exclude?: string[] }; enforcement?: string } {
  return JSON.parse(readFileSync(join(root, ".pregate/preset.json"), "utf8"));
}

function excludes(root: string): string[] {
  return preset(root).scope?.exclude ?? [];
}

function findings(root: string, env = baseEnv): { path: string }[] {
  const out = run(root, ["audit", "--json"], env);
  if (out.stdout.trim() === "") throw new Error(`audit produced no JSON\n${out.stderr}`);
  return JSON.parse(out.stdout).findings as { path: string }[];
}

function paths(rows: { path: string }[]): string[] {
  return [...new Set(rows.map((row) => row.path))].sort();
}

function enforce(root: string, denyParams = false): void {
  const body = preset(root) as { enforcement?: string; overrides?: Record<string, unknown> };
  body.enforcement = "enforce";
  if (denyParams) body.overrides = { ...body.overrides, "CC-FN-002": { severity: "deny", params: { max: 5 } } };
  writeFileSync(join(root, ".pregate/preset.json"), JSON.stringify(body, null, 2) + "\n");
  const compiled = run(root, ["preset", "compile", "--yes"], { ...baseEnv, PREGATE_UNATTENDED_APPROVAL: "1" });
  if (compiled.code !== 0) throw new Error(compiled.stdout + compiled.stderr);
}

beforeAll(() => {
  mkdirSync(home, { recursive: true });
  engineAt(binary);
});

test("enable proposes false-positive folders and only approval writes them", () => {
  const root = repo("js");
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "dist"), { recursive: true });
  mkdirSync(join(root, "vendor"), { recursive: true });
  mkdirSync(join(root, "assets"), { recursive: true });
  mkdirSync(join(root, "scratch"), { recursive: true });
  writeFileSync(join(root, "src/app.js"), JS);
  writeFileSync(join(root, "dist/app.js"), `/* @generated */\n${JS}`);
  writeFileSync(join(root, "vendor/lib.js"), JS);
  writeFileSync(join(root, "assets/app.min.js"), JS);
  writeFileSync(join(root, "scratch/out.js"), JS);
  writeFileSync(join(root, ".gitignore"), "scratch/\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "source"]);
  const init = run(root, ["init", "--preset", "legacy-safe", "--yes"], { ...baseEnv, PREGATE_UNATTENDED_APPROVAL: "1" });
  expect(init.code, init.stdout + init.stderr).toBe(0);
  enforce(root, true);
  const before = excludes(root);
  const refused = run(root, ["enable", "--yes"], { ...baseEnv, CI: "1", PREGATE_UNATTENDED_APPROVAL: undefined });
  expect(refused.code).toBe(1);
  expect(refused.stdout).toContain("dist/**");
  expect(refused.stdout).toContain("generated output");
  expect(refused.stdout).toContain("@generated header");
  expect(refused.stdout).toContain("vendor/**");
  expect(refused.stdout).toContain("vendored code");
  expect(refused.stdout).toContain("assets/**");
  expect(refused.stdout).toContain("minified bundle");
  expect(refused.stdout).toContain("scratch/**");
  expect(refused.stdout).toContain("listed in .gitignore");
  expect(refused.stdout).toContain("pregate approve");
  expect(excludes(root)).toEqual(before);
  const accepted = run(root, ["enable", "--yes"], { ...baseEnv, PREGATE_UNATTENDED_APPROVAL: "1" });
  expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
  for (const glob of ["dist/**", "vendor/**", "assets/**", "scratch/**"]) expect(excludes(root)).toContain(glob);
  const found = paths(findings(root));
  expect(found.some((path) => path.startsWith("src/"))).toBe(true);
  expect(found.some((path) => path.startsWith("dist/") || path.startsWith("vendor/") || path.startsWith("assets/") || path.startsWith("scratch/"))).toBe(false);
  const check = run(root, ["check", "--all"]);
  expect(check.stdout).toContain("src/app.js");
  expect(check.stdout).not.toContain("dist/");
  expect(check.stdout).not.toContain("vendor/");
  expect(check.stdout).not.toContain("assets/");
  expect(check.stdout).not.toContain("scratch/");
  const write = (file: string, content: string) => JSON.stringify({
    hook_event_name: "preToolUse", session_id: "exclude-scope", generation_id: "exclude-scope",
    tool_use_id: `tool_${file.replace(/\W/g, "_")}`, tool_name: "Write", cursor_version: VERIFIED,
    workspace_roots: [root], user_email: "e2e@example.com",
    tool_input: { file_path: join(root, file), content },
  });
  const wider = "function bad(a, b, c, d, e, f, g) { return a; }\n";
  const sourceEdit = run(root, ["hook", "pre", "--harness", "cursor"], baseEnv, write("src/app.js", wider));
  const generatedEdit = run(root, ["hook", "pre", "--harness", "cursor"], baseEnv, write("dist/app.js", `/* @generated */\n${wider}`));
  expect(sourceEdit.stdout + sourceEdit.stderr).toContain("CC-FN-002");
  expect(sourceEdit.stdout + sourceEdit.stderr).toContain("src/app.js");
  expect(generatedEdit.stdout + generatedEdit.stderr).not.toContain("CC-FN-002");
  mkdirSync(join(root, "codegen"));
  writeFileSync(join(root, "codegen/out.js"), `// @generated\n${JS}`);
  const audit = run(root, ["audit"]);
  expect(audit.stdout).toContain("codegen/**");
  expect(audit.stdout).toContain("generated output");
  expect(audit.stdout).toContain("Accept with: pregate enable");
  expect(audit.stdout).toContain("not applied");
  expect(excludes(root)).not.toContain("codegen/**");
  const again = run(root, ["enable", "--yes"], { ...baseEnv, PREGATE_UNATTENDED_APPROVAL: "1" });
  expect(again.code, again.stdout + again.stderr).toBe(0);
  expect(excludes(root)).toContain("codegen/**");
  expect(paths(findings(root)).some((path) => path.startsWith("codegen/"))).toBe(false);
});

test("a Go repository proposes testdata and generated protobuf files", () => {
  const root = repo("go");
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "testdata"), { recursive: true });
  mkdirSync(join(root, "pb"), { recursive: true });
  writeFileSync(join(root, "go.mod"), "module example.com/app\n\ngo 1.22\n");
  writeFileSync(join(root, "src/bad.go"), GO);
  writeFileSync(join(root, "testdata/sample.go"), GO);
  writeFileSync(join(root, "pb/msg.pb.go"), `// Code generated by protoc-gen-go. DO NOT EDIT.\n\n${GO}`);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "go"]);
  const init = run(root, ["init", "--preset", "go-starter", "--yes"], { ...baseEnv, PREGATE_UNATTENDED_APPROVAL: "1" });
  expect(init.code, init.stdout + init.stderr).toBe(0);
  enforce(root);
  const open = paths(findings(root));
  expect(open.some((path) => path.startsWith("src/"))).toBe(true);
  expect(open.some((path) => path.startsWith("testdata/"))).toBe(true);
  expect(open.some((path) => path.startsWith("pb/"))).toBe(true);
  const accepted = run(root, ["enable", "--yes"], { ...baseEnv, PREGATE_UNATTENDED_APPROVAL: "1" });
  expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
  expect(accepted.stdout).toContain("testdata/**");
  expect(accepted.stdout).toContain("test fixtures and snapshots");
  expect(accepted.stdout).toContain("pb/**");
  expect(excludes(root)).toContain("testdata/**");
  expect(excludes(root)).toContain("pb/**");
  const found = paths(findings(root));
  expect(found.some((path) => path.startsWith("src/"))).toBe(true);
  expect(found.some((path) => path.startsWith("testdata/") || path.startsWith("pb/"))).toBe(false);
  const check = run(root, ["check", "--all"]);
  expect(check.stdout).toContain("src/bad.go");
  expect(check.stdout).not.toContain("testdata/");
  expect(check.stdout).not.toContain("pb/");
});

test("a git submodule is proposed and then left out of analysis", () => {
  const lib = repo("lib");
  mkdirSync(join(lib, "src"), { recursive: true });
  writeFileSync(join(lib, "src/lib.js"), JS);
  git(lib, ["add", "."]);
  git(lib, ["commit", "-qm", "lib"]);
  const root = repo("parent");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/app.js"), JS);
  git(root, ["add", "."]);
  git(root, ["commit", "-qm", "app"]);
  git(root, ["-c", "protocol.file.allow=always", "submodule", "add", lib, "libs/dep"]);
  git(root, ["commit", "-qm", "submodule"]);
  const init = run(root, ["init", "--preset", "legacy-safe", "--yes"], { ...baseEnv, PREGATE_UNATTENDED_APPROVAL: "1" });
  expect(init.code, init.stdout + init.stderr).toBe(0);
  enforce(root);
  const accepted = run(root, ["enable", "--yes"], { ...baseEnv, PREGATE_UNATTENDED_APPROVAL: "1" });
  expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
  expect(accepted.stdout).toContain("libs/dep/**");
  expect(accepted.stdout).toContain("git submodule");
  expect(excludes(root)).toContain("libs/dep/**");
  const found = paths(findings(root));
  expect(found.some((path) => path.startsWith("src/"))).toBe(true);
  expect(found.some((path) => path.startsWith("libs/"))).toBe(false);
});
