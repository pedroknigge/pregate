import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonical } from "../src/disk.ts";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled CLI, against a real directory, is the scan a repository gets.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-scan-vue-"));
afterAll(() => removeTree(area));

function scan(name: string, files: Record<string, string>) {
  const root = canonical(join(area, name));
  mkdirSync(root, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  const env = { ...process.env, CI: "1" };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  git("init", "-q");
  git("add", "-A");
  const out = Bun.spawnSync([cli, "scan", "--json"], {
    cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  if (out.signalCode) throw new Error(`scan terminated: ${out.signalCode}\n${out.stderr.toString()}`);
  return { root, code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString() };
}

function packOf(stdout: string, ns: string) {
  const body = JSON.parse(stdout) as { root: string; recommendations: { ns: string }[] };
  return { root: body.root, pack: body.recommendations.find((item) => item.ns === ns) };
}

test("scan --json recommends vue when vue is only a devDependency", () => {
  const result = scan("vue-dev", {
    "package.json": '{"name":"uptime","dependencies":{"express":"^4.21.0"},"devDependencies":{"vue":"^3.5.13"}}\n',
    "server/server.js": "import express from \"express\";\nexport const app = express();\n",
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  const { root, pack: vue } = packOf(result.stdout, "vue");
  expect(root).toBe(result.root);
  expect(vue).toMatchObject({
    ns: "vue",
    methodologies: ["vue/reactivity", "vue/sfc"],
    reasons: ["package.json declares vue"],
    scope: { include: ["**"], exclude: [] },
  });
  expect(packOf(result.stdout, "express").pack).toMatchObject({
    reasons: ["package.json declares express"],
  });
}, 90_000);

test("scan --json recommends vue from a .vue file outside docs, examples, and fixtures", () => {
  const result = scan("vue-file", {
    "package.json": '{"name":"web","dependencies":{"express":"^4.21.0"}}\n',
    "src/App.vue": "<template><p>Hi</p></template>\n<script setup lang=\"ts\">\nconst title = \"Hi\";\n</script>\n",
    "docs/Guide.vue": "<template><p>Docs</p></template>\n",
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  expect(packOf(result.stdout, "vue").pack).toMatchObject({
    ns: "vue",
    methodologies: ["vue/reactivity", "vue/sfc"],
    reasons: [".vue source detected"],
  });

  const peripheral = scan("vue-peripheral", {
    "package.json": '{"name":"api","dependencies":{"express":"^4.21.0"}}\n',
    "docs/Guide.vue": "<template><p>Docs</p></template>\n",
    "examples/Widget.vue": "<template><p>Example</p></template>\n",
    "fixtures/One.vue": "<template><p>Fixture</p></template>\n",
    "packages/docs/package.json": '{"devDependencies":{"vue":"^3.5.13"}}\n',
    "server/server.js": "export const ready = true;\n",
  });
  expect(peripheral.code, peripheral.stdout + peripheral.stderr).toBe(0);
  expect(packOf(peripheral.stdout, "vue").pack).toBeUndefined();
}, 120_000);

test("scan --json does not recommend vue for a repository with no vue", () => {
  const result = scan("no-vue", {
    "package.json": '{"name":"api","dependencies":{"express":"^4.21.0","vue-router":"^4.5.0","eslint-plugin-vue":"^9.0.0"}}\n',
    "server/server.js": "export const ready = true;\n",
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  expect(packOf(result.stdout, "vue").pack).toBeUndefined();
  expect(packOf(result.stdout, "express").pack).toMatchObject({
    reasons: ["package.json declares express"],
  });
}, 90_000);

test("scan --json recommends react when react is only a devDependency", () => {
  const result = scan("react-dev", {
    "package.json": '{"name":"web","dependencies":{"express":"^4.21.0"},"devDependencies":{"react":"^19.0.0","react-dom":"^19.0.0"}}\n',
    "server/server.js": "export const ready = true;\n",
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  expect(packOf(result.stdout, "react").pack).toMatchObject({
    ns: "react",
    methodologies: ["react/components", "react/hooks"],
    reasons: ["package.json declares react"],
    scope: { include: ["**"], exclude: [] },
  });
  expect(packOf(result.stdout, "vue").pack).toBeUndefined();
}, 90_000);
