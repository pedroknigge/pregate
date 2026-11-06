import { win32 } from "node:path";

// App Execution Aliases live directly in `%LOCALAPPDATA%\Microsoft\WindowsApps`.
// `stat` on those stubs raises EACCES, and launching one exits 49. A real Store
// package sits in a subdirectory and is not one of these stubs.
const WINDOWS_APPS = /(?:^|[/\\])microsoft[/\\]windowsapps(?:[/\\][^/\\]+)?[/\\]?$/i;

export function isWindowsAppsAlias(path: string): boolean {
  return WINDOWS_APPS.test(path);
}

// `git --exec-path` is `<install>/mingw64/libexec/git-core`. Git for Windows
// keeps sh.exe in `<install>/usr/bin` and `<install>/bin`, not on PATH.
export function gitShCandidates(execPath: string): string[] {
  const trimmed = execPath.trim();
  if (trimmed === "") return [];
  const root = win32.resolve(trimmed, "..", "..", "..");
  const mingw = win32.resolve(trimmed, "..", "..");
  return [
    win32.join(root, "usr", "bin", "sh.exe"),
    win32.join(root, "bin", "sh.exe"),
    win32.join(mingw, "bin", "sh.exe"),
  ];
}

export function posixShell(options: {
  platform: string;
  execPath: string | null;
  exists: (path: string) => boolean;
  onPath: () => string | null;
}): string | null {
  if (options.platform !== "win32") return "sh";
  if (options.execPath !== null) {
    for (const candidate of gitShCandidates(options.execPath)) {
      if (options.exists(candidate)) return candidate;
    }
  }
  const found = options.onPath();
  if (found !== null && !isWindowsAppsAlias(found)) return found;
  return null;
}

export function pathWithoutWindowsApps(pathValue: string, pathDelimiter: string): string {
  return pathValue.split(pathDelimiter).filter((dir) => dir !== "" && !isWindowsAppsAlias(dir)).join(pathDelimiter);
}

// Windows: `py -3`, then `python`, then `python3`, skipping Store alias stubs.
// Other platforms keep the `python3` the inspection test already runs.
export function pythonCommand(platform: string, lookup: (name: string) => string | null): readonly string[] | null {
  if (platform !== "win32") return ["python3"];
  for (const command of [["py", "-3"], ["python"], ["python3"]] as const) {
    const found = lookup(command[0]);
    if (found === null || isWindowsAppsAlias(found)) continue;
    return command;
  }
  return null;
}

// Windows keeps the first spelling of an environment variable, and which spelling
// that is depends on the other names in the block. `{ ...process.env, PATH }`
// therefore still carries `Path`. One spelling is the fixture directory.
export function isolatedPathEnv(base: NodeJS.ProcessEnv, bin: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined || key.toUpperCase() === "PATH") continue;
    env[key] = value;
  }
  env.PATH = bin;
  return env;
}
