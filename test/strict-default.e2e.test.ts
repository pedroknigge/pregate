import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import type { HarnessId } from "../src/types.ts";

// Real binary. Enabled projects deny a payload or a crash the engine cannot classify.
// A directory that never ran pregate enable, and one that ran pregate disable, allow the same failure.
// "uncertainty": "open" allows only that unclassified failure. A protected path still denies.

setDefaultTimeout(120_000);

const HARNESSES: Covered[] = ["claude-code", "codex", "cursor"];
type Covered = "claude-code" | "codex" | "cursor";
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-strict-")));
const home = join(area, "home");
const data = join(area, "data");
// Two levels above the binary is the installation the engine protects. That folder must not
// contain the projects: a command word resolves inside the project, and an engine home that is
// an ancestor of the project would make every word a protected path.
const binary = join(area, "install", "0.0.12", ENGINE_FILE);
const capture: string[] = [];
const env = {
  ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: data, APPDATA: join(area, "config"),
  XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
  CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PATH: WINDOWS ? process.env.PATH : "/usr/bin:/bin",
};

function run(cwd: string, argv: string[], raw: string) {
  const r = Bun.spawnSync([binary, ...argv], { cwd, env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  const out = { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
  capture.push(`$ pregate ${argv.join(" ")}\n# cwd ${cwd}\n# stdin ${raw.slice(0, 180)}\n# exit ${out.code}\n# stdout ${JSON.stringify(out.stdout)}\n# stderr ${JSON.stringify(out.stderr)}\n`);
  return out;
}

function git(cwd: string) {
  const init = Bun.spawnSync(["git", "init", "-q", cwd], { env });
  expect(init.exitCode).toBe(0);
}

function project(name: string): string {
  const root = join(area, name);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, ".pregate"), { recursive: true });
  git(root);
  writeFileSync(join(root, ".pregate/preset.json"), readFileSync("catalog/presets/legacy-safe.json", "utf8"));
  const compiled = run(root, ["preset", "compile"], "");
  expect(compiled.code, compiled.stderr).toBe(0);
  return root;
}

function preset(root: string, uncertainty: "open" | "closed" | null) {
  const value = JSON.parse(readFileSync(join(root, ".pregate/preset.json"), "utf8")) as { uncertainty?: string };
  if (uncertainty === null) delete value.uncertainty;
  else value.uncertainty = uncertainty;
  writeFileSync(join(root, ".pregate/preset.json"), JSON.stringify(value));
}

// A fresh session each call. A session that already touched a root rejects a preset written
// afterwards as lock-stale, which would hide the shell decision this file is checking.
let sessions = 0;
function sessionId(): string {
  sessions += 1;
  return `00000000-0000-4000-8000-${sessions.toString(16).padStart(12, "0")}`;
}

function bash(h: Covered, cwd: string, command: string): string {
  const session_id = sessionId();
  if (h === "codex") return JSON.stringify({
    session_id, turn_id: "00000000-0000-4000-8000-a00000000201",
    cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_use_id: "exec-strict", tool_input: { command },
  });
  if (h === "cursor") return JSON.stringify({
    session_id, generation_id: session_id,
    conversation_id: session_id, hook_event_name: "preToolUse", tool_name: "Shell",
    tool_use_id: "00000000-0000-4000-8000-000000000003", cwd, workspace_roots: [cwd],
    tool_input: { command, cwd, timeout: 30000 },
  });
  return JSON.stringify({
    session_id, cwd, hook_event_name: "PreToolUse",
    tool_name: "Bash", tool_use_id: "toolu_strict", tool_input: { command },
  });
}

function denied(h: Covered, out: { code: number; stdout: string; stderr: string }, cause: string, override = true) {
  const text = out.stdout + out.stderr;
  expect(text, text).toContain(cause);
  expect(text).toContain(override ? "uncertainty" : cause);
  if (!override) expect(text).not.toContain("set uncertainty to open");
  expect(text).not.toContain("future_write");
  if (h === "cursor") {
    expect(out.code).toBe(0);
    expect(out.stdout).toContain('"permission":"deny"');
  } else if (h === "claude-code") {
    expect(out.code).toBe(2);
    expect(out.stdout).toContain('"permissionDecision":"deny"');
  } else {
    expect(out.code).toBe(2);
    expect(out.stdout).toBe("");
  }
}

function allowed(h: Covered, out: { code: number; stdout: string; stderr: string }) {
  expect(out.code).toBe(0);
  expect(out.stderr).toBe("");
  expect(out.stdout + out.stderr).not.toContain("DENY");
  if (h === "cursor") expect(out.stdout).toContain('"permission":"allow"');
  else expect(out.stdout).toBe("");
}

beforeAll(() => {
  mkdirSync(home, { recursive: true });
  engineAt(binary);
});

afterAll(() => {
  writeFileSync(join(area, "captured.txt"), capture.join("\n"));
});

test.each(HARNESSES)("enabled %s denies a malformed payload, an unknown tool, unfinished shell, and a crash", (h) => {
  const root = project(`enabled-${h}`);
  expect(run(root, ["enable", "--yes"], "").code).toBe(0);
  denied(h, run(root, ["hook", "pre", "--harness", h], "{"), "payload-unrecognized");
  const unknown = bash(h, root, "echo ok").replace('"Bash"', '"future_write"').replace('"Shell"', '"future_write"');
  denied(h, run(root, ["hook", "pre", "--harness", h], unknown), "payload-unrecognized");
  denied(h, run(root, ["hook", "pre", "--harness", h], bash(h, root, 'echo "hello')), "shell-uncertain");
  const crashed = crash(root, h);
  expect(crashed.code).toBe(h === "cursor" ? 0 : 2);
  expect(crashed.stdout + crashed.stderr).toContain("could not evaluate");
  if (h === "cursor") expect(crashed.stdout).toContain('"permission":"deny"');
});

test.each(HARNESSES)("never-enabled %s allows the same malformed payload and crash", (h) => {
  const root = project(`never-${h}`);
  const other = project("other-enabled");
  expect(run(other, ["enable", "--yes"], "").code).toBe(0);
  allowed(h, run(root, ["hook", "pre", "--harness", h], "{"));
  allowed(h, run(root, ["hook", "pre", "--harness", h], bash(h, root, 'echo "hello')));
  allowed(h, crash(root, h));
});

test.each(HARNESSES)("disabled %s allows the same malformed payload and crash", (h) => {
  const root = project(`disabled-${h}`);
  expect(run(root, ["enable", "--yes"], "").code).toBe(0);
  expect(run(root, ["disable", "--yes"], "").code).toBe(0);
  allowed(h, run(root, ["hook", "pre", "--harness", h], "{"));
  allowed(h, crash(root, h));
});

test.each(HARNESSES)("uncertainty open in an enabled %s project allows unclassified failures and still denies protection", (h) => {
  const root = project(`open-${h}`);
  expect(run(root, ["enable", "--yes"], "").code).toBe(0);
  preset(root, "open");
  expect(run(root, ["preset", "compile"], "").code).toBe(0);
  allowed(h, run(root, ["hook", "pre", "--harness", h], "{"));
  allowed(h, run(root, ["hook", "pre", "--harness", h], bash(h, root, 'echo "hello')));
  allowed(h, crash(root, h));
  const admin = run(root, ["hook", "pre", "--harness", h], bash(h, root, "git commit --no-verify"));
  allowed(h, admin);
  preset(root, "closed");
  denied(h, run(root, ["hook", "pre", "--harness", h], "{"), "payload-unrecognized");
});

function crash(root: string, h: HarnessId) {
  const version = "9.9.8";
  const engine = join(data, "pregate", version, ENGINE_FILE);
  mkdirSync(join(data, "pregate", version), { recursive: true });
  writeFileSync(engine, "#!/bin/sh\nexit 1\n");
  chmodSync(engine, 0o755);
  return run(root, ["--supervise", join(data, "pregate"), version, "hook", "pre", "--harness", h], "{");
}
