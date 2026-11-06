import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { pathKey } from "../src/paths.ts";
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

// which can return a Store App Execution Alias that stat and realpath cannot read. Availability
// follows the demo: skip that PATH entry, and use a later one when it resolves.
function toolResolves(name: string, path = process.env.PATH ?? process.env.Path ?? ""): boolean {
  const seen = new Set<string>();
  let pathEnv = path;
  for (;;) {
    const found = Bun.which(name, { PATH: pathEnv });
    if (found === null || seen.has(found)) return false;
    seen.add(found);
    try {
      statSync(found);
      realpathSync(found);
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EACCES" && code !== "EPERM") throw error;
      const target = directoryKey(dirname(found));
      let removed = false;
      const kept = pathEnv.split(delimiter).filter((entry) => {
        if (entry === "" || directoryKey(entry) !== target) return entry !== "";
        removed = true;
        return false;
      });
      if (!removed) return false;
      pathEnv = kept.join(delimiter);
    }
  }
}

function directoryKey(entry: string): string {
  return pathKey(isAbsolute(entry) ? entry : resolve(entry)).replace(/\/+$/, "");
}

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
  if (toolResolves("python3")) expect(report.samples[0].native.baseline.status).toBe("passed");
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
  expect(report.samples[0].native.repaired.status).toBe(toolResolves("go") ? "passed" : "not-verified");
  expect(report.samples[0].native.proposedInSeparateCopy.status).toBe(report.samples[0].native.repaired.status);
  if (!toolResolves("go")) expect(report.samples[0].native.repaired.reason).toMatch(/not available|could not be resolved/);
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

test("an unresolvable PATH candidate is skipped and the other language demos still run", () => {
  // stat/realpath on a Store App Execution Alias throw EACCES. The same denial is applied to a
  // PATH candidate here, including that alias when this machine has one. A later Go entry must
  // still run, and Python must be reported instead of failing the demo.
  const root = join(area, "unresolvable-path");
  const blocked = join(root, "blocked"), stubDir = join(root, "stub"), gitDir = join(root, "git");
  const win = process.platform === "win32";
  const place = (dir: string, name: string, text: string) => {
    mkdirSync(dir, { recursive: true });
    const path = join(dir, name);
    writeFileSync(path, text);
    chmodSync(path, 0o755);
    return path;
  };
  const blockedPython = place(blocked, win ? "python3.exe" : "python3", "blocked\n");
  const blockedGo = place(blocked, win ? "go.exe" : "go", "blocked\n");
  place(stubDir, win ? "go.cmd" : "go", win ? "@echo off\r\necho stub-go\r\nexit /b 0\r\n" : "#!/bin/sh\nprintf '%s\\n' stub-go\nexit 0\n");
  const git = Bun.which("git");
  expect(git, "git is required to run the demo").not.toBeNull();
  // A private directory, so a later real python3 cannot hide the denied candidate. The wrapper
  // runs the real git without putting git's own directory, which may also contain python3, on PATH.
  place(gitDir, win ? "git.cmd" : "git", win ? `@echo off\r\n"${git}" %*\r\n` : `#!/bin/sh\nexec ${JSON.stringify(git)} "$@"\n`);
  const alias = storePythonAlias();
  const path = [blocked, ...(alias === null ? [] : [alias]), stubDir, gitDir].join(delimiter);
  expect(Bun.which("python3", { PATH: blocked })).toBe(blockedPython);
  expect(Bun.which("go", { PATH: stubDir })).not.toBeNull();
  const before = remaining();
  const out = Bun.spawnSync([process.execPath, join(import.meta.dir, "demo-path-run.ts")], {
    cwd: join(import.meta.dir, ".."),
    env: { ...process.env, PATH: path, Path: path, BLOCKED_PYTHON: blockedPython, BLOCKED_GO: blockedGo, DEMO_BINARY: binary },
    stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 420_000,
  });
  expect(out.exitCode, out.stdout.toString() + out.stderr.toString()).toBe(0);
  const report = JSON.parse(out.stdout.toString());
  expect(report.samples.map((sample: { language: string }) => sample.language)).toEqual(["python", "go", "rust"]);
  const [python, go, rust] = report.samples;
  expectSample(python, "python");
  expect(python.native.baseline).toMatchObject({ status: "not-verified" });
  expect(python.native.baseline.reason).toContain("could not be resolved");
  expect(python.native.baseline.reason).toContain("permission denied");
  expect(python.native.repaired.status).toBe("not-verified");
  expect(python.native.proposedInSeparateCopy.status).toBe("not-verified");
  expect(python.receipts.some((receipt: { phase: string }) => receipt.phase.startsWith("native-"))).toBe(false);
  expectSample(go, "go");
  expect(go.native.baseline.status).toBe("passed");
  expect(go.native.repaired.status).toBe("passed");
  expect(go.native.repaired.version).toBe("stub-go");
  expect(go.native.proposedInSeparateCopy.status).toBe("passed");
  expectSample(rust, "rust");
  expect(rust.native.baseline.status).toBe("not-verified");
  expect(rust.native.baseline.reason).toContain("not available");
  expect(remaining()).toEqual(before);
});

function storePythonAlias(): string | null {
  if (process.platform !== "win32") return null;
  const local = process.env.LOCALAPPDATA;
  if (local === undefined || local === "") return null;
  const alias = join(local, "Microsoft", "WindowsApps", "python3.exe");
  if (!existsSync(alias)) return null;
  try {
    statSync(alias);
    realpathSync(alias);
    return null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "EACCES" || code === "EPERM" ? join(local, "Microsoft", "WindowsApps") : null;
  }
}

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
