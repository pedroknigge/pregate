import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { engineAt } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Issue 114, through the compiled `pregate hook pre` entry: a read-only `git config` query is
// allowed. Setting core.hooksPath, including `-c core.hooksPath=` on another git command, stays denied.

setDefaultTimeout(300_000);

const area = canonical(realpathSync(mkdtempSync(join(tmpdir(), "pregate-git-config-"))));
const home = join(area, "home");
const repo = join(area, "repo");
const binary = join(area, "opt/engine", ENGINE_FILE);
const spell = (p: string): string => p.replaceAll("\\", "/");
const session = "01a00000-0000-7000-8000-000000000114";

const env: Record<string, string> = {
  CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PATH: process.env.PATH ?? "",
  HOME: home, USERPROFILE: home,
  TMPDIR: join(area, "tmp"), TMP: join(area, "tmp"), TEMP: join(area, "tmp"),
  XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
  LOCALAPPDATA: join(area, "data"), APPDATA: join(area, "config"),
  CODEX_HOME: join(home, ".codex"), GROK_HOME: join(home, ".grok"),
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(area, "gitconfig"),
  ...(WINDOWS && process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
};

interface Out { code: number; stdout: string; stderr: string; text: string }

function run(args: string[], raw = "", cwd = repo): Out {
  const r = Bun.spawnSync([binary, ...args], {
    cwd, env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  const stdout = r.stdout.toString(), stderr = r.stderr.toString();
  return { code: r.exitCode ?? -1, stdout, stderr, text: stdout + stderr };
}

function git(...args: string[]): void {
  const r = Bun.spawnSync(["git", ...args], { cwd: repo, env, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}\n${r.stderr.toString()}`);
}

let calls = 0;
function hook(command: string): Out {
  const raw = JSON.stringify({
    session_id: session, turn_id: session, cwd: spell(repo), hook_event_name: "PreToolUse",
    model: "gpt-5.5", permission_mode: "bypassPermissions", tool_name: "Bash",
    tool_input: { command }, tool_use_id: `call_${++calls}`,
  });
  return run(["hook", "pre", "--harness", "codex"], raw);
}

beforeAll(() => {
  mkdirSync(join(area, "opt/engine"), { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(join(area, "tmp"), { recursive: true });
  mkdirSync(repo, { recursive: true });
  writeFileSync(join(area, "gitconfig"), "[user]\n\temail = e2e@example.com\n\tname = e2e\n[commit]\n\tgpgsign = false\n");
  engineAt(binary, true);
  git("init", "-q");
  git("config", "maintenance.auto", "false");
  git("config", "gc.auto", "0");
  git("config", "core.autocrlf", "false");
  writeFileSync(join(repo, "src.ts"), "export const value = 1;\n");
  git("add", "src.ts");
  git("commit", "-qm", "init");
  const ready = run(["init", "--yes", "--preset", "integrity-only"]);
  if (ready.code !== 0) throw new Error(ready.text);
  const started = run(["hook", "session-start", "--harness", "codex"], JSON.stringify({
    session_id: session, cwd: spell(repo), hook_event_name: "SessionStart",
    model: "gpt-5.5", permission_mode: "bypassPermissions", source: "startup",
  }));
  if (started.code !== 0) throw new Error(started.text);
});

afterAll(() => removeTree(area));

const reads = [
  "git config --get core.hooksPath",
  "git config --get-all core.hooksPath",
  "git config --list",
  "git config -l",
  "git config --show-origin --get core.hooksPath",
  "git config --show-origin core.hooksPath",
  "git config --get-regexp core.hooksPath",
  "git config --global --get core.hooksPath",
  "git config --system --get core.hooksPath",
  "git config core.hooksPath",
  "git -c advice.detachedHead=false config --get core.hooksPath",
  "sh -c 'git config --get core.hooksPath'",
  "git status --short && git branch --show-current && git config user.email && git config --get core.hooksPath && git fetch origin dev",
];

const writes: [string, string][] = [
  ["git config core.hooksPath /dev/null", "shell-admin"],
  ["git config --unset core.hooksPath", "shell-admin"],
  ["git config --unset-all core.hooksPath", "shell-admin"],
  ["git config --add core.hooksPath /dev/null", "shell-admin"],
  ["git config --replace-all core.hooksPath /dev/null", "shell-admin"],
  ["git config --replace-al core.hooksPath /dev/null", "shell-admin"],
  ["git config --global core.hooksPath /dev/null", "shell-admin"],
  ["git config --system core.hooksPath /dev/null", "shell-admin"],
  ["git config --no-get core.hooksPath /dev/null", "shell-admin"],
  ["git config core.hooksPath --get", "shell-admin"],
  ["git -c core.hooksPath=/dev/null commit -m x", "shell-admin"],
  ["git -c core.hooksPath=/dev/null status", "shell-admin"],
  ["git -c core.hooksPath=/dev/null config --get user.email", "shell-admin"],
  ["git config --get core.hooksPath && git config core.hooksPath /dev/null", "shell-admin"],
  ["sh -c 'git config core.hooksPath /dev/null'", "shell-admin"],
  ["git commit --no-verify -m x", "shell-admin"],
  ["git config --file .git/config core.hooksPath /dev/null", "protected-path"],
  ["git config --file .git/config --get core.hooksPath", "protected-path"],
];

test("the codex pre hook allows read-only git config queries", () => {
  for (const command of reads) {
    const out = hook(command);
    expect({ command, code: out.code, stderr: out.stderr, deny: out.text.includes("PREGATE DENY") }).toEqual({
      command, code: 0, stderr: "", deny: false,
    });
  }
});

test("the codex pre hook still denies git config writes", () => {
  for (const [command, cause] of writes) {
    const out = hook(command);
    expect(out.code, `${command}\n${out.text}`).toBe(2);
    expect(out.stderr, command).toContain(`PREGATE DENY ${cause}`);
  }
});
