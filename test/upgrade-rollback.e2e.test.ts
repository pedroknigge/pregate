import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import pkg from "../package.json" with { type: "json" };
import { hostTarget } from "../scripts/build.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeReleased } from "./remove-tree.ts";

// The documented upgrade and rollback of one pinned project, with two real engines that differ only
// in version. The approved rules and the verdict on the same edit hold across the upgrade, and the
// rollback (revert the contract commit, run the previous engine) restores the first committed
// contract. docs/guides/maintenance.md states this procedure.
setDefaultTimeout(120_000);

const OLD = "9.9.7", NEW = "9.9.8";
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-upgrade-rollback-")));
// An engine's installation tree is protected from agent writes, so the engines sit outside the project.
const engines = canonical(mkdtempSync(join(tmpdir(), "pregate-upgrade-rollback-engines-")));
const engine = (version: string) => join(engines, version, "bin", ENGINE_FILE);

async function build(version: string): Promise<void> {
  mkdirSync(dirname(engine(version)), { recursive: true });
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "..", "src", "main.ts")], target: "bun", minify: true,
    define: { PREGATE_TEST_BUILD: "true" },
    compile: { target: `bun-${hostTarget()}`, outfile: engine(version), autoloadDotenv: false, autoloadBunfig: false },
    plugins: [{ name: "engine-version", setup(b) {
      b.onLoad({ filter: /[\\/]package\.json$/ }, (args) => args.path === join(import.meta.dir, "..", "package.json")
        ? { loader: "json", contents: JSON.stringify({ ...pkg, version }) } : undefined);
    } }],
  });
  if (!built.success) throw new Error(built.logs.map((log) => log.message).join("\n"));
  chmodSync(engine(version), 0o755);
}

beforeAll(async () => { await build(OLD); await build(NEW); }, 240_000);
afterAll(() => { removeReleased(area); removeReleased(engines); }, 40_000);

const SOURCES: Record<string, string> = {
  "package.json": '{"name":"shop","type":"module"}\n',
  "tsconfig.json": '{"compilerOptions":{"strict":true}}\n',
  "src/domain/order.ts": "export interface Order { id: string }\nexport const empty: Order = { id: \"\" };\n",
  "src/infra/db.ts": 'import type { Order } from "../domain/order.ts";\nexport function saveOrder(order: Order): string { return order.id; }\n',
};
const BREAKS_THE_LAYER = 'import { saveOrder } from "../infra/db.ts";\nexport const price = saveOrder({ id: "1" });\n';
const LOCK = ".pregate/pregate.lock.json";

function project() {
  const root = join(area, "repo"), machine = join(area, "machine");
  for (const [rel, text] of Object.entries(SOURCES)) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); }
  const env = { ...process.env, HOME: join(machine, "home"), USERPROFILE: join(machine, "home"), CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"),
    CLAUDE_CONFIG_DIR: join(machine, "claude"), XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
  const run = (command: string[], input?: string) => {
    const result = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 60_000, ...(input === undefined ? {} : { stdin: Buffer.from(input) }) });
    return { code: result.exitCode, stdout: result.stdout.toString(), text: result.stdout.toString() + result.stderr.toString() };
  };
  const git = (...args: string[]) => run(["git", ...args]);
  git("init", "-q"); git("config", "user.name", "t"); git("config", "user.email", "t@example.com"); git("config", "commit.gpgsign", "false");
  git("add", "-A"); git("commit", "-qm", "base");
  const cli = (version: string, ...args: string[]) => run([engine(version), ...args]);
  const approve = (version: string, review: string) => cli(version, "approve", "--yes", "--digest", review.match(/Digest: ([0-9a-f]{64})/)![1]!);
  // The verdict of one engine on the edit that breaks the approved layer rule.
  const verdict = (version: string) => {
    const out = run([engine(version), "hook", "pre", "--harness", "claude-code"], `${JSON.stringify({
      session_id: randomUUID(), cwd: root, hook_event_name: "PreToolUse", permission_mode: "acceptEdits",
      tool_name: "Write", tool_use_id: `toolu_${randomUUID()}`, tool_input: { file_path: join(root, "src/domain/price.ts"), content: BREAKS_THE_LAYER } })}\n`);
    const reason = out.code === 2 ? (JSON.parse(out.stdout) as { hookSpecificOutput: { permissionDecisionReason: string } }).hookSpecificOutput.permissionDecisionReason : "";
    return { code: out.code, rules: [...reason.matchAll(/\b[a-z-]+\/[A-Z]+(?:-[A-Z0-9]+)+\b/g)].map((m) => m[0]).sort(), text: out.text };
  };
  const lock = () => readFileSync(join(root, LOCK), "utf8");
  const rules = () => (JSON.parse(lock()) as { engine: string; rules: unknown[] });
  return { root, git, cli, approve, verdict, lock, rules };
}

test("a pinned project is upgraded and rolled back with the same rules and the same verdict", () => {
  const p = project();
  expect(p.cli(OLD, "--version").text).toContain(OLD);
  expect(p.cli(NEW, "--version").text).toContain(NEW);

  // The project is set up and enforced by the old engine.
  const review = p.cli(OLD, "guide", "--preview", "--enforcement", "enforce");
  expect(review.code, review.text).toBe(0);
  expect(p.approve(OLD, review.text).code).toBe(0);
  const first = p.lock(), before = p.verdict(OLD);
  expect(p.rules().engine).toBe(OLD);
  expect(before.code, before.text).toBe(2);
  expect(before.rules).toContain("architecture/CA-DEP-001");
  const contract = p.git("rev-parse", "HEAD").stdout.trim();

  // Upgrade: the new engine prepares one review that changes the pin and no rule; a human approves it.
  const update = p.cli(NEW, "update", "--project", "--preview");
  expect(update.code, update.text).toBe(0);
  expect(update.text).toContain(`Engine: ${OLD} -> ${NEW}`);
  expect(update.text).toContain("No effective rule changes");
  expect(p.approve(NEW, update.text).code).toBe(0);
  expect(p.rules().engine).toBe(NEW);
  expect(p.rules().rules).toEqual(JSON.parse(first).rules);
  const upgraded = p.verdict(NEW);
  expect(upgraded.code, upgraded.text).toBe(2);
  expect(upgraded.rules).toEqual(before.rules);

  // Rollback: revert the commit the approval made, then run the previous engine again.
  const approval = p.git("rev-parse", "HEAD").stdout.trim();
  expect(approval).not.toBe(contract);
  expect(p.git("diff", "--name-only", contract, approval).stdout.trim().split("\n").every((path) => path.startsWith(".pregate/"))).toBe(true);
  const reverted = p.git("revert", "--no-edit", approval);
  expect(reverted.code, reverted.text).toBe(0);
  // The committed contract is the first one, object for object. The working copy is compared
  // without line endings: Git for Windows may check a text file out with CRLF.
  for (const file of [LOCK, ".pregate/preset.json"]) expect(p.git("rev-parse", `HEAD:${file}`).stdout, file).toBe(p.git("rev-parse", `${contract}:${file}`).stdout);
  expect(p.lock().replaceAll("\r\n", "\n")).toBe(first.replaceAll("\r\n", "\n"));
  const restored = p.verdict(OLD);
  expect(restored.code, restored.text).toBe(2);
  expect(restored.rules).toEqual(before.rules);
  expect(p.cli(OLD, "check", "--all").code).toBe(0);
});
