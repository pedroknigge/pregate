import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("a full pipe still delivers every stdout byte", () => {
  const modulePath = JSON.stringify(fileURLToPath(new URL("../src/write-all.ts", import.meta.url)));
  const bytes = 2 * 1024 * 1024;
  const script = `import { writeAll } from ${modulePath}; writeAll(1, Buffer.alloc(${bytes}, 65));`;
  const run = Bun.spawnSync([process.execPath, "-e", script], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.length).toBe(bytes);
});
