import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { compile } from "../src/compile.ts";
import { disable, enable } from "../src/consent.ts";
import { canonical } from "../src/disk.ts";
import { sourcesOf } from "../src/contract-diagnostic.ts";
import { hookCommand } from "../src/register.ts";
import { VERSIONS } from "../src/versions.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// Trust boundaries an agent's own scripts must not cross, on the compiled binary and real git
// repositories: a contract loosened behind the hooks' back, consent removed mid-session, history
// commands that rewrite the worktree, self-approval through the environment, and control commands
// hidden from the text scan (line continuations, padding, UTF-16, inline interpreter sinks).

setDefaultTimeout(120_000);

const DEMO = join(import.meta.dir, "demo-repo");
const PRESET = join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json");
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-trust-")));
const BIN = join(TMP, "bin/pregate");
const HOME = join(TMP, "home");
const DATA = join(TMP, "data");
const ENGINE_DATA = join(DATA, "pregate");
const LOCK = ".pregate/pregate.lock.json";
const PRESET_FILE = ".pregate/preset.json";

type Env = Record<string, string>;
interface Out { code: number; stdout: string; stderr: string }
interface Repo { dir: string; env: Env }

beforeAll(() => {
  mkdirSync(HOME, { recursive: true });
  // An empty Claude home wires one harness. Host CLIs stay off PATH, so setup's exit
  // does not depend on which agents this machine has installed.
  mkdirSync(join(HOME, ".claude"), { recursive: true });
  mkdirSync(join(TMP, "tmp"), { recursive: true });
  engineAt(BIN, true);
  ok(run([BIN, "setup"], HOME, envOf()), "setup");
  template = buildTemplate();
});

afterAll(() => removeTree(TMP));

let template = "";
let states = 0;

// No CI, no test answer: approval needs a human terminal unless a case adds a variable.
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
  const preset = JSON.parse(policyFixture(readFileSync(PRESET, "utf8"))) as { overrides?: Record<string, unknown> };
  preset.overrides = { ...preset.overrides, "clean-code/CC-ER-002": "deny" };
  writeFileSync(join(dir, PRESET_FILE), JSON.stringify(preset));
  ok(run([BIN, "preset", "compile"], dir, env), "preset compile");
  git("add", "-A");
  git("commit", "-q", "-m", "pregate");
  return dir;
}

function fresh(extra: Env = {}): Repo {
  const dir = join(TMP, "repos", randomUUID());
  cpSync(template, dir, { recursive: true });
  enable(dir, ENGINE_DATA);
  return { dir, env: envOf(extra) };
}

const git = (r: Repo, ...args: string[]): Out => run(["git", ...args], r.dir, r.env);
function commit(r: Repo, message: string): void {
  ok(git(r, "add", "-A"), "git add");
  ok(git(r, "commit", "-q", "-m", message), "git commit");
}
function put(r: Repo, rel: string, text: string | Uint8Array): void {
  mkdirSync(dirname(join(r.dir, rel)), { recursive: true });
  writeFileSync(join(r.dir, rel), text);
}
const cli = (r: Repo, args: string[], env: Env = {}): Out => run(["pregate", ...args], r.dir, { ...r.env, ...env });
const said = (o: Out): string => o.stdout + o.stderr;
const swallowed = (name: string): string =>
  `export function ${name}(): string {\n  try {\n    return "a";\n  } catch {}\n  return "b";\n}\n`;

// What a script does without any pregate command the hooks could see: rewrite the preset and the
// lock the compiler produces for it.
function loosen(r: Repo): string {
  const preset = JSON.parse(readFileSync(join(r.dir, PRESET_FILE), "utf8")) as Record<string, unknown>;
  preset.enforcement = "advisor";
  const text = JSON.stringify(preset);
  const compiled = compile(text, sourcesOf(r.dir), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  put(r, PRESET_FILE, text);
  put(r, LOCK, compiled.text);
  return compiled.text;
}

let calls = 0;
function claude(r: Repo, mode = "acceptEdits", sid: string = randomUUID()) {
  const hook = (sub: "pre" | "session-start" | "stop", payload: object) =>
    run(["sh", "-c", hookCommand(ENGINE_DATA, sub, "claude-code")], r.dir, r.env, JSON.stringify({
      session_id: sid, transcript_path: join(HOME, "t.jsonl"), cwd: r.dir, ...payload,
    }));
  const pre = (fields: object) => hook("pre", { permission_mode: mode, hook_event_name: "PreToolUse", tool_use_id: `toolu_${++calls}`, ...fields });
  return {
    start: () => hook("session-start", { hook_event_name: "SessionStart", source: "startup" }),
    write: (rel: string, content: string) => pre({ tool_name: "Write", tool_input: { file_path: join(r.dir, rel), content } }),
    bash: (command: string) => pre({ tool_name: "Bash", tool_input: { command } }),
    stop: () => hook("stop", { permission_mode: mode, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "done", background_tasks: [], session_crons: [] }),
  };
}

function denied(o: Out, needle: string): void {
  expect(o.code, said(o)).toBe(2);
  expect(said(o)).toContain(needle);
}

function silent(o: Out): void {
  expect({ code: o.code, stdout: o.stdout, stderr: o.stderr }).toEqual({ code: 0, stdout: "", stderr: "" });
}

function blocked(o: Out, needle: string): void {
  expect(o.code, said(o)).toBe(2);
  expect(JSON.parse(o.stdout).decision).toBe("block");
  expect(said(o)).toContain(needle);
}

// ── P0: a loosened contract ─────────────────────────────────────────────────────────────

test("a script that loosens the contract is caught by Stop, pre-commit and the CI ratchet", () => {
  const r = fresh();
  const a = claude(r);
  ok(a.start(), "session");
  silent(a.write("src/domain/note.ts", "export const note = 1;\n"));
  const baseLock = readFileSync(join(r.dir, LOCK), "utf8");
  loosen(r);
  // The loosened contract now admits what it denied, so only the contract comparison can see it.
  expect(a.write("src/domain/pay.ts", swallowed("pay")).code).toBe(0);
  put(r, "src/domain/pay.ts", "export const pay = 1;\n");
  blocked(a.stop(), "contract-loosened");
  ok(git(r, "add", "-A"), "git add");
  const staged = cli(r, ["check", "--staged"]);
  expect(staged.code, said(staged)).toBe(1);
  expect(said(staged)).toContain("loosens");
  ok(git(r, "commit", "-q", "--no-verify", "-m", "loosen"), "commit");
  const ratchet = cli(r, ["check", "--ratchet", "--base", "HEAD~1"]);
  expect(ratchet.code, said(ratchet)).toBe(1);
  expect(said(ratchet)).toContain("Enforcement: enforce -> advisor");
  const digest = /Contract loosening digest: ([0-9a-f]{64})/.exec(said(ratchet))?.[1];
  expect(digest, said(ratchet)).toBeDefined();
  // Only the exact digest, set by the workflow, accepts it; a prefix or another digest does not.
  expect(cli(r, ["check", "--ratchet", "--base", "HEAD~1"], { PREGATE_ACCEPT_CONTRACT: digest!.slice(0, 12) }).code).toBe(1);
  expect(cli(r, ["check", "--ratchet", "--base", "HEAD~1"], { PREGATE_ACCEPT_CONTRACT: "0".repeat(64) }).code).toBe(1);
  const accepted = cli(r, ["check", "--ratchet", "--base", "HEAD~1"], { PREGATE_ACCEPT_CONTRACT: digest! });
  expect(accepted.code, said(accepted)).toBe(0);
  // The same loosening again, after the base moved past it, is no loosening.
  expect(baseLock).not.toBe(readFileSync(join(r.dir, LOCK), "utf8"));
  expect(cli(r, ["check", "--ratchet", "--base", "HEAD"]).code).toBe(0);
});

test("a human-approved loosening passes Stop and pre-commit, and still needs the CI acceptance", () => {
  const r = fresh();
  const a = claude(r);
  ok(a.start(), "session");
  silent(a.write("src/domain/note.ts", "export const note = 1;\n"));
  put(r, "loosen.json", JSON.stringify({ why: "advisor first", patch: [{ op: "replace", path: "/enforcement", value: "advisor" }] }));
  const human = { PREGATE_TESTING: "1", PREGATE_TEST_ANSWER: "y" };
  ok(cli(r, ["preset", "apply", "loosen.json", "--yes"], human), "human preset apply");
  rmSync(join(r.dir, "loosen.json"));
  const stop = a.stop();
  expect(stop.code, said(stop)).toBe(0);
  expect(said(stop)).not.toContain("contract-loosened");
  ok(git(r, "add", "-A"), "git add");
  expect(cli(r, ["check", "--staged"]).code).toBe(0);
  ok(git(r, "commit", "-q", "-m", "approved loosening"), "commit");
  expect(cli(r, ["check", "--ratchet", "--base", "HEAD~1"]).code).toBe(1);
});

test("preset compile does not write a loosened lock without a human at the terminal", () => {
  const r = fresh();
  const before = readFileSync(join(r.dir, LOCK), "utf8");
  const preset = JSON.parse(readFileSync(join(r.dir, PRESET_FILE), "utf8")) as Record<string, unknown>;
  put(r, PRESET_FILE, JSON.stringify({ ...preset, enforcement: "advisor" }));
  const compiled = cli(r, ["preset", "compile"]);
  expect(compiled.code, said(compiled)).toBe(1);
  expect(said(compiled)).toContain("Enforcement: enforce -> advisor");
  expect(readFileSync(join(r.dir, LOCK), "utf8")).toBe(before);
  // Tightening needs nobody.
  put(r, PRESET_FILE, JSON.stringify(preset));
  ok(cli(r, ["preset", "compile"]), "compile unchanged");
});

test("scripts that compile, apply or approve contracts and reviews are control commands", () => {
  const r = fresh();
  const a = claude(r);
  ok(a.start(), "session");
  const digest = "a".repeat(64);
  const scripts: Record<string, string> = {
    "compile.sh": "#!/bin/sh\npregate preset compile\n",
    "apply.sh": "#!/bin/sh\npregate preset apply .pregate/requests/x.json\n",
    "init.sh": "#!/bin/sh\npregate init --yes --preset integrity-only\n",
    "promote.sh": "#!/bin/sh\npregate promote --yes\n",
    "feedback.sh": `#!/bin/sh\npregate feedback apply ${digest} --yes\n`,
    "storage.sh": `#!/bin/sh\npregate storage apply ${digest} --yes\n`,
    "issue.sh": `#!/bin/sh\npregate issue submit ${digest} --yes\n`,
    "unattended.sh": "#!/bin/sh\nexport PREGATE_UNATTENDED_APPROVAL=1\n",
    "accept.sh": "#!/bin/sh\nexport PREGATE_ACCEPT_CONTRACT=abc\n",
  };
  for (const [name, text] of Object.entries(scripts)) {
    put(r, name, text);
    expect(a.bash(`bash ${name}`).code, name).toBe(2);
  }
  put(r, "preview.sh", "#!/bin/sh\npregate preset apply .pregate/requests/x.json --preview\npregate init --preview\npregate promote --preview\n");
  silent(a.bash("bash preview.sh"));
});

// ── P1-1: consent removed mid-session ───────────────────────────────────────────────────

test("Stop and status warn when consent is disabled or removed during a session", () => {
  for (const tamper of ["disabled", "removed"] as const) {
    const r = fresh();
    const a = claude(r);
    ok(a.start(), "session");
    silent(a.write("src/domain/note.ts", "export const note = 1;\n"));
    if (tamper === "disabled") disable(r.dir, ENGINE_DATA);
    else rmSync(join(ENGINE_DATA, "consent"), { recursive: true, force: true });
    const stop = a.stop();
    expect(stop.code, said(stop)).toBe(0);
    expect(JSON.parse(stop.stdout).systemMessage, tamper).toContain("consent");
    expect(said(stop)).toContain(canonical(r.dir));
    const status = cli(r, ["status"]);
    expect(status.code).toBe(0);
    expect(said(status), tamper).toContain("consent was active in");
  }
});

// ── P1-2: git history and worktree commands ─────────────────────────────────────────────

test("history commands that rewrite the worktree are writes, denied when .pregate differs", () => {
  const r = fresh();
  ok(git(r, "checkout", "-q", "-b", "loose"), "branch");
  loosen(r);
  commit(r, "loosen");
  const loose = ok(git(r, "rev-parse", "HEAD"), "rev-parse").stdout.trim();
  ok(git(r, "checkout", "-q", "main"), "main");
  put(r, "README.md", "readme\n");
  commit(r, "readme");
  const a = claude(r);
  ok(a.start(), "session");
  for (const command of [
    `git checkout ${loose}`, "git checkout loose", `git switch --detach ${loose}`, "git switch loose",
    `git reset --hard ${loose}`, `git cherry-pick ${loose}`, `git read-tree -u --reset ${loose}`, `git read-tree ${loose}`,
    "git revert --no-edit HEAD~1",
  ]) denied(a.bash(command), "protected-path");
  // In-scope changes are shell writes: stash, clean and checkout-index rewrite them.
  put(r, "src/domain/dirty.ts", "export const dirty = 1;\n");
  denied(a.bash("git stash -u"), "shell-write");
  denied(a.bash("git clean -fdx"), "shell-write");
  silent(a.bash("git stash"));
  put(r, "src/main.ts", "export const changed = 1;\n");
  denied(a.bash("git checkout-index -a -f"), "shell-write");
  denied(a.bash("git stash"), "shell-write");
  denied(a.bash("git reset --hard"), "shell-write");
  ok(git(r, "add", "src/domain/dirty.ts"), "stage dirty");
  rmSync(join(r.dir, "src/domain/dirty.ts"));
  ok(git(r, "checkout", "--", "src/main.ts"), "human restore");
  denied(a.bash("git checkout-index -a -f"), "shell-write");
  ok(git(r, "reset", "-q", "--hard"), "human reset");
  // What changes nothing in scope stays allowed.
  silent(a.bash("git checkout -b side"));
  silent(a.bash("git stash list"));
  silent(a.bash("git clean -n"));
  ok(git(r, "checkout", "-q", "-b", "docs"), "docs branch");
  put(r, "README.md", "docs\n");
  commit(r, "docs");
  ok(git(r, "checkout", "-q", "main"), "back to main");
  silent(a.bash("git checkout docs"));
  silent(a.bash("git switch docs"));
  expect(existsSync(join(r.dir, "src/domain/dirty.ts"))).toBe(false);
});

// ── P1-3: CI is not an approval channel ─────────────────────────────────────────────────

test("CI in the environment neither approves nor reveals codes; the dedicated opt-in does", () => {
  const r = fresh();
  const status = () => JSON.parse(cli(r, ["status", "--json"]).stdout).consent as boolean;
  const refused = cli(r, ["disable", "--yes"], { CI: "1" });
  expect(refused.code, said(refused)).toBe(1);
  expect(status()).toBe(true);
  put(r, "loosen.json", JSON.stringify({ why: "advisor first", patch: [{ op: "replace", path: "/enforcement", value: "advisor" }] }));
  const preview = cli(r, ["preset", "apply", "loosen.json", "--preview"], { CI: "1" });
  expect(preview.code, said(preview)).toBe(0);
  expect(said(preview)).toContain("pregate approve <withheld>");
  const opted = cli(r, ["disable", "--yes"], { PREGATE_UNATTENDED_APPROVAL: "1" });
  expect(opted.code, said(opted)).toBe(0);
  expect(status()).toBe(false);
  // The agent cannot set it for a command or a script it runs.
  const s = fresh();
  const a = claude(s);
  ok(a.start(), "session");
  denied(a.bash("PREGATE_UNATTENDED_APPROVAL=1 pregate disable --yes"), "hook-switch");
  denied(a.bash("env PREGATE_UNATTENDED_APPROVAL=1 sh -c 'pregate disable --yes'"), "hook-switch");
});

// ── P1-4: Claude's native permission cannot complete an approval command ────────────────

test("Claude Code denies approval commands from the agent and names a separate terminal", () => {
  const r = fresh({ PREGATE_TESTING: "1" });
  put(r, ".pregate/requests/loosen.json", JSON.stringify({ why: "advisor first", patch: [{ op: "replace", path: "/enforcement", value: "advisor" }] }));
  const preview = cli(r, ["preset", "apply", ".pregate/requests/loosen.json", "--preview"]);
  const code = /pregate approve ([0-9a-f]{12})/.exec(said(preview))?.[1];
  expect(code, said(preview)).toBeDefined();
  const a = claude(r, "default");
  ok(a.start(), "session");
  const out = a.bash(`pregate approve ${code}`);
  denied(out, `run pregate approve ${code} in a separate terminal`);
  expect(said(out)).not.toContain(`! pregate approve ${code}`);
  expect(out.stdout).not.toContain('"ask"');
  for (const command of [`pregate feedback apply ${"a".repeat(64)} --yes`, `pregate storage apply ${"a".repeat(64)} --yes`, `pregate issue submit ${"a".repeat(64)} --yes`]) {
    expect(a.bash(command).stdout, command).not.toContain('"ask"');
  }
});

// ── Control scan evasions ───────────────────────────────────────────────────────────────

test("a line continuation does not split a control command from its verb", () => {
  const r = fresh();
  const a = claude(r);
  ok(a.start(), "session");
  put(r, "cont.sh", "#!/bin/sh\npregate \\\nsetup\n");
  denied(a.bash("bash cont.sh"), "hook-switch");
  put(r, "crlf.sh", "#!/bin/sh\r\npregate \\\r\n  disable --yes\r\n");
  denied(a.bash("sh crlf.sh"), "shell-admin");
  put(r, "joined.sh", "#!/bin/sh\npreg\\\nate disable --yes\n");
  denied(a.bash("sh joined.sh"), "shell-admin");
  put(r, "Makefile", "off:\n\tpregate \\\n\t  disable --yes\n");
  denied(a.bash("make off"), "shell-admin");
  put(r, "var.sh", "#!/bin/sh\nverb=disable\npregate \"$verb\" --yes\n");
  denied(a.bash("sh var.sh"), "shell-admin");
});

test("padding past the first MiB does not hide a control command", () => {
  const r = fresh();
  const a = claude(r);
  ok(a.start(), "session");
  put(r, "padded.sh", `#!/bin/sh\n${`: ${"x".repeat(1022)}\n`.repeat(1100)}pregate disable --yes\n`);
  denied(a.bash("sh padded.sh"), "shell-admin");
  put(r, "padded.py", `import subprocess\n${`# ${"x".repeat(1022)}\n`.repeat(1100)}subprocess.run(['pregate', 'disable', '--yes'])\n`);
  denied(a.bash("python3 padded.py"), "shell-admin");
});

test("a UTF-16 PowerShell script is decoded, not skipped as binary", () => {
  const r = fresh();
  const a = claude(r);
  ok(a.start(), "session");
  const utf16 = (text: string, bom = true) => Buffer.from(`${bom ? "\ufeff" : ""}${text}`, "utf16le");
  put(r, "off.ps1", utf16("pregate disable --yes\r\n"));
  denied(a.bash("powershell -NoProfile -File off.ps1"), "shell-admin");
  put(r, "off-be.ps1", Buffer.from(utf16("pregate uninstall\r\n").swap16()));
  denied(a.bash("pwsh -File off-be.ps1"), "hook-switch");
  put(r, "nobom.ps1", utf16("pregate disable --yes\r\n", false));
  denied(a.bash("pwsh -File nobom.ps1"), "shell-admin");
  // Bytes that decode as no known text cannot be classified: they are not run blind.
  put(r, "odd.ps1", Buffer.from([0x70, 0x00, 0x72, 0x00, 0x00, 0x01, 0x02, 0x03, 0x00, 0x00, 0xff, 0x00, 0x13]));
  denied(a.bash("pwsh -File odd.ps1"), "shell-admin");
  put(r, "ok.ps1", utf16("Write-Output hello\r\n"));
  silent(a.bash("pwsh -File ok.ps1"));
});

test("inline interpreter code with a write sink is a write, whatever its file names look like", () => {
  const r = fresh();
  const a = claude(r);
  ok(a.start(), "session");
  const cd = `cd '${join(r.dir, "src/domain")}' && `;
  denied(a.bash(`${cd}python3 -c 'from os import open as o,write as w,close as c;fd=o("pay",577,438);w(fd,b"x");c(fd)'`), "shell-write");
  denied(a.bash(`python3 -c 'from os import open as o,write as w,close as c;fd=o("LICENSE",577,438);w(fd,b"x");c(fd)'`), "shell-write");
  denied(a.bash(`node -e 'const f=require("f"+"s");f["writeFile"+"Sync"]("src/domain/x"+".ts","x")'`), "shell-write");
  denied(a.bash(`ruby -e 'File.write("LICENSE", "x")'`), "shell-write");
  denied(a.bash(`perl -e 'open(my $f, ">", "LICENSE")'`), "shell-write");
  denied(a.bash(`php -r 'file_put_contents("LICENSE", "x");'`), "shell-write");
  silent(a.bash(`python3 -c 'print(1 + 1)'`));
  silent(a.bash(`node -e 'console.log(1)'`));
  silent(a.bash(`node -p 'require("./package.json").version'`));
});
