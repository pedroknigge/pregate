import { afterAll, afterEach, beforeEach, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { canonical } from "../src/disk.ts";
import { PRESET } from "../src/admission.ts";
import { commandOnPath } from "../src/control-file.ts";
import { proposeBatch, proposeContract } from "../src/proposal.ts";
import { WINDOWS } from "../src/platform.ts";
import { slash } from "../src/paths.ts";
import { sha256 } from "../src/state.ts";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled `hook pre` entry point, with consent inactive. A pending review or a pending batch
// is what makes the guard run; a directory with neither stays inert.
setDefaultTimeout(180_000);

const base = realpathSync(mkdtempSync(join(tmpdir(), "inactive-hook-")));
const names = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "TMPDIR", "PATH", "Path"] as const;
let saved: Record<string, string | undefined>;
let area: string;
let run = 0;

beforeEach(() => {
  saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  area = join(base, String(++run));
  for (const [name, folder] of Object.entries({ HOME: "home", XDG_DATA_HOME: "data", XDG_STATE_HOME: "state", TMPDIR: "tmp" })) {
    const dir = join(area, folder);
    mkdirSync(dir, { recursive: true });
    process.env[name] = dir;
  }
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
  const r = Bun.spawnSync(["git", "-c", "user.name=Hook", "-c", "user.email=hook@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: root, env: process.env, stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
}

function pathScripts(bin: string): void {
  const orcaName = WINDOWS ? "orca.cmd" : "orca";
  const browserName = WINDOWS ? "agent-browser.cmd" : "agent-browser";
  put(join(bin, orcaName), "#!/bin/bash\nELECTRON=\"/Applications/Orca.app/Contents/MacOS/Orca\"\nexec \"$ELECTRON\" \"$@\"\n");
  put(join(bin, browserName), "#!/usr/bin/env node\nconst { spawn } = require(\"node:child_process\");\nspawn(process.execPath, [\"-e\", \"console.log(1)\"]);\n");
  if (!WINDOWS) {
    chmodSync(join(bin, orcaName), 0o755);
    chmodSync(join(bin, browserName), 0o755);
  }
  process.env.PATH = `${bin}${delimiter}${process.env.PATH ?? ""}`;
  process.env.Path = process.env.PATH;
}

function project(name: string, preset: boolean): string {
  const root = canonical(join(area, name));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  put(join(root, "scripts/write.js"), "const fs = require(\"node:fs\");\nfs.writeFileSync(\"out.txt\", \"x\\n\");\n");
  git(root, "init", "-q");
  if (preset) put(join(root, PRESET), "{}\n");
  return root;
}

function hook(cli: string, cwd: string, command: string) {
  const raw = JSON.stringify({
    hook_event_name: "PreToolUse", session_id: "inactive-consent", permission_mode: "default",
    tool_name: "Bash", tool_use_id: command, cwd, tool_input: { command },
  });
  return Bun.spawnSync([cli, "hook", "pre", "--harness", "claude-code"], {
    cwd, env: process.env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
}

test("hook pre allows installed PATH scripts and a skill read, denies a project write sink, and issue draft --last finds it", () => {
  const cli = testEngine();
  const root = project("repo", true);
  proposeContract({ root, lockText: "{}", baseline: sha256(""), writes: [] });
  pathScripts(join(area, "bin"));
  expect(commandOnPath("orca")?.replaceAll("\\", "/")).toContain("/bin/orca");
  expect(commandOnPath("agent-browser")?.replaceAll("\\", "/")).toContain("/bin/agent-browser");
  const skill = slash(join(process.env.HOME!, ".agents/skills/pregate/SKILL.md"));
  put(skill, "# pregate\n");
  for (const command of ["orca console", "orca network", "agent-browser open", `cat -- '${skill}'`]) {
    const out = hook(cli, root, command);
    expect(out.exitCode, `${command}\n${out.stderr.toString()}`).toBe(0);
    expect(out.stdout.toString(), command).not.toContain('"deny"');
  }
  const denied = hook(cli, root, "node scripts/write.js");
  expect(denied.exitCode, denied.stdout.toString()).toBe(2);
  expect(denied.stderr.toString()).toContain("shell-write");
  expect(denied.stderr.toString()).toContain("`pregate issue draft --last`");
  const draft = Bun.spawnSync([cli, "issue", "draft", "--last"], { cwd: root, env: process.env, stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  const text = `${draft.stdout.toString()}\n${draft.stderr.toString()}`;
  expect(draft.exitCode, text).toBe(0);
  expect(text).toContain("shell-write");
  expect(text).not.toContain("No finding recorded");
});

test("hook pre with only a pending batch denies a project write sink and allows an installed launcher", () => {
  const cli = testEngine();
  const root = project("batched", true);
  proposeBatch([{ root, digest: "a".repeat(64) }]);
  pathScripts(join(area, "batch-bin"));
  const allowed = hook(cli, root, "orca console");
  expect(allowed.exitCode, allowed.stderr.toString()).toBe(0);
  expect(allowed.stdout.toString()).not.toContain('"deny"');
  const denied = hook(cli, root, "node scripts/write.js");
  expect(denied.exitCode, denied.stdout.toString()).toBe(2);
  expect(denied.stderr.toString()).toContain("shell-write");
  const draft = Bun.spawnSync([cli, "issue", "draft", "--last"], { cwd: root, env: process.env, stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  expect(draft.exitCode, draft.stderr.toString()).toBe(0);
  expect(draft.stdout.toString()).toContain("shell-write");
});

test("hook pre with no preset does not tell the agent to run issue draft --last", () => {
  const cli = testEngine();
  const root = project("nopreset", false);
  proposeContract({ root, lockText: "{}", baseline: sha256(""), writes: [] });
  const denied = hook(cli, root, "node scripts/write.js");
  expect(denied.exitCode, denied.stdout.toString()).toBe(2);
  expect(denied.stderr.toString()).toContain("shell-write");
  expect(denied.stderr.toString()).not.toContain("issue draft --last");
  expect(denied.stderr.toString()).toContain("no preset");
  const draft = Bun.spawnSync([cli, "issue", "draft", "--last"], { cwd: root, env: process.env, stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  expect(draft.exitCode).toBe(1);
  expect(draft.stdout.toString()).toContain("needs a PREGATE preset");
});
