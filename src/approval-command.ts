import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathKey, relativePath as relative } from "./paths.ts";
import { approvalRefusal, approve, discardProposal, proposeContract, readProposal, type Proposal } from "./approval.ts";
import { BUILTIN } from "./assets.ts";
import { enable } from "./consent.ts";
import { applyRequest, compile } from "./compile.ts";
import { bundledBetween, reviewDiff, sourceDiff, validateContract } from "./contract.ts";
import { readTree, writeAtomic } from "./disk.ts";
import { git, uncommittedPackFiles } from "./git.ts";
import { grammars, sourcesOf } from "./contract-diagnostic.ts";
import { clock, LOCK, PRESET, readText, VERSIONS, within } from "./inertia.ts";
import { recordApproval } from "./loosening.ts";
import { sha256 } from "./state.ts";
import { approvalCode, BATCH_STALE, batchItemError, batchReview, consentLine, currentProposal as current, digestMismatch, pendingBatch, pendingReview, presetGlobLines, proposalDiff, writeDiffs } from "./pending-review.ts";
import { discardBatch, engineLabel, engineStamp, type Batch } from "./proposal.ts";
export { pendingReview } from "./pending-review.ts";

type ReviewedResult = { code: number; text: string; discard?: boolean } | {
  proposal: Proposal;
  checked: Exclude<ReturnType<typeof validate>, { errors: string[] }>;
};

function validate(proposal: Proposal): ReturnType<typeof validateContract> {
  const preset = proposal.writes.find((w) => pathKey(w.path) === pathKey(join(proposal.root, PRESET)));
  const presetText = preset === undefined ? readText(join(proposal.root, PRESET)) : preset.after;
  return validateContract({ presetText: presetText ?? "", versions: VERSIONS, now: clock, filesOf: (source) => {
    if (source.kind === "builtin") return BUILTIN;
    if (source.kind === "git" || source.kind === "library") return sourcesOf(proposal.root, true)(source);
    const dir = resolve(proposal.root, source.path);
    const files = existsSync(dir) ? readTree(dir, true) : {};
    for (const w of proposal.writes.filter((w) => within(dir, w.path))) {
      const path = relative(dir, w.path);
      if (w.after === null) delete files[path]; else files[path] = w.after;
    }
    return files;
  } });
}

// `digest` is the full digest or its approval code (a prefix of at least 12 hex digits).
export async function approvePending(root: string, yes = false, digest?: string, commit = true): Promise<{ code: number; text: string }> {
  const proposal = readProposal(root);
  if (proposal === null) return { code: 1, text: "No pending contract change, or it expired. Ask the agent to propose it again." };
  if (digest !== undefined && !approvalCode(sha256(JSON.stringify(proposal)), digest)) return { code: 1, text: digestMismatch(root) };
  await grammars();
  const failed = unapprovable(proposal, validate(proposal));
  if (failed !== null) {
    if (failed.discard) discardProposal(root);
    return { code: 1, text: failed.text };
  }
  const diff = proposalDiff(proposal);
  if (!await approve([...writeDiffs(root, proposal.writes, false), ...diff.summary, ...presetGlobLines(root, proposal), consentLine(proposal)].join("\n"), diff.warning, yes)) return { code: 1, text: approvalRefusal() };
  return applyReviewedProposal(root, sha256(JSON.stringify(proposal)), { activate: proposal.activate !== false, commit });
}

// `approve <code>` for a batch `update --projects --preview` prepared, from any directory. Every
// project is revalidated against its exact reviewed proposal before any is written: one stale
// project at that point applies none. Each project is then applied and committed on its own, so
// one that changes during approval fails alone. null: the code names no pending batch.
export async function approveBatch(code: string, yes: boolean, commit: boolean): Promise<{ code: number; text: string } | null> {
  const batch = pendingBatch(code);
  if (batch === null) return null;
  const errors: string[] = [];
  for (const item of batch.items) {
    const error = batchItemError(item) ?? await revalidated(item);
    if (error !== null) errors.push(error);
  }
  if (errors.length > 0) return { code: 1, text: [...errors, BATCH_STALE].join("\n") };
  const review = batchReview(batch, false);
  if (!await approve(review.text, review.warning, yes)) return { code: 1, text: approvalRefusal() };
  const { lines, updated } = await applyReviews(batch.items, commit);
  discardBatch();
  return { code: updated === batch.items.length ? 0 : 1, text: [...lines, `${updated}/${batch.items.length} project contracts updated. Each project keeps its consent.`].join("\n") };
}

async function revalidated({ root, digest }: Batch["items"][number]): Promise<string | null> {
  const checked = await validateReviewedProposal(root, digest);
  return checked.code === 0 ? null : `${root}: ${checked.text.split("\n").at(-1)}`;
}

// Applies each reviewed proposal through the approve path, one line per project. A project that
// fails here (it changed after validation) is named; the others are kept.
export async function applyReviews(items: Batch["items"], commit: boolean): Promise<{ lines: string[]; updated: number }> {
  const lines: string[] = [];
  let updated = 0;
  for (const { root, digest } of items) {
    const result = await applyReviewedProposal(root, digest, { activate: false, commit });
    const [first = "", ...rest] = result.text.split("\n");
    lines.push(result.code === 0 ? `Updated ${root}: ${rest.join(" ") || first}` : `Failed ${root}: ${first}`);
    if (result.code === 0) updated++;
  }
  return { lines, updated };
}

// Internal coordinator operation after its bounded human review. This is deliberately
// not a CLI command: scripts and agents must still use the normal approval boundary.
export async function applyReviewedProposal(root: string, digest: string, options: { activate: boolean; commit?: boolean }): Promise<{ code: number; text: string }> {
  const ready = await reviewedProposal(root, digest);
  if ("code" in ready) {
    const pending = readProposal(root);
    if (ready.discard === true && pending !== null && sha256(JSON.stringify(pending)) === digest) discardProposal(root);
    return { code: ready.code, text: ready.text };
  }
  const { proposal, checked } = ready;
  if (options.activate !== (proposal.activate !== false)) return { code: 1, text: "Consent intent differs from the reviewed proposal; nothing applied. Prepare a new review with the intended activation choice." };
  for (const w of proposal.writes) {
    if (w.after === null) rmSync(w.path, { force: true });
    else { mkdirSync(dirname(w.path), { recursive: true }); writeAtomic(w.path, w.after); }
  }
  writeAtomic(join(root, LOCK), checked.text);
  recordApproval(root, checked.text);
  if (options.activate) enable(root);
  discardProposal(root);
  const settled = settleRequests(root, proposal.request);
  const written = [...proposal.writes.map((w) => w.path), join(root, LOCK), ...settled];
  return { code: 0, text: ["Approved contract applied and lock compiled.",
    ...settled.map((path) => `Removed request ${relative(root, path)}: it was applied or can no longer apply.`),
    ...(options.commit === false ? [] : committed(root, written, checked.lock.sourceDirs, checked.text, digest))].join("\n") };
}

// Path-kind rule sources are policy the lock was compiled from: they land in the same commit, or
// teammates get a stale lock. A pack that changed since validation stays out (its lock is stale,
// which fails closed); a folder outside the project cannot be committed here.
function committed(root: string, written: string[], dirs: string[], lockText: string, digest: string): string[] {
  const folders = dirs.map((dir) => resolve(root, dir));
  const inside = folders.filter((dir) => within(root, dir));
  const outside = folders.filter((dir) => !within(root, dir)).map((dir) => `Rule source ${relative(root, dir)} is outside this project; teammates need it at the same path.`);
  if (inside.length === 0) return [...commitContract(root, written, [], digest), ...outside];
  const now = compile(readText(join(root, PRESET)) ?? "", sourcesOf(root), VERSIONS);
  if ("errors" in now || now.text !== lockText) {
    return [...commitContract(root, written, [], digest), "Rule pack files changed after validation, so only the contract was committed; the lock is now stale. Run pregate guide --preview to review them.", ...outside];
  }
  return [...commitContract(root, written, inside, digest), ...outside];
}

// Requests are proposals, not history: the applied one and any whose patch no longer applies to
// the new preset are removed so the next update starts from a clean folder.
function settleRequests(root: string, applied: string | undefined): string[] {
  const dir = join(root, ".pregate/requests");
  if (!existsSync(dir)) return [];
  const preset = readText(join(root, PRESET)) ?? "";
  const stale = readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => join(dir, name))
    .filter((path) => pathKey(path) === pathKey(applied ?? "") || "errors" in applyRequest(preset, readFileSync(path, "utf8")));
  for (const path of stale) rmSync(path, { force: true });
  return stale;
}

// The approval lands as one commit of exactly the contract files it wrote and the rule pack folders
// it compiled from. Other staged or dirty work stays out of it; a repository that cannot commit now
// (merge, hook, signing) keeps the applied files and gets the command to finish by hand.
function commitContract(root: string, paths: string[], folders: string[], digest: string): string[] {
  if (git(root, ["rev-parse", "--is-inside-work-tree"])?.trim() !== "true") return ["Not a Git worktree: keep the preset and lock with the project."];
  const ignored = folders.map((dir) => relative(root, dir)).filter((rel) => git(root, ["check-ignore", "-q", "--", rel]) !== null);
  const packs = folders.map((dir) => relative(root, dir)).filter((rel) => !ignored.includes(rel) && existsSync(join(root, rel)));
  const rels = paths.map((path) => relative(root, path)).filter((rel) => existsSync(join(root, rel)) || git(root, ["ls-files", "--", rel])?.trim());
  const message = `chore: apply reviewed PREGATE contract ${digest.slice(0, 12)}`;
  const ok = (args: string[]) => Bun.spawnSync(["git", ...args], { cwd: root, stdin: "ignore", stdout: "ignore", stderr: "pipe", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, timeout: 120_000 }).exitCode === 0;
  const added = ok(["add", "-A", "--", ...rels, ...packs]);
  const all = [...rels, ...packs.filter((rel) => git(root, ["ls-files", "--", rel])?.trim())];
  if (added && ok(["commit", "--quiet", "--only", "-m", message, "--", ...all])) {
    // Relative to the project, not the repository top: a nested project groups by its own folders.
    const files = (git(root, ["show", "--name-only", "--relative", "--format=", "HEAD"]) ?? "").split("\n").filter(Boolean);
    const left = packs.filter((rel) => uncommittedPackFiles(root, rel).length > 0);
    return [`Committed ${files.length} file${files.length === 1 ? "" : "s"} (${committedAreas(files, packs).join(", ")}) as ${git(root, ["rev-parse", "--short", "HEAD"])?.trim()}.`,
      ...[...ignored, ...left].map((rel) => `Some files in ${rel} are not committed (ignored?); teammates get a stale lock until they are.`)];
  }
  const conclude = inProgress(root);
  if (conclude !== null) return [`Applied and staged but not committed: Git refuses a partial commit while a merge, rebase or cherry-pick is in progress. Conclude it with \`${conclude}\` to record the contract with it.`];
  return [`Applied but not committed. Commit it with: git add -A -- ${all.join(" ")} && git commit -m "${message}" -- ${all.join(" ")}`];
}

// The command that concludes the Git operation in progress, or null when none is.
function inProgress(root: string): string | null {
  const head = (ref: string) => git(root, ["rev-parse", "-q", "--verify", ref]) !== null;
  if (head("MERGE_HEAD")) return "git commit";
  if (head("CHERRY_PICK_HEAD")) return "git cherry-pick --continue";
  if (head("REVERT_HEAD")) return "git revert --continue";
  const dir = (name: string) => existsSync(git(root, ["rev-parse", "--path-format=absolute", "--git-path", name])?.trim() ?? "");
  return dir("rebase-merge") || dir("rebase-apply") ? "git rebase --continue" : null;
}

// The folders a commit touched, for one readable line instead of every file name.
function committedAreas(files: string[], packs: string[]): string[] {
  return [...new Set(files.map((file) => {
    const pack = packs.find((rel) => file.startsWith(`${rel}/`));
    return pack !== undefined ? `${pack}/` : file.includes("/") ? `${file.split("/")[0]}/` : file;
  }))];
}

export async function validateReviewedProposal(root: string, digest: string): Promise<{ code: number; text: string }> {
  const ready = await reviewedProposal(root, digest);
  return "code" in ready ? ready : { code: 0, text: "Reviewed proposal remains current; sources and fixtures validated. Nothing applied." };
}

async function reviewedProposal(root: string, digest: string): Promise<ReviewedResult> {
  const proposal = readProposal(root);
  if (proposal === null) return { code: 1, text: "No pending contract change, or it expired. Prepare a new preview; nothing applied." };
  if (sha256(JSON.stringify(proposal)) !== digest) return { code: 1, text: digestMismatch(root) };
  await grammars();
  const checked = validate(proposal);
  const failed = unapprovable(proposal, checked);
  if (failed !== null || "errors" in checked) return { code: 1, ...(failed ?? { text: STALE, discard: false }) };
  if (sha256(JSON.stringify(readProposal(root))) !== digest) {
    return { code: 1, text: "Pending contract changed or expired during approval; nothing applied." };
  }
  return { proposal, checked };
}

const STALE = "Pending contract is stale or invalid; its source or contract no longer matches the preview. Nothing applied. Run pregate guide --preview to prepare a fresh review.";

// Why a reviewed proposal cannot be applied now, or null. Only a provably stale one (its contract
// or proposed files changed, or the same engine compiles its sources to another lock) is discarded:
// an engine mismatch or a failing source keeps it, so the right engine or a fix can still approve it.
function unapprovable(proposal: Proposal, checked: ReturnType<typeof validate>): { text: string; discard: boolean } | null {
  if (!current(proposal)) return { text: STALE, discard: true };
  const errors = "errors" in checked ? checked.errors : [];
  if (errors.length === 0 && !("errors" in checked) && checked.text === proposal.lockText) return null;
  const mismatch = engineMismatch(proposal, errors);
  if (mismatch !== null) return { text: mismatch, discard: false };
  return errors.length > 0 ? { text: [...errors, STALE, "The pending review is kept."].join("\n"), discard: false } : { text: STALE, discard: true };
}

// Why this engine cannot validate a review that another engine prepared, or null when they agree.
// The compile errors name the exact bundled pack or engine pin the review requires.
export function engineMismatch(proposal: Proposal, errors: string[]): string | null {
  const here = engineStamp(), there = proposal.engine;
  const needs = errors.flatMap((error) => {
    const pack = /^sources: (\S+): bundled version does not match (\S+);/.exec(error);
    if (pack !== null) return [`it bundles ${pack[1]} ${here.packs[pack[1]!] ?? "(none)"}, the review requires ${pack[1]} ${pack[2]}`];
    const engine = /^engine (\S+) does not match this binary/.exec(error);
    return engine === null ? [] : [`the review requires engine ${engine[1]}`];
  });
  const differs = there !== undefined && (there.version !== here.version || there.source !== here.source || !equalPacks(there.packs, here.packs));
  if (needs.length === 0 && !differs) return null;
  return [`This engine (${engineLabel(here)}) cannot validate the pending review${there === undefined ? "" : ` prepared by engine ${engineLabel(there)}`}: ${needs.join("; ") || "their bundled packs or checkers differ"}.`,
    "Approve with the engine that prepared it, or update this engine first (pregate update). The pending review is kept; nothing applied."].join("\n");
}

function equalPacks(a: Record<string, string>, b: Record<string, string>): boolean {
  return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([ns, v]) => b[ns] === v);
}

// `stable`: an identical rerun of this preview keeps the pending code (see proposeContract).
type ApplyMode = { yes?: boolean; preview?: boolean; activate?: boolean; request?: string; stable?: boolean };

export async function applyPreset(root: string, text: string, mode: ApplyMode = {}): Promise<{ code: number; text: string }> {
  const { yes = false, preview = false, activate = false, request, stable = false } = mode;
  const before = readText(join(root, PRESET));
  const baseline = sha256((before ?? "") + (readText(join(root, LOCK)) ?? ""));
  const result = validateContract({ presetText: text, filesOf: sourcesOf(root, true), versions: VERSIONS, now: clock });
  if ("errors" in result) return { code: 1, text: [...result.errors, "Request not applied."].join("\n") };
  if (preview) {
    if (baseline !== sha256((readText(join(root, PRESET)) ?? "") + (readText(join(root, LOCK)) ?? ""))) return { code: 1, text: "Contract changed during request preview; nothing applied. Review the new proposal." };
    const proposal = proposeContract({ root, baseline, lockText: result.text, activate, ...(request === undefined ? {} : { request }), writes: [{ path: join(root, PRESET), before, after: text }] }, stable);
    return pendingReview(root, sha256(JSON.stringify(proposal)));
  }
  const diff = reviewDiff(readText(join(root, LOCK)), result.lock, bundledBetween(before, text));
  if (!await approve(`Update ${PRESET} in ${root}.\n${diff.summary.join("\n")}\n${sourceDiff(PRESET, readText(join(root, PRESET)), text)}`, diff.warning, yes)) return { code: 1, text: "Human approval unavailable or rejected; request not applied." };
  const checked = validateContract({ presetText: text, filesOf: sourcesOf(root, true), versions: VERSIONS, now: clock });
  if (baseline !== sha256((readText(join(root, PRESET)) ?? "") + (readText(join(root, LOCK)) ?? "")) || "errors" in checked || checked.text !== result.text) {
    return { code: 1, text: "Contract or sources changed during approval; nothing applied. Review the new proposal." };
  }
  writeAtomic(join(root, PRESET), text);
  writeAtomic(join(root, LOCK), result.text);
  recordApproval(root, result.text);
  return { code: 0, text: `${PRESET} updated and ${LOCK} written (${result.lock.rules.length} rules); commit it.` };
}
