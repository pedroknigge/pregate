import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { compile } from "../src/compile.ts";
import { sourcesOf, VERSIONS } from "../src/gate.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { compileBinary, hostTarget } from "./build.ts";

// Read existing local checkouts; audit isolated tracked-file copies only. No
// project dependencies, application code, verifiers or network calls are run.
const inputs = process.argv.slice(2);
if (!inputs.length || inputs.some((p) => p.startsWith("--"))) throw new Error("usage: bench-audit-repos.ts <local-checkout>...");
const base = mkdtempSync(join(tmpdir(), "pregate-audit-repos-")), binary = join(base, ENGINE_FILE);
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
try {
  compileBinary(hostTarget(), binary);
  const results = inputs.map((input, i) => measure(resolve(input), i));
  console.log(JSON.stringify({ runtime: Bun.version, versions: VERSIONS, binarySha256: hash(readFileSync(binary)),
    workload: "isolated copies of existing local Git checkouts; no consumer dependencies executed", results }, null, 2));
} finally { rmSync(base, { recursive: true, force: true }); }

function git(root: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 20000 });
  if (result.exitCode !== 0) throw new Error(`Git inspection failed: ${args[0]}`);
  return result.stdout.toString();
}

function trackedHash(root: string, files: string[]): string {
  return hash(JSON.stringify(files.map((p) => [p, hash(lstatSync(join(root, p)).isSymbolicLink()
    ? readlinkSync(join(root, p)) : readFileSync(join(root, p)))])));
}

function measure(source: string, index: number) {
  const files = git(source, "ls-files", "-z").split("\0").filter(Boolean).sort(), commit = git(source, "rev-parse", "HEAD").trim();
  const sourceHash = trackedHash(source, files), root = join(base, `repo-${index}`), home = join(base, `runtime-${index}`);
  mkdirSync(root);
  for (const path of files) {
    const from = join(source, path), to = join(root, path);
    mkdirSync(dirname(to), { recursive: true });
    if (lstatSync(from).isSymbolicLink()) symlinkSync(readlinkSync(from), to);
    else writeFileSync(to, readFileSync(from));
  }
  const preset = JSON.parse(readFileSync("catalog/presets/legacy-safe.json", "utf8"));
  preset.name = "incremental-diagnostic"; preset.enforcement = "shadow";
  preset.scope = { include: ["**"], exclude: ["vendor/**", "node_modules/**", "dist/**", "build/**", "coverage/**", ".git/**", ".pregate/**"] };
  mkdirSync(join(root, ".pregate"), { recursive: true });
  writeFileSync(join(root, ".pregate/preset.json"), JSON.stringify(preset));
  const compiled = compile(JSON.stringify(preset), sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, ".pregate/pregate.lock.json"), compiled.text);
  const env = { ...process.env, HOME: join(home, "home"), XDG_DATA_HOME: join(home, "data"), XDG_STATE_HOME: join(home, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  const samples = [], labels = ["cold", "populate", "warm-1", "warm-2", "fresh"];
  let reference = "";
  for (const label of labels) {
    const started = performance.now();
    const flags = label === "cold" ? [] : label === "fresh" ? ["--fresh"] : ["--incremental"];
    const result = Bun.spawnSync([binary, "audit", "--json", ...flags], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 120000 });
    const wallMs = Math.round((performance.now() - started) * 10) / 10, report = JSON.parse(result.stdout.toString());
    if (result.exitCode !== 2 || report.changedDuringAudit || report.fitness.length !== 64
      || report.fitness.some((f: { status: string }) => f.status !== "unverified")) throw new Error("Expected stable audit with 64 unverified project obligations");
    const observed = JSON.stringify([report.summary, report.findings, report.errors, report.fileHashes, report.contentHash,
      report.fitness, report.fileCoverage, report.uncovered, report.excluded, report.unsupported, report.skippedRules]);
    if (label === "cold") reference = observed;
    else if (observed !== reference) throw new Error("Incremental/fresh audit differs from cold reference");
    samples.push({ label, auditMs: report.elapsedMs, wallMs, files: report.filesScanned, findings: report.summary.violations,
      errors: report.errors.length, exitCode: result.exitCode, incremental: report.incremental });
  }
  if (trackedHash(source, files) !== sourceHash || trackedHash(root, files) !== sourceHash) throw new Error("Tracked source changed during diagnostic");
  return { repository: basename(source), commit, trackedHash: sourceHash, trackedSourceUnchanged: true, samples };
}
