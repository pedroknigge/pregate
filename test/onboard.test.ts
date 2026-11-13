import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { deadGlobLines, deriveLayers, layerEvidence, layerEvidenceLines, detectedScope, detectLayers, detectStack, emptyLayerLines, initialScope, onboardingCard, onboardingPreset, scopeCoverage } from "../src/onboard.ts";
import type { Files } from "../src/types.ts";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { repoFiles } from "../src/init.ts";
import { librarySources } from "../src/library.ts";
import { policyFixtureSource } from "./policy-fixtures.ts";
import { hookCommand } from "../src/register.ts";
import pkg from "../package.json" with { type: "json" };
import { readProposal } from "../src/proposal.ts";
import { sha256 } from "../src/state.ts";
import { canonical } from "../src/disk.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { removeReleased, removeTree } from "./remove-tree.ts";

// The scenarios isolate project/home state; they can share the unchanged executable.
// Each case spawns the compiled engine several times; on Windows a spawn costs 0.3-1 s.
setDefaultTimeout(60_000);
const executable = mkdtempSync(join(tmpdir(), "pregate-onboard-engine-"));
const binary = join(executable, ENGINE_FILE);
// Compiling the engine takes longer than bun's 5 s hook default on Windows runners.
beforeAll(() => engineAt(binary, true), 120_000);
afterAll(() => removeTree(executable));

const files: Files = {
  "package.json": '{"dependencies":{"express":"5.0.0"}}',
  "tsconfig.json": '{"compilerOptions":{"strict":true}}',
  "src/domain/a.ts": "export const value = Date.now();",
  "src/application/a.ts": 'import { value } from "../domain/a"; export const a = value;',
  "test/a.test.ts": 'test.only("focused", () => {});',
};

test("onboarding detects real stack, layers and resolved import edges deterministically", async () => {
  await grammars();
  const detected = detectStack(files);
  expect(detected.recommended).toBe("backend-clean-ddd");
  expect(detected.frameworks).toEqual(["express"]);
  expect(detected.edges[0]).toContain("application → domain");
  expect(detectStack(Object.fromEntries(Object.entries(files).reverse()))).toEqual(detected);
  expect(detectStack({ "src/core/a.ts": "export const a = 1;" }).recommended).toBe("functional-ts");
  expect(detectStack({ "app.py": "print(1)" }).recommended).toBe("python-starter");
  const preset = onboardingPreset(detected.recommended, BUILTIN, VERSIONS)!;
  const compiled = compile(JSON.stringify(preset), policyFixtureSource, VERSIONS);
  expect(compiled).not.toHaveProperty("errors");
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  expect(onboardingCard(detected, compiled.lock, files, clock)).toContain("Example from your repo: test/a.test.ts:1:");
  expect(preset.enforcement).toBe("shadow");
});

test("framework detection ignores devDependencies except vue and react", () => {
  expect(detectStack({ "package.json": '{"devDependencies":{"express":"5.0.0"}}' }).frameworks).toEqual([]);
  expect(detectStack({ "package.json": '{"peerDependencies":{"react":"19.0.0"}}' }).frameworks).toEqual(["react"]);
  expect(detectStack({ "package.json": '{"dependencies":{"express":"5.0.0"},"devDependencies":{"vue":"^3.5.0","react":"19.0.0"}}' }).frameworks).toEqual(["react", "vue", "express"]);
  expect(detectStack({ "package.json": '{"devDependencies":{"svelte":"^5","next":"15.0.0","astro":"^5","hono":"^4","@nestjs/core":"10"}}' }).frameworks).toEqual([]);
  expect(detectStack({ "src/App.vue": "" }).frameworks).toEqual([]);
});

test("layer detection derives a reviewable map from conventional folders under any source root", () => {
  const files: Files = { "source/domain/order.ts": "", "source/infra/db.ts": "", "source/app/x.ts": "", "test/fixtures/domain/y.ts": "" };
  const layers = detectLayers(files);
  expect(layers).toEqual({ app: { paths: ["source/app/**"], mayImport: ["domain"], kind: "core" },
    domain: { paths: ["source/domain/**"], mayImport: [], kind: "core" },
    infra: { paths: ["source/infra/**"], mayImport: ["app", "domain"], kind: "adapter" } });
  expect(detectLayers(Object.fromEntries(Object.entries(files).reverse()))).toEqual(layers);
  expect(detectLayers({ "app/page.tsx": "", "app/infra/x.ts": "" })).toEqual({});
  expect(detectLayers({ "src/application/ports/p.ts": "", "src/application/use.ts": "" })).toEqual({
    application: { paths: ["src/application/**"], mayImport: ["ports"], kind: "core" },
    ports: { paths: ["src/application/ports/**"], mayImport: [], kind: "port" } });
  expect(detectLayers({ "packages/a/src/domain/x.ts": "", "packages/b/src/domain/y.ts": "" }).domain!.paths).toEqual(["packages/a/src/domain/**", "packages/b/src/domain/**"]);
});

test("a folder named core whose own code imports unlayered siblings is not proposed; an adapter that does is relaxed", async () => {
  await grammars();
  const library: Files = { "source/core/Ky.ts": 'import { merge } from "../utils/merge.ts";\nexport const ky = merge;\n', "source/utils/merge.ts": "export const merge = 1;\n" };
  expect(deriveLayers(library)).toEqual({ layers: {},
    notes: ["Layer core (source/core) not proposed: source/core/Ky.ts imports source/utils/merge.ts, which is outside every layer."] });
  expect(detectStack(library).recommended).toBe("legacy-safe");
  const layered: Files = { "src/domain/order.ts": 'import { db } from "../infra/db.ts";\nexport const order = db;\n',
    "src/infra/db.ts": 'import { url } from "../config.ts";\nexport const db = url;\n', "src/config.ts": "export const url = 1;\n" };
  const derived = deriveLayers(layered);
  expect(derived.layers).toEqual({ domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
    infra: { paths: ["src/infra/**"], mayImport: ["*"], kind: "adapter" } });
  expect(derived.notes).toEqual(["Layer infra may import any code: src/infra/db.ts imports src/config.ts, which is outside every layer."]);
});

test("an app folder that imports a web framework is an adapter, not core, and no other adapter may import it", () => {
  const files: Files = { "src/domain/order.ts": "", "src/infra/db.ts": 'import pg from "pg";\n',
    "src/app/server.ts": 'import express from "express";\nimport { Order } from "../domain/order";\n' };
  expect(detectLayers(files)).toEqual({ app: { paths: ["src/app/**"], mayImport: ["domain"], kind: "adapter" },
    domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
    infra: { paths: ["src/infra/**"], mayImport: ["domain"], kind: "adapter" } });
  expect(detectLayers({ ...files, "src/app/server.ts": "from fastapi import FastAPI\n" }).app!.kind).toBe("adapter");
  expect(detectLayers({ ...files, "src/app/server.ts": 'import { x } from "express-validator";\n' }).app!.kind).toBe("core");
});

test("a new project's scope drops recipe folders that do not exist and keeps the recipe when nothing matches", () => {
  const scope = { include: ["src/**", "lib/**", "test/**"], exclude: ["src/**/generated/**"] };
  expect(initialScope({ "src/a.ts": "", "test/a.test.ts": "", "tools/x.ts": "" }, scope))
    .toEqual({ include: ["src/**", "test/**", "tools/**"], exclude: ["src/**/generated/**"] });
  expect(initialScope({}, scope)).toEqual(scope);
});

test("empty layer globs are named once and matching ones are not", () => {
  const layers = { core: { paths: ["src/core/**"], mayImport: [], kind: "core" as const } };
  expect(emptyLayerLines(layers, ["source/core/a.ts"])).toEqual(["Layer paths matching no files: core (src/core/**). Layer rules check nothing there; adjust the paths."]);
  expect(emptyLayerLines(layers, ["src/core/a.ts"])).toEqual([]);
  expect(emptyLayerLines(undefined, [])).toEqual([]);
});

test("preset globs dead only because [ ] { } read as syntax are named once with their escaped form (#66)", () => {
  const files = ["src/app/[view]/page.tsx", "src/app/[[...rest]]/page.tsx", "src/a.ts"];
  const preset = { name: "p", version: "1.0.0", engine: "0", sources: [], methodologies: [],
    scope: { include: ["src/**", "lib/**"], exclude: ["src/app/[view]/**"] },
    overrides: { "core/x": { params: { paths: ["src/app/[[...rest]]/*.tsx", "@domain"], exclude: ["src/[ab].ts"] } }, "core/y": "off" as const } };
  const line = deadGlobLines(preset, () => files);
  expect(line).toEqual(['Globs matching no project file: src/app/[view]/** (in JSON: "src/app/\\\\[view\\\\]/**"), src/app/[[...rest]]/*.tsx (in JSON: "src/app/\\\\[\\\\[...rest\\\\]\\\\]/*.tsx"). [ ] { } are glob syntax; escape them as shown or use the exact path.']);
  // The suggestion pastes into preset or request JSON as-is.
  expect(JSON.parse(line[0]!.match(/in JSON: ("[^"]+")/)![1]!)).toBe("src/app/\\[view\\]/**");
  let inventoried = false;
  expect(deadGlobLines({ ...preset, scope: { include: ["src/**"] }, overrides: {} }, () => { inventoried = true; return files; })).toEqual([]);
  expect(inventoried).toBe(false);
  expect(deadGlobLines({ ...preset, scope: { exclude: ["src/app/\\[view\\]/**", "src/app/[[...rest]]/page.tsx"] }, overrides: {} }, () => files)).toEqual([]);
  // Brackets are escaped alone first, so a working {ts,tsx} alternation stays syntax.
  const braces = { ...preset, scope: { exclude: ["src/app/[view]/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"] },
    overrides: { "core/x": { params: { exclude: ["src/app/[[...rest]]/*.{ts,tsx}"] } }, "core/y": null as never } };
  expect(deadGlobLines(braces, () => files)).toEqual(['Globs matching no project file: src/app/[view]/**/*.{ts,tsx} (in JSON: "src/app/\\\\[view\\\\]/**/*.{ts,tsx}"), src/app/[[...rest]]/*.{ts,tsx} (in JSON: "src/app/\\\\[\\\\[...rest\\\\]\\\\]/*.{ts,tsx}"). [ ] { } are glob syntax; escape them as shown or use the exact path.']);
  expect(deadGlobLines({ ...preset, scope: { exclude: ["src/{x}/**"] }, overrides: {} }, () => ["src/{x}/a.ts"])[0]).toContain('(in JSON: "src/\\\\{x\\\\}/**")');
  // A listing failure drops the check with a note instead of failing the review.
  expect(deadGlobLines(preset, () => null)).toEqual(["Glob check skipped: project files could not be listed."]);
});

test("a recipe whose layers match no files is rebased onto the detected folders before review", () => inPreviewProject(({ root, cli, env }) => {
  rmSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "source/core"), { recursive: true });
  writeFileSync(join(root, "source/core/a.ts"), "export const a = 1;\n");
  const preview = cli(root, "init", "--preview", "--preset", "functional-ts");
  expect(preview.exitCode, preview.stderr.toString()).toBe(0);
  expect(preview.stdout.toString()).not.toContain("matching no files");
  const proposal = readProposal(canonical(root), join(env.XDG_DATA_HOME, "pregate"))!;
  const preset = JSON.parse(proposal.writes.find(write => write.path.endsWith("preset.json"))!.after!);
  expect(preset.layers).toEqual({ core: { paths: ["source/core/**"], mayImport: [], kind: "core" } });
}));

test("source-root detection covers root Next.js and monorepo layouts while preserving exclusions", () => {
  const files = { "lib/orders.ts": "", "app/page.tsx": "", "components/order.tsx": "", "tests/order.test.ts": "",
    "scripts/seed.ts": "", "e2e/order.spec.ts": "", "proxy.ts": "", "packages/shop/src/order.ts": "", "app/generated/api.ts": "", "README.md": "" };
  const original = { include: ["src/**", "lib/**", "test/**"], exclude: ["app/generated/**"] };
  const next = detectedScope(files, original);
  expect(original.include).toEqual(["src/**", "lib/**", "test/**"]);
  expect(next.include).toEqual(["src/**", "lib/**", "test/**", "app/**", "components/**", "e2e/**", "packages/**", "proxy.ts", "scripts/**", "tests/**"]);
  expect(next.exclude).toEqual(original.exclude);
  expect(scopeCoverage(files, original)).toMatchObject({ inventoried: 9, inScope: 1 });
  expect(scopeCoverage(files, next)).toMatchObject({ inventoried: 9, inScope: 8, outsideScope: [], excluded: ["app/generated/api.ts"] });
  expect(detectedScope(Object.fromEntries(Object.entries(files).reverse()), original)).toEqual(next);
  expect(scopeCoverage(files, undefined).inScope).toBe(9);
});

test("scope coverage reports unsupported bodies and advisory roles without removing code", () => {
  const files = { "src/main.ts": "", "src/Legacy.rb": "", "examples/demo.tsx": "", "examples/demo.swift": "",
    "tests/main.test.ts": "", "test/fixtures/input.ts": "", "vendor/client.ts": "" };
  const coverage = scopeCoverage(files, { include: ["**"], exclude: ["vendor/**"] });
  expect(coverage).toMatchObject({ inventoried: 5, sourceLikeInventoried: 7, inScope: 4,
    unsupported: ["examples/demo.swift", "src/Legacy.rb"], outsideScope: [], excluded: ["vendor/client.ts"] });
  expect(coverage.roles.find(role => role.role === "production-candidate")).toMatchObject({ parserSupported: 1, inScope: 1, unsupported: 1 });
  expect(coverage.roles.find(role => role.role === "fixtures")).toMatchObject({ parserSupported: 1, inScope: 1 });
  expect(coverage.roles.find(role => role.role === "examples")).toMatchObject({ parserSupported: 1, unsupported: 1 });
  expect(detectedScope(files, { include: ["**"], exclude: ["vendor/**"] })).toEqual({ include: ["**"], exclude: ["vendor/**"] });
});

test("initial preview includes detected root-layout source before human approval", () => inPreviewProject(({ root, cli, env }) => {
  rmSync(join(root, "src"), { recursive: true });
  const paths = ["app/page.tsx", "components/order.tsx", "lib/order.ts", "tests/order.test.ts", "scripts/seed.ts", "e2e/order.spec.ts", "proxy.ts"];
  for (const path of paths) {
    mkdirSync(join(root, path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "."), { recursive: true });
    writeFileSync(join(root, path), "export const value = 1;\n");
  }
  const preview = cli(root, "init", "--preview", "--preset", "legacy-safe");
  expect(preview.exitCode, preview.stderr.toString()).toBe(0);
  expect(preview.stdout.toString()).toContain("7/7 parser-supported source files are in scope");
  expect(preview.stdout.toString()).toContain("Project unchanged");
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
  const proposal = readProposal(canonical(root), join(env.XDG_DATA_HOME, "pregate"))!;
  // The recipe's src/** and test/** match no file here, so only its lib/** and the detected roots remain.
  expect(JSON.parse(proposal.lockText).scope.include).toEqual(["lib/**", "app/**", "components/**", "e2e/**", "proxy.ts", "scripts/**", "tests/**"]);
}));

test("init refuses piped approval and broken Git without writing a contract", () => inTempDir("pregate-init-", (dir) => {
  const root = join(dir, "repo");
  mkdirSync(root);
  writeFileSync(join(root, "a.ts"), "export const a = 1;\n");
  expect(Bun.spawnSync(["git", "init", "-q", root]).exitCode).toBe(0);
  const env = { ...process.env, HOME: join(dir, "home"), XDG_DATA_HOME: join(dir, "data"), XDG_STATE_HOME: join(dir, "state"),
    TMPDIR: dir, CODEX_HOME: join(dir, "codex"), GROK_HOME: join(dir, "grok"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  const args = [binary, "init", "--yes", "--preset", "legacy-safe"];
  expect(Bun.spawnSync(args, { cwd: root, env: { ...env, GIT_CONFIG_COUNT: "invalid" }, stdout: "pipe", stderr: "pipe" }).exitCode).toBe(1);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
  expect(Bun.spawnSync([binary, "init"], { cwd: root, env, stdin: Buffer.from("y\n") }).exitCode).toBe(1);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
}));

test("request and check help need no preset, input file or approval", () => inPreviewProject(({ root, cli }) => {
  for (const args of [["preset", "apply"], ["check"], ["update"], ["pack", "update"], ["approve"], ["fitness", "bind"], ["issue", "draft"], ["rules", "test"]]) {
    for (const flag of ["--help", "-h"]) {
      const result = cli(root, ...args, flag);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain("preset show [--json] | request-schema");
      expect(cli(root, ...args, flag, "--yes").exitCode).toBe(1);
    }
  }
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
  expect(existsSync(join(root, ".pregate/pregate.lock.json"))).toBe(false);
  expect(readProposal(root)).toBeNull();
}), 20_000);

test("request schema is inspectable without a preset and cannot apply a policy", () => inPreviewProject(({ root, cli }) => {
  const result = cli(root, "preset", "request-schema");
  expect(result.exitCode).toBe(0);
  const schema = JSON.parse(result.stdout.toString());
  expect(schema.required).toEqual(["why", "patch"]);
  expect(schema.additionalProperties).toBe(false);
  expect(schema.properties.patch.items.oneOf[0].properties.op.enum).toEqual(["add", "replace", "test"]);
  expect(cli(root, "preset", "request-schema", "--yes").exitCode).toBe(1);
  expect(cli(root, "preset", "request-schema", "extra.json").exitCode).toBe(1);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
  expect(existsSync(join(root, ".pregate/pregate.lock.json"))).toBe(false);
}));

test("preset JSON inspection exposes exact request paths without changing the contract", () => inPreviewProject(({ root, cli }) => {
  expect(cli(root, "init", "--yes", "--preset", "legacy-safe").exitCode).toBe(0);
  const paths = [join(root, ".pregate/preset.json"), join(root, ".pregate/pregate.lock.json")];
  const before = paths.map(path => readFileSync(path, "utf8"));
  const result = cli(root, "preset", "show", "--json");
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString())).toEqual(JSON.parse(before[0]!));
  expect(cli(root, "preset", "show", "--json", "--yes").exitCode).toBe(1);
  expect(paths.map(path => readFileSync(path, "utf8"))).toEqual(before);
}));

test("preset request preview validates a bounded adaptation and requires exact human digest approval", () => inPreviewProject(({ root, cli, env }) => {
  expect(cli(root, "init", "--yes", "--preset", "functional-ts").exitCode).toBe(0);
  const presetPath = join(root, ".pregate/preset.json"), lockPath = join(root, ".pregate/pregate.lock.json");
  const preset = JSON.parse(readFileSync(presetPath, "utf8"));
  preset.enforcement = "enforce";
  preset.overrides = { "architecture/FCIS-IO-001": { params: { paths: ["src/**"] } } };
  writeFileSync(presetPath, JSON.stringify(preset));
  expect(cli(root, "preset", "compile", "--yes").exitCode).toBe(0);
  const before = [presetPath, lockPath].map(path => readFileSync(path, "utf8"));
  const consent = cli(root, "status", "--json").stdout.toString();
  mkdirSync(join(root, ".pregate/requests"));
  const request = join(root, ".pregate/requests/core-only.json");
  writeFileSync(request, JSON.stringify({ why: "File I/O belongs to the shell adapter; the core must remain pure.", patch: [
    { op: "test", path: "/overrides/architecture~1FCIS-IO-001/params/paths", value: ["src/**"] },
    { op: "replace", path: "/overrides/architecture~1FCIS-IO-001/params/paths", value: ["src/core/**"] },
  ] }));
  const preview = cli(root, "preset", "apply", request, "--preview");
  expect(preview.exitCode).toBe(0);
  const digest = preview.stdout.toString().match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(preview.stdout.toString()).toContain(`pregate approve ${digest.slice(0, 12)}`);
  expect(preview.stdout.toString()).toContain("FCIS-IO-001");
  expect(preview.stdout.toString()).toContain("Pending human review. The active contract still applies.");
  expect(preview.stdout.toString()).toContain("show this review to the user and wait for approval. Preserve the proposed files.");
  expect([presetPath, lockPath].map(path => readFileSync(path, "utf8"))).toEqual(before);
  // Only the pending review is new: status names its code; protection and consent are unchanged.
  const pendingStatus = JSON.parse(cli(root, "status", "--json").stdout.toString());
  expect(pendingStatus.pendingApproval).toBe(digest.slice(0, 12));
  expect({ ...pendingStatus, pendingApproval: null }).toEqual(JSON.parse(consent));
  const proposal = readProposal(canonical(root), join(env.XDG_DATA_HOME!, "pregate"))!;
  expect(sha256(JSON.stringify(proposal))).toBe(digest);
  expect(proposal.writes).toHaveLength(1);
  expect(proposal.writes[0]!.path).toBe(canonical(presetPath));
  const proposed = JSON.parse(proposal.lockText);
  expect(proposed.rules.filter((r: { check: string; enforcement: string }) => r.check.startsWith("core/") && r.enforcement === "enforce")).toHaveLength(68);
  expect(cli(root, "approve", "--yes", "--digest", "0".repeat(64)).exitCode).toBe(1);
  expect([presetPath, lockPath].map(path => readFileSync(path, "utf8"))).toEqual(before);
  expect(cli(root, "approve", "--yes", "--digest", digest).exitCode).toBe(0);
  expect(readFileSync(lockPath, "utf8")).toBe(proposal.lockText);
  const code = 'import { readFileSync } from "node:fs";\nexport function loadConfig(path: string): string { return readFileSync(path, "utf8"); }\n';
  for (const [path, expected] of [["src/shell/config.ts", 0], ["src/core/config.ts", 1]] as const) {
    const result = Bun.spawnSync([binary, "check", "--stdin", "--path", path], { cwd: root, env, stdin: Buffer.from(code), stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(expected);
    if (expected === 1) expect(result.stdout.toString()).toContain("FCIS-IO-001");
  }
}), 20_000);

test("preset request preview rejects invalid semantics and conflicting flags without replacing a pending review", () => inPreviewProject(({ root, cli, env }) => {
  expect(cli(root, "init", "--yes", "--preset", "functional-ts").exitCode).toBe(0);
  const paths = [join(root, ".pregate/preset.json"), join(root, ".pregate/pregate.lock.json")];
  const before = paths.map(path => readFileSync(path, "utf8"));
  const request = join(root, "request.json");
  writeFileSync(request, JSON.stringify({ why: "Keep a valid review", patch: [{ op: "replace", path: "/name", value: "reviewed-name" }] }));
  expect(cli(root, "preset", "apply", request, "--preview").exitCode).toBe(0);
  const pending = readProposal(canonical(root), join(env.XDG_DATA_HOME!, "pregate"));
  expect(pending).not.toBeNull();
  const invalid = [
    { why: "Invalid parameter", patch: [{ op: "add", path: "/overrides", value: { "architecture/FCIS-IO-001": { params: { paths: 123 } } } }] },
    { why: "Unknown rule", patch: [{ op: "add", path: "/overrides", value: { "architecture/unknown-rule": "deny" } }] },
    { why: "Invalid pointer", patch: [{ op: "replace", path: "/overrides/not-present/params/paths", value: ["src/core/**"] }] },
    { why: "Unexpected property", patch: [], approval: true },
  ];
  for (const value of invalid) {
    writeFileSync(request, JSON.stringify(value));
    expect(cli(root, "preset", "apply", request, "--preview").exitCode).toBe(1);
    expect(paths.map(path => readFileSync(path, "utf8"))).toEqual(before);
    expect(readProposal(canonical(root), join(env.XDG_DATA_HOME!, "pregate"))).toEqual(pending);
  }
  for (const args of [["--preview", "--yes"], ["--preview", "extra"], ["--preview", "--preview"], ["--preview", "--unknown"]]) {
    expect(cli(root, "preset", "apply", request, ...args).exitCode).toBe(1);
    expect(readProposal(canonical(root), join(env.XDG_DATA_HOME!, "pregate"))).toEqual(pending);
  }
}));

test("explicit init writes a versioned shadow contract and activates local consent", () => inPreviewProject(({ root, cli }) => {
  expect(Bun.spawnSync(["git", "init", "-q", root]).exitCode).toBe(0);
  expect(cli(root, "init", "--yes", "--preset", "legacy-safe").exitCode).toBe(0);
  const preset = JSON.parse(readFileSync(join(root, ".pregate/preset.json"), "utf8"));
  expect(preset.engine).toBe(VERSIONS.engine);
  expect(preset.sources[0].version).toBe(VERSIONS.core);
  expect(preset.enforcement).toBe("shadow");
  expect(cli(root, "--version").stdout.toString()).toBe(`pregate ${VERSIONS.engine} (core ${VERSIONS.core})\n`);
  expect(cli(root, "status").stdout.toString()).toContain("is active");
}));

test("disabling consent requires explicit approval and makes the project inactive", () => inPreviewProject(({ root, cli }) => {
  expect(cli(root, "init", "--yes", "--preset", "legacy-safe").exitCode).toBe(0);
  expect(cli(root, "disable").exitCode).toBe(1);
  expect(cli(root, "disable", "--yes").exitCode).toBe(0);
  expect(cli(root, "status").stdout.toString()).toContain("is inactive");
}));

test("explicit approval can reactivate a disabled project", () => inPreviewProject(({ root, cli }) => {
  expect(cli(root, "init", "--yes", "--preset", "legacy-safe").exitCode).toBe(0);
  expect(cli(root, "disable", "--yes").exitCode).toBe(0);
  expect(cli(root, "enable", "--yes").exitCode).toBe(0);
  expect(cli(root, "status").stdout.toString()).toContain("is active");
}));

test("repeated init preserves the existing contract and rejects a different preset", () => inPreviewProject(({ root, cli }) => {
  expect(cli(root, "init", "--yes", "--preset", "legacy-safe").exitCode).toBe(0);
  const unchanged = readFileSync(join(root, ".pregate/preset.json"), "utf8");
  expect(cli(root, "init", "--yes", "--preset", "legacy-safe").exitCode).toBe(0);
  expect(readFileSync(join(root, ".pregate/preset.json"), "utf8")).toBe(unchanged);
  expect(cli(root, "init", "--preset", "integrity-only", "--yes").exitCode).toBe(1);
}));

test("initial and repeated init guide progressive verification instead of disabling unbound requirements", () => inPreviewProject(({ root, cli }) => {
  const initial = cli(root, "init", "--yes", "--preset", "legacy-safe");
  expect(initial.exitCode).toBe(0);
  const repeated = cli(root, "init", "--preview");
  expect(repeated.exitCode).toBe(0);
  for (const response of [initial, repeated]) {
    const next = response.stdout.toString().split("Next:").at(-1)!;
    expect(next).toContain("Unbound requirements stay active and UNVERIFIED without blocking work");
    expect(next).toContain("pregate fitness run <verifier>");
    expect(next).not.toContain("disable");
    expect(next).not.toContain("before completing work");
  }
  const fitness = JSON.parse(cli(root, "fitness", "status", "--json").stdout.toString());
  expect(fitness.requirements).toHaveLength(64);
  expect(fitness.requirements.every((r: { status: string }) => r.status === "unverified")).toBe(true);
}));

test("guide --packs architecture records the pack's own deps.layers resolution", () => inPreviewProject(({ root, cli, env }) => {
  mkdirSync(join(root, "src/core"), { recursive: true });
  mkdirSync(join(root, "src/shell"), { recursive: true });
  writeFileSync(join(root, "src/core/order.ts"), "export const order = 1;\n");
  writeFileSync(join(root, "src/shell/cli.ts"), "export const cli = 1;\n");
  const preview = cli(root, "guide", "--preview", "--packs", "architecture", "--enforcement", "advisor");
  const text = preview.stderr.toString() + preview.stdout.toString();
  expect(text).not.toContain("unresolved conflict");
  expect(preview.exitCode).toBe(0);
  const proposal = readProposal(canonical(root), join(env.XDG_DATA_HOME!, "pregate"));
  const presetText = proposal?.writes.find((write) => write.path.endsWith("preset.json"))?.after;
  expect(presetText).toBeTruthy();
  const preset = JSON.parse(presetText!) as { resolve?: Record<string, { use: string }>; methodologies: string[] };
  expect(preset.methodologies).toEqual(expect.arrayContaining([
    "architecture/clean-architecture", "architecture/functional-core-imperative-shell",
  ]));
  expect(preset.resolve?.["deps.layers"]?.use).toBe("architecture/CA-DEP-001");
}));

test("init, enable and status succeed in a plain directory without git", () => inTempDir("pregate-plain-", (dir) => {
  const root = join(dir, "standalone-project");
  mkdirSync(root);
  writeFileSync(join(root, "index.ts"), "export const hello = 'world';\n");
  const env = { ...process.env, HOME: join(dir, "home"), XDG_DATA_HOME: join(dir, "data"), XDG_STATE_HOME: join(dir, "state"),
    TMPDIR: dir, CODEX_HOME: join(dir, "codex"), GROK_HOME: join(dir, "grok"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1" };
  const cli = (...command: string[]) => Bun.spawnSync([binary, ...command], { cwd: root, env, stdout: "pipe", stderr: "pipe" });
  const initRes = cli("init", "--yes", "--preset", "legacy-safe");
  expect(initRes.exitCode).toBe(0);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(true);
  expect(existsSync(join(root, ".pregate/pregate.lock.json"))).toBe(true);
  expect(cli("status").stdout.toString()).toContain("is active");
}));

function previewProject() {
  const dir = mkdtempSync(join(tmpdir(), "pregate-init-preview-"));
  const root = join(dir, "repo");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/a.ts"), "export const a = 1;\n");
  // Hooks and check deny a directory that is not a Git repository. This fixture is a repository
  // so those tests still reach the behavior they name. The plain-directory case stays separate.
  for (const args of [["init", "-q"], ["add", "."], ["commit", "-qm", "init"]]) {
    const git = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root, stderr: "pipe" });
    if (git.exitCode !== 0) throw new Error(git.stderr.toString());
  }
  const path = process.platform === "win32" ? pathWithoutHarnesses() : "/usr/bin:/bin";
  mkdirSync(join(dir, "home", ".claude"), { recursive: true });
  const env = { ...process.env, HOME: join(dir, "home"), XDG_DATA_HOME: join(dir, "data"), XDG_STATE_HOME: join(dir, "state"),
    TMPDIR: dir, CODEX_HOME: join(dir, "codex"), GROK_HOME: join(dir, "grok"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    PATH: path, ...(process.platform === "win32" ? { Path: path } : {}), CLAUDE_CONFIG_DIR: "" };
  const cli = (cwd: string, ...command: string[]) => Bun.spawnSync([binary, ...command], { cwd, env, stdout: "pipe", stderr: "pipe" });
  return { dir, root, cli, env };
}

function inPreviewProject(run: (project: ReturnType<typeof previewProject>) => void): void {
  const project = previewProject();
  removing(project.dir, () => run(project));
}

function inTempDir(prefix: string, run: (dir: string) => void): void {
  removing(mkdtempSync(join(tmpdir(), prefix)), run);
}

// A cleanup error must not replace the test's own failure: bun prints only the error that escapes.
function removing(dir: string, run: (dir: string) => void): void {
  try { run(dir); } catch (error) {
    try { removeTree(dir); } catch (cleanup) { throw new Error(`The test failed (cause below), then ${dir} could not be removed: ${cleanup}`, { cause: error }); }
    throw error;
  }
  removeTree(dir);
}

function restoringGitConfig(saved: string | undefined, run: () => void): void {
  try { run(); } finally { if (saved === undefined) delete process.env.GIT_CONFIG_COUNT; else process.env.GIT_CONFIG_COUNT = saved; }
}

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("request preview stays nonactivating and agent approval denies in %s", (h) => inPreviewProject(({ dir, root, cli, env }) => {
  expect(cli(root, "setup").exitCode).toBe(0);
  expect(cli(root, "init", "--yes", "--preset", "legacy-safe").exitCode).toBe(0);
  const paths = [join(root, ".pregate/preset.json"), join(root, ".pregate/pregate.lock.json")];
  const before = paths.map(path => readFileSync(path, "utf8"));
  mkdirSync(join(root, ".pregate/requests"));
  writeFileSync(join(root, ".pregate/requests/adapt.json"), JSON.stringify({ why: "A bounded contract review", patch: [{ op: "replace", path: "/name", value: "reviewed-name" }] }));
  const names = { "claude-code": "pre-bash.json", codex: "codex/pre-bash.json", cursor: "cursor/pre-shell.json", grok: "grok/pre-run-terminal-command.json", agy: "agy/pre-run_command.json" };
  // The gate protects its installation root derived from process.execPath.
  // Run the installed engine so unrelated sibling fixtures are not installation files.
  const installed = join(env.XDG_DATA_HOME!, "pregate", VERSIONS.engine, ENGINE_FILE);
  const hook = (command: string) => {
    const payload = JSON.parse(readFileSync(join(import.meta.dir, "payloads", names[h]), "utf8"));
    if (h === "agy") { payload.workspacePaths = [root]; payload.toolCall.args.Cwd = root; payload.toolCall.args.CommandLine = command; }
    else if (h === "grok") { payload.cwd = payload.workspaceRoot = root; payload.toolInput.command = payload.tool_input.command = command; }
    else { payload.cwd = root; payload.workspace_roots = [root]; payload.tool_input.command = command; if (h === "cursor") payload.tool_input.cwd = root; }
    return Bun.spawnSync([installed, "hook", "pre", "--harness", h], { cwd: root, env, stdin: Buffer.from(JSON.stringify(payload)), stdout: "pipe", stderr: "pipe" });
  };
  const command = `pregate preset apply ${canonical(join(root, ".pregate/requests/adapt.json"))} --preview`;
  const permitted = hook(command);
  expect(permitted.stdout.toString() + permitted.stderr.toString()).not.toContain("DENY");
  expect(permitted.exitCode).toBe(0);
  const preview = cli(root, ...command.split(" ").slice(1));
  expect(preview.exitCode).toBe(0);
  expect(paths.map(path => readFileSync(path, "utf8"))).toEqual(before);
  const pending = readProposal(canonical(root), join(env.XDG_DATA_HOME!, "pregate"))!;
  expect(pending).not.toBeNull();
  const digest = sha256(JSON.stringify(pending));
  const denied = hook(`pregate approve --yes --digest ${digest}`);
  expect(denied.stdout.toString() + denied.stderr.toString()).toContain("agent must not");
  expect(paths.map(path => readFileSync(path, "utf8"))).toEqual(before);
  expect(readProposal(canonical(root), join(env.XDG_DATA_HOME!, "pregate"))).toEqual(pending);
}), 20_000);

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("initial review blocks self-approval in %s through the engine, supervisor and missing-launcher fallback", (h) => inPreviewProject(({ dir, root, cli, env }) => {
  const setup = cli(root, "setup");
  if (setup.exitCode !== 0) throw new Error(setup.stdout.toString() + setup.stderr.toString());
  const preview = cli(root, "init", "--preview", "--preset", "legacy-safe");
  expect(preview.exitCode).toBe(0);
  const digest = preview.stdout.toString().match(/Digest: ([0-9a-f]{64})/)![1]!;
  const command = `pregate approve --yes --digest ${digest}`;
  const names = { "claude-code": "pre-bash.json", codex: "codex/pre-bash.json", cursor: "cursor/pre-shell.json", grok: "grok/pre-run-terminal-command.json", agy: "agy/pre-run_command.json" };
  const payload = JSON.parse(readFileSync(join(import.meta.dir, "payloads", names[h]), "utf8"));
  if (h === "agy") { payload.workspacePaths = [root]; payload.toolCall.args.Cwd = root; payload.toolCall.args.CommandLine = command; }
  else if (h === "grok") { payload.cwd = payload.workspaceRoot = root; payload.toolInput.command = payload.tool_input.command = command; }
  else { payload.cwd = root; payload.workspace_roots = [root]; payload.tool_input.command = command; if (h === "cursor") payload.tool_input.cwd = root; }
  const data = join(dir, "data/pregate");
  const run = (argv: string[], raw = JSON.stringify(payload)) => Bun.spawnSync(argv, { cwd: join(root, "src"), env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe" });
  const args = ["hook", "pre", "--harness", h];
  for (const argv of [[binary, ...args], [binary, "--supervise", data, pkg.version, ...args]]) {
    const denied = run(argv);
    const message = denied.stdout.toString() + denied.stderr.toString();
    expect(message).toContain(`run ${command} in a separate terminal`);
    expect(message).toContain("agent must not run");
    expect(message).not.toContain(`! ${command}`);
    if (h === "cursor") {
      expect(JSON.parse(denied.stdout.toString()).permission).toBe("deny");
    }
    const malformed = run(argv, "{invalid");
    expect(malformed.stdout.toString() + malformed.stderr.toString()).toContain("payload-unrecognized");
  }
  expect(existsSync(join(data, "consent"))).toBe(false);
  // A missing engine and then a missing launcher must not turn this review into permission.
  // The engine just ran, so Windows may still have it open; a lock that lasts is still a failure.
  removeReleased(join(data, pkg.version, ENGINE_FILE));
  expect(existsSync(join(data, pkg.version, ENGINE_FILE))).toBe(false);
  const failed = run([binary, "--supervise", data, pkg.version, ...args]);
  expect(failed.stdout.toString() + failed.stderr.toString()).toContain("could not evaluate");
  const launcher = join(data, "bin", process.platform === "win32" ? "launcher.ps1" : "pregate");
  if (process.platform !== "win32") {
    const failedLauncher = run(["/bin/sh", launcher, ...args]);
    expect(failedLauncher.exitCode).toBe(2);
    expect(failedLauncher.stderr.toString()).toContain("could not evaluate");
  }
  rmSync(launcher);
  const shells = process.platform === "win32" ? [["cmd.exe", "/d", "/s", "/c"]] : [["/bin/sh", "-c"], ["/bin/zsh", "-c"]];
  for (const shell of shells) {
    const fallback = run([...shell, hookCommand(data, "pre", h)]);
    expect(fallback.exitCode).toBe(2);
    expect(fallback.stderr.toString()).toMatch(/^PREGATE could not evaluate: [^\n]+\n$/);
  }
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
  expect(existsSync(join(root, ".pregate/pregate.lock.json"))).toBe(false);
  expect(existsSync(join(data, "consent"))).toBe(false);
  expect(cli(root, "approve", "--preview").stdout.toString()).toContain(digest);
  // The direct human CLI path remains available and applies the exact reviewed candidate.
  expect(cli(join(root, "src"), "approve", "--yes", "--digest", digest).exitCode).toBe(0);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(true);
}), 30_000);

test("initial preview works without Git, can be reviewed from a subdirectory and rejects a changed baseline", () => inPreviewProject(({ dir, root, cli }) => {
  const preview = cli(root, "init", "--preview", "--preset", "legacy-safe");
  expect(preview.exitCode).toBe(0);
  expect(preview.stdout.toString()).toContain("Project unchanged; local consent has not been enabled.");
  expect(existsSync(join(root, ".pregate"))).toBe(false);
  expect(existsSync(join(dir, "data/pregate/consent"))).toBe(false);
  const digest = preview.stdout.toString().match(/Digest: ([0-9a-f]{64})/)![1]!;
  const review = cli(join(root, "src"), "approve", "--preview");
  expect(review.exitCode).toBe(0);
  expect(review.stdout.toString()).toContain("pregate approve " + digest.slice(0, 12));
  expect(review.stdout.toString()).toContain("Claude Code, Codex, Grok, agy, OpenCode and Cursor each need a separate terminal.");
  mkdirSync(join(root, ".pregate"));
  writeFileSync(join(root, ".pregate/pregate.lock.json"), "{}\n");
  expect(cli(root, "approve", "--yes", "--digest", digest).exitCode).toBe(1);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
}));

test("preview needs a separate digest approval and rejects conflicting init options", () => inPreviewProject(({ root, cli }) => {
  const preview = cli(root, "init", "--preview", "--preset", "legacy-safe");
  expect(preview.exitCode).toBe(0);
  const digest = preview.stdout.toString().match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(cli(root, "init", "--preview", "--yes").exitCode).toBe(1);
  expect(cli(root, "init", "--preset", "--preview").exitCode).toBe(1);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
  expect(cli(join(root, "src"), "approve", "--yes", "--digest", digest).exitCode).toBe(0);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(true);
}));

test("a stale initial proposal can be replaced after restoring its baseline", () => inPreviewProject(({ root, cli }) => {
  const initial = cli(root, "init", "--preview", "--preset", "legacy-safe");
  expect(initial.exitCode).toBe(0);
  const digest = initial.stdout.toString().match(/Digest: ([0-9a-f]{64})/)![1]!;
  mkdirSync(join(root, ".pregate"));
  writeFileSync(join(root, ".pregate/pregate.lock.json"), "{}\n");
  expect(cli(root, "approve", "--yes", "--digest", digest).exitCode).toBe(1);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(false);
  rmSync(join(root, ".pregate/pregate.lock.json"));
  const again = cli(root, "init", "--preview");
  expect(again.exitCode).toBe(0);
  const fresh = again.stdout.toString().match(/Digest: ([0-9a-f]{64})/)![1]!;
  expect(cli(join(root, "src"), "approve", "--yes", "--digest", fresh).exitCode).toBe(0);
  expect(existsSync(join(root, ".pregate/preset.json"))).toBe(true);
}), 15_000); // Four compiled CLI calls share this scenario budget; product deadlines are unchanged.

test("repeated init preserves explicit disable and refuses an invalid existing lock", () => inPreviewProject(({ root, cli }) => {
  expect(cli(root, "init", "--yes", "--preset", "legacy-safe").exitCode).toBe(0);
  const original = readFileSync(join(root, ".pregate/preset.json"), "utf8");
  expect(cli(root, "disable", "--yes").exitCode).toBe(0);
  expect(cli(join(root, "src"), "init", "--yes").exitCode).toBe(0);
  expect(readFileSync(join(root, ".pregate/preset.json"), "utf8")).toBe(original);
  expect(cli(root, "status").stdout.toString()).toContain("is inactive");
  writeFileSync(join(root, ".pregate/pregate.lock.json"), "{}\n");
  expect(cli(root, "init").exitCode).toBe(1);
  expect(readFileSync(join(root, ".pregate/pregate.lock.json"), "utf8")).toBe("{}\n");
}));

test("onboarding inventory skips assets and environments, keeps unsupported names and rejects broken Git", () => inTempDir("pregate-init-inventory-", (dir) => restoringGitConfig(process.env.GIT_CONFIG_COUNT, () => {
  mkdirSync(join(dir, "src"));
  mkdirSync(join(dir, ".venv/lib"), { recursive: true });
  writeFileSync(join(dir, "src/a.ts"), "export const a = 1;");
  writeFileSync(join(dir, "app.PY"), "pass\n");
  writeFileSync(join(dir, "app.RB"), "unsupported source");
  writeFileSync(join(dir, "asset.png"), new Uint8Array(1024 * 1024));
  writeFileSync(join(dir, ".venv/lib/a.py"), "ignored");
  expect(repoFiles(dir)).toEqual({ "app.PY": "pass\n", "app.RB": "", "src/a.ts": "export const a = 1;" });
  expect(detectStack(repoFiles(dir)).languages).toContain("Python");
  Bun.spawnSync(["git", "init", "-q", dir]);
  process.env.GIT_CONFIG_COUNT = "invalid";
  expect(() => repoFiles(dir)).toThrow("Git could not inventory");
})));

test("language metadata recommends starters and mixed projects select only their actual languages", async () => {
  await grammars();
  expect(detectStack({ "pyproject.toml": "" }).recommended).toBe("python-starter");
  expect(detectStack({ "go.mod": "module example.com/app\n" }).recommended).toBe("go-starter");
  const stack = detectStack({ "app.py": "pass\n", "index.ts": "export const a = 1;", "old.rb": "" });
  expect(stack.recommended).toBe("mixed-starter");
  const preset = onboardingPreset(stack.recommended, BUILTIN, VERSIONS, stack, librarySources())!;
  const bundled = Object.fromEntries(librarySources().map((source) => [source.ns, source]));
  expect(preset.sources.filter((s) => s.kind === "library")).toEqual([
    bundled.python!, bundled["clean-code"]!,
  ]);
  expect(preset.methodologies).toEqual(["core/pregate-integrity", "python/quality", "clean-code/clean-code"]);
  expect(preset.enforcement).toBe("shadow");
  expect(onboardingPreset("go-starter", BUILTIN, VERSIONS, stack, [])).toBeNull();
});

test("layer evidence names the imports that already break a map and the sibling folders it leaves unrestricted", async () => {
  await grammars();
  const files: Files = { "src/domain/order.ts": 'import { db } from "../infra/db.ts";\nexport const order = db;\n', "src/domain/price.ts": "export const price = 1;\n",
    "src/infra/db.ts": 'import type { Order } from "../domain/order.ts";\nexport const db = 1;\n',
    "src/services/checkout.ts": 'import { order } from "../domain/order.ts";\nexport const checkout = order;\n',
    "src/ui/cart.ts": 'import { checkout } from "../services/checkout.ts";\nimport { db } from "../infra/db.ts";\nexport const cart = [checkout, db];\n',
    "src/main.ts": 'import { cart } from "./ui/cart.ts";\nexport default cart;\n', "src/domain/order.test.ts": 'import { db } from "../infra/db.ts";\n' };
  const layers = deriveLayers(files).layers;
  const evidence = layerEvidence(files, layers);
  expect(evidence.layers).toEqual([
    { name: "domain", files: 2, broken: [{ to: "infra", count: 1, example: "src/domain/order.ts imports src/infra/db.ts" }] },
    { name: "infra", files: 1, broken: [] }]);
  expect(evidence.unplaced).toEqual([{ dir: "src/*", files: 1, imports: ["src/ui"] }, { dir: "src/services", files: 1, imports: ["domain"] },
    { dir: "src/ui", files: 1, imports: ["infra", "src/services"] }]);
  const lines = layerEvidenceLines(evidence, "no-new", "blocked before the file is written");
  expect(lines[0]).toBe("Layer domain (2 files): 1 existing import of infra, which it may not import. Example: src/domain/order.ts imports src/infra/db.ts.");
  expect(lines).toContain("Layers with no existing break: infra (1 file).");
  expect(lines).toContain("The 1 existing break stays as known debt under no-new. A new break is blocked before the file is written.");
  expect(lines.at(-1)).toContain("pregate layers apply <layers.json> --preview");
  const placed = { ...layers, ui: { paths: ["src/ui/**"], mayImport: ["domain"], kind: "adapter" as const } };
  expect(layerEvidence(files, placed).layers.find(layer => layer.name === "ui")!.broken.map(edge => [edge.to, edge.count])).toEqual([["code outside every layer", 1], ["infra", 1]]);
  expect(layerEvidenceLines(layerEvidence({ "src/domain/a.ts": "", "src/infra/b.ts": "" }, deriveLayers({ "src/domain/a.ts": "", "src/infra/b.ts": "" }).layers), "strict", "recorded only (shadow)"))
    .toEqual(["Layers with no existing break: domain (1 file), infra (1 file).", "No production import breaks this map today. A new break is recorded only (shadow)."]);
});
