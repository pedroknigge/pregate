import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { COMPILED_ENGINE_ENV } from "../scripts/compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";

// One engine build per flavour and test process. A suite that needs the engine at a path of its
// own (its location decides what it protects) gets a copy; the build is deterministic, so a copy
// is the binary a second build would give. The path is recorded in the environment because
// `bun test --isolate` gives each file a fresh module registry in the same process.
//
// An engine protects the folder two levels above its binary (the installed layout is
// <data>/engine/<version>/pregate), so the build sits that deep: directly under the temporary
// folder it would protect every test project there.
function built(testApproval: boolean): string {
  const flavour = testApproval ? "approval" : "release";
  const key = `PREGATE_TEST_ENGINE_${flavour.toUpperCase()}`;
  const known = process.env[key];
  if (known !== undefined && existsSync(known)) return known;
  const area = join(tmpdir(), `pregate-test-engine-${process.pid}`);
  const outfile = join(area, "engine", flavour, ENGINE_FILE);
  mkdirSync(dirname(outfile), { recursive: true });
  compileBinary(hostTarget(), outfile, testApproval);
  process.env[key] = outfile;
  process.on("exit", () => { try { rmSync(area, { recursive: true, force: true }); } catch { /* cleanup: best effort at exit; the folder is in the temporary directory */ } });
  return outfile;
}

// The engine at `outfile`, for a suite that used to compile its own.
export function engineAt(outfile: string, testApproval = false): void {
  mkdirSync(dirname(outfile), { recursive: true });
  copyFileSync(built(testApproval), outfile);
}

// The shared test-approval engine, for a suite that only needs to run one.
export function testEngine(): string {
  const env = process.env[COMPILED_ENGINE_ENV];
  if (typeof env === "string" && env.length > 0 && existsSync(env)) return env;
  return built(true);
}
