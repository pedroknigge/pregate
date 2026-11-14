import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { CAPABILITIES, LANGUAGE_COVERAGE } from "./capabilities.ts";
import { compile } from "./compile.ts";
import { dataHome, enabled } from "./consent.ts";
import { enforcementOf } from "./enforcement.ts";
import { projectFitness } from "./fitness-command.ts";
import { conflictDiagnostic, conflictedContract, pinned, sourceDirs, sourcesOf } from "./contract-diagnostic.ts";
import { LOCK, PRESET, readText, VERSIONS, within } from "./admission.ts";
import { tsconfigNotice } from "./resolve.ts";
import { git, uncommittedPackFiles } from "./git.ts";
import { HARNESSES } from "./harness/profile.ts";
import { agyRegistration, claudeRegistration, codexRegistration, cursorRegistration, gatedHarnesses } from "./machine.ts";
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
  catch (error) {
    // A lock this process cannot read or parse is not served. Admission still denies it.
    if (error instanceof SyntaxError || typeof (error as NodeJS.ErrnoException).code === "string") return null;
    throw error;
  }
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
  catch (error) {
    if (error instanceof SyntaxError) return false;   // no status JSON: that engine cannot be shown to admit the lock
    throw error;
  }
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
  // A project that registers its own Claude Code or Antigravity hooks runs its own launcher: no global one is needed.
  const claudeCode = claudeRegistration(root);
  const agy = agyRegistration(root);
  // A project Codex registration does not make Codex configured: its review in Codex is not readable here.
  const codex = codexRegistration(root);
  const launcherPresent = present(join(data, "bin", WINDOWS ? "pregate.cmd" : "pregate")) || claudeCode.projectLauncher || agy.projectLauncher;
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
    complete: contract.valid && fitness.every(r => r.status === "pass"), adopted: Object.keys(contract.lock?.fitness ?? {}).length > 0 };
  const diagnosis = root === null ? null : contractDiagnosis(root);
  const globWarnings = root === null || typeof diagnosis?.preset !== "object" || diagnosis.preset === null ? [] : deadGlobLines(diagnosis.preset, () => listedPaths(root));
  const consentLostIn = consent || root === null ? 0 : sessionsOf(root);
  return { root, state: !consent ? "inactive" : ready ? "active" : "degraded", consent, consentLostIn, mode: lock?.enforcement ?? diagnosis?.preset?.enforcement ?? null,
    engine: VERSIONS.engine, core: VERSIONS.core, project: diagnosis?.project ?? null,
    servedBy: servedLock?.engine ?? null, pendingApproval: root === null ? null : pendingApprovalCode(root),
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

// The short form leads with enforced, monitored and unverified rules, then the lock size.
function briefStatus(s: Status): string[] {
  if (s.root === null) return ["PREGATE is not set up here.", "Next: pregate guide --preview (the human approves its review)."];
  return [
    ...coverageLead(s),
    `Local consent is ${s.consent ? "active" : "inactive"} in ${s.root}. Effective protection: ${s.state}. Mode: ${s.mode ?? "unknown"}. ${versionLine(s)}`,
    ...consentLostLine(s), ...uncommittedLine(s), ...s.globWarnings, ...(s.tsconfig ? [s.tsconfig] : []),
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
  if (!s.consent) return "the human runs pregate enable in a separate terminal.";
  if (s.pendingApproval !== null) return `the human approves the pending review in this shell: pregate approve ${s.pendingApproval}. The agent must not run it.`;
  if (order !== null && order < 0) return "pregate guide --preview (or the human runs ! pregate update).";
  if (order !== null && order > 0) return "the human runs ! pregate update.";
  if (!s.contract.valid) return `${s.contract.errors[0] ?? "Contract not ready."} Inspect pregate preset diagnose.`;
  if (!s.installation.launcherPresent || !s.installation.enginePresent) return "pregate setup.";
  if (!s.harnesses.some((h) => h.configured)) return "pregate doctor.";
  if (s.unsupportedInScope.length > 0 || s.uncoveredInScope.length > 0) return "add the language pack (pregate guide --preview).";
  return "pregate audit.";
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
  return [
    ...coverageLead(s),
    `PREGATE local consent is ${s.consent ? "active" : "inactive"}${s.root === null ? "" : ` in ${s.root}`}. Effective protection: ${s.state}.`,
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
