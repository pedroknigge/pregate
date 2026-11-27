import { equal } from "./schema.ts";
import type { Recorded } from "./report.ts";
import type { Violation } from "./types.ts";

export type FeedbackVerdict = "correct" | "false-positive" | "uncertain";
interface FeedbackItem {
  id: string; root: string; session: string; at: number; eventHash: string;
  channel: "violation" | "warning"; rule: string; path: string; line: number;
  symbol: string; measured: number | null; limit: number | null;
}
export interface FeedbackLabel {
  item: FeedbackItem; verdict: FeedbackVerdict; note: string; confirmedAt: number;
}
interface CalibrationCount {
  findings: number; correct: number; falsePositive: number; uncertain: number;
  unlabeled: number; reviewedPrecision: number | null;
}
const hash = (text: string) => (require("node:crypto") as typeof import("node:crypto")).createHash("sha256").update(text).digest("hex");

// IDs describe individual recorded observations, not a unique code site or an entire rule.
export function feedbackItems(records: Recorded[], root: string, since = 0): FeedbackItem[] {
  const items = new Map<string, FeedbackItem>();
  for (const record of records) {
    const e = record.event;
    if (e.root !== root || e.at < since) continue;
    for (const channel of ["violation", "warning"] as const) for (const v of channel === "warning" ? e.warnings ?? [] : e.violations) {
      const item = observation(record, v, channel);
      items.set(item.id, item);
    }
  }
  return [...items.values()].sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

function observation(record: Recorded, v: Violation, channel: FeedbackItem["channel"]): FeedbackItem {
  const { session, event: e } = record;
  const id = hash(JSON.stringify([session, e.root, e.at, e.callId, e.turn, e.agentId, e.kind, channel,
    v.rule, v.path, v.line, v.symbol, v.measured, v.limit])).slice(0, 24);
  return { id, root: e.root!, session, at: e.at, eventHash: hash(JSON.stringify(e)), channel,
    rule: v.rule, path: v.path, line: v.line, symbol: v.symbol, measured: v.measured, limit: v.limit };
}

export function calibration(items: FeedbackItem[], labels: FeedbackLabel[]) {
  const selected = new Map(labels.map((label) => [label.item.id, label]));
  const rules = new Map<string, CalibrationCount>();
  const total = counts();
  let staleLabels = 0;
  for (const item of items) {
    const label = selected.get(item.id);
    const current = label !== undefined && equal(label.item, item);
    if (label && !current) staleLabels++;
    const r = rules.get(item.rule) ?? counts();
    for (const count of [r, total]) {
      count.findings++;
      if (!current) count.unlabeled++;
      else if (label.verdict === "correct") count.correct++;
      else if (label.verdict === "false-positive") count.falsePositive++;
      else count.uncertain++;
    }
    rules.set(item.rule, r);
  }
  return { ...precision(total), staleLabels,
    rules: [...rules].map(([rule, count]) => ({ rule, ...precision(count) })).sort((a, b) => a.rule.localeCompare(b.rule)),
    basis: "Human labels of recorded observations in this window. Repeated attempts count separately; selected labels are not an unbiased corpus. Uncertain and unlabeled cases are excluded from reviewed precision. This does not measure recall, executed repairs or task outcomes." };
}

function counts(): CalibrationCount {
  return { findings: 0, correct: 0, falsePositive: 0, uncertain: 0, unlabeled: 0, reviewedPrecision: null };
}

function precision(count: CalibrationCount): CalibrationCount {
  const judged = count.correct + count.falsePositive;
  return { ...count, reviewedPrecision: judged === 0 ? null : count.correct / judged };
}
