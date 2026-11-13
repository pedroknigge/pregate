import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { GitChanges } from "./shell.ts";

// The files a git command that moves history or the worktree would change, found with read-only
// git queries before it runs. `worktree`: files it writes or deletes; `index`: entries it stages.
// The shell denies an in-scope worktree path and a protected path on either list. A plain checkout
// or switch of an existing branch on a clean worktree reports the differing files on the index
// only: they arrive with that branch. null: a form not read here (an in-progress sequence, a
// `--stdin` list, a prefix), which the guard treats as a write to anything. The shell layer runs
// git; the core only judges the paths.
const MAX_PATHS = 50_000;

export function gitChanges(cwd: string, args: string[]): GitChanges | null {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (top === null) return { worktree: [], index: [] };
  const repo = new Repo(top.trim(), cwd);
  try {
    const sub = args[0]!, rest = args.slice(1);
    const change = sub === "reset" ? reset(repo, rest)
      : sub === "checkout" ? checkout(repo, rest)
      : sub === "switch" ? switchTo(repo, rest)
      : sub === "stash" ? stash(repo, rest)
      : sub === "clean" ? clean(repo, rest)
      : sub === "cherry-pick" || sub === "revert" ? pick(repo, rest)
      : sub === "read-tree" ? readTree(repo, rest)
      : sub === "checkout-index" ? checkoutIndex(repo, rest)
      : null;
    if (change === null || change.worktree.length + change.index.length > MAX_PATHS) return null;
    return { worktree: [...new Set(change.worktree)], index: [...new Set(change.index)] };
  } catch {
    return null;
  }
}

class Repo {
  constructor(readonly top: string, readonly cwd: string) {}
  // NUL-separated names relative to the top level, as absolute paths.
  names(args: string[], from = this.top): string[] {
    const out = git(from, [args[0]!, "-z", ...args.slice(1)]);
    if (out === null) throw new Error(`git ${args.join(" ")} failed`);
    return out.split("\0").filter((p) => p !== "").map((p) => join(this.top, p));
  }
  commit(rev: string): string | null {
    return git(this.top, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${rev}^{commit}`])?.trim() || null;
  }
  // A local branch, `-` when the previous checkout was a local branch, or the single
  // remote-tracking branch `git switch` / `git checkout` would use for this name.
  // A commit, a tag, a path, or two remotes with the same name are not a branch.
  branchCommit(name: string): string | null {
    if (name === "-") {
      const previous = git(this.top, ["rev-parse", "--verify", "--symbolic-full-name", "--end-of-options", "@{-1}"])?.trim() ?? "";
      return previous.startsWith("refs/heads/") ? this.commit("@{-1}") : null;
    }
    const full = git(this.top, ["rev-parse", "--verify", "--symbolic-full-name", "--end-of-options", name])?.trim() ?? "";
    if (full.startsWith("refs/heads/")) return this.commit(full);
    if (full !== "" || !oneRemoteName(this.top, name)) return null;
    const listed = git(this.top, ["for-each-ref", "--format=%(refname)", "--", `refs/remotes/*/${name}`]);
    const refs = listed?.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("refs/remotes/")) ?? [];
    return refs.length === 1 ? this.commit(refs[0]!) : null;
  }
  // No staged, unstaged, or untracked file. A status Git cannot read is not clean.
  clean(): boolean {
    const status = git(this.top, ["status", "--porcelain=v1", "--untracked-files=all"]);
    if (status === null) throw new Error("git status failed");
    return status === "";
  }
  tree(rev: string): string | null {
    return git(this.top, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${rev}^{tree}`])?.trim() || null;
  }
  // Tracked files whose worktree or index content differs from HEAD.
  dirty(): string[] { return this.names(["diff", "--name-only", "HEAD"]); }
  between(a: string, b: string): string[] { return this.names(["diff", "--name-only", "--no-renames", a, b, "--"]); }
  untracked(ignored: "no" | "also" | "only", specs: string[] = []): string[] {
    const filter = ignored === "also" ? [] : ignored === "only" ? ["--ignored", "--exclude-standard"] : ["--exclude-standard"];
    return this.names(["ls-files", "--others", "--full-name", ...filter, "--", ...specs], this.cwd);
  }
}

function git(cwd: string, args: string[]): string | null {
  const r = spawnSync("git", ["--no-optional-locks", "-c", "core.quotepath=off", ...args], {
    cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return r.status === 0 ? r.stdout : null;
}

type Change = { worktree: string[]; index: string[] };
const NONE: Change = { worktree: [], index: [] };

// `values`: the word after an option that takes one (`-b new`, `-m 1`).
function options(rest: string[], valued: string[] = []): { flags: string[]; values: Map<string, string>; operands: string[]; paths: string[] | null } {
  const flags: string[] = [], operands: string[] = [], values = new Map<string, string>();
  let paths: string[] | null = null;
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i]!;
    if (w === "--") { paths = rest.slice(i + 1); break; }
    if (w.startsWith("-") && w !== "-") {
      const name = w.includes("=") ? w.slice(0, w.indexOf("=")) : w;
      flags.push(name);
      if (valued.includes(name)) values.set(name, w.includes("=") ? w.slice(w.indexOf("=") + 1) : rest[++i] ?? "");
    } else operands.push(w);
  }
  return { flags, values, operands, paths };
}

const has = (flags: string[], ...names: string[]) => flags.some((f) => names.includes(f) || names.some((n) => /^-[a-zA-Z]$/.test(n) && /^-[a-zA-Z]+$/.test(f) && f.includes(n[1]!)));

// `reset --hard|--merge|--keep <rev>` rewrites the worktree to rev; a mixed reset stages it.
function reset(repo: Repo, rest: string[]): Change | null {
  const { flags, operands, paths } = options(rest);
  if (has(flags, "--soft")) return NONE;
  const commit = repo.commit(operands[0] ?? "HEAD");
  if (commit === null) return null;
  const specs = paths ?? operands.slice(1);
  if (has(flags, "--hard", "--merge", "--keep")) return { worktree: repo.names(["diff", "--name-only", "--no-renames", commit, "--"]), index: [] };
  return { worktree: [], index: repo.names(["diff", "--name-only", "--no-renames", "--cached", commit, "--", ...specs]) };
}

// `checkout <rev>`, `checkout -b new <start>`, `checkout --detach <rev>`: the files that differ
// between HEAD and the target, plus local changes that -f discards. A single operand that is no
// revision is a path checked out from the index. A plain checkout of an existing branch is an
// arrival (see plainBranch).
function checkout(repo: Repo, rest: string[]): Change | null {
  const parsed = options(rest, ["-b", "-B", "--orphan"]);
  const plain = plainBranch(repo, parsed, false);
  if (plain !== undefined) return plain;
  const { flags, operands, paths } = parsed;
  const creates = flags.some((f) => ["-b", "-B"].includes(f));
  if (paths !== null || operands.length > 1) return null;
  const target = operands[0];
  if (flags.includes("--orphan")) return NONE;
  if (target === undefined) return creates || flags.includes("--detach") ? NONE : null;
  const commit = repo.commit(target === "-" ? "@{-1}" : target);
  if (commit === null) return creates ? null : { worktree: [join(repo.cwd, target)], index: [] };
  return moved(repo, commit, has(flags, "-f", "--force", "--discard-changes"));
}

// `switch <branch>`, `switch --detach <rev>`, `switch -c new <start>`, `switch --orphan new`.
// A plain switch of an existing branch is an arrival (see plainBranch).
function switchTo(repo: Repo, rest: string[]): Change | null {
  const parsed = options(rest, ["-c", "-C", "--create", "--force-create", "--orphan"]);
  const plain = plainBranch(repo, parsed, true);
  if (plain !== undefined) return plain;
  const { flags, operands, paths } = parsed;
  if (paths !== null) return null;
  const creates = flags.some((f) => ["-c", "-C", "--create", "--force-create"].includes(f));
  if (flags.includes("--orphan")) { const all = repo.names(["ls-files"]); return { worktree: all, index: all }; }
  const target = operands[0];
  if (target === undefined) return creates ? NONE : null;
  const commit = repo.commit(target === "-" ? "@{-1}" : target);
  if (commit === null) return null;
  return moved(repo, commit, has(flags, "-f", "--force", "--discard-changes"));
}

function moved(repo: Repo, commit: string, discard: boolean): Change {
  const all = [...differ(repo, commit), ...(discard ? repo.dirty() : [])];
  return { worktree: all, index: all };
}

// `checkout <branch>` / `switch <branch>` with no other option, including `switch -- <branch>`.
// undefined: not that form, so the caller keeps the revision or path rules. On a clean worktree
// the files that differ arrive with the branch: they are index entries, where a protected path
// still denies, and not worktree writes. A dirty tree still lists those files as writes.
function plainBranch(repo: Repo, parsed: { flags: string[]; operands: string[]; paths: string[] | null }, dashNamesBranch: boolean): Change | undefined {
  const { flags, operands, paths } = parsed;
  if (flags.length !== 0) return undefined;
  const name = paths === null ? (operands.length === 1 ? operands[0] : undefined)
    : dashNamesBranch && operands.length === 0 && paths.length === 1 ? paths[0] : undefined;
  if (name === undefined) return undefined;
  const commit = repo.branchCommit(name);
  if (commit === null) return undefined;
  if (!repo.clean()) return moved(repo, commit, false);
  return { worktree: [], index: differ(repo, commit) };
}

function differ(repo: Repo, commit: string): string[] {
  const head = repo.commit("HEAD");
  return head === null ? repo.names(["ls-tree", "-r", "--name-only", commit]) : repo.between(head, commit);
}

// A name Git can store as a branch, and not `HEAD`. Used only to find one remote-tracking ref.
function oneRemoteName(top: string, name: string): boolean {
  if (name === "" || name === "HEAD" || name.includes("\\") || name.startsWith("-")) return false;
  return git(top, ["check-ref-format", "--branch", name])?.trim() === name;
}

// `stash` / `stash push` / `stash save` reverts local changes (and untracked files with -u, ignored
// ones too with -a); `stash pop|apply|branch` writes the stashed files back.
function stash(repo: Repo, rest: string[]): Change | null {
  const sub = rest[0] !== undefined && !rest[0].startsWith("-") ? rest[0] : "push";
  const args = sub === rest[0] ? rest.slice(1) : rest;
  if (["list", "show", "drop", "clear", "create", "store"].includes(sub)) return NONE;
  const { flags, operands } = options(args, ["-m", "--message", "--pathspec-from-file"]);
  if (sub === "push" || sub === "save") {
    if (flags.includes("--pathspec-from-file")) return null;
    const staged = has(flags, "-S", "--staged") ? repo.names(["diff", "--name-only", "--cached", "HEAD"]) : repo.dirty();
    const untracked = has(flags, "-a", "--all") ? repo.untracked("also") : has(flags, "-u", "--include-untracked") ? repo.untracked("no") : [];
    const all = [...staged, ...untracked];
    return { worktree: all, index: staged };
  }
  if (sub === "pop" || sub === "apply" || sub === "branch") {
    const ref = (sub === "branch" ? operands[1] : operands[0]) ?? "stash@{0}";
    const commit = repo.commit(ref);
    if (commit === null) return null;
    const files = repo.between(`${commit}^1`, commit);
    const untracked = repo.commit(`${commit}^3`) === null ? [] : repo.names(["ls-tree", "-r", "--name-only", `${commit}^3`]);
    const base = sub === "branch" && repo.commit("HEAD") !== null ? repo.between("HEAD", `${commit}^1`) : [];
    const all = [...files, ...untracked, ...base];
    return { worktree: all, index: all };
  }
  return null;
}

// `clean -f` deletes untracked files below its pathspecs; -x ignored ones too, -X only those.
function clean(repo: Repo, rest: string[]): Change | null {
  const { flags, operands, paths } = options(rest, ["-e", "--exclude"]);
  if (has(flags, "-i", "--interactive")) return null;
  if (has(flags, "-n", "--dry-run") || !has(flags, "-f", "--force")) return NONE;
  const specs = [...(paths ?? []), ...operands];
  return { worktree: repo.untracked(has(flags, "-X") ? "only" : has(flags, "-x") ? "also" : "no", specs), index: [] };
}

// Each picked or reverted commit's own changes are applied to the worktree and the index.
function pick(repo: Repo, rest: string[]): Change | null {
  const { flags, operands } = options(rest, ["-m", "--mainline", "-X", "--strategy-option", "--strategy", "--cleanup", "-S", "--gpg-sign"]);
  if (flags.includes("--quit")) return NONE;
  if (flags.some((f) => ["--continue", "--skip", "--abort"].includes(f)) || operands.length === 0) return null;
  const listed = git(repo.top, ["rev-list", "--no-walk", "--end-of-options", ...operands]);
  if (listed === null) return null;
  const all = listed.split("\n").filter((c) => c !== "").flatMap((c) =>
    repo.names(["diff-tree", "-r", "--root", "--no-commit-id", "--name-only", "--no-renames", "-m", "--first-parent", c]));
  return { worktree: all, index: all };
}

// `read-tree <tree>` replaces the index; with -u it also updates the worktree.
function readTree(repo: Repo, rest: string[]): Change | null {
  const { flags, operands } = options(rest, ["--index-output"]);
  if (flags.some((f) => /^--(prefix|index-output|super-prefix)/.test(f))) return null;
  if (operands.length !== 1 && !flags.includes("--empty")) return null;
  const index = flags.includes("--empty") ? repo.names(["ls-files"]) : (() => {
    const tree = repo.tree(operands[0]!);
    if (tree === null) throw new Error("unknown tree");
    return repo.names(["diff-index", "--cached", "--name-only", "--no-renames", tree, "--"]);
  })();
  const updates = has(flags, "-u");
  const worktree = updates ? [...index, ...repo.names(["diff", "--name-only"])] : [];
  return { worktree, index };
}

// `checkout-index -a` writes every missing file, and with -f every changed one; listed paths alike.
function checkoutIndex(repo: Repo, rest: string[]): Change | null {
  const { flags, operands, paths } = options(rest);
  if (flags.some((f) => /^--(prefix|stdin|temp)/.test(f) || f === "-z")) return null;
  if (has(flags, "-n", "--no-create")) return NONE;
  const all = has(flags, "-a", "--all");
  const listed = [...(paths ?? []), ...operands].map((p) => join(repo.cwd, p));
  const force = has(flags, "-f", "--force");
  const files = all ? (force ? repo.names(["diff", "--name-only"]) : repo.names(["ls-files", "--deleted"])) : listed;
  return { worktree: files, index: [] };
}
