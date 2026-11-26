import { expect, test } from "bun:test";
import { dependencyBelow, dependencySatisfies } from "../src/dependency-since.ts";
import type { Read } from "../src/types.ts";

const since = { dependencies: ["@prisma/client", "prisma"], version: "7.0.0" };
const manifest = (spec: string, field = "dependencies") => JSON.stringify({ [field]: { "@prisma/client": spec } });
const installed = (version: string) => JSON.stringify({ name: "@prisma/client", version });

function read(files: Record<string, string>): Read {
  return (rel) => files[rel] ?? null;
}

test("a Prisma 6 range stays quiet and a Prisma 7 range applies", () => {
  expect(dependencySatisfies(read({ "package.json": manifest("^6.19.0") }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({ "package.json": manifest("6.19.0") }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({ "package.json": manifest(">=6.0.0") }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({ "package.json": manifest("^7.0.0") }), "src/db.ts", since)).toBe(true);
  expect(dependencySatisfies(read({ "package.json": manifest("7.0.0", "devDependencies") }), "src/db.ts", since)).toBe(true);
  expect(dependencySatisfies(read({ "package.json": manifest("workspace:^7.0.0") }), "src/db.ts", since)).toBe(true);
  expect(dependencySatisfies(read({ "package.json": manifest("7.0.0-rc.1") }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({}), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({ "package.json": manifest("workspace:*") }), "src/db.ts", since)).toBe(false);
});

test("the installed client wins when the manifest does not prove an older release", () => {
  const files = {
    "package.json": manifest("^7.0.0"),
    "node_modules/@prisma/client/package.json": installed("6.19.0"),
  };
  expect(dependencySatisfies(read(files), "src/db.ts", since)).toBe(false);
  files["node_modules/@prisma/client/package.json"] = installed("7.0.0");
  expect(dependencySatisfies(read(files), "src/db.ts", since)).toBe(true);
  expect(dependencySatisfies(read({
    "package.json": manifest("workspace:*"),
    "node_modules/@prisma/client/package.json": installed("7.2.1"),
  }), "src/db.ts", since)).toBe(true);
});

test("a nested Prisma 6 package is not denied by a root Prisma 7 install", () => {
  const files = {
    "package.json": manifest("^7.0.0"),
    "node_modules/@prisma/client/package.json": installed("7.0.0"),
    "packages/legacy/package.json": manifest("^6.19.0"),
  };
  expect(dependencySatisfies(read(files), "packages/legacy/src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({
    "package.json": manifest("^6.19.0"),
    "packages/app/package.json": manifest("^7.0.0"),
  }), "packages/app/src/db.ts", since)).toBe(true);
});

const until = { dependencies: ["nuxt", "@nuxt/nitro-server"], version: "4.7.0" };
const nuxt = (spec: string, field = "dependencies") => JSON.stringify({ [field]: { nuxt: spec } });

test("a Nuxt pin below 4.7.0 applies and a pin at 4.7.0 stays quiet", () => {
  const below = (spec: string) => dependencyBelow(read({ "package.json": nuxt(spec) }), "nuxt.config.ts", until);
  expect(below("4.6.4")).toBe(true);
  expect(below("^4.6.0")).toBe(true);
  expect(below("3.16.2")).toBe(true);
  expect(below("^3.13.0")).toBe(true);
  expect(below(">=4.0.0")).toBe(true);
  expect(below("<4.7.0")).toBe(true);
  expect(below("4.6.4 || 4.8.0")).toBe(true);
  expect(below("4.7.0")).toBe(false);
  expect(below("^4.7.0")).toBe(false);
  expect(below(">=4.7.0")).toBe(false);
  expect(below("4.7.0 || 4.8.0")).toBe(false);
  expect(below("latest")).toBe(false);
  expect(below("*")).toBe(false);
  expect(dependencyBelow(read({}), "nuxt.config.ts", until)).toBe(false);
  expect(dependencyBelow(read({ "package.json": nuxt("4.6.4", "devDependencies") }), "nuxt.config.ts", until)).toBe(true);
});

test("an older install counts when the range does not, and the first package with evidence decides", () => {
  expect(dependencyBelow(read({
    "package.json": nuxt("^4.7.0"),
    "node_modules/nuxt/package.json": JSON.stringify({ name: "nuxt", version: "4.6.4" }),
  }), "nuxt.config.ts", until)).toBe(true);
  expect(dependencyBelow(read({
    "package.json": JSON.stringify({ dependencies: { nuxt: "4.7.0", "@nuxt/nitro-server": "4.6.0" } }),
  }), "nuxt.config.ts", until)).toBe(false);
  expect(dependencyBelow(read({
    "package.json": JSON.stringify({ dependencies: { "@nuxt/nitro-server": "4.6.0" } }),
  }), "nuxt.config.ts", until)).toBe(true);
  expect(dependencyBelow(read({
    "package.json": nuxt("workspace:*"),
    "node_modules/nuxt/package.json": JSON.stringify({ name: "nuxt", version: "4.6.4" }),
  }), "nuxt.config.ts", until)).toBe(true);
});

test("the client package decides before the prisma CLI package", () => {
  expect(dependencySatisfies(read({
    "package.json": JSON.stringify({ dependencies: { "@prisma/client": "^6.19.0" }, devDependencies: { prisma: "^7.0.0" } }),
  }), "src/db.ts", since)).toBe(false);
  expect(dependencySatisfies(read({
    "package.json": JSON.stringify({ devDependencies: { prisma: "^7.0.0" } }),
  }), "src/db.ts", since)).toBe(true);
});
