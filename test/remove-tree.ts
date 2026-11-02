import { rmSync } from "node:fs";

// Windows: an on-access scanner holds a just-written or just-run pregate.exe open for a moment, so
// deleting the test's directory fails with EBUSY or EPERM. The test has already finished. The delete
// is repeated only while that lock lasts, for at most about five seconds; a lasting lock still fails.
export function removeTree(dir: string): void {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 50; attempt++) {
    try { rmSync(dir, { recursive: true, force: true }); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EBUSY" && code !== "EPERM" && code !== "ENOTEMPTY") throw error;
      Atomics.wait(pause, 0, 0, 100);
    }
  }
  rmSync(dir, { recursive: true, force: true });
}
