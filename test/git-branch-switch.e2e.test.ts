import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { enable } from "../src/consent.ts";
import { hookCommand } from "../src/register.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// Issue 98, through the compiled agy pre-command hook: a clean `git switch <branch>` and
// `git checkout <branch>` of a branch that already exists are allowed. Dirty worktrees,
// path checkouts, detach, force, and a branch that rewrites .pregate stay denied.

setDefaultTimeout(120_000);

const DEMO = join(import.meta.dir, "demo-repo");
const PRESET = join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json");
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-branch-switch-e2e-")));
const BIN = join(TMP, "bin/pregate");
const HOME = join(TMP, "home");
const DATA = join(TMP, "data");
const ENGINE_DATA = join(DATA, "pregate");
const PRESET_FILE = ".pregate/preset.json";

type Env = Record<string, string>;
interface Out { code: number; stdout: string; stderr: string }
interface Repo { dir: string; env: Env }

beforeAll(() => {
  mkdirSync(HOME, { recursive: true });
  mkdirSync(join(HOME, ".claude"), { recursive: true });
  mkdirSync(join(TMP, "tmp"), { recursive: true });
  engineAt(BIN, true);
  ok(run([BIN, "setup"], HOME, envOf()), "setup");
  template = buildTemplate();
});

afterAll(() => removeTree(TMP));

let template = "";
let states = 0;
let steps = 0;

function envOf(extra: Env = {}): Env {
  return {
    PATH: pathWithoutHarnesses([join(HOME, ".local/bin"), join(DATA, "pregate", "bin")]), HOME, TMPDIR: join(TMP, "tmp"),
    XDG_DATA_HOME: DATA, XDG_STATE_HOME: join(TMP, "state", String(++states)),
    GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
    ...(process.platform === "win32" ? { USERPROFILE: HOME, LOCALAPPDATA: DATA, APPDATA: join(TMP, "config"), SystemRoot: process.env.SystemRoot ?? "C:\\Windows" } : {}),
    ...extra,
  };
}

function run(cmd: string[], cwd: string, env: Env, stdin = ""): Out {
  const r = Bun.spawnSync(cmd, { cwd, env, stdin: new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode ?? -1, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function ok(o: Out, what: string): Out {
  if (o.code !== 0) throw new Error(`${what} exited ${o.code}\n${o.stdout}\n${o.stderr}`);
  return o;
}

function buildTemplate(): string {
  const dir = join(TMP, "template");
  const env = envOf();
  cpSync(DEMO, dir, { recursive: true });
  const git = (...args: string[]) => ok(run(["git", ...args], dir, env), args.join(" "));
  git("init", "-q", "-b", "main");
  git("config", "maintenance.auto", "false");
  git("config", "gc.auto", "0");
  git("config", "core.autocrlf", "false");
  git("add", "-A");
  git("commit", "-q", "-m", "demo");
  mkdirSync(join(dir, ".pregate"), { recursive: true });
  writeFileSync(join(dir, PRESET_FILE), policyFixture(readFileSync(PRESET, "utf8")));
  ok(run([BIN, "preset", "compile"], dir, env), "preset compile");
  git("add", "-A");
  git("commit", "-q", "-m", "pregate");
  return dir;
}

function fresh(): Repo {
  const dir = join(TMP, "repos", randomUUID());
  cpSync(template, dir, { recursive: true });
  enable(dir, ENGINE_DATA);
  return { dir, env: envOf() };
}

const git = (r: Repo, ...args: string[]): Out => run(["git", ...args], r.dir, r.env);
function commit(r: Repo, message: string): void {
  ok(git(r, "add", "-A"), "git add");
  ok(git(r, "commit", "-q", "-m", message), "git commit");
}
function put(r: Repo, rel: string, text: string): void {
  mkdirSync(dirname(join(r.dir, rel)), { recursive: true });
  writeFileSync(join(r.dir, rel), text);
}

function agy(r: Repo, sid = randomUUID()) {
  const hook = (sub: "pre" | "session-start", payload: object) =>
    run(["sh", "-c", hookCommand(ENGINE_DATA, sub, "agy")], r.dir, r.env, JSON.stringify(payload));
  const base = { conversationId: sid, cwd: r.dir, workspacePaths: [r.dir] };
  return {
    start: () => hook("session-start", { ...base, hookEventName: "SessionStart", source: "STARTUP" }),
    bash: (command: string) => hook("pre", {
      ...base, hookEventName: "PreToolUse", stepIdx: ++steps,
      toolCall: { name: "run_command", args: { CommandLine: command, Cwd: r.dir, WaitMsBeforeAsync: 0 } },
    }),
  };
}

function said(o: Out): string {
  return `${o.stdout}\n${o.stderr}`;
}

function allowed(o: Out, command: string): void {
  expect({ command, code: o.code, stdout: o.stdout, stderr: o.stderr }).toEqual({ command, code: 0, stdout: "", stderr: "" });
}

function denied(o: Out, cause: string, command: string): void {
  expect(o.code, `${command}\n${said(o)}`).toBe(0);
  const body = JSON.parse(o.stdout) as { decision?: string; reason?: string };
  expect(body.decision, command).toBe("deny");
  expect(body.reason, command).toContain(`PREGATE DENY ${cause}`);
}

test("agy allows a clean switch and checkout of an existing branch and denies the unsafe forms", () => {
  const r = fresh();
  ok(git(r, "checkout", "-q", "-b", "tutorial"), "tutorial");
  put(r, "src/domain/note.ts", "export const note = 1;\n");
  commit(r, "tutorial");
  ok(git(r, "checkout", "-q", "main"), "main");
  ok(git(r, "checkout", "-q", "-b", "docs"), "docs");
  put(r, "README.md", "docs\n");
  commit(r, "docs");
  ok(git(r, "checkout", "-q", "main"), "main");
  ok(git(r, "checkout", "-q", "-b", "contract"), "contract");
  put(r, ".pregate/preset.json", `${readFileSync(join(r.dir, ".pregate/preset.json"), "utf8")}\n`);
  commit(r, "contract");
  ok(git(r, "checkout", "-q", "main"), "main");
  const sha = ok(git(r, "rev-parse", "tutorial"), "rev-parse").stdout.trim();
  const a = agy(r);
  ok(a.start(), "session");
  for (const command of ["git switch tutorial", "git checkout tutorial", "git switch -- tutorial", "git switch docs", "git checkout docs"]) {
    allowed(a.bash(command), command);
  }
  for (const command of ["git switch contract", "git checkout contract"]) denied(a.bash(command), "protected-path", command);
  for (const command of [
    "git switch --detach tutorial", "git checkout --detach tutorial", `git checkout ${sha}`, "git switch -f tutorial",
    "git checkout -f tutorial", "git switch --discard-changes tutorial", "git switch -c other tutorial", "git checkout -b other tutorial",
    "git checkout -- src/domain/invoice.ts", "git checkout tutorial -- src/domain/note.ts", "git restore src/domain/invoice.ts",
    "git reset --hard tutorial",
  ]) denied(a.bash(command), "shell-write", command);

  ok(git(r, "switch", "-q", "tutorial"), "on tutorial");
  allowed(a.bash("git switch -"), "git switch -");
  allowed(a.bash("git checkout main"), "git checkout main");
  ok(git(r, "switch", "-q", "main"), "back");

  put(r, "src/domain/invoice.ts", "export const dirty = 1;\n");
  denied(a.bash("git switch tutorial"), "shell-write", "dirty switch");
  denied(a.bash("git checkout tutorial"), "shell-write", "dirty checkout");
  denied(a.bash("git stash"), "shell-write", "stash");
  denied(a.bash("git reset --hard"), "shell-write", "reset --hard");
  ok(git(r, "checkout", "-q", "--", "src/domain/invoice.ts"), "restore");
  put(r, "src/domain/extra.ts", "export const extra = 1;\n");
  denied(a.bash("git switch tutorial"), "shell-write", "untracked switch");
});

test("agy allows a clean switch to the single remote-tracking branch", () => {
  const r = fresh();
  ok(git(r, "checkout", "-q", "-b", "tutorial"), "tutorial");
  put(r, "src/domain/note.ts", "export const note = 2;\n");
  commit(r, "tutorial");
  ok(git(r, "checkout", "-q", "main"), "main");
  const work = join(TMP, "clones", randomUUID());
  ok(run(["git", "clone", "-q", r.dir, work], TMP, r.env), "clone");
  const cloned: Repo = { dir: work, env: r.env };
  enable(work, ENGINE_DATA);
  const a = agy(cloned);
  ok(a.start(), "session");
  allowed(a.bash("git switch tutorial"), "git switch tutorial");
  allowed(a.bash("git checkout tutorial"), "git checkout tutorial");
  put(cloned, "src/domain/invoice.ts", "export const dirty = 1;\n");
  denied(a.bash("git switch tutorial"), "shell-write", "dirty remote switch");
  denied(a.bash("git checkout tutorial"), "shell-write", "dirty remote checkout");
});
