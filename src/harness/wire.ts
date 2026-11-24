import { slash } from "../paths.ts";
import type { Decision, Emission, HarnessId, HookEvent } from "../types.ts";

export type Payload = Record<string, unknown>;

export function parse(raw: string): Payload | null {
  try {
    const v: unknown = JSON.parse(raw);
    return isObject(v) ? v : null;
  } catch {
    return null;   // not JSON: the payload is unrecognized, a known cause
  }
}

export function isObject(v: unknown): v is Payload {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// A closed key set: an unknown key in an edit may change what the tool writes ("update PREGATE").
export function keys(o: Payload, required: string[], optional: string[]): boolean {
  return required.every((k) => Object.hasOwn(o, k)) && Object.keys(o).every((k) => required.includes(k) || optional.includes(k));
}

// Absolute and normalized (ARCHITECTURE §7.2 #23): a `..` in the part that does not exist yet could
// change the layer or leave the root after canonicalization.
export function absolute(path: unknown): path is string {
  if (typeof path !== "string" || path.includes("\0") || /^\\\\\.\\/.test(path) || /^\\(?!\\)/.test(path)) return false;
  // Validate segments before normalization: it must never erase traversal from a hook payload.
  const plain = path.replace(/^\\\\\?\\UNC\\/i, "//").replace(/^\\\\\?\\/, "").replaceAll("\\", "/");
  const prefix = /^(?:[a-z]:\/|\/\/[^/]+\/[^/]+\/?|\/)/i.exec(plain)?.[0];
  if (prefix === undefined || (plain.startsWith("//") && !/^\/\/[^/]+\/[^/]+/.test(plain))) return false;
  return slash(plain) !== "" && (plain === prefix || plain.slice(prefix.length).split("/").every((s) => s !== "" && s !== "." && s !== ".." && !s.includes(":")));
}

// A rejected payload still needs its directories: traversal must locate the consenting root
// and deny there, rather than disappearing as a rootless call.
export function absoluteLocation(path: unknown): path is string {
  return typeof path === "string" && (/^(?:\/|[a-z]:[\\/]|\\\\)/i.test(path));
}

export function json(o: object): string {
  return `${JSON.stringify(o)}\n`;
}

const HookBrand = Symbol("pregate.hook");
const EnabledBrand = Symbol("pregate.enabled");

export type Budget<Chars extends number, Lines extends number> = { readonly chars: Chars; readonly lines: Lines };
export type HookMessage<Chars extends number, Lines extends number> = string & {
  readonly [HookBrand]: { readonly chars: Chars; readonly lines: Lines; readonly repairFirst: true };
};

const GROK = { chars: 256, lines: 1 } as const;
const TEXT = { chars: 4000, lines: 4000 } as const;

// A PREGATE line already leads with the repair inside that prefix. Prepending it again would change the bytes the harness contracts lock.
export function budgeted<Chars extends number, Lines extends number>(
  budget: Budget<Chars, Lines>, repair: string, wire: string,
): HookMessage<Chars, Lines> {
  if (wire.length === 0) return "" as HookMessage<Chars, Lines>;
  const next = repair.trim();
  const composed = next.length === 0 || wire.includes(next) || wire.startsWith("PREGATE ") ? wire : `${next}\n${wire}`;
  return fit(composed, budget.chars, budget.lines) as HookMessage<Chars, Lines>;
}

function fit(text: string, chars: number, lines: number): string {
  const flat = lines === 1 ? text.replace(/[\r\n]+/g, " ") : text;
  const kept = flat.split("\n").slice(0, lines).join("\n");
  return kept.length <= chars ? kept : kept.slice(0, chars);
}

function line<Chars extends number, Lines extends number>(
  budget: Budget<Chars, Lines>, d: Decision, text: string,
): HookMessage<Chars, Lines> | "" {
  if (text.length === 0) return "";
  // An approval sentence is already the next step. A PREGATE line already contains the repair.
  const repair = d.fix?.text?.trim() ?? "";
  const next = repair.length > 0 && (text.startsWith("PREGATE ") || text.includes(repair)) ? repair : text;
  return budgeted(budget, next, text);
}

export type EnabledScope = { readonly [EnabledBrand]: true; readonly root: string };
export type InactiveScope = { readonly kind: "inactive" };
export type ProtocolScope = { readonly kind: "protocol" };
export type PassiveDecision = Omit<Decision, "verdict" | "halt"> & { readonly verdict: "none"; readonly halt: false };
export type ProtocolDecision = Omit<Decision, "cause"> & { readonly cause: "payload-unrecognized" };
export type Place = "enforced" | "protocol" | "off";
export type WireDecision =
  | { readonly scope: EnabledScope; readonly decision: Decision }
  | { readonly scope: ProtocolScope; readonly decision: ProtocolDecision }
  | { readonly scope: InactiveScope; readonly decision: PassiveDecision };

function mint(root: string): EnabledScope {
  return { [EnabledBrand]: true, root };
}

export function enabledWire(decision: Decision): WireDecision {
  return { scope: mint(decision.enforcedAt ?? "/adapter-contract"), decision };
}

export function blockAt(decision: Decision, root: string | null): Decision {
  if (decision.verdict === "none" || root === null) return decision;
  return { ...decision, enforcedAt: root };
}

// A project block is emitted only for a root where pregate enable is in effect.
// An unreadable payload still fail-closes while a review is pending. A session that reached some other root does not.
export function wireOf(decision: Decision, dirs: readonly string[], place: (dir: string) => Place): WireDecision {
  const named = decision.enforcedAt !== undefined && located(place, decision.enforcedAt) === "enforced" ? decision.enforcedAt : null;
  const root = named ?? (decision.verdict === "none" ? null : first(dirs, place, "enforced"));
  if (root !== null && decision.verdict !== "none") return { scope: mint(root), decision };
  if (decision.verdict !== "none" && decision.cause === "payload-unrecognized" && first(dirs, place, "protocol") !== null) {
    return { scope: { kind: "protocol" }, decision: decision as ProtocolDecision };
  }
  if (decision.verdict === "none" && decision.halt !== true) return { scope: { kind: "inactive" }, decision: decision as PassiveDecision };
  return { scope: { kind: "inactive" }, decision: passivate(decision) };
}

// The block's text is not advice. An inactive scope prints nothing from it.
function passivate(d: Decision): PassiveDecision {
  return { ...d, verdict: "none", halt: false, compact: "", full: "", notice: null, fix: null, enforcedAt: undefined };
}

function located(place: (dir: string) => Place, dir: string): Place | null {
  if (dir === "") return null;
  try { return place(dir); }
  catch (error) {
    if (error instanceof Error && error.message.endsWith(": no existing ancestor")) return "off";
    throw error;
  }
}

function first(dirs: readonly string[], place: (dir: string) => Place, want: Place): string | null {
  for (const dir of dirs) if (located(place, dir) === want) return dir;
  return null;
}

export function deliver(id: HarnessId, kind: HookEvent["kind"], scoped: WireDecision, flag = false): Emission {
  const d = scoped.decision;
  switch (id) {
    case "agy": return renderAgy(kind, d);
    case "claude-code": return renderClaude(kind, d, flag);
    case "codex": return renderCodex(kind, d, flag);
    case "cursor": return renderCursor(kind, d, flag);
    case "grok": return renderGrok(kind, d);
    case "opencode": return renderOpencode(kind, d);
  }
}

export function nativePreAllow(): Emission {
  return { stdout: json({ permission: "allow" }), stderr: "", exit: 0 };
}

function quiet(o: object): Emission {
  return { stdout: Object.keys(o).length === 0 ? "" : json(o), stderr: "", exit: 0 };
}

function context(hookEventName: string, text: string): object {
  return text === "" ? {} : { hookSpecificOutput: { hookEventName, additionalContext: text } };
}

// Empty stdout is the only neutral: a decision of allow skips agy's permission prompt.
function renderAgy(kind: HookEvent["kind"], d: Decision): Emission {
  if (kind === "session-start" && d.verdict === "none" && d.full !== "") {
    return { stdout: json({ injectSteps: [{ systemMessage: { systemMessage: line(TEXT, d, d.full) } }] }), stderr: "", exit: 0 };
  }
  if (kind === "post-invocation") return renderAgyPost(d);
  if (kind === "session-start" || d.verdict === "none") return { stdout: "", stderr: "", exit: 0 };
  if (kind === "pre-command" && d.verdict === "ask" && d.contractApproval !== true) {
    return { stdout: json({ decision: "force_ask", reason: line(TEXT, d, d.notice ?? d.compact) }), stderr: "", exit: 0 };
  }
  return { stdout: json({ decision: kind === "stop" ? "continue" : "deny", reason: line(TEXT, d, d.full) }), stderr: "", exit: 0 };
}

function renderAgyPost(d: Decision): Emission {
  if (d.halt && d.notice !== null) {
    return { stdout: json({ injectSteps: [{ errorMessage: { userMessage: line(TEXT, d, d.notice) } }], terminationBehavior: "terminate" }), stderr: "", exit: 0 };
  }
  if (d.verdict === "none" && d.full !== "") {
    return { stdout: json({ injectSteps: [{ systemMessage: { systemMessage: line(TEXT, d, d.full) } }] }), stderr: "", exit: 0 };
  }
  return { stdout: "", stderr: "", exit: 0 };
}

// Exit 2 still blocks when the JSON does not arrive. A subagent start carries only the briefing.
function renderClaude(e: HookEvent["kind"], d: Decision, subagent: boolean): Emission {
  const told = d.notice === null ? {} : { systemMessage: line(TEXT, d, d.notice) };
  if (e === "session-start" && subagent) return quiet(context("SubagentStart", d.verdict === "none" ? line(TEXT, d, d.full) : ""));
  if (e === "session-start") return quiet({ ...context("SessionStart", d.verdict === "none" ? line(TEXT, d, d.full) : ""), ...told });
  if (e === "post-invocation") return quiet({});
  if (d.verdict === "none") return e === "stop" ? quiet(told) : quiet({ ...context("PreToolUse", line(TEXT, d, d.full)), ...told });
  const full = line(TEXT, d, d.full);
  if (e === "stop") return { stdout: json({ decision: "block", reason: full, ...told }), stderr: full, exit: 2 };
  if (d.verdict === "ask") {
    const ask = { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: line(TEXT, d, d.notice ?? d.compact), additionalContext: full };
    return quiet({ hookSpecificOutput: ask });
  }
  const halt = d.halt ? { continue: false, stopReason: line(TEXT, d, d.notice ?? d.compact) } : told;
  return { stdout: json({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: full }, ...halt }), stderr: full, exit: 2 };
}

// Codex ignores stdout on exit 2, and one extra JSON key lets the tool run. Halt and ask leave as that stderr.
function renderCodex(kind: HookEvent["kind"], d: Decision, subagent: boolean): Emission {
  if (kind !== "stop" && kind !== "post-invocation" && d.verdict === "none" && d.full !== "") {
    const hookEventName = kind === "session-start" ? subagent ? "SubagentStart" : "SessionStart" : "PreToolUse";
    return { stdout: json({ hookSpecificOutput: { hookEventName, additionalContext: line(TEXT, d, d.full) } }), stderr: "", exit: 0 };
  }
  if (kind === "post-invocation") return { stdout: "", stderr: "", exit: 0 };
  if (kind === "session-start" || d.verdict === "none") {
    return { stdout: !subagent && d.notice !== null ? json({ systemMessage: line(TEXT, d, d.notice) }) : "", stderr: "", exit: 0 };
  }
  if (kind === "stop") return { stdout: json({ decision: "block", reason: line(TEXT, d, d.full) }), stderr: "", exit: 0 };
  return { stdout: "", stderr: line(TEXT, d, d.full), exit: 2 };
}

// Native preToolUse must print permission allow. Empty stdout under failClosed is a failure, not an allow.
function renderCursor(kind: HookEvent["kind"], d: Decision, native: boolean): Emission {
  if (native && (kind === "pre-edit" || kind === "pre-command")) {
    if (d.verdict === "none") return nativePreAllow();
    const text = line(TEXT, d, d.full);
    return { stdout: json({ permission: "deny", user_message: text, agent_message: text }), stderr: "", exit: 0 };
  }
  if (kind !== "stop" && kind !== "post-invocation" && d.verdict === "none" && d.full !== "") {
    return { stdout: json({ additional_context: line(TEXT, d, d.full) }), stderr: "", exit: 0 };
  }
  if (d.verdict === "none" || kind === "session-start" || kind === "post-invocation") return { stdout: "", stderr: "", exit: 0 };
  if (kind === "stop") return { stdout: json({ followup_message: line(TEXT, d, d.full) }), stderr: "", exit: 0 };
  return { stdout: json({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: line(TEXT, d, d.full) } }), stderr: "", exit: 0 };
}

// Grok shows the model the first line only, cut at 256 characters. Halt and ask have no channel.
function renderGrok(e: HookEvent["kind"], d: Decision): Emission {
  if (e !== "stop" && e !== "session-start" && e !== "post-invocation" && d.verdict === "none" && d.full !== "") {
    return { stdout: json({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: line(TEXT, d, d.full) } }), stderr: "", exit: 0 };
  }
  if (e === "session-start" || e === "post-invocation" || d.verdict === "none") return { stdout: "", stderr: "", exit: 0 };
  const reason = line(GROK, d, d.compact);
  if (e === "stop") return { stdout: json({ decision: "block", reason }), stderr: "", exit: 0 };
  return { stdout: json({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }), stderr: reason, exit: 2 };
}

// The plugin throws nonempty stderr before the tool runs. Stdout on exit 0 is advice, never a denial.
function renderOpencode(kind: HookEvent["kind"], d: Decision): Emission {
  if (kind !== "stop" && d.verdict === "none" && d.full !== "") return { stdout: line(TEXT, d, d.full), stderr: "", exit: 0 };
  if (kind === "session-start" || d.verdict === "none") return { stdout: "", stderr: "", exit: 0 };
  if (kind === "stop") return { stdout: json({ decision: "block", reason: line(TEXT, d, d.full) }), stderr: "", exit: 0 };
  return { stdout: "", stderr: line(TEXT, d, d.full), exit: 2 };
}
