import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { canonical } from "../src/disk.ts";
import { eventName, sha256 } from "../src/state.ts";
import type { CallEvent } from "../src/types.ts";

setDefaultTimeout(60_000);
const area = realpathSync(mkdtempSync(join(tmpdir(), "pregate-feedback-")));
const binary = join(area, "engine", "version", ENGINE_FILE);
const template = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8"))[1].event as CallEvent;
beforeAll(() => compileBinary(hostTarget(), binary, true));
afterAll(() => rmSync(area, { recursive: true, force: true }));

function project() {
  const root = canonical(join(area, randomUUID()));
  mkdirSync(root);
  const env = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(root, "home"), XDG_DATA_HOME: join(root, "data"), XDG_STATE_HOME: join(root, "state"),
    CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok") };
  const run = (args: string[], input?: object, ci = "1") => {
    const out = Bun.spawnSync([binary, ...args], { cwd: root, env: { ...env, CI: ci, PREGATE_UNATTENDED_APPROVAL: ci },
      stdin: input === undefined ? "ignore" : new Blob([JSON.stringify(input)]), stdout: "pipe", stderr: "pipe" });
    return { code: out.exitCode, text: out.stdout.toString(), error: out.stderr.toString() };
  };
  expect(run(["init", "--yes", "--preset", "legacy-safe"]).code).toBe(0);
  const events = join(root, "state/pregate/sessions", WINDOWS ? "claude-code~review" : "claude-code:review", "events");
  const put = (event: CallEvent) => {
    const day = new Date(event.at).toISOString().slice(0, 10);
    mkdirSync(join(events, day), { recursive: true });
    const file = join(events, day, eventName(event));
    writeFileSync(file, JSON.stringify(event));
    return file;
  };
  const event = { ...template, root, path: join(root, "src/a.ts"), at: Date.now() };
  const file = put(event);
  const id = JSON.parse(run(["feedback", "list", "--json"]).text).findings[0].id as string;
  const draft = (verdict = "correct", note = "") => {
    const out = run(["feedback", "draft", id, "--as", verdict, "--note", note]);
    expect(out.code).toBe(0);
    return out.text.match(/Digest: ([a-f0-9]{64})/)![1]!;
  };
  return { root, env, run, put, event, file, id, draft, events };
}

test("human feedback is local, digest-reviewed, reportable and deliberately replaceable", () => {
  const p = project();
  const digest = p.draft("false-positive", "A deliberate boundary exception.");
  const preview = p.run(["feedback", "show", digest]).text;
  expect(preview).toContain("the human runs in a terminal: pregate feedback apply " + digest + " --yes");
  expect(preview).toContain("Claude Code, Codex, Grok or agy");
  expect(preview).toContain(`pregate feedback apply ${digest} --yes`);
  expect(preview).toContain("Cursor needs a separate terminal");
  expect(JSON.parse(p.run(["report", "--json"]).text).calibration.unlabeled).toBe(1);
  expect(p.run(["feedback", "apply", digest]).code).toBe(1);
  expect(p.run(["feedback", "apply", digest, "--yes"]).code).toBe(0);
  const report = JSON.parse(p.run(["report", "--json"]).text);
  expect(report.calibration).toMatchObject({ falsePositive: 1, correct: 0, reviewedPrecision: 0, unlabeled: 0 });
  expect(report.calibration.rules[0].rule).toBe("core/CC-FN-001");
  expect(p.run(["feedback", "apply", digest, "--yes"]).code).toBe(1);
  const fresh = p.draft("uncertain");
  expect(p.run(["feedback", "apply", fresh, "--yes"]).code).toBe(0);
  expect(JSON.parse(p.run(["report", "--json"]).text).calibration).toMatchObject({ uncertain: 1, reviewedPrecision: null });
  expect(existsSync(join(p.root, "data/pregate/issues"))).toBe(false);
  const labels = join(p.root, "data/pregate/feedback", sha256(p.root).slice(0, 12), p.id + ".json");
  expect(JSON.parse(readFileSync(labels, "utf8")).confirmedAt).toBeGreaterThan(0);
});

test("changed observations, drafts, expiration and competing labels invalidate pending feedback", () => {
  const p = project();
  const digest = p.draft();
  writeFileSync(p.file, JSON.stringify({ ...p.event, message: "Changed observation." }));
  expect(p.run(["feedback", "apply", digest, "--yes"]).code).toBe(1);
  const newDigest = p.draft();
  const path = join(p.root, "data/pregate/feedback/drafts", newDigest + ".json");
  writeFileSync(path, readFileSync(path, "utf8") + " ");
  expect(p.run(["feedback", "show", newDigest]).code).toBe(1);
  const valid = p.draft();
  const source = JSON.parse(readFileSync(join(p.root, "data/pregate/feedback/drafts", valid + ".json"), "utf8"));
  source.at = Date.now() - 24 * 3_600_000 - 1;
  const text = JSON.stringify(source), expired = sha256(text);
  writeFileSync(join(p.root, "data/pregate/feedback/drafts", expired + ".json"), text);
  expect(p.run(["feedback", "apply", expired, "--yes"]).code).toBe(1);
  const competing = p.draft("false-positive");
  expect(p.run(["feedback", "apply", valid, "--yes"]).code).toBe(0);
  expect(p.run(["feedback", "apply", competing, "--yes"]).code).toBe(1);
});

test("feedback discovery skips old partitions and validates all command options", () => {
  const p = project();
  mkdirSync(join(p.events, "2000-01-01"));
  writeFileSync(join(p.events, "2000-01-01/broken.json"), "not JSON");
  expect(p.run(["feedback", "list", "--json"]).code).toBe(0);
  expect(p.draft()).toMatch(/^[a-f0-9]{64}$/);
  for (const args of [["feedback", "list", "--days", "0"], ["feedback", "list", "--json", "--json"], ["feedback", "list", "--unknown"],
    ["feedback", "draft", p.id, "--as", "invented"], ["feedback", "draft", p.id, "--as", "correct", "--as", "uncertain"],
    ["feedback", "apply", p.draft(), "--yes", "--yes"]]) expect(p.run(args).code).toBe(1);
});

test("recomputed digests cannot disguise metadata, invalid notes or a future timestamp", () => {
  const p = project();
  const digest = p.draft();
  const original = JSON.parse(readFileSync(join(p.root, "data/pregate/feedback/drafts", digest + ".json"), "utf8"));
  for (const edit of [
    (draft: typeof original) => { draft.label.item.rule = "pretend/another-rule"; },
    (draft: typeof original) => { draft.label.item.measured = 0; },
    (draft: typeof original) => { draft.label.note = {}; },
    (draft: typeof original) => { draft.at = Date.now() + 600000; },
  ]) {
    const draft = structuredClone(original);
    edit(draft);
    const text = JSON.stringify(draft), forged = sha256(text);
    writeFileSync(join(p.root, "data/pregate/feedback/drafts", forged + ".json"), text);
    expect(p.run(["feedback", "show", forged]).code).toBe(1);
    expect(p.run(["feedback", "apply", forged, "--yes"]).code).toBe(1);
  }
});

test("native feedback approval asks the interactive parent; children, headless calls and wrappers cannot self-label", () => {
  const p = project(), digest = p.draft();
  const payload = { cwd: p.root, session_id: "approval", hook_event_name: "PreToolUse", permission_mode: "acceptEdits", prompt_id: "t",
    tool_name: "Bash", tool_use_id: "feedback", tool_input: { command: "pregate feedback apply " + digest + " --yes" } };
  const hook = (input: object, ci = "") => p.run(["hook", "pre", "--harness", "claude-code"], input, ci);
  const parent = hook(payload);
  expect(parent.code).toBe(0);
  expect(JSON.parse(parent.text).hookSpecificOutput.permissionDecision).toBe("ask");
  expect(parent.text).toContain("Label: correct");
  expect(hook({ ...payload, agent_id: "child" }).code).toBe(2);
  expect(hook(payload, "1").code).toBe(2);
  expect(hook({ ...payload, tool_input: { command: "env " + payload.tool_input.command } }).code).toBe(2);
  expect(hook({ ...payload, tool_input: { command: "pregate feedback apply " + "f".repeat(64) + " --yes" } }).code).toBe(2);
  expect(JSON.parse(p.run(["report", "--json"]).text).calibration.reviewedPrecision).toBeNull();
});
