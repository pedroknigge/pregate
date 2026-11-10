import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { dataHome } from "./consent.ts";
import { writeAtomic } from "./disk.ts";
import { librarySources } from "./library.ts";
import { slash } from "./paths.ts";
import { H, sha256 } from "./state.ts";
import { VERSIONS } from "./versions.ts";

// A review stays approvable for a working day; staleness itself is checked against the exact
// contract and files it was prepared from, not by the clock.
export const PENDING_MS = 24 * 3_600_000;
export interface Proposal {
  root: string; lockText: string; at: number; baseline: string;
  activate?: boolean;
  request?: string;
  replaced?: string;
  writes: { path: string; before: string | null; after: string | null }[];
  engine?: EngineStamp;
}

// The engine that prepared a review: its version, the bundled pack versions its lock was compiled
// with, and whether it ran from source. Another engine may validate the same review differently.
export interface EngineStamp { version: string; packs: Record<string, string>; source: boolean }

export function engineStamp(): EngineStamp {
  return { version: VERSIONS.engine, packs: Object.fromEntries(librarySources().map((s) => [s.ns, s.version])),
    source: !Bun.main.startsWith("/$bunfs/") && !Bun.main.includes("~BUN/") };
}

// How a stamp reads in a review: "0.0.5" or "0.0.5 (run from source)".
export function engineLabel(stamp: EngineStamp): string {
  return `${stamp.version}${stamp.source ? " (run from source)" : ""}`;
}

function proposalFile(root: string, data: string): string { return join(data, "proposals", `${H(slash(root))}.json`); }

// One pending proposal per root: a newer one (another agent's, a retry) replaces it, and its review
// names the replaced approval code so nobody approves the wrong change. With `stable`, an identical
// rerun (an agent repeating a preview) keeps the earlier proposal and the code the human already
// saw, unless half its approval window is gone. Guided flows always re-prepare.
export function proposeContract(input: Omit<Proposal, "at" | "engine">, stable = false): Proposal {
  const proposal = { ...input, root: slash(input.root), engine: engineStamp() };
  const file = proposalFile(proposal.root, dataHome());
  mkdirSync(dirname(file), { recursive: true });
  const earlier = readProposal(proposal.root);
  // Stored paths use the same forward-slash form as the root on every platform.
  const writes = proposal.writes.map((w) => ({ ...w, path: slash(w.path) }));
  if (stable && earlier !== null && Date.now() - earlier.at <= PENDING_MS / 2 && content(earlier) === content({ ...proposal, writes })) return earlier;
  const replaced = earlier === null ? {} : { replaced: sha256(JSON.stringify(earlier)).slice(0, 12) };
  const prepared = { ...proposal, ...replaced, writes, at: Date.now() };
  writeAtomic(file, JSON.stringify(prepared));
  return prepared;
}

// What a proposal changes, without when it was made or which code it replaced.
function content(p: Omit<Proposal, "at">): string {
  return JSON.stringify([p.root, p.lockText, p.baseline, p.activate ?? null, p.request ?? null, p.writes, p.engine ?? null]);
}

export function readProposal(root: string, data = dataHome()): Proposal | null {
  const file = proposalFile(root, data);
  if (!existsSync(file)) return null;
  const proposal = JSON.parse(readFileSync(file, "utf8")) as Proposal;
  if (slash(proposal.root) === slash(root) && Date.now() - proposal.at <= PENDING_MS) return proposal;
  discardProposal(root, data);
  return null;
}

export function discardProposal(root: string, data = dataHome()): void { rmSync(proposalFile(root, data), { force: true }); }

// Initial review has no preset or consent. Keep this lookup independent of the compiler/catalog.
export function pendingRoot(cwd: string, data = dataHome()): string | null {
  if (!existsSync(join(data, "proposals"))) return null;
  for (let dir = cwd; ; dir = dirname(dir)) {
    // Proposals are keyed by the canonical forward-slash root; a Windows cwd arrives with backslashes.
    if (readProposal(slash(dir), data) !== null) return slash(dir);
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return null;
  }
}

// One code for several project reviews: the batch binds each project's exact proposal digest, and
// its own digest (the code) binds the sorted list. Only one batch exists; a newer one replaces it.
export interface Batch { at: number; digest: string; items: { root: string; digest: string }[] }

function batchFile(data: string): string { return join(data, "proposals", "batch.json"); }

export function proposeBatch(items: Batch["items"], data = dataHome()): string {
  const sorted = items.map(({ root, digest }) => ({ root, digest })).sort((a, b) => a.root < b.root ? -1 : a.root > b.root ? 1 : 0);
  mkdirSync(join(data, "proposals"), { recursive: true });
  writeAtomic(batchFile(data), JSON.stringify({ at: Date.now(), items: sorted }));
  return sha256(JSON.stringify(sorted));
}

export function readBatch(data = dataHome()): Batch | null {
  const file = batchFile(data);
  if (!existsSync(file)) return null;
  const batch = JSON.parse(readFileSync(file, "utf8")) as Omit<Batch, "digest">;
  if (Date.now() - batch.at <= PENDING_MS) return { ...batch, digest: sha256(JSON.stringify(batch.items)) };
  discardBatch(data);
  return null;
}

// A batch whose project was approved on its own stays until it expires or is replaced, so its
// code fails naming that project instead of vanishing.
export function discardBatch(data = dataHome()): void {
  rmSync(batchFile(data), { force: true });
}
