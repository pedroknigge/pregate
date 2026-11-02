import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { approve, humanApprovalInstructions, PENDING_MS } from "./approval.ts";
import { dataHome, enabled } from "./consent.ts";
import { pathLabel, sourceDiff, visible } from "./contract.ts";
import { diagnosticNotice, evaluationProgress, form, grammars, inputOf, lockOf, recordedChecks, turnOf, verify } from "./contract-diagnostic.ts";
import { blocking, decide } from "./decide.ts";
import { dependencyReviews, dependencyRules, needsDependencyReview } from "./dependencies.ts";
import { openDependencyCache } from "./dependency-cache.ts";
import { canonical, findRoot, writeAtomic } from "./disk.ts";
import { ruleEnforcements } from "./enforcement.ts";
import { fitnessViolations, projectFitness } from "./fitness-command.ts";
import { catFileBatch, git, gitInput } from "./git.ts";
import { type Call, clock, isCause, LOCK, NOTHING, PRESET, readText, told, VERSIONS, within } from "./inertia.ts";
import { violationMessage } from "./message.ts";
import { pathKey, relativePath as relative } from "./paths.ts";
import { checkpoint, importReviewProgress, stopRootProgress } from "./progress.ts";
import { review } from "./recorded.ts";
import * as state from "./state.ts";
import { beforeTexts, H, sessionDir, sha256, snapshot } from "./state.ts";
import { lockPrune } from "./state-lease.ts";
import { approvedLocally, loosening } from "./loosening.ts";
import { contractState } from "./status.ts";
import { accepted, arrivedWithHead, owned, reader, snapshotReader, stopFiles, workspacePaths } from "./workspace.ts";
import type { CallEvent, Decision, DecideInput, Form, HookEvent, Lock, Session, Snapshot, Violation } from "./types.ts";

// A file of a summarized review: status, line counts, size after (or before, if deleted) and
// the SHA-256 of both sides, so the digest binds the full content without printing it.
interface Change { path: string; status: "A" | "M" | "D"; added: number; removed: number; bytes: number; before: string | null; after: string | null }
interface RebaseReview {
  root: string; session: string; head: string; at: number; originalHash: string; previousHash: string; lockHash: string; diff: string;
  base?: string | null; changes?: Change[]; arrived?: string[]; opaque?: string[];
}
interface RootResult {
  root: string; rel: string | null; lock: Lock | null; lockHash: string | null; form: Form | null;
  introduced: Violation[]; approved: Violation[];
}
interface StopControl { turn: string; reentry: boolean; skipped: string[]; deadline: number }
type StopScope = { agent: boolean; roots: (root: string) => boolean; files: (abs: string) => boolean };

// Below the supervisor's 45 s Stop limit, so an unfinished fan-out ends as a recorded incomplete Stop.
export const STOP_BUDGET_MS = 30_000;
const USAGE = "usage: pregate session rebase <harness:session-id> --preview | rebase <harness:session-id> --digest <sha256> [--yes]";

// Full diffs up to this size are shown; above it the review lists each file and the digest
// binds every file's content. Content past the ceiling is refused by size before it is read.
const REVIEW_BYTES = 8 * 1024 * 1024, BASELINE_BYTES = 128 * 1024 * 1024, LISTED = 200;
// Deleted files and test changes are listed first and never cut by the cap: weakening hides there.
const TEST_PATH = /(^|\/)(__tests__|tests?|specs?|e2e)(\/|$)|[._-](test|spec)s?\.[^/]+$|(^|\/)test_[^/]+$/;

// Files that arrived from a base that existed at the snapshot are not the session's (Stop does not
// judge them), so a routine catch-up reviews only what the session answers for.
function reviewBaseline(root: string, session: string, at: number): RebaseReview {
  const dir = join(sessionDir(session), H(root));
  const saved = snapshot(session, root);
  if (saved === null || saved === "missing") throw new Error("No retained baseline for this session and project. Inspect pregate report --json.");
  const head = git(root, ["rev-parse", "--verify", "HEAD"])?.trim();
  if (!head || git(root, ["status", "--porcelain=v1", "--untracked-files=all"]) !== "") throw new Error("Rebase needs a committed, clean worktree. Review and commit the merge first; uncommitted changes remain protected.");
  if (!contractState(root).valid) throw new Error("Update or repair the project contract before reviewing its session baseline.");
  const listed = git(root, saved.head ? ["diff", "--name-only", "--no-renames", "--relative", "-z", saved.head, head, "--", "."] : ["ls-files", "-z", "--", "."]);
  if (listed === null) throw new Error("Cannot compare the retained baseline with HEAD.");
  const arrived = [...arrivedWithHead(session, saved)].sort(), skip = new Set(arrived);
  const paths = [...new Set([...listed.split("\0").filter(Boolean), ...Object.keys(saved.dirty)])].filter(path => !skip.has(path)).sort();
  if (contentBytes(root, session, saved, head, paths) > BASELINE_BYTES) throw new Error("Baseline content exceeds 128 MiB. Rebase in smaller committed steps.");
  const before = beforeTexts(session, saved, paths), after = catFileBatch(root, paths.map(path => `${head}:./${path}`));
  if (typeof before === "string" || after === null) throw new Error("Cannot read complete baseline changes; nothing rebased.");
  const sides = paths.map((path, i) => [before[path] ?? null, after[i] ?? null] as const);
  const diffs = paths.map((path, i) => sourceDiff(path, ...sides[i]!));
  const diff = diffs.filter(Boolean).join("\n"), large = Buffer.byteLength(diff) > REVIEW_BYTES;
  // Git saw a committed change the text does not show: a file mode, a symlink or bytes that do not decode.
  const opaque = paths.filter((path, i) => diffs[i] === "" && !Object.hasOwn(saved.dirty, path));
  return { root, session, head, at, originalHash: sha256(readFileSync(join(dir, "snapshot.json"), "utf8")),
    previousHash: sha256(readText(join(dir, "reviewed-baseline.json")) ?? ""), lockHash: sha256(readFileSync(join(root, LOCK), "utf8")),
    ...arrived.length ? { arrived } : {}, ...opaque.length ? { opaque } : {},
    ...large ? { diff: "", base: saved.head, changes: changes(paths, sides, diffs) } : { diff } };
}

// Both sides' sizes from git and the session's blob copies, before any content is read.
function contentBytes(root: string, session: string, saved: Snapshot, head: string, paths: string[]): number {
  if (paths.some(path => path.includes("\n"))) throw new Error("Cannot read complete baseline changes; nothing rebased.");
  const committed = saved.head ? paths.filter(path => !Object.hasOwn(saved.dirty, path)).map(path => `${saved.head}:./${path}`) : [];
  const sizes = gitInput(root, ["cat-file", "--batch-check=%(objectsize)"], [...paths.map(path => `${head}:./${path}`), ...committed].map(obj => obj + "\n").join(""));
  if (sizes === null) throw new Error("Cannot read complete baseline changes; nothing rebased.");
  const blobs = paths.flatMap(path => saved.dirty[path] ? [join(sessionDir(session), "blobs", saved.dirty[path])] : []);
  return sizes.split("\n").reduce((n, line) => n + (/^\d+$/.test(line) ? Number(line) : 0), 0)
    + blobs.reduce((n, blob) => n + (existsSync(blob) ? statSync(blob).size : 0), 0);
}

function changes(paths: string[], sides: (readonly [string | null, string | null])[], diffs: string[]): Change[] {
  return paths.flatMap((path, i) => {
    if (diffs[i] === "") return [];
    // A whole-file side counts its final newline's empty element; git does not count it as a line.
    const [old, next] = sides[i]!, lines = diffs[i]!.split("\n").slice(3), whole = (text: string | null, other: string | null) => other === null && text?.endsWith("\n") ? 1 : 0;
    return [{ path, status: old === null ? "A" : next === null ? "D" : "M", added: lines.filter(line => line.startsWith("+")).length - whole(next, old),
      removed: lines.filter(line => line.startsWith("-")).length - whole(old, next), bytes: Buffer.byteLength(next ?? old ?? ""),
      before: old === null ? null : sha256(old), after: next === null ? null : sha256(next) }];
  });
}

function summary(plan: RebaseReview, digest: string): string {
  return visible([`Review the session baseline for ${plan.root}.`, `Session: ${plan.session}. New baseline: ${plan.head}.`,
    "Approval treats this committed tree as existing debt. This does not prove authorship, fix violations or change the rules. Original snapshots and events remain.",
    ...plan.changes ? summarized(plan, digest) : [plan.diff || "No source content changes from the retained baseline."], ...notes(plan, digest), `Digest: ${digest}`,
    ...humanApprovalInstructions(`pregate session rebase ${plan.session} --digest ${digest} --yes`)].join("\n"));
}

function summarized(plan: RebaseReview, digest: string): string[] {
  const all = plan.changes!, count = (status: Change["status"]) => all.filter(c => c.status === status).length;
  const base = plan.base ?? "$(git hash-object -t tree /dev/null)", line = (c: Change) => `${c.status} ${pathLabel(c.path)} +${c.added} -${c.removed} ${c.bytes} bytes`;
  const flagged = [...all.filter(c => c.status === "D"), ...all.filter(c => c.status !== "D" && TEST_PATH.test(c.path))];
  const rest = all.filter(c => c.status !== "D" && !TEST_PATH.test(c.path));
  return [`Full diffs exceed the 8 MiB review limit and are summarized: ${all.length} files (${count("A")} added, ${count("M")} modified, ${count("D")} deleted), +${all.reduce((n, c) => n + c.added, 0)} -${all.reduce((n, c) => n + c.removed, 0)} lines.`,
    `The digest binds the full content: commit ${plan.head} and the SHA-256 of both sides of every file, recorded in ${draftPath(digest)}.`,
    `Inspect the full diffs before approving: git -C '${plan.root.replace(/'/g, "'\\''")}' diff ${base} ${plan.head} -- . (a file dirty at session start is compared with its session-start copy instead).`,
    ...flagged.length ? [`Deleted files and test changes (${flagged.length}, all listed):`, ...flagged.map(line), "Other changes:"] : [],
    ...rest.slice(0, LISTED).map(line), ...rest.length > LISTED ? [`...and ${rest.length - LISTED} more files, listed in the draft.`] : []];
}

// What becomes baseline without a text diff: files that arrived from commits that existed at
// session start, and committed changes no text shows.
function notes(plan: RebaseReview, digest: string): string[] {
  const opaque = plan.opaque ?? [], arrived = plan.arrived?.length ?? 0;
  return [...opaque.length ? [`Changed with no text difference (file mode, symlink or binary bytes): ${opaque.slice(0, LISTED).map(pathLabel).join(", ")}${opaque.length > LISTED ? ` and ${opaque.length - LISTED} more` : ""}.`] : [],
    ...arrived ? [`${arrived} files that arrived from commits that existed at session start are not shown and become part of this baseline; listed in ${draftPath(digest)}.`] : []];
}

function draftPath(digest: string): string {
  return join(dataHome(), "session-drafts", digest + ".json");
}

export async function sessionCommand(args: string[]): Promise<{ code: number; text: string }> {
  const [action, session, ...flags] = args;
  if (action !== "rebase" || !session || !/^[\w-][\w.:-]*$/.test(session)) return { code: 1, text: USAGE };
  const root = findRoot(canonical(process.cwd()), () => true);
  if (!root) return { code: 1, text: "Session rebasing requires a project contract." };
  return rebaseSession(root, session, flags);
}

async function rebaseSession(root: string, session: string, flags: string[]): Promise<{ code: number; text: string }> {
  try {
    await grammars();
    if (flags.length === 1 && flags[0] === "--preview") {
      const plan = reviewBaseline(root, session, Date.now()), text = JSON.stringify(plan), digest = sha256(text);
      mkdirSync(join(dataHome(), "session-drafts"), { recursive: true });
      writeAtomic(draftPath(digest), text);
      return { code: 0, text: summary(plan, digest) };
    }
    const [flag, digest, yes] = flags;
    if (flag !== "--digest" || !digest || !/^[0-9a-f]{64}$/.test(digest) || flags.length > 3 || (yes !== undefined && yes !== "--yes")) return { code: 1, text: USAGE };
    const text = readFileSync(join(dataHome(), "session-drafts", digest + ".json"), "utf8");
    const plan = JSON.parse(text) as RebaseReview, age = Date.now() - plan.at;
    if (sha256(text) !== digest || plan.root !== root || plan.session !== session || !Number.isFinite(age) || age < 0 || age > PENDING_MS
      || JSON.stringify(reviewBaseline(root, session, plan.at)) !== text) throw new Error("Baseline review changed or expired. Prepare a new preview.");
    if (!await approve(summary(plan, digest), true, yes === "--yes")) return { code: 1, text: "Baseline not approved; nothing rebased." };
    applyBaseline(lockPrune(sessionDir(session)), plan, text, digest);
    return { code: 0, text: "Reviewed session baseline applied. Original history is retained; new changes are checked against this commit. Run pregate audit to see existing debt." };
  } catch (error) { return { code: 1, text: visible(`Session baseline unchanged: ${(error as Error).message}`) }; }
}

// The caller verified that the plan names this root and session.
function applyBaseline(release: () => void, plan: RebaseReview, text: string, digest: string): void {
  try {
    if (JSON.stringify(reviewBaseline(plan.root, plan.session, plan.at)) !== text) throw new Error("Project or session changed during approval. Prepare a new preview.");
    const dir = join(sessionDir(plan.session), H(plan.root));
    const baseline = JSON.stringify({ root: plan.root, head: plan.head, snapshotHash: plan.originalHash, digest, at: Date.now() });
    const history = join(dir, "baseline-reviews"); mkdirSync(history, { recursive: true });
    writeAtomic(join(history, digest + ".json"), text);
    writeAtomic(join(dir, "reviewed-baseline.json"), baseline);
  } finally { release(); }
}

// ── Stop hook (§4.3) ──────────────────────────────────────────────────────────────

// §4.3: every root the session touched, against its snapshot, one at a time within the budget.
// One Stop output, so the first root with something blocking decides and ends the walk; the
// others are seen by the next Stop, pre-commit and CI. A session that reached no root has nothing
// to judge, and Stop writes nothing (MH-17).
export async function onStop(e: Extract<HookEvent, { kind: "stop" }>, budgetMs = STOP_BUDGET_MS): Promise<Decision> {
  const startedAt = clock();
  const sid = state.key(e.session);
  const agentH = e.session.agentId === null ? "-" : state.H(e.session.agentId);
  const scope = stopScope(sid, e.session);
  // A removed worktree leaves nothing to judge; its consent record may outlive it.
  const live = state.roots(sid).filter((r) => existsSync(r) && scope.roots(r));
  const roots = live.filter((r) => enabled(r));
  const lost = consentLost(live.filter((r) => !enabled(r)));
  if (roots.length === 0) return told(lost);
  // Cursor's Stop followups each get a new generation_id; they still belong to the blocked turn.
  const turn = turnOf(e.session.harness === "cursor" ? { ...e.session, turnId: null } : e.session);
  await grammars();
  const priorStops = state.history(sid, agentH, "stop"), deadline = startedAt + budgetMs;
  const order = stopOrder(sid, roots, turn, e.cwd, priorStops.at(-1)?.stopSkipped ?? []);
  const { results, skipped } = judgeRoots(sid, order, scope, deadline);
  const chosen = results.find(rootBlocks)
    ?? results.find((r) => r.introduced.length > 0 || r.approved.length > 0) ?? results[0];
  const call: Call = { session: e.session, kind: "stop", callId: "stop", abs: null, root: chosen?.root ?? null, rel: chosen?.rel ?? null, startedAt };
  const stopped = stopDecision(call, results, chosen, priorStops, { turn, reentry: e.reentry, skipped, deadline });
  const { input, fingerprint } = stopped;
  const d = stopped.decision;
  const failed = state.record(sid, {
    at: Date.now(), versions: VERSIONS, callId: "stop", turn, agentId: e.session.agentId, kind: "stop", path: null, verdict: d.verdict, halted: d.halt,
    evaluationMs: clock() - startedAt,
    form: d.cause, shadowed: d.shadowed, violations: (chosen?.introduced ?? []).filter((v) => v.severity !== "warn"),
    ruleChecks: recordedChecks(chosen?.lock ?? null, chosen?.introduced ?? []),
    ...(d.stopIncomplete === undefined ? {} : { stopIncomplete: d.stopIncomplete }),
    ...(fingerprint === undefined ? {} : { stopFingerprint: fingerprint }),
    ...(skipped.length === 0 ? {} : { stopSkipped: skipped }),
    message: d.notice ?? (d.compact || d.full.split("\n")[0] || ""),
    messages: chosen?.lock === null || chosen?.lock === undefined ? []
      : (chosen.introduced ?? []).filter((v) => v.severity !== "warn").map((v) => violationMessage(v, chosen.lock!)),
    warnings: (chosen?.introduced ?? []).filter((v) => v.severity === "warn"),
    warningMessages: chosen?.lock === null || chosen?.lock === undefined ? []
      : (chosen.introduced ?? []).filter((v) => v.severity === "warn").map((v) => violationMessage(v, chosen.lock!)),
    root: chosen?.root ?? null, enforcement: ruleEnforcements(chosen?.lock ?? null),
    afterSha: null, astHash: null,
  }, null);
  const decided = failed === undefined ? d : decide({ ...input, form: form(failed) });
  return lost === null ? decided : { ...decided, notice: [decided.notice, lost].filter(Boolean).join("\n\n") };
}

// A root this session reached while it was enabled, whose consent is now disabled or gone. A human
// can do that on purpose; so can a script the agent ran. Either way nothing is judged there now.
function consentLost(roots: string[]): string | null {
  if (roots.length === 0) return null;
  return `PREGATE WARNING: consent for ${roots.join(", ")} was disabled or removed during this session, so PREGATE no longer judges ${roots.length === 1 ? "it" : "them"}. `
    + "If you did not run pregate disable, a command or script did: inspect pregate status, re-enable with pregate enable in a terminal, and review the changes made since.";
}

function stopDecision(call: Call, results: RootResult[], chosen: RootResult | undefined, priorStops: CallEvent[], stop: StopControl): {
  input: DecideInput; decision: Decision; fingerprint: string | undefined;
} {
  const sid = state.key(call.session);
  const pending = results.some(rootBlocks);
  const fingerprint = pending ? stopFingerprint(sid, results, stop.deadline) : undefined;
  const repeated = fingerprint === undefined ? [] : priorStops.slice(priorStops.findLastIndex(event => event.stopFingerprint !== fingerprint) + 1);
  const repeatedBlocks = repeated.filter(event => event.verdict === "deny").length;
  const input: DecideInput = {
    ...inputOf(call, { ...NOTHING, ...chosen }),
    stop: { blocks: Math.max(state.stopBlocks(sid, state.H(stop.turn), call.session.agentId === null ? "-" : state.H(call.session.agentId)), repeatedBlocks), reentry: stop.reentry, approved: chosen?.approved ?? [] },
  };
  let decision = diagnosticNotice(decide(input), input);
  if (decision.stopIncomplete && repeated.at(-1)?.stopIncomplete) decision = { ...decision, full: "", compact: "",
    notice: "PREGATE INCOMPLETE: unchanged Stop findings. Inspect pregate report --json; run pregate check --all or review a session rebase after a committed merge. Protection stays active." };
  if (stop.skipped.length > 0) decision = { ...decision, stopIncomplete: decision.stopIncomplete ?? { reason: "budget", cause: null },
    notice: [decision.notice, budgetNotice(stop.skipped)].filter(Boolean).join("\n\n") };
  return { input, decision, fingerprint };
}

function budgetNotice(skipped: string[]): string {
  const shown = skipped.slice(0, 5).join(", ") + (skipped.length > 5 ? `, and ${skipped.length - 5} more` : "");
  return `PREGATE INCOMPLETE: Stop time budget reached. ${skipped.length} root${skipped.length === 1 ? "" : "s"} not judged this Stop: ${shown}; `
    + "pre-commit and CI still judge them, and the next Stop starts with them; to judge one now, run pregate check --all in it. Protection stays active.";
}

// Judge roots in order until one blocks. Once the deadline passes, the rest are returned unjudged;
// the first root is always judged, so a Stop never releases without evaluating anything.
function judgeRoots(sid: string, roots: string[], scope: StopScope, deadline: number): { results: RootResult[]; skipped: string[] } {
  const results: RootResult[] = [];
  for (const [i, root] of roots.entries()) {
    if (i > 0 && clock() >= deadline) return { results, skipped: roots.slice(i) };
    stopRootProgress(i + 1, roots.length, root);
    const result = stopRoot(sid, root, scope);
    results.push(result);
    if (rootBlocks(result)) break;
  }
  return { results, skipped: [] };
}

// The roots this turn's edits reached first, then the checkout the agent runs in, then the roots
// the previous Stop left unjudged (so a fan-out larger than one budget still rotates through every
// root), then the rest in their stable order. A path belongs to the deepest root holding it, so a
// nested worktree does not promote the checkout around it.
function stopOrder(sid: string, roots: string[], turn: string, cwd: string, carried: string[]): string[] {
  const owner = (abs: string) => roots.filter((root) => within(root, abs)).sort((a, b) => b.length - a.length)[0];
  const touched = new Set(state.turnPaths(sid, state.H(turn)).map(owner));
  const here = owner(canonical(cwd));
  const rank = (root: string) => touched.has(root) ? 0 : root === here ? 1 : 2;
  const rotated = [...carried.filter((root) => roots.includes(root)), ...roots.filter((root) => !carried.includes(root))];
  return rotated.sort((a, b) => rank(a) - rank(b));
}

function rootBlocks(result: RootResult): boolean {
  if (result.lock === null) return result.form !== null;
  const kept = blocking(result.lock, result.introduced, result.form?.cause ?? null, { rel: result.rel, phase: "stop" });
  return kept.cause !== null || kept.violations.length > 0;
}

// A new turn alone is not progress. Hash admitted tree/context bytes, every judged root's
// contract and results; any changed input restarts the bounded blocking sequence.
// Oversized trees, and a hash that would outrun the Stop budget, keep the ordinary per-turn
// behavior instead of an unproven shortcut.
function stopFingerprint(sid: string, results: RootResult[], deadline: number): string | undefined {
  let bytes = 0;
  const identities = [];
  for (const result of results) {
    const paths = owned(result.root, workspacePaths(result.root, () => true), accepted(sid));
    const files = [];
    for (const rel of paths) {
      const path = join(result.root, rel);
      if (existsSync(path)) bytes += statSync(path).size;
      if (bytes > 128 * 1024 * 1024 || clock() >= deadline) return undefined;
      const content = existsSync(path) ? readFileSync(path) : null;
      files.push([rel, content === null ? null : state.sha256(content)]);
    }
    identities.push({ root: result.root, snapshot: state.snapshot(sid, result.root), preset: readText(join(result.root, PRESET)),
      lock: readText(join(result.root, LOCK)), files, form: result.form, violations: result.introduced, approved: result.approved });
  }
  return state.sha256(JSON.stringify(identities));
}

// Claude Code checks a subagent at its own SubagentStop, on the files it edited. The parent's Stop
// leaves out files a subagent is still editing, so a background agent's unfinished work never
// blocks the parent; once that agent is released, its files are the parent's again.
function stopScope(sid: string, session: Session): StopScope {
  if (session.harness !== "claude-code") return { agent: false, roots: () => true, files: () => true };
  const agents = state.agentEdits(sid);
  if (session.agentId !== null) {
    const mine = agents.get(state.H(session.agentId))?.paths ?? new Set<string>();
    return { agent: true, roots: (root) => [...mine].some((path) => within(root, path)), files: (abs) => mine.has(pathKey(abs)) };
  }
  const busy = new Set([...agents.values()].filter((a) => !a.finished).flatMap((a) => [...a.paths]));
  return { agent: false, roots: () => true, files: (abs) => !busy.has(pathKey(abs)) };
}

function stopRoot(sid: string, root: string, scope: StopScope): RootResult {
  const none: RootResult = { root, rel: null, lock: null, lockHash: null, form: null, introduced: [], approved: [] };
  const snap = state.snapshot(sid, root);
  if (snap === null || snap === "missing") return { ...none, form: form("snapshot-missing") };
  const loaded = verify(sid, root, lockOf(root));
  if (isCause(loaded)) return { ...none, form: form(loaded) };
  // Project fitness belongs to the turn, not to one subagent's files.
  const fitness = scope.agent ? null : projectFitness(root, loaded.lock, "stop");
  const known = { ...none, lock: loaded.lock, lockHash: loaded.hash };
  const loosened = sessionLoosening(sid, root, snap, loaded);
  if (loosened !== null) return { ...known, form: loosened };
  if (fitness !== null) known.introduced.push(...fitnessViolations(loaded.lock, fitness));
  checkpoint("stop-inventory");
  const all = stopFiles(sid, snap);
  if (isCause(all)) return { ...known, form: form(all) };
  const files = all.filter((f) => scope.files(join(root, f.rel)));
  const read = reader(root);
  const before = snapshotReader(sid, snap);
  // Only this root's exact admitted contract pair is exempt from source rules. lockOf/verify
  // above still reject tampering; other files under .pregate keep their placement checks.
  const reviews = files.filter((f) => f.rel !== PRESET && f.rel !== LOCK)
    .map((f) => ({ rel: f.rel, ...review(loaded.lock, "stop", f, read, before) }));
  const changedFiles = new Set(files.map((f) => f.rel));
  if (needsDependencyReview(loaded.lock, "stop", changedFiles)) {
    checkpoint("dependency-review");
    reviews.push(...importReviewProgress(dependencyRules(loaded.lock, "stop").map(rule => rule.id), () =>
      dependencyReviews(() => owned(root, workspacePaths(root), accepted(sid)), { lock: loaded.lock, phase: "stop", changed: changedFiles, read, before, now: clock, cache: openDependencyCache(root), ...evaluationProgress(),
        identity: rel => relative(root, canonical(join(root, rel))) })));
  }
  let muted: Pick<RootResult, "rel" | "form"> | null = null;
  for (const r of reviews) {
    const f = { rel: r.rel, after: read(r.rel) };
    if (r.form !== null) {
      if (blocking(loaded.lock, [], r.form.cause, { rel: f.rel, phase: "stop" }).cause !== null) return { ...known, rel: f.rel, form: r.form };
      muted ??= { rel: f.rel, form: r.form };
    }
    const asked = f.after === null ? [] : askedFor(sid, join(root, f.rel), f.after);
    for (const v of r.violations) (v.severity === "ask" && asked.includes(v.rule) ? known.approved : known.introduced).push(v);
  }
  return rootBlocks(known) ? known : { ...known, ...muted };
}

// The contract the session started with, loosened since without a human approval recorded on
// this machine: a script can rewrite the preset and recompile the lock without any hook seeing it.
function sessionLoosening(sid: string, root: string, snap: Snapshot, loaded: { lock: Lock; hash: string }): Form | null {
  const lockText = state.beforeText(sid, snap, LOCK), presetText = state.beforeText(sid, snap, PRESET);
  if (isCause(lockText)) return form(lockText);
  if (isCause(presetText)) return form(presetText);
  const found = loosening({ lockText, presetText }, { ...loaded, presetText: readText(join(root, PRESET)) });
  if (found === null || approvedLocally(root, loaded.hash)) return null;
  return { cause: "contract-loosened", line: null, detail: found.lines.join("\n") };
}

// §4.3 step 3: the rules the human approved through an ask whose result is exactly the file on disk.
function askedFor(sid: string, abs: string, after: string): string[] {
  const sha = state.sha256(after);
  return state.history(sid, "-", state.H(pathKey(abs)))
    .filter((e) => e.verdict === "ask" && e.afterSha === sha)
    .flatMap((e) => e.violations.map((v) => v.rule));
}
