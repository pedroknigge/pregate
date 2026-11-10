import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setUpGrammars } from "../src/assets.ts";
import { errorIn, parse } from "../src/ts.ts";
import { removeTree } from "./remove-tree.ts";

beforeAll(setUpGrammars);

test("reported contextual syntax agrees with the pinned TypeScript compiler on valid and missing-type controls", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-contextual-compiler-"));
  const cases: [string, boolean][] = [
    ["test/fixtures/parser-contextual/using-newline-control.ts.fixture", true],
    ["test/fixtures/parser-contextual/using-newline-invalid.ts.fixture", false],
    ["test/fixtures/parser-contextual/pinia-parser-control.ts.fixture", true],
    ["test/fixtures/parser-contextual/pinia-parser-invalid.ts.fixture", false],
  ];
  compilerAgreement(area, cases);
});

function compilerAgreement(area: string, cases: [string, boolean][]): void {
  try {
    for (const ext of ["ts", "tsx"]) for (const [source, valid] of cases) {
      const text = readFileSync(source, "utf8"), path = join(area, `control.${ext}`);
      writeFileSync(path, text);
      const result = Bun.spawnSync([process.execPath, resolve("node_modules/typescript/bin/tsc"), "--ignoreConfig", "--noEmit",
        "--strict", "--skipLibCheck", "--target", "es2022", "--jsx", "preserve", path], { stdout: "pipe", stderr: "pipe" });
      expect(result.exitCode, `${source}: ${result.stdout.toString()}${result.stderr.toString()}`).toBe(valid ? 0 : 1);
      if (!valid) expect(result.stdout.toString()).toContain("TS1110: Type expected.");
      const parsed = parse(path, text);
      expect(errorIn(parsed, null) === null).toBe(valid);
      expect(parsed.root.text).toBe(text);
      parsed.root.tree.delete();
    }
  } finally { removeTree(area); }
}
