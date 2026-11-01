import { afterAll, beforeAll, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setUpGrammars } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { enable } from "../src/consent.ts";
import { readTree } from "../src/disk.ts";
import { analyze } from "../src/evaluate.ts";
import { check, clock, LOCK, onPreEdit, onSessionStart, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { HARNESSES } from "../src/harness/profile.ts";
import { comparedLock, introduced } from "../src/ratchet.ts";
import { grammarOf, parse } from "../src/ts.ts";
import type { Analysis, Lock, Read } from "../src/types.ts";
import { WINDOWS } from "../src/platform.ts";
import { policyFixture, policyFixtureSource } from "./policy-fixtures.ts";

let policies: Lock[];
beforeAll(async () => { await setUpGrammars(); policies = locks(); });
const testedViolations = new Map<number, number>();
afterAll(() => {
  // A filtered run can select one policy. The complete matrix keeps the original nonvacuity check.
  if (testedViolations.size === 4) expect([...testedViolations.values()].reduce((sum, n) => sum + n, 0)).toBeGreaterThan(100);
});

test("marker-count ratchet reports the added suppression line instead of module line one", () => {
  const text = readFileSync("catalog/presets/legacy-safe.json", "utf8");
  const compiled = compile(text, sourcesOf(process.cwd()), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  const lock = compiled.lock, lines = Array.from({ length: 300 }, () => "");
  lines[275] = "// eslint-disable-next-line retained-rule";
  const before = lines.join("\n");
  lines[43] = "// eslint-disable-next-line added-rule";
  const after = lines.join("\n");
  const old = analyze(lock, "pre", "src/example.ts", before, { read: () => null, now: clock });
  const next = analyze(lock, "pre", "src/example.ts", after, { read: () => null, now: clock });
  if ("cause" in old || "cause" in next) throw new Error("Control syntax must parse");
  expect(introduced(lock, "src/example.ts", old, next).find(v => v.rule === "core/EVA-SUP-001")?.line).toBe(44);
  expect(introduced(lock, "src/example.ts", null, old).find(v => v.rule === "core/EVA-SUP-001")?.line).toBe(276);
});

test("captured session payloads inject the contract only with local consent", () => inTempHome(async (base) => {
  const root = join(base, "repo");
  debtRepo(root);
  for (const harness of ["codex", "cursor", "grok", "agy"] as const) {
    const file = harness === "agy" ? "pre-invocation.json" : "session-start.json";
    const payload = JSON.parse(readFileSync(`test/payloads/${harness}/${file}`, "utf8"));
    Object.assign(payload, { cwd: root, workspace_roots: [root], workspacePaths: [root] });
    const adapter = HARNESSES[harness];
    const event = adapter.decode("session-start", JSON.stringify(payload), { grokEvent: "session_start", projectDir: root, remote: false });
    if (event === null || "cause" in event || event.kind !== "session-start") throw new Error("capture did not decode");
    expect(adapter.encode(event.kind, onSessionStart(event)).stdout).toBe("");
  }
  enable(root);
  for (const harness of ["codex", "cursor", "grok", "agy"] as const) {
    const d = onSessionStart({ kind: "session-start", cwd: root, session: { harness, id: `briefing-${harness}`, agentId: null, turnId: null, interactive: false } });
    const out = HARNESSES[harness].encode("session-start", d);
    if (harness === "grok") expect(out.stdout).toBe("");
    else {
      expect(out.stdout).toContain("PREGATE is active");
      expect(out.stdout).toContain("/pregate");
      expect(out.stdout).toContain("check --stdin");
    }
  }
}));

const CATALOG = Object.fromEntries(["catalog", "packs/clean-code", "packs/architecture", "packs/ddd", "packs/testing", "packs/typescript"]
  .flatMap((dir) => Object.entries(readTree(dir, true)).map(([path, text]) => [`${dir}/${path}`, text])));

// The three presets as compiled, plus the first in strict mode.
function locks(): Lock[] {
  const compiled = ["backend-clean-ddd", "functional-ts", "legacy-safe"].map((name) => {
    const out = compile(policyFixture(readFileSync(`catalog/presets/${name}.json`, "utf8")), policyFixtureSource, VERSIONS);
    if ("errors" in out) throw new Error(out.errors.join("\n"));
    return out.lock;
  });
  return [...compiled, { ...compiled[0]!, ratchet: "strict" }];
}

// Every code file of the catalog fixtures, keyed by its path in its case's project.
function code(): [string, string][] {
  return Object.entries(CATALOG).flatMap(([path, text]) => {
    const rel = /\/fixtures\/[^/]+\/[^/]+\/(?:files|before)\/(.+)\.fixture$/.exec(path)?.[1];
    return rel !== undefined && grammarOf(rel) !== null ? [[rel, text] as [string, string]] : [];
  });
}

// introduced() over the "before" analyzed under the whole lock and under comparedLock; a form in the
// "before" is the result itself.
function same(lock: Lock, rel: string, was: string, after: Analysis, read: Read): boolean {
  const result = (l: Lock): string => {
    const before = analyze(l, "pre", rel, was, { read, now: clock });
    return JSON.stringify("cause" in before ? before : introduced(lock, rel, before, after));
  };
  return result(lock) === result(comparedLock(lock, after));
}

// The gate analyzes the "before" under comparedLock and hands analyze the Parsed of the syntax check.
// On real code under the real presets, both give what the whole lock and a fresh parse give: each
// file is the "after" of a change from itself and from the file listed before it.
test.each(["backend-clean-ddd", "functional-ts", "legacy-safe", "backend-clean-ddd strict"].map((name, index) => [name, index] as const))("comparedLock and a handed-over Parsed change no result under %s", (_name, index) => {
  const files = code();
  const project = new Map(files);
  const read: Read = (rel) => project.get(rel) ?? null;
  const found: string[] = [];
  let violated = 0;
  const lock = policies[index]!;
  files.forEach(([rel, text], k) => {
    const after = analyze(lock, "pre", rel, text, { read, now: clock });
    if (parsedAnalysis(lock, rel, parse(rel, text), read) !== JSON.stringify(after)) found.push(`parsed ${rel}`);
    if ("cause" in after) return;
    violated += after.violations.length > 0 ? 1 : 0;
    const other = files[(k + files.length - 1) % files.length]![1];
    for (const was of [text, other]) if (!same(lock, rel, was, after, read)) found.push(`before ${rel} (${lock.preset.name})`);
  });
  expect(found).toEqual([]);
  expect(violated).toBeGreaterThan(0);
  testedViolations.set(index, violated);
});

// Serialized before the handed-over tree is released.
function parsedAnalysis(lock: Lock, rel: string, parsed: ReturnType<typeof parse>, read: Read): string {
  try { return JSON.stringify(analyze(lock, "pre", rel, parsed, { read, now: clock })); }
  finally { parsed.root.tree.delete(); }
}

// The same through the gate, on a repository whose committed file already carries a violation: the
// debt in `a` lets a harmless edit through, and a new violation in `b` is denied.
test("committed debt: a harmless edit passes, a new violation is denied", () => inTempHome(async (base) => {
  const root = join(base, "repo");
  debtRepo(root);
  enable(root);
  const harmless = await editB(root, "ratchet-harmless", 'return "bb";');
  expect([harmless.verdict, harmless.violations]).toEqual(["none", []]);
  const cast = await editB(root, "ratchet-cast", "return 1 as unknown as string;");
  expect([cast.verdict, cast.violations.map((v) => `${v.rule} ${v.symbol}`)]).toEqual(["deny", ["typescript/EVA-CAST-001 b"]]);
}));

const DEBT = "src/domain/settle.ts";

// HOME and XDG point into a temporary folder while `run` goes, so the gate's state stays there.
const HOME_VARS = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME"] as const;

async function inTempHome(run: (base: string) => Promise<void>): Promise<void> {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "pregate-ratchet-")));
  const saved = HOME_VARS.map((k) => process.env[k]);
  HOME_VARS.forEach((k) => { process.env[k] = join(base, k.toLowerCase()); });
  await restoringHome(base, saved, run);
}

async function restoringHome(base: string, saved: (string | undefined)[], run: (base: string) => Promise<void>): Promise<void> {
  try {
    await run(base);
  } finally {
    HOME_VARS.forEach((k, i) => (saved[i] === undefined ? delete process.env[k] : (process.env[k] = saved[i])));
    rmSync(base, { recursive: true, force: true });
  }
}

// A git copy of test/demo-repo under backend-clean-ddd whose committed `a` already casts.
function debtRepo(root: string): void {
  cpSync("test/demo-repo", root, { recursive: true });
  mkdirSync(join(root, ".pregate"));
  const preset = JSON.parse(policyFixture(readFileSync("catalog/presets/backend-clean-ddd.json", "utf8"))) as { overrides?: Record<string, unknown> };
  // The ratchet cases below count introduced debt. Manifest defaults for these two rules are warn.
  preset.overrides = { ...preset.overrides, "clean-code/CC-FN-001": "deny", "typescript/EVA-CAST-001": "deny" };
  writeFileSync(join(root, PRESET), JSON.stringify(preset));
  const out = compile(readFileSync(join(root, PRESET), "utf8"), sourcesOf(root), VERSIONS);
  if ("errors" in out) throw new Error(out.errors.join("\n"));
  writeFileSync(join(root, LOCK), out.text);
  writeFileSync(join(root, DEBT), [
    "export function a(x: unknown): string {", "  return x as unknown as string;", "}", "",
    "export function b(): string {", '  return "b";', "}", "",
  ].join("\n"));
  for (const args of [["init", "-q"], ["add", "-A"], ["commit", "-q", "-m", "debt"]]) {
    const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root, stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
  }
}

function editB(root: string, id: string, neu: string) {
  return onPreEdit([{
    session: { id, harness: "claude-code", agentId: null, turnId: "t", interactive: false }, callId: `${id}-call`, tool: "Edit",
    path: join(root, DEBT), edit: { form: "oldnew", old: 'return "b";', neu, all: false, lines: null }, from: null,
  }]);
}

test("80-line debt may shrink or stay equal, but cannot grow to 120 in hook, index or CI", () => inTempHome(async (base) => {
  const root = join(base, "repo");
  debtRepo(root);
  const source = (lines: number, name = "total") => [
    `export function ${name}(): number {`, "  let total = 0;",
    ...Array.from({ length: lines - 4 }, (_, i) => `  total += ${i};`), "  return total;", "}", "",
  ].join("\n");
  const was = source(80);
  writeFileSync(join(root, DEBT), was);
  const git = (...args: string[]) => {
    const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root });
    if (r.exitCode !== 0) throw new Error(r.stderr.toString());
    return r.stdout.toString().trim();
  };
  git("add", "-A"); git("commit", "-qm", "metric debt");
  const revision = git("rev-parse", "HEAD");
  enable(root);
  for (const [lines, name, code] of [[80, "total", 0], [70, "total", 0], [120, "total", 1], [80, "invoiceTotal", 0], [120, "invoiceTotal", 1]] as const) {
    writeFileSync(join(root, DEBT), was);
    const after = source(lines, name);
    const decision = await onPreEdit([{
      session: { id: `metric-${lines}-${name}`, harness: "codex", agentId: null, turnId: null, interactive: false },
      callId: "call", tool: "apply_patch", path: join(root, DEBT), edit: { form: "full", content: after }, from: null,
    }]);
    expect(decision.verdict).toBe(code === 0 ? "none" : "deny");
    if (lines === 120 && name === "total") {
      expect(decision.violations[0]?.atSessionStart).toBe(80);
      expect(decision.violations[0]?.repair).toMatch(/^Suggested split: extract lines \d+-\d+ into a helper\.$/);
      expect(decision.full).toContain(decision.violations[0]!.repair!);
    }
    writeFileSync(join(root, DEBT), after);
    git("add", "-A");
    expect((await check(root, { kind: "staged" })).code).toBe(code);
    expect((await check(root, { kind: "base", sha: revision })).code).toBe(code);
  }
}), WINDOWS ? 30_000 : 5_000);

test("control.nesting violations synthesize an AST guard-clause refactor hint", () => {
  const base = policies[0]!;
  const nestingRule: Lock["rules"][number] = {
    id: "clean-code/CC-CN-001",
    aliases: ["clean-code/CC-CN-001"],
    check: "clean-code/complexity/max-nesting@1.0.0",
    impl: { kind: "primitive", primitive: "metric", metric: "control.nesting" },
    params: { max: 3, paths: ["src/**"], exclude: [] },
    severity: "deny",
    phases: ["pre", "stop"],
    integrity: false,
    origin: { "params.max": "alias" },
    text: {
      message: "Nesting depth {measured} exceeds max {max}.",
      why: "Deep nesting hides control flow.",
      fix: "Flatten with guard clauses.",
      avoid: null,
      source: "Clean Code",
    },
  };
  const lock: Lock = { ...base, rules: [...base.rules, nestingRule] };
  const nested = [
    "export function checkOrder(a: boolean, b: boolean, c: boolean, d: boolean): number {",
    "  if (a) {",
    "    if (b) {",
    "      if (c) {",
    "        if (d) {",
    "          return 1;",
    "        }",
    "      }",
    "    }",
    "  }",
    "  return 0;",
    "}",
  ].join("\n");
  const out = analyze(lock, "pre", "src/domain/order.ts", nested, { read: () => null, now: clock });
  if ("cause" in out) throw new Error(out.cause);
  const v = out.violations.find((x) => x.rule === "clean-code/CC-CN-001");
  expect(v?.repair).toBe("Suggested refactor: invert condition at line 2 into a guard clause.");
});


