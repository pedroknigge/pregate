import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { enabled } from "./consent.ts";
import { canonical, findRoot } from "./disk.ts";
import { catFileBatch, git, gitFailure, gitInput, repositoryFailure } from "./git.ts";
import { isCause, PRESET, readText } from "./admission.ts";
import { grammarOf } from "./languages.ts";
import { pathKey } from "./paths.ts";
import { normalize } from "./reconstruct.ts";
import * as state from "./state.ts";
import type { BaselineRead, Cause, Read, Snapshot } from "./types.ts";

const SKIP = new Set([".git", ".pregate", "node_modules", ".claude", ".cursor", ".codex", ".grok", ".gemini", "dist", "build", ".venv", "venv", "__pycache__"]);

// base: what the edit window is measured against (Pre: the file on disk; Stop and check: before).
export interface FileState { rel: string; base: string | null; before: string | null; after: string | null }
// What a call's other files will hold (null: deleted), by lowercased absolute path (A26, MH-09).
export type Overlay = Map<string, string | null>;
export type StagedOrBaseMode = { kind: "staged" } | { kind: "base"; sha: string };

export function workspaceFile(rel: string, tracked = false): boolean {
  return !rel.split("/").some((part) => SKIP.has(part) && !(tracked && part === "build"));
}

// A directory name is not proof that tracked code is generated. Git ownership admits
// build scripts/fixtures, while dependency, environment and protected directories stay excluded.
export function trackedWorkspacePaths(root: string): string[] {
  if (!hasRepository(root)) return [];
  const listed = git(root, ["ls-files", "--cached", "-z"]);
  if (listed === null) throw new Error("Git could not inventory this repository; fix Git before inspecting source coverage.");
  return [...new Set(listed.split("\0").filter(rel => rel && workspaceFile(rel, true)))].sort();
}

// Project paths only (no contents) for cheap, advisory checks such as dead-glob warnings; null
// when Git or the file system cannot list them, so the caller drops the advisory instead of failing.
export function listedPaths(root: string): string[] | null {
  if (hasRepository(root)) {
    const listed = git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]);
    return listed === null ? null : listed.split("\0").filter(rel => rel && workspaceFile(rel, true));
  }
  try { return workspacePaths(root, () => true); }
  catch { return null; }
}

export function workspaceRegularFile(root: string, rel: string): boolean {
  return regularPath(root, rel.split("/"));
}

function regularPath(root: string, parts: string[]): boolean {
  try {
    for (let i = 1; i <= parts.length; i++) {
      const stat = lstatSync(join(root, ...parts.slice(0, i)));
      if (i === parts.length ? !stat.isFile() : !stat.isDirectory()) return false;
    }
    return true;
  } catch (e) {
    if (["ENOENT", "ENOTDIR"].includes((e as NodeJS.ErrnoException).code ?? "")) return false;
    throw e;
  }
}

// Detect repository ownership without confusing an unavailable/broken git binary with standalone mode.
export function hasRepository(root: string): boolean {
  for (let dir = root; ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".git"))) return true;
    if (dirname(dir) === dir) return false;
  }
}

// Resolution depends on code (including barrels) and JSON (including extended configs and exports).
export function contextFile(rel: string): boolean {
  return grammarOf(rel) !== null || rel.endsWith(".json") || /(^|\/)(go\.(mod|work)|Cargo\.toml|\.cargo\/config(?:\.toml)?)$/.test(rel);
}

export function workspacePaths(root: string, keep: (rel: string) => boolean = contextFile): string[] {
  const paths: string[] = [];
  let hasBuild = false;
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      if (entry.name === "target" && entry.isDirectory() && existsSync(join(root, rel, "Cargo.toml"))) continue;
      if (SKIP.has(entry.name)) {
        hasBuild ||= entry.name === "build" && entry.isDirectory();
        continue;
      }
      const path = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && keep(path)) paths.push(path);
    }
  };
  walk("");
  const tracked = hasBuild ? trackedWorkspacePaths(root).filter(rel => rel.split("/").includes("build") && keep(rel) && workspaceRegularFile(root, rel)) : [];
  return [...new Set([...paths, ...tracked])].sort();
}

// Candidates: changed since the snapshot's HEAD, untracked, and dirty at session start. Their
// "before" comes from the snapshot's blobs or from one cat-file for all of them (A24).
export function stopFiles(sid: string, snap: Snapshot): FileState[] | Cause {
  const root = snap.root;
  if (!hasRepository(root)) {
    const files: FileState[] = [];
    const paths = owned(root, [...new Set([...workspacePaths(root), ...Object.keys(snap.dirty)])], accepted(sid));
    for (const rel of paths) {
      const before = state.beforeText(sid, snap, rel);
      if (isCause(before)) return before;
      files.push({ rel, base: before, before, after: textOf(readText(join(root, rel))) });
    }
    return files;
  }
  const trackedPaths = snap.head === null ? ["ls-files", "-z", "--", "."] : ["diff", "--name-only", "--relative", "--no-renames", "-z", snap.head, "--", "."];
  const listed = changed(root, trackedPaths);
  const fresh = changed(root, ["ls-files", "--others", "--exclude-standard", "-z", "--", "."]);
  if (listed === null || fresh === null) return gitFailure();
  const arrived = arrivedWithHead(sid, snap);
  const rels = owned(root, [...new Set([...listed, ...fresh, ...Object.keys(snap.dirty)])].sort(), accepted(sid)).filter((rel) => !arrived.has(rel));
  const fromHead = rels.filter((rel) => !Object.hasOwn(snap.dirty, rel));
  const heads = snap.head === null ? fromHead.map(() => null) : catFileBatch(root, fromHead.map((rel) => `${snap.head}:./${rel}`));
  if (heads === null) return gitFailure();
  // A rename's absent source is not a deleted file (issue #61). The destination
  // keeps that baseline, so assertion counts compare the moved test with itself.
  // A source that still exists is a new file at the old path and stays in review.
  const moved = renamedSince(snap);
  const reviewed = new Set(rels);
  const renamedAway = new Set([...moved].filter(([dest]) => reviewed.has(dest)).map(([, source]) => source));
  const files: FileState[] = [];
  for (const rel of rels) {
    if (renamedAway.has(rel) && readText(join(root, rel)) === null) continue;
    const k = fromHead.indexOf(rel);
    let before = k >= 0 ? heads[k] ?? null : state.beforeText(sid, snap, rel);
    if (before === null && moved.has(rel)) before = state.beforeText(sid, snap, moved.get(rel)!);
    if (isCause(before)) return before;
    files.push({ rel, base: before, before, after: textOf(readText(join(root, rel))) });
  }
  return files;
}

// HEAD moved since the snapshot, or a merge is in progress: a checkout or merge of a branch that
// already existed brings work of others. A file came with it, not from this session, when no
// commit made after the snapshot is charged for it (commits no tip recorded then reaches), its
// working copy equals the new HEAD (or the incoming MERGE_HEAD), it was not dirty at the start and
// no edit tool of this session wrote it. Commits made or fetched during the session stay the
// session's to answer for, or to adopt with a session rebase: a merge of a base fetched
// mid-session is still charged whole.
export function arrivedWithHead(sid: string, snap: Snapshot): Set<string> {
  const root = snap.root;
  const head = git(root, ["rev-parse", "--verify", "-q", "HEAD"])?.trim() ?? null;
  if (snap.head === null || snap.tips === undefined || head === null) return new Set();
  const incoming = mergeHead(root);
  const still = head === snap.head;
  const prefix = still && incoming === null ? null : git(root, ["rev-parse", "--show-prefix"])?.trim();
  if (prefix === null || prefix === undefined) return new Set();
  const repo: History = { root, prefix, tips: snap.tips };
  const moved = still ? [] : names(root, snap.head, head);
  const dirty = names(root, "HEAD");
  const fresh = still ? [] : sessionPaths(repo, head);
  if (moved === null || dirty === null || fresh === null) return new Set();
  const charged = new Set([...fresh, ...Object.keys(snap.dirty)]);
  const edited = state.editedPaths(sid);
  const candidates = [...moved.filter((rel) => !dirty.includes(rel)), ...arrivedWithMerge(repo, head, incoming)];
  return new Set(candidates.filter((rel) => !charged.has(rel) && !edited.has(pathKey(join(root, rel)))));
}

// The repository as Stop attributes it: `prefix` is root relative to the top level, `tips` the
// commits that existed at the snapshot.
interface History { root: string; prefix: string; tips: string[] }

// Merges whose second side existed at the snapshot get the per-side rule, up to this many per
// Stop; the rest are charged whole (fail-closed), which bounds Stop latency.
const SIDE_MERGES = 32;

// Paths changed between two revisions, or between a revision and the working tree.
function names(root: string, ...revs: string[]): string[] | null {
  return changed(root, ["diff", "--name-only", "--relative", "--no-renames", "-z", ...revs, "--", "."]);
}

// The same over the whole repository, named from its top level.
function topNames(root: string, ...revs: string[]): Set<string> | null {
  const out = changed(root, ["diff", "--name-only", "--no-relative", "--no-renames", "-z", ...revs, "--", ":/"]);
  return out === null ? null : new Set(out);
}

function underRoot(repo: History, paths: Iterable<string>): string[] {
  return [...paths].filter((p) => p.startsWith(repo.prefix)).map((p) => p.slice(repo.prefix.length));
}

// Paths the commits `head --not tips` answer for: each plain commit whole; a merge whose second
// parent existed at the snapshot by mergeCharge; any other merge by its first-parent diff. One
// rev-list lists every commit with its parents. null when git fails, so nothing is treated as arrived.
function sessionPaths(repo: History, head: string): string[] | null {
  const { root, tips } = repo;
  const plain = changed(root, ["log", "--format=", "--name-only", "--relative", "--no-renames", "--no-merges", "-z", head, "--not", ...tips, "--", "."]);
  const listed = git(root, ["rev-list", "--parents", head, "--not", ...tips]);
  if (plain === null || listed === null) return null;
  const rows = listed.split("\n").filter((row) => row !== "").map((row) => row.split(" "));
  const session = new Set(rows.map((row) => row[0]!));
  const merges = rows.filter((row) => row.length > 2);
  const sided = merges.filter((row) => row.length === 3 && !session.has(row[2]!)).slice(0, SIDE_MERGES);
  const whole = firstParentPaths(root, merges.filter((row) => !sided.includes(row)));
  if (whole === null) return null;
  const out = new Set([...plain, ...whole]);
  for (const [merge, ours, theirs] of sided) {
    const charged = mergeCharge(repo, merge!, ours!, theirs!);
    if (charged === null) return null;
    charged.forEach((rel) => out.add(rel));
  }
  return [...out];
}

// The first-parent diffs of `rows` ([merge, first parent, …]) in one spawn.
function firstParentPaths(root: string, rows: string[][]): string[] | null {
  if (rows.length === 0) return [];
  const input = rows.map(([merge, first]) => `${merge} ${first}\n`).join("");
  return gitInput(root, ["diff-tree", "--stdin", "-r", "--no-commit-id", "--name-only", "--relative", "--no-renames", "-z", "--", "."], input)?.split("\0").filter((p) => p !== "") ?? null;
}

// A two-parent merge M charges its first-parent diff minus sideArrivals: a file arrives only when
// M took the second parent's blob verbatim, the first parent left it as the merge base had it, and
// M brought the second side faithfully. A take-theirs resolution of a file the first parent
// changed stays charged, and so does a file both sides changed that merged cleanly (conservative).
// `--diff-merges=combined` is not used: it drops files taken verbatim from one side. A squash
// merge is a plain commit: charged.
function mergeCharge(repo: History, merge: string, ours: string, theirs: string): string[] | null {
  const first = topNames(repo.root, ours, merge);
  if (first === null) return null;
  const arrived = new Set(sideArrivals(repo.root, ours, theirs, merge) ?? []);
  return underRoot(repo, [...first].filter((p) => !arrived.has(p)));
}

// A merge in progress whose incoming commits all existed at the snapshot: the files it brought
// verbatim from MERGE_HEAD, judged against the working tree.
function arrivedWithMerge(repo: History, head: string, incoming: string | null): string[] {
  if (incoming === null || git(repo.root, ["rev-list", "-n", "1", incoming, "--not", ...repo.tips]) !== "") return [];
  return underRoot(repo, sideArrivals(repo.root, head, incoming, null) ?? []);
}

// The files (top-level paths) only the second side changed since the sole merge base, when
// `result` (a commit, or the working tree for null) holds every one of them as the second side
// has it. Taking only some of them is a selective import, not a merge: then null, and nothing
// arrived. null too for several merge bases or a git failure.
function sideArrivals(root: string, ours: string, theirs: string, result: string | null): string[] | null {
  const bases = git(root, ["merge-base", "--all", ours, theirs])?.trim().split("\n") ?? [];
  if (bases.length !== 1 || bases[0] === "") return null;
  const side = topNames(root, bases[0]!, theirs);
  const mine = topNames(root, bases[0]!, ours);
  const kept = result === null ? topNames(root, theirs) : topNames(root, theirs, result);
  if (side === null || mine === null || kept === null) return null;
  const only = [...side].filter((p) => !mine.has(p));
  return only.some((p) => kept.has(p)) ? null : only;
}

// The commit a merge in progress brings: the first id in the MERGE_HEAD pseudoref file. A branch
// named MERGE_HEAD is not a merge in progress, so rev-parse of the name is not used.
function mergeHead(root: string): string | null {
  const path = git(root, ["rev-parse", "--git-path", "MERGE_HEAD"])?.trim();
  const id = path ? readText(resolve(root, path))?.split("\n")[0]?.trim() : undefined;
  if (id === undefined || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(id)) return null;
  return git(root, ["rev-parse", "-q", "--verify", `${id}^{commit}`])?.trim() || null;
}

// The pre-check: stdin against HEAD (§7.2 #6), its edit window against the file on disk.
export function stdinFile(root: string, rel: string, text: string): FileState[] | Cause {
  if (!hasRepository(root)) return repositoryFailure(root) ?? "git-not-repository";
  const head = catFileBatch(root, [`HEAD:./${rel}`]);
  if (head === null) return gitFailure();
  return [{ rel, base: readText(join(root, rel)), before: head[0] ?? null, after: normalize(text) }];
}

// pre-commit: the index against HEAD. CI: the working tree against the merge base.
export function changes(root: string, m: StagedOrBaseMode): FileState[] | Cause {
  const head = git(root, ["rev-parse", "--verify", "-q", "HEAD"])?.trim() ?? null;
  const base = m.kind === "staged" ? head : git(root, ["merge-base", m.sha, "HEAD"])?.trim() ?? null;
  if (m.kind === "base" && base === null) return gitFailure();
  const diff = ["diff", "--name-only", "--relative", "--no-renames", "-z", ...(m.kind === "staged" ? ["--cached"] : [])];
  const listed = changed(root, base === null ? ["ls-files", "-z", "--", "."] : [...diff, base, "--", "."]);
  const fresh = m.kind === "staged" ? [] : changed(root, ["ls-files", "--others", "--exclude-standard", "-z", "--", "."]);
  if (listed === null || fresh === null) return gitFailure();
  const rels = owned(root, [...new Set([...listed, ...fresh])].sort(), tracked);
  const befores = base === null ? [] : rels.map((rel) => `${base}:./${rel}`);
  const texts = catFileBatch(root, [...befores, ...(m.kind === "staged" ? rels.map((rel) => `:./${rel}`) : [])]);
  if (texts === null) return gitFailure();
  return rels.map((rel, k) => {
    const before = base === null ? null : texts[k] ?? null;
    const after = m.kind === "staged" ? texts[befores.length + k] ?? null : readText(join(root, rel));
    return { rel, base: before, before, after: textOf(after) };
  });
}

// §4.1 step 4: a file below a nested accepted root is that root's, and only its lock judges it.
export function owned(root: string, rels: string[], isAccepted: (dir: string) => boolean): string[] {
  const seen = new Map<string, boolean>();
  const ok = (d: string): boolean => {
    if (!seen.has(d)) seen.set(d, d === root || isAccepted(d));
    return seen.get(d)!;
  };
  return rels.filter((rel) => findRoot(dirname(join(root, rel)), ok) === root);
}

// Windows file times can sit a little ahead of Date.now(). Only the first contact, which has no
// earlier session timestamp, allows that skew: a preset already on disk is the initialized project.
const FIRST_CONTACT_SKEW_MS = 2000;

// MH-33: a root is accepted when this session already took its snapshot, when its preset predates
// the session's first contact with any root (this very call, on a first contact), or when it is
// tracked in HEAD. A preset created later, through a channel the guard does not see, cannot loosen
// a root.
export function accepted(sid: string): (dir: string) => boolean {
  let since: number | undefined;
  let first = false;
  return (d) => {
    if (!enabled(d)) return false;
    if (since === undefined) {
      const saved = state.firstContact(sid);
      first = saved === null;
      since = saved ?? Date.now();
    }
    const preset = statSync(join(d, PRESET), { throwIfNoEntry: false });
    const present = preset !== undefined && preset.ctimeMs < since + (first ? FIRST_CONTACT_SKEW_MS : 0);
    return state.snapshot(sid, d) !== null || present || tracked(d);
  };
}

export function tracked(dir: string): boolean {
  // `HEAD:./.pregate/...` is a revision, but Git for Windows can treat the colon as a drive
  // separator and then miss a preset that is actually at HEAD. `HEAD:<path>` is the same object.
  return git(dir, ["cat-file", "-e", `HEAD:${PRESET}`]) !== null
    || git(dir, ["cat-file", "-e", `HEAD:./${PRESET}`]) !== null;
}

export function changed(root: string, args: string[]): string[] | null {
  return git(root, args)?.split("\0").filter((p) => p !== "") ?? null;
}

// pre-commit resolves imports against the index, the tree being committed; the rest against disk.
export function reader(root: string, staged = false): Read {
  if (!staged) return (rel) => readText(join(root, rel));
  const seen = new Map<string, string | null>();
  return (rel) => {
    // Installed packages are not in the index; tsconfig presets are read from them on disk.
    if (!seen.has(rel)) seen.set(rel, catFileBatch(root, [`:./${rel}`])?.[0] ?? (/(^|\/)node_modules\//.test(rel) ? readText(join(root, rel)) : null));
    return seen.get(rel)!;
  };
}

export function revisionReader(root: string, revision: string | null): BaselineRead {
  const seen = new Map<string, string | null>();
  const read: BaselineRead = (rel) => {
    if (rel.startsWith("node_modules/")) return readText(join(root, rel));
    if (!seen.has(rel)) read.prime!([rel]);
    return seen.get(rel)!;
  };
  read.prime = (rels) => {
    const pending = rels.filter(rel => !seen.has(rel) && !rel.startsWith("node_modules/"));
    if (!pending.length) return;
    const texts = revision === null || !hasRepository(root) ? pending.map(rel => readText(join(root, rel)))
      : catFileBatch(root, pending.map(rel => `${revision}:./${rel}`));
    pending.forEach((rel, index) => seen.set(rel, texts?.[index] ?? null));
  };
  return read;
}

export function snapshotReader(sid: string, snap: Snapshot): BaselineRead {
  const seen = new Map<string, string | null>();
  let moved: Map<string, string> | null = null;
  const read: BaselineRead = (rel) => {
    if (rel.startsWith("node_modules/")) return readText(join(snap.root, rel));
    if (!seen.has(rel)) {
      const text = state.beforeText(sid, snap, rel);
      if (isCause(text)) throw new Error(`PREGATE baseline: ${text}`);
      seen.set(rel, text);
    }
    const text = seen.get(rel)!;
    if (text !== null) return text;
    // A moved file keeps the baseline of its source (issue #40). Only a path that exists now can
    // be a rename destination; import probes for absent files never reach Git.
    if (!existsSync(join(snap.root, rel))) return null;
    moved ??= renamedSince(snap);
    const from = moved.get(rel);
    return from === undefined ? null : read(from);
  };
  read.prime = (rels) => {
    const pending = rels.filter((rel) => !seen.has(rel) && !rel.startsWith("node_modules/"));
    const texts = state.beforeTexts(sid, snap, pending);
    if (isCause(texts)) return texts;
    for (const [rel, text] of Object.entries(texts)) seen.set(rel, text);
  };
  return read;
}

// Destination → source for every rename Git detects between the snapshot's HEAD and the tree.
function renamedSince(snap: Snapshot): Map<string, string> {
  if (snap.head === null) return new Map();
  const fields = changed(snap.root, ["diff", "--name-status", "--relative", "-M", "-z", snap.head, "--", "."]) ?? [];
  const out = new Map<string, string>();
  // Each entry is a status, then one path, or source and destination for a rename or copy.
  for (let i = 0; i < fields.length;) {
    const status = fields[i]!;
    if (status.startsWith("R")) out.set(fields[i + 2]!, fields[i + 1]!);
    i += /^[RC]/.test(status) ? 3 : 2;
  }
  return out;
}

// The disk as the call leaves it: its own files read as the call writes them (MH-09).
export function overlaid(root: string, overlay: Overlay): Read {
  const disk = reader(root);
  return (rel) => {
    const abs = pathKey(canonical(join(root, rel)));
    return overlay.has(abs) ? overlay.get(abs) ?? null : disk(rel);
  };
}

export function textOf(text: string | null): string | null {
  return text === null ? null : normalize(text);
}
