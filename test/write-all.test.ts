import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const modulePath = JSON.stringify(fileURLToPath(new URL("../src/write-all.ts", import.meta.url)));
const BYTES = 2 * 1024 * 1024;

// Touching `process.stdout` or `process.stderr` makes Bun switch that pipe to non-blocking, as the CLI
// does when it checks `isTTY`. The parent reads only after a pause, so the pipe is full while the child writes.
async function slowReader(fd: 1 | 2, write: string): Promise<{ code: number; delivered: number; report: string }> {
  const stream = fd === 1 ? "process.stdout" : "process.stderr";
  const script = `import { writeSync } from "node:fs"; import { writeAll } from ${modulePath};
void ${stream}.isTTY; const bytes = Buffer.alloc(${BYTES}, 65);
const wrote = ${write}; writeSync(${3 - fd}, String(wrote));`;
  const child = Bun.spawn([process.execPath, "-e", script], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  await Bun.sleep(300);
  const [out, err] = await Promise.all([new Response(child.stdout).arrayBuffer(), new Response(child.stderr).text()]);
  const [delivered, report] = fd === 1 ? [out.byteLength, err] : [Buffer.byteLength(err), Buffer.from(out).toString()];
  return { code: await child.exited, delivered, report };
}

for (const fd of [1, 2] as const) {
  test(`a full non-blocking pipe on fd ${fd} still receives every byte`, async () => {
    const run = await slowReader(fd, `(writeAll(${fd}, bytes), bytes.length)`);
    expect(run.code, run.report).toBe(0);
    expect(run.delivered).toBe(BYTES);
    expect(run.report).toBe(String(BYTES));
  });

  test.skipIf(process.platform === "win32")(`a bare writeSync on fd ${fd} is cut short by the same pipe`, async () => {
    const run = await slowReader(fd, `(() => { try { return writeSync(${fd}, bytes); } catch (e) { return e.code; } })()`);
    expect(run.code).toBe(0);
    expect(run.delivered).toBeLessThan(BYTES);
    expect(run.report).not.toBe(String(BYTES));
  });
}

test("text is written as UTF-8", () => {
  const script = `import { writeAll } from ${modulePath}; writeAll(1, "Grüße ✓\\n");`;
  const run = Bun.spawnSync([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString("utf8")).toBe("Grüße ✓\n");
});
