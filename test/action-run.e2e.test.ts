import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "../src/compile.ts";
import { WINDOWS } from "../src/platform.ts";
import { VERSIONS } from "../src/versions.ts";
import { policyFixture, policyFixtureSource } from "./policy-fixtures.ts";

// The composite action's run step is scripts/action-run.sh. These cases execute that
// script against the real CLI for every mode, SARIF and base combination.

if (!WINDOWS) describeAction();

function describeAction(): void {
  setDefaultTimeout(300_000);
  const script = join(import.meta.dir, "../scripts/action-run.sh");
  const main = join(import.meta.dir, "../src/main.ts");
  const area = mkdtempSync(join(tmpdir(), "pregate-action-run-"));
  const repo = join(area, "repo");
  const bin = join(area, "bin");
  const home = join(area, "home");
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(bin);
  mkdirSync(home);
  const preset = policyFixture(JSON.stringify({
    name: "action-fixture",
    version: "1.0.0",
    engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }],
    methodologies: ["core/pregate-integrity", "core/software-invariants"],
    enforcement: "shadow",
    scope: { include: ["src/**"], exclude: [] },
  }));
  const compiled = compile(preset, policyFixtureSource, VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  mkdirSync(join(repo, ".pregate"));
  writeFileSync(join(repo, ".pregate/preset.json"), preset);
  writeFileSync(join(repo, ".pregate/pregate.lock.json"), compiled.text);
  writeFileSync(join(repo, "src/ready.ts"), "export const ready = 1;\n");
  const git = (...args: string[]) => {
    const child = Bun.spawnSync(["git", "-c", "user.name=Pregate CI", "-c", "user.email=pregate-ci@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: repo, stderr: "pipe" });
    if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  };
  git("init", "-q");
  git("add", ".");
  git("commit", "-qm", "fixture");
  const base = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: repo, stdout: "pipe" }).stdout.toString().trim();
  writeFileSync(join(bin, "pregate"), `#!/bin/bash\nprintf '%s\\n' "$*" >> "$PREGATE_ARGV_LOG"\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(main)} "$@"\n`);
  chmodSync(join(bin, "pregate"), 0o755);
  const action = readFileSync(join(import.meta.dir, "../action.yml"), "utf8");

  interface Row { mode: "check" | "audit" | "ratchet"; sarif: boolean; base: boolean; args?: string; argv: string | null }
  const matrix: Row[] = [];
  for (const mode of ["check", "audit", "ratchet"] as const) {
    for (const sarif of [false, true]) {
      for (const withBase of [false, true]) {
        const argv = mode === "ratchet"
          ? (withBase ? `check --ratchet --base ${base}${sarif ? " --format sarif" : ""}` : null)
          : mode === "audit"
            ? `audit${sarif ? " --sarif" : ""}`
            : `check --all${sarif ? " --format sarif" : ""}`;
        matrix.push({ mode, sarif, base: withBase, argv });
      }
    }
  }
  matrix.push({ mode: "check", sarif: false, base: false, args: "--staged", argv: "check --staged" });
  matrix.push({ mode: "audit", sarif: true, base: false, args: "--strict", argv: "audit --strict --sarif" });

  test("action.yml runs the mode script and does not default every mode to --all", () => {
    expect(action).toContain('bash "$GITHUB_ACTION_PATH/scripts/action-run.sh"');
    expect(action).toContain('default: ""');
    expect(action).not.toContain("pregate \"$PREGATE_MODE\"");
  });

  test("mode, sarif and base", async () => {
    const failures: string[] = [];
    for (const row of matrix) {
      const id = `${row.mode}/sarif=${row.sarif}/base=${row.base}/args=${row.args ?? ""}`;
      const log = join(area, `argv-${id.replaceAll("/", "_")}`);
      const sarif = join(area, `out-${id.replaceAll("/", "_")}.sarif`);
      const homeRun = join(area, `home-${id.replaceAll("/", "_")}`);
      mkdirSync(join(homeRun, "tmp"), { recursive: true });
      writeFileSync(log, "");
      const proc = Bun.spawn(["bash", script], {
        cwd: repo,
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          HOME: homeRun,
          XDG_DATA_HOME: join(homeRun, "data"),
          XDG_STATE_HOME: join(homeRun, "state"),
          XDG_CONFIG_HOME: join(homeRun, "config"),
          TMPDIR: join(homeRun, "tmp"),
          PREGATE_ARGV_LOG: log,
          PREGATE_MODE: row.mode,
          PREGATE_BASE: row.base ? base : "",
          PREGATE_ARGS: row.args ?? "",
          PREGATE_SARIF: row.sarif ? sarif : "",
          CI: "1",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      const argv = readFileSync(log, "utf8").trim();
      const text = `${stdout}${stderr}`;
      if (row.argv === null && row.mode === "ratchet") {
        if (code !== 1 || !text.includes("base") || argv !== "") failures.push(`${id}: expected fail-fast, got ${code} argv=${JSON.stringify(argv)} ${text}`);
        if (row.sarif && existsSync(sarif)) failures.push(`${id}: ratchet without base wrote SARIF`);
        continue;
      }
      if (row.args === "--strict") {
        if (argv !== row.argv || text.includes("usage:")) failures.push(`${id}: argv ${JSON.stringify(argv)} ${text}`);
        continue;
      }
      if (code !== 0 || argv !== row.argv || text.includes("usage:")) failures.push(`${id}: code ${code} argv ${JSON.stringify(argv)} expected ${JSON.stringify(row.argv)}\n${text}`);
      if (row.sarif) {
        const report = JSON.parse(readFileSync(sarif, "utf8")) as { version?: string };
        if (report.version !== "2.1.0") failures.push(`${id}: SARIF version ${report.version}`);
      }
    }
    expect(failures).toEqual([]);
  });

  afterAll(() => rmSync(area, { recursive: true, force: true }));
}
