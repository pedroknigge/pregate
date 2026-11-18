import { expect, test } from "bun:test";
import { dependencyPinLine } from "../src/package-version.ts";

const pin = { package: "mongodb", introduced: "6.7.0", fixed: "7.9.0" };

function line(rel: string, text: string): number | null {
  return dependencyPinLine(rel, text, pin);
}

test("manifest ranges inside the CVE window warn, and the edges do not", () => {
  const manifest = (spec: string) => `{\n  "dependencies": {\n    "mongodb": "${spec}"\n  }\n}\n`;
  expect(line("package.json", manifest("6.7.0"))).toBe(3);
  expect(line("package.json", manifest("7.8.1"))).toBe(3);
  expect(line("package.json", manifest("7.9.0"))).toBeNull();
  expect(line("package.json", manifest("^7.8.0"))).toBe(3);
  expect(line("package.json", manifest("^6.0.0"))).toBe(3);
  expect(line("package.json", manifest("^5.9.0"))).toBeNull();
  expect(line("package.json", manifest(">=6.7.0 <7.9.0"))).toBe(3);
  expect(line("package.json", manifest(">=7.9.0"))).toBeNull();
  expect(line("package.json", manifest("7.8.1 || 7.9.0"))).toBe(3);
  expect(line("package.json", manifest("*"))).toBeNull();
  expect(line("package.json", manifest("latest"))).toBeNull();
  expect(line("package.json", manifest("workspace:*"))).toBeNull();
  expect(line("package.json", manifest("git+https://example.com/mongodb.git"))).toBeNull();
  expect(line("package.json", manifest("workspace:^7.8.0"))).toBe(3);
  const optional = `{\n  "optionalDependencies": {\n    "mongodb": "6.7.0"\n  }\n}\n`;
  expect(line("apps/api/package.json", optional)).toBe(3);
  expect(line("node_modules/app/package.json", manifest("7.8.1"))).toBeNull();
  expect(line("package.json", `{\n  "dependencies": {\n    "mongodb-memory-server": "7.8.1"\n  }\n}\n`)).toBeNull();
});

test("lockfiles warn on a resolved version inside the window", () => {
  const pnpm = "mongodb@7.8.1:\n  resolution: {integrity: sha}\n\nmongodb-memory-server@10.1.4:\n  resolution: {integrity: sha}\n";
  expect(line("pnpm-lock.yaml", pnpm)).toBe(1);
  expect(line("pnpm-lock.yaml", "mongodb@7.9.0:\n  resolution: {integrity: sha}\n")).toBeNull();
  const importer = "importers:\n  .:\n    dependencies:\n      mongodb:\n        specifier: ^7.8.0\n        version: 7.8.1\n";
  expect(line("pnpm-lock.yaml", importer)).toBe(6);
  const bun = `{\n  "packages": {\n    "mongodb": ["mongodb@7.8.1", {}]\n  }\n}\n`;
  expect(line("bun.lock", bun)).toBe(3);
  expect(line("bun.lock", `{\n  "packages": {\n    "mongodb": ["mongodb@7.9.0", {}]\n  }\n}\n`)).toBeNull();
  const shrink = `{\n  "dependencies": {\n    "mongodb": {\n      "version": "6.7.0"\n    }\n  }\n}\n`;
  expect(line("npm-shrinkwrap.json", shrink)).toBe(4);
  expect(line("src/app.ts", `{"dependencies":{"mongodb":"7.8.1"}}`)).toBeNull();
});
