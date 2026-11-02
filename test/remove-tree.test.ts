import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeReleased } from "./remove-tree.ts";

const WINDOWS = process.platform === "win32";

function inTemp(run: (dir: string) => void | Promise<void>): () => Promise<void> {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), "pregate-remove-"));
    try { await run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  };
}

// Opens the file with FileShare.None, the way an on-access scanner holds a new executable.
async function holdExclusive(path: string, ms: number) {
  const script = `$f=[IO.File]::Open('${path.replaceAll("'", "''")}','Open','Read','None'); [Console]::Out.WriteLine('locked'); [Console]::Out.Flush(); Start-Sleep -Milliseconds ${ms}; $f.Close()`;
  const child = Bun.spawn(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const first = await child.stdout.getReader().read();
  expect(new TextDecoder().decode(first.value)).toContain("locked");
  return child;
}

test("a free file is removed at once", inTemp((dir) => {
  const file = join(dir, "pregate.exe");
  writeFileSync(file, "engine");
  const started = performance.now();
  removeReleased(file, 10_000);
  expect(performance.now() - started).toBeLessThan(500);
  expect(existsSync(file)).toBe(false);
}));

// rm with force ignores a missing path on every platform; a NUL byte is rejected before any file is touched.
test("an error that is not a sharing lock fails without waiting", inTemp((dir) => {
  const started = performance.now();
  expect(() => removeReleased(join(dir, "pregate\0.exe"), 10_000)).toThrow(expect.objectContaining({ code: "ERR_INVALID_ARG_VALUE" }));
  expect(performance.now() - started).toBeLessThan(500);
}));

test.skipIf(!WINDOWS)("a delete waits for another process to release the file, then completes", inTemp(async (dir) => {
  const file = join(dir, "pregate.exe");
  writeFileSync(file, "engine");
  const holder = await holdExclusive(file, 1_500);
  const started = performance.now();
  removeReleased(file);
  expect(performance.now() - started).toBeGreaterThan(200);
  expect(existsSync(file)).toBe(false);
  expect(await holder.exited).toBe(0);
}), 30_000);

test.skipIf(!WINDOWS)("a lock that outlasts the wait is still an error and leaves the file", inTemp(async (dir) => {
  const file = join(dir, "pregate.exe");
  writeFileSync(file, "engine");
  const holder = await holdExclusive(file, 6_000);
  try {
    expect(() => removeReleased(file, 500)).toThrow(expect.objectContaining({ code: "EBUSY" }));
    expect(existsSync(file)).toBe(true);
  } finally { holder.kill(); await holder.exited; }
}), 30_000);
