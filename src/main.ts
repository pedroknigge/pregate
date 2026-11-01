import { readFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { eventOf } from "./harness/claude.ts";
import { HARNESSES, profile } from "./harness/profile.ts";
import type { Decision, HarnessId, HookEnv, HookEvent, HookKind, Rejected } from "./types.ts";
import { homeDir } from "./platform.ts";
import { dormantNotice, inert, told } from "./inertia.ts";
import { readStdin, STDIN_TIMEOUT } from "./disk.ts";
import { checkpoint } from "./progress.ts";
import { blank, NO_COMMAND } from "./product.ts";

// Empty arguments open the guide only on an interactive terminal. Redirected input retains the
// `hook auto` protocol (§13.7). There is no
// last-resort try/catch: anything unforeseen exits 1 and the launcher emits the event's deny (A6).

const KINDS: ReadonlySet<string> = new Set<HookKind>(["pre", "stop", "session-start"]);
type Gate = typeof import("./gate.ts");

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 && process.stdin.isTTY && process.stdout.isTTY && !process.env.CI) argv = ["guide"];
  if (argv[0] === "--supervise") return superviseEngine(argv);
  if (argv.length > 0 && argv[0] !== "hook") {
    const { run } = await import("./cli.ts");
    return run(argv);
  }
  const [, event = "auto", ...flags] = argv;
  checkpoint("input");
  const input = await readStdin(), raw = input.text;
  // Oversized and stalled input read as empty text but are invalid: they keep their rejection.
  if (argv.length === 0 && !input.invalid && blank(raw)) {
    writeSync(2, NO_COMMAND);
    return 0;
  }
  const env = harnessEnv();
  const kind = event === "auto" ? (eventOf(raw) ?? "pre") : event;
  const flag = flags.length === 0 ? "claude-code" : flags[1];
  const ours = (flags.length === 0 || (flags.length === 2 && flags[0] === "--harness"))
    && flag !== undefined && Object.hasOwn(HARNESSES, flag);
  const harness = profile(ours ? flag as HarnessId : "claude-code", raw, env);
  if (ours && harness === "cursor" && (kind === "stop" || kind === "session-start") && flag === "claude-code" && await nativeCursorOwned(kind)) return 0;
  const adapter = HARNESSES[harness];
  const decoded = ours && KINDS.has(kind) ? adapter.decode(kind as HookKind, raw, env) : refused(kind);
  const e = input.invalid ? inputRejection(decoded, kind) : decoded;
  if (e !== null && !("cause" in e) && e.kind === "pre-read") {
    const { readDecision } = await import("./proposal-read.ts");
    const out = adapter.encode(e.kind, readDecision(e));
    if (out.stdout !== "") writeSync(1, out.stdout);
    if (out.stderr !== "") writeSync(2, out.stderr);
    return out.exit;
  }
  if (e === null || inert(e)) return dormant(e, adapter);
  checkpoint("admission");
  const gate = await import("./gate.ts");
  const pin = input.invalid ? null : gate.redirect(e);
  if (pin !== null) {
    writeSync(1, `${pin}\n${kind === "pre" ? raw : ""}`);
    return gate.REDIRECT;
  }
  const out = "cause" in e ? adapter.encode(e.kind, rejection(e, harness, gate, input.timedOut)) : adapter.encode(e.kind, await dispatch(e, gate));
  // One write per channel: the launcher captures them to files.
  if (out.stdout !== "") writeSync(1, out.stdout);
  if (out.stderr !== "") writeSync(2, out.stderr);
  return out.exit;
}

// The supervisor runs the engine as a child under a deadline and relays its two channels.
async function superviseEngine(argv: string[]): Promise<number> {
  const startedAt = performance.now();
  const input = await readStdin();
  const { supervise } = await import("./supervisor.ts");
  const out = await supervise(argv[1]!, argv[2]!, argv.slice(3), input.bytes, { startedAt, inputTimeout: input.timedOut, invalid: input.invalid });
  if (out.stdout) writeSync(1, out.stdout);
  if (out.stderr) writeSync(2, out.stderr);
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
  const line = e !== null && !("cause" in e) && e.kind === "session-start" ? dormantNotice(e.cwd) : null;
  if (line === null) return 0;
  const out = adapter.encode("session-start", told(null, line));
  if (out.stdout !== "") writeSync(1, out.stdout);
  return 0;
}

async function nativeCursorOwned(kind: "stop" | "session-start"): Promise<boolean> {
  const { cursorStopOwned, cursorStartOwned } = await import("./register.ts");
  return cursorHooksOwned(kind === "stop" ? cursorStopOwned : cursorStartOwned);
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
  return { cause: "payload-unrecognized", kind: kind === "stop" || kind === "session-start" ? kind : "pre-edit", reentry: false, session: null, dirs: [] };
}

function inputRejection(e: HookEvent | Rejected | null, kind: string): Rejected {
  if (e === null) return refused(kind);
  if ("cause" in e) return e;
  if (e.kind === "pre-edit") return { ...refused(kind), session: e.changes[0]?.session ?? null, dirs: e.changes.map((c) => c.path) };
  if (e.kind === "pre-command") return { ...refused(kind), session: e.command.session, dirs: [e.command.cwd] };
  return { ...refused(kind), session: e.session, dirs: [e.cwd], reentry: e.kind === "stop" && e.reentry };
}

function rejection(e: Rejected, harness: HarnessId, gate: Gate, timedOut: boolean): Decision {
  const d = gate.rejected(e);
  if (e.cause !== "payload-unrecognized" || d.verdict === "none") return d;
  // Unknown tool names are untrusted input: do not echo secrets or unbounded payload data.
  const label = timedOut ? `${STDIN_TIMEOUT} (${harness})` : `payload-unrecognized (${harness})`;
  return { ...d, full: d.full.replace("payload-unrecognized", label), compact: d.compact.replace("payload-unrecognized", label) };
}

async function dispatch(e: HookEvent, gate: Gate): Promise<Decision> {
  switch (e.kind) {
    case "session-start": return gate.onSessionStart(e);
    case "pre-edit": return gate.onPreEdit(e.changes);
    case "pre-command": return gate.onPreCommand(e.command);
    case "pre-read": return (await import("./proposal-read.ts")).readDecision(e);
    case "stop": return gate.onStop(e);
  }
}

// No top-level await: `--bytecode` does not allow it (§5.4).
main(process.argv.slice(2)).then((code) => {
  process.exit(code);
});
