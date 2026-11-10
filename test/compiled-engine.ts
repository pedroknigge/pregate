import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPILED_ENGINE_ENV, ensureCompiledEngine } from "../scripts/compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";

// Real E2E suites call this instead of compileBinary on every file. The first call in a test
// process builds the engine outside the repository and records its path in the environment; later
// calls, in any file, return that path. An engine protects the folder two levels above its
// binary (the installed layout is <data>/engine/<version>/pregate), so the binary sits that deep:
// directly under the temporary folder it would protect every test project there.
export function testEngine(root = join(tmpdir(), "pregate-test-engine", "engine", "test")): string {
  const env = process.env[COMPILED_ENGINE_ENV];
  if (typeof env === "string" && env.length > 0 && existsSync(env)) return env;
  return ensureCompiledEngine({ outfile: join(root, ENGINE_FILE), testApproval: true });
}
