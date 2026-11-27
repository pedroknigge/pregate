// Whether a package.json range is entirely at or after a gate such as >=16.0.0.
// A specifier that can still install an older release, or that this parser does not
// understand, does not match: a Next 15 app must not pick up a Next 16 denial.
import type { Read, VersionGate } from "./types.ts";

interface Semver { major: number; minor: number; patch: number }

const FIELDS = ["dependencies", "peerDependencies", "devDependencies"] as const;
const PART = "(?:0|[1-9][0-9]*|x|X|\\*)";
const VERSION = new RegExp(`^v?(${PART})(?:\\.(${PART}))?(?:\\.(${PART}))?(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$`);
const MINIMUM = /^>=(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

interface Bound { major: number; minor: number; patch: number; exclusive: boolean }
interface Interval { lower: Bound | null; upper: Bound | null }

// The nearest manifest that names `dependency` wins. A manifest that does not name it
// does not hide a parent. An unreadable manifest is skipped; a non-string declaration
// is present but unknown, so the walk stops.
function declaredPackageSpec(read: Read, rel: string, dependency: string): string | null {
  const segments = rel.split("/").slice(0, -1);
  for (;;) {
    const path = segments.length === 0 ? "package.json" : `${segments.join("/")}/package.json`;
    const text = read(path);
    if (text !== null) {
      const declared = specInManifest(text, dependency);
      if (declared !== undefined) return declared;
    }
    if (segments.length === 0) return null;
    segments.pop();
  }
}

export function versionGateMatches(read: Read, rel: string, gate: VersionGate): boolean {
  const spec = declaredPackageSpec(read, rel, gate.package);
  const minimum = minimumOf(gate.range);
  return spec !== null && minimum !== null && entirelyAtLeast(spec, minimum);
}

function minimumOf(range: string): Semver | null {
  const match = MINIMUM.exec(range.trim());
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) } : null;
}

// True when one understood alternative can still install a version below `version`.
// `latest`, `*`, a git URL, and an empty alternative are not evidence.
export function allowsBelow(spec: string, version: string): boolean {
  const minimum = minimumOf(`>=${version}`);
  if (minimum === null) return false;
  const normalized = normalizeSpec(spec);
  if (normalized === null) return false;
  const alternatives = normalized.split("||").map((part) => part.trim());
  if (alternatives.length === 0 || alternatives.some((part) => part === "")) return false;
  return alternatives.some((part) => {
    const interval = alternativeInterval(part);
    return interval !== null && !lowerClears(interval, minimum);
  });
}

// True only when every version the specifier allows is at least `minimum`.
// 16.0.0-canary.1 counts as Next 16: the gate is the release line, not the final tag.
export function entirelyAtLeast(spec: string, minimum: Semver): boolean {
  const normalized = normalizeSpec(spec);
  if (normalized === null) return false;
  const alternatives = normalized.split("||").map((part) => part.trim());
  if (alternatives.some((part) => part === "")) return false;
  return alternatives.every((part) => {
    const interval = alternativeInterval(part);
    return interval !== null && lowerClears(interval, minimum);
  });
}

function specInManifest(text: string, dependency: string): string | null | undefined {
  const parsed = json(text);
  if (parsed === undefined || typeof parsed !== "object" || parsed === null) return undefined;
  const manifest = parsed as Record<string, unknown>;
  for (const field of FIELDS) {
    const table = manifest[field];
    if (typeof table !== "object" || table === null || !Object.hasOwn(table, dependency)) continue;
    const value = (table as Record<string, unknown>)[dependency];
    return typeof value === "string" ? value.trim() : null;
  }
  return undefined;
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function normalizeSpec(spec: string): string | null {
  let text = spec.trim();
  if (text.startsWith("workspace:")) text = text.slice("workspace:".length).trim();
  const aliased = /^npm:[^@]+@(.+)$/.exec(text);
  if (aliased) text = aliased[1]!.trim();
  if (text === "" || text.includes(":") || text.includes("/") || /^(latest|next|canary|\*|x)$/i.test(text)) return null;
  return text;
}

function alternativeInterval(text: string): Interval | null {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(text);
  if (hyphen) {
    const lower = partialBound(hyphen[1]!, "lower");
    const upper = partialBound(hyphen[2]!, "upper");
    return lower && upper ? { lower, upper } : null;
  }
  let interval: Interval = { lower: null, upper: null };
  for (const token of text.split(/\s+/)) {
    const piece = tokenInterval(token);
    if (piece === null) return null;
    const next = intersect(interval, piece);
    if (next === null) return null;
    interval = next;
  }
  return interval;
}

function tokenInterval(token: string): Interval | null {
  if (token.startsWith("^")) return caret(token.slice(1));
  if (token.startsWith("~")) return tilde(token.slice(1));
  const operator = /^(>=|<=|>|<|=)\s*(\S+)$/.exec(token);
  if (operator) return comparator(operator[1]!, operator[2]!);
  return bare(token);
}

function caret(text: string): Interval | null {
  const version = numbers(text);
  if (version === null) return null;
  const [major, minor, patch] = version;
  const upper = major > 0 ? { major: major + 1, minor: 0, patch: 0 }
    : minor > 0 ? { major: 0, minor: minor + 1, patch: 0 }
    : { major: 0, minor: 0, patch: patch + 1 };
  return { lower: { major, minor, patch, exclusive: false }, upper: { ...upper, exclusive: true } };
}

function tilde(text: string): Interval | null {
  const version = numbers(text);
  if (version === null) return null;
  const [major, minor, patch] = version;
  const parts = stripBuild(text).split(".");
  const upper = parts.length < 2 ? { major: major + 1, minor: 0, patch: 0 } : { major, minor: minor + 1, patch: 0 };
  return { lower: { major, minor, patch, exclusive: false }, upper: { ...upper, exclusive: true } };
}

function comparator(op: string, text: string): Interval | null {
  const version = numbers(text);
  if (version === null || /[xX*]/.test(stripBuild(text))) return null;
  const [major, minor, patch] = version;
  const bound = { major, minor, patch, exclusive: op === ">" || op === "<" };
  if (op === ">" || op === ">=") return { lower: bound, upper: null };
  if (op === "<" || op === "<=") return { lower: null, upper: bound };
  return { lower: { major, minor, patch, exclusive: false }, upper: { major, minor, patch, exclusive: false } };
}

function bare(text: string): Interval | null {
  if (/[xX*]/.test(text)) return xRange(text);
  const version = numbers(text);
  if (version === null) return null;
  const [major, minor, patch] = version;
  const parts = stripBuild(text).split(".");
  if (parts.length >= 3) return { lower: { major, minor, patch, exclusive: false }, upper: { major, minor, patch, exclusive: false } };
  if (parts.length === 2) return { lower: { major, minor, patch: 0, exclusive: false }, upper: { major, minor: minor + 1, patch: 0, exclusive: true } };
  return { lower: { major, minor: 0, patch: 0, exclusive: false }, upper: { major: major + 1, minor: 0, patch: 0, exclusive: true } };
}

function xRange(text: string): Interval | null {
  const parts = stripBuild(text).split(".");
  if (parts.length === 0 || parts.length > 3) return null;
  const parsed = parts.map((part) => /^[xX*]$/.test(part) ? null : /^(0|[1-9]\d*)$/.test(part) ? Number(part) : undefined);
  if (parsed.some((part) => part === undefined)) return null;
  const major = parsed[0];
  const minor = parsed[1];
  const patch = parsed[2];
  if (major == null) return null;
  if (minor == null) return { lower: { major, minor: 0, patch: 0, exclusive: false }, upper: { major: major + 1, minor: 0, patch: 0, exclusive: true } };
  if (patch == null) return { lower: { major, minor, patch: 0, exclusive: false }, upper: { major, minor: minor + 1, patch: 0, exclusive: true } };
  return { lower: { major, minor, patch, exclusive: false }, upper: { major, minor, patch, exclusive: false } };
}

function partialBound(text: string, side: "lower" | "upper"): Bound | null {
  const interval = bare(text);
  if (interval === null) return null;
  return side === "lower" ? interval.lower : interval.upper;
}

function numbers(text: string): [number, number, number] | null {
  const match = VERSION.exec(text.trim());
  if (!match || [match[1], match[2], match[3]].some((value) => value !== undefined && /[xX*]/.test(value))) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function stripBuild(text: string): string {
  return text.trim().replace(/^v/, "").replace(/\+.*$/, "");
}

function intersect(left: Interval, right: Interval): Interval | null {
  const lower = tighterLower(left.lower, right.lower);
  const upper = tighterUpper(left.upper, right.upper);
  if (lower && upper && compare(lower, upper) > 0) return null;
  if (lower && upper && compare(lower, upper) === 0 && (lower.exclusive || upper.exclusive)) return null;
  return { lower, upper };
}

function tighterLower(left: Bound | null, right: Bound | null): Bound | null {
  if (left === null) return right;
  if (right === null) return left;
  const order = compare(left, right);
  if (order > 0) return left;
  if (order < 0) return right;
  return left.exclusive ? left : right;
}

function tighterUpper(left: Bound | null, right: Bound | null): Bound | null {
  if (left === null) return right;
  if (right === null) return left;
  const order = compare(left, right);
  if (order < 0) return left;
  if (order > 0) return right;
  return left.exclusive ? left : right;
}

// An exclusive lower bound equal to the minimum still sits on that release line
// (`>16.0.0` cannot install 15). An unbounded or older lower bound does not.
function lowerClears(interval: Interval, minimum: Semver): boolean {
  if (interval.lower === null) return false;
  return compare(interval.lower, { ...minimum, exclusive: false }) >= 0;
}

function compare(left: Bound, right: Bound): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

// A manifest or lockfile that can install `package` in [introduced, fixed). The bounds are
// exact triples. An unreadable spec is not a pin. Lockfiles contribute resolved versions only.
// Several advisory windows are separate calls: a pin inside any one window is enough.
const PIN_FILE = /(?:^|\/)(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock)$/;
const MANIFEST_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

interface DependencyPin { package: string; introduced: string; fixed: string }

export function isDependencyPinFile(rel: string): boolean {
  return PIN_FILE.test(rel) && !rel.split("/").includes("node_modules");
}

interface PinWindow { introduced: string; fixed: string }

// `ranges` is the window list. Without it, `introduced` and `fixed` are the one window.
export function pinWindows(params: Record<string, unknown>): PinWindow[] {
  if (Array.isArray(params.ranges)) return params.ranges.flatMap(asWindow);
  return asWindow(params);
}

function asWindow(value: unknown): PinWindow[] {
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  const introduced = record.introduced;
  const fixed = record.fixed;
  if (typeof introduced !== "string" || typeof fixed !== "string") return [];
  return [{ introduced, fixed }];
}

// The first line inside any window, in the order the windows are given.
export function dependencyPinHit(rel: string, text: string, name: string, ranges: readonly PinWindow[]): number | null {
  for (const range of ranges) {
    const line = dependencyPinLine(rel, text, { package: name, introduced: range.introduced, fixed: range.fixed });
    if (line !== null) return line;
  }
  return null;
}

// The first line that pins `pin.package` inside the half-open window, or null when the file
// is not a pin file or every readable spec sits outside the window.
export function dependencyPinLine(rel: string, text: string, pin: DependencyPin): number | null {
  if (!isDependencyPinFile(rel)) return null;
  const introduced = triple(pin.introduced);
  const fixed = triple(pin.fixed);
  if (introduced === null || fixed === null || pin.package === "" || compare(introduced, fixed) >= 0) return null;
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  return base === "package.json" ? manifestPinLine(text, pin.package, introduced, fixed) : lockPinLine(text, pin.package, introduced, fixed);
}

function triple(text: string): Bound | null {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(text)) return null;
  const parsed = numbers(text);
  return parsed === null ? null : { major: parsed[0], minor: parsed[1], patch: parsed[2], exclusive: false };
}

function manifestPinLine(text: string, name: string, introduced: Bound, fixed: Bound): number | null {
  const parsed = json(text);
  if (!isRecord(parsed)) return null;
  const specs: string[] = [];
  for (const field of MANIFEST_FIELDS) {
    const table = parsed[field];
    if (!isRecord(table) || typeof table[name] !== "string") continue;
    specs.push(table[name].trim());
  }
  if (!specs.some((spec) => specOverlaps(spec, introduced, fixed))) return null;
  const key = new RegExp(`"${escapeRegExp(name)}"\\s*:\\s*"([^"]*)"`);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = key.exec(lines[i]!);
    if (match && specOverlaps(match[1]!, introduced, fixed)) return i + 1;
  }
  return 1;
}

function specOverlaps(spec: string, introduced: Bound, fixed: Bound): boolean {
  const alternatives = spec.split("||").map((part) => part.trim());
  if (alternatives.length === 0 || alternatives.some((part) => part === "")) return false;
  return alternatives.some((part) => {
    const normalized = normalizeSpec(part);
    if (normalized === null) return false;
    const interval = alternativeInterval(normalized);
    return interval !== null && !entirelyBelow(interval, introduced) && !lowerClears(interval, fixed);
  });
}

function entirelyBelow(interval: Interval, floor: Bound): boolean {
  if (interval.upper === null) return false;
  const order = compare(interval.upper, floor);
  return order < 0 || (order === 0 && interval.upper.exclusive);
}

function lockPinLine(text: string, name: string, introduced: Bound, fixed: Bound): number | null {
  const parsed = json(text);
  if (parsed !== undefined) {
    const found: string[] = [];
    collectResolved(parsed, name, found);
    const bad = new Set(found.flatMap((version) => {
      const core = coreOf(version);
      return core !== null && exactCore(core, introduced, fixed) ? [core] : [];
    }));
    if (bad.size === 0) return null;
    return lineOfResolved(text, name, bad) ?? 1;
  }
  return lineScan(text, name, introduced, fixed);
}

function collectResolved(node: unknown, name: string, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectResolved(item, name, out);
    return;
  }
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const onKey = versionOnKey(key, name);
    if (onKey === "") {
      if (isRecord(value) && typeof value.version === "string") out.push(value.version);
      else if (Array.isArray(value) && typeof value[0] === "string") {
        const token = versionInToken(value[0], name);
        if (token) out.push(token);
      }
    } else if (onKey !== null) out.push(onKey);
    collectResolved(value, name, out);
  }
}

function versionOnKey(key: string, name: string): string | null {
  if (key === name || key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`)) return "";
  return versionInToken(key, name);
}

function versionInToken(token: string, name: string): string | null {
  const match = new RegExp(`(?:^|[\\s/'"])${escapeRegExp(name)}@(?:npm:)?(\\d+\\.\\d+\\.\\d+)(?![\\d.])`).exec(token);
  return match ? match[1]! : null;
}

function coreOf(version: string): string | null {
  const parsed = numbers(version.trim());
  return parsed === null ? null : `${parsed[0]}.${parsed[1]}.${parsed[2]}`;
}

function exactCore(core: string, introduced: Bound, fixed: Bound): boolean {
  const parsed = numbers(core);
  if (parsed === null) return false;
  const at = { major: parsed[0], minor: parsed[1], patch: parsed[2], exclusive: false };
  return compare(at, introduced) >= 0 && compare(at, fixed) < 0;
}

function lineOfResolved(text: string, name: string, bad: Set<string>): number | null {
  const lines = text.split("\n");
  const keyRe = new RegExp(`"(?:[^"\\n]*/)?(?:node_modules/)?${escapeRegExp(name)}"\\s*:`);
  const tokenRe = new RegExp(`${escapeRegExp(name)}@(?:npm:)?(\\d+\\.\\d+\\.\\d+)(?![\\d.])`);
  for (let i = 0; i < lines.length; i++) {
    if (!keyRe.test(lines[i]!)) continue;
    const end = blockEnd(lines, i);
    for (let j = i; j < end; j++) {
      const token = tokenRe.exec(lines[j]!);
      if (token && bad.has(token[1]!)) return j + 1;
      const ver = /"version"\s*:\s*"([^"]+)"/.exec(lines[j]!);
      const core = ver ? coreOf(ver[1]!) : null;
      if (core !== null && bad.has(core)) return j + 1;
    }
  }
  return null;
}

function blockEnd(lines: string[], start: number): number {
  const indent = leading(lines[start]!);
  for (let j = start + 1; j < lines.length; j++) {
    if (leading(lines[j]!) === indent && /"[^"]+"\s*:/.test(lines[j]!)) return j;
  }
  return Math.min(lines.length, start + 8);
}

function lineScan(text: string, name: string, introduced: Bound, fixed: Bound): number | null {
  const lines = text.split("\n");
  const escaped = escapeRegExp(name);
  const direct = new RegExp(`(?:^|[\\s/'"])${escaped}@(?:npm:)?(\\d+\\.\\d+\\.\\d+)(?![\\d.])`);
  const slash = new RegExp(`(?:^|[\\s'"])/${escaped}/(\\d+\\.\\d+\\.\\d+)(?![\\d.])`);
  for (let i = 0; i < lines.length; i++) {
    const match = direct.exec(lines[i]!) ?? slash.exec(lines[i]!);
    if (match && exactCore(match[1]!, introduced, fixed)) return i + 1;
  }
  const header = new RegExp(`(?:^|\\s)${escaped}(?:@[^\\s]*)?:\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (!header.test(lines[i]!)) continue;
    const indent = leading(lines[i]!);
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j]!.trim() === "") continue;
      if (leading(lines[j]!) <= indent) break;
      const ver = /(?:^|\s)version:?\s+"?(\d+\.\d+\.\d+)/.exec(lines[j]!);
      if (ver && exactCore(ver[1]!, introduced, fixed)) return j + 1;
    }
  }
  return null;
}

function leading(line: string): number {
  return /^\s*/.exec(line)![0].length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
