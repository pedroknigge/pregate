import { spyOn } from "bun:test";
import * as fs from "node:fs";

// Spawned by demo.test.ts. Installs the denial before the demo module binds fs, then runs one demo.
const fold = (path: string) => process.platform === "win32" ? path.replaceAll("\\", "/").toLowerCase() : path;
const denied = new Map<string, "EACCES" | "EPERM">();
if (process.env.BLOCKED_PYTHON) denied.set(fold(process.env.BLOCKED_PYTHON), "EACCES");
if (process.env.BLOCKED_GO) denied.set(fold(process.env.BLOCKED_GO), "EPERM");

function reject(path: fs.PathLike): void {
  const code = denied.get(fold(String(path)));
  if (code !== undefined) throw Object.assign(new Error(`${code}: permission denied, stat '${path}'`), { code });
}

// The planted candidates are ordinary files, so stat succeeds and realpath is what fails,
// which is the stack the Store alias produces. A real alias still fails in stat itself.
const realpath = fs.realpathSync;
spyOn(fs, "realpathSync").mockImplementation(((path: fs.PathLike, options?: Parameters<typeof realpath>[1]) => {
  reject(path);
  return options === undefined ? realpath(path) : realpath(path, options);
}) as typeof fs.realpathSync);

const binary = process.env.DEMO_BINARY;
if (binary === undefined || binary === "") throw new Error("DEMO_BINARY is required");
const { demo } = await import("../src/demo-command.ts");
const result = await demo(["--json"], binary);
console.log(result.text);
process.exit(result.code);
