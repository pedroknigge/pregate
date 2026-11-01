import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { enable } from "../src/consent.ts";
import { sha256 } from "../src/state.ts";
import { slash } from "../src/paths.ts";

// The compiled engine's Pre hook, cold (cache deleted) against warm (compiled lock reused).
// Decisions must match. Changing the lock or a path rule must miss. A corrupt cache recompiles.

setDefaultTimeout(180_000);
const RUNS = 25;
// The engine keys the cache by the real root path; macOS tmpdir is a symlink.
const work = realpathSync(mkdtempSync(join(tmpdir(), "pregate-lock-cache-e2e-")));
const repo = join(work, "repo");
const home = join(work, "home");
const xdgData = join(work, "xdg-data");
const xdgState = join(work, "xdg-state");
const bin = join(xdgData, "pregate", pkg.version, "pregate");
const sourcePath = join(repo, "rules/local/source.json");
const money = join(repo, "src/domain/values/money.ts");
const SOURCE = `${JSON.stringify({ ns: "local", version: "1.0.0" }, null, 2)}\n`;

process.env.HOME = home;
process.env.XDG_DATA_HOME = xdgData;
process.env.XDG_STATE_HOME = xdgState;
const env: Record<string, string> = {
  ...process.env,
  HOME: home, XDG_DATA_HOME: xdgData, XDG_STATE_HOME: xdgState, TMPDIR: join(work, "tmp"),
  PATH: ["/usr/bin", "/bin", process.env.PATH, process.env.Path].filter(Boolean).join(delimiter), GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
  GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
} as Record<string, string>;

interface Out { code: number; stdout: string; stderr: string; ms: number }
type Edit = { kind: "allow" } | { kind: "syntax" };

afterAll(() => rmSync(work, { recursive: true, force: true }));

test("Pre hook reuses the compiled lock and reports cold versus warm latency", () => {
  install();
  const coldAllow = measure("allow", true);
  const warmAllow = measure("allow", false);
  const coldDeny = hook("syntax-cold", { kind: "syntax" }, true);
  const warmDeny = hook("syntax-warm", { kind: "syntax" }, false);
  expect(decision(coldDeny)).toEqual(decision(warmDeny));
  expect(coldDeny.stderr).toContain("syntax");
  const cached = readFileSync(cachePath(), "utf8");
  writeFileSync(sourcePath, SOURCE.replace("1.0.0", "9.9.9"));
  const rule = hook("rule", { kind: "allow" }, false);
  expect(rule.code).toBe(2);
  expect(rule.stderr).toContain("lock-stale");
  expect(readFileSync(cachePath(), "utf8")).toBe(cached);
  writeFileSync(sourcePath, SOURCE);
  const ruleRestored = hook("rule-restored", { kind: "allow" }, false);
  expect(decision(ruleRestored)).toEqual(decision(warmAllow[0]!));
  expect(readFileSync(cachePath(), "utf8")).toBe(cached);
  const lockPath = join(repo, ".pregate/pregate.lock.json");
  const lockText = readFileSync(lockPath, "utf8");
  writeFileSync(lockPath, lockText.replace(`"lockVersion": 1`, `"lockVersion": 2`));
  const lock = hook("lock", { kind: "allow" }, false);
  expect(lock.code).toBe(2);
  expect(lock.stderr).toContain("lock-stale");
  expect(readFileSync(cachePath(), "utf8")).toBe(cached);
  writeFileSync(lockPath, lockText);
  writeFileSync(cachePath(), "{broken");
  const recovered = hook("recovered", { kind: "allow" }, false);
  expect(decision(recovered)).toEqual(decision(warmAllow[0]!));
  const rewritten = readFileSync(cachePath(), "utf8");
  expect(rewritten).not.toBe("{broken");
  expect(JSON.parse(rewritten).v).toBe(1);
  const report = latencyReport(coldAllow, warmAllow);
  console.log(report);
  const coldMs = coldAllow.map((sample) => sample.ms);
  const warmMs = warmAllow.map((sample) => sample.ms);
  expect(percentile(warmMs, 50)).toBeLessThan(percentile(coldMs, 50));
  expect(percentile(warmMs, 95)).toBeLessThan(percentile(coldMs, 95));
});

function install(): void {
  mkdirSync(dirname(bin), { recursive: true });
  mkdirSync(env.TMPDIR!, { recursive: true });
  compileBinary(hostTarget(), bin);
  cpSync(join(import.meta.dir, "demo-repo"), repo, { recursive: true });
  mkdirSync(join(repo, ".pregate"), { recursive: true });
  const preset = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json"), "utf8")) as { sources: unknown[] };
  preset.sources.push({ ns: "local", kind: "path", path: "rules/local" });
  writeFileSync(join(repo, ".pregate/preset.json"), `${JSON.stringify(preset, null, 2)}\n`);
  mkdirSync(dirname(sourcePath), { recursive: true });
  writeFileSync(sourcePath, SOURCE);
  git(["init", "-q", "-b", "main"]);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "demo"]);
  spawn([bin, "preset", "compile"]);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "lock"]);
  enable(repo);
}

function measure(kind: Edit["kind"], cold: boolean): Out[] {
  if (!cold) hook("prime", { kind }, true);
  const samples: Out[] = [];
  for (let i = 0; i < RUNS; i++) samples.push(hook(`${kind}-${cold ? "cold" : "warm"}-${i}`, { kind }, cold));
  return samples;
}

function hook(session: string, edit: Edit, dropCache: boolean): Out {
  if (dropCache) rmSync(cachePath(), { force: true });
  const payload = JSON.stringify({
    session_id: session, transcript_path: join(home, "t.jsonl"), cwd: repo, prompt_id: `${session}-p`,
    hook_event_name: "PreToolUse", permission_mode: "acceptEdits", tool_use_id: `${session}-tool`,
    tool_name: edit.kind === "syntax" ? "Write" : "Edit",
    tool_input: edit.kind === "syntax"
      ? { file_path: money, content: "export const invalid = ;\n" }
      : { file_path: money, old_string: "whole cents", new_string: "whole cent values", replace_all: false },
  });
  const started = performance.now();
  const result = Bun.spawnSync([bin, "hook", "pre", "--harness", "claude-code"], {
    cwd: repo, env, stdin: Buffer.from(payload), stdout: "pipe", stderr: "pipe",
  });
  return { code: result.exitCode ?? -1, stdout: result.stdout.toString(), stderr: result.stderr.toString(), ms: performance.now() - started };
}

function decision(sample: Out): { code: number; stdout: string; stderr: string } {
  return { code: sample.code, stdout: sample.stdout, stderr: sample.stderr };
}

function cachePath(): string {
  return join(xdgState, "pregate", "locks", `${sha256(slash(repo))}.json`);
}

function latencyReport(cold: Out[], warm: Out[]): string {
  const line = (name: string, samples: Out[]) => {
    const ms = samples.map((sample) => sample.ms);
    return `${name} n=${ms.length} p50=${percentile(ms, 50).toFixed(1)} p95=${percentile(ms, 95).toFixed(1)}`;
  };
  return [
    `lock-cache ${process.platform}-${process.arch} cpus=${cpus().length} bun=${Bun.version}`,
    line("cold", cold), line("warm", warm),
  ].join("\n");
}

function percentile(ms: number[], q: number): number {
  const sorted = [...ms].sort((a, b) => a - b);
  return sorted[Math.ceil((q / 100) * sorted.length) - 1]!;
}

function git(args: string[]): void {
  spawn(["git", ...args]);
}

function spawn(cmd: string[]): void {
  const result = Bun.spawnSync(cmd, { cwd: repo, env, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`${cmd.join(" ")} -> ${result.exitCode}\n${result.stdout}\n${result.stderr}`);
}
