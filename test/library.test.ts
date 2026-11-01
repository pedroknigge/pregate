import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BUILTIN } from "../src/assets.ts";
import { compile, listChecks, sourcesHash } from "../src/compile.ts";
import { contractDiff } from "../src/contract.ts";
import { blocking, decide, LOOP_DEFAULTS } from "../src/decide.ts";
import { readTree } from "../src/disk.ts";
import { analyze } from "../src/evaluate.ts";
import { testCheck } from "../src/fixtures.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { contract } from "../src/message.ts";
import { detectStack, onboardingCard } from "../src/onboard.ts";
import { librarySource } from "../src/library.ts";
import type { Lock, Preset, Violation } from "../src/types.ts";

beforeAll(grammars);

const PACKS = [
  "agent-practices", "angular", "architecture", "authjs", "clean-code", "dcouplr", "ddd", "drizzle", "express", "firebase", "javascript",
  "maintainability", "mattpocock", "mongodb", "musk", "nestjs", "nextjs", "node", "nuxt",
  "postgres", "prisma", "pstack", "react-native", "react", "redis", "senior",
  "solana", "supabase", "svelte", "sveltekit", "tailwind", "trpc", "typescript",
  "vibe-proof", "vue", "python", "go", "testing", "enterprise-ready", "consumer-saas", "next-website", "vercel",
  "design-invariants", "security-audit",
];
const PRESETS = [
  "framework-app", "hexagonal-backend", "observe-only", "pstack-way",
  "senior-typescript-strict", "vibe-proof-production", "solana-hackathon",
  "musk-algorithm", "human-maintainability", "react-spa", "nextjs-fullstack",
  "node-api", "vue-spa", "python-starter", "go-starter", "mixed-starter",
];
test("policy-only library loading preserves every bundled contract and fixture-independent source hash", () => {
  for (const ns of PACKS) {
    const policy = librarySource(ns)!;
    const full = librarySource(ns, true)!;
    const expected = Object.fromEntries(Object.entries(readTree(`packs/${ns}`, true))
      .filter(([path]) => /^(source\.json$|checks\/|methodologies\/)/.test(path) && !path.includes("/fixtures/") && path.endsWith(".json")));
    expect(policy, ns).toEqual(expected);
    expect(Object.keys(policy).some((path) => path.includes("/fixtures/")), ns).toBe(false);
    expect(Object.keys(full).some((path) => path.includes("/fixtures/")), ns).toBe(true);
    expect(sourcesHash([policy]), ns).toBe(sourcesHash([full]));
  }
});
const filesOf = (s: Preset["sources"][number]) => s.kind === "builtin" ? BUILTIN : s.kind === "path" ? readTree(s.path, true) : s.kind === "library" ? librarySource(s.ns, true) : null;
const preset = (): Preset => JSON.parse(readFileSync("packs/presets/observe-only.json", "utf8"));
const compiled = (p: Preset): Lock => {
  const result = compile(JSON.stringify(p), filesOf, VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  return result.lock;
};
const findings = (lock: Lock): Violation[] => {
  const result = analyze(lock, "pre", "src/order.ts", "export default function fail(): void { throw new Error(\"no\"); }\n", { read: () => null, now: clock });
  if ("cause" in result) throw new Error(result.cause);
  return result.violations;
};

test.each(PACKS)("library %s: every real pass/fail/trap fixture passes", (ns) => {
  const files = readTree(`packs/${ns}`, true);
  const listed = listChecks(files);
  if ("errors" in listed) throw new Error(listed.errors.join("\n"));
  for (const id of listed.ids) expect(testCheck(files, id, clock).ok).toBe(true);
});

test.each([
  ["launch-safety", 6], ["security-review", 6], ["domain-ownership", 4], ["behavior-testing", 6],
] as const)("agent practices %s selects only its own project-evidence obligations", (method, count) => {
  const p = preset();
  expect(compiled(p).rules.some((r) => r.id.startsWith("agent-practices/"))).toBe(false);
  p.sources.push({ ns: "agent-practices", kind: "library", version: "1.0.0" });
  expect(compiled(p).rules.some((r) => r.id.startsWith("agent-practices/"))).toBe(false);
  p.methodologies.push(`agent-practices/${method}`);
  const rules = compiled(p).rules.filter((r) => r.id.startsWith("agent-practices/"));
  expect(rules).toHaveLength(count);
  expect(rules.every((r) => r.check.startsWith(`agent-practices/${method}/`))).toBe(true);
  expect(rules.every((r) => r.impl.kind === "primitive" && r.impl.primitive === "fitness")).toBe(true);
  expect(rules.every((r) => !r.phases.includes("pre"))).toBe(true);
});

test("mattpocock methodologies compile as optional warnings with test-only scope", () => {
  const p = preset();
  p.sources = [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "mattpocock", kind: "library", version: "1.1.0" }];
  p.methodologies = ["mattpocock/testing", "mattpocock/design", "mattpocock/diagnosis"];
  p.enforcement = "enforce";
  const lock = compiled(p);
  const code = 'vi.mock("./pricing");\nconst fn = vi.fn(x => x ? 1 : 0);\nexpect(value).toBe(value);\nexpect(fn).toHaveBeenCalledTimes(1);\nconsole.log("[DEBUG-probe] temporary");\nfunction wide(a, b, c, d, e) { return e; }\n';
  const review = (path: string) => {
    const out = analyze(lock, "pre", path, code, { read: () => null, now: clock });
    if ("cause" in out) throw new Error(out.cause);
    return out.violations;
  };
  const findings = review("test/orders.test.ts");
  expect(findings.map((v) => v.rule).sort()).toEqual([
    "mattpocock/MP-CALLS-001", "mattpocock/MP-DEBUG-001", "mattpocock/MP-MOCK-001",
    "mattpocock/MP-MOCK-BRANCH-001", "mattpocock/MP-PARAMS-001", "mattpocock/MP-SELF-001",
  ]);
  expect(findings.every((v) => v.severity === "warn")).toBe(true);
  expect(blocking(lock, findings, null).violations).toEqual([]);
  expect(review("src/orders.ts").map((v) => v.rule).sort()).toEqual([
    "mattpocock/MP-DEBUG-001", "mattpocock/MP-PARAMS-001",
  ]);
  p.methodologies = ["mattpocock/diagnosis"];
  expect(compiled(p).rules.filter((r) => r.id.startsWith("mattpocock/")).map((r) => r.id))
    .toEqual(["mattpocock/MP-DEBUG-001"]);
});

test("normative catalog inventories all source entries and resolves every rule reference", () => {
  const result = Bun.spawnSync(["bun", "scripts/invariant-coverage.ts", "--check"], { stdout: "pipe", stderr: "pipe" });
  expect(result.exitCode).toBe(0);
  const coverage = JSON.parse(readFileSync("packs/invariant-coverage.json", "utf8"));
  expect(coverage.entries).toHaveLength(313);
  expect(new Set(coverage.entries.map((entry: { id: string }) => entry.id)).size).toBe(313);
  expect(coverage.entries.find((entry: { id: string }) => entry.id === "FH-71")?.references).toContainEqual({
    alias: "maintainability/MAINT-CLOCK-001", exists: true,
  });
});

test.each(PRESETS)("library preset %s compiles at release versions", (name) => {
  const lock = compiled(JSON.parse(readFileSync(`packs/presets/${name}.json`, "utf8")));
  expect(lock.engine).toBe(VERSIONS.engine);
  expect(lock.core).toBe(VERSIONS.core);
  expect(lock.rules.filter((r) => r.integrity).every((r) => r.enforcement === "enforce")).toBe(true);
});

test("Next.js preset allows Pages Router head and denies conflicting fetch options", () => {
  const lock = compiled({ ...JSON.parse(readFileSync("packs/presets/nextjs-fullstack.json", "utf8")), enforcement: "enforce" });
  const review = (path: string, code: string): Violation[] => {
    const out = analyze(lock, "pre", path, code, { read: () => null, now: clock });
    if ("cause" in out) throw new Error(out.cause);
    return blocking(lock, out.violations, null).violations;
  };
  expect(review("src/pages/legacy.tsx", 'import Head from "next/head";').map((v) => v.rule)).not.toContain("nextjs/NEXT-HEAD-001");
  expect(review("src/app/page.tsx", 'import Head from "next/head";').map((v) => v.rule)).toContain("nextjs/NEXT-HEAD-001");
  expect(review("src/app/data.ts", 'fetch(url, { cache: "no-store", next: { revalidate: 60 } });').map((v) => v.rule)).toContain("nextjs/NEXT-CONFLICT-001");
  expect(review("src/app/data.ts", 'fetch(url, { cache: "no-store" });').map((v) => v.rule)).not.toContain("nextjs/NEXT-CONFLICT-001");
});

test("React preset denies Hooks in iterator callbacks but allows component callbacks", () => {
  const lock = compiled({ ...JSON.parse(readFileSync("packs/presets/react-spa.json", "utf8")), enforcement: "enforce" });
  const review = (code: string): string[] => {
    const out = analyze(lock, "pre", "src/Rows.tsx", code, { read: () => null, now: clock });
    if ("cause" in out) throw new Error(out.cause);
    return blocking(lock, out.violations, null).violations.map((v) => v.rule);
  };
  expect(review("function Rows({ ids }) { return ids.map(id => useState(id)); }")).toContain("react/REACT-CALLBACK-001");
  expect(review("const Row = memo(function Row() { return useState(0); });")).not.toContain("react/REACT-CALLBACK-001");
});

test.each([
  ["nextjs/NEXT-HEAD-001", { ns: "nextjs", method: "rendering", alias: "NEXT-HEAD-001", path: "src/app/layout.ts", valid: 'import { headers } from "next/headers";', invalid: 'import Head from "next/head";' }],
  ["authjs/AUTH-SERVER-001", { ns: "authjs", method: "session", alias: "AUTH-SERVER-001", path: "src/app/account/page.tsx", valid: '"use client"; import { signOut } from "next-auth/react"; export default function Page() { return <button onClick={() => signOut()}>Exit</button>; }', invalid: 'import { getSession } from "next-auth/react";' }],
  ["react/REACT-NEST-001", { ns: "react", method: "components", alias: "REACT-NEST-001", path: "src/Range.tsx", valid: 'export function Range() { function inRange(value: number, min: number, max: number) { return value<max && value>min; } return <span>{String(inRange(1, 0, 2))}</span>; }', invalid: 'export function Outer() { function Inner() { return <span/>; } return <Inner/>; }' }],
  ["nextjs/NEXT-LINK-001", { ns: "nextjs", method: "routing", alias: "NEXT-LINK-001", path: "src/Content.tsx", valid: 'export function content() { return \'<a href="/about">About</a>\'; }', invalid: 'export const Nav = () => <a href="/about">About</a>;' }],
  ["typescript/TS-EXPORT-ANY-001", { ns: "typescript", method: "strict-types", alias: "TS-EXPORT-ANY-001", path: "src/filter.ts", valid: 'export function positive(values: number[]): number[] { return values.filter((value) => value > 0); }', invalid: 'export function positive(values) { return values; }' }],
  ["drizzle/DRIZ-LIMIT-001", { ns: "drizzle", method: "queries", alias: "DRIZ-LIMIT-001", path: "src/password.ts", valid: 'export function buffer(value: string) { return Buffer.from(value); }', invalid: 'const rows = combine(db.select().from(users), db.select().from(accounts).limit(10));' }],
] as const)("reviewed enforce/deny %s preserves valid code and blocks the declared violation", (_name, scenario) => {
  const { ns, method, alias, path, valid, invalid } = scenario;
  const files = librarySource(ns)!;
  const manifest = JSON.parse(files[`methodologies/${method}.json`]!);
  const p = preset();
  p.sources = [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns, kind: "library", version: JSON.parse(files["source.json"]!).version }];
  p.methodologies = [`${ns}/${method}`]; p.enforcement = "enforce";
  p.scope = { include: ["**"], exclude: [] };
  // Isolate the selected contract. Raising an advisory default to deny here is explicit test data,
  // not a product recommendation or activation in a consumer project.
  p.overrides = Object.fromEntries(manifest.invariants.map((r: { id: string }) => [`${ns}/${r.id}`, "off"]));
  p.overrides[`${ns}/${alias}`] = { enforcement: "enforce", severity: "deny" };
  const lock = compiled(p);
  const review = (code: string) => {
    const out = analyze(lock, "pre", path, code, { read: () => null, now: clock });
    if ("cause" in out) throw new Error(out.cause);
    return blocking(lock, out.violations, null).violations.map((v) => v.rule);
  };
  expect(review(valid)).toEqual([]);
  expect(review(invalid)).toEqual([`${ns}/${alias}`]);
});

test.each(["react-spa", "nextjs-fullstack", "node-api", "vue-spa"])("new framework preset %s observes policy while integrity enforces", (name) => {
  const lock = compiled(JSON.parse(readFileSync(`packs/presets/${name}.json`, "utf8")));
  expect(lock.enforcement).toBe("shadow");
  expect(lock.rules.filter((r) => r.integrity).length).toBeGreaterThan(0);
  expect(lock.rules.filter((r) => r.integrity).every((r) => r.enforcement === "enforce")).toBe(true);
});

test.each([
  ["express", "middleware", "src/server.ts", 'const app = express(); app.use(express.json());'],
  ["react", "hooks", "src/CountLabel.tsx", 'function CountLabel({ count }) { const [prevCount, setPrevCount] = useState(count); if (prevCount !== count) setPrevCount(count); return <h1>{count}</h1>; }'],
  ["react", "hooks", "src/dom.ts", 'function attachTitle(title) { setTitle(title); }'],
  ["vue", "reactivity", "src/focus.ts", 'function focusInput() { nextTick(() => input.value.focus()); }'],
  ["vue", "reactivity", "src/state.ts", 'const { nested } = reactive({ nested: { count: 0 } }); nested.count++;'],
  ["vue", "reactivity", "src/actions.ts", 'const { increment } = useCounterStore(); increment();'],
])("documented valid %s code is not blocked: %s, %s", (ns, method, path, code) => {
  const p = preset();
  p.sources = [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns, kind: "library", version: JSON.parse(librarySource(ns)!["source.json"]!).version }];
  p.methodologies = [`${ns}/${method}`]; p.enforcement = "enforce";
  const lock = compiled(p), out = analyze(lock, "pre", path, code, { read: () => null, now: clock });
  if ("cause" in out) throw new Error(out.cause);
  expect(blocking(lock, out.violations, null).violations).toEqual([]);
});

test("Solana's bounded syntax warnings preserve literal import denials", () => {
  const lock = compiled(JSON.parse(readFileSync("packs/presets/solana-hackathon.json", "utf8")));
  const rules = lock.rules.filter((r) => r.id.startsWith("solana/"));
  expect(rules.filter((r) => r.severity === "warn")).toHaveLength(8);
  expect(rules.filter((r) => r.severity === "deny")).toHaveLength(3);
  const review = (code: string) => {
    const out = analyze(lock, "pre", "src/client/example.ts", code, { read: () => null, now: clock });
    if ("cause" in out) throw new Error(out.cause);
    return out.violations;
  };
  expect(blocking(lock, review('import * as legacy from "@solana/web3.js";'), null).violations).toHaveLength(1);
  const warned = review('await rpc.getTransaction(sig, { maxSupportedTransactionVersion: String(1) });');
  expect(warned.map((v) => v.severity)).toEqual(["warn"]);
  expect(blocking(lock, warned, null).violations).toEqual([]);
});

test.each(["enforce", "shadow"] as const)("per-rule overrides reverse the %s default across gate and check phases", (mode) => {
  const p = preset();
  p.enforcement = mode;
  p.overrides = { "typescript/TS-THROW-001": { enforcement: mode === "enforce" ? "shadow" : "enforce" } };
  const lock = compiled(p);
  const vs = findings(lock);
  expect(vs.map((v) => v.rule).sort()).toEqual(["typescript/TS-DEFAULT-001", "typescript/TS-THROW-001"]);
  const enforced = mode === "enforce" ? "typescript/TS-DEFAULT-001" : "typescript/TS-THROW-001";
  expect(blocking(lock, vs, null).violations.map((v) => v.rule)).toEqual([enforced]);
  for (const event of ["pre-edit", "stop"] as const) {
    const d = decide({ lock, lockHash: "hash", launcher: "/repo/pregate", session: {
      id: "test", harness: "claude-code", agentId: null, turnId: "turn", interactive: true },
      event, path: "src/order.ts", introduced: vs, form: null, protectedPath: false,
      history: [], turnDenials: 0, astHash: "tree", stop: null });
    expect(d.verdict).toBe("deny");
    expect(d.violations.map((v) => v.rule)).toEqual([enforced]);
    expect(d.shadowed).toBe(true);
  }
  const card = onboardingCard(detectStack({}), lock, {}, clock);
  expect(card).toContain(`typescript/TS-THROW-001 (deny, ${mode === "enforce" ? "shadow" : "enforce"})`);
  expect(contract(lock, "/repo/pregate")).toContain(`typescript/TS-DEFAULT-001 (deny, ${mode})`);
});

test("integrity cannot be shadowed via alias or check overrides", () => {
  for (const key of ["core/EVA-SUP-001", "core/integrity/new-inline-suppression"]) {
    const p = preset();
    p.overrides = { [key]: { enforcement: "shadow" } };
    const result = compile(JSON.stringify(p), filesOf, VERSIONS);
    expect("errors" in result && result.errors.join("\n")).toContain("cannot be shadowed");
  }
});

test("warn and off remain independent of enforcement; shadow weakens an approval card", () => {
  const p = preset(); p.enforcement = "enforce";
  const before = compiled(p);
  p.overrides = { "typescript/TS-THROW-001": { enforcement: "shadow" }, "typescript/TS-DEFAULT-001": "off" };
  const after = compiled(p);
  expect(blocking(after, findings(after), null).violations).toEqual([]);
  expect(after.rules.some((r) => r.id === "typescript/TS-DEFAULT-001")).toBe(false);
  expect(contractDiff(before, after).warning).toBe(true);
  p.overrides["typescript/TS-THROW-001"] = "warn";
  const warned = compiled(p);
  expect(findings(warned).map((v) => v.severity)).toEqual(["warn"]);
  expect(blocking(warned, findings(warned), null).violations).toEqual([]);
});

test("a shadow finding on a denied call never consumes that rule's later denial budget", () => {
  const p = preset(); p.enforcement = "enforce";
  const lock = compiled(p);
  const vs = findings(lock);
  const hit = vs.find((v) => v.rule === "typescript/TS-THROW-001")!;
  const d = decide({ lock: { ...lock, loop: { ...LOOP_DEFAULTS, maxDenialsPerFileRule: 2 } }, lockHash: "hash", launcher: "/repo/pregate",
    session: { id: "s", harness: "claude-code", agentId: null, turnId: "t", interactive: true }, event: "pre-edit",
    path: hit.path, introduced: [hit], form: null, protectedPath: false, turnDenials: 0, astHash: "new", stop: null,
    history: [{ at: 1, callId: "old", turn: "t", agentId: null, kind: "pre-edit", path: hit.path,
      verdict: "deny", halted: false, form: null, shadowed: true, violations: vs,
      enforcement: { "typescript/TS-THROW-001": "shadow", "typescript/TS-DEFAULT-001": "enforce" }, afterSha: null, astHash: "old" }] });
  expect(d.attempt).toBe(1);
  expect(d.halt).toBe(false);
});

test("bundled sources pin their version and content independently of the builtin catalog", () => {
  const p = JSON.parse(readFileSync("packs/presets/python-starter.json", "utf8")) as Preset;
  const lock = compiled(p);
  expect(lock.coreHash).toBe(sourcesHash([BUILTIN]));
  expect(lock.sourcesHash).toBe(sourcesHash([librarySource("python")!]));
  expect(lock.sourceDirs).toEqual([]);
  const changed = { ...librarySource("python")! };
  const path = "checks/complexity/fn-max-params/check.json";
  const check = JSON.parse(changed[path]!);
  check.feedback.message = "Changed feedback.";
  changed[path] = JSON.stringify(check);
  const edited = compile(JSON.stringify(p), (s) => s.kind === "builtin" ? BUILTIN : changed, VERSIONS);
  expect("lock" in edited && edited.lock.sourcesHash).not.toBe(lock.sourcesHash);
  (p.sources[1] as { version: string }).version = "0.9.0";
  const stale = compile(JSON.stringify(p), filesOf, VERSIONS);
  expect("errors" in stale && stale.errors.join("\n")).toContain("pack update --preview");
});

test.each(["python", "go"])("invalid %s syntax cannot count as a passing pack fixture", (ns) => {
  const files = { ...librarySource(ns, true)! };
  const fixturePath = Object.keys(files).find((path) => path.startsWith("checks/complexity/fn-max-params/fixtures/pass/") && path.endsWith("fixture.json"))!;
  const fixture = JSON.parse(files[fixturePath]!);
  const target = fixturePath.slice(0, -"fixture.json".length) + "files/" + fixture.target;
  files[target] = ns === "python" ? "def broken(:\n" : "package app\nfunc broken( {\n";
  const result = testCheck(files, ns + "/complexity/fn-max-params", clock);
  expect(result.ok).toBe(false);
  expect(result.lines.join("\n")).toContain("Invalid " + ns + " fixture syntax");
});
