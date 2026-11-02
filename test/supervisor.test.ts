import { afterAll, expect, setDefaultTimeout, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { enable, markReached } from "../src/consent.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { supervise } from "../src/supervisor.ts";

setDefaultTimeout(15_000);
const area = mkdtempSync(join(tmpdir(), "pregate-rule-supervisor-"));
const data = join(area, "data"), root = join(area, "project"), version = "8.8.8";
mkdirSync(join(data, version), { recursive: true });
mkdirSync(root);
copyFileSync(process.execPath, join(data, version, ENGINE_FILE));
enable(root, data);
afterAll(() => rmSync(area, { recursive: true, force: true }));
const raw = JSON.stringify({ cwd: root, session_id: "timeout", tool_name: "Write", tool_input: { file_path: join(root, "src/a.ts"), content: "export const a = 1;" } });
const source = JSON.stringify(fileURLToPath(new URL("../src/progress.ts", import.meta.url)));

test("actual supervisor deadline names the individual rule still executing", async () => {
  const script = `import { checkpoint, ruleEvaluationProgress } from ${source};
    checkpoint("rules");
    ruleEvaluationProgress("pack/ACTUAL-001", () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0));`;
  const start = performance.now();
  const out = await supervise(data, version, ["-e", script], raw);
  expect(out.exit).toBe(2);
  expect(out.stdout + out.stderr).toContain("the engine timed out; last engine checkpoint: rules; executing rule: pack/ACTUAL-001");
  expect(out.stdout + out.stderr).not.toContain("PREGATE-RULE");
  expect(performance.now() - start).toBeGreaterThanOrEqual(4_900);
  expect(performance.now() - start).toBeLessThan(8_000);
});

test("actual resolution timeout does not blame a completed individual rule", async () => {
  const script = `import { checkpoint, ruleEvaluationProgress, sharedResolutionProgress } from ${source};
    checkpoint("dependency-review");
    ruleEvaluationProgress("pack/COMPLETED-001", () => 1);
    sharedResolutionProgress(() => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0));`;
  const out = await supervise(data, version, ["-e", script], raw);
  expect(out.exit).toBe(2);
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
