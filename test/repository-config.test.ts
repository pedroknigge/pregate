import { expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { VERSIONS } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Preset } from "../src/types.ts";
import { ADVISORY_CHECKS, advisoryChecksFromScript, checkId, expectAdvisoryTier } from "./core-tier.ts";

// Cases spawn git or the engine; on Windows each spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

const text = readFileSync(join(import.meta.dir, "../.pregate/preset.json"), "utf8");
const preset = JSON.parse(text) as Preset;
const binding = { command: ["bun", "verify.ts"], inputs: ["verify.ts"], verificationHash: "a".repeat(64),
  timeoutMs: 1000, rationale: "Exercise the actual project decision." };

function inspect(input: string) {
  const loaded: string[] = [];
  const result = compile(input, (source) => {
    loaded.push(source.ns);
    return source.kind === "builtin" ? BUILTIN : source.kind === "library" ? librarySource(source.ns) : null;
  }, VERSIONS);
  return { result, loaded };
}

test("repository fail-fast boundary: the actual valid contract retains all default requirements", () => {
  const { result, loaded } = inspect(text);
  if ("errors" in result) console.error(result.errors.join("\n"));
  expect("errors" in result).toBe(false);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  expect(loaded).toEqual(preset.sources.map((s) => s.ns));
  const core = result.lock.rules.filter((r) => r.id.startsWith("core/"));
  expect(core).toHaveLength(68);
  expectAdvisoryTier(core);
  expect(core.filter((r) => r.impl.kind === "primitive" && r.impl.primitive === "fitness")).toHaveLength(64);
});

test("repository fail-fast boundary: the script advisory set is the compiled warn tier", () => {
  const { result } = inspect(text);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  const fromScript = advisoryChecksFromScript();
  expect(fromScript).toEqual([...ADVISORY_CHECKS]);
  const core = result.lock.rules.filter((r) => r.id.startsWith("core/"));
  expect(core.filter((r) => r.severity === "warn").map(checkId)).toEqual(fromScript);
});

const invalid: [string, object, string][] = [
  ["unknown root policy", { retryAnyError: true }, "/retryAnyError:"],
  ["unknown enforcement", { enforcement: "silent" }, "/enforcement:"],
  ["unknown ratchet mode", { ratchet: { mode: "always-pass" } }, "/ratchet/mode:"],
  ["unknown loop policy", { loop: { retryForever: true } }, "/loop/retryForever:"],
  ["zero denial budget", { loop: { maxDenialsPerTurn: 0 } }, "/loop/maxDenialsPerTurn:"],
  ["open failure policy", { failMode: "open" }, "/failMode:"],
  ["unknown source kind", { sources: [{ ns: "core", kind: "ambient", version: VERSIONS.core }] }, "/sources/0:"],
  ["empty verifier command", { fitness: { "CORE-INV-019": { ...binding, command: [] } } }, "/fitness/CORE-INV-019/command:"],
  ["fractional verifier deadline", { fitness: { "CORE-INV-019": { ...binding, timeoutMs: 1.5 } } }, "/fitness/CORE-INV-019/timeoutMs:"],
  ["empty verifier inputs", { fitness: { "CORE-INV-019": { ...binding, inputs: [] } } }, "/fitness/CORE-INV-019/inputs:"],
  ["empty verifier rationale", { fitness: { "CORE-INV-019": { ...binding, rationale: " " } } }, "/fitness/CORE-INV-019/rationale:"],
  ["unknown layer kind", { layers: { domain: { paths: ["src/**"], mayImport: [], kind: "mystery" } } }, "/layers/domain/kind:"],
];
test.each(invalid)("repository fail-fast boundary: rejects %s before loading rule sources", (_name, fields, path) => {
  const input = JSON.stringify({ ...preset, ...fields });
  const { result, loaded } = inspect(input);
  expect("errors" in result).toBe(true);
  expect(result).not.toHaveProperty("lock");
  expect("errors" in result ? result.errors.join("\n") : "").toContain(`preset.json: ${path}`);
  expect(loaded).toEqual([]);
});

test("repository fail-fast boundary: malformed JSON cannot load sources or produce a lock", () => {
  expect(inspect("{")).toEqual({ result: { errors: ["preset.json: invalid JSON"] }, loaded: [] });
});

test.each([
  ["different engine", { engine: "99.99.99" }, "does not match this binary"],
  ["missing builtin source", { sources: preset.sources.filter((s) => s.kind !== "builtin") }, "exactly one builtin"],
  ["unknown methodology", { methodologies: [...preset.methodologies, "core/unknown-policy"] }, "core/unknown-policy is not declared by any source"],
  ["verifier budget above the execution limit", { fitness: { "CORE-INV-019": { ...binding, timeoutMs: 120001 } } }, "exceeds the 120000 ms budget"],
] as const)("repository fail-fast boundary: rejects semantic configuration %s without a partial lock", (_name, fields, message) => {
  const { result } = inspect(JSON.stringify({ ...preset, ...fields }));
  expect("errors" in result).toBe(true);
  expect(result).not.toHaveProperty("lock");
  expect("errors" in result ? result.errors.join("\n") : "").toContain(message);
});
