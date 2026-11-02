import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { markReached } from "./consent.ts";
import { writeAtomic } from "./disk.ts";
import { catFileBatch, git } from "./git.ts";
import type { CallEvent, Cause, Session, Snapshot } from "./types.ts";
import { storageDir, WINDOWS } from "./platform.ts";
import { pathKey } from "./paths.ts";
import { withStateWrite } from "./state-lease.ts";

// Hook histories are append-only so parallel hooks never lose an update (A11). Explicit,
// reviewed retention may remove historical source blobs, never events or snapshot references.
// <sid> is key(session):
//   sessions/<sid>/events/<UTC date>/<turnH>~<agentH>~<fileH>~<verdict>~<form>~<callIdH>.json
//   sessions/<sid>/blobs/<sha256>
//   sessions/<sid>/<rootHash>/snapshot.json · head/<H(rel)>.json · sources.json

export function sha256(text: string | Uint8Array): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

export function H(s: string): string {
  return sha256(s).slice(0, 12);
}

// ${XDG_STATE_HOME:-$HOME/.local/state}/pregate, spelled as the launcher spells the engine path.
export function stateDir(): string {
  return storageDir("state");
}

// MH-05: the harness is part of the key, so two harnesses never share a session by chance.
export function key(s: Pick<Session, "harness" | "id">): string {
  return `${s.harness}:${s.id}`;
}

export function sessionDir(sid: string): string {
  if (!/^[\w-][\w.:-]*$/.test(sid)) throw new Error(`unsafe session id: ${JSON.stringify(sid)}`);
  // ':' is legal in a harness key, but not in a Windows filename.
  return `${stateDir()}/sessions/${WINDOWS ? sid.replaceAll(":", "~") : sid}`;
}

// File-system failures are the known cause; anything else is a bug and propagates (exit 1, A6).
function io<T>(f: () => T): T | "state-io" {
  try {
    return f();
  } catch (e) {
    if (typeof (e as NodeJS.ErrnoException).code === "string") return "state-io";
    throw e;
  }
}

function readOrNull(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

function blob(dir: string, text: string): string {
  const sha = sha256(text);
  const path = `${dir}/blobs/${sha}`;
  if (!existsSync(path)) {
    mkdirSync(`${dir}/blobs`, { recursive: true });
    // Content-addressed blobs are immutable. Concurrent writers must publish
    // once, not rename over the same destination while another writer uses it.
    writeOnce(path, text);
  }
  return sha;
}

// The first writer wins and the file never changes afterwards (A12).
function writeOnce(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, text);
  linkOnce(tmp, path);
}

function linkOnce(tmp: string, path: string): void {
  try {
    linkSync(tmp, path);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  } finally {
    unlinkSync(tmp);
  }
}

// Every filter key is in the name, so counters come from a readdir and only the events of one
// (agent, file) are ever read. A Stop has no file and no tool call: "stop" and its timestamp. The
// file key uses the same normalized path identity as history lookups (A26).
export function eventName(e: CallEvent): string {
  const file = e.kind === "stop" ? "stop" : e.path === null ? "-" : H(pathKey(e.path));
  const call = H(e.kind === "stop" ? String(e.at) : e.callId);
  return `${[H(e.turn), e.agentId === null ? "-" : H(e.agentId), file, e.verdict, e.form === null ? 0 : 1, call].join("~")}.json`;
}

// New histories are date-partitioned before any event content is read. Flat histories remain
// readable for compatibility, but their timestamps require reading the old event content.
export function eventFiles(folder: string, since = 0): string[] {
  const dir = join(folder, "events");
  const floor = new Date(since).toISOString().slice(0, 10);
  return datedEventFiles(dir, floor, new Map<string, string>());
}

function datedEventFiles(dir: string, floor: string, found: Map<string, string>): string[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) if (e.isFile() && e.name.endsWith(".json")) found.set(e.name, join(dir, e.name));
    for (const e of entries) if (e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name) && e.name >= floor) {
      for (const file of readdirSync(join(dir, e.name), { withFileTypes: true })) {
        if (file.isFile() && file.name.endsWith(".json")) found.set(file.name, join(dir, e.name, file.name));
      }
    }
    return [...found.values()];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

function eventNames(sid: string): string[] {
  return eventFiles(sessionDir(sid)).map((file) => basename(file));
}

export function history(sid: string, agentH: string, fileH: string): CallEvent[] {
  return eventFiles(sessionDir(sid))
    .filter((file) => basename(file).split("~")[1] === agentH && basename(file).split("~")[2] === fileH)
    .map((file) => JSON.parse(readFileSync(file, "utf8")) as CallEvent)
    .sort((a, b) => a.at - b.at || (a.callId < b.callId ? -1 : a.callId > b.callId ? 1 : 0));
}

// Form denies included (§7.2 #14); Stop blocks are not, they have their own cap (O17).
export function turnDenials(sid: string, turnH: string, agentH: string): number {
  return eventNames(sid).filter((n) => {
    const [turn, agent, file, verdict] = n.split("~");
    return turn === turnH && agent === agentH && file !== "stop" && verdict === "deny";
  }).length;
}

export function stopBlocks(sid: string, turnH: string, agentH = "-"): number {
  return eventNames(sid).filter((n) => n.startsWith(`${turnH}~${agentH}~stop~deny~`)).length;
}

// Every file an edit tool of this session (any agent) proposed to write, as path keys.
export function editedPaths(sid: string): Set<string> {
  const paths = new Set<string>();
  const read = new Set<string>();
  for (const file of eventFiles(sessionDir(sid))) {
    const fileH = basename(file).split("~")[2];
    if (fileH === undefined || fileH === "-" || fileH === "stop" || read.has(fileH)) continue;
    read.add(fileH);
    const path = (JSON.parse(readFileSync(file, "utf8")) as CallEvent).path;
    if (path !== null) paths.add(pathKey(path));
  }
  return paths;
}

// The paths this turn's edit calls named (any agent): one event read per file key.
export function turnPaths(sid: string, turnH: string): string[] {
  const paths = new Map<string, string | null>();
  for (const file of eventFiles(sessionDir(sid))) {
    const [turn, , fileH] = basename(file).split("~");
    if (turn !== turnH || fileH === undefined || fileH === "-" || fileH === "stop" || paths.has(fileH)) continue;
    paths.set(fileH, (JSON.parse(readFileSync(file, "utf8")) as CallEvent).path);
  }
  return [...paths.values()].filter((path) => path !== null);
}

// The files each subagent edited (path keys), and whether its own Stop released it. Names give the
// agent and file keys; one event per file supplies its path.
export function agentEdits(sid: string): Map<string, { paths: Set<string>; finished: boolean }> {
  const agents = new Map<string, { paths: Set<string>; finished: boolean }>();
  const read = new Set<string>();
  for (const file of eventFiles(sessionDir(sid))) {
    const [, agent, fileH, verdict] = basename(file).split("~");
    if (agent === undefined || agent === "-" || fileH === undefined || fileH === "-") continue;
    const entry = agents.get(agent) ?? { paths: new Set<string>(), finished: false };
    agents.set(agent, entry);
    if (fileH === "stop") entry.finished ||= verdict !== "deny";
    else if (!read.has(`${agent}~${fileH}`)) {
      read.add(`${agent}~${fileH}`);
      const path = (JSON.parse(readFileSync(file, "utf8")) as CallEvent).path;
      if (path !== null) entry.paths.add(pathKey(path));
    }
  }
  return agents;
}

// `after` goes to blobs/ (with deny, ask or shadowed) before the event that names it.
export function record(sid: string, e: CallEvent, after: string | null, before: string | null = null): void | Cause {
  if ((after === null ? null : sha256(after)) !== e.afterSha) throw new Error("record: afterSha does not match after");
  const dir = sessionDir(sid);
  const done = io(() => withStateWrite(dir, () => {
    if (after !== null) blob(dir, after);
    if (before !== null) {
      if (sha256(before) !== e.beforeSha) throw new Error("record: beforeSha does not match before");
      blob(dir, before);
    }
    const dated = `${dir}/events/${new Date(e.at).toISOString().slice(0, 10)}`;
    mkdirSync(dated, { recursive: true });
    writeAtomic(`${dated}/${eventName(e)}`, JSON.stringify(e));
  }));
  return done === "state-io" ? done : undefined;
}

// <rootHash>/ only ever appears with its snapshot.json (see ensureSnapshot), so a directory
// without one was tampered with: "missing", never a fresh first contact that whitewashes (§11.3).
export function snapshot(sid: string, root: string): Snapshot | "missing" | null {
  const dir = `${sessionDir(sid)}/${H(root)}`;
  if (!existsSync(dir)) return null;
  const text = readOrNull(`${dir}/snapshot.json`);
  if (text === null) return "missing";
  const original = JSON.parse(text) as Snapshot;
  const reviewed = readOrNull(`${dir}/reviewed-baseline.json`);
  if (reviewed === null) return original;
  const baseline = JSON.parse(reviewed) as { root: string; head: string; snapshotHash: string; digest: string };
  if (baseline.root !== root || baseline.snapshotHash !== sha256(text) || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(baseline.head)
    || !/^[0-9a-f]{64}$/.test(baseline.digest)) throw new Error("Invalid reviewed session baseline; inspect pregate report.");
  return { ...original, head: baseline.head, dirty: {} };
}

export function roots(sid: string): string[] {
  return snapshotFiles(sid)
    .flatMap((path) => {
      const text = readOrNull(path);
      return text === null ? [] : [(JSON.parse(text) as Snapshot).root];
    })
    .sort();
}

// MH-33: snapshot.at is stable even if the snapshot is copied or its metadata changes.
export function firstContact(sid: string): number | null {
  const times = snapshotFiles(sid).flatMap((path) => {
    const text = readOrNull(path);
    if (text === null) return [];
    const snap = JSON.parse(text) as Snapshot & { at?: number };
    // Existing 0.1 snapshots have no timestamp; retain their original acceptance boundary.
    return snap.at ?? statSync(path).ctimeMs;
  });
  return times.length === 0 ? null : Math.min(...times);
}

function snapshotFiles(sid: string): string[] {
  const dir = sessionDir(sid);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => /^[0-9a-f]{12}$/.test(n)).map((n) => `${dir}/${n}/snapshot.json`);
}

// HEAD (null in a repository without commits or without git) and the root's path inside the repository.
// Commits these tips reach existed before the session. Too many refs: no tips, so nothing is
// treated as arrived and Stop stays conservative.
function refTips(root: string): string[] | undefined {
  const listed = git(root, ["for-each-ref", "--format=%(objectname)", "refs/heads", "refs/remotes"]);
  const tips = listed === null ? [] : [...new Set(listed.split("\n").filter((sha) => /^[0-9a-f]{40,64}$/.test(sha)))];
  return listed === null || tips.length > 2000 ? undefined : tips;
}

function revision(root: string): { head: string | null; prefix: string } {
  const both = git(root, ["rev-parse", "--show-prefix", "--verify", "-q", "HEAD"]);
  if (both !== null) {
    const [prefix, head] = both.split("\n");
    return { prefix: prefix!, head: head! };
  }
  const prefix = git(root, ["rev-parse", "--show-prefix"]);
  return { prefix: prefix?.replace(/\n$/, "") ?? "", head: null };
}

// rel → current text (null: absent) of every file under root that differs from HEAD or is
// untracked, among those `keep` accepts. Porcelain paths are relative to the repository top.
function dirtyTexts(root: string, prefix: string, keep: (rel: string) => boolean): Record<string, string | null> {
  const status = git(root, ["status", "--porcelain", "-z", "--untracked-files=all", "--", "."]);
  if (status === null) {
    const texts: Record<string, string | null> = {};
    const skip = new Set([".git", ".pregate", "node_modules", ".claude", ".cursor", ".codex", ".grok", ".gemini", "dist", "build"]);
    const walk = (rel: string): void => {
      try {
        for (const entry of readdirSync(rel === "" ? root : `${root}/${rel}`, { withFileTypes: true })) {
          if (skip.has(entry.name)) continue;
          const p = rel === "" ? entry.name : `${rel}/${entry.name}`;
          if (entry.isDirectory()) walk(p);
          else if (entry.isFile() && keep(p)) {
            texts[p] = readFileSync(`${root}/${p}`, "utf8");
          }
        }
      } catch {
        // Without git this is best effort: an unreadable folder or file ends that folder's walk,
        // keeping what it already read, and the rest of the tree is still walked.
        return;
      }
    };
    walk("");
    return texts;
  }
  const texts: Record<string, string | null> = {};
  const fields = status.split("\0");
  for (let k = 0; k < fields.length; k++) {
    const entry = fields[k]!;
    if (entry.length < 4) continue;
    const paths = /[RC]/.test(entry.slice(0, 2)) ? [entry.slice(3), fields[++k]!] : [entry.slice(3)];   // a rename's source follows
    for (const rel of paths.map((p) => p.slice(prefix.length)).filter(keep)) {
      const stat = statSync(`${root}/${rel}`, { throwIfNoEntry: false });
      if (stat === undefined) texts[rel] = null;
      else if (stat.isFile()) texts[rel] = readFileSync(`${root}/${rel}`, "utf8");
    }
  }
  return texts;
}

// The snapshot of (session, root), created on first contact. `start` is SessionStart's filter of
// the dirty files to keep (in scope); null on a Pre's first contact, whose "before" is HEAD for
// every file.
export function ensureSnapshot(sid: string, root: string, start: ((rel: string) => boolean) | null): Snapshot | Cause {
  const at = Date.now();
  const found = snapshot(sid, root);
  if (found === "missing") return "snapshot-missing";
  if (found !== null) return found;
  const rev = revision(root);
  // SessionStart has time for the ref listing; a Pre's first contact keeps its latency budget and
  // records no tips, so its Stop treats no moved-HEAD file as arrived.
  const tips = rev.head === null || start === null ? undefined : refTips(root);
  const texts = start === null ? {} : dirtyTexts(root, rev.prefix, start);
  const dir = sessionDir(sid);
  const made = io(() => withStateWrite(dir, () => {
    const dirty = Object.fromEntries(Object.entries(texts).map(([rel, text]) => [rel, text === null ? null : blob(dir, text)]));
    return publish(sid, { root, head: rev.head, start: start !== null, dirty, ...(tips === undefined ? {} : { tips }), at });
  }));
  if (made === null || made === "missing") return "snapshot-missing";
  if (typeof made === "object") io(() => markReached());
  return made;
}

// The snapshot's directory is built aside and renamed into place. The rename fails when another
// hook got there first, and then the session's snapshot is that one.
function publish(sid: string, snap: Snapshot & { at: number }): Snapshot | "missing" | null {
  const dir = sessionDir(sid);
  const tmp = `${dir}/tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  mkdirSync(tmp, { recursive: true });
  writeFileSync(`${tmp}/snapshot.json`, JSON.stringify(snap));
  return renameSnapshot(sid, snap, dir, tmp);
}

function renameSnapshot(sid: string, snap: Snapshot & { at: number }, dir: string, tmp: string): Snapshot | "missing" | null {
  try {
    renameSync(tmp, `${dir}/${H(snap.root)}`);
    return snap;
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    const code = (e as NodeJS.ErrnoException).code ?? "";
    // Windows reports access denied when another hook has already published the directory.
    const raced = WINDOWS && ["EACCES", "EPERM"].includes(code) && existsSync(`${dir}/${H(snap.root)}`);
    if (!["ENOTEMPTY", "EEXIST"].includes(code) && !raced) throw e;
    return snapshot(sid, snap.root);
  }
}

export function beforeText(sid: string, snap: Snapshot, rel: string): string | null | Cause {
  const texts = beforeTexts(sid, snap, [rel]);
  return typeof texts === "string" ? texts : texts[rel] ?? null;
}

// Known dependency reads are fetched together. Unknown/old-only dependencies still use the
// individual reader, so optimization cannot change the independent snapshot baseline.
export function beforeTexts(sid: string, snap: Snapshot, rels: string[]): Record<string, string | null> | Cause {
  const dir = sessionDir(sid);
  const result: Record<string, string | null> = {}, pending: string[] = [];
  const rebased = existsSync(`${dir}/${H(snap.root)}/reviewed-baseline.json`);
  const headDir = `${dir}/${H(snap.root)}/head${rebased && snap.head ? "/" + snap.head : ""}`;
  for (const rel of [...new Set(rels)]) {
    if (Object.hasOwn(snap.dirty, rel)) {
      const sha = snap.dirty[rel] ?? null;
      const text = sha === null ? null : readOrNull(`${dir}/blobs/${sha}`);
      if (sha !== null && text === null) return "snapshot-missing";
      result[rel] = text;
    } else if (snap.head === null) result[rel] = null;
    else {
      const cached = readOrNull(`${headDir}/${H(rel)}.json`);
      if (cached === null) pending.push(rel);
      else result[rel] = (JSON.parse(cached) as { text: string | null }).text;
    }
  }
  if (pending.length === 0) return result;
  const texts = catFileBatch(snap.root, pending.map((rel) => `${snap.head}:./${rel}`));
  if (texts === null) return "git-failed";
  const saved = io(() => {
    mkdirSync(headDir, { recursive: true });
    for (const [i, rel] of pending.entries()) {
      result[rel] = texts[i] ?? null;
      writeOnce(`${headDir}/${H(rel)}.json`, JSON.stringify({ text: result[rel] }));
    }
  });
  return saved === "state-io" ? saved : result;
}

// §4.1 step 6: the sourcesHash is verified once per lock. The verdict is cached only next to an
// existing snapshot: creating <rootHash>/ here would leave it without one.
export function sourcesOk(sid: string, root: string, lockHash: string, verify: () => boolean): boolean | Cause {
  const dir = `${sessionDir(sid)}/${H(root)}`;
  const cached = readOrNull(`${dir}/sources.json`);
  if (cached !== null) {
    const c = JSON.parse(cached) as { lockHash: string; ok: boolean };
    if (c.lockHash === lockHash) return c.ok;
  }
  const ok = verify();
  if (!existsSync(dir)) return ok;
  const saved = io(() => writeAtomic(`${dir}/sources.json`, JSON.stringify({ lockHash, ok })));
  return saved === "state-io" ? saved : ok;
}
