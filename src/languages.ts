import type { Grammar, Impl, Lock, RuleLanguage } from "./types.ts";
import { ruleApplies } from "./paths.ts";
import { isDependencyPinFile } from "./package-version.ts";

const EXTENSIONS = new Map<string, Grammar>([
  ["ts", "typescript"], ["mts", "typescript"], ["cts", "typescript"],
  ["tsx", "tsx"], ["js", "tsx"], ["mjs", "tsx"], ["cjs", "tsx"], ["jsx", "tsx"],
  ["vue", "tsx"], ["svelte", "tsx"],
  ["py", "python"], ["go", "go"], ["rs", "rust"],
]);

export function grammarOf(rel: string): Grammar | null {
  const ext = /\.([^./]+)$/.exec(rel)?.[1];
  return ext === undefined ? null : EXTENSIONS.get(ext.toLowerCase()) ?? null;
}

export function grammarPath(g: Grammar): string {
  return `pattern.${{ typescript: "ts", tsx: "tsx", python: "py", go: "go", rust: "rs" }[g]}`;
}

export function commentKinds(rel: string): string[] {
  return grammarOf(rel) === "rust" ? ["line_comment", "block_comment"] : ["comment"];
}

export function ruleLanguages(r: { impl: Impl; languages?: RuleLanguage[] }): RuleLanguage[] {
  if (r.impl.kind === "primitive" && (r.impl.primitive === "fitness" || r.impl.primitive === "forbidden-path")) return [];
  if (r.languages) return r.languages;
  if (r.impl.kind === "pattern") return Object.keys(r.impl.patterns) as RuleLanguage[];
  if (r.impl.primitive === "placement" || (r.impl.primitive === "diff" && r.impl.count === "markers")) return ["typescript", "python", "go", "rust"];
  return ["typescript"];
}

const STATIC_PRIMITIVES = ["metric", "layer-edge", "banned-import", "drizzle-bounded-select", "interval-cleanup", "react-index-key", "credential-literal", "python-legacy", "typescript-fact", "sibling-test", "required-import", "dependency-pin"];

export function languageApplies(r: { impl: Impl; languages?: RuleLanguage[] }, rel: string): boolean {
  if (r.impl.kind === "primitive" && (r.impl.primitive === "fitness" || r.impl.primitive === "forbidden-path" || r.impl.primitive === "adr-touch")) return true;
  if (r.impl.kind === "primitive" && r.impl.primitive === "typescript-fact" && r.impl.fact === "tsconfig") {
    return /(^|\/)tsconfig[^/]*\.json$/.test(rel) && !rel.split("/").includes("node_modules");
  }
  if (r.impl.kind === "primitive" && r.impl.primitive === "dependency-pin") return isDependencyPinFile(rel);
  if (!r.languages && r.impl.kind === "primitive" && (r.impl.primitive === "placement" || (r.impl.primitive === "diff" && r.impl.count === "markers"))) return true;
  const g = grammarOf(rel);
  return g !== null && ruleLanguages(r).includes(g === "tsx" ? "typescript" : g);
}

export function staticRulesFor(lock: Lock, rel: string) {
  return lock.rules.filter((r) => !lock.ownedByArkgate.includes(r.id) && languageApplies(r, rel)
    && (r.impl.kind === "pattern" || STATIC_PRIMITIVES.includes(r.impl.primitive))
    && ruleApplies(r, rel));
}

export function missingLanguagePolicy(lock: Lock, rel: string): boolean {
  const grammar = grammarOf(rel);
  return (grammar === "python" || grammar === "go" || grammar === "rust") && staticRulesFor(lock, rel).length === 0;
}
