import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { hashPolicy, readTree, writeAtomic } from "./disk.ts";
import { LOCK, PRESET, readText } from "./inertia.ts";
import { cachedPackEntry } from "./packs.ts";
import { sha256, stateDir } from "./state.ts";
import type { Lock, Preset } from "./types.ts";
import { VERSIONS } from "./versions.ts";

// Compiled-lock cache for hook admission. The before-edit analysis is never stored (A12):
// only the compiler's canonical lock text, and only when it equals the normalized lock file.
// The key is the content of that lock, the preset that selects and parameterizes the rules,
// every builtin, library, path and pinned Git pack compile reads, and this pregate build
// (engine, core, and the compiler fingerprint). Any of those bytes changing misses.
// A missing, truncated, or digest-mismatched file is ignored and the caller recompiles.

const CACHE_VERSION = 1;
const CACHE_ID = "compiled-lock-v1";
const MAX_BYTES = 32 * 1024 * 1024;

interface Entry { v: number; key: string; text: string; digest: string }
interface Hit { root: string; key: string; preset: string; lock: string }
interface EmbeddedIdentity { builtin: string; libraries: Record<string, string>; compiler: string }

const admitted = new WeakMap<Lock, Hit>();
// The key loadCompiledLock last hashed for each root. storeCompiledLock follows a miss in the
// same lockOf call with the same bytes, so it reuses that pass instead of reading packs again.
const lastKey = new Map<string, Hit>();
let embedded: EmbeddedIdentity | null = null;

export function loadCompiledLock(root: string, presetText: string, lockText: string): { lock: Lock; hash: string } | null {
  const normalized = lockText.replaceAll("\r\n", "\n");
  const entry = readRawEntry(root);
  // A digest-valid entry whose text still equals the lock file may reuse admission only when the
  // cache key still binds preset, packs and build; otherwise the caller recompiles and denies stale.
  if (entry !== null && entry.text === normalized) {
    const key = compiledLockKey(root, presetText, normalized);
    if (key !== null && key === entry.key) {
      const lock = parseLock(entry.text);
      if (lock === null) return null;
      const hit: Hit = { root, key, preset: presetText, lock: normalized };
      lastKey.set(root, hit);
      admitted.set(lock, hit);
      return { lock, hash: sha256(lockText) };
    }
  }
  return null;
}

export function storeCompiledLock(root: string, presetText: string, compiledText: string): void {
  const last = lastKey.get(root);
  const key = last !== undefined && last.preset === presetText && last.lock === compiledText
    ? last.key
    : compiledLockKey(root, presetText, compiledText);
  if (key === null || Buffer.byteLength(compiledText) > MAX_BYTES) return;
  const file = cacheFile(root);
  try {
    mkdirSync(dirname(file), { recursive: true });
    const body = { v: CACHE_VERSION, key, text: compiledText };
    writeAtomic(file, JSON.stringify({ ...body, digest: digestOf(body) }));
  } catch (error) {
    // The compiled lock is already what admission returns. A filesystem error leaves the
    // cache unwritten, and the next hook recompiles. Any other error is a bug.
    if (typeof (error as NodeJS.ErrnoException).code === "string") return;
    throw error;
  }
}

// True when this process admitted `lock` from a cache entry and the preset and lock files
// still hold the bytes that admission keyed. Admission already hashed every pack in this
// process; the key is not derived a second time.
export function cachedSourcesMatch(root: string, lock: Lock): boolean {
  const hit = admitted.get(lock);
  if (hit === undefined || hit.root !== root) return false;
  const preset = readText(join(root, PRESET));
  const disk = readText(join(root, LOCK));
  if (preset === null || disk === null) return false;
  return preset === hit.preset && disk.replaceAll("\r\n", "\n") === hit.lock;
}

function compiledLockKey(root: string, presetText: string, normalizedLock: string): string | null {
  const sources = presetSources(presetText);
  if (sources === null) return null;
  const packs: string[] = [];
  for (const source of sources) {
    const hash = packHash(root, source);
    if (hash === null) return null;
    packs.push(hash);
  }
  const id = identity();
  return sha256(JSON.stringify([
    CACHE_ID, VERSIONS.engine, VERSIONS.core, id.compiler, sha256(normalizedLock), sha256(presetText), packs,
  ]));
}

function presetSources(presetText: string): Preset["sources"] | null {
  try {
    const value: unknown = JSON.parse(presetText);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const sources = (value as { sources?: unknown }).sources;
    return Array.isArray(sources) ? sources as Preset["sources"] : null;
  } catch {
    return null;
  }
}

// The key is computed before compile validates the preset, so a malformed source yields no
// key (the caller compiles and reports the errors) rather than an exception.
function packHash(root: string, source: Preset["sources"][number]): string | null {
  if (source === null || typeof source !== "object") return null;
  if (source.kind === "builtin") return identity().builtin;
  if (source.kind === "library") return typeof source.ns === "string" ? identity().libraries[source.ns] ?? null : null;
  if (source.kind === "path") return typeof source.path === "string" ? pathHash(root, source.path) : null;
  if (source.kind !== "git") return null;
  // The pin's data-tree hash already covers every byte of the verified pack.
  return cachedPackEntry(source)?.hash ?? null;
}

function pathHash(root: string, path: string): string | null {
  const dir = resolve(root, path);
  if (!existsSync(dir)) return null;
  return hashPolicy(readTree(dir, false));
}

function identity(): EmbeddedIdentity {
  if (embedded !== null) return embedded;
  const catalog = require("./embedded.ts") as typeof import("./embedded.ts");
  const packs = require("./library-assets.ts") as typeof import("./library-assets.ts");
  embedded = {
    builtin: catalog.builtinContentHash(),
    libraries: packs.libraryContentHashes(),
    compiler: catalog.evaluator(),
  };
  return embedded;
}

function cacheFile(root: string): string {
  return join(stateDir(), "locks", `${sha256(root)}.json`);
}

function readRawEntry(root: string): Entry | null {
  try {
    const bytes = readFileSync(cacheFile(root));
    if (bytes.byteLength > MAX_BYTES) return null;
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!isEntry(parsed) || digestOf(parsed) !== parsed.digest) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseLock(text: string): Lock | null {
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Lock;
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is Entry {
  if (value === null || typeof value !== "object") return false;
  const entry = value as Entry;
  return entry.v === CACHE_VERSION && typeof entry.key === "string" && typeof entry.text === "string" && typeof entry.digest === "string";
}

function digestOf(entry: Pick<Entry, "v" | "key" | "text">): string {
  return sha256(JSON.stringify({ v: entry.v, key: entry.key, text: entry.text }));
}
