import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { CAPABILITIES, LANGUAGE_COVERAGE } from "./capabilities.ts";
import { compile } from "./compile.ts";
import { dataHome, disabledLabel, disableScope, enabled, explicitlyDisabled } from "./consent.ts";
import { enforcementOf } from "./enforcement.ts";
import { projectFitness } from "./fitness-command.ts";
import { conflictDiagnostic, conflictedContract, sourceDirs, sourcesOf } from "./contract-diagnostic.ts";
import { LOCK, PRESET, readText, VERSIONS, within } from "./admission.ts";
import { tsconfigNotice } from "./resolve.ts";
import { git, uncommittedPackFiles } from "./git.ts";
import { HARNESSES } from "./harness/profile.ts";
import { agyRegistration, claudeRegistration, codexRegistration, cursorRegistration, gatedHarnesses } from "./machine.ts";
import { ENGINE_FILE, WINDOWS } from "./platform.ts";
import { inScope, relativePath } from "./paths.ts";
import { grammarOf, missingLanguagePolicy, ruleLanguages } from "./languages.ts";
import type { Lock } from "./types.ts";
import { hasRepository, listedPaths, workspacePaths } from "./workspace.ts";
import { deadGlobLines } from "./onboard.ts";
import { validate } from "./schema.ts";
import type { Preset } from "./types.ts";
import { librarySources, newerPin } from "./library.ts";
import { H, sha256, stateDir } from "./state.ts";
import { canonical } from "./disk.ts";
import { normalize } from "./reconstruct.ts";
import { readBatch, readProposal } from "./proposal.ts";
import { detectProviders } from "./ci/detect.ts";

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

// `valid`: this engine can judge the project, which it can whenever the preset compiles. A lock
// file that is missing, behind the preset, or written by another engine version does not stop
// that (the hooks rebuild it from the preset); it is one note, because CI compares the file.
export function contractState(root: string): { valid: boolean; errors: string[]; lock: Lock | null } {
  try {
    const preset = text(join(root, PRESET));
    if (preset === null) return { valid: false, errors: ["Preset missing."], lock: null };
    const result = compile(preset, sourcesOf(root), VERSIONS);
    if ("errors" in result) return { valid: false, errors: result.errors, lock: null };
    const same = result.text === text(join(root, LOCK))?.replaceAll("\r\n", "\n");
    return { valid: true, errors: same ? [] : [STALE_LOCK], lock: result.lock };
  } catch (e) { return { valid: false, errors: [(e as Error).message], lock: null }; }
}

export const STALE_LOCK = "The lock file is missing, behind the preset, or written by another engine version; this engine judges from the preset. pregate preset compile refreshes the file.";


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
    ciTemplatePresent: top !== undefined && existsSync(join(top, ".github/workflows/pregate.yml")),
    ciProviders: detectProviders(root).map((provider) => ({ id: provider.id, detail: provider.detail, checks: provider.checks })) };
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
  const disabled = root !== null && explicitlyDisabled(root);
  const disabledScope = root === null ? null : disableScope(root);
  const configured = gatedHarnesses(root);
  const data = dataHome();
  // A project that registers its own Claude Code or Antigravity hooks runs its own launcher: no global one is needed.
  const claudeCode = claudeRegistration(root);
  const agy = agyRegistration(root);
  // A project Codex registration does not make Codex configured: its review in Codex is not readable here.
  const codex = codexRegistration(root);
  const launcherPresent = present(join(data, "bin", WINDOWS ? "pregate.cmd" : "pregate")) || claudeCode.projectLauncher || agy.projectLauncher;
  const enginePresent = present(join(data, VERSIONS.engine, ENGINE_FILE));
  const lock = contract.lock;
  const paths = root === null || lock === null ? [] : workspacePaths(root, (rel) => inScope(lock, rel));
  const unsupported = paths.filter((rel) => grammarOf(rel) === null && /\.(rs|java|kt|rb|c|cc|cpp|cs|swift|php)$/i.test(rel));
  const uncovered = lock === null ? [] : paths.filter((rel) => missingLanguagePolicy(lock, rel));
  const rules = lock?.rules.map((r) => ({ id: r.id, check: r.check, integrity: r.integrity, severity: r.severity, enforcement: enforcementOf(lock, r),
    ownedByArkgate: lock.ownedByArkgate.includes(r.id), phases: r.phases, languages: ruleLanguages(r), implementation: r.impl.kind === "primitive" ? r.impl.primitive : "pattern", paths: r.params.paths ?? null, exclude: r.params.exclude ?? null, within: r.params.within ?? null })) ?? [];
  const harnesses = Object.entries(HARNESSES).map(([id, adapter]) => ({ id, payloadVersion: adapter.VERIFIED,
    configured: configured.has(id === "claude-code" ? "claude" : id === "cursor" ? "cursor-agent" : id),
    ...CAPABILITIES[id as keyof typeof CAPABILITIES], approvalInteractionVerified: false }));
  const ready = contract.valid && launcherPresent && enginePresent && harnesses.some((h) => h.configured) && unsupported.length === 0 && uncovered.length === 0;
  const fitness = root !== null && contract.lock !== null ? projectFitness(root, contract.lock, "ci") : [];
  const fitnessCoverage = { active: fitness.length, pass: fitness.filter(r => r.status === "pass").length,
    fail: fitness.filter(r => r.status === "fail").length, unverified: fitness.filter(r => r.status === "unverified").length,
    complete: contract.valid && fitness.every(r => r.status === "pass"), adopted: Object.keys(contract.lock?.fitness ?? {}).length > 0 };
  const diagnosis = root === null ? null : contractDiagnosis(root);
  const globWarnings = root === null || typeof diagnosis?.preset !== "object" || diagnosis.preset === null ? [] : deadGlobLines(diagnosis.preset, () => listedPaths(root));
  const consentLostIn = consent || root === null ? 0 : sessionsOf(root);
  return { root, state: !consent ? "inactive" : ready ? "active" : "degraded", consent, disabled, disabledScope, consentLostIn, mode: lock?.enforcement ?? diagnosis?.preset?.enforcement ?? null,
    engine: VERSIONS.engine, core: VERSIONS.core, project: diagnosis?.project ?? null,
    servedBy: null, pendingApproval: root === null ? null : pendingApprovalCode(root),
    contract: { valid: contract.valid, errors: contract.errors }, installation: { launcherPresent, enginePresent }, claudeCodeHooks: claudeCode.scope,
    codexHooks: codex.scope, codexProjectTrust: codex.projectTrust, codexHookReview: codex.scope === "project" || codex.scope === "both" ? "unknown" as const : null,
    cursorHooks: cursorRegistration(root),
    agyHooks: agy.scope,
    languages: LANGUAGE_COVERAGE, unsupportedInScope: unsupported, uncoveredInScope: uncovered, uncommittedSources: uncommittedSources(root), globWarnings, tsconfig: root === null ? null : tsconfigNotice((rel) => readText(join(root, rel))), rules, harnesses, fitnessCoverage, git: root === null ? null : backstops(root),
    limits: ["Shell inspection is heuristic; encoded/runtime writes need Stop and commit/CI backstops.",
      "Active describes consent and hook configuration, not complete project proof; unverified requirements are not protected assertions.",
      "After the Stop limit the turn can finish with pending findings; several harnesses suppress that notice. Run pregate report --json for recorded incomplete Stops and pregate check --all for the current tree.",
      "Configured hooks are not proof of a successful runtime canary; run pregate doctor."] };
}

type Status = ReturnType<typeof protectionStatus>;

const RECENT_SESSION_MS = 24 * 60 * 60 * 1000;

// Sessions that snapshotted this root in the last day: consent was active when each reached it.
// The window bounds how long a deliberate human disable keeps the warning.
function sessionsOf(root: string): number {
  const dir = join(stateDir(), "sessions");
  if (!existsSync(dir)) return 0;
  const rootHash = H(canonical(root)), since = Date.now() - RECENT_SESSION_MS;
  return readdirSync(dir).filter((sid) => {
    const snapshot = join(dir, sid, rootHash, "snapshot.json");
    return existsSync(snapshot) && statSync(snapshot).mtimeMs >= since;
  }).length;
}

function consentLostLine(s: Status): string[] {
  if (s.disabled && s.root !== null) {
    const scope = s.disabledScope;
    const lead = scope === "project" ? "This project is disabled."
      : scope === "both" ? "This project and this worktree are disabled."
      : "This worktree is disabled.";
    return [`${lead} Pre-command and pre-edit do not block it. The human runs pregate enable to turn protection back on.`];
  }
  if (s.consentLostIn === 0) return [];
  return [`WARNING: consent was active in ${s.consentLostIn} session${s.consentLostIn === 1 ? "" : "s"} recorded for ${s.root} in the last day and is now disabled or missing. If no human ran pregate disable, a command or script removed it: re-enable with pregate enable in a terminal and review the changes made since.`];
}

export function statusText(s: Status, verbose = false): string {
  return verbose ? verboseStatus(s) : briefStatus(s).join("\n");
}

// Static rules only. Fitness obligations are evidence, counted with fitnessCoverage, not as denies.
function breakdown(s: Status) {
  const evaluated = s.rules.filter((r) => r.implementation !== "fitness" && !r.ownedByArkgate);
  const deny = evaluated.filter((r) => r.enforcement === "enforce" && r.severity === "deny").length;
  const ask = evaluated.filter((r) => r.enforcement === "enforce" && r.severity === "ask").length;
  const advisor = evaluated.filter((r) => r.enforcement === "advisor").length;
  const shadow = evaluated.filter((r) => r.enforcement === "shadow").length;
  const warnOnly = evaluated.filter((r) => r.enforcement === "enforce" && r.severity === "warn").length;
  return { deny, ask, advisor, shadow, warnOnly, monitor: advisor + shadow + warnOnly };
}

function harnessLine(s: Status): string {
  const gated = s.harnesses.filter((h) => h.configured).map((h) => h.id);
  const open = s.harnesses.filter((h) => !h.configured).map((h) => h.id);
  const scope = s.claudeCodeHooks === "project" ? " Claude Code hooks are project-local (.claude/settings.json of this project)."
    : s.claudeCodeHooks === "both" ? " Claude Code hooks are registered in this project and globally: every tool call is evaluated twice." : "";
  const review = " Codex review state unknown: check `/hooks` in Codex.";
  const codex = s.codexHooks === "project" ? ` Codex hooks are project-local (.codex/hooks.json of this project).${review}`
    : s.codexHooks === "both" ? ` Codex hooks are registered in this project and globally: when Codex runs both, every tool call is evaluated twice.${review}` : "";
  const cursor = s.cursorHooks === "project" ? " Cursor hooks are project-local; Cursor runs them in a trusted workspace."
    : s.cursorHooks === "both" ? " Cursor hooks are registered twice. A project Claude hook stands aside in Cursor when .cursor/hooks.json owns that event, so those two project files are one evaluation. A global registration beside a project one still evaluates that call a second time." : "";
  const agy = s.agyHooks === "project" ? " Antigravity hooks are project-local (.agents/hooks.json of this project)."
    : s.agyHooks === "both" ? " Antigravity hooks are registered in this project and globally: every tool call is evaluated twice." : "";
  return `Harnesses gated: ${gated.length === 0 ? "none" : gated.join(", ")}. Not configured: ${open.length === 0 ? "none" : open.join(", ")}.${scope}${codex}${cursor}${agy}`;
}

function unverifiedLine(s: Status): string {
  const f = s.fitnessCoverage;
  if (!f.adopted) return `Unverified: not adopted (${f.unverified} optional requirements have no verifier and check nothing).`;
  return `Unverified: ${f.unverified} (no passing project evidence); ${f.fail} failed; ${f.pass} passing.`;
}

function channelGaps(s: Status): string {
  const missing = (label: string, key: "warnings" | "halt" | "stopLimitNotice" | "sessionContext") => {
    const names = s.harnesses.filter((h) => h[key] !== true).map((h) => h.id);
    return names.length === 0 ? null : `${label} not covered on ${names.join(", ")}`;
  };
  const parts = [
    missing("warning channel", "warnings"),
    missing("halt", "halt"),
    missing("stop-limit notice", "stopLimitNotice"),
    missing("session context", "sessionContext"),
  ].filter((part) => part !== null);
  return parts.length === 0 ? "Channels not covered: none." : `Channels not covered: ${parts.join("; ")}.`;
}

// What this lock does, before how many rules it contains. Doctor prints the same lines.
export function coverageLead(s: Status): string[] {
  const b = breakdown(s);
  const fitness = s.rules.filter((r) => r.implementation === "fitness").length;
  const owned = s.rules.filter((r) => r.ownedByArkgate).length;
  const catalog = `Catalog: ${s.rules.length} rules in this lock (${s.rules.length - fitness} static, ${fitness} fitness).${owned === 0 ? "" : ` ${owned} owned by ArkGate are listed and not evaluated.`}`;
  const head = s.root === null ? ["No contract in this directory."] : [];
  return [
    ...head,
    `Enforced (deny): ${b.deny}.`,
    ...(b.ask === 0 ? [] : [`Ask: ${b.ask} (human confirmation, not a deny).`]),
    `Advisor or monitor only: ${b.monitor} (${b.advisor} advisor, ${b.shadow} shadow, ${b.warnOnly} warn-only).`,
    unverifiedLine(s),
    harnessLine(s),
    channelGaps(s),
    catalog,
  ];
}

function notEnforced(where: string): string {
  return `Nothing is enforced in ${where}. Pregate blocks commands and edits only where \`pregate enable\` was run for this project.`;
}

// The short form is three lines: the state, what needs attention (only when something does), and
// the next step. Counts by channel, catalog size and harness detail are in --verbose.
function briefStatus(s: Status): string[] {
  if (s.root === null) return ["Pregate is not set up in this directory.", "Next: pregate enable. It proposes an advisor contract; nothing blocks."];
  if (!s.consent) return [`Pregate is off in ${s.root}${s.disabled ? ` (disabled for ${disabledLabel(s.root)})` : ""}. Nothing is checked or blocked.`, ...consentLostLine(s), "Next: pregate enable."];
  const b = breakdown(s);
  const reason = attention(s);
  return [
    `Pregate is on in ${s.root}: ${s.mode ?? "unknown"} mode. ${b.deny + b.ask} rules block, ${b.monitor} inform.`,
    ...(reason === null ? [] : [reason]), ...consentLostLine(s), ...uncommittedLine(s),
    `Next: ${nextStep(s)} Details: pregate status --verbose.`,
  ];
}

// The one thing that keeps this project from being checked, or null. A lock another engine version
// wrote is not one: this engine judges from the preset.
function attention(s: Status): string | null {
  if (!s.installation.launcherPresent || !s.installation.enginePresent) return "Needs attention: the launcher or the engine is not installed on this machine, so no agent is checked.";
  if (!s.harnesses.some((h) => h.configured)) return "Needs attention: no agent harness has Pregate hooks on this machine, so no agent is checked.";
  if (!s.contract.valid) return `Needs attention: ${s.contract.errors[0] ?? "the contract is not ready."}`;
  return s.contract.errors.length > 0 ? `Note: ${s.contract.errors[0]} Nothing is blocked by that.` : null;
}

function uncommittedLine(s: Status): string[] {
  return s.uncommittedSources.length === 0 ? [] : [`Rule pack files not committed: ${s.uncommittedSources.join(", ")}. Commit them with the preset and lock, or teammates get a stale lock.`];
}



function nextStep(s: Status): string {
  if (!s.consent) return "pregate enable.";
  if (s.pendingApproval !== null) return `pregate approve ${s.pendingApproval} applies the pending review.`;
  if (!s.installation.launcherPresent || !s.installation.enginePresent) return "pregate setup.";
  if (!s.harnesses.some((h) => h.configured)) return "pregate setup.";
  if (!s.contract.valid) return "pregate preset diagnose.";
  if (s.contract.errors.length > 0) return "nothing required. pregate preset compile refreshes the lock file for CI.";
  if (s.unsupportedInScope.length > 0 || s.uncoveredInScope.length > 0) return "nothing required. pregate guide --preview proposes a pack for the uncovered language.";
  return "nothing required. pregate audit lists existing debt.";
}

function providerLine(providers: { id: string; detail: string; checks: string[] }[]): string {
  if (providers.length === 0) return "CI providers: none configured.";
  const parts = providers.map((provider) => provider.checks.length === 0
    ? `${provider.id} (${provider.detail})`
    : `${provider.id} (${provider.detail}, checks ${provider.checks.join(", ")})`);
  return `CI providers: ${parts.join("; ")}.`;
}

function verboseStatus(s: Status): string {
  const b = breakdown(s);
  const lead = s.root === null ? [notEnforced("this directory"), ...coverageLead(s)]
    : s.consent ? coverageLead(s) : [notEnforced(s.root), ...coverageLead(s)];
  return [
    ...lead,
    `PREGATE local consent is ${s.root !== null && s.disabled ? `inactive (disabled for ${disabledLabel(s.root)})` : s.consent ? "active" : "inactive"}${s.root === null ? "" : ` in ${s.root}`}. Effective protection: ${s.state}.`,
    ...consentLostLine(s),
    `Contract: ${s.contract.valid ? "valid; preset, sources and compiled lock match" : "not ready"}.`, ...s.contract.errors,
    ...uncommittedLine(s), ...s.globWarnings,
    `Installation: launcher ${s.installation.launcherPresent ? "present" : "missing"}, engine ${s.engine} ${s.installation.enginePresent ? "present" : "missing"}.`,
    ...(s.project === null ? [] : [`Project versions: preset engine ${s.project.engine ?? "unreadable"}; lock engine ${s.project.lockEngine ?? "missing/unreadable"}; lock core ${s.project.core ?? "missing/unreadable"}. A global update does not activate this project's migration; review pregate update --project --preview.`]),
    `Rules: ${b.deny} static deny, ${b.ask} ask, ${b.advisor} advisor, ${b.shadow} shadow, ${b.warnOnly} warn-only; ${s.rules.filter((r) => r.ownedByArkgate).length} owned by ArkGate.`,
    ...(!s.fitnessCoverage.adopted
      ? [`Project verification: not adopted (${s.fitnessCoverage.unverified} optional requirements have no verifier and check nothing). pregate fitness plan shows how to bind one.`]
      : [
      `Project requirements: ${s.fitnessCoverage.pass} current assertions passed, ${s.fitnessCoverage.fail} failed, ${s.fitnessCoverage.unverified} unverified of ${s.fitnessCoverage.active} in this lock. Coverage: ${s.fitnessCoverage.complete ? "complete for the reviewed assertions" : "incomplete"}.`,
      "Unbound fitness requirements remain active and unverified without blocking work. Adopted assertions require fresh passing evidence. Inspect pregate fitness status --json for coverage; a passing check is not certification.",
      ]),
    `Parsers: ${s.languages.map((l) => `${l.language} (${l.extensions.join(", ")})`).join("; ")}.`,
    ...(s.unsupportedInScope.length === 0 ? [] : [`Unsupported source files in scope: ${s.unsupportedInScope.join(", ")}`]),
    ...(s.uncoveredInScope.length === 0 ? [] : [`Parsed files without an applicable language policy: ${s.uncoveredInScope.join(", ")}. Add and select a language pack.`]),
    "Harness configuration:", ...s.harnesses.map((h) => `  ${h.id}: ${h.configured ? "configured" : "missing/disabled/untrusted"}; native approval: ${h.nativeApproval ?? "human command route"}; warning channel: ${h.warnings ? "yes" : "no"}.`),
    ...(s.git === null ? [] : [`Baseline: ${s.git.baseline}. Pre-commit configured: ${s.git.preCommitConfigured}. CI template present: ${s.git.ciTemplatePresent}. ${providerLine(s.git.ciProviders)}`]),
    ...s.limits, "Next: pregate doctor checks the installation and runtime canaries; pregate status --json shows each effective rule.",
  ].join("\n");
}
