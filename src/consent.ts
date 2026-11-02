import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { canonical, writeAtomic } from "./disk.ts";
import { git } from "./git.ts";
import { storageDir } from "./platform.ts";

// Consent belongs to this machine, never to committed repo files. Enabling a worktree also consents
// for its repository: every other worktree of it (a branch checked out beside it, an agent's isolated
// worktree) is protected without another approval, unless a human disabled that worktree itself.
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

export function enabled(root: string, data = dataHome()): boolean {
  const path = file(root, data);
  const common = commonDir(root);
  if (existsSync(path)) {
    const record = JSON.parse(readFileSync(path, "utf8")) as { root: string; common: string; disabled?: boolean };
    if (record.root === canonical(root) && record.common === common) return record.disabled !== true;
  }
  // Only a worktree's top inherits: a nested project inside one keeps its own consent.
  return existsSync(join(root, ".git")) && common !== canonical(root) && existsSync(repoFile(common, data));
}

export function enable(root: string, data = dataHome()): void {
  const common = commonDir(root);
  const path = file(root, data);
  mkdirSync(dirname(path), { recursive: true });
  writeAtomic(path, JSON.stringify({ root: canonical(root), common }) + "\n");
  if (existsSync(join(root, ".git")) && common !== canonical(root)) writeAtomic(repoFile(common, data), JSON.stringify({ repo: common }) + "\n");
}

// Disabling a worktree withdraws the repository consent too; worktrees enabled by name stay enabled.
export function disable(root: string, data = dataHome()): void {
  const common = commonDir(root);
  rmSync(repoFile(common, data), { force: true });
  const path = file(root, data);
  mkdirSync(dirname(path), { recursive: true });
  writeAtomic(path, JSON.stringify({ root: canonical(root), common, disabled: true }) + "\n");
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
  if (root === null) return "PREGATE is inactive: this directory has no preset. Run `pregate init`.";
  return enabled(root)
    ? `PREGATE is active in ${canonical(root)}: local human consent for this worktree or its repository.`
    : `PREGATE is inactive in ${canonical(root)}: no local human consent. Run \`pregate enable\`. A committed preset is not consent.`;
}
