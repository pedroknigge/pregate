import { compile, listChecks } from "./compile.ts";
import { testCheck } from "./fixtures.ts";
import { equal } from "./schema.ts";
import { enforcementOf } from "./enforcement.ts";
import { ruleLanguages } from "./languages.ts";
import { relationLine } from "./message.ts";
import type { Clock, Enforcement, Files, Lock, LockRelation, LockRule, Preset } from "./types.ts";

// lines: every per-rule change (--full). summary: the mode, one line per pack, and every
// explicit loosening, removal and field change, so a compact review still shows what weakens.
export interface ContractDiff { warning: boolean; lines: string[]; summary: string[] }
type Kind = "add" | "remove" | "tighten" | "loosen" | "meta" | "checker";
// inherited: the rule itself is unchanged; only the project default moved its policy.
interface Entry { ns: string; kind: Kind; line: string; inherited: boolean }
const STRENGTH = { warn: 0, ask: 1, deny: 2 };
const RANK: Record<Enforcement, number> = { shadow: 0, advisor: 1, enforce: 2 };
const MEANING: Record<Enforcement, string> = { enforce: "deny/ask findings block the agent", advisor: "the agent sees findings; nothing blocks", shadow: "findings are recorded silently" };
const BASE: Record<Enforcement, string> = { enforce: MEANING.enforce, advisor: "the agent sees findings", shadow: "findings are recorded silently" };
const LABEL: Record<Kind, string> = { add: "added", tighten: "tightened", meta: "updated", checker: "updated", loosen: "loosened", remove: "removed" };
const UNREADABLE = "Previous lock cannot be read for comparison. Review the complete candidate; no claim of preserved previous coverage is possible.";
const CORE_ONLY = (): Set<string> => new Set(["core"]);
const FIELDS = ["scope", "layers", "ownedByArkgate", "ratchet", "loop", "generatedMarkers", "sourceDirs", "fitness"] as const;
type Field = typeof FIELDS[number];
// List params whose growth makes a rule apply to or report more (stronger), and those whose growth
// makes it apply to or report less (weaker). Any other param change cannot be ordered: it may loosen.
const WIDER = new Set(["paths", "within", "packages", "extensions"]);
const NARROWER = new Set(["exclude", "allow"]);

// Builtin and library sources are versioned and resolved by the engine; a path or Git pack never is.
export function bundledNamespaces(presetText: string | null): Set<string> {
  try {
    const sources = (JSON.parse(presetText ?? "") as Preset).sources;
    return new Set(["core", ...sources.filter((s) => s.kind === "builtin" || s.kind === "library").map((s) => s.ns)]);
  } catch { return CORE_ONLY(); /* An unreadable preset proves no bundled source. */ }
}

// Both sides must bundle a namespace: one edit cannot re-kind a source to hide a checker change.
export function bundledBetween(beforePreset: string | null, afterPreset: string | null): Set<string> {
  const after = bundledNamespaces(afterPreset);
  return new Set([...bundledNamespaces(beforePreset)].filter((ns) => after.has(ns)));
}

// Previous lock bytes are review context, never admission or an evaluation cache.
// Cross-version migration still has to show removals/weakening from the old lock.
export function reviewDiff(previousText: string | null, after: Lock, bundled: Set<string> = CORE_ONLY()): ContractDiff {
  if (previousText === null) return contractDiff(null, after, bundled);
  return previousLockDiff(previousText, after, bundled);
}

function previousLockDiff(previousText: string, after: Lock, bundled: Set<string>): ContractDiff {
  try {
    const previous = JSON.parse(previousText) as Lock;
    if (!previous || !Array.isArray(previous.rules)) throw new Error("Unreadable previous rules");
    return contractDiff(previous, after, bundled);
  } catch {
    const diff = contractDiff(null, after, bundled);
    return { warning: true, lines: [UNREADABLE, ...diff.lines], summary: [UNREADABLE, ...diff.summary] };
  }
}

// Show every changed line, with nearby context, including invisible control characters.
export function sourceDiff(path: string, before: string | null, after: string | null): string {
  if (before === after) return "";
  const old = before === null ? [] : before.split("\n"), next = after === null ? [] : after.split("\n");
  let start = 0, end = 0;
  while (start < old.length && start < next.length && old[start] === next[start]) start++;
  while (end < old.length - start && end < next.length - start && old[old.length - 1 - end] === next[next.length - 1 - end]) end++;
  const from = Math.max(0, start - 3), tail = Math.min(3, end), label = pathLabel(path);
  return [
    `--- ${before === null ? "/dev/null" : label}`, `+++ ${after === null ? "/dev/null" : label}`,
    `@@ -${from + 1},${old.length - end + tail - from} +${from + 1},${next.length - end + tail - from} @@`,
    ...old.slice(from, start).map((s) => ` ${visible(s)}`),
    ...old.slice(start, old.length - end).map((s) => `-${visible(s)}`),
    ...next.slice(start, next.length - end).map((s) => `+${visible(s)}`),
    ...old.slice(old.length - end, old.length - end + tail).map((s) => ` ${visible(s)}`),
  ].join("\n");
}

// A path may hold a newline; escaped, it cannot forge header or content lines.
export function pathLabel(path: string): string {
  return visible(path).replace(/\n/g, "\\u000a");
}

export function visible(line: string): string {
  return line.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function approvalText(summary: string, warning: boolean, prompt = true): string {
  const plain = summary.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
  return `${warning ? "WARNING: this may weaken protection.\n\n" : ""}${plain}\n\n${prompt ? "Approve? [y/N] " : ""}`;
}

// Arbitrary patterns and parameter changes cannot be ordered safely: warn unless proven tighter.
// A new contract never warns; it weakens nothing. `bundled` names engine-versioned namespaces
// whose checker implementations may change in a routine update without a warning.
export function contractDiff(before: Lock | null, after: Lock, bundled: Set<string> = CORE_ONLY()): ContractDiff {
  const old = new Map((before?.rules ?? []).map((r) => [r.id, r]));
  const entries: Entry[] = [];
  for (const rule of after.rules) {
    const previous = old.get(rule.id);
    old.delete(rule.id);
    const entry = ruleEntry(before, previous, after, rule, bundled);
    if (entry !== null) entries.push(entry);
  }
  entries.push(...[...old.values()].map((rule): Entry => ({ ns: nsOf(rule.id), kind: "remove", line: `Removes ${rule.id}.`, inherited: false })));
  const known = new Set((before?.relations ?? []).map((r) => JSON.stringify(r)));
  const relations = (after.relations ?? []).filter((r) => !known.has(JSON.stringify(r)));
  const fields = fieldChanges(before, after), sources = fieldAdditions(before, after);
  const warning = entries.some((e) => e.kind === "loosen" || e.kind === "remove") || fields.length > 0
    || (before !== null && RANK[after.enforcement] < RANK[before.enforcement]);
  const lines = [...entries.map((e) => e.line), ...relations.map((r: LockRelation) => `Rule interaction ${relationLine(r).slice(2)}`),
    ...modeChange(before, after), ...fields, ...sources, ...(before !== null && !equal(before.preset, after.preset) ? ["Updates recipe metadata; review effective rule and coverage changes above."] : [])];
  return { warning, lines: lines.length === 0 ? ["No effective rule changes."] : lines, summary: summarize(before, after, entries, [...fields, ...sources], relations.length) };
}

function ruleEntry(before: Lock | null, previous: LockRule | undefined, after: Lock, rule: LockRule, bundled: Set<string>): Entry | null {
  const ns = nsOf(rule.id), policy = enforcementOf(after, rule);
  if (previous === undefined) return { ns, kind: "add", line: `Adds ${rule.id} (${rule.severity}, ${policy}).`, inherited: false };
  const oldPolicy = enforcementOf(before!, previous);
  if (equal(previous, rule)) return oldPolicy === policy ? null : { ns, kind: RANK[policy] < RANK[oldPolicy] ? "loosen" : "tighten",
    line: `${RANK[policy] < RANK[oldPolicy] ? "Loosens" : "Tightens"} ${rule.id}. Enforcement: ${oldPolicy} -> ${policy} (project default).`, inherited: true };
  const sameImpl = equal(previous.impl, rule.impl), sameParams = equal(previous.params, rule.params);
  const sameRest = equal(previous.languages, rule.languages) && equal(previous.phases, rule.phases)
    && equal(previous.aliases, rule.aliases) && (!previous.integrity || rule.integrity);
  const sameShape = sameParams && sameRest;
  const sameBehavior = sameImpl && sameShape && equal(ruleLanguages(previous), ruleLanguages(rule)) && previous.severity === rule.severity
    && previous.integrity === rule.integrity && oldPolicy === policy;
  if (sameBehavior) return { ns, kind: "meta", line: `Updates documentation or source metadata for ${rule.id}; effective check unchanged.`, inherited: false };
  const checker = !sameImpl && bundled.has(ns) && bundled.has(nsOf(rule.check));
  if (checker && sameShape && previous.severity === rule.severity && oldPolicy === policy) {
    return { ns, kind: "checker", line: `Updates bundled checker ${rule.id}${previous.check === rule.check ? "" : ` (${previous.check} -> ${rule.check})`}.`, inherited: false };
  }
  const tighter = (sameImpl || checker) && sameRest && (sameParams || paramsTighten(previous.params, rule.params)) && STRENGTH[rule.severity] >= STRENGTH[previous.severity] && RANK[policy] >= RANK[oldPolicy];
  return { ns, kind: tighter ? "tighten" : "loosen", line: `${tighter ? "Tightens" : "Changes (may loosen)"} ${rule.id}. ${ruleChanges(previous, rule, oldPolicy, policy)}`, inherited: false };
}

function nsOf(id: string): string {
  return id.split("/")[0]!;
}

function modeChange(before: Lock | null, after: Lock): string[] {
  if (before === null || before.enforcement === after.enforcement) return [];
  return [after.enforcement === "shadow" ? "Shadow mode default: ordinary rules without enforce overrides will not block."
    : after.enforcement === "advisor" ? "Advisor mode default: ordinary rules without enforce overrides will inform without blocking."
    : "Enforce mode default: ordinary deny/ask findings block."];
}

function fieldChanges(before: Lock | null, after: Lock): string[] {
  if (before === null) return [];
  return FIELDS.filter((field) => !equal(before[field], after[field]) && !widens(field, before, after))
    .map((field) => `Changes ${field}; review for weaker coverage: ${delta(field, before[field], after[field]).join(" ")}`);
}

// Fields that only grow what is protected are named with their delta, never flagged as weaker.
function fieldAdditions(before: Lock | null, after: Lock): string[] {
  if (before === null) return [];
  return FIELDS.filter((field) => !equal(before[field], after[field]) && widens(field, before, after)).flatMap((field) => field === "sourceDirs"
    ? after.sourceDirs.filter((dir) => !before.sourceDirs.includes(dir)).map((dir) => `Adds rule source ${dir}.`)
    : delta(field, before[field], after[field]).map((line) => `Widens ${line}`));
}

function widens(field: Field, before: Lock, after: Lock): boolean {
  if (field === "sourceDirs") return grows(before.sourceDirs, after.sourceDirs);
  // scope.exclude also marks where creating or editing a file is denied: shrinking it is not only wider.
  if (field === "scope") return grows(before.scope.include, after.scope.include) && equal(before.scope.exclude, after.scope.exclude);
  return field === "layers" && layersGrow(before.layers, after.layers);
}

// More paths in a layer (or a new layer) classify more files; no layer loses a path or changes its kind or
// imports. A new glob that may share a file with another layer's could move that file out of it, so it warns.
function layersGrow(before: Lock["layers"], after: Lock["layers"]): boolean {
  const kept = Object.entries(before).every(([name, layer]) => after[name] !== undefined && after[name]!.kind === layer.kind
    && equal(after[name]!.mayImport, layer.mayImport) && grows(layer.paths, after[name]!.paths));
  return kept && Object.entries(after).every(([name, layer]) => layer.paths.filter((glob) => !(before[name]?.paths ?? []).includes(glob))
    .every((glob) => Object.entries(after).every(([other, o]) => other === name || o.paths.every((g) => !mayOverlap(g, glob)))));
}

// Two globs can match one path only if one's literal prefix (up to its first wildcard) starts the other's.
// Conservative: `src/**/*.ts` and `src/billing/**` overlap although neither matches the other as a path.
function mayOverlap(a: string, b: string): boolean {
  const prefix = (glob: string) => glob.toLowerCase().split(/[*?[{\\]/)[0]!;
  const x = prefix(a), y = prefix(b);
  return x.startsWith(y) || y.startsWith(x);
}

function grows(before: string[], after: string[]): boolean {
  return before.every((item) => after.includes(item));
}

function paramsTighten(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].every((key) => {
    const a = before[key], b = after[key];
    if (equal(a, b)) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return WIDER.has(key) ? grows(a as string[], b as string[]) : NARROWER.has(key) && grows(b as string[], a as string[]);
  });
}

// Only what changed: list items added (+) and removed (-), object keys one by one, scalars as old -> new.
function delta(label: string, a: unknown, b: unknown): string[] {
  if (equal(a, b)) return [];
  if ((Array.isArray(a) || a === undefined) && (Array.isArray(b) || b === undefined)) {
    const old = (a ?? []) as unknown[], next = (b ?? []) as unknown[], key = (v: unknown) => JSON.stringify(v);
    const items = [...next.filter((v) => !old.some((o) => key(o) === key(v))).map((v) => `+ ${show(v)}`),
      ...old.filter((v) => !next.some((n) => key(n) === key(v))).map((v) => `- ${show(v)}`)];
    return [`${label}: ${items.length ? items.join(", ") : "reordered"}.`];
  }
  if ((record(a) || a === undefined) && (record(b) || b === undefined)) {
    const old = (a ?? {}) as Record<string, unknown>, next = (b ?? {}) as Record<string, unknown>;
    return [...new Set([...Object.keys(old), ...Object.keys(next)])].flatMap((k) => delta(`${label}.${k}`, old[k], next[k]));
  }
  return [`${label}: ${show(a)} -> ${show(b)}.`];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function show(value: unknown): string {
  return value === undefined ? "(none)" : typeof value === "string" ? value : JSON.stringify(value);
}

function summarize(before: Lock | null, after: Lock, entries: Entry[], fields: string[], relations: number): string[] {
  const was = before !== null && before.enforcement !== after.enforcement ? ` (was ${before.enforcement})` : "";
  const packs = [...new Set([...after.rules.map((r) => nsOf(r.id)), ...entries.map((e) => e.ns)])]
    .filter((ns) => before === null || entries.some((e) => e.ns === ns));
  const weaker = entries.filter((e) => !e.inherited && (e.kind === "loosen" || e.kind === "remove")).map((e) => e.line);
  const unchanged = before !== null && !packs.length && !fields.length && !relations ? ["No effective rule changes."] : [];
  return [`Mode: ${after.enforcement} — ${modeMeaning(after)}${was}.`, ...packs.map((ns) => packLine(before === null, after, ns, entries)),
    ...weaker, ...fields, ...(relations ? [`${relations} rule interactions added.`] : []), ...unchanged];
}

// The resulting mode, counting ordinary rules a per-rule override sets to enforce: they block.
function modeMeaning(after: Lock): string {
  const blocking = after.enforcement === "enforce" ? 0 : after.rules.filter((r) => !r.integrity && r.severity !== "warn"
    && !(r.impl.kind === "primitive" && r.impl.primitive === "fitness") && enforcementOf(after, r) === "enforce").length;
  return blocking === 0 ? MEANING[after.enforcement] : `${BASE[after.enforcement]}, except ${blocking} rule${blocking === 1 ? "" : "s"} set to enforce, which block${blocking === 1 ? "s" : ""}`;
}

function packLine(created: boolean, after: Lock, ns: string, entries: Entry[]): string {
  const rules = after.rules.filter((r) => nsOf(r.id) === ns);
  const evidence = rules.filter((r) => r.impl.kind === "primitive" && r.impl.primitive === "fitness");
  const mine = entries.filter((e) => e.ns === ns);
  const changes = created ? [] : ["added", "tightened", "updated", "loosened", "removed"].flatMap((label) => {
    const n = mine.filter((e) => LABEL[e.kind] === label).length;
    return n ? [`${label === "added" ? "+" : ""}${n} ${label}`] : [];
  });
  const mix = (["enforce", "advisor", "shadow"] as const).flatMap((policy) => {
    const n = rules.filter((r) => !evidence.includes(r) && enforcementOf(after, r) === policy).length;
    return n ? [`${n} ${policy}`] : [];
  });
  const parts = [changes.join(", "), mix.length ? `static checks ${mix.join(", ")}` : ""].filter((part) => part !== "");
  // Requirements nobody bound a verifier to check nothing; they are counted once the project adopts one.
  const adopted = Object.keys(after.fitness ?? {}).length > 0, shown = adopted ? rules.length : rules.length - evidence.length;
  return `${ns}: ${shown} rule${shown === 1 ? "" : "s"}${adopted && evidence.length ? ` (${evidence.length} evidence requirements)` : ""}${parts.map((part) => `; ${part}`).join("")}.`;
}

function ruleChanges(before: LockRule, after: LockRule, oldPolicy: string, policy: string): string {
  const changes: string[] = [];
  if (before.severity !== after.severity) changes.push(`Severity: ${before.severity} -> ${after.severity}.`);
  if (oldPolicy !== policy) changes.push(`Enforcement: ${oldPolicy} -> ${policy}.`);
  for (const key of new Set([...Object.keys(before.params), ...Object.keys(after.params)])) changes.push(...delta(key, before.params[key], after.params[key]));
  if (!equal(before.impl, after.impl)) changes.push("Checker implementation changes; review the proposed source.");
  if (!equal(before.phases, after.phases)) changes.push(`Phases: ${before.phases.join(", ")} -> ${after.phases.join(", ")}.`);
  if (!equal(ruleLanguages(before), ruleLanguages(after))) changes.push(`Languages: ${ruleLanguages(before).join(", ")} -> ${ruleLanguages(after).join(", ")}.`);
  return changes.join(" ");
}

export function validateContract(input: {
  presetText: string; filesOf: (source: Preset["sources"][number]) => Files | null;
  versions: { engine: string; core: string }; now: Clock;
}): ReturnType<typeof compile> {
  const result = compile(input.presetText, input.filesOf, input.versions);
  if ("errors" in result) return result;
  const preset = JSON.parse(input.presetText) as Preset;
  const errors: string[] = [];
  for (const source of preset.sources.filter((s) => s.kind !== "builtin")) {
    const files = input.filesOf(source);
    if (files === null) { errors.push(`${source.ns}: source not found`); continue; }
    const listed = listChecks(files);
    if ("errors" in listed) { errors.push(...listed.errors); continue; }
    for (const id of listed.ids) {
      const run = testCheck(files, id, input.now);
      if (!run.ok) errors.push(...run.lines.filter((line) => !line.startsWith("ok")));
    }
  }
  return errors.length === 0 ? result : { errors };
}
