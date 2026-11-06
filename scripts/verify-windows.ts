// Manual Windows handoff: run the committed candidate without changing the tester's setup.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { arch, freemem, release, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };

const root = resolve(import.meta.dir, "..");
const usage = "bun scripts/verify-windows.ts --artifacts <candidate-directory> [--report <new-directory>]";
const LIMITS = "Native runtime and packaged candidate only. Actual harness UI, Windows ARM64 and other commits are not certified. No global install or automatic issue upload.";
// A full run on an everyday 16 GB machine needed more than about 1 GB free. Warn below 2 GB and keep going.
const FREE_MEMORY_WARN_BYTES = 2 * 1024 * 1024 * 1024;

export interface StepResult {
  name: string;
  command: string[];
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  note?: string;
}

export interface WindowsReport {
  schema: 1;
  started: string;
  finished: string | null;
  commit: string;
  engine: string;
  runtime: { platform: string; architecture: string; osRelease: string; bun: string };
  artifacts: Record<string, string>;
  passed: boolean;
  failure?: string;
  cleanupFailure?: string;
  steps: StepResult[];
  limits: string;
}

export function createWindowsReport(started = new Date().toISOString()): WindowsReport {
  return {
    schema: 1,
    started,
    finished: null,
    commit: "unknown",
    engine: pkg.version,
    runtime: { platform: process.platform, architecture: arch(), osRelease: release(), bun: Bun.version },
    artifacts: {},
    passed: false,
    failure: undefined,
    cleanupFailure: undefined,
    steps: [],
    limits: LIMITS,
  };
}

// Readers open report.json while the run is still going. Replace the file by rename so they never see a partial write.
export function publishReport(directory: string, report: WindowsReport): void {
  const path = join(directory, "report.json");
  const temporary = join(directory, `.report-${process.pid}-${Date.now()}.json`);
  const body = JSON.stringify(report, null, 2) + "\n";
  writeFileSync(temporary, body);
  try {
    renameSync(temporary, path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST" && code !== "EPERM") {
      rmSync(temporary, { force: true });
      throw error;
    }
    // Windows can refuse to rename onto a file a reader still has open. The previous report stays until this write replaces it.
    try { writeFileSync(path, body); } finally { rmSync(temporary, { force: true }); }
  }
}

function definedEnv(env: Record<string, string | undefined>): Record<string, string> {
  const copy: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) if (typeof value === "string") copy[key] = value;
  return copy;
}

function killProcessTree(pid: number): void {
  if (pid <= 0 || pid === process.pid) throw new Error("Refusing to kill the verifier process.");
  if (process.platform === "win32") {
    // /T kills the child tree. Bun's own timeout ends the direct process and leaves those children.
    spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], { stdio: "ignore", windowsHide: true });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return;
    try { process.kill(pid, "SIGKILL"); } catch (again) {
      if ((again as NodeJS.ErrnoException).code !== "ESRCH") throw again;
    }
  }
}

function waitForStep(child: ChildProcess, timeoutMs: number): Promise<{ exitCode: number | null; timedOut: boolean; killError?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let killError: string | undefined;
    let grace: ReturnType<typeof setTimeout> | undefined;
    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (grace) clearTimeout(grace);
      resolve(killError === undefined ? { exitCode, timedOut } : { exitCode, timedOut, killError });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) {
        try {
          killProcessTree(child.pid);
        } catch (error) {
          killError = error instanceof Error ? error.message : String(error);
        }
      }
      grace = setTimeout(() => finish(null), 5_000);
    }, timeoutMs);
    child.once("exit", (code) => finish(code));
    child.once("error", () => finish(null));
  });
}

export async function runBoundedStep(options: {
  name: string;
  command: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  directory: string;
  timeoutMs: number;
}): Promise<StepResult> {
  const stdout = options.name + ".stdout.log";
  const stderr = options.name + ".stderr.log";
  const executable = options.command[0];
  if (!executable) throw new Error(`Windows verification step ${options.name} has no command.`);
  const stdoutFd = openSync(join(options.directory, stdout), "w");
  const stderrFd = openSync(join(options.directory, stderr), "w");
  let child: ChildProcess;
  try {
    child = spawn(executable, options.command.slice(1), {
      cwd: options.cwd,
      env: definedEnv(options.env),
      // A new process group lets a Unix timeout kill the step and the children it spawned.
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", stdoutFd, stderrFd],
    });
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }
  const began = Date.now();
  const outcome = await waitForStep(child, options.timeoutMs);
  const step: StepResult = {
    name: options.name,
    command: options.command,
    exitCode: outcome.exitCode,
    durationMs: Date.now() - began,
    stdout,
    stderr,
  };
  if (outcome.timedOut) step.timedOut = true;
  if (outcome.killError) {
    appendFileSync(join(options.directory, stderr), `Process tree kill failed: ${outcome.killError}\n`);
    step.note = `Process tree kill failed: ${outcome.killError}`;
  }
  return step;
}

function limitLabel(timeoutMs: number): string {
  if (timeoutMs >= 60_000 && timeoutMs % 60_000 === 0) {
    const minutes = timeoutMs / 60_000;
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  const seconds = Math.max(1, Math.round(timeoutMs / 1000));
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}

export async function runRecordedSteps(options: {
  directory: string;
  report: WindowsReport;
  commands: [string, string[]][];
  cwd: string;
  env: Record<string, string | undefined>;
  timeoutMs: (name: string) => number;
  noteFor?: (step: StepResult) => { note?: string };
}): Promise<void> {
  // Create the file before the first step, then replace it after each one. `finished` stays null.
  publishReport(options.directory, options.report);
  for (const [name, command] of options.commands) {
    console.log("Windows verification: " + name);
    const timeoutMs = options.timeoutMs(name);
    const step = await runBoundedStep({
      name, command, cwd: options.cwd, env: options.env, directory: options.directory, timeoutMs,
    });
    const extra = options.noteFor?.(step);
    const note = [step.note, extra?.note].filter((item) => item !== undefined).join(" ");
    options.report.steps.push(note === "" ? { ...step, ...extra } : { ...step, ...extra, note });
    publishReport(options.directory, options.report);
    if (step.timedOut) console.error(`Windows verification: ${name} exceeded ${limitLabel(timeoutMs)}; the process tree was killed.`);
    if (name === "dependencies" && (step.exitCode !== 0 || step.timedOut)) throw new Error("Dependency install failed; dependent checks were not run.");
  }
}

function printPreflight(): void {
  console.log("Windows verification takes about 1 hour.");
  const free = freemem();
  if (free >= FREE_MEMORY_WARN_BYTES) return;
  const gb = (free / (1024 * 1024 * 1024)).toFixed(1);
  console.warn(`Warning: ${gb} GB of memory is free, below 2 GB. Close other applications. The run continues.`);
}

// ES_CONTINUOUS is 0x80000000. ES_SYSTEM_REQUIRED is 0x00000001. Clearing is ES_CONTINUOUS alone.
const AWAKE_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PregateAwake {
  [DllImport("kernel32.dll")]
  public static extern uint SetThreadExecutionState(uint esFlags);
}
'@
$awake = [Convert]::ToUInt32('80000001', 16)
if ([PregateAwake]::SetThreadExecutionState($awake) -eq 0) { exit 1 }
Write-Output 'awake'
$parent = 0
[void][int]::TryParse($env:PREGATE_AWAKE_PARENT, [ref]$parent)
while ($parent -ne 0 -and (Get-Process -Id $parent -ErrorAction SilentlyContinue)) {
  Start-Sleep -Seconds 5
}
[void][PregateAwake]::SetThreadExecutionState([Convert]::ToUInt32('80000000', 16))
`;

const SLEEP_INSTRUCTION = [
  "Could not keep Windows awake for this run. Disable sleep, then restore it after the report is written:",
  "  powercfg /change standby-timeout-ac 0",
  "  powercfg /change standby-timeout-dc 0",
  "Restore afterwards (30 minutes is a common default; use the values you had):",
  "  powercfg /change standby-timeout-ac 30",
  "  powercfg /change standby-timeout-dc 30",
].join("\n");

// The execution state lives on the PowerShell thread. That thread also exits when this process is gone.
async function keepMachineAwake(): Promise<() => void> {
  if (process.platform !== "win32") return () => {};
  const encoded = Buffer.from(AWAKE_SCRIPT, "utf16le").toString("base64");
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
    env: definedEnv({ ...process.env, PREGATE_AWAKE_PARENT: String(process.pid) }),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.unref();
  const ignore = () => {};
  child.on("error", ignore);
  child.stdout?.on("error", ignore);
  child.stderr?.on("error", ignore);
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer | string) => { stderr = (stderr + String(chunk)).slice(-400); });
  const stop = () => {
    child.stdout?.destroy();
    child.stderr?.destroy();
    try {
      child.kill();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ESRCH" && code !== "ENOENT") throw error;
    }
  };
  const ready = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 15_000);
    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
      if (!stdout.includes("awake")) return;
      clearTimeout(timer);
      resolve(true);
    });
    const giveUp = () => { clearTimeout(timer); resolve(false); };
    child.once("exit", giveUp);
    child.once("error", giveUp);
  });
  if (!ready) {
    stop();
    console.warn(SLEEP_INSTRUCTION);
    if (stderr.trim()) console.warn(stderr.trim());
    return () => {};
  }
  console.log("Windows sleep is suspended until this verifier exits.");
  return stop;
}

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

async function main(argv: string[]): Promise<void> {
  if (argv.length === 1 && argv[0] === "--help") {
    console.log(usage + "\nRequires native Windows x64, Git and the Bun version in .bun-version. Reports stay local.");
    return;
  }
  if (argv.length !== 2 && argv.length !== 4 || argv[0] !== "--artifacts" || !argv[1] || argv.length === 4 && (argv[2] !== "--report" || !argv[3])) throw new Error(usage);
  if (process.platform !== "win32" || arch() !== "x64") throw new Error("Native Windows x64 is required; cross-compilation is not Windows verification.");
  const artifacts = argv[1];
  const dist = resolve(artifacts);
  const output = argv[3] ? resolve(argv[3]) : join(tmpdir(), "pregate-windows-report-" + Date.now());
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
  const started = new Date().toISOString();
  const report = createWindowsReport(started);
  let failure: string | undefined, cleanupFailure: string | undefined;
  let releaseAwake = () => {};
  publishReport(output, report);
  try {
    report.commit = git("rev-parse", "HEAD");
    if (git("status", "--porcelain")) throw new Error("Use a clean checkout of the candidate commit; local changes cannot certify that commit.");
    const expectedBun = readFileSync(join(root, ".bun-version"), "utf8").trim();
    if (Bun.version !== expectedBun) throw new Error(`Bun ${expectedBun} is required; running ${Bun.version}.`);
    for (const name of [`pregate-${pkg.version}-windows-x64.zip`, "install.ps1", "SHA256SUMS"]) {
      report.artifacts[name] = createHash("sha256").update(readFileSync(join(dist, name))).digest("hex");
    }
    publishReport(output, report);
    printPreflight();
    releaseAwake = await keepMachineAwake();
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
      ["self-gate", [process.execPath, "src/main.ts", "check", "--ratchet", "--base", report.commit]],
    ];
    await runRecordedSteps({
      directory: output,
      report,
      commands,
      cwd: root,
      env,
      timeoutMs: (name) => (name === "windows-suite" ? 60 : 20) * 60 * 1000,
      noteFor: (step) => step.name === "self-gate" && step.exitCode !== 0 ? lagNote() : {},
    });
    if (git("status", "--porcelain")) throw new Error("Verification changed the checkout; inspect the changes before accepting the report.");
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    let awakeStop: string | undefined;
    try {
      releaseAwake();
    } catch (error) {
      awakeStop = error instanceof Error ? error.message : String(error);
    }
    try { rmSync(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
    catch (error) { cleanupFailure = String(error); }
    if (awakeStop) cleanupFailure = cleanupFailure ? `${awakeStop}\n${cleanupFailure}` : awakeStop;
    report.finished = new Date().toISOString();
    report.failure = failure;
    report.cleanupFailure = cleanupFailure;
    report.passed = !failure && !cleanupFailure && report.steps.length === 11 && report.steps.every((step) => step.exitCode === 0 && !step.timedOut);
    publishReport(output, report);
    console.log(`${report.passed ? "PASS" : "FAIL"}: ${join(output, "report.json")}`);
    if (failure) console.error(failure);
    process.exitCode = report.passed ? 0 : 1;
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
