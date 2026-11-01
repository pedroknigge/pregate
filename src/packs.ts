import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonical, listChecks } from "./compile.ts";
import { dataHome } from "./consent.ts";
import { readTree, writeAtomic } from "./disk.ts";
import { testCheck } from "./fixtures.ts";
import { git } from "./git.ts";
import { sha256 } from "./state.ts";
import type { Clock, Files, GitSource } from "./types.ts";

function index(url: string, ref: string): string {
  return join(dataHome(), "packs/pins", sha256(JSON.stringify([url, ref])) + ".json");
}

// Cache reads never resolve a moving ref or contact the remote.
export function cachedPack(source: GitSource & { hash?: string }): Files | null {
  return cachedPackEntry(source)?.files ?? null;
}

// The pinned pack with the data-tree hash its bytes were verified against.
export function cachedPackEntry(source: GitSource & { hash?: string }): { files: Files; hash: string } | null {
  if (typeof source.url !== "string" || typeof source.ref !== "string") return null;
  const pin = index(source.url, source.ref);
  if (!/^[0-9a-f]{40}$/.test(source.ref) || !existsSync(pin)) return null;
  const hash = JSON.parse(readFileSync(pin, "utf8")) as string;
  if (!/^[0-9a-f]{64}$/.test(hash) || (source.hash !== undefined && source.hash !== hash)) return null;
  const dir = join(dataHome(), "packs/objects", hash);
  if (!existsSync(dir)) return null;
  const files = readTree(dir, true);
  return sha256(canonical(files)) === hash ? { files, hash } : null;
}

export function testPack(files: Files, now: Clock): string[] {
  const listed = listChecks(files);
  if ("errors" in listed) return listed.errors;
  return listed.ids.flatMap((id) => {
    const run = testCheck(files, id, now);
    return run.ok ? [] : run.lines.filter((line) => !line.startsWith("ok"));
  });
}

type PackPin = { ns: string; hash: string };

export function fetchPack(url: string, ref: string, now: Clock, expected?: PackPin): GitSource | { errors: string[] } {
  const temp = join(dataHome(), "packs/fetch", `${process.pid}-${Date.now()}`);
  mkdirSync(temp, { recursive: true });
  return fetchInto(temp, url, ref, now, expected);
}

function fetchInto(temp: string, url: string, ref: string, now: Clock, expected?: PackPin): GitSource | { errors: string[] } {
  try {
    if (url.includes("::") || url.startsWith("-") || ref.startsWith("-")) return { errors: ["Unsafe Git URL or ref."] };
    const cloned = Bun.spawnSync(["git", "-c", "core.hooksPath=/dev/null", "-c", "protocol.ext.allow=never", "clone", "--bare", "--", url, temp],
      { stdin: "ignore", stdout: "ignore", stderr: "pipe", timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    if (cloned.exitCode !== 0) return { errors: [cloned.stderr.toString().trim() || "Git fetch failed."] };
    const commit = git(temp, ["rev-parse", "--verify", `${ref}^{commit}`])?.trim();
    if (!commit || !/^[0-9a-f]{40}$/.test(commit)) return { errors: [`Git ref ${ref} is not a commit.`] };
    const files = gitFiles(temp, commit);
    if (files === null) return { errors: ["Pack contains a symlink, submodule or unreadable file."] };
    const errors = testPack(files, now);
    if (errors.length) return { errors };
    const ns = (JSON.parse(files["source.json"]!) as { ns: string }).ns;
    const hash = sha256(canonical(files));
    if (expected && (ns !== expected.ns || hash !== expected.hash)) return { errors: ["Pinned pack namespace or content hash differs; cache and contract unchanged."] };
    const dir = join(dataHome(), "packs/objects", hash);
    if (!existsSync(dir)) for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeAtomic(join(dir, path), text);
    }
    mkdirSync(dirname(index(url, commit)), { recursive: true });
    writeAtomic(index(url, commit), JSON.stringify(hash));
    return { ns, kind: "git", url, ref: commit };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

function gitFiles(repo: string, commit: string): Files | null {
  const listing = git(repo, ["ls-tree", "-rz", "--full-tree", commit]);
  if (listing === null) return null;
  const files: Files = {};
  for (const entry of listing.split("\0").filter(Boolean)) {
    const match = /^100(?:644|755) blob ([0-9a-f]{40})\t(.+)$/.exec(entry);
    if (!match) return null;
    const path = match[2]!;
    if (path.split("/").some((p) => ["..", ".", ".git"].includes(p)) || /[\\\r\n]/.test(path)) return null;
    const content = git(repo, ["cat-file", "blob", match[1]!]);
    if (content === null) return null;
    files[path] = content;
  }
  return files;
}
