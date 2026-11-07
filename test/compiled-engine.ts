import { existsSync } from "node:fs";
import { join } from "node:path";
import { COMPILED_ENGINE_ENV, ensureCompiledEngine } from "../scripts/compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";

// Real E2E suites call this from beforeAll instead of compileBinary on every file.
export function testEngine(root = join(import.meta.dir, "..", ".pregate-test-engine")): string {
  const env = process.env[COMPILED_ENGINE_ENV];
  if (typeof env === "string" && env.length > 0 && existsSync(env)) return env;
  return ensureCompiledEngine({ outfile: join(root, ENGINE_FILE), testApproval: true });
}
