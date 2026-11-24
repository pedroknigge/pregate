import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  commandList, featureSummary, harnessNames, problemsOf, recordSummary, reviewFeatureMap, scenarioTitles,
  type FeatureIndex,
} from "../scripts/feature-map.ts";

const ROOT = join(import.meta.dir, "..");
const map = readFileSync(join(ROOT, "feature-map.json"), "utf8");
const cli = readFileSync(join(ROOT, "src/cli.ts"), "utf8");
const main = readFileSync(join(ROOT, "src/main.ts"), "utf8");
const commands = commandList(cli, main);

const summary = "Records consent for this worktree and leaves every other directory open.";
const known: FeatureIndex = {
  commands: new Set(["enable", "hook"]),
  tests: new Set(["hooks deny a script"]),
  scenarios: new Set(["Edit gate", "Demo"]),
  harnesses: new Set(["cursor"]),
};

function row(extra: Record<string, unknown>): string {
  return JSON.stringify({ features: [{ id: "enable", summary, cli: "enable", test: "hooks deny a script", ...extra }] });
}

test("the feature map cites every CLI command and only proofs that exist", () => {
  expect(problemsOf(ROOT)).toEqual([]);
  expect(commands.problems).toEqual([]);
  expect(commands.values).toContain("enable");
  expect(commands.values).toContain("hook");
  expect(commands.values).toContain("--help");
  expect(commands.values).toContain("-h");
  expect(commands.values).toContain("--version");
  expect(commands.values).not.toContain("--supervise");
  expect(harnessNames(readFileSync(join(ROOT, "src/harness/profile.ts"), "utf8")).values).toContain("cursor");
  const text = featureSummary(map);
  expect(text).toContain("`pregate enable`");
  expect(text).toContain("scenario: Edit gate");
  expect(text).toContain("`cursor preToolUse Write`");
});

test("a missing command, a dangling proof, and an unknown harness fail", () => {
  const covered = row({});
  const withHook = JSON.stringify({ features: [
    { id: "enable", summary, cli: "enable", test: "hooks deny a script" },
    { id: "hook", summary, cli: "hook", test: "hooks deny a script" },
    { id: "edit-gate", summary, hook: { harness: "cursor", event: "preToolUse", tool: "Write" }, scenario: "Edit gate" },
    { id: "demo", summary, cli: "demo", scenario: "Demo" },
  ] });
  const open: FeatureIndex = { ...known, commands: new Set(["enable", "hook", "demo"]) };
  expect(reviewFeatureMap(withHook, open)).toEqual([]);
  expect(reviewFeatureMap(covered, known).join("\n")).toContain("\"hook\"");
  expect(reviewFeatureMap(row({ test: "this test was never written" }), known).join("\n")).toContain("this test was never written");
  expect(reviewFeatureMap(row({ test: undefined, scenario: "No such feature" }), known).join("\n")).toContain("No such feature");
  expect(reviewFeatureMap(row({ cli: "widget" }), known).join("\n")).toContain("widget");
  const badHook = JSON.stringify({ features: [
    { id: "enable", summary, cli: "enable", test: "hooks deny a script" },
    { id: "hook", summary, cli: "hook", test: "hooks deny a script" },
    { id: "edit-gate", summary, hook: { harness: "notepad", event: "preToolUse", tool: "Write" }, scenario: "Edit gate" },
  ] });
  expect(reviewFeatureMap(badHook, known).join("\n")).toContain("notepad");
  expect(reviewFeatureMap(withHook, open).filter((line) => line.includes("Demo"))).toEqual([]);
  expect(reviewFeatureMap(row({}), known).join("\n")).toContain("Edit gate");
});

test("a command added to the switch is missing until the map names it", () => {
  const extra = commandList(cli.replace('case "doctor":', 'case "widget": case "doctor":'), main);
  expect(extra.values).toContain("widget");
  expect(reviewFeatureMap(map, {
    commands: new Set(extra.values),
    tests: new Set(["unused"]),
    scenarios: new Set(["unused"]),
    harnesses: new Set(["cursor"]),
  }).join("\n")).toContain("\"widget\"");
  expect(scenarioTitles([{ name: "demo.md", text: "\n# Demo\n" }]).values).toEqual(["Demo"]);
  expect(scenarioTitles([{ name: "demo.md", text: "no title\n" }]).problems.join("\n")).toContain("demo.md");
});

test("the job summary is the same table", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-feature-map-"));
  try {
    const path = join(dir, "summary.md");
    recordSummary("### Feature map\n", { GITHUB_STEP_SUMMARY: path });
    expect(readFileSync(path, "utf8")).toContain("### Feature map");
    recordSummary("### Feature map\n", {});
  } finally {
    rmSync(dir, { recursive: true });
  }
});
