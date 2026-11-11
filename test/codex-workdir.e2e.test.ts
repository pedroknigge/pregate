import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { removeTree } from "./remove-tree.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { H } from "../src/state.ts";

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
  const activePath = join(repo, ".pregate/preset.json");
  const active = JSON.parse(readFileSync(activePath, "utf8"));
  writeFileSync(activePath, JSON.stringify({ ...active, enforcement: "enforce" }));
  const enforcing = run(["preset", "compile", "--yes"]);
  expect(enforcing.code, enforcing.text).toBe(0);
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

test("Codex child lifecycle preserves the parent's baseline and checks only its own edits", () => {
  const id = "codex-lifecycle", agent = "worker";
  const base = { session_id: id, turn_id: "turn", cwd: spell(repo), transcript_path: null, permission_mode: "bypassPermissions" };
  const lifecycle = (event: string, child = false) => JSON.stringify({ ...base, hook_event_name: event, ...(child ? { agent_id: agent, agent_type: "default" } : {}), stop_hook_active: false });
  const start = hook("session-start", lifecycle("SessionStart"));
  expect(start.code, start.text).toBe(0);
  const snap = join(area, "state/pregate/sessions", process.platform === "win32" ? `codex~${id}` : `codex:${id}`, H(repo), "snapshot.json");
  const before = readFileSync(snap, "utf8");
  const childStart = hook("session-start", lifecycle("SubagentStart", true));
  expect(childStart.code, childStart.text).toBe(0);
  const context = JSON.parse(childStart.stdout).hookSpecificOutput;
  expect(context.hookEventName).toBe("SubagentStart");
  expect(context.additionalContext).toContain("PREGATE is active:");
  expect(context.additionalContext).toContain("use absolute paths");
  expect(context.additionalContext).toContain(repo);
  expect(readFileSync(snap, "utf8")).toBe(before);

  const file = join(repo, "src/lifecycle.ts"), good = "export const value = 1;\n";
  const edit = hook("pre", JSON.stringify({ ...base, agent_id: agent, hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_use_id: "exec-lifecycle",
    tool_input: { command: `*** Begin Patch\n*** Add File: ${spell(file)}\n+${good.trim()}\n*** End Patch\n` } }));
  expect(edit.code, edit.text).toBe(0);
  writeFileSync(file, "export const value = ;\n");
  const parent = hook("stop", lifecycle("Stop"));
  expect(JSON.parse(parent.stdout).decision).toBe("block");
  const blocked = hook("stop", lifecycle("SubagentStop", true));
  expect(blocked.stdout, blocked.text).not.toBe("");
  expect(JSON.parse(blocked.stdout).decision).toBe("block");
  expect(blocked.stdout).toContain("syntax");
  writeFileSync(file, good);
  const repaired = hook("stop", lifecycle("SubagentStop", true));
  expect(repaired.code, repaired.text).toBe(0);
  expect(repaired.stdout).toBe("");
  writeFileSync(file, "export const value = ;\n");
  const finished = hook("stop", lifecycle("Stop"));
  expect(JSON.parse(finished.stdout).decision).toBe("block");
  expect(finished.stdout).toContain("lifecycle.ts");
  writeFileSync(file, good);
});

test("an inactive Codex child receives no setup notice", () => {
  const out = hook("session-start", JSON.stringify({ session_id: "inactive-child", cwd: spell(outside), hook_event_name: "SubagentStart", agent_id: "child" }));
  expect(out.code, out.text).toBe(0);
  expect(out.stdout).toBe("");
});

test("an older engine pin retains parent Stop routing and does not receive new child events", () => {
  const old = join(area, "older-pin");
  git(old);
  const ready = run(["init", "--yes", "--preset", "legacy-safe"], "", old);
  expect(ready.code, ready.text).toBe(0);
  const base = { session_id: "older-pin", cwd: spell(old), stop_hook_active: false };
  const started = run(["hook", "session-start", "--harness", "codex"], JSON.stringify({ ...base, hook_event_name: "SessionStart" }), old);
  expect(started.code, started.text).toBe(0);
  const path = join(old, ".pregate/pregate.lock.json");
  const lock = JSON.parse(readFileSync(path, "utf8"));
  writeFileSync(path, JSON.stringify({ ...lock, engine: "0.0.1" }));
  for (const [kind, event] of [["session-start", "SubagentStart"], ["stop", "SubagentStop"]] as const) {
    const out = run(["hook", kind, "--harness", "codex"], JSON.stringify({ ...base, hook_event_name: event, agent_id: "worker" }), old);
    expect(out.code, out.text).toBe(0);
    expect(out.stdout).toBe("");
  }
  const parent = run(["hook", "stop", "--harness", "codex"], JSON.stringify({ ...base, hook_event_name: "Stop" }), old);
  expect(parent.code, parent.text).toBe(3);
  expect(parent.stdout.trim()).toBe("0.0.1");
});
