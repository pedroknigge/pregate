import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { LOCK, lockOf, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { sourcesMatch } from "../src/contract-diagnostic.ts";
import { builtinContentHash, hashPolicy, libraryPackHashes } from "../src/disk.ts";
import { librarySource } from "../src/library.ts";
import { sha256, stateDir } from "../src/state.ts";
import type { Lock } from "../src/types.ts";

const saved = { state: process.env.XDG_STATE_HOME, data: process.env.XDG_DATA_HOME };
let area = "";

afterEach(() => {
  if (saved.state === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = saved.state;
  if (saved.data === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = saved.data;
  if (area) rmSync(area, { recursive: true, force: true });
});

function project(): { root: string; preset: string; source: string } {
  area = mkdtempSync(join(tmpdir(), "pregate-lock-cache-"));
  process.env.XDG_STATE_HOME = join(area, "state");
  process.env.XDG_DATA_HOME = join(area, "data");
  const root = join(area, "repo");
  const presetValue = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json"), "utf8")) as { sources: unknown[] };
  presetValue.sources.push({ ns: "local", kind: "path", path: "rules/local" });
  const preset = `${JSON.stringify(presetValue, null, 2)}\n`;
  const source = JSON.stringify({ ns: "local", version: "1.0.0" }, null, 2) + "\n";
  write(join(root, PRESET), preset);
  write(join(root, "rules/local/source.json"), source);
  const compiled = compile(preset, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  write(join(root, LOCK), compiled.text);
  return { root, preset, source };
}

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function cacheFile(root: string): string {
  return join(stateDir(), "locks", `${sha256(root)}.json`);
}

function admitted(root: string): Lock {
  const loaded = lockOf(root);
  if (typeof loaded === "string") throw new Error(loaded);
  return loaded.lock;
}

test("embedded pack hashes name the files compilation reads", () => {
  expect(builtinContentHash()).toBe(hashPolicy(BUILTIN));
  const hashes = libraryPackHashes();
  expect(Object.keys(hashes).length).toBeGreaterThan(0);
  for (const [ns, hash] of Object.entries(hashes)) expect(hashPolicy(librarySource(ns, false)!)).toBe(hash);
});

test("compiled lock cache hits, falls back when corrupt, and misses when the lock, a rule, or the preset changes", () => {
  const { root, preset, source } = project();
  const cold = admitted(root);
  expect(sourcesMatch(root, cold)).toBe(true);
  const warm = admitted(root);
  expect(warm).toEqual(cold);
  expect(sourcesMatch(root, warm)).toBe(true);
  const savedCache = readFileSync(cacheFile(root), "utf8");
  expect(JSON.parse(savedCache).text).toContain(`"sourcesHash": ${JSON.stringify(cold.sourcesHash)}`);

  write(cacheFile(root), "{not-json");
  expect(admitted(root)).toEqual(cold);
  const recovered = readFileSync(cacheFile(root), "utf8");
  expect(JSON.parse(recovered).digest).toHaveLength(64);

  write(join(root, "rules/local/source.json"), source.replace("1.0.0", "1.0.1"));
  expect(lockOf(root)).toBe("lock-stale");
  expect(readFileSync(cacheFile(root), "utf8")).toBe(recovered);

  write(join(root, "rules/local/source.json"), source);
  const restored = admitted(root);
  expect(restored).toEqual(cold);
  const afterRule = readFileSync(cacheFile(root), "utf8");
  expect(afterRule).toBe(recovered);

  const lockPath = join(root, LOCK);
  const lockText = readFileSync(lockPath, "utf8");
  write(lockPath, lockText.replace(`"lockVersion": 1`, `"lockVersion": 2`));
  expect(lockOf(root)).toBe("lock-stale");
  expect(readFileSync(cacheFile(root), "utf8")).toBe(afterRule);

  write(lockPath, lockText);
  expect(admitted(root)).toEqual(cold);
  expect(readFileSync(cacheFile(root), "utf8")).toBe(afterRule);

  const edited = JSON.parse(preset) as { name: string };
  edited.name = "renamed-preset";
  write(join(root, PRESET), `${JSON.stringify(edited, null, 2)}\n`);
  expect(lockOf(root)).toBe("lock-stale");
});

test("a path source without a path misses the cache and reports lock-stale instead of throwing", () => {
  const { root, preset } = project();
  admitted(root);
  const edited = JSON.parse(preset) as { sources: Record<string, unknown>[] };
  edited.sources.push({ ns: "broken", kind: "path" });
  write(join(root, PRESET), `${JSON.stringify(edited, null, 2)}\n`);
  expect(() => lockOf(root)).not.toThrow();
  expect(lockOf(root)).toBe("lock-stale");
  edited.sources.pop();
  edited.sources.push({ ns: "typed", kind: "path", path: 7 });
  write(join(root, PRESET), `${JSON.stringify(edited, null, 2)}\n`);
  expect(lockOf(root)).toBe("lock-stale");
});
