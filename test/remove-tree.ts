import { removeReleased as release } from "../src/disk.ts";

// Windows: an on-access scanner holds a just-written or just-run pregate.exe open without delete
// sharing. The product waits that lock out; a lock that lasts is still an error.
export function removeReleased(path: string, waitMs = 15_000): void {
  release(path, waitMs);
}

export function removeTree(dir: string): void {
  removeReleased(dir, 5_000);
}
