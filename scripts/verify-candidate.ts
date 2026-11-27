// One command for the evidence every release record assembles by hand: typecheck, the complete
// suite, the host build with its pre-checks, native packaged smoke and latency. It writes one
// JSON record with the exact commit, tree state, Bun version and each step's outcome. Internal:
// it is not shipped. Usage: bun run scripts/verify-candidate.ts <evidence.json> [--skip <step,step>]
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hostTarget } from "./build.ts";

const ROOT = join(import.meta.dir, "..");
// The suite default is one worker per core (18 on the reference machine). Any parallelism makes
// the timing tests nondeterministic: the launcher-overhead medians, the cold-engine failClosed
// timeouts and the built-release build timeout move with scheduler load, not with the candidate,
// and the failing set rotates between runs. One worker keeps every assertion and measures the
// candidate on a quiet machine.
const SUITE = ["test", "--parallel=1"];
// The macOS latency gate is the §8 merge gate, the same form the CI macOS job runs: the absolute
// darwin budget belongs to the reference machine and drifts with it, so the gate interleaves the
// frozen v0.0.12 reference checkout, reports the absolute table, and fails only above 1.31× the
// reference p95 on the four Pre routes. Other hosts keep the strict absolute bench.
const DARWIN = process.platform === "darwin";
const LATENCY_TAG = "v0.0.12";
const LATENCY_REF = join(process.env.TMPDIR || "/tmp", "pregate-latency-ref");

const STEPS: Record<string, string[]> = {
  typecheck: ["run", "typecheck"],
  suite: SUITE,
  build: ["run", "scripts/build.ts", hostTarget()],
  smoke: ["run", "scripts/smoke-native.ts", "dist", hostTarget()],
  ...(DARWIN ? { "latency-ref": ["run", "scripts/latency-ref.ts", LATENCY_REF, LATENCY_TAG] } : {}),
  latency: DARWIN
    ? ["run", "scripts/bench.ts", "--runs", "25", "--repeat", "3", "--inform", "--ratio", "--against", LATENCY_REF, "--against-label", LATENCY_TAG,
      "--only", "200 lines, first touch", "--only", "200 lines, second touch",
      "--only", "2,000 lines, first touch", "--only", "2,000 lines, second touch"]
    : ["run", "scripts/bench.ts"],
};

interface Step { name: string; exit: number | null; seconds: number; summary: string[]; full: string[] }

function main(): number {
  const args = process.argv.slice(2);
  const skipAt = args.indexOf("--skip");
  const skip = skipAt < 0 ? [] : (args[skipAt + 1] ?? "").split(",");
  const out = args[0];
  if (out === undefined || out.startsWith("-") || args.length !== (skipAt < 0 ? 1 : 3) || skip.some((s) => !(s in STEPS))) {
    throw new Error(`usage: verify-candidate.ts <evidence.json> [--skip ${Object.keys(STEPS).join(",")}]`);
  }
  const steps: Step[] = [];
  for (const [name, command] of Object.entries(STEPS)) {
    if (skip.includes(name)) {
      steps.push({ name, exit: null, seconds: 0, summary: ["skipped by request"], full: [] });
      continue;
    }
    steps.push(step(name, command));
    console.log(`${name}: exit ${steps.at(-1)!.exit} in ${steps.at(-1)!.seconds} s`);
    if (steps.at(-1)!.exit !== 0 && steps.at(-1)!.exit !== null) {
      writeFileSync(`${out}.${name}.log`, steps.at(-1)!.full.join("\n") + "\n");
      console.log(`  full output: ${out}.${name}.log`);
    }
  }
  const record = {
    commit: git("rev-parse", "HEAD"), dirty: git("status", "--porcelain").split("\n").filter(Boolean).length,
    bun: Bun.version, target: hostTarget(), finished: new Date().toISOString(), steps,
    verdict: steps.every((s) => s.exit === 0) ? "pass" : steps.some((s) => s.exit !== null && s.exit !== 0) ? "fail" : "incomplete",
  };
  writeFileSync(resolve(out), JSON.stringify(record, null, 2) + "\n");
  console.log(`${record.verdict}: evidence written to ${resolve(out)}`);
  return record.verdict === "pass" ? 0 : 1;
}

// The last lines that state a result: test counts, latency verdict, smoke and build outcomes.
function step(name: string, command: string[]): Step {
  const started = performance.now();
  const r = Bun.spawnSync([process.execPath, ...command], { cwd: ROOT, stdout: "pipe", stderr: "pipe", env: process.env });
  const full = (r.stdout.toString() + r.stderr.toString()).split("\n");
  const summary = full.map((l) => l.trim())
    .filter((l) => /^\d+ (pass|fail|skip)$|^Ran \d+ tests|budget|p95|p50|passed|failed|error|exited/i.test(l)).slice(-12);
  return { name, exit: r.exitCode, seconds: Math.round((performance.now() - started) / 100) / 10, summary, full };
}

function git(...args: string[]): string {
  return Bun.spawnSync(["git", ...args], { cwd: ROOT, stdout: "pipe" }).stdout.toString().trim();
}

process.exit(main());
