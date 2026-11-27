import { analyze, isImportRule } from "./evaluate.ts";
import { inScope, ruleApplies } from "./paths.ts";
import { introduced } from "./ratchet.ts";
import { loadTsPaths, reexportTargets, resolve } from "./resolve.ts";
import { astHash, grammarOf, imports, parse, type Parsed } from "./ts.ts";
import { enforcementOf } from "./enforcement.ts";
import { languageApplies } from "./languages.ts";
import { rustResolutionKey } from "./rust-facts.ts";
import type { BaselineRead, Clock, Form, ImportFacts, ImportsOf, Lock, Phase, Read, Violation } from "./types.ts";

export interface DependencyReview { rel: string; violations: Violation[]; form: Form | null; astHash: string | null }
export interface DependencyGraph {
  fingerprint(text: string): string;
  lookup(path: string, text: string, context: string, hash: (path: string) => string | null, identity?: (path: string) => string): { inputs: { path: string; identity: string }[] } | null;
  remember(path: string, text: string, context: string, inputs: Map<string, string | null>, identity?: (path: string) => string): void;
  prune(paths: Set<string>): void;
  save(): void;
}
interface DependencyContext { lock: Lock; phase: Phase; changed: Set<string>; read: Read; before: BaselineRead; now: Clock; importsOf?: ImportsOf; identity?: (rel: string) => string;
  cache?: DependencyGraph; inputHash?: (rel: string) => string | null; cacheContext?: string;
  ruleProgress?: <T>(rule: string, run: () => T) => T; resolutionProgress?: <T>(run: () => T) => T }

// Shadow/warn importer observations belong to audit/commit/CI, not a global
// parse on an interactive edit. Direct-file observations still use analyze.
export function dependencyRules(lock: Lock, phase: Phase): Lock["rules"] {
  const interactive = phase === "pre" || phase === "stop";
  return lock.rules.filter(rule => isImportRule(rule) && rule.phases.includes(phase)
    && (!interactive || (enforcementOf(lock, rule) === "enforce" && rule.severity !== "warn")));
}

export function needsDependencyReview(lock: Lock, phase: Phase, changed: Set<string>): boolean {
  return changed.size > 0 && dependencyRules(lock, phase).length > 0;
}

// A changed dependency/config can alter an unchanged importer's meaning. Track actual resolver
// reads; only affected importers are judged, against their own baseline context.
export function dependencyReviews(paths: string[] | (() => string[]), context: DependencyContext): DependencyReview[] {
  const { lock, changed } = context;
  if (!needsDependencyReview(lock, context.phase, changed)) return [];
  const imports = { ...lock, rules: dependencyRules(lock, context.phase) };
  const identities = new Map<string, string>();
  const identity = context.identity === undefined ? undefined : (rel: string): string => {
    if (identities.has(rel)) return identities.get(rel)!;
    const actual = context.identity!(rel);
    if (identities.size < 8192) identities.set(rel, actual);
    return actual;
  };
  const shared = { ...context, lock: imports, read: memoizedRead(context.read), before: memoizedRead(context.before), importsOf: context.importsOf ?? memoizedImports(), identity,
    cacheContext: context.cache?.fingerprint(JSON.stringify([context.phase, imports])) };
  const hashes = new Map<string, string | null>();
  shared.inputHash = rel => {
    if (hashes.has(rel)) return hashes.get(rel)!;
    const text = shared.read(rel), hash = text === null ? null : context.cache!.fingerprint(text);
    if (hashes.size < 65536) hashes.set(rel, hash);
    return hash;
  };
  shared.changed = new Set([...changed].filter(rel => changesResolution(rel, shared)));
  if (!shared.changed.size) return [];
  const inventory = typeof paths === "function" ? paths() : paths;
  const selected = inventory.filter((rel) => !changed.has(rel) && inScope(lock, rel) && grammarOf(rel) !== null && imports.rules.some(rule => ruleApplies(rule, rel) && languageApplies(rule, rel)));
  context.cache?.prune(new Set(selected));
  const affected = selected.flatMap(rel => {
    const text = shared.read(rel);
    return text !== null && dependencyAffected(rel, text, shared) ? [{ rel, text }] : [];
  });
  const cause = affected.length ? context.before.prime?.(affected.map(({ rel }) => rel)) : undefined;
  const reviews = cause ? affected.map(({ rel }) => ({ rel, violations: [], form: { cause, line: null }, astHash: null }))
    : affected.flatMap(({ rel, text }) => dependencyReview(rel, text, shared));
  context.cache?.save();
  return reviews;
}

// Import policies use target paths, parser validity and re-export edges, not a
// target's function bodies or ordinary imports. Changed files still receive the
// complete direct-file review. Creation, deletion and resolver configs retain a sweep.
// The contract pair is Pregate's own: no resolver reads it and no query depends on it. A change
// to it alone must not send every importer in the tree through a review that can find nothing.
const CONTRACT: ReadonlySet<string> = new Set([".pregate/preset.json", ".pregate/pregate.lock.json"]);

function changesResolution(rel: string, context: DependencyContext): boolean {
  if (CONTRACT.has(rel)) return false;
  // Removing a schema's uniqueness constraint can unbound an unchanged query.
  if (schemaRules(context.lock).length) return context.read(rel) !== context.before(rel);
  const grammar = grammarOf(rel);
  if (grammar === null) return true;
  const current = context.read(rel), before = context.before(rel);
  if (current === null || before === null) return current !== before;
  // An extends file can have any extension. A JSON object can also be valid code
  // (for example an empty block); never prune a possible resolver configuration.
  const config = (text: string): boolean => {
    try { const value: unknown = Bun.JSONC.parse(text); return value !== null && typeof value === "object" && !Array.isArray(value); }
    catch (error) { if (error instanceof SyntaxError) return false; throw error; }
  };
  if (config(current) || config(before)) return true;
  const after = context.importsOf!(rel, current), old = context.importsOf!(rel, before);
  if (after.hasError || old.hasError) return true;
  if (grammar === "rust") return after.resolutionKey !== old.resolutionKey;
  const edges = (facts: ImportFacts) => facts.imports.filter(edge => edge.kind === "reexport" || (grammar === "python" && edge.kind === "dynamic"))
    .map(({ line: _, ...edge }) => edge);
  return JSON.stringify(edges(after)) !== JSON.stringify(edges(old));
}

// One operation owns these facts. Current and baseline bytes share a parsed fact
// only when grammar and complete text agree; no tree or verdict is retained.
export type ImportMemo = ImportsOf & { remember(parsed: Parsed): void };
export function memoizedImports(): ImportMemo {
  const facts = new Map<string, ImportFacts>();
  let bytes = 0;
  const keyOf = (rel: string, text: string): string => {
    const g = grammarOf(rel);
    const scope = g === "rust" ? rel : g === "python" && /(^|\/)__init__\.py$/i.test(rel) ? "python:init" : g ?? rel;
    return `${scope}\0${text}`;
  };
  const remember = (parsed: Parsed): ImportFacts => {
    const key = keyOf(parsed.rel, parsed.text), old = facts.get(key);
    if (old) return old;
    const found: ImportFacts = { hasError: parsed.root.hasError, imports: imports(parsed), ...(grammarOf(parsed.rel) === "rust" ? { resolutionKey: rustResolutionKey(parsed) } : {}) };
    if (facts.size < 8192 && bytes + key.length * 2 <= 32 * 1024 * 1024) { facts.set(key, found); bytes += key.length * 2; }
    return found;
  };
  return Object.assign((rel: string, text: string): ImportFacts => {
    const key = keyOf(rel, text);
    const old = facts.get(key);
    if (old) return old;
    return withTree(parse(rel, text), remember);
  }, { remember });
}

function withTree<T>(parsed: Parsed, use: (parsed: Parsed) => T): T {
  try { return use(parsed); }
  finally { parsed.root.tree.delete(); }
}

function memoizedRead(read: Read): Read {
  const values = new Map<string, string | null>();
  let bytes = 0;
  return rel => {
    if (values.has(rel)) return values.get(rel)!;
    const value = read(rel), size = (value?.length ?? 0) * 2 + rel.length * 2;
    if (values.size < 8192 && bytes + size <= 32 * 1024 * 1024) { values.set(rel, value); bytes += size; }
    return value;
  };
}

function dependencyReview(rel: string, text: string, context: DependencyContext): DependencyReview[] {
  const { lock, phase, read, before, now, importsOf, ruleProgress, resolutionProgress } = context;
  const progress = { ruleProgress, resolutionProgress }, old = before(rel);
  if (!schemaRules(lock).length && importsOf) {
    const stub: Parsed = { rel, text, root: null as never };
    const after = analyze(lock, phase, rel, stub, { read, now, hash: false, importsOf, ...progress });
    if ("cause" in after) return [{ rel, violations: [], form: after, astHash: null }];
    const base = old === null ? null : analyze(lock, phase, rel, { rel, text: old, root: null as never }, { read: before, now, hash: false, importsOf, ...progress });
    const violations = introduced(lock, rel, base === null || "cause" in base ? null : base, after);
    return [{ rel, violations, form: null, astHash: violations.length ? astHash(stub) : null }];
  }
  return withTree(parse(rel, text), (parsed): DependencyReview[] => {
    const after = analyze(lock, phase, rel, parsed, { read, now, hash: false, importsOf, ...progress });
    const base = old === null ? null : old === text
      ? analyze(lock, phase, rel, parsed, { read: before, now, hash: false, importsOf, ...progress })
      : withTree(parse(rel, old), tree => analyze(lock, phase, rel, tree, { read: before, now, hash: false, importsOf, ...progress }));
    if ("cause" in after) return [{ rel, violations: [], form: after, astHash: null }];
    const violations = introduced(lock, rel, base === null || "cause" in base ? null : base, after);
    return [{ rel, violations, form: null, astHash: violations.length ? astHash(parsed) : null }];
  });
}

function dependencyAffected(rel: string, text: string, context: DependencyContext): boolean {
  const { lock, phase, changed, read, now, importsOf, identity, cache, inputHash, cacheContext, ruleProgress, resolutionProgress } = context;
  const cached = cache?.lookup(rel, text, cacheContext!, inputHash!, identity);
  if (cached) return cached.inputs.some(input => changed.has(input.path) || changed.has(input.identity));
  const grammar = grammarOf(rel);
  // A plain export declaration reads no dependency. Re-exports also need `from`;
  // comments/strings can keep a candidate, but the parser still decides its meaning.
  let affected = false;
  const inputs = new Map<string, string | null>();
  const current: Read = path => {
    if (changed.has(path) || (identity !== undefined && changed.has(identity(path)))) affected = true;
    const text = read(path);
    if (cache) inputs.set(path, text === null ? null : inputHash!(path));
    return text;
  };
  const inspect = () => {
    if (grammar === "rust" ? /\b(use|mod|extern|include|crate|self|super|std|core|alloc)\b/.test(text)
      : /\b(import|require|__import__)\b|importlib\.import_module\b/.test(text) || (/\bexport\b/.test(text) && /\bfrom\b/.test(text))) {
      const ts = grammar === "typescript" || grammar === "tsx" ? loadTsPaths(current) : null;
      for (const imp of importsOf!(rel, text).imports.filter((i) => i.literal)) {
        const target = resolve(rel, imp.spec, ts, current, imp.base);
        if (typeof target === "object") reexportTargets(target.rel, ts, current, importsOf);
      }
    }
    // Schema analysis can read additional imported definitions. Capture those
    // reads too; its result is discarded and every affected verdict is fresh.
    const rules = schemaRules(lock);
    if (rules.length) {
      withTree(parse(rel, text), parsed => analyze({ ...lock, rules }, phase, rel, parsed, { read: current, now, hash: false, importsOf, ...{ ruleProgress, resolutionProgress } }));
    }
  };
  if (resolutionProgress) resolutionProgress(inspect); else inspect();
  cache?.remember(rel, text, cacheContext!, inputs, identity);
  return affected;
}

function schemaRules(lock: Lock): Lock["rules"] {
  return lock.rules.filter(rule => rule.impl.kind === "primitive" && rule.impl.primitive === "drizzle-bounded-select");
}
