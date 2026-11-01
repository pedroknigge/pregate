import { expect, setDefaultTimeout, test } from "bun:test";
import { lstatSync, mkdtempSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };

// A fresh clone of this branch must be installable. The published tree once
// contained `node_modules` as a symlink to a machine outside the repo, and
// `bun install` then failed with ENOENT. Nested `bun test` sets the marker so
// this file does not clone again.
setDefaultTimeout(45 * 60 * 1000);

const MARK = "PREGATE_REPO_HYGIENE";

function run(cmd: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const result = Bun.spawnSync(cmd, { cwd, env, stdout: "pipe", stderr: "pipe" });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  if (result.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} exited ${result.exitCode}\n${stdout.slice(-6000)}\n${stderr.slice(-6000)}`);
  }
  return stdout;
}

if (process.env[MARK] === "1") {
  test("repo hygiene does not clone again inside the fresh clone", () => {
    expect(process.env[MARK]).toBe("1");
  });
} else {
  test("a fresh clone has no node_modules entry, no symlink outside the repo, and prints the package version", () => {
    const parent = run(["git", "rev-parse", "--show-toplevel"], process.cwd()).trim();
    // CI checks out the pull request detached, so `--branch HEAD` is not a branch.
    const sha = run(["git", "rev-parse", "HEAD"], parent).trim();
    const dest = mkdtempSync(join(tmpdir(), "pregate-hygiene-"));
    try {
      run(["git", "clone", "--local", "--no-checkout", parent, dest], tmpdir());
      run(["git", "checkout", "--detach", sha], dest);
      const listed = run(["git", "ls-files", "-s", "-z"], dest).split("\0").filter(Boolean);
      const nodeModules: string[] = [];
      const outside: string[] = [];
      for (const row of listed) {
        const tab = row.indexOf("\t");
        const file = row.slice(tab + 1);
        if (file === "node_modules" || file.startsWith("node_modules/")) nodeModules.push(file);
        const mode = row.slice(0, tab).split(" ")[0];
        if (mode !== "120000") continue;
        const link = readlinkSync(join(dest, file));
        const resolved = isAbsolute(link) ? resolve(link) : resolve(dest, dirname(file), link);
        const rel = relative(dest, resolved);
        if (rel.startsWith("..") || isAbsolute(rel)) outside.push(`${file} -> ${link}`);
        expect(lstatSync(join(dest, file)).isSymbolicLink()).toBe(true);
      }
      expect(nodeModules).toEqual([]);
      expect(outside).toEqual([]);

      run(["bun", "install"], dest);
      run(["bun", "test"], dest, { ...process.env, [MARK]: "1" });
      const tsc = join(dest, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
      run([tsc], dest);
      const os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
      const arch = process.arch === "arm64" ? "arm64" : "x64";
      const target = `${os}-${arch}`;
      run(["bun", "run", "scripts/build.ts", target], dest);
      const bin = join(dest, "dist", `pregate-${pkg.version}-${target}`, process.platform === "win32" ? "pregate.exe" : "pregate");
      const version = run([bin, "--version"], dest).trim();
      expect(version).toBe(`pregate ${pkg.version} (core ${pkg.version})`);
    } finally {
      rmSync(dest, { recursive: true, force: true });
    }
  });
}
