// The pattern engine: the closed subset of ast-grep rules (ARCHITECTURE §6.1) over tree-sitter kinds
// and fields. Every operator reproduces @ast-grep/napi 0.45.3 (smart strictness, first match wins, no
// backtracking); test/match.test.ts checks it differentially, so any divergence here is a bug.
import type { Language, TreeCursor } from "web-tree-sitter";
import { grammarOf, identifierScopeOf, type Node, type Parsed, parse } from "./ts.ts";
import type { Clock, Form, Grammar, PatternConfig, ScopeKind } from "./types.ts";
import { grammarPath } from "./languages.ts";

export interface Compiled { grammar: Grammar; rule: Test; constraints: [string, Test][]; kinds?: number[] }
export interface Match { node: Node; env: Record<string, Node | Node[]> }   // "$A" → node, "$$$A" → nodes

// The tree as plain records, built once per parse: rules visit every node many times and each
// web-tree-sitter accessor is a WASM call. Native nodes and field caches are materialized on demand.
// Children include anonymous tokens and comments, as in ast-grep.
interface Rec {
  node: Node | null; src: string; kind: number; named: boolean; extra: boolean | null; childIndex: number;
  start: number; end: number; order: number; parent: Rec | null; children: Rec[]; fields: Map<number, Rec | null> | null;
}
type Env = Readonly<Record<string, Rec | readonly Rec[]>>;
type Test = ((n: Rec, env: Env, now: Clock) => Env | null) & { query?: { key: string; only: boolean }; kinds?: number[] };
type Stop = "neighbor" | "end" | Test;
type Stops = (n: Rec, now: Clock) => boolean;   // whether stopBy, as a rule, holds at n
type MetaVar = { name: string | null; multi: boolean; named: boolean };   // name null: $_, $$$
type PNode = { var: MetaVar } | { leaf: string; named: boolean; kind: number } | { kind: number; children: PNode[] };
interface Scope { grammar: Grammar; utils: Map<string, Test>; rawUtils: Record<string, unknown>; refs: string[]; vars: Set<string>; indexed: boolean }

const RULE_KEYS = ["pattern", "kind", "regex", "nthChild", "all", "any", "not", "matches", "scope", "inside", "has", "precedes", "follows"];
const CONFIG_KEYS = new Set(["id", "rule", "constraints", "utils", "files", "ignores", "since", "when"]);
// Escapes that mean the same in Rust's regex and in a JS RegExp without flags; anything else
// (\A, \z, \p{…}, \x{…}, octal) would be read differently, so it is rejected instead.
const SAME_ESCAPE = /^(?:[^0-9A-Za-z]|[dDwWsSbBnrtfv]|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4})/;
// JavaScriptCore gives up on a regex with a repeated group and answers "no match" (O27): when it
// backtracks catastrophically (after ≥ 225 ms on an M5 Pro, on inputs of 30 characters) or when its
// backtrack memory runs out, once groups × characters reaches ~2.2 M (16 nested repeated groups
// give up at 221,000 characters, 1,000 groups at 4,000). Without a repeated group it never gives up.
// Past SLOW_MS or LONG such a "no match" is no answer; MAX_GROUPS keeps the memory bound past LONG.
// The original memory measurements were on Bun 1.3.14. These bounds stay conservative;
// tests check the pinned runtime's capture-memory exhaustion and safe-length matches.
const SLOW_MS = 50;
const LONG = 65_536;
const MAX_GROUPS = 16;
const trees = new WeakMap<Parsed, Rec>();
const languages = new Map<Grammar, Language>();
interface TextIndex { sizes: Map<number, Rec[]>; words: Map<number, Map<string, Rec[]>> }
const textIndexes = new WeakMap<Rec, TextIndex>();
const kindIndexes = new WeakMap<Rec, Rec[][]>();

export function compilePattern(c: PatternConfig, g: Grammar): Compiled {
  const unknown = Object.keys(c).filter((k) => !CONFIG_KEYS.has(k) && !k.startsWith("x-"));
  if (unknown.length) throw new Error(`${c.id}: unknown key ${unknown.join(", ")}`);
  if (c.when !== undefined) {
    const keys = Object.keys(c.when);
    if (keys.length !== 1 || keys[0] !== "cacheComponents" || (c.when.cacheComponents !== "on" && c.when.cacheComponents !== "off")) {
      throw new Error(`${c.id}: when.cacheComponents must be on or off`);
    }
  }
  const utils = record(c.utils ?? {}, `${c.id}.utils`);
  const s: Scope = { grammar: g, utils: new Map(), rawUtils: utils, refs: [], vars: new Set(), indexed: false };
  for (const [id, rule] of Object.entries(utils)) s.utils.set(id, compileRule(rule, s, `${c.id}.utils.${id}`));
  const rule = compileRule(c.rule, s, `${c.id}.rule`);
  const constraints = Object.entries(record(c.constraints ?? {}, `${c.id}.constraints`)).sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, r]): [string, Test] => [name, compileRule(r, s, `${c.id}.constraints.${name}`)]);
  for (const id of s.refs) if (!s.utils.has(id)) throw new Error(`${c.id}: matches refers to undefined util ${id}`);
  for (const [name] of constraints) if (!s.vars.has(name)) throw new Error(`${c.id}: constraint on undefined metavariable ${name}`);
  cycles(utils, c.id);
  s.indexed = !timedRegex([c.rule, c.constraints, utils]);
  // A timed regex can reject the whole search before another test rejects its kind.
  // Keep its original traversal, including failed alternatives and constraints.
  return { grammar: g, rule, constraints, ...(s.indexed && rule.kinds ? { kinds: rule.kinds } : {}) };
}

// A regex that gave up anywhere (even under a `not`) voids the whole search: the form names its line.
export function findAll(p: Parsed, c: Compiled, now: Clock): Match[] | Form {
  if (grammarOf(p.rel) !== c.grammar) throw new Error(`${p.rel}: patterns compiled for ${c.grammar}`);
  const found: Match[] = [];
  const inspect = (r: Rec): void => {
    const env = matchCore(r, c, now);
    if (env) found.push({ node: nativeNode(r), env: Object.fromEntries(Object.entries(env).map(([k, v]) => [k, nodes(v)])) });
  };
  const visit = (r: Rec): void => {
    inspect(r);
    for (const child of r.children) visit(child);
  };
  return search(p, c.kinds, inspect, visit) ?? found;
}

function search(p: Parsed, kinds: number[] | undefined, inspect: (r: Rec) => void, visit: (r: Rec) => void): Form | null {
  try {
    const root = tree(p);
    if (kinds) for (const r of candidates(root, kinds)) inspect(r);
    else visit(root);
    return null;
  } catch (e) {
    if (e instanceof GaveUp) return { cause: "regex-limit", line: nativeNode(e.at).startPosition.row + 1 };
    throw e;
  }
}

// Each candidate list is in the same pre-order as the complete traversal.
function candidates(root: Rec, kinds: number[]): Rec[] {
  let index = kindIndexes.get(root);
  if (!index) {
    index = [];
    const add = (n: Rec): void => {
      (index![n.kind] ??= []).push(n);
      for (const child of n.children) add(child);
    };
    add(root);
    kindIndexes.set(root, index);
  }
  return kinds.length === 1 ? index[kinds[0]!] ?? []
    : kinds.flatMap(kind => index![kind] ?? []).sort((a, b) => a.order - b.order);
}

class GaveUp {
  constructor(readonly at: Rec) {}
}

// Constraints check the single captures the rule bound, each against the env as it grows.
function matchCore(r: Rec, c: Compiled, now: Clock): Env | null {
  const bound = c.rule(r, {}, now);
  let env = bound;
  for (const [name, test] of c.constraints) {
    const v = bound?.[`$${name}`];
    if (env && v && !Array.isArray(v)) env = test(v as Rec, env, now);
  }
  return env;
}

function nodes(v: Rec | readonly Rec[]): Node | Node[] {
  return Array.isArray(v) ? v.map(nativeNode) : nativeNode(v as Rec);
}

function tree(p: Parsed): Rec {
  return trees.get(p) ?? walkedTree(p, p.root.walk());
}

function walkedTree(p: Parsed, cursor: TreeCursor): Rec {
  try {
    return buildTree(p, cursor);
  } finally {
    cursor.delete();   // see ts.astHash: only an explicit delete frees the right cursor
  }
}

function buildTree(p: Parsed, cursor: TreeCursor): Rec {
  let order = 0;
  const make = (parent: Rec | null): Rec => {
    const r: Rec = {
      node: parent === null ? p.root : null, src: p.text, kind: cursor.nodeTypeId, named: cursor.nodeIsNamed,
      extra: null, childIndex: parent?.children.length ?? 0,
      start: cursor.startIndex, end: cursor.endIndex, order: order++, parent, children: [], fields: null,
    };
    parent?.children.push(r);
    return r;
  };
  const root = make(null);
  let at = root;
  for (;;) {
    if (cursor.gotoFirstChild()) {
      at = make(at);
      continue;
    }
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) {
        trees.set(p, root);
        return root;
      }
      at = at.parent!;
    }
    at = make(at.parent);
  }
}

function nativeNode(r: Rec): Node {
  return r.node ??= nativeNode(r.parent!).child(r.childIndex)!;
}

function extra(r: Rec): boolean {
  return r.extra ??= nativeNode(r).isExtra;
}

function text(r: Rec): string {
  return r.src.slice(r.start, r.end);
}

// tree-sitter's child_by_field_id, which also resolves fields inherited through hidden nodes.
function fieldChild(r: Rec, field: number): Rec | null {
  const fields = r.fields ??= new Map<number, Rec | null>();
  if (!fields.has(field)) {
    const n = nativeNode(r).childForFieldId(field);
    fields.set(field, n ? r.children.find((c) => nativeNode(c).id === n.id) ?? null : null);
  }
  return fields.get(field)!;
}

function first<T>(items: readonly T[], f: (x: T) => Env | null): Env | null {
  for (const x of items) {
    const env = f(x);
    if (env) return env;
  }
  return null;
}

function preorder(r: Rec, f: (x: Rec) => Env | null): Env | null {
  return f(r) ?? first(r.children, (c) => preorder(c, f));
}

// ast-grep joins the keys with `all` in this order, which is the order in which metavariables bind:
// atomic keys, all, any, not, matches, relational. `not` binds nothing, so it runs last (O33) and
// still sees only the bindings made before its place: a node that the positive keys reject never
// pays for it. Otherwise a `not: { inside: { stopBy: end } }` beside `matches` climbs from every node.
function compileRule(raw: unknown, s: Scope, at: string): Test {
  const r = record(raw, at);
  const unknown = Object.keys(r).filter((k) => !RULE_KEYS.includes(k));
  if (unknown.length) throw new Error(`${at}: unknown key ${unknown.join(", ")}`);
  const head: Test[] = [];
  const tail: Test[] = [];
  if (r.pattern !== undefined) head.push(compilePatternText(str(r.pattern, `${at}.pattern`), s, `${at}.pattern`));
  if (r.kind !== undefined) head.push(kindTest(str(r.kind, `${at}.kind`), s, `${at}.kind`));
  if (r.regex !== undefined) head.push(regexTest(str(r.regex, `${at}.regex`), `${at}.regex`));
  if (r.nthChild !== undefined) head.push(nthChild(r.nthChild, s, `${at}.nthChild`));
  if (r.all !== undefined) head.push(allOf(list(r.all, `${at}.all`).map((x, i) => compileRule(x, s, `${at}.all[${i}]`))));
  if (r.any !== undefined) head.push(anyOf(list(r.any, `${at}.any`).map((x, i) => compileRule(x, s, `${at}.any[${i}]`))));
  const excluded = r.not === undefined ? null : compileRule(r.not, s, `${at}.not`);
  if (r.matches !== undefined) {
    const id = str(r.matches, `${at}.matches`);
    s.refs.push(id);
    // Utilities can refer to one declared later. Read the hint only after all utilities
    // are compiled and same-node cycles have been rejected.
    tail.push(Object.defineProperty((n: Rec, env: Env, now: Clock) => s.utils.get(id)!(n, env, now),
      "kinds", { get: () => s.utils.get(id)?.kinds }));
  }
  if (r.scope !== undefined) tail.push(scopeTest(str(r.scope, `${at}.scope`), `${at}.scope`));
  for (const key of ["inside", "has", "precedes", "follows"] as const) {
    if (r[key] !== undefined) tail.push(relation(key, r[key], s, `${at}.${key}`));
  }
  if (!head.length && !tail.length && !excluded) throw new Error(`${at}: a rule needs at least one matcher`);
  if (!excluded) return joined([...head, ...tail]);
  const [before, after] = [joined(head), joined(tail)];
  return Object.defineProperty((n: Rec, env: Env, now: Clock) => {
    const seen = before(n, env, now);
    const found = seen && after(n, seen, now);
    return found && !excluded(n, seen, now) ? found : null;
  }, "kinds", { get: () => before.kinds });
}

function requiredKey(raw: unknown, utils: Record<string, unknown>, seen = new Set<string>()): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const bare = typeof r.pattern === "string" ? metaVar(r.pattern.trim()) : null;
  if (bare?.name && !bare.multi) return `$${bare.name}`;
  for (const child of (r.all as unknown[] | undefined) ?? []) {
    const key = requiredKey(child, utils, new Set(seen));
    if (key) return key;
  }
  const descendant = requiredKey(r.has, utils, new Set(seen));
  if (descendant) return descendant;
  if (typeof r.matches === "string" && !seen.has(r.matches)) {
    const key = requiredKey(utils[r.matches], utils, new Set([...seen, r.matches]));
    if (key) return key;
  }
  const alternatives = (r.any as unknown[] | undefined)?.map(child => requiredKey(child, utils, new Set(seen)));
  return alternatives?.length && alternatives[0] && alternatives.every(key => key === alternatives[0]) ? alternatives[0] : null;
}

function queryHint(test: Test, raw: unknown, s: Scope): Test {
  const key = requiredKey(raw, s.rawUtils);
  if (!key) return test;
  const variables = new Set<string>(), seen = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [name, child] of Object.entries(value)) {
      if (name === "pattern" && typeof child === "string") for (const found of child.matchAll(/(\${1,3})([A-Z_][A-Z0-9_]*)/g)) {
        variables.add(`${found[1]!.length === 3 ? "$$$" : "$"}${found[2]}`);
      }
      if (name === "matches" && typeof child === "string" && !seen.has(child)) {
        seen.add(child); visit(s.rawUtils[child]);
      } else visit(child);
    }
  };
  visit(raw);
  test.query = { key, only: variables.size === 1 && variables.has(key) };
  return test;
}

function timedRegex(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return Object.entries(raw).some(([key, value]) => key === "regex" && typeof value === "string"
    ? regex(value, "query index").repeatsGroup : timedRegex(value));
}

// With a leaf input, same() requires equal text even for a non-leaf candidate.
// Index all nodes of that length; remaining captures retain the original traversal.
function boundNodes(n: Rec, env: Env, test: Test): Rec[] | null {
  const bound = test.query && env[test.query.key];
  if (!bound || Array.isArray(bound) || (bound as Rec).children.some(child => child.named)) return null;
  let root = n;
  while (root.parent) root = root.parent;
  const subject = text(bound as Rec), size = subject.length;
  let cached = textIndexes.get(root);
  if (!cached) {
    cached = { sizes: new Map(), words: new Map() };
    const add = (at: Rec): void => {
      const length = at.end - at.start, nodes = cached!.sizes.get(length) ?? [];
      nodes.push(at); cached!.sizes.set(length, nodes);
      for (const child of at.children) add(child);
    };
    add(root); textIndexes.set(root, cached);
  }
  let index = cached.words.get(size);
  if (!index) {
    index = new Map();
    for (const at of cached.sizes.get(size) ?? []) {
      const word = text(at), entries = index.get(word) ?? [];
      entries.push(at); index.set(word, entries);
    }
    cached.words.set(size, index);
  }
  return index.get(subject) ?? [];
}

function descendants(n: Rec, words: Rec[]): Rec[] {
  const found = new Set<Rec>();
  for (const word of words) {
    const path: Rec[] = [];
    let at: Rec | null = word;
    while (at && at !== n) { path.push(at); at = at.parent; }
    if (at === n) for (const item of path) found.add(item);
  }
  return [...found].sort((a, b) => a.order - b.order);
}

function reachable(n: Rec, candidate: Rec, stop: Stop, stops: Stops, now: Clock): boolean {
  if (stop === "neighbor") return candidate.parent === n;
  for (let at = candidate.parent; at && at !== n; at = at.parent) if (stops(at, now)) return false;
  return true;
}

function indexedSiblings(n: Rec, words: Rec[], forward: boolean): Rec[] {
  const parent = n.parent ?? n, children = parent.children, possible = new Set<Rec>();
  let low = 0, high = children.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (children[middle]!.end <= n.start) low = middle + 1;
    else high = middle;
  }
  const cutoff = children[low];
  if (!cutoff) return [];
  for (const word of words) {
    let at = word;
    while (at.parent && at.parent !== parent) at = at.parent;
    if (at.parent === parent && (forward ? at.order > cutoff.order : at.order < cutoff.order)) possible.add(at);
  }
  return [...possible].sort((a, b) => forward ? a.order - b.order : b.order - a.order);
}

function joined(tests: Test[]): Test {
  return tests.length === 1 ? tests[0]! : allOf(tests);
}

function allOf(tests: Test[]): Test {
  return Object.defineProperty((n: Rec, env: Env, now: Clock) => {
    let e: Env | null = env;
    for (const t of tests) if (!(e = t(n, e, now))) return null;
    return e;
  }, "kinds", { get: () => tests.find(t => t.kinds)?.kinds });
}

function anyOf(tests: Test[]): Test {
  return Object.defineProperty((n: Rec, env: Env, now: Clock) => first(tests, (t) => t(n, env, now)),
    "kinds", { get: () => tests.every(t => t.kinds) ? [...new Set(tests.flatMap(t => t.kinds!))] : undefined });
}

const SEMANTIC_KINDS: Record<string, Record<Grammar, string[]>> = {
  "@fn": {
    typescript: ["function_declaration", "generator_function_declaration", "function_expression", "generator_function", "arrow_function", "method_definition"],
    tsx: ["function_declaration", "generator_function_declaration", "function_expression", "generator_function", "arrow_function", "method_definition"],
    python: ["function_definition", "lambda"], go: ["function_declaration", "method_declaration", "func_literal"],
    rust: ["function_item", "function_signature_item", "closure_expression"],
  },
  "@call": {
    typescript: ["call_expression", "new_expression"], tsx: ["call_expression", "new_expression"],
    python: ["call"], go: ["call_expression"], rust: ["call_expression", "macro_invocation"],
  },
  "@import": {
    typescript: ["import_statement"], tsx: ["import_statement"],
    python: ["import_statement", "import_from_statement"], go: ["import_declaration", "import_spec"],
    rust: ["use_declaration", "extern_crate_declaration"],
  },
  "@loop": {
    typescript: ["for_statement", "for_in_statement", "while_statement", "do_statement"],
    tsx: ["for_statement", "for_in_statement", "while_statement", "do_statement"],
    python: ["for_statement", "while_statement"], go: ["for_statement"],
    rust: ["for_expression", "while_expression", "loop_expression"],
  },
  "@branch": {
    typescript: ["if_statement", "switch_statement", "ternary_expression"],
    tsx: ["if_statement", "switch_statement", "ternary_expression"],
    python: ["if_statement", "match_statement", "conditional_expression"],
    go: ["if_statement", "expression_switch_statement", "type_switch_statement", "select_statement"],
    rust: ["if_expression", "match_expression"],
  },
  "@class": {
    typescript: ["class_declaration", "abstract_class_declaration", "class"],
    tsx: ["class_declaration", "abstract_class_declaration", "class"],
    python: ["class_definition"], go: ["type_spec"],
    rust: ["struct_item", "enum_item", "trait_item", "impl_item"],
  },
  "@return": {
    typescript: ["return_statement"], tsx: ["return_statement"],
    python: ["return_statement"], go: ["return_statement"], rust: ["return_expression"],
  },
  "@throw": {
    typescript: ["throw_statement"], tsx: ["throw_statement"],
    python: ["raise_statement"], go: ["defer_statement"], rust: ["try_expression"],
  },
};
const SCOPES = new Set<ScopeKind>(["local", "module", "parameter", "unshadowed"]);

function kindTest(kind: string, s: Scope, at: string): Test {
  const lang = language(s.grammar);
  const names = SEMANTIC_KINDS[kind]?.[s.grammar] ?? [kind];
  const ids = names.map((name) => lang.idForNodeType(name, true)).filter((id): id is number => id !== null && id > 0);
  if (!ids.length) throw new Error(`${at}: unknown kind ${kind} in the ${s.grammar} grammar`);
  const set = new Set(ids);
  return Object.assign((n: Rec, env: Env) => (set.has(n.kind) ? env : null), { kinds: ids });
}

function scopeTest(raw: string, at: string): Test {
  if (!SCOPES.has(raw as ScopeKind)) throw new Error(`${at}: unknown scope ${raw}`);
  return (n, env) => (identifierScopeOf(nativeNode(n)) === raw ? env : null);
}

// nthChild counts named siblings (comments included), 1-based; ofRule filters them first.
function nthChild(raw: unknown, s: Scope, at: string): Test {
  const spec = typeof raw === "number" ? { position: raw } : record(raw, at);
  const keys = Object.keys(spec).filter((k) => !["position", "reverse", "ofRule"].includes(k));
  if (keys.length || !Number.isInteger(spec.position) || (spec.position as number) < 0
    || (spec.reverse !== undefined && typeof spec.reverse !== "boolean")) throw new Error(`${at}: invalid nthChild`);
  const position = spec.position as number;
  const of = spec.ofRule === undefined ? null : compileRule(spec.ofRule, s, `${at}.ofRule`);
  return (n, env, now) => {
    const siblings = n.parent?.children.filter((c) => c.named && (!of || of(c, env, now))) ?? [];
    if (spec.reverse) siblings.reverse();
    const i = siblings.indexOf(n);
    if (i < 0 || i + 1 !== position) return null;
    return of ? of(n, env, now) : env;
  };
}

function relation(key: "inside" | "has" | "precedes" | "follows", raw: unknown, s: Scope, at: string): Test {
  const r = record(raw, at);
  const relational = key === "inside" || key === "has";
  if (r.field !== undefined && !relational) throw new Error(`${at}: field is only supported in has and inside`);
  const rawInner = Object.fromEntries(Object.entries(r).filter(([k]) => k !== "field" && k !== "stopBy"));
  const inner = compileRule(rawInner, s, at);
  if (key !== "inside") queryHint(inner, rawInner, s);
  const field = r.field === undefined ? null : fieldId(str(r.field, `${at}.field`), s, `${at}.field`);
  const stop: Stop = r.stopBy === undefined || r.stopBy === "neighbor" ? "neighbor" : r.stopBy === "end" ? "end"
    : compileRule(r.stopBy, s, `${at}.stopBy`);
  const stops: Stops = (n, now) => typeof stop === "function" && stop(n, {}, now) !== null;
  const free = key === "has" && stop === "end" ? freeVariables(rawInner) : null;
  if (key === "has") return free === null ? has(inner, field, stop, stops, s) : once(has(inner, field, stop, stops, s), free);
  if (key === "inside") return inside(inner, field, stop, stops);
  return sibling(inner, key === "precedes", stop, stops, s);
}

// A rule that reads no metavariable gives `has` to the end of a node one answer for that node,
// whoever asks. `inside: { kind: program, stopBy: end, has: … }` asks the same question of the
// program from every candidate; without this, a 68,000-line bundle scans its whole tree once per
// call expression and one rule runs for minutes.
// The same holds when the rule binds metavariables that are still free where it runs: the answer,
// with the bindings it adds, depends on the node alone. A candidate that already carries one of them
// is asked directly. A utility, a scope or a `$$$` list is not analyzed here and is never remembered.
function freeVariables(raw: unknown): string[] | null {
  const source = JSON.stringify(raw);
  if (/"(?:matches|scope)"\s*:/.test(source) || source.includes("$$$")) return null;
  return [...new Set([...source.matchAll(/\$\$?([A-Z][A-Z0-9_]*)/g)].map((m) => `$${m[1]}`))];
}

function once(test: Test, variables: string[]): Test {
  const answers = new WeakMap<Rec, Env | null>();   // the bindings the test adds at a node, or null
  return (n, env, now) => {
    if (variables.some((name) => env[name] !== undefined)) return test(n, env, now);
    let added = answers.get(n);
    if (added === undefined) {
      const found = test(n, env, now);
      added = found === null ? null : Object.fromEntries(variables.flatMap((name) => found[name] === undefined ? [] : [[name, found[name]!]]));
      answers.set(n, added);
    }
    return added === null ? null : { ...env, ...added };
  };
}

function inside(inner: Test, field: number | null, stop: Stop, stops: Stops): Test {
  return (n, env, now) => {
    let last = n;
    for (let a = n.parent; a; a = a.parent) {
      const expected = last;
      last = a;
      const found = field !== null && fieldChild(a, field) !== expected ? null : inner(a, env, now);
      if (found || stop === "neighbor" || stops(a, now)) return found;
    }
    return null;
  };
}

// precedes (forward) and follows.
function sibling(inner: Test, forward: boolean, stop: Stop, stops: Stops, s: Scope): Test {
  return (n, env, now) => {
    if (stop === "neighbor") {
      const next = n.parent?.children[n.parent.children.indexOf(n) + (forward ? 1 : -1)];
      return next ? inner(next, env, now) : null;
    }
    const words = s.indexed && stop === "end" ? boundNodes(n, env, inner) : null;
    const siblings = words ? indexedSiblings(n, words, forward) : siblingsPast(n, forward);
    for (const sib of siblings) {
      const found = inner(sib, env, now);
      if (found || stops(sib, now)) return found;
    }
    return null;
  };
}

function has(inner: Test, field: number | null, stop: Stop, stops: Stops, s: Scope): Test {
  if (field !== null) {
    return (n, env, now) => {
      const child = fieldChild(n, field);
      if (!child) return null;
      if (stop === "neighbor") return inner(child, env, now);
      if (stop === "end") return preorder(child, (d) => inner(d, env, now));
      return inner(child, env, now) ?? (stops(child, now) ? null : first(child.children, (c) => inner(c, env, now)));
    };
  }
  if (stop === "neighbor") return (n, env, now) => first(n.children, (c) => inner(c, env, now));
  if (stop === "end") return (n, env, now) => first(n.children, (c) => preorder(c, (d) => inner(d, env, now)));
  const down: Test = (n, env, now) => first(n.children, (c) => inner(c, env, now) ?? (stops(c, now) ? null : down(c, env, now)));
  const memo = new WeakMap<Rec, Map<string, Rec | null>>();
  return (n, env, now) => {
    const words = s.indexed ? boundNodes(n, env, inner) : null;
    if (!words) return down(n, env, now);
    const key = inner.query!.key, subject = text(env[key] as Rec);
    let saved = memo.get(n);
    if (inner.query!.only && saved?.has(subject)) {
      const captured = saved.get(subject)!;
      return captured ? { ...env, [key]: captured } : null;
    }
    const found = first(descendants(n, words), candidate => reachable(n, candidate, stop, stops, now) ? inner(candidate, env, now) : null);
    if (inner.query!.only) {
      if (!saved) memo.set(n, saved = new Map());
      saved.set(subject, found ? found[key] as Rec : null);
    }
    return found;
  };
}

// ast-grep's next_all/prev_all: the siblings past the parent's first child that ends after this node
// starts (for the root, past its own first child), nearest first.
function siblingsPast(n: Rec, forward: boolean): Rec[] {
  const all = (n.parent ?? n).children;
  const i = all.findIndex((c) => c.end > n.start);
  return i < 0 ? [] : forward ? all.slice(i + 1) : all.slice(0, i).reverse();
}

function fieldId(name: string, s: Scope, at: string): number {
  const id = language(s.grammar).fieldIdForName(name);
  if (!id) throw new Error(`${at}: unknown field ${name} in the ${s.grammar} grammar`);
  return id;
}

function language(g: Grammar): Language {
  const cached = languages.get(g);
  if (cached) return cached;
  const parsed = parse(grammarPath(g), "");
  const lang = parsed.root.tree.language;
  parsed.root.tree.delete();
  languages.set(g, lang);
  return lang;
}

// Leading `(?i)`/`(?s)` become flags and `.` excludes only \n, as in Rust. What Rust's linear regex
// rejects (lookaround, backreferences, a `{` that is no counted repetition) and what JS would read
// differently (nested classes, set operations, other escapes) is an error, never a different match.
function regex(src: string, at: string): { re: RegExp; repeatsGroup: boolean } {
  const { source, flags, repeatsGroup, groups } = translate(src, at);
  if (repeatsGroup && groups > MAX_GROUPS) {
    throw new Error(`${at}: a regex with a repeated group can have at most ${MAX_GROUPS} groups, ${src} has ${groups}`);
  }
  return { re: compiledRegex(source, flags, src, at), repeatsGroup };
}

function compiledRegex(source: string, flags: string, src: string, at: string): RegExp {
  try {
    return new RegExp(source, flags);
  } catch {
    throw new Error(`${at}: invalid regex ${src}`);
  }
}

// Rust's syntax as the JS source and flags that read it the same, with what O27 needs to know.
function translate(src: string, at: string): { source: string; flags: string; repeatsGroup: boolean; groups: number } {
  const lead = /^\(\?([is]+)\)/.exec(src);
  const flags = lead?.[1] ?? "";
  const body = src.slice(lead?.[0].length ?? 0);
  let out = "";
  let inClass = false;
  let repeatsGroup = false;
  let groups = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    const rest = body.slice(i);
    if (c === "\\") {
      const escape = SAME_ESCAPE.exec(rest.slice(1))?.[0];
      if (!escape) throw new Error(`${at}: unsupported escape in ${src} (backreferences are not supported)`);
      out += c + escape;
      i += escape.length;
    } else if (inClass) {
      if (c === "[" || /^(&&|--|~~)/.test(rest)) throw new Error(`${at}: nested classes and set operations are not supported in ${src}`);
      inClass = c !== "]";
      out += c;
    } else if (c === "[") {
      const open = /^\[\^?\]?/.exec(rest)![0];   // a leading ] is literal in Rust and an empty class in JS
      out += open.endsWith("]") ? `${open.slice(0, -1)}\\]` : open;
      i += open.length - 1;
      inClass = true;
    } else if (/^\(\?(=|!|<=|<!)/.test(rest)) {
      throw new Error(`${at}: lookaround is not supported in ${src}`);
    } else if (c === "{" && !/^\{\d+(,\d*)?\}/.test(rest)) {
      throw new Error(`${at}: a literal { must be escaped in ${src}`);
    } else {
      repeatsGroup ||= /^\)[*+{]/.test(rest);
      groups += c === "(" ? 1 : 0;
      out += c !== "." ? c : flags.includes("s") ? "[^]" : "[^\\n]";
    }
  }
  return { source: out, flags: flags.replace("s", ""), repeatsGroup, groups };
}

// Only a regex with a repeated group can give up (SLOW_MS), and only its "no match" is in doubt.
// A regex over a node's text has one answer for that node. `inside: { stopBy: end, regex }` asks it of
// the same enclosing function or call from every node within; a bundle wrapped in one 1.9 MB call ran
// the expression over that text once per candidate. A short text is cheaper to test than to remember.
const REMEMBER_FROM = 2048;

function regexTest(src: string, at: string): Test {
  const { re, repeatsGroup } = regex(src, at);
  const answers = new WeakMap<Rec, boolean>();
  const remembered = (n: Rec, run: () => boolean): boolean => {
    if (n.end - n.start < REMEMBER_FROM) return run();
    let found = answers.get(n);
    if (found === undefined) answers.set(n, found = run());
    return found;
  };
  if (!repeatsGroup) return (n, env) => (remembered(n, () => re.test(text(n))) ? env : null);
  return (n, env, now) => {
    const matched = remembered(n, () => {
      const subject = text(n);
      const start = now();
      if (re.test(subject)) return true;
      if (subject.length > LONG || now() - start > SLOW_MS) throw new GaveUp(n);   // not remembered: it gives up again
      return false;
    });
    return matched ? env : null;
  };
}

function compilePatternText(src: string, s: Scope, at: string): Test {
  const root = tree(parse(grammarPath(s.grammar), src));
  if (!root.children.length) throw new Error(`${at}: empty pattern`);
  if (root.children.length > 1) throw new Error(`${at}: the pattern ${src} has more than one node`);
  if (nativeNode(root).hasError) throw new Error(`${at}: the pattern ${src} does not parse in the ${s.grammar} grammar`);
  let n = root;
  while (n.children.length === 1) n = n.children[0]!;
  const goal = toPattern(n, s);
  if ("var" in goal && goal.var.multi) throw new Error(`${at}: a pattern cannot be only ${src}`);
  return Object.assign((cand: Rec, env: Env) => {
    if (!("var" in goal) && goal.kind !== cand.kind) return null;
    if ("var" in goal && goal.var.named && !cand.named) return null;
    const agg = { env };
    const ok = "var" in goal ? bindVar(goal.var, cand, agg) : matchNode(goal, cand, agg) === "both";
    return ok ? agg.env : null;
  }, { kinds: "var" in goal ? undefined : [goal.kind] });
}

function toPattern(r: Rec, s: Scope): PNode {
  const v = metaVar(text(r));
  if (v) {
    if (v.name) s.vars.add(v.name);
    return { var: v };
  }
  if (!r.children.length) return { leaf: text(r), named: r.named, kind: r.kind };
  return { kind: r.kind, children: r.children.map((c) => toPattern(c, s)) };
}

// $A (named node), $$A (any node), $_ (ignored), $$$ and $$$A (a list); names are [A-Z_][A-Z0-9_]*.
function metaVar(t: string): MetaVar | null {
  const m = /^(\$\$\$|\$\$|\$)([A-Z_][A-Z0-9_]*)?$/.exec(t);
  if (!m || (m[1] !== "$$$" && m[2] === undefined)) return null;
  const name = m[2] === undefined || m[2].startsWith("_") ? null : m[2];
  return { name, multi: m[1] === "$$$", named: m[1] === "$" };
}

type Agg = { env: Env };
type One = "both" | "skip" | "no";   // MatchedBoth, SkipCandidate, NoMatch

function matchNode(goal: PNode, cand: Rec, agg: Agg): One {
  if ("var" in goal) return extra(cand) ? "skip" : bindVar(goal.var, cand, agg) ? "both" : "no";
  const kindOk = goal.kind === cand.kind;
  if ("leaf" in goal) {
    if (kindOk && (!goal.named || goal.leaf === text(cand))) return "both";
    return extra(cand) || !cand.named ? "skip" : "no";
  }
  return kindOk && matchChildren(goal.children, cand.children, agg) ? "both" : "no";
}

function matchChildren(goals: PNode[], cands: Rec[], agg: Agg): boolean {
  const at = { g: 0, c: 0 };
  if (!cands.length) return false;
  for (;;) {
    const ellipsis = matchEllipsis(goals, cands, at, agg);
    if (ellipsis === "fail") return false;
    if (ellipsis === "done") return true;
    if (ellipsis === "next") continue;
    if (!matchOne(goals, cands, at, agg)) return false;
    if (at.g < goals.length) {
      at.g++;
      at.c++;
    }
    if (at.g >= goals.length) return true;   // smart strictness skips any trailing candidates
    if (at.c >= cands.length) return false;
  }
}

function ellipsisOf(goal: PNode | undefined): MetaVar | null {
  return goal && "var" in goal && goal.var.multi ? goal.var : null;
}

function trivial(goal: PNode | undefined): boolean {
  return goal !== undefined && "leaf" in goal && !goal.named;
}

function matchEllipsis(goals: PNode[], cands: Rec[], at: { g: number; c: number }, agg: Agg): "fail" | "done" | "next" | "on" {
  if (at.g >= goals.length) return "done";
  const v = ellipsisOf(goals[at.g]);
  if (!v) return "on";
  const matched: Rec[] = [];
  at.g++;
  let skipped = 0;
  while (trivial(goals[at.g])) {
    at.g++;
    skipped++;
  }
  if (at.g >= goals.length) {
    matched.push(...cands.slice(at.c));
    at.c = cands.length;
    return bindList(v, matched, skipped, agg) ? "done" : "fail";
  }
  if (ellipsisOf(goals[at.g])) {
    matched.push(cands[at.c++]!);
    return at.c < cands.length && bindList(v, matched, skipped, agg) ? "next" : "fail";
  }
  for (;;) {
    if (matchNode(goals[at.g]!, cands[at.c]!, { env: agg.env }) === "both") return bindList(v, matched, skipped, agg) ? "on" : "fail";
    matched.push(cands[at.c++]!);
    if (at.c >= cands.length) return "fail";
  }
}

function matchOne(goals: PNode[], cands: Rec[], at: { g: number; c: number }, agg: Agg): boolean {
  for (;;) {
    if (at.c >= cands.length) {
      while (ellipsisOf(goals[at.g])) at.g++;
      return at.g >= goals.length;
    }
    const one = matchNode(goals[at.g]!, cands[at.c]!, agg);
    if (one === "both") return true;
    if (one === "no") return false;
    at.c++;
  }
}

function bindVar(v: MetaVar, cand: Rec, agg: Agg): boolean {
  if (v.named && !v.multi && !cand.named) return false;
  if (!v.name) return true;
  return v.multi ? bindList(v, [cand], 0, agg) : bind(`$${v.name}`, cand, agg);
}

// A list drops the anonymous tokens that closed it (`)`, `]`) when they were skipped in the goal.
function bindList(v: MetaVar, matched: Rec[], skipped: number, agg: Agg): boolean {
  if (!v.name) return true;
  const list = matched.slice(0, Math.max(0, matched.length - skipped));
  const key = `$$$${v.name}`;
  const prev = agg.env[key] as readonly Rec[] | undefined;
  if (prev) {
    const [a, b] = [prev.filter((r) => r.named), list.filter((r) => r.named)];
    if (a.length !== b.length || a.some((r, i) => !same(r, b[i]!))) return false;
  }
  agg.env = { ...agg.env, [key]: list };
  return true;
}

// A consistent rebinding moves the metavariable to the newer node, as ast-grep's env does.
function bind(key: string, cand: Rec, agg: Agg): boolean {
  const prev = agg.env[key] as Rec | undefined;
  if (prev && !same(prev, cand)) return false;
  agg.env = { ...agg.env, [key]: cand };
  return true;
}

// A repeated metavariable matches the same code: same node, or same text for a node without named
// children, or same kind with matching children.
function same(a: Rec, b: Rec): boolean {
  if (nativeNode(a).id === nativeNode(b).id) return true;
  if (!a.children.some((c) => c.named) || !b.children.some((c) => c.named)) return text(a) === text(b);
  return a.kind === b.kind && a.children.length === b.children.length && a.children.every((c, i) => same(c, b.children[i]!));
}

function cycles(utils: Record<string, unknown>, id: string): void {
  // Composite keys recurse on the same node, and so does nthChild.ofRule (the node is among its own
  // siblings); has/inside/… always move.
  const deps = (raw: unknown): string[] => {
    const r = raw as Record<string, unknown>;
    const nth = r.nthChild as { ofRule?: unknown } | undefined;
    const nested = [...((r.all as unknown[]) ?? []), ...((r.any as unknown[]) ?? []), ...(r.not ? [r.not] : []), ...(nth?.ofRule ? [nth.ofRule] : [])];
    return [...(typeof r.matches === "string" ? [r.matches] : []), ...nested.flatMap(deps)];
  };
  const done = new Set<string>();
  const visit = (name: string, path: string[]): void => {
    if (path.includes(name)) throw new Error(`${id}: util ${name} refers to itself through ${path.join(" > ")}`);
    if (done.has(name) || !(name in utils)) return;
    for (const d of deps(utils[name])) visit(d, [...path, name]);
    done.add(name);
  };
  for (const name of Object.keys(utils)) visit(name, []);
}

function record(v: unknown, at: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`${at}: expected an object`);
  return v as Record<string, unknown>;
}

function list(v: unknown, at: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${at}: expected an array`);
  return v;
}

function str(v: unknown, at: string): string {
  if (typeof v !== "string") throw new Error(`${at}: expected a string`);
  return v;
}
