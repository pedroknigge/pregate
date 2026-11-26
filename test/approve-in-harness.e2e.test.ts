import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { VERSIONS } from "../src/gate.ts";
import { engineAt } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Release binary, so PREGATE_TEST_ANSWER cannot approve it. stdin is a pipe, the same shape as a
// harness shell and a `!` line. The hook is asked first and does not itself apply the contract.
// The binary sits at <data>/pregate/<version>/pregate. The engine protects the folder two levels
// above itself, so a binary next to the fixture would protect the fixture.
// Canonical, as a harness reports its working directory: a pending review is keyed by the real
// path, and the macOS temporary folder is a symbolic link.
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-in-harness-")));
const data = join(area, "data");
const binary = join(data, "pregate", VERSIONS.engine, ENGINE_FILE);
const HARNESSES = ["claude-code", "codex", "cursor", "grok", "agy", "opencode"] as const;

beforeAll(() => engineAt(binary, false), 180_000);
afterAll(() => removeTree(area));

test("a pending init that was never enabled does not ask or deny", () => {
  const root = join(area, "never");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/a.ts"), "export const value = 1;\n");
  expect(Bun.spawnSync(["git", "init", "-q", "-b", "main", root]).exitCode).toBe(0);
  const env = baseEnv(data);
  const preview = Bun.spawnSync([binary, "init", "--preview", "--preset", "legacy-safe"], {
    cwd: root, env: { ...env, PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe",
  });
  const text = preview.stdout.toString() + preview.stderr.toString();
  expect(preview.exitCode, text).toBe(0);
  const digest = /Digest: ([a-f0-9]{64})/.exec(text)?.[1];
  expect(digest, text).toMatch(/^[a-f0-9]{64}$/);
  const pending = { root, data, env, digest: digest!, code: digest!.slice(0, 12), preset: "" };
  const allowed = hook(pending, "claude-code", `pregate approve ${pending.code}`);
  expect(allowed.code, allowed.text).toBe(0);
  expect(allowed.stdout, allowed.text).toBe("");
  expect(allowed.text).not.toContain("DENY");
  expect(allowed.text).not.toContain("permissionDecision");
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
});

test("a piped harness shell approves with a code or --yes, and a bare approve still refuses", () => {
  const codeProject = project("by-code", data);
  const yesProject = project("by-yes", data);
  for (const harness of HARNESSES) {
    const allowed = hook(codeProject, harness, `pregate approve ${codeProject.code}`);
    expect(allowed.code, `${harness}\n${allowed.text}`).toBe(0);
    expect(allowed.text, harness).not.toContain("DENY");
    if (harness === "cursor") expect(JSON.parse(allowed.stdout).permission).toBe("allow");
    if (harness === "claude-code") {
      const ask = claudeAsk(allowed);
      expect(ask.reason).toContain("Accept runs this command. Reject runs nothing.");
      expect(ask.reason).toContain("Mode:");
      expect(ask.reason).toContain(`pregate approve ${codeProject.code}`);
    } else if (harness === "agy") {
      const ask = agyAsk(allowed);
      expect(ask.reason).toContain("Accept runs this command. Reject runs nothing.");
      expect(ask.reason).toContain("Mode:");
      expect(ask.reason).toContain(`pregate approve ${codeProject.code}`);
    } else {
      expect(allowed.text, harness).not.toContain('"permissionDecision":"ask"');
      expect(allowed.text, harness).not.toContain('"permission":"ask"');
      expect(allowed.text, harness).not.toContain('"decision":"force_ask"');
    }
    const bang = hook(codeProject, harness, `! pregate approve --yes --digest ${codeProject.digest}`);
    expect(bang.code, `${harness} bang\n${bang.text}`).toBe(0);
    if (harness === "claude-code") expect(claudeAsk(bang).reason).toContain(codeProject.digest);
    if (harness === "agy") expect(agyAsk(bang).reason).toContain(codeProject.digest);
    unchanged(codeProject);
  }
  const bare = run(codeProject, ["approve"], "y\n");
  expect(bare.code, bare.text).toBe(1);
  expect(bare.text).toContain("no terminal");
  unchanged(codeProject);
  const wrong = run(codeProject, ["approve", "--yes", "--digest", "0".repeat(64)]);
  expect(wrong.code, wrong.text).toBe(1);
  unchanged(codeProject);
  const env = hook(codeProject, "claude-code", `PREGATE_UNATTENDED_APPROVAL=1 pregate approve --yes --digest ${codeProject.digest}`);
  expect(env.code, env.text).toBe(2);
  expect(env.text).toContain("approval");
  expect(env.text).toContain("cannot grant itself approval");
  expect(env.text).not.toContain("rule adaptation");
  expect(env.text).toContain("You may propose the literal command pregate approve <code>");
  const state = hook(codeProject, "claude-code", "echo x > .pregate/preset.json");
  expect(state.code, state.text).toBe(2);
  expect(state.text).toContain("protected-path");
  const logPath = join(codeProject.data, "pregate", "contract-approvals", "log.jsonl");
  const records = hook(codeProject, "claude-code", `echo x > '${logPath}'`);
  expect(records.code, records.text).toBe(2);

  const applied = run(codeProject, ["approve", codeProject.code, "--no-commit"]);
  expect(applied.code, applied.text).toBe(0);
  expect(existsSync(join(codeProject.root, ".pregate/pregate.lock.json"))).toBe(true);
  const byYes = run(yesProject, ["approve", "--yes", "--digest", yesProject.digest, "--no-commit"]);
  expect(byYes.code, byYes.text).toBe(0);
  expect(existsSync(join(yesProject.root, ".pregate/pregate.lock.json"))).toBe(true);
  const lines = readFileSync(logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line) as { via: string; tty: boolean; root: string });
  // The log stores canonical(root): forward slashes, and the real path on Windows.
  const recorded = (root: string) => lines.some((line) => line.root === canonical(root) && line.via === "yes" && line.tty === false);
  expect(recorded(codeProject.root), JSON.stringify(lines)).toBe(true);
  expect(recorded(yesProject.root), JSON.stringify(lines)).toBe(true);
}, 180_000);

// The hook payload has no field for `claude -p`. An unanswered ask there is denied by Claude Code.
// These are the sessions the payload and the environment can distinguish from an interactive parent.
test("an interactive Claude parent gets a schema-valid ask; a subagent, CI, dontAsk, bypass and a remote session do not", () => {
  const asked = project("claude-ask", data);
  const command = `pregate approve ${asked.code}`;
  const parent = hook(asked, "claude-code", command);
  const ask = claudeAsk(parent);
  expect(ask.reason).toContain("Accept runs this command. Reject runs nothing.");
  expect(ask.reason).toContain("Mode:");
  expect(ask.context.length).toBeGreaterThan(0);
  unchanged(asked);
  const bare = hook(asked, "claude-code", "pregate approve --yes");
  const bareAsk = claudeAsk(bare);
  expect(bareAsk.reason).toContain("pregate approve --yes");
  expect(bareAsk.reason).not.toContain(asked.digest);
  expect(bareAsk.context).not.toContain(asked.digest);
  const wrong = hook(asked, "claude-code", `pregate approve --yes --digest ${"a".repeat(64)}`);
  expect(wrong.code, wrong.text).toBe(0);
  expect(wrong.text).not.toContain('"permissionDecision":"ask"');
  const quiet = (result: { code: number; text: string }) => {
    expect(result.code, result.text).toBe(0);
    expect(result.text).not.toContain("DENY");
    expect(result.text).not.toContain('"permissionDecision":"ask"');
    unchanged(asked);
  };
  for (const mode of ["auto", "plan", "default"]) {
    const same = hook(asked, "claude-code", command, { patch: (payload) => { payload.permission_mode = mode; } });
    expect(claudeAsk(same).reason, mode).toContain("Accept runs this command. Reject runs nothing.");
  }
  quiet(hook(asked, "claude-code", command, { patch: (payload) => { delete payload.permission_mode; } }));
  quiet(hook(asked, "claude-code", command, { patch: (payload) => { payload.agent_id = "worker"; } }));
  quiet(hook(asked, "claude-code", command, { patch: (payload) => { payload.permission_mode = "dontAsk"; } }));
  quiet(hook(asked, "claude-code", command, { patch: (payload) => { payload.permission_mode = "bypassPermissions"; } }));
  quiet(hook(asked, "claude-code", command, { env: { CI: "1" } }));
  quiet(hook(asked, "claude-code", command, { env: { CLAUDE_CODE_REMOTE: "true" } }));
}, 60_000);

// agy 1.5.9 PreToolUse decision enum, from the linux amd64 binary jsonschema.
// The living hooks page also lists auto_approve. That value is not in the schema, and this reply does not use it.
const AGY_DECISIONS = ["allow", "deny", "ask", "force_ask", "deny_unless_prior_grant"];

// The hook payload has no permission mode. CI, a child conversation, saved always-proceed
// and an agy process started with the skip or print flag keep the allow. force_ask is what
// would stall or auto-approve there, so those replies stay empty and return immediately.
test("an interactive agy session gets a schema-valid force_ask; skip-permissions, print mode, CI and a child do not", () => {
  const asked = project("agy-ask", data);
  const command = `pregate approve ${asked.code}`;
  const parent = hook(asked, "agy", command);
  const ask = agyAsk(parent);
  expect(ask.reason).toContain("Accept runs this command. Reject runs nothing.");
  expect(ask.reason).toContain("Mode:");
  expect(ask.reason).toContain(command);
  unchanged(asked);
  const bare = hook(asked, "agy", "pregate approve --yes");
  const bareAsk = agyAsk(bare);
  expect(bareAsk.reason).toContain("pregate approve --yes");
  expect(bareAsk.reason).not.toContain(asked.digest);
  expect(agyAsk(hook(asked, "agy", `pre''gate approve ${asked.code}`)).reason).toContain("Accept runs this command. Reject runs nothing.");
  const wrong = hook(asked, "agy", `pregate approve --yes --digest ${"a".repeat(64)}`);
  expect(wrong.code, wrong.text).toBe(0);
  expect(wrong.stdout).toBe("");
  expect(wrong.text).not.toContain("force_ask");
  const reviewHome = agyHome("request-review", { toolPermission: "request-review" });
  expect(agyAsk(hook(asked, "agy", command, { env: reviewHome })).reason).toContain("Accept runs this command. Reject runs nothing.");
  const quiet = (result: { code: number; text: string; stdout: string }) => {
    expect(result.code, result.text).toBe(0);
    expect(result.stdout, result.text).toBe("");
    expect(result.text).not.toContain("force_ask");
    expect(result.text).not.toContain("DENY");
    unchanged(asked);
  };
  const skipStarted = Date.now();
  quiet(hook(asked, "agy", command, { env: agyHome("always-proceed", { toolPermission: "always-proceed" }) }));
  expect(Date.now() - skipStarted).toBeLessThan(10_000);
  quiet(hook(asked, "agy", command, { env: agyHome("turbo", { permissionPreset: "turbo" }) }));
  quiet(hook(asked, "agy", command, { env: { CI: "1" } }));
  quiet(hook(asked, "agy", command, { patch: (payload) => { payload.parentConversationId = "child-of-root"; } }));
  quiet(hook(asked, "agy", `sh -c 'pregate approve ${asked.code}'`));
  quiet(hook(asked, "agy", `echo ${asked.code} | pregate approve`));
  expect(agyAsk(hook(asked, "agy", `(pregate approve ${asked.code})`)).reason).toContain("Accept runs this command. Reject runs nothing.");
  unchanged(asked);
  if (process.platform !== "win32") {
    const flagged = agyParent(asked, command, ["--dangerously-skip-permissions"]);
    quiet(flagged);
    expect(flagged.ms).toBeLessThan(10_000);
    quiet(agyParent(asked, command, ["-p"]));
    quiet(agyParent(asked, command, ["--print", "say the pending review"]));
    quiet(agyParent(asked, command, ["--settings", JSON.stringify({ toolPermission: "always-proceed" })]));
    const saved = agyHome("override", { toolPermission: "always-proceed" });
    expect(agyAsk(agyParent(asked, command, ["--settings", JSON.stringify({ toolPermission: "request-review" })], saved)).reason).toContain("Accept runs this command. Reject runs nothing.");
    expect(agyAsk(agyParent(asked, command, [])).reason).toContain("Accept runs this command. Reject runs nothing.");
  }
  const applied = run(asked, ["approve", asked.code, "--no-commit"]);
  expect(applied.code, applied.text).toBe(0);
  const logPath = join(asked.data, "pregate", "contract-approvals", "log.jsonl");
  const lines = readFileSync(logPath, "utf8").trim().split("\n").map((line) => JSON.parse(line) as { via: string; tty: boolean; root: string });
  expect(lines.some((line) => line.root === canonical(asked.root) && line.via === "yes" && line.tty === false)).toBe(true);
}, 120_000);

// Auto (the 1.5.7 default where the CLI can enter it) still prompts on irreversible
// actions. It is not always-proceed. A --settings overlay that does not set a tool
// permission leaves the saved file in charge.
test("agy Auto mode still gets force_ask; always-proceed and Turbo still do not", () => {
  const asked = project("agy-auto", data);
  const command = `pregate approve ${asked.code}`;
  const asks = (result: { code: number; stdout: string; text: string }) => {
    expect(agyAsk(result).reason).toContain("Accept runs this command. Reject runs nothing.");
    unchanged(asked);
  };
  const quiet = (result: { code: number; text: string; stdout: string }) => {
    expect(result.code, result.text).toBe(0);
    expect(result.stdout, result.text).toBe("");
    expect(result.text).not.toContain("force_ask");
    expect(result.text).not.toContain("DENY");
    unchanged(asked);
  };
  asks(hook(asked, "agy", command, { env: agyHome("auto", { agentMode: "auto" }) }));
  asks(hook(asked, "agy", command, { env: agyHome("auto-strict", { agentMode: "auto", toolPermission: "strict" }) }));
  asks(hook(asked, "agy", command, { env: agyHome("default-mode", { agentMode: "" }) }));
  asks(hook(asked, "agy", command, { env: agyHome("accept-edits", { agentMode: "accept-edits" }) }));
  asks(hook(asked, "agy", command, { env: agyHome("plan", { agentMode: "plan" }) }));
  quiet(hook(asked, "agy", command, { env: agyHome("auto-proceed", { agentMode: "auto", toolPermission: "always-proceed" }) }));
  quiet(hook(asked, "agy", command, { env: agyHome("auto-turbo", { agentMode: "auto", permissionPreset: "turbo" }) }));
  if (process.platform !== "win32") {
    asks(agyParent(asked, command, ["--mode=auto"]));
    asks(agyParent(asked, command, ["--mode", "auto"]));
    asks(agyParent(asked, command, ["--mode=accept-edits"]));
    asks(agyParent(asked, command, ["--settings", JSON.stringify({ agentMode: "auto" })]));
    asks(agyParent(asked, command, ["--settings", JSON.stringify({ agentMode: "auto", toolPermission: "strict" })], agyHome("strict-wins", { toolPermission: "always-proceed" })));
    quiet(agyParent(asked, command, ["--settings", JSON.stringify({ agentMode: "auto" })], agyHome("overlay-saved", { toolPermission: "always-proceed" })));
    quiet(agyParent(asked, command, ["--settings", JSON.stringify({ agentMode: "auto", toolPermission: "always-proceed" })]));
    quiet(agyParent(asked, command, ["--settings", JSON.stringify({ permissionPreset: "turbo" })]));
    quiet(agyParent(asked, command, ["-p", "--mode=auto"]));
    const started = Date.now();
    quiet(agyParent(asked, command, ["--mode=auto", "--dangerously-skip-permissions"]));
    expect(Date.now() - started).toBeLessThan(10_000);
  }
}, 120_000);

interface Project { root: string; data: string; env: Record<string, string>; digest: string; code: string; preset: string }

// An enabled project with one pending contract change. The hook asks before that change applies.
function project(name: string, data: string): Project {
  const root = join(area, name);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/a.ts"), "export const value = 1;\n");
  expect(Bun.spawnSync(["git", "init", "-q", "-b", "main", root]).exitCode).toBe(0);
  const env = baseEnv(data);
  const ready = Bun.spawnSync([binary, "init", "--yes", "--preset", "legacy-safe"], {
    cwd: root, env: { ...env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe",
  });
  expect(ready.exitCode, ready.stdout.toString() + ready.stderr.toString()).toBe(0);
  writeFileSync(join(root, "loosen.json"), JSON.stringify({ why: "advisor first", patch: [{ op: "replace", path: "/enforcement", value: "advisor" }] }));
  const preview = Bun.spawnSync([binary, "preset", "apply", "loosen.json", "--preview"], {
    cwd: root, env: { ...env, PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe",
  });
  const text = preview.stdout.toString() + preview.stderr.toString();
  expect(preview.exitCode, text).toBe(0);
  const digest = /Digest: ([a-f0-9]{64})/.exec(text)?.[1];
  expect(digest, text).toMatch(/^[a-f0-9]{64}$/);
  return { root, data, env, digest: digest!, code: digest!.slice(0, 12), preset: readFileSync(join(root, ".pregate/preset.json"), "utf8") };
}

function unchanged(p: Project): void {
  expect(readFileSync(join(p.root, ".pregate/preset.json"), "utf8")).toBe(p.preset);
}

function baseEnv(data: string): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "", HOME: join(area, "home"), TMPDIR: area,
    XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"),
    GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  };
  if (process.platform === "win32") {
    env.USERPROFILE = join(area, "home");
    env.LOCALAPPDATA = data;
    env.APPDATA = join(area, "config");
    env.SystemRoot = process.env.SystemRoot ?? "C:\\Windows";
  }
  return env;
}

function run(p: Project, args: string[], stdin = ""): { code: number; text: string } {
  const result = Bun.spawnSync([binary, ...args], {
    cwd: p.root, env: p.env, stdin: Buffer.from(stdin), stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  return { code: result.exitCode ?? -1, text: result.stdout.toString() + result.stderr.toString() };
}

const PERMISSION_DECISIONS = ["allow", "deny", "ask", "defer"];

function claudeAsk(result: { code: number; stdout: string; text: string }): { reason: string; context: string } {
  expect(result.code, result.text).toBe(0);
  expect(result.text).toBe(result.stdout);
  const body = JSON.parse(result.stdout) as { hookSpecificOutput?: { hookEventName?: string; permissionDecision?: string; permissionDecisionReason?: string; additionalContext?: string } };
  const out = body.hookSpecificOutput;
  expect(out?.hookEventName).toBe("PreToolUse");
  expect(out?.permissionDecision).toBe("ask");
  expect(PERMISSION_DECISIONS).toContain(out?.permissionDecision ?? "");
  expect(typeof out?.permissionDecisionReason).toBe("string");
  expect(out!.permissionDecisionReason!.length).toBeGreaterThan(0);
  expect(typeof out?.additionalContext).toBe("string");
  return { reason: out!.permissionDecisionReason!, context: out!.additionalContext! };
}

function agyAsk(result: { code: number; stdout: string; text: string }): { reason: string } {
  expect(result.code, result.text).toBe(0);
  expect(result.text).toBe(result.stdout);
  const body = JSON.parse(result.stdout) as { decision?: string; reason?: string; permissionOverrides?: unknown };
  expect(Object.keys(body)).toEqual(["decision", "reason"]);
  expect(body.decision).toBe("force_ask");
  expect(AGY_DECISIONS).toContain(body.decision ?? "");
  expect(body.permissionOverrides).toBeUndefined();
  expect(typeof body.reason).toBe("string");
  expect(body.reason!.length).toBeGreaterThan(0);
  return { reason: body.reason! };
}

function agyHome(name: string, settings: object): Record<string, string> {
  const home = join(area, `agy-home-${name}`);
  mkdirSync(join(home, ".gemini", "antigravity-cli"), { recursive: true });
  writeFileSync(join(home, ".gemini", "antigravity-cli", "settings.json"), JSON.stringify(settings));
  return { HOME: home, USERPROFILE: home };
}

// The parent process's argv0 is agy, which is what the hook walks. python3 stays the
// executable so this runs without a copy of the agy CLI. CI has no signed-in agy.
function agyParent(p: Project, command: string, args: string[], env: Record<string, string> = {}): { code: number; text: string; stdout: string; ms: number } {
  const launch = join(area, "agy-launch.py");
  const runner = join(area, "agy-runner.py");
  writeFileSync(launch, "import os, sys\nos.execv(sys.executable, ['agy', sys.argv[1], *sys.argv[2:]])\n");
  writeFileSync(runner, "import os, subprocess, sys\nsys.exit(subprocess.call([os.environ['PREGATE'], 'hook', 'pre', '--harness', 'agy']))\n");
  const started = Date.now();
  const result = Bun.spawnSync(["python3", launch, runner, ...args], {
    cwd: p.root, env: { ...p.env, PREGATE: binary, PYTHONDONTWRITEBYTECODE: "1", ...env },
    stdin: Buffer.from(agyPayload(p, command)), stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
  const stdout = result.stdout.toString();
  return { code: result.exitCode ?? -1, stdout, text: stdout + result.stderr.toString(), ms: Date.now() - started };
}

function agyPayload(p: Project, command: string): string {
  const payload = JSON.parse(readFileSync(join(import.meta.dir, "payloads", "agy/pre-run_command.json"), "utf8"));
  payload.workspacePaths = [p.root];
  payload.toolCall.args.Cwd = p.root;
  payload.toolCall.args.CommandLine = command;
  return JSON.stringify(payload);
}

function hook(p: Project, harness: typeof HARNESSES[number], command: string, extra: { env?: Record<string, string>; patch?: (payload: Record<string, unknown>) => void } = {}): { code: number; text: string; stdout: string } {
  const names = {
    "claude-code": "pre-bash.json", codex: "codex/pre-bash.json", cursor: "cursor/pre-shell.json",
    grok: "grok/pre-run-terminal-command.json", agy: "agy/pre-run_command.json", opencode: "opencode/pre-shell.json",
  };
  const payload = JSON.parse(readFileSync(join(import.meta.dir, "payloads", names[harness]), "utf8"));
  if (harness === "agy") { payload.workspacePaths = [p.root]; payload.toolCall.args.Cwd = p.root; payload.toolCall.args.CommandLine = command; }
  else if (harness === "grok") { payload.cwd = payload.workspaceRoot = p.root; payload.toolInput.command = payload.tool_input.command = command; }
  else {
    payload.cwd = p.root; payload.workspace_roots = [p.root]; payload.tool_input.command = command;
    if (harness === "cursor") payload.tool_input.cwd = p.root;
    if (harness === "opencode") payload.tool_input.workdir = p.root;
  }
  extra.patch?.(payload);
  const result = Bun.spawnSync([binary, "hook", "pre", "--harness", harness], {
    cwd: p.root, env: { ...p.env, ...extra.env }, stdin: Buffer.from(JSON.stringify(payload)), stdout: "pipe", stderr: "pipe", timeout: 30_000,
  });
  const stdout = result.stdout.toString();
  return { code: result.exitCode ?? -1, stdout, text: stdout + result.stderr.toString() };
}
