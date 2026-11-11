import type { Cause, Decision, Edit, Emission, HookEnv, HookEvent, HookKind, ProposedChange, Rejected, Session } from "../types.ts";
import { absolute, absoluteLocation, isObject, json, keys, type Payload, parse } from "./wire.ts";

// The Cursor (cursor-agent) adapter. Cursor runs the hooks of ~/.claude/settings.json with its own
// payload (MULTI-HARNESS MH-04), and every file mutation reaches preToolUse as a Write carrying the
// whole resulting file, or as a Delete [V]: nothing here needs reconstruction (MH-13). The same
// decode serves the project's native .cursor/hooks.json (MH-28c).

export const VERIFIED = "2026.11.11-043ef28";

const BAD: Cause = "payload-unrecognized";
const NAMES: Record<HookKind, string> = { pre: "preToolUse", stop: "stop", "session-start": "sessionStart" };

export function decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null {
  const p = parse(raw);
  const session = p === null ? null : sessionOf(p);
  // The shared registration's SubagentStop: Cursor has no subagent Stop the gate judges.
  if (event === "stop" && p !== null && /^subagent/i.test(String(p.hook_event_name))) return null;
  if (p === null || session === null || p.hook_event_name !== NAMES[event]) return refuse(event, p, env);
  if (event === "pre") return typeof p.tool_name === "string" && p.tool_name.startsWith("MCP:") ? mcp(p, session, env) : tool(p, session) ?? refuse(event, p, env);
  // Stop and SessionStart carry no cwd: the workspace is where the session works (MH-05).
  const cwd = Array.isArray(p.workspace_roots) ? p.workspace_roots[0] : undefined;
  if (!absolute(cwd)) return refuse(event, p, env);
  if (event === "session-start") return { kind: "session-start", session, cwd };
  // Cursor sends no stop_hook_active: loop_count counts the turns this hook's Stop already started.
  const loops = p.loop_count;
  if (typeof loops !== "number" || !Number.isInteger(loops) || loops < 0) return refuse(event, p, env);
  return { kind: "stop", session, cwd, reentry: loops > 0 };
}

// MH-14. Cursor honors Claude Code's deny JSON at exit 0 from the shared registration [V]. It enforces
// no ask, has no halt and no channel to the human, so ask leaves as a deny and halt and notice drop:
// the deny text already tells the agent to stop and report. A Stop blocks by starting another turn.
export function encode(kind: HookEvent["kind"], d: Decision): Emission {
  if (kind !== "stop" && d.verdict === "none" && d.full !== "") return { stdout: json({ additional_context: d.full }), stderr: "", exit: 0 };
  if (d.verdict === "none" || kind === "session-start") return { stdout: "", stderr: "", exit: 0 };
  if (kind === "stop") return { stdout: json({ followup_message: d.full }), stderr: "", exit: 0 };
  const deny = { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: d.full };
  return { stdout: json({ hookSpecificOutput: deny }), stderr: "", exit: 0 };
}

// A subagent has its own session_id and no parent marker [V], so there is no agentId. Nothing is
// interactive: Cursor does not enforce ask (MH-05).
function sessionOf(p: Payload): Session | null {
  const turn = p.generation_id;
  if (typeof p.session_id !== "string" || !(turn === undefined || typeof turn === "string")) return null;
  return { id: p.session_id, harness: "cursor", agentId: null, turnId: turn ?? null, interactive: false };
}

function tool(p: Payload, session: Session): HookEvent | null {
  const input = p.tool_input;
  if (typeof p.tool_name !== "string" || typeof p.tool_use_id !== "string" || !isObject(input)) return null;
  const base = { session, callId: p.tool_use_id, tool: p.tool_name };
  if (p.tool_name === "Shell") {
    // An empty cwd is the workspace root, ambiguous unless there is exactly one; a top-level cwd that
    // disagrees with the tool's leaves where the command runs ambiguous too (MH-06).
    const roots = p.workspace_roots;
    const cwd = input.cwd === "" && Array.isArray(roots) && roots.length === 1 ? roots[0] : input.cwd;
    const agreed = p.cwd === undefined || p.cwd === input.cwd;
    return typeof input.command === "string" && agreed && absolute(cwd) ? { kind: "pre-command", command: { ...base, command: input.command, cwd } } : null;
  }
  const edit = editOf(p.tool_name, input);
  return edit !== null && absolute(input.file_path) ? { kind: "pre-edit", changes: [{ ...base, path: input.file_path, edit, from: null }] } : null;
}

// Closed keys: one Cursor does not send yet may change what gets written. The change is then judged
// by its path, which still guards protected files, and never by content it may not be.
function editOf(tool: string, i: Payload): Edit | null {
  if (tool === "Delete") return keys(i, ["file_path"], []) ? { form: "delete" } : { form: "unknown", cause: tool };
  if (tool !== "Write") return null;
  return keys(i, ["file_path", "content"], []) && typeof i.content === "string" ? { form: "full", content: i.content } : { form: "unknown", cause: tool };
}

// MH-35. The arguments of an MCP tool belong to its server: no key set says what it writes. A call that
// names no local absolute path is not one the gate judges; every path it names is judged where it
// lands, by its path only, so a protected file is denied and an in-scope one cannot be evaluated.
// A path that is not normalized may land anywhere: it denies wherever the session reaches a root.
function mcp(p: Payload, session: Session, env: HookEnv): HookEvent | Rejected | null {
  const input = p.tool_input;
  if (typeof p.tool_use_id !== "string" || !isObject(input)) return refuse("pre", p, env);
  const named = [...new Set(locations(input, 0))];
  if (named.length === 0) return null;
  if (!named.every(absolute)) return { cause: "cannot-reconstruct", kind: "pre-edit", reentry: false, session, dirs: named };
  const base: Omit<ProposedChange, "path" | "edit" | "from"> = { session, callId: p.tool_use_id, tool: p.tool_name as string };
  return { kind: "pre-edit", changes: named.map((path) => ({ ...base, path, edit: { form: "unknown", cause: base.tool }, from: null })) };
}

const MCP_DEPTH = 4;

function locations(v: unknown, depth: number): string[] {
  if (absoluteLocation(v)) return [v];
  if (depth >= MCP_DEPTH) return [];
  if (Array.isArray(v)) return v.flatMap((x) => locations(x, depth + 1));
  return isObject(v) ? Object.values(v).flatMap((x) => locations(x, depth + 1)) : [];
}

// The target path counts among the directories: a session opened outside any root may still write
// into one, or into a machine file (MH-17), and its refusal must not pass as rootless.
function refuse(event: HookKind, p: Payload | null, env: HookEnv): Rejected {
  const input = isObject(p?.tool_input) ? p.tool_input : {};
  const roots: unknown[] = Array.isArray(p?.workspace_roots) ? p.workspace_roots : [];
  const dirs = [input.cwd, input.file_path, ...roots, env.projectDir].filter(absoluteLocation);
  const loops = p?.loop_count;
  return {
    cause: BAD, kind: event === "pre" ? "pre-edit" : event, reentry: typeof loops === "number" && loops > 0,
    session: p === null ? null : sessionOf(p), dirs,
  };
}
