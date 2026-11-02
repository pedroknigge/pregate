import { expect, test } from "bun:test";
import { chmodSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { VERSIONS } from "../src/versions.ts";
import { homebrewFormula, parseSums, scoopManifest } from "../scripts/release-manifests.ts";

test("release-manifests generates valid Homebrew formula and Scoop manifest from SHA256SUMS", () => {
  const sumsText = [
    `${"a".repeat(64)}  pregate-${pkg.version}-darwin-arm64.tar.gz`,
    `${"b".repeat(64)}  pregate-${pkg.version}-darwin-x64.tar.gz`,
    `${"c".repeat(64)}  pregate-${pkg.version}-linux-x64.tar.gz`,
    `${"d".repeat(64)}  pregate-${pkg.version}-linux-arm64.tar.gz`,
    `${"e".repeat(64)}  pregate-${pkg.version}-windows-x64.zip`,
  ].join("\n");
  const sums = parseSums(sumsText, pkg.version);
  expect(Object.keys(sums).sort()).toEqual(["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "windows-x64"]);

  const formula = homebrewFormula(pkg.version, sums);
  expect(formula).toContain("class Pregate < Formula");
  expect(formula).toContain(`pregate-${pkg.version}-darwin-arm64.tar.gz`);
  expect(formula).toContain(`pregate-${pkg.version}-darwin-x64.tar.gz`);
  expect(formula).toContain(`pregate-${pkg.version}-linux-x64.tar.gz`);
  expect(formula).toContain(`pregate-${pkg.version}-linux-arm64.tar.gz`);
  expect(formula).toContain(`sha256 "${"b".repeat(64)}"`);

  const scoop = JSON.parse(scoopManifest(pkg.version, sums));
  expect(scoop.version).toBe(pkg.version);
  expect(scoop.license).toBe("MIT");
  expect(scoop.bin).toBe("pregate.exe");
  expect(scoop.architecture["64bit"].hash).toBe("e".repeat(64));
});

test("bin/pregate.mjs delegates to the local source entrypoint when run in the repo", () => {
  const binPath = join(import.meta.dir, "../bin/pregate.mjs");
  chmodSync(binPath, 0o755);
  const out = Bun.spawnSync(["node", binPath, "--version"], { stdout: "pipe", stderr: "pipe" });
  expect(out.exitCode, out.stderr.toString()).toBe(0);
  expect(out.stdout.toString().trim()).toBe(`pregate ${VERSIONS.engine} (core ${VERSIONS.core})`);
});
