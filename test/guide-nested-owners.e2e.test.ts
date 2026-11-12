import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonical } from "../src/disk.ts";
import { slash } from "../src/paths.ts";
import type { Proposal } from "../src/proposal.ts";
import type { Preset } from "../src/types.ts";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Compiled CLI on a real directory. packages/kit/test/apps/async is the SvelteKit layout that
// blocked guide --preview: the kit package owns svelte, the test app has its own package.json
// and svelte files, and a fixture package nested under that app owns @sveltejs/kit.
const binary = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-guide-nested-"));
afterAll(() => removeTree(area));

const kitFiles: Record<string, string> = {
  "package.json": '{"name":"kit-monorepo","private":true}\n',
  "packages/kit/package.json": '{"name":"@sveltejs/kit","peerDependencies":{"svelte":"^5.0.0"}}\n',
  "packages/kit/src/index.ts": "export const kit = 1;\n",
  "packages/kit/test/apps/async/package.json": '{"name":"test-async","devDependencies":{"svelte":"^5.0.0","@sveltejs/kit":"workspace:*"}}\n',
  "packages/kit/test/apps/async/src/routes/+page.svelte": "<h1>Async</h1>\n",
  "packages/kit/test/apps/async/_test_dependencies/remote-lib/package.json": '{"name":"e2e-test-dep-remote","peerDependencies":{"@sveltejs/kit":"*"}}\n',
  "packages/kit/test/apps/async/_test_dependencies/remote-lib/index.js": "export const remote = 1;\n",
  "packages/kit/test/apps/async/_test_dependencies/plain-lib/package.json": '{"name":"e2e-test-dep-plain"}\n',
};

function repo(name: string, files: Record<string, string>) {
  const root = canonical(join(area, name));
  const data = join(area, `${name}-data`);
  mkdirSync(root, { recursive: true });
  for (const [path, text] of Object.entries(files)) {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  const env = {
    ...process.env, CI: "1", HOME: join(area, `${name}-home`), XDG_DATA_HOME: data,
    XDG_STATE_HOME: join(area, `${name}-state`), XDG_CONFIG_HOME: join(area, `${name}-config`),
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  git("init", "-q");
  git("config", "user.name", "t");
  git("config", "user.email", "t@example.com");
  const run = (...args: string[]) => {
    const out = Bun.spawnSync([binary, ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 90_000 });
    return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString(), text: out.stdout.toString() + out.stderr.toString() };
  };
  const presetPath = join(root, ".pregate", "preset.json");
  const proposal = (): Proposal | undefined => {
    const dir = join(data, "pregate/proposals");
    if (!existsSync(dir)) return undefined;
    return readdirSync(dir).map(file => JSON.parse(readFileSync(join(dir, file), "utf8")) as Proposal).find(item => item.root === slash(root));
  };
  return { root, run, presetPath, proposal };
}

test("guide --preview succeeds for a SvelteKit monorepo with a nested owner under packages/kit/test/apps/async", () => {
  const project = repo("kit", kitFiles);
  const inspected = project.run("guide", "--json");
  expect(inspected.code, inspected.text).toBe(0);
  const view = JSON.parse(inspected.stdout) as { errors: string[]; recommendations: { ns: string; scopeProblems?: string[] }[] };
  expect(view.errors.join("\n")).not.toContain("Nested owners below");
  const svelte = view.recommendations.find(item => item.ns === "svelte");
  expect(svelte?.scopeProblems).toBeUndefined();
  const preview = project.run("guide", "--preview");
  expect(preview.code, preview.text).toBe(0);
  expect(preview.text).not.toContain("Nested owners below");
  expect(preview.text).not.toContain("was not reset");
  expect(preview.text).toContain("svelte");
  expect(existsSync(project.presetPath)).toBe(false);
  const pending = project.proposal();
  expect(pending).toBeDefined();
  const preset = JSON.parse(pending!.writes.find(write => write.path.endsWith(".pregate/preset.json"))!.after!) as Preset;
  expect(preset.sources.map(source => source.ns)).toContain("svelte");
  expect(preset.methodologies).toEqual(expect.arrayContaining(["svelte/runes", "svelte/stores"]));
  const scoped = Object.values(preset.overrides ?? {}).filter((override): override is Exclude<typeof override, string> => typeof override === "object" && Array.isArray(override.params?.within));
  expect(scoped.length).toBeGreaterThan(0);
  expect(scoped.every(override => (override.params!.within as string[]).includes("packages/kit/**"))).toBe(true);
  expect(scoped.every(override => ((override.params!.exclude as string[] | undefined) ?? []).every(glob => !glob.startsWith("packages/kit/test/")))).toBe(true);
}, 120_000);

test("guide --json reports nested-owner errors as JSON and a project with no contract is not told that a contract was reset", () => {
  const project = repo("ambiguous", {
    "package.json": '{"dependencies":{"react":"19"}}\n',
    "src/main.tsx": "export const main = 1;\n",
    "packages/foreign/package.json": "{}\n",
    "packages/foreign/src/App.tsx": "export const App = 1;\n",
    "packages/foreign/embedded/package.json": '{"dependencies":{"react":"19"}}\n',
    "packages/foreign/embedded/src/Widget.tsx": "export const Widget = 1;\n",
  });
  const inspected = project.run("guide", "--json");
  expect(inspected.code, inspected.text).toBe(1);
  const view = JSON.parse(inspected.stdout) as { errors: string[] };
  expect(view.errors.join("\n")).toContain("Nested owners below packages/foreign/");
  expect(view.errors.join("\n")).toContain("No automatic scope applied.");
  expect(view.errors.join("\n")).not.toContain("valid contract");
  expect(view.errors.join("\n")).not.toContain("was not reset");
  const preview = project.run("guide", "--preview");
  expect(preview.code, preview.text).toBe(1);
  expect(preview.text).toContain("Nested owners below packages/foreign/");
  expect(preview.text).toContain("No contract exists yet, so none was changed.");
  expect(preview.text).not.toContain("valid contract");
  expect(preview.text).not.toContain("was not reset");
  expect(existsSync(project.presetPath)).toBe(false);
  const omitted = project.run("guide", "--preview", "--packs", "none");
  expect(omitted.code, omitted.text).toBe(0);
  expect(omitted.text).not.toContain("Nested owners below");
  expect(existsSync(project.presetPath)).toBe(false);
}, 120_000);
