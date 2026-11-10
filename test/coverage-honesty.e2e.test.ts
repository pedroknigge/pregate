import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonical } from "../src/disk.ts";
import { enforcementOf } from "../src/enforcement.ts";
import { LOCK, PRESET } from "../src/inertia.ts";
import { VERSIONS } from "../src/versions.ts";
import type { Lock, LockRule } from "../src/types.ts";

// The CLI, on a scratch repository, is what status and doctor print for a project.
const cli = join(import.meta.dir, "../src/main.ts");
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-coverage-")));
setDefaultTimeout(60_000);
afterAll(() => rmSync(area, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

function counted(lock: Lock) {
  const owned = new Set(lock.ownedByArkgate);
  const fitness = (rule: LockRule) => rule.impl.kind === "primitive" && rule.impl.primitive === "fitness";
  const evaluated = lock.rules.filter((rule) => !fitness(rule) && !owned.has(rule.id));
  const policy = (rule: LockRule) => enforcementOf(lock, rule);
  const deny = evaluated.filter((rule) => policy(rule) === "enforce" && rule.severity === "deny").length;
  const advisor = evaluated.filter((rule) => policy(rule) === "advisor").length;
  const shadow = evaluated.filter((rule) => policy(rule) === "shadow").length;
  const warnOnly = evaluated.filter((rule) => policy(rule) === "enforce" && rule.severity === "warn").length;
  const unverified = lock.rules.filter((rule) => fitness(rule) && rule.phases.includes("ci") && !owned.has(rule.id)).length;
  return { deny, advisor, shadow, warnOnly, monitor: advisor + shadow + warnOnly, unverified, rules: lock.rules.length, fitness: lock.rules.filter(fitness).length };
}

test("status and doctor lead with enforced, advisor and unverified rules on a mixed contract", () => {
  const root = join(area, "repo");
  const home = join(area, "home");
  mkdirSync(join(root, ".pregate"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(home, { recursive: true });
  const preset = {
    name: "coverage-honesty", version: "1.0.0", engine: VERSIONS.engine,
    sources: [
      { ns: "core", kind: "builtin", version: VERSIONS.core },
      { ns: "clean-code", kind: "library", version: "1.2.0" },
    ],
    methodologies: ["core/pregate-integrity", "core/software-invariants", "clean-code/clean-code"],
    enforcement: "advisor",
    overrides: { "clean-code/CC-ER-002": { enforcement: "enforce" } },
    scope: { include: ["src/**"], exclude: [] },
  };
  writeFileSync(join(root, PRESET), JSON.stringify(preset));
  writeFileSync(join(root, "src/order.ts"), "export const order = 1;\n");
  const env = {
    ...process.env, CI: "1",
    HOME: home, USERPROFILE: home,
    XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state"), XDG_CONFIG_HOME: join(area, "config"),
    CODEX_HOME: join(area, "codex"), GROK_HOME: join(area, "grok"), CLAUDE_CONFIG_DIR: join(area, "claude"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const run = (args: string[]) => {
    const out = Bun.spawnSync([process.execPath, cli, ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 60_000 });
    if (out.signalCode) throw new Error(`${args.join(" ")} terminated: ${out.signalCode}\n${out.stderr.toString()}`);
    return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString() };
  };
  expect(Bun.spawnSync(["git", "init", "-q"], { cwd: root, env, stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
  const compiled = run(["preset", "compile"]);
  expect(compiled.stderr + compiled.stdout, compiled.stderr).toContain("written");
  expect(compiled.code).toBe(0);
  const counts = counted(JSON.parse(readFileSync(join(root, LOCK), "utf8")) as Lock);
  expect(counts).toMatchObject({ deny: 1, advisor: 7, shadow: 0, warnOnly: 0, unverified: 64, fitness: 64, rules: 72 });
  const enforced = `Enforced (deny): ${counts.deny}.`;
  const monitor = `Advisor or monitor only: ${counts.monitor} (${counts.advisor} advisor, ${counts.shadow} shadow, ${counts.warnOnly} warn-only).`;
  const unverified = `Unverified: not adopted (${counts.unverified} optional requirements have no verifier and check nothing).`;
  const harnesses = "Harnesses gated: none. Not configured: claude-code, codex, cursor, grok, agy.";
  const channels = "Channels not covered: warning channel not covered on agy; halt not covered on codex, cursor, grok, agy; stop-limit notice not covered on codex, cursor, grok, agy; session context not covered on grok.";
  const catalog = `Catalog: ${counts.rules} rules in this lock (${counts.rules - counts.fitness} static, ${counts.fitness} fitness).`;
  const lead = [enforced, monitor, unverified, harnesses, channels, catalog];
  const status = run(["status"]);
  expect(status.code).toBe(0);
  const lines = status.stdout.trimEnd().split("\n");
  expect(lines.slice(0, lead.length)).toEqual(lead);
  expect(lines.findIndex((line) => line.startsWith("Catalog:"))).toBeGreaterThan(lines.findIndex((line) => line.startsWith("Unverified:")));
  expect(lines.some((line) => line.includes("Local consent is inactive"))).toBe(true);
  const verbose = run(["status", "--verbose"]);
  expect(verbose.code).toBe(0);
  expect(verbose.stdout.trimEnd().split("\n").slice(0, lead.length)).toEqual(lead);
  expect(verbose.stdout).toContain("1 static deny");
  expect(verbose.stdout).toContain(`Project verification: not adopted (${counts.unverified} optional requirements have no verifier and check nothing).`);
  const doctor = run(["doctor"]);
  expect(doctor.stdout.trimEnd().split("\n").slice(0, lead.length)).toEqual(lead);
  expect(doctor.stdout).not.toContain("This directory has no preset");
  expect(doctor.stdout).toContain("Local consent is inactive");
});
