import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { compile } from "../src/compile.ts";
import { sourcesOf, VERSIONS } from "../src/gate.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { compileBinary, hostTarget } from "./build.ts";
import { measurePrecision, parsePrecisionArgs, writeReport } from "./pack-audit.ts";

// Two measurements. With --precision, audit every pack on the pinned corpus and
// compute sample precision for labeled packs only (maintainer and agent labels are counted apart).
// Without it, time `pregate audit` on local checkouts. No project dependencies,
// application code, verifiers or network calls are run in that timing mode.
const ROOT = join(import.meta.dir, "..");

if (import.meta.main) main(process.argv.slice(2));

function main(args: string[]): void {
  if (args.includes("--precision")) {
    const options = parsePrecisionArgs(args, ROOT);
    measurePrecision(options).then((report) => { if (report) writeReport(report, options); }).catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    });
    return;
  }
  timeCheckouts(args);
}

function timeCheckouts(inputs: string[]): void {
  if (!inputs.length || inputs.some((p) => p.startsWith("--"))) throw new Error("usage: bench-audit-repos.ts <local-checkout>... | --precision [options]");
  const base = mkdtempSync(join(tmpdir(), "pregate-audit-repos-"));
  const binary = join(base, ENGINE_FILE);
  const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  try {
    compileBinary(hostTarget(), binary);
    const results = inputs.map((input, i) => measure(resolve(input), i, base, binary));
    console.log(JSON.stringify({
      runtime: Bun.version, versions: VERSIONS, binarySha256: hash(readFileSync(binary)),
      workload: "isolated copies of existing local Git checkouts; no consumer dependencies executed", results,
    }, null, 2));
  } finally { rmSync(base, { recursive: true, force: true }); }
}

function git(root: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 20000 });
  if (result.exitCode !== 0) throw new Error(`Git inspection failed: ${args[0]}`);
  return result.stdout.toString();
}

function trackedHash(root: string, files: string[]): string {
  const hash = createHash("sha256");
  const rows = files.map((p) => [p, hashOf(root, p)] as const);
  return hash.update(JSON.stringify(rows)).digest("hex");
}

function hashOf(root: string, path: string): string {
  const from = join(root, path);
  const bytes = lstatSync(from).isSymbolicLink() ? readlinkSync(from) : readFileSync(from);
  return createHash("sha256").update(bytes).digest("hex");
}

function measure(source: string, index: number, base: string, binary: string) {
  const files = git(source, "ls-files", "-z").split("\0").filter(Boolean).sort();
  const commit = git(source, "rev-parse", "HEAD").trim();
  const sourceHash = trackedHash(source, files);
  const root = join(base, `repo-${index}`);
  const home = join(base, `runtime-${index}`);
  copyTree(source, root, files);
  installPreset(root);
  const samples = timeAudits(root, home, binary);
  if (trackedHash(source, files) !== sourceHash || trackedHash(root, files) !== sourceHash) throw new Error("Tracked source changed during diagnostic");
  return { repository: basename(source), commit, trackedHash: sourceHash, trackedSourceUnchanged: true, samples };
}

function copyTree(source: string, root: string, files: string[]): void {
  mkdirSync(root);
  for (const path of files) copyOne(join(source, path), join(root, path));
}

function copyOne(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true });
  if (lstatSync(from).isSymbolicLink()) symlinkSync(readlinkSync(from), to);
  else writeFileSync(to, readFileSync(from));
}

function installPreset(root: string): void {
  const preset = JSON.parse(readFileSync(join(ROOT, "catalog/presets/legacy-safe.json"), "utf8")) as Record<string, unknown>;
  preset.name = "incremental-diagnostic";
  preset.enforcement = "shadow";
  preset.scope = { include: ["**"], exclude: ["vendor/**", "node_modules/**", "dist/**", "build/**", "coverage/**", ".git/**", ".pregate/**"] };
  mkdirSync(join(root, ".pregate"), { recursive: true });
  const text = JSON.stringify(preset);
  writeFileSync(join(root, ".pregate/preset.json"), text);
  const compiled = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, ".pregate/pregate.lock.json"), compiled.text);
}

function timeAudits(root: string, home: string, binary: string) {
  const env = { ...process.env, HOME: join(home, "home"), XDG_DATA_HOME: join(home, "data"), XDG_STATE_HOME: join(home, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  const labels = ["cold", "populate", "warm-1", "warm-2", "fresh"];
  const samples = [];
  let reference = "";
  for (const label of labels) {
    const sample = oneAudit(root, env, binary, label, reference);
    if (label === "cold") reference = sample.observed;
    samples.push(sample.row);
  }
  return samples;
}

function oneAudit(root: string, env: Record<string, string | undefined>, binary: string, label: string, reference: string) {
  const started = performance.now();
  const flags = label === "cold" ? [] : label === "fresh" ? ["--fresh"] : ["--incremental"];
  const result = Bun.spawnSync([binary, "audit", "--json", ...flags], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 120000 });
  const wallMs = Math.round((performance.now() - started) * 10) / 10;
  const report = JSON.parse(result.stdout.toString()) as AuditReport;
  if (result.exitCode !== 2 || report.changedDuringAudit || report.fitness.length !== 64 || report.fitness.some((f) => f.status !== "unverified")) {
    throw new Error("Expected stable audit with 64 unverified project obligations");
  }
  const observed = JSON.stringify([report.summary, report.findings, report.errors, report.fileHashes, report.contentHash, report.fitness, report.fileCoverage, report.uncovered, report.excluded, report.unsupported, report.skippedRules]);
  if (label !== "cold" && observed !== reference) throw new Error("Incremental/fresh audit differs from cold reference");
  return {
    observed,
    row: { label, auditMs: report.elapsedMs, wallMs, files: report.filesScanned, findings: report.summary.violations, errors: report.errors.length, exitCode: result.exitCode, incremental: report.incremental },
  };
}

interface AuditReport {
  changedDuringAudit: boolean;
  fitness: { status: string }[];
  summary: { violations: number };
  findings: unknown;
  errors: unknown[];
  fileHashes: unknown;
  contentHash: unknown;
  fileCoverage: unknown;
  uncovered: unknown;
  excluded: unknown;
  unsupported: unknown;
  skippedRules: unknown;
  elapsedMs: number;
  filesScanned: number;
  incremental: unknown;
}
