import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decide } from "../../src/decide.ts";
import { decode, encode } from "../../src/harness/grok.ts";
import type { Decision, DecideInput, Edit, Emission, HookEnv, HookEvent, HookKind, Lock, Rejected, Severity, Violation } from "../../src/types.ts";
import { contract, ENV } from "./contract.ts";

// The Grok Build contract (MULTI-HARNESS MH-05, MH-12, MH-14): real payloads captured from Grok
// Build 1.0.49 in test/payloads/grok, decoded to exact events; real decisions, encoded to exact output.

const DIR = `${import.meta.dir}/../payloads/grok`;
const PROJECT = "/home/user/project";
const BAD = "payload-unrecognized";
const payload = (name: string): string => readFileSync(`${DIR}/${name}`, "utf8");
const json = (name: string): Record<string, unknown> => JSON.parse(payload(name)) as Record<string, unknown>;
const raw = (o: unknown): string => JSON.stringify(o);
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const call = (n: number, k: number): string => `call-${uuid(n)}-${k}`;
const session = (n: number) => ({ id: uuid(n), harness: "grok" as const, agentId: null, turnId: null, interactive: false });
// What Grok puts in the hook's environment (hook-env-pre-tool-use.txt): its event and the project dir.
const env = (grokEvent: string): HookEnv => ({ ...ENV, grokEvent, projectDir: `${PROJECT}/` });
const PRE = env("pre_tool_use");
const STOP = env("stop");
const causeOf = (e: HookEvent | Rejected | null): string | null => (e !== null && "cause" in e ? e.cause : null);
const edit = (tool: string, n: number, callId: string, path: string, e: Edit) => ({
  event: "pre" as const, env: PRE, out: { kind: "pre-edit" as const, changes: [{ session: session(n), callId, tool, path: `${PROJECT}/${path}`, edit: e, from: null }] },
});
const without = (o: Record<string, unknown>, key: string): Record<string, unknown> => {
  const { [key]: _, ...rest } = o;
  return rest;
};
// Rewrites the camelCase key the adapter reads; the snake twins stay as captured.
const toolInput = (file: string, change: Record<string, unknown>, drop?: string): string => {
  const p = json(file);
  const i = { ...(p.toolInput as Record<string, unknown>), ...change };
  return raw({ ...p, toolInput: drop === undefined ? i : without(i, drop) });
};

describe("decode: captured payloads", () => {
  contract("grok", DIR, {
    "session-start.json": {
      event: "session-start", env: env("session_start"), out: { kind: "session-start", session: session(1), cwd: PROJECT },
    },
    "pre-write.json": edit("write", 1, call(3, 0), "a.ts", { form: "full", content: "export const a = 1;" }),
    // No replace_all key when it is false.
    "pre-search-replace.json": edit("search_replace", 1, call(4, 1), "a.ts",
      { form: "oldnew", old: "export const a = 1;", neu: "export const a = 10;", all: false, lines: null }),
    // Grok created d1.ts this way: the empty old_string reaches reconstruct as is (MH-13).
    "pre-search-replace-create.json": edit("search_replace", 9, call(10, 0), "d1.ts",
      { form: "oldnew", old: "", neu: "export const d = 1;", all: false, lines: null }),
    // Anchors read earlier by hashline_read: judged where it lands, and denied as an edit it cannot rebuild.
    "pre-hashline-edit.json": edit("hashline_edit", 6, call(8, 1), "e1.ts", { form: "unknown", cause: "hashline_edit" }),
    "pre-run-terminal-command.json": {
      event: "pre", env: PRE,
      out: { kind: "pre-command", command: { session: session(1), callId: call(5, 2), tool: "run_terminal_command", command: "echo hi", cwd: PROJECT } },
    },
    // Inside a subagent: the child's own session, no agent id, and nobody to ask.
    "pre-write-subagent.json": edit("write", 11, call(12, 0), "sub.ts", { form: "full", content: "x" }),
    "stop.json": { event: "stop", env: STOP, out: { kind: "stop", session: session(1), cwd: PROJECT, reentry: false } },
    "stop-reentry.json": { event: "stop", env: STOP, out: { kind: "stop", session: session(9), cwd: PROJECT, reentry: true } },
    // The Stop after SessionEnd: recognized and ignored (MH-06).
    "stop-shutdown.json": { event: "stop", env: STOP, out: null },
    "pre-hashline-read.json": { unregistered: "hashline_read is outside the PreToolUse matcher (it reads)" },
    "pre-spawn-subagent.json": { unregistered: "spawn_subagent (alias of Task and Agent) is outside the PreToolUse matcher" },
    "post-write.json": { unregistered: "PostToolUse is not registered" },
    "post-search-replace.json": { unregistered: "PostToolUse is not registered" },
    "post-hashline-edit.json": { unregistered: "PostToolUse is not registered" },
    "post-run-terminal-command.json": { unregistered: "PostToolUse is not registered" },
    "user-prompt-submit.json": { unregistered: "UserPromptSubmit is not registered" },
    "subagent-start.json": { unregistered: "SubagentStart is not registered" },
    // SubagentStop is the child session's Stop. The child's sessionId is the session, and there is no agent id.
    "subagent-stop.json": {
      event: "stop", env: STOP, out: { kind: "stop", session: session(11), cwd: PROJECT, reentry: false },
    },
    "session-end.json": { unregistered: "SessionEnd is not registered" },
  });

  test("search_replace with replace_all", () => {
    for (const all of [true, false]) {
      expect(decode("pre", toolInput("pre-search-replace.json", { replace_all: all }), PRE))
        .toMatchObject({ changes: [{ edit: { form: "oldnew", all } }] });
    }
  });

  test("only the camelCase keys are read: the snake twins may say anything", () => {
    const p = json("pre-write.json");
    const twins = { ...p, tool_name: "run_terminal_command", tool_input: { command: "rm -rf /" }, session_id: "x", hook_event_name: "Stop" };
    expect(decode("pre", raw(twins), PRE)).toEqual(decode("pre", payload("pre-write.json"), PRE));
  });

  test("the envelope admits keys it does not read; a run_terminal_command input too", () => {
    expect(decode("stop", raw({ ...json("stop.json"), somethingNew: 1 }), STOP)).toMatchObject({ kind: "stop" });
    expect(decode("pre", toolInput("pre-run-terminal-command.json", { timeout: 5, background: true }), PRE))
      .toMatchObject({ kind: "pre-command", command: { command: "echo hi" } });
  });

  test("a shutdown Stop is ignored whatever else it carries", () => {
    expect(decode("stop", raw({ ...json("stop-shutdown.json"), stopHookActive: "x" }), STOP)).toBeNull();
  });

  test("a SubagentStop without stopHookActive is refused; reentry still comes from the boolean", () => {
    const stop = json("subagent-stop.json");
    expect(causeOf(decode("stop", raw(without(stop, "stopHookActive")), STOP))).toBe(BAD);
    expect(decode("stop", raw({ ...stop, stopHookActive: true }), STOP)).toMatchObject({ kind: "stop", reentry: true, session: session(11) });
  });
});

describe("decode: a target the payload does not pin down denies anywhere", () => {
  const nowhere = (kind: HookEvent["kind"], n: number): Rejected => ({ cause: "cannot-reconstruct", kind, reentry: false, session: session(n), dirs: [] });
  const FILES: [string, HookEvent["kind"], number][] = [
    ["pre-write.json", "pre-edit", 1], ["pre-search-replace.json", "pre-edit", 1],
    ["pre-hashline-edit.json", "pre-edit", 6], ["pre-run-terminal-command.json", "pre-command", 1],
  ];

  // MH-12: before the tool, in every tool; a truncated command may hide the part that writes.
  for (const [file, kind, n] of FILES) {
    test.each([true, undefined, "false", 0, null])(`${file}: toolInputTruncated %p`, (truncated) => {
      const p = { ...json(file), toolInputTruncated: truncated };
      expect(decode("pre", raw(p), PRE)).toEqual(nowhere(kind, n));
    });
    test(`${file}: truncated to a string`, () => {
      const p = { ...json(file), toolInput: '{"file_path":"/home/user/project/a.ts","content":"export', toolInputTruncated: true };
      expect(decode("pre", raw(p), PRE)).toEqual(nowhere(kind, n));
    });
  }

  test.each([["apply_patch", "pre-edit"], ["edit", "pre-edit"], ["bash", "pre-command"]])("uncaptured %s", (tool, kind) => {
    const p = { ...json("pre-write.json"), toolName: tool, toolInput: { file_path: `${PROJECT}/a.ts`, content: "x" } };
    expect(decode("pre", raw(p), PRE)).toEqual(nowhere(kind as HookEvent["kind"], 1));
  });

  test.each([
    "a.ts", "./a.ts", "../other/a.ts", `${PROJECT}/../other/a.ts`, `${PROJECT}/./a.ts`, `${PROJECT}//a.ts`, `${PROJECT}/src/`, "",
  ])("file_path %p is not absolute and normalized", (path) => {
    for (const file of ["pre-write.json", "pre-search-replace.json", "pre-hashline-edit.json"]) {
      expect(decode("pre", toolInput(file, { file_path: path }), PRE)).toMatchObject({ cause: "cannot-reconstruct", dirs: [] });
    }
  });
});

describe("decode: an edit this profile does not know is judged where it lands", () => {
  const unknown = (file: string, change: Record<string, unknown>, drop?: string) =>
    expect(decode("pre", toolInput(file, change, drop), PRE)).toMatchObject({ kind: "pre-edit", changes: [{ path: `${PROJECT}/a.ts`, edit: { form: "unknown" } }] });

  test.each(["pre-write.json", "pre-search-replace.json"])("%s with an extra key (it may change what gets written)", (file) => {
    unknown(file, { encoding: "utf16" });
  });
  test.each([["content", null], ["content", 1]])("write: %s = %p", (key, wrong) => unknown("pre-write.json", { [key]: wrong }));
  test("write without content", () => unknown("pre-write.json", {}, "content"));
  test.each([["old_string", 0], ["new_string", {}], ["replace_all", "yes"]])("search_replace: %s = %p", (key, wrong) => {
    unknown("pre-search-replace.json", { [key]: wrong });
  });
  test.each(["old_string", "new_string"])("search_replace without %s", (key) => unknown("pre-search-replace.json", {}, key));
});

describe("decode: anything else is rejected as payload-unrecognized", () => {
  // Every envelope field the adapter reads, missing and with the wrong type.
  const ENVELOPE: [string, HookKind, HookEnv, string, unknown][] = [
    ["pre-write.json", "pre", PRE, "sessionId", 7], ["pre-write.json", "pre", PRE, "cwd", null],
    ["pre-write.json", "pre", PRE, "hookEventName", "post_tool_use"], ["pre-write.json", "pre", PRE, "toolName", 1],
    ["pre-write.json", "pre", PRE, "toolInput", ["x"]], ["pre-write.json", "pre", PRE, "toolUseId", 3],
    ["stop.json", "stop", STOP, "stopHookActive", "false"], ["session-start.json", "session-start", env("session_start"), "sessionId", []],
  ];
  for (const [file, event, e, key, wrong] of ENVELOPE) {
    test(`${file}: ${key} missing`, () => expect(causeOf(decode(event, raw(without(json(file), key)), e))).toBe(BAD));
    test(`${file}: ${key} = ${JSON.stringify(wrong)}`, () => expect(causeOf(decode(event, raw({ ...json(file), [key]: wrong }), e))).toBe(BAD));
  }

  test.each([
    ["pre-write.json", "file_path"], ["pre-hashline-edit.json", "file_path"], ["pre-run-terminal-command.json", "command"],
  ])("%s: toolInput.%s missing or not a string", (file, key) => {
    expect(causeOf(decode("pre", toolInput(file, {}, key), PRE))).toBe(BAD);
    expect(causeOf(decode("pre", toolInput(file, { [key]: 1 }), PRE))).toBe(BAD);
  });

  test("a relative cwd", () => expect(causeOf(decode("stop", raw({ ...json("stop.json"), cwd: "project" }), STOP))).toBe(BAD));

  test.each(["hashline_read", "spawn_subagent", "Write", "read_file"])("toolName %p is outside the exact set", (tool) => {
    expect(causeOf(decode("pre", raw({ ...json("pre-write.json"), toolName: tool }), PRE))).toBe(BAD);
  });

  test.each([
    ["stop", "pre-write.json"], ["pre", "stop.json"], ["session-start", "stop.json"], ["pre", "session-start.json"],
    ["pre", "post-write.json"],
  ] as [HookKind, string][])("hook %s receiving %s", (event, file) => expect(causeOf(decode(event, payload(file), PRE))).toBe(BAD));

  test("a Claude Code payload: no camelCase keys", () => {
    const claude = readFileSync(`${import.meta.dir}/../payloads/pre-write.json`, "utf8");
    expect(causeOf(decode("pre", claude, PRE))).toBe(BAD);
  });

  test.each(["", "not json", "[]", "null", "42", '{"hookEventName":"pre_tool_use"'])("stdin %p", (text) => {
    expect(decode("pre", text, PRE)).toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: null, dirs: [] });
  });

  test("the refusal leaves through the event's channel, with the directories that locate the call", () => {
    const dirs = [PROJECT, PROJECT, `${PROJECT}/`];
    expect(decode("pre", raw({ ...json("pre-write.json"), toolName: "hashline_read" }), PRE))
      .toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: session(1), dirs });
    expect(decode("stop", raw({ ...json("stop-reentry.json"), cwd: "project" }), STOP))
      .toEqual({ cause: BAD, kind: "stop", reentry: true, session: session(9), dirs: dirs.slice(1) });
    expect(decode("session-start", raw({ ...json("session-start.json"), sessionId: 2 }), ENV))
      .toEqual({ cause: BAD, kind: "session-start", reentry: false, session: null, dirs: dirs.slice(0, 2) });
  });
});

// ── encode ────────────────────────────────────────────────────────────────────────

const GOLDEN_LOCK = JSON.parse(readFileSync(`${import.meta.dir}/../presets/valid.lock.json`, "utf8")) as Lock;
const LOCK: Lock = {
  ...GOLDEN_LOCK, enforcement: "enforce",
  rules: GOLDEN_LOCK.rules.map((r) => ({ ...r, enforcement: "enforce", severity: r.id === "core/TDD-FOCUS-001" ? "ask" : r.severity })),
};
const SEVERITY: Record<string, Severity> = { "core/CA-DEP-002": "warn", "core/TDD-FOCUS-001": "ask" };
const v = (rule: string, line: number): Violation => ({
  rule, path: "src/domain/invoice.ts", line, symbol: "Invoice.total", measured: null, limit: null, atSessionStart: null,
  severity: SEVERITY[rule] ?? "deny",
});
// Adapter encoding consumes policy decisions; consent belongs to the gate integration tests.
function rejected(r: Rejected): Decision {
  return decide(input({ event: r.kind, form: { cause: r.cause, line: null },
    stop: r.kind === "stop" ? { blocks: 0, reentry: r.reentry, approved: [] } : null }));
}

const input = (change: Partial<DecideInput>): DecideInput => ({
  lock: LOCK, lockHash: "c".repeat(64), launcher: "/home/user/my project/.pregate/bin/pregate",
  session: session(1), event: "pre-edit", path: "src/domain/invoice.ts", introduced: [], form: null, protectedPath: false,
  history: [], turnDenials: 0, astHash: null, stop: null, ...change,
});
const NONE: Emission = { stdout: "", stderr: "", exit: 0 };
const emitted: Emission[] = [];
const enc = (kind: HookEvent["kind"], d: Decision): Emission => {
  const e = encode(kind, d);
  emitted.push(e);
  return e;
};
const denied = (reason: string): Emission => ({
  stdout: `${raw({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })}\n`,
  stderr: reason, exit: 2,
});

describe("encode", () => {
  test("no objection: quiet when empty, or PreToolUse additionalContext for warnings and advisor findings", () => {
    expect(enc("pre-edit", decide(input({})))).toEqual(NONE);
    expect(enc("pre-command", decide(input({ event: "pre-command", path: null })))).toEqual(NONE);
    const warned = decide(input({ introduced: [v("core/CA-DEP-002", 3)] }));
    expect(warned.full).not.toBe("");
    expect(enc("pre-edit", warned)).toEqual({
      stdout: `${raw({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: warned.full } })}\n`, stderr: "", exit: 0,
    });
    const advisorLock: Lock = { ...LOCK, enforcement: "advisor", rules: LOCK.rules.map((r) => ({ ...r, enforcement: r.integrity ? "enforce" : "advisor" })) };
    const advised = decide(input({ lock: advisorLock, introduced: [v("core/FCIS-IO-001", 4)] }));
    expect(advised.verdict).toBe("none");
    expect(advised.full).toContain("PREGATE ADVISOR");
    expect(enc("pre-edit", advised)).toEqual({
      stdout: `${raw({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: advised.full } })}\n`, stderr: "", exit: 0,
    });
  });

  test("deny: the compact reason in the JSON and on stderr, exit 2", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4), v("core/EVA-CAST-001", 9)] }));
    expect(d.verdict).toBe("deny");
    expect(enc("pre-edit", d)).toEqual(denied(d.compact));
    expect(enc("pre-command", d)).toEqual(denied(d.compact));
  });

  test("deny + halt: Grok ignores continue:false, so it is not emitted", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4)], turnDenials: LOCK.loop.maxDenialsPerTurn }));
    expect(d.halt).toBe(true);
    expect(enc("pre-edit", d)).toEqual(denied(d.compact));
  });

  test("ask: a deny (--always-approve would run it, and headless default cancels the turn)", () => {
    const d = decide(input({ introduced: [v("core/TDD-FOCUS-001", 12)], session: { ...session(1), interactive: true } }));
    expect(d.verdict).toBe("ask");
    expect(enc("pre-edit", d)).toEqual(denied(d.compact));
  });

  test("an adapter's refusal denies through the event's channel", () => {
    const r = decode("pre", raw({ ...json("pre-write.json"), toolInputTruncated: true }), PRE) as Rejected;
    const d = rejected(r);
    expect(enc(r.kind, d)).toEqual(denied(d.compact));
    expect(d.compact).toContain("cannot-reconstruct");
    expect(enc("pre-command", rejected({ ...r, cause: BAD, kind: "pre-command" })).exit).toBe(2);
  });

  test("Stop block: decision block with exactly two keys, exit 0", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop: { blocks: 0, reentry: false, approved: [] } }));
    expect(d.verdict).toBe("deny");
    const e = enc("stop", d);
    expect(e).toEqual({ stdout: `${raw({ decision: "block", reason: d.compact })}\n`, stderr: "", exit: 0 });
    expect(Object.keys(JSON.parse(e.stdout) as object)).toEqual(["decision", "reason"]);
    expect(enc("stop", rejected({ cause: BAD, kind: "stop", reentry: false, session: null, dirs: [] })).stdout).toContain('"decision":"block"');
  });

  test("Stop past its cap, or a refused reentry: the notice has no channel in Grok", () => {
    const stop = { blocks: LOCK.loop.maxStopBlocks, reentry: true, approved: [] };
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop }));
    expect(d.notice).not.toBeNull();
    expect(enc("stop", d)).toEqual(NONE);
    expect(enc("stop", rejected({ cause: BAD, kind: "stop", reentry: true, session: null, dirs: [] }))).toEqual(NONE);
  });

  test("SessionStart: nothing, whatever the decision", () => {
    expect(enc("session-start", { ...decide(input({})), full: "PREGATE is active: …", notice: "PREGATE: aviso" })).toEqual(NONE);
    expect(enc("session-start", rejected({ cause: BAD, kind: "session-start", reentry: false, session: null, dirs: [] }))).toEqual(NONE);
  });

  test("a reason is one line: Grok shows the model only the first one", () => {
    const d: Decision = { ...decide(input({ introduced: [v("core/FCIS-IO-001", 4)] })), compact: "PREGATE DENY a\nb\r\nc" };
    expect(enc("pre-edit", d)).toEqual(denied("PREGATE DENY a b c"));
    expect(JSON.parse(enc("stop", d).stdout)).toEqual({ decision: "block", reason: "PREGATE DENY a b c" });
  });

  // Runs last: every emission of this file.
  test('"allow" never leaves; exit 2 always carries stderr; a reason is ≤ 256 characters on one line', () => {
    expect(emitted.length).toBeGreaterThan(10);
    for (const e of emitted) {
      expect(e.stdout).not.toContain("allow");
      expect([0, 2]).toContain(e.exit);
      if (e.exit === 2) expect(e.stderr).not.toBe("");
      if (e.stdout === "") continue;
      const o = JSON.parse(e.stdout) as { reason?: string; hookSpecificOutput?: { permissionDecisionReason?: string; additionalContext?: string } };
      if (o.hookSpecificOutput?.additionalContext !== undefined) {
        expect(o.hookSpecificOutput.additionalContext).not.toBe("");
        continue;
      }
      const reason = o.reason ?? o.hookSpecificOutput?.permissionDecisionReason ?? "";
      expect(reason).not.toBe("");
      expect(reason.length).toBeLessThanOrEqual(256);
      expect(reason).not.toMatch(/[\r\n]/);
    }
  });
});
