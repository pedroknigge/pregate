import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

// Names `pregate setup` treats as a harness binary (src/machine.ts BINARIES).
// `agent` is Cursor's CLI. A directory that contains one of these is omitted so a
// test that isolates HOME does not still detect the tester's Claude, Codex, Cursor, Grok, or agy.
const HARNESS_BINARIES = ["claude", "codex", "cursor-agent", "agent", "grok", "agy"];
const WINDOWS_EXTS = ["", ".exe", ".cmd", ".bat", ".com"];

function hasHarnessBinary(dir: string): boolean {
  const exts = process.platform === "win32" ? WINDOWS_EXTS : [""];
  return HARNESS_BINARIES.some((name) => exts.some((ext) => existsSync(join(dir, name + ext))));
}

// Host PATH with harness CLI directories removed. `prefix` is searched first
// (the test's own bins). git, sh, and the rest of the toolchain stay.
export function pathWithoutHarnesses(prefix: readonly string[] = []): string {
  const raw = [process.env.PATH, process.env.Path].filter((value): value is string => Boolean(value)).join(delimiter);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const dir of raw.split(delimiter)) {
    const key = process.platform === "win32" ? dir.toLowerCase() : dir;
    if (dir === "" || seen.has(key)) continue;
    seen.add(key);
    if (!hasHarnessBinary(dir)) kept.push(dir);
  }
  return [...prefix, ...kept].join(delimiter);
}
