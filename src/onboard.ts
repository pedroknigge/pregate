import { analyze } from "./evaluate.ts";
import { enforcementOf } from "./enforcement.ts";
import { loadTsPaths, resolve } from "./resolve.ts";
import { grammarOf, imports, parse, type Parsed } from "./ts.ts";
import type { Clock, Files, Layer, LibrarySource, Lock, Preset, Read } from "./types.ts";
import { inScope, layerOf as layerIn, matches } from "./paths.ts";

export interface Stack {
  languages: string[]; frameworks: string[]; layers: string[]; edges: string[];
  recommended: "backend-clean-ddd" | "functional-ts" | "legacy-safe" | "integrity-only" | "python-starter" | "go-starter" | "rust-starter" | "mixed-starter";
}
interface EngineVersions { engine: string; core: string }
const LANGUAGES: Record<string, string> = { ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", py: "Python", go: "Go", rs: "Rust", java: "Java", rb: "Ruby", vue: "Vue", svelte: "Svelte", astro: "Astro", c: "C", h: "C", cc: "C++", cpp: "C++", hpp: "C++", cs: "C#", php: "PHP", kt: "Kotlin", swift: "Swift", dart: "Dart" };
const FRAMEWORKS = ["next", "react", "vue", "svelte", "astro", "express", "fastify", "@nestjs/core", "hono"];
// Vue and React are compiled into a server app's frontend, so the package is often
// a devDependency and the server never imports it. Other names stay on dependencies
// and peerDependencies. Svelte is not in this set: a `.svelte` file selects that pack,
// and a devDependency must not, because the Svelte repository lists `svelte` as a
// root `workspace:*` devDependency.
export const DEV_DEPENDENCY_FRAMEWORKS = new Set(["react", "vue"]);
const LAYERS = new Set(["core", "domain", "application", "ports", "infra", "infrastructure", "shell", "adapters", "presentation"]);
// Conventional folder names and the inward direction each may import. `app` counts only beside
// a domain or core folder, so a framework's app/ router is not mistaken for a layer.
const OUTER = ["domain", "core", "application", "app", "ports"];
const LAYER_ROLES: Record<string, { kind: Layer["kind"]; may: string[] }> = {
  domain: { kind: "core", may: [] }, core: { kind: "core", may: [] },
  application: { kind: "core", may: ["domain", "core", "ports"] }, app: { kind: "core", may: ["domain", "core", "ports"] },
  ports: { kind: "port", may: ["domain", "core"] },
  ...Object.fromEntries(["infra", "infrastructure", "adapters", "shell", "presentation"].map(name => [name, { kind: "adapter" as const, may: OUTER }])),
};
// An `app` folder whose files import a web framework is the HTTP entry point, not application
// core: it is an adapter, may import inward, and no other adapter may import it.
const APP_SHELL = { kind: "adapter" as const, may: ["domain", "core", "application", "ports"] };
const WEB_IMPORT = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(?\s*)["'](?:express|fastify|hono|koa|@hapi\/hapi|@nestjs\/[\w-]+)["']|^\s*(?:from|import)\s+(?:flask|fastapi|django|starlette)\b/m;

export function onboardingFile(path: string): boolean {
  return /(^|\/)(go\.(mod|work)|Cargo\.(toml|lock)|pyproject\.toml|requirements\.txt|Pipfile)$/.test(path) || path.toLowerCase().endsWith(".json") || Object.hasOwn(LANGUAGES, path.split(".").pop()!.toLowerCase());
}

export function detectedScope(files: Files, scope: Preset["scope"]): NonNullable<Preset["scope"]> {
  const include = [...(scope?.include ?? ["**"])];
  for (const path of Object.keys(files).sort().filter(path => grammarOf(path) !== null)) {
    if (include.some(glob => matches(glob, path))) continue;
    const root = path.includes("/") ? path.split("/")[0] + "/**" : path;
    if (!include.includes(root)) include.push(root);
  }
  return { ...scope, include, exclude: scope?.exclude ?? [] };
}

// A new project's scope: the recipe's include globs that match some file (a recipe written for
// src/ and lib/ proposes no lib/** where there is none), then every detected source root.
export function initialScope(files: Files, scope: Preset["scope"]): NonNullable<Preset["scope"]> {
  const paths = Object.keys(files);
  const used = scope?.include?.filter(glob => paths.some(path => matches(glob, path)));
  return detectedScope(files, used?.length ? { ...scope, include: used } : scope);
}

export function scopeCoverage(files: Files, scope: Preset["scope"]) {
  const sourceLike = Object.keys(files).sort().filter(path => Object.hasOwn(LANGUAGES, path.split(".").pop()!.toLowerCase()));
  const paths = sourceLike.filter(path => grammarOf(path) !== null);
  const unsupported = sourceLike.filter(path => grammarOf(path) === null);
  const effective = { include: scope?.include ?? ["**"], exclude: scope?.exclude ?? [] };
  const covered = paths.filter(path => inScope({ scope: effective } as Lock, path));
  const outside = paths.filter(path => !(scope?.include ?? ["**"]).some(glob => matches(glob, path)));
  const excluded = paths.filter(path => effective.include.some(glob => matches(glob, path)) && effective.exclude.some(glob => matches(glob, path)));
  const [coveredSet, outsideSet, excludedSet] = [covered, outside, excluded].map(paths => new Set(paths));
  const roles = ["production-candidate", "tests", "examples", "fixtures", "vendor/generated"].map(role => {
    const selected = paths.filter(path => sourceRole(path) === role);
    return { role, parserSupported: selected.length, inScope: selected.filter(path => coveredSet!.has(path)).length,
      outsideScope: selected.filter(path => outsideSet!.has(path)).length, excluded: selected.filter(path => excludedSet!.has(path)).length,
      unsupported: unsupported.filter(path => sourceRole(path) === role).length };
  });
  return { inventoried: paths.length, inScope: covered.length, outsideScope: outside, excluded,
    sourceLikeInventoried: sourceLike.length, unsupported, roles };
}

export function sourceRole(path: string): string {
  if (/(^|\/)(vendor|node_modules|dist|generated|\.next)(\/|$)/.test(path)) return "vendor/generated";
  if (/(^|\/)(fixtures?|testdata|__fixtures__)(\/|$)/.test(path)) return "fixtures";
  if (/(^|\/)(examples?|samples?|demos?|playground)(\/|$)/.test(path)) return "examples";
  if (/(^|\/)(__tests__|tests?|e2e|spec)(\/|$)|\.(test|spec)\.[^/]+$/.test(path)) return "tests";
  return "production-candidate";
}

export function scopeCoverageText(coverage: ReturnType<typeof scopeCoverage>): string[] {
  return [`Source inventory: ${coverage.inScope}/${coverage.inventoried} parser-supported source files are in scope; ${coverage.outsideScope.length} outside include patterns; ${coverage.excluded.length} explicitly excluded. This is scope coverage, not rule or behavior coverage.`,
    `Unsupported source-like files: ${coverage.unsupported.length}; ${coverage.sourceLikeInventoried} total inventoried source-like files. Unsupported bodies are not analyzed.`,
    ...coverage.roles.filter(role => role.parserSupported || role.unsupported).map(role => `Advisory role ${role.role}: ${role.inScope}/${role.parserSupported} parser-supported files in scope; ${role.unsupported} without a parser. Role labels do not exclude files or certify production use.`),
    ...coverage.unsupported.slice(0, 8).map(path => `Without parser: ${path}`),
    ...coverage.outsideScope.slice(0, 8).map(path => `Outside scope: ${path}`),
    ...coverage.excluded.slice(0, 5).map(path => `Excluded by policy: ${path}`)];
}

export function detectStack(files: Files): Stack {
  const paths = Object.keys(files).sort();
  const languages = [...new Set(paths.flatMap((p) => {
    const ext = p.split(".").pop()!.toLowerCase();
    return Object.hasOwn(LANGUAGES, ext) ? LANGUAGES[ext]! : [];
  }))].sort();
  // A devDependency is tooling for tests or builds, except Vue and React: a server app
  // compiles those into static assets and does not import the package at runtime.
  const pkg = files["package.json"] === undefined ? {} : JSON.parse(files["package.json"]) as { dependencies?: object; devDependencies?: object; peerDependencies?: object };
  const dev = (pkg.devDependencies ?? {}) as Record<string, unknown>;
  const bundled = Object.fromEntries(Object.entries(dev).filter(([name]) => DEV_DEPENDENCY_FRAMEWORKS.has(name)));
  const dependencies = { ...pkg.dependencies, ...pkg.peerDependencies, ...bundled };
  const frameworks = FRAMEWORKS.filter((f) => f in dependencies);
  if (files["tsconfig.json"] !== undefined && !languages.includes("TypeScript")) languages.push("TypeScript");
  if (paths.some((p) => /(^|\/)(pyproject\.toml|requirements\.txt|Pipfile)$/.test(p)) && !languages.includes("Python")) languages.push("Python");
  if (paths.some((p) => /(^|\/)go\.(mod|work)$/.test(p)) && !languages.includes("Go")) languages.push("Go");
  if (paths.some((p) => /(^|\/)Cargo\.toml$/.test(p)) && !languages.includes("Rust")) languages.push("Rust");
  const layers = [...new Set(paths.flatMap((p) => p.split("/").slice(0, -1).filter((d) => LAYERS.has(d))))].sort();
  const supported = paths.some((p) => ["typescript", "tsx"].includes(grammarOf(p) ?? "")) || languages.includes("TypeScript");
  const foreign = ["Python", "Go", "Rust"].filter((l) => languages.includes(l));
  const recommended = foreign.length > 1 || (foreign.length > 0 && supported) ? "mixed-starter"
    : foreign[0] === "Python" ? "python-starter" : foreign[0] === "Go" ? "go-starter" : foreign[0] === "Rust" ? "rust-starter"
    : !supported ? "integrity-only" : layers.includes("domain") && layers.includes("application") ? "backend-clean-ddd"
    : layers.includes("core") && detectLayers(files).core !== undefined ? "functional-ts" : "legacy-safe";   // a core/ the code contradicts is no functional core
  return { languages: languages.sort(), frameworks, layers, edges: importEdges(files), recommended };
}

function importEdges(files: Files): string[] {
  const read = (p: string) => files[p] ?? null;
  const ts = loadTsPaths(read);
  const edges = new Set<string>();
  for (const [path, text] of Object.entries(files).sort()) {
    if (grammarOf(path) === null) continue;
    addLayerEdges(parse(path, text), ts, read, edges);
  }
  return [...edges].sort();
}

function addLayerEdges(parsed: Parsed, ts: ReturnType<typeof loadTsPaths>, read: Read, edges: Set<string>): void {
  try {
    for (const imp of imports(parsed)) {
      if (!imp.literal) continue;
      const to = resolve(parsed.rel, imp.spec, ts, read, imp.base);
      if (typeof to !== "object") continue;
      const a = layerOf(parsed.rel), b = layerOf(to.rel);
      if (a && b && a !== b) edges.add(`${a} → ${b} (${parsed.rel} imports ${to.rel})`);
    }
  } finally { parsed.root.tree.delete(); }
}

function layerOf(p: string): string | undefined { return p.split("/").find((d) => LAYERS.has(d)); }

// Derive a reviewable layer map from conventional folders under any source root (src/, source/,
// packages/x/src/). Tests, fixtures, examples and vendored code never define a layer. The map
// is empty unless it has a core-kind layer, because `@layers:core` rules need one to compile.
export function detectLayers(files: Files): Record<string, Layer> {
  return deriveLayers(files).layers;
}

// A folder name is only a guess: a library's core/ importing ../utils is not an import-nothing
// core. A layer whose own code imports in-repo code outside every layer, or a module no resolver
// can place, would flag the project at adoption. So an adapter is relaxed to import anything and a
// core or port layer is dropped, each named, until the map fits. Edges between layers stay findings.
export function deriveLayers(files: Files): { layers: Record<string, Layer>; notes: string[] } {
  const layers = namedLayers(files), notes: string[] = [];
  const edges = layerImports(files, layers);
  for (let conflict = misfit(layers, edges); conflict; conflict = misfit(layers, edges)) {
    const [name, from, to] = conflict, layer = layers[name]!;
    const where = `${from} imports ${to === "unresolved" ? "a module that cannot be resolved" : `${to}, which is outside every layer`}`;
    if (layer.kind === "adapter" || layer.kind === "main") {
      layer.mayImport = ["*"];
      notes.push(`Layer ${name} may import any code: ${where}.`);
      continue;
    }
    delete layers[name];
    for (const other of Object.values(layers)) other.mayImport = other.mayImport.filter(n => n !== name);
    notes.push(`Layer ${name} (${layer.paths.map(glob => glob.slice(0, -"/**".length)).join(", ")}) not proposed: ${where}.`);
  }
  return { layers: Object.values(layers).some(layer => layer.kind === "core") ? layers : {}, notes };
}

type LayerEdge = [from: string, to: string];   // `to` is a repo path or "unresolved"

// Each in-layer production file's in-repo import targets, resolved once as the engine resolves them.
function layerImports(files: Files, layers: Record<string, Layer>): LayerEdge[] {
  const lock = { layers } as Lock;
  return importsOf(files, productionPaths(files).filter(path => layerIn(lock, path) !== null));
}

function productionPaths(files: Files): string[] {
  return Object.keys(files).sort().filter(path => grammarOf(path) !== null && sourceRole(path) === "production-candidate");
}

function importsOf(files: Files, paths: string[]): LayerEdge[] {
  const read = (p: string) => files[p] ?? null;
  const ts = loadTsPaths(read);
  return paths.flatMap(path => targetsOf(parse(path, files[path]!), ts, read).map((to): LayerEdge => [path, to]));
}

// What a layer map reports on the code as it is, before anyone approves it: per layer, the
// production imports that already break its direction, and the sibling folders the map leaves
// unrestricted. It is evidence for the review, not a verdict; the engine checks tests as well.
export interface LayerEvidence {
  layers: { name: string; files: number; broken: { to: string; count: number; example: string }[] }[];
  unplaced: { dir: string; files: number; imports: string[] }[];
}

const UNRESOLVED = "a module that cannot be resolved", OUTSIDE = "code outside every layer";

export function layerEvidence(files: Files, layers: Record<string, Layer>): LayerEvidence {
  const lock = { layers } as Lock, paths = productionPaths(files);
  const edges = importsOf(files, paths);
  return { layers: Object.keys(layers).sort().map(name => ({ name, files: paths.filter(path => layerIn(lock, path) === name).length, broken: brokenEdges(lock, name, edges) })),
    unplaced: unplacedFolders(lock, paths, edges) };
}

function brokenEdges(lock: Lock, name: string, edges: LayerEdge[]): LayerEvidence["layers"][number]["broken"] {
  const layer = lock.layers[name]!, broken = new Map<string, { to: string; count: number; example: string }>();
  if (layer.mayImport.includes("*")) return [];
  for (const [from, to] of edges) {
    if (layerIn(lock, from) !== name) continue;
    const target = to === "unresolved" ? null : layerIn(lock, to);
    if (to !== "unresolved" && target !== null && (target === name || layer.mayImport.includes(target))) continue;
    const label = to === "unresolved" ? UNRESOLVED : target ?? OUTSIDE;
    const entry = broken.get(label) ?? { to: label, count: 0, example: `${from} imports ${to === "unresolved" ? UNRESOLVED : to}` };
    entry.count++;
    broken.set(label, entry);
  }
  return [...broken.values()].sort((a, b) => b.count - a.count || a.to.localeCompare(b.to));
}

// A production folder beside a layer folder that no layer glob covers. Its imports are unrestricted,
// so the reviewer sees which code the map says nothing about and what that code reaches.
function unplacedFolders(lock: Lock, paths: string[], edges: LayerEdge[]): LayerEvidence["unplaced"] {
  const parents = [...new Set(Object.values(lock.layers).flatMap(layer => layer.paths.map(layerParent)))].sort((a, b) => b.length - a.length);
  const folderOf = (path: string): string | null => {
    if (layerIn(lock, path) !== null) return null;
    const parent = parents.find(dir => dir === "" || path.startsWith(`${dir}/`));
    if (parent === undefined) return null;
    const rest = path.slice(parent === "" ? 0 : parent.length + 1).split("/");
    return rest.length === 1 ? `${parent || "."}/*` : `${parent === "" ? "" : `${parent}/`}${rest[0]}`;
  };
  const found = new Map<string, { files: number; imports: Set<string> }>();
  for (const path of paths) {
    const dir = folderOf(path);
    if (dir !== null) found.set(dir, { files: (found.get(dir)?.files ?? 0) + 1, imports: found.get(dir)?.imports ?? new Set() });
  }
  for (const [from, to] of edges) {
    const dir = folderOf(from), target = to === "unresolved" ? null : layerIn(lock, to) ?? folderOf(to);
    if (dir !== null && target !== null && target !== dir) found.get(dir)!.imports.add(target);
  }
  return [...found].map(([dir, entry]) => ({ dir, files: entry.files, imports: [...entry.imports].sort() })).sort((a, b) => a.dir.localeCompare(b.dir));
}

// `src/domain/**` sits in `src`; a single-file layer path sits in its own folder.
function layerParent(glob: string): string {
  const dir = glob.replace(/\/\*\*$/, "").replace(/\/?[^/]*[*?[{][^/]*(\/.*)?$/, "");
  return dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "";
}

// What the next forbidden import meets under this candidate: the mode of its layer rule.
export function newBreak(lock: Lock): string {
  const rules = lock.rules.filter(r => r.impl.kind === "primitive" && r.impl.primitive === "layer-edge");
  const rule = rules.find(r => !lock.ownedByArkgate.includes(r.id));
  if (rules.length === 0) return "not checked, because no layer rule is selected";
  if (rule === undefined) return "not reported by PREGATE; ArkGate already enforces layer direction";
  const mode = enforcementOf(lock, rule);
  return mode === "enforce" ? "blocked before the file is written" : mode === "advisor" ? "reported to the agent with the repair, and not blocked" : "recorded only (shadow)";
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// The review lines for that evidence. `consequence` says what a new break meets under the
// proposed mode, so the reader sees what approval changes for the next edit.
export function layerEvidenceLines(evidence: LayerEvidence, ratchet: string, consequence: string): string[] {
  const broken = evidence.layers.filter(layer => layer.broken.length > 0), clean = evidence.layers.filter(layer => layer.broken.length === 0);
  const total = broken.reduce((sum, layer) => sum + layer.broken.reduce((n, edge) => n + edge.count, 0), 0);
  return [
    ...broken.flatMap(layer => layer.broken.map(edge => `Layer ${layer.name} (${count(layer.files, "file")}): ${count(edge.count, "existing import")} of ${edge.to}, which it may not import. Example: ${edge.example}.`)),
    ...(clean.length ? [`Layers with no existing break: ${clean.map(layer => `${layer.name} (${count(layer.files, "file")})`).join(", ")}.`] : []),
    ...(evidence.layers.length ? [`${total === 0 ? "No production import breaks this map today." : ratchet === "no-new" ? `The ${count(total, "existing break")} stay${total === 1 ? "s" : ""} as known debt under no-new.` : `The ${count(total, "existing break")} ${total === 1 ? "is a finding" : "are findings"} from the first check.`} A new break is ${consequence}.`] : []),
    ...(evidence.unplaced.length ? [`Not in any layer, so imports there are unrestricted: ${evidence.unplaced.slice(0, 8).map(folder => `${folder.dir} (${count(folder.files, "file")}${folder.imports.length ? `; imports ${folder.imports.slice(0, 6).join(", ")}` : ""})`).join("; ")}${evidence.unplaced.length > 8 ? `; +${evidence.unplaced.length - 8} more` : ""}.`,
      "To place them, the agent inspects pregate layers --json and proposes a map with pregate layers apply <layers.json> --preview."] : []),
  ];
}

function targetsOf(parsed: Parsed, ts: ReturnType<typeof loadTsPaths>, read: Read): string[] {
  try { return importTargets(parsed, ts, read); }
  finally { parsed.root.tree.delete(); }
}

// In Python, Go and Rust a restricted layer denies a computed import by form, as the engine does.
function importTargets(parsed: Parsed, ts: ReturnType<typeof loadTsPaths>, read: Read): string[] {
  const computedDenies = ["python", "go", "rust"].includes(grammarOf(parsed.rel) ?? "");
  return imports(parsed).flatMap(imp => {
    if (!imp.literal) return computedDenies ? ["unresolved"] : [];
    const to = resolve(parsed.rel, imp.spec, ts, read, imp.base);
    return typeof to === "object" ? [to.rel] : to === "unresolved" ? [to] : [];
  });
}

// The first layer whose own code reaches code outside every layer, unless it may import anything.
function misfit(layers: Record<string, Layer>, edges: LayerEdge[]): [layer: string, from: string, to: string] | null {
  const lock = { layers } as Lock;
  for (const [from, to] of edges) {
    const name = layerIn(lock, from);
    if (name === null || layers[name]!.mayImport.includes("*")) continue;
    if (to === "unresolved" || layerIn(lock, to) === null) return [name, from, to];
  }
  return null;
}

function namedLayers(files: Files): Record<string, Layer> {
  const paths =Object.keys(files).filter(path => grammarOf(path) !== null && sourceRole(path) === "production-candidate");
  const dirs = new Set(paths.flatMap(path => path.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
  const found = new Map<string, Set<string>>();
  for (const path of paths) {
    for (const [name, dir] of layerDirsOf(path, dirs)) found.set(name, (found.get(name) ?? new Set()).add(`${dir}/**`));
  }
  const shell = found.has("app") && paths.some(path => [...found.get("app")!].some(glob => matches(glob, path)) && WEB_IMPORT.test(files[path] ?? ""));
  const role = (name: string) => (shell && name === "app" ? APP_SHELL : LAYER_ROLES[name]!);
  if (![...found.keys()].some(name => role(name).kind === "core")) return {};
  return Object.fromEntries([...found.keys()].sort().map(name => [name, {
    paths: [...found.get(name)!].sort(), mayImport: role(name).may.filter(other => found.has(other) && !(shell && other === "app")).sort(), kind: role(name).kind }]));
}

// The first layer-named folder owns the file; a ports folder directly inside it is its own
// layer, and its more literal glob wins when the engine resolves a path's layer.
function layerDirsOf(path: string, dirs: Set<string>): [string, string][] {
  const parts = path.split("/").slice(0, -1);
  const index = parts.findIndex((part, i) => isLayer(part, parts.slice(0, i).join("/"), dirs));
  if (index === -1) return [];
  const dir = parts.slice(0, index + 1).join("/");
  return parts[index + 1] === "ports" ? [[parts[index]!, dir], ["ports", `${dir}/ports`]] : [[parts[index]!, dir]];
}

function isLayer(part: string, parent: string, dirs: Set<string>): boolean {
  if (!Object.hasOwn(LAYER_ROLES, part)) return false;
  return part !== "app" || ["domain", "core"].some(name => dirs.has(parent ? `${parent}/${name}` : name));
}

export function layersMatchAny(layers: Preset["layers"], paths: string[]): boolean {
  return Object.values(layers ?? {}).some(layer => layer.paths.some(glob => paths.some(path => matches(glob, path))));
}

// One line naming every layer glob that matches no file: layer rules check nothing there.
export function emptyLayerLines(layers: Preset["layers"], paths: string[]): string[] {
  const empty = Object.entries(layers ?? {}).flatMap(([name, layer]) =>
    layer.paths.filter(glob => !paths.some(path => matches(glob, path))).map(glob => `${name} (${glob})`));
  return empty.length ? [`Layer paths matching no files: ${empty.join(", ")}. Layer rules check nothing there; adjust the paths.`] : [];
}

// [ ] { } are glob syntax, so a written Next.js segment such as `app/[view]/**` or `[[...rest]]`
// matches nothing (#66). One line naming each preset glob that matches no file while an escaped
// form does, written as a JSON string so it pastes into preset or request JSON. `paths` is lazy so
// a preset without such characters never lists the project; null means the listing failed.
export function deadGlobLines(preset: Preset, paths: () => string[] | null): string[] {
  const suspects = presetGlobs(preset).filter(glob => /[[\]{}]/.test(glob));
  if (suspects.length === 0) return [];
  const files = paths();
  if (files === null) return ["Glob check skipped: project files could not be listed."];
  const dead = suspects.filter(glob => !files.some(path => matches(glob, path)))
    .flatMap(glob => { const fixed = escapedGlob(glob, files); return fixed === null ? [] : [`${glob} (in JSON: ${JSON.stringify(fixed)})`]; });
  return dead.length ? [`Globs matching no project file: ${dead.join(", ")}. [ ] { } are glob syntax; escape them as shown or use the exact path.`] : [];
}

// Brackets first (Next.js segments), then braces, then both, so a working `{ts,tsx}` stays syntax.
function escapedGlob(glob: string, files: string[]): string | null {
  return [/(?<!\\)[[\]]/g, /(?<!\\)[{}]/g, /(?<!\\)[[\]{}]/g].map(chars => glob.replace(chars, "\\$&"))
    .find(escaped => files.some(path => matches(escaped, path))) ?? null;
}

// Only globs written in the preset text: scope and rule params.paths/exclude/within. `@layer`
// macros and pack defaults are not the author's text. Status passes an unvalidated preset, so
// null entries are skipped rather than trusted.
function presetGlobs(preset: Preset): string[] {
  const params = [...Object.values(preset.overrides ?? {}), ...Object.values(preset.resolve ?? {})]
    .flatMap(entry => typeof entry === "object" && entry?.params ? [entry.params] : []);
  const lists = [preset.scope?.include, preset.scope?.exclude, ...params.flatMap(p => [p.paths, p.exclude, p.within])];
  return [...new Set(lists.flatMap(list => Array.isArray(list) ? list : [])
    .filter((glob): glob is string => typeof glob === "string" && !glob.startsWith("@")))];
}

export function onboardingPreset(name: string, catalog: Files, versions: EngineVersions, stack?: Stack, library: LibrarySource[] = []): Preset | null {
  const text = catalog[`presets/${name}.json`];
  const starter = ["python-starter", "go-starter", "rust-starter", "mixed-starter"].includes(name);
  if (name !== "integrity-only" && !starter && text === undefined) return null;
  const preset: Preset = text === undefined ? { name, version: "1.0.0", engine: versions.engine, sources: [], methodologies: ["core/pregate-integrity"] } : JSON.parse(text);
  preset.engine = versions.engine;
  preset.sources = [{ ns: "core", kind: "builtin", version: versions.core },
    ...preset.sources.filter((s) => s.kind !== "builtin")];
  if (starter) {
    const names = { python: "Python", go: "Go", rust: "Rust" };
    const languages = name === "mixed-starter" ? Object.keys(names).filter(lang => stack === undefined || stack.languages.includes(names[lang as keyof typeof names])) : [name.slice(0, -"-starter".length)];
    const pins = languages.flatMap((ns) => library.filter((source) => source.ns === ns));
    if (pins.length !== languages.length) return null;
    preset.sources.push(...pins);
    preset.methodologies.push(...languages.map((ns) => ns + "/quality"));
    if (name === "mixed-starter" && (stack === undefined || stack.languages.some((lang) => ["TypeScript", "JavaScript"].includes(lang)))) {
      const policy = library.find((s) => s.ns === "clean-code");
      if (!policy) return null;
      preset.sources.push(policy);
      preset.methodologies.push("clean-code/clean-code");
    }
    preset.scope = { include: ["**"], exclude: ["vendor/**", "dist/**", "build/**", ".venv/**", "venv/**", "__pycache__/**", "node_modules/**", ...(languages.includes("rust") ? ["target/**", "**/target/**"] : [])] };
  }
  preset.enforcement = "shadow";
  delete (preset as Preset & { $schema?: string }).$schema;
  return preset;
}

function policyMatches(lock: Lock, parsed: Parsed, files: Files, now: Clock): string[] {
  try {
    const result = analyze(lock, "pre", parsed.rel, parsed, { read: (p) => files[p] ?? null, now, hash: false });
    return "cause" in result ? [`${parsed.rel}:${result.line ?? 1}: ${result.cause}`] : result.violations.map((v) => `${v.path}:${v.line}: ${v.rule}`);
  } finally { parsed.root.tree.delete(); }
}

// Counts per pack; only ordinary rules whose policy differs from the project default are listed.
function acceptedPolicy(lock: Lock): string[] {
  const packs = [...new Set(lock.rules.map((r) => r.id.split("/")[0]!))].map((ns) => {
    const rules = lock.rules.filter((r) => r.id.startsWith(`${ns}/`));
    const evidence = rules.filter((r) => r.impl.kind === "primitive" && r.impl.primitive === "fitness").length;
    return `${ns} ${rules.length - evidence} rules`;   // unbound requirements check nothing yet; fitness status lists them
  });
  const overrides = lock.rules.filter((r) => !r.integrity && enforcementOf(lock, r) !== lock.enforcement);
  return [`If you accept: ${packs.join(", ")}. Ordinary rules run in ${lock.enforcement} mode.`,
    ...(overrides.length ? ["Per-rule overrides:", ...overrides.map((r) => `  ${r.id} (${r.severity}, ${enforcementOf(lock, r)}): ${r.text.why}`)] : [])];
}

export function onboardingCard(stack: Stack, lock: Lock, files: Files, now: Clock): string {
  const matches = Object.entries(files).sort().flatMap(([path, text]) => {
    if (grammarOf(path) === null) return [];
    return policyMatches(lock, parse(path, text), files, now);
  });
  return [
    `Recommended: ${stack.recommended}. Selected: ${lock.preset.name}.`,
    ...scopeCoverageText(scopeCoverage(files, lock.scope)),
    `Languages: ${stack.languages.join(", ") || "none detected"}. Frameworks: ${stack.frameworks.join(", ") || "none detected"}.`,
    `Candidate layers: ${stack.layers.join(", ") || "none"}.`, ...emptyLayerLines(lock.layers, Object.keys(files)), ...stack.edges,
    ...acceptedPolicy(lock),
    ...(matches.length ? matches.slice(0, 5).map((m) => `Example from your repo: ${m}`) : ["No existing matches found in the analyzed files."]),
    `Optional-pack enforcement: ${lock.enforcement}; per-rule overrides take precedence. All core requirements activate and enforce by default; a human can explicitly disable them.`,
    "Optional later: bind project checks of your own with pregate fitness plan.",
    "Parsers cover JS/TS, Python, Go and Rust source AST. Language-specific starters select bundled quality policies. Architecture/effects require declared layers and explicit selection; Rust macros and compiler/type resolution need separate evidence.",
  ].join("\n");
}
