import type { Cause, Decision, Edit, Emission, HookEnv, HookEvent, HookKind, Rejected, Session } from "../types.ts";
import { absolute, absoluteLocation, isObject, json, keys, type Payload, parse } from "./wire.ts";

// The Grok Build adapter (MULTI-HARNESS MH-05, MH-12, MH-14). Grok runs the shared registration in
// ~/.claude/settings.json with its own payload: camelCase keys (the snake twins are ignored), native
// tool names, no turn id in Pre. On Pre, exit 2 or JSON deny blocks; other non-zero exits, timeouts,
// and malformed output let the tool run unless the handler has failClosed (Grok Build >= 1.0.71).

export const VERIFIED = "1.0.49";
// PreToolUse handler failClosed: intended on Grok Build >= FAIL_CLOSED_SINCE. Official docs.x.ai and the
// public grok-build 10-hooks.md mirror still document fail-open only; 1.0.71+ field documented in
// third-party release notes (vibecoding.cz weekly 2026-w44) and Skillsaw grok-hooks-valid. See guarantees.md.
export const FAIL_CLOSED_SINCE = "1.0.71";

const BAD: Cause = "payload-unrecognized";
const EVENTS: Record<string, HookKind> = { pre_tool_use: "pre", stop: "stop", session_start: "session-start" };
const COMMAND = "run_terminal_command";
// In the registration's matcher (the codex preset, the opencode agent), but uncaptured: nothing says
// what they carry, so nothing says where they write.
const UNCAPTURED = new Set(["apply_patch", "edit", "bash"]);

export function decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null {
  const p = parse(raw);
  // The shared registration's SubagentStop: Grok has no subagent Stop the gate judges.
  if (event === "stop" && p !== null && /^subagent/i.test(String(p.hookEventName))) return null;
  if (p === null || named(p) !== event) return refuse(event, p, env);
  const session = sessionOf(p);
  if (session === null || !absolute(p.cwd)) return refuse(event, p, env);
  if (event === "session-start") return { kind: "session-start", session, cwd: p.cwd };
  if (event === "stop") {
    // The extra Stop after SessionEnd: Grok ignores its decision.
    if (p.reason === "shutdown") return null;
    return typeof p.stopHookActive === "boolean" ? { kind: "stop", session, cwd: p.cwd, reentry: p.stopHookActive } : refuse(event, p, env);
  }
  if (typeof p.toolName !== "string" || typeof p.toolUseId !== "string") return refuse(event, p, env);
  // Checked before the tool: a truncated input hides part of what runs or gets written (MH-12).
  if (p.toolInputTruncated !== false || UNCAPTURED.has(p.toolName)) return nowhere(p.toolName, session);
  return tool(p, p.toolName, p.toolUseId, session, p.cwd) ?? refuse(event, p, env);
}

// Grok shows the model only the first line of a reason, cut at 256 characters, so a reason is the
// compact text on one line. Halt has no effect in Grok, ask is denied (MH-05), and the human has no
// channel of their own: nothing else is emitted.
export function encode(e: HookEvent["kind"], d: Decision): Emission {
  if (e !== "stop" && e !== "session-start" && d.verdict === "none" && d.full !== "") {
    return { stdout: json({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: d.full } }), stderr: "", exit: 0 };
  }
  if (e === "session-start" || d.verdict === "none") return { stdout: "", stderr: "", exit: 0 };
  const reason = d.compact.replace(/[\r\n]+/g, " ");
  if (e === "stop") return { stdout: json({ decision: "block", reason }), stderr: "", exit: 0 };
  // exit 2 blocks even when the JSON does not reach Grok intact.
  const deny = { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason };
  return { stdout: json({ hookSpecificOutput: deny }), stderr: reason, exit: 2 };
}

function named(p: Payload): HookKind | null {
  const name = p.hookEventName;
  return typeof name === "string" && Object.hasOwn(EVENTS, name) ? EVENTS[name]! : null;
}

// A subagent is a session of its own (its own sessionId), and nobody answers an ask (MH-05).
function sessionOf(p: Payload): Session | null {
  return typeof p.sessionId === "string" ? { id: p.sessionId, harness: "grok", agentId: null, turnId: null, interactive: false } : null;
}

function refuse(event: HookKind, p: Payload | null, env: HookEnv): Rejected {
  const dirs = p === null ? [] : [p.cwd, p.workspaceRoot, env.projectDir].filter(absoluteLocation);
  return {
    cause: BAD, kind: event === "pre" ? "pre-edit" : event, reentry: p?.stopHookActive === true,
    session: p === null ? null : sessionOf(p), dirs,
  };
}

// A call whose target the payload does not pin down: no directory of the envelope tells whether it
// reaches a root, so it denies anywhere instead of passing outside one (MH-06, MH-17). The agent
// can always resend it whole and absolute.
function nowhere(name: string, session: Session): Rejected {
  return { cause: "cannot-reconstruct", kind: name === COMMAND || name === "bash" ? "pre-command" : "pre-edit", reentry: false, session, dirs: [] };
}

function tool(p: Payload, name: string, callId: string, session: Session, cwd: string): HookEvent | Rejected | null {
  const input = p.toolInput;
  if (!isObject(input)) return null;
  const base = { session, callId, tool: name };
  // Only `command` decides what runs; `description` does not.
  if (name === COMMAND) return typeof input.command === "string" ? { kind: "pre-command", command: { ...base, command: input.command, cwd } } : null;
  if (!(name === "write" || name === "search_replace" || name === "hashline_edit") || typeof input.file_path !== "string") return null;
  if (!absolute(input.file_path)) return nowhere(name, session);
  return { kind: "pre-edit", changes: [{ ...base, path: input.file_path, edit: editOf(name, input), from: null }] };
}

// Strict: a key or a type this profile does not know may change what gets written. The path is
// still known, so the change is judged where it lands, and an unknown edit denies there.
function editOf(name: string, i: Payload): Edit {
  if (name === "write" && keys(i, ["file_path", "content"], []) && typeof i.content === "string") return { form: "full", content: i.content };
  if (name === "search_replace" && keys(i, ["file_path", "old_string", "new_string"], ["replace_all"])
    && typeof i.old_string === "string" && typeof i.new_string === "string" && (i.replace_all === undefined || typeof i.replace_all === "boolean")) {
    return { form: "oldnew", old: i.old_string, neu: i.new_string, all: i.replace_all === true, lines: null };
  }
  // hashline_edit addresses lines by anchors read earlier; `write` exists in both toolsets.
  return { form: "unknown", cause: name };
}
