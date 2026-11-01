import { isGuardClause } from "./language-facts.ts";
import type { CodeImport } from "./types.ts";
import type { Node, Parsed } from "./ts.ts";

export const RUST_FUNCTIONS = ["function_item", "function_signature_item", "closure_expression"];
const CONTROLS = ["if_expression", "for_expression", "while_expression", "loop_expression", "match_expression"];
const STATEMENTS = ["let_declaration", "expression_statement", "function_item", "function_signature_item", "struct_item", "enum_item", "const_item", "static_item", "use_declaration", "mod_item", "type_item", "impl_item", "trait_item"];
const comments = new Set(["line_comment", "block_comment"]);
const nodes = (root: Node, kinds: string[]): Node[] => root.descendantsOfType(kinds).filter(node => node.isNamed);
const children = (node: Node): Node[] => node.namedChildren.filter(child => !comments.has(child.type));

export function rustSymbol(node: Node): string {
  const names: string[] = [];
  for (let at: Node | null = node; at; at = at.parent) {
    const field = at.type === "impl_item" ? "type" : at.type === "let_declaration" ? "pattern" : "name";
    if (!RUST_FUNCTIONS.includes(at.type) && !["impl_item", "trait_item", "mod_item", "let_declaration"].includes(at.type)) continue;
    const name = at.childForFieldName(field);
    if (name && (at.type !== "let_declaration" || name.type === "identifier")) names.push(name.text);
  }
  return names.length ? names.reverse().join(".") : "<module>";
}

function width(node: Node | null): number {
  if (!node) return 1;
  return ["tuple_pattern", "tuple_type"].includes(node.type) ? children(node).reduce((sum, child) => sum + width(child), 0) : 1;
}

export function rustFunctions(p: Parsed, codeBefore: number[]) {
  const starts = nodes(p.root, STATEMENTS).map(node => node.startIndex).sort((a, b) => a - b);
  const before = (index: number): number => {
    let lo = 0, hi = starts.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (starts[mid]! < index) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  return nodes(p.root, RUST_FUNCTIONS).map(fn => {
    const body = fn.childForFieldName("body");
    const count = body ? before(body.endIndex) - before(body.startIndex) : 0;
    const lines = (codeBefore[fn.endPosition.row + 1] ?? 0) - (codeBefore[fn.startPosition.row] ?? 0);
    const params = fn.childForFieldName("parameters");
    const inputs = params ? children(params).filter(node => node.type !== "self_parameter" && node.childForFieldName("pattern")?.type !== "self") : [];
    return { symbol: rustSymbol(fn), line: fn.startPosition.row + 1, lines: Math.max(lines, count),
      params: inputs.reduce((sum, input) => sum + Math.max(width(input.childForFieldName("pattern")), width(input.childForFieldName("type"))), 0) };
  });
}

export function rustNestings(p: Parsed) {
  return nodes(p.root, CONTROLS).flatMap(node => {
    if (isGuardClause(node)) return [];
    let depth = 1, child = node;
    for (let parent = node.parent; parent && !RUST_FUNCTIONS.includes(parent.type); parent = parent.parent) {
      const chain = child.type === "if_expression" || (child.type === "else_clause" && children(child).some(node => node.type === "if_expression"));
      if (CONTROLS.includes(parent.type) && !(chain && parent.type === "if_expression" && parent.childForFieldName("alternative")?.id === child.id) && !isGuardClause(parent)) depth++;
      child = parent;
    }
    return [{ symbol: rustSymbol(node), line: node.startPosition.row + 1, measured: depth, own: null }];
  });
}

function usePaths(node: Node | null, prefix = ""): string[] {
  if (!node) return [];
  const join = (part: string): string => prefix && part !== "self" ? `${prefix}::${part}` : part === "self" && prefix ? prefix : part;
  if (node.type === "use_as_clause") return usePaths(node.childForFieldName("path"), prefix);
  if (node.type === "use_list") return children(node).flatMap(child => usePaths(child, prefix));
  if (node.type === "scoped_use_list") return usePaths(node.childForFieldName("list"), node.childForFieldName("path") ? join(node.childForFieldName("path")!.text) : prefix);
  if (node.type === "use_wildcard") return [children(node)[0] ? join(children(node)[0]!.text) : prefix].map(path => path + "::*");
  return [join(node.text)];
}

export function rustUseNames(node: Node | null): string[] {
  if (!node) return [];
  if (node.type === "use_as_clause") return [node.childForFieldName("alias")!.text];
  if (node.type === "use_list") return children(node).flatMap(rustUseNames);
  if (node.type === "scoped_use_list") return rustUseNames(node.childForFieldName("list"));
  if (node.type === "use_wildcard") return [];
  const name = node.childForFieldName("name") ?? node;
  return name.type === "self" ? [] : [name.text];
}

function canonicalPath(node: Node): string | null {
  if (["generic_type", "generic_function"].includes(node.type)) {
    const inner = node.childForFieldName("type") ?? node.childForFieldName("function");
    return inner ? canonicalPath(inner) : null;
  }
  if (["scoped_identifier", "scoped_type_identifier"].includes(node.type)) {
    const path = node.childForFieldName("path"), name = node.childForFieldName("name");
    const prefix = path ? canonicalPath(path) : "";
    return prefix !== null && name ? `${prefix}::${name.text}` : null;
  }
  return ["crate", "self", "super", "identifier", "type_identifier"].includes(node.type) ? node.text : null;
}

function directPath(node: Node): string | null {
  for (let at = node.parent; at; at = at.parent) if (at.type === "use_declaration") return null;
  const parent = node.parent;
  if (parent && ["path", "type", "function"].some(field => parent.childForFieldName(field)?.id === node.id)
    && ["scoped_identifier", "scoped_type_identifier", "generic_type", "generic_function"].includes(parent.type)) return null;
  const path = canonicalPath(node);
  return path && /^(?:::)?(?:crate|self|super|std|core|alloc)::/.test(path) ? path : null;
}

// Resolver inputs only: ordinary function-body edits do not alter module identity.
export function rustResolutionKey(p: Parsed): string {
  const declarations = nodes(p.root, ["mod_item", "struct_item", "enum_item", "trait_item", "type_item", "const_item", "static_item", "function_item", "function_signature_item", "union_item"])
    .map(node => [node.type, moduleContext(node), node.childForFieldName("name")?.text, node.type === "mod_item" && !!node.childForFieldName("body")]);
  const attributes = nodes(p.root, ["attribute_item", "inner_attribute_item"]).map(node => [moduleContext(node), node.text]);
  const uses = nodes(p.root, ["use_declaration", "extern_crate_declaration"]).map(node => [moduleContext(node), node.text]);
  const includes = nodes(p.root, ["macro_invocation"]).filter(node => /(?:^|::)include$/.test(node.childForFieldName("macro")?.text ?? "")).map(node => [moduleContext(node), node.text]);
  return JSON.stringify([declarations, attributes, uses, includes]);
}

function moduleContext(node: Node): string {
  const names: string[] = [];
  for (let at = node.parent; at; at = at.parent) if (at.type === "mod_item") names.push(at.childForFieldName("name")!.text);
  return names.reverse().join("::");
}

export function rustImports(p: Parsed): CodeImport[] {
  return nodes(p.root, ["use_declaration", "extern_crate_declaration", "mod_item", "macro_invocation", "scoped_identifier", "scoped_type_identifier", "generic_type", "generic_function"]).flatMap((node): CodeImport[] => {
    const line = node.startPosition.row + 1, base = moduleContext(node);
    const kind = children(node).some(child => child.type === "visibility_modifier") ? "reexport" as const : "static" as const;
    if (["scoped_identifier", "scoped_type_identifier", "generic_type", "generic_function"].includes(node.type)) {
      const spec = directPath(node);
      return spec ? [{ spec, line, kind: "static", literal: true, base }] : [];
    }
    if (node.type === "macro_invocation") return /(?:^|::)include$/.test(node.childForFieldName("macro")?.text ?? "") ? [{ spec: node.text, line, kind: "dynamic" as const, literal: false, base }] : [];
    if (node.type === "mod_item") return node.childForFieldName("body") ? [] : [{ spec: `self::${node.childForFieldName("name")!.text}`, line, kind, literal: true, base }];
    const paths = node.type === "extern_crate_declaration" ? [node.childForFieldName("name")!.text.replace(/^self$/, "crate")] : usePaths(node.childForFieldName("argument"));
    return paths.map(spec => ({ spec: spec.replace(/\s+/g, ""), line, kind, literal: !spec.includes("$"), base }));
  });
}
