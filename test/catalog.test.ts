import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { setUpGrammars } from "../src/assets.ts";
import { compile, fixtureLock, listChecks } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { placement } from "../src/evaluate.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, VERSIONS } from "../src/gate.ts";
import type { Check, Files } from "../src/types.ts";

beforeAll(setUpGrammars);

const SOURCES = new Map(["core", "clean-code", "architecture", "ddd", "testing", "typescript"].map((ns) => [ns, readTree(ns === "core" ? "catalog" : "packs/" + ns, true)]));
const sourceFor = (id: string): Files => SOURCES.get(id.split("/")[0]!)!;
// Fixture lookup only; validation/evaluation always uses its actual source namespace.
const CATALOG: Files = Object.assign({}, ...SOURCES.values());

// ARCHITECTURE §6.4 over the core source: one line per fixture, every one "ok" with the exact lines
// (and measures) it declares, a second run equal to the first (no state leaks between runs), and
// no line for the minimums because every check and alias meets them. The order of the files and the
// root cannot enter: the core reads by relative path and never lists.
test("rules test admits the 68 builtin checks and the 13 policies migrated into optional packs", () => {
  const core = listChecks(SOURCES.get("core")!);
  if ("errors" in core) throw new Error(core.errors.join("\n"));
  expect(core.ids).toHaveLength(68);
  const moved = ["clean-code/complexity/fn-max-lines", "clean-code/complexity/fn-max-params", "clean-code/errors/no-empty-catch",
    "architecture/dependencies/banned-imports", "architecture/dependencies/layer-direction", "architecture/api-surface/single-public-method",
    "architecture/effects/no-clock-random-env", "ddd/immutability/readonly-fields", "ddd/immutability/no-public-setters",
    "testing/testing/no-focused-tests", "testing/testing/assertions-no-decrease",
    "typescript/integrity/double-type-assertion", "typescript/integrity/no-dynamic-import-in-layer"];
  const results = [...core.ids, ...moved].map((id) => ({ id, ...testCheck(sourceFor(id), id, clock) }));
  expect(results.every((r) => r.ok)).toBe(true);
  expect(results.filter((r) => r.id.startsWith("core/invariants/")).flatMap((r) => r.lines)).toHaveLength(320);
  const original = results.filter((r) => !r.id.startsWith("core/invariants/")).flatMap((r) => r.lines).sort();
  expect(original).toEqual(RULES_TEST_CATALOG.split("\n").sort());
});

// The same command over the real catalog with one thing broken: each failure is a FAIL line.
describe("rules test reports what is wrong", () => {
  const FN_LINES = "clean-code/complexity/fn-max-lines";
  const at = (path: string) => `checks/complexity/fn-max-lines/fixtures/${path}`;
  const run = (changes: Record<string, string | null>, id = FN_LINES) => {
    const files: Files = { ...sourceFor(id) };
    for (const [path, text] of Object.entries(changes)) {
      if (text === null) delete files[path];
      else files[path] = text;
    }
    return testCheck(files, id, clock);
  };
  const failures = (r: { ok: boolean; lines: string[] }) => (expect(r.ok).toBe(false), r.lines.filter((l) => !l.startsWith("ok")));

  test.each([false, true])("a pass fixture under trap/ is rejected, metadata present: %s", (metadata) => {
    const fixture = JSON.parse(CATALOG[at("pass/small-functions/fixture.json")]!);
    if (metadata) fixture.trap = { family: "look-alike", origin: "forge", discovered: "2026-10-02", note: "A pass case is not an evasion." };
    expect(failures(run({ [at("trap/look-alike/fixture.json")]: JSON.stringify(fixture) }))).toContain(
      "FAIL clean-code/complexity/fn-max-lines: trap/look-alike/fixture.json: trap fixtures must expect fail; a look-alike that must pass belongs in pass/",
    );
  });

  test("a fixture whose declared lines differ", () => {
    const fixture = JSON.parse(CATALOG[at("fail/long-function/fixture.json")]!);
    fixture.expect.violations = [{ line: 11, measured: 24 }];
    expect(failures(run({ [at("fail/long-function/fixture.json")]: JSON.stringify(fixture) }))).toEqual([
      "FAIL clean-code/complexity/fn-max-lines fail/long-function -> fail [10(24)] (expected fail [11(24)])",
    ]);
  });

  test("an invalid fixture, a target that is nowhere, an unknown check", () => {
    expect(failures(run({ [at("pass/small-functions/fixture.json")]: "{}" }))[0]).toStartWith(
      "FAIL clean-code/complexity/fn-max-lines: pass/small-functions/fixture.json: /language: is required;");
    for (const text of ["{", null]) {
      expect(failures(run({ [at("pass/small-functions/fixture.json")]: text }))).toContain(
        "FAIL clean-code/complexity/fn-max-lines: pass/small-functions/fixture.json: missing or invalid JSON");
    }
    const fixture = { ...JSON.parse(CATALOG[at("pass/small-functions/fixture.json")]!), target: "src/nowhere.ts" };
    expect(failures(run({ [at("pass/small-functions/fixture.json")]: JSON.stringify(fixture) }))).toContain(
      "FAIL clean-code/complexity/fn-max-lines: pass/small-functions/fixture.json: target src/nowhere.ts is in neither files/ nor before/");
    expect(failures(run({}, "clean-code/complexity/nope"))).toEqual(["FAIL clean-code/complexity/nope: no such check in this source"]);
  });

  test("minimums per check and per alias", () => {
    const removed = Object.fromEntries(Object.keys(CATALOG).filter((p) => p.startsWith(at("trap/"))).map((p) => [p, null]));
    expect(failures(run(removed))).toEqual(["FAIL clean-code/complexity/fn-max-lines: needs at least 1 trap fixtures, has 0"]);
    const manifest = JSON.parse(CATALOG["methodologies/clean-code.json"]!);
    manifest.invariants.find((a: { id: string }) => a.id === "CC-FN-001").defaults = { max: 30 };
    expect(failures(run({ "methodologies/clean-code.json": JSON.stringify(manifest) }))).toEqual([
      "FAIL clean-code/complexity/fn-max-lines: alias CC-FN-001 needs a pass fixture with its defaults at pass/small-functions",
      "FAIL clean-code/complexity/fn-max-lines: alias CC-FN-001 needs a fail fixture with its defaults at fail/long-function",
    ]);
  });

  test("a pattern the grammar does not know", () => {
    const path = "checks/integrity/double-type-assertion/check.json";
    const check = JSON.parse(CATALOG[path]!);
    check.impl.patterns.typescript[0].rule = { kind: "type_assertion" };   // only the typescript grammar has it
    expect(failures(run({ [path]: JSON.stringify(check) }, "typescript/integrity/double-type-assertion"))[0]).toBe(
      "FAIL typescript/integrity/double-type-assertion: double-assertion.rule.kind: unknown kind type_assertion in the tsx grammar (tsx grammar)");
  });
});

// The ratchet (no-new) as fixtures with before/, added in memory on top of the catalog's own.
describe("ratchet cases as fixtures with before/", () => {
  const long = (name: string, n: number) =>
    `export function ${name}(xs: number[]): number {\n  let t = 0;\n${Array.from({ length: n }, (_, i) => `  t += xs[${i}] ?? 0;`).join("\n")}\n  return t;\n}\n`;
  const short = "export function small(x: number): number {\n  return x + 1;\n}\n";
  const fixture = (name: string, verdict: "pass" | "fail", violations: { line: number; measured?: number }[] = []) => ({
    [`checks/complexity/fn-max-lines/fixtures/${name}/fixture.json`]: JSON.stringify({
      language: "typescript", params: { max: 20 }, target: "src/legacy.ts", before: "before/",
      expect: verdict === "pass" ? { verdict } : { verdict, violations },
    }),
  });
  const side = (name: string, which: "files" | "before", text: string) =>
    ({ [`checks/complexity/fn-max-lines/fixtures/${name}/${which}/src/legacy.ts.fixture`]: text });
  const cases: Files = {
    ...fixture("pass/ratchet-legacy-untouched", "pass"),
    ...side("pass/ratchet-legacy-untouched", "before", long("legacy", 22) + short),
    ...side("pass/ratchet-legacy-untouched", "files", long("legacy", 22) + short.replace("x + 1", "x + 2")),
    ...fixture("fail/ratchet-legacy-grows", "fail", [{ line: 1, measured: 29 }]),
    ...side("fail/ratchet-legacy-grows", "before", long("legacy", 22)),
    ...side("fail/ratchet-legacy-grows", "files", long("legacy", 25)),
    ...fixture("fail/ratchet-new-function", "fail", [{ line: 27, measured: 25 }]),
    ...side("fail/ratchet-new-function", "before", long("legacy", 22)),
    ...side("fail/ratchet-new-function", "files", long("legacy", 22) + long("fresh", 21)),
    ...fixture("pass/ratchet-renamed", "pass"),
    ...side("pass/ratchet-renamed", "before", long("legacy", 22)),
    ...side("pass/ratchet-renamed", "files", long("renamed", 22)),
  };

  test("equal debt survives renames; growing debt and new long functions fail", () => {
    const r = testCheck({ ...sourceFor("clean-code/complexity/fn-max-lines"), ...cases }, "clean-code/complexity/fn-max-lines", clock);
    expect(r.lines.filter((l) => l.includes("ratchet"))).toEqual([
      "ok   clean-code/complexity/fn-max-lines fail/ratchet-legacy-grows -> fail [1(29)]",
      "ok   clean-code/complexity/fn-max-lines fail/ratchet-new-function -> fail [27(25)]",
      "ok   clean-code/complexity/fn-max-lines pass/ratchet-legacy-untouched -> pass []",
      "ok   clean-code/complexity/fn-max-lines pass/ratchet-renamed -> pass []",
    ]);
    expect(r.ok).toBe(true);
  });

  test("on a preexisting symbol, a second violation of the same rule reports that symbol", () => {
    const swallow = (n: number) => `export function sync(jobs: (() => void)[]): void {\n${
      Array.from({ length: n }, (_, i) => `  try {\n    jobs[${i}]?.();\n  } catch {}\n`).join("")}}\n`;
    const name = "fail/ratchet-second-swallow";
    const dir = `checks/errors/no-empty-catch/fixtures/${name}`;
    const files: Files = {
      ...sourceFor("clean-code/errors/no-empty-catch"),
      [`${dir}/fixture.json`]: JSON.stringify({
        language: "typescript", params: {}, target: "src/sync.ts", before: "before/",
        expect: { verdict: "fail", violations: [{ line: 4 }, { line: 7 }] },
      }),
      [`${dir}/before/src/sync.ts.fixture`]: swallow(1),
      [`${dir}/files/src/sync.ts.fixture`]: swallow(2),
    };
    const r = testCheck(files, "clean-code/errors/no-empty-catch", clock);
    expect(r.lines).toContain(`ok   clean-code/errors/no-empty-catch ${name} -> fail [4, 7]`);
    expect(r.ok).toBe(true);
  });

  test("a second match on a line that already had one is still an increase", () => {
    const name = "fail/ratchet-second-source-on-the-line";
    const dir = `checks/effects/no-clock-random-env/fixtures/${name}`;
    const stamp = (expr: string) => `export function stamp(): number {\n  return ${expr};\n}\n`;
    const files: Files = {
      ...sourceFor("architecture/effects/no-clock-random-env"),
      [`${dir}/fixture.json`]: JSON.stringify({
        language: "typescript", params: { paths: ["src/lib/**"], allow: [] }, target: "src/lib/stamp.ts", before: "before/",
        expect: { verdict: "fail", violations: [{ line: 2 }] },
      }),
      [`${dir}/before/src/lib/stamp.ts.fixture`]: stamp("Date.now()"),
      [`${dir}/files/src/lib/stamp.ts.fixture`]: stamp("Date.now() + Math.random()"),
    };
    const r = testCheck(files, "architecture/effects/no-clock-random-env", clock);
    expect(r.lines).toContain(`ok   architecture/effects/no-clock-random-env ${name} -> fail [2]`);
    expect(r.ok).toBe(true);
  });
});

// O14: `@generatedMarkers` in params.markers is the preset's (or the fixture's) list; evaluate never sees it.
test("@generatedMarkers expands in the lock and in fixtureLock", () => {
  const builtin = readTree("catalog", false);
  for (const name of ["backend-clean-ddd", "functional-ts"]) {
    const presetText = readFileSync(`catalog/presets/${name}.json`, "utf8");
    const out = compile(presetText, (s) => s.kind === "builtin" ? builtin : s.kind === "library" ? SOURCES.get(s.ns) ?? null : null, VERSIONS);
    if ("errors" in out) throw new Error(out.errors.join("\n"));
    const rule = out.lock.rules.find((r) => r.id === "core/EVA-GEN-001")!;
    expect(rule.params.markers).toEqual(JSON.parse(presetText).generatedMarkers);
  }
  const check = JSON.parse(CATALOG["checks/integrity/new-generated-marker/check.json"]!) as Check;
  const lock = fixtureLock(check, { markers: ["@generatedMarkers", "AUTO"] }, { generatedMarkers: ["@generated", "AUTO"] });
  expect(lock.rules[0]!.params.markers).toEqual(["@generated", "AUTO"]);
});

// placement() applies a rule only in its phases, as analyze() does: out-of-scope-file is [pre, stop].
test("placement respects the phases of the rule", () => {
  const check = JSON.parse(CATALOG["checks/integrity/out-of-scope-file/check.json"]!) as Check;
  const lock = fixtureLock(check, { extensions: ["py"] }, { scope: { include: ["src/**"], exclude: ["src/generated/**"] } });
  expect(placement(lock, "pre", "src/generated/a.ts", true, null)).toHaveLength(1);
  expect(placement(lock, "commit", "src/generated/a.ts", true, null)).toEqual([]);
});

test("a drafted policy request is not a new file in an excluded path", () => {
  const check = JSON.parse(CATALOG["checks/integrity/out-of-scope-file/check.json"]!) as Check;
  const lock = fixtureLock(check, { extensions: ["py"] }, { scope: { include: ["**"], exclude: [".pregate/**"] } });
  expect(placement(lock, "stop", ".pregate/requests/dcouplr-enforce.json", true, null)).toEqual([]);
  expect(placement(lock, "stop", ".pregate/requests/nested/other.json", true, null)).toHaveLength(1);
  expect(placement(lock, "stop", ".pregate/notes.json", true, null)).toHaveLength(1);
});

const RULES_TEST_CATALOG = `
ok   architecture/api-surface/single-public-method fail/existing-debt-grows -> fail [1(3)]
ok   architecture/api-surface/single-public-method fail/over-custom-limit -> fail [3(3)]
ok   architecture/api-surface/single-public-method fail/two-public-methods -> fail [3(2)]
ok   architecture/api-surface/single-public-method pass/existing-debt-equal -> pass []
ok   architecture/api-surface/single-public-method pass/one-use-case-per-class -> pass []
ok   architecture/api-surface/single-public-method pass/rename-retains-debt -> pass []
ok   architecture/api-surface/single-public-method pass/single-execute -> pass []
ok   architecture/api-surface/single-public-method trap/public-arrow-property -> fail [3(2)]
ok   architecture/api-surface/single-public-method trap/rename-cannot-grow-debt -> fail [1(3)]
ok   architecture/api-surface/single-public-method trap/static-method -> fail [3(2)]
ok   clean-code/complexity/fn-max-lines fail/existing-debt-grows -> fail [1(6)]
ok   clean-code/complexity/fn-max-lines fail/long-function -> fail [10(24)]
ok   clean-code/complexity/fn-max-lines fail/long-method -> fail [6(16)]
ok   clean-code/complexity/fn-max-lines pass/comments-and-blank-lines -> pass []
ok   clean-code/complexity/fn-max-lines pass/existing-debt-equal -> pass []
ok   clean-code/complexity/fn-max-lines pass/existing-debt-shrinks -> pass []
ok   clean-code/complexity/fn-max-lines pass/extracted-unchanged-body -> pass []
ok   clean-code/complexity/fn-max-lines pass/rename-retains-debt -> pass []
ok   clean-code/complexity/fn-max-lines pass/small-functions -> pass []
ok   clean-code/complexity/fn-max-lines trap/copy-cannot-borrow-debt -> fail [7(5)]
ok   clean-code/complexity/fn-max-lines trap/existing-symbol-cannot-borrow-debt -> fail [1(5)]
ok   clean-code/complexity/fn-max-lines trap/nested-arrow-in-object -> fail [4(22)]
ok   clean-code/complexity/fn-max-lines trap/rename-and-reflow-cannot-grow-debt -> fail [1(5)]
ok   clean-code/complexity/fn-max-lines trap/rename-cannot-grow-debt -> fail [1(6)]
ok   clean-code/complexity/fn-max-lines trap/statements-on-one-line -> fail [1(22)]
ok   clean-code/complexity/fn-max-params fail/arrow-over-lower-limit -> fail [1(3)]
ok   clean-code/complexity/fn-max-params fail/existing-debt-grows -> fail [1(5)]
ok   clean-code/complexity/fn-max-params fail/four-primitive-params -> fail [3(4)]
ok   clean-code/complexity/fn-max-params pass/constructor-exempt -> pass []
ok   clean-code/complexity/fn-max-params pass/existing-debt-equal -> pass []
ok   clean-code/complexity/fn-max-params pass/existing-debt-shrinks -> pass []
ok   clean-code/complexity/fn-max-params pass/grouped-domain-types -> pass []
ok   clean-code/complexity/fn-max-params trap/inline-object-type -> fail [3(4)]
ok   clean-code/complexity/fn-max-params trap/rename-cannot-grow-debt -> fail [1(5)]
ok   clean-code/complexity/fn-max-params trap/rest-tuple -> fail [1(4)]
ok   clean-code/complexity/fn-max-params trap/untyped-destructuring -> fail [1(4)]
ok   architecture/dependencies/banned-imports fail/fs-and-https-in-core -> fail [1, 2]
ok   architecture/dependencies/banned-imports fail/orm-in-domain -> fail [1]
ok   architecture/dependencies/banned-imports pass/adapter-may-use-orm -> pass []
ok   architecture/dependencies/banned-imports pass/core-hashes-without-effects -> pass []
ok   architecture/dependencies/banned-imports pass/domain-without-frameworks -> pass []
ok   architecture/dependencies/banned-imports trap/barrel-reexport -> fail [1]
ok   architecture/dependencies/banned-imports trap/node-prefix-and-promises -> fail [1, 2, 3]
ok   architecture/dependencies/banned-imports trap/orm-subpath -> fail [1]
ok   architecture/dependencies/banned-imports trap/require-and-dynamic-import -> fail [1, 4]
ok   architecture/dependencies/layer-direction fail/domain-imports-infra -> fail [1]
ok   architecture/dependencies/layer-direction fail/functional-core-shell -> fail [1]
ok   architecture/dependencies/layer-direction fail/unlayered-import -> fail [2]
ok   architecture/dependencies/layer-direction pass/adapter-imports-inward -> pass []
ok   architecture/dependencies/layer-direction pass/functional-core-inward -> pass []
ok   architecture/dependencies/layer-direction pass/inward-imports -> pass []
ok   architecture/dependencies/layer-direction trap/barrel-reexport -> fail [1]
ok   architecture/dependencies/layer-direction trap/path-alias-and-export-from -> fail [1, 4]
ok   architecture/dependencies/layer-direction trap/type-import-and-require -> fail [1, 3]
ok   architecture/effects/no-clock-random-env fail/date-now -> fail [6]
ok   architecture/effects/no-clock-random-env fail/global-beside-local-names -> fail [10]
ok   architecture/effects/no-clock-random-env fail/random-and-env -> fail [1, 4]
ok   architecture/effects/no-clock-random-env pass/allowed-pure-members -> pass []
ok   architecture/effects/no-clock-random-env pass/shadowed-names -> pass []
ok   architecture/effects/no-clock-random-env pass/shell-reads-clock -> pass []
ok   architecture/effects/no-clock-random-env pass/time-as-input -> pass []
ok   architecture/effects/no-clock-random-env trap/alias-destructure-bracket -> fail [1, 2, 5]
ok   architecture/effects/no-clock-random-env trap/allow-is-qualified -> fail [1, 2, 6, 7, 8]
ok   architecture/effects/no-clock-random-env trap/global-object-and-construction -> fail [1, 4, 8, 9]
ok   architecture/effects/no-clock-random-env trap/runtime-globals -> fail [1, 4, 8, 12, 13, 17]
ok   architecture/effects/no-clock-random-env trap/shadow-does-not-leak -> fail [1, 3, 10, 14, 18, 21, 30, 32, 36, 39, 40]
ok   clean-code/errors/no-empty-catch fail/empty-handlers -> fail [6, 11]
ok   clean-code/errors/no-empty-catch fail/log-only -> fail [7, 15]
ok   clean-code/errors/no-empty-catch pass/handled-fallback -> pass []
ok   clean-code/errors/no-empty-catch pass/rethrow-with-context -> pass []
ok   clean-code/errors/no-empty-catch trap/nested-block-and-undefined -> fail [6, 13]
ok   clean-code/errors/no-empty-catch trap/point-free-logger -> fail [4]
ok   clean-code/errors/no-empty-catch trap/void-and-comment -> fail [6, 15]
ok   ddd/immutability/no-public-setters fail/assignment-order-and-destructuring -> fail [8, 13]
ok   ddd/immutability/no-public-setters fail/public-set-accessor -> fail [8]
ok   ddd/immutability/no-public-setters fail/setter-methods -> fail [9, 13]
ok   ddd/immutability/no-public-setters pass/intention-revealing-methods -> pass []
ok   ddd/immutability/no-public-setters pass/setter-outside-domain -> pass []
ok   ddd/immutability/no-public-setters trap/arrow-field-setter -> fail [6, 10]
ok   ddd/immutability/no-public-setters trap/computed-name -> fail [6]
ok   ddd/immutability/readonly-fields fail/mutable-field -> fail [2, 9]
ok   ddd/immutability/readonly-fields fail/object-assign-outside-constructor -> fail [7]
ok   ddd/immutability/readonly-fields pass/readonly-parameter-properties -> pass []
ok   ddd/immutability/readonly-fields pass/readonly-value-object -> pass []
ok   ddd/immutability/readonly-fields trap/cast-around-this -> fail [11, 12, 17]
ok   ddd/immutability/readonly-fields trap/private-mutable-with-getter -> fail [2, 13]
ok   ddd/immutability/readonly-fields trap/public-parameter-property -> fail [2]
ok   typescript/integrity/double-type-assertion fail/angle-brackets-and-any -> fail [4, 8]
ok   typescript/integrity/double-type-assertion fail/as-unknown-as -> fail [4]
ok   typescript/integrity/double-type-assertion pass/guards-and-satisfies -> pass []
ok   typescript/integrity/double-type-assertion pass/single-assertions -> pass []
ok   typescript/integrity/double-type-assertion trap/never-and-array -> fail [4, 8]
ok   typescript/integrity/double-type-assertion trap/parenthesized -> fail [4, 8]
ok   core/integrity/edit-generated-or-excluded fail/edit-excluded-file -> fail [1]
ok   core/integrity/edit-generated-or-excluded fail/edit-generated-file -> fail [1]
ok   core/integrity/edit-generated-or-excluded pass/edit-regular-file -> pass []
ok   core/integrity/edit-generated-or-excluded pass/new-file-in-scope -> pass []
ok   core/integrity/edit-generated-or-excluded trap/strip-marker-while-editing -> fail [1]
ok   core/integrity/new-generated-marker fail/marker-added-to-existing -> fail [1(1)]
ok   core/integrity/new-generated-marker fail/new-file-with-marker -> fail [1(1)]
ok   core/integrity/new-generated-marker pass/marker-already-there -> pass []
ok   core/integrity/new-generated-marker pass/no-marker -> pass []
ok   core/integrity/new-generated-marker pass/marker-in-jsx-text -> pass []
ok   core/integrity/new-generated-marker pass/marker-in-string -> pass []
ok   core/integrity/new-generated-marker trap/marker-in-block-comment -> fail [2(1)]
ok   core/integrity/new-inline-suppression fail/custom-marker-list -> fail [2(2)]
ok   core/integrity/new-inline-suppression fail/ts-ignore-added -> fail [2(1)]
ok   core/integrity/new-inline-suppression pass/existing-suppression-kept -> pass []
ok   core/integrity/new-inline-suppression pass/no-suppression -> pass []
ok   core/integrity/new-inline-suppression trap/block-comment-disable -> fail [1(1)]
ok   core/integrity/new-inline-suppression trap/swap-for-another-tool -> fail [1(2)]
ok   typescript/integrity/no-dynamic-import-in-layer fail/eval-and-function -> fail [2, 6]
ok   typescript/integrity/no-dynamic-import-in-layer fail/variable-import -> fail [2]
ok   typescript/integrity/no-dynamic-import-in-layer pass/literal-imports -> pass []
ok   typescript/integrity/no-dynamic-import-in-layer pass/loader-lookalikes -> pass []
ok   typescript/integrity/no-dynamic-import-in-layer pass/outside-layers -> pass []
ok   typescript/integrity/no-dynamic-import-in-layer trap/global-loader-beside-lookalikes -> fail [5, 6, 7, 8, 9, 14, 18]
ok   typescript/integrity/no-dynamic-import-in-layer trap/global-object-in-disguise -> fail [5, 6, 7, 8, 9, 10, 11, 12, 17]
ok   typescript/integrity/no-dynamic-import-in-layer trap/require-after-deny -> fail [2, 5]
ok   typescript/integrity/no-dynamic-import-in-layer trap/require-alias-and-global-eval -> fail [1, 8, 12, 16, 20, 24, 28]
ok   core/integrity/out-of-scope-file fail/new-file-in-exclude -> fail [1]
ok   core/integrity/out-of-scope-file fail/python-in-layer -> fail [1]
ok   core/integrity/out-of-scope-file pass/existing-excluded-file -> pass []
ok   core/integrity/out-of-scope-file pass/new-file-in-scope -> pass []
ok   core/integrity/out-of-scope-file pass/other-language-outside-layers -> pass []
ok   core/integrity/out-of-scope-file pass/readme-in-layer -> pass []
ok   core/integrity/out-of-scope-file pass/stylesheet-edit-in-layer -> pass []
ok   core/integrity/out-of-scope-file trap/extensionless-in-layer -> fail [1]
ok   core/integrity/out-of-scope-file trap/sql-edit-in-layer -> fail [1]
ok   core/integrity/out-of-scope-file trap/uppercase-extension-in-layer -> fail [1]
ok   testing/testing/assertions-no-decrease fail/assertion-removed -> fail [1(2)]
ok   testing/testing/assertions-no-decrease fail/node-assert-removed -> fail [1(1)]
ok   testing/testing/assertions-no-decrease pass/assertion-added -> pass []
ok   testing/testing/assertions-no-decrease pass/restructured-same-count -> pass []
ok   testing/testing/assertions-no-decrease trap/commented-out -> fail [1(1)]
ok   testing/testing/assertions-no-decrease trap/test-file-deleted -> fail [1(0)]
ok   testing/testing/no-focused-tests fail/if-true-skip -> fail [4]
ok   testing/testing/no-focused-tests fail/jasmine-style -> fail [3, 7]
ok   testing/testing/no-focused-tests fail/only-and-skip -> fail [4, 8]
ok   testing/testing/no-focused-tests fail/top-level-if-skip -> fail [4]
ok   testing/testing/no-focused-tests fail/unconditional-skip-forms -> fail [4, 5, 6, 9, 10, 11, 12]
ok   testing/testing/no-focused-tests pass/guarded-skip -> pass []
ok   testing/testing/no-focused-tests pass/local-names -> pass []
ok   testing/testing/no-focused-tests pass/only-as-a-word -> pass []
ok   testing/testing/no-focused-tests pass/plain-tests -> pass []
ok   testing/testing/no-focused-tests pass/playwright-conditional-skip -> pass []
ok   testing/testing/no-focused-tests trap/alias-and-chain -> fail [4, 10]
ok   testing/testing/no-focused-tests trap/always-truthy-condition -> fail [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
ok   testing/testing/no-focused-tests trap/bracket-access -> fail [4]
ok   testing/testing/no-focused-tests trap/destructured-modifier -> fail [4, 5]
ok   testing/testing/no-focused-tests trap/global-beside-local-names -> fail [1, 11, 18, 22]
ok   testing/testing/no-focused-tests trap/global-through-object-or-module -> fail [2, 5, 6, 7, 16, 17]
ok   testing/testing/no-focused-tests trap/literal-condition-skip -> fail [5, 6, 7, 8, 9, 10, 11, 12, 13, 16]`.slice(1);
