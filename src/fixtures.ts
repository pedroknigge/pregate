// `pregate rules test` for one check of a source (ARCHITECTURE §6.4): its patterns in both grammars,
// every fixture in memory, a second run, and the minimums per check and per alias. One line per
// fixture; any line that is not "ok" fails the source.
import { fixtureLock, listChecks, patternsOf } from "./compile.ts";
import { analyze, placement } from "./evaluate.ts";
import { compilePattern } from "./match.ts";
import { canonical, introduced } from "./ratchet.ts";
import { equal, validate } from "./schema.ts";
import type { Check, Clock, Files, Fixture, Form, Grammar, Manifest, Read, RuleLanguage, Violation } from "./types.ts";
import { grammarOf, languageApplies } from "./languages.ts";
import { errorIn, parse, type Parsed } from "./ts.ts";
import { fitnessResult } from "./fitness.ts";

interface Case { name: string; fixture: Fixture; tree: Files }   // name: "fail/long-function"; tree: rel to the case

const MINIMUM = { pass: 2, fail: 2, trap: 1 };

// A public reproduction is one case, not admission of a complete rule pack.
export function testFixture(tree: Files, now: Clock): { valid: boolean; ok: boolean; lines: string[] } {
  try {
    const check = JSON.parse(tree["CHECK.json"] ?? "") as Check;
    const invalid = validate("check", check);
    const fixture = fixtureOf(tree, "reproduction");
    if (typeof fixture === "string") invalid.push(fixture);
    if (invalid.length) return { valid: false, ok: false, lines: invalid };
    const grammar = grammarOf((fixture as Fixture).target);
    if (!skipsGrammar(check) && (grammar === null || (grammar === "tsx" ? "typescript" : grammar) !== (fixture as Fixture).language || !languageApplies(check, (fixture as Fixture).target))) {
      return { valid: false, ok: false, lines: ["Fixture language, target extension and check coverage must agree."] };
    }
    const problems = grammarErrors(check);
    fixtureLock(check, (fixture as Fixture).params, (fixture as Fixture).context);
    if (problems.length) return { valid: false, ok: false, lines: problems };
    const line = runCase(check, check.id, { name: "reproduction", fixture: fixture as Fixture, tree }, now);
    return { valid: true, ok: line.startsWith("ok"), lines: [line] };
  } catch (e) { return { valid: false, ok: false, lines: [(e as Error).message] }; }
}

export function testCheck(files: Files, checkId: string, now: Clock): { ok: boolean; lines: string[] } {
  const listed = listChecks(files);
  if ("errors" in listed) return { ok: false, lines: listed.errors.map((e) => `FAIL ${checkId}: ${e}`) };
  if (!listed.ids.includes(checkId)) return { ok: false, lines: [`FAIL ${checkId}: no such check in this source`] };
  const dir = `checks/${checkId.split("/").slice(1).join("/")}`;
  const check = JSON.parse(files[`${dir}/check.json`]!) as Check;
  const fail = (problem: string): string => `FAIL ${checkId}: ${problem}`;
  const problems = grammarErrors(check);
  const cases = loadCases(files, dir, problems);
  const lines = [
    ...problems.map(fail), ...cases.map((c) => runCase(check, checkId, c, now)),
    ...coverageErrors(cases, aliasesOf(files, checkId), check).map(fail),
  ];
  return { ok: lines.every((l) => l.startsWith("ok")), lines };
}

// A check runs on .ts and .tsx alike, so its patterns must compile in both grammars.
function grammarErrors(check: Check): string[] {
  const configs: [Grammar, ReturnType<typeof patternsOf>][] = fixtureLanguages(check).flatMap((lang) =>
    (lang === "typescript" ? ["typescript", "tsx"] as const : [lang]).map((grammar) => [grammar,
      check.impl.kind === "pattern" ? check.impl.patterns[lang] ?? [] : patternsOf(check.impl)] as [Grammar, ReturnType<typeof patternsOf>]));
  return configs.flatMap(([g, patterns]) => patterns.flatMap((c) => {
    try {
      compilePattern(c, g);
      return [];
    } catch (e) {
      return [`${(e as Error).message} (${g} grammar)`];
    }
  }));
}

// The minimums: fixtures of each kind per check, and per alias a pass and a fail with its defaults
// (the very ones it names as examples, if it names them).
function coverageErrors(cases: Case[], aliases: Manifest["invariants"], check: Check): string[] {
  const out: string[] = [];
  for (const [kind, min] of Object.entries(MINIMUM)) {
    const n = cases.filter((c) => c.name.startsWith(`${kind}/`)).length;
    if (n < min) out.push(`needs at least ${min} ${kind} fixtures, has ${n}`);
  }
  for (const alias of aliases) {
    const withDefaults = cases.filter((c) => equal(c.fixture.params, alias.defaults));
    for (const role of ["pass", "fail"] as const) {
      const named = alias.examples?.[role];
      if (!withDefaults.some((c) => c.fixture.expect.verdict === role && (named === undefined || c.name === named))) {
        out.push(`alias ${alias.id} needs a ${role} fixture with its defaults${named ? ` at ${named}` : ""}`);
      }
    }
  }
  for (const lang of fixtureLanguages(check)) {
    const selected = cases.filter((c) => c.fixture.language === lang);
    if (fixtureLanguages(check).length === 1 && lang === "typescript") continue; // retain legacy diagnostics
    for (const [kind, min] of Object.entries(MINIMUM)) {
      if (selected.filter((c) => c.name.startsWith(`${kind}/`)).length < min) out.push(`${lang}: needs at least ${min} ${kind} fixtures`);
    }
    for (const alias of aliases) for (const verdict of ["pass", "fail"]) {
      if (!selected.some((c) => c.fixture.expect.verdict === verdict && equal(c.fixture.params, alias.defaults))) out.push(`${lang}: alias ${alias.id} needs a ${verdict} fixture with its defaults`);
    }
  }
  return out;
}

function fixtureLanguages(check: Check): RuleLanguage[] {
  return [...new Set(check.languages ?? (check.impl.kind === "pattern" ? Object.keys(check.impl.patterns) as RuleLanguage[] : ["typescript" as const]))];
}

// Every case under fixtures/, by name; an invalid one is left out and reported in `problems`.
function loadCases(files: Files, dir: string, problems: string[]): Case[] {
  const at = new RegExp(`^${dir}/fixtures/((?:pass|fail|trap)/[^/]+)/(.+)$`);
  const trees = new Map<string, Files>();
  for (const [path, text] of Object.entries(files)) {
    const m = at.exec(path);
    if (m) trees.set(m[1]!, { ...trees.get(m[1]!), [m[2]!]: text });
  }
  return [...trees.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([name, tree]) => {
    const fixture = fixtureOf(tree, name);
    if (typeof fixture === "string") problems.push(`${name}/fixture.json: ${fixture}`);
    return typeof fixture === "string" ? [] : [{ name, fixture, tree }];
  });
}

// A case's fixture.json, valid and aimed at a file of the case; or what is wrong with it.
function fixtureOf(tree: Files, name: string): Fixture | string {
  const parsed = fixtureJson(tree);
  if (typeof parsed === "string") return parsed;
  const { doc } = parsed;
  if (name.startsWith("trap/") && (doc as Fixture | null)?.expect?.verdict !== "fail") {
    return "trap fixtures must expect fail; a look-alike that must pass belongs in pass/";
  }
  const invalid = validate("fixture", doc);
  const fixture = doc as Fixture;
  if (!invalid.length && code(tree, "files/")[fixture.target] === undefined && code(tree, "before/")[fixture.target] === undefined) {
    invalid.push(`target ${fixture.target} is in neither files/ nor before/`);
  }
  return invalid.length ? invalid.join("; ") : fixture;
}

function fixtureJson(tree: Files): { doc: unknown } | string {
  try {
    return { doc: JSON.parse(tree["fixture.json"] ?? "") };
  } catch {
    return "missing or invalid JSON";
  }
}

// The code of one side of a case, keyed by its path in the project; `.fixture` keeps it inert on disk.
function code(tree: Files, side: "files/" | "before/"): Files {
  return Object.fromEntries(Object.entries(tree).filter(([p]) => p.startsWith(side))
    .map(([p, text]) => [p.slice(side.length).replace(/\.fixture$/, ""), text]));
}

// The lines a check reports on one new file, or why it cannot run there (`rules draft`).
export function matchedLines(check: Check, fixture: Fixture, tree: Files, now: Clock): number[] | string {
  try {
    const r = outcome(check, { name: "draft", fixture, tree }, now);
    return "cause" in r ? `${r.cause} at line ${r.line}` : sortByLine(r).map((v) => v.line);
  } catch (e) { return (e as Error).message; }
}

function runCase(check: Check, checkId: string, c: Case, now: Clock): string {
  const expected = (c.fixture.expect.violations ?? []).map((v) => ({ line: v.line, measured: v.measured ?? null }))
    .sort((a, b) => a.line - b.line || (a.measured ?? 0) - (b.measured ?? 0));
  const runs = twoOutcomes(check, checkId, c, now);
  if (typeof runs === "string") return runs;
  const [first, second] = runs;
  const got = show(first);
  const want = `${c.fixture.expect.verdict} [${expected.map((v) => (v.measured === null ? v.line : `${v.line}(${v.measured})`)).join(", ")}]`;
  const matched = !("cause" in first) && first.length === expected.length && sortByLine(first).every((v, i) =>
    v.line === expected[i]!.line && (expected[i]!.measured === null || v.measured === expected[i]!.measured));
  if (!matched) return `FAIL ${checkId} ${c.name} -> ${got} (expected ${want})`;
  if (JSON.stringify(first) !== JSON.stringify(second)) return `FAIL ${checkId} ${c.name} -> ${got}, but ${show(second)} on a second run`;
  return `ok   ${checkId} ${c.name} -> ${got}`;
}

function twoOutcomes(check: Check, checkId: string, c: Case, now: Clock): [Violation[] | Form, Violation[] | Form] | string {
  try {
    return [outcome(check, c, now), outcome(check, c, now)];
  } catch (e) {
    return `FAIL ${checkId} ${c.name}: ${(e as Error).message}`;
  }
}

// The project of the case: `after` is files/, `before` is files/ with before/ on top. The check's own
// one-rule lock, ratchet no-new: without a before it is strict (§6.4).
function outcome(check: Check, c: Case, now: Clock): Violation[] | Form {
  const { fixture } = c;
  if (check.impl.kind === "primitive" && check.impl.primitive === "fitness") {
    const ctx = fixture.context?.fitness, verifier = String(fixture.params.verifier ?? "");
    const result = fitnessResult(verifier, ctx ? { command: ctx.command, inputs: ["**"], verificationHash: "0".repeat(64), timeoutMs: 1000, rationale: "Fixture verification" } : undefined,
      ctx?.receipt ?? null, { contractHash: ctx?.contractHash ?? "", inputHash: ctx?.inputHash ?? "", now: now() });
    return result.status === "pass" ? [] : [{ rule: check.id, path: fixture.target, line: 1, symbol: "<module>", measured: null, limit: null, atSessionStart: null, severity: "deny" }];
  }
  const after = code(c.tree, "files/");
  const before = fixture.before === null ? {} : code(c.tree, "before/");
  const grammar = grammarOf(fixture.target);
  if (!skipsGrammar(check) && (grammar === null || (grammar === "tsx" ? "typescript" : grammar) !== fixture.language || !languageApplies(check, fixture.target))) throw new Error("Fixture language, target extension and check coverage must agree.");
  const lock = fixtureLock(check, fixture.params, fixture.context);
  const phase = check.phase[0]!;
  const was = before[fixture.target] ?? null;
  const trees: Parsed[] = [];
  return withTrees(trees, (): Violation[] | Form => {
    const a = analyze(lock, phase, fixture.target, fixtureState(c, after[fixture.target] ?? null, trees), { read: reader(after), now });
    const b = was === null ? null : analyze(lock, phase, fixture.target, fixtureState(c, was, trees), { read: reader({ ...after, ...before }), now });
    if ("cause" in a) return a;
    if (b !== null && "cause" in b) return b;
    return canonical([...placement(lock, phase, fixture.target, was === null, was), ...introduced(lock, fixture.target, b, a)]);
  });
}

function withTrees<T>(trees: Parsed[], use: () => T): T {
  try { return use(); }
  finally { for (const p of trees) p.root.tree.delete(); }
}

// Placement, fitness, and tsconfig facts have no source grammar. A tsconfig fixture still
// names language typescript because that is the fixture schema's closed list.
function skipsGrammar(check: Check): boolean {
  return check.impl.kind === "primitive" && (check.impl.primitive === "placement" || check.impl.primitive === "fitness"
    || (check.impl.primitive === "typescript-fact" && check.impl.fact === "tsconfig"));
}

function fixtureState(c: Case, text: string | null, trees: Parsed[]): Parsed | string | null {
  if (text === null || c.fixture.language === "typescript") return text;
  const parsed = parse(c.fixture.target, text);
  trees.push(parsed);
  const line = errorIn(parsed, null);
  if (line !== null) throw new Error("Invalid " + c.fixture.language + " fixture syntax at line " + line);
  return parsed;
}

// A Map, not the object: `constructor` or `__proto__` must read as absent, not as Object.prototype's.
function reader(side: Files): Read {
  const store = new Map(Object.entries(side));
  return (rel) => store.get(rel) ?? null;
}

function show(r: Violation[] | Form): string {
  if ("cause" in r) return `${r.cause} at line ${r.line}`;
  const items = sortByLine(r).map((v) => (v.measured === null ? `${v.line}` : `${v.line}(${v.measured})`));
  return `${r.length ? "fail" : "pass"} [${items.join(", ")}]`;
}

function sortByLine(vs: Violation[]): Violation[] {
  return [...vs].sort((a, b) => a.line - b.line || (a.measured ?? 0) - (b.measured ?? 0));
}

function aliasesOf(files: Files, checkId: string): Manifest["invariants"] {
  return Object.entries(files).filter(([p]) => /^methodologies\/[^/]+\.json$/.test(p))
    .flatMap(([, text]) => (JSON.parse(text) as Manifest).invariants.filter((a) => a.check === checkId));
}
