// Compare a median p95 with the median of hosted-run medians. The allowance is the
// largest excess in that sample (44.7%) plus 10 percentage points, rounded up to 55%.
// The absolute 150 ms budget stays the reference machine's; this gate is the CI regression check
// on Linux and Windows. macOS compares with a reference engine timed on the same runner.

export const REGRESSION = 1.55;
// Green macOS jobs with no Claude Pre change reached a p95 ratio of 1.2019 (current / v0.0.12,
// interleaved samples). The absolute gate's margin above its worst sample was 10 percentage points,
// then rounded up (44.7 + 10 = 54.7 → 55%). The same steps here are 20.19 + 10 = 30.19 → 31%.
// A route at 1.55× the reference, the old allowance on a baseline-speed runner, is still a failure.
export const RATIO_LIMIT = 1.31;
export const BENCH_USAGE = "usage: bench.ts [--harness claude-code|codex] [--runs N≥25] [--repeat K≥1] [--inform] [--gate <file>] [--against <checkout> [--against-label <name>] [--ratio]] [--only <route>]...";

export interface BenchOptions {
  harness: "claude-code" | "codex";
  runs: number;
  repeat: number;
  inform: boolean;
  gate: string | null;
  against: string | null;
  againstLabel: string | null;
  ratio: boolean;
  only: string[];
}

export interface OsBaseline {
  arch: string;
  runner: string;
  p95Ms: Record<string, number>;
}

export interface GateBaseline {
  schemaVersion: 1;
  os: Record<string, OsBaseline>;
}

export interface GateRow {
  route: string;
  baselineMs: number;
  measuredMs: number;
  limitMs: number;
  ok: boolean;
}

export interface GateDecision {
  ok: boolean;
  reason: string;
  rows: GateRow[];
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty sample");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const right = sorted[mid]!;
  if (sorted.length % 2 === 1) return right;
  return ((sorted[mid - 1] ?? right) + right) / 2;
}

export function regressed(measuredMs: number, baselineMs: number): boolean {
  return !(measuredMs <= baselineMs * REGRESSION);
}

// The differential reading: the same route timed on this engine and on a reference engine in the
// same job, sample by sample. A slow runner slows both, so the ratio says what the absolute time
// cannot. `paired` is the median of the per-sample ratios; `p50` and `p95` are ratios of the
// percentiles. Without `--ratio` the reading fails nothing. `--ratio` fails the run when `p95`
// exceeds RATIO_LIMIT, and a reference that was not measured fails closed.
export interface Differential { route: string; samples: number; paired: number; p50: number; p95: number }

export interface RatioDecision { ok: boolean; text: string }

export function nearestRank(ms: number[], q: number): number {
  if (ms.length === 0) throw new Error("percentile of an empty sample");
  const sorted = [...ms].sort((a, b) => a - b);
  return sorted[Math.ceil((q / 100) * sorted.length) - 1]!;
}

export function differential(route: string, candidate: number[], reference: number[]): Differential {
  if (candidate.length === 0 || candidate.length !== reference.length) throw new Error(`${route}: the two engines need the same number of samples`);
  if (![...candidate, ...reference].every((ms) => Number.isFinite(ms) && ms > 0)) throw new Error(`${route}: a sample is not a positive time`);
  return {
    route, samples: candidate.length,
    paired: median(candidate.map((ms, i) => ms / reference[i]!)),
    p50: nearestRank(candidate, 50) / nearestRank(reference, 50),
    p95: nearestRank(candidate, 95) / nearestRank(reference, 95),
  };
}

export function formatDifferential(label: string, rows: Differential[], informational = true): string {
  const width = Math.max(...rows.map((row) => row.route.length));
  const cell = (n: number) => `${n.toFixed(2)}×`.padStart(7);
  const lines = rows.map((row) => `${row.route.padEnd(width)}  ${String(row.samples).padStart(5)}  ${cell(row.paired)}  ${cell(row.p50)}  ${cell(row.p95)}`);
  const tail = informational ? " (informational)" : "";
  return [`Against ${label}, same job, alternating samples${tail}:`, `${"route".padEnd(width)}  pairs   paired      p50      p95`, ...lines].join("\n");
}

// Fail closed: no rows, a non-positive ratio, or an empty sample is a failure, not a skip.
// A ratio equal to the limit passes, matching the absolute gate's `<= baseline × allowance`.
export function judgeRatio(label: string, rows: Differential[], limit = RATIO_LIMIT): RatioDecision {
  if (rows.length === 0) return { ok: false, text: `Latency ratio gate failed: no routes were measured against ${label}.` };
  const lines = rows.map((row) => {
    const usable = Number.isFinite(row.p95) && row.p95 > 0 && row.samples > 0;
    const ok = usable && row.p95 <= limit;
    const state = ok ? "ok" : usable ? "regressed" : "unmeasured";
    return { ok, line: `${row.route}: p95 ${ratioText(row.p95)}, limit ${limit.toFixed(2)}×, ${state}` };
  });
  const ok = lines.every((row) => row.ok);
  const unmeasured = lines.some((row) => !row.ok && row.line.endsWith("unmeasured"));
  const head = ok
    ? `Latency ratio gate: every route p95 is within ${limit.toFixed(2)}× ${label}.`
    : unmeasured
      ? `Latency ratio gate failed: a route was not measured against ${label}.`
      : `Latency ratio gate: a route p95 is above ${limit.toFixed(2)}× ${label}.`;
  return { ok, text: [head, ...lines.map((row) => row.line)].join("\n") };
}

export function parseBenchArgs(args: string[]): BenchOptions {
  const out: BenchOptions = { harness: "claude-code", runs: 30, repeat: 1, inform: false, gate: null, against: null, againstLabel: null, ratio: false, only: [] };
  const rest = [...args];
  while (rest.length) takeFlag(out, rest);
  if (!Number.isInteger(out.runs) || out.runs < 25 || !Number.isInteger(out.repeat) || out.repeat < 1) throw new Error(BENCH_USAGE);
  if (out.againstLabel !== null && out.against === null) throw new Error(BENCH_USAGE);
  if (out.ratio && out.against === null) throw new Error(BENCH_USAGE);
  if (out.harness === "codex" && out.gate !== null) throw new Error("Codex routes need their own measured baseline; the Claude Code gate cannot certify them.");
  return out;
}

export function parseBaseline(value: unknown): GateBaseline {
  const doc = record(value, "baseline");
  if (doc.schemaVersion !== 1) throw new Error("baseline schemaVersion must be 1");
  const os = record(doc.os, "baseline.os");
  const parsed: Record<string, OsBaseline> = {};
  for (const [platform, raw] of Object.entries(os)) parsed[platform] = parseOs(raw, platform);
  return { schemaVersion: 1, os: parsed };
}

export function decideGate(platform: string, arch: string, measured: Record<string, number>, baseline: GateBaseline): GateDecision {
  const os = baseline.os[platform];
  if (!os) return { ok: false, reason: `no baseline for ${platform} (${arch})`, rows: [] };
  if (os.arch !== arch) return { ok: false, reason: `baseline arch ${os.arch} does not match runner arch ${arch}`, rows: [] };
  const rows = Object.entries(os.p95Ms).map(([route, baselineMs]) => gateRow(route, baselineMs, measured[route]));
  const ok = rows.every((row) => row.ok);
  const allowance = Math.round((REGRESSION - 1) * 100);
  const reason = ok ? `median p95 is within ${REGRESSION}× the ${platform} baseline` : `median p95 regressed more than ${allowance}% on ${platform}`;
  return { ok, reason, rows };
}

export function formatGate(decision: GateDecision): string {
  if (decision.rows.length === 0) return `Latency gate failed: ${decision.reason}.`;
  const lines = decision.rows.map((row) => `${row.route}: median p95 ${show(row.measuredMs)} ms, baseline ${show(row.baselineMs)} ms, limit ${show(row.limitMs)} ms, ${row.ok ? "ok" : "regressed"}`);
  return [`Latency gate: ${decision.reason}.`, ...lines].join("\n");
}

function takeFlag(out: BenchOptions, rest: string[]): void {
  const flag = rest.shift() ?? "";
  if (flag === "--inform") out.inform = true;
  else if (flag === "--harness") {
    const harness = required(rest, flag);
    if (harness !== "claude-code" && harness !== "codex") throw new Error(BENCH_USAGE);
    out.harness = harness;
  }
  else if (flag === "--runs") out.runs = integerAtLeast(required(rest, flag), 25, flag);
  else if (flag === "--repeat") out.repeat = integerAtLeast(required(rest, flag), 1, flag);
  else if (flag === "--gate") out.gate = required(rest, flag);
  else if (flag === "--against") out.against = required(rest, flag);
  else if (flag === "--against-label") out.againstLabel = required(rest, flag);
  else if (flag === "--ratio") out.ratio = true;
  else if (flag === "--only") out.only.push(required(rest, flag));
  else throw new Error(BENCH_USAGE);
}

function required(rest: string[], flag: string): string {
  const value = rest.shift();
  if (value === undefined || value.startsWith("--")) throw new Error(BENCH_USAGE);
  return value;
}

function integerAtLeast(value: string, min: number, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) throw new Error(BENCH_USAGE);
  return parsed;
}

function gateRow(route: string, baselineMs: number, measuredMs: number | undefined): GateRow {
  const limitMs = baselineMs * REGRESSION;
  if (measuredMs === undefined || !Number.isFinite(measuredMs) || !Number.isFinite(baselineMs) || baselineMs <= 0) {
    return { route, baselineMs, measuredMs: measuredMs ?? Number.NaN, limitMs, ok: false };
  }
  return { route, baselineMs, measuredMs, limitMs, ok: !regressed(measuredMs, baselineMs) };
}

function parseOs(value: unknown, platform: string): OsBaseline {
  const os = record(value, platform);
  const arch = text(os.arch, `${platform}.arch`);
  const runner = text(os.runner, `${platform}.runner`);
  const p95Ms = record(os.p95Ms, `${platform}.p95Ms`);
  const routes: Record<string, number> = {};
  for (const [route, raw] of Object.entries(p95Ms)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) throw new Error(`${platform}.p95Ms.${route} must be a positive number`);
    routes[route] = raw;
  }
  if (Object.keys(routes).length === 0) throw new Error(`${platform}.p95Ms must name at least one route`);
  return { arch, runner, p95Ms: routes };
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${at}: expected an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, at: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${at} must be a non-empty string`);
  return value;
}

function show(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "n/a";
}

function ratioText(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(2)}×` : "n/a";
}
