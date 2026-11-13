import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { partition } from "../scripts/test-split.ts";

const ROOT = join(import.meta.dir, "..");

test("unit and e2e scripts partition every test file once", () => {
  const { all, unit, e2e } = partition(ROOT);
  expect(unit.length + e2e.length).toBe(all.length);
  expect(new Set([...unit, ...e2e]).size).toBe(all.length);
  expect(e2e).toContain("e2e.test.ts");
  expect(e2e.some((file) => file.endsWith(".e2e.test.ts"))).toBe(true);
  expect(unit).toContain("e2e-real-evidence.test.ts");
  expect(unit).toContain("harness/grok.test.ts");
  expect(unit.some((file) => file === "e2e.test.ts" || file.endsWith(".e2e.test.ts"))).toBe(false);
  expect(pkg.scripts["test:unit"]).toBe("bun scripts/test-split.ts unit");
  expect(pkg.scripts["test:e2e"]).toBe("bun scripts/test-split.ts e2e");
});

test("bun run clean removes dist and every bun-build scratch name", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-clean-"));
  try {
    writeFileSync(join(dir, "package.json"), `${JSON.stringify({ scripts: { clean: pkg.scripts.clean } })}\n`);
    mkdirSync(join(dir, "dist"));
    writeFileSync(join(dir, "dist", "a"), "x");
    for (const name of ["foo.bun-build", ".pregate.bun-build", ".bun-build"]) writeFileSync(join(dir, name), "x");
    writeFileSync(join(dir, "keep.txt"), "x");
    const run = spawnSync(process.execPath, ["run", "clean"], { cwd: dir, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    expect(existsSync(join(dir, "dist"))).toBe(false);
    for (const name of ["foo.bun-build", ".pregate.bun-build", ".bun-build"]) expect(existsSync(join(dir, name)), name).toBe(false);
    expect(existsSync(join(dir, "keep.txt"))).toBe(true);
    expect(existsSync(join(dir, "package.json"))).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
