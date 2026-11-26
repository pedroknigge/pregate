import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { approvalDeadline, pendingContract, proposeContract } from "./approval.ts";
import { disabledNotice, enabled, enforcedHere, explicitlyDisabled } from "./consent.ts";
import { bundledBetween, contractDiff, sourceDiff, validateContract } from "./contract.ts";
import { compileHere, evaluationProgress, form, fromDisk, globsOf, grammars, inputOf, type Loaded, locate, locatedForm, lockOf, recompiled, settle, sourceDirs, sourcesOf, verify } from "./contract-diagnostic.ts";
import { blocking, decide, merge } from "./decide.ts";
import { dependencyReviews, dependencyRules, type ImportMemo, memoizedImports, needsDependencyReview } from "./dependencies.ts";
import { openDependencyCache } from "./dependency-cache.ts";
import { scriptControlCause } from "./control.ts";
import { acceptedByEnvironment, loosening, looseningText } from "./loosening.ts";
import { canonical, escapedRoot, findRoot, readTree, samePlace } from "./disk.ts";
import { analyze, placement } from "./evaluate.ts";
import { causeFix } from "./fix.ts";
import { ruleEnforcements } from "./enforcement.ts";
import { fitnessViolations, projectFitness } from "./fitness-command.ts";
import { catFileBytesBatch, git } from "./git.ts";
import { type Call, clock, isCause, json, launcher, LOCK, NOTHING, PRESET, PROTECTED, readText, type Rooted, told, VERSIONS, within } from "./admission.ts";
import { grammarOf } from "./languages.ts";
import { isNodePinFile } from "./node-security-pin.ts";
import { adviseText, denyText, formText, syntaxAdvisory, unresolvedAdvisory, warnText } from "./message.ts";
import { absolutePath, inScope, matches, pathKey, protects, relativePath as relative, REQUESTS } from "./paths.ts";
import { isDependencyPinFile } from "./package-version.ts";
import { WINDOWS } from "./platform.ts";
import { checkpoint, importReviewProgress } from "./progress.ts";
import { adrTouch, usesPrimitive } from "./proxy-checks.ts";
import { commitCounts, worktreePaths } from "./proxy-diff.ts";
import { comparedLock, introduced } from "./ratchet.ts";
import { apply, normalize, window } from "./reconstruct.ts";
import type { Recorded } from "./report.ts";
import { sarifReport } from "./sarif.ts";
import { validate } from "./schema.ts";
import * as state from "./state.ts";
import { eventFiles, sha256, stateDir } from "./state.ts";
import { astHash, errorIn, type Parsed, parse, sfcScript } from "./ts.ts";
import type { Analysis, BaselineRead, CallEvent, Cause, Decision, Form, Lock, Phase, ProposedChange, Read, Session, Snapshot, Violation } from "./types.ts";
import { accepted, changed, changes, type FileState, overlaid, type Overlay, owned, reader, revisionReader, snapshotReader, stdinFile, textOf, tracked, workspacePaths } from "./workspace.ts";

export interface Finding { id: string; session: string; folder: string; event: CallEvent }

// An 8.3 short name and the long name are one project. Callers that filter on `event.root`
// would otherwise drop a finding recorded under the other spelling.
export function unifyRoot(records: Recorded[], root: string): Recorded[] {
  return records.map(record => {
    const found = record.event.root;
    if (!found || found === root || !samePlace(found, root)) return record;
    return { ...record, event: { ...record.event, root } };
  });
}
export type CheckMode = { kind: "stdin"; path: string; text: string } | { kind: "staged" } | { kind: "base"; sha: string } | { kind: "tree" };
export interface JudgeContext { beforeRead?: BaselineRead; importsOf?: ImportMemo; changed?: readonly string[]; commits?: (rel: string) => number | null; list?: () => readonly string[] }
export type JudgedFile = Omit<FileState, "before"> & { before: string | null | BaselineRead };
export interface Review { violations: Violation[]; form: Form | null; astHash: string | null; before?: string | null }
interface Planned { c: ProposedChange; abs: string; disk: string | null; current: string | null; r: ReturnType<typeof apply> }
interface DependencyAdmission { contract: Loaded | Cause; importsOf: ImportMemo }

export const CLEAN: Review = { violations: [], form: null, astHash: null };

// Reports and feedback share the same dated selection and legacy root inference.
export function records(since = 0): Recorded[] {
  const dir = join(stateDir(), "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((session) => {
    const folder = join(dir, session);
    if (!existsSync(join(folder, "events"))) return [];
    let roots: string[] | undefined;
    const legacyRoots = () => roots ??= readdirSync(folder).filter((d) => existsSync(join(folder, d, "snapshot.json")))
      .map((d) => (JSON.parse(readFileSync(join(folder, d, "snapshot.json"), "utf8")) as Snapshot).root);
    return eventFiles(folder, since).map((file) => {
      const event = JSON.parse(readFileSync(file, "utf8")) as CallEvent;
      event.root ??= legacyRoots().filter((r) => event.path?.startsWith(r + "/")).sort((a, b) => b.length - a.length)[0]
        ?? (legacyRoots().length === 1 ? legacyRoots()[0]! : null);
      return { session: WINDOWS ? session.replaceAll("~", ":") : session, event };
    });
  });
}

export function findings(root: string): Finding[] {
  const dir = join(stateDir(), "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((session) => {
    const folder = join(dir, session), events = join(folder, "events");
    if (!existsSync(events)) return [];
    return eventFiles(folder).flatMap((file) => {
      const event = JSON.parse(readFileSync(file, "utf8")) as CallEvent;
      return event.root === root && (event.form !== null || event.violations.length > 0)
        ? [{ id: sha256(`${session}\0${basename(file)}`).slice(0, 24), session: WINDOWS ? session.replaceAll("~", ":") : session, folder, event }] : [];
    });
  }).sort((a, b) => b.event.at - a.event.at || a.id.localeCompare(b.id));
}

export function findingContent(finding: Finding, hash: string): string {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("Recorded content has an invalid blob hash.");
  const text = readFileSync(join(finding.folder, "blobs", hash), "utf8");
  if (sha256(text) !== hash) throw new Error("Recorded content blob does not match its recorded hash.");
  return text;
}

// ── Evaluation of one file (Pre, Stop, check) ───────────────────────────────────────────

// Placement (no parse) and, in scope, the ratcheted rules. An unchanged file introduces nothing.
export function review(lock: Lock, phase: Phase, f: FileState, read: Read, beforeRead: Read = read, extra: Omit<JudgeContext, "beforeRead"> = {}): Review {
  if (f.after !== null && f.before !== null && normalize(f.before) === f.after) return CLEAN;
  const placed = f.after === null ? [] : placement(lock, phase, f.rel, f.base === null, f.base);
  if (!inScope(lock, f.rel)) return { ...CLEAN, violations: placed };
  const j = judge(lock, phase, f, read, { beforeRead, ...extra });
  return { ...j, violations: [...placed, ...j.violations] };
}

// Steps 10 to 13: syntax in the changed window, then analyze both states and keep what is new. The
// "after" is parsed once for both; the "before" runs only the rules the ratchet compares.
export function judge(lock: Lock, phase: Phase, f: JudgedFile, read: Read, context: JudgeContext = {}): Review {
  const beforeRead: BaselineRead = context.beforeRead ?? read;
  const { importsOf, list } = context;
  checkpoint("parse");
  const parsed = f.after === null || grammarOf(f.rel) === null ? null : parse(f.rel, f.after);
  if (parsed !== null) importsOf?.remember(parsed);
  const line = parsed === null ? null : syntaxLine(parsed, f.base);
  checkpoint("rules");
  const dependencies = new Set<string>();
  const after = line === null ? analyze(lock, phase, f.rel, parsed ?? f.after, { read: (rel) => { dependencies.add(rel); return read(rel); }, now: clock, hash: false, importsOf, list, commits: context.commits, ...evaluationProgress() }) : null;
  const deferred = typeof f.before === "function";
  const primed = deferred || f.before !== null ? beforeRead.prime?.([...(deferred ? [f.rel] : []), ...dependencies]) : undefined;
  if (primed !== undefined) return { ...CLEAN, form: form(primed) };
  const beforeText = typeof f.before === "function" ? f.before(f.rel) : f.before;
  if (deferred && isCause(beforeText)) return { ...CLEAN, form: form(beforeText) };
  if (after === null) return { ...CLEAN, form: { cause: "syntax", line } };
  if ("cause" in after) return { ...CLEAN, form: after };
  const baseline = beforeText === null ? null : grammarOf(f.rel) === null ? normalize(beforeText) : parse(f.rel, normalize(beforeText));
  if (baseline !== null && typeof baseline !== "string") importsOf?.remember(baseline);
  const before = baseline === null ? null : analyze(comparedLock(lock, after), phase, f.rel, baseline, { read: beforeRead, now: clock, hash: false, importsOf, list, commits: context.commits, ...evaluationProgress() });
  // A "before" that cannot be analyzed counts as absent: all of `after` is new (strict), which the
  // agent can still clear, unlike a deny over text it cannot change.
  const base: Analysis | null = before === null || "cause" in before ? null : before;
  const violations = [...introduced(lock, f.rel, base, after), ...adrTouch(lock, phase, f.rel, context.changed)];
  return { violations, form: null, astHash: parsed !== null && violations.length > 0 ? astHash(parsed) : null, before: beforeText };
}

// A19 + O15: an error that intersects the changed window, or any error when `base` parsed clean.
function syntaxLine(after: Parsed, base: string | null): number | null {
  const changed = window(base === null ? null : sfcScript(after.rel, normalize(base)), after.text);
  if (changed === null) return null;
  const inWindow = errorIn(after, changed);
  if (inWindow !== null || base === null) return inWindow;
  const anywhere = errorIn(after, null);
  return anywhere !== null && errorIn(parse(after.rel, normalize(base)), null) === null ? anywhere : null;
}

// ── check: pre-check, pre-commit and CI (§4.5) ────────────────────────────────────

// A forbidden path is not source, so the ordinary tree walk never opens it. When a rule names one,
// `check --all` judges that path too. A diff check already sees it when the change includes it.
// A lockfile is not a grammar, so the ordinary tree walk never opens yarn, pnpm, or bun locks.
// package.json and package-lock.json are already JSON context files. When a pin rule is on,
// the other lockfiles are judged too. A project without that rule keeps the previous walk.
function withDependencyPins(root: string, lock: Lock, files: FileState[]): FileState[] {
  if (!usesPrimitive(lock, "dependency-pin")) return files;
  const have = new Set(files.map((file) => file.rel));
  const extra = workspacePaths(root, (rel) => !have.has(rel) && isDependencyPinFile(rel) && inScope(lock, rel));
  return [...files, ...extra.map((rel) => ({ rel, base: null, before: null, after: textOf(readText(join(root, rel))) }))];
}

function withForbidden(root: string, lock: Lock, files: FileState[]): FileState[] {
  const rules = lock.rules.filter((rule) => rule.impl.kind === "primitive" && rule.impl.primitive === "forbidden-path");
  if (!rules.length) return files;
  const have = new Set(files.map((file) => file.rel));
  const extra = workspacePaths(root, (rel) => !have.has(rel) && rules.some((rule) => {
    const globs = Array.isArray(rule.params.globs) ? rule.params.globs.filter((glob): glob is string => typeof glob === "string") : [];
    return globs.some((glob) => matches(glob, rel));
  }));
  return [...files, ...extra.map((rel) => ({ rel, base: null, before: null, after: textOf(readText(join(root, rel))) }))];
}

// A Node pin file is not source, so the ordinary tree walk never opens it. When a node-pin
// rule is active, `check --all` judges that path too. A diff check already sees it when the change includes it.
function withNodePins(root: string, lock: Lock, files: FileState[]): FileState[] {
  if (!lock.rules.some((rule) => rule.impl.kind === "primitive" && rule.impl.primitive === "node-pin")) return files;
  const have = new Set(files.map((file) => file.rel));
  const extra = workspacePaths(root, (rel) => !have.has(rel) && isNodePinFile(rel));
  return [...files, ...extra.map((rel) => ({ rel, base: null, before: null, after: textOf(readText(join(root, rel))) }))];
}

// Same evaluation and the same `blocking` as the hook, without state or counters.
export async function check(root: string, m: CheckMode, format: "agent" | "sarif" = "agent"): Promise<{ code: 0 | 1; text: string }> {
  root = canonical(root);
  const loaded = m.kind === "stdin" ? fromDisk(root) : recompiled(root, m.kind === "staged");
  if ("errors" in loaded) return { code: 1, text: loaded.errors.join("\n") };
  const files = m.kind === "stdin" ? stdinFile(root, m.path, m.text) : m.kind === "tree"
    ? workspacePaths(root).map((rel) => ({ rel, base: null, before: null, after: textOf(readText(join(root, rel))) })) : changes(root, m);
  if (isCause(files)) return { code: 1, text: formText(form(files), null).full };
  const phase: Phase = m.kind === "stdin" ? "pre" : m.kind === "staged" ? "commit" : "ci";
  await grammars();
  const disk = reader(root, m.kind === "staged");
  const read: Read = m.kind === "stdin" ? (rel) => rel === m.path ? normalize(m.text) : disk(rel) : disk;
  const revision = m.kind === "base" ? git(root, ["merge-base", m.sha, "HEAD"])?.trim() ?? null : "HEAD";
  const before = m.kind === "tree" ? () => null : revisionReader(root, revision);
  // Non-stdin contract bytes were already compared with the compiler's complete output.
  // They are policy data, not source containing the suppression strings that policy defines.
  const wantsAdr = usesPrimitive(loaded.lock, "adr-touch");
  const diff = !wantsAdr || m.kind === "tree" ? undefined : m.kind === "stdin" ? worktreePaths(root) : files.map((f) => f.rel);
  const diffPaths = diff === undefined || diff === null ? undefined : [...new Set([...diff, ...files.map((f) => f.rel)])];
  const commits = usesPrimitive(loaded.lock, "churn-ratchet") ? commitCounts(root) : undefined;
  const judged = m.kind === "tree" ? withNodePins(root, loaded.lock, withDependencyPins(root, loaded.lock, withForbidden(root, loaded.lock, files))) : files;
  let listed: readonly string[] | undefined;
  const list = () => listed ??= workspacePaths(root);
  const reviews = judged.filter((f) => m.kind === "stdin" || (f.rel !== PRESET && f.rel !== LOCK))
    .map((f) => ({ rel: f.rel, ...review(loaded.lock, phase, f, read, before, { changed: diffPaths, commits, list }) }));
  const changedFiles = new Set(files.map((f) => f.rel));
  const needsDependencies = m.kind !== "tree" && needsDependencyReview(loaded.lock, phase, changedFiles);
  const paths = m.kind === "staged" ? changed(root, ["ls-files", "-z", "--", "."]) ?? [] : [];
  if (needsDependencies) {
    checkpoint("dependency-review");
    reviews.push(...importReviewProgress(dependencyRules(loaded.lock, phase).map(rule => rule.id), () =>
      dependencyReviews(() => owned(root, m.kind === "staged" ? paths : workspacePaths(root), tracked), { lock: loaded.lock, phase, changed: changedFiles, read, before, now: clock,
        cache: openDependencyCache(root), ...evaluationProgress(),
        ...(m.kind === "staged" ? {} : { identity: (rel: string) => relative(root, canonical(join(root, rel))) }) })));
  }
  const fitness = phase === "pre" ? [] : projectFitness(root, loaded.lock, phase,
    m.kind === "staged" ? (rel) => catFileBytesBatch(root, [`:./${rel}`])?.[0] ?? null : undefined, m.kind === "staged" ? paths : undefined);
  reviews.push({ rel: ".pregate/preset.json", ...CLEAN, violations: fitnessViolations(loaded.lock, fitness) });
  // A looser contract fails the check against the base revision only: that is the pull request,
  // where a reviewer accepts it. A local commit carries it there and is told, not refused.
  const contract = m.kind === "staged" || m.kind === "base" ? refusedLoosening(root, m.kind, loaded, before, read) : null;
  const result = report(loaded, reviews, phase, format, m.kind === "base" ? contract : null);
  return m.kind === "staged" && contract !== null && format === "agent" ? { code: result.code, text: `${result.text}${result.text === "" ? "" : "\n\n"}${contract}` } : result;
}

// A contract loosened since the last commit (staged) or the base revision (CI), unless the exact
// digest is in PREGATE_ACCEPT_CONTRACT. No record on this machine accepts or refuses one.
function refusedLoosening(root: string, where: "staged" | "base", loaded: Loaded, before: Read, read: Read): string | null {
  // The base side is the contract that was in effect there. Its lock file may be missing, behind
  // its preset, or from another engine version, so the base preset is compiled the way the head is.
  const basePreset = before(PRESET);
  const compiledBase = basePreset === null ? null : compileHere(basePreset, sourcesOf(root));
  const baseLock = compiledBase !== null && !("errors" in compiledBase) ? compiledBase.text : before(LOCK);
  const found = loosening({ lockText: baseLock, presetText: basePreset }, { lock: loaded.lock, hash: loaded.hash, presetText: read(PRESET) });
  if (found === null || acceptedByEnvironment(found.digest)) return null;
  return looseningText(found, where);
}

// Exit 1 for anything blocking: a kept form cause, a blocking violation or a refused loosening;
// advisor and warn only inform.
function report(loaded: Loaded, reviews: (Review & { rel: string })[], phase: Phase, format: "agent" | "sarif", contract: string | null = null): { code: 0 | 1; text: string } {
  const forms = [...(contract === null ? [] : [contract]),
    ...reviews.flatMap((r) => (r.form !== null && blocking(loaded.lock, [], r.form.cause, { rel: r.rel, phase }).cause !== null ? [formText(r.form, r.rel).full] : []))];
  const found = reviews.flatMap((r) => r.violations);
  const blocked = blocking(loaded.lock, found, null).violations;
  const held = reviews.flatMap((r) => {
    const cause = r.form;
    if (loaded.lock.enforcement !== "advisor" || (cause?.cause !== "syntax" && cause?.cause !== "unresolvable-import")) return [];
    if (blocking(loaded.lock, [], cause.cause, { rel: r.rel, phase }).cause !== null) return [];
    return [cause.cause === "syntax" ? syntaxAdvisory(cause, r.rel).full : unresolvedAdvisory(cause, r.rel).full];
  });
  const code = forms.length > 0 || blocked.length > 0 ? 1 : 0;
  if (format === "sarif") return { code, text: sarifReport(loaded.lock, found, forms.length === 0 && held.length === 0) };
  const policies = ruleEnforcements(loaded.lock);
  const advised = found.filter((v) => (policies[v.rule] ?? loaded.lock.enforcement) === "advisor");
  // The CLI pre-check is where "+N more" points, so it lists every finding (rule lines stay capped).
  const ctx = { launcher: launcher(), lockHash: loaded.hash, max: Infinity };
  const text = [
    ...forms,
    ...held,
    denyText(blocked, loaded.lock, 1, "retry", ctx).full,
    adviseText(advised, loaded.lock, ctx, forms.length > 0 || blocked.length > 0).full,
    warnText(found.filter((v) => v.severity === "warn" && (policies[v.rule] ?? loaded.lock.enforcement) !== "advisor"), loaded.lock).full,
  ].filter((t) => t !== "");
  return { code, text: text.length === 0 ? "PREGATE: no introduced violations." : text.join("\n\n") };
}

// Directories that show this hook was started for an enabled project, even when the edited
// path itself is outside that project and the session has not registered a root yet.
function invocationRoots(session: Session): string[] {
  const found = new Set<string>();
  for (const dir of [process.cwd(), process.env.CLAUDE_PROJECT_DIR, process.env.CURSOR_PROJECT_DIR, process.env.GROK_WORKSPACE_ROOT]) {
    if (typeof dir !== "string" || !absolutePath(dir)) continue;
    try {
      if (enforcedHere(dir)) {
        const root = findRoot(canonical(dir), enabled);
        if (root !== null) found.add(root);
      }
    } catch (error) {
      // A path with no existing ancestor is not a project. A symlink loop or any other
      // failure stays a failure: canonical() denies those on purpose.
      if (error instanceof Error && error.message.endsWith(": no existing ancestor")) continue;
      throw error;
    }
  }
  return [...found];
}

// User-level harness settings and the launcher, for a call whose files sit outside every
// enabled root. In-project paths stay on the normal pre-edit path.
function machineEdit(changes: ProposedChange[], paths: string[], startedAt: number): Decision | null {
  const session = changes[0]?.session;
  if (session === undefined) return null;
  // A file already inside an enabled project takes the normal pre-edit path.
  if (paths.every((abs) => findRoot(dirname(abs), enabled) !== null)) return null;
  const sid = state.key(session);
  const known = invocationRoots(session);
  const root = known[0];
  if (root === undefined) return null;
  const globs = globsOf(sid, root, null);
  for (const [i, c] of changes.entries()) {
    const abs = paths[i]!;
    if (findRoot(dirname(abs), enabled) !== null || !protects(abs, globs)) continue;
    const call: Call = { session: c.session, kind: "pre-edit", callId: c.callId, abs, root, rel: relative(root, abs), startedAt };
    return decide(inputOf(call, { ...NOTHING, form: form("protected-path"), protectedPath: true }));
  }
  return null;
}

// ── Pre edit hook (§4.1) ──────────────────────────────────────────────────────────────

// §4.1 steps 4 and 5 for each file of the call, each judged with the others as the call leaves them
// (MH-09), and one answer for all of them. A single file takes the path it always took.
export async function onPreEdit(changes: ProposedChange[]): Promise<Decision> {
  const startedAt = clock();
  const paths = changes.map((c) => canonical(c.path));
  for (const [i, c] of changes.entries()) {
    const abs = paths[i]!;
    // A judged path whose real target leaves every accepted root cannot take the write. Judged by
    // the spelled path: a target out of this root's scope stays out of scope, as before.
    const escaped = escapedRoot(c.path, abs, enabled);
    if (escaped !== null) {
      const rel = relative(escaped, resolve(c.path));
      const contract = lockOf(escaped);
      if (inScope(isCause(contract) ? null : contract.lock, rel)) {
        const call: Call = { session: c.session, kind: "pre-edit", callId: c.callId, abs, root: escaped, rel, startedAt };
        return decide(inputOf(call, PROTECTED));
      }
    }
  }
  // A fresh session has not registered a root yet. The hook was still started from an enabled
  // project (cwd or the harness project variable): user-level harness files and the launcher
  // are protected there, the same paths the shell guard denies.
  const outside = machineEdit(changes, paths, startedAt);
  if (outside !== null) return outside;
  // A human disabled this checkout. Edits here, including harness settings and `.pregate/`, are not
  // judged. A file in a worktree that is still enabled is not this case. The notice comes first,
  // because a disabled checkout is also not `enforcedHere`.
  const outsideEnabled = changes.every((_, i) => findRoot(dirname(paths[i]!), enabled) === null);
  if (changes.length > 0 && outsideEnabled) {
    const disabledEdit = (i: number): boolean => {
      const dir = dirname(paths[i]!);
      const root = findRoot(dir, () => true);
      return root !== null && explicitlyDisabled(root) && findRoot(dir, enabled) === null;
    };
    const cwdRoot = findRoot(canonical(process.cwd()), () => true);
    const cwdDisabled = cwdRoot !== null && explicitlyDisabled(cwdRoot);
    if (cwdDisabled || changes.every((_, i) => disabledEdit(i))) {
      const root = cwdRoot ?? findRoot(dirname(paths[0]!), () => true);
      return told(null, root === null ? "" : disabledNotice(root));
    }
  }
  // A file outside every enabled project, and a hook that was not started from one, is not
  // enforced. Another project this session reached, and a pending review, do not change that.
  // The invocation walk runs only when the file itself is not enforced.
  const session = changes[0]?.session;
  if (paths.every((abs) => !enforcedHere(dirname(abs)))) {
    const invoked = session === undefined ? [] : invocationRoots(session);
    if (invoked.every((dir) => !enforcedHere(dir))) return told(null);
  }
  const planned = changes.map((c, i) => plan(c, paths[i]!));
  const overlay: Overlay = new Map(planned.filter((p) => p.r.status === "exact").map((p) => [pathKey(p.abs), p.r.after]));
  const approved = await contractEdit(planned, overlay, startedAt);
  if (approved !== null) return approved;
  // One contract per root for this call's overlay and dependency review. A later process may
  // reuse the compiled-lock cache; it still compares that text to the lock and never keeps
  // this call's admission for the next one. Before-edit analysis stays uncached (A12).
  const locks = new Map<string, Loaded | Cause>();
  const load = (root: string): Loaded | Cause => {
    if (!locks.has(root)) locks.set(root, lockOf(root));
    return locks.get(root)!;
  };
  const ds: Decision[] = [];
  const importsOf = memoizedImports();
  for (const p of planned) ds.push(await preEdit(p, overlay, startedAt, load, importsOf));
  for (const root of [...new Set(planned.map((p) => findRoot(dirname(p.abs), enabled)).filter((r): r is string => r !== null))]) {
    ds.push(...await preDependencies(root, planned, overlay, startedAt, { contract: load(root), importsOf }));
  }
  return merge(ds);
}

async function preDependencies(root: string, planned: Planned[], overlay: Overlay, startedAt: number, admission: DependencyAdmission): Promise<Decision[]> {
  const { contract, importsOf } = admission;
  const c = planned.find((p) => within(root, p.abs))!.c;
  const sid = state.key(c.session);
  const loaded = verify(sid, root, contract);
  if (isCause(loaded)) return [];
  const changed = new Set(planned.filter((p) => within(root, p.abs)).map((p) => relative(root, p.abs)));
  if (!needsDependencyReview(loaded.lock, "pre", changed)) return [];
  const snap = state.ensureSnapshot(sid, root, null);
  if (isCause(snap)) return [];
  await grammars();
  const read = overlaid(root, overlay), before = snapshotReader(sid, snap);
  const primed = before.prime?.([...changed]);
  if (primed !== undefined) return [settle(
    { session: c.session, callId: c.callId, kind: "pre-edit", abs: join(root, [...changed][0]!), root, rel: [...changed][0]!, startedAt },
    { ...NOTHING, lock: loaded.lock, lockHash: loaded.hash, form: form(primed) },
  )];
  checkpoint("dependency-review");
  const reviews = importReviewProgress(dependencyRules(loaded.lock, "pre").map(rule => rule.id), () =>
    dependencyReviews(() => owned(root, workspacePaths(root), accepted(sid)), { lock: loaded.lock, phase: "pre", changed, read, before, now: clock, importsOf, cache: openDependencyCache(root), ...evaluationProgress(),
      identity: rel => relative(root, canonical(join(root, rel))) }));
  return reviews.filter((r) => r.form !== null || r.violations.length > 0).map((r) => settle(
    { session: c.session, callId: c.callId, kind: "pre-edit", abs: join(root, r.rel), root, rel: r.rel, startedAt },
    { ...NOTHING, lock: loaded.lock, lockHash: loaded.hash, introduced: r.violations, form: r.form, astHash: r.astHash, after: read(r.rel), before: r.form === null ? before(r.rel) : null },
  ));
}

async function contractEdit(planned: Planned[], overlay: Overlay, startedAt: number): Promise<Decision | null> {
  const roots = [...new Set(planned.map((p) => findRoot(dirname(p.abs), enabled)).filter((r): r is string => r !== null))];
  for (const root of roots) {
    const source = sourceDirs(readText(join(root, PRESET)) ?? "").map((d) => resolve(root, d));
    const targets = planned.filter((p) => pathKey(p.abs) === pathKey(join(root, PRESET)) || source.some((dir) => within(dir, p.abs)));
    if (targets.length === 0) continue;
    approvalDeadline();
    const c = targets[0]!.c;
    const call: Call = { session: c.session, kind: "pre-edit", callId: c.callId, abs: targets[0]!.abs, root, rel: null, startedAt };
    if (targets.length !== planned.length || targets.some((p) => p.r.status !== "exact" || p.c.from !== null)) return settle(call, PROTECTED);
    const key = pathKey(join(root, PRESET));
    const text = overlay.has(key) ? overlay.get(key)! : readText(join(root, PRESET));
    if (text === null) return settle(call, PROTECTED);
    await grammars();
    const baseSources = sourcesOf(root, true);
    const result = validateContract({ presetText: text, versions: VERSIONS, now: clock, filesOf: (s) => {
      if (s.kind !== "path") return baseSources(s);
      const dir = resolve(root, s.path);
      const files = existsSync(dir) ? readTree(dir, true) : {};
      for (const p of targets.filter((p) => within(dir, p.abs))) {
        const rel = relative(dir, p.abs);
        if (p.r.after === null) delete files[rel]; else files[rel] = p.r.after;
      }
      return files;
    } });
    if ("errors" in result) {
      const settled = settle(call, PROTECTED);
      const fix = settled.fix ?? causeFix("protected-path", ".pregate/preset.json", null, null);
      const full = `PREGATE: invalid contract change:\n${result.errors.join("\n")}\nFix: ${fix.text}`;
      return { ...settled, full, compact: `PREGATE: invalid contract change. Fix: ${fix.text}`.slice(0, 256), fix };
    }
    const before = lockOf(root);
    const diff = contractDiff(isCause(before) ? null : before.lock, result.lock, bundledBetween(readText(join(root, PRESET)), text));
    const writes = targets.map((p) => ({ path: p.abs, before: p.disk, after: p.r.after }));
    if (nativeApproval(c.session)) {
      pendingContract(root, result.text, targets.map((p) => ({ path: p.abs, after: p.r.after })));
      const full = `${diff.warning ? "WARNING: this may weaken protection.\n" : ""}Approve this validated PREGATE contract change?\n${diff.summary.join("\n")}\n${writes.map((w) => sourceDiff(relative(root, w.path), w.before, w.after)).join("\n\n")}`;
      return { ...told(null), verdict: "ask", contractApproval: true, full, compact: full, notice: full, fix: causeFix("approval", null, null, null) };
    }
    proposeContract({ root, lockText: result.text, baseline: state.sha256((readText(join(root, PRESET)) ?? "") + (readText(join(root, LOCK)) ?? "")), writes });
    const instruction = "PREGATE: review this pending contract inside your harness with `pregate approve --preview`, then follow the displayed human approval route (expires in 24 hours). The agent must not approve it itself.";
    const fix = causeFix("approval", null, null, null);
    return { ...settle(call, PROTECTED), full: `${instruction}\nFix: ${fix.text}`, compact: instruction, notice: instruction, fix };
  }
  return null;
}

function plan(c: ProposedChange, abs: string): Planned {
  const disk = readText(abs);
  const current = c.from === null ? disk : readText(canonical(c.from));
  return { c, abs, disk, current, r: apply(current, c.edit) };
}

async function preEdit(planned: Planned, overlay: Overlay, startedAt: number, load: (root: string) => Loaded | Cause, importsOf: ImportMemo): Promise<Decision> {
  const { c, abs, disk, current, r } = planned;
  const sid = state.key(c.session);
  const located = locate(sid, dirname(abs));
  const root = isCause(located) ? null : located;
  const rel = root === null ? null : relative(root, abs);
  const call: Call = { session: c.session, kind: "pre-edit", callId: c.callId, abs, root, rel, startedAt };
  if (isCause(located)) return settle(call, { ...NOTHING, form: locatedForm(sid, located, dirname(abs)) });
  // MH-17: a session that reached no root has only the machine's files guarded, and writes nothing.
  if (root === null && state.roots(sid).filter((r) => enabled(r)).length === 0) return told(null);
  const loaded = root === null ? null : load(root);
  if (root !== null) {
    const snap = state.ensureSnapshot(sid, root, null);
    if (isCause(snap)) return settle(call, { ...NOTHING, form: form(snap) });
  }
  const deleted = c.edit.form === "delete";
  if (rel !== null && !deleted && matches(REQUESTS, rel)) return request(call, r);
  if (protects(abs, globsOf(sid, root, loaded))) return settle(call, PROTECTED);
  if (!deleted && r.after !== null) {
    const control = scriptControlCause(abs, r.after);
    if (control !== null) return settle(call, { ...NOTHING, form: form(control) });
  }
  // No PREGATE root here: nothing to enforce.
  if (root === null || rel === null || loaded === null) return decide(inputOf(call, NOTHING));
  // MH-10: Stop judges what a delete leaves in the tree.
  if (deleted) return settle(call, NOTHING);
  return edit({ ...call, root, rel }, loaded, { disk, current, r }, overlaid(root, overlay), importsOf);
}

// §4.1 steps 6 to 15, for a path below an accepted root.
async function edit(call: Rooted, lockState: Loaded | Cause, f: Omit<Planned, "c" | "abs">, read: Read, importsOf: ImportMemo): Promise<Decision> {
  const sid = state.key(call.session);
  const loaded = verify(sid, call.root, lockState);
  if (isCause(loaded)) return settle(call, { ...NOTHING, form: form(loaded) });
  const known = { ...NOTHING, lock: loaded.lock, lockHash: loaded.hash };
  if (f.disk !== null && grammarOf(call.rel) !== null && loaded.lock.generatedMarkers.some(marker => f.disk!.includes(marker))) await grammars();
  const placed = placement(loaded.lock, "pre", call.rel, f.disk === null, f.disk);
  if (!inScope(loaded.lock, call.rel)) return settle(call, { ...known, introduced: placed, after: f.r.after });
  if (f.r.after === null) return settle(call, { ...known, form: form(f.r.status === "tool-will-fail" ? "tool-will-fail" : "cannot-reconstruct") });
  const snap = state.ensureSnapshot(sid, call.root, null);
  if (isCause(snap)) return settle(call, { ...known, form: form(snap) });
  const before = snapshotReader(sid, snap);
  await grammars();
  const memo = needsDependencyReview(loaded.lock, "pre", new Set([call.rel])) ? importsOf : undefined;
  const touched = usesPrimitive(loaded.lock, "adr-touch") ? worktreePaths(call.root) : undefined;
  let listed: readonly string[] | undefined;
  const list = () => listed ??= workspacePaths(call.root);
  const j = judge(loaded.lock, "pre", { rel: call.rel, base: f.current, before, after: f.r.after }, read, { beforeRead: before, importsOf: memo, list,
    changed: touched === undefined || touched === null ? undefined : [...new Set([...touched, call.rel])],
    commits: usesPrimitive(loaded.lock, "churn-ratchet") ? commitCounts(call.root) : undefined });
  return settle(call, { ...known, introduced: [...placed, ...j.violations], form: j.form, astHash: j.astHash, after: f.r.after, before: j.before ?? null });
}

// The agent may write a request and nothing else under .pregate/ (§4.1 step 5).
function request(call: Call, r: Planned["r"]): Decision {
  if (r.after === null) return settle(call, { ...NOTHING, form: form(r.status === "tool-will-fail" ? "tool-will-fail" : "cannot-reconstruct") });
  const valid = validate("request", json(r.after)).length === 0;
  return settle(call, { ...NOTHING, form: valid ? null : form("request-invalid"), after: r.after });
}

export function nativeApproval(session: Session): boolean {
  return !process.env.CI && session.agentId === null
    && session.harness === "claude-code" && session.interactive;
}
