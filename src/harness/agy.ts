import type { Cause, Decision, Edit, Emission, HookEnv, HookEvent, HookKind, Rejected, Session } from "../types.ts";
import { absolute, absoluteLocation, isObject, json, keys, type Payload, parse } from "./wire.ts";

// The Antigravity CLI (agy) adapter (MULTI-HARNESS MH-05, MH-11, MH-14). The payload names no event,
// cwd or call: argv gives the event, stepIdx the call, and run_command's Cwd or the workspace the
// directory. An empty stdout leaves the call to agy's own permission flow, so it is the only
// neutral: "allow" would skip that flow. 1.5.3 renamed the edit tools (write_file, edit_file, with
// Path) and added a top-level cwd; the 1.2.14 names and shapes are still decoded.

export const VERIFIED = "1.5.3";

const BAD: Cause = "payload-unrecognized";
// What agy shows the user or keeps as metadata: none of it changes the bytes written (MH-11).
const NOTES = ["Description", "Instruction", "TargetLintErrorIds", "ArtifactMetadata", "toolAction", "toolSummary"];

const UNCAPTURED = new Set(["multi_replace_file_content", "create_file", "delete_file", "rename_file", "notebook_edit"]);

// PreInvocation supplies the session briefing only before the first model call.
export function decode(event: HookKind, raw: string, _env: HookEnv): HookEvent | Rejected | null {
  const p = parse(raw);
  const session = p === null ? null : sessionOf(p);
  if (p === null || session === null) return refuse(event, p, session, BAD);
  if (event === "session-start") {
    if (!count(p.invocationNum)) return refuse(event, p, session, BAD);
    if (p.invocationNum !== 0) return null;
    const cwd = (p.workspacePaths as string[])[0];
    return absolute(cwd) ? { kind: "session-start", session, cwd } : refuse(event, p, session, BAD);
  }
  if (event === "stop") {
    const cwd = (p.workspacePaths as string[])[0];
    return count(p.executionNum) && absolute(cwd) ? { kind: "stop", session, cwd, reentry: p.executionNum > 0 } : refuse(event, p, session, BAD);
  }
  return (event === "pre" ? tool(p, session) : null) ?? refuse(event, p, session, BAD);
}

// Every reply is exit 0: agy reads a deny from JSON, and nobody can answer an ask (MH-05) nor see a
// halt, so both leave as the deny's text. A Stop that blocks reopens the agent loop.
export function encode(kind: HookEvent["kind"], d: Decision): Emission {
  if (kind === "session-start" && d.verdict === "none" && d.full !== "") return { stdout: json({ injectSteps: [{ ephemeralMessage: d.full }] }), stderr: "", exit: 0 };
  if (kind === "session-start" || d.verdict === "none") return { stdout: "", stderr: "", exit: 0 };
  return { stdout: json({ decision: kind === "stop" ? "continue" : "deny", reason: d.full }), stderr: "", exit: 0 };
}

// A subagent is a conversation of its own, with nothing that links it to its parent [V].
function sessionOf(p: Payload): Session | null {
  const valid = typeof p.conversationId === "string" && Array.isArray(p.workspacePaths) && p.workspacePaths.every((w) => typeof w === "string");
  return valid ? { id: p.conversationId as string, harness: "agy", agentId: null, turnId: null, interactive: false } : null;
}

function tool(p: Payload, session: Session): HookEvent | Rejected | null {
  const call = p.toolCall;
  if (!isObject(call) || typeof call.name !== "string" || !isObject(call.args) || !count(p.stepIdx)) return null;
  const a = call.args;
  const base = { session, callId: String(p.stepIdx), tool: call.name };
  // Input to a running process: nothing tells what it writes (MH-11).
  if (call.name === "send_command_input") return refuse("pre", p, session, "shell-write");
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
    if (typeof a.Content !== "string" || !flag(a.Overwrite)) return null;
    return keys(a, ["Path", "Content"], ["Overwrite", ...NOTES]) ? { form: "full", content: a.Content } : unknown;
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
  return { cause, kind: event === "pre" ? "pre-edit" : event, reentry: event === "stop" && count(p?.executionNum) && p.executionNum > 0, session, dirs };
}

function count(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0;
}

function flag(v: unknown): boolean {
  return v === undefined || typeof v === "boolean";
}
