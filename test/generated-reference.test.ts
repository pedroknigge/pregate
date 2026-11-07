import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = mkdtempSync(join(tmpdir(), "pregate-generated-crlf-"));
const source = join(import.meta.dir, "..");
for (const directory of ["catalog", "packs", "docs", "schema", "assets", "skills"]) cpSync(join(source, directory), join(root, directory), { recursive: true });
mkdirSync(join(root, "scripts")); mkdirSync(join(root, "src"));
const scripts = ["core-invariants.ts", "readiness-packs.ts", "source-invariants.ts", "invariant-coverage.ts", "dcouplr-delivery-rules.ts", "docs-reference.ts"];
for (const script of [...scripts, "readme-catalog.ts", "latency-gate.ts"]) cpSync(join(source, "scripts", script), join(root, "scripts", script));
cpSync(join(source, "src/cli.ts"), join(root, "src/cli.ts"));
cpSync(join(source, "src/capabilities.ts"), join(root, "src/capabilities.ts"));
mkdirSync(join(root, "src/harness"));
cpSync(join(source, "src/harness/codex.ts"), join(root, "src/harness/codex.ts"));
mkdirSync(join(root, "bench"));
cpSync(join(source, "bench/latency-baseline.json"), join(root, "bench/latency-baseline.json"));
cpSync(join(source, "README.md"), join(root, "README.md"));
cpSync(join(source, "package.json"), join(root, "package.json"));
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const paths = files(root);
for (const path of paths) writeFileSync(path, readFileSync(path, "utf8").replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"));
const fingerprint = () => createHash("sha256").update(paths.map((path) => createHash("sha256").update(readFileSync(path)).digest("hex")).join("\n")).digest("hex");
function staleOutputRejected(path: string, original: string, run: () => { exitCode: number }): void {
  try { expect(run().exitCode).toBe(1); }
  finally { writeFileSync(path, original); }
}
// Removing the copied tree takes ~15 s on Windows.
afterAll(() => rmSync(root, { recursive: true, force: true }), 120_000);
test.each(scripts)("%s accepts a CRLF checkout without rewriting it and detects substantive stale output", (script) => {
  const run = () => Bun.spawnSync([process.execPath, join(root, "scripts", script), "--check"], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 15000 });
  const before = fingerprint(), accepted = run();
  expect(accepted.stderr.toString()).toBe(""); expect(accepted.exitCode).toBe(0);
  expect(fingerprint()).toBe(before);
  const relative = script === "core-invariants.ts" ? "catalog/methodologies/software-invariants.json"
    : script === "readiness-packs.ts" ? "packs/vercel/source.json"
    : script === "source-invariants.ts" ? "packs/maintainability/methodologies/future-humans.json"
    : script === "invariant-coverage.ts" ? "packs/invariant-coverage.json"
    : script === "dcouplr-delivery-rules.ts" ? "packs/dcouplr/methodologies/delivery.json" : "docs/CLI.md";
  for (const target of script === "dcouplr-delivery-rules.ts" ? [relative, "packs/dcouplr/methodologies/logging.json", "packs/dcouplr/methodologies/queue-runtime.json", "packs/dcouplr/methodologies/saga-runtime.json", "packs/dcouplr/methodologies/factory-runtime.json", "packs/dcouplr/methodologies/utility-runtime.json", "packs/dcouplr/methodologies/observability.json"] : [relative]) {
    const path = join(root, target), original = readFileSync(path, "utf8");
    writeFileSync(path, original + "stale substantive output\r\n");
    staleOutputRejected(path, original, run);
  }
  expect(fingerprint()).toBe(before);
}, 20000);
