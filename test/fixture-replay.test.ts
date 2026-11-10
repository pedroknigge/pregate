import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFixture } from "../src/fixture-replay.ts";
import { testFixture } from "../src/fixtures.ts";
import { clock, grammars } from "../src/gate.ts";
import type { Files } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

const check = readFileSync(join(import.meta.dir, "../packs/clean-code/checks/complexity/fn-max-params/check.json"), "utf8");
function reproduction(before = false): Files {
  const target = "src/public.ts";
  return { "CHECK.json": check,
    "fixture.json": JSON.stringify({ language: "typescript", params: { max: 1, exempt: [] }, target, before: before ? "before/" : null, expect: { verdict: "pass" } }),
    ["files/" + target + ".fixture"]: "export function sum(a: number, b: number) { return a + b; }\n",
    ...(before ? { ["before/" + target + ".fixture"]: "export function sum(a: number, b: number) { return a + b; }\n" } : {}) };
}

test("standalone replay uses the same debt baseline and exposes expectation mismatches", async () => {
  await grammars();
  const strict = testFixture(reproduction(), clock);
  expect(strict.valid).toBe(true); expect(strict.ok).toBe(false);
  expect(strict.lines[0]).toContain("fail [1(2)] (expected pass [])");
  expect(testFixture(reproduction(true), clock)).toMatchObject({ valid: true, ok: true });
  const grown = reproduction(true);
  grown["files/src/public.ts.fixture"] = "export function sum(a: number, b: number, c: number) { return a + b + c; }\n";
  expect(testFixture(grown, clock).lines[0]).toContain("fail [1(3)]");
  const wrongLanguage = reproduction();
  wrongLanguage["fixture.json"] = wrongLanguage["fixture.json"]!.replace('"typescript"', '"python"');
  expect(testFixture(wrongLanguage, clock)).toMatchObject({ valid: false, ok: false });
});

test("replay rejects invalid checker/schema/parameters and still reports evaluation causes", async () => {
  await grammars();
  expect(testFixture({}, clock).valid).toBe(false);
  const params = reproduction();
  params["fixture.json"] = params["fixture.json"]!.replace('"max":1', '"max":"wrong"');
  expect(testFixture(params, clock).valid).toBe(false);
  const unresolved = reproduction();
  unresolved["CHECK.json"] = readFileSync(join(import.meta.dir, "../packs/architecture/checks/dependencies/layer-direction/check.json"), "utf8");
  unresolved["fixture.json"] = JSON.stringify({ language: "typescript", params: {}, context: { layers: { core: { paths: ["src/**"], kind: "core", mayImport: [] } } }, target: "src/public.ts", before: null, expect: { verdict: "pass" } });
  unresolved["files/src/public.ts.fixture"] = 'import { value } from "#missing";\nexport const result = value;\n';
  const replayed = testFixture(unresolved, clock);
  expect(replayed.valid).toBe(true); expect(replayed.ok).toBe(false);
  expect(replayed.lines[0]).toContain("unresolvable-import at line");
});

test("fixture maps cannot include traversal or unrelated files; directory notes stay local", () => {
  removedAfter(mkdtempSync(join(tmpdir(), "pregate-replay-")), area => {
    const map = join(area, "repro.json");
    for (const extra of ["NOTE.md", "files/../../secret.ts.fixture", "/secret", "files/C:/secret.fixture", "files/source.ts", "files/back\\slash.ts.fixture"]) {
      writeFileSync(map, JSON.stringify({ ...reproduction(), [extra]: "private" }));
      expect(() => readFixture(map)).toThrow("relative files/");
    }
    const dir = join(area, "case");
    mkdirSync(join(dir, "files/src"), { recursive: true });
    for (const [rel, text] of Object.entries(reproduction())) writeFileSync(join(dir, rel), text);
    writeFileSync(join(dir, "NOTE.md"), "private note");
    expect(readFixture(dir)).toEqual(reproduction());
    if (process.platform !== "win32") {
      rmSync(join(dir, "CHECK.json")); symlinkSync(map, join(dir, "CHECK.json"));
      expect(() => readFixture(dir)).toThrow("symbolic links");
    }
  });
});

function removedAfter(area: string, use: (area: string) => void): void {
  try { use(area); } finally { removeTree(area); }
}
