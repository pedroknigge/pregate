import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The coverage map binds each judgment to a real alias, or to the two rows that have no honest proxy.
const map = readFileSync(join(import.meta.dir, "../packs/maintainability/PROXIES.md"), "utf8");
const rows = [...map.matchAll(/^\| (\d+) \| (.+?) \| (.+?) \| (high|medium|low|none) \|$/gm)].map((match) => ({
  n: Number(match[1]), label: match[2]!, binding: match[3]!, fidelity: match[4]!,
}));

function aliases(): Set<string> {
  const known = new Set<string>();
  const add = (dir: string): void => {
    let files: string[];
    try { files = readdirSync(dir); } catch { return; }
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const manifest = JSON.parse(readFileSync(join(dir, file), "utf8")) as { id: string; invariants?: { id: string }[] };
      const ns = manifest.id.split("/")[0]!;
      for (const invariant of manifest.invariants ?? []) known.add(`${ns}/${invariant.id}`);
    }
  };
  for (const ns of readdirSync(join(import.meta.dir, "../packs"))) add(join(import.meta.dir, "../packs", ns, "methodologies"));
  add(join(import.meta.dir, "../catalog/methodologies"));
  return known;
}

test("the judgment map has 100 rows and only two have no honest proxy", () => {
  expect(rows.map((row) => row.n)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  const none = rows.filter((row) => row.binding === "no honest proxy");
  expect(none.map((row) => [row.n, row.label, row.fidelity])).toEqual([
    [25, "Reads like prose", "none"],
    [60, "DRY only for the same business rule", "none"],
  ]);
  const known = aliases();
  for (const row of rows) {
    if (row.binding === "no honest proxy") continue;
    expect(row.fidelity, String(row.n)).not.toBe("none");
    expect(known.has(row.binding), row.binding).toBe(true);
  }
  for (const id of ["MAINT-MAGIC-001", "MAINT-TEST-001", "MAINT-ADR-001", "MAINT-TODO-001", "MAINT-FLAG-001", "MAINT-CHURN-001", "MAINT-AND-001"]) {
    expect(rows.some((row) => row.binding === `maintainability/${id}`)).toBe(true);
  }
});
