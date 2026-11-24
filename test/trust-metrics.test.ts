import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyRecorded, COMPARE_FILE_CAP, judgeAgentPull, readSeed, type RewriteJudgment } from "../scripts/agent-rewrite.ts";
import { buildReport, isoWeek, renderMarkdown, type CommitRecord, type PullRecord, type Report } from "../scripts/trust-metrics.ts";
import { removeTree } from "./remove-tree.ts";

const script = join(import.meta.dir, "../scripts/trust-metrics.ts");

function git(cwd: string, args: string[], at?: string): string {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  delete env.GITHUB_REPOSITORY;
  if (at) {
    env.GIT_AUTHOR_DATE = at;
    env.GIT_COMMITTER_DATE = at;
  }
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=Trust", "-c", "user.email=trust@example.com", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args],
    { cwd, env, stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}\n${result.stderr.toString()}`);
  return result.stdout.toString();
}

function commit(cwd: string, at: string, subject: string, body?: string): void {
  const args = ["commit", "--allow-empty", "-q", "-m", subject];
  if (body !== undefined) args.push("-m", body);
  git(cwd, args, at);
}

function merge(cwd: string, branch: string, at: string, subject: string, body: string): void {
  git(cwd, ["merge", "--no-ff", "--no-commit", branch]);
  commit(cwd, at, subject, body);
}

// One real repository. Counts are the whole assertion: side-branch commits and commits before
// --since are absent, a gap week is present, and each revert signal counts once.
function fixture(cwd: string): void {
  git(cwd, ["init", "-q", "-b", "main"]);
  commit(cwd, "2023-12-15T12:00:00Z", "Old feature (#99)");
  commit(cwd, "2023-12-16T12:00:00Z", 'Revert "old"', "This reverts commit abc.");
  commit(cwd, "2024-01-02T12:00:00Z", "Initial work");
  commit(cwd, "2024-01-03T12:00:00Z", "Add parser (#1)");
  git(cwd, ["checkout", "-q", "-b", "feature"]);
  commit(cwd, "2024-01-03T15:00:00Z", 'Revert "side branch only"', "This reverts commit side.");
  git(cwd, ["checkout", "-q", "main"]);
  merge(cwd, "feature", "2024-01-04T12:00:00Z", "Merge pull request #2 from dev/feature", "Add the feature");
  commit(cwd, "2024-01-04T15:00:00Z", "revert the comment");
  commit(cwd, "2024-01-04T16:00:00Z", "Reverted the comment wording");
  commit(cwd, "2024-01-05T12:00:00Z", 'Revert "Add parser"', "This reverts commit 1111111.");
  commit(cwd, "2024-01-09T12:00:00Z", "Restore notes", "This reverts commit deadbeef.");
  commit(cwd, "2024-01-10T12:00:00Z", 'Revert "Add the feature" (#3)', "This reverts commit 2222222.");
  git(cwd, ["checkout", "-q", "-b", "revert-parser"]);
  commit(cwd, "2024-01-11T11:00:00Z", "side work");
  git(cwd, ["checkout", "-q", "main"]);
  merge(cwd, "revert-parser", "2024-01-11T12:00:00Z", "Merge pull request #5 from dev/revert-parser", 'Revert "Add parser"');
  commit(cwd, "2024-01-22T12:00:00Z", "Document flags (#4)");
}

function run(cwd: string, json: boolean): { status: number; stdout: string; stderr: string } {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  delete env.GITHUB_REPOSITORY;
  const args = [script, "--repo", cwd, "--since", "2024-01-01", "--branch", "main"];
  if (json) args.push("--json");
  const result = Bun.spawnSync([process.execPath, ...args], { cwd, env, stdout: "pipe", stderr: "pipe" });
  return { status: result.exitCode ?? 1, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

test("a repository with known merges and reverts reports those counts", () => {
  const cwd = mkdtempSync(join(tmpdir(), "pregate-trust-"));
  try {
    fixture(cwd);
    const json = run(cwd, true);
    expect(json.status, json.stderr).toBe(0);
    const report = JSON.parse(json.stdout) as Report;
    expect(report.schemaVersion).toBe(1);
    expect(report.branch).toBe("main");
    expect(report.since).toBe("2024-01-01");
    expect(report.source).toBe("git");
    expect(report.truncated).toBe(false);
    expect(report.weeks.map((week) => [week.week, week.start, week.end, week.commits, week.mergedPrs, week.reverts, week.revertRate, week.agentMergedPrs, week.unrewrittenPrs, week.unrewrittenRate, week.medianOpenToMergeSeconds])).toEqual([
      ["2024-W01", "2024-01-01", "2024-01-07", 6, 2, 1, 1 / 2, null, null, null, null],
      ["2024-W02", "2024-01-08", "2024-01-14", 3, 2, 3, 3 / 2, null, null, null, null],
      ["2024-W03", "2024-01-15", "2024-01-21", 0, 0, 0, null, null, null, null, null],
      ["2024-W04", "2024-01-22", "2024-01-28", 1, 1, 0, 0, null, null, null, null],
    ]);
    expect(report.totals).toEqual({ commits: 10, mergedPrs: 5, reverts: 4, revertRate: 4 / 5, agentMergedPrs: null, unrewrittenPrs: null, unrewrittenRate: null, medianOpenToMergeSeconds: null });

    const markdown = run(cwd, false);
    expect(markdown.status, markdown.stderr).toBe(0);
    expect(markdown.stdout).toContain("| Week | Commits to main | Merged PRs | Reverts | Revert rate | Without rewrite | Median open to merge |");
    expect(markdown.stdout).toContain("| 2024-W01 | 6 | 2 | 1 | 1/2 (0.5) | n/a | n/a |");
    expect(markdown.stdout).toContain("| 2024-W02 | 3 | 2 | 3 | 3/2 (1.5) | n/a | n/a |");
    expect(markdown.stdout).toContain("| 2024-W03 | 0 | 0 | 0 | n/a | n/a | n/a |");
    expect(markdown.stdout).toContain("| 2024-W04 | 1 | 1 | 0 | 0/1 (0) | n/a | n/a |");
    expect(markdown.stdout).toContain("| Total | 10 | 5 | 4 | 4/5 (0.8) | n/a | n/a |");
    expect(markdown.stdout).toContain("This reverts commit");
    expect(markdown.stdout).toContain("CURSOR_AGENT_PR_BODY_BEGIN");
    expect(markdown.stdout).toContain("was not merged");
    expect(markdown.stdout).toContain("MAJOR_REWRITE_LINE_FRACTION");
  } finally {
    removeTree(cwd);
  }
});

test("the since window keeps the empty weeks before the first event", () => {
  const report = buildReport({
    commits: [{ sha: "b".repeat(40), committerMs: Date.parse("2024-01-03T12:00:00Z"), subject: "Add (#1)", body: "" }],
    pulls: null,
    since: "2023-12-18",
    branch: "main",
    repository: "example/repo",
    generatedAt: "2024-02-01T00:00:00.000Z",
    truncated: false,
  });
  expect(report.weeks.map((week) => [week.week, week.commits, week.mergedPrs, week.reverts])).toEqual([
    ["2023-W51", 0, 0, 0],
    ["2023-W52", 0, 0, 0],
    ["2024-W01", 1, 1, 0],
  ]);
});

test("ISO weeks follow the Thursday of the week", () => {
  expect(isoWeek(Date.parse("2024-01-01T12:00:00Z"))).toBe("2024-W01");
  expect(isoWeek(Date.parse("2024-12-31T12:00:00Z"))).toBe("2025-W01");
  expect(isoWeek(Date.parse("2021-01-01T12:00:00Z"))).toBe("2020-W53");
});

test("GitHub pull data supplies the median and does not count a revert twice", () => {
  const sha = (digit: string) => digit.repeat(40);
  const at = (value: string) => Date.parse(value);
  const commits: CommitRecord[] = [
    { sha: sha("a"), committerMs: at("2023-12-20T12:00:00Z"), subject: "Old (#99)", body: "" },
    { sha: sha("b"), committerMs: at("2024-01-03T12:00:00Z"), subject: "Add parser (#1)", body: "" },
    { sha: sha("c"), committerMs: at("2024-01-05T12:00:00Z"), subject: 'Revert "Add parser" (#2)', body: "This reverts commit b." },
    { sha: sha("d"), committerMs: at("2024-01-10T12:00:00Z"), subject: "Later (#9)", body: "" },
  ];
  const human = { agent: false, majorRewrite: null };
  const pulls: PullRecord[] = [
    { number: 1, title: "Add parser", createdMs: at("2024-01-01T00:00:00Z"), mergedMs: at("2024-01-03T12:00:00Z"), mergeCommitSha: sha("b"), ...human },
    { number: 1, title: "Add parser", createdMs: at("2024-01-03T11:59:59Z"), mergedMs: at("2024-01-03T12:00:00Z"), mergeCommitSha: sha("b"), ...human },
    { number: 8, title: 'Revert "Other"', createdMs: at("2024-01-04T00:00:00Z"), mergedMs: at("2024-01-05T06:00:00Z"), mergeCommitSha: sha("e"), ...human },
    { number: 2, title: 'Revert "Add parser"', createdMs: at("2024-01-04T00:00:00Z"), mergedMs: at("2024-01-05T12:00:00Z"), mergeCommitSha: sha("c"), ...human },
    { number: 4, title: "Docs", createdMs: at("2024-01-06T11:00:00Z"), mergedMs: at("2024-01-06T12:00:00Z"), mergeCommitSha: null, ...human },
    { number: 11, title: "Follow-up", createdMs: at("2024-01-22T11:58:20Z"), mergedMs: at("2024-01-22T12:00:00Z"), mergeCommitSha: null, ...human },
    { number: 50, title: 'Revert "Ancient"', createdMs: at("2023-11-01T00:00:00Z"), mergedMs: at("2023-12-01T00:00:00Z"), mergeCommitSha: null, ...human },
  ];
  const report = buildReport({
    commits, pulls, since: "2024-01-01", branch: "main", repository: "example/repo", generatedAt: "2024-02-01T00:00:00.000Z", truncated: false,
  });
  // Open-to-merge seconds: 216000, 108000, 129600, 3600, and 100. The duplicate of #1 and the
  // December pull are left out. Sorted, the middle value is 108000. #2 is the revert commit, so
  // the revert title is not a second revert. #8 is. (#9) is a commit subject only.
  expect(report.source).toBe("git+github");
  expect(report.weeks.map((week) => [week.week, week.commits, week.mergedPrs, week.reverts, week.revertRate, week.agentMergedPrs, week.unrewrittenPrs, week.unrewrittenRate, week.medianOpenToMergeSeconds])).toEqual([
    ["2024-W01", 2, 4, 2, 2 / 4, 0, 0, null, (108000 + 129600) / 2],
    ["2024-W02", 1, 0, 0, null, 0, 0, null, null],
    ["2024-W03", 0, 0, 0, null, 0, 0, null, null],
    ["2024-W04", 0, 1, 0, 0, 0, 0, null, 100],
  ]);
  expect(report.totals).toEqual({ commits: 3, mergedPrs: 5, reverts: 2, revertRate: 2 / 5, agentMergedPrs: 0, unrewrittenPrs: 0, unrewrittenRate: null, medianOpenToMergeSeconds: 108000 });
});

test("the weekly workflow stays read-only", () => {
  const text = Bun.file(join(import.meta.dir, "../.github/workflows/review-trust.yml")).text();
  return text.then((workflow) => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("cron:");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pull-requests: read");
    expect(workflow).toContain("actions: write");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).toContain("actions/upload-artifact@");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("pull-requests: write");
    expect(workflow).not.toContain("issues:");
  });
});

const recorded = JSON.parse(readFileSync(join(import.meta.dir, "fixtures/trust-rewrite/cases.json"), "utf8")) as Record<string, {
  pull: unknown;
  commits: unknown;
  reviews: unknown;
  compares: Record<string, unknown>;
}>;

const judgments: Record<string, RewriteJudgment> = {
  "clean-small-follow-up": { agent: true, included: true, majorRewrite: false },
  "major-line-rewrite": { agent: true, included: true, majorRewrite: true },
  "half-is-not-major": { agent: true, included: true, majorRewrite: false },
  "fraction-above": { agent: true, included: true, majorRewrite: true },
  "fraction-below": { agent: true, included: true, majorRewrite: false },
  "dismissed-review-is-first": { agent: true, included: true, majorRewrite: true },
  "replaced-opening-head": { agent: true, included: true, majorRewrite: true },
  "no-review-opening-survives": { agent: true, included: true, majorRewrite: false },
  "human-not-agent": { agent: false, included: false, majorRewrite: null },
  "marker-must-be-exact": { agent: false, included: false, majorRewrite: null },
  "bot-author": { agent: true, included: true, majorRewrite: false },
  "closed-unmerged": { agent: true, included: false, majorRewrite: null },
  "zero-initial-diff": { agent: true, included: true, majorRewrite: false },
  "no-follow-up": { agent: true, included: true, majorRewrite: false },
  "merge-commit-first-parent": { agent: true, included: true, majorRewrite: false },
  "review-commit-missing": { agent: true, included: true, majorRewrite: false },
};

test("recorded GitHub responses classify a major rewrite", () => {
  for (const [name, want] of Object.entries(judgments)) {
    const bundle = recorded[name];
    if (!bundle) throw new Error(`missing fixture ${name}`);
    expect(classifyRecorded(bundle), name).toEqual(want);
  }
});

test("a compare that fills the file cap is not a line rewrite", () => {
  const bundle = structuredClone(recorded["major-line-rewrite"]);
  if (!bundle) throw new Error("missing major-line-rewrite");
  const follow = Object.keys(bundle.compares).find((key) => !key.startsWith("main..."));
  if (!follow) throw new Error("missing follow-up compare");
  const capped = Array.from({ length: COMPARE_FILE_CAP }, () => ({ filename: "src/a.ts", status: "modified", additions: 1, deletions: 0, changes: 1 }));
  bundle.compares[follow] = { files: capped };
  expect(classifyRecorded(bundle)).toEqual({ agent: true, included: true, majorRewrite: false });
  bundle.compares[follow] = { files: capped.slice(0, COMPARE_FILE_CAP - 1) };
  expect(classifyRecorded(bundle)).toEqual({ agent: true, included: true, majorRewrite: true });
});

test("a pull missing its head, or a merged agent pull with no commits, is rejected", () => {
  expect(() => classifyRecorded({
    pull: { number: 4, body: "", user: { type: "User" }, created_at: "2024-01-02T00:00:00Z", merged_at: "2024-01-04T00:00:00Z", base: { ref: "main" } },
    commits: [],
    reviews: [],
    compares: {},
  })).toThrow("head");
  const pull = structuredClone(recorded["clean-small-follow-up"]?.pull);
  expect(() => classifyRecorded({ pull, commits: [], reviews: [], compares: {} })).toThrow("no commits");
});

test("the rewrite threshold is one named constant and detail reads are GET", async () => {
  const rewrite = await Bun.file(join(import.meta.dir, "../scripts/agent-rewrite.ts")).text();
  const report = await Bun.file(join(import.meta.dir, "../scripts/trust-metrics.ts")).text();
  expect(rewrite.match(/0\.5/g)).toEqual(["0.5"]);
  expect(rewrite.match(/CURSOR_AGENT_PR_BODY_BEGIN/g)).toEqual(["CURSOR_AGENT_PR_BODY_BEGIN"]);
  for (const source of [rewrite, report]) {
    expect(source).not.toContain("method: \"POST\"");
    expect(source).not.toContain("method: \"PUT\"");
    expect(source).not.toContain("method: \"PATCH\"");
    expect(source).not.toContain("method: \"DELETE\"");
    expect(source).not.toContain("api.github.com/graphql");
  }
});

function serve(name: string) {
  const bundle = recorded[name];
  if (!bundle) throw new Error(`missing fixture ${name}`);
  const methods: string[] = [];
  const urls: string[] = [];
  const fetchImpl = async (input: string, init: { method: "GET"; headers: Record<string, string>; signal: AbortSignal }) => {
    methods.push(init?.method ?? "(none)");
    const url = String(input);
    urls.push(url);
    let body: unknown;
    if (url.includes("/commits?")) body = bundle.commits;
    else if (url.includes("/reviews?")) body = bundle.reviews;
    else if (url.includes("/compare/")) {
      const spec = decodeURIComponent(url.split("/compare/")[1] ?? "");
      body = bundle.compares[spec];
      if (body === undefined) return new Response(`missing ${spec}`, { status: 404 });
    } else return new Response("unexpected", { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { fetchImpl, methods, urls };
}

test("agent detail reads are GET and a human pull is not fetched", async () => {
  const clean = serve("clean-small-follow-up");
  const cleanSeed = readSeed(recorded["clean-small-follow-up"]?.pull);
  const judged = await judgeAgentPull({ owner: "example", name: "repo" }, cleanSeed, "token", clean.fetchImpl);
  expect(judged).toEqual({ agent: true, included: true, majorRewrite: false });
  expect(clean.methods).toEqual(["GET", "GET", "GET", "GET"]);
  expect(clean.urls.every((url) => url.startsWith("https://api.github.com/repos/example/repo/"))).toBe(true);

  const replaced = serve("replaced-opening-head");
  const replacedSeed = readSeed(recorded["replaced-opening-head"]?.pull);
  const forced = await judgeAgentPull({ owner: "example", name: "repo" }, replacedSeed, "token", replaced.fetchImpl);
  expect(forced.majorRewrite).toBe(true);
  expect(replaced.methods).toEqual(["GET", "GET"]);
  expect(replaced.urls.some((url) => url.includes("/compare/"))).toBe(false);

  const human = serve("human-not-agent");
  const humanSeed = readSeed(recorded["human-not-agent"]?.pull);
  const skipped = await judgeAgentPull({ owner: "example", name: "repo" }, humanSeed, "token", human.fetchImpl);
  expect(skipped).toEqual({ agent: false, included: false, majorRewrite: null });
  expect(human.methods).toEqual([]);
});

test("the without-rewrite rate sits beside the revert rate", () => {
  const sha = (digit: string) => digit.repeat(40);
  const at = (value: string) => Date.parse(value);
  const report = buildReport({
    commits: [{ sha: sha("a"), committerMs: at("2024-01-03T12:00:00Z"), subject: "Add (#1)", body: "" }],
    pulls: [
      { number: 1, title: "Add parser", createdMs: at("2024-01-03T00:00:00Z"), mergedMs: at("2024-01-03T00:00:01Z"), mergeCommitSha: sha("a"), agent: true, majorRewrite: false },
      { number: 2, title: "Rewrite", createdMs: at("2024-01-03T00:00:00Z"), mergedMs: at("2024-01-03T00:00:01Z"), mergeCommitSha: null, agent: true, majorRewrite: true },
      { number: 3, title: "Human", createdMs: at("2024-01-03T00:00:00Z"), mergedMs: at("2024-01-03T00:00:03Z"), mergeCommitSha: null, agent: false, majorRewrite: null },
      { number: 9, title: "Old agent", createdMs: at("2023-12-01T00:00:00Z"), mergedMs: at("2023-12-02T00:00:00Z"), mergeCommitSha: null, agent: true, majorRewrite: false },
    ],
    since: "2024-01-01",
    branch: "main",
    repository: "example/repo",
    generatedAt: "2024-02-01T00:00:00.000Z",
    truncated: false,
  });
  expect(report.weeks.map((week) => [week.week, week.mergedPrs, week.reverts, week.revertRate, week.agentMergedPrs, week.unrewrittenPrs, week.unrewrittenRate])).toEqual([
    ["2024-W01", 3, 0, 0, 2, 1, 1 / 2],
  ]);
  expect(report.totals.agentMergedPrs).toBe(2);
  expect(report.totals.unrewrittenPrs).toBe(1);
  expect(report.totals.unrewrittenRate).toBe(1 / 2);
  const markdown = renderMarkdown(report);
  expect(markdown).toContain("| 2024-W01 | 1 | 3 | 0 | 0/3 (0) | 1/2 (0.5) | 1s |");
  expect(markdown.indexOf("Revert rate")).toBeLessThan(markdown.indexOf("Without rewrite"));
  expect(markdown.indexOf("Without rewrite")).toBeLessThan(markdown.indexOf("Median open to merge"));
});
