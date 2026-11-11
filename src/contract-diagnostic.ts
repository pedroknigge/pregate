import { existsSync, lstatSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { finishContract } from "./approval.ts";
import { BUILTIN, setUpGrammars } from "./assets.ts";
import { compile, sourcesHash } from "./compile.ts";
import { enabled } from "./consent.ts";
import { decide } from "./decide.ts";
import { canonical, findRoot, readTree } from "./disk.ts";
import { ruleEnforcements } from "./enforcement.ts";
import { catFileBatch, gitFailure, indexFiles, unmerged } from "./git.ts";
import { type Call, clock, ENGINE_VERSION, engineHome, FLOOR, isCause, json, launcher, LOCK, type Outcome, PRESET, readText, told, updateReady, VERSIONS, within } from "./inertia.ts";
import { librarySource } from "./library.ts";
import { cachedSourcesMatch, loadCompiledLock, storeCompiledLock } from "./lock-cache.ts";
import { briefing, formText, notice, violationMessage } from "./message.ts";
import { cachedPack } from "./packs.ts";
import { inScope, machineGlobs, pathKey, protectedGlobs, slash } from "./paths.ts";
import { ENGINE_FILE, homeDir, WINDOWS } from "./platform.ts";
import { ruleEvaluationProgress, sharedResolutionProgress } from "./progress.ts";
import { batchApproval } from "./pending-review.ts";
import { pendingRoot } from "./proposal.ts";
import { normalize } from "./reconstruct.ts";
import { validate } from "./schema.ts";
import { recoveryCommand } from "./shell.ts";
import * as state from "./state.ts";
import { accepted, contextFile } from "./workspace.ts";
import type { CallEvent, Cause, Check, Decision, DecideInput, Files, Form, HookEvent, Lock, Preset, Rejected, Session, Violation } from "./types.ts";

interface ContractVersions { engine: string; core: string }
export type Loaded = { lock: Lock; hash: string };
const NOBODY: Session = { id: "", harness: "claude-code", agentId: null, turnId: null, interactive: false };

let ready: Promise<void> | null = null;
export function grammars(): Promise<void> {
  ready ??= setUpGrammars();
  return ready;
}

export function evaluationProgress() {
  return process.env.PREGATE_PROGRESS === "1" ? { ruleProgress: ruleEvaluationProgress, resolutionProgress: sharedResolutionProgress } : {};
}

// MH-19: the engine that must answer this call instead of this one, from the root of what the call
// targets: each file, the cwd, or the directories of a refused envelope. main exits REDIRECT with it.
export function redirect(e: HookEvent | Rejected): string | null {
  if (!("cause" in e) && e.kind === "post-invocation") return null;
  if (!("cause" in e) && e.kind === "pre-command" && (batchApproval(e.command.command, launcher()) !== null
    || recoveryCommand(e.command.command, e.command.cwd, launcher(), engineHome()))) return null;
  const dirs = "cause" in e ? e.dirs
    : e.kind === "pre-edit" ? e.changes.map((c) => dirname(c.path))
    : e.kind === "pre-command" ? [e.command.cwd] : [e.cwd];
  return dirs.reduce<string | null>((v, dir) => v ?? (findRoot(canonical(dir), enabled) === null ? null : pinned(dir)), null);
}

// MH-19, MH-20: the engine that the lock of the root at or above `dir` pins, when it is another one
// and not below FLOOR. null: this engine decides, and lockOf denies an older or unreadable pin.
export function pinned(dir: string): string | null {
  const root = findRoot(canonical(dir), () => true);
  const lock = root === null ? undefined : json(readText(join(root, LOCK)) ?? "") as { engine?: unknown } | undefined;
  const v = lock?.engine;
  return typeof v === "string" && v !== VERSIONS.engine && !belowFloor(v) ? v : null;
}

// MH-19 for the CLI (`check`, `explain`, `preset show`): the engine the lock pins answers instead,
// with the same arguments and stdio; the caller asks before reading stdin. null: this engine answers.
// `data` is <DATA>, whose engines are installed by version.
export function delegate(dir: string, argv: string[], data = engineHome()): { code: number; text: string } | null {
  const v = pinned(dir);
  if (v === null) return null;
  const engine = join(data, v, ENGINE_FILE);
  if (!runnable(engine)) return { code: 1, text: `PREGATE: this repo's lock pins engine ${v}, which is not installed: run \`pregate update --engine ${v}\`.` };
  return { code: Bun.spawnSync([engine, ...argv], { stdio: ["inherit", "inherit", "inherit"] }).exitCode ?? 1, text: "" };
}

// MH-06: a call its adapter refused denies through the event's channel when it may reach a root:
// one of its directories does, or names a machine file (MH-17), or the session already reached one,
// or it carries no directory at all. Otherwise a changed contract must not block every repo.
export function rejected(r: Rejected): Decision {
  if (r.kind === "post-invocation" || !reaches(r)) return told(null);
  const call: Call = { session: NOBODY, kind: r.kind, callId: "", abs: null, root: null, rel: null, startedAt: clock() };
  const input: DecideInput = {
    lock: null, lockHash: null, launcher: launcher(), session: call.session,
    event: call.kind, path: null, introduced: [], form: { cause: r.cause, line: null }, protectedPath: false,
    history: [], turnDenials: 0, astHash: null, stop: r.kind === "stop" ? { blocks: 0, reentry: r.reentry, approved: [] } : null,
  };
  const d = decide(input);
  if (r.session?.harness === "agy" && (r.kind === "pre-edit" || r.kind === "pre-command")) {
    state.queuePostInvocation(state.key(r.session), d);
  }
  return d;
}

function reaches(r: Rejected): boolean {
  return (r.session !== null && state.roots(state.key(r.session)).some((root) => enabled(root)))
    || (r.dirs.length === 0 ? protectedRoot(process.cwd()) : r.dirs.some(protectedRoot));
}

function protectedRoot(dir: string): boolean {
  const path = canonical(dir);
  return findRoot(path, enabled) !== null || pendingRoot(path) !== null;
}

// [-x] && [-s], as the launcher asks of an engine: an empty one would run as an empty script.
function runnable(path: string): boolean {
  const s = statSync(path, { throwIfNoEntry: false });
  return s !== undefined && s.isFile() && s.size > 0 && (WINDOWS || (s.mode & 0o111) !== 0);
}

// MH-20: semver order against FLOOR, where a pre-release sorts before its release.
export function belowFloor(v: string): boolean {
  if (!ENGINE_VERSION.test(v) || v.trim() !== v) return true;
  const [release, pre] = v.split("-");
  const a = release!.split(".").map(Number);
  const b = FLOOR.split(".").map(Number);
  const k = a.findIndex((n, i) => n !== b[i]);
  return k < 0 ? pre !== undefined : a[k]! < b[k]!;
}

// Diagnostic only: admission still compares the compiler's complete output.
// Only validated version strings and fixed descriptions reach a hook message.
export function contractDiagnostic(presetText: string | null, lockText: string | null,
  filesOf: (source: Preset["sources"][number]) => Files | null, versions: ContractVersions, floor: string): string {
  const marked = ([[PRESET, presetText], [LOCK, lockText]] as const).filter(([, text]) => text !== null && CONFLICT.test(text));
  if (marked.length > 0) return conflictDiagnostic(marked.map(([path]) => path));
  const preset = object(presetText), lock = object(lockText);
  const core = Array.isArray(preset?.sources) ? preset.sources.find(source => record(source) && source.ns === "core") : null;
  const pins = `Installed engine ${versions.engine}, core ${versions.core}; preset engine ${pin(preset?.engine)}, core ${pin(record(core) ? core.version : null)}; lock engine ${pin(lock?.engine)}, core ${pin(lock?.core)}.`;
  let reason: string;
  if (presetText === null) reason = "Missing contract: .pregate/preset.json is missing.";
  else if (lockText === null) reason = "Missing contract: .pregate/pregate.lock.json is missing.";
  else if (!validPreset(preset)) reason = "Malformed contract: .pregate/preset.json is not valid preset JSON.";
  else if (lock === null || !ENGINE_VERSION.test(String(lock.engine ?? "")) || !ENGINE_VERSION.test(String(lock.core ?? ""))
    || !Array.isArray(lock.rules) || ["presetHash", "coreHash", "sourcesHash"].some(key => typeof lock[key] !== "string" || !/^[0-9a-f]{64}$/.test(lock[key] as string))) {
    reason = "Malformed contract: .pregate/pregate.lock.json has invalid JSON or lock fields.";
  } else if (lock.lockVersion !== 1) reason = "Incompatible contract: the lock format is not supported by this engine.";
  else if (lock.engine !== versions.engine || lock.core !== versions.core || preset.engine !== versions.engine || (record(core) && core.version !== versions.core)) {
    reason = `Incompatible contract: version pins differ from the invoking engine/core (minimum accepted engine ${floor}).`;
  } else if (lock.presetHash !== new Bun.CryptoHasher("sha256").update(normalize(presetText)).digest("hex")) {
    reason = "Changed contract: .pregate/preset.json differs from the preset that compiled this lock.";
  } else {
    const sources = preset.sources;
    const external = sources.filter(source => source.kind !== "builtin").map(filesOf);
    const core = sources.filter(source => source.kind === "builtin").map(filesOf);
    reason = [...external, ...core].some(files => files === null) ? "Changed contract: one or more source definitions are missing or unavailable."
      : lock.sourcesHash !== sourcesHash(external as Files[]) ? "Changed contract: custom or optional pack source definitions differ from this lock."
      : lock.coreHash !== sourcesHash(core as Files[]) ? "Changed contract: bundled core source definitions differ from this lock."
      : "Changed contract: lock contents differ from the compiler's complete output.";
  }
  return `${reason} ${pins} Inspect \`pregate preset diagnose --json\` and \`pregate preset schema\`. The human must restore or correct missing/malformed inputs, then prepare \`pregate update --project --preview\` and approve only its displayed digest-bound command. If an older hook blocks recovery, the human can type \`! pregate update\` inside the harness. Preparation does not activate a contract or change consent.`;
}

// Git's conflict markers at the start of a line: no JSON contract file contains them.
const CONFLICT = /^<{7}(?: |$)[\s\S]*^>{7}(?: |$)/m;

// #67: a merge, rebase or cherry-pick conflicted on the contract. The lock is derived, so either side
// of it serves; the preset is the human's to merge. Every agent call stays denied (fail closed).
export function conflictDiagnostic(paths: string[]): string {
  return `Merge conflict: git left ${paths.join(" and ")} unmerged or with conflict markers, so no contract can be evaluated: every edit and Stop stays denied and \`pregate session rebase\` is unavailable. The agent cannot resolve contract files. The human resolves the conflict outside the agent: merge ${PRESET} by hand or take one side, take either side of ${LOCK} (it is recompiled, e.g. \`git checkout --theirs -- ${LOCK}\`), \`git add\` both, then prepare \`pregate update --project --preview\` and approve only its displayed digest-bound command, then conclude the merge, rebase or cherry-pick (\`git commit\`, or \`git rebase --continue\` / \`git cherry-pick --continue\`). If an older hook blocks recovery, the human can type \`! pregate update\` inside the harness.`;
}

// The contract files of `root` that git still holds unmerged; [] when git cannot tell (diagnostic only).
export function conflictedContract(root: string): string[] {
  try { return unmerged(root, [PRESET, LOCK]); }
  catch (error) {
    // This list only decorates a denial. Git failing is not proof that no conflict exists.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function pin(value: unknown): string { return typeof value === "string" && value.trim() === value && value.length <= 80 && ENGINE_VERSION.test(value) ? value : "missing/invalid"; }
function validPreset(value: unknown): value is Preset { return validate("preset", value).length === 0; }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function object(text: string | null): Record<string, unknown> | null {
  try { const value: unknown = JSON.parse(text ?? ""); return record(value) ? value : null; }
  catch (error) { if (error instanceof SyntaxError) return null; throw error; }
}

// §4.4: SessionStart only informs, and below no root it says nothing (MH-17). The snapshot it takes
// accepts the root for the session (MH-33).
export function onSessionStart(e: Extract<HookEvent, { kind: "session-start" }>): Decision {
  const sid = state.key(e.session);
  const root = locate(sid, canonical(e.cwd));
  if (isCause(root)) {
    const at = locatedForm(sid, root, canonical(e.cwd));
    return told(root === "lock-stale" && at.detail !== undefined ? formText(at, null).full : notice("halt", { reason: root }));
  }
  if (root === null) return told(null);
  const loaded = lockOf(root);
  // A child's first contact cannot accept unobserved dirty edits as pre-session debt.
  const child = e.session.harness === "codex" && e.session.agentId !== null;
  const start = child ? null
    : (rel: string) => contextFile(rel) || inScope(isCause(loaded) ? null : loaded.lock, rel);
  const snap = state.ensureSnapshot(sid, root, start);
  if (isCause(snap)) return told(notice("halt", { reason: snap }));
  const valid = verify(sid, root, loaded);
  if (!isCause(valid)) {
    const lead = child ? `Workspace root: ${JSON.stringify(root)}. Codex apply_patch: use absolute paths, name each file once, and include context in update hunks.` : updateReady();
    return told(null, briefing(valid.lock, launcher(), lead));
  }
  return told(valid === "lock-stale" || valid === "version-mismatch" ? formText(form(valid, root), null).full : notice("halt", { reason: valid }));
}

// Admit only the compiler's exact output after CRLF normalization. Metadata hashes
// alone do not bind the effective rules, scope, enforcement or failure policies (§4.1 step 6).
export function lockOf(root: string): Loaded | Cause {
  finishContract(root);
  const text = readText(join(root, LOCK));
  const preset = readText(join(root, PRESET));
  const lock = text === null ? undefined : json(text);
  if (preset === null || text === null || typeof lock !== "object" || lock === null) return "lock-stale";
  const engine = (lock as Lock).engine;
  // MH-20: no other engine judges a pin below the floor (pinned): the lock must be recompiled.
  if (engine !== VERSIONS.engine && (typeof engine !== "string" || belowFloor(engine))) return "lock-stale";
  if (engine !== VERSIONS.engine || (lock as Lock).core !== VERSIONS.core) return "version-mismatch";
  // Reuse the compiled lock only when its stored text is the normalized lock file and the key
  // still names this lock, preset, rules/packs and build. Corruption misses and recompiles.
  const cached = loadCompiledLock(root, preset, text);
  if (cached !== null) return cached;
  const result = compile(preset, sourcesOf(root), VERSIONS);
  if ("errors" in result || result.text !== text.replaceAll("\r\n", "\n")) return "lock-stale";
  storeCompiledLock(root, preset, result.text);
  return { lock: result.lock, hash: state.sha256(text) };
}

// What compile reads for each source of the preset at `root`, from the working tree.
export function sourcesOf(root: string, withFixtures = false): (s: Preset["sources"][number]) => Files | null {
  return (s) => {
    if (s.kind === "builtin") return BUILTIN;
    if (s.kind === "git") return cachedPack(s);
    if (s.kind === "library") return librarySource(s.ns, withFixtures);
    const dir = resolve(root, s.path);
    return existsSync(dir) ? readTree(dir, withFixtures) : null;
  };
}

// The `path` source folders a preset names, read leniently: they are protected even when the
// preset does not compile.
export function sourceDirs(presetText: string): string[] {
  const preset = json(presetText) as { sources?: unknown } | undefined;
  const sources: unknown[] = Array.isArray(preset?.sources) ? preset.sources : [];
  return sources.flatMap((s) => (typeof (s as { path?: unknown })?.path === "string" ? [(s as { path: string }).path] : []));
}

// §4.1 step 4: the accepted root at or above `dir`, or why there is none.
export function locate(sid: string, dir: string): string | Cause | null {
  let nearest: string | null = null;
  const accepts = accepted(sid);
  const root = findRoot(dir, (candidate) => {
    if (!enabled(candidate)) return false;
    nearest ??= candidate;
    return accepts(candidate);
  });
  if (root !== null) return root;
  // An enabled preset this session has not accepted must not disappear. findRoot stops at .git
  // when the callback rejects it, and a Pre with no root then exits 0 and records nothing.
  if (nearest !== null) return "lock-stale";
  // The preset of a root this session already registered is gone. Another checkout nested below it
  // without a consenting contract of its own (an agent's disabled worktree, a vendored clone) is
  // not that root's territory.
  return state.roots(sid).some((r) => enabled(r) && within(r, dir) && checkout(r) === checkout(dir)) ? "lock-stale" : null;
}

function checkout(dir: string): string | null {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return d;
    if (dirname(d) === d) return null;
  }
}

// The project a located cause is about. A nearer root this session did not accept (a worktree or
// checkout whose preset appeared mid-session and is not committed) is named itself, not the outer
// root that contains it: that root's contract is not the one that failed (issue #42).
export function locatedForm(sid: string, cause: Cause, dir: string): Form {
  const nearest = findRoot(dir, enabled);
  if (cause === "lock-stale" && nearest !== null && !accepted(sid)(nearest)) {
    return { cause, line: null, detail: `${nearest} has its own PREGATE contract, which this session did not open: its preset appeared after the session started and is not committed at HEAD. Commit ${nearest}/.pregate/preset.json with its lock, or start a new agent session in ${nearest}.` };
  }
  return form(cause, nearest ?? state.roots(sid).find((r) => enabled(r) && within(r, dir)));
}

// §4.1 step 5, and the machine's own files (MH-17). Source folders come from preset.json too, so they
// stay protected without a valid lock. A path below no root still protects those of every root the
// session reached.
export function globsOf(sid: string, root: string | null, loaded: Loaded | Cause | null): string[] {
  const dirs = { home: canonical(homeDir()), data: canonical(state.stateDir()), engine: canonical(engineHome()) };
  const fromLock = root === null || loaded === null || isCause(loaded) ? [] : loaded.lock.sourceDirs.map((d) => resolve(root, d));
  const roots = root === null ? state.roots(sid) : [root];
  const fromPresets = roots.flatMap((r) => sourceDirs(readText(join(r, PRESET)) ?? "").map((d) => resolve(r, d)));
  // Every folder is absolute here, so the root protectedGlobs joins relative ones to plays no part.
  return [...protectedGlobs("/", [...fromPresets, ...fromLock], dirs), ...machine()];
}

// MH-17: what no agent may touch from any session, rooted or not: the harness registrations, this
// installation and **/.pregate/**, in every spelling and under their realpaths.
export function machine(): string[] {
  const env = process.env;
  const home = homeDir();
  const missing = new Map<string, string>();
  const real = (p: string): string => {
    for (const [dir, realDir] of missing) {
      if (p.startsWith(`${dir}/`) || p.startsWith(`${dir}\\`)) return `${realDir}/${slash(p.slice(dir.length + 1))}`;
    }
    const c = canonical(p);
    if (lstatSync(p, { throwIfNoEntry: false }) === undefined) missing.set(p, c);
    return c;
  };
  return machineGlobs(home, {
    codexHome: env.CODEX_HOME || join(home, ".codex"), grokHome: env.GROK_HOME || join(home, ".grok"),
    opencodeHome: env.OPENCODE_CONFIG_DIR || join(home, ".config/opencode"),
    claudeConfig: env.CLAUDE_CONFIG_DIR || null, data: engineHome(), state: state.stateDir(),
  }, real);
}

// §4.1 step 6, after lockOf: the sourcesHash, verified once per lock and session (state.sourcesOk).
export function verify(sid: string, root: string, loaded: Loaded | Cause): Loaded | Cause {
  if (isCause(loaded)) return loaded;
  const ok = state.sourcesOk(sid, root, loaded.hash, () => sourcesMatch(root, loaded.lock));
  return ok === true ? loaded : ok === false ? "lock-stale" : ok;
}

export function sourcesMatch(root: string, lock: Lock): boolean {
  // A compiled-lock hit already hashed the packs. Do not read them again for sourcesHash.
  if (cachedSourcesMatch(root, lock)) return true;
  const preset = json(readText(join(root, PRESET)) ?? "") as Preset | undefined;
  if (!preset || (lock.gitSources ?? []).some((s) => cachedPack(s) === null)) return false;
  const files = preset.sources.filter((s) => s.kind !== "builtin").map(sourcesOf(root));
  return files.every((f) => f !== null) && sourcesHash(files as Files[]) === lock.sourcesHash;
}

export function fromDisk(root: string): Loaded | { errors: string[] } {
  const loaded = lockOf(root);
  if (isCause(loaded)) return { errors: [formText(form(loaded, root), null).full] };
  return sourcesMatch(root, loaded.lock) ? loaded : { errors: [formText(form("lock-stale", root), null).full] };
}

// A10: pre-commit and CI rebuild the lock (from the index, or from the tree) and compare bytes.
export function recompiled(root: string, staged: boolean): Loaded | { errors: string[] } {
  const texts = staged ? catFileBatch(root, [`:./${PRESET}`, `:./${LOCK}`]) : [readText(join(root, PRESET)), readText(join(root, LOCK))];
  if (texts === null) return { errors: [formText(form(gitFailure()), null).full] };
  const [presetText, lockText] = texts;
  if (presetText === null || presetText === undefined) return { errors: [`PREGATE: ${PRESET} is missing${staged ? " from the index" : ""}.`] };
  const filesOf = staged ? (s: Preset["sources"][number]) => (s.kind === "builtin" ? BUILTIN : s.kind === "git" ? cachedPack(s) : s.kind === "library" ? librarySource(s.ns) : indexFiles(root, s.path)) : sourcesOf(root);
  const r = compile(presetText, filesOf, VERSIONS);
  if ("errors" in r) return r;
  if (r.text !== lockText?.replaceAll("\r\n", "\n")) return { errors: [`PREGATE: ${LOCK} does not match the preset and its sources. Run \`pregate preset compile\` and commit the lock.`] };
  return { lock: r.lock, hash: state.sha256(r.text) };
}

// decide, then the event record (§4.1 steps 14 and 15). Without state there are no counters: a
// failed record turns the call into a human-cause deny.
export function settle(call: Call, o: Outcome): Decision {
  // Counters only shape a denial; an allowed call skips reading the session's history.
  const bare = inputOf(call, o);
  const allowed = decide(bare);
  const input = allowed.verdict === "none" ? bare : counted(call, bare);
  const d = diagnosticNotice(allowed.verdict === "none" ? allowed : decide(input), input);
  const kept = d.verdict !== "none" || d.shadowed ? o.after : null;
  const disputed = d.verdict === "deny" && d.cause === null && kept !== null && o.lock !== null;
  const failed = state.record(state.key(call.session), {
    at: Date.now(), versions: VERSIONS, callId: call.callId, turn: turnOf(call.session), agentId: call.session.agentId, kind: call.kind,
    evaluationMs: clock() - call.startedAt,
    path: call.abs, verdict: d.verdict, halted: d.halt, form: d.cause, shadowed: d.shadowed,
    root: call.root, message: d.compact || d.full.split("\n")[0] || o.introduced[0]?.rule || "",
    enforcement: ruleEnforcements(o.lock),
    ruleChecks: recordedChecks(o.lock, o.introduced),
    ...(disputed ? { dispute: disputeData(call.root!, o.lock!, d),
      beforeSha: o.before === null ? null : state.sha256(o.before) } : {}),
    violations: o.introduced.filter((v) => v.severity !== "warn"),   // O20: what shadow muted too
    messages: o.lock === null ? [] : o.introduced.filter((v) => v.severity !== "warn").map((v) => violationMessage(v, o.lock!)),
    warnings: o.introduced.filter((v) => v.severity === "warn"),
    warningMessages: o.lock === null ? [] : o.introduced.filter((v) => v.severity === "warn").map((v) => violationMessage(v, o.lock!)),
    afterSha: kept === null ? null : state.sha256(kept), astHash: o.astHash,
  }, kept, disputed ? o.before : null);
  return failed === undefined ? d : decide({ ...input, form: form(failed) });
}

// Preserve observed check versions without adding source or parameters to public diagnostics.
export function recordedChecks(lock: Lock | null, violations: Violation[]): Record<string, string> {
  const ids = new Set(violations.map((v) => v.rule));
  return Object.fromEntries((lock?.rules ?? []).filter((r) => ids.has(r.id)).map((r) => [r.id, r.check]));
}

// Retain the exact check behind each denied rule, including its original path restrictions.
function disputeData(root: string, lock: Lock, decision: Decision): CallEvent["dispute"] {
  const rules = lock.rules.filter((r) => decision.violations.some((v) => v.rule === r.id));
  const preset = JSON.parse(readText(join(root, PRESET))!) as Preset;
  const checks: Record<string, Check> = {};
  const filesOf = sourcesOf(root);
  for (const source of preset.sources.filter((s) => rules.some((r) => r.check.startsWith(`${s.ns}/`)))) {
    const files = filesOf(source);
    for (const rule of rules.filter((r) => r.check.startsWith(`${source.ns}/`))) {
      const id = rule.check.split("@")[0]!;
      const text = files?.[`checks/${id.split("/").slice(1).join("/")}/check.json`];
      if (text !== undefined) checks[rule.id] = JSON.parse(text) as Check;
    }
  }
  return { rules, checks, context: { scope: lock.scope, layers: lock.layers, generatedMarkers: lock.generatedMarkers } };
}

export function inputOf(call: Call, o: Outcome): DecideInput {
  const diagnostic = o.form !== null && o.form.detail === undefined && call.root !== null
    && ["lock-stale", "version-mismatch"].includes(o.form.cause) ? form(o.form.cause, call.root) : o.form;
  return {
    lock: o.lock, lockHash: o.lockHash, launcher: launcher(), session: call.session,
    event: call.kind, path: call.rel ?? call.abs, introduced: o.introduced, form: diagnostic, protectedPath: o.protectedPath,
    history: [], turnDenials: 0, astHash: o.astHash, stop: null,
  };
}

export function diagnosticNotice(decision: Decision, input: DecideInput): Decision {
  return input.form?.detail && decision.notice !== null
    ? { ...decision, notice: decision.full || `${decision.notice}\n${input.form.detail}`.slice(0, 4000) } : decision;
}

// The counters of this (agent, file) and of the agent's turn, this call excluded.
function counted(call: Call, input: DecideInput): DecideInput {
  const sid = state.key(call.session);
  const agentH = call.session.agentId === null ? "-" : state.H(call.session.agentId);
  const turnH = state.H(turnOf(call.session));
  const history = state.history(sid, agentH, call.abs === null ? "-" : state.H(pathKey(call.abs)));
  return { ...input, history, turnDenials: state.turnDenials(sid, turnH, agentH) };
}

// Without prompt_id the turn is everything since the last recorded end of turn (SPEC §11.3): a Stop
// that blocks keeps the turn going, or maxStopBlocks would never be reached.
export function turnOf(s: Session): string {
  return s.turnId ?? `after-stop-${state.history(state.key(s), "-", "stop").filter((e) => e.verdict !== "deny").at(-1)?.at ?? 0}`;
}

export function form(cause: Cause, root?: string): Form {
  return { cause, line: null, ...(root !== undefined && ["lock-stale", "version-mismatch"].includes(cause)
    ? { detail: diagnosis(root) } : {}) };
}

function diagnosis(root: string): string {
  const conflicted = conflictedContract(root);
  return conflicted.length > 0 ? conflictDiagnostic(conflicted)
    : contractDiagnostic(readText(join(root, PRESET)), readText(join(root, LOCK)), sourcesOf(root), VERSIONS, FLOOR);
}
