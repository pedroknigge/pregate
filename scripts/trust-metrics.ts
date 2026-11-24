// Merged pull requests, reverts, and agent pull requests that avoided a major rewrite, per ISO week.
//
// Usage:
//   bun scripts/trust-metrics.ts [--since YYYY-MM-DD] [--json] [--repo <path>] [--branch <name>]
//
// The default report is markdown on stdout. `--json` prints the same report as JSON.
// History comes from `git log --first-parent` on this checkout. When `GITHUB_TOKEN` is set and
// `origin` is a github.com repository, merged pull requests, the median time from open to merge,
// and the without-rewrite rate come from the GitHub REST API. The script only sends GET. It does
// not push or comment. Without a token, the without-rewrite rate is absent, same as the median.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { judgeAgentPull, readSeed, rewriteLimits, type AgentSeed } from "./agent-rewrite.ts";

const USAGE = "usage: trust-metrics.ts [--since YYYY-MM-DD] [--json] [--repo <path>] [--branch <name>]";
const MAX_PULL_PAGES = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const LIMITS = [
  "Commits are the first-parent history of the selected branch. A commit that is only on a merged side branch is not a commit on that branch.",
  "The week is the ISO week, in UTC, of the committer date. That is when the commit was written onto this history. The author date can be earlier.",
  "Without GitHub pull data, a merged pull request is a first-parent commit whose subject is `Merge pull request #N` or ends with `(#N)`. The same number counts once, in the week of the latest such commit. A rebase merge that does not record the number is not counted. An earlier `(#N)` in the same subject is not a second pull request.",
  "A revert counts once per commit when the subject starts with the word Revert, or the message contains `This reverts commit`, or the pull request title starts with the word Revert. A following letter, as in Reverted, does not. For a `Merge pull request` commit, the pull request title is the first body line. A revert title that belongs to a commit already counted is not counted again.",
  "A squash-merge body often quotes an intermediate revert, including the line `This reverts commit`. That commit is counted even when the pull request itself landed and was not later undone. The rate is an upper bound on landed work that was reverted, not that count.",
  "The revert rate is reverts divided by merged pull requests in the same week. The rate is absent when that week has no merged pull request. A revert that was not a pull request still counts in the numerator.",
  "The median open-to-merge time is merged_at minus created_at for pull requests the GitHub API reports as merged in that week. It is absent when the API was not used. An even count uses the mean of the two central values. With pull data, merged pull request counts come from the API, not from commit subjects.",
  "The API scan reads at most 5,000 recently updated closed pull requests. When that cap stops the scan early, truncated is true.",
  "These numbers do not say who approved a change, whether review was required, or whether a revert was a product failure. A revert of a revert counts.",
  ...rewriteLimits(),
];

export interface CommitRecord {
  sha: string;
  committerMs: number;
  subject: string;
  body: string;
}

export interface PullRecord {
  number: number;
  title: string;
  createdMs: number;
  mergedMs: number;
  mergeCommitSha: string | null;
  agent: boolean;
  majorRewrite: boolean | null;
}

export interface WeekRow {
  week: string;
  start: string;
  end: string;
  commits: number;
  mergedPrs: number;
  reverts: number;
  revertRate: number | null;
  agentMergedPrs: number | null;
  unrewrittenPrs: number | null;
  unrewrittenRate: number | null;
  medianOpenToMergeSeconds: number | null;
}

export interface Report {
  schemaVersion: 1;
  repository: string;
  branch: string;
  since: string | null;
  generatedAt: string;
  source: "git" | "git+github";
  truncated: boolean;
  limits: string[];
  totals: {
    commits: number;
    mergedPrs: number;
    reverts: number;
    revertRate: number | null;
    agentMergedPrs: number | null;
    unrewrittenPrs: number | null;
    unrewrittenRate: number | null;
    medianOpenToMergeSeconds: number | null;
  };
  weeks: WeekRow[];
}

interface Options {
  since: string | null;
  json: boolean;
  repo: string;
  branch: string | null;
}

interface WeekTally {
  commits: number;
  reverts: number;
  mergedPrs: number;
  agentMerged: number;
  unrewritten: number;
  durations: number[];
}

export function parseSince(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`--since must be YYYY-MM-DD, got ${value}`);
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw new Error(`--since is not a calendar date: ${value}`);
  return ms;
}

export function isoWeek(ms: number): string {
  const date = new Date(ms);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const year = utc.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((utc.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekStartMs(week: string): number {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match?.[1] || !match[2]) throw new Error(`bad ISO week ${week}`);
  const year = Number(match[1]);
  const n = Number(match[2]);
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  const monday = jan4 - (jan4Day - 1) * DAY_MS;
  return monday + (n - 1) * 7 * DAY_MS;
}

function dayString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function startsWithRevertWord(text: string): boolean {
  return /^Revert(?![A-Za-z0-9])/.test(text.trim());
}

function embeddedPullTitle(subject: string, body: string): string | null {
  if (!/^Merge pull request #\d+\b/.test(subject.trim())) return null;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function pullNumber(subject: string): number | null {
  const trimmed = subject.trim();
  const merge = /^Merge pull request #(\d+)\b/.exec(trimmed);
  if (merge?.[1]) return Number(merge[1]);
  const squash = /\(#(\d+)\)\s*$/.exec(trimmed);
  if (squash?.[1]) return Number(squash[1]);
  return null;
}

export function isRevertCommit(subject: string, body: string): boolean {
  if (startsWithRevertWord(subject)) return true;
  if (body.includes("This reverts commit")) return true;
  const title = embeddedPullTitle(subject, body);
  return title !== null && startsWithRevertWord(title);
}

function rate(reverts: number, merged: number): number | null {
  if (merged === 0) return null;
  return reverts / merged;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (left === undefined || right === undefined) return null;
  return (left + right) / 2;
}

function blankWeek(): WeekTally {
  return { commits: 0, reverts: 0, mergedPrs: 0, agentMerged: 0, unrewritten: 0, durations: [] };
}

export function buildReport(input: {
  commits: CommitRecord[];
  pulls: PullRecord[] | null;
  since: string | null;
  branch: string;
  repository: string;
  generatedAt: string;
  truncated: boolean;
}): Report {
  const sinceMs = input.since === null ? null : parseSince(input.since);
  const included = input.commits.filter((commit) => sinceMs === null || commit.committerMs >= sinceMs);
  const weeks = new Map<string, WeekTally>();
  const revertShas = new Set<string>();
  const revertPulls = new Set<number>();
  const ensure = (week: string): WeekTally => {
    const found = weeks.get(week);
    if (found) return found;
    const created = blankWeek();
    weeks.set(week, created);
    return created;
  };

  for (const commit of included) {
    if (!isRevertCommit(commit.subject, commit.body)) continue;
    revertShas.add(commit.sha);
    const number = pullNumber(commit.subject);
    if (number !== null) revertPulls.add(number);
  }
  for (const commit of included) {
    const week = isoWeek(commit.committerMs);
    const row = ensure(week);
    row.commits += 1;
    if (revertShas.has(commit.sha)) row.reverts += 1;
  }

  if (input.pulls === null) {
    const latest = new Map<number, { ms: number; week: string }>();
    for (const commit of included) {
      const number = pullNumber(commit.subject);
      if (number === null) continue;
      const week = isoWeek(commit.committerMs);
      const previous = latest.get(number);
      if (!previous || commit.committerMs >= previous.ms) latest.set(number, { ms: commit.committerMs, week });
    }
    for (const item of latest.values()) ensure(item.week).mergedPrs += 1;
  } else {
    const seen = new Set<number>();
    for (const pull of input.pulls) {
      if (sinceMs !== null && pull.mergedMs < sinceMs) continue;
      if (seen.has(pull.number)) continue;
      seen.add(pull.number);
      const row = ensure(isoWeek(pull.mergedMs));
      row.mergedPrs += 1;
      const represented = (pull.mergeCommitSha !== null && revertShas.has(pull.mergeCommitSha)) || revertPulls.has(pull.number);
      if (startsWithRevertWord(pull.title) && !represented) row.reverts += 1;
      if (pull.agent && pull.majorRewrite !== null) {
        row.agentMerged += 1;
        if (!pull.majorRewrite) row.unrewritten += 1;
      }
      if (Number.isFinite(pull.createdMs) && Number.isFinite(pull.mergedMs)) row.durations.push((pull.mergedMs - pull.createdMs) / 1000);
    }
  }

  const keys = [...weeks.keys()].sort();
  const earliest = keys[0];
  const last = keys[keys.length - 1];
  if (earliest && last) {
    const sinceWeek = sinceMs === null ? earliest : isoWeek(sinceMs);
    let cursor = sinceWeek < earliest ? sinceWeek : earliest;
    for (let guard = 0; cursor !== last; guard += 1) {
      if (guard > 2000) throw new Error(`ISO week did not advance from ${cursor} toward ${last}`);
      ensure(cursor);
      const next = isoWeek(weekStartMs(cursor) + 7 * DAY_MS);
      if (next <= cursor) throw new Error(`ISO week did not advance from ${cursor}`);
      cursor = next;
    }
  }

  const ordered = [...weeks.keys()].sort();
  const rows: WeekRow[] = ordered.map((week) => {
    const row = weeks.get(week) ?? blankWeek();
    const start = weekStartMs(week);
    return {
      week,
      start: dayString(start),
      end: dayString(start + 6 * DAY_MS),
      commits: row.commits,
      mergedPrs: row.mergedPrs,
      reverts: row.reverts,
      revertRate: rate(row.reverts, row.mergedPrs),
      agentMergedPrs: input.pulls === null ? null : row.agentMerged,
      unrewrittenPrs: input.pulls === null ? null : row.unrewritten,
      unrewrittenRate: input.pulls === null ? null : rate(row.unrewritten, row.agentMerged),
      medianOpenToMergeSeconds: median(row.durations),
    };
  });
  const durations = ordered.flatMap((week) => weeks.get(week)?.durations ?? []);
  const commits = rows.reduce((sum, row) => sum + row.commits, 0);
  const mergedPrs = rows.reduce((sum, row) => sum + row.mergedPrs, 0);
  const reverts = rows.reduce((sum, row) => sum + row.reverts, 0);
  const agentMergedPrs = input.pulls === null ? null : rows.reduce((sum, row) => sum + (row.agentMergedPrs ?? 0), 0);
  const unrewrittenPrs = input.pulls === null ? null : rows.reduce((sum, row) => sum + (row.unrewrittenPrs ?? 0), 0);
  return {
    schemaVersion: 1,
    repository: input.repository,
    branch: input.branch,
    since: input.since,
    generatedAt: input.generatedAt,
    source: input.pulls === null ? "git" : "git+github",
    truncated: input.truncated,
    limits: LIMITS,
    totals: {
      commits,
      mergedPrs,
      reverts,
      revertRate: rate(reverts, mergedPrs),
      agentMergedPrs,
      unrewrittenPrs,
      unrewrittenRate: agentMergedPrs === null || unrewrittenPrs === null ? null : rate(unrewrittenPrs, agentMergedPrs),
      medianOpenToMergeSeconds: median(durations),
    },
    weeks: rows,
  };
}

export function formatRate(reverts: number, merged: number): string {
  if (merged === 0) return "n/a";
  const shown = Math.round((reverts / merged) * 1000) / 1000;
  return `${reverts}/${merged} (${shown})`;
}

function formatOptionalRate(part: number | null, whole: number | null): string {
  if (part === null || whole === null) return "n/a";
  return formatRate(part, whole);
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "n/a";
  const sign = seconds < 0 ? "-" : "";
  let rest = Math.round(Math.abs(seconds));
  const days = Math.floor(rest / 86400);
  rest -= days * 86400;
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  rest -= minutes * 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (parts.length === 0 || rest) parts.push(`${rest}s`);
  return sign + parts.join(" ");
}

export function renderMarkdown(report: Report): string {
  const since = report.since ?? "the first commit";
  const source = report.source === "git+github" ? "git and GitHub" : "git";
  const lines = [
    "# Review trust",
    "",
    `Repository \`${report.repository}\`. Branch \`${report.branch}\`. Commits from ${since} UTC, grouped by the ISO week of the committer date. Source: ${source}. Generated ${report.generatedAt}.`,
    "",
    "| Week | Commits to main | Merged PRs | Reverts | Revert rate | Without rewrite | Median open to merge |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.weeks.map((week) => `| ${week.week} | ${week.commits} | ${week.mergedPrs} | ${week.reverts} | ${formatRate(week.reverts, week.mergedPrs)} | ${formatOptionalRate(week.unrewrittenPrs, week.agentMergedPrs)} | ${formatDuration(week.medianOpenToMergeSeconds)} |`),
    `| Total | ${report.totals.commits} | ${report.totals.mergedPrs} | ${report.totals.reverts} | ${formatRate(report.totals.reverts, report.totals.mergedPrs)} | ${formatOptionalRate(report.totals.unrewrittenPrs, report.totals.agentMergedPrs)} | ${formatDuration(report.totals.medianOpenToMergeSeconds)} |`,
    "",
  ];
  if (report.truncated) lines.push("The GitHub pull-request scan stopped at 5,000 closed pull requests. Later pages were not read.", "");
  lines.push("## Limits", "");
  for (const limit of report.limits) lines.push(`- ${limit}`);
  lines.push("");
  return lines.join("\n");
}

export function renderJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function git(repo: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function resolveBranch(repo: string, requested: string | null): string {
  if (requested) {
    git(repo, ["rev-parse", "--verify", "--quiet", `${requested}^{commit}`]);
    return requested;
  }
  for (const name of ["main", "origin/main", "master", "origin/master"]) {
    const result = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${name}^{commit}`], { cwd: repo, encoding: "utf8" });
    if (result.status === 0) return name;
  }
  return "HEAD";
}

function githubSlug(repo: string): { owner: string; name: string } | null {
  const result = spawnSync("git", ["remote", "get-url", "origin"], { cwd: repo, encoding: "utf8" });
  if (result.status !== 0) return null;
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(result.stdout.trim());
  if (!match?.[1] || !match[2]) return null;
  return { owner: match[1], name: match[2].replace(/\.git$/, "") };
}

export function readCommits(repo: string, branch: string, sinceMs: number | null): CommitRecord[] {
  const args = ["log", branch, "--first-parent", "-z", "--pretty=format:%H%x1f%cI%x1f%s%x1f%b"];
  if (sinceMs !== null) args.push(`--since=${new Date(sinceMs - 1000).toISOString()}`);
  const raw = git(repo, args);
  const commits: CommitRecord[] = [];
  for (const record of raw.split("\0")) {
    if (!record.trim()) continue;
    const parts = record.split("\x1f");
    const sha = parts[0]?.trim() ?? "";
    const date = parts[1]?.trim() ?? "";
    const subject = (parts[2] ?? "").replaceAll("\r", "");
    const body = parts.slice(3).join("\x1f").replaceAll("\r", "");
    if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error(`unexpected git log record starting ${sha.slice(0, 24)}`);
    const committerMs = Date.parse(date);
    if (Number.isNaN(committerMs)) throw new Error(`commit ${sha} has no committer date`);
    if (sinceMs !== null && committerMs < sinceMs) continue;
    commits.push({ sha, committerMs, subject, body });
  }
  return commits;
}

interface ListedPull extends AgentSeed {
  title: string;
  updatedMs: number;
  mergeCommitSha: string | null;
}

function asPulls(value: unknown): ListedPull[] {
  if (!Array.isArray(value)) throw new Error("GitHub pull list was not an array");
  const pulls: ListedPull[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") throw new Error("GitHub pull list had a non-object entry");
    const row = item as Record<string, unknown>;
    const seed = readSeed(item);
    const title = row.title;
    const updated = row.updated_at;
    const sha = row.merge_commit_sha;
    if (typeof title !== "string" || typeof updated !== "string") throw new Error(`pull #${seed.number} was missing title or updated_at`);
    if (sha !== null && sha !== undefined && typeof sha !== "string") throw new Error(`pull #${seed.number} merge_commit_sha was not a string`);
    const updatedMs = Date.parse(updated);
    if (Number.isNaN(updatedMs)) throw new Error(`pull #${seed.number} has no updated_at`);
    pulls.push({ ...seed, title, updatedMs, mergeCommitSha: typeof sha === "string" ? sha : null });
  }
  return pulls;
}

async function fetchPulls(remote: { owner: string; name: string }, sinceMs: number | null, auth: string): Promise<{ pulls: ListedPull[]; truncated: boolean }> {
  const pulls: ListedPull[] = [];
  const seen = new Set<number>();
  for (let page = 1; page <= MAX_PULL_PAGES; page += 1) {
    const url = `https://api.github.com/repos/${encodeURIComponent(remote.owner)}/${encodeURIComponent(remote.name)}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${auth}`,
        "User-Agent": "pregate-trust-metrics",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`GitHub API ${response.status} for ${remote.owner}/${remote.name}: ${detail}`);
    }
    const batch = asPulls(await response.json());
    if (batch.length === 0) return { pulls, truncated: false };
    let oldest = Number.POSITIVE_INFINITY;
    for (const pull of batch) {
      if (pull.updatedMs < oldest) oldest = pull.updatedMs;
      if (pull.mergedMs === null || seen.has(pull.number)) continue;
      if (sinceMs !== null && pull.mergedMs < sinceMs) continue;
      seen.add(pull.number);
      pulls.push(pull);
    }
    const more = batch.length === 100 && (sinceMs === null || oldest >= sinceMs);
    if (!more) return { pulls, truncated: false };
    if (page === MAX_PULL_PAGES) return { pulls, truncated: true };
  }
  return { pulls, truncated: true };
}

function parseArgs(argv: string[]): Options {
  const options: Options = { since: null, json: false, repo: process.cwd(), branch: null };
  const args = [...argv];
  const take = (flag: string): string => {
    const value = args.shift();
    if (value === undefined || value.startsWith("--")) throw new Error(`missing value for ${flag}\n${USAGE}`);
    return value;
  };
  while (args.length > 0) {
    const flag = args.shift();
    if (flag === "--help" || flag === "-h") {
      process.stdout.write(`${USAGE}\n`);
      process.exit(0);
    } else if (flag === "--since") options.since = take("--since");
    else if (flag === "--json") options.json = true;
    else if (flag === "--repo") options.repo = resolve(take("--repo"));
    else if (flag === "--branch") options.branch = take("--branch");
    else throw new Error(`unknown argument ${flag ?? ""}\n${USAGE}`);
  }
  if (options.since !== null) parseSince(options.since);
  options.repo = resolve(options.repo);
  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const branch = resolveBranch(options.repo, options.branch);
  const sinceMs = options.since === null ? null : parseSince(options.since);
  const commits = readCommits(options.repo, branch, sinceMs);
  const remote = githubSlug(options.repo);
  const auth = process.env.GITHUB_TOKEN?.trim() || null;
  let pulls: PullRecord[] | null = null;
  let truncated = false;
  if (auth && remote) {
    const fetched = await fetchPulls(remote, sinceMs, auth);
    truncated = fetched.truncated;
    const judged: PullRecord[] = [];
    for (const listed of fetched.pulls) {
      if (listed.mergedMs === null) continue;
      const result = await judgeAgentPull(remote, listed, auth);
      judged.push({
        number: listed.number,
        title: listed.title,
        createdMs: listed.createdMs,
        mergedMs: listed.mergedMs,
        mergeCommitSha: listed.mergeCommitSha,
        agent: result.agent,
        majorRewrite: result.majorRewrite,
      });
    }
    pulls = judged;
  }
  const repository = remote ? `${remote.owner}/${remote.name}` : options.repo;
  const report = buildReport({
    commits,
    pulls,
    since: options.since,
    branch,
    repository,
    generatedAt: new Date().toISOString(),
    truncated,
  });
  process.stdout.write(options.json ? renderJson(report) : renderMarkdown(report));
  const share = formatOptionalRate(report.totals.unrewrittenPrs, report.totals.agentMergedPrs);
  console.error(`trust: ${report.weeks.length} weeks, ${report.totals.mergedPrs} merged PRs, ${report.totals.reverts} reverts, without rewrite ${share}, source ${report.source}`);
}

if (import.meta.main) {
  main().then(() => undefined, (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
