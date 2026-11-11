// A scripted stand-in for `claude` and `codex`, for `scripts/session-trial.ts --self-check` only. It
// is not a model. It takes the headless argv of the real CLI, reads the hooks that `pregate setup`
// registered in the isolated machine (~/.claude/settings.json, $CODEX_HOME/hooks.json), and plays one
// fixed session: SessionStart, a first draft that the default contract denies followed by a compliant
// one, one compliant file, Stop. A file is written only when no hook denies the call, as the real
// CLIs do. Where no hook is registered (the control arm) the first draft is written.
//
// Usage (through the shims the self-check puts on PATH): bun session-trial-fake.ts <claude-code|codex> <argv of the CLI…>
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { HARNESSES } from "../src/harness/profile.ts";

type Fake = "claude-code" | "codex";
interface Group { matcher?: string; hooks?: { command?: string }[] }
interface Reply { denied: boolean; code: number | null; text: string }

export const FAKE_PROMPT = "Add a parseCount function in src/parse.ts that reads a count from text, and a formatCount function in src/format.ts that prints one.";
export const FAKE_MODEL = "scripted-stand-in";
// The first draft swallows an error in an empty handler; the second does the same work without one.
const DRAFT = ["export function parseCount(text: string): number {", "  try {", "    return Number(JSON.parse(text));", `  } catch ${"{}"}`, "  return 0;", "}", ""].join("\n");
const REPAIR = ["export function parseCount(text: string): number {", "  const match = /^\\d+$/.exec(text.trim());", "  return match === null ? 0 : Number(match[0]);", "}", ""].join("\n");
const FORMAT = ["export function formatCount(count: number): string {", "  return `${count} items`;", "}", ""].join("\n");
const STEPS: { file: string; attempts: string[] }[] = [{ file: "src/parse.ts", attempts: [DRAFT, REPAIR] }, { file: "src/format.ts", attempts: [FORMAT] }];

function registered(fake: Fake, event: string, tool: string | null): string[] {
  const file = fake === "codex" ? join(process.env.CODEX_HOME ?? join(process.env.HOME!, ".codex"), "hooks.json") : join(process.env.HOME!, ".claude", "settings.json");
  if (!existsSync(file)) return [];
  const groups = (JSON.parse(readFileSync(file, "utf8")) as { hooks?: Record<string, Group[]> }).hooks?.[event] ?? [];
  const matches = (g: Group) => tool === null || g.matcher === undefined || g.matcher === "" || g.matcher === "*" || new RegExp(g.matcher).test(tool);
  return groups.filter(matches).flatMap((g) => (g.hooks ?? []).flatMap((h) => (typeof h.command === "string" ? [h.command] : [])));
}

// Runs every registered command of the event with the payload on stdin. Exit 2, or a JSON reply
// that denies or blocks, is a refusal: the two forms the real CLIs honor.
function hook(fake: Fake, event: string, tool: string | null, payload: Record<string, unknown>): Reply {
  let reply: Reply = { denied: false, code: 0, text: "" };
  for (const command of registered(fake, event, tool)) {
    const r = Bun.spawnSync(["/bin/sh", "-c", command], { cwd: process.cwd(), env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() }, stdin: Buffer.from(`${JSON.stringify(payload)}\n`), stdout: "pipe", stderr: "pipe", timeout: 60_000 });
    const text = r.stdout.toString() + r.stderr.toString();
    const said = /"permissionDecision"\s*:\s*"deny"|"decision"\s*:\s*"block"/.test(r.stdout.toString());
    reply = { denied: reply.denied || r.exitCode === 2 || said, code: r.exitCode, text: reply.text + text };
  }
  return reply;
}

function session(fake: Fake): { base: Record<string, unknown>; edit: (file: string, content: string, n: number) => Record<string, unknown>; tool: string } {
  const id = randomUUID(), cwd = process.cwd();
  if (fake === "claude-code") {
    const base = { session_id: id, transcript_path: join(process.env.HOME!, ".claude", "projects", `${id}.jsonl`), cwd, permission_mode: "acceptEdits" };
    return { base, tool: "Write", edit: (file, content, n) => ({ ...base, hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: join(cwd, file), content }, tool_use_id: `toolu_fake${n}` }) };
  }
  const base = { session_id: id, turn_id: randomUUID(), transcript_path: join(process.env.HOME!, ".codex", "sessions", `${id}.jsonl`), cwd, model: FAKE_MODEL, permission_mode: "bypassPermissions" };
  const patch = (file: string, content: string) => `*** Begin Patch\n*** Add File: ${join(cwd, file)}\n${content.trimEnd().split("\n").map((line) => `+${line}`).join("\n")}\n*** End Patch\n`;
  return { base, tool: "apply_patch", edit: (file, content, n) => ({ ...base, hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { command: patch(file, content) }, tool_use_id: `call_fake${n}` }) };
}

function play(fake: Fake): void {
  const s = session(fake);
  const say = (line: Record<string, unknown>) => console.log(JSON.stringify(line));
  say({ type: "system", subtype: "init", model: FAKE_MODEL, session_id: s.base.session_id });
  hook(fake, "SessionStart", null, { ...s.base, hook_event_name: "SessionStart", source: "startup" });
  let n = 0;
  for (const step of STEPS) {
    for (const content of step.attempts) {
      const reply = hook(fake, "PreToolUse", s.tool, s.edit(step.file, content, ++n));
      say({ type: "tool", tool: s.tool, file: step.file, denied: reply.denied, hook: reply.text.slice(0, 400) });
      if (reply.denied) continue;
      mkdirSync(dirname(join(process.cwd(), step.file)), { recursive: true });
      writeFileSync(join(process.cwd(), step.file), content);
      break;
    }
  }
  const stop = hook(fake, "Stop", null, { ...s.base, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "done" });
  say({ type: "result", stop: stop.text.slice(0, 400) });
}

// `codex app-server`, which `pregate setup` uses to record hook trust, never reaches this file: the
// shim sends it to test/fixtures/codex-app-server.ts, which keeps Codex's trust rules.
function main(argv: string[]): number {
  const [fake, ...args] = argv;
  if (fake !== "claude-code" && fake !== "codex") { console.error("usage: session-trial-fake.ts <claude-code|codex> <argv>"); return 2; }
  if (args[0] === "--version") { console.log(fake === "codex" ? `codex-cli ${HARNESSES.codex.VERIFIED}` : `${HARNESSES["claude-code"].VERIFIED} (Claude Code)`); return 0; }
  const prompt = fake === "codex" ? args.at(-1) : args[args.indexOf("-p") + 1];
  if (prompt !== FAKE_PROMPT) { console.error(`the stand-in plays one prompt only; it got: ${String(prompt).slice(0, 200)}`); return 2; }
  play(fake);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
