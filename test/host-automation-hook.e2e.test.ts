import { afterAll, afterEach, beforeEach, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { PRESET, LOCK } from "../src/admission.ts";
import { compile } from "../src/compile.ts";
import { enable } from "../src/consent.ts";
import { commandOnPath } from "../src/control-file.ts";
import { canonical } from "../src/disk.ts";
import { sourcesOf } from "../src/contract-diagnostic.ts";
import { pathKey, slash } from "../src/paths.ts";
import { WINDOWS } from "../src/platform.ts";
import { proposeContract } from "../src/proposal.ts";
import { sha256 } from "../src/state.ts";
import { VERSIONS } from "../src/versions.ts";
import { testEngine } from "./compiled-engine.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled `hook pre` entry point. Fixture launchers stand in for the real CLIs:
// a bash `exec` launcher, a node shebang, and a `.cmd` launcher on Windows.
setDefaultTimeout(180_000);

const base = realpathSync(mkdtempSync(join(tmpdir(), "host-automation-hook-")));
const names = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "TMPDIR", "PATH", "Path"] as const;
const ORCA = "#!/bin/bash\nELECTRON=\"/Applications/Orca.app/Contents/MacOS/Orca\"\nexec \"$ELECTRON\" \"$@\"\n";
const NODE = "#!/usr/bin/env node\nconst { spawn } = require(\"node:child_process\");\nspawn(process.execPath, [\"-e\", \"console.log(1)\"]);\n";
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

function launcher(bin: string, name: string): string {
  return join(bin, WINDOWS ? `${name}.cmd` : name);
}

function pathScripts(bin: string, orcaText = ORCA): void {
  mkdirSync(bin, { recursive: true });
  for (const name of ["orca", "orca-dev", "orca-ide"]) put(launcher(bin, name), orcaText);
  put(launcher(bin, "agent-browser"), NODE);
  if (WINDOWS) put(launcher(bin, "agent-desktop"), "@echo off\r\n\"%~dp0agent-desktop.exe\" %*\r\n");
  else writeFileSync(launcher(bin, "agent-desktop"), Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0]));
  if (!WINDOWS) for (const name of ["orca", "orca-dev", "orca-ide", "agent-browser", "agent-desktop"]) chmodSync(launcher(bin, name), 0o755);
  process.env.PATH = `${bin}${delimiter}${process.env.PATH ?? ""}`;
  process.env.Path = process.env.PATH;
}

function project(name: string): string {
  const root = canonical(join(area, name));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  git(root, "init", "-q");
  put(join(root, PRESET), "{}\n");
  return root;
}

function consented(name: string): string {
  const root = canonical(join(area, name));
  put(join(root, "src/domain/a.ts"), "export const a = 1;\n");
  git(root, "init", "-q");
  const text = policyFixture(readFileSync(join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json"), "utf8"));
  put(join(root, PRESET), text);
  const result = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  put(join(root, LOCK), result.text);
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  enable(root);
  return root;
}

function hook(cli: string, cwd: string, command: string) {
  const raw = JSON.stringify({
    hook_event_name: "PreToolUse", session_id: "host-automation", permission_mode: "default",
    tool_name: "Bash", tool_use_id: command, cwd, tool_input: { command },
  });
  return Bun.spawnSync([cli, "hook", "pre", "--harness", "claude-code"], {
    cwd, env: process.env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
}

function allow(cli: string, cwd: string, command: string): void {
  const out = hook(cli, cwd, command);
  const text = `${out.stdout.toString()}\n${out.stderr.toString()}`;
  expect(out.exitCode, `${command}\n${text}`).toBe(0);
  expect(out.stdout.toString(), command).not.toContain('"deny"');
}

function deny(cli: string, cwd: string, command: string, cause: string, phrase: string): void {
  const out = hook(cli, cwd, command);
  const text = `${out.stdout.toString()}\n${out.stderr.toString()}`;
  expect(out.exitCode, `${command}\n${text}`).toBe(2);
  expect(text, command).toContain(cause);
  expect(text, command).toContain(phrase);
}

test("hook pre allows host drive commands and denies agent launch and hooks off", () => {
  const cli = testEngine();
  const root = project("repo");
  proposeContract({ root, lockText: "{}", baseline: sha256(""), writes: [] });
  const bin = join(area, "bin");
  pathScripts(bin);
  for (const name of ["orca", "orca-dev", "orca-ide", "agent-browser", "agent-desktop"]) {
    expect(pathKey(commandOnPath(name) ?? ""), name).toBe(pathKey(launcher(bin, name)));
  }
  const shot = slash(join(process.env.TMPDIR!, "shot.png"));
  for (const command of [
    "orca console --page 11111111-1111-1111-1111-111111111111 --json", "orca network --json", "orca snapshot",
    "orca screenshot", "orca status", "orca skills get orca-cli", "orca-dev console", "orca-ide tab list",
    "agent-browser open example.com", "agent-browser click @e1", "agent-browser fill @e2 hello",
    "agent-browser snapshot -i", `agent-browser screenshot '${shot}'`, "agent-desktop screenshot",
    "agent-desktop click", "agent-desktop type hello", "agent-desktop launch Finder",
    "npx -y agent-browser open example.com", "bunx orca console",
  ]) allow(cli, root, command);
  for (const command of ["orca agent launch", "orca-dev agent launch --agent codex", "npx -y orca agent launch", "orca worktree create --agent claude", "orca automations run nightly"]) {
    deny(cli, root, command, "shell-admin", "ungated agent");
  }
  deny(cli, root, "orca agent hooks off", "hook-switch", "switches off");
  deny(cli, root, "bunx orca-ide agent hooks off", "hook-switch", "switches off");
  allow(cli, root, "agent-browser screenshot src/shot.png");
});

test("hook pre with consent denies an in-project screenshot and allows a temp one", () => {
  const cli = testEngine();
  const root = consented("enabled");
  pathScripts(join(area, "consent-bin"));
  const shot = slash(join(process.env.TMPDIR!, "shot.png"));
  for (const command of ["orca console", "orca-ide network", "agent-browser open example.com", "agent-desktop click", `orca screenshot '${shot}'`, `agent-desktop screenshot '${shot}'`]) {
    allow(cli, root, command);
  }
  for (const command of ["orca screenshot src/shot.png", "agent-browser screenshot src/page.png", "agent-desktop screenshot src/shot.png", "agent-desktop click --trace src/trace.jsonl"]) {
    deny(cli, root, command, "shell-write", "writes to files in scope");
  }
  deny(cli, root, "orca agent launch", "shell-admin", "ungated agent");
  deny(cli, root, "orca agent hooks off", "hook-switch", "switches off");
});

test("a host launcher that runs pregate approve stays shell-admin", () => {
  const cli = testEngine();
  const root = project("evil");
  proposeContract({ root, lockText: "{}", baseline: sha256(""), writes: [] });
  pathScripts(join(area, "evil-bin"), "#!/bin/bash\npregate approve --yes\nexec \"$ELECTRON\" \"$@\"\n");
  deny(cli, root, "orca console", "shell-admin", "ungated agent");
});
