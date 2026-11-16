import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { canonical, findRoot, samePlace, writeAtomic } from "./disk.ts";
import { git } from "./git.ts";
import { pathKey } from "./paths.ts";
import { homeDir, storageDir } from "./platform.ts";

// Consent belongs to this machine, never to committed repo files. Enabling a worktree also consents
// for its repository: every other worktree of it (a branch checked out beside it, an agent's isolated
// worktree) is protected without another approval, unless a human disabled that worktree or the project.
export function dataHome(): string {
  return storageDir("data");
}

// Written the first time a session reaches a consented root. The launcher skips the engine when no
// consent record exists; this marker keeps Stop reaching it after a script deletes the last record,
// so Stop can warn that consent disappeared mid-session.
export function markReached(data = dataHome()): void {
  const path = join(data, "reached");
  if (existsSync(path)) return;
  mkdirSync(data, { recursive: true });
  writeAtomic(path, "");
}

function file(root: string, data: string): string {
  const key = new Bun.CryptoHasher("sha256").update(canonical(root)).digest("hex");
  return join(data, "consent", `${key}.json`);
}

function repoFile(common: string, data: string): string {
  const key = new Bun.CryptoHasher("sha256").update(`repo:${common}`).digest("hex");
  return join(data, "consent", `${key}.json`);
}

function commonDir(root: string): string {
  // Git's on-disk worktree identity is stable and cheap to inspect on every hook. Respect explicit
  // Git overrides when present; GIT_INDEX_FILE does not change the repository's identity.
  if (process.env.GIT_DIR || process.env.GIT_COMMON_DIR || process.env.GIT_WORK_TREE) {
    const dir = git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"])?.trim();
    if (!dir) throw new Error("Cannot verify consent: explicit Git repository is unavailable.");
    return canonical(dir);
  }
  for (let dir = root; ; dir = dirname(dir)) {
    const marker = join(dir, ".git");
    if (existsSync(marker)) {
      const pointed = statSync(marker).isDirectory() ? marker : gitDirectory(marker, dir);
      const common = join(pointed, "commondir");
      return canonical(existsSync(common) ? resolve(pointed, readFileSync(common, "utf8").trim()) : pointed);
    }
    if (dirname(dir) === dir) return canonical(root);
  }
}

function gitDirectory(marker: string, root: string): string {
  const path = /^gitdir: (.+)\r?\n?$/.exec(readFileSync(marker, "utf8"))?.[1];
  if (!path) throw new Error("Cannot verify consent: invalid .git pointer.");
  return resolve(root, path.trim());
}

type ConsentFlags = { worktree: boolean; project: boolean; enabled: boolean };

// One pass over the consent directory. A worktree record names `root`. A project record names `repo`.
function consentFlags(root: string, data: string): ConsentFlags {
  const here = canonical(root);
  const common = commonDir(root);
  const directory = join(data, "consent");
  const names = existsSync(directory) ? readdirSync(directory).filter((name) => name.endsWith(".json")) : [];
  const flags = { worktree: false, project: false, enabled: false };
  for (const name of names) {
    const record = consentRecord(join(directory, name));
    if (record === null) continue;
    if (typeof record.root === "string" && samePlace(record.root, here)) {
      if (record.disabled === true) flags.worktree = true;
      else if ((typeof record.common === "string" && samePlace(record.common, common)) || !existsSync(join(here, ".git"))) flags.enabled = true;
    }
    if (typeof record.repo === "string" && samePlace(record.repo, common)) {
      if (record.disabled === true) flags.project = true;
      else flags.enabled = flags.enabled || (existsSync(join(here, ".git")) && !samePlace(common, here));
    }
  }
  return flags;
}

// A human ran `pregate disable` for this worktree, or `pregate disable --project` for its repository.
// A project that was never enabled has no record. Neither one is enforced.
export function explicitlyDisabled(root: string, data = dataHome()): boolean {
  const flags = consentFlags(root, data);
  return flags.worktree || flags.project;
}

// Which recorded disable applies here. `both` means the project and this worktree are each disabled.
export function disableScope(root: string, data = dataHome()): "project" | "worktree" | "both" | null {
  const flags = consentFlags(root, data);
  if (flags.project && flags.worktree) return "both";
  if (flags.project) return "project";
  if (flags.worktree) return "worktree";
  return null;
}

// The branch checked out in this worktree, when HEAD names one. Detached HEAD has no branch.
function branchOf(root: string): string | null {
  const marker = join(root, ".git");
  if (!existsSync(marker)) return null;
  const gitDir = statSync(marker).isDirectory() ? marker : pointerDir(marker, root);
  if (gitDir === null || !existsSync(join(gitDir, "HEAD"))) return null;
  const ref = /^ref: refs\/heads\/(.+)$/.exec(readFileSync(join(gitDir, "HEAD"), "utf8").trim());
  return ref?.[1] ?? null;
}

function pointerDir(marker: string, root: string): string | null {
  const path = /^gitdir: (.+)\r?\n?$/.exec(readFileSync(marker, "utf8"))?.[1];
  return path === undefined ? null : resolve(root, path.trim());
}

// Status names the scope. A worktree disable also names the branch checked out there.
export function disabledLabel(root: string, data = dataHome()): string {
  const scope = disableScope(root, data);
  if (scope === "both") return "this project and this worktree";
  if (scope === "project") return "this project";
  const branch = branchOf(root);
  return branch === null ? "this worktree" : `this worktree (branch ${branch})`;
}

// One informational line a hook may print. It is not a denial.
export function disabledNotice(root: string, data = dataHome()): string {
  const scope = disableScope(root, data);
  const where = scope === "both" ? "this project and this worktree" : scope === "project" ? "this project" : "this worktree";
  return `PREGATE is disabled for ${where}. Pre-command and pre-edit do not block it.`;
}

export function enabled(root: string, data = dataHome()): boolean {
  const flags = consentFlags(root, data);
  // A disable of this worktree or of the whole project wins over an older enable record.
  if (flags.worktree || flags.project) return false;
  return flags.enabled;
}

// The one check for "enforced here": this directory's own project, the nearest
// .pregate/preset.json that `pregate enable` activated, not past a .git boundary.
// Home, a parent past that boundary, a pending review, and a session that reached
// some other root do not enforce here. `enabled` is false after `pregate disable`,
// so a disabled worktree is the same answer.
export function enforcedHere(dir: string): boolean {
  let path: string;
  try { path = canonical(dir); }
  catch (error) {
    if (error instanceof Error && error.message.endsWith(": no existing ancestor")) return false;
    throw error;
  }
  let home: string | null = null;
  try { home = canonical(homeDir()); }
  catch (error) {
    if (!(error instanceof Error && error.message.endsWith(": no existing ancestor"))) throw error;
  }
  const own = (root: string) => home === null || pathKey(root) !== pathKey(home);
  // `git init` after enable changes the common dir, so `enabled` can miss a record that
  // still names this root. The record remains the enable, until disable. A project disable
  // wins over that record, the same way `enabled` does.
  const accepts = (root: string) => !explicitlyDisabled(root) && (enabled(root) || consentNames(root));
  const root = findRoot(path, accepts);
  if (root !== null && own(root)) return true;
  // `pregate enable` was run for this checkout even when the preset file is gone.
  const checkout = checkoutOf(path);
  return checkout !== null && accepts(checkout) && own(checkout);
}

// A consent record names this root and is not disabled. Common-dir drift does not erase it.
function consentNames(root: string, data = dataHome()): boolean {
  let here: string;
  try { here = canonical(root); }
  catch (error) {
    if (error instanceof Error && error.message.endsWith(": no existing ancestor")) return false;
    throw error;
  }
  const directory = join(data, "consent");
  if (!existsSync(directory)) return false;
  for (const name of readdirSync(directory).filter((entry) => entry.endsWith(".json"))) {
    const record = consentRecord(join(directory, name));
    if (record === null || typeof record.root !== "string" || !samePlace(record.root, here)) continue;
    return record.disabled !== true;
  }
  return false;
}

function checkoutOf(dir: string): string | null {
  for (let at = dir; ; at = dirname(at)) {
    if (existsSync(join(at, ".git"))) return at;
    if (dirname(at) === at) return null;
  }
}

export function enable(root: string, data = dataHome()): void {
  const common = commonDir(root);
  const path = file(root, data);
  mkdirSync(dirname(path), { recursive: true });
  writeAtomic(path, JSON.stringify({ root: canonical(root), common }) + "\n");
  if (existsSync(join(root, ".git")) && common !== canonical(root)) writeAtomic(repoFile(common, data), JSON.stringify({ repo: common }) + "\n");
}

// This checkout, and the repository consent other worktrees were inheriting. A worktree enabled by
// name keeps its own record. A project-level disable record is left in place.
export function disable(root: string, data = dataHome()): void {
  const common = commonDir(root);
  const repo = repoFile(common, data);
  const record = existsSync(repo) ? consentRecord(repo) : null;
  if (record === null || record.disabled !== true) rmSync(repo, { force: true });
  const path = file(root, data);
  mkdirSync(dirname(path), { recursive: true });
  writeAtomic(path, JSON.stringify({ root: canonical(root), common, disabled: true, scope: "worktree" }) + "\n");
}

// The whole repository. Every worktree stops, including one that was enabled by name.
export function disableProject(root: string, data = dataHome()): void {
  const common = commonDir(root);
  const path = repoFile(common, data);
  mkdirSync(dirname(path), { recursive: true });
  writeAtomic(path, JSON.stringify({ repo: common, disabled: true, scope: "project" }) + "\n");
}

// This machine's registry of projects a human enabled or disabled by name, from their consent
// records. Repository-wide records name no root; a record whose project lost its preset is skipped.
export function consentedRoots(data = dataHome()): { root: string; enabled: boolean }[] {
  const directory = join(data, "consent");
  if (!existsSync(directory)) return [];
  const found = new Map<string, boolean>();
  for (const name of readdirSync(directory).filter((n) => n.endsWith(".json"))) {
    const record = consentRecord(join(directory, name));
    if (record === null || typeof record.root !== "string" || !existsSync(join(record.root, ".pregate/preset.json"))) continue;
    found.set(canonical(record.root), record.disabled !== true);
  }
  return [...found].sort(([a], [b]) => a.localeCompare(b)).map(([root, on]) => ({ root, enabled: on }));
}

// Every existing root and repository (Git common dir) a consent record names, with or without a
// preset: whatever a hook may still gate through a record, including worktrees that only inherit
// repository consent. Engine pruning keeps what any of them pins.
export function consentedPlaces(data = dataHome()): { roots: string[]; repos: string[] } {
  const directory = join(data, "consent");
  const roots = new Set<string>(), repos = new Set<string>();
  const names = existsSync(directory) ? readdirSync(directory).filter((n) => n.endsWith(".json")) : [];
  const present = (value: unknown): string[] => (typeof value === "string" && existsSync(value) ? [canonical(value)] : []);
  for (const name of names) {
    const record = consentRecord(join(directory, name));
    present(record?.root).forEach((root) => roots.add(root));
    [record?.repo, record?.common].flatMap(present).forEach((repo) => repos.add(repo));
  }
  return { roots: [...roots].sort(), repos: [...repos].sort() };
}

function consentRecord(path: string): { root?: unknown; disabled?: unknown; repo?: unknown; common?: unknown } | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    return typeof value === "object" && value !== null ? value : null;
  } catch {
    return null;   // a damaged record is not a registered project; its consent is checked on use
  }
}

export function status(root: string | null): string {
  if (root === null) return "This directory has no preset. Run `pregate init`.";
  if (explicitlyDisabled(root)) return `Local consent is inactive (disabled for ${disabledLabel(root)}) in ${canonical(root)}. ${disabledNotice(root)} The human runs \`pregate enable\`.`;
  return enabled(root)
    ? `Local consent is active in ${canonical(root)} for this worktree or its repository. Consent is not enforced coverage.`
    : `Local consent is inactive in ${canonical(root)}. Run \`pregate enable\`. A committed preset is not consent.`;
}
