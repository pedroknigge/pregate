// Hook latency per route (ARCHITECTURE §4.1 budget, §8): the compiled engine behind the global
// launcher, on a git copy of test/demo-repo, run the way the harness runs the hook. Every sample
// starts a fresh session, so each one measures the same state. Internal: it is not shipped.
// Usage: bun run bench [--runs N] [--repeat K] [--inform] [--gate <baseline>] [--only <route>]
//        [--against <checkout> [--against-label <name>]]
// (N ≥ 25, default 30; K ≥ 1, default 1). The 150 ms budget holds on the reference machine (O31);
// --inform reports that miss without failing. --gate fails when the median p95 of K repeats
// regresses more than 55% against the committed per-OS baseline. --against builds the engine of
// another source checkout (the last release) with this toolchain, times both engines in turn on
// every sample, and reports the ratio; it informs and fails nothing. With GITHUB_STEP_SUMMARY set,
// the tables go there too.
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { merge } from "../src/register.ts";
import { ensureCompiledEngine } from "./compiled-engine.ts";
import { confirmOnTerminal } from "./confirm-terminal.ts";
import { decideGate, differential, formatDifferential, formatGate, median, nearestRank, parseBaseline, parseBenchArgs, type BenchOptions, type Differential } from "./latency-gate.ts";

const ROOT = join(import.meta.dir, "..");
const BUDGET_MS = 150;      // p95 of any Pre (§4.1)
const SHELL_P50_MS = 25;    // p50 of the shell guard and no-preset path (§7.2 #5, MH-WI)
// Domain files that pass every rule, and one whose committed text already carries debt: then the
// "before" runs again every rule the "after" violates.
const LEDGERS = { 200: "src/domain/ledger-200.ts", 300: "src/domain/ledger-300.ts", 2000: "src/domain/ledger-2000.ts", debt: "src/domain/ledger-debt-2000.ts" };

type Env = Record<string, string>;
interface Repo { dir: string; env: Env; pre: string; start: string; harness: BenchOptions["harness"] }
interface Route { name: string; prepare: Payload[]; timed: Payload; denied?: boolean; coldLock?: boolean }
// One engine under test: its own repository, homes and registered hook commands.
interface Arm { repo: Repo; routes: Route[] }
type Payload = Record<string, unknown>;

interface Stats { name: string; runs: number; p50: number; p95: number; max: number }

function main(): number {
  return benchIn(realpathSync(mkdtempSync(join(tmpdir(), "pregate-bench-"))), parseBenchArgs(process.argv.slice(2)));
}

function benchIn(work: string, options: BenchOptions): number {
  try {
    const arms = [arm(join(work, "candidate"), ROOT, process.env.PREGATE_COMPILED_ENGINE, options)];
    if (options.against !== null) arms.push(arm(join(work, "reference"), realpathSync(options.against), referenceEngine(work, options.against), options));
    const series = repeatMeasure(arms, options.runs, options.repeat);
    const stats = combine(series.map((arms) => arms[0]!));
    const over = overBudget(stats);
    const verdict = budgetText(over);
    console.log(`Harness: ${options.harness}\n${table(stats)}\n\n${verdict}`);
    console.log(JSON.stringify({ harness: options.harness, platform: process.platform, arch: process.arch, routes: stats }));
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, markdown(stats, verdict));
    if (options.against !== null) reportDifferential(series, options.againstLabel ?? options.against);
    const gate = options.gate === null ? 0 : applyGate(stats, options.gate);
    return (over.length > 0 && !options.inform) || gate !== 0 ? 1 : 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function arm(work: string, root: string, engine: string | undefined, options: BenchOptions): Arm {
  mkdirSync(work, { recursive: true });
  const repo = setUp(work, root, engine, options.harness);
  return { repo, routes: selectRoutes(options.harness === "codex" ? codexRoutes(repo.dir) : routes(repo.dir), options.only) };
}

// The reference engine is built from its own source with the Bun that runs this script, by the
// build script of that checkout: the same toolchain and the same build flags as the candidate.
function referenceEngine(work: string, checkout: string): string {
  const out = join(work, process.platform === "win32" ? "reference-engine.exe" : "reference-engine");
  const env = { ...process.env };
  delete env.PREGATE_COMPILED_ENGINE;
  delete env.GITHUB_ENV;
  const r = Bun.spawnSync([process.execPath, "scripts/compiled-engine.ts", "--out", out, "--force"], { cwd: checkout, env, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0 || !existsSync(out)) throw new Error(`reference engine build failed in ${checkout} (exit ${r.exitCode}): ${r.stdout}${r.stderr}`);
  return out;
}

function reportDifferential(series: Map<string, number[]>[][], label: string): void {
  const names = [...(series[0]?.[0]?.keys() ?? [])];
  const pooled = (name: string, index: number) => series.flatMap((arms) => arms[index]!.get(name) ?? []);
  const rows: Differential[] = names.map((name) => differential(name, pooled(name, 0), pooled(name, 1)));
  console.log(`\n${formatDifferential(label, rows)}`);
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, against: label, differential: rows }));
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) appendFileSync(summary, ["", "```", formatDifferential(label, rows), "```", ""].join("\n"));
}

function selectRoutes(all: Route[], only: string[]): Route[] {
  const missing = only.filter((name) => !all.some((route) => route.name === name));
  if (missing.length) throw new Error(`unknown route: ${missing.join(", ")}`);
  return only.length === 0 ? all : all.filter((route) => only.includes(route.name));
}

function repeatMeasure(arms: Arm[], runs: number, times: number): Map<string, number[]>[][] {
  const series: Map<string, number[]>[][] = [];
  for (let i = 0; i < times; i++) series.push(measure(arms, runs));
  return series;
}

function combine(series: Map<string, number[]>[]): Stats[] {
  const names = [...(series[0]?.keys() ?? [])];
  return names.map((name) => statsFor(name, series.map((samples) => samples.get(name) ?? [])));
}

function statsFor(name: string, groups: number[][]): Stats {
  return {
    name, runs: groups.reduce((sum, ms) => sum + ms.length, 0),
    p50: median(groups.map((ms) => percentile(ms, 50))), p95: median(groups.map((ms) => percentile(ms, 95))),
    max: Math.max(...groups.map((ms) => Math.max(...ms))),
  };
}

function overBudget(stats: Stats[]): string[] {
  return stats.filter((row) => row.p95 > BUDGET_MS || ((row.name === "shell" || row.name === "no preset") && row.p50 > SHELL_P50_MS)).map((row) => row.name);
}

function budgetText(over: string[]): string {
  return over.length === 0
    ? `p95 ≤ ${BUDGET_MS} ms on every route, shell and no-preset p50 ≤ ${SHELL_P50_MS} ms.`
    : `Over budget (p95 ${BUDGET_MS} ms, shell/no-preset p50 ${SHELL_P50_MS} ms): ${over.join(", ")}`;
}

function applyGate(stats: Stats[], path: string): number {
  const measured: Record<string, number> = {};
  const p50: Record<string, number> = {};
  for (const row of stats) { measured[row.name] = row.p95; p50[row.name] = row.p50; }
  console.log(JSON.stringify({ platform: process.platform, arch: process.arch, medianP50: p50, medianP95: measured }));
  const decision = decideGate(process.platform, process.arch, measured, parseBaseline(JSON.parse(readFileSync(path, "utf8"))));
  console.log(formatGate(decision));
  return decision.ok ? 0 : 1;
}

// ── The repo under test ────────────────────────────────────────────────────────────

// HOME and the XDG folders point into `work`: the engine, its state and git's config stay there.
function setUp(work: string, root: string, shared: string | undefined, harness: BenchOptions["harness"]): Repo {
  const dir = join(work, "repo");
  const env: Env = {
    PATH: process.env.PATH ?? "/usr/bin:/bin", TMPDIR: work, HOME: join(work, "home"),
    XDG_DATA_HOME: join(work, "data"), XDG_STATE_HOME: join(work, "state"), CLAUDE_PROJECT_DIR: dir,
    CODEX_HOME: join(work, "home/.codex"), GROK_HOME: join(work, "home/.grok"),
    GIT_AUTHOR_NAME: "bench", GIT_AUTHOR_EMAIL: "bench@localhost", GIT_COMMITTER_NAME: "bench", GIT_COMMITTER_EMAIL: "bench@localhost",
  };
  // One release build per bench run; CI may precompile and set PREGATE_COMPILED_ENGINE.
  const engine = join(work, process.platform === "win32" ? "pregate.exe" : "pregate");
  if (shared !== undefined && existsSync(shared)) cpSync(shared, engine);
  else ensureCompiledEngine({ outfile: engine, testApproval: false });
  seed(dir, root);
  mkdirSync(join(work, "no-preset"));
  mkdirSync(join(env.HOME!, ".claude"), { recursive: true });
  env.PATH = process.platform === "win32" ? (process.env.PATH ?? "") : `${env.HOME}/.local/bin:/usr/bin:/bin`;
  for (const argv of [[engine, "setup"], ["git", "init", "-q", "-b", "main"], [engine, "preset", "compile"], [engine, "install"], ["git", "add", "-A"], ["git", "commit", "-q", "-m", "bench"]]) {
    run(dir, env, argv);
  }
  enableProject(engine, dir, env);
  if (harness === "codex") {
    mkdirSync(env.CODEX_HOME!, { recursive: true });
    writeFileSync(join(env.CODEX_HOME!, "hooks.json"), merge(null, "codex", join(env.XDG_DATA_HOME!, "pregate"))!);
  }
  const repo = { dir, env, harness, ...hookCommands(env.HOME!, harness) };
  activeCanary(repo);
  return repo;
}

// POSIX types y on a pseudo-terminal. Windows runners have no /dev/tty, so enable uses the
// product's unattended opt-in for that one setup process. The timed hook does not inherit it.
function enableProject(engine: string, dir: string, env: Env): void {
  if (process.platform !== "win32") {
    const enabled = confirmOnTerminal([engine, "enable"], dir, env);
    if (enabled.code !== 0) throw new Error(`pregate enable failed (exit ${enabled.code}): ${enabled.stdout}${enabled.stderr}`);
    return;
  }
  const result = Bun.spawnSync([engine, "enable", "--yes"], {
    cwd: dir, env: { ...env, PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(`pregate enable failed (exit ${result.exitCode}): ${result.stdout}${result.stderr}`);
}

function activeCanary(repo: Repo): void {
  const invalid = repo.harness === "codex" ? codexPatch(repo.dir, ["src/domain/canary.ts"], true) : tool("Write", { file_path: join(repo.dir, "src/domain/canary.ts"), content: "export const invalid = ;\n" });
  const payload = envelope(repo.dir, "bench-canary", invalid, repo.harness);
  const r = Bun.spawnSync(hookArgv(repo.pre), { cwd: repo.dir, env: repo.env, stdin: Buffer.from(JSON.stringify(payload)), stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 2 || !r.stderr.toString().includes("syntax")) throw new Error("Benchmark gate is inactive or broken: invalid syntax was not denied.");
}

// test/demo-repo under backend-clean-ddd, plus the generated ledgers.
function seed(dir: string, root: string): void {
  cpSync(join(root, "test/demo-repo"), dir, { recursive: true });
  mkdirSync(join(dir, ".pregate"));
  cpSync(join(root, "catalog/presets/backend-clean-ddd.json"), join(dir, ".pregate/preset.json"));
  writeFileSync(join(dir, LEDGERS[200]), ledger(200));
  writeFileSync(join(dir, LEDGERS[300]), ledger(300));
  writeFileSync(join(dir, LEDGERS[2000]), ledger(2000));
  writeFileSync(join(dir, LEDGERS.debt), ledger(2000, true));
}

// The commands `setup` wrote to HOME/.claude/settings.json, inline guard included.
function hookCommands(dir: string, harness: BenchOptions["harness"]): { pre: string; start: string } {
  const file = harness === "codex" ? ".codex/hooks.json" : ".claude/settings.json";
  const hooks = JSON.parse(readFileSync(join(dir, file), "utf8")).hooks;
  const first = (event: string): string => hooks[event][0].hooks[0].command;
  return { pre: first("PreToolUse"), start: first("SessionStart") };
}

// Domain code over Money: functions and small entities. With debt, settle1 casts and runs past the
// preset's 40 lines (EVA-CAST-001, CC-FN-001); the rest passes every rule.
function ledger(lines: number, debt = false): string {
  const out = ['import { Money } from "./values/money";', ""];
  for (let k = 0; out.length + 14 <= lines; k++) out.push(...(k % 4 === 3 ? account(k) : settle(k, debt && k === 1)));
  while (out.length < lines) out.push("// end of ledger");
  return `${out.join("\n")}\n`;
}

function settle(k: number, debt: boolean): string[] {
  const message = debt ? `"ledger ${k}: currency differs" as unknown as string` : `"ledger ${k}: currency differs"`;
  return [
    `export function settle${k}(amounts: readonly Money[], currency: string): Money {`,
    "  let sum = Money.zero(currency);",
    "  for (const amount of amounts) {",
    `    if (amount.currency !== currency) throw new Error(${message});`,
    "    sum = sum.add(amount);",
    "  }",
    ...(debt ? Array.from({ length: 36 }, () => "  sum = sum.add(Money.zero(currency));") : []),
    "  return sum;",
    "}",
    "",
  ];
}

function account(k: number): string[] {
  return [
    `export class Account${k} {`,
    "  private readonly entries: Money[] = [];",
    "",
    "  constructor(readonly currency: string) {}",
    "",
    "  balance(): Money {",
    `    return settle${k - 1}(this.entries, this.currency);`,
    "  }",
    "}",
    "",
  ];
}

// ── Routes ─────────────────────────────────────────────────────────────────────────

function routes(dir: string): Route[] {
  const start = { hook_event_name: "SessionStart", source: "startup" };
  const write = tool("Write", { file_path: join(dir, "scripts/seed.ts"), content: "export const seed = 1;\n" });
  const shell = tool("Bash", { command: "git status --short && ls src" });
  const edit = (rel: string) => tool("Edit", {
    file_path: join(dir, rel), old_string: '"ledger 9: currency differs"', new_string: '"ledger 9: currency does not match"', replace_all: false,
  });
  return [
    { name: "no preset", prepare: [], timed: { ...shell, cwd: join(dir, "../no-preset") } },
    { name: "out of scope", prepare: [start], timed: write },
    { name: "shell", prepare: [start], timed: shell },
    { name: "200 lines, first touch", prepare: [start], timed: edit(LEDGERS[200]) },
    { name: "200 lines, second touch", prepare: [start, edit(LEDGERS[200])], timed: edit(LEDGERS[200]) },
    { name: "300 lines, first touch", prepare: [start], timed: edit(LEDGERS[300]) },
    { name: "300 lines, second touch", prepare: [start, edit(LEDGERS[300])], timed: edit(LEDGERS[300]) },
    { name: "2,000 lines, first touch", prepare: [start], timed: edit(LEDGERS[2000]) },
    { name: "2,000 lines, second touch", prepare: [start, edit(LEDGERS[2000])], timed: edit(LEDGERS[2000]) },
    { name: "2,000 lines with debt, first touch", prepare: [start], timed: edit(LEDGERS.debt) },
  ];
}

function tool(name: string, input: Payload): Payload {
  return { hook_event_name: "PreToolUse", permission_mode: "acceptEdits", tool_name: name, tool_input: input };
}

// Native Codex patches, including one script whose two calls reuse the same exec id.
function codexRoutes(dir: string): Route[] {
  const start = { hook_event_name: "SessionStart", source: "startup" };
  const edit = (rel: string) => tool("apply_patch", { command: `*** Begin Patch\n*** Update File: ${join(dir, rel)}\n@@\n-    if (amount.currency !== currency) throw new Error("ledger 9: currency differs");\n+    if (amount.currency !== currency) throw new Error("ledger 9: currency does not match");\n*** End Patch\n` });
  const first = codexPatch(dir, ["src/domain/first.ts"]);
  const second = codexPatch(dir, ["src/domain/second.ts"]);
  return [
    { name: "shell", prepare: [start], timed: tool("Bash", { command: "git status --short && ls src" }) },
    { name: "200 lines, cold lock", prepare: [start], timed: edit(LEDGERS[200]), coldLock: true },
    { name: "200 lines, first touch", prepare: [start], timed: edit(LEDGERS[200]) },
    { name: "200 lines, second touch", prepare: [start, edit(LEDGERS[200])], timed: edit(LEDGERS[200]) },
    { name: "2,000 lines, first touch", prepare: [start], timed: edit(LEDGERS[2000]) },
    { name: "2,000 lines, second touch", prepare: [start, edit(LEDGERS[2000])], timed: edit(LEDGERS[2000]) },
    { name: "two-file patch", prepare: [start], timed: codexPatch(dir, ["src/domain/first.ts", "src/domain/second.ts"]) },
    { name: "code mode, second call", prepare: [start, { ...first, tool_use_id: "exec-bench" }], timed: { ...second, tool_use_id: "exec-bench" } },
    { name: "syntax denial", prepare: [start], timed: codexPatch(dir, ["src/domain/invalid.ts"], true), denied: true },
  ];
}

function codexPatch(dir: string, files: string[], invalid = false): Payload {
  const body = files.map((file) => `*** Add File: ${join(dir, file)}\n+export const value = ${invalid ? ";" : "1;"}\n`).join("");
  return tool("apply_patch", { command: `*** Begin Patch\n${body}*** End Patch\n` });
}

// Rounds go through every route in turn, so drift on the machine weighs on all of them alike. The
// first round warms the page cache and is dropped. With two engines, each sample times both, and
// the order alternates by round, so neither always runs second.
function measure(arms: Arm[], runs: number): Map<string, number[]>[] {
  const samples = arms.map((a) => new Map(a.routes.map((r) => [r.name, [] as number[]])));
  const order = arms.map((_, i) => i);
  for (let round = 0; round <= runs; round++) {
    for (let k = 0; k < arms[0]!.routes.length; k++) {
      for (const i of round % 2 === 0 ? order : [...order].reverse()) {
        const ms = sample(arms[i]!.repo, arms[i]!.routes[k]!, round, samples[i]!.get(arms[i]!.routes[k]!.name)!.length);
        if (round > 0) samples[i]!.get(arms[i]!.routes[k]!.name)!.push(ms);
      }
    }
  }
  return samples;
}

function sample(repo: Repo, r: Route, round: number, taken: number): number {
  const session = `bench-${round}-${taken}-${r.name.replace(/\W+/g, "-")}`;
  for (const p of r.prepare) hook(repo, envelope(repo.dir, session, p, repo.harness));
  if (r.coldLock) rmSync(join(repo.env.XDG_STATE_HOME!, "pregate/locks"), { recursive: true, force: true });
  return hook(repo, envelope(repo.dir, session, r.timed, repo.harness), r.denied);
}

// What Claude Code sends around every event (test/payloads).
function envelope(dir: string, session: string, p: Payload, harness: BenchOptions["harness"]): Payload {
  const id = `${session}-${String(p.tool_name ?? "start")}`;
  const turn = harness === "codex" ? { turn_id: `${session}-turn` } : { prompt_id: `${session}-prompt` };
  return { session_id: session, transcript_path: join(dir, "t.jsonl"), cwd: dir, ...turn, tool_use_id: id, ...p };
}

// Each sample has to take the route it names: exit 0, and no objection (Pre prints nothing) or no
// notice to the human (SessionStart prints the contract, and a systemMessage only when it degrades).
function hookArgv(command: string): string[] {
  return process.platform === "win32" ? ["cmd.exe", "/d", "/c", command] : ["sh", "-c", command];
}

function hook(repo: Repo, payload: Payload, denied = false): number {
  const command = payload.hook_event_name === "SessionStart" ? repo.start : repo.pre;
  const stdin = Buffer.from(`${JSON.stringify(payload)}\n`);
  const t0 = performance.now();
  const r = Bun.spawnSync(hookArgv(command), { cwd: repo.dir, env: repo.env, stdin, stdout: "pipe", stderr: "pipe" });
  const ms = performance.now() - t0;
  const quiet = payload.hook_event_name === "SessionStart" ? r.stdout.toString().includes('"additionalContext"') && !r.stdout.toString().includes('"systemMessage"') : r.stdout.length === 0;
  if (denied) {
    if (r.exitCode !== 2 || !r.stderr.toString().includes("PREGATE DENY syntax") || r.stdout.length !== 0) throw new Error(`syntax denial route was not denied: ${r.stdout}${r.stderr}`);
  } else if (r.exitCode !== 0 || !quiet) throw new Error(`hook objected (exit ${r.exitCode}): ${r.stdout}${r.stderr}`);
  return ms;
}

// ── Output ─────────────────────────────────────────────────────────────────────────

// Nearest rank: the smallest sample with at least q % of them at or below it.
const percentile = nearestRank;

function table(stats: Stats[]): string {
  const width = Math.max(...stats.map((row) => row.name.length));
  const cell = (n: number) => n.toFixed(1).padStart(7);
  const rows = stats.map((row) => `${row.name.padEnd(width)}  ${String(row.runs).padStart(4)}  ${cell(row.p50)}  ${cell(row.p95)}  ${cell(row.max)}`);
  return [`${"route".padEnd(width)}  runs   p50 ms   p95 ms   max ms`, ...rows].join("\n");
}

// The same table for the CI job summary, with the machine it ran on: the budget is the reference
// machine's (O31), and a runner with few cores lands well above it.
function markdown(stats: Stats[], verdict: string): string {
  const cell = (n: number) => n.toFixed(1);
  const rows = stats.map((row) => `| ${row.name} | ${row.runs} | ${cell(row.p50)} | ${cell(row.p95)} | ${cell(row.max)} |`);
  return [
    "### Hook latency (`bun run bench`)", "",
    `${process.platform}-${process.arch}, ${cpus().length} CPUs (${cpus()[0]?.model ?? "unknown"}), Bun ${Bun.version}.`, "",
    "| route | runs | p50 ms | p95 ms | max ms |", "|---|---|---|---|---|", ...rows, "",
    `${verdict} The budget applies to the reference development machine (ARCHITECTURE O31); here it informs.`, "",
  ].join("\n");
}

function run(cwd: string, env: Env, argv: string[]): void {
  const r = Bun.spawnSync(argv, { cwd, env, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`${argv.join(" ")} failed (exit ${r.exitCode}): ${r.stdout}${r.stderr}`);
}

process.exitCode = main();
