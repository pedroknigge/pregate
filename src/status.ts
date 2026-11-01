import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { CAPABILITIES, LANGUAGE_COVERAGE } from "./capabilities.ts";
import { compile } from "./compile.ts";
import { dataHome, enabled } from "./consent.ts";
import { enforcementOf } from "./enforcement.ts";
import { projectFitness } from "./fitness-command.ts";
import { conflictDiagnostic, conflictedContract, pinned, sourceDirs, sourcesOf } from "./contract-diagnostic.ts";
import { LOCK, PRESET, readText, VERSIONS, within } from "./inertia.ts";
import { tsconfigNotice } from "./resolve.ts";
import { git, uncommittedPackFiles } from "./git.ts";
import { HARNESSES } from "./harness/profile.ts";
import { gatedHarnesses } from "./machine.ts";
import { ENGINE_FILE, WINDOWS } from "./platform.ts";
import { inScope, relativePath } from "./paths.ts";
import { compareVersions, ENGINE_VERSION } from "./product.ts";
import { grammarOf, missingLanguagePolicy, ruleLanguages } from "./languages.ts";
import type { Lock } from "./types.ts";
import { hasRepository, listedPaths, workspacePaths } from "./workspace.ts";
import { deadGlobLines } from "./onboard.ts";
import { validate } from "./schema.ts";
import type { Preset } from "./types.ts";
import { librarySources, newerPin } from "./library.ts";
import { sha256 } from "./state.ts";
import { normalize } from "./reconstruct.ts";
import { readBatch, readProposal } from "./proposal.ts";

// Recovery must be readable even when admission of the active contract fails.
export function contractDiagnosis(root: string) {
  const conflicted = conflictedContract(root);
  const errors: string[] = conflicted.length > 0 ? [conflictDiagnostic(conflicted)] : [];
  const preset = diagnosedPreset(root, errors), lock = diagnosedLock(root, errors);
  if (preset?.engine && preset.engine !== VERSIONS.engine) errors.push(newerPin("Engine", String(preset.engine), VERSIONS.engine) ?? `Project engine ${preset.engine}; installed engine ${VERSIONS.engine}. Migration needs review.`);
  const pins = librarySources();
  for (const source of Array.isArray(preset?.sources) ? preset.sources : []) {
    if (source?.kind === "builtin" && source.version !== VERSIONS.core) errors.push(newerPin("Core", String(source.version), VERSIONS.core) ?? `Core ${source.version} -> ${VERSIONS.core} requires migration.`);
    if (source?.kind === "library") {
      const pin = pins.find(entry => entry.ns === source.ns);
      if (!pin) errors.push(`Bundled pack ${source.ns} is unavailable in the installed engine.`);
      else if (pin.version !== source.version) errors.push(newerPin(source.ns, source.version, pin.version) ?? `${source.ns}: ${source.version} -> ${pin.version} requires migration.`);
    }
  }
  const presetText = text(join(root, PRESET));
  if (lock === null) errors.push("Lock missing or unreadable.");
  else if (presetText !== null && lock.presetHash !== sha256(normalize(presetText))) errors.push("Preset content differs from the lock's recorded preset. Compilation/admission is still required; matching hashes alone do not prove integrity.");
  return { installed: VERSIONS, project: { engine: preset?.engine ?? null, lockEngine: lock?.engine ?? null, core: lock?.core ?? null },
    preset, errors, next: [
      "Severity strings are deny, ask, warn or off. Enforcement requires an object: {\"enforcement\":\"enforce\"}.",
      "Prepare pregate update --project --preview for one engine/core/pack review. Preview does not change preset, lock or consent.",
      "If an older hook rejects new helpers, the human can type ! pregate update inside the harness. Do not retry blocked agent commands or reset the preset.",
    ] };
}

function diagnosedPreset(root: string, errors: string[]): Preset | null {
  try {
    const value = JSON.parse(text(join(root, PRESET)) ?? "null");
    errors.push(...validate("preset", value).map(error => `preset.json: ${error}`));
    return value;
  } catch (e) { errors.push(`Cannot read preset: ${(e as Error).message}`); return null; }
}

function diagnosedLock(root: string, errors: string[]): Lock | null {
  try { return JSON.parse(text(join(root, LOCK)) ?? "null"); }
  catch (e) { errors.push(`Cannot read lock: ${(e as Error).message}`); return null; }
}

function text(path: string): string | null {
  try { return readFileSync(path, "utf8"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
}

export function contractState(root: string): { valid: boolean; errors: string[]; lock: Lock | null } {
  try {
    const preset = text(join(root, PRESET));
    if (preset === null) return { valid: false, errors: ["Preset missing."], lock: null };
    const result = compile(preset, sourcesOf(root), VERSIONS);
    if ("errors" in result) return { valid: false, errors: result.errors, lock: null };
    const valid = result.text === text(join(root, LOCK))?.replaceAll("\r\n", "\n");
    return { valid, errors: valid ? [] : ["Lock missing, altered or stale; run pregate preset compile."], lock: valid ? result.lock : null };
  } catch (e) { return { valid: false, errors: [(e as Error).message], lock: null }; }
}

function present(path: string): boolean {
  const stat = statSync(path, { throwIfNoEntry: false });
  return stat?.isFile() === true && stat.size > 0 && (WINDOWS || (stat.mode & 0o111) !== 0);
}

function backstops(root: string) {
  const repository = hasRepository(root);
  const available = git(root, ["--version"]) !== null;
  const hook = repository ? git(root, ["rev-parse", "--path-format=absolute", "--git-path", "hooks/pre-commit"])?.trim() : undefined;
  const top = repository ? git(root, ["rev-parse", "--show-toplevel"])?.trim() : undefined;
  return { repository, available, baseline: repository ? "CLI: Git HEAD/index/merge-base; Stop: retained session snapshot (pregate report --json)" : "filesystem snapshot; check --all scans the complete tree",
    preCommitConfigured: hook !== undefined && present(resolve(root, hook)) && (text(resolve(root, hook)) ?? "").includes("check --staged"),
    ciTemplatePresent: top !== undefined && existsSync(join(top, ".github/workflows/pregate.yml")) };
}

// Path-kind rule folders inside the project with files Git does not hold: teammates compile a stale lock.
function uncommittedSources(root: string | null): string[] {
  if (root === null || !hasRepository(root)) return [];
  return sourceDirs(text(join(root, PRESET)) ?? "").filter((dir) => {
    const abs = resolve(root, dir);
    return within(root, abs) && existsSync(abs) && uncommittedPackFiles(root, relativePath(root, abs)).length > 0;
  });
}

function localConsent(root: string | null, errors: string[]): boolean {
  try { return root !== null && enabled(root); }
  catch (e) { errors.push(`Cannot verify local consent: ${(e as Error).message}`); return false; }
}

// A lock pinning another engine that is still installed keeps working: the installed launcher hands
// every hook to the pinned engine (MH-19), which admits the lock only if it is its own exact compile.
// That engine is asked, since this one cannot recompile for it; a pin below FLOOR is never handed
// over. Its rules are the lock as written; null when the pin is current, refused or not installed.
function pinnedServedLock(root: string, data: string): Lock | null {
  const pin = pinned(root);
  const engine = pin === null ? null : join(data, pin, ENGINE_FILE);
  return engine !== null && present(engine) && pinnedAdmits(engine, root) ? writtenLock(root) : null;
}

function writtenLock(root: string): Lock | null {
  try { return JSON.parse(text(join(root, LOCK)) ?? "null") as Lock | null; }
  catch { return null; }   // the pinned engine read it a moment ago; a concurrent rewrite is not served
}

function pinnedAdmits(engine: string, root: string): boolean {
  try {
    const run = Bun.spawnSync([engine, "status", "--json"], { cwd: root, stdin: "ignore", stdout: "pipe", stderr: "ignore", timeout: 10_000 });
    return run.exitCode === 0 && validContract(run.stdout.toString());
  } catch {
    return false;   // an engine image that cannot be started does not admit the lock
  }
}

function validContract(status: string): boolean {
  try { return (JSON.parse(status) as { contract?: { valid?: unknown } }).contract?.valid === true; }
  catch { return false; }   // no status from that engine: it cannot be shown to admit the lock
}

// The code of a review waiting for the human: the batch that binds this project's current review
// (a batch outlives a project approved on its own), else the project's own.
function pendingApprovalCode(root: string): string | null {
  try {
    const proposal = readProposal(root);
    if (proposal === null) return null;
    const digest = sha256(JSON.stringify(proposal)), batch = readBatch();
    return (batch?.items.some(item => item.root === root && item.digest === digest) ? batch.digest : digest).slice(0, 12);
  } catch {
    return null;   // an unreadable pending record is reported by approve itself
  }
}

export function protectionStatus(root: string | null) {
  const contract = root === null ? { valid: false, errors: ["No preset here or above; run pregate init."], lock: null } : contractState(root);
  const consent = localConsent(root, contract.errors);
  const configured = gatedHarnesses(root);
  const data = dataHome();
  const launcherPresent = present(join(data, "bin", WINDOWS ? "pregate.cmd" : "pregate"));
  const enginePresent = present(join(data, VERSIONS.engine, ENGINE_FILE));
  const servedLock = contract.valid || root === null ? null : pinnedServedLock(root, data);
  const lock = contract.lock ?? servedLock;
  const paths = root === null || lock === null ? [] : workspacePaths(root, (rel) => inScope(lock, rel));
  const unsupported = paths.filter((rel) => grammarOf(rel) === null && /\.(rs|java|kt|rb|c|cc|cpp|cs|swift|php)$/i.test(rel));
  const uncovered = lock === null ? [] : paths.filter((rel) => missingLanguagePolicy(lock, rel));
  const rules = lock?.rules.map((r) => ({ id: r.id, check: r.check, integrity: r.integrity, severity: r.severity, enforcement: enforcementOf(lock, r),
    ownedByArkgate: lock.ownedByArkgate.includes(r.id), phases: r.phases, languages: ruleLanguages(r), implementation: r.impl.kind === "primitive" ? r.impl.primitive : "pattern", paths: r.params.paths ?? null, exclude: r.params.exclude ?? null, within: r.params.within ?? null })) ?? [];
  const harnesses = Object.entries(HARNESSES).map(([id, adapter]) => ({ id, payloadVersion: adapter.VERIFIED,
    configured: configured.has(id === "claude-code" ? "claude" : id === "cursor" ? "cursor-agent" : id),
    ...CAPABILITIES[id as keyof typeof CAPABILITIES], approvalInteractionVerified: false }));
  const ready = (contract.valid || servedLock !== null) && launcherPresent && enginePresent && harnesses.some((h) => h.configured) && unsupported.length === 0 && uncovered.length === 0;
  const fitness = root !== null && contract.lock !== null ? projectFitness(root, contract.lock, "ci") : [];
  const fitnessCoverage = { active: fitness.length, pass: fitness.filter(r => r.status === "pass").length,
    fail: fitness.filter(r => r.status === "fail").length, unverified: fitness.filter(r => r.status === "unverified").length,
    complete: contract.valid && fitness.every(r => r.status === "pass") };
  const diagnosis = root === null ? null : contractDiagnosis(root);
  const globWarnings = root === null || typeof diagnosis?.preset !== "object" || diagnosis.preset === null ? [] : deadGlobLines(diagnosis.preset, () => listedPaths(root));
  return { root, state: !consent ? "inactive" : ready ? "active" : "degraded", consent, mode: lock?.enforcement ?? diagnosis?.preset?.enforcement ?? null,
    engine: VERSIONS.engine, core: VERSIONS.core, project: diagnosis?.project ?? null,
    servedBy: servedLock?.engine ?? null, pendingApproval: root === null ? null : pendingApprovalCode(root),
    contract: { valid: contract.valid, errors: contract.errors }, installation: { launcherPresent, enginePresent },
    languages: LANGUAGE_COVERAGE, unsupportedInScope: unsupported, uncoveredInScope: uncovered, uncommittedSources: uncommittedSources(root), globWarnings, tsconfig: root === null ? null : tsconfigNotice((rel) => readText(join(root, rel))), rules, harnesses, fitnessCoverage, git: root === null ? null : backstops(root),
    limits: ["Shell inspection is heuristic; encoded/runtime writes need Stop and commit/CI backstops.",
      "Active describes consent and hook configuration, not complete project proof; unverified requirements are not protected assertions.",
      "After the Stop limit the turn can finish with pending findings; several harnesses suppress that notice. Run pregate report --json for recorded incomplete Stops and pregate check --all for the current tree.",
      "Configured hooks are not proof of a successful runtime canary; run pregate doctor."] };
}

type Status = ReturnType<typeof protectionStatus>;

// The short form answers three questions: am I protected, is it current, what next.
export function statusText(s: Status, verbose = false): string {
  return verbose ? verboseStatus(s) : briefStatus(s).join("\n");
}

function ruleCounts(s: Status) {
  const evaluated = s.rules.filter((r) => r.implementation !== "fitness" && !r.ownedByArkgate);
  return {
    enforced: evaluated.filter((r) => r.enforcement === "enforce" && r.severity !== "warn").length,
    advisor: evaluated.filter((r) => r.enforcement === "advisor").length,
    shadow: evaluated.filter((r) => r.enforcement === "shadow").length,
    warns: evaluated.filter((r) => r.severity === "warn").length,
  };
}

function briefStatus(s: Status): string[] {
  if (s.root === null) return ["PREGATE is not set up here.", "Next: pregate guide --preview --enforcement advisor (the human approves its review)."];
  const { enforced, advisor, shadow } = ruleCounts(s);
  return [
    `Protected: ${s.state === "active" ? "yes" : "no"}. PREGATE local consent is ${s.consent ? "active" : "inactive"} in ${s.root}; effective protection: ${s.state}.`,
    `Mode: ${s.mode ?? "unknown"} (${enforced} enforcing, ${advisor} advisor, ${shadow} shadow). ${versionLine(s)}`,
    ...uncommittedLine(s), ...s.globWarnings, ...(s.tsconfig ? [s.tsconfig] : []),
    `Next: ${nextStep(s)} Details: pregate status --verbose.`,
  ];
}

function uncommittedLine(s: Status): string[] {
  return s.uncommittedSources.length === 0 ? [] : [`Rule pack files not committed: ${s.uncommittedSources.join(", ")}. Commit them with the preset and lock, or teammates get a stale lock.`];
}

// Negative: the project pins an older engine than the installed one; positive: a newer one.
function pinOrder(s: Status): number | null {
  const pin = s.project?.lockEngine;
  return typeof pin === "string" && ENGINE_VERSION.test(pin) ? compareVersions(pin, s.engine) : null;
}

function versionLine(s: Status): string {
  const order = pinOrder(s), pin = s.project?.lockEngine;
  if (order === null) return "Lock missing or unreadable.";
  if (order < 0) return `Update ready: project pins ${pin}${s.servedBy === pin ? ", which still answers its hooks" : ""}, installed ${s.engine}.`;
  if (order > 0) return `Project pins newer engine ${pin}; installed ${s.engine}.`;
  return s.project?.engine === s.engine ? `Up to date (engine ${s.engine}).` : `Preset names engine ${s.project?.engine ?? "unreadable"}; lock and installation use ${s.engine}.`;
}

function nextStep(s: Status): string {
  const order = pinOrder(s);
  if (!s.consent) return "the human runs ! pregate enable.";
  if (s.pendingApproval !== null) return `the human approves the pending review: ! pregate approve ${s.pendingApproval}.`;
  if (order !== null && order < 0) return "pregate guide --preview (or the human runs ! pregate update).";
  if (order !== null && order > 0) return "the human runs ! pregate update.";
  if (!s.contract.valid) return `${s.contract.errors[0] ?? "Contract not ready."} Inspect pregate preset diagnose.`;
  if (!s.installation.launcherPresent || !s.installation.enginePresent) return "pregate setup.";
  if (!s.harnesses.some((h) => h.configured)) return "pregate doctor.";
  if (s.unsupportedInScope.length > 0 || s.uncoveredInScope.length > 0) return "add the language pack (pregate guide --preview).";
  return "pregate audit.";
}

function verboseStatus(s: Status): string {
  const { enforced, advisor, shadow, warns } = ruleCounts(s);
  return [
    `PREGATE local consent is ${s.consent ? "active" : "inactive"}${s.root === null ? "" : ` in ${s.root}`}. Effective protection: ${s.state}.`,
    `Contract: ${s.contract.valid ? "valid; preset, sources and compiled lock match" : "not ready"}.`, ...s.contract.errors,
    ...uncommittedLine(s), ...s.globWarnings,
    `Installation: launcher ${s.installation.launcherPresent ? "present" : "missing"}, engine ${s.engine} ${s.installation.enginePresent ? "present" : "missing"}.`,
    ...(s.project === null ? [] : [`Project versions: preset engine ${s.project.engine ?? "unreadable"}; lock engine ${s.project.lockEngine ?? "missing/unreadable"}; lock core ${s.project.core ?? "missing/unreadable"}. A global update does not activate this project's migration; review pregate update --project --preview.`]),
    `Rules: ${enforced} static enforcing, ${advisor} advisor, ${shadow} shadow, ${warns} warning; ${s.rules.filter((r) => r.ownedByArkgate).length} owned by ArkGate.`,
    `Project requirements: ${s.fitnessCoverage.active} active; ${s.fitnessCoverage.pass} current assertions passed, ${s.fitnessCoverage.fail} failed, ${s.fitnessCoverage.unverified} unverified. Coverage: ${s.fitnessCoverage.complete ? "complete for the reviewed assertions" : "incomplete"}.`,
    "Unbound fitness requirements remain active and unverified without blocking work. Adopted assertions require fresh passing evidence. Inspect pregate fitness status --json for coverage; a passing check is not certification.",
    `Parsers: ${s.languages.map((l) => `${l.language} (${l.extensions.join(", ")})`).join("; ")}.`,
    ...(s.unsupportedInScope.length === 0 ? [] : [`Unsupported source files in scope: ${s.unsupportedInScope.join(", ")}`]),
    ...(s.uncoveredInScope.length === 0 ? [] : [`Parsed files without an applicable language policy: ${s.uncoveredInScope.join(", ")}. Add and select a language pack.`]),
    "Harness configuration:", ...s.harnesses.map((h) => `  ${h.id}: ${h.configured ? "configured" : "missing/disabled/untrusted"}; native approval: ${h.nativeApproval ?? "human command route"}; warning channel: ${h.warnings ? "yes" : "no"}.`),
    ...(s.git === null ? [] : [`Baseline: ${s.git.baseline}. Pre-commit configured: ${s.git.preCommitConfigured}. CI template present: ${s.git.ciTemplatePresent}.`]),
    ...s.limits, "Next: pregate doctor checks the installation and runtime canaries; pregate status --json shows each effective rule.",
  ].join("\n");
}
