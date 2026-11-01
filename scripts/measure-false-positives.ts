// Measure pack findings on a pinned corpus and fixture density for `pregate rules test`.
// A false-positive rate is emitted only when every corpus finding is labeled correct or
// false-positive. A sample is not a rate, and this script does not invent one.
//
// Usage:
//   bun scripts/measure-false-positives.ts [--packs <dir>] [--catalog <dir>]
//     [--corpus <file>] [--labels <file>] [--cache <dir>] [--out <file>]
//     [--markdown <file>] [--core | --no-core]
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { setUpGrammars } from "../src/assets.ts";
import { auditRules } from "../src/audit.ts";
import { compile, listChecks } from "../src/compile.ts";
import { evaluationFingerprint, readTree } from "../src/disk.ts";
import { analyze } from "../src/evaluate.ts";
import { testCheck } from "../src/fixtures.ts";
import { languageApplies } from "../src/languages.ts";
import { ruleApplies } from "../src/paths.ts";
import { validate } from "../src/schema.ts";
import { errorIn, parse } from "../src/ts.ts";
import type { Files, Host, Lock, Manifest, Violation } from "../src/types.ts";
import { VERSIONS } from "../src/versions.ts";

const ROOT = resolve(import.meta.dir, "..");
const USAGE = `usage: measure-false-positives.ts [--packs <dir>] [--catalog <dir>] [--corpus <file>] [--labels <file>] [--cache <dir>] [--out <file>] [--markdown <file>] [--skip-offline] [--core | --no-core]`;
const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue|svelte|py|go|rs)$/i;
const EXCLUDE = new Set(["node_modules", "vendor", "dist", "build", "coverage", ".next", "target", ".git"]);
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const VERDICTS = new Set(["correct", "false-positive", "uncertain"]);
const LIMITS = [
  "The false-positive rate is unmeasured unless every corpus finding is labeled correct or false-positive. Reviewed-sample counts are not a rate, and this report does not turn them into one.",
  "A label says whether the finding matches the rule's stated condition. It is not a judgment that a project should adopt the rule, and it is not an 80% confidence estimate.",
  "The corpus is the pinned repositories in the manifest. It is not a random sample of public code.",
  "The audit reports every static match in the checked-out tree. It is not the no-new ratchet used on an edit, and it does not run fitness, diff, or placement checks.",
  "Methodologies that do not compile as one contract are audited separately. That pack's finding total is the sum of those audits, not one preset.",
  "The measurement preset declares no layers. A rule whose paths use @layers fails to compile and is listed under compile errors; it is not field-audited, and a missing finding is not evidence that the rule is clean. Imports resolve only from files inside the checkout.",
  "Fixture density and rules-test lines describe each pack's own fixtures. A passing fixture suite is not a field false-positive rate.",
  "Tracked files under node_modules, vendor, dist, build, coverage, .next, or target are not scanned. Symlinks are not followed.",
];

type Verdict = "correct" | "false-positive" | "uncertain";
type Rate = "unmeasured" | { falsePositives: number; labeledFindings: number };
interface Label {
  corpus: string; pack: string; methodology: string; rule: string; path: string; line: number; symbol: string;
  verdict: Verdict; note: string;
}
interface Finding {
  corpus: string; pack: string; methodology: string; rule: string; check: string; path: string; line: number;
  symbol: string; measured: number | null; limit: number | null; severity: string;
}
interface FileError { corpus: string; pack: string; path: string; cause: string; line: number | null; message: string | null }
interface RuleDensity { rule: string; check: string; methodology: string; pass: number; fail: number; trap: number; positive: number; negative: number }
interface Activation { methodologies: string[]; lock: Lock | null; skipped: { rule: string; check: string; reason: string }[]; errors: string[] }
interface PackResult {
  ns: string; version: string; root: string; contentHash: string; activation: "builtin" | "combined" | "split" | "not-compiled";
  compileErrors: string[]; methodologies: string[];
  rulesAudited: number; idleRules: number; skipped: { rule: string; check: string; reason: string }[];
  byRule: { rule: string; aliases: string[]; check: string; methodology: string; findings: number; files: number; filesApplied: number }[];
  rulesTest: { checks: number; okLines: number; failLines: string[] };
  fixtureDensity: { checks: number; rules: number; fixtures: number; positiveFixtures: number; negativeFixtures: number; invalidFixtures: number; perRule: RuleDensity[]; checksWithNoPositiveFixture: string[]; checksWithNoNegativeFixture: string[]; rulesWithNoPositiveFixture: string[]; rulesWithNoNegativeFixture: string[] };
  findings: number; fpRate: Rate;
}
interface CorpusResult {
  id: string; kind: "git" | "path"; url: string | null; commit: string; contentHash: string;
  sourceFiles: number; parsed: number; syntaxErrors: { path: string; line: number }[]; binary: number; oversize: number; symlinks: number; missing: number;
}
interface Report {
  schemaVersion: 1; engine: string; core: string; evaluatorFingerprint: string; fpRate: Rate;
  rawMatches: number; limits: string[]; corpus: CorpusResult[];
  fixtureDensity: PackResult["fixtureDensity"] & { fixturesPerRule: { min: number | null; median: number | null; max: number | null } };
  packs: Omit<PackResult, "fixtureDensity">[];
  findings: Finding[]; fileErrors: FileError[];
  labeledSample: { correct: number; falsePositive: number; uncertain: number; unlabeledFindings: number; unmatchedLabels: Label[]; items: (Finding & { verdict: Verdict; note: string })[] };
}

interface Options {
  packs: string; catalog: string; corpus: string; labels: string | null; cache: string; out: string | null; markdown: string | null; core: boolean; skipOffline: boolean;
}

function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  return measure(options).then((report) => {
    if (report === null) return;
    const json = stableJson(report), markdown = render(report);
    if (options.out) writeFileSync(options.out, json);
    else process.stdout.write(json);
    if (options.markdown) writeFileSync(options.markdown, markdown);
    console.error(`measure: ${report.packs.length} packs, ${report.findings.length} corpus findings, fpRate ${rateText(report.fpRate)}`);
  });
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    packs: resolve(ROOT, "packs"), catalog: resolve(ROOT, "catalog"), corpus: resolve(ROOT, "docs/benchmarks/corpus.json"),
    labels: null, cache: resolve(ROOT, ".cache/false-positives"), out: null, markdown: null, core: true, skipOffline: false,
  };
  const args = [...argv];
  const take = (flag: string): string => {
    const value = args.shift();
    if (value === undefined || value.startsWith("--")) throw new Error(`missing value for ${flag}\n${USAGE}`);
    return value;
  };
  while (args.length) {
    const flag = args.shift()!;
    if (flag === "--packs") o.packs = resolve(take(flag));
    else if (flag === "--catalog") o.catalog = resolve(take(flag));
    else if (flag === "--corpus") o.corpus = resolve(take(flag));
    else if (flag === "--labels") o.labels = resolve(take(flag));
    else if (flag === "--cache") o.cache = resolve(take(flag));
    else if (flag === "--out") o.out = resolve(take(flag));
    else if (flag === "--markdown") o.markdown = resolve(take(flag));
    else if (flag === "--core") o.core = true;
    else if (flag === "--no-core") o.core = false;
    else if (flag === "--skip-offline") o.skipOffline = true;
    else throw new Error(`unknown argument ${flag}\n${USAGE}`);
  }
  return o;
}

async function measure(options: Options): Promise<Report | null> {
  const entries = loadCorpus(options.corpus);
  const repos: LoadedRepo[] = [];
  for (const entry of entries) {
    const repo = loadRepo(entry, options.cache, options.skipOffline);
    if (repo === null) {
      console.error("measure: full corpus fetch skipped (offline); results were not rewritten");
      return null;
    }
    repos.push(repo);
  }
  await setUpGrammars();
  const labels = options.labels === null ? [] : loadLabels(options.labels);
  const catalog = readTree(options.catalog, options.core);
  const dirs = packDirs(options.packs);
  console.error(`measure: preparing ${dirs.length} packs${options.core ? " and core" : ""}`);
  const prepared = options.core ? [preparePack(options.catalog, catalog, catalog, true)] : [];
  for (const dir of dirs) prepared.push(preparePack(dir, readTree(dir, true), catalog, false));
  const activations = prepared.flatMap((pack) => pack.activations.flatMap((activation) => activation.lock === null ? [] : [{ pack: pack.ns, activation }]));
  const methodologyByRule = new Map(prepared.flatMap((pack) => pack.density.perRule.map((rule) => [rule.rule, rule.methodology] as const)));
  const matches: Finding[] = [], fileErrors: FileError[] = [];
  const applied = new Map<string, number>();
  for (const repo of repos) {
    console.error(`measure: auditing ${repo.id} (${repo.files.length} parsed candidates)`);
    const host: Host = { read: (path) => repo.texts.get(path) ?? null, now: () => performance.now(), hash: false };
    for (const file of repo.files) {
      let parsed: ReturnType<typeof parse> | null = null;
      try {
        parsed = parse(file.rel, file.text);
        const line = errorIn(parsed, null);
        if (line !== null) { repo.syntaxErrors.push({ path: file.rel, line }); continue; }
        repo.parsed++;
        for (const item of activations) {
          const rules = item.activation.lock!.rules.filter((rule) => languageApplies(rule, file.rel) && ruleApplies(rule, file.rel));
          if (!rules.length) continue;
          for (const rule of rules) applied.set(appliedKey(item.pack, rule.id), (applied.get(appliedKey(item.pack, rule.id)) ?? 0) + 1);
          const result = analyze({ ...item.activation.lock!, rules }, "ci", file.rel, parsed, host);
          if ("cause" in result) fileErrors.push({ corpus: repo.id, pack: item.pack, path: file.rel, cause: result.cause, line: result.line, message: result.detail ?? null });
          else for (const violation of result.violations) matches.push(toFinding(repo.id, item.pack, item.activation, violation, methodologyByRule));
        }
      } catch (e) {
        fileErrors.push({ corpus: repo.id, pack: "", path: file.rel, cause: "threw", line: null, message: e instanceof Error ? e.message : String(e) });
      } finally { parsed?.root.tree.delete(); }
    }
    repo.syntaxErrors.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line);
  }
  const rawMatches = matches.length;
  const findings = distinctSites(matches);
  fileErrors.sort((a, b) => a.corpus < b.corpus ? -1 : a.corpus > b.corpus ? 1 : a.pack < b.pack ? -1 : a.pack > b.pack ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : (a.line ?? 0) - (b.line ?? 0));
  const labelBySite = new Map(labels.map((label) => [siteKey(label), label]));
  const packs = prepared.map((pack) => finishPack(pack, findings, applied, labelBySite)).sort((a, b) => a.ns < b.ns ? -1 : a.ns > b.ns ? 1 : 0);
  const matched = new Set<string>();
  const items = findings.flatMap((finding) => {
    const label = labelBySite.get(siteKey(finding));
    if (!label) return [];
    matched.add(siteKey(finding));
    return [{ ...finding, verdict: label.verdict, note: label.note }];
  });
  const unmatched = labels.filter((label) => !matched.has(siteKey(label))).sort((a, b) => siteKey(a) < siteKey(b) ? -1 : 1);
  const labeledSample = {
    correct: items.filter((item) => item.verdict === "correct").length,
    falsePositive: items.filter((item) => item.verdict === "false-positive").length,
    uncertain: items.filter((item) => item.verdict === "uncertain").length,
    unlabeledFindings: findings.length - items.length,
    unmatchedLabels: unmatched, items,
  };
  const fixtureDensity = combineDensity(prepared);
  return {
    schemaVersion: 1, engine: VERSIONS.engine, core: VERSIONS.core, evaluatorFingerprint: evaluationFingerprint(ROOT),
    fpRate: rateOf(findings, labelBySite), rawMatches, limits: LIMITS,
    corpus: repos.map(corpusResult), fixtureDensity,
    packs: packs.map(({ fixtureDensity: _density, ...pack }) => pack),
    findings, fileErrors, labeledSample,
  };
}

interface Prepared {
  ns: string; version: string; root: string; contentHash: string; activation: PackResult["activation"];
  activations: Activation[]; methodologies: string[]; density: PackResult["fixtureDensity"]; rulesTest: PackResult["rulesTest"];
}

function preparePack(dir: string, files: Files, catalog: Files, builtin: boolean): Prepared {
  const meta = JSON.parse(files["source.json"] ?? "{}") as { ns?: string; version?: string };
  const ns = meta.ns ?? basename(dir), version = meta.version ?? "";
  const root = relative(ROOT, dir) || basename(dir);
  try {
    const density = fixtureDensity(ns, files);
    const rulesTest = runRulesTest(files);
    const methodologies = methodologyIds(files);
    let activation: Prepared["activation"] = builtin ? "builtin" : "combined";
    let activations: Activation[];
    if (builtin) activations = [compileMethodologies(ns, [], catalog, files, true)];
    else if (methodologies.length === 0) {
      activation = "not-compiled";
      activations = [];
    } else {
      const combined = compileMethodologies(ns, methodologies, catalog, files, false);
      if (combined.lock || methodologies.length === 1) activations = [combined];
      else {
        activation = "split";
        activations = methodologies.map((id) => compileMethodologies(ns, [id], catalog, files, false));
      }
    }
    if (activations.some((item) => item.errors.length) && activation !== "split") activation = activations.some((item) => item.lock) ? activation : "not-compiled";
    console.error(`measure: ${ns} ${activation}`);
    return { ns, version, root, contentHash: treeHash(files), activation, activations, methodologies, density, rulesTest };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`measure: ${ns} failed: ${message}`);
    return {
      ns, version, root, contentHash: treeHash(files), activation: "not-compiled", methodologies: [],
      activations: [{ methodologies: [], lock: null, skipped: [], errors: [message] }],
      density: emptyDensity(), rulesTest: { checks: 0, okLines: 0, failLines: [message] },
    };
  }
}

function compileMethodologies(ns: string, methodologies: string[], catalog: Files, pack: Files, builtin: boolean): Activation {
  const preset = {
    name: "fp-measure", version: "0.0.0", engine: VERSIONS.engine, enforcement: "shadow", methodologies,
    sources: builtin ? [{ ns: "core", kind: "builtin", version: VERSIONS.core }]
      : [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns, kind: "path", path: ns }],
  };
  const compiled = compile(JSON.stringify(preset), (source) => source.kind === "builtin" ? catalog : source.kind === "path" && source.ns === ns ? pack : null, VERSIONS);
  if ("errors" in compiled) return { methodologies, lock: null, skipped: [], errors: compiled.errors };
  const selected = auditRules(compiled.lock);
  const prefix = `${ns}/`;
  return {
    methodologies, errors: [],
    lock: { ...selected.lock, rules: selected.lock.rules.filter((rule) => rule.id.startsWith(prefix)) },
    skipped: selected.skipped.filter((rule) => rule.rule.startsWith(prefix)),
  };
}

function runRulesTest(files: Files): PackResult["rulesTest"] {
  const listed = listChecks(files);
  if ("errors" in listed) return { checks: 0, okLines: 0, failLines: listed.errors };
  const lines = listed.ids.flatMap((id) => testCheck(files, id, () => performance.now()).lines);
  return { checks: listed.ids.length, okLines: lines.filter((line) => line.startsWith("ok")).length, failLines: lines.filter((line) => !line.startsWith("ok")).sort() };
}

function fixtureDensity(ns: string, files: Files): PackResult["fixtureDensity"] {
  const checks = new Set<string>();
  for (const path of Object.keys(files)) {
    const match = /^checks\/([^/]+)\/([^/]+)\/check\.json$/.exec(path);
    if (match) checks.add(`${ns}/${match[1]}/${match[2]}`);
  }
  const cases = new Map<string, { check: string; kind: "pass" | "fail" | "trap"; files: Files }>();
  for (const [path, text] of Object.entries(files)) {
    const match = /^checks\/([^/]+)\/([^/]+)\/fixtures\/(pass|fail|trap)\/([^/]+)\/(.+)$/.exec(path);
    if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5]) continue;
    const check = `${ns}/${match[1]}/${match[2]}`;
    checks.add(check);
    const key = `${check}\0${match[3]}/${match[4]}`;
    const row = cases.get(key) ?? { check, kind: match[3] as "pass" | "fail" | "trap", files: {} };
    row.files[match[5]] = text;
    cases.set(key, row);
  }
  const counts = new Map<string, { pass: number; fail: number; trap: number; invalid: number }>();
  const bump = (check: string) => counts.get(check) ?? { pass: 0, fail: 0, trap: 0, invalid: 0 };
  let invalidFixtures = 0;
  for (const row of cases.values()) {
    const count = bump(row.check);
    const problem = fixtureProblem(row.files, row.kind);
    if (problem) { count.invalid++; invalidFixtures++; }
    else count[row.kind]++;
    counts.set(row.check, count);
  }
  const aliases = aliasesOf(ns, files);
  const perRule = aliases.map((alias) => {
    const count = counts.get(alias.check) ?? { pass: 0, fail: 0, trap: 0, invalid: 0 };
    return { rule: alias.rule, check: alias.check, methodology: alias.methodology, pass: count.pass, fail: count.fail, trap: count.trap, positive: count.fail + count.trap, negative: count.pass };
  }).sort((a, b) => a.rule < b.rule ? -1 : 1);
  const checkRows = [...checks].sort().map((check) => ({ check, ...(counts.get(check) ?? { pass: 0, fail: 0, trap: 0, invalid: 0 }) }));
  return {
    checks: checks.size, rules: perRule.length,
    fixtures: [...counts.values()].reduce((sum, count) => sum + count.pass + count.fail + count.trap, 0),
    positiveFixtures: [...counts.values()].reduce((sum, count) => sum + count.fail + count.trap, 0),
    negativeFixtures: [...counts.values()].reduce((sum, count) => sum + count.pass, 0),
    invalidFixtures, perRule,
    checksWithNoPositiveFixture: checkRows.filter((row) => row.fail + row.trap === 0).map((row) => row.check),
    checksWithNoNegativeFixture: checkRows.filter((row) => row.pass === 0).map((row) => row.check),
    rulesWithNoPositiveFixture: perRule.filter((rule) => rule.positive === 0).map((rule) => rule.rule),
    rulesWithNoNegativeFixture: perRule.filter((rule) => rule.negative === 0).map((rule) => rule.rule),
  };
}

function fixtureProblem(files: Files, kind: "pass" | "fail" | "trap"): string | null {
  let doc: unknown;
  try { doc = JSON.parse(files["fixture.json"] ?? ""); }
  catch { return "missing or invalid JSON"; }
  const invalid = validate("fixture", doc);
  if (invalid.length) return invalid.join("; ");
  const verdict = (doc as { expect: { verdict: string } }).expect.verdict;
  if (kind === "pass" && verdict !== "pass") return "pass fixture expects a failure";
  if (kind !== "pass" && verdict !== "fail") return "fail and trap fixtures must expect fail";
  return null;
}

function aliasesOf(ns: string, files: Files): { rule: string; check: string; methodology: string }[] {
  const out: { rule: string; check: string; methodology: string }[] = [];
  for (const path of Object.keys(files).sort()) {
    if (!/^methodologies\/[^/]+\.json$/.test(path)) continue;
    const manifest = JSON.parse(files[path]!) as Manifest;
    for (const alias of manifest.invariants) out.push({ rule: `${ns}/${alias.id}`, check: alias.check, methodology: manifest.id });
  }
  return out;
}

function methodologyIds(files: Files): string[] {
  return aliasesOf("", files).map((alias) => alias.methodology).filter((id, index, all) => all.indexOf(id) === index).sort();
}

function finishPack(pack: Prepared, findings: Finding[], applied: Map<string, number>, labels: Map<string, Label>): PackResult {
  const mine = findings.filter((finding) => finding.pack === pack.ns);
  const skipped = pack.activations.flatMap((activation) => activation.skipped);
  const locks = pack.activations.flatMap((activation) => activation.lock ? [activation.lock] : []);
  const seen = new Set<string>();
  const byRule = locks.flatMap((lock) => lock.rules).filter((rule) => seen.has(rule.id) ? false : (seen.add(rule.id), true)).map((rule) => {
    const hits = mine.filter((finding) => finding.rule === rule.id);
    const files = new Set(hits.map((finding) => `${finding.corpus}\0${finding.path}`));
    return {
      rule: rule.id, aliases: [...rule.aliases].sort(), check: rule.check, methodology: mine.find((finding) => finding.rule === rule.id)?.methodology ?? methodologyOf(pack, rule.id),
      findings: hits.length, files: files.size, filesApplied: applied.get(appliedKey(pack.ns, rule.id)) ?? 0,
    };
  }).sort((a, b) => a.rule < b.rule ? -1 : 1);
  const rulesAudited = byRule.length;
  return {
    ns: pack.ns, version: pack.version, root: pack.root, contentHash: pack.contentHash, activation: pack.activation,
    compileErrors: [...new Set(pack.activations.flatMap((activation) => activation.errors))].sort(),
    methodologies: pack.methodologies, rulesAudited, idleRules: byRule.filter((rule) => rule.filesApplied === 0).length, skipped,
    byRule, rulesTest: pack.rulesTest, fixtureDensity: pack.density, findings: mine.length, fpRate: rateOf(mine, labels),
  };
}

function methodologyOf(pack: Prepared, rule: string): string {
  return pack.density.perRule.find((item) => item.rule === rule)?.methodology ?? "";
}

function toFinding(corpus: string, pack: string, activation: Activation, violation: Violation, methodologyByRule: Map<string, string>): Finding {
  const rule = activation.lock?.rules.find((item) => item.id === violation.rule);
  return {
    corpus, pack, methodology: methodologyByRule.get(violation.rule) ?? (activation.methodologies.length === 1 ? activation.methodologies[0]! : ""),
    rule: violation.rule, check: rule?.check ?? "", path: violation.path, line: violation.line, symbol: violation.symbol,
    measured: violation.measured, limit: violation.limit, severity: violation.severity,
  };
}

type ManifestEntry = { id: string; kind: "git"; url: string; commit: string; sha256: string } | { id: string; kind: "path"; path: string; commit: string }

function loadCorpus(file: string): ManifestEntry[] {
  if (!existsSync(file)) throw new Error(`corpus not found: ${file}`);
  const doc = JSON.parse(readFileSync(file, "utf8")) as { entries?: unknown };
  if (!Array.isArray(doc.entries) || doc.entries.length === 0) throw new Error("corpus entries must be a non-empty array");
  const entries = doc.entries.map((entry) => manifestEntry(entry));
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`duplicate corpus id ${entry.id}`);
    ids.add(entry.id);
  }
  return entries.sort((a, b) => a.id < b.id ? -1 : 1);
}

function manifestEntry(value: unknown): ManifestEntry {
  if (typeof value !== "object" || value === null) throw new Error("corpus entry must be an object");
  const entry = value as Record<string, unknown>;
  const id = entry.id, kind = entry.kind, commit = entry.commit;
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error("corpus id must match ^[a-z0-9][a-z0-9-]*$");
  if (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit)) throw new Error(`${id}: commit must be a 40-character sha`);
  if (kind === "git") {
    if (typeof entry.url !== "string" || !/^https:\/\/[^@\s]+$/.test(entry.url)) throw new Error(`${id}: git url must be https`);
    if (typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) throw new Error(`${id}: sha256 must pin the scanned source bytes`);
    return { id, kind, url: entry.url, commit, sha256: entry.sha256 };
  }
  if (kind === "path") {
    if (typeof entry.path !== "string" || entry.path.startsWith("-")) throw new Error(`${id}: path is required`);
    return { id, kind, path: resolve(entry.path), commit };
  }
  throw new Error(`${id}: kind must be git or path`);
}

interface LoadedRepo {
  id: string; kind: "git" | "path"; url: string | null; commit: string; contentHash: string;
  sourceFiles: number; parsed: number; syntaxErrors: { path: string; line: number }[]; binary: number; oversize: number; symlinks: number; missing: number;
  files: { rel: string; text: string }[]; texts: Map<string, string>;
}

function loadRepo(entry: ManifestEntry, cache: string, skipOffline: boolean): LoadedRepo | null {
  let dir: string;
  try {
    dir = entry.kind === "git" ? checkoutGit(entry, cache) : entry.path;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (entry.kind === "git" && skipOffline && offline(message)) return null;
    throw error;
  }
  const head = git(dir, ["rev-parse", "HEAD"]).trim();
  if (head !== entry.commit) throw new Error(`${entry.id}: pinned commit ${entry.commit} does not match HEAD ${head}`);
  if (git(dir, ["status", "--porcelain"]).trim()) throw new Error(`${entry.id}: checkout is dirty`);
  const listed = git(dir, ["ls-files", "-z"]).split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  const texts = new Map<string, string>();
  const files: { rel: string; text: string }[] = [];
  let binary = 0, oversize = 0, symlinks = 0, missing = 0, sourceFiles = 0;
  for (const rel of listed) {
    if (excluded(rel)) continue;
    const abs = resolve(dir, rel);
    if (!existsSync(abs)) { missing++; continue; }
    const stat = lstatSync(abs);
    if (stat.isSymbolicLink()) { symlinks++; continue; }
    if (!stat.isFile()) continue;
    if (!SOURCE.test(rel) && !/(^|\/)(package\.json|tsconfig.*\.json)$/.test(rel)) continue;
    if (stat.size > MAX_SOURCE_BYTES) { oversize++; continue; }
    const bytes = readFileSync(abs);
    if (!SOURCE.test(rel)) { if (!bytes.includes(0)) texts.set(rel, bytes.toString("utf8")); continue; }
    sourceFiles++;
    hash.update(rel); hash.update("\0"); hash.update(bytes); hash.update("\0");
    if (bytes.includes(0)) { binary++; continue; }
    const text = bytes.toString("utf8");
    texts.set(rel, text);
    files.push({ rel, text });
  }
  const contentHash = hash.digest("hex");
  if (entry.kind === "git" && contentHash !== entry.sha256) throw new Error(`${entry.id}: sha256 ${contentHash} does not match pin ${entry.sha256}`);
  return {
    id: entry.id, kind: entry.kind, url: entry.kind === "git" ? entry.url : null, commit: entry.commit, contentHash,
    sourceFiles, parsed: 0, syntaxErrors: [], binary, oversize, symlinks, missing, files, texts,
  };
}

function checkoutGit(entry: Extract<ManifestEntry, { kind: "git" }>, cache: string): string {
  const dir = resolve(cache, entry.id);
  if (cachedCommit(dir) === entry.commit) return dir;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  git(dir, ["init", "-q"]);
  git(dir, ["remote", "add", "origin", entry.url]);
  git(dir, ["fetch", "--quiet", "--depth", "1", "origin", entry.commit]);
  git(dir, ["checkout", "--quiet", "--detach", "FETCH_HEAD"]);
  return dir;
}

function cachedCommit(dir: string): string | null {
  if (!existsSync(resolve(dir, ".git"))) return null;
  try {
    if (git(dir, ["status", "--porcelain"]).trim()) return null;
    return git(dir, ["rev-parse", "HEAD"]).trim();
  } catch { return null; }
}

function offline(message: string): boolean {
  return /connect|resolve host|unable to access|network is unreachable|name or service not known|early eof|timed out/i.test(message);
}

function git(cwd: string, args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe", timeout: 180000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (result.exitCode !== 0) throw new Error(`git ${args[0]} failed in ${cwd}: ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
}

function corpusResult(repo: LoadedRepo): CorpusResult {
  return {
    id: repo.id, kind: repo.kind, url: repo.url, commit: repo.commit, contentHash: repo.contentHash, sourceFiles: repo.sourceFiles,
    parsed: repo.parsed, syntaxErrors: repo.syntaxErrors, binary: repo.binary, oversize: repo.oversize, symlinks: repo.symlinks, missing: repo.missing,
  };
}

function loadLabels(file: string): Label[] {
  if (!existsSync(file)) throw new Error(`labels not found: ${file}`);
  const doc = JSON.parse(readFileSync(file, "utf8")) as { items?: unknown };
  if (!Array.isArray(doc.items)) throw new Error("labels items must be an array");
  const labels = doc.items.map(labelOf);
  const seen = new Set<string>();
  for (const label of labels) {
    const key = siteKey(label);
    if (seen.has(key)) throw new Error(`duplicate label for ${label.corpus} ${label.rule} ${label.path}:${label.line}`);
    seen.add(key);
  }
  return labels;
}

function labelOf(value: unknown): Label {
  if (typeof value !== "object" || value === null) throw new Error("label must be an object");
  const label = value as Record<string, unknown>;
  const keys = ["corpus", "pack", "methodology", "rule", "path", "line", "symbol", "verdict", "note"];
  for (const key of Object.keys(label)) if (!keys.includes(key)) throw new Error(`unknown label field ${key}`);
  for (const key of keys) if (!Object.hasOwn(label, key)) throw new Error(`label missing ${key}`);
  if (typeof label.line !== "number" || !Number.isInteger(label.line) || label.line < 1) throw new Error("label line must be a positive integer");
  if (typeof label.verdict !== "string" || !VERDICTS.has(label.verdict)) throw new Error("label verdict must be correct, false-positive, or uncertain");
  if (typeof label.note !== "string" || label.note.trim() === "") throw new Error("label note must explain the verdict");
  for (const key of ["corpus", "pack", "methodology", "rule", "path", "symbol"] as const) if (typeof label[key] !== "string" || label[key] === "") throw new Error(`label ${key} must be a string`);
  return label as unknown as Label;
}

function rateOf(findings: Finding[], labels: Map<string, Label>): Rate {
  if (findings.length === 0) return "unmeasured";
  let falsePositives = 0;
  for (const finding of findings) {
    const label = labels.get(siteKey(finding));
    if (!label || label.verdict === "uncertain") return "unmeasured";
    if (label.verdict === "false-positive") falsePositives++;
  }
  return { falsePositives, labeledFindings: findings.length };
}

function combineDensity(packs: Prepared[]): Report["fixtureDensity"] {
  const perRule = packs.flatMap((pack) => pack.density.perRule).sort((a, b) => a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0);
  const counts = perRule.map((rule) => rule.pass + rule.fail + rule.trap);
  const union = (pick: (density: PackResult["fixtureDensity"]) => string[]) => [...new Set(packs.flatMap((pack) => pick(pack.density)))].sort();
  return {
    checks: packs.reduce((sum, pack) => sum + pack.density.checks, 0),
    rules: perRule.length,
    fixtures: packs.reduce((sum, pack) => sum + pack.density.fixtures, 0),
    positiveFixtures: packs.reduce((sum, pack) => sum + pack.density.positiveFixtures, 0),
    negativeFixtures: packs.reduce((sum, pack) => sum + pack.density.negativeFixtures, 0),
    invalidFixtures: packs.reduce((sum, pack) => sum + pack.density.invalidFixtures, 0),
    perRule,
    checksWithNoPositiveFixture: union((density) => density.checksWithNoPositiveFixture),
    checksWithNoNegativeFixture: union((density) => density.checksWithNoNegativeFixture),
    rulesWithNoPositiveFixture: perRule.filter((rule) => rule.positive === 0).map((rule) => rule.rule),
    rulesWithNoNegativeFixture: perRule.filter((rule) => rule.negative === 0).map((rule) => rule.rule),
    fixturesPerRule: { min: counts.length ? Math.min(...counts) : null, median: median(counts), max: counts.length ? Math.max(...counts) : null },
  };
}

function emptyDensity(): PackResult["fixtureDensity"] {
  return { checks: 0, rules: 0, fixtures: 0, positiveFixtures: 0, negativeFixtures: 0, invalidFixtures: 0, perRule: [], checksWithNoPositiveFixture: [], checksWithNoNegativeFixture: [], rulesWithNoPositiveFixture: [], rulesWithNoNegativeFixture: [] };
}

function render(report: Report): string {
  const optional = report.packs.filter((pack) => pack.ns !== "core").length;
  const core = report.packs.some((pack) => pack.ns === "core");
  const lines = [
    "# False-positive measurement",
    "",
    `**False-positive rate: ${rateText(report.fpRate)}.**`,
    "",
    `This run audited ${optional} optional pack${optional === 1 ? "" : "s"}${core ? " and the builtin core" : ""} against ${report.corpus.length} pinned ${report.corpus.length === 1 ? "tree" : "repositories"} (${report.corpus.reduce((sum, repo) => sum + repo.sourceFiles, 0)} source files) and recorded **${report.findings.length} findings** (${report.rawMatches} raw match${report.rawMatches === 1 ? "" : "es"}; a site that a rule matched more than once is one finding). ${rateSentence(report)} Fixture density for \`pregate rules test\` is separate: ${report.fixtureDensity.checks} checks, ${report.fixtureDensity.rules} rules, ${report.fixtureDensity.fixtures} fixtures, ${report.fixtureDensity.rulesWithNoPositiveFixture.length} rules with no positive fixture, and ${report.fixtureDensity.rulesWithNoNegativeFixture.length} rules with no negative fixture.`,
    "",
    "Labeled sample (not a rate): " + `${report.labeledSample.correct} correct, ${report.labeledSample.falsePositive} false-positive, ${report.labeledSample.uncertain} uncertain, ${report.labeledSample.unlabeledFindings} unlabeled findings.`,
    "",
    "## Method",
    "",
    "1. Shallow-fetch each git corpus entry at its pinned commit into the gitignored cache (`.cache/false-positives` unless `--cache` is set). Reuse a clean cache whose HEAD is that commit. Verify the scanned source sha256 against the manifest. With `--skip-offline`, a failed fetch leaves committed results untouched. A path entry must already be a checkout of its commit and is never skipped.",
    "2. For each pack, compile a shadow preset containing the builtin core and that pack's methodologies. Core methodologies are always part of a compiled preset. If the pack methodologies do not compile together, compile each methodology on its own.",
    "3. Parse every tracked source file with an extension the engine supports, skipping `node_modules`, `vendor`, `dist`, `build`, `coverage`, `.next`, and `target`. Record static findings. One finding is one site: corpus, pack, methodology, rule, path, line, and symbol. A rule that matches that site more than once still produces one finding. Fitness, diff, and placement checks are counted as not field-audited.",
    "4. Run the same check execution as `pregate rules test` on every check, and count `pass` fixtures as negative and `fail` plus `trap` fixtures as positive.",
    "5. Apply labels from the label file. Each label names one site. The rate is `falsePositives / labeledFindings` only when every finding in that set is labeled `correct` or `false-positive`.",
    "",
    `Engine ${report.engine}, core ${report.core}. Evaluator fingerprint \`${report.evaluatorFingerprint}\` covers \`src\`, \`schema\`, the parser wasm, and the Bun version that ran this script.`,
    "",
    "## Corpus",
    "",
    "| Id | Kind | Commit | Source files | Parsed | Syntax errors | Content hash |",
    "| --- | --- | --- | ---: | ---: | ---: | --- |",
    ...report.corpus.map((repo) => `| ${repo.id} | ${repo.kind} | \`${repo.commit}\` | ${repo.sourceFiles} | ${repo.parsed} | ${repo.syntaxErrors.length} | \`${repo.contentHash}\` |`),
    "",
    ...report.corpus.filter((repo) => repo.url).map((repo) => `- ${repo.id}: ${repo.url}`),
    "",
    "## Fixture density",
    "",
    `Fixtures per rule: min ${num(report.fixtureDensity.fixturesPerRule.min)}, median ${num(report.fixtureDensity.fixturesPerRule.median)}, max ${num(report.fixtureDensity.fixturesPerRule.max)}. Positive fixtures: ${report.fixtureDensity.positiveFixtures}. Negative fixtures: ${report.fixtureDensity.negativeFixtures}. Invalid fixtures: ${report.fixtureDensity.invalidFixtures}. \`pregate rules test\` failing lines: ${report.packs.reduce((sum, pack) => sum + pack.rulesTest.failLines.length, 0)}.`,
    "",
    "A positive fixture is a valid `fail/` or `trap/` case. A negative fixture is a valid `pass/` case. Totals count each fixture once per check. Min, median, and max count that check's fixtures again for every alias, so two aliases of one check contribute the same number twice. A rule with no positive or negative fixture is an alias whose check has none. `--out` writes per-rule counts to a local JSON file. That file is not part of the repository.",
    "",
    listOrNone("Rules with no positive fixture", report.fixtureDensity.rulesWithNoPositiveFixture),
    "",
    listOrNone("Rules with no negative fixture", report.fixtureDensity.rulesWithNoNegativeFixture),
    "",
    listOrNone("Checks with no positive fixture", report.fixtureDensity.checksWithNoPositiveFixture),
    "",
    listOrNone("Checks with no negative fixture", report.fixtureDensity.checksWithNoNegativeFixture),
    "",
    "## Per-pack raw counts",
    "",
    "| Pack | Activation | Findings | FP rate | Static rules | Idle | Not field-audited | Rules-test failures | Rules missing +fixture | Rules missing −fixture |",
    "| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.packs.map((pack) => {
      const density = report.fixtureDensity.perRule.filter((rule) => rule.rule.startsWith(`${pack.ns}/`) || rule.methodology.startsWith(`${pack.ns}/`));
      const missingPositive = density.filter((rule) => rule.positive === 0).length;
      const missingNegative = density.filter((rule) => rule.negative === 0).length;
      const skipped = pack.skipped.length;
      const failures = pack.rulesTest.failLines.length;
      return `| ${pack.ns} | ${pack.activation} | ${pack.findings} | ${rateText(pack.fpRate)} | ${pack.rulesAudited} | ${pack.idleRules} | ${skipped} | ${failures} | ${missingPositive} | ${missingNegative} |`;
    }),
    "",
    "Idle rules are static rules that applied to no parsed file. Not field-audited rules are fitness, diff, or placement checks. A zero in Findings is a raw count of sites, not a measured false-positive rate. A pack false-positive cell is `k / n` only when every finding that pack produced on this corpus is labeled `correct` or `false-positive`. Otherwise that cell stays unmeasured, and `k / n` still describes only this corpus.",
    "",
    ...compileSection(report),
    "## Labeled sample",
    "",
    report.labeledSample.items.length === 0 ? "No corpus finding was labeled." : [
      "| Verdict | Pack | Rule | Location | Note |",
      "| --- | --- | --- | --- | --- |",
      ...report.labeledSample.items.map((item) => `| ${item.verdict} | ${item.pack} | \`${item.rule}\` | ${item.corpus} \`${item.path}:${item.line}\` \`${item.symbol}\` | ${cell(item.note)} |`),
    ].join("\n"),
    "",
    report.labeledSample.unmatchedLabels.length === 0 ? "Every label matched a finding." : `Unmatched labels: ${report.labeledSample.unmatchedLabels.length}. They are not counted.`,
    "",
    "## Limits",
    "",
    ...report.limits.map((limit) => `- ${limit}`),
    "",
    "## Reproduce",
    "",
    "```sh",
    "bun scripts/measure-false-positives.ts --skip-offline \\",
    "  --corpus docs/benchmarks/corpus.json \\",
    "  --labels docs/benchmarks/labels.json \\",
    "  --cache .cache/false-positives \\",
    "  --markdown docs/benchmarks/false-positives.md",
    "```",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function compileSection(report: Report): string[] {
  const failed = report.packs.filter((pack) => pack.compileErrors.length);
  if (!failed.length) return ["## Compile errors", "", "None.", ""];
  return ["## Compile errors", "", ...failed.flatMap((pack) => [`### ${pack.ns}`, "", ...pack.compileErrors.map((error) => `- ${error}`), ""])];
}

function listOrNone(title: string, ids: string[]): string {
  return ids.length === 0 ? `**${title}:** none.` : `**${title}:** ${ids.map((id) => `\`${id}\``).join(", ")}.`;
}

function rateSentence(report: Report): string {
  return report.fpRate === "unmeasured"
    ? "The findings are not fully labeled, so the false-positive rate is unmeasured."
    : `Every corpus finding is labeled, so the false-positive rate on this corpus is ${report.fpRate.falsePositives} / ${report.fpRate.labeledFindings}.`;
}

function rateText(rate: Rate): string {
  return rate === "unmeasured" ? "unmeasured" : `${rate.falsePositives} / ${rate.labeledFindings}`;
}

function cell(value: string): string { return value.replaceAll("|", "\\|").replaceAll("\n", " "); }
function num(value: number | null): string { return value === null ? "n/a" : String(value); }
function excluded(rel: string): boolean { return rel.split("/").some((part) => EXCLUDE.has(part)); }
function appliedKey(pack: string, rule: string): string { return `${pack}\0${rule}`; }
function siteKey(site: { corpus: string; pack: string; methodology: string; rule: string; path: string; line: number; symbol: string }): string {
  return [site.corpus, site.pack, site.methodology, site.rule, site.path, String(site.line), site.symbol].join("\0");
}
// One site is one finding. A rule that matches the same line of the same symbol more than once
// (two `+` operands in one expression, two captures of one call) is still one site to label, so
// the report, the per-pack counts, and the labeled sample count each site once.
function distinctSites(matches: Finding[]): Finding[] {
  const sorted = [...matches].sort(compareFinding);
  const out: Finding[] = [];
  let last: string | null = null;
  for (const finding of sorted) {
    const key = siteKey(finding);
    if (key === last) continue;
    last = key;
    out.push(finding);
  }
  return out;
}
function compareFinding(a: Finding, b: Finding): number {
  return siteKey(a) < siteKey(b) ? -1 : siteKey(a) > siteKey(b) ? 1 : (a.measured ?? -1) - (b.measured ?? -1);
}
function packDirs(root: string): string[] {
  if (!existsSync(root)) throw new Error(`packs directory not found: ${root}`);
  return readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, "source.json"))).map((entry) => resolve(root, entry.name)).sort((a, b) => basename(a) < basename(b) ? -1 : 1);
}
function treeHash(files: Files): string {
  const hash = createHash("sha256");
  for (const path of Object.keys(files).sort()) { hash.update(path); hash.update("\0"); hash.update(files[path]!); hash.update("\0"); }
  return hash.digest("hex");
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const left = sorted[mid - 1], right = sorted[mid];
  return sorted.length % 2 ? right! : ((left ?? 0) + (right ?? 0)) / 2;
}
function stableJson(value: unknown): string { return `${JSON.stringify(sortKeys(value), null, 2)}\n`; }
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  const source = value as Record<string, unknown>, out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)) out[key] = sortKeys(source[key]);
  return out;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
