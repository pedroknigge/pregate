// The rules of the lock over one file in one state (ARCHITECTURE §6.3): patterns, metrics, imports
// and the counts the diff rules compare; placement() parses only a possible generated marker.
import { compilePattern, type Compiled, findAll } from "./match.ts";
import { inScope, layerOf, matches, REQUESTS, ruleApplies as applies } from "./paths.ts";
import { type Edge, loadTsPaths, reexportTargets, resolve } from "./resolve.ts";
import { astHash, classes, functions, grammarOf, imports, metricBodies, nestings, type Node, type Parsed, parse, suggestFunctionSplit, suggestNestingFix, symbolBodies, symbolOf, symbols } from "./ts.ts";
import type { Analysis, Clock, Form, Grammar, Host, Impl, Lock, LockRule, PatternConfig, Phase, Placement, Read, Violation } from "./types.ts";
import { languageApplies } from "./languages.ts";
import { markerLocations } from "./markers.ts";
import { unboundedDrizzleSelects } from "./drizzle-query.ts";
import { intervalsWithoutCleanup } from "./interval-cleanup.ts";
import { reactIndexKeys } from "./react-index-key.ts";
import { credentialLiterals } from "./credential-literal.ts";

const MODULE = "<module>";
const TSCONFIG_INVALID = "tsconfig.json, or a local config it extends, is missing or invalid, so a bare import may be an alias of any path. Fix the tsconfig, or import by a relative path.";
const compiled = new WeakMap<PatternConfig, Partial<Record<Grammar, Compiled>>>();

// state null: the file does not exist in this state; only the diff rules have something to count
// (0). A caller that already parsed the text hands over its Parsed, so the file is parsed once.
// `host.now` times the regexes that can give up (match.ts).
export function analyze(lock: Lock, phase: Phase, rel: string, state: string | Parsed | null, host: Host): Analysis | Form {
  const rules = inScope(lock, rel) ? running(lock, phase, rel) : [];
  const p = typeof state !== "string" ? state : grammarOf(rel) !== null ? parse(rel, state) : null;
  const text = typeof state === "string" ? state : state?.text ?? null;
  // Body hashes before any nested parse. A later parse on this grammar drops the live tree.
  const ownedBodies = p?.root ? symbolBodies(p) : {};
  const found: Violation[] = [];
  const counts: Record<string, number> = {};
  const markerSites: NonNullable<Analysis["markerSites"]> = {};
  const report = (r: LockRule, line: number, symbol: string, measured: number | null = null, limit: number | null = null): Violation => {
    const v: Violation = { rule: r.id, path: rel, line, symbol, measured, limit, atSessionStart: null, severity: r.severity };
    found.push(v);
    return v;
  };
  const measurements: Measurements = { report };
  for (const r of rules) {
    const impl = r.impl;
    if (impl.kind === "primitive" && !["diff", "metric", "drizzle-bounded-select", "interval-cleanup", "react-index-key", "credential-literal"].includes(impl.primitive)) continue;
    const form = ruleProgress(host, r, (): Form | null => {
      if (impl.kind === "pattern") {
        const g = grammarOf(rel);
        const form = p && g && matched(r, impl.patterns[g === "tsx" ? "typescript" : g] ?? [], p, host.now, report);
        if (form) return form;
      } else if (impl.primitive === "diff") {
        const sites = impl.count === "markers" && text !== null ? markerLocations(rel, text, r.params.markers as string[], p, lock.generatedMarkers) : [];
        const n = impl.count === "markers" ? sites.length : count(impl.count, p, host.now);
        if (typeof n !== "number") return n;
        counts[r.id] = n;
        if (impl.count === "markers" && text !== null) markerSites[r.id] = sites;
      } else if (p) measureRule(r, p, host, measurements);
      return null;
    });
    if (form) return form;
  }
  const importRules = rules.filter(r => isImportRule(r) && !(r.impl.kind === "primitive" && r.impl.primitive === "drizzle-bounded-select"));
  const form = p && importRules.length ? checkImports(lock, p, importRules, host, report) : null;
  if (form) return form;
  const named = rules.some((r) => r.impl.kind === "pattern" || ["metric", "drizzle-bounded-select", "interval-cleanup", "react-index-key", "credential-literal"].includes(r.impl.primitive));
  // Every match stays, even several on one line: the ratchet counts them; introduced() reports one per line.
  const measured = new Set(found.filter((v) => v.measured !== null).map((v) => `${v.symbol}\0${v.line}`));
  return { symbols: p ? (named ? symbols(p) : [MODULE]) : [], violations: found, counts, markerSites,
    metricBodies: p && measured.size > 0 ? metricBodies(p, measured) : {}, symbolBodies: ownedBodies,
    astHash: p && host.hash !== false ? astHash(p) : null };
}

interface Measurements { report: Report; functions?: ReturnType<typeof functions> }

// fn.lines and fn.params share one fact pass; node primitives report their own sites.
function measureRule(rule: LockRule, parsed: Parsed, host: Host, measurements: Measurements): void {
  const impl = rule.impl;
  if (impl.kind !== "primitive") return;
  const { report } = measurements;
  if (impl.primitive === "metric") {
    if (impl.metric === "control.nesting") metric(rule, nestings(parsed), report, (line) => suggestNestingFix(parsed, line));
    else if (impl.metric === "class.publicMethods") metric(rule, classes(parsed).map(c => ({ ...c, measured: c.publicMethods, own: null })), report);
    else metric(rule, owned(measurements.functions ??= functions(parsed)).map(f => ({ ...f, measured: impl.metric === "fn.lines" ? f.lines : f.params })), report, impl.metric === "fn.lines" ? (line, max) => suggestFunctionSplit(parsed, line, max) : undefined);
    return;
  }
  const nodes = impl.primitive === "drizzle-bounded-select" ? unboundedDrizzleSelects(parsed, host)
    : impl.primitive === "interval-cleanup" ? intervalsWithoutCleanup(parsed)
    : impl.primitive === "react-index-key" ? reactIndexKeys(parsed)
    : impl.primitive === "credential-literal" ? credentialLiterals(parsed) : [];
  for (const node of nodes) report(rule, node.startPosition.row + 1, symbolOf(node));
}

// Rules whose findings depend on other files, for unchanged-importer review.
export function isImportRule(r: LockRule): boolean {
  return r.impl.kind === "primitive" && ["layer-edge", "banned-import", "drizzle-bounded-select"].includes(r.impl.primitive);
}

// created: the file did not exist before this change; current: its content before it (null if new).
// A file without a grammar inside a layer escapes only when it is code: params.extensions lists the
// languages, "" standing for no extension (O34); a stylesheet, a README or an image is not denied.
export function placement(lock: Lock, phase: Phase, rel: string, created: boolean, current: string | null): Violation[] {
  // Request drafts are the agent-writable exception under a protected, usually excluded, .pregate/.
  if (matches(REQUESTS, rel)) return [];
  const excluded = lock.scope.exclude.some((glob) => matches(glob, rel));
  const grammar = grammarOf(rel);
  const foreign = grammar === "python" || grammar === "go" || grammar === "rust";
  const covered = lock.rules.some((r) => (r.impl.kind === "pattern" || (r.impl.kind === "primitive" && ["metric", "layer-edge", "banned-import", "drizzle-bounded-select", "interval-cleanup", "react-index-key", "credential-literal"].includes(r.impl.primitive)))
    && languageApplies(r, rel) && applies(r, rel));
  const unparsed = layerOf(lock, rel) !== null && (grammar === null || (foreign && !covered));
  const ext = /\.([^./]+)$/.exec(rel)?.[1]?.toLowerCase() ?? "";
  const generated = !created && !excluded && current !== null
    && markerLocations(rel, current, lock.generatedMarkers, null, lock.generatedMarkers).length > 0;
  const hit = (r: LockRule, c: Placement): boolean => c === "new-in-exclude" ? created && excluded
    : c === "edit-generated-or-excluded" ? !created && (excluded || generated)
    : unparsed && (r.params.extensions as string[]).includes(ext);
  return running(lock, phase, rel).flatMap((r) => r.impl.kind === "primitive" && r.impl.primitive === "placement"
    && r.impl.cases.some((c) => hit(r, c))
    ? [{ rule: r.id, path: rel, line: 1, symbol: MODULE, measured: null, limit: null, atSessionStart: null, severity: r.severity }]
    : []);
}

// The rules that run on `rel` in this phase: PREGATE's, not ArkGate's, and whose paths take it in.
function running(lock: Lock, phase: Phase, rel: string): LockRule[] {
  return lock.rules.filter((r) => r.phases.includes(phase) && !lock.ownedByArkgate.includes(r.id) && applies(r, rel) && languageApplies(r, rel));
}

// Reports every match of a pattern rule except those `params.allow` declares pure; a regex that gave
// up voids the whole search.
function matched(r: LockRule, configs: PatternConfig[], p: Parsed, now: Clock, report: Report): Form | null {
  const allow = (r.params.allow as string[] | undefined) ?? [];
  for (const c of configs) {
    const hits = findAll(p, pattern(c, grammarOf(p.rel)!), now);
    if (!Array.isArray(hits)) return hits;
    for (const m of hits) if (!pure(m.node, allow)) report(r, m.node.startPosition.row + 1, symbolOf(m.node));
  }
  return null;
}

// Pattern counts use the same matcher as ordinary pattern rules; marker counts share their sites.
function count(what: Exclude<Extract<Impl, { primitive: "diff" }>["count"], "markers">, p: Parsed | null, now: Clock): number | Form {
  const hits = p ? findAll(p, pattern(what.pattern, grammarOf(p.rel)!), now) : [];
  return Array.isArray(hits) ? hits.length : hits;
}

// params.allow names qualified references a project declares pure: a match is allowed when the member
// chain it heads (Bun.Glob in new Bun.Glob(x).match(p)) reaches an entry; bracket access never does.
function pure(n: Node, allow: string[]): boolean {
  if (!allow.length) return false;
  let name = n.text;
  for (let at = n, up = n.parent; up?.type === "member_expression" && up.childForFieldName("object")?.id === at.id; at = up, up = up.parent) {
    name += `.${up.childForFieldName("property")!.text}`;
    if (allow.includes(name)) return true;
  }
  return false;
}

function pattern(c: PatternConfig, g: Grammar): Compiled {
  const byGrammar = compiled.get(c) ?? {};
  compiled.set(c, byGrammar);
  return (byGrammar[g] ??= compilePattern(c, g));
}

type Report = (r: LockRule, line: number, symbol: string, measured?: number | null, limit?: number | null) => Violation;
function ruleProgress<T>(host: Host, r: LockRule, run: () => T): T {
  return host.ruleProgress ? host.ruleProgress(r.id, run) : run();
}
function resolutionProgress<T>(host: Host, run: () => T): T {
  return host.resolutionProgress ? host.resolutionProgress(run) : run();
}

// `exempt` names a function by its own name only: one nested without a name carries its container's
// symbol, and the container comes first in document order.
function metric(r: LockRule, items: { symbol: string; line: number; measured: number; own: string | null }[], report: Report, repairOf?: (line: number, max: number) => string | null): void {
  const max = r.params.max as number;
  const exempt = new Set((r.params.exempt as string[] | undefined) ?? []);
  for (const x of items) if (x.measured > max && !(x.own !== null && exempt.has(x.own))) {
    const v = report(r, x.line, x.symbol, x.measured, max);
    const repair = repairOf?.(x.line, max);
    if (repair) v.repair = repair;
  }
}

function owned<T extends { symbol: string }>(fns: T[]): (T & { own: string | null })[] {
  const seen = new Set<string>();
  return fns.map((f) => {
    const own = seen.has(f.symbol) ? null : f.symbol.split(".").pop()!;
    seen.add(f.symbol);
    return { ...f, own };
  });
}

// layer-edge and banned-import share one resolution per import, re-export chains included. In a
// restricted layer (mayImport ≠ ["*"]) an import that cannot be resolved denies by form (§7.2 #12).
function checkImports(lock: Lock, p: Parsed, rules: LockRule[], host: Host, report: Report): Form | null {
  const { read } = host;
  const rel = p.rel;
  const layer = layerOf(lock, rel);
  const restricted = layer !== null && !lock.layers[layer]!.mayImport.includes("*");
  const edgeRules = restricted ? rules.filter((r) => r.impl.kind === "primitive" && r.impl.primitive === "layer-edge") : [];
  const bannedRules = rules.filter((r) => r.impl.kind === "primitive" && r.impl.primitive === "banned-import");
  if (!edgeRules.length && !bannedRules.length) return null;
  const all = resolutionProgress(host, () => host.importsOf ? host.importsOf(rel, p.text).imports : imports(p));
  const grammar = grammarOf(rel);
  if (restricted && ["python", "go", "rust"].includes(grammar!) && all.some((i) => !i.literal)) return { cause: "unresolvable-import", line: all.find((i) => !i.literal)!.line };
  const found = all.filter((x) => x.literal);
  const ts = found.length && (grammar === "typescript" || grammar === "tsx") ? resolutionProgress(host, () => loadTsPaths(read)) : null;
  for (const i of found) {
    const to = resolutionProgress(host, () => resolve(rel, i.spec, ts, read, i.base));
    const chain = resolutionProgress(host, () => typeof to === "object" ? reexportTargets(to.rel, ts, read, host.importsOf) : []);
    const reached: Edge[] = [{ spec: i.spec, to }, ...(chain === "too-deep" ? [] : chain)];
    const lost = reached.find((e) => e.to === "unresolved");
    const byTsconfig = ts === "invalid" && lost !== undefined && !/^\.\.?(\/|$)|[?\\]|.#/.test(lost.spec);
    if (restricted && (chain === "too-deep" || lost)) return { cause: "unresolvable-import", line: i.line, ...(byTsconfig ? { detail: TSCONFIG_INVALID } : {}) };
    for (const r of bannedRules) {
      ruleProgress(host, r, () => {
        const normalize = ["python", "go", "rust"].includes(grammar!) ? (name: string) => grammar === "rust" ? name.replace(/^::/, "").replaceAll("r#", "") : name : bare;
        const packages = (r.params.packages as string[]).map(normalize);
        // By name even when an alias maps it to a local file: the runtime does not read tsconfig paths.
        if (reached.some((e) => packages.some((pkg) => normalize(e.spec) === pkg || normalize(e.spec).startsWith(pkg + (grammar === "python" ? "." : grammar === "rust" ? "::" : "/"))))) {
          report(r, i.line, MODULE);
        }
      });
    }
    for (const r of edgeRules) {
      ruleProgress(host, r, () => {
        const bad = reached.find((e) => typeof e.to === "object" && !allowed(lock, layer!, e.to.rel))?.to;
        if (typeof bad === "object") report(r, i.line, MODULE).edge = { from: layer!, to: layerOf(lock, bad.rel), spec: i.spec };
      });
    }
  }
  return null;
}

// fs ≡ node:fs: Node's builtins answer to both names.
function bare(spec: string): string {
  return spec.replace(/^node:/, "");
}

// The core cannot depend on code without a layer (O2).
function allowed(lock: Lock, from: string, rel: string): boolean {
  const to = layerOf(lock, rel);
  return to !== null && (to === from || lock.layers[from]!.mayImport.includes(to));
}
