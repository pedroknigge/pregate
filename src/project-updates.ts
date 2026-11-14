import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { applyReviews } from "./approval-command.ts";
import { consentedRoots } from "./consent.ts";
import { canonical, findRoot } from "./disk.ts";
import { git } from "./git.ts";
import { projectUpdate } from "./pack-command.ts";
import { compareVersions, ENGINE_VERSION } from "./product.ts";
import { proposeBatch, readProposal } from "./proposal.ts";
import { sha256 } from "./state.ts";
import { VERSIONS } from "./versions.ts";
import { humanApprovalInstructions } from "./approval.ts";

type Result = { code: number; text: string; held?: string[] };
type Prepared = { root: string; digest: string | null };
const USAGE = "usage: pregate update --projects <path...> [--preview|--yes [--no-commit]]";

// Explicit paths, not automatic discovery: do not migrate unrelated worktrees.
// Each project retains its normal validation, approval and consent behavior.
export async function projectUpdates(args: string[]): Promise<Result> {
  const mode = modeOf(args.filter(arg => arg.startsWith("-")));
  const paths = args.filter(arg => !arg.startsWith("-"));
  if (paths.length === 0 || mode === null) return { code: 1, text: USAGE };
  const roots = new Set<string>();
  const errors: string[] = [];
  for (const path of paths) {
    const found = projectRoot(path);
    if ("root" in found) roots.add(found.root);
    else errors.push(found.error);
  }
  if (errors.length) return { code: 1, text: [...errors, "No project contracts changed. Correct the paths and retry."].join("\n") };
  const lines: string[] = [];
  const { prepared, failed, held } = await prepareAll([...roots], lines);
  // Applying needs every review of the batch; a preview reports each project on its own.
  const waiting = held.length === 0 ? [] : [`${held.length} projects pin a newer engine, core or pack than this engine and are not current: ${held.join(", ")}. Update the engine (pregate update), then preview them again.`];
  if (failed.length > 0 && mode.yes) return { code: 1, text: [...lines, ...waiting, `${failed.length} project reviews failed. No project contracts changed; fix those projects and retry.`].join("\n") };
  if (held.length > 0 && mode.yes) return { code: 1, held, text: [...lines, ...waiting, "No project contracts changed."].join("\n") };
  if (mode.yes) return applyAll(prepared, lines, mode.commit);
  const shown = reviewsOf(prepared).length < 2 ? lines : withoutOwnCodes(lines, reviewsOf(prepared));
  return { code: failed.length > 0 ? 1 : 0, held, text: [...shown, ...waiting, ...previewSummary(prepared, failed, held.length)].join("\n") };
}

function modeOf(flags: string[]): { yes: boolean; commit: boolean } | null {
  const yes = flags.includes("--yes"), noCommit = flags.includes("--no-commit");
  const known = flags.every(flag => ["--preview", "--yes", "--no-commit"].includes(flag)) && new Set(flags).size === flags.length;
  if (!known || (yes && flags.includes("--preview")) || (noCommit && !yes)) return null;
  return { yes, commit: !noCommit };
}

// Only a proposal this run created counts as a review: an unrelated older one is never applied.
// A held project (it pins a newer version than this engine carries) is neither current nor failed.
async function prepareAll(roots: string[], lines: string[]): Promise<{ prepared: Prepared[]; failed: string[]; held: string[] }> {
  const prepared: Prepared[] = [], failed: string[] = [], held: string[] = [];
  for (const root of roots) {
    const before = proposalDigest(root);
    const result = await projectUpdate(["--preview"], root);
    lines.push(`Project: ${root}`, result.text);
    if (result.code !== 0) { failed.push(root); continue; }
    if (result.held?.length) { held.push(root); continue; }
    const after = proposalDigest(root);
    prepared.push({ root, digest: after !== null && after !== before ? after : null });
  }
  return { prepared, failed, held };
}

// With one batch code, each project's own approval lines would only compete with it.
function withoutOwnCodes(lines: string[], reviews: { digest: string }[]): string[] {
  const own = new Set(reviews.flatMap(({ digest }) => humanApprovalInstructions(`pregate approve ${digest.slice(0, 12)}`, "harness")));
  return lines.map(text => text.split("\n").filter(line => !own.has(line)).join("\n"));
}

function reviewsOf(prepared: Prepared[]): { root: string; digest: string }[] {
  return prepared.flatMap(({ root, digest }) => digest === null ? [] : [{ root, digest }]);
}

// Two or more reviews also get one batch code that approves all of them from any directory.
function previewSummary(prepared: Prepared[], failed: string[], held: number): string[] {
  const reviews = reviewsOf(prepared);
  const failures = failed.length === 0 ? [] : [`${failed.length} project reviews failed: ${failed.join(", ")}. Fix those projects and preview them again.`];
  if (reviews.length === 0) return [...failures, `${failed.length + held === 0 ? "All " : ""}${prepared.length} projects are current. No project contracts changed.`];
  // The batch code replaces each project's command line. The shared instructions still apply.
  const code = reviews.length < 2 ? null : `pregate approve ${proposeBatch(reviews).slice(0, 12)}`;
  const batch = code === null ? [] : [`Approve all ${reviews.length} project updates: ${code}`, ...humanApprovalInstructions(code, "harness").slice(1)];
  return [...failures, `${reviews.length} project reviews prepared; ${prepared.length - reviews.length} already current. No project contracts changed.`,
    batch.length ? "Review every project above, then approve them all with the one code below (from any directory)."
      : "Review every project above. Approve each displayed code in its project, or rerun the same path list with --yes to apply and commit each project in one execution (--no-commit leaves the files uncommitted).",
    ...batch];
}

// Each project applies exactly the proposal prepared above, through the same path as approve.
async function applyAll(prepared: Prepared[], lines: string[], commit: boolean): Promise<Result> {
  const reviews = reviewsOf(prepared);
  lines.push(...prepared.filter(p => p.digest === null).map(p => `Current ${p.root}: already current.`));
  const applied = await applyReviews(reviews, commit);
  const updated = applied.updated;
  return { code: updated === reviews.length ? 0 : 1, text: [...lines, ...applied.lines,
    `${updated}/${reviews.length} project contracts updated; ${prepared.length - reviews.length} already current. Each project is independent; successful updates are retained if another fails.`,
    "Disabled projects remain disabled; global installation is unchanged.",
  ].join("\n") };
}

function proposalDigest(root: string): string | null {
  const proposal = readProposal(root);
  return proposal === null ? null : sha256(JSON.stringify(proposal));
}

function projectRoot(path: string): { root: string } | { error: string } {
  try {
    const directory = canonical(path);
    if (!statSync(directory).isDirectory()) throw new Error("not a directory");
    const root = findRoot(directory, () => true);
    if (root === null) throw new Error("no project contract here or above; initialize this project first");
    return { root };
  } catch (e) { return { error: `${JSON.stringify(path)}: ${(e as Error).message}` }; }
}

// Other worktrees of the same repository whose lock pins another engine: named with the exact
// review command, never migrated implicitly.
export function worktreeHint(root: string): string[] {
  const others = worktreesOf(root).filter((dir) => dir !== root && ![null, VERSIONS.engine].includes(pinnedEngine(dir)));
  if (others.length === 0) return [];
  return [`Other worktrees of this repository pin another engine: ${others.join(", ")}.`, `Review them together: pregate update --projects ${quotedPaths(others)} --preview`];
}

// Registered projects elsewhere on this machine that pin an older engine (the first update to a
// release that reads the registry runs the older engine's single-project preview).
export function registryHint(root: string): string[] {
  const named = new Set([root, ...worktreesOf(root)]);
  const others = staleProjects(consentedRoots().filter((entry) => entry.enabled).map((entry) => entry.root), VERSIONS.engine)
    .filter((dir) => !named.has(dir));
  if (others.length === 0) return [];
  return [`${others.length} other registered projects pin older engines: ${others.join(", ")}.`, `Review them together: pregate update --projects ${quotedPaths(others)} --preview`];
}

// The given roots and their worktrees whose lock pins an engine older than `version`. A newer pin
// (a teammate upgraded) is never proposed for a downgrade.
export function staleProjects(roots: string[], version: string): string[] {
  const all = new Set(roots.flatMap((root) => [root, ...worktreesOf(root)]));
  return [...all].filter((dir) => {
    const pin = pinnedEngine(dir);
    return pin !== null && (!ENGINE_VERSION.test(pin) || compareVersions(pin, version) < 0);
  });
}

export function worktreesOf(root: string): string[] {
  return listedWorktrees(git(root, ["worktree", "list", "--porcelain"]));
}

// The worktrees of the repository whose Git common dir is `common`, found even when the worktree a
// consent record named is gone.
export function repoWorktrees(common: string): string[] {
  return listedWorktrees(git(common, ["--git-dir", common, "worktree", "list", "--porcelain"]));
}

function listedWorktrees(listed: string | null): string[] {
  if (listed === null) return [];
  return listed.split("\n").filter((line) => line.startsWith("worktree ")).map((line) => line.slice("worktree ".length))
    .filter((dir) => existsSync(dir)).map((dir) => canonical(dir));
}

// The engine a project's lock pins; null without a lock, "" when it cannot be read.
export function pinnedEngine(dir: string): string | null {
  const file = join(dir, ".pregate/pregate.lock.json");
  return existsSync(file) ? lockEngine(file) : null;
}

function lockEngine(file: string): string {
  try {
    return String((JSON.parse(readFileSync(file, "utf8")) as { engine?: unknown }).engine ?? "");
  } catch {
    return "";
  }
}

function quotedPaths(dirs: string[]): string {
  return dirs.map((dir) => (/^[\w./-]+$/.test(dir) ? dir : JSON.stringify(dir))).join(" ");
}
