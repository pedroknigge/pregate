import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decide } from "../src/decide.ts";
import { formText, UNCERTAINTY_CAUSES } from "../src/message.ts";
import { uncertaintyAllows, uncertaintyOpen } from "../src/uncertainty.ts";
import type { Cause } from "../src/types.ts";

test("only the exact JSON string closed opts in to denying", () => {
  expect(uncertaintyOpen('{"uncertainty":"closed"}')).toBe(false);
  expect(uncertaintyOpen('{"uncertainty": "closed", "name": "x"}')).toBe(false);
  expect(uncertaintyOpen("{}")).toBe(true);
  expect(uncertaintyOpen('{"uncertainty":"open"}')).toBe(true);
  expect(uncertaintyOpen('{"uncertainty":"CLOSED"}')).toBe(true);
  expect(uncertaintyOpen('{"note":"uncertainty closed"}')).toBe(true);
  expect(uncertaintyOpen("{")).toBe(true);
});

test("a missing preset stays open and one closed preset denies every call that names its tree", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-uncertainty-"));
  const project = join(root, "repo");
  const child = join(project, "src");
  mkdirSync(child, { recursive: true });
  expect(uncertaintyAllows([project])).toBe(true);
  mkdirSync(join(project, ".pregate"));
  writeFileSync(join(project, ".pregate/preset.json"), '{"uncertainty":"open"}\n');
  expect(uncertaintyAllows([child])).toBe(true);
  writeFileSync(join(project, ".pregate/preset.json"), "{}\n");
  expect(uncertaintyAllows([child])).toBe(true);
  writeFileSync(join(project, ".pregate/preset.json"), "{");
  expect(uncertaintyAllows([child])).toBe(true);
  writeFileSync(join(project, ".pregate/preset.json"), '{"uncertainty":"closed"}\n');
  expect(uncertaintyAllows([child])).toBe(false);
  mkdirSync(join(project, ".git"));
  const other = join(root, "other");
  mkdirSync(join(other, ".git"), { recursive: true });
  expect(uncertaintyAllows([other])).toBe(true);
  expect(uncertaintyAllows([other, child])).toBe(false);
});

// `pregate check` prints this text. A hook does not deny these causes, so no preset key is named as an override.
test("unclassified cause lines lead with the fix, name no override, and stay inside the harness line", () => {
  for (const cause of UNCERTAINTY_CAUSES) {
    const text = formText({ cause, line: null }, null);
    expect(text.compact.startsWith(`PREGATE DENY ${cause}: Fix: `)).toBe(true);
    expect(text.compact).not.toContain("uncertainty");
    expect(text.full).not.toContain("uncertainty");
    expect(text.compact.length).toBeLessThanOrEqual(cause === "payload-unrecognized" ? 242 : 256);
    const labeled = text.compact.replace("payload-unrecognized", "payload-unrecognized (claude-code)");
    expect(labeled.length).toBeLessThanOrEqual(256);
    const hook = decide({
      lock: null, lockHash: null, launcher: "pregate",
      session: { id: "s1", harness: "claude-code", agentId: null, turnId: "turn-1", interactive: true },
      event: "pre-edit", path: null, introduced: [], form: { cause, line: null }, protectedPath: false,
      history: [], turnDenials: 0, astHash: null, stop: null,
    });
    expect(hook).toMatchObject({ verdict: "none", halt: false, cause });
    expect(hook.compact).toStartWith(`PREGATE NOTE ${cause}: `);
    expect(hook.compact).toEndWith("Not blocked.");
  }
  const kept = ["protected-path", "shell-admin", "shell-write", "syntax"] as const satisfies readonly Cause[];
  for (const cause of kept) expect(formText({ cause, line: null }, null).compact).not.toContain("uncertainty");
});
