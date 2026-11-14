import { AsyncLocalStorage } from "node:async_hooks";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

// `bun test` interleaves files in one process. `process.chdir` would otherwise
// point every later file at a temporary repo, so relative catalog reads and
// build macros fail. Directory changes stay in the test that made them. The
// operating-system directory stays the repository root.
const installed = Symbol.for("pregate.isolate-process");
if (Reflect.get(globalThis, installed) === true) {
  // A second preload evaluation must not wrap the wrappers.
} else {
  Reflect.set(globalThis, installed, true);
  isolateEnvironment();
  installIsolation();
}

// Every test resolves its user state under a throwaway HOME unless the file isolates the
// environment itself: a file that forgets the manual isolation used to write the real
// `~/.local/state/pregate` (XDG_STATE_HOME fallback in src/state.ts). `??=` keeps every
// deliberate per-file isolation intact.
function isolateEnvironment(): void {
  const root = mkdtempSync(join(tmpdir(), "pregate-test-home-"));
  for (const key of ["HOME", "USERPROFILE", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_CONFIG_HOME", "CODEX_HOME", "GROK_HOME", "CLAUDE_CONFIG_DIR"]) {
    process.env[key] ??= join(root, key.toLowerCase());
  }
}

function installIsolation(): void {
  const realCwd = process.cwd.bind(process);
  const directories = new AsyncLocalStorage<string>();
  const virtualCwd = (): string => directories.getStore() ?? realCwd();
  process.cwd = virtualCwd;
  process.chdir = (directory: string): void => {
    directories.enterWith(resolve(virtualCwd(), directory));
  };

  const locate = (value: unknown): unknown => {
    if (typeof value !== "string" || isAbsolute(value)) return value;
    return resolve(virtualCwd(), value);
  };
  const pathArgs = (indexes: readonly number[]) => (fn: (...args: never[]) => unknown) => function (this: unknown, ...args: unknown[]) {
    for (const index of indexes) if (index < args.length) args[index] = locate(args[index]);
    return fn.apply(this, args as never[]);
  };
  const one = pathArgs([0]);
  const two = pathArgs([0, 1]);
  const linkPath = pathArgs([1]);
  const patchFs = (target: object, names: Readonly<Record<string, (fn: (...args: never[]) => unknown) => unknown>>): void => {
    for (const [name, wrap] of Object.entries(names)) {
      const current = Reflect.get(target, name);
      if (typeof current !== "function") continue;
      const wrapped = wrap(current as (...args: never[]) => unknown) as object;
      if (name === "realpathSync" && typeof Reflect.get(current, "native") === "function") {
        Reflect.set(wrapped, "native", one(Reflect.get(current, "native") as (...args: never[]) => unknown));
      }
      Reflect.set(target, name, wrapped);
    }
  };
  const filesystem = {
    access: one, accessSync: one, appendFile: one, appendFileSync: one, chmod: one, chmodSync: one,
    chown: one, chownSync: one, copyFile: two, copyFileSync: two, cp: two, cpSync: two,
    createReadStream: one, createWriteStream: one, existsSync: one, lstat: one, lstatSync: one,
    link: two, linkSync: two, mkdir: one, mkdirSync: one, mkdtemp: one, mkdtempSync: one,
    open: one, openSync: one, opendir: one, opendirSync: one, readdir: one, readdirSync: one,
    readFile: one, readFileSync: one, readlink: one, readlinkSync: one, realpath: one, realpathSync: one,
    rename: two, renameSync: two, rm: one, rmSync: one, rmdir: one, rmdirSync: one, stat: one, statSync: one,
    symlink: linkPath, symlinkSync: linkPath, truncate: one, truncateSync: one, unlink: one, unlinkSync: one,
    utimes: one, utimesSync: one, lutimes: one, lutimesSync: one, watch: one, writeFile: one, writeFileSync: one,
  };
  patchFs(fs, filesystem);
  patchFs(fsp, filesystem);
  if (fs.promises !== fsp) patchFs(fs.promises, filesystem);

  const bunFile = Bun.file;
  Bun.file = ((path: string, options?: BlobPropertyBag) => bunFile(locate(path) as string, options)) as typeof Bun.file;
  const bunWrite = Bun.write;
  Bun.write = ((destination: unknown, data: unknown) => bunWrite(typeof destination === "string" ? locate(destination) as string : destination as Parameters<typeof bunWrite>[0], data as Parameters<typeof bunWrite>[1])) as typeof Bun.write;
}
