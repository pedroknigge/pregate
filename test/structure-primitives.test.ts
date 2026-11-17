import { beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setUpGrammars } from "../src/assets.ts";
import { compile, fixtureLock } from "../src/compile.ts";
import { sourcesOf } from "../src/contract-diagnostic.ts";
import { analyze } from "../src/evaluate.ts";
import { check } from "../src/recorded.ts";
import { introduced } from "../src/ratchet.ts";
import type { Check, Read } from "../src/types.ts";
import { VERSIONS } from "../src/versions.ts";

beforeAll(setUpGrammars);

const host = { read: (() => null) as Read, now: () => 0, hash: false as const };

function fileLines(max: number): Check {
  return {
    id: "architecture/modules/file-loc", version: "1.0.0", area: "modules", cardinality: "singleton",
    dimension: "module.lines", minSeverity: null, params: { max: { type: "integer", minimum: 1 } },
    impl: { kind: "primitive", primitive: "metric", metric: "file.lines", ratchet: "no-increase" },
    languages: ["typescript"], phase: ["pre"], feedback: { message: "{symbol} has {measured} lines of code (limit {limit})." },
  };
}

function heritage(): Check {
  return {
    id: "architecture/modules/heritage-depth", version: "1.0.0", area: "modules", cardinality: "singleton",
    dimension: "module.heritage-depth", minSeverity: null, params: { max: { type: "integer", minimum: 1 } },
    impl: { kind: "primitive", primitive: "metric", metric: "heritage.depth" },
    languages: ["typescript"], phase: ["pre"], feedback: { message: "{symbol} extends through {measured} classes (limit {limit})." },
  };
}

function forbidden(): Check {
  return {
    id: "local/secrets/forbidden-env", version: "1.0.0", area: "secrets", cardinality: "singleton",
    dimension: "secrets.env", minSeverity: null,
    params: { globs: { type: "array", items: { type: "string" }, minItems: 1 } },
    impl: { kind: "primitive", primitive: "forbidden-path" },
    phase: ["pre", "ci"], feedback: { message: "{symbol} matches a forbidden path." },
  };
}

const lines = (n: number): string => Array.from({ length: n }, (_, i) => `const n${i} = ${i};`).join("\n") + "\n";

test("a no-increase metric grandfathers an existing excess under a strict preset ratchet", () => {
  const lock = fixtureLock(fileLines(2), { max: 2 }, {});
  lock.ratchet = "strict";
  const before = analyze(lock, "pre", "src/wide.ts", lines(3), host);
  const same = analyze(lock, "pre", "src/wide.ts", `${lines(3)}// note\n`, host);
  const grew = analyze(lock, "pre", "src/wide.ts", lines(4), host);
  const fresh = analyze(lock, "pre", "src/wide.ts", lines(3), host);
  if ("cause" in before || "cause" in same || "cause" in grew || "cause" in fresh) throw new Error("syntax");
  expect(introduced(lock, "src/wide.ts", before, same)).toEqual([]);
  expect(introduced(lock, "src/wide.ts", before, grew).map((v) => v.measured)).toEqual([4]);
  expect(introduced(lock, "src/wide.ts", null, fresh).map((v) => v.measured)).toEqual([3]);
});

test("heritage depth keeps an existing excess when the preset ratchet is strict", () => {
  const lock = fixtureLock(heritage(), { max: 1 }, {});
  lock.ratchet = "strict";
  const text = "class A {}\nclass B extends A {}\nclass C extends B {}\n";
  const before = analyze(lock, "pre", "src/view.ts", text, host);
  const after = analyze(lock, "pre", "src/view.ts", `${text}// note\n`, host);
  if ("cause" in before || "cause" in after) throw new Error("syntax");
  expect(introduced(lock, "src/view.ts", before, after).map((v) => v.measured)).toEqual([2]);
});

test("forbidden-path reports only a matching path that is present", () => {
  const lock = fixtureLock(forbidden(), { globs: [".env", "**/.env"], exclude: [".env.example", "**/.env.example"] }, {});
  const secret = analyze(lock, "pre", ".env", "TOKEN=1\n", host);
  const nested = analyze(lock, "pre", "src/.env", "TOKEN=1\n", host);
  const sample = analyze(lock, "pre", ".env.example", "TOKEN=1\n", host);
  const source = analyze(lock, "pre", "src/note.ts", "export const path = \".env\";\n", host);
  const missing = analyze(lock, "pre", ".env", null, host);
  if ("cause" in secret || "cause" in nested || "cause" in sample || "cause" in source || "cause" in missing) throw new Error("syntax");
  expect(secret.violations.map((v) => v.line)).toEqual([1]);
  expect(nested.violations.map((v) => v.line)).toEqual([1]);
  expect(sample.violations).toEqual([]);
  expect(source.violations).toEqual([]);
  expect(missing.violations).toEqual([]);
});

test("check --all reports a committed .env and not a sample or a source mention", async () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-forbidden-"));
  const rules = join(root, ".pregate/rules");
  mkdirSync(join(rules, "checks/secrets/forbidden-env"), { recursive: true });
  mkdirSync(join(rules, "methodologies"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(rules, "source.json"), JSON.stringify({ ns: "local", version: "1.0.0", category: "pattern" }) + "\n");
  writeFileSync(join(rules, "checks/secrets/forbidden-env/check.json"), JSON.stringify(forbidden(), null, 2) + "\n");
  writeFileSync(join(rules, "methodologies/secrets.json"), JSON.stringify({
    $schema: "../../../schema/methodology.v1.json",
    id: "local/secrets", version: "1.0.0", status: "complete", conflicts: [],
    invariants: [{
      id: "LOCAL-ENV-001", check: "local/secrets/forbidden-env",
      defaults: { globs: [".env", "**/.env"], exclude: [".env.example", "**/.env.example"] },
      severity: "deny",
      source: { work: "Fixture", locator: "forbidden path", paraphrase: "A secret file is not source." },
      why: "The file is present.", fixHint: "Remove it.", avoid: "A sample named .env.example is excluded.",
      examples: { pass: "pass/sample", fail: "fail/secret" },
    }],
  }) + "\n");
  const preset = {
    name: "forbidden", version: "1.0.0", engine: VERSIONS.engine,
    sources: [
      { ns: "core", kind: "builtin", version: VERSIONS.core },
      { ns: "local", kind: "path", path: ".pregate/rules" },
    ],
    methodologies: ["core/pregate-integrity", "local/secrets"],
    enforcement: "enforce", ratchet: { mode: "strict" }, scope: { include: ["**"] },
  };
  const presetText = JSON.stringify(preset, null, 2) + "\n";
  writeFileSync(join(root, ".pregate/preset.json"), presetText);
  writeFileSync(join(root, ".env"), "TOKEN=1\n");
  writeFileSync(join(root, ".env.example"), "TOKEN=example\n");
  writeFileSync(join(root, "src/note.ts"), "export const path = \".env\";\n");
  const ready = compile(presetText, sourcesOf(root), VERSIONS);
  if ("errors" in ready) throw new Error(ready.errors.join("\n"));
  writeFileSync(join(root, ".pregate/pregate.lock.json"), ready.text);
  const report = await check(root, { kind: "tree" });
  expect(report.code, report.text).toBe(1);
  expect(report.text).toContain("local/LOCAL-ENV-001 .env:1");
  expect(report.text).not.toContain(".env.example:");
  expect(report.text).not.toContain("src/note.ts");
});
