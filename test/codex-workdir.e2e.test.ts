import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { removeTree } from "./remove-tree.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";

// Codex 0.166.0 hook path through the compiled pregate binary. Payloads follow the captures in
// test/payloads/codex/*-166.json and pre-bash-workdir-*.json: Bash `cwd` is the command workdir,
// while SessionStart, Stop and apply_patch keep the session directory. The hook process cwd is the
// session directory, as the real CLI does, so a decision cannot come from process.cwd().

setDefaultTimeout(180_000);
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-codex-cwd-")));
const home = join(area, "home");
const repo = join(area, "repo");
const other = join(area, "other");
const outside = join(area, "outside");
// Two directories above the executable are the engine home. Keep that tree away from the repos,
// or every project path is a protected engine path.
const binary = join(area, "opt/engine", ENGINE_FILE);
const spell = (p: string): string => p.replaceAll("\\", "/");
const session = "01a00000-0000-7000-8000-000000000166";
const turn = "01a00000-0000-7000-8000-000000000167";
const env = {
  ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: join(area, "data"), APPDATA: join(area, "config"),
  XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
  CODEX_HOME: join(home, ".codex"), GROK_HOME: join(home, ".grok"), TMPDIR: area, TMP: area, TEMP: area, CI: "1",
  // `CI` alone does not approve. init --yes needs the unattended signal from the trust-boundary fix.
  PREGATE_UNATTENDED_APPROVAL: "1",
};

function run(args: string[], raw = "", cwd = repo) {
  const r = Bun.spawnSync([binary, ...args], { cwd, env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString(), text: r.stdout.toString() + r.stderr.toString() };
}

function git(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const r = Bun.spawnSync(["git", "init", "-q"], { cwd: dir, env, stdout: "pipe", stderr: "pipe" });
  expect(r.exitCode, r.stderr.toString()).toBe(0);
}

function bash(cwd: string, command: string, id: string): string {
  return JSON.stringify({
    session_id: session, turn_id: turn, transcript_path: null, cwd, hook_event_name: "PreToolUse",
    model: "gpt-5.5", permission_mode: "bypassPermissions", tool_name: "Bash",
    tool_input: { command }, tool_use_id: id,
  });
}

function hook(kind: "pre" | "stop" | "session-start", raw: string) {
  // The real hook process stays in the session directory even when the command runs elsewhere.
  return run(["hook", kind, "--harness", "codex"], raw, repo);
}

beforeAll(() => {
  mkdirSync(join(area, "opt/engine"), { recursive: true });
  engineAt(binary, true);
  for (const dir of [repo, other, outside]) git(dir);
  mkdirSync(join(repo, "src/nested"), { recursive: true });
  mkdirSync(join(other, "src"), { recursive: true });
  for (const dir of [repo, other]) {
    const ready = run(["init", "--yes", "--preset", "legacy-safe"], "", dir);
    expect(ready.code, ready.text).toBe(0);
  }
  const presetPath = join(other, ".pregate/preset.json");
  const preset = JSON.parse(readFileSync(presetPath, "utf8")) as { scope: { include: string[]; exclude: string[] } };
  preset.scope = { include: ["only-b/**"], exclude: [] };
  writeFileSync(presetPath, `${JSON.stringify(preset, null, 2)}\n`);
  const compiled = run(["preset", "compile", "--yes"], "", other);
  expect(compiled.code, compiled.text).toBe(0);
});

// A compiled engine just ran from this directory; Windows can still hold it mapped.
afterAll(() => removeTree(area));

test("Codex 0.166 workdir payloads keep the session project and block a write that lands in it", () => {
  const started = hook("session-start", JSON.stringify({
    session_id: session, transcript_path: null, cwd: spell(repo), hook_event_name: "SessionStart",
    model: "gpt-5.5", permission_mode: "bypassPermissions", source: "startup",
  }));
  expect(started.code, started.text).toBe(0);

  const stop = () => hook("stop", JSON.stringify({
    session_id: session, turn_id: turn, transcript_path: null, cwd: spell(repo), hook_event_name: "Stop",
    model: "gpt-5.5", permission_mode: "bypassPermissions", stop_hook_active: false, last_assistant_message: "done",
  }));
  const before = stop();
  expect(before.code, before.text).toBe(0);

  const sub = spell(join(repo, "src"));
  const blocked = hook("pre", bash(sub, "echo x > a.ts", "call_sub_block"));
  expect(blocked.code, blocked.text).toBe(2);
  expect(blocked.stderr).toContain("PREGATE DENY shell-write");

  const outsideScope = hook("pre", bash(sub, "echo x > ../README.md", "call_sub_allow"));
  expect(outsideScope.code, outsideScope.text).toBe(0);
  expect(outsideScope.stderr).toBe("");

  const intoRepo = hook("pre", bash(spell(outside), `echo x > ${spell(join(repo, "src/a.ts"))}`, "call_out_abs"));
  expect(intoRepo.code, intoRepo.text).toBe(2);
  expect(intoRepo.stderr).toContain("PREGATE DENY shell-write");

  const relative = hook("pre", bash(spell(outside), "echo x > ../repo/src/a.ts", "call_out_rel"));
  expect(relative.code, relative.text).toBe(2);
  expect(relative.stderr).toContain("PREGATE DENY shell-write");

  const local = hook("pre", bash(spell(outside), "echo out > out.txt", "call_out_local"));
  expect(local.code, local.text).toBe(0);
  expect(local.stderr).toBe("");

  // `other` is a consented project whose scope does not include src/. Adopting it must not let a
  // write into `repo` through, and a relative write must stay in `other` rather than in `repo`.
  const switched = hook("pre", bash(spell(other), `echo x > ${spell(join(repo, "src/a.ts"))}`, "call_other_abs"));
  expect(switched.code, switched.text).toBe(2);
  expect(switched.stderr).toContain("PREGATE DENY shell-write");
  const stays = hook("pre", bash(spell(other), "echo x > src/a.ts", "call_other_rel"));
  expect(stays.code, stays.text).toBe(0);
  expect(stays.stderr).toBe("");

  // apply_patch keeps the session directory in cwd. The nested file is in the same patch as a
  // protected path, so the call is denied even though the source file itself would be admitted.
  const patch = [
    "*** Begin Patch",
    `*** Add File: ${spell(join(repo, "src/nested/note.ts"))}`,
    "+export const note = 1;",
    `*** Add File: ${spell(join(repo, ".pregate/canary.json"))}`,
    "+{}",
    "*** End Patch",
    "",
  ].join("\n");
  const edited = hook("pre", JSON.stringify({
    session_id: session, turn_id: turn, transcript_path: null, cwd: spell(repo), hook_event_name: "PreToolUse",
    model: "gpt-5.5", permission_mode: "bypassPermissions", tool_name: "apply_patch",
    tool_input: { command: patch }, tool_use_id: "call_patch_bad",
  }));
  expect(edited.code, edited.text).toBe(2);
  expect(edited.stderr).toContain("PREGATE DENY protected-path");

  const after = stop();
  expect(after.code, after.text).toBe(before.code);
});
