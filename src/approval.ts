import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeSync, closeSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Interface } from "node:readline/promises";
import type { ReadStream } from "node:tty";
import { approvalText } from "./contract.ts";
import { dataHome, enable } from "./consent.ts";
import { writeAtomic } from "./disk.ts";
import { H, sha256 } from "./state.ts";
import { WINDOWS } from "./platform.ts";

export const APPROVAL_MS = 90_000;
// Loaded on first use: these builtins take milliseconds to initialize, and every hook would pay it.
const terminalIo = () => require("node:tty") as typeof import("node:tty");
const prompts = () => require("node:readline/promises") as typeof import("node:readline/promises");
export { PENDING_MS, proposeContract, readProposal, discardProposal, type Proposal } from "./proposal.ts";
declare const PREGATE_TEST_BUILD: boolean;
const TEST_BUILD = typeof PREGATE_TEST_BUILD !== "undefined" && PREGATE_TEST_BUILD;

// The approval code is a secret the human types. An agent tool captures stdout, so it is not a
// terminal. `PREGATE_TESTING=1` is the test hook; the shell guard rejects an agent setting it.
export function approvalCodeVisible(): boolean {
  if (process.stdout.isTTY) return true;
  if (process.env.PREGATE_TESTING === "1") return true;
  // CI jobs and this repo's tests export CI. An agent shell that assigns CI in the
  // command is denied; a process that already has CI set still sees the code.
  return Boolean(process.env.CI);
}

// Keep the review text. Remove only the code an approval command would accept.
export function withholdApprovalCode(text: string): string {
  if (approvalCodeVisible()) return text;
  const hidden = "withheld until this preview runs in a human terminal";
  return text
    .replace(/Digest: [0-9a-f]{64}/g, `Digest: ${hidden}`)
    .replace(/pregate approve [0-9a-f]{12,64}/g, "pregate approve <withheld>")
    .replace(/pregate (session rebase \S+ --digest|feedback apply|storage apply|issue submit) [0-9a-f]{64}/g, "pregate $1 <withheld>")
    .replace(/("pendingApproval": )"[0-9a-f]{12,64}"/g, "$1null");
}

export function humanApprovalInstructions(command: string): string[] {
  return [`After reviewing, type inside Claude Code, Codex, Grok or agy: ! ${command}`,
    `Cursor requires a separate human terminal: ${command}`,
    "The agent must not run the approval command."];
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
  if (process.env.CI || (WINDOWS && !terminalIo().isatty(0))) return null;
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

export async function approve(summary: string, warning: boolean, yes = false): Promise<boolean> {
  const text = Buffer.from(approvalText(summary, warning, !yes), "utf8");
  const answer = testAnswer();
  if (yes || answer !== undefined) {
    writeSync(1, text);
    return yes || /^(y|yes)$/i.test(answer!.trim());
  }
  const fd = tty();
  if (fd === null) return false;
  const input = new (terminalIo().ReadStream)(fd);
  const terminal = prompts().createInterface({ input });
  const abort = new AbortController();
  terminal.once("close", () => abort.abort());
  const deadline = setTimeout(() => abort.abort(), APPROVAL_MS);
  return terminalAnswer({ fd, text, input, terminal, signal: abort.signal, deadline });
}

type Prompt = { fd: number; text: Buffer; input: ReadStream; terminal: Interface; signal: AbortSignal; deadline: ReturnType<typeof setTimeout> };

async function terminalAnswer(prompt: Prompt): Promise<boolean> {
  try {
    // Materialize UTF-8 bytes once: no subprocess argv, format string or rope conversion.
    if (WINDOWS) writeSync(2, prompt.text);
    else writeSync(prompt.fd, prompt.text);
    return /^(y|yes)$/i.test((await prompt.terminal.question("", { signal: prompt.signal })).trim());
  } catch {
    return false;
  } finally {
    clearTimeout(prompt.deadline);
    prompt.terminal.close();
    prompt.input.destroy();
  }
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
  enable(root);
  rmSync(file);
}
