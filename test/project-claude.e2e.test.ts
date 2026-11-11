import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { enable, disable } from "../src/consent.ts";
import { projectHookCommand } from "../src/project-claude.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { commandScript } from "../src/windows-command.ts";
import { engineAt } from "./compiled-engine.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// Repository-owned Claude hooks: safe merge, no global fallback, doctor scope separate from workspace trust.

setDefaultTimeout(180_000);

const WINDOWS = process.platform === "win32";
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-project-claude-")));
const BIN = join(TMP, "dist", ENGINE_FILE);
const DEMO = join(import.meta.dir, "demo-repo");
const PRESETS = join(import.meta.dir, "../catalog/presets");
const INVOICE_REL = "src/domain/invoice.ts";
const INVOICE = readFileSync(join(DEMO, INVOICE_REL), "utf8");
const SETTER = INVOICE.replace(
  "  billedTo(): string {",
  "  rename(customer: string): void {\n    this.customer = customer;\n  }\n\n  billedTo(): string {",
);
const LEGACY = `f="$PWD/.pregate/bin/pregate"; [ -f "$f" ] && "$f" hook pre`;

interface Out { code: number | null; stdout: string; stderr: string }
interface Isolated { root: string; home: string; data: string; env: Record<string, string>; decoy: string }

beforeAll(() => engineAt(BIN));
afterAll(() => removeTree(TMP));

function isolated(): Isolated {
  const root = join(TMP, `p${Math.random().toString(36).slice(2)}`);
  const home = join(root, "home");
  mkdirSync(join(home, ".config"), { recursive: true });
  const decoy = join(root, "bin", WINDOWS ? "pregate.cmd" : "pregate");
  mkdirSync(dirname(decoy), { recursive: true });
  writeFileSync(decoy, WINDOWS ? "@echo decoy-hook 1>&2\r\n@exit /b 0\r\n" : "#!/bin/sh\necho decoy-hook >&2\nexit 0\n", { mode: 0o755 });
  const git = Bun.which("git");
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  // The registered command is `powershell.exe … -EncodedCommand`. Claude finds that binary on PATH.
  // System32 stays after the decoy, so a `pregate` on PATH is still the decoy.
  const windowsPath = [
    join(root, "bin"), join(systemRoot, "System32"), join(systemRoot, "System32", "WindowsPowerShell", "v1.0"),
    ...(git === null ? [] : [dirname(git)]),
  ].join(";");
  const env: Record<string, string> = {
    HOME: home,
    USERPROFILE: home,
    XDG_DATA_HOME: join(home, ".local/share"),
    XDG_STATE_HOME: join(home, ".local/state"),
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_CACHE_HOME: join(home, ".cache"),
    TMPDIR: join(root, "tmp"),
    CODEX_HOME: join(home, ".codex"),
    GROK_HOME: join(home, ".grok"),
    PATH: WINDOWS ? windowsPath : `${join(root, "bin")}:/usr/bin:/bin`,
    SHELL: "/bin/sh",
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    GIT_AUTHOR_NAME: "W",
    GIT_AUTHOR_EMAIL: "w@e",
    GIT_COMMITTER_NAME: "W",
    GIT_COMMITTER_EMAIL: "w@e",
  };
  if (WINDOWS) {
    env.SystemRoot = systemRoot;
    env.PATHEXT = process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  }
  mkdirSync(env.XDG_DATA_HOME!, { recursive: true });
  mkdirSync(join(root, "tmp"), { recursive: true });
  if (git !== null && !WINDOWS) symlinkSync(git, join(root, "bin", "git"));
  return { root, home, data: join(env.XDG_DATA_HOME!, "pregate"), env, decoy };
}

function run(cmd: string[], i: Isolated, cwd: string, stdin?: string): Out {
  const r = Bun.spawnSync(cmd, {
    cwd, env: i.env, stdin: stdin === undefined ? "ignore" : Buffer.from(stdin),
    stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (lstatSync(path).isDirectory()) walk(path);
      else out.push(path);
    }
  };
  walk(dir);
  return out.sort();
}

function gitProject(i: Isolated): string {
  const project = join(i.root, "repo");
  cpSync(DEMO, project, { recursive: true });
  rmSync(join(project, ".git"), { recursive: true, force: true });
  const presetDoc = JSON.parse(policyFixture(readFileSync(join(PRESETS, "backend-clean-ddd.json"), "utf8"))) as { engine?: string };
  put(join(project, ".pregate/preset.json"), JSON.stringify({ ...presetDoc, engine: pkg.version }));
  const dest = join(i.data, pkg.version);
  mkdirSync(dest, { recursive: true });
  cpSync(BIN, join(dest, ENGINE_FILE));
  if (!WINDOWS) chmodSync(join(dest, ENGINE_FILE), 0o755);
  const engine = join(dest, ENGINE_FILE);
  expect(run([engine, "preset", "compile", "--yes"], i, project).code).toBe(0);
  Bun.spawnSync(["git", "init", "-q"], { cwd: project, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@e", "-c", "commit.gpgsign=false", "add", "-A"], { cwd: project, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@e", "-c", "commit.gpgsign=false", "commit", "-qm", "init"], { cwd: project, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  expect(run([engine, "project", "launcher", "--yes"], i, project).code).toBe(0);
  return project;
}

function prePayload(project: string, home: string, content: string): string {
  const sid = "00000000-0000-4000-8000-000000000001";
  return `${JSON.stringify({
    session_id: sid,
    transcript_path: join(home, `.claude/projects/p/${sid}.jsonl`),
    cwd: project,
    permission_mode: "acceptEdits",
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: join(project, INVOICE_REL), content },
    tool_use_id: `toolu_${createHash("sha256").update(content).digest("hex").slice(0, 12)}`,
  })}\n`;
}

function registeredCommand(project: string): string {
  const doc = JSON.parse(readFileSync(join(project, ".claude/settings.json"), "utf8")) as {
    hooks: { PreToolUse: { hooks: { command: string }[] }[] };
  };
  return doc.hooks.PreToolUse.at(-1)!.hooks[0]!.command;
}

function hook(i: Isolated, project: string, content: string): Out {
  const command = registeredCommand(project);
  const env = { ...i, env: { ...i.env, CLAUDE_PROJECT_DIR: project } };
  const argv = WINDOWS ? ["cmd.exe", "/d", "/s", "/c", command] : ["/bin/sh", "-c", command];
  return run(argv, env, project, prePayload(project, i.home, content));
}

describe("project-local Claude setup", () => {
  test("install keeps a project launcher and current hooks, and still removes a 0.1.0 handler", () => {
    const i = isolated();
    const project = gitProject(i);
    const launcher = join(project, ".pregate/bin", WINDOWS ? "pregate.cmd" : "pregate");
    const custom = readFileSync(launcher, "utf8") + "# local note\n";
    writeFileSync(launcher, custom);
    const current = projectHookCommand("pre", WINDOWS);
    const settings = {
      permissions: { allow: ["Bash(ls)"] },
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "echo foreign" }] },
          { hooks: [{ type: "command", command: LEGACY }] },
          { matcher: "Write|Edit", hooks: [{ type: "command", command: current, timeout: 120 }] },
        ],
      },
    };
    put(join(project, ".claude/settings.json"), `${JSON.stringify(settings, null, 2)}\n`);
    const out = run([join(i.data, pkg.version, ENGINE_FILE), "install"], i, project);
    expect(out.code, out.stderr + out.stdout).toBe(0);
    expect(readFileSync(launcher, "utf8")).toBe(custom);
    const after = JSON.parse(readFileSync(join(project, ".claude/settings.json"), "utf8")) as {
      permissions: unknown;
      hooks: { PreToolUse: { hooks: { command: string }[] }[] };
    };
    expect(after.permissions).toEqual(settings.permissions);
    const commands = after.hooks.PreToolUse.flatMap((group) => group.hooks.map((hook) => hook.command));
    expect(commands).toContain("echo foreign");
    expect(commands).toContain(current);
    expect(commands).not.toContain(LEGACY);
    expect(out.stdout).toContain("Repository-owned hooks were left in place.");
  });

  test("setup is byte-idempotent, preserves foreign hooks, leaves HOME untouched, and denies only after policy consent", () => {
    const i = isolated();
    const project = gitProject(i);
    const foreign = {
      permissions: { allow: ["Bash(ls)"] },
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo foreign-pre" }] }],
        Stop: [{ hooks: [{ type: "command", command: "echo foreign-stop" }] }],
      },
    };
    put(join(project, ".claude/settings.json"), `${JSON.stringify(foreign, null, 2)}\n`);
    const engine = join(i.data, pkg.version, ENGINE_FILE);
    const homeBefore = filesUnder(i.home);
    const first = run([engine, "project", "setup"], i, project);
    expect(first.code, first.stderr + first.stdout).toBe(0);
    expect(first.stdout).toContain("Other hook groups were left in place.");
    expect(first.stdout).toContain("workspace trust is separate from policy consent");
    expect(filesUnder(i.home)).toEqual(homeBefore);
    expect(existsSync(join(i.home, ".claude/settings.json"))).toBe(false);
    expect(existsSync(join(i.home, ".claude.json"))).toBe(false);
    expect(existsSync(join(i.data, "bin/pregate"))).toBe(false);
    expect(existsSync(join(i.data, "consent"))).toBe(false);
    const settingsPath = join(project, ".claude/settings.json");
    const once = readFileSync(settingsPath, "utf8");
    const doc = JSON.parse(once) as {
      permissions: unknown;
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    expect(doc.permissions).toEqual(foreign.permissions);
    expect(doc.hooks.PreToolUse![0]!.hooks[0]!.command).toBe("echo foreign-pre");
    expect(doc.hooks.Stop![0]!.hooks[0]!.command).toBe("echo foreign-stop");
    const owned = commandScript(doc.hooks.PreToolUse!.at(-1)!.hooks[0]!.command);
    expect(owned.includes(".pregate/bin/pregate") || owned.includes(".pregate/bin/project-launcher.ps1")).toBe(true);
    expect(owned).not.toContain("decoy");
    const second = run([engine, "project", "setup"], i, project);
    expect(second.code, second.stderr + second.stdout).toBe(0);
    expect(second.stdout).toContain("already has the repository-owned Claude hooks");
    expect(readFileSync(settingsPath, "utf8")).toBe(once);
    expect(filesUnder(i.home)).toEqual(homeBefore);

    const target = join(project, INVOICE_REL);
    const before = readFileSync(target, "utf8");
    const inert = hook(i, project, SETTER);
    expect(inert.code, inert.stderr + inert.stdout).toBe(0);
    expect(readFileSync(target, "utf8")).toBe(before);
    expect(existsSync(join(i.home, ".claude.json"))).toBe(false);

    enable(project, i.data);
    put(join(i.home, ".claude.json"), `${JSON.stringify({ projects: { [project]: { hasTrustDialogAccepted: true } } })}\n`);
    const denied = hook(i, project, SETTER);
    expect(denied.code, `${denied.stdout}\n${denied.stderr}`).toBe(2);
    expect(`${denied.stdout}\n${denied.stderr}`).toContain("ddd/DDD-ENT-001");
    expect(`${denied.stdout}\n${denied.stderr}`).not.toContain("decoy-hook");
    expect(readFileSync(target, "utf8")).toBe(before);
    expect(readFileSync(join(i.home, ".claude.json"), "utf8")).toContain("hasTrustDialogAccepted");
    expect(existsSync(join(i.home, ".claude/settings.json"))).toBe(false);
    expect(readFileSync(settingsPath, "utf8")).toBe(once);

    disable(project, i.data);
    const trustedOnly = hook(i, project, SETTER);
    expect(trustedOnly.code, trustedOnly.stderr + trustedOnly.stdout).toBe(0);
    expect(readFileSync(target, "utf8")).toBe(before);
    enable(project, i.data);

    const diagnosis = run([engine, "doctor"], i, project);
    expect(diagnosis.code, diagnosis.stdout + diagnosis.stderr).toBe(0);
    expect(diagnosis.stdout).toContain(`Project scope: repository-owned Claude hooks in .claude/settings.json run the project launcher for engine ${pkg.version}.`);
    expect(diagnosis.stdout).toContain("Workspace trust and policy consent are separate.");
    expect(diagnosis.stdout).toContain("Policy consent is active");
    expect(diagnosis.stdout).toContain("claude-code: project hook denied in its native dialect.");
    expect(diagnosis.stdout).toContain("does not fall back to PATH");
    expect(diagnosis.stdout).toContain("does not fall back to it");
    expect(diagnosis.stdout).not.toContain("ERROR:");
    expect(readFileSync(settingsPath, "utf8")).toBe(once);

    writeFileSync(join(i.home, ".claude.json"), "{}\n");
    const untrusted = run([engine, "doctor"], i, project);
    expect(untrusted.stdout).toContain("Claude workspace trust is not accepted");
    expect(untrusted.stdout).toContain("does not grant policy consent");
    expect(untrusted.stdout).toContain("Policy consent is active");
    expect(untrusted.code, untrusted.stdout + untrusted.stderr).toBe(0);
  });
});
