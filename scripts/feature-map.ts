// Every command the CLI actually dispatches has a row in feature-map.json.
// The row names how a person triggers it and a proof that already exists: an e2e
// test title, or an H1 in the verify-pregate feature files. The summary is the
// record. It does not satisfy the check.
import { Lang, parse, type SgNode } from "@ast-grep/napi";
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isE2eTest } from "./test-split.ts";
import { titlesIn, walkFiles } from "./test-titles.ts";

const ROOT = join(import.meta.dir, "..");
const MAP = "feature-map.json";
const FEATURES = join(".cursor", "skills", "verify-pregate", "features");
const FIELDS = new Set(["id", "summary", "cli", "hook", "test", "scenario"]);
const HOOK_FIELDS = new Set(["harness", "event", "tool"]);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOOK_WORD = /^[A-Za-z][A-Za-z0-9_-]*$/;

export interface FeatureIndex {
  commands: ReadonlySet<string>;
  tests: ReadonlySet<string>;
  scenarios: ReadonlySet<string>;
  harnesses: ReadonlySet<string>;
}

export interface Derived {
  values: string[];
  problems: string[];
}

export function commandList(cliSource: string, mainSource: string): Derived {
  const problems: string[] = [];
  const fn = functions(cliSource).find((node) => field(node, "name")?.text() === "command");
  const sw = fn?.findAll({ rule: { kind: "switch_statement" } }).find((node) => node.text().startsWith("switch (cmd)"));
  if (sw === undefined) problems.push("src/cli.ts has no switch (cmd) in function command.");
  const commands = sw === undefined ? [] : cases(sw).flatMap(caseLabel);
  if (!hookDispatch(mainSource)) problems.push("src/main.ts does not dispatch the hook command.");
  else commands.push("hook");
  return { values: commands, problems };
}

export function harnessNames(source: string): Derived {
  const decl = parse(Lang.TypeScript, source).root().findAll({ rule: { kind: "variable_declarator" } })
    .find((node) => field(node, "name")?.text() === "HARNESSES");
  const obj = decl?.find({ rule: { kind: "object" } }) ?? null;
  if (obj === null) return { values: [], problems: ["src/harness/profile.ts has no HARNESSES object."] };
  const names = obj.namedChildren().flatMap((prop) => {
    if (prop.kind() === "pair") return stringValue(prop.namedChildren()[0] ?? null);
    if (prop.kind() === "shorthand_property_identifier") return [prop.text()];
    return [];
  });
  return names.length === 0 ? { values: [], problems: ["src/harness/profile.ts has no HARNESSES object."] } : { values: names, problems: [] };
}

export function scenarioTitles(files: { name: string; text: string }[]): Derived {
  const problems: string[] = [];
  const titles: string[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const title = file.text.split("\n").find((line) => line.startsWith("# ") && !line.startsWith("## "))?.slice(2).trim() ?? "";
    if (title === "") problems.push(`${file.name} has no title.`);
    else if (seen.has(title)) problems.push(`scenario ${JSON.stringify(title)} is declared twice.`);
    else { seen.add(title); titles.push(title); }
  }
  return { values: titles, problems };
}

export function reviewFeatureMap(raw: string, index: FeatureIndex): string[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (error) { return [`${MAP} is not JSON: ${error instanceof Error ? error.message : String(error)}`]; }
  if (parsed === null || typeof parsed !== "object" || !Array.isArray((parsed as { features?: unknown }).features)) {
    return [`${MAP} needs a features array.`];
  }
  const features = (parsed as { features: unknown[] }).features;
  if (features.length === 0) return [`${MAP} needs at least one feature.`];
  const problems: string[] = [];
  const ids = new Set<string>();
  const cli = new Set<string>();
  const hooks = new Set<string>();
  const cited = new Set<string>();
  for (const [at, row] of features.entries()) problems.push(...featureProblems(row, at, ids, cli, hooks, cited, index));
  for (const command of index.commands) if (!cli.has(command)) problems.push(`CLI command ${JSON.stringify(command)} is not in the feature map.`);
  for (const command of cli) if (!index.commands.has(command)) problems.push(`cli ${JSON.stringify(command)} is not a command the CLI dispatches.`);
  for (const title of index.scenarios) if (!cited.has(title)) problems.push(`scenario ${JSON.stringify(title)} is not cited by any feature.`);
  return problems;
}

export function featureSummary(raw: string): string {
  const features = (JSON.parse(raw) as { features: { id: string; cli?: string; hook?: { harness: string; event: string; tool: string }; test?: string; scenario?: string }[] }).features;
  const rows = features.map((feature) => {
    const trigger = feature.cli !== undefined ? `\`pregate ${feature.cli}\`` : `\`${feature.hook?.harness} ${feature.hook?.event} ${feature.hook?.tool}\``;
    const proof = feature.test !== undefined ? `test: ${feature.test}` : `scenario: ${feature.scenario}`;
    return `| ${cell(feature.id)} | ${cell(trigger)} | ${cell(proof)} |`;
  });
  return [
    "### Feature map",
    "",
    "Each row is one feature. The trigger is the CLI command or the harness hook. The proof is an e2e test title or a verify-pregate scenario.",
    "",
    "| Feature | Trigger | Proof |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

export function problemsOf(root = ROOT): string[] {
  const commands = commandList(readFileSync(join(root, "src/cli.ts"), "utf8"), readFileSync(join(root, "src/main.ts"), "utf8"));
  const harnesses = harnessNames(readFileSync(join(root, "src/harness/profile.ts"), "utf8"));
  const scenarios = scenarioTitles(featureFiles(root));
  const structural = [...commands.problems, ...harnesses.problems, ...scenarios.problems];
  if (structural.length > 0) return structural;
  return reviewFeatureMap(readFileSync(join(root, MAP), "utf8"), {
    commands: new Set(commands.values),
    tests: e2eTitles(root),
    scenarios: new Set(scenarios.values),
    harnesses: new Set(harnesses.values),
  });
}

export function recordSummary(summary: string, env: NodeJS.ProcessEnv = process.env): void {
  const path = env.GITHUB_STEP_SUMMARY;
  if (path === undefined || path === "") return;
  appendFileSync(path, `\n${summary.endsWith("\n") ? summary : `${summary}\n`}`);
}

function featureProblems(row: unknown, at: number, ids: Set<string>, cli: Set<string>, hooks: Set<string>, cited: Set<string>, index: FeatureIndex): string[] {
  const where = `feature ${at + 1}`;
  if (row === null || typeof row !== "object" || Array.isArray(row)) return [`${where} must be an object.`];
  const record = row as Record<string, unknown>;
  const id = typeof record.id === "string" && ID.test(record.id) ? record.id : "";
  const label = id === "" ? where : id;
  const problems: string[] = [];
  if (id === "") problems.push(`${where} needs an id of lowercase words separated by hyphens.`);
  else if (ids.has(id)) problems.push(`${id} is duplicated.`);
  if (id !== "") ids.add(id);
  for (const key of Object.keys(record)) if (!FIELDS.has(key)) problems.push(`${label}: unknown field ${key}.`);
  if (typeof record.summary !== "string" || record.summary.trim().length < 40) problems.push(`${label}: summary must say what the user can do.`);
  const hasCli = typeof record.cli === "string";
  const hasHook = record.hook !== undefined;
  if (hasCli === hasHook) problems.push(`${label}: name exactly one of cli or hook.`);
  else if (hasCli) problems.push(...cliTrigger(label, record.cli as string, cli));
  else problems.push(...hookTrigger(label, record.hook, hooks, index));
  const test = typeof record.test === "string" ? record.test : undefined;
  const scenario = typeof record.scenario === "string" ? record.scenario : undefined;
  if ((test === undefined) === (scenario === undefined)) problems.push(`${label}: name exactly one of test or scenario.`);
  else if (test !== undefined) {
    if (!index.tests.has(test)) problems.push(`${label}: test ${JSON.stringify(test)} does not match a test() or it() title in an e2e file.`);
  } else if (!index.scenarios.has(scenario ?? "")) {
    problems.push(`${label}: scenario ${JSON.stringify(scenario ?? "")} does not match a feature title in verify-pregate.`);
  } else cited.add(scenario ?? "");
  return problems;
}

function cliTrigger(label: string, command: string, cli: Set<string>): string[] {
  if (command === "") return [`${label}: cli must name the command.`];
  if (cli.has(command)) return [`${label}: cli ${JSON.stringify(command)} is already mapped.`];
  cli.add(command);
  return [];
}

function hookTrigger(label: string, hook: unknown, hooks: Set<string>, index: FeatureIndex): string[] {
  if (hook === null || typeof hook !== "object" || Array.isArray(hook)) return [`${label}: hook must name harness, event, and tool.`];
  const record = hook as Record<string, unknown>;
  const problems: string[] = [];
  for (const key of Object.keys(record)) if (!HOOK_FIELDS.has(key)) problems.push(`${label}: unknown hook field ${key}.`);
  const harness = typeof record.harness === "string" ? record.harness : "";
  const event = typeof record.event === "string" ? record.event : "";
  const tool = typeof record.tool === "string" ? record.tool : "";
  if (!index.harnesses.has(harness)) problems.push(`${label}: hook harness ${JSON.stringify(harness)} is not a harness in src/harness/profile.ts.`);
  if (!HOOK_WORD.test(event)) problems.push(`${label}: hook event must name the harness event.`);
  if (!HOOK_WORD.test(tool)) problems.push(`${label}: hook tool must name the tool.`);
  const key = `${harness} ${event} ${tool}`;
  if (problems.length === 0 && hooks.has(key)) problems.push(`${label}: hook ${JSON.stringify(key)} is already mapped.`);
  if (problems.length === 0) hooks.add(key);
  return problems;
}

function e2eTitles(root: string): Set<string> {
  const titles = new Set<string>();
  for (const path of walkFiles(join(root, "test"), (name) => isE2eTest(name))) {
    for (const title of titlesIn(readFileSync(path, "utf8"))) titles.add(title);
  }
  return titles;
}

function featureFiles(root: string): { name: string; text: string }[] {
  const dir = join(root, FEATURES);
  return readdirSync(dir).filter((name) => name.endsWith(".md") && name !== "README.md").sort()
    .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
}

function functions(source: string): SgNode[] {
  return parse(Lang.TypeScript, source).root().findAll({ rule: { kind: "function_declaration" } });
}

function cases(sw: SgNode): SgNode[] {
  const body = sw.children().find((node) => node.kind() === "switch_body");
  return body?.namedChildren().filter((node) => node.kind() === "switch_case") ?? [];
}

function caseLabel(node: SgNode): string[] {
  return node.children().flatMap((child) => child.kind() === "string" ? stringValue(child) : []);
}

function hookDispatch(source: string): boolean {
  const fn = functions(source).find((node) => field(node, "name")?.text() === "main");
  if (fn === undefined) return false;
  return fn.findAll({ rule: { kind: "binary_expression" } }).some((node) => {
    if (!node.text().includes("!==")) return false;
    return node.text().includes("argv[0]") && node.findAll({ rule: { kind: "string" } }).some((child) => stringValue(child)[0] === "hook");
  });
}

function stringValue(node: SgNode | null): string[] {
  if (node === null || node.kind() !== "string" || !node.text().startsWith("\"")) return [];
  try {
    const value = JSON.parse(node.text()) as unknown;
    return typeof value === "string" ? [value] : [];
  } catch { return []; }
}

function field(node: SgNode, name: string): SgNode | null {
  return (node as { field(name: string): SgNode | null }).field(name);
}

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const summary = args.length === 1 && args[0] === "--summary";
  if (!summary && !(args.length === 0 || (args.length === 1 && args[0] === "--check"))) {
    console.error("Usage: bun scripts/feature-map.ts [--check|--summary]");
    process.exit(1);
  }
  const problems = problemsOf();
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  const text = featureSummary(readFileSync(join(ROOT, MAP), "utf8"));
  if (summary) process.stdout.write(text);
  else recordSummary(text);
}
