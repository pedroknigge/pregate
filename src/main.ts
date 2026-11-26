import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeAll } from "./write-all.ts";
import { eventOf } from "./harness/claude.ts";
import { nativePreAllow } from "./harness/cursor.ts";
import { HARNESSES, profile, subagentEvent } from "./harness/profile.ts";
import { wireOf, type Place } from "./harness/wire.ts";
import { enforcedHere } from "./consent.ts";
import { pendingRoot } from "./proposal.ts";
import { literalPaths } from "./shell.ts";
import type { Decision, HarnessId, HookEnv, HookEvent, HookKind, Rejected } from "./types.ts";
import { homeDir } from "./platform.ts";
import { dormantNotice, inert, told } from "./admission.ts";
import { canonical, readStdin, STDIN_TIMEOUT } from "./disk.ts";
import { slash } from "./paths.ts";
import { checkpoint } from "./progress.ts";
import { blank, NO_COMMAND } from "./product.ts";

// Empty arguments open the guide only on an interactive terminal. Redirected input retains the
// `hook auto` protocol (§13.7). There is no
// last-resort try/catch: anything unforeseen exits 1 and the launcher emits the event's deny (A6).

const KINDS: ReadonlySet<string> = new Set<HookKind>(["pre", "stop", "session-start", "post-invocation"]);
type Gate = typeof import("./gate.ts");

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 && process.stdin.isTTY && process.stdout.isTTY && !process.env.CI) argv = ["guide"];
  if (argv[0] === "--supervise") return superviseEngine(argv);
  if (argv.length > 0 && argv[0] !== "hook") {
    const { run } = await import("./cli.ts");
    return run(argv);
  }
  const [, event = "auto", ...flags] = argv;
  // Only bare `hook <event>` and `hook <event> --harness <id>` are valid hook invocations. An
  // unknown flag or value no longer misroutes silently to the Claude Code adapter: it is reported
  // on stderr and evaluated with the default adapter, whose decode refuses a foreign payload.
  const flag = flags.length === 0 ? "claude-code" : flags[1] ?? "";
  const malformed = flags.length > 0 && (flags.length !== 2 || flags[0] !== "--harness" || !Object.hasOwn(HARNESSES, flag));
  const ours = !malformed && Object.hasOwn(HARNESSES, flag);
  if (malformed) writeAll(2, `pregate hook: unrecognized invocation flags "${flags.join(" ")}"; evaluating with the default adapter\n`);
  checkpoint("input");
  const input = await readStdin(), raw = input.text;
  // Oversized and stalled input read as empty text but are invalid: they keep their rejection.
  if (argv.length === 0 && !input.invalid && blank(raw)) {
    writeAll(2, NO_COMMAND);
    return 0;
  }
  const env = harnessEnv();
  const kind = event === "auto" ? (eventOf(raw) ?? "pre") : event;
  const harness = profile(ours ? flag as HarnessId : "claude-code", raw, env);
  // Cursor runs a project Claude hook and the native .cursor/hooks.json hook for the same call.
  // The Claude one stands aside when the native file owns that event, so the call is evaluated once.
  // The global Claude registration has no PREGATE_PROJECT_HOOK and still evaluates.
  if (ours && harness === "cursor" && flag === "claude-code") {
    if ((kind === "stop" || kind === "session-start") && await nativeCursorOwned(kind)) return 0;
    if (process.env.PREGATE_PROJECT_HOOK === "1" && KINDS.has(kind) && await projectCursorFileOwned(kind as HookKind)) return 0;
  }
  // The shared registration's SubagentStart is Claude Code's: another harness that reads that file
  // and dispatches the event gets no reply.
  if (ours && flag === "claude-code" && harness !== "claude-code" && kind === "session-start" && subagentEvent(raw)) return 0;
  const adapter = HARNESSES[harness];
  const decoded = ours && KINDS.has(kind) ? adapter.decode(kind as HookKind, raw, env) : refused(kind);
  const e = input.invalid ? inputRejection(decoded, kind) : decoded;
  const subagent = e !== null && e.kind === "session-start" && (e.session?.agentId ?? null) !== null;
  if (e === null || inert(e)) {
    // A native preToolUse that prints nothing is a failure under failClosed. An unjudged call allows.
    if (flag === "cursor" && kind === "pre") {
      writeAll(1, nativePreAllow().stdout);
      return 0;
    }
    return subagent ? 0 : dormant(e, adapter);
  }
  checkpoint("admission");
  const gate = await import("./gate.ts");
  const pin = input.invalid ? null : gate.redirect(e);
  // Older pinned engines retain parent Stop; they may not understand the new child events.
  const childLifecycle = harness === "codex" && e.kind !== "pre-edit" && e.kind !== "pre-command" && e.session?.agentId != null;
  if (pin !== null && (subagent || childLifecycle)) return 0;
  if (pin !== null) {
    writeAll(1, `${pin}\n${kind === "pre" ? raw : ""}`);
    return gate.REDIRECT;
  }
  // Cursor's third encode argument is the native preToolUse reply. Other harnesses use it for a subagent.
  const replyFlag = harness === "cursor" ? flag === "cursor" && kind === "pre" : subagent;
  const decision = "cause" in e ? rejection(e, harness, gate, input.timedOut) : await dispatch(e, gate);
  const out = adapter.encode(e.kind, wireOf(decision, scopeDirs(e), place), replyFlag);
  // One write per channel: the launcher captures them to files.
  if (out.stdout !== "") writeAll(1, out.stdout);
  if (out.stderr !== "") writeAll(2, out.stderr);
  return out.exit;
}

// The supervisor runs the engine as a child under a deadline and relays its two channels.
// The clock starts before stdin so a slow read stays inside the budget. A startup checkpoint
// from the child gives that child a full budget of its own; see supervisor.ts.
async function superviseEngine(argv: string[]): Promise<number> {
  const startedAt = performance.now();
  const input = await readStdin();
  const { supervise } = await import("./supervisor.ts");
  const out = await supervise(argv[1]!, argv[2]!, argv.slice(3), input.bytes, { startedAt, inputTimeout: input.timedOut, invalid: input.invalid });
  if (out.stdout) writeAll(1, out.stdout);
  if (out.stderr) writeAll(2, out.stderr);
  return out.exit;
}

// The only environment that changes a decision is the harness's own (ARCHITECTURE §1.6).
function harnessEnv(): HookEnv {
  return {
    grokEvent: process.env.GROK_HOOK_EVENT || null,
    projectDir: process.env.CLAUDE_PROJECT_DIR || process.env.CURSOR_PROJECT_DIR || process.env.GROK_WORKSPACE_ROOT || null,
    remote: process.env.CLAUDE_CODE_REMOTE === "true",
  };
}

// An inactive call exits silently, except a session start in a Git repository without a contract:
// it says once how to set PREGATE up. Informational only; nothing is recorded.
function dormant(e: HookEvent | Rejected | null, adapter: (typeof HARNESSES)[HarnessId]): number {
  if (e === null || "cause" in e || e.kind !== "session-start") return 0;
  const line = dormantNotice(e.cwd);
  if (line === null) return 0;
  const out = adapter.encode("session-start", wireOf(told(null, line), scopeDirs(e), place));
  if (out.stdout !== "") writeAll(1, out.stdout);
  return 0;
}

async function nativeCursorOwned(kind: "stop" | "session-start"): Promise<boolean> {
  const { cursorStopOwned, cursorStartOwned } = await import("./register.ts");
  return cursorHooksOwned(kind === "stop" ? cursorStopOwned : cursorStartOwned);
}

async function projectCursorFileOwned(kind: HookKind): Promise<boolean> {
  const { projectCursorHookOwned } = await import("./register.ts");
  const root = process.env.CURSOR_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    return projectCursorHookOwned(readFileSync(join(root, ".cursor/hooks.json"), "utf8"), kind);
  } catch {
    // fail-closed: a missing or unreadable native file does not stand aside, so the Claude hook still evaluates.
    return false;
  }
}

function cursorHooksOwned(owned: (text: string, data: string) => boolean): boolean {
  try {
    const text = readFileSync(join(homeDir(), ".cursor/hooks.json"), "utf8");
    return owned(text, dirname(dirname(process.execPath)));
  } catch {
    return false;
  }
}

function refused(kind: string): Rejected {
  const mapped = kind === "stop" || kind === "session-start" || kind === "post-invocation" ? kind : "pre-edit";
  return { cause: "payload-unrecognized", kind: mapped, reentry: false, session: null, dirs: [] };
}

function inputRejection(e: HookEvent | Rejected | null, kind: string): Rejected {
  if (e === null) return refused(kind);
  if ("cause" in e) return e;
  if (e.kind === "pre-edit") return { ...refused(kind), session: e.changes[0]?.session ?? null, dirs: e.changes.map((c) => c.path) };
  if (e.kind === "pre-command") return { ...refused(kind), session: e.command.session, dirs: [e.command.cwd] };
  return { ...refused(kind), session: e.session, dirs: [e.cwd], reentry: e.kind === "stop" && e.reentry };
}

function eventDirs(e: HookEvent | Rejected): string[] {
  if ("cause" in e) return e.dirs.length > 0 ? e.dirs : [process.cwd()];
  if (e.kind === "pre-edit") return e.changes.map((c) => dirname(c.path));
  if (e.kind === "pre-command") return [e.command.cwd];
  return [e.cwd];
}

function scopeDirs(e: HookEvent | Rejected): string[] {
  const named = [process.cwd(), process.env.CLAUDE_PROJECT_DIR, process.env.CURSOR_PROJECT_DIR, process.env.GROK_WORKSPACE_ROOT];
  const command = !("cause" in e) && e.kind === "pre-command" ? commandDirs(e.command.command, e.command.cwd) : [];
  return [...eventDirs(e), ...command, ...named.filter((dir): dir is string => typeof dir === "string" && dir !== "")];
}

// `sh -c 'pregate update --projects <root>'` is one quoted word. The shell guard still reads that
// text as an update of the root. Split such a word once so the root can carry the deny.
function commandDirs(command: string, cwd: string): string[] {
  const words = literalPaths(command, cwd);
  const found = new Set(words);
  const prefix = `${slash(cwd).replace(/\/$/, "")}/`;
  for (const abs of words) {
    if (!abs.startsWith(prefix)) continue;
    const word = abs.slice(prefix.length);
    if (!word.includes("pregate")) continue;
    for (const inner of literalPaths(word, cwd)) found.add(inner);
  }
  return [...found];
}

function place(dir: string): Place {
  try {
    if (enforcedHere(dir)) return "enforced";
    if (pendingRoot(canonical(dir)) !== null) return "protocol";
    return "off";
  } catch (error) {
    if (error instanceof Error && error.message.endsWith(": no existing ancestor")) return "off";
    throw error;
  }
}

function rejection(e: Rejected, harness: HarnessId, gate: Gate, timedOut: boolean): Decision {
  const d = gate.rejected(e);
  if (e.cause !== "payload-unrecognized" || d.verdict === "none") return d;
  // Unknown tool names are untrusted input: do not echo secrets or unbounded payload data.
  const label = timedOut ? `${STDIN_TIMEOUT} (${harness})` : `payload-unrecognized (${harness})`;
  return { ...d, full: d.full.replace("payload-unrecognized", label), compact: d.compact.replace("payload-unrecognized", label) };
}

function dispatch(e: HookEvent, gate: Gate): Decision | Promise<Decision> {
  switch (e.kind) {
    case "session-start": return gate.sessionStart(e);
    case "post-invocation": return gate.onPostInvocation(e);
    case "pre-edit": return gate.onPreEdit(e.changes);
    case "pre-command": return gate.onPreCommand(e.command);
    case "stop": return gate.onStop(e);
  }
}

// No top-level await: `--bytecode` does not allow it (§5.4). A rejection is the same fail-closed
// exit as any other unforeseen failure: code 1, which the launcher denies and never turns into an allow.
main(process.argv.slice(2)).then((code) => {
  process.exit(code);
}, (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  writeAll(2, `pregate: ${message}\n`);
  process.exit(1);
});
