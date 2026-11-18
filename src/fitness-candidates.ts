import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { matches, relativePath } from "./paths.ts";
import { fitnessRequirement, type Lock } from "./types.ts";
import type { FitnessCandidate, FitnessCandidates } from "./fitness.ts";

export const FITNESS_CANDIDATES = "pregate.fitness.json";
function object(value: unknown, keys: string[], where: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`${where}: expected an object with fields ${keys.join(", ")}.`);
  return value as Record<string, unknown>;
}

function words(value: unknown, where: string, empty = false): string[] {
  if (!Array.isArray(value) || value.length > 256 || (!empty && value.length === 0)
    || value.some(word => typeof word !== "string" || !word.trim() || word.length > 4096)) {
    throw new Error(`${where}: expected ${empty ? "an" : "a nonempty"} array of bounded, nonblank strings.`);
  }
  return value as string[];
}

function budget(value: unknown, where: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`${where}: expected a positive integer up to ${maximum}.`);
  return value;
}

// Explicit project claims only: parsing and displaying these never runs their commands.
export function readFitnessCandidates(root: string, path: string, lock: Lock, paths: string[]): FitnessCandidates {
  const absolute = resolve(root, path), rel = relativePath(root, absolute);
  if (!paths.includes(rel)) throw new Error(`Fitness candidates must be a regular project file outside ignored directories: ${path}.`);
  if (statSync(absolute).size > 1024 * 1024) throw new Error("Fitness candidates exceed the 1 MiB input budget.");
  const text = readFileSync(absolute, "utf8");
  if (Buffer.byteLength(text) > 1024 * 1024) throw new Error("Fitness candidates exceed the 1 MiB input budget.");
  const manifest = object(JSON.parse(text), ["schemaVersion", "assertions"], "Fitness candidates");
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assertions) || !manifest.assertions.length || manifest.assertions.length > 256) {
    throw new Error("Fitness candidates require schemaVersion 1 and 1–256 authored assertions. Template entries need commands and inputs before binding.");
  }
  const seen = new Set<string>(), owners = new Set<string>();
  const rules = lock.rules.filter(rule => rule.phases.includes("ci") && !lock.ownedByArkgate.includes(rule.id)
    && fitnessRequirement(rule.impl) !== null);
  const assertions = manifest.assertions.map((value, index): FitnessCandidate => {
    const at = `assertions[${index}]`, candidate = object(value, ["id", "command", "inputs", "claims", "negativeControls", "assumptions", "limits", "timeoutMs", "maxAgeMs"], at);
    const id = candidate.id;
    if (typeof id !== "string" || !/^[a-z][a-z0-9-]{0,79}$/.test(id) || seen.has(id)) throw new Error(`${at}.id: use a distinct lowercase assertion ID.`);
    seen.add(id);
    if (!Array.isArray(candidate.claims) || !candidate.claims.length || candidate.claims.length > 256) throw new Error(`${at}.claims: name the active requirements and the conditions this assertion tests.`);
    const claims = candidate.claims.map((value, index): FitnessCandidate["claims"][number] => {
      const claim = object(value, ["rule", "conditions", "coverage"], `${at}.claims[${index}]`);
      const rule = rules.find(rule => rule.id === claim.rule || rule.id === `core/${claim.rule}`);
      if (!rule) throw new Error(`${at}: ${String(claim.rule)} is not an active project fitness requirement.`);
      if (claim.coverage !== "complete" && claim.coverage !== "partial") throw new Error(`${at}: declare each claim's coverage as complete or partial; complete requires all applicable conditions of the actual requirement.`);
      const verifier = String(rule.params.verifier);
      if (owners.has(verifier)) throw new Error(`${at}: duplicate verifier ${verifier}; combine its assertions into one reviewed command.`);
      owners.add(verifier);
      return { rule: rule.id, verifier, conditions: words(claim.conditions, `${at}.conditions`), coverage: claim.coverage };
    });
    const assumptions = object(candidate.assumptions, ["domain", "data", "performance"], `${at}.assumptions`);
    if (typeof candidate.limits !== "string" || !candidate.limits.trim() || candidate.limits.length > 4096) throw new Error(`${at}.limits: state the coverage limits.`);
    const draft = claims.every(claim => claim.coverage === "partial");
    const inputs = words(candidate.inputs, `${at}.inputs`, draft);
    for (const input of inputs) if (!paths.some(path => matches(input, path))) throw new Error(`${at}.inputs: ${input} matches no current regular project file; review verifier definition inputs.`);
    const manifestInput = rel.replace(/[*?[\]{}\\]/g, "\\$&");
    return { id, command: words(candidate.command, `${at}.command`, draft), inputs: [...new Set([...inputs, manifestInput])], claims,
      negativeControls: words(candidate.negativeControls, `${at}.negativeControls`),
      assumptions: { domain: words(assumptions.domain, `${at}.assumptions.domain`, true), data: words(assumptions.data, `${at}.assumptions.data`, true), performance: words(assumptions.performance, `${at}.assumptions.performance`, true) },
      limits: candidate.limits, timeoutMs: budget(candidate.timeoutMs ?? 30000, `${at}.timeoutMs`, 120000),
      ...(candidate.maxAgeMs === undefined ? {} : { maxAgeMs: budget(candidate.maxAgeMs, `${at}.maxAgeMs`) }) };
  });
  return { path: rel, text, assertions };
}

export function candidateRationale(candidate: FitnessCandidate, conditions: string[]): string {
  return [`Project assertion ${candidate.id}. Declared coverage: complete for all applicable conditions of the selected requirement. Conditions: ${conditions.join("; ")}.`, `Negative controls to review: ${candidate.negativeControls.join("; ")}.`,
    ...Object.entries(candidate.assumptions).map(([kind, facts]) => `${kind} assumptions: ${facts.length ? facts.join("; ") : "none stated"}.`),
    `Limits: ${candidate.limits}`, "These are project-authored coverage claims; PREGATE has not validated their semantic completeness."].join("\n");
}
