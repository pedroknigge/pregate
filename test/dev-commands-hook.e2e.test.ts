import { afterAll, afterEach, beforeEach, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { LOCK, PRESET } from "../src/admission.ts";
import { compile } from "../src/compile.ts";
import { enable } from "../src/consent.ts";
import { sourcesOf } from "../src/contract-diagnostic.ts";
import { canonical } from "../src/disk.ts";
import { slash } from "../src/paths.ts";
import { WINDOWS } from "../src/platform.ts";
import { VERSIONS } from "../src/versions.ts";
import { testEngine } from "./compiled-engine.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// Compiled hook, fixture home, global-style PATH shims. A directory that was never
// enabled allows development commands. The same commands inside an enabled project
// stay allowed, and a script or sed that edits gated source is still denied.
setDefaultTimeout(180_000);

const base = realpathSync(mkdtempSync(join(tmpdir(), "dev-commands-")));
const names = ["HOME", "USERPROFILE", "XDG_DATA_HOME", "XDG_STATE_HOME", "TMPDIR", "PATH", "Path"] as const;
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
  const bin = join(area, "bin");
  mkdirSync(bin, { recursive: true });
  const shim = "#!/usr/bin/env node\nrequire('fs').writeFileSync(process.argv[2] || 'out.txt', 'x');\n";
  for (const name of ["npm", "pnpm", "yarn"]) {
    const path = join(bin, WINDOWS ? `${name}.cmd` : name);
    writeFileSync(path, WINDOWS ? `@echo off\r\nnode -e "require('fs').writeFileSync('out.txt','x')"\r\n` : shim);
    if (!WINDOWS) chmodSync(path, 0o755);
  }
  process.env.PATH = `${bin}${delimiter}${process.env.PATH ?? ""}`;
  process.env.Path = process.env.PATH;
});

afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});
afterAll(() => removeTree(base));

function git(root: string, ...args: string[]): void {
  const r = Bun.spawnSync(["git", "-c", "user.name=Hook", "-c", "user.email=hook@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: root, env: process.env, stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
}

function consented(name: string): string {
  const root = canonical(join(area, name));
  mkdirSync(join(root, ".pregate"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/x.ts"), "export const x = 1;\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { test: "echo ok", dev: "echo ok", bad: "echo x > src/x.ts", x: "echo ok" } }) + "\n");
  git(root, "init", "-q");
  const text = policyFixture(readFileSync(join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json"), "utf8"));
  writeFileSync(join(root, PRESET), text);
  const result = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  writeFileSync(join(root, LOCK), result.text);
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  enable(root);
  return root;
}

interface HookExtra { session?: string; tool?: "Bash" | "Write"; input?: Record<string, string> }

function hook(cli: string, cwd: string, command: string, extra?: HookExtra) {
  const raw = JSON.stringify({
    hook_event_name: "PreToolUse", session_id: extra?.session ?? "dev-commands", permission_mode: "default",
    tool_name: extra?.tool ?? "Bash", tool_use_id: command, cwd,
    tool_input: extra?.input ?? { command },
  });
  return Bun.spawnSync([cli, "hook", "pre", "--harness", "claude-code"], {
    cwd, env: process.env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
}

function allows(cli: string, cwd: string, command: string, session?: string): void {
  const out = hook(cli, cwd, command, session === undefined ? undefined : { session });
  const text = `${out.stdout.toString()}\n${out.stderr.toString()}`;
  expect(out.exitCode, `${command}\n${text}`).toBe(0);
  expect(out.stdout.toString(), command).not.toContain('"deny"');
}

function denies(cli: string, cwd: string, command: string, cause: string, phrase: string): void {
  const out = hook(cli, cwd, command);
  const text = `${out.stdout.toString()}\n${out.stderr.toString()}`;
  expect(out.exitCode, `${command}\n${text}`).toBe(2);
  expect(text, command).toContain(cause);
  expect(text, command).toContain(phrase);
}

const DEV = [
  "npm view next version", "npm info next", "pnpm view next", "pnpm add next", "npm ci", "bun install", "yarn",
  "docker compose up -d", "docker build .", "git init", "next build", "tsc", "vitest run",
  "pnpm install", "pnpm test", "pnpm dev",
];

test("a brand-new directory and a fresh git repo that were never enabled allow development commands", () => {
  const cli = testEngine();
  const empty = canonical(join(area, "empty"));
  mkdirSync(empty, { recursive: true });
  const fresh = canonical(join(area, "fresh"));
  mkdirSync(fresh, { recursive: true });
  git(fresh, "init", "-q");
  const enabled = consented("enabled");
  const settings = slash(join(process.env.HOME!, ".claude/settings.json"));
  for (const cwd of [empty, fresh]) {
    for (const command of [...DEV, "git commit --no-verify"]) allows(cli, cwd, command);
    const edit = hook(cli, cwd, "write-source", { tool: "Write", input: { file_path: join(cwd, "src/app.ts"), content: "export const app = 1;\n" } });
    expect(edit.exitCode, edit.stderr.toString()).toBe(0);
    expect(edit.stdout.toString()).not.toContain('"deny"');
    const harness = hook(cli, cwd, "write-settings", { tool: "Write", input: { file_path: settings, content: "{}\n" } });
    expect(harness.exitCode, harness.stderr.toString()).toBe(0);
    expect(harness.stdout.toString()).not.toContain('"deny"');
    const status = Bun.spawnSync([cli, "status"], { cwd, env: process.env, stdout: "pipe", stderr: "pipe", timeout: 30_000 });
    expect(status.stdout.toString()).toContain("Nothing is enforced");
  }
  allows(cli, enabled, "ls", "shared");
  allows(cli, fresh, "npm view next version", "shared");
  allows(cli, fresh, "git commit --no-verify", "shared");
  const flipped = hook(cli, fresh, "write-settings-later", { session: "shared", tool: "Write", input: { file_path: settings, content: "{}\n" } });
  expect(flipped.exitCode, flipped.stderr.toString()).toBe(0);
  expect(flipped.stdout.toString()).not.toContain('"deny"');
});

test("an enabled project allows development commands and still denies source edits from the shell", () => {
  const cli = testEngine();
  const root = consented("gated");
  for (const command of DEV) allows(cli, root, command);
  denies(cli, root, "git commit --no-verify", "shell-admin", "skips git hooks");
  denies(cli, root, "pnpm exec sed -i 's/a/b/' src/x.ts", "shell-write", "src/x.ts");
  denies(cli, root, "pnpm run bad", "shell-write", "src/x.ts");
  denies(cli, root, "npm run x -- --no-verify", "shell-admin", "skips git hooks");
  denies(cli, root, "npm publish", "shell-write", "publish");
  const settings = slash(join(process.env.HOME!, ".claude/settings.json"));
  const harness = hook(cli, root, "write-settings", { tool: "Write", input: { file_path: settings, content: "{}\n" } });
  const text = `${harness.stdout.toString()}\n${harness.stderr.toString()}`;
  expect(harness.exitCode, text).toBe(2);
  expect(text).toContain("protected-path");
});
