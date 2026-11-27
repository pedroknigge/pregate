import { existsSync, lstatSync, readdirSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import { visible } from "./contract.ts";
import { sessionDir, sha256 } from "./state.ts";
import { humanApprovalInstructions } from "./approval.ts";

interface StorageMarker {
  path: string; hash: string | null; pid: number | null; kind: "writer" | "cleanup";
  state: "alive" | "dead" | "unknown"; reason: string;
}
interface RecoverySession { session: string; roots: string[]; markers: StorageMarker[] }
export interface RecoveryPlan { kind: "recover"; root: string; at: number; sessions: RecoverySession[] }

function processState(pid: number): StorageMarker["state"] {
  try { process.kill(pid, 0); return "alive"; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH" ? "dead" : "unknown"; }
}

type Owner = { pid?: unknown; at?: unknown; host?: unknown };

function ownerOf(text: string): Owner | undefined {
  try { return JSON.parse(text); } catch { return undefined; }
}

function marker(dir: string, path: string, kind: StorageMarker["kind"]): StorageMarker {
  const unknown: StorageMarker = { path, kind, hash: null, pid: null, state: "unknown", reason: "Unrecognized ownership; retained." };
  const file = join(dir, path);
  if (!lstatSync(file).isFile()) return unknown;
  const text = readFileSync(file, "utf8"), hash = sha256(text);
  const match = /^(?:\.leases|\.pruning)\/([1-9][0-9]*)-[a-z0-9-]+\.json$/.exec(path);
  if (match === null) return { ...unknown, hash };
  const owner = ownerOf(text);
  if (owner === undefined) return { ...unknown, hash };
  const pid = Number(match[1]);
  if (!owner || owner.pid !== pid || !Number.isSafeInteger(pid) || pid > 2147483647
    || typeof owner.at !== "number" || !Number.isFinite(owner.at)) return { ...unknown, hash };
  if (owner.host !== hostname()) return { ...unknown, hash, pid, reason: "Owner host is missing or differs; absence cannot be established on this machine." };
  const state = processState(pid);
  return { path, hash, pid, kind, state, reason: state === "dead" ? "OS process probe returned ESRCH."
    : state === "alive" ? "PID is present; retained, including possible PID reuse." : "Process absence could not be established; retained." };
}

function markerFolder(dir: string, name: ".leases" | ".pruning"): StorageMarker[] {
  const kind = name === ".leases" ? "writer" : "cleanup", folder = join(dir, name);
  if (!existsSync(folder)) return [];
  if (!lstatSync(folder).isDirectory()) return [{ path: name, hash: null, pid: null, kind, state: "unknown", reason: "Nonregular coordination directory; retained." }];
  const entries = readdirSync(folder).sort();
  if (name === ".pruning" && entries.length !== 1) return [{ path: name, hash: null, pid: null, kind, state: "unknown", reason: "Cleanup ownership is empty or ambiguous; retained." }];
  return entries.map((entry) => marker(dir, name + "/" + entry, kind));
}

export function coordinationMarkers(dir: string): StorageMarker[] {
  return [...markerFolder(dir, ".leases"), ...markerFolder(dir, ".pruning")];
}

export function recoveryPlan(root: string, inventory: { session: string; roots: string[] }[], at: number): RecoveryPlan {
  return { kind: "recover", root, at, sessions: inventory.filter((data) => data.roots.includes(root)).flatMap((data) => {
    const markers = coordinationMarkers(sessionDir(data.session)).filter((marker) => marker.state === "dead");
    return markers.length === 0 ? [] : [{ session: data.session, roots: data.roots, markers }];
  }) };
}

export function recoveryPreview(plan: RecoveryPlan, id: string): string {
  return visible([
    "Recover abandoned storage coordination for " + plan.root + ". No source, snapshots, events or counters are removed.",
    ...plan.sessions.flatMap((session) => ["Session: " + session.session + " · roots: " + session.roots.join(", "),
      ...session.markers.map((marker) => "  " + marker.path + " · PID " + marker.pid + " · " + marker.reason + " SHA-256 " + marker.hash)]),
    "Only exact reviewed owners from this machine whose PID is still absent can be removed. Active, foreign/unknown-host, inaccessible, ownerless and legacy/ambiguous markers stay.",
    "A shared session can belong to several roots; review its listed roots. Age alone never authorizes recovery.",
    "Digest: " + id, ...humanApprovalInstructions("pregate storage apply " + id + " --yes", "harness"),
  ].join("\n"));
}

export function applyRecovery(plan: RecoveryPlan): number {
  let removed = 0;
  for (const session of plan.sessions) for (const item of session.markers) {
    const dir = sessionDir(session.session), current = marker(dir, item.path, item.kind);
    if (current.state !== "dead" || current.hash !== item.hash || current.pid !== item.pid) throw new Error("Marker changed or its process is not provably absent; prepare a new preview.");
    // The unique owner filename is never reused by a legitimate new cleaner. A competing
    // recovery may remove this file first; ENOENT aborts instead of touching its successor.
    unlinkSync(join(dir, item.path));
    removed++;
    if (item.kind === "cleanup") rmdirSync(join(dir, ".pruning"));
  }
  return removed;
}
