import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isolatedPathEnv } from "./host-command.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-git-deadline-"));
const bin = join(area, "bin");
const fake = join(bin, process.platform === "win32" ? "git.exe" : "git");
const worker = join(area, "worker.ts");
const compiled = join(area, process.platform === "win32" ? "worker.exe" : "worker");
const marker = join(area, "child-pid");

beforeAll(() => {
  mkdirSync(bin);
  const source = join(area, "fake-git.ts");
  // A real native executable works on Windows too. Its partial output must never be accepted.
  // The eventual exit bounds the negative control even if the production deadline is removed.
  writeFileSync(source, `import { writeFileSync } from "node:fs";
writeFileSync(process.env.PREGATE_GIT_PID!, String(process.pid));
process.stdout.write("partial-output");
if (process.platform !== "win32") process.on("SIGTERM", () => {});
setTimeout(() => process.exit(0), 7000);
`);
  writeFileSync(worker, `import { git, catFileBytesBatch } from ${JSON.stringify(join(import.meta.dir, "../src/git.ts"))};
try {
  const result = process.argv[2] === "batch" ? catFileBytesBatch(process.cwd(), ["HEAD:x"]) : git(process.cwd(), ["status"]);
  console.log(JSON.stringify({ result }));
} catch (error) { console.log(JSON.stringify({ error: (error as Error).message })); }
`);
  for (const [input, output] of [[source, fake], [worker, compiled]]) {
    const result = Bun.spawnSync([process.execPath, "build", input!, "--compile", "--minify", "--no-compile-autoload-bunfig", "--no-compile-autoload-dotenv", `--outfile=${output}`],
      { stdout: "pipe", stderr: "pipe", timeout: 60_000 });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
  }
});
afterAll(() => rmSync(area, { recursive: true, force: true }));

test.each(["source", "compiled"] as const)("%s Git calls terminate and reject partial output at the deadline", (kind) => {
  for (const operation of ["git", "batch"]) {
    rmSync(marker, { force: true });
    const start = performance.now();
    // Windows spells this variable `Path`. `{ ...process.env, PATH: bin }` keeps both,
    // and which spelling the worker inherits depends on the other names in the block.
    // On a stock machine the system `Path` wins, so the real Git runs. `git status`
    // fails at once because this temp directory is not a repository, and the call
    // returns null in a few hundred milliseconds. The slow git.exe is compiled, and
    // Bun resolves `git` to `git.exe`; it starts only when a single PATH spelling
    // points at the fixture. CI can pass while a stock machine does not, for that reason.
    const result = Bun.spawnSync(kind === "source" ? [process.execPath, worker, operation] : [compiled, operation], {
      cwd: area, env: { ...isolatedPathEnv(process.env, bin), PREGATE_GIT_PID: marker },
      stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000, killSignal: "SIGKILL",
    });
    const elapsed = performance.now() - start;
    expect(result.exitedDueToTimeout).toBe(false);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toEqual({ error: "Git exceeded its 5000 ms command deadline." });
    expect(elapsed).toBeGreaterThanOrEqual(4900);
    expect(elapsed).toBeLessThan(6500);
    // Both stdout and stdin paths must reap the process, not only release the caller.
    const pid = Number(readFileSync(marker, "utf8"));
    expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
    expect(() => process.kill(pid, 0)).toThrow();
  }
}, 25_000);
