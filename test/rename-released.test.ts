import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renameReleased, writeAtomic } from "../src/disk.ts";

const WINDOWS = process.platform === "win32";

function inTemp(run: (dir: string) => void | Promise<void>): () => Promise<void> {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), "pregate-rename-"));
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

test("an atomic write replaces the previous bytes", inTemp((dir) => {
  const path = join(dir, "lock.json");
  writeAtomic(path, "one");
  writeAtomic(path, "two");
  expect(readFileSync(path, "utf8")).toBe("two");
  expect(existsSync(path)).toBe(true);
}));

test("a free file is renamed at once", inTemp((dir) => {
  writeFileSync(join(dir, "a"), "engine");
  renameReleased(join(dir, "a"), join(dir, "b"));
  expect(existsSync(join(dir, "a"))).toBe(false);
  expect(readFileSync(join(dir, "b"), "utf8")).toBe("engine");
}));

test("an error that is not a sharing lock fails without waiting", inTemp((dir) => {
  const started = performance.now();
  expect(() => renameReleased(join(dir, "missing"), join(dir, "b"), 10_000, true)).toThrow(expect.objectContaining({ code: "ENOENT" }));
  expect(performance.now() - started).toBeLessThan(500);
}));

test.skipIf(!WINDOWS)("a rename waits for another process to release the file, then completes", inTemp(async (dir) => {
  const from = join(dir, "pregate.exe.1.tmp.exe"), to = join(dir, "pregate.exe");
  writeFileSync(from, "engine");
  const holder = await holdExclusive(from, 1_500);
  const started = performance.now();
  renameReleased(from, to);
  expect(performance.now() - started).toBeGreaterThan(200);
  expect(readFileSync(to, "utf8")).toBe("engine");
  expect(await holder.exited).toBe(0);
}), 30_000);

test.skipIf(!WINDOWS)("a lock that outlasts the wait is still an error and leaves both names as they were", inTemp(async (dir) => {
  const from = join(dir, "pregate.exe.1.tmp.exe"), to = join(dir, "pregate.exe");
  writeFileSync(from, "engine");
  const holder = await holdExclusive(from, 6_000);
  try {
    expect(() => renameReleased(from, to, 500)).toThrow(expect.objectContaining({ code: "EBUSY" }));
    expect(existsSync(from)).toBe(true);
    expect(existsSync(to)).toBe(false);
  } finally { holder.kill(); await holder.exited; }
}), 30_000);
