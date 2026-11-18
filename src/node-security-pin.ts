import type { NodeReleases } from "./types.ts";

// Exact Node.js pins compared with the patched releases stored on the check.
// The table is data in the lock. Gate time does not fetch it. The finding names
// the patched version from that table and never repeats the text from the file.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const CVE = /^CVE-\d{4}-\d{4,}$/;
const PRERELEASE_TAG = /^(?:rc|alpha|beta|pre|nightly|dev|canary|next)(?=$|[\d.-])/i;
export const NODE_PIN_DETAIL = /^Bump this exact Node\.js pin to \d+\.\d+\.\d+\. It is below the security patch for its release line\.$/;

export interface NodePinHit { line: number; floor: string }

interface Pin { line: number; value: string }
interface Triple { major: number; minor: number; patch: number }

export function nodePinDetail(floor: string): string {
  return `Bump this exact Node.js pin to ${floor}. It is below the security patch for its release line.`;
}

export function isNodePinFile(rel: string): boolean {
  const base = (rel.split("/").pop() ?? rel).toLowerCase();
  if (base === ".nvmrc" || base === ".node-version" || base === ".tool-versions" || base === "package.json") return true;
  if (base === "dockerfile" || base.startsWith("dockerfile.") || base.endsWith(".dockerfile")) return true;
  if (base === "action.yml" || base === "action.yaml" || base === ".gitlab-ci.yml") return true;
  return /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(rel);
}

// What is wrong with a releases table, or null when a future edit can replace the data as-is.
export function nodePinReleaseError(releases: unknown): string | null {
  if (releases === null || typeof releases !== "object" || Array.isArray(releases)) return "releases must be an object";
  const doc = releases as Record<string, unknown>;
  if (typeof doc.source !== "string" || !doc.source.startsWith("https://nodejs.org/")) return "releases.source must be an https://nodejs.org/ URL";
  if (typeof doc.date !== "string" || !DATE.test(doc.date)) return "releases.date must be YYYY-MM-DD";
  if (!Array.isArray(doc.lines) || doc.lines.length === 0) return "releases.lines must list at least one release line";
  const majors = new Set<number>();
  for (const line of doc.lines) {
    if (line === null || typeof line !== "object" || Array.isArray(line)) return "releases.lines entries must be objects";
    const row = line as Record<string, unknown>;
    if (typeof row.major !== "number" || !Number.isInteger(row.major) || row.major < 1) return "releases.lines.major must be a positive integer";
    if (majors.has(row.major)) return `releases.lines major ${row.major} is repeated`;
    majors.add(row.major);
    if (typeof row.version !== "string" || !row.version.startsWith(`${row.major}.`) || !VERSION.test(row.version)) {
      return `releases.lines version must be ${row.major}.minor.patch`;
    }
    if (!Array.isArray(row.high) || row.high.length === 0 || row.high.some((id) => typeof id !== "string" || !CVE.test(id))) {
      return "releases.lines.high must list CVE ids";
    }
  }
  return null;
}

export function staleNodePins(rel: string, text: string, releases: unknown): NodePinHit[] {
  if (!isNodePinFile(rel)) return [];
  const error = nodePinReleaseError(releases);
  if (error !== null) throw new Error(`node-pin ${error}`);
  const floors = new Map<number, { version: string; at: Triple }>();
  for (const line of (releases as NodeReleases).lines) {
    const at = exactRelease(line.version);
    if (at === null) throw new Error(`node-pin releases.lines version must be ${line.major}.minor.patch`);
    floors.set(line.major, { version: line.version, at });
  }
  const hits: NodePinHit[] = [];
  const seen = new Set<string>();
  for (const pin of pinsOf(rel, text)) {
    const exact = exactRelease(pin.value);
    if (exact === null) continue;
    const floor = floors.get(exact.major);
    if (floor === undefined || !older(exact, floor.at)) continue;
    const key = `${pin.line}\0${floor.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ line: pin.line, floor: floor.version });
  }
  return hits;
}

function older(pin: Triple, floor: Triple): boolean {
  if (pin.minor !== floor.minor) return pin.minor < floor.minor;
  return pin.patch < floor.patch;
}

// major.minor.patch, optional v or engines "=", optional distro suffix and image digest.
// Ranges, floating tags, and prerelease tags are not one exact pin.
function exactRelease(raw: string): Triple | null {
  let token = raw.trim();
  if (token === "" || /[\s|<>^~*]/.test(token)) return null;
  if (token.startsWith("=")) token = token.slice(1);
  if (/^v\d/i.test(token)) token = token.slice(1);
  const digest = token.indexOf("@");
  if (digest >= 0) token = token.slice(0, digest);
  const match = VERSION.exec(token) ?? /^(\d+)\.(\d+)\.(\d+)(-[A-Za-z][A-Za-z0-9.-]*)$/.exec(token);
  if (match === null) return null;
  const suffix = token.slice(match[1]!.length + match[2]!.length + match[3]!.length + 2);
  if (suffix !== "" && !isDistroSuffix(suffix)) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function isDistroSuffix(suffix: string): boolean {
  if (!suffix.startsWith("-")) return false;
  const body = suffix.slice(1);
  if (!/^[A-Za-z][A-Za-z0-9.]*(?:-[A-Za-z0-9.]+)*$/.test(body)) return false;
  return body.split("-").every((tag) => tag !== "" && !PRERELEASE_TAG.test(tag));
}

function pinsOf(rel: string, text: string): Pin[] {
  const base = (rel.split("/").pop() ?? rel).toLowerCase();
  if (base === "package.json") return packagePins(text);
  if (base === ".tool-versions") return toolPins(text);
  if (base === ".nvmrc" || base === ".node-version") return versionFilePins(text);
  if (base === "dockerfile" || base.startsWith("dockerfile.") || base.endsWith(".dockerfile")) return dockerPins(text);
  return yamlPins(text);
}

function versionFilePins(text: string): Pin[] {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const code = (lines[i] ?? "").replace(/#.*$/, "").trim();
    if (code === "") continue;
    return [{ line: i + 1, value: code.split(/\s+/)[0]! }];
  }
  return [];
}

function toolPins(text: string): Pin[] {
  const hits: Pin[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const code = (lines[i] ?? "").replace(/#.*$/, "").trim();
    if (code === "") continue;
    const [name, version] = code.split(/\s+/);
    if ((name === "node" || name === "nodejs") && version !== undefined) hits.push({ line: i + 1, value: version });
  }
  return hits;
}

function dockerPins(text: string): Pin[] {
  const hits: Pin[] = [];
  const lines = text.split(/\r?\n/);
  const from = /^\s*FROM\s+(?:--\S+\s+)*(?:\S+\/)?node:(\S+)/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s*#/.test(line)) continue;
    const match = from.exec(line);
    if (match?.[1] !== undefined) hits.push({ line: i + 1, value: match[1] });
  }
  return hits;
}

function yamlPins(text: string): Pin[] {
  const hits: Pin[] = [];
  const lines = text.split(/\r?\n/);
  const setup = text.includes("setup-node");
  const version = /(?:^|[\s{])node-version\s*:\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^#\s]+))/;
  const image = /(?:^|[\s{])(?:image|container)\s*:\s*(?:"(?:[^"\n]*\/)?node:([^"\n]*)"|'(?:[^'\n]*\/)?node:([^'\n]*)'|(?:\S+\/)?node:(\S+))/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s*(?:#|$)/.test(line)) continue;
    if (setup) {
      const match = version.exec(line);
      const value = match?.[1] ?? match?.[2] ?? match?.[3];
      if (value !== undefined) hits.push({ line: i + 1, value });
    }
    const pictured = image.exec(line);
    const tag = pictured?.[1] ?? pictured?.[2] ?? pictured?.[3];
    if (tag !== undefined) hits.push({ line: i + 1, value: tag });
  }
  return hits;
}

function packagePins(text: string): Pin[] {
  let doc: unknown;
  try { doc = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return [];
  const root = doc as Record<string, unknown>;
  const wanted = new Map<string, string>();
  for (const section of ["engines", "volta"]) {
    const body = root[section];
    if (body === null || typeof body !== "object" || Array.isArray(body)) continue;
    const node = (body as Record<string, unknown>).node;
    if (typeof node === "string") wanted.set(section, node);
  }
  return wanted.size === 0 ? [] : locatePackagePins(text, wanted);
}

function locatePackagePins(text: string, wanted: Map<string, string>): Pin[] {
  const hits: Pin[] = [];
  let i = 0;
  let depth = 0;
  let section: string | null = null;
  let arm: string | null = null;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '"') {
      const parsed = readJsonString(text, i);
      if (parsed === null) return hits;
      i = parsed.end;
      let j = i;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (text[j] !== ":") continue;
      if (depth === 1 && wanted.has(parsed.value)) arm = parsed.value;
      else if (section !== null && depth === 2 && parsed.value === "node") {
        const value = readJsonStringValue(text, j + 1);
        if (value !== null && value.value === wanted.get(section)) hits.push({ line: lineAt(text, value.start), value: value.value });
      }
      continue;
    }
    if (ch === "{") {
      depth++;
      if (arm !== null && depth === 2) section = arm;
      arm = null;
      i++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth < 2) section = null;
      arm = null;
      i++;
      continue;
    }
    i++;
  }
  return hits;
}

function readJsonStringValue(text: string, at: number): { value: string; start: number } | null {
  let i = at;
  while (i < text.length && /\s/.test(text[i]!)) i++;
  const parsed = readJsonString(text, i);
  return parsed === null ? null : { value: parsed.value, start: i };
}

function readJsonString(text: string, at: number): { value: string; end: number } | null {
  if (text[at] !== '"') return null;
  let i = at + 1;
  let value = "";
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === "\\") {
      const next = text[i + 1];
      if (next === undefined) return null;
      value += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next;
      i += 2;
      continue;
    }
    if (ch === '"') return { value, end: i + 1 };
    value += ch;
    i++;
  }
  return null;
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}
