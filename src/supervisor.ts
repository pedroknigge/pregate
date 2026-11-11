import { closeSync, existsSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonical, STDIN_TIMEOUT } from "./disk.ts";
import { enabled } from "./consent.ts";
import { pendingRoot } from "./proposal.ts";
import { blank, ENGINE_VERSION, NO_COMMAND } from "./product.ts";
import { eventOf } from "./harness/claude.ts";
import { isObject, parse } from "./harness/wire.ts";
import { HARNESSES, profile } from "./harness/profile.ts";
import type { Decision, Emission, HarnessId } from "./types.ts";
import { ENGINE_FILE } from "./platform.ts";
import { progressOutput } from "./progress.ts";

interface Run { code: number; stdout: string; stderr: string }
interface Watch { end: number; extension: string }
interface Entry { startedAt?: number; inputTimeout?: boolean; invalid?: boolean }
interface EngineRun {
  data: string; version: string; argv: string[]; input: string | Buffer; raw: string; kind: string;
  harness: HarnessId; dir: string; watch: Watch; inputTimeout?: boolean;
}

export function launcherFailure(kind: string, claude: boolean, raw: string, why: string, harness: HarnessId = claude ? "claude-code" : "codex"): Emission {
  const reason = `PREGATE could not evaluate: ${why}; report it to the user`;
  if (kind === "session-start") return { exit: 0, stderr: "", stdout: claude || harness === "codex" ? JSON.stringify({ systemMessage: reason }) + "\n" : "" };
  if (kind === "stop") {
    if (harness === "codex") return { exit: 0, stderr: "", stdout: JSON.stringify({ systemMessage: reason }) + "\n" };
    if (!claude) return { exit: 0, stderr: "", stdout: "" };
    if (parse(raw)?.stop_hook_active === true) return { exit: 0, stderr: "", stdout: JSON.stringify({ systemMessage: reason }) + "\n" };
    return { exit: 2, stderr: reason + "\n", stdout: JSON.stringify({ decision: "block", reason }) + "\n" };
  }
  const text = reason.slice(0, 256) + "\n";
  const deny: Decision = { verdict: "deny", halt: true, cause: null, violations: [], warnings: [], attempt: 0,
    compact: text, full: reason.slice(0, 4000) + "\n", notice: null, lockHash: null, shadowed: false };
  return HARNESSES[harness].encode("pre-edit", deny);
}

function active(raw: string, data: string): boolean {
  const p = parse(raw);
  const input = isObject(p?.tool_input) ? p.tool_input : isObject(p?.toolInput) ? p.toolInput : {};
  const call = isObject(p?.toolCall) ? p.toolCall : {};
  const args = isObject(call.args) ? call.args : {};
  const patch = typeof input.command === "string" ? [...input.command.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map((m) => m[1]) : [];
  const dirs = [process.cwd(), process.env.CLAUDE_PROJECT_DIR, process.env.CURSOR_PROJECT_DIR, process.env.GROK_WORKSPACE_ROOT,
    p?.cwd, p?.workspaceRoot, input.file_path, args.TargetFile, args.Cwd, ...patch,
    ...(Array.isArray(p?.workspacePaths) ? p.workspacePaths : []), ...(Array.isArray(p?.workspace_roots) ? p.workspace_roots : [])];
  return dirs.some((d) => typeof d === "string" && (consented(d, data) || pendingRoot(canonical(d), data) !== null));
}

function consented(path: string, data: string): boolean {
  for (let dir = canonical(path); ; dir = dirname(dir)) {
    if (enabled(dir, data)) return true;
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return false;
  }
}

// Output goes to files: a surviving grandchild cannot keep the harness's pipes open past the
// deadline. The deadline races process exit independently; termination never delays the deny.
async function child(engine: string, argv: string[], raw: string | Buffer, dir: string, watch: Watch): Promise<Run> {
  const out = join(dir, "out");
  const err = join(dir, "err");
  const fds = [openSync(out, "w"), openSync(err, "w")];
  const proc = spawnEngine(engine, argv, raw, fds, watch);
  let timer: ReturnType<typeof setInterval> | undefined;
  const expired = new Promise<number>((resolve) => {
    timer = setInterval(() => {
      if (existsSync(watch.extension)) {
        watch.end = performance.now() + 95_000;
        rmSync(watch.extension);
      }
      if (performance.now() >= watch.end) { proc.kill(); resolve(-1); }
    }, 20);
  });
  const code = await Promise.race([proc.exited, expired]);
  clearInterval(timer);
  return { code, stdout: readFileSync(out, "utf8"), stderr: readFileSync(err, "utf8") };
}

function spawnEngine(engine: string, argv: string[], raw: string | Buffer, fds: number[], watch: Watch): ReturnType<typeof Bun.spawn> {
  try {
    return Bun.spawn([engine, ...argv], { stdin: Buffer.from(raw), stdout: fds[0]!, stderr: fds[1]!,
      env: { ...process.env, PREGATE_APPROVAL_DEADLINE: watch.extension, PREGATE_PROGRESS: "1" } });
  } finally {
    fds.forEach(closeSync);
  }
}

function installed(data: string, version: string): string {
  if (!ENGINE_VERSION.test(version)) throw new Error("the engine named no valid version (exit 3)");
  const engine = join(data, version, ENGINE_FILE);
  const s = statSync(engine, { throwIfNoEntry: false });
  if (s === undefined || !s.isFile() || s.size === 0) throw new Error(`engine ${version} is not installed; run pregate update --engine ${version}`);
  return engine;
}

export async function supervise(data: string, version: string, args: string[], input: string | Buffer,
  entry: Entry = {}): Promise<Emission> {
  const raw = typeof input === "string" ? input : input.toString("utf8");
  if (args.length === 0 && !entry.invalid && blank(raw)) return { exit: 0, stdout: "", stderr: NO_COMMAND };
  const argv = args.length === 0 ? ["hook", "auto"] : args;
  const kind = argv[1] === "auto" ? eventOf(raw) ?? "pre" : argv[1] ?? "pre";
  const flag = argv[3] ?? "claude-code";
  const harness = profile(Object.hasOwn(HARNESSES, flag) ? flag as HarnessId : "claude-code", raw, {
    grokEvent: process.env.GROK_HOOK_EVENT || null, remote: process.env.CLAUDE_CODE_REMOTE === "true",
    projectDir: process.env.CLAUDE_PROJECT_DIR || process.env.CURSOR_PROJECT_DIR || process.env.GROK_WORKSPACE_ROOT || null,
  });
  const consent = join(data, "consent");
  // SessionStart passes without consent: the engine's dormant notice is for users with no project yet.
  // Stop does once a session reached a consented root, so it can warn when consent was removed.
  const passes = kind === "session-start" || (kind === "stop" && existsSync(join(data, "reached")));
  if (!passes && (!existsSync(consent) || !readdirSync(consent).some((f) => f.endsWith(".json"))) && !active(raw, data)) return { exit: 0, stdout: "", stderr: "" };
  const dir = mkdtempSync(join(tmpdir(), "pregate-supervisor-"));
  const watch = { end: (entry.startedAt ?? performance.now()) + (kind === "stop" ? 45_000 : kind === "session-start" ? 10_000 : 5_000), extension: join(dir, "approval") };
  return await engineEmission({ data, version, argv, input, raw, kind, harness, dir, watch, inputTimeout: entry.inputTimeout });
}

async function engineEmission(run: EngineRun): Promise<Emission> {
  // An engine redirects only for a root with an approved lock, so a failure after a redirect is a
  // project's call even when the session started in a folder above that root.
  let routed = false;
  try {
    if (run.inputTimeout) throw new Error(STDIN_TIMEOUT);
    let r = await child(installed(run.data, run.version), run.argv, run.input, run.dir, run.watch);
    if (r.code === 3) {
      routed = true;
      const v = r.stdout.split("\n")[0] ?? "";
      r = await child(installed(run.data, v), run.argv, run.input, run.dir, run.watch);
    }
    const progress = progressOutput(r.stderr);
    r.stderr = progress.stderr;
    if (r.code !== 0 && r.code !== 2) throw new Error((r.code === -1 ? "the engine timed out" : `the engine failed (exit ${r.code})`) + progress.detail);
    if (r.code === 2 && r.stderr.trim() === "") throw new Error("the engine denied without a reason");
    return { exit: r.code, stdout: r.stdout, stderr: r.stderr };
  } catch (e) {
    // fail-closed: any engine failure in a call that reached a project denies. Only a call with no
    // redirect and no consenting directory, which is no project's call, passes.
    if (!routed && !active(run.raw, run.data)) return { exit: 0, stdout: "", stderr: "" };
    return launcherFailure(run.kind, run.harness === "claude-code", run.raw, (e as Error).message, run.harness);
  } finally {
    rmSync(run.dir, { recursive: true, force: true });
  }
}
