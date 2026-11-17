// Git facts for the maintainability proxies. This module is a shell adapter:
// the core checks receive the lists and counts, and stay quiet when Git cannot answer.
import { git } from "./git.ts";
import { changed } from "./workspace.ts";

// Tracked edits plus untracked files. null: Git could not list the diff.
export function worktreePaths(root: string): string[] | null {
  const head = git(root, ["rev-parse", "--verify", "-q", "HEAD"]);
  const listed = changed(root, head === null
    ? ["ls-files", "-z", "--", "."]
    : ["diff", "--name-only", "--relative", "--no-renames", "-z", "HEAD", "--", "."]);
  const fresh = changed(root, ["ls-files", "--others", "--exclude-standard", "-z", "--", "."]);
  if (listed === null || fresh === null) return null;
  return [...new Set([...listed, ...fresh])];
}

export function commitCounts(root: string): (rel: string) => number | null {
  const cache = new Map<string, number | null>();
  return (rel) => {
    const known = cache.get(rel);
    if (known !== undefined) return known;
    const out = git(root, ["rev-list", "--count", "HEAD", "--", rel]);
    const parsed = out === null ? null : Number(out.trim());
    const value = parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
    cache.set(rel, value);
    return value;
  };
}
