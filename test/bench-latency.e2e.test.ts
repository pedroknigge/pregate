import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTree } from "./remove-tree.ts";

const repoRoot = join(import.meta.dir, "..");

test("the compiled Pre hook bench runs on the demo fixture", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-bench-e2e-"));
  try {
    const baseline = join(area, "baseline.json");
    const route = "200 lines, first touch";
    writeFileSync(baseline, JSON.stringify({
      schemaVersion: 1,
      os: { [process.platform]: { arch: process.arch, runner: "fixture", p95Ms: { [route]: 600000 } } },
    }));
    const result = Bun.spawnSync([
      process.execPath, "scripts/bench.ts", "--runs", "25", "--repeat", "1", "--inform", "--gate", baseline, "--only", route,
    ], { cwd: repoRoot, stdout: "pipe", stderr: "pipe", timeout: 180000 });
    const text = `${result.stdout.toString()}${result.stderr.toString()}`;
    expect(result.exitCode, text).toBe(0);
    expect(text).toContain(route);
    expect(text).toContain("p50 ms");
    expect(text).toContain("median p95");
    expect(text).toContain("ok");
  } finally { removeTree(area); }
}, 180000);

// The reference here is this checkout, so both engines are the same code. The assertion is on the
// mechanism: both were built, every sample was paired, and the reading did not change the exit.
test("the bench reports the ratio against a reference checkout and fails nothing for it", () => {
  const route = "200 lines, first touch";
  const result = Bun.spawnSync([
    process.execPath, "scripts/bench.ts", "--runs", "25", "--repeat", "1", "--inform", "--against", repoRoot, "--against-label", "this checkout", "--only", route,
  ], { cwd: repoRoot, stdout: "pipe", stderr: "pipe", timeout: 300000 });
  const text = `${result.stdout.toString()}${result.stderr.toString()}`;
  expect(result.exitCode, text).toBe(0);
  expect(text).toContain("Against this checkout, same job, alternating samples (informational):");
  const line = result.stdout.toString().split("\n").find((l) => l.startsWith("{") && l.includes('"differential"'));
  expect(line, text).toBeDefined();
  const report = JSON.parse(line!) as { against: string; differential: { route: string; samples: number; paired: number; p50: number; p95: number }[] };
  expect(report.against).toBe("this checkout");
  expect(report.differential.map((row) => row.route)).toEqual([route]);
  const row = report.differential[0]!;
  expect(row.samples).toBe(25);
  for (const ratio of [row.paired, row.p50, row.p95]) expect(Number.isFinite(ratio) && ratio > 0, text).toBe(true);
}, 300000);

test("an --against checkout that cannot build an engine stops the bench", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-bench-e2e-"));
  try {
    const result = Bun.spawnSync([
      process.execPath, "scripts/bench.ts", "--runs", "25", "--inform", "--against", area, "--only", "200 lines, first touch",
    ], { cwd: repoRoot, stdout: "pipe", stderr: "pipe", timeout: 300000 });
    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout.toString()}${result.stderr.toString()}`).toContain("reference engine build failed");
  } finally { removeTree(area); }
}, 300000);
