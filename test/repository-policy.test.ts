import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { decide, LOOP_DEFAULTS } from "../src/decide.ts";
import { VERSIONS } from "../src/versions.ts";
import { librarySource } from "../src/library.ts";
import { FIXABLE_BY, type DecideInput, type Lock } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

// Cases spawn git or the engine; on Windows each spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

const root = join(import.meta.dir, "..");
const preset = readFileSync(join(root, ".pregate/preset.json"), "utf8");
const area = mkdtempSync(join(tmpdir(), "pregate-policy-"));
afterAll(() => removeTree(area));

function contract(loop?: object): Lock {
  const text = loop === undefined ? preset : JSON.stringify({ ...JSON.parse(preset), loop });
  const result = compile(text, (source) => source.kind === "builtin" ? BUILTIN
    : source.kind === "library" ? librarySource(source.ns) : null, VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  expect(result.lock.rules.filter((rule) => rule.id.startsWith("core/"))).toHaveLength(68);
  return result.lock;
}

function input(lock: Lock | null, event: "pre-edit" | "stop" = "stop"): DecideInput {
  return { lock, lockHash: lock === null ? null : "a".repeat(64), launcher: "/repo/pregate",
    session: { id: "policy", harness: "codex", agentId: null, turnId: "turn", interactive: false },
    event, path: null, introduced: [], form: { cause: "state-io", line: null }, protectedPath: false,
    history: [], turnDenials: 0, astHash: null,
    stop: event === "stop" ? { blocks: 2, reentry: false, approved: [] } : null };
}

test("repository policy boundary: shared default mutation cannot change a later fallback decision", () => {
  const lock = contract();
  const before = decide(input(null));
  expect(before.verdict).toBe("none");
  const mutation: Mutation = { target: LOOP_DEFAULTS, key: "maxStopBlocks", original: LOOP_DEFAULTS.maxStopBlocks, changed: false };
  restoringMutation(mutation, () => {
    mutation.changed = Reflect.set(LOOP_DEFAULTS, "maxStopBlocks", 99);
    const after = decide(input(null));
    expect({ changed: mutation.changed, loop: LOOP_DEFAULTS, decision: after }).toEqual({ changed: false, loop: lock.loop, decision: before });
  });
});

test("repository policy boundary: shared failure-class mutation cannot turn a human halt into an agent retry", () => {
  const before = decide(input(null, "pre-edit"));
  expect(before.verdict).toBe("deny");
  expect(before.halt).toBe(true);
  const mutation: Mutation = { target: FIXABLE_BY, key: "state-io", original: FIXABLE_BY["state-io"], changed: false };
  restoringMutation(mutation, () => {
    mutation.changed = Reflect.set(FIXABLE_BY, "state-io", "agent");
    expect({ changed: mutation.changed, decision: decide(input(null, "pre-edit")) }).toEqual({ changed: false, decision: before });
  });
});

interface Mutation { target: object; key: string; original: unknown; changed: boolean }
function restoringMutation(mutation: Mutation, attempt: () => void) {
  try { attempt(); } finally { if (mutation.changed) Reflect.set(mutation.target, mutation.key, mutation.original); }
}

test("repository policy boundary: one source policy change reaches compilation and fallback without drift", async () => {
  const entry = join(area, "policy.ts");
  const stopInput = JSON.stringify(input(null));
  writeFileSync(entry, `import { compile } from ${JSON.stringify(join(root, "src/compile.ts"))};
import { decide, LOOP_DEFAULTS } from ${JSON.stringify(join(root, "src/decide.ts"))};
import { BUILTIN } from ${JSON.stringify(join(root, "src/assets.ts"))};
import { librarySource } from ${JSON.stringify(join(root, "src/library.ts"))};
import { VERSIONS } from ${JSON.stringify(join(root, "src/versions.ts"))};
const result = compile(${JSON.stringify(preset)}, (source) => source.kind === "builtin" ? BUILTIN : librarySource(source.ns), VERSIONS);
if ("errors" in result) throw new Error(result.errors.join("\\n"));
const input = ${stopInput};
console.log(JSON.stringify({ defaults: LOOP_DEFAULTS, compiled: result.lock.loop,
  core: result.lock.rules.filter((rule) => rule.id.startsWith("core/")).length,
  fallback: decide(input).verdict, contracted: decide({ ...input, lock: result.lock }).verdict }));
`);
  let owners = 0;
  const built = await Bun.build({ entrypoints: [entry], target: "bun", outdir: area, naming: "policy.js",
    plugins: [{ name: "observed-policy-change", setup(build) {
      build.onLoad({ filter: /[\\/](?:decide|enforcement)\.ts$/ }, ({ path }) => {
        const source = readFileSync(path, "utf8");
        if (!source.includes("export const LOOP_DEFAULTS")) return { contents: source, loader: "ts" };
        const next = source.replace(/maxStopBlocks:\s*2/, "maxStopBlocks: 3");
        if (next === source) throw new Error("Expected the actual exported default policy");
        owners++;
        return { contents: next, loader: "ts" };
      });
    } }] });
  expect(built.success).toBe(true);
  expect(owners).toBe(1);
  const child = Bun.spawnSync([process.execPath, join(area, "policy.js")], { cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  expect(child.exitCode, child.stderr.toString()).toBe(0);
  const result = JSON.parse(child.stdout.toString());
  expect(result.core).toBe(68);
  expect(result.defaults.maxStopBlocks).toBe(3);
  expect(result.compiled).toEqual(result.defaults);
  expect(result.fallback).toBe("deny");
  expect(result.contracted).toBe(result.fallback);
});

test("repository policy boundary: explicit contract overrides remain local and do not change defaults", () => {
  const defaults = structuredClone(LOOP_DEFAULTS);
  const configured = contract({ maxStopBlocks: 4, allowAsk: false });
  expect(configured.loop).toEqual({ ...defaults, maxStopBlocks: 4, allowAsk: false });
  configured.loop.maxStopBlocks = 7;
  expect(contract().loop).toEqual(defaults);
  expect(LOOP_DEFAULTS).toEqual(defaults);
});
