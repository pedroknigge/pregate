import { posix, win32 } from "node:path";
import { pathKey, slash } from "../paths.ts";
import type { Cause, Decision, Edit, Emission, HookEnv, HookEvent, HookKind, Hunk, ProposedChange, Rejected, Session } from "../types.ts";
import { absolute, absoluteLocation, isObject, keys, type Payload, parse } from "./wire.ts";

// The OpenCode adapter (MULTI-HARNESS MH-05, MH-08, MH-14). OpenCode has no hook process of its own:
// the Pregate plugin (assets/opencode/pregate/index.ts) normalizes `execute.before` into the payload
// below and runs `pregate hook <event> --harness opencode`. A deny is exit 2 with a non-empty stderr;
// the plugin throws that text before the tool runs. Stdout on exit 0 is advice, never a denial.

// The OpenCode CLI whose plugin API, tool names and payloads are in test/payloads/opencode/.
// `opencode --version` prints the bare semver, e.g. "2.2.7".
export const VERIFIED = "2.2.7";

const CLI_VERSION = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\b/;

export function cliVersion(versionText: string): string | null {
  const line = versionText.trim().split("\n")[0] ?? "";
  return CLI_VERSION.exec(line)?.[1] ?? null;
}

const BAD: Cause = "payload-unrecognized";
const EVENTS: Record<string, HookKind> = { PreToolUse: "pre", Stop: "stop", SessionStart: "session-start" };
const BEGIN = "*** Begin Patch";
const END = "*** End Patch";
const ADD = "*** Add File: ";
const DELETE = "*** Delete File: ";
const UPDATE = "*** Update File: ";
const MOVE = "*** Move to: ";
const EOF = "*** End of File";
// The plugin strips OpenCode's optional environment header before the patch reaches this parser.
const ENVIRONMENT = /^\*\*\* Environment ID: .*$/;
// OpenCode trims header lines with Rust's whitespace: JavaScript's \s plus U+0085.
const EDGE = /^[\s\u0085]|[\s\u0085]$/;
// Any header, read leniently, to locate a patch that does not parse (MH-06).
const HEADER = /^\s*\*\*\* (?:Add File|Delete File|Update File|Move to): (.+)$/gm;

// Tools that change no file and run no command: their call is read and ignored, never refused.
// `subagent` passes because every tool call of the child session reaches this same shim [E2E].
const READ_ONLY: ReadonlySet<string> = new Set(["glob", "grep", "read", "skill", "webfetch", "websearch", "question", "subagent"]);

export function decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null {
  const p = parse(raw);
  const session = p === null ? null : sessionOf(p);
  if (p === null || session === null || !absolute(p.cwd) || named(p) !== event) return refuse(event, p, env);
  if (event === "session-start") return { kind: "session-start", session, cwd: p.cwd };
  if (event === "stop") return typeof p.stop_hook_active === "boolean" ? { kind: "stop", session, cwd: p.cwd, reentry: p.stop_hook_active } : refuse(event, p, env);
  // null is a recognized call that changes nothing; every unreadable call is a Rejected.
  return tool(p, session, p.cwd, env);
}

// MH-14. A deny is stderr and exit 2 only: the plugin throws that text and OpenCode fails the call.
// Halt and ask do not exist here (there is no hook-level stop and no approval channel), so both leave
// as the deny text; the notice is dropped for the same reason. Advice and a Stop block use stdout,
// which the plugin reads itself.
export function encode(kind: HookEvent["kind"], d: Decision): Emission {
  if (kind !== "stop" && d.verdict === "none" && d.full !== "") return { stdout: d.full, stderr: "", exit: 0 };
  if (kind === "session-start" || d.verdict === "none") return { stdout: "", stderr: "", exit: 0 };
  if (kind === "stop") return { stdout: JSON.stringify({ decision: "block", reason: d.full }) + "\n", stderr: "", exit: 0 };
  return { stdout: "", stderr: d.full, exit: 2 };
}

function named(p: Payload): HookKind | null {
  return typeof p.hook_event_name === "string" && Object.hasOwn(EVENTS, p.hook_event_name) ? EVENTS[p.hook_event_name]! : null;
}

// Never interactive: the plugin runs outside the TUI and OpenCode enforces no native approval for it.
function sessionOf(p: Payload): Session | null {
  if (typeof p.session_id !== "string" || ![p.turn_id, p.agent_id].every(optional)) return null;
  return {
    id: p.session_id, harness: "opencode", agentId: (p.agent_id as string | undefined) ?? null,
    turnId: (p.turn_id as string | undefined) ?? null, interactive: false,
  };
}

function refuse(event: HookKind, p: Payload | null, env: HookEnv): Rejected {
  const input = isObject(p?.tool_input) ? p.tool_input : {};
  const dirs = [...new Set([input.filePath, input.workdir, p?.cwd, env.projectDir].filter(absoluteLocation))];
  return {
    cause: BAD, kind: event === "pre" ? "pre-edit" : event, reentry: p?.stop_hook_active === true,
    session: p === null ? null : sessionOf(p), dirs,
  };
}

// The plugin sends the tool's input as OpenCode passes it. Closed keys: an extra key may change what
// the tool writes, so the call is judged by its path and never by content it may not be. Anything
// this function cannot read exactly is refused: an unknown tool name is untrusted input.
function tool(p: Payload, session: Session, cwd: string, env: HookEnv): HookEvent | Rejected | null {
  const input = p.tool_input;
  if (typeof p.tool_name !== "string" || typeof p.tool_use_id !== "string" || !isObject(input)) return refuse("pre", p, env);
  const base = { session, callId: p.tool_use_id, tool: p.tool_name };
  switch (p.tool_name) {
    case "shell":
      if (!keys(input, ["command"], ["workdir", "timeout", "background", "description"]) || typeof input.command !== "string" || !absolute(input.workdir)) return refuse("pre", p, env);
      // The plugin fills workdir from the session directory when OpenCode passes none.
      return { kind: "pre-command", command: { ...base, command: input.command, cwd: input.workdir } };
    case "write": {
      const edit: Edit = keys(input, ["filePath", "content"], []) && typeof input.content === "string"
        ? { form: "full", content: input.content } : { form: "unknown", cause: p.tool_name };
      return change(base, input.filePath, edit) ?? refuse("pre", p, env);
    }
    case "edit": {
      const edit: Edit = keys(input, ["filePath", "oldString", "newString"], ["replaceAll"])
        && typeof input.oldString === "string" && typeof input.newString === "string"
        && (input.replaceAll === undefined || typeof input.replaceAll === "boolean")
        ? { form: "oldnew", old: input.oldString, neu: input.newString, all: input.replaceAll === true, lines: null }
        : { form: "unknown", cause: p.tool_name };
      return change(base, input.filePath, edit) ?? refuse("pre", p, env);
    }
    case "patch":
      if (!keys(input, ["patchText"], []) || typeof input.patchText !== "string") return refuse("pre", p, env);
      return patched(p, base, input.patchText, cwd, env);
    case "execute":
      // Code mode runs nested tools inside one script. The plugin's execute.before cannot see those
      // calls, so an enabled root refuses the whole script instead of letting a write pass [E2E].
      return { ...refuse("pre", p, env), cause: "cannot-reconstruct" };
    default:
      return READ_ONLY.has(p.tool_name) ? null : refuse("pre", p, env);
  }
}

function change(base: { session: Session; callId: string; tool: string }, path: unknown, edit: Edit): HookEvent | null {
  return absolute(path) ? { kind: "pre-edit", changes: [{ ...base, path, edit, from: null }] } : null;
}

// OpenCode's patch tool takes the same `*** Begin Patch` grammar as Codex, plus an optional
// `*** Environment ID:` header line that carries no file operation. What does not parse exactly is
// refused (fail closed), never read another way.
function patched(p: Payload, base: { session: Session; callId: string; tool: string }, text: string, cwd: string, env: HookEnv): HookEvent | Rejected {
  const ops = patch(text);
  if (ops !== null && ops.length > 0) return { kind: "pre-edit", changes: ops.map((o): ProposedChange => ({ ...base, ...o })) };
  // The agent can resend the patch. Until then, the files it names locate the call.
  const r = refuse("pre", p, env);
  const paths = /^[a-z]:|^\/\//i.test(slash(cwd)) ? win32 : posix;
  const files = [...text.matchAll(HEADER)].map((m) => slash(paths.dirname(paths.resolve(cwd, m[1]!.trim()))));
  return { ...r, cause: "cannot-reconstruct", dirs: [...r.dirs, ...files] };
}

type Op = Pick<ProposedChange, "path" | "edit" | "from">;

function patch(text: string): Op[] | null {
  const lines = text.trim().split(/\r?\n/).filter((l) => !ENVIRONMENT.test(l));
  if (lines.length < 3 || lines[0] !== BEGIN || lines.at(-1) !== END) return null;
  const ops: Op[] = [];
  for (let i = 1; i < lines.length - 1;) {
    const line = lines[i++]!;
    const kind = [ADD, DELETE, UPDATE].find((m) => line.startsWith(m));
    const path = kind === undefined ? "" : line.slice(kind.length);
    if (!valid(path)) return null;
    if (kind === ADD) {
      let content = "";
      for (; lines[i]!.startsWith("+"); i++) content += `${lines[i]!.slice(1)}\n`;
      ops.push({ path, edit: { form: "full", content }, from: null });
      continue;
    }
    if (kind === DELETE) {
      ops.push({ path, edit: { form: "delete" }, from: null });
      continue;
    }
    const to = lines[i]!.startsWith(MOVE) ? lines[i++]!.slice(MOVE.length) : null;
    if (to !== null && !valid(to)) return null;
    const hunks: Hunk[] = [];
    for (let at = lines[i]!; at === "@@" || at.startsWith("@@ "); at = lines[i]!) {
      const read = hunkAt(lines, i);
      if (read === null) return null;
      hunks.push(read.hunk);
      i = read.next;
    }
    if (hunks.length === 0) return null;
    // A hunk with no line to find is an insertion: no Hunk says where it lands, so it stays unknown.
    const edit: Edit = hunks.some((h) => h.old.length === 0) ? { form: "unknown", cause: "patch-insertion" } : { form: "hunks", hunks };
    if (to === null) ops.push({ path, edit, from: null });
    else ops.push({ path, edit: { form: "delete" }, from: null }, { path: to, edit, from: path });
  }
  // The operations run in order, so a file named twice would be judged by neither half alone.
  return new Set(ops.map((o) => pathKey(o.path.normalize("NFD")))).size === ops.length ? ops : null;
}

function hunkAt(lines: string[], i: number): { hunk: Hunk; next: number } | null {
  const at = lines[i]!;
  const h: Hunk = { anchor: at === "@@" ? null : at.slice(3), old: [], neu: [], eof: false };
  if (h.anchor !== null && (h.anchor === "" || EDGE.test(h.anchor))) return null;
  for (i++; ; i++) {
    const l = lines[i]!;
    if (l === EOF) {
      h.eof = true;
      i++;
      break;
    }
    if (l === "" || l[0] === " ") {
      h.old.push(l.slice(1));
      h.neu.push(l.slice(1));
    } else if (l[0] === "-") h.old.push(l.slice(1));
    else if (l[0] === "+") h.neu.push(l.slice(1));
    else break;
  }
  if (h.old.length === 0 && h.neu.length === 0) return null;
  return { hunk: h, next: i };
}

function valid(path: string): boolean {
  return absolute(path) && !EDGE.test(path);
}

function optional(v: unknown): boolean {
  return v === undefined || typeof v === "string";
}
