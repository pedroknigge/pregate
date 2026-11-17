// Same-file TypeScript facts the pack cannot express as a pattern: merged compiler options,
// bindings that are never reassigned, type-only imports, and a value that stays unparsed.
// Each fact is a proxy. The pack methodology says what it does not prove.
import { loadCompilerOptions } from "./resolve.ts";
import type { Node, Parsed } from "./ts.ts";
import type { Read } from "./types.ts";

export type TypescriptFact = "prefer-const" | "type-only-import" | "boundary-parse" | "parameter-sort" | "readonly-array" | "rethrow-cause" | "interface-prefix" | "boolean-mode";
export interface FactHit { line: number; warn: boolean }

const REQUIRED_FLAGS = ["noUncheckedIndexedAccess", "noImplicitOverride", "noImplicitReturns", "noFallthroughCasesInSwitch", "forceConsistentCasingInFileNames", "verbatimModuleSyntax"];
const STRICT_FLAGS = ["strictNullChecks", "noImplicitAny", "strictFunctionTypes", "strictBindCallApply", "strictPropertyInitialization", "noImplicitThis", "useUnknownInCatchVariables", "alwaysStrict"];
const ADVISOR_FLAGS = ["skipLibCheck", "exactOptionalPropertyTypes"];
const BUNDLER_CONFLICT = new Set(["node16", "nodenext", "commonjs", "amd", "umd", "system", "none"]);
const PARSERS = new Set(["parse", "safeParse", "validate", "decode", "parseAsync", "safeParseAsync"]);
const FUNCTIONS = new Set(["function_declaration", "generator_function_declaration", "function_expression", "arrow_function", "method_definition"]);
const PATTERNS = new Set(["object_pattern", "array_pattern", "rest_pattern", "assignment_pattern", "pair_pattern"]);

export function typescriptFactNodes(fact: TypescriptFact, parsed: Parsed): Node[] {
  const root = parsed.root;
  if (fact === "prefer-const") return preferConst(root);
  if (fact === "type-only-import") return typeOnlyImports(root);
  if (fact === "boundary-parse") return boundaryParses(root);
  if (fact === "parameter-sort") return parameterSorts(root);
  if (fact === "readonly-array") return mutableArrays(root);
  if (fact === "rethrow-cause") return rethrows(root);
  if (fact === "interface-prefix") return interfacePrefix(root);
  return booleanModes(root);
}

export function tsconfigFindings(rel: string, text: string, read: Read): FactHit[] {
  if (rel.split("/").includes("node_modules")) return [];
  const loaded = loadCompilerOptions(read, rel, text);
  if (loaded === null || loaded.referencesOnly) return [];
  if (loaded.invalid) return [{ line: 1, warn: false }];
  const uncertain = loaded.missing.length > 0;
  const options = loaded.options;
  const hits: FactHit[] = [];
  const flag = (key: string, warn: boolean): void => {
    if (options[key] === true) return;
    if (options[key] === undefined && uncertain) return;
    hits.push({ line: lineOf(text, key), warn });
  };
  if (options.strict === true) {
    for (const key of STRICT_FLAGS) if (options[key] === false) hits.push({ line: lineOf(text, key), warn: false });
  } else if (!(options.strict === undefined && uncertain)) hits.push({ line: lineOf(text, "strict"), warn: false });
  for (const key of REQUIRED_FLAGS) flag(key, false);
  const resolution = resolutionProblem(options);
  if (resolution && !(resolution.absent && uncertain)) hits.push({ line: lineOf(text, resolution.key), warn: false });
  if (!targetOk(options.target) && !(options.target === undefined && uncertain)) hits.push({ line: lineOf(text, "target"), warn: false });
  for (const key of ADVISOR_FLAGS) flag(key, true);
  return hits;
}

function lineOf(text: string, key: string): number {
  return keyLine(text, key) ?? keyLine(text, "extends") ?? keyLine(text, "compilerOptions") ?? 1;
}

function keyLine(text: string, key: string): number | null {
  const match = new RegExp(`["']${key}["']\\s*:`).exec(text);
  return match ? text.slice(0, match.index).split("\n").length : null;
}

function targetOk(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const name = value.toLowerCase();
  if (name === "esnext") return true;
  const year = name === "es3" ? 3 : name === "es5" ? 5 : name === "es6" || name === "es2015" ? 2015 : /^es20\d\d$/.test(name) ? Number(name.slice(2)) : null;
  return year !== null && year >= 2022;
}

function resolutionProblem(options: Record<string, unknown>): { key: string; absent: boolean } | null {
  const moduleName = typeof options.module === "string" ? options.module.toLowerCase() : "";
  const set = typeof options.moduleResolution === "string" ? options.moduleResolution.toLowerCase() : "";
  const implied = moduleName === "node16" || moduleName === "nodenext" ? moduleName : "";
  const effective = set || implied;
  if (effective !== "bundler" && effective !== "node16" && effective !== "nodenext") return { key: set ? "moduleResolution" : "module", absent: effective === "" };
  if (effective === "node16" && moduleName !== "node16") return { key: "module", absent: false };
  if (effective === "nodenext" && moduleName !== "nodenext") return { key: "module", absent: false };
  if (effective === "bundler" && BUNDLER_CONFLICT.has(moduleName)) return { key: "module", absent: false };
  return null;
}

function preferConst(root: Node): Node[] {
  const hits: Node[] = [];
  for (const decl of root.descendantsOfType("lexical_declaration")) {
    if (!decl.children.some((child) => child.type === "let") || ambient(decl)) continue;
    for (const declarator of decl.namedChildren) if (declarator.type === "variable_declarator" && !reassigned(declarator, root)) hits.push(declarator);
  }
  for (const loop of root.descendantsOfType("for_in_statement")) {
    if (!loop.children.some((child) => child.type === "let") || ambient(loop)) continue;
    const name = loop.namedChildren.find((child) => child.type === "identifier");
    if (name && !reassigned(name, root)) hits.push(name);
  }
  return hits;
}

function reassigned(decl: Node, root: Node): boolean {
  for (const node of root.descendantsOfType(["assignment_expression", "update_expression"])) {
    const left = node.type === "assignment_expression" ? node.childForFieldName("left") : node.namedChildren[0] ?? null;
    if (left && assignmentNames(left).some((name) => same(resolveBinding(name), decl))) return true;
  }
  return false;
}

function assignmentNames(node: Node): Node[] {
  if (node.type === "identifier") return [node];
  if (node.type === "parenthesized_expression") return node.namedChildren[0] ? assignmentNames(node.namedChildren[0]) : [];
  if (node.type === "pair_pattern" || node.type === "assignment_pattern" || node.type === "rest_pattern") {
    const inner = node.namedChildren[node.namedChildren.length - 1];
    return inner ? assignmentNames(inner) : [];
  }
  if (node.type === "object_pattern" || node.type === "array_pattern") return node.namedChildren.flatMap(assignmentNames);
  return [];
}

function typeOnlyImports(root: Node): Node[] {
  const hits: Node[] = [];
  for (const stmt of root.namedChildren) {
    if (stmt.type !== "import_statement" || stmt.children.some((child) => child.type === "type")) continue;
    for (const spec of stmt.descendantsOfType("import_specifier")) {
      if (spec.children.some((child) => child.type === "type")) continue;
      const local = spec.childForFieldName("alias") ?? spec.childForFieldName("name");
      if (local && onlyTypes(root, spec, local.text)) hits.push(spec);
    }
    const clause = stmt.namedChildren.find((child) => child.type === "import_clause");
    const def = clause?.namedChildren.find((child) => child.type === "identifier");
    if (def && onlyTypes(root, def, def.text)) hits.push(def);
  }
  return hits;
}

function onlyTypes(root: Node, decl: Node, name: string): boolean {
  const uses = root.descendantsOfType(["identifier", "type_identifier"]).filter((node) => node.text === name && !contains(decl, node) && same(resolveBinding(node), decl));
  return uses.length > 0 && uses.every((node) => !isValueUse(node));
}

function isValueUse(node: Node): boolean {
  if (node.type !== "identifier") return false;
  let cur: Node | null = node.parent;
  while (cur && cur.type !== "statement_block" && cur.type !== "program") {
    if (cur.type === "export_statement" && cur.children.some((child) => child.type === "type")) return false;
    cur = cur.parent;
  }
  return true;
}

function boundaryParses(root: Node): Node[] {
  const hits: Node[] = [];
  walk(root, new Map(), hits);
  return hits;
}

function walk(node: Node, taint: Map<number, boolean>, hits: Node[]): void {
  if (node.type === "if_statement") {
    const condition = node.childForFieldName("condition");
    if (condition) walk(condition, taint, hits);
    const thenMap = new Map(taint);
    const elseMap = new Map(taint);
    const consequence = node.childForFieldName("consequence");
    const alternative = node.childForFieldName("alternative");
    if (consequence) walk(consequence, thenMap, hits);
    if (alternative) walk(alternative, elseMap, hits);
    for (const key of new Set([...taint.keys(), ...thenMap.keys(), ...elseMap.keys()])) {
      taint.set(key, thenMap.get(key) === true || elseMap.get(key) === true);
    }
    return;
  }
  if (node.type === "variable_declarator") {
    const value = node.childForFieldName("value");
    if (value) walk(value, taint, hits);
    const tainted = exprTaint(value, taint);
    taint.set(node.id, tainted);
    const type = node.childForFieldName("type");
    if (tainted && type && !isUnknownAnnotation(type)) hits.push(node);
    return;
  }
  if (node.type === "assignment_expression") {
    const right = node.childForFieldName("right");
    const left = node.childForFieldName("left");
    if (right) walk(right, taint, hits);
    if (left?.type === "identifier") {
      const decl = resolveBinding(left);
      if (decl) taint.set(decl.id, exprTaint(right, taint));
    }
    return;
  }
  if (node.type === "as_expression") {
    const inner = node.namedChildren[0] ?? null;
    if (inner) walk(inner, taint, hits);
    if (exprTaint(inner, taint) && !isUnknownOnly(node)) hits.push(node);
    return;
  }
  for (const child of node.namedChildren) walk(child, taint, hits);
}

function exprTaint(expr: Node | null, taint: Map<number, boolean>): boolean {
  if (!expr) return false;
  if (expr.type === "parenthesized_expression" || expr.type === "await_expression" || expr.type === "non_null_expression" || expr.type === "satisfies_expression" || expr.type === "as_expression") {
    return exprTaint(expr.namedChildren[0] ?? null, taint);
  }
  if (expr.type === "identifier") {
    const decl = resolveBinding(expr);
    return decl !== null && taint.get(decl.id) === true;
  }
  if (expr.type === "member_expression") return exprTaint(expr.childForFieldName("object") ?? null, taint);
  if (isJsonParse(expr) || isJsonCall(expr)) return true;
  if (isParserCall(expr)) return false;
  return false;
}

function isUnknownOnly(node: Node): boolean {
  const type = node.namedChildren[node.namedChildren.length - 1];
  return type?.type === "predefined_type" && type.text === "unknown";
}

function isUnknownAnnotation(typeNode: Node): boolean {
  const inner = typeNode.type === "type_annotation" ? typeNode.namedChildren[0] : typeNode;
  return inner?.type === "predefined_type" && inner.text === "unknown";
}

function isJsonParse(expr: Node): boolean {
  const member = calledMember(expr);
  return member !== null && member.object.type === "identifier" && member.object.text === "JSON" && member.property === "parse";
}

function isJsonCall(expr: Node): boolean {
  const member = calledMember(expr);
  return member !== null && member.property === "json" && !isJsonParse(expr);
}

function isParserCall(expr: Node): boolean {
  if (expr.type !== "call_expression" || isJsonParse(expr)) return false;
  const fn = expr.childForFieldName("function");
  if (fn?.type === "identifier") return PARSERS.has(fn.text);
  return fn?.type === "member_expression" && PARSERS.has(fn.childForFieldName("property")?.text ?? "");
}

function calledMember(expr: Node): { object: Node; property: string } | null {
  if (expr.type !== "call_expression") return null;
  const fn = expr.childForFieldName("function");
  if (fn?.type !== "member_expression") return null;
  const object = fn.childForFieldName("object");
  const property = fn.childForFieldName("property")?.text;
  return object && property ? { object, property } : null;
}

function parameterSorts(root: Node): Node[] {
  const hits: Node[] = [];
  for (const call of root.descendantsOfType("call_expression")) {
    const member = calledMember(call);
    if (!member || (member.property !== "sort" && member.property !== "reverse")) continue;
    const object = unwrap(member.object);
    if (object?.type !== "identifier") continue;
    const decl = resolveBinding(object);
    if (decl && isParameter(decl)) hits.push(call);
  }
  return hits;
}

function mutableArrays(root: Node): Node[] {
  const hits: Node[] = [];
  for (const param of root.descendantsOfType(["required_parameter", "optional_parameter", "rest_parameter"])) {
    if (exportedParameter(param) && mutableArray(param.childForFieldName("type"))) hits.push(param);
  }
  for (const prop of root.descendantsOfType("property_signature")) {
    if (exportedProperty(prop) && mutableArray(prop.childForFieldName("type"))) hits.push(prop);
  }
  return hits;
}

function mutableArray(typeNode: Node | null): boolean {
  const inner = typeNode?.type === "type_annotation" ? typeNode.namedChildren[0] ?? null : typeNode;
  if (!inner) return false;
  if (inner.type === "array_type") return true;
  if (inner.type === "readonly_type") return false;
  if (inner.type === "generic_type") return inner.namedChildren[0]?.text === "Array";
  if (inner.type === "union_type" || inner.type === "intersection_type" || inner.type === "parenthesized_type") return inner.namedChildren.some((child) => mutableArray(child));
  return false;
}

function exportedParameter(param: Node): boolean {
  const list = param.parent;
  const fn = list?.type === "formal_parameters" ? list.parent : list?.childForFieldName("parameter") === param ? list : null;
  return fn !== null && FUNCTIONS.has(fn.type) && fn.type !== "method_definition" && directlyExported(fn);
}

function exportedProperty(prop: Node): boolean {
  let cur: Node | null = prop.parent;
  while (cur) {
    if (cur.type === "interface_declaration" || cur.type === "type_alias_declaration") return cur.parent?.type === "export_statement";
    if (cur.type === "required_parameter" || cur.type === "optional_parameter" || cur.type === "rest_parameter") return exportedParameter(cur);
    if (cur.type === "statement_block" || cur.type === "class_body") return false;
    cur = cur.parent;
  }
  return false;
}

function directlyExported(fn: Node): boolean {
  let cur: Node | null = fn.parent;
  while (cur) {
    if (cur.type === "export_statement") return true;
    if (cur.type === "statement_block" || cur.type === "class_body" || FUNCTIONS.has(cur.type)) return false;
    cur = cur.parent;
  }
  return false;
}

function rethrows(root: Node): Node[] {
  return root.descendantsOfType("throw_statement").filter((node) => inside(node, "catch_clause") && !hasCause(node));
}

function hasCause(node: Node): boolean {
  const expr = node.namedChildren[0] ?? null;
  return expr !== null && objectHasCause(thrownObject(expr));
}

function thrownObject(expr: Node): Node | null {
  if (expr.type === "object") return expr;
  if (expr.type === "parenthesized_expression") return expr.namedChildren[0] ? thrownObject(expr.namedChildren[0]) : null;
  if (expr.type === "new_expression" || expr.type === "call_expression") {
    const args = expr.childForFieldName("arguments") ?? expr.namedChildren.find((child) => child.type === "arguments");
    return args?.namedChildren.find((child) => child.type === "object" && objectHasCause(child)) ?? null;
  }
  return null;
}

function objectHasCause(object: Node | null): boolean {
  if (!object || object.type !== "object") return false;
  return object.namedChildren.some((child) => {
    if (child.type === "shorthand_property_identifier") return child.text === "cause";
    const key = child.type === "pair" ? child.childForFieldName("key") ?? child.namedChildren[0] : null;
    return key?.text === "cause";
  });
}

function interfacePrefix(root: Node): Node[] {
  return root.descendantsOfType("interface_declaration").filter((node) => /^I[A-Z]/.test(node.childForFieldName("name")?.text ?? node.namedChildren.find((child) => child.type === "type_identifier")?.text ?? ""));
}

function booleanModes(root: Node): Node[] {
  const hits: Node[] = [];
  for (const decl of root.descendantsOfType(["interface_declaration", "type_alias_declaration"])) {
    if (decl.parent?.type !== "export_statement") continue;
    const body = decl.childForFieldName("body") ?? decl.childForFieldName("value") ?? decl.namedChildren.find((child) => child.type === "interface_body" || child.type === "object_type" || child.type === "union_type");
    if (!body || body.type === "union_type" || body.type === "intersection_type" || (body.type !== "interface_body" && body.type !== "object_type")) continue;
    const flags = body.namedChildren.filter((child) => child.type === "property_signature" && isBoolean(child.childForFieldName("type")));
    if (flags.length >= 2) hits.push(decl.childForFieldName("name") ?? decl);
  }
  return hits;
}

function isBoolean(typeNode: Node | null): boolean {
  const inner = typeNode?.type === "type_annotation" ? typeNode.namedChildren[0] : typeNode;
  return inner?.type === "predefined_type" && inner.text === "boolean";
}

function ambient(node: Node): boolean {
  return inside(node, "ambient_declaration") || ancestors(node).some((item) => item.children.some((child) => child.type === "declare"));
}

function inside(node: Node, type: string): boolean {
  return ancestors(node).some((item) => item.type === type);
}

function ancestors(node: Node): Node[] {
  const found: Node[] = [];
  let cur: Node | null = node;
  while (cur) {
    found.push(cur);
    cur = cur.parent;
  }
  return found;
}

function resolveBinding(use: Node): Node | null {
  let cur: Node | null = use.parent;
  while (cur) {
    const found = declaredHere(cur, use);
    if (found) return found;
    cur = cur.parent;
  }
  return null;
}

function same(left: Node | null, right: Node | null): boolean {
  return left !== null && right !== null && left.id === right.id;
}

function declaredHere(scope: Node, use: Node): Node | null {
  const name = use.text;
  if (FUNCTIONS.has(scope.type)) {
    const params = scope.childForFieldName("parameters");
    const single = scope.childForFieldName("parameter");
    for (const param of params ? params.namedChildren : single ? [single] : []) {
      if (binds(param.childForFieldName("pattern") ?? param, name) && !contains(param, use)) return param;
    }
  }
  if (scope.type === "catch_clause") {
    const param = scope.namedChildren.find((child) => child.type === "identifier" || PATTERNS.has(child.type));
    if (param && binds(param, name) && !contains(param, use)) return param;
  }
  if (scope.type === "for_statement" || scope.type === "for_in_statement") {
    const header = loopBinding(scope, name);
    if (header && !contains(header, use)) return header;
  }
  if (scope.type === "statement_block" || scope.type === "program") {
    let found: Node | null = null;
    for (const stmt of scope.namedChildren) {
      if (stmt.startIndex > use.startIndex) break;
      const decl = statementBinding(stmt, name);
      if (decl && !contains(decl, use)) found = decl;
    }
    return found;
  }
  return null;
}

function loopBinding(scope: Node, name: string): Node | null {
  if (scope.type === "for_statement") {
    const init = scope.namedChildren.find((child) => child.type === "lexical_declaration");
    return init ? declaratorNamed(init, name) : null;
  }
  return scope.namedChildren.find((child) => child.type === "identifier" && child.text === name) ?? null;
}

function statementBinding(stmt: Node, name: string): Node | null {
  if (stmt.type === "lexical_declaration") return declaratorNamed(stmt, name);
  if (stmt.type === "import_statement") return importBinding(stmt, name);
  if (stmt.type === "export_statement") {
    const inner = stmt.namedChildren.find((child) => child.type === "lexical_declaration");
    return inner ? declaratorNamed(inner, name) : null;
  }
  if (stmt.type === "function_declaration" || stmt.type === "class_declaration") {
    const id = stmt.childForFieldName("name");
    return id?.text === name ? id : null;
  }
  return null;
}

function declaratorNamed(decl: Node, name: string): Node | null {
  for (const declarator of decl.namedChildren) {
    if (declarator.type === "variable_declarator" && binds(declarator.childForFieldName("name"), name)) return declarator;
  }
  return null;
}

function importBinding(stmt: Node, name: string): Node | null {
  for (const spec of stmt.descendantsOfType("import_specifier")) {
    const local = spec.childForFieldName("alias") ?? spec.childForFieldName("name");
    if (local?.text === name) return spec;
  }
  const clause = stmt.namedChildren.find((child) => child.type === "import_clause");
  const def = clause?.namedChildren.find((child) => child.type === "identifier");
  if (def?.text === name) return def;
  const space = stmt.descendantsOfType("namespace_import")[0];
  const id = space?.namedChildren.find((child) => child.type === "identifier");
  return id?.text === name ? id ?? null : null;
}

function binds(pattern: Node | null, name: string): boolean {
  if (!pattern) return false;
  if (pattern.type === "identifier" || pattern.type === "shorthand_property_identifier_pattern") return pattern.text === name;
  if (pattern.type === "rest_pattern" || pattern.type === "assignment_pattern") return binds(pattern.namedChildren[0] ?? null, name);
  if (pattern.type === "pair_pattern") return binds(pattern.namedChildren[pattern.namedChildren.length - 1] ?? null, name);
  if (pattern.type === "object_pattern" || pattern.type === "array_pattern") return pattern.namedChildren.some((child) => binds(child, name));
  return false;
}

function contains(node: Node, use: Node): boolean {
  return node.startIndex <= use.startIndex && use.endIndex <= node.endIndex;
}

function unwrap(node: Node | null): Node | null {
  let cur = node;
  while (cur && (cur.type === "parenthesized_expression" || cur.type === "non_null_expression")) cur = cur.namedChildren[0] ?? null;
  return cur;
}

function isParameter(node: Node): boolean {
  return node.type === "required_parameter" || node.type === "optional_parameter" || node.type === "rest_parameter";
}
