// Hook latency per route (ARCHITECTURE §4.1 budget, §8): the compiled engine behind the global
// launcher, on a git copy of test/demo-repo, run the way the harness runs the hook. Every sample
// starts a fresh session, so each one measures the same state. Internal: it is not shipped.
// Usage: bun run bench [--runs N] [--repeat K] [--inform] [--gate <baseline>] [--only <route>]
// (N ≥ 25, default 30; K ≥ 1, default 1). The 150 ms budget holds on the reference machine (O31);
// --inform reports that miss without failing. --gate fails when the median p95 of K repeats
// regresses more than 55% against the committed per-OS baseline. With GITHUB_STEP_SUMMARY set,
// the table goes there too.
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { ensureCompiledEngine } from "./compiled-engine.ts";
import { confirmOnTerminal } from "./confirm-terminal.ts";
import { decideGate, formatGate, median, parseBaseline, parseBenchArgs, type BenchOptions } from "./latency-gate.ts";

const ROOT = join(import.meta.dir, "..");
const BUDGET_MS = 150;      // p95 of any Pre (§4.1)
const SHELL_P50_MS = 25;    // p50 of the shell guard and no-preset path (§7.2 #5, MH-WI)
// Domain files that pass every rule, and one whose committed text already carries debt: then the
// "before" runs again every rule the "after" violates.
const LEDGERS = { 200: "src/domain/ledger-200.ts", 300: "src/domain/ledger-300.ts", 2000: "src/domain/ledger-2000.ts", debt: "src/domain/ledger-debt-2000.ts" };

type Env = Record<string, string>;
interface Repo { dir: string; env: Env; pre: string; start: string }
interface Route { name: string; prepare: Payload[]; timed: Payload }
type Payload = Record<string, unknown>;

interface Stats { name: string; runs: number; p50: number; p95: number; max: number }

function main(): number {
  return benchIn(realpathSync(mkdtempSync(join(tmpdir(), "pregate-bench-"))), parseBenchArgs(process.argv.slice(2)));
}

function benchIn(work: string, options: BenchOptions): number {
  try {
    const repo = setUp(work);
    const selected = selectRoutes(routes(repo.dir), options.only);
    const stats = combine(repeatMeasure(repo, selected, options.runs, options.repeat));
    const over = overBudget(stats);
    const verdict = budgetText(over);
    console.log(`${table(stats)}\n\n${verdict}`);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, markdown(stats, verdict));
    const gate = options.gate === null ? 0 : applyGate(stats, options.gate);
    return (over.length > 0 && !options.inform) || gate !== 0 ? 1 : 0;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function selectRoutes(all: Route[], only: string[]): Route[] {
  const missing = only.filter((name) => !all.some((route) => route.name === name));
  if (missing.length) throw new Error(`unknown route: ${missing.join(", ")}`);
  return only.length === 0 ? all : all.filter((route) => only.includes(route.name));
}

function repeatMeasure(repo: Repo, all: Route[], runs: number, times: number): Map<string, number[]>[] {
  const series: Map<string, number[]>[] = [];
  for (let i = 0; i < times; i++) series.push(measure(repo, all, runs));
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
function setUp(work: string): Repo {
  const dir = join(work, "repo");
  const env: Env = {
    PATH: process.env.PATH ?? "/usr/bin:/bin", TMPDIR: work, HOME: join(work, "home"),
    XDG_DATA_HOME: join(work, "data"), XDG_STATE_HOME: join(work, "state"), CLAUDE_PROJECT_DIR: dir,
    CODEX_HOME: join(work, "home/.codex"), GROK_HOME: join(work, "home/.grok"),
    GIT_AUTHOR_NAME: "bench", GIT_AUTHOR_EMAIL: "bench@localhost", GIT_COMMITTER_NAME: "bench", GIT_COMMITTER_EMAIL: "bench@localhost",
  };
  // One release build per bench run; CI may precompile and set PREGATE_COMPILED_ENGINE.
  const engine = join(work, process.platform === "win32" ? "pregate.exe" : "pregate");
  const shared = process.env.PREGATE_COMPILED_ENGINE;
  if (shared !== undefined && existsSync(shared)) cpSync(shared, engine);
  else ensureCompiledEngine({ outfile: engine, testApproval: false });
  seed(dir);
  mkdirSync(join(work, "no-preset"));
  mkdirSync(join(env.HOME!, ".claude"), { recursive: true });
  env.PATH = process.platform === "win32" ? (process.env.PATH ?? "") : `${env.HOME}/.local/bin:/usr/bin:/bin`;
  for (const argv of [[engine, "setup"], ["git", "init", "-q", "-b", "main"], [engine, "preset", "compile"], [engine, "install"], ["git", "add", "-A"], ["git", "commit", "-q", "-m", "bench"]]) {
    run(dir, env, argv);
  }
  enableProject(engine, dir, env);
  const repo = { dir, env, ...hookCommands(env.HOME!) };
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
  const payload = envelope(repo.dir, "bench-canary", tool("Write", { file_path: join(repo.dir, "src/domain/canary.ts"), content: "export const invalid = ;\n" }));
  const r = Bun.spawnSync(hookArgv(repo.pre), { cwd: repo.dir, env: repo.env, stdin: Buffer.from(JSON.stringify(payload)), stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 2 || !r.stderr.toString().includes("syntax")) throw new Error("Benchmark gate is inactive or broken: invalid syntax was not denied.");
}

// test/demo-repo under backend-clean-ddd, plus the generated ledgers.
function seed(dir: string): void {
  cpSync(join(ROOT, "test/demo-repo"), dir, { recursive: true });
  mkdirSync(join(dir, ".pregate"));
  cpSync(join(ROOT, "catalog/presets/backend-clean-ddd.json"), join(dir, ".pregate/preset.json"));
  writeFileSync(join(dir, LEDGERS[200]), ledger(200));
  writeFileSync(join(dir, LEDGERS[300]), ledger(300));
  writeFileSync(join(dir, LEDGERS[2000]), ledger(2000));
  writeFileSync(join(dir, LEDGERS.debt), ledger(2000, true));
}

// The commands `setup` wrote to HOME/.claude/settings.json, inline guard included.
function hookCommands(dir: string): { pre: string; start: string } {
  const hooks = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8")).hooks;
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

// Rounds go through every route in turn, so drift on the machine weighs on all of them alike. The
// first round warms the page cache and is dropped.
function measure(repo: Repo, all: Route[], runs: number): Map<string, number[]> {
  const samples = new Map(all.map((r) => [r.name, [] as number[]]));
  for (let round = 0; round <= runs; round++) {
    for (const r of all) {
      const session = `bench-${round}-${samples.get(r.name)!.length}-${r.name.replace(/\W+/g, "-")}`;
      for (const p of r.prepare) hook(repo, envelope(repo.dir, session, p));
      const ms = hook(repo, envelope(repo.dir, session, r.timed));
      if (round > 0) samples.get(r.name)!.push(ms);
    }
  }
  return samples;
}

// What Claude Code sends around every event (test/payloads).
function envelope(dir: string, session: string, p: Payload): Payload {
  const id = `${session}-${String(p.tool_name ?? "start")}`;
  return { session_id: session, transcript_path: join(dir, "t.jsonl"), cwd: dir, prompt_id: `${session}-prompt`, ...p, tool_use_id: id };
}

// Each sample has to take the route it names: exit 0, and no objection (Pre prints nothing) or no
// notice to the human (SessionStart prints the contract, and a systemMessage only when it degrades).
function hookArgv(command: string): string[] {
  return process.platform === "win32" ? ["cmd.exe", "/d", "/c", command] : ["sh", "-c", command];
}

function hook(repo: Repo, payload: Payload): number {
  const command = payload.hook_event_name === "SessionStart" ? repo.start : repo.pre;
  const stdin = Buffer.from(`${JSON.stringify(payload)}\n`);
  const t0 = performance.now();
  const r = Bun.spawnSync(hookArgv(command), { cwd: repo.dir, env: repo.env, stdin, stdout: "pipe", stderr: "pipe" });
  const ms = performance.now() - t0;
  const quiet = payload.hook_event_name === "SessionStart" ? r.stdout.toString().includes('"additionalContext"') && !r.stdout.toString().includes('"systemMessage"') : r.stdout.length === 0;
  if (r.exitCode !== 0 || !quiet) throw new Error(`hook objected (exit ${r.exitCode}): ${r.stdout}${r.stderr}`);
  return ms;
}

// ── Output ─────────────────────────────────────────────────────────────────────────

// Nearest rank: the smallest sample with at least q % of them at or below it.
function percentile(ms: number[], q: number): number {
  const sorted = [...ms].sort((a, b) => a - b);
  return sorted[Math.ceil((q / 100) * sorted.length) - 1]!;
}

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
