// Honest proxies the pattern language cannot decide: a sibling test, a feature-flag
// import, an ADR path in the same diff, and a size a churn gate compares later.
// Git listing lives in proxy-diff.ts so this module stays in the core layer.
import { languageApplies } from "./languages.ts";
import { matches, ruleApplies } from "./paths.ts";
import { functions, imports, type Parsed } from "./ts.ts";
import type { Lock, Phase, Read, Violation } from "./types.ts";

export function usesPrimitive(lock: Lock, primitive: string): boolean {
  return lock.rules.some((rule) => rule.impl.kind === "primitive" && rule.impl.primitive === primitive);
}

const MODULE = "<module>";
const CODE_EXT = ["ts", "tsx", "js", "jsx"];

export function nonBlankLines(text: string): number {
  let count = 0;
  for (const line of text.split("\n")) if (line.trim() !== "") count += 1;
  return count;
}

export function longestFunction(parsed: Parsed): { lines: number; line: number } {
  let best = { lines: 0, line: 1 };
  for (const fn of functions(parsed)) if (fn.lines >= best.lines) best = { lines: fn.lines, line: fn.line };
  return best;
}

// Same directory, `__tests__` beside the file, or `src/` mirrored under `test/`, `tests/`, or `__tests__/`.
export function hasSiblingTest(rel: string, read: Read): boolean {
  const parts = rel.split("/");
  const file = parts.pop() ?? rel;
  const dot = file.lastIndexOf(".");
  const base = dot < 0 ? file : file.slice(0, dot);
  const ext = dot < 0 ? "" : file.slice(dot + 1);
  const leaves = [...new Set([ext, ...CODE_EXT].filter((item) => item !== ""))].flatMap((item) => [`${base}.test.${item}`, `${base}.spec.${item}`]);
  const folders = new Set<string>();
  const add = (folder: string): void => void folders.add(folder);
  const dir = parts.join("/");
  add(dir);
  add(dir === "" ? "__tests__" : `${dir}/__tests__`);
  const src = parts.indexOf("src");
  if (src >= 0) for (const root of ["test", "tests", "__tests__"]) {
    const mirrored = [...parts];
    mirrored[src] = root;
    add(mirrored.join("/"));
  }
  for (const root of ["test", "tests"]) add(dir === "" ? root : `${root}/${dir}`);
  for (const folder of folders) for (const leaf of leaves) {
    const path = folder === "" ? leaf : `${folder}/${leaf}`;
    if (path !== rel && read(path) !== null) return true;
  }
  return false;
}

export function importsFeatureFlag(parsed: Parsed, specifiers: readonly string[]): boolean {
  const names = new Set(specifiers);
  return imports(parsed).some((item) => {
    if (!item.literal || item.spec === "") return false;
    if (names.has(item.spec)) return true;
    const base = item.spec.split("/").pop()?.replace(/\.(?:tsx?|jsx?|mjs|cjs)$/, "") ?? "";
    return names.has(base) || /(?:^|[/.-])feature[-_]?flags?(?:$|[/.-])/i.test(item.spec);
  });
}

// An architecture file in this diff needs one changed path under the ADR globs.
// `changed` undefined: this review has no diff (a whole-tree audit), so the rule stays quiet.
export function adrTouch(lock: Lock, phase: Phase, rel: string, changedPaths: readonly string[] | undefined): Violation[] {
  if (changedPaths === undefined) return [];
  return lock.rules.flatMap((rule) => {
    if (rule.impl.kind !== "primitive" || rule.impl.primitive !== "adr-touch") return [];
    if (!rule.phases.includes(phase) || !ruleApplies(rule, rel) || !languageApplies(rule, rel)) return [];
    const adr = rule.params.adr;
    if (!Array.isArray(adr) || adr.length === 0 || adr.some((glob) => typeof glob !== "string")) return [];
    if (changedPaths.some((path) => adr.some((glob) => matches(glob, path)))) return [];
    return [{ rule: rule.id, path: rel, line: 1, symbol: MODULE, measured: null, limit: null, atSessionStart: null, severity: rule.severity }];
  });
}

