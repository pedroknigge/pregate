import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decide } from "../../src/decide.ts";
import { decode, encode } from "../../src/harness/agy.ts";
import { profile } from "../../src/harness/profile.ts";
import type { Decision, DecideInput, Emission, HookEvent, HookKind, Lock, Rejected, Session, Violation } from "../../src/types.ts";
import { contract, ENV } from "./contract.ts";

// The Antigravity CLI contract (MULTI-HARNESS MH-05, MH-11, MH-14): real payloads captured from agy
// 1.2.14 and 1.5.3 in test/payloads/agy, decoded to exact events; decisions from the real policy, encoded to
// exact output.

const DIR = `${import.meta.dir}/../payloads/agy`;
const PROJECT = "/home/user/project";
const BAD = "payload-unrecognized";
const json = (name: string): Record<string, unknown> => JSON.parse(readFileSync(`${DIR}/${name}`, "utf8")) as Record<string, unknown>;
const raw = (o: unknown): string => JSON.stringify(o);
const conversation = (n: number): Session => ({ id: `00000000-0000-4000-8000-00000000000${n}`, harness: "agy", agentId: null, turnId: null, interactive: false });
const causeOf = (e: HookEvent | Rejected | null): string | null => (e !== null && "cause" in e ? e.cause : null);
const editOf = (e: HookEvent | Rejected | null) => (e as Extract<HookEvent, { kind: "pre-edit" }>).changes[0]!.edit;
const NOT_REGISTERED = "not registered: PostToolUse cannot block (MH-25)";
const OUTSIDE = "outside the PreToolUse matcher (MH-22): it neither writes nor runs anything";

describe("decode: captured payloads", () => {
  test("SessionStart accepts native payloads without invocationNum; PreInvocation ignores later calls and rejects invalid counters", () => {
    const native = json("session-start.json");
    expect(decode("session-start", raw(native), ENV)).toEqual({ kind: "session-start", session: conversation(7), cwd: PROJECT });
    expect(decode("session-start", raw({ ...native, invocationNum: 0 }), ENV)).toMatchObject({ cause: BAD });
    const first = json("pre-invocation.json");
    expect(decode("session-start", raw({ ...first, invocationNum: 1 }), ENV)).toBeNull();
    for (const invocationNum of [undefined, -1, 0.5, "0"]) {
      expect(decode("session-start", raw({ ...first, invocationNum }), ENV)).toMatchObject({ cause: BAD });
    }
  });
  contract("agy", DIR, {
    "pre-write_to_file.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: conversation(1), callId: "4", tool: "write_to_file", path: `${PROJECT}/hello.txt`, edit: { form: "full", content: "hi\n" }, from: null,
        }],
      },
    },
    "pre-write_to_file-append.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: conversation(3), callId: "2", tool: "write_to_file", path: `${PROJECT}/notes.txt`, edit: { form: "append", text: "line four\n" }, from: null,
        }],
      },
    },
    // A subagent is its own conversation, with no link to its parent's.
    "pre-write_to_file-subagent.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: conversation(6), callId: "2", tool: "write_to_file", path: `${PROJECT}/sub.txt`, edit: { form: "full", content: "hi" }, from: null,
        }],
      },
    },
    "pre-replace_file_content.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: conversation(1), callId: "6", tool: "replace_file_content", path: `${PROJECT}/notes.txt`,
          edit: { form: "oldnew", old: "line two", neu: "line 2", all: false, lines: [2, 2] }, from: null,
        }],
      },
    },
    "pre-replace_file_content-multiline.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: conversation(2), callId: "6", tool: "replace_file_content", path: `${PROJECT}/multi.txt`,
          edit: { form: "oldnew", old: "beta\ngamma\ndelta", neu: "BETA\ngamma\nDELTA", all: false, lines: [2, 4] }, from: null,
        }],
      },
    },
    "pre-run_command.json": {
      event: "pre",
      out: { kind: "pre-command", command: { session: conversation(1), callId: "8", tool: "run_command", command: "echo done", cwd: PROJECT } },
    },
    "stop.json": { event: "stop", out: { kind: "stop", session: conversation(1), cwd: PROJECT, reentry: false } },
    "stop-reentry.json": { event: "stop", out: { kind: "stop", session: conversation(4), cwd: PROJECT, reentry: true } },
    // The parent stops while its subagent still works: still a Stop of its own (§7 residue).
    "stop-parent-not-idle.json": { event: "stop", out: { kind: "stop", session: conversation(5), cwd: PROJECT, reentry: false } },
    "pre-invocation.json": { event: "session-start", out: { kind: "session-start", session: conversation(1), cwd: PROJECT } },
    "post-invocation.json": { event: "post-invocation", out: { kind: "post-invocation", session: conversation(1), cwd: PROJECT } },
    "post-write_to_file.json": { unregistered: NOT_REGISTERED },
    "post-run_command.json": { unregistered: NOT_REGISTERED },
    "pre-view_file.json": { unregistered: OUTSIDE },
    // agy 1.5.3+: the edit tools are write_file and edit_file with Path, and the envelope has a cwd and hookEventName.
    "pre-write_file.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: conversation(7), callId: "2", tool: "write_file", path: `${PROJECT}/src/x.ts`, edit: { form: "full", content: "export const one = 1;" }, from: null,
        }],
      },
    },
    "pre-write_file-append.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: conversation(7), callId: "2", tool: "write_file", path: `${PROJECT}/notes.txt`, edit: { form: "append", text: "line five\n" }, from: null,
        }],
      },
    },
    "pre-edit_file.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: conversation(8), callId: "4", tool: "edit_file", path: `${PROJECT}/src/sum.ts`,
          edit: { form: "oldnew", old: "  return a + b;", neu: "  return b + a;", all: false, lines: [1, Number.MAX_SAFE_INTEGER] }, from: null,
        }],
      },
    },
    "pre-run_command-top-cwd.json": {
      event: "pre",
      out: { kind: "pre-command", command: { session: conversation(9), callId: "2", tool: "run_command", command: "ls src", cwd: PROJECT } },
    },
    "pre-manage_task-send_input.json": {
      event: "pre",
      out: { cause: "shell-write", kind: "pre-edit", reentry: false, session: conversation(7), dirs: [PROJECT, PROJECT] },
    },
    "pre-manage_task-status.json": { event: "pre", out: null },
    "session-start.json": { event: "session-start", out: { kind: "session-start", session: conversation(7), cwd: PROJECT } },
    "post-invocation-top-cwd.json": { event: "post-invocation", out: { kind: "post-invocation", session: conversation(7), cwd: PROJECT } },
    "stop-top-cwd.json": { event: "stop", out: { kind: "stop", session: conversation(7), cwd: PROJECT, reentry: false } },
    "stop-user-canceled.json": { event: "stop", out: null },
    "stop-continuation-active.json": { event: "stop", out: { kind: "stop", session: conversation(7), cwd: PROJECT, reentry: true } },
    "post-write_file.json": { unregistered: NOT_REGISTERED },
    "pre-read_file.json": { unregistered: OUTSIDE },
    "pre-invoke_subagent.json": { unregistered: OUTSIDE },
    "pre-send_message-subagent.json": { unregistered: OUTSIDE },
  });

  // agy inherits its parent's environment (a Claude Code or Grok session that launched it) [V].
  test("an inherited environment changes neither the profile nor the event", () => {
    const env = { grokEvent: "pre_tool_use", projectDir: "/home/user/elsewhere", remote: true };
    for (const file of ["pre-write_to_file.json", "pre-run_command.json", "pre-write_file.json"]) {
      const text = raw(json(file));
      expect(profile("agy", text, env)).toBe("agy");
      expect(decode("pre", text, env)).toEqual(decode("pre", text, ENV));
    }
  });

  test("the envelope admits keys it does not read", () => {
    expect(decode("stop", raw({ ...json("stop.json"), somethingNew: 1 }), ENV)).toMatchObject({ kind: "stop" });
    expect(decode("pre", raw({ ...json("pre-write_to_file.json"), somethingNew: 1 }), ENV)).toMatchObject({ kind: "pre-edit" });
  });

  test("a Stop, SessionStart, or PostInvocation falls back to envelope cwd when workspacePaths is empty", () => {
    const p = { ...json("stop.json"), workspacePaths: [PROJECT, "/home/user/other"] };
    expect(decode("stop", raw(p), ENV)).toMatchObject({ kind: "stop", cwd: PROJECT });
    expect(decode("stop", raw({ ...json("stop-top-cwd.json"), workspacePaths: [] }), ENV)).toMatchObject({ kind: "stop", cwd: PROJECT });
    expect(decode("session-start", raw({ ...json("session-start.json"), workspacePaths: [] }), ENV)).toMatchObject({ kind: "session-start", cwd: PROJECT });
    expect(decode("post-invocation", raw({ ...json("post-invocation-top-cwd.json"), workspacePaths: [] }), ENV)).toMatchObject({ kind: "post-invocation", cwd: PROJECT });
  });

  test("Stop ignores USER_CANCELED and TERMINAL_CUSTOM_HOOK, and honors continuationActive", () => {
    const stop = json("stop-top-cwd.json");
    expect(decode("stop", raw({ ...stop, terminationReason: "TERMINAL_CUSTOM_HOOK" }), ENV)).toBeNull();
    expect(decode("stop", raw({ ...stop, executionNum: 0, continuationActive: true }), ENV)).toMatchObject({ kind: "stop", reentry: true });
    expect(decode("stop", raw({ ...stop, executionNum: 2, continuationActive: false }), ENV)).toMatchObject({ kind: "stop", reentry: false });
    expect(causeOf(decode("stop", raw({ ...stop, continuationActive: "yes" }), ENV))).toBe(BAD);
  });
});

// ── the edit tools (MH-11) ───────────────────────────────────────────────────────

const args = (file: string, change: Record<string, unknown>, drop: string[] = []): string => {
  const p = json(file);
  const call = p.toolCall as { name: string; args: Record<string, unknown> };
  const a: Record<string, unknown> = { ...call.args, ...change };
  for (const k of drop) delete a[k];
  return raw({ ...p, toolCall: { ...call, args: a } });
};
const named = (file: string, name: string): string => {
  const p = json(file);
  return raw({ ...p, toolCall: { ...(p.toolCall as object), name } });
};
const WRITE = "pre-write_to_file.json";
const APPEND = "pre-write_to_file-append.json";
const REPLACE = "pre-replace_file_content.json";
const RUN = "pre-run_command.json";

describe("decode: edits", () => {
  test("the metadata agy shows the user is accepted on both tools", () => {
    const notes = { Instruction: "x", TargetLintErrorIds: ["1"], ArtifactMetadata: { Summary: "s" } };
    expect(editOf(decode("pre", args(WRITE, notes), ENV))).toEqual({ form: "full", content: "hi\n" });
    expect(editOf(decode("pre", args(REPLACE, notes), ENV))).toMatchObject({ form: "oldnew" });
  });

  test("an argument outside the closed set: the edit cannot be rebuilt", () => {
    expect(editOf(decode("pre", args(WRITE, { Encoding: "utf16" }), ENV))).toEqual({ form: "unknown", cause: "write_to_file" });
    expect(editOf(decode("pre", args(REPLACE, { Overwrite: true }), ENV))).toEqual({ form: "unknown", cause: "replace_file_content" });
    expect(editOf(decode("pre", args(REPLACE, { ReplacementChunks: [] }), ENV))).toEqual({ form: "unknown", cause: "replace_file_content" });
  });

  test("Append without Overwrite appends; with Overwrite it is unknown which one agy honors", () => {
    expect(editOf(decode("pre", args(APPEND, {}, ["Overwrite"]), ENV))).toEqual({ form: "append", text: "line four\n" });
    expect(editOf(decode("pre", args(APPEND, { Overwrite: true }), ENV))).toEqual({ form: "unknown", cause: "write_to_file" });
    expect(editOf(decode("pre", args(APPEND, { Append: false }), ENV))).toEqual({ form: "full", content: "line four\n" });
  });

  test("Overwrite:false alone still writes the whole content", () => {
    expect(editOf(decode("pre", args(WRITE, { Overwrite: false }), ENV))).toEqual({ form: "full", content: "hi\n" });
  });

  test("AllowMultiple replaces every occurrence", () => {
    expect(editOf(decode("pre", args(REPLACE, { AllowMultiple: true }), ENV))).toMatchObject({ all: true });
    expect(editOf(decode("pre", args(REPLACE, {}, ["AllowMultiple"]), ENV))).toMatchObject({ all: false });
  });

  test("without a range the search covers the whole file", () => {
    expect(editOf(decode("pre", args(REPLACE, {}, ["StartLine", "EndLine"]), ENV))).toMatchObject({ form: "oldnew", lines: null });
  });

  test.each([
    ["only StartLine", {}, ["EndLine"]], ["only EndLine", {}, ["StartLine"]], ["StartLine 0", { StartLine: 0 }, []],
    ["reversed", { StartLine: 3, EndLine: 2 }, []], ["a string", { StartLine: "2" }, []], ["a fraction", { EndLine: 2.5 }, []],
    ["negative", { StartLine: -1, EndLine: -1 }, []],
  ] as [string, Record<string, unknown>, string[]][])("a range that is not one (%s): the edit cannot be rebuilt", (_, change, drop) => {
    expect(editOf(decode("pre", args(REPLACE, change, drop), ENV))).toEqual({ form: "unknown", cause: "replace_file_content" });
  });

  test("multi_replace_file_content: no captured shape, but its path is still checked", () => {
    const p = JSON.parse(args(REPLACE, { ReplacementChunks: [] }, ["TargetContent", "ReplacementContent"])) as Record<string, { args: unknown }>;
    const e = decode("pre", raw({ ...p, toolCall: { name: "multi_replace_file_content", args: p.toolCall!.args } }), ENV);
    expect(e).toMatchObject({ kind: "pre-edit", changes: [{ path: `${PROJECT}/notes.txt`, tool: "multi_replace_file_content", edit: { form: "unknown" } }] });
  });

  test("CRLF and an empty target reach the core verbatim (reconstruct decides)", () => {
    expect(editOf(decode("pre", args(REPLACE, { TargetContent: "a\r\nb", ReplacementContent: "" }), ENV)))
      .toEqual({ form: "oldnew", old: "a\r\nb", neu: "", all: false, lines: [2, 2] });
    expect(editOf(decode("pre", args(REPLACE, { TargetContent: "" }), ENV))).toMatchObject({ old: "" });
  });

  // A wrong type is a changed contract, not a request to resend.
  const WRONG: [string, string, unknown][] = [
    [WRITE, "TargetFile", 1], [WRITE, "CodeContent", null], [WRITE, "Append", "true"], [WRITE, "Overwrite", 1],
    [REPLACE, "TargetFile", null], [REPLACE, "TargetContent", 2], [REPLACE, "ReplacementContent", []], [REPLACE, "AllowMultiple", "no"],
  ];
  for (const [file, key, wrong] of WRONG) {
    test(`${file}: ${key} = ${JSON.stringify(wrong)}`, () => expect(causeOf(decode("pre", args(file, { [key]: wrong }), ENV))).toBe(BAD));
  }
  for (const [file, key] of [[WRITE, "TargetFile"], [WRITE, "CodeContent"], [REPLACE, "TargetFile"], [REPLACE, "TargetContent"], [REPLACE, "ReplacementContent"]]) {
    test(`${file}: ${key} missing`, () => expect(causeOf(decode("pre", args(file!, {}, [key!]), ENV))).toBe(BAD));
  }

  test.each([
    "hello.txt", "./hello.txt", `${PROJECT}/../etc/a.ts`, `${PROJECT}/./a.ts`, `${PROJECT}//a.ts`, `${PROJECT}/src/`, "C:project\\a.ts",
  ])("TargetFile %p is not absolute and normalized", (path) => {
    expect(causeOf(decode("pre", args(WRITE, { TargetFile: path }), ENV))).toBe(BAD);
  });
});

// ── commands (MH-11, MH-06) ──────────────────────────────────────────────────────

describe("decode: the 1.5.3+ edit and task tools", () => {
  const write = json("pre-write_file.json") as { toolCall: { name: string; args: Record<string, unknown> } };
  const edit = json("pre-edit_file.json") as { toolCall: { name: string; args: Record<string, unknown> } };
  const withArgs = (base: typeof write, args: Record<string, unknown>, name = base.toolCall.name) => raw({ ...base, toolCall: { ...base.toolCall, name, args } });

  test("write_file writes the whole content, appends without Overwrite, and marks Append+Overwrite unknown", () => {
    const { Overwrite: _, ...rest } = write.toolCall.args;
    expect(editOf(decode("pre", withArgs(write, rest), ENV))).toEqual({ form: "full", content: "export const one = 1;" });
    expect(editOf(decode("pre", withArgs(write, { ...rest, Overwrite: false }), ENV))).toEqual({ form: "full", content: "export const one = 1;" });
    expect(editOf(decode("pre", withArgs(write, { ...rest, Append: true }), ENV))).toEqual({ form: "append", text: "export const one = 1;" });
    expect(editOf(decode("pre", withArgs(write, { ...rest, Append: true, Overwrite: false }), ENV))).toEqual({ form: "append", text: "export const one = 1;" });
    expect(editOf(decode("pre", withArgs(write, { ...rest, Append: false }), ENV))).toEqual({ form: "full", content: "export const one = 1;" });
    expect(editOf(decode("pre", withArgs(write, { ...write.toolCall.args, Append: true }), ENV))).toEqual({ form: "unknown", cause: "write_file" });
  });
  test("an argument outside the closed set, on either tool: the edit cannot be rebuilt", () => {
    expect(editOf(decode("pre", withArgs(write, { ...write.toolCall.args, Encoding: "utf8" }), ENV))).toEqual({ form: "unknown", cause: "write_file" });
    expect(editOf(decode("pre", withArgs(edit, { ...edit.toolCall.args, AllowMultiple: true }), ENV))).toEqual({ form: "unknown", cause: "edit_file" });
  });
  test("a wrong type is a changed contract", () => {
    expect(causeOf(decode("pre", withArgs(write, { ...write.toolCall.args, Content: 1 }), ENV))).toBe(BAD);
    expect(causeOf(decode("pre", withArgs(write, { ...write.toolCall.args, Append: "true" }), ENV))).toBe(BAD);
    expect(causeOf(decode("pre", withArgs(edit, { ...edit.toolCall.args, Target: null }), ENV))).toBe(BAD);
    expect(causeOf(decode("pre", withArgs(write, { ...write.toolCall.args, Path: "src/x.ts" }), ENV))).toBe(BAD);
  });
  test("manage_task refuses send_input as shell-write, ignores list/status/kill, and rejects unknown actions", () => {
    expect(decode("pre", withArgs(write, { Action: "send_input", TaskId: "t1", Input: "y\n" }, "manage_task"), ENV)).toEqual({
      cause: "shell-write", kind: "pre-edit", reentry: false, session: conversation(7), dirs: [PROJECT, PROJECT],
    });
    for (const Action of ["list", "status", "kill"]) {
      expect(decode("pre", withArgs(write, { Action, TaskId: "t1" }, "manage_task"), ENV)).toBeNull();
    }
    expect(causeOf(decode("pre", withArgs(write, { Action: "exec" }, "manage_task"), ENV))).toBe(BAD);
    expect(causeOf(decode("pre", withArgs(write, {}, "manage_task"), ENV))).toBe(BAD);
  });
  test("a write tool with no captured shape is unknown at its path, and refused without one", () => {
    for (const name of ["create_file", "delete_file", "rename_file", "notebook_edit"]) {
      expect(editOf(decode("pre", withArgs(write, { Path: `${PROJECT}/src/x.ts` }, name), ENV))).toEqual({ form: "unknown", cause: name });
      expect(causeOf(decode("pre", withArgs(write, { Source: "a" }, name), ENV))).toBe(BAD);
    }
  });
  test("a refused 1.5.3 call names the directory of its Path and the envelope's cwd", () => {
    const refused = decode("pre", raw({ ...write, cwd: "/elsewhere", toolCall: { ...write.toolCall, args: { ...write.toolCall.args, Content: 1 } } }), ENV) as Rejected;
    expect(refused.dirs).toEqual([PROJECT, "/elsewhere", `${PROJECT}/src`]);
  });
  test("run_command without a Cwd runs in the envelope's cwd, also with several workspaces", () => {
    const command = json("pre-run_command-top-cwd.json");
    const decoded = decode("pre", raw({ ...command, cwd: `${PROJECT}/pkg`, workspacePaths: [PROJECT, "/other"] }), ENV);
    expect(decoded).toMatchObject({ kind: "pre-command", command: { cwd: `${PROJECT}/pkg`, command: "ls src" } });
  });
});

describe("decode: commands", () => {
  const command = (e: HookEvent | Rejected | null) => (e as Extract<HookEvent, { kind: "pre-command" }>).command;

  test("an extra argument does not change what runs: ignored", () => {
    expect(command(decode("pre", args(RUN, { WaitMsBeforeAsync: 0, SafeToAutoRun: true }), ENV))).toMatchObject({ command: "echo done", cwd: PROJECT });
  });

  test("without a Cwd, the only workspace", () => {
    expect(command(decode("pre", args(RUN, {}, ["Cwd"]), ENV)).cwd).toBe(PROJECT);
    expect(command(decode("pre", args(RUN, { Cwd: "" }), ENV)).cwd).toBe(PROJECT);
  });

  test("a Cwd wins over the workspace", () => {
    expect(command(decode("pre", args(RUN, { Cwd: "/tmp" }), ENV)).cwd).toBe("/tmp");
  });

  test("without a Cwd and no workspace, or several: the directory is ambiguous", () => {
    const none = { ...JSON.parse(args(RUN, {}, ["Cwd"])), workspacePaths: [] };
    expect(decode("pre", raw(none), ENV)).toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: conversation(1), dirs: [] });
    const two = { ...JSON.parse(args(RUN, {}, ["Cwd"])), workspacePaths: [PROJECT, "/home/user/other"] };
    expect(decode("pre", raw(two), ENV)).toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: conversation(1), dirs: [PROJECT, "/home/user/other"] });
  });

  test.each([["relative", "project"], ["not normalized", `${PROJECT}/../x`], ["a number", 1]])("a Cwd that is %s", (_, cwd) => {
    expect(causeOf(decode("pre", args(RUN, { Cwd: cwd }), ENV))).toBe(BAD);
  });

  test.each([["missing", undefined], ["not a string", ["echo"]]])("CommandLine %s", (_, line) => {
    expect(causeOf(decode("pre", args(RUN, { CommandLine: line }, line === undefined ? ["CommandLine"] : []), ENV))).toBe(BAD);
  });

  test("send_command_input: input to a running process cannot be checked (shell-write)", () => {
    const p = { ...json(RUN), toolCall: { name: "send_command_input", args: { CommandId: "c1", Input: "y\n" } } };
    expect(decode("pre", raw(p), ENV)).toEqual({ cause: "shell-write", kind: "pre-edit", reentry: false, session: conversation(1), dirs: [PROJECT] });
  });
});

// ── what the adapter cannot read ─────────────────────────────────────────────────

describe("decode: anything else is rejected as payload-unrecognized", () => {
  const without = (o: Record<string, unknown>, key: string): Record<string, unknown> => {
    const { [key]: _, ...rest } = o;
    return rest;
  };
  const ENVELOPE: [string, HookKind, string, unknown][] = [
    [WRITE, "pre", "conversationId", 7], [WRITE, "pre", "workspacePaths", PROJECT], [WRITE, "pre", "stepIdx", "4"],
    [WRITE, "pre", "toolCall", "write_to_file"], ["stop.json", "stop", "executionNum", "0"], ["stop.json", "stop", "conversationId", null],
    ["stop.json", "stop", "workspacePaths", [1]],
  ];
  for (const [file, event, key, wrong] of ENVELOPE) {
    test(`${file}: ${key} missing`, () => expect(causeOf(decode(event, raw(without(json(file), key)), ENV))).toBe(BAD));
    test(`${file}: ${key} = ${JSON.stringify(wrong)}`, () => expect(causeOf(decode(event, raw({ ...json(file), [key]: wrong }), ENV))).toBe(BAD));
  }

  test.each([-1, 1.5])("a step or execution count of %p", (n) => {
    expect(causeOf(decode("pre", raw({ ...json(WRITE), stepIdx: n }), ENV))).toBe(BAD);
    expect(causeOf(decode("stop", raw({ ...json("stop.json"), executionNum: n }), ENV))).toBe(BAD);
  });

  test("toolCall without a name or args", () => {
    for (const call of [{ args: {} }, { name: "write_to_file" }, { name: 1, args: {} }, { name: "write_to_file", args: [] }]) {
      expect(causeOf(decode("pre", raw({ ...json(WRITE), toolCall: call }), ENV))).toBe(BAD);
    }
  });

  test("a Stop without a workspace has no directory", () => {
    expect(causeOf(decode("stop", raw({ ...json("stop.json"), workspacePaths: [] }), ENV))).toBe(BAD);
    expect(causeOf(decode("stop", raw({ ...json("stop.json"), workspacePaths: ["project"] }), ENV))).toBe(BAD);
  });

  test.each(["view_file", "invoke_subagent", "send_message", "generate_image", "Write", "write_file"])("tool %p is outside the exact set", (tool) => {
    expect(causeOf(decode("pre", named(WRITE, tool), ENV))).toBe(BAD);
  });

  test.each([
    ["stop", WRITE], ["pre", "stop.json"], ["pre", "pre-invocation.json"], ["session-start", "stop.json"], ["session-start", WRITE],
    ["pre", "post-invocation-top-cwd.json"], ["post-invocation", "pre-write_file.json"], ["post-invocation", "session-start.json"],
    ["session-start", "post-invocation-top-cwd.json"],
  ] as [HookKind, string][])("hook %s receiving %s", (event, file) => expect(causeOf(decode(event, raw(json(file)), ENV))).toBe(BAD));

  test("mismatched or non-string hookEventName is rejected", () => {
    expect(causeOf(decode("pre", raw({ ...json("pre-write_file.json"), hookEventName: "PostToolUse" }), ENV))).toBe(BAD);
    expect(causeOf(decode("pre", raw({ ...json("pre-write_file.json"), hookEventName: 1 }), ENV))).toBe(BAD);
    expect(causeOf(decode("post-invocation", raw({ ...json("post-invocation-top-cwd.json"), invocationNum: -1 }), ENV))).toBe(BAD);
  });

  test.each(["", "not json", "[]", "null", "42", '{"conversationId":"x"'])("stdin %p", (text) => {
    expect(causeOf(decode("pre", text, ENV))).toBe(BAD);
  });

  test("the refusal leaves through the event's channel, with every directory the call names", () => {
    expect(decode("stop", "garbage", ENV)).toEqual({ cause: BAD, kind: "stop", reentry: false, session: null, dirs: [] });
    const again = raw({ ...json("stop-reentry.json"), workspacePaths: ["project"] });
    expect(decode("stop", again, ENV)).toEqual({ cause: BAD, kind: "stop", reentry: true, session: conversation(4), dirs: [] });
    // The file's own directory: a refused write inside a root is denied even from a workspace without one.
    const write = { ...JSON.parse(args(WRITE, { TargetFile: "/repo/src/a.ts", CodeContent: 1 })), workspacePaths: ["/home/user"] };
    expect(decode("pre", raw(write), ENV)).toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: conversation(1), dirs: ["/home/user", "/repo/src"] });
    const run = { ...JSON.parse(args(RUN, { Cwd: "/repo", CommandLine: 1 })), conversationId: 1 };
    expect(decode("pre", raw(run), ENV)).toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: null, dirs: [PROJECT, "/repo"] });
  });
});

// ── encode (MH-14) ───────────────────────────────────────────────────────────────

const GOLDEN_LOCK = JSON.parse(readFileSync(`${import.meta.dir}/../presets/valid.lock.json`, "utf8")) as Lock;
const LOCK: Lock = {
  ...GOLDEN_LOCK, enforcement: "enforce",
  rules: GOLDEN_LOCK.rules.map((r) => ({ ...r, enforcement: "enforce", severity: r.id === "core/TDD-FOCUS-001" ? "ask" : r.severity })),
};
const v = (rule: string, line: number): Violation => ({
  rule, path: "src/domain/invoice.ts", line, symbol: "Invoice.total", measured: null, limit: null, atSessionStart: null,
  severity: rule === "core/CA-DEP-002" ? "warn" : rule === "core/TDD-FOCUS-001" ? "ask" : "deny",
});
// Adapter encoding consumes policy decisions; consent belongs to the gate integration tests.
function rejected(r: Rejected): Decision {
  return decide(input({ event: r.kind, form: { cause: r.cause, line: null },
    stop: r.kind === "stop" ? { blocks: 0, reentry: r.reentry, approved: [] } : null }));
}

const input = (change: Partial<DecideInput>): DecideInput => ({
  lock: LOCK, lockHash: "c".repeat(64), launcher: "/home/user/project/.pregate/bin/pregate",
  session: conversation(1), event: "pre-edit", path: "src/domain/invoice.ts", introduced: [], form: null, protectedPath: false,
  history: [], turnDenials: 0, astHash: null, stop: null, ...change,
});
const NEUTRAL: Emission = { stdout: "", stderr: "", exit: 0 };
const emitted: Emission[] = [];
const enc = (kind: HookEvent["kind"], d: Decision): Emission => {
  const e = encode(kind, d);
  emitted.push(e);
  return e;
};
const deny = (reason: string): Emission => ({ stdout: `${raw({ decision: "deny", reason })}\n`, stderr: "", exit: 0 });

describe("encode", () => {
  test("no objection: nothing on stdout, so agy's own permissions decide", () => {
    expect(enc("pre-edit", decide(input({})))).toEqual(NEUTRAL);
    expect(enc("pre-command", decide(input({ event: "pre-command", path: null })))).toEqual(NEUTRAL);
    expect(enc("stop", decide(input({ event: "stop", stop: { blocks: 0, reentry: false, approved: [] } })))).toEqual(NEUTRAL);
  });

  test("an introduced warn has no channel: nothing on stdout", () => {
    const d = decide(input({ introduced: [v("core/CA-DEP-002", 3)] }));
    expect(d.verdict).toBe("none");
    expect(enc("pre-edit", d)).toEqual(NEUTRAL);
  });

  test("deny: the full text as the reason, exit 0", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4), v("core/EVA-CAST-001", 9)] }));
    expect(enc("pre-edit", d)).toEqual(deny(d.full));
    expect(enc("pre-command", d)).toEqual(deny(d.full));
  });

  test("deny + halt: no halt key exists, the text tells the agent to stop", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4)], turnDenials: LOCK.loop.maxDenialsPerTurn }));
    expect(d.halt).toBe(true);
    expect(enc("pre-edit", d)).toEqual(deny(d.full));
  });

  test("ask: nobody can answer it, so the policy denies, and a forged ask still leaves as a deny", () => {
    const d = decide(input({ introduced: [v("core/TDD-FOCUS-001", 12)] }));
    expect(d.verdict).toBe("deny");
    expect(enc("pre-edit", d)).toEqual(deny(d.full));
    expect(enc("pre-edit", { ...d, verdict: "ask" })).toEqual(deny(d.full));
  });

  test("Stop block: continue reopens the agent loop with the reason", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop: { blocks: 0, reentry: false, approved: [] } }));
    expect(enc("stop", d)).toEqual({ stdout: `${raw({ decision: "continue", reason: d.full })}\n`, stderr: "", exit: 0 });
  });

  test("Stop past its cap lets the turn end", () => {
    const stop = { blocks: LOCK.loop.maxStopBlocks, reentry: true, approved: [] };
    expect(enc("stop", decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop })))).toEqual(NEUTRAL);
  });

  test("SessionStart context uses systemMessage; a rejection stays neutral", () => {
    expect(enc("session-start", { ...decide(input({})), full: "PREGATE is active: …" })).toEqual({
      stdout: raw({ injectSteps: [{ systemMessage: { systemMessage: "PREGATE is active: …" } }] }) + "\n", stderr: "", exit: 0,
    });
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4)] }));
    expect(enc("session-start", d)).toEqual(NEUTRAL);
  });

  test("PostInvocation injects warnings as systemMessage and terminates halted turns with errorMessage", () => {
    expect(enc("post-invocation", decide(input({})))).toEqual(NEUTRAL);
    const warn = decide(input({ introduced: [v("core/CA-DEP-002", 3)] }));
    expect(warn.verdict).toBe("none");
    expect(enc("post-invocation", warn)).toEqual({
      stdout: raw({ injectSteps: [{ systemMessage: { systemMessage: warn.full } }] }) + "\n", stderr: "", exit: 0,
    });
    const halt = decide(input({ introduced: [v("core/FCIS-IO-001", 4)], turnDenials: LOCK.loop.maxDenialsPerTurn }));
    expect(halt.halt).toBe(true);
    expect(enc("post-invocation", halt)).toEqual({
      stdout: raw({ injectSteps: [{ errorMessage: { userMessage: halt.notice } }], terminationBehavior: "terminate" }) + "\n", stderr: "", exit: 0,
    });
  });

  test("a refused call denies through the event's channel; a Stop on reentry lets the turn end", () => {
    const refusal = (r: Partial<Rejected>): Decision => rejected({ cause: BAD, kind: "pre-edit", reentry: false, session: null, dirs: [], ...r });
    const pre = refusal({});
    expect(enc("pre-edit", pre)).toEqual(deny(pre.full));
    expect(pre.full).toContain("payload-unrecognized");
    const write = refusal({ cause: "shell-write", kind: "pre-command" });
    expect(enc("pre-command", write)).toEqual(deny(write.full));
    const stop = refusal({ kind: "stop" });
    expect(JSON.parse(enc("stop", stop).stdout)).toEqual({ decision: "continue", reason: stop.full });
    expect(enc("stop", refusal({ kind: "stop", reentry: true }))).toEqual(NEUTRAL);
  });

  // Runs last: every emission of this file. An empty stdout lets the write through, so every
  // blocking decision must leave a deny or a continue.
  test('"allow" never leaves, every exit is 0, and nothing that blocks is silent', () => {
    expect(emitted.length).toBeGreaterThan(10);
    for (const e of emitted) {
      expect(e.stdout).not.toContain('"allow"');
      expect(e.exit).toBe(0);
      expect(e.stderr).toBe("");
      if (e.stdout !== "") {
        const out = JSON.parse(e.stdout);
        if (out.injectSteps) {
          const step = out.injectSteps[0];
          expect(typeof step.systemMessage?.systemMessage === "string" || (typeof step.errorMessage?.userMessage === "string" && out.terminationBehavior === "terminate")).toBe(true);
        } else {
          expect(["deny", "continue"]).toContain(out.decision);
        }
      }
    }
  });
});
