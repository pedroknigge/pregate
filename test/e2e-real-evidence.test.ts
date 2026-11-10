import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { agyApprovalEvidence, agyApprovalPrompt, agyShellOutput, claudeFitnessInspection, claudeShellInput, codexApprovalEvidence, codexShellOutput, newEvents } from "../scripts/e2e-real-evidence.ts";
import { removeTree } from "./remove-tree.ts";

// These controls test evidence selection, not the product's approval behavior.
const command = `pregate approve --yes --digest ${"a".repeat(64)}`;
const denial = `Script error:\nCommand blocked by PreToolUse hook: PREGATE: denied. Command: ${command}`;
const transcript = [
  { type: "session_meta", payload: { id: "session" } },
  { type: "response_item", payload: { type: "custom_tool_call", name: "exec", call_id: "call", input: command,
    internal_chat_message_metadata_passthrough: { turn_id: "turn" } } },
  { type: "response_item", payload: { type: "custom_tool_call_output", call_id: "call", output: [{ type: "input_text", text: denial }],
    internal_chat_message_metadata_passthrough: { turn_id: "turn" } },
    metadata: { client_authored: false } },
  { type: "event_msg", payload: { type: "task_complete", turn_id: "turn" } },
];
const lines = (rows: unknown[]): string => rows.map((row) => JSON.stringify(row)).join("\n");

test("Claude human shell evidence requires a native user record, exact project and exact command", () => {
  const row = {type:"user",cwd:"repo",message:{role:"user",content:`<bash-input> ${command}</bash-input>`}};
  expect(claudeShellInput(lines([row]),"repo",command)).toBe(true);
  expect(claudeShellInput(lines([row])+"\n{unfinished","repo",command)).toBe(true);
  expect(claudeShellInput(lines([row]),"other",command)).toBe(false);
  expect(claudeShellInput(lines([row]),"repo",command+" --extra")).toBe(false);
  expect(claudeShellInput(lines([{...row,type:"assistant"}]),"repo",command)).toBe(false);
  expect(claudeShellInput(lines([{...row,message:{...row.message,role:"assistant"}}]),"repo",command)).toBe(false);
  expect(claudeShellInput(lines([{...row,message:{...row.message,content:`The model says: <bash-input>${command}</bash-input>`}}]),"repo",command)).toBe(false);
  expect(claudeShellInput(lines([{...row,message:{...row.message,content:`<bash-input>${command} ; extra</bash-input>`}}]),"repo",command)).toBe(false);
  expect(claudeShellInput("{unfinished","repo",command)).toBe(false);
});

test("Claude fitness observation admits only the independently observed read-only tool command", () => {
  const launcher = "/fixture/pregate/bin/pregate";
  const text = `${launcher} fitness status --json 2>&1 | head -c 6000`;
  const row = {tool_name:"Bash",tool_input:{command:text}};
  expect(claudeFitnessInspection(row,launcher)).toBe(true);
  for (const value of [null, {...row,tool_name:"other"}, {...row,tool_input:{command:command}},
    {...row,tool_input:{command:text+`; ${command}`}}, {...row,tool_input:{command:text.replace("status","run")}},
    {...row,tool_input:{command:text.replace("--json","--json --yes")}}]) expect(claudeFitnessInspection(value,launcher)).toBe(false);
});

const agyDenial = `tool call denied by pre-tool hook: PREGATE: ask the user to type ! ${command} inside the harness.`;
const agyRecords = [{type:"PLANNER_RESPONSE",step_index:2,tool_calls:[{name:"run_command",args:{CommandLine:command}}]},
  {type:"GENERIC",step_index:3,status:"ERROR",error:agyDenial}];

test("agy approval evidence joins the exact command and native execution step", () => {
  expect(agyApprovalEvidence(lines(agyRecords), 3, command)).toEqual([agyDenial]);
  expect(agyApprovalEvidence(lines(agyRecords), 4, command)).toEqual([]);
  expect(agyApprovalEvidence(lines(agyRecords), 3, command.replace("a".repeat(64), "b".repeat(64)))).toEqual([]);
  expect(agyApprovalEvidence(lines([agyRecords[0], {...agyRecords[1],type:"PLANNER_RESPONSE"}]), 3, command)).toEqual([]);
  expect(agyApprovalEvidence(lines([agyRecords[0], {...agyRecords[1],status:"RUNNING"}]), 3, command)).toEqual([]);
  expect(agyApprovalEvidence(lines([agyRecords[0], {...agyRecords[1],error:"generic failure"}]), 3, command)).toEqual([]);
  expect(agyApprovalEvidence(lines([agyRecords[1]]), 3, command)).toEqual([]);
});

const agyPrompt = `Reason: reviewed candidate\r\nRequesting permission for:\r\n   ${command}\r\n\r\nRun this command?\r\n> 1. Yes, run command\r\n  4. No, cancel\r\n`;

test("agy approval screen selects the exact command and native permission choices", () => {
  expect(agyApprovalPrompt(agyPrompt, command)).toBe(true);
  expect(agyApprovalPrompt(agyPrompt, command.replace("a".repeat(64), "b".repeat(64)))).toBe(false);
  expect(agyApprovalPrompt(`The model says: request permission for ${command}`, command)).toBe(false);
  expect(agyApprovalPrompt(agyPrompt.replace("4. No, cancel", ""), command)).toBe(false);
  expect(agyApprovalPrompt(`${agyPrompt}Requesting permission for:\nother command`, command)).toBe(false);
});

test("agy shell output accepts native ANSI/prefix rendering and excludes command echoes", () => {
  expect(agyShellOutput("\x1b[34;1m  ⎿  \x1b[37;22mPREGATE_HUMAN_SHELL_OK\x1b[m\x1b[K\r\n", "PREGATE_HUMAN_SHELL_OK")).toBe(true);
  expect(agyShellOutput(`  Digest: ${"a".repeat(64)}\r\n`, `Digest: ${"a".repeat(64)}`)).toBe(true);
  expect(agyShellOutput("! printf 'PREGATE_HUMAN_SHELL_OK\\n'", "PREGATE_HUMAN_SHELL_OK")).toBe(false);
  expect(agyShellOutput("The model says PREGATE_HUMAN_SHELL_OK", "PREGATE_HUMAN_SHELL_OK")).toBe(false);
  expect(agyShellOutput("Approved contract applied and lock compiled. (ctrl+o to expand)", "Approved contract applied and lock compiled.")).toBe(true);
  expect(agyShellOutput(`Digest: ${"a".repeat(64)}`, `Digest: ${"b".repeat(64)}`)).toBe(false);
});

test("Codex approval evidence joins native output to the current session, turn and call", () => {
  expect(codexApprovalEvidence(lines(transcript), "session", "turn", command)).toEqual({ denials: [denial], complete: true });
});

test("Codex human shell evidence selects native execution, exact command, project and exit", () => {
  const text = `<user_shell_command>\n<command>\n${command}\n</command>\n<result>\nExit code: 0\nDuration: 0.01 seconds\nOutput:\nApplied\n\n</result>\n</user_shell_command>`;
  const message = {type:"response_item",payload:{type:"message",role:"user",content:[{type:"input_text",text}],
    internal_chat_message_metadata_passthrough:{content_item_kinds:["shell.user_command"]}},metadata:{client_authored:false}};
  const rows = [{type:"session_meta",payload:{cwd:"repo"}},message];
  expect(codexShellOutput(lines(rows),"repo",command,"Applied",0)).toBe(true);
  expect(codexShellOutput(lines([rows[0],{...message,metadata:undefined}]),"repo",command,"Applied",0)).toBe(true);
  expect(codexShellOutput(lines(rows),"other",command,"Applied",0)).toBe(false);
  expect(codexShellOutput(lines(rows),"repo","other command","Applied",0)).toBe(false);
  expect(codexShellOutput(lines(rows),"repo",command,"Other",0)).toBe(false);
  expect(codexShellOutput(lines(rows),"repo",command,"Applied",1)).toBe(false);
  expect(codexShellOutput(lines([rows[0],{...message,metadata:{client_authored:true}}]),"repo",command,"Applied",0)).toBe(false);
  expect(codexShellOutput(lines([rows[0],{...message,payload:{...message.payload,role:"assistant"}}]),"repo",command,"Applied",0)).toBe(false);
  expect(codexShellOutput(lines([rows[0],{...message,payload:{...message.payload,internal_chat_message_metadata_passthrough:{content_item_kinds:[]}}}]),"repo",command,"Applied",0)).toBe(false);
  expect(codexShellOutput(lines([message]),"repo",command,"Applied",0)).toBe(false);
});

test.each([
  ["different session", "other", "turn", command],
  ["different turn", "session", "other", command],
  ["different digest", "session", "turn", command.replace("a".repeat(64), "b".repeat(64))],
])("Codex approval evidence excludes %s", (_, session, turn, cmd) => {
  expect(codexApprovalEvidence(lines(transcript), session, turn, cmd).denials).toEqual([]);
});

test("Codex approval evidence does not accept a model-written denial", () => {
  expect(codexApprovalEvidence(lines([transcript[0], transcript[1], {
    type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: denial }] },
  }]), "session", "turn", command)).toEqual({ denials: [], complete: false });
});

test.each([true, undefined])("Codex approval evidence requires native output provenance (%p)", (authored) => {
  const rows = [transcript[0], transcript[1], { ...transcript[2], metadata: { client_authored: authored } }];
  expect(codexApprovalEvidence(lines(rows), "session", "turn", command).denials).toEqual([]);
});

test("Codex approval evidence rejects output for another call", () => {
  const rows = [transcript[0], transcript[1], { ...transcript[2], payload: { ...transcript[2]!.payload, call_id: "other" } }];
  expect(codexApprovalEvidence(lines(rows), "session", "turn", command).denials).toEqual([]);
});

test("Codex approval evidence rejects an earlier output even if the call ID repeats", () => {
  const rows = [transcript[0], transcript[1], { ...transcript[2], payload: { ...transcript[2]!.payload,
    internal_chat_message_metadata_passthrough: { turn_id: "earlier" } } }];
  expect(codexApprovalEvidence(lines(rows), "session", "turn", command).denials).toEqual([]);
});

test("Codex approval evidence rejects a generic failure without the exact command", () => {
  const rows = [transcript[0], transcript[1], { ...transcript[2], payload: { ...transcript[2]!.payload,
    output: [{ type: "input_text", text: "Command blocked by PreToolUse hook: PREGATE: denied" }] } }];
  expect(codexApprovalEvidence(lines(rows), "session", "turn", command).denials).toEqual([]);
});

test("Codex approval evidence tolerates an unfinished record without inventing completion", () => {
  const raw = `${lines(transcript.slice(0, 3))}\nnull\n[]\n{\"type\":`;
  expect(codexApprovalEvidence(raw, "session", "turn", command)).toEqual({ denials: [denial], complete: false });
});

test("real harness evidence selects new legacy and dated events through the storage inventory", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-real-evidence-"));
  const put = (path: string, callId: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    // This test exercises file selection, not CallEvent schema validation.
    writeFileSync(join(root, path), JSON.stringify({ callId }));
  };
  inScratch(root, () => {
    const legacy = "sessions/one/events/new-legacy.json";
    const dated = "sessions/two/events/2026-10-04/new-dated.json";
    const ignored = "sessions/one/events/not-a-date/hidden.json";
    const metadata = "sessions/two/snapshot.json";
    put(legacy, "legacy"); put(dated, "dated");
    put("sessions/one/events/old-legacy.json", "old");
    put("sessions/two/events/2026-10-03/old-dated.json", "old-dated");
    put(ignored, "ignored"); put(metadata, "metadata");
    expect(newEvents(root, [legacy, dated, ignored, metadata]).map((event) => event.callId).sort()).toEqual(["dated", "legacy"]);
    expect(newEvents(root, []).length).toBe(0);
    expect(newEvents(join(root, "absent"), []).length).toBe(0);
  });
});

function inScratch(dir: string, use: () => void): void {
  try { use(); } finally { removeTree(dir); }
}
