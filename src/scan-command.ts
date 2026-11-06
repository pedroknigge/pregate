import { canonical, findRoot } from "./disk.ts";
import { visible } from "./contract.ts";
import { repoFiles } from "./init.ts";
import { deadGlobLines, detectedScope, detectLayers, detectStack, emptyLayerLines, initialScope as newProjectScope, onboardingPreset, scopeCoverage, scopeCoverageText, sourceRole } from "./onboard.ts";
import { imports, parse } from "./ts.ts";
import { readText, PRESET, VERSIONS } from "./gate.ts";
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
import { matches } from "./paths.ts";
import type { Files, Layer, Preset } from "./types.ts";
import { discoverDocumentation } from "./project-discovery.ts";

// Exact manifest dependencies are evidence for applicability, not for compliance.
// Token, CORS and LLM SDKs make the client-and-agents hardening checks applicable.
// `svelte` and `@sveltejs/*` use that same shipped-dependency evidence. The package
// named `svelte`, a `.svelte` file, or `svelte.config.*` also select the Svelte pack.
// `astro` is only that shipped dependency. `astro.config.*` and `.astro` files do not
// select it: the engine does not parse `.astro`.
// TanStack Query framework adapters select that pack. `@tanstack/query-core`, devtools,
// and a dependency that exists only under a docs, examples, or fixtures tree do not.
// `hono` is only the package named `hono` in dependencies or peerDependencies.
const CLIENT_SECURITY: [string, string[]] = ["security-audit", ["security-audit/client-and-agents"]];
const SVELTE: [string, string[]] = ["svelte", ["svelte/runes", "svelte/stores"]];
const ASTRO: [string, string[]] = ["astro", ["astro/config", "astro/content", "astro/routing"]];
const TANSTACK_QUERY: [string, string[]] = ["tanstack-query", ["tanstack-query/keys", "tanstack-query/client"]];
const DEPENDENCIES: Record<string, [string, string[]]> = {
  next: ["nextjs", ["nextjs/rendering", "nextjs/routing"]],
  react: ["react", ["react/components", "react/hooks"]],
  vue: ["vue", ["vue/reactivity", "vue/sfc"]],
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
export function recommendPacks(files: Files, languages: string[], base: string[] = []): Recommendation[] {
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
  layeredRecommendations(add, primary, base);
  applicableRecommendations(add, primary, base, selected.has("security-audit"));
  const available = new Set(librarySources().map((pin) => pin.ns));
  return [...selected.values()].filter((item) => available.has(item.ns)).sort((a, b) => a.ns.localeCompare(b.ns))
    .map(({ owners, ...item }) => owners ? { ...item, ...ownershipScope(owners, manifests.map(([path]) => manifestRoot(path))) } : item);
}

type Selected = Recommendation & { owners?: string[] };
type Add = (ns: string, methodologies: string[], reason: string, owner?: string) => Selected;

// Shipped dependencies and peers name the frameworks in use; a devDependency only names tooling.
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
    for (const dep of Object.keys({ ...row.pkg.dependencies, ...row.pkg.peerDependencies })) {
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

function ownershipScope(owners: string[], roots: string[]) {
  const include = owners.sort().map(treeGlob);
  const foreign = roots.filter(root => root !== "" && !owners.includes(root) && owners.some(owner => root.startsWith(owner)));
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
    const recommendations = recommendPacks(files, stack.languages, baseMethodologies(stack, validPreset));
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
