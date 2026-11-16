import { expect, test } from "bun:test";
import { join } from "node:path";

test(".env files are ignored and .env.example stays visible", () => {
  const root = join(import.meta.dir, "..");
  const ignored = (path: string) => Bun.spawnSync(["git", "check-ignore", "-q", "--", path], { cwd: root }).exitCode;
  expect(ignored(".env")).toBe(0);
  expect(ignored(".env.local")).toBe(0);
  expect(ignored(".env.example")).toBe(1);
});
