import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setUpGrammars } from "../src/assets.ts";
import { fixtureLock } from "../src/compile.ts";
import { dependencyReviews, dependencyRules, memoizedImports, type DependencyReview } from "../src/dependencies.ts";
import { openDependencyCache, type DependencyCache } from "../src/dependency-cache.ts";
import { analyze } from "../src/evaluate.ts";
import { ruleApplies } from "../src/paths.ts";
import { languageApplies } from "../src/languages.ts";
import { introduced } from "../src/ratchet.ts";
import { loadTsPaths, reexportTargets, resolve } from "../src/resolve.ts";
import { grammarOf, imports, parse } from "../src/ts.ts";
import { sha256 } from "../src/state.ts";
import type { Analysis, Check, Files, Lock, Phase, Read } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

beforeAll(setUpGrammars);
const check: Check = { id: "architecture/dependencies/layers", version: "1.0.0", area: "dependencies", cardinality: "singleton", dimension: "deps.layers",
  minSeverity: null, params: {}, languages: ["typescript", "python", "go"], impl: { kind: "primitive", primitive: "layer-edge" }, phase: ["pre", "stop", "commit", "ci"], feedback: { message: "Invalid edge." } };
const lock = fixtureLock(check, { paths: ["src/domain/**"] }, { layers: { domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
  infra: { paths: ["src/infra/**"], mayImport: ["*"], kind: "adapter" } } });
const read = (files: Files): Read => rel => files[rel] ?? null;

// Independent exhaustive resolver walk: no memoized facts, scope shortcut or
// changed-surface pruning. Only affected results with an actual finding/cause matter.
function exhaustive(policy: Lock, before: Files, after: Files, changed: Set<string>, phase: Phase = "pre") {
  const selected = { ...policy, rules: dependencyRules(policy, phase) };
  return Object.keys(after).filter(rel => !changed.has(rel) && grammarOf(rel) !== null && selected.rules.some(rule => ruleApplies(rule, rel) && languageApplies(rule, rel))).flatMap<Omit<DependencyReview, "astHash">>(rel => {
    const file: ExhaustiveFile = { rel, selected, phase, before, affected: false };
    const current: Read = path => { file.affected ||= changed.has(path); return after[path] ?? null; };
    return exhaustiveReview(file, current, parse(rel, after[rel]!));
  });
}

interface ExhaustiveFile { rel: string; selected: Lock; phase: Phase; before: Files; affected: boolean }
type ExhaustiveReview = Omit<DependencyReview, "astHash">[];
function exhaustiveReview(file: ExhaustiveFile, current: Read, parsed: ReturnType<typeof parse>): ExhaustiveReview {
  try {
    const grammar = grammarOf(file.rel), ts = grammar === "typescript" || grammar === "tsx" ? loadTsPaths(current) : null;
    for (const imp of imports(parsed).filter(imp => imp.literal)) {
      const target = resolve(file.rel, imp.spec, ts, current, imp.base);
      if (typeof target === "object") reexportTargets(target.rel, ts, current);
    }
    if (!file.affected) return [];
    const found = analyze(file.selected, file.phase, file.rel, parsed, { read: current, now: performance.now, hash: false });
    if ("cause" in found) return [{ rel: file.rel, form: found, violations: [] }];
    return baselineReview(file, found, file.before[file.rel] === undefined ? null : parse(file.rel, file.before[file.rel]!));
  } finally { parsed.root.tree.delete(); }
}

function baselineReview(file: ExhaustiveFile, found: Analysis, baseline: ReturnType<typeof parse> | null): ExhaustiveReview {
  try {
    const old = baseline === null ? null : analyze(file.selected, file.phase, file.rel, baseline, { read: read(file.before), now: performance.now, hash: false });
    const violations = introduced(file.selected, file.rel, old === null || "cause" in old ? null : old, found);
    return violations.length ? [{ rel: file.rel, form: null, violations }] : [];
  } finally { baseline?.root.tree.delete(); }
}

interface IncrementalContext { phase?: Phase; cache?: DependencyCache }
function incremental(policy: Lock, before: Files, after: Files, changed: Set<string>, context: IncrementalContext = {}) {
  const { phase = "pre", cache } = context;
  return dependencyReviews(Object.keys(after), { lock: policy, phase, changed, read: read(after), before: read(before), now: performance.now, cache })
    .filter(review => review.form !== null || review.violations.length).map(({ astHash: _, ...review }) => review);
}

const base: Files = {
  "package.json": '{"name":"original"}', "tsconfig.json": '{"extends":"./config/base"}',
  "config/base": '{"compilerOptions":{"paths":{"@value":["src/domain/value"]}}}',
  "src/domain/value.ts": "export const value = 1;\n", "src/infra/value.ts": "export const value = 2;\n",
  "src/domain/barrel.ts": 'export * from "./value";\n', "src/domain/use.ts": 'import { value } from "./barrel";\nexport const used = value;\n',
  "src/domain/alias.ts": 'import { value } from "@value";\nexport const used = value;\n',
  "src/domain/own.ts": 'import { value } from "replacement";\nexport const used = value;\n',
};

test("operation import facts survive tree disposal and distinguish complete bytes and paths", () => {
  const facts = memoizedImports(), rel = "src/domain/barrel.ts";
  const text = 'export * from "./value";\n', parsed = parse(rel, text);
  facts.remember(parsed);
  const original = facts(rel, text);
  parsed.root.tree.delete();
  expect(facts(rel, text)).toBe(original);
  expect(facts(rel, text.replace("./value", "../infra/value")).imports[0]!.spec).toBe("../infra/value");
  expect(facts(rel, "export const invalid = ;").hasError).toBe(true);
  const python = "import src.infra.value\n";
  expect(facts("src/domain/value.py", python).imports[0]!.kind).not.toBe("reexport");
  expect(facts("src/domain/__init__.py", python).imports[0]!.kind).toBe("reexport");
  expect(memoizedImports()(rel, text)).not.toBe(original);
});

test("seeded direct-file facts preserve exhaustive dependency findings and live resolver reads", () => {
  const rel = "src/domain/barrel.ts", changed = new Set([rel]);
  const after: Files = { ...base, [rel]: 'export * from "../infra/value";\n' }, facts = memoizedImports();
  for (const text of [base[rel]!, after[rel]!]) {
    const parsed = parse(rel, text);
    facts.remember(parsed);
    parsed.root.tree.delete();
  }
  const probes: string[] = [];
  const actual = dependencyReviews(Object.keys(after), { lock, phase: "pre", changed,
    read: path => { probes.push(path); return after[path] ?? null; }, before: read(base), importsOf: facts, now: performance.now })
    .filter(review => review.form !== null || review.violations.length).map(({ astHash: _, ...review }) => review);
  expect(actual).toEqual(exhaustive(lock, base, after, changed));
  expect(actual).toHaveLength(1);
  expect(probes).toContain("src/infra/value.ts");
});

test("affected baseline batches only discovered importers and preserves missing baseline text", () => {
  const after: Files = { ...base, "src/domain/barrel.ts": 'export * from "../infra/value";\n',
    "src/domain/new.ts": base["src/domain/use.ts"]!, "src/domain/isolated.ts": 'import { value } from "./value";\n' };
  const primed: string[][] = [], baseline = Object.assign(read(base), { prime: (paths: string[]) => { primed.push(paths); } });
  const actual = dependencyReviews(Object.keys(after), { lock, phase: "pre", changed: new Set(["src/domain/barrel.ts"]), read: read(after), before: baseline, now: performance.now })
    .filter(review => review.form !== null || review.violations.length).map(({ astHash: _, ...review }) => review);
  expect(primed).toEqual([["src/domain/use.ts", "src/domain/new.ts"]]);
  expect(actual).toEqual(exhaustive(lock, base, after, new Set(["src/domain/barrel.ts"])));
  expect(actual).toHaveLength(2);
});

test("affected baseline does not prime unrelated body-only changes", () => {
  const baseline = Object.assign(read(base), { prime: () => { throw new Error("unrelated baseline prime"); } });
  const after = { ...base, "src/domain/value.ts": "export const value = 9;\n" };
  expect(dependencyReviews(Object.keys(after), { lock, phase: "pre", changed: new Set(["src/domain/value.ts"]), read: read(after), before: baseline, now: performance.now })).toEqual([]);
});

test.each(["snapshot-missing", "state-io", "git-missing", "git-not-repository", "git-error"] as const)("affected baseline preserves host batch cause %s", cause => {
  const after = { ...base, "src/domain/barrel.ts": 'export * from "../infra/value";\n' };
  const baseline = Object.assign(read(base), { prime: () => cause });
  const actual = dependencyReviews(Object.keys(after), { lock, phase: "pre", changed: new Set(["src/domain/barrel.ts"]), read: read(after), before: baseline, now: performance.now });
  expect(actual).toMatchObject([{ rel: "src/domain/use.ts", form: { cause }, violations: [] }]);
});

test("affected baseline propagates a thrown host Git deadline", () => {
  const after = { ...base, "src/domain/barrel.ts": 'export * from "../infra/value";\n' };
  const baseline = Object.assign(read(base), { prime: () => { throw new Error("Git exceeded its 5000 ms command deadline."); } });
  expect(() => dependencyReviews(Object.keys(after), { lock, phase: "pre", changed: new Set(["src/domain/barrel.ts"]), read: read(after), before: baseline, now: performance.now })).toThrow("5000 ms command deadline");
});

test.each([
  ["ordinary body", { "src/domain/value.ts": "export const value = 7;\n" }],
  ["reexport to forbidden layer", { "src/domain/barrel.ts": 'export * from "../infra/value";\n' }],
  ["extended config without json extension", { "config/base": '{"compilerOptions":{"paths":{"@value":["src/infra/value"]}}}' }],
  ["invalid extended config", { "config/base": "{" }],
  ["package identity", { "package.json": '{"name":"replacement"}' }],
  ["existing target becomes invalid", { "src/domain/value.ts": "export const value = ;\n" }],
  ["delete target", { "src/domain/value.ts": null }],
  ["create extension-preferred target", { "src/domain/value": 'export * from "../infra/value";\n' }],
  ["cyclic barrel", { "src/domain/value.ts": 'export * from "./barrel";\n' }],
] as [string, Record<string, string | null>][]) ("incremental importer findings agree with exhaustive: %s", (_name, changes) => {
  const after = { ...base };
  for (const [path, text] of Object.entries(changes)) if (text === null) delete after[path]; else after[path] = text;
  const changed = new Set(Object.keys(changes));
  expect(incremental(lock, base, after, changed)).toEqual(exhaustive(lock, base, after, changed));
});

test("transitive configs with a code extension retain exhaustive commit and CI semantics", () => {
  const before = { ...base, "config/base": '{"extends":"./nested.ts"}', "config/nested.ts": "{}" };
  const after = { ...before, "config/nested.ts": '{"compilerOptions":{"paths":{"@value":["../src/infra/value"]}}}' };
  for (const phase of ["pre", "stop", "commit", "ci"] as const) {
    expect(incremental(lock, before, after, new Set(["config/nested.ts"]), { phase })).toEqual(exhaustive(lock, before, after, new Set(["config/nested.ts"]), phase));
    expect(incremental(lock, before, after, new Set(["config/nested.ts"]), { phase })).toHaveLength(1);
  }
});

test("transitive barrel changes retain exhaustive results at the resolver hop limit", () => {
  const before = { ...base, "src/domain/barrel.ts": 'export * from "./middle";\n', "src/domain/middle.ts": 'export * from "./leaf";\n', "src/domain/leaf.ts": 'export * from "./value";\n' };
  const after = { ...before, "src/domain/leaf.ts": 'export * from "../infra/value";\n' };
  expect(incremental(lock, before, after, new Set(["src/domain/leaf.ts"]))).toEqual(exhaustive(lock, before, after, new Set(["src/domain/leaf.ts"])));
});

test("Python initializer import facts differ from equal ordinary module bytes", () => {
  const before: Files = { "src/__init__.py": "", "src/infra/__init__.py": "", "src/infra/value.py": "value = 1\n",
    "src/domain/a.py": "import src.infra.value\n", "src/domain/__init__.py": "import src.infra.value\n", "src/domain/use.py": "import src.domain\n" };
  const after = { ...before, "src/infra/value.py": "value =\n" };
  const changed = new Set(["src/infra/value.py"]);
  expect(incremental(lock, before, after, changed)).toEqual(exhaustive(lock, before, after, changed));
  expect(incremental(lock, before, after, changed).some(review => review.rel === "src/domain/use.py" && review.form !== null)).toBe(true);
});

test("Go module remaps retain exhaustive dependency denials", () => {
  const before: Files = { "go.mod": "module example.test\n", "src/domain/use.go": 'package domain\nimport "external/value"\n', "src/infra/value.go": "package infra\n" };
  const after = { ...before, "go.mod": "module example.test\nreplace external => ./src/infra\n" };
  expect(incremental(lock, before, after, new Set(["go.mod"]))).toEqual(exhaustive(lock, before, after, new Set(["go.mod"])));
  expect(incremental(lock, before, after, new Set(["go.mod"]))).toHaveLength(1);
});

test("a non-reexport code edit prunes a high-fanout unchanged importer graph without reading importers", () => {
  const before = { ...base, ...Object.fromEntries(Array.from({ length: 4500 }, (_, index) => [`src/domain/use${index}.ts`, 'import { value } from "./value";\n'])) };
  const after: Files = { ...before, "src/domain/value.ts": "export const value = 8;\n" };
  const seen = new Set<string>();
  const result = dependencyReviews(Object.keys(after), { lock, phase: "pre", changed: new Set(["src/domain/value.ts"]),
    read: rel => { seen.add(rel); return after[rel] ?? null; }, before: read(before), now: performance.now });
  expect(result).toEqual([]);
  expect([...seen]).toEqual(["src/domain/value.ts"]);
});

test("reexports retain high-fanout denials and preserve exact importer lines", () => {
  const before = { ...base, ...Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`src/domain/use${index}.ts`, '\nimport { value } from "./barrel";\n'])) };
  const after = { ...before, "src/domain/barrel.ts": 'export * from "../infra/value";\n' };
  const changed = new Set(["src/domain/barrel.ts"]);
  expect(incremental(lock, before, after, changed)).toEqual(exhaustive(lock, before, after, changed));
  expect(incremental(lock, before, after, changed).filter(result => result.rel.match(/use\d/))).toHaveLength(100);
  expect(incremental(lock, before, after, changed).find(result => result.rel.endsWith("use0.ts"))!.violations[0]!.line).toBe(2);
});

test("within and exclusions prevent unrelated importer reads while preserving covered denials", () => {
  const scoped = fixtureLock(check, { paths: ["src/domain/**"], within: ["src/domain/use.ts"], exclude: ["src/domain/alias.ts"] }, { layers: lock.layers });
  const after = { ...base, "src/domain/barrel.ts": 'export * from "../infra/value";\n' };
  expect(incremental(scoped, base, after, new Set(["src/domain/barrel.ts"]))).toEqual(exhaustive(scoped, base, after, new Set(["src/domain/barrel.ts"])));
});

function persistent(run: (root: string) => void) {
  const area = mkdtempSync(join(tmpdir(), "pregate-dependencies-")), previous = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = join(area, "state");
  restoringStateHome(area, previous, run);
}

function restoringStateHome(area: string, previous: string | undefined, run: (root: string) => void) {
  try { run(join(area, "repo")); }
  finally { if (previous === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = previous; removeTree(area); }
}

test.each([
  ["reexport", { "src/domain/barrel.ts": 'export * from "../infra/value";\n' }],
  ["alias config", { "config/base": '{"compilerOptions":{"paths":{"@value":["src/infra/value"]}}}' }],
  ["malformed config", { "config/base": "{" }],
  ["missing config", { "config/base": null }],
  ["target deletion", { "src/domain/value.ts": null }],
  ["target creation", { "src/domain/value": 'export * from "../infra/value";\n' }],
  ["target rename", { "src/domain/value.ts": null, "src/domain/renamed.ts": "export const value = 1;\n" }],
  ["syntax", { "src/domain/value.ts": "export const value = ;\n" }],
  ["package identity", { "package.json": '{"name":"replacement"}' }],
] as [string, Record<string, string | null>][]) ("persistent graph remains exhaustive after %s", (_name, changes) => persistent(root => {
  incremental(lock, base, base, new Set(["package.json"]), { cache: openDependencyCache(root) });
  const after = { ...base };
  for (const [path, text] of Object.entries(changes)) if (text === null) delete after[path]; else after[path] = text;
  const changed = new Set(Object.keys(changes));
  const cache = openDependencyCache(root);
  expect(cache.entries.size).toBeGreaterThan(0);
  expect(incremental(lock, base, after, changed, { cache })).toEqual(exhaustive(lock, base, after, changed));
}));

test("a new importer and changed importer bytes rebuild their own graph", () => persistent(root => {
  incremental(lock, base, base, new Set(["package.json"]), { cache: openDependencyCache(root) });
  const before = { ...base, "src/domain/alias.ts": 'import { value } from "./barrel";\n', "src/domain/new.ts": 'import { value } from "./barrel";\n' };
  const after = { ...before, "src/domain/barrel.ts": 'export * from "../infra/value";\n' };
  const cache = openDependencyCache(root), changed = new Set(["src/domain/barrel.ts"]);
  expect(incremental(lock, before, after, changed, { cache })).toEqual(exhaustive(lock, before, after, changed));
  expect(cache.stats.invalidatedFiles).toBeGreaterThan(0);
  expect(cache.entries.has("src/domain/new.ts")).toBe(true);
}));

test("corrupt checkpoints and unavailable cache writes retain enforcing results", () => persistent(root => {
  const initial = openDependencyCache(root);
  incremental(lock, base, base, new Set(["package.json"]), { cache: initial });
  writeFileSync(initial.file, "{");
  const cache = openDependencyCache(root);
  expect(cache.entries.size).toBe(0);
  cache.file = join(initial.file, "not-a-directory");
  const after = { ...base, "src/domain/barrel.ts": 'export * from "../infra/value";\n' }, changed = new Set(["src/domain/barrel.ts"]);
  expect(incremental(lock, base, after, changed, { cache })).toEqual(exhaustive(lock, base, after, changed));
  expect(cache.stats.error).not.toBeNull();
}));

test("a forged empty read list with a recomputed digest cannot suppress an importer denial", () => persistent(root => {
  const initial = openDependencyCache(root);
  incremental(lock, base, base, new Set(["package.json"]), { cache: initial });
  const saved = JSON.parse(readFileSync(initial.file, "utf8"));
  saved.entries.find((entry: { path: string }) => entry.path === "src/domain/use.ts").inputs = [];
  saved.digest = sha256(JSON.stringify(saved.entries));
  writeFileSync(initial.file, JSON.stringify(saved));
  const cache = openDependencyCache(root);
  expect(cache.entries.size).toBe(0);
  const after = { ...base, "src/domain/barrel.ts": 'export * from "../infra/value";\n' }, changed = new Set(["src/domain/barrel.ts"]);
  const actual = incremental(lock, base, after, changed, { cache });
  expect(actual).toEqual(exhaustive(lock, base, after, changed));
  expect(actual.some(review => review.rel === "src/domain/use.ts" && review.violations.length)).toBe(true);
}));

test("warm graph validates changed canonical identities before using its reads", () => persistent(root => {
  const initial = openDependencyCache(root);
  const before = { ...base, "src/domain/canonical.ts": base["src/domain/value.ts"]! };
  dependencyReviews(Object.keys(before), { lock, phase: "pre", changed: new Set(["package.json"]), read: read(before), before: read(before), now: performance.now,
    cache: initial, identity: rel => rel });
  const cache = openDependencyCache(root);
  const after = { ...before, "src/domain/value.ts": 'export * from "../infra/value";\n', "src/domain/canonical.ts": 'export * from "../infra/value";\n' };
  const reviews = dependencyReviews(Object.keys(after), { lock, phase: "pre", changed: new Set(["src/domain/canonical.ts"]), read: read(after), before: read(before), now: performance.now,
    cache, identity: rel => rel === "src/domain/value.ts" ? "src/domain/canonical.ts" : rel });
  expect(cache.stats.invalidatedFiles).toBeGreaterThan(0);
  expect(reviews.some(review => review.rel === "src/domain/use.ts" && review.violations.length)).toBe(true);
}));

test("persistent Rust graphs invalidate module declarations and Cargo configuration", () => persistent(root => {
  const rust = fixtureLock({ ...check, languages: ["rust"] }, { paths: ["src/domain/**"] }, { layers: lock.layers });
  const before: Files = { "Cargo.toml": '[package]\nname="local"\nversion="0.1.0"\nedition="2021"\n', "src/lib.rs": "pub mod domain; pub mod infra; pub mod facade;\n",
    "src/domain/mod.rs": "pub mod use_case; pub struct Value;\n", "src/domain/use_case.rs": "use crate::facade::Value; pub fn value() -> Value { Value }\n",
    "src/infra.rs": "pub struct Value;\n", "src/facade.rs": "pub use crate::domain::Value;\n" };
  incremental(rust, before, before, new Set(["Cargo.toml"]), { cache: openDependencyCache(root) });
  for (const changes of [{ "src/facade.rs": "pub use crate::infra::Value;\n" }, { "Cargo.toml": before["Cargo.toml"]! + '[lib]\npath="missing.rs"\n' }] as Files[]) {
    const after = { ...before, ...changes }, changed = new Set(Object.keys(changes));
    expect(incremental(rust, before, after, changed, { cache: openDependencyCache(root) })).toEqual(exhaustive(rust, before, after, changed));
  }
}));

test("interactive shadow dependency rules leave persistent graphs and inventories untouched", () => persistent(root => {
  const shadow = { ...lock, enforcement: "shadow" as const }, cache = openDependencyCache(root);
  expect(dependencyReviews(() => { throw new Error("must not inventory"); }, { lock: shadow, phase: "pre", changed: new Set(["package.json"]),
    read: () => { throw new Error("must not read"); }, before: read(base), now: performance.now, cache })).toEqual([]);
  expect(cache.entries.size).toBe(0);
  expect(cache.stats.persisted).toBe(false);
}));

test("persistent Python and Go graphs preserve language controls", () => persistent(root => {
  const cases: [Files, Files, Set<string>][] = [
    [{ "src/__init__.py": "", "src/infra/__init__.py": "", "src/infra/value.py": "value = 1\n", "src/domain/use.py": "import src.infra.value\n" },
      { "src/__init__.py": "", "src/infra/__init__.py": "", "src/infra/value.py": "value =\n", "src/domain/use.py": "import src.infra.value\n" }, new Set(["src/infra/value.py"])],
    [{ "go.mod": "module example.test\n", "src/domain/use.go": 'package domain\nimport "external/value"\n', "src/infra/value.go": "package infra\n" },
      { "go.mod": "module example.test\nreplace external => ./src/infra\n", "src/domain/use.go": 'package domain\nimport "external/value"\n', "src/infra/value.go": "package infra\n" }, new Set(["go.mod"])],
  ];
  for (const [before, after, changed] of cases) {
    incremental(lock, before, before, new Set(["package.json"]), { cache: openDependencyCache(root) });
    expect(incremental(lock, before, after, changed, { cache: openDependencyCache(root) })).toEqual(exhaustive(lock, before, after, changed));
  }
}));

test("changing an imported schema's unique constraint reevaluates unchanged Drizzle queries", () => persistent(root => {
  const drizzle = fixtureLock({ ...check, id: "drizzle/queries/bounded-select", impl: { kind: "primitive", primitive: "drizzle-bounded-select" }, languages: ["typescript"] },
    { paths: ["src/domain/**"] }, {});
  const before: Files = {
    "src/domain/schema.ts": 'import { pgTable, text } from "drizzle-orm/pg-core"; export const users = pgTable("users", { id: text("id").primaryKey() });',
    "src/domain/query.ts": 'import { eq } from "drizzle-orm"; import { users } from "./schema"; export const q = db.select().from(users).where(eq(users.id, id));',
  };
  const after = { ...before, "src/domain/schema.ts": before["src/domain/schema.ts"]!.replace(".primaryKey()", "") }, changed = new Set(["src/domain/schema.ts"]);
  incremental(drizzle, before, before, new Set(["package.json"]), { cache: openDependencyCache(root) });
  for (const cache of [undefined, openDependencyCache(root)]) {
    const actual = incremental(drizzle, before, after, changed, { cache });
    expect(actual).toEqual(exhaustive(drizzle, before, after, changed));
    expect(actual).toMatchObject([{ rel: "src/domain/query.ts", violations: [{ rule: "drizzle/queries/bounded-select" }] }]);
  }
}));

test("warm unchanged resolver facts are reused while affected verdicts remain fresh", () => persistent(root => {
  const before = { ...base, "src/domain/unrelated.ts": "export const value = 1;\n", ...Object.fromEntries(Array.from({ length: 4500 }, (_, index) =>
    [`src/domain/use${index}.ts`, `import { value } from "./unrelated";\nexport const used${index} = value;\n`])) };
  const started = performance.now();
  incremental(lock, before, before, new Set(["package.json"]), { cache: openDependencyCache(root) });
  const coldMs = performance.now() - started;
  const after = { ...before, "src/domain/barrel.ts": 'export * from "../infra/value";\n' }, changed = new Set(["src/domain/barrel.ts"]);
  const warmStarted = performance.now(), cache = openDependencyCache(root);
  const actual = incremental(lock, before, after, changed, { cache }), warmMs = performance.now() - warmStarted;
  const exhaustiveStarted = performance.now(), expected = exhaustive(lock, before, after, changed), exhaustiveMs = performance.now() - exhaustiveStarted;
  expect(actual).toEqual(expected);
  expect(cache.stats.reusedFiles).toBeGreaterThanOrEqual(4500);
  expect(cache.stats.resolvedFiles).toBeLessThan(10);
  console.log(JSON.stringify({ dependencyBenchmark: { importers: 4500, coldMs, warmMs, exhaustiveMs, ...cache.stats } }));
}));

test("a warm graph retains exhaustive denials for all 4500 affected importers", () => persistent(root => {
  const before: Files = { "src/domain/value.ts": "export const value = 1;\n", "src/infra/value.ts": "export const value = 2;\n",
    "src/domain/barrel.ts": 'export * from "./value";\n', ...Object.fromEntries(Array.from({ length: 4500 }, (_, index) =>
      [`src/domain/use${index}.ts`, '\nimport { value } from "./barrel";\nexport const used = value;\n'])) };
  incremental(lock, before, before, new Set(["package.json"]), { cache: openDependencyCache(root) });
  const after = { ...before, "src/domain/barrel.ts": 'export * from "../infra/value";\n' }, changed = new Set(["src/domain/barrel.ts"]);
  const started = performance.now(), cache = openDependencyCache(root), actual = incremental(lock, before, after, changed, { cache }), warmMs = performance.now() - started;
  const exhaustiveStarted = performance.now(), expected = exhaustive(lock, before, after, changed), exhaustiveMs = performance.now() - exhaustiveStarted;
  expect(actual).toEqual(expected);
  expect(actual).toHaveLength(4500);
  expect(actual.every(review => review.violations[0]?.line === 2)).toBe(true);
  console.log(JSON.stringify({ affectedDependencyBenchmark: { importers: 4500, warmMs, exhaustiveMs, ...cache.stats } }));
}), 60_000);
