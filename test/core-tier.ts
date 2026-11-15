import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The eleven heuristic checks. A rule has one severity, so this list is the whole warn tier.
export const ADVISORY_CHECKS = [
  "core/invariants/cohesion-and-coupling",
  "core/invariants/observable-contract",
  "core/invariants/stable-dependencies",
  "core/invariants/collaborator-knowledge",
  "core/invariants/composition",
  "core/invariants/domain-language",
  "core/invariants/sufficient-simplicity",
  "core/invariants/clear-code",
  "core/invariants/predictable-names",
  "core/invariants/abstraction-level",
  "core/invariants/least-power",
] as const;

export function checkId(rule: { check: string }): string {
  const at = rule.check.lastIndexOf("@");
  return at < 0 ? rule.check : rule.check.slice(0, at);
}

type TierRule = { check: string; severity: string; enforcement?: string; text: { why: string } };

export function expectAdvisoryTier(core: TierRule[]): void {
  const advisory = new Set<string>(ADVISORY_CHECKS);
  expect(core.filter((rule) => rule.severity === "warn").map(checkId)).toEqual([...ADVISORY_CHECKS]);
  for (const rule of core) {
    const warn = advisory.has(checkId(rule));
    expect(rule.enforcement).toBe("enforce");
    expect(rule.severity).toBe(warn ? "warn" : "deny");
    if (!warn) expect(rule.text.why.toLowerCase()).not.toContain("advisory");
  }
}

// Reads the generator's advisory indexes and names, so a hand-edited catalog cannot drift from the script.
export function advisoryChecksFromScript(): string[] {
  const source = readFileSync(join(import.meta.dir, "../scripts/core-invariants.ts"), "utf8");
  const set = /const advisory = new Set\(\[([\d,\s]+)\]\);/.exec(source);
  const names = /const names = \[([\s\S]*?)\];/.exec(source);
  if (!set?.[1] || !names?.[1]) throw new Error("scripts/core-invariants.ts no longer declares advisory and names where the tier test reads them.");
  const indexes = set[1].split(",").map((part) => Number(part.trim())).filter((n) => Number.isInteger(n) && n > 0);
  const labels = [...names[1].matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]!);
  if (indexes.length !== ADVISORY_CHECKS.length || labels.length !== 64) {
    throw new Error(`Expected ${ADVISORY_CHECKS.length} advisory indexes and 64 names, found ${indexes.length} and ${labels.length}.`);
  }
  return indexes.map((n) => {
    const name = labels[n - 1];
    if (!name) throw new Error(`advisory index ${n} has no invariant name.`);
    return `core/invariants/${name}`;
  });
}
