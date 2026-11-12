import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { profile } from "../../src/harness/profile.ts";
import { ENV } from "./contract.ts";

// MH-03 over real payloads: the payload names Cursor and Grok, the flag names everyone else.

const payload = (name: string): string => readFileSync(`${import.meta.dir}/../payloads/${name}`, "utf8");
const GROK = { ...ENV, grokEvent: "pre_tool_use" };

test("Cursor: a top-level cursor_version, whatever the flag", () => {
  expect(profile("claude-code", payload("cursor/claude-import-pre-write.json"), ENV)).toBe("cursor");
});

test("Grok: GROK_HOOK_EVENT and a top-level hookEventName", () => {
  expect(profile("claude-code", payload("grok/pre-write.json"), GROK)).toBe("grok");
  expect(profile("claude-code", payload("grok/pre-write.json"), ENV)).toBe("claude-code");
});

test("GROK_HOOK_EVENT leaked into another harness: the flag", () => {
  expect(profile("claude-code", payload("pre-write.json"), GROK)).toBe("claude-code");
  expect(profile("codex", payload("codex/pre-bash.json"), GROK)).toBe("codex");
  expect(profile("agy", payload("agy/pre-write_file.json"), GROK)).toBe("agy");
});

test("cursor_version inside the content of a Write: still Claude Code", () => {
  const p = JSON.parse(payload("pre-write.json")) as { tool_input: { content: string } };
  p.tool_input.content = '{"cursor_version":"2026.09.26","hookEventName":"x"}';
  expect(profile("claude-code", JSON.stringify(p), GROK)).toBe("claude-code");
});

test("Codex and agy: only the flag identifies them", () => {
  expect(profile("codex", payload("codex/pre-apply-patch-add-update.json"), ENV)).toBe("codex");
  expect(profile("agy", payload("agy/pre-write_to_file.json"), ENV)).toBe("agy");
});

test("stdin that is not a JSON object: the flag", () => {
  for (const raw of ["", "garbage", "[]", "null"]) expect(profile("agy", raw, GROK)).toBe("agy");
});
