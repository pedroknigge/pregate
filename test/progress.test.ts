import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { progressOutput } from "../src/progress.ts";

const progressModule = JSON.stringify(fileURLToPath(new URL("../src/progress.ts", import.meta.url)));

test("checkpoint output preserves ordinary stderr byte for byte", () => {
  for (const stderr of ["", "note", "note\n", "\r\n", "PREGATE-CHECKPOINT unknown\n", "PREGATE-CHECKPOINT rules /private/source\n"]) {
    expect(progressOutput(stderr)).toEqual({ stderr, detail: "" });
  }
});

test("only fixed checkpoints are consumed; the last observed stage is reported", () => {
  expect(progressOutput("PREGATE-CHECKPOINT input\nreason\nPREGATE-CHECKPOINT dependency-review\r\n")).toEqual({
    stderr: "reason\n", detail: "; last engine checkpoint: dependency-review",
  });
  expect(progressOutput("PREGATE-CHECKPOINT rules\n").stderr).toBe("");
});

test("import review diagnostics name jointly active rules and measured shared duration", () => {
  expect(progressOutput("note\nPREGATE-CHECKPOINT dependency-review\nPREGATE-IMPORT-REVIEW rules=architecture/dependencies/layers,library/imports/no-private\nPREGATE-IMPORT-REVIEW completed=12.3ms\n")).toEqual({
    stderr: "note\n", detail: "; last engine checkpoint: dependency-review; shared import review: architecture/dependencies/layers,library/imports/no-private (12.3 ms)",
  });
  expect(progressOutput("PREGATE-CHECKPOINT dependency-review\nPREGATE-IMPORT-REVIEW rules=architecture/dependencies/layers,more=9\n").detail)
    .toBe("; last engine checkpoint: dependency-review; shared import review: architecture/dependencies/layers,more=9");
  expect(progressOutput("PREGATE-CHECKPOINT dependency-review\nPREGATE-IMPORT-REVIEW rules=architecture/FCIS-DEP-001,architecture/FCIS-IO-001\n").detail)
    .toBe("; last engine checkpoint: dependency-review; shared import review: architecture/FCIS-DEP-001,architecture/FCIS-IO-001");
  const diagnostic = "PREGATE-IMPORT-REVIEW rules=architecture/dependencies/layers /private/source\nPREGATE-IMPORT-REVIEW completed=oopsms\n";
  expect(progressOutput(diagnostic)).toEqual({ stderr: diagnostic, detail: "" });
});

test("a later review resets its duration and a later stage does not attribute a timeout to imports", () => {
  const old = "PREGATE-CHECKPOINT dependency-review\nPREGATE-IMPORT-REVIEW rules=architecture/dependencies/old\nPREGATE-IMPORT-REVIEW completed=12.3ms\n";
  expect(progressOutput(old + "PREGATE-IMPORT-REVIEW rules=architecture/dependencies/new\n").detail)
    .toBe("; last engine checkpoint: dependency-review; shared import review: architecture/dependencies/new");
  expect(progressOutput(old + "PREGATE-CHECKPOINT stop-inventory\n").detail).toBe("; last engine checkpoint: stop-inventory");
});

test("a real review emits winning alias IDs and bounds oversized diagnostic lists", () => {
  const script = `import { checkpoint, importReviewProgress } from ${progressModule};
    checkpoint("dependency-review");
    const result = importReviewProgress(["architecture/FCIS-DEP-001", "architecture/FCIS-IO-001"], () => 42);
    if (result !== 42) process.exit(1);
    importReviewProgress(Array.from({length: 100}, (_, i) => "team/ID-" + i), () => 1);`;
  const run = Bun.spawnSync([process.execPath, "-e", script], { env: { ...process.env, PREGATE_PROGRESS: "1" }, stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode).toBe(0);
  const stderr = run.stderr.toString();
  expect(stderr).toContain("rules=architecture/FCIS-DEP-001,architecture/FCIS-IO-001\n");
  expect(stderr).toContain(",more=92\n");
  expect(progressOutput(stderr).stderr).toBe("");
  expect(stderr.length).toBeLessThan(2300);
});

test("only an unfinished individual evaluation is named as the executing rule", () => {
  const start = "PREGATE-CHECKPOINT rules\nPREGATE-RULE started=pack/RULE-001\n";
  expect(progressOutput(start).detail).toBe("; last engine checkpoint: rules; executing rule: pack/RULE-001");
  expect(progressOutput(start + "PREGATE-RULE completed=pack/RULE-001 1.2ms\n").detail).toBe("; last engine checkpoint: rules");
  expect(progressOutput(start + "PREGATE-CHECKPOINT parse\n").detail).toBe("; last engine checkpoint: parse");
  const untrusted = "PREGATE-RULE started=pack/RULE-001 /private/source\n";
  expect(progressOutput(untrusted)).toEqual({ stderr: untrusted, detail: "" });
});

test("shared resolution masks the surrounding rule and completion restores its actual evaluation", () => {
  const start = "PREGATE-CHECKPOINT dependency-review\nPREGATE-RULE started=architecture/DEP-001\nPREGATE-RESOLUTION started\n";
  expect(progressOutput(start).detail).toBe("; last engine checkpoint: dependency-review; executing shared dependency resolution");
  expect(progressOutput(start + "PREGATE-RESOLUTION completed=2.0ms\n").detail).toBe("; last engine checkpoint: dependency-review; executing rule: architecture/DEP-001");
  expect(progressOutput(start + "PREGATE-RESOLUTION completed=2.0ms\nPREGATE-RULE completed=architecture/DEP-001 3.0ms\n").stderr).toBe("");
});

test("oversized and malformed individual progress remains ordinary stderr", () => {
  for (const marker of [`PREGATE-RULE started=pack/${"A".repeat(257)}\n`,
    `PREGATE-RULE completed=pack/${"A".repeat(257)} 1.0ms\n`,
    "PREGATE-RESOLUTION started /private/source\n", "PREGATE-RESOLUTION completed=oopsms\n"]) {
    expect(progressOutput(marker)).toEqual({ stderr: marker, detail: "" });
  }
});

test("a Stop root ordinal names the fan-out and restarts the stage for the next root", () => {
  const first = "PREGATE-STOP-ROOT 1/19 /work/main\nPREGATE-CHECKPOINT stop-inventory\nPREGATE-CHECKPOINT dependency-review\nPREGATE-IMPORT-REVIEW rules=architecture/dependencies/layers\n";
  expect(progressOutput(first).detail).toBe("; root 1/19 /work/main; last engine checkpoint: dependency-review; shared import review: architecture/dependencies/layers");
  expect(progressOutput(first + "PREGATE-STOP-ROOT 12/19 /work/main/.claude/worktrees/wf a\n")).toEqual({ stderr: "", detail: "; root 12/19 /work/main/.claude/worktrees/wf a" });
  for (const marker of ["PREGATE-STOP-ROOT 0/19 /work\n", "PREGATE-STOP-ROOT 1/19 relative\n", "PREGATE-STOP-ROOT 1/19\n"]) {
    expect(progressOutput(marker)).toEqual({ stderr: marker, detail: "" });
  }
  const script = `import { checkpoint, stopRootProgress } from ${progressModule};
    stopRootProgress(1, 2, "/a"); checkpoint("stop-inventory"); stopRootProgress(2, 2, "/b"); checkpoint("stop-inventory");`;
  const run = Bun.spawnSync([process.execPath, "-e", script], { env: { ...process.env, PREGATE_PROGRESS: "1" }, stdout: "pipe", stderr: "pipe" });
  expect(run.stderr.toString()).toBe("PREGATE-STOP-ROOT 1/2 /a\nPREGATE-CHECKPOINT stop-inventory\nPREGATE-STOP-ROOT 2/2 /b\nPREGATE-CHECKPOINT stop-inventory\n");
});
