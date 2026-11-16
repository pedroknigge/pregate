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

// The compiled `hook pre` entry point. A pending review or a pending batch does not
// enforce a project that was never enabled: the hook exits 0.
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

function allows(cli: string, root: string, command: string): void {
  const out = hook(cli, root, command);
  const text = `${out.stdout.toString()}\n${out.stderr.toString()}`;
  expect(out.exitCode, `${command}\n${text}`).toBe(0);
  expect(out.stdout.toString(), command).not.toContain('"deny"');
}

test("hook pre allows a project write when a review is pending and the project was never enabled", () => {
  const cli = testEngine();
  const root = project("repo", true);
  proposeContract({ root, lockText: "{}", baseline: sha256(""), writes: [] });
  pathScripts(join(area, "bin"));
  expect(commandOnPath("orca")?.replaceAll("\\", "/")).toContain("/bin/orca");
  const skill = slash(join(process.env.HOME!, ".agents/skills/pregate/SKILL.md"));
  put(skill, "# pregate\n");
  for (const command of ["orca console", "orca network", "agent-browser open", `cat -- '${skill}'`, "node scripts/write.js", "git commit --no-verify"]) {
    allows(cli, root, command);
  }
});

test("hook pre allows a project write when only a batch is pending", () => {
  const cli = testEngine();
  const root = project("batched", true);
  proposeBatch([{ root, digest: "a".repeat(64) }]);
  pathScripts(join(area, "batch-bin"));
  allows(cli, root, "orca console");
  allows(cli, root, "node scripts/write.js");
});

test("hook pre allows pregate uninstall when the repository was never enabled", () => {
  const cli = testEngine();
  const root = project("nopreset", false);
  proposeContract({ root, lockText: "{}", baseline: sha256(""), writes: [] });
  allows(cli, root, "pregate uninstall");
  allows(cli, root, "node scripts/write.js");
});
