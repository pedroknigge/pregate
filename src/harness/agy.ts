import type { Cause, Decision, Edit, Emission, HookEnv, HookEvent, HookKind, Rejected, Session } from "../types.ts";
import { absolute, absoluteLocation, isObject, json, keys, type Payload, parse } from "./wire.ts";

// The Antigravity (agy) adapter (MULTI-HARNESS MH-05, MH-11, MH-14). An empty stdout leaves a Pre
// call to agy's own permission flow, so it is the only neutral: "allow" would skip that flow.
// SessionStart injects the session briefing as a systemMessage; PostInvocation delivers non-blocking
// Pre warnings and terminates halted turns with an errorMessage. 1.5.3+ adds hookEventName, cwd and
// write_file/edit_file; 1.5.6 adds SessionStart, continuationActive and manage_task; 1.2.14 shapes
// remain accepted.

export const VERIFIED = "1.5.6";

const BAD: Cause = "payload-unrecognized";
const EVENT_NAMES: Record<HookKind, readonly string[]> = {
  pre: ["PreToolUse"], stop: ["Stop"], "session-start": ["SessionStart", "PreInvocation"], "post-invocation": ["PostInvocation"],
};
// What agy shows the user or keeps as metadata: none of it changes the bytes written (MH-11).
const NOTES = ["Description", "Instruction", "TargetLintErrorIds", "ArtifactMetadata", "toolAction", "toolSummary"];
const READ_ONLY_TASK_ACTIONS = new Set(["list", "status", "kill"]);

const UNCAPTURED = new Set(["multi_replace_file_content", "create_file", "delete_file", "rename_file", "notebook_edit"]);

// SessionStart supplies the session briefing once; legacy PreInvocation supplies it on invocation 0.
export function decode(event: HookKind, raw: string, _env: HookEnv): HookEvent | Rejected | null {
  const p = parse(raw);
  const session = p === null ? null : sessionOf(p);
  if (p === null || session === null || !matchesEvent(event, p)) return refuse(event, p, session, BAD);
  if (event === "session-start") return decodeSessionStart(p, session);
  if (event === "post-invocation") return decodePostInvocation(p, session);
  if (event === "stop") return decodeStop(p, session);
  const res = tool(p, session);
  return res === "ignore" ? null : (res ?? refuse(event, p, session, BAD));
}

// Every reply is exit 0: agy reads a deny from JSON, and nobody can answer an ask (MH-05). Pre
// warnings and halt notices leave on PostInvocation; a Stop that blocks reopens the agent loop.
export function encode(kind: HookEvent["kind"], d: Decision): Emission {
  if (kind === "session-start" && d.verdict === "none" && d.full !== "") {
    return { stdout: json({ injectSteps: [{ systemMessage: { systemMessage: d.full } }] }), stderr: "", exit: 0 };
  }
  if (kind === "post-invocation") return encodePostInvocation(d);
  if (kind === "session-start" || d.verdict === "none") return { stdout: "", stderr: "", exit: 0 };
  return { stdout: json({ decision: kind === "stop" ? "continue" : "deny", reason: d.full }), stderr: "", exit: 0 };
}

function encodePostInvocation(d: Decision): Emission {
  if (d.halt && d.notice !== null) {
    return { stdout: json({ injectSteps: [{ errorMessage: { userMessage: d.notice } }], terminationBehavior: "terminate" }), stderr: "", exit: 0 };
  }
  if (d.verdict === "none" && d.full !== "") {
    return { stdout: json({ injectSteps: [{ systemMessage: { systemMessage: d.full } }] }), stderr: "", exit: 0 };
  }
  return { stdout: "", stderr: "", exit: 0 };
}

function matchesEvent(event: HookKind, p: Payload): boolean {
  return p.hookEventName === undefined || (typeof p.hookEventName === "string" && EVENT_NAMES[event].includes(p.hookEventName));
}

function decodeSessionStart(p: Payload, session: Session): HookEvent | Rejected | null {
  if (p.hookEventName === "SessionStart") {
    if (p.invocationNum !== undefined) return refuse("session-start", p, session, BAD);
  } else {
    if (!count(p.invocationNum)) return refuse("session-start", p, session, BAD);
    if (p.invocationNum !== 0) return null;
  }
  const cwd = workspaceDir(p);
  return absolute(cwd) ? { kind: "session-start", session, cwd } : refuse("session-start", p, session, BAD);
}

function decodePostInvocation(p: Payload, session: Session): HookEvent | Rejected {
  if (!(p.invocationNum === undefined || count(p.invocationNum))) return refuse("post-invocation", p, session, BAD);
  const cwd = workspaceDir(p);
  return absolute(cwd) ? { kind: "post-invocation", session, cwd } : refuse("post-invocation", p, session, BAD);
}

function decodeStop(p: Payload, session: Session): HookEvent | Rejected | null {
  if (!count(p.executionNum) || !flag(p.continuationActive) || !(p.terminationReason === undefined || typeof p.terminationReason === "string")) {
    return refuse("stop", p, session, BAD);
  }
  // User cancellations and custom-hook terminations already ended the turn; Stop must not reopen it.
  if (p.terminationReason === "USER_CANCELED" || p.terminationReason === "TERMINAL_CUSTOM_HOOK") return null;
  const cwd = workspaceDir(p);
  const reentry = typeof p.continuationActive === "boolean" ? p.continuationActive : p.executionNum > 0;
  return absolute(cwd) ? { kind: "stop", session, cwd, reentry } : refuse("stop", p, session, BAD);
}

function workspaceDir(p: Payload): unknown {
  const first = (p.workspacePaths as string[])[0];
  return first !== undefined ? first : p.cwd;
}

// A subagent is a conversation of its own, with nothing that links it to its parent [V].
function sessionOf(p: Payload): Session | null {
  const valid = typeof p.conversationId === "string" && Array.isArray(p.workspacePaths) && p.workspacePaths.every((w) => typeof w === "string");
  return valid ? { id: p.conversationId as string, harness: "agy", agentId: null, turnId: null, interactive: false } : null;
}

function tool(p: Payload, session: Session): HookEvent | Rejected | "ignore" | null {
  const call = p.toolCall;
  if (!isObject(call) || typeof call.name !== "string" || !isObject(call.args) || !count(p.stepIdx)) return null;
  const a = call.args;
  const base = { session, callId: String(p.stepIdx), tool: call.name };
  // Input to a running process: nothing tells what it writes (MH-11).
  if (call.name === "send_command_input") return refuse("pre", p, session, "shell-write");
  if (call.name === "manage_task") {
    if (a.Action === "send_input") return refuse("pre", p, session, "shell-write");
    return typeof a.Action === "string" && READ_ONLY_TASK_ACTIONS.has(a.Action) ? "ignore" : null;
  }
  // Only the command line and where it runs decide what runs; the wait before going async does not.
  // Without a Cwd agy picks a workspace, and which one among several is not known (MH-06).
  if (call.name === "run_command") {
    const w = p.workspacePaths as string[];
    const cwd = a.Cwd !== undefined && a.Cwd !== "" ? a.Cwd : absolute(p.cwd) ? p.cwd : w.length === 1 ? w[0] : null;
    return typeof a.CommandLine === "string" && absolute(cwd) ? { kind: "pre-command", command: { ...base, command: a.CommandLine, cwd } } : null;
  }
  const edit = editOf(call.name, a);
  const path = a.TargetFile ?? a.Path;
  return edit !== null && absolute(path) ? { kind: "pre-edit", changes: [{ ...base, path, edit, from: null }] } : null;
}

// A wrong type is a changed contract (null ⇒ payload-unrecognized). An argument outside the closed
// set may change what is written, and so may Append with Overwrite: that edit cannot be rebuilt.
function editOf(tool: string, a: Payload): Edit | null {
  const unknown: Edit = { form: "unknown", cause: tool };
  // No captured shape [V]: what these write cannot be rebuilt, so the call is refused inside a root.
  if (UNCAPTURED.has(tool)) return unknown;
  if (tool === "write_file") {
    if (typeof a.Content !== "string" || !flag(a.Append) || !flag(a.Overwrite)) return null;
    if (!keys(a, ["Path", "Content"], ["Append", "Overwrite", ...NOTES]) || (a.Append === true && a.Overwrite === true)) return unknown;
    return a.Append === true ? { form: "append", text: a.Content } : { form: "full", content: a.Content };
  }
  if (tool === "edit_file") {
    if (typeof a.Target !== "string" || typeof a.Replacement !== "string") return null;
    // Whether agy fails, takes the first or takes every match of a repeated Target is not verified.
    // A range over the whole file makes a missing or repeated Target unknown instead of a failure.
    return keys(a, ["Path", "Target", "Replacement"], NOTES) ? { form: "oldnew", old: a.Target, neu: a.Replacement, all: false, lines: [1, Number.MAX_SAFE_INTEGER] } : unknown;
  }
  if (tool === "write_to_file") {
    if (typeof a.CodeContent !== "string" || !flag(a.Append) || !flag(a.Overwrite)) return null;
    if (!keys(a, ["TargetFile", "CodeContent"], ["Append", "Overwrite", ...NOTES]) || (a.Append === true && a.Overwrite === true)) return unknown;
    return a.Append === true ? { form: "append", text: a.CodeContent } : { form: "full", content: a.CodeContent };
  }
  if (tool !== "replace_file_content") return null;
  if (typeof a.TargetContent !== "string" || typeof a.ReplacementContent !== "string" || !flag(a.AllowMultiple)) return null;
  const ranged = a.StartLine !== undefined || a.EndLine !== undefined;
  const range = count(a.StartLine) && count(a.EndLine) && 1 <= a.StartLine && a.StartLine <= a.EndLine;
  const closed = keys(a, ["TargetFile", "TargetContent", "ReplacementContent"], ["StartLine", "EndLine", "AllowMultiple", ...NOTES]);
  if (!closed || (ranged && !range)) return unknown;
  const lines: [number, number] | null = ranged ? [a.StartLine as number, a.EndLine as number] : null;
  return { form: "oldnew", old: a.TargetContent, neu: a.ReplacementContent, all: a.AllowMultiple === true, lines };
}

// `dirs` holds every directory the call names, so a refused call inside a root is still denied (MH-06).
function refuse(event: HookKind, p: Payload | null, session: Session | null, cause: Cause): Rejected {
  const call = isObject(p?.toolCall) ? p.toolCall : {};
  const a = isObject(call.args) ? call.args : {};
  const target = typeof a.TargetFile === "string" ? a.TargetFile : typeof a.Path === "string" ? a.Path : null;
  const file = target === null ? null : target.slice(0, target.lastIndexOf("/"));
  const dirs = [...(Array.isArray(p?.workspacePaths) ? p.workspacePaths : []), a.Cwd, p?.cwd, file].filter(absoluteLocation);
  const reentry = event === "stop" && (typeof p?.continuationActive === "boolean" ? p.continuationActive : count(p?.executionNum) && p.executionNum > 0);
  return { cause, kind: event === "pre" ? "pre-edit" : event, reentry, session, dirs };
}

function count(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0;
}

function flag(v: unknown): boolean {
  return v === undefined || typeof v === "boolean";
}
