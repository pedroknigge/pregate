import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { engineAt } from "./compiled-engine.ts";
import { hookCommand } from "../src/register.ts";
import { enable } from "../src/consent.ts";
import type { HarnessId } from "../src/types.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// The global MH-28 installation, driven through the literal hook in HOME/.claude/settings.json
// on git copies of test/demo-repo. All machine and runtime state stays in one temporary folder.

setDefaultTimeout(60_000);

const DEMO = join(import.meta.dir, "demo-repo");
const PRESETS = join(import.meta.dir, "../catalog/presets");
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-e2e-")));
const BIN = join(TMP, "bin/pregate");
const HOME = join(TMP, "home");
const DATA = join(TMP, "data");
const ENGINE = join(DATA, "pregate", pkg.version, "pregate");
const LAUNCHER = join(DATA, "pregate/bin/pregate");
const PRE = ["hook", "pre", "--harness", "claude-code"];

type Preset = "backend-clean-ddd" | "functional-ts";
type Event = "PreToolUse" | "Stop" | "SessionStart" | "SubagentStart";
type Env = Record<string, string>;
interface Out { code: number; stdout: string; stderr: string; ms: number }
interface Repo { dir: string; env: Env }
// What a hook prints on stdout, as far as these tests read it.
interface HookOutput {
  hookSpecificOutput: { permissionDecision?: string; permissionDecisionReason?: string; additionalContext?: string };
  continue?: boolean; stopReason?: string; decision?: string; reason?: string; systemMessage?: string;
}

beforeAll(() => {
  mkdirSync(HOME, { recursive: true });
  mkdirSync(join(TMP, "tmp"), { recursive: true });
  engineAt(BIN, true);
  mkdirSync(join(HOME, ".claude"), { recursive: true });
  ok(run([BIN, "setup"], HOME, envOf()), "setup");
});

afterAll(() => removeTree(TMP));

// ── The code the agent proposes ──────────────────────────────────────────────────────────

const INVOICE_REL = "src/domain/invoice.ts";
const INVOICE = readFileSync(join(DEMO, INVOICE_REL), "utf8");
const before = (anchor: string, text: string): string => {
  if (!INVOICE.includes(anchor)) throw new Error(`demo invoice lost ${anchor}`);
  return INVOICE.replace(anchor, `${text}${anchor}`);
};
// A public method that assigns a field from its parameter: DDD-ENT-001 in ddd-tactical.
const SETTER = before("  billedTo(): string {", "  rename(customer: string): void {\n    this.customer = customer;\n  }\n\n");
const SETTER_FIXED = before("  billedTo(): string {",
  "  withCustomer(customer: string): Invoice {\n    const copy = new Invoice(this.id, customer, this.currency);\n"
  + "    for (const line of this.lines) copy.addLine(line);\n    return copy;\n  }\n\n");
// The clock read inside the core: FCIS-IO-002 in functional-core-imperative-shell.
const CLOCK = before("  isIssued(): boolean {", "  issuedOn(): number {\n    return Date.now();\n  }\n\n");
const CLOCK_FIXED = before("  isIssued(): boolean {", "  issuedOn(today: number): number {\n    return today;\n  }\n\n");
const setters = (n: number): string => before("  billedTo(): string {",
  Array.from({ length: n }, (_, k) => `  rename${k}(customer: string): void {\n    this.customer = customer;\n  }\n\n`).join(""));

const MONEY_TEST = `import { expect, test } from "bun:test";
import { Money } from "../src/domain/values/money";

test("money adds within one currency", () => {
  expect(new Money(1, "USD").add(new Money(2, "USD")).cents).toBe(3);
  expect(Money.zero("USD").cents).toBe(0);
});
`;
const MONEY_TEST_WEAKER = MONEY_TEST.replace('  expect(Money.zero("USD").cents).toBe(0);\n', "");

// ── Processes ────────────────────────────────────────────────────────────────────────────

let states = 0;
function envOf(): Env {
  return {
    CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PATH: `${HOME}/.local/bin:/usr/bin:/bin`, HOME, TMPDIR: join(TMP, "tmp"),
    CODEX_HOME: join(HOME, ".codex"), GROK_HOME: join(HOME, ".grok"),
    XDG_DATA_HOME: DATA, XDG_STATE_HOME: join(TMP, "state", String(++states)),
    GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  };
}

function run(cmd: string[], cwd: string, env: Env, stdin = ""): Out {
  const t = performance.now();
  const r = Bun.spawnSync(cmd, { cwd, env, stdin: new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode ?? -1, stdout: r.stdout.toString(), stderr: r.stderr.toString(), ms: performance.now() - t };
}

async function runAsync(cmd: string[], cwd: string, env: Env, stdin: string): Promise<Out> {
  const t = performance.now();
  const p = Bun.spawn(cmd, { cwd, env, stdin: new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  return { code, stdout, stderr, ms: performance.now() - t };
}

function ok(o: Out, what: string): Out {
  if (o.code !== 0) throw new Error(`${what} exited ${o.code}\n${o.stdout}\n${o.stderr}`);
  return o;
}

const git = (r: Repo, ...args: string[]): Out => run(["git", ...args], r.dir, r.env);
const commit = (r: Repo, message: string, ...flags: string[]): Out => git(r, "commit", "-q", "-m", message, ...flags);
// Git hands a hook's stdout to its own stderr.
const said = (o: Out): string => o.stdout + o.stderr;
// The CLI on PATH, as a human or the pre-commit runs it.
const cli = (r: Repo, ...args: string[]): Out => run(["pregate", ...args], r.dir, r.env);
// Approval codes are omitted unless stdout is a terminal or this test hook is set.
const revealed = (r: Repo, ...args: string[]): Out => run(["pregate", ...args], r.dir, { ...r.env, PREGATE_TESTING: "1" });

// ── Repositories ─────────────────────────────────────────────────────────────────────────

// A git repo with test/demo-repo (plus one test file) at each root, each root's preset compiled, and
// `install` run at the first root. The code is committed before the pre-commit exists, the PREGATE
// files after it. Templates are built once and copied per test.
const templates = new Map<string, string>();
function repo(roots: Record<string, Preset>, gitHook = false): Repo {
  const key = JSON.stringify([roots, gitHook]);
  if (!templates.has(key)) templates.set(key, template(roots, gitHook));
  const dir = join(TMP, "repos", randomUUID());
  copyFixture(templates.get(key)!, dir);
  for (const root of Object.keys(roots)) enable(join(dir, root), join(DATA, "pregate"));
  return { dir, env: envOf() };
}

function copyFixture(source: string, dir: string): void {
  try { cpSync(source, dir, { recursive: true }); }
  catch (e) {
    const error = e as NodeJS.ErrnoException;
    throw new Error(`Repository fixture copy failed: ${JSON.stringify({ source, destination: dir, code: error.code, path: error.path, syscall: error.syscall })}`, { cause: e });
  }
}

function template(roots: Record<string, Preset>, gitHook: boolean): string {
  const r: Repo = { dir: join(TMP, "templates", randomUUID()), env: envOf() };
  for (const root of Object.keys(roots)) {
    cpSync(DEMO, join(r.dir, root), { recursive: true });
    put(r, join(root, "test/money.test.ts"), MONEY_TEST);
  }
  ok(git(r, "init", "-q"), "git init");
  // A cached template must stop changing before another test copies its .git directory.
  ok(git(r, "config", "maintenance.auto", "false"), "disable fixture maintenance");
  ok(git(r, "config", "gc.auto", "0"), "disable fixture auto gc");
  ok(git(r, "add", "-A"), "git add");
  ok(commit(r, "demo"), "git commit");
  for (const [root, preset] of Object.entries(roots)) {
    put(r, join(root, ".pregate/preset.json"), policyFixture(readFileSync(join(PRESETS, `${preset}.json`), "utf8")));
    ok(run([BIN, "preset", "compile"], join(r.dir, root), r.env), "preset compile");
    enable(join(r.dir, root), join(DATA, "pregate"));
  }
  ok(run([BIN, "install", ...(gitHook ? ["--git-hook"] : [])], join(r.dir, Object.keys(roots)[0]!), r.env), "install");
  ok(git(r, "add", "-A"), "git add");
  ok(commit(r, "pregate"), "git commit");
  return r.dir;
}

const at = (r: Repo, rel: string): string => (rel.startsWith("/") ? rel : join(r.dir, rel));
function put(r: Repo, rel: string, text: string): void {
  mkdirSync(dirname(at(r, rel)), { recursive: true });
  writeFileSync(at(r, rel), text);
}
const read = (r: Repo, rel: string): string => readFileSync(at(r, rel), "utf8");

// A preset change, compiled through the launcher and committed through the pre-commit.
function recommit(r: Repo, change: (p: Record<string, unknown>) => void): void {
  editPreset(r, change);
  ok(cli(r, "preset", "compile", "--yes"), "preset compile");
  ok(git(r, "add", "-A"), "git add");
  ok(commit(r, "preset"), "git commit");
}

function editPreset(r: Repo, change: (p: Record<string, unknown>) => void): void {
  const p = JSON.parse(read(r, ".pregate/preset.json")) as Record<string, unknown>;
  change(p);
  put(r, ".pregate/preset.json", JSON.stringify(p, null, 2));
}

// ── Claude Code ──────────────────────────────────────────────────────────────────────────

interface Session { sid: string; project: string; prompt: string | null; agentId: string | null; env: Env }

// Our global hook command for the event, exactly as `setup` wrote it.
function command(s: Session, event: Event): string {
  const settings = JSON.parse(readFileSync(join(s.env.HOME!, ".claude/settings.json"), "utf8")) as {
    hooks: Record<string, { hooks: { command: string }[] }[]>;
  };
  const ours = settings.hooks[event]!.flatMap((g) => g.hooks).find((h) => h.command.includes(LAUNCHER));
  if (ours === undefined) throw new Error(`no PREGATE ${event} hook in ${s.project}`);
  return ours.command;
}

// Shaped like the payloads captured in test/payloads.
function payload(s: Session, event: Event, fields: object): string {
  return `${JSON.stringify({
    session_id: s.sid, transcript_path: `${HOME}/.claude/projects/p/${s.sid}.jsonl`, cwd: s.project,
    ...(s.prompt === null || event === "SessionStart" ? {} : { prompt_id: s.prompt }),
    ...(event === "SessionStart" ? {} : { permission_mode: "acceptEdits" }),
    ...(s.agentId === null ? {} : { agent_id: s.agentId, agent_type: "general-purpose" }),
    hook_event_name: event, ...fields,
  })}\n`;
}

let calls = 0;
const tool = (name: string, input: object): object => ({ tool_name: name, tool_input: input, tool_use_id: `toolu_e2e_${++calls}` });
const hook = (s: Session, event: Event, fields: object): Out =>
  run(["sh", "-c", command(s, event)], s.project, s.env, payload(s, event, fields));
const STOP = { last_assistant_message: "done", background_tasks: [], session_crons: [] };

// One Claude Code session on the repo; `project` (relative to the repo) is where it was opened.
function claude(r: Repo, o: Partial<Session> = {}) {
  const project = at(r, o.project ?? ".");
  const s: Session = {
    sid: o.sid ?? randomUUID(), project, prompt: o.prompt === undefined ? randomUUID() : o.prompt,
    agentId: o.agentId ?? null, env: { ...r.env, CLAUDE_PROJECT_DIR: project, ...o.env },
  };
  return {
    session: s,
    start: () => hook(s, "SessionStart", { source: "startup" }),
    write: (rel: string, content: string) => hook(s, "PreToolUse", tool("Write", { file_path: at(r, rel), content })),
    bash: (cmd: string) => hook(s, "PreToolUse", tool("Bash", { command: cmd })),
    stop: (active = false) => hook(s, "Stop", { stop_hook_active: active, ...STOP }),
  };
}

function json(o: Out): HookOutput {
  return JSON.parse(o.stdout) as HookOutput;
}

// A PreToolUse deny: exit 2, the reason in the JSON and the same text on stderr. Returns the reason.
function denied(o: Out): string {
  expect(o.code).toBe(2);
  const out = json(o);
  expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(o.stderr.trim()).toBe(String(out.hookSpecificOutput.permissionDecisionReason).trim());
  return out.hookSpecificOutput.permissionDecisionReason!;
}

test("registered Claude doctor hook permits literal configuration reads and rejects output or settings mutations", () => {
  const r = repo({ ".": "backend-clean-ddd" }), a = claude(r);
  const global = join(HOME, ".claude/settings.json"), project = ".claude/settings.local.json";
  put(r, project, "{}\n");
  const before = readFileSync(global, "utf8");
  silent(a.bash(`cat -- '${global}' '${at(r, project)}'`));
  silent(a.bash(`cat ${project}`));
  for (const text of [
    `jq empty '${global}'`, `for f in '${global}'; do jq empty "$f"; done`, `unknown '${global}'`,
    `cat '${global}' > /tmp/doctor-copy`, `cat '${global}' > ${project}`, `cat '${global}' | jq .`,
    `sed -i s/x/y/ ${project}`, `jq '.disableAllHooks = true' '${global}'`, `cat .git/config`,
  ]) expect(denied(a.bash(text)), text).toContain("protected-path");
  expect(denied(a.bash("claude --settings /tmp/settings.json"))).toContain("hook-switch");
  expect(readFileSync(global, "utf8")).toBe(before);
  expect(read(r, project)).toBe("{}\n");
});

// A deny that also stops the turn. Returns the reason and the notice for the human.
function halted(o: Out): { reason: string; notice: string } {
  const reason = denied(o);
  expect(json(o).continue).toBe(false);
  return { reason, notice: json(o).stopReason! };
}

function blocked(o: Out): string {
  expect(o.code).toBe(2);
  expect(json(o).decision).toBe("block");
  return json(o).reason!;
}

// No objection and nothing to say: Claude Code's own permission flow goes on.
function silent(o: Out): void {
  expect({ code: o.code, stdout: o.stdout, stderr: o.stderr }).toEqual({ code: 0, stdout: "", stderr: "" });
}

function told(o: Out): string {
  expect(o.code).toBe(0);
  return json(o).systemMessage!;
}

const verdictOf = (o: Out): string => (o.code === 2 ? "deny" : o.code === 0 && o.stdout === "" ? "none" : "other");

const sessionDir = (r: Repo, sid: string): string => join(r.env.XDG_STATE_HOME!, "pregate/sessions", `claude-code:${sid}`);

// The CallEvents the engine recorded for a session (ARCHITECTURE §3).
function events(r: Repo, sid: string): { path: string | null; verdict: string }[] {
  const dir = join(sessionDir(r, sid), "events");
  const files = readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory()
    ? readdirSync(join(dir, e.name)).map((n) => join(dir, e.name, n)) : [join(dir, e.name)]);
  return files.map((file) => JSON.parse(readFileSync(file, "utf8")) as { path: string | null; verdict: string });
}

// ── The demo criterion (UC1, UC2): one repo, two presets, two behaviours ────────────────────

const DEMO_CASES: Record<Preset, { deny: string; rule: string; fixed: string }> = {
  "backend-clean-ddd": { deny: SETTER, rule: "ddd/DDD-ENT-001", fixed: SETTER_FIXED },
  "functional-ts": { deny: CLOCK, rule: "architecture/FCIS-IO-002", fixed: CLOCK_FIXED },
};

test("compiled hooks and report retain the session baseline after committing a violation", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const head = ok(git(r, "rev-parse", "HEAD"), "initial HEAD").stdout.trim();
  put(r, INVOICE_REL, SETTER);
  ok(git(r, "add", "."), "stage setter");
  ok(commit(r, "setter during session"), "commit setter");
  const currentHead = ok(git(r, "rev-parse", "HEAD"), "current HEAD").stdout.trim();
  expect(currentHead).not.toBe(head);
  ok(cli(r, "check"), "clean CLI comparison");
  expect(blocked(a.stop())).toContain("retained session snapshot");
  const folder = sessionDir(r, a.session.sid);
  const metadata = join(folder, readdirSync(folder).find((name) => existsSync(join(folder, name, "snapshot.json")))!, "snapshot.json");
  const before = readFileSync(metadata, "utf8");
  const history = events(r, a.session.sid);
  const report = JSON.parse(ok(cli(r, "report", "--json"), "baseline report").stdout);
  expect(report.sessionBaselines).toEqual([{ session: `claude-code:${a.session.sid}`, status: "available",
    head, currentHead, startedWithSession: true, dirtyFiles: 0, createdAt: JSON.parse(before).at, reason: null }]);
  expect(ok(cli(r, "report"), "text report").stdout).toContain("A clean CLI check does not clear a Stop finding");
  expect(readFileSync(metadata, "utf8")).toBe(before);
  expect(events(r, a.session.sid)).toEqual(history);
});

const CAPTURES: Record<HarnessId, string> = {
  "claude-code": "pre-write.json", codex: "codex/pre-apply-patch-add-update.json",
  cursor: "cursor/claude-import-pre-write.json", grok: "grok/pre-write.json", agy: "agy/pre-write_to_file.json",
};

function capturedWrite(h: HarnessId, dir: string, content: string): string {
  const p = JSON.parse(readFileSync(join(import.meta.dir, "payloads", CAPTURES[h]), "utf8")
    .replaceAll("/home/user/project", dir)) as Record<string, unknown>;
  const file = join(dir, "src/domain/canary.ts");
  const input = { file_path: file, content };
  if (h === "codex") p.tool_input = { command: `*** Begin Patch\n*** Add File: ${file}\n${content.trimEnd().split("\n").map((l) => `+${l}`).join("\n")}\n*** End Patch\n` };
  else if (h === "agy") p.toolCall = { ...(p.toolCall as Record<string, unknown>), args: { TargetFile: file, CodeContent: content } };
  else {
    p.tool_input = input;
    if (h === "grok") p.toolInput = input;
  }
  // Claude's original captures came from a different absolute workspace.
  if (h === "claude-code") p.cwd = dir;
  return JSON.stringify(p);
}

for (const h of Object.keys(CAPTURES) as HarnessId[]) {
  test(`${h}: captured write denies a violation, accepts clean code, and is stateless without a preset`, () => {
    const r = repo({ ".": "backend-clean-ddd" });
    const env = h === "grok" ? { ...r.env, GROK_HOOK_EVENT: "pre_tool_use" } : r.env;
    const flag = h === "codex" || h === "agy" ? h : "claude-code";
    const registered = hookCommand(join(DATA, "pregate"), "pre", flag);
    const pre = (dir: string, text: string): Out => run(["sh", "-c", registered], dir, env, capturedWrite(h, dir, text));
    const bad = pre(r.dir, SETTER);
    expect(bad.code).toBe(h === "cursor" || h === "agy" ? 0 : 2);
    expect(said(bad)).toContain("ddd/DDD-ENT-001");
    if (h === "codex") expect(bad.stdout).toBe("");
    else if (h === "agy") expect(JSON.parse(bad.stdout).decision).toBe("deny");
    else expect(json(bad).hookSpecificOutput.permissionDecision).toBe("deny");
    silent(pre(r.dir, INVOICE));
    const outside = join(TMP, "unrooted", h);
    mkdirSync(outside, { recursive: true });
    const state = join(TMP, "unrooted-state", h);
    silent(run(["sh", "-c", registered], outside, { ...env, XDG_STATE_HOME: state }, capturedWrite(h, outside, SETTER)));
    expect(existsSync(state)).toBe(false);
  });
}

test("SessionStart in a Git repository without a contract says once how to set up, writes no state, and a plain folder stays silent", () => {
  const dir = join(TMP, "dormant-repo"), plain = join(TMP, "dormant-plain");
  mkdirSync(plain, { recursive: true });
  ok(run(["git", "init", "-q", dir], TMP, envOf()), "git init");
  for (const flag of ["claude-code", "codex"] as const) {
    const state = join(TMP, "dormant-state", flag);
    const env = { ...envOf(), XDG_STATE_HOME: state };
    const start = (cwd: string) => run(["sh", "-c", hookCommand(join(DATA, "pregate"), "session-start", flag)], cwd, env,
      JSON.stringify({ session_id: randomUUID(), transcript_path: join(HOME, "t.jsonl"), cwd, hook_event_name: "SessionStart", source: "startup" }));
    const told = ok(start(dir), `${flag} SessionStart`);
    const context = json(told).hookSpecificOutput.additionalContext!;
    expect(context).toContain("installed but not enabled");
    expect(context).toContain("pregate guide --preview");
    silent(start(plain));
    expect(existsSync(state)).toBe(false);
  }
});

test("a Claude Code subagent gets the briefing at SubagentStart, and a Cursor or Grok payload on that registration gets no reply", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const parent = claude(r);
  const session = json(ok(parent.start(), "SessionStart")).hookSpecificOutput.additionalContext!;
  expect(session).toContain("PREGATE is active");
  const sub = claude(r, { sid: parent.session.sid, agentId: "a0000000000000001" });
  const started = ok(hook(sub.session, "SubagentStart", {}), "SubagentStart");
  expect(started.stderr).toBe("");
  const reply = JSON.parse(started.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  expect(Object.keys(reply)).toEqual(["hookSpecificOutput"]);
  expect(reply.hookSpecificOutput.hookEventName).toBe("SubagentStart");
  // The same briefing as the session's: the same first line and the same checks. A lock read from the
  // compiled cache lists the parameters of a check in another order, so the bytes can differ.
  const checks = (text: string): string[] => text.split("\n").filter((line) => line.startsWith("- ")).map((line) => line.split(":")[0]!);
  expect(reply.hookSpecificOutput.additionalContext.split("\n")[0]).toBe(session.split("\n")[0]!);
  expect(checks(reply.hookSpecificOutput.additionalContext)).toEqual(checks(session));
  expect(checks(session).length).toBeGreaterThan(5);
  // The gate still judges the subagent's writes: the briefing grants nothing.
  expect(denied(sub.write("src/domain/order.ts", SETTER))).toContain("ddd/DDD-ENT-001");
  // Without a contract the subagent gets nothing: the session already has the line that says how to start.
  const bare = join(TMP, "subagent-dormant");
  ok(run(["git", "init", "-q", bare], TMP, envOf()), "git init");
  const command = hookCommand(join(DATA, "pregate"), "session-start", "claude-code");
  const shape = { session_id: randomUUID(), transcript_path: join(HOME, "t.jsonl"), prompt_id: randomUUID() };
  silent(run(["sh", "-c", command], bare, envOf(), JSON.stringify({ ...shape, cwd: bare, hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "general-purpose" })));
  // Cursor and Grok read the same settings file. If one dispatches the event, the command is silent.
  silent(run(["sh", "-c", command], r.dir, r.env, JSON.stringify({ hook_event_name: "subagentStart", cursor_version: "3.2.11", conversation_id: randomUUID(), workspace_roots: [r.dir] })));
  silent(run(["sh", "-c", command], r.dir, { ...r.env, GROK_HOOK_EVENT: "subagent_start" }, JSON.stringify({ hookEventName: "subagent_start", sessionId: randomUUID(), cwd: r.dir })));
});

test("blocked edits preserve protection and offer reviewed rule adaptation in every captured harness", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const preset = read(r, ".pregate/preset.json"), lock = read(r, ".pregate/pregate.lock.json");
  for (const h of Object.keys(CAPTURES) as HarnessId[]) {
    const env = h === "grok" ? { ...r.env, GROK_HOOK_EVENT: "pre_tool_use" } : r.env;
    const bad = run(["sh", LAUNCHER, "hook", "pre", "--harness", h], r.dir, env, capturedWrite(h, r.dir, SETTER));
    expect(bad.code).toBe(h === "cursor" || h === "agy" ? 0 : 2);
    expect(said(bad)).toContain("ddd/DDD-ENT-001");
    if (h === "grok") expect(said(bad)).toContain("explain ddd/DDD-ENT-001");
    else {
      expect(said(bad)).toContain("propose a bounded rule/pack change");
      expect(said(bad)).toContain("Do not suggest disabling PREGATE or its hooks just to unblock the task");
    }
  }
  for (const args of [["explain", "ddd/DDD-ENT-001"], ["explain", "--path", INVOICE_REL], ["preset", "show"]]) {
    const out = cli(r, ...args);
    expect(out.code).toBe(0);
    expect(said(out)).toContain("valid example and an invalid counterexample");
    expect(said(out)).toContain(".pregate/requests/<name>.json");
    expect(said(out)).toContain("preset apply <request.json> --preview");
    expect(said(out)).toContain("without activating it. Only the human approves.");
  }
  expect(read(r, ".pregate/preset.json")).toBe(preset);
  expect(read(r, ".pregate/pregate.lock.json")).toBe(lock);
  const status = cli(r, "status", "--json");
  expect(status.code).toBe(0);
  expect(JSON.parse(status.stdout).consent).toBe(true);
});

test("main rejects unknown tools inside a preset with harness context, and ignores them outside it", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  const reason = denied(hook(a.session, "PreToolUse", tool("future_write", {})));
  expect(reason).toContain("payload-unrecognized (claude-code)");
  expect(reason).not.toContain("future_write");
  const outside = join(TMP, "unrooted-main");
  mkdirSync(outside);
  const state = join(TMP, "unrooted-main-state");
  const s = { ...a.session, project: outside, env: { ...r.env, CLAUDE_PROJECT_DIR: outside, XDG_STATE_HOME: state } };
  silent(hook(s, "PreToolUse", tool("future_write", {})));
  expect(existsSync(state)).toBe(false);
});

test("main redirects hooks once and the CLI delegates before reading stdin; compile uses the current engine", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const lock = JSON.parse(read(r, ".pregate/pregate.lock.json")) as { engine: string };
  lock.engine = "9.9.9";
  put(r, ".pregate/pregate.lock.json", JSON.stringify(lock));
  const pinned = join(DATA, "pregate/9.9.9/pregate");
  put(r, pinned, '#!/bin/sh\ncase "$1" in hook) echo "pinned hook" >&2; exit 2 ;; esac\nprintf "%s\\n" "$*"\ncat\nexit 37\n');
  run(["chmod", "+x", pinned], r.dir, r.env);
  const a = claude(r);
  const raw = payload(a.session, "PreToolUse", tool("Write", { file_path: at(r, INVOICE_REL), content: SETTER }));
  const direct = run([ENGINE, ...PRE], r.dir, r.env, raw);
  expect(direct).toMatchObject({ code: 3, stdout: `9.9.9\n${raw}`, stderr: "" });
  expect(a.write(INVOICE_REL, SETTER)).toMatchObject({ code: 2, stdout: "", stderr: "pinned hook\n" });
  const check = run(["pregate", "check", "--stdin", "--path", INVOICE_REL], r.dir, r.env, "the proposed bytes\n");
  expect(check).toMatchObject({ code: 37, stdout: `check --stdin --path ${INVOICE_REL}\nthe proposed bytes\n`, stderr: "" });
  ok(cli(r, "preset", "compile"), "compile must not delegate");
  expect(JSON.parse(read(r, ".pregate/pregate.lock.json")).engine).toBe(pkg.version);
  const fresh = JSON.parse(read(r, ".pregate/pregate.lock.json"));
  fresh.rules.push({ id: "stale" });
  put(r, ".pregate/pregate.lock.json", JSON.stringify(fresh));
  expect(denied(a.write(INVOICE_REL, SETTER))).toContain("lock-stale");
});

test("demo: the same two edits get opposite verdicts under the two presets", () => {
  const table = Object.fromEntries((Object.keys(DEMO_CASES) as Preset[]).map((preset) => {
    const a = claude(repo({ ".": preset }));
    ok(a.start(), "SessionStart");
    return [preset, { setter: verdictOf(a.write(INVOICE_REL, SETTER)), clock: verdictOf(a.write(INVOICE_REL, CLOCK)) }];
  }));
  expect(table).toEqual({
    "backend-clean-ddd": { setter: "deny", clock: "none" },
    "functional-ts": { setter: "none", clock: "deny" },
  });
});

for (const [preset, c] of Object.entries(DEMO_CASES)) {
  test(`demo: ${preset}: SessionStart → deny → corrected in one attempt → Stop`, () => {
    const r = repo({ ".": preset as Preset });
    const a = claude(r);
    const start = json(ok(a.start(), "SessionStart")).hookSpecificOutput.additionalContext!;
    expect(start).toStartWith(`PREGATE is active: preset ${preset} 1.0.0`);
    expect(start).toContain(`${LAUNCHER} check --stdin`);
    const reason = denied(a.write(INVOICE_REL, c.deny));
    expect(reason).toStartWith(`PREGATE DENY ${c.rule} ${INVOICE_REL}:`);
    expect(reason).toContain(`Preset ${preset} 1.0.0`);
    expect(reason).toContain("attempt 1");
    silent(a.write(INVOICE_REL, c.fixed));
    put(r, INVOICE_REL, c.fixed);   // the tool writes what the gate let through
    silent(a.stop());
    expect(events(r, a.session.sid).map((e) => e.verdict).sort()).toEqual(["deny", "none", "none"]);
  });
}

// ── Stop ─────────────────────────────────────────────────────────────────────────────────

test.each(["warn", "shadow"] as const)("Stop advisory %s never continues a turn and remains in the report", mode => {
  const r = repo({ ".": "backend-clean-ddd" });
  recommit(r, p => {
    p.overrides = { ...(p.overrides as object), "ddd/DDD-ENT-001": {
      severity: mode === "warn" ? "warn" : "deny", enforcement: mode === "shadow" ? "shadow" : "enforce",
    } };
  });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const pre = ok(a.write(INVOICE_REL, SETTER), "advisory Pre");
  if (mode === "warn") expect(json(pre).hookSpecificOutput.additionalContext).toContain("PREGATE WARN");
  else silent(pre);
  put(r, INVOICE_REL, SETTER);
  for (const active of [false, true, false, true]) {
    const turn = claude(r, { sid: a.session.sid, prompt: randomUUID() });
    silent(turn.stop(active));
  }
  const report = JSON.parse(ok(cli(r, "report", "--json"), "advisory report").stdout);
  expect(report.denials).toBe(0); expect(report.incompleteStops).toEqual([]);
  if (mode === "warn") expect(report.warningRules).toContainEqual({ rule: "ddd/DDD-ENT-001", count: 5 });
  else expect(report.rules).toContainEqual({ rule: "ddd/DDD-ENT-001", count: 5, shadow: 5, enforcement: "shadow" });
  expect(events(r, a.session.sid).every(event => event.verdict === "none")).toBe(true);
});

test.each(["enforce", "shadow"] as const)("per-rule enforcement reverses %s across hook, Stop, check, commit and report", (mode) => {
  const r = repo({ ".": "backend-clean-ddd" }, true);
  recommit(r, (p) => {
    p.enforcement = mode;
    p.overrides = { ...(p.overrides as object), "ddd/DDD-ENT-001": { enforcement: mode === "enforce" ? "shadow" : "enforce" },
      "clean-code/CC-FN-002": { severity: "deny" } };
  });
  const a = claude(r);
  const start = json(ok(a.start(), "SessionStart")).hookSpecificOutput.additionalContext!;
  expect(start).toContain(`ddd/DDD-ENT-001 (deny, ${mode === "enforce" ? "shadow" : "enforce"}`);
  expect(cli(r, "preset", "show").stdout).toContain(`clean-code/CC-FN-002 (deny, ${mode}`);
  const content = `${SETTER}\nexport function total(a: number, b: number, c: number, d: number): number { return a + b + c + d; }\n`;
  const enforced = mode === "enforce" ? "clean-code/CC-FN-002" : "ddd/DDD-ENT-001";
  const shadow = mode === "enforce" ? "ddd/DDD-ENT-001" : "clean-code/CC-FN-002";
  expect(denied(a.write(INVOICE_REL, content))).toContain(enforced);
  const checked = run(["pregate", "check", "--stdin", "--path", INVOICE_REL], r.dir, r.env, content);
  expect(checked.code).toBe(1);
  expect(checked.stdout).toContain(enforced);
  expect(checked.stdout).not.toContain(shadow);
  put(r, INVOICE_REL, content);
  expect(blocked(a.stop())).toContain(enforced);
  const report = JSON.parse(ok(cli(r, "report", "--json"), "report").stdout);
  expect(report.rules.find((v: { rule: string }) => v.rule === enforced)).toMatchObject({ enforcement: "enforce", shadow: 0 });
  expect(report.rules.find((v: { rule: string }) => v.rule === shadow)).toMatchObject({ enforcement: "shadow", shadow: 2 });
  ok(git(r, "add", INVOICE_REL), "git add");
  const committed = commit(r, "mixed findings");
  expect(committed.code).toBe(1);
  expect(said(committed)).toContain(enforced);
  expect(said(committed)).not.toContain(shadow);
});

test("D29: headless edits queue validated changes; only the human command applies them", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const preset = JSON.parse(readFileSync(at(r, ".pregate/preset.json"), "utf8"));
  preset.enforcement = "shadow";
  const content = JSON.stringify(preset);
  const agent = claude(r);
  expect(agent.write(".pregate/preset.json", "{}").code).toBe(2);
  expect(cli(r, "approve").stdout).toContain("No pending");
  expect(denied(agent.write(".pregate/preset.json", content))).toContain("inside your harness with `pregate approve --preview`");
  const preview = revealed(r, "approve", "--preview");
  expect(preview.code).toBe(0);
  expect(preview.stdout).toMatch(/pregate approve [0-9a-f]{12}$/m);
  expect(preview.stdout).toContain("WARNING");
  expect(cli(r, "approve", "--yes", "--digest", "0".repeat(64)).code).toBe(1);
  expect(run(["pregate", "approve"], r.dir, r.env, "y\n").code).toBe(1);
  const human = (answer: string) => run(["pregate", "approve"], r.dir, { ...r.env, PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: answer });
  expect(human("").code).toBe(1);
  expect(human("I approve").code).toBe(1);
  expect(JSON.parse(readFileSync(at(r, ".pregate/pregate.lock.json"), "utf8")).enforcement).toBe("enforce");
  const approved = human("y");
  expect(approved.code).toBe(0);
  expect(approved.stdout).toContain("WARNING: this may weaken protection.");
  expect(cli(r, "preset", "show").code).toBe(0);
  expect(JSON.parse(readFileSync(at(r, ".pregate/pregate.lock.json"), "utf8")).enforcement).toBe("shadow");
  expect(cli(r, "approve").stdout).toContain("No pending");
  for (const command of ["pregate approve", "pregate approve --yes", "pregate enable --yes", "pregate disable --yes", "pregate init --yes", "pregate pack add url@ref --yes",
    "pregate pack update acme --yes", "PREGATE_TESTING=1 PREGATE_TEST_ANSWER=y pregate approve"]) expect(agent.bash(command).code).toBe(2);
});

test("D29: pending contracts expire and reject a changed baseline", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const content = JSON.stringify({ ...JSON.parse(read(r, ".pregate/preset.json")), enforcement: "shadow" });
  const agent = claude(r);
  const human = () => run(["pregate", "approve"], r.dir, { ...r.env, PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: "y" });
  expect(agent.write(".pregate/preset.json", content).code).toBe(2);
  const folder = join(DATA, "pregate/proposals");
  const file = readdirSync(folder).map((f) => join(folder, f)).find((f) => JSON.parse(readFileSync(f, "utf8")).root === r.dir)!;
  const proposal = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...proposal, at: Date.now() - 24 * 3_600_000 - 1 }));
  expect(human().stdout).toContain("expired");
  expect(agent.write(".pregate/preset.json", content).code).toBe(2);
  put(r, ".pregate/preset.json", read(r, ".pregate/preset.json") + "\n");
  expect(human().stdout).toContain("stale or invalid");
  expect(JSON.parse(read(r, ".pregate/pregate.lock.json")).enforcement).toBe("enforce");
});

test("D29: enforced native Claude permission activates only the exact tool result", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const content = JSON.stringify({ ...JSON.parse(read(r, ".pregate/preset.json")), enforcement: "shadow" });
  const agent = claude(r, { env: { CI: "", PREGATE_UNATTENDED_APPROVAL: "", PREGATE_TESTING: "", PREGATE_TEST_ANSWER: "" } });
  const asked = agent.write(".pregate/preset.json", content);
  expect(asked.code).toBe(0);
  expect(json(asked).hookSpecificOutput.permissionDecision).toBe("ask");
  expect(json(asked).hookSpecificOutput.additionalContext).toContain("WARNING");
  expect(JSON.parse(read(r, ".pregate/pregate.lock.json")).enforcement).toBe("enforce");
  put(r, ".pregate/preset.json", content + "\n");
  expect(cli(r, "preset", "show").code).toBe(1);
  put(r, ".pregate/preset.json", content);
  expect(cli(r, "preset", "show").code).toBe(0);
  expect(JSON.parse(read(r, ".pregate/pregate.lock.json")).enforcement).toBe("shadow");
});

test("compiled issue reporting offers an offline review and sends only the approved body through gh", () => {
  const r = repo({ ".": "backend-clean-ddd" }), a = claude(r);
  recommit(r, (p) => { p.overrides = { ...(p.overrides as object), "clean-code/CC-FN-002": { severity: "deny" } }; });
  const content = 'export function tooMany(a: number, b: number, c: number, d: number, e: number): number { return 0; }\n';
  expect(denied(a.write("src/domain/report.ts", content))).toContain("pregate issue draft --last");
  const draft = ok(revealed(r, "issue", "draft", "--last", "--note", "This finding needs investigation."), "issue draft");
  const id = /^Digest: ([0-9a-f]{64})$/m.exec(draft.stdout)![1]!;
  expect(draft.stdout).not.toContain(content.trim());
  expect(draft.stdout).toContain(`Engine: ${pkg.version}`);
  expect(cli(r, "issue", "submit", id).code).toBe(1);
  expect(a.bash(`pregate issue submit ${id} --yes`).code).toBe(2);
  const parent = claude(r, { env: { CI: "", PREGATE_UNATTENDED_APPROVAL: "" } }).bash(`pregate issue submit ${id} --yes`);
  expect(parent.code).toBe(2);
  expect(parent.stdout + parent.stderr).toContain(`type ! pregate issue submit ${id} --yes inside the harness`);
  const stub = at(r, "gh-stub");
  mkdirSync(stub);
  const fake = join(stub, "gh"), args = join(stub, "args");
  writeFileSync(fake, '#!/bin/sh\ncase "$2" in\nlist) printf "[]" ;;\ncreate) printf "%s\\n" "$@" > "$PREGATE_GH_ARGS"; printf "https://github.com/pedroknigge/pregate/issues/42\\n" ;;\n*) exit 9 ;;\nesac\n');
  chmodSync(fake, 0o755);
  const env = { ...r.env, PATH: `${stub}:${r.env.PATH}`, PREGATE_GH_ARGS: args };
  const submitted = run(["pregate", "issue", "submit", id, "--yes"], r.dir, env);
  expect(submitted.code).toBe(0); expect(submitted.stdout).toContain("Reported:");
  const argv = readFileSync(args, "utf8").trim().split("\n");
  expect(argv[argv.indexOf("--repo") + 1]).toBe("pedroknigge/pregate");
  const body = readFileSync(argv[argv.indexOf("--body-file") + 1]!, "utf8");
  expect(body).toContain("This finding needs investigation.");
  expect(body).not.toContain(content.trim());
  expect(run(["pregate", "issue", "submit", id, "--yes"], r.dir, env).stdout).toContain("Already reported:");
});

test("D29: preset apply validates and prompts before changing the contract", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  put(r, "request.json", JSON.stringify({ why: "Observe first", patch: [{ op: "add", path: "/enforcement", value: "shadow" }] }));
  expect(cli(r, "preset", "apply", "request.json").code).toBe(1);
  expect(JSON.parse(read(r, ".pregate/pregate.lock.json")).enforcement).toBe("enforce");
  const applied = cli(r, "preset", "apply", "request.json", "--yes");
  expect(applied.code).toBe(0);
  expect(applied.stdout).toContain("WARNING");
  expect(JSON.parse(read(r, ".pregate/pregate.lock.json")).enforcement).toBe("shadow");
});

test("Stop without prompt_id: unchanged findings stay capped across turns; a changed tree blocks again", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r, { prompt: null });
  ok(a.start(), "SessionStart");
  put(r, INVOICE_REL, SETTER);   // written behind the gate's back (a shell escape)
  expect(blocked(a.stop())).toContain("ddd/DDD-ENT-001");
  expect(blocked(a.stop(true))).toContain("ddd/DDD-ENT-001");
  const last = a.stop(true);
  expect(last.stderr).toBe("");
  expect(told(last)).toContain("reaching the Stop limit");
  expect(told(last)).toContain("pregate report --json");
  const reported = JSON.parse(ok(cli(r, "report", "--json"), "incomplete Stop report").stdout);
  expect(reported.incompleteStops).toHaveLength(1);
  expect(reported.incompleteStops[0]).toMatchObject({ reason: "limit", cause: null });
  expect(reported.incompleteStops[0].violations.some((v: { rule: string }) => v.rule === "ddd/DDD-ENT-001")).toBe(true);
  expect(reported.incompleteStops[0].message).toContain("pregate check --all");
  expect(ok(cli(r, "report"), "incomplete Stop text report").stdout).toContain("without a successful compliance check");
  expect(told(a.stop())).toContain("unchanged Stop findings");
  put(r, INVOICE_REL, SETTER + "\nexport const changedTree = 1;\n");
  expect(blocked(a.stop())).toContain("ddd/DDD-ENT-001");
});

test("Stop: an ask the human approved does not block the end of the turn", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const asked = a.write("test/money.test.ts", MONEY_TEST_WEAKER);
  expect(asked.code).toBe(0);
  const ask = json(asked).hookSpecificOutput;
  expect(ask.permissionDecision).toBe("ask");
  expect(ask.permissionDecisionReason).toStartWith("PREGATE requests your approval at test/money.test.ts");
  expect(ask.additionalContext).toStartWith("PREGATE ASK testing/TDD-DEL-001");
  put(r, "test/money.test.ts", MONEY_TEST_WEAKER);   // the human approved and the tool wrote it
  expect(told(a.stop())).toContain("you approved these rule violations");
});

test("ask without a human (a subagent): deny and halt", () => {
  const a = claude(repo({ ".": "backend-clean-ddd" }), { agentId: "a0000000000000001" });
  ok(a.start(), "SessionStart");
  const { reason, notice } = halted(a.write("test/money.test.ts", MONEY_TEST_WEAKER));
  expect(reason).toStartWith("PREGATE DENY testing/TDD-DEL-001");
  expect(notice).toContain("this session cannot ask");
});

// ── Counters and loops, with the real analysis ────────────────────────────────────────────

test("loop: attempts count per (file, rule) and the third denial stops the turn", () => {
  const a = claude(repo({ ".": "backend-clean-ddd" }));
  ok(a.start(), "SessionStart");
  // Each attempt removes a setter: progress, so only the counter can stop it.
  expect(denied(a.write(INVOICE_REL, setters(3)))).toContain("attempt 1");
  expect(denied(a.write(INVOICE_REL, setters(2)))).toContain("attempt 2");
  const { reason, notice } = halted(a.write(INVOICE_REL, setters(1)));
  expect(reason).toContain("attempt 3");
  expect(notice).toContain("the agent reached the retry limit for the same rule and file");
});

test("loop: resending the same edit is no progress, told once and stopped the second time", () => {
  const r = repo({ ".": "backend-clean-ddd" }, true);
  recommit(r, (p) => void (p.loop = { maxDenialsPerFileRule: 10 }));
  const a = claude(r);
  ok(a.start(), "SessionStart");
  expect(denied(a.write(INVOICE_REL, SETTER))).not.toContain("makes no progress");
  expect(denied(a.write(INVOICE_REL, SETTER))).toContain("This edit repeats a denied one or makes no progress");
  expect(halted(a.write(INVOICE_REL, SETTER)).notice).toContain("the agent resubmitted edits without progress");
});

// What is under test is the counter (append-only events, A11), not the latency: a new file in an
// excluded path is denied by placement (EVA-SCOPE-001) without parsing, so 20 engines at once fit
// well inside the deadline on a runner with 2 vCPU too (O30). The counter is the same for every rule.
test("loop: 20 Pre calls in parallel on one (file, rule) leave the counter at 20", async () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const s = a.session;
  const rel = "src/infra/migrations/0001_init.ts";
  const content = "export const up = 1;\n";
  const write = (): Promise<Out> => runAsync(["sh", "-c", command(s, "PreToolUse")], s.project, s.env,
    payload(s, "PreToolUse", tool("Write", { file_path: at(r, rel), content })));
  const outs = await Promise.all(Array.from({ length: 20 }, write));
  for (const o of outs) expect(denied(o)).toContain("core/EVA-SCOPE-001");
  expect(events(r, s.sid).filter((e) => e.path === at(r, rel) && e.verdict === "deny").length).toBe(20);
  expect(halted(a.write(rel, content)).reason).toContain("attempt 21");
});

// ── Pre-commit and CI ────────────────────────────────────────────────────────────────────

test("pre-commit: a staged violation fails the commit", () => {
  const r = repo({ ".": "backend-clean-ddd" }, true);
  const head = git(r, "rev-parse", "HEAD").stdout;
  put(r, INVOICE_REL, SETTER);
  ok(git(r, "add", INVOICE_REL), "git add");
  const failed = commit(r, "setter");
  expect(failed.code).toBe(1);
  expect(said(failed)).toContain("ddd/DDD-ENT-001");
  expect(git(r, "rev-parse", "HEAD").stdout).toBe(head);
});

test("pre-commit in shadow: an explicitly enforcing optional rule still fails the commit", () => {
  const r = repo({ ".": "backend-clean-ddd" }, true);
  put(r, INVOICE_REL, SETTER);
  recommit(r, (p) => {
    p.enforcement = "shadow";
    p.overrides = { ...(p.overrides as object), "typescript/EVA-CAST-001": { severity: "deny", enforcement: "enforce" } };
  });   // the setter goes with it; the reviewed TypeScript rule remains enforcing
  put(r, INVOICE_REL, `${SETTER}\nexport const cents = "12" as unknown as number;\n`);
  ok(git(r, "add", INVOICE_REL), "git add");
  const failed = commit(r, "double assertion");
  expect(failed.code).toBe(1);
  expect(said(failed)).toContain("typescript/EVA-CAST-001");
  expect(said(failed)).not.toContain("ddd/DDD-ENT-001");
});

test("a committed lock that no longer matches its preset fails the pre-commit and CI; recompiling and committing the lock clears it", () => {
  const r = repo({ ".": "backend-clean-ddd" }, true);
  editPreset(r, (p) => void ((p.resolve as Record<string, { params: { max: number } }>)["fn.size"]!.params.max = 41));
  ok(git(r, "add", "-A"), "git add");
  ok(commit(r, "preset without its lock", "--no-verify"), "git commit --no-verify");
  put(r, "README.md", "demo\n");
  ok(git(r, "add", "README.md"), "git add");
  const pre = commit(r, "readme");
  expect(pre.code).toBe(1);
  expect(said(pre)).toContain("pregate.lock.json does not match the preset and its sources");
  const ci = cli(r, "check", "--ratchet", "--base", "HEAD~1");
  expect(ci.code).toBe(1);
  expect(ci.stdout).toContain("pregate.lock.json does not match the preset and its sources");
  recommit(r, () => {});
  // The stale lock is gone; what remains is the loosening itself (a longer function limit), which
  // only the maintainer's acceptance of its digest lets through.
  const loosened = cli(r, "check", "--ratchet", "--base", "HEAD~1");
  expect(loosened.code).toBe(1);
  expect(loosened.stdout).not.toContain("pregate.lock.json does not match the preset and its sources");
  const digest = /Contract loosening digest: ([0-9a-f]{64})/.exec(loosened.stdout)?.[1];
  expect(digest, said(loosened)).toBeDefined();
  expect(run(["pregate", "check", "--ratchet", "--base", "HEAD~1"], r.dir, { ...r.env, PREGATE_ACCEPT_CONTRACT: digest! }).code).toBe(0);
});

test("pre-commit resolves imports against the index, not the working tree", () => {
  const r = repo({ ".": "backend-clean-ddd" }, true);
  const tsconfig = (target: string): string => JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@app/*": [`${target}/*`] } } });
  put(r, "src/infra/money.ts", 'export { Money } from "../domain/values/money";\n');
  put(r, "src/domain/report.ts", 'import { Money } from "@app/money";\n\nexport const nothing = Money.zero("USD");\n');
  put(r, "tsconfig.json", tsconfig("src/infra"));
  ok(git(r, "add", "-A"), "git add");
  put(r, "tsconfig.json", tsconfig("src/domain/values"));   // unstaged: the commit maps to infra
  const failed = commit(r, "report");
  expect(failed.code).toBe(1);
  expect(said(failed)).toContain("architecture/CA-DEP-001 src/domain/report.ts");
  ok(git(r, "add", "tsconfig.json"), "git add");
  put(r, "tsconfig.json", tsconfig("src/infra"));   // unstaged now; the commit maps inside the domain
  ok(commit(r, "report"), "git commit");
});

// ── Fail-closed: what the engine cannot report itself ─────────────────────────────────────

// Isolate a fault in the shared installation and restore it before another test runs.
function absent<T>(path: string, f: () => T): T {
  renameSync(path, `${path}.held`);
  return restoring(path, f);
}

function restoring<T>(path: string, f: () => T): T {
  try { return f(); } finally { renameSync(`${path}.held`, path); }
}

function failedPre(o: Out): string {
  expect(o.code).toBe(2);
  expect(o.stdout).toBe("");
  expect(o.stderr.trim()).not.toBe("");
  expect(o.stderr.trim().split("\n")).toHaveLength(1);
  return o.stderr.trim();
}

test("launcher missing: the inline guard denies Pre; other events are neutral (MH-22)", () => absent(LAUNCHER, () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  expect(failedPre(a.write(INVOICE_REL, SETTER_FIXED))).toContain("launcher is missing");
  silent(a.stop());
  silent(a.start());
}));

test("engine missing: Pre denies with exit 2, Stop blocks once, SessionStart tells", () => absent(ENGINE, () => {
  const a = claude(repo({ ".": "backend-clean-ddd" }));
  expect(failedPre(a.write(INVOICE_REL, SETTER_FIXED))).toContain(`engine ${pkg.version} is not installed`);
  expect(blocked(a.stop())).toContain(`engine ${pkg.version} is not installed`);
  expect(told(a.stop(true))).toContain(`engine ${pkg.version} is not installed`);
  expect(told(a.start())).toContain("PREGATE could not prepare this session");
}));

test("hook auto: the launcher with no arguments supervises the event it reads from the payload", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const s = claude(r).session;
  const auto = (event: Event, fields: object): Out =>
    run(["sh", LAUNCHER], r.dir, r.env, payload(s, event, fields));
  ok(auto("SessionStart", { source: "startup" }), "SessionStart");
  expect(denied(auto("PreToolUse", tool("Write", { file_path: at(r, INVOICE_REL), content: SETTER })))).toContain("ddd/DDD-ENT-001");
  absent(ENGINE, () => {
    expect(blocked(auto("Stop", { stop_hook_active: false, ...STOP }))).toContain("is not installed");
    expect(told(auto("SessionStart", { source: "startup" }))).toContain("could not prepare this session");
    expect(failedPre(auto("PreToolUse", tool("Bash", { command: "ls" })))).toContain("is not installed");
  });
});

test("the engine ignores a bunfig.toml and a .env in the repo it judges (O32)", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  // A preload that would answer "nothing to say" for the engine, and a state directory elsewhere.
  put(r, "bunfig.toml", 'preload = ["./allow.js"]\n');
  put(r, "allow.js", "process.exit(0);\n");
  put(r, ".env", `XDG_STATE_HOME=${join(r.dir, "elsewhere")}\n`);
  const a = claude(r);
  ok(a.start(), "SessionStart");
  expect(denied(a.write(INVOICE_REL, SETTER))).toContain("ddd/DDD-ENT-001");
  expect(events(r, a.session.sid).filter((e) => e.verdict === "deny").length).toBe(1);
  expect(existsSync(join(r.dir, "elsewhere"))).toBe(false);
});

test("an engine that throws exits 1, and the launcher denies", () => {
  // A session id that would leave the data directory: state.ts refuses it with an exception.
  const a = claude(repo({ ".": "backend-clean-ddd" }), { sid: "../escape" });
  expect(failedPre(a.write(INVOICE_REL, SETTER_FIXED))).toBe("PREGATE could not evaluate: the engine failed (exit 1); last engine checkpoint: input; report it to the user");
  expect(blocked(a.stop())).toBe("PREGATE could not verify this turn: the engine failed (exit 1); last engine checkpoint: input; report it to the user");
});

test("snapshot.json deleted: deny and halt", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const dir = sessionDir(r, a.session.sid);
  const roots = readdirSync(dir).filter((n) => /^[0-9a-f]{12}$/.test(n));
  expect(roots.length).toBe(1);
  rmSync(join(dir, roots[0]!, "snapshot.json"));
  const { reason, notice } = halted(a.write(INVOICE_REL, SETTER_FIXED));
  expect(reason).toStartWith("PREGATE DENY snapshot-missing");
  expect(notice).toContain("the session snapshot is missing");
});

test("sessions/<sid>/ deleted: the 'before' of every file becomes HEAD", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  put(r, INVOICE_REL, SETTER);   // dirty when the session starts: its setter is not the agent's
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const next = SETTER.replace("export class Invoice {", "// Invoices are issued once.\nexport class Invoice {");
  silent(a.write(INVOICE_REL, next));
  rmSync(sessionDir(r, a.session.sid), { recursive: true });
  expect(denied(a.write(INVOICE_REL, next))).toContain("ddd/DDD-ENT-001");
});

test(".pregate/ deleted mid-session: the accepted root stays protected with the global launcher", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  rmSync(at(r, ".pregate/preset.json"));
  rmSync(at(r, ".pregate/pregate.lock.json"));
  const stale = halted(a.write(INVOICE_REL, SETTER_FIXED));
  expect(stale.reason).toStartWith("PREGATE DENY lock-stale");
  expect(stale.notice).toContain("pregate preset diagnose --json");
  rmSync(at(r, ".pregate"), { recursive: true });
  expect(halted(a.write(INVOICE_REL, SETTER_FIXED)).reason).toStartWith("PREGATE DENY lock-stale");
});

test("a lock compiled against another builtin catalog of the same core version is stale until preset compile (O41)", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  // What a build of 0.1.0 before O34 and O41 left: EVA-SCOPE-001 without `extensions`, no coreHash.
  // Placement would throw on it (exit 1, "the engine failed"); the engine must call it stale instead.
  const lock = JSON.parse(read(r, ".pregate/pregate.lock.json")) as { coreHash?: string; rules: { params: Record<string, unknown> }[] };
  delete lock.coreHash;
  for (const rule of lock.rules) delete rule.params.extensions;
  put(r, ".pregate/pregate.lock.json", `${JSON.stringify(lock, null, 2)}\n`);
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const stale = halted(a.write("src/domain/pricing.py", "PRICE = 1\n"));
  expect(stale.reason).toStartWith("PREGATE DENY lock-stale");
  expect(stale.notice).toContain("pregate preset diagnose --json");
  expect(cli(r, "check", "--ratchet", "--base", "HEAD").stdout).toContain("pregate.lock.json does not match the preset and its sources");
  ok(cli(r, "preset", "compile"), "preset compile");
  expect(denied(a.write("src/domain/pricing.py", "PRICE = 1\n"))).toContain("core/EVA-SCOPE-001");
});

test("an uncommitted preset that predates first contact is enforced without SessionStart (MH-33)", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  ok(git(r, "rm", "-r", "-q", "--cached", ".pregate"), "git rm --cached");
  ok(commit(r, "untrack PREGATE"), "git commit");
  expect(denied(claude(r).write(INVOICE_REL, SETTER))).toContain("ddd/DDD-ENT-001");
  const a = claude(r);
  ok(a.start(), "SessionStart");
  expect(denied(a.write(INVOICE_REL, SETTER))).toContain("ddd/DDD-ENT-001");
});

// ── A path source with a regex that backtracks: regex-limit and the watchdog ───────────────

// A local check, "no name with a run of a followed by b", written with a given regex. Its fixtures
// are short, so `rules test` passes and the preset compiles.
const doc = (o: object): string => `${JSON.stringify(o, null, 2)}\n`;
const CHECK_DIR = "checks/naming/no-a-runs";
const fixture = (name: string, code: string, lines: number[]): Record<string, string> => ({
  [`${CHECK_DIR}/fixtures/${name}/fixture.json`]: doc({
    language: "typescript", params: {}, target: "src/x.ts", before: null,
    expect: lines.length === 0 ? { verdict: "pass" } : { verdict: "fail", violations: lines.map((line) => ({ line })) },
  }),
  [`${CHECK_DIR}/fixtures/${name}/files/src/x.ts.fixture`]: code,
});
const localRules = (regex: string): Record<string, string> => ({
  "source.json": doc({ ns: "local", version: "1.0.0" }),
  [`${CHECK_DIR}/check.json`]: doc({
    id: "local/naming/no-a-runs", version: "1.0.0", area: "naming", cardinality: "singleton", dimension: "naming.a-runs",
    minSeverity: null, params: {}, phase: ["pre", "stop", "commit", "ci"],
    impl: { kind: "pattern", patterns: { typescript: [{ id: "a-run", rule: { kind: "identifier", regex } }] } },
    feedback: { message: "{symbol} is named with a run of a followed by b." },
  }),
  "methodologies/naming.json": doc({
    id: "local/naming", version: "1.0.0", status: "complete", conflicts: [],
    invariants: [{
      id: "LOCAL-A-001", check: "local/naming/no-a-runs", defaults: {}, severity: "deny",
      source: { work: "e2e", locator: "test/e2e.test.ts", paraphrase: "A run of a followed by b says nothing." },
      why: "A name with a run of a followed by b says nothing.", fixHint: "Name it after what it holds.",
      avoid: "Breaking the run with another letter.", examples: { pass: "pass/word", fail: "fail/run" },
    }],
  }),
  ...fixture("pass/word", "export const total = 1;\n", []),
  ...fixture("pass/banana", "export const banana = 1;\n", []),
  ...fixture("fail/run", "export const aab = 1;\n", [1]),
  ...fixture("fail/single", "\nexport const ab = 1;\n", [2]),
  ...fixture("pass/almost", "export const baa = 1;\n", []),
  ...fixture("trap/surrounded-run", "export const prefix_aab_suffix = 1;\n", [1]),
});
// `(a+)+b` backtracks over the run of a until JavaScriptCore gives up and answers "no match" (O27),
// though the name ends in "ab". `a*a*a*a*a*a*a+b` has no group, so JavaScriptCore never gives up: the
// engine hangs.
const GIVES_UP = { regex: "(a+)+b", content: `export const ${"a".repeat(40)}Xab = 1;\n` };
const HANGS = { regex: "a*a*a*a*a*a*a+b", content: `export const ${"a".repeat(100)}X = 1;\n` };

const local = new Map<string, { r: Repo; payload: string }>();
// The repo with the local rule in that regex, and the Write payload of its content.
function withLocalRule({ regex, content }: { regex: string; content: string }): { r: Repo; payload: string } {
  const cached = local.get(regex);
  if (cached !== undefined) return cached;
  const r = repo({ ".": "backend-clean-ddd" }, true);
  for (const [rel, text] of Object.entries(localRules(regex))) put(r, `.pregate/rules/${rel}`, text);
  recommit(r, (p) => {
    (p.sources as object[]).push({ ns: "local", kind: "path", path: ".pregate/rules" });
    (p.methodologies as string[]).push("local/naming");
  });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const made = { r, payload: payload(a.session, "PreToolUse", tool("Write", { file_path: at(r, "src/domain/names.ts"), content })) };
  local.set(regex, made);
  return made;
}

test("regex-limit: a regex that gives up denies and stops the turn, well before the watchdog", () => {
  const { r, payload } = withLocalRule(GIVES_UP);
  const o = run(["sh", LAUNCHER, ...PRE], r.dir, r.env, payload);
  const { reason, notice } = halted(o);
  expect(reason).toStartWith("PREGATE DENY regex-limit src/domain/names.ts:1: ");
  expect(notice).toStartWith("PREGATE cannot evaluate at src/domain/names.ts: a rule regex hit its backtracking limit");
  expect(o.ms).toBeLessThan(1_900);
});

for (const shell of ["sh", "bash", "dash"]) {
  test(`watchdog (${shell}): a hung engine is cut at 5 s and the call is denied`, () => {
    const { r, payload } = withLocalRule(HANGS);
    const o = run([shell, LAUNCHER, ...PRE], r.dir, r.env, payload);
    const reason = failedPre(o);
    expect(reason).toBe("PREGATE could not evaluate: the engine timed out after 5 s; last engine checkpoint: rules; executing rule: local/LOCAL-A-001; report it to the user");
    expect(o.ms).toBeGreaterThan(4_900);
    expect(o.ms).toBeLessThan(7_000);
  });
}

test("watchdog: SIGKILL to the engine and the launcher denies at once", async () => {
  const { r, payload } = withLocalRule(HANGS);
  const pidFile = join(TMP, "engine.pid");
  renameSync(ENGINE, `${ENGINE}.held`);
  writeFileSync(ENGINE, `#!/bin/sh\nprintf '%s' "$$" > '${pidFile}'\nexec '${ENGINE}.held' "$@"\n`, { mode: 0o755 });
  await killedEngineDenial(r, payload, pidFile);
});

async function killedEngineDenial(r: Repo, payload: string, pidFile: string): Promise<void> {
  try {
    const t = performance.now();
    const p = Bun.spawn(["sh", LAUNCHER, ...PRE], { cwd: r.dir, env: r.env, stdin: new TextEncoder().encode(payload), stdout: "pipe", stderr: "pipe" });
    let engine = "";
    while (engine === "" && performance.now() - t < 1_500) {
      if (existsSync(pidFile)) engine = readFileSync(pidFile, "utf8");
      else await Bun.sleep(5);
    }
    expect(engine).toMatch(/^\d+$/);
    process.kill(Number(engine), "SIGKILL");
    const [stdout, stderr, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    const reason = failedPre({ code, stdout, stderr, ms: 0 });
    expect(reason).toMatch(/^PREGATE could not evaluate: the engine failed \(exit 137\)(; last engine checkpoint: [a-z0-9-]+(?:; executing rule: local\/LOCAL-A-001)?)?; report it to the user$/);
    expect(performance.now() - t).toBeLessThan(1_900);
  } finally {
    rmSync(ENGINE);
    renameSync(`${ENGINE}.held`, ENGINE);
    rmSync(pidFile, { force: true });
  }
}

test("registered import metadata keeps malformed and binary stderr byte exact", () => {
  const r = repo({ ".": "backend-clean-ddd" }), s = claude(r).session;
  const metadata = "PREGATE-IMPORT-REVIEW rules=pack/ABC,other/id/leaf,more=2\nPREGATE-IMPORT-REVIEW completed=1.0ms\n";
  renameSync(ENGINE, `${ENGINE}.held`);
  importMetadataStderr(r, s, metadata);
});

function importMetadataStderr(r: Repo, s: Session, metadata: string): void {
  try {
    for (const text of ["", "PREGATE-IMPORT-REVIEW completed=1.00ms\n", "PREGATE-IMPORT-REVIEW rules=Pack/ABC\n", "PREGATE-IMPORT-REVIEW rules=pack/ABC\0suffix", "notice é\0secret\r\n"]) {
      const bytes = [...Buffer.from(metadata + text)].map(byte => `\\0${byte.toString(8).padStart(3, "0")}`).join("");
      writeFileSync(ENGINE, `#!/bin/sh\nprintf '%b' '${bytes}' >&2\nexit 0\n`, { mode: 0o755 });
      const out = hook(s, "PreToolUse", tool("Write", { file_path: at(r, "README.md"), content: "demo\n" }));
      expect(out.code).toBe(0); expect(out.stdout).toBe(""); expect(out.stderr).toBe(text);
    }
  } finally {
    rmSync(ENGINE, { force: true });
    renameSync(`${ENGINE}.held`, ENGINE);
  }
}

// §4.0 measured +0.8–6.7 ms (O12); the bound only catches a launcher that waits on something.
for (const shell of ["sh", "bash", "dash"]) {
  test(`launcher (${shell}): supervision costs a few ms over running the engine directly`, () => {
    const r = repo({ ".": "backend-clean-ddd" });
    const quiet = payload(claude(r).session, "PreToolUse", tool("Write", { file_path: at(r, "README.md"), content: "demo\n" }));
    const ms = (cmd: string[]): number => {
      const o = run(cmd, r.dir, r.env, quiet);
      silent(o);
      return o.ms;
    };
    // Interleave matched samples so load drift between batches is not measured as launcher cost.
    const samples = Array.from({ length: 15 }, (_, i) => {
      if (i % 2 === 0) {
        const direct = ms([ENGINE, ...PRE]);
        return { direct, supervised: ms([shell, LAUNCHER, ...PRE]) };
      }
      const supervised = ms([shell, LAUNCHER, ...PRE]);
      return { direct: ms([ENGINE, ...PRE]), supervised };
    });
    const overhead = samples.map(sample => sample.supervised - sample.direct);
    const median = (xs: number[]): number => xs.sort((x, y) => x - y)[xs.length >> 1]!;
    console.log(JSON.stringify({ launcherOverhead: { shell, samples, medianMs: median([...overhead]) } }));
    expect(median(overhead)).toBeLessThan(20);
  });
}

// ── Shell guard on real roots ──────────────────────────────────────────────────────────────

test("shell: absolute destinations in scope are denied, outside every root allowed", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  expect(denied(a.bash(`printf 'export {};\\n' > ${at(r, "src/domain/x.ts")}`))).toStartWith("PREGATE DENY shell-write");
  expect(denied(a.bash(`cp ${at(r, INVOICE_REL)} ${at(r, "src/infra/copy.ts")}`))).toStartWith("PREGATE DENY shell-write");
  silent(a.bash(`printf 'x\\n' > ${join(TMP, "outside.txt")}`));
});

test("shell: a directory written whole is a write to everything below it", () => {
  const a = claude(repo({ ".": "backend-clean-ddd" }));
  ok(a.start(), "SessionStart");
  expect(denied(a.bash("git checkout -- ."))).toStartWith("PREGATE DENY shell-write");
  expect(denied(a.bash(`cp -R ${join(DEMO, "src")} .`))).toStartWith("PREGATE DENY shell-write");
  expect(denied(a.bash(`cp -R ${join(DEMO, "src/domain")} src`))).toStartWith("PREGATE DENY shell-write");
  silent(a.bash(`cp -R src ${join(TMP, "copy-of-src")}`));
});

// ── Several roots ──────────────────────────────────────────────────────────────────────────

test("roots: a sibling root is judged by its own preset, from the edit tools and from the shell", () => {
  const a = claude(repo({ a: "backend-clean-ddd", b: "functional-ts" }), { project: "a" });
  ok(a.start(), "SessionStart");
  expect(denied(a.write(`b/${INVOICE_REL}`, CLOCK))).toStartWith(`PREGATE DENY architecture/FCIS-IO-002 ${INVOICE_REL}:`);
  silent(a.write(`b/${INVOICE_REL}`, SETTER));
  expect(denied(a.write(`a/${INVOICE_REL}`, SETTER))).toStartWith(`PREGATE DENY ddd/DDD-ENT-001 ${INVOICE_REL}:`);
  expect(denied(a.bash("printf 'export {};\\n' > ../b/src/domain/x.ts"))).toStartWith("PREGATE DENY shell-write");
  expect(denied(a.bash("cp src/domain/invoice.ts ../b/src/domain/invoice.ts"))).toStartWith("PREGATE DENY shell-write");
});

test("roots: a nested root seen from its parent is judged by its own lock, and the parent skips its files", () => {
  const r = repo({ ".": "backend-clean-ddd", "src/pkg": "functional-ts" });
  const a = claude(r);
  ok(a.start(), "SessionStart");
  const nested = `src/pkg/${INVOICE_REL}`;
  expect(denied(a.write(nested, CLOCK))).toStartWith(`PREGATE DENY architecture/FCIS-IO-002 ${INVOICE_REL}:`);
  silent(a.write(nested, SETTER));   // DDD-ENT-001 is the parent's rule, and src/** is the parent's scope
  put(r, nested, SETTER);
  expect(denied(a.write(INVOICE_REL, SETTER))).toStartWith(`PREGATE DENY ddd/DDD-ENT-001 ${INVOICE_REL}:`);
  expect(denied(a.bash("printf 'export {};\\n' > src/pkg/src/domain/x.ts"))).toStartWith("PREGATE DENY shell-write");
  silent(a.stop());
});

// ── install ───────────────────────────────────────────────────────────────────────────────

const OTHER_HOOK = { matcher: "Bash", hooks: [{ type: "command", command: "echo other" }] };

// A repo whose settings.json has its own hook and whose git hooks live in .githooks.
function installed(): Repo {
  const r: Repo = { dir: join(TMP, "repos", randomUUID()), env: envOf() };
  cpSync(DEMO, r.dir, { recursive: true });
  put(r, ".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: { PreToolUse: [OTHER_HOOK] } }));
  put(r, ".githooks/pre-commit", "#!/bin/sh\nexit 0\n");
  put(r, ".pregate/preset.json", policyFixture(readFileSync(join(PRESETS, "backend-clean-ddd.json"), "utf8")));
  ok(git(r, "init", "-q"), "git init");
  ok(run([BIN, "preset", "compile"], r.dir, r.env), "preset compile");
  const out = ok(run([BIN, "install", "--git-hook"], r.dir, r.env), "install");
  expect(out.stdout).toContain("This repo already manages hooks (.githooks); core.hooksPath unchanged.");
  return r;
}

test("install keeps another hook in settings.json and the repo's .githooks", () => {
  const r = installed();
  const settings = JSON.parse(read(r, ".claude/settings.json")) as { permissions: unknown; hooks: Record<string, unknown[]> };
  expect(settings.permissions).toEqual({ allow: ["Bash(ls)"] });
  expect(settings.hooks.PreToolUse).toEqual([OTHER_HOOK]);
  expect(existsSync(at(r, ".pregate/bin/pregate"))).toBe(false);
  expect(read(r, ".githooks/pre-commit")).toBe("#!/bin/sh\nexit 0\n");
  expect(git(r, "config", "--get", "core.hooksPath").code).toBe(1);
  expect(existsSync(join(r.env.XDG_DATA_HOME!, "pregate", pkg.version, "pregate"))).toBe(true);
});

test("install run twice writes the same settings", () => {
  const r = installed();
  const text = read(r, ".claude/settings.json");
  ok(run([BIN, "install", "--git-hook"], r.dir, r.env), "install");
  expect(read(r, ".claude/settings.json")).toBe(text);
});

// Fresh session and tool ids: no SessionStart, so the session has not registered a root.
// The hook still runs with the project's cwd, which is what an agent tool call looks like.
test("hook pre denies interpreter, script, Makefile and harness-settings bypasses", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  const home = r.env.HOME!;
  const settings = join(home, ".claude/settings.json");
  const beforeSettings = readFileSync(settings, "utf8");
  const launcher = join(home, ".local/bin/pregate");
  const beforeLauncher = readFileSync(launcher, "utf8");
  const harness = [
    settings,
    join(home, ".claude/settings.local.json"),
    join(r.env.CODEX_HOME!, "hooks.json"),
    join(r.env.CODEX_HOME!, "config.toml"),
    join(r.env.GROK_HOME!, "config.toml"),
    join(home, ".cursor/hooks.json"),
    join(home, ".cursor/cli-config.json"),
    join(home, ".gemini/config/config.json"),
    join(home, ".gemini/config/hooks.json"),
    launcher,
    join(r.env.XDG_DATA_HOME!, "pregate/bin/pregate"),
  ];
  for (const path of harness) {
    expect(denied(a.write(path, "{}\n")), path).toContain("protected-path");
    expect(denied(hook(a.session, "PreToolUse", tool("Edit", {
      file_path: path, old_string: "hooks", new_string: "disabled",
    }))), path).toContain("protected-path");
  }
  expect(readFileSync(settings, "utf8")).toBe(beforeSettings);
  expect(readFileSync(launcher, "utf8")).toBe(beforeLauncher);

  const inline = [
    `python3 -c "subprocess.run(['pregate','approve','x'])"`,
    `python3 -c "subprocess.run(['pregate','disable'])"`,
    `python3 -c "subprocess.run(['pregate','uninstall'])"`,
    `node -e "execSync('pregate approve x')"`,
    `perl -e 'system("pregate","approve","x")'`,
    `ruby -e 'system("pregate","disable")'`,
    `php -r 'system("pregate uninstall");'`,
  ];
  for (const command of inline) expect(denied(a.bash(command)), command).toMatch(/shell-admin|hook-switch/);

  expect(denied(a.write("run.sh", "#!/bin/sh\npregate approve x\n"))).toContain("shell-admin");
  expect(existsSync(at(r, "run.sh"))).toBe(false);
  expect(denied(a.write("Makefile", "approve:\n\tpregate approve x\n"))).toContain("shell-admin");
  expect(existsSync(at(r, "Makefile"))).toBe(false);

  writeFileSync(at(r, "run.sh"), "#!/bin/sh\npregate approve x\n");
  writeFileSync(at(r, "Makefile"), "approve:\n\tpregate approve x\nall:\n\techo ok\n");
  expect(denied(a.bash("bash ./run.sh"))).toContain("shell-admin");
  expect(denied(a.bash("./run.sh"))).toContain("shell-admin");
  expect(denied(a.bash("make approve"))).toContain("shell-admin");
  expect(denied(a.bash("make -f Makefile approve"))).toContain("shell-admin");

  writeFileSync(at(r, "run-ok.sh"), "#!/bin/sh\necho hello\n");
  writeFileSync(at(r, "Makefile"), "all:\n\techo ok\n");
  silent(a.bash("bash ./run-ok.sh"));
  silent(a.bash("make all"));
  silent(a.bash(`python3 -c "print(1 + 1)"`));
  silent(a.bash(`node -e "console.log(1)"`));
  silent(a.bash(`perl -e 'print 1'`));
  silent(a.bash("pregate status"));
  silent(a.bash("pregate guide --preview"));
  silent(a.write("src/domain/note.ts", "export const note = 1;\n"));

  const shadow = JSON.stringify({ ...JSON.parse(read(r, ".pregate/preset.json")), enforcement: "shadow" });
  expect(a.write(".pregate/preset.json", shadow).code).toBe(2);
  for (const args of [["approve", "--preview"], ["guide", "--preview"], ["status", "--json"]]) {
    const hidden = run(["pregate", ...args], r.dir, { ...r.env, CI: "", PREGATE_UNATTENDED_APPROVAL: "" });
    expect(hidden.code, args.join(" ")).toBe(0);
    expect(hidden.stdout, args.join(" ")).not.toMatch(/Digest: [0-9a-f]{64}/);
    expect(hidden.stdout, args.join(" ")).not.toMatch(/pregate approve [0-9a-f]{12,64}/);
    expect(hidden.stdout, args.join(" ")).not.toMatch(/"pendingApproval": "[0-9a-f]{12,64}"/);
  }
  const shown = revealed(r, "approve", "--preview");
  expect(shown.stdout).toMatch(/Digest: [0-9a-f]{64}/);
  expect(shown.stdout).toMatch(/pregate approve [0-9a-f]{12}/);
  expect(run(["pregate", "approve", "--preview"], r.dir, { ...r.env, CI: "", PREGATE_UNATTENDED_APPROVAL: "" }).stdout).toContain("withheld");
});

test("a recomputed digest cannot approve without a terminal, and a human TTY confirmation can", () => {
  const r = repo({ ".": "backend-clean-ddd" });
  const a = claude(r);
  const before = read(r, ".pregate/pregate.lock.json");
  const shadow = JSON.stringify({ ...JSON.parse(read(r, ".pregate/preset.json")), enforcement: "shadow" });
  expect(a.write(".pregate/preset.json", shadow).code).toBe(2);
  const proposals = join(DATA, "pregate/proposals");
  const file = readdirSync(proposals).map((name) => join(proposals, name)).find((path) => {
    try { return JSON.parse(readFileSync(path, "utf8")).root === r.dir; } catch { return false; }
  });
  if (file === undefined) throw new Error("pending proposal was not written");
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
  const agent = { ...r.env, CI: "", PREGATE_UNATTENDED_APPROVAL: "", PREGATE_TESTING: "" };
  for (const args of [["approve", "--yes", "--digest", digest], ["approve", digest]]) {
    const piped = run(["pregate", ...args], r.dir, agent, "y\n");
    expect(piped.code, args.join(" ")).toBe(1);
    expect(piped.stdout + piped.stderr, args.join(" ")).toContain("interactive stdin");
    expect(read(r, ".pregate/pregate.lock.json")).toBe(before);
  }
  const declined = ptyRun(["pregate", "approve", digest], r.dir, agent, "n");
  expect(declined.code, declined.stdout + declined.stderr).toBe(1);
  expect(read(r, ".pregate/pregate.lock.json")).toBe(before);
  const human = ptyRun(["pregate", "approve", digest], r.dir, agent, "y");
  expect(human.code, human.stdout + human.stderr).toBe(0);
  expect(read(r, ".pregate/pregate.lock.json")).not.toBe(before);
  expect(JSON.parse(read(r, ".pregate/pregate.lock.json")).enforcement).toBe("shadow");

  // Reads are not hooked (MH-22): the digest is in the proposal file, and knowing it is not approval.
  const matcher = JSON.parse(readFileSync(join(r.env.HOME!, ".claude/settings.json"), "utf8")) as {
    hooks: { PreToolUse: { matcher: string }[] };
  };
  expect(matcher.hooks.PreToolUse[0]!.matcher).not.toMatch(/\b(Read|Grep|Glob)\b/);
});

// A real terminal: stdin is a pty, and the confirmation is typed on that pty's /dev/tty.
function ptyRun(cmd: string[], cwd: string, env: Env, answer: string): Out {
  const py = `
import os, pty, select, sys, time
answer = os.environ["PREGATE_PTY_ANSWER"].encode() + b"\\n"
cwd = os.environ["PREGATE_PTY_CWD"]
cmd = sys.argv[1:]
pid, fd = pty.fork()
if pid == 0:
    os.chdir(cwd)
    os.execvpe(cmd[0], cmd, os.environ)
buf = b""
sent = False
status = None
start = time.time()
while time.time() - start < 45:
    try:
        ready, _, _ = select.select([fd], [], [], 0.2)
    except InterruptedError:
        continue
    if ready:
        try:
            chunk = os.read(fd, 1 << 16)
        except OSError:
            chunk = b""
        if not chunk:
            break
        buf += chunk
        if not sent and b"Approve?" in buf:
            os.write(fd, answer)
            sent = True
    try:
        wpid, st = os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:
        break
    if wpid:
        status = st
        break
else:
    os.kill(pid, 9)
    _, status = os.waitpid(pid, 0)
while True:
    try:
        ready, _, _ = select.select([fd], [], [], 0.05)
    except InterruptedError:
        continue
    if not ready:
        break
    try:
        chunk = os.read(fd, 1 << 16)
    except OSError:
        break
    if not chunk:
        break
    buf += chunk
if status is None:
    _, status = os.waitpid(pid, 0)
sys.stdout.buffer.write(buf)
raise SystemExit(os.waitstatus_to_exitcode(status))
`;
  const t = performance.now();
  const r = Bun.spawnSync(["python3", "-c", py, ...cmd], {
    cwd, env: { ...env, PREGATE_PTY_ANSWER: answer, PREGATE_PTY_CWD: cwd }, stdout: "pipe", stderr: "pipe",
  });
  return { code: r.exitCode ?? -1, stdout: r.stdout.toString(), stderr: r.stderr.toString(), ms: performance.now() - t };
}
