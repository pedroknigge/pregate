import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { approve, humanApprovalInstructions } from "./approval.ts";
import { dataHome } from "./consent.ts";
import { canonical, findRoot, writeAtomic } from "./disk.ts";
import { issueContent, type IssueDraft, type IssueReproduction } from "./issue.ts";
import { REPO } from "./product.ts";
import { findingContent, findings, type Finding } from "./recorded.ts";
import type { CallEvent } from "./types.ts";
import { sha256 } from "./state.ts";
import { visible } from "./contract.ts";
import { readFixture } from "./fixture-replay.ts";
import { testFixture } from "./fixtures.ts";
import { grammars } from "./contract-diagnostic.ts";
import { clock, VERSIONS } from "./admission.ts";
import { acquireSubmission, releaseAbandonedSubmission, submissionOwner, type SubmissionLease } from "./issue-submission.ts";

type Result = { code: number; text: string };
type Gh = (args: string[]) => Promise<Result>;
const GH_TIMEOUT_MS = 15_000;
const GH_OUTPUT_BYTES = 16 * 1024 * 1024;
const GH_DIAGNOSTIC_BYTES = 4096;
const LIST_LIMIT = 20;
const USAGE = "usage: pregate issue list | draft (--last | <event id>) [--include-code | --repro <dir|repro.json>] [--note <expected behavior>] [--title <report title>] | draft --no-event --title <report title> --note <expected behavior> [--repro <dir|repro.json>] | show <digest> | submit <digest> [--yes]";

function draftFile(id: string): string {
  if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("Issue draft needs its full SHA-256 digest.");
  return join(dataHome(), "issues", `${id}.json`);
}

export function issueReview(root: string, id: string): IssueDraft {
  const text = readFileSync(draftFile(id), "utf8");
  if (sha256(text) !== id) throw new Error("Issue draft changed; prepare and review a new draft.");
  const draft = JSON.parse(text) as IssueDraft;
  if (draft.root !== root || draft.repo !== REPO || typeof draft.title !== "string" || typeof draft.body !== "string" || !/^[0-9a-f]{64}$/.test(draft.fingerprint)) throw new Error("Issue draft belongs to another repository or is invalid.");
  return draft;
}

export function issuePreview(draft: IssueDraft, id: string): string {
  return visible([`Destination: https://github.com/${draft.repo}/issues`, `Includes source code: ${draft.includesCode ? "yes" : "no"}`,
    `Title: ${draft.title}`, "", draft.body, "", `Digest: ${id}`,
    ...humanApprovalInstructions(`pregate issue submit ${id} --yes`)].join("\n"));
}

export async function issue(args: string[], runGh: Gh = gh): Promise<Result> {
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null) return { code: 1, text: "Issue reporting needs a PREGATE preset in this directory or above." };
  return await issueAction(root, args, runGh);
}

async function issueAction(root: string, args: string[], runGh: Gh): Promise<Result> {
  try {
    const [sub, id, ...flags] = args;
    if (sub === "draft") return await draftIssue(root, args.slice(1));
    if (sub === "list") return args.length === 1 ? listFindings(root) : { code: 1, text: USAGE };
    if (id === undefined || !/^[0-9a-f]{64}$/.test(id)) return { code: 1, text: USAGE };
    if (sub === "show" && flags.length === 0) return { code: 0, text: issuePreview(issueReview(root, id), id) };
    if (sub === "submit" && (flags.length === 0 || (flags.length === 1 && flags[0] === "--yes"))) return await submit(root, id, flags.includes("--yes"), runGh);
    return { code: 1, text: USAGE };
  } catch (e) {
    return { code: 1, text: `Cannot report finding: ${(e as Error).message}. Draft retained; if submission began, check GitHub before retrying.` };
  }
}

type DraftOptions = { selected: string; note: string; includesCode: boolean; repro?: string; title?: string };

// Exactly one evidence selector: --last, an event id from `issue list`, or --no-event.
function draftOptions(args: string[]): DraftOptions | null {
  const o: Partial<DraftOptions> & Omit<DraftOptions, "selected"> = { note: "", includesCode: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--include-code") o.includesCode = true;
    else if (a === "--repro" && args[i + 1] !== undefined && !args[i + 1]!.startsWith("--") && o.repro === undefined) o.repro = args[++i]!;
    else if (a === "--note" && args[i + 1] !== undefined) o.note = args[++i]!;
    else if (a === "--title" && args[i + 1] !== undefined && o.title === undefined) o.title = args[++i]!.trim();
    else if ((a === "--last" || a === "--no-event" || /^[0-9a-f]{24}$/.test(a)) && o.selected === undefined) o.selected = a;
    else return null;
  }
  if (o.selected === undefined || (o.includesCode && (o.repro !== undefined || o.selected === "--no-event"))) return null;
  return o as DraftOptions;
}

// Actionable: the call was denied or asked, or a rule enforced or advised (a Stop released at its block limit keeps
// verdict "none" with enforced findings). Shadow and muted observations are not.
function actionable({ event }: Finding): boolean {
  return event.verdict !== "none"
    || event.violations.some((v) => (event.enforcement?.[v.rule] ?? (event.shadowed ? "shadow" : "enforce")) !== "shadow");
}

function selectFinding(root: string, o: DraftOptions): Finding | string {
  const all = findings(root);
  if (o.selected === "--last") {
    if (all.length === 0) return "No finding recorded for this repository.";
    return all.find(actionable) ?? `No actionable finding: the ${all.length} recorded finding(s) are shadow or muted observations only. `
      + "Run `pregate issue list` and draft one by id with --note, or report without evidence: pregate issue draft --no-event --title <title> --note <expected behavior>.";
  }
  const finding = all.find((f) => f.id === o.selected);
  if (finding === undefined) return "No matching finding recorded for this repository. Run `pregate issue list` for event ids.";
  return actionable(finding) || o.note.trim() || o.repro !== undefined ? finding
    : "This finding is a shadow or muted observation only. Explain the expected behavior with --note or attach a public example with --repro.";
}

function fingerprintOf(event: CallEvent | null, title: string | undefined, note: string): string {
  const context = title === undefined ? {} : { reportContext: sha256(JSON.stringify([title, note])) };
  if (event === null) return sha256(JSON.stringify({ event: null, ...context }));
  return sha256(JSON.stringify({ cause: event.form,
    checks: event.dispute?.rules.map((r) => ({ check: r.check, params: r.params })).sort((a, b) => a.check.localeCompare(b.check)), rules: event.violations.map((v) => v.rule).sort(), after: event.afterSha, call: event.afterSha === null ? event.callId : undefined,
    ...(event.ruleChecks ? { versions: event.versions, ruleChecks: Object.fromEntries(Object.entries(event.ruleChecks).sort(([a], [b]) => a.localeCompare(b))) } : {}),
    ...context }));
}

async function reproductionOf(repro: string | undefined): Promise<IssueReproduction | string | undefined> {
  if (repro === undefined) return undefined;
  const files = readFixture(repro);
  await grammars();
  const tested = testFixture(files, clock);
  if (!tested.valid) return "Invalid reproduction; no draft prepared.\n" + tested.lines.join("\n");
  return { files, result: tested.lines.join("\n"), versions: VERSIONS };
}

async function draftIssue(root: string, args: string[]): Promise<Result> {
  const o = draftOptions(args);
  if (o === null) return { code: 1, text: USAGE };
  const { note, title } = o;
  if (title !== undefined && (!title || title.length > 200 || /[\x00-\x1f\x7f]/.test(title) || !note.trim())) return { code: 1, text: "A report title needs 1–200 characters, no control characters, and an explanatory --note." };
  if (o.selected === "--no-event" && title === undefined) return { code: 1, text: "A report without a recorded event needs --title and --note." };
  const finding = o.selected === "--no-event" ? null : selectFinding(root, o);
  if (typeof finding === "string") return { code: 1, text: finding };
  const event = finding?.event ?? null;
  if (o.includesCode && (finding === null || finding.event.afterSha === null)) return { code: 1, text: "This finding has no recorded source content to include." };
  const code = o.includesCode ? findingContent(finding!, finding!.event.afterSha!) : null;
  const reproduction = await reproductionOf(o.repro);
  if (typeof reproduction === "string") return { code: 1, text: reproduction };
  const fingerprint = fingerprintOf(event, title, note);
  const harness = finding?.session.split(":")[0] ?? "not recorded";
  const content = issueContent(event, { harness, note, code, fingerprint, reproduction, title, versions: VERSIONS });
  const draft: IssueDraft = { root, repo: REPO, fingerprint, ...content };
  const text = JSON.stringify(draft), id = sha256(text);
  mkdirSync(join(dataHome(), "issues"), { recursive: true });
  writeAtomic(draftFile(id), text);
  return { code: 0, text: issuePreview(draft, id) };
}

// Newest first, without paths or code: enough to choose an explicit event id.
function listFindings(root: string): Result {
  const all = findings(root);
  if (all.length === 0) return { code: 0, text: "No findings recorded for this repository." };
  const lines = all.slice(0, LIST_LIMIT).map((f) => {
    const { event } = f, rules = [...new Set(event.violations.map((v) => v.rule))];
    const what = event.form ?? (rules.length > 1 ? `${rules[0]} +${rules.length - 1}` : rules[0] ?? "unclassified");
    return `${f.id}  ${new Date(event.at).toISOString().slice(0, 19)}Z  ${event.kind}  ${event.verdict}  ${what}${actionable(f) ? "" : "  (observation only)"}`;
  });
  const older = all.length > LIST_LIMIT ? [`${all.length - LIST_LIMIT} older finding(s) not shown.`] : [];
  return { code: 0, text: [...lines, ...older, "Draft one with: pregate issue draft <id> [--note <expected behavior>]; observations need --note or --repro."].join("\n") };
}

async function submit(root: string, id: string, yes: boolean, runGh: Gh): Promise<Result> {
  const draft = issueReview(root, id);
  const receipt = join(dataHome(), "issues", `${draft.fingerprint}.submitted.json`);
  if (existsSync(receipt)) return { code: 0, text: `Already reported: ${readFileSync(receipt, "utf8").trim()}` };
  if (!await approve(issuePreview(draft, id), false, yes)) return { code: 1, text: "Report not approved; draft retained. Review and approve inside your harness." };
  issueReview(root, id);
  const dir = join(dataHome(), "issues", `${draft.fingerprint}.submitting`);
  const lease = await submissionLease(draft, receipt, dir, runGh);
  if (!("release" in lease)) return lease;
  return await leasedPublish(draft, id, receipt, runGh, lease);
}

async function submissionLease(draft: IssueDraft, receipt: string, dir: string, runGh: Gh): Promise<SubmissionLease | Result> {
  try { return acquireSubmission(dir); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    const owner = submissionOwner(dir);
    if (owner === null || owner.state !== "dead") return { code: 1, text: "This finding has a submission in progress or its owner cannot be proved absent. Check GitHub before retrying; draft retained." };
    if (owner.phase === "creating") {
      const reconciled = await reported(draft, receipt, runGh);
      if (reconciled === null) return { code: 1, text: "Interrupted publication has an uncertain outcome and no matching issue was found. No new issue created; submission marker and draft retained. Inspect GitHub before retrying." };
      if (reconciled.code === 0) releaseAbandonedSubmission(owner);
      return reconciled;
    }
    releaseAbandonedSubmission(owner);
    return acquireSubmission(dir);
  }
}

async function leasedPublish(draft: IssueDraft, id: string, receipt: string, runGh: Gh, lease: SubmissionLease): Promise<Result> {
  try {
    if (existsSync(receipt)) return { code: 0, text: `Already reported: ${readFileSync(receipt, "utf8").trim()}` };
    return await publish(draft, id, receipt, runGh, lease);
  } finally { lease.release(); }
}

async function reported(draft: IssueDraft, receipt: string, runGh: Gh): Promise<Result | null> {
  const found = await runGh(["issue", "list", "--repo", REPO, "--state", "all", "--search", `\"PREGATE-finding: ${draft.fingerprint}\" in:body`, "--json", "url,body", "--limit", "100"]);
  if (found.code !== 0) return unavailable(found);
  const listed = JSON.parse(found.text) as { url: string; body: string }[];
  const existing = listed.find((i) => i.body.includes(`PREGATE-finding: ${draft.fingerprint}`));
  if (existing !== undefined) {
    if (!issueUrl(existing.url)) throw new Error("GitHub returned an unrecognized existing issue URL");
    writeAtomic(receipt, existing.url + "\n");
    return { code: 0, text: `Already reported: ${existing.url}` };
  }
  return null;
}

async function publish(draft: IssueDraft, id: string, receipt: string, runGh: Gh, lease: SubmissionLease): Promise<Result> {
  const existing = await reported(draft, receipt, runGh);
  if (existing !== null) return existing;
  const body = join(dataHome(), "issues", `${id}.body.md`);
  writeAtomic(body, draft.body);
  lease.beforeCreate();
  const created = await runGh(["issue", "create", "--repo", REPO, "--title", draft.title, "--body-file", body]);
  if (created.code !== 0) return { code: 1, text: `${unavailable(created).text}\nPublication outcome is uncertain. Retrying this reviewed draft reconciles the existing issue; it does not issue another create request.` };
  const url = created.text.trim();
  if (!issueUrl(url)) return { code: 1, text: "GitHub returned no recognized issue URL. Check the repository before retrying; draft retained." };
  writeAtomic(receipt, url + "\n");
  lease.confirmed();
  return { code: 0, text: `Reported: ${url}` };
}

function issueUrl(url: string): boolean {
  return /^https:\/\/github\.com\/pedroknigge\/pregate\/issues\/\d+$/.test(url);
}

function unavailable(result: Result): Result {
  return { code: 1, text: `GitHub reporting unavailable; draft retained. Check gh auth status and your connection, then retry.\n${result.text}` };
}

async function gh(args: string[]): Promise<Result> {
  try {
    const proc = (require("node:child_process") as typeof import("node:child_process")).spawnSync("gh", args, { stdio: ["ignore", "pipe", "pipe"], timeout: GH_TIMEOUT_MS,
      killSignal: "SIGKILL", maxBuffer: GH_OUTPUT_BYTES,
      env: { ...process.env, GH_HOST: "github.com", GH_PROMPT_DISABLED: "1", GH_PAGER: "cat" } });
    const error = proc.error as NodeJS.ErrnoException | undefined;
    if (error?.code === "ETIMEDOUT") return { code: 1, text: `gh exceeded its ${GH_TIMEOUT_MS} ms command deadline.` };
    if (error?.code === "ENOBUFS" || [proc.stdout, proc.stderr].some((bytes) => bytes !== null && bytes.length > GH_OUTPUT_BYTES)) {
      return { code: 1, text: "gh exceeded its 16 MiB per-channel output budget." };
    }
    if (error) return { code: 1, text: error.message };
    const code = proc.status ?? 1;
    return { code, text: code === 0 ? proc.stdout.toString()
      : proc.stderr.subarray(0, GH_DIAGNOSTIC_BYTES).toString() || "gh failed or was terminated" };
  } catch (e) { return { code: 1, text: (e as Error).message }; }
}
