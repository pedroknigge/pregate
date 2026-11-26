// Repository verifiers, not pack executables or general semantic auditors.
import { readFileSync, writeSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const checks = {
  "CORE-INV-008": { files: ["test/repository-core.test.ts"], name: "repository core boundary", count: 9 },
  "CORE-INV-016": { files: ["test/decide.test.ts"], name: "repository decision boundary", count: 1 },
  "CORE-INV-019": { files: ["test/repository-config.test.ts"], name: "repository fail-fast boundary", count: 18 },
  "CORE-INV-022": { files: ["test/git.test.ts", "test/fitness.test.ts"], name: "Git calls terminate|fitness deadline terminates", count: 4 },
  "CORE-INV-039": { files: ["test/supervisor.e2e.test.ts"], name: "stdin boundary", count: 22 },
  "CORE-INV-040": { files: ["test/supervisor.e2e.test.ts"], name: "tool names cannot disclose secrets or expand diagnostics", count: 5 },
  "CORE-INV-043": { files: ["test/gate.test.ts"], name: "real edit, command and Stop decisions retain correlation, classified failures and evaluation time", count: 1 },
  "CORE-INV-047": { files: ["test/fitness.test.ts"], name: "fitness output budget", count: 6 },
  "contract-admission": { files: ["test/repository-admission.test.ts", "test/supervisor.e2e.test.ts"], name: "repository admission", count: 32 },
  "policy-ownership": { files: ["test/repository-policy.test.ts"], name: "repository policy boundary", count: 4 },
  "decision-effects": { files: ["test/repository-core.test.ts", "test/decide.test.ts"], name: "repository core boundary|repository decision boundary", count: 10 },
  "issue-transport": { files: ["test/issue-transport.test.ts"], name: "issue transport boundary", count: 11 },
  "command-budgets": { files: ["test/git.test.ts", "test/fitness.test.ts", "test/issue-transport.test.ts"],
    name: "Git calls terminate|fitness deadline terminates|fitness output budget|issue transport boundary", count: 21, timeoutMs: 90_000 },
};
const [requirement, ...extra] = process.argv.slice(2);
const runtime = readFileSync(join(root, ".bun-version"), "utf8").trim();
if (extra.length || !requirement || !Object.hasOwn(checks, requirement) || Bun.version !== runtime) {
  writeSync(2, `Use Bun ${runtime}: bun scripts/verify-core-boundaries.ts ${Object.keys(checks).join("|")}\n`);
  process.exit(1);
}
const check = checks[requirement as keyof typeof checks];
const result = Bun.spawnSync([process.execPath, "test", "--isolate", ...check.files, "-t", check.name], {
  cwd: root, env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: "timeoutMs" in check ? check.timeoutMs : 60_000,
});
if (result.stdout.length + result.stderr.length > 1024 * 1024) {
  writeSync(2, "Verifier diagnostics exceed the 1 MiB budget.\n");
  process.exit(1);
}
writeSync(1, result.stdout);
writeSync(2, result.stderr);
const text = result.stdout.toString() + result.stderr.toString();
const passed = Number(/^\s+(\d+) pass\s*$/m.exec(text)?.[1]);
const failed = Number(/^\s+(\d+) fail\s*$/m.exec(text)?.[1]);
if (result.exitCode !== 0 || result.exitedDueToTimeout || passed !== check.count || failed !== 0) {
  writeSync(2, `Expected exactly ${check.count} passing ${requirement} boundary cases and no failure; evidence is incomplete.\n`);
  process.exit(1);
}
