import { afterAll, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERSIONS } from "../src/gate.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { engineAt } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Real agy, not a stand-in for the release-binary tests. CI has no agy binary and no
// Google account, so this file runs only when AGY_BIN is the CLI (agy 1.5.7 or newer).
// Antigravity 1.5.7 made Auto the default where the enable-auto-permission-preset
// rollout is on, and Default where it is off. This host's 1.5.9 CLI refuses
// `--mode=auto` ("not available for this account") and continues in Default. The
// assertions below are that session: deny still blocks, a never-enabled checkout and
// a disabled checkout get an empty hook reply, and headless `-p` does not apply
// `pregate approve`. They also hold if a future account does enter Auto. A local
// Gemini stand-in only supplies the tool call. The permission decision is agy's.

const agyBin = process.env.AGY_BIN;
const live = typeof agyBin === "string" && agyBin.length > 0 && existsSync(agyBin);
const area = live ? mkdtempSync(join(tmpdir(), "pregate-agy-auto-")) : "";

afterAll(() => { if (area !== "") removeTree(area); });

test.skipIf(!live)("real agy: deny blocks and headless approve does not apply, including when Auto is refused", async () => {
  const binary = join(area, "engine", "pregate", VERSIONS.engine, ENGINE_FILE);
  engineAt(binary, false);
  const version = Bun.spawnSync([agyBin!, "--version"], { stdout: "pipe", stderr: "pipe" });
  const versionText = version.stdout.toString() + version.stderr.toString();
  expect(version.exitCode, versionText).toBe(0);
  expect(atLeast(versionText, [1, 5, 7]), versionText).toBe(true);

  const home = join(area, "home");
  const data = join(area, "data");
  const bin = join(area, "bin");
  mkdirSync(join(home, ".gemini", "antigravity-cli"), { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(home, ".gemini", "antigravity-cli", "settings.json"), JSON.stringify({ modelProvider: "gemini", agentMode: "auto" }));
  writeFileSync(join(bin, "pregate"), `#!/bin/sh\nexec '${binary}' "$@"\n`);
  chmodSync(join(bin, "pregate"), 0o755);

  const calls = new Map<string, { name: string; args: Record<string, unknown> }>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      if (req.method !== "POST") return new Response("{}", { headers: { "Content-Type": "application/json" } });
      const body = await req.text();
      const answered = body.includes("functionResponse") || body.includes("function_response");
      const call = answered ? undefined : [...calls].find(([name]) => body.includes(name))?.[1];
      const parts = call === undefined ? [{ text: "finished" }] : [{ functionCall: call }];
      const payload = { candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }] };
      return new Response(`data: ${JSON.stringify(payload)}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    },
  });

  try {
    const base = setupEnv(data, home, bin);
    const enabled = repo("enabled", true, base, binary);
    const never = repo("never", false, base, binary);
    const disabled = repo("disabled", true, base, binary);
    const off = Bun.spawnSync([binary, "disable", "--yes"], {
      cwd: disabled, env: { ...base, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe", timeout: 60_000,
    });
    expect(off.exitCode, off.stdout.toString() + off.stderr.toString()).toBe(0);
    const approve = repo("approve", true, base, binary);
    writeFileSync(join(approve, "loosen.json"), JSON.stringify({ why: "advisor first", patch: [{ op: "replace", path: "/enforcement", value: "advisor" }] }));
    const preview = Bun.spawnSync([binary, "preset", "apply", "loosen.json", "--preview"], {
      cwd: approve, env: { ...base, PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe", timeout: 60_000,
    });
    const previewText = preview.stdout.toString() + preview.stderr.toString();
    expect(preview.exitCode, previewText).toBe(0);
    const digest = /Digest: ([a-f0-9]{64})/.exec(previewText)?.[1];
    expect(digest, previewText).toMatch(/^[a-f0-9]{64}$/);
    const code = digest!.slice(0, 12);

    const preset = (root: string) => readFileSync(join(root, ".pregate/preset.json"), "utf8");
    const lock = (root: string) => readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8");
    const enabledPreset = preset(enabled);
    const approvePreset = preset(approve);
    const approveLock = lock(approve);
    const logPath = join(data, "pregate", "contract-approvals", "log.jsonl");
    const logBefore = readFileSync(logPath, "utf8");

    calls.set("case-deny", { name: "write_file", args: { Path: join(enabled, ".pregate/preset.json"), Content: "{\"hacked\":true}\n", Overwrite: true } });
    calls.set("case-never", { name: "write_file", args: { Path: join(never, "src/note.ts"), Content: "export const note = 1;\n", Overwrite: true } });
    calls.set("case-disabled", { name: "write_file", args: { Path: join(disabled, "src/note.ts"), Content: "export const note = 1;\n", Overwrite: true } });
    calls.set("case-skip", { name: "write_file", args: { Path: join(enabled, ".pregate/preset.json"), Content: "{\"hacked\":true}\n", Overwrite: true } });
    calls.set("case-approve", { name: "run_command", args: { CommandLine: `pregate approve ${code}`, toolSummary: "Apply reviewed contract", WaitMsBeforeAsync: 1000 } });

    const deny = await launch(enabled, "case-deny", server.port!, base, binary, []);
    const untouched = await launch(never, "case-never", server.port!, base, binary, []);
    const stopped = await launch(disabled, "case-disabled", server.port!, base, binary, []);
    const skipped = await launch(enabled, "case-skip", server.port!, base, binary, ["--dangerously-skip-permissions"]);
    const asked = await launch(approve, "case-approve", server.port!, base, binary, []);

    const evidence = [deny, untouched, stopped, skipped, asked].map((item) => item.stderr + item.log).join("\n");
    const autoRefused = /not available for this account|rollout flag off|auto mode is unavailable, falling back/.test(evidence);
    const autoEntered = /Auto mode: edits & safe commands auto-approved/.test(evidence) && !autoRefused;
    expect(autoRefused || autoEntered, evidence).toBe(true);

    expect(deny.hook, deny.stderr).toContain('"decision":"deny"');
    expect(preset(enabled), "deny left the contract in place").toBe(enabledPreset);
    expect(skipped.hook, skipped.stderr).toContain('"decision":"deny"');
    expect(preset(enabled), "skip-permissions did not bypass deny").toBe(enabledPreset);
    for (const item of [untouched, stopped]) {
      expect(existsSync(join(item.dir, "stdin.json")), item.stderr).toBe(true);
      expect(item.hook, item.stderr).toBe("");
      expect(item.hook).not.toContain("deny");
    }
    expect(existsSync(join(asked.dir, "stdin.json")), asked.stderr).toBe(true);
    expect(asked.hook === "" || asked.hook.includes('"decision":"force_ask"'), asked.hook).toBe(true);
    expect(asked.hook).not.toContain('"decision":"deny"');
    expect(lock(approve), "headless approve did not apply").toBe(approveLock);
    expect(preset(approve), "headless approve did not apply").toBe(approvePreset);
    expect(readFileSync(logPath, "utf8"), "headless approve wrote no approval record").toBe(logBefore);
  } finally {
    server.stop(true);
  }
}, 180_000);

function atLeast(version: string, floor: number[]): boolean {
  const parts = version.trim().split(/[^0-9]+/).filter((part) => part !== "").map(Number);
  for (let i = 0; i < floor.length; i++) {
    const got = parts[i] ?? 0;
    const want = floor[i]!;
    if (got > want) return true;
    if (got < want) return false;
  }
  return true;
}

function setupEnv(data: string, home: string, bin: string): Record<string, string> {
  return {
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    HOME: home, USERPROFILE: home,
    XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"), TMPDIR: join(area, "tmp"),
    GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  };
}

function repo(name: string, enable: boolean, env: Record<string, string>, binary: string): string {
  const root = join(area, name);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/a.ts"), "export const value = 1;\n");
  const git = Bun.spawnSync(["git", "init", "-q", "-b", "main"], { cwd: root, env, stdout: "pipe", stderr: "pipe" });
  expect(git.exitCode, git.stderr.toString()).toBe(0);
  if (!enable) return root;
  const init = Bun.spawnSync([binary, "init", "--yes", "--preset", "legacy-safe"], {
    cwd: root, env: { ...env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  expect(init.exitCode, init.stdout.toString() + init.stderr.toString()).toBe(0);
  return root;
}

async function launch(root: string, name: string, port: number, env: Record<string, string>, binary: string, extra: string[]): Promise<{ dir: string; hook: string; stderr: string; log: string }> {
  const dir = join(area, "runs", name);
  mkdirSync(dir, { recursive: true });
  const hook = join(dir, "hook.sh");
  writeFileSync(hook, "#!/bin/sh\ncat > \"$1/stdin.json\"\n\"$PREGATE\" hook pre --harness agy < \"$1/stdin.json\" > \"$1/stdout.json\" 2> \"$1/hook-stderr.txt\"\ncode=$?\ncat \"$1/stdout.json\"\nexit \"$code\"\n");
  chmodSync(hook, 0o755);
  mkdirSync(join(root, ".agents"), { recursive: true });
  writeFileSync(join(root, ".agents/hooks.json"), JSON.stringify({
    probe: { enabled: true, PreToolUse: [{ matcher: ".*", hooks: [{ type: "command", command: `sh ${hook} ${dir}`, timeout: 30 }] }] },
  }));
  const log = join(dir, "agy.log");
  // spawnSync would block the mock server in this same process, so agy would wait out the print timeout.
  const result = Bun.spawn([
    agyBin!, "-p", `Do the tool for ${name}. Do not explain.`, "--mode=auto",
    "--model", `gemini-api://127.0.0.1:${port}/v1beta/models/gemini-3.1-pro-low`,
    "--print-timeout", "15s", "--output-format", "json", "--log-file", log, ...extra,
  ], {
    cwd: root,
    env: {
      ...env,
      GEMINI_API_KEY: "test-key",
      GOOGLE_GEMINI_BASE_URL: `http://127.0.0.1:${port}`,
      PREGATE: binary,
    },
    stdout: "pipe", stderr: "pipe",
  });
  const timer = setTimeout(() => result.kill(), 20_000);
  const code = await result.exited;
  clearTimeout(timer);
  const stderr = await new Response(result.stderr).text();
  const stdout = await new Response(result.stdout).text();
  expect(code, `${name}\n${stderr}\n${stdout}`).toBe(0);
  const stdoutPath = join(dir, "stdout.json");
  return { dir, hook: existsSync(stdoutPath) ? readFileSync(stdoutPath, "utf8") : "", stderr, log: existsSync(log) ? readFileSync(log, "utf8") : "" };
}
