import { equal, type SchemaName, unsupported, validate } from "./schema.ts";
import { normalize as normalizeText } from "./reconstruct.ts";
import { LOOP_DEFAULTS } from "./enforcement.ts";
import type {
  Alias, Cause, Check, Enforcement, Files, Fixture, Impl, Layer, Lock, LockRelation, LockRule, Manifest, PackCategory, PatternConfig, Preset, Severity,
} from "./types.ts";

type Params = Record<string, unknown>;
type Versions = { engine: string; core: string };
type Macros = Pick<Lock, "layers" | "generatedMarkers">;
type Source = { ns: string; files: Files; checks: Map<string, Check>; manifests: Map<string, Manifest> };
type Loaded = Source & { dir: string | null; library?: boolean; git?: Extract<Preset["sources"][number], { kind: "git" }> };
type Op = { op: "add" | "replace" | "test"; path: string; value: unknown } | { op: "remove"; path: string };
interface Entry {                  // one active alias while the preset is applied to it
  fqn: string; manifest: Manifest; alias: Alias; check: Check; integrity: boolean;
  params: Params; severity: Severity | "off"; enforcement: Enforcement; origin: Record<string, string>;
}

const RANK: Record<Severity, number> = { warn: 1, ask: 2, deny: 3 };
const CHECK_FILE = /^checks\/([^/]+)\/([^/]+)\/check\.json$/;
const MANIFEST_FILE = /^methodologies\/([^/]+)\.json$/;
const GLOBS = { type: "array", items: { type: "string" } };

// The lock text: sorted keys, so equal content is equal bytes whatever the input order.
export function canonical(v: unknown): string {
  return `${JSON.stringify(sortKeys(v), null, 2)}\n`;
}

export function compile(presetText: string, filesOf: (s: Preset["sources"][number]) => Files | null,
  v: Versions): { lock: Lock; text: string } | { errors: string[] } {
  const errors: string[] = [];
  const preset = parse(presetText, "preset.json", errors, "preset") as Preset | null;
  const sources = preset ? loadSources(preset, filesOf, v, errors) : [];
  for (const [name, binding] of Object.entries(preset?.fitness ?? {})) {
    if (binding.timeoutMs > 120000) errors.push(`fitness.${name}: timeoutMs exceeds the 120000 ms budget`);
    if (binding.maxAgeMs !== undefined && !Number.isSafeInteger(binding.maxAgeMs)) errors.push(`fitness.${name}: maxAgeMs must be a safe integer`);
  }
  if (!preset || errors.length) return { errors };
  // The builtin source is policy, not an optional selection. Every core methodology activates;
  // human-reviewed overrides can explicitly turn individual rules off.
  const builtin = sources.find((s) => s.ns === "core")!;
  const methodologies = [...new Set([...preset.methodologies, ...builtin.manifests.keys()])].sort();
  const rules = rulesOf(preset, methodologies, sources, errors);
  if (rules === null || errors.length) return { errors };
  const lock: Lock = {
    lockVersion: 1, engine: v.engine, core: v.core, presetHash: sha256(normalizeText(presetText)),
    coreHash: sourcesHash(sources.filter((s) => s.dir === null && !s.git && !s.library).map((s) => s.files)),
    sourcesHash: sourcesHash(sources.filter((s) => s.dir !== null || s.git || s.library).map((s) => s.files)),
    sourceDirs: sources.flatMap((s) => (s.dir === null ? [] : [s.dir])),
    ...(sources.some((s) => s.git) ? { gitSources: sources.flatMap((s) => s.git ? [{ ...s.git, hash: sha256(canonical(s.files)) }] : []) } : {}),
    preset: { name: preset.name, version: preset.version, methodologies },
    ...(preset.fitness ? { fitness: preset.fitness } : {}),
    ...settings(preset), ...rules,
  };
  return { lock, text: canonical(lock) };
}

// What a preset (or a fixture's context) sets for the whole lock, with the defaults of what it leaves out.
function settings(preset: Partial<Preset>): Pick<Lock, "enforcement" | "scope" | "generatedMarkers" | "layers" | "ratchet" | "loop"> {
  const { escalate: _, ...loop }: NonNullable<Preset["loop"]> = preset.loop ?? {};
  return {
    enforcement: preset.enforcement ?? "enforce",
    scope: { include: preset.scope?.include ?? ["**"], exclude: preset.scope?.exclude ?? [] },
    generatedMarkers: preset.generatedMarkers ?? [], layers: preset.layers ?? {},
    ratchet: preset.ratchet?.mode ?? "no-new", loop: { ...LOOP_DEFAULTS, ...loop },
  };
}

// The selected methodologies down to the lock's rules: every alias activated, each dimension resolved,
// the overrides applied, and one rule per check.
function rulesOf(preset: Preset, methodologies: string[], sources: Source[], errors: string[]): Pick<Lock, "rules" | "ownedByArkgate" | "relations"> | null {
  const entries = activate(methodologies, sources, preset.enforcement ?? "enforce", errors);
  if (errors.length) return null;
  const kept = resolve(preset, entries, errors);
  override(preset, kept, errors);
  if (errors.length) return null;
  const active = kept.filter((e) => e.severity !== "off");
  const rules = effective(active, settings(preset), errors);
  const relations = relationsOf(preset, active, sources, errors);
  return { rules, ownedByArkgate: owned(preset, rules, active, errors), ...(relations.length ? { relations } : {}) };
}

// Interactions the packs declare between rules that are both active. Following one side of a
// contradiction violates the other, so it compiles only with a reviewed note in "settled".
function relationsOf(preset: Preset, active: Entry[], sources: Source[], errors: string[]): LockRelation[] {
  const known = new Set(sources.flatMap((s) => [...s.manifests.values()].flatMap((m) => m.invariants.map((a) => `${s.ns}/${a.id}`))));
  const notes = new Map<string, string>();
  for (const [i, s] of (preset.settled ?? []).entries()) {
    const unknown = s.rules.filter((r) => !known.has(r));
    if (s.rules.length !== 2 || s.rules[0] === s.rules[1]) errors.push(`settled[${i}].rules: name exactly two different rules`);
    else if (unknown.length) errors.push(`settled[${i}].rules: ${unknown.join(", ")} is not declared by any source`);
    else notes.set([...s.rules].sort().join(" "), s.note);
  }
  const fqns = new Set(active.map((e) => e.fqn));
  const namespaces = new Set(active.map((e) => e.fqn.split("/")[0]!));
  const found = new Map<string, LockRelation>();
  for (const e of [...active].sort((a, b) => (a.fqn < b.fqn ? -1 : 1))) for (const r of e.alias.relations ?? []) {
    if (!(r.kind === "idiom" ? namespaces.has(r.with) : fqns.has(r.with))) continue;
    const rules: [string, string] = r.kind === "idiom" || e.fqn < r.with ? [e.fqn, r.with] : [r.with, e.fqn];
    const key = `${rules.join(" ")} ${r.kind}`;
    const note = notes.get(rules.join(" "));
    if (!found.has(key)) found.set(key, { rules, kind: r.kind, why: r.why, settle: r.settle, ...(note === undefined ? {} : { note }) });
  }
  for (const { rules: [a, b], kind, why, settle, note } of found.values()) {
    if (kind !== "contradicts" || note !== undefined) continue;
    errors.push(`${a} contradicts ${b}: ${why} ${settle} Record the reviewed decision in the preset "settled": `
      + `[{"rules": ["${a}", "${b}"], "note": "<how this project keeps both satisfiable>"}], or turn one rule off.`);
  }
  return [...found.values()].sort((x, y) => (`${x.rules.join(" ")} ${x.kind}` < `${y.rules.join(" ")} ${y.kind}` ? -1 : 1));
}

// Metadata freshness only (§4.1 step 6). Admission also compares complete compiler output; these
// hashes do not bind the lock body. Core version alone does not pin catalog content (O41).
export function freshness(lock: Lock, presetText: string, v: Versions, builtin: Files): Cause | null {
  if (lock.engine !== v.engine || lock.core !== v.core) return "version-mismatch";
  const same = lock.lockVersion === 1 && lock.presetHash === sha256(normalizeText(presetText)) && lock.coreHash === sourcesHash([builtin]);
  return same ? null : "lock-stale";
}

// Per-object memo that stays correct when callers mutate a Files object: a hit
// requires the same paths and the same texts as when the value was derived.
type Memo<T> = WeakMap<Files, { seen: Files; value: T }>;

function memoized<T>(memo: Memo<T>, files: Files, derive: () => T): T {
  const hit = memo.get(files);
  const paths = Object.keys(files);
  if (hit && paths.length === Object.keys(hit.seen).length && paths.every((p) => hit.seen[p] === files[p])) return hit.value;
  const value = derive();
  memo.set(files, { seen: { ...files }, value });
  return value;
}

// Hash of what compile reads from `path` sources, in preset order: fixtures and other files do not count.
const policyFiles: Memo<Files> = new WeakMap();

export function sourcesHash(sources: Files[]): string {
  const sorted = sources.map((files) => memoized(policyFiles, files, () => {
    const policy: Files = {};
    for (const path of Object.keys(files).sort()) if (evaluable(path)) policy[path] = files[path]!;
    return policy;
  }));
  return sha256(JSON.stringify(sorted));
}

// The one-rule lock `rules test` evaluates a fixture with. Invalid params are fixture data errors: it throws.
export function fixtureLock(check: Check, params: Params, ctx: Fixture["context"]): Lock {
  const { fitness: _fitness, ...context } = ctx ?? {};
  const set = settings(context);
  const invalid = validate(paramsSchema(check), params).map((e) => `params${e}`);
  const resolved = invalid.length ? invalid.join("; ") : normalize(check, params, set);
  if (typeof resolved === "string") throw new Error(`${check.id}: ${resolved}`);
  return {
    lockVersion: 1, engine: "", core: "", coreHash: "", presetHash: "", sourcesHash: "", sourceDirs: [], ownedByArkgate: [],
    preset: { name: "fixture", version: "0.0.0", methodologies: [] }, ...set,
    rules: [{ id: check.id, aliases: [], ...shape(check, null), params: resolved, severity: "deny", integrity: false, origin: {} }],
  };
}

// JSON-patch (add, remove, replace, test) of a request onto the preset; all or nothing.
export function applyRequest(presetText: string, requestText: string): { presetText: string } | { errors: string[] } {
  const errors: string[] = [];
  const request = parse(requestText, "request", errors, "request") as { patch: Op[] } | null;
  let doc = parse(presetText, "preset.json", errors);
  if (!request || errors.length) return { errors };
  for (const [i, op] of request.patch.entries()) {
    const applied = patch(doc, op);
    if (typeof applied === "string") return { errors: [`request: /patch/${i}: ${applied}`] };
    doc = applied.root;
  }
  const invalid = validate("preset", doc).map((e) => `preset.json: ${e}`);
  return invalid.length ? { errors: invalid } : { presetText: `${JSON.stringify(doc, null, 2)}\n` };
}

// The structural part of `rules test` for one source: schemas, IDs, namespace.
export function listChecks(files: Files): { ids: string[] } | { errors: string[] } {
  const source = load(files);
  return Array.isArray(source) ? { errors: source } : { ids: [...source.checks.keys()].sort() };
}

// Discovery uses the same structural validation as compilation; it does not certify fixtures.
export function packCatalog(files: Files): { ns: string; version: string; category: PackCategory | null; checks: Check[]; methodologies: Manifest[] } | { errors: string[] } {
  const source = load(files);
  if (Array.isArray(source)) return { errors: source };
  const metadata = JSON.parse(files["source.json"]!) as { version: string; category?: PackCategory };
  return {
    ns: source.ns, version: metadata.version, category: metadata.category ?? null,
    checks: [...source.checks.values()], methodologies: [...source.manifests.values()],
  };
}

function loadSources(preset: Preset, filesOf: (s: Preset["sources"][number]) => Files | null, v: Versions,
  errors: string[]): Loaded[] {
  if (preset.engine !== v.engine) errors.push(`engine ${preset.engine} does not match this binary (${v.engine}); set engine to ${v.engine}`);
  const builtins = preset.sources.filter((s) => s.kind === "builtin");
  if (builtins.length !== 1) errors.push(`sources: exactly one builtin source "core" is required, found ${builtins.length}`);
  else if (builtins[0]!.version !== v.core) {
    errors.push(`sources: core ${builtins[0]!.version} does not match this binary (${v.core}); set sources[core].version to ${v.core}`);
  }
  const out: Loaded[] = [];
  for (const [i, s] of preset.sources.entries()) {
    if (s.kind === "git" && !/^[0-9a-f]{40}$/.test(s.ref)) errors.push(`sources: ${s.ns}: Git ref must be a pinned commit SHA; run pregate pack add <url>@<ref>.`);
    const where = `sources: ${s.ns} (${s.kind === "path" ? s.path : s.kind})`;
    if (preset.sources.findIndex((t) => t.ns === s.ns) !== i) {
      errors.push(`sources: namespace ${s.ns} is declared twice`);
      continue;
    }
    const files = filesOf(s);
    const source = files ? load(files) : ["not found"];
    if (Array.isArray(source)) errors.push(...source.map((e) => `${where}: ${e}`));
    else if (source.ns !== s.ns) errors.push(`${where}: source.json declares namespace ${source.ns}`);
    else if (s.kind === "library" && JSON.parse(source.files["source.json"]!).version !== s.version) errors.push("sources: " + s.ns + ": bundled version does not match " + s.version + "; use pack update --preview");
    else out.push({ ...source, dir: s.kind === "path" ? s.path : null, ...(s.kind === "git" ? { git: s } : {}), ...(s.kind === "library" ? { library: true } : {}) });
  }
  return out;
}

const loadedSources: Memo<Source | string[]> = new WeakMap();

function load(files: Files): Source | string[] {
  return memoized(loadedSources, files, () => loadUncached(files));
}

function loadUncached(files: Files): Source | string[] {
  const errors: string[] = [];
  const read = (path: string, schema: SchemaName): unknown => parse(files[path]!, path, errors, schema);
  if (files["source.json"] === undefined) return ["source.json: missing"];
  const { ns } = (read("source.json", "source") ?? {}) as { ns?: string };
  if (ns === undefined) return errors;
  const checks = new Map<string, Check>();
  const manifests = new Map<string, Manifest>();
  for (const path of Object.keys(files).sort()) {
    const c = CHECK_FILE.exec(path);
    const m = MANIFEST_FILE.exec(path);
    const check = c ? (read(path, "check") as Check | null) : null;
    const manifest = m ? (read(path, "methodology") as Manifest | null) : null;
    if (check) checks.set(check.id, check);
    if (manifest) manifests.set(manifest.id, manifest);
    const problems = check ? checkErrors(check, `${ns}/${c![1]}/${c![2]}`, c![1]!)
      : manifest ? manifestErrors(manifest, `${ns}/${m![1]}`) : [];
    errors.push(...problems.map((e) => `${path}: ${e}`));
  }
  // A broken check would also show up as every alias pointing at it.
  if (!errors.length) errors.push(...aliasErrors(ns, checks, manifests));
  return errors.length ? errors : { ns, files, checks, manifests };
}

// Within a source, an alias ID is declared once and an alias of its own namespace names one of its checks.
function aliasErrors(ns: string, checks: Map<string, Check>, manifests: Map<string, Manifest>): string[] {
  const out: string[] = [];
  const aliases = [...manifests.values()].flatMap((m) => m.invariants.map((a) => ({ m: m.id, a })));
  for (const [i, { m, a }] of aliases.entries()) {
    if (aliases.findIndex((x) => x.a.id === a.id) !== i) out.push(`${m}: alias ${a.id} is declared twice in ${ns}`);
    if (a.check.startsWith(`${ns}/`) && !checks.has(a.check)) out.push(`${m}: ${a.id} uses unknown check ${a.check}`);
    for (const r of a.relations ?? []) {
      const at = `${m}: ${a.id} relation with ${r.with}`;
      if ((r.kind === "idiom") === r.with.includes("/")) out.push(`${at}: ${r.kind === "idiom" ? "an idiom names a pack namespace" : `${r.kind} names another rule as ns/ALIAS-ID`}`);
      else if (r.with === `${ns}/${a.id}`) out.push(`${at}: a rule cannot relate to itself`);
      else if (r.with.startsWith(`${ns}/`) && !aliases.some((x) => `${ns}/${x.a.id}` === r.with)) out.push(`${at}: unknown rule in ${ns}`);
    }
  }
  return out;
}

function checkErrors(check: Check, id: string, area: string): string[] {
  const out = check.id === id && check.area === area ? [] : [`id must be ${id} and area ${area}`];
  if (check.impl.kind === "primitive" && check.impl.primitive === "fitness" && (check.languages || check.phase.includes("pre"))) {
    out.push("project fitness requirements are language-independent and run at stop, commit or ci, not pre-edit");
  }
  for (const [name, schema] of Object.entries(check.params)) {
    if (["paths", "exclude", "within"].includes(name)) out.push(`params.${name} is implicit in every check; remove it`);
    out.push(...unsupported(schema, `/params/${name}`));
  }
  const configs = patternsOf(check.impl);
  if (check.impl.kind === "pattern" && !configs.length) out.push("patterns must declare at least one nonempty language implementation");
  if (check.languages && new Set(check.languages).size !== check.languages.length) out.push("languages must not repeat");
  if (check.impl.kind === "pattern" && Object.values(check.impl.patterns).some((entries) => entries.length === 0)) out.push("each declared language needs a nonempty pattern implementation");
  if (check.impl.kind === "pattern" && check.languages && !equal([...check.languages].sort(), Object.keys(check.impl.patterns).sort())) out.push("languages must match the pattern implementations");
  if (check.impl.kind === "primitive" && check.impl.primitive === "metric" && check.impl.metric === "class.publicMethods" && check.languages?.includes("go")) out.push("Go has no class.publicMethods implementation; use function or nesting metrics");
  if (check.impl.kind === "primitive" && check.impl.primitive === "metric" && check.impl.metric === "class.publicMethods" && check.languages?.includes("rust")) out.push("Rust has no class.publicMethods implementation; use function or nesting metrics");
  if (check.impl.kind === "primitive" && check.impl.primitive === "metric" && ["file.lines", "file.publicExports", "heritage.depth"].includes(check.impl.metric) && check.languages?.some((language) => language !== "typescript")) {
    out.push(`${check.impl.metric} is implemented for TypeScript and JavaScript only`);
  }
  if (configs.some((c) => !equal(c.files, configs[0]!.files) || !equal(c.ignores, configs[0]!.ignores))) {
    out.push("its patterns declare different files or ignores; split them into separate checks");
  }
  return out;
}

function manifestErrors(m: Manifest, id: string): string[] {
  const out = m.id === id ? [] : [`id must be ${id}`];
  for (const a of m.invariants) {
    if (a.severity === "deny" && unexplained(a)) out.push(`${a.id}: a deny invariant needs why, fixHint, avoid and examples`);
    if (a.fix && a.fix.where === undefined && a.fix.use === undefined) out.push(`${a.id}: fix needs where or use`);
    if (id.startsWith("core/") && a.severity === "off") out.push(`${a.id}: a core invariant must be active by default; use a reviewed preset override to disable it`);
  }
  return out;
}

function activate(methodologies: string[], sources: Source[], enforcement: Enforcement, errors: string[]): Entry[] {
  const checks = new Map(sources.flatMap((s) => [...s.checks]));
  const manifests = new Map(sources.flatMap((s) => [...s.manifests]));
  const entries: Entry[] = [];
  for (const id of methodologies) {
    const manifest = manifests.get(id);
    if (!manifest) {
      errors.push(`methodologies: ${id} is not declared by any source`);
      continue;
    }
    for (const alias of manifest.invariants) {
      const check = checks.get(alias.check);
      if (!check) errors.push(`${id}: ${alias.id} uses unknown check ${alias.check}`);
      else entries.push({
        fqn: `${id.split("/")[0]}/${alias.id}`, manifest, alias, check, integrity: id.startsWith("core/"),
        params: { ...alias.defaults }, severity: alias.severity, enforcement: id.startsWith("core/") ? (enforcement === "advisor" ? "advisor" : "enforce") : enforcement,
        origin: Object.fromEntries([...Object.keys(alias.defaults).map((k) => `params.${k}`), "severity"]
          .map((k) => [k, "alias"]).concat([["enforcement", id.startsWith("core/") && enforcement !== "advisor" ? "core" : "preset"]])),
      });
    }
  }
  return entries;
}

// resolve[dimension].use keeps the chosen methodology or alias in that dimension and disables the rest (§8.5.2).
function resolve(preset: Preset, entries: Entry[], errors: string[]): Entry[] {
  let kept = entries;
  for (const [dimension, r] of Object.entries(preset.resolve ?? {})) {
    const at = `resolve.${dimension}`;
    const inDimension = kept.filter((e) => e.check.dimension === dimension);
    const chosen = inDimension.some((e) => e.manifest.id === r.use)
      ? inDimension.filter((e) => e.manifest.id === r.use)
      : isCheckId(r.use) ? [] : select(inDimension, r.use);
    if (!inDimension.length) errors.push(`${at}: no active invariant has this dimension`);
    else if (typeof chosen === "string") errors.push(`${at}.use: ${chosen}`);
    else if (!chosen.length) errors.push(`${at}.use: ${r.use} is not an active methodology or invariant in this dimension`);
    if (typeof chosen === "string" || !chosen.length) continue;
    for (const e of inDimension) {
      if (e.integrity && !chosen.includes(e)) errors.push(`${at}: cannot disable integrity invariant ${e.fqn}`);
    }
    for (const e of chosen) adjust(e, at, r);
    kept = kept.filter((e) => !inDimension.includes(e) || chosen.includes(e));
  }
  return kept;
}

// Check-wide overrides apply before alias overrides, so the more specific one wins.
function override(preset: Preset, entries: Entry[], errors: string[]): void {
  const overrides = preset.overrides ?? {};
  const keys = Object.keys(overrides).sort((a, b) => Number(isCheckId(b)) - Number(isCheckId(a)));
  const byAlias = new Map<Entry, string>();
  for (const key of keys) {
    const o = overrides[key]!;
    const change = typeof o === "string" ? { severity: o } : o;
    const hit = select(entries, key);
    if (typeof hit === "string") errors.push(`overrides.${key}: ${hit}`);
    else if (!hit.length) errors.push(`overrides.${key}: no active invariant; overrides only change the selected methodologies`);
    for (const e of typeof hit === "string" ? [] : hit) {
      const at = `overrides.${key}: ${e.fqn}`;
      if (e.integrity && change.enforcement === "shadow") errors.push(`${at} is an integrity invariant and cannot be shadowed`);
      if (!isCheckId(key) && byAlias.has(e)) errors.push(`${at} is already overridden by ${byAlias.get(e)}`);
      if (!isCheckId(key)) byAlias.set(e, key);
      adjust(e, `overrides.${key}`, change);
    }
  }
}

// One rule per singleton check, one per distinct params of a multi check; any other disagreement is a conflict.
function effective(entries: Entry[], ctx: Macros, errors: string[]): LockRule[] {
  const groups = new Map<string, Entry[]>();
  const resolved = new Map<Entry, Params>();
  for (const e of [...entries].sort((a, b) => (a.fqn < b.fqn ? -1 : 1))) {
    const params = paramsOf(e, ctx, errors);
    if (params === null) continue;
    resolved.set(e, params);
    const key = e.check.cardinality === "multi" ? `${e.check.id} ${JSON.stringify(sortKeys(params))}` : e.check.id;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const rules = [...groups.values()].flatMap((group) => ruleOf(group, resolved, errors) ?? []);
  return rules.sort((a, b) => (a.id < b.id ? -1 : 1));
}

// An entry's params as the lock keeps them; null once it reported why they cannot be kept.
function paramsOf(e: Entry, ctx: Macros, errors: string[]): Params | null {
  const problems = validate(paramsSchema(e.check), e.params).map((x) => `params${x}`);
  if (e.severity === "deny" && unexplained(e.alias)) problems.push("a deny invariant needs why, fixHint, avoid and examples");
  if (e.check.impl.kind === "primitive" && e.check.impl.primitive === "fitness" && (e.params.paths !== undefined || e.params.exclude !== undefined || e.params.within !== undefined)) {
    problems.push("project fitness requirements follow the whole preset scope; per-file paths/exclude/within cannot narrow a requirement");
  }
  const params = problems.length ? null : normalize(e.check, e.params, ctx);
  if (typeof params === "string") problems.push(params);
  errors.push(...problems.map((p) => `${e.fqn}: ${p}`));
  return params === null || typeof params === "string" ? null : params;
}

// The entries of one check become one rule when they agree; integrity absorbs the rest at its strictest (§5.3).
function ruleOf(group: Entry[], resolved: Map<Entry, Params>, errors: string[]): LockRule | null {
  const integrity = group.filter((e) => e.integrity);
  const base = integrity.length ? integrity : group;
  const winner = base[0]!;
  const same = (e: Entry): boolean =>
    equal(resolved.get(e), resolved.get(winner)) && (integrity.length > 0 || (e.severity === winner.severity && e.enforcement === winner.enforcement))
    && (winner.origin.severity !== "alias" || equal(e.alias.versionGate ?? null, winner.alias.versionGate ?? null));
  const severity = group.map((e) => e.severity as Severity).reduce((a, b) => (RANK[b] > RANK[a] ? b : a));
  const min = winner.check.minSeverity;
  if (!base.every(same)) errors.push(conflict(group));
  else if (min && RANK[severity] < RANK[min]) errors.push(`${winner.fqn}: severity ${severity} is below the minimum ${min} of ${winner.check.id}`);
  else return {
    id: winner.fqn, aliases: group.map((e) => e.fqn), ...shape(winner.check, winner.alias), params: resolved.get(winner)!,
    severity, enforcement: winner.enforcement, integrity: integrity.length > 0, origin: winner.origin,
    // A reviewed severity override replaces the gate; the alias no longer chooses by package version.
    ...(winner.origin.severity === "alias" && winner.alias.versionGate ? { versionGate: winner.alias.versionGate } : {}),
  };
  return null;
}

function conflict(group: Entry[]): string {
  const dimension = group[0]!.check.dimension;
  const modes = new Set(group.map((e) => e.enforcement)).size > 1;
  const sides = group.map((e) => `${e.fqn} ${JSON.stringify(sortKeys(e.params))} ${e.severity}${modes ? ` ${e.enforcement}` : ""}`).join(" vs ");
  const ids = new Set(group.map((e) => e.manifest.id));
  const hint = group.flatMap((e) => e.manifest.conflicts.map((c) => ({ by: e.manifest.id, ...c })))
    .find((c) => c.dimension === dimension && ids.has(c.with));
  const advice = hint ? ` Suggestion from ${hint.by}: ${hint.why}` : "";
  return `unresolved conflict in dimension "${dimension}": ${sides}.${advice} Add to the preset "resolve": `
    + `{"${dimension}": {"use": "${hint?.suggest.use ?? "<methodology or invariant>"}"}}, or set the value in "overrides".`;
}

// ArkGate owns whole rules: a rule some other active alias also enforces stays all or nothing (§8.5.12).
function owned(preset: Preset, rules: LockRule[], entries: Entry[], errors: string[]): string[] {
  const fqns = new Set<string>();
  for (const key of preset.coexist?.arkgate?.ownedByArkgate ?? []) {
    const hit = select(entries, key);
    if (typeof hit === "string") errors.push(`coexist.arkgate.ownedByArkgate: ${key}: ${hit}`);
    else if (!hit.length) errors.push(`coexist.arkgate.ownedByArkgate: ${key}: no active invariant`);
    else for (const e of hit) fqns.add(e.fqn);
  }
  const hits = rules.filter((r) => r.aliases.some((a) => fqns.has(a)));
  for (const r of hits) {
    const at = `coexist.arkgate.ownedByArkgate: ${r.id}`;
    const rest = r.aliases.filter((a) => !fqns.has(a));
    if (r.integrity) errors.push(`${at} is an integrity invariant; PREGATE always enforces it`);
    else if (rest.length) errors.push(`${at} is also enforced through ${rest.join(", ")}; list them too or none`);
  }
  return hits.map((r) => r.id);   // rules are already sorted
}

// An override or ownedByArkgate key: a check ID (every alias of it) or an alias, short while unambiguous.
function select(entries: Entry[], key: string): Entry[] | string {
  if (isCheckId(key)) return entries.filter((e) => e.check.id === key);
  const hit = entries.filter((e) => e.fqn === key || e.alias.id === key);
  const fqns = [...new Set(hit.map((e) => e.fqn))].sort();
  return fqns.length > 1 ? `${key} is ambiguous; write one of ${fqns.join(", ")}` : hit;
}

function adjust(e: Entry, by: string, change: { params?: Params; severity?: Severity | "off"; enforcement?: Enforcement }): void {
  for (const [k, value] of Object.entries(change.params ?? {})) {
    e.params[k] = value;
    e.origin[`params.${k}`] = by;
  }
  if (change.severity) {
    e.severity = change.severity;
    e.origin.severity = by;
  }
  if (change.enforcement) {
    e.enforcement = change.enforcement;
    e.origin.enforcement = by;
  }
}

// Implicit `paths` (every file) and `exclude` (none) (O4), pattern files/ignores moved in, @layers
// expanded (A21) and `@generatedMarkers` in `markers` replaced by the preset's markers (O14).
function normalize(check: Check, params: Params, { layers, generatedMarkers }: Macros): Params | string {
  const [first] = patternsOf(check.impl);
  if (first?.files && params.paths !== undefined) {
    return `params.paths: ${check.id} already restricts paths through its patterns' files`;
  }
  const paths = expand("paths", first?.files ?? (params.paths as string[] | undefined) ?? ["**"], layers);
  const exclude = expand("exclude", [...((params.exclude as string[] | undefined) ?? []), ...(first?.ignores ?? [])], layers);
  const within = params.within === undefined ? undefined : expand("within", params.within as string[], layers);
  if (typeof paths === "string") return paths;
  if (typeof within === "string") return within;
  const markers = Array.isArray(params.markers)
    ? { markers: [...new Set((params.markers as string[]).flatMap((m) => (m === "@generatedMarkers" ? generatedMarkers : [m])))] }
    : {};
  return typeof exclude === "string" ? exclude : { ...params, ...markers, paths, exclude, ...(within === undefined ? {} : { within }) };
}

// `@layers` with no layers yields nothing, never "everything"; `@layers:<kind>` must match some layer.
function expand(key: string, globs: string[], layers: Record<string, Layer>): string[] | string {
  const out = new Set<string>();
  for (const glob of globs) {
    const macro = /^@layers(?::(.*))?$/.exec(glob);
    const kind = macro?.[1];
    const found = Object.values(layers).filter((l) => kind === undefined || l.kind === kind);
    if (!glob.startsWith("@")) out.add(glob);
    else if (!macro) return `params.${key}: unknown macro ${glob}`;
    else if (kind !== undefined && !found.length) {
      return `params.${key}: ${glob} matches no layer; the preset declares no layer of kind "${kind}"`;
    }
    for (const path of macro ? found.flatMap((l) => l.paths) : []) out.add(path);
  }
  return [...out];
}

function paramsSchema(check: Check): Record<string, unknown> {
  return {
    type: "object", properties: { ...check.params, paths: GLOBS, exclude: GLOBS, within: GLOBS },
    required: Object.keys(check.params), additionalProperties: false,
  };
}

function shape(check: Check, alias: Alias | null): Pick<LockRule, "check" | "impl" | "phases" | "text" | "languages" | "when"> {
  return {
    check: `${check.id}@${check.version}`, impl: stripped(check.impl), phases: check.phase,
    ...(check.languages ? { languages: check.languages } : {}),
    ...(check.when ? { when: check.when } : {}),
    text: {
      message: check.feedback.message, why: alias?.why ?? "", fix: alias?.fixHint ?? "", avoid: alias?.avoid || null,
      source: alias ? `${alias.source.work}, ${alias.source.locator}` : "",
      ...(alias?.fix?.where ? { where: alias.fix.where } : {}),
      ...(alias?.fix?.use ? { use: alias.fix.use } : {}),
    },
  };
}

export function patternsOf(impl: Impl): PatternConfig[] {
  if (impl.kind === "pattern") return Object.values(impl.patterns).flat();
  return impl.primitive === "diff" && typeof impl.count === "object" ? [impl.count.pattern] : [];
}

// files/ignores live in params once normalized; the lock keeps one source of truth for paths.
function stripped(impl: Impl): Impl {
  const bare = ({ files: _f, ignores: _i, ...rest }: PatternConfig): PatternConfig => rest;
  if (impl.kind === "pattern") return { ...impl, patterns: Object.fromEntries(Object.entries(impl.patterns).map(([lang, configs]) => [lang, configs.map(bare)])) };
  if (impl.primitive === "diff" && typeof impl.count === "object") return { ...impl, count: { pattern: bare(impl.count.pattern) } };
  return impl;
}

function patch(root: unknown, op: Op): { root: unknown } | string {
  const keys = op.path.split("/").slice(1).map((k) => k.replaceAll("~1", "/").replaceAll("~0", "~"));
  const key = keys.pop();
  if (key === undefined) {
    if (op.op === "remove") return "the whole preset cannot be removed";
    return op.op !== "test" ? { root: op.value } : equal(root, op.value) ? { root } : `test failed at ${op.path}`;
  }
  const parent = keys.reduce<unknown>(child, root);
  const found = child(parent, key);
  if (typeof parent !== "object" || parent === null) return `${op.path}: the parent does not exist`;
  if (op.op !== "add" && found === undefined) return `${op.path} does not exist`;
  if (op.op === "test") return equal(found, op.value) ? { root } : `test failed at ${op.path}`;
  if (Array.isArray(parent)) {
    const i = key === "-" ? parent.length : /^(0|[1-9][0-9]*)$/.test(key) ? Number(key) : -1;
    if (i < 0 || i > parent.length) return `${op.path}: invalid array index`;
    parent.splice(i, op.op === "add" ? 0 : 1, ...(op.op === "remove" ? [] : [op.value]));
  } else if (op.op === "remove") delete (parent as Record<string, unknown>)[key];
  else Object.defineProperty(parent, key, { value: op.value, enumerable: true, writable: true, configurable: true });
  return { root };
}

function child(node: unknown, key: string): unknown {
  if (Array.isArray(node)) return /^(0|[1-9][0-9]*)$/.test(key) ? node[Number(key)] : undefined;
  const own = typeof node === "object" && node !== null && Object.hasOwn(node, key);
  return own ? (node as Record<string, unknown>)[key] : undefined;
}

function parse(text: string, label: string, errors: string[], schema?: SchemaName): unknown {
  const doc = jsonDocument(text, label, errors);
  if (doc === undefined) return null;
  const invalid = schema ? validate(schema, doc) : [];
  errors.push(...invalid.map((e) => `${label}: ${e}`));
  return invalid.length ? null : doc;
}

function jsonDocument(text: string, label: string, errors: string[]): unknown {
  try {
    return JSON.parse(text);
  } catch {
    errors.push(`${label}: invalid JSON`);
    return undefined;
  }
}

function unexplained(a: Alias): boolean {
  return !a.why || !a.fixHint || !a.avoid || !a.examples;
}

function isCheckId(key: string): boolean {
  return key.split("/").length === 3;
}

function evaluable(path: string): boolean {
  return path === "source.json" || CHECK_FILE.test(path) || MANIFEST_FILE.test(path);
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (typeof v !== "object" || v === null) return v;
  const o = v as Record<string, unknown>;
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])]));
}

function sha256(text: string): string {
  return (require("node:crypto") as typeof import("node:crypto")).createHash("sha256").update(text).digest("hex");
}
