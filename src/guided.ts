import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { approve, readProposal } from "./approval.ts";
import { applyPreset, applyReviewedProposal, pendingReview, validateReviewedProposal } from "./approval-command.ts";
import { audit } from "./audit-command.ts";
import { fitness } from "./fitness-command.ts";
import { consentedRoots, dataHome } from "./consent.ts";
import { visible } from "./contract.ts";
import { canonical, findRoot, readTree } from "./disk.ts";
import { grammars, LOCK, PRESET, readText, VERSIONS } from "./gate.ts";
import { git } from "./git.ts";
import { arkgateNotice } from "./arkgate-import.ts";
import { init, repoFiles } from "./init.ts";
import { librarySource } from "./library.ts";
import { describeCi } from "./ci/detect.ts";
import { doctor, setup, setupBlocked } from "./machine.ts";
import { detectedScope, detectStack, emptyLayerLines, scopeCoverage } from "./onboard.ts";
import { composePackPlan, projectUpdate } from "./pack-command.ts";
import { packCatalog } from "./compile.ts";
import { projectUpdates } from "./project-updates.ts";
import { baseMethodologies, checkedLayerMap, declaresCore, recommendPacks, recommendationOverrides, proposedScope } from "./scan-command.ts";
import { sha256 } from "./state.ts";
import { contractDiagnosis, protectionStatus } from "./status.ts";
import { choose, customPaths, interactiveTerminal, say, selectPacks, question } from "./guided-terminal.ts";
import { guidedReview, protectionReadiness } from "./guided-review.ts";
import { updateAndContinue } from "./guided-update.ts";
import { availableCatalog, catalogDiscovery, previousCatalog } from "./catalog-discovery.ts";
import { discoverDocumentation, documentationPack } from "./project-discovery.ts";
import { compilableStatements, instructionFiles, instructionProposals, type Compiled } from "./rules-add-command.ts";
import { ENGINE_FILE, WINDOWS } from "./platform.ts";
import { hasRepository } from "./workspace.ts";
import { validate } from "./schema.ts";
import type { Enforcement, Preset } from "./types.ts";

type Result = { code: number; text: string; held?: string[]; lead?: string; notes?: string[] };
type Selection = { packs?: string[]; customPacks: string[]; customFromDocs?: boolean; enforcement?: Enforcement; preset?: string; layersFile?: string; compiles?: string[] };
type Options = Omit<Selection, "compiles"> & { json: boolean; preview: boolean; full: boolean; projects: string[]; compiles: string[] };
type Reviewed = { root: string; digest: string; activate: boolean; warning: boolean; text: string };
type Installation = { launcherPresent: boolean; enginePresent: boolean; harnessesConfigured: number };
const USAGE = "usage: pregate guide [--json|--preview [--full]] [--packs <ns,ns|none>] [--custom-pack <path>] [--custom-from-docs] [--layers <layers.json>] [--compile <proposals.json>] [--enforcement advisor|enforce|shadow] [--preset <name>] | guide [--json|--preview [--full]] --projects <path...>";

function optionsOf(args: string[]): Options | null {
  const result: Options = { json: false, preview: false, full: false, customPacks: [], compiles: [], projects: [] };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (seen.has(arg) && arg !== "--custom-pack" && arg !== "--compile") return null;
    seen.add(arg);
    if (arg === "--json") result.json = true;
    else if (arg === "--preview") result.preview = true;
    else if (arg === "--full") result.full = true;
    else if (arg === "--custom-from-docs") result.customFromDocs = true;
    else if (arg === "--projects") {
      while (args[i + 1] !== undefined && !args[i + 1]!.startsWith("--")) result.projects.push(args[++i]!);
      if (!result.projects.length || result.projects.some(path => !path || path.startsWith("-"))) return null;
    } else if (["--packs", "--custom-pack", "--enforcement", "--preset", "--layers", "--compile"].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("-")) return null;
      if (arg === "--packs") {
        result.packs = value === "none" ? [] : value.split(",").map(name => name.trim());
        if (result.packs.some(name => !/^[a-z][a-z0-9-]*$/.test(name))) return null;
      } else if (arg === "--custom-pack") result.customPacks.push(value);
      else if (arg === "--layers") result.layersFile = value;
      else if (arg === "--compile") result.compiles.push(value);
      else if (arg === "--preset") result.preset = value;
      else if (value === "shadow" || value === "enforce" || value === "advisor") result.enforcement = value;
      else return null;
    } else return null;
  }
  const selection = result.packs !== undefined || result.customPacks.length || result.customFromDocs || result.layersFile !== undefined || result.compiles.length > 0 || result.enforcement !== undefined || result.preset !== undefined;
  return (result.json && result.preview) || (result.full && !result.preview) || (selection && (!result.preview || result.projects.length > 0)) ? null : result;
}

function projectRoot(directory: string): string {
  const cwd = canonical(directory);
  if (!statSync(cwd).isDirectory()) throw new Error("Project path must be a directory.");
  const established = findRoot(cwd, () => true);
  if (established !== null) return established;
  const top = git(cwd, ["rev-parse", "--show-toplevel"])?.trim();
  if (top === undefined && hasRepository(cwd)) throw new Error("Git cannot identify this worktree. Restore Git access and retry.");
  return canonical(top ?? cwd);
}

function projectFiles(root: string, errors: string[]): ReturnType<typeof repoFiles> {
  try { return repoFiles(root); } catch (e) { errors.push(`Cannot inventory this project: ${(e as Error).message}`); return {}; }
}

function projectStack(files: ReturnType<typeof repoFiles>, errors: string[]): ReturnType<typeof detectStack> | null {
  try { return detectStack(files); } catch (e) { errors.push(packInferenceError(e)); return null; }
}

function packRecommendations(files: ReturnType<typeof repoFiles>, stack: ReturnType<typeof detectStack>, base: Preset | null, errors: string[]): ReturnType<typeof recommendPacks> {
  try { return recommendPacks(files, stack.languages, baseMethodologies(stack, base), declaresCore(base)); } catch (e) { errors.push(packInferenceError(e)); return []; }
}

function packInferenceError(e: unknown): string {
  return `Cannot infer packs: ${(e as Error).message}. Correct the project metadata and retry.`;
}

function savedPreset(root: string): Preset | null {
  try { return JSON.parse(readFileSync(join(root, PRESET), "utf8")); }
  catch (error) {
    // Diagnosis names malformed JSON; an unreadable preset contributes no scope coverage.
    if (error instanceof SyntaxError || typeof (error as NodeJS.ErrnoException).code === "string") return null;
    throw error;
  }
}

// Inspect repository metadata and recorded evidence; no proposal, consent or code writes.
export async function inspectProject(directory: string) {
  const root = projectRoot(directory), established = existsSync(join(root, PRESET));
  const status = protectionStatus(established ? root : null);
  const diagnosis = established ? contractDiagnosis(root) : null;
  const errors = [...new Set([...(diagnosis?.errors ?? []), ...(established ? status.contract.errors : [])])];
  await grammars();
  const files = projectFiles(root, errors);
  const stack = projectStack(files, errors);
  const preset = established ? savedPreset(root) : null;
  const validPreset = preset && validate("preset", preset).length === 0 ? preset : null;
  const recommendations = stack ? packRecommendations(files, stack, validPreset, errors) : [];
  for (const item of recommendations) {
    if (item.scopeProblems?.length) errors.push(`${item.ns}: ${item.scopeProblems.join(" ")} No automatic scope applied.`);
  }
  const initialScope = !established && stack ? proposedScope(files, stack) : null;
  const coverage = validPreset ? scopeCoverage(files, validPreset.scope) : initialScope ? scopeCoverage(files, initialScope) : null;
  const coverageState = validPreset ? "current" : initialScope ? "proposed" : "unavailable";
  const discovery = catalogDiscovery(availableCatalog(), previousCatalog(diagnosis?.project.lockEngine ?? null), validPreset, recommendations);
  discovery.suggestedAdditions = discovery.suggestedAdditions.map(item => ({ ...item,
    methodologies: item.methodologies.filter(method => !validPreset?.methodologies.includes(method)) }));
  const documentation = discoverDocumentation(root);
  const outdated = !!diagnosis && [diagnosis.project.engine, diagnosis.project.lockEngine].some(engine => engine !== null && engine !== VERSIONS.engine);
  const state = !established ? "new" : outdated ? "needs-update" : !status.contract.valid ? "needs-repair" : status.state;
  const installation = { ...status.installation, harnessesConfigured: status.harnesses.filter(harness => harness.configured).length };
  const actions = projectActions(state, installation, coverage?.outsideScope.length ?? 0, recommendations.map(item => item.ns));
  return { schemaVersion: 1, root, engine: VERSIONS, state, consent: status.consent, installation,
    projectVersions: diagnosis?.project ?? null, coverage, coverageState, proposedScope: initialScope, stack, recommendations, discovery, documentation,
    arkgate: arkgateNotice(root, validPreset),
    layerWarnings: validPreset ? emptyLayerLines(validPreset.layers, Object.keys(files)) : [],
    globWarnings: validPreset ? status.globWarnings : [],
    onboarding: !established ? { scanSuggested: true, customPack: documentation.customPack,
      next: "Let's review documentation, stack and code. Choose useful packs; a custom project draft is optional; no existing policy is assumed." } : null,
    customCandidates: stack?.edges.map(evidence => ({ evidence, next: "Propose a local boundary rule with pass/fail/trap fixtures, then review it with the other packs." })) ?? [],
    counts: { blocking: status.rules.filter(rule => rule.implementation !== "fitness" && rule.enforcement === "enforce" && rule.severity !== "warn").length,
      advisor: status.rules.filter(rule => rule.implementation !== "fitness" && rule.enforcement === "advisor").length,
      shadow: status.rules.filter(rule => rule.implementation !== "fitness" && rule.enforcement === "shadow").length,
      warning: status.rules.filter(rule => rule.severity === "warn").length, unverified: status.fitnessCoverage.unverified },
    actions, errors, next: diagnosis?.next ?? [], knownProjects: knownProjects(),
    ci: describeCi(root),
  };
}

function projectActions(state: string, installation: Installation, outside: number, packs: string[]) {
  const preferred = state === "new" ? "configure" : ["needs-update", "needs-repair"].includes(state) ? "update" : state === "inactive" ? "activate" : outside ? "configure" : "audit";
  const actions = [
    { id: "configure", label: state === "new" ? "Configure this project" : "Review coverage and packs", reason: "Select optional packs together and review actual source coverage.", command: `pregate guide --preview${state === "new" ? "" : " --packs " + (packs.join(",") || "none")}` },
    ...(state === "new" ? [] : [{ id: "update", label: "Update or repair this project's contract", reason: "Review engine, core, all packs and supported corrections together.", command: "pregate guide --preview" },
      { id: "activate", label: "Review and activate protection", reason: "Activation is a separate choice for this worktree.", command: "pregate enable" },
      { id: "audit", label: "Audit code and choose freeze or repairs", reason: "See findings, coverage gaps and unverified requirements.", command: "pregate audit --plan --json" }]),
    { id: "projects", label: "Update several projects", reason: "Choose explicit paths; preview all and confirm once.", command: "pregate guide --projects <path...>" },
    ...(!installation.launcherPresent || !installation.enginePresent || !installation.harnessesConfigured ? [{ id: "setup", label: "Repair installation and hooks", reason: "Missing installation or hooks prevent effective protection.", command: "pregate setup" }] : []),
    { id: "global", label: "Install the latest engine", reason: "Download and verify the release through the normal updater.", command: "pregate update" },
    { id: "doctor", label: "Diagnose installation", reason: "Check registrations and real denial canaries.", command: "pregate doctor" },
    { id: "ci", label: "Add a CI backstop", reason: "GitHub Actions, the Vercel build, or both. A repository does not need Actions to gate a Vercel deployment.", command: "pregate install --ci github,vercel" },
  ].map(action => ({ ...action, recommended: action.id === preferred }));
  return actions.sort((a, b) => Number(b.recommended) - Number(a.recommended));
}

function card(info: Awaited<ReturnType<typeof inspectProject>>): string {
  return [`PREGATE ${VERSIONS.engine} · ${info.root}`, `Project: ${info.state}; local consent ${info.consent ? "enabled" : "disabled"}.`,
    ...(info.coverage ? [`${info.coverageState === "proposed" ? "Proposed source scope (not active)" : "Current source scope"}: ${info.coverage.inScope}/${info.coverage.inventoried} parser-supported files; ${info.coverage.outsideScope.length} outside, ${info.coverage.excluded.length} deliberately excluded; ${info.coverage.unsupported.length} source-like files without a parser. Scope is not behavior coverage.`,
      ...info.coverage.roles.filter(role => role.outsideScope || role.unsupported).map(role => `By file-name convention: ${role.role} · ${role.outsideScope} outside scope, ${role.unsupported} unsupported. This does not infer behavior coverage.`)] : []),
    ...(info.projectVersions ? [`Installed engine: ${VERSIONS.engine}. Project engine: ${info.projectVersions.lockEngine ?? "no valid lock"}; core: ${info.projectVersions.core ?? "unknown"}.`] : []),
    `Static checks: ${info.counts.blocking} blocking, ${info.counts.advisor} advisor, ${info.counts.shadow} observe-only, ${info.counts.warning} warnings.`,
    `Catalog: ${info.discovery.available.length} optional packs. ${info.discovery.newPacks.length ? `${info.discovery.newPacks.length} new packs (${info.discovery.newPackChecks} checks): ${info.discovery.newPacks.map(pack => pack.ns).join(", ")}.` : info.discovery.comparisonAvailable ? "No new packs since this project's engine." : "Previous catalog unavailable; new-pack count unknown."}`,
    ...(info.discovery.changedPacks.length ? [`Updated packs: ${info.discovery.changedPacks.map(pack => pack.ns).join(", ")}. Review their current rules and limits.`] : []),
    ...(info.discovery.suggestedAdditions.length ? [`Missing suggested methodologies: ${info.discovery.suggestedAdditions.flatMap(item => item.methodologies).join(", ")}. Review them together with guide; packs stay optional.`] : []),
    ...info.layerWarnings, ...info.globWarnings,
    ...(info.arkgate ? [info.arkgate.suggestion] : []),
    ...(info.onboarding ? [`No project rules yet. Let's scan documentation, stack and code.`, `Custom pack idea: ${info.documentation.customPack.ns}. ${info.documentation.customPack.reason}`,
      ...(info.documentation.requirements.length ? [`Optional: draft a project pack from ${info.documentation.requirements.length} documented requirements: pregate guide --preview --custom-from-docs`] : ["The agent can use scan --json to propose domain rules and tests from the project evidence."])] : []),
    info.ci.text,
    ...info.errors, ...info.actions.filter(action => action.recommended).map(action => `Suggested: ${action.label}. ${action.command}`),
    "The agent can inspect guide --json and prepare guide --preview. Only the human confirms activation; no approval is inferred from a terminal."].join("\n");
}

function methodsFor(names: string[], recommendations: ReturnType<typeof recommendPacks>): string[] {
  return names.flatMap(ns => {
    const suggested = recommendations.find(item => item.ns === ns);
    if (suggested) return suggested.methodologies;
    const files = librarySource(ns);
    if (!files) throw new Error(`Unknown bundled pack ${ns}. Choose a name from pregate pack list --library.`);
    const catalog = packCatalog(files);
    if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
    return catalog.methodologies.map(method => method.id);
  });
}

async function prepare(directory: string, selection: Selection): Promise<Result> {
  const info = await inspectProject(directory);
  const compiles = selection.compiles ?? [];
  if ((selection.layersFile !== undefined || compiles.length > 0) && info.state !== "new") {
    return { code: 1, text: "This project already has a contract. A layer map is pregate layers apply <file> --preview, and instruction rules are pregate compile apply <file> --preview. Each is its own review. Nothing staged." };
  }
  const names = selection.packs ?? info.recommendations.map(item => item.ns);
  const methodologies = methodsFor(names, info.recommendations);
  const selectedRecommendations = info.recommendations.filter(item => names.includes(item.ns));
  const layers = selectedRecommendations.find(item => item.layers)?.layers;
  const draft = selection.customFromDocs ? documentationPack(info.documentation) : null;
  if (selection.customFromDocs && (!draft || info.state !== "new")) return { code: 1, text: !draft ? "No documented requirement was inferred. Review scan --json and propose domain assertions from the repo; nothing activated." : "This project already has rules. Review its custom pack with --custom-pack instead of creating a second onboarding draft." };
  if (info.state === "new") {
    const folded = await foldNewProject(info.root, { ...selection, compiles }, layers);
    if ("code" in folded) return folded;
    const prepared = await init(["--preview", ...(selection.preset ? ["--preset", selection.preset] : [])], {
      packs: names, customPacks: selection.customPacks, methodologies, overrides: recommendationOverrides(selectedRecommendations), ...(draft ? { customDraft: draft } : {}),
      ...(folded.layers ? { layers: folded.layers } : {}),
      ...(folded.explicitLayers ? { explicitLayers: true } : {}),
      ...(folded.instructionRules.length ? { instructionRules: folded.instructionRules } : {}),
      enforcement: selection.enforcement ?? "advisor",
    }, info.root);
    const notes = [...folded.notes, ...(prepared.notes ?? [])];
    if (prepared.code !== 0 || notes.length === 0) return prepared;
    return { ...prepared, lead: notes.join("\n"), text: `${folded.notes.length ? `${folded.notes.join("\n")}\n` : ""}${prepared.text}` };
  }
  if (["needs-update", "needs-repair"].includes(info.state)) {
    if (selection.preset) return { code: 1, text: "Keep this project's recipe. Select packs instead of replacing the preset." };
    if (selection.packs === undefined && !selection.customPacks.length && !selection.enforcement) return projectUpdate(["--preview"], info.root);
  }
  if (selection.packs === undefined && !selection.customPacks.length && !selection.enforcement && !selection.preset) return { code: 0, text: "Project already current. No contract or consent changed. Use guide to review coverage/packs or run an audit." };
  if (selection.preset) return { code: 1, text: "An existing project keeps its recipe. Select packs and scope instead of replacing its preset." };
  const preset = JSON.parse(readFileSync(join(info.root, PRESET), "utf8")) as Preset;
  const files = repoFiles(info.root);
  const localMethods = selection.customPacks.flatMap(path => {
    const catalog = packCatalog(requirePack(path, info.root));
    if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
    return catalog.methodologies.map(method => method.id);
  });
  const plan = { sources: [...names.map(ns => ({ kind: "library", ns })), ...selection.customPacks.map(path => ({ kind: "path", path }))],
    methodologies: [...methodologies, ...localMethods], scope: detectedScope(files, preset.scope), overrides: recommendationOverrides(selectedRecommendations, preset),
    ...(layers && !Object.keys(preset.layers ?? {}).length ? { layers } : {}) };
  if (["needs-update", "needs-repair"].includes(info.state)) return projectUpdate(["--preview"], info.root, { plan, enforcement: selection.enforcement });
  const candidate = composePackPlan(info.root, preset, plan);
  if ("errors" in candidate) return { code: 1, text: [...candidate.errors, "Nothing applied. Correct the selection and retry; keep protection enabled."].join("\n") };
  if (selection.enforcement) candidate.enforcement = selection.enforcement;
  const text = JSON.stringify(candidate, null, 2) + "\n";
  if (text === readText(join(info.root, PRESET))?.replaceAll("\r\n", "\n")) return { code: 0, text: "Selected scope and packs are already current; no contract or consent changed." };
  return applyPreset(info.root, text, { preview: true });
}

// `--layers` replaces the map folder names produced. It does not change how those names are derived.
// Statements that compile on their own are included first. `--compile` adds rules that needed an
// example, and a repeated sentence is kept once so a proposals file does not drop the others.
async function foldNewProject(root: string, selection: Selection, recommended: Preset["layers"] | undefined): Promise<{ layers?: Preset["layers"]; explicitLayers: boolean; instructionRules: Compiled[]; notes: string[] } | Result> {
  const notes: string[] = [];
  let layers = recommended;
  let explicitLayers = false;
  // ark.config.json is the layer map. A --layers file stays out of this review: foldArkgate
  // writes the config's layers and coexist.arkgate into the same candidate.
  if (existsSync(join(root, "ark.config.json"))) {
    layers = undefined;
    if (selection.layersFile !== undefined) notes.push(`ark.config.json is present, so ${selection.layersFile} is not this review's layer map. This review imports ArkGate's layers and coexist.arkgate.`);
  } else if (selection.layersFile !== undefined) {
    const path = resolve(root, selection.layersFile);
    if (!existsSync(path) || !statSync(path).isFile()) return { code: 1, text: `No file ${selection.layersFile}. Nothing staged.` };
    const checked = checkedLayerMap(readFileSync(path, "utf8"), Object.keys(repoFiles(root)));
    if (typeof checked === "string") return { code: 1, text: checked.includes("Nothing staged.") ? checked : `${checked} Nothing staged.` };
    layers = checked.layers;
    explicitLayers = true;
    notes.push(`Proposed layer map: ${checked.why}`);
  }
  const rules: Compiled[] = [];
  const seen = new Set<string>();
  const take = (item: Compiled) => {
    const key = `${item.kind}:${item.rule ?? item.sentence}`;
    if (seen.has(key)) return;
    seen.add(key);
    rules.push(item);
  };
  for (const file of instructionFiles(root)) for (const item of compilableStatements(root, file)) take(item);
  for (const file of selection.compiles ?? []) {
    const path = resolve(root, file);
    if (!existsSync(path) || !statSync(path).isFile()) return { code: 1, text: `No file ${file}. Nothing staged.` };
    const parsed = instructionProposals(readFileSync(path, "utf8"), root);
    if ("errors" in parsed) return { code: 1, text: `${parsed.errors.join(" ")} Nothing staged.` };
    notes.push(...parsed.refused);
    for (const item of parsed.items) if (item.kind === "catalog" || item.kind === "draft") take(item);
  }
  if (rules.length > 0) notes.push("Instruction rules that compile join this review. Statements that need an example stay out unless --compile names them.");
  return { layers, explicitLayers, instructionRules: rules, notes };
}

function requirePack(path: string, root: string) {
  // Pack reads stay in the existing validated authoring/adoption path.
  return readTree(canonical(resolve(root, path)), true);
}

function rootsOf(paths: string[]): string[] {
  return [...new Set(paths.map(path => {
    const root = projectRoot(path);
    if (!existsSync(join(root, PRESET))) throw new Error(`${path}: no project contract. Configure it first: cd ${quoted(root)} && pregate guide --preview. Then approve its displayed digest before including it in an update batch.`);
    return root;
  }))];
}

function reviewOf(root: string, activate: boolean): Reviewed | null {
  const proposal = readProposal(root);
  if (proposal === null) return null;
  // A prior unrelated proposal must not turn an already-current update into an application.
  if (!activate && proposal.lockText === readText(join(root, LOCK))?.replaceAll("\r\n", "\n") && proposal.writes.every(write => write.after === readText(write.path)?.replaceAll("\r\n", "\n"))) return null;
  const digest = sha256(JSON.stringify(proposal));
  pendingReview(root, digest); // Reject stale previews before presenting an approval.
  return { root, digest, activate, ...guidedReview(proposal, digest, activate) };
}

async function applyReviews(reviews: Reviewed[]): Promise<Result> {
  if (!reviews.length) return { code: 0, text: "All selected projects are current. No approval or rewrite needed." };
  const installed = await ensureInstallation();
  if (installed.code !== 0) return installed;
  const refreshed = reviews.map(review => reviewOf(review.root, review.activate));
  if (refreshed.some((review, index) => review === null || review.digest !== reviews[index]!.digest)) return { code: 1, text: "A reviewed candidate changed before confirmation. Nothing applied. Run pregate guide --preview to prepare a fresh review." };
  const summary = refreshed.map(review => review!.text).join("\n\n");
  if (!await approve(summary, reviews.some(review => review.warning))) return { code: 0, text: "Cancelled or approval unavailable. This review was not applied; earlier completed steps are retained. Previews remain available." };
  for (const review of reviews) {
    const checked = await validateReviewedProposal(review.root, review.digest);
    if (checked.code !== 0) return { code: 1, text: `${review.root}: ${checked.text}\nNothing applied. Prepare a new review.` };
  }
  const results = [];
  for (const review of reviews) results.push({ root: review.root, ...await applyOne(review) });
  const failed = results.filter(result => result.code !== 0);
  return { code: failed.length ? 1 : 0, text: [...results.map(result => `${result.root}: ${result.text}`), `${results.length - failed.length}/${results.length} reviewed contracts applied.`,
    ...(failed.length ? ["Earlier successes are retained. Retry only:", ...failed.map(result => result.root)] : []), "Disabled projects stay disabled unless activation was explicitly selected."].join("\n") };
}

async function applyOne(review: Reviewed): Promise<Result> {
  try { return await applyReviewedProposal(review.root, review.digest, { activate: review.activate }); }
  catch (e) { return { code: 1, text: `Contract application could not finish: ${(e as Error).message}. A write may have completed; inspect preset diagnose --json, fix the filesystem problem and prepare a fresh review. Protection was not disabled.` }; }
}

async function ensureInstallation(): Promise<Result> {
  const status = protectionStatus(null);
  if (!status.installation.enginePresent || !status.installation.launcherPresent) {
    say(`First installing this engine (${VERSIONS.engine}) and its launcher; project contracts and consent remain unchanged until review.`);
    const result = await setup();
    say(result.text);
    // No harness wired is a warning and a degraded installation, which the next line already explains.
    // A real setup error still keeps the reviewed contract unapplied.
    if (setupBlocked(result.code, result.text)) return { code: 1, text: `${result.text}\nContract previews are retained and unapplied. Repair the named installation problem and retry guide.` };
  }
  const binary = join(dataHome(), VERSIONS.engine, ENGINE_FILE);
  const probe = Bun.spawnSync([binary, "--version"], { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5000 });
  if (probe.exitCode !== 0 || probe.stdout.toString().trim() !== `pregate ${VERSIONS.engine} (core ${VERSIONS.core})`) return { code: 1,
    text: `Installed engine ${VERSIONS.engine} did not confirm its required version. No contract review applied. Run pregate doctor and repair the named engine installation; previews and consent are preserved.` };
  const current = protectionStatus(null);
  if (!current.harnesses.some(harness => harness.configured)) say("No supported harness has registered hooks. Approval can configure CLI checks, but agent-edit protection remains degraded. Install a supported harness and rerun setup.");
  return { code: 0, text: "Installation available for the reviewed contract." };
}

async function configure(info: Awaited<ReturnType<typeof inspectProject>>): Promise<Result> {
  say(info.recommendations.map(item => `${item.ns}: ${item.reasons.join("; ")}`).join("\n"));
  const packs = await selectPacks(info.recommendations.map(item => item.ns));
  if (packs === null) return cancelled();
  let customFromDocs = false;
  // The onboarding card already named the custom pack idea; a first run has no local pack to add
  // yet (add one later with guide --preview --custom-pack <path>).
  if (info.state === "new") {
    const requirements = info.documentation.requirements;
    if (requirements.length) {
      say([...requirements.slice(0, 5).map(item => `${item.path}:${item.line} · ${item.statement}`), ...(requirements.length > 5 ? [`+${requirements.length - 5} more`] : [])].join("\n"));
      const custom = await choose("Draft a project pack from these documented requirements?", ["No, use the selected packs only", "Yes, add a draft project pack to this review"]);
      if (custom === null) return cancelled();
      customFromDocs = custom === 1;
    }
  }
  const existing = info.state !== "new";
  const customPacks = existing ? await customPaths() : [];
  if (customPacks === null) return cancelled();
  // New projects: 0 advisor, 1 enforce, 2 shadow. Existing projects: 0 keep, 1 advisor, 2 enforce, 3 shadow.
  const mode = await choose("Optional checks", existing
    ? ["Keep the current optional policy", "Advisor: inform the agent, never block", "Prevent new optional violations by default", "Observe only by default"]
    : ["Advisor: inform the agent, never block (recommended)", "Prevent new optional violations; retain existing debt", "Observe only: record findings silently"]);
  if (mode === null) return cancelled();
  const before = proposalDigest(info.root);
  const enforcement = (existing ? [undefined, "advisor", "enforce", "shadow"] as const : ["advisor", "enforce", "shadow"] as const)[mode];
  const prepared = await prepare(info.root, { packs, customPacks, enforcement, customFromDocs });
  if (prepared.code !== 0) return prepared;
  if (proposalDigest(info.root) === before) return prepared;
  const review = reviewOf(info.root, info.state === "new");
  if (review === null) return prepared;
  const applied = await applyReviews([review]);
  if (applied.code !== 0 || readProposal(info.root) !== null) return applied;
  say(applied.text);
  return afterAudit(info.root);
}

// Undefined, which JSON never parses to, marks an unreadable report.
function auditReport(text: string) {
  try { return JSON.parse(text); }
  catch (error) { if (error instanceof SyntaxError) return undefined; throw error; }
}

async function fitnessPlanIn(root: string, cwd: string): Promise<Result> {
  try { process.chdir(root); return await fitness(["plan"]); }
  finally { process.chdir(cwd); }
}

async function afterAudit(root: string, selectedChoice?: number): Promise<Result> {
  say("Auditing the selected project. This inventories code; it does not certify unverified requirements.");
  const result = await audit(["--repo", root, "--json", "--plan"]);
  const report = auditReport(result.text);
  if (report === undefined) return { code: result.code, text: `${result.text}\nUse guide --json for recovery actions. Protection was not disabled.` };
  say(`${report.summary.violations} static findings; ${report.errors.length} analysis errors; ${report.unsupported.length} unsupported files; ${report.uncovered.length} files without language policy; ${report.fitness.filter((item: { status: string }) => item.status === "fail").length} failed assertions; ${report.fitness.filter((item: { status: string }) => item.status === "unverified").length} unverified requirements.`);
  say([...report.errors.slice(0, 5).map((error: { path: string; cause: string }) => `${error.path}: ${error.cause}`), ...report.uncovered.slice(0, 5).map((path: string) => `${path}: select the applicable language policy`),
    ...report.fitness.filter((item: { status: string }) => item.status === "fail").map((item: { rule: string; reason: string }) => `${item.rule}: ${item.reason}`)].join("\n"));
  const choice = selectedChoice ?? await choose("Next step", ["Keep existing debt and prevent growth (no-new)", "Show the first repairs and their verification", "Review later", "Plan project assertions in groups"]);
  if (choice === null || choice === 2) return { code: 0, text: `Audit completed. Review findings with pregate audit --repo ${quoted(root)} --plan. No application code changed.` };
  if (choice === 3) return fitnessPlanIn(root, process.cwd());
  if (choice === 1) return { code: 0, text: [...report.refactorPlan.repairs.slice(0, 10).map((repair: { path: string; rule: string; proposedChange: string; suggestedVerification: string }, i: number) => `${i + 1}. ${repair.path} · ${repair.rule}\n${repair.proposedChange}\nVerify: ${repair.suggestedVerification}`),
    "Ask the coding agent to repair one bounded behavior at a time using this plan. Run the affected tests and re-audit; keep guards active.", `Full plan: pregate audit --repo ${quoted(root)} --plan --json`].join("\n") };
  const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8")) as Preset;
  if (preset.ratchet?.mode !== "no-new") {
    preset.ratchet = { ...preset.ratchet, mode: "no-new" };
    const prepared = await applyPreset(root, JSON.stringify(preset, null, 2) + "\n", { preview: true });
    if (prepared.code !== 0) return prepared;
    const review = reviewOf(root, false);
    if (review) { const applied = await applyReviews([review]); if (applied.code !== 0 || readProposal(root) !== null) return applied; }
  }
  return { code: 0, text: noNewDone(root) };
}

// Approval commits the contract when it can, so the next step depends on whether it did.
function noNewDone(root: string): string {
  const done = "Done. Existing debt is the baseline; the agent is only told about new problems. Audit still lists every finding.";
  const inGit = git(root, ["rev-parse", "--is-inside-work-tree"])?.trim() === "true";
  const committed = () => git(root, ["status", "--porcelain", "--", PRESET, LOCK]) === "" && !!git(root, ["ls-files", "--", PRESET])?.trim();
  if (!inGit || committed()) return `${done} Try: ask your agent to edit something.`;
  return `${done} The contract is not committed yet: commit ${PRESET} and ${LOCK}, then CI can run pregate check --ratchet --base <that commit> (GitHub Actions, the Vercel build, or both).`;
}

function quoted(path: string): string {
  return "'" + path.replaceAll("'", WINDOWS ? "''" : "'\\''") + "'";
}

function cancelled(): Result { return { code: 0, text: "Cancelled. No contracts or consent changed." }; }

function knownProjects(): string[] {
  return consentedRoots().map(entry => entry.root);
}

async function updateProjects(paths: string[]): Promise<Result> {
  const roots = rootsOf(paths);
  const discoveries = new Map(await Promise.all(roots.map(async root => [root, (await inspectProject(root)).discovery] as const)));
  const before = new Map(roots.map(root => [root, proposalDigest(root)]));
  const prepared = await projectUpdates(["--preview", ...roots]);
  // A held project is not current: nothing is applied until the engine carries its pins.
  if (prepared.code !== 0 || prepared.held?.length) return { code: 1, text: prepared.text };
  const reviews = roots.filter(root => proposalDigest(root) !== before.get(root)).flatMap(root => {
    const review = reviewOf(root, false); return review ? [review] : [];
  });
  const applied = await applyReviews(reviews);
  if (applied.code !== 0 || roots.some(root => readProposal(root) !== null)) return applied;
  say(applied.text);
  const infos = await Promise.all(roots.map(inspectProject));
  for (const info of infos) {
    say(`${reviews.some(review => review.root === info.root) ? "Updated" : "Already current"}: ${info.root}.`);
    const discovery = discoveries.get(info.root)!;
    if (discovery.newPacks.length || discovery.changedPacks.length) say(`${discovery.newPacks.length} new packs (${discovery.newPackChecks} checks); ${discovery.changedPacks.length} updated packs since this project's previous engine.`);
    if (info.discovery.suggestedAdditions.length) say(`Missing suggested methodologies: ${info.discovery.suggestedAdditions.flatMap(item => item.methodologies).join(", ")}.`);
  }
  return afterUpdates(infos);
}

async function afterUpdates(infos: Awaited<ReturnType<typeof inspectProject>>[]): Promise<Result> {
  const candidates = infos.filter(info => info.discovery.suggestedAdditions.length);
  if (!candidates.length) return { code: 0, text: "Selected projects are current. No missing methodology was inferred. Explore pregate pack list --library or run pregate audit --plan; custom packs, policy and consent are retained." };
  const next = await choose("Review packs or audit for all selected projects?", ["Review suggested additions together", "Audit all selected projects with current rules", "Later"]);
  if (next === null || next === 2) return { code: 0, text: "Project updates finished. Suggested additions were not applied; custom packs, policy and consent are retained." };
  if (next === 0) {
    const selected = await selectPacks([...new Set(candidates.flatMap(info => info.discovery.suggestedAdditions.map(item => item.ns)))]);
    if (selected === null || !selected.length) return { code: 0, text: "No optional addition selected. Completed project updates are retained; consent is unchanged." };
    const reviews: Reviewed[] = [];
    for (const info of candidates) {
      const packs = info.discovery.suggestedAdditions.map(item => item.ns).filter(ns => selected.includes(ns));
      if (!packs.length) continue;
      const before = proposalDigest(info.root), prepared = await prepare(info.root, { packs, customPacks: [] });
      if (prepared.code !== 0) return { code: prepared.code, text: `${prepared.text}\nNo optional additions applied. Completed updates and previews are retained.` };
      if (proposalDigest(info.root) !== before) { const review = reviewOf(info.root, false); if (review) reviews.push(review); }
    }
    const applied = await applyReviews(reviews);
    if (applied.code !== 0 || candidates.some(info => readProposal(info.root) !== null)) return applied;
    say(applied.text);
  }
  const results: Result[] = [];
  for (const info of infos) { say(`Audit: ${info.root}`); results.push(await afterAudit(info.root, 2)); }
  return { code: results.some(result => result.code !== 0) ? 1 : 0, text: results.map(result => result.text).join("\n") };
}

function proposalDigest(root: string): string | null {
  const proposal = readProposal(root);
  return proposal === null ? null : sha256(JSON.stringify(proposal));
}

async function selectProjects(): Promise<string[] | null> {
  const known = knownProjects();
  if (known.length) say("Recorded projects on this computer (only your selection will change):\n" + known.map((root, index) => `${index + 1}. ${root}`).join("\n"));
  const answer = await question("Projects (listed numbers separated by commas, or one directory path; q cancels):");
  if (!answer) return null;
  if (/^\d+(\s*,\s*\d+)*$/.test(answer)) {
    const selected = answer.split(",").map(index => known[Number(index.trim()) - 1]);
    if (selected.every((root): root is string => root !== undefined)) return selected;
    throw new Error("Unknown project number. Rerun guide and choose a listed project or paste its directory.");
  }
  const paths = [answer];
  for (;;) {
    const next = await question("Another project directory [done] (blank finishes; q cancels):");
    if (next === null) return null;
    if (next === "") return paths;
    paths.push(next);
  }
}

async function wizard(options: Options): Promise<Result> {
  if (options.projects.length) return updateProjects(options.projects);
  const info = await inspectProject(process.cwd());
  say(card(info));
  const chosen = await choose("Choose an action", [...info.actions.map(action => action.label), "Exit"]);
  if (chosen === null || chosen === info.actions.length) return cancelled();
  const action = info.actions[chosen]!.id;
  if (action === "configure") return configure(info);
  if (action === "projects") { const paths = await selectProjects(); return paths === null ? cancelled() : updateProjects(paths); }
  if (action === "update") return updateProjects([info.root]);
  if (action === "audit") return afterAudit(info.root);
  if (action === "setup") { const result = await setup(); say(result.text); return result.code === 0 ? wizard(options) : result; }
  if (action === "doctor") return doctor();
  if (action === "global") return updateAndContinue();
  return activateProject(info);
}

async function activateProject(info: Awaited<ReturnType<typeof inspectProject>>): Promise<Result> {
  if (["new", "needs-update", "needs-repair"].includes(info.state) || info.errors.length) return { code: 1, text: [...info.errors, "Repair the contract before activation. Choose its update/repair review."].join("\n") };
  if (info.consent) return { code: 0, text: "Local protection is already enabled. Choose audit or diagnose installation; no extra approval is needed." };
  const prepared = await applyPreset(info.root, readFileSync(join(info.root, PRESET), "utf8"), { preview: true, activate: true });
  if (prepared.code !== 0) return prepared;
  const review = reviewOf(info.root, true);
  if (review === null) return { code: 1, text: "Activation review is unavailable. Prepare it again; consent remains unchanged." };
  const applied = await applyReviews([review]);
  if (applied.code !== 0 || readProposal(info.root) !== null) return applied;
  say(applied.text);
  return afterAudit(info.root);
}

export async function guide(args: string[]): Promise<Result> {
  const options = optionsOf(args);
  if (options === null) return { code: 1, text: USAGE };
  return guidedAction(options);
}

async function guidedAction(options: Options): Promise<Result> {
  try {
    if (options.json) {
      if (options.projects.length) {
        const projects = await Promise.all(rootsOf(options.projects).map(inspectProject));
        return { code: projects.some(scopeBlocked) ? 1 : 0, text: JSON.stringify({ schemaVersion: 1, projects }, null, 2) };
      }
      const project = await inspectProject(process.cwd());
      return { code: scopeBlocked(project) ? 1 : 0, text: JSON.stringify(project, null, 2) };
    }
    if (options.preview) {
      const roots = options.projects.length ? rootsOf(options.projects) : [projectRoot(process.cwd())];
      const before = new Map(roots.map(root => [root, proposalDigest(root)]));
      const prepared = options.projects.length ? await projectUpdates(["--preview", ...roots]) : await prepare(process.cwd(), options);
      if (prepared.code !== 0) return prepared;
      const changed = roots.filter(root => proposalDigest(root) !== before.get(root));
      if (options.full) return { ...prepared, text: roots.map(root => protectionReadiness(root)).join("\n") + "\n"
        + (changed.length ? changed.map(root => pendingReview(root, undefined, true).text).join("\n\n") : prepared.text) };
      const reviews = changed.flatMap(root => {
        const review = reviewOf(root, readProposal(root)?.activate !== false); return review ? [review] : [];
      });
      // Held projects are named only in the batch text, so it is kept whole.
      const body = reviews.map(review => (review.warning ? "Review policy changes below before approving.\n" : "") + review.text).join("\n\n");
      const lead = "lead" in prepared ? prepared.lead : undefined;
      return reviews.length && !prepared.held?.length ? { code: 0, text: lead ? `${lead}\n${body}` : body } : prepared;
    }
    if (!interactiveTerminal()) {
      const cards = await Promise.all((options.projects.length ? rootsOf(options.projects) : [process.cwd()]).map(inspectProject));
      return { code: 0, text: cards.map(card).join("\n\n") + "\nFor guided choices, the human runs pregate guide in a terminal. If it cannot provide a TTY, ask the agent to present guide --json choices and prepare one guide --preview; approve the displayed digest in a separate terminal." };
    }
    return await wizard(options);
  } catch (e) {
    const message = (e as Error).message;
    // A thrown inspection still has to be JSON. Text would hide the cause from guide --json.
    if (options.json) return { code: 1, text: JSON.stringify({ schemaVersion: 1, errors: [message] }, null, 2) };
    return { code: 1, text: visible(`Guided action could not finish: ${message}\n${unchangedContract()} Inspect guide --json or preset diagnose; correct the named cause and retry.`) };
  }
}

function scopeBlocked(project: { errors: string[] }): boolean {
  return project.errors.some(error => error.includes("No automatic scope applied."));
}

// The failure happened before any write. Name that only when a contract is actually there.
function unchangedContract(): string {
  try {
    const root = projectRoot(process.cwd());
    if (!existsSync(join(root, PRESET))) return "No contract exists yet, so none was changed.";
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    return "No contract was changed.";
  }
  return "Your valid contract and protection were not reset.";
}
