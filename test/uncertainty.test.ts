import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formText, UNCERTAINTY_CAUSES } from "../src/message.ts";
import { uncertaintyAllows, uncertaintyOpen } from "../src/uncertainty.ts";
import type { Cause } from "../src/types.ts";

test("only the exact JSON string open opts out", () => {
  expect(uncertaintyOpen('{"uncertainty":"open"}')).toBe(true);
  expect(uncertaintyOpen('{"uncertainty": "open", "name": "x"}')).toBe(true);
  expect(uncertaintyOpen("{}")).toBe(false);
  expect(uncertaintyOpen('{"uncertainty":"closed"}')).toBe(false);
  expect(uncertaintyOpen('{"uncertainty":"OPEN"}')).toBe(false);
  expect(uncertaintyOpen('{"note":"uncertainty open"}')).toBe(false);
  expect(uncertaintyOpen("{")).toBe(false);
});

test("a missing preset stays closed and one open preset allows only that tree", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-uncertainty-"));
  const project = join(root, "repo");
  const child = join(project, "src");
  mkdirSync(child, { recursive: true });
  expect(uncertaintyAllows([project])).toBe(false);
  mkdirSync(join(project, ".pregate"));
  writeFileSync(join(project, ".pregate/preset.json"), '{"uncertainty":"closed"}\n');
  expect(uncertaintyAllows([child])).toBe(false);
  writeFileSync(join(project, ".pregate/preset.json"), '{"uncertainty":"open"}\n');
  expect(uncertaintyAllows([child])).toBe(true);
  mkdirSync(join(project, ".git"));
  const other = join(root, "other");
  mkdirSync(join(other, ".git"), { recursive: true });
  expect(uncertaintyAllows([child, other])).toBe(false);
});

test("unclassified deny lines name the override and stay inside the harness line", () => {
  for (const cause of UNCERTAINTY_CAUSES) {
    const text = formText({ cause, line: null }, null);
    expect(text.compact).toContain("uncertainty");
    expect(text.compact.length).toBeLessThanOrEqual(cause === "payload-unrecognized" ? 242 : 256);
    expect(text.full).toContain("does not turn protection off");
    const labeled = text.compact.replace("payload-unrecognized", "payload-unrecognized (claude-code)");
    expect(labeled.length).toBeLessThanOrEqual(256);
  }
  const kept = ["protected-path", "shell-admin", "shell-write", "syntax"] as const satisfies readonly Cause[];
  for (const cause of kept) expect(formText({ cause, line: null }, null).compact).not.toContain("uncertainty");
});
