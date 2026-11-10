import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { WINDOWS } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled binary, on a real project: no .git, .git removed after a session started, and git
// missing from PATH. Each denies, and the text names that failure.

setDefaultTimeout(120_000);

const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-git-halt-")));
const BIN = join(TMP, WINDOWS ? "bin/pregate.exe" : "bin/pregate");
const HOME = join(TMP, "home");
const DATA = join(TMP, "data");

type Env = Record<string, string>;
interface Out { code: number; stdout: string; stderr: string }

beforeAll(() => {
  mkdirSync(HOME, { recursive: true });
  mkdirSync(join(TMP, "tmp"), { recursive: true });
  engineAt(BIN, true);
});

afterAll(() => removeTree(TMP));

let states = 0;
function envOf(path = process.env.PATH ?? ""): Env {
  return {
    CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PATH: path, HOME, TMPDIR: join(TMP, "tmp"),
    XDG_DATA_HOME: DATA, XDG_STATE_HOME: join(TMP, "state", String(++states)),
    CODEX_HOME: join(HOME, ".codex"), GROK_HOME: join(HOME, ".grok"),
    GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  };
}

function run(cmd: string[], cwd: string, env: Env, stdin = ""): Out {
  const result = Bun.spawnSync(cmd, { cwd, env, stdin: new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
  return { code: result.exitCode ?? -1, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function ok(out: Out, what: string): Out {
  if (out.code !== 0) throw new Error(`${what} exited ${out.code}\n${out.stdout}\n${out.stderr}`);
  return out;
}

function git(cwd: string, env: Env, ...args: string[]): void {
  ok(run(["git", "-c", "user.name=e2e", "-c", "user.email=e2e@example.com", "-c", "commit.gpgsign=false", ...args], cwd, env), args.join(" "));
}

function project(path?: string): { dir: string; env: Env } {
  const dir = join(TMP, "projects", randomUUID());
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "src.ts"), "export const value = 1;\n");
  const env = envOf(path);
  return { dir, env };
}

function payload(dir: string, event: "PreToolUse" | "SessionStart", content?: string): string {
  return JSON.stringify({
    session_id: randomUUID(), cwd: dir, hook_event_name: event,
    ...(event === "SessionStart" ? { source: "startup" } : {
      permission_mode: "acceptEdits",
      tool_name: "Write", tool_use_id: `toolu_${randomUUID()}`,
      tool_input: { file_path: join(dir, "src.ts"), content: content ?? "export const value = 2;\n" },
    }),
  }) + "\n";
}

function hook(dir: string, env: Env, event: "PreToolUse" | "SessionStart", content?: string): Out {
  return run([BIN, "hook", event === "SessionStart" ? "session-start" : "pre", "--harness", "claude-code"], dir, env, payload(dir, event, content));
}

function init(dir: string, env: Env): void {
  ok(run([BIN, "init", "--yes", "--preset", "integrity-only"], dir, env), "init");
}

function denied(out: Out, cause: string, fix: string): void {
  const text = out.stdout + out.stderr;
  expect(out.code, text).toBe(2);
  const parsed = JSON.parse(out.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
  expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain(cause);
  expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain(fix);
}

test("a project directory without .git is denied", () => {
  const { dir, env } = project();
  init(dir, env);
  expect(readFileSync(join(dir, ".pregate/preset.json"), "utf8")).toContain("integrity-only");
  denied(hook(dir, env, "PreToolUse"), "git-not-repository", "git init");
});

test(".git removed after the session started is denied", () => {
  const { dir, env } = project();
  git(dir, env, "init", "-q");
  git(dir, env, "add", "src.ts");
  git(dir, env, "commit", "-qm", "init");
  init(dir, env);
  const started = hook(dir, env, "SessionStart");
  expect(started.code, started.stdout + started.stderr).toBe(0);
  rmSync(join(dir, ".git"), { recursive: true, force: true });
  const out = hook(dir, env, "PreToolUse");
  denied(out, "git-not-repository", "restore the removed .git");
  expect(out.stdout).not.toContain("git-missing");
});

test("git missing from PATH is denied", () => {
  const empty = join(TMP, "no-git");
  mkdirSync(empty, { recursive: true });
  const path = WINDOWS && process.env.SystemRoot ? [empty, join(process.env.SystemRoot, "System32")].join(delimiter) : empty;
  const { dir, env } = project(path);
  git(dir, envOf(), "init", "-q");
  git(dir, envOf(), "add", "src.ts");
  git(dir, envOf(), "commit", "-qm", "init");
  init(dir, envOf());
  const out = hook(dir, env, "PreToolUse");
  denied(out, "git-missing", "install Git");
  expect(out.stdout).not.toContain("git-not-repository");
});

test("a git command error is denied", () => {
  const bin = join(TMP, "fake-git");
  mkdirSync(bin, { recursive: true });
  const gitBin = join(bin, WINDOWS ? "git.cmd" : "git");
  writeFileSync(gitBin, WINDOWS
    ? "@echo off\r\necho fatal: unable to read config file 1>&2\r\nexit /b 1\r\n"
    : "#!/bin/sh\necho 'fatal: unable to read config file' >&2\nexit 1\n");
  if (!WINDOWS) chmodSync(gitBin, 0o755);
  const path = WINDOWS && process.env.SystemRoot ? [bin, join(process.env.SystemRoot, "System32")].join(delimiter) : bin;
  const { dir, env } = project(path);
  git(dir, envOf(), "init", "-q");
  git(dir, envOf(), "add", "src.ts");
  git(dir, envOf(), "commit", "-qm", "init");
  init(dir, envOf());
  const out = hook(dir, env, "PreToolUse");
  denied(out, "git-error", "pregate disable");
  expect(out.stdout).not.toContain("git-missing");
  expect(out.stdout).not.toContain("git-not-repository");
});
