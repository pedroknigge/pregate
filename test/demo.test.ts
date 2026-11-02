import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { VERSIONS } from "../src/versions.ts";
import { sha256 } from "../src/state.ts";

setDefaultTimeout(480_000);
const area = mkdtempSync(join(tmpdir(), "pregate-demo-controls-"));
const binary = process.env.PREGATE_DEMO_BINARY ?? join(area, process.platform === "win32" ? "pregate.exe" : "pregate");
beforeAll(() => {
  if (process.env.PREGATE_DEMO_BINARY === undefined) return compileBinary(hostTarget(), binary, false);
  expect(isAbsolute(binary) && statSync(binary).isFile()).toBe(true);
  expect(Bun.spawnSync([binary, "--version"], { stdout: "pipe", stderr: "pipe" }).stdout.toString().trim()).toBe(`pregate ${VERSIONS.engine} (core ${VERSIONS.core})`);
}, 120_000);
afterAll(() => rmSync(area, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

function cli(args: string[], env: Record<string, string | undefined> = {}) {
  // Three Go phases share one cold cache: the first compile is the slow one. 420s covers that
  // compile plus the Python and Rust samples without treating a finished demo as a hang.
  const out = Bun.spawnSync([binary, "demo", ...args], { cwd: area, env: { ...process.env, ...env }, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 420_000 });
  return { code: out.exitCode, text: out.stdout.toString(), stderr: out.stderr.toString() };
}

function remaining() { return readdirSync(tmpdir()).filter(name => name.startsWith("pregate-owned-demo-")).sort(); }

function expectSample(sample: any, language: string) {
  expect(sample.language).toBe(language);
  expect(sample.policy).toEqual({ architecture: "enforce", quality: "shadow", core: "enforce" });
  expect(sample.baseline.debt).toBeGreaterThan(0);
  expect(sample.baseline.unverified).toBe(64);
  expect(sample.newEdit).toEqual({ decision: "deny", beforeWrite: true });
  expect(sample.syntax).toEqual({ decision: "deny" });
  expect(sample.marker).toEqual({ decision: "deny", stringDecision: "none" });
  expect(sample.repair).toEqual({ decision: "none", appliedAfterGate: true, repeated: "none" });
  expect(sample.final).toEqual({ debt: 0, unverified: 64 });
  for (const phase of ["existing-debt", "valid-repair", "repeat-repair", "existing-debt-repair", "marker-in-string"]) expect(sample.receipts.find((r: any) => r.phase === phase).code).toBe(0);
  for (const phase of ["new-boundary-violation", "invalid-syntax", "new-generated-marker"]) expect(sample.receipts.find((r: any) => r.phase === phase).code).toBe(2);
  expect(sample.receipts.filter((r: any) => r.phase === "whole-tree-audit").map((r: any) => r.code)).toEqual([2, 2, 2]);
  for (const receipt of sample.receipts) expect(receipt.stdoutHash).toMatch(/^[a-f0-9]{64}$/);
}

test("demo rejects unsafe options without generating a project or approving a contract", () => {
  const before = remaining(), files = readdirSync(area).sort();
  for (const args of [["--yes"], ["--language", "ruby"], ["--language", "python", "--language", "go"], ["--json", "--json"], ["--language"]]) {
    const out = cli(args);
    expect(out.code).toBe(1); expect(out.text).toContain("usage: pregate demo");
  }
  expect(remaining()).toEqual(before); expect(readdirSync(area).sort()).toEqual(files);
});

test("Python demo runs real launcher decisions and native behavior despite hostile ambient Git settings, then cleans up", () => {
  const outside = join(area, "ambient-project"), template = join(area, "ambient-template");
  mkdirSync(outside); mkdirSync(join(template, "hooks"), { recursive: true });
  writeFileSync(join(outside, "keep.txt"), "untouched");
  const gitEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
    HOME: area, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null" };
  expect(Bun.spawnSync(["git", "init", "-q", "--template=", outside], { env: gitEnv, stdout: "pipe", stderr: "pipe" }).exitCode).toBe(0);
  const index = join(outside, "ambient-index"), config = join(area, "ambient-gitconfig"), marker = join(outside, "should-not-exist");
  writeFileSync(config, "[core]\n\thooksPath = " + join(template, "hooks") + "\n");
  writeFileSync(join(template, "hooks/post-commit"), `#!/bin/sh\nprintf leaked > '${marker.replaceAll("'", "'\\''")}'\n`);
  chmodSync(join(template, "hooks/post-commit"), 0o755);
  const before = remaining(), out = cli(["--language", "python", "--json"], {
    GIT_DIR: join(outside, ".git"), GIT_WORK_TREE: outside, GIT_COMMON_DIR: join(outside, ".git"), GIT_INDEX_FILE: index,
    GIT_TEMPLATE_DIR: template, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.hooksPath", GIT_CONFIG_VALUE_0: join(template, "hooks"),
  });
  expect(readFileSync(join(outside, "keep.txt"), "utf8")).toBe("untouched");
  expect(existsSync(index)).toBe(false); expect(existsSync(marker)).toBe(false);
  expect(remaining()).toEqual(before);
  expect(out.code, out.text + out.stderr).toBe(0);
  const report = JSON.parse(out.text);
  expect(report).toMatchObject({ mode: "isolated-owned-sample-automation", engine: VERSIONS, cleanup: true, binarySha256: sha256(readFileSync(binary)) });
  expectSample(report.samples[0], "python");
  expect(report.samples).toHaveLength(1);
  if (Bun.which("python3")) expect(report.samples[0].native.baseline.status).toBe("passed");
  else expect(report.samples[0].native.baseline.status).toBe("not-verified");
  expect(report.samples[0].native.repaired.status).toBe(report.samples[0].native.baseline.status);
  expect(report.samples[0].native.proposedInSeparateCopy.status).toBe(report.samples[0].native.baseline.status);
  expect(out.text).not.toContain(area); expect(out.text).not.toContain("/Users/");
});

test("Go demo denies module imports before writes and reports the actual native-tool availability", () => {
  const before = remaining(), out = cli(["--language", "go", "--json"]);
  expect(remaining()).toEqual(before);
  expect(out.code, out.text + out.stderr).toBe(0);
  const report = JSON.parse(out.text); expectSample(report.samples[0], "go");
  expect(report.samples[0].native.repaired.status).toBe(Bun.which("go") ? "passed" : "not-verified");
  expect(report.samples[0].native.proposedInSeparateCopy.status).toBe(report.samples[0].native.repaired.status);
  if (!Bun.which("go")) expect(report.samples[0].native.repaired.reason).toContain("not available");
  const withoutGo = "/usr/bin:/bin:/usr/sbin:/sbin";
  if (process.platform !== "win32" && !Bun.which("go", { PATH: withoutGo })) {
    const unavailable = cli(["--language", "go", "--json"], { PATH: withoutGo });
    expect(unavailable.code, unavailable.text + unavailable.stderr).toBe(0);
    const sample = JSON.parse(unavailable.text).samples[0];
    expectSample(sample, "go");
    expect(sample.native.baseline.status).toBe("not-verified");
    expect(sample.native.repaired.status).toBe("not-verified");
    expect(sample.receipts.some((r: any) => r.phase.startsWith("native-"))).toBe(false);
  }
  expect(remaining()).toEqual(before);
});

test("all languages and a repeated independent demo preserve unknown core coverage and leave no installation behind", () => {
  const before = remaining(), all = cli(["--json"]);
  expect(all.code, all.text + all.stderr).toBe(0);
  const report = JSON.parse(all.text);
  expect(report.samples.map((s: any) => s.language)).toEqual(["python", "go", "rust"]);
  for (const sample of report.samples) expectSample(sample, sample.language);
  const again = cli(["--language", "python"]);
  expect(again.code, again.text + again.stderr).toBe(0);
  expect(again.text).toContain("your projects and global settings are unchanged");
  expect(again.text).toContain("UNVERIFIED: 64");
  expect(again.text).toContain("cleaned up");
  expect(remaining()).toEqual(before);
});

test("a failing compiled engine is surfaced and its temporary installation is removed", () => {
  // The public command has no executable override. Exercise the internal coordinator with a
  // deliberately incompatible owned program to verify failure cleanup before any setup.
  const before = remaining();
  const out = Bun.spawnSync([process.execPath, "-e", `import {demo} from ${JSON.stringify(join(import.meta.dir, "../src/demo-command.ts"))}; const r=await demo(["--language","python","--json"],process.execPath); console.log(r.text); process.exit(r.code);`],
    { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe", timeout: 15_000 });
  expect(out.exitCode).toBe(1);
  expect(JSON.parse(out.stdout.toString())).toMatchObject({ cleanup: true, error: "Demo requires the compiled binary of this engine/core version." });
  expect(remaining()).toEqual(before);
});
