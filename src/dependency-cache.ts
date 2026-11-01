import { chmodSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { absolutePath, slash } from "./paths.ts";
import { sha256, stateDir } from "./state.ts";
import type { DependencyGraph } from "./dependencies.ts";

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_PROJECTS = 32;
// Bump when import extraction, candidate filtering or resolver reads change.
const RESOLVER = "dependency-reads-v1";
interface Input { path: string; hash: string | null; identity: string }
export interface DependencyInputs { path: string; hash: string; context: string; inputs: Input[] }
interface DependencyValidation { hash: (path: string) => string | null; identity?: (path: string) => string }
interface DependencyReadSet { inputs: Map<string, string | null>; identity?: (path: string) => string }
export interface DependencyCache extends DependencyGraph {
  root: string; file: string; entries: Map<string, DependencyInputs>; bytes: number; dirty: boolean;
  stats: { reusedFiles: number; resolvedFiles: number; invalidatedFiles: number; persisted: boolean; error: string | null };
}

// Persist the resolver's exact reads, including absent candidates. Never store
// findings, forms or a passing verdict. A cache failure falls back to resolution.
export function openDependencyCache(root: string): DependencyCache {
  const canonicalRoot = slash(root);
  const cache: DependencyCache = { root: canonicalRoot, file: join(stateDir(), "dependencies", sha256(canonicalRoot) + ".json"), entries: new Map(), bytes: 0, dirty: false,
    fingerprint: hashText,
    lookup: (path, text, context, hash, identity) => cachedDependencyInputs(cache, path, text, context, { hash, identity }),
    remember: (path, text, context, inputs, identity) => rememberDependencyInputs(cache, path, text, context, { inputs, identity }),
    prune: paths => pruneDependencyCache(cache, paths),
    save: () => saveDependencyCache(cache),
    stats: { reusedFiles: 0, resolvedFiles: 0, invalidatedFiles: 0, persisted: false, error: null } };
  loadSavedEntries(cache);
  return cache;
}

function loadSavedEntries(cache: DependencyCache): void {
  try {
    if (!existsSync(cache.file)) return;
    const saved = readSaved(cache.file);
    if (saved.version !== 1 || saved.resolver !== RESOLVER || saved.root !== cache.root || !Array.isArray(saved.entries)) return;
    const entriesJson = JSON.stringify(saved.entries);
    if (saved.digest !== sha256(entriesJson) || !saved.entries.every(validEntry)
      || saved.signature !== signature(cache, entriesJson, false)) return;
    for (const entry of saved.entries as DependencyInputs[]) {
      cache.entries.set(entry.path, entry); cache.bytes += entryBytes(entry);
    }
  } catch { cache.stats.error = "Dependency cache unavailable; resolver reads will be rebuilt."; }
}

function readSaved(file: string) {
  return closingAfter(openSync(file, "r"), readBoundedJson);
}

function closingAfter<T>(fd: number, use: (fd: number) => T): T {
  try { return use(fd); } finally { closeSync(fd); }
}

function readBoundedJson(fd: number) {
  const size = fstatSync(fd).size;
  if (size > MAX_BYTES) throw new Error("Dependency cache exceeds byte budget");
  const bytes = Buffer.alloc(size + 1);
  let count = 0;
  while (count < bytes.length) {
    const n = readSync(fd, bytes, count, bytes.length - count, null);
    if (!n) break;
    count += n;
  }
  if (count !== size) throw new Error("Dependency cache changed during bounded read");
  return JSON.parse(bytes.subarray(0, count).toString("utf8"));
}

export function cachedDependencyInputs(cache: DependencyCache, path: string, text: string, context: string, validation: DependencyValidation): DependencyInputs | null {
  const { hash, identity } = validation;
  const entry = cache.entries.get(path);
  if (!entry) return null;
  if (entry.context !== context || entry.hash !== hashText(text) || entry.inputs.some(input => input.hash !== hash(input.path)
    || input.identity !== (identity?.(input.path) ?? input.path))) {
    cache.stats.invalidatedFiles++; return null;
  }
  cache.stats.reusedFiles++;
  return entry;
}

export function rememberDependencyInputs(cache: DependencyCache, path: string, text: string, context: string, reads: DependencyReadSet): void {
  const { inputs, identity } = reads;
  cache.stats.resolvedFiles++;
  const previous = cache.entries.get(path);
  if (previous) { cache.bytes -= entryBytes(previous); cache.entries.delete(path); cache.dirty = true; }
  const entry: DependencyInputs = { path, hash: hashText(text), context, inputs: [...inputs].map(([path, hash]) => ({ path, hash, identity: identity?.(path) ?? path })) };
  if (!validEntry(entry)) return;
  const bytes = entryBytes(entry);
  if (bytes > MAX_BYTES / 2) return;
  while (cache.bytes + bytes > MAX_BYTES - 1024 && cache.entries.size) {
    const oldest = cache.entries.keys().next().value!;
    cache.bytes -= entryBytes(cache.entries.get(oldest)!); cache.entries.delete(oldest);
  }
  cache.entries.set(path, entry); cache.bytes += bytes; cache.dirty = true;
}

export function pruneDependencyCache(cache: DependencyCache, paths: Set<string>): void {
  for (const [path, entry] of cache.entries) if (!paths.has(path)) {
    cache.entries.delete(path); cache.bytes -= entryBytes(entry); cache.dirty = true;
  }
}

export function saveDependencyCache(cache: DependencyCache): void {
  if (!cache.dirty) return;
  const entries = [...cache.entries.values()];
  const folder = dirname(cache.file), temporary = `${cache.file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeCheckpoint(cache, entries, folder, temporary);
}

function writeCheckpoint(cache: DependencyCache, entries: DependencyInputs[], folder: string, temporary: string): void {
  try {
    mkdirSync(folder, { recursive: true });
    const entriesJson = JSON.stringify(entries), digest = sha256(entriesJson), sig = signature(cache, entriesJson, true);
    const text = `{"version":1,"resolver":${JSON.stringify(RESOLVER)},"root":${JSON.stringify(cache.root)},"entries":${entriesJson},"digest":${JSON.stringify(digest)},"signature":${JSON.stringify(sig)}}`;
    if (Buffer.byteLength(text) > MAX_BYTES) { cache.stats.error = "Dependency cache byte budget reached; resolution remains valid."; return; }
    const files = readdirSync(folder).filter(path => /^[0-9a-f]{64}\.json$/.test(path)).map(path => join(folder, path))
      .filter(path => path !== cache.file).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const file of files.slice(MAX_PROJECTS - 1)) rmSync(file);
    writeFileSync(temporary, text, { mode: 0o600 }); renameSync(temporary, cache.file); chmodSync(cache.file, 0o600);
    cache.dirty = false; cache.stats.persisted = true;
  } catch { cache.stats.error = "Dependency cache checkpoint unavailable; resolution remains valid."; }
  finally { removeTemporary(cache, temporary); }
}

function removeTemporary(cache: DependencyCache, temporary: string): void {
  try { rmSync(temporary, { force: true }); } catch { cache.stats.error = "Dependency cache temporary-file cleanup unavailable."; }
}

// A content checksum alone cannot prove that a graph lists every resolver read.
// Authenticate engine-produced checkpoints with a separate key in protected
// engine state. Whoever controls both files is the trusted local state owner.
function signature(cache: DependencyCache, entriesJson: string, create: boolean): string {
  const file = join(dirname(cache.file), "checkpoint.key");
  if (create && !existsSync(file)) createCheckpointKey(file);
  const key = closingAfter(openSync(file, "r"), readCheckpointKey);
  return new Bun.CryptoHasher("sha256", key).update(`[1,${JSON.stringify(RESOLVER)},${JSON.stringify(cache.root)},${entriesJson}]`).digest("hex");
}

function createCheckpointKey(file: string): void {
  try { closingAfter(openSync(file, "wx", 0o600), fd => writeFileSync(fd, crypto.getRandomValues(new Uint8Array(32)))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
}

function readCheckpointKey(fd: number): Buffer {
  if (fstatSync(fd).size !== 32) throw new Error("Dependency checkpoint key invalid");
  const key = Buffer.alloc(33), bytes = readSync(fd, key, 0, key.length, null);
  if (bytes !== 32) throw new Error("Dependency checkpoint key changed");
  return key.subarray(0, 32);
}

const safePaths = new Map<string, boolean>();
const entrySizes = new WeakMap<DependencyInputs, number>();
const textHashes = new Map<string, string>();

function hashText(text: string): string {
  if (textHashes.has(text)) return textHashes.get(text)!;
  const h = sha256(text);
  if (textHashes.size < 8192 && text.length <= 65536) textHashes.set(text, h);
  return h;
}

function safePath(path: string): boolean {
  if (safePaths.has(path)) return safePaths.get(path)!;
  const ok = path.length > 0 && !absolutePath(path) && !path.includes("\\") && !path.includes("\0") && posix.normalize(path) === path
    && path !== ".." && !path.startsWith("../");
  if (safePaths.size < 16384) safePaths.set(path, ok);
  return ok;
}

function entryBytes(entry: DependencyInputs): number {
  const cached = entrySizes.get(entry);
  if (cached !== undefined) return cached;
  let size = 48 + entry.path.length + entry.hash.length + entry.context.length;
  for (const input of entry.inputs) size += 35 + input.path.length + input.identity.length + (input.hash ? input.hash.length + 2 : 4);
  entrySizes.set(entry, size);
  return size;
}

function validEntry(entry: unknown): entry is DependencyInputs {
  if (entry === null || typeof entry !== "object") return false;
  const e = entry as DependencyInputs;
  return typeof e.path === "string" && safePath(e.path) && typeof e.hash === "string" && /^[0-9a-f]{64}$/.test(e.hash)
    && typeof e.context === "string" && /^[0-9a-f]{64}$/.test(e.context)
    && Array.isArray(e.inputs) && e.inputs.every(input => input !== null && typeof input === "object"
      && typeof input.path === "string" && safePath(input.path) && typeof input.identity === "string" && safePath(input.identity)
      && (input.hash === null || typeof input.hash === "string" && /^[0-9a-f]{64}$/.test(input.hash)));
}
