/// <reference path="../vendor/web-tree-sitter/web-tree-sitter.d.ts" />
// The core tree-sitter boundary: parse, syntax errors in a window, and the facts the
// metric and import primitives measure. The shell supplies an initialized parser and grammar loader.
import type { Node, Parser, Tree, TreeCursor } from "web-tree-sitter";
import type { CodeImport, Grammar, ScopeKind } from "./types.ts";
import { commentKinds, grammarOf } from "./languages.ts";
import { RUST_FUNCTIONS, rustFunctions, rustImports, rustNestings, rustSymbol } from "./rust-facts.ts";
import { languageClasses, languageFunctions, languageImports, languageNestings, languageSymbol, OTHER_CLASSES, OTHER_FUNCTIONS } from "./language-facts.ts";
export { grammarOf } from "./languages.ts";

export type { Node };

// The vendored d.ts declares the ambient module "web-tree-sitter". Initialization and runtime
// loading belong to assets.ts; no core module imports the vendored executable.
declare global { interface EmscriptenModule { wasmBinary: Uint8Array } }
type ParserRuntime = Pick<typeof import("web-tree-sitter"), "Parser" | "Language">;
let wts: ParserRuntime | null = null;

export interface Parsed { rel: string; text: string; root: Node }

let grammarBytes: ((g: Grammar) => Uint8Array) | null = null;
const parsers = new Map<Grammar, Parser>();
const treeGrammars = new WeakMap<Tree, Grammar>();

export function setGrammars(runtime: ParserRuntime, load: (g: Grammar) => Uint8Array): void {
  wts = runtime;
  grammarBytes = load;
  parsers.clear();
}

// Each grammar is compiled on first use, so a call pays only for the language of its file.
function parserFor(g: Grammar): Parser {
  const cached = parsers.get(g);
  if (cached) return cached;
  if (!grammarBytes || !wts) throw new Error("ts.setGrammars was not called");
  const parser = new wts.Parser();
  parser.setLanguage(wts.Language.loadSync(new WebAssembly.Module(grammarBytes(g))));
  parsers.set(g, parser);
  return parser;
}

function blankOutside(text: string): string {
  return text.replace(/<!--([\s\S]*?)-->|[^\n]/g, (_, body: string | undefined) =>
    body === undefined ? " " : `/*  ${body.replace(/\*\//g, "  ")} */`);
}

export function sfcScript(rel: string, text: string): string {
  if (!/\.(vue|svelte)$/i.test(rel)) return text;
  let out = "", at = 0;
  for (const m of text.matchAll(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)(?:<\/script>|$)/gi)) {
    const start = m.index! + 8 + m[1]!.length;
    const end = start + m[2]!.length;
    out += blankOutside(text.slice(at, start)) + m[2]!;
    at = end;
  }
  return out + blankOutside(text.slice(at));
}

export function parse(rel: string, text: string): Parsed {
  const g = grammarOf(rel);
  if (!g) throw new Error(`${rel}: no grammar for this extension`);
  const source = sfcScript(rel, text);
  const tree = parserFor(g).parse(source);
  if (!tree) throw new Error(`${rel}: parse returned no tree`);
  treeGrammars.set(tree, g);
  return { rel, text: source, root: tree.rootNode };
}

// descendantsOfType matches anonymous tokens of the same name too ("class", "import").
function descendants(n: Node, kinds: string[]): Node[] {
  return n.descendantsOfType(kinds).filter((d) => d.isNamed);
}

function members(n: Node): Node[] {
  return n.namedChildren.filter((c) => c.type !== "comment");
}

function lineOf(n: Node): number {
  return n.startPosition.row + 1;
}

// window: [start, end) in UTF-16 units of the text, as reconstruct.window computes it; null = no
// base, the whole file is new. Bounds are inclusive so that an error touching a pure deletion or the
// edge of the change counts. Any ERROR or MISSING node that intersects denies, even one that starts
// outside; the line reported is the innermost error first in the text (recovery often wraps the real
// spot in an ERROR that starts many lines above), clamped to the window. 1-based.
export function errorIn(p: Parsed, window: [number, number] | null): number | null {
  const [from, to] = window ?? [0, p.text.length];
  const visit = (n: Node): number | null => {
    if (!n.hasError || n.startIndex > to || n.endIndex < from) return null;
    for (const c of n.children) {
      const line = visit(c);
      if (line !== null) return line;
    }
    if (!n.isError && !n.isMissing) return null;
    return n.startIndex >= from ? lineOf(n) : p.text.slice(0, from).split("\n").length;
  };
  return visit(p.root);
}

const FUNCTION_KINDS = [
  "function_declaration", "generator_function_declaration", "function_expression",
  "generator_function", "arrow_function", "method_definition",
];
const CONTROL_KINDS = ["if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement", "switch_statement", "try_statement"];

// Blocks do not add depth; else-if stays at its branch's depth. A nested function starts anew.
export function nestings(p: Parsed): { symbol: string; line: number; measured: number; own: null }[] {
  if (grammarOf(p.rel) === "rust") return rustNestings(p);
  if (["python", "go"].includes(grammarOf(p.rel)!)) return languageNestings(p);
  return descendants(p.root, CONTROL_KINDS).map((node) => {
    let depth = 1;
    let child = node;
    for (let parent = node.parent; parent !== null && !FUNCTION_KINDS.includes(parent.type); parent = parent.parent) {
      const chain = child.type === "if_statement" || (child.type === "else_clause" && child.namedChildren.some((n) => n.type === "if_statement"));
      if (CONTROL_KINDS.includes(parent.type) && !(chain && parent.type === "if_statement" && parent.childForFieldName("alternative")?.id === child.id)) depth++;
      child = parent;
    }
    return { symbol: symbolOf(node), line: lineOf(node), measured: depth, own: null };
  });
}
// The "statement" supertype of the grammar, without blocks and empty statements.
const STATEMENT_KINDS = [
  "break_statement", "continue_statement", "debugger_statement", "do_statement",
  "export_statement", "expression_statement", "for_in_statement", "for_statement", "if_statement",
  "import_statement", "labeled_statement", "return_statement", "switch_statement",
  "throw_statement", "try_statement", "while_statement", "with_statement",
  "abstract_class_declaration", "ambient_declaration", "class_declaration", "enum_declaration",
  "function_declaration", "function_signature", "generator_function_declaration", "import_alias",
  "interface_declaration", "internal_module", "lexical_declaration", "module",
  "type_alias_declaration", "variable_declaration",
];

// lines = max(non-blank non-comment lines, statements): packing statements onto one line does not
// shrink a function. params counts each member of an inline object or tuple type and of a
// destructured pattern, so `opts: {a; b; c; d}` weighs 4.
export function functions(p: Parsed): { symbol: string; line: number; lines: number; params: number }[] {
  const codeBefore = codeLinePrefix(p);
  if (grammarOf(p.rel) === "rust") return rustFunctions(p, codeBefore);
  if (["python", "go"].includes(grammarOf(p.rel)!)) return languageFunctions(p, codeBefore);
  const forHeaderIds = new Set(descendants(p.root, ["for_statement"]).flatMap((f) => {
    const bodyId = f.childForFieldName("body")?.id;
    return f.namedChildren.filter((c) => c.id !== bodyId).map((c) => c.id);
  }));
  const statementStarts = descendants(p.root, STATEMENT_KINDS)
    .filter((s) => !forHeaderIds.has(s.id))   // `let i = 0` of a for header
    .map((s) => s.startIndex);   // ascending
  return descendants(p.root, FUNCTION_KINDS).map((fn) => {
    const code = (codeBefore[fn.endPosition.row + 1] ?? 0) - (codeBefore[fn.startPosition.row] ?? 0);
    const body = fn.childForFieldName("body");
    const statements = body ? firstAtOrAfter(statementStarts, body.endIndex) - firstAtOrAfter(statementStarts, body.startIndex) : 0;
    return { symbol: symbolOf(fn), line: lineOf(fn), lines: Math.max(code, statements), params: paramCount(fn) };
  });
}

function firstAtOrAfter(sorted: number[], x: number): number {
  let [lo, hi] = [0, sorted.length];
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] ?? x) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// codeBefore[r] = number of rows before row r with code once comments are blanked out.
function codeLinePrefix(p: Parsed): number[] {
  let stripped = "";
  let at = 0;
  for (const c of descendants(p.root, commentKinds(p.rel))) {
    stripped += p.text.slice(at, c.startIndex) + p.text.slice(c.startIndex, c.endIndex).replace(/[^\n]/g, " ");
    at = c.endIndex;
  }
  stripped += p.text.slice(at);
  const prefix = [0];
  let total = 0;
  for (const row of stripped.split("\n")) prefix.push(total += /\S/.test(row) ? 1 : 0);
  return prefix;
}

function paramCount(fn: Node): number {
  if (fn.type === "arrow_function" && fn.childForFieldName("parameter")) return 1;   // `x => …`
  const list = fn.childForFieldName("parameters");
  return list ? members(list).reduce((sum, param) => sum + width(param), 0) : 0;
}

// How many inputs a parameter, pattern or type carries; nested inline objects count by their leaves.
function width(n: Node | null): number {
  if (!n) return 0;
  switch (n.type) {
    case "required_parameter": case "optional_parameter": {
      const pattern = n.childForFieldName("pattern") ?? n.childForFieldName("name");
      return pattern?.type === "this" ? 0 : Math.max(width(pattern), width(n.childForFieldName("type")));
    }
    case "type_annotation": return width(members(n)[0] ?? null);
    case "property_signature": return Math.max(1, width(n.childForFieldName("type")));
    case "pair_pattern": return width(n.childForFieldName("value"));
    case "object_assignment_pattern": case "assignment_pattern": return width(n.childForFieldName("left"));
    case "parenthesized_type": return width(members(n)[0] ?? null);
    case "union_type": return Math.max(1, ...members(n).map(width));   // only one of them arrives
    case "intersection_type": case "object_pattern": case "array_pattern": case "object_type": case "tuple_type":
      return members(n).reduce((sum, m) => sum + width(m), 0);
    case "generic_type": {   // Readonly<{…}>, Partial<{…}>: the widest inline object argument
      const args = n.childForFieldName("type_arguments");
      return Math.max(1, ...(args ? members(args).filter((a) => a.type === "object_type").map(width) : []));
    }
    default: return 1;
  }
}

const CLASS_KINDS = ["class_declaration", "abstract_class_declaration", "class"];
const METHOD_KINDS = new Set(["method_definition", "method_signature", "abstract_method_signature"]);
const FUNCTION_VALUES = new Set(["arrow_function", "function_expression", "generator_function"]);

// Public methods by distinct name: overloads and get/set pairs count once; static methods and public
// fields holding a function count, because both are callable surface.
export function classes(p: Parsed): { symbol: string; line: number; publicMethods: number }[] {
  if (grammarOf(p.rel) === "rust") return [];
  if (["python", "go"].includes(grammarOf(p.rel)!)) return languageClasses(p);
  return descendants(p.root, CLASS_KINDS).map((c) => {
    const names = new Set<string>();
    const body = c.childForFieldName("body");
    for (const m of body ? members(body) : []) {
      const name = m.childForFieldName("name");
      const callable = METHOD_KINDS.has(m.type)
        || (m.type === "public_field_definition" && FUNCTION_VALUES.has(m.childForFieldName("value")?.type ?? ""));
      if (!callable || !name || name.type === "private_property_identifier" || name.text === "constructor") continue;
      if (m.children.some((k) => k.type === "accessibility_modifier" && k.text !== "public")) continue;
      names.add(m.children.some((k) => k.type === "static") ? `static ${name.text}` : name.text);
    }
    return { symbol: symbolOf(c), line: lineOf(c), publicMethods: names.size };
  });
}

type Import = CodeImport;

// One hash per symbol the node itself declares. The name and parameters sit outside the body, so a
// rename does not change it. An anonymous callback inherits its parent's symbol and is not a second body.
export function symbolBodies(p: Parsed): Record<string, string> {
  // Hash a copy. Walking cursors on the live tree drops nodes a later query still holds.
  const tree = p.root.tree.copy();
  try {
    return bodiesOf({ ...p, root: tree.rootNode });
  } finally {
    tree.delete();
  }
}

function bodiesOf(p: Parsed): Record<string, string> {
  const kinds = grammarOf(p.rel) === "rust" ? RUST_FUNCTIONS : ["python", "go"].includes(grammarOf(p.rel)!) ? [...OTHER_FUNCTIONS, ...OTHER_CLASSES] : [...FUNCTION_KINDS, ...CLASS_KINDS];
  const found = new Map<string, string>();
  for (const n of descendants(p.root, kinds)) {
    if (!declaresSymbol(n)) continue;
    const symbol = symbolOf(n);
    const hash = astHash({ ...p, root: n.childForFieldName("body") ?? n });
    const prev = found.get(symbol);
    if (prev === undefined) found.set(symbol, hash);
    else if (prev !== hash) found.set(symbol, "");
  }
  const out: Record<string, string> = {};
  for (const [symbol, hash] of found) if (hash !== "") out[symbol] = hash;
  return out;
}

function declaresSymbol(n: Node): boolean {
  const own = scopeName(n);
  const tail = symbolOf(n).split(".").pop();
  if (own !== null) return own === tail;
  const parent = n.parent;
  if (parent === null) return false;
  const binding = parent.type === "variable_declarator" || parent.type === "pair" || parent.type === "public_field_definition";
  return binding && scopeName(parent) === tail && parent.childForFieldName("value")?.id === n.id;
}

export function imports(p: Parsed): Import[] {
  if (grammarOf(p.rel) === "rust") return rustImports(p);
  if (["python", "go"].includes(grammarOf(p.rel)!)) return languageImports(p);
  const kinds = /\brequire\b|\bimport\s*(?:\(|`|\/\*|\/\/)/.test(p.text)
    ? ["import_statement", "export_statement", "call_expression"]
    : ["import_statement", "export_statement"];
  return descendants(p.root, kinds).flatMap((n) => {
    const found = n.type === "call_expression" ? callImport(n, p.text) : statementImport(n);
    return found === null ? [] : [found];
  });
}

// import(x), require(x) and module.require(x), whose specifier may be any expression.
function callImport(n: Node, sourceText: string): Import | null {
  // Every supported import callee contains one of these literal names. This only
  // rejects impossible candidates; the AST still decides the callee and argument.
  const text = sourceText.slice(n.startIndex, n.endIndex);
  if (!text.includes("import") && !text.includes("require")) return null;
  const fn = n.childForFieldName("function");
  const kind = fn?.type === "import" ? "dynamic" : isRequire(fn) ? "require" : null;
  const args = n.childForFieldName("arguments");
  const arg = args?.type === "arguments" ? members(args)[0] ?? null : args;   // or a tagged template
  return kind ? { ...specOf(arg), line: lineOf(n), kind } : null;
}

// import … from, import x = require(…) and export … from, whose specifier is always a literal.
function statementImport(n: Node): Import | null {
  const clause = n.namedChildren.find((c) => c.type === "import_require_clause");
  const source = (clause ?? n).childForFieldName("source");
  if (!source) return null;   // export without `from`
  const kind = n.type === "export_statement" ? "reexport"
    : clause ? "require"
    : n.children.some((c) => c.type === "type") ? "type" : "static";
  return { spec: source.text.slice(1, -1), line: lineOf(n), kind, literal: true };
}

// require is module-scoped in CommonJS: `require` and `module.require` are its only callable names.
function isRequire(fn: Node | null): boolean {
  if (fn?.type === "identifier") return fn.text === "require";
  return fn?.type === "member_expression" && fn.childForFieldName("object")?.text === "module"
    && fn.childForFieldName("property")?.text === "require";
}

function specOf(arg: Node | null): { spec: string; literal: boolean } {
  const literal = arg?.type === "string"
    || (arg?.type === "template_string" && !arg.namedChildren.some((c) => c.type === "template_substitution"));
  return literal && arg ? { spec: arg.text.slice(1, -1), literal } : { spec: arg?.text ?? "", literal: false };
}

const NAMED_SCOPES = new Set([
  "class_declaration", "abstract_class_declaration", "class", "function_declaration",
  "generator_function_declaration", "function_expression", "generator_function", "method_definition",
  "public_field_definition", "variable_declarator", "pair", "internal_module", "module",
  "interface_declaration", "type_alias_declaration", "enum_declaration",
]);

const treeSymbols = new WeakMap<Tree, Map<number, string>>();

function scopeName(at: Node): string | null {
  if (!NAMED_SCOPES.has(at.type)) return null;
  const name = at.childForFieldName(at.type === "pair" ? "key" : "name");
  return name && (at.type !== "variable_declarator" || name.type === "identifier") ? name.text : null;
}

function symbolChain(n: Node, cache: Map<number, string>): string {
  const hit = cache.get(n.id);
  if (hit !== undefined) return hit;
  const parent = n.parent ? symbolChain(n.parent, cache) : "";
  const own = scopeName(n);
  const chain = own === null ? parent : parent === "" ? own : `${parent}.${own}`;
  cache.set(n.id, chain);
  return chain;
}

// The chain of named declarations that contain n ("Invoice.calculateTotals"); anonymous callbacks
// belong to the nearest named one, and code outside any is "<module>".
export function symbolOf(n: Node): string {
  const grammar = treeGrammars.get(n.tree);
  if (grammar === "rust") return rustSymbol(n);
  if (grammar === "python" || grammar === "go") return languageSymbol(n);
  let cache = treeSymbols.get(n.tree);
  if (!cache) {
    cache = new Map();
    treeSymbols.set(n.tree, cache);
  }
  return symbolChain(n, cache) || "<module>";
}

// Only named declaration scopes can add TypeScript symbols. Ask the parser for
// those nodes instead of crossing the WASM boundary for every token's field.
export function symbols(p: Parsed): string[] {
  const out = new Set(["<module>"]);
  if (!["python", "go", "rust"].includes(grammarOf(p.rel)!)) {
    for (const n of descendants(p.root, [...NAMED_SCOPES])) out.add(symbolOf(n));
    return [...out].sort();
  }
  addFieldSymbols(p.root.walk(), out);
  return [...out].sort();
}

function addFieldSymbols(cursor: TreeCursor, out: Set<string>): void {
  try {
    for (;;) {
      if (cursor.gotoFirstChild()) { addFieldSymbol(cursor, out); continue; }
      while (!cursor.gotoNextSibling()) if (!cursor.gotoParent()) return;
      addFieldSymbol(cursor, out);
    }
  } finally { cursor.delete(); }
}

function addFieldSymbol(cursor: TreeCursor, out: Set<string>): void {
  if (cursor.currentFieldName === "name" || cursor.currentFieldName === "key") out.add(symbolOf(cursor.currentNode));
}

const rootHashes = new Map<string, string>();

// Pre-order over the tree without comments: whitespace is not in the tree and every other character
// of the text lives in a leaf, so the hash changes exactly when the code (not its layout) changes.
export function astHash(p: Parsed): string {
  const g = !p.root?.parent ? grammarOf(p.rel) : null;
  const key = g ? `${g}\0${p.text}` : null;
  if (key && rootHashes.has(key)) return rootHashes.get(key)!;
  const own = p.root ? null : parse(p.rel, p.text);
  const hash = hashedTree(p, own);
  if (key && rootHashes.size < 4096 && key.length <= 262144) rootHashes.set(key, hash);
  return hash;
}

function hashedTree(source: Parsed, own: Parsed | null): string {
  try {
    return treeHash((own ?? source).root.walk(), source.text);
  } finally {
    own?.root.tree.delete();
  }
}

function treeHash(cursor: TreeCursor, text: string): string {
  try {
    let tree = "";
    for (;;) {
      const type = cursor.nodeType;
      if (!["comment", "line_comment", "block_comment"].includes(type)) {
        if (cursor.gotoFirstChild()) {
          tree += `(${type}\0`;
          continue;
        }
        tree += `${type}\0${text.slice(cursor.startIndex, cursor.endIndex)}\0`;
      }
      while (!cursor.gotoNextSibling()) {
        if (!cursor.gotoParent()) return (require("node:crypto") as typeof import("node:crypto")).createHash("sha256").update(tree).digest("hex");
        tree += ")";
      }
    }
  } finally {
    // web-tree-sitter 0.27.0's cursor finalizer frees whatever cursor sits in its transfer buffer,
    // not this one, and corrupts the WASM heap; only an explicit delete frees the right memory.
    cursor.delete();
  }
}

const ALL_FUNCTIONS = [...FUNCTION_KINDS, ...OTHER_FUNCTIONS, ...RUST_FUNCTIONS];
const ALL_CONTROLS = [...CONTROL_KINDS, "with_statement", "match_statement", "select_statement",
  "expression_switch_statement", "type_switch_statement", "if_expression", "for_expression", "while_expression", "loop_expression", "match_expression"];
const SCOPE_BLOCKS = new Set(["program", "module", "source_file", "statement_block", "block", "for_statement", "for_in_statement", "for_expression", "catch_clause", "except_clause", ...ALL_FUNCTIONS]);

function rootIdentifier(n: Node): Node | null {
  let cur: Node | null = n;
  while (cur && ["call_expression", "call", "member_expression", "attribute", "selector_expression", "field_expression", "parenthesized_expression", "await_expression"].includes(cur.type)) {
    cur = cur.childForFieldName("function") ?? cur.childForFieldName("object") ?? cur.childForFieldName("operand") ?? cur.childForFieldName("value") ?? cur.namedChildren[0] ?? null;
  }
  return cur && ["identifier", "shorthand_property_identifier", "type_identifier"].includes(cur.type) ? cur : null;
}

function bindingNames(n: Node | null): string[] {
  if (!n || ["type_annotation", "type", "arguments", "call_expression", "call"].includes(n.type)) return [];
  if (["identifier", "shorthand_property_identifier_pattern", "shorthand_property_identifier"].includes(n.type)) return [n.text];
  if (["variable_declarator", "var_spec", "const_spec", "let_declaration", "for_in_statement", "for_expression", "assignment", "assignment_pattern", "object_assignment_pattern", "short_var_declaration", "parameter_declaration", "required_parameter", "optional_parameter", "typed_parameter", "default_parameter", "typed_default_parameter"].includes(n.type)) {
    const slot = n.childForFieldName("name") ?? n.childForFieldName("pattern") ?? n.childForFieldName("left");
    return slot ? bindingNames(slot) : n.childrenForFieldName("name").flatMap(bindingNames);
  }
  if (["function_declaration", "generator_function_declaration", "function_definition", "function_item", "class_declaration", "class_definition", "struct_item", "enum_item", "const_item", "static_item"].includes(n.type)) {
    const slot = n.childForFieldName("name");
    return slot ? [slot.text] : [];
  }
  if (["import_statement", "import_from_statement", "import_declaration", "use_declaration"].includes(n.type)) {
    return n.descendantsOfType(["identifier"]).map((id) => id.text);
  }
  return n.namedChildren.flatMap(bindingNames);
}

function scopeDeclares(scope: Node, name: string): boolean {
  if (ALL_FUNCTIONS.includes(scope.type)) {
    const p = scope.childForFieldName("parameter") ?? scope.childForFieldName("parameters");
    return bindingNames(p).includes(name);
  }
  if (["for_statement", "for_in_statement", "for_expression", "catch_clause", "except_clause"].includes(scope.type)) {
    const head = scope.childForFieldName("initializer") ?? scope.childForFieldName("left") ?? scope.childForFieldName("pattern") ?? scope.childForFieldName("parameter") ?? scope.childForFieldName("name");
    if (bindingNames(head).includes(name)) return true;
  }
  for (const child of members(scope)) {
    const stmt = child.type === "export_statement" ? (child.childForFieldName("declaration") ?? members(child)[0] ?? null)
      : child.type === "expression_statement" && child.namedChildren[0]?.type === "assignment" ? child.namedChildren[0]! : child;
    if (stmt && !ALL_CONTROLS.includes(stmt.type) && (!ALL_FUNCTIONS.includes(stmt.type) || bindingNames(stmt).includes(name))) {
      if (["lexical_declaration", "variable_declaration", "var_declaration", "const_declaration", "short_var_declaration", "let_declaration", "assignment", "import_statement", "import_from_statement", "import_declaration", "use_declaration", "function_declaration", "generator_function_declaration", "function_definition", "function_item", "class_declaration", "class_definition", "struct_item", "enum_item", "const_item", "static_item"].includes(stmt.type) && bindingNames(stmt).includes(name)) return true;
    }
  }
  return false;
}

export function identifierScopeOf(n: Node): ScopeKind {
  const id = rootIdentifier(n);
  if (!id) return "unshadowed";
  const name = id.text;
  for (let up: Node | null = id.parent; up; up = up.parent) {
    if (!SCOPE_BLOCKS.has(up.type) || !scopeDeclares(up, name)) continue;
    if (ALL_FUNCTIONS.includes(up.type)) return "parameter";
    return up.parent === null ? "module" : "local";
  }
  return "unshadowed";
}

export function suggestFunctionSplit(p: Parsed, fnLine: number, max: number): string | null {
  const g = grammarOf(p.rel);
  const fnKinds = g === "rust" ? RUST_FUNCTIONS : g === "python" || g === "go" ? OTHER_FUNCTIONS : FUNCTION_KINDS;
  const fn = descendants(p.root, fnKinds).find((n) => lineOf(n) === fnLine);
  const body = fn?.childForFieldName("body");
  const stmts = body ? members(body).filter((c) => !fnKinds.includes(c.type)) : [];
  if (!fn || stmts.length < 3) return null;
  const total = fn.endPosition.row - fn.startPosition.row + 1;
  const minExtract = Math.max(3, total - max);
  let best: { start: number; end: number; cost: number } | null = null;
  for (let i = 0; i < stmts.length; i++) {
    for (let j = i + 1; j < stmts.length; j++) {
      if (i === 0 && j === stmts.length - 1) continue;
      const start = lineOf(stmts[i]!), end = stmts[j]!.endPosition.row + 1, span = end - start + 1;
      if (span < 3 || span >= total - 1) continue;
      const penalty = Math.abs(span - Math.max(minExtract, Math.floor(total / 2)));
      if (!best || penalty < best.cost) best = { start, end, cost: penalty };
    }
  }
  return best ? `Suggested split: extract lines ${best.start}-${best.end} into a helper.` : null;
}

export function suggestNestingFix(p: Parsed, line: number): string | null {
  const node = descendants(p.root, ALL_CONTROLS).find((n) => lineOf(n) === line);
  if (!node) return null;
  let outer: Node | null = null;
  for (let up = node.parent; up && !ALL_FUNCTIONS.includes(up.type); up = up.parent) {
    if (ALL_CONTROLS.includes(up.type)) outer = up;
  }
  if (outer && ["if_statement", "if_expression"].includes(outer.type) && !outer.childForFieldName("alternative")) {
    return `Suggested refactor: invert condition at line ${lineOf(outer)} into a guard clause.`;
  }
  return `Suggested refactor: extract nested block at lines ${lineOf(node)}-${node.endPosition.row + 1} into a helper.`;
}

