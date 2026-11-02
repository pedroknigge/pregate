import { beforeAll, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Lang, parse as oracleParse, type SgRoot } from "@ast-grep/napi";
import { setUpGrammars } from "../src/assets.ts";
import { clock } from "../src/gate.ts";
import { compilePattern, findAll } from "../src/match.ts";
import { grammarOf, type Parsed, parse } from "../src/ts.ts";
import type { Check, Clock, Grammar, PatternConfig } from "../src/types.ts";
import { slash } from "../src/paths.ts";

beforeAll(setUpGrammars);

type Config = Omit<PatternConfig, "id">;
type Row = [name: string, config: Config, source: string, expected: string[]];

// Every match as "start-end kind" plus its metavariables, so both engines print the same shape. The
// differential also prints where each bound node starts: a binding to an equal text elsewhere differs.
function ours(c: Config, source: string | Parsed, g: Grammar): string[] {
  const at = typeof source === "string" ? () => "" : (n: { startIndex: number }) => `@${n.startIndex}`;
  const p = typeof source === "string" ? parse(g === "tsx" ? "a.tsx" : "a.ts", source) : source;
  const found = findAll(p, compilePattern({ id: "t", ...c }, g), clock);
  if (!Array.isArray(found)) throw new Error(`${found.cause} at line ${found.line}`);
  return found.map((m) => {
    const bound = Object.entries(m.env).filter(([, v]) => !Array.isArray(v) || v.length);   // napi shows no empty list
    const env = bound.map(([k, v]) => `${k}=${(Array.isArray(v) ? v : [v]).map((n) => n.text + at(n)).join("|")}`);
    return [`${m.node.startIndex}-${m.node.endIndex} ${m.node.type}`, ...env.sort()].join(" ");
  });
}

function oracle(c: Config, source: string | SgRoot, g: Grammar): string[] {
  const text = JSON.stringify(c);
  const names = (re: RegExp) => [...new Set([...text.matchAll(re)].map((m) => m[1]!))].filter((n) => !n.startsWith("_"));
  const [single, multi] = [names(/(?<!\$)\$\$?([A-Z_][A-Z0-9_]*)/g), names(/\$\$\$([A-Z_][A-Z0-9_]*)/g)];
  const root = typeof source === "string" ? oracleParse(g === "tsx" ? Lang.Tsx : Lang.TypeScript, source) : source;
  const at = typeof source === "string" ? () => "" : (n: { range(): { start: { index: number } } }) => `@${n.range().start.index}`;
  return root.root().findAll({ rule: c.rule, utils: c.utils, constraints: c.constraints } as never).map((m) => {
    const env = [
      ...single.flatMap((n) => { const v = m.getMatch(n); return v ? [`$${n}=${v.text()}${at(v)}`] : []; }),
      ...multi.flatMap((n) => { const v = m.getMultipleMatches(n); return v.length ? [`$$$${n}=${v.map((x) => x.text() + at(x)).join("|")}`] : []; }),
    ];
    return [`${m.range().start.index}-${m.range().end.index} ${m.kind()}`, ...env.sort()].join(" ");
  });
}

// A table row passes only if ast-grep agrees: the expectations document ast-grep's semantics.
function check(rows: Row[]): void {
  for (const [name, config, source, expected] of rows) {
    expect({ name, ours: ours(config, source, "typescript") }).toEqual({ name, ours: expected });
    expect({ name, oracle: oracle(config, source, "typescript") }).toEqual({ name, oracle: expected });
  }
}

test("readonly exported properties preserve signature coverage without claiming local assertion types", () => {
  const spec = JSON.parse(readFileSync("packs/typescript/checks/types/readonly-exported-property/check.json", "utf8")) as Check;
  if (spec.impl.kind !== "pattern") throw new Error("readonly check must remain a pattern");
  const config = spec.impl.patterns.typescript![0]!;
  const cases: [string, string[]][] = [
    ["export interface Invoice { total: number; nested: { count: number } }", ["total: number", "nested: { count: number }", "count: number"]],
    ["export type Invoice = { total: number; readonly name: string }", ["total: number"]],
    ["export interface Invoice { readonly details: Box<{ total: number }> }", ["total: number"]],
    ["export type Factory = <T>() => { total: number };", ["total: number"]],
    ["export function save(value: { total: number }): { count: number } { return { count: value.total }; }", ["total: number", "count: number"]],
    ["export default function(value: { total: number }): { count: number } { return { count: value.total }; }", ["total: number", "count: number"]],
    ["export const save = (value: { total: number }): { count: number } => ({ count: value.total });", ["total: number", "count: number"]],
    ["export class Client { save(value: { total: number }): { count: number } { return { count: value.total }; } }", ["total: number", "count: number"]],
    ["export default class { save(value: { total: number }): { count: number } { return { count: value.total }; } }", ["total: number", "count: number"]],
    ["export class Client { save(value: unknown) { const bytes = value as { bytes?: unknown }; return bytes; } }", []],
    ["export function save(value: unknown) { interface Local { bytes: unknown }; return value as Local; }", []],
    ["export const value = input as { bytes?: unknown };", []],
    ["export const value = <{ bytes?: unknown }>input;", []],
    ["export const value = input satisfies { bytes?: unknown };", []],
    ["export const value = factory<{ bytes?: unknown }>();", []],
    ["export const value = new Factory<{ bytes?: unknown }>();", []],
    ["interface Local { bytes: unknown } export { Local };", []],
  ];
  for (const grammar of ["typescript", "tsx"] as const) for (const [source, expected] of cases) {
    if (grammar === "tsx" && source.includes("<{ bytes?: unknown }>input")) continue; // angle assertions are not TSX syntax
    const parsed = parse(grammar === "tsx" ? "public-boundary.tsx" : "public-boundary.ts", source), found = findAll(parsed, compilePattern(config, grammar), clock);
    if (!Array.isArray(found)) throw new Error(found.cause);
    expect(found.map(match => match.node.text)).toEqual(expected);
    const native = oracleParse(grammar === "tsx" ? Lang.Tsx : Lang.TypeScript, source).root().findAll({ rule: config.rule } as never);
    expect(native.map(match => match.text())).toEqual(expected);
    parsed.root.tree.delete();
  }
});

test("pattern trees do not materialize native nodes for a rejected kind", () => {
  const source = Array.from({ length: 200 }, (_, i) => `const item${i} = holder${i}.value;`).join("\n");
  const config: Config = { rule: { kind: "class_declaration" } };
  const compiled = compilePattern({ ...config, id: "native-node-demand" }, "typescript");
  const parsed = parse("x.ts", source), cursor = parsed.root.walk();
  const prototype = Object.getPrototypeOf(cursor), original = Object.getOwnPropertyDescriptor(prototype, "currentNode")!;
  cursor.delete();
  let materializations = 0;
  withTree(parsed, () => {
    Object.defineProperty(prototype, "currentNode", { ...original, get() { materializations++; return original.get!.call(this); } });
    expect(findAll(parsed, compiled, clock)).toEqual([]);
  }, () => { Object.defineProperty(prototype, "currentNode", original); });
  expect(materializations).toBe(0);
  expect(oracle(config, source, "typescript")).toEqual([]);
});

test("pattern trees allocate field caches only for field queries and retain native verdicts", () => {
  const source = Array.from({ length: 200 }, (_, i) => `const item${i} = holder${i}.value;`).join("\n");
  const field: Config = { rule: { kind: "member_expression", has: { field: "property", pattern: "$PROPERTY" } } };
  const absent: Config = { rule: { kind: "member_expression", has: { field: "name", kind: "identifier" } } };
  const configs: Config[] = [{ rule: { kind: "identifier" } }, field, field, absent, absent];
  const compiled = configs.map(c => compilePattern({ ...c, id: "field-cache" }, "typescript"));
  const parsed = parse("x.ts", source), NativeMap = globalThis.Map;
  let allocations = 0;
  class CountedMap<K, V> extends NativeMap<K, V> {
    constructor(entries?: Iterable<readonly [K, V]> | null) { super(entries); allocations++; }
  }
  const counts: number[] = [], results: string[][] = [];
  withTree(parsed, () => {
    globalThis.Map = CountedMap;
    for (const c of compiled) {
      const before = allocations, found = findAll(parsed, c, clock);
      if (!Array.isArray(found)) throw new Error(found.cause);
      counts.push(allocations - before);
      results.push(found.map(m => [
        `${m.node.startIndex}-${m.node.endIndex} ${m.node.type}`,
        ...Object.entries(m.env).map(([key, value]) => `${key}=${(Array.isArray(value) ? value : [value]).map(n => n.text).join("|")}`).sort(),
      ].join(" ")));
    }
  }, () => { globalThis.Map = NativeMap; });
  expect(counts[0]).toBe(0);
  expect(counts[1]).toBeGreaterThan(0);
  expect(counts.slice(2)).toEqual([0, 0, 0]);
  for (const [i, config] of configs.entries()) expect(results[i]).toEqual(oracle(config, source, "typescript"));
});

test("kind candidates retain full traversal order, captures and wildcard alternatives on a reused tree", () => {
  const source = "const x = f(1); g(x); class Item { value() { return f(x); } }";
  const parsed = parse("x.ts", source);
  const configs: Config[] = [
    { rule: { any: [{ kind: "class_declaration" }, { pattern: "f($A)" }, { kind: "identifier" }] } },
    { rule: { all: [{ kind: "call_expression" }, { has: { field: "arguments", pattern: "$ARGS" } }] } },
    { rule: { kind: "identifier", not: { regex: "^x$" }, inside: { kind: "arguments" } } },
    { rule: { any: [{ pattern: "f($A)" }, { pattern: "$ANY" }] } },
    { rule: { pattern: "f($A)" }, constraints: { A: { kind: "identifier" } } },
  ];
  const describe = (result: ReturnType<typeof findAll>) => Array.isArray(result) ? result.map(m => ({
    at: m.node.startIndex, end: m.node.endIndex, type: m.node.type,
    captures: Object.entries(m.env).map(([key, value]) => [key, (Array.isArray(value) ? value : [value]).map(n => [n.startIndex, n.endIndex, n.text])]),
  })) : result;
  withTree(parsed, () => {
    for (const [index, config] of configs.entries()) {
      const compiled = compilePattern({ id: "candidate-order", ...config }, "typescript");
      expect(compiled.kinds === undefined).toBe(index === 3);
      expect(describe(findAll(parsed, compiled, clock))).toEqual(describe(findAll(parsed, { ...compiled, kinds: undefined }, clock)));
      expect(ours(config, parsed, "typescript")).toEqual(oracle(config, oracleParse(Lang.TypeScript, source), "typescript"));
    }
  });
});

test("kind candidates do not skip a timed regex before a rejecting kind", () => {
  const compiled = compilePattern({ id: "candidate-regex-failure", rule: { all: [{ regex: "^(ab)+$" }, { kind: "number" }] } }, "typescript");
  const parsed = parse("x.ts", "abc; f(ab);");
  let elapsed = 0;
  withTree(parsed, () => {
    expect(compiled.kinds).toBeUndefined();
    expect(findAll(parsed, compiled, () => elapsed += 1000)).toEqual({ cause: "regex-limit", line: 1 });
  });
});

test("utility kind candidates resolve forward references without changing captures or recursive relations", () => {
  const source = "const x = f(1); g(x); f((2)); class Item { value() { return f(x); } }";
  const parsed = parse("x.ts", source);
  const configs: Config[] = [
    { utils: { alias: { matches: "target" }, target: { pattern: "f($A)" } }, rule: { matches: "alias" } },
    { utils: { target: { kind: "identifier" } }, rule: { any: [{ kind: "class_declaration" }, { all: [{ matches: "target" }, { not: { regex: "^x$" } }] }] } },
    { utils: { nested: { any: [{ kind: "number" }, { kind: "parenthesized_expression", has: { matches: "nested" } }] } }, rule: { matches: "nested" } },
    { utils: { target: { pattern: "$ANY" } }, rule: { any: [{ pattern: "f($A)" }, { matches: "target" }] } },
  ];
  const describe = (result: ReturnType<typeof findAll>) => Array.isArray(result) ? result.map(m => ({
    at: m.node.startIndex, end: m.node.endIndex, type: m.node.type,
    captures: Object.entries(m.env).map(([key, value]) => [key, (Array.isArray(value) ? value : [value]).map(n => [n.startIndex, n.endIndex, n.text])]),
  })) : result;
  withTree(parsed, () => {
    for (const [index, config] of configs.entries()) {
      const compiled = compilePattern({ id: "utility-candidate-order", ...config }, "typescript");
      expect(compiled.kinds === undefined).toBe(index === 3);
      expect(describe(findAll(parsed, compiled, clock))).toEqual(describe(findAll(parsed, { ...compiled, kinds: undefined }, clock)));
      expect(ours(config, parsed, "typescript")).toEqual(oracle(config, oracleParse(Lang.TypeScript, source), "typescript"));
    }
    const timed = compilePattern({ id: "utility-regex-failure", utils: { target: { all: [{ regex: "^(ab)+$" }, { kind: "number" }] } }, rule: { matches: "target" } }, "typescript");
    expect(timed.kinds).toBeUndefined();
    let elapsed = 0;
    expect(findAll(parsed, timed, () => elapsed += 1000)).toEqual({ cause: "regex-limit", line: 1 });
  });
});

describe("operators (each row also checked against @ast-grep/napi)", () => {
  test("pattern: metavariables, lists, repeated names, trivia", () => check([
    ["$A binds a named node", { rule: { pattern: "f($A)" } }, "f(x); f(1, 2);", ["0-4 call_expression $A=x"]],
    ["$$$A takes a list with its commas", { rule: { pattern: "f($$$A)" } }, "f(a, b); f();",
      ["0-7 call_expression $$$A=a|,|b", "9-12 call_expression"]],
    ["ellipsis before a fixed tail", { rule: { pattern: "f($$$, c)" } }, "f(a, b, c); f(c); f(a);",
      ["0-10 call_expression", "12-16 call_expression"]],
    ["repeated name: same code", { rule: { pattern: "$A == $A" } }, "a.b == a.b; a == b;", ["0-10 binary_expression $A=a.b"]],
    ["$_ ignores, $$_ takes anonymous", { rule: { pattern: "$_ + $_" } }, "a + b;", ["0-5 binary_expression"]],
    ["comments inside are skipped", { rule: { pattern: "f($A, $B)" } }, "f(a, /* x */ b);", ["0-15 call_expression $A=a $B=b"]],
    ["a statement pattern ignores the semicolon", { rule: { pattern: "return $X" } }, "function g() { return 1; }",
      ["15-24 return_statement $X=1"]],
    ["member chains match exactly", { rule: { pattern: "$O.only($$$)" } }, "it.only(); it.skip(); a.b.only(x);",
      ["0-9 call_expression $O=it", "22-33 call_expression $O=a.b"]],
  ]));

  test("kind and regex: whole node text, leading (?i) and (?s), dot without newline", () => check([
    ["kind", { rule: { kind: "meta_property" } }, "const u = import.meta.url;", ["10-21 meta_property"]],
    ["regex is a search", { rule: { kind: "identifier", regex: "oo" } }, "foo(bar, boo);", ["0-3 identifier", "9-12 identifier"]],
    ["(?i)", { rule: { kind: "identifier", regex: "(?i)^FOO$" } }, "foo; Foo; fooo;", ["0-3 identifier", "5-8 identifier"]],
    ["dot skips newlines", { rule: { kind: "template_string", regex: "^`a.b`$" } }, "x = `a\nb`; y = `a-b`;", ["15-20 template_string"]],
    ["(?s) dot takes newlines", { rule: { kind: "template_string", regex: "(?s)^`a.b`$" } }, "x = `a\nb`;", ["4-9 template_string"]],
  ]));

  test("nthChild counts named siblings, comments included; reverse and ofRule", () => check([
    ["position", { rule: { kind: "identifier", nthChild: 2 } }, "f(a, b, c);", ["5-6 identifier"]],
    ["comments count", { rule: { kind: "identifier", nthChild: 2 } }, "f(/* c */ a, b);", ["10-11 identifier"]],
    ["reverse", { rule: { kind: "identifier", nthChild: { position: 1, reverse: true } } }, "f(a, b, c);", ["8-9 identifier"]],
    ["ofRule", { rule: { kind: "number", nthChild: { position: 1, ofRule: { kind: "number" } } } }, "f(a, 1, 2);", ["5-6 number"]],
  ]));

  test("has: anonymous children, field, stopBy end and rule", () => check([
    ["anonymous child", { rule: { kind: "unary_expression", has: { regex: "^typeof$" } } }, "typeof x; !x;", ["0-8 unary_expression"]],
    ["field", { rule: { kind: "call_expression", has: { field: "function", regex: "^g$" } } }, "g(f); f(g);", ["0-4 call_expression"]],
    ["neighbor stops at children", { rule: { kind: "arguments", has: { kind: "number" } } }, "f(1); f([1]);", ["1-4 arguments"]],
    ["end reaches descendants", { rule: { kind: "call_expression", has: { kind: "number", stopBy: "end" } } }, "f([1]);",
      ["0-6 call_expression"]],
    ["field with end includes the field node", { rule: { kind: "call_expression", has: { field: "arguments", kind: "arguments", stopBy: "end" } } },
      "f(1);", ["0-4 call_expression"]],
    ["stopBy rule is inclusive and does not descend past it",
      { rule: { kind: "call_expression", has: { kind: "number", stopBy: { kind: "array" } } } }, "f([1]); f({ a: 1 });",
      ["8-19 call_expression"]],
  ]));

  test("inside: field, stopBy end and rule", () => check([
    ["parent only", { rule: { kind: "identifier", inside: { kind: "arguments" } } }, "f(a, [b]);", ["2-3 identifier"]],
    ["field names the slot the node fills", { rule: { kind: "identifier", inside: { kind: "call_expression", field: "function" } } },
      "f(a);", ["0-1 identifier"]],
    ["end", { rule: { kind: "number", inside: { kind: "call_expression", stopBy: "end" } } }, "f([1]); x = [2];", ["3-4 number"]],
    ["field with end checks the slot at the ancestor that matches",
      { rule: { kind: "identifier", inside: { kind: "call_expression", field: "arguments", stopBy: "end" } } }, "f(a); a.f();", ["2-3 identifier"]],
    ["stopBy rule", { rule: { kind: "number", inside: { kind: "call_expression", stopBy: { kind: "array" } } } }, "f([1]); f(2);",
      ["10-11 number"]],
  ]));

  test("precedes and follows: neighbor is the very next sibling, anonymous ones included", () => check([
    ["follows neighbor", { rule: { kind: "expression_statement", follows: { kind: "lexical_declaration" } } }, "let a = 1; a; a;",
      ["11-13 expression_statement"]],
    ["follows end", { rule: { kind: "expression_statement", follows: { kind: "lexical_declaration", stopBy: "end" } } },
      "let a = 1; a; a;", ["11-13 expression_statement", "14-16 expression_statement"]],
    ["precedes end", { rule: { kind: "identifier", precedes: { kind: "number", stopBy: "end" } } }, "f(a, b, 1, c);",
      ["2-3 identifier", "5-6 identifier"]],
    ["the next sibling of an argument is a comma", { rule: { kind: "identifier", precedes: { kind: "identifier" } } }, "f(a, b);", []],
  ]));

  test("all, any, not: in order, first alternative wins, metavariables shared", () => check([
    ["all shares bindings", { rule: { all: [{ pattern: "$A = $B" }, { has: { field: "right", pattern: "$A" } }] } }, "x = x; x = y;",
      ["0-5 assignment_expression $A=x $B=x"]],
    ["any keeps the first alternative's bindings",
      { rule: { any: [{ pattern: "f($A)" }, { pattern: "f($A, $B)" }] } }, "f(1); f(1, 2);",
      ["0-4 call_expression $A=1", "6-13 call_expression $A=1 $B=2"]],
    ["not binds nothing", { rule: { kind: "call_expression", not: { pattern: "g($A)" } } }, "f(1); g(1);", ["0-4 call_expression"]],
    ["not reads only the bindings made before its place: atomic, all, any (O33)", { rule: { kind: "call_expression",
      has: { kind: "arguments", has: { nthChild: 1, pattern: "$A" } }, not: { has: { kind: "arguments", has: { nthChild: 2, pattern: "$A" } } } } },
    "f(a, a); f(a, b);", []],
    ["…and never those of matches", { utils: { first: { has: { kind: "arguments", has: { nthChild: 1, pattern: "$A" } } } },
      rule: { kind: "call_expression", matches: "first", not: { has: { kind: "arguments", has: { nthChild: 2, pattern: "$A" } } } } },
    "f(a, a); f(a, b);", []],
    ["…but all binds before it", { rule: { kind: "call_expression",
      all: [{ has: { kind: "arguments", has: { nthChild: 1, pattern: "$A" } } }], not: { has: { kind: "arguments", has: { nthChild: 2, pattern: "$A" } } } } },
    "f(a, a); f(a, b);", ["9-16 call_expression $A=a"]],
    ["has tries candidate by candidate with the env so far",
      { rule: { pattern: "$A + $B", has: { kind: "identifier", pattern: "$B" } } }, "a + b;", ["0-5 binary_expression $A=a $B=b"]],
  ]));

  test("matches and utils: shared env, recursion through relations; constraints", () => check([
    ["recursive util", {
      utils: { nested: { any: [{ kind: "number" }, { kind: "parenthesized_expression", has: { matches: "nested" } }] } },
      rule: { kind: "return_statement", has: { matches: "nested" } },
    }, "function f() { return ((1)); }", ["15-28 return_statement"]],
    ["a util binds into the caller's env", { utils: { callee: { has: { field: "function", pattern: "$F" } } },
      rule: { kind: "call_expression", matches: "callee" } }, "f(); a.b();", ["0-3 call_expression $F=f", "5-10 call_expression $F=a.b"]],
    ["constraint", { rule: { pattern: "Math.$R($X)" }, constraints: { R: { regex: "^(round|floor)$" } } },
      "Math.round(a); Math.max(a); Math.floor(b);", ["0-13 call_expression $R=round $X=a", "28-41 call_expression $R=floor $X=b"]],
    ["kinds the catalog depends on", { rule: { any: [{ kind: "nested_type_identifier" }, { kind: "undefined" }, { kind: "array_type" }] } },
      "let a: A.B = undefined; let b: C[];", ["7-10 nested_type_identifier", "13-22 undefined", "31-34 array_type"]],
  ]));
});

test("compilePattern rejects what it cannot evaluate exactly", () => {
  const table: [string, unknown, string][] = [
    ["unknown rule key", { rule: { kind: "identifier", inside_: {} } }, "unknown key inside_"],
    ["unknown config key", { rule: { kind: "identifier" }, fix: "x" }, "unknown key fix"],
    ["unknown kind", { rule: { kind: "identifer" } }, "unknown kind identifer"],
    ["kind of the other grammar", { rule: { kind: "jsx_element" } }, "unknown kind jsx_element"],
    ["unknown field", { rule: { has: { field: "callee", kind: "identifier" } } }, "unknown field callee"],
    ["field outside has/inside", { rule: { follows: { field: "body", kind: "identifier" } } }, "field is only supported"],
    ["lookahead", { rule: { regex: "a(?=b)" } }, "lookaround"],
    ["lookbehind", { rule: { regex: "(?<!a)b" } }, "lookaround"],
    ["backreference", { rule: { regex: "(a)\\1" } }, "backreferences"],
    ["Rust-only escape", { rule: { regex: "\\Afoo" } }, "unsupported escape"],
    ["nested class", { rule: { regex: "[[:alpha:]]" } }, "nested classes"],
    ["literal brace", { rule: { regex: "^({{x}})$" } }, "literal {"],
    ["invalid regex", { rule: { regex: "(a" } }, "invalid regex"],
    ["too many groups under a repetition", { rule: { regex: `^(?:${"(a)|".repeat(16)}b)*$` } }, "at most 16 groups"],
    ["empty rule", { rule: {} }, "at least one matcher"],
    ["relation without a matcher", { rule: { has: { stopBy: "end" } } }, "at least one matcher"],
    ["two nodes", { rule: { pattern: "a; b" } }, "more than one node"],
    ["a pattern that does not parse", { rule: { pattern: "f(" } }, "does not parse"],
    ["a lone list", { rule: { pattern: "$$$A" } }, "cannot be only"],
    ["undefined util", { rule: { matches: "nope" } }, "undefined util nope"],
    ["util cycle", { utils: { a: { any: [{ matches: "b" }] }, b: { not: { matches: "a" } } }, rule: { matches: "a" } }, "refers to itself"],
    ["util cycle through nthChild.ofRule", { utils: { a: { nthChild: { position: 1, ofRule: { matches: "a" } } } }, rule: { matches: "a" } }, "refers to itself"],
    ["constraint on an unbound name", { rule: { pattern: "f($A)" }, constraints: { B: { kind: "number" } } }, "undefined metavariable B"],
    ["functional nthChild", { rule: { nthChild: "2n+1" } }, "expected an object"],
  ];
  for (const [name, config, error] of table) {
    expect(() => compilePattern({ id: "t", ...(config as Config) }, "typescript")).toThrow(error);
  }
  expect(() => compilePattern({ id: "t", rule: { kind: "identifier" }, "x-note": "notes are ignored" } as PatternConfig, "typescript")).not.toThrow();
  expect(() => findAll(parse("a.tsx", "x"), compilePattern({ id: "t", rule: { kind: "identifier" } }, "typescript"), clock)).toThrow("compiled for typescript");
});

// O27: JavaScriptCore gives up on a regex with a repeated group and answers "no match" without
// throwing. The engine takes that answer for none: the search ends in a regex-limit form.
describe("a regex that may have given up never reads as no match", () => {
  const search = (rule: Config["rule"], source: string, now: Clock = clock) =>
    findAll(parse("a.ts", source), compilePattern({ id: "t", rule }, "typescript"), now);
  // `(a+)+b` backtracks over the run of a until JavaScriptCore gives up, before it reaches the "ab".
  const RUN = `${"a".repeat(40)}Xab`;
  const quoted = (body: string): string => `const s = "${body}";`;

  test("JavaScriptCore's answer: a wrong false, after more than twice SLOW_MS, without throwing", () => {
    const t = performance.now();
    expect(/(a+)+b/.test(RUN)).toBe(false);
    expect(performance.now() - t).toBeGreaterThan(100);
    expect(oracle({ rule: { kind: "identifier", regex: "(a+)+b" } }, `const ${RUN} = 1;`, "typescript")).toHaveLength(1);
  });

  test("pinned runtime regex controls: long noncapturing match, capture-memory exhaustion and safe-length matches", () => {
    // Far past LONG the runtime's answer to a valid match varies: the pinned Bun 1.4.4 matches,
    // Bun 1.3.14 gives up and answers false. Either way the engine never reads it as no match.
    const answered = /^(?:ab)*$/.test("ab".repeat(1_400_000));
    if (Bun.version === readFileSync(join(import.meta.dir, "../.bun-version"), "utf8").trim()) expect(answered).toBe(true);
    const found = search({ kind: "string", regex: '^"(?:ab)*"$' }, quoted("ab".repeat(1_400_000)));
    if (answered) expect(found).toHaveLength(1);
    else expect(found).toEqual({ cause: "regex-limit", line: 1 });
    expect(new RegExp(`^(?:${"(a)|".repeat(200)}b)*$`).test("a".repeat(30_000))).toBe(false);
    expect(new RegExp(`^${"(".repeat(16)}a${")*".repeat(16)}$`).test("a".repeat(65_536))).toBe(true);
    expect(new RegExp(`^(?:${"(a)|".repeat(15)}b)*$`).test("a".repeat(65_536))).toBe(true);
    expect(/^[ab]*$/.test("ab".repeat(4_000_000))).toBe(true);
  });

  test("a regex that gives up ends the search in regex-limit, even under not", () => {
    expect(search({ kind: "identifier", regex: "(a+)+b" }, `x;\nconst ${RUN} = 1;`)).toEqual({ cause: "regex-limit", line: 2 });
    expect(search({ kind: "identifier", not: { regex: "(a+)+b" } }, `const ${RUN} = 1;`)).toEqual({ cause: "regex-limit", line: 1 });
  });

  test("past LONG a repeated group's match counts and its no match gives up; other regexes answer", () => {
    const long = quoted("ab".repeat(40_000));
    expect(search({ kind: "string", regex: '^"(?:ab)*"$' }, long)).toHaveLength(1);
    expect(search({ kind: "string", regex: '^"(?:ab)*c"$' }, long)).toEqual({ cause: "regex-limit", line: 1 });
    expect(search({ kind: "string", regex: '^"[ab]*c"$' }, long)).toEqual([]);
    expect(search({ kind: "string", regex: '^"(?:ab)*c"$' }, quoted("ab".repeat(30_000)))).toEqual([]);
  });

  test("the injected clock is read only around a repeated group's no match", () => {
    let t = 0;
    const slow: Clock = () => (t += 1_000);
    const unread: Clock = () => {
      throw new Error("the clock was read");
    };
    expect(search({ kind: "identifier", regex: "^(ab)+$" }, "ab; abc;", slow)).toEqual({ cause: "regex-limit", line: 1 });
    expect(search({ kind: "identifier", regex: "^(ab)+$" }, "ab; ab;", slow)).toHaveLength(2);
    expect(search({ kind: "identifier", regex: "^a(b|c)?$" }, "ab; x;", unread)).toHaveLength(1);
  });

  // O33: `not` runs after every positive key, so a node they reject never evaluates it.
  test("not runs last: the clock is read only where the positive keys hold", () => {
    const unread: Clock = () => {
      throw new Error("the clock was read");
    };
    const not = { regex: "^(ab)+$" };
    expect(search({ kind: "identifier", inside: { kind: "arguments" }, not }, "abc;", unread)).toEqual([]);
    let t = 0;
    const slow: Clock = () => (t += 1_000);
    expect(search({ kind: "identifier", inside: { kind: "arguments" }, not }, "abc;\nf(abc);", slow)).toEqual({ cause: "regex-limit", line: 2 });
    expect(() => search({ kind: "identifier", inside: { kind: "arguments" }, not }, "f(abc);", unread)).toThrow("the clock was read");
  });

  test("the pilot's nested quantifier stays exact on real code", () => check([
    ["emit chain", { rule: { kind: "member_expression", regex: "^((\\w+|getKernel\\(\\))\\.)*(emit|publish)$" } },
      "getKernel().bus.emit(e); this.events.publish(x); a.b.c;", ["0-20 member_expression", "25-44 member_expression"]],
  ]));
});

const boundQueryCases: Config[] = [
  { rule: { kind: "identifier", pattern: "$NAME", inside: { kind: "program", stopBy: "end",
    has: { pattern: "$NAME", stopBy: { kind: "function_declaration" } } } } },
  { rule: { kind: "identifier", pattern: "$NAME", inside: { kind: "program", stopBy: "end",
    has: { kind: "function_declaration", has: { field: "name", pattern: "$NAME" }, stopBy: { kind: "function_declaration" } } } } },
  { rule: { kind: "identifier", pattern: "$NAME", inside: { kind: "program", stopBy: "end",
    has: { pattern: "$NAME", stopBy: { kind: "function_declaration" } } } }, constraints: { NAME: { kind: "identifier" } } },
  ...(["precedes", "follows"] as const).map(relation => ({ rule: { kind: "identifier", pattern: "$NAME",
    [relation]: { stopBy: "end", any: [{ kind: "identifier", pattern: "$NAME" },
      { kind: "parenthesized_expression", has: { pattern: "$NAME", kind: "identifier" } }] } } })),
  { rule: { kind: "identifier", pattern: "$NAME", inside: { kind: "program", stopBy: "end", has: {
    any: [{ pattern: "$NAME", kind: "identifier" }, { kind: "comment" }], stopBy: { kind: "function_declaration" } } } } },
  { utils: { same: { pattern: "$NAME", kind: "identifier" }, wrapped: { any: [{ matches: "same" },
    { kind: "parenthesized_expression", has: { matches: "wrapped" } }] } },
    rule: { kind: "identifier", pattern: "$NAME", inside: { kind: "program", stopBy: "end",
      has: { matches: "wrapped", stopBy: { kind: "function_declaration" } } } } },
  { rule: { pattern: "pick($NAME, $OTHER)", inside: { kind: "program", stopBy: "end", has: {
    kind: "call_expression", all: [{ has: { field: "function", regex: "^pair$" } },
      { has: { field: "arguments", has: { nthChild: 1, pattern: "$NAME" } } },
      { has: { field: "arguments", has: { nthChild: 2, pattern: "$OTHER" } } }], stopBy: { kind: "function_declaration" } } } } },
  { rule: { pattern: "$$NAME", regex: "^(const|let|var)$", inside: { kind: "program", stopBy: "end",
    has: { pattern: "$$NAME", stopBy: { kind: "function_declaration" } } } } },
];
const boundQuerySources = [
  "const alpha = 1; alpha; alpha; const beta = 2; beta;",
  "const alpha = 1; function nested(alpha) { alpha; } alpha; nested;",
  "const alpha = 1; function nested() { beta; } alpha; beta;",
  "f(a, /* a */ (a), a, [a], a + a, a);",
  "pair(shared, left); pick(shared, left); pick(shared, right);",
  "pair(shared, (left)); pick(shared, (left)); pick(shared, left);",
  "// 😀\nconst α = 1; α; const 開始 = 2; 開始;",
  "alpha\nfunction alpha() {}\nalpha;",
];
for (const grammar of ["typescript", "tsx"] as const) for (const [configIndex, config] of boundQueryCases.entries()) {
  for (const [sourceIndex, source] of boundQuerySources.entries()) {
    test(`bound query retains native order and capture positions ${grammar}/${configIndex}/${sourceIndex}`, () => {
      const parsed = parse(grammar === "tsx" ? "source.tsx" : "source.ts", source);
      const native = oracleParse(grammar === "tsx" ? Lang.Tsx : Lang.TypeScript, source);
      withTree(parsed, () => {
        const expected = oracle(config, native, grammar);
        expect(ours(config, parsed, grammar)).toEqual(expected);
        expect(ours(config, parsed, grammar)).toEqual(expected);
      });
    });
  }
}
for (const grammar of ["typescript", "tsx"] as const) test(`bound query retains structural equality for a non-leaf capture ${grammar}`, () => {
  const config: Config = { rule: { pattern: "pick($NAME)", inside: { kind: "program", stopBy: "end", has: {
    kind: "call_expression", all: [{ has: { field: "function", regex: "^pair$" } },
      { has: { field: "arguments", has: { nthChild: 1, pattern: "$NAME" } } }], stopBy: { kind: "function_declaration" } } } } };
  const source = "pair(left + right); pick(left+right); pick(left + wrong);";
  const parsed = parse(grammar === "tsx" ? "source.tsx" : "source.ts", source);
  const native = oracleParse(grammar === "tsx" ? Lang.Tsx : Lang.TypeScript, source);
  withTree(parsed, () => {
    const expected = oracle(config, native, grammar);
    expect(expected).toHaveLength(1);
    expect(ours(config, parsed, grammar)).toEqual(expected);
    expect(ours(config, parsed, grammar)).toEqual(expected);
  });
});
test("bound queries retain an unrelated branch's regex-limit form", () => {
  const config: PatternConfig = { id: "bound-regex", rule: { kind: "identifier", pattern: "$NAME", regex: "^target$",
    inside: { kind: "program", stopBy: "end", has: { all: [{ kind: "identifier" },
      { regex: "^(a+)+b$" }, { pattern: "$NAME" }], stopBy: { kind: "function_declaration" } } } } };
  const parsed = parse("source.ts", "aaaaaaaaaaaa;\ntarget;");
  withTree(parsed, () => {
    let elapsed = 0;
    expect(findAll(parsed, compilePattern(config, "typescript"), () => elapsed += 1000)).toEqual({ cause: "regex-limit", line: 1 });
  });
});

// ARCHITECTURE §8: every pattern of the catalog, pilot packs (0.3.0/MVP) and Solana
// against every fixture file, in its grammar: same accept/reject, same nodes, same metavariables.
test("differential against @ast-grep/napi over catalog, TypeScript, React and Solana", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [slash(join(dir, n))]));
  const sources = [...walk("catalog/checks"), ...walk("packs/typescript/checks"), ...walk("packs/react/checks"), ...walk("packs/nextjs/checks"), ...walk("packs/solana/checks")];
  const configs = sources.filter((f) => /\/(check|rule)\.json$/.test(f)).flatMap((f) => {
    const impl = JSON.parse(readFileSync(f, "utf8")).impl;
    const list: PatternConfig[] = impl.kind === "pattern" ? impl.patterns.typescript ?? [] : impl.count?.pattern ? [impl.count.pattern] : [];
    return list.map((c) => ({ where: `${f}#${c.id}`, config: { rule: c.rule, utils: c.utils, constraints: c.constraints } }));
  });
  const files = sources.filter((f) => f.includes("/fixtures/") && ["typescript", "tsx"].includes(grammarOf(f.replace(/\.fixture$/, "")) ?? ""));
  expect(configs.length).toBeGreaterThan(40);
  expect(files.length).toBeGreaterThan(350);
  const differences: string[] = [];
  let compared = 0;
  const accepted = (["typescript", "tsx"] as const).map((g) => configs.filter(({ where, config }) => {
    const mine = attempt(() => compilePattern({ id: "t", ...config }, g));
    const theirs = attempt(() => oracleParse(g === "tsx" ? Lang.Tsx : Lang.TypeScript, "").root().findAll(config as never));
    if (mine !== theirs) differences.push(`${where} ${g}: accepted by ${mine ? "ours" : "ast-grep"} only`);
    return mine && theirs;
  }));
  for (const file of files) {
    const rel = file.replace(/\.fixture$/, "");
    const g = grammarOf(rel)!;
    const source = readFileSync(file, "utf8");
    const [mineRoot, theirRoot] = [parse(rel, source), oracleParse(g === "tsx" ? Lang.Tsx : Lang.TypeScript, source)];
    for (const { where, config } of accepted[g === "tsx" ? 1 : 0]!) {
      const [a, b] = [ours(config, mineRoot, g), oracle(config, theirRoot, g)];
      compared++;
      if (JSON.stringify(a) !== JSON.stringify(b)) differences.push(`${where} on ${file}:\n  ours ${a.join("; ")}\n  ast-grep ${b.join("; ")}`);
    }
  }
  expect(differences).toEqual([]);
  expect(compared).toBeGreaterThan(15_000);
}, 120_000);

test("dcouplr source patterns agree with ast-grep on their fixtures", () => {
  const root = "packs/dcouplr/checks";
  let compared = 0, fixtures = 0;
  for (const file of new Bun.Glob("**/check.json").scanSync({ cwd: root, onlyFiles: true })) {
    const check = JSON.parse(readFileSync(join(root, file), "utf8")) as Check;
    if (check.impl.kind !== "pattern") continue;
    const folder = join(root, file, "../fixtures");
    for (const fixture of new Bun.Glob("**/files/**/*.ts.fixture").scanSync({ cwd: folder, onlyFiles: true })) {
      const source = readFileSync(join(folder, fixture), "utf8");
      fixtures++;
      for (const config of check.impl.patterns.typescript ?? []) {
        expect(ours(config, source, "typescript"), `${check.id}/${slash(fixture)}#${config.id}`)
          .toEqual(oracle(config, source, "typescript"));
        compared++;
      }
    }
  }
  expect(fixtures).toBeGreaterThanOrEqual(140);
  expect(compared).toBeGreaterThanOrEqual(fixtures);
}, 30_000);

function attempt(f: () => unknown): boolean {
  try {
    f();
    return true;
  } catch {
    return false;
  }
}

function withTree(parsed: Parsed, use: () => void, restore?: () => void): void {
  try { use(); } finally { restore?.(); parsed.root.tree.delete(); }
}

test("semantic kind aliases (@fn, @call, @import, @loop, @branch, @class, @return, @throw) match across all grammars", () => {
  const samples: [Grammar, string, string, string, string[]][] = [
    ["typescript", "a.ts", "@fn", "function f() { return 1; } const g = () => 2;", ["function f() { return 1; }", "() => 2"]],
    ["python", "a.py", "@fn", "def f(x):\n  return x\n", ["def f(x):\n  return x"]],
    ["go", "a.go", "@fn", "package p\nfunc f() int { return 1 }\n", ["func f() int { return 1 }"]],
    ["rust", "a.rs", "@fn", "fn f() -> i32 { 1 }\n", ["fn f() -> i32 { 1 }"]],
    ["typescript", "a.ts", "@call", "f(1); new Box();", ["f(1)", "new Box()"]],
    ["python", "a.py", "@call", "f(1)\n", ["f(1)"]],
    ["go", "a.go", "@call", "package p\nfunc g() { f(1) }\n", ["f(1)"]],
    ["rust", "a.rs", "@call", "fn g() { f(1); println!(\"hi\"); }\n", ["f(1)", "println!(\"hi\")"]],
    ["typescript", "a.ts", "@loop", "for (const x of xs) { while (x) break; }", ["for (const x of xs) { while (x) break; }", "while (x) break;"]],
    ["python", "a.py", "@branch", "if x:\n  pass\n", ["if x:\n  pass"]],
    ["rust", "a.rs", "@return", "fn f() -> i32 { return 1; }\n", ["return 1"]],
  ];
  for (const [grammar, rel, kind, src, expected] of samples) {
    const parsed = parse(rel, src);
    withTree(parsed, () => {
      const compiled = compilePattern({ id: "sem", rule: { kind } }, grammar);
      expect(compiled.kinds?.length).toBeGreaterThan(0);
      const hits = findAll(parsed, compiled, clock);
      if (!Array.isArray(hits)) throw new Error(hits.cause);
      expect(hits.map((h) => h.node.text)).toEqual(expected);
    });
  }
});

test("declarative lexical scope predicates distinguish unshadowed, parameter, local, and module bindings", () => {
  const tsCode = [
    "import { apiFetch } from './api';",
    "export function a(fetch: typeof globalThis.fetch) { return fetch('/param'); }",
    "export function b() { const fetch = apiFetch; return fetch('/local'); }",
    "export function c() { return fetch('/ambient'); }",
    "export function d() { return apiFetch('/module'); }",
  ].join("\n");
  const parsed = parse("a.ts", tsCode);
  withTree(parsed, () => {
    const find = (pattern: string, scope: "local" | "module" | "parameter" | "unshadowed") => {
      const hits = findAll(parsed, compilePattern({ id: "s", rule: { pattern, scope } }, "typescript"), clock);
      if (!Array.isArray(hits)) throw new Error(hits.cause);
      return hits.map((h) => h.node.text);
    };
    expect(find("fetch($X)", "unshadowed")).toEqual(["fetch('/ambient')"]);
    expect(find("fetch($X)", "parameter")).toEqual(["fetch('/param')"]);
    expect(find("fetch($X)", "local")).toEqual(["fetch('/local')"]);
    expect(find("apiFetch($X)", "module")).toEqual(["apiFetch('/module')"]);
  });
});

