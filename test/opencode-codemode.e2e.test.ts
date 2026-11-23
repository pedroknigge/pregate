import { beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";

// Compiled engine, real OpenCode 2.4.0 captures. A child shell that writes a file is denied, a
// clean child shell passes, and an automation whose action is shell is denied. The script itself
// passes only at 2.4.0. A project that never ran pregate enable, and one that ran pregate disable,
// allows the same calls.

setDefaultTimeout(180_000);

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-opencode-codemode-")));
const home = join(area, "home");
const data = join(area, "data");
const binary = join(area, "install", "0.0.12", ENGINE_FILE);
const env = {
  ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: data, APPDATA: join(area, "config"),
  XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
  CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PATH: WINDOWS ? process.env.PATH : "/usr/bin:/bin",
};
const CAPTURE = join(import.meta.dir, "payloads/opencode/capture");

interface Capture {
  tool: string; codemode: boolean; id: string; sessionID: string; agent: string;
  input: Record<string, unknown>;
}

function run(cwd: string, argv: string[], raw = "") {
  const r = Bun.spawnSync([binary, ...argv], { cwd, env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function git(cwd: string, ...args: string[]) {
  const ran = Bun.spawnSync(["git", "-c", "user.name=Hook", "-c", "user.email=hook@example.com", "-c", "commit.gpgsign=false", ...args], { cwd, env });
  expect(ran.exitCode, ran.stderr.toString()).toBe(0);
}

function project(name: string): string {
  const root = join(area, name);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/a.ts"), "export const a = 1;\n");
  mkdirSync(join(root, ".pregate"), { recursive: true });
  git(root, "init", "-q");
  writeFileSync(join(root, ".pregate/preset.json"), readFileSync(join(import.meta.dir, "../catalog/presets/legacy-safe.json"), "utf8"));
  const compiled = run(root, ["preset", "compile"]);
  expect(compiled.code, compiled.stderr).toBe(0);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  return root;
}

let sessions = 0;
function sessionId(): string {
  sessions += 1;
  return `ses_e2e_${sessions.toString(16).padStart(12, "0")}`;
}

function body(root: string, file: string, version: string): string {
  const captured = JSON.parse(readFileSync(join(CAPTURE, file), "utf8")) as Capture;
  const input: Record<string, unknown> = { ...captured.input };
  if (typeof input.path === "string") input.path = join(root, input.path);
  if (typeof input.command === "string" && input.workdir === undefined) input.workdir = root;
  return JSON.stringify({
    hook_event_name: "PreToolUse", session_id: sessionId(), cwd: root,
    tool_name: captured.tool, tool_use_id: captured.id, tool_input: input,
    agent_id: captured.agent, codemode: captured.codemode, opencode_version: version,
  });
}

function hook(root: string, file: string, version = "2.4.0") {
  return run(root, ["hook", "pre", "--harness", "opencode"], body(root, file, version));
}

function denied(out: { code: number; stdout: string; stderr: string }, cause: string) {
  const text = `${out.stdout}\n${out.stderr}`;
  expect(out.code, text).toBe(2);
  expect(out.stdout, text).toBe("");
  expect(out.stderr, text).toContain(`PREGATE DENY ${cause}`);
}

function allowed(out: { code: number; stdout: string; stderr: string }) {
  const text = `${out.stdout}\n${out.stderr}`;
  expect(out.code, text).toBe(0);
  expect(out.stderr, text).toBe("");
  expect(text).not.toContain("PREGATE DENY");
}

beforeAll(() => {
  mkdirSync(home, { recursive: true });
  engineAt(binary);
});

test("an enabled project judges each code-mode child and still denies a shell automation", () => {
  const root = project("enabled");
  expect(run(root, ["enable", "--yes"]).code).toBe(0);
  allowed(hook(root, "child-shell.json"));
  allowed(hook(root, "child-write.json"));
  allowed(hook(root, "execute-script.json"));
  denied(hook(root, "child-shell-src.json"), "shell-write");
  denied(hook(root, "child-automation-shell.json"), "shell-admin");
  denied(hook(root, "execute-script.json", "2.2.7"), "cannot-reconstruct");
  denied(hook(root, "execute-script.json", "2.3.1"), "cannot-reconstruct");
});

test("a project that never ran pregate enable allows the same calls", () => {
  const other = project("other-enabled");
  expect(run(other, ["enable", "--yes"]).code).toBe(0);
  const root = project("never");
  allowed(hook(root, "child-shell-src.json"));
  allowed(hook(root, "child-automation-shell.json"));
  allowed(hook(root, "execute-script.json", "2.2.7"));
  const bare = join(area, "bare");
  mkdirSync(bare, { recursive: true });
  git(bare, "init", "-q");
  allowed(hook(bare, "child-shell-src.json"));
  allowed(hook(bare, "child-automation-shell.json"));
});

test("pregate disable stops blocking this worktree", () => {
  const root = project("disabled");
  expect(run(root, ["enable", "--yes"]).code).toBe(0);
  denied(hook(root, "child-shell-src.json"), "shell-write");
  expect(run(root, ["disable", "--yes"]).code).toBe(0);
  allowed(hook(root, "child-shell-src.json"));
  allowed(hook(root, "child-automation-shell.json"));
  allowed(hook(root, "execute-script.json", "2.2.7"));
  expect(run(root, ["enable", "--yes"]).code).toBe(0);
  denied(hook(root, "child-shell-src.json"), "shell-write");
  denied(hook(root, "child-automation-shell.json"), "shell-admin");
});

test("uncertainty open still denies a shell write and a shell automation", () => {
  const root = project("open");
  expect(run(root, ["enable", "--yes"]).code).toBe(0);
  const preset = JSON.parse(readFileSync(join(root, ".pregate/preset.json"), "utf8")) as { uncertainty?: string };
  preset.uncertainty = "open";
  writeFileSync(join(root, ".pregate/preset.json"), JSON.stringify(preset));
  expect(run(root, ["preset", "compile"]).code).toBe(0);
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "open");
  allowed(hook(root, "child-shell.json"));
  allowed(hook(root, "execute-script.json"));
  denied(hook(root, "child-shell-src.json"), "shell-write");
  denied(hook(root, "child-automation-shell.json"), "shell-admin");
  allowed(hook(root, "execute-script.json", "2.2.7"));
});
