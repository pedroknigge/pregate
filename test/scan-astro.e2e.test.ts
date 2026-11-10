import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonical } from "../src/disk.ts";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled CLI, against a real directory, is the scan a repository gets.
// The compiled engine, built once for the test process: it is what ships, and it starts faster
// than the source entry on every platform.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-scan-astro-"));
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

function astroOf(stdout: string) {
  const body = JSON.parse(stdout) as { root: string; recommendations: { ns: string }[] };
  return { root: body.root, astro: body.recommendations.find((item) => item.ns === "astro") };
}

test("scan --json recommends astro for a small Astro project", () => {
  const result = scan("app", {
    "package.json": '{"name":"app","dependencies":{"astro":"^5.1.0"}}\n',
    "astro.config.mjs": "import { defineConfig } from \"astro/config\";\nexport default defineConfig({});\n",
    "src/content.config.ts": "export const collections = {};\n",
    "src/pages/index.astro": "---\nconst title = \"Home\";\n---\n<h1>{title}</h1>\n",
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  const { root, astro } = astroOf(result.stdout);
  expect(root).toBe(result.root);
  expect(astro).toMatchObject({
    ns: "astro",
    methodologies: ["astro/config", "astro/content", "astro/routing"],
    reasons: ["package.json declares astro"],
    scope: { include: ["**"], exclude: [] },
  });
}, 90_000);

test("scan --json does not recommend astro from docs, examples, fixtures, or config alone", () => {
  const peripheral = scan("peripheral", {
    "docs/site/package.json": '{"name":"docs","dependencies":{"astro":"^5.1.0"}}\n',
    "examples/blog/package.json": '{"name":"example","peerDependencies":{"astro":"^5.1.0"}}\n',
    "fixtures/app/package.json": '{"name":"fixture","dependencies":{"astro":"^5.1.0"}}\n',
    "docs/site/src/pages/index.astro": "<h1>Docs</h1>\n",
    "examples/blog/astro.config.mjs": "export default {};\n",
  });
  expect(peripheral.code, peripheral.stdout + peripheral.stderr).toBe(0);
  expect(astroOf(peripheral.stdout).astro).toBeUndefined();

  const configOnly = scan("config-only", {
    "package.json": '{"name":"tools","devDependencies":{"astro":"^5.1.0","eslint-plugin-astro":"1.0.0"}}\n',
    "astro.config.ts": "export default {};\n",
    "src/pages/index.astro": "<h1>Home</h1>\n",
  });
  expect(configOnly.code, configOnly.stdout + configOnly.stderr).toBe(0);
  expect(astroOf(configOnly.stdout).astro).toBeUndefined();

  const kept = scan("app-and-docs", {
    "package.json": '{"name":"app","dependencies":{"astro":"^5.1.0"}}\n',
    "src/pages/index.astro": "<h1>Home</h1>\n",
    "docs/package.json": '{"name":"docs","dependencies":{"astro":"^4.0.0"}}\n',
    "examples/starter/package.json": '{"name":"starter","dependencies":{"astro":"^5.1.0"}}\n',
    "fixtures/app/package.json": '{"name":"fixture","dependencies":{"astro":"^5.1.0"}}\n',
  });
  expect(kept.code, kept.stdout + kept.stderr).toBe(0);
  expect(astroOf(kept.stdout).astro).toMatchObject({
    ns: "astro",
    methodologies: ["astro/config", "astro/content", "astro/routing"],
    reasons: ["package.json declares astro"],
    scope: { include: ["**"], exclude: ["docs/**", "examples/starter/**", "fixtures/app/**"] },
  });
}, 180_000);
