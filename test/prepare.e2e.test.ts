import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { enable } from "../src/consent.ts";
import { policyFixture } from "./policy-fixtures.ts";

// prepare installs a verified engine into the cache without machine registration (project-bounded step 1).

setDefaultTimeout(120_000);

const WINDOWS = process.platform === "win32";
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-prepare-")));
const BIN = join(TMP, "dist/pregate");
const DEMO = join(import.meta.dir, "demo-repo");
const PRESETS = join(import.meta.dir, "../catalog/presets");
const INVOICE_REL = "src/domain/invoice.ts";
const INVOICE = readFileSync(join(DEMO, INVOICE_REL), "utf8");
const SETTER = INVOICE.replace(
  "  billedTo(): string {",
  "  rename(customer: string): void {\n    this.customer = customer;\n  }\n\n  billedTo(): string {",
);
const ENGINE_VER = pkg.version;
const ASSET = `pregate-${ENGINE_VER}-${hostTarget()}.${WINDOWS ? "zip" : "tar.gz"}`;

interface Out { code: number | null; stdout: string; stderr: string }
interface Isolated {
  root: string; home: string; data: string; env: Record<string, string>;
  settings: string; hooks: string; cursorHooks: string; launcher: string; link: string;
}

beforeAll(() => compileBinary(hostTarget(), BIN));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

function isolated(): Isolated {
  const root = join(TMP, `p${Math.random().toString(36).slice(2)}`);
  const home = join(root, "home");
  mkdirSync(join(home, ".config"), { recursive: true });
  const env = {
    HOME: home,
    XDG_DATA_HOME: join(home, ".local/share"),
    XDG_STATE_HOME: join(home, ".local/state"),
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_CACHE_HOME: join(home, ".cache"),
    TMPDIR: join(root, "tmp"),
    CODEX_HOME: join(home, ".codex"),
    GROK_HOME: join(home, ".grok"),
    PATH: `${join(root, "bin")}:/usr/bin:/bin:${home}/.local/bin`,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    LOG: join(root, "log"),
  };
  mkdirSync(env.XDG_DATA_HOME, { recursive: true });
  mkdirSync(join(root, "tmp"), { recursive: true });
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  for (const name of ["git"]) {
    const tool = Bun.which(name);
    if (tool !== null) symlinkSync(tool, join(bin, name));
  }
  return {
    root, home, data: join(env.XDG_DATA_HOME, "pregate"), env,
    settings: join(home, ".claude/settings.json"),
    hooks: join(env.CODEX_HOME, "hooks.json"),
    cursorHooks: join(home, ".cursor/hooks.json"),
    launcher: join(env.XDG_DATA_HOME, "pregate/bin/pregate"),
    link: join(home, ".local/bin/pregate"),
  };
}

function run(cmd: string[], i: Isolated, cwd = i.home): Out {
  const r = Bun.spawnSync(cmd, { cwd, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 100_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function put(path: string, text: string, mode = 0o644): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { mode });
}

function release(i: Isolated, sums?: string): string {
  const dir = join(i.root, "release");
  put(join(dir, `x/${WINDOWS ? "pregate.exe" : "pregate"}`), readFileSync(BIN), 0o755);
  const archivePath = join(dir, ASSET);
  const inner = join(dir, "x", WINDOWS ? "pregate.exe" : "pregate");
  const pack = WINDOWS
    ? ["powershell.exe", "-NoProfile", "-Command", `Compress-Archive -Path '${inner.replaceAll("'", "''")}' -DestinationPath '${archivePath.replaceAll("'", "''")}' -Force`]
    : ["tar", "-czf", archivePath, "-C", join(dir, "x"), "pregate"];
  const packed = Bun.spawnSync(pack, { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 60_000 });
  if (packed.exitCode !== 0) throw new Error(`release archive failed: ${packed.stderr.toString()}`);
  put(join(dir, "SHA256SUMS"), sums ?? `${createHash("sha256").update(readFileSync(archivePath)).digest("hex")}  ${ASSET}\n`);
  return dir;
}

function pinArchive(i: Isolated, sums?: string, sha?: string): string {
  const dir = release(i, sums);
  const archive = join(dir, ASSET);
  const hash = sha ?? createHash("sha256").update(readFileSync(archive)).digest("hex");
  i.env.PREGATE_ARCHIVE = archive;
  i.env.PREGATE_SHA256 = hash;
  return archive;
}

const SKILL_DIRS = [".agents/skills", ".claude/skills", ".codex/skills", ".cursor/skills", ".grok/skills", ".gemini/antigravity-cli/skills"];
const PROFILE_FILES = [".profile", ".zshrc", ".bashrc", ".bash_profile"];

function snapshot(i: Isolated): Record<string, string> {
  const paths = [
    i.settings, i.hooks, i.cursorHooks, i.launcher, i.link,
    join(i.home, ".gemini/config/config.json"),
    join(i.home, ".grok/config.toml"),
    ...SKILL_DIRS.map((d) => join(i.home, d, "pregate/SKILL.md")),
    ...PROFILE_FILES.map((f) => join(i.home, f)),
    join(i.data, "consent"),
  ];
  return Object.fromEntries(paths.map((p) => {
    if (!existsSync(p)) return [p, "absent"];
    const s = statSync(p);
    return [p, s.isDirectory() ? `dir:${s.mtimeMs}` : `${s.mtimeMs}:${createHash("sha256").update(readFileSync(p)).digest("hex")}`];
  }));
}

describe("pregate prepare", () => {
  test("installs a verified engine into the cache without changing harness homes, skills, launcher, link or profiles", () => {
    const i = isolated();
    const before = snapshot(i);
    pinArchive(i);
    const out = run([BIN, "prepare", "--engine", ENGINE_VER], i);
    expect(out.code, `${out.stdout}\n${out.stderr}`).toBe(0);
    expect(out.stdout).toContain(`Engine ${ENGINE_VER} installed at ${join(i.data, ENGINE_VER)}`);
    expect(existsSync(join(i.data, ENGINE_VER, WINDOWS ? "pregate.exe" : "pregate"))).toBe(true);
    expect(snapshot(i)).toEqual(before);
    expect(existsSync(join(i.data, "bin"))).toBe(false);
    expect(existsSync(i.link)).toBe(false);
  });

  test("uses the project lock engine when no version flag is given", () => {
    const i = isolated();
    const project = join(i.root, "project");
    mkdirSync(project, { recursive: true });
    pinArchive(i);
    expect(run([BIN, "init", "--yes", "--preset", "integrity-only"], i, project).code).toBe(0);
    const lock = join(project, ".pregate/pregate.lock.json");
    put(lock, JSON.stringify({ ...JSON.parse(readFileSync(lock, "utf8")), engine: ENGINE_VER }));
    const out = run([BIN, "prepare"], i, project);
    expect(out.code, out.stdout).toBe(0);
    expect(existsSync(join(i.data, ENGINE_VER, WINDOWS ? "pregate.exe" : "pregate"))).toBe(true);
  });

  test("checksum mismatch leaves nothing half-installed and leaves the machine snapshot unchanged", () => {
    const i = isolated();
    const before = snapshot(i);
    const listing = readdirEngines(i.data);
    pinArchive(i, undefined, "0".repeat(64));
    const out = run([BIN, "prepare", "--engine", ENGINE_VER], i);
    expect(out.code).toBe(1);
    expect(out.stdout).toContain("differs from SHA256SUMS");
    expect(existsSync(join(i.data, ENGINE_VER))).toBe(false);
    expect(snapshot(i)).toEqual(before);
    expect(readdirEngines(i.data)).toEqual(listing);
  });

  test("the prepared engine enforces a real fixture contract", () => {
    const i = isolated();
    pinArchive(i);
    expect(run([BIN, "prepare", "--engine", ENGINE_VER], i).code).toBe(0);
    const engine = join(i.data, ENGINE_VER, WINDOWS ? "pregate.exe" : "pregate");
    const project = join(i.root, "contract");
    cpDemo(project);
    put(
      join(project, ".pregate/preset.json"),
      policyFixture(readFileSync(join(PRESETS, "backend-clean-ddd.json"), "utf8")),
    );
    expect(run([BIN, "preset", "compile", "--yes"], i, project).code).toBe(0);
    expect(Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@e", "add", "-A"], { cwd: project, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
    expect(Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@e", "commit", "-qm", "pregate"], { cwd: project, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
    enable(project, i.data);
    const sid = "00000000-0000-4000-8000-000000000001";
    const hookEnv = { ...i.env, CLAUDE_PROJECT_DIR: project, PREGATE_TESTING: "1" };
    const sessionStart = `${JSON.stringify({
      session_id: sid,
      transcript_path: join(i.home, `.claude/projects/p/${sid}.jsonl`),
      cwd: project,
      hook_event_name: "SessionStart",
      source: "startup",
    })}\n`;
    expect(Bun.spawnSync([engine, "hook", "session-start", "--harness", "claude-code"], {
      cwd: project, env: hookEnv, stdin: Buffer.from(sessionStart), stdout: "pipe", stderr: "pipe", timeout: 120_000,
    }).exitCode).toBe(0);
    const payload = `${JSON.stringify({
      session_id: sid,
      transcript_path: join(i.home, `.claude/projects/p/${sid}.jsonl`),
      cwd: project,
      prompt_id: "00000000-0000-4000-8000-0000000000a1",
      permission_mode: "acceptEdits",
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: join(project, INVOICE_REL), content: SETTER },
      tool_use_id: "toolu_prepare_contract",
    })}\n`;
    const hook = Bun.spawnSync([engine, "hook", "pre", "--harness", "claude-code"], {
      cwd: project, env: hookEnv, stdin: Buffer.from(payload),
      stdout: "pipe", stderr: "pipe", timeout: 120_000,
    });
    const combined = `${hook.stdout}\n${hook.stderr}`;
    expect(hook.exitCode, combined).toBe(2);
    expect(combined).toContain("ddd/DDD-ENT-001");
  });
});

function readdirEngines(data: string): string[] {
  if (!existsSync(data)) return [];
  return readdirSync(data).filter((name) => /^\d+\.\d+\.\d+/.test(name)).sort();
}

function cpDemo(project: string): void {
  rmSync(project, { recursive: true, force: true });
  cpSync(DEMO, project, { recursive: true });
  rmSync(join(project, ".git"), { recursive: true, force: true });
  Bun.spawnSync(["git", "init", "-q"], { cwd: project, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@e", "-c", "commit.gpgsign=false", "add", "-A"], { cwd: project, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@e", "-c", "commit.gpgsign=false", "commit", "-qm", "init"], { cwd: project, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
}
