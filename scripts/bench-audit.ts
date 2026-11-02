import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "./build.ts";
import { compile } from "../src/compile.ts";
import { sourcesOf, VERSIONS } from "../src/gate.ts";
import { ENGINE_FILE } from "../src/platform.ts";

interface CompleteAudit { digest: string; rest: string }

// Synthetic scale check, not a real-project pilot. Optional cache/cold comparison.
// Run from the repository root: bun run scripts/bench-audit.ts [--incremental] [--jsonl]
const flags = process.argv.slice(2);
if (new Set(flags).size !== flags.length || flags.some((f) => !["--incremental", "--jsonl"].includes(f))) throw new Error("usage: bench-audit.ts [--incremental] [--jsonl]");
const base = mkdtempSync(join(tmpdir(), "pregate-audit-scale-")), root = join(base, "repo");
try {
  mkdirSync(join(root, ".pregate"), { recursive: true }); mkdirSync(join(root, "src"));
  const preset = readFileSync("catalog/presets/legacy-safe.json", "utf8");
  writeFileSync(join(root, ".pregate/preset.json"), preset);
  const compiled = compile(preset, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, ".pregate/pregate.lock.json"), compiled.text);
  let bytes = 0, lines = 0;
  for (let file = 0; file < 100; file++) {
    const code = Array.from({ length: 100 }, (_, i) => `export function debt${i}(a: number, b: number, c: number, d: number, e: number, f: number) {\n  const total = a + b + c + d + e + f;\n  return total;\n}\n`).join("\n");
    writeFileSync(join(root, `src/file${file}.ts`), code);
    bytes += Buffer.byteLength(code); lines += code.split("\n").length - 1;
  }
  const binary = join(base, ENGINE_FILE); compileBinary(hostTarget(), binary);
  const elapsed: number[] = [], wall: number[] = [], maxRSS: number[] = [];
  const env = { ...process.env, HOME: join(base, "home"), XDG_DATA_HOME: join(base, "data"), XDG_STATE_HOME: join(base, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  let reference = "";
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const result = Bun.spawnSync([binary, "audit", "--json"], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 120000 });
    wall.push(Math.round((performance.now() - start) * 10) / 10);
    maxRSS.push(result.resourceUsage.maxRSS);
    const report = JSON.parse(result.stdout.toString());
    if (result.exitCode !== 2 || report.summary.violations !== 10000 || report.errors.length || report.changedDuringAudit
      || report.fitness.length !== 64 || report.fitness.some((r: { status: string }) => r.status !== "unverified")) throw new Error("Audit canary failed.");
    elapsed.push(report.elapsedMs);
    reference = JSON.stringify([report.findings, report.errors, report.fileHashes, report.fitness]);
  }
  const streaming = flags.includes("--jsonl") ? await streamingSamples(binary, root, env, reference) : null;
  const incremental = flags.includes("--incremental") ? incrementalSamples(binary, root, env, reference) : null;
  console.log(JSON.stringify({ workload: "synthetic TypeScript; not a real-project pilot", files: 100, lines, bytes,
    violations: 10000, unverifiedCoreRequirements: 64, compliance: "incomplete (exit 2)",
    runtime: Bun.version, samples: 5, auditMs: elapsed, wallMs: wall, maxRSSBytes: maxRSS, streaming, incremental }, null, 2));
} finally { rmSync(base, { recursive: true, force: true }); }

async function streamingSamples(binary: string, root: string, env: Record<string, string | undefined>, reference: string) {
  const [findings, errors, hashes, fitness] = JSON.parse(reference);
  const expected = new Bun.CryptoHasher("sha256");
  for (const finding of findings) expected.update(JSON.stringify(finding) + "\n");
  const complete: CompleteAudit = { digest: expected.digest("hex"), rest: JSON.stringify([errors, hashes, fitness]) }, samples = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    samples.push(await streamingSample(streamingAudit(binary, root, env), start, complete));
  }
  return { findingsEquivalent: true, diagnosticsHashesFitnessEquivalent: true, samples };
}

function streamingAudit(binary: string, root: string, env: Record<string, string | undefined>) {
  return Bun.spawn([binary, "audit", "--jsonl"], { cwd: root, env, stdout: "pipe", stderr: "inherit", timeout: 120000 });
}

async function streamingSample(child: ReturnType<typeof streamingAudit>, start: number, complete: CompleteAudit) {
  try {
    const actual = new Bun.CryptoHasher("sha256"), decoder = new TextDecoder();
    let pending = "", firstFileMs: number | null = null, count = 0, files = 0, end: any = null;
    for await (const chunk of child.stdout) {
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split("\n"); pending = lines.pop()!;
      for (const line of lines) {
        const record = JSON.parse(line);
        if (record.type === "file") {
          firstFileMs ??= Math.round((performance.now() - start) * 10) / 10; files++;
          for (const finding of record.findings) { actual.update(JSON.stringify(finding) + "\n"); count++; }
        } else if (record.type === "end") end = record;
        else if (record.type !== "start") throw new Error("Unexpected streaming audit record.");
      }
    }
    const code = await child.exited;
    if (pending || !end || code !== 2 || end.code !== code || count !== 10000 || files !== 100 || actual.digest("hex") !== complete.digest
      || end.report.changedDuringAudit || JSON.stringify([end.report.errors, end.report.fileHashes, end.report.fitness]) !== complete.rest) {
      throw new Error("Streaming audit differs from the complete audit.");
    }
    return { auditMs: end.report.elapsedMs, wallMs: Math.round((performance.now() - start) * 10) / 10,
      firstFileMs, maxRSSBytes: child.resourceUsage()?.maxRSS ?? null, findings: count, files, exitCode: code };
  } finally { child.kill(); await child.exited; }
}

function incrementalSamples(binary: string, root: string, env: Record<string, string | undefined>, reference: string) {
  const samples = [];
  for (const label of ["cache-cold", "warm-1", "warm-2", "warm-3", "one-file-change"]) {
    if (label === "one-file-change") {
      const file = join(root, "src/file99.ts");
      writeFileSync(file, readFileSync(file, "utf8").replace("a: number", "alpha: number").replace("a + b", "alpha + b"));
      const cold = Bun.spawnSync([binary, "audit", "--json"], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 120000 });
      const report = JSON.parse(cold.stdout.toString());
      reference = JSON.stringify([report.findings, report.errors, report.fileHashes, report.fitness]);
    }
    const start = performance.now();
    const result = Bun.spawnSync([binary, "audit", "--json", "--incremental"], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 120000 });
    const wallMs = Math.round((performance.now() - start) * 10) / 10, report = JSON.parse(result.stdout.toString());
    if (result.exitCode !== 2 || JSON.stringify([report.findings, report.errors, report.fileHashes, report.fitness]) !== reference) throw new Error("Incremental audit differs from the complete audit");
    samples.push({ label, auditMs: report.elapsedMs, wallMs, ...report.incremental });
  }
  return samples;
}
