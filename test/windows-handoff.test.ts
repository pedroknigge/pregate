import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWindowsReport, runRecordedSteps, type WindowsReport } from "../scripts/verify-windows.ts";

const script = join(import.meta.dir, "../scripts/verify-windows.ts");
function run(...args: string[]) {
  return Bun.spawnSync([process.execPath, script, ...args], { stdout: "pipe", stderr: "pipe", timeout: 10000 });
}
test("manual Windows handoff exposes its prerequisites without starting a verification", () => {
  const result = run("--help");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("--artifacts <candidate-directory>");
  expect(result.stdout.toString()).toContain("Requires native Windows x64");
  expect(result.stdout.toString()).not.toContain("PASS");
});
test("manual Windows handoff rejects an ambiguous command before testing", () => {
  const result = run("--artifacts", "missing", "--upload", "yes");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("--report <new-directory>");
});
if (process.platform !== "win32" || process.arch !== "x64") test("a non-Windows host cannot produce a Windows verification pass", () => {
  const result = run("--artifacts", "missing");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("Native Windows x64 is required");
  expect(result.stdout.toString()).not.toContain("PASS");
});

function holdCommand(releasePath: string): string[] {
  const source = `
    const fs = require("node:fs");
    const release = ${JSON.stringify(releasePath)};
    const deadline = Date.now() + 20000;
    while (!fs.existsSync(release)) {
      if (Date.now() > deadline) process.exit(2);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    process.exit(0);
  `;
  return [process.execPath, "-e", source];
}

function readReport(directory: string): WindowsReport | undefined {
  try { return JSON.parse(readFileSync(join(directory, "report.json"), "utf8")) as WindowsReport; } catch { return undefined; }
}

async function waitForReport(directory: string, ready: (report: WindowsReport) => boolean, label: string): Promise<WindowsReport> {
  const deadline = Date.now() + 8_000;
  let last = "";
  while (Date.now() < deadline) {
    const report = readReport(directory);
    if (report) {
      last = JSON.stringify(report.steps.map((step) => step.name));
      if (ready(report)) return report;
    }
    await Bun.sleep(20);
  }
  throw new Error(`${label}. Last steps: ${last || "no report"}`);
}

test("report.json lists a completed step before the run ends", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pregate-windows-report-"));
  const releaseFirst = join(directory, "release-first");
  const releaseSecond = join(directory, "release-second");
  const report = createWindowsReport();
  let settled = false;
  const pending = runRecordedSteps({
    directory,
    report,
    cwd: directory,
    env: process.env,
    timeoutMs: () => 20_000,
    commands: [
      ["first", holdCommand(releaseFirst)],
      ["second", holdCommand(releaseSecond)],
    ],
  }).finally(() => { settled = true; });
  try {
    const initial = await waitForReport(directory, (current) => current.finished === null && current.steps.length === 0, "report was not created at the start");
    expect(settled).toBe(false);
    expect(initial.finished).toBeNull();
    writeFileSync(releaseFirst, "go");
    const mid = await waitForReport(
      directory,
      (current) => current.finished === null && current.steps.length === 1 && current.steps[0]?.name === "first" && current.steps[0]?.exitCode === 0,
      "completed step was not recorded while the run was still going",
    );
    expect(settled).toBe(false);
    expect(mid.finished).toBeNull();
    expect(mid.steps.map((step) => step.name)).toEqual(["first"]);
    writeFileSync(releaseSecond, "go");
    await pending;
    const done = readReport(directory);
    expect(done?.finished).toBeNull();
    expect(done?.steps.map((step) => step.name)).toEqual(["first", "second"]);
  } finally {
    writeFileSync(releaseFirst, "go");
    writeFileSync(releaseSecond, "go");
    await pending.catch(() => {});
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);

function alive(pid: number): boolean {
  if (process.platform === "win32") {
    const listed = Bun.spawnSync(["tasklist", "/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { stdout: "pipe", stderr: "pipe" });
    return listed.stdout.toString().includes(`"${pid}"`);
  }
  if (process.platform === "linux") {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const state = stat.slice(stat.lastIndexOf(")") + 1).trim().split(" ")[0];
      return state !== "Z" && state !== "X";
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function stopped(pid: number): Promise<boolean> {
  const deadline = Date.now() + 3_000;
  while (alive(pid)) {
    if (Date.now() >= deadline) return false;
    await Bun.sleep(50);
  }
  return true;
}

test("a timed-out step is killed with the child it spawned", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pregate-windows-tree-"));
  const pidFile = join(directory, "pids.json");
  const source = `
    const { spawn } = require("node:child_process");
    const fs = require("node:fs");
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], { stdio: "ignore", windowsHide: true });
    if (!child.pid) { console.error("child pid missing"); process.exit(1); }
    fs.writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify({ parent: process.pid, child: child.pid }));
    setInterval(() => {}, 1000);
  `;
  const report = createWindowsReport();
  let pids: { parent: number; child: number } | undefined;
  try {
    await runRecordedSteps({
      directory,
      report,
      cwd: directory,
      env: process.env,
      timeoutMs: () => 4_000,
      commands: [["hold", [process.execPath, "-e", source]]],
    });
    const written = readReport(directory);
    expect(written?.finished).toBeNull();
    expect(written?.steps[0]?.timedOut).toBe(true);
    expect(written?.steps[0]?.name).toBe("hold");
    if (!existsSync(pidFile)) throw new Error(readFileSync(join(directory, "hold.stderr.log"), "utf8"));
    pids = JSON.parse(readFileSync(pidFile, "utf8")) as { parent: number; child: number };
    expect(pids.parent).not.toBe(process.pid);
    expect(pids.child).not.toBe(pids.parent);
    expect(await stopped(pids.parent)).toBe(true);
    expect(await stopped(pids.child)).toBe(true);
  } finally {
    if (pids) {
      for (const pid of [pids.child, pids.parent]) {
        if (pid > 0 && pid !== process.pid) {
          try { process.kill(pid, "SIGKILL"); } catch { /* already stopped */ }
        }
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
