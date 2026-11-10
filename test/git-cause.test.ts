import { afterAll, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { git, gitFailure } from "../src/git.ts";
import { WINDOWS } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-git-cause-"));
const saved = { PATH: process.env.PATH, Path: process.env.Path };
afterAll(() => {
  process.env.PATH = saved.PATH;
  process.env.Path = saved.Path;
  removeTree(area);
});

function withPath(path: string, run: () => void): void {
  process.env.PATH = path;
  process.env.Path = path;
  try { run(); }
  finally {
    process.env.PATH = saved.PATH;
    process.env.Path = saved.Path;
  }
}

function realGit(cwd: string, ...args: string[]): void {
  const result = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd, stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

test("a directory with no .git is not a repository", () => {
  const dir = join(area, "plain");
  mkdirSync(dir);
  expect(git(dir, ["rev-parse", "--show-prefix"])).toBeNull();
  expect(gitFailure()).toBe("git-not-repository");
});

test("a repository git can read is not a failure", () => {
  const dir = join(area, "repo");
  mkdirSync(dir);
  realGit(dir, "init", "-q");
  writeFileSync(join(dir, "a.txt"), "a\n");
  realGit(dir, "add", "a.txt");
  realGit(dir, "commit", "-qm", "init");
  expect(git(dir, ["rev-parse", "--verify", "HEAD"])?.trim()).toMatch(/^[0-9a-f]{40,64}$/);
});

test("git missing from PATH is its own failure", () => {
  const dir = join(area, "repo");
  const empty = join(area, "empty-path");
  mkdirSync(empty);
  const path = WINDOWS && process.env.SystemRoot ? [empty, join(process.env.SystemRoot, "System32")].join(delimiter) : empty;
  withPath(path, () => {
    expect(git(dir, ["rev-parse", "--show-prefix"])).toBeNull();
    expect(gitFailure()).toBe("git-missing");
  });
});

test("a git command that fails for another reason stays a command error", () => {
  const bin = join(area, "fake-bin");
  const dir = join(area, "broken");
  mkdirSync(bin);
  mkdirSync(dir);
  const gitBin = join(bin, WINDOWS ? "git.cmd" : "git");
  writeFileSync(gitBin, WINDOWS
    ? "@echo off\r\necho fatal: unable to read config file 1>&2\r\nexit /b 1\r\n"
    : "#!/bin/sh\necho 'fatal: unable to read config file' >&2\nexit 1\n");
  if (!WINDOWS) chmodSync(gitBin, 0o755);
  withPath(bin, () => {
    expect(git(dir, ["status"])).toBeNull();
    expect(gitFailure()).toBe("git-error");
  });
});
