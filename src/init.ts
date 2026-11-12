import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { approvalDeadline, proposeContract } from "./approval.ts";
import { approvePending } from "./approval-command.ts";
import { BUILTIN } from "./assets.ts";
import { validateContract } from "./contract.ts";
import { visible } from "./contract.ts";
import { packCatalog } from "./compile.ts";
import { canonical, findRoot, readTree } from "./disk.ts";
import { clock, grammars, LOCK, PRESET, readText, sourcesOf, VERSIONS } from "./gate.ts";
import { librarySource, librarySources } from "./library.ts";
import { git } from "./git.ts";
import { foldArkgate } from "./arkgate-import.ts";
import { detectLayers, detectStack, initialScope, layersMatchAny, onboardingCard, onboardingFile, onboardingPreset } from "./onboard.ts";
import { INIT_PRESET_NAMES } from "./init-presets.ts";
import { pendingReview } from "./pending-review.ts";
import { composePackPlan } from "./pack-command.ts";
import { sha256 } from "./state.ts";
import { materializeRules, PROJECT_DIR, type Compiled } from "./rules-add-command.ts";
import { protectionStatus, statusText } from "./status.ts";
import type { Files, Preset } from "./types.ts";
import { contextFile, hasRepository, trackedWorkspacePaths, workspaceFile, workspacePaths, workspaceRegularFile } from "./workspace.ts";

type Result = { code: number; text: string; notes?: string[] };
export interface InitSelection {
  packs?: string[];
  customPacks?: string[];
  methodologies?: string[];
  enforcement?: "shadow" | "enforce" | "advisor";
  scope?: Preset["scope"];
  layers?: Preset["layers"];
  // A map the agent supplied. Folder-name derivation is unchanged; this only asks the
  // review to add a layer methodology when no selected rule would read the map.
  explicitLayers?: boolean;
  instructionRules?: Compiled[];
  overrides?: Preset["overrides"];
  customDraft?: { ns: string; files: Files };
}
const USAGE = "usage: pregate init [--preview|--yes] [--preset <name>]";

export { INIT_PRESET_NAMES } from "./init-presets.ts";

// Git controls ignored files; standalone projects use the same explicit traversal exclusions.
// Unsupported language names are evidence, but their bodies and binary assets need not be read.
export function repoFiles(root: string): Files {
  const listed = git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
  if (listed === null && hasRepository(root)) throw new Error("Git could not inventory this repository; fix Git before initializing.");
  const paths = listed === null ? workspacePaths(root, onboardingFile) : [...new Set(listed.split("\0").filter(Boolean))];
  const tracked = new Set(listed === null || !paths.some(p => p.split("/").includes("build")) ? [] : trackedWorkspacePaths(root));
  return Object.fromEntries(paths.filter((p) => workspaceFile(p, tracked.has(p)) && onboardingFile(p)
    && workspaceRegularFile(root, p)).map((p) => [p, contextFile(p) ? readFileSync(join(root, p), "utf8") : ""]));
}

export async function init(args: string[], selection: InitSelection = {}, directory = process.cwd()): Promise<Result> {
  try { return await initialize(args, selection, directory); }
  catch (e) { return { code: 1, text: visible(`Initialization failed: ${(e as Error).message}. Run pregate status before retrying.`) }; }
}

async function initialize(args: string[], selection: InitSelection, directory: string): Promise<Result> {
  const selected = args.indexOf("--preset");
  const name = selected === -1 ? null : args[selected + 1];
  const rest = selected === -1 ? args : args.filter((_, i) => i !== selected && i !== selected + 1);
  if ((selected !== -1 && (!name || name.startsWith("-"))) || rest.some((a) => !["--yes", "--preview"].includes(a))
    || new Set(args).size !== args.length || (args.includes("--yes") && args.includes("--preview"))) return { code: 1, text: USAGE };
  const invalid = invalidSelection(selection);
  if (invalid !== null) return invalid;
  const cwd = canonical(directory);
  const existing = findRoot(cwd, () => true);
  if (existing !== null) return alreadyInitialized(existing, name ?? null);
  const top = git(cwd, ["rev-parse", "--show-toplevel"])?.trim();
  if (top === undefined && hasRepository(cwd)) return { code: 1, text: "Git could not identify this worktree; fix Git before initializing." };
  const root = canonical(top ?? cwd);
  const baseline = sha256((readText(join(root, PRESET)) ?? "") + (readText(join(root, LOCK)) ?? ""));
  const files = repoFiles(root);
  await grammars();
  const stack = detectStack(files);
  const choice = name ?? stack.recommended;
  const built = initialPreset(root, choice, stack, files, selection);
  if ("code" in built) return built;
  let candidate = built.preset;
  const draft = selection.customDraft, draftPath = draft ? `.pregate/packs/${draft.ns}` : null;
  const draftError = draft ? addDocumentDraft(root, candidate, draft) : null;
  if (draftError) return draftError;
  const notes: string[] = [];
  if (selection.explicitLayers && Object.keys(candidate.layers ?? {}).length > 0) {
    const { withLayerPolicy } = await import("./scan-command.ts");
    const layered = withLayerPolicy(root, candidate, files);
    if ("errors" in layered) return { code: 1, text: [...layered.errors, "Nothing staged."].join("\n") };
    candidate = layered.preset;
    notes.push(...layered.notes);
  }
  const rules = selection.instructionRules ?? [];
  let packFiles: Files | null = null;
  if (rules.length > 0) {
    const made = materializeRules(root, candidate, rules, {});
    if ("errors" in made) return { code: 1, text: `${made.errors.join(" ")} Nothing staged.` };
    candidate = made.preset;
    if (Object.keys(made.files).length > 0) packFiles = made.files;
    notes.push(...made.skipped.map((line) => `Not staged, ${line}`));
  }
  const text = JSON.stringify(candidate, null, 2) + "\n";
  const sourceFiles = sourcesOf(root, true);
  const projectDir = canonical(join(root, PROJECT_DIR));
  const compiled = validateContract({ presetText: text, filesOf: source => {
    if (draft && source.kind === "path" && source.ns === draft.ns) return draft.files;
    if (packFiles !== null && source.kind === "path" && canonical(resolve(root, source.path)) === projectDir) return packFiles;
    return sourceFiles(source);
  }, versions: VERSIONS, now: clock });
  if ("errors" in compiled) return { code: 1, text: rules.length > 0 ? [...compiled.errors, "Nothing staged."].join("\n") : compiled.errors.join("\n") };
  const card = onboardingCard(stack, compiled.lock, files, clock);
  approvalDeadline();
  const proposal = proposeContract({ root, baseline, lockText: compiled.text, activate: true,
    writes: [{ path: join(root, PRESET), before: null, after: text },
      ...(draft && draftPath ? Object.entries(draft.files).map(([path, after]) => ({ path: join(root, draftPath, path), before: null, after })) : []),
      ...(packFiles === null ? [] : Object.entries(packFiles).map(([path, after]) => ({ path: join(root, PROJECT_DIR, path), before: null, after })))] });
  const digest = sha256(JSON.stringify(proposal));
  const review = pendingReview(root, digest);
  // ArkGate evidence stays in this text. Guide's review already prints the layer lines, so the
  // carried notes are only the short import summary plus rules staged beside it.
  const shown = [...notes, ...built.lines];
  const carriedNotes = [...notes, ...built.summary];
  const lead = shown.length === 0 ? "" : `${shown.join("\n")}\n`;
  const carried = carriedNotes.length === 0 ? {} : { notes: carriedNotes };
  if (args.includes("--preview")) return { code: 0, ...carried, text: `${lead}${card}\n${review.text}\nProject unchanged; local consent has not been enabled.` };
  const applied = await approvePending(root, args.includes("--yes"), digest);
  return { code: applied.code, ...carried, text: `${lead}${card}\n${applied.text}\n${applied.code === 0 ? nextSteps() : "Project unchanged; inspect the pending proposal with pregate approve --preview."}` };
}

function initialPreset(root: string, choice: string, stack: ReturnType<typeof detectStack>, files: Files, selection: InitSelection): { preset: Preset; lines: string[]; summary: string[] } | Result {
  const preset = onboardingPreset(choice, BUILTIN, VERSIONS, stack, choice.endsWith("-starter") ? librarySources() : []);
  if (preset === null) return { code: 1, text: `Unknown preset. Choose ${INIT_PRESET_NAMES.join(", ")}.` };
  preset.scope = selection.scope ?? initialScope(files, preset.scope);
  if (selection.enforcement !== undefined) preset.enforcement = selection.enforcement;
  const layers = selection.layers ?? recipeLayers(preset, files);
  if (layers !== undefined) preset.layers = layers;
  const selected = selectedPacks(root, preset, selection);
  if ("code" in selected) return selected;
  const folded = foldArkgate(root, selected, files);
  if (folded === null) return { preset: selected, lines: [], summary: [] };
  if ("errors" in folded) return { code: 1, text: folded.errors.join("\n") };
  const summary = selection.explicitLayers
    ? ["ark.config.json supplies this review's layer map, so the supplied layer map is not used.", ...folded.notes]
    : folded.notes;
  return { preset: folded.preset, lines: [...summary, ...folded.evidenceLines], summary };
}

// A recipe written for src/ checks nothing when the code lives elsewhere (source/, packages/x/src/).
// Only then are its layers rebased onto the detected folders; a partly matching recipe stays as
// reviewed, and the onboarding card names its empty globs.
function recipeLayers(preset: Preset, files: Files): Preset["layers"] {
  const paths = Object.keys(files), detected = detectLayers(files);
  if (!Object.keys(preset.layers ?? {}).length || !Object.keys(detected).length || layersMatchAny(preset.layers, paths)) return preset.layers;
  return detected;
}

function addDocumentDraft(root: string, candidate: Preset, draft: NonNullable<InitSelection["customDraft"]>): Result | null {
  const path = `.pregate/packs/${draft.ns}`;
  if (existsSync(join(root, path))) return { code: 1, text: "A custom pack already exists at the proposed path. Select it with --custom-pack; no files overwritten." };
  const catalog = packCatalog(draft.files);
  if ("errors" in catalog || catalog.ns !== draft.ns) return { code: 1, text: "Custom draft is invalid. Review its requirements and fixtures before retrying." };
  candidate.sources.push({ kind: "path", ns: draft.ns, path });
  candidate.methodologies.push(...catalog.methodologies.map(method => method.id));
  candidate.overrides = { ...candidate.overrides, ...Object.fromEntries(catalog.methodologies.flatMap(method => method.invariants.map(rule => [`${draft.ns}/${rule.id}`, { enforcement: "shadow" } as const]))) };
  return null;
}

function invalidSelection(selection: InitSelection): Result | null {
  if (Object.keys(selection).some(key => !["packs", "customPacks", "methodologies", "enforcement", "scope", "layers", "explicitLayers", "instructionRules", "overrides", "customDraft"].includes(key))
    || [selection.packs, selection.customPacks, selection.methodologies].some(values => values !== undefined
      && (!Array.isArray(values) || values.some(value => typeof value !== "string" || !value.trim())))
    || (selection.explicitLayers !== undefined && typeof selection.explicitLayers !== "boolean")
    || (selection.instructionRules !== undefined && !Array.isArray(selection.instructionRules))
    || (selection.enforcement !== undefined && !["shadow", "enforce", "advisor"].includes(selection.enforcement))
    || (selection.customDraft !== undefined && (!/^[a-z][a-z0-9-]{0,63}$/.test(selection.customDraft.ns)
      || Object.keys(selection.customDraft.files).some(path => path.startsWith("/") || path.includes("\\") || path.split("/").some(part => !part || part === "." || part === ".."))
      || Object.values(selection.customDraft.files).some(text => typeof text !== "string")))) {
    return { code: 1, text: "Invalid setup selection. Use nonempty bundled namespaces, local pack paths and methodology identifiers; enforcement is shadow, advisor or enforce. Nothing activated." };
  }
  return null;
}

function selectedPacks(root: string, preset: Preset, selection: InitSelection): Preset | Result {
  const sources: { kind: "library"; ns: string }[] = [];
  const localSources: { kind: "path"; path: string }[] = [];
  const methods = [...(selection.methodologies ?? [])];
  for (const ns of [...new Set(selection.packs ?? [])]) {
    const files = librarySource(ns);
    if (files === null) return { code: 1, text: `Unknown bundled pack ${ns}. Run pregate pack list --library; nothing activated.` };
    const catalog = packCatalog(files);
    if ("errors" in catalog) return { code: 1, text: catalog.errors.join("\n") };
    sources.push({ kind: "library", ns });
    if (selection.methodologies === undefined) methods.push(...catalog.methodologies.map(method => method.id));
  }
  for (const path of [...new Set(selection.customPacks ?? [])]) {
    const catalog = packCatalog(readTree(canonical(resolve(root, path)), true));
    if ("errors" in catalog) return { code: 1, text: [...catalog.errors, `Cannot select local pack ${path}; nothing activated.`].join("\n") };
    localSources.push({ kind: "path", path });
    methods.push(...catalog.methodologies.map(method => method.id));
  }
  const candidate = composePackPlan(root, preset, { sources: [...sources, ...localSources], methodologies: [...new Set(methods)], scope: preset.scope,
    ...(selection.overrides === undefined ? {} : { overrides: selection.overrides }) });
  if ("errors" in candidate) return { code: 1, text: [...candidate.errors, "Setup selection not applied; correct the selection and preview again."].join("\n") };
  return candidate;
}

function alreadyInitialized(root: string, name: string | null): Result {
  const status = protectionStatus(root);
  if (name !== null && status.contract.valid && (JSON.parse(readFileSync(join(root, PRESET), "utf8")) as { name: string }).name !== name) return { code: 1, text: "This project already has a different preset; init does not replace it. Use a reviewed preset request or pack enable --preview." };
  return { code: status.contract.valid ? 0 : 1, text: `Existing project left unchanged.\n${statusText(status)}\n${nextSteps()}` };
}

function nextSteps(): string {
  return "Next: inspect pregate guide --json and offer the useful project actions together. The human can run ! pregate guide for terminal choices; otherwise prepare one guide --preview with the selected packs and show its digest review. Audit existing debt, then choose bounded repairs or a reviewed no-new policy; freezing is not compliance. pregate status verifies effective protection. Unbound requirements stay active and UNVERIFIED without blocking work; propose a meaningful assertion and run pregate fitness run <verifier>. Use pregate setup for missing hooks and pregate pack restore for a cloned contract's exact Git pins.";
}
