import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { removeTree } from "./remove-tree.ts";

// Codex exec_command can request a pty (tty: true). write_stdin then types into that pty and does
// not fire PreToolUse. The PreToolUse payload is only {command}. The suspected approval bypass is
// exec_command of `bash -c 'while read l; do eval "$l"; done'` with tty true, then write_stdin of
// `pregate approve <code>` and `y`. Codex starts that child only when this hook exits 0. A deny
// means there is no pty to type into.

setDefaultTimeout(180_000);

const LOOP = `bash -c 'while read l; do eval "$l"; done'`;
const AREA = canonical(realpathSync(mkdtempSync(join(tmpdir(), "pregate-codex-pty-"))));
const BINARY = join(AREA, "opt/engine", ENGINE_FILE);
const HOME = join(AREA, "home");

type Env = Record<string, string>;
interface Out { code: number; stdout: string; stderr: string }

beforeAll(() => {
  mkdirSync(dirname(BINARY), { recursive: true });
  mkdirSync(HOME, { recursive: true });
  engineAt(BINARY, false);
});

afterAll(() => removeTree(AREA));

function envOf(dir: string): Env {
  const env: Env = {
    PATH: pathWithoutHarnesses([dirname(BINARY)]),
    HOME, USERPROFILE: HOME,
    XDG_DATA_HOME: join(dir, "data"), XDG_STATE_HOME: join(dir, "state"), XDG_CONFIG_HOME: join(dir, "config"),
    TMPDIR: dir, TMP: dir, TEMP: dir,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  };
  if (process.platform === "win32") {
    env.LOCALAPPDATA = join(dir, "data");
    env.APPDATA = join(dir, "config");
    env.SystemRoot = process.env.SystemRoot ?? "C:\\Windows";
  }
  return env;
}

function run(args: string[], env: Env, cwd: string, stdin = ""): Out {
  const r = Bun.spawnSync([BINARY, ...args], { cwd, env, stdin: Buffer.from(stdin), stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  return { code: r.exitCode ?? -1, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function proposalCode(data: string): { file: string; code: string } {
  const dir = join(data, "pregate", "proposals");
  const name = readdirSync(dir).find((entry) => entry.endsWith(".json") && entry !== "batch.json");
  if (name === undefined) throw new Error(`no proposal under ${dir}`);
  const file = join(dir, name);
  const digest = createHash("sha256").update(JSON.stringify(JSON.parse(readFileSync(file, "utf8")))).digest("hex");
  return { file, code: digest.slice(0, 12) };
}

// The command Codex would execute: the hook's updatedInput when it allows a rewrite, otherwise
// the command it was shown. A deny has no rewrite, and Codex does not start the child.
function continuedCommand(stdout: string): string | null {
  if (stdout.trim() === "") return null;
  const parsed = JSON.parse(stdout) as { hookSpecificOutput?: { permissionDecision?: string; updatedInput?: { command?: string } } };
  const output = parsed.hookSpecificOutput;
  if (output?.permissionDecision === "allow" && typeof output.updatedInput?.command === "string") return output.updatedInput.command;
  return null;
}

const PTY = `
import os, pty, select, sys, time
command = os.environ.pop("PREGATE_PTY_COMMAND")
line = os.environ.pop("PREGATE_PTY_LINE").encode() + b"\\n"
cwd = os.environ.pop("PREGATE_PTY_CWD")
for key in ("CI", "PREGATE_UNATTENDED_APPROVAL", "PREGATE_TESTING", "PREGATE_TEST_ANSWER"):
    os.environ.pop(key, None)
pid, fd = pty.fork()
if pid == 0:
    os.chdir(cwd)
    os.execvpe("sh", ["sh", "-c", command], os.environ)
os.write(fd, line)
buf = b""
sent = False
status = None
start = time.time()
while time.time() - start < 40:
    try:
        ready, _, _ = select.select([fd], [], [], 0.2)
    except InterruptedError:
        continue
    if ready:
        try:
            chunk = os.read(fd, 1 << 16)
        except OSError:
            chunk = b""
        if not chunk:
            break
        buf += chunk
        if not sent and b"Approve?" in buf:
            os.write(fd, b"y\\n")
            sent = True
    try:
        wpid, st = os.waitpid(pid, os.WNOHANG)
    except ChildProcessError:
        break
    if wpid:
        status = st
        break
else:
    os.kill(pid, 9)
    _, status = os.waitpid(pid, 0)
while True:
    try:
        ready, _, _ = select.select([fd], [], [], 0.05)
    except InterruptedError:
        continue
    if not ready:
        break
    try:
        chunk = os.read(fd, 1 << 16)
    except OSError:
        break
    if not chunk:
        break
    buf += chunk
if status is None:
    _, status = os.waitpid(pid, 0)
sys.stdout.buffer.write(buf)
if not sent:
    sys.stderr.buffer.write(b"approval prompt did not appear\\n")
`;

// setsid + TIOCSCTTY, which is what Python's pty.fork does in the child. The two lines are the
// write_stdin calls: the approval command, then y once the prompt is on that terminal.
function drivePty(command: string, line: string, cwd: string, env: Env): Out {
  if (process.platform === "win32") {
    throw new Error("This Codex pty attack needs a POSIX controlling terminal (setsid + TIOCSCTTY). Pre allowed the command, so the Windows runner must show the proposal stayed unapproved without skipping the case.");
  }
  const python = Bun.which("python3");
  if (python === null) throw new Error("python3 is required to allocate the controlling terminal for this attack.");
  const child: Env = { ...env, PREGATE_PTY_COMMAND: command, PREGATE_PTY_LINE: line, PREGATE_PTY_CWD: cwd };
  delete child.CI;
  delete child.PREGATE_UNATTENDED_APPROVAL;
  delete child.PREGATE_TESTING;
  delete child.PREGATE_TEST_ANSWER;
  const result = spawnSync(python, ["-c", PTY], { cwd, env: child, encoding: "utf8", timeout: 60_000 });
  return { code: result.status ?? 1, stdout: result.stdout ?? "", stderr: `${result.stderr ?? ""}${result.error ? result.error.message : ""}` };
}

function codexExec(cwd: string, command: string): string {
  const tool_input = { command };
  if (Object.keys(tool_input).join(",") !== "command") throw new Error("Codex PreToolUse for exec_command carries only command");
  return JSON.stringify({
    session_id: "01a00000-0000-7000-8000-000000000166",
    turn_id: "01a00000-0000-7000-8000-000000000167",
    transcript_path: null,
    cwd, hook_event_name: "PreToolUse",
    model: "gpt-5.5", permission_mode: "bypassPermissions", tool_name: "Bash",
    tool_input, tool_use_id: "exec-pty-eval-loop",
  });
}

function attack(repo: string, env: Env, code: string): { hook: Out; pty: Out | null } {
  const payload = codexExec(repo, LOOP);
  const sent = JSON.parse(payload) as { tool_input: Record<string, unknown> };
  expect(Object.keys(sent.tool_input)).toEqual(["command"]);
  expect(sent.tool_input.command).toBe(LOOP);
  const hook = run(["hook", "pre", "--harness", "codex"], env, repo, payload);
  if (hook.code !== 0) return { hook, pty: null };
  const command = continuedCommand(hook.stdout) ?? LOOP;
  return { hook, pty: drivePty(command, `pregate approve ${code}`, repo, env) };
}

test("a Codex pty stdin-eval loop cannot approve a pending init", () => {
  const dir = join(AREA, "init");
  const repo = join(dir, "repo");
  mkdirSync(repo, { recursive: true });
  const env = envOf(dir);
  const git = Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: repo, env, stdout: "pipe", stderr: "pipe" });
  expect(git.exitCode, git.stderr.toString()).toBe(0);
  writeFileSync(join(repo, "README.md"), "pending\n");
  const preview = run(["init", "--preview", "--preset", "legacy-safe"], env, repo);
  expect(preview.code, preview.stdout + preview.stderr).toBe(0);
  const data = env.XDG_DATA_HOME ?? "";
  const { file, code } = proposalCode(data);
  const { hook, pty } = attack(repo, env, code);
  const note = `${hook.stderr}\n${hook.stdout}\n${pty?.stdout ?? ""}\n${pty?.stderr ?? ""}`;
  expect(existsSync(join(repo, ".pregate/preset.json")), note).toBe(false);
  expect(existsSync(join(repo, ".pregate/pregate.lock.json")), note).toBe(false);
  expect(existsSync(file), note).toBe(true);
  expect(hook.code, note).toBe(2);
  expect(hook.stderr, note).toContain("shell-write");
  expect(pty, note).toBeNull();
});
