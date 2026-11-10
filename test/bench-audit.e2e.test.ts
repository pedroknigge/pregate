import { expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { applyLabels, type FindingSite, type PackPrecision, type SampleLabel } from "../scripts/precision.ts";
import { removeTree } from "./remove-tree.ts";

const repoRoot = join(import.meta.dir, "..");
const tree = join(repoRoot, "test/false-positive-corpus/tree");
const script = join(repoRoot, "scripts/bench-audit-repos.ts");
const PIN = "ab3d21c8395b356f93f188c35c65e01e8b645742";

function pinRepo(work: string): string {
  removeTree(work);
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

interface RunFiles { area: string; corpus: string; labels: string; out: string; markdown: string; findings: string }

function run(files: RunFiles, extra: string[] = []) {
  const args = [script, "--precision", "--packs", join(repoRoot, "test/false-positive-corpus/packs"), "--catalog", join(repoRoot, "catalog"),
    "--corpus", files.corpus, "--labels", files.labels, "--cache", join(files.area, "cache"), "--out", files.out, "--markdown", files.markdown, "--findings", files.findings, ...extra];
  return Bun.spawnSync([process.execPath, ...args], { cwd: repoRoot, stdout: "pipe", stderr: "pipe", timeout: 120000 });
}

test("precision audit runs every fixture pack and withholds precision for unlabeled packs", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-precision-e2e-"));
  try {
    const work = join(area, "repo");
    const commit = pinRepo(work);
    expect(commit).toBe(PIN);
    const corpus = join(area, "corpus.json");
    writeFileSync(corpus, JSON.stringify({ entries: [{ id: "pinned-tree", language: "javascript", kind: "path", path: work, commit }] }));
    const labels = join(area, "labels");
    mkdirSync(labels);
    const first = run({ area, corpus, labels, out: join(area, "a.json"), markdown: join(area, "a.md"), findings: join(area, "findings.json") });
    expect(first.exitCode, first.stderr.toString()).toBe(0);
    const findings = JSON.parse(readFileSync(join(area, "findings.json"), "utf8")) as FindingSite[];
    const sampleFindings = findings.filter((finding) => finding.pack === "sample");
    expect(sampleFindings.map((finding) => [finding.rule, finding.path, finding.line])).toEqual([
      ["sample/SAMPLE-ALERT-001", "src/alert.js", 2],
      ["sample/SAMPLE-EVAL-001", "src/member.js", 2],
      ["sample/SAMPLE-EVAL-001", "src/run.js", 2],
      ["sample/SAMPLE-EVAL-001", "src/twice.js", 2],
    ]);
    const unlabeled = readFileSync(join(area, "a.md"), "utf8");
    expect(unlabeled).toContain("| sample | 4 | 0 | 0 | 0 | unmeasured |");
    expect(unlabeled).not.toMatch(/\| sample \| 4 \| 0 \| 0 \| 0 \| \d+\/\d+ \|/);
    const chosen = sampleFindings.filter((finding) => finding.path === "src/run.js" || finding.path === "src/member.js");
    const sample: SampleLabel[] = chosen.map((finding, index) => ({
      ...finding,
      verdict: index === 0 ? "false-positive" : "true-positive",
      note: index === 0 ? "member.js calls eval on a property. The rule's own note says a member call still compiles the string, so this label is the false one only for the accounting check." : "run calls eval on its parameter. That is the call the rule describes.",
    }));
    writeFileSync(join(labels, "sample.json"), JSON.stringify({ labeler: "maintainer", pack: "sample", items: sample }));
    const second = run({ area, corpus, labels, out: join(area, "b.json"), markdown: join(area, "b.md"), findings: join(area, "findings-b.json") });
    expect(second.exitCode, second.stderr.toString()).toBe(0);
    const report = JSON.parse(readFileSync(join(area, "b.json"), "utf8")) as { packs: PackPrecision[]; sample: SampleLabel[] };
    const names = report.packs.map((pack) => pack.pack);
    expect(applyLabels(names, findings, sample).packs).toEqual(report.packs);
    expect(report.packs.find((pack) => pack.pack === "sample")).toMatchObject({ labeled: 2, precision: 0.5 });
    expect(report.packs.find((pack) => pack.pack === "core")?.precision).toBeNull();
    const markdown = readFileSync(join(area, "b.md"), "utf8");
    expect(markdown).toContain("| sample | 4 | 2 | 1 | 1 | 1/2 |");
    expect(markdown).toContain("unmeasured");
    expect(markdown).toContain(commit);
    writeFileSync(join(labels, "missing.json"), JSON.stringify({
      labeler: "maintainer", pack: "sample",
      items: [{ ...findings[0], line: 99, verdict: "true-positive", note: "This line has no finding." }],
    }));
    const rejected = run({ area, corpus, labels, out: join(area, "c.json"), markdown: join(area, "c.md"), findings: join(area, "findings-c.json") });
    expect(rejected.exitCode).not.toBe(0);
    expect(rejected.stderr.toString()).toContain("did not match a finding");
  } finally { removeTree(area); }
});
