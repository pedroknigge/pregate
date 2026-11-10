import { expect, setDefaultTimeout, test } from "bun:test";
import { lstatSync, mkdtempSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import core from "../catalog/source.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };
import { removeTree } from "./remove-tree.ts";

// A fresh clone of this branch must be installable. The published tree once
// contained `node_modules` as a symlink to a machine outside the repo, and
// `bun install` then failed with ENOENT. The clone is checked, installed,
// type-checked and built. It does not run the suite a second time: the CI job
// that runs this file is itself a fresh clone that installs and runs every
// suite, so a test that needs an untracked file fails there.
setDefaultTimeout(10 * 60 * 1000);

function run(cmd: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): string {
  const result = Bun.spawnSync(cmd, { cwd, env, stdout: "pipe", stderr: "pipe" });
  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();
  if (result.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} exited ${result.exitCode}\n${stdout.slice(-6000)}\n${stderr.slice(-6000)}`);
  }
  return stdout;
}

test("a fresh clone has no node_modules entry, no symlink outside the repo, and prints the package version", () => {
  const parent = run(["git", "rev-parse", "--show-toplevel"], process.cwd()).trim();
  // CI checks out the pull request detached, so `--branch HEAD` is not a branch.
  const sha = run(["git", "rev-parse", "HEAD"], parent).trim();
  const dest = mkdtempSync(join(tmpdir(), "pregate-hygiene-"));
  try {
    // The long fixture paths need the same flag the Windows guide uses to clone.
    // Checkout is the command that creates those directories.
    run(["git", "clone", "-c", "core.longpaths=true", "--local", "--no-checkout", parent, dest], tmpdir());
    run(["git", "-c", "core.longpaths=true", "checkout", "--detach", sha], dest);
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
    const tsc = join(dest, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
    run([tsc], dest);
    const os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "windows" : "linux";
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const target = `${os}-${arch}`;
    run(["bun", "run", "scripts/build.ts", target], dest);
    const bin = join(dest, "dist", `pregate-${pkg.version}-${target}`, process.platform === "win32" ? "pregate.exe" : "pregate");
    const version = run([bin, "--version"], dest).trim();
    expect(version).toBe(`pregate ${pkg.version} (core ${core.version})`);
  } finally {
    removeTree(dest);
  }
});
