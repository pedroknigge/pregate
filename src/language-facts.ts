import type { Node, Parsed } from "./ts.ts";
import type { CodeImport } from "./types.ts";

export const OTHER_FUNCTIONS = ["function_definition", "lambda", "function_declaration", "method_declaration", "func_literal"];
export const OTHER_CLASSES = ["class_definition"];
const PY_STATEMENTS = ["assert_statement", "break_statement", "class_definition", "continue_statement", "delete_statement",
  "expression_statement", "for_statement", "function_definition", "global_statement", "if_statement", "import_from_statement",
  "import_statement", "nonlocal_statement", "pass_statement", "raise_statement", "return_statement", "try_statement", "while_statement", "with_statement", "match_statement"];
const GO_STATEMENTS = ["assignment_statement", "break_statement", "continue_statement", "dec_statement", "defer_statement",
  "expression_statement", "fallthrough_statement", "for_statement", "go_statement", "goto_statement", "if_statement", "inc_statement",
  "labeled_statement", "return_statement", "select_statement", "send_statement", "short_var_declaration", "expression_switch_statement",
  "type_switch_statement", "var_declaration", "const_declaration", "type_declaration"];
const CONTROLS = ["if_statement", "for_statement", "while_statement", "try_statement", "with_statement", "match_statement",
  "select_statement", "expression_switch_statement", "type_switch_statement"];

function nodes(root: Node, kinds: string[]): Node[] {
  return root.descendantsOfType(kinds).filter((n) => n.isNamed);
}

export function languageSymbol(node: Node): string {
  const names: string[] = [];
  for (let n: Node | null = node; n; n = n.parent) {
    if (OTHER_FUNCTIONS.includes(n.type) || OTHER_CLASSES.includes(n.type)) {
      const name = n.childForFieldName("name");
      if (!name) continue;
      const type = n.childForFieldName("receiver")?.namedChildren[0]?.childForFieldName("type")?.text;
      names.push(type ? type.replace(/^\*+/, "").split("[")[0] + "." + name.text : name.text);
    } else if (["assignment", "short_var_declaration", "var_spec"].includes(n.type)) {
      const left = n.childForFieldName("left") ?? n.childForFieldName("name");
      const name = left?.type === "expression_list" && left.namedChildren.length === 1 ? left.namedChildren[0] : left;
      if (name?.type === "identifier") names.push(name.text);
    }
  }
  return names.length ? names.reverse().join(".") : "<module>";
}

export function languageFunctions(p: Parsed, codeBefore: number[]) {
  const statements = nodes(p.root, p.rel.toLowerCase().endsWith(".py") ? PY_STATEMENTS : GO_STATEMENTS)
    .filter((n) => n.parent?.type !== "for_clause" && n.parent?.childForFieldName("initializer")?.id !== n.id)
    .map((n) => n.startIndex).sort((a, b) => a - b);
  const before = (index: number): number => {
    let lo = 0, hi = statements.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (statements[mid]! < index) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return nodes(p.root, OTHER_FUNCTIONS).map((fn) => {
    const body = fn.childForFieldName("body");
    const count = body ? before(body.endIndex) - before(body.startIndex) : 0;
    const lines = (codeBefore[fn.endPosition.row + 1] ?? 0) - (codeBefore[fn.startPosition.row] ?? 0);
    const params = fn.childForFieldName("parameters")?.namedChildren.filter((n) => !["comment", "positional_separator", "keyword_separator"].includes(n.type)) ?? [];
    return { symbol: languageSymbol(fn), line: fn.startPosition.row + 1, lines: Math.max(lines, count),
      params: params.reduce((sum, n) => sum + (n.type === "parameter_declaration" ? Math.max(1, n.childrenForFieldName("name").length) : 1), 0) };
  });
}

export function languageClasses(p: Parsed) {
  return nodes(p.root, OTHER_CLASSES).map((c) => {
    const names = new Set<string>();
    for (const child of c.childForFieldName("body")?.namedChildren ?? []) {
      const fn = child.type === "decorated_definition" ? child.childForFieldName("definition") : child;
      const name = fn?.childForFieldName("name")?.text;
      if (fn?.type === "function_definition" && name && !name.startsWith("_")) names.add(name);
    }
    return { symbol: languageSymbol(c), line: c.startPosition.row + 1, publicMethods: names.size };
  });
}

export function languageNestings(p: Parsed) {
  return nodes(p.root, CONTROLS).flatMap((n) => {
    if (isGuardClause(n)) return [];
    let depth = 1, child = n;
    for (let parent = n.parent; parent && !OTHER_FUNCTIONS.includes(parent.type); parent = parent.parent) {
      const alternative = child.type === "if_statement" && parent.childForFieldName("alternative")?.id === child.id;
      if (CONTROLS.includes(parent.type) && !alternative && !isGuardClause(parent)) depth++;
      child = parent;
    }
    return [{ symbol: languageSymbol(n), line: n.startPosition.row + 1, measured: depth, own: null }];
  });
}

// A guard clause does not add a nesting level. It is an if with no else whose body is only a
// return, continue, break, or throw, and it sits in the function body or directly in a loop:
// `for { if (!x) continue; ... }`. The same shape nested under another if is still that if.
const EXIT_KINDS = new Set(["return_statement", "continue_statement", "break_statement", "throw_statement", "raise_statement", "return_expression", "continue_expression", "break_expression"]);
const COMMENT_KINDS = new Set(["comment", "line_comment", "block_comment"]);
const LOOP_KINDS = new Set(["for_statement", "for_in_statement", "while_statement", "do_statement", "for_expression", "while_expression", "loop_expression"]);
const BRANCH_KINDS = new Set(["if_statement", "if_expression", "switch_statement", "try_statement", "with_statement", "match_statement", "match_expression", "select_statement", "expression_switch_statement", "type_switch_statement"]);
const FUNCTION_BOUNDARY = new Set([...OTHER_FUNCTIONS, "function_declaration", "generator_function_declaration", "function_expression", "generator_function", "arrow_function", "method_definition", "function_item", "function_signature_item", "closure_expression"]);

export function isGuardClause(node: Node): boolean {
  if (node.type !== "if_statement" && node.type !== "if_expression") return false;
  if (node.childForFieldName("alternative")) return false;
  if (!onlyExit(node.childForFieldName("consequence") ?? node.childForFieldName("body"))) return false;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (FUNCTION_BOUNDARY.has(parent.type)) return true;
    if (LOOP_KINDS.has(parent.type)) return true;
    if (BRANCH_KINDS.has(parent.type)) return false;
  }
  return true;
}

function onlyExit(node: Node | null): boolean {
  if (!node) return false;
  if (EXIT_KINDS.has(node.type)) return true;
  const named = node.namedChildren.filter((child) => !COMMENT_KINDS.has(child.type));
  return named.length === 1 && onlyExit(named[0] ?? null);
}

// Decode observable literal strings only; interpolated expressions remain unknown.
export function literalString(node: Node | null): string | null {
  if (!node || !["string", "interpreted_string_literal", "raw_string_literal"].includes(node.type) || node.descendantsOfType("interpolation").length) return null;
  const found = /^([rRuUbBfF]*)(["']{1,3}|\x60)([\s\S]*)\2$/.exec(node.text);
  if (!found || /b/i.test(found[1]!)) return null;
  if (found[2] === String.fromCharCode(96)) return found[3]!.replace(/\r/g, "");
  if (/r/i.test(found[1]!)) return found[3]!;
  let invalid = false;
  const decoded = found[3]!.replace(/\\(U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[0-7]{1,3}|[\\"'abfnrtv]|\r?\n)/g, (_, code: string) => {
    if (/^[Uux]/.test(code)) {
      const point = parseInt(code.slice(1), 16);
      if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) { invalid = true; return ""; }
      return String.fromCodePoint(point);
    }
    if (/^[0-7]/.test(code)) return String.fromCharCode(parseInt(code, 8));
    return ({ a: "\x07", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\n": "", "\r\n": "" } as Record<string, string>)[code] ?? code;
  });
  return invalid ? null : decoded;
}

export function languageImports(p: Parsed): CodeImport[] {
  if (p.rel.toLowerCase().endsWith(".go")) return nodes(p.root, ["import_spec"]).map((n) => {
    const spec = literalString(n.childForFieldName("path"));
    return { spec: spec ?? "", line: n.startPosition.row + 1, kind: "static", literal: spec !== null };
  });
  return nodes(p.root, ["import_statement", "import_from_statement", "call"]).flatMap((n) => pythonImport(p, n));
}

function pythonImport(p: Parsed, n: Node): CodeImport[] {
  const line = n.startPosition.row + 1;
  if (n.type === "call") {
    const fn = n.childForFieldName("function")?.text;
    if (!["__import__", "importlib.import_module"].includes(fn ?? "")) return [];
    const arguments_ = n.childForFieldName("arguments")?.namedChildren ?? [];
    const argument = arguments_[0] ?? null;
    const literal = literalString(argument);
    // Extra arguments can change the relative-import context. No value-flow inference here.
    const spec = arguments_.length === 1 && !literal?.startsWith(".") ? literal : null;
    return [{ spec: spec ?? argument?.text ?? "", line, kind: "dynamic", literal: spec !== null }];
  }
  const base = n.childForFieldName("module_name")?.text;
  const names = n.childrenForFieldName("name").map((item) => (item.childForFieldName("name") ?? item).text);
  const kind = /(^|\/)__init__\.py$/i.test(p.rel) ? "reexport" : "static";
  if (base && !names.length) return [{ spec: base, line, kind, literal: true }];
  return names.map((name) => ({ spec: base ? base + (base.endsWith(".") ? "" : ".") + name : name,
    ...(base ? { base } : {}), line, kind, literal: true }));
}
