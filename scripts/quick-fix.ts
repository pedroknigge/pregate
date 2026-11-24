// A wait or a counted retry in src/ leaves the failure in place. Fix the cause.
// A reviewed deadline, poll, or bound on a real condition is named in
// scripts/quick-fix-allowlist.json with the file, the site, and the reason.
// This is a check of this repository. It is not a Pregate rule pack.
import { Lang, parse, type SgNode } from "@ast-grep/napi";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dir, "..");
const ALLOWLIST = join(import.meta.dir, "quick-fix-allowlist.json");
const CAUSE = "Fix the cause. A wait or a counted retry leaves the failure in place.";
const REVIEW = "A reviewed deadline or a bound on a real condition goes in scripts/quick-fix-allowlist.json with this file, this site, and the reason.";
const RETRY_NAME = /\b(?:attempt|attempts|retry|retries|tries)\b/;
const FUNCTION_VALUE = new Set(["arrow_function", "function_expression", "function", "generator_function"]);
const NAMED_FUNCTION = new Set(["function_declaration", "method_definition", "generator_function_declaration"]);

export interface SourceUnit { file: string; source: string }
export interface AllowEntry { file: string; site: string; reason: string }
export interface QuickFixSite { file: string; line: number; kind: "wait" | "retry"; site: string }

export function quickFixSites(file: string, source: string): QuickFixSite[] {
  const root = parse(Lang.TypeScript, source).root();
  const waits = root.findAll({ rule: { kind: "call_expression" } }).flatMap((call) => {
    const shape = waitShape(call);
    if (shape === null) return [];
    return [site(file, call, "wait", `${owner(call)}: ${shape}`)];
  });
  const retries = root.findAll({ rule: { kind: "for_statement" } }).concat(root.findAll({ rule: { kind: "while_statement" } }))
    .flatMap((loop) => {
      const header = loopHeader(loop);
      if (header === null || !RETRY_NAME.test(header)) return [];
      return [site(file, loop, "retry", `${owner(loop)}: ${header}`)];
    });
  return [...waits, ...retries].sort(bySite);
}

export function quickFixProblems(units: readonly SourceUnit[], allow: readonly AllowEntry[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of allow.entries()) {
    const key = `${entry.file}\0${entry.site}`;
    if (!isReviewedFile(entry.file) || entry.site.trim() === "") {
      problems.push(`allowlist row ${index + 1} must name a src/*.ts file and a site.`);
      continue;
    }
    if (entry.reason.trim().length < 40) {
      problems.push(`${entry.file} site ${entry.site} needs a reason that says why this wait or retry is a real bound, not a hidden failure.`);
    }
    if (seen.has(key)) problems.push(`${entry.file} site ${entry.site} is reviewed more than once.`);
    seen.add(key);
  }
  const found = units.flatMap((unit) => quickFixSites(unit.file, unit.source));
  const covered = new Set<string>();
  for (const hit of found) {
    const key = `${hit.file}\0${hit.site}`;
    if (!allow.some((entry) => entry.file === hit.file && entry.site === hit.site && entry.reason.trim().length >= 40)) {
      problems.push(`${hit.file}:${hit.line} ${hit.kind} ${hit.site}\n${CAUSE}\n${REVIEW}`);
    } else covered.add(key);
  }
  for (const entry of allow) {
    if (!isReviewedFile(entry.file) || entry.site.trim() === "" || entry.reason.trim().length < 40) continue;
    if (!covered.has(`${entry.file}\0${entry.site}`)) {
      problems.push(`${entry.file} site ${entry.site} matches no wait or counted retry. Remove the stale review.`);
    }
  }
  return problems;
}

export function repositoryQuickFixProblems(root = ROOT): string[] {
  const path = join(root, "scripts/quick-fix-allowlist.json");
  if (!existsSync(path)) return ["scripts/quick-fix-allowlist.json is missing."];
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { return [`scripts/quick-fix-allowlist.json is not JSON: ${error instanceof Error ? error.message : String(error)}`]; }
  const allow = allowEntries(parsed);
  if (!Array.isArray(allow)) return [allow];
  return quickFixProblems(sourceUnits(root), allow);
}

function site(file: string, node: SgNode, kind: QuickFixSite["kind"], text: string): QuickFixSite {
  return { file, line: node.range().start.line + 1, kind, site: text };
}

function waitShape(call: SgNode): string | null {
  const callee = field(call, "function");
  if (callee === null) return null;
  const name = callee.kind() === "identifier" ? callee.text() : callee.kind() === "member_expression" ? field(callee, "property")?.text() ?? "" : "";
  const object = callee.kind() === "member_expression" ? field(callee, "object")?.text() ?? "" : "";
  const timer = name === "setTimeout" || name === "setInterval";
  const sleep = name === "sleep";
  const atomics = name === "wait" && object === "Atomics";
  if (!timer && !sleep && !atomics) return null;
  const args = field(call, "arguments")?.namedChildren() ?? [];
  // setTimeout and setInterval take the delay second. sleep takes it first.
  // Atomics.wait takes the timeout fourth; omitting it blocks.
  const delay = atomics ? args[3] : sleep ? args[0] : args[1];
  const shown = delay === undefined ? "forever" : collapse(delay.text());
  const calleeText = callee.kind() === "identifier" ? name : `${collapse(object)}.${name}`;
  return `${calleeText}(${shown})`;
}

function loopHeader(loop: SgNode): string | null {
  if (loop.kind() === "while_statement") {
    const condition = field(loop, "condition");
    return condition === null ? null : `while (${collapse(condition.text())})`;
  }
  if (loop.kind() !== "for_statement") return null;
  const init = piece(field(loop, "initializer"));
  const condition = piece(field(loop, "condition"));
  const increment = piece(field(loop, "increment"));
  return `for (${init}; ${condition}; ${increment})`;
}

function owner(node: SgNode): string {
  for (const parent of node.ancestors()) {
    if (NAMED_FUNCTION.has(String(parent.kind()))) {
      const name = field(parent, "name");
      if (name !== null) return collapse(name.text());
    }
    if (parent.kind() === "variable_declarator") {
      const name = field(parent, "name");
      const value = field(parent, "value");
      if (name?.kind() === "identifier" && value !== null && FUNCTION_VALUE.has(String(value.kind()))) return name.text();
    }
  }
  return "anonymous";
}

function piece(node: SgNode | null): string {
  return node === null ? "" : collapse(node.text()).replace(/;$/, "");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function field(node: SgNode, name: string): SgNode | null {
  return (node as { field(name: string): SgNode | null }).field(name);
}

function isReviewedFile(file: string): boolean {
  return file.startsWith("src/") && file.endsWith(".ts") && !file.endsWith(".d.ts") && !file.split("/").includes("..");
}

function bySite(a: QuickFixSite, b: QuickFixSite): number {
  return a.file.localeCompare(b.file) || a.line - b.line || a.site.localeCompare(b.site);
}

function allowEntries(parsed: unknown): AllowEntry[] | string {
  if (!Array.isArray(parsed)) return "scripts/quick-fix-allowlist.json must be an array of { file, site, reason }.";
  const entries: AllowEntry[] = [];
  for (const [index, row] of parsed.entries()) {
    if (row === null || typeof row !== "object" || typeof (row as AllowEntry).file !== "string" || typeof (row as AllowEntry).site !== "string" || typeof (row as AllowEntry).reason !== "string") {
      return `allowlist row ${index + 1} must be an object with string file, site, and reason.`;
    }
    entries.push({ file: (row as AllowEntry).file, site: (row as AllowEntry).site, reason: (row as AllowEntry).reason });
  }
  return entries;
}

function sourceUnits(root: string): SourceUnit[] {
  return sourceFiles(join(root, "src")).map((path) => ({
    file: relative(root, path).split(sep).join("/"),
    source: readFileSync(path, "utf8"),
  }));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") ? [path] : [];
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
    console.error("Usage: bun scripts/quick-fix.ts [--check]");
    process.exit(1);
  }
  const problems = repositoryQuickFixProblems();
  if (problems.length > 0) {
    console.error(problems.join("\n\n"));
    process.exit(1);
  }
}
