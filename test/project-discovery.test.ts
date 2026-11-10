import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverDocumentation } from "../src/project-discovery.ts";
import { sha256 } from "../src/state.ts";
import { removeTree } from "./remove-tree.ts";

test("documentation discovery respects file count and byte budgets without inferring code-example requirements", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-doc-discovery-"));
  inScratch(root, () => {
    mkdirSync(join(root, "docs"));
    const statement = "An order must belong to the active tenant.";
    const readme = "\uFEFF# Orders\n" + statement + "\n```ts\nA code example must not become a requirement.\n```\n";
    writeFileSync(join(root, "README.md"), readme);
    writeFileSync(join(root, "docs", "oversized.md"), "x".repeat(128 * 1024 + 1));
    for (let i = 0; i < 45; i++) writeFileSync(join(root, "docs", `${String(i).padStart(2, "0")}.md`), `Document ${i}\n`);
    const result = discoverDocumentation(root);
    expect(result.scanned).toHaveLength(40);
    expect(result.skipped).toHaveLength(7);
    expect(result.requirements).toEqual([{ path: "README.md", line: 2, statement, sourceHash: sha256(readme) }]);
    expect(result.skipped).toContain("docs/oversized.md");
  });
});

test("documentation discovery admits the exact total budget and withholds later document content", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-doc-byte-budget-"));
  inScratch(root, () => {
    mkdirSync(join(root, "docs"));
    for (let i = 0; i < 17; i++) writeFileSync(join(root, "docs", `${String(i).padStart(2, "0")}.md`), "x".repeat(128 * 1024));
    const result = discoverDocumentation(root);
    expect(result.scanned).toHaveLength(16);
    expect(result.skipped).toEqual(["docs/16.md"]);
    expect(result.requirements).toEqual([]);
    expect(result.customPack.status).toContain("no test or semantic coverage is inferred");
  });
});

test("documentation suggestions retain complete wrapped paragraphs and list items, and skip required parameter descriptions", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-doc-statements-"));
  inScratch(root, () => {
    const readme = "# API\n\nFor JSON helpers to work, the dialect must automatically parse the `json` data type into\nJavaScript values. Check the driver contract before choosing a project assertion.\n\n"
      + "- An order must belong to the active tenant\n  at construction and after every transition.\n- An order shall not ship without lines.\n\n"
      + "**initialValue** (required): the initial value of the atom\n\n**key** (required): a unique key for the atom\n\n"
      + "| parameter | required | description |\n\n```ts\nAn example must not become a project assertion.\n```\n\n"
      + "This requirement must not be emitted as a truncated fragment. " + "x".repeat(600) + "\n";
    writeFileSync(join(root, "README.md"), readme);
    const result = discoverDocumentation(root);
    expect(result.requirements.map(item => ({ line: item.line, statement: item.statement }))).toEqual([
      { line: 3, statement: "For JSON helpers to work, the dialect must automatically parse the `json` data type into JavaScript values. Check the driver contract before choosing a project assertion." },
      { line: 6, statement: "An order must belong to the active tenant at construction and after every transition." },
      { line: 8, statement: "An order shall not ship without lines." },
    ]);
    expect(result.requirements.every(item => item.sourceHash === sha256(readme))).toBe(true);
    expect(result.customPack.status).toContain("no test or semantic coverage is inferred");
  });
});

function inScratch(dir: string, use: () => void): void {
  try { use(); } finally { removeTree(dir); }
}
