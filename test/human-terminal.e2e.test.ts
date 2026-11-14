import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { confirmOnTerminal } from "../scripts/confirm-terminal.ts";
import { canonical } from "../src/disk.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

// The release binary, not the test build: PREGATE_TEST_ANSWER cannot answer it.
// The bench and the language smoke use this same terminal helper.
test.skipIf(process.platform === "win32")("a release binary enables only after y is typed on the terminal", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-human-terminal-"));
  try {
    const root = join(area, "repo");
    mkdirSync(join(root, ".pregate"), { recursive: true });
    writeFileSync(join(root, ".pregate/preset.json"), readFileSync("catalog/presets/legacy-safe.json", "utf8"));
    expect(Bun.spawnSync(["git", "init", "-q", "-b", "main", root]).exitCode).toBe(0);
    const binary = join(area, ENGINE_FILE);
    engineAt(binary, false);
    const env: Record<string, string | undefined> = {
      ...process.env, HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"),
      TMPDIR: area, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: "y",
    };
    const status = () => Bun.spawnSync([binary, "status"], { cwd: root, env, stdout: "pipe", stderr: "pipe" }).stdout.toString();
    const piped = Bun.spawnSync([binary, "enable", "--yes"], { cwd: root, env: { ...env, CI: "", PREGATE_UNATTENDED_APPROVAL: "" }, stdin: Buffer.from("y\n"), stdout: "pipe", stderr: "pipe" });
    expect(piped.exitCode).toBe(1);
    expect(piped.stdout.toString()).toContain("no terminal");
    expect(piped.stdout.toString()).toContain(canonical(root));
    expect(piped.stdout.toString()).toContain("pregate enable");
    expect(status()).toContain("is inactive");

    // CI and the test answer are in the environment on purpose. The helper removes them,
    // so --yes still has to show the prompt, and n does not enable.
    const declined = confirmOnTerminal([binary, "enable", "--yes"], root, env, "n");
    expect(declined.stdout, declined.stderr).toContain("Approve?");
    expect(declined.code).toBe(1);
    expect(status()).toContain("is inactive");

    const accepted = confirmOnTerminal([binary, "enable"], root, env, "y");
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(accepted.stdout).toContain("Approve?");
    expect(status()).toContain("is active");
  } finally {
    removeTree(area);
  }
}, 120_000);

// A code or --yes applies with stdin piped. A bare approve still refuses.
test("a reviewed init proposal applies from a pipe when it carries --yes, and a bare approve does not", async () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-review-fixture-"));
  const previous = process.env.XDG_DATA_HOME;
  try {
    const root = join(area, "starter");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src/a.ts"), "export const value = 1;\n");
    const binary = join(area, ENGINE_FILE);
    engineAt(binary, false);
    const data = join(area, "data");
    const env: Record<string, string | undefined> = {
      ...process.env, HOME: join(area, "home"), XDG_DATA_HOME: data, XDG_STATE_HOME: join(area, "state"),
      TMPDIR: area, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    };
    delete env.PREGATE_TESTING; delete env.PREGATE_TEST_ANSWER;
    const preview = Bun.spawnSync([binary, "init", "--preview", "--preset", "legacy-safe"], {
      cwd: root, env, stdout: "pipe", stderr: "pipe",
    });
    expect(preview.exitCode, preview.stdout.toString() + preview.stderr.toString()).toBe(0);
    const digest = /Digest: ([a-f0-9]{64})/.exec(preview.stdout.toString())?.[1];
    expect(digest, preview.stdout.toString()).toMatch(/^[a-f0-9]{64}$/);
    const human = { ...env, CI: "", PREGATE_UNATTENDED_APPROVAL: "" };
    const bare = Bun.spawnSync([binary, "approve"], {
      cwd: root, env: human, stdin: Buffer.from("y\n"), stdout: "pipe", stderr: "pipe",
    });
    expect(bare.exitCode).toBe(1);
    expect(bare.stdout.toString()).toContain("no terminal");
    expect(existsSync(join(root, ".pregate/pregate.lock.json"))).toBe(false);
    const piped = Bun.spawnSync([binary, "approve", "--yes", "--digest", digest!], {
      cwd: root, env: human, stdin: Buffer.from("y\n"), stdout: "pipe", stderr: "pipe",
    });
    expect(piped.exitCode, piped.stdout.toString() + piped.stderr.toString()).toBe(0);
    expect(existsSync(join(root, ".pregate/preset.json"))).toBe(true);
    expect(existsSync(join(root, ".pregate/pregate.lock.json"))).toBe(true);
  } finally {
    if (previous === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = previous;
    removeTree(area);
  }
}, 120_000);
