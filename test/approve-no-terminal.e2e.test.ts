import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

// A harness `!` line: stdin is a pipe, and setsid (detached) leaves no controlling terminal.
// The release binary cannot be answered by PREGATE_TEST_ANSWER.
test("a detached approve with piped stdin names the root and command and leaves the proposal", async () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-no-terminal-"));
  try {
    const root = canonical(join(area, "repo"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/a.ts"), "export const value = 1;\n");
    expect(Bun.spawnSync(["git", "init", "-q", "-b", "main", root]).exitCode).toBe(0);
    const binary = join(area, ENGINE_FILE);
    engineAt(binary, false);
    const data = join(area, "data");
    const env: Record<string, string | undefined> = {
      ...process.env, HOME: join(area, "home"), XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"),
      TMPDIR: area, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
      GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
    };
    delete env.PREGATE_TESTING; delete env.PREGATE_TEST_ANSWER;
    const preview = Bun.spawnSync([binary, "init", "--preview", "--preset", "legacy-safe"], {
      cwd: root, env, stdout: "pipe", stderr: "pipe",
    });
    expect(preview.exitCode, preview.stdout.toString() + preview.stderr.toString()).toBe(0);
    const digest = /Digest: ([a-f0-9]{64})/.exec(preview.stdout.toString())?.[1];
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    const code = digest!.slice(0, 12);
    const pending = join(data, "pregate", "proposals");
    const before = readFileSync(join(pending, readdirSync(pending).find((name) => name.endsWith(".json"))!), "utf8");
    const human: Record<string, string | undefined> = { ...env, CI: "", PREGATE_UNATTENDED_APPROVAL: "" };
    delete human.PREGATE_TESTING; delete human.PREGATE_TEST_ANSWER;
    const refused = await detached([binary, "approve"], root, human);
    const text = refused.stdout + refused.stderr;
    expect(refused.code, text).toBe(1);
    expect(text).toContain(root);
    expect(text).toContain("pregate approve");
    expect(text).toContain(WINDOWS ? "Open a new PowerShell window in" : "Open Terminal/iTerm in");
    expect(text).toContain("no terminal");
    expect(existsSync(join(root, ".pregate/pregate.lock.json"))).toBe(false);
    const after = readdirSync(pending).filter((name) => name.endsWith(".json")).map((name) => readFileSync(join(pending, name), "utf8"));
    expect(after).toEqual([before]);
    const accepted = await detached([binary, "approve", code], root, human);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(existsSync(join(root, ".pregate/pregate.lock.json"))).toBe(true);
    expect(existsSync(join(root, ".pregate/preset.json"))).toBe(true);
  } finally {
    removeTree(area);
  }
}, 120_000);

function detached(cmd: string[], cwd: string, env: Record<string, string | undefined>): Promise<{ code: number; stdout: string; stderr: string }> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) if (value !== undefined) clean[key] = value;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd[0]!, cmd.slice(1), { cwd, env: clean, detached: true, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [], err: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => err.push(chunk));
    child.stdin?.end();
    const timer = setTimeout(() => { child.kill(); reject(new Error("detached approve did not exit")); }, 90_000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() });
    });
  });
}
