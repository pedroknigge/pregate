// Merged agent pull requests that did not take a major rewrite.
//
// The pull list this report already fetches identifies an agent pull request:
// the body contains AGENT_PULL_BODY_MARKER, or user.type is Bot. Cursor's agent
// opens the pull request on the human account and writes that marker, so the
// login is not the signal.
//
// The initial head is the tip of the commits still on the pull request whose
// committer date is at or before the pull request was opened. The initial diff
// is the three-dot compare of the base ref to that commit. Changed lines are
// additions plus deletions.
//
// The first review is the earliest review with submitted_at. A review with no
// submitted_at is still pending. Follow-up lines are the three-dot compare from
// that review's commit to the pull request head. When the head has more than
// one parent, the compare ends at the first parent, so a merge of the base
// branch is not follow-up work.
//
// A major rewrite is those follow-up lines being more than
// MAJOR_REWRITE_LINE_FRACTION of the initial diff, or the opening head being
// gone. A push that is not forced cannot drop the opening commit, so a missing
// opening head is a force-push that replaced it. The REST commit list does not
// keep the discarded sha. A rewritten commit that keeps an old committer date
// still looks like the opening head.
//
// A closed pull request that was not merged is excluded. A merged agent pull
// request with no submitted review stays in the denominator. The line rule does
// not apply to it. A replaced opening head still does.
//
// Every request is a GET. The caller skips this module when GITHUB_TOKEN is
// unset, and the rate is then absent.

/** Follow-up changed lines must exceed this fraction of the initial diff.
 * Other repositories use 0.3. This is the only threshold. */
export const MAJOR_REWRITE_LINE_FRACTION = 0.5;

/** Cursor writes this into the body when an agent opens the pull request. */
export const AGENT_PULL_BODY_MARKER = "<!-- CURSOR_AGENT_PR_BODY_BEGIN -->";

/** A compare payload lists at most this many files. That length is not a full line count. */
export const COMPARE_FILE_CAP = 300;

const SHA = /^[0-9a-f]{40}$/i;
const DETAIL_PAGE = 100;
const MAX_DETAIL_PAGES = 20;

export interface AgentSeed {
  number: number;
  body: string;
  userType: string | null;
  createdMs: number;
  mergedMs: number | null;
  headSha: string;
  baseRef: string;
}

export interface RewriteJudgment {
  agent: boolean;
  included: boolean;
  majorRewrite: boolean | null;
}

interface CommitFact {
  sha: string;
  committerMs: number;
  parents: string[];
}

interface ReviewFact {
  id: number;
  submittedMs: number;
  commitSha: string;
}

interface Activity {
  seed: AgentSeed;
  agent: boolean;
  included: boolean;
  commits: CommitFact[];
  review: ReviewFact | null;
  replaced: boolean;
  initialHead: string | null;
  follow: string | null;
}

export function isAgentPull(body: string, userType: string | null): boolean {
  if (userType === "Bot") return true;
  return body.includes(AGENT_PULL_BODY_MARKER);
}

export function rewriteLimits(): string[] {
  return [
    `An agent pull request is one whose body contains \`${AGENT_PULL_BODY_MARKER}\`, or whose user type is Bot. Cursor's agent opens the pull request on the human account and writes that marker. The pull list already includes the body and the user type. A human pull request without the marker is not an agent pull request.`,
    "The without-rewrite rate is merged agent pull requests that were not a major rewrite, divided by merged agent pull requests in that week. The week is the ISO week of merged_at. A closed pull request that was not merged is excluded. A merged agent pull request with no submitted review stays in the denominator. The rate is absent when the API was not used, and when the week has no merged agent pull request. The total divides the totals.",
    `A major rewrite is a follow-up after the first submitted review whose changed lines are more than ${MAJOR_REWRITE_LINE_FRACTION} of the initial diff's changed lines, or a force-push that replaced the initial head. Changed lines are additions plus deletions. Equal to ${MAJOR_REWRITE_LINE_FRACTION} is not a major rewrite. The fraction is the constant MAJOR_REWRITE_LINE_FRACTION. Other repositories use 0.3.`,
    "The initial head is the tip of the commits still on the pull request whose committer date is at or before the pull request was opened. The tip is the commit in that set that is not a parent of another commit in that set. When several commits qualify, the latest committer date is the tip, and a bytewise-later sha breaks a tie. The initial diff is the three-dot compare of the base ref to that commit. When no commit is dated at or before open, the opening head is gone. A push that is not forced cannot drop it, so that pull request was force-pushed and the initial head was replaced. A rewritten commit that keeps a committer date at or before open is still on the list, and this report does not call that a replaced head.",
    `The first review is the earliest pull request review that has submitted_at. A review with no submitted_at is pending and is not first. Dismissed reviews count. Follow-up lines are the three-dot compare from that review's commit to the pull request head. When the head has more than one parent, the compare ends at the first parent, so merging the base branch is not a follow-up. The line rule does not apply when there is no submitted review, when the review's commit is no longer on the pull request, when the initial diff has 0 changed lines, or when a compare returns ${COMPARE_FILE_CAP} files. A list of that length is the compare endpoint's cap, and a partial sum is not used.`,
  ];
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} was not an object`);
  return value as Record<string, unknown>;
}

function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} was not an array`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} was not a string`);
  return value;
}

function sha(value: string, label: string): string {
  if (!SHA.test(value)) throw new Error(`${label} was not a sha`);
  return value;
}

export function readSeed(value: unknown): AgentSeed {
  const row = object(value, "GitHub pull");
  const number = row.number;
  if (typeof number !== "number") throw new Error("GitHub pull number was not a number");
  const body = row.body === null || row.body === undefined ? "" : row.body;
  if (typeof body !== "string") throw new Error(`pull #${number} body was not a string`);
  let userType: string | null = null;
  if (row.user !== null && row.user !== undefined) {
    const user = object(row.user, `pull #${number} user`);
    if (typeof user.type !== "string") throw new Error(`pull #${number} user type was not a string`);
    userType = user.type;
  }
  const createdMs = Date.parse(text(row.created_at, `pull #${number} created_at`));
  if (Number.isNaN(createdMs)) throw new Error(`pull #${number} has no created_at`);
  const merged = row.merged_at;
  if (merged !== null && merged !== undefined && typeof merged !== "string") throw new Error(`pull #${number} merged_at was not a string`);
  const mergedMs = typeof merged === "string" ? Date.parse(merged) : null;
  if (mergedMs !== null && Number.isNaN(mergedMs)) throw new Error(`pull #${number} has no merged_at`);
  const head = object(row.head, `pull #${number} head`);
  const base = object(row.base, `pull #${number} base`);
  const headSha = sha(text(head.sha, `pull #${number} head sha`), `pull #${number} head`);
  const baseRef = text(base.ref, `pull #${number} base ref`);
  if (baseRef.includes("...") || headSha.includes("...")) throw new Error(`pull #${number} compare ref is ambiguous`);
  return { number, body, userType, createdMs, mergedMs, headSha, baseRef };
}

function readCommitList(value: unknown): CommitFact[] {
  const commits: CommitFact[] = [];
  for (const item of list(value, "GitHub commit list")) {
    const row = object(item, "GitHub commit");
    const commitSha = sha(text(row.sha, "GitHub commit sha"), "GitHub commit sha");
    const commit = object(row.commit, "GitHub commit object");
    const committer = object(commit.committer, "GitHub committer");
    const committerMs = Date.parse(text(committer.date, "GitHub committer date"));
    if (Number.isNaN(committerMs)) throw new Error(`commit ${commitSha} has no committer date`);
    const parents: string[] = [];
    for (const parent of list(row.parents, "GitHub commit parents")) {
      const entry = object(parent, "GitHub commit parent");
      parents.push(sha(text(entry.sha, "GitHub commit parent sha"), `commit ${commitSha} parent`));
    }
    commits.push({ sha: commitSha, committerMs, parents });
  }
  return commits;
}

function readReviews(value: unknown): ReviewFact[] {
  const reviews: ReviewFact[] = [];
  for (const item of list(value, "GitHub review list")) {
    const row = object(item, "GitHub review");
    const submitted = row.submitted_at;
    if (submitted === null || submitted === undefined) continue;
    if (typeof submitted !== "string") throw new Error("GitHub review submitted_at was not a string");
    const submittedMs = Date.parse(submitted);
    const id = row.id;
    if (typeof id !== "number" || Number.isNaN(submittedMs)) throw new Error("GitHub review was missing id or submitted_at");
    const commitSha = sha(text(row.commit_id, "GitHub review commit_id"), "GitHub review commit_id");
    reviews.push({ id, submittedMs, commitSha });
  }
  return reviews;
}

function firstReview(reviews: ReviewFact[]): ReviewFact | null {
  let best: ReviewFact | null = null;
  for (const review of reviews) {
    if (!best || review.submittedMs < best.submittedMs || (review.submittedMs === best.submittedMs && review.id < best.id)) best = review;
  }
  return best;
}

function tipOf(commits: CommitFact[]): string | null {
  if (commits.length === 0) return null;
  const tips = commits.filter((commit) => !commits.some((other) => other.parents.includes(commit.sha)));
  if (tips.length === 0) return null;
  tips.sort((left, right) => left.committerMs - right.committerMs || (left.sha < right.sha ? -1 : left.sha > right.sha ? 1 : 0));
  return tips[tips.length - 1]?.sha ?? null;
}

function followTip(commits: CommitFact[], headSha: string): string | null {
  const head = commits.find((commit) => commit.sha === headSha);
  if (!head) return null;
  if (head.parents.length > 1) {
    const first = head.parents[0];
    if (first && commits.some((commit) => commit.sha === first)) return first;
  }
  return head.sha;
}

function readActivity(pull: unknown, commits: unknown, reviews: unknown): Activity {
  const seed = readSeed(pull);
  const agent = isAgentPull(seed.body, seed.userType);
  const empty: Activity = { seed, agent, included: false, commits: [], review: null, replaced: false, initialHead: null, follow: null };
  if (seed.mergedMs === null || !agent) return empty;
  const parsed = readCommitList(commits);
  if (parsed.length === 0) throw new Error(`pull #${seed.number} has no commits`);
  const opening = parsed.filter((commit) => commit.committerMs <= seed.createdMs);
  const replaced = opening.length === 0;
  if (!replaced && !parsed.some((commit) => commit.sha === seed.headSha)) throw new Error(`pull #${seed.number} head is not in its commit list`);
  const initialHead = replaced ? null : tipOf(opening);
  if (!replaced && initialHead === null) throw new Error(`pull #${seed.number} opening commits have no tip`);
  const review = firstReview(readReviews(reviews));
  let follow: string | null = null;
  if (!replaced && review && parsed.some((commit) => commit.sha === review.commitSha)) follow = followTip(parsed, seed.headSha);
  return { seed, agent, included: true, commits: parsed, review, replaced, initialHead, follow };
}

function lineKeys(activity: Activity): { initial: string; follow: string } | null {
  if (!activity.included || activity.replaced || !activity.review || !activity.initialHead || !activity.follow) return null;
  if (activity.follow === activity.review.commitSha) return null;
  return { initial: `${activity.seed.baseRef}...${activity.initialHead}`, follow: `${activity.review.commitSha}...${activity.follow}` };
}

function changedLines(value: unknown, key: string): number | null {
  if (value === undefined) throw new Error(`missing compare ${key}`);
  const row = object(value, `compare ${key}`);
  const files = list(row.files, `compare ${key} files`);
  if (files.length >= COMPARE_FILE_CAP) return null;
  let lines = 0;
  for (const file of files) {
    const item = object(file, `compare ${key} file`);
    const additions = item.additions;
    const deletions = item.deletions;
    if (typeof additions !== "number" || typeof deletions !== "number") throw new Error(`compare ${key} file was missing additions or deletions`);
    lines += additions + deletions;
  }
  return lines;
}

function judgeActivity(activity: Activity, compares: Record<string, unknown>): RewriteJudgment {
  if (!activity.included) return { agent: activity.agent, included: false, majorRewrite: null };
  if (activity.replaced) return { agent: true, included: true, majorRewrite: true };
  const keys = lineKeys(activity);
  if (!keys || keys.initial === keys.follow) return { agent: true, included: true, majorRewrite: false };
  const initialLines = changedLines(compares[keys.initial], keys.initial);
  const followLines = changedLines(compares[keys.follow], keys.follow);
  if (initialLines === null || followLines === null || initialLines === 0) return { agent: true, included: true, majorRewrite: false };
  return { agent: true, included: true, majorRewrite: followLines > MAJOR_REWRITE_LINE_FRACTION * initialLines };
}

export function classifyRecorded(bundle: {
  pull: unknown;
  commits: unknown;
  reviews: unknown;
  compares: Record<string, unknown>;
}): RewriteJudgment {
  return judgeActivity(readActivity(bundle.pull, bundle.commits, bundle.reviews), bundle.compares);
}

function requiredCompareKeys(pull: unknown, commits: unknown, reviews: unknown): string[] {
  const keys = lineKeys(readActivity(pull, commits, reviews));
  if (!keys || keys.initial === keys.follow) return [];
  return [keys.initial, keys.follow];
}

function authHeaders(auth: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${auth}`,
    "User-Agent": "pregate-trust-metrics",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

interface GithubResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

type GithubGet = (url: string, init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal }) => Promise<GithubResponse>;

async function getJson(fetchImpl: GithubGet, auth: string, url: string): Promise<unknown> {
  const response = await fetchImpl(url, { method: "GET", headers: authHeaders(auth), signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`GitHub API ${response.status} for ${url}: ${detail}`);
  }
  return response.json() as Promise<unknown>;
}

async function pages(fetchImpl: GithubGet, auth: string, url: string, label: string): Promise<unknown[]> {
  const joined = url.includes("?") ? "&" : "?";
  const all: unknown[] = [];
  for (let page = 1; page <= MAX_DETAIL_PAGES; page += 1) {
    const batch = list(await getJson(fetchImpl, auth, `${url}${joined}per_page=${DETAIL_PAGE}&page=${page}`), label);
    all.push(...batch);
    if (batch.length < DETAIL_PAGE) return all;
  }
  throw new Error(`${label} returned more than ${MAX_DETAIL_PAGES * DETAIL_PAGE} items`);
}

function pathPart(value: string): string {
  return encodeURIComponent(value).replaceAll("%2F", "/");
}

function pullFromSeed(seed: AgentSeed): Record<string, unknown> {
  return {
    number: seed.number,
    body: seed.body,
    user: seed.userType === null ? null : { type: seed.userType },
    created_at: new Date(seed.createdMs).toISOString(),
    merged_at: seed.mergedMs === null ? null : new Date(seed.mergedMs).toISOString(),
    head: { sha: seed.headSha },
    base: { ref: seed.baseRef },
  };
}

export async function judgeAgentPull(
  remote: { owner: string; name: string },
  seed: AgentSeed,
  auth: string,
  fetchImpl: GithubGet = (url, init) => fetch(url, init),
): Promise<RewriteJudgment> {
  const agent = isAgentPull(seed.body, seed.userType);
  if (seed.mergedMs === null || !agent) return { agent, included: false, majorRewrite: null };
  const root = `https://api.github.com/repos/${encodeURIComponent(remote.owner)}/${encodeURIComponent(remote.name)}`;
  const commits = await pages(fetchImpl, auth, `${root}/pulls/${seed.number}/commits`, `pull #${seed.number} commits`);
  const reviews = await pages(fetchImpl, auth, `${root}/pulls/${seed.number}/reviews`, `pull #${seed.number} reviews`);
  const pull = pullFromSeed(seed);
  const compares: Record<string, unknown> = {};
  for (const key of requiredCompareKeys(pull, commits, reviews)) {
    const parts = key.split("...");
    const base = parts[0];
    const head = parts[1];
    if (!base || !head || parts.length !== 2) throw new Error(`bad compare ${key}`);
    compares[key] = await getJson(fetchImpl, auth, `${root}/compare/${pathPart(base)}...${pathPart(head)}`);
  }
  return classifyRecorded({ pull, commits, reviews, compares });
}
