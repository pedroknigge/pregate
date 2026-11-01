import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decide } from "../../src/decide.ts";
import { decode, encode } from "../../src/harness/cursor.ts";
import type { DecideInput, Decision, Emission, HookEvent, HookKind, Lock, Rejected, Session, Severity, Violation } from "../../src/types.ts";
import { contract, ENV } from "./contract.ts";

// The Cursor contract (MULTI-HARNESS MH-05, MH-06, MH-14): real payloads captured from cursor-agent
// 2026.09.26-dd393fe in test/payloads/cursor, decoded to exact events; decisions from the real policy,
// encoded to exact output.

const DIR = `${import.meta.dir}/../payloads/cursor`;
const PROJECT = "/home/user/project";
const BAD = "payload-unrecognized";
const json = (name: string): Record<string, unknown> => JSON.parse(readFileSync(`${DIR}/${name}`, "utf8")) as Record<string, unknown>;
const raw = (o: unknown): string => JSON.stringify(o);
const uuid = (n: string): string => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const session = (id: string, turn: string): Session => ({ id: uuid(id), harness: "cursor", agentId: null, turnId: uuid(turn), interactive: false });
const toolu = (n: number): string => `toolu_01CAPTURE000000000000000${n}`;
const write = (s: Session, callId: string, file: string, content: string): HookEvent => ({
  kind: "pre-edit", changes: [{ session: s, callId, tool: "Write", path: `${PROJECT}/${file}`, edit: { form: "full", content }, from: null }],
});
const causeOf = (e: HookEvent | Rejected | null): string | null => (e !== null && "cause" in e ? e.cause : null);
const MATCHER = "the shared PreToolUse matcher (MH-22) names no tool Cursor calls this";
const EVENT = "an event the shared registration does not declare";

describe("decode: captured payloads", () => {
  contract("cursor", DIR, {
    "session-start.json": { event: "session-start", out: { kind: "session-start", session: session("1", "1"), cwd: PROJECT } },
    "pre-write-create.json": { event: "pre", out: write(session("1", "1"), toolu(1), "a.ts", "export const a = 1;\n") },
    // The hook declared in ~/.claude/settings.json gets Cursor's payload, byte for byte.
    "claude-import-pre-write.json": { event: "pre", out: write(session("1", "1"), toolu(1), "a.ts", "export const a = 1;\n") },
    // A str_replace and a GPT patch both arrive as the whole resulting file.
    "pre-write-strreplace.json": { event: "pre", out: write(session("1", "1"), toolu(2), "a.ts", "export const a = 2;\n") },
    "pre-write-applypatch-gpt.json": {
      event: "pre", out: write(session("2", "2"), "call_CAPTURE000000000003\nctc_CAPTURE0000000000000000000000000000000000000003", "b.ts",
        "export const a = 1;\nexport const b = 2;\nexport const c = 30;\nexport const d = 4;\nexport const e = 5;\n"),
    },
    // A subagent is a session of its own, with no parent marker.
    "pre-write-subagent.json": { event: "pre", out: write(session("6", "6"), toolu(6), "sub.ts", "export const s = 1;\n") },
    "pre-delete.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: session("2", "2"), callId: "call_CAPTURE000000000004\nfc_CAPTURE0000000000000000000000000000000000000004",
          tool: "Delete", path: `${PROJECT}/c.txt`, edit: { form: "delete" }, from: null,
        }],
      },
    },
    // cwd "" with one workspace root: that root.
    "pre-shell.json": {
      event: "pre",
      out: { kind: "pre-command", command: { session: session("1", "1"), callId: uuid("3"), tool: "Shell", command: "echo hello", cwd: PROJECT } },
    },
    "stop.json": { event: "stop", out: { kind: "stop", session: session("8", "9"), cwd: PROJECT, reentry: false } },
    "stop-loop1.json": { event: "stop", out: { kind: "stop", session: session("8", "a"), cwd: PROJECT, reentry: true } },
    "pre-read-edit-probe.json": {
      event: "pre", out: {
        kind: "pre-read", session: session("1", "1"), callId: toolu(1), cwd: PROJECT, tool: "Read",
        paths: [`${PROJECT}/a.ts`], hint: "",
      },
    },
    "pre-task.json": { unregistered: MATCHER },
    "before-shell-execution.json": { unregistered: EVENT },
    "before-read-file.json": { unregistered: EVENT },
    "before-submit-prompt.json": { unregistered: EVENT },
    "after-file-edit-create.json": { unregistered: EVENT },
    "after-file-edit-strreplace.json": { unregistered: EVENT },
    "after-file-edit-applypatch-gpt.json": { unregistered: EVENT },
    "after-shell-execution.json": { unregistered: EVENT },
    "post-tool-use-write.json": { unregistered: EVENT },
    "post-tool-use-failure-read.json": { unregistered: EVENT },
    "post-tool-use-failure-denied.json": { unregistered: EVENT },
    "session-end.json": { unregistered: EVENT },
    "deny-matrix.observed.json": { unregistered: "not a payload: the tool results Cursor streamed for 19 hook behaviours" },
  });

  test("the harness environment changes nothing: no Cursor session is interactive", () => {
    const env = { grokEvent: "pre_tool_use", projectDir: "/elsewhere", remote: true };
    for (const [event, file] of [["pre", "pre-write-create.json"], ["pre", "pre-shell.json"], ["stop", "stop.json"]] as [HookKind, string][]) {
      expect(decode(event, raw(json(file)), env)).toEqual(decode(event, raw(json(file)), ENV));
    }
  });

  test("the envelope admits keys it does not read, and generation_id may be absent", () => {
    const { generation_id: _, ...p } = json("stop.json");
    expect(decode("stop", raw({ ...p, something_new: 1 }), ENV)).toEqual({ kind: "stop", session: { ...session("8", "9"), turnId: null }, cwd: PROJECT, reentry: false });
  });

  test("Stop and SessionStart with several workspace roots: the first", () => {
    const roots = { workspace_roots: [PROJECT, "/home/user/other"] };
    expect(decode("stop", raw({ ...json("stop.json"), ...roots }), ENV)).toMatchObject({ kind: "stop", cwd: PROJECT });
    expect(decode("session-start", raw({ ...json("session-start.json"), ...roots }), ENV)).toMatchObject({ kind: "session-start", cwd: PROJECT });
  });
});

describe("decode: Shell", () => {
  // The top-level cwd mirrors the tool's, as in the capture, unless a test sets it apart.
  const shell = (input: Record<string, unknown>, roots: unknown = [PROJECT], top: unknown = input.cwd ?? ""): HookEvent | Rejected | null => {
    const p = json("pre-shell.json");
    return decode("pre", raw({ ...p, cwd: top, workspace_roots: roots, tool_input: { ...(p.tool_input as object), ...input } }), ENV);
  };

  test("a top-level cwd that disagrees with the tool's: ambiguous; an absent one: the tool's", () => {
    expect(causeOf(shell({ cwd: "" }, [PROJECT], `${PROJECT}/src`))).toBe(BAD);
    expect(causeOf(shell({ cwd: `${PROJECT}/src` }, [PROJECT], ""))).toBe(BAD);
    const { cwd: _, ...p } = json("pre-shell.json");
    const absent = decode("pre", raw({ ...p, tool_input: { ...(p.tool_input as object), cwd: `${PROJECT}/src` } }), ENV);
    expect(absent).toMatchObject({ kind: "pre-command", command: { cwd: `${PROJECT}/src` } });
  });

  test("an absolute cwd is the cwd, whatever the workspace roots", () => {
    expect(shell({ cwd: "/home/user/project/src" }, [PROJECT, "/home/user/other"])).toMatchObject({ kind: "pre-command", command: { cwd: `${PROJECT}/src` } });
  });

  test.each([
    ["two workspace roots", [PROJECT, "/home/user/other"]], ["no workspace root", []], ["roots that are not an array", PROJECT],
    ["a relative root", ["project"]],
  ])('cwd "" with %s: ambiguous', (_, roots) => {
    expect(causeOf(shell({ cwd: "" }, roots))).toBe(BAD);
  });

  test.each(["project", "./src", `${PROJECT}/../etc`, `${PROJECT}/`, 7, null])("cwd %p", (cwd) => {
    expect(causeOf(shell({ cwd }))).toBe(BAD);
  });

  test("cwd and command are required", () => {
    const { cwd: _, ...rest } = json("pre-shell.json").tool_input as Record<string, unknown>;
    expect(causeOf(decode("pre", raw({ ...json("pre-shell.json"), tool_input: rest }), ENV))).toBe(BAD);
    expect(causeOf(shell({ command: ["echo", "hello"] }))).toBe(BAD);
  });

  test("an extra key does not change what runs: ignored", () => {
    expect(shell({ timeout: 1, sandbox: true, is_background: true })).toMatchObject({ kind: "pre-command", command: { command: "echo hello", cwd: PROJECT } });
  });
});

describe("decode: edits", () => {
  const change = (file: string, input: Record<string, unknown>): HookEvent | Rejected | null => {
    const p = json(file);
    return decode("pre", raw({ ...p, tool_input: { ...(p.tool_input as object), ...input } }), ENV);
  };
  const edit = (e: HookEvent | Rejected | null) => (e as Extract<HookEvent, { kind: "pre-edit" }>).changes[0]!;

  // A key Cursor does not send yet may change what gets written: judged by its path only (MH-13).
  test.each([
    ["pre-write-create.json", { encoding: "utf16" }, "Write"], ["pre-write-create.json", { content: null }, "Write"],
    ["pre-delete.json", { recursive: true }, "Delete"],
  ])("%s with %p: unknown, path kept", (file, input, tool) => {
    expect(edit(change(file, input))).toMatchObject({ path: (json(file).tool_input as { file_path: string }).file_path, edit: { form: "unknown", cause: tool } });
  });

  test("Write without content: unknown, path kept", () => {
    const p = json("pre-write-create.json");
    expect(edit(decode("pre", raw({ ...p, tool_input: { file_path: `${PROJECT}/a.ts` } }), ENV)).edit).toEqual({ form: "unknown", cause: "Write" });
  });

  test.each(["a.ts", `${PROJECT}/../etc/a.ts`, `${PROJECT}/./a.ts`, `${PROJECT}//a.ts`, `${PROJECT}/src/`, 1, undefined])("file_path %p", (path) => {
    expect(causeOf(change("pre-write-create.json", { file_path: path }))).toBe(BAD);
    expect(causeOf(change("pre-delete.json", { file_path: path }))).toBe(BAD);
  });

  // The matcher keeps unknown tools away; should one arrive anyway, nothing passes unjudged.
  test.each(["Task", "write", "MultiEdit", "MCP:write_file"])("tool_name %p is outside the exact set", (tool) => {
    expect(causeOf(decode("pre", raw({ ...json("pre-write-create.json"), tool_name: tool }), ENV))).toBe(BAD);
  });
  test("Read and Grep are read checks", () => {
    expect(decode("pre", raw({ ...json("pre-write-create.json"), tool_name: "Read" }), ENV)).toMatchObject({
      kind: "pre-read", tool: "Read", paths: [`${PROJECT}/a.ts`],
    });
    expect(decode("pre", raw({ ...json("pre-write-create.json"), tool_name: "Grep", tool_input: { pattern: "x", path: PROJECT } }), ENV)).toMatchObject({
      kind: "pre-read", tool: "Grep", paths: [PROJECT], hint: "x",
    });
  });
});

describe("decode: anything else is rejected as payload-unrecognized", () => {
  const without = (o: Record<string, unknown>, key: string): Record<string, unknown> => {
    const { [key]: _, ...rest } = o;
    return rest;
  };

  // Every envelope field the adapter reads, missing and with the wrong type.
  const ENVELOPE: [string, HookKind, string, unknown][] = [
    ["pre-write-create.json", "pre", "session_id", 7], ["pre-write-create.json", "pre", "hook_event_name", "PreToolUse"],
    ["pre-write-create.json", "pre", "tool_name", 1], ["pre-write-create.json", "pre", "tool_input", "{}"],
    ["pre-write-create.json", "pre", "tool_use_id", 3], ["pre-shell.json", "pre", "workspace_roots", {}],
    ["stop.json", "stop", "loop_count", "0"], ["stop.json", "stop", "workspace_roots", [null]],
    ["session-start.json", "session-start", "workspace_roots", ["~/project"]], ["session-start.json", "session-start", "session_id", []],
  ];
  for (const [file, event, key, wrong] of ENVELOPE) {
    test(`${file}: ${key} missing`, () => expect(causeOf(decode(event, raw(without(json(file), key)), ENV))).toBe(BAD));
    test(`${file}: ${key} = ${JSON.stringify(wrong)}`, () => expect(causeOf(decode(event, raw({ ...json(file), [key]: wrong }), ENV))).toBe(BAD));
  }

  test.each([-1, 0.5, true, null])("loop_count %p", (n) => expect(causeOf(decode("stop", raw({ ...json("stop.json"), loop_count: n }), ENV))).toBe(BAD));
  test("generation_id with the wrong type", () => expect(causeOf(decode("pre", raw({ ...json("pre-write-create.json"), generation_id: 1 }), ENV))).toBe(BAD));
  test("session-start with no workspace root", () => {
    expect(causeOf(decode("session-start", raw({ ...json("session-start.json"), workspace_roots: [] }), ENV))).toBe(BAD);
  });

  test.each([
    ["stop", "pre-write-create.json"], ["pre", "stop.json"], ["session-start", "stop.json"], ["pre", "session-start.json"],
  ] as [HookKind, string][])("hook %s receiving %s", (event, file) => expect(causeOf(decode(event, raw(json(file)), ENV))).toBe(BAD));

  test.each(["", "not json", "[]", "null", '{"hook_event_name":"preToolUse"'])("stdin %p", (text) => {
    expect(decode("pre", text, ENV)).toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: null, dirs: [] });
  });

  test("the refusal leaves through the event's channel, with every directory that locates the call", () => {
    const outside = { ...json("pre-write-create.json"), tool_name: "EditNotebook" };
    const target = { file_path: "/home/user/other/a.ts", cwd: "/home/user/other" };
    expect(decode("pre", raw({ ...outside, tool_input: target }), { ...ENV, projectDir: PROJECT })).toEqual({
      cause: BAD, kind: "pre-edit", reentry: false, session: session("1", "1"), dirs: ["/home/user/other", "/home/user/other/a.ts", PROJECT, PROJECT],
    });
    expect(decode("stop", raw({ ...json("stop-loop1.json"), workspace_roots: ["project"] }), ENV))
      .toEqual({ cause: BAD, kind: "stop", reentry: true, session: session("8", "a"), dirs: [] });
    expect(decode("session-start", raw({ ...json("session-start.json"), session_id: 1 }), ENV))
      .toEqual({ cause: BAD, kind: "session-start", reentry: false, session: null, dirs: [PROJECT] });
  });
});

// ── encode ────────────────────────────────────────────────────────────────────────

const GOLDEN = JSON.parse(readFileSync(`${import.meta.dir}/../presets/valid.lock.json`, "utf8")) as Lock;
// Enforced, with TDD-FOCUS-001 at `ask` as an override would set it.
const LOCK: Lock = { ...GOLDEN, enforcement: "enforce", rules: GOLDEN.rules.map((r) => ({ ...r, enforcement: "enforce", severity: r.id === "core/TDD-FOCUS-001" ? "ask" : r.severity })) };
const SEVERITY: Record<string, Severity> = { "core/CA-DEP-002": "warn", "core/TDD-FOCUS-001": "ask" };
const v = (rule: string): Violation => ({
  rule, path: "src/domain/invoice.ts", line: 4, symbol: "Invoice.total", measured: null, limit: null, atSessionStart: null, severity: SEVERITY[rule] ?? "deny",
});
// Adapter encoding consumes policy decisions; consent belongs to the gate integration tests.
function rejected(r: Rejected): Decision {
  return decide(input({ event: r.kind, form: { cause: r.cause, line: null },
    stop: r.kind === "stop" ? { blocks: 0, reentry: r.reentry, approved: [] } : null }));
}

const input = (change: Partial<DecideInput>): DecideInput => ({
  lock: LOCK, lockHash: "c".repeat(64), launcher: "/home/user/project/.pregate/bin/pregate", session: session("1", "1"), event: "pre-edit",
  path: "src/domain/invoice.ts", introduced: [], form: null, protectedPath: false, history: [], turnDenials: 0, astHash: null, stop: null, ...change,
});
const NEUTRAL: Emission = { stdout: "", stderr: "", exit: 0 };
const deny = (d: Decision): Emission => ({
  stdout: `${raw({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: d.full } })}\n`, stderr: "", exit: 0,
});
const unrecognized = (kind: HookEvent["kind"], reentry: boolean): Decision => rejected({ cause: BAD, kind, reentry, session: null, dirs: [] });
const emitted: Emission[] = [];
const enc = (kind: HookEvent["kind"], d: Decision): Emission => {
  const e = encode(kind, d);
  emitted.push(e);
  return e;
};

describe("encode", () => {
  test("no objection: neutral when empty, or additional_context for warnings and advisor findings", () => {
    expect(enc("pre-edit", decide(input({})))).toEqual(NEUTRAL);
    expect(enc("pre-command", decide(input({ event: "pre-command", path: null })))).toEqual(NEUTRAL);
    const warned = decide(input({ introduced: [v("core/CA-DEP-002")] }));
    expect(enc("pre-edit", warned)).toEqual({ stdout: `${raw({ additional_context: warned.full })}\n`, stderr: "", exit: 0 });
    const advisorLock: Lock = { ...LOCK, enforcement: "advisor", rules: LOCK.rules.map((r) => ({ ...r, enforcement: r.integrity ? "enforce" : "advisor" })) };
    const advised = decide(input({ lock: advisorLock, introduced: [v("core/FCIS-IO-001")] }));
    expect(advised.verdict).toBe("none");
    expect(advised.full).toContain("PREGATE ADVISOR");
    expect(enc("pre-edit", advised)).toEqual({ stdout: `${raw({ additional_context: advised.full })}\n`, stderr: "", exit: 0 });
  });

  test("deny: Claude Code's deny JSON at exit 0, for edits and commands", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001")] }));
    expect(d.verdict).toBe("deny");
    expect(enc("pre-edit", d)).toEqual(deny(d));
    expect(enc("pre-command", d)).toEqual(deny(d));
  });

  test("halt does not exist in Cursor: the same deny, no halt keys", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001")], turnDenials: LOCK.loop.maxDenialsPerTurn }));
    expect(d.halt).toBe(true);
    expect(enc("pre-edit", d)).toEqual(deny(d));
  });

  test("a Cursor session never gets an ask from the policy, and an ask handed over leaves as a deny", () => {
    const policy = decide(input({ introduced: [v("core/TDD-FOCUS-001")] }));
    expect(policy).toMatchObject({ verdict: "deny", halt: true });
    const ask = decide(input({ introduced: [v("core/TDD-FOCUS-001")], session: { ...session("1", "1"), interactive: true } }));
    expect(ask.verdict).toBe("ask");
    expect(enc("pre-edit", ask)).toEqual(deny(ask));
  });

  test("Stop block: followup_message alone, exit 0", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001")], stop: { blocks: 0, reentry: false, approved: [] } }));
    expect(enc("stop", d)).toEqual({ stdout: `${raw({ followup_message: d.full })}\n`, stderr: "", exit: 0 });
  });

  test("Stop past its cap: neutral, the notice has no channel", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001")], stop: { blocks: LOCK.loop.maxStopBlocks, reentry: true, approved: [] } }));
    expect(d.notice).not.toBeNull();
    expect(enc("stop", d)).toEqual(NEUTRAL);
  });

  test("SessionStart: native context channel", () => {
    expect(enc("session-start", { ...decide(input({})), full: "PREGATE is active: …", notice: null })).toEqual({
      stdout: raw({ additional_context: "PREGATE is active: …" }) + "\n", stderr: "", exit: 0,
    });
    expect(enc("session-start", unrecognized("session-start", false))).toEqual(NEUTRAL);
  });

  test("an unrecognized payload denies through the event's channel; a Stop reentry by loop_count lets the turn end", () => {
    const pre = unrecognized("pre-edit", false);
    expect(enc("pre-edit", pre)).toEqual(deny(pre));
    expect(pre.full).toContain(BAD);
    expect(enc("stop", unrecognized("stop", false)).stdout).toContain("followup_message");
    const again = decode("stop", raw({ ...json("stop-loop1.json"), workspace_roots: [] }), ENV) as Rejected;
    expect(enc("stop", rejected(again))).toEqual(NEUTRAL);
  });

  // Runs last: every emission of this file.
  test('the string "allow" never leaves, nor a halt key, and exit is always 0', () => {
    expect(emitted.length).toBeGreaterThan(10);
    for (const e of emitted) {
      expect(e.stdout).not.toContain('"allow"');
      expect(e.stdout).not.toContain('"continue"');
      expect(e.exit).toBe(0);
    }
  });
});
