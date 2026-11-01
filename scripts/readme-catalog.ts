import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// README catalog block. Counts come from check.json files under catalog/ and packs/.
// A fitness primitive is an obligation that stays unverified until a project binds a command.
// A pattern check is counted once for each language key in impl.patterns.

const root = join(import.meta.dir, "..");
const begin = "<!-- BEGIN readme catalog -->";
const end = "<!-- END readme catalog -->";
const checking = process.argv.includes("--check");

type Check = { impl?: { kind?: string; primitive?: string; patterns?: Record<string, unknown> } };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name === "check.json") out.push(path);
  }
  return out;
}

function load(path: string): Check {
  return JSON.parse(readFileSync(path, "utf8")) as Check;
}

const coreFiles = walk(join(root, "catalog"));
const packFiles = walk(join(root, "packs"));
const fitness = (check: Check): boolean => check.impl?.kind === "primitive" && check.impl.primitive === "fitness";
const coreFitness = coreFiles.filter((path) => fitness(load(path))).length;
const coreStatic = coreFiles.length - coreFitness;
const packFitness = packFiles.filter((path) => fitness(load(path))).length;
const packStatic = packFiles.length - packFitness;
const languages = new Map<string, number>();
for (const path of packFiles) {
  const check = load(path);
  if (check.impl?.kind !== "pattern" || !check.impl.patterns) continue;
  for (const language of Object.keys(check.impl.patterns)) languages.set(language, (languages.get(language) ?? 0) + 1);
}

const packs = readdirSync(join(root, "packs"))
  .filter((name) => existsSync(join(root, "packs", name, "source.json")))
  .map((name) => JSON.parse(readFileSync(join(root, "packs", name, "source.json"), "utf8")) as { ns: string; category?: string })
  .sort((a, b) => a.ns.localeCompare(b.ns));
const byCategory = new Map<string, string[]>();
for (const pack of packs) {
  const category = pack.category ?? "unclassified";
  byCategory.set(category, [...(byCategory.get(category) ?? []), pack.ns]);
}

const languageLine = [...languages.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([language, count]) => `${language} ${count}`).join(", ");
const rows = [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  .map(([category, names]) => `| **${category}** | ${names.sort().map((name) => `\`${name}\``).join(", ")} |`);

const block = [
  begin,
  "",
  `Static checks: **${coreStatic + packStatic}** (${coreStatic} in core, ${packStatic} in optional packs). These can run from syntax or a diff.`,
  `Fitness obligations: **${coreFitness + packFitness}** (${coreFitness} in core, ${packFitness} in optional packs). A fitness obligation stays unverified, and does not block, until a project binds a command.`,
  `Pattern checks by language: ${languageLine}. A check with two languages is counted in each. These are pattern checks only, not a claim that every grammar has the same coverage.`,
  "",
  `${packs.length} optional packs, grouped by the category in each \`source.json\`. Names that are not in this table are not packs in this tree.`,
  "",
  "| Category | Packs |",
  "| --- | --- |",
  ...rows,
  "",
  end,
].join("\n");

const readmePath = join(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const start = readme.indexOf(begin);
const finish = readme.indexOf(end);
if (start < 0 || finish < 0 || finish < start) throw new Error("README.md is missing the readme catalog markers");
const updated = readme.slice(0, start) + block + readme.slice(finish + end.length);
if (updated === readme) console.log("README catalog matches the tree.");
else if (checking) {
  console.error("README catalog is stale. Run bun scripts/readme-catalog.ts.");
  process.exitCode = 1;
} else {
  writeFileSync(readmePath, updated);
  console.log("Updated README catalog from catalog/ and packs/.");
}
