import { rmSync } from "node:fs";

const RETRYABLE = new Set(["EBUSY", "EPERM", "EACCES", "ENOTEMPTY"]);
const pause = new Int32Array(new SharedArrayBuffer(4));

// Windows: an on-access scanner holds a just-written or just-run pregate.exe open without delete
// sharing, so rm fails with EBUSY, EPERM, or EACCES until that handle closes. Wait for it. A lock
// that outlasts `waitMs` is still an error, and any other error fails immediately.
export function removeReleased(path: string, waitMs = 15_000): void {
  const deadline = Date.now() + waitMs;
  for (let delay = 10; ; delay = Math.min(delay * 2, 500)) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === undefined || !RETRYABLE.has(code) || Date.now() >= deadline) throw error;
      Atomics.wait(pause, 0, 0, delay);
    }
  }
}

export function removeTree(dir: string): void {
  removeReleased(dir, 5_000);
}
