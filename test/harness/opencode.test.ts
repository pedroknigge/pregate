import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { decide } from "../../src/decide.ts";
import { cliVersion, decode, encode, VERIFIED } from "../../src/harness/opencode.ts";
import type { Decision, DecideInput, Edit, Emission, HookEvent, HookKind, Lock, ProposedChange, Rejected, Severity, Violation } from "../../src/types.ts";
import { contract, ENV } from "./contract.ts";

// The OpenCode contract (MULTI-HARNESS MH-05, MH-08, MH-14): the payload the PREGATE plugin sends,
// decoded to exact events, and the deny/advice/Stop dialect on top of it. The payloads are written
// from `@opencode/plugin@2.2.7`; test/payloads/opencode/README.md lists what no capture proves yet.

const DIR = `${import.meta.dir}/../payloads/opencode`;
const PROJECT = "/home/user/project";
const SID = "ses_0a1b2c3d4e5f6a7b";
const BAD = "payload-unrecognized";
const payload = (name: string): string => readFileSync(`${DIR}/${name}`, "utf8");
const json = (name: string): Record<string, unknown> => JSON.parse(payload(name)) as Record<string, unknown>;
const raw = (o: unknown): string => JSON.stringify(o);
const session = { id: SID, harness: "opencode" as const, agentId: null, turnId: null, interactive: false };
const call = (n: number): string => `call_000000000000000${n}`;
const A = `${PROJECT}/src/a.ts`;
const B = `${PROJECT}/src/b.ts`;
const causeOf = (e: HookEvent | Rejected | null): string | null => (e !== null && "cause" in e ? e.cause : null);
const hunk = (old: string[], neu: string[], anchor: string | null = null, eof = false) => ({ anchor, old, neu, eof });

test("VERIFIED is the CLI whose plugin API the payloads come from", () => {
  expect(VERIFIED).toBe("2.2.7");
  expect(cliVersion("2.2.7")).toBe("2.2.7");
  expect(cliVersion("2.2.7\n")).toBe("2.2.7");
  expect(cliVersion("opencode 2.2.7")).toBeNull();
});

describe("decode: the payloads the plugin sends", () => {
  contract("opencode", DIR, {
    "session-start.json": { event: "session-start", out: { kind: "session-start", session, cwd: PROJECT } },
    "pre-write.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{ session, callId: call(1), tool: "write", path: A, edit: { form: "full", content: "export const one = 1;\n" }, from: null }],
      },
    },
    "pre-edit.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session, callId: call(2), tool: "edit", path: A,
          edit: { form: "oldnew", old: "export const one = 1;", neu: "export const one = 2;", all: false, lines: null }, from: null,
        }],
      },
    },
    // One patch, two files: both reach the gate, with the shared callId (MH-09).
    "pre-patch.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [
          { session, callId: call(3), tool: "patch", path: B, edit: { form: "full", content: "export const two = 2;\n" }, from: null },
          {
            session, callId: call(3), tool: "patch", path: A,
            edit: { form: "hunks", hunks: [hunk(["export const one = 1;"], ["export const one = 3;"])] }, from: null,
          },
        ],
      },
    },
    // The plugin fills the tool's working directory from the session directory.
    "pre-shell.json": {
      event: "pre", out: {
        kind: "pre-command", command: { session, callId: call(4), tool: "shell", command: "printf 'n\\n' > notes.txt", cwd: PROJECT },
      },
    },
    // Code mode sees one call: the nested writes run inside it, so the whole script is refused.
    "pre-execute.json": { event: "pre", out: { cause: "cannot-reconstruct", kind: "pre-edit", reentry: false, session, dirs: [PROJECT] } },
    // A tool this adapter does not know is untrusted input, and its path locates the call.
    "pre-unknown-tool.json": {
      event: "pre", out: { cause: BAD, kind: "pre-edit", reentry: false, session, dirs: [`${PROJECT}/src/a.ipynb`, PROJECT] },
    },
    // A read changes nothing and runs nothing: the call is ignored, never refused.
    "pre-read.json": { event: "pre", out: null },
    "stop.json": { event: "stop", out: { kind: "stop", session, cwd: PROJECT, reentry: false } },
    "stop-reentry.json": { event: "stop", out: { kind: "stop", session, cwd: PROJECT, reentry: true } },
  });

  test("the optional agent id reaches the session; the envelope admits keys it does not read", () => {
    const p = { ...json("pre-write.json"), agent_id: "explore", something_new: 1 };
    expect(decode("pre", raw(p), ENV)).toMatchObject({ kind: "pre-edit", changes: [{ session: { ...session, agentId: "explore" } }] });
  });

  test("an inherited project dir changes nothing: the plugin sends the session directory", () => {
    const e = decode("pre", payload("pre-write.json"), ENV);
    expect(decode("pre", payload("pre-write.json"), { ...ENV, projectDir: "/elsewhere", remote: true })).toEqual(e);
  });
});

describe("decode: anything else is rejected as payload-unrecognized", () => {
  const without = (o: Record<string, unknown>, key: string): Record<string, unknown> => {
    const { [key]: _, ...rest } = o;
    return rest;
  };

  const ENVELOPE: [string, HookKind, string, unknown][] = [
    ["pre-write.json", "pre", "session_id", 7], ["pre-write.json", "pre", "cwd", "project"],
    ["pre-write.json", "pre", "hook_event_name", "PostToolUse"], ["pre-write.json", "pre", "tool_name", 1],
    ["pre-write.json", "pre", "tool_input", "{}"], ["pre-write.json", "pre", "tool_use_id", 3],
    ["stop.json", "stop", "stop_hook_active", "false"], ["session-start.json", "session-start", "session_id", []],
  ];
  for (const [file, event, key, wrong] of ENVELOPE) {
    test(`${file}: ${key} missing`, () => expect(causeOf(decode(event, raw(without(json(file), key)), ENV))).toBe(BAD));
    test(`${file}: ${key} = ${JSON.stringify(wrong)}`, () => expect(causeOf(decode(event, raw({ ...json(file), [key]: wrong }), ENV))).toBe(BAD));
  }

  test.each(["agent_id", "turn_id"])("optional %s with the wrong type", (key) => {
    expect(causeOf(decode("pre", raw({ ...json("pre-write.json"), [key]: 1 }), ENV))).toBe(BAD);
  });

  // A call whose path is unreadable cannot be located: it is refused.
  test.each([
    ["write", {}], ["write", { filePath: "src/a.ts", content: "x" }],
    ["write", { filePath: `${PROJECT}/x/../a.ts`, content: "x" }],
    ["edit", { filePath: `${PROJECT}/./a.ts`, oldString: "a", newString: "b" }],
    ["shell", {}], ["shell", { command: ["ls"] }], ["shell", { command: "ls", workdir: "relative" }],
    ["shell", { command: "ls", cwd: "/tmp" }], ["patch", { patchText: 1 }], ["patch", {}],
  ] as [string, Record<string, unknown>][])("%s with %j is refused", (tool_name, tool_input) => {
    const p = { ...json("pre-write.json"), tool_name, tool_input };
    expect(causeOf(decode("pre", raw(p), ENV))).toBe(BAD);
  });

  // An edit this adapter cannot read exactly is judged by its path, and the gate denies it there.
  test.each([
    ["write", { filePath: A }], ["write", { filePath: A, content: 1 }], ["write", { filePath: A, content: "x", mode: "append" }],
    ["edit", { filePath: A, oldString: "a" }], ["edit", { filePath: A, oldString: "a", newString: "b", replaceAll: "yes" }],
  ] as [string, Record<string, unknown>][])("%s with %j is an edit of unknown form", (tool_name, tool_input) => {
    const p = { ...json("pre-write.json"), tool_name, tool_input };
    expect(decode("pre", raw(p), ENV)).toEqual({
      kind: "pre-edit", changes: [{ session, callId: call(1), tool: tool_name, path: A, edit: { form: "unknown", cause: tool_name }, from: null }],
    });
  });

  test.each(["notebook_edit", "Write", "bash", "read_file", "execute "])("tool_name %p is outside the set the plugin sends", (tool) => {
    expect(causeOf(decode("pre", raw({ ...json("pre-write.json"), tool_name: tool }), ENV))).toBe(BAD);
  });

  test.each([
    ["stop", "pre-write.json"], ["pre", "stop.json"], ["session-start", "stop.json"], ["pre", "session-start.json"],
  ] as [HookKind, string][])("hook %s receiving %s", (event, file) => expect(causeOf(decode(event, payload(file), ENV))).toBe(BAD));

  test.each(["", "not json", "[]", "null", '{"hook_event_name":"PreToolUse"'])("stdin %p", (text) => {
    expect(decode("pre", text, ENV)).toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: null, dirs: [] });
  });

  test("the refusal leaves through the event's channel, with the directories that locate the call", () => {
    expect(decode("stop", raw({ ...json("stop-reentry.json"), cwd: "project" }), { ...ENV, projectDir: "/home/user/other" }))
      .toEqual({ cause: BAD, kind: "stop", reentry: true, session, dirs: ["/home/user/other"] });
    expect(decode("pre", raw({ ...json("pre-shell.json"), tool_name: "Read" }), ENV))
      .toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session, dirs: [PROJECT] });
  });
});

// ── The patch (MH-08) ──────────────────────────────────────────────────────────────

const sent = (patchText: string): HookEvent | Rejected | null => decode("pre", raw({ ...json("pre-patch.json"), tool_input: { patchText } }), ENV);
const body = (...lines: string[]): string => ["*** Begin Patch", ...lines, "*** End Patch"].join("\n");
const changes = (text: string): Pick<ProposedChange, "path" | "edit" | "from">[] => {
  const e = sent(text);
  if (e === null || !("changes" in e)) throw new Error(`not a pre-edit: ${JSON.stringify(e)}`);
  return e.changes.map(({ path, edit, from }) => ({ path, edit, from }));
};
const edits = (text: string): Edit[] => changes(text).map((c) => c.edit);

describe("patch: the Codex grammar, plus OpenCode's environment header", () => {
  test("the optional Environment ID line carries no file operation", () => {
    const text = ["*** Begin Patch", "*** Environment ID: 7f3a9c2e", `*** Add File: ${A}`, "+a", "*** End Patch"].join("\n");
    expect(edits(text)).toEqual([{ form: "full", content: "a\n" }]);
  });

  test("a move expands where it stands", () => {
    const text = body(`*** Update File: ${A}`, `*** Move to: ${B}`, "@@", "-x", "+y");
    expect(changes(text)).toEqual([
      { path: A, edit: { form: "delete" }, from: null },
      { path: B, edit: { form: "hunks", hunks: [hunk(["x"], ["y"])] }, from: A },
    ]);
  });

  test("a hunk with nothing to find (pure insertion) is unknown", () => {
    expect(edits(body(`*** Update File: ${A}`, "@@ a", "+NEW"))).toEqual([{ form: "unknown", cause: "patch-insertion" }]);
  });

  test("an empty line inside a hunk is an empty context line", () => {
    expect(edits(body(`*** Update File: ${A}`, "@@", " a", "", "-b", "+B"))).toEqual([{ form: "hunks", hunks: [hunk(["a", "", "b"], ["a", "", "B"])] }]);
  });

  test.each([
    ["a relative path", body("*** Add File: src/a.ts", "+a")],
    ["a trailing space in a path", body(`*** Add File: ${A} `, "+a")],
    ["whitespace before a header", body(`  *** Add File: ${A}`, "+a")],
    ["a heredoc around the patch", `<<'EOF'\n${body(`*** Add File: ${A}`, "+a")}\nEOF`],
    ["a first hunk without @@", body(`*** Update File: ${A}`, "-a", "+b")],
    ["an update without hunks", body(`*** Update File: ${A}`, `*** Move to: ${B}`)],
    ["no operation", body()],
    ["one file twice", body(`*** Update File: ${A}`, "@@", "-a", "+A", `*** Update File: ${A}`, "@@", "-b", "+B")],
    ["text after End Patch", `${body(`*** Add File: ${A}`, "+a")}\ngarbage`],
  ])("%s is denied as cannot-reconstruct, never read another way", (_, text) => {
    expect(causeOf(sent(text))).toBe("cannot-reconstruct");
  });

  test("the refusal carries the session and the directory of every file the patch names", () => {
    const text = `<<'EOF'\n${body(`*** Add File: ${A}`, "+a", "  *** Update File: ../other/b.ts ", "@@", "-b")}\nEOF`;
    expect(sent(text)).toEqual({
      cause: "cannot-reconstruct", kind: "pre-edit", reentry: false, session,
      dirs: [PROJECT, `${PROJECT}/src`, "/home/user/other"],
    });
  });
});

// ── encode ────────────────────────────────────────────────────────────────────────

const GOLDEN = JSON.parse(readFileSync(`${import.meta.dir}/../presets/valid.lock.json`, "utf8")) as Lock;
const LOCK: Lock = { ...GOLDEN, enforcement: "enforce", rules: GOLDEN.rules.map((r) => ({ ...r, enforcement: "enforce", severity: r.id === "core/TDD-FOCUS-001" ? "ask" : r.severity })) };
const SEVERITY: Record<string, Severity> = { "core/CA-DEP-002": "warn", "core/TDD-FOCUS-001": "ask" };
const v = (rule: string, line: number): Violation => ({
  rule, path: "src/domain/invoice.ts", line, symbol: "Invoice.total", measured: null, limit: null, atSessionStart: null, severity: SEVERITY[rule] ?? "deny",
});
function rejected(r: Rejected): Decision {
  return decide(input({ event: r.kind, form: { cause: r.cause, line: null },
    stop: r.kind === "stop" ? { blocks: 0, reentry: r.reentry, approved: [] } : null }));
}

const input = (change: Partial<DecideInput>): DecideInput => ({
  lock: LOCK, lockHash: "c".repeat(64), launcher: "/home/user/project/.pregate/bin/pregate", session,
  event: "pre-edit", path: "src/domain/invoice.ts", introduced: [], form: null, protectedPath: false,
  history: [], turnDenials: 0, astHash: null, stop: null, ...change,
});
const emitted: Emission[] = [];
const enc = (kind: HookEvent["kind"], d: Decision): Emission => {
  const e = encode(kind, d);
  emitted.push(e);
  return e;
};
const QUIET: Emission = { stdout: "", stderr: "", exit: 0 };

describe("encode", () => {
  test("no objection: quiet when empty, or the advice as plain text for the plugin to append", () => {
    expect(enc("pre-edit", decide(input({})))).toEqual(QUIET);
    expect(enc("pre-command", decide(input({ event: "pre-command", path: null })))).toEqual(QUIET);
    const warned = decide(input({ introduced: [v("core/CA-DEP-002", 3)] }));
    expect(warned.full).not.toBe("");
    expect(enc("pre-edit", warned)).toEqual({ stdout: warned.full, stderr: "", exit: 0 });
    const advisorLock: Lock = { ...LOCK, enforcement: "advisor", rules: LOCK.rules.map((r) => ({ ...r, enforcement: r.integrity ? "enforce" : "advisor" })) };
    const advised = decide(input({ lock: advisorLock, introduced: [v("core/FCIS-IO-001", 4)] }));
    expect(advised.full).toContain("PREGATE ADVISOR");
    expect(enc("pre-edit", advised)).toEqual({ stdout: advised.full, stderr: "", exit: 0 });
  });

  test("deny: the full text on stderr, stdout empty, exit 2 — the plugin throws it [V]", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4)] }));
    expect(d.verdict).toBe("deny");
    expect(enc("pre-edit", d)).toEqual({ stdout: "", stderr: d.full, exit: 2 });
    expect(enc("pre-command", d)).toEqual({ stdout: "", stderr: d.full, exit: 2 });
  });

  test("deny + halt: the same deny; there is no hook-level stop to carry it", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4)], turnDenials: LOCK.loop.maxDenialsPerTurn }));
    expect(d.halt).toBe(true);
    expect(enc("pre-edit", d)).toEqual({ stdout: "", stderr: d.full, exit: 2 });
  });

  test("ask: there is no approval channel, so it leaves as a deny", () => {
    expect(decide(input({ introduced: [v("core/TDD-FOCUS-001", 12)] })).verdict).toBe("deny");
    const d: Decision = { ...decide(input({ introduced: [v("core/FCIS-IO-001", 4)] })), verdict: "ask" };
    expect(enc("pre-edit", d)).toEqual({ stdout: "", stderr: d.full, exit: 2 });
  });

  test("Stop block: exactly decision and reason on stdout, which the plugin admits as a message", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop: { blocks: 0, reentry: false, approved: [] } }));
    const e = enc("stop", d);
    expect(e).toEqual({ stdout: `${JSON.stringify({ decision: "block", reason: d.full })}\n`, stderr: "", exit: 0 });
    expect(Object.keys(JSON.parse(e.stdout) as object)).toEqual(["decision", "reason"]);
  });

  test("Stop reentry past its cap: the turn ends quietly", () => {
    const stop = { blocks: LOCK.loop.maxStopBlocks, reentry: true, approved: [] };
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop }));
    expect(d.verdict).toBe("none");
    expect(enc("stop", d)).toEqual(QUIET);
  });

  test("SessionStart: the briefing is plain text for the plugin's instruction entry", () => {
    expect(enc("session-start", { ...decide(input({})), full: "PREGATE is active: …", notice: null }))
      .toEqual({ stdout: "PREGATE is active: …", stderr: "", exit: 0 });
    expect(enc("session-start", rejected({ cause: BAD, kind: "session-start", reentry: false, session: null, dirs: [] }))).toEqual(QUIET);
  });

  test("a rejected call denies through its event's channel", () => {
    const pre = enc("pre-edit", rejected({ cause: BAD, kind: "pre-edit", reentry: false, session: null, dirs: [] }));
    expect(pre.exit).toBe(2);
    expect(pre.stderr).toContain("payload-unrecognized");
    const patch = enc("pre-edit", rejected(decode("pre", "{", ENV) as Rejected));
    expect(patch).toMatchObject({ stdout: "", exit: 2 });
    expect(patch.stderr).not.toBe("");
    expect(enc("stop", rejected({ cause: BAD, kind: "stop", reentry: false, session: null, dirs: [] }))).toMatchObject({ stderr: "", exit: 0 });
  });

  // Runs last: every emission of this file.
  test('"allow" never leaves; exit 2 always has an empty stdout and a non-empty stderr', () => {
    expect(emitted.length).toBeGreaterThan(10);
    for (const e of emitted) {
      expect(e.stdout).not.toContain('"allow"');
      expect([0, 2]).toContain(e.exit);
      if (e.exit === 2) expect([e.stdout, e.stderr.length > 0]).toEqual(["", true]);
      if (e.stdout !== "" && e.stdout.startsWith("{")) {
        const out = JSON.parse(e.stdout);
        expect(Object.keys(out)).toEqual(["decision", "reason"]);
      }
    }
  });
});
