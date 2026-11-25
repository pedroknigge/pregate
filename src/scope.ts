import { matches } from "./paths.ts";

// Folders that are not the project's source. `detectExclusions` is pure: the same facts always
// return the same candidates, in path order. The shell in exclude-scan.ts reads the tree.
// Accepting a candidate appends its glob to scope.exclude. `inScope` in paths.ts is the only
// decision check, the pre-write gate and audit use to skip that folder.

export interface DirFacts {
  path: string;
  files: number;
  generatedHeaders: number;
  minified: number;
  protobuf: number;
  complete: boolean;
}

export interface ExcludeFacts {
  dirs: DirFacts[];
  ignored: string[];
  submodules: string[];
  layerGlobs: string[];
  excludeGlobs: string[];
  cargoDirs: string[];
}

export interface ExcludeCandidate {
  path: string;
  glob: string;
  reason: string;
  evidence: string;
}

const VENDOR = new Set(["vendor", "third_party", "external"]);
const GENERATED = new Set(["dist", "build", "out", ".next", "coverage", "generated"]);
const DEPS = new Set(["node_modules", ".venv", "venv", "__pycache__"]);
const FIXTURES = new Set(["fixtures", "__snapshots__", "testdata"]);
const PROTECTED = new Set([".pregate", ".git", ".claude", ".codex", ".cursor", ".grok", ".gemini", ".agents", ".agent", ".opencode", ".local"]);

export const ACCEPT_EXCLUSIONS = "pregate enable";

// A directory whose own name is generated output, so the walk reads headers under it.
export function readsGeneratedHeader(name: string): boolean {
  return GENERATED.has(name) || name.endsWith("_pb") || codegen(name);
}

export function detectExclusions(facts: ExcludeFacts): ExcludeCandidate[] {
  const ignored = new Set(facts.ignored);
  const submodules = new Set(facts.submodules);
  const cargo = new Set(facts.cargoDirs);
  const found: ExcludeCandidate[] = [];
  for (const dir of facts.dirs) {
    if (dir.path === "" || protectedPath(dir.path) || dropsLayer(dir.path, facts.layerGlobs)) continue;
    if (alreadyExcluded(dir.path, facts.excludeGlobs)) continue;
    const kind = classify(dir, ignored.has(dir.path), submodules.has(dir.path), cargo.has(parentOf(dir.path)));
    if (kind === null) continue;
    found.push({ path: dir.path, glob: treeGlob(dir.path), reason: kind.reason, evidence: kind.evidence });
  }
  return outermost(found);
}

export function candidateBlock(candidates: ExcludeCandidate[]): string {
  const lines = candidates.map((c) => `  ${c.glob} - ${c.reason} - ${c.evidence}.`);
  return ["Folders left out of analysis:", ...lines].join("\n");
}

export function proposalText(candidates: ExcludeCandidate[]): string {
  return `${candidateBlock(candidates)}\nProposed exclusions (not applied; the contract is unchanged).\nAccept with: ${ACCEPT_EXCLUSIONS}`;
}

// Directory patterns from one .gitignore. `base` is the directory that holds the file ("" at the
// root). Only a pattern that names a directory we actually saw is returned. Negations and
// wildcards are not proposals: a wildcard does not name one folder.
export function gitignoreDirectories(text: string, base: string, dirs: readonly string[]): string[] {
  const have = new Set(dirs);
  const found: string[] = [];
  for (const pattern of ignorePatterns(text)) {
    for (const dir of dirs) {
      if (!matchesIgnore(pattern, base, dir) || !have.has(dir) || found.includes(dir)) continue;
      found.push(dir);
    }
  }
  return found.sort(byPath);
}

export function gitmodulesPaths(text: string): string[] {
  const paths: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*path\s*=\s*(.+?)\s*$/.exec(line);
    if (match === null) continue;
    const path = match[1]!.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
    if (path === "" || path.startsWith("/") || path.split("/").includes("..")) continue;
    if (!paths.includes(path)) paths.push(path);
  }
  return paths.sort(byPath);
}

function classify(dir: DirFacts, ignored: boolean, submodule: boolean, cargoParent: boolean): { reason: string; evidence: string } | null {
  const name = nameOf(dir.path);
  if (VENDOR.has(name)) return { reason: "vendored code", evidence: named(name, dir.files) };
  if (GENERATED.has(name) || name.endsWith("_pb")) return { reason: "generated output", evidence: generatedEvidence(dir, name) };
  if (codegen(name) && dir.generatedHeaders > 0) return { reason: "generated output", evidence: headerEvidence(dir) };
  if (DEPS.has(name) || (name === "target" && cargoParent)) return { reason: "dependency directory", evidence: named(name, dir.files) };
  if (FIXTURES.has(name)) return { reason: "test fixtures and snapshots", evidence: named(name, dir.files) };
  if (allOf(dir, dir.generatedHeaders)) return { reason: "generated output", evidence: headerEvidence(dir) };
  if (allOf(dir, dir.protobuf)) return { reason: "generated output", evidence: count(dir.protobuf, "generated protobuf file") };
  if (allOf(dir, dir.minified)) return { reason: "minified bundle", evidence: count(dir.minified, "minified file") };
  if (submodule) return { reason: "git submodule", evidence: "git submodule" };
  if (ignored) return { reason: "listed in .gitignore", evidence: `gitignore lists ${dir.path}/` };
  return null;
}

function allOf(dir: DirFacts, matched: number): boolean {
  return dir.complete && dir.files > 0 && matched === dir.files;
}

function generatedEvidence(dir: DirFacts, name: string): string {
  return dir.generatedHeaders > 0 ? headerEvidence(dir) : named(name, dir.files);
}

function headerEvidence(dir: DirFacts): string {
  const noun = dir.generatedHeaders === 1 ? "file" : "files";
  const lead = dir.complete ? "contains" : "contains at least";
  return `${lead} ${dir.generatedHeaders} ${noun} with a @generated header`;
}

function named(name: string, files: number): string {
  if (files === 0) return `directory name ${name}`;
  return `directory name ${name}; contains ${files} ${files === 1 ? "file" : "files"}`;
}

function count(n: number, noun: string): string {
  return `contains ${n} ${noun}${n === 1 ? "" : "s"}`;
}

function codegen(name: string): boolean {
  return name === "codegen" || name.endsWith("-codegen") || name.endsWith("_codegen");
}

function protectedPath(path: string): boolean {
  return path.split("/").some((part) => PROTECTED.has(part));
}

// A layer glob names the source under its literal prefix. Excluding that folder, anything inside
// it, or an ancestor that contains it would drop gated source. A bare `**` names no folder.
function dropsLayer(dir: string, globs: string[]): boolean {
  for (const glob of globs) {
    const head = literalHead(glob);
    if (head === "") continue;
    if (dir === head || dir.startsWith(`${head}/`) || head.startsWith(`${dir}/`)) return true;
  }
  return false;
}

function literalHead(glob: string): string {
  const parts = glob.split("/");
  const wild = parts.findIndex((part) => /[*?[{]/.test(part));
  return (wild < 0 ? parts : parts.slice(0, wild)).filter((part) => part !== "" && part !== "**").join("/");
}

function alreadyExcluded(dir: string, globs: string[]): boolean {
  const probe = `${dir}/file`;
  return globs.some((glob) => matches(glob, probe) || matches(glob, dir));
}

function treeGlob(dir: string): string {
  return `${dir.replace(/[*?[\]{}\\]/g, "\\$&")}/**`;
}

function outermost(found: ExcludeCandidate[]): ExcludeCandidate[] {
  const kept: ExcludeCandidate[] = [];
  const ordered = [...found].sort((a, b) => a.path.length - b.path.length || byPath(a.path, b.path));
  for (const item of ordered) {
    if (kept.some((have) => item.path === have.path || item.path.startsWith(`${have.path}/`))) continue;
    kept.push(item);
  }
  return kept.sort((a, b) => byPath(a.path, b.path));
}

interface IgnorePattern { rooted: boolean; parts: string }

function ignorePatterns(text: string): IgnorePattern[] {
  const found: IgnorePattern[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const pattern = onePattern(raw);
    if (pattern !== null) found.push(pattern);
  }
  return found;
}

function onePattern(raw: string): IgnorePattern | null {
  let line = cutComment(raw.trim());
  if (line === "" || line.startsWith("#") || line.startsWith("!")) return null;
  let rooted = line.startsWith("/");
  if (rooted) line = line.slice(1);
  const any = line.startsWith("**/");
  if (any) line = line.slice(3);
  if (line.endsWith("/")) line = line.slice(0, -1);
  if (line === "" || /[*?[]/.test(line)) return null;
  if (!any && line.includes("/")) rooted = true;
  return { rooted: rooted && !any, parts: line };
}

function cutComment(line: string): string {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "#" && line[i - 1] !== "\\") return line.slice(0, i).trim();
  }
  return line;
}

function matchesIgnore(pattern: IgnorePattern, base: string, dir: string): boolean {
  if (pattern.rooted) return dir === joinBase(base, pattern.parts);
  return dir === pattern.parts || dir.endsWith(`/${pattern.parts}`);
}

function joinBase(base: string, parts: string): string {
  return base === "" ? parts : `${base}/${parts}`;
}

function parentOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut < 0 ? "" : path.slice(0, cut);
}

function nameOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut < 0 ? path : path.slice(cut + 1);
}

function byPath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
