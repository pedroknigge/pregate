// Run after building: exercises production-binary feedback on a real recorded shadow finding.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { hostTarget } from "./build.ts";
import { WINDOWS } from "../src/platform.ts";
import { smokeBinary } from "./smoke-binary.ts";
import { runNative } from "./smoke-native-command.ts";
import { H } from "../src/state.ts";
import { canonical } from "../src/disk.ts";

const area = realpathSync(mkdtempSync(join(tmpdir(), "pregate-feedback-native-")));
const root = canonical(join(area, "repo"));
const binary = smokeBinary();
const env = { ...process.env, CI: "1", HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"),
  XDG_STATE_HOME: join(area, "state"), CODEX_HOME: join(area, "codex"), GROK_HOME: join(area, "grok") };
function run(args: string[], input?: object) {
  return runNative({ binary, args, cwd: root, env, stdin: input === undefined ? undefined : JSON.stringify(input) });
}
function assert(value: boolean, message: string) { if (!value) throw new Error(message); }
try {
  mkdirSync(join(root, "src"), { recursive: true });
  const init = run(["init", "--yes", "--preset", "legacy-safe"]);
  assert(init.exitCode === 0, init.stdout.toString() + init.stderr.toString());
  const lock = readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8");
  const observed = run(["hook", "pre", "--harness", "claude-code"], {
    cwd: root, session_id: "native-feedback", hook_event_name: "PreToolUse", permission_mode: "default",
    tool_name: "Write", tool_use_id: "empty-catch",
    // A swallowed error is a deny rule, so legacy-safe records a shadowed finding.
    tool_input: { file_path: join(root, "src/a.ts"), content: "export function load(read: () => string): string { let text = \"\"; try { text = read(); } catch {} return text; }\n" },
  });
  assert(observed.exitCode === 0, observed.stdout.toString() + observed.stderr.toString());
  const listed = run(["feedback", "list", "--json"]);
  assert(listed.exitCode === 0, listed.stdout.toString() + listed.stderr.toString());
  const findings = JSON.parse(listed.stdout.toString()).findings;
  assert(findings.length === 1 && findings[0].rule === "clean-code/CC-ER-002", listed.stdout.toString());
  const snapshotFile = join(area, "state/pregate/sessions", WINDOWS ? "claude-code~native-feedback" : "claude-code:native-feedback", H(root), "snapshot.json");
  const snapshot = readFileSync(snapshotFile, "utf8");
  const draft = run(["feedback", "draft", findings[0].id, "--as", "correct", "--note", "The empty catch drops the read failure."]);
  assert(draft.exitCode === 0, draft.stdout.toString() + draft.stderr.toString());
  const digest = /Digest: ([a-f0-9]{64})/.exec(draft.stdout.toString())?.[1];
  assert(digest !== undefined, "Missing feedback review digest");
  const refused = run(["feedback", "apply", digest!]);
  assert(refused.exitCode === 1, "Unattended approval must fail");
  const applied = run(["feedback", "apply", digest!, "--yes"]);
  assert(applied.exitCode === 0, applied.stdout.toString() + applied.stderr.toString());
  const report = run(["report", "--json"]);
  const data = JSON.parse(report.stdout.toString());
  assert(report.exitCode === 0 && data.calibration.correct === 1 && data.calibration.reviewedPrecision === 1 && data.calibration.unlabeled === 0, report.stdout.toString());
  assert(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8") === lock, "Feedback changed the contract");
  assert(readFileSync(snapshotFile, "utf8") === snapshot, "Feedback changed the resumable snapshot");
  const example = join(area, "public-example");
  mkdirSync(join(example, "files/src"), { recursive: true });
  writeFileSync(join(example, "CHECK.json"), readFileSync(join(import.meta.dir, "../packs/clean-code/checks/complexity/fn-max-params/check.json"), "utf8"));
  writeFileSync(join(example, "fixture.json"), JSON.stringify({ language: "typescript", params: { max: 1, exempt: [] }, target: "src/example.ts", before: null, expect: { verdict: "pass" } }));
  writeFileSync(join(example, "files/src/example.ts.fixture"), "export function sum(a: number, b: number) { return a + b; }\n");
  writeFileSync(join(example, "NOTE.md"), "private-note-do-not-include");
  const reproduced = run(["rules", "test", "--fixture", example]);
  assert(reproduced.exitCode === 1 && reproduced.stdout.toString().includes("fail [1(2)] (expected pass [])"), reproduced.stdout.toString());
  // The only recorded event is a shadow observation, which --last skips (#63): select it by id from `issue list`.
  const issueList = run(["issue", "list"]);
  const eventId = /^([0-9a-f]{24}) .*\(observation only\)$/m.exec(issueList.stdout.toString())?.[1];
  assert(issueList.exitCode === 0 && eventId !== undefined, issueList.stdout.toString() + issueList.stderr.toString());
  const issueDraft = run(["issue", "draft", eventId!, "--repro", example, "--note", "Investigate this public example."]);
  const issueText = issueDraft.stdout.toString();
  assert(issueDraft.exitCode === 0 && issueText.includes("Includes source code: yes") && !issueText.includes("private-note-do-not-include") && !issueText.includes(root), issueText);
  const issueDigest = /Digest: ([a-f0-9]{64})/.exec(issueText)?.[1];
  assert(issueDigest !== undefined, "Missing public reproduction issue digest");
  const body = JSON.parse(readFileSync(join(area, "data/pregate/issues", issueDigest + ".json"), "utf8")).body;
  const payload = /Explicitly included fixture\/check\/configuration and source files:\n\n(`{3,})\n([\s\S]+?)\n\1/.exec(body)?.[2];
  assert(payload !== undefined, "Missing exported reproduction fixture map");
  const exported = join(area, "repro.json"); writeFileSync(exported, payload!);
  const replayed = run(["rules", "test", "--fixture", exported]);
  assert(replayed.exitCode === reproduced.exitCode && replayed.stdout.toString() === reproduced.stdout.toString(), "Exported issue reproduction differs from the reviewed fixture");
  assert(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8") === lock && readFileSync(snapshotFile, "utf8") === snapshot, "Public reproduction changed project protection/state");
  console.log(JSON.stringify({ target: hostTarget(), observed: "one real recorded shadow finding", approval: "unattended refused; explicit digest approval applied",
    calibration: "one explicitly approved correct test label; reviewed precision 1, with visible denominator", publicReproduction: "standalone and exported issue JSON replay identically; private note omitted; no submission", contract: "unchanged", github: "no publication" }));
} finally { rmSync(area, { recursive: true, force: true }); }
