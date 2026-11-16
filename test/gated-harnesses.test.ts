import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gatedHarnesses } from "../src/machine.ts";
import { slash } from "../src/paths.ts";
import { agyPlugin, merge } from "../src/register.ts";
import { removeTree } from "./remove-tree.ts";

// Global registrations are user-level files. A project file that mentions pregate must not make
// those harnesses look ungated, and Cursor is gated by the shared Claude settings it imports.
const names = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "CODEX_HOME", "GROK_HOME", "CLAUDE_CONFIG_DIR"] as const;
const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
let area: string | null = null;

afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  if (area !== null) removeTree(area);
  area = null;
});

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function install(): { home: string; root: string } {
  area = mkdtempSync(join(tmpdir(), "gated-harness-"));
  const home = join(area, "home");
  process.env.HOME = home;
  process.env.XDG_DATA_HOME = join(area, "data");
  process.env.XDG_STATE_HOME = join(area, "state");
  delete process.env.CODEX_HOME;
  delete process.env.GROK_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  const data = slash(join(process.env.XDG_DATA_HOME, "pregate"));
  put(join(home, ".claude/settings.json"), merge(null, "shared", data)!);
  const hooks = slash(join(home, ".codex/hooks.json"));
  put(hooks, merge(null, "codex", data)!);
  const events = ["pre_tool_use", "stop", "session_start", "subagent_start", "subagent_stop"];
  const trust: Record<string, string> = {};
  const tables = events.map((event) => {
    const key = `${hooks}:${event}:0:0`;
    trust[key] = "sha256:fixture";
    return `[hooks.state."${key}"]\ntrusted_hash = "sha256:fixture"\n`;
  });
  put(join(home, ".codex/config.toml"), `${tables.join("\n")}\n`);
  put(join(process.env.XDG_STATE_HOME, "pregate/codex-trust.json"), `${JSON.stringify(trust)}\n`);
  for (const [name, text] of Object.entries(agyPlugin(data, "0.0.10"))) put(join(home, ".gemini/config/plugins/pregate-global", name), text);
  const root = join(area, "repo");
  put(join(root, ".agents/plugins.json"), '{"note":"mentions pregate and must not ungate claude"}\n');
  return { home, root };
}

test("global claude, codex and agy hooks gate every alias, including cursor, despite a project file that names pregate", () => {
  const { root } = install();
  const gated = gatedHarnesses(root);
  for (const name of ["claude", "claude-code", "codex", "agy", "antigravity", "cursor", "cursor-agent", "agent", "grok"]) {
    expect(gated.has(name), name).toBe(true);
  }
  expect(gated.has("opencode")).toBe(false);
  expect(gated.has("gemini")).toBe(false);
});

test("a project disableAllHooks drops Claude, Cursor and Grok and leaves Codex and agy gated", () => {
  const { root } = install();
  put(join(root, ".claude/settings.json"), '{"disableAllHooks":true}\n');
  const gated = gatedHarnesses(root);
  expect(gated.has("claude")).toBe(false);
  expect(gated.has("cursor-agent")).toBe(false);
  expect(gated.has("grok")).toBe(false);
  expect(gated.has("codex")).toBe(true);
  expect(gated.has("agy")).toBe(true);
});
