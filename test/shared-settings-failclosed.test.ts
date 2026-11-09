import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { merge } from "../src/register.ts";
import { DATA } from "./fixtures/hook-command.ts";

const obj = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const CLAUDE = readFileSync(join(import.meta.dir, "fixtures/configs/claude-settings.json"), "utf8");
const CURSOR_DENY_MATRIX = JSON.parse(
  readFileSync(join(import.meta.dir, "payloads/cursor/deny-matrix.observed.json"), "utf8"),
) as { hook_behaviour: string; result: { success?: unknown; error?: unknown } }[];

// Evidence for writing failClosed on the shared ~/.claude/settings.json registration.

test("merge keeps foreign PreToolUse groups and group-level keys when PREGATE adds failClosed", () => {
  const merged = obj(merge(CLAUDE, "shared", DATA)!) as { hooks: { PreToolUse: { hooks: { failClosed?: boolean }[] }[] } };
  const isOurs = (g: unknown) => JSON.stringify(g).includes(`'${DATA}/bin/pregate'`);
  const foreign = merged.hooks.PreToolUse.filter((g) => !isOurs(g));
  expect(foreign.length).toBeGreaterThan(0);
  const ours = merged.hooks.PreToolUse.at(-1)!;
  expect(ours.hooks[0]!.failClosed).toBe(true);
  expect(JSON.stringify(foreign)).not.toContain("failClosed");
});

test("Cursor native preToolUse: failClosed true blocks hook crash and timeout (real capture)", () => {
  const failOpen = CURSOR_DENY_MATRIX.find((r) => r.hook_behaviour === "exit 1 (crash), failClosed false");
  const failClosed = CURSOR_DENY_MATRIX.find((r) => r.hook_behaviour === "exit 1, failClosed true");
  const timeoutOpen = CURSOR_DENY_MATRIX.find((r) => r.hook_behaviour === "sleep 8 s > timeout 3 s, failClosed false");
  const timeoutClosed = CURSOR_DENY_MATRIX.find((r) => r.hook_behaviour === "sleep 8 s > timeout 3 s, failClosed true");
  expect(failOpen?.result.success).toBeDefined();
  expect(failClosed?.result.error).toBeDefined();
  expect(timeoutOpen?.result.success).toBeDefined();
  expect(timeoutClosed?.result.error).toBeDefined();
});

test("Cursor imports Claude-format preToolUse payloads from ~/.claude/settings.json (real capture)", () => {
  const payload = readFileSync(join(import.meta.dir, "payloads/cursor/claude-import-pre-write.json"), "utf8");
  expect(payload).toContain('"hook_event_name":"preToolUse"');
  expect(payload).toContain('"tool_name":"Write"');
});
