import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";
import { enable } from "../src/consent.ts";
import { canonical } from "../src/disk.ts";
import { removeTree } from "./remove-tree.ts";

// `pregate check` reaches git. A git that ignores the deadline makes that call reject. The process
// must exit non-zero, and the same rejection on the hook path must not come back as an allow.
setDefaultTimeout(60_000);

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-rejection-")));
const root = join(area, "repo");
const data = join(area, "data");
const main = join(import.meta.dir, "../src/main.ts");
const bin = join(area, "bin");

function stallGit(): void {
  mkdirSync(bin, { recursive: true });
  if (process.platform === "win32") {
    // Leave the project directory before sleeping. A killed git.cmd can leave ping running, and
    // Windows refuses to delete a directory that is still a process's working directory.
    writeFileSync(join(bin, "git.cmd"), "@echo off\r\ncd /d %SystemRoot%\r\nping -n 30 127.0.0.1 >nul\r\nexit /b 1\r\n");
    return;
  }
  const path = join(bin, "git");
  writeFileSync(path, "#!/bin/sh\nsleep 30\nexit 1\n");
  chmodSync(path, 0o755);
}

function run(args: string[], input?: string) {
  const path = `${bin}${delimiter}${process.env.PATH ?? process.env.Path ?? ""}`;
  const env = { ...process.env, PATH: path, Path: path, XDG_DATA_HOME: data, CI: "1" };
  const result = Bun.spawnSync([process.execPath, main, ...args], {
    cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000,
    ...(input === undefined ? {} : { stdin: Buffer.from(input) }),
  });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

afterAll(() => removeTree(area));

test("a throw from pregate check exits non-zero", () => {
  mkdirSync(root, { recursive: true });
  const git = Bun.spawnSync(["git", "init", "-q"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  expect(git.exitCode, git.stderr.toString()).toBe(0);
  mkdirSync(join(root, ".pregate"), { recursive: true });
  const init = Bun.spawnSync([process.execPath, main, "init", "--yes", "--preset", "integrity-only"], {
    cwd: root, env: { ...process.env, XDG_DATA_HOME: data, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" },
    stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  expect(init.exitCode, init.stdout.toString() + init.stderr.toString()).toBe(0);
  stallGit();
  const out = run(["check"]);
  expect(out.code).not.toBe(0);
  expect(out.stderr).toContain("pregate:");
  expect(out.stderr).toContain("Git exceeded its 5000 ms command deadline.");
});

test("a hook whose engine throws is not an allow", () => {
  enable(root, data);
  stallGit();
  const payload = `${JSON.stringify({
    hook_event_name: "PreToolUse", session_id: "reject-1", cwd: root, tool_name: "Write", tool_use_id: "toolu_reject",
    tool_input: { file_path: join(root, "src/a.ts"), content: "export const a = 1;\n" },
  })}\n`;
  const out = run(["hook", "pre", "--harness", "claude-code"], payload);
  expect(out.code).not.toBe(0);
  expect(out.stdout).not.toContain("\"permissionDecision\":\"allow\"");
  expect(out.stderr).toContain("pregate:");
});
