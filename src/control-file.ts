import { closeSync, openSync, readSync, statSync } from "node:fs";
import { pregateControlCause } from "./control.ts";
import type { Cause } from "./types.ts";

// The first 1 MiB of a literal text file, or null when it cannot be read as a regular file or
// is a binary (a NUL byte in its first 8 KiB): `/usr/bin/git` is not a script. The read stays in
// the shell layer; the core only judges the text.
const SNIFF = 8_192;
const MAX_SCAN = 1_048_576;

export function controlInFile(path: string | null): Cause | null {
  if (path === null || path === "") return null;
  let fd: number | null = null;
  try {
    if (!statSync(path).isFile()) return null;
    fd = openSync(path, "r");
    const buf = Buffer.alloc(MAX_SCAN);
    let n = readSync(fd, buf, 0, SNIFF, 0);
    if (n === 0 || buf.subarray(0, n).includes(0)) return null;
    if (n === SNIFF) n += readSync(fd, buf, SNIFF, MAX_SCAN - SNIFF, SNIFF);
    return pregateControlCause(buf.toString("utf8", 0, n));
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}
