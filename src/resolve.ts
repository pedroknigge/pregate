// Import resolution for the layer and package rules: relative paths, the root tsconfig's paths,
// baseUrl and extends, and re-export chains. Layers are decided by path, so a target that does not
// exist yet (written in the same batch) still resolves to where it would be.
import { grammarOf, imports, parse, type Parsed } from "./ts.ts";
import type { ImportsOf, Read } from "./types.ts";
import { resolveGo, resolvePython } from "./module-resolve.ts";
import { resolveRust } from "./rust-resolve.ts";

export interface TsPaths {
  baseUrl: string | null;                            // root-relative folder; "" is the root
  paths: { pattern: string; targets: string[] }[];   // targets root-relative, `*` kept
  missing?: string[];                                // extended packages that are not installed
}
export type Resolved = { rel: string } | "external" | "unresolved";
export interface Edge { spec: string; to: Resolved }
type Found = { baseUrl?: string; paths?: TsPaths["paths"]; pathsDir?: string };   // tsconfig values as the extends chain sets them

const EXTENSIONS = [".ts", ".tsx", ".d.ts", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const MAX_HOPS = 3;
const MAX_FILES = 32;
// A package name, optionally scoped, with a subpath: `#x`, `~/x` and `@/x` are aliases, not packages.
const PACKAGE = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(\/.*)?$/i;

// null: the repo has no tsconfig.json. "invalid": it, or a config it extends, is missing or unreadable.
// An extended package that is not installed (a fresh clone) is not a broken repo: shared presets
// practically never set paths or baseUrl, so the chain goes on without it and `missing` names it.
export function loadTsPaths(read: Read): TsPaths | null | "invalid" {
  if (read("tsconfig.json") === null) return null;
  const found: Found = {};
  const missing: string[] = [];
  const extended = (dir: string, spec: string): string | "missing" | null => {
    const at = extendedConfig(dir, spec, read);
    if (at !== null || !uninstalledPackage(dir, spec, read)) return at;
    if (!missing.includes(spec)) missing.push(spec);
    return "missing";
  };
  // The config itself wins over what it extends; of several extends, the later wins (TS 5).
  const visit = (file: string, chain: string[]): boolean => {
    const text = read(file);
    const json = text === null || chain.includes(file) ? null : jsonc(text);
    const dir = dirname(file);
    if (!isObject(json) || !adopt(found, json.compilerOptions ?? {}, dir)) return false;
    const parents = json.extends === undefined ? [] : [json.extends].flat();
    return parents.every((p) => typeof p === "string") && [...parents].reverse().every((p) => {
      const parent = extended(dir, p as string);
      return parent === "missing" || (parent !== null && visit(parent, [...chain, file]));
    });
  };
  if (!visit("tsconfig.json", [])) return "invalid";
  const baseUrl = found.baseUrl ?? null;
  const from = baseUrl ?? found.pathsDir ?? "";
  const paths = (found.paths ?? []).map(({ pattern, targets }) => ({ pattern, targets: targets.map((t) => join(from, t)) }));
  return missing.length ? { baseUrl, paths, missing } : { baseUrl, paths };
}

// The one line a command shows when import resolution runs without an uninstalled tsconfig preset.
export function tsconfigNotice(read: Read): string | null {
  const ts = loadTsPaths(read);
  const names = ts !== null && ts !== "invalid" ? ts.missing ?? [] : [];
  return names.length ? `tsconfig extends ${names.join(", ")}, which ${names.length === 1 ? "is" : "are"} not installed; run your package manager install for exact import resolution.` : null;
}

// One config's baseUrl and paths, unless a config that extends it already set them; false when they
// are not what TypeScript accepts. `dir` is the config's folder, which its relative values start from.
function adopt(found: Found, options: unknown, dir: string): boolean {
  if (!isObject(options)) return false;
  if (found.baseUrl === undefined && options.baseUrl !== undefined) {
    if (typeof options.baseUrl !== "string") return false;
    found.baseUrl = join(dir, options.baseUrl);
  }
  if (found.paths === undefined && options.paths !== undefined) {
    const entries = isObject(options.paths) ? Object.entries(options.paths) : null;
    if (!entries?.every(([, t]) => Array.isArray(t) && t.every((x) => typeof x === "string"))) return false;
    found.paths = entries.map(([pattern, targets]) => ({ pattern, targets: targets as string[] }));
    found.pathsDir = dir;
  }
  return true;
}

// With an invalid tsconfig any bare specifier may be an alias of anything: it is "unresolved". So is a
// specifier whose target the runtime reads differently from its text: a query or a fragment (the
// runtime drops it, a path join would not), a backslash, and `.`/`..` inside a bare specifier, which
// Node and Bun normalize after the package root (`pkg/../../src/x` reaches src/x).
export function resolve(fromRel: string, spec: string, ts: TsPaths | null | "invalid", read: Read, base?: string): Resolved {
  const grammar = grammarOf(fromRel);
  if (grammar === "python") return resolvePython(fromRel, spec, read, base);
  if (grammar === "go") return resolveGo(fromRel, spec, read);
  if (grammar === "rust") return resolveRust(fromRel, spec, read, base);
  if (/[?\\]|.#/.test(spec)) return "unresolved";   // a leading `#` is a subpath alias (`#db`)
  if (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../")) return local(join(dirname(fromRel), spec), read);
  if (ts === "invalid" || spec.split("/").some((seg) => seg === "." || seg === "..")) return "unresolved";
  const alias = ts && aliasOf(spec, ts);
  if (alias) {
    // The wildcard may end next to a `..` of its own (`@d*` with `@d../infra`): normalize as TypeScript does.
    const candidates = alias.targets.map((t) => join("", t.replace("*", alias.rest)));
    const found = candidates.map((c) => (outside(c) ? null : locate(c, read))).find((c) => c !== null);
    return found ? { rel: found } : local(candidates[0]!, read);
  }
  const underBase = ts?.baseUrl != null ? locate(join(ts.baseUrl, spec), read) : null;
  if (underBase) return { rel: underBase };
  return /^(node|bun):/.test(spec) || (PACKAGE.test(spec) && packageOf(spec) !== ownName(read)) ? "external" : "unresolved";
}

// What a module re-exports (`export … from`), followed through local modules: MAX_HOPS re-exports deep
// and MAX_FILES files read at most. A module past the last hop is read only to see whether the chain
// goes on; if it does, it cannot be established and the answer is "too-deep". So is a module with a
// parse error: error recovery can wrap an `export … from` in an ERROR node and hide it.
export function reexportTargets(rel: string, ts: TsPaths | null | "invalid", read: Read, importsOf?: ImportsOf): Edge[] | "too-deep" {
  const edges: Edge[] = [];
  const modules = (file: string): string[] => {
    if (grammarOf(file) !== "python") return [file];
    const parents: string[] = [];
    for (let dir = dirname(file); dir; dir = dirname(dir)) {
      const init = `${dir}/__init__.py`;
      if (init !== file && read(init) !== null) parents.push(init);
    }
    return [file, ...parents];
  };
  let frontier = grammarOf(rel) ? modules(rel) : [];
  const seen = new Set(frontier);
  let reads = 0;
  for (let hop = 1; ; hop++) {
    const texts = frontier.flatMap((file) => {
      const text = read(file);
      return text === null ? [] : [{ file, text }];
    });
    if (!texts.length) return edges;
    if ((reads += texts.length) > MAX_FILES) return "too-deep";
    const next: string[] = [];
    for (const { file, text } of texts) {
      const exported = exportedImports(file, text, importsOf);
      if (exported === "too-deep") return "too-deep";
      if (exported.length && hop > MAX_HOPS) return "too-deep";
      for (const i of exported) {
        const to = i.literal ? resolve(file, i.spec, ts, read, i.base) : "unresolved";
        edges.push({ spec: i.spec, to });
        if (typeof to === "object" && grammarOf(to.rel)) {
          for (const module of modules(to.rel)) if (!seen.has(module)) {
            seen.add(module);
            next.push(module);
          }
        }
      }
    }
    frontier = next;
  }
}

function exportedImports(file: string, text: string, importsOf?: ImportsOf): ReturnType<typeof imports> | "too-deep" {
  let found: ReturnType<typeof imports>;
  if (importsOf) {
    const facts = importsOf(file, text);
    if (facts.hasError) return "too-deep";
    found = facts.imports;
  } else {
    const own = importsOfTree(parse(file, text));
    if (own === "too-deep") return own;
    found = own;
  }
  return found.filter((item) => item.kind === "reexport" || (grammarOf(file) === "python" && item.kind === "dynamic"));
}

function importsOfTree(parsed: Parsed): ReturnType<typeof imports> | "too-deep" {
  try {
    return parsed.root.hasError ? "too-deep" : imports(parsed);
  } finally { parsed.root.tree.delete(); }
}

// The longest prefix wins, as in TypeScript; a pattern without `*` matches only itself.
function aliasOf(spec: string, ts: TsPaths): { targets: string[]; rest: string } | null {
  let best: { targets: string[]; rest: string; prefix: number } | null = null;
  for (const { pattern, targets } of ts.paths) {
    const star = pattern.indexOf("*");
    const [head, tail] = star < 0 ? [pattern, null] : [pattern.slice(0, star), pattern.slice(star + 1)];
    const hit = tail === null ? spec === head : spec.startsWith(head) && spec.endsWith(tail) && spec.length >= head.length + tail.length;
    const prefix = tail === null ? Infinity : head.length;
    if (hit && targets.length && (!best || prefix > best.prefix)) {
      best = { targets, rest: tail === null ? "" : spec.slice(head.length, spec.length - tail.length), prefix };
    }
  }
  return best;
}

function local(path: string, read: Read): Resolved {
  return outside(path) ? "unresolved" : { rel: locate(path, read) ?? path };
}

// A package that imports itself by name reaches its own files through `exports` in package.json.
function ownName(read: Read): string | null {
  const name = jsonc(read("package.json") ?? "")?.name;
  return typeof name === "string" ? name : null;
}

function packageOf(spec: string): string {
  return spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");
}

// TypeScript's lookup: the path, with an extension, `.js` written for `.ts`, or a folder's index.
function locate(path: string, read: Read): string | null {
  const stem = path.replace(/\.[mc]?jsx?$/, "");
  const candidates = [
    path, ...EXTENSIONS.map((e) => path + e), ...(stem === path ? [] : EXTENSIONS.map((e) => stem + e)),
    ...EXTENSIONS.map((e) => `${path}/index${e}`),
  ];
  return candidates.find((c) => read(c) !== null) ?? null;
}

// A relative `extends` names a file (`.json` optional); a bare one names a package's config, looked
// up as TypeScript does: in node_modules from the config's folder up to the root.
function extendedConfig(dir: string, spec: string, read: Read): string | null {
  const bases = spec.startsWith(".") ? [join(dir, spec)] : moduleDirs(dir).map((m) => join(m, spec));
  return bases.flatMap((b) => [b, `${b}.json`, `${b}/tsconfig.json`]).find((c) => !outside(c) && read(c) !== null) ?? null;
}

// A package-shaped extends whose package is not installed. An installed package without that config
// is broken, and a same-named local file makes it ambiguous (`"extends": "tsconfig.base.json"` is a
// typo for a path that may set paths): neither is this.
function uninstalledPackage(dir: string, spec: string, read: Read): boolean {
  if (!PACKAGE.test(spec) || spec.startsWith(".") || moduleDirs(dir).some((m) => read(`${m}/${packageOf(spec)}/package.json`) !== null)) return false;
  const local = join(dir, spec);
  return !outside(local) && [local, `${local}.json`].every((c) => read(c) === null);
}

function moduleDirs(dir: string): string[] {
  const dirs = [join(dir, "node_modules")];
  for (let d = dir; d; ) dirs.push(join(d = dirname(d), "node_modules"));
  return dirs;
}

const jsoncCache = new Map<string, Record<string, unknown> | null>();

function jsonc(text: string): Record<string, unknown> | null {
  if (jsoncCache.has(text)) return jsoncCache.get(text)!;
  const out = parseJsonc(text);
  if (jsoncCache.size < 512 && text.length <= 262144) jsoncCache.set(text, out);
  return out;
}

function parseJsonc(text: string): Record<string, unknown> | null {
  try {
    const v = Bun.JSONC.parse(text);
    return isObject(v) ? v : null;
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function dirname(rel: string): string {
  const i = rel.lastIndexOf("/");
  return i < 0 ? "" : rel.slice(0, i);
}

export interface CompilerOptionsLoad {
  options: Record<string, unknown>;
  missing: string[];
  invalid: boolean;
  referencesOnly: boolean;
}

// Merged compilerOptions for one config file. The file's own text wins over `read(file)`, so a
// hook sees the buffer being written. Child keys win; of several `extends`, the later one wins.
// An uninstalled package extends is named in `missing` and is not a broken chain.
export function loadCompilerOptions(read: Read, file: string, ownText?: string | null): CompilerOptionsLoad | null {
  const text = ownText ?? read(file);
  if (text === null) return null;
  const root = jsonc(text);
  if (!isObject(root)) return { options: {}, missing: [], invalid: true, referencesOnly: false };
  if (root.compilerOptions === undefined && root.extends === undefined && Array.isArray(root.references)) {
    return { options: {}, missing: [], invalid: false, referencesOnly: true };
  }
  const options: Record<string, unknown> = {};
  const missing: string[] = [];
  const extended = (dir: string, spec: string): string | "missing" | null => {
    const at = extendedConfig(dir, spec, read);
    if (at !== null || !uninstalledPackage(dir, spec, read)) return at;
    if (!missing.includes(spec)) missing.push(spec);
    return "missing";
  };
  const visit = (path: string, chain: string[], body: string | null): boolean => {
    const json = body === null || chain.includes(path) ? null : jsonc(body);
    if (!isObject(json)) return false;
    const own = json.compilerOptions === undefined ? {} : json.compilerOptions;
    if (!isObject(own)) return false;
    for (const [key, value] of Object.entries(own)) if (!(key in options)) options[key] = value;
    const parents = json.extends === undefined ? [] : [json.extends].flat();
    if (!parents.every((parent) => typeof parent === "string")) return false;
    const dir = dirname(path);
    return [...parents].reverse().every((parent) => {
      const resolved = extended(dir, parent as string);
      return resolved === "missing" || (resolved !== null && visit(resolved, [...chain, path], read(resolved)));
    });
  };
  return { options, missing, invalid: !visit(file, [], text), referencesOnly: false };
}

function outside(rel: string): boolean {
  return rel === ".." || rel.startsWith("../");
}

// Root-relative join that keeps a leading ".." when the path climbs out of the root.
function join(dir: string, path: string): string {
  const out: string[] = [];
  for (const seg of `${dir}/${path}`.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === ".." && out.length && out[out.length - 1] !== "..") out.pop();
    else out.push(seg);
  }
  return out.join("/");
}
