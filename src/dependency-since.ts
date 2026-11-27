// A pattern `since` stays quiet unless a named dependency is known to be at least that version.
// The first name with evidence decides. A parsed lower bound below the floor wins over a newer
// hoisted install, so a Prisma 6 package is not denied because a sibling resolved Prisma 7.
import { allowsBelow } from "./package-version.ts";
import { compareVersions } from "./product.ts";
import type { Read } from "./types.ts";

interface DependencySince { dependencies: string[]; version: string }

const FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
const COMPARATOR = /^(<=|>=|<|>|\^|~|==|=)?\s*(v?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.]+)?)$/;

export function dependencySatisfies(read: Read, rel: string, since: DependencySince): boolean {
  const floor = canonical(since.version);
  if (floor === null || since.dependencies.length === 0) return false;
  for (const name of since.dependencies) {
    const declared = nearestDeclared(read, rel, name);
    const installed = nearestInstalled(read, rel, name);
    if (declared === null && installed === null) continue;
    const bound = declared === null ? null : lowerBound(declared);
    // A range that still allows an older release is not evidence of the upgrade.
    if (bound !== null && compareVersions(bound, floor) < 0) return false;
    if (installed !== null) {
      const exact = canonical(installed);
      return exact !== null && compareVersions(exact, floor) >= 0;
    }
    return bound !== null && compareVersions(bound, floor) >= 0;
  }
  return false;
}

// True when the first named dependency with evidence can still install, or has installed,
// a version below `until.version`. A range that can install below the floor wins over a
// newer copy in node_modules. An unreadable spec with no older install stays quiet.
export function dependencyBelow(read: Read, rel: string, until: DependencySince): boolean {
  if (canonical(until.version) === null || until.dependencies.length === 0) return false;
  for (const name of until.dependencies) {
    const declared = nearestDeclared(read, rel, name);
    const installed = nearestInstalled(read, rel, name);
    if (declared === null && installed === null) continue;
    if (declared !== null && allowsBelow(declared, until.version)) return true;
    if (installed !== null) {
      const exact = canonical(installed);
      if (exact !== null && compareVersions(exact, until.version) < 0) return true;
    }
    return false;
  }
  return false;
}

function nearestDeclared(read: Read, rel: string, name: string): string | null {
  for (const dir of ancestors(rel)) {
    const spec = declared(read(at(dir, "package.json")), name);
    if (spec !== null) return spec;
  }
  return null;
}

function nearestInstalled(read: Read, rel: string, name: string): string | null {
  for (const dir of ancestors(rel)) {
    const version = versionOf(read(at(dir, `node_modules/${name}/package.json`)));
    if (version !== null) return version;
  }
  return null;
}

function declared(text: string | null, name: string): string | null {
  const doc = parse(text);
  if (doc === null) return null;
  for (const field of FIELDS) {
    const block = doc[field];
    if (typeof block !== "object" || block === null || Array.isArray(block)) continue;
    const spec = (block as Record<string, unknown>)[name];
    if (typeof spec === "string" && spec.trim() !== "") return spec.trim();
  }
  return null;
}

function versionOf(text: string | null): string | null {
  const version = parse(text)?.version;
  return typeof version === "string" && version.trim() !== "" ? version.trim() : null;
}

function parse(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const value = Bun.JSONC.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

// The minimum version a range can install, or null when the text does not prove one.
function lowerBound(spec: string): string | null {
  let text = spec.trim();
  if (text.startsWith("workspace:")) text = text.slice("workspace:".length).trim();
  if (text === "" || text === "*" || text === "latest" || text === "next" || /^(catalog|file|link|npm|git|github|http|https):/.test(text)) return null;
  if (text.includes("||")) {
    const parts = text.split("||").map((part) => lowerBound(part.trim()));
    if (parts.some((part) => part === null)) return null;
    return parts.reduce((min, part) => compareVersions(min!, part!) <= 0 ? min : part);
  }
  if (text.includes(" - ")) return null;
  let bound: string | null = null;
  for (const token of text.split(/\s+/)) {
    const match = COMPARATOR.exec(token);
    if (!match) return null;
    const op = match[1] ?? "=";
    const version = canonical(match[2]!);
    if (version === null) return null;
    // An upper bound does not raise the floor. `>6.0.0` still installs 6.x, so its bound stays
    // 6.0.0 and the caller rejects it. `>7.0.0` cannot install 6, and 7.0.0 meets a 7.0.0 floor.
    if (op === "<" || op === "<=") continue;
    if (bound === null || compareVersions(version, bound) > 0) bound = version;
  }
  return bound;
}

function canonical(raw: string): string | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.]+))?$/.exec(raw.trim());
  if (!match) return null;
  const core = `${match[1]}.${match[2] ?? "0"}.${match[3] ?? "0"}`;
  return match[4] === undefined ? core : `${core}-${match[4]}`;
}

function ancestors(rel: string): string[] {
  const dirs: string[] = [];
  let dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  for (;;) {
    dirs.push(dir);
    if (dir === "") break;
    const slash = dir.lastIndexOf("/");
    dir = slash < 0 ? "" : dir.slice(0, slash);
  }
  return dirs;
}

function at(dir: string, name: string): string {
  return dir === "" ? name : `${dir}/${name}`;
}
