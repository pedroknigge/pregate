import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import type { HarnessId } from "../src/types.ts";

// The compiled hook. Self-protection denies only after pregate enable.
// A project that never ran it, a worktree disable, and a project disable allow the same commands.

setDefaultTimeout(240_000);

const HARNESSES: HarnessId[] = ["claude-code", "codex", "cursor", "grok", "agy", "opencode"];
const DENY = /"permission"\s*:\s*"deny"|"permissionDecision"\s*:\s*"deny"|"decision"\s*:\s*"(?:deny|block|force_ask)"|PREGATE DENY|PREGATE:/;
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-unenforced-")));
const home = join(area, "home");
const data = join(area, "data");
const binary = join(area, "install", "0.0.12", ENGINE_FILE);
const env = {
  ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: data, APPDATA: join(area, "config"),
  XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
  CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PATH: WINDOWS ? process.env.PATH : "/usr/bin:/bin",
};
let sessions = 0;

function sessionId(): string {
  sessions += 1;
  return `00000000-0000-4000-8000-${sessions.toString(16).padStart(12, "0")}`;
}

function run(cwd: string, argv: string[], raw: string) {
  const r = Bun.spawnSync([binary, ...argv], { cwd, env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function project(name: string): string {
  const root = join(area, name);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, ".pregate"), { recursive: true });
  expect(Bun.spawnSync(["git", "init", "-q", root], { env }).exitCode).toBe(0);
  writeFileSync(join(root, ".pregate/preset.json"), readFileSync("catalog/presets/legacy-safe.json", "utf8"));
  const compiled = run(root, ["preset", "compile"], "");
  expect(compiled.code, compiled.stderr).toBe(0);
  return root;
}

function shell(h: HarnessId, cwd: string, command: string): string {
  const session_id = sessionId();
  if (h === "codex") return JSON.stringify({
    session_id, cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_use_id: "exec-unenforced", tool_input: { command },
  });
  if (h === "cursor") return JSON.stringify({
    session_id, generation_id: session_id, hook_event_name: "preToolUse", tool_name: "Shell",
    tool_use_id: session_id, cwd, workspace_roots: [cwd], tool_input: { command, cwd },
  });
  if (h === "grok") return JSON.stringify({
    hookEventName: "pre_tool_use", sessionId: session_id, cwd, toolName: "run_terminal_command",
    toolUseId: session_id, toolInputTruncated: false, toolInput: { command },
  });
  if (h === "agy") return JSON.stringify({
    conversationId: session_id, workspacePaths: [cwd], cwd, stepIdx: 1, hookEventName: "PreToolUse",
    toolCall: { name: "run_command", args: { CommandLine: command, Cwd: cwd } },
  });
  if (h === "opencode") return JSON.stringify({
    hook_event_name: "PreToolUse", session_id, cwd, tool_name: "shell", tool_use_id: session_id,
    tool_input: { command, workdir: cwd },
  });
  return JSON.stringify({
    hook_event_name: "PreToolUse", session_id, cwd, tool_name: "Bash", tool_use_id: session_id, tool_input: { command },
  });
}

function edit(h: HarnessId, cwd: string, target: string): string {
  const session_id = sessionId();
  if (h === "codex") return JSON.stringify({
    session_id, cwd, hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_use_id: "exec-edit",
    tool_input: { command: `*** Begin Patch\n*** Add File: ${target}\n+{}\n*** End Patch\n` },
  });
  if (h === "cursor") return JSON.stringify({
    session_id, generation_id: session_id, hook_event_name: "preToolUse", tool_name: "Write",
    tool_use_id: session_id, cwd, workspace_roots: [cwd], tool_input: { file_path: target, content: "{}\n" },
  });
  if (h === "grok") return JSON.stringify({
    hookEventName: "pre_tool_use", sessionId: session_id, cwd, toolName: "write", toolUseId: session_id,
    toolInputTruncated: false, toolInput: { file_path: target, content: "{}\n" },
  });
  if (h === "agy") return JSON.stringify({
    conversationId: session_id, workspacePaths: [cwd], cwd, stepIdx: 1, hookEventName: "PreToolUse",
    toolCall: { name: "write_to_file", args: { TargetFile: target, CodeContent: "{}\n", Overwrite: true } },
  });
  if (h === "opencode") return JSON.stringify({
    hook_event_name: "PreToolUse", session_id, cwd, tool_name: "write", tool_use_id: session_id,
    tool_input: { filePath: target, content: "{}\n" },
  });
  return JSON.stringify({
    hook_event_name: "PreToolUse", session_id, cwd, tool_name: "Write", tool_use_id: session_id,
    tool_input: { file_path: target, content: "{}\n" },
  });
}

function hook(cwd: string, h: HarnessId, raw: string) {
  return run(cwd, ["hook", "pre", "--harness", h], raw);
}

function notDenied(out: { code: number; stdout: string; stderr: string }) {
  const text = `${out.stdout}${out.stderr}`;
  expect(out.code, text).toBe(0);
  expect(text).not.toMatch(DENY);
}

function denied(h: HarnessId, out: { code: number; stdout: string; stderr: string }, cause: string) {
  const text = `${out.stdout}${out.stderr}`;
  expect(text, text).toContain(cause);
  expect(text).toMatch(DENY);
  expect(out.code).toBe(h === "cursor" || h === "agy" ? 0 : 2);
}

beforeAll(() => {
  mkdirSync(home, { recursive: true });
  engineAt(binary);
});

afterAll(() => {
  writeFileSync(join(area, "captured.txt"), `sessions ${sessions}\n`);
});

test.each(HARNESSES)("%s denies self-protection only where pregate enable ran", (h) => {
  const root = project(h);
  const preset = join(root, ".pregate/preset.json");
  const commit = () => hook(root, h, shell(h, root, "git commit --no-verify"));
  const write = () => hook(root, h, edit(h, root, preset));
  notDenied(commit());
  notDenied(write());
  expect(run(root, ["enable", "--yes"], "").code).toBe(0);
  notDenied(commit());
  denied(h, write(), "invalid contract change");
  expect(run(root, ["disable", "--yes"], "").code).toBe(0);
  notDenied(commit());
  notDenied(write());
  expect(run(root, ["enable", "--yes"], "").code).toBe(0);
  expect(run(root, ["disable", "--project", "--yes"], "").code).toBe(0);
  notDenied(commit());
  notDenied(write());
});
