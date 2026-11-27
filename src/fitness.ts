import type { FitnessBinding, FitnessReceipt } from "./types.ts";

type FitnessStatus = "pass" | "fail" | "unverified";
interface FitnessResult { status: FitnessStatus; reason: string }
interface FitnessSnapshot { contractHash: string; inputHash: string; now: number }
export type ProjectFitness = FitnessResult & { rule: string; requirement: string; statement: string; fixHint: string; verifier: string; rationale: string | null; inputs: string[]; diagnostics?: string };
export interface FitnessCandidate {
  id: string; command: string[]; inputs: string[]; timeoutMs: number; maxAgeMs?: number;
  claims: { rule: string; conditions: string[]; verifier: string; coverage: "complete" | "partial" }[];
  negativeControls: string[]; assumptions: { domain: string[]; data: string[]; performance: string[] }; limits: string;
}
export interface FitnessCandidates { path: string; text: string; assertions: FitnessCandidate[] }

export function fitnessSummary(results: ProjectFitness[]) {
  return { active: results.length, adopted: results.filter(result => result.rationale !== null).length,
    passing: results.filter(result => result.status === "pass").length, failed: results.filter(result => result.status === "fail").length,
    needsEvidence: results.filter(result => result.rationale !== null && result.status === "unverified").length,
    unbound: results.filter(result => result.rationale === null).length };
}

// A passing command establishes the reviewed fitness function, not an unrestricted semantic proof.
// The shell supplies a receipt only from PREGATE-owned state after checking the current input tree.
export function fitnessResult(verifier: string, binding: FitnessBinding | undefined, receipt: FitnessReceipt | null,
  snapshot: FitnessSnapshot): FitnessResult {
  if (!verifier || !binding) return { status: "unverified", reason: "No reviewed project fitness function is bound to this requirement." };
  if (!receipt) return { status: "unverified", reason: "The project fitness function has not run for this contract and input tree." };
  if (receipt.schemaVersion !== 1 || receipt.verifier !== verifier || receipt.contractHash !== snapshot.contractHash
    || receipt.inputHash !== snapshot.inputHash || JSON.stringify(receipt.command) !== JSON.stringify(binding.command)) {
    return { status: "unverified", reason: "Fitness evidence is stale or does not belong to this reviewed contract." };
  }
  if (receipt.completed !== true || !Number.isInteger(receipt.exitCode)) return { status: "unverified", reason: "The fitness command did not complete within its budget." };
  if (binding.maxAgeMs !== undefined) {
    const recorded = Date.parse(receipt.recordedAt);
    if (!Number.isFinite(snapshot.now) || !Number.isFinite(recorded) || recorded > snapshot.now || snapshot.now - recorded >= binding.maxAgeMs) {
      return { status: "unverified", reason: "Fitness evidence has expired or its recording time is invalid; rerun the reviewed assertion." };
    }
  }
  if (receipt.exitCode !== 0) return { status: "fail", reason: `The reviewed fitness command exited with status ${receipt.exitCode}.` };
  return { status: "pass", reason: "The reviewed project fitness function passed on the current input tree." };
}
