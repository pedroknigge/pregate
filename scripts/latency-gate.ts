// Compare a median p95 with the median of hosted-run medians. The allowance is the
// largest excess in that sample (44.7%) plus 10 percentage points, rounded up to 55%.
// The absolute 150 ms budget stays the reference machine's; this gate is the CI regression check.

export const REGRESSION = 1.55;
export const BENCH_USAGE = "usage: bench.ts [--runs N≥25] [--repeat K≥1] [--inform] [--gate <file>] [--against <checkout> [--against-label <name>]] [--only <route>]...";

export interface BenchOptions {
  runs: number;
  repeat: number;
  inform: boolean;
  gate: string | null;
  against: string | null;
  againstLabel: string | null;
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
// percentiles. It informs: no ratio fails a run until its spread on hosted runners is known.
export interface Differential { route: string; samples: number; paired: number; p50: number; p95: number }

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

export function formatDifferential(label: string, rows: Differential[]): string {
  const width = Math.max(...rows.map((row) => row.route.length));
  const cell = (n: number) => `${n.toFixed(2)}×`.padStart(7);
  const lines = rows.map((row) => `${row.route.padEnd(width)}  ${String(row.samples).padStart(5)}  ${cell(row.paired)}  ${cell(row.p50)}  ${cell(row.p95)}`);
  return [`Against ${label}, same job, alternating samples (informational):`, `${"route".padEnd(width)}  pairs   paired      p50      p95`, ...lines].join("\n");
}

export function parseBenchArgs(args: string[]): BenchOptions {
  const out: BenchOptions = { runs: 30, repeat: 1, inform: false, gate: null, against: null, againstLabel: null, only: [] };
  const rest = [...args];
  while (rest.length) takeFlag(out, rest);
  if (!Number.isInteger(out.runs) || out.runs < 25 || !Number.isInteger(out.repeat) || out.repeat < 1) throw new Error(BENCH_USAGE);
  if (out.againstLabel !== null && out.against === null) throw new Error(BENCH_USAGE);
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
  else if (flag === "--runs") out.runs = integerAtLeast(required(rest, flag), 25, flag);
  else if (flag === "--repeat") out.repeat = integerAtLeast(required(rest, flag), 1, flag);
  else if (flag === "--gate") out.gate = required(rest, flag);
  else if (flag === "--against") out.against = required(rest, flag);
  else if (flag === "--against-label") out.againstLabel = required(rest, flag);
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
