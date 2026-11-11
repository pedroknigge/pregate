import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { engineAt } from "./compiled-engine.ts";
import { enable } from "../src/consent.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { merge } from "../src/register.ts";
import { commandScript } from "../src/windows-command.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// Project-local Claude Code registration (`pregate project hooks`): the project's own
// .claude/settings.json runs the project launcher. Every case is a disposable Git repository with
// the compiled engine in an isolated cache; HOME holds no harness home and no global launcher
// unless a case writes one. No Claude Code session runs here: the registered command is run the way
// a harness runs a hook, as a shell command with the payload on stdin.

setDefaultTimeout(180_000);

const WINDOWS = process.platform === "win32";
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-project-hooks-")));
const DEMO = join(import.meta.dir, "demo-repo");
const PRESETS = join(import.meta.dir, "../catalog/presets");
const PIN = pkg.version;
const SYSTEM_ROOT = process.env.SystemRoot ?? "C:\\Windows";
const HOOKS = ["project", "hooks", "--harness", "claude-code"];
const SETTINGS = ".claude/settings.json";
const INVOICE_REL = "src/domain/invoice.ts";
const INVOICE = readFileSync(join(DEMO, INVOICE_REL), "utf8");
// A public setter on an entity: backend-clean-ddd denies it (ddd/DDD-ENT-001).
const SETTER = INVOICE.replace(
  "  billedTo(): string {",
  "  rename(customer: string): void {\n    this.customer = customer;\n  }\n\n  billedTo(): string {",
);
// A second query method: nothing in the contract forbids it.
const QUERY = INVOICE.replace(
  "  billedTo(): string {",
  "  customerLabel(): string {\n    return this.billedTo();\n  }\n\n  billedTo(): string {",
);

type Json = Record<string, any>;
interface Out { code: number | null; stdout: string; stderr: string }
interface Isolated { root: string; home: string; data: string; engine: string; env: Record<string, string> }

afterAll(() => removeTree(TMP));

function isolated(): Isolated {
  const root = join(TMP, `p${Math.random().toString(36).slice(2)}`);
  const home = join(root, "home");
  mkdirSync(join(home, ".config"), { recursive: true });
  // An unrelated `pregate` is first on PATH: a hook that reached it would print its mark and allow.
  const decoy = join(root, "bin", WINDOWS ? "pregate.cmd" : "pregate");
  mkdirSync(dirname(decoy), { recursive: true });
  writeFileSync(decoy, WINDOWS ? "@echo decoy-hook 1>&2\r\n@exit /b 0\r\n" : "#!/bin/sh\necho decoy-hook >&2\nexit 0\n", { mode: 0o755 });
  const git = Bun.which("git");
  // Git for Windows finds its own files from the path of git.exe, so its real directory is named.
  // The system folders come last, as on any Windows machine: the registered command names
  // powershell.exe, as the global registration does, and doctor's canary names cmd.exe.
  const system = [join(SYSTEM_ROOT, "System32"), join(SYSTEM_ROOT, "System32", "WindowsPowerShell", "v1.0")];
  const windowsPath = [join(root, "bin"), join(home, ".local/bin"), ...(git === null ? [] : [dirname(git)]), ...system].join(";");
  const env = {
    HOME: home,
    XDG_DATA_HOME: join(home, ".local/share"),
    XDG_STATE_HOME: join(home, ".local/state"),
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_CACHE_HOME: join(home, ".cache"),
    TMPDIR: join(root, "tmp"),
    CODEX_HOME: join(home, ".codex"),
    GROK_HOME: join(home, ".grok"),
    PATH: WINDOWS ? windowsPath : `${join(root, "bin")}:/usr/bin:/bin:${home}/.local/bin`,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    PREGATE_NO_MODIFY_PATH: "1",
    ...(WINDOWS ? { SystemRoot: SYSTEM_ROOT } : {}),
  };
  mkdirSync(join(root, "tmp"), { recursive: true });
  if (git !== null && !WINDOWS) symlinkSync(git, join(root, "bin", "git"));
  const data = join(env.XDG_DATA_HOME, "pregate");
  // The cache layout a prepared engine has: <DATA>/<version>/pregate.
  engineAt(join(data, PIN, "pregate"));
  return { root, home, data, engine: join(data, PIN, ENGINE_FILE), env };
}

function run(cmd: string[], i: Isolated, cwd: string): Out {
  const r = Bun.spawnSync(cmd, { cwd, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function pregate(i: Isolated, cwd: string, ...args: string[]): Out {
  return run([i.engine, ...args], i, cwd);
}

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function gitCommit(i: Isolated, project: string, message: string): void {
  const git = ["git", "-c", "user.name=W", "-c", "user.email=w@e", "-c", "commit.gpgsign=false"];
  run([...git, "add", "-A"], i, project);
  run([...git, "commit", "-qm", message], i, project);
}

// A consenting project with a compiled lock that pins the cached engine. `launcher`: with the
// reviewed project launcher. `settings`: a .claude/settings.json the project already had.
function gitProject(i: Isolated, name: string, o: { launcher?: boolean; settings?: string } = {}): string {
  const project = join(i.root, name);
  cpSync(DEMO, project, { recursive: true });
  rmSync(join(project, ".git"), { recursive: true, force: true });
  const preset = JSON.parse(policyFixture(readFileSync(join(PRESETS, "backend-clean-ddd.json"), "utf8")));
  put(join(project, ".pregate/preset.json"), JSON.stringify({ ...preset, engine: PIN }));
  if (o.settings !== undefined) put(join(project, SETTINGS), o.settings);
  expect(pregate(i, project, "preset", "compile", "--yes").code).toBe(0);
  run(["git", "init", "-q"], i, project);
  gitCommit(i, project, "init");
  enable(project, i.data);
  if (o.launcher !== false) expect(pregate(i, project, "project", "launcher", "--yes").code).toBe(0);
  return project;
}

function registered(i: Isolated, name: string, settings?: string): string {
  const project = gitProject(i, name, settings === undefined ? {} : { settings });
  const out = pregate(i, project, ...HOOKS, "--yes");
  expect(out.code, `${out.stdout}\n${out.stderr}`).toBe(0);
  return project;
}

function settingsOf(project: string): Json {
  return JSON.parse(readFileSync(join(project, SETTINGS), "utf8")) as Json;
}

// The handler of one event that runs the project launcher, as the settings file holds it.
function handler(project: string, event: string): string {
  const groups = settingsOf(project).hooks[event] as Json[];
  const ours = groups.flatMap((g) => g.hooks as Json[]).filter((h) => commandScript(h.command).includes(".pregate/bin/"));
  expect(ours).toHaveLength(1);
  return ours[0]!.command;
}

// Path → kind and content hash of every entry below `dir`.
function snapshot(dir: string, base = dir, out: Record<string, string> = {}): Record<string, string> {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name), rel = path.slice(base.length + 1).replaceAll("\\", "/");
    const s = lstatSync(path);
    if (s.isSymbolicLink()) out[rel] = `link:${readlinkSync(path)}`;
    else if (s.isDirectory()) { out[rel] = "dir"; snapshot(path, base, out); }
    else out[rel] = `file:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
  }
  return out;
}

function prePayload(project: string, home: string, file: string, content: string): string {
  const sid = "00000000-0000-4000-8000-000000000001";
  return `${JSON.stringify({
    session_id: sid,
    transcript_path: join(home, `.claude/projects/p/${sid}.jsonl`),
    cwd: project,
    prompt_id: "00000000-0000-4000-8000-0000000000a1",
    permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: join(project, file), content },
    tool_use_id: `toolu_${createHash("sha256").update(content).digest("hex").slice(0, 12)}`,
  })}\n`;
}

// The registered command as a harness runs a hook: one shell command line, the payload on stdin.
// POSIX: /bin/sh -c. Windows: cmd.exe /d /s /c, as doctor's canary runs the global registration.
function hook(i: Isolated, command: string, cwd: string, payload: string, projectDir: string | null): Out {
  const shell = WINDOWS ? [join(SYSTEM_ROOT, "System32", "cmd.exe"), "/d", "/s", "/c", command] : ["/bin/sh", "-c", command];
  const env: Record<string, string> = { ...i.env, PREGATE_TESTING: "1", ...(projectDir === null ? {} : { CLAUDE_PROJECT_DIR: projectDir }) };
  const r = Bun.spawnSync(shell, { cwd, env, stdin: Buffer.from(payload), stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function globalRegistration(i: Isolated): string {
  return merge(null, "shared", i.data.replaceAll("\\", "/"))!;
}

describe("pregate project hooks", () => {
  test("registers the global events and tool matcher in the project, on the project launcher, after a review", () => {
    const i = isolated();
    const project = gitProject(i, "repo");
    const preview = pregate(i, project, ...HOOKS, "--preview");
    expect(preview.code, `${preview.stdout}\n${preview.stderr}`).toBe(0);
    expect(preview.stdout).toContain("Digest: ");
    expect(preview.stdout).toContain("Project unchanged until the human approves the digest.");
    expect(existsSync(join(project, SETTINGS))).toBe(false);
    const applied = pregate(i, project, ...HOOKS, "--yes");
    expect(applied.code, `${applied.stdout}\n${applied.stderr}`).toBe(0);
    const hooks = settingsOf(project).hooks as Record<string, Json[]>;
    const global = (JSON.parse(globalRegistration(i)) as Json).hooks as Record<string, Json[]>;
    expect(Object.keys(hooks).sort()).toEqual(Object.keys(global).sort());
    expect(Object.keys(hooks).sort()).toEqual(["PreToolUse", "SessionStart", "Stop", "SubagentStop"]);
    expect(hooks.PreToolUse![0]!.matcher).toBe(global.PreToolUse![0]!.matcher);
    for (const [event, kind] of [["PreToolUse", "pre"], ["Stop", "stop"], ["SubagentStop", "stop"], ["SessionStart", "session-start"]] as const) {
      expect(hooks[event]).toHaveLength(1);
      expect(hooks[event]![0]!.hooks[0].timeout).toBe(global[event]![0]!.hooks[0].timeout);
      const script = commandScript(handler(project, event));
      expect(script).toContain("CLAUDE_PROJECT_DIR");
      expect(script).toContain(WINDOWS ? ".pregate/bin/project-launcher.ps1" : "/.pregate/bin/pregate");
      expect(script).toContain(`hook ${kind} --harness claude-code`);
      // The committed command names no machine path: not the home, the cache or the project itself.
      for (const machine of [i.home, i.data, project]) {
        expect(script).not.toContain(machine);
        expect(script).not.toContain(machine.replaceAll("\\", "/"));
      }
    }
  });

  test("refuses a wrong form, a project without the reviewed launcher, and a settings file that is not a JSON object", () => {
    const i = isolated();
    const bare = gitProject(i, "bare", { launcher: false });
    expect(pregate(i, bare, "project", "hooks", "--yes").stdout).toContain("pregate project hooks --harness claude-code [--preview|--yes]");
    expect(pregate(i, bare, "project", "hooks", "--harness", "codex", "--yes").code).toBe(1);
    const noLauncher = pregate(i, bare, ...HOOKS, "--yes");
    expect(noLauncher.code).toBe(1);
    expect(noLauncher.stdout).toContain("Run pregate project launcher --preview first");
    expect(existsSync(join(bare, SETTINGS))).toBe(false);
    const broken = gitProject(i, "broken", { settings: "{ not json" });
    const out = pregate(i, broken, ...HOOKS, "--yes");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("must be a JSON object");
    expect(readFileSync(join(broken, SETTINGS), "utf8")).toBe("{ not json");
  });

  test("keeps foreign hooks, permissions and unknown keys, and a second run changes no byte", () => {
    const i = isolated();
    const foreign = {
      $schema: "https://json.schemastore.org/claude-code-settings.json",
      permissions: { allow: ["Bash(npm run lint)"], deny: ["Read(./.env)"] },
      teamKey: { nested: [1, "two", null] },
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node scripts/audit-shell.js", timeout: 5 }] }],
        PostToolUse: [{ matcher: "Write|Edit", hooks: [{ type: "command", command: "npx prettier --write \"$CLAUDE_PROJECT_DIR\"" }] }],
        Stop: [{ hooks: [{ type: "command", command: "afplay /System/Library/Sounds/Glass.aiff" }] }],
      },
    };
    // Four-space indentation and no final newline: the owner's formatting.
    const project = registered(i, "repo", JSON.stringify(foreign, null, 4));
    const once = readFileSync(join(project, SETTINGS), "utf8");
    const after = JSON.parse(once) as Json;
    for (const key of ["$schema", "permissions", "teamKey"]) expect(after[key]).toEqual((foreign as Json)[key]);
    expect(Object.keys(after)).toEqual(Object.keys(foreign));
    expect(after.hooks.PostToolUse).toEqual(foreign.hooks.PostToolUse);
    // Foreign groups keep their index; the PREGATE group is appended after them.
    expect(after.hooks.PreToolUse[0]).toEqual(foreign.hooks.PreToolUse[0]);
    expect(after.hooks.Stop[0]).toEqual(foreign.hooks.Stop[0]);
    expect(after.hooks.PreToolUse).toHaveLength(2);
    expect(after.hooks.Stop).toHaveLength(2);
    // Without the PREGATE groups the file is the owner's file again.
    for (const event of Object.keys(after.hooks)) {
      after.hooks[event] = (after.hooks[event] as Json[]).filter((g) => !JSON.stringify(g).includes("--harness claude-code") && !/EncodedCommand/.test(JSON.stringify(g)));
      if (after.hooks[event].length === 0) delete after.hooks[event];
    }
    expect(after).toEqual(foreign);
    const again = pregate(i, project, ...HOOKS, "--yes");
    expect(again.code, `${again.stdout}\n${again.stderr}`).toBe(0);
    expect(again.stdout).toContain("nothing changed");
    expect(readFileSync(join(project, SETTINGS), "utf8")).toBe(once);
    expect(pregate(i, project, ...HOOKS, "--preview").stdout).toContain("nothing changed");
    expect(readFileSync(join(project, SETTINGS), "utf8")).toBe(once);
  });

  test("an already registered file in the owner's formatting is left byte for byte", () => {
    const i = isolated();
    const project = registered(i, "repo");
    const compact = JSON.stringify(settingsOf(project));
    writeFileSync(join(project, SETTINGS), compact);
    expect(pregate(i, project, ...HOOKS, "--yes").code).toBe(0);
    expect(readFileSync(join(project, SETTINGS), "utf8")).toBe(compact);
  });

  test("under the home, the approval changes only this project's approval record; no harness home, launcher or state is written", () => {
    const i = isolated();
    const project = gitProject(i, "repo");
    const before = snapshot(i.home);
    expect(pregate(i, project, ...HOOKS, "--yes").code).toBe(0);
    expect(existsSync(join(project, SETTINGS))).toBe(true);
    const after = snapshot(i.home);
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((path) => before[path] !== after[path]);
    // Every human approval rewrites <DATA>/contract-approvals/<project>.json, which the launcher's
    // approval had already created. It is the one path that differs; the pending review is gone.
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatch(/^\.local\/share\/pregate\/contract-approvals\/[0-9a-f]{64}\.json$/);
    expect(before[changed[0]!]).toStartWith("file:");
    // A run that has nothing to register changes nothing at all, and neither does a refused form.
    expect(pregate(i, project, ...HOOKS, "--yes").code).toBe(0);
    expect(pregate(i, project, "project", "hooks", "--yes").code).toBe(1);
    expect(snapshot(i.home)).toEqual(after);
    for (const absent of [".claude", ".codex", ".cursor", ".grok", ".gemini", ".agents", ".local/bin", ".local/share/pregate/bin"]) {
      expect(existsSync(join(i.home, absent)), absent).toBe(false);
    }
  });

  test("the registered PreToolUse command denies a forbidden edit and allows a compliant one, with no global launcher and a decoy pregate on PATH", () => {
    const i = isolated();
    const project = registered(i, "repo");
    const command = handler(project, "PreToolUse");
    const target = join(project, INVOICE_REL);
    expect(existsSync(join(i.data, "bin"))).toBe(false);
    expect(existsSync(join(i.home, ".claude"))).toBe(false);
    // A working directory below the root: the command finds the launcher through CLAUDE_PROJECT_DIR.
    const below = join(project, "src/domain");
    const denied = hook(i, command, below, prePayload(project, i.home, INVOICE_REL, SETTER), project);
    expect(denied.code, `${denied.stdout}\n${denied.stderr}`).toBe(2);
    expect(`${denied.stdout}\n${denied.stderr}`).toContain("ddd/DDD-ENT-001");
    const allowed = hook(i, command, below, prePayload(project, i.home, INVOICE_REL, QUERY), project);
    expect(allowed.code, `${allowed.stdout}\n${allowed.stderr}`).toBe(0);
    expect(`${allowed.stdout}\n${allowed.stderr}`).not.toContain("DENY");
    // Without the variable, the project root as working directory is enough.
    const rootOnly = hook(i, command, project, prePayload(project, i.home, INVOICE_REL, SETTER), null);
    expect(rootOnly.code, `${rootOnly.stdout}\n${rootOnly.stderr}`).toBe(2);
    expect(`${rootOnly.stdout}\n${rootOnly.stderr}`).toContain("ddd/DDD-ENT-001");
    for (const out of [denied, allowed, rootOnly]) expect(`${out.stdout}\n${out.stderr}`).not.toContain("decoy-hook");
    expect(readFileSync(target, "utf8")).toBe(INVOICE);
  });

  test("a missing pinned engine denies with the reason; a missing launcher denies a write and lets Stop pass", () => {
    const i = isolated();
    const project = registered(i, "repo");
    const pre = handler(project, "PreToolUse"), stop = handler(project, "Stop");
    const payload = prePayload(project, i.home, INVOICE_REL, QUERY);
    removeTree(join(i.data, PIN));
    const noEngine = hook(i, pre, project, payload, project);
    expect(noEngine.code, `${noEngine.stdout}\n${noEngine.stderr}`).toBe(2);
    expect(noEngine.stderr).toContain(`engine ${PIN} is not installed; run pregate prepare`);
    rmSync(join(project, ".pregate/bin"), { recursive: true, force: true });
    const noLauncher = hook(i, pre, project, payload, project);
    expect(noLauncher.code, `${noLauncher.stdout}\n${noLauncher.stderr}`).toBe(2);
    expect(noLauncher.stderr).toContain("the project launcher is missing");
    expect(hook(i, stop, project, "{}\n", project).code).toBe(0);
    for (const out of [noEngine, noLauncher]) expect(`${out.stdout}\n${out.stderr}`).not.toContain("decoy-hook");
  });
});

describe("legacy cleanup and the machine commands", () => {
  // The handler `pregate install` of 0.1.0 wrote: an inline guard on the committed launcher.
  const OLD = `f="$CLAUDE_PROJECT_DIR/.pregate/bin/pregate"; [ -f "$f" ] || { echo missing >&2; exit 2; }; exec "$f" hook pre`;

  test("pregate install removes the 0.1.0 handlers and keeps the project registration, foreign hooks and the launcher", () => {
    const i = isolated();
    const project = registered(i, "repo");
    const launcher = join(project, ".pregate/bin", WINDOWS ? "pregate.cmd" : "pregate");
    const launcherBytes = readFileSync(launcher, "utf8");
    const clean = readFileSync(join(project, SETTINGS), "utf8");
    const untouched = pregate(i, project, "install");
    expect(untouched.code, `${untouched.stdout}\n${untouched.stderr}`).toBe(0);
    expect(readFileSync(join(project, SETTINGS), "utf8")).toBe(clean);
    expect(readFileSync(launcher, "utf8")).toBe(launcherBytes);
    const mixed = JSON.parse(clean) as Json;
    const foreign = { matcher: "Bash", hooks: [{ type: "command", command: "node scripts/audit-shell.js" }] };
    mixed.hooks.PreToolUse.unshift(foreign);
    mixed.hooks.PostToolUse = [{ matcher: "Write", hooks: [{ type: "command", command: OLD }] }];
    writeFileSync(join(project, SETTINGS), JSON.stringify(mixed, null, 2));
    const out = pregate(i, project, "install");
    expect(out.code, `${out.stdout}\n${out.stderr}`).toBe(0);
    expect(out.stdout).toContain("Removed PREGATE 0.1.0 hooks");
    const kept = settingsOf(project);
    expect(kept.hooks.PostToolUse).toBeUndefined();
    expect(kept.hooks.PreToolUse).toEqual([foreign, (JSON.parse(clean) as Json).hooks.PreToolUse[0]]);
    expect(kept.hooks.Stop).toEqual((JSON.parse(clean) as Json).hooks.Stop);
    expect(readFileSync(launcher, "utf8")).toBe(launcherBytes);
    // The registration is still the one the command writes: a rerun has nothing to change.
    writeFileSync(join(project, SETTINGS), clean);
    expect(pregate(i, project, ...HOOKS, "--yes").stdout).toContain("nothing changed");
  });

  test("pregate install keeps a project launcher of another template version or line ending, and still removes the 0.1.0 launcher", () => {
    const i = isolated();
    const project = gitProject(i, "repo", { launcher: false });
    const path = join(project, ".pregate/bin/pregate");
    const template = readFileSync(join(import.meta.dir, "../assets/project-launcher.sh"), "utf8");
    for (const variant of [template, template.replaceAll("\n", "\r\n"), `${template}\n# a line a later template adds\n`]) {
      put(path, variant);
      const out = pregate(i, project, "install");
      expect(out.code, `${out.stdout}\n${out.stderr}`).toBe(0);
      expect(readFileSync(path, "utf8")).toBe(variant);
    }
    put(path, "#!/bin/sh\n# PREGATE 0.1.0 committed launcher\nexec pregate \"$@\"\n");
    const out = pregate(i, project, "install");
    expect(out.stdout).toContain("Removed .pregate/bin/pregate");
    expect(existsSync(path)).toBe(false);
  });

  test("pregate setup and pregate uninstall change no byte of the project registration or launcher", () => {
    const i = isolated();
    const project = registered(i, "repo");
    const tree = () => ({ ...snapshot(join(project, ".claude")), ...snapshot(join(project, ".pregate/bin")) });
    const before = tree();
    // Claude Code is present on this machine, so setup registers its global hooks.
    mkdirSync(join(i.home, ".claude"), { recursive: true });
    const setup = pregate(i, project, "setup");
    expect(setup.code, `${setup.stdout}\n${setup.stderr}`).toBe(0);
    expect(readFileSync(join(i.home, ".claude/settings.json"), "utf8")).toContain("PreToolUse");
    expect(tree()).toEqual(before);
    const both = pregate(i, project, "doctor");
    expect(both.stdout).toContain("Claude Code hooks: project-local and global.");
    const uninstall = pregate(i, project, "uninstall", "--yes");
    expect(uninstall.code, `${uninstall.stdout}\n${uninstall.stderr}`).toBe(0);
    expect(tree()).toEqual(before);
  });
});

describe("doctor and status name the scope of the Claude Code registration", () => {
  const scopeLine = (out: Out) => out.stdout.split("\n").filter((line) => line.includes("Claude Code hooks:"));
  const statusScope = (i: Isolated, cwd: string) => (JSON.parse(pregate(i, cwd, "status", "--json").stdout) as Json).claudeCodeHooks;

  test("neither, project-local only, both, and global only are four distinct reports", () => {
    const i = isolated();
    const project = gitProject(i, "repo");
    const neither = pregate(i, project, "doctor");
    expect(scopeLine(neither)).toEqual([expect.stringContaining("WARNING: Claude Code hooks: neither project-local nor global.")]);
    expect(statusScope(i, project)).toBe("none");

    expect(pregate(i, project, ...HOOKS, "--yes").code).toBe(0);
    const local = pregate(i, project, "doctor");
    expect(scopeLine(local)).toEqual([expect.stringContaining("Claude Code hooks: project-local only.")]);
    expect(local.stdout).toContain(`Project launcher matches the reviewed template and engine ${PIN} is cached. No project canary ran`);
    // A healthy project-local setup with an untouched home is not an error: the global parts are stated.
    expect(local.stdout).not.toContain("ERROR:");
    expect(local.stdout).toContain("INFO: No global installation");
    expect(local.code, local.stdout).toBe(0);
    expect(statusScope(i, project)).toBe("project");
    const status = pregate(i, project, "status");
    expect(status.stdout).toContain("Harnesses gated: claude-code.");
    expect(status.stdout).toContain("Claude Code hooks are project-local");

    put(join(i.home, ".claude/settings.json"), globalRegistration(i));
    const both = pregate(i, project, "doctor");
    expect(scopeLine(both)).toEqual([expect.stringContaining("WARNING: Claude Code hooks: project-local and global.")]);
    expect(scopeLine(both)[0]).toContain("every tool call is evaluated twice");
    expect(statusScope(i, project)).toBe("both");
    expect(pregate(i, project, "status").stdout).toContain("every tool call is evaluated twice");

    const other = gitProject(i, "other");
    const global = pregate(i, other, "doctor");
    expect(scopeLine(global)).toEqual([expect.stringContaining("INFO: Claude Code hooks: global only")]);
    expect(statusScope(i, other)).toBe("global");
  });

  test("doctor names a modified registration, disabled hooks and a launcher that differs", () => {
    const i = isolated();
    const project = registered(i, "repo");
    const clean = readFileSync(join(project, SETTINGS), "utf8");
    const edited = JSON.parse(clean) as Json;
    edited.hooks.PreToolUse[0].matcher = "Bash";
    writeFileSync(join(project, SETTINGS), JSON.stringify(edited, null, 2));
    const modified = pregate(i, project, "doctor");
    expect(modified.code).toBe(1);
    expect(modified.stdout).toContain("ERROR: .claude/settings.json: PREGATE project hooks are missing, modified or written for another platform");
    expect(modified.stdout).not.toContain("project-local only");

    writeFileSync(join(project, SETTINGS), JSON.stringify({ ...(JSON.parse(clean) as Json), disableAllHooks: true }, null, 2));
    expect(pregate(i, project, "doctor").stdout).toContain("ERROR: .claude/settings.json: disableAllHooks disables the PREGATE project hooks.");
    expect((JSON.parse(pregate(i, project, "status", "--json").stdout) as Json).harnesses.find((h: Json) => h.id === "claude-code").configured).toBe(false);

    writeFileSync(join(project, SETTINGS), clean);
    const launcher = join(project, ".pregate/bin", WINDOWS ? "pregate.cmd" : "pregate");
    writeFileSync(launcher, `${readFileSync(launcher, "utf8")}\n`);
    expect(pregate(i, project, "doctor").stdout).toContain("ERROR: The project launcher in .pregate/bin differs from the reviewed template");
  });
});

// Project-local Codex registration (`pregate project hooks --harness codex`): the project's own
// .codex/hooks.json runs the project launcher. No Codex session runs here, so nothing below says
// whether Codex loads, reviews or trusts the file: the registered command is run the way Codex runs
// a hook, as a shell command with the payload on stdin and the session directory as its directory.

const CODEX = ["project", "hooks", "--harness", "codex"];
const CODEX_HOOKS = ".codex/hooks.json";
const BELOW = "src/domain";

function codexHooksOf(project: string): Json {
  return JSON.parse(readFileSync(join(project, CODEX_HOOKS), "utf8")) as Json;
}

function codexRegistered(i: Isolated, name: string, existing?: string): string {
  const project = gitProject(i, name);
  if (existing !== undefined) {
    put(join(project, CODEX_HOOKS), existing);
    gitCommit(i, project, "codex hooks of the team");
  }
  // From a directory below the root: the command finds the project root itself.
  const out = pregate(i, join(project, BELOW), ...CODEX, "--yes");
  expect(out.code, `${out.stdout}\n${out.stderr}`).toBe(0);
  return project;
}

function codexHandler(project: string, event: string): string {
  const ours = (codexHooksOf(project).hooks[event] as Json[]).flatMap((g) => g.hooks as Json[]).filter((h) => commandScript(h.command).includes(".pregate/bin/"));
  expect(ours).toHaveLength(1);
  return ours[0]!.command;
}

// A Codex 0.166 PreToolUse payload (test/payloads/codex/pre-apply-patch-166.json): apply_patch sets
// no tool directory, so `cwd` is the session directory, and the patch names an absolute path.
function patchPayload(i: Isolated, session: string, patch: string): string {
  const sid = "01a00000-0000-7000-8000-000000000166";
  return JSON.stringify({
    session_id: sid, turn_id: "01a00000-0000-7000-8000-000000000167",
    transcript_path: join(i.home, `.codex/sessions/rollout-${sid}.jsonl`), cwd: session, hook_event_name: "PreToolUse",
    model: "gpt-5.5", permission_mode: "bypassPermissions", tool_name: "apply_patch", tool_input: { command: patch },
    tool_use_id: `call_${createHash("sha256").update(patch).digest("hex").slice(0, 24)}`,
  });
}

function updatePatch(file: string, added: string[]): string {
  return ["*** Begin Patch", `*** Update File: ${file}`, "@@", "-  billedTo(): string {", ...added.map((line) => `+${line}`), "+  billedTo(): string {", "*** End Patch", ""].join("\n");
}

const SETTER_LINES = ["  rename(customer: string): void {", "    this.customer = customer;", "  }", ""];
const QUERY_LINES = ["  customerLabel(): string {", "    return this.billedTo();", "  }", ""];

function codexGlobalRegistration(i: Isolated): string {
  return merge(null, "codex", i.data.replaceAll("\\", "/"))!;
}

describe("pregate project hooks --harness codex", () => {
  test("registers the global Codex events and matcher in the project, on the project launcher, after a review, from a subdirectory", () => {
    const i = isolated();
    const project = gitProject(i, "repo");
    const below = join(project, BELOW);
    const preview = pregate(i, below, ...CODEX, "--preview");
    expect(preview.code, `${preview.stdout}\n${preview.stderr}`).toBe(0);
    expect(preview.stdout).toContain("Digest: ");
    expect(preview.stdout).toContain("Project unchanged until the human approves the digest.");
    expect(existsSync(join(project, CODEX_HOOKS))).toBe(false);
    const applied = pregate(i, below, ...CODEX, "--yes");
    expect(applied.code, `${applied.stdout}\n${applied.stderr}`).toBe(0);
    // The command grants no trust and says which review Codex still needs.
    for (const out of [preview, applied]) {
      expect(out.stdout).toContain("No Codex trust is recorded and the Codex home is not written.");
      expect(out.stdout).toContain("review the hooks with /hooks");
    }
    expect(existsSync(join(below, ".codex"))).toBe(false);
    const hooks = codexHooksOf(project).hooks as Record<string, Json[]>;
    const global = (JSON.parse(codexGlobalRegistration(i)) as Json).hooks as Record<string, Json[]>;
    expect(Object.keys(hooks).sort()).toEqual(Object.keys(global).sort());
    expect(Object.keys(hooks).sort()).toEqual(["PreToolUse", "SessionStart", "Stop", "SubagentStart", "SubagentStop"]);
    expect(hooks.PreToolUse![0]!.matcher).toBe(global.PreToolUse![0]!.matcher);
    expect(hooks.PreToolUse![0]!.matcher).toBe("^(apply_patch|Bash)$");
    for (const [event, kind] of [["PreToolUse", "pre"], ["Stop", "stop"], ["SessionStart", "session-start"], ["SubagentStart", "session-start"], ["SubagentStop", "stop"]] as const) {
      expect(hooks[event]).toHaveLength(1);
      expect(hooks[event]![0]!.matcher).toBe(global[event]![0]!.matcher);
      expect(hooks[event]![0]!.hooks[0].timeout).toBe(global[event]![0]!.hooks[0].timeout);
      const script = commandScript(codexHandler(project, event));
      expect(script).toContain(WINDOWS ? ".pregate/bin/project-launcher.ps1" : "/.pregate/bin/pregate");
      expect(script).toContain(`hook ${kind} --harness codex`);
      expect(script).not.toContain("CLAUDE_PROJECT_DIR");
      for (const machine of [i.home, i.data, project]) {
        expect(script).not.toContain(machine);
        expect(script).not.toContain(machine.replaceAll("\\", "/"));
      }
    }
    // The Claude Code file is another registration: this command did not create it.
    expect(existsSync(join(project, SETTINGS))).toBe(false);
  });

  test("refuses a project without the reviewed launcher and a hooks file that is not a JSON object", () => {
    const i = isolated();
    const bare = gitProject(i, "bare", { launcher: false });
    const usage = pregate(i, bare, "project", "hooks", "--harness", "codex", "--force");
    expect(usage.code).toBe(1);
    expect(usage.stdout).toContain("pregate project hooks --harness codex [--preview|--yes]");
    const noLauncher = pregate(i, bare, ...CODEX, "--yes");
    expect(noLauncher.code).toBe(1);
    expect(noLauncher.stdout).toContain("Run pregate project launcher --preview first");
    expect(existsSync(join(bare, CODEX_HOOKS))).toBe(false);
    const broken = gitProject(i, "broken");
    put(join(broken, CODEX_HOOKS), "{ not json");
    const out = pregate(i, broken, ...CODEX, "--yes");
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("must be a JSON object");
    expect(readFileSync(join(broken, CODEX_HOOKS), "utf8")).toBe("{ not json");
  });

  test("keeps foreign hooks at their index and unknown keys, and a second run changes no byte", () => {
    const i = isolated();
    const foreign = {
      teamKey: { nested: [1, "two", null] },
      hooks: {
        PreToolUse: [{ matcher: "^Bash$", hooks: [{ type: "command", command: "node scripts/audit-shell.js", timeout: 5 }] }],
        PostToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "sh scripts/format.sh" }] }],
        Stop: [{ hooks: [{ type: "command", command: "sh scripts/notify.sh --harness codex" }] }],
      },
    };
    // Four-space indentation and no final newline: the owner's formatting.
    const project = codexRegistered(i, "repo", JSON.stringify(foreign, null, 4));
    const once = readFileSync(join(project, CODEX_HOOKS), "utf8");
    const after = JSON.parse(once) as Json;
    expect(Object.keys(after)).toEqual(Object.keys(foreign));
    expect(after.teamKey).toEqual(foreign.teamKey);
    expect(after.hooks.PostToolUse).toEqual(foreign.hooks.PostToolUse);
    // Codex addresses a hook by its index: foreign groups keep theirs, the PREGATE group follows.
    expect(after.hooks.PreToolUse[0]).toEqual(foreign.hooks.PreToolUse[0]);
    expect(after.hooks.Stop[0]).toEqual(foreign.hooks.Stop[0]);
    expect(after.hooks.PreToolUse).toHaveLength(2);
    expect(after.hooks.Stop).toHaveLength(2);
    expect(after.hooks.SessionStart).toHaveLength(1);
    // Without the PREGATE groups the file is the owner's file again.
    for (const event of Object.keys(after.hooks)) {
      after.hooks[event] = (after.hooks[event] as Json[]).filter((g) => !(g.hooks as Json[]).some((h) => commandScript(h.command).includes(".pregate/bin/")));
      if (after.hooks[event].length === 0) delete after.hooks[event];
    }
    expect(after).toEqual(foreign);
    const again = pregate(i, project, ...CODEX, "--yes");
    expect(again.code, `${again.stdout}\n${again.stderr}`).toBe(0);
    expect(again.stdout).toContain("nothing changed");
    expect(again.stdout).toContain("review the hooks with /hooks");
    expect(readFileSync(join(project, CODEX_HOOKS), "utf8")).toBe(once);
    expect(pregate(i, join(project, BELOW), ...CODEX, "--preview").stdout).toContain("nothing changed");
    expect(readFileSync(join(project, CODEX_HOOKS), "utf8")).toBe(once);
    // The owner's formatting of a registered file stays byte for byte.
    const compact = JSON.stringify(JSON.parse(once));
    writeFileSync(join(project, CODEX_HOOKS), compact);
    expect(pregate(i, project, ...CODEX, "--yes").code).toBe(0);
    expect(readFileSync(join(project, CODEX_HOOKS), "utf8")).toBe(compact);
  });

  test("under the home, the approval changes only this project's approval record; the Codex home, its trust state and its hooks stay byte for byte", () => {
    const i = isolated();
    const project = gitProject(i, "repo");
    // A Codex home that already holds a user hook, the trust the user gave it and a project entry.
    const trusted = `model = "gpt-5.5"\n\n[hooks.state."${join(i.home, ".codex/hooks.json").replaceAll("\\", "/")}:pre_tool_use:0:0"]\ntrusted_hash = "sha256:0123"\n`;
    put(join(i.home, ".codex/config.toml"), trusted);
    put(join(i.home, ".codex/hooks.json"), JSON.stringify({ hooks: { PreToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "sh ~/audit.sh" }] }] } }));
    const before = snapshot(i.home);
    expect(pregate(i, join(project, BELOW), ...CODEX, "--yes").code).toBe(0);
    expect(existsSync(join(project, CODEX_HOOKS))).toBe(true);
    const after = snapshot(i.home);
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((path) => before[path] !== after[path]);
    // Every human approval rewrites <DATA>/contract-approvals/<project>.json, which the launcher's
    // approval had already created. It is the one path that differs.
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatch(/^\.local\/share\/pregate\/contract-approvals\/[0-9a-f]{64}\.json$/);
    expect(before[changed[0]!]).toStartWith("file:");
    expect(readFileSync(join(i.home, ".codex/config.toml"), "utf8")).toBe(trusted);
    expect(Object.keys(after).filter((path) => path.startsWith(".codex/")).sort()).toEqual([".codex/config.toml", ".codex/hooks.json"]);
    // A run that has nothing to register changes nothing at all, and neither does a preview.
    expect(pregate(i, project, ...CODEX, "--yes").code).toBe(0);
    expect(pregate(i, project, ...CODEX, "--preview").code).toBe(0);
    expect(snapshot(i.home)).toEqual(after);
    // No trust record of PREGATE's own, no global launcher and no other harness home.
    for (const absent of [".local/state/pregate/codex-trust.json", ".claude", ".cursor", ".grok", ".gemini", ".agents", ".local/bin", ".local/share/pregate/bin"]) {
      expect(existsSync(join(i.home, absent)), absent).toBe(false);
    }
  });

  test("the registered PreToolUse command, run from a subdirectory, denies a forbidden apply_patch and allows a compliant one, with no global launcher and a decoy pregate on PATH", () => {
    const i = isolated();
    const project = codexRegistered(i, "repo");
    const command = codexHandler(project, "PreToolUse");
    const target = join(project, INVOICE_REL);
    expect(existsSync(join(i.data, "bin"))).toBe(false);
    expect(existsSync(join(i.home, ".codex"))).toBe(false);
    // Codex started below the root: the hook process and the payload both name that directory, and
    // no variable names the project.
    const below = join(project, BELOW);
    const denied = hook(i, command, below, patchPayload(i, below, updatePatch(target, SETTER_LINES)), null);
    expect(denied.code, `${denied.stdout}\n${denied.stderr}`).toBe(2);
    expect(denied.stderr).toContain("ddd/DDD-ENT-001");
    // Codex blocks on exit 2 with stderr only.
    expect(denied.stdout).toBe("");
    const allowed = hook(i, command, below, patchPayload(i, below, updatePatch(target, QUERY_LINES)), null);
    expect(allowed.code, `${allowed.stdout}\n${allowed.stderr}`).toBe(0);
    expect(`${allowed.stdout}\n${allowed.stderr}`).not.toContain("DENY");
    // The root as session directory gives the same verdict.
    const atRoot = hook(i, command, project, patchPayload(i, project, updatePatch(target, SETTER_LINES)), null);
    expect(atRoot.code, `${atRoot.stdout}\n${atRoot.stderr}`).toBe(2);
    expect(atRoot.stderr).toContain("ddd/DDD-ENT-001");
    for (const out of [denied, allowed, atRoot]) expect(`${out.stdout}\n${out.stderr}`).not.toContain("decoy-hook");
    expect(readFileSync(target, "utf8")).toBe(INVOICE);
  });

  test("from a subdirectory, a missing pinned engine denies with the reason; a missing launcher denies a write and lets Stop pass; a directory outside the repository finds no launcher", () => {
    const i = isolated();
    const project = codexRegistered(i, "repo");
    const pre = codexHandler(project, "PreToolUse"), stop = codexHandler(project, "Stop");
    const below = join(project, BELOW);
    const payload = patchPayload(i, below, updatePatch(join(project, INVOICE_REL), QUERY_LINES));
    const outside = hook(i, pre, join(i.root, "tmp"), payload, null);
    expect(outside.code, `${outside.stdout}\n${outside.stderr}`).toBe(2);
    expect(outside.stderr).toContain("the project launcher is missing");
    removeTree(join(i.data, PIN));
    const noEngine = hook(i, pre, below, payload, null);
    expect(noEngine.code, `${noEngine.stdout}\n${noEngine.stderr}`).toBe(2);
    expect(noEngine.stderr).toContain(`engine ${PIN} is not installed; run pregate prepare`);
    rmSync(join(project, ".pregate/bin"), { recursive: true, force: true });
    const noLauncher = hook(i, pre, below, payload, null);
    expect(noLauncher.code, `${noLauncher.stdout}\n${noLauncher.stderr}`).toBe(2);
    expect(noLauncher.stderr).toContain("the project launcher is missing");
    expect(hook(i, stop, below, "{}", null).code).toBe(0);
    for (const out of [outside, noEngine, noLauncher]) expect(`${out.stdout}\n${out.stderr}`).not.toContain("decoy-hook");
  });

  test("pregate install, setup and uninstall change no byte of the project Codex registration or launcher", () => {
    const i = isolated();
    const project = codexRegistered(i, "repo");
    const tree = () => ({ ...snapshot(join(project, ".codex")), ...snapshot(join(project, ".pregate/bin")) });
    const before = tree();
    const install = pregate(i, project, "install");
    expect(install.code, `${install.stdout}\n${install.stderr}`).toBe(0);
    expect(tree()).toEqual(before);
    // A Codex home is present on this machine, so setup writes its global hooks.json.
    mkdirSync(join(i.home, ".codex"), { recursive: true });
    const setup = pregate(i, project, "setup");
    expect(setup.code, `${setup.stdout}\n${setup.stderr}`).toBe(0);
    expect(readFileSync(join(i.home, ".codex/hooks.json"), "utf8")).toContain("PreToolUse");
    expect(tree()).toEqual(before);
    expect(pregate(i, project, "doctor").stdout).toContain("Codex hooks: project-local and global.");
    const uninstall = pregate(i, project, "uninstall", "--yes");
    expect(uninstall.code, `${uninstall.stdout}\n${uninstall.stderr}`).toBe(0);
    expect(tree()).toEqual(before);
    // uninstall removes the cached engines, so the registration is read from the file, not rerun.
    expect(Object.keys(codexHooksOf(project).hooks).sort()).toEqual(["PreToolUse", "SessionStart", "Stop", "SubagentStart", "SubagentStop"]);
  });
});

describe("doctor and status name the scope of the Codex registration", () => {
  const scopeLine = (out: Out) => out.stdout.split("\n").filter((line) => line.includes("Codex hooks:"));
  const status = (i: Isolated, cwd: string) => JSON.parse(pregate(i, cwd, "status", "--json").stdout) as Json;
  const UNKNOWN = "Hook review state unknown: check `/hooks` in Codex.";

  test("neither, project-local only, both, and global only are four distinct reports, and no report says the project hooks are trusted", () => {
    const i = isolated();
    const project = gitProject(i, "repo");
    // No Codex on this machine: the absence is information, not a warning.
    expect(scopeLine(pregate(i, project, "doctor"))).toEqual([expect.stringContaining("INFO: Codex hooks: neither project-local nor global.")]);
    expect(status(i, project).codexHooks).toBe("none");
    expect(status(i, project).codexHookReview).toBeNull();

    expect(pregate(i, project, ...CODEX, "--yes").code).toBe(0);
    const local = pregate(i, join(project, BELOW), "doctor");
    expect(scopeLine(local)).toEqual([expect.stringContaining("WARNING: Codex hooks: project-local only.")]);
    expect(scopeLine(local)[0]).toContain("Codex config.toml does not mark this project trusted (trust_level: no record).");
    expect(scopeLine(local)[0]).toContain(UNKNOWN);
    expect(local.stdout).toContain(`Project launcher matches the reviewed template and engine ${PIN} is cached. No project canary ran`);
    expect(local.stdout).not.toContain("ERROR:");
    expect(local.code, local.stdout).toBe(0);

    // The one trust fact that is read: the project entry of the user's Codex config.
    put(join(i.home, ".codex/config.toml"), `[projects.${JSON.stringify(project)}]\ntrust_level = "trusted"\n`);
    const marked = pregate(i, project, "doctor");
    expect(scopeLine(marked)).toEqual([expect.stringContaining("INFO: Codex hooks: project-local only.")]);
    expect(scopeLine(marked)[0]).toContain("Codex config.toml marks this project trusted.");
    expect(scopeLine(marked)[0]).toContain(UNKNOWN);
    expect(marked.stdout).not.toContain("ERROR:");
    expect(marked.stdout).not.toContain("Codex runs the PREGATE hooks (trusted)");
    const report = status(i, project);
    expect(report.codexHooks).toBe("project");
    expect(report.codexProjectTrust).toBe("trusted");
    expect(report.codexHookReview).toBe("unknown");
    // A registration whose review is unknown does not count as a gated harness.
    expect(report.harnesses.find((h: Json) => h.id === "codex").configured).toBe(false);
    const text = pregate(i, project, "status").stdout;
    expect(text).toContain("Codex hooks are project-local (.codex/hooks.json of this project). Codex review state unknown: check `/hooks` in Codex.");
    expect(text).not.toMatch(/Harnesses gated: [^.]*codex/);

    put(join(i.home, ".codex/hooks.json"), codexGlobalRegistration(i));
    const both = pregate(i, project, "doctor");
    expect(scopeLine(both)).toEqual([expect.stringContaining("WARNING: Codex hooks: project-local and global.")]);
    expect(scopeLine(both)[0]).toContain("every tool call is evaluated twice");
    expect(scopeLine(both)[0]).toContain(UNKNOWN);
    expect(status(i, project).codexHooks).toBe("both");
    expect(pregate(i, project, "status").stdout).toContain("every tool call is evaluated twice. Codex review state unknown");

    const other = gitProject(i, "other");
    expect(scopeLine(pregate(i, other, "doctor"))).toEqual([expect.stringContaining("INFO: Codex hooks: global only")]);
    expect(status(i, other).codexHooks).toBe("global");
    expect(status(i, other).codexHookReview).toBeNull();
  });

  test("doctor names a modified registration and a launcher that differs", () => {
    const i = isolated();
    const project = codexRegistered(i, "repo");
    const clean = readFileSync(join(project, CODEX_HOOKS), "utf8");
    const edited = JSON.parse(clean) as Json;
    edited.hooks.PreToolUse[0].matcher = "^Bash$";
    writeFileSync(join(project, CODEX_HOOKS), JSON.stringify(edited, null, 2));
    const modified = pregate(i, project, "doctor");
    expect(modified.code).toBe(1);
    expect(modified.stdout).toContain("ERROR: .codex/hooks.json: PREGATE project hooks are missing, modified or written for another platform");
    expect(modified.stdout).not.toContain("project-local only");

    writeFileSync(join(project, CODEX_HOOKS), clean);
    const launcher = join(project, ".pregate/bin", WINDOWS ? "pregate.cmd" : "pregate");
    writeFileSync(launcher, `${readFileSync(launcher, "utf8")}\n`);
    expect(pregate(i, project, "doctor").stdout).toContain("ERROR: The project launcher in .pregate/bin differs from the reviewed template");
  });
});
