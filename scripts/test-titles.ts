// Test titles are the citation corrections and the feature map share. A template
// string is not a title: renaming the words of a literal is what makes the citation fail.
import { Lang, parse, type SgNode } from "@ast-grep/napi";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const WRAP = new Set(["as_expression", "satisfies_expression", "parenthesized_expression", "non_null_expression"]);

export function titlesIn(source: string): string[] {
  const titles: string[] = [];
  for (const call of parse(Lang.TypeScript, source).root().findAll({ rule: { kind: "call_expression" } })) {
    const title = testTitle(call);
    if (title !== null) titles.push(title);
  }
  return titles;
}

export function walkFiles(dir: string, keep: (name: string, dir: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "vendor" || entry.name === "fixtures") return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(path, keep);
    return keep(entry.name, dir) ? [path] : [];
  });
}

function testTitle(call: SgNode): string | null {
  const callee = field(call, "function");
  if (callee === null) return null;
  const name = callee.text();
  if (name !== "test" && name !== "it" && !name.startsWith("test.") && !name.startsWith("it.")) return null;
  return literal(field(call, "arguments")?.namedChildren()[0] ?? null);
}

function literal(node: SgNode | null): string | null {
  while (node !== null && WRAP.has(String(node.kind()))) node = node.namedChildren()[0] ?? null;
  if (node === null || node.kind() !== "string") return null;
  const raw = node.text();
  if (raw.startsWith("\"")) {
    try {
      const value = JSON.parse(raw) as unknown;
      return typeof value === "string" ? value : null;
    } catch { return null; }
  }
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) {
    return raw.slice(1, -1).replaceAll("\\'", "'").replaceAll("\\\\", "\\");
  }
  return null;
}

function field(node: SgNode, name: string): SgNode | null {
  return (node as { field(name: string): SgNode | null }).field(name);
}
