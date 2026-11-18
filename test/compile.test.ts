import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { applyRequest, canonical, compile, fixtureLock, freshness, listChecks, sourcesHash } from "../src/compile.ts";
import type { Check, Files, Lock, Preset } from "../src/types.ts";

// A minimal catalog in memory: the real one (catalog/) is data that catalog.test.ts covers.
const V = { engine: "0.1.0", core: "0.1.0" };
const PHASES = ["pre", "stop", "commit", "ci"];
const files = (docs: Record<string, unknown>): Files =>
  Object.fromEntries(Object.entries(docs).map(([path, doc]) => [path, JSON.stringify(doc)]));
const check = (id: string, fields: Record<string, unknown>) => ({
  id, version: "1.0.0", area: id.split("/")[1], cardinality: "singleton", minSeverity: null, params: {},
  phase: PHASES, feedback: { message: "{symbol} breaks {rule}." }, ...fields,
});
const alias = (id: string, checkId: string, defaults: Record<string, unknown>, severity = "deny") => ({
  id, check: checkId, defaults, severity,
  source: { work: "A Book (2008)", locator: "ch. 3", paraphrase: "Short paraphrase." },
  why: `Why ${id}.`, fixHint: `Fix ${id}.`, avoid: `Avoid ${id}.`, examples: { pass: "pass/a", fail: "fail/a" },
});
const manifest = (id: string, invariants: unknown[], conflicts: unknown[] = []) =>
  ({ id, version: "1.0.0", status: "complete", conflicts, invariants });
const pattern = (id: string, extra: Record<string, unknown> = {}) => ({ id, rule: { kind: "as_expression" }, ...extra });
const STRINGS = { type: "array", items: { type: "string" } };
const FOCUS_FILES = { files: ["**/*.test.ts"], ignores: ["test/fixtures/**"] };

const MODEL = files({
  "source.json": { ns: "core", version: "0.1.0" },
  "checks/complexity/fn-max-params/check.json": check("core/complexity/fn-max-params", {
    dimension: "fn.params", params: { max: { type: "integer", minimum: 0 } },
    impl: { kind: "primitive", primitive: "metric", metric: "fn.params" },
  }),
  "checks/dependencies/banned-imports/check.json": check("core/dependencies/banned-imports", {
    cardinality: "multi", dimension: "dependencies.banned", params: { packages: STRINGS },
    impl: { kind: "primitive", primitive: "banned-import" },
  }),
  "checks/testing/no-focused-tests/check.json": check("core/testing/no-focused-tests", {
    dimension: "testing.focus",
    impl: { kind: "pattern", patterns: { typescript: [pattern("only", FOCUS_FILES), pattern("skip", FOCUS_FILES)] } },
  }),
  "checks/testing/no-focused-tests/fixtures/pass/a/fixture.json": "not evaluable",
  "checks/integrity/double-type-assertion/check.json": check("core/integrity/double-type-assertion", {
    dimension: "integrity.cast", minSeverity: "deny", impl: { kind: "pattern", patterns: { typescript: [pattern("cast")] } },
  }),
  "checks/integrity/no-dynamic-import-in-layer/check.json": check("core/integrity/no-dynamic-import-in-layer", {
    dimension: "integrity.dynamic-import", minSeverity: "deny",
    impl: { kind: "pattern", patterns: { typescript: [pattern("dynamic")] } },
  }),
  "methodologies/clean-code.json": manifest("core/clean-code", [alias("CC-FN-002", "core/complexity/fn-max-params", { max: 3 })]),
  "methodologies/clean-architecture.json": manifest("core/clean-architecture", [
    alias("CA-DEP-002", "core/dependencies/banned-imports", { paths: ["@layers:core"], packages: ["@prisma/client"] }),
  ]),
  "methodologies/functional-core-imperative-shell.json": manifest("core/functional-core-imperative-shell", [
    alias("FCIS-IO-001", "core/dependencies/banned-imports", { paths: ["@layers:core"], packages: ["fs"] }),
  ]),
  "methodologies/tdd.json": manifest("core/tdd", [alias("TDD-FOCUS-001", "core/testing/no-focused-tests", {})]),
  "methodologies/pregate-integrity.json": manifest("core/pregate-integrity", [
    alias("EVA-CAST-001", "core/integrity/double-type-assertion", {}),
    alias("EVA-DYN-001", "core/integrity/no-dynamic-import-in-layer", { paths: ["@layers"] }),
  ]),
  "presets/example.json": { not: "evaluable" },
});

// The builtin fixture holds only mandatory integrity; policy fixtures are optional library data.
const CORE: Files = Object.fromEntries(Object.entries(MODEL).filter(([path]) => path === "source.json" || path.startsWith("checks/integrity/") || path === "methodologies/pregate-integrity.json"));
const POLICY: Files = Object.fromEntries(Object.entries(MODEL).filter(([path]) => path === "source.json" || (!path.startsWith("checks/integrity/") && path !== "methodologies/pregate-integrity.json" && !path.startsWith("presets/"))).map(([path, text]) => [path, path === "source.json" ? JSON.stringify({ ns: "example", version: "0.1.0" }) : text.replaceAll("core/", "example/")]));

// `path` sources by their preset path; a path missing here is a source that is not on disk.
const PATHS: Record<string, Files> = {
  ".pregate/rules": files({
    "source.json": { ns: "local", version: "1.0.0" },
    "methodologies/team.json": manifest("local/team", [
      alias("TEAM-FN-001", "example/complexity/fn-max-params", { max: 5 }),
      alias("TEAM-IO-001", "example/dependencies/banned-imports", { paths: ["@layers:core"], packages: ["fs"] }),
      alias("TEAM-CAST-001", "core/integrity/double-type-assertion", {}, "warn"),
    ], [{ with: "example/clean-code", dimension: "fn.params", suggest: { use: "local/team" }, why: "Handlers take a command plus ports." }]),
  }),
  ".pregate/acme": files({
    "source.json": { ns: "acme", version: "1.0.0" },
    "methodologies/style.json": manifest("acme/style", [alias("TDD-FOCUS-001", "example/testing/no-focused-tests", {})]),
  }),
  ".pregate/mixed": files({
    "source.json": { ns: "mixed", version: "1.0.0" },
    "checks/money/no-hand-rounding/check.json": check("mixed/money/no-hand-rounding", {
      dimension: "money.rounding",
      impl: { kind: "pattern", patterns: { typescript: [pattern("a", { files: ["src/money/**"] }), pattern("b")] } },
    }),
  }),
};
const filesOf = (s: Preset["sources"][number]): Files | null => (s.kind === "builtin" ? CORE : s.kind === "path" ? PATHS[s.path] ?? null : s.kind === "library" && s.ns === "example" ? POLICY : null);
const reversed = (f: Files): Files => Object.fromEntries(Object.entries(f).reverse());
const base = (fields: Record<string, unknown>): string => {
  const preset = { name: "case", version: "1.0.0", engine: "0.1.0", sources: [{ ns: "core", kind: "builtin", version: "0.1.0" }], methodologies: [], ...fields } as Preset;
  preset.sources = [...preset.sources, ...(preset.sources.some((s) => s.ns === "example") ? [] : [{ ns: "example", kind: "library" as const, version: "0.1.0" }])];
  return JSON.stringify(preset);
};
const lockOf = (presetText: string): Lock => {
  const out = compile(presetText, filesOf, V);
  if ("errors" in out) throw new Error(out.errors.join("\n"));
  return out.lock;
};
const VALID = readFileSync("test/presets/valid.json", "utf8");

describe("compile", () => {
  test("aliases of one effective rule must agree on enforcement", () => {
    const p = {
      sources: [{ ns: "core", kind: "builtin", version: "0.1.0" }, { ns: "local", kind: "path", path: ".pregate/rules" }],
      methodologies: ["example/clean-code", "local/team"],
      layers: { domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" } },
      overrides: { "TEAM-FN-001": { params: { max: 3 }, enforcement: "shadow" } },
    };
    const out = compile(base(p), filesOf, V);
    expect("errors" in out && out.errors.join("\n")).toContain("deny enforce vs local/TEAM-FN-001");
    const resolved = lockOf(base({ ...p, resolve: { "fn.params": { use: "local/team" } } }));
    expect(resolved.rules.find((r) => r.id === "local/TEAM-FN-001")?.enforcement).toBe("shadow");
  });

  test("integrity absorbs an ordinary shadow alias of its check, while advisor mode applies to core rules too and can be promoted to enforce", () => {
    const shadowLock = lockOf(base({
      sources: [{ ns: "core", kind: "builtin", version: "0.1.0" }, { ns: "local", kind: "path", path: ".pregate/rules" }],
      methodologies: ["local/team"], enforcement: "shadow",
      layers: { domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" } },
      overrides: { "TEAM-CAST-001": { enforcement: "shadow" } },
    }));
    expect(shadowLock.rules.find((r) => r.id === "core/EVA-CAST-001")).toMatchObject({ enforcement: "enforce", integrity: true });
    const advisorLock = lockOf(base({
      sources: [{ ns: "core", kind: "builtin", version: "0.1.0" }, { ns: "local", kind: "path", path: ".pregate/rules" }],
      methodologies: ["local/team"], enforcement: "advisor",
      layers: { domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" } },
      overrides: { "EVA-DYN-001": { enforcement: "enforce" } },
    }));
    expect(advisorLock.enforcement).toBe("advisor");
    expect(advisorLock.rules.find((r) => r.id === "core/EVA-CAST-001")).toMatchObject({ enforcement: "advisor", integrity: true });
    expect(advisorLock.rules.find((r) => r.id === "core/EVA-DYN-001")).toMatchObject({ enforcement: "enforce", integrity: true });
    expect(advisorLock.rules.find((r) => r.id === "local/TEAM-FN-001")).toMatchObject({ enforcement: "advisor", integrity: false });
  });

  test("the valid preset compiles to the golden lock, byte for byte", () => {
    const out = compile(VALID, filesOf, V);
    expect("text" in out && out.text).toBe(readFileSync("test/presets/valid.lock.json", "utf8"));
  });

  test("the lock does not depend on file order or methodology order", () => {
    const text = (out: ReturnType<typeof compile>): string => ("text" in out ? out.text : out.errors.join("\n"));
    const shuffled = (s: Preset["sources"][number]) => {
      const f = filesOf(s);
      return f && reversed(f);
    };
    expect(text(compile(VALID, shuffled, V))).toBe(text(compile(VALID, filesOf, V)));
    const preset = JSON.parse(VALID) as Preset;
    const reordered = JSON.stringify({ ...preset, methodologies: [...preset.methodologies].reverse() });
    expect({ ...lockOf(reordered), presetHash: "" }).toEqual({ ...lockOf(VALID), presetHash: "" });
  });

  const invalid = readdirSync("test/presets/invalid").sort();
  test.each(invalid)("test/presets/invalid/%s fails with its exact errors", (name) => {
    const c = JSON.parse(readFileSync(`test/presets/invalid/${name}`, "utf8")) as { preset: unknown; errors: string[] };
    expect(compile(JSON.stringify(c.preset), filesOf, V)).toEqual({ errors: c.errors });
  });

  test.each(readdirSync("test/presets/reviewed-valid").sort())("a reviewed core override in %s is permitted", (name) => {
    const c = JSON.parse(readFileSync(`test/presets/reviewed-valid/${name}`, "utf8"));
    expect(compile(JSON.stringify(c.preset), filesOf, V)).toHaveProperty("lock");
  });

  test("a preset that is not JSON", () => {
    expect(compile("{", filesOf, V)).toEqual({ errors: ["preset.json: invalid JSON"] });
  });

  test("@layers with no layers expands to no path, never to every path", () => {
    const rule = lockOf(base({})).rules.find((r) => r.id === "core/EVA-DYN-001");
    expect(rule?.params.paths).toEqual([]);
  });

  test("integrity is active without being selected, and absorbs another alias at its strictest", () => {
    const lock = lockOf(base({
      sources: [{ ns: "core", kind: "builtin", version: "0.1.0" }, { ns: "local", kind: "path", path: ".pregate/rules" }],
      methodologies: ["local/team"], layers: { domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" } },
    }));
    expect(lock.preset.methodologies).toEqual(["core/pregate-integrity", "local/team"]);
    const cast = lock.rules.find((r) => r.id === "core/EVA-CAST-001");
    expect(cast).toMatchObject({ aliases: ["core/EVA-CAST-001", "local/TEAM-CAST-001"], severity: "deny", integrity: true });
  });

  test("an override of the check's params resolves a threshold conflict", () => {
    const lock = lockOf(base({
      sources: [{ ns: "core", kind: "builtin", version: "0.1.0" }, { ns: "local", kind: "path", path: ".pregate/rules" }],
      methodologies: ["example/clean-code", "local/team"], layers: { domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" } },
      overrides: { "example/complexity/fn-max-params": { params: { max: 4 } } },
    }));
    const rule = lock.rules.find((r) => r.check === "example/complexity/fn-max-params@1.0.0");
    expect(rule).toMatchObject({
      id: "example/CC-FN-002", aliases: ["example/CC-FN-002", "local/TEAM-FN-001"], params: { max: 4 },
      origin: { "params.max": "overrides.example/complexity/fn-max-params", severity: "alias" },
    });
  });

  test("an alias override wins over a check override on the same param", () => {
    const lock = lockOf(base({
      methodologies: ["example/clean-code"],
      overrides: { "CC-FN-002": { params: { max: 6 } }, "example/complexity/fn-max-params": { params: { max: 4 } } },
    }));
    expect(lock.rules.find((r) => r.id === "example/CC-FN-002")?.params.max).toBe(6);
  });

  test("ArkGate owns a rule shared by two aliases when both are listed", () => {
    const lock = lockOf(base({
      methodologies: ["example/clean-architecture", "example/functional-core-imperative-shell"],
      layers: { domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" } },
      overrides: { "FCIS-IO-001": { params: { packages: ["@prisma/client"] } } },
      coexist: { arkgate: { ownedByArkgate: ["CA-DEP-002", "FCIS-IO-001"] } },
    }));
    expect(lock.ownedByArkgate).toEqual(["example/CA-DEP-002"]);
  });

  test("defaults: enforce, every path in scope, no-new ratchet, loop defaults without escalate", () => {
    const lock = lockOf(base({}));
    expect(lock).toMatchObject({
      enforcement: "enforce", scope: { include: ["**"], exclude: [] }, generatedMarkers: [], layers: {}, sourceDirs: [],
      ratchet: "no-new", ownedByArkgate: [],
      loop: { maxDenialsPerFileRule: 3, maxDenialsPerTurn: 15, noProgressLimit: 2, maxStopBlocks: 2, allowAsk: true, maxDetailedViolations: 5 },
    });
  });
});

describe("freshness", () => {
  const lock = lockOf(VALID);
  const future = JSON.parse(JSON.stringify({ ...lock, lockVersion: 2 })) as Lock;   // a lock as read from disk
  const { coreHash: _, ...older } = lock;   // compiled before O41: no coreHash
  // The same core version with one check changed, as between two builds of 0.1.0 (O41).
  const edited = { ...CORE, "checks/integrity/double-type-assertion/check.json": CORE["checks/integrity/double-type-assertion/check.json"]!.replace("\"1.0.0\"", "\"1.1.0\"") };
  test.each([
    ["fresh", lock, VALID, V, null],
    ["checkout line endings", lock, VALID.replaceAll("\n", "\r\n"), V, null],
    ["preset edited", lock, `${VALID} `, V, "lock-stale"],
    ["another engine", lock, VALID, { ...V, engine: "0.2.0" }, "version-mismatch"],
    ["another core", lock, VALID, { ...V, core: "0.2.0" }, "version-mismatch"],
    ["another lockVersion", future, VALID, V, "lock-stale"],
  ] as const)("%s", (_, l, preset, v, cause) => {
    expect(freshness(l, preset, v, CORE)).toBe(cause);
  });

  test.each([
    ["another builtin catalog under the same core version", lock, edited, "lock-stale"],
    ["a lock without coreHash", older as Lock, CORE, "lock-stale"],
    ["fixtures and presets of the catalog do not count", lock, { ...CORE, "presets/x.json": "{}" }, null],
  ] as const)("%s", (_, l, builtin, cause) => {
    expect(freshness(l, VALID, V, builtin)).toBe(cause);
  });

  test("the lock records the hash of the builtin catalog it was compiled from", () => {
    expect(lock.coreHash).toBe(sourcesHash([CORE]));
    const out = compile(VALID, (s) => (s.kind === "builtin" ? edited : filesOf(s)), V);
    expect("lock" in out && out.lock.coreHash).toBe(sourcesHash([edited]));
    expect("lock" in out && freshness(out.lock, VALID, V, CORE)).toBe("lock-stale");
  });
  test("compilation hashes CRLF and LF presets identically", () => {
    expect(lockOf(VALID.replaceAll("\n", "\r\n"))).toEqual(lock);
  });
});

describe("sourcesHash", () => {
  const local = PATHS[".pregate/rules"]!;
  test("counts only evaluable JSON, in any key order", () => {
    const noise = { ...local, "methodologies/team/aliases/TEAM-FN-001/fixtures/pass/a/fixture.json": "{}", "README.json": "{}" };
    expect(sourcesHash([reversed(noise)])).toBe(sourcesHash([local]));
  });
  test("changes when a manifest changes or the sources reorder", () => {
    const edited = { ...local, "methodologies/team.json": local["methodologies/team.json"]!.replace("5", "6") };
    expect(sourcesHash([edited])).not.toBe(sourcesHash([local]));
    expect(sourcesHash([local, CORE])).not.toBe(sourcesHash([CORE, local]));
  });
  test("changes when the same files object is edited in place", () => {
    const files = { ...local };
    const before = sourcesHash([files]);
    files["methodologies/team.json"] = local["methodologies/team.json"]!.replace("5", "6");
    expect(sourcesHash([files])).not.toBe(before);
  });
  test("is the lock's sourcesHash over the optional library and path sources", () => {
    expect(lockOf(VALID).sourcesHash).toBe(sourcesHash([local, POLICY]));
  });
});

describe("fixtureLock", () => {
  const focus = JSON.parse(MODEL["checks/testing/no-focused-tests/check.json"]!) as Check;
  const banned = JSON.parse(MODEL["checks/dependencies/banned-imports/check.json"]!) as Check;
  test("one rule with the fixture's params and context; ratchet no-new", () => {
    const lock = fixtureLock(banned, { paths: ["@layers:core"], packages: ["fs"] }, {
      layers: { d: { paths: ["src/domain/**"], mayImport: [], kind: "core" } }, scope: { exclude: ["gen/**"] },
    });
    expect(lock).toMatchObject({ ratchet: "no-new", scope: { include: ["**"], exclude: ["gen/**"] }, enforcement: "enforce" });
    expect(lock.rules).toEqual([{
      id: "core/dependencies/banned-imports", aliases: [], check: "core/dependencies/banned-imports@1.0.0",
      impl: { kind: "primitive", primitive: "banned-import" }, phases: PHASES,
      text: { message: "{symbol} breaks {rule}.", why: "", fix: "", avoid: null, source: "" },
      params: { paths: ["src/domain/**"], packages: ["fs"], exclude: [] }, severity: "deny", integrity: false, origin: {},
    }] as never);
  });
  test("pattern files and ignores move to params; the impl keeps no copy", () => {
    const rule = fixtureLock(focus, { exclude: ["test/legacy/**"] }, undefined).rules[0]!;
    expect(rule.params).toEqual({ paths: ["**/*.test.ts"], exclude: ["test/legacy/**", "test/fixtures/**"] });
    expect(rule.impl).toEqual({ kind: "pattern", patterns: { typescript: [pattern("only"), pattern("skip")] } } as never);
  });
  test.each([
    [{ packages: "fs" }, undefined, "core/dependencies/banned-imports: params/packages: must be of type array"],
    [{}, undefined, "core/dependencies/banned-imports: params/packages: is required"],
    [{ packages: [], paths: ["@layers:port"] }, undefined,
      `core/dependencies/banned-imports: params.paths: @layers:port matches no layer; the preset declares no layer of kind "port"`],
  ])("invalid fixture data throws: %j", (params, ctx, message) => {
    expect(() => fixtureLock(banned, params, ctx)).toThrow(message);
  });
});

describe("applyRequest", () => {
  const preset = base({ overrides: { "CA-UC-001": "off" } });
  const request = readFileSync("test/presets/request.json", "utf8");
  const run = (patch: unknown[], text = preset) => applyRequest(text, JSON.stringify({ why: "w", patch }));

  test("the example request removes the override it tests for", () => {
    const out = applyRequest(preset, request);
    expect("presetText" in out && JSON.parse(out.presetText).overrides).toEqual({});
  });
  test("add, replace and array operations, with ~1 and ~0 escapes", () => {
    const out = run([
      { op: "add", path: "/overrides/core~1testing~1no-focused-tests", value: "warn" },
      { op: "replace", path: "/name", value: "renamed" },
      { op: "add", path: "/methodologies/-", value: "core/tdd" },
      { op: "add", path: "/methodologies/0", value: "core/clean-code" },
      { op: "remove", path: "/methodologies/1" },
    ]);
    expect("presetText" in out && JSON.parse(out.presetText)).toMatchObject({
      name: "renamed", methodologies: ["core/clean-code"],
      overrides: { "CA-UC-001": "off", "core/testing/no-focused-tests": "warn" },
    });
  });
  test.each([
    ["failed test", [{ op: "test", path: "/name", value: "other" }], "request: /patch/0: test failed at /name"],
    ["missing target", [{ op: "remove", path: "/layers" }], "request: /patch/0: /layers does not exist"],
    ["missing parent", [{ op: "add", path: "/coexist/arkgate", value: {} }], "request: /patch/0: /coexist/arkgate: the parent does not exist"],
    ["bad index", [{ op: "add", path: "/methodologies/5", value: "x" }], "request: /patch/0: /methodologies/5: invalid array index"],
    ["whole document", [{ op: "remove", path: "" }], "request: /patch/0: the whole preset cannot be removed"],
    ["unknown op", [{ op: "move", path: "/name", from: "/version" }], "request: /patch/0: matches no allowed form"],
    ["replace a missing key", [{ op: "replace", path: "/failMode", value: "open" }], "request: /patch/0: /failMode does not exist"],
    ["result breaks the schema", [{ op: "add", path: "/failMode", value: "open" }], 'preset.json: /failMode: must be "closed"'],
  ])("%s", (_, patch, error) => {
    expect(run(patch)).toEqual({ errors: [error] });
  });
  test("a request that is not a request", () => {
    expect(applyRequest(preset, JSON.stringify({ patch: [] }))).toEqual({ errors: ["request: /why: is required"] });
    expect(applyRequest(preset, "[")).toEqual({ errors: ["request: invalid JSON"] });
  });
  test("__proto__ is an ordinary key", () => {
    const out = run([{ op: "add", path: "/overrides/__proto__", value: { severity: "warn" } }]);
    expect("presetText" in out && Object.keys(JSON.parse(out.presetText).overrides)).toEqual(["CA-UC-001", "__proto__"]);
  });
});

describe("listChecks", () => {
  test("the check IDs of a source, sorted", () => {
    expect(listChecks(MODEL)).toEqual({ ids: [
      "core/complexity/fn-max-params", "core/dependencies/banned-imports", "core/integrity/double-type-assertion",
      "core/integrity/no-dynamic-import-in-layer", "core/testing/no-focused-tests",
    ] });
  });
  const C = "checks/complexity/fn-max-params/check.json";
  const M = "methodologies/clean-code.json";
  const edit = (path: string, change: (doc: Record<string, unknown>) => unknown): Files =>
    ({ ...MODEL, [path]: JSON.stringify(change(JSON.parse(MODEL[path]!))) });
  test.each([
    ["no source.json", { ...MODEL, "source.json": undefined as never }, "source.json: missing"],
    ["ID outside its folder", edit(C, (d) => ({ ...d, id: "core/complexity/max-params" })),
      `${C}: id must be core/complexity/fn-max-params and area complexity`],
    ["ID in another namespace", edit(C, (d) => ({ ...d, id: "local/complexity/fn-max-params" })),
      `${C}: id must be core/complexity/fn-max-params and area complexity`],
    ["unsupported keyword in params", edit(C, (d) => ({ ...d, params: { max: { type: "integer", default: 3 } } })),
      `${C}: /params/max/default: unsupported keyword`],
    ["paths declared", edit(C, (d) => ({ ...d, params: { max: { type: "integer" }, paths: STRINGS } })),
      `${C}: params.paths is implicit in every check; remove it`],
    ["schema", edit(C, (d) => ({ ...d, cardinality: "many" })), `${C}: /cardinality: must be one of "singleton", "multi"`],
    ["manifest ID", edit(M, (d) => ({ ...d, id: "core/clean" })), `${M}: id must be core/clean-code`],
    ["deny without examples", edit(M, (d) => ({ ...d, invariants: [{ ...alias("CC-FN-002", "core/complexity/fn-max-params", {}), examples: undefined }] })),
      `${M}: CC-FN-002: a deny invariant needs why, fixHint, avoid and examples`],
    ["empty fix", edit(M, (d) => ({ ...d, invariants: [{ ...alias("CC-FN-002", "core/complexity/fn-max-params", {}), fix: {} }] })),
      `${M}: CC-FN-002: fix needs where or use`],
    ["unknown check in its namespace", edit(M, (d) => ({ ...d, invariants: [alias("CC-FN-002", "core/complexity/nope", {})] })),
      "core/clean-code: CC-FN-002 uses unknown check core/complexity/nope"],
    ["alias twice in the namespace", edit(M, (d) => ({ ...d, invariants: [alias("TDD-FOCUS-001", "core/testing/no-focused-tests", {})] })),
      "core/tdd: alias TDD-FOCUS-001 is declared twice in core"],
    ["invalid JSON", { ...MODEL, [M]: "{" }, `${M}: invalid JSON`],
  ])("%s", (_, f, error) => {
    expect(listChecks(JSON.parse(JSON.stringify(f)) as Files)).toEqual({ errors: [error] });
  });
});

test("canonical sorts keys at every depth and ends with a newline", () => {
  expect(canonical({ b: [{ d: 1, c: 2 }], a: null })).toBe('{\n  "a": null,\n  "b": [\n    {\n      "c": 2,\n      "d": 1\n    }\n  ]\n}\n');
});
