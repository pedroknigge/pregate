// Class `extends` hops that stay inside project TypeScript. A qualified name (`React.Component`),
// a call (`mixin(A)`), an unresolved name, or a default import stops at 1: the library base is
// not walked, and a name this file does not define is not guessed.
import { loadTsPaths, resolve } from "./resolve.ts";
import { grammarOf, parse, symbolOf, type Node, type Parsed } from "./ts.ts";
import type { Read } from "./types.ts";

const CLASS_KINDS = ["class_declaration", "abstract_class_declaration"];
const MAX_HOPS = 8;
const MAX_FILES = 32;

interface ClassFact { name: string; symbol: string; line: number; parent: { kind: "none" } | { kind: "stop" } | { kind: "name"; name: string } }
interface Binding { local: string; remote: string; spec: string }
interface Loaded { classes: ClassFact[]; imports: Binding[] }
interface HeritageHit { symbol: string; line: number; measured: number; own: null }

export function heritageDepths(parsed: Parsed, read: Read): HeritageHit[] {
  const grammar = grammarOf(parsed.rel);
  if (grammar !== "typescript" && grammar !== "tsx") return [];
  const ts = loadTsPaths(read, parsed.rel);
  const cache = new Map<string, Loaded>();
  const load = (rel: string): Loaded => {
    const hit = cache.get(rel);
    if (hit) return hit;
    if (cache.size >= MAX_FILES && rel !== parsed.rel) return { classes: [], imports: [] };
    if (rel === parsed.rel) {
      const loaded = facts(parsed);
      cache.set(rel, loaded);
      return loaded;
    }
    const text = read(rel);
    if (text === null) {
      const empty = { classes: [], imports: [] };
      cache.set(rel, empty);
      return empty;
    }
    const tree = parse(rel, text);
    try {
      const loaded = facts(tree);
      cache.set(rel, loaded);
      return loaded;
    } finally {
      tree.root.tree.delete();
    }
  };
  const depth = (rel: string, name: string, stack: string[]): number => {
    const key = `${rel}\0${name}`;
    if (stack.includes(key) || stack.length >= MAX_HOPS) return 0;
    const cls = load(rel).classes.find((item) => item.name === name);
    if (!cls || cls.parent.kind === "none") return 0;
    if (cls.parent.kind === "stop") return 1;
    const next = [...stack, key];
    const parent = cls.parent.name;
    if (load(rel).classes.some((item) => item.name === parent)) return 1 + depth(rel, parent, next);
    const bound = load(rel).imports.find((item) => item.local === parent);
    if (!bound) return 1;
    const to = resolve(rel, bound.spec, rel === parsed.rel ? ts : loadTsPaths(read, rel), read);
    if (typeof to !== "object") return 1;
    const targetGrammar = grammarOf(to.rel);
    if (targetGrammar !== "typescript" && targetGrammar !== "tsx") return 1;
    return load(to.rel).classes.some((item) => item.name === bound.remote) ? 1 + depth(to.rel, bound.remote, next) : 1;
  };
  return load(parsed.rel).classes.flatMap((cls) => {
    if (cls.parent.kind === "none") return [];
    return [{ symbol: cls.symbol, line: cls.line, measured: depth(parsed.rel, cls.name, []), own: null }];
  });
}

function facts(parsed: Parsed): Loaded {
  return { classes: classFacts(parsed), imports: importBindings(parsed) };
}

function classFacts(parsed: Parsed): ClassFact[] {
  return named(parsed.root, CLASS_KINDS).flatMap((cls) => {
    const name = cls.childForFieldName("name")?.text;
    if (!name) return [];
    const heritage = cls.namedChildren.find((child) => child.type === "class_heritage");
    const clause = heritage?.namedChildren.find((child) => child.type === "extends_clause");
    const value = clause?.namedChildren.find((child) => child.type !== "type_arguments");
    const parent = value === undefined ? { kind: "none" as const }
      : value.type === "identifier" ? { kind: "name" as const, name: value.text }
      : { kind: "stop" as const };
    return [{ name, symbol: symbolOf(cls), line: cls.startPosition.row + 1, parent }];
  });
}

function importBindings(parsed: Parsed): Binding[] {
  return named(parsed.root, ["import_statement"]).flatMap((stmt) => {
    const spec = stmt.childForFieldName("source")?.text.slice(1, -1);
    if (!spec) return [];
    return named(stmt, ["import_specifier"]).flatMap((item) => {
      const ids = item.namedChildren.filter((child) => child.type === "identifier");
      const remote = ids[0]?.text;
      const local = ids.at(-1)?.text;
      return remote && local ? [{ local, remote, spec }] : [];
    });
  });
}

function named(node: Node, kinds: string[]): Node[] {
  return node.descendantsOfType(kinds).filter((child) => child.isNamed);
}
