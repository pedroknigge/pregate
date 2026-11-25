import { mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { approve, humanApprovalInstructions, PENDING_MS } from "./approval.ts";
import { dataHome } from "./consent.ts";
import { visible } from "./contract.ts";
import { canonical, findRoot, writeAtomic } from "./disk.ts";
import { equal } from "./schema.ts";
import { sessionDir, sha256 } from "./state.ts";
import { lockPrune } from "./state-lease.ts";
import { prunePlan, storageInspection, type PrunePlan } from "./storage.ts";
import { applyRecovery, recoveryPlan, recoveryPreview, type RecoveryPlan } from "./storage-recovery.ts";

type Result = { code: number; text: string };
type StoragePlan = PrunePlan | RecoveryPlan;
const USAGE = "usage: pregate storage inspect [--json] | prune --older-than <days> [--preview] | recover [--preview] | show <digest> | apply <digest> [--yes]";

function isRecovery(plan: StoragePlan): plan is RecoveryPlan { return "kind" in plan && plan.kind === "recover"; }

function draftFile(id: string): string {
  if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("Storage cleanup needs its full SHA-256 digest.");
  return join(dataHome(), "storage-drafts", id + ".json");
}

export function storageReview(root: string, id: string): StoragePlan {
  const text = readFileSync(draftFile(id), "utf8");
  if (sha256(text) !== id) throw new Error("Cleanup draft changed; prepare a new preview.");
  const draft = JSON.parse(text) as StoragePlan, age = Date.now() - draft.at;
  if (draft.root !== root || !Number.isFinite(draft.at) || age < 0 || age > PENDING_MS) throw new Error("Cleanup draft expired or is invalid for this project.");
  if (isRecovery(draft)) {
    if (!equal(draft, recoveryPlan(root, storageInspection(root).sessions, draft.at))) throw new Error("Coordination changed since preview; prepare a new preview.");
    return draft;
  }
  if (!Number.isFinite(draft.cutoff) || draft.cutoff < 0 || draft.cutoff >= draft.at) throw new Error("Invalid cleanup cutoff.");
  if (!equal(draft, prunePlan(root, draft.cutoff, draft.at))) throw new Error("Session storage changed since preview; prepare a new preview.");
  return draft;
}

export function storagePreview(plan: StoragePlan, id: string): string {
  if (isRecovery(plan)) return recoveryPreview(plan, id);
  const files = plan.sessions.flatMap((session) => session.files);
  return visible([
    "Remove old recorded source copies for " + plan.root + ". Nothing is uploaded.",
    "Only observations before " + new Date(plan.cutoff).toISOString() + "; " + files.length + " blobs / " + files.reduce((total, file) => total + file.bytes, 0) + " bytes.",
    ...plan.sessions.flatMap((session) => ["Session: " + session.session,
      ...session.files.map((file) => "  " + file.path + " · " + file.bytes + " bytes · SHA-256 " + file.hash)]),
    "Snapshots, baseline caches, histories and denial/Stop counters stay intact. Shared/newer code remains.",
    "Old findings remain listed; deleted source cannot be included in a new issue or dispute reproduction.",
    "This is permanent file removal, not secure disk erasure. It does not remove code copied into existing issue drafts.",
    "Digest: " + id, ...humanApprovalInstructions("pregate storage apply " + id + " --yes", "harness"),
  ].join("\n"));
}

export async function storage(args: string[]): Promise<Result> {
  return storageAction(findRoot(canonical(process.cwd()), () => true), args);
}

async function storageAction(root: string | null, args: string[]): Promise<Result> {
  try {
    const [sub, id, ...flags] = args;
    if (sub === "inspect" && (args.length === 1 || (args.length === 2 && id === "--json"))) return inspect(root ?? canonical(process.cwd()), id === "--json");
    if (root === null) return { code: 1, text: "Cleanup requires a PREGATE project. Use storage inspect to see local session data." };
    if (sub === "prune") return draft(root, args.slice(1));
    if (sub === "recover" && (args.length === 1 || (args.length === 2 && id === "--preview"))) return draftRecovery(root);
    if (!id || !/^[0-9a-f]{64}$/.test(id)) return { code: 1, text: USAGE };
    if (sub === "show" && flags.length === 0) return { code: 0, text: storagePreview(storageReview(root, id), id) };
    if (sub === "apply" && (flags.length === 0 || (flags.length === 1 && flags[0] === "--yes"))) return await apply(root, id, flags.length === 1);
    return { code: 1, text: USAGE };
  } catch (error) {
    return { code: 1, text: "Storage operation failed: " + (error as Error).message + ". Inspect storage before retrying; an interrupted apply may have completed part of the approved operation." };
  }
}

function inspect(root: string, json: boolean): Result {
  const data = storageInspection(root);
  return { code: 0, text: json ? JSON.stringify(data, null, 2) : visible([
    "Local state: " + data.state, data.scope,
    ...data.sessions.map((session) => session.session + " · " + session.bytes + " bytes · source blobs " + session.blobBytes
      + " bytes · baselines " + session.baselineBytes + " bytes · " + session.events + " events · writers " + session.writers + " · cleanup " + (session.pruning ? "locked" : "idle")),
    ...data.sessions.flatMap((session) => session.markers.map((marker) => "  " + session.session + "/" + marker.path + " · " + marker.state + " · " + marker.reason)),
    data.retained, "Use storage prune --older-than <days> or storage recover --preview to prepare a project-scoped review.",
  ].join("\n")) };
}

function draft(root: string, args: string[]): Result {
  if (args[0] !== "--older-than" || args.length < 2 || args.length > 3 || (args.length === 3 && args[2] !== "--preview")) return { code: 1, text: USAGE };
  const days = Number(args[1]);
  if (!Number.isFinite(days) || days <= 0 || days > 36500) return { code: 1, text: USAGE };
  const at = Date.now(), plan = prunePlan(root, at - days * 86400000, at);
  if (plan.sessions.length === 0) return { code: 0, text: "No removable old source copies. Live snapshot, shared/newer and unattributed code stays retained." };
  return saveDraft(plan);
}

function draftRecovery(root: string): Result {
  const plan = recoveryPlan(root, storageInspection(root).sessions, Date.now());
  if (plan.sessions.length === 0) return { code: 0, text: "No provably abandoned markers for this project. Active and unknown owners remain; inspect storage for details." };
  return saveDraft(plan);
}

function saveDraft(plan: StoragePlan): Result {
  const text = JSON.stringify(plan), id = sha256(text), file = draftFile(id);
  mkdirSync(join(dataHome(), "storage-drafts"), { recursive: true });
  writeAtomic(file, text);
  return { code: 0, text: storagePreview(plan, id) };
}

async function apply(root: string, id: string, yes: boolean): Promise<Result> {
  const plan = storageReview(root, id);
  if (!await approve(storagePreview(plan, id), true, yes)) return { code: 1, text: "Cleanup not approved; draft retained." };
  if (isRecovery(plan)) {
    const current = storageReview(root, id);
    if (!isRecovery(current)) throw new Error("Recovery draft changed.");
    return { code: 0, text: "Recovered " + applyRecovery(current) + " abandoned coordination markers. Source, snapshots, histories and counters were preserved." };
  }
  return removeBlobs(root, id, plan, []);
}

function removeBlobs(root: string, id: string, plan: PrunePlan, releases: (() => void)[]): Result {
  try {
    for (const session of plan.sessions) releases.push(lockPrune(sessionDir(session.session)));
    const current = storageReview(root, id);
    if (isRecovery(current)) throw new Error("Cleanup draft changed.");
    for (const session of current.sessions) for (const file of session.files) unlinkSync(join(sessionDir(session.session), file.path));
    return { code: 0, text: "Removed " + current.sessions.reduce((total, session) => total + session.files.length, 0) + " old source blobs. Snapshots, histories and counters were preserved." };
  } finally {
    for (const release of releases.reverse()) release();
  }
}
