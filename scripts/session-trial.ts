// The session trial: ordinary tasks given to real agent CLIs, once with Pregate installed and once
// without, and what the gate denied, what the agent repaired, and what each arm left in the tree.
// The method and its limits are on the page this script writes (docs/benchmarks/session-trial.md).
//
// Usage:
//   bun scripts/session-trial.ts --plan [selection]          what would run and how many model sessions; runs nothing
//   bun scripts/session-trial.ts --self-check                the whole pipeline with a scripted stand-in for the CLIs; no model
//   PREGATE_REAL=1 bun scripts/session-trial.ts [selection] [--out <dir>]    real sessions; spends model calls
//   bun scripts/session-trial.ts --page [<evidence-dir>]     rewrite the page and session-trial.json; with no directory, the page of "no run yet"
// selection: [--harness claude-code|codex …] [--repo <id> …] [--task <id> …] [--arms gated,control]
//
// A real run writes nothing in the real home. HOME, XDG_*, CODEX_HOME and TMPDIR of every child point
// into one folder under /private/tmp/claude-501/. The real home is only read: Codex's auth.json is
// copied with its refresh token blanked, and Claude Code reaches the macOS keychain through a symlink.
// Both are removed at the end. PREGATE_AUTH_HOME names the real home when the runner's own HOME is not it.
//
// machine(), seed(), copyAuth(), blankRefresh(), tapIn() and the headless argv are copied from
// scripts/e2e-real.ts, which this script must not import: that file runs its scenarios on import.
import { chmodSync, closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { ENGINE_FILE } from "../src/platform.ts";
import type { CallEvent } from "../src/types.ts";
import { compileBinary, hostTarget } from "./build.ts";
import {
  type Arm, classify, EMPTY, type HookCall, type Label, type Manifest, type NoNew, page, plan, type Planned, planText, type Repository, type Run,
  sarifFindings, type Selection, type Session, summarize, type Summary, type TrialHarness, type Verify,
} from "./session-trial-evidence.ts";
import { FAKE_PROMPT } from "./session-trial-fake.ts";

type Env = Record<string, string>;
interface Out { code: number | null; stdout: string; stderr: string }
// One isolated machine: a home of its own, with or without Pregate installed in it.
interface Machine { home: string; codexHome: string; state: string; data: string; env: Env }
export interface Setup {
  kind: Run["kind"]; work: string; out: string; engine: string; path: string; bins: Record<TrialHarness, string>;
  manifest: Manifest; authHome: string | null; timeoutMs: number;
}
interface Trial extends Setup { gated: Machine; control: Machine; run: Run; contracts: Map<string, { preset: string; lock: string }> }
interface Mark { state: Set<string>; tap: Set<string> }

const ROOT = resolve(import.meta.dir, "..");
const BENCH = join(ROOT, "docs", "benchmarks");
const TASKS = join(BENCH, "session-trial-tasks.json");
const LABELS = join(BENCH, "session-trial-labels.json");
const TIMEOUT_MS = 600_000;
const CONTRACT = [".pregate/preset.json", ".pregate/pregate.lock.json"] as const;
const CLIS: Record<TrialHarness, { bin: string; headless: (prompt: string) => string[] }> = {
  "claude-code": { bin: "claude", headless: (p) => ["-p", p, "--permission-mode", "acceptEdits", "--output-format", "stream-json", "--verbose"] },
  // The isolated machine already confines the run; a nested macOS sandbox rejects even scratch writes (see e2e-real.ts).
  codex: { bin: "codex", headless: (p) => ["exec", "--json", "-s", "danger-full-access", p] },
};

function run(cmd: string[], cwd: string, env: Env): Out {
  const r = Bun.spawnSync(cmd, { cwd, env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 180_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function ok(o: Out, what: string): Out {
  if (o.code !== 0) throw new Error(`${what} exited ${o.code}\n${o.stdout}${o.stderr}`);
  return o;
}

const read = (path: string): string | null => (existsSync(path) ? readFileSync(path, "utf8") : null);
const writeJson = (path: string, value: unknown): void => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => relative(dir, join(d.parentPath, d.name)));
}

// ── The machines ─────────────────────────────────────────────────────────────────────────

function machine(work: string, name: string, path: string): Machine {
  const home = join(work, name, "home");
  const xdg = { XDG_DATA_HOME: join(home, ".local/share"), XDG_STATE_HOME: join(home, ".local/state"), XDG_CONFIG_HOME: join(home, ".config"), XDG_CACHE_HOME: join(home, ".cache") };
  const codexHome = join(home, ".codex");
  for (const d of [...Object.values(xdg), codexHome, join(home, ".claude"), join(home, "Library"), join(work, name, "tmp")]) mkdirSync(d, { recursive: true });
  const env: Env = {
    PATH: `${home}/.local/bin:${path}`, HOME: home, USER: userInfo().username, LOGNAME: userInfo().username, SHELL: "/bin/zsh", LANG: "en_US.UTF-8", TERM: "dumb",
    TMPDIR: join(work, name, "tmp"), ...xdg, CODEX_HOME: codexHome, GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "trial", GIT_AUTHOR_EMAIL: "trial@example.invalid",
    GIT_COMMITTER_NAME: "trial", GIT_COMMITTER_EMAIL: "trial@example.invalid", DISABLE_AUTOUPDATER: "1",
    // Claude Code's documented headless credential, when the keychain does not serve it.
    ...(process.env.CLAUDE_CODE_OAUTH_TOKEN ? { CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN } : {}),
  };
  return { home, codexHome, state: join(xdg.XDG_STATE_HOME, "pregate"), data: join(xdg.XDG_DATA_HOME, "pregate"), env };
}

function blankRefresh(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(blankRefresh);
  if (v === null || typeof v !== "object") return v;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /^refresh_?token$/i.test(k) ? "" : blankRefresh(x)]));
}

// A long run may outlive an access token. Re-read the real credentials before each Codex session and
// never rotate them: the refresh token stays blank in every scratch copy.
function copyAuth(m: Machine, authHome: string | null, required: boolean): void {
  if (authHome === null) return;
  const real = join(authHome, ".codex/auth.json");
  if (!existsSync(real)) {
    if (required) throw new Error(`no Codex credentials at ${real}; log in with the real CLI, or leave codex out with --harness claude-code`);
    return;
  }
  writeFileSync(join(m.codexHome, "auth.json"), JSON.stringify(blankRefresh(JSON.parse(readFileSync(real, "utf8")))), { mode: 0o600 });
}

// Codex credentials are copied whenever they exist, also for a run without Codex sessions: `pregate
// setup` registers every CLI on PATH and records Codex hook trust through `codex app-server`.
function seed(m: Machine, authHome: string | null, harnesses: TrialHarness[]): void {
  writeFileSync(join(m.home, ".claude.json"), JSON.stringify({ hasCompletedOnboarding: true, projects: {} }));
  if (authHome === null) return;
  symlinkSync(join(authHome, "Library/Keychains"), join(m.home, "Library/Keychains"));
  copyAuth(m, authHome, harnesses.includes("codex"));
}

function unseed(m: Machine): void {
  for (const f of [join(m.codexHome, "auth.json"), join(m.home, "Library/Keychains")]) rmSync(f, { force: true });
}

// `pregate setup` in the gated machine, then the engine behind the launcher is wrapped to keep each
// hook call's payload and argv in tap/: the payload is where the tool name is, and the count of the
// files is the count of hook calls.
function install(t: Trial, harnesses: TrialHarness[]): void {
  ok(run([t.engine, "setup"], t.gated.home, t.gated.env), "pregate setup");
  const marker = `${t.gated.data}/bin/pregate'`;
  const registration: Record<TrialHarness, string> = { "claude-code": join(t.gated.home, ".claude/settings.json"), codex: join(t.gated.codexHome, "hooks.json") };
  for (const h of harnesses) if (read(registration[h])?.includes(marker) !== true) throw new Error(`pregate setup registered no hook for ${h} in ${registration[h]}`);
  const version = ok(run([join(t.gated.home, ".local/bin/pregate"), "--version"], t.gated.home, t.gated.env), "pregate --version").stdout.trim().split(" ")[1]!;
  const engine = join(t.gated.data, version, ENGINE_FILE);
  renameSync(engine, `${engine}.real`);
  writeFileSync(engine, `#!/bin/sh\ncase "\${1-}" in hook|"") ;; *) exec '${engine}.real' "$@" ;; esac\n`
    + `n=$(/usr/bin/mktemp '${join(t.work, "tap")}/XXXXXXXX') || exit 1\n`
    + `printf '%s\\n' "$*" > "$n.args"\n/bin/cat > "$n"\nexec '${engine}.real' "$@" < "$n"\n`);
  chmodSync(engine, 0o755);
}

// ── Repositories and contracts ───────────────────────────────────────────────────────────

// A fresh clone at the pinned commit, with no remote. The network is used once per repository; each
// session clones from that local copy.
function fresh(t: Trial, repo: Repository, label: string): string {
  const source = join(t.work, "sources", repo.id), dir = join(t.work, "repos", label);
  const at = (where: string, from: string): void => {
    ok(run(["git", "clone", "-q", from, where], t.work, t.gated.env), `git clone ${repo.id}`);
    ok(run(["git", "checkout", "-q", "--detach", repo.commit], where, t.gated.env), `git checkout ${repo.commit}`);
    if (run(["git", "rev-parse", "HEAD"], where, t.gated.env).stdout.trim() !== repo.commit) throw new Error(`${repo.id}: HEAD is not ${repo.commit}`);
  };
  if (!existsSync(source)) at(source, repo.url);
  at(dir, source);
  ok(run(["git", "remote", "remove", "origin"], dir, t.gated.env), "git remote remove");
  return dir;
}

// The contract the guide proposes for the repository as it is, approved for this scratch machine.
// Approval without a terminal needs PREGATE_UNATTENDED_APPROVAL=1; no agent process gets that variable.
function approve(t: Trial, dir: string): string {
  const env = { ...t.gated.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  const review = run([t.engine, "guide", "--preview", "--enforcement", "enforce"], dir, env);
  const digest = (review.stdout + review.stderr).match(/Digest: ([0-9a-f]{64})/)?.[1];
  if (digest === undefined) throw new Error(`the guide proposed no contract to approve:\n${review.stdout}${review.stderr}`);
  ok(run([t.engine, "approve", "--yes", "--digest", digest], dir, env), "pregate approve");
  return review.stdout + review.stderr;
}

const contractOf = (dir: string): { preset: string; lock: string } => ({ preset: readFileSync(join(dir, CONTRACT[0]), "utf8"), lock: readFileSync(join(dir, CONTRACT[1]), "utf8") });

// One reference contract per repository. The gated sessions approve the same proposal in their own
// clone; the control sessions get these two files after the session, for the final check only.
function reference(t: Trial, repo: Repository): void {
  if (t.contracts.has(repo.id)) return;
  const dir = fresh(t, repo, `contract.${repo.id}`);
  const review = approve(t, dir);
  t.contracts.set(repo.id, contractOf(dir));
  const line = (name: string) => review.match(new RegExp(`^${name}: (.*)$`, "m"))?.[1] ?? "not stated";
  t.run.contracts[repo.id] = { packs: line("Packs"), rules: line("Rules") };
}

// ── One session ──────────────────────────────────────────────────────────────────────────

const marked = (t: Trial): Mark => ({ state: new Set(files(t.gated.state)), tap: new Set(files(join(t.work, "tap"))) });

async function agent(t: Trial, s: Planned, repo: string): Promise<{ out: Out; wallMs: number; timedOut: boolean }> {
  const m = s.arm === "gated" ? t.gated : t.control;
  if (s.harness === "codex") copyAuth(m, t.authHome, true);
  // Files and not pipes: a child that outlives a killed CLI would hold a pipe open.
  const paths = [join(t.out, "sessions", `${s.id}.stdout`), join(t.out, "sessions", `${s.id}.stderr`)] as const;
  const fds = paths.map((path) => openSync(path, "w"));
  const started = performance.now();
  let timedOut = false;
  try {
    const p = Bun.spawn([t.bins[s.harness], ...CLIS[s.harness].headless(s.task.prompt)], { cwd: repo, env: m.env, stdin: "ignore", stdout: fds[0], stderr: fds[1] });
    const timer = setTimeout(() => {
      timedOut = true;
      Bun.spawnSync(["/usr/bin/pkill", "-KILL", "-P", String(p.pid)]);
      p.kill("SIGKILL");
    }, t.timeoutMs);
    await p.exited;
    clearTimeout(timer);
    const out = { code: p.signalCode === null ? p.exitCode : null, stdout: readFileSync(paths[0], "utf8"), stderr: readFileSync(paths[1], "utf8") };
    return { out, wallMs: Math.round(performance.now() - started), timedOut };
  } finally {
    for (const fd of fds) closeSync(fd);
  }
}

// What the engine recorded during the session: the new event files of its state folder, each with
// the tool name of the payload that carried the same call id. The denied content is copied next to
// the evidence, for the person who labels the denial.
function recorded(t: Trial, s: Planned, repo: string, mark: Mark): Pick<Session, "hooks" | "hookCalls"> {
  const tapDir = join(t.work, "tap");
  const taps = files(tapDir).filter((f) => !f.endsWith(".args") && !mark.tap.has(f)).map((f) => ({ sub: (read(join(tapDir, `${f}.args`)) ?? "").split(" ")[1] ?? "", payload: parsed(read(join(tapDir, f)) ?? "") }));
  const tool = (callId: string): string | null => {
    const hit = taps.find((x) => typeof x.payload?.tool_use_id === "string" && (callId === x.payload.tool_use_id || callId.startsWith(`${x.payload.tool_use_id}~`)));
    return typeof hit?.payload?.tool_name === "string" ? hit.payload.tool_name : null;
  };
  const events = files(t.gated.state).filter((f) => !mark.state.has(f) && /^sessions\/[^/]+\/events\/.*\.json$/.test(f))
    .map((f) => ({ folder: join(t.gated.state, f.split("/").slice(0, 2).join("/")), event: JSON.parse(readFileSync(join(t.gated.state, f), "utf8")) as CallEvent }))
    .sort((a, b) => a.event.at - b.event.at);
  const hooks = events.map(({ folder, event }, index): HookCall => ({
    at: event.at, event: event.kind, tool: tool(event.callId), path: event.path === null ? null : event.path.startsWith(`${repo}/`) ? event.path.slice(repo.length + 1) : event.path,
    decision: event.verdict === "none" ? "allow" : event.verdict, shadowed: event.shadowed, cause: event.form,
    findings: event.violations.map((v) => ({ rule: v.rule, path: v.path, line: v.line })), message: event.verdict === "none" ? null : event.message ?? null,
    evaluationMs: event.evaluationMs ?? null, deniedContent: event.verdict === "none" ? null : keep(t, s, join(folder, "blobs", event.afterSha ?? "-"), index),
  }));
  const of = (sub: string) => taps.filter((x) => x.sub === sub).length;
  return { hooks, hookCalls: { total: taps.length, pre: of("pre"), stop: of("stop"), sessionStart: of("session-start") } };
}

function keep(t: Trial, s: Planned, blob: string, index: number): string | null {
  if (!existsSync(blob)) return null;
  const name = `${s.id}.denied-${index}.txt`;
  copyFileSync(blob, join(t.out, "sessions", name));
  return name;
}

function parsed(text: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(text);
    return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;   // fail-closed: a payload that is not JSON names no tool
  }
}

// The "no new debt" check on the final tree, with the engine that the gated arm runs.
function noNew(t: Trial, s: Planned, repo: string): NoNew {
  const o = run([t.engine, "check", "--ratchet", "--base", s.repo.commit, "--format", "sarif"], repo, t.gated.env);
  const all = sarifFindings(o.stdout);
  if (all === null) return { ran: false, exit: o.code, findings: [], error: (o.stdout + o.stderr).trim().slice(0, 2000) };
  return { ran: true, exit: o.code, findings: all.filter((f) => f.level === "error"), advisories: all.filter((f) => f.level !== "error"), error: null };
}

// The final tree against the pinned commit, without the contract folder. Everything is staged first,
// so files the agent created and files it committed are both in the diff.
function tree(t: Trial, s: Planned, repo: string): { changed: string[]; diff: string } {
  ok(run(["git", "add", "-A"], repo, t.gated.env), "git add");
  const against = (...flags: string[]) => ok(run(["git", "diff", "--cached", ...flags, s.repo.commit, "--", ".", ":(exclude).pregate"], repo, t.gated.env), "git diff").stdout;
  const name = `${s.id}.diff`;
  writeFileSync(join(t.out, "sessions", name), against());
  return { changed: against("--name-only").split("\n").filter((line) => line !== ""), diff: name };
}

function verified(t: Trial, s: Planned, repo: string): Verify {
  if (s.task.verify === null) return "not-verified";
  const env = (s.arm === "gated" ? t.gated : t.control).env;
  return run(["/bin/sh", "-c", s.task.verify], repo, env).code === 0 ? "pass" : "fail";
}

async function session(t: Trial, s: Planned): Promise<Session> {
  reference(t, s.repo);
  const repo = fresh(t, s.repo, s.id), contract = t.contracts.get(s.repo.id)!;
  let matches: boolean | null = null;
  if (s.arm === "gated") {
    approve(t, repo);
    const mine = contractOf(repo);
    matches = mine.preset === contract.preset && mine.lock === contract.lock;
  }
  const mark = marked(t);
  const ran = await agent(t, s, repo);
  const engine = s.arm === "gated" ? recorded(t, s, repo, mark) : { hooks: [], hookCalls: null };
  if (s.arm === "control") {
    mkdirSync(join(repo, ".pregate"), { recursive: true });
    writeFileSync(join(repo, CONTRACT[0]), contract.preset);
    writeFileSync(join(repo, CONTRACT[1]), contract.lock);
  }
  const final = noNew(t, s, repo), verify = verified(t, s, repo), left = tree(t, s, repo);
  const result: Session = {
    id: s.id, harness: s.harness, cliVersion: t.run.cli[s.harness] ?? "", model: ran.out.stdout.match(/"model"\s*:\s*"([^"]+)"/)?.[1] ?? null,
    arm: s.arm, repo: s.repo.id, commit: s.repo.commit, task: s.task.id, wallMs: ran.wallMs, exitCode: ran.out.code, timedOut: ran.timedOut,
    contractMatchesReference: matches, ...engine, denials: classify(engine.hooks, left.changed, final.ran ? final.findings : null),
    noNew: final, verify, changed: left.changed, diff: left.diff,
  };
  writeJson(join(t.out, "sessions", `${s.id}.json`), result);
  return result;
}

// ── The run ──────────────────────────────────────────────────────────────────────────────

// Runs the sessions one after the other and returns the evidence directory.
export async function trial(setup: Setup, sessions: Planned[]): Promise<string> {
  const harnesses = [...new Set(sessions.map((s) => s.harness))];
  for (const d of ["tap", "repos", "sources"]) mkdirSync(join(setup.work, d), { recursive: true });
  mkdirSync(join(setup.out, "sessions"), { recursive: true });
  const t: Trial = {
    ...setup, gated: machine(setup.work, "gated", setup.path), control: machine(setup.work, "control", setup.path), contracts: new Map(),
    run: { schemaVersion: 1, kind: setup.kind, id: new Date().toISOString(), engine: pkg.version, platform: `${process.platform} ${process.arch}`, cli: {}, contracts: {}, sessions: [] },
  };
  try {
    for (const m of [t.gated, t.control]) seed(m, t.authHome, harnesses);
    for (const h of harnesses) t.run.cli[h] = run([t.bins[h], "--version"], t.control.home, t.control.env).stdout.trim();
    install(t, harnesses);
    for (const s of sessions) {
      console.log(`session ${s.id}`);
      const done = await session(t, s);
      t.run.sessions.push(done.id);
      writeJson(join(t.out, "trial.json"), t.run);
      console.log(`  exit ${done.timedOut ? "timed out" : done.exitCode}, ${Math.round(done.wallMs / 1000)} s, ${done.hooks.length} recorded decisions, ${done.denials.length} denials, ${done.noNew.ran ? done.noNew.findings.length : "no"} new findings, verify ${done.verify}`);
    }
  } finally {
    unseed(t.gated);
    unseed(t.control);
  }
  return t.out;
}

export function load(dir: string): { run: Run; sessions: Session[] } {
  const run = JSON.parse(readFileSync(join(dir, "trial.json"), "utf8")) as Run;
  return { run, sessions: run.sessions.map((id) => JSON.parse(readFileSync(join(dir, "sessions", `${id}.json`), "utf8")) as Session) };
}

export const manifest = (): Manifest => JSON.parse(readFileSync(TASKS, "utf8")) as Manifest;
export const labels = (): Label[] => (JSON.parse(readFileSync(LABELS, "utf8")) as { labels: Label[] }).labels;

// The two published files for an evidence directory, or for no run when the directory is null.
// Self-check evidence is never published: its numbers are not trial results.
export function published(dir: string | null): [string, string][] {
  const selection = manifest().selection;
  let summary: Summary = { ...EMPTY, selection };
  if (dir !== null) {
    const evidence = load(dir);
    if (evidence.run.kind !== "real") throw new Error(`${dir} holds self-check evidence. It is not trial data and is not published.`);
    summary = summarize(evidence.run, selection, evidence.sessions, labels());
  }
  return [[join(BENCH, "session-trial.json"), `${JSON.stringify(summary, null, 2)}\n`], [join(BENCH, "session-trial.md"), page(summary)]];
}

// ── Self-check ───────────────────────────────────────────────────────────────────────────

const SCRATCH: Record<string, string> = {
  "package.json": `${JSON.stringify({ name: "trial-scratch", type: "module", version: "1.0.0" }, null, 2)}\n`,
  "tsconfig.json": '{"compilerOptions":{"strict":true},"include":["src"]}\n',
  "src/index.ts": "export function total(lines: number[]): number {\n  return lines.reduce((sum, line) => sum + line, 0);\n}\n",
};
const SCRATCH_VERIFY = `bun -e 'import { parseCount } from "./src/parse.ts"; import { formatCount } from "./src/format.ts"; if (parseCount("7") !== 7 || formatCount(2) !== "2 items") process.exit(1)'`;

// A machine PATH that holds the stand-ins, bun and git, and no real agent CLI: `pregate setup`
// registers a hook for every CLI it finds on PATH.
function standIns(work: string): { path: string; bins: Record<TrialHarness, string> } {
  const bin = join(work, "bin"), fake = join(import.meta.dir, "session-trial-fake.ts"), appServer = join(ROOT, "test", "fixtures", "codex-app-server.ts");
  mkdirSync(bin, { recursive: true });
  for (const [name, target] of [["bun", process.execPath], ["git", Bun.which("git")]] as const) {
    if (target === null) throw new Error(`${name} is not on the PATH`);
    symlinkSync(target, join(bin, name));
  }
  const shim = (name: string, text: string): string => {
    writeFileSync(join(bin, name), `#!/bin/sh\n${text}`, { mode: 0o755 });
    return join(bin, name);
  };
  return { path: `${bin}:/usr/bin:/bin`, bins: {
    "claude-code": shim("claude", `exec '${process.execPath}' '${fake}' claude-code "$@"\n`),
    codex: shim("codex", `case "\${1-}" in app-server|trust-all) exec '${process.execPath}' '${appServer}' "$@" ;; esac\nexec '${process.execPath}' '${fake}' codex "$@"\n`),
  } };
}

function scratchRepository(work: string): Repository {
  const dir = join(work, "scratch"), env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } as Env;
  for (const [rel, text] of Object.entries(SCRATCH)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  for (const args of [["init", "-q", "-b", "main"], ["add", "-A"], ["-c", "commit.gpgsign=false", "commit", "-qm", "base"]]) ok(run(["git", ...args], dir, env), `git ${args[0]}`);
  return { id: "scratch", url: dir, commit: run(["git", "rev-parse", "HEAD"], dir, env).stdout.trim() };
}

// The whole pipeline in `area`, with the compiled engine at `engine` and the scripted stand-in as
// both CLIs. Nothing leaves `area`. The page it returns carries the self-check banner.
export async function selfCheck(area: string, engine: string): Promise<{ out: string; summary: Summary; page: string }> {
  const work = realpathSync(area);
  const tools = standIns(work), repo = scratchRepository(work);
  const tasks: Manifest = {
    selection: "One scripted task on a scratch repository, played by the stand-in. It exercises the runner and is not a trial task.",
    repositories: [repo], tasks: [{ id: "scratch-count", repo: repo.id, prompt: FAKE_PROMPT, verify: SCRATCH_VERIFY }],
  };
  const sessions = plan(tasks, { harnesses: [], repos: [], tasks: [], arms: [] });
  if (typeof sessions === "string") throw new Error(sessions);
  const out = await trial({ kind: "self-check", work, out: join(work, "evidence"), engine, ...tools, manifest: tasks, authHome: null, timeoutMs: 120_000 }, sessions);
  const evidence = load(out);
  const summary = summarize(evidence.run, tasks.selection, evidence.sessions, []);
  writeJson(join(out, "summary.json"), summary);
  writeFileSync(join(out, "page.md"), page(summary));
  return { out, summary, page: page(summary) };
}

// ── Command line ─────────────────────────────────────────────────────────────────────────

function selection(argv: string[]): Selection & { out: string | null } {
  const values = (flag: string): string[] => argv.flatMap((a, i) => (a === flag && argv[i + 1] !== undefined ? argv[i + 1]!.split(",") : []));
  return { harnesses: values("--harness") as TrialHarness[], repos: values("--repo"), tasks: values("--task"), arms: values("--arms") as Arm[], out: values("--out")[0] ?? null };
}

async function real(sessions: Planned[], out: string | null): Promise<number> {
  if (process.env.PREGATE_REAL !== "1" || process.platform !== "darwin") {
    console.error("Real sessions spend model calls and need macOS (the CLIs' credentials live in the keychain).\nRun: PREGATE_REAL=1 bun scripts/session-trial.ts [selection]\nSee what would run first: bun scripts/session-trial.ts --plan [selection]");
    return 2;
  }
  const path = process.env.PATH ?? "/usr/bin:/bin";
  const bins = Object.fromEntries((Object.keys(CLIS) as TrialHarness[]).map((h) => [h, Bun.which(CLIS[h].bin, { PATH: path })]));
  const missing = [...new Set(sessions.map((s) => s.harness))].filter((h) => bins[h] === null);
  if (missing.length > 0) { console.error(`not on the PATH: ${missing.map((h) => CLIS[h].bin).join(", ")}`); return 2; }
  mkdirSync("/private/tmp/claude-501", { recursive: true });
  const work = realpathSync(mkdtempSync("/private/tmp/claude-501/pregate-session-trial-"));
  const engine = join(work, "engine", "build", ENGINE_FILE);
  mkdirSync(dirname(engine), { recursive: true });
  compileBinary(hostTarget(), engine);
  console.log(planText(sessions, "real"));
  const evidence = await trial({ kind: "real", work, out: resolve(out ?? join(work, "evidence")), engine, path, bins: bins as Record<TrialHarness, string>,
    manifest: manifest(), authHome: process.env.PREGATE_AUTH_HOME ?? userInfo().homedir, timeoutMs: TIMEOUT_MS }, sessions);
  console.log(`\nEvidence: ${evidence}\nMachines and clones: ${work}\nLabel the denials in ${relative(ROOT, LABELS)} (run id in ${join(evidence, "trial.json")}), then: bun scripts/session-trial.ts --page ${evidence}`);
  return 0;
}

async function selfCheckCommand(): Promise<number> {
  const area = mkdtempSync(join(tmpdir(), "pregate-session-trial-self-check-"));
  const engine = join(area, "engine", "build", ENGINE_FILE);
  mkdirSync(dirname(engine), { recursive: true });
  compileBinary(hostTarget(), engine);
  const done = await selfCheck(area, engine);
  console.log(`\nSelf-check evidence (a scripted stand-in, not trial data): ${done.out}\nIts page: ${join(done.out, "page.md")}`);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--self-check")) return selfCheckCommand();
  if (argv.includes("--page")) {
    const dir = argv[argv.indexOf("--page") + 1];
    for (const [path, text] of published(dir === undefined ? null : resolve(dir))) writeFileSync(path, text);
    return 0;
  }
  const wanted = selection(argv);
  const sessions = plan(manifest(), wanted);
  if (typeof sessions === "string") { console.error(sessions); return 2; }
  if (argv.includes("--plan")) { console.log(planText(sessions, "not started")); return 0; }
  return real(sessions, wanted.out);
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
