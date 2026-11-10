import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonical } from "../src/disk.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled CLI, against a real directory, is the scan a repository gets.
const cli = join(import.meta.dir, "../src/main.ts");
const area = mkdtempSync(join(tmpdir(), "pregate-scan-svelte-"));
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
  const out = Bun.spawnSync([process.execPath, cli, "scan", "--json"], {
    cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 60_000,
  });
  if (out.signalCode) throw new Error(`scan terminated: ${out.signalCode}\n${out.stderr.toString()}`);
  return { root, code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString() };
}

function svelteOf(stdout: string) {
  const body = JSON.parse(stdout) as { root: string; recommendations: { ns: string }[] };
  return { root: body.root, svelte: body.recommendations.find((item) => item.ns === "svelte") };
}

test("scan --json recommends svelte for a small Svelte project", () => {
  const result = scan("app", {
    "package.json": '{"name":"app","dependencies":{"svelte":"^5.0.0","@sveltejs/vite-plugin-svelte":"^4.0.0"}}\n',
    "svelte.config.js": "export default {};\n",
    "src/App.svelte": "<script>\n  let count = 0;\n</script>\n\n<button>{count}</button>\n",
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  const { root, svelte } = svelteOf(result.stdout);
  expect(root).toBe(result.root);
  expect(svelte).toMatchObject({
    ns: "svelte",
    methodologies: ["svelte/runes", "svelte/stores"],
    reasons: [
      "package.json declares svelte",
      "package.json declares @sveltejs/vite-plugin-svelte",
      ".svelte source detected",
      "svelte.config.js detected",
    ],
    scope: { include: ["**"], exclude: [] },
  });
}, 90_000);

test("scan --json does not recommend svelte from a docs or examples component alone", () => {
  const result = scan("docs-svelte", {
    "docs/App.svelte": "<h1>Docs</h1>\n",
    "examples/Widget.svelte": "<p>Example</p>\n",
    "packages/docs/svelte.config.js": "export default {};\n",
    "src/index.ts": "export const value = 1;\n",
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  expect(svelteOf(result.stdout).svelte).toBeUndefined();
}, 90_000);

test("scan --json recommends svelte for the Svelte repository itself", () => {
  const result = scan("svelte-repo", {
    "package.json": '{"name":"svelte-monorepo","devDependencies":{"svelte":"workspace:*"}}\n',
    "packages/svelte/package.json": '{"name":"svelte"}\n',
    "packages/svelte/src/main.svelte": "<h1>Hello</h1>\n",
  });
  expect(result.code, result.stdout + result.stderr).toBe(0);
  const { root, svelte } = svelteOf(result.stdout);
  expect(root).toBe(result.root);
  expect(svelte).toMatchObject({
    ns: "svelte",
    methodologies: ["svelte/runes", "svelte/stores"],
    reasons: ["packages/svelte/package.json is named svelte", ".svelte source detected"],
    scope: { include: ["packages/svelte/**"], exclude: [] },
  });
}, 90_000);
