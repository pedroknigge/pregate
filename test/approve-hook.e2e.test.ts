import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { confirmOnTerminal } from "../scripts/confirm-terminal.ts";
import { LOCK, PRESET } from "../src/admission.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { engineAt } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// A repository hook that exits 1. Git forwards these lines on its own stderr. The first three
// sit above the ten lines pregate keeps; "pnpm install" is the reason a person needs to see.
const HOOK = `#!/bin/sh
echo hook-01 >&2
echo hook-02 >&2
echo hook-03 >&2
echo hook-04 >&2
echo hook-05 >&2
echo hook-06 >&2
echo hook-07 >&2
echo hook-08 >&2
echo hook-09 >&2
echo hook-10 >&2
echo hook-11 >&2
echo hook-12 >&2
echo "pnpm install" >&2
exit 1
`;

test("approve shows a failing pre-commit hook and leaves the contract staged", () => {
  const area = mkdtempSync(join(tmpdir(), "pregate-approve-hook-"));
  try {
    const root = join(area, "repo");
    const binary = join(area, ENGINE_FILE);
    engineAt(binary, true);
    mkdirSync(join(area, "home"), { recursive: true });
    const env: Record<string, string | undefined> = {
      ...process.env, HOME: join(area, "home"), USERPROFILE: join(area, "home"),
      XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
      TMPDIR: area, TEMP: area, TMP: area, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: join(area, "gitconfig"),
      GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com",
    };
    delete env.CI; delete env.PREGATE_UNATTENDED_APPROVAL; delete env.PREGATE_TESTING; delete env.PREGATE_TEST_ANSWER;
    writeFileSync(env.GIT_CONFIG_GLOBAL!, "");
    const git = (...args: string[]) => {
      const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
      if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
      return out.stdout.toString().trim();
    };
    mkdirSync(root);
    git("init", "-q", "-b", "main");
    git("config", "user.name", "t");
    git("config", "user.email", "t@example.com");
    git("config", "commit.gpgsign", "false");
    writeFileSync(join(root, "work.ts"), "export const work = 1;\n");
    git("add", "-A");
    git("commit", "-qm", "base");
    const head = git("rev-parse", "HEAD");
    mkdirSync(join(root, ".githooks"));
    const hook = join(root, ".githooks/pre-commit");
    writeFileSync(hook, HOOK, { mode: 0o755 });
    chmodSync(hook, 0o755);
    git("config", "core.hooksPath", ".githooks");
    expect(git("config", "--get", "core.hooksPath")).toBe(".githooks");
    const preview = Bun.spawnSync([binary, "init", "--preview", "--preset", "legacy-safe"], {
      cwd: root, env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 90_000,
    });
    expect(preview.exitCode, preview.stdout.toString() + preview.stderr.toString()).toBe(0);
    const approved = approve(binary, root, env);
    expect(approved.code, approved.text).toBe(0);
    expect(approved.text).toContain("Applied but not committed.");
    expect(approved.text).toContain(`Commit it with: git add -A -- ${PRESET} ${LOCK} && git commit -m "chore: apply reviewed PREGATE contract`);
    expect(approved.text).toMatch(/git commit -m "chore: apply reviewed PREGATE contract [0-9a-f]{12}" -- \.pregate\/preset\.json \.pregate\/pregate\.lock\.json/);
    expect(approved.text).not.toContain("--no-verify");
    expect(approved.text).toContain("earlier lines omitted");
    expect(approved.text).toContain("pnpm install");
    expect(approved.text).toContain("hook-12");
    expect(approved.text).not.toContain("hook-01");
    expect(approved.text).not.toContain("hook-02");
    expect(approved.text).not.toContain("hook-03");
    expect(git("rev-parse", "HEAD")).toBe(head);
    expect(git("diff", "--cached", "--name-only").split("\n").filter(Boolean).sort()).toEqual([LOCK, PRESET].sort());
    expect(git("ls-tree", "-r", "--name-only", "HEAD").split("\n")).not.toContain(PRESET);
    expect(git("ls-tree", "-r", "--name-only", "HEAD").split("\n")).not.toContain(LOCK);
  } finally {
    removeTree(area);
  }
}, 180_000);

// Windows has no POSIX pty. The same compiled CLI still runs there, and the test build accepts
// the typed answer through the documented test hook. POSIX types y on a real terminal.
function approve(binary: string, root: string, env: Record<string, string | undefined>): { code: number; text: string } {
  if (WINDOWS) {
    const result = Bun.spawnSync([binary, "approve"], {
      cwd: root, env: { ...env, PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: "y" },
      stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 90_000,
    });
    return { code: result.exitCode ?? 1, text: result.stdout.toString() + result.stderr.toString() };
  }
  const confirmed = confirmOnTerminal([binary, "approve"], root, env, "y");
  return { code: confirmed.code, text: confirmed.stdout + confirmed.stderr };
}
