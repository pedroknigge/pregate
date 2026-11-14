import { existsSync, mkdirSync, openSync, read, readFileSync, rmSync, closeSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeAll } from "./write-all.ts";
import { approvalText } from "./contract.ts";
import { dataHome, enable } from "./consent.ts";
import { writeAtomic } from "./disk.ts";
import { recordApproval, type ApprovalVia } from "./loosening.ts";
import { H, sha256 } from "./state.ts";
import { WINDOWS } from "./platform.ts";

export const APPROVAL_MS = 90_000;
// Loaded on first use: these builtins take milliseconds to initialize, and every hook would pay it.
const terminalIo = () => require("node:tty") as typeof import("node:tty");
export { PENDING_MS, proposeContract, readProposal, discardProposal, type Proposal } from "./proposal.ts";
declare const PREGATE_TEST_BUILD: boolean;
const TEST_BUILD = typeof PREGATE_TEST_BUILD !== "undefined" && PREGATE_TEST_BUILD;

// A machine with nobody at the keyboard (a CI job, this repository's tests) opts in to approval
// without a terminal with PREGATE_UNATTENDED_APPROVAL=1 in its own environment. `CI` is not that
// opt-in: tools and harness sessions set it. The shell guard denies a command that assigns any
// PREGATE_ variable and the control scan flags a script that does; a job that also runs an agent
// must not set it.
export function unattendedApproval(): boolean {
  return process.env.PREGATE_UNATTENDED_APPROVAL === "1";
}

// The approval code stays off a non-terminal stdout, which is what an agent tool captures.
// That is not what stops the agent: `pregate approve --yes` names no code, and a code the human
// already has works in the harness shell. A non-terminal approval is written to the approval log.
// `PREGATE_TESTING=1` is the test hook; the shell guard rejects an agent setting it.
export function approvalCodeVisible(): boolean {
  if (process.stdout.isTTY) return true;
  if (process.env.PREGATE_TESTING === "1") return true;
  return unattendedApproval();
}

// How the confirmation that produced a record was given. `yes` is the in-harness convenience:
// a code or `--yes` with no terminal. `unattended` is CI. `terminal` typed y. `test` is the test hook.
let lastVia: ApprovalVia = "terminal";
export function approvalRecordVia(): ApprovalVia {
  return lastVia;
}

// Keep the review text. Remove only the code an approval command would accept.
// The no-terminal route repeats the command the human must type. Redacting that line would hide
// the only way to approve. Preview output is still redacted.
const TERMINAL_ROUTE = /^Open (?:Terminal\/iTerm|a new PowerShell window) in .+ and run `pregate approve [0-9a-f]{12,64}`\.$/;

export function withholdApprovalCode(text: string): string {
  if (approvalCodeVisible()) return text;
  const hidden = "withheld until this preview runs in a human terminal";
  return text.split("\n").map((line) => TERMINAL_ROUTE.test(line) ? line : line
    .replace(/Digest: [0-9a-f]{64}/g, `Digest: ${hidden}`)
    .replace(/pregate approve [0-9a-f]{12,64}/g, "pregate approve <withheld>")
    .replace(/pregate (session rebase \S+ --digest|feedback apply|storage apply|issue submit) [0-9a-f]{64}/g, "pregate $1 <withheld>")
    .replace(/("pendingApproval": )"[0-9a-f]{12,64}"/g, "$1null")).join("\n");
}

// `harness`: the human can run this exact `pregate approve` form in the harness shell, including a
// `!` line. Other commands stay on a separate terminal. An agent could run the harness form; the
// approval log records that. The agent is told not to.
export function humanApprovalInstructions(command: string, route: "harness" | "terminal" = "terminal"): string[] {
  if (route === "harness") return [
    `After reviewing, the human runs in this shell, including a harness ! line: ${command}`,
    "A code or --yes needs no terminal. Claude Code, Codex, Grok, agy, OpenCode and Cursor can run that command in the agent shell. A bare approve still asks for y on a terminal.",
    "An agent could run that command. Pregate records a non-terminal approval in the approval log instead of making it impossible. The agent must not run the approval command; ask the human to.",
  ];
  return [`After reviewing, the human runs in a separate terminal: ${command}`,
    "Claude Code, Codex, Grok, agy, OpenCode and Cursor each need a separate terminal. A harness ! line has no terminal for this command, so it cannot approve. The command then asks for y on that terminal.",
    "The agent must not run the approval command. --yes skips the question only where PREGATE_UNATTENDED_APPROVAL=1 is already set in the environment (an unattended CI job)."];
}

// The launcher arms a separate deadline before validating a contract proposal.
export function approvalDeadline(): void {
  if (WINDOWS && process.env.PREGATE_APPROVAL_DEADLINE) {
    writeAtomic(process.env.PREGATE_APPROVAL_DEADLINE, "");
    return;
  }
  const pid = process.env.PREGATE_LAUNCHER_PID;
  if (pid !== undefined && Number(pid) === process.ppid) process.kill(process.ppid, "SIGUSR2");
}

function testAnswer(): string | undefined {
  return TEST_BUILD && process.env.PREGATE_TESTING === "1" ? process.env.PREGATE_TEST_ANSWER : undefined;
}

function tty(): number | null {
  // CONIN$ can exist in a CI console whose blocking read never reaches the abort timer.
  if (process.env.CI || unattendedApproval() || (WINDOWS && !terminalIo().isatty(0))) return null;
  return openTerminal();
}

function openTerminal(): number | null {
  try {
    const fd = openSync(WINDOWS ? "CONIN$" : "/dev/tty", WINDOWS ? "r" : "r+");
    if (terminalIo().isatty(fd)) return fd;
    closeSync(fd);
    return null;
  } catch {
    return null;
  }
}

export function hasTerminal(): boolean {
  if (testAnswer() !== undefined) return true;
  const fd = tty();
  if (fd === null) return false;
  closeSync(fd);
  return true;
}

// Why a caller was not allowed to apply. A code or `--yes` on `pregate approve` does not need a
// terminal (`bound`). Every other command still needs the unattended opt-in, the test hook, or a
// typed y. A pipe that contains "y" is not that typed y.
// `route` is the real project root and the command a person types there. A batch names every root.
export function approvalRefusal(route?: { roots: string[]; command: string }): string {
  if (!unattendedApproval() && testAnswer() === undefined && !process.stdin.isTTY) return noTerminal(route);
  return "Human approval unavailable or rejected; nothing applied.";
}

function noTerminal(route?: { roots: string[]; command: string }): string {
  const why = "This process has no terminal, so nothing was approved.";
  if (route === undefined || route.roots.length === 0) return why;
  const open = WINDOWS
    ? `Open a new PowerShell window in ${route.roots.join(", ")} and run \`${route.command}\`.`
    : `Open Terminal/iTerm in ${route.roots.join(", ")} and run \`${route.command}\`.`;
  const harness = route.command.startsWith("pregate approve")
    ? ` In this shell, including a harness ! line, \`${route.command}\` applies when it carries that code or --yes. An agent could run it; the approval log records a non-terminal approval. The agent must not run the approval command. Ask the human to.`
    : " The agent must not run the approval command. Ask the human to.";
  return `${why}\n${open}${harness}`;
}

// `bound`: this call is `pregate approve` with a code or `--yes`. That confirmation does not need
// a terminal. Other commands pass false, so `--yes` still needs `PREGATE_UNATTENDED_APPROVAL=1`.
export async function approve(summary: string, warning: boolean, yes = false, bound = false): Promise<boolean> {
  const answer = testAnswer();
  const confirmed = yes && (bound || unattendedApproval());
  const prompting = answer !== undefined ? !yes : !confirmed;
  const text = Buffer.from(approvalText(summary, warning, prompting), "utf8");
  if (answer !== undefined) {
    writeAll(1, text);
    const ok = /^(y|yes)$/i.test(answer.trim());
    if (ok) lastVia = "test";
    return ok;
  }
  if (confirmed) {
    writeAll(1, text);
    lastVia = unattendedApproval() ? "unattended" : "yes";
    return true;
  }
  // The caller's stdin must be a terminal. A pipe that contains "y" is not a typed confirmation.
  if (!process.stdin.isTTY) return false;
  const fd = openTerminal();
  if (fd === null) return false;
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), APPROVAL_MS);
  const ok = await terminalAnswer(fd, text, abort.signal, deadline);
  if (ok) lastVia = "terminal";
  return ok;
}

async function terminalAnswer(fd: number, text: Buffer, signal: AbortSignal, deadline: ReturnType<typeof setTimeout>): Promise<boolean> {
  try {
    // Materialize UTF-8 bytes once: no subprocess argv, format string or rope conversion.
    if (WINDOWS) writeAll(2, text);
    else writeAll(fd, text);
    return /^(y|yes)$/i.test((await readTerminalLine(fd, signal)).trim());
  } catch {
    return false;
  } finally {
    clearTimeout(deadline);
    closeSync(fd);
  }
}

// readline's ReadStream on /dev/tty pauses process.stdin when destroyed (Bun 1.4.4), and the
// next question never receives a line. Read this fd directly so stdin stays usable.
function readTerminalLine(fd: number, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const finish = (error: Error | null, line = "") => {
      signal.removeEventListener("abort", onAbort);
      if (error === null) resolve(line);
      else reject(error);
    };
    const onAbort = () => finish(new Error("approval timed out"));
    signal.addEventListener("abort", onAbort);
    const step = () => {
      const buf = Buffer.alloc(256);
      read(fd, buf, 0, buf.length, null, (error, n) => {
        if (signal.aborted) return;
        if (error) return finish(error);
        if (n > 0) chunks.push(Buffer.from(buf.subarray(0, n)));
        const line = Buffer.concat(chunks).toString("utf8");
        if (n === 0 || /[\r\n]/.test(line)) return finish(null, line);
        step();
      });
    };
    step();
  });
}

// The lock becomes current only once the approved tool has written the exact candidate bytes.
export function pendingContract(root: string, lockText: string, writes: { path: string; after: string | null }[]): void {
  const file = join(dataHome(), "pending", `${H(root)}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeAtomic(file, JSON.stringify({ root, lockText, at: Date.now(), writes: writes.map((w) => ({ path: w.path, hash: w.after === null ? null : sha256(w.after) })) }));
}

export function finishContract(root: string): void {
  const file = join(dataHome(), "pending", `${H(root)}.json`);
  if (!existsSync(file)) return;
  const pending = JSON.parse(readFileSync(file, "utf8")) as { root: string; lockText: string; at: number; writes: { path: string; hash: string | null }[] };
  if (pending.root !== root || Date.now() - pending.at > APPROVAL_MS) { rmSync(file); return; }
  const done = pending.writes.every((w) => w.hash === null ? !existsSync(w.path) : existsSync(w.path) && sha256(readFileSync(w.path, "utf8")) === w.hash);
  if (!done) return;
  writeAtomic(join(root, ".pregate/pregate.lock.json"), pending.lockText);
  recordApproval(root, pending.lockText, "terminal");
  enable(root);
  rmSync(file);
}
