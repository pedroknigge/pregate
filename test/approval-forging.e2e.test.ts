import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { engineAt } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Issue 105, through the compiled `pregate hook pre` entry. Setting an approval-forging variable
// on a command is denied as `approval`. A command that really switches hooks off stays `hook-switch`.
// The process environment already has PREGATE_UNATTENDED_APPROVAL so `init --yes` can run. That
// must not deny an ordinary command: the guard reads the command text, not the hook's own environment.

setDefaultTimeout(300_000);

const area = canonical(realpathSync(mkdtempSync(join(tmpdir(), "pregate-approval-forge-"))));
const home = join(area, "home");
const repo = join(area, "repo");
const binary = join(area, "opt/engine", ENGINE_FILE);
const spell = (p: string): string => p.replaceAll("\\", "/");
const session = "01a00000-0000-7000-8000-000000000105";

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
  engineAt(binary, false);
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

const approval = [
  "PREGATE_UNATTENDED_APPROVAL=1 pregate disable --yes",
  "sh -c 'PREGATE_UNATTENDED_APPROVAL=1 pregate disable --yes'",
  "env PREGATE_UNATTENDED_APPROVAL=1 pregate disable --yes",
  "env PREGATE_UNATTENDED_APPROVAL=1 sh -c 'pregate disable --yes'",
  "$env:PREGATE_UNATTENDED_APPROVAL='1'; pregate disable --yes",
  "PREGATE_TESTING=1 PREGATE_TEST_ANSWER=y pregate approve --yes",
  "export PREGATE_ACCEPT_CONTRACT=abc",
  "env -u PREGATE_UNATTENDED_APPROVAL echo ok",
  "set PREGATE_UNATTENDED_APPROVAL=1 & pregate disable --yes",
  "PREGATE_UNATTENDED_APPROVAL=1 pregate uninstall",
  "export PREGATE_UNATTENDED_APPROVAL=1; pregate uninstall",
];

const hookSwitch = [
  "PREGATE_PROJECT_HOOK=1 pregate status",
  "env -i pregate status",
  "env -u PREGATE_PROJECT_HOOK pregate status",
  "env -u HOME echo ok",
  "GROK_CLAUDE_HOOKS_ENABLED=0 grok -p x",
];

test("the codex pre hook denies approval forging and keeps a real hook switch", () => {
  for (const command of ["pregate status", "echo ok", "pregate uninstall"]) {
    const allowed = hook(command);
    expect(allowed.code, `${command}\n${allowed.text}`).toBe(0);
    expect(allowed.text, command).not.toContain("PREGATE DENY");
  }
  for (const command of approval) {
    const denied = hook(command);
    const shown = command.replace(/\s+/g, " ").trim();
    expect(denied.code, `${command}\n${denied.text}`).toBe(2);
    expect(denied.stderr, command).toContain("PREGATE DENY approval");
    expect(denied.stderr, command).toContain("cannot grant itself approval");
    expect(denied.stderr, command).toContain("separate terminal");
    expect(denied.stderr, command).toContain(shown);
    expect(denied.stderr, command).not.toContain("rule adaptation");
    expect(denied.stderr, command).not.toContain("propose a bounded rule/pack change");
  }
  for (const command of hookSwitch) {
    const denied = hook(command);
    expect(denied.code, `${command}\n${denied.text}`).toBe(2);
    expect(denied.stderr, command).toContain("PREGATE DENY hook-switch");
    expect(denied.stderr, command).not.toContain("PREGATE DENY approval");
  }
});
