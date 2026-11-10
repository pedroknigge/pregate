import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTree } from "./remove-tree.ts";

const dir = realpathSync(mkdtempSync(join(tmpdir(), "pregate-cwd-")));

test("a test can change its own working directory", () => {
  process.chdir(dir);
  expect(realpathSync(process.cwd())).toBe(dir);
  removeTree(dir);
});

test("the next test still reads the repository", () => {
  expect(readFileSync("package.json", "utf8")).toContain("\"name\": \"pregate\"");
  expect(realpathSync(process.cwd())).toBe(realpathSync(join(import.meta.dir, "..")));
});
