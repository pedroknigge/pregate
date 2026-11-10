import { beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corpus, measure, page, type Outcome } from "../scripts/measure-shell-friction.ts";

// The friction measurement, run on the committed corpus through the real pre hook. What every
// platform must agree on is asserted here; the counts that depend on which tools a machine has as
// scripts are published by the script, with the machine named.
setDefaultTimeout(600_000);

const BENCH = join(import.meta.dir, "..", "docs", "benchmarks");
const commands = corpus();
let outcomes: Outcome[];
beforeAll(() => { outcomes = measure(commands); }, 600_000);
const decided = (id: string) => outcomes.find((o) => o.id === id)!;

test("the corpus names each command once and the published result covers it", () => {
  expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length);
  const published = JSON.parse(readFileSync(join(BENCH, "shell-friction.json"), "utf8")) as { outcomes: { id: string }[] };
  expect(published.outcomes.map((o) => o.id)).toEqual(commands.map((c) => c.id));
});

test("every command that changes the contract or the protection is refused", () => {
  const contract = outcomes.filter((o) => o.intent === "contract");
  expect(contract.length).toBeGreaterThan(0);
  for (const o of contract) expect(o.decision, o.command).toBe("deny");
  expect(decided("pregate-approve").cause).toBe("shell-admin");
  expect(decided("pregate-edit-contract").cause).toBe("protected-path");
  expect(decided("git-commit-no-verify").cause).toBe("shell-admin");
});

test("a shell write to a governed source file is refused and a read of it is not", () => {
  for (const id of ["redirect-source", "sed-in-place", "mv-source", "python-write-source"]) expect(decided(id).cause, id).toBe("shell-write");
  for (const id of ["git-status", "git-diff", "git-log", "cat", "grep", "ls", "sed-print", "pregate-status", "pregate-audit"]) expect(decided(id).decision, id).toBe("allow");
});

test("what the shell or Bun runs itself, and Pregate's own proposal commands, are not refused", () => {
  for (const id of ["cd-and-run", "cd-absolute", "type-builtin", "command-v", "bun-test", "bun-test-file", "bun-test-names-contract", "bun-test-piped", "bun-chain", "redirect-tmp",
    "npm-install", "npm-ci", "npm-test", "npm-run-build", "npm-run-lint", "tee-tmp", "env-prefix", "wait-builtin", "pregate-layers", "pregate-layers-apply", "pregate-compile", "pregate-compile-apply", "pregate-rules-test", "pregate-report"]) expect(decided(id).decision, id).toBe("allow");
});

test("the page states the counts of the run it is given", () => {
  const text = page(outcomes, { session: "One session.", commands: 10, denied: 1, byCause: { "shell-write": 1 }, labels: [{ count: 1, verdict: "intended", cause: "shell-write", shape: "A write." }] },
    { platform: "test", scripts: [] });
  const routine = outcomes.filter((o) => o.intent === "read" || o.intent === "outside");
  expect(text).toContain(`refused **${routine.filter((o) => o.decision === "deny").length} of ${routine.length}** routine commands`);
  expect(text).toContain("refused **1 of 10** shell commands (1 `shell-write`)");
  expect(text).toContain("| 1 | intended | `shell-write` | A write. |");
});
