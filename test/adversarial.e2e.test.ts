import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { enable } from "../src/consent.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { hookCommand } from "../src/register.ts";
import { policyFixture } from "./policy-fixtures.ts";

// The compiled pregate binary, against disposable git repositories. These cases are the
// soundness claims in docs/guarantees.md: what no-new actually compares, and where a
// trust boundary is closed, best-effort, or out of scope.

setDefaultTimeout(120_000);

const DEMO = join(import.meta.dir, "demo-repo");
const PRESET = join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json");
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-adversarial-")));
const BIN = join(TMP, "bin/pregate");
const HOME = join(TMP, "home");
const DATA = join(TMP, "data");
const ENGINE_DATA = join(DATA, "pregate");

type Env = Record<string, string>;
interface Out { code: number; stdout: string; stderr: string }
interface Repo { dir: string; env: Env }

beforeAll(() => {
  mkdirSync(HOME, { recursive: true });
  mkdirSync(join(TMP, "tmp"), { recursive: true });
  compileBinary(hostTarget(), BIN, true);
  ok(run([BIN, "setup"], HOME, envOf()), "setup");
  template = buildTemplate();
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

let template = "";
let states = 0;

function envOf(): Env {
  return {
    CI: "1", PATH: `${HOME}/.local/bin:/usr/bin:/bin`, HOME, TMPDIR: join(TMP, "tmp"),
    XDG_DATA_HOME: DATA, XDG_STATE_HOME: join(TMP, "state", String(++states)),
    GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  };
}

function run(cmd: string[], cwd: string, env: Env, stdin = ""): Out {
  const r = Bun.spawnSync(cmd, { cwd, env, stdin: new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode ?? -1, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function ok(o: Out, what: string): Out {
  if (o.code !== 0) throw new Error(`${what} exited ${o.code}\n${o.stdout}\n${o.stderr}`);
  return o;
}

function buildTemplate(): string {
  const dir = join(TMP, "template");
  const env = envOf();
  cpSync(DEMO, dir, { recursive: true });
  const git = (...args: string[]) => ok(run(["git", ...args], dir, env), args.join(" "));
  git("init", "-q");
  git("config", "maintenance.auto", "false");
  git("config", "gc.auto", "0");
  git("add", "-A");
  git("commit", "-q", "-m", "demo");
  mkdirSync(join(dir, ".pregate"), { recursive: true });
  writeFileSync(join(dir, ".pregate/preset.json"), policyFixture(readFileSync(PRESET, "utf8")));
  ok(run([BIN, "preset", "compile"], dir, env), "preset compile");
  git("add", "-A");
  git("commit", "-q", "-m", "pregate");
  return dir;
}

function fresh(): Repo {
  const dir = join(TMP, "repos", randomUUID());
  cpSync(template, dir, { recursive: true });
  enable(dir, ENGINE_DATA);
  return { dir, env: envOf() };
}

const git = (r: Repo, ...args: string[]): Out => run(["git", ...args], r.dir, r.env);
function commit(r: Repo, message: string): void {
  ok(git(r, "add", "-A"), "git add");
  ok(git(r, "commit", "-q", "-m", message), "git commit");
}
function put(r: Repo, rel: string, text: string): void {
  mkdirSync(dirname(join(r.dir, rel)), { recursive: true });
  writeFileSync(join(r.dir, rel), text);
}
const cli = (r: Repo, ...args: string[]): Out => run(["pregate", ...args], r.dir, r.env);
const said = (o: Out): string => o.stdout + o.stderr;

function ratchet(r: Repo): Out {
  return cli(r, "check", "--ratchet", "--base", "HEAD");
}

function allows(r: Repo): void {
  const out = ratchet(r);
  expect({ code: out.code, text: said(out) }).toEqual({ code: 0, text: expect.stringContaining("no introduced violations") });
}

function blocks(r: Repo, needle: string): void {
  const out = ratchet(r);
  expect(out.code, said(out)).toBe(1);
  expect(said(out)).toContain(needle);
}

const swallowed = (name: string, clause = "catch {}"): string =>
  `export function ${name}(): string {\n  try {\n    return "a";\n  } ${clause}\n  return "b";\n}\n`;
const cast = (expr: string): string => `export function read(value: unknown): string {\n  return ${expr};\n}\n`;

function long(name: string): string {
  const lines = Array.from({ length: 45 }, (_, i) => `  total += ${i};`).join("\n");
  return `export function ${name}(): number {\n  let total = 0;\n${lines}\n  return total;\n}\n`;
}

let calls = 0;
function claudePayload(dir: string, sid: string, fields: object): string {
  return JSON.stringify({
    session_id: sid, transcript_path: join(HOME, "t.jsonl"), cwd: dir, permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse", ...fields,
  });
}
function claude(r: Repo, sid: string = randomUUID()) {
  const hook = (sub: "pre" | "session-start", payload: string) =>
    run(["sh", "-c", hookCommand(ENGINE_DATA, sub, "claude-code")], r.dir, r.env, payload);
  const pre = (fields: object) => hook("pre", claudePayload(r.dir, sid, fields));
  return {
    start: () => hook("session-start", JSON.stringify({
      session_id: sid, transcript_path: join(HOME, "t.jsonl"), cwd: r.dir, hook_event_name: "SessionStart", source: "startup",
    })),
    write: (rel: string, content: string) => pre({ tool_name: "Write", tool_use_id: `toolu_${++calls}`, tool_input: { file_path: join(r.dir, rel), content } }),
    edit: (rel: string, oldString: string, newString: string, replaceAll = false) => pre({
      tool_name: "Edit", tool_use_id: `toolu_${++calls}`,
      tool_input: { file_path: join(r.dir, rel), old_string: oldString, new_string: newString, ...(replaceAll ? { replace_all: true } : {}) },
    }),
    bash: (command: string) => pre({ tool_name: "Bash", tool_use_id: `toolu_${++calls}`, tool_input: { command } }),
  };
}

function denied(o: Out, needle: string): void {
  expect(o.code, said(o)).toBe(2);
  expect(said(o)).toContain(needle);
}

function silent(o: Out): void {
  expect({ code: o.code, stdout: o.stdout, stderr: o.stderr }).toEqual({ code: 0, stdout: "", stderr: "" });
}

// ── no-new ───────────────────────────────────────────────────────────────────────────────

test("a violation moved inside the same symbol is not new debt", () => {
  const r = fresh();
  const rel = "src/domain/pay.ts";
  put(r, rel, swallowed("pay"));
  commit(r, "one swallow");
  put(r, rel, `export function pay(): string {\n  const label = "pay";\n  try {\n    return label;\n  } catch {}\n  return "b";\n}\n`);
  allows(r);
  put(r, rel, `export function pay(): string {\n  try {\n    return "a";\n  } catch {}\n  try {\n    return "c";\n  } catch {}\n  return "b";\n}\n`);
  blocks(r, "clean-code/CC-ER-002");
});

test("removing one violation and adding another is net zero only for the same rule", () => {
  const r = fresh();
  const rel = "src/domain/pay.ts";
  put(r, rel, swallowed("pay"));
  commit(r, "one swallow");
  put(r, rel, swallowed("pay", "catch (error) {\n    void error;\n  }"));
  allows(r);
  put(r, rel, `export function pay(value: unknown): string {\n  return value as unknown as string;\n}\n`);
  blocks(r, "typescript/EVA-CAST-001");
});

test("equivalent assertion syntax stays the same debt and is caught when it is new", () => {
  const r = fresh();
  const rel = "src/domain/read.ts";
  put(r, rel, cast("value as unknown as string"));
  commit(r, "double assertion");
  put(r, rel, cast("(value as unknown) as string"));
  allows(r);
  put(r, rel, cast("value as any as string"));
  allows(r);
  put(r, rel, cast("value as string"));
  allows(r);
  put(r, "src/domain/fresh.ts", cast("(value as unknown) as string"));
  blocks(r, "typescript/EVA-CAST-001");
});

test("renamed metric debt follows the body; a copy or an extracted pattern does not", () => {
  const r = fresh();
  const rel = "src/domain/total.ts";
  put(r, rel, long("legacy"));
  commit(r, "long function");
  put(r, rel, long("renamed"));
  allows(r);
  put(r, rel, `${long("legacy")}\n${long("legacyCopy")}`);
  blocks(r, "clean-code/CC-FN-001");
  put(r, rel, long("extracted"));
  allows(r);
  const pattern = "src/domain/pay.ts";
  put(r, pattern, swallowed("legacy"));
  commit(r, "swallowed legacy");
  put(r, pattern, swallowed("renamed"));
  blocks(r, "clean-code/CC-ER-002");
  put(r, pattern, `export function legacy(): string {\n  return taken();\n}\n${swallowed("taken")}`);
  blocks(r, "clean-code/CC-ER-002");
});

function reset(r: Repo): void {
  ok(git(r, "checkout", "-q", "--", "."), "checkout");
  ok(git(r, "clean", "-qfd"), "clean");
}

test("a barrel or a path alias cannot hide a forbidden import", () => {
  const r = fresh();
  const clock = "export const clock = 1;\n";
  put(r, "src/infra/clock.ts", clock);
  put(r, "src/domain/barrel.ts", 'export { clock } from "../infra/clock";\n');
  put(r, "src/domain/use.ts", 'import { clock } from "./barrel";\nexport const used = clock;\n');
  blocks(r, "architecture/CA-DEP-001");
  reset(r);
  put(r, "src/infra/clock.ts", clock);
  put(r, "tsconfig.json", `${JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@app/*": ["src/*"] } } })}\n`);
  put(r, "src/domain/alias.ts", 'import { clock } from "@app/infra/clock";\nexport const used = clock;\n');
  blocks(r, "architecture/CA-DEP-001");
  reset(r);
  put(r, "tsconfig.json", `${JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { pg: ["src/domain/fake-pg.ts"] } } })}\n`);
  put(r, "src/domain/fake-pg.ts", "export const query = 1;\n");
  put(r, "src/domain/db.ts", 'import { query } from "pg";\nexport const used = query;\n');
  blocks(r, "architecture/CA-DEP-002");
  reset(r);
  put(r, "src/infra/clock.ts", clock);
  put(r, "src/domain/b1.ts", 'export { clock } from "./b2";\n');
  put(r, "src/domain/b2.ts", 'export { clock } from "./b3";\n');
  put(r, "src/domain/b3.ts", 'export { clock } from "./b4";\n');
  put(r, "src/domain/b4.ts", 'export { clock } from "../infra/clock";\n');
  put(r, "src/domain/deep.ts", 'import { clock } from "./b1";\nexport const used = clock;\n');
  const deep = ratchet(r);
  expect(deep.code, said(deep)).toBe(1);
  expect(said(deep)).toMatch(/architecture\/CA-DEP-001|unresolvable-import/);
});

// ── Trust boundaries ─────────────────────────────────────────────────────────────────────

test("a lock that does not match its preset is rejected, and the hook cannot rewrite the contract", () => {
  const r = fresh();
  const lock = join(r.dir, ".pregate/pregate.lock.json");
  const original = readFileSync(lock, "utf8");
  const tampered = JSON.parse(original) as { rules: { id: string }[] };
  tampered.rules = tampered.rules.filter((rule) => rule.id !== "clean-code/CC-ER-002");
  writeFileSync(lock, JSON.stringify(tampered));
  blocks(r, "does not match the preset and its sources");
  const a = claude(r);
  ok(a.start(), "session");
  denied(a.write("src/domain/note.ts", "export const note = 1;\n"), "lock-stale");
  denied(a.write(".pregate/preset.json", original), "invalid contract change");
  denied(a.write(".pregate/extra.json", "{}\n"), "protected-path");
  denied(a.bash("git commit --no-verify -m tamper"), "shell-admin");
  writeFileSync(lock, original);
  allows(r);
});

test("a symlink that leaves the repository cannot take a judged write", () => {
  const r = fresh();
  const outside = join(TMP, "outside", randomUUID());
  mkdirSync(outside, { recursive: true });
  const target = join(outside, "pay.ts");
  const violation = swallowed("pay");
  writeFileSync(target, violation);
  symlinkSync(target, join(r.dir, "src/domain/escaped.ts"));
  blocks(r, "clean-code/CC-ER-002");
  const a = claude(r);
  ok(a.start(), "session");
  denied(a.write("src/domain/escaped.ts", "export const after = 1;\n"), "protected-path");
  denied(a.bash(`printf '%s' 'export const after = 1;' > '${join(r.dir, "src/domain/escaped.ts")}'`), "shell-write");
  expect(readFileSync(target, "utf8")).toBe(violation);
});

test("a symlink that stays inside the repository is still judged", () => {
  const r = fresh();
  put(r, "src/domain/real.ts", "export const value = 1;\n");
  symlinkSync("real.ts", join(r.dir, "src/domain/link.ts"));
  commit(r, "in-repo link");
  const a = claude(r);
  ok(a.start(), "session");
  denied(a.write("src/domain/link.ts", swallowed("pay")), "clean-code/CC-ER-002");
});

test.skip("known gap: check --ratchet does not see an out-of-band edit of an external symlink target", () => {
  // Git compares the link text. A committed symlink whose text does not change is not a diff,
  // so a write that lands on the external target without going through the in-repo path is invisible.
  // Hook writes through the spelled path are denied; this skip is only the out-of-band target.
  const r = fresh();
  const outside = join(TMP, "outside", randomUUID());
  mkdirSync(outside, { recursive: true });
  const target = join(outside, "pay.ts");
  writeFileSync(target, "export const before = 1;\n");
  symlinkSync(target, join(r.dir, "src/domain/escaped.ts"));
  commit(r, "link");
  writeFileSync(target, swallowed("pay"));
  blocks(r, "clean-code/CC-ER-002");
});

test.skip("known gap: check does not walk a directory symlink that leaves the repository", () => {
  // workspacePaths uses directory entries that are not symlinks, and git lists the link rather than
  // the files behind it. Violations that exist only through that directory are not part of the diff.
  const r = fresh();
  const outside = join(TMP, "outside", randomUUID());
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, "pay.ts"), swallowed("pay"));
  symlinkSync(outside, join(r.dir, "src/domain/hidden"), "dir");
  blocks(r, "clean-code/CC-ER-002");
});

test("a linked worktree inherits consent and a clone does not", () => {
  const r = fresh();
  const agent = join(TMP, "worktrees", randomUUID());
  ok(git(r, "worktree", "add", "-q", "-b", `agent-${randomUUID()}`, agent), "worktree add");
  const work = { dir: agent, env: r.env };
  const bad = swallowed("pay");
  const hook = claude(work);
  ok(hook.start(), "worktree session");
  denied(hook.write("src/domain/pay.ts", bad), "clean-code/CC-ER-002");
  const cloneDir = join(TMP, "clones", randomUUID());
  ok(run(["git", "clone", "-q", r.dir, cloneDir], TMP, r.env), "clone");
  const clone = { dir: cloneDir, env: envOf() };
  silent(claude(clone).write("src/domain/pay.ts", bad));
  ok(cli(work, "disable", "--yes"), "disable worktree");
  silent(hook.write("src/domain/later.ts", bad));
  denied(claude(r).write("src/domain/main.ts", bad), "clean-code/CC-ER-002");
  const other = join(TMP, "worktrees", randomUUID());
  ok(git(r, "worktree", "add", "-q", "-b", `other-${randomUUID()}`, other), "second worktree");
  silent(claude({ dir: other, env: r.env }).write("src/domain/other.ts", bad));
});

test("a partial or non-matching edit is denied instead of guessed", () => {
  const r = fresh();
  const rel = "src/domain/note.ts";
  put(r, rel, "export const left = 1;\nexport const right = 1;\n");
  commit(r, "note");
  const a = claude(r);
  ok(a.start(), "session");
  denied(a.edit(rel, "missing", "export const left = 2;\n"), "tool-will-fail");
  denied(a.edit(rel, "export const ", "export const kept"), "tool-will-fail");
  const file = join(r.dir, rel);
  const patch = (body: string) => [
    "*** Begin Patch", `*** Update File: ${file}`, "@@", body, "*** End Patch", "",
  ].join("\n");
  const codex = (command: string) => run(
    ["sh", "-c", hookCommand(ENGINE_DATA, "pre", "codex")], r.dir, r.env,
    JSON.stringify({
      session_id: randomUUID(), turn_id: randomUUID(), transcript_path: join(HOME, "codex.jsonl"),
      cwd: r.dir, hook_event_name: "PreToolUse", model: "gpt-6.1-sol", permission_mode: "bypassPermissions",
      tool_name: "apply_patch", tool_use_id: randomUUID(), tool_input: { command },
    }),
  );
  denied(codex(patch("-not the line\n+export const left = 2;")), "cannot-reconstruct");
  denied(codex(patch("+export const extra = 1;")), "cannot-reconstruct");
  silent(a.edit(rel, "export const left = 1;\n", "export const left = 2;\n"));
});

test("a hook that dies after a checkpoint cannot publish an allow", () => {
  const r = fresh();
  const a = claude(r, "../escape");
  const crashed = a.write("src/domain/note.ts", "export const note = 1;\n");
  expect(crashed.code, said(crashed)).toBe(2);
  expect(crashed.stdout).toBe("");
  expect(crashed.stderr).toContain("the engine failed (exit 1)");
  const stub = join(ENGINE_DATA, "9.9.9");
  mkdirSync(stub, { recursive: true });
  copyFileSync(process.execPath, join(stub, ENGINE_FILE));
  chmodSync(join(stub, ENGINE_FILE), 0o755);
  const script = `process.stderr.write("PREGATE-CHECKPOINT rules\\n"); process.stdout.write(${JSON.stringify(JSON.stringify({ hookSpecificOutput: { permissionDecision: "allow" } }) + "\n")}); process.exit(1);`;
  const payload = claudePayload(r.dir, randomUUID(), {
    tool_name: "Write", tool_use_id: "toolu_midway", tool_input: { file_path: join(r.dir, "src/domain/note.ts"), content: "export const note = 1;\n" },
  });
  const midway = run([BIN, "--supervise", ENGINE_DATA, "9.9.9", "-e", script], r.dir, r.env, payload);
  expect(midway.code, said(midway)).toBe(2);
  expect(midway.stderr).toContain("the engine failed (exit 1)");
  expect(midway.stderr).toContain("last engine checkpoint: rules");
  expect(midway.stdout).toContain("deny");
  expect(midway.stdout).not.toContain('permissionDecision":"allow');
  const empty = join(TMP, "inert");
  mkdirSync(empty, { recursive: true });
  const inert = run([BIN, "--supervise", ENGINE_DATA, "9.9.9", "-e", script], empty, r.env, claudePayload(empty, randomUUID(), {
    tool_name: "Write", tool_use_id: "toolu_inert", tool_input: { file_path: join(empty, "note.ts"), content: "export const note = 1;\n" },
  }));
  expect({ code: inert.code, stdout: inert.stdout, stderr: inert.stderr }).toEqual({ code: 0, stdout: "", stderr: "" });
});
