import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const tree = join(repoRoot, "test/false-positive-corpus/tree");
const labels = join(repoRoot, "test/false-positive-corpus/labels.json");
const script = join(repoRoot, "scripts/measure-false-positives.ts");
// Frozen commit of test/false-positive-corpus/tree with the identity in pinRepo.
const PIN = "ab3d21c8395b356f93f188c35c65e01e8b645742";

function pinRepo(work: string): string {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(dirname(work), { recursive: true });
  cpSync(tree, work, { recursive: true });
  const home = join(dirname(work), "git-home");
  mkdirSync(home, { recursive: true });
  const env = {
    ...process.env, HOME: home, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "measure", GIT_AUTHOR_EMAIL: "measure@example.com", GIT_AUTHOR_DATE: "2020-01-01T00:00:00Z",
    GIT_COMMITTER_NAME: "measure", GIT_COMMITTER_EMAIL: "measure@example.com", GIT_COMMITTER_DATE: "2020-01-01T00:00:00Z",
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: work, env, stdout: "pipe", stderr: "pipe" });
    if (out.exitCode !== 0) throw new Error(out.stderr.toString());
    return out.stdout.toString().trim();
  };
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("-c", "commit.gpgsign=false", "commit", "-q", "-m", "pin");
  return git("rev-parse", "HEAD");
}

function run(corpus: string, out: string, markdown: string, labelFile: string | null, cache: string, extra: string[] = []) {
  const args = [script, "--no-core", "--packs", join(repoRoot, "test/false-positive-corpus/packs"), "--catalog", join(repoRoot, "catalog"),
    "--corpus", corpus, "--cache", cache, "--out", out, "--markdown", markdown, ...extra];
  if (labelFile) args.push("--labels", labelFile);
  const result = Bun.spawnSync([process.execPath, ...args], { cwd: repoRoot, stdout: "pipe", stderr: "pipe", timeout: 60000 });
  return { status: result.exitCode, stderr: result.stderr.toString(), stdout: result.stdout.toString() };
}

test("false-positive measurement is stable on a pinned fixture corpus", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-fp-e2e-"));
  try {
    const work = join(area, "repo");
    const commit = pinRepo(work);
    expect(commit).toBe(PIN);
    const corpus = join(area, "corpus.json");
    writeFileSync(corpus, JSON.stringify({ entries: [{ id: "pinned-tree", kind: "path", path: work, commit }] }));
    const first = run(corpus, join(area, "a.json"), join(area, "a.md"), labels, join(area, "cache-a"));
    const second = run(corpus, join(area, "b.json"), join(area, "b.md"), labels, join(area, "cache-b"));
    expect(first.status, first.stderr).toBe(0);
    expect(second.status, second.stderr).toBe(0);
    const json = readFileSync(join(area, "a.json"), "utf8");
    const markdown = readFileSync(join(area, "a.md"), "utf8");
    expect(readFileSync(join(area, "b.json"), "utf8")).toBe(json);
    expect(readFileSync(join(area, "b.md"), "utf8")).toBe(markdown);
    const report = JSON.parse(json);
    expect(report.fpRate).toBe("unmeasured");
    expect(report.corpus).toEqual([expect.objectContaining({ id: "pinned-tree", kind: "path", commit, sourceFiles: 6, parsed: 6, syntaxErrors: [] })]);
    expect(report.findings.map((finding: { rule: string; path: string; line: number }) => [finding.rule, finding.path, finding.line])).toEqual([
      ["sample/SAMPLE-ALERT-001", "src/alert.js", 2],
      ["sample/SAMPLE-EVAL-001", "src/member.js", 2],
      ["sample/SAMPLE-EVAL-001", "src/run.js", 2],
      ["sample/SAMPLE-EVAL-001", "src/twice.js", 2],
    ]);
    // twice.js calls eval twice on one line: two raw matches, one site, one finding.
    expect(report.rawMatches).toBe(5);
    expect(report.labeledSample).toMatchObject({ correct: 1, falsePositive: 0, uncertain: 0, unlabeledFindings: 3, unmatchedLabels: [] });
    expect(report.labeledSample.items[0].note).toContain("calls eval");
    expect(report.fixtureDensity).toMatchObject({
      checks: 3, rules: 3, fixtures: 7, positiveFixtures: 4, negativeFixtures: 3, invalidFixtures: 0,
      checksWithNoPositiveFixture: ["sample/gaps/no-debugger"],
      checksWithNoNegativeFixture: ["sample/gaps/no-alert"],
      rulesWithNoPositiveFixture: ["sample/SAMPLE-DEBUG-001"],
      rulesWithNoNegativeFixture: ["sample/SAMPLE-ALERT-001"],
      fixturesPerRule: { min: 1, median: 1, max: 5 },
    });
    const pack = report.packs[0];
    expect(pack).toMatchObject({ ns: "sample", activation: "combined", findings: 4, fpRate: "unmeasured", idleRules: 0, compileErrors: [] });
    expect(pack.rulesTest.failLines.filter((line: string) => line.includes("no-eval-call"))).toEqual([]);
    expect(pack.rulesTest.failLines.some((line: string) => line.includes("no-debugger") && line.includes("needs at least 2 fail fixtures"))).toBe(true);
    expect(pack.rulesTest.failLines.some((line: string) => line.includes("no-alert") && line.includes("needs at least 2 pass fixtures"))).toBe(true);
    expect(markdown).toContain("**False-positive rate: unmeasured.**");
    expect(markdown).toContain(commit);

    const allLabeled = {
      items: report.findings.map((finding: { corpus: string; pack: string; methodology: string; rule: string; path: string; line: number; symbol: string }, index: number) => ({
        corpus: finding.corpus, pack: finding.pack, methodology: finding.methodology, rule: finding.rule, path: finding.path, line: finding.line, symbol: finding.symbol,
        verdict: index === 0 ? "false-positive" : "correct", note: "Accounting check for a fully labeled fixture corpus.",
      })),
    };
    const labelFile = join(area, "all-labels.json");
    writeFileSync(labelFile, JSON.stringify(allLabeled));
    const rated = run(corpus, join(area, "rated.json"), join(area, "rated.md"), labelFile, join(area, "cache-c"));
    expect(rated.status, rated.stderr).toBe(0);
    expect(JSON.parse(readFileSync(join(area, "rated.json"), "utf8")).fpRate).toEqual({ falsePositives: 1, labeledFindings: 4 });

    writeFileSync(corpus, JSON.stringify({ entries: [{ id: "pinned-tree", kind: "path", path: work, commit: "0".repeat(40) }] }));
    const rejected = run(corpus, join(area, "bad.json"), join(area, "bad.md"), null, join(area, "cache-d"));
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain("does not match HEAD");
  } finally { rmSync(area, { recursive: true, force: true }); }
});

test("the committed report agrees with the committed labels", () => {
  const markdown = readFileSync(join(repoRoot, "docs/benchmarks/false-positives.md"), "utf8");
  const labelDoc = JSON.parse(readFileSync(join(repoRoot, "docs/benchmarks/labels.json"), "utf8")) as { items: { verdict: string }[] };
  const count = (verdict: string) => labelDoc.items.filter((item) => item.verdict === verdict).length;
  const summary = /Labeled sample \(not a rate\): (\d+) correct, (\d+) false-positive, (\d+) uncertain, (\d+) unlabeled findings\./.exec(markdown);
  expect(summary).not.toBeNull();
  expect(markdown).toContain("Every label matched a finding.");
  expect([Number(summary![1]), Number(summary![2]), Number(summary![3])]).toEqual([count("correct"), count("false-positive"), count("uncertain")]);
  const table = markdown.slice(markdown.indexOf("## Labeled sample"), markdown.indexOf("## Limits"));
  const rows = table.split("\n").filter((line) => /^\| (correct|false-positive|uncertain) \|/.test(line));
  expect(rows.length).toBe(labelDoc.items.length);
  const total = /recorded \*\*(\d+) findings\*\*/.exec(markdown);
  expect(total).not.toBeNull();
  expect(Number(total![1])).toBe(labelDoc.items.length + Number(summary![4]));
});

test("an offline full corpus is skipped and does not rewrite results", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-fp-offline-"));
  try {
    const corpus = join(area, "corpus.json");
    const out = join(area, "out.json");
    const markdown = join(area, "out.md");
    writeFileSync(corpus, JSON.stringify({ entries: [{ id: "offline", kind: "git", url: "https://127.0.0.1:1/offline.git", commit: "0".repeat(40), sha256: "a".repeat(64) }] }));
    const skipped = run(corpus, out, markdown, null, join(area, "cache"), ["--skip-offline"]);
    expect(skipped.status, skipped.stderr).toBe(0);
    expect(skipped.stderr).toContain("skipped (offline)");
    expect(existsSync(out)).toBe(false);
    expect(existsSync(markdown)).toBe(false);
    const failed = run(corpus, out, markdown, null, join(area, "cache-required"));
    expect(failed.status).not.toBe(0);
    expect(existsSync(out)).toBe(false);
  } finally { rmSync(area, { recursive: true, force: true }); }
});
