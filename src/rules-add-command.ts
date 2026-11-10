import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyPreset } from "./approval-command.ts";
import { packCatalog } from "./compile.ts";
import { canonical, readTree } from "./disk.ts";
import { enforcementOf } from "./enforcement.ts";
import { testCheck } from "./fixtures.ts";
import { clock, LOCK, PRESET, readText } from "./gate.ts";
import { grammarOf, ruleLanguages } from "./languages.ts";
import { librarySource, librarySources } from "./library.ts";
import { matches } from "./paths.ts";
import { addInvariant } from "./pack-compose.ts";
import { type CatalogEntry, catalogMatches, draftCase, draftCheckDir, draftExamples, draftRule, type DraftSample, fixtureTarget, intentDraft,
  ruleIntent, ruleSlug, ruleTokens, snippetCases, statementKind } from "./pack-template.ts";
import { documentationStatements } from "./project-discovery.ts";
import { languageOf, sampleLines, stagePack, synthesize } from "./rules-draft-command.ts";
import type { Check, Files, Lock, Manifest, MatchRule, PatternConfig, Preset, RuleLanguage } from "./types.ts";
import { workspacePaths } from "./workspace.ts";

// `pregate rules add "<sentence>"`: the shortest path from a team rule to one reviewed change. A
// bundled catalog rule that says the same is selected; otherwise a check with generated fixtures is
// drafted into the project's own pack. Nothing is written before the human approves the review.

type Result = { code: number; text: string };
type Request = { sentence: string; fails: string[]; passes: string[]; files?: string; rule?: string; draft: boolean };
type Entry = CatalogEntry & { manifest: Manifest };
type Shape = { language: RuleLanguage; area: string; files?: string; except?: string[]; fix: string; patterns: PatternConfig[]; cases: DraftSample[]; notes: string[] };

export const ADD_USAGE = "usage: pregate rules add \"<sentence>\" [--fail <code>]... [--pass <code>]... [--files <glob>] [--rule <ns/ID>] [--draft]";
const PROJECT_DIR = ".pregate/packs/project";

export async function rulesAdd(args: string[], root: string | null): Promise<Result> {
  if (args.includes("--yes")) return { code: 1, text: "rules add only prepares a review; the human approves it with pregate approve <code>. Nothing staged." };
  const request = parseAdd(args);
  if (request === null) return { code: 1, text: ADD_USAGE };
  if (root === null || !existsSync(join(root, PRESET))) return { code: 1, text: "Set up PREGATE first: pregate guide --preview --enforcement advisor" };
  const languages = new Set(workspacePaths(root, (rel) => grammarOf(rel) !== null).map(languageOf).filter((l) => l !== null));
  if (!request.draft) {
    const matched = await fromCatalog(root, request, catalogEntries(languages));
    if (matched !== null) return matched;
  }
  return drafted(root, request, languages);
}

function parseAdd(args: string[]): Request | null {
  const operands: string[] = [], values = new Map<string, string[]>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--draft") values.set(arg, []);
    else if (["--fail", "--pass", "--files", "--rule"].includes(arg)) values.set(arg, [...values.get(arg) ?? [], args[++i] ?? "--"]);
    else operands.push(arg);
  }
  const [fails, passes] = [values.get("--fail") ?? [], values.get("--pass") ?? []];
  const single = ["--files", "--rule"].map((flag) => values.get(flag) ?? []);
  if (operands.length !== 1 || operands[0]!.startsWith("-") || operands[0]!.trim() === "" || single.some((v) => v.length > 1)
    || [...fails, ...passes, ...single.flat()].some((v) => v.startsWith("--")) || (passes.length > 0 && fails.length === 0)) return null;
  return { sentence: operands[0]!.trim(), fails, passes, files: single[0]![0], rule: single[1]![0], draft: values.has("--draft") };
}

// Every bundled invariant whose check reads a language this project has. Project verification
// (fitness) rules are left out: a sentence asks for a rule that fires on code.
function catalogEntries(languages: Set<RuleLanguage>): Entry[] {
  const entries = new Map<string, Entry>();
  const all = librarySources().flatMap((pin) => {
    const catalog = packCatalog(librarySource(pin.ns)!);
    return "errors" in catalog ? [] : catalog.methodologies.flatMap((manifest) => manifest.invariants.map((alias) =>
      ({ fqn: `${pin.ns}/${alias.id}`, methodology: manifest.id, alias, manifest, check: catalog.checks.find((c) => c.id === alias.check) })));
  });
  for (const entry of all) if (entry.check !== undefined && readsProject(entry.check, languages) && !entries.has(entry.fqn)) entries.set(entry.fqn, entry as Entry);
  return [...entries.values()];
}

function readsProject(check: Check, languages: Set<RuleLanguage>): boolean {
  const langs = ruleLanguages(check);
  return langs.length > 0 && (languages.size === 0 || langs.some((l) => languages.has(l)));
}

async function fromCatalog(root: string, request: Request, entries: Entry[]): Promise<Result | null> {
  const matches = request.rule === undefined ? catalogMatches(request.sentence, entries) : entries.filter((e) => e.fqn === request.rule);
  if (request.rule !== undefined && matches.length === 0) return { code: 1, text: `No bundled rule ${request.rule} for this project's languages. Use pregate pack show --library <ns>.` };
  const [match, ...others] = matches;
  if (match === undefined) return null;
  const lock = JSON.parse(readText(join(root, LOCK)) ?? "null") as Lock | null;
  const active = lock?.rules.find((r) => r.id === match.fqn);
  if (lock !== null && active !== undefined) return { code: 0, text: `Already enforced by ${match.fqn} (${enforcementOf(lock, active)} mode); nothing to change.` };
  const candidate = catalogCandidate(JSON.parse(readFileSync(join(root, PRESET), "utf8")) as Preset, match, request.files);
  if ("errors" in candidate) return { code: 1, text: [...candidate.errors, "Nothing staged."].join("\n") };
  const review = await applyPreset(root, JSON.stringify(candidate.preset, null, 2) + "\n", { preview: true, stable: true });
  return { code: review.code, text: [`Matched catalog rule ${match.fqn} (${match.methodology}): ${match.alias.source.paraphrase}`, ...candidate.notes,
    ...others.slice(0, 2).map((o) => `Also close: ${o.fqn}; choose it with --rule ${o.fqn}.`),
    "Not this rule? Draft a project rule instead with --draft.", review.text].join("\n") };
}

// The preset with the matched invariant on: its bundled pin added when missing, and --files as the
// rule's paths unless the check already scopes itself.
function catalogCandidate(input: Preset, match: Entry, files?: string): { preset: Preset; notes: string[] } | { errors: string[] } {
  const ns = match.fqn.split("/")[0]!;
  const pin = librarySources().find((s) => s.ns === ns)!;
  const registered = input.sources.find((s) => s.ns === ns);
  if (registered !== undefined && (registered.kind !== "library" || registered.version !== pin.version)) return { errors: [`Namespace ${ns} is registered with another pin; review pregate update --project --preview first.`] };
  const preset = addInvariant(registered === undefined ? { ...input, sources: [...input.sources, pin] } : input, match.manifest, match.alias.id);
  if ("errors" in preset || files === undefined) return "errors" in preset ? preset : { preset, notes: [] };
  const scoped = match.check.impl.kind === "pattern" ? Object.values(match.check.impl.patterns)[0]?.[0]?.files : undefined;
  if (scoped !== undefined) return { preset, notes: [`${match.fqn} already scopes itself to ${scoped.join(", ")}; --files is not applied.`] };
  const overrides = preset.overrides ??= {};
  const key = Object.hasOwn(overrides, match.alias.id) ? match.alias.id : match.fqn;
  const before = overrides[key];
  const policy = typeof before === "object" ? before : typeof before === "string" ? { severity: before } : {};
  overrides[key] = { ...policy, params: { ...policy.params, paths: [files] } };
  return { preset, notes: [`Scoped to ${files}.`] };
}

function drafted(root: string, request: Request, languages: Set<RuleLanguage>): Result {
  const presetText = readFileSync(join(root, PRESET), "utf8");
  const dir = canonical(join(root, PROJECT_DIR));
  const registered = projectSource(root, presetText, dir);
  if (typeof registered === "string") return { code: 1, text: registered };
  const shape = draftShape(root, request, languages);
  if (typeof shape === "string") return { code: 1, text: shape };
  const before = registered ? readTree(dir, true) : {};
  const draft = draftFiles(before, request.sentence, shape);
  if (typeof draft === "string") return { code: 1, text: draft };
  const review = stagePack(root, { dir, before, after: draft.files, preset: withProjectPack(presetText) });
  if (review.code !== 0) return review;
  return { code: 0, text: [`No catalog rule says this; drafted project rule ${draft.id} in ${PROJECT_DIR}. Its generated cases pass.`,
    ...shape.notes, `Pattern: ${shape.patterns.map((p) => JSON.stringify(p.rule)).join(" | ")}`, review.text].join("\n") };
}

// The project's own pack is `.pregate/packs/project`, registered as namespace `project`. A folder
// there that the contract does not name is unreviewed and never adopted silently.
function projectSource(root: string, presetText: string, dir: string): boolean | string {
  const source = (JSON.parse(presetText) as Preset).sources.find((s) => s.ns === "project");
  if (source !== undefined && (source.kind !== "path" || canonical(resolve(root, source.path)) !== dir)) {
    return "Namespace project is registered at another source; draft into it with pregate rules draft <pack-dir> <area>/<name>.";
  }
  if (source === undefined && existsSync(dir)) return `${PROJECT_DIR} exists but is not a registered rule source; review it first with pregate pack add --path ${PROJECT_DIR} --preview.`;
  return source !== undefined;
}

function withProjectPack(presetText: string): string {
  const preset = JSON.parse(presetText) as Preset;
  if (preset.sources.some((s) => s.ns === "project") && preset.methodologies.includes("project/corrections")) return presetText;
  if (!preset.sources.some((s) => s.ns === "project")) preset.sources.push({ ns: "project", kind: "path", path: PROJECT_DIR });
  if (!preset.methodologies.includes("project/corrections")) preset.methodologies.push("project/corrections");
  return JSON.stringify(preset, null, 2) + "\n";
}

// What to draft: the user's code when given, else a recognized sentence shape (TypeScript first).
function draftShape(root: string, request: Request, languages: Set<RuleLanguage>): Shape | string {
  const language = (request.files === undefined ? null : languageOf(fixtureTarget(request.files, "rule.ts")))
    ?? (languages.has("typescript") || !languages.size ? "typescript" : [...languages][0]!);
  if (request.fails.length > 0) return snippetShape(request, language);
  const intent = ruleIntent(request.sentence);
  if (intent === null || language !== "typescript") {
    return `No catalog rule or recognizable ${language === "typescript" ? "" : `${language} `}shape in "${request.sentence}"; add --fail "<bad code>" and --pass "<good code>". Nothing staged.`;
  }
  const draft = intentDraft(intent);
  const folder = intent.kind === "import-edge" ? intent.from : intent.kind === "call-ban" ? intent.subject?.toLowerCase().split(/\s+/).at(-1) : undefined;
  const exists = folder !== undefined && workspacePaths(root, (rel) => rel.split("/").slice(0, -1).includes(folder)).length > 0;
  const files = request.files ?? (exists ? `**/${folder}/**` : undefined);
  const notes = request.files !== undefined || folder === undefined || exists ? [] : [`No folder named ${folder} here, so the rule covers every file in scope; narrow it with --files <glob>.`];
  return { language, ...draft, files, notes };
}

function snippetShape(request: Request, language: RuleLanguage): Shape | string {
  const cases = snippetCases(request.fails, request.passes, language);
  const name = ruleSlug(request.sentence);
  const sample = (c: DraftSample) => ({ rel: caseTarget(request.files, c, language), text: c.text });
  const patterns = synthesize({ must: cases.filter((c) => c.kind !== "pass").map(sample), passes: cases.filter((c) => c.kind === "pass").map(sample),
    hint: ruleTokens(request.sentence, true) }, language, name);
  if (typeof patterns === "string") return `${patterns.replace("; supply --pattern <rule.json>.", ".")} Give a --pass that differs in the call or import, or use pregate rules draft with --pattern. Nothing staged.`;
  return { language, area: "rules", files: request.files, fix: `Follow the project rule: ${request.sentence}`, patterns, cases, notes: [] };
}

// A generated case sits where the rule looks: under --files, or src/ by default.
function caseTarget(files: string | undefined, c: DraftSample, language: RuleLanguage): string {
  return fixtureTarget(files ?? "src/**", `${c.name}.${language === "python" ? "py" : "ts"}`);
}

function draftFiles(before: Files, sentence: string, shape: Shape): { files: Files; id: string } | string {
  let name = ruleSlug(sentence);
  for (let n = 2; before[`${draftCheckDir(shape.area, name)}/check.json`] !== undefined; n++) name = `${ruleSlug(sentence)}-${n}`;
  const patterns = shape.patterns.map((p) => ({ ...p, ...(shape.files === undefined ? {} : { files: [shape.files] }), ...(shape.except?.length ? { ignores: shape.except } : {}) }));
  const rule = draftRule(before, { ns: "project", area: shape.area, name, language: shape.language, patterns, message: sentence, why: `Project rule: ${sentence}`, fix: shape.fix });
  if (typeof rule === "string") return rule;
  const id = `project/${shape.area}/${name}`, dir = draftCheckDir(shape.area, name);
  let files: Files = { ...before, ...rule };
  const check = JSON.parse(files[`${dir}/check.json`]!) as Check;
  const today = new Date().toISOString().slice(0, 10);
  for (const c of shape.cases) {
    const target = caseTarget(c.at ?? shape.files, c, shape.language);
    const lines = sampleLines(check, shape.language, { rel: target, text: c.text });
    if (typeof lines === "string") return `Cannot evaluate the generated case ${c.kind}/${c.name}: ${lines}. Nothing staged.`;
    files = { ...files, ...draftCase(files, dir, shape.language, { kind: c.kind, target, text: c.text, lines, note: c.note, today }) };
  }
  Object.assign(files, draftExamples(files, id, dir));
  const tested = testCheck(files, id, clock);
  if (!tested.lines.every((line) => line.startsWith("ok"))) return [...tested.lines, "The drafted rule does not pass its own cases. Nothing staged; give clearer --fail and --pass code."].join("\n");
  return { files, id };
}

// `pregate compile <rules.md>`: read an instruction file (AGENTS.md, CLAUDE.md) as a list of
// statements and say what each can become. A statement with a known shape or a bundled rule that
// says the same compiles now; one that names code needs an example; guidance stays in the file.
// With --preview every compilable statement goes into one digest-bound review. The file is never
// edited: after approval the report names the lines a person may delete.

export const COMPILE_USAGE = "usage: pregate compile <rules.md> [--json|--template|--preview] | compile apply <proposals.json> --preview";
type Statement = { line: number; statement: string };
type Compiled = Statement & { kind: "catalog" | "draft" | "active" | "example" | "prose"; sentence: string; rule?: string; note: string;
  entry?: Entry; shape?: Shape };
type Sources = { root: string | null; home: string; lock: Lock | null; entries: Entry[]; languages: Set<RuleLanguage>; project: Files };

export async function rulesCompile(args: string[], root: string | null, cwd = process.cwd()): Promise<Result> {
  if (args[0] === "apply") return compileApply(args.slice(1), root, cwd);
  const flags = args.filter((a) => a.startsWith("--")), operands = args.filter((a) => !a.startsWith("--"));
  if (operands.length !== 1 || flags.length > 1 || flags.some((f) => !["--json", "--preview", "--template"].includes(f))) return { code: 1, text: COMPILE_USAGE };
  const file = resolve(cwd, operands[0]!);
  if (!existsSync(file) || !statSync(file).isFile()) return { code: 1, text: `No file ${operands[0]}. ${COMPILE_USAGE}` };
  const text = readFileSync(file, "utf8");
  const sources = compileSources(root, cwd);
  const items = documentationStatements(text).filter((s) => s.statement.length >= 8 && !s.statement.startsWith("|")).map((s) => compiled(s, sources));
  const preview = flags[0] === "--preview";
  if (preview && root === null) return { code: 1, text: [compileText(operands[0]!, text, items), "Set up PREGATE first: pregate guide --preview --enforcement advisor. Then run this preview again."].join("\n") };
  const review = preview ? await stageCompiled(root!, items) : null;
  if (flags[0] === "--json") return { code: 0, text: JSON.stringify(compileJson(operands[0]!, text, items), null, 2) };
  if (flags[0] === "--template") return { code: 0, text: JSON.stringify(compileTemplate(operands[0]!, items), null, 2) };
  return { code: review?.code ?? 0, text: [compileText(operands[0]!, text, items), ...(review === null ? [] : [review.text])].join("\n") };
}

function compileSources(root: string | null, cwd: string): Sources {
  const home = root ?? canonical(cwd);
  const languages = new Set(workspacePaths(home, (rel) => grammarOf(rel) !== null).map(languageOf).filter((l) => l !== null));
  const dir = join(home, PROJECT_DIR);
  return { root, home, languages, entries: catalogEntries(languages), project: existsSync(dir) ? readTree(canonical(dir), true) : {},
    lock: root === null ? null : JSON.parse(readText(join(root, LOCK)) ?? "null") as Lock | null };
}

// Markdown emphasis and code marks are not part of the sentence. The whole statement is tried
// first, then its first clause: "Never use moment; use date-fns." states its rule before the `;`.
function sentencesOf(statement: string): string[] {
  const clean = statement.replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
  const first = clean.split(/[.;:]\s+|\s+[\u2014\u2013-]\s+|\s+\(/)[0]!.trim();
  return first === clean || first.length < 8 ? [clean] : [clean, first];
}

function compiled(s: Statement, sources: Sources): Compiled {
  for (const sentence of sentencesOf(s.statement)) {
    // A sentence typed for `rules add` is one reviewed match. Here many lines match unattended, so a
    // bundled rule needs three content words in common, and the review quotes what that rule says.
    const match = ruleTokens(sentence, true).length >= 3 ? catalogMatches(sentence, sources.entries)[0] : undefined;
    if (match !== undefined) {
      const active = sources.lock?.rules.find((r) => r.id === match.fqn);
      return active !== undefined && sources.lock !== null ? { ...s, sentence, kind: "active", rule: match.fqn, note: `already in the contract (${enforcementOf(sources.lock, active)})` }
        : { ...s, sentence, kind: "catalog", rule: match.fqn, entry: match, note: `bundled rule ${match.fqn}: ${JSON.stringify(clipped(match.alias.source.paraphrase))}` };
    }
    const shape = draftShape(sources.home, { sentence, fails: [], passes: [], draft: true }, sources.languages);
    if (typeof shape === "string") continue;
    const id = `project/${shape.area}/${ruleSlug(sentence)}`;
    return sources.project[`${draftCheckDir(shape.area, ruleSlug(sentence))}/check.json`] !== undefined ? { ...s, sentence, kind: "active", rule: id, note: "already a project rule" }
      : { ...s, sentence, kind: "draft", rule: id, shape, note: `project rule: ${checked(sentence)}${shape.files ? ` in ${shape.files}` : ""}; cases generated` };
  }
  const kind = statementKind(s.statement) === "prose" ? "prose" : "example";
  return { ...s, sentence: sentencesOf(s.statement)[0]!, kind, note: kind === "example" ? "names code; add one failing and one passing snippet" : "guidance or an agent action; no check on a file decides it" };
}

// What the drafted pattern looks for, in the reader's words.
function checked(sentence: string): string {
  const intent = ruleIntent(sentence);
  return intent === null ? "the given code" : intent.kind === "import-edge" ? `no import of ${intent.to} from ${intent.from}`
    : intent.kind === "package-ban" ? `no import of the package ${intent.name}` : `no call to ${intent.callee}`;
}

const TOKEN_CHARS = 4;   // a common rough estimate for English prose; the report says so

function compileJson(file: string, text: string, items: Compiled[]) {
  const executable = items.filter((i) => ["catalog", "draft", "active"].includes(i.kind));
  const tokens = (chars: number) => Math.round(chars / TOKEN_CHARS);
  return { schemaVersion: 1, file, statements: items.map((i) => ({ line: i.line, statement: i.statement, kind: i.kind, sentence: i.sentence, ...(i.rule ? { rule: i.rule } : {}), note: i.note })),
    counts: { statements: items.length, rules: executable.length, needExample: items.filter((i) => i.kind === "example").length, stay: items.filter((i) => i.kind === "prose").length },
    tokens: { file: tokens(text.length), compilable: tokens(executable.reduce((n, i) => n + i.statement.length, 0)), estimate: `${TOKEN_CHARS} characters per token` },
    removableLines: executable.map((i) => i.line) };
}

function compileText(file: string, text: string, items: Compiled[]): string {
  const json = compileJson(file, text, items);
  const rows = (kinds: Compiled["kind"][], render: (i: Compiled) => string) => items.filter((i) => kinds.includes(i.kind)).map((i) => `  L${i.line} ${JSON.stringify(clipped(i.statement))} -> ${render(i)}`);
  const share = json.tokens.file === 0 ? 0 : Math.round(100 * json.tokens.compilable / json.tokens.file);
  return [`Compile ${file}: ${items.length} statement${items.length === 1 ? "" : "s"}. The classification is a text heuristic; review each line.`,
    `Rules (${json.counts.rules}):`, ...rows(["catalog", "draft", "active"], (i) => i.note),
    `Need one example each (${json.counts.needExample}):`, ...rows(["example"], (i) => `pregate rules add ${JSON.stringify(i.sentence)} --fail "<bad code>" --pass "<good code>"`),
    `Stay in ${file} (${json.counts.stay}):`, ...rows(["prose"], (i) => i.note),
    json.counts.rules === 0 ? "No statement compiles yet." : `${json.counts.rules} of ${items.length} statements run as rules. ${items.some((i) => i.kind === "catalog" || i.kind === "draft") ? "Once they are approved," : "They are in the contract, so"} lines ${json.removableLines.join(", ")} can leave ${file}: about ${json.tokens.compilable} of its ${json.tokens.file} tokens (${share}%) stop loading in every session. Estimate: ${TOKEN_CHARS} characters per token.`,
    ...(items.some((i) => i.kind === "catalog" || i.kind === "draft") ? [`One review for the new rules: pregate compile ${file} --preview`] : []),
  ].join("\n");
}

// The proposals file an agent completes for `compile apply`: every statement that did not compile
// by itself, with the steps to turn the checkable ones into rules. Reading prose is the agent's
// part; proving each rule against its cases is the engine's.
const TEMPLATE_STEPS = [
  "Keep a statement only when a check on one source file can decide it: a forbidden import, call, syntax or name. Delete every other entry; that text stays in the instruction file.",
  "sentence: the rule as one short imperative sentence. It becomes the message the agent sees.",
  "fail: one or more snippets the rule must reject, written the way this project writes that mistake.",
  "pass: the correct way to write it, and one more snippet that looks similar but is allowed. Similar allowed code is what stops a rule from matching too much.",
  "files: one glob, only when the rule applies to part of the tree.",
  "except: a list of globs, only when the statement names a place where the code is allowed (\"only inside src/lib/ai\"). The engine proves it: the failing code placed there must pass.",
  "pattern: optional AST match rule, for when the engine answers that it cannot infer one. Examples: {\"kind\": \"call_expression\", \"has\": {\"field\": \"function\", \"regex\": \"(^|\\\\.)fetch$\"}} and {\"kind\": \"binary_expression\", \"regex\": \"^Math\\\\.round\\\\(.*\\\\* 100\\\\) / 100$\"}.",
  "rule: instead of sentence, fail and pass, the id of a bundled rule to switch on (pregate pack list --library).",
  "Then run pregate compile apply <this file> --preview. A refused proposal names the reason: correct it and run again. Only the human approves the review.",
];

function compileTemplate(file: string, items: Compiled[]) {
  return { file, steps: TEMPLATE_STEPS, rules: items.filter((i) => i.kind === "example" || i.kind === "prose")
    .map((i) => ({ line: i.line, statement: i.statement, hint: i.kind === "example" ? "names code" : "reads as guidance", sentence: "", fail: [], pass: [] })) };
}

function clipped(text: string): string { return text.length > 90 ? `${text.slice(0, 87)}...` : text; }

// Every compilable statement in one proposal: bundled rules switched on in the preset, drafted
// rules added to the project pack. A statement that cannot be staged is named, and the rest proceed.
async function stageCompiled(root: string, items: Compiled[]): Promise<Result> {
  const presetText = readFileSync(join(root, PRESET), "utf8"), skipped: string[] = [];
  let preset = JSON.parse(presetText) as Preset;
  for (const item of items.filter((i) => i.kind === "catalog")) {
    const candidate = catalogCandidate(preset, item.entry!);
    if ("errors" in candidate) skipped.push(`L${item.line}: ${candidate.errors.join(" ")}`); else preset = candidate.preset;
  }
  const drafts = items.filter((i) => i.kind === "draft"), dir = canonical(join(root, PROJECT_DIR));
  const registered = drafts.length === 0 ? false : projectSource(root, presetText, dir);
  if (typeof registered === "string") return { code: 1, text: `${registered} Nothing staged.` };
  const before = registered ? readTree(dir, true) : {};
  let files = before;
  for (const item of drafts) {
    const draft = draftFiles(files, item.sentence, item.shape!);
    if (typeof draft === "string") skipped.push(`L${item.line}: ${draft.split("\n").at(-1)}`); else files = draft.files;
  }
  const next = JSON.stringify(preset, null, 2) + "\n";
  if (files === before && next === JSON.stringify(JSON.parse(presetText), null, 2) + "\n") return { code: 0, text: ["Nothing new to stage.", ...skipped.map((line) => `Not staged, ${line}`)].join("\n") };
  const review = files === before ? await applyPreset(root, next, { preview: true, stable: true })
    : stagePack(root, { dir, before, after: files, preset: withProjectPack(next) });
  return { code: review.code, text: [...skipped.map((line) => `Not staged, ${line}`), review.text].join("\n") };
}

// `pregate compile apply <proposals.json> --preview`: real instruction files are paragraphs, not
// sentence shapes, so the agent that can read them proposes the rules. Each proposal is one
// statement's line, a short sentence, and code that must fail and code that must pass (or the id of
// a bundled rule). The engine synthesizes the pattern, generates the remaining cases and stages only
// the rules that pass their own cases, in one review. A proposal it cannot verify is named and
// left out; nothing an agent writes here reaches the contract without that proof and the human.
const PROPOSALS_FORMAT = '{"file": "AGENTS.md", "rules": [{"line": 12, "sentence": "Route handlers must not call the database client directly", "fail": ["<bad code>"], "pass": ["<good code>"], "files": "src/app/api/**"}, {"line": 30, "rule": "architecture/HEX-EDGE-001"}]}';
type Proposed = { line: number; sentence: string; fail: string[]; pass: string[]; files?: string; except?: string[]; rule?: string; pattern?: MatchRule };

async function compileApply(args: string[], root: string | null, cwd: string): Promise<Result> {
  if (args.length !== 2 || args[1] !== "--preview" || args[0]!.startsWith("-")) return { code: 1, text: `compile apply only prepares a review; the human approves it.\n${COMPILE_USAGE}` };
  if (root === null) return { code: 1, text: "Set up PREGATE first: pregate guide --preview --enforcement advisor" };
  const path = resolve(cwd, args[0]!);
  if (!existsSync(path) || !statSync(path).isFile()) return { code: 1, text: `No file ${args[0]}. Format: ${PROPOSALS_FORMAT}` };
  const proposals = proposedRules(readFileSync(path, "utf8"));
  if (typeof proposals === "string") return { code: 1, text: `${proposals} Nothing staged. Format: ${PROPOSALS_FORMAT}` };
  const sources = compileSources(root, cwd), refused: string[] = [];
  const items = proposals.rules.flatMap((p): Compiled[] => {
    const item = proposedItem(p, sources);
    if (typeof item === "string") { refused.push(`Not staged, L${p.line}: ${item}`); return []; }
    return [item];
  });
  const review = items.some((i) => i.kind !== "active") ? await stageCompiled(root, items) : { code: refused.length ? 1 : 0, text: "Nothing new to stage." };
  const staged = items.filter((i) => i.kind !== "active" && !review.text.includes(`Not staged, L${i.line}:`));
  const active = items.filter((i) => i.kind === "active").length;
  return { code: review.code, text: [
    `Proposed rules for ${proposals.file}: ${proposals.rules.length}; ${staged.length} verified and staged, ${active} already in the contract, ${proposals.rules.length - staged.length - active} refused.`,
    ...items.map((i) => `  L${i.line} ${JSON.stringify(clipped(i.sentence))} -> ${i.note}`), ...refused,
    ...(staged.length ? [`Once approved, lines ${staged.map((i) => i.line).join(", ")} can leave ${proposals.file}.`] : []), review.text].join("\n") };
}

// The agent's file is data. Shape errors are named; the cases still have to prove each rule.
function proposedRules(text: string): { file: string; rules: Proposed[] } | string {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch (e) { if (e instanceof SyntaxError) return `The proposals file is not JSON: ${e.message}.`; throw e; }
  const { file, rules: listed } = (value ?? {}) as { file?: unknown; rules?: unknown };
  if (typeof file !== "string" || file === "") return "The proposals need file: the instruction file they come from.";
  // A template entry the agent left blank is a statement it judged not checkable: it stays in the file.
  const blank = (raw: Record<string, unknown> | null) => raw !== null && typeof raw === "object" && raw.rule === undefined && raw.sentence === "" && Array.isArray(raw.fail) && raw.fail.length === 0;
  const rules = Array.isArray(listed) ? (listed as (Record<string, unknown> | null)[]).filter((raw) => !blank(raw)) : listed;
  if (!Array.isArray(rules) || rules.length === 0) return "The proposals need rules: a list with at least one completed rule.";
  const strings = (list: unknown) => Array.isArray(list) && list.every((code) => typeof code === "string" && code.trim() !== "");
  for (const [i, raw] of (rules as Record<string, unknown>[]).entries()) {
    const at = `Rule ${i + 1}`;
    if (typeof raw !== "object" || raw === null || !Number.isInteger(raw.line) || (raw.line as number) < 1) return `${at} needs line: the statement's line in ${file}.`;
    if (raw.rule !== undefined) { if (typeof raw.rule !== "string" || !raw.rule.includes("/")) return `${at}: rule is a bundled rule id such as architecture/HEX-EDGE-001.`; continue; }
    if (typeof raw.sentence !== "string" || raw.sentence.trim().length < 8) return `${at} needs sentence: the rule in one short sentence.`;
    if (!strings(raw.fail) || (raw.fail as string[]).length === 0) return `${at} needs fail: at least one snippet of code the rule must reject.`;
    if (!strings(raw.pass) || (raw.pass as string[]).length === 0) return `${at} needs pass: at least one snippet of code the rule must accept.`;
    if (raw.files !== undefined && (typeof raw.files !== "string" || raw.files === "")) return `${at}: files is one glob.`;
    if (raw.pattern !== undefined && (typeof raw.pattern !== "object" || raw.pattern === null || Array.isArray(raw.pattern))) return `${at}: pattern is one AST match rule object, such as {"kind": "call_expression", "has": {"field": "function", "regex": "^fetch$"}}.`;
    if (raw.except !== undefined && (!strings(raw.except) || (raw.except as string[]).length === 0)) return `${at}: except is a list of globs where the statement allows the code.`;
  }
  return { file, rules: (rules as Partial<Proposed>[]).map((r) => ({ line: r.line!, sentence: (r.sentence ?? r.rule ?? "").trim(), fail: r.fail ?? [], pass: r.pass ?? [], files: r.files, except: r.except, rule: r.rule, pattern: r.pattern })) };
}

// The agent may write the pattern itself; the generated cases (the code after other declarations,
// nested in a callback, mentioned in a string) still have to agree with it.
function proposedShape(p: Proposed, sources: Sources): Shape | string {
  const shape = shapeOf(p, sources);
  if (typeof shape === "string" || p.except === undefined) return shape;
  const paths = workspacePaths(sources.home, () => true);
  const empty = p.except.filter((glob) => !paths.some((rel) => matches(glob, rel)));
  if (empty.length) return `except matches no file: ${empty.join(", ")}. An exception names where the statement allows the code; correct the glob.`;
  // The exception is proved the way the rule is: the failing code, placed where it is allowed, must pass.
  const allowed = p.except.map((glob, i): DraftSample => ({ kind: "pass", name: `allowed-${i + 1}`, text: p.fail[0]!.endsWith("\n") ? p.fail[0]! : `${p.fail[0]}\n`, note: "", at: glob }));
  return { ...shape, except: p.except, cases: [...shape.cases, ...allowed] };
}

function shapeOf(p: Proposed, sources: Sources): Shape | string {
  if (p.pattern === undefined) {
    const shape = draftShape(sources.home, { sentence: p.sentence, fails: p.fail, passes: p.pass, files: p.files, draft: true }, sources.languages);
    if (typeof shape === "string") return shape.replace(" Nothing staged.", "").replace("use pregate rules draft with --pattern", "add a pattern to this proposal");
    return exampleText(shape.patterns, p.fail) ? "the engine could only match the literal text of the example, so the rule would miss the same mistake written another way. Add a pattern (an AST match rule) to this proposal." : shape;
  }
  const language = (p.files === undefined ? null : languageOf(fixtureTarget(p.files, "rule.ts"))) ?? (sources.languages.has("typescript") || !sources.languages.size ? "typescript" : [...sources.languages][0]!);
  return { language, area: "rules", files: p.files, fix: `Follow the project rule: ${p.sentence}`, patterns: [{ id: ruleSlug(p.sentence), rule: p.pattern }],
    cases: snippetCases(p.fail, p.pass, language), notes: [] };
}

// A synthesized pattern that is one of the example's own lines, anchored: the last resort of the
// synthesizer. It passes its cases and matches nothing else.
function exampleText(patterns: PatternConfig[], fails: string[]): boolean {
  const lines = fails.flatMap((code) => code.split("\n").map((line) => line.trim()).filter((line) => line.length >= 12));
  return patterns.some((pattern) => {
    const regex = (pattern.rule.regex ?? "").replaceAll("\\", "");
    return pattern.rule.has === undefined && lines.some((line) => regex.includes(line.slice(0, 24)));
  });
}

function proposedItem(p: Proposed, sources: Sources): Compiled | string {
  const base = { line: p.line, statement: p.sentence, sentence: p.sentence };
  if (p.rule !== undefined) {
    const entry = sources.entries.find((e) => e.fqn === p.rule);
    if (entry === undefined) return `no bundled rule ${p.rule} for this project's languages.`;
    return sources.lock?.rules.some((r) => r.id === p.rule) ? { ...base, kind: "active", rule: p.rule, note: "already in the contract" }
      : { ...base, kind: "catalog", rule: p.rule, entry, note: `bundled rule ${p.rule}: ${JSON.stringify(clipped(entry.alias.source.paraphrase))}` };
  }
  const shape = proposedShape(p, sources);
  if (typeof shape === "string") return shape;
  const id = `project/${shape.area}/${ruleSlug(p.sentence)}`;
  if (sources.project[`${draftCheckDir(shape.area, ruleSlug(p.sentence))}/check.json`] !== undefined) return { ...base, kind: "active", rule: id, note: "already a project rule" };
  return { ...base, kind: "draft", rule: id, shape, note: `project rule ${id}${p.files ? ` in ${p.files}` : ""}${p.except ? `, allowed in ${p.except.join(", ")}` : ""}; pattern${clipped(shape.patterns.map((pattern) => JSON.stringify(pattern.rule)).join(" | "))}` };
}
