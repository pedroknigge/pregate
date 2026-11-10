import { expect, setDefaultTimeout, test, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { removeTree } from "./remove-tree.ts";

// Default auto-detected contract budget.
//
// The contract is whatever `pregate init --yes` selects for a new repository plus
// `pregate scan --plan` and `pregate pack apply`. These trees are fetched at a
// pinned commit during the test. They are not vendored.
//
// The fetch needs the network and the run compiles a binary, so the suite is opt-in:
// it runs only with PREGATE_BUDGET_E2E=1 (CI sets it in its own step) and is skipped,
// with the reason printed, from a plain `bun test`.
//
// A finding counts once per reported site. KLOC is 1,000 non-blank lines in the
// files the audit's fileCoverage lists (in-scope, parser-supported source).
//
// Before this recalibration, sindresorhus/got at 6b5aafc (v16.2.0) produced
// 1,368 findings on 56,620 non-blank lines (24.16 per KLOC), 561 of them on
// production-candidate paths. The same tree after the change produces 147
// findings (2.60 per KLOC), 68 on production-candidate paths. colinhacks/zod at
// b500a2e (v4.6.7) produces 677 findings on 91,685 non-blank lines (7.38 per
// KLOC). The ceiling is 8 per KLOC, under a third of the old got density.
//
// Rule counts on got, before → after (total / production-candidate):
//   TS-READONLY-001  247/210 → 0     opt-in; options, config, and input types stay exempt when enabled
//   TS-BANG-001      345/76  → 0     opt-in
//   TS-ANY-001       276/31  → 0     opt-in
//   CC-ER-003        225/50  → 0     opt-in, and advisory (warn) when enabled
//   CC-NEST-001      136/136 → 10/10 default depth 4; loop and function guard clauses are not a level
//   CC-FN-001        49/24   → 49/24 advisory
//   EVA-CAST-001     42/11   → 42/11 advisory
//   CC-ER-002        16/8    → 16/8  still deny (swallowed catch)
//   JS-AWAIT-001     25/14   → 25/14 already advisory when javascript/safety is selected
//   JS-THROW-001     3/0     → 3/0   still deny when javascript/safety is selected
// got keeps those rules out of the default contract: its only JavaScript is documentation/examples.
//   TS-EXPORT-ANY-001 2/0   → 0     opt-in
//   CC-FN-002        1/1     → 1/1   advisory
//   TS-NS-001        1/0     → 1/0   advisory

const BUDGET_PER_KLOC = 8;
const PINS = [
  { name: "got", url: "https://github.com/sindresorhus/got.git", sha: "6b5aafc1cd538998728be6f45c65b0f80bae01b2" },
  { name: "zod", url: "https://github.com/colinhacks/zod.git", sha: "b500a2ee95134f81d74da7911d7378dd2853d042" },
] as const;
const OPT_IN = [
  "clean-code/CC-ER-003",
  "typescript/TS-ANY-001",
  "typescript/TS-BANG-001",
  "typescript/TS-ENUM-001",
  "typescript/TS-EXPORT-ANY-001",
  "typescript/TS-READONLY-001",
];

const ENABLED = process.env.PREGATE_BUDGET_E2E === "1";

setDefaultTimeout(180_000);

const root = mkdtempSync(join(tmpdir(), "pregate-budget-"));
const home = join(root, "home");
const data = join(root, "data");
const binary = join(root, ENGINE_FILE);
const isolatedPath = pathWithoutHarnesses();
const env = {
  ...process.env,
  CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
  HOME: home,
  PATH: isolatedPath,
  ...(process.platform === "win32" ? { Path: isolatedPath } : {}),
  TMPDIR: join(root, "tmp"),
  XDG_DATA_HOME: data,
  XDG_STATE_HOME: join(root, "state"),
  XDG_CONFIG_HOME: join(root, "config"),
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_NAME: "pregate-budget",
  GIT_AUTHOR_EMAIL: "budget@example.com",
  GIT_COMMITTER_NAME: "pregate-budget",
  GIT_COMMITTER_EMAIL: "budget@example.com",
};

beforeAll(() => {
  if (!ENABLED) return;
  mkdirSync(join(home, ".claude"), { recursive: true });
  mkdirSync(env.TMPDIR, { recursive: true });
  engineAt(binary);
  const setup = run(binary, ["setup"], home);
  if (setup.code !== 0) throw new Error(`setup exited ${setup.code}\n${setup.stdout}\n${setup.stderr}`);
});

afterAll(() => removeTree(root));

// Skipped unless PREGATE_BUDGET_E2E=1: the fetch needs the network.
test.skipIf(!ENABLED)("fetched got and zod stay under the default-contract findings budget (PREGATE_BUDGET_E2E=1)", () => {
  for (const pin of PINS) {
    const dir = join(root, pin.name);
    fetchPin(dir, pin.url, pin.sha);
    expect(run(binary, ["init", "--yes"], dir).code, pin.name).toBe(0);
    const plan = run(binary, ["scan", "--plan"], dir);
    expect(plan.code, plan.stderr).toBe(0);
    const planPath = join(root, `${pin.name}-plan.json`);
    writeFileSync(planPath, plan.stdout);
    const applied = run(binary, ["pack", "apply", planPath, "--yes"], dir);
    expect(applied.code, `${pin.name}\n${applied.stdout}\n${applied.stderr}`).toBe(0);
    const audit = run(binary, ["audit", "--json"], dir);
    expect(audit.code, `${pin.name} audit\n${audit.stderr.slice(0, 2000)}`).toBe(0);
    const report = JSON.parse(audit.stdout) as {
      findings: { rule: string }[];
      errors: unknown[];
      fileCoverage: { path: string }[];
      auditedRules: { rule: string }[];
      changedDuringAudit: boolean;
    };
    expect(report.errors, pin.name).toEqual([]);
    expect(report.changedDuringAudit, pin.name).toBe(false);
    const rules = new Set(report.auditedRules.map((rule) => rule.rule));
    for (const id of OPT_IN) expect(rules.has(id), `${pin.name} ${id}`).toBe(false);
    expect(rules.has("clean-code/CC-NEST-001"), pin.name).toBe(true);
    expect(rules.has("clean-code/CC-ER-002"), pin.name).toBe(true);
    const preset = JSON.parse(readFileSync(join(dir, ".pregate/preset.json"), "utf8")) as { methodologies: string[] };
    for (const id of ["clean-code/clean-code", "testing/tdd", "core/pregate-integrity", "typescript/strict-types", "typescript/anti-evasion"]) {
      expect(preset.methodologies, `${pin.name} ${id}`).toContain(id);
    }
    // got's only JavaScript is documentation/examples, so it must not select javascript/safety.
    // zod has primary JavaScript outside that tree and still must.
    expect(preset.methodologies.includes("javascript/safety"), pin.name).toBe(pin.name !== "got");
    let lines = 0;
    for (const file of report.fileCoverage) {
      for (const line of readFileSync(join(dir, file.path), "utf8").split("\n")) if (line.trim()) lines++;
    }
    const perKloc = report.findings.length / (lines / 1000);
    expect(perKloc, `${pin.name}: ${report.findings.length} findings / ${lines} non-blank lines`).toBeLessThan(BUDGET_PER_KLOC);
  }
});

function fetchPin(dir: string, url: string, sha: string): void {
  mkdirSync(dir, { recursive: true });
  const git = (...args: string[]) => {
    const result = run("git", args, dir);
    if (result.code !== 0) throw new Error(`git ${args.join(" ")} exited ${result.code}\n${result.stderr}`);
  };
  git("init");
  git("remote", "add", "origin", url);
  git("fetch", "--depth", "1", "origin", sha);
  git("checkout", "--detach", "FETCH_HEAD");
  const head = run("git", ["rev-parse", "HEAD"], dir);
  expect(head.stdout.trim()).toBe(sha);
}

function run(command: string, args: string[], cwd: string): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync([command, ...args], { cwd, env, stdout: "pipe", stderr: "pipe" });
  return { code: result.exitCode ?? -1, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}
