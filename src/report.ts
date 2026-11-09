import type { CallEvent, Enforcement, Violation } from "./types.ts";
import { calibration, feedbackItems, type FeedbackLabel } from "./feedback.ts";

export interface Recorded { session: string; event: CallEvent }
export interface SessionBaseline {
  session: string; status: "available" | "missing" | "invalid";
  head: string | null; currentHead: string | null; startedWithSession: boolean | null;
  dirtyFiles: number | null; createdAt: number | null; reason: string | null;
}
export interface Report {
  root: string; since: number; calls: number; denials: number; shadow: number; halts: number; correctedInOneAttempt: number;
  advised: number; advisedResolved: number;   // advisor findings shown; those absent on the same file's next edit
  warnings: number;
  timing: { measured: number; unmeasured: number; p50Ms: number | null; p95Ms: number | null; maxMs: number | null };
  incompleteStops: { session: string; turn: string; at: number; reason: "limit" | "human-cause" | "budget";
    cause: CallEvent["form"]; violations: Violation[]; message: string }[];
  calibration: ReturnType<typeof calibration>;
  warningRules: { rule: string; count: number }[];
  warningExamples: { rule: string; path: string; line: number; message: string }[];
  enforceCandidates: string[];
  rules: { rule: string; count: number; shadow: number; enforcement: Enforcement | "mixed" }[];
  files: { path: string; count: number }[];
  examples: { rule: string; path: string; line: number; message: string; shadow: boolean }[];
  sessionBaselines: SessionBaseline[];
}

export function summarize(records: Recorded[], root: string, since: number, labels: FeedbackLabel[] = []): Report {
  const selected = records.filter(({ event: e }) => e.root === root && e.at >= since).sort((a, b) => a.event.at - b.event.at);
  const rules = new Map<string, Report["rules"][number]>();
  const files = new Map<string, number>();
  const examples: Report["examples"] = [];
  const pending = new Set<string>();
  const warningRules = new Map<string, number>();
  const warningExamples: Report["warningExamples"] = [];
  let correctedInOneAttempt = 0;
  const advice = adviceFollowed(selected);
  for (const { session, event: e } of selected) {
    const key = JSON.stringify([session, e.agentId, e.path]);
    if (pending.delete(key) && e.kind === "pre-edit" && e.verdict === "none" && e.form === null && !e.shadowed) correctedInOneAttempt++;
    if (e.kind === "pre-edit" && e.verdict === "deny") pending.add(key);
    for (const [i, v] of (e.warnings ?? []).entries()) {
      warningRules.set(v.rule, (warningRules.get(v.rule) ?? 0) + 1);
      if (warningExamples.length < 5) warningExamples.push({ rule: v.rule, path: v.path, line: v.line,
        message: (e.warningMessages?.[i] ?? v.rule).split("\n")[0]! });
    }
    for (const [i, v] of e.violations.entries()) {
      const policy = e.enforcement?.[v.rule] ?? (e.shadowed ? "shadow" : "enforce");
      const r = rules.get(v.rule) ?? { rule: v.rule, count: 0, shadow: 0, enforcement: policy };
      r.count++; if (policy === "shadow") r.shadow++;
      if (r.enforcement !== policy) r.enforcement = "mixed";
      rules.set(v.rule, r);
      files.set(v.path, (files.get(v.path) ?? 0) + 1);
      if (examples.length < 5) examples.push({ rule: v.rule, path: v.path, line: v.line, message: (e.messages?.[i] ?? e.message ?? v.rule).split("\n")[0]!, shadow: policy === "shadow" });
    }
  }
  return { root, since, calls: selected.length, denials: selected.filter(({ event: e }) => e.verdict === "deny").length,
    shadow: selected.filter(({ event: e }) => e.shadowed || e.violations.some((v) => e.enforcement?.[v.rule] === "shadow")).length,
    halts: selected.filter(({ event: e }) => e.halted).length, correctedInOneAttempt, ...advice,
    warnings: [...warningRules.values()].reduce((total, count) => total + count, 0),
    timing: evaluationTiming(selected), sessionBaselines: [],
    incompleteStops: selected.filter(({ event: e }) => e.kind === "stop" && e.stopIncomplete !== undefined)
      .map(({ session, event: e }) => ({ session, turn: e.turn, at: e.at, reason: e.stopIncomplete!.reason,
        cause: e.stopIncomplete!.cause, violations: e.violations, message: e.message ?? "Incomplete Stop; re-evaluate the current tree." })),
    calibration: calibration(feedbackItems(selected, root, since), labels),
    warningRules: [...warningRules].map(([rule, count]) => ({ rule, count })).sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule)),
    warningExamples, enforceCandidates: advisorCandidates(selected, rules, warningRules),
    rules: [...rules.values()].sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule)),
    files: [...files].map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, 10), examples };
}

export function reportText(r: Report, sinceLabel: string): string {
  return [
    `PREGATE report: ${r.root}`, `Since ${sinceLabel}`,
    `${r.calls} calls · ${r.denials} denied · ${r.shadow} would have blocked in shadow · ${r.halts} halts · ${r.warnings} warnings`,
    r.timing.measured ? `Recorded decision timing: ${r.timing.measured} measured · ${r.timing.unmeasured} unmeasured · p50 ${r.timing.p50Ms!.toFixed(1)} ms · p95 ${r.timing.p95Ms!.toFixed(1)} ms · max ${r.timing.maxMs!.toFixed(1)} ms`
      : `Recorded decision timing unavailable (${r.timing.unmeasured} unmeasured events).`,
    `${r.correctedInOneAttempt} denials corrected in one attempt (observed next pre-edit; not proof of execution)`,
    loopLine(r),
    ...baselineText(r.sessionBaselines),
    ...incompleteStopText(r),
    "Human feedback: " + r.calibration.correct + " correct · " + r.calibration.falsePositive + " false positives · " + r.calibration.uncertain + " uncertain · " + r.calibration.unlabeled + " unlabeled",
    "Reviewed precision: " + (r.calibration.reviewedPrecision === null ? "unavailable (no judged observations)" : (100 * r.calibration.reviewedPrecision).toFixed(1) + "%; selected human-reviewed observations only"),
    r.calibration.basis,
    ...(r.calibration.staleLabels ? [r.calibration.staleLabels + " stale labels excluded; recorded observations changed."] : []),
    "Reviewed rules:",
    ...r.calibration.rules.map((rule) => "  " + rule.rule + ": " + rule.correct + " correct, " + rule.falsePositive + " false positives, " + rule.uncertain + " uncertain, " + rule.unlabeled + " unlabeled; reviewed precision " + (rule.reviewedPrecision === null ? "unavailable" : (100 * rule.reviewedPrecision).toFixed(1) + "%")),
    "Rules:", ...r.rules.map((rule) => `  ${rule.rule}: ${rule.count} (${rule.shadow} shadow; ${rule.enforcement})`),
    "Warning rules (informational; legacy events may not have recorded warnings):", ...r.warningRules.map((rule) => `  ${rule.rule}: ${rule.count}`),
    ...(r.enforceCandidates.length ? ["Ready to promote to enforce (advisor rules with 0 findings in this window; core first):", ...r.enforceCandidates.map((rule) => `  ${rule}: set {"enforcement": "enforce"} in overrides`)] : []),
    "Top files:", ...r.files.map((file) => `  ${file.path}: ${file.count}`),
    "Examples:", ...r.examples.map((e) => `  ${e.rule} ${e.path}:${e.line}${e.shadow ? " [shadow]" : ""}: ${e.message}`),
    ...r.warningExamples.map((e) => `  ${e.rule} ${e.path}:${e.line} [warning]: ${e.message}`),
    ...(r.calls === 0 ? ["No recorded calls in this window."] : []),
  ].join("\n");
}

// One line a person can repeat: what the gate did to the agent in this window. Both repairs are
// observations of the same file's next edit, not proof that the code is right.
function loopLine(r: Report): string {
  const times = (n: number) => `${n} time${n === 1 ? "" : "s"}`;
  return `Agent loop: stopped before a write ${times(r.denials)}, repaired on the next attempt ${times(r.correctedInOneAttempt)}; ${r.advised} advisor finding${r.advised === 1 ? "" : "s"} shown, ${r.advisedResolved} gone on the same file's next edit.`;
}

// Advisor does not block, so its effect is what the agent did next: a finding shown on one edit
// that the same agent's next edit of that file no longer has. A quiet call records advisor findings
// with its warnings.
function adviceFollowed(selected: Recorded[]): { advised: number; advisedResolved: number } {
  const open = new Map<string, Set<string>>();
  let advised = 0, advisedResolved = 0;
  for (const { session, event: e } of selected) {
    if (e.kind !== "pre-edit") continue;
    const key = JSON.stringify([session, e.agentId, e.path]);
    const shown = [...e.violations, ...(e.warnings ?? [])].filter((v) => e.enforcement?.[v.rule] === "advisor");
    const now = new Set(shown.map((v) => v.rule));
    advisedResolved += [...open.get(key) ?? []].filter((rule) => !now.has(rule)).length;
    advised += shown.length;
    open.set(key, now);
  }
  return { advised, advisedResolved };
}

// When advisor rules have earned enforcement: they were advisor before the window began, the agent
// kept editing inside it, and none of them reported a finding or a warning there. The caller still
// drops rules that read no file in scope; zero findings there proves nothing.
export const PROMOTION_DAYS = 7, PROMOTION_EDITS = 20;

export function promotionReady(records: Recorded[], root: string, now: number): { rules: string[]; edits: number } {
  const since = now - PROMOTION_DAYS * 86_400_000;
  const mine = records.filter(({ event: e }) => e.root === root);
  const edits = mine.filter(({ event: e }) => e.kind === "pre-edit" && e.at >= since).length;
  if (edits < PROMOTION_EDITS) return { rules: [], edits };
  const seasoned = new Set(mine.filter(({ event: e }) => e.at < since).flatMap(({ event: e }) =>
    Object.entries(e.enforcement ?? {}).filter(([, mode]) => mode === "advisor").map(([rule]) => rule)));
  return { rules: summarize(mine, root, since).enforceCandidates.filter((rule) => seasoned.has(rule)), edits };
}

// SessionStart's line. The agent tells the user; only the human reviews and approves a promotion.
export function promotionText(ready: { rules: string[]; edits: number }): string {
  const shown = ready.rules.slice(0, 5).join(", "), more = ready.rules.length > 5 ? ` and ${ready.rules.length - 5} more` : "";
  return `Promotion ready: ${ready.rules.length} advisor rule${ready.rules.length === 1 ? "" : "s"} reported no finding in the last ${PROMOTION_DAYS} days over ${ready.edits} checked edits (${shown}${more}). Tell the user once in this session. The human reviews them with \`pregate promote --preview\`; do not run an approval.`;
}

function advisorCandidates(selected: Recorded[], rules: Map<string, unknown>, warnings: Map<string, number>): string[] {
  const latest = new Map<string, Enforcement>();
  for (const { event: e } of selected) for (const [rule, mode] of Object.entries(e.enforcement ?? {})) latest.set(rule, mode);
  return [...latest].filter(([rule, mode]) => mode === "advisor" && !rules.has(rule) && !warnings.has(rule))
    .map(([rule]) => rule).sort((a, b) => Number(b.startsWith("core/")) - Number(a.startsWith("core/")) || a.localeCompare(b));
}

function baselineText(baselines: SessionBaseline[]): string[] {
  if (baselines.length === 0) return [];
  return [
    "Session baselines (retained snapshots; commits do not reset them):",
    ...baselines.map((b) => b.status === "available"
      ? `  ${b.session}: HEAD ${b.head ?? "none"}; ${b.startedWithSession ? "SessionStart" : "first contact"}; ${b.dirtyFiles} saved dirty files; captured ${b.createdAt ?? "time unavailable"}; current HEAD ${b.currentHead ?? "unavailable"}.`
      : `  ${b.session}: ${b.status}; ${b.reason}`),
    "Stop uses these snapshots. CLI check uses HEAD/index/merge-base; audit and check --all inspect the current tree. A clean CLI check does not clear a Stop finding. Inspect and repair it or propose a bounded policy adaptation; do not delete session state to hide findings.",
  ];
}

function evaluationTiming(records: Recorded[]): Report["timing"] {
  const values = records.map(({ event }) => event.evaluationMs)
    .filter((ms): ms is number => typeof ms === "number" && Number.isFinite(ms) && ms >= 0).sort((a, b) => a - b);
  const quantile = (q: number) => values.length ? values[Math.ceil(q * values.length) - 1]! : null;
  return { measured: values.length, unmeasured: records.length - values.length,
    p50Ms: quantile(0.5), p95Ms: quantile(0.95), maxMs: values.at(-1) ?? null };
}

function incompleteStopText(r: Report): string[] {
  if (r.incompleteStops.length === 0) return [];
  return [
    `${r.incompleteStops.length} incomplete Stops recorded; these turns finished without a successful compliance check.`,
    ...r.incompleteStops.slice(-5).map((e) => `  ${e.at} (Unix ms) ${e.session} turn ${e.turn}: ${e.reason}; ${e.cause ?? "rule findings"}; ${e.violations.length} recorded findings.`),
    "Run pregate report --json for all recorded causes/locations; run pregate check --all to re-evaluate the current tree. These are historical events, not proof that findings are still present.",
  ];
}
