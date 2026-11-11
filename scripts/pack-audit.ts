// Audit every pack on a pinned corpus and attach labeled sample precision. A label names its
// labeler: the maintainer or an agent. An agent label must be in the stride sample of its pack.
// A failed offline fetch with --skip-offline returns null and writes nothing.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { setUpGrammars } from "../src/assets.ts";
import { auditFile, auditRules } from "../src/audit.ts";
import { compile } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import type { Files, Host, Lock, Preset } from "../src/types.ts";
import { VERSIONS } from "../src/versions.ts";
import {
  applyLabels, assertAgentSample, assertUniqueLabels, labelCounts, LIMITS, parseLabelFile, renderPrecision, siteKey, strideSample,
  type CorpusRow, type FindingSite, type LabeledSample, type PrecisionReport,
} from "./precision.ts";

const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue|svelte|py|go|rs)$/i;
const CONFIG = /(^|\/)(package\.json|tsconfig.*\.json)$/;
const EXCLUDE = new Set(["node_modules", "vendor", "dist", "build", "coverage", ".next", "target", ".git"]);
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const USAGE = "usage: bench-audit-repos.ts --precision [--corpus <file>] [--labels <dir>] [--packs <dir>] [--catalog <dir>] [--cache <dir>] [--out <file>] [--markdown <file>] [--findings <file>] [--sample <file>] [--skip-offline]";

interface Options {
  corpus: string;
  labels: string;
  packs: string;
  catalog: string;
  cache: string;
  out: string | null;
  markdown: string | null;
  findings: string | null;
  sample: string | null;
  skipOffline: boolean;
}

interface GitEntry { id: string; language: string; kind: "git"; url: string; commit: string; sha256: string }
interface PathEntry { id: string; language: string; kind: "path"; path: string; commit: string; sha256: string | null }
type Entry = GitEntry | PathEntry;

interface Loaded {
  id: string;
  language: string;
  kind: "git" | "path";
  url: string | null;
  commit: string;
  sourceFiles: number;
  parsed: number;
  files: SourceFile[];
  texts: Map<string, string>;
}

interface Prepared { ns: string; locks: Lock[]; errors: string[] }
interface SourceFile { rel: string; text: string }
interface Scan { hash: ReturnType<typeof createHash>; texts: Map<string, string>; files: SourceFile[]; sourceFiles: number }

export async function measurePrecision(options: Options): Promise<PrecisionReport | null> {
  const entries = loadCorpus(options.corpus);
  const repos = loadAll(entries, options.cache, options.skipOffline);
  if (repos === null) return null;
  await setUpGrammars();
  const prepared = prepareAll(options.packs, options.catalog);
  const labels = loadLabels(options.labels);
  const found = distinct(repos.flatMap((repo) => findingsFor(repo, prepared)));
  if (options.findings) writeFileSync(options.findings, stableJson(found));
  if (options.sample) writeFileSync(options.sample, stableJson(agentSample(found)));
  const applied = applyLabels(prepared.map((pack) => pack.ns), found, labels);
  const lost = applied.unmatched.filter((label) => label.verdict === "true-positive");
  if (lost.length) {
    const sample = lost.slice(0, 8).map((label) => `${label.pack} ${label.path}:${label.line}`).join("; ");
    throw new Error(`${lost.length} labels did not match a finding: ${sample}`);
  }
  assertAgentSample(found, applied.matched);
  const resolved = applied.unmatched.filter((label) => label.verdict === "false-positive");
  return reportOf(repos, applied.packs, applied.matched, resolved);
}

// The sites an agent may label, pack by pack, in the stable order of the findings.
function agentSample(found: FindingSite[]): FindingSite[] {
  const byPack = new Map<string, FindingSite[]>();
  for (const site of found) byPack.set(site.pack, [...(byPack.get(site.pack) ?? []), site]);
  return [...byPack.values()].flatMap((rows) => strideSample(rows)).sort(bySite);
}

export function parsePrecisionArgs(argv: string[], root: string): Options {
  const options: Options = {
    corpus: resolve(root, "bench/corpus.json"), labels: resolve(root, "bench/labels"),
    packs: resolve(root, "packs"), catalog: resolve(root, "catalog"), cache: resolve(root, ".cache/precision"),
    out: null, markdown: null, findings: null, sample: null, skipOffline: false,
  };
  const args = [...argv];
  while (args.length) takePrecision(options, args, root);
  return options;
}

export function writeReport(report: PrecisionReport, options: Options): void {
  const json = stableJson(report);
  const markdown = renderPrecision(report);
  if (options.out) writeFileSync(options.out, json);
  else process.stdout.write(json);
  if (options.markdown) writeFileSync(options.markdown, markdown);
  const measured = report.packs.filter((pack) => pack.precision !== null).length;
  const counts = report.labels;
  console.error(`precision: ${report.packs.length} packs, ${counts.maintainer} maintainer labels, ${counts.agent} agent labels, ${counts.resolved} resolved false positives, ${measured} packs with sample precision`);
}

function takePrecision(options: Options, args: string[], root: string): void {
  const flag = args.shift() ?? "";
  if (flag === "--precision") return;
  if (flag === "--skip-offline") { options.skipOffline = true; return; }
  const value = args.shift();
  if (value === undefined || value.startsWith("--")) throw new Error(USAGE);
  const path = resolve(root, value);
  if (flag === "--corpus") options.corpus = path;
  else if (flag === "--labels") options.labels = path;
  else if (flag === "--packs") options.packs = path;
  else if (flag === "--catalog") options.catalog = path;
  else if (flag === "--cache") options.cache = path;
  else if (flag === "--out") options.out = path;
  else if (flag === "--markdown") options.markdown = path;
  else if (flag === "--findings") options.findings = path;
  else if (flag === "--sample") options.sample = path;
  else throw new Error(USAGE);
}

function reportOf(repos: Loaded[], packs: PrecisionReport["packs"], sample: LabeledSample[], resolved: LabeledSample[]): PrecisionReport {
  return {
    schemaVersion: 2, engine: VERSIONS.engine, core: VERSIONS.core, labels: labelCounts(sample, resolved),
    corpus: repos.map(corpusRow), packs, sample: [...sample].sort(bySite), resolved: [...resolved].sort(bySite), limits: LIMITS,
  };
}

function corpusRow(repo: Loaded): CorpusRow {
  return { id: repo.id, language: repo.language, kind: repo.kind, url: repo.url, commit: repo.commit, sourceFiles: repo.sourceFiles, parsed: repo.parsed };
}

function findingsFor(repo: Loaded, packs: Prepared[]): FindingSite[] {
  console.error(`precision: auditing ${repo.id} (${repo.files.length} parsed candidates)`);
  const host: Host = { read: (path) => repo.texts.get(path) ?? null, now: () => performance.now() };
  const found: FindingSite[] = [];
  for (const file of repo.files) found.push(...sitesIn(repo, file, packs, host));
  repo.parsed = repo.files.length;
  return found;
}

function sitesIn(repo: Loaded, file: SourceFile, packs: Prepared[], host: Host): FindingSite[] {
  const found: FindingSite[] = [];
  for (const pack of packs) found.push(...sitesInPack(repo.id, file, pack, host));
  return found;
}

function sitesInPack(corpus: string, file: SourceFile, pack: Prepared, host: Host): FindingSite[] {
  const found: FindingSite[] = [];
  for (const lock of pack.locks) found.push(...sitesInLock(corpus, pack.ns, file, lock, host));
  return found;
}

function sitesInLock(corpus: string, pack: string, file: SourceFile, lock: Lock, host: Host): FindingSite[] {
  const result = auditFile(lock, file.rel, file.text, host);
  return result.findings.map((finding) => ({
    corpus, pack, rule: finding.rule, path: finding.path, line: finding.line, symbol: finding.symbol,
  }));
}

function prepareAll(root: string, catalogDir: string): Prepared[] {
  const catalog = readTree(catalogDir, false);
  const prepared = packDirs(root).map((dir) => preparePack(dir, catalog, false));
  prepared.push(preparePack(catalogDir, catalog, true));
  prepared.sort((a, b) => a.ns < b.ns ? -1 : a.ns > b.ns ? 1 : 0);
  return prepared;
}

function preparePack(dir: string, catalog: Files, builtin: boolean): Prepared {
  const files = readTree(dir, false);
  const meta = jsonRecord(files["source.json"] ?? "{}", `${dir}/source.json`);
  const ns = typeof meta.ns === "string" && meta.ns !== "" ? meta.ns : basename(dir);
  const compiled = compilePack(ns, methodologyIds(files), catalog, files, builtin);
  if (compiled.errors.length) console.error(`precision: ${ns} compile errors: ${compiled.errors.length}`);
  return { ns, locks: compiled.locks, errors: compiled.errors };
}

function compilePack(ns: string, ids: string[], catalog: Files, pack: Files, builtin: boolean): { locks: Lock[]; errors: string[] } {
  if (builtin) return activations([compileMethodologies(ns, [], catalog, pack, true)]);
  if (ids.length === 0) return { locks: [], errors: [] };
  const combined = compileMethodologies(ns, ids, catalog, pack, false);
  if (combined.lock || ids.length === 1) return activations([combined]);
  return activations(ids.map((id) => compileMethodologies(ns, [id], catalog, pack, false)));
}

function activations(parts: { lock: Lock | null; errors: string[] }[]): { locks: Lock[]; errors: string[] } {
  return { locks: parts.flatMap((part) => part.lock ? [part.lock] : []), errors: parts.flatMap((part) => part.errors) };
}

function compileMethodologies(ns: string, methodologies: string[], catalog: Files, pack: Files, builtin: boolean): { lock: Lock | null; errors: string[] } {
  const sources = builtin
    ? [{ ns: "core", kind: "builtin" as const, version: VERSIONS.core }]
    : [{ ns: "core", kind: "builtin" as const, version: VERSIONS.core }, { ns, kind: "path" as const, path: ns }];
  const preset = { name: "pack-precision", version: "0.0.0", engine: VERSIONS.engine, enforcement: "shadow", methodologies, sources };
  const compiled = compile(JSON.stringify(preset), (source) => filesFor(source, ns, catalog, pack), VERSIONS);
  if ("errors" in compiled) return { lock: null, errors: compiled.errors };
  const selected = auditRules(compiled.lock);
  const prefix = `${ns}/`;
  return { lock: { ...selected.lock, rules: selected.lock.rules.filter((rule) => rule.id.startsWith(prefix)) }, errors: [] };
}

function filesFor(source: Preset["sources"][number], ns: string, catalog: Files, pack: Files): Files | null {
  if (source.kind === "builtin") return catalog;
  if (source.kind === "path" && source.ns === ns) return pack;
  return null;
}

function methodologyIds(files: Files): string[] {
  const ids: string[] = [];
  for (const path of Object.keys(files)) {
    if (!/^methodologies\/[^/]+\.json$/.test(path)) continue;
    const id = jsonRecord(files[path] ?? "{}", path).id;
    if (typeof id === "string" && !ids.includes(id)) ids.push(id);
  }
  return ids.sort();
}

function packDirs(root: string): string[] {
  if (!existsSync(root)) throw new Error(`packs directory not found: ${root}`);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, "source.json")))
    .map((entry) => resolve(root, entry.name))
    .sort((a, b) => basename(a) < basename(b) ? -1 : 1);
}

function loadLabels(dir: string): LabeledSample[] {
  if (!existsSync(dir)) return [];
  const labels = readdirSync(dir).filter((name) => name.endsWith(".json")).sort()
    .flatMap((name) => parseLabelFile(readFileSync(resolve(dir, name), "utf8"), name));
  assertUniqueLabels(labels);
  return labels;
}

function loadAll(entries: Entry[], cache: string, skipOffline: boolean): Loaded[] | null {
  const repos: Loaded[] = [];
  for (const entry of entries) {
    const repo = loadOne(entry, cache, skipOffline);
    if (repo === null) return null;
    repos.push(repo);
  }
  return repos;
}

function loadOne(entry: Entry, cache: string, skipOffline: boolean): Loaded | null {
  let dir: string;
  try { dir = entry.kind === "git" ? checkoutGit(entry, cache) : entry.path; }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (entry.kind === "git" && skipOffline && /connect|resolve host|unable to access|network|timed out|early eof/i.test(message)) {
      console.error("precision: full corpus fetch skipped (offline); results were not rewritten");
      return null;
    }
    throw error;
  }
  return readCheckout(entry, dir);
}

function readCheckout(entry: Entry, dir: string): Loaded {
  const head = git(dir, ["rev-parse", "HEAD"]).trim();
  if (head !== entry.commit) throw new Error(`${entry.id}: pinned commit ${entry.commit} does not match HEAD ${head}`);
  if (git(dir, ["status", "--porcelain"]).trim()) throw new Error(`${entry.id}: checkout is dirty`);
  const scanned = scanTree(dir);
  const contentHash = scanned.hash.digest("hex");
  if (entry.kind === "git" && contentHash !== entry.sha256) throw new Error(`${entry.id}: sha256 ${contentHash} does not match pin ${entry.sha256}`);
  if (entry.kind === "path" && entry.sha256 !== null && contentHash !== entry.sha256) throw new Error(`${entry.id}: sha256 ${contentHash} does not match pin ${entry.sha256}`);
  return {
    id: entry.id, language: entry.language, kind: entry.kind, url: entry.kind === "git" ? entry.url : null,
    commit: entry.commit, sourceFiles: scanned.sourceFiles, parsed: 0, files: scanned.files, texts: scanned.texts,
  };
}

function scanTree(dir: string): Scan {
  const listed = git(dir, ["ls-files", "-z"]).split("\0").filter(Boolean).sort();
  const scan: Scan = { hash: createHash("sha256"), texts: new Map(), files: [], sourceFiles: 0 };
  for (const rel of listed) consider(dir, rel, scan);
  return scan;
}

function consider(dir: string, rel: string, scan: Scan): void {
  if (excluded(rel)) return;
  const abs = resolve(dir, rel);
  if (!existsSync(abs)) return;
  const stat = lstatSync(abs);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > MAX_SOURCE_BYTES) return;
  if (!SOURCE.test(rel) && !CONFIG.test(rel)) return;
  const bytes = readFileSync(abs);
  if (!SOURCE.test(rel)) { if (!bytes.includes(0)) scan.texts.set(rel, bytes.toString("utf8")); return; }
  scan.sourceFiles += 1;
  scan.hash.update(rel); scan.hash.update("\0"); scan.hash.update(bytes); scan.hash.update("\0");
  if (!bytes.includes(0)) { const text = bytes.toString("utf8"); scan.texts.set(rel, text); scan.files.push({ rel, text }); }
}

function checkoutGit(entry: GitEntry, cache: string): string {
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

function git(cwd: string, args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe", timeout: 180000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (result.exitCode !== 0) throw new Error(`git ${args[0]} failed in ${cwd}: ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
}

function loadCorpus(file: string): Entry[] {
  if (!existsSync(file)) throw new Error(`corpus not found: ${file}`);
  const doc = jsonRecord(readFileSync(file, "utf8"), file);
  if (!Array.isArray(doc.entries) || doc.entries.length === 0) throw new Error("corpus entries must be a non-empty array");
  const entries = doc.entries.map((entry) => corpusEntry(entry));
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`duplicate corpus id ${entry.id}`);
    ids.add(entry.id);
  }
  return entries.sort((a, b) => a.id < b.id ? -1 : 1);
}

function corpusEntry(value: unknown): Entry {
  const entry = jsonRecord(typeof value === "string" ? value : JSON.stringify(value ?? null), "corpus entry");
  const id = requiredId(entry.id);
  const language = requiredToken(entry.language, `${id}: language`);
  const commit = requiredSha(entry.commit, `${id}: commit`, 40);
  if (entry.kind === "git") return gitEntry(entry, id, language, commit);
  if (entry.kind === "path") return pathEntry(entry, id, language, commit);
  throw new Error(`${id}: kind must be git or path`);
}

function gitEntry(entry: Record<string, unknown>, id: string, language: string, commit: string): GitEntry {
  const url = entry.url;
  if (typeof url !== "string" || !/^https:\/\/[^@\s]+$/.test(url)) throw new Error(`${id}: git url must be https`);
  return { id, language, kind: "git", url, commit, sha256: requiredSha(entry.sha256, `${id}: sha256`, 64) };
}

function pathEntry(entry: Record<string, unknown>, id: string, language: string, commit: string): PathEntry {
  const path = entry.path;
  if (typeof path !== "string" || path.startsWith("-")) throw new Error(`${id}: path is required`);
  const sha256 = entry.sha256 === undefined ? null : requiredSha(entry.sha256, `${id}: sha256`, 64);
  return { id, language, kind: "path", path: resolve(path), commit, sha256 };
}

function requiredId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value)) throw new Error("corpus id must match ^[a-z0-9][a-z0-9-]*$");
  return value;
}

function requiredToken(value: unknown, at: string): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9+#-]*$/.test(value)) throw new Error(`${at} must be a language name`);
  return value;
}

function requiredSha(value: unknown, at: string, length: number): string {
  if (typeof value !== "string" || value.length !== length || !/^[0-9a-f]+$/.test(value)) throw new Error(`${at} must be ${length} hex characters`);
  return value;
}

function jsonRecord(text: string, at: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(text) as unknown; }
  catch { throw new Error(`${at}: invalid JSON`); }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${at}: expected an object`);
  return value as Record<string, unknown>;
}

function distinct(sites: FindingSite[]): FindingSite[] {
  const sorted = [...sites].sort(bySite);
  const out: FindingSite[] = [];
  let last = "";
  for (const site of sorted) {
    const key = siteKey(site);
    if (key === last) continue;
    last = key;
    out.push(site);
  }
  return out;
}

function bySite(a: FindingSite, b: FindingSite): number {
  const left = siteKey(a);
  const right = siteKey(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function excluded(rel: string): boolean {
  return rel.split("/").some((part) => EXCLUDE.has(part));
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) out[key] = sortKeys(source[key]);
  return out;
}
