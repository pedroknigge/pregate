import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { H, sessionDir, sha256, stateDir } from "./state.ts";
import { storageActivity } from "./state-lease.ts";
import { coordinationMarkers } from "./storage-recovery.ts";
import { WINDOWS } from "./platform.ts";
import type { CallEvent, Snapshot } from "./types.ts";

interface StoredFile { path: string; bytes: number; hash: string }
interface Inventory { session: string; files: StoredFile[]; snapshots: Snapshot[]; events: CallEvent[] }
interface PruneSession { session: string; fingerprint: string; files: StoredFile[] }
export interface PrunePlan { root: string; cutoff: number; at: number; sessions: PruneSession[] }

function sessions(): string[] {
  const dir = join(stateDir(), "sessions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).map((entry) => {
    if (!entry.isDirectory()) throw new Error("Unexpected session storage entry: " + entry.name);
    const sid = WINDOWS ? entry.name.replaceAll("~", ":") : entry.name;
    sessionDir(sid); // Validate before using a disk-provided identifier.
    return sid;
  }).sort();
}

function storedFiles(dir: string, rel = ""): StoredFile[] {
  return readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((entry): StoredFile[] => {
    if (rel === "" && [".leases", ".pruning"].includes(entry.name)) {
      if (!entry.isDirectory()) throw new Error("Storage coordination entry is not a directory: " + entry.name);
      return [];
    }
    const path = rel === "" ? entry.name : rel + "/" + entry.name;
    if (entry.isDirectory()) return storedFiles(dir, path);
    if (!entry.isFile()) throw new Error("Storage contains a nonregular entry: " + path);
    const content = readFileSync(join(dir, path));
    return [{ path, bytes: content.byteLength, hash: sha256(content.toString("utf8")) }];
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function inventory(session: string): Inventory {
  const dir = sessionDir(session), files = storedFiles(dir);
  for (const entry of readdirSync(dir, { withFileTypes: true })) if (/^[0-9a-f]{12}$/.test(entry.name)
    && !files.some((file) => file.path === entry.name + "/snapshot.json")) throw new Error("Missing session snapshot: " + entry.name);
  const snapshots = files.filter((file) => file.path.endsWith("/snapshot.json")).map((file) => {
    const snap = JSON.parse(readFileSync(join(dir, file.path), "utf8")) as Snapshot;
    const folder = file.path.split("/")[0]!;
    if (typeof snap.root !== "string" || (H(snap.root) !== folder && !/^tmp-[^/]+$/.test(folder))
      || !snap.dirty || typeof snap.dirty !== "object" || Array.isArray(snap.dirty)) throw new Error("Invalid snapshot: " + file.path);
    for (const hash of Object.values(snap.dirty)) {
      validHash(hash);
      if (hash !== null && !files.some((file) => file.path === "blobs/" + hash && file.hash === hash)) throw new Error("Missing or corrupt snapshot source: " + hash);
    }
    return snap;
  });
  const events = files.filter((file) => /^events\/(?:\d{4}-\d{2}-\d{2}\/)?[^/]+\.json$/.test(file.path)).map((file) => {
    const event = JSON.parse(readFileSync(join(dir, file.path), "utf8")) as CallEvent;
    if (!Number.isFinite(event.at)) throw new Error("Invalid event timestamp: " + file.path);
    validHash(event.afterSha); validHash(event.beforeSha);
    event.root ??= snapshots.filter((snap) => event.path?.startsWith(snap.root + "/")).sort((a, b) => b.root.length - a.root.length)[0]?.root
      ?? (snapshots.length === 1 ? snapshots[0]!.root : null);
    return event;
  });
  return { session, files, snapshots, events };
}

function validHash(hash: unknown): void {
  if (hash !== null && hash !== undefined && (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))) throw new Error("Invalid stored source reference.");
}

function pruneSession(data: Inventory, root: string, cutoff: number): PruneSession | null {
  const keep = new Set(data.snapshots.flatMap((snap) => Object.values(snap.dirty).filter((hash): hash is string => hash !== null)));
  const wanted = new Set<string>();
  for (const event of data.events) {
    const selected = event.root === root && event.at < cutoff;
    for (const hash of [event.afterSha, event.beforeSha]) if (hash) (selected ? wanted : keep).add(hash);
  }
  const files = data.files.filter((file) => /^blobs\/[0-9a-f]{64}$/.test(file.path)
    && wanted.has(file.path.slice(6)) && !keep.has(file.path.slice(6)));
  for (const file of files) if (file.hash !== file.path.slice(6)) throw new Error("Stored source hash mismatch: " + file.path);
  if (files.length === 0) return null;
  const relevant = data.files.filter((file) => file.path.startsWith("events/") || file.path.startsWith("blobs/") || file.path.endsWith("/snapshot.json"));
  return { session: data.session, fingerprint: sha256(JSON.stringify(relevant)), files };
}

export function prunePlan(root: string, cutoff: number, at = Date.now()): PrunePlan {
  const selected = sessions().map((session) => pruneSession(inventory(session), root, cutoff)).filter((data): data is PruneSession => data !== null);
  return { root, cutoff, at, sessions: selected };
}

export function storageInspection(root: string) {
  const all = sessions().map(inventory);
  return {
    root, state: stateDir(), scope: "Local session storage across all projects; pruning is scoped to the selected project.",
    sessions: all.map((data) => ({ session: data.session, roots: data.snapshots.map((snap) => snap.root),
      files: data.files.length, bytes: data.files.reduce((total, file) => total + file.bytes, 0), events: data.events.length,
      blobBytes: data.files.filter((file) => file.path.startsWith("blobs/")).reduce((total, file) => total + file.bytes, 0),
      baselineBytes: data.files.filter((file) => /\/(?:snapshot\.json|head\/)/.test(file.path)).reduce((total, file) => total + file.bytes, 0),
      ...storageActivity(sessionDir(data.session)),
      markers: coordinationMarkers(sessionDir(data.session)),
    })),
    retained: "All snapshots, cached baselines, events/counters, shared/newer code and unattributed blobs remain. Approval, issue and feedback data is separate and is not pruned.",
  };
}
