import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostTarget } from "../scripts/build.ts";
import { VERSIONS } from "../src/versions.ts";
import { WINDOWS } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-native-admission-"));
const target = hostTarget(), archive = `pregate-${VERSIONS.engine}-${target}.${WINDOWS ? "zip" : "tar.gz"}`;
const installer = WINDOWS ? "install.ps1" : "install.sh";
const archiveBytes = "corrupted candidate archive", installerBytes = "installer must never run";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const archiveLine = hash(archiveBytes) + "  " + archive + "\n", installerLine = hash(installerBytes) + "  " + installer + "\n";
afterAll(() => removeTree(area));

test.each([
  ["archive checksum differs", "0".repeat(64) + "  " + archive + "\n" + installerLine],
  ["installer checksum differs", archiveLine + "0".repeat(64) + "  " + installer + "\n"],
  ["archive checksum missing", installerLine],
  ["archive checksum ambiguous", archiveLine + archiveLine + installerLine],
])("native candidate admission rejects %s before bootstrap", (name, manifest) => {
  const dir = join(area, name); mkdirSync(dir);
  writeFileSync(join(dir, archive), archiveBytes); writeFileSync(join(dir, installer), installerBytes);
  writeFileSync(join(dir, "SHA256SUMS"), manifest);
  const result = Bun.spawnSync([process.execPath, "run", join(import.meta.dir, "../scripts/smoke-native.ts"), dir, target], {
    cwd: join(import.meta.dir, ".."), env: { ...process.env, HOME: join(dir, "home"), XDG_DATA_HOME: join(dir, "data"),
      XDG_STATE_HOME: join(dir, "state"), CODEX_HOME: join(dir, "codex"), GROK_HOME: join(dir, "grok") },
    stdout: "pipe", stderr: "pipe", timeout: 10000,
  });
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("Candidate SHA-256 mismatch or missing/ambiguous entry");
  expect(result.stdout.length).toBe(0);
});

test("native candidate admission rejects a runner with the wrong architecture before reading artifacts", () => {
  const other = target === "windows-x64" ? "linux-x64" : "windows-x64";
  const result = Bun.spawnSync([process.execPath, "run", join(import.meta.dir, "../scripts/smoke-native.ts"), join(area, "missing"), other], {
    cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe", timeout: 10000,
  });
  expect(result.exitCode).toBe(1); expect(result.stderr.toString()).toContain("current target: " + target); expect(result.stdout.length).toBe(0);
});
