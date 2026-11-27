// CI providers Pregate can require. GitHub Actions and Vercel are separate providers: a
// repository may use one, the other, or both. Callers aggregate the required set and fail
// closed. Nothing in here reads the network or the filesystem.

const CI_PROVIDER_IDS = ["github-actions", "vercel"] as const;
export type CiProviderId = (typeof CI_PROVIDER_IDS)[number];

type CiVerdict = "pass" | "fail" | "pending" | "missing";

const RANK: Record<CiVerdict, number> = { pass: 0, pending: 1, missing: 2, fail: 3 };

function worse(left: CiVerdict, right: CiVerdict): CiVerdict {
  return RANK[left] >= RANK[right] ? left : right;
}

export interface RawGitHubSignal {
  kind: "commit-status" | "check-run";
  name: string;
  /** Commit-status state, or a completed check run's conclusion. Empty when the run is not finished. */
  state: string;
  /** Check-run progress (`queued`, `in_progress`, `completed`). Empty for a commit status. */
  status: string;
  description: string;
  url: string | null;
  appSlug: string | null;
}

export interface CiSignal {
  provider: CiProviderId;
  kind: RawGitHubSignal["kind"];
  name: string;
  verdict: CiVerdict;
  raw: string;
  description: string;
  url: string | null;
}

interface ProviderJudgement {
  id: CiProviderId;
  required: boolean;
  /** Check names that must each pass. Vercel leaves this empty and requires every Vercel signal. */
  checks: string[];
  verdict: CiVerdict;
  signals: CiSignal[];
}

export interface CiJudgement {
  verdict: CiVerdict;
  providers: ProviderJudgement[];
}

// Vercel for GitHub writes one commit status per deployed project. A single project uses the
// context "Vercel". Additional projects use "Vercel – <project>" with a Unicode en dash (U+2013).
// The ASCII hyphen form is the same context with the dash characters substituted, so a status is
// not dropped because a client normalized the dash. Other Vercel checks (preview comments) are
// not deployment results and do not match.
const VERCEL_CONTEXT = /^Vercel$|^Vercel \u2013 \S(?:.*\S)?$|^Vercel - \S(?:.*\S)?$/;
const FAILURE_WORD = /\b(error|errored|failed|failure|canceled|cancelled)\b/i;
const SKIPPED_WORD = /\b(skipped|ignored)\b/i;
const FAILED_STATE = new Set([
  "failure", "error", "cancelled", "canceled", "timed_out", "action_required", "stale", "startup_failure", "skipped", "neutral",
]);
const PENDING_PROGRESS = new Set(["queued", "in_progress", "pending", "waiting", "requested"]);

export function isVercelContext(name: string): boolean {
  return VERCEL_CONTEXT.test(name);
}

// Vercel deployment states are Ready, Error and Canceled. GitHub stores those as a status state
// plus a description (Ready → success, Error → failure, Canceled → error or cancelled). A
// description that contradicts a success, or a skipped deployment, is not Ready.
export function deploymentVerdict(state: string, status: string, description: string): CiVerdict {
  const terminal = state.trim().toLowerCase();
  const progress = status.trim().toLowerCase();
  if (FAILURE_WORD.test(description) || SKIPPED_WORD.test(description)) return "fail";
  if (FAILED_STATE.has(terminal)) return "fail";
  if (terminal === "success") return "pass";
  if (terminal === "pending" || terminal === "" || PENDING_PROGRESS.has(progress)) {
    if (progress === "completed") return "fail";
    return "pending";
  }
  return "fail";
}

function actionsVerdict(state: string, status: string): CiVerdict {
  const terminal = state.trim().toLowerCase();
  const progress = status.trim().toLowerCase();
  if (terminal === "success") return "pass";
  if (FAILED_STATE.has(terminal)) return "fail";
  if (terminal === "pending" || terminal === "" || PENDING_PROGRESS.has(progress)) {
    if (progress === "completed") return "fail";
    return "pending";
  }
  return "fail";
}

function signal(provider: CiProviderId, raw: RawGitHubSignal, verdict: CiVerdict): CiSignal {
  const rawState = raw.state.trim() || raw.status.trim() || "unknown";
  return {
    provider, kind: raw.kind, name: raw.name, verdict, raw: rawState, description: raw.description, url: raw.url,
  };
}

// A GitHub Actions check belongs to Pregate when its name is one this repository's workflows
// require, or the generated workflow's job name. Checks from other apps are not Actions.
function classifyActions(raw: RawGitHubSignal, requiredNames: readonly string[]): CiSignal | null {
  if (raw.kind !== "check-run") return null;
  if (raw.appSlug !== null && raw.appSlug !== "github-actions") return null;
  const known = requiredNames.includes(raw.name) || raw.name === "pregate" || raw.name === "PREGATE";
  if (!known) return null;
  return signal("github-actions", raw, actionsVerdict(raw.state, raw.status));
}

// A Vercel deployment status or check run. The Vercel GitHub app's other checks stay out.
function classifyVercel(raw: RawGitHubSignal): CiSignal | null {
  if (!isVercelContext(raw.name)) return null;
  if (raw.appSlug === "github-actions") return null;
  if (raw.kind === "check-run" && raw.appSlug !== null && raw.appSlug !== "vercel") return null;
  return signal("vercel", raw, deploymentVerdict(raw.state, raw.status, raw.description));
}

export function classify(raw: RawGitHubSignal, actionChecks: readonly string[]): CiSignal | null {
  return classifyVercel(raw) ?? classifyActions(raw, actionChecks);
}

export interface ProviderExpectation {
  id: CiProviderId;
  required: boolean;
  checks: string[];
}

function judgeOne(expectation: ProviderExpectation, signals: CiSignal[]): ProviderJudgement {
  const mine = signals.filter((item) => item.provider === expectation.id);
  if (!expectation.required) {
    const verdict = mine.length === 0 ? "missing" : mine.reduce((verdict, item) => worse(verdict, item.verdict), "pass" as CiVerdict);
    return { id: expectation.id, required: false, checks: expectation.checks, verdict, signals: mine };
  }
  if (expectation.id === "github-actions") {
    if (expectation.checks.length === 0) {
      return { id: expectation.id, required: true, checks: [], verdict: "missing", signals: mine };
    }
    const verdict = expectation.checks.reduce<CiVerdict>((soFar, name) => {
      const hits = mine.filter((item) => item.name === name);
      const one = hits.length === 0 ? "missing" : hits.reduce<CiVerdict>((verdict, item) => worse(verdict, item.verdict), "pass");
      return worse(soFar, one);
    }, "pass");
    return { id: expectation.id, required: true, checks: expectation.checks, verdict, signals: mine };
  }
  const verdict = mine.length === 0 ? "missing" : mine.reduce((soFar, item) => worse(soFar, item.verdict), "pass" as CiVerdict);
  return { id: expectation.id, required: true, checks: [], verdict, signals: mine };
}

// Required providers only. An empty required set fails closed: there is nothing to trust.
// One failing or missing required provider fails the whole result. Pending stays pending
// until every required provider has passed.
export function judge(expectations: readonly ProviderExpectation[], signals: readonly CiSignal[]): CiJudgement {
  const providers = CI_PROVIDER_IDS.map((id) => {
    const expectation = expectations.find((item) => item.id === id) ?? { id, required: false, checks: [] };
    return judgeOne(expectation, [...signals]);
  });
  const required = providers.filter((item) => item.required);
  const verdict = required.length === 0 ? "missing" : required.reduce((soFar, item) => worse(soFar, item.verdict), "pass" as CiVerdict);
  return { verdict, providers };
}

// Job names in a workflow file whose steps run Pregate. The generated template's check run is
// the job id `pregate`. A job `name:` is what GitHub shows, so that wins over the id.
export function pregateJobNames(yaml: string): string[] {
  const names: string[] = [];
  let inJobs = false;
  let jobId: string | null = null;
  let jobName: string | null = null;
  let inSteps = false;
  let mentions = false;
  const flush = (): void => {
    if (jobId !== null && mentions) names.push(jobName ?? jobId);
    jobId = null;
    jobName = null;
    inSteps = false;
    mentions = false;
  };
  for (const line of yaml.split(/\r?\n/)) {
    if (/^jobs:\s*(?:#.*)?$/.test(line)) {
      flush();
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(line)) {
      flush();
      inJobs = false;
      continue;
    }
    const job = /^ {2}([A-Za-z0-9_-]+):\s*(?:#.*)?$/.exec(line);
    if (job) {
      flush();
      jobId = job[1]!;
      continue;
    }
    if (jobId === null) continue;
    if (/^ {4}steps:\s*(?:#.*)?$/.test(line)) {
      inSteps = true;
      continue;
    }
    if (!inSteps) {
      const named = /^ {4}name:\s*(.+?)\s*(?:#.*)?$/.exec(line);
      if (named && jobName === null) jobName = unquote(named[1]!);
    }
    const code = line.replace(/#.*$/, "");
    if (/\bpregate\b/i.test(code)) mentions = true;
  }
  flush();
  return names;
}

function unquote(value: string): string {
  const quoted = /^(['"])(.*)\1$/.exec(value.trim());
  return quoted ? quoted[2]! : value.trim();
}
