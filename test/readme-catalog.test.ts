import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("README static, fitness, language, and pack lists match the tree", () => {
  const result = spawnSync(process.execPath, ["scripts/readme-catalog.ts", "--check"], {
    cwd: join(import.meta.dir, ".."), encoding: "utf8",
  });
  expect(result.stderr + result.stdout).not.toContain("stale");
  expect(result.status).toBe(0);
});
