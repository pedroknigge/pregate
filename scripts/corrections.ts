// A correction stays in this repository only when it names a test title or a rule id
// that already exists. A renamed test or a deleted rule makes the entry fail.
// The summary is the record. It does not satisfy the check.
import { readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { titlesIn, walkFiles } from "./test-titles.ts";

const ROOT = join(import.meta.dir, "..");
const LEDGER = "corrections.json";
const FIELDS = new Set(["id", "summary", "source", "test", "rule"]);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ReferenceIndex {
  tests: ReadonlySet<string>;
  rules: ReadonlySet<string>;
}

export function reviewLedger(raw: string, index: ReferenceIndex): string[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (error) { return [`${LEDGER} is not JSON: ${error instanceof Error ? error.message : String(error)}`]; }
  if (parsed === null || typeof parsed !== "object" || !Array.isArray((parsed as { entries?: unknown }).entries)) {
    return [`${LEDGER} needs an entries array.`];
  }
  const entries = (parsed as { entries: unknown[] }).entries;
  if (entries.length === 0) return [`${LEDGER} needs at least one entry.`];
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const [at, row] of entries.entries()) {
    problems.push(...entryProblems(row, at, seen, index));
  }
  return problems;
}

export function referenceIndex(root = ROOT): ReferenceIndex {
  const tests = new Set<string>();
  for (const path of walkFiles(join(root, "test"), (name) => name.endsWith(".test.ts"))) {
    for (const title of titlesIn(readFileSync(path, "utf8"))) tests.add(title);
  }
  const rules = new Set<string>();
  for (const path of [...walkFiles(join(root, "catalog"), isRuleFile), ...walkFiles(join(root, "packs"), isRuleFile)]) {
    const rel = path.slice(root.length + 1).replaceAll("\\", "/");
    const data = JSON.parse(readFileSync(path, "utf8")) as { id?: unknown; invariants?: { id?: unknown }[] };
    if (rel.endsWith("/check.json")) {
      if (typeof data.id === "string") rules.add(data.id);
    } else {
      for (const item of data.invariants ?? []) if (typeof item.id === "string") rules.add(item.id);
    }
  }
  return { tests, rules };
}

function entryProblems(row: unknown, at: number, seen: Set<string>, index: ReferenceIndex): string[] {
  const where = `entry ${at + 1}`;
  if (row === null || typeof row !== "object" || Array.isArray(row)) return [`${where} must be an object.`];
  const record = row as Record<string, unknown>;
  const id = typeof record.id === "string" && ID.test(record.id) ? record.id : "";
  const label = id === "" ? where : id;
  const problems: string[] = [];
  if (id === "") problems.push(`${where} needs an id of lowercase words separated by hyphens.`);
  else if (seen.has(id)) problems.push(`${id} is duplicated.`);
  if (id !== "") seen.add(id);
  for (const key of Object.keys(record)) if (!FIELDS.has(key)) problems.push(`${label}: unknown field ${key}.`);
  if (typeof record.summary !== "string" || record.summary.trim().length < 40) {
    problems.push(`${label}: summary must say what was wrong.`);
  }
  if (typeof record.source !== "string" || record.source.trim().length < 8) {
    problems.push(`${label}: source must name the changelog entry or the commit.`);
  }
  const test = typeof record.test === "string" ? record.test : undefined;
  const rule = typeof record.rule === "string" ? record.rule : undefined;
  const named = [test, rule].filter((item) => item !== undefined);
  if (named.length !== 1) {
    problems.push(`${label}: name exactly one of test or rule.`);
    return problems;
  }
  if (test !== undefined) {
    if (test === "" || !index.tests.has(test)) problems.push(`${label}: test ${JSON.stringify(test)} does not match a test() or it() title under test/.`);
  } else if (rule === undefined || rule === "" || !index.rules.has(rule)) {
    problems.push(`${label}: rule ${JSON.stringify(rule ?? "")} does not match a check id or an invariant id.`);
  }
  return problems;
}

function isRuleFile(name: string, dir: string): boolean {
  return name === "check.json" || (dir.endsWith(`${sep}methodologies`) && name.endsWith(".json"));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    console.error("Usage: bun scripts/corrections.ts [--check]");
    process.exit(1);
  }
  const problems = reviewLedger(readFileSync(join(ROOT, LEDGER), "utf8"), referenceIndex());
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}
