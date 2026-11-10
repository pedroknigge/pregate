import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { enable } from "../src/consent.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { hookCommand } from "../src/register.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

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
  // An empty Claude home wires one harness. Host CLIs stay off PATH, so setup's exit
  // does not depend on which agents this machine has installed.
  mkdirSync(join(HOME, ".claude"), { recursive: true });
  mkdirSync(join(TMP, "tmp"), { recursive: true });
  compileBinary(hostTarget(), BIN, true);
  ok(run([BIN, "setup"], HOME, envOf()), "setup");
  template = buildTemplate();
});

afterAll(() => removeTree(TMP));

let template = "";
let states = 0;

function envOf(): Env {
  return {
    CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PATH: pathWithoutHarnesses([join(HOME, ".local/bin"), join(DATA, "pregate", "bin")]), HOME, TMPDIR: join(TMP, "tmp"),
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
  // The suite exercises the ratchet, not the default severities: the rules it counts must deny.
  const preset = JSON.parse(policyFixture(readFileSync(PRESET, "utf8"))) as { overrides?: Record<string, unknown> };
  for (const rule of ["clean-code/CC-ER-002", "clean-code/CC-FN-001", "clean-code/CC-FN-002", "typescript/EVA-CAST-001"]) {
    preset.overrides = { ...preset.overrides, [rule]: "deny" };
  }
  writeFileSync(join(dir, ".pregate/preset.json"), JSON.stringify(preset));
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

test("an unchanged body can be renamed, moved or extracted, and a copy cannot", () => {
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
  allows(r);
  put(r, pattern, `export function legacy(): string {\n  return taken();\n}\n${swallowed("taken")}`);
  allows(r);
  put(r, pattern, `${swallowed("legacy")}\n${swallowed("legacyCopy")}`);
  blocks(r, "clean-code/CC-ER-002");
});

test("a copy cannot borrow debt from an original that changed and still carries it", () => {
  const r = fresh();
  const rel = "src/domain/pay.ts";
  put(r, rel, swallowed("legacy"));
  commit(r, "swallowed legacy");
  const touched = `export function legacy(): string {\n  const label = "legacy";\n  try {\n    return label;\n  } catch {}\n  return "b";\n}\n`;
  put(r, rel, touched);
  allows(r);
  // The original keeps its swallow under a new body; the copy of the old body is new debt.
  put(r, rel, `${touched}\n${swallowed("legacyCopy")}`);
  blocks(r, "clean-code/CC-ER-002");
  // The original lost its swallow: the one it had may follow the old body, once.
  put(r, rel, `export function legacy(): string {\n  return "a";\n}\n${swallowed("legacyCopy")}`);
  allows(r);
  put(r, rel, `export function legacy(): string {\n  return "a";\n}\n${swallowed("legacyCopy")}\n${swallowed("legacyTwin")}`);
  blocks(r, "clean-code/CC-ER-002");
  const metric = "src/domain/total.ts";
  put(r, metric, long("legacy"));
  commit(r, "long legacy");
  // Same length, different body: the original keeps its own baseline and the copy gets none.
  const touchedLong = long("legacy").replace("  total += 0;\n", "  total += 7;\n");
  put(r, metric, touchedLong);
  allows(r);
  put(r, metric, `${touchedLong}\n${long("legacyCopy")}`);
  blocks(r, "clean-code/CC-FN-001");
});

// sindresorhus/got `parseBody`: an arrow with four parameters, a try that is not the whole
// function, and a branch nested three deep. Renaming only the binding used to report those
// pre-existing findings as new because the symbol name changed.
const RESPONSE_TYPES = `type Response = { rawBody: string };\ntype ResponseType = "text" | "json" | "buffer";\n`;
const PARSE_ARROW = `(response: Response, responseType: ResponseType, parseJson: (text: string) => unknown, encoding?: string): unknown => {
  const { rawBody } = response;
  try {
    if (responseType === "text") return rawBody;
    if (responseType === "json") {
      if (rawBody.length === 0) return "";
      return parseJson(rawBody);
    }
    if (responseType === "buffer") return rawBody;
    return rawBody;
  } catch (error) {
    throw new Error(String(error));
  }
}`;
const parseBodyFile = (name: string): string => `${RESPONSE_TYPES}export const ${name} = ${PARSE_ARROW};\n`;

test("renaming parseBody to parseBody2 does not resurface the findings already in its body", () => {
  const r = fresh();
  const rel = "src/domain/response.ts";
  put(r, rel, parseBodyFile("parseBody"));
  commit(r, "parseBody");
  const before = ratchet(r);
  expect(before.code, said(before)).toBe(0);
  put(r, rel, parseBodyFile("parseBody2"));
  allows(r);
  put(r, rel, `${RESPONSE_TYPES}export const api = {\n  parseBody: ${PARSE_ARROW},\n};\n`);
  allows(r);
  put(r, rel, `${RESPONSE_TYPES}export const parseBody = ${PARSE_ARROW};\nexport const parseBody2 = ${PARSE_ARROW};\n`);
  blocks(r, "clean-code/CC-FN-002");
  put(r, rel, parseBodyFile("parseBody2").replace("throw new Error(String(error));", "void error;"));
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

test("promote moves dirty CA-DEP-001 to enforce; the ratchet keeps the old finding and denies a new one", () => {
  const r = fresh();
  const presetPath = join(r.dir, ".pregate/preset.json");
  const preset = JSON.parse(readFileSync(presetPath, "utf8")) as { enforcement?: string };
  preset.enforcement = "advisor";
  writeFileSync(presetPath, JSON.stringify(preset));
  ok(cli(r, "preset", "compile", "--yes"), "compile advisor");
  put(r, "src/infra/clock.ts", "export const clock = 1;\n");
  put(r, "src/application/dirty.ts", 'import { clock } from "../infra/clock";\nexport const used = clock;\n');
  commit(r, "existing layer debt");

  const audited = cli(r, "audit", "--json");
  expect(audited.code, said(audited)).toBe(0);
  const report = JSON.parse(audited.stdout) as {
    enforceCandidates: string[]; ratchetCandidates: string[];
    summary: { rules: { rule: string; count: number; files: number; check: string }[] };
  };
  const debt = report.summary.rules.find((rule) => rule.rule === "architecture/CA-DEP-001");
  expect(debt).toEqual({ rule: "architecture/CA-DEP-001", count: 1, files: 1, check: expect.any(String) });
  expect(report.enforceCandidates).not.toContain("architecture/CA-DEP-001");
  expect(report.ratchetCandidates).toContain("architecture/CA-DEP-001");
  expect(report.enforceCandidates).toContain("clean-code/CC-ER-002");
  const cleanPreview = cli(r, "promote", "--rule", "CC-ER-002", "--preview");
  expect(cleanPreview.code, said(cleanPreview)).toBe(0);
  expect(said(cleanPreview)).toContain("clean-code/CC-ER-002 (");
  expect(said(cleanPreview)).not.toContain("grandfathered");

  const preview = cli(r, "promote", "--rule", "CA-DEP-001", "--preview");
  expect(preview.code, said(preview)).toBe(0);
  expect(said(preview)).toContain("Would promote to enforce (1, pending approval): architecture/CA-DEP-001 (1 existing finding in 1 file grandfathered by the no-new ratchet; new findings are denied).");
  const applied = cli(r, "promote", "--rule", "CA-DEP-001", "--yes");
  expect(applied.code, said(applied)).toBe(0);
  const lock = JSON.parse(readFileSync(join(r.dir, ".pregate/pregate.lock.json"), "utf8")) as { rules: { id: string; enforcement?: string }[] };
  expect(lock.rules.find((rule) => rule.id === "architecture/CA-DEP-001")?.enforcement).toBe("enforce");

  allows(r);
  put(r, "src/application/dirty.ts", 'import { clock } from "../infra/clock";\n// kept\nexport const used = clock;\n');
  allows(r);
  put(r, "src/application/newer.ts", 'import { clock } from "../infra/clock";\nexport const again = clock;\n');
  const denied = ratchet(r);
  expect(denied.code, said(denied)).toBe(1);
  expect(said(denied)).toContain("architecture/CA-DEP-001");
  expect(said(denied)).toContain("src/application/newer.ts");
  expect(said(denied)).not.toContain("src/application/dirty.ts");
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

test("a symlink into a nested root is judged by the root that holds its target", () => {
  const r = fresh();
  const nested = join(r.dir, "packages/app");
  cpSync(template, nested, { recursive: true });
  rmSync(join(nested, ".git"), { recursive: true, force: true });
  enable(nested, ENGINE_DATA);
  put(r, "packages/app/src/domain/real.ts", "export const value = 1;\n");
  symlinkSync("../../packages/app/src/domain/real.ts", join(r.dir, "src/domain/link.ts"));
  commit(r, "nested root");
  const a = claude(r);
  ok(a.start(), "session");
  const out = a.write("src/domain/link.ts", swallowed("pay"));
  denied(out, "clean-code/CC-ER-002");
  expect(said(out)).not.toContain("protected-path");
  // A target outside every root, reached from a path the lock does not judge, stays out of scope.
  const outside = join(TMP, "outside", randomUUID());
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, "notes.md"), "");
  symlinkSync(join(outside, "notes.md"), join(r.dir, "notes.md"));
  silent(a.write("notes.md", "# notes\n"));
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

// Unconditional test.skip is a denied focus. skipIf keeps the limit recorded, and unset
// PREGATE_RUN_KNOWN_GAPS leaves it skipped so the gap is not a passing attack.
test.skipIf(process.env.PREGATE_RUN_KNOWN_GAPS === undefined)("known gap: check --ratchet does not see an out-of-band edit of an external symlink target", () => {
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

test.skipIf(process.env.PREGATE_RUN_KNOWN_GAPS === undefined)("known gap: check does not walk a directory symlink that leaves the repository", () => {
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
  if (process.platform === "win32") expect(crashed.stdout).not.toContain('"permissionDecision":"allow"');
  else expect(crashed.stdout).toBe("");
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

// Unix: mode 000 is EACCES for the hook. Windows file ACLs do not reliably deny the same user's
// compiled engine, so the file is replaced by a directory, which no process can read as JSON.
function seal(path: string): () => void {
  const bytes = readFileSync(path);
  if (process.platform === "win32") {
    rmSync(path);
    mkdirSync(path);
    return () => {
      removeTree(path);
      writeFileSync(path, bytes);
    };
  }
  chmodSync(path, 0o000);
  return () => {
    chmodSync(path, 0o644);
    writeFileSync(path, bytes);
  };
}

test("a non-literal script is denied and a literal script or read-only one-liner is not", () => {
  const r = fresh();
  const bin = join(r.dir, "bin");
  mkdirSync(bin);
  const scriptName = process.platform === "win32" ? "deploy.cmd" : "deploy";
  const script = join(bin, scriptName);
  writeFileSync(script, process.platform === "win32" ? "@echo pregate uninstall\r\n" : "#!/bin/sh\npregate uninstall\n");
  if (process.platform !== "win32") chmodSync(script, 0o755);
  put(r, "ok.sh", "#!/bin/sh\necho hello\n");
  put(r, "run.sh", "#!/bin/sh\npregate uninstall\n");
  r.env.PATH = `${bin}${delimiter}${r.env.PATH}`;
  const a = claude(r);
  ok(a.start(), "session");
  for (const command of ['bash "$SCRIPT"', 'sh "$X"', 'bash < "$S"', 'python3 "$P"', 'node "$P"', 'make -f "$F"', "powershell -File $P"]) {
    const out = a.bash(command);
    denied(out, "shell-write");
    expect(said(out)).toContain("Why:");
    expect(said(out)).toContain("Fix:");
  }
  silent(a.bash('python3 -c "print(1 + 1)"'));
  silent(a.bash('node -e "console.log(1)"'));
  silent(a.bash("bash ./ok.sh"));
  denied(a.bash("bash ./run.sh"), "hook-switch");
  denied(a.bash("deploy"), "hook-switch");
  writeFileSync(script, process.platform === "win32" ? "@echo hello\r\n" : "#!/bin/sh\necho hello\n");
  silent(a.bash("deploy"));
});

test("malformed or unreadable status and lock JSON is denied", () => {
  const r = fresh();
  const a = claude(r);
  ok(a.start(), "session");
  const lock = join(r.dir, ".pregate/pregate.lock.json");
  const preset = join(r.dir, ".pregate/preset.json");
  const lockBytes = readFileSync(lock);
  const presetBytes = readFileSync(preset);
  const note = "src/domain/note.ts";
  const clean = "export const note = 1;\n";
  silent(a.write(note, clean));
  writeFileSync(lock, "{");
  denied(a.write(note, clean), "lock-stale");
  writeFileSync(lock, lockBytes);
  writeFileSync(preset, "{");
  denied(a.write(note, clean), "lock-stale");
  writeFileSync(preset, presetBytes);
  silent(a.write(note, "export const note = 2;\n"));
  for (const path of [lock, preset]) {
    const restore = seal(path);
    try {
      expect(() => readFileSync(path)).toThrow();
      const blocked = a.write(note, "export const note = 3;\n");
      expect(blocked.code, said(blocked)).toBe(2);
      expect(said(blocked)).toMatch(/could not evaluate|lock-stale/);
    } finally {
      restore();
    }
  }
  silent(a.write(note, "export const note = 4;\n"));
});

test("shell Pre denies archive copies, formatters that write, and literal script writers", () => {
  const r = fresh();
  const target = "src/application/shell-guard-probe.ts";
  const good = "export const probe = 1;\n";
  put(r, target, good);
  commit(r, "shell probe");
  const a = claude(r);
  ok(a.start(), "session");
  const attack = join(r.dir, ".attack");
  mkdirSync(attack, { recursive: true });
  const absTarget = join(r.dir, target);
  writeFileSync(join(attack, "writer.js"), `require('fs').writeFileSync('${absTarget}', 'export const probe = 2;\\n');`);
  writeFileSync(join(attack, "writer2.cjs"), `require('fs').writeFileSync('${absTarget}', 'export const probe = 2;\\n');`);
  writeFileSync(join(attack, "w.sh"), `#!/bin/sh\necho 'export const probe = 2;' > '${absTarget}'\n`);
  chmodSync(join(attack, "w.sh"), 0o755);
  writeFileSync(join(attack, "viol.ts"), "export const viol = 1;\n");
  const stage = join(attack, "stage");
  mkdirSync(join(stage, "src/application"), { recursive: true });
  writeFileSync(join(stage, "src/application/viol-from-tar.ts"), "export const viol = 1;\n");
  ok(run(["tar", "-czf", join(attack, "viol.tar.gz"), "-C", stage, "src/application/viol-from-tar.ts"], r.dir, { ...r.env, COPYFILE_DISABLE: "1" }), "tar pack");
  const unchanged = () => expect(readFileSync(absTarget, "utf8")).toBe(good);
  for (const command of [
    `rsync -a ${join(attack, "viol.ts")} src/application/`,
    `tar xzf ${join(attack, "viol.tar.gz")} -C src/application`,
    `node ${join(attack, "writer.js")}`,
    `node ${join(attack, "writer2.cjs")}`,
    `sh ${join(attack, "w.sh")}`,
  ]) {
    denied(a.bash(command), "shell-write");
    unchanged();
  }
  put(r, "src/application/fmt.ts", "const   x=1\n");
  commit(r, "fmt");
  const fmtPath = join(r.dir, "src/application/fmt.ts");
  const fmtBefore = readFileSync(fmtPath, "utf8");
  denied(a.bash("npx --yes prettier --write src/application/fmt.ts"), "shell-write");
  expect(readFileSync(fmtPath, "utf8")).toBe(fmtBefore);
  silent(a.bash(`tar tzf ${join(attack, "viol.tar.gz")}`));
  silent(a.bash("npx --yes prettier --check src/application/fmt.ts"));
  silent(a.bash('node -e "console.log(1)"'));
});
