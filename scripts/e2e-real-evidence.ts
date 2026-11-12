import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { eventFiles } from "../src/state.ts";
import type { CallEvent } from "../src/types.ts";

interface CodexRecord {
  type?: string;
  payload?: {
    type?: string; id?: string; name?: string; call_id?: string; input?: string; turn_id?: string; cwd?: string; role?: string;
    content?: {type?:string;text?:string}[];
    internal_chat_message_metadata_passthrough?: { turn_id?: string; content_item_kinds?: string[] };
    output?: { type?: string; text?: string }[];
  };
  metadata?: { client_authored?: boolean };
}

interface AgyRecord {
  type?: string; status?: string; step_index?: number; error?: string;
  tool_calls?: {name?:string;args?:{CommandLine?:string}}[];
}

export function agyApprovalEvidence(raw: string, step: number, command: string): string[] {
  const records = raw.split("\n").flatMap((line): AgyRecord[] => {
    try { const record = JSON.parse(line); return record && typeof record === "object" && !Array.isArray(record) ? [record] : []; }
    catch { return []; }
  });
  if (!records.some(r => r.type === "PLANNER_RESPONSE" && r.step_index === step - 1 &&
    r.tool_calls?.some(t => t.name === "run_command" && t.args?.CommandLine === command))) return [];
  return records.flatMap(r => r.type === "GENERIC" && r.status === "ERROR" && r.step_index === step
    && typeof r.error === "string" && r.error.startsWith("tool call denied by pre-tool hook: PREGATE:")
    && r.error.includes(`run ${command} in a separate terminal`) ? [r.error] : []);
}

// This selects a captured native permission screen, not an assistant's claim
// that approval was requested. The runner separately requires the exact hook call.
export function agyApprovalPrompt(screen: string, command: string): boolean {
  const lines = screen.split(/\r?\n/).map(line => line.trim());
  const request = lines.lastIndexOf("Requesting permission for:");
  if (request < 0 || lines[request + 1] !== command) return false;
  const choice = lines.slice(request + 2);
  return choice.includes("Run this command?") && choice.includes("> 1. Yes, run command")
    && choice.includes("4. No, cancel");
}

export function agyShellOutput(screen: string, expected: string): boolean {
  const plain = screen.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[\]P][^\x07\x1b]*(\x07|\x1b\\)/g, "");
  return plain.split(/\r?\n/).some(line => line.trim().replace(/^⎿\s*/, "").replace(/ \(ctrl\+o to expand\)$/, "") === expected);
}

// Observation only: native user-shell records bind the exact controller command
// to its fixture. They do not grant approval or constitute real user consent.
export function claudeShellInput(raw: string, repo: string, command: string): boolean {
  return raw.split("\n").some(line => {
    try {
      const row = JSON.parse(line), content = row.message?.content;
      return row.type === "user" && row.cwd === repo && row.message?.role === "user"
        && typeof content === "string"
        && /^<bash-input>([\s\S]*)<\/bash-input>$/.exec(content.trim())?.[1]?.trim() === command.trim();
    } catch { return false; }
  });
}

// Claude can independently inspect fitness after a human shell command. Only
// this exact read-only tool call is separate from the approval observations.
export function claudeFitnessInspection(input: Record<string, unknown> | null, launcher: string): boolean {
  return input?.tool_name === "Bash"
    && (input.tool_input as {command?:string} | undefined)?.command === `${launcher} fitness status --json 2>&1 | head -c 6000`;
}

// Native user-shell records distinguish executed commands from composer echoes
// and model-written claims. The runner reads only its isolated session inventory.
export function codexShellOutput(raw: string, repo: string, command: string, expected: string, exitCode: number): boolean {
  const rows = raw.split("\n").flatMap((line): CodexRecord[] => {
    try { const row = JSON.parse(line); return row && typeof row === "object" && !Array.isArray(row) ? [row] : []; }
    catch { return []; }
  });
  if (!rows.some(r => r.type === "session_meta" && r.payload?.cwd === repo)) return false;
  const prefix = `<user_shell_command>\n<command>\n${command}\n</command>\n<result>\nExit code: ${exitCode}\n`;
  return rows.some(r => r.type === "response_item" && r.payload?.type === "message" && r.payload.role === "user"
    && r.metadata?.client_authored !== true
    && r.payload.internal_chat_message_metadata_passthrough?.content_item_kinds?.includes("shell.user_command")
    && r.payload.content?.some(b => b.type === "input_text" && b.text?.startsWith(prefix)
      && b.text.endsWith("\n</result>\n</user_shell_command>")
      && b.text.split("\nOutput:\n")[1]?.split("\n</result>")[0]?.split("\n").includes(expected)));
}

// Match native tool output to this session, turn and call. A model message or
// an earlier turn's denial cannot prove that the current approval was blocked.
export function codexApprovalEvidence(raw: string, session: string, turn: string, command: string): { denials: string[]; complete: boolean } {
  const records = raw.split("\n").flatMap((line): CodexRecord[] => {
    try {
      const record = JSON.parse(line);
      return record !== null && typeof record === "object" && !Array.isArray(record) ? [record] : [];
    } catch { return []; }  // A live transcript can end with an unfinished record.
  });
  if (!records.some((r) => r.type === "session_meta" && r.payload?.id === session)) return { denials: [], complete: false };
  const calls = new Set(records.filter((r) => r.type === "response_item" && r.payload?.type === "custom_tool_call"
    && r.payload.name === "exec" && r.payload.internal_chat_message_metadata_passthrough?.turn_id === turn
    && typeof r.payload.input === "string" && r.payload.input.includes(command)
    && typeof r.payload.call_id === "string").map((r) => r.payload!.call_id));
  const denials = records.flatMap((r) => {
    if (r.type !== "response_item" || r.payload?.type !== "custom_tool_call_output" || !calls.has(r.payload.call_id)
      || r.payload.internal_chat_message_metadata_passthrough?.turn_id !== turn
      || r.metadata?.client_authored !== false || !Array.isArray(r.payload.output)) return [];
    return r.payload.output.flatMap((block) => block !== null && block.type === "input_text" && typeof block.text === "string"
      && block.text.includes("Command blocked by PreToolUse hook: PREGATE:") && block.text.includes(`Command: ${command}`) ? [block.text] : []);
  });
  const complete = records.some((r) => r.type === "event_msg" && r.payload?.type === "task_complete" && r.payload.turn_id === turn);
  return { denials, complete };
}

// Use the storage inventory, including legacy and dated events. New-file selection belongs
// to this run; previously observed records must not satisfy a later harness scenario.
export function newEvents(stateRoot: string, files: string[]): CallEvent[] {
  const sessions = join(stateRoot, "sessions");
  if (!existsSync(sessions)) return [];
  const selected = new Set(files.map((file) => join(stateRoot, file)));
  return readdirSync(sessions, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .flatMap((entry) => eventFiles(join(sessions, entry.name)))
    .filter((file) => selected.has(normalize(file)))
    .map((file) => JSON.parse(readFileSync(file, "utf8")) as CallEvent);
}
