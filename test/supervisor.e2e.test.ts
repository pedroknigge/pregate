import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import pkg from "../package.json" with { type: "json" };
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { windowsHook } from "../src/windows-command.ts";
import type { HarnessId } from "../src/types.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

setDefaultTimeout(120_000);
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-native-")));
const home = join(area, "home");
const data = join(area, "data/pregate");
const repo = join(area, "repo with spaces →");
const binary = join(area, ENGINE_FILE);
const engine = join(data, pkg.version, ENGINE_FILE);
const isolatedPath = WINDOWS ? pathWithoutHarnesses() : "/usr/bin:/bin";
const env = { ...process.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: join(area, "data"), APPDATA: join(area, "config"),
  XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
  CODEX_HOME: join(home, ".codex"), GROK_HOME: join(home, ".grok"), TMPDIR: area, TMP: area, TEMP: area, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
  PATH: isolatedPath, CLAUDE_CONFIG_DIR: "",
  ...(WINDOWS ? {
    Path: isolatedPath,
    PSModulePath: join(process.env.SystemRoot!, "System32/WindowsPowerShell/v1.0/Modules"),
    PSModuleAnalysisCachePath: join(area, "powershell-module-analysis-cache"),
  } : {}) };

function run(argv: string[], raw: string | Buffer | number = "", cwd = repo) {
  const r = Bun.spawnSync(argv, { cwd, env, stdin: typeof raw === "string" ? Buffer.from(raw) : raw, stdout: "pipe", stderr: "pipe", timeout: 115_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}
const cli = (...args: string[]) => run([binary, ...args]);
const supervised = (raw: string, ...args: string[]) => run([binary, "--supervise", data, pkg.version, ...args], raw);

function withCleanup<T>(work: () => T, cleanup: () => void): T {
  try { return work(); } finally { cleanup(); }
}

async function withCleanupAsync<T>(work: () => Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  try { return await work(); } finally { await cleanup(); }
}

function transports(argv: string[], raw: Buffer, cwd = repo) {
  const input = join(area, "transport.bin");
  writeFileSync(input, raw);
  const fd = openSync(input, "r");
  return withCleanup(() => [run(argv, raw, cwd), run(argv, fd, cwd)], () => closeSync(fd));
}

async function heldInput(argv: string[], raw: string, cwd = repo, closeAfter: number | null = null) {
  const capture = mkdtempSync(join(area, "held-input-"));
  const out = join(capture, "stdout"), err = join(capture, "stderr");
  const fds = [openSync(out, "w"), openSync(err, "w")];
  const start = performance.now();
  const proc = Bun.spawn(argv, { cwd, env, stdin: "pipe", stdout: fds[0]!, stderr: fds[1]! });
  fds.forEach(closeSync);
  let timedOut = false;
  const limit = setTimeout(() => { timedOut = true; proc.kill(); }, 9000);
  const end = closeAfter === null ? null : setTimeout(() => proc.stdin.end(), closeAfter);
  return withCleanupAsync(async () => {
    proc.stdin.write(raw);
    await proc.stdin.flush();
    await proc.exited;
    return { code: proc.exitCode, stdout: readFileSync(out, "utf8"), stderr: readFileSync(err, "utf8"),
      timedOut, elapsed: performance.now() - start };
  }, async () => {
    clearTimeout(limit);
    if (end !== null) clearTimeout(end);
    if (proc.exitCode === null) { proc.kill(); await proc.exited; }
    proc.stdin.end();
    rmSync(capture, { recursive: true, force: true });
  });
}

beforeAll(() => {
  for (const folder of [join(home, ".claude"), repo, join(repo, ".pregate"), join(repo, "src"), join(area, "outside")]) mkdirSync(folder, { recursive: true });
  compileBinary(hostTarget(), binary);
  expect(run(["git", "init", "-q", repo]).code).toBe(0);
  writeFileSync(join(repo, ".pregate/preset.json"), readFileSync("catalog/presets/legacy-safe.json", "utf8"));
  expect(cli("setup").code).toBe(0);
  expect(cli("preset", "compile").code).toBe(0);
});
afterAll(() => removeTree(area));

function writePayload(h: HarnessId, target: string): string {
  const names: Record<HarnessId, string> = { "claude-code": "pre-write.json", codex: "codex/pre-apply-patch-add-update.json", cursor: "cursor/pre-write-strreplace.json", grok: "grok/pre-write.json", agy: "agy/pre-write_to_file.json" };
  const p = JSON.parse(readFileSync(join(import.meta.dir, "payloads", names[h]), "utf8"));
  if (h === "agy") { p.workspacePaths = [repo]; p.toolCall.args.TargetFile = target; }
  else if (h === "grok") { p.cwd = p.workspaceRoot = repo; p.toolInput.file_path = target; }
  else if (h === "codex") { p.cwd = repo; p.tool_input = { command: `*** Begin Patch\n*** Add File: ${target}\n+{}\n*** End Patch\n` }; }
  else { p.cwd = repo; p.workspace_roots = [repo]; p.tool_input = { file_path: target, content: "{}" }; }
  return JSON.stringify(p);
}

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("compiled repository admission rejects altered locks in %s with all core requirements active", (h) => {
  const root = join(area, `admission-${h}`);
  mkdirSync(join(root, ".pregate"), { recursive: true });
  mkdirSync(join(root, "src"));
  for (const args of [["init", "-q"], ["commit", "--allow-empty", "-qm", "init"]]) {
    const git = run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], "", root);
    expect(git.code, git.stderr).toBe(0);
  }
  const preset = readFileSync(join(import.meta.dir, "../.pregate/preset.json"), "utf8");
  writeFileSync(join(root, ".pregate/preset.json"), preset);
  const execute = (...args: string[]) => run([engine, ...args], "", root);
  const compiled = execute("preset", "compile");
  expect(compiled.code, compiled.stdout + compiled.stderr).toBe(0);
  expect(execute("enable", "--yes").code).toBe(0);
  const lockPath = join(root, ".pregate/pregate.lock.json");
  const original = readFileSync(lockPath, "utf8");
  const core = JSON.parse(original).rules.filter((rule: { id: string }) => rule.id.startsWith("core/"));
  expect(core).toHaveLength(68);
  const target = join(root, "src/decide.ts");
  const content = "export const value = 1;\n";
  const payload = JSON.parse(writePayload(h, target));
  const session = crypto.randomUUID();
  for (const key of ["session_id", "sessionId", "conversation_id", "conversationId", "generation_id"]) {
    if (Object.hasOwn(payload, key)) payload[key] = session;
  }
  if (h === "agy") { payload.workspacePaths = [root]; payload.toolCall.args.CodeContent = content; }
  else if (h === "grok") { payload.cwd = payload.workspaceRoot = root; payload.toolInput.content = content; }
  else if (h === "codex") { payload.cwd = root; payload.tool_input.command = `*** Begin Patch\n*** Add File: ${target}\n+export const value = 1;\n*** End Patch\n`; }
  else { payload.cwd = root; payload.workspace_roots = [root]; payload.tool_input.content = content; }
  const hook = () => run([engine, "hook", "pre", "--harness", h], JSON.stringify(payload), root);
  const accepted = hook();
  expect(accepted.code).toBe(0);
  expect(accepted.stdout + accepted.stderr).not.toContain("lock-stale");
  for (const changed of [{ rules: [] }, { scope: { include: [], exclude: [] } }, { rules: null },
    { lockVersion: 2 }, { presetHash: "0".repeat(64) }, { coreHash: "0".repeat(64) },
    { sourcesHash: "0".repeat(64) }, { presetHash: undefined }, { coreHash: undefined }]) {
    const altered = { ...JSON.parse(original), ...changed };
    writeFileSync(lockPath, JSON.stringify(altered, null, 2) + "\n");
    const denied = hook();
    expect(denied.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
    expect(denied.stdout + denied.stderr).toContain("lock-stale");
    expect(denied.stdout + denied.stderr).not.toContain("TypeError");
    expect(existsSync(target)).toBe(false);
  }
});

test("real engine supervision stays inert before human worktree consent", () => {
  expect(supervised(writePayload("claude-code", join(repo, ".pregate/canary.json")), "hook", "pre", "--harness", "claude-code")).toEqual({ code: 0, stdout: "", stderr: "" });
  expect(cli("enable", "--yes").code).toBe(0);
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("real engine denies protected writes in %s's captured dialect", (h) => {
  const target = join(repo, ".pregate/canary.json");
  const out = supervised(writePayload(h, target), "hook", "pre", "--harness", h);
  expect(out.stdout + out.stderr).toContain("protected-path");
  expect(out.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
  expect(existsSync(target)).toBe(false);
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("rejected %s tool names cannot disclose secrets or expand diagnostics", (h) => {
  expect(cli("enable", "--yes").code).toBe(0);
  const secret = "secret-canary-CORE-INV-040";
  const payload = JSON.parse(writePayload(h, join(repo, "src/a.ts")));
  const tool = `${secret}\n\u001b[31m${"x".repeat(8192)}`;
  if (h === "agy") payload.toolCall.name = tool;
  else if (h === "grok") payload.toolName = tool;
  else payload.tool_name = tool;
  const raw = JSON.stringify(payload);
  for (const out of [run([binary, "hook", "pre", "--harness", h], raw), supervised(raw, "hook", "pre", "--harness", h)]) {
    expect(out.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
    expect(out.stdout + out.stderr).toContain("payload-unrecognized");
    expect(out.stdout + out.stderr).not.toContain(secret);
    expect(out.stdout + out.stderr).not.toContain("\u001b");
    expect(out.stdout.length + out.stderr.length).toBeLessThan(2048);
  }
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("stdin boundary rejects malformed UTF-8 in %s while preserving valid Unicode", (h) => {
  expect(cli("enable", "--yes").code).toBe(0);
  const payload = { ...JSON.parse(writePayload(h, join(repo, ".pregate/canary.json"))), transportPadding: "é🧪 �" };
  const marker = "é🧪 �";
  const offset = Buffer.byteLength(JSON.stringify({ ...payload, transportPadding: "" })) - 2;
  payload.transportPadding = "x".repeat(64 * 1024 - 1 - offset) + marker;
  const valid = Buffer.from(JSON.stringify(payload));
  expect(valid.indexOf(Buffer.from(marker))).toBe(64 * 1024 - 1);
  const malformed = Buffer.from(valid);
  malformed[malformed.indexOf(Buffer.from(marker))] = 0x80;
  for (const argv of [[binary, "hook", "pre", "--harness", h], [binary, "--supervise", data, pkg.version, "hook", "pre", "--harness", h]]) {
    for (const out of transports(argv, valid)) {
      expect(out.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
      expect(out.stdout + out.stderr).toContain("protected-path");
    }
    for (const cwd of [repo, join(area, "outside")]) for (const out of transports(argv, malformed, cwd)) {
      expect(out.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
      expect(out.stdout + out.stderr).toContain("payload-unrecognized");
      expect(out.stdout.length + out.stderr.length).toBeLessThan(2048);
    }
  }
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("stdin boundary admits exactly 16 MiB and rejects a larger %s payload", (h) => {
  expect(cli("enable", "--yes").code).toBe(0);
  const payload = { ...JSON.parse(writePayload(h, join(repo, ".pregate/canary.json"))), transportPadding: "" };
  payload.transportPadding = "x".repeat(16 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(payload)));
  const valid = Buffer.from(JSON.stringify(payload));
  const oversized = Buffer.concat([valid, Buffer.from(" ")]);
  expect(valid.length).toBe(16 * 1024 * 1024);
  for (const argv of [[binary, "hook", "pre", "--harness", h], [binary, "--supervise", data, pkg.version, "hook", "pre", "--harness", h]]) {
    for (const out of transports(argv, valid)) {
      expect(out.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
      expect(out.stdout + out.stderr).toContain("protected-path");
    }
    for (const out of transports(argv, oversized)) {
      expect(out.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
      expect(out.stdout + out.stderr).toContain("payload-unrecognized");
      expect(out.stdout.length + out.stderr.length).toBeLessThan(2048);
    }
  }
});

test("stdin boundary check rejects malformed encoding and oversized source before evaluation", () => {
  const root = join(area, "stdin-project");
  mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, ".pregate"));
  for (const args of [["init", "-q"], ["commit", "--allow-empty", "-qm", "init"]]) {
    const git = run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], "", root);
    expect(git.code, git.stderr).toBe(0);
  }
  writeFileSync(join(root, ".pregate/preset.json"), policyFixture(readFileSync("catalog/presets/legacy-safe.json", "utf8")));
  expect(run([binary, "preset", "compile"], "", root).code).toBe(0);
  const argv = [binary, "check", "--stdin", "--path", "src/a.ts"];
  const valid = Buffer.from("export const value = 'é🧪 �';\n");
  const malformed = Buffer.from(valid); malformed[malformed.indexOf(Buffer.from("é"))] = 0x80;
  for (const out of transports(argv, valid, root)) expect(out.code).toBe(0);
  const oversized = Buffer.from("/*" + "x".repeat(16 * 1024 * 1024 - 3) + "*/");
  for (const input of [malformed, oversized]) for (const out of transports(argv, input, root)) {
    expect(out.code).toBe(1);
    expect(out.stdout + out.stderr).toContain("stdin must be valid UTF-8 and at most 16 MiB");
  }
  expect(existsSync(join(root, "src/a.ts"))).toBe(false);
});

test("stdin boundary invalid input stays inert outside a consenting project", () => {
  const outside = join(area, "outside");
  for (const bytes of [Buffer.from([0x80]), Buffer.alloc(16 * 1024 * 1024 + 1, 0x78)]) {
    for (const argv of [[binary, "hook", "pre", "--harness", "codex"], [binary, "--supervise", data, pkg.version, "hook", "pre", "--harness", "codex"]]) {
      for (const out of transports(argv, bytes, outside)) expect(out).toEqual({ code: 0, stdout: "", stderr: "" });
    }
  }
});

test("stdin boundary stops reading at the byte budget instead of buffering the entire input", () => {
  expect(cli("enable", "--yes").code).toBe(0);
  const bytes = Buffer.alloc(16 * 1024 * 1024 + 2048, 0x78);
  bytes[16 * 1024 * 1024 + 1] = 0x73;
  const file = join(area, "bounded-read.bin"); writeFileSync(file, bytes);
  const fd = openSync(file, "r");
  withCleanup(() => {
    const out = run([binary, "hook", "pre", "--harness", "codex"], fd);
    expect(out.code).toBe(2); expect(out.stderr).toContain("payload-unrecognized");
    const next = Buffer.alloc(1);
    expect(readSync(fd, next, 0, 1, null)).toBe(1);
    expect(next[0]).toBe(0x73);
  }, () => { closeSync(fd); });
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("stdin boundary enforces an EOF deadline in %s", async (h) => {
  expect(cli("enable", "--yes").code).toBe(0);
  const raw = writePayload(h, join(repo, "src/deadline-canary.ts"));
  const lock = join(repo, ".pregate/pregate.lock.json"), original = readFileSync(lock, "utf8");
  await withCleanupAsync(async () => {
    writeFileSync(lock, JSON.stringify({ ...JSON.parse(original), engine: "9.9.6" }));
    const outputs = await Promise.all([
      heldInput([binary, "hook", "pre", "--harness", h], raw, join(area, "outside")),
      heldInput([binary, "--supervise", data, pkg.version, "hook", "pre", "--harness", h], raw, join(area, "outside")),
    ]);
    for (const out of outputs) {
      expect(out.timedOut).toBe(false);
      expect(out.elapsed).toBeGreaterThanOrEqual(4500);
      expect(out.elapsed).toBeLessThan(8000);
      expect(out.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
      expect(out.stdout + out.stderr).toContain("stdin timed out before EOF");
      expect(out.stdout.length + out.stderr.length).toBeLessThan(2048);
    }
  }, () => { writeFileSync(lock, original); });
  expect(existsSync(join(repo, "src/deadline-canary.ts"))).toBe(false);
});

test("stdin boundary never redirects malformed input to a differently pinned engine", () => {
  expect(cli("enable", "--yes").code).toBe(0);
  const lock = join(repo, ".pregate/pregate.lock.json"), original = readFileSync(lock, "utf8");
  const raw = Buffer.from(JSON.stringify({ ...JSON.parse(writePayload("codex", join(repo, "src/a.ts"))), transportPadding: "é" }));
  raw[raw.indexOf(Buffer.from("é"))] = 0x80;
  withCleanup(() => {
    writeFileSync(lock, JSON.stringify({ ...JSON.parse(original), engine: "9.9.6" }));
    for (const argv of [[binary, "hook", "pre", "--harness", "codex"], [binary, "--supervise", data, pkg.version, "hook", "pre", "--harness", "codex"]]) {
      for (const out of transports(argv, raw, join(area, "outside"))) {
        expect(out.code).toBe(2); expect(out.stderr).toContain("payload-unrecognized");
        expect(out.stdout).toBe("");
      }
    }
  }, () => { writeFileSync(lock, original); });
});

test("stdin boundary check rejects a producer that never sends EOF", async () => {
  const root = join(area, "stdin-timeout-project");
  mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, ".pregate"));
  for (const args of [["init", "-q"], ["commit", "--allow-empty", "-qm", "init"]]) {
    const git = run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], "", root);
    expect(git.code, git.stderr).toBe(0);
  }
  writeFileSync(join(root, ".pregate/preset.json"), policyFixture(readFileSync("catalog/presets/legacy-safe.json", "utf8")));
  expect(run([binary, "preset", "compile"], "", root).code).toBe(0);
  const out = await heldInput([binary, "check", "--stdin", "--path", "src/a.ts"], "export {};", root);
  expect(out.timedOut).toBe(false); expect(out.code).toBe(1);
  expect(out.elapsed).toBeLessThan(8000);
  expect(out.stdout + out.stderr).toContain("stdin timed out before EOF");
});

test("stdin boundary EOF timeout stays inert outside consent and permits delayed EOF", async () => {
  const outside = await Promise.all([
    heldInput([binary, "hook", "pre", "--harness", "codex"], "{}", join(area, "outside")),
    heldInput([binary, "--supervise", data, pkg.version, "hook", "pre", "--harness", "codex"], "{}", join(area, "outside")),
  ]);
  for (const out of outside) expect(out).toMatchObject({ timedOut: false, code: 0, stdout: "", stderr: "" });
  expect(cli("enable", "--yes").code).toBe(0);
  const raw = writePayload("codex", join(repo, ".pregate/canary.json"));
  const valid = await heldInput([binary, "hook", "pre", "--harness", "codex"], raw, repo, 250);
  expect(valid).toMatchObject({ timedOut: false, code: 2 });
  expect(valid.elapsed).toBeGreaterThanOrEqual(200);
  expect(valid.stderr).toContain("protected-path");
  expect(valid.stderr).not.toContain("stdin timed out");
});

test("stdin boundary preserves the supervisor Pre budget while receiving slow input", async () => {
  expect(cli("enable", "--yes").code).toBe(0);
  const runtime = join(data, "8.8.7", ENGINE_FILE);
  mkdirSync(join(data, "8.8.7")); copyFileSync(process.execPath, runtime);
  const raw = writePayload("codex", join(repo, "src/deadline-canary.ts"));
  const out = await heldInput([binary, "--supervise", data, "8.8.7", "-e",
    "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0)"], raw, repo, 4000);
  expect(out.timedOut).toBe(false); expect(out.code).toBe(2);
  expect(out.elapsed).toBeGreaterThanOrEqual(4500); expect(out.elapsed).toBeLessThan(8000);
  expect(out.stderr).toContain("engine timed out");
  expect(out.stderr).not.toContain("stdin timed out");
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("supervisor engine failure preserves %s's native Pre denial", (h) => {
  expect(cli("enable", "--yes").code).toBe(0);
  const raw = writePayload(h, join(repo, "src/deadline-canary.ts"));
  const out = run([binary, "--supervise", data, "9.9.7", "hook", "pre", "--harness", h], raw, join(area, "outside"));
  expect(out.code).toBe(h === "agy" || h === "cursor" ? 0 : 2);
  expect(out.stdout + out.stderr).toContain("engine 9.9.7 is not installed");
  if (h === "agy") expect(JSON.parse(out.stdout).decision).toBe("deny");
  else if (h !== "codex") expect(JSON.parse(out.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  else expect(out.stderr.length).toBeGreaterThan(0);
});

test("missing and empty pinned engines fail closed; redirects cannot loop", () => {
  const lock = join(repo, ".pregate/pregate.lock.json");
  const original = readFileSync(lock, "utf8");
  const raw = writePayload("codex", join(repo, ".pregate/canary.json"));
  const pinned = join(data, "9.9.9", ENGINE_FILE);
  withCleanup(() => {
    const p = JSON.parse(original); p.engine = "9.9.9"; writeFileSync(lock, JSON.stringify(p));
    const missing = supervised(raw, "hook", "pre", "--harness", "codex");
    expect(missing.code).toBe(2); expect(missing.stderr).toContain("9.9.9");
    mkdirSync(join(data, "9.9.9")); writeFileSync(pinned, "");
    expect(supervised(raw, "hook", "pre", "--harness", "codex").code).toBe(2);
    copyFileSync(engine, pinned);
    const loop = supervised(raw, "hook", "pre", "--harness", "codex");
    expect(loop.code).toBe(2); expect(loop.stderr).toContain("exit 3");
  }, () => { writeFileSync(lock, original); });
});

test("real engine crash is mapped to a denial; an inactive worktree stays inert", () => {
  const bad = { ...JSON.parse(writePayload("claude-code", join(repo, ".pregate/canary.json"))), cwd: "\0" };
  // An invalid argv makes the actual CLI exit 1; the supervisor must never forward that fail-open.
  const out = supervised(JSON.stringify(bad), "unknown-command");
  expect(out.code).toBe(2); expect(out.stderr).toContain("exit 1");
  expect(cli("disable", "--yes").code).toBe(0);
  expect(supervised("{}", "unknown-command")).toEqual({ code: 0, stdout: "", stderr: "" });
  expect(cli("enable", "--yes").code).toBe(0);
});

test("watchdog cuts off a real blocked runtime and rejects exit 2 without stderr", () => {
  const runtime = join(data, "8.8.8", ENGINE_FILE);
  mkdirSync(join(data, "8.8.8"));
  copyFileSync(process.execPath, runtime);
  const raw = writePayload("codex", join(repo, ".pregate/canary.json"));
  const start = performance.now();
  const hung = run([binary, "--supervise", data, "8.8.8", "-e", "process.stderr.write('PREGATE-CHECKPOINT dependency-review\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0)"], raw);
  expect(hung.code).toBe(2); expect(hung.stderr).toContain("timed out");
  expect(hung.stderr).toContain("last engine checkpoint: dependency-review");
  expect(performance.now() - start).toBeLessThan(8000);
  const empty = run([binary, "--supervise", data, "8.8.8", "-e", "process.stderr.write('PREGATE-CHECKPOINT rules\\n'); process.exit(2)"], raw);
  expect(empty.code).toBe(2); expect(empty.stderr).toContain("without a reason");
});

test("one redirect replays the real payload through a separately versioned engine", async () => {
  const version = "9.9.8";
  const target = join(data, version, ENGINE_FILE);
  mkdirSync(join(data, version));
  const built = await Bun.build({
    entrypoints: ["src/main.ts"], target: "bun", minify: true,
    compile: { target: `bun-${hostTarget()}`, outfile: target, autoloadDotenv: false, autoloadBunfig: false },
    plugins: [{ name: "pinned-engine-version", setup(build) {
      build.onLoad({ filter: /package\.json$/ }, () => ({ loader: "json", contents: JSON.stringify({ ...pkg, version }) }));
    } }],
  });
  expect(built.success).toBe(true);
  expect(run([target, "--version"]).stdout).toContain(`pregate ${version}`);
  const lock = join(repo, ".pregate/pregate.lock.json");
  const original = readFileSync(lock, "utf8");
  withCleanup(() => {
    const p = JSON.parse(original); p.engine = version; writeFileSync(lock, JSON.stringify(p));
    const out = supervised(writePayload("codex", join(repo, ".pregate/canary.json")), "hook", "pre", "--harness", "codex");
    expect(out.code).toBe(2); expect(out.stderr).toContain("protected-path");
    expect(out.stderr).not.toContain("could not evaluate");
  }, () => { writeFileSync(lock, original); });
});

function registeredPosixHook(): string {
  expect(cli("enable", "--yes").code).toBe(0);
  const settings = JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8"));
  return settings.hooks.PreToolUse.flatMap((group: { hooks: { command: string }[] }) => group.hooks)
    .find((hook: { command: string }) => hook.command.includes("hook pre")).command;
}

function progressEngine(markers: string, code: number): void {
  const escaped = [...Buffer.from(markers)].map(byte => `\\0${byte.toString(8).padStart(3, "0")}`).join("");
  writeFileSync(engine, `#!/bin/sh\nprintf '%b' '${escaped}' >&2\nexit ${code}\n`);
}

if (!WINDOWS) {
  test("registered POSIX NUL stderr preserves original bytes and EOF", () => {
    const command = registeredPosixHook(), original = readFileSync(engine);
    const raw = writePayload("claude-code", join(repo, "src/progress-canary.ts"));
    const markers = ["PREGATE-CHECKPOINT input\0suffix\n", "PREGATE-CHECKPOINT input\0", "PREGATE-IMPORT-REVIEW rules=pack/ABC\0suffix\n", "PREGATE-IMPORT-REVIEW completed=1.0ms\0", "notice\0secret\n", "notice\0secret", "\0", "notice é\0secret\r\n", "notice ?\\\0é"];
    withCleanup(() => {
      for (const shell of ["sh", "bash", "dash", "zsh"]) {
        for (const text of markers) {
          progressEngine("PREGATE-CHECKPOINT input\n" + text, 0);
          expect(run([shell, "-c", command], raw)).toEqual({ code: 0, stdout: "", stderr: text });
        }
      }
    }, () => { writeFileSync(engine, original); });
  });

  test("registered POSIX NUL markers cannot change nested attribution", () => {
    const command = registeredPosixHook(), original = readFileSync(engine);
    const raw = writePayload("claude-code", join(repo, "src/progress-canary.ts"));
    const rule = "PREGATE-RULE started=pack/ACTUAL-001\n", resolution = "PREGATE-RESOLUTION started\n";
    const cases: [string, string][] = [
      [rule.replace("\n", "\0suffix\n"), ""],
      [rule + "PREGATE-CHECKPOINT parse\0suffix\n", "; executing rule: pack/ACTUAL-001"],
      [rule + "PREGATE-RULE completed=pack/ACTUAL-001 2.0ms\0suffix\n", "; executing rule: pack/ACTUAL-001"],
      [rule + resolution.replace("\n", "\0suffix\n"), "; executing rule: pack/ACTUAL-001"],
      [rule + resolution + "PREGATE-RESOLUTION completed=1.0ms\0suffix\n", "; executing shared dependency resolution"],
      [rule + resolution + "PREGATE-RESOLUTION completed=1.0ms\r\n", "; executing rule: pack/ACTUAL-001"],
      [rule + resolution + "PREGATE-RESOLUTION completed=1.0ms\nPREGATE-RULE completed=pack/ACTUAL-001 2.0ms\r\n", ""],
    ];
    withCleanup(() => {
      for (const shell of ["sh", "bash", "dash", "zsh"]) {
        for (const [text, active] of cases) {
          progressEngine("PREGATE-CHECKPOINT rules\n" + text, 1);
          const out = run([shell, "-c", command], raw);
          expect(out.code).toBe(2);
          expect(out.stderr).toBe(`PREGATE could not evaluate: the engine failed (exit 1); last engine checkpoint: rules${active}; report it to the user\n`);
        }
      }
    }, () => { writeFileSync(engine, original); });
  });

  test("registered POSIX NUL fallback utility failures deny", () => {
    const command = registeredPosixHook(), original = readFileSync(engine);
    const launcher = join(data, "bin/pregate"), originalLauncher = readFileSync(launcher);
    const raw = writePayload("claude-code", join(repo, "src/progress-canary.ts"));
    withCleanup(() => {
      progressEngine("notice\0secret", 0);
      for (const utility of ["LC_ALL=C tr", "LC_ALL=C sed -n -f", "tail -c"]) {
        expect(originalLauncher.toString()).toContain(utility);
        writeFileSync(launcher, originalLauncher.toString().replace(utility, utility.startsWith("tail") ? "false -c" : "LC_ALL=C false"));
        for (const shell of ["sh", "bash", "dash", "zsh"]) {
          const out = run([shell, "-c", command], raw);
          expect(out.code).toBe(2); expect(out.stderr).toContain("engine progress could not be read");
        }
      }
    }, () => { writeFileSync(engine, original); writeFileSync(launcher, originalLauncher); });
  });

  test("registered POSIX checkpoint-only success does not need the progress parser", () => {
    expect(cli("enable", "--yes").code).toBe(0);
    const settings = JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8"));
    const command = settings.hooks.PreToolUse.flatMap((group: { hooks: { command: string }[] }) => group.hooks)
      .find((hook: { command: string }) => hook.command.includes("hook pre")).command;
    const launcher = join(data, "bin/pregate");
    const originalLauncher = readFileSync(launcher);
    const originalEngine = readFileSync(engine);
    const raw = writePayload("claude-code", join(repo, "src/progress-canary.ts"));
    withCleanup(() => {
      writeFileSync(launcher, originalLauncher.toString().replace("LC_ALL=C awk", "LC_ALL=C false"));
      for (const markers of ["", "PREGATE-CHECKPOINT input\\nPREGATE-CHECKPOINT admission\\nPREGATE-CHECKPOINT parse\\nPREGATE-CHECKPOINT rules\\nPREGATE-CHECKPOINT dependency-review\\nPREGATE-CHECKPOINT stop-inventory\\n"]) {
        writeFileSync(engine, `#!/bin/sh\nprintf '%b' '${markers}' >&2\nexit 0\n`);
        for (const shell of ["sh", "dash", "bash", "zsh"]) {
          expect(run([shell, "-c", command], raw)).toEqual({ code: 0, stdout: "", stderr: "" });
        }
      }
    }, () => { writeFileSync(launcher, originalLauncher); writeFileSync(engine, originalEngine); });
  });

  test("registered POSIX simple import metadata bypasses only the bounded clean parser path", () => {
    const command = registeredPosixHook(), original = readFileSync(engine);
    const launcher = join(data, "bin/pregate"), originalLauncher = readFileSync(launcher);
    const raw = writePayload("claude-code", join(repo, "src/progress-canary.ts"));
    const ids = Array.from({ length: 8 }, (_, i) => `pack/ABC-${i}`).join(",");
    const maximum = `p/${"A".repeat(254)}`;
    const valid = ["none", "none,more=1", "pack/ABC,another/id/leaf,more=12", ids, maximum];
    const invalid = ["", "Pack/ABC", "pack/1ABC", "pack/ABC/Leaf", "pack/ABC/leaf/extra", "pack/ABC,", "none,pack/ABC", "pack/ABC,more=0", "pack/ABC,more=01", "pack/ABC,more=x", "pack/é"];
    withCleanup(() => {
      for (const shell of ["sh", "bash", "dash", "zsh"]) {
        writeFileSync(launcher, originalLauncher.toString().replace("LC_ALL=C awk", "LC_ALL=C false"));
        for (const rules of valid) {
          progressEngine(`PREGATE-CHECKPOINT dependency-review\nPREGATE-IMPORT-REVIEW rules=${rules}\nPREGATE-IMPORT-REVIEW completed=12.3ms\n`, 0);
          expect(run([shell, "-c", command], raw)).toEqual({ code: 0, stdout: "", stderr: "" });
        }
        const malformed = [...invalid.map(rules => `PREGATE-IMPORT-REVIEW rules=${rules}\n`), ...["1ms", "1.23ms", "-1.0ms", "1.xms"].map(time => `PREGATE-IMPORT-REVIEW completed=${time}\n`)];
        const fallback = [...malformed, `PREGATE-IMPORT-REVIEW rules=${ids},pack/NINTH\n`, `PREGATE-IMPORT-REVIEW rules=${maximum}A\n`, "PREGATE-IMPORT-REVIEW rules=pack/ABC\r\n", "PREGATE-IMPORT-REVIEW completed=1.0ms", "PREGATE-IMPORT-REVIEW rules=pack/ABC\0suffix\n"];
        for (const text of fallback) {
          writeFileSync(launcher, originalLauncher);
          progressEngine(text, 0);
          const normal = run([shell, "-c", command], raw);
          expect(normal).toEqual({ code: 0, stdout: "", stderr: malformed.includes(text) || text.includes("\0") ? text : "" });
          writeFileSync(launcher, originalLauncher.toString().replace("LC_ALL=C awk", "LC_ALL=C false"));
          const failed = run([shell, "-c", command], raw);
          expect(failed.code).toBe(2); expect(failed.stderr).toContain("engine progress could not be read");
        }
      }
    }, () => { writeFileSync(launcher, originalLauncher); writeFileSync(engine, original); });
  });

  test("registered POSIX checkpoint fallback preserves bytes and fails closed", () => {
    expect(cli("enable", "--yes").code).toBe(0);
    const settings = JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8"));
    const command = settings.hooks.PreToolUse.flatMap((group: { hooks: { command: string }[] }) => group.hooks)
      .find((hook: { command: string }) => hook.command.includes("hook pre")).command;
    const launcher = join(data, "bin/pregate");
    const originalLauncher = readFileSync(launcher);
    const originalEngine = readFileSync(engine);
    const raw = writePayload("claude-code", join(repo, "src/progress-canary.ts"));
    const execute = (markers: string, code: number, shell: string) => {
      writeFileSync(engine, `#!/bin/sh\nprintf '%b' '${markers}' >&2\nexit ${code}\n`);
      return run([shell, "-c", command], raw);
    };
    withCleanup(() => {
      for (const shell of ["sh", "dash", "bash", "zsh"]) {
        for (const markers of ["PREGATE-CHECKPOINT rules\\nnotice é", "PREGATE-CHECKPOINT input extra\\n", "PREGATE-CHECKPOINT input extra", "PREGATE-CHECKPOINT input", "PREGATE-CHECKPOINT input\\r\\nnotice\\r\\n"]) {
          writeFileSync(launcher, originalLauncher);
          const normal = execute(markers, 0, shell);
          const expected = markers === "PREGATE-CHECKPOINT input" ? "" : markers.startsWith("PREGATE-CHECKPOINT rules") ? "notice é" : markers.includes("\\r") ? "notice\r\n" : markers.replaceAll("\\n", "\n");
          expect(normal).toEqual({ code: 0, stdout: "", stderr: expected });
          writeFileSync(launcher, originalLauncher.toString().replace("LC_ALL=C awk", "LC_ALL=C false"));
          const failed = execute(markers, 0, shell);
          expect(failed.code).toBe(2); expect(failed.stderr).toContain("engine progress could not be read");
        }
        for (const nul of ["PREGATE-CHECKPOINT input\\000suffix\\n", "PREGATE-CHECKPOINT input\\000"]) {
          const fallback = execute(nul, 0, shell);
          expect(fallback.code).toBe(2); expect(fallback.stderr).toContain("engine progress could not be read");
        }
        for (const markers of ["", "PREGATE-CHECKPOINT rules\\n"]) {
          const empty = execute(markers, 2, shell);
          expect(empty.code).toBe(2); expect(empty.stderr).toContain("engine denied without a reason");
        }
      }
    }, () => { writeFileSync(launcher, originalLauncher); writeFileSync(engine, originalEngine); });
  });

  test("registered POSIX hook strips completed rule/resolution progress from the compiled engine", () => {
    expect(cli("enable", "--yes").code).toBe(0);
    const settings = JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8"));
    const command = settings.hooks.PreToolUse.flatMap((group: { hooks: { command: string }[] }) => group.hooks)
      .find((hook: { command: string }) => hook.command.includes("hook pre")).command;
    const payload = JSON.parse(writePayload("claude-code", join(repo, "src/progress-canary.ts")));
    payload.tool_input.content = "export const progressCanary = 1;\n";
    const raw = JSON.stringify(payload);
    const direct = Bun.spawnSync([engine, "hook", "pre", "--harness", "claude-code"], {
      cwd: repo, env: { ...env, PREGATE_PROGRESS: "1" }, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe" });
    expect(direct.stderr.toString()).toContain("PREGATE-RULE started=");
    for (const shell of ["sh", "dash", "bash", "zsh"]) {
      const out = run([shell, "-c", command], raw);
      expect(out.code).toBe(direct.exitCode);
      expect(out.stdout + out.stderr).not.toMatch(/PREGATE-(CHECKPOINT|IMPORT-REVIEW|RULE|RESOLUTION)/);
    }
  });

  test("registered POSIX hook attributes nested active work and preserves malformed tags", () => {
    expect(cli("enable", "--yes").code).toBe(0);
    const settings = JSON.parse(readFileSync(join(home, ".claude/settings.json"), "utf8"));
    const command = settings.hooks.PreToolUse.flatMap((group: { hooks: { command: string }[] }) => group.hooks)
      .find((hook: { command: string }) => hook.command.includes("hook pre")).command;
    const backup = join(area, "progress-original-engine");
    copyFileSync(engine, backup);
    const raw = writePayload("claude-code", join(repo, "src/progress-canary.ts"));
    const execute = (markers: string, end: string, shell = "sh") => {
      writeFileSync(engine, `#!/bin/sh\nprintf '%s' '${markers}' >&2\n${end}\n`);
      return run([shell, "-c", command], raw);
    };
    withCleanup(() => {
      const rule = "PREGATE-CHECKPOINT rules\nPREGATE-RULE started=pack/ACTUAL-001\n";
      const started = performance.now();
      const unfinished = execute(rule, "exec /bin/sleep 60");
      expect(unfinished.code).toBe(2); expect(unfinished.stderr).toContain("executing rule: pack/ACTUAL-001");
      expect(performance.now() - started).toBeGreaterThanOrEqual(4_900);
      expect(performance.now() - started).toBeLessThan(8_000);
      const nested = execute(rule + "PREGATE-RESOLUTION started\n", "exec /bin/sleep 60");
      expect(nested.code).toBe(2); expect(nested.stderr).toContain("executing shared dependency resolution");
      expect(nested.stderr).not.toContain("executing rule");
      const crash = execute(rule + "PREGATE-RESOLUTION started\nPREGATE-RESOLUTION completed=1.0ms\n", "exit 1");
      expect(crash.code).toBe(2); expect(crash.stderr).toContain("exit 1");
      expect(crash.stderr).toContain("executing rule: pack/ACTUAL-001");
      const completed = execute(rule + "PREGATE-RULE completed=pack/ACTUAL-001 2.0ms\n", "exec /bin/sleep 60");
      expect(completed.code).toBe(2); expect(completed.stderr).not.toContain("executing rule");
      expect(completed.stderr).not.toContain("pack/ACTUAL-001");
      const forged = `PREGATE-RULE started=pack/${"A".repeat(257)}\r\nPREGATE-RULE completed=pack/BAD badms\nPREGATE-RESOLUTION started /private/source\nnotice é`;
      for (const shell of ["sh", "dash", "bash", "zsh"]) {
        const normal = execute(rule + "PREGATE-RESOLUTION started\r\nPREGATE-RESOLUTION completed=1.0ms\r\nPREGATE-RULE completed=pack/ACTUAL-001 2.0ms\n" + forged, "exit 0", shell);
        expect(normal).toEqual({ code: 0, stdout: "", stderr: forged });
        const noReason = execute(rule + "PREGATE-RULE completed=pack/ACTUAL-001 2.0ms\n", "exit 2", shell);
        expect(noReason.code).toBe(2); expect(noReason.stderr).toContain("without a reason");
      }
    }, () => { copyFileSync(backup, engine); rmSync(backup); });
  });
}

if (WINDOWS) {
  test("Windows default storage, drive/extended paths and junction consent use the same gate", () => {
    const launcher = join(data, "bin/launcher.ps1");
    const modified = statSync(launcher).mtimeMs;
    expect(cli("setup").code).toBe(0);
    expect(statSync(launcher).mtimeMs).toBe(modified);
    expect(run(["bash.exe", "-c", `'${join(data, "bin/pregate").replaceAll("\\", "/")}' --version`]).stdout).toContain(`pregate ${pkg.version}`);
    const alias = join(area, "junction");
    symlinkSync(repo, alias, "junction");
    const raw = JSON.parse(writePayload("agy", join(alias, ".PREGATE/canary.json")));
    raw.workspacePaths = [alias];
    raw.toolCall.args.TargetFile = `\\\\?\\${join(alias, ".PREGATE/canary.json").replaceAll("/", "\\")}`;
    expect(supervised(JSON.stringify(raw), "hook", "pre", "--harness", "agy").stdout).toContain("protected-path");
    const original = readFileSync(launcher, "utf8");
    withCleanup(() => {
      rmSync(launcher);
      const missing = run(["cmd.exe", "/d", "/c", windowsHook(data, "pre", "agy")], JSON.stringify(raw), alias);
      expect(missing.code).toBe(2);
    }, () => { writeFileSync(launcher, original); });
  });
  test.each(["cmd", "powershell", "bash"])("registered Windows hook through %s handles Unicode and missing launcher", (shell) => {
    const command = windowsHook(data, "pre", "agy");
    // PowerShell -Command otherwise maps every native nonzero exit to 1.
    const argv = shell === "cmd" ? ["cmd.exe", "/d", "/c", command] : shell === "powershell" ? ["powershell.exe", "-NoProfile", "-Command", `${command}; exit $LASTEXITCODE`] : ["bash.exe", "-c", command];
    const raw = writePayload("agy", join(repo, ".pregate/canary.json"));
    const out = run(argv, raw, home);
    expect(out.code).toBe(0); expect(JSON.parse(out.stdout).decision).toBe("deny");
    const launcher = join(data, "bin/launcher.ps1");
    const original = readFileSync(launcher, "utf8");
    withCleanup(() => {
      rmSync(launcher);
      const absent = run(argv, raw, home);
      expect(absent.code).toBe(2); expect(absent.stderr).toContain("launcher failed");
      expect(cli("disable", "--yes").code).toBe(0);
      expect(run(argv, raw, home)).toEqual({ code: 0, stdout: "", stderr: "" });
    }, () => { writeFileSync(launcher, original); cli("enable", "--yes"); });
  });

  test("Windows doctor canary, update of an installed engine and uninstall preserve the repository", async () => {
    const lock = readFileSync(join(repo, ".pregate/pregate.lock.json"), "utf8");
    expect(cli("doctor").stdout).toContain("claude-code: canary denied");
    expect(cli("update", "--engine", pkg.version).code).toBe(0);
    expect(cli("update", "--version", pkg.version).code).toBe(0);
    expect(readFileSync(join(repo, ".pregate/pregate.lock.json"), "utf8")).toBe(lock);
    const out = run(["cmd.exe", "/d", "/c", join(data, "bin/pregate.cmd"), "uninstall", "--yes"]);
    expect(out.code).toBe(0);
    for (let n = 0; n < 100 && existsSync(data); n++) await Bun.sleep(50);
    expect(existsSync(data)).toBe(false);
    expect(existsSync(join(repo, ".pregate/preset.json"))).toBe(true);
  });
}
