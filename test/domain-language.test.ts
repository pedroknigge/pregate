import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTree } from "./remove-tree.ts";

test("the documented domain DSL runs and detects removed boundary, transition and ownership guards", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-domain-language-"));
  const example = join(import.meta.dir, "../docs/examples/domain-language");
  const source = readFileSync(join(example, "order.ts"), "utf8");
  removedAfter(dir, () => {
    writeFileSync(join(dir, "order.test.ts"), readFileSync(join(example, "order.test.ts")));
    const run = (text: string) => {
      writeFileSync(join(dir, "order.ts"), text);
      return Bun.spawnSync([process.execPath, "test", "./order.test.ts"], { cwd: dir, stdout: "pipe", stderr: "pipe", timeout: 10_000 });
    };
    const baseline = run(source);
    expect(baseline.exitCode, baseline.stderr.toString()).toBe(0);
    expect(baseline.stderr.toString()).toContain("17 pass");
    for (const [before, after, testName] of [
      [" && Object.keys(input).length === 1", "", "the boundary rejects unknown"],
      ["if (first === undefined)", "if (false)", "the domain also guards transitions"],
      ["lines: [...lines]", "lines", "construction takes ownership"],
    ]) {
      const mutated = source.replace(before!, after!);
      expect(mutated).not.toBe(source);
      const result = run(mutated);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain(`(fail) ${testName}`);
      expect(result.stderr.toString()).not.toContain("timed out");
    }
  });
});

function removedAfter(dir: string, body: () => void) {
  try { body(); } finally { removeTree(dir); }
}
