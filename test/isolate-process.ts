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

// Every test resolves its user state under a throwaway HOME. Assignment, not `??=`: an already-set
// HOME, harness directory, or XDG directory is the machine under test and used to leak into the
// suite (a global pregate hook, or this host's gitconfig). A file that sets these after preload
// still overrides them. Git identity is copied into that home; signing, hooks, fsmonitor, and
// insteadOf are not. The copy is the home gitconfig, not GIT_CONFIG_GLOBAL: a test that points
// HOME at its own directory must not inherit an identity file, and the system gitconfig stays in
// force so Windows keeps filemode and autocrlf.
function isolateEnvironment(): void {
  const identity = gitIdentity();
  const root = mkdtempSync(join(tmpdir(), "pregate-test-home-"));
  const home = join(root, "home");
  for (const dir of [home, join(root, "data"), join(root, "state"), join(root, "config"), join(root, "codex"), join(root, "grok"), join(root, "claude")]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.XDG_DATA_HOME = join(root, "data");
  process.env.XDG_STATE_HOME = join(root, "state");
  process.env.XDG_CONFIG_HOME = join(root, "config");
  process.env.CODEX_HOME = join(root, "codex");
  process.env.GROK_HOME = join(root, "grok");
  process.env.CLAUDE_CONFIG_DIR = join(root, "claude");
  if (process.platform === "win32") {
    process.env.LOCALAPPDATA = join(root, "data");
    process.env.APPDATA = join(root, "config");
  }
  delete process.env.GIT_CONFIG_GLOBAL;
  const file = join(home, ".gitconfig");
  const set = (key: string, value: string): void => {
    const out = Bun.spawnSync(["git", "config", "--file", file, key, value], { stdout: "pipe", stderr: "pipe", timeout: 2000 });
    if (out.exitCode !== 0) throw new Error(out.stderr.toString());
  };
  if (identity.name !== "") set("user.name", identity.name);
  if (identity.email !== "") set("user.email", identity.email);
  set("commit.gpgsign", "false");
}

function gitIdentity(): { name: string; email: string } {
  const read = (key: string): string => {
    const out = Bun.spawnSync(["git", "-c", "core.fsmonitor=", "-c", "core.hooksPath=", "config", "--global", "--get", key], {
      stdout: "pipe", stderr: "pipe", timeout: 2000,
    });
    const value = out.exitCode === 0 ? out.stdout.toString().trim() : "";
    return /^[^\r\n]+$/.test(value) ? value : "";
  };
  return { name: read("user.name"), email: read("user.email") };
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
