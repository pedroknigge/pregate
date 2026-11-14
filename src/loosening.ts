import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dataHome } from "./consent.ts";
import { bundledBetween, reviewDiff } from "./contract.ts";
import { canonical, writeAtomic } from "./disk.ts";
import { sha256 } from "./state.ts";
import type { Lock } from "./types.ts";

// A contract that weakens what the base contract enforced: a rule removed or loosened, a weaker
// mode, a narrower scope (contract.ts decides what counts). The same comparison serves Stop (the
// session's starting contract), pre-commit (HEAD against the index) and CI (the merge base against
// the checked-out head).
//
// Who may accept one differs by place. Locally, an approval records the lock it produced
// (`recordApproval`), including whether it was a terminal, a non-terminal `--yes`, CI, or the test
// hook. Stop and pre-commit accept that record. A same-user process can forge a local record, so
// CI does not read it: `check --ratchet` accepts a loosening only when
// PREGATE_ACCEPT_CONTRACT holds its exact digest, which the workflow sets from a repository
// variable or a workflow_dispatch input, outside anything the agent's commits can change (see
// docs/guarantees.md for protecting the workflow and .pregate/ with CODEOWNERS).
export type ApprovalVia = "terminal" | "yes" | "unattended" | "test";
export interface Loosening { digest: string; lines: string[] }
export interface Contract { lockText: string | null; presetText: string | null }

const MAX_LINES = 80;

export function loosening(base: Contract, head: { lock: Lock; hash: string; presetText: string | null }): Loosening | null {
  if (base.lockText === null) return null;
  const baseText = base.lockText.replaceAll("\r\n", "\n");
  if (sha256(baseText) === head.hash) return null;
  const diff = reviewDiff(baseText, head.lock, bundledBetween(base.presetText, head.presetText));
  if (!diff.warning) return null;
  const digest = sha256(`pregate-contract-loosening\0${sha256(baseText)}\0${head.hash}`);
  const lines = diff.lines.length <= MAX_LINES ? diff.lines : [...diff.lines.slice(0, MAX_LINES), `… ${diff.lines.length - MAX_LINES} more contract changes.`];
  return { digest, lines };
}

// The exact digests the environment accepts, comma- or space-separated. A prefix is not one.
export function acceptedByEnvironment(digest: string): boolean {
  return (process.env.PREGATE_ACCEPT_CONTRACT ?? "").split(/[\s,]+/).includes(digest);
}

function recordFile(root: string, lockHash: string): string {
  return join(dataHome(), "contract-approvals", `${sha256(`${canonical(root)}\0${lockHash}`)}.json`);
}

// An approval of the contract whose compiled lock is `lockText` in `root`. `via` says how the
// confirmation was given, so a non-terminal `--yes` is visible in the record and in the append-only log.
export function recordApproval(root: string, lockText: string, via: ApprovalVia = "terminal"): void {
  const lock = sha256(lockText.replaceAll("\r\n", "\n"));
  const file = recordFile(root, lock);
  const entry = { root: canonical(root), lock, at: Date.now(), via, tty: !!process.stdin.isTTY };
  mkdirSync(dirname(file), { recursive: true });
  writeAtomic(file, JSON.stringify(entry));
  appendFileSync(join(dirname(file), "log.jsonl"), `${JSON.stringify(entry)}\n`);
}

export function approvedLocally(root: string, lockHash: string): boolean {
  const file = recordFile(root, lockHash);
  if (!existsSync(file)) return false;
  try {
    const record = JSON.parse(readFileSync(file, "utf8")) as { root?: string; lock?: string };
    return record.root === canonical(root) && record.lock === lockHash;
  } catch {
    return false;
  }
}

// What check prints for a loosening it does not accept. The digest is not an approval code: it
// only names this exact base-to-head change for the workflow that may accept it.
export function looseningText(l: Loosening, where: "staged" | "base"): string {
  const how = where === "base"
    ? `To accept it, a maintainer sets PREGATE_ACCEPT_CONTRACT=${l.digest} for this workflow run (a repository variable or a workflow_dispatch input). Commits cannot set it.`
    : "Only a human approval recorded on this machine accepts it here: the human applies the change with `pregate preset apply <request> --preview` and then `pregate approve <code>` in this shell. The agent must not run the approval command. Or restore the previous contract.";
  return [`PREGATE DENY contract-loosened: this change loosens the contract compared with the ${where === "base" ? "base revision" : "last commit"}.`,
    ...l.lines.map((line) => `  ${line}`), `Contract loosening digest: ${l.digest}`, how].join("\n");
}
