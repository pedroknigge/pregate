import { expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { bundledBetween, bundledNamespaces, contractDiff, reviewDiff, sourceDiff, validateContract } from "../src/contract.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { encode } from "../src/harness/agy.ts";
import type { Decision, Lock } from "../src/types.ts";
import { policyFixtureSource } from "./policy-fixtures.ts";

// Cases spawn git or the engine; on Windows each spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

const text = readFileSync("catalog/presets/legacy-safe.json", "utf8");
test("approval shows exact source edits, additions, deletions and invisible characters", () => {
  expect(sourceDiff("check.json", '{"kind":"if"}\n', '{"kind":"for"}\n')).toContain('-{"kind":"if"}\n+{"kind":"for"}');
  expect(sourceDiff("check.json", null, "new\n")).toContain("--- /dev/null");
  expect(sourceDiff("check.json", "old\n", null)).toContain("+++ /dev/null");
  expect(sourceDiff("check.json", "same", "same")).toBe("");
  expect(sourceDiff("check.json", null, "hidden\u202evalue")).toContain("hidden\\u202evalue");
  expect(sourceDiff("check.json", null, "one\u2028two")).toContain("one\\u2028two");
});
test("a path cannot forge approval diff lines or relabel content", () => {
  const forged = sourceDiff("src/backdoor.ts\n+++ docs/notes.md\n@@ -1,0 +1,1 @@", null, "x\n");
  expect(forged.split("\n").slice(0, 2)).toEqual(["--- /dev/null", "+++ src/backdoor.ts\\u000a+++ docs/notes.md\\u000a@@ -1,0 +1,1 @@"]);
  expect(sourceDiff("a\u2029b.ts", "x", null)).toStartWith("--- a\\u2029b.ts\n");
});
function lock(): Lock {
  const result = compile(text, policyFixtureSource, VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  return result.lock;
}

test("migration reviews preserve old-version removals and warn when the previous lock cannot be compared", () => {
  const previous = lock();
  previous.engine = "0.2.5";
  const next = structuredClone(previous);
  next.engine = VERSIONS.engine;
  const removed = next.rules.pop()!;
  const diff = reviewDiff(JSON.stringify(previous), next);
  expect(diff.warning).toBe(true);
  expect(diff.lines).toContain(`Removes ${removed.id}.`);
  for (const malformed of ["{", "null", '{"rules":42}']) {
    const recovery = reviewDiff(malformed, next);
    expect(recovery.warning).toBe(true);
    expect(recovery.lines[0]).toContain("Previous lock cannot be read");
  }
});

test("contract diff distinguishes tightening, removal, changes and shadow", () => {
  const before = lock();
  const after = structuredClone(before);
  after.rules[0]!.severity = "ask";
  expect(contractDiff(after, before).warning).toBe(false);
  expect(contractDiff(before, after).warning).toBe(true);
  expect(contractDiff(before, after).lines.join("\n")).toContain("Severity: deny -> ask.");
  const measured = structuredClone(before);
  measured.rules[0]!.params.max = 42;
  expect(contractDiff(before, measured).lines.join("\n")).toContain("max:");
  after.rules.pop();
  expect(contractDiff(before, after).lines.some((s) => s.startsWith("Removes"))).toBe(true);
  after.enforcement = "shadow";
  expect(contractDiff(before, after).lines.join("\n")).toContain("Shadow mode");
});

test("a first path pack (rules add) names the new rule source without a weaker-coverage warning; removing one warns", () => {
  const before = lock();
  const after = structuredClone(before);
  after.sourceDirs = [".pregate/packs/project"];
  after.rules.push({ ...structuredClone(before.rules[0]!), id: "project/PROJ-001" });
  const added = contractDiff(before, after);
  expect(added.warning).toBe(false);
  expect(added.lines).toContain("Adds rule source .pregate/packs/project.");
  expect(added.summary).toContain("project: 1 rule; +1 added; static checks 1 enforce.");
  expect(added.summary.join("\n")).not.toContain("sourceDirs");
  const removed = contractDiff(after, before);
  expect(removed.warning).toBe(true);
  expect(removed.lines.join("\n")).toContain("Changes sourceDirs; review for weaker coverage");
});

test("new contracts, added rules and stronger policy never warn; weaker policy does", () => {
  const advisor = lock();
  advisor.enforcement = "advisor";
  expect(contractDiff(null, advisor).warning).toBe(false);
  const shadow = structuredClone(advisor);
  shadow.enforcement = "shadow";
  expect(contractDiff(null, shadow).warning).toBe(false);
  expect(contractDiff(shadow, advisor).warning).toBe(false);
  expect(contractDiff(advisor, shadow).warning).toBe(true);
  expect(contractDiff(advisor, shadow).summary[0]).toBe("Mode: shadow — findings are recorded silently, except 4 rules set to enforce, which block (was advisor).");
  const enforced = structuredClone(advisor);
  enforced.enforcement = "enforce";
  expect(contractDiff(enforced, advisor).warning).toBe(true);
  const fewer = structuredClone(advisor);
  const added = fewer.rules.pop()!;
  const grown = contractDiff(fewer, advisor);
  expect(grown.warning).toBe(false);
  expect(grown.lines.join("\n")).toContain(`Adds ${added.id}`);
  const ruleShadow = structuredClone(advisor), ruleAdvisor = structuredClone(advisor);
  ruleShadow.rules[0]!.enforcement = "shadow";
  ruleAdvisor.rules[0]!.enforcement = "advisor";
  expect(contractDiff(ruleShadow, ruleAdvisor).warning).toBe(false);
  expect(contractDiff(ruleAdvisor, ruleShadow).warning).toBe(true);
  expect(contractDiff(ruleAdvisor, ruleShadow).summary.join("\n")).toContain("Enforcement: advisor -> shadow.");
});

test("a bundled checker update is not a loosening; the same change in a local pack is", () => {
  const before = lock();
  const index = before.rules.findIndex((rule) => rule.id.startsWith("clean-code/") && rule.impl.kind === "pattern");
  const after = structuredClone(before);
  after.rules[index]!.impl = { ...after.rules[index]!.impl, revised: true } as never;
  const bundled = contractDiff(before, after, new Set(["core", "clean-code"]));
  expect(bundled.warning).toBe(false);
  expect(bundled.lines.join("\n")).toContain(`Updates bundled checker ${after.rules[index]!.id}`);
  const local = contractDiff(before, after, new Set(["core"]));
  expect(local.warning).toBe(true);
  expect(local.summary.join("\n")).toContain(`Changes (may loosen) ${after.rules[index]!.id}`);
  expect([...bundledBetween('{"sources":[{"ns":"clean-code","kind":"library"}]}', '{"sources":[{"ns":"clean-code","kind":"path","path":"x"}]}')]).toEqual(["core"]);
  expect([...bundledNamespaces("{")]).toEqual(["core"]);
});

test("the summary of a large new contract is one line per pack and lists no per-rule policy", () => {
  const base = lock();
  base.enforcement = "advisor";
  const extra = Array.from({ length: 100 }, (_, i) => ({ ...base.rules[0]!, id: `bulk/R-${i}`, enforcement: undefined }));
  const big = { ...base, rules: [...base.rules, ...extra] };
  const diff = contractDiff(null, big);
  const packs = new Set(big.rules.map((rule) => rule.id.split("/")[0])).size;
  expect(diff.summary.length).toBeLessThanOrEqual(packs + 3);
  expect(diff.summary.join("\n")).not.toMatch(/runs in advisor mode/);
  expect(diff.summary.join("\n")).toContain("bulk: 100 rules; static checks 100 advisor.");
  const removed = structuredClone(big);
  removed.rules = removed.rules.filter((rule) => !rule.id.startsWith("bulk/"));
  const shrunk = contractDiff(big, removed);
  expect(shrunk.warning).toBe(true);
  expect(shrunk.summary.filter((line) => line.startsWith("Removes bulk/")).length).toBe(100);
});

test("unchanged shadow policy and metadata-only updates do not warn of weaker protection", () => {
  const before = lock();
  before.enforcement = "shadow";
  const after = structuredClone(before);
  after.preset.name = "Team recipe";
  after.rules[0]!.text.fix = "Updated explanation";
  after.rules[0]!.origin = { updated: "source metadata" };
  expect(contractDiff(before, after).warning).toBe(false);
  expect(contractDiff(before, after).lines.join("\n")).toContain("effective check unchanged");
  after.generatedMarkers.push("generated-by-team");
  expect(contractDiff(before, after).warning).toBe(true);
  expect(contractDiff(before, after).lines.join("\n")).toContain("Changes generatedMarkers");
});

test("a layers change from a reviewed plan warns and stays in the compact summary", () => {
  const before = lock();
  before.layers = { app: { paths: ["source/app/**"], mayImport: [], kind: "core" } };
  const after = structuredClone(before);
  after.layers = { domain: { paths: ["source/domain/**"], mayImport: [], kind: "core" } };
  const diff = contractDiff(before, after);
  expect(diff.warning).toBe(true);
  expect(diff.summary.join("\n")).toContain("Changes layers");
});

// Dogfood: adding one file to an adapter layer warned and printed both whole layer objects and both
// 100-entry rule path arrays.
test("adding a path to a layer and to rule paths is named by its delta without a warning", () => {
  const before = lock();
  const paths = Array.from({ length: 100 }, (_, i) => `src/file-${i}.ts`);
  before.layers = { core: { paths: ["src/core/**"], mayImport: [], kind: "core" }, shell: { paths, mayImport: ["core"], kind: "adapter" } };
  const index = before.rules.findIndex((rule) => Array.isArray(rule.params.paths));
  before.rules[index]!.params.paths = [...paths];
  const after = structuredClone(before);
  after.layers.shell!.paths.push("src/rules-add-command.ts");
  (after.rules[index]!.params.paths as string[]).push("src/rules-add-command.ts");
  for (const full of [false, true]) {
    const diff = contractDiff(before, after), text = (full ? diff.lines : diff.summary).join("\n");
    expect(diff.warning).toBe(false);
    expect(text).not.toContain("src/file-0.ts");
    expect(text).not.toContain("loosen");
    expect(diff.lines).toContain("Widens layers.shell.paths: + src/rules-add-command.ts.");
    expect(diff.lines).toContain(`Tightens ${after.rules[index]!.id}. paths: + src/rules-add-command.ts.`);
  }
});

test("removing a layer path, changing mayImport or kind, a glob overlapping another layer, or a wider exclude still warns", () => {
  const before = lock();
  before.layers = { core: { paths: ["src/core/**"], mayImport: [], kind: "core" }, shell: { paths: ["src/a.ts", "src/b.ts"], mayImport: ["core"], kind: "adapter" } };
  const change = (edit: (lock: Lock) => void) => { const after = structuredClone(before); edit(after); return contractDiff(before, after); };
  const removed = change((l) => { l.layers.shell!.paths = ["src/a.ts"]; });
  expect(removed.warning).toBe(true);
  expect(removed.summary.join("\n")).toContain("Changes layers; review for weaker coverage: layers.shell.paths: - src/b.ts.");
  expect(change((l) => { l.layers.core!.mayImport = ["shell"]; }).summary.join("\n")).toContain("layers.core.mayImport: + shell.");
  expect(change((l) => { l.layers.shell!.kind = "main"; }).warning).toBe(true);
  expect(change((l) => { l.layers.shell!.paths.push("src/core/x.ts"); }).warning).toBe(true);
  const index = before.rules.findIndex((rule) => Array.isArray(rule.params.exclude));
  const excluded = change((l) => { (l.rules[index]!.params.exclude as string[]).push("src/skip/**"); });
  expect(excluded.warning).toBe(true);
  expect(excluded.summary.join("\n")).toContain("exclude: + src/skip/**.");
  expect(change((l) => { l.scope.include.push("extra/**"); }).warning).toBe(false);
  expect(change((l) => { l.scope.exclude.push("extra/**"); }).warning).toBe(true);
});

// Review: a new, more specific glob moved files out of core with no warning, and a shorter scope.exclude
// (where creating or editing a file is denied) read as only wider.
test("a new layer glob that may capture another layer's files, or a smaller scope exclude, still warns", () => {
  const before = lock();
  before.layers = { core: { paths: ["src/**/*.ts"], mayImport: [], kind: "core" }, shell: { paths: ["lib/io.ts"], mayImport: ["core"], kind: "adapter" } };
  before.scope.exclude = ["generated/**"];
  const change = (edit: (lock: Lock) => void) => { const after = structuredClone(before); edit(after); return contractDiff(before, after); };
  expect(change((l) => { l.layers.shell!.paths.push("src/billing/**"); }).warning).toBe(true);
  expect(change((l) => { l.layers.edge = { paths: ["src/edge/**"], mayImport: ["*"], kind: "adapter" }; }).warning).toBe(true);
  expect(change((l) => { l.layers.shell!.paths.push("lib/cli.ts"); }).warning).toBe(false);
  expect(change((l) => { l.scope.exclude = []; }).warning).toBe(true);
});

test("contract validation rejects invalid schema and a pack without real fixtures", async () => {
  await grammars();
  expect(validateContract({ presetText: "{}", filesOf: () => BUILTIN, versions: VERSIONS, now: clock })).toHaveProperty("errors");
  const preset = JSON.parse(text);
  preset.sources.push({ ns: "local", kind: "path", path: ".pregate/rules" });
  const files = Object.fromEntries(Object.entries(BUILTIN).filter(([p]) => p === "source.json" || p.endsWith("check.json"))
    .map(([p, v]) => [p, v.replaceAll("core/", "local/").replace('"core"', '"local"')]));
  const result = validateContract({ presetText: JSON.stringify(preset), filesOf: (s) => s.kind === "path" ? files : policyFixtureSource(s), versions: VERSIONS, now: clock });
  expect(result).toHaveProperty("errors");
  if ("errors" in result) expect(result.errors.join("\n")).toContain("fixtures");
});

test("agy rejects contract permission requests without trusted parent context", () => {
  const d: Decision = { verdict: "ask", contractApproval: true, halt: false, cause: null, violations: [], warnings: [], attempt: 0,
    compact: "Approve?", full: "WARNING: weaker coverage. Approve?", notice: null, lockHash: null, shadowed: false };
  expect(JSON.parse(encode("pre-edit", d).stdout).decision).toBe("deny");
  expect(JSON.parse(encode("pre-command", d).stdout).decision).toBe("deny");
  expect(JSON.parse(encode("pre-edit", { ...d, contractApproval: false }).stdout).decision).toBe("deny");
});

test("a stronger severity does not hide removal of a covered language", () => {
  const before = lock(), after = structuredClone(before);
  before.enforcement = after.enforcement = "enforce";
  const index = before.rules.findIndex((rule) => rule.impl.kind === "primitive" && rule.impl.primitive === "metric");
  expect(index).toBeGreaterThanOrEqual(0);
  before.rules[index]!.languages = ["python", "go"];
  before.rules[index]!.severity = "warn";
  after.rules[index]!.languages = ["python"];
  after.rules[index]!.severity = "deny";
  const diff = contractDiff(before, after);
  expect(diff.warning).toBe(true);
  expect(diff.lines.join("\n")).toContain("Languages: python, go -> python.");
  expect(diff.lines.join("\n")).toContain("Changes (may loosen)");
});
