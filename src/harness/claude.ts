import type { Cause, Decision, Edit, Emission, HookEnv, HookEvent, HookKind, Rejected, Session } from "../types.ts";
import { absolute, absoluteLocation, isObject, json, keys, type Payload, parse } from "./wire.ts";

// The Claude Code adapter; its profile lives here as constants (MH-01). decode is strict where a key
// can change what gets written, and encode has no branch that grants anything: "allow" never leaves.

export const VERIFIED = "2.1.287";

const BAD: Cause = "payload-unrecognized";
// SubagentStop is a Stop of one subagent: the gate judges only the files that agent edited.
const EVENTS: Record<string, HookKind> = { PreToolUse: "pre", Stop: "stop", SubagentStop: "stop", SessionStart: "session-start" };
const EDITS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const COMMANDS = new Set(["Bash", "PowerShell", "Monitor"]);
// The camelCase twins another harness sends (Grok Build): this profile does not describe that payload.
const FOREIGN = ["hookEventName", "toolName", "toolInput", "toolInputTruncated"];
const INTERACTIVE = new Set(["default", "acceptEdits", "auto", "plan"]);

// The event a payload names, for `hook auto` (SPEC §13.7), where argv does not say it.
export function eventOf(raw: string): HookKind | null {
  return named(parse(raw));
}

export function decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null {
  const p = parse(raw);
  if (p === null || FOREIGN.some((k) => Object.hasOwn(p, k)) || named(p) !== event) return refuse(event, p, env);
  const session = sessionOf(p, env);
  if (session === null || !absolute(p.cwd)) return refuse(event, p, env);
  if (event === "session-start") return { kind: "session-start", session, cwd: p.cwd };
  if (event === "stop") {
    const valid = typeof p.stop_hook_active === "boolean" && (p.hook_event_name === "Stop") === (session.agentId === null);
    return valid ? { kind: "stop", session, cwd: p.cwd, reentry: p.stop_hook_active as boolean } : refuse(event, p, env);
  }
  return tool(p, session, p.cwd) ?? refuse(event, p, env);
}

// SPEC §4.5. Every deny is exit 2 with the same text in the JSON and on stderr: exit 2 blocks even
// when the JSON does not reach Claude Code intact. SessionStart can only inform.
export function encode(e: HookEvent["kind"], d: Decision): Emission {
  const told = d.notice === null ? {} : { systemMessage: d.notice };
  if (e === "session-start") return quiet({ ...context("SessionStart", d.verdict === "none" ? d.full : ""), ...told });
  if (e === "post-invocation") return quiet({});
  // Stop.additionalContext continues Claude's turn even on exit 0. Observations stay in the report.
  if (d.verdict === "none") return e === "stop" ? quiet(told) : quiet({ ...context("PreToolUse", d.full), ...told });
  if (e === "stop") return { stdout: json({ decision: "block", reason: d.full, ...told }), stderr: d.full, exit: 2 };
  if (d.verdict === "ask") {
    const ask = { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: d.notice ?? d.compact, additionalContext: d.full };
    return quiet({ hookSpecificOutput: ask });
  }
  const halt = d.halt ? { continue: false, stopReason: d.notice ?? d.compact } : told;
  const deny = { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: d.full };
  return { stdout: json({ hookSpecificOutput: deny, ...halt }), stderr: d.full, exit: 2 };
}

function named(p: Payload | null): HookKind | null {
  const name = p?.hook_event_name;
  return typeof name === "string" && Object.hasOwn(EVENTS, name) ? EVENTS[name]! : null;
}

function sessionOf(p: Payload, env: HookEnv): Session | null {
  if (typeof p.session_id !== "string" || ![p.prompt_id, p.agent_id, p.permission_mode].every(optional)) return null;
  const agentId = (p.agent_id as string | undefined) ?? null;
  return {
    id: p.session_id, harness: "claude-code", agentId, turnId: (p.prompt_id as string | undefined) ?? null,
    interactive: INTERACTIVE.has(p.permission_mode as string) && agentId === null && !env.remote,
  };
}

function refuse(event: HookKind, p: Payload | null, env: HookEnv): Rejected {
  const dirs = [p?.cwd, env.projectDir].filter(absoluteLocation);
  return {
    cause: BAD, kind: event === "pre" ? "pre-edit" : event, reentry: p?.stop_hook_active === true,
    session: p === null ? null : sessionOf(p, env), dirs,
  };
}

function tool(p: Payload, session: Session, cwd: string): HookEvent | null {
  const input = p.tool_input;
  if (typeof p.tool_name !== "string" || typeof p.tool_use_id !== "string" || !isObject(input)) return null;
  const base = { session, callId: p.tool_use_id, tool: p.tool_name };
  // Only `command` decides what runs; description, timeout or sandbox flags do not.
  if (COMMANDS.has(p.tool_name)) return typeof input.command === "string" ? { kind: "pre-command", command: { ...base, command: input.command, cwd } } : null;
  if (!EDITS.has(p.tool_name)) return null;
  const path = p.tool_name === "NotebookEdit" ? input.notebook_path : input.file_path;
  const edit = editOf(p.tool_name, input);
  return absolute(path) && edit !== null ? { kind: "pre-edit", changes: [{ ...base, path, edit, from: null }] } : null;
}

// Write and Edit are strict: an unknown key may change what the tool writes. An empty old_string
// reaches reconstruct as is: it creates a file that does not exist (MH-13).
function editOf(tool: string, i: Payload): Edit | null {
  if (tool === "MultiEdit" || tool === "NotebookEdit") return { form: "unknown", cause: tool };
  if (tool === "Write") return keys(i, ["file_path", "content"], []) && typeof i.content === "string" ? { form: "full", content: i.content } : null;
  const valid = keys(i, ["file_path", "old_string", "new_string"], ["replace_all"]) && typeof i.old_string === "string"
    && typeof i.new_string === "string" && (i.replace_all === undefined || typeof i.replace_all === "boolean");
  if (!valid) return null;
  return { form: "oldnew", old: i.old_string as string, neu: i.new_string as string, all: i.replace_all === true, lines: null };
}

function optional(v: unknown): boolean {
  return v === undefined || typeof v === "string";
}

function context(hookEventName: string, text: string): object {
  return text === "" ? {} : { hookSpecificOutput: { hookEventName, additionalContext: text } };
}

// Silence is no objection: Claude Code's own permission flow goes on.
function quiet(o: object): Emission {
  return { stdout: Object.keys(o).length === 0 ? "" : json(o), stderr: "", exit: 0 };
}
