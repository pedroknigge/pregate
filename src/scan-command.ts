import { canonical, findRoot } from "./disk.ts";
import { visible } from "./contract.ts";
import { repoFiles } from "./init.ts";
import { deadGlobLines, deriveLayers, detectedScope, detectLayers, detectStack, DEV_DEPENDENCY_FRAMEWORKS, emptyLayerLines, layerEvidence, layerEvidenceLines, newBreak, initialScope as newProjectScope, onboardingPreset, scopeCoverage, scopeCoverageText, sourceRole } from "./onboard.ts";
import { imports, parse } from "./ts.ts";
import { clock, readText, PRESET, sourcesOf, VERSIONS } from "./gate.ts";
import { applyPreset } from "./approval-command.ts";
import { validateContract } from "./contract.ts";
import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { BUILTIN } from "./assets.ts";
import { join } from "node:path";
import { validate } from "./schema.ts";
import { grammars } from "./gate.ts";
import { git } from "./git.ts";
import { hasRepository } from "./workspace.ts";
import { librarySources } from "./library.ts";
import { librarySource } from "./library.ts";
import { packCatalog, patternsOf } from "./compile.ts";
import { grammarOf, languageApplies } from "./languages.ts";
import { inScope, layerOf, matches } from "./paths.ts";
import type { Files, Layer, Lock, Preset } from "./types.ts";
import { discoverDocumentation } from "./project-discovery.ts";

// Exact manifest dependencies are evidence for applicability, not for compliance.
// Token, CORS and LLM SDKs make the client-and-agents hardening checks applicable.
// `svelte` and `@sveltejs/*` use that same shipped-dependency evidence. The package
// named `svelte`, a `.svelte` file, or `svelte.config.*` also select the Svelte pack.
// A Svelte devDependency does not: the Svelte repository lists `svelte` as `workspace:*`.
// `vue` is a dependency, a peer dependency, a devDependency, or a `.vue` file.
// `react` counts from those same manifest fields. A server app often compiles the
// frontend and does not import `vue` or `react` at runtime, so the package lives in
// devDependencies. A `.vue` file does not add a package owner.
// `astro` is only that shipped dependency. `astro.config.*` and `.astro` files do not
// select it: the engine does not parse `.astro`.
// TanStack Query framework adapters select that pack. `@tanstack/query-core`, devtools,
// and a dependency that exists only under a docs, examples, or fixtures tree do not.
// `hono` is only the package named `hono` in dependencies or peerDependencies.
const CLIENT_SECURITY: [string, string[]] = ["security-audit", ["security-audit/client-and-agents"]];
const REACT: [string, string[]] = ["react", ["react/components", "react/hooks"]];
const VUE: [string, string[]] = ["vue", ["vue/reactivity", "vue/sfc"]];
const SVELTE: [string, string[]] = ["svelte", ["svelte/runes", "svelte/stores"]];
const ASTRO: [string, string[]] = ["astro", ["astro/config", "astro/content", "astro/routing"]];
const TANSTACK_QUERY: [string, string[]] = ["tanstack-query", ["tanstack-query/keys", "tanstack-query/client"]];
const DEPENDENCIES: Record<string, [string, string[]]> = {
  next: ["nextjs", ["nextjs/rendering", "nextjs/routing"]],
  react: REACT,
  vue: VUE,
  astro: ASTRO,
  svelte: SVELTE,
  "drizzle-orm": ["drizzle", ["drizzle/queries", "drizzle/schema"]],
  "@supabase/supabase-js": ["supabase", ["supabase/client", "supabase/storage"]],
  "@nestjs/core": ["nestjs", ["nestjs/controllers", "nestjs/providers"]],
  express: ["express", ["express/middleware", "express/requests"]],
  hono: ["hono", ["hono/routing", "hono/middleware"]],
  "@trpc/server": ["trpc", ["trpc/router"]],
  "@trpc/client": ["trpc", ["trpc/client"]],
  "@tanstack/react-query": TANSTACK_QUERY,
  "@tanstack/vue-query": TANSTACK_QUERY,
  "@tanstack/solid-query": TANSTACK_QUERY,
  "@tanstack/svelte-query": TANSTACK_QUERY,
  "@tanstack/angular-query": TANSTACK_QUERY,
  "@tanstack/angular-query-experimental": TANSTACK_QUERY,
  "@prisma/client": ["prisma", ["prisma/client", "prisma/writes"]],
  "next-auth": ["authjs", ["authjs/config", "authjs/session"]],
  dcouplr: ["dcouplr", ["dcouplr/factories", "dcouplr/managed-components"]],
  jsonwebtoken: CLIENT_SECURITY, jose: CLIENT_SECURITY, cors: CLIENT_SECURITY,
  openai: CLIENT_SECURITY, "@anthropic-ai/sdk": CLIENT_SECURITY, ai: CLIENT_SECURITY,
};

interface Recommendation {
  ns: string; reasons: string[]; methodologies: string[];
  scope?: { include: string[]; exclude: string[] }; scopeProblems?: string[]; layers?: Record<string, Layer>;
}

// Match the default initializer's recipe and retained exclusions. This is a
// proposal for inspection, never an active scope or a behavior-coverage claim.
export function proposedScope(files: Files, stack: ReturnType<typeof detectStack>): NonNullable<Preset["scope"]> {
  const preset = onboardingPreset(stack.recommended, BUILTIN, VERSIONS, stack, librarySources());
  if (preset === null) throw new Error("Recommended recipe is unavailable; choose an explicit initial preset with guide --preview --preset <name>.");
  return newProjectScope(files, preset.scope);
}

// `base` lists the methodologies the project or its initial recipe already selects; suggestions skip them.
// `hasCore`: the project's own preset already declares a core-kind layer.
export function recommendPacks(files: Files, languages: string[], base: string[] = [], hasCore = false): Recommendation[] {
  const selected = new Map<string, Selected>();
  const add: Add = (ns, methodologies, reason, owner) => {
    const item = selected.get(ns) ?? { ns, reasons: [], methodologies: [] };
    item.reasons = [...new Set([...item.reasons, reason])];
    item.methodologies = [...new Set([...item.methodologies, ...methodologies])];
    if (owner !== undefined) item.owners = [...new Set([...(item.owners ?? []), owner])];
    selected.set(ns, item);
    return item;
  };
  // A caller-supplied language with no file evidence stays (Cargo.toml may be known outside this map).
  // Evidence that exists only in a docs site, examples tree, fixtures folder, website, CI workflow, or tiny scripts/ folder does not.
  const peripheral = peripheralPackPath(files);
  const primary = Object.fromEntries(Object.entries(files).filter(([path]) => !peripheral(path)));
  if (languages.includes("TypeScript") && !peripheralLanguageOnly("TypeScript", files, peripheral)) add("typescript", ["typescript/strict-types", "typescript/anti-evasion"], "TypeScript source or tsconfig detected");
  if (languages.includes("JavaScript") && !peripheralLanguageOnly("JavaScript", files, peripheral)) add("javascript", ["javascript/safety"], "JavaScript source detected");
  if (languages.includes("Python") && !peripheralLanguageOnly("Python", files, peripheral)) add("python", ["python/quality"], "Python source or project metadata detected");
  if (languages.includes("Go") && !peripheralLanguageOnly("Go", files, peripheral)) add("go", ["go/quality"], "Go source or module metadata detected");
  if (languages.includes("Rust") && !peripheralLanguageOnly("Rust", files, peripheral)) add("rust", ["rust/quality"], "Rust source or Cargo metadata detected; source AST only, no macro expansion or compiler proof");
  const manifests = Object.entries(files).filter(([path]) => /(^|\/)package\.json$/.test(path)).sort(([a], [b]) => a.localeCompare(b));
  manifestRecommendations(add, manifests, peripheral);
  svelteSourceRecommendations(add, files, peripheral);
  vueSourceRecommendations(add, files, peripheral);
  layeredRecommendations(add, primary, base);
  applicableRecommendations(add, primary, base, selected.has("security-audit"));
  const available = new Set(librarySources().map((pin) => pin.ns));
  if (!hasCore && ![...selected.values()].some((item) => item.layers !== undefined)) withoutCoreLayerPolicies(selected);
  return [...selected.values()].filter((item) => available.has(item.ns) && item.methodologies.length > 0).sort((a, b) => a.ns.localeCompare(b.ns))
    .map(({ owners, ...item }) => owners ? { ...item, ...ownershipScope(owners, manifests.map(([path]) => manifestRoot(path))) } : item);
}

// A methodology whose rule reads `@layers:core` does not compile without a core-kind layer, and one
// failing methodology rejects the whole proposal. With no such layer declared or derived, it is left
// out and named, so a dependency alone cannot make the first review fail.
function withoutCoreLayerPolicies(selected: Map<string, Selected>): void {
  for (const item of selected.values()) {
    const blocked = item.methodologies.filter((method) => needsCoreLayer(item.ns, method));
    if (blocked.length === 0) continue;
    item.methodologies = item.methodologies.filter((method) => !blocked.includes(method));
    item.reasons = [...item.reasons, `${blocked.join(", ")} left out: it checks the core layer and this project declares none. Propose layers with pregate layers apply, then add it.`];
  }
}

function needsCoreLayer(ns: string, method: string): boolean {
  if (!CATALOGS.has(ns)) { const files = librarySource(ns); CATALOGS.set(ns, files && packCatalog(files)); }
  const catalog = CATALOGS.get(ns);
  if (!catalog || "errors" in catalog) return false;
  const globsOf = (value: unknown) => Array.isArray(value) ? value.filter((glob): glob is string => typeof glob === "string") : [];
  return catalog.methodologies.filter((item) => item.id === method).flatMap((item) => item.invariants)
    .some((alias) => [...globsOf(alias.defaults.paths), ...globsOf(alias.defaults.exclude), ...globsOf(alias.defaults.within)].includes("@layers:core"));
}

type Selected = Recommendation & { owners?: string[] };
type Add = (ns: string, methodologies: string[], reason: string, owner?: string) => Selected;

// Shipped dependencies and peers name the frameworks in use. A devDependency names
// tooling, except `vue` and `react`: a built frontend often declares only those there.
// A docs site or other peripheral manifest does not select a pack unless a primary manifest declares it too.
// The Svelte repository is the package named `svelte`; it does not depend on `svelte`.
function manifestRecommendations(add: Add, manifests: [string, string][], peripheral: (path: string) => boolean): void {
  const rows = manifests.map(([path, text]) => ({
    path, peripheral: peripheral(path),
    pkg: JSON.parse(text) as { name?: unknown; dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown>; peerDependencies?: Record<string, unknown> },
  }));
  const hits: { path: string; peripheral: boolean; reason: string; policy: [string, string[]] }[] = [];
  for (const row of rows) {
    if (row.pkg.name === "svelte") hits.push({ path: row.path, peripheral: row.peripheral, reason: `${row.path} is named svelte`, policy: SVELTE });
    const declared = new Set([
      ...Object.keys({ ...row.pkg.dependencies, ...row.pkg.peerDependencies }),
      ...Object.keys(row.pkg.devDependencies ?? {}).filter((name) => DEV_DEPENDENCY_FRAMEWORKS.has(name)),
    ]);
    for (const dep of declared) {
      const policy = DEPENDENCIES[dep] ?? (dep.startsWith("@sveltejs/") ? SVELTE : undefined);
      if (policy) hits.push({ path: row.path, peripheral: row.peripheral, reason: `${row.path} declares ${dep}`, policy });
    }
  }
  const backed = new Set(hits.filter((hit) => !hit.peripheral).map((hit) => hit.policy[0]));
  for (const hit of hits) {
    if (hit.peripheral || !backed.has(hit.policy[0])) continue;
    add(hit.policy[0], hit.policy[1], hit.reason, manifestRoot(hit.path));
  }
  for (const row of rows) {
    if (row.peripheral || !row.pkg.devDependencies) continue;
    if (["vitest", "jest", "@playwright/test"].some((name) => name in row.pkg.devDependencies!)) {
      add("testing", ["testing/tdd"], `${row.path} declares a test runner; test-file presence is not coverage`);
    }
  }
}

// Docs sites, example trees, fixture trees, and website folders are not the product. The folder
// name matches at any depth, so packages/docs, examples/, fixtures/, and fixture/ are the same kind of signal.
// GitHub workflows and a scripts/ directory of at most three inventoried files are CI or tooling,
// not a language project.
const PERIPHERAL_DIR = /^(?:doc|docs|documentation|website|examples?|samples?|demos?|playground|fixtures?)$/;
const TINY_SCRIPT_FILES = 3;

function peripheralPackPath(files: Files): (path: string) => boolean {
  const tiny = tinyScriptDirs(Object.keys(files));
  return (path) => {
    const dirs = path.split("/").slice(0, -1);
    if (dirs.some((dir) => dir === ".github" || PERIPHERAL_DIR.test(dir))) return true;
    return dirs.some((_, index) => tiny.has(dirs.slice(0, index + 1).join("/")));
  };
}

function tinyScriptDirs(paths: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const dirs = path.split("/").slice(0, -1);
    const at = dirs.indexOf("scripts");
    if (at === -1) continue;
    const dir = dirs.slice(0, at + 1).join("/");
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count <= TINY_SCRIPT_FILES).map(([dir]) => dir));
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", go: "Go", rs: "Rust",
};

function languageEvidence(language: string, path: string): boolean {
  if (LANGUAGE_EXTENSIONS[path.split(".").pop()!.toLowerCase()] === language) return true;
  if (language === "TypeScript" && /(^|\/)tsconfig\.json$/.test(path)) return true;
  if (language === "Python" && /(^|\/)(pyproject\.toml|requirements\.txt|Pipfile)$/.test(path)) return true;
  if (language === "Go" && /(^|\/)go\.(mod|work)$/.test(path)) return true;
  if (language === "Rust" && /(^|\/)Cargo\.toml$/.test(path)) return true;
  return false;
}

// No inventoried evidence means the caller already decided the language. Evidence that is entirely
// peripheral is not a second vote for that language.
function peripheralLanguageOnly(language: string, files: Files, peripheral: (path: string) => boolean): boolean {
  const evidence = Object.keys(files).filter((path) => languageEvidence(language, path));
  return evidence.length > 0 && evidence.every(peripheral);
}

// File evidence recommends Svelte and does not invent an owning workspace. A manifest
// owner, when one exists, still confines the recommendation the way a Vue declaration does.
// A `.svelte` file or `svelte.config.*` that exists only under a docs site, examples tree,
// fixtures tree, website, CI workflow, or tiny scripts/ folder does not select the pack.
function svelteSourceRecommendations(add: Add, files: Files, peripheral: (path: string) => boolean): void {
  if (Object.keys(files).some((path) => /\.svelte$/i.test(path) && !peripheral(path))) add(SVELTE[0], SVELTE[1], ".svelte source detected");
  for (const path of Object.keys(files).filter((path) => /(^|\/)svelte\.config\.[^/]+$/i.test(path) && !peripheral(path)).sort()) add(SVELTE[0], SVELTE[1], `${path} detected`);
}

// File evidence recommends Vue and does not invent an owning workspace. A manifest
// owner, when one exists, still confines the recommendation. A `.vue` file that exists
// only under a docs site, examples tree, fixtures tree, website, CI workflow, or tiny
// scripts/ folder does not select the pack.
function vueSourceRecommendations(add: Add, files: Files, peripheral: (path: string) => boolean): void {
  if (Object.keys(files).some((path) => /\.vue$/i.test(path) && !peripheral(path))) add(VUE[0], VUE[1], ".vue source detected");
}

// Clean architecture and FCIS both resolve deps.layers, so TypeScript gets no second layer policy.
const LAYERED: Record<string, [string, string]> = {
  typescript: ["architecture", "architecture/clean-architecture"], tsx: ["architecture", "architecture/clean-architecture"],
  python: ["python", "python/architecture"], go: ["go", "go/architecture"], rust: ["rust", "rust/architecture"],
};
const LAYER_POLICIES = ["architecture/clean-architecture", "architecture/functional-core-imperative-shell"];

function layeredRecommendations(add: Add, files: Files, base: string[]): void {
  const layers = detectLayers(files);
  if (Object.keys(layers).length < 2) return;
  const globs = Object.values(layers).flatMap(layer => layer.paths);
  const grammarsInLayers = new Set(Object.keys(files).filter(path => globs.some(glob => matches(glob, path))).map(path => grammarOf(path)));
  const reason = `Layered folders detected: ${globs.map(glob => glob.slice(0, -"/**".length)).join(", ")}. Layer paths come from these folders; review them.`;
  for (const [ns, method] of new Map([...grammarsInLayers].flatMap(grammar => grammar && LAYERED[grammar] ? [LAYERED[grammar]] : []))) {
    if (base.includes(method) || (ns === "architecture" && base.some(id => LAYER_POLICIES.includes(id)))) continue;
    add(ns, [method], reason).layers = layers;
  }
}

// Suggest general packs wherever their checks apply to real source; a check's languages and default
// paths decide, so a Python repository gets testing only for Python test files TDD-SKIP-001 reads.
function applicableRecommendations(add: Add, files: Files, base: string[], securityDependency: boolean): void {
  const paths = Object.keys(files);
  for (const [ns, method] of [["clean-code", "clean-code/clean-code"], ["testing", "testing/tdd"], ["security-audit", "security-audit/obvious-sinks"]] as const) {
    if (base.includes(method)) continue;
    if (method === "security-audit/obvious-sinks" && !securityDependency && !sinkEvidence(files)) continue;
    const count = applicableFiles(ns, method, paths);
    if (count > 0) add(ns, [method], `${method} checks apply to ${count} source file${count === 1 ? "" : "s"}`);
  }
}

// Python, Go and Rust have no other security pack. TypeScript and JavaScript need a production
// runtime import of a module obvious-sinks reads; type-only imports and declaration files are
// not runtime use, and the text test only skips parsing unrelated files.
const SINK_MODULES = new Set(["crypto", "node:crypto", "child_process", "node:child_process", "js-yaml", "yaml"]);

function sinkEvidence(files: Files): boolean {
  const production = Object.keys(files).filter(path => grammarOf(path) !== null && sourceRole(path) === "production-candidate");
  if (production.some(path => ["python", "go", "rust"].includes(grammarOf(path)!))) return true;
  return production.some(path => !/\.d\.[cm]?ts$/.test(path) && /crypto|child_process|yaml/.test(files[path]!) && importsSink(path, files[path]!));
}

function importsSink(path: string, text: string): boolean {
  const parsed = parse(path, text);
  try { return imports(parsed).some(imp => imp.literal && imp.kind !== "type" && SINK_MODULES.has(imp.spec)); } finally { parsed.root.tree.delete(); }
}

const CATALOGS = new Map<string, ReturnType<typeof packCatalog> | null>();

function applicableFiles(ns: string, method: string, paths: string[]): number {
  if (!CATALOGS.has(ns)) { const files = librarySource(ns); CATALOGS.set(ns, files && packCatalog(files)); }
  const catalog = CATALOGS.get(ns);
  if (!catalog) return 0;
  if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
  const checks = catalog.methodologies.filter(item => item.id === method).flatMap(item => item.invariants).flatMap(alias => {
    const check = catalog.checks.find(check => check.id === alias.check)!;
    if (check.impl.kind === "primitive" && check.impl.primitive === "fitness") return [];
    const globs = patternsOf(check.impl)[0]?.files ?? (alias.defaults.paths as string[] | undefined) ?? ["**"];
    return [{ check, globs: globs.filter(glob => !glob.startsWith("@")) }];
  });
  return paths.filter(path => grammarOf(path) !== null
    && checks.some(({ check, globs }) => languageApplies(check, path) && globs.some(glob => matches(glob, path)))).length;
}

const manifestRoot = (path: string): string => path === "package.json" ? "" : path.slice(0, -"package.json".length);
const treeGlob = (root: string): string => root + "**";

// packages/<name>/test/ holds that package's test apps and fixtures (SvelteKit's
// packages/kit/test/apps/async is one). Those manifests are not a second product.
// Excluding one would also hide an owner nested inside it, and one include/exclude
// list cannot open that owner again. They stay inside the owning package. A nested
// owner anywhere else still cannot be represented and stays a scope problem.
const PACKAGE_TEST = /^packages\/[^/]+\/test\//;

function ownershipScope(owners: string[], roots: string[]) {
  const boundaries = roots.filter(root => !PACKAGE_TEST.test(root));
  const include = owners.sort().map(treeGlob);
  const foreign = boundaries.filter(root => root !== "" && !owners.includes(root) && owners.some(owner => root.startsWith(owner)));
  const ambiguous = foreign.filter(root => owners.some(owner => owner.startsWith(root)));
  return { scope: { include, exclude: foreign.sort().map(treeGlob) },
    ...(ambiguous.length ? { scopeProblems: ambiguous.map(root => `Nested owners below ${root} cannot be represented by one include/exclude scope. Choose an explicit reviewed rule scope.`) } : {}) };
}

// Human-authored path decisions win. Other severity, enforcement and parameter choices survive.
export function recommendationOverrides(items: Recommendation[], preset?: Preset): NonNullable<Preset["overrides"]> {
  const overrides: NonNullable<Preset["overrides"]> = {};
  // A root manifest owning the whole tree, with no nested package excluded, narrows nothing.
  const narrows = (scope: Recommendation["scope"]) => scope !== undefined && (scope.exclude.length > 0 || !scope.include.every(glob => glob === "**"));
  for (const item of items.filter(item => narrows(item.scope))) {
    if (item.scopeProblems?.length) throw new Error(`${item.ns}: ${item.scopeProblems.join(" ")} No automatic scope applied.`);
    const catalog = packCatalog(librarySource(item.ns)!);
    if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
    for (const method of catalog.methodologies.filter(method => item.methodologies.includes(method.id))) {
      for (const alias of method.invariants) {
        const check = catalog.checks.find(check => check.id === alias.check)!;
        if (check.impl.kind === "primitive" && check.impl.primitive === "fitness") continue;
        const id = [alias.id, alias.check, `${item.ns}/${alias.id}`].find(id => Object.hasOwn(preset?.overrides ?? {}, id)) ?? `${item.ns}/${alias.id}`;
        const existing = preset?.overrides?.[id];
        const before = typeof existing === "string" ? { severity: existing } : existing ?? {};
        const resolved = preset?.resolve?.[check.dimension];
        if ([before.params, resolved?.params].some(params => params && ["paths", "exclude", "within"].some(key => Object.hasOwn(params, key)))) continue;
        overrides[id] = { ...before, params: { ...before.params, within: item.scope!.include, exclude: [...(alias.defaults.exclude as string[] ?? []), ...item.scope!.exclude] },
          note: before.note ?? "Detected dependency ownership; review the package scopes. This is applicability evidence, not compliance." };
      }
    }
  }
  return overrides;
}

function scanScope(files: Files, stack: ReturnType<typeof detectStack>, preset: unknown, initial: boolean) {
  const validPreset = preset !== null && validate("preset", preset).length === 0 ? preset as Preset : null;
  const initialScope = initial ? proposedScope(files, stack) : undefined;
  const coverage = validPreset ? scopeCoverage(files, validPreset.scope) : initialScope ? scopeCoverage(files, initialScope) : null;
  const coverageState = validPreset ? "current" : initialScope ? "proposed" : "unavailable";
  const scope = initialScope ?? (coverage?.outsideScope.length ? detectedScope(files, validPreset!.scope) : undefined);
  return { validPreset, coverage, coverageState, scope };
}

export function declaresCore(preset: Preset | null): boolean {
  return Object.values(preset?.layers ?? {}).some((layer) => layer.kind === "core");
}

// Methodologies the project already selects, or the initial recipe would select for a new project.
export function baseMethodologies(stack: ReturnType<typeof detectStack>, preset: Preset | null): string[] {
  return preset?.methodologies ?? onboardingPreset(stack.recommended, BUILTIN, VERSIONS, stack, librarySources())?.methodologies ?? [];
}

// Detected layers enter the plan only when the project declares none; human-authored layers win.
function scanPlan(applicable: Recommendation[], validPreset: Preset | null, scope: Preset["scope"]) {
  const layers = applicable.find(item => item.layers)?.layers;
  return { sources: applicable.map((item) => ({ kind: "library", ns: item.ns })), methodologies: applicable.flatMap((item) => item.methodologies),
    overrides: recommendationOverrides(applicable, validPreset ?? undefined),
    ...(scope === undefined ? {} : { scope }),
    ...(layers && !Object.keys(validPreset?.layers ?? {}).length ? { layers } : {}) };
}

export async function scan(args: string[], directory = process.cwd()) {
  if (args.length > 1 || (args.length === 1 && !["--json", "--plan"].includes(args[0]!))) return { code: 1, text: "usage: pregate scan [--json|--plan]" };
  return scanReport(args, directory);
}

async function scanReport(args: string[], directory: string) {
  try {
    const cwd = canonical(directory);
    const established = findRoot(cwd, () => true);
    const top = established === null ? git(cwd, ["rev-parse", "--show-toplevel"])?.trim() : established;
    if (top === undefined && hasRepository(cwd)) return { code: 1, text: "Git could not identify the project; fix Git before scanning." };
    const root = canonical(top ?? cwd);
    const files = repoFiles(root);
    await grammars();
    const stack = detectStack(files);
    const presetText = established === null ? null : readText(join(root, PRESET));
    const preset: unknown = presetText === null ? null : JSON.parse(presetText);
    const { validPreset, coverage, coverageState, scope } = scanScope(files, stack, preset, established === null);
    const recommendations = recommendPacks(files, stack.languages, baseMethodologies(stack, validPreset), declaresCore(validPreset));
    const plan = scanPlan(recommendations.filter(item => !item.scopeProblems?.length), validPreset, scope);
    const presetWarnings = validPreset ? [...emptyLayerLines(validPreset.layers, Object.keys(files)), ...deadGlobLines(validPreset, () => Object.keys(files))] : [];
    const customCandidates = stack.edges.map((edge) => ({ evidence: edge, suggestion: "Review dependency ownership and propose a project-specific boundary rule with pass/fail/trap fixtures.", status: "suggestion; not an executable rule" }));
    const documentation = discoverDocumentation(root);
    const result = { root, stack, coverage, coverageState, recommendations, customCandidates, documentation, customPackProposal: documentation.customPack, plan,
      limits: ["Dependency and folder detection is advisory; no pack is activated.", "Unsupported languages remain uncovered; a pack does not install a parser.", "Custom candidates require tested rules and review; no inferred architecture is certified."] };
    if (args[0] === "--plan") return { code: 0, text: JSON.stringify(plan, null, 2) };
    if (args[0] === "--json") return { code: 0, text: JSON.stringify(result, null, 2) };
    return { code: 0, text: visible([
      `Scan: ${root}. Languages: ${stack.languages.join(", ") || "none detected"}.`,
      ...(coverage === null ? ["Scope coverage unavailable: no schema-valid project preset. Diagnose the contract before adoption."] : [
        ...(coverageState === "proposed" ? ["Proposed source scope only: no contract is active. Counts use the default recipe and detected roots; review scope and packs together."] : []), ...scopeCoverageText(coverage)]),
      ...(scope === undefined ? [] : ["The proposed plan includes detected source roots and preserves recipe or project exclusions. Nothing is activated."]),
      ...presetWarnings, ...(plan.layers ? ["The proposed plan includes layers derived from the detected folders. Review their paths and allowed imports."] : []),
      ...recommendations.map((item) => `${item.ns}: ${item.reasons.join("; ")}\n  ${item.methodologies.join(", ")}${item.scope ? `\n  Owning packages: ${item.scope.include.join(", ")}; nested exclusions: ${item.scope.exclude.join(", ") || "none"}` : ""}${item.scopeProblems?.length ? `\n  Withheld from automatic plan: ${item.scopeProblems.join(" ")}` : ""}`),
      ...customCandidates.map((item) => `Custom-pack candidate: ${item.evidence}. ${item.suggestion}`),
      `Documentation: ${documentation.scanned.length} files reviewed; ${documentation.skipped.length} outside the bounded scan.`,
      `Custom pack idea: ${documentation.customPack.ns}. ${documentation.customPack.reason}`,
      ...documentation.requirements.slice(0, 6).map(item => `${item.path}:${item.line} · ${item.statement}`),
      ...(established === null && documentation.requirements.length ? ["Review official packs and a documentation draft together: pregate guide --preview --custom-from-docs. The custom assertions remain unverified until real project checks are bound."] : []),
      ...result.limits,
      recommendations.length || scope !== undefined ? "Select the scope and pack recommendations you want. Save scan --plan output to a project plan.json, then run pregate pack apply plan.json --preview for one combined review."
        : "No bundled pack was inferred. Review pack list or author a tested custom pack; do not apply an empty plan.",
      "After approval, run pregate audit. Choose behavior-preserving repairs or a reviewed no-new-debt baseline; freezing debt does not certify compliance.",
    ].join("\n")) };
  } catch (e) { return { code: 1, text: visible(`Scan failed: ${(e as Error).message}. Project and consent unchanged.`) }; }
}

// `pregate layers`: the layer map as evidence, and the route for an agent to propose one. The
// agent reads the folders and their imports, writes a map, and the engine reports what that map
// finds in the code today before the human reviews one digest. Nothing here changes the contract.
const LAYERS_USAGE = "usage: pregate layers [--json] | layers apply <layers.json> --preview [--complete]";
const LAYERS_FORMAT = '{"why": "<one sentence>", "layers": {"domain": {"paths": ["src/domain/**"], "mayImport": [], "kind": "core"}, "ui": {"paths": ["src/ui/**"], "mayImport": ["domain"], "kind": "adapter"}}}';
type LayerMap = Record<string, Layer>;

export async function layers(args: string[], directory = process.cwd()): Promise<{ code: number; text: string }> {
  const apply = args[0] === "apply", flags = args.slice(2);
  const applyOk = args.length >= 3 && !args[1]!.startsWith("-") && flags.includes("--preview") && flags.every((flag, i) => ["--preview", "--complete"].includes(flag) && flags.indexOf(flag) === i);
  if (apply ? !applyOk : args.length > 1 || (args.length === 1 && args[0] !== "--json")) {
    return { code: 1, text: apply && !args.includes("--preview") ? `layers apply only prepares a review; add --preview. The human approves it with pregate approve <code>.\n${LAYERS_USAGE}` : LAYERS_USAGE };
  }
  try {
    const root = findRoot(canonical(directory), () => true);
    if (root === null) {
      // `layers --json` is evidence, so a new project can read the derived map before a contract exists.
      // Bare `layers` and `layers apply` still wait for the guide review that proposes that map.
      if (!apply && args.length === 1 && args[0] === "--json") {
        const cwd = canonical(directory);
        const top = git(cwd, ["rev-parse", "--show-toplevel"])?.trim();
        if (top === undefined && hasRepository(cwd)) return { code: 1, text: "Git could not identify this worktree; fix Git before reading layers." };
        await grammars();
        return layersShow(canonical(top ?? cwd), true);
      }
      return { code: 1, text: "Set up PREGATE first: pregate guide --preview. Its review proposes layers from the folder names." };
    }
    await grammars();
    return apply ? await layersApply(root, resolvePath(directory, args[1]!), flags.includes("--complete")) : layersShow(root, args[0] === "--json");
  } catch (e) { return { code: 1, text: visible(`Layers failed: ${(e as Error).message}. Contract unchanged.`) }; }   // fail-closed: exit 1, nothing staged
}

function layersShow(root: string, json: boolean): { code: number; text: string } {
  const files = repoFiles(root), lock = currentLock(root);
  const declared = lock?.layers ?? {}, derived = deriveLayers(files);
  const source = Object.keys(declared).length ? "contract" : Object.keys(derived.layers).length ? "derived from folder names" : "none";
  const map = source === "contract" ? declared : derived.layers;
  const evidence = layerEvidence(files, map);
  const consequence = lock === null ? "checked once a contract is approved" : newBreak({ ...lock, layers: map });
  const next = `Proposal format for pregate layers apply <layers.json> --preview: ${LAYERS_FORMAT}`;
  if (json) return { code: 0, text: JSON.stringify({ schemaVersion: 1, root, source, layers: map, notes: source === "contract" ? [] : derived.notes, evidence, newBreak: consequence, next }, null, 2) };
  const may = (layer: Layer) => layer.mayImport.includes("*") ? "may import any code" : layer.mayImport.length ? `may import ${layer.mayImport.join(", ")}` : "imports no other layer";
  return { code: 0, text: visible([`Layers (${source}): ${Object.entries(map).map(([name, layer]) => `${name} [${layer.paths.join(", ")}] (${layer.kind}; ${may(layer)})`).join("; ") || "no layer map"}.`,
    ...(source === "contract" ? [] : derived.notes), ...layerEvidenceLines(evidence, lock?.ratchet ?? "no-new", consequence), next].join("\n")) };
}

function currentLock(root: string): Lock | null {
  try { return JSON.parse(readText(join(root, ".pregate/pregate.lock.json")) ?? "null") as Lock | null; }
  catch (e) { if (e instanceof SyntaxError) return null; throw e; }   // a malformed lock shows the derived map; status names the lock
}

// `--complete`: the map must place every source file in scope, and a folder created later. A file
// in no layer is unrestricted, so a map with gaps lets code move to an uncovered folder and import
// anything. Partial maps stay valid without the flag; this is the opt-in for a project that wants
// no such folder. The check is the map's own: a catch-all layer (for example `src/**`) closes every
// gap, because the most specific layer path still wins for the files other layers name.
const NEW_FOLDER = "pregate-new-folder";

function incompleteMap(preset: Preset, layerMap: LayerMap, paths: string[]): string | null {
  const lock = { scope: { include: preset.scope?.include ?? ["**"], exclude: preset.scope?.exclude ?? [] }, layers: layerMap } as Lock;
  const sources = paths.filter(path => grammarOf(path) !== null && inScope(lock, path));
  const unplaced = sources.filter(path => layerOf(lock, path) === null);
  const folder = (path: string) => path.includes("/") ? path.split("/").slice(0, 2).join("/").replace(/\/[^/]*\.[^/]*$/, "") : ".";
  if (unplaced.length) {
    const folders = [...new Set(unplaced.map(folder))].sort();
    return `--complete: ${unplaced.length} source file${unplaced.length === 1 ? " is" : "s are"} in no layer (${folders.slice(0, 8).join(", ")}${folders.length > 8 ? `, +${folders.length - 8} more` : ""}). Place them, or add a catch-all layer whose path covers them.`;
  }
  const roots = [...new Set(sources.filter(path => path.includes("/")).map(path => path.split("/")[0]!))].sort();
  const open = roots.filter(dir => { const sample = sources.find(path => path.startsWith(`${dir}/`))!; return layerOf(lock, `${dir}/${NEW_FOLDER}/file.${sample.split(".").pop()}`) === null; });
  return open.length === 0 ? null
    : `--complete: a new folder under ${open.join(", ")} would be in no layer, and code there would be unrestricted. Add a catch-all layer whose path covers it, such as ${open[0]}/**.`;
}

async function layersApply(root: string, file: string, complete = false): Promise<{ code: number; text: string }> {
  if (!existsSync(file)) return { code: 1, text: `No file ${file}. Format: ${LAYERS_FORMAT}` };
  const files = repoFiles(root), paths = Object.keys(files);
  const proposed = checkedLayerMap(readFileSync(file, "utf8"), paths);
  if (typeof proposed === "string") return { code: 1, text: proposed.startsWith("Layer paths matching") ? proposed : `${proposed} Nothing staged. Format: ${LAYERS_FORMAT}` };
  const current = JSON.parse(readFileSync(join(root, PRESET), "utf8")) as Preset;
  const gap = complete ? incompleteMap(current, proposed.layers, paths) : null;
  if (gap !== null) return { code: 1, text: `${gap} Nothing staged.` };
  const candidate = withLayerPolicy(root, { ...current, layers: proposed.layers }, files);
  if ("errors" in candidate) return { code: 1, text: [...candidate.errors, "Nothing staged."].join("\n") };
  const review = await applyPreset(root, JSON.stringify(candidate.preset, null, 2) + "\n", { preview: true, stable: true });
  if (review.code !== 0) return review;
  return { code: 0, text: visible([`Proposed layer map: ${proposed.why}`, ...candidate.notes,
    ...(complete ? ["Complete map: every source file in scope is in a layer, and so is a folder created later."] : []),
    ...layerEvidenceLines(layerEvidence(files, proposed.layers), candidate.lock.ratchet, newBreak(candidate.lock)), review.text].join("\n")) };
}

// The agent's file is data: a reason and a map. Shape errors are named here; the contract
// compiler still validates the full candidate.
function proposedLayers(text: string): { why: string; layers: LayerMap } | string {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (e) { if (e instanceof SyntaxError) return `The layer proposal is not JSON: ${e.message}.`; throw e; }
  const { why, layers: map } = (value ?? {}) as { why?: unknown; layers?: unknown };
  if (typeof why !== "string" || why.trim() === "") return "The proposal needs a why: one sentence a reviewer can check against the code.";
  if (typeof map !== "object" || map === null || Array.isArray(map) || Object.keys(map).length === 0) return "The proposal needs a layers object with at least one layer.";
  const names = Object.keys(map);
  for (const [name, layer] of Object.entries(map as Record<string, Partial<Layer> | null>)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name)) return `Layer name ${JSON.stringify(name)} must be lowercase letters, digits and hyphens.`;
    if (!Array.isArray(layer?.paths) || layer.paths.length === 0 || layer.paths.some(glob => typeof glob !== "string" || glob === "")) return `Layer ${name} needs paths: a list of globs.`;
    if (!Array.isArray(layer.mayImport) || layer.mayImport.some(other => other !== "*" && (!names.includes(other) || other === name))) return `Layer ${name} needs mayImport: other layer names from this map, or "*".`;
    if (!["core", "port", "adapter", "main"].includes(layer.kind as string)) return `Layer ${name} needs kind: core, port, adapter or main.`;
  }
  return { why: why.trim().replace(/\s+/g, " ").slice(0, 300), layers: map as LayerMap };
}

// Shape errors stay without "Nothing staged"; a path that matches no file already says so.
// `layers apply` adds the format hint for shape errors. `--layers` on guide uses the same check.
export function checkedLayerMap(text: string, paths: string[]): { why: string; layers: LayerMap } | string {
  const proposed = proposedLayers(text);
  if (typeof proposed === "string") return proposed;
  const empty = Object.entries(proposed.layers).flatMap(([name, layer]) => layer.paths.filter(glob => !paths.some(path => matches(glob, path))).map(glob => `${name} (${glob})`));
  return empty.length === 0 ? proposed : `Layer paths matching no file: ${empty.join(", ")}. A layer that matches nothing checks nothing; correct the paths. Nothing staged.`;
}

// A map no rule reads protects nothing. When the candidate compiles without a layer rule, the
// layer methodology of each language found in the layers is added to the same review.
export function withLayerPolicy(root: string, preset: Preset, files: Files): { preset: Preset; lock: Lock; notes: string[] } | { errors: string[] } {
  const compiled = (candidate: Preset) => validateContract({ presetText: JSON.stringify(candidate), filesOf: sourcesOf(root, true), versions: VERSIONS, now: clock });
  const first = compiled(preset);
  if (!("errors" in first) && newBreak(first.lock).startsWith("not checked") === false) return { preset, lock: first.lock, notes: [] };
  const globs = Object.values(preset.layers ?? {}).flatMap(layer => layer.paths);
  const wanted = new Map(Object.keys(files).filter(path => globs.some(glob => matches(glob, path))).flatMap(path => { const policy = LAYERED[grammarOf(path) ?? ""]; return policy ? [policy] : []; }));
  const added = [...wanted].filter(([, method]) => !preset.methodologies.includes(method));
  if (added.length === 0) return "errors" in first ? first : { preset, lock: first.lock, notes: ["No layer rule reads this map: no bundled layer policy covers the languages in these folders."] };
  const sources = [...preset.sources, ...librarySources().filter(pin => added.some(([ns]) => ns === pin.ns) && !preset.sources.some(source => source.ns === pin.ns))];
  const next = { ...preset, sources, methodologies: [...preset.methodologies, ...added.map(([, method]) => method)] };
  const second = compiled(next);
  return "errors" in second ? second : { preset: next, lock: second.lock, notes: [`Added ${added.map(([, method]) => method).join(", ")} so a rule reads this map.`] };
}
