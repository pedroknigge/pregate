import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { enable, markReached } from "../src/consent.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { supervise } from "../src/supervisor.ts";
import { removeTree } from "./remove-tree.ts";

setDefaultTimeout(15_000);
const area = mkdtempSync(join(tmpdir(), "pregate-rule-supervisor-"));
const data = join(area, "data"), root = join(area, "project"), version = "8.8.8";
mkdirSync(join(data, version), { recursive: true });
mkdirSync(root);
copyFileSync(process.execPath, join(data, version, ENGINE_FILE));
enable(root, data);
afterAll(() => removeTree(area));
const raw = JSON.stringify({ cwd: root, session_id: "timeout", tool_name: "Write", tool_input: { file_path: join(root, "src/a.ts"), content: "export const a = 1;" } });
const source = JSON.stringify(fileURLToPath(new URL("../src/progress.ts", import.meta.url)));

test("a supervisor deadline lets the call through and names the individual rule still executing", async () => {
  const script = `import { checkpoint, ruleEvaluationProgress } from ${source};
    checkpoint("rules");
    ruleEvaluationProgress("pack/ACTUAL-001", () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0));`;
  const start = performance.now();
  const out = await supervise(data, version, ["-e", script], raw);
  expect(out.exit).toBe(0);
  expect(out.stderr).toContain("PREGATE NOTE engine-failure");
  expect(out.stderr).toContain("Not blocked.");
  expect(out.stdout + out.stderr).toContain("the engine timed out; last engine checkpoint: rules; executing rule: pack/ACTUAL-001");
  expect(out.stdout + out.stderr).not.toContain("PREGATE-RULE");
  expect(performance.now() - start).toBeGreaterThanOrEqual(4_900);
  expect(performance.now() - start).toBeLessThan(8_000);
});

test("a timed-out engine is dead before the call is let through", async () => {
  const pidFile = join(area, "engine.pid");
  const script = `import { writeFileSync } from "node:fs";
    writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);`;
  const start = performance.now();
  const out = await supervise(data, version, ["-e", script], raw);
  expect(out.exit).toBe(0);
  expect(out.stderr).toContain("PREGATE NOTE engine-failure");
  expect(out.stderr).toContain("Not blocked.");
  expect(out.stdout + out.stderr).toContain("the engine timed out");
  expect(performance.now() - start).toBeGreaterThanOrEqual(4_900);
  expect(performance.now() - start).toBeLessThan(8_000);
  const pid = Number(readFileSync(pidFile, "utf8"));
  expect(() => process.kill(pid, 0)).toThrow();
});

// Windows CI run 44400647892 denied a clean `git switch` with "last engine checkpoint: admission".
// The child had reached admission, and the rest of the classification was killed because startup
// had already used the 5 s. A child that spends most of that window before admission, then finishes
// inside 5 s of the checkpoint, is an allow. A child that hangs after admission is still killed 5 s later.
test("time before admission does not consume the pre budget", async () => {
  const script = `import { checkpoint } from ${source};
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
    checkpoint("admission");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 4600);`;
  const start = performance.now();
  const out = await supervise(data, version, ["-e", script], raw);
  const elapsed = performance.now() - start;
  expect(out.exit).toBe(0);
  expect(out.stdout + out.stderr).not.toContain("timed out");
  expect(elapsed).toBeGreaterThan(5_000);
  expect(elapsed).toBeLessThan(12_000);
});

test("a hang after admission is still cut 5 s after that checkpoint", async () => {
  const mark = join(area, "admitted-at");
  const script = `import { writeFileSync } from "node:fs";
    import { checkpoint } from ${source};
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
    checkpoint("admission");
    writeFileSync(${JSON.stringify(mark)}, String(Date.now()));
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);`;
  const out = await supervise(data, version, ["-e", script], raw);
  expect(out.exit).toBe(0);
  expect(out.stderr).toContain("PREGATE NOTE engine-failure");
  expect(out.stderr).toContain("Not blocked.");
  expect(out.stdout + out.stderr).toContain("the engine timed out; last engine checkpoint: admission");
  const waited = Date.now() - Number(readFileSync(mark, "utf8"));
  expect(waited).toBeGreaterThanOrEqual(4_900);
  expect(waited).toBeLessThan(8_000);
});

test("a resolution timeout does not blame a completed individual rule", async () => {
  const script = `import { checkpoint, ruleEvaluationProgress, sharedResolutionProgress } from ${source};
    checkpoint("dependency-review");
    ruleEvaluationProgress("pack/COMPLETED-001", () => 1);
    sharedResolutionProgress(() => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0));`;
  const out = await supervise(data, version, ["-e", script], raw);
  expect(out.exit).toBe(0);
  expect(out.stderr).toContain("PREGATE NOTE engine-failure");
  expect(out.stderr).toContain("Not blocked.");
  expect(out.stdout + out.stderr).toContain("executing shared dependency resolution");
  expect(out.stdout + out.stderr).not.toContain("executing rule");
  expect(out.stdout + out.stderr).not.toContain("pack/COMPLETED-001");
});

test("without consent records, Stop reaches the engine only after a session reached a consented root", async () => {
  const bare = join(area, "bare-data");
  mkdirSync(join(bare, version), { recursive: true });
  copyFileSync(process.execPath, join(bare, version, ENGINE_FILE));
  const engine = join(area, "reached-engine.ts");
  writeFileSync(engine, `process.stdout.write("engine reached");`);
  const stop = JSON.stringify({ hook_event_name: "Stop", cwd: root, session_id: "removed" });
  const inert = { exit: 0 as const, stdout: "", stderr: "" };
  expect(await supervise(bare, version, [engine, "stop"], stop)).toEqual(inert);
  markReached(bare);
  expect(await supervise(bare, version, [engine, "stop"], stop)).toEqual({ exit: 0, stdout: "engine reached", stderr: "" });
  expect(await supervise(bare, version, [engine, "pre"], raw)).toEqual(inert);
});

test("no arguments and no input print a hint instead of running the engine", async () => {
  for (const input of ["", " \n"]) {
    expect(await supervise(data, version, [], input)).toEqual({
      exit: 0, stdout: "", stderr: "pregate: no command. Run pregate in a terminal for the guide, or pregate --help.\n",
    });
  }
  // Oversized or stalled input reaches here empty but invalid, and U+00A0 is input: no hint for either.
  for (const [input, entry] of [["", { invalid: true }], ["\u00a0", {}]] as const) {
    expect((await supervise(data, version, [], input, entry)).stderr).not.toContain("no command");
  }
});

// The project opts into the earlier behavior with the exact preset value "closed".
test("a project whose preset says uncertainty closed still denies a timed-out engine", async () => {
  mkdirSync(join(root, ".pregate"), { recursive: true });
  writeFileSync(join(root, ".pregate/preset.json"), '{"uncertainty":"closed"}\n');
  const script = "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);";
  const out = await supervise(data, version, ["-e", script], raw);
  expect(out.exit).toBe(2);
  expect(out.stdout + out.stderr).toContain("the engine timed out");
  expect(out.stdout + out.stderr).not.toContain("Not blocked.");
});
