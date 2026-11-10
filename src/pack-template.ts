import type { Alias, Check, Files, Manifest, MatchRule, PatternConfig, RuleLanguage } from "./types.ts";

export function packTemplate(ns: string): Files {
  const id = `${ns}/complexity/fn-max-params`;
  const params = { max: 2 };
  const dir = "checks/complexity/fn-max-params";
  const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
  const files: Files = {
    "source.json": json({ ns, version: "1.0.0" }),
    [`${dir}/check.json`]: json({ id, version: "1.0.0", area: "complexity", cardinality: "singleton", dimension: "fn.params", minSeverity: null,
      params: { max: { type: "integer", minimum: 0 } }, impl: { kind: "primitive", primitive: "metric", metric: "fn.params" },
      phase: ["pre", "stop", "commit", "ci"], feedback: { message: "{symbol} has {measured} parameters; maximum {limit}." } }),
    "methodologies/team.json": json({ id: `${ns}/team`, version: "1.0.0", status: "complete", conflicts: [], invariants: [{
      id: "TEAM-PARAMS-001", check: id, defaults: params, severity: "deny",
      source: { work: "Team contract", locator: "Function boundaries", paraphrase: "Keep new function interfaces small." },
      why: "Small interfaces make dependencies explicit.", fixHint: "Group related inputs into a meaningful type.",
      avoid: "Do not hide unrelated inputs in a bag of options.", examples: { pass: "pass/two", fail: "fail/three" },
    }] }),
    "README.md": `# ${ns} rule pack\n\nData only: no executable plugins. Customize team.json, the check and its fixtures.\nRun \`pregate rules test .\` before publishing this directory as a Git repository.\nConsumers run \`pregate pack add <url>@<ref>\`; pins never update automatically.\n`,
  };
  const cases = [
    ["pass/two", "export function add(a: number, b: number) { return a + b; }", "pass"],
    ["pass/none", "export function zero() { return 0; }", "pass"],
    ["fail/three", "export function add(a: number, b: number, c: number) { return a + b + c; }", "fail"],
    ["fail/four", "export function add(a: number, b: number, c: number, d: number) { return a + b + c + d; }", "fail"],
    ["pass/string", 'export const example = "function add(a, b, c, d) {}";', "pass"],
    ["trap/rest-tuple", "export function add(...values: [number, number, number, number]) { return values[0]; }", "fail"],
  ];
  for (const [name, code, verdict] of cases) {
    files[`${dir}/fixtures/${name}/files/src/a.ts`] = `${code}\n`;
    files[`${dir}/fixtures/${name}/fixture.json`] = json({ language: "typescript", params, target: "src/a.ts", before: null,
      expect: { verdict, ...(verdict === "fail" ? { violations: [{ line: 1, measured: name === "fail/three" ? 3 : 4 }] } : {}) },
      ...(name!.startsWith("trap/") ? { trap: { family: "rest-tuple", origin: "forge", discovered: "2026-10-02", note: "A tuple rest parameter hides four positional inputs behind one parameter." } } : {}) });
  }
  return files;
}

// `rules draft`: one human correction becomes a check whose fixtures are the corrected code.
export type DraftKind = "pass" | "fail" | "trap";
export interface DraftRule {
  ns: string; area: string; name: string; language: RuleLanguage; patterns: PatternConfig[];
  message: string; why: string; fix: string;
}
export interface DraftCase { kind: DraftKind; target: string; text: string; lines: number[]; note: string; today: string }

const json = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";
const METHODOLOGY = "methodologies/corrections.json";

export function draftCheckDir(area: string, name: string): string {
  return `checks/${area}/${name}`;
}

export function draftAliasId(ns: string, name: string): string {
  return `${ns}-${name}`.toUpperCase();
}

// The new check, its alias in `<ns>/corrections` and, for a new folder, its source.json.
export function draftRule(files: Files, rule: DraftRule): Files | string {
  const id = `${rule.ns}/${rule.area}/${rule.name}`;
  const dir = draftCheckDir(rule.area, rule.name);
  if (files[`${dir}/check.json`] !== undefined) return `${id} already exists; omit --pattern to add cases to it.`;
  const methodology = files[METHODOLOGY] === undefined
    ? { id: `${rule.ns}/corrections`, version: "1.0.0", status: "complete", conflicts: [], invariants: [] as Alias[] }
    : JSON.parse(files[METHODOLOGY]) as Manifest;
  methodology.invariants.push({
    id: draftAliasId(rule.ns, rule.name), check: id, defaults: {}, severity: "deny",
    source: { work: "Project correction", locator: id, paraphrase: rule.message },
    why: rule.why, fixHint: rule.fix,
    avoid: "Do not reshape the code only to slip past the pattern; make the corrected structure the easy path.",
  });
  return {
    ...(files["source.json"] === undefined ? { "source.json": json({ ns: rule.ns, category: "practice", version: "1.0.0" }) } : {}),
    [`${dir}/check.json`]: json({
      id, version: "1.0.0", area: rule.area, cardinality: "singleton", dimension: `${rule.area}.${rule.name}`, minSeverity: null,
      params: {}, impl: { kind: "pattern", patterns: { [rule.language]: rule.patterns } },
      phase: ["pre", "stop", "commit", "ci"], ...(rule.language !== "typescript" ? { languages: [rule.language] } : {}),
      feedback: { message: rule.message },
    }),
    [METHODOLOGY]: json(methodology),
  };
}

// One case under the check: the observed lines become the expected violations.
export function draftCase(files: Files, dir: string, language: RuleLanguage, c: DraftCase): Files {
  const base = c.target.split("/").at(-1)!.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "case";
  const taken = (name: string) => files[`${dir}/fixtures/${c.kind}/${name}/fixture.json`] !== undefined;
  let name = base;
  for (let n = 2; taken(name); n++) name = `${base}-${n}`;
  const at = `${dir}/fixtures/${c.kind}/${name}`;
  const expect = c.kind === "pass" ? { verdict: "pass" } : { verdict: "fail", violations: c.lines.map((line) => ({ line })) };
  const trap = c.kind === "trap" ? { trap: { family: name, origin: "real", discovered: c.today, note: c.note } } : {};
  return {
    [`${at}/fixture.json`]: json({ language, params: {}, target: c.target, before: null, expect, ...trap }),
    [`${at}/files/${c.target}.fixture`]: c.text,
  };
}

// Where a fixture file goes so a rule scoped to `glob` sees it: the glob's literal folder, the
// file's name, and the glob's extension when it names one. The caller verifies the result matches.
export function fixtureTarget(glob: string, rel: string): string {
  const segments = glob.replace(/^(\*\*\/)+/, "").split("/");
  const at = segments.findIndex((s) => /[*?[{]/.test(s));
  if (at === -1) return segments.join("/");
  const ext = /\*\.([\w]+)$/.exec(segments.slice(at).join("/"))?.[1];
  const name = rel.split("/").at(-1)!;
  const file = ext === undefined ? name : `${name.replace(/\.[^.]+$/, "")}.${ext}`;
  return [...segments.slice(0, at), file].join("/");
}

// A deny alias names its examples: the first pass and fail cases, once both exist.
export function draftExamples(files: Files, checkId: string, dir: string): Files {
  if (files[METHODOLOGY] === undefined) return {};
  const methodology = JSON.parse(files[METHODOLOGY]) as Manifest;
  const alias = methodology.invariants.find((a) => a.check === checkId);
  const first = (kind: DraftKind) => Object.keys(files).filter((p) => p.startsWith(`${dir}/fixtures/${kind}/`) && p.endsWith("/fixture.json"))
    .map((p) => p.slice(`${dir}/fixtures/`.length, -"/fixture.json".length)).sort()[0];
  const pass = first("pass"), fail = first("fail");
  if (alias === undefined || alias.examples !== undefined || pass === undefined || fail === undefined) return {};
  alias.examples = { pass, fail };
  return { [METHODOLOGY]: json(methodology) };
}

// `rules add`: one sentence becomes a catalog rule, or a drafted check with generated fixtures.
export type CatalogEntry = { fqn: string; methodology: string; alias: Alias; check: Check };
export type RuleIntent = { kind: "import-edge"; from: string; to: string } | { kind: "call-ban"; callee: string; subject?: string } | { kind: "package-ban"; name: string };
// `at`: a glob the case sits under, when it must not sit where the rule looks.
export interface DraftSample { kind: DraftKind; name: string; text: string; note: string; at?: string }
export interface IntentDraft { area: string; files?: string; fix: string; patterns: PatternConfig[]; cases: DraftSample[] }

export const regexLiteral = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A TypeScript module specifier matching `regex`: the source string of an import or re-export, or
// the argument of import(). Other strings in an exported declaration are not specifiers.
export function specifierRule(regex: string): MatchRule {
  return { kind: "string_fragment", regex, inside: { kind: "string", any: [
    { inside: { field: "source", any: [{ kind: "import_statement" }, { kind: "export_statement" }] } },
    { inside: { kind: "arguments", inside: { kind: "call_expression", has: { field: "function", kind: "import" } } } },
  ] } };
}

const STOP = new Set(["a", "an", "the", "must", "not", "never", "no", "do", "does", "dont", "don", "should", "shall", "use", "using", "in", "inside", "from",
  "of", "to", "be", "any", "only", "directly", "code", "file", "module", "layer", "and", "or", "it", "its", "we", "our", "with", "for", "on", "by",
  "can", "cannot", "may", "always", "every", "all", "is", "are", "symbol"]);

// Lowercase content words, singular. A sentence drops path-like words: a folder name scopes the
// rule, it does not describe it.
export function ruleTokens(text: string, sentence = false): string[] {
  const words = text.toLowerCase().split(/\s+/).filter((w) => !sentence || !w.includes("/")).flatMap((w) => w.split(/[^a-z0-9]+/));
  const stem = (w: string) => w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
  return [...new Set(words.filter((w) => /^[a-z]/.test(w) && !STOP.has(w)).map(stem).filter((w) => !STOP.has(w)))];
}

// A catalog rule matches when it mentions every word of the sentence, and at least two of them in
// what it checks (its ids and message), not only in its rationale. Strongest structural match first.
export function catalogMatches<T extends CatalogEntry>(sentence: string, entries: T[]): T[] {
  const tokens = ruleTokens(sentence, true);
  if (tokens.length < 2) return [];
  const scored = entries.map((entry) => {
    const ids = new Set(ruleTokens(`${entry.alias.id} ${entry.check.id}`));
    const structural = new Set([...ids, ...ruleTokens(entry.check.feedback.message)]);
    const all = new Set([...structural, ...ruleTokens(`${entry.alias.source.paraphrase} ${entry.alias.why} ${entry.alias.fixHint}`)]);
    return { entry, every: tokens.every((t) => all.has(t)), shape: tokens.filter((t) => structural.has(t)).length, id: tokens.filter((t) => ids.has(t)).length };
  });
  return scored.filter((s) => s.every && s.shape >= 2)
    .sort((a, b) => b.shape - a.shape || b.id - a.id || a.entry.fqn.localeCompare(b.entry.fqn)).map((s) => s.entry);
}

// The sentence shapes a rule can be drafted from without code: an import edge between folders, a
// banned package import and a banned call.
const PACKAGE = "(@?[a-z0-9][\\w.-]*(?:/[\\w.-]+)?)";

export function ruleIntent(sentence: string): RuleIntent | null {
  const s = sentence.trim().replace(/\.$/, "");
  const banned = new RegExp(`^(?:never|do\\s+not|don't)\\s+import\\s+(?:from\\s+)?(?:the\\s+)?${PACKAGE}(?:\\s+(?:package|library|module))?$`, "i").exec(s)
    ?? new RegExp(`^no\\s+${PACKAGE}\\s+imports?$`, "i").exec(s);
  if (banned) return { kind: "package-ban", name: banned[1]!.toLowerCase() };
  const part = "(?:\\s+(?:layer|code|modules?|files?|folder))?";
  const edge = new RegExp(`^(?:the\\s+)?([a-z][\\w-]*)${part}\\s+(?:must|should|may)\\s+not\\s+(?:import|depend\\s+on)\\s+(?:from\\s+)?(?:the\\s+)?([a-z][\\w-]*)${part}$`, "i").exec(s);
  if (edge) return { kind: "import-edge", from: edge[1]!.toLowerCase(), to: edge[2]!.toLowerCase() };
  const call = /^(?:(.+?)\s+(?:must|should|may)\s+not|never|do\s+not|don't)\s+(?:call|use)\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)(?:\(\))?(?:\s+directly)?$/i.exec(s);
  if (call) return { kind: "call-ban", callee: call[2]!, ...(call[1] ? { subject: call[1] } : {}) };
  return null;
}

// TypeScript drafts for a recognized shape: the pattern plus the cases that prove it (two fails, a
// trap, two passes). Other languages draft from --fail/--pass code instead.
export function intentDraft(intent: RuleIntent): IntentDraft {
  if (intent.kind === "import-edge") {
    const to = intent.to;
    return { area: "imports", files: `**/${intent.from}/**`, fix: `Depend on an interface owned by ${intent.from} and pass the ${to} implementation in from the composition root.`,
      patterns: [{ id: "import-edge", rule: specifierRule(`(^|/)${regexLiteral(to)}(/|$)`) }],
      cases: [
        { kind: "fail", name: "static-import", text: `import { db } from "../${to}/db";\nexport const read = db;\n`, note: "" },
        { kind: "fail", name: "re-export", text: `export * from "../${to}/repository";\n`, note: "" },
        { kind: "trap", name: "dynamic-import", text: `export async function load() {\n  return import("../${to}/db");\n}\n`, note: `A dynamic import reaches ${to} the same way.` },
        { kind: "pass", name: "sibling-import", text: `import { money } from "./money";\nexport const total = money(1);\n`, note: "" },
        { kind: "pass", name: "mentions-folder", text: `export const path = "../${to}/db";\n`, note: "" },
      ] };
  }
  if (intent.kind === "package-ban") return packageBanDraft(intent.name);
  const callee = intent.callee;
  return { area: "calls", fix: `Call the project's own wrapper instead of ${callee}.`,
    patterns: [{ id: "call", rule: { kind: "call_expression", has: { field: "function", regex: `(^|\\.)${regexLiteral(callee)}$` } } }],
    cases: [
      { kind: "fail", name: "in-function", text: `export async function load() {\n  return ${callee}("/orders");\n}\n`, note: "" },
      { kind: "fail", name: "arrow", text: `export const ping = () => ${callee}("/health");\n`, note: "" },
      { kind: "trap", name: "global-this", text: `export const viaGlobal = () => globalThis.${callee}("/x");\n`, note: `A call through globalThis is still ${callee}.` },
      { kind: "pass", name: "wrapper", text: `export const load = () => api.get("/orders");\n`, note: "" },
      { kind: "pass", name: "mentions-call", text: `export const note = "${callee}(url)";\n`, note: "" },
    ] };
}

function packageBanDraft(name: string): IntentDraft {
  return { area: "imports", fix: `Remove the ${name} import and use the replacement this project chose.`,
    patterns: [{ id: "package", rule: specifierRule(`^${regexLiteral(name)}(/|$)`) }],
    cases: [
      { kind: "fail", name: "default-import", text: `import lib from "${name}";\nexport const value = lib;\n`, note: "" },
      { kind: "fail", name: "subpath-re-export", text: `export * from "${name}/sub";\n`, note: "" },
      { kind: "trap", name: "dynamic-import", text: `export async function load() {\n  return import("${name}");\n}\n`, note: `A dynamic import loads ${name} the same way.` },
      { kind: "pass", name: "other-package", text: `import other from "${name}-extra";\nexport const value = other;\n`, note: "" },
      { kind: "pass", name: "mentions-name", text: `export const name = "${name}";\n`, note: "" },
    ] };
}

// How a written instruction can be carried out. `rule`: a shape the drafter knows, so it compiles
// with generated cases. `example`: it names something in code and forbids or requires it, so one
// failing and one passing snippet make it a rule. `prose`: guidance about judgment or about what the
// agent does, which no check on a file can decide. A text heuristic; the review shows every choice.
export type StatementKind = "rule" | "example" | "prose";
const MODAL = /\b(never|must|do\s+not|don't|no|avoid|always|only|forbidden|prohibited|required?|should|shall)\b/i;
const CODE_NOUN = /`[^`]+`|[A-Za-z_$][\w$]*\(\)|\.[cm]?[jt]sx?\b|\b(imports?|exports?|calls?|functions?|class(?:es)?|components?|modules?|packages?|librar(?:y|ies)|hooks?|types?|interfaces?|enums?|any|async|await|catch|throw|console|fetch|quer(?:y|ies)|sql|endpoints?|folders?|layers?|mocks?|default export)\b/i;
const AGENT_ACTION = /^(?:always\s+|never\s+|please\s+|you\s+(?:must|should)\s+)?(?:run|commit|push|ask|tell|explain|read|review|plan|think|confirm|check|update|document|summari[sz]e|report)\b/i;

export function statementKind(statement: string): StatementKind {
  if (ruleIntent(statement) !== null) return "rule";
  return MODAL.test(statement) && CODE_NOUN.test(statement) && !AGENT_ACTION.test(statement.trim()) ? "example" : "prose";
}

// Cases from the user's own code: as given, plus variants until a check has two fails, a trap and
// two passes. A pass that only mentions the bad code in a string proves the rule reads syntax.
export function snippetCases(fails: string[], passes: string[], language: RuleLanguage): DraftSample[] {
  const python = language === "python";
  const line = (code: string) => code.endsWith("\n") ? code : `${code}\n`;
  const extraFail = fails.length < 2 ? [`${python ? "before = 1" : "export const before = 1;"}\n${line(fails[0]!)}`] : [];
  const mention = `${python ? "note = " : "export const note = "}${JSON.stringify(fails[0]!.split("\n")[0])}${python ? "" : ";"}\n`;
  const passCases = [...passes.map(line), mention, python ? "unrelated = 1\n" : "export const unrelated = 1;\n"].slice(0, Math.max(2, passes.length));
  return [
    ...[...fails.map(line), ...extraFail].map((text, i): DraftSample => ({ kind: "fail", name: `fail-${i + 1}`, text, note: "" })),
    { kind: "trap", name: "nested", ...nestedCase(fails[0]!, python) },
    ...passCases.map((text, i): DraftSample => ({ kind: "pass", name: `pass-${i + 1}`, text, note: "" })),
  ];
}

function nestedCase(code: string, python: boolean): { text: string; note: string } {
  const body = code.trimEnd().split("\n");
  if (python) return { text: `def outer():\n    def inner():\n${body.map((l) => `        ${l}`).join("\n")}\n    return inner\n`, note: "The same code nested in a function must still fail." };
  if (/^\s*(import|export)\b/.test(code)) return { text: `export const first = 1;\nexport const second = 2;\n${body.join("\n")}\n`, note: "The same statement after other declarations must still fail." };
  return { text: `export function outer() {\n  return () => {\n${body.map((l) => `    ${l}`).join("\n")}\n  };\n}\n`, note: "The same code nested in a callback must still fail." };
}

// A check name from the sentence's first content words.
export function ruleSlug(sentence: string): string {
  const slug = ruleTokens(sentence, true).slice(0, 4).join("-");
  return slug === "" ? "rule" : slug;
}
