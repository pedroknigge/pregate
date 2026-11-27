// Prepares the frozen reference checkout the macOS latency merge gate interleaves (§8): fetch the
// tag, add a detached worktree, and install its dependencies. A fetch, worktree or install that
// does not produce a checkout fails the step, like CI's "Compiled Pre hook latency" job.
// Usage: bun run scripts/latency-ref.ts <worktree-dir> <tag>
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

function main(): number {
  const [ref, tag] = process.argv.slice(2);
  if (!ref || !tag || process.argv.length !== 4) {
    console.error("usage: latency-ref.ts <worktree-dir> <tag>");
    return 2;
  }
  const git = (...args: string[]): number => {
    const r = Bun.spawnSync(["git", "-C", ROOT, ...args], { stdout: "pipe", stderr: "pipe" });
    if (r.exitCode !== 0) console.error(r.stderr.toString().trim());
    return r.exitCode ?? 1;
  };
  if (existsSync(ref)) {
    git("worktree", "remove", "--force", ref);
    rmSync(ref, { recursive: true, force: true });
  }
  if (git("fetch", "--no-tags", "--depth", "1", "origin", `refs/tags/${tag}:refs/tags/${tag}`) !== 0) return 1;
  if (git("worktree", "add", "--detach", ref, tag) !== 0) return 1;
  const install = Bun.spawnSync([process.execPath, "install", "--frozen-lockfile"], { cwd: ref, stdout: "pipe", stderr: "pipe" });
  if (install.exitCode !== 0) {
    console.error(install.stderr.toString().trim());
    return 1;
  }
  return 0;
}

process.exit(main());
