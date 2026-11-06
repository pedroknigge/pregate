import { expect, test } from "bun:test";
import { win32 } from "node:path";
import { gitShCandidates, isWindowsAppsAlias, isolatedPathEnv, pathWithoutWindowsApps, posixShell, pythonCommand } from "./host-command.ts";

const ALIAS = "C:\\Users\\a\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe";
const REAL = "C:\\Python314\\python.exe";
const PY = "C:\\Windows\\py.exe";
const EXEC = "C:/Program Files/Git/mingw64/libexec/git-core";
const SH = "C:\\Program Files\\Git\\usr\\bin\\sh.exe";

test("Git for Windows sh.exe is next to the install root, not on PATH", () => {
  const root = win32.resolve(EXEC, "..", "..", "..");
  const mingw = win32.resolve(EXEC, "..", "..");
  expect(gitShCandidates(`${EXEC}\n`)).toEqual([
    win32.join(root, "usr", "bin", "sh.exe"),
    win32.join(root, "bin", "sh.exe"),
    win32.join(mingw, "bin", "sh.exe"),
  ]);
  expect(gitShCandidates("  ")).toEqual([]);
  expect(gitShCandidates("C:\\Program Files\\Git\\mingw64\\libexec\\git-core")).toEqual(gitShCandidates(EXEC));
});

test("win32 prefers sh.exe from git --exec-path, then PATH, and skips when neither exists", () => {
  expect(posixShell({ platform: "win32", execPath: EXEC, exists: (path) => path === SH, onPath: () => "D:\\tools\\sh.exe" })).toBe(SH);
  expect(posixShell({ platform: "win32", execPath: EXEC, exists: () => false, onPath: () => "D:\\tools\\sh.exe" })).toBe("D:\\tools\\sh.exe");
  expect(posixShell({ platform: "win32", execPath: null, exists: () => false, onPath: () => ALIAS })).toBeNull();
  expect(posixShell({ platform: "win32", execPath: "  ", exists: () => false, onPath: () => null })).toBeNull();
  expect(posixShell({ platform: "linux", execPath: null, exists: () => false, onPath: () => { throw new Error("unused"); } })).toBe("sh");
});

test("a WindowsApps alias is the stub directly in that directory", () => {
  expect(isWindowsAppsAlias(ALIAS)).toBe(true);
  expect(isWindowsAppsAlias("C:/Users/a/AppData/Local/Microsoft/WindowsApps/python.exe")).toBe(true);
  expect(isWindowsAppsAlias("C:\\Users\\a\\AppData\\Local\\Microsoft\\WindowsApps")).toBe(true);
  expect(isWindowsAppsAlias("C:\\Users\\a\\AppData\\Local\\Microsoft\\WindowsApps\\")).toBe(true);
  expect(isWindowsAppsAlias(REAL)).toBe(false);
  expect(isWindowsAppsAlias(PY)).toBe(false);
  expect(isWindowsAppsAlias("C:\\Program Files\\WindowsApps\\PythonSoftwareFoundation.Python.3.14_x\\python.exe")).toBe(false);
  expect(isWindowsAppsAlias("C:\\Users\\a\\AppData\\Local\\Microsoft\\WindowsApps\\PythonSoftwareFoundation.Python.3.14_x\\python.exe")).toBe(false);
});

test("Windows Python resolution tries py -3, then python, then python3, and skips aliases", () => {
  const lookup = (found: Record<string, string | null>) => (name: string) => found[name] ?? null;
  expect(pythonCommand("linux", () => { throw new Error("unused"); })).toEqual(["python3"]);
  expect(pythonCommand("win32", lookup({ py: PY, python: REAL, python3: ALIAS }))).toEqual(["py", "-3"]);
  expect(pythonCommand("win32", lookup({ py: null, python: REAL, python3: ALIAS }))).toEqual(["python"]);
  expect(pythonCommand("win32", lookup({ py: ALIAS, python: ALIAS, python3: "D:\\py\\python3.exe" }))).toEqual(["python3"]);
  expect(pythonCommand("win32", lookup({ py: ALIAS, python: ALIAS, python3: ALIAS }))).toBeNull();
  expect(pythonCommand("win32", () => null)).toBeNull();
  expect(pathWithoutWindowsApps(`C:\\Python314;${"C:\\Users\\a\\AppData\\Local\\Microsoft\\WindowsApps"};C:\\Windows\\System32`, ";"))
    .toBe("C:\\Python314;C:\\Windows\\System32");
});

test("a Windows environment keeps one PATH spelling pointed at the fixture", () => {
  const env = isolatedPathEnv({
    Path: "C:\\Windows\\System32;C:\\Program Files\\Git\\cmd",
    PATH: "C:\\also-system",
    path: "C:\\lower",
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
    SystemRoot: "C:\\Windows",
    EMPTY: undefined,
  }, "C:\\fixture\\bin");
  expect(env.PATH).toBe("C:\\fixture\\bin");
  expect(env.Path).toBeUndefined();
  expect(Object.keys(env).filter((key) => key.toUpperCase() === "PATH")).toEqual(["PATH"]);
  expect(env.PATHEXT).toBe(".COM;.EXE;.BAT;.CMD");
  expect(env.SystemRoot).toBe("C:\\Windows");
  expect(env.EMPTY).toBeUndefined();
  expect(isolatedPathEnv({ PATH: "/usr/bin", HOME: "/tmp" }, "/fixture/bin")).toEqual({ HOME: "/tmp", PATH: "/fixture/bin" });
});
