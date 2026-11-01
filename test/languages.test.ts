import { beforeAll, expect, test } from "bun:test";
import { setUpGrammars } from "../src/assets.ts";
import { auditFile, auditRules } from "../src/audit.ts";
import { fixtureLock, listChecks } from "../src/compile.ts";
import { dependencyReviews } from "../src/dependencies.ts";
import { analyze } from "../src/evaluate.ts";
import { testCheck } from "../src/fixtures.ts";
import { resolve, reexportTargets } from "../src/resolve.ts";
import { classes, errorIn, functions, imports, nestings, parse } from "../src/ts.ts";
import type { Check, Files, Impl, Read, RuleLanguage } from "../src/types.ts";
import { contextFile } from "../src/workspace.ts";

beforeAll(setUpGrammars);
const reader = (files: Files): Read => { const map = new Map(Object.entries(files)); return (rel) => map.get(rel) ?? null; };
const now = () => performance.now();
function check(language: RuleLanguage, impl: Impl): Check {
  const params = impl.kind === "primitive" && impl.primitive === "metric" ? { max: { type: "integer", minimum: 0 } }
    : impl.kind === "primitive" && impl.primitive === "banned-import" ? { packages: { type: "array", items: { type: "string" } } } : {};
  return { id: "example/quality/check", version: "1.0.0", area: "quality", cardinality: "multi",
    dimension: "quality", minSeverity: null, languages: [language], params,
    impl, phase: ["pre", "stop", "commit", "ci"], feedback: { message: "{symbol} breaks {rule}." } };
}
const parsed = (rel: string, text: string, run: (p: ReturnType<typeof parse>) => void) =>
  deleting(parse(rel, text), (p) => { expect(errorIn(p, null)).toBeNull(); run(p); });

function deleting(p: ReturnType<typeof parse>, run: (p: ReturnType<typeof parse>) => void): void {
  try { run(p); }
  finally { p.root.tree.delete(); }
}

test("Python function parameters, comments, compact statements and nested symbols", () => {
  parsed("a.py", "def total(a, b=1, *, c=2, **kwargs):\n    # comment\n    x = a; y = b; return x + y\n\nclass Store:\n    def get(self, key):\n        handler = lambda value: value\n        return handler(key)\n", (p) => {
    expect(functions(p)).toEqual([
      { symbol: "total", line: 1, lines: 3, params: 4 },
      { symbol: "Store.get", line: 6, lines: 3, params: 2 },
      { symbol: "Store.get.handler", line: 7, lines: 1, params: 1 },
    ]);
  });
});

test("Go groups parameters, excludes receivers and names nested closures", () => {
  parsed("a.go", "package app\ntype Store struct{}\nfunc (s *Store) Get(a, b int, rest ...string) int {\n handler := func(x int) int { return x }\n return handler(a + b)\n}\n", (p) => {
    expect(functions(p)).toEqual([
      { symbol: "Store.Get", line: 3, lines: 4, params: 3 },
      { symbol: "Store.Get.handler", line: 4, lines: 1, params: 1 },
    ]);
    expect(classes(p)).toEqual([]);
  });
});

test("Python public methods are declared names, including decorators, excluding underscore names", () => {
  parsed("a.py", "class Store:\n    def public(self): pass\n    def _private(self): pass\n    @staticmethod\n    def build(): pass\n    @property\n    def value(self): return 1\n", (p) => {
    expect(classes(p)).toEqual([{ symbol: "Store", line: 1, publicMethods: 3 }]);
  });
});

test("guard clauses do not add TypeScript nesting depth", () => {
  parsed("a.ts", "export function keep(items: { parts: { ok: boolean }[] }[]): number {\n  for (const item of items) {\n    if (!item) continue;\n    for (const part of item.parts) {\n      if (!part.ok) {\n        continue;\n      }\n      if (part.ok) return 1;\n    }\n  }\n  return 0;\n}\n", (p) => {
    expect(nestings(p).map((x) => [x.line, x.measured])).toEqual([[2, 1], [4, 2]]);
  });
});

test("Python nesting covers mixed controls and resets at nested functions", () => {
  parsed("a.py", "def f():\n    if a:\n        for item in items:\n            with resource:\n                pass\n            def nested():\n                while ready:\n                    pass\n    elif b:\n        for item in items:\n            pass\n", (p) => {
    expect(nestings(p).map((x) => [x.line, x.measured, x.symbol])).toEqual([
      [2, 1, "f"], [3, 2, "f"], [4, 3, "f"], [7, 1, "f.nested"], [10, 2, "f"],
    ]);
  });
});

test("Go else-if depth stays flat and closures restart mixed-control depth", () => {
  parsed("a.go", "package app\nfunc f() {\n if a {\n  for ready {\n   switch value { case 1: break }\n   handler := func() { if b {} }\n  }\n } else if b { for ready {} }\n}\n", (p) => {
    expect(nestings(p).map((x) => [x.line, x.measured])).toEqual([[3, 1], [4, 2], [5, 3], [6, 1], [8, 1], [8, 2]]);
  });
});

test("Python imports preserve module bases, aliases and literal loading; unknown dynamic loads stay unknown", () => {
  parsed("pkg/__init__.py", "import os.path as path, json\nfrom .infra import db as database\n__import__(\"legacy\\x2eapi\")\nimportlib.import_module(name)\nimportlib.import_module(\".db\", \"pkg\")\n", (p) => {
    expect(imports(p)).toEqual([
      { spec: "os.path", line: 1, kind: "reexport", literal: true },
      { spec: "json", line: 1, kind: "reexport", literal: true },
      { spec: ".infra.db", base: ".infra", line: 2, kind: "reexport", literal: true },
      { spec: "legacy.api", line: 3, kind: "dynamic", literal: true },
      { spec: "name", line: 4, kind: "dynamic", literal: false },
      { spec: "\".db\"", line: 5, kind: "dynamic", literal: false },
    ]);
  });
});

test("Go blank, dot and renamed imports decode paths without confusing aliases for packages", () => {
  parsed("a.go", "package app\nimport (\n _ \"example.com/app/internal/infra\"\n . \"fmt\"\n alias \"example.com\\x2flib\"\n)\n", (p) => {
    expect(imports(p).map((x) => [x.spec, x.line, x.literal])).toEqual([
      ["example.com/app/internal/infra", 3, true], ["fmt", 4, true], ["example.com/lib", 5, true],
    ]);
  });
});

test("Invalid Unicode import literals do not crash analysis or become proven imports", () => {
  deleting(parse("a.py", "__import__(\"\\U00110000\")\n"), (p) => expect(imports(p)[0]?.literal).toBe(false));
});

test("Python resolves root/src regular packages, relative imports and from-module attributes", () => {
  const read = reader({ "src/pkg/__init__.py": "", "src/pkg/core/__init__.py": "", "src/pkg/core/a.py": "",
    "src/pkg/infra/__init__.py": "", "src/pkg/infra/db.py": "class DB: pass\n", "helper.py": "" });
  expect(resolve("src/pkg/core/a.py", "pkg.infra.db", null, read)).toEqual({ rel: "src/pkg/infra/db.py" });
  expect(resolve("src/pkg/core/a.py", "..infra.db.DB", null, read, "..infra.db")).toEqual({ rel: "src/pkg/infra/db.py" });
  expect(resolve("src/pkg/core/a.py", "helper", null, read)).toEqual({ rel: "helper.py" });
  expect(resolve("src/pkg/core/a.py", ".missing", null, read)).toBe("unresolved");
  expect(resolve("src/pkg/core/a.py", "pkg.missing", null, read)).toBe("unresolved");
  expect(resolve("src/pkg/core/a.py", "...outside", null, read)).toBe("unresolved");
  expect(resolve("src/pkg/core/a.py", "json", "invalid", read)).toBe("external");
  const ambiguous = reader({ "pkg/__init__.py": "", "src/pkg/__init__.py": "" });
  expect(resolve("a.py", "pkg", null, ambiguous)).toBe("unresolved");
  const namespace = reader({ "pkg/a.py": "" });
  expect(resolve("a.py", "pkg.a", null, namespace)).toBe("unresolved");
});

test("Python facades cannot hide architectural imports; chains retain the existing bounds", () => {
  const read = reader({ "pkg/__init__.py": "from .infra import DB\n", "pkg/infra.py": "class DB: pass\n" });
  expect(reexportTargets("pkg/__init__.py", null, read)).toEqual([{ spec: ".infra.DB", to: { rel: "pkg/infra.py" } }]);
  const parent = reader({ "pkg/__init__.py": "import legacy.api\n", "pkg/core/__init__.py": "", "pkg/core/model.py": "class Model: pass\n" });
  expect(reexportTargets("pkg/core/model.py", null, parent)).toEqual([{ spec: "legacy.api", to: "external" }]);
});

test("Go resolves nearest module and local replacements as package directories, rejecting uncertain graphs", () => {
  const read = reader({ "go.mod": "module example.com/app\n\ngo 1.22\nreplace example.com/lib => ./internal/lib\n" });
  expect(resolve("internal/core/a.go", "example.com/app/internal/infra", "invalid", read)).toEqual({ rel: "internal/infra/" });
  expect(resolve("internal/core/a.go", "example.com/lib/store", null, read)).toEqual({ rel: "internal/lib/store/" });
  expect(resolve("internal/core/a.go", "fmt", null, read)).toBe("external");
  expect(resolve("internal/core/a.go", "example.com/app/../infra", null, read)).toBe("unresolved");
  expect(resolve("nested/core/a.go", "nested/app/infra", null, reader({ "go.mod": "module outer/app\n", "nested/go.mod": "module nested/app\n" }))).toEqual({ rel: "nested/infra/" });
  for (const config of ["module broken extra\n", "module example.com/app\nreplace example.com/lib => ../outside\n", "module example.com/app\nreplace example.com/lib v1.0.0 => ./lib\n"]) {
    expect(resolve("core/a.go", "example.com/lib", null, reader({ "go.mod": config }))).toBe("unresolved");
  }
  expect(resolve("nested/core/a.go", "nested/app/infra", null, reader({ "go.work": "go 1.22\nuse ./nested\n", "nested/go.mod": "module nested/app\n" }))).toBe("unresolved");
  expect(contextFile("nested/go.mod")).toBe(true);
  expect(contextFile("go.work")).toBe(true);
});

test("JS/TS rules keep their old coverage; explicit foreign metrics work in audit", () => {
  const c = check("python", { kind: "primitive", primitive: "metric", metric: "fn.params" });
  const lock = fixtureLock(c, { max: 1 }, {});
  expect(analyze(lock, "pre", "a.ts", "function f(a,b) {}", { read: reader({}), now })).toMatchObject({ violations: [] });
  const legacy = { ...c }; delete legacy.languages;
  expect(analyze(fixtureLock(legacy, { max: 1 }, {}), "pre", "a.py", "def f(a,b): pass\n", { read: reader({}), now })).toMatchObject({ violations: [] });
  expect(auditFile(auditRules(lock).lock, "a.py", "def f(a,b): pass\n", { read: reader({}), now }).findings).toMatchObject([{ measured: 2, line: 1 }]);
  expect(auditFile(auditRules(lock).lock, "a.py", "def f(:\n", { read: reader({}), now }).errors).toMatchObject([{ cause: "syntax" }]);
});

test("Foreign layer rules block local forbidden imports and report unknown dynamic loads", () => {
  for (const [lang, rel, text, files] of [
    ["python", "pkg/core/a.py", "from ..infra import DB\n", { "pkg/__init__.py": "", "pkg/core/__init__.py": "", "pkg/infra.py": "class DB: pass\n" }],
    ["go", "internal/core/a.go", "package core\nimport _ \"example.com/app/internal/infra\"\n", { "go.mod": "module example.com/app\n" }],
  ] as [RuleLanguage, string, string, Files][]) {
    const lock = fixtureLock(check(lang, { kind: "primitive", primitive: "layer-edge" }), {}, { layers: {
      core: { paths: ["pkg/core/**", "internal/core/**"], mayImport: [], kind: "core" },
      infra: { paths: ["pkg/infra.py", "internal/infra/**"], mayImport: [], kind: "adapter" },
    } });
    expect(analyze(lock, "pre", rel, text, { read: reader(files), now })).toMatchObject({ violations: [{ line: lang === "python" ? 1 : 2 }] });
    if (lang === "python") expect(analyze(lock, "pre", rel, "__import__(name)\n", { read: reader(files), now })).toEqual({ cause: "unresolvable-import", line: 1 });
  }
  const banned = fixtureLock(check("python", { kind: "primitive", primitive: "banned-import" }), { packages: ["legacy"] }, {});
  expect(analyze(banned, "pre", "a.py", "from legacy.api import value\n", { read: reader({}), now })).toMatchObject({ violations: [{ line: 1 }] });
  expect(analyze(banned, "pre", "a.py", "import legacy_ok\n", { read: reader({}), now })).toMatchObject({ violations: [] });
});

test("Foreign structural patterns use their own grammar rather than TypeScript snippets", () => {
  for (const [lang, rel, source, pattern, line] of [
    ["python", "a.py", "try:\n    work()\nexcept:\n    pass\n", { kind: "except_clause", regex: "^except\\s*:" }, 3],
    ["go", "a.go", "package app\nimport . \"fmt\"\n", { kind: "import_spec", has: { kind: "dot", field: "name" } }, 2],
  ] as const) {
    const c = check(lang, { kind: "pattern", patterns: { [lang]: [{ id: "foreign", rule: pattern }] } });
    expect(analyze(fixtureLock(c, {}, {}), "pre", rel, source, { read: reader({}), now })).toMatchObject({ violations: [{ line }] });
  }
});

test("Unchanged foreign importers are rechecked against their own dependency baselines", () => {
  const lock = fixtureLock(check("go", { kind: "primitive", primitive: "layer-edge" }), {}, { layers: {
    core: { paths: ["internal/core/**"], mayImport: [], kind: "core" },
    infra: { paths: ["internal/infra/**"], mayImport: [], kind: "adapter" },
  } });
  const code = "package core\nimport _ \"example.com/lib\"\n";
  const files = { "internal/core/a.go": code, "go.mod": "module example.com/app\nreplace example.com/lib => ./internal/infra\n" };
  const before = { ...files, "go.mod": "module example.com/app\nreplace example.com/lib => ./internal/core\n" };
  expect(dependencyReviews(["internal/core/a.go"], { lock, phase: "pre", changed: new Set(["go.mod"]), read: reader(files), before: reader(before), now })).toMatchObject([
    { rel: "internal/core/a.go", violations: [{ line: 2 }] },
  ]);
  const python = fixtureLock(check("python", { kind: "primitive", primitive: "layer-edge" }), {}, { layers: {
    core: { paths: ["pkg/core/**"], mayImport: [], kind: "core" },
    infra: { paths: ["pkg/infra.py"], mayImport: [], kind: "adapter" },
  } });
  const current = { "pkg/__init__.py": "", "pkg/core/__init__.py": "from ..infra import DB\n", "pkg/infra.py": "class DB: pass\n",
    "pkg/core/model.py": "", "pkg/core/a.py": "importlib.import_module(\"pkg.core.model\")\n" };
  const baseline = { ...current, "pkg/core/__init__.py": "" };
  expect(dependencyReviews(["pkg/core/a.py"], { lock: python, phase: "pre", changed: new Set(["pkg/core/__init__.py"]),
    read: reader(current), before: reader(baseline), now })).toMatchObject([{ rel: "pkg/core/a.py", violations: [{ line: 1 }] }]);
});

test("Packs cannot declare duplicate languages, empty implementations or Go class metrics", () => {
  for (const c of [
    { ...check("python", { kind: "primitive", primitive: "metric", metric: "fn.params" }), languages: ["python", "python"] },
    check("python", { kind: "pattern", patterns: { python: [] } }),
    check("go", { kind: "primitive", primitive: "metric", metric: "class.publicMethods" }),
  ]) expect(listChecks({ "source.json": JSON.stringify({ ns: "example", version: "1.0.0" }),
    "checks/quality/check/check.json": JSON.stringify(c) })).toHaveProperty("errors");
});

test("Each declared language requires its own pass/fail/trap admission coverage", () => {
  const c = { ...check("python", { kind: "primitive", primitive: "metric", metric: "fn.params" }), languages: ["python", "go"] };
  const files: Files = { "source.json": JSON.stringify({ ns: "example", version: "1.0.0" }), "checks/quality/check/check.json": JSON.stringify(c) };
  for (const [name, source, fail] of [["pass/a", "def f(a): pass\n", false], ["pass/b", "def f(): pass\n", false],
    ["fail/a", "def f(a,b): pass\n", true], ["fail/b", "def f(a,b): pass\n", true], ["trap/a", "f = lambda a,b: a\n", true]] as const) {
    const dir = "checks/quality/check/fixtures/" + name + "/";
    files[dir + "fixture.json"] = JSON.stringify({ language: "python", target: "a.py", params: { max: 1 }, before: null,
      expect: { verdict: fail ? "fail" : "pass", ...(fail ? { violations: [{ line: 1, measured: 2 }] } : {}) },
      ...(name.startsWith("trap/") ? { trap: { family: "lambda", origin: "forge", discovered: "2026-10-03", note: "A closure is also a function." } } : {}) });
    files[dir + "files/a.py"] = source;
  }
  const result = testCheck(files, c.id, now);
  expect(result.ok).toBe(false);
  expect(result.lines.join("\n")).toContain("go: needs at least 2 pass fixtures");
  expect(result.lines.filter((line) => line.startsWith("ok"))).toHaveLength(5);
});
