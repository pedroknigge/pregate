import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { consentedRoots, disable, enable } from "../src/consent.ts";
import { canonical } from "../src/disk.ts";
import { dormantNotice, launcherVersion, updateReady } from "../src/inertia.ts";
import { WINDOWS } from "../src/platform.ts";
import { compareVersions } from "../src/product.ts";
import { pinnedEngine, staleProjects } from "../src/project-updates.ts";
import { VERSIONS } from "../src/versions.ts";
import { slash } from "../src/paths.ts";
import { removeTree } from "./remove-tree.ts";

const area = canonical(mkdtempSync(join(tmpdir(), "pregate-registry-")));
afterAll(() => removeTree(area));

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function project(name: string, engine: string | null): string {
  const root = join(area, name);
  put(join(root, ".pregate/preset.json"), "{}\n");
  if (engine !== null) put(join(root, ".pregate/pregate.lock.json"), JSON.stringify({ engine }));
  return root;
}

function launcherAt(data: string, version: string): void {
  put(join(data, "bin", WINDOWS ? "launcher.ps1" : "pregate"), WINDOWS ? `$version = '${version}'\n` : `#!/bin/sh\nversion=${version}\n`);
}

test("the consent registry lists enabled and disabled projects, skipping repository records, damaged records and lost presets", () => {
  const data = join(area, "data-registry");
  const on = project("on", "0.0.0"), off = project("off", VERSIONS.engine), gone = project("gone", null);
  enable(on, data);
  disable(off, data);
  enable(gone, data);
  rmSync(join(gone, ".pregate"), { recursive: true });
  put(join(data, "consent/damaged.json"), "{");
  put(join(data, "consent/repo.json"), JSON.stringify({ repo: join(area, ".git") }));
  expect(consentedRoots(data)).toEqual([{ root: slash(off), enabled: false }, { root: slash(on), enabled: true }]);
  expect(consentedRoots(join(area, "data-empty"))).toEqual([]);
});

test("stale projects are only those pinning an older or unreadable engine, never a newer one", () => {
  const older = project("older", "0.2.5"), same = project("same", "1.0.0"), newer = project("newer", "1.0.1"), none = project("none", null);
  const broken = project("broken", null);
  put(join(broken, ".pregate/pregate.lock.json"), "{");
  expect(pinnedEngine(none)).toBeNull();
  expect(pinnedEngine(broken)).toBe("");
  expect(staleProjects([older, same, newer, none, broken, older], "1.0.0")).toEqual([older, broken]);
  expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
  expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
});

test("an older pinned engine names the newer installed launcher as an update ready for the user", () => {
  const data = join(area, "data-launcher");
  expect(launcherVersion(data)).toBeNull();
  expect(updateReady(data)).toBeNull();
  launcherAt(data, "9.9.9");
  expect(launcherVersion(data)).toBe("9.9.9");
  expect(updateReady(data)).toBe(`PREGATE update ready (${VERSIONS.engine} -> 9.9.9). Ask the user to run: ! pregate update`);
  launcherAt(data, VERSIONS.engine);
  expect(updateReady(data)).toBeNull();
  launcherAt(data, "0.0.0");
  expect(updateReady(data)).toBeNull();
});

test("a Git repository without a contract gets one setup line; a contract or a plain folder stays silent", () => {
  const repo = join(area, "dormant"), plain = join(area, "plain/nested");
  mkdirSync(join(repo, ".git/objects"), { recursive: true });
  mkdirSync(join(repo, "src"), { recursive: true });
  mkdirSync(plain, { recursive: true });
  const line = dormantNotice(join(repo, "src"));
  expect(line).toContain("installed but not enabled");
  expect(line).toContain("pregate guide --preview --enforcement advisor");
  expect(dormantNotice(plain)).toBeNull();
  put(join(repo, ".pregate/preset.json"), "{}\n");
  expect(dormantNotice(join(repo, "src"))).toBeNull();
});
