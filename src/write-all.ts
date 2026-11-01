import { writeSync } from "node:fs";

const RETRYABLE = new Set(["EAGAIN", "EWOULDBLOCK", "EINTR"]);
const pause = new Int32Array(new SharedArrayBuffer(4));

// stdout is non-blocking in the compiled binary. A pipe that is full returns EAGAIN
// instead of a short count: the bytes were not accepted, so the write is not finished.
// Wait for the reader and continue. Any other error still fails the command.
export function writeAll(fd: number, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.length) {
    try {
      const wrote = writeSync(fd, bytes, offset, bytes.length - offset);
      if (wrote <= 0) throw new Error("Could not write command output.");
      offset += wrote;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === undefined || !RETRYABLE.has(code)) throw error;
      Atomics.wait(pause, 0, 0, 1);
    }
  }
}
