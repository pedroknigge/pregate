import { expect, setDefaultTimeout, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compile, fixtureLock } from "../src/compile.ts";
import { enable } from "../src/consent.ts";
import { canonical, readTree } from "../src/disk.ts";
import { dispute } from "../src/dispute-command.ts";
import { analyze } from "../src/evaluate.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, LOCK, onPreEdit, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { eventName, history, H, key, record, sha256, stateDir } from "../src/state.ts";
import type { CallEvent, Check, Fixture, Session } from "../src/types.ts";
import { pathKey, slash } from "../src/paths.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

async function withCleanupAsync<T>(work: () => Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  try { return await work(); } finally { await cleanup(); }
}

// Cases spawn git or the engine; on Windows each spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

const session: Session = { id: "dispute-test", harness: "codex", agentId: null, turnId: "t", interactive: false };
const path = "src/domain/total.ts";
const was = "export function total(a: number, b: number, c: number, d: number): number {\n  return a + b + c + d;\n}\n";
const denied = was.replace("d: number", "d: number, e: number").replace(" + d;", " + d + e;");

async function inRepo(run: (root: string) => Promise<void>): Promise<void> {
  const area = realpathSync(mkdtempSync(join(tmpdir(), "pregate-dispute-"))), root = canonical(join(area, "repo"));
  const cwd = process.cwd(), vars = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "TMPDIR", "CODEX_HOME", "GROK_HOME"] as const;
  const saved = vars.map((v) => process.env[v]);
  vars.forEach((v) => { process.env[v] = join(area, v.toLowerCase()); mkdirSync(process.env[v]!, { recursive: true }); });
  await withCleanupAsync(async () => {
    cpSync(join(cwd, "test/demo-repo"), root, { recursive: true });
    mkdirSync(join(root, ".pregate"));
    const preset = JSON.parse(policyFixture(readFileSync(join(cwd, "catalog/presets/backend-clean-ddd.json"), "utf8"))) as { overrides?: Record<string, unknown> };
    preset.overrides = { ...preset.overrides, "clean-code/CC-FN-002": "deny" };
    writeFileSync(join(root, PRESET), JSON.stringify(preset));
    const compiled = compile(readFileSync(join(root, PRESET), "utf8"), sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    writeFileSync(join(root, LOCK), compiled.text);
    writeFileSync(join(root, path), was);
    for (const args of [["init", "-q"], ["add", "-A"], ["commit", "-qm", "debt"]]) {
      const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root });
      if (r.exitCode !== 0) throw new Error(r.stderr.toString());
    }
    enable(root);
    const decision = await onPreEdit([{ session, callId: "denied", tool: "apply_patch", path: join(root, path), edit: { form: "full", content: denied }, from: null }]);
    expect(decision.verdict).toBe("deny");
    expect(decision.full).toContain("ask the user to run `pregate dispute --last`");
    process.chdir(root);
    await run(root);
  }, () => {
    process.chdir(cwd);
    vars.forEach((v, i) => saved[i] === undefined ? delete process.env[v] : process.env[v] = saved[i]);
    removeTree(area);
  });
}

test("dispute --last and event ID draft recorded code and baseline without changing the contract", () => inRepo(async (root) => {
  const preset = readFileSync(join(root, PRESET), "utf8"), lock = readFileSync(join(root, LOCK), "utf8");
  const sid = key(session), event = history(sid, "-", H(pathKey(join(root, path))))[0]!;
  const folder = readdirSync(join(stateDir(), "sessions"))[0]!;
  const id = sha256(`${folder}\0${eventName(event)}`).slice(0, 24);
  const other: CallEvent = { ...event, root: "/another/repo", at: event.at + 1, callId: "other" };
  record(sid, other, denied, was);
  const result = dispute(["--last"]);
  expect(result.code).toBe(0);
  expect(result.text).toContain(`Event ID: ${id}`);
  expect(result.text).toContain("pregate rules test .");
  expect(result.text).toContain("D27 one-click human approval");
  const dir = result.text.split("\n")[0]!.slice("Fixture candidates: ".length);
  expect(dir.startsWith(slash(join(root, "pregate-drafts/")))).toBe(true);
  const tree = readTree(dir, true);
  const fixturePath = Object.keys(tree).find((f) => f.endsWith("/fixture.json"))!;
  const fixture = JSON.parse(tree[fixturePath]!);
  expect(fixture.expect).toEqual({ verdict: "pass" });
  expect(fixture.params.max).toBe(3);
  expect(fixture.before).toBe("before/");
  expect(tree[fixturePath.replace("fixture.json", `files/${path}.fixture`)]).toBe(denied);
  expect(tree[fixturePath.replace("fixture.json", `before/${path}.fixture`)]).toBe(was);
  expect(tree[fixturePath.replace("fixture.json", "NOTE.md")]).toContain("clean-code/CC-FN-002");
  const catalog = readTree(join(import.meta.dir, "../packs/clean-code"), true);
  const candidate = Object.fromEntries(Object.entries(tree).map(([p, text]) => [p.slice("clean-code/".length), text]));
  const tested = testCheck({ ...catalog, ...candidate }, "clean-code/complexity/fn-max-params", clock);
  expect(tested.ok).toBe(false);
  expect(tested.lines.some((l) => l.startsWith("FAIL") && l.includes(`pass/dispute-${id}`) && l.includes("fail [1(5)]"))).toBe(true);
  expect(dispute([id]).code).toBe(0);
  expect(dispute([]).code).toBe(0);
  expect(readFileSync(join(root, PRESET), "utf8")).toBe(preset);
  expect(readFileSync(join(root, LOCK), "utf8")).toBe(lock);
  expect(readFileSync(join(root, path), "utf8")).toBe(was);
}));

test("dispute rejects unknown IDs, unavailable replay metadata and corrupted blobs", () => inRepo(async (root) => {
  expect(dispute(["../event"]).code).toBe(1);
  expect(dispute(["--last", "extra"]).code).toBe(1);
  expect(dispute(["0".repeat(24)]).text).toContain("No matching denied call");
  const sid = key(session), event = history(sid, "-", H(pathKey(join(root, path))))[0]!;
  const blob = join(stateDir(), "sessions", readdirSync(join(stateDir(), "sessions"))[0]!, "blobs", event.afterSha!);
  writeFileSync(blob, "corrupted");
  expect(dispute(["--last"]).text).toContain("does not match its recorded hash");
  expect(existsSync(join(root, "pregate-drafts"))).toBe(false);
  record(sid, { ...event, dispute: undefined, beforeSha: null, afterSha: null, callId: "legacy", at: event.at + 1 }, null);
  expect(dispute(["--last"]).text).toContain("Reproduce it with the current engine");
}));

test("a recorded scoped pattern yields a candidate compatible with its original files restriction", () => inRepo(async (root) => {
  const source = readTree(join(import.meta.dir, "../packs/typescript"), true);
  const checkPath = "checks/exports/require-default-export", checkId = "typescript/exports/require-default-export";
  const definition = JSON.parse(source[`${checkPath}/check.json`]!) as Check;
  const fixturePath = Object.keys(source).find((p) => p.startsWith(`${checkPath}/fixtures/fail/`) && p.endsWith("/fixture.json"))!;
  const fixture = JSON.parse(source[fixturePath]!) as Fixture;
  const text = source[fixturePath.replace("fixture.json", `files/${fixture.target}.fixture`)]!;
  const lock = fixtureLock(definition, fixture.params, fixture.context);
  const analyzed = analyze(lock, "pre", fixture.target, text, { read: () => null, now: clock });
  if ("cause" in analyzed) throw new Error(analyzed.cause);
  expect(analyzed.violations.length).toBeGreaterThan(0);
  const sid = key(session), old = history(sid, "-", H(pathKey(join(root, path))))[0]!;
  const event: CallEvent = { ...old, at: old.at + 1, callId: "scoped", path: join(root, fixture.target),
    violations: analyzed.violations, beforeSha: null, afterSha: sha256(text),
    dispute: { rules: lock.rules, checks: { [checkId]: definition }, context: fixture.context } };
  record(sid, event, text);
  const result = dispute(["--last"]);
  expect(result.code).toBe(0);
  const dir = result.text.split("\n")[0]!.slice("Fixture candidates: ".length);
  const tree = readTree(dir, true), candidate = Object.fromEntries(Object.entries(tree).map(([p, code]) => [p.slice("typescript/".length), code]));
  const draftFixture = JSON.parse(Object.entries(candidate).find(([p]) => p.endsWith("fixture.json"))![1]);
  expect(draftFixture.params.paths).toBeUndefined();
  const tested = testCheck({ ...source, ...candidate }, checkId, clock);
  expect(tested.ok).toBe(false);
  expect(tested.lines.filter((l) => l.startsWith("FAIL"))).toHaveLength(1);
  expect(tested.lines.find((l) => l.startsWith("FAIL"))).toContain("(expected pass [])");
}));
