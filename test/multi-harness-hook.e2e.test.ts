import { afterAll, afterEach, beforeEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compile } from "../src/compile.ts";
import { enable } from "../src/consent.ts";
import { canonical } from "../src/disk.ts";
import { LOCK, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { slash } from "../src/paths.ts";
import { agyPlugin, merge } from "../src/register.ts";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled hook entry, with claude, codex and agy registered in a fixture home the way
// `pregate setup` writes them. Cursor is gated by that shared Claude registration.
setDefaultTimeout(180_000);

const base = realpathSync(mkdtempSync(join(tmpdir(), "multi-harness-")));
const names = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "TMPDIR", "CODEX_HOME", "GROK_HOME", "CLAUDE_CONFIG_DIR", "PREGATE_TESTING", "PREGATE_TEST_ANSWER", "CI", "PREGATE_UNATTENDED_APPROVAL"] as const;
let saved: Record<string, string | undefined>;
let area: string;

beforeEach(() => {
  saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  area = join(base, String(Date.now()));
  for (const [name, folder] of Object.entries({ HOME: "home", XDG_DATA_HOME: "data", XDG_STATE_HOME: "state", TMPDIR: "tmp" })) {
    const dir = join(area, folder);
    mkdirSync(dir, { recursive: true });
    process.env[name] = dir;
  }
  delete process.env.CODEX_HOME;
  delete process.env.GROK_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.PREGATE_TESTING;
  delete process.env.PREGATE_TEST_ANSWER;
  delete process.env.PREGATE_UNATTENDED_APPROVAL;
});
afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});
afterAll(() => removeTree(base));

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function git(root: string, ...args: string[]): void {
  const ran = Bun.spawnSync(["git", "-c", "user.name=Hook", "-c", "user.email=hook@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: root, env: process.env, stderr: "pipe" });
  if (ran.exitCode !== 0) throw new Error(ran.stderr.toString());
}

function installGlobal(): void {
  const home = process.env.HOME!;
  const data = slash(join(process.env.XDG_DATA_HOME!, "pregate"));
  put(join(home, ".claude/settings.json"), merge(null, "shared", data)!);
  const hooks = slash(join(home, ".codex/hooks.json"));
  put(hooks, merge(null, "codex", data)!);
  const events = ["pre_tool_use", "stop", "session_start", "subagent_start", "subagent_stop"];
  const trust: Record<string, string> = {};
  const tables = events.map((event) => {
    const key = `${hooks}:${event}:0:0`;
    trust[key] = "sha256:fixture";
    return `[hooks.state."${key}"]\ntrusted_hash = "sha256:fixture"\n`;
  });
  put(join(home, ".codex/config.toml"), `${tables.join("\n")}\n`);
  put(join(process.env.XDG_STATE_HOME!, "pregate/codex-trust.json"), `${JSON.stringify(trust)}\n`);
  for (const [name, text] of Object.entries(agyPlugin(data, "0.0.10"))) put(join(home, ".gemini/config/plugins/pregate-global", name), text);
}

function project(): string {
  const root = canonical(join(area, "repo"));
  const source = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/presets/legacy-safe.json"), "utf8")) as unknown;
  const preset = JSON.stringify(source);
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  put(join(root, PRESET), preset);
  const compiled = compile(preset, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  put(join(root, LOCK), compiled.text);
  // A project file that mentions pregate used to un-gate every global harness.
  put(join(root, ".agents/plugins.json"), '{"note":"mentions pregate"}\n');
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  enable(root);
  return root;
}

function hook(cli: string, harness: string, cwd: string, command: string, tool = "Bash") {
  const body = harness === "agy"
    ? { conversationId: "multi", workspacePaths: [cwd], cwd, stepIdx: 1, hookEventName: "PreToolUse", toolCall: { name: "run_command", args: { CommandLine: command, Cwd: cwd } } }
    : { hook_event_name: "PreToolUse", session_id: "multi", permission_mode: "default", tool_name: tool, tool_use_id: command.slice(0, 80), cwd, tool_input: tool === "Bash" ? { command } : { file_path: command, content: "export const a = 2;\n" } };
  return Bun.spawnSync([cli, "hook", "pre", "--harness", harness], {
    cwd, env: process.env, stdin: Buffer.from(JSON.stringify(body)), stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
}

function text(out: ReturnType<typeof hook>): string {
  return `${out.stdout.toString()}\n${out.stderr.toString()}`;
}

test("a gated harness may launch claude, codex and agy, including a prompt that mentions pregate", () => {
  installGlobal();
  const cli = testEngine();
  const root = project();
  const prompt = "update the pregate docs";
  const launches = [
    ["codex", `claude -p "${prompt}"`],
    ["codex", `claude-code -p "${prompt}"`],
    ["codex", `/opt/homebrew/bin/claude.exe -p "${prompt}"`],
    ["claude-code", `codex exec "${prompt}"`],
    ["claude-code", `codex exec pregate`],
    ["claude-code", `agy -p "${prompt}"`],
    ["claude-code", `antigravity -p "${prompt}"`],
    ["agy", `cursor-agent -p "${prompt}"`],
    ["agy", `agent -p "${prompt}"`],
    ["codex", `npx @anthropic-ai/claude-code -p "${prompt}"`],
    ["claude-code", `grok -p "${prompt}"`],
  ] as const;
  for (const [from, command] of launches) {
    const out = hook(cli, from, root, command);
    expect(out.exitCode, `${from}: ${command}\n${text(out)}`).toBe(0);
    expect(text(out), command).not.toContain("PREGATE DENY");
  }
  const ungated = hook(cli, "codex", root, "gemini -p hello");
  expect(ungated.exitCode, text(ungated)).toBe(0);
  expect(text(ungated)).not.toContain("PREGATE DENY");
  const aider = hook(cli, "claude-code", root, "aider --yes");
  expect(aider.exitCode, text(aider)).toBe(0);
  expect(text(aider)).not.toContain("PREGATE DENY");
  for (const command of ["claude --dangerously-skip-permissions -p hi", "claude --yolo", "codex --dangerously-bypass-approvals-and-sandbox exec hi"]) {
    const denied = hook(cli, "codex", root, command);
    expect(denied.exitCode, command).toBe(2);
    expect(denied.stderr.toString(), command).toContain("hook-switch");
  }
});

test("pregate disable stops blocking this worktree, including approval and settings writes", () => {
  installGlobal();
  const cli = testEngine();
  const root = project();
  const denied = hook(cli, "codex", root, "git commit --no-verify -m x");
  expect(denied.exitCode, text(denied)).toBe(0);
  expect(text(denied)).not.toContain("PREGATE DENY");
  const off = Bun.spawnSync([cli, "disable", "--yes"], {
    cwd: root, env: { ...process.env, PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: "y" }, stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  expect(off.exitCode, `${off.stdout.toString()}\n${off.stderr.toString()}`).toBe(0);
  expect(off.stdout.toString()).toContain("disabled");
  const status = Bun.spawnSync([cli, "status"], { cwd: root, env: process.env, stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  expect(status.exitCode, status.stdout.toString()).toBe(0);
  expect(status.stdout.toString()).toContain("disabled for this worktree");
  expect(status.stdout.toString()).toContain("do not block");
  // The same session already reached this root while it was enabled.
  const allowed = hook(cli, "codex", root, "git commit --no-verify -m x");
  expect(allowed.exitCode, text(allowed)).toBe(0);
  expect(text(allowed)).not.toContain("PREGATE DENY");
  const launched = hook(cli, "codex", root, "gemini -p hello");
  expect(launched.exitCode, text(launched)).toBe(0);
  const forge = hook(cli, "codex", root, "pregate approve --yes");
  expect(forge.exitCode, text(forge)).toBe(0);
  expect(text(forge)).not.toContain("PREGATE DENY");
  const turnedOn = hook(cli, "claude-code", root, "pregate enable --yes");
  expect(turnedOn.exitCode, text(turnedOn)).toBe(0);
  expect(text(turnedOn)).not.toContain("PREGATE DENY");
  const edit = hook(cli, "claude-code", root, join(root, "src/a.ts"), "Write");
  expect(edit.exitCode, text(edit)).toBe(0);
  expect(text(edit)).not.toContain("PREGATE DENY");
  const settings = hook(cli, "claude-code", root, join(process.env.HOME!, ".claude/settings.json"), "Write");
  expect(settings.exitCode, text(settings)).toBe(0);
  expect(text(settings)).not.toContain("PREGATE DENY");
  const back = Bun.spawnSync([cli, "enable", "--yes"], {
    cwd: root, env: { ...process.env, PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: "y" }, stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  expect(back.exitCode, `${back.stdout.toString()}\n${back.stderr.toString()}`).toBe(0);
  const whole = Bun.spawnSync([cli, "disable", "--project", "--yes"], {
    cwd: root, env: { ...process.env, PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: "y" }, stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  expect(whole.exitCode, `${whole.stdout.toString()}\n${whole.stderr.toString()}`).toBe(0);
  expect(whole.stdout.toString()).toContain("disabled for this project");
  const projectStatus = Bun.spawnSync([cli, "status"], { cwd: root, env: process.env, stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  expect(projectStatus.stdout.toString()).toContain("This project is disabled");
  const projectApprove = hook(cli, "codex", root, "pregate approve --yes");
  expect(projectApprove.exitCode, text(projectApprove)).toBe(0);
  expect(text(projectApprove)).not.toContain("PREGATE DENY");
});
