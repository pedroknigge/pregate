import { afterAll, afterEach, beforeAll, beforeEach, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { audit } from "../src/audit-command.ts";
import { cachedAnalysis, openAuditCache, rememberAnalysis, saveAuditCache } from "../src/audit-cache.ts";
import { compile } from "../src/compile.ts";
import { canonical, evaluationFingerprint } from "../src/disk.ts";
import { LOCK, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { sha256 } from "../src/state.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { engineAt } from "./compiled-engine.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { fitnessFingerprint } from "../src/fitness-command.ts";
import { removeTree } from "./remove-tree.ts";

async function withCleanupAsync<T>(work: () => Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  try { return await work(); } finally { await cleanup(); }
}

// Cases spawn git or the engine; on Windows each spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

const base = canonical(mkdtempSync(join(tmpdir(), "pregate-incremental-")));
const binary = join(base, ENGINE_FILE);
const names = ["HOME", "XDG_STATE_HOME", "XDG_DATA_HOME"] as const;
let saved: Record<string, string | undefined>, root: string, area: string, serial = 0;
// Compiling the engine takes longer than bun's 5 s hook default on Windows runners.
beforeAll(() => engineAt(binary), 120_000);
beforeEach(() => {
  // Canonical forward-slash form, as the engine reports it (join would use \ on Windows).
  area = `${base}/${++serial}`; root = `${area}/repo`;
  saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  process.env.HOME = join(area, "home"); process.env.XDG_STATE_HOME = join(area, "state"); process.env.XDG_DATA_HOME = join(area, "data");
  put("src/domain/a.ts", 'import { value } from "../infra/provider";\nexport const answer = value;\n');
  put("src/infra/provider/index.ts", "export const value = 1;\n");
  put("src/domain/value.ts", "export const value = 2;\n");
  put("src/domain/helper.ts", "export function helper(a: number, b: number, c: number) { return a + b + c; }\n");
  const preset = JSON.parse(policyFixture(readFileSync("catalog/presets/backend-clean-ddd.json", "utf8")));
  preset.scope = { include: ["src/**"], exclude: [] }; preset.overrides["CC-FN-002"] = { params: { max: 2 } };
  put(PRESET, JSON.stringify(preset)); refreshContract();
});
afterEach(() => { for (const name of names) if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; });
afterAll(() => removeTree(base));

function put(path: string, text: string): void { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); }
function refreshContract(): void {
  const result = compile(readFileSync(join(root, PRESET), "utf8"), sourcesOf(root), VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  put(LOCK, result.text);
}
async function report(...flags: string[]) { const result = await audit(["--repo", root, "--json", ...flags]); return { code: result.code, data: JSON.parse(result.text) }; }
function observations(r: Awaited<ReturnType<typeof report>>) {
  return { code: r.code, ...Object.fromEntries(["summary", "findings", "errors", "unsupported", "fileHashes", "contentHash", "fitness", "excluded", "uncovered", "fileCoverage", "skippedRules"]
    .map((k) => [k, r.data[k]])) };
}

async function streamed(...flags: string[]) {
  const records: Record<string, any>[] = [];
  const result = await audit(["--repo", root, "--jsonl", ...flags], (record) => records.push(record));
  const end = records.at(-1)!;
  expect(result.text).toBe(""); expect(end.type).toBe("end"); expect(end.code).toBe(result.code);
  expect(end.report).not.toHaveProperty("findings");
  return { code: result.code, data: { ...end.report, findings: records.filter((r) => r.type === "file").flatMap((r) => r.findings) }, records };
}

test("streamed cold, warm and fresh audits preserve every finding, diagnostic, hash and fitness result", async () => {
  put("src/domain/syntax.ts", "export const = ;\n"); put("src/legacy.swift", "func main() {}\n"); put("src/uncovered.py", "pass\n");
  const cold = await report();
  for (const flags of [[], ["--incremental"], ["--incremental"], ["--fresh"]]) {
    const stream = await streamed(...flags);
    expect(observations(stream)).toEqual(observations(cold));
    expect(stream.records[0]).toMatchObject({ schemaVersion: 1, type: "start", root, lockHash: cold.data.lockHash });
    const files = stream.records.filter((r) => r.type === "file");
    expect(files.map((f) => ({ path: f.path, hash: f.hash }))).toEqual(cold.data.fileHashes);
    expect(files.flatMap((f) => f.errors)).toEqual(cold.data.errors);
    expect(stream.records.filter((r) => r.type === "end")).toHaveLength(1);
  }
});

test("streaming retains exit 0 for a verified clean tree and 1 for static debt", async () => {
  expect((await streamed()).code).toBe(1);
  put("src/domain/a.ts", "export {};\n"); put("src/domain/helper.ts", "export {};\n");
  expect((await streamed()).code).toBe(0);
});

test("streamed results remain provisional until final source and contract validation", async () => {
  for (const mutate of [() => put("src/domain/a.ts", "export const changed = true;\n"), () => put(LOCK, "{}")]) {
    refreshContract(); put("src/domain/a.ts", 'import { value } from "../infra/provider";\nexport const answer = value;\n');
    const records: Record<string, any>[] = [];
    const result = await audit(["--repo", root, "--jsonl"], (record) => {
      records.push(record);
      if (record.type === "file" && records.filter((r) => r.type === "file").length === 1) mutate();
    });
    expect(result.code).toBe(2); expect(result.text).toBe("");
    expect(records.at(-1)).toMatchObject({ type: "end", code: 2, report: { changedDuringAudit: true } });
  }
});

test("invalid streaming options and output failure never emit a successful end record", async () => {
  for (const flags of [["--json"], ["--plan"], ["--jsonl"], ["--unknown"]]) {
    const records: unknown[] = [];
    const result = await audit(["--repo", root, "--jsonl", ...flags], (r) => records.push(r));
    expect(result.code).toBe(2); expect(JSON.parse(result.text)).toMatchObject({ type: "error", code: 2 }); expect(records).toEqual([]);
  }
  const records: Record<string, unknown>[] = [];
  const result = await audit(["--repo", root, "--jsonl"], (r) => {
    records.push(r);
    if (r.type === "file") throw Object.assign(new Error("Disconnected output"), { code: "EPIPE" });
  });
  expect(result.code).toBe(2); expect(JSON.parse(result.text)).toMatchObject({ type: "error", code: 2 });
  expect(result.text).toContain("Disconnected output"); expect(records.some((r) => r.type === "end")).toBe(false);
});

test("production JSONL arrives before process exit; interruption has no end and resumes a checkpoint", async () => {
  const debt = Array.from({ length: 64 }, (_, i) => `export function debt${i}(a: number, b: number, c: number) { return a + b + c; }`).join("\n");
  for (let i = 0; i < 120; i++) put(`src/domain/stream${String(i).padStart(3, "0")}.ts`, debt);
  const child = Bun.spawn([binary, "audit", "--repo", root, "--jsonl", "--incremental"],
    { cwd: root, env: { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe" });
  const reader = child.stdout.getReader(), decoder = new TextDecoder();
  let pending = "", files = 0;
  const records: Record<string, any>[] = [];
  await withCleanupAsync(async () => {
    while (files < 34) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Audit exited before streaming its file records.");
      pending += decoder.decode(chunk.value, { stream: true });
      const lines = pending.split("\n"); pending = lines.pop()!;
      for (const line of lines) { const record = JSON.parse(line); records.push(record); if (record.type === "file") files++; }
    }
    expect(child.exitCode).toBeNull(); expect(records[0]!.type).toBe("start");
    child.kill();
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
    }
    const drained = pending.split("\n"); drained.pop(); // a killed write can leave an unfinished record
    for (const line of drained) records.push(JSON.parse(line));
    await child.exited;
    expect(records.some((r) => r.type === "end")).toBe(false);
    const resumed = await streamed("--incremental");
    expect(resumed.data.incremental.reusedFiles).toBeGreaterThanOrEqual(32);
    expect(resumed.data.filesScanned).toBe(124);
    expect(resumed.data.summary.violations).toBe(7682);
    expect(observations(resumed)).toEqual(observations(await report()));
  }, async () => { child.kill(); await child.exited; reader.releaseLock(); });
}, 30000);

test("repeat reuse preserves all findings, coverage and fitness; default audit stays cold", async () => {
  const cold = await report("--incremental");
  expect(cold.data.incremental).toMatchObject({ enabled: true, evaluatedFiles: 4, reusedFiles: 0, persisted: true });
  expect(cold.data.summary.violations).toBeGreaterThan(0);
  const warm = await report("--incremental");
  expect(warm.data.incremental).toMatchObject({ evaluatedFiles: 0, reusedFiles: 4 });
  expect(observations(warm)).toEqual(observations(cold));
  const fresh = await report("--fresh");
  expect(fresh.data.incremental).toMatchObject({ evaluatedFiles: 4, reusedFiles: 0 });
  expect(observations(fresh)).toEqual(observations(cold));
  const ordinary = await report(); expect(ordinary.data.incremental).toEqual({ enabled: false });
  expect(observations(ordinary)).toEqual(observations(cold));
});

test("mixed language findings and syntax diagnostics match cold audits after changes", async () => {
  const preset = JSON.parse(policyFixture(readFileSync("packs/presets/mixed-starter.json", "utf8")));
  preset.scope = { include: ["src/**"], exclude: [] };
  put(PRESET, JSON.stringify(preset));
  put("src/python.py", "def f(a, b, c, d, e): pass\n");
  put("src/go.go", "package app\nfunc f(a, b, c, d, e int) {}\n");
  refreshContract();
  const cold = await report("--incremental"), warm = await report("--incremental");
  expect(warm.data.incremental).toMatchObject({ reusedFiles: 6, evaluatedFiles: 0 });
  expect(warm.data.findings.some((f: { rule: string }) => f.rule === "python/PY-FN-002")).toBe(true);
  expect(warm.data.findings.some((f: { rule: string }) => f.rule === "go/GO-FN-002")).toBe(true);
  expect(observations(warm)).toEqual(observations(cold));
  put("src/python.py", "def f(a): pass\n");
  const repaired = await report("--incremental");
  expect(repaired.data.incremental).toMatchObject({ reusedFiles: 5, evaluatedFiles: 1, invalidatedFiles: 1 });
  expect(observations(repaired)).toEqual(observations(await report()));
  put("src/go.go", "package app\nfunc {\n");
  const broken = await report("--incremental"), repeated = await report("--incremental");
  expect(broken.data.errors.some((e: { path: string; cause: string }) => e.path === "src/go.go" && e.cause === "syntax")).toBe(true);
  expect(repeated.data.incremental.reusedFiles).toBe(6);
  expect(observations(repeated)).toEqual(observations(await report()));
});

test("warm audits reevaluate newly admitted and expired project fitness evidence", async () => {
  put("verify.ts", "process.exit(0);\n");
  const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  delete preset.overrides["core/CORE-INV-001"];
  preset.fitness = { "CORE-INV-001": { command: [process.execPath, join(root, "verify.ts")], inputs: ["verify.ts"],
    verificationHash: fitnessFingerprint(root, ["verify.ts"]), timeoutMs: 1000, maxAgeMs: 1500,
    rationale: "Controlled cache test: verifier completion proves only execution, with short-lived evidence." } };
  put(PRESET, JSON.stringify(preset)); refreshContract();
  const initial = await report("--incremental");
  expect(initial.data.fitness[0].status).toBe("unverified");
  const executed = Bun.spawnSync([binary, "fitness", "run", "--all"], { cwd: root, env: { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" }, stdout: "pipe", stderr: "pipe", timeout: 10000 });
  expect(executed.exitCode).toBe(0);
  const admitted = await report("--incremental");
  expect(admitted.data.incremental).toMatchObject({ reusedFiles: 4, evaluatedFiles: 0 });
  expect(admitted.data.fitness[0].status).toBe("pass");
  await Bun.sleep(1600);
  const expired = await report("--incremental");
  expect(expired.data.incremental.reusedFiles).toBe(4);
  expect(expired.data.fitness[0].status).toBe("unverified");
  expect(expired.data.fitness[0].reason).toContain("expired");
  expect(observations(expired)).toEqual(observations(await report()));
});

test("dependency and reexport changes invalidate unchanged importers", async () => {
  await report("--incremental");
  put("src/infra/provider/index.ts", 'export { value } from "../../domain/value";\n');
  const changed = await report("--incremental");
  expect(changed.data.incremental.invalidatedFiles).toBeGreaterThanOrEqual(2);
  expect(changed.data.incremental.reusedFiles).toBeGreaterThan(0);
  expect(observations(changed)).toEqual(observations(await report()));
  put("src/domain/value.ts", 'export const = ;\n');
  const broken = await report("--incremental");
  expect(broken.data.incremental.invalidatedFiles).toBeGreaterThanOrEqual(2);
  expect(broken.data.errors.some((e: { cause: string }) => e.cause === "unresolvable-import")).toBe(true);
  expect(observations(broken)).toEqual(observations(await report()));
});

test("configuration, absent imports, inventory and policy changes cannot reuse stale results", async () => {
  put("src/domain/a.ts", 'import { value } from "@target";\nexport const answer = value;\n');
  put("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@target": ["src/domain/value"] } } }));
  await report("--incremental");
  put("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@target": ["src/infra/provider"] } } }));
  const remapped = await report("--incremental");
  expect(remapped.data.incremental.invalidatedFiles).toBeGreaterThan(0);
  expect(observations(remapped)).toEqual(observations(await report()));
  put("src/domain/a.ts", 'import { absent } from "./missing";\nexport const answer = absent;\n');
  const absent = await report("--incremental");
  expect(observations(absent)).toEqual(observations(await report()));
  const cacheFile = join(process.env.XDG_STATE_HOME!, "pregate/audits", sha256(canonical(root)) + ".json");
  const entry = JSON.parse(readFileSync(cacheFile, "utf8")).entries.find((e: { path: string }) => e.path === "src/domain/a.ts");
  expect(entry.inputs["src/domain/missing.ts"]).toBeNull();
  put("src/domain/missing.ts", "export const absent = 3;\n");
  const added = await report("--incremental");
  expect(added.data.incremental.reusedFiles).toBe(0); expect(added.data.errors).toEqual([]);
  expect(observations(added)).toEqual(observations(await report()));
  const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8")); preset.overrides["CC-FN-002"] = { params: { max: 5 } };
  put(PRESET, JSON.stringify(preset)); refreshContract();
  const policy = await report("--incremental");
  expect(policy.data.incremental.reusedFiles).toBe(0);
  expect(observations(policy)).toEqual(observations(await report()));
});

test("corrupt cache is disposable and byte changes invalidate even with unchanged file size", async () => {
  await report("--incremental");
  const file = join(process.env.XDG_STATE_HOME!, "pregate/audits", sha256(canonical(root)) + ".json");
  const size = statSync(join(root, "src/domain/value.ts")).size;
  put("src/domain/value.ts", "export const value = 4;\n");
  expect(statSync(join(root, "src/domain/value.ts")).size).toBe(size);
  const changed = await report("--incremental"); expect(changed.data.incremental.invalidatedFiles).toBeGreaterThan(0);
  expect(observations(changed)).toEqual(observations(await report()));
  const saved = JSON.parse(readFileSync(file, "utf8")); saved.entries[0].result.findings = []; writeFileSync(file, JSON.stringify(saved));
  const corrupted = await report("--incremental"); expect(corrupted.data.incremental.reusedFiles).toBe(0);
  expect(observations(corrupted)).toEqual(observations(await report()));
  if (process.platform !== "win32") expect(statSync(file).mode & 0o777).toBe(0o600);
});

test("cache identity, absent dependencies, escaped paths and project budgets", () => {
  const cache = openAuditCache(root, "first-evaluator", false), hash = sha256("source");
  rememberAnalysis(cache, "src/a.ts", hash, { "tsconfig.json": null }, { findings: [], errors: [] }); saveAuditCache(cache);
  expect(cachedAnalysis(openAuditCache(root, "first-evaluator", false), "src/a.ts", hash, () => null)).not.toBeNull();
  expect(cachedAnalysis(openAuditCache(root, "second-evaluator", false), "src/a.ts", hash, () => null)).toBeNull();
  expect(cachedAnalysis(openAuditCache(root, "first-evaluator", false), "src/a.ts", hash, () => "new config")).toBeNull();
  rememberAnalysis(cache, "src/escape.ts", hash, { "../private": null }, { findings: [], errors: [] });
  expect(cache.entries.has("src/escape.ts")).toBe(false);
  rememberAnalysis(cache, "src/budget.ts", hash, {}, { findings: [], errors: [{ path: "src/budget.ts", cause: "regex-limit", line: 1 }] });
  expect(cache.entries.has("src/budget.ts")).toBe(false);
  writeFileSync(join(dirname(cache.file), "notes.json"), "unrelated");
  for (let i = 0; i < cache.stats.maxProjects + 2; i++) {
    const next = openAuditCache(root + i, "identity", false);
    rememberAnalysis(next, "src/a.ts", hash, {}, { findings: [], errors: [] }); saveAuditCache(next);
  }
  expect(readdirSync(dirname(cache.file)).filter((p) => /^[0-9a-f]{64}\.json$/.test(p)).length).toBe(cache.stats.maxProjects);
  expect(readFileSync(join(dirname(cache.file), "notes.json"), "utf8")).toBe("unrelated");
});

test("warm audit keeps all default-core requirements unverified and rejects a forged contract", async () => {
  put(PRESET, JSON.stringify({ name: "default-core", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [] })); refreshContract();
  const cold = await report("--incremental", "--strict"), warm = await report("--incremental", "--strict");
  expect(cold.code).toBe(2); expect(warm.code).toBe(2);
  expect((await report("--incremental")).code).toBe(0); // unbound requirements block nothing by default
  expect(warm.data.incremental.reusedFiles).toBe(4);
  expect(warm.data.fitness).toHaveLength(64);
  expect(warm.data.fitness.every((f: { status: string; statement: string }) => f.status === "unverified" && f.statement.length > 0)).toBe(true);
  expect(observations(warm)).toEqual(observations(cold));
  const forged = JSON.parse(readFileSync(join(root, LOCK), "utf8")); forged.scope = { include: [], exclude: [] }; put(LOCK, JSON.stringify(forged));
  const rejected = await audit(["--repo", root, "--incremental", "--json"]);
  expect(rejected.code).toBe(2); expect(rejected.text.startsWith("{")).toBe(false);
});

test("new excluded dependency invalidates an importer without an inventory change", async () => {
  put("src/domain/a.ts", 'import { value } from "./build/dep";\nexport const answer = value;\n');
  const before = await report("--incremental");
  put("src/domain/build/dep.ts", 'export { value } from "../../infra/provider";\n');
  const after = await report("--incremental");
  expect(after.data.fileHashes).toEqual(before.data.fileHashes);
  expect(after.data.incremental.reusedFiles).toBeGreaterThan(0);
  expect(after.data.incremental.invalidatedFiles).toBeGreaterThan(0);
  expect(observations(after)).toEqual(observations(await report()));
  expect(after.data.summary.violations).toBeGreaterThan(before.data.summary.violations);
});

test("oversized entries and persisted files stay within cache byte budgets", () => {
  const cache = openAuditCache(root, "identity", false), hash = sha256("source");
  const finding = { rule: "custom/RULE", check: "custom/check@1.0.0", path: "src/a.ts", line: 1, symbol: "value", measured: null,
    limit: null, atSessionStart: null, severity: "deny" as const, enforcement: "enforce" as const, message: "finding", fix: "x".repeat(cache.stats.maxBytesPerProject / 2) };
  rememberAnalysis(cache, "src/a.ts", hash, {}, { findings: [finding], errors: [] });
  expect(cache.entries.size).toBe(0);
  for (let i = 0; i < 8; i++) {
    const path = `src/${i}.ts`;
    rememberAnalysis(cache, path, hash, {}, { findings: [{ ...finding, path, fix: "x".repeat(1024 * 1024) }], errors: [] });
    expect(cache.bytes).toBeLessThan(cache.stats.maxBytesPerProject);
  }
  saveAuditCache(cache); expect(cache.stats.persisted).toBe(true);
  expect(statSync(cache.file).size).toBeLessThanOrEqual(cache.stats.maxBytesPerProject);
  const partial = openAuditCache(root, "identity", false);
  const available = partial.entries.size;
  for (let i = 0; i < 8; i++) {
    const path = `src/${i}.ts`;
    if (cachedAnalysis(partial, path, hash, () => null) === null) rememberAnalysis(partial, path, hash, {}, { findings: [{ ...finding, path, fix: "x".repeat(1024 * 1024) }], errors: [] });
  }
  expect(partial.stats.reusedFiles).toBe(available);
  expect(partial.bytes).toBeLessThan(partial.stats.maxBytesPerProject);
  writeFileSync(cache.file, "x".repeat(cache.stats.maxBytesPerProject + 1));
  const invalid = openAuditCache(root, "identity", false);
  expect(invalid.entries.size).toBe(0); expect(invalid.stats.error).toContain("unavailable");
});

test("an actual killed compiled audit resumes completed checkpoints and matches a cold run", async () => {
  for (let i = 0; i < 160; i++) put(`src/domain/batch${i}.ts`, Array.from({ length: 80 }, (_, n) => `export const value${n} = ${n};`).join("\n"));
  const file = join(process.env.XDG_STATE_HOME!, "pregate/audits", sha256(canonical(root)) + ".json");
  const env = { ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  const child = Bun.spawn([binary, "audit", "--incremental", "--json"], { cwd: root, env, stdout: "ignore", stderr: "pipe" });
  const started = Date.now();
  while (!existsSync(file) && Date.now() - started < 10000) await Bun.sleep(5);
  expect(existsSync(file)).toBe(true);
  child.kill("SIGKILL"); await child.exited;
  const completed = JSON.parse(readFileSync(file, "utf8")); expect(completed.entries.length).toBeGreaterThanOrEqual(32);
  const run = (...args: string[]) => Bun.spawnSync([binary, "audit", "--json", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20000 });
  const resumed = run("--incremental"), cold = run();
  const data = JSON.parse(resumed.stdout.toString()), reference = JSON.parse(cold.stdout.toString());
  expect(data.incremental.reusedFiles).toBeGreaterThanOrEqual(32);
  expect(data.incremental.evaluatedFiles).toBeGreaterThan(0);
  expect(observations({ code: resumed.exitCode!, data })).toEqual(observations({ code: cold.exitCode!, data: reference }));
}, 30000);

test("evaluation identity changes with executable source, schema and parser bytes", () => {
  const fixture = join(area, "fingerprint");
  const paths = ["src/a.ts", "schema/a.json", "vendor/web-tree-sitter/web-tree-sitter.js", "vendor/web-tree-sitter/web-tree-sitter.wasm",
    "vendor/tree-sitter-typescript/tree-sitter-typescript.wasm", "vendor/tree-sitter-typescript/tree-sitter-tsx.wasm",
    "vendor/tree-sitter-python/tree-sitter-python.wasm", "vendor/tree-sitter-go/tree-sitter-go.wasm", "vendor/tree-sitter-rust/tree-sitter-rust.wasm"];
  for (const path of paths) { mkdirSync(dirname(join(fixture, path)), { recursive: true }); writeFileSync(join(fixture, path), "initial"); }
  for (const path of paths) {
    const before = evaluationFingerprint(fixture); writeFileSync(join(fixture, path), Buffer.from([0xff, 0x00, 0x80]));
    expect(evaluationFingerprint(fixture)).not.toBe(before);
  }
});
