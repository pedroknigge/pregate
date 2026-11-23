import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { approvalDeadline, discardProposal, proposeContract } from "./approval.ts";
import { applyPreset } from "./approval-command.ts";
import { compile, packCatalog } from "./compile.ts";
import { validateContract, visible } from "./contract.ts";
import { enable } from "./consent.ts";
import { canonical, findRoot, readTree, writeAtomic } from "./disk.ts";
import { clock, delegate, grammars, LOCK, PRESET, readText, sourcesOf, VERSIONS } from "./gate.ts";
import { removeSelection, selectMethodology } from "./pack-compose.ts";
import { packTemplate } from "./pack-template.ts";
import { cachedPack, fetchPack, testPack } from "./packs.ts";
import { pendingReview } from "./pending-review.ts";
import { relativePath } from "./paths.ts";
import { grammarOf, languageApplies, ruleLanguages } from "./languages.ts";
import { librarySource, librarySources, newerPin } from "./library.ts";
import { sha256 } from "./state.ts";
import { validate } from "./schema.ts";
import { dependencyRules } from "./dependencies.ts";
import { workspacePaths } from "./workspace.ts";
import { inScope, ruleApplies } from "./paths.ts";
import type { Lock, Preset } from "./types.ts";

type Result = { code: number; text: string };
type UpdateResult = Result & { held?: string[] };
type Catalog = Exclude<ReturnType<typeof packCatalog>, { errors: string[] }>;
type Context = { root: string; preset: Preset; presetText: string; lockText: string | null };
type Options = { cmd: string; arg?: string; path?: string; category?: string; only?: string[]; library: boolean; json: boolean; preview: boolean; yes: boolean; sourceOnly?: boolean };
const USAGE = "usage: pregate pack list [--library] [--category invariants|language|pattern|library|practice|process] [--json] | show [--library] <ns|methodology> [--json] | show --path <dir> [--json] | init <ns> | add --library <ns> [--source-only] [--preview|--yes] | add <url>@<ref> [--source-only] [--preview|--yes] | add --path <dir> [--source-only] [--preview|--yes] | apply <plan.json> [--preview|--yes] | restore | update <ns> [--preview|--yes] | enable <ns/methodology> [--only <id,id>] [--preview|--yes] | disable <ns/methodology> [--preview|--yes] | remove <ns> [--preview|--yes]";

export async function pack(args: string[]): Promise<Result> {
  try { return await packCommand(args); }
  catch (e) { return { code: 1, text: visible(`Pack operation failed: ${(e as Error).message}. Inspect preset/status before retrying.`) }; }
}

async function packCommand(args: string[]): Promise<Result> {
  if (args[0] === "update" && args.filter((arg) => arg === "--all").length === 1) {
    return projectUpdate(args.slice(1).filter((arg) => arg !== "--all"));
  }
  const options = parseOptions(args);
  if (options === null) return { code: 1, text: USAGE };
  if (options.cmd === "show" && options.path) return inspectPath(options);
  if (options.cmd === "init") { await grammars(); return scaffold(options.arg!); }
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null && options.library && ["list", "show"].includes(options.cmd)) return discoverLibrary(null, options);
  if (root === null) return { code: 1, text: "Run pregate init first, or use pack show --path <dir>." };
  const delegated = options.cmd === "update" ? null : delegate(root, ["pack", ...args]);
  if (delegated !== null) return delegated;
  const presetText = readFileSync(join(root, PRESET), "utf8");
  const context = { root, preset: JSON.parse(presetText) as Preset, presetText, lockText: readText(join(root, LOCK)) };
  if (options.cmd === "update") {
    if (!context.preset.sources?.some(source => source.ns === options.arg)) return { code: 1, text: `No registered pack ${options.arg}. Use pack list.` };
    const candidate = updateCandidate(presetText, context.lockText);
    if ("errors" in candidate || candidate.changes.length > 0 || candidate.held.length > 0) {
      const result = await projectUpdate(options.yes ? ["--yes"] : ["--preview"]);
      if (!("errors" in candidate) && candidate.held.length > 0) return result;
      return { ...result, text: "Project pins or overrides need migration; all updates enter one review on the installed engine.\n" + result.text };
    }
  }
  if (options.library && ["list", "show"].includes(options.cmd)) return discoverLibrary(context, options);
  if (["list", "show"].includes(options.cmd)) return discover(context, options);
  await grammars();
  if (options.cmd === "restore") return restore(context);
  approvalDeadline();
  const candidate = options.cmd === "apply" ? batch(context, options.arg!)
    : ["add", "update"].includes(options.cmd) ? importSource(context, options) : compose(context, options);
  if ("errors" in candidate) return { code: 1, text: candidate.errors.join("\n") };
  const chosen = options.cmd === "add" && !options.sourceOnly ? selectAdded(context, candidate) : { preset: candidate, note: [] };
  return activate(context, chosen.preset, options, chosen.note);
}

type UpdateSelection = { plan: unknown; enforcement?: "shadow" | "enforce" | "advisor" };

// Migration deliberately uses the installed engine, not the old project's delegate.
// It prepares one candidate and reuses the normal digest-bound human approval.
export async function projectUpdate(args: string[], directory = process.cwd(), selection?: UpdateSelection): Promise<UpdateResult> {
  if (args.length > 1 || args.some((arg) => !["--preview", "--yes"].includes(arg))) return { code: 1, text: "usage: pregate update --project [--preview|--yes]" };
  const root = findRoot(canonical(directory), () => true);
  if (root === null) return { code: 1, text: "No project contract here or above. Run pregate init --preview first." };
  return preparedUpdate(root, args, selection);
}

async function preparedUpdate(root: string, args: string[], selection?: UpdateSelection): Promise<UpdateResult> {
  try { return await updateProject(root, args, selection); }
  catch (e) { return { code: 1, text: visible(`Cannot prepare project update: ${(e as Error).message}. Nothing applied; inspect pregate preset diagnose --json.`) }; }
}

function lockEngineOf(lock: string | null): string {
  try { return JSON.parse(lock ?? "null")?.engine ?? "missing/unreadable"; }
  catch { return "unreadable: review will require the complete candidate"; }
}

async function updateProject(root: string, args: string[], selection?: UpdateSelection): Promise<UpdateResult> {
  const before = readFileSync(join(root, PRESET), "utf8");
  const lock = readText(join(root, LOCK));
  const lockEngine = lockEngineOf(lock);
  const candidate = updateCandidate(before, lock);
  if ("errors" in candidate) return { code: 1, text: [...candidate.errors, "Nothing applied. Inspect pregate preset diagnose --json; do not reset the preset or disable protection."].join("\n") };
  if (candidate.held.length > 0) return heldUpdate(candidate.held, candidate.changes, args.includes("--yes"));
  approvalDeadline();
  await grammars();
  const gitError = refreshGitSources(candidate);
  if (gitError) return gitError;
  if (selection) {
    const combined = composePackPlan(root, candidate.preset, selection.plan);
    if ("errors" in combined) return { code: 1, text: [...combined.errors, "Nothing applied. Correct the pack selection and retry."].join("\n") };
    candidate.preset = combined;
    if (selection.enforcement) candidate.preset.enforcement = selection.enforcement;
    candidate.changes.push("Selected packs and coverage join this update in one review.");
  }
  if (readText(join(root, PRESET)) !== before || readText(join(root, LOCK)) !== lock) return { code: 1, text: "Contract changed during update preparation; nothing applied. Prepare a new review." };
  const text = JSON.stringify(candidate.preset, null, 2) + "\n";
  const compiled = compile(text, sourcesOf(root), VERSIONS);
  if (candidate.changes.length === 0 && text === before.replaceAll("\r\n", "\n") && !("errors" in compiled) && compiled.text === lock?.replaceAll("\r\n", "\n")) {
    return { code: 0, text: `Project already current: engine ${VERSIONS.engine}, core ${VERSIONS.core} and registered packs. Contract and consent unchanged.` };
  }
  const cost = "errors" in compiled ? [] : importReviewCost(root, compiled.lock);
  const result = await applyPreset(root, text, { yes: args.includes("--yes"), preview: !args.includes("--yes") });
  if (result.code === 0 && args.includes("--yes")) discardProposal(root);
  return { code: result.code, text: [
    `Installed engine: ${VERSIONS.engine}; project lock: ${lockEngine}.`,
    ...candidate.changes, ...cost, result.text,
    ...(result.code === 0 ? ["Approval commits the preset and lock; then run pregate audit."] : []),
  ].join("\n") };
}

// This engine cannot compile a pin newer than its own, so no review is prepared; the remaining
// updates are named and join the review of an engine that carries the newer version. `held` lets
// multi-project callers tell this apart from a current project; --yes applied nothing, so it fails.
function heldUpdate(held: string[], changes: string[], yes: boolean): UpdateResult {
  return { code: yes ? 1 : 0, held, text: [...held,
    ...(changes.length > 0 ? ["These updates wait for the newer engine: " + changes.join("; ")] : []),
    "No review prepared; contract and consent unchanged."].join("\n") };
}

function refreshGitSources(candidate: { preset: Preset; changes: string[] }): Result | null {
  for (const [i, source] of candidate.preset.sources.entries()) {
    if (source.kind !== "git") continue;
    const fetched = fetchPack(source.url, "HEAD", clock);
    if ("errors" in fetched) return { code: 1, text: [...fetched.errors, "Project update not applied; no partial activation."].join("\n") };
    if (fetched.ns !== source.ns) return { code: 1, text: `Updated pack changed namespace ${source.ns}; nothing applied.` };
    candidate.preset.sources[i] = fetched;
    if (fetched.ref !== source.ref) candidate.changes.push(`${source.ns}: ${source.ref} -> ${fetched.ref}`);
  }
  return null;
}

export function importReviewCost(root: string, lock: Lock): string[] {
  const selected = [...dependencyRules(lock, "pre"), ...dependencyRules(lock, "stop")];
  const rules = [...new Set(selected.map(rule => rule.id))];
  if (rules.length === 0) return ["No blocking whole-tree import review on Pre/Stop. Shadow/warn importer observations remain in audit/commit/CI."];
  const count = workspacePaths(root).filter(rel => inScope(lock, rel) && grammarOf(rel) !== null && selected.some(rule => ruleApplies(rule, rel) && languageApplies(rule, rel))).length;
  return [`Interactive import rules: ${rules.join(", ")}. Creating or deleting a target, a parse error, a re-export or a resolver-config change reviews up to ${count} source importers per call; ordinary edits review the file alone. A broad affected set can still exceed the interactive budget.`];
}

type UpdateCandidate = { preset: Preset; changes: string[]; held: string[] };

export function updateCandidate(text: string, lockText: string | null): UpdateCandidate | { errors: string[] } {
  const value: unknown = JSON.parse(text);
  const changes: string[] = [];
  // A common agent error confuses severity strings with enforcement. Propose the
  // correction explicitly, retaining the last lock's effective severity/parameters.
  if (record(value) && record(value.overrides)) {
    const needsRepair = Object.values(value.overrides).some(policy => policy === "enforce" || policy === "shadow" || policy === "advisor");
    const previous = lockText === null || !needsRepair ? null : JSON.parse(lockText) as Lock;
    for (const [id, policy] of Object.entries(value.overrides)) {
      if (policy !== "enforce" && policy !== "shadow" && policy !== "advisor") continue;
      const rule = previous?.rules?.find((entry) => entry.id === id || entry.aliases?.includes(id));
      if (!rule) return { errors: [`overrides.${id}: ${JSON.stringify(policy)} is not a severity. Use an object with enforcement; no previous effective rule is available to preserve its severity and parameters.`] };
      value.overrides[id] = { severity: rule.severity, enforcement: policy, params: rule.params };
      changes.push(`Repair overrides.${id}: string ${JSON.stringify(policy)} -> enforcement object; retains the previous lock's severity and parameters. Review this correction.`);
    }
  }
  const errors = validate("preset", value);
  if (errors.length) return { errors };
  const preset = value as Preset;
  const engine = newerPin("Engine", preset.engine, VERSIONS.engine);
  if (engine === null && preset.engine !== VERSIONS.engine) changes.push(`Engine: ${preset.engine} -> ${VERSIONS.engine}`);
  preset.engine = VERSIONS.engine;
  const pinned = pinnedSources(preset);
  return "errors" in pinned ? pinned : { preset, changes: [...changes, ...pinned.changes], held: [...(engine === null ? [] : [engine]), ...pinned.held] };
}

// Moves core and bundled pins to this engine's versions, never back to an older core or bundled pack.
function pinnedSources(preset: Preset): { changes: string[]; held: string[] } | { errors: string[] } {
  const bundled = librarySources(), changes: string[] = [], held: string[] = [];
  for (const [i, source] of preset.sources.entries()) {
    if (source.kind !== "builtin" && source.kind !== "library") continue;
    const pin = source.kind === "builtin" ? { ...source, version: VERSIONS.core } : bundled.find((entry) => entry.ns === source.ns);
    if (!pin) return { errors: [`Bundled pack ${source.ns} is not available in engine ${VERSIONS.engine}; nothing removed or applied.`] };
    const name = source.kind === "builtin" ? "Core" : source.ns;
    const newer = newerPin(name, source.version, pin.version);
    if (newer !== null) { held.push(newer); continue; }
    if (pin.version !== source.version) changes.push(`${name}: ${source.version} -> ${pin.version}`);
    preset.sources[i] = pin;
  }
  return { changes, held };
}

function parseOptions([cmd = "", ...args]: string[]): Options | null {
  const values = new Map<string, string>();
  const operands: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (["--path", "--only", "--category", "--library", "--json", "--preview", "--yes", "--source-only"].includes(arg)) {
      if (values.has(arg)) return null;
      const value = ["--path", "--only", "--category"].includes(arg) ? args[++i] : "";
      if (value === undefined || value.startsWith("--")) return null;
      values.set(arg, value);
    } else if (arg.startsWith("-")) return null;
    else operands.push(arg);
  }
  const allowed = cmd === "list" ? ["--json", "--library", "--category"] : cmd === "show" ? ["--json", "--path", "--library"]
    : ["init", "restore"].includes(cmd) ? [] : cmd === "add" ? ["--path", "--library", "--preview", "--yes", "--source-only"]
    : cmd === "enable" ? ["--only", "--preview", "--yes"] : ["--preview", "--yes"];
  if (!["list", "show", "init", "add", "apply", "restore", "update", "enable", "disable", "remove"].includes(cmd)
    || [...values.keys()].some((k) => !allowed.includes(k)) || (values.has("--yes") && values.has("--preview")) || (values.has("--library") && values.has("--path"))) return null;
  const expected = ["list", "restore"].includes(cmd) || values.has("--path") ? 0 : 1;
  if (operands.length !== expected || (values.has("--path") && !values.get("--path"))) return null;
  if (values.has("--category") && !["invariants", "language", "pattern", "library", "practice", "process"].includes(values.get("--category")!)) return null;
  return { cmd, arg: operands[0], path: values.get("--path"), category: values.get("--category"), only: values.get("--only")?.split(","), library: values.has("--library"), json: values.has("--json"), preview: values.has("--preview"), yes: values.has("--yes"), sourceOnly: values.has("--source-only") };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Build one candidate; cache population never activates an intermediate contract.
function batch(context: Context, path: string): Preset | { errors: string[] } {
  const plan: unknown = JSON.parse(readFileSync(resolve(path), "utf8"));
  return composePackPlan(context.root, context.preset, plan);
}

// Guided setup and scripted adoption build the same candidate without a temporary plan file.
// Only cache population can occur here; review and activation stay with the caller.
export function composePackPlan(root: string, input: Preset, plan: unknown): Preset | { errors: string[] } {
  try { return composePlan({ root, preset: input, presetText: JSON.stringify(input), lockText: null }, plan); }
  catch (e) { return { errors: [visible(`Cannot prepare pack selection: ${(e as Error).message}. Nothing activated; correct the selection and retry.`)] }; }
}

function composePlan(context: Context, plan: unknown): Preset | { errors: string[] } {
  if (!record(plan) || Object.keys(plan).some((key) => !["sources", "methodologies", "scope", "overrides", "layers"].includes(key))
    || !Array.isArray(plan.sources) || !Array.isArray(plan.methodologies)
    || (!plan.methodologies.length && plan.scope === undefined && plan.layers === undefined) || plan.methodologies.some((id) => typeof id !== "string" || !id)) {
    return { errors: ["Batch plan requires sources and methodologies arrays, with at least one methodology or a scope or layers change; unknown fields are rejected."] };
  }
  let preset = planFields(context.preset, plan);
  if ("errors" in preset) return preset;
  for (const source of plan.sources) {
    if (!record(source)) return { errors: ["Invalid batch source."] };
    const fields = source.kind === "library" ? ["kind", "ns"] : source.kind === "path" ? ["kind", "path"] : source.kind === "git" ? ["kind", "url", "ref"] : [];
    if (!fields.length || Object.keys(source).length !== fields.length || fields.some((key) => typeof source[key] !== "string" || !source[key])) return { errors: ["Invalid batch source fields."] };
    const options: Options = { cmd: "add", library: source.kind === "library", json: false, preview: true, yes: false,
      arg: source.kind === "library" ? source.ns as string : source.kind === "git" ? `${source.url}@${source.ref}` : undefined,
      path: source.kind === "path" ? resolve(context.root, source.path as string) : undefined };
    const existing = preset.sources.find((pin) => source.kind === "library" ? pin.ns === source.ns
      : source.kind === "path" ? pin.kind === "path" && resolve(context.root, pin.path) === options.path
      : pin.kind === "git" && pin.url === source.url && pin.ref === source.ref);
    if (existing) {
      if (source.kind === "library" && (existing.kind !== "library" || existing.version !== librarySources().find((pin) => pin.ns === source.ns)?.version)) return { errors: [`Existing namespace ${source.ns} has a different pin; review pack update separately.`] };
      continue;
    }
    const imported = importSource({ ...context, preset }, options);
    if ("errors" in imported) return imported;
    preset = imported;
  }
  for (const id of plan.methodologies as string[]) {
    const selected = compose({ ...context, preset }, { cmd: "enable", arg: id, library: false, json: false, preview: true, yes: false });
    if ("errors" in selected) return selected;
    preset = selected;
  }
  return preset;
}

function planFields(input: Preset, plan: Record<string, unknown>): Preset | { errors: string[] } {
  let preset = structuredClone(input);
  if (plan.overrides !== undefined) {
    if (!record(plan.overrides)) return { errors: ["Batch overrides must be a preset override object; nothing applied."] };
    const candidate = { ...preset, overrides: { ...preset.overrides, ...plan.overrides } };
    const errors = validate("preset", candidate);
    if (errors.length) return { errors };
    preset = candidate as Preset;
  }
  // A reviewed plan may replace scope or layers; approval still binds the exact preset text.
  for (const key of ["scope", "layers"] as const) {
    if (plan[key] === undefined) continue;
    const candidate = { ...preset, [key]: plan[key] };
    const errors = validate("preset", candidate);
    if (errors.length) return { errors };
    preset = candidate as Preset;
  }
  return preset;
}

function restore(context: Context): Result {
  if (context.lockText === null) return { code: 1, text: "Restore requires a committed lock with exact source hashes." };
  const lock = JSON.parse(context.lockText) as Lock;
  for (const source of context.preset.sources.filter((pin) => pin.kind === "git")) {
    const pin = lock.gitSources?.find((entry) => entry.ns === source.ns && entry.url === source.url && entry.ref === source.ref);
    if (!pin || !/^[0-9a-f]{40}$/.test(pin.ref) || !/^[0-9a-f]{64}$/.test(pin.hash)) return { code: 1, text: `Missing exact lock pin for ${source.ns}; nothing activated.` };
    if (cachedPack(pin) !== null) continue;
    const fetched = fetchPack(pin.url, pin.ref, clock, pin);
    if ("errors" in fetched) return { code: 1, text: fetched.errors.join("\n") };
  }
  const compiled = validateContract({ presetText: context.presetText, filesOf: sourcesOf(context.root, true), versions: VERSIONS, now: clock });
  if ("errors" in compiled) return { code: 1, text: compiled.errors.join("\n") };
  if (compiled.text !== context.lockText.replaceAll("\r\n", "\n")
    || readText(join(context.root, PRESET)) !== context.presetText || readText(join(context.root, LOCK)) !== context.lockText) {
    return { code: 1, text: "Restored sources do not match the committed contract, or it changed during restoration. Preset, lock and consent were not written." };
  }
  return { code: 0, text: "Exact pack pins restored and fixtures verified. Preset, lock and local consent unchanged. Run pregate status; the human can enable protection after review." };
}

function inspectPath(options: Options): Result {
  const catalog = packCatalog(readTree(canonical(resolve(options.path!)), false));
  return "errors" in catalog ? { code: 1, text: catalog.errors.join("\n") } : render([catalog], options.json, []);
}

function discoverLibrary(context: Context | null, options: Options): Result {
  const pins = librarySources();
  let all = pins.map((source) => {
    const catalog = packCatalog(librarySource(source.ns)!);
    if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
    return catalog;
  });
  if (options.category) all = all.filter((c) => c.category === options.category);
  if (options.cmd === "show") {
    const found = all.find((c) => c.ns === options.arg || c.methodologies.some((m) => m.id === options.arg));
    if (!found) return { code: 1, text: "No bundled pack or methodology " + options.arg + ". Use pack list --library." };
    all = [options.arg === found.ns ? found : { ...found, methodologies: found.methodologies.filter((m) => m.id === options.arg) }];
  }
  const selected = (context?.preset.methodologies ?? []).filter((id) => pins.some((pin) => id.startsWith(pin.ns + "/")
    && context?.preset.sources.some((source) => source.kind === "library" && source.ns === pin.ns && source.version === pin.version)));
  return render(all, options.json, selected, pins, options.cmd === "show");
}

function catalogs(context: Context): Catalog[] {
  return context.preset.sources.map((source) => {
    const files = sourcesOf(context.root)(source);
    if (files === null) throw new Error(`${source.ns}: source missing or pinned cache corrupt`);
    const catalog = packCatalog(files);
    if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
    if (catalog.ns !== source.ns) throw new Error(`${source.ns}: source namespace changed to ${catalog.ns}`);
    return catalog;
  });
}

function discover(context: Context, options: Options): Result {
  const all = catalogs(context).filter((c) => !options.category || c.category === options.category);
  if (options.cmd === "show") {
    const found = all.find((c) => c.ns === options.arg || c.methodologies.some((m) => m.id === options.arg));
    if (!found) return { code: 1, text: `No pack or methodology ${options.arg}. Use pack list.` };
    const catalog = options.arg === found.ns ? found : { ...found, methodologies: found.methodologies.filter((m) => m.id === options.arg) };
    return render([catalog], options.json, context.preset.methodologies, context.preset.sources);
  }
  return render(all, options.json, context.preset.methodologies, context.preset.sources, false);
}

function render(all: Catalog[], json: boolean, selected: string[], sources: Preset["sources"] = [], detailed = true): Result {
  const packs = all.map((c) => ({ ...c, source: sources.find((s) => s.ns === c.ns) ?? null,
    validation: "structure-only; run rules test for fixture evidence", languages: [...new Set(c.checks
      .filter((check) => check.impl.kind === "pattern" || ["metric", "layer-edge", "banned-import", "drizzle-bounded-select", "interval-cleanup", "react-index-key", "credential-literal", "python-legacy", "typescript-fact", "dependency-pin"].includes(check.impl.primitive))
      .flatMap((check) => ruleLanguages(check)).flatMap((lang) => lang === "typescript" ? ["javascript", "typescript"] : [lang]))].sort(),
    checks: c.checks.map((check) => ({ ...check, languages: ruleLanguages(check) })),
    methodologies: c.methodologies.map((m) => ({ ...m, selected: selected.includes(m.id) || m.id.startsWith("core/") })) }));
  if (json) return { code: 0, text: JSON.stringify({ packs: detailed ? packs : packs.map((c) => ({
    ns: c.ns, version: c.version, category: c.category, source: c.source, languages: c.languages, validation: c.validation, checks: c.checks.length,
    methodologies: c.methodologies.map((m) => ({ id: m.id, version: m.version, status: m.status, selected: m.selected, invariants: m.invariants.length })),
  })) }, null, 2) };
  return { code: 0, text: visible(packs.map((c) => [
    `${c.ns}@${c.version} · ${c.category ?? "unclassified"} · ${c.checks.length} checks · ${c.source?.kind ?? "unregistered local source"} · ${c.languages.join("/") || "language-independent guards"}`,
    ...c.methodologies.flatMap((m) => [`  ${m.id}@${m.version} · ${m.status} · ${m.selected ? "selected" : "not selected"}`,
      ...(detailed ? m.invariants.map((a) => `    ${c.ns}/${a.id} · ${a.severity} · ${a.check}\n      ${a.why}`) : [`    ${m.invariants.length} invariants; pack show ${m.id} for details.`])]),
    "  Structure validated; fixture execution and effective policies are separate (rules test / preset show).",
  ].join("\n")).join("\n\n")) };
}

function importSource(context: Context, options: Options): Preset | { errors: string[] } {
  const preset = structuredClone(context.preset);
  const existing = preset.sources.find((s) => s.ns === options.arg);
  if (options.library || (options.cmd === "update" && existing?.kind === "library")) {
    const pin = librarySources().find((s) => s.ns === options.arg);
    if (!pin) return { errors: ["No bundled pack " + options.arg + ". Use pack list --library."] };
    if (options.cmd === "add" && existing) return { errors: ["Namespace " + pin.ns + " already exists; use pack update."] };
    const errors = testPack(librarySource(pin.ns, true)!, clock);
    if (errors.length) return { errors };
    preset.sources = [...preset.sources.filter((s) => s.ns !== pin.ns), pin];
    return preset;
  }
  if (options.path !== undefined) {
    const path = canonical(resolve(options.path));
    const files = readTree(path, true);
    const catalog = packCatalog(files);
    if ("errors" in catalog) return catalog;
    const errors = testPack(files, clock);
    if (errors.length) return { errors };
    if (preset.sources.some((s) => s.ns === catalog.ns)) return { errors: [`Namespace ${catalog.ns} already exists.`] };
    preset.sources.push({ ns: catalog.ns, kind: "path", path: relativePath(context.root, path) });
    return preset;
  }
  const source = preset.sources.find((s) => s.ns === options.arg);
  const at = options.arg!.lastIndexOf("@");
  if (options.cmd === "update" && source?.kind !== "git") return { errors: [`No Git pack ${options.arg} in this preset.`] };
  if (options.cmd === "add" && (at < 1 || at === options.arg!.length - 1)) return { errors: ["Pack add requires <url>@<ref>, or --path <dir>."] };
  const url = options.cmd === "add" ? options.arg!.slice(0, at) : source!.kind === "git" ? source!.url : "";
  const fetched = fetchPack(url, options.cmd === "add" ? options.arg!.slice(at + 1) : "HEAD", clock);
  if ("errors" in fetched) return fetched;
  if (options.cmd === "update" && fetched.ns !== options.arg) return { errors: ["Updated pack changed namespace; not applied."] };
  if (options.cmd === "add" && preset.sources.some((s) => s.ns === fetched.ns)) return { errors: [`Namespace ${fetched.ns} already exists; use pack update.`] };
  preset.sources = [...preset.sources.filter((s) => s.ns !== fetched.ns), fetched];
  return preset;
}

function compose(context: Context, options: Options): Preset | { errors: string[] } {
  const all = catalogs(context);
  const manifests = all.flatMap((c) => c.methodologies);
  if (options.cmd === "remove") {
    if (!context.preset.sources.some((s) => s.ns === options.arg)) return { errors: [`No pack ${options.arg} in this preset.`] };
    return removeSelection(context.preset, manifests, options.arg!, true);
  }
  const manifest = manifests.find((m) => m.id === options.arg);
  if (manifest === undefined && options.cmd === "enable") return enableBundled(context, options);
  if (manifest === undefined) return { errors: [`No methodology ${options.arg}. Use pack list.`] };
  return options.cmd === "enable" ? selectMethodology(context.preset, manifest, options.only)
    : removeSelection(context.preset, manifests, options.arg!);
}

// `pack enable <ns>/<methodology>` of a bundled pack the preset does not register yet adds its pin in
// the same review, instead of a second approval for the source.
function enableBundled(context: Context, options: Options): Preset | { errors: string[] } {
  const ns = options.arg!.split("/")[0]!;
  if (!librarySources().some((pin) => pin.ns === ns) || context.preset.sources.some((s) => s.ns === ns)) return { errors: [`No methodology ${options.arg}. Use pack list.`] };
  const added = importSource(context, { ...options, cmd: "add", library: true, arg: ns });
  if ("errors" in added) return added;
  const manifest = catalogs({ ...context, preset: added }).flatMap((c) => c.methodologies).find((m) => m.id === options.arg);
  if (manifest === undefined) return { errors: [`No methodology ${options.arg} in bundled pack ${ns}. Use pack show --library ${ns}.`] };
  return selectMethodology(added, manifest, options.only);
}

// `pack add` also selects the new pack's complete methodologies, in the same review. Each joins only
// if the contract still compiles with it: one that needs layers or conflicts is named, not forced.
function selectAdded(context: Context, added: Preset): { preset: Preset; note: string[] } {
  const ns = added.sources.find((s) => !context.preset.sources.some((pin) => pin.ns === s.ns))?.ns;
  const manifests = catalogs({ ...context, preset: added }).find((c) => c.ns === ns)?.methodologies ?? [];
  if (manifests.length === 0) return { preset: added, note: [] };
  let preset = added;
  const selected: string[] = [], skipped: string[] = [];
  for (const manifest of manifests) {
    const next = manifest.status === "complete" ? selectMethodology(preset, manifest) : { errors: ["preview methodology"] };
    const compiled = "errors" in next ? next : compile(JSON.stringify(next), sourcesOf(context.root), VERSIONS);
    if ("errors" in compiled) { skipped.push(`${manifest.id} (${compiled.errors[0]})`); continue; }
    preset = next as Preset;
    selected.push(manifest.id);
  }
  const later = skipped.length === 0 ? "" : ` Skipped: ${skipped.join("; ")}. Choose them later with pack enable <ns/methodology> --preview.`;
  return { preset, note: [`Selected: ${selected.join(", ") || "none"}.${later} Use --source-only to register the pack without selecting rules.`] };
}

function scaffold(ns: string): { code: number; text: string } {
  if (!/^[a-z][a-z0-9-]*$/.test(ns) || ns === "core") return { code: 1, text: "Pack namespace must be lowercase, contain only letters/digits/hyphens, and differ from core." };
  const dir = join(process.cwd(), ".pregate/packs", ns);
  if (existsSync(dir)) return { code: 1, text: `${dir} already exists; nothing overwritten.` };
  const files = packTemplate(ns);
  const errors = testPack(files, clock);
  if (errors.length) return { code: 1, text: errors.join("\n") };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeAtomic(join(dir, path), text);
  }
  return { code: 0, text: `${dir} scaffolded; fixtures pass. Publish this directory as a Git repository. Adding it to a preset requires human approval.` };
}

async function activate(context: Context, preset: Preset, options: Options, note: string[] = []): Promise<Result> {
  const { root } = context;
  const text = JSON.stringify(preset, null, 2) + "\n";
  const compiled = validateContract({ presetText: text, filesOf: sourcesOf(root, true), versions: VERSIONS, now: clock });
  if ("errors" in compiled) return { code: 1, text: compiled.errors.join("\n") };
  const baseline = sha256(context.presetText + (context.lockText ?? ""));
  if (baseline !== sha256((readText(join(root, PRESET)) ?? "") + (readText(join(root, LOCK)) ?? ""))) return { code: 1, text: "Contract changed during pack operation; nothing applied. Try again." };
  if (options.preview) {
    const proposal = proposeContract({ root, baseline, lockText: compiled.text, activate: false, writes: [{ path: join(root, PRESET), before: context.presetText, after: text }] }, true);
    const review = pendingReview(root, sha256(JSON.stringify(proposal)));
    return { ...review, text: [...note, review.text].join("\n") };
  }
  const applied = await applyPreset(root, text, { yes: options.yes });
  if (applied.code !== 0) return applied;
  enable(root);
  const pins = (compiled.lock.gitSources ?? []).map((s) => `${s.ns}: ${s.url}@${s.ref}\nContent hash: ${s.hash}`);
  return { code: 0, text: [...note, ...pins, applied.text, "Use pack list, pack enable <ns/methodology> --preview, then audit to inspect existing debt."].join("\n") };
}
