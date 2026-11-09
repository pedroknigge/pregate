import { resolve } from "node:path";
import { canonical, findRoot } from "./disk.ts";
import { git } from "./git.ts";
import { reportText, summarize, type SessionBaseline } from "./report.ts";
import { records, unifyRoot } from "./recorded.ts";
import { feedbackLabels } from "./feedback-command.ts";
import { snapshot } from "./state.ts";
import { contractState } from "./status.ts";
import { staticRulesFor } from "./languages.ts";
import { inScope } from "./paths.ts";
import { workspacePaths } from "./workspace.ts";

export function report(args: string[]): { code: number; text: string } {
  let days = 7, repo: string | undefined, json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") json = true;
    else if (arg === "--days") days = Number(args[++i]);
    else if (arg === "--repo") repo = args[++i];
    else return { code: 1, text: "usage: pregate report [--days <n>] [--repo <path>] [--json]" };
  }
  if (!Number.isFinite(days) || days <= 0 || days > 36500 || (args.includes("--repo") && repo === undefined)) return { code: 1, text: "Report needs a positive day window of at most 36500 days and a valid repo path." };
  const cwd = canonical(resolve(repo ?? process.cwd()));
  const root = canonical(findRoot(cwd, () => true) ?? git(cwd, ["rev-parse", "--show-toplevel"])?.trim() ?? cwd);
  const since = Date.now() - days * 86_400_000;
  const selected = unifyRoot(records(since), root).filter(({ event }) => event.root === root && event.at >= since);
  const result = summarize(selected, root, since, feedbackLabels(root));
  result.enforceCandidates = applicable(root, result.enforceCandidates);
  const currentHead = git(root, ["rev-parse", "--verify", "HEAD"])?.trim() ?? null;
  result.sessionBaselines = [...new Set(selected.map(({ session }) => session))].sort()
    .map((session) => sessionBaseline(session, root, currentHead));
  return { code: 0, text: json ? JSON.stringify(result, null, 2) : reportText(result, new Date(result.since).toISOString()) };
}

// The audit's idle filter: a rule that reads no file in scope (an evidence obligation, a language the
// project lacks) has 0 findings without proving anything, so it is not ready to promote. Without a
// current lock the list stays as recorded.
export function applicable(root: string, ids: string[]): string[] {
  const lock = ids.length === 0 ? null : contractState(root).lock;
  if (lock === null) return ids;
  const applied = new Set(workspacePaths(root, (rel) => inScope(lock, rel)).flatMap((rel) => staticRulesFor(lock, rel).map((rule) => rule.id)));
  return ids.filter((id) => applied.has(id));
}

function sessionBaseline(session: string, root: string, currentHead: string | null): SessionBaseline {
  return retainedBaseline(root, { session, status: "missing", head: null, currentHead,
    startedWithSession: null, dirtyFiles: null, createdAt: null, reason: "No retained snapshot." });
}

function retainedBaseline(root: string, result: SessionBaseline): SessionBaseline {
  try {
    const saved = snapshot(result.session, root);
    if (saved === null) return result;
    if (saved === "missing") return { ...result, reason: "Snapshot file missing from the existing session root." };
    const at = (saved as typeof saved & { at?: unknown }).at;
    if (saved.root !== root || (saved.head !== null && (typeof saved.head !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(saved.head))) || typeof saved.start !== "boolean"
      || typeof saved.dirty !== "object" || saved.dirty === null || Array.isArray(saved.dirty)
      || Object.values(saved.dirty).some((hash) => hash !== null && (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)))
      || (at !== undefined && (typeof at !== "number" || !Number.isFinite(at) || at < 0))) {
      return { ...result, status: "invalid", reason: "Snapshot metadata is invalid." };
    }
    return { ...result, status: "available", head: saved.head, startedWithSession: saved.start,
      dirtyFiles: Object.keys(saved.dirty).length, createdAt: typeof at === "number" ? at : null, reason: null };
  } catch {
    return { ...result, status: "invalid", reason: "Snapshot metadata cannot be read." };
  }
}
