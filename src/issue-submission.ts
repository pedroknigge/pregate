import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { writeAtomic } from "./disk.ts";

interface SubmissionOwner {
  dir: string; file: string; text: string; phase: "checking" | "creating"; state: "alive" | "dead" | "unknown";
}
export interface SubmissionLease { beforeCreate: () => void; confirmed: () => void; release: () => void }

export function submissionOwner(dir: string): SubmissionOwner | null {
  if (!existsSync(dir) || !lstatSync(dir).isDirectory()) return null;
  const entries = readdirSync(dir);
  if (entries.length !== 1) return null;
  const match = /^([1-9][0-9]*)-[a-f0-9-]+\.json$/.exec(entries[0]!);
  if (match === null) return null;
  const file = join(dir, entries[0]!);
  if (!lstatSync(file).isFile()) return null;
  const text = readFileSync(file, "utf8");
  const owner = ownerRecord(text);
  const pid = Number(match[1]);
  if (!owner || owner.pid !== pid || !Number.isSafeInteger(pid) || pid > 2147483647
    || typeof owner.at !== "number" || !Number.isFinite(owner.at)
    || (owner.phase !== "checking" && owner.phase !== "creating")) return null;
  const state = owner.host === hostname() ? processState(pid) : "unknown";
  return { dir, file, text, phase: owner.phase, state };
}

function ownerRecord(text: string): { pid?: unknown; host?: unknown; at?: unknown; phase?: unknown } | null {
  try { return JSON.parse(text); }
  catch (error) { if (error instanceof SyntaxError) return null; throw error; }
}

function processState(pid: number): SubmissionOwner["state"] {
  try { process.kill(pid, 0); return "alive"; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH" ? "dead" : "unknown"; }
}

export function releaseAbandonedSubmission(owner: SubmissionOwner): void {
  const current = submissionOwner(owner.dir);
  if (current === null || current.state !== "dead" || current.file !== owner.file || current.text !== owner.text) {
    throw new Error("Submission owner changed or its process is not provably absent; retry after inspecting GitHub");
  }
  // Each owner has a unique filename. Never recursively remove a successor's directory.
  unlinkSync(owner.file);
  rmdirSync(owner.dir);
}

function writeOwner(dir: string, file: string, owner: object): void {
  try { writeFileSync(file, JSON.stringify(owner), { flag: "wx" }); }
  catch (error) { rmdirSync(dir); throw error; }
}

export function acquireSubmission(dir: string): SubmissionLease {
  mkdirSync(dir);
  const file = join(dir, `${process.pid}-${crypto.randomUUID()}.json`);
  const owner = { pid: process.pid, host: hostname(), at: Date.now(), phase: "checking" };
  writeOwner(dir, file, owner);
  let uncertain = false;
  return {
    beforeCreate: () => { writeAtomic(file, JSON.stringify({ ...owner, phase: "creating" })); uncertain = true; },
    confirmed: () => { uncertain = false; },
    release: () => { if (!uncertain) { unlinkSync(file); rmdirSync(dir); } },
  };
}
