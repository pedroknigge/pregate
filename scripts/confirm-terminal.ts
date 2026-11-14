import { spawnSync } from "node:child_process";

// Drive a human-only pregate command the way a person at the keyboard does: stdin is a
// pseudo-terminal, and this process types the answer on that terminal's /dev/tty.
// `CI`, `PREGATE_UNATTENDED_APPROVAL`, `PREGATE_TESTING` and `PREGATE_TEST_ANSWER` are removed first.
// Another command's `--yes` then still needs this typed y. `pregate approve <code>` and
// `pregate approve --yes` apply without a prompt, so this helper is the wrong check for those
// forms. This is not a product flag and it is not available to an agent running the installed CLI.
const PYTHON = `
import os, pty, select, sys, time
answer = os.environ.pop("PREGATE_PTY_ANSWER").encode() + b"\\n"
cwd = os.environ.pop("PREGATE_PTY_CWD")
for key in ("CI", "PREGATE_UNATTENDED_APPROVAL", "PREGATE_TESTING", "PREGATE_TEST_ANSWER"):
    os.environ.pop(key, None)
cmd = sys.argv[1:]
pid, fd = pty.fork()
if pid == 0:
    os.chdir(cwd)
    os.execvpe(cmd[0], cmd, os.environ)
buf = b""
sent = False
status = None
start = time.time()
while time.time() - start < 45:
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
            os.write(fd, answer)
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
code = os.waitstatus_to_exitcode(status)
if not sent:
    sys.stderr.buffer.write(b"human confirmation prompt did not appear\\n")
    if code == 0:
        code = 2
raise SystemExit(code)
`;

export interface Confirmed { code: number; stdout: string; stderr: string }

export function confirmOnTerminal(cmd: string[], cwd: string, env: Record<string, string | undefined>, answer = "y"): Confirmed {
  if (process.platform === "win32") {
    throw new Error("confirmOnTerminal needs a POSIX pseudo-terminal. Windows has no /dev/tty for this helper.");
  }
  const python = Bun.which("python3");
  if (python === null) throw new Error("python3 is required to type a human confirmation on a pseudo-terminal.");
  const child: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || key === "CI" || key === "PREGATE_UNATTENDED_APPROVAL" || key === "PREGATE_TESTING" || key === "PREGATE_TEST_ANSWER") continue;
    child[key] = value;
  }
  child.PREGATE_PTY_ANSWER = answer;
  child.PREGATE_PTY_CWD = cwd;
  const result = spawnSync(python, ["-c", PYTHON, ...cmd], { cwd, env: child, encoding: "utf8", timeout: 60_000 });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? result.error.message : ""}`,
  };
}
