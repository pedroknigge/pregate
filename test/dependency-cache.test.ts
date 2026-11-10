import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cachedDependencyInputs, openDependencyCache, rememberDependencyInputs, saveDependencyCache } from "../src/dependency-cache.ts";
import { sha256 } from "../src/state.ts";
import { compile } from "../src/compile.ts";
import { sourcesOf, VERSIONS } from "../src/gate.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

function isolated(run: (root: string) => void) {
  const area = realpathSync(mkdtempSync(join(tmpdir(), "pregate-dependency-cache-"))), saved = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = join(area, "state");
  restoringState(area, saved, run);
}

function restoringState(area: string, saved: string | undefined, run: (root: string) => void) {
  try { run(join(area, "repo")); }
  finally { if (saved === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = saved; removeTree(area); }
}

test("checkpoint reload validates content, absent probes, contract context and canonical identities", () => isolated(root => {
  const cache = openDependencyCache(root), context = sha256("contract"), source = 'import "./value";';
  const inputs = new Map([["src/value", null], ["src/value.ts", sha256("export const value = 1;")]]);
  rememberDependencyInputs(cache, "src/use.ts", source, context, { inputs });
  saveDependencyCache(cache);
  const loaded = openDependencyCache(root);
  expect(cachedDependencyInputs(loaded, "src/use.ts", source, context, { hash: path => inputs.get(path)! })).not.toBeNull();
  expect(cachedDependencyInputs(loaded, "src/use.ts", source + "\n", context, { hash: path => inputs.get(path)! })).toBeNull();
  expect(cachedDependencyInputs(loaded, "src/use.ts", source, sha256("new contract"), { hash: path => inputs.get(path)! })).toBeNull();
  expect(cachedDependencyInputs(loaded, "src/use.ts", source, context, { hash: path => path === "src/value" ? sha256("new target") : inputs.get(path)! })).toBeNull();
  expect(cachedDependencyInputs(loaded, "src/use.ts", source, context, { hash: path => path === "src/value.ts" ? null : inputs.get(path)! })).toBeNull();
  expect(cachedDependencyInputs(loaded, "src/use.ts", source, context, { hash: path => inputs.get(path)!, identity: path => path + "/changed" })).toBeNull();
  expect(Object.keys(JSON.parse(readFileSync(loaded.file, "utf8")).entries[0]).sort()).toEqual(["context", "hash", "inputs", "path"]);
}));

test("unknown resolver versions and corrupted hashes cause an empty checkpoint", () => isolated(root => {
  const cache = openDependencyCache(root);
  rememberDependencyInputs(cache, "src/use.ts", 'import "./value";', sha256("contract"), { inputs: new Map([["src/value.ts", null]]) });
  saveDependencyCache(cache);
  const saved = JSON.parse(readFileSync(cache.file, "utf8"));
  saved.resolver = "future"; writeFileSync(cache.file, JSON.stringify(saved));
  expect(openDependencyCache(root).entries.size).toBe(0);
  saved.resolver = "dependency-reads-v1"; saved.entries[0].inputs = []; writeFileSync(cache.file, JSON.stringify(saved));
  expect(openDependencyCache(root).entries.size).toBe(0);
}));

test("CLI stdin checks persist cold resolver reads and retain warm unchanged-importer denials", () => isolated(root => {
  mkdirSync(join(root, ".pregate"), { recursive: true });
  mkdirSync(join(root, "src/domain"), { recursive: true });
  mkdirSync(join(root, "src/infra"), { recursive: true });
  const preset = policyFixture(readFileSync(join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json"), "utf8"));
  writeFileSync(join(root, ".pregate/preset.json"), preset);
  const compiled = compile(preset, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, ".pregate/pregate.lock.json"), compiled.text);
  writeFileSync(join(root, "src/domain/value.ts"), "export const value = 1;\n");
  writeFileSync(join(root, "src/infra/value.ts"), "export const value = 2;\n");
  writeFileSync(join(root, "src/domain/barrel.ts"), 'export { value } from "./value";\n');
  writeFileSync(join(root, "src/domain/use.ts"), 'import { value } from "./barrel";\nexport const used = value;\n');
  for (const args of [["init", "-q"], ["add", "."], ["commit", "-qm", "base"]]) {
    const git = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root, stderr: "pipe" });
    if (git.exitCode !== 0) throw new Error(git.stderr.toString());
  }
  const path = join(root, "src/domain/barrel.ts"), source = 'export { value } from "../infra/value";\n';
  const invoke = () => Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/main.ts"), "check", "--stdin", "--path", path], {
    cwd: join(import.meta.dir, ".."), env: { ...process.env }, stdin: Buffer.from(source), stdout: "pipe", stderr: "pipe",
  });
  const cold = invoke();
  expect(cold.exitCode).toBe(1);
  expect(cold.stdout.toString()).toContain("src/domain/use.ts");
  expect(openDependencyCache(root).entries.has("src/domain/use.ts")).toBe(true);
  const warm = invoke();
  expect(warm.exitCode).toBe(1);
  expect(warm.stdout.toString()).toBe(cold.stdout.toString());
}), 30_000);
