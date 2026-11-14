import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ENGINE_FILE } from "../src/platform.ts";
import { VERSIONS } from "../src/gate.ts";
import { engineAt } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Release binary, so PREGATE_TEST_ANSWER cannot approve it. stdin is a pipe, the same shape as a
// harness shell and a `!` line. The hook is asked first and does not itself apply the contract.
// The binary sits at <data>/pregate/<version>/pregate. The engine protects the folder two levels
// above itself, so a binary next to the fixture would protect the fixture.
const area = mkdtempSync(join(tmpdir(), "pregate-in-harness-"));
const data = join(area, "data");
const binary = join(data, "pregate", VERSIONS.engine, ENGINE_FILE);
const HARNESSES = ["claude-code", "codex", "cursor", "grok", "agy", "opencode"] as const;

beforeAll(() => engineAt(binary, false), 180_000);
afterAll(() => removeTree(area));

test("a piped harness shell approves with a code or --yes, and a bare approve still refuses", () => {
  const codeProject = project("by-code", data);
  const yesProject = project("by-yes", data);
  for (const harness of HARNESSES) {
    const allowed = hook(codeProject, harness, `pregate approve ${codeProject.code}`);
    expect(allowed.code, `${harness}\n${allowed.text}`).toBe(0);
    expect(allowed.text, harness).not.toContain("DENY");
    if (harness === "cursor") expect(JSON.parse(allowed.stdout).permission).toBe("allow");
    const bang = hook(codeProject, harness, `! pregate approve --yes --digest ${codeProject.digest}`);
    expect(bang.code, `${harness} bang\n${bang.text}`).toBe(0);
    expect(existsSync(join(codeProject.root, ".pregate/preset.json")), harness).toBe(false);
  }
  const bare = run(codeProject, ["approve"], "y\n");
  expect(bare.code, bare.text).toBe(1);
  expect(bare.text).toContain("no terminal");
  expect(existsSync(join(codeProject.root, ".pregate/preset.json"))).toBe(false);
  const wrong = run(codeProject, ["approve", "--yes", "--digest", "0".repeat(64)]);
  expect(wrong.code, wrong.text).toBe(1);
  expect(existsSync(join(codeProject.root, ".pregate/preset.json"))).toBe(false);
  const env = hook(codeProject, "claude-code", `PREGATE_UNATTENDED_APPROVAL=1 pregate approve --yes --digest ${codeProject.digest}`);
  expect(env.code, env.text).toBe(2);
  expect(env.text).toContain("hook-switch");
  expect(env.text).toContain("Ask the user to approve. Do not run the approval command yourself.");
  const state = hook(codeProject, "claude-code", "echo x > .pregate/preset.json");
  expect(state.code, state.text).toBe(2);
  expect(state.text).toContain("protected-path");
  const logPath = join(codeProject.data, "pregate", "contract-approvals", "log.jsonl");
  const records = hook(codeProject, "claude-code", `echo x > '${logPath}'`);
  expect(records.code, records.text).toBe(2);

  const applied = run(codeProject, ["approve", codeProject.code, "--no-commit"]);
  expect(applied.code, applied.text).toBe(0);
  expect(existsSync(join(codeProject.root, ".pregate/pregate.lock.json"))).toBe(true);
  const byYes = run(yesProject, ["approve", "--yes", "--digest", yesProject.digest, "--no-commit"]);
  expect(byYes.code, byYes.text).toBe(0);
  expect(existsSync(join(yesProject.root, ".pregate/pregate.lock.json"))).toBe(true);
  const lines = readFileSync(logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line) as { via: string; tty: boolean; root: string });
  expect(lines.some((line) => line.root === codeProject.root && line.via === "yes" && line.tty === false)).toBe(true);
  expect(lines.some((line) => line.root === yesProject.root && line.via === "yes" && line.tty === false)).toBe(true);
}, 180_000);

interface Project { root: string; data: string; env: Record<string, string>; digest: string; code: string }

function project(name: string, data: string): Project {
  const root = join(area, name);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/a.ts"), "export const value = 1;\n");
  expect(Bun.spawnSync(["git", "init", "-q", "-b", "main", root]).exitCode).toBe(0);
  const env = baseEnv(data);
  const preview = Bun.spawnSync([binary, "init", "--preview", "--preset", "legacy-safe"], {
    cwd: root, env: { ...env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe",
  });
  const text = preview.stdout.toString() + preview.stderr.toString();
  expect(preview.exitCode, text).toBe(0);
  const digest = /Digest: ([a-f0-9]{64})/.exec(text)?.[1];
  expect(digest, text).toMatch(/^[a-f0-9]{64}$/);
  return { root, data, env, digest: digest!, code: digest!.slice(0, 12) };
}

function baseEnv(data: string): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "", HOME: join(area, "home"), TMPDIR: area,
    XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"),
    GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  };
  if (process.platform === "win32") {
    env.USERPROFILE = join(area, "home");
    env.LOCALAPPDATA = data;
    env.APPDATA = join(area, "config");
    env.SystemRoot = process.env.SystemRoot ?? "C:\\Windows";
  }
  return env;
}

function run(p: Project, args: string[], stdin = ""): { code: number; text: string } {
  const result = Bun.spawnSync([binary, ...args], {
    cwd: p.root, env: p.env, stdin: Buffer.from(stdin), stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  return { code: result.exitCode ?? -1, text: result.stdout.toString() + result.stderr.toString() };
}

function hook(p: Project, harness: typeof HARNESSES[number], command: string): { code: number; text: string; stdout: string } {
  const names = {
    "claude-code": "pre-bash.json", codex: "codex/pre-bash.json", cursor: "cursor/pre-shell.json",
    grok: "grok/pre-run-terminal-command.json", agy: "agy/pre-run_command.json", opencode: "opencode/pre-shell.json",
  };
  const payload = JSON.parse(readFileSync(join(import.meta.dir, "payloads", names[harness]), "utf8"));
  if (harness === "agy") { payload.workspacePaths = [p.root]; payload.toolCall.args.Cwd = p.root; payload.toolCall.args.CommandLine = command; }
  else if (harness === "grok") { payload.cwd = payload.workspaceRoot = p.root; payload.toolInput.command = payload.tool_input.command = command; }
  else {
    payload.cwd = p.root; payload.workspace_roots = [p.root]; payload.tool_input.command = command;
    if (harness === "cursor") payload.tool_input.cwd = p.root;
    if (harness === "opencode") payload.tool_input.workdir = p.root;
  }
  const result = Bun.spawnSync([binary, "hook", "pre", "--harness", harness], {
    cwd: p.root, env: p.env, stdin: Buffer.from(JSON.stringify(payload)), stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
  const stdout = result.stdout.toString();
  return { code: result.exitCode ?? -1, stdout, text: stdout + result.stderr.toString() };
}
