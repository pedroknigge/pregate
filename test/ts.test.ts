import { beforeAll, expect, test } from "bun:test";
import { grammarWasm, setUpGrammars } from "../src/assets.ts";
import { astHash, classes, errorIn, functions, grammarOf, imports, parse, setGrammars, symbolBodies, symbolOf } from "../src/ts.ts";

function withCleanup<T>(work: () => T, cleanup: () => void): T {
  try { return work(); } finally { cleanup(); }
}

async function withCleanupAsync<T>(work: () => Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  try { return await work(); } finally { await cleanup(); }
}

function checkedText(p: ReturnType<typeof parse>): string {
  try { expect(errorIn(p, null)).toBeNull(); return p.root.toString(); }
  finally { p.root.tree.delete(); }
}

beforeAll(setUpGrammars);

test("grammarOf: TS/JS, Python and Go select their grammar, case-insensitive", () => {
  const table: [string, string | null][] = [
    ["src/a.ts", "typescript"], ["a.mts", "typescript"], ["a.cts", "typescript"], ["a.d.ts", "typescript"],
    ["src/A.TS", "typescript"], ["dir/.ts", "typescript"], ["a.tsx", "tsx"], ["a.js", "tsx"], ["a.mjs", "tsx"],
    ["a.cjs", "tsx"], ["a.jsx", "tsx"], ["a.py", "python"], ["A.PY", "python"], ["a.go", "go"], ["A.GO", "go"],
    ["Makefile", null], ["dir.ts/README", null],
    ["a.constructor", null],
  ];
  for (const [rel, grammar] of table) expect(`${rel} ${grammarOf(rel)}`).toBe(`${rel} ${grammar}`);
});

test("parse: each extension gets the grammar that accepts its syntax", () => {
  const table: [string, string, boolean][] = [
    ["a.ts", "const x = <T>y;", true],                       // type assertion: TS only
    ["a.tsx", "const x = <T>y;", false],
    ["a.tsx", "const id = <T,>(x: T) => x;", true],
    ["a.jsx", "const el = <div className=\"a\">{x}</div>;", true],
    ["a.js", "export default () => <App />;", true],
    ["a.ts", "const el = <div>{x}</div>;", false],
  ];
  for (const [rel, text, clean] of table) expect(`${rel} ${text} ${errorIn(parse(rel, text), null) === null}`).toBe(`${rel} ${text} ${clean}`);
});

// Every row is valid TypeScript (tsc 7.0.2 reports no syntax error) that the stock 0.23.2 grammar
// parsed as ERROR on the pilot. See grammar.patch.
test("parse: valid TypeScript fixed by grammar.patch parses clean", () => {
  const table: [string, string][] = [
    ["a.ts", "const rows = await sql<Row[]>`SELECT 1`;"],
    ["a.ts", "const rows = await sql<{ id: string }[]>`SELECT ${id}`;"],
    ["a.tsx", "const rows = await sql<Row[]>`SELECT 1`;"],
    ["a.ts", "const actual = await importOriginal<typeof import(\"react\")>();"],
    ["a.ts", "let s: import(\"x\").T[] = [];"],
    ["a.tsx", "const a = <p>Close & lock, H&S, FF&E</p>;"],
    ["a.tsx", "const a = <p title=\"Vendor T&M\" label='H&S'>x</p>;"],
    ["a.ts", "interface C {\n  ar?: A\n  in?: B\n}"],
    ["a.ts", "g(a < -1, b);"],
    ["a.ts", "for (let i = 0; i < unique.length; i++) {}"],
  ];
  for (const [rel, text] of table) expect(`${rel} ${text} ${errorIn(parse(rel, text), null)}`).toBe(`${rel} ${text} null`);
});

test("parse: the patched constructs get the tree their plain forms get; what tsc rejects still errors", () => {
  const tree = (rel: string, text: string): string => parse(rel, text).root.toString();
  expect(tree("a.ts", "sql<Row[]>`SELECT ${id}`;")).toBe(
    "(program (expression_statement (call_expression function: (identifier) type_arguments: (type_arguments (array_type (type_identifier))) arguments: (template_string (string_fragment) (template_substitution (identifier))))))",
  );
  expect(tree("a.ts", "f<typeof import(\"x\")>();")).toBe(
    "(program (expression_statement (call_expression function: (identifier) type_arguments: (type_arguments (type_query (call_expression function: (import) arguments: (arguments (string (string_fragment)))))) arguments: (arguments))))",
  );
  expect(tree("a.tsx", "<p title=\"T&M\">a &amp; b & c</p>;")).toBe(
    "(program (expression_statement (jsx_element open_tag: (jsx_opening_element name: (identifier) attribute: (jsx_attribute (property_identifier) (string (string_fragment)))) (jsx_text) (html_character_reference) (jsx_text) close_tag: (jsx_closing_element name: (identifier)))))",
  );
  expect(tree("a.ts", "type N = -1; declare const s: unique symbol;")).toBe(
    "(program (type_alias_declaration name: (type_identifier) value: (literal_type (unary_expression argument: (number)))) (ambient_declaration (lexical_declaration (variable_declarator name: (identifier) type: (type_annotation (predefined_type))))))",
  );
  expect(errorIn(parse("a.ts", "class K {\n  a = 1\n  in?: B\n}"), null)).not.toBeNull();
});

test("parse: rejects a file without grammar", () => {
  expect(() => parse("a.swift", "func main() {} ")).toThrow("no grammar");
});

for (const ext of ["ts", "tsx"] as const) {
  test(`parse: contextual using parameters and abstract properties retain their identifiers in ${ext}`, () => {
    const valid = [
      "interface Value { readonly name: string }\ntype Factory = Readonly<{\n  cloneWithUsing(\n    node: Value,\n    using: Value,\n  ): Value\n}>\nconst factory: Factory = { cloneWithUsing(node, using) { return using } };",
      "interface Value { readonly name: string }\ninterface Factory { cloneWithUsing(node: Value, using: Value): Value }",
      "export class Factory { cloneWithUsing(node: number, using: number): number { return using; } }",
      "const select = (using: number): number => using;",
      "interface State {\n value?: unknown\n abstract?: boolean\n fields?: { abstract?: boolean }\n}",
      "type State = { readonly abstract?: boolean };",
      "abstract class Base { abstract value: number; abstract read(using: number): number; }",
      "const state = { abstract: true, using: 1 }; state.abstract; state.using;",
    ];
    for (const text of valid) {
      const parsed = parse(`contextual.${ext}`, text);
      expect(errorIn(parsed, null)).toBeNull();
      expect(parsed.root.text).toBe(text);
      const contextual = parsed.root.descendantsOfType(["identifier", "property_identifier"]).filter(node => ["using", "abstract"].includes(node.text));
      expect(contextual.length).toBeGreaterThan(0);
      for (const node of contextual) expect(text.slice(node.startIndex, node.endIndex)).toBe(node.text);
      parsed.root.tree.delete();
    }
    for (const text of ["type Factory = { cloneWithUsing(node: number, using: ): number }", "interface State { abstract?: }",
      "type Factory = {\n cloneWithUsing(\n node: number,\n using: ,\n ): number\n}", "abstract class Base { abstract value: ; }"]) {
      const parsed = parse(`contextual.${ext}`, text);
      expect(errorIn(parsed, null)).not.toBeNull();
      parsed.root.tree.delete();
    }
  });
}

const genericMembers = [
  "type A = {\n <T>(): T\n <U>(value: U): U\n}",
  "type A = {\n (): number\n <U>(value: U): U\n}",
  "type A = {\n value: string\n <U>(value: U): U\n}",
  "interface A {\n <T>(): T\n <U>(value: U): U\n}",
  "type A = {\n <T>(value: T): T\n <U extends Array<[number, string]> = []>(value: U): U\n}",
  "type A = {\n (listener: (value: number) => void): () => void\n <U>(selector: () => U): () => void\n}",
  "type A = {\n <T>(value: T): [T]\n // second signature\n <U>(value: U): U\n}",
];
for (const ext of ["ts", "tsx"] as const) {
  test(`parse: variance annotations retain parameter names and source spans in ${ext}`, () => {
    const valid = [
      "interface Producer<out T> { get(): T; }",
      "interface Consumer<in T> { accept(value: T): void; }",
      "interface Cell<in out T> { get(): T; set(value: T): void; }",
      "type Producer<out T extends string = string> = () => T;",
      "type Consumer<in T> = (value: T) => void;",
      "class Box<out T> { constructor(readonly value: T) {} }",
      "declare function select<const T>(value: T): T;",
    ];
    for (const text of valid) {
      const parsed = parse(`variance.${ext}`, text);
      expect(errorIn(parsed, null)).toBeNull();
      expect(parsed.root.text).toBe(text);
      const parameter = parsed.root.descendantsOfType("type_parameter")[0]!;
      expect(parameter.childForFieldName("name")?.text).toBe("T");
      expect(text.slice(parameter.startIndex, parameter.endIndex)).toBe(parameter.text);
      parsed.root.tree.delete();
    }
    for (const text of ["interface Bad<out T extends> {}", "interface Bad<out T,,> {}", "type Bad<in T = > = (value: T) => void;"]) {
      const parsed = parse(`variance.${ext}`, text);
      expect(errorIn(parsed, null)).not.toBeNull();
      parsed.root.tree.delete();
    }
    const text = 'interface Producer<out T> { get(): T; }\nimport { x } from "./infra";';
    const parsed = parse(`variance.${ext}`, text);
    expect(imports(parsed)).toEqual([{ spec: "./infra", line: 2, kind: "static", literal: true }]);
    parsed.root.tree.delete();
  });
}
for (const ext of ["ts", "tsx"] as const) {
  test(`parse: nested generic function call arguments keep call identity and shift expressions in ${ext}`, () => {
    const types = ["<T>(value: T) => T", "<T extends string = string>(value: T) => T",
      "<T extends (value: number) => number>(value: T) => T", "<T>(value: { label: '(>)', item: T }) => T",
      "<T /* > */>(value: T /* ) */) => T"];
    for (const type of types) for (const whitespace of ["", " ", "\n"]) {
      const text = `declare function f<T>(): void; f${whitespace}<${type}>();`, parsed = parse(`case.${ext}`, text);
      expect(errorIn(parsed, null)).toBeNull();
      expect(parsed.root.text).toBe(text);
      expect(parsed.root.descendantsOfType("call_expression")).toHaveLength(1);
      expect(parsed.root.descendantsOfType("function_type").length).toBeGreaterThan(0);
      expect(() => new Bun.Transpiler({ loader: ext }).transformSync(text)).not.toThrow();
      parsed.root.tree.delete();
    }
    for (const text of ["const x = left << T > (right);", "const x = left << (value => value);", "const x = (left << amount) + (right >> amount);"]) {
      const parsed = parse(`case.${ext}`, text);
      expect(errorIn(parsed, null)).toBeNull();
      expect(parsed.root.descendantsOfType("call_expression")).toHaveLength(0);
      expect(parsed.root.descendantsOfType("binary_expression").some((node) => node.text.includes("<<"))).toBe(true);
      expect(() => new Bun.Transpiler({ loader: ext }).transformSync(text)).not.toThrow();
      parsed.root.tree.delete();
    }
    for (const text of ["f<<T>(value: ) => T>();", "f<<T>(value: T) => T();"]) {
      const parsed = parse(`case.${ext}`, text);
      expect(errorIn(parsed, null)).not.toBeNull();
      // tsc rejects these syntax errors; Bun's transpiler erases some invalid type forms.
      parsed.root.tree.delete();
    }
  });
}
for (const ext of ["ts", "tsx"]) {
  test(`parse: type-only star exports preserve import facts and reject missing sources in ${ext}`, () => {
    for (const input of ['export type * from "./types";', 'export type * as Types from "./types";']) {
      const parsed = parse(`case.${ext}`, input);
      expect(errorIn(parsed, null)).toBeNull();
      expect(imports(parsed)).toEqual([{ spec: "./types", line: 1, kind: "reexport", literal: true }]);
      expect(parsed.root.text).toBe(input);
      expect(parsed.root.descendantsOfType("export_statement")).toHaveLength(1);
      expect(() => new Bun.Transpiler({ loader: ext as "ts" | "tsx" }).transformSync(input)).not.toThrow();
      parsed.root.tree.delete();
    }
    for (const input of ["export type *;", "export type * as Types;", 'export type * from ;']) {
      expect(errorIn(parse(`case.${ext}`, input), null)).not.toBeNull();
      expect(() => new Bun.Transpiler({ loader: ext as "ts" | "tsx" }).transformSync(input)).toThrow();
    }
  });
}
for (const ext of ["ts", "tsx"]) {
  for (const [i, text] of genericMembers.entries()) {
    test(`parse: newline before generic type member ${i + 1} in ${ext}`, () => {
      for (const newline of ["\n", "\r\n"]) {
        const input = text.replaceAll("\n", newline), parsed = parse(`case.${ext}`, input);
        expect(errorIn(parsed, null)).toBeNull();
        expect(parsed.text).toBe(input);
        expect(parsed.root.text).toBe(input);
        expect(parsed.root.descendantsOfType("call_signature")).toHaveLength(i === 2 ? 1 : 2);
        expect(() => new Bun.Transpiler({ loader: ext as "ts" | "tsx" }).transformSync(input)).not.toThrow();
        parsed.root.tree.delete();
      }
    });
  }
  test(`parse: semicolon insertion keeps expression continuations and rejects broken type members in ${ext}`, () => {
    const valid = ["const value = 1\n< 2;", "declare function f<T>(): T; const value = f\n<number>();",
      "type A = { value: Array<string> };", "type A = { <T>(): T; <U>(value: U): U; };"];
    const invalid = ["type A = Array\n<string>", "type A = { value: Array\n<string> }",
      "type A = {\n <T>(): T\n <U>(value: ): U\n}", "type A = {\n <T>(): T\n <U(value: U): U\n}"];
    for (const input of valid) {
      expect(errorIn(parse(`case.${ext}`, input), null)).toBeNull();
      expect(() => new Bun.Transpiler({ loader: ext as "ts" | "tsx" }).transformSync(input)).not.toThrow();
    }
    for (const input of invalid) {
      expect(errorIn(parse(`case.${ext}`, input), null)).not.toBeNull();
      expect(() => new Bun.Transpiler({ loader: ext as "ts" | "tsx" }).transformSync(input)).toThrow();
    }
  });
}

const jsExtensions = ["ts", "mts", "cts", "tsx", "js", "mjs", "cjs", "jsx"];
const nulTokens = [
  'const x = "a\0b";', "const x = 'a\0b';", 'const x = `a\0${value}b\0`;',
  'const x = /a\0[b\0]c/;', '// a\0b\nconst x = 1;', '/* a\0b */ const x = 1;',
  '/* *\0/ */ const x = 1;', 'const x = "\\\0";', 'const x = /\\\0/;',
  '// a\0b\nconst x = 1\n/* a\0b */\nconst y = 2',
];
for (const ext of jsExtensions) {
  for (const [i, text] of nulTokens.entries()) test(`parse: raw NUL token ${i + 1} in ${ext}`, () => {
    const parsed = parse(`a.${ext}`, text);
    expect(errorIn(parsed, null)).toBeNull();
    expect(parsed.text).toBe(text);
    expect(parsed.root.text).toBe(text);
    expect(parsed.root.endIndex).toBe(text.length);
    expect(parsed.root.toString()).toBe(parse(`a.${ext}`, text.replaceAll("\0", "z")).root.toString());
    expect(() => new Bun.Transpiler({ loader: ext === "ts" || ext === "mts" || ext === "cts" ? "ts" : "tsx" }).transformSync(text)).not.toThrow();
  });
  const invalid = [
    'const x = \0;', '\0const x = 1;', 'const x = 1;\0const y = 2;', 'const a\0b = 1;',
    'const x = "a\0b;', "const x = 'a\0b;", 'const x = `a\0b;', 'const x = /a\0b;',
    '/* a\0b', '// a\0b\nconst x = ;', 'const x = "a\0\nb";', 'const x = /a\0b\n/;',
    'const x = "a\0b";\nconst y = ;', '/* a\0b */\nconst y = ;',
  ];
  for (const [i, text] of invalid.entries()) test(`parse: raw NUL does not hide invalid syntax ${i + 1} in ${ext}`, () => {
    expect(errorIn(parse(`a.${ext}`, text), null)).not.toBeNull();
    expect(() => new Bun.Transpiler({ loader: ext === "ts" || ext === "mts" || ext === "cts" ? "ts" : "tsx" }).transformSync(text)).toThrow();
  });
  test(`parse: raw NUL preserves downstream facts and UTF-16 spans in ${ext}`, () => {
    const prefix = `const message = "🚀${"x".repeat(6000)}\0end";\n/* a\0b */\n`;
    const suffix = 'import { run } from "./blocked";\nfunction later() { return run(); }';
    const parsed = parse(`a.${ext}`, prefix + suffix);
    expect(errorIn(parsed, null)).toBeNull();
    const node = parsed.root.descendantsOfType("import_statement")[0]!;
    expect(node.startIndex).toBe(prefix.length);
    expect(node.startPosition).toEqual({ row: 2, column: 0 });
    expect(node.text).toBe('import { run } from "./blocked";');
    expect(imports(parsed)).toEqual([{ spec: "./blocked", line: 3, kind: "static", literal: true }]);
    expect(functions(parsed).map(({ symbol }) => symbol)).toEqual(["later"]);
    expect(astHash(parsed)).not.toBe(astHash(parse(`a.${ext}`, prefix.replace("\0end", "zend") + suffix)));
    expect(astHash(parsed)).toBe(astHash(parse(`a.${ext}`, prefix.replace("a\0b", "azb") + suffix)));
    expect(errorIn(parse(`a.${ext}`, `${prefix}const invalid = ;`), [prefix.length, prefix.length + 17])).toBe(3);
  });
}
for (const ext of ["tsx", "jsx", "js"]) {
  test(`parse: raw NUL in JSX text and attribute strings in ${ext}`, () => {
    const text = 'const element = <p title="a\0b" label=\'c\0d\'>x\0y &amp; z\0</p>;';
    const parsed = parse(`a.${ext}`, text);
    expect(errorIn(parsed, null)).toBeNull();
    expect(parsed.root.text).toBe(text);
    expect(() => new Bun.Transpiler({ loader: "tsx" }).transformSync(text)).not.toThrow();
    expect(errorIn(parse(`a.${ext}`, text + '\nconst bad = ;'), null)).toBe(2);
    expect(errorIn(parse(`a.${ext}`, 'const element = <p title="a\0b'), null)).not.toBeNull();
  });
}

test("errorIn: only ERROR or MISSING nodes that intersect the window; line clamped to the window", () => {
  const unexpected = "const a = 1;\nconst b = ;\nconst c = 3;\n";        // ERROR [21,22) on line 2
  const unclosed = "const a = 1;\nconst b = [1, 2\nconst c = 3;\n";     // ERROR [27,34) lines 2-3, MISSING "]" at 40
  const table: [string, [number, number] | null, number | null][] = [
    [unexpected, null, 2],
    [unexpected, [0, 12], null],
    [unexpected, [21, 21], 2],          // pure deletion at the error
    [unexpected, [22, 24], 2],          // touches the end of the error
    [unexpected, [23, 24], null],
    [unexpected, [25, 37], null],
    [unclosed, [29, 34], 3],            // inside an error that starts on line 2
    [unclosed, [14, 20], null],
    [unclosed, [40, 40], 3],            // zero-width MISSING
    [unclosed, null, 2],
    ["function f() {\n  if (x {\n    g()\n  }\n}\n", null, 2],
    ["const fine = 1;\n", null, null],
  ];
  for (const [text, window, line] of table) {
    expect(`${JSON.stringify(window)} ${errorIn(parse("a.ts", text), window)}`).toBe(`${JSON.stringify(window)} ${line}`);
  }
});

test("functions: symbol, line, lines = max(code lines, statements), params with inline members", () => {
  const text = [
    "export function total(items: Item[], { tax, discount }: Opts, ...rest: [a: string, b: number]): number {",
    "  // only a comment",
    "",
    "  let sum = 0; for (const i of items) sum += i.price; return sum;",
    "}",
    "const pick = (opts: { a: string; b: number; c: boolean; d: string }) => opts.a;",
    "class Invoice {",
    "  constructor(private readonly id: string) {}",
    "  calculate(this: Invoice) {",
    "    return [1, 2].map((n) => n * 2);",
    "  }",
    "  handler = async () => {};",
    "}",
    "const api = { get(url: string) { return url; } };",
    "export default function () {}",
    "function packed() { a(); b(); c(); d(); e(); }",
    "function nested(o: { a: { b: string; c: string }; d?: string; m(): void }, [x, y] = [1, 2], { p: { q, r } }: T) {}",
    "const one = x => x;",
    "function wrapped(a: { a: 1; b: 2; c: 3 } | null, b: ({ d: 1; e: 2 }), c: { f: 1 } & { g: 1; h: 1 }, d: Readonly<{ i: 1; j: 1 }>, e: Map<K, V>) {}",
    "function loop() { for (let i = 0; i < n; i++) x(); }",
  ].join("\n");
  expect(functions(parse("a.ts", text))).toEqual([
    { symbol: "total", line: 1, lines: 4, params: 5 },
    { symbol: "pick", line: 6, lines: 1, params: 4 },
    { symbol: "Invoice.constructor", line: 8, lines: 1, params: 1 },
    { symbol: "Invoice.calculate", line: 9, lines: 3, params: 0 },
    { symbol: "Invoice.calculate", line: 10, lines: 1, params: 1 },
    { symbol: "Invoice.handler", line: 12, lines: 1, params: 0 },
    { symbol: "api.get", line: 14, lines: 1, params: 1 },
    { symbol: "<module>", line: 15, lines: 1, params: 0 },
    { symbol: "packed", line: 16, lines: 5, params: 0 },
    { symbol: "nested", line: 17, lines: 1, params: 8 },
    { symbol: "one", line: 18, lines: 1, params: 1 },
    { symbol: "wrapped", line: 19, lines: 1, params: 11 },
    { symbol: "loop", line: 20, lines: 2, params: 0 },
  ]);
});

test("functions: plain JavaScript parameters", () => {
  expect(functions(parse("a.js", "function h(a, b = 2, ...c) {}"))).toEqual([{ symbol: "h", line: 1, lines: 1, params: 3 }]);
});

test("functions: a comment inside a parameter cannot hide inline members", () => {
  expect(functions(parse("a.ts", "function c(o: /* note */ { a: 1; b: 2 }, /* x */ d: D) {}"))[0]?.params).toBe(3);
});

test("grammar setup again (another test file, same process) leaves parse working", async () => {
  await setUpGrammars();
  expect(errorIn(parse("a.tsx", "const a = <b />;"), null)).toBeNull();
});

test("an injected parser runtime preserves actual trees, lazy grammars and cache replacement", async () => {
  const runtime = require("../vendor/web-tree-sitter/web-tree-sitter.js") as typeof import("web-tree-sitter");
  let made = 0;
  const requested: string[] = [];
  const collaborator = {
    Parser: new Proxy(runtime.Parser, { construct: (target, args) => { made++; return Reflect.construct(target, args); } }),
    Language: runtime.Language,
  };
  const load = (g: Parameters<typeof grammarWasm>[0]) => { requested.push(g); return grammarWasm(g); };
  const check = (rel: string, text: string) => checkedText(parse(rel, text));
  await withCleanupAsync(async () => {
    setGrammars(collaborator, load);
    expect(made).toBe(0);
    expect(requested).toEqual([]);
    const first = check("a.ts", "export const answer = 42;");
    expect(check("b.ts", "export const answer = 42;")).toBe(first);
    expect(check("a.go", "package main\nfunc answer() int { return 42 }\n")).toContain("function_declaration");
    expect(made).toBe(2);
    expect(requested).toEqual(["typescript", "go"]);
    setGrammars(collaborator, load);
    expect(check("c.ts", "export const answer = 42;")).toBe(first);
    expect(made).toBe(3);
    expect(requested).toEqual(["typescript", "go", "typescript"]);
  }, async () => { await setUpGrammars(); });
});

test("symbol bodies hash one body per declared symbol, with the name outside and callbacks inside", () => {
  const parsed = parse("x.ts", "function first() { return 1; } function second() { return 2; }\nconst run = () => { [1].map(() => 3); [2].map(() => 4); };\nfunction second() { return 9; }");
  withCleanup(() => {
    const bodies = symbolBodies(parsed);
    const hashOf = (name: string) => astHash({ ...parsed, root: parsed.root.descendantsOfType(["function_declaration", "arrow_function"])
      .find((n) => symbolOf(n) === name)!.childForFieldName("body")! });
    // `second` is declared twice with different bodies, so no single hash can follow it.
    expect(Object.keys(bodies).sort()).toEqual(["first", "run"]);
    expect(bodies).toEqual({ first: hashOf("first"), run: hashOf("run") });
    const renamed = parse("y.ts", "function primary() { return 1; }\nconst go = () => { [1].map(() => 3); [2].map(() => 4); };");
    try {
      expect(symbolBodies(renamed)).toEqual({ primary: bodies.first!, go: bodies.run! });
    } finally { renamed.root.tree.delete(); }
  }, () => { parsed.root.tree.delete(); });
});

test("classes: public methods by distinct name, including static and function-valued fields", () => {
  const text = [
    "export class UseCase {",
    "  constructor(private readonly repo: Repo) {}",
    "  execute(): void {}",
    "  static create(): UseCase { return new UseCase(r); }",
    "  get name() { return 'x'; }",
    "  set name(v: string) {}",
    "  run = () => {};",
    "  value = 1;",
    "  #secret() {}",
    "  private hidden() {}",
    "  protected guarded() {}",
    "  public open(a: string): void;",
    "  public open(a: unknown) {}",
    "}",
    "abstract class Base { abstract go(): void; }",
    "const Anon = class { m() {} };",
  ].join("\n");
  expect(classes(parse("a.ts", text))).toEqual([
    { symbol: "UseCase", line: 1, publicMethods: 5 },
    { symbol: "Base", line: 15, publicMethods: 1 },
    { symbol: "Anon", line: 16, publicMethods: 1 },
  ]);
});

test("imports: every form a dependency can take, with literal specifiers", () => {
  const text = [
    "import a from './a';",
    "import type { B } from './b';",
    "import { type C, d } from './c';",
    "import './side-effect';",
    "import fs = require('node:fs');",
    "export * from './e';",
    "export { f } from './f';",
    "export type { G } from './g';",
    "export const local = require('./local');",
    "const h = await import('./h');",
    "const j = import(name);",
    "const k = require(`./k`);",
    "const l = require(`./${m}`);",
    "type T = typeof import('./t');",
    "const notImport = requireAll('./x');",
    "const n = module.require('./n');",
    "const notModule = loader.require('./y');",
  ].join("\n");
  expect(imports(parse("a.ts", text))).toEqual([
    { spec: "./a", line: 1, kind: "static", literal: true },
    { spec: "./b", line: 2, kind: "type", literal: true },
    { spec: "./c", line: 3, kind: "static", literal: true },
    { spec: "./side-effect", line: 4, kind: "static", literal: true },
    { spec: "node:fs", line: 5, kind: "require", literal: true },
    { spec: "./e", line: 6, kind: "reexport", literal: true },
    { spec: "./f", line: 7, kind: "reexport", literal: true },
    { spec: "./g", line: 8, kind: "reexport", literal: true },
    { spec: "./local", line: 9, kind: "require", literal: true },
    { spec: "./h", line: 10, kind: "dynamic", literal: true },
    { spec: "name", line: 11, kind: "dynamic", literal: false },
    { spec: "./k", line: 12, kind: "require", literal: true },
    { spec: "`./${m}`", line: 13, kind: "require", literal: false },
    { spec: "./t", line: 14, kind: "dynamic", literal: true },
    { spec: "./n", line: 16, kind: "require", literal: true },
  ]);
});

test("imports: ordinary calls avoid function-field reads while spaced and nested imports remain visible", () => {
  const ordinary = parse("a.ts", "const value = Money.zero(currency).add(amount); render(value); finish();");
  const prototype = Object.getPrototypeOf(ordinary.root), original = prototype.childForFieldName;
  let functionReads = 0;
  withCleanup(() => {
    prototype.childForFieldName = function (name: string) {
      if (name === "function" && this.type === "call_expression") functionReads++;
      return original.call(this, name);
    };
    expect(imports(ordinary)).toEqual([]);
  }, () => { prototype.childForFieldName = original; ordinary.root.tree.delete(); });
  expect(functionReads).toBe(0);

  const text = [
    "const a = import /* gap */ ('./a');",
    "const b = require /* gap */ ('./b');",
    "const c = module /* gap */ . /* gap */ require /* gap */ ('./c');",
    "wrap(import /* gap */ ('./d'));",
    "const e = import /* gap */ (name);",
    "const f = require`./f`;",
    "render('import require'); requireAll('./ignored'); loader.require('./ignored');",
  ].join("\n");
  for (const rel of ["a.ts", "a.tsx"]) {
    const parsed = parse(rel, text);
    withCleanup(() => {
      expect(errorIn(parsed, null)).toBeNull();
      expect(imports(parsed)).toEqual([
        { spec: "./a", line: 1, kind: "dynamic", literal: true },
        { spec: "./b", line: 2, kind: "require", literal: true },
        { spec: "./c", line: 3, kind: "require", literal: true },
        { spec: "./d", line: 4, kind: "dynamic", literal: true },
        { spec: "name", line: 5, kind: "dynamic", literal: false },
        { spec: "./f", line: 6, kind: "require", literal: true },
      ]);
    }, () => { parsed.root.tree.delete(); });
  }
});

test("symbolOf: chain of named declarations; anonymous callbacks belong to the enclosing one", () => {
  const p = parse("a.ts", [
    "class A { m() { list.forEach((x) => { use(x); }); } }",
    "namespace NS { export function f() { inner(); } }",
    "const config = { routes: { home: () => go() } };",
    "top();",
  ].join("\n"));
  const calls = p.root.descendantsOfType("call_expression").map((c) => `${c.childForFieldName("function")?.text} ${symbolOf(c)}`);
  expect(calls).toEqual(["list.forEach A.m", "use A.m", "inner NS.f", "go config.routes.home", "top <module>"]);
});

test("astHash: blind to comments and layout, sensitive to any code or literal change", () => {
  const hash = (text: string): string => astHash(parse("a.ts", text));
  const base = hash("const a = 1; // note\nconst b = `x ${a} y`;");
  expect(hash("const a=1;\n\n/* other */ const b = `x ${a} y`;")).toBe(base);
  expect(hash("const a = 1;\nconst b = `x ${a}  y`;")).not.toBe(base);
  expect(hash("const a = 2;\nconst b = `x ${a} y`;")).not.toBe(base);
  expect(hash("let a = 1;\nconst b = `x ${a} y`;")).not.toBe(base);
});

test("astHash frees its cursor: hashes stay stable across garbage collections", async () => {
  const text = "function f(a: number) { return a + 1; }\n".repeat(50);
  const first = astHash(parse("a.ts", text));
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) astHash(parse("a.ts", text));
    Bun.gc(true);
    await Bun.sleep(0);
    expect(astHash(parse("a.ts", text))).toBe(first);
  }
});
