import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const input = "docs/inputs/core-invariants-48.md";
const checking = process.argv.includes("--check"), dirty: string[] = [];
// --print reviews a regeneration without writing: it lists only the files whose content would
// change, so the edits can go through the reviewed edit tool instead of a script write.
const printing = process.argv.includes("--print"), outputs: { path: string; text: string }[] = [];
const rules = [...readFileSync(join(root, input), "utf8").matchAll(/^(\d+)\. (.+)$/gm)];
const followupInput = "docs/features/core-maintainability-update.md";
const followup = [...readFileSync(join(root, followupInput), "utf8").split("## Requested invariant rules")[1]!.matchAll(/^(\d+)\. (.+)$/gm)];
// One enforcing obligation owns each request; overlaps keep their original identity.
const targets = [7, 2, 3, 24, 15, 24, 24, 31, 31, 31, 31, 3, 3, 49, 50, 51, 52, 28, 28, 53, 48, 48, 48, 36, 54, 44, 29, 55, 56, 29, 57, 58, 59, 36, 47, 43, 43, 60, 61, 62, 3, 63, 64, 37, 7, 18, 24, 40];
const qualified: Record<number, string> = {
  4: "Business decisions must have an explicit domain owner; no folder name or architectural style is required.",
  6: "A user-interface adapter must delegate business decisions to their domain owner.",
  7: "A database adapter must apply domain decisions, not own them.",
  8: "An externally consumed public contract must have an explicit version; controlled consumers can migrate together under the original compatibility rule.",
  9: "An incompatible change to an externally consumed public contract must increment its version.",
  10: "An externally consumed public contract must have a written deprecation policy with scope, notice and support windows.",
  11: "The previous externally consumed public version must remain supported throughout its stated deprecation window.",
  14: "Each resolved dependency version must be pinned through the ecosystem's explicit manifest or dependency lock.",
  15: "The build must use the ecosystem's committed dependency lock or equivalent deterministic dependency record; a locked rebuild must preserve resolution.",
  16: "Dependencies must be updated on an owned, stated schedule, with dated update records.",
  17: "The build must reject a known high-risk dependency defect after the project's stated fix window. Use dated authoritative vulnerability evidence.",
  20: "The product must use a supported runtime. Verify declared versions against dated authoritative support evidence.",
  25: "Time, money and locale must use supported standard facilities appropriate to precision, time zones and locale. Do not add a dependency when supported ecosystem facilities satisfy the requirement.",
  32: "An identified risky feature must have a controlled safe-release flag with tested enable and disable behavior. Do not introduce speculative flags without a relevant risk.",
  35: "A measured bottleneck must be scalable without rewriting domain decisions or unrelated modules. Preserve contracts and budgets; do not add speculative distribution.",
};
const names = [
  "reason-for-change", "cohesion-and-coupling", "information-hiding", "observable-contract", "stable-dependencies", "evidenced-abstraction",
  "single-change-reason", "explicit-dependencies", "collaborator-knowledge", "composition", "narrow-interfaces", "source-of-truth",
  "domain-validation", "valid-state", "shared-immutability", "explicit-time-and-identity", "command-query-effects", "domain-language",
  "invariant-failure", "failure-classification", "idempotency", "remote-call-budget", "failure-isolation", "effects-at-boundaries",
  "concurrency-conflicts", "demonstrated-need", "sufficient-simplicity", "replaceable-modules", "vertical-slices", "observed-change-axis",
  "explicit-compatibility", "clear-code", "predictable-names", "abstraction-level", "least-power", "named-policies", "dead-code",
  "minimum-privilege", "boundary-validation", "secret-isolation", "decision-authorization", "closed-failure", "boundary-observability",
  "isolated-verification", "startup-validation", "latency-isolation", "resource-budgets", "repeatable-migrations",
  "pinned-dependencies", "locked-build", "dependency-update-schedule", "vulnerability-fix-window", "supported-runtime", "standard-value-facilities",
  "defect-regression", "static-analysis-merge-gate", "release-rollback", "controlled-risk-flags", "automated-deployment", "operational-runbooks",
  "alert-ownership", "architecture-decision-record", "reproducible-onboarding", "debt-ownership",
];
if (rules.length !== 48 || names.length !== 64 || rules.some((r, i) => Number(r[1]) !== i + 1)
  || followup.length !== 48 || targets.length !== 48 || followup.some((r, i) => Number(r[1]) !== i + 1)) throw new Error("Expected both consecutive sets of 48 requirements and their 64 stable obligations.");
// Heuristic requirements keep their identity in the core (each original request keeps exactly one
// owner) but start advisory: reading-quality judgments are not provable product conditions.
const advisory = new Set([2, 4, 5, 9, 10, 18, 27, 32, 33, 34, 35]);
// Clarifications keep the original request text as the statement prefix and add the rule's scope,
// its relationship to the rules it was confused with, and its evidence form.
const clarify: Record<number, string> = {
  1: "This requirement divides the system and its modules; the same condition for each unit is CORE-INV-007.",
  2: "The encapsulation clause is CORE-INV-003 and the per-unit division is CORE-INV-007; this requirement owns the cohesion and dependency-size reading, and its size bound stays advisory until the project states a measurable bound.",
  3: "The written and current contract and current-documentation clauses are process obligations satisfied by reviewed project evidence, not by source syntax.",
  4: "A caller must not depend on operations that it does not call (CORE-INV-011), and 'small' stays advisory until the project states a measurable bound.",
  5: "Change frequency is measured project evidence; until the project states the stability bound, this requirement is advisory.",
  6: "The two real implementations, the change that already occurred, and the third real repetition (CORE-INV-026) are one demonstrated need; any one of them establishes it.",
  7: "The system-level division of the same idea is CORE-INV-001; this requirement owns each unit: a function, a module, a process, and a service.",
  9: "This is a heuristic: the target case is a call that goes through a collaborator's internals to reach a third unit; builders, data objects and fluent calls that expose the needed behavior are valid.",
  10: "In a language without implementation inheritance this requirement holds vacuously; inheritance for a real domain is-a relation that will not break remains valid.",
  11: "Each observable behavior has a contract, and that contract stays small (CORE-INV-004).",
  18: "Names follow the project's declared domain vocabulary; the technical translation boundary is where framework names stay.",
  26: "The two real implementations (CORE-INV-006) and the already-moved axis (CORE-INV-030) are the same demonstrated need; any one of them establishes it.",
  27: "This requirement and CORE-INV-035 state one decision: the design with the fewest concepts, states, and failure modes that still meets the current constraints.",
  29: "The keep-fitness-tests-green and tests-before-merge clauses are owned by CORE-INV-044 and CORE-INV-056; this requirement owns the vertical-slice direction.",
  30: "This requirement and CORE-INV-026 state one demonstrated need; the moved axis is one of its triggers.",
  32: "This requirement is advisory: reading quality is a demonstrated review judgment, not a provable product condition.",
  33: "Name prediction is tested by behavior evidence about what the named operation does, not by the name text.",
  34: "The level boundary is a reading judgment; the evidence is review, not a metric.",
  35: "This requirement and CORE-INV-027 state one decision: use the least powerful mechanism that meets the current constraints.",
  36: "A single literal whose meaning is obvious where it is used is not a policy.",
  49: "A committed lock that records each resolved version satisfies the pin; an exact manifest pin also satisfies it.",
  51: "This is a process obligation: the stated schedule and its dated update records are the evidence, not source code.",
  54: "An equivalent reviewed library is valid when the platform's standard facilities lack the needed precision or locale data; reimplementing those semantics by hand is not.",
  58: "A feature is risky here when it is hard to reverse after release, such as a data migration, an external contract, or an irreversible side effect; a feature that can be removed safely does not need a flag.",
};
function emit(path: string, value: object) {
  const text = JSON.stringify(value, null, 2) + "\n";
  const target = join(root, path);
  if (printing) { if (!existsSync(target) || readFileSync(target, "utf8").replaceAll("\r\n", "\n") !== text) outputs.push({ path, text }); return; }
  if (existsSync(target) && readFileSync(target, "utf8").replaceAll("\r\n", "\n") === text) return;
  if (checking) { dirty.push(path); return; }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}
const invariants = names.map((name, i) => {
  const id = `CORE-INV-${String(i + 1).padStart(3, "0")}`, check = `core/invariants/${names[i]}`;
  const base = `catalog/checks/invariants/${names[i]}`;
  const additions = followup.filter((_, at) => targets[at] === i + 1);
  const statement = [rules[i]?.[2], ...additions.map((r) => qualified[Number(r[1])] ?? r[2]), clarify[i + 1]].filter(Boolean).join(" ");
  const updated = additions.length > 0;
  const changed = advisory.has(i + 1) || clarify[i + 1] !== undefined;
  const severity = advisory.has(i + 1) ? "warn" : "deny";
  const version = updated ? (changed ? "1.2.0" : "1.1.0") : changed ? "1.1.0" : "1.0.0";
  emit(`${base}/check.json`, { id: check, version, area: "invariants", cardinality: "singleton",
    dimension: `invariant.r${String(i + 1).padStart(3, "0")}`, minSeverity: severity, params: { verifier: { type: "string", pattern: "\\S" } },
    impl: { kind: "primitive", primitive: "fitness", requirement: id }, phase: ["stop", "commit", "ci"],
    feedback: { message: `${id} requires current passing project verification: {symbol}.` } });
  for (const name of ["pass/current-inputs", "pass/new-contract", "fail/no-evidence", "fail/failed-verification", "trap/stale-inputs"]) {
    const contractHash = name === "pass/new-contract" ? "reviewed-contract-v2" : "reviewed-contract-v1";
    const receipt = name === "fail/no-evidence" ? null : { schemaVersion: 1, contractHash,
      inputHash: name === "trap/stale-inputs" ? "old-code-tree" : "current-code-tree", verifier: id, command: ["fixture-verifier"],
      exitCode: name === "fail/failed-verification" ? 1 : 0, completed: true, recordedAt: "2026-10-04T00:00:00Z" };
    const pass = name.startsWith("pass/");
    emit(`${base}/fixtures/${name}/fixture.json`, { language: "typescript", params: { verifier: id },
      context: { fitness: { contractHash, inputHash: "current-code-tree", command: ["fixture-verifier"], receipt } },
      target: ".pregate/preset.json", before: null,
      expect: pass ? { verdict: "pass" } : { verdict: "fail", violations: [{ line: 1 }] },
      ...(name.startsWith("trap/") ? { trap: { family: "stale-fitness-evidence", origin: "forge", discovered: "2026-10-04",
        note: "A prior green verification must not admit changed inputs." } } : {}) });
    emit(`${base}/fixtures/${name}/files/.pregate/preset.json.fixture`, { requirement: id });
  }
  return { id, check, defaults: { verifier: id }, severity,
    source: { work: "User-supplied software and maintainability invariants", locator: [rules[i] ? `${input}, rule ${i + 1}` : null,
      ...additions.map((r) => `${followupInput}, request ${r[1]}`)].filter(Boolean).join("; "),
      paraphrase: [rules[i]?.[2], ...additions.map((r) => r[2])].filter(Boolean).join(" ") },
    why: statement, fixHint: `Bind ${id} to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run ${id}. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.`,
    avoid: "A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.",
    examples: { pass: "pass/current-inputs", fail: "fail/no-evidence" } };
});
emit("catalog/methodologies/software-invariants.json", { $schema: "../../schema/methodology.v1.json", id: "core/software-invariants", version: "1.2.0",
  status: "preview", conflicts: [], invariants });
if (printing) { console.log(JSON.stringify(outputs)); process.exit(0); }
if (dirty.length) {
  console.error(`Core requirements are stale:\n${dirty.join("\n")}\nRun bun scripts/core-invariants.ts.`);
  process.exitCode = 1;
} else console.log(`${checking ? "Verified" : "Generated"} 64 project fitness obligations from both sets of 48 requests and 320 declarative receipt fixtures. These fixtures test the evidence gate, not project semantics.`);
