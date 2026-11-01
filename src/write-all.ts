import { writeSync } from "node:fs";

const RETRYABLE = new Set(["EAGAIN", "EWOULDBLOCK", "EINTR"]);
const pause = new Int32Array(new SharedArrayBuffer(4));

// Bun makes a piped stdout or stderr non-blocking as soon as `process.stdout` or
// `process.stderr` is touched (even `.isTTY`). A write to that pipe then accepts only what
// fits: a short count, or EAGAIN when it is full. Neither finishes the write, so wait for
// the reader and continue. Any other error still fails the command.
export function writeAll(fd: number, data: string | Uint8Array): void {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
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
