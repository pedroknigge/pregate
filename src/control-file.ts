import { closeSync, fstatSync, openSync, readSync, statSync } from "node:fs";
import { pregateControlCause } from "./control.ts";
import type { Cause } from "./types.ts";

// A literal file a command runs, read whole and decoded: UTF-8, UTF-16 or UTF-32, with or without
// a byte order mark for UTF-16. A native executable (ELF, Mach-O, PE) is not a script: `/usr/bin/git`
// is skipped. Text that cannot be classified, or a file larger than MAX_FILE, is not read as proof
// either way and is denied. The read stays in the shell layer; the core only judges the text.
const SNIFF = 8_192;
const MAX_FILE = 64 * 1024 * 1024;
const NATIVE = [[0x7f, 0x45, 0x4c, 0x46], [0xfe, 0xed, 0xfa, 0xce], [0xfe, 0xed, 0xfa, 0xcf], [0xce, 0xfa, 0xed, 0xfe],
  [0xcf, 0xfa, 0xed, 0xfe], [0xca, 0xfe, 0xba, 0xbe], [0x4d, 0x5a]];

export function controlInFile(path: string | null): Cause | null {
  if (path === null || path === "") return null;
  let fd: number | null = null;
  try {
    if (!statSync(path).isFile()) return null;
    fd = openSync(path, "r");
    const size = fstatSync(fd).size;
    const head = Buffer.alloc(Math.min(size, SNIFF));
    const n = readSync(fd, head, 0, head.length, 0);
    if (n === 0) return null;
    if (native(head.subarray(0, n))) return null;
    if (size > MAX_FILE) return "shell-admin";
    const buf = Buffer.alloc(size);
    let read = 0;
    while (read < size) {
      const got = readSync(fd, buf, read, size - read, read);
      if (got === 0) break;
      read += got;
    }
    const text = decode(buf.subarray(0, read));
    return text === null ? "shell-admin" : pregateControlCause(text);
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

function native(head: Buffer): boolean {
  return head.includes(0) && NATIVE.some((magic) => magic.every((byte, i) => head[i] === byte));
}

// The text of a script, or null when its bytes are no text PowerShell, a shell or an interpreter reads.
export function decode(buf: Buffer): string | null {
  const starts = (...bytes: number[]) => bytes.every((byte, i) => buf[i] === byte);
  if (starts(0xff, 0xfe, 0x00, 0x00)) return utf32(buf.subarray(4), true);
  if (starts(0x00, 0x00, 0xfe, 0xff)) return utf32(buf.subarray(4), false);
  if (starts(0xef, 0xbb, 0xbf)) return text(buf.toString("utf8", 3));
  if (starts(0xff, 0xfe)) return utf16(buf.subarray(2), true);
  if (starts(0xfe, 0xff)) return utf16(buf.subarray(2), false);
  if (!buf.includes(0)) return buf.toString("utf8");
  // UTF-16 without a mark: ASCII text leaves every other byte zero.
  const zeros = (parity: number) => { let n = 0, all = 0; for (let i = parity; i < Math.min(buf.length, SNIFF); i += 2) { all++; if (buf[i] === 0) n++; } return all === 0 ? 0 : n / all; };
  const odd = zeros(1), even = zeros(0);
  if (odd >= 0.9 && even < 0.1) return utf16(buf, true);
  if (even >= 0.9 && odd < 0.1) return utf16(buf, false);
  return null;
}

function utf16(buf: Buffer, little: boolean): string | null {
  if (buf.length % 2 !== 0) return null;
  const bytes = Buffer.from(buf);
  return text((little ? bytes : bytes.swap16()).toString("utf16le"));
}

function utf32(buf: Buffer, little: boolean): string | null {
  if (buf.length % 4 !== 0) return null;
  let out = "";
  for (let i = 0; i < buf.length; i += 4) {
    const point = little ? buf.readUInt32LE(i) : buf.readUInt32BE(i);
    if (point > 0x10ffff) return null;
    out += String.fromCodePoint(point);
  }
  return text(out);
}

// A NUL left after decoding means the encoding was not the one guessed.
function text(decoded: string): string | null {
  return decoded.includes("\0") ? null : decoded;
}
