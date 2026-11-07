import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { compileBinary, hostTarget } from "./build.ts";
import { ENGINE_FILE } from "../src/platform.ts";

// One compiled engine per CI job or local test run (David field report C). Tests and bench read
// PREGATE_COMPILED_ENGINE; when unset, the first caller builds into a stable path and records it.
// Usage: bun scripts/compiled-engine.ts [--out <file>]

const ROOT = join(import.meta.dir, "..");
export const COMPILED_ENGINE_ENV = "PREGATE_COMPILED_ENGINE";
function stampPath(): string {
  const base = process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? "/tmp";
  return join(base, "pregate-compiled-engine.stamp");
}

export function defaultCompiledEnginePath(): string {
  const base = process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? "/tmp";
  return join(base, "pregate-compiled-engine", pkg.version, ENGINE_FILE);
}

export interface EnsureOptions { outfile?: string; testApproval?: boolean; force?: boolean }

export function ensureCompiledEngine(options: EnsureOptions = {}): string {
  const outfile = options.outfile ?? process.env[COMPILED_ENGINE_ENV] ?? defaultCompiledEnginePath();
  if (existsSync(outfile) && !options.force && !engineStale(outfile)) {
    publishCompiledEngineEnv(outfile);
    return outfile;
  }
  mkdirSync(join(outfile, ".."), { recursive: true });
  compileBinary(hostTarget(), outfile, options.testApproval ?? true);
  touchStamp();
  publishCompiledEngineEnv(outfile);
  return outfile;
}

function engineStale(outfile: string): boolean {
  const stamp = stampPath();
  if (!existsSync(stamp)) return true;
  try {
    return statSync(outfile).mtimeMs < statSync(stamp).mtimeMs;
  } catch {
    return true;
  }
}

function touchStamp(): void {
  writeFileSync(stampPath(), `${new Date().toISOString()}\n`);
}

function publishCompiledEngineEnv(path: string): void {
  if (process.env[COMPILED_ENGINE_ENV] === path) return;
  process.env[COMPILED_ENGINE_ENV] = path;
  const summary = process.env.GITHUB_ENV;
  if (summary) writeFileSync(summary, `${COMPILED_ENGINE_ENV}=${path}\n`, { flag: "a" });
}

if (import.meta.main) {
  const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : undefined;
  const force = process.argv.includes("--force");
  console.log(ensureCompiledEngine({ outfile: out, force }));
}
