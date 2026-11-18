import { expect, test } from "bun:test";
import { fixtureLock } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { analyze } from "../src/evaluate.ts";
import { testCheck } from "../src/fixtures.ts";
import { warnText } from "../src/message.ts";
import { isNodePinFile, nodePinReleaseError, staleNodePins } from "../src/node-security-pin.ts";
import { matches } from "../src/paths.ts";
import type { Check, NodeReleases } from "../src/types.ts";

const files = readTree("packs/node", true);
const check = JSON.parse(files["checks/supply/require-node-pin/check.json"]!) as Check;
const releases = check.impl.kind === "primitive" && check.impl.primitive === "node-pin" ? check.impl.releases : null;

function floors(rel: string, text: string): string[] {
  return staleNodePins(rel, text, releases).map((hit) => `${hit.line}:${hit.floor}`);
}

test("the November 2026 security release is the pack data", () => {
  expect(releases).not.toBeNull();
  const table = releases as NodeReleases;
  expect(table.source).toBe("https://nodejs.org/en/blog/vulnerability/november-2026-security-releases");
  expect(table.date).toBe("2026-11-11");
  expect(table.lines.map((line) => [line.major, line.version])).toEqual([
    [22, "22.23.5"],
    [24, "24.22.3"],
    [26, "26.13.1"],
  ]);
  expect(table.lines.map((line) => line.high)).toEqual([
    ["CVE-2026-123864", "CVE-2026-123865", "CVE-2026-123866", "CVE-2026-123872"],
    ["CVE-2026-123863", "CVE-2026-123864", "CVE-2026-123865", "CVE-2026-123866", "CVE-2026-123872", "CVE-2026-123874", "CVE-2026-126051"],
    ["CVE-2026-123863", "CVE-2026-123864", "CVE-2026-123865", "CVE-2026-123866", "CVE-2026-123872", "CVE-2026-123874", "CVE-2026-126051"],
  ]);
  expect(nodePinReleaseError(table)).toBeNull();
});

test("NODE-PIN-001 fixtures pass, including the reviewed LTS evidence", () => {
  const result = testCheck(files, "node/supply/require-node-pin", () => 0);
  expect(result.ok, result.lines.join("\n")).toBe(true);
});

test("an exact pin below its line names that line's patched release", () => {
  expect(floors(".nvmrc", "22.23.4\n")).toEqual(["1:22.23.5"]);
  expect(floors(".nvmrc", "v22.23.4\n")).toEqual(["1:22.23.5"]);
  expect(floors(".nvmrc", "22.23.4 # still in the image\n")).toEqual(["1:22.23.5"]);
  expect(floors(".nvmrc", "22.22.9\n")).toEqual(["1:22.23.5"]);
  expect(floors(".node-version", "24.22.2\n")).toEqual(["1:24.22.3"]);
  expect(floors(".nvmrc", "26.13.0\n")).toEqual(["1:26.13.1"]);
  expect(floors("Dockerfile", "FROM node:24.22.2\n")).toEqual(["1:24.22.3"]);
  expect(floors("services/api/Dockerfile", "FROM --platform=linux/amd64 node:22.23.4-alpine AS app\n")).toEqual(["1:22.23.5"]);
  expect(floors("Dockerfile", "FROM node:26.13.0-bookworm-slim@sha256:abc\n")).toEqual(["1:26.13.1"]);
  expect(floors(".tool-versions", "golang 1.22.0\nnodejs 22.14.0\n")).toEqual(["2:22.23.5"]);
  expect(floors("package.json", '{\n  "engines": {\n    "node": "=22.23.4"\n  }\n}\n')).toEqual(["3:22.23.5"]);
  expect(floors("package.json", '{\n  "engines": { "node": "22.23.4" },\n  "volta": { "node": "24.22.2" }\n}\n')).toEqual(["2:22.23.5", "3:24.22.3"]);
  const workflow = "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: \"26.13.0\"\n";
  expect(floors(".github/workflows/ci.yml", workflow)).toEqual(["7:26.13.1"]);
  expect(floors(".gitlab-ci.yml", "image: node:22.23.4\n")).toEqual(["1:22.23.5"]);
  expect(floors("action.yml", "runs:\n  steps:\n    - uses: actions/setup-node@v4\n      with:\n        node-version: 24.22.0\n")).toEqual(["5:24.22.3"]);
});

test("ranges, prereleases, comments, and lines absent from the table stay quiet", () => {
  for (const text of ["22\n", "22.x\n", "lts/*\n", "22.23.5\n", "22.23.6\n", "22.24.0\n", "20.18.1\n", "27.0.0\n", "22.23.4-rc.1\n", "# 22.23.4\n22.23.5\n", "22.23.5\n22.23.4\n"]) {
    expect(floors(".nvmrc", text), text).toEqual([]);
  }
  expect(floors("Dockerfile", "FROM node:22-alpine\n")).toEqual([]);
  expect(floors("Dockerfile", "FROM node:22.23.5-alpine@sha256:abc\n")).toEqual([]);
  expect(floors("Dockerfile", "# FROM node:22.23.4\nFROM node:22\n")).toEqual([]);
  expect(floors("package.json", '{\n  "engines": {\n    "node": ">=22.14.0"\n  }\n}\n')).toEqual([]);
  expect(floors("package.json", '{\n  "dependencies": {\n    "left-pad": "22.23.4"\n  }\n}\n')).toEqual([]);
  expect(floors("package.json", "{")).toEqual([]);
  const fileOnly = "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version-file: .nvmrc\n";
  expect(floors(".github/workflows/ci.yml", fileOnly)).toEqual([]);
  const matrix = "name: ci\njobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: ${{ matrix.node-version }}\n";
  expect(floors(".github/workflows/ci.yml", matrix)).toEqual([]);
  expect(floors("README.md", "22.23.4\n")).toEqual([]);
  expect(floors(".github/workflows/ci.yml", "name: ci\njobs:\n  test:\n    container: node:22\n")).toEqual([]);
  expect(isNodePinFile(".nvmrc")).toBe(true);
  expect(matches("**", ".nvmrc")).toBe(true);
});

test("the warning names the patched release and keeps the LTS template for evidence", () => {
  const lock = fixtureLock(check, { verifier: "NODE-PIN-001" }, {});
  const host = { read: () => null, now: () => 0, hash: false };
  const stale = analyze(lock, "pre", ".nvmrc", "22.23.4\n", host);
  if ("cause" in stale) throw new Error(stale.cause);
  expect(stale.violations).toHaveLength(1);
  expect(stale.violations[0]!.severity).toBe("warn");
  expect(stale.violations[0]!.symbol).toBe("22.23.5");
  const text = warnText(stale.violations, lock).full;
  expect(text).toContain("PREGATE WARN node/supply/require-node-pin .nvmrc:1 Bump this exact Node.js pin to 22.23.5.");
  expect(text).not.toContain("22.23.4");
  const patched = analyze(lock, "pre", ".nvmrc", "22\n", host);
  if ("cause" in patched) throw new Error(patched.cause);
  expect(patched.violations).toEqual([]);
  lock.rules[0]!.impl = { kind: "primitive", primitive: "node-pin", requirement: "NODE-PIN-001", releases: { source: "nope", date: "yesterday", lines: [] } };
  expect(() => analyze(lock, "pre", ".nvmrc", "22.23.4\n", host)).toThrow(/node-pin releases/);
  expect(() => analyze(lock, "pre", "README.md", "22.23.4\n", host)).not.toThrow();
});
