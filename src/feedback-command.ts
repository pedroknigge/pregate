import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { approve, humanApprovalInstructions, PENDING_MS } from "./approval.ts";
import { dataHome } from "./consent.ts";
import { visible } from "./contract.ts";
import { canonical, findRoot, writeAtomic } from "./disk.ts";
import { feedbackItems, type FeedbackLabel, type FeedbackVerdict } from "./feedback.ts";
import { records, unifyRoot } from "./recorded.ts";
import { equal } from "./schema.ts";
import { H, sha256 } from "./state.ts";

type Result = { code: number; text: string };
interface Draft { label: FeedbackLabel; previousHash: string | null; at: number }
const VERDICTS = ["correct", "false-positive", "uncertain"];
const USAGE = "usage: pregate feedback list [--days <n>] [--json] | draft <finding-id> --as correct|false-positive|uncertain [--note <text>] [--days <n>] | show <digest> | apply <digest> [--yes]";
const folder = (root: string) => join(dataHome(), "feedback", H(root));
const labelFile = (label: FeedbackLabel) => join(folder(label.item.root), label.item.id + ".json");

function read(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

export function feedbackLabels(root: string): FeedbackLabel[] {
  const dir = folder(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => /^[0-9a-f]{24}\.json$/.test(name)).map((name) => {
    const label = JSON.parse(readFileSync(join(dir, name), "utf8")) as FeedbackLabel;
    if (label.item?.root !== root || label.item.id + ".json" !== name || !VERDICTS.includes(label.verdict)
      || !/^[0-9a-f]{64}$/.test(label.item.eventHash) || typeof label.note !== "string" || !(label.confirmedAt > 0) || !Number.isFinite(label.confirmedAt)) throw new Error("Invalid local feedback label: " + name);
    return label;
  });
}

function draftFile(id: string): string {
  if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("Feedback needs its full SHA-256 digest.");
  return join(dataHome(), "feedback", "drafts", id + ".json");
}

function feedbackReview(root: string, id: string): Draft {
  const text = readFileSync(draftFile(id), "utf8");
  if (sha256(text) !== id) throw new Error("Feedback draft changed; review a new draft.");
  const draft = JSON.parse(text) as Draft;
  const age = Date.now() - draft.at;
  if (draft.label?.item.root !== root || !VERDICTS.includes(draft.label.verdict) || typeof draft.label.note !== "string"
    || !Number.isFinite(draft.at) || age < 0 || age > PENDING_MS) throw new Error("Feedback draft expired, is invalid or belongs to another project.");
  const item = feedbackItems(unifyRoot(records(draft.label.item.at), root), root).find((item) => item.id === draft.label.item.id);
  if (!item || !equal(item, draft.label.item)) throw new Error("Recorded observation changed or is unavailable.");
  const previous = read(labelFile(draft.label));
  if ((previous === null ? null : sha256(previous)) !== draft.previousHash) throw new Error("Feedback changed since review; prepare a new draft.");
  return draft;
}

function feedbackPreview(draft: Draft, id: string): string {
  const { label } = draft, { item } = label;
  return visible([
    "Local human feedback; nothing is sent to GitHub or a model.",
    item.rule + " · " + item.path + ":" + item.line + " · " + item.channel,
    "Symbol: " + item.symbol + "; measured: " + item.measured + "; limit: " + item.limit,
    "Finding: " + item.id + "; session: " + item.session + "; observed: " + new Date(item.at).toISOString(),
    "Label: " + label.verdict, "Note: " + (label.note || "(none)"),
    "Existing label: " + (draft.previousHash === null ? "none" : "will be replaced after review"),
    "This labels one recorded observation; it does not prove executed repair or overall rule precision.",
    "Digest: " + id, ...humanApprovalInstructions("pregate feedback apply " + id + " --yes", "harness"),
  ].join("\n"));
}

export async function feedback(args: string[]): Promise<Result> {
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null) return { code: 1, text: "Feedback needs a PREGATE preset in this directory or above." };
  return feedbackAction(root, args);
}

async function feedbackAction(root: string, args: string[]): Promise<Result> {
  try {
    const [sub, id, ...flags] = args;
    if (sub === "list") return list(root, args.slice(1));
    if (sub === "draft") return draftFeedback(root, args.slice(1));
    if (!id || !/^[0-9a-f]{64}$/.test(id)) return { code: 1, text: USAGE };
    if (sub === "show" && flags.length === 0) return { code: 0, text: feedbackPreview(feedbackReview(root, id), id) };
    if (sub === "apply" && (flags.length === 0 || (flags.length === 1 && flags[0] === "--yes"))) return await apply(root, id, flags.length === 1);
    return { code: 1, text: USAGE };
  } catch (e) {
    return { code: 1, text: "Cannot use feedback: " + (e as Error).message + ". Draft retained." };
  }
}

function list(root: string, args: string[]): Result {
  let days = 7, json = false;
  const used = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (used.has(arg)) return { code: 1, text: USAGE };
    used.add(arg);
    if (arg === "--json") json = true;
    else if (arg === "--days") days = Number(args[++i]);
    else return { code: 1, text: USAGE };
  }
  if (!Number.isFinite(days) || days <= 0 || days > 36500) return { code: 1, text: USAGE };
  const since = Date.now() - days * 86400000;
  const items = feedbackItems(unifyRoot(records(since), root), root, since);
  const labels = new Map(feedbackLabels(root).map((label) => [label.item.id, label]));
  const findings = items.map((item) => ({ ...item, label: equal(labels.get(item.id)?.item, item) ? labels.get(item.id)!.verdict : null }));
  return { code: 0, text: json ? JSON.stringify({ root, since, findings }, null, 2) : visible([
    "Recorded observations; use one finding ID to prepare human feedback:",
    ...findings.map((item) => item.id + " · " + item.rule + " · " + item.path + ":" + item.line + " · " + (item.label ?? "unlabeled")),
    ...(findings.length === 0 ? ["No rule observations in this window."] : []),
  ].join("\n")) };
}

function draftFeedback(root: string, args: string[]): Result {
  const [id, ...flags] = args;
  if (!id || !/^[0-9a-f]{24}$/.test(id)) return { code: 1, text: USAGE };
  let verdict: string | undefined, note = "", days = 7;
  const used = new Set<string>();
  for (let i = 0; i < flags.length; i += 2) {
    const flag = flags[i]!, value = flags[i + 1];
    if (!["--as", "--note", "--days"].includes(flag) || used.has(flag) || value === undefined) return { code: 1, text: USAGE };
    used.add(flag);
    if (flag === "--as") verdict = value; else if (flag === "--days") days = Number(value); else note = value;
  }
  if (!verdict || !VERDICTS.includes(verdict) || !Number.isFinite(days) || days <= 0 || days > 36500) return { code: 1, text: USAGE };
  const since = Date.now() - days * 86400000;
  const item = feedbackItems(unifyRoot(records(since), root), root, since).find((item) => item.id === id);
  if (!item) return { code: 1, text: "No matching rule observation. Use pregate feedback list." };
  const label: FeedbackLabel = { item, verdict: verdict as FeedbackVerdict, note, confirmedAt: 0 };
  const previous = read(labelFile(label));
  const draft: Draft = { label, previousHash: previous === null ? null : sha256(previous), at: Date.now() };
  const text = JSON.stringify(draft), digest = sha256(text);
  const file = draftFile(digest);
  mkdirSync(join(dataHome(), "feedback", "drafts"), { recursive: true });
  writeAtomic(file, text);
  return { code: 0, text: feedbackPreview(draft, digest) };
}

async function apply(root: string, id: string, yes: boolean): Promise<Result> {
  const draft = feedbackReview(root, id);
  if (!await approve(feedbackPreview(draft, id), false, yes)) return { code: 1, text: "Feedback not approved; draft retained." };
  const current = feedbackReview(root, id);
  mkdirSync(folder(root), { recursive: true });
  writeAtomic(labelFile(current.label), JSON.stringify({ ...current.label, confirmedAt: Date.now() }));
  return { code: 0, text: "Local feedback saved. Run pregate report to see reviewed counts and precision." };
}
