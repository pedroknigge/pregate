import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { audit } from "../src/audit-command.ts";
import { compile } from "../src/compile.ts";
import { LOCK, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { repoFiles } from "../src/init.ts";
import { scopeCoverage } from "../src/onboard.ts";
import { workspacePaths } from "../src/workspace.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

test("tracked authored build sources enter onboarding and cold/warm audit without ignored outputs", async () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-tracked-build-"));
  const put = (rel: string, text: string) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  };
  await removing(root, async () => {
    git("init", "-q");
    put(".gitignore", "build/\ndist/\nnode_modules/\n");
    const tracked = ["build/build.js", "build/validator.js", "test/build/entry.js", "test/build/check.js", "test/build/source with spaces.js"];
    for (const rel of tracked) put(rel, "export const value = 1;\n");
    put("src/main.js", "export const main = 1;\n");
    put("build/generated/ignored.js", "invalid source ignored\n");
    put("test/build/untracked.js", "invalid source untracked\n");
    put("dist/generated.js", "invalid source generated\n");
    put("node_modules/tracked.js", "invalid source dependency\n");
    git("add", "src/main.js", ".gitignore"); git("add", "-f", ...tracked, "node_modules/tracked.js");
    expect(workspacePaths(root)).toEqual([...tracked, "src/main.js"].sort());
    const files = repoFiles(root);
    expect(Object.keys(files).filter(path => path.endsWith(".js")).sort()).toEqual([...tracked, "src/main.js"].sort());
    const coverage = scopeCoverage(files, { include: ["**"], exclude: [] });
    expect(coverage.inventoried).toBe(6); expect(coverage.inScope).toBe(6);
    expect(coverage.roles.find(role => role.role === "tests")?.parserSupported).toBe(3);
    const preset = JSON.parse(policyFixture(readFileSync("catalog/presets/backend-clean-ddd.json", "utf8")));
    preset.scope = { include: ["**"], exclude: [] };
    const text = JSON.stringify(preset); put(PRESET, text);
    const compiled = compile(text, sourcesOf(root), VERSIONS);
    if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
    put(LOCK, compiled.text);
    let previous: string | null = null;
    for (const flags of [[], ["--incremental"], ["--incremental"], ["--fresh"]]) {
      const result = await audit(["--repo", root, "--json", ...flags]), report = JSON.parse(result.text);
      expect(report.filesScanned).toBe(6); expect(report.errors).toEqual([]);
      expect(report.fileCoverage.map((file: { path: string }) => file.path).sort()).toEqual([...tracked, "src/main.js"].sort());
      const evidence = JSON.stringify({ code: result.code, fileHashes: report.fileHashes, findings: report.findings, errors: report.errors, fileCoverage: report.fileCoverage });
      if (previous !== null) expect(evidence).toEqual(previous);
      previous = evidence;
    }
    rmSync(join(root, "test/build"), { recursive: true });
    symlinkSync(join(root, "build"), join(root, "test/build"));
    expect(workspacePaths(root)).not.toContain("test/build/entry.js");
    expect(repoFiles(root)).not.toHaveProperty("test/build/entry.js");
  });
});

test("standalone build outputs remain excluded and broken Git never falls back to a partial inventory", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-build-standalone-")), saved = process.env.GIT_CONFIG_COUNT;
  restoringGitConfig(root, saved, () => {
    mkdirSync(join(root, "build")); writeFileSync(join(root, "build/generated.js"), "export const value = 1;");
    writeFileSync(join(root, "main.js"), "export const value = 1;");
    expect(workspacePaths(root)).toEqual(["main.js"]);
    Bun.spawnSync(["git", "init", "-q", root]);
    process.env.GIT_CONFIG_COUNT = "invalid";
    expect(() => workspacePaths(root)).toThrow("Git could not inventory");
  });
});

async function removing(root: string, run: () => Promise<void>): Promise<void> {
  try { await run(); } finally { removeTree(root); }
}

function restoringGitConfig(root: string, saved: string | undefined, run: () => void): void {
  try { run(); } finally {
    if (saved === undefined) delete process.env.GIT_CONFIG_COUNT; else process.env.GIT_CONFIG_COUNT = saved;
    removeTree(root);
  }
}
