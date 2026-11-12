import { expect, test } from "bun:test";
import { decideGate, differential, formatDifferential, formatGate, median, parseBaseline, parseBenchArgs, regressed } from "../scripts/latency-gate.ts";

test("median of repeated p95 samples is the middle value", () => {
  expect(median([9, 1, 5])).toBe(5);
  expect(median([1, 2, 3, 4])).toBe(2.5);
  expect(() => median([])).toThrow("empty");
});

test("p95 regresses only when it is more than 55% over the baseline", () => {
  expect(regressed(100, 100)).toBe(false);
  expect(regressed(155, 100)).toBe(false);
  expect(regressed(155.01, 100)).toBe(true);
  expect(regressed(80, 100)).toBe(false);
});

test("the gate fails closed for a missing OS, a different arch, or a missing route", () => {
  const baseline = parseBaseline({
    schemaVersion: 1,
    os: { linux: { arch: "x64", runner: "ubuntu-latest", p95Ms: { "200 lines, first touch": 200, "2,000 lines, first touch": 800 } } },
  });
  const measured = { "200 lines, first touch": 210, "2,000 lines, first touch": 790 };
  expect(decideGate("linux", "x64", measured, baseline).ok).toBe(true);
  expect(decideGate("linux", "x64", { ...measured, "2,000 lines, first touch": 1241 }, baseline).ok).toBe(false);
  expect(decideGate("darwin", "arm64", measured, baseline).ok).toBe(false);
  expect(decideGate("linux", "arm64", measured, baseline).reason).toContain("arm64");
  expect(decideGate("linux", "x64", { "200 lines, first touch": 210 }, baseline).rows.some((row) => !row.ok)).toBe(true);
  expect(formatGate(decideGate("linux", "x64", measured, baseline))).toContain("ok");
});

test("bench flags accept the regression gate and reject a short run", () => {
  expect(parseBenchArgs(["--runs", "25", "--repeat", "3", "--inform", "--gate", "bench/latency-baseline.json", "--only", "200 lines, first touch"])).toEqual({
    harness: "claude-code", runs: 25, repeat: 3, inform: true, gate: "bench/latency-baseline.json", against: null, againstLabel: null, only: ["200 lines, first touch"],
  });
  expect(parseBenchArgs(["--against", "../ref", "--against-label", "v0.0.5"])).toMatchObject({ against: "../ref", againstLabel: "v0.0.5" });
  expect(() => parseBenchArgs(["--against-label", "v0.0.5"])).toThrow("usage:");
  expect(() => parseBenchArgs(["--against"])).toThrow("usage:");
  expect(() => parseBenchArgs(["--runs", "10"])).toThrow("usage:");
  expect(parseBenchArgs(["--harness", "codex"])).toMatchObject({ harness: "codex" });
  expect(() => parseBenchArgs(["--harness", "cursor"])).toThrow("usage:");
  expect(() => parseBenchArgs(["--harness", "codex", "--gate", "bench/latency-baseline.json"])).toThrow("own measured baseline");
  expect(() => parseBaseline({ schemaVersion: 1, os: { linux: { arch: "x64", runner: "ubuntu-latest", p95Ms: { slow: 0 } } } })).toThrow("positive");
});

test("the differential is a ratio, so a runner that slows both engines alike changes nothing", () => {
  const reference = [100, 104, 98, 102, 300, 101, 99, 103, 100, 102];
  const candidate = reference.map((ms) => ms * 1.2);
  const fast = differential("route", candidate, reference);
  const slow = differential("route", candidate.map((ms) => ms * 3.4), reference.map((ms) => ms * 3.4));
  for (const d of [fast, slow]) {
    expect(d.paired).toBeCloseTo(1.2, 10);
    expect(d.p50).toBeCloseTo(1.2, 10);
    expect(d.p95).toBeCloseTo(1.2, 10);
  }
  expect(fast.samples).toBe(10);
});

test("one stalled sample moves the p95 ratio and not the paired median", () => {
  const reference = Array.from({ length: 25 }, () => 100);
  const candidate = reference.map((ms, i) => (i === 7 || i === 12 ? 900 : ms));
  const d = differential("route", candidate, reference);
  expect(d.paired).toBe(1);
  expect(d.p50).toBe(1);
  expect(d.p95).toBe(9);
});

test("the differential refuses samples that cannot be paired", () => {
  expect(() => differential("route", [1, 2], [1])).toThrow("same number");
  expect(() => differential("route", [], [])).toThrow("same number");
  expect(() => differential("route", [1, 0], [1, 1])).toThrow("positive");
  expect(() => differential("route", [1, Number.NaN], [1, 1])).toThrow("positive");
});

test("the differential table names the reference and says it informs", () => {
  const text = formatDifferential("v0.0.5", [differential("200 lines, first touch", [120, 120, 120], [100, 100, 100])]);
  expect(text).toContain("Against v0.0.5");
  expect(text).toContain("informational");
  expect(text).toContain("200 lines, first touch");
  expect(text).toContain("1.20×");
});
