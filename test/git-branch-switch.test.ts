import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gitChanges } from "../src/git-changes.ts";
import { inScope, pathKey, protectedGlobs, protects, scopeUnder, slash } from "../src/paths.ts";
import { guard } from "../src/shell.ts";
import type { Cause, Lock } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

// Issue 98: a plain checkout or switch of a branch that already exists is not a worktree write
// when the worktree is clean. Dirty trees, force, detach, new branches, commits, tags, and
// path checkouts stay writes. A protected path on the branch still denies.

const area = realpathSync(mkdtempSync(join(tmpdir(), "pregate-branch-switch-")));
const dir = join(area, "repo");
const scope = { include: ["src/**", "test/**"], exclude: [] } as Lock["scope"];

function runGit(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed\n${result.stderr.toString()}`);
  return result.stdout.toString();
}

function init(cwd: string): void {
  mkdirSync(cwd, { recursive: true });
  runGit(cwd, "init", "-q", "-b", "main");
  runGit(cwd, "config", "user.email", "t@example.com");
  runGit(cwd, "config", "user.name", "Test");
  runGit(cwd, "config", "commit.gpgsign", "false");
  runGit(cwd, "config", "core.autocrlf", "false");
}

function put(cwd: string, rel: string, text: string): void {
  mkdirSync(dirname(join(cwd, rel)), { recursive: true });
  writeFileSync(join(cwd, rel), text);
}

function commitAll(cwd: string, message: string): void {
  runGit(cwd, "add", "-A");
  runGit(cwd, "commit", "-qm", message);
}

function context(root: string) {
  const globs = protectedGlobs(root, [], { home: join(area, "home"), data: join(area, "data"), engine: join(area, "engine") });
  const relOf = (abs: string): string | null => {
    const path = slash(abs);
    const base = slash(root).replace(/\/+$/, "");
    const key = pathKey(path);
    const rootKey = pathKey(base);
    if (key === rootKey) return "";
    if (!key.startsWith(`${rootKey}/`)) return null;
    return path.slice(base.length + 1);
  };
  return {
    machineOnly: false, harness: "agy" as const, touched: () => true, launcher: null, gitChanges,
    isProtected: (abs: string) => protects(abs, globs),
    inScope: (abs: string) => {
      const rel = relOf(abs);
      return rel !== null && inScope({ scope } as Lock, rel);
    },
    under: (abs: string) => {
      const rel = relOf(abs);
      return rel !== null && scopeUnder({ scope } as Lock, rel);
    },
  };
}

function judge(root: string, command: string): Cause | null {
  return guard(command, root, context(root));
}

function cleanAt(branch = "main"): void {
  runGit(dir, "checkout", "-qf", branch);
  runGit(dir, "clean", "-qfd");
}

beforeAll(() => {
  init(dir);
  put(dir, "src/a.ts", "export const a = 1;\n");
  put(dir, "README.md", "base\n");
  put(dir, ".pregate/preset.json", "{\"name\":\"base\"}\n");
  commitAll(dir, "init");
  runGit(dir, "checkout", "-q", "-b", "tutorial");
  put(dir, "src/a.ts", "export const a = 2;\n");
  commitAll(dir, "tutorial");
  runGit(dir, "checkout", "-q", "main");
  runGit(dir, "checkout", "-q", "-b", "docs");
  put(dir, "README.md", "docs\n");
  commitAll(dir, "docs");
  runGit(dir, "checkout", "-q", "main");
  runGit(dir, "checkout", "-q", "-b", "contract");
  put(dir, ".pregate/preset.json", "{\"name\":\"other\"}\n");
  commitAll(dir, "contract");
  runGit(dir, "checkout", "-q", "main");
  runGit(dir, "tag", "v1", "tutorial");
});

afterEach(() => cleanAt());
afterAll(() => removeTree(area));

test("a clean switch or checkout of an existing local branch is not a write", () => {
  const arrived = gitChanges(dir, ["switch", "tutorial"]);
  expect(arrived?.worktree).toEqual([]);
  expect(arrived?.index.some((path) => slash(path).endsWith("src/a.ts"))).toBe(true);
  for (const command of ["git switch tutorial", "git checkout tutorial", "git switch -- tutorial", "git switch docs", "git checkout docs", "git switch main", "git checkout -b side"]) {
    expect(judge(dir, command), command).toBeNull();
  }
});

test("a clean checkout of a branch that changes .pregate is protected-path", () => {
  expect(judge(dir, "git switch contract")).toBe("protected-path");
  expect(judge(dir, "git checkout contract")).toBe("protected-path");
});

test("detach, force, a new branch, a commit, and a tag stay writes", () => {
  const sha = runGit(dir, "rev-parse", "tutorial").trim();
  for (const command of [
    "git switch --detach tutorial", "git checkout --detach tutorial", `git checkout ${sha}`, `git switch --detach ${sha}`,
    "git checkout v1", "git switch -f tutorial", "git checkout -f tutorial", "git switch --discard-changes tutorial",
    "git switch -c other tutorial", "git checkout -b other tutorial", "git switch -q tutorial", "git reset --hard tutorial",
  ]) expect(judge(dir, command), command).toBe("shell-write");
});

test("a path checkout stays a write on a clean tree", () => {
  for (const command of ["git checkout -- src/a.ts", "git checkout src/a.ts", "git checkout tutorial -- src/a.ts", "git checkout -- .", "git restore src/a.ts"]) {
    expect(judge(dir, command), command).toBe("shell-write");
  }
});

test("a dirty worktree keeps the branch switch a write", () => {
  put(dir, "src/a.ts", "export const a = 3;\n");
  expect(judge(dir, "git switch tutorial")).toBe("shell-write");
  expect(judge(dir, "git checkout tutorial")).toBe("shell-write");
  // The dirty file is not part of the docs diff, so that switch does not rewrite it.
  expect(judge(dir, "git switch docs")).toBeNull();
  cleanAt();
  put(dir, "src/extra.ts", "export const extra = 1;\n");
  expect(judge(dir, "git switch tutorial")).toBe("shell-write");
  cleanAt();
  put(dir, "src/a.ts", "export const a = 3;\n");
  runGit(dir, "add", "src/a.ts");
  expect(judge(dir, "git checkout tutorial")).toBe("shell-write");
  expect(judge(dir, "git reset --hard")).toBe("shell-write");
  expect(judge(dir, "git stash")).toBe("shell-write");
});

test("switching back to the previous local branch is an arrival", () => {
  cleanAt("tutorial");
  expect(judge(dir, "git switch -")).toBeNull();
  expect(judge(dir, "git checkout -")).toBeNull();
});

test("the single remote-tracking branch of that name is an existing branch", () => {
  const origin = join(area, "origin");
  const other = join(area, "other");
  const work = join(area, "work");
  init(origin);
  put(origin, "src/a.ts", "export const a = 1;\n");
  put(origin, "README.md", "base\n");
  put(origin, ".pregate/preset.json", "{\"name\":\"base\"}\n");
  commitAll(origin, "init");
  runGit(origin, "checkout", "-q", "-b", "tutorial");
  put(origin, "src/a.ts", "export const a = 2;\n");
  commitAll(origin, "tutorial");
  runGit(origin, "checkout", "-q", "main");
  runGit(origin, "checkout", "-q", "-b", "feature/tutorial");
  put(origin, "src/a.ts", "export const a = 4;\n");
  commitAll(origin, "feature");
  runGit(origin, "checkout", "-q", "main");
  runGit(area, "clone", "-q", origin, work);
  runGit(work, "config", "user.email", "t@example.com");
  runGit(work, "config", "user.name", "Test");
  expect(judge(work, "git switch tutorial")).toBeNull();
  expect(judge(work, "git checkout tutorial")).toBeNull();
  expect(judge(work, "git switch feature/tutorial")).toBeNull();
  put(work, "src/a.ts", "export const a = 9;\n");
  expect(judge(work, "git switch tutorial")).toBe("shell-write");
  runGit(work, "checkout", "-qf", "main");
  runGit(work, "clean", "-qfd");
  init(other);
  put(other, "src/a.ts", "export const a = 1;\n");
  commitAll(other, "init");
  runGit(other, "checkout", "-q", "-b", "tutorial");
  put(other, "src/a.ts", "export const a = 5;\n");
  commitAll(other, "tutorial");
  runGit(work, "remote", "add", "other", other);
  runGit(work, "fetch", "-q", "other");
  // Two remotes: not one branch. `switch` cannot name a path, so it stays unknown.
  // `checkout` falls through to a path checkout of `tutorial`, which is outside src/.
  expect(gitChanges(work, ["switch", "tutorial"])).toBeNull();
  expect(judge(work, "git switch tutorial")).toBe("shell-write");
  const ambiguous = gitChanges(work, ["checkout", "tutorial"]);
  expect(ambiguous?.index ?? []).toEqual([]);
  expect((ambiguous?.worktree ?? []).some((path) => slash(path).endsWith("src/a.ts"))).toBe(false);
});
