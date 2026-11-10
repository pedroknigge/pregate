import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, closeSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTree } from "./remove-tree.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-runtime-"));
const source = join(area, "stdin.ts");
const binary = join(area, process.platform === "win32" ? "stdin.exe" : "stdin");
const payload = JSON.stringify({ cwd: "repo with spaces →", input: "a".repeat(65536) }) + "\n";
const input = join(area, "payload.json");
beforeAll(() => {
  mkdirSync(area, { recursive: true });
  // Exercise the entry points' descriptor read with real pipes and a compiled runtime.
  writeFileSync(source, 'import { readFileSync, writeSync } from "node:fs"; writeSync(1, readFileSync(0)); process.exit(0);\n');
  writeFileSync(input, payload);
  const built = Bun.spawnSync([process.execPath, "build", source, "--compile", "--minify", "--no-compile-autoload-bunfig", "--no-compile-autoload-dotenv", `--outfile=${binary}`], { stdout: "pipe", stderr: "pipe" });
  expect(built.exitCode, built.stderr.toString()).toBe(0);
});
afterAll(() => removeTree(area));

test.each(["source", "compiled"] as const)("%s runtime consumes complete stdin from buffered and file transports", (kind) => {
  const argv = kind === "source" ? [process.execPath, source] : [binary];
  closedAfter(openSync(input, "r"), fd => {
    const buffered = Bun.spawnSync(argv, { stdin: Buffer.from(payload), stdout: "pipe", stderr: "pipe", timeout: 5000 });
    const file = Bun.spawnSync(argv, { stdin: fd, stdout: "pipe", stderr: "pipe", timeout: 5000 });
    const node = spawnSync(argv[0]!, argv.slice(1), { input: payload, timeout: 5000 });
    const results = [["buffer", buffered], ["file", file], ["node", node]] as const;
    for (const [transport, result] of results) {
      const code = "exitCode" in result ? result.exitCode : result.status;
      console.log(JSON.stringify({ runtime: Bun.version, kind, transport, code, stdoutBytes: result.stdout?.length, stderr: result.stderr?.toString() }));
    }
    for (const [transport, result] of results) {
      const code = "exitCode" in result ? result.exitCode : result.status;
      expect(code, `${kind}/${transport}`).toBe(0);
      expect(result.stdout?.toString(), `${kind}/${transport}`).toBe(payload);
      expect(result.stderr?.toString(), `${kind}/${transport}`).toBe("");
    }
  });
});

function closedAfter(fd: number, use: (fd: number) => void): void {
  try { use(fd); } finally { closeSync(fd); }
}

// Bun's Windows spawnSync timer formerly used the previous call's cached clock.
// Keep the supported runtime's real-process regression, not an increased timeout.
test.skipIf(process.platform !== "win32")("Windows subprocess timeout starts at the current invocation after idle time", async () => {
  const command = [process.execPath, "-e", 'process.stdout.write("finished");'];
  const first = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe", timeout: 1000 });
  expect(first.exitCode).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 1300));
  const second = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe", timeout: 1000 });
  expect(second.exitCode).toBe(0);
  expect(second.exitedDueToTimeout).toBe(false);
  expect(second.stdout.toString()).toBe("finished");
  expect(second.stderr.toString()).toBe("");
});
