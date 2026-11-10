import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeReleased } from "./remove-tree.ts";

// The front door: one command with no mode flag leaves a new project in advisor. An edit that
// breaks an advisor rule is explained and written; after the human promotes that rule, the same
// edit is denied before the write. The compiled engine answers a real Claude Code Write payload.
setDefaultTimeout(60_000);

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-advisor-first-")));
// The engine's installation tree is protected from agent writes, so it gets a directory of its own.
const installed = canonical(mkdtempSync(join(tmpdir(), "pregate-advisor-first-engine-")));
const binary = join(installed, "bin", ENGINE_FILE);
beforeAll(() => compileBinary(hostTarget(), binary, true), 120_000);
afterAll(() => { removeReleased(area); removeReleased(installed); }, 40_000);

const SOURCES: Record<string, string> = {
  "package.json": '{"name":"shop","type":"module"}\n',
  "tsconfig.json": '{"compilerOptions":{"strict":true}}\n',
  "src/domain/order.ts": "export interface Order { id: string }\nexport const empty: Order = { id: \"\" };\n",
  "src/infra/db.ts": 'import type { Order } from "../domain/order.ts";\nexport function saveOrder(order: Order): string { return order.id; }\n',
};
const BREAKS_THE_LAYER = 'import { saveOrder } from "../infra/db.ts";\nexport const price = saveOrder({ id: "1" });\n';

function project() {
  const root = join(area, "repo"), machine = join(area, "machine");
  for (const [rel, text] of Object.entries(SOURCES)) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); }
  const env = { ...process.env, HOME: join(machine, "home"), USERPROFILE: join(machine, "home"), CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"),
    CLAUDE_CONFIG_DIR: join(machine, "claude"), XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
  const run = (command: string[], input?: string) => {
    const result = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 30_000, ...(input === undefined ? {} : { stdin: Buffer.from(input) }) });
    return { code: result.exitCode, stdout: result.stdout.toString(), text: result.stdout.toString() + result.stderr.toString() };
  };
  const cli = (...args: string[]) => run([binary, ...args]);
  const git = (...args: string[]) => run(["git", ...args]);
  git("init", "-q"); git("config", "user.name", "t"); git("config", "user.email", "t@example.com"); git("config", "commit.gpgsign", "false");
  git("add", "-A"); git("commit", "-qm", "base");
  const approve = (review: string) => cli("approve", "--yes", "--digest", review.match(/Digest: ([0-9a-f]{64})/)![1]!);
  const write = (rel: string, content: string) => run([binary, "hook", "pre", "--harness", "claude-code"], JSON.stringify({
    session_id: randomUUID(), cwd: root, hook_event_name: "PreToolUse", permission_mode: "acceptEdits",
    tool_name: "Write", tool_use_id: `toolu_${randomUUID()}`, tool_input: { file_path: join(root, rel), content } }) + "\n");
  return { root, cli, approve, write };
}

test("guide with no mode flag sets up advisor: a breaking edit is explained and written, and blocked once the rule is promoted", () => {
  const p = project();
  const review = p.cli("guide", "--preview");
  expect(review.code, review.text).toBe(0);
  expect(review.text).toContain("Mode: advisor — the agent sees findings; nothing blocks.");
  expect(review.text).toMatch(/Rules: 0 block, \d+ advise, 0 observe\./);
  expect(review.text).toContain("Layers to review: domain (core; imports no other layer); infra (adapter; may import domain).");
  const applied = p.approve(review.text);
  expect(applied.code, applied.text).toBe(0);

  const advised = p.write("src/domain/price.ts", BREAKS_THE_LAYER);
  expect(advised.code, advised.text).toBe(0);
  expect(advised.text).toContain("PREGATE ADVISOR");
  expect(advised.text).toContain("architecture/CA-DEP-001");
  expect(advised.text).not.toContain('"permissionDecision":"deny"');
  expect(existsSync(join(p.root, "src/domain/price.ts"))).toBe(false);   // Pre judges the proposal; the harness performs the write

  const audit = p.cli("audit");
  expect(audit.text).toContain("Ready to promote to enforce");
  expect(audit.text).toContain("pregate promote --preview");
  const promotion = p.cli("promote", "--rule", "architecture/CA-DEP-001", "--preview");
  expect(promotion.code, promotion.text).toBe(0);
  expect(p.approve(promotion.text).code).toBe(0);

  const denied = p.write("src/domain/price.ts", BREAKS_THE_LAYER);
  expect(denied.code, denied.text).toBe(2);
  const decision = JSON.parse(denied.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } };
  expect(decision.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(decision.hookSpecificOutput.permissionDecisionReason).toContain("architecture/CA-DEP-001");
  const allowed = p.write("src/domain/price.ts", "export const price = 1;\n");
  expect(allowed.code, allowed.text).toBe(0);
  expect(allowed.text).not.toContain("CA-DEP-001");
});
