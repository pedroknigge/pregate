import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decide } from "../../src/decide.ts";
import { decode, encode, eventOf } from "../../src/harness/claude.ts";
import type { Decision, DecideInput, Emission, HookEvent, HookKind, Lock, Rejected, Severity, Violation } from "../../src/types.ts";
import { contract, ENV } from "./contract.ts";

// The Claude Code contract (ARCHITECTURE §8): real payloads captured from Claude Code 2.1.287 in
// test/payloads, decoded to exact events; decisions from the real policy, encoded to exact output.

const PAYLOADS = `${import.meta.dir}/../payloads`;
const PROJECT = "/home/user/project";
const BAD = "payload-unrecognized";
const payload = (name: string): string => readFileSync(`${PAYLOADS}/${name}`, "utf8");
const json = (name: string): Record<string, unknown> => JSON.parse(payload(name)) as Record<string, unknown>;
const raw = (o: unknown): string => `${JSON.stringify(o)}\n`;
const sid = (n: number): string => `00000000-0000-4000-8000-00000000000${n}`;
const prompt = (n: number): string => `00000000-0000-4000-8000-0000000000a${n}`;
const call = (n: number): string => `toolu_01CAPTURE000000000000000${n}`;
const main = { id: sid(1), harness: "claude-code" as const, agentId: null, turnId: prompt(1), interactive: true };
const causeOf = (e: HookEvent | Rejected | null): string | null => (e !== null && "cause" in e ? e.cause : null);
const firstChange = (e: HookEvent | Rejected | null) => (e as Extract<HookEvent, { kind: "pre-edit" }>).changes[0]!;

describe("decode: captured payloads", () => {
  contract("claude-code", PAYLOADS, {
    "session-start.json": {
      event: "session-start",
      out: { kind: "session-start", session: { ...main, turnId: null, interactive: false }, cwd: PROJECT },
    },
    "pre-write.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: main, callId: call(1), tool: "Write", path: `${PROJECT}/a.ts`,
          edit: { form: "full", content: "export const a = 1;\nexport const b = 1;\n" }, from: null,
        }],
      },
    },
    "pre-edit.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: main, callId: call(2), tool: "Edit", path: `${PROJECT}/a.ts`,
          edit: { form: "oldnew", old: "const a = 1", neu: "const a = 10", all: false, lines: null }, from: null,
        }],
      },
    },
    "pre-edit-replace-all.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: main, callId: call(3), tool: "Edit", path: `${PROJECT}/a.ts`,
          edit: { form: "oldnew", old: "export const", neu: "export let", all: true, lines: null }, from: null,
        }],
      },
    },
    // Claude Code created the file: the empty old_string reaches reconstruct as is (MH-13).
    "pre-edit-empty-old.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: main, callId: call(4), tool: "Edit", path: `${PROJECT}/b.ts`,
          edit: { form: "oldnew", old: "", neu: (json("pre-edit-empty-old.json").tool_input as { new_string: string }).new_string, all: false, lines: null },
          from: null,
        }],
      },
    },
    "pre-bash.json": {
      event: "pre",
      out: { kind: "pre-command", command: { session: main, callId: call(5), tool: "Bash", command: "echo captured", cwd: PROJECT } },
    },
    "pre-monitor.json": {
      event: "pre", out: {
        kind: "pre-command", command: {
          session: { ...main, id: sid(4), turnId: prompt(4) }, callId: call(7), tool: "Monitor", command: "echo captured", cwd: PROJECT,
        },
      },
    },
    // A subagent never gets an ask: nobody is there to answer it (D13).
    "pre-write-subagent.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: { ...main, id: sid(2), agentId: "a0000000000000001", turnId: prompt(2), interactive: false }, callId: call(6),
          tool: "Write", path: `${PROJECT}/c.ts`, edit: { form: "full", content: "export const d = 4;\n" }, from: null,
        }],
      },
    },
    "stop.json": { event: "stop", out: { kind: "stop", session: main, cwd: PROJECT, reentry: false } },
    "stop-reentry.json": { event: "stop", out: { kind: "stop", session: main, cwd: PROJECT, reentry: true } },
    // Grok's camelCase twins: not this profile. The session and the cwd still locate the call (MH-06).
    "grok-pre-write.fabricated.json": {
      event: "pre", out: {
        cause: BAD, kind: "pre-edit", reentry: false, dirs: [PROJECT],
        session: { id: sid(3), harness: "claude-code", agentId: null, turnId: null, interactive: false },
      },
    },
  });

  test("hook auto: the event the payload names", () => {
    expect(eventOf(payload("stop-reentry.json"))).toBe("stop");
    expect(eventOf(payload("session-start.json"))).toBe("session-start");
    expect(eventOf(payload("pre-monitor.json"))).toBe("pre");
    for (const text of ["garbage", raw({ hook_event_name: "PostToolUse" }), raw({ hookEventName: "PreToolUse" })]) expect(eventOf(text)).toBeNull();
  });

  test("GROK_HOOK_EVENT inherited from a parent process does not change a Claude Code payload", () => {
    expect(decode("pre", payload("pre-write.json"), { ...ENV, grokEvent: "pre_tool_use" })).toEqual(decode("pre", payload("pre-write.json"), ENV));
  });

  test("CLAUDE_CODE_REMOTE: not interactive", () => {
    expect(firstChange(decode("pre", payload("pre-write.json"), { ...ENV, remote: true })).session.interactive).toBe(false);
  });

  test.each([
    ["default", true], ["acceptEdits", true], ["auto", true], ["plan", true],
    ["bypassPermissions", false], ["dontAsk", false], [undefined, false],
  ])("permission_mode %p ⇒ interactive %p", (mode, interactive) => {
    const p = { ...json("pre-write.json"), permission_mode: mode };
    expect(firstChange(decode("pre", raw(p), ENV)).session.interactive).toBe(interactive);
  });

  test("CRLF in an Edit reaches the core verbatim (reconstruct normalizes it)", () => {
    const p = json("pre-edit.json");
    const e = decode("pre", raw({ ...p, tool_input: { ...(p.tool_input as object), old_string: "a\r\nb", new_string: "c\r\n" } }), ENV);
    expect(firstChange(e).edit).toEqual({ form: "oldnew", old: "a\r\nb", neu: "c\r\n", all: false, lines: null });
  });

  test("MultiEdit and NotebookEdit cannot be reconstructed, but their path is still checked", () => {
    const multi = { ...json("pre-edit.json"), tool_name: "MultiEdit", tool_input: { file_path: `${PROJECT}/a.ts`, edits: [] } };
    const notebook = { ...json("pre-edit.json"), tool_name: "NotebookEdit", tool_input: { notebook_path: `${PROJECT}/n.ipynb`, new_source: "" } };
    expect(firstChange(decode("pre", raw(multi), ENV))).toMatchObject({ path: `${PROJECT}/a.ts`, edit: { form: "unknown", cause: "MultiEdit" } });
    expect(firstChange(decode("pre", raw(notebook), ENV))).toMatchObject({ path: `${PROJECT}/n.ipynb`, edit: { form: "unknown" } });
  });

  test("an extra key in a Bash input does not change what runs: ignored", () => {
    const p = json("pre-bash.json");
    const e = decode("pre", raw({ ...p, tool_input: { command: "ls", dangerouslyDisableSandbox: true, timeout: 5, run_in_background: true } }), ENV);
    expect(e).toMatchObject({ kind: "pre-command", command: { command: "ls" } });
  });

  test("the envelope admits keys it does not read", () => {
    expect(decode("stop", raw({ ...json("stop.json"), something_new: 1 }), ENV)).toMatchObject({ kind: "stop" });
  });
});

describe("decode: anything else is rejected as payload-unrecognized", () => {
  const without = (o: Record<string, unknown>, key: string): Record<string, unknown> => {
    const { [key]: _, ...rest } = o;
    return rest;
  };
  const input = (file: string, change: Record<string, unknown>, drop?: string): string => {
    const p = json(file);
    const i = { ...(p.tool_input as Record<string, unknown>), ...change };
    return raw({ ...p, tool_input: drop === undefined ? i : without(i, drop) });
  };

  // Every field the adapter reads, missing and with the wrong type.
  const ENVELOPE: [string, HookKind, string, unknown][] = [
    ["pre-write.json", "pre", "session_id", 7], ["pre-write.json", "pre", "cwd", null],
    ["pre-write.json", "pre", "hook_event_name", "PostToolUse"], ["pre-write.json", "pre", "tool_name", 1],
    ["pre-write.json", "pre", "tool_input", "{}"], ["pre-write.json", "pre", "tool_use_id", 3],
    ["stop.json", "stop", "stop_hook_active", "false"], ["session-start.json", "session-start", "session_id", []],
  ];
  for (const [file, event, key, wrong] of ENVELOPE) {
    test(`${file}: ${key} missing`, () => expect(causeOf(decode(event, raw(without(json(file), key)), ENV))).toBe(BAD));
    test(`${file}: ${key} = ${JSON.stringify(wrong)}`, () => expect(causeOf(decode(event, raw({ ...json(file), [key]: wrong }), ENV))).toBe(BAD));
  }

  test.each(["prompt_id", "agent_id", "permission_mode"])("optional %s with the wrong type", (key) => {
    expect(causeOf(decode("pre", raw({ ...json("pre-write.json"), [key]: 1 }), ENV))).toBe(BAD);
  });

  const INPUT: [string, string, unknown][] = [
    ["pre-write.json", "file_path", 1], ["pre-write.json", "content", null],
    ["pre-edit.json", "file_path", false], ["pre-edit.json", "old_string", 0], ["pre-edit.json", "new_string", {}],
    ["pre-bash.json", "command", ["ls"]], ["pre-monitor.json", "command", 1],
  ];
  for (const [file, key, wrong] of INPUT) {
    test(`${file}: tool_input.${key} missing`, () => expect(causeOf(decode("pre", input(file, {}, key), ENV))).toBe(BAD));
    test(`${file}: tool_input.${key} = ${JSON.stringify(wrong)}`, () => expect(causeOf(decode("pre", input(file, { [key]: wrong }), ENV))).toBe(BAD));
  }

  test("replace_all with the wrong type", () => expect(causeOf(decode("pre", input("pre-edit.json", { replace_all: "yes" }), ENV))).toBe(BAD));
  test("replace_all may be absent", () => expect(decode("pre", input("pre-edit.json", {}, "replace_all"), ENV)).toMatchObject({ kind: "pre-edit" }));

  test.each(["pre-write.json", "pre-edit.json"])("%s with an extra key in tool_input (it may change what gets written)", (file) => {
    expect(causeOf(decode("pre", input(file, { encoding: "utf16" }), ENV))).toBe(BAD);
  });

  test.each([
    "a.ts", "./a.ts", `${PROJECT}/../etc/a.ts`, `${PROJECT}/./a.ts`, `${PROJECT}//a.ts`, `${PROJECT}/src/`, "C:project\\a.ts",
  ])("file_path %p is not absolute and normalized", (path) => {
    expect(causeOf(decode("pre", input("pre-write.json", { file_path: path }), ENV))).toBe(BAD);
  });

  test("a relative cwd", () => expect(causeOf(decode("stop", raw({ ...json("stop.json"), cwd: "project" }), ENV))).toBe(BAD));

  test.each(["write", "Task"])("tool_name %p is outside the exact set", (tool) => {
    expect(causeOf(decode("pre", raw({ ...json("pre-write.json"), tool_name: tool }), ENV))).toBe(BAD);
  });
  test("Read and Grep are read checks, not edits", () => {
    expect(decode("pre", raw({ ...json("pre-write.json"), tool_name: "Read" }), ENV)).toMatchObject({
      kind: "pre-read", tool: "Read", cwd: PROJECT, paths: [`${PROJECT}/a.ts`], hint: "",
    });
    expect(decode("pre", raw({ ...json("pre-write.json"), tool_name: "Grep", tool_input: { pattern: "x", path: PROJECT } }), ENV)).toMatchObject({
      kind: "pre-read", tool: "Grep", paths: [PROJECT], hint: "x",
    });
  });

  test.each([
    ["stop", "pre-write.json"], ["pre", "stop.json"], ["session-start", "stop.json"], ["pre", "session-start.json"],
  ] as [HookKind, string][])("hook %s receiving %s", (event, file) => expect(causeOf(decode(event, payload(file), ENV))).toBe(BAD));

  test.each(["", "not json", "[]", "null", "42", '{"hook_event_name":"PreToolUse"'])("stdin %p", (text) => {
    expect(causeOf(decode("pre", text, ENV))).toBe(BAD);
  });

  test("camelCase twins of another harness, even next to valid snake_case keys", () => {
    for (const key of ["hookEventName", "toolName", "toolInput", "toolInputTruncated"]) {
      expect(causeOf(decode("pre", raw({ ...json("pre-write.json"), [key]: "x" }), ENV))).toBe(BAD);
    }
  });

  test("the refusal leaves through the event's channel, with the directories that locate the call", () => {
    expect(decode("stop", "garbage", ENV)).toEqual({ cause: BAD, kind: "stop", reentry: false, session: null, dirs: [] });
    const reentry = decode("stop", raw({ ...json("stop-reentry.json"), cwd: "project" }), { ...ENV, projectDir: "/home/user/other/" });
    expect(reentry).toEqual({ cause: BAD, kind: "stop", reentry: true, session: main, dirs: ["/home/user/other/"] });
    expect(decode("session-start", raw({ ...json("session-start.json"), source: 1, session_id: 2 }), ENV))
      .toEqual({ cause: BAD, kind: "session-start", reentry: false, session: null, dirs: [PROJECT] });
    expect(decode("pre", raw({ ...json("pre-write.json"), tool_name: "Read" }), ENV)).toMatchObject({
      kind: "pre-read", session: main, cwd: PROJECT, paths: [`${PROJECT}/a.ts`],
    });
  });
});

// ── encode ────────────────────────────────────────────────────────────────────────

const GOLDEN_LOCK = JSON.parse(readFileSync(`${import.meta.dir}/../presets/valid.lock.json`, "utf8")) as Lock;
// The compiled golden lock, enforced, with TDD-FOCUS-001 at `ask` as an override would set it.
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
  session: main, event: "pre-edit", path: "src/domain/invoice.ts", introduced: [], form: null, protectedPath: false,
  history: [], turnDenials: 0, astHash: null, stop: null, ...change,
});
const out = (e: Emission): Record<string, unknown> => JSON.parse(e.stdout) as Record<string, unknown>;
const emitted: Emission[] = [];
const unrecognized = (kind: HookEvent["kind"], reentry: boolean): Decision => rejected({ cause: BAD, kind, reentry, session: null, dirs: [] });
const enc = (kind: HookEvent["kind"], d: Decision): Emission => {
  const e = encode(kind, d);
  emitted.push(e);
  return e;
};

describe("encode", () => {
  test("no objection: nothing on stdout, exit 0", () => {
    expect(enc("pre-edit", decide(input({})))).toEqual({ stdout: "", stderr: "", exit: 0 });
    expect(enc("pre-command", decide(input({ event: "pre-command", path: null })))).toEqual({ stdout: "", stderr: "", exit: 0 });
  });

  test("introduced warn only: additionalContext, exit 0", () => {
    const d = decide(input({ introduced: [v("core/CA-DEP-002", 3)] }));
    const e = enc("pre-edit", d);
    expect(e.exit).toBe(0);
    expect(out(e)).toEqual({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: d.full } });
    expect(d.full).toContain("informational; no action required for this task");
  });

  test("deny: JSON reason and stderr carry the same full text, exit 2", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4), v("core/EVA-CAST-001", 9)] }));
    const e = enc("pre-edit", d);
    expect(d.halt).toBe(false);
    expect(e).toEqual({
      stdout: raw({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: d.full } }),
      stderr: d.full, exit: 2,
    });
    expect(d.full.startsWith(d.compact)).toBe(true);
    // The pre-check cites the absolute launcher, quoted as one shell word.
    expect(d.full).toContain("'/home/user/my project/.pregate/bin/pregate' check --stdin --path src/domain/invoice.ts --format agent");
  });

  test("deny + halt: continue:false and stopReason for the human, still exit 2", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4)], turnDenials: LOCK.loop.maxDenialsPerTurn }));
    const e = enc("pre-edit", d);
    expect(d.halt).toBe(true);
    expect(e.exit).toBe(2);
    expect(e.stderr).toBe(d.full);
    expect(out(e)).toEqual({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: d.full },
      continue: false, stopReason: d.notice,
    });
  });

  test("ask: the human reads the notice, the agent reads the violation, exit 0", () => {
    const d = decide(input({ introduced: [v("core/TDD-FOCUS-001", 12)] }));
    const e = enc("pre-edit", d);
    expect(d.verdict).toBe("ask");
    expect(e).toEqual({
      stdout: raw({
        hookSpecificOutput: {
          hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: d.notice, additionalContext: d.full,
        },
      }),
      stderr: "", exit: 0,
    });
  });

  test("ask without a human to answer: deny + halt", () => {
    const d = decide(input({ introduced: [v("core/TDD-FOCUS-001", 12)], session: { ...main, interactive: false } }));
    expect(out(enc("pre-edit", d))).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny" }, continue: false });
  });

  test("Stop block: decision block, exit 2", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop: { blocks: 0, reentry: false, approved: [] } }));
    const e = enc("stop", d);
    expect(e).toEqual({ stdout: raw({ decision: "block", reason: d.full }), stderr: d.full, exit: 2 });
    expect(d.full).toContain("Do not remove functionality or tests to comply");
  });

  test.each([false, true])("warn-only Stop ends quietly, including reentry %p", (reentry) => {
    const event = decode("stop", raw({ ...json("stop.json"), stop_hook_active: reentry }), ENV);
    if (event === null || event.kind !== "stop" || "cause" in event) throw new Error("expected a Stop event");
    const d = decide(input({ event: "stop", introduced: [v("core/CA-DEP-002", 3)],
      stop: { blocks: 0, reentry: event.reentry, approved: [] } }));
    expect(d.verdict).toBe("none");
    expect(d.warnings).toHaveLength(1);
    expect(d.full).toContain("informational; no action required for this task");
    // Claude treats Stop.additionalContext as a request to continue, even with exit 0.
    expect(enc("stop", d)).toEqual({ stdout: "", stderr: "", exit: 0 });
  });

  test("shadow Stop retains the observation without continuing the conversation", () => {
    const lock: Lock = { ...LOCK, enforcement: "shadow", rules: LOCK.rules.map(r => ({ ...r, enforcement: "shadow" })) };
    const d = decide(input({ event: "stop", lock, introduced: [v("core/FCIS-IO-001", 4)],
      stop: { blocks: 0, reentry: true, approved: [] } }));
    expect(d.verdict).toBe("none");
    expect(d.shadowed).toBe(true);
    expect(d.violations).toHaveLength(1);
    expect(enc("stop", d)).toEqual({ stdout: "", stderr: "", exit: 0 });
  });

  test("nonblocking Stop notices use only the human channel", () => {
    const notice = "PREGATE UNVERIFIED: active requirements lack project verifiers.";
    const d = { ...decide(input({ event: "stop", introduced: [v("core/CA-DEP-002", 3)] })), notice };
    expect(enc("stop", d)).toEqual({ stdout: raw({ systemMessage: notice }), stderr: "", exit: 0 });
  });

  test("Stop reentry still blocks an enforce violation before the cap", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)],
      stop: { blocks: 0, reentry: true, approved: [] } }));
    expect(d.verdict).toBe("deny");
    expect(enc("stop", d)).toEqual({ stdout: raw({ decision: "block", reason: d.full }), stderr: d.full, exit: 2 });
  });

  test("a warn at the Stop cap does not restart the bounded loop", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4), v("core/CA-DEP-002", 3)],
      stop: { blocks: LOCK.loop.maxStopBlocks, reentry: true, approved: [] } }));
    expect(d.verdict).toBe("none");
    expect(d.stopIncomplete).toMatchObject({ reason: "limit" });
    expect(d.warnings).toHaveLength(1);
    expect(enc("stop", d)).toEqual({ stdout: raw({ systemMessage: d.notice }), stderr: "", exit: 0 });
  });

  test("Stop past its cap: the human is told, exit 0", () => {
    const stop = { blocks: LOCK.loop.maxStopBlocks, reentry: true, approved: [v("core/TDD-FOCUS-001", 2)] };
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop }));
    expect(enc("stop", d)).toEqual({ stdout: raw({ systemMessage: d.notice }), stderr: "", exit: 0 });
  });

  test("SessionStart: context for the agent, notice for the human, always exit 0", () => {
    const d: Decision = { ...decide(input({})), full: "PREGATE is active: …", notice: "PREGATE: aviso" };
    expect(enc("session-start", d)).toEqual({
      stdout: raw({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: d.full }, systemMessage: d.notice }),
      stderr: "", exit: 0,
    });
  });

  test("an unrecognized payload denies and stops the turn through the event's channel", () => {
    const pre = enc("pre-edit", unrecognized("pre-edit", false));
    expect(pre.exit).toBe(2);
    expect(out(pre)).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny" }, continue: false });
    expect(pre.stderr).toContain("payload-unrecognized");
    const stop = enc("stop", unrecognized("stop", false));
    expect(stop.exit).toBe(2);
    expect(out(stop)).toMatchObject({ decision: "block" });
    // On reentry Stop lets the turn end and tells the human, as the launcher's own fail-closed does.
    const again = enc("stop", unrecognized("stop", true));
    expect(again.exit).toBe(0);
    expect(Object.keys(out(again))).toEqual(["systemMessage"]);
    const start = enc("session-start", unrecognized("session-start", false));
    expect(start.exit).toBe(0);
    expect(Object.keys(out(start))).toEqual(["systemMessage"]);
  });

  test("an extra key in Write or Edit ends in deny + halt", () => {
    const p = json("pre-write.json");
    const e = decode("pre", raw({ ...p, tool_input: { ...(p.tool_input as object), mode: "append" } }), ENV);
    expect(causeOf(e)).toBe(BAD);
    expect(out(enc("pre-edit", unrecognized("pre-edit", false)))).toMatchObject({ continue: false });
  });

  // Runs last: every emission of this file.
  test('the string "allow" never leaves, and exit is 0 or 2', () => {
    expect(emitted.length).toBeGreaterThan(10);
    for (const e of emitted) {
      expect(e.stdout).not.toContain('"allow"');
      expect([0, 2]).toContain(e.exit);
      if (e.exit === 2) expect(e.stderr).not.toBe("");
    }
  });
});
