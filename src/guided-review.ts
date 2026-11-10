import { join } from "node:path";
import { enforcementOf } from "./enforcement.ts";
import { readText } from "./gate.ts";
import { proposalDiff } from "./pending-review.ts";
import { pathKey } from "./paths.ts";
import { importReviewCost } from "./pack-command.ts";
import type { Files, Layer, Lock, Preset } from "./types.ts";
import type { Proposal } from "./proposal.ts";
import { humanApprovalInstructions } from "./approval.ts";
import { protectionStatus } from "./status.ts";
import { deadGlobLines, deriveLayers, layerEvidence, layerEvidenceLines, newBreak, scopeCoverage, scopeCoverageText } from "./onboard.ts";
import { repoFiles } from "./init.ts";

export function protectionReadiness(root: string): string {
  const status = protectionStatus(null);
  const missing = [...(!status.installation.enginePresent ? ["installed engine"] : []),
    ...(!status.installation.launcherPresent ? ["launcher"] : []), ...(!status.harnesses.some(harness => harness.configured) ? ["registered harness hooks"] : [])];
  return missing.length ? `Protection readiness for ${root}: degraded; missing ${missing.join(", ")}. Approval records the reviewed contract and consent; it does not establish working agent-edit protection. Run pregate setup, then pregate doctor to verify real denial canaries.`
    : `Protection readiness for ${root}: engine, launcher and harness registrations are present. Registrations alone do not prove working hooks; run pregate doctor for real denial canaries. Consent is reviewed separately below.`;
}

function degraded(root: string): string[] {
  const readiness = protectionReadiness(root);
  return readiness.includes(": degraded;") ? [readiness] : [];
}

// A new or changed layer map drives the architecture rules; guide derives it from folder names,
// so it is named for review instead of appearing only inside the preset diff, with each folder
// that was relaxed or left out because the project's own imports contradict its name.
function layerLines(root: string, lock: Lock, files: Files): string[] {
  const current = currentLayers(root);
  const layers = Object.entries(lock.layers ?? {});
  const fresh = readText(join(root, ".pregate/pregate.lock.json")) === null;
  if (!fresh && Bun.deepEquals(current, lock.layers)) return [];
  // The notes explain the derived map only; a recipe's or a request's own layers stay as written.
  const derived = deriveLayers(files);
  const notes = Bun.deepEquals(derived.layers, lock.layers ?? {}) ? derived.notes : [];
  const may = (layer: Layer) => layer.mayImport.includes("*") ? "may import any code" : layer.mayImport.length ? `may import ${layer.mayImport.join(", ")}` : "imports no other layer";
  if (!layers.length || Bun.deepEquals(current, lock.layers)) return notes;
  return [`Layers to review: ${layers.map(([name, layer]) => `${name} (${layer.kind}; ${may(layer)})`).join("; ")}.`, ...notes,
    ...layerEvidenceLines(layerEvidence(files, lock.layers), lock.ratchet, newBreak(lock))];
}

function currentLayers(root: string): Lock["layers"] | null {
  try {
    return (JSON.parse(readText(join(root, ".pregate/pregate.lock.json")) ?? "null") as Lock | null)?.layers ?? {};
  } catch {
    return null;   // an unreadable lock: every proposed layer is new to the reviewer
  }
}

// The digest binds the full proposal; the readable summary counts rules per pack.
// Loosenings, removals and field changes remain individually visible.
export function guidedReview(proposal: Proposal, digest: string, activate: boolean): { text: string; warning: boolean } {
  const lock = JSON.parse(proposal.lockText) as Lock;
  const diff = proposalDiff(proposal);
  const staticRules = lock.rules.filter(rule => !(rule.impl.kind === "primitive" && rule.impl.primitive === "fitness"));
  const count = (policy: string) => staticRules.filter(rule => enforcementOf(lock, rule) === policy && (policy !== "enforce" || rule.severity !== "warn")).length;
  const requirements = lock.rules.length - staticRules.length;
  const bindings = Object.entries(lock.fitness ?? {});
  const before = readText(join(proposal.root, ".pregate/preset.json"));
  const presetText = proposal.writes.find(write => pathKey(write.path) === pathKey(join(proposal.root, ".pregate/preset.json")))?.after ?? before;
  const preset = JSON.parse(presetText ?? "{}") as Preset;
  const sources = preset.sources ?? [];
  const files = repoFiles(proposal.root);
  const imports = importReviewCost(proposal.root, lock).filter(line => line.startsWith("Interactive import rules"));
  return { warning: diff.warning, text: [
    `Project: ${proposal.root}`, `Engine ${lock.engine}; core ${lock.core}.`,
    ...degraded(proposal.root),
    `Scope includes: ${lock.scope.include.join(", ")}. Excludes: ${lock.scope.exclude.join(", ") || "none"}.`,
    ...scopeCoverageText(scopeCoverage(files, lock.scope)), ...deadGlobLines(preset, () => Object.keys(files)),
    `Packs: ${sources.map((source: { ns: string; version?: string; path?: string; ref?: string }) => `${source.ns}${source.version ? "@" + source.version : source.path ? " (local " + source.path + ")" : " (Git " + source.ref + ")"}`).join(", ")}.`,
    ...layerLines(proposal.root, lock, files),
    `Rules: ${count("enforce")} block, ${count("advisor")} advise, ${count("shadow")} observe${bindings.length ? `; ${requirements} evidence requirements` : ""}.`,
    ...imports,
    `Debt policy: ${lock.ratchet}. ${activate ? "Approval activates this worktree." : "Local consent is preserved; this approval does not enable protection."}`,
    ...diff.summary,
    ...bindings.map(([name, binding]) => `Project verifier ${name}: ${JSON.stringify(binding.command)}; inputs ${binding.inputs.join(", ")}.`),
    `Digest: ${digest}`, "Full source/rule changes: pregate approve --preview --full (from this project).",
    ...humanApprovalInstructions(`pregate approve ${digest.slice(0, 12)}`),
    "This approval applies exactly the displayed candidate digest; any contract, source or review change rejects it.",
  ].join("\n") };
}
