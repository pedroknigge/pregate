import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// A call the engine could not classify, and an engine crash, pass by default: Pregate failing must
// not stop the session. Only the exact JSON string "closed" opts a project into denying them.
export function uncertaintyOpen(text: string): boolean {
  try {
    const value = JSON.parse(text) as { uncertainty?: unknown };
    return value.uncertainty !== "closed";
  } catch (error) {
    if (error instanceof SyntaxError) return true;
    throw error;
  }
}

// False only when some directory's preset says closed. A missing or unreadable preset is open.
// No directory uses the working directory: a crash with no path still reads the project the hook ran in.
export function uncertaintyAllows(dirs: readonly string[]): boolean {
  const roots = dirs.length === 0 ? [process.cwd()] : dirs;
  return roots.every((dir) => typeof dir !== "string" || dir === "" || presetOpen(dir));
}

function presetOpen(start: string): boolean {
  let dir = start;
  const seen = new Set<string>();
  for (let n = 0; n < 40; n++) {
    if (seen.has(dir)) return true;
    seen.add(dir);
    const file = join(dir, ".pregate", "preset.json");
    if (existsSync(file)) {
      try {
        return uncertaintyOpen(readFileSync(file, "utf8"));
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "ENOENT" || code === "EACCES" || code === "EPERM" || code === "EISDIR") return true;
        throw error;
      }
    }
    if (existsSync(join(dir, ".git"))) return true;
    const parent = dirname(dir);
    if (parent === dir) return true;
    dir = parent;
  }
  return true;
}
