import { expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "../src/compile.ts";
import { canonical } from "../src/disk.ts";
import { dataHome, enable } from "../src/consent.ts";
import { LOCK, onPreCommand, onPreEdit, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { issue, issueReview } from "../src/issue-command.ts";
import { issueContent } from "../src/issue.ts";
import { pendingReview } from "../src/pending-review.ts";
import { approvePending } from "../src/approval-command.ts";
import { HARNESSES } from "../src/harness/profile.ts";
import { REPO } from "../src/product.ts";
import { readFixture } from "../src/fixture-replay.ts";
import { testFixture } from "../src/fixtures.ts";
import { clock } from "../src/gate.ts";
import { findings } from "../src/recorded.ts";
import { key, record, sha256 } from "../src/state.ts";
import { submissionOwner } from "../src/issue-submission.ts";
import type { CallEvent, Session } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

async function withCleanupAsync<T>(work: () => Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  try { return await work(); } finally { await cleanup(); }
}

const secret = 'export const secret = "private-token-do-not-upload";\n';

async function isolated(run: (root: string, session: Session) => Promise<void>, recorded: Partial<CallEvent> = {}): Promise<void> {
  const cwd = process.cwd(), area = canonical(mkdtempSync(join(tmpdir(), "pregate-issue-")));
  const names = ["XDG_DATA_HOME", "XDG_STATE_HOME", "CI", "PREGATE_UNATTENDED_APPROVAL"] as const;
  const saved = names.map((n) => process.env[n]);
  process.env.XDG_DATA_HOME = join(area, "data"); process.env.XDG_STATE_HOME = join(area, "state"); process.env.CI = "1"; process.env.PREGATE_UNATTENDED_APPROVAL = "1";
  const root = canonical(join(area, "repo"));
  await withCleanupAsync(async () => {
    mkdirSync(join(root, ".pregate"), { recursive: true });
    const preset = readFileSync(join(cwd, "catalog/presets/legacy-safe.json"), "utf8");
    writeFileSync(join(root, PRESET), preset);
    const compiled = compile(preset, sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    writeFileSync(join(root, LOCK), compiled.text);
    enable(root); process.chdir(root);
    const session: Session = { harness: "codex", id: "issue-test", turnId: "one", agentId: null, interactive: false };
    const event: CallEvent = { at: Date.now(), versions: VERSIONS, callId: "denied", turn: "one", agentId: null,
      kind: "pre-edit", path: join(root, "private/path.ts"), root, verdict: "deny", halted: false,
      form: "syntax", shadowed: false, violations: [], afterSha: sha256(secret), astHash: null, ...recorded };
    record(key(session), event, event.afterSha === null ? null : secret);
    await run(root, session);
  }, () => {
    process.chdir(cwd); names.forEach((n, i) => saved[i] === undefined ? delete process.env[n] : process.env[n] = saved[i]);
    removeTree(area);
  });
}

function idOf(text: string): string { return /^Digest: ([0-9a-f]{64})$/m.exec(text)![1]!; }

const observed = { rule: "custom/PROJECT-DOC-1", path: "private/path.ts", line: 1, symbol: "missing", measured: null, limit: null,
  atSessionStart: null, severity: "deny" as const };
const shadowOnly: Partial<CallEvent> = { kind: "stop", verdict: "none", form: null, path: null, afterSha: null, shadowed: true,
  violations: [observed], enforcement: { [observed.rule]: "shadow" } };

test("--last skips shadow and muted observations and picks the newest actionable finding", () => isolated(async (root, session) => {
  const base = findings(root)[0]!.event;
  const shadow = { ...base, ...shadowOnly, at: base.at + 1, callId: "shadow" } as CallEvent;
  const { enforcement: _, ...legacy } = { ...shadow, at: base.at + 2, callId: "legacy" };
  const muted: CallEvent = { ...base, at: base.at + 3, callId: "muted", verdict: "none", afterSha: null };
  for (const event of [shadow, legacy, muted]) record(key(session), event, null);
  expect(findings(root)).toHaveLength(4);
  const picked = issueReview(root, idOf((await issue(["draft", "--last"])).text));
  expect(picked.body).toContain("Phase: pre-edit");
  expect(picked.body).toContain("Verdict: deny");
  const listed = await issue(["list"]);
  expect(listed.code).toBe(0);
  expect(listed.text.split("\n").slice(0, 4).map((line) => line.slice(0, 24))).toEqual(findings(root).map((f) => f.id));
  expect(listed.text.match(/\(observation only\)/g)).toHaveLength(3);
  for (const privateText of [root, "private/path", "missing"]) expect(listed.text).not.toContain(privateText);
  record(key(session), { ...shadow, at: base.at + 4, callId: "advisor", shadowed: false, enforcement: { [observed.rule]: "advisor" } }, null);
  expect(issueReview(root, idOf((await issue(["draft", "--last"])).text)).body).toContain("policy: advisor");
}));

test("a Stop released at the block limit with enforced findings is actionable, not an observation", () => isolated(async (root) => {
  const stop = findings(root)[0]!;
  expect(stop.event.stopIncomplete?.reason).toBe("limit");
  expect((await issue(["list"])).text).not.toContain("observation only");
  const last = await issue(["draft", "--last"]);
  expect(last.code).toBe(0);
  expect(issueReview(root, idOf(last.text)).body).toContain("policy: enforce");
  expect((await issue(["draft", stop.id])).code).toBe(0);
}, { ...shadowOnly, shadowed: false, enforcement: { [observed.rule]: "enforce" }, stopIncomplete: { reason: "limit", cause: null } }));

test("with only observations --last explains and writes nothing; an explicit id needs --note or --repro", () => isolated(async (root) => {
  const last = await issue(["draft", "--last"]);
  expect(last.code).toBe(1);
  expect(last.text).toContain("No actionable finding");
  expect(last.text).toContain("pregate issue list");
  const id = findings(root)[0]!.id;
  expect((await issue(["draft", id])).text).toContain("observation only");
  expect(existsSync(join(dataHome(), "issues"))).toBe(false);
  const file = join(root, "repro.json");
  writeFileSync(file, JSON.stringify({ "CHECK.json": "{}", "fixture.json": "{}" }));
  expect((await issue(["draft", id, "--repro", file])).text).toContain("Invalid reproduction");
  const noted = await issue(["draft", id, "--note", "Expected no finding for this generated requirement."]);
  expect(noted.code).toBe(0);
  expect(noted.text).toContain("policy: shadow");
}, shadowOnly));

test("drafts need one evidence selector; --no-event carries only the reporter's explanation", () => isolated(async (root) => {
  for (const args of [[], ["--note", "n"], ["--include-code"], ["--last", "--no-event"], ["--last", "--last"], ["list"],
    ["--no-event", "--include-code", "--title", "t", "--note", "n"]]) expect((await issue(["draft", ...args])).text).toContain("usage:");
  expect((await issue(["draft", "--no-event", "--note", "n"])).text).toContain("needs --title and --note");
  expect((await issue(["draft", "--no-event", "--title", "t"])).code).toBe(1);
  expect((await issue(["list", "--json"])).text).toContain("usage:");
  const drafted = await issue(["draft", "--no-event", "--title", "Setup wizard loops", "--note", "Expected setup to finish."]);
  expect(drafted.code).toBe(0);
  const reviewed = issueReview(root, idOf(drafted.text));
  expect(reviewed.title).toBe("Setup wizard loops");
  expect(reviewed.includesCode).toBe(false);
  expect(reviewed.body).toContain("Recorded event: none selected");
  expect(reviewed.body).toContain(`Engine: ${VERSIONS.engine}`);
  for (const omitted of ["Phase:", "Verdict:", "Cause:", "syntax", "private-token", root]) expect(reviewed.body).not.toContain(omitted);
  expect(reviewed.fingerprint).not.toBe(issueReview(root, idOf((await issue(["draft", "--last", "--title", "Setup wizard loops", "--note", "Expected setup to finish."])).text)).fingerprint);
}));

test("explicit report context controls the reviewed title and dedup without rewriting recorded evidence", () => isolated(async (root) => {
  const args = ["draft", "--last", "--title", "Upgrade command failure", "--note", "Expected the upgrade command to complete."];
  const first = issueReview(root, idOf((await issue(args)).text));
  expect(first.title).toBe("Upgrade command failure");
  expect(first.body).toContain("Cause: syntax");
  const repeat = issueReview(root, idOf((await issue(args)).text));
  expect(repeat.fingerprint).toBe(first.fingerprint);
  const different = issueReview(root, idOf((await issue([...args.slice(0, 3), "Another upgrade failure", ...args.slice(4)])).text));
  expect(different.fingerprint).not.toBe(first.fingerprint);
  expect((await issue(["draft", "--title", "No explanation"])).code).toBe(1);
}));

test("multi-rule Stop reports retain recorded check versions, counts and explicit missing context without leaking paths", () => isolated(async (root, session) => {
  const first = findings(root)[0]!.event;
  const violations = Array.from({ length: 21 }, (_, i) => ({ rule: `custom/RULE-${i}`, path: "private/path.ts", line: i + 1,
    symbol: "privateSymbol", measured: null, limit: null, atSessionStart: null, severity: "deny" as const }));
  violations.push(violations[0]!);
  const event: CallEvent = { ...first, at: first.at + 1, kind: "stop", callId: "stop", form: null, afterSha: null, path: null,
    violations, ruleChecks: Object.fromEntries(violations.map((v) => [v.rule, `custom/policy/check-${v.line}@1.2.3`])) };
  record(key(session), event, null);
  const draft = await issue(["draft", "--last"]), id = idOf(draft.text);
  expect(draft.code).toBe(0);
  expect(issueReview(root, id).title).toBe("[PREGATE finding] 21 rules; first: custom/RULE-0");
  expect(draft.text).toContain("Expected behavior was not supplied");
  expect(draft.text).toContain("No public reproduction was supplied");
  expect(draft.text).toContain("Findings: 22; distinct rules: 21");
  expect(draft.text).toContain("check: custom/policy/check-1@1.2.3; policy: not recorded; findings: 2");
  for (const privateText of [root, "private/path", "privateSymbol", "private-token"]) expect(draft.text).not.toContain(privateText);
  const explained = issueContent(event, { harness: "codex", note: "Expected this valid boundary input to pass.", code: null, fingerprint: "f".repeat(64) });
  expect(explained.body).toContain("Expected this valid boundary input to pass.");
  expect(explained.body).not.toContain("Expected behavior was not supplied");
  record(key(session), { ...event, at: event.at + 1, ruleChecks: { ...event.ruleChecks, "custom/RULE-0": "custom/policy/check-1@2.0.0" } }, null);
  const changed = issueReview(root, idOf((await issue(["draft", "--last"])).text));
  expect(changed.fingerprint).not.toBe(issueReview(root, id).fingerprint);
  expect((await issue(["show", id])).text).toBe(draft.text);
}));

test("issue draft is offline, omits code and paths, binds the destination and requires approval", () => isolated(async (root) => {
  const unexpected = async () => { throw new Error("Network must not run"); };
  const draft = await issue(["draft", "--last", "--note", "This valid program should parse."], unexpected);
  expect(draft.code).toBe(0);
  expect(draft.text).toContain(REPO);
  expect(draft.text).toContain(`Engine: ${VERSIONS.engine}`);
  expect(draft.text).not.toContain("private-token");
  expect(draft.text).not.toContain(root);
  expect(draft.text).not.toContain("private/path");
  const id = idOf(draft.text);
  expect(draft.text).toContain(`pregate issue submit ${id} --yes`);
  expect(draft.text).toContain("Claude Code, Codex, Grok, agy, OpenCode and Cursor each need a separate terminal.");
  expect((await issue(["show", id], unexpected)).text).toBe(draft.text);
  expect((await issue(["submit", id], unexpected)).text).toContain("Report not approved");
  const codeDraft = await issue(["draft", "--last", "--include-code"], unexpected);
  expect(codeDraft.text).toContain(secret.trim());
  expect(codeDraft.text).toContain("Includes source code: yes");
  expect(idOf(codeDraft.text)).not.toBe(id);
  writeFileSync(join(dataHome(), "issues", `${id}.json`), JSON.stringify({ ...issueReview(root, id), body: "changed after review" }));
  expect((await issue(["submit", id, "--yes"], unexpected)).text).toContain("changed");
}));

test("publication uses the reviewed body file, deduplicates locally and remotely and preserves offline drafts", () => isolated(async (root) => {
  const draft = await issue(["draft", "--last"]), id = idOf(draft.text), expected = issueReview(root, id);
  const requests: string[][] = [];
  const fake = async (args: string[]) => {
    requests.push(args);
    if (args[1] === "list") return { code: 0, text: "[]" };
    const file = args[args.indexOf("--body-file") + 1]!;
    expect(readFileSync(file, "utf8")).toBe(expected.body);
    expect(args[args.indexOf("--repo") + 1]).toBe(REPO);
    return { code: 0, text: `https://github.com/${REPO}/issues/123\n` };
  };
  expect((await issue(["submit", id, "--yes"], async () => ({ code: 1, text: "offline" }))).text).toContain("draft retained");
  expect((await issue(["show", id])).code).toBe(0);
  expect((await issue(["submit", id, "--yes"], fake)).text).toContain("Reported:");
  expect((await issue(["submit", id, "--yes"], fake)).text).toContain("Already reported:");
  expect(requests).toHaveLength(2);
  rmSync(join(dataHome(), "issues", `${expected.fingerprint}.submitted.json`));
  const existing = async (args: string[]) => {
    expect(args[1]).toBe("list");
    return { code: 0, text: JSON.stringify([{ url: `https://github.com/${REPO}/issues/123`, body: expected.body }]) };
  };
  expect((await issue(["submit", id, "--yes"], existing)).text).toContain("Already reported:");
}));

test("a public reproduction is replayed offline and the reviewed payload survives later fixture edits", () => isolated(async (root, session) => {
  record(key(session), { ...findings(root)[0]!.event, at: Date.now() + 1, callId: "legacy-engine", versions: { engine: "0.1.0", core: "0.0.1" } }, secret);
  const dir = join(root, "public-repro");
  mkdirSync(join(dir, "files/src"), { recursive: true });
  writeFileSync(join(dir, "CHECK.json"), readFileSync(join(import.meta.dir, "../packs/clean-code/checks/complexity/fn-max-params/check.json"), "utf8"));
  writeFileSync(join(dir, "fixture.json"), JSON.stringify({ language: "typescript", params: { max: 1, exempt: [] }, target: "src/example.ts", before: null, expect: { verdict: "pass" } }));
  const code = "export function sum(a: number, b: number) { return a + b; }\n";
  writeFileSync(join(dir, "files/src/example.ts.fixture"), code);
  writeFileSync(join(dir, "NOTE.md"), secret);
  const unexpected = async () => { throw new Error("Draft/replay must stay offline"); };
  const drafted = await issue(["draft", "--last", "--repro", dir, "--note", "Investigate this public example"], unexpected);
  expect(drafted.code).toBe(0);
  expect(drafted.text).toContain("Includes source code: yes");
  expect(drafted.text).toContain("fail [1(2)] (expected pass [])");
  expect(drafted.text).toContain("pregate rules test --fixture repro.json");
  expect(drafted.text).toContain("Engine: 0.1.0");
  expect(drafted.text).toContain(`Replay engine: ${VERSIONS.engine}; core: ${VERSIONS.core}`);
  expect(drafted.text).not.toContain("private-token");
  expect(drafted.text).not.toContain(root);
  expect(drafted.text).not.toContain("private/path");
  const id = idOf(drafted.text), reviewed = issueReview(root, id);
  const payload = /Explicitly included fixture\/check\/configuration and source files:\n\n(`{3,})\n([\s\S]+?)\n\1/.exec(reviewed.body)![2]!;
  const exported = join(root, "repro.json");
  writeFileSync(exported, payload);
  const replayed = testFixture(readFixture(exported), clock);
  expect(replayed.valid).toBe(true); expect(replayed.ok).toBe(false);
  expect(replayed.lines.join("\n")).toContain("fail [1(2)] (expected pass [])");
  writeFileSync(join(dir, "files/src/example.ts.fixture"), "export const changed = 1;\n");
  expect((await issue(["show", id], unexpected)).text).toBe(drafted.text);
  let created = false;
  const submitted = await issue(["submit", id, "--yes"], async (args) => {
    if (args[1] === "list") return { code: 0, text: "[]" };
    created = true;
    expect(readFileSync(args[args.indexOf("--body-file") + 1]!, "utf8")).toBe(reviewed.body);
    return { code: 0, text: `https://github.com/${REPO}/issues/234` };
  });
  expect(submitted.code).toBe(0); expect(created).toBe(true);
}));

test("invalid and ambiguous reproduction inputs cannot prepare an issue draft", () => isolated(async (root) => {
  const file = join(root, "repro.json");
  writeFileSync(file, JSON.stringify({ "CHECK.json": "{}", "fixture.json": "{}" }));
  expect((await issue(["draft", "--last", "--repro", file])).text).toContain("Invalid reproduction; no draft prepared");
  for (const args of [["--repro"], ["--repro", file, "--repro", file], ["--include-code", "--repro", file]]) {
    expect((await issue(["draft", "--last", ...args])).text).toContain("usage:");
  }
}));

test("concurrent reports serialize the fingerprint and do not create duplicate issues", () => isolated(async () => {
  const id = idOf((await issue(["draft", "--last"])).text);
  let release!: () => void, searched!: () => void;
  const blocked = new Promise<void>((r) => release = r), began = new Promise<void>((r) => searched = r);
  let creates = 0;
  const fake = async (args: string[]) => {
    if (args[1] === "list") { searched(); await blocked; return { code: 0, text: "[]" }; }
    creates++; return { code: 0, text: `https://github.com/${REPO}/issues/321` };
  };
  const first = issue(["submit", id, "--yes"], fake);
  await began;
  expect((await issue(["submit", id, "--yes"], fake)).text).toContain("submission in progress");
  release(); expect((await first).code).toBe(0); expect(creates).toBe(1);
}));

async function abandoned(dir: string, phase: "checking" | "creating"): Promise<void> {
  const module = join(import.meta.dir, "../src/issue-submission.ts");
  const code = `const { acquireSubmission } = await import(${JSON.stringify(module)}); const lease = acquireSubmission(${JSON.stringify(dir)}); ${phase === "creating" ? "lease.beforeCreate();" : ""} process.stdout.write("ready\\n"); setInterval(() => {}, 1000);`;
  const proc = Bun.spawn([process.execPath, "-e", code], { stdout: "pipe", stderr: "pipe" });
  await withCleanupAsync(async () => {
    const ready = await proc.stdout.getReader().read();
    expect(new TextDecoder().decode(ready.value)).toBe("ready\n");
  }, async () => { proc.kill("SIGKILL"); await proc.exited; });
  expect(submissionOwner(dir)?.state).toBe("dead");
}

test("an actual killed checker can be retried; a killed creator reconciles its existing issue", () => isolated(async (root) => {
  const id = idOf((await issue(["draft", "--last"])).text), draft = issueReview(root, id);
  const dir = join(dataHome(), "issues", `${draft.fingerprint}.submitting`);
  const receipt = join(dataHome(), "issues", `${draft.fingerprint}.submitted.json`);
  await abandoned(dir, "checking");
  let creates = 0;
  expect((await issue(["submit", id, "--yes"], async (args) => {
    if (args[1] === "list") return { code: 0, text: "[]" };
    expect(submissionOwner(dir)?.phase).toBe("creating");
    creates++; return { code: 0, text: `https://github.com/${REPO}/issues/456` };
  })).code).toBe(0);
  expect(creates).toBe(1); expect(submissionOwner(dir)).toBeNull();
  rmSync(receipt);
  await abandoned(dir, "creating");
  expect((await issue(["submit", id, "--yes"], async (args) => {
    expect(args[1]).toBe("list");
    return { code: 0, text: JSON.stringify([{ url: `https://github.com/${REPO}/issues/456`, body: draft.body }]) };
  })).text).toContain("Already reported:");
  expect(readFileSync(receipt, "utf8").trim()).toBe(`https://github.com/${REPO}/issues/456`);
  expect(submissionOwner(dir)).toBeNull(); expect(creates).toBe(1);
}));

test("uncertain interrupted creation and lookup failures retain the marker and never recreate", () => isolated(async (root) => {
  const id = idOf((await issue(["draft", "--last"])).text), draft = issueReview(root, id);
  const dir = join(dataHome(), "issues", `${draft.fingerprint}.submitting`);
  await abandoned(dir, "creating");
  const owner = submissionOwner(dir)!;
  for (const response of [{ code: 0, text: "[]" }, { code: 1, text: "offline" }]) {
    const result = await issue(["submit", id, "--yes"], async (args) => { expect(args[1]).toBe("list"); return response; });
    expect(result.code).toBe(1); expect(result.text).toContain("retained");
    expect(readFileSync(owner.file, "utf8")).toBe(owner.text);
  }
  expect((await issue(["show", id])).code).toBe(0);
}));

test("failed or unrecognized create responses retain the possibly published operation", () => isolated(async (root) => {
  const id = idOf((await issue(["draft", "--last"])).text), draft = issueReview(root, id);
  const dir = join(dataHome(), "issues", `${draft.fingerprint}.submitting`);
  for (const response of [{ code: 1, text: "timeout after request" }, { code: 0, text: "unexpected response" }]) {
    let creates = 0;
    const fake = async (args: string[]) => {
      if (args[1] === "list") return { code: 0, text: "[]" };
      creates++; return response;
    };
    expect((await issue(["submit", id, "--yes"], fake)).code).toBe(1);
    expect(submissionOwner(dir)).toMatchObject({ phase: "creating", state: "alive" });
    expect((await issue(["submit", id, "--yes"], fake)).code).toBe(1);
    expect(creates).toBe(1); rmSync(dir, { recursive: true });
  }
}));

test("legacy, ambiguous, foreign-host and uncertain PID ownership cannot be reclaimed", () => isolated(async (root) => {
  const id = idOf((await issue(["draft", "--last"])).text), draft = issueReview(root, id);
  const dir = join(dataHome(), "issues", `${draft.fingerprint}.submitting`);
  mkdirSync(dir);
  const file = join(dir, `${process.pid}-abc.json`);
  const owner = { pid: process.pid, host: hostname(), at: Date.now(), phase: "checking" };
  const unexpected = async () => { throw new Error("Unknown/live owner must never contact GitHub"); };
  expect((await issue(["submit", id, "--yes"], unexpected)).text).toContain("owner cannot be proved absent");
  for (const text of ["not json", JSON.stringify({ ...owner, host: "foreign-host" }), JSON.stringify({ ...owner, pid: 1 }), JSON.stringify(owner)]) {
    writeFileSync(file, text);
    const probe = spyOn(process, "kill").mockImplementation(() => { throw Object.assign(new Error("denied"), { code: "EPERM" }); });
    await withCleanupAsync(async () => {
      expect((await issue(["submit", id, "--yes"], unexpected)).code).toBe(1);
      expect(readFileSync(file, "utf8")).toBe(text);
    }, () => { probe.mockRestore(); });
  }
  writeFileSync(file, JSON.stringify(owner)); writeFileSync(join(dir, "second-owner.json"), "unknown");
  expect((await issue(["submit", id, "--yes"], unexpected)).code).toBe(1);
  expect(readFileSync(file, "utf8")).toBe(JSON.stringify(owner));
}));

test("reconciliation cannot remove a successor owner that appeared during GitHub lookup", () => isolated(async (root) => {
  const id = idOf((await issue(["draft", "--last"])).text), draft = issueReview(root, id);
  const dir = join(dataHome(), "issues", `${draft.fingerprint}.submitting`);
  await abandoned(dir, "creating");
  const old = submissionOwner(dir)!;
  const result = await issue(["submit", id, "--yes"], async (args) => {
    expect(args[1]).toBe("list"); rmSync(old.file);
    writeFileSync(join(dir, `${process.pid}-successor.json`), JSON.stringify({ pid: process.pid, host: hostname(), at: Date.now(), phase: "checking" }));
    return { code: 0, text: JSON.stringify([{ url: `https://github.com/${REPO}/issues/567`, body: draft.body }]) };
  });
  expect(result.code).toBe(1); expect(result.text).toContain("owner changed");
  expect(readFileSync(join(dir, `${process.pid}-successor.json`), "utf8")).toContain('"checking"');
}));

test("no harness approves a submission from the agent; each denial names the human route", () => isolated(async (root, session) => {
  const id = idOf((await issue(["draft", "--last"])).text);
  const command = (s: Session, text = `pregate issue submit ${id} --yes`) => onPreCommand({ session: s, callId: "publish", tool: "Bash", cwd: root, command: text });
  for (const harness of ["codex", "cursor", "grok"] as const) {
    const denied = command({ ...session, harness });
    expect(denied.verdict).toBe("deny");
    expect(denied.full).toContain(`run pregate issue submit ${id} --yes in a separate terminal`);
    expect(denied.full).not.toContain("! pregate issue submit");
  }
  expect(command({ ...session, harness: "claude-code", interactive: true }).verdict).toBe("deny");
  delete process.env.CI; delete process.env.PREGATE_UNATTENDED_APPROVAL;
  const denied = command({ ...session, harness: "agy", interactive: true });
  expect(denied.verdict).toBe("deny");
  expect(denied.full).toContain(`run pregate issue submit ${id} --yes in a separate terminal`);
  expect(denied.full).not.toContain(`! pregate issue submit ${id} --yes`);
  // An approved Bash command runs without a terminal, so Claude Code's permission prompt could
  // only start a submission that then refuses: the human types it with `!` instead.
  const humanSession = { ...session, harness: "claude-code" as const, interactive: true };
  const routed = command(humanSession);
  expect(routed.verdict).toBe("deny");
  expect(routed.full).toContain(`run pregate issue submit ${id} --yes in a separate terminal`);
  expect(routed.full).not.toContain(`! pregate issue submit ${id} --yes`);
  const out = HARNESSES["claude-code"].encode("pre-command", routed);
  expect(out.exit).toBe(2);
  expect(out.stdout).not.toContain('"permissionDecision":"ask"');
  for (const suffix of ["; echo injected", " | cat", " --extra", " && true"]) expect(command(humanSession, `pregate issue submit ${id} --yes${suffix}`).verdict).toBe("deny");
  expect(command({ ...humanSession, agentId: "worker" }).verdict).toBe("deny");
  expect(command(humanSession, `pregate issue submit ${"0".repeat(64)} --yes`).verdict).toBe("deny");
}));

test("pending contracts can be reviewed in the harness and only the reviewed digest can be applied", () => isolated(async (root, session) => {
  const next = JSON.stringify({ ...JSON.parse(readFileSync(join(root, PRESET), "utf8")), enforcement: "shadow" });
  expect((await onPreEdit([{ session, callId: "propose", tool: "Write", path: join(root, PRESET), edit: { form: "full", content: next }, from: null }])).verdict).toBe("deny");
  const preview = pendingReview(root), digest = idOf(preview.text);
  expect(preview.text).toContain('+{"');
  expect(preview.text).toContain(`pregate approve ${digest.slice(0, 12)}`);
  expect((await approvePending(root, true, "0".repeat(64))).code).toBe(1);
  expect(readFileSync(join(root, PRESET), "utf8")).not.toBe(next);
  delete process.env.CI; delete process.env.PREGATE_UNATTENDED_APPROVAL;
  // The allow is evaluated like any other command, which needs a repository. The earlier denial
  // returned before that check, so this fixture never initialized one.
  Bun.spawnSync(["git", "init", "-q"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const routed = onPreCommand({ session: { ...session, harness: "claude-code", interactive: true }, tool: "Bash", callId: "approve", cwd: root, command: `pregate approve --yes --digest ${digest}` });
  expect(routed.verdict).toBe("none");
  expect(onPreCommand({ session: { ...session, harness: "claude-code", interactive: true }, tool: "Bash", callId: "bare", cwd: root, command: "pregate approve" }).compact)
    .toStartWith("Ask the user to approve. Do not run the approval command yourself.");
  const review = pendingReview(root, undefined, true).text;
  expect(review).toContain("WARNING: this may weaken protection.");
  expect(review).toContain("(was enforce)");
  expect(review.split("\n").filter((line) => line.startsWith("Changes (may loosen) ")).length).toBeGreaterThan(0);
  process.env.CI = "1"; process.env.PREGATE_UNATTENDED_APPROVAL = "1";
  expect(await approvePending(root, true, digest)).toMatchObject({ code: 0 });
  expect(readFileSync(join(root, PRESET), "utf8")).toBe(next);
}));
