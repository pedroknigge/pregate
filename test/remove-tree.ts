import { removeReleased as release } from "../src/disk.ts";

// Windows can still map a just-run pregate.exe after that process has exited, so deleting the
// directory throws EBUSY. Bun's rmSync ignores maxRetries and throws at once. This waits that
// lock out. A lock that lasts is still an error.
export function removeReleased(path: string, waitMs = 15_000): void {
  release(path, waitMs);
}

export function removeTree(dir: string): void {
  removeReleased(dir, 5_000);
}
