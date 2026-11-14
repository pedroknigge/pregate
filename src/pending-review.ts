import { join } from "node:path";
import { engineLabel, readBatch, readProposal, type Batch, type Proposal } from "./proposal.ts";
import { launcherVersion } from "./admission.ts";
import { dataHome } from "./consent.ts";
import { bundledBetween, reviewDiff, sourceDiff, type ContractDiff } from "./contract.ts";
import { readFileSync } from "node:fs";
import { pathKey, relativePath } from "./paths.ts";

const PRESET_PATH = ".pregate/preset.json";
const COMPACT_DIFF_LINES = 80;
import { sha256 } from "./state.ts";
import { humanApprovalInstructions } from "./approval.ts";
import { listedPaths } from "./workspace.ts";
import { deadGlobLines } from "./onboard.ts";
import type { Preset } from "./types.ts";

function text(path: string): string | null {
  try { return readFileSync(path, "utf8"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
}

export function currentProposal(proposal: Proposal): boolean {
  return proposal.baseline === sha256((text(join(proposal.root, ".pregate/preset.json")) ?? "") + (text(join(proposal.root, ".pregate/pregate.lock.json")) ?? ""))
    && proposal.writes.every((w) => text(w.path) === w.before);
}

export { pendingRoot } from "./proposal.ts";

// The approval code a human types is the digest or a prefix of it long enough that no agent can
// grind a different proposal to match it inside the review window.
export function approvalCode(digest: string, code: string): boolean {
  return /^[0-9a-f]{12,64}$/.test(code) && digest.startsWith(code);
}

export function digestMismatch(root: string): string {
  return `The supplied digest does not match the current pending proposal; nothing applied. Run pregate approve --preview from ${root} to review its current digest.`;
}

// The digest binds the full proposal; only the readable text is compact. Compact reviews keep the
// WARNING, the whole preset diff, every written path and every explicit loosening or removal.
// `globs`: list the project for dead-glob warnings; the PreToolUse gate passes false to stay fast.
export function pendingReview(root: string, digest?: string, full = false, globs = true): { code: number; text: string } {
  const proposal = readProposal(root);
  if (proposal === null) throw new Error("No pending contract change, or it expired. Run pregate guide --preview to prepare a fresh review.");
  if (!currentProposal(proposal)) throw new Error("The contract or proposed files changed since preview. Nothing applied. Run pregate guide --preview to prepare a fresh review.");
  const id = sha256(JSON.stringify(proposal));
  if (digest !== undefined && !approvalCode(id, digest)) throw new Error(digestMismatch(root));
  return { code: 0, text: [...reviewLines(root, proposal, full, globs),
    ...(proposal.replaced === undefined ? [] : [`This review replaces the earlier pending proposal ${proposal.replaced}; that code no longer approves anything.`]),
    "Pending human review. The active contract still applies.",
    `Digest: ${id}`, ...humanApprovalInstructions(`pregate approve ${id.slice(0, 12)}`), ...engineNote(proposal),
    ...(full ? [] : ["Full per-rule and file detail: pregate approve --preview --full"]),
    "Agent next step: show this review to the user and wait for approval. Preserve the proposed files."].join("\n") };
}

// A review prepared by another engine than the installed launcher runs (a source checkout, another
// version) may not validate under `pregate approve`: say so next to the approval command. The launcher
// is found in the data home, not beside this process (under `bun src/main.ts` that is bun's folder).
export function engineNote(proposal: Proposal, installed = launcherVersion(dataHome())): string[] {
  const by = proposal.engine;
  if (by === undefined || installed === null || (installed === by.version && !by.source)) return [];
  return [`Prepared by engine ${engineLabel(by)}; the installed engine is ${installed}: approve with the same engine or update first.`];
}

// What one proposal changes: the WARNING, file diffs, contract summary and consent line.
export function reviewLines(root: string, proposal: Proposal, full = false, globs = true): string[] {
  const diff = proposalDiff(proposal);
  return [...(diff.warning ? ["WARNING: this may weaken protection."] : []), ...writeDiffs(root, proposal.writes, full),
    ...diff.summary, ...(globs ? presetGlobLines(root, proposal) : []), ...(full ? ["Per-rule changes:", ...diff.lines] : []), consentLine(proposal)];
}

// Globs the proposed preset writes that match no project file (#66); none when the preset is unchanged.
// It lists paths only, and a listing failure drops the warning instead of the review.
export function presetGlobLines(root: string, proposal: Proposal): string[] {
  const write = proposal.writes.find((w) => pathKey(w.path) === pathKey(join(root, PRESET_PATH)));
  return write?.after ? deadGlobLines(JSON.parse(write.after) as Preset, () => listedPaths(root)) : [];
}

// The pending batch this code approves, or null when it names no batch (a project code, a stale one).
export function pendingBatch(code: string): Batch | null {
  const batch = readBatch();
  return batch !== null && approvalCode(batch.digest, code) ? batch : null;
}

// The arguments of one literal `pregate ...` command, from `pregate` or the launcher's plain path;
// null for anything else. Wrappers, substitutions and pipelines never match.
export function literalPregate(command: string, launcher: string): string | null {
  const head = command.startsWith("pregate ") ? "pregate" : /^[\w/.:\-]+$/.test(launcher) && command.startsWith(`${launcher} `) ? launcher : null;
  return head === null ? null : command.slice(head.length + 1);
}

export const APPROVE_CODE = /^approve (?:--yes --digest ([0-9a-f]{64})|([0-9a-f]{12,64}))$/;

// The pending batch one literal approval command names. That command is answered by the engine
// that wrote the batch, never by the older engine a project in it still pins.
export function batchApproval(command: string, launcher: string): Batch | null {
  const contract = APPROVE_CODE.exec(literalPregate(command, launcher) ?? "");
  return contract === null ? null : pendingBatch(contract[1] ?? contract[2]!);
}

// Why one project of a batch can no longer be approved by it; null while its review stands.
export function batchItemError(item: Batch["items"][number]): string | null {
  const proposal = readProposal(item.root);
  if (proposal === null) return `${item.root}: its review expired or was approved on its own.`;
  if (sha256(JSON.stringify(proposal)) !== item.digest) return `${item.root}: its review was replaced after the batch preview.`;
  if (proposal.activate !== false) return `${item.root}: its review changes consent, which a batch approval never does; approve it with its own code.`;
  return currentProposal(proposal) ? null : `${item.root}: its contract or proposed files changed since the preview.`;
}

// Every project's compact review under its root, then the one batch code. Throws when any
// project's review no longer stands, naming each one.
// `pending`: the preview and native ask also say how to approve; the approval itself shows only the reviews.
export function batchReview(batch: Batch, pending = true, globs = true): { text: string; warning: boolean } {
  const errors = batch.items.map(batchItemError).filter((error) => error !== null);
  if (errors.length > 0) throw new Error([...errors, BATCH_STALE].join("\n"));
  const proposals = batch.items.map(({ root }) => readProposal(root)!);
  return { warning: proposals.some((proposal) => proposalDiff(proposal).warning), text: [
    `Approve all ${batch.items.length} project updates with one code. Each project's review follows.`,
    ...proposals.flatMap((proposal) => [`Project: ${proposal.root}`, ...reviewLines(proposal.root, proposal, false, globs)]),
    ...(pending ? ["Pending human review. The active contracts still apply.",
      `Digest: ${batch.digest}`, ...humanApprovalInstructions(`pregate approve ${batch.digest.slice(0, 12)}`)] : [])].join("\n") };
}

export const BATCH_STALE = "The batch approval no longer matches its preview; nothing applied. Rerun pregate update --projects <path...> --preview, or approve each project with its own code.";

export function consentLine(proposal: Proposal): string {
  return proposal.activate === false ? "Local consent is preserved; this approval does not enable protection." : "This approval enables local worktree consent. Working engine, launcher and hooks are required for agent-edit protection; verify pregate status and pregate doctor.";
}

// Checker updates count as routine only for namespaces bundled by both the current and proposed preset.
export function proposalDiff(proposal: Proposal): ContractDiff {
  const preset = join(proposal.root, PRESET_PATH);
  const before = text(preset);
  const write = proposal.writes.find((w) => pathKey(w.path) === pathKey(preset));
  return reviewDiff(text(join(proposal.root, ".pregate/pregate.lock.json")), JSON.parse(proposal.lockText), bundledBetween(before, write === undefined ? before : write.after));
}

// The preset diff stays whole. Other files (pack checks, patterns, drafts) share a line budget;
// past it each file still names its path and how many lines --full adds.
export function writeDiffs(root: string, writes: Proposal["writes"], full: boolean): string[] {
  let budget = full ? Infinity : COMPACT_DIFF_LINES;
  return writes.map((w) => {
    const rel = relativePath(root, w.path), diff = sourceDiff(rel, w.before, w.after);
    if (full || pathKey(w.path) === pathKey(join(root, PRESET_PATH))) return diff;
    const lines = diff.split("\n"), shown = lines.slice(0, Math.max(budget, 2));
    budget = Math.max(0, budget - shown.length);
    return shown.length === lines.length ? diff : [...shown, `  +${lines.length - shown.length} lines not shown: pregate approve --preview --full`].join("\n");
  });
}
