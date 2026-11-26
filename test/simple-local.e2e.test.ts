import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeReleased } from "./remove-tree.ts";

// A hook blocks on two things only: a rule the project enforces, and the agent acting on Pregate
// itself (its contract, its hooks, its consent, a human's approval). Everything else is one line
// and the call goes through. These are the situations of a real session that used to stop the
// agent: a merge that brought a looser contract, a lock another engine version wrote, a read of
// the contract folder, and the same advisory repeated on every edit of a file.
setDefaultTimeout(60_000);

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-simple-local-")));
const installed = canonical(mkdtempSync(join(tmpdir(), "pregate-simple-local-engine-")));
const binary = join(installed, "bin", ENGINE_FILE);
beforeAll(() => engineAt(binary, true), 120_000);
afterAll(() => { removeReleased(area); removeReleased(installed); }, 40_000);

const SOURCES: Record<string, string> = {
  "package.json": '{"name":"shop","type":"module"}\n',
  "tsconfig.json": '{"compilerOptions":{"strict":true}}\n',
  "src/domain/order.ts": "export interface Order { id: string }\nexport const empty: Order = { id: \"\" };\n",
  "src/infra/db.ts": 'import type { Order } from "../domain/order.ts";\nexport function saveOrder(order: Order): string { return order.id; }\n',
};
const BREAKS_THE_LAYER = 'import { saveOrder } from "../infra/db.ts";\nexport const price = saveOrder({ id: "1" });\n';

let seq = 0;
function project() {
  const base = join(area, `case-${++seq}`);
  const root = join(base, "repo"), machine = join(base, "machine");
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
  git("init", "-q", "-b", "main"); git("config", "user.name", "t"); git("config", "user.email", "t@example.com"); git("config", "commit.gpgsign", "false");
  git("add", "-A"); git("commit", "-qm", "base");
  const review = cli("guide", "--preview");
  expect(review.code, review.text).toBe(0);
  const applied = cli("approve", "--yes", "--digest", review.text.match(/Digest: ([0-9a-f]{64})/)![1]!);
  expect(applied.code, applied.text).toBe(0);
  git("add", "-A"); git("commit", "-qm", "enable pregate");
  const session = randomUUID();
  const hook = (kind: "pre" | "stop", payload: Record<string, unknown>) => run([binary, "hook", kind, "--harness", "claude-code"],
    JSON.stringify({ session_id: session, cwd: root, permission_mode: "acceptEdits", ...payload }) + "\n");
  const write = (rel: string, content: string) => hook("pre", { hook_event_name: "PreToolUse", tool_name: "Write", tool_use_id: `toolu_${randomUUID()}`, tool_input: { file_path: join(root, rel), content } });
  const bash = (command: string) => hook("pre", { hook_event_name: "PreToolUse", tool_name: "Bash", tool_use_id: `toolu_${randomUUID()}`, tool_input: { command } });
  const stop = () => hook("stop", { hook_event_name: "Stop", stop_hook_active: false });
  return { root, cli, git, write, bash, stop };
}

test("a merge that brings a looser contract does not block the end of the turn", () => {
  const p = project();
  expect(p.write("src/infra/note.ts", "export const note = 1;\n").code).toBe(0);
  // A collaborator widened scope.exclude on another branch, and it was reviewed there.
  p.git("switch", "-qc", "teammate");
  const presetFile = join(p.root, ".pregate/preset.json");
  const preset = JSON.parse(readFileSync(presetFile, "utf8")) as { scope: { exclude?: string[] } };
  preset.scope.exclude = [...(preset.scope.exclude ?? []), "videos/**", ".tmp/**"];
  writeFileSync(presetFile, `${JSON.stringify(preset, null, 2)}\n`);
  const compiled = p.cli("preset", "compile", "--yes");
  expect(compiled.code, compiled.text).toBe(0);
  p.git("add", "-A"); p.git("commit", "-qm", "exclude generated folders");
  p.git("switch", "-q", "main");
  const merged = p.git("merge", "-q", "--no-edit", "teammate");
  expect(merged.code, merged.text).toBe(0);

  const stopped = p.stop();
  expect(stopped.code, stopped.text).toBe(0);
  expect(stopped.text).not.toContain("PREGATE DENY");
  expect(stopped.stdout).not.toContain('"decision":"block"');
});

test("a lock another engine version wrote is judged from the preset instead of stopping the call", () => {
  const p = project();
  const lockFile = join(p.root, ".pregate/pregate.lock.json");
  writeFileSync(lockFile, readFileSync(lockFile, "utf8").replace(/"engine": ?"[^"]+"/, '"engine":"0.0.2"'));
  const edit = p.write("src/domain/price.ts", BREAKS_THE_LAYER);
  expect(edit.code, edit.text).toBe(0);
  expect(edit.text).not.toContain("version-mismatch");
  expect(edit.text).toContain("PREGATE ADVISOR");
  const stopped = p.stop();
  expect(stopped.code, stopped.text).toBe(0);
});

test("reading the contract folder is allowed, and the agent still cannot switch Pregate off or edit the contract", () => {
  const p = project();
  const read = p.bash("git status --short -- .pregate; git log -1 --format=%h -- .pregate");
  expect(read.code, read.text).toBe(0);
  const typecheck = p.bash("pnpm typecheck 2>&1 | tail -15");
  expect(typecheck.code, typecheck.text).toBe(0);

  const disable = p.bash("pregate disable");
  expect(disable.code, disable.text).toBe(2);
  expect(disable.text).toContain("PREGATE DENY");
  const edit = p.write(".pregate/preset.json", "{}\n");
  expect(edit.code, edit.text).toBe(2);
  expect(edit.stdout).toContain('"permissionDecision":"deny"');
});

test("an advisory is one short text, and it is not repeated for the same file in a session", () => {
  const p = project();
  const first = p.write("src/domain/price.ts", BREAKS_THE_LAYER);
  expect(first.code, first.text).toBe(0);
  expect(first.text).toContain("PREGATE ADVISOR");
  expect(first.text.length).toBeLessThan(900);
  const again = p.write("src/domain/price.ts", `${BREAKS_THE_LAYER}export const tax = 2;\n`);
  expect(again.code, again.text).toBe(0);
  expect(again.text).not.toContain("PREGATE ADVISOR");
});

test("a contract Pregate cannot read is one note at the end of a turn, said once, and the turn ends", () => {
  const p = project();
  expect(p.write("src/infra/note.ts", "export const note = 1;\n").code).toBe(0);
  // A person broke the preset by hand. Pregate cannot judge until it is repaired.
  writeFileSync(join(p.root, ".pregate/preset.json"), "{}\n");
  const first = p.stop();
  expect(first.code, first.text).toBe(0);
  expect(first.stdout).not.toContain('"decision":"block"');
  expect(first.text).toContain("PREGATE NOTE lock-stale");
  expect(first.text).toContain("Not blocked.");
  const second = p.stop();
  expect(second.code, second.text).toBe(0);
  expect(second.text).not.toContain("PREGATE NOTE");
});

test("at the end of a turn a file that does not parse is a note and does not hide an enforced rule in another file", () => {
  const p = project();
  const promotion = p.cli("promote", "--rule", "architecture/CA-DEP-001", "--preview");
  expect(promotion.code, promotion.text).toBe(0);
  expect(p.cli("approve", "--yes", "--digest", promotion.text.match(/Digest: ([0-9a-f]{64})/)![1]!).code).toBe(0);
  p.git("add", "-A"); p.git("commit", "-qm", "enforce the layer rule");
  expect(p.write("src/infra/note.ts", "export const note = 1;\n").code).toBe(0);
  // Files a shell command left behind: Stop judges what is on disk.
  writeFileSync(join(p.root, "src/domain/a.ts"), "export const broken = (;\n");
  writeFileSync(join(p.root, "src/domain/z.ts"), BREAKS_THE_LAYER);

  const blocked = p.stop();
  expect(blocked.stdout, blocked.text).toContain('"decision":"block"');
  expect(blocked.text).toContain("architecture/CA-DEP-001");

  writeFileSync(join(p.root, "src/domain/z.ts"), "export const price = 1;\n");
  const released = p.stop();
  expect(released.code, released.text).toBe(0);
  expect(released.stdout).not.toContain('"decision":"block"');
  expect(released.text).toContain("syntax");
});
