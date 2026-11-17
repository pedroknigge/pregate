// Strongly connected import components for one reviewed file. The count is the size of the
// cyclic component that contains that file, or 0 when the file is not in a cycle. Other cycles
// in the project do not change it, so an edit that leaves this file's component alone does not
// increase the count.
import { inScope, ruleApplies } from "./paths.ts";
import { loadTsPaths, resolve } from "./resolve.ts";
import { cycleImports, grammarOf, parse } from "./ts.ts";
import type { Host, Lock, LockRule } from "./types.ts";

const SCRIPT = new Set(["typescript", "tsx"]);

export function importCycles(lock: Lock, rule: LockRule, rel: string, text: string, host: Host): { size: number; sites: { line: number; key: string }[] } {
  const selected = new Set<string>();
  for (const path of host.list?.() ?? []) if (scriptFile(lock, rule, path)) selected.add(path);
  if (grammarOf(rel) !== null && SCRIPT.has(grammarOf(rel)!)) selected.add(rel);
  const ts = loadTsPaths(host.read);
  const adj = new Map<string, { to: string; line: number; spec: string }[]>();
  for (const path of selected) {
    const body = path === rel ? text : host.read(path);
    if (body === null) continue;
    adj.set(path, edgesOf(path, body, ts, host.read, selected));
  }
  const component = componentOf(rel, adj);
  const self = (adj.get(rel) ?? []).some((edge) => edge.to === rel);
  if (component.length < 2 && !self) return { size: 0, sites: [] };
  const members = new Set(component);
  const sites = (adj.get(rel) ?? []).filter((edge) => members.has(edge.to)).map((edge) => ({ line: edge.line, key: `${edge.line}\0${edge.spec}` }));
  return { size: Math.max(component.length, 1), sites };
}

function scriptFile(lock: Lock, rule: LockRule, path: string): boolean {
  const grammar = grammarOf(path);
  return grammar !== null && SCRIPT.has(grammar) && inScope(lock, path) && ruleApplies(rule, path);
}

function edgesOf(path: string, text: string, ts: ReturnType<typeof loadTsPaths>, read: Host["read"], selected: Set<string>): { to: string; line: number; spec: string }[] {
  const parsed = parse(path, text);
  try {
    return cycleImports(parsed).flatMap((edge) => {
      const to = resolve(path, edge.spec, ts, read);
      return typeof to === "object" && selected.has(to.rel) ? [{ to: to.rel, line: edge.line, spec: edge.spec }] : [];
    });
  } finally {
    parsed.root.tree.delete();
  }
}

// Tarjan from `start`. Only nodes `start` can reach are visited; its component is still complete.
function componentOf(start: string, adj: Map<string, { to: string }[]>): string[] {
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const on = new Set<string>();
  let found: string[] = [];
  const visit = (v: string): void => {
    indices.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    on.add(v);
    for (const edge of adj.get(v) ?? []) {
      const w = edge.to;
      if (!indices.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v)!, indices.get(w)!));
    }
    if (low.get(v) !== indices.get(v)) return;
    const comp: string[] = [];
    for (;;) {
      const w = stack.pop()!;
      on.delete(w);
      comp.push(w);
      if (w === v) break;
    }
    if (comp.includes(start)) found = comp;
  };
  visit(start);
  return found;
}
