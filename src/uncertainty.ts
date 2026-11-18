import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Only the exact JSON string "open" opts out. A missing key, "closed", and a file that does not parse stay closed.
export function uncertaintyOpen(text: string): boolean {
  try {
    const value = JSON.parse(text) as { uncertainty?: unknown };
    return value.uncertainty === "open";
  } catch (error) {
    if (error instanceof SyntaxError) return false;
    throw error;
  }
}

// True only when every directory's preset says open. A missing or unreadable preset is closed.
// No directory uses the working directory: a crash with no path still reads the project the hook ran in.
export function uncertaintyAllows(dirs: readonly string[]): boolean {
  const roots = dirs.length === 0 ? [process.cwd()] : dirs;
  return roots.every((dir) => typeof dir === "string" && dir !== "" && presetOpen(dir));
}

function presetOpen(start: string): boolean {
  let dir = start;
  const seen = new Set<string>();
  for (let n = 0; n < 40; n++) {
    if (seen.has(dir)) return false;
    seen.add(dir);
    const file = join(dir, ".pregate", "preset.json");
    if (existsSync(file)) {
      try {
        return uncertaintyOpen(readFileSync(file, "utf8"));
      } catch (error) {
        const code = (error as { code?: string }).code;
        // fail-closed: an unreadable preset does not opt out.
        if (code === "ENOENT" || code === "EACCES" || code === "EPERM" || code === "EISDIR") return false;
        throw error;
      }
    }
    if (existsSync(join(dir, ".git"))) return false;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
  return false;
}
