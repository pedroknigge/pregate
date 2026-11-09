import { posix, win32 } from "node:path";
import { pathKey, slash } from "../paths.ts";
import type { Cause, Decision, Edit, Emission, HookEnv, HookEvent, HookKind, Hunk, ProposedChange, Rejected, Session } from "../types.ts";
import { absolute, absoluteLocation, isObject, json, keys, type Payload, parse } from "./wire.ts";

// The Codex CLI adapter (MULTI-HARNESS MH-05, MH-08, MH-14). Codex blocks only on exit 2 with a
// non-empty stderr, and every other failure of the hook runs the tool: decode refuses what it cannot
// read exactly, and encode never relies on stdout before a tool runs.

// Minimum supported Codex CLI. 0.166.0 is the first stable release whose PreToolUse `cwd` is the
// command workdir (openai/codex#57198). 0.167.0 is required because direct Guardian review ran
// without PreToolUse hooks before that release, so a deny could be bypassed (openai/codex#58368).
// The payload has no version field and the same shape as 0.159.2, so an older CLI cannot be told
// apart and is not supported.
export const VERIFIED = "0.167.0";

const CLI_VERSION = /^codex(?:-cli)?\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\b/;

// The first line of `codex --version` is `codex-cli <semver>`.
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
// Codex trims header lines with Rust's whitespace: JavaScript's \s plus U+0085.
const EDGE = /^[\s\u0085]|[\s\u0085]$/;
// Any header, read leniently, to locate a patch that does not parse (MH-06).
const HEADER = /^\s*\*\*\* (?:Add File|Delete File|Update File|Move to): (.+)$/gm;

export function decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null {
  const p = parse(raw);
  const session = p === null ? null : sessionOf(p);
  if (p === null || session === null || !absolute(p.cwd) || named(p) !== event) return refuse(event, p, env);
  if (event === "session-start") return { kind: "session-start", session, cwd: p.cwd };
  if (event === "stop") return typeof p.stop_hook_active === "boolean" ? { kind: "stop", session, cwd: p.cwd, reentry: p.stop_hook_active } : refuse(event, p, env);
  return tool(p, session, p.cwd, env) ?? refuse(event, p, env);
}

// MH-14. A deny is stderr and exit 2 only: Codex ignores stdout on exit 2, and a JSON reply with one
// key too many lets the tool run. Halt does not exist (continue:false makes the hook fail and the
// tool run), nor does ask (Codex treats it as no decision): both leave as the deny text.
export function encode(kind: HookEvent["kind"], d: Decision): Emission {
  if (kind !== "stop" && d.verdict === "none" && d.full !== "") {
    const hookEventName = kind === "session-start" ? "SessionStart" : "PreToolUse";
    return { stdout: json({ hookSpecificOutput: { hookEventName, additionalContext: d.full } }), stderr: "", exit: 0 };
  }
  if (kind === "session-start" || d.verdict === "none") return { stdout: "", stderr: "", exit: 0 };
  if (kind === "stop") return { stdout: json({ decision: "block", reason: d.full }), stderr: "", exit: 0 };
  return { stdout: "", stderr: d.full, exit: 2 };
}

function named(p: Payload): HookKind | null {
  return typeof p.hook_event_name === "string" && Object.hasOwn(EVENTS, p.hook_event_name) ? EVENTS[p.hook_event_name]! : null;
}

// Never interactive: `codex exec` reports bypassPermissions whatever the policy, and an ask fails open.
function sessionOf(p: Payload): Session | null {
  if (typeof p.session_id !== "string" || ![p.turn_id, p.agent_id].every(optional)) return null;
  return {
    id: p.session_id, harness: "codex", agentId: (p.agent_id as string | undefined) ?? null,
    turnId: (p.turn_id as string | undefined) ?? null, interactive: false,
  };
}

function refuse(event: HookKind, p: Payload | null, env: HookEnv): Rejected {
  const dirs = [p?.cwd, env.projectDir].filter(absoluteLocation);
  return {
    cause: BAD, kind: event === "pre" ? "pre-edit" : event, reentry: p?.stop_hook_active === true,
    session: p === null ? null : sessionOf(p), dirs,
  };
}

// The registration matches ^(apply_patch|Bash)$. `tool_input` is still only `{command}`: Codex puts the
// resolved workdir in the top-level `cwd` (Bash), not in a second key. apply_patch has no tool cwd, so
// its `cwd` stays the session directory. An extra tool_input key is still refused.
function tool(p: Payload, session: Session, cwd: string, env: HookEnv): HookEvent | Rejected | null {
  const input = p.tool_input;
  if (typeof p.tool_name !== "string" || typeof p.tool_use_id !== "string" || !isObject(input)) return null;
  if (!keys(input, ["command"], []) || typeof input.command !== "string") return null;
  // Code mode reuses one exec-<uuid> for every tool call of a script [V]: the input tells them apart.
  const base = { session, callId: `${p.tool_use_id}~${(require("node:crypto") as typeof import("node:crypto")).createHash("sha256").update(input.command).digest("hex").slice(0, 12)}`, tool: p.tool_name };
  if (p.tool_name === "Bash") return { kind: "pre-command", command: { ...base, command: input.command, cwd } };
  if (p.tool_name !== "apply_patch") return null;
  const ops = patch(input.command);
  if (ops !== null) return { kind: "pre-edit", changes: ops.map((o): ProposedChange => ({ ...base, ...o })) };
  // The agent can resend the patch. Until then, the files it names locate the call.
  const r = refuse("pre", p, env);
  const paths = /^[a-z]:|^\/\//i.test(slash(cwd)) ? win32 : posix;
  const files = [...input.command.matchAll(HEADER)].map((m) => slash(paths.dirname(paths.resolve(cwd, m[1]!.trim()))));
  return { ...r, cause: "cannot-reconstruct", dirs: [...r.dirs, ...files] };
}

type Op = Pick<ProposedChange, "path" | "edit" | "from">;

// MH-08: the grammar checked against Codex 0.159.2's apply_patch, without its leniency (a heredoc
// around the patch, a first hunk without @@, whitespace around markers). What does not parse exactly
// is never read another way: null. Checked against Codex's own apply_patch: lines split as Rust's lines() splits them, an
// empty line inside a hunk is an empty context line, and Add content ends in \n.
function patch(text: string): Op[] | null {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 3 || lines[0] !== BEGIN || lines.at(-1) !== END) return null;
  const ops: Op[] = [];
  // END is the last line and no rule below accepts it, so no loop reads past it.
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
    // A hunk with no line to find is an insertion, which Codex appends at the end of the file whatever
    // its anchor [V]: no Hunk says that, so it stays unknown (MH-08).
    const edit: Edit = hunks.some((h) => h.old.length === 0) ? { form: "unknown", cause: "patch-insertion" } : { form: "hunks", hunks };
    if (to === null) ops.push({ path, edit, from: null });
    else ops.push({ path, edit: { form: "delete" }, from: null }, { path: to, edit, from: path });
  }
  // Codex applies the operations in order, so a file named twice would be judged by neither half
  // alone. APFS folds case and Unicode normalization: "A.ts" and "a.ts" are one file.
  return new Set(ops.map((o) => pathKey(o.path.normalize("NFD")))).size === ops.length ? ops : null;
}

// The hunk whose @@ line is lines[i], and the index of the line after it; null if it does not parse.
function hunkAt(lines: string[], i: number): { hunk: Hunk; next: number } | null {
  const at = lines[i]!;
  // Codex reads "@@ " as no anchor and matches an anchor loosely [V]: only an exact one is read.
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

// Absolute and normalized, with no whitespace at an edge for Codex to trim away.
function valid(path: string): boolean {
  return absolute(path) && !EDGE.test(path);
}

function optional(v: unknown): boolean {
  return v === undefined || typeof v === "string";
}
