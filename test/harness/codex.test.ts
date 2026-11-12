import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { decide } from "../../src/decide.ts";
import { cliVersion, decode, encode, TESTED, VERIFIED } from "../../src/harness/codex.ts";
import type { Decision, DecideInput, Edit, Emission, HookEvent, HookKind, Lock, ProposedChange, Rejected, Severity, Violation } from "../../src/types.ts";
import { contract, ENV } from "./contract.ts";

// The Codex CLI contract (MULTI-HARNESS MH-05, MH-08, MH-14): real payloads from test/payloads/codex
// decoded to exact events, and the patch grammar on top of them. The 0.159.2 captures keep the
// session directory in `cwd`. The 0.166.0 captures (openai/codex#57198) put the Bash command's
// resolved workdir there; apply_patch, SessionStart and Stop still carry the session directory.
// Patch semantics marked [V] were checked against Codex 0.159.2's own apply_patch.

const DIR = `${import.meta.dir}/../payloads/codex`;
const PROJECT = "/home/user/project";
const BAD = "payload-unrecognized";
const payload = (name: string): string => readFileSync(`${DIR}/${name}`, "utf8");
const json = (name: string): Record<string, unknown> => JSON.parse(payload(name)) as Record<string, unknown>;
const patch166 = (json("pre-apply-patch-166.json").tool_input as { command: string }).command;
const raw = (o: unknown): string => JSON.stringify(o);
const tag = (id: string, command: string): string => `${id}~${createHash("sha256").update(command).digest("hex").slice(0, 12)}`;
const S166 = "01a00000-0000-7000-8000-000000000166";
const T166 = "01a00000-0000-7000-8000-000000000167";
const session166 = (turn: string | null) => ({ id: S166, harness: "codex" as const, agentId: null, turnId: turn, interactive: false });
const sid = (n: number): string => `00000000-0000-4000-8000-00000000000${n}`;
const turn = (n: string): string => `00000000-0000-4000-8000-a00000000${n}`;
const exec = (n: string): string => `exec-00000000-0000-4000-8000-c00000000${n}`;
const session = (n: number, t: string | null) => ({ id: sid(n), harness: "codex" as const, agentId: null, turnId: t === null ? null : turn(t), interactive: false });
const causeOf = (e: HookEvent | Rejected | null): string | null => (e !== null && "cause" in e ? e.cause : null);

test("VERIFIED minimum is 0.167.0", () => {
  expect(VERIFIED).toBe("0.167.0");
  expect(cliVersion("codex-cli 0.166.0")).toBe("0.166.0");
  expect(TESTED).toBe("0.167.1");
  expect(cliVersion(`codex-cli ${TESTED}`)).toBe(TESTED);
});
const hunk = (old: string[], neu: string[], anchor: string | null = null, eof = false) => ({ anchor, old, neu, eof });

const UNREGISTERED = "an event PREGATE does not register in ~/.codex/hooks.json (MH-22)";
const UNMATCHED = "outside the PreToolUse matcher ^(apply_patch|Bash)$ (MH-22)";

describe("decode: captured payloads", () => {
  contract("codex", DIR, {
    "session-start.json": { event: "session-start", out: { kind: "session-start", session: session(1, null), cwd: PROJECT } },
    // One call, two files: both reach the gate, with the shared callId (MH-09).
    "pre-apply-patch-add-update.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [
          { session: session(2, "201"), callId: `${exec("201")}~34066607670d`, tool: "apply_patch", path: `${PROJECT}/b.txt`, edit: { form: "full", content: "beta\n" }, from: null },
          {
            session: session(2, "201"), callId: `${exec("201")}~34066607670d`, tool: "apply_patch", path: `${PROJECT}/edit_me.txt`,
            edit: { form: "hunks", hunks: [hunk(["line2"], ["LINE_TWO"])] }, from: null,
          },
        ],
      },
    },
    // A move is the origin deleted and the destination written from the origin's text.
    "pre-apply-patch-move.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [
          { session: session(1, "101"), callId: `${exec("101")}~b283c8c6a944`, tool: "apply_patch", path: `${PROJECT}/existing.txt`, edit: { form: "delete" }, from: null },
          {
            session: session(1, "101"), callId: `${exec("101")}~b283c8c6a944`, tool: "apply_patch", path: `${PROJECT}/moved.txt`,
            edit: { form: "hunks", hunks: [hunk(["hello"], ["hello2"])] }, from: `${PROJECT}/existing.txt`,
          },
        ],
      },
    },
    "pre-apply-patch-delete.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{ session: session(1, "101"), callId: `${exec("102")}~7dcbb0a7c540`, tool: "apply_patch", path: `${PROJECT}/b.txt`, edit: { form: "delete" }, from: null }],
      },
    },
    // A subagent shares its parent's session and has its own agent_id.
    "pre-apply-patch-subagent.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [{
          session: { ...session(1, "102"), agentId: "00000000-0000-4000-8000-b00000000101" }, callId: `${exec("103")}~77270bfb33b6`,
          tool: "apply_patch", path: `${PROJECT}/sub.txt`, edit: { form: "full", content: "sub\n" }, from: null,
        }],
      },
    },
    "pre-bash.json": {
      event: "pre", out: { kind: "pre-command", command: { session: session(2, "201"), callId: `${exec("202")}~c7b68ac37f36`, tool: "Bash", command: "ls", cwd: PROJECT } },
    },
    "pre-bash-redirect-write.json": {
      event: "pre", out: {
        kind: "pre-command", command: { session: session(3, "301"), callId: `${exec("301")}~8642480c8ac8`, tool: "Bash", command: "printf 'n\\n' > n.txt", cwd: PROJECT },
      },
    },
    // 0.166.0: Bash `cwd` is the resolved workdir. A subfolder is not a new project root; the gate walks up.
    "pre-bash-workdir-nested.json": {
      event: "pre", out: {
        kind: "pre-command", command: {
          session: session166(T166), callId: tag("call_nested000000000001", "printf 'n\\n' > notes.txt"), tool: "Bash",
          command: "printf 'n\\n' > notes.txt", cwd: `${PROJECT}/nested`,
        },
      },
    },
    // A workdir outside the repo stays outside. It must not be rewritten to the session directory.
    "pre-bash-workdir-outside.json": {
      event: "pre", out: {
        kind: "pre-command", command: {
          session: session166(T166), callId: tag("call_outside00000000001", "printf 'out\\n' > out.txt"), tool: "Bash",
          command: "printf 'out\\n' > out.txt", cwd: "/home/user/outside",
        },
      },
    },
    // apply_patch still reports the session directory. The patch itself names the nested file.
    "pre-apply-patch-166.json": {
      event: "pre", out: {
        kind: "pre-edit", changes: [
          {
            session: session166(T166), callId: tag("call_patch0000000000001", patch166),
            tool: "apply_patch", path: `${PROJECT}/nested/added.txt`, edit: { form: "full", content: "added\n" }, from: null,
          },
          {
            session: session166(T166), callId: tag("call_patch0000000000001", patch166),
            tool: "apply_patch", path: `${PROJECT}/marker.txt`, edit: { form: "hunks", hunks: [hunk(["root"], ["ROOT"])] }, from: null,
          },
        ],
      },
    },
    "session-start-166.json": { event: "session-start", out: { kind: "session-start", session: session166(null), cwd: PROJECT } },
    "stop-166.json": { event: "stop", out: { kind: "stop", session: session166(T166), cwd: PROJECT, reentry: false } },
    "stop.json": { event: "stop", out: { kind: "stop", session: session(1, "101"), cwd: PROJECT, reentry: false } },
    "stop-block-first.json": { event: "stop", out: { kind: "stop", session: session(4, "401"), cwd: PROJECT, reentry: false } },
    "stop-reentry.json": { event: "stop", out: { kind: "stop", session: session(4, "401"), cwd: PROJECT, reentry: true } },
    "pre-spawn-agent.json": { unregistered: UNMATCHED },
    "pre-wait-agent.json": { unregistered: UNMATCHED },
    "post-apply-patch-add-update.json": { unregistered: UNREGISTERED },
    "post-apply-patch-move.json": { unregistered: UNREGISTERED },
    "post-bash.json": { unregistered: UNREGISTERED },
    "post-spawn-agent.json": { unregistered: UNREGISTERED },
    "session-end.json": { unregistered: UNREGISTERED },
    "subagent-start.json": { event: "session-start", out: { kind: "session-start", session: { ...session(1, "102"), agentId: "00000000-0000-4000-8000-b00000000101" }, cwd: PROJECT } },
    "subagent-stop.json": { event: "stop", out: { kind: "stop", session: { ...session(1, "102"), agentId: "00000000-0000-4000-8000-b00000000101" }, cwd: PROJECT, reentry: false } },
    "user-prompt-submit.json": { unregistered: UNREGISTERED },
  });

  test("code mode reuses exec-<uuid>: two calls with one id keep distinct callIds", () => {
    const p = json("pre-bash.json");
    const a = decode("pre", raw(p), ENV) as Extract<HookEvent, { kind: "pre-command" }>;
    const b = decode("pre", raw({ ...p, tool_input: { command: "ls -a" } }), ENV) as Extract<HookEvent, { kind: "pre-command" }>;
    expect(a.command.callId.startsWith(`${exec("202")}~`)).toBe(true);
    expect(b.command.callId).not.toBe(a.command.callId);
  });

  test("GROK_HOOK_EVENT and a project dir inherited from a parent process change nothing", () => {
    const e = decode("pre", payload("pre-apply-patch-move.json"), ENV);
    expect(decode("pre", payload("pre-apply-patch-move.json"), { grokEvent: "pre_tool_use", projectDir: "/elsewhere", remote: true })).toEqual(e);
  });

  test("the envelope admits keys it does not read", () => {
    expect(decode("stop", raw({ ...json("stop.json"), something_new: 1 }), ENV)).toMatchObject({ kind: "stop" });
  });

  test("lifecycle events require the matching parent or child identity", () => {
    for (const [file, kind] of [["subagent-start.json", "session-start"], ["subagent-stop.json", "stop"]] as const) {
      for (const agent_id of [undefined, "", 1]) expect(decode(kind, raw({ ...json(file), agent_id }), ENV)).toMatchObject({ cause: BAD });
    }
    for (const [file, kind] of [["session-start.json", "session-start"], ["stop.json", "stop"]] as const) {
      expect(decode(kind, raw({ ...json(file), agent_id: "child" }), ENV)).toMatchObject({ cause: BAD });
    }
  });
});

describe("decode: anything else is rejected as payload-unrecognized", () => {
  const without = (o: Record<string, unknown>, key: string): Record<string, unknown> => {
    const { [key]: _, ...rest } = o;
    return rest;
  };

  const ENVELOPE: [string, HookKind, string, unknown][] = [
    ["pre-bash.json", "pre", "session_id", 7], ["pre-bash.json", "pre", "cwd", "project"],
    ["pre-bash.json", "pre", "hook_event_name", "PostToolUse"], ["pre-bash.json", "pre", "tool_name", 1],
    ["pre-bash.json", "pre", "tool_input", "{}"], ["pre-bash.json", "pre", "tool_use_id", 3],
    ["stop.json", "stop", "stop_hook_active", "false"], ["session-start.json", "session-start", "session_id", []],
  ];
  for (const [file, event, key, wrong] of ENVELOPE) {
    test(`${file}: ${key} missing`, () => expect(causeOf(decode(event, raw(without(json(file), key)), ENV))).toBe(BAD));
    test(`${file}: ${key} = ${JSON.stringify(wrong)}`, () => expect(causeOf(decode(event, raw({ ...json(file), [key]: wrong }), ENV))).toBe(BAD));
  }

  test.each(["turn_id", "agent_id"])("optional %s with the wrong type", (key) => {
    expect(causeOf(decode("pre", raw({ ...json("pre-bash.json"), [key]: 1 }), ENV))).toBe(BAD);
  });

  test.each(["pre-bash.json", "pre-apply-patch-delete.json"])("%s: command missing, of the wrong type, or next to an extra key", (file) => {
    const p = json(file);
    const command = (p.tool_input as { command: string }).command;
    for (const input of [{}, { command: ["ls"] }, { command, workdir: "/tmp" }]) expect(causeOf(decode("pre", raw({ ...p, tool_input: input }), ENV))).toBe(BAD);
  });

  test.each(["collaborationspawn_agent", "Edit", "Write", "apply_patch "])("tool_name %p is outside the registered set", (tool) => {
    expect(causeOf(decode("pre", raw({ ...json("pre-bash.json"), tool_name: tool }), ENV))).toBe(BAD);
  });

  test.each([
    ["stop", "pre-bash.json"], ["pre", "stop.json"], ["session-start", "stop.json"], ["pre", "session-start.json"],
  ] as [HookKind, string][])("hook %s receiving %s", (event, file) => expect(causeOf(decode(event, payload(file), ENV))).toBe(BAD));

  test.each(["", "not json", "[]", "null", '{"hook_event_name":"PreToolUse"'])("stdin %p", (text) => {
    expect(decode("pre", text, ENV)).toEqual({ cause: BAD, kind: "pre-edit", reentry: false, session: null, dirs: [] });
  });

  test("the refusal leaves through the event's channel, with the directories that locate the call", () => {
    const reentry = decode("stop", raw({ ...json("stop-reentry.json"), cwd: "project" }), { ...ENV, projectDir: "/home/user/other" });
    expect(reentry).toEqual({ cause: BAD, kind: "stop", reentry: true, session: session(4, "401"), dirs: ["/home/user/other"] });
    expect(decode("pre", raw({ ...json("pre-bash.json"), tool_name: "Read" }), ENV)).toEqual({
      cause: BAD, kind: "pre-edit", reentry: false, session: session(2, "201"), dirs: [PROJECT],
    });
  });
});

// ── The patch (MH-08) ──────────────────────────────────────────────────────────────

const A = `${PROJECT}/src/a.ts`;
const B = `${PROJECT}/src/b.ts`;
const sent = (command: string): HookEvent | Rejected | null => decode("pre", raw({ ...json("pre-apply-patch-add-update.json"), tool_input: { command } }), ENV);
const body = (...lines: string[]): string => ["*** Begin Patch", ...lines, "*** End Patch"].join("\n");
const changes = (command: string): Pick<ProposedChange, "path" | "edit" | "from">[] => {
  const e = sent(command);
  if (e === null || !("changes" in e)) throw new Error(`not a pre-edit: ${JSON.stringify(e)}`);
  return e.changes.map(({ path, edit, from }) => ({ path, edit, from }));
};
const edits = (command: string): Edit[] => changes(command).map((c) => c.edit);

describe("patch: what parses", () => {
  test("@@ with context anchors its hunk; hunks keep their order; End of File marks the last one [V]", () => {
    const text = body(`*** Update File: ${A}`, "@@ function f() {", "-  return 1;", "+  return 2;", "@@", " x", "-y", "+Y", "*** End of File");
    expect(edits(text)).toEqual([{ form: "hunks", hunks: [hunk(["  return 1;"], ["  return 2;"], "function f() {"), hunk(["x", "y"], ["x", "Y"], null, true)] }]);
  });

  test("the anchor is the rest of the @@ line, spaces inside included", () => {
    expect(edits(body(`*** Update File: ${A}`, "@@ class A {  }", "-a"))).toEqual([{ form: "hunks", hunks: [hunk(["a"], [], "class A {  }")] }]);
  });

  test("an empty line inside a hunk is an empty context line [V]", () => {
    expect(edits(body(`*** Update File: ${A}`, "@@", " a", "", "-b", "+B"))).toEqual([{ form: "hunks", hunks: [hunk(["a", "", "b"], ["a", "", "B"])] }]);
  });

  test("Add: the + lines, each ending in \\n; an Add with no lines is an empty file [V]", () => {
    expect(edits(body(`*** Add File: ${A}`, "+a", "+", "+b", `*** Add File: ${B}`))).toEqual([
      { form: "full", content: "a\n\nb\n" }, { form: "full", content: "" },
    ]);
  });

  test("CRLF line ends split as Codex splits them; a lone CR is content [V]", () => {
    expect(edits(`*** Begin Patch\r\n*** Add File: ${A}\r\n+a\rb\r\n+c\r\n*** End Patch\r\n`)).toEqual([{ form: "full", content: "a\rb\nc\n" }]);
  });

  test("whitespace around the whole patch is trimmed, as Codex does", () => {
    expect(edits(`\n  ${body(`*** Delete File: ${A}`)}\n\n`)).toEqual([{ form: "delete" }]);
  });

  test("every file of a patch, in order; a move expands where it stands", () => {
    const text = body(`*** Delete File: ${B}`, `*** Update File: ${A}`, `*** Move to: ${PROJECT}/src/c.ts`, "@@", "-x", "+y", `*** Add File: ${PROJECT}/d.ts`, "+d");
    expect(changes(text)).toEqual([
      { path: B, edit: { form: "delete" }, from: null },
      { path: A, edit: { form: "delete" }, from: null },
      { path: `${PROJECT}/src/c.ts`, edit: { form: "hunks", hunks: [hunk(["x"], ["y"])] }, from: A },
      { path: `${PROJECT}/d.ts`, edit: { form: "full", content: "d\n" }, from: null },
    ]);
  });

  test("a hunk with nothing to find (pure insertion) is unknown: Codex appends it at the end whatever its anchor [V]", () => {
    expect(edits(body(`*** Update File: ${A}`, "@@ a", "+NEW"))).toEqual([{ form: "unknown", cause: "patch-insertion" }]);
    expect(edits(body(`*** Update File: ${A}`, "@@", "-a", "@@", "+b"))).toEqual([{ form: "unknown", cause: "patch-insertion" }]);
  });
});

describe("patch: what does not parse is denied as cannot-reconstruct, never read another way", () => {
  const CASES: [string, string][] = [
    ["a relative path", body("*** Add File: src/a.ts", "+a")],
    ["a .. segment", body(`*** Add File: ${PROJECT}/x/../a.ts`, "+a")],
    ["a . segment", body(`*** Delete File: ${PROJECT}/./a.ts`)],
    ["an empty segment", body(`*** Delete File: ${PROJECT}//a.ts`)],
    ["trailing whitespace in a path, which Codex trims [V]", body(`*** Add File: ${A} `, "+a")],
    ["U+0085 at the end of a path, which Rust trims", body(`*** Add File: ${A}\u0085`, "+a")],
    ["whitespace before a header, which Codex accepts [V]", body(`  *** Add File: ${A}`, "+a")],
    ["a relative move destination", body(`*** Update File: ${A}`, "*** Move to: b.ts", "@@", "-a", "+b")],
    ["a move destination with trailing whitespace [V]", body(`*** Update File: ${A}`, `*** Move to: ${B} `, "@@", "-a", "+b")],
    ["a heredoc around the patch, which Codex accepts [V]", `<<'EOF'\n${body(`*** Add File: ${A}`, "+a")}\nEOF`],
    ["a first hunk without @@, which Codex accepts [V]", body(`*** Update File: ${A}`, "-a", "+b")],
    ["an update without hunks [V]", body(`*** Update File: ${A}`, `*** Move to: ${B}`)],
    ["a hunk without lines [V]", body(`*** Update File: ${A}`, "@@", "*** End of File")],
    ["@@ inside a hunk [V]", body(`*** Update File: ${A}`, "@@", "@@", "-a", "+b")],
    ["@@ and a space, which Codex reads as no anchor [V]", body(`*** Update File: ${A}`, "@@ ", "-b", "+B")],
    ["an anchor with whitespace at an edge, which Codex matches loosely [V]", body(`*** Update File: ${A}`, "@@  f", "-b", "+B")],
    ["@@ and a tab [V]", body(`*** Update File: ${A}`, "@@\t", "-b", "+B")],
    ["End of File followed by a line", body(`*** Update File: ${A}`, "@@", "-a", "*** End of File", "-b")],
    ["End of File with trailing whitespace", body(`*** Update File: ${A}`, "@@", "-a", "*** End of File ")],
    ["a blank line between operations [V]", body(`*** Add File: ${A}`, "+a", "", `*** Add File: ${B}`, "+b")],
    ["a line that is no header [V]", body(`*** Add File: ${A}`, "+a", "junk")],
    ["Move to where a header goes", body(`*** Move to: ${A}`)],
    ["no operation [V]", body()],
    ["no End Patch", `*** Begin Patch\n*** Add File: ${A}\n+a`],
    ["text after End Patch [V]", `${body(`*** Add File: ${A}`, "+a")}\ngarbage`],
    ["Begin Patch with trailing whitespace", `*** Begin Patch \n*** Add File: ${A}\n+a\n*** End Patch`],
    ["one file twice, which Codex applies in sequence [V]", body(`*** Update File: ${A}`, "@@", "-a", "+A", `*** Update File: ${A}`, "@@", "-b", "+B")],
    ["a delete and an add of one file [V]", body(`*** Delete File: ${A}`, `*** Add File: ${A}`, "+z")],
    ["a move onto itself, which deletes the file [V]", body(`*** Update File: ${A}`, `*** Move to: ${A}`, "@@", "-x", "+y")],
    ["one file in two cases (APFS folds case)", body(`*** Add File: ${A}`, "+a", `*** Delete File: ${PROJECT}/src/A.ts`)],
    ["one file in two Unicode normalizations", body(`*** Add File: ${PROJECT}/café.ts`, "+a", `*** Delete File: ${PROJECT}/café.ts`)],
  ];
  test.each(CASES)("%s", (_, text) => expect(causeOf(sent(text))).toBe("cannot-reconstruct"));

  test("the refusal carries the session and the directories of every file the patch names, relative ones against cwd", () => {
    const text = `<<'EOF'\n${body(`*** Add File: ${PROJECT}/src/a.ts`, "+a", "  *** Update File: ../other/b.ts ", "@@", "-b")}\nEOF`;
    expect(sent(text)).toEqual({
      cause: "cannot-reconstruct", kind: "pre-edit", reentry: false, session: session(2, "201"),
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
// Adapter encoding consumes policy decisions; consent belongs to the gate integration tests.
function rejected(r: Rejected): Decision {
  return decide(input({ event: r.kind, form: { cause: r.cause, line: null },
    stop: r.kind === "stop" ? { blocks: 0, reentry: r.reentry, approved: [] } : null }));
}

const input = (change: Partial<DecideInput>): DecideInput => ({
  lock: LOCK, lockHash: "c".repeat(64), launcher: "/home/user/project/.pregate/bin/pregate", session: session(1, "101"),
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
  test("no objection: quiet when empty, or PreToolUse additionalContext for warnings and advisor findings", () => {
    expect(enc("pre-edit", decide(input({})))).toEqual(QUIET);
    expect(enc("pre-command", decide(input({ event: "pre-command", path: null })))).toEqual(QUIET);
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

  test("deny: the full text on stderr, stdout empty, exit 2 [V]", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4)] }));
    expect(d.verdict).toBe("deny");
    expect(enc("pre-edit", d)).toEqual({ stdout: "", stderr: d.full, exit: 2 });
    expect(enc("pre-command", d)).toEqual({ stdout: "", stderr: d.full, exit: 2 });
  });

  test("deny + halt: the same deny, without continue:false, which would let the tool run [V]", () => {
    const d = decide(input({ introduced: [v("core/FCIS-IO-001", 4)], turnDenials: LOCK.loop.maxDenialsPerTurn }));
    expect(d.halt).toBe(true);
    expect(enc("pre-edit", d)).toEqual({ stdout: "", stderr: d.full, exit: 2 });
  });

  test("ask: Codex would treat it as no decision, so it leaves as a deny", () => {
    // decide never asks a non-interactive session; encode still never lets an ask through.
    expect(decide(input({ introduced: [v("core/TDD-FOCUS-001", 12)] })).verdict).toBe("deny");
    const d: Decision = { ...decide(input({ introduced: [v("core/FCIS-IO-001", 4)] })), verdict: "ask" };
    expect(enc("pre-edit", d)).toEqual({ stdout: "", stderr: d.full, exit: 2 });
  });

  test("Stop block: exactly decision and reason, exit 0 [V]", () => {
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop: { blocks: 0, reentry: false, approved: [] } }));
    const e = enc("stop", d);
    expect(e).toEqual({ stdout: `${JSON.stringify({ decision: "block", reason: d.full })}\n`, stderr: "", exit: 0 });
    expect(Object.keys(JSON.parse(e.stdout) as object)).toEqual(["decision", "reason"]);
  });

  test("Stop reentry past its cap: a human notice ends the turn without continuing it", () => {
    const stop = { blocks: LOCK.loop.maxStopBlocks, reentry: true, approved: [] };
    const d = decide(input({ event: "stop", introduced: [v("core/FCIS-IO-001", 4)], stop }));
    expect(d.verdict).toBe("none");
    expect(enc("stop", d)).toEqual({ stdout: raw({ systemMessage: d.notice }) + "\n", stderr: "", exit: 0 });
    expect(d.notice).toContain("not a successful compliance check");
  });

  test("SessionStart: context uses the event-specific Codex schema", () => {
    expect(enc("session-start", { ...decide(input({})), full: "PREGATE is active: …", notice: null })).toEqual({
      stdout: raw({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "PREGATE is active: …" } }) + "\n", stderr: "", exit: 0,
    });
    const failed = rejected({ cause: BAD, kind: "session-start", reentry: false, session: null, dirs: [] });
    expect(enc("session-start", failed)).toEqual({ stdout: raw({ systemMessage: failed.notice }) + "\n", stderr: "", exit: 0 });
  });

  test("SubagentStart names its own event and omits human notices", () => {
    const context = { ...decide(input({})), full: "PREGATE is active: …", notice: null };
    expect(encode("session-start", context, true)).toEqual({ stdout: raw({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: context.full } }) + "\n", stderr: "", exit: 0 });
    expect(encode("session-start", { ...context, full: "", notice: "human setup notice" }, true)).toEqual(QUIET);
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
      if (e.stdout !== "") {
        const out = JSON.parse(e.stdout);
        expect(Object.keys(out)).toEqual(out.hookSpecificOutput ? ["hookSpecificOutput"] : out.systemMessage ? ["systemMessage"] : ["decision", "reason"]);
      }
    }
  });
});
