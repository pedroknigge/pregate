import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateContract } from "./contract.ts";
import { clock, sourcesOf, VERSIONS } from "./gate.ts";
import { grammarOf } from "./languages.ts";
import { librarySources } from "./library.ts";
import { layerEvidence, layerEvidenceLines, newBreak } from "./onboard.ts";
import { matches } from "./paths.ts";
import type { Files, Layer, Lock, LockRule, Preset } from "./types.ts";

// Guide and init call `foldArkgate` / `arkgateNotice`. The import command does too.
// Keep this module free of init.ts and scan-command.ts: those already import each other,
// and another change is bundling guide's review. This is the seam that review calls.

// Same map as scan-command.ts LAYERED. Copied so this module does not import that file.
const LAYERED: Record<string, [string, string]> = {
  typescript: ["architecture", "architecture/clean-architecture"], tsx: ["architecture", "architecture/clean-architecture"],
  python: ["python", "python/architecture"], go: ["go", "go/architecture"], rust: ["rust", "rust/architecture"],
};

// ArkGate schemas/ark.config.schema.json sets additionalProperties: false. A key it does not
// name can be a new deny. Reject it instead of dropping it. schemaVersion in that schema is
// the const "1.3"; the configs published in pedroknigge/arkgate still say "1.0" with this shape.
const ROOT_KEYS = ["$schema", "arkOrder", "arkRules", "arkRun", "coverage", "cyclePolicy", "dynamicImportAllowlist", "exclude", "excludeGenerated", "frameworkOverlay", "include", "layers", "name", "requireLayerOwners", "rules", "safety", "schemaVersion", "stewards"];
const LAYER_KEYS = ["allowEmpty", "capabilities", "description", "entrypoints", "exclude", "forbiddenGlobals", "intentPrefixes", "mayImportInfrastructure", "name", "optional", "owners", "patterns", "pure", "reserved", "trustBoundary"];
const RULE_KEYS = ["allowed", "allowedCrossSlice", "childSlices", "from", "message", "peerIsolation", "sharedImportsSlice", "sharedRoots", "sliceFolders", "sliceIdentity", "to"];

const CORE = new Set(["domain", "domainmodel", "entities", "entity", "core", "types", "type", "sharedkernel", "model", "application", "applicationorchestration", "usecases", "usecase", "app", "orchestration"]);
const MAIN = new Set(["main", "composition", "compositionroot", "bootstrap", "kernel"]);
const OWNED_NOTE = "ArkGate enforces layer direction from this config. PREGATE lists those invariants in ownedByArkgate and does not evaluate them.";
const OPEN_NOTE = "ArkGate's config declares no blanket layer deny. PREGATE still evaluates layer direction.";

export interface ArkgateFold {
  preset: Preset;
  notes: string[];
  evidenceLines: string[];
}

export function arkgateNotice(root: string, preset: Preset | null): { config: string; suggestion: string } | null {
  const config = "ark.config.json";
  if (!existsSync(join(root, config))) return null;
  const recorded = preset?.coexist?.arkgate?.config === config;
  return { config, suggestion: recorded
    ? "ark.config.json is already recorded in coexist.arkgate. Run pregate import arkgate --preview to refresh the layer map from it."
    : "ark.config.json is present. Run pregate import arkgate --preview so PREGATE does not also enforce the layer rules ArkGate already owns. On a new project, guide --preview includes that import." };
}

// null: the default config is absent, so onboarding has nothing to fold in.
export function foldArkgate(root: string, preset: Preset, files: Files): ArkgateFold | { errors: string[] } | null {
  const config = "ark.config.json", path = join(root, config);
  if (!existsSync(path)) return null;
  let text: string;
  try { text = readFileSync(path, "utf8"); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === undefined) throw e;
    return { errors: [`Could not read ${config}: ${(e as Error).message}. Nothing staged.`] };
  }
  return foldArkgateText(root, preset, files, config, text);
}

export function foldArkgateText(root: string, preset: Preset, files: Files, configRel: string, text: string): ArkgateFold | { errors: string[] } {
  const translated = translate(text, files);
  if ("errors" in translated) return translated;
  const withPolicy = layerPolicy(root, { ...preset, layers: translated.layers }, files);
  if ("errors" in withPolicy) return { errors: [...withPolicy.errors, "Nothing staged."] };
  const denies = translated.blanketDenies > 0;
  const layerRules = withPolicy.lock.rules.filter(rule => isActiveLayerEdge(rule, withPolicy.lock.enforcement));
  const owned = ownedAliases(preset, layerRules, denies);
  if ("errors" in owned) return owned;
  const note = denies ? OWNED_NOTE : OPEN_NOTE;
  const next: Preset = { ...withPolicy.preset, layers: translated.layers, coexist: { ...preset.coexist, arkgate: { config: configRel, ownedByArkgate: owned.ids, note } } };
  const compiled = compile(root, next);
  if ("errors" in compiled) return { errors: [...compiled.errors, "Nothing staged."] };
  const ownedList = compiled.lock.ownedByArkgate.filter(id => layerRules.some(rule => rule.id === id));
  return {
    preset: next,
    notes: [`ArkGate ${configRel} (schemaVersion ${translated.schemaVersion}): ${Object.keys(translated.layers).length} layers (${translated.core.join(", ") || "none"} core). coexist.arkgate owns ${ownedList.join(", ") || "no layer-direction rule"}.`,
      ...withPolicy.notes, ...translated.notes],
    evidenceLines: layerEvidenceLines(layerEvidence(files, translated.layers), compiled.lock.ratchet, newBreak(compiled.lock)),
  };
}

function ownedAliases(preset: Preset, layerRules: LockRule[], denies: boolean): { ids: string[] } | { errors: string[] } {
  const previous = preset.coexist?.arkgate?.ownedByArkgate ?? [];
  if (!denies) return { ids: [...new Set(previous)].sort() };
  if (layerRules.length === 0) return { errors: ["Layer edges in ark.config.json overlap layer direction, and this project has no active layer-direction rule to assign. Nothing staged."] };
  const integrity = layerRules.filter(rule => rule.integrity);
  if (integrity.length) return { errors: [`${integrity.map(rule => rule.id).join(", ")} ${integrity.length === 1 ? "is an" : "are"} integrity invariant${integrity.length === 1 ? "" : "s"}; PREGATE always enforces them. Nothing staged.`] };
  return { ids: [...new Set([...previous, ...layerRules.flatMap(rule => rule.aliases)])].sort() };
}

function isActiveLayerEdge(rule: LockRule, enforcement: Lock["enforcement"]): boolean {
  return rule.impl.kind === "primitive" && rule.impl.primitive === "layer-edge" && (rule.enforcement ?? enforcement) !== "shadow";
}

// Matches scan-command.ts withLayerPolicy: a map no rule reads gets the language's layer methodology.
function layerPolicy(root: string, preset: Preset, files: Files): { preset: Preset; lock: Lock; notes: string[] } | { errors: string[] } {
  const first = compile(root, preset);
  if (!("errors" in first) && !newBreak(first.lock).startsWith("not checked")) return { preset, lock: first.lock, notes: [] };
  const globs = Object.values(preset.layers ?? {}).flatMap(layer => layer.paths);
  const wanted = new Map(Object.keys(files).filter(path => globs.some(glob => matches(glob, path))).flatMap(path => {
    const policy = LAYERED[grammarOf(path) ?? ""];
    return policy ? [policy] : [];
  }));
  const added = [...wanted].filter(([, method]) => !preset.methodologies.includes(method));
  if (added.length === 0) return "errors" in first ? first : { preset, lock: first.lock, notes: ["No layer rule reads this map: no bundled layer policy covers the languages in these folders."] };
  const sources = [...preset.sources, ...librarySources().filter(pin => added.some(([ns]) => ns === pin.ns) && !preset.sources.some(source => source.ns === pin.ns))];
  const next = { ...preset, sources, methodologies: [...preset.methodologies, ...added.map(([, method]) => method)] };
  const second = compile(root, next);
  return "errors" in second ? second : { preset: next, lock: second.lock, notes: [`Added ${added.map(([, method]) => method).join(", ")} so a rule reads this map.`] };
}

function compile(root: string, preset: Preset): { lock: Lock } | { errors: string[] } {
  const result = validateContract({ presetText: JSON.stringify(preset), filesOf: sourcesOf(root, true), versions: VERSIONS, now: clock });
  return "errors" in result ? result : { lock: result.lock };
}

interface Translated { layers: Record<string, Layer>; notes: string[]; schemaVersion: string; core: string[]; blanketDenies: number }

function translate(text: string, files: Files): Translated | { errors: string[] } {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    return { errors: [`ark.config.json is not JSON: ${e.message}. Nothing staged.`] };
  }
  if (!isRecord(value)) return { errors: ["ark.config.json must be an object. Nothing staged."] };
  const errors: string[] = [];
  const unknown = unknownKeys(value, ROOT_KEYS);
  if (unknown.length) errors.push(`ark.config.json has unknown keys (${unknown.join(", ")}). ArkGate rejects unknown keys; PREGATE will not ignore them. Nothing staged.`);
  if (typeof value.$schema !== "string" || typeof value.schemaVersion !== "string" || !Array.isArray(value.include) || !Array.isArray(value.layers) || !Array.isArray(value.rules)) {
    errors.push("ark.config.json needs $schema, schemaVersion, include, layers and rules. PREGATE does not apply ArkGate's default layer matrix. Nothing staged.");
  }
  if (errors.length) return { errors };
  const notes = [`ArkGate include is ${(value.include as unknown[]).filter(item => typeof item === "string").join(", ") || "(empty)"}. PREGATE scope is unchanged.`];
  if (value.schemaVersion !== "1.3") notes.push(`schemaVersion is ${JSON.stringify(value.schemaVersion)}. The published ArkGate schema const is "1.3"; this file was read with the layer and rule shape both versions share.`);
  if (value.excludeGenerated === true) notes.push("ArkGate excludeGenerated is true. PREGATE generatedMarkers are unchanged.");
  for (const key of ["exclude", "frameworkOverlay", "cyclePolicy", "dynamicImportAllowlist", "safety", "coverage", "arkRules", "arkRun", "arkOrder", "stewards", "requireLayerOwners"]) {
    if (key in value) notes.push(`${key} stays with ArkGate. This import does not draft a pack or assign that mechanism to a PREGATE rule.`);
  }
  const named = slugs(value.layers as unknown[], files, notes, errors);
  if (named === null || errors.length) return { errors: errors.length ? errors : ["Nothing staged."] };
  const blanket = denies(value.rules as unknown[], named.slugOf, notes, errors);
  if (blanket === null || errors.length) return { errors };
  const layers: Record<string, Layer> = {};
  for (const layer of named.layers) {
    const mayImport = named.order.filter(slug => slug !== layer.slug && !blanket.get(layer.slug)?.has(slug)).sort();
    layers[layer.slug] = { paths: layer.paths, mayImport, kind: layer.kind };
  }
  const core = named.layers.filter(layer => layer.kind === "core").map(layer => layer.slug);
  if (core.length === 0) errors.push("No ArkGate layer maps to a core layer (domain, types, or application). @layers:core would match nothing. Nothing staged.");
  if (errors.length) return { errors };
  return { layers, notes, schemaVersion: String(value.schemaVersion), core, blanketDenies: [...blanket.values()].reduce((sum, set) => sum + set.size, 0) };
}

interface NamedLayer { slug: string; name: string; paths: string[]; kind: Layer["kind"] }

function slugs(layers: unknown[], files: Files, notes: string[], errors: string[]): { layers: NamedLayer[]; slugOf: Map<string, string>; order: string[] } | null {
  const slugOf = new Map<string, string>(), named: NamedLayer[] = [];
  for (const entry of layers) {
    if (!isRecord(entry)) { errors.push("Each ArkGate layer must be an object. Nothing staged."); continue; }
    const extra = unknownKeys(entry, LAYER_KEYS);
    if (extra.length) errors.push(`Layer ${JSON.stringify(entry.name)} has unknown keys (${extra.join(", ")}). Nothing staged.`);
    const patterns = stringList(entry.patterns), name = typeof entry.name === "string" ? entry.name : "";
    const slug = layerSlug(name);
    if (!name || patterns === null || slug === null) { errors.push(`Layer ${JSON.stringify(entry.name)} needs a name and patterns. Nothing staged.`); continue; }
    if (slugOf.has(name) || [...slugOf.values()].includes(slug)) errors.push(`Layer ${name} collides with another layer as ${slug}. Nothing staged.`);
    slugOf.set(name, slug);
    const exclude = entry.exclude === undefined ? [] : stringList(entry.exclude);
    if (exclude === null) { errors.push(`Layer ${name} exclude must be a list of globs. Nothing staged.`); continue; }
    const paths = keptPatterns(name, patterns, exclude, files, { notes, errors });
    named.push({ slug, name, paths, kind: kindOf(slug) });
    noteMechanisms(name, entry, notes);
  }
  if (named.length === 0 && errors.length === 0) errors.push("ark.config.json names no layers. Nothing staged.");
  return errors.length ? null : { layers: named, slugOf, order: named.map(layer => layer.slug) };
}

interface LayerReport { notes: string[]; errors: string[] }

function keptPatterns(name: string, patterns: string[], exclude: string[], files: Files, report: LayerReport): string[] {
  const { notes, errors } = report;
  const paths = Object.keys(files);
  const kept: string[] = [];
  for (const pattern of patterns) {
    if (pattern.includes("\\")) { errors.push(`Layer ${name} pattern ${pattern} uses a backslash. ArkGate globs use forward slashes. Nothing staged.`); continue; }
    const matched = paths.filter(path => matches(pattern, path));
    const excluded = exclude.length === 0 ? [] : matched.filter(path => exclude.some(glob => matches(glob, path)));
    if (excluded.length) notes.push(`Layer ${name} exclude ${exclude.join(", ")} matches ${excluded.slice(0, 5).join(", ")}. PREGATE layers have no exclude, so those files stay on ${pattern}. ArkGate still applies the exclude.`);
    if (matched.length > 0 && excluded.length === matched.length) notes.push(`Layer ${name} pattern ${pattern} matches only excluded files, so it is not copied.`);
    else kept.push(pattern);
  }
  const empty = kept.filter(pattern => !paths.some(path => matches(pattern, path)));
  if (kept.length === 0 || empty.length) errors.push(`Layer ${name} paths matching no file: ${(empty.length ? empty : patterns).join(", ")}. A layer that matches nothing checks nothing. Nothing staged.`);
  return kept;
}

function noteMechanisms(name: string, entry: Record<string, unknown>, notes: string[]): void {
  const globals = stringList(entry.forbiddenGlobals);
  if (globals?.length) notes.push(`Layer ${name} forbiddenGlobals (${globals.join(", ")}) stay with ArkGate and are not assigned to a PREGATE rule.`);
  if (isRecord(entry.capabilities)) notes.push(`Layer ${name} capabilities stay with ArkGate and are not assigned to a PREGATE rule.`);
  if (entry.pure === true) notes.push(`Layer ${name} pure stays with ArkGate and is not assigned to a PREGATE rule.`);
  if (Array.isArray(entry.entrypoints)) notes.push(`Layer ${name} entrypoints stay with ArkGate. PREGATE's layer map does not restrict which file an importer targets.`);
}

function denies(rules: unknown[], slugOf: Map<string, string>, notes: string[], errors: string[]): Map<string, Set<string>> | null {
  const blanket = new Map<string, Set<string>>(), allowed = new Map<string, Set<string>>();
  let walls = 0;
  for (const entry of rules) {
    if (!isRecord(entry)) { errors.push("Each ArkGate rule must be an object. Nothing staged."); continue; }
    const extra = unknownKeys(entry, RULE_KEYS);
    if (extra.length) errors.push(`Rule ${JSON.stringify(entry.from)} -> ${JSON.stringify(entry.to)} has unknown keys (${extra.join(", ")}). Nothing staged.`);
    const from = typeof entry.from === "string" ? slugOf.get(entry.from) : undefined;
    const to = typeof entry.to === "string" ? slugOf.get(entry.to) : undefined;
    if (from === undefined || to === undefined || typeof entry.allowed !== "boolean") {
      errors.push(`Rule ${JSON.stringify(entry.from)} -> ${JSON.stringify(entry.to)} needs from, to and allowed, and both layers must be declared. Nothing staged.`);
      continue;
    }
    if (entry.peerIsolation === true) { walls++; continue; }
    if (from === to && entry.allowed === false) { errors.push(`Rule ${entry.from} -> ${entry.to} denies a layer to itself. PREGATE allows imports inside a layer, so that deny cannot be represented. Nothing staged.`); continue; }
    const book = entry.allowed ? allowed : blanket;
    book.set(from, (book.get(from) ?? new Set()).add(to));
  }
  for (const [from, targets] of blanket) for (const to of targets) if (allowed.get(from)?.has(to)) errors.push(`Rules disagree on ${from} -> ${to} (allowed both true and false). Nothing staged.`);
  if (walls) notes.push(`${walls} peerIsolation rule${walls === 1 ? "" : "s"} ${walls === 1 ? "is a slice wall" : "are slice walls"}, not a blanket layer ban, so ${walls === 1 ? "it does" : "they do"} not remove a layer from mayImport.`);
  return errors.length ? null : blanket;
}

function layerSlug(name: string): string | null {
  const slug = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase().replace(/^-+|-+$/g, "");
  return /^[a-z][a-z0-9-]*$/.test(slug) ? slug : null;
}

function kindOf(slug: string): Layer["kind"] {
  const key = slug.replaceAll("-", "");
  if (MAIN.has(key)) return "main";
  if (key === "port" || key === "ports" || key.endsWith("ports")) return "port";
  if (CORE.has(key)) return "core";
  return "adapter";
}

function unknownKeys(value: Record<string, unknown>, known: readonly string[]): string[] {
  return Object.keys(value).filter(key => !known.includes(key)).sort();
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === "string" && item.length > 0) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
