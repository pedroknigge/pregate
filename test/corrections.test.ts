import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { referenceIndex, reviewLedger, type ReferenceIndex } from "../scripts/corrections.ts";

const ROOT = join(import.meta.dir, "..");
const ledger = readFileSync(join(ROOT, "corrections.json"), "utf8");
const index = referenceIndex(ROOT);
const SEEDS = [
  "pre-budget-starts-at-admission",
  "hang-after-admission-still-dies",
  "claude-below-2-1-295-ignores-onfailure",
  "grok-pretooluse-fail-closed",
  "timeout-engine-is-dead-before-deny",
  "atomic-write-removes-temporary-file",
  "approval-env-is-not-a-hook-switch",
  "git-config-read-is-allowed",
];

const summary = "The previous behavior dropped the bytes on a short write.";
const known: ReferenceIndex = { tests: new Set(["keeps the bytes"]), rules: new Set(["CORE-INV-001"]) };
const source = "synthetic case";

function entry(extra: Record<string, string>): string {
  return JSON.stringify({ entries: [{ id: "dropped-bytes", summary, source, ...extra }] });
}

test("every ledger entry cites a test title or a rule id that exists", () => {
  expect(reviewLedger(ledger, index)).toEqual([]);
  const ids = (JSON.parse(ledger) as { entries: { id: string; test?: string; rule?: string }[] }).entries.map((item) => {
    expect(item.test === undefined || index.tests.has(item.test)).toBe(true);
    expect(item.rule === undefined || index.rules.has(item.rule)).toBe(true);
    return item.id;
  });
  for (const id of SEEDS) expect(ids).toContain(id);
});

test("a dangling test id, a dangling rule id, and a missing reference fail", () => {
  expect(reviewLedger(entry({ test: "this test was never written" }), known).join("\n")).toContain("this test was never written");
  expect(reviewLedger(entry({ rule: "NO-SUCH-RULE" }), known).join("\n")).toContain("NO-SUCH-RULE");
  expect(reviewLedger(entry({}), known).join("\n")).toContain("name exactly one of test or rule");
  expect(reviewLedger(entry({ test: "keeps the bytes", rule: "CORE-INV-001" }), known).join("\n")).toContain("name exactly one of test or rule");
  expect(reviewLedger(entry({ test: "keeps the bytes" }), known)).toEqual([]);
  expect(reviewLedger(entry({ rule: "CORE-INV-001" }), known)).toEqual([]);
});

test("rule ids are check ids and invariant ids, not a fixture pack", () => {
  expect(index.tests.has("time before admission does not consume the pre budget")).toBe(true);
  expect(index.rules.has("CORE-INV-001")).toBe(true);
  expect(index.rules.has("NODE-PIN-001")).toBe(true);
  expect(index.rules.has("node/supply/require-node-pin")).toBe(true);
  expect(index.rules.has("sample/gaps/no-alert")).toBe(false);
  const cited = reviewLedger(entry({ rule: "sample/gaps/no-alert" }), index);
  expect(cited.join("\n")).toContain("sample/gaps/no-alert");
});
