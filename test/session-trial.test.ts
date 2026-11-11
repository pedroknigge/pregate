import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classify, EMPTY, type Finding, type HookCall, type Label, type Manifest, page, percentile, plan, planText, type Run, sarifFindings, type Session, summarize,
} from "../scripts/session-trial-evidence.ts";
import { manifest, published } from "../scripts/session-trial.ts";

const RULE = "clean-code/CC-ER-002";
const call = (at: number, decision: HookCall["decision"], path: string | null, over: Partial<HookCall> = {}): HookCall => ({
  at, event: "pre-edit", tool: "Write", path, decision, shadowed: false, cause: null, findings: decision === "allow" || path === null ? [] : [{ rule: RULE, path, line: 3 }],
  message: decision === "allow" ? null : "PREGATE DENY", evaluationMs: 10, deniedContent: null, ...over,
});
const found = (path: string): Finding => ({ rule: RULE, path, line: 3 });

test("a denial followed by an accepted edit to the same file, with a clean final tree, is repaired", () => {
  const [d] = classify([call(1, "deny", "src/a.ts"), call(2, "allow", "src/a.ts")], ["src/a.ts"], []);
  expect(d).toMatchObject({ file: "src/a.ts", rule: RULE, attempts: 1, laterAccepted: true, finalClean: true, outcome: "repaired" });
});

test("two denials of one file and rule are one denial with two attempts", () => {
  const denials = classify([call(1, "deny", "src/a.ts"), call(2, "deny", "src/a.ts"), call(3, "allow", "src/a.ts")], ["src/a.ts"], []);
  expect(denials).toHaveLength(1);
  expect(denials[0]).toMatchObject({ attempts: 2, outcome: "repaired" });
});

test("a denial with no later accepted edit and an unchanged file is abandoned", () => {
  const [d] = classify([call(1, "deny", "src/a.ts"), call(2, "allow", "src/b.ts")], ["src/b.ts"], []);
  expect(d).toMatchObject({ laterAccepted: false, changed: false, outcome: "abandoned" });
});

test("a finding of the denied rule in the final file is worked-around, even after an accepted edit", () => {
  expect(classify([call(1, "deny", "src/a.ts")], ["src/a.ts"], [found("src/a.ts")])[0]!.outcome).toBe("worked-around");
  expect(classify([call(1, "deny", "src/a.ts"), call(2, "allow", "src/a.ts")], ["src/a.ts"], [found("src/a.ts")])[0]!.outcome).toBe("worked-around");
});

test("a file that changed although the gate accepted no edit to it is worked-around", () => {
  const [d] = classify([call(1, "deny", "src/a.ts")], ["src/a.ts"], []);
  expect(d).toMatchObject({ changed: true, finalClean: true, outcome: "worked-around" });
});

test("what the records cannot decide is unknown", () => {
  // An accepted edit before the denial already changed the file.
  expect(classify([call(1, "allow", "src/a.ts"), call(2, "deny", "src/a.ts")], ["src/a.ts"], [])[0]!.outcome).toBe("unknown");
  // The final check did not run.
  expect(classify([call(1, "deny", "src/a.ts"), call(2, "allow", "src/a.ts")], ["src/a.ts"], null)[0]!.outcome).toBe("unknown");
  expect(classify([call(1, "deny", "src/a.ts")], null, null)[0]!.outcome).toBe("unknown");
  // A refused shell command names no file.
  const [command] = classify([call(1, "deny", null, { event: "pre-command", tool: "Bash", cause: "control-command" })], [], []);
  expect(command).toMatchObject({ file: null, rule: "cause:control-command", outcome: "unknown" });
});

test("a finding of another rule or another file does not change the outcome", () => {
  const other = [{ rule: "clean-code/CC-FN-001", path: "src/a.ts", line: 1 }, found("src/b.ts")];
  expect(classify([call(1, "deny", "src/a.ts"), call(2, "allow", "src/a.ts")], ["src/a.ts"], other)[0]!.outcome).toBe("repaired");
});

test("one call that denies two files gives one denial per file", () => {
  const patch = call(1, "deny", "src/a.ts", { findings: [found("src/a.ts"), found("src/b.ts")] });
  expect(classify([patch], [], []).map((d) => d.file)).toEqual(["src/a.ts", "src/b.ts"]);
});

test("the SARIF report of the check gives rule, path and line; other text gives null", () => {
  const sarif = JSON.stringify({ runs: [{ results: [{ ruleId: RULE, locations: [{ physicalLocation: { artifactLocation: { uri: "src/a.ts" }, region: { startLine: 4 } } }] }] }] });
  expect(sarifFindings(sarif)).toEqual([{ rule: RULE, path: "src/a.ts", line: 4 }]);
  expect(sarifFindings(JSON.stringify({ runs: [{ results: [] }] }))).toEqual([]);
  expect(sarifFindings("PREGATE DENY git-error")).toBeNull();
  expect(sarifFindings("{}")).toBeNull();
});

const TASKS: Manifest = {
  selection: "chosen by hand", repositories: [{ id: "r", url: "https://example.invalid/r.git", commit: "c".repeat(40) }],
  tasks: [{ id: "r-one", repo: "r", prompt: "one", verify: null }, { id: "r-two", repo: "r", prompt: "two", verify: "true" }],
};

test("the plan is every selected task with every harness in every arm, and it counts the model sessions", () => {
  const all = plan(TASKS, { harnesses: [], repos: [], tasks: [], arms: [] });
  if (typeof all === "string") throw new Error(all);
  expect(all.map((s) => s.id)).toEqual(["r-one.claude-code.gated", "r-one.claude-code.control", "r-one.codex.gated", "r-one.codex.control",
    "r-two.claude-code.gated", "r-two.claude-code.control", "r-two.codex.gated", "r-two.codex.control"]);
  const text = planText(all, "not started");
  expect(text).toContain("Model sessions: 8");
  expect(text).toContain(`r  https://example.invalid/r.git  ${"c".repeat(40)}`);
  expect(text).toContain("Nothing was run.");
  const one = plan(TASKS, { harnesses: ["codex"], repos: [], tasks: ["r-two"], arms: ["gated"] });
  expect(typeof one === "string" ? one : one.map((s) => s.id)).toEqual(["r-two.codex.gated"]);
});

test("the plan refuses a harness, arm, repository or task that it does not know", () => {
  expect(plan(TASKS, { harnesses: ["cursor" as "codex"], repos: ["x"], tasks: ["y"], arms: ["blind" as "gated"] })).toBe("unknown harness: cursor; unknown arm: blind; unknown repo: x; unknown task: y");
});

test("the committed manifest plans 12 tasks, each neutral, on repositories pinned by a full commit", () => {
  const m = manifest();
  expect(m.repositories.every((r) => /^[0-9a-f]{40}$/.test(r.commit) && r.url.startsWith("https://github.com/"))).toBe(true);
  expect(m.tasks).toHaveLength(12);
  expect(new Set(m.tasks.map((t) => t.id)).size).toBe(12);
  for (const t of m.tasks) expect(t.prompt, t.id).not.toMatch(/pregate|\brules?\b|\bstyle\b|\blint|clean code|contract/i);
  const all = plan(m, { harnesses: [], repos: [], tasks: [], arms: [] });
  expect(typeof all === "string" ? all : all.length).toBe(48);
});

const RUN: Run = { schemaVersion: 1, kind: "real", id: "2026-11-11T00:00:00.000Z", engine: "0.0.7", platform: "darwin arm64", cli: { codex: "codex-cli 1" }, contracts: { r: { packs: "core@1", rules: "9 block" } }, sessions: [] };
function session(arm: "gated" | "control", over: Partial<Session> = {}): Session {
  const hooks = arm === "gated" ? [call(1, "deny", "src/a.ts"), call(2, "allow", "src/a.ts", { evaluationMs: 30 })] : [];
  return {
    id: `r-one.codex.${arm}`, harness: "codex", cliVersion: "codex-cli 1", model: null, arm, repo: "r", commit: "c".repeat(40), task: "r-one", wallMs: 61_000, exitCode: 0, timedOut: false,
    contractMatchesReference: arm === "gated" ? true : null, hookCalls: arm === "gated" ? { total: 4, pre: 2, stop: 1, sessionStart: 1 } : null, hooks,
    denials: classify(hooks, ["src/a.ts"], []), noNew: { ran: true, exit: arm === "gated" ? 0 : 1, findings: arm === "gated" ? [] : [found("src/a.ts")], error: null },
    verify: "pass", changed: ["src/a.ts"], diff: "x.diff", ...over,
  };
}
const LABEL: Label = { run: RUN.id, session: "r-one.codex.gated", file: "src/a.ts", rule: RULE, verdict: "true-positive", note: "The handler was empty.", labeler: "A. Person" };

test("the summary counts per session and attaches a label only to the denial it names in this run", () => {
  const s = summarize(RUN, "chosen by hand", [session("gated"), session("control")], [LABEL, { ...LABEL, run: "another" }, { ...LABEL, rule: "other/RULE" }]);
  expect(s.sessions.map((r) => [r.arm, r.hookCalls, r.recorded, r.denied, r.noNew, r.noNewRules])).toEqual([["gated", 4, 2, 1, 0, []], ["control", null, 0, 0, 1, [RULE]]]);
  expect(s.sessions[0]!.evaluationMs).toEqual([10, 30]);
  expect(s.denials).toHaveLength(1);
  expect(s.denials[0]).toMatchObject({ session: "r-one.codex.gated", outcome: "repaired", verdict: "true-positive", labeler: "A. Person" });
  expect(s.labelsForAnotherRun).toBe(1);
  expect(summarize(RUN, "", [session("gated")], []).denials[0]).toMatchObject({ verdict: null, labeler: null });
});

test("a final check that did not run is not counted as zero findings", () => {
  const s = summarize(RUN, "", [session("control", { noNew: { ran: false, exit: 1, findings: [], error: "git-error" } })], []);
  expect(s.sessions[0]!.noNew).toBeNull();
  expect(page(s)).toContain("check did not run");
});

test("the page of a real run states the counts, with labeled and unlabeled denials apart", () => {
  const text = page(summarize(RUN, "chosen by hand", [session("gated"), session("control")], []));
  expect(text).toContain("2 sessions ran: 1 gated and 1 control.");
  expect(text).toContain("**1** (file, rule) pairs in the gated sessions: 1 repaired, 0 abandoned, 0 worked-around, 0 unknown.");
  expect(text).toContain("reported **0** findings in the gated arm and **1** in the control arm");
  expect(text).toContain("Labels: 0 of 1 denials are labeled (0 true-positive, 0 false-positive, 0 unclear); 1 are unlabeled.");
  expect(text).toContain(`| r-one | codex | 0 | 1 | ${RULE} | pass | pass |`);
  expect(text).toContain("## What this does not establish");
  expect(text).not.toContain("Self-check data");
  expect(text).not.toContain("No real session has been run");
  const labeled = page(summarize(RUN, "", [session("gated")], [LABEL]));
  expect(labeled).toContain("Labels: 1 of 1 denials are labeled (1 true-positive, 0 false-positive, 0 unclear); 0 are unlabeled.");
  expect(labeled).toContain("| r-one.codex.gated | `src/a.ts` | `clean-code/CC-ER-002` | 1 | repaired | true-positive | A. Person | The handler was empty. |");
});

test("the page with no run says that no real session has been run and shows no result table", () => {
  const text = page({ ...EMPTY, selection: "chosen by hand" });
  expect(text).toContain("**No real session has been run.**");
  expect(text).toContain("## What this does not establish");
  expect(text).toContain("chosen by hand");
  for (const heading of ["## Run\n", "## Denials", "## Sessions", "## Gated and control", "## Reading"]) expect(text).not.toContain(heading);
});

test("a self-check summary carries a banner and no hand-written reading", () => {
  const text = page(summarize({ ...RUN, kind: "self-check" }, "", [session("gated")], []));
  expect(text).toContain("**Self-check data. Not trial results.**");
  expect(text).not.toContain("## Reading");
});

test("percentile", () => {
  expect(percentile([], 50)).toBeNull();
  expect(percentile([30, 10, 20], 50)).toBe(20);
  expect(percentile([30, 10, 20], 95)).toBe(30);
});

test("the committed page and summary are what the script writes for the committed evidence state", () => {
  const committed = JSON.parse(readFileSync(join(import.meta.dir, "..", "docs", "benchmarks", "session-trial.json"), "utf8")) as { run: unknown };
  // With no real run committed, both files are the "no run yet" output. After a real run the maintainer
  // regenerates them from the evidence directory, which is not in the repository.
  if (committed.run !== null) return;
  for (const [path, text] of published(null)) expect(readFileSync(path, "utf8"), path).toBe(text);
});
