import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { approvalText } from "../src/contract.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { canonical } from "../src/disk.ts";

test("approval text preserves complete multiline Unicode, quotes and percent signs without terminal escapes", () => {
  const summary = 'Tightens core/example.\nQuoted "name", percent %s, apostrophe \' and →.\n' + "abcdefghij".repeat(2000);
  expect(approvalText(summary, true)).toBe(`WARNING: this may weaken protection.\n\n${summary}\n\nApprove? [y/N] `);
  expect(approvalText(summary, true, false)).toBe(`WARNING: this may weaken protection.\n\n${summary}\n\n`);
  expect(approvalText("\x1b\x00\x07\x08\rDo not hide the warning", false)).toBe("Do not hide the warning\n\nApprove? [y/N] ");
});

test("compiled approval defaults No, refuses piped stdin and preserves the exact summary bytes", () => {
  removedAfter(mkdtempSync(join(tmpdir(), "pregate-tty-")), area => {
    const root = canonical(join(area, WINDOWS ? 'repo with spaces, %s and →' : 'repo with "quotes", %s and →'));
    mkdirSync(root);
    expect(Bun.spawnSync(["git", "init", "-q", root]).exitCode).toBe(0);
    mkdirSync(join(root, ".pregate"));
    writeFileSync(join(root, ".pregate/preset.json"), readFileSync("catalog/presets/legacy-safe.json", "utf8"));
    const binary = join(area, ENGINE_FILE);
    compileBinary(hostTarget(), binary, true);
    const env = { ...process.env, HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"),
      TMPDIR: area, CODEX_HOME: join(area, "codex"), GROK_HOME: join(area, "grok") };
    const tty = (answer: string, ...args: string[]) => {
      const result = Bun.spawnSync([binary, ...args], { cwd: root, env: { ...env, PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: answer }, stdin: Buffer.from("y\n"), stdout: "pipe", stderr: "pipe", timeout: 5_000 });
      return { code: result.exitCode, text: result.stdout.toString() };
    };
    expect(Bun.spawnSync([binary, "enable"], { cwd: root, env: { ...env, CI: "1" }, stdin: Buffer.from("y\n"), timeout: 5_000 }).exitCode).toBe(1);
    expect(Bun.spawnSync([binary, "enable"], { cwd: root, env: { ...env, CI: "1" }, stdin: "inherit", timeout: 5_000 }).exitCode).toBe(1);
    const no = tty("", "enable");
    expect(no.code).toBe(1);
    expect(no.text).toContain(`Enable protection for worktree ${root}.\n\nApprove? [y/N] `);
    expect(tty("N", "enable").code).toBe(1);
    expect(tty("I approve", "enable").code).toBe(1);
    expect(tty("y", "enable").code).toBe(0);
    const status = () => Bun.spawnSync([binary, "status"], { cwd: root, env }).stdout.toString();
    expect(status()).toContain("is active");
    expect(tty("", "disable").code).toBe(1);
    expect(status()).toContain("is active");
    expect(tty("y", "disable").code).toBe(0);
    expect(status()).toContain("is inactive");
    const automated = Bun.spawnSync([binary, "enable", "--yes"], { cwd: root, env: { ...env, CI: "1" }, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5_000 });
    expect(automated.exitCode).toBe(0);
    expect(automated.stdout.toString()).toContain(`Enable protection for worktree ${root}.`);
    expect(automated.stdout.toString()).not.toContain("Approve? [y/N]");
    expect(status()).toContain("is active");
    // uninstall removes every project's protection: the same terminal rule as disable.
    const piped = Bun.spawnSync([binary, "uninstall"], { cwd: root, env, stdin: Buffer.from("y\n"), stdout: "pipe", stderr: "pipe", timeout: 5_000 });
    expect(piped.exitCode).toBe(1);
    expect(piped.stdout.toString()).toContain("pregate uninstall is a human-only command");
    expect(tty("n", "uninstall").code).toBe(1);
    expect(tty("", "uninstall", "--purge").text).toContain("Approve? [y/N] ");
    expect(tty("y", "uninstall", "--purge").code).toBe(0);
  });
}, 30_000);

function removedAfter(area: string, use: (area: string) => void): void {
  try { use(area); } finally { removeTree(area); }
}

// Windows keeps a just-executed pregate.exe mapped for a moment. The test already finished;
// the delete is repeated only while the image is still locked, and a lasting lock still fails.
function removeTree(area: string): void {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 20; attempt++) {
    try { rmSync(area, { recursive: true, force: true }); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EBUSY" && code !== "EPERM" && code !== "ENOTEMPTY") throw error;
      Atomics.wait(pause, 0, 0, 50);
    }
  }
  rmSync(area, { recursive: true, force: true });
}
