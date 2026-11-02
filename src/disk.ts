import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, read, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { Files } from "./types.ts";
import { slash } from "./paths.ts";

// One reader for every rule source: the builtin catalog (at bundle time, as a macro) and `path`
// sources. Without fixtures it keeps only the evaluable JSON; fixture folders also hold code files.
// Anything that is neither a file nor a folder (a symlink) throws instead of being skipped.
export function readTree(dir: string, withFixtures: boolean): Files {
  const files: Files = {};
  const walk = (rel: string): void => {
    for (const entry of readdirSync(`${dir}/${rel}`, { withFileTypes: true })) {
      const path = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (withFixtures || entry.name !== "fixtures") walk(path);
      } else if (!entry.isFile()) {
        throw new Error(`${dir}/${path}: not a regular file or folder`);
      } else if (withFixtures || path.endsWith(".json")) {
        files[path] = readFileSync(`${dir}/${path}`, "utf8");
      }
    }
  };
  walk("");
  return files;
}

// Content identity of a rule pack: sorted paths, each hashed, then the list. Callers that
// compile and callers that only check the cache must use this same bytes.
export function hashPolicy(files: Files): string {
  const rows = Object.keys(files).sort().map((path) => [path, sha256(files[path]!)]);
  return sha256(JSON.stringify(rows));
}

// Macros run with whatever directory the bundler inherited. The shipped trees live next to
// this file, not in that directory.
const sourceRoot = join(import.meta.dir, "..");

// Build-time identities. Macro callers pass no dynamic arguments, so the result inlines as data.
export function readCatalog(): Files {
  return readTree(join(sourceRoot, "catalog"), false);
}
export function readAssets(): Files {
  return readTree(join(sourceRoot, "assets"), true);
}
export function readDemo(): Files {
  return readTree(join(sourceRoot, "examples/demo"), true);
}
export function installEvaluator(): string {
  return evaluationFingerprint(sourceRoot);
}
export function builtinContentHash(): string {
  return hashPolicy(readCatalog());
}

export function libraryPackHashes(): Record<string, string> {
  const grouped = new Map<string, Files>();
  for (const [path, text] of Object.entries(readLibrary(false))) {
    const slash = path.indexOf("/");
    const ns = path.slice(0, slash);
    const rel = path.slice(slash + 1);
    const pack = grouped.get(ns) ?? {};
    pack[rel] = text;
    grouped.set(ns, pack);
  }
  const hashes: Record<string, string> = {};
  for (const [ns, files] of grouped) if (files["source.json"] !== undefined) hashes[ns] = hashPolicy(files);
  return hashes;
}

function sha256(text: string): string {
  return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

// The shipped library includes executable data and fixtures, not normative prose catalogs.
export function readLibrary(withFixtures = true): Files {
  return Object.fromEntries(Object.entries(readTree(join(sourceRoot, "packs"), withFixtures))
    .filter(([path]) => /^[^/]+\/(source\.json$|checks\/|methodologies\/)/.test(path)));
}

// Build-time identity of the evaluator, schemas and executable parser inputs.
// Cache identity must change even for two development builds with the same version.
export function evaluationFingerprint(root = "."): string {
  const files = Object.fromEntries(["src", "schema"].flatMap((dir) => Object.entries(readTree(join(root, dir), true)).map(([p, v]) => [`${dir}/${p}`, v])));
  const hashes = Object.keys(files).sort().map((p) => [p, new Bun.CryptoHasher("sha256").update(files[p]!).digest("hex")]);
  for (const p of ["web-tree-sitter/web-tree-sitter.js", "web-tree-sitter/web-tree-sitter.wasm", "tree-sitter-typescript/tree-sitter-typescript.wasm",
    "tree-sitter-typescript/tree-sitter-tsx.wasm", "tree-sitter-python/tree-sitter-python.wasm", "tree-sitter-go/tree-sitter-go.wasm", "tree-sitter-rust/tree-sitter-rust.wasm"]) {
    hashes.push([`vendor/${p}`, new Bun.CryptoHasher("sha256").update(readFileSync(join(root, "vendor", p))).digest("hex")]);
  }
  return new Bun.CryptoHasher("sha256").update(JSON.stringify([Bun.version, hashes])).digest("hex");
}

// Use descriptor callbacks, not Bun.stdin.text(): the latter lost Windows payloads. A referenced
// deadline also keeps the runtime alive until EOF. Entrypoints exit after a timeout, ending any
// outstanding OS read; this helper does not promise to cancel a blocked descriptor in-process.
export const MAX_STDIN_BYTES = 16 * 1024 * 1024;
export const STDIN_DEADLINE_MS = 5000;
export const STDIN_TIMEOUT = `stdin timed out before EOF (${STDIN_DEADLINE_MS / 1000} s)`;
export async function readStdin(): Promise<{ bytes: Buffer; text: string; invalid: boolean; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), STDIN_DEADLINE_MS); });
  return stdinBefore(deadline, timer);
}

async function stdinBefore(deadline: Promise<null>, timer: ReturnType<typeof setTimeout> | undefined) {
  try { return await stdinUntil(deadline); } finally { clearTimeout(timer); }
}

async function stdinUntil(deadline: Promise<null>) {
  const chunks: Buffer[] = [];
  const chunk = Buffer.allocUnsafe(64 * 1024);
  let size = 0;
  for (;;) {
    const length = await Promise.race([stdinChunk(chunk, Math.min(chunk.length, MAX_STDIN_BYTES - size + 1)), deadline]);
    if (length === null || length === 0) return stdinText(Buffer.concat(chunks, size), length === null);
    size += length;
    if (size > MAX_STDIN_BYTES) return { bytes: Buffer.alloc(0), text: "", invalid: true, timedOut: false };
    chunks.push(Buffer.from(chunk.subarray(0, length)));
  }
}

function stdinChunk(chunk: Buffer, length: number): Promise<number> {
  return new Promise((resolve, reject) => {
    read(0, chunk, 0, length, null, (error, size) => error ? reject(error) : resolve(size));
  });
}

function stdinText(bytes: Buffer, timedOut: boolean) {
  try {
    return { bytes, text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes), invalid: timedOut, timedOut };
  } catch {
    // Replacement decoding can locate a consenting root, but never admits a malformed input.
    return { bytes, text: bytes.toString("utf8"), invalid: true, timedOut };
  }
}

function lexists(path: string): boolean {
  try {
    return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT" || (e as NodeJS.ErrnoException).code === "ENOTDIR") return false;
    throw e;
  }
}

// The path a write to `abs` lands on: realpath of the deepest existing ancestor plus the rest. A
// dangling symlink on the way is replaced by its target, since writing through it creates the
// target. A symlink loop throws (ELOOP or too many hops): unforeseen, so the launcher denies.
export function canonical(abs: string): string {
  let path = abs;
  for (let hops = 0; hops < 40; hops++) {
    let existing = path;
    let rest = "";
    for (;;) {
      const real = realPathOf(existing, rest);
      if (real !== null) return real;
      if (lexists(existing)) break;
      if (dirname(existing) === existing) throw new Error(`${abs}: no existing ancestor`);
      rest = rest === "" ? basename(existing) : `${basename(existing)}/${rest}`;
      existing = dirname(existing);
    }
    path = resolve(dirname(existing), readlinkSync(existing), rest);
  }
  throw new Error(`${abs}: too many symbolic links`);
}

// Null when `existing` does not exist or is a dangling symlink.
function realPathOf(existing: string, rest: string): string | null {
  try {
    return slash(join(realpathSync(existing), rest));
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return null;
    throw e;
  }
}

// The first directory from `abs` upward holding .pregate/preset.json that `accepted` takes (A20).
export function findRoot(abs: string, accepted: (root: string) => boolean): string | null {
  for (let dir = abs; ; dir = dirname(dir)) {
    if (existsSync(`${dir}/.pregate/preset.json`) && accepted(slash(dir))) return slash(dir);
    if (existsSync(`${dir}/.git`)) return null;
    if (dirname(dir) === dir) return null;
  }
}

// The accepted root the spelled path sits in, when its canonical target sits in no accepted root:
// a symlink, or a path through one, would write where no lock can see it. Null when the target
// lands in an accepted root, the same or another one (a nested root, a sibling): the root that
// holds the target judges it, as any canonical path. Callers judge an escape by the spelled path,
// so a target out of the root's scope stays out of scope and a judged path cannot slip out.
export function escapedRoot(spelled: string, landed: string, accepted: (root: string) => boolean): string | null {
  const home = findRoot(dirname(resolve(spelled)), accepted);
  if (home === null || findRoot(dirname(landed), accepted) !== null) return null;
  return home;
}

// Readers see the old file or the new one, never a partial write.
export function writeAtomic(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, text);
  renameOrDiscard(tmp, path);
}

function renameOrDiscard(tmp: string, path: string): void {
  try {
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

const LOCKED = new Set(["EBUSY", "EPERM", "EACCES", "ENOTEMPTY"]);
const pause = new Int32Array(new SharedArrayBuffer(4));

// Windows refuses to rename or delete a file that another process holds open without delete sharing.
// An on-access scanner opens a new executable that way for a moment after it is written or first run.
// Wait for that handle to close. A lock that outlasts `waitMs` is still an error.
function whenReleased(run: () => void, waitMs: number, windows: boolean): void {
  const deadline = Date.now() + waitMs;
  for (let delay = 10; ; delay = Math.min(delay * 2, 500)) {
    try {
      run();
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!windows || code === undefined || !LOCKED.has(code) || Date.now() >= deadline) throw error;
      Atomics.wait(pause, 0, 0, delay);
    }
  }
}

export function renameReleased(from: string, to: string, waitMs = 15_000, windows = process.platform === "win32"): void {
  whenReleased(() => renameSync(from, to), waitMs, windows);
}

export function removeReleased(path: string, waitMs = 15_000, windows = process.platform === "win32"): void {
  whenReleased(() => rmSync(path, { recursive: true, force: true }), waitMs, windows);
}
