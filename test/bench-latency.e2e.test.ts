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