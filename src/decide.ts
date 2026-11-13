import { FIXABLE_BY } from "./types.ts";
import { enforcementOf, LOOP_DEFAULTS, ruleEnforcements } from "./enforcement.ts";
import { staticRulesFor } from "./languages.ts";
import { inScope } from "./paths.ts";
import type { CallEvent, Cause, Decision, DecideInput, Form, Lock, Loop, Phase, Violation } from "./types.ts";
import { adviseText, denyText, formText, notice, stopText, syntaxAdvisory, unresolvedAdvisory, warnText } from "./message.ts";
import type { Close, Halt, Text } from "./message.ts";

// Policy: severity × enforcement × counters × no-progress × ask → Decision (SPEC §11.3,
// ARCHITECTURE §4.1 step 14 and §4.3). A call can observe some rules while others block.

export { LOOP_DEFAULTS } from "./enforcement.ts";

// A grammar gap or a bad reconstruction must not loop forever (ARCHITECTURE §7.2 #14).
const FORM_RUN_MAX = 3;

// Causes that leave a protected path unevaluated: shadow never mutes them. A non-literal shell
// target may be a protected path. An unresolved import is not one of these: shadow still blocks
// it, and advisor blocks it only when an enforced static rule would be skipped.
const GUARDS: ReadonlySet<Cause> = new Set<Cause>([
  "protected-path", "request-invalid", "shell-admin", "shell-write", "hook-switch",
]);

const NO_STOP: NonNullable<DecideInput["stop"]> = { blocks: 0, reentry: false, approved: [] };

type Attempt = Pick<CallEvent, "astHash" | "violations">;
interface Sorted {
  form: Form | null; block: Violation[]; advised: Violation[]; warnings: Violation[];
  muted: Violation[]; mutedForm: Form | null;    // what shadow kept from blocking
}

export function decide(i: DecideInput): Decision {
  const s = classify(i);
  const own = i.history.filter((e) => e.agentId === i.session.agentId)
    .map((e) => ({ ...e, violations: e.violations.filter((v) => e.enforcement?.[v.rule] !== "shadow" && e.enforcement?.[v.rule] !== "advisor") }));
  const stop = i.event === "stop";
  // A form cause hides the violations of the same call: they show once the file can be evaluated.
  if (s.form !== null) return stop ? stopBlock(i, s, formText(s.form, i.path)) : formDeny(i, s.form, own);
  if (i.lock === null || s.block.length === 0) return withHeldAdvisory(i, s, stop ? { ...quiet(i, s), notice: approved(i) } : quiet(i, s));
  const d = stop ? stopBlock(i, s, stopText(s.block, i.lock, i)) : ruleDeny(i, i.lock, s, own);
  return withHeldAdvisory(i, s, { ...d, shadowed: s.muted.length > 0 || s.mutedForm !== null });
}

// An advisor parse failure or unresolved import stays non-blocking. Its text replaces a clean result, and it follows a real deny.
function withHeldAdvisory(i: DecideInput, s: Sorted, d: Decision): Decision {
  const held = s.mutedForm;
  if (i.lock?.enforcement !== "advisor" || s.form !== null || held === null || (held.cause !== "syntax" && held.cause !== "unresolvable-import")) return d;
  const warning = held.cause === "syntax" ? syntaxAdvisory(held, i.path) : unresolvedAdvisory(held, i.path);
  if (d.full === "") return { ...d, compact: warning.compact, full: warning.full };
  const body = d.verdict === "none" ? `${warning.full}\n\n${d.full}` : `${d.full}\n\n${warning.full}`;
  const full = body.length <= 4000 ? body : body.slice(0, 4000);
  return d.verdict === "none" ? { ...d, compact: warning.compact, full } : { ...d, full };
}

// MH-09: reserve room for the other blocked files before clipping the chosen file's details.
export function merge(ds: Decision[]): Decision {
  const blocks = (d: Decision): boolean => d.verdict !== "none";
  const chosen = ds.find((d) => d.halt) ?? ds.find((d) => d.verdict === "deny") ?? ds.find(blocks) ?? ds.find((d) => d.full !== "") ?? ds[0];
  if (chosen === undefined) throw new Error("merge: a call without files");
  const rest = ds.filter((d) => d !== chosen && (blocks(chosen) ? blocks(d) : d.compact !== ""));
  const notices = [chosen, ...rest].filter((d) => d.verdict === chosen.verdict && d.notice !== null).map((d) => d.notice);
  let extra = "";
  let added = 0;
  if (rest.length > 0) {
    extra = "\n\nAlso in this call:";
    for (const d of rest) {
      if (chosen.compact.length + extra.length + d.compact.length + 1 > 3920) break;
      extra += `\n${d.compact}`;
      added++;
    }
    if (added < rest.length) extra += `\n${rest.length - added} more files; run pregate check.`;
  }
  const full = extra === "" ? chosen.full : chosen.full.slice(0, 4000 - extra.length) + extra;
  return { ...chosen, full, notice: notices.length === 0 ? null : notices.join("\n\n") };
}

// Enforcement, shared with `check`: integrity and human/protected-path causes still block in shadow.
// Syntax and an unresolved import block when they hide an applicable static enforce policy.
// Shadow keeps every unresolved import, because integrity stays enforced there. `warn` never blocks.
export function blocking(lock: Lock, vs: Violation[], cause: Cause | null, context?: { rel: string | null; phase: Phase }): { cause: Cause | null; violations: Violation[] } {
  const on = enforced(lock);
  const kept = cause !== null && (lock.enforcement === "enforce" || FIXABLE_BY[cause] === "human" || GUARDS.has(cause)
    || (cause === "syntax" && enforcedStatic(lock, context, false))
    || (cause === "unresolvable-import" && (lock.enforcement !== "advisor" || enforcedStatic(lock, context, true))));
  return { cause: kept ? cause : null, violations: vs.filter((v) => v.severity !== "warn" && on(v)) };
}

// A shadow or advisor default must not hide a file an explicitly enforcing static policy would judge.
// Syntax ignores integrity rules: in shadow those stay enforce, and a parse gap is not their gate.
// An unresolved import counts them, because that form is returned instead of their findings.
// Scope, language, ownership and phase still matter; unrelated enforcement is not a gate.
function enforcedStatic(lock: Lock, context: { rel: string | null; phase: Phase } | undefined, integrity: boolean): boolean {
  if (!context?.rel || !inScope(lock, context.rel)) return false;
  const rules = lock.rules.filter(r => (integrity || !r.integrity) && r.phases.includes(context.phase)
    && (r.severity === "deny" || r.severity === "ask") && enforcementOf(lock, r) === "enforce");
  return staticRulesFor({ ...lock, rules }, context.rel).length > 0;
}

function enforced(lock: Lock): (v: Violation) => boolean {
  const policies = ruleEnforcements(lock);
  return (v) => (policies[v.rule] ?? lock.enforcement) === "enforce";
}

function classify(i: DecideInput): Sorted {
  if (i.lock === null) return { form: i.form, block: [], advised: [], warnings: [], muted: [], mutedForm: null };
  const policies = ruleEnforcements(i.lock);
  const policyOf = (v: Violation) => policies[v.rule] ?? i.lock!.enforcement;
  const b = blocking(i.lock, i.introduced, i.form?.cause ?? null, { rel: i.path, phase: i.event === "stop" ? "stop" : "pre" });
  return {
    form: b.cause === null ? null : i.form,
    block: b.violations,
    advised: i.introduced.filter((v) => policyOf(v) === "advisor"),
    warnings: i.introduced.filter((v) => v.severity === "warn" && policyOf(v) === "enforce"),
    muted: i.introduced.filter((v) => v.severity !== "warn" && policyOf(v) === "shadow"),
    mutedForm: b.cause === null ? i.form : null,
  };
}

function quiet(i: DecideInput, s: Sorted): Decision {
  const text = i.lock === null ? { compact: "", full: "" }
    : s.advised.length > 0 ? adviseText([...s.advised, ...s.warnings], i.lock, i)
    : s.warnings.length > 0 ? warnText(s.warnings, i.lock) : { compact: "", full: "" };
  return {
    verdict: "none", halt: false, cause: s.mutedForm?.cause ?? null, violations: s.muted,
    warnings: [...s.advised, ...s.warnings], attempt: 0, ...text, notice: null, lockHash: i.lockHash,
    shadowed: s.muted.length > 0 || s.mutedForm !== null,
  };
}

// A form deny does not consume the (file, rule) counter, but it counts for the turn cap.
function formDeny(i: DecideInput, f: Form, own: CallEvent[]): Decision {
  const loop = i.lock?.loop ?? LOOP_DEFAULTS;
  const attempt = formRun(own) + 1;
  const reason = FIXABLE_BY[f.cause] === "human" ? f.cause
    : i.turnDenials >= loop.maxDenialsPerTurn ? "turn-cap"
    : attempt >= FORM_RUN_MAX ? "form-run" : null;
  return {
    verdict: "deny", halt: reason !== null, cause: f.cause, violations: [], warnings: [], attempt,
    ...formText(f, i.path, reason !== null),
    notice: reason === null ? null : notice("halt", { reason, cause: f.cause, path: i.path ?? "" }),
    lockHash: i.lockHash, shadowed: false,
  };
}

function ruleDeny(i: DecideInput, lock: Lock, s: Sorted, own: CallEvent[]): Decision {
  const denials = own.filter((e) => e.verdict === "deny" && e.form === null);
  const attempt = 1 + Math.max(...s.block.map((v) => denials.filter((e) => hasRule(e, v.rule)).length));
  const streak = stalledStreak(own, { astHash: i.astHash, violations: s.block });
  const askOnly = s.block.every((v) => v.severity === "ask");
  const askable = i.session.interactive && lock.loop.allowAsk && !i.protectedPath;
  const reason = loopHalt(i, lock.loop, attempt, streak) ?? (askOnly && !askable ? "ask-unavailable" : null);
  const ask = askOnly && reason === null;
  const close: Close = ask ? "ask" : reason !== null ? "halt" : streak > 0 ? "stalled" : "retry";
  const path = i.path ?? "";
  return {
    verdict: ask ? "ask" : "deny", halt: reason !== null, cause: null,
    violations: s.block, warnings: [...s.advised, ...s.warnings], attempt,
    ...denyText(s.block, lock, attempt, close, i),
    notice: ask ? notice("ask", { path }, s.block) : reason === null ? null : notice("halt", { reason, path }, s.block),
    lockHash: i.lockHash, shadowed: false,
  };
}

function loopHalt(i: DecideInput, loop: Loop, attempt: number, streak: number): Halt | null {
  if (i.turnDenials >= loop.maxDenialsPerTurn) return "turn-cap";   // turnDenials excludes this call
  if (attempt >= loop.maxDenialsPerFileRule) return "file-rule-cap";
  if (streak >= loop.noProgressLimit) return "no-progress";
  return null;
}

// Stop blocks up to maxStopBlocks per turn. A human cause blocks once: on reentry the agent cannot fix
// it, so the turn ends and the human is told (same rule as the launcher's fail-closed Stop).
function stopBlock(i: DecideInput, s: Sorted, text: Text): Decision {
  const stop = i.stop ?? NO_STOP;
  const cause = s.form?.cause ?? null;
  const halt = cause !== null && FIXABLE_BY[cause] === "human" ? notice("halt", { reason: cause }) : null;
  if (stop.blocks >= (i.lock?.loop ?? LOOP_DEFAULTS).maxStopBlocks || (halt !== null && stop.reentry)) {
    const pending = [halt ?? notice("stop-cap", cause === null ? {} : { reason: cause }, s.block), approved(i)];
    const next = "\nIncomplete Stop. Run pregate report --json for recorded causes and findings; run pregate check --all to re-evaluate the current tree.";
    return { ...quiet(i, { ...s, muted: [], mutedForm: null }),
      stopIncomplete: { reason: halt !== null && stop.reentry ? "human-cause" : "limit", cause },
      notice: pending.filter((n) => n !== null).join("\n\n").slice(0, 4000 - next.length) + next };
  }
  return {
    verdict: "deny", halt: false, cause, violations: s.block, warnings: [...s.advised, ...s.warnings],
    attempt: stop.blocks + 1, ...text, notice: halt ?? approved(i), lockHash: i.lockHash, shadowed: false,
  };
}

function approved(i: DecideInput): string | null {
  const vs = i.stop?.approved ?? [];
  return vs.length === 0 ? null : notice("approved", {}, vs);
}

// Trailing form denies on this file, before this call.
function formRun(own: CallEvent[]): number {
  return own.length - 1 - own.findLastIndex((e) => !(e.verdict === "deny" && e.form !== null));
}

// Trailing attempts that made no progress, this call included. The run holds the rule denies since
// the file last passed; form denies in between do not break it.
function stalledStreak(own: CallEvent[], now: Attempt): number {
  const since = own.slice(own.findLastIndex((e) => e.verdict !== "deny") + 1).filter((e) => e.form === null);
  const run: Attempt[] = [...since, now];
  return run.length - 1 - run.findLastIndex((a, k) => !stalled(a, run.slice(0, k)));
}

// Same normalized AST as a denied attempt, or a rule whose count did not drop since its last deny.
function stalled(a: Attempt, before: Attempt[]): boolean {
  if (a.astHash !== null && before.some((b) => b.astHash === a.astHash)) return true;
  return a.violations.some((v) => {
    const last = before.findLast((b) => hasRule(b, v.rule));
    return last !== undefined && count(a, v.rule) >= count(last, v.rule);
  });
}

function hasRule(a: Attempt, rule: string): boolean {
  return a.violations.some((v) => v.rule === rule);
}

function count(a: Attempt, rule: string): number {
  return a.violations.filter((v) => v.rule === rule).length;
}
