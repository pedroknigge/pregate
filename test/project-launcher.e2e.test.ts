import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { enable } from "../src/consent.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { policyFixture } from "./policy-fixtures.ts";

// Project-local launcher resolves the lock engine from the cache; step 3 of project-bounded mode.

setDefaultTimeout(180_000);

const WINDOWS = process.platform === "win32";
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "pregate-project-launcher-")));
const BIN = join(TMP, "dist", WINDOWS ? "pregate.exe" : "pregate");
const DEMO = join(import.meta.dir, "demo-repo");
const PRESETS = join(import.meta.dir, "../catalog/presets");
const PIN_A = "9.9.7";
const PIN_B = "9.9.8";
const INVOICE_REL = "src/domain/invoice.ts";
const INVOICE = readFileSync(join(DEMO, INVOICE_REL), "utf8");
const SETTER = INVOICE.replace(
  "  billedTo(): string {",
  "  rename(customer: string): void {\n    this.customer = customer;\n  }\n\n  billedTo(): string {",
);
const CLOCK = INVOICE.replace(
  "  isIssued(): boolean {",
  "  issuedOn(): number {\n    return Date.now();\n  }\n\n  isIssued(): boolean {",
);

interface Out { code: number | null; stdout: string; stderr: string }
interface Isolated { root: string; home: string; data: string; env: Record<string, string>; decoy: string }

beforeAll(async () => {
  compileBinary(hostTarget(), BIN);
  mkdirSync(join(TMP, "engines"), { recursive: true });
  await buildEngine(PIN_A, join(TMP, "engines", PIN_A, ENGINE_FILE));
  await buildEngine(PIN_B, join(TMP, "engines", PIN_B, ENGINE_FILE));
});
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

async function buildEngine(version: string, dest: string): Promise<void> {
  mkdirSync(dirname(dest), { recursive: true });
  const built = await Bun.build({
    entrypoints: ["src/main.ts"], target: "bun", minify: true,
    compile: { target: `bun-${hostTarget()}`, outfile: dest, autoloadDotenv: false, autoloadBunfig: false },
    plugins: [{ name: "pinned-engine-version", setup(build) {
      build.onLoad({ filter: /package\.json$/ }, () => ({ loader: "json", contents: JSON.stringify({ ...pkg, version }) }));
    } }],
  });
  if (!built.success) throw new Error(built.logs.map((l) => l.message).join("\n"));
  if (WINDOWS) chmodSync(dest, 0o755);
}

function isolated(): Isolated {
  const root = join(TMP, `p${Math.random().toString(36).slice(2)}`);
  const home = join(root, "home");
  mkdirSync(join(home, ".config"), { recursive: true });
  const decoy = join(root, "bin", WINDOWS ? "pregate.cmd" : "pregate");
  mkdirSync(dirname(decoy), { recursive: true });
  writeFileSync(decoy, WINDOWS ? "@echo decoy\r\nexit 0\r\n" : "#!/bin/sh\necho decoy-hook >&2\nexit 0\n", { mode: 0o755 });
  const env = {
    HOME: home,
    XDG_DATA_HOME: join(home, ".local/share"),
    XDG_STATE_HOME: join(home, ".local/state"),
    XDG_CONFIG_HOME: join(home, ".config"),
    XDG_CACHE_HOME: join(home, ".cache"),
    TMPDIR: join(root, "tmp"),
    CODEX_HOME: join(home, ".codex"),
    GROK_HOME: join(home, ".grok"),
    PATH: WINDOWS
      ? `${join(root, "bin")};${join(home, ".local/bin")};/usr/bin;/bin`
      : `${join(root, "bin")}:/usr/bin:/bin:${home}/.local/bin`,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
  };
  mkdirSync(env.XDG_DATA_HOME, { recursive: true });
  mkdirSync(join(root, "tmp"), { recursive: true });
  const git = Bun.which("git");
  if (git !== null) symlinkSync(git, join(root, "bin", WINDOWS ? "git.exe" : "git"));
  return { root, home, data: join(env.XDG_DATA_HOME, "pregate"), env, decoy };
}

function run(cmd: string[], i: Isolated, cwd: string): Out {
  const r = Bun.spawnSync(cmd, { cwd, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 120_000 });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function installEngine(i: Isolated, version: string, from: string): void {
  const dest = join(i.data, version);
  mkdirSync(dest, { recursive: true });
  cpSync(from, join(dest, ENGINE_FILE));
  if (!WINDOWS) chmodSync(join(dest, ENGINE_FILE), 0o755);
}

function gitProject(i: Isolated, name: string, presetFile: string, pin: string): string {
  const project = join(i.root, name);
  cpSync(DEMO, project, { recursive: true });
  rmSync(join(project, ".git"), { recursive: true, force: true });
  const presetDoc = JSON.parse(policyFixture(readFileSync(join(PRESETS, presetFile), "utf8")));
  put(join(project, ".pregate/preset.json"), JSON.stringify({ ...presetDoc, engine: pin }));
  installEngine(i, pin, join(TMP, "engines", pin, ENGINE_FILE));
  const engine = join(i.data, pin, ENGINE_FILE);
  expect(run([engine, "preset", "compile", "--yes"], i, project).code).toBe(0);
  Bun.spawnSync(["git", "init", "-q"], { cwd: project, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@e", "-c", "commit.gpgsign=false", "add", "-A"], { cwd: project, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  Bun.spawnSync(["git", "-c", "user.name=W", "-c", "user.email=w@e", "-c", "commit.gpgsign=false", "commit", "-qm", "init"], { cwd: project, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  enable(project, i.data);
  expect(run([engine, "project", "launcher", "--yes"], i, project).code).toBe(0);
  const launcher = join(project, ".pregate/bin", WINDOWS ? "pregate.cmd" : "pregate");
  expect(existsSync(launcher)).toBe(true);
  if (!WINDOWS) expect(statSync(launcher).mode & 0o111).not.toBe(0);
  return project;
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

function hookPre(i: Isolated, project: string, payload: string): Out {
  const launcher = join(project, ".pregate/bin", WINDOWS ? "pregate.cmd" : "pregate");
  const env = { ...i.env, CLAUDE_PROJECT_DIR: project, PREGATE_TESTING: "1" };
  const r = Bun.spawnSync([launcher, "hook", "pre", "--harness", "claude-code"], {
    cwd: project, env, stdin: Buffer.from(payload), stdout: "pipe", stderr: "pipe", timeout: 120_000,
  });
  return { code: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

describe("project launcher", () => {
  test("two pinned engines deny distinct rules through project launchers while PATH names a decoy global binary", () => {
    const i = isolated();
    const repoA = gitProject(i, "repo-a", "backend-clean-ddd.json", PIN_A);
    const repoB = gitProject(i, "repo-b", "functional-ts.json", PIN_B);
    const targetA = join(repoA, INVOICE_REL);
    const targetB = join(repoB, INVOICE_REL);
    const beforeA = readFileSync(targetA, "utf8");
    const beforeB = readFileSync(targetB, "utf8");
    const outA = hookPre(i, repoA, prePayload(repoA, i.home, INVOICE_REL, SETTER));
    const outB = hookPre(i, repoB, prePayload(repoB, i.home, INVOICE_REL, CLOCK));
    expect(outA.code, `${outA.stdout}\n${outA.stderr}`).toBe(2);
    expect(outB.code, `${outB.stdout}\n${outB.stderr}`).toBe(2);
    expect(`${outA.stdout}\n${outA.stderr}`).toContain("ddd/DDD-ENT-001");
    expect(`${outB.stdout}\n${outB.stderr}`).toContain("architecture/FCIS-IO-002");
    expect(readFileSync(targetA, "utf8")).toBe(beforeA);
    expect(readFileSync(targetB, "utf8")).toBe(beforeB);
    const decoyHit = Bun.spawnSync([i.decoy, "hook", "pre"], { cwd: repoA, env: i.env, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    expect(decoyHit.stderr.toString()).toContain("decoy-hook");
    expect(outA.stderr).not.toContain("decoy-hook");
    expect(outB.stderr).not.toContain("decoy-hook");
  });

  test("missing or corrupt cached engines fail closed without modifying the repository", () => {
    const i = isolated();
    const repo = gitProject(i, "repo-missing", "backend-clean-ddd.json", PIN_A);
    rmSync(join(i.data, PIN_A), { recursive: true, force: true });
    const target = join(repo, INVOICE_REL);
    const before = readFileSync(target, "utf8");
    const payload = prePayload(repo, i.home, INVOICE_REL, SETTER);
    const missing = hookPre(i, repo, payload);
    expect(missing.code).toBe(2);
    expect(`${missing.stdout}\n${missing.stderr}`).toMatch(/prepare|not installed/i);
    expect(readFileSync(target, "utf8")).toBe(before);
    mkdirSync(join(i.data, PIN_A), { recursive: true });
    writeFileSync(join(i.data, PIN_A, ENGINE_FILE), "");
    if (!WINDOWS) chmodSync(join(i.data, PIN_A, ENGINE_FILE), 0o755);
    const corrupt = hookPre(i, repo, payload);
    expect(corrupt.code).toBe(2);
    expect(readFileSync(target, "utf8")).toBe(before);
  });
});
