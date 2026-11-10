import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertReleaseVersions } from "../scripts/build.ts";
import { removeTree } from "./remove-tree.ts";

const ROOT = join(import.meta.dir, "..");

// A pinned action is owner/repo@40-hex and a same-line `# vX` comment. Local reusable
// workflows are this repository, not an action to pin.
const PIN = /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/;
const COMMENT = /#\s*v\d/;

export function unpinnedActions(text: string): string[] {
  const bad: string[] = [];
  text.split("\n").forEach((line, index) => {
    const match = /(?:^|\s)uses:\s*(\S+)/.exec(line);
    if (!match) return;
    const ref = (match[1] ?? "").replace(/^['"]|['"]$/g, "");
    if (ref.startsWith("./") || ref.startsWith("docker://")) return;
    if (PIN.test(ref) && COMMENT.test(line)) return;
    bad.push(`${index + 1}: ${ref}`);
  });
  return bad;
}

function workflowFiles(): string[] {
  const workflows = readdirSync(join(ROOT, ".github/workflows")).filter((name) => name.endsWith(".yml")).map((name) => join(".github/workflows", name));
  return [...workflows, "action.yml", "assets/ci-github.yml"];
}

test("every GitHub action in the workflows, the Action and the CI template is pinned", () => {
  const bad: string[] = [];
  for (const rel of workflowFiles()) {
    for (const hit of unpinnedActions(readFileSync(join(ROOT, rel), "utf8"))) bad.push(`${rel}:${hit}`);
  }
  expect(bad).toEqual([]);
});

test("the pin lint fails a tag, a short SHA, and a SHA with no version comment", () => {
  const sha = "11d5960a326750d5838078e36cf38b85af677262";
  const text = [
    "uses: actions/checkout@v4",
    `uses: actions/checkout@${sha.slice(0, 7)}`,
    `uses: actions/checkout@${sha}`,
    `uses: actions/checkout@${sha} # v4.4.0`,
    "uses: ./.github/workflows/native-release.yml",
    `uses: oven-sh/setup-bun@${sha} # v2.2.0`,
  ].join("\n");
  expect(unpinnedActions(text)).toEqual([
    "1: actions/checkout@v4",
    `2: actions/checkout@${sha.slice(0, 7)}`,
    `3: actions/checkout@${sha}`,
  ]);
});

test("the release version check accepts this tree and rejects an Action default that drifted", () => {
  expect(() => assertReleaseVersions(ROOT)).not.toThrow();
  const dir = mkdtempSync(join(tmpdir(), "pregate-version-"));
  try {
    writeFileSync(join(dir, "package.json"), '{"version":"0.0.2"}\n');
    writeFileSync(join(dir, "install.sh"), "DEFAULT_VERSION=0.0.2\n");
    writeFileSync(join(dir, "install.ps1"), "$DEFAULT_VERSION = '0.0.2'\n");
    writeFileSync(join(dir, "action.yml"), [
      "inputs:",
      "  version:",
      "    description: \"Pregate release version\"",
      "    required: false",
      "    default: \"0.0.1\"",
      "",
    ].join("\n"));
    expect(() => assertReleaseVersions(dir)).toThrow(/action\.yml version default=0\.0\.1 differs from package\.json 0\.0\.2/);
  } finally {
    removeTree(dir);
  }
});
