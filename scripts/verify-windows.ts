// Manual Windows handoff: run the committed candidate without changing the tester's setup.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { arch, release, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };

const root = resolve(import.meta.dir, "..");
const usage = "bun scripts/verify-windows.ts --artifacts <candidate-directory> [--report <new-directory>]";
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  console.log(usage + "\nRequires native Windows x64, Git and the Bun version in .bun-version. Reports stay local.");
  process.exit(0);
}
if (args.length !== 2 && args.length !== 4 || args[0] !== "--artifacts" || !args[1] || args.length === 4 && (args[2] !== "--report" || !args[3])) throw new Error(usage);
if (process.platform !== "win32" || arch() !== "x64") throw new Error("Native Windows x64 is required; cross-compilation is not Windows verification.");
const dist = resolve(args[1]);
const output = args[3] ? resolve(args[3]) : join(tmpdir(), "pregate-windows-report-" + Date.now());
if (existsSync(output)) throw new Error("Report directory must be new: " + output);
mkdirSync(output, { recursive: true });
const home = mkdtempSync(join(tmpdir(), "pregate-windows-verification-"));
const env: Record<string, string | undefined> = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", CLAUDE_CONFIG_DIR: join(home, "home/.claude") };
for (const [key, folder] of Object.entries({ HOME: "home", USERPROFILE: "home", LOCALAPPDATA: "data", APPDATA: "config", XDG_DATA_HOME: "data", XDG_STATE_HOME: "state", XDG_CONFIG_HOME: "config", TMPDIR: "tmp", TMP: "tmp", TEMP: "tmp", CODEX_HOME: "codex", GROK_HOME: "grok" })) {
  const path = join(home, folder); mkdirSync(path, { recursive: true }); env[key] = path;
}
// Windows PowerShell finds no AppData\Local under the isolated USERPROFILE and writes its module
// analysis cache relative to its working directory: the checkout. Keep that cache in the isolated home.
env.PSModuleAnalysisCachePath = join(home, "powershell-module-analysis-cache");
const git = (...values: string[]) => {
  const result = Bun.spawnSync(["git", ...values], { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 10000 });
  if (result.exitCode !== 0) throw new Error("Git preflight failed: " + result.stderr.toString());
  return result.stdout.toString().trim();
};
const steps: { name: string; command: string[]; exitCode: number; durationMs: number; stdout: string; stderr: string; note?: string }[] = [];
// The self-gate delegates to the engine the repository lock pins (MH-19). The isolated home holds no
// engine, so a commit whose lock pins another version fails here for that reason alone: say so.
function lockedEngine(): unknown {
  try { return (JSON.parse(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8")) as { engine?: unknown }).engine; } catch { return undefined; }
}
function lagNote(): { note?: string } {
  const pin = lockedEngine();
  return typeof pin === "string" && pin !== pkg.version
    ? { note: `The lock pins engine ${pin}, not this candidate (${pkg.version}); the isolated home has no engine ${pin}, so the self-gate cannot pass at this commit on any platform.` }
    : {};
}
let commit = "unknown", failure: string | undefined, cleanupFailure: string | undefined;
const started = new Date().toISOString();
const hashes: Record<string, string> = {};
try {
  commit = git("rev-parse", "HEAD");
  if (git("status", "--porcelain")) throw new Error("Use a clean checkout of the candidate commit; local changes cannot certify that commit.");
  const expectedBun = readFileSync(join(root, ".bun-version"), "utf8").trim();
  if (Bun.version !== expectedBun) throw new Error(`Bun ${expectedBun} is required; running ${Bun.version}.`);
  for (const name of [`pregate-${pkg.version}-windows-x64.zip`, "install.ps1", "SHA256SUMS"]) {
    hashes[name] = createHash("sha256").update(readFileSync(join(dist, name))).digest("hex");
  }
  const commands: [string, string[]][] = [
    ["dependencies", [process.execPath, "install", "--frozen-lockfile"]],
    ["typecheck", [process.execPath, "run", "typecheck"]],
    ["core-reference", [process.execPath, "scripts/core-invariants.ts", "--check"]],
    ["readiness-reference", [process.execPath, "scripts/readiness-packs.ts", "--check"]],
    ["documentation", [process.execPath, "scripts/docs-reference.ts", "--check"]],
    ["runtime-onboarding", [process.execPath, "test", "test/runtime.test.ts", "test/onboard.test.ts"]],
    ["windows-bootstrap", [process.execPath, "test", "test/windows-distribution.e2e.test.ts"]],
    // These four suites contain POSIX fixtures; the native counterparts run above and below.
    ["windows-suite", [process.execPath, "test", "--isolate", "--path-ignore-patterns", "test/{launcher.e2e,machine.e2e,dist.e2e,e2e}.test.ts"]],
    ["dcouplr-source", [process.execPath, "scripts/dcouplr-source-probe.ts", "--fetch"]],
    ["packaged-candidate", [process.execPath, "scripts/smoke-native.ts", dist, "windows-x64"]],
    ["self-gate", [process.execPath, "src/main.ts", "check", "--ratchet", "--base", commit]],
  ];
  for (const [name, command] of commands) {
    console.log("Windows verification: " + name);
    const began = Date.now();
    const stdout = name + ".stdout.log", stderr = name + ".stderr.log";
    const proc = Bun.spawn(command, { cwd: root, env, stdin: "ignore", stdout: Bun.file(join(output, stdout)), stderr: Bun.file(join(output, stderr)), timeout: (name === "windows-suite" ? 60 : 20) * 60 * 1000 });
    const exitCode = await proc.exited;
    steps.push({ name, command, exitCode, durationMs: Date.now() - began, stdout, stderr, ...(name === "self-gate" && exitCode !== 0 ? lagNote() : {}) });
    if (name === "dependencies" && exitCode !== 0) throw new Error("Dependency install failed; dependent checks were not run.");
  }
  if (git("status", "--porcelain")) throw new Error("Verification changed the checkout; inspect the changes before accepting the report.");
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
} finally {
  try { rmSync(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
  catch (error) { cleanupFailure = String(error); }
  const passed = !failure && !cleanupFailure && steps.length === 11 && steps.every((step) => step.exitCode === 0);
  writeFileSync(join(output, "report.json"), JSON.stringify({ schema: 1, started, finished: new Date().toISOString(), commit, engine: pkg.version, runtime: { platform: process.platform, architecture: arch(), osRelease: release(), bun: Bun.version }, artifacts: hashes, passed, failure, cleanupFailure, steps, limits: "Native runtime and packaged candidate only. Actual harness UI, Windows ARM64 and other commits are not certified. No global install or automatic issue upload." }, null, 2) + "\n");
  console.log(`${passed ? "PASS" : "FAIL"}: ${join(output, "report.json")}`);
  if (failure) console.error(failure);
  process.exitCode = passed ? 0 : 1;
}
