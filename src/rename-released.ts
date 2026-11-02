import { renameSync } from "node:fs";

const LOCKED = new Set(["EBUSY", "EPERM", "EACCES"]);
const pause = new Int32Array(new SharedArrayBuffer(4));

// Windows refuses to rename a file that another process holds open without delete sharing. An
// on-access scanner opens a new executable that way for a moment after it is written or first run.
// Wait for that handle to close. A lock that outlasts `waitMs` is still an error.
export function renameReleased(from: string, to: string, waitMs = 15_000, windows = process.platform === "win32"): void {
  const deadline = Date.now() + waitMs;
  for (let delay = 10; ; delay = Math.min(delay * 2, 500)) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!windows || code === undefined || !LOCKED.has(code) || Date.now() >= deadline) throw error;
      Atomics.wait(pause, 0, 0, delay);
    }
  }
}
