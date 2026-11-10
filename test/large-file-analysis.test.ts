import { beforeAll, expect, spyOn, test } from "bun:test";
import { setUpGrammars } from "../src/assets.ts";
import { clock } from "../src/gate.ts";
import { compilePattern, findAll } from "../src/match.ts";
import { parse, suggestFunctionSplit, suggestNestingFix } from "../src/ts.ts";

// A vendored 68,000-line bundle made one audit run for minutes: three questions that have one answer
// per node were asked again for every candidate. These tests count the work, not the time, so they
// hold on a slow machine: each question is asked once per node, and every match is still reported.
beforeAll(setUpGrammars);

// The matches a pattern finds, and how many times the regex with this source ran to find them.
function counted(source: string, parsed: ReturnType<typeof parse>, config: Parameters<typeof compilePattern>[0]) {
  const spy = spyOn(RegExp.prototype, "test");
  try {
    const found = findAll(parsed, compilePattern(config, "typescript"), clock);
    if (!Array.isArray(found)) throw new Error(found.cause);
    return { found, runs: spy.mock.contexts.filter((re) => (re as RegExp).source === source).length };
  } finally { spy.mockRestore(); }
}

test("has to the end of an ancestor is answered once per ancestor, also when it binds a free metavariable", () => {
  const calls = 60;
  const source = ['import { useRouter } from "next/navigation";', 'import { a } from "./a";', 'import { b } from "./b";',
    ...Array.from({ length: calls }, (_, i) => `list${i}.push(a + b);`)].join("\n") + "\n";
  const importSource = "^[\"']next/navigation[\"']$";
  const config = { id: "t", rule: { all: [{ pattern: "$LIST.push($ARG)" },
    { inside: { kind: "program", stopBy: "end" as const, has: { kind: "import_statement", stopBy: "end" as const,
      all: [{ has: { field: "source", regex: importSource } }, { has: { kind: "import_specifier", stopBy: "end" as const, has: { field: "name", pattern: "$HOOK" } } }] } } }] } };
  const { found, runs } = counted(importSource, parse("a.ts", source), config);
  expect(found).toHaveLength(calls);
  expect(found.every((match) => (match.env.$HOOK as { text: string }).text === "useRouter")).toBe(true);
  expect(runs).toBeLessThanOrEqual(3);
});

test("a program-wide has under inside is scanned once, not once per call expression, when nothing in the file satisfies it", () => {
  const calls = 60;
  const source = ['import { a } from "./a";', 'import { b } from "./b";', ...Array.from({ length: calls }, (_, i) => `client${i}.auth.getSession(a, b);`)].join("\n") + "\n";
  const marker = "^server-only$";
  const config = { id: "t", rule: { kind: "call_expression", has: { field: "function", kind: "member_expression", regex: "\\.auth\\.getSession$" },
    inside: { stopBy: "end" as const, kind: "program", any: [{ has: { stopBy: "end" as const, kind: "string_fragment", regex: marker } }] } } };
  const missing = counted(marker, parse("a.ts", source), config);
  expect(missing.found).toEqual([]);
  expect(missing.runs).toBeLessThanOrEqual(2);   // the two import sources, once
  const present = counted(marker, parse("a.ts", `import "server-only";\n${source}`), config);
  expect(present.found).toHaveLength(calls);
});

test("a candidate that already carries the metavariable is asked directly, so its own binding decides", () => {
  const source = 'import { useRouter } from "next/navigation";\nuseRouter.push(1);\nother.push(2);\n';
  const config = { id: "t", rule: { all: [{ pattern: "$HOOK.push($ARG)" },
    { inside: { kind: "program", stopBy: "end" as const, has: { kind: "import_specifier", stopBy: "end" as const, has: { field: "name", pattern: "$HOOK" } } } }] } };
  const found = findAll(parse("a.ts", source), compilePattern(config, "typescript"), clock);
  if (!Array.isArray(found)) throw new Error(found.cause);
  expect(found.map((match) => match.node.text)).toEqual(["useRouter.push(1)"]);
});

test("a regex over a long enclosing node runs once for that node, not once per node inside it", () => {
  const uses = 40;
  const body = Array.from({ length: uses }, (_, i) => `  const value${i} = secret + ${i}; // ${"x".repeat(60)}`).join("\n");
  const source = `function signHmac(secret) {\n${body}\n  return secret;\n}\n`;
  expect(source.length).toBeGreaterThan(2048);
  const config = { id: "t", rule: { kind: "identifier", regex: "^secret$", inside: { stopBy: "end" as const, kind: "function_declaration", regex: "(?i)hmac" } } };
  const { found, runs } = counted("hmac", parse("a.ts", source), config);
  expect(found).toHaveLength(uses + 2);   // the parameter, each use, and the return
  expect(runs).toBe(1);
});

test("repair hints for many long functions and nested blocks walk the tree once, and name the same lines", () => {
  const functions = 25;
  const source = Array.from({ length: functions }, (_, i) =>
    `function f${i}(a, b) {\n  const one = a + ${i};\n  const two = b + one;\n  if (a) {\n    if (b) {\n      if (one) {\n        return two;\n      }\n    }\n  }\n  const three = two * 2;\n  return three;\n}\n`).join("\n");
  const parsed = parse("a.ts", source);
  const walks = spyOn(Object.getPrototypeOf(parsed.root) as { descendantsOfType: (...args: unknown[]) => unknown }, "descendantsOfType");
  try {
    const splits = Array.from({ length: functions }, (_, i) => suggestFunctionSplit(parsed, 1 + i * 14, 5));
    const nests = Array.from({ length: functions }, (_, i) => suggestNestingFix(parsed, 6 + i * 14));
    expect(splits[0]).toMatch(/^Suggested split: extract lines \d+-\d+ into a helper\.$/);
    expect(new Set(splits.map((hint, i) => hint!.replace(/\d+/g, (n) => String(Number(n) - i * 14)))).size).toBe(1);
    expect(nests[0]).toBe("Suggested refactor: invert condition at line 4 into a guard clause.");
    expect(nests.every((hint) => hint !== null)).toBe(true);
    expect(walks.mock.calls.length).toBeLessThanOrEqual(2);   // one walk for functions, one for control blocks
  } finally { walks.mockRestore(); }
});
