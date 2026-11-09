import { expect, test } from "bun:test";
import { FAIL_CLOSED_SINCE } from "../src/harness/grok.ts";

// Real Grok Build >= FAIL_CLOSED_SINCE PreToolUse failClosed is not automated in CI: no public
// headless Linux install, no fetchable release artifacts, and denial needs auth (scripts/e2e-real.ts).

function grokBin(): string | null {
  return Bun.which("grok");
}

function grokVersion(): string | null {
  const grok = grokBin();
  if (grok === null) return null;
  const r = Bun.spawnSync([grok, "--version"], { stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) return null;
  const m = r.stdout.toString().match(/(\d+\.\d+\.\d+)/);
  return m?.[1] ?? null;
}

function semverGte(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return true;
}

const grok = grokBin();
const version = grokVersion();
const newEnough = version !== null && semverGte(version, FAIL_CLOSED_SINCE);
const gap = grok === null
  ? "grok not on PATH"
  : version === null
    ? "grok --version unreadable"
    : !newEnough
      ? `grok ${version} < ${FAIL_CLOSED_SINCE}`
      : "headless PreToolUse denial not wired (use PREGATE_REAL=1 on a maintainer machine)";

// Always skipped until a real dispatch scenario lands; the title records what this VM detected.
test.skip(`real Grok failClosed E2E: ${gap}`, () => {
  expect(grok).not.toBeNull();
  expect(newEnough).toBe(true);
});
