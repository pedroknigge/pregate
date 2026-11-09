import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cliVersion, VERIFIED } from "../src/harness/codex.ts";
import { compareVersions } from "../src/product.ts";

test("cliVersion reads codex-cli semver from --version output", () => {
  expect(cliVersion("codex-cli 0.167.0\n")).toBe("0.167.0");
  expect(cliVersion("codex-cli 0.166.0")).toBe("0.166.0");
  expect(cliVersion("grok 9.9.9")).toBeNull();
});

test("VERIFIED minimum is 0.167.0 for Guardian PreToolUse coverage", () => {
  expect(VERIFIED).toBe("0.167.0");
  expect(compareVersions("0.166.0", VERIFIED)).toBeLessThan(0);
  expect(compareVersions("0.167.0", VERIFIED)).toBe(0);
});

const REAL_CODEX_167 = process.env.PREGATE_CODEX_167_BIN ?? "/tmp/codex-versions/167/codex-x86_64-unknown-linux-musl";

test.skipIf(!existsSync(REAL_CODEX_167))("downloaded Codex 0.167.0 reports at or above the verified minimum", () => {
  const version = spawnSync(REAL_CODEX_167, ["--version"], { encoding: "utf8", timeout: 30_000 });
  expect(version.status).toBe(0);
  const cli = cliVersion(version.stdout);
  expect(cli).not.toBeNull();
  expect(compareVersions(cli!, VERIFIED)).toBeGreaterThanOrEqual(0);
});
