import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WINDOWS } from "../src/platform.ts";
import { SIGSTORE_E2E_ENV } from "./signing-tool.ts";
import { removeTree } from "./remove-tree.ts";

// The default suite must keep passing when HTTPS cannot leave the machine. A dead proxy makes a
// real cosign (TUF, Rekor, or a release download) fail. Localhost stays direct so the fixture
// release server still answers. PREGATE_E2E_SIGSTORE is cleared so this child cannot opt into
// the real Sigstore test.

const SIGNING_TESTS = ["test/action-install.e2e.test.ts", "test/signing-shim.test.ts"];

function blockedEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  const dead = "http://127.0.0.1:9";
  env.HTTPS_PROXY = dead;
  env.https_proxy = dead;
  env.HTTP_PROXY = dead;
  env.http_proxy = dead;
  env.ALL_PROXY = dead;
  env.all_proxy = dead;
  env.NO_PROXY = "127.0.0.1,localhost,::1";
  env.no_proxy = env.NO_PROXY;
  delete env[SIGSTORE_E2E_ENV];
  return env;
}

test.skipIf(WINDOWS)("default signing tests pass with Sigstore blocked", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-signing-guard-"));
  const report = join(dir, "junit.xml");
  try {
    const result = Bun.spawnSync([
      process.execPath, "test", ...SIGNING_TESTS,
      "--reporter=junit", `--reporter-outfile=${report}`,
    ], {
      cwd: join(import.meta.dir, ".."),
      env: blockedEnv(),
      stdout: "pipe",
      stderr: "pipe",
      timeout: 180_000,
    });
    const output = result.stdout.toString() + result.stderr.toString();
    const xml = readFileSync(report, "utf8");
    expect(result.exitCode, output + xml).toBe(0);
    expect(xml).toContain("with cosign a signed release installs when the signature is required");
    expect(xml).toContain("install.sh accepts a shim signature and refuses a tampered archive");
    expect(xml).not.toContain("<skipped");
    expect(output + xml).not.toContain("tuf-repo-cdn.sigstore.dev");
    expect(output + xml).not.toContain("cosign tests skipped");
  } finally {
    removeTree(dir);
  }
}, 180_000);
