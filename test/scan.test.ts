import { beforeAll, expect, test } from "bun:test";
import { proposedScope, recommendPacks } from "../src/scan-command.ts";
import { detectStack, scopeCoverage } from "../src/onboard.ts";
import { grammars } from "../src/gate.ts";

beforeAll(grammars);

test("scan uses exact dependency facts from root and workspace manifests, without inferred compliance", () => {
  const files = { "package.json": '{"dependencies":{"reactive-helper":"1.0.0"}}',
    "packages/web/package.json": '{"dependencies":{"react":"19.0.0","@trpc/server":"11.0.0"},"devDependencies":{"vitest":"4.0.0"}}' };
  const selected = recommendPacks(files, ["TypeScript", "Go"]);
  expect(selected.map((item) => item.ns)).toEqual(["go", "react", "testing", "trpc", "typescript"]);
  expect(selected.find((item) => item.ns === "react")!.reasons).toEqual(["packages/web/package.json declares react"]);
  expect(recommendPacks({}, ["Rust"])).toEqual([{ ns: "rust", methodologies: ["rust/quality"],
    reasons: ["Rust source or Cargo metadata detected; source AST only, no macro expansion or compiler proof"] }]);
  expect(recommendPacks({}, ["Ruby"])).toEqual([]);
  expect(() => recommendPacks({ "package.json": "{broken" }, [])).toThrow();
});

test("scan recognizes exact Vue peer dependencies and confines recommendations to their owning workspace", () => {
  const files = { "package.json": '{"peerDependencies":{"vue-helper":"1.0.0"}}',
    "packages/store/package.json": '{"peerDependencies":{"vue":"^3.5.0"}}',
    "packages/site/package.json": '{"dependencies":{"react":"19.0.0"}}' };
  const vue = recommendPacks(files, ["TypeScript"]).find(item => item.ns === "vue")!;
  expect(vue.methodologies).toEqual(["vue/reactivity", "vue/sfc"]);
  expect(vue.reasons).toEqual(["packages/store/package.json declares vue"]);
  expect(vue.scope).toEqual({ include: ["packages/store/**"], exclude: [] });
  expect(recommendPacks({ "package.json": files["package.json"]! }, []).some(item => item.ns === "vue")).toBe(false);
});

test("scan recommends vue from a devDependency or a .vue file, and react from a devDependency", () => {
  const server = recommendPacks({
    "package.json": '{"dependencies":{"express":"4.21.0"},"devDependencies":{"vue":"^3.5.13"}}',
    "server/server.js": "export const ready = true;\n",
  }, ["JavaScript"]).find(item => item.ns === "vue")!;
  expect(server.methodologies).toEqual(["vue/reactivity", "vue/sfc"]);
  expect(server.reasons).toEqual(["package.json declares vue"]);
  expect(server.scope).toEqual({ include: ["**"], exclude: [] });
  const workspace = recommendPacks({
    "package.json": '{"dependencies":{"express":"4.21.0"}}',
    "packages/web/package.json": '{"devDependencies":{"vue":"^3.5.13"}}',
    "packages/web/src/App.vue": "<template><p>Hi</p></template>\n",
    "packages/api/package.json": "{}",
  }, ["TypeScript"]).find(item => item.ns === "vue")!;
  expect(workspace.reasons).toEqual(["packages/web/package.json declares vue", ".vue source detected"]);
  expect(workspace.scope).toEqual({ include: ["packages/web/**"], exclude: [] });
  expect(recommendPacks({ "src/App.vue": "<template><p>Hi</p></template>\n" }, []).find(item => item.ns === "vue")).toEqual({
    ns: "vue", methodologies: ["vue/reactivity", "vue/sfc"], reasons: [".vue source detected"] });
  const kept = recommendPacks({
    "package.json": '{"devDependencies":{"vue":"^3.5.13"}}',
    "src/App.vue": "",
    "docs/Guide.vue": "",
    "docs/package.json": '{"devDependencies":{"vue":"^3.5.13"}}',
    "examples/package.json": '{"dependencies":{"vue":"^3.5.13"}}',
  }, []);
  expect(kept.find(item => item.ns === "vue")).toMatchObject({
    reasons: ["package.json declares vue", ".vue source detected"],
    scope: { include: ["**"], exclude: ["docs/**", "examples/**"] },
  });
  expect(recommendPacks({ "src/App.vue": "", "docs/Guide.vue": "", "examples/Widget.vue": "" }, []).find(item => item.ns === "vue")).toEqual({
    ns: "vue", methodologies: ["vue/reactivity", "vue/sfc"], reasons: [".vue source detected"] });
  expect(recommendPacks({ "package.json": '{"dependencies":{"vue-router":"^4","eslint-plugin-vue":"^9","@vue/test-utils":"^2"}}' }, []).some(item => item.ns === "vue")).toBe(false);
  expect(recommendPacks({ "package.json": '{"optionalDependencies":{"vue":"^3.5.13"}}' }, []).some(item => item.ns === "vue")).toBe(false);
  expect(recommendPacks({ "docs/App.vue": "", "examples/Widget.vue": "", "fixtures/One.vue": "" }, []).some(item => item.ns === "vue")).toBe(false);
  expect(recommendPacks({ "packages/docs/package.json": '{"devDependencies":{"vue":"^3.5.13"}}', "docs/App.vue": "" }, []).some(item => item.ns === "vue")).toBe(false);
  expect(recommendPacks({ "scripts/Widget.vue": "" }, []).some(item => item.ns === "vue")).toBe(false);
  const react = recommendPacks({
    "package.json": '{"dependencies":{"express":"4.21.0"},"devDependencies":{"react":"^19.0.0","react-dom":"^19.0.0"}}',
  }, []).find(item => item.ns === "react")!;
  expect(react.methodologies).toEqual(["react/components", "react/hooks"]);
  expect(react.reasons).toEqual(["package.json declares react"]);
  expect(react.scope).toEqual({ include: ["**"], exclude: [] });
  expect(recommendPacks({
    "packages/web/package.json": '{"devDependencies":{"react":"^19.0.0"}}',
  }, []).find(item => item.ns === "react")).toMatchObject({
    reasons: ["packages/web/package.json declares react"],
    scope: { include: ["packages/web/**"], exclude: [] },
  });
  expect(recommendPacks({ "package.json": '{"devDependencies":{"react-dom":"^19.0.0"}}' }, []).some(item => item.ns === "react")).toBe(false);
  expect(recommendPacks({
    "package.json": '{"devDependencies":{"svelte":"^5","next":"15.0.0","astro":"^5.0.0","hono":"^4.6.0","express":"5.0.0","@nestjs/core":"10.0.0"}}',
  }, []).map(item => item.ns)).toEqual([]);
});

test("scan recognizes exact Svelte peer dependencies and confines recommendations to their owning workspace", () => {
  const files = { "package.json": '{"peerDependencies":{"svelte-helper":"1.0.0"}}',
    "packages/store/package.json": '{"peerDependencies":{"svelte":"^5.0.0"}}',
    "packages/site/package.json": '{"dependencies":{"react":"19.0.0"}}' };
  const svelte = recommendPacks(files, ["TypeScript"]).find(item => item.ns === "svelte")!;
  expect(svelte.methodologies).toEqual(["svelte/runes", "svelte/stores"]);
  expect(svelte.reasons).toEqual(["packages/store/package.json declares svelte"]);
  expect(svelte.scope).toEqual({ include: ["packages/store/**"], exclude: [] });
  expect(recommendPacks({ "package.json": files["package.json"]! }, []).some(item => item.ns === "svelte")).toBe(false);
});

test("scan recommends svelte for the package named svelte, Svelte sources, config, and @sveltejs dependencies", () => {
  const repo = {
    "package.json": '{"name":"svelte-monorepo","devDependencies":{"svelte":"workspace:*","@sveltejs/eslint-config":"^9"}}',
    "packages/svelte/package.json": '{"name":"svelte","dependencies":{"@sveltejs/acorn-typescript":"^1.0.0"}}',
    "packages/svelte/src/main.svelte": "",
    "svelte.config.js": "",
  };
  const svelte = recommendPacks(repo, ["TypeScript"]).find(item => item.ns === "svelte")!;
  expect(svelte.methodologies).toEqual(["svelte/runes", "svelte/stores"]);
  expect(svelte.reasons).toEqual([
    "packages/svelte/package.json is named svelte",
    "packages/svelte/package.json declares @sveltejs/acorn-typescript",
    ".svelte source detected",
    "svelte.config.js detected",
  ]);
  expect(svelte.scope).toEqual({ include: ["packages/svelte/**"], exclude: [] });
  const kit = recommendPacks({ "packages/app/package.json": '{"peerDependencies":{"@sveltejs/kit":"^2.0.0"}}' }, []).find(item => item.ns === "svelte")!;
  expect(kit.reasons).toEqual(["packages/app/package.json declares @sveltejs/kit"]);
  expect(kit.scope).toEqual({ include: ["packages/app/**"], exclude: [] });
  expect(recommendPacks({ "src/App.svelte": "" }, []).find(item => item.ns === "svelte")).toEqual({
    ns: "svelte", methodologies: ["svelte/runes", "svelte/stores"], reasons: [".svelte source detected"] });
  expect(recommendPacks({ "apps/web/svelte.config.mjs": "" }, []).find(item => item.ns === "svelte")!.reasons).toEqual(["apps/web/svelte.config.mjs detected"]);
  expect(recommendPacks({ "package.json": '{"dependencies":{"eslint-plugin-svelte":"3","svelte-check":"4"}}' }, []).some(item => item.ns === "svelte")).toBe(false);
  expect(recommendPacks({ "package.json": '{"name":"svelte-kit","devDependencies":{"svelte":"^5","@sveltejs/kit":"^2"}}' }, []).some(item => item.ns === "svelte")).toBe(false);
  expect(recommendPacks({ "docs/App.svelte": "<h1>Docs</h1>\n", "examples/Widget.svelte": "" }, []).some(item => item.ns === "svelte")).toBe(false);
  expect(recommendPacks({ "packages/docs/svelte.config.js": "export default {};\n" }, []).some(item => item.ns === "svelte")).toBe(false);
  expect(recommendPacks({ "packages/docs/package.json": '{"dependencies":{"svelte":"^5"}}', "docs/App.svelte": "" }, []).some(item => item.ns === "svelte")).toBe(false);
  const kept = recommendPacks({ "src/App.svelte": "", "docs/Guide.svelte": "", "examples/Widget.svelte": "" }, []);
  expect(kept.find(item => item.ns === "svelte")).toEqual({
    ns: "svelte", methodologies: ["svelte/runes", "svelte/stores"], reasons: [".svelte source detected"] });
});

test("a SvelteKit test app with its own package and a nested owner stays inside the owning package", () => {
  const repo = {
    "package.json": '{"name":"kit-monorepo","private":true}',
    "packages/kit/package.json": '{"name":"@sveltejs/kit","peerDependencies":{"svelte":"^5.0.0"}}',
    "packages/kit/src/index.ts": "export const kit = 1;\n",
    "packages/kit/test/apps/async/package.json": '{"name":"test-async","devDependencies":{"svelte":"^5.0.0","@sveltejs/kit":"workspace:*"}}',
    "packages/kit/test/apps/async/src/routes/+page.svelte": "<h1>Async</h1>\n",
    "packages/kit/test/apps/async/_test_dependencies/remote-lib/package.json": '{"name":"e2e-test-dep-remote","peerDependencies":{"@sveltejs/kit":"*"}}',
    "packages/kit/test/apps/async/_test_dependencies/plain-lib/package.json": '{"name":"e2e-test-dep-plain"}',
  };
  const svelte = recommendPacks(repo, ["TypeScript"]).find(item => item.ns === "svelte")!;
  expect(svelte.scopeProblems).toBeUndefined();
  expect(svelte.scope).toEqual({
    include: ["packages/kit/**", "packages/kit/test/apps/async/_test_dependencies/remote-lib/**"],
    exclude: [],
  });
  expect(svelte.reasons).toEqual([
    "packages/kit/package.json declares svelte",
    "packages/kit/test/apps/async/_test_dependencies/remote-lib/package.json declares @sveltejs/kit",
    ".svelte source detected",
  ]);
  const outside = recommendPacks({
    "packages/kit/package.json": '{"peerDependencies":{"svelte":"^5"}}',
    "packages/kit/src/apps/async/package.json": "{}",
    "packages/kit/src/apps/async/nested/package.json": '{"peerDependencies":{"@sveltejs/kit":"*"}}',
  }, []).find(item => item.ns === "svelte")!;
  expect(outside.scopeProblems).toEqual(["Nested owners below packages/kit/src/apps/async/ cannot be represented by one include/exclude scope. Choose an explicit reviewed rule scope."]);
});

test("proposed scope uses the initial recipe and detected roots without hiding unsupported files or activating a contract", () => {
  const files = { "app/page.tsx": "export const page = 1;\n", "components/Form.rb": "", "src/generated/client.ts": "export const client = 1;\n" };
  const stack = detectStack(files), scope = proposedScope(files, stack), coverage = scopeCoverage(files, scope);
  expect(scope.include).toContain("app/**");
  expect(scope.exclude).toContain("src/**/generated/**");
  expect(coverage).toMatchObject({ inventoried: 2, inScope: 1, sourceLikeInventoried: 3 });
  expect(coverage.excluded).toEqual(["src/generated/client.ts"]);
  expect(coverage.unsupported).toEqual(["components/Form.rb"]);
});

test("frameworks declared only as devDependencies are not suggested; test runners still suggest testing", () => {
  const files = { "package.json": '{"dependencies":{"ky":"1.0.0"},"devDependencies":{"express":"5.0.0","vitest":"4.0.0"}}' };
  const selected = recommendPacks(files, ["TypeScript"]);
  expect(selected.some(item => item.ns === "express")).toBe(false);
  expect(selected.find(item => item.ns === "testing")!.methodologies).toEqual(["testing/tdd"]);
  expect(recommendPacks({ "package.json": '{"peerDependencies":{"express":"5.0.0"}}' }, []).some(item => item.ns === "express")).toBe(true);
});

test("token, CORS and LLM SDK dependencies suggest the client-and-agents hardening policy only", () => {
  for (const dep of ["jsonwebtoken", "jose", "cors", "openai", "@anthropic-ai/sdk", "ai"]) {
    const security = recommendPacks({ "package.json": JSON.stringify({ dependencies: { [dep]: "1.0.0" } }) }, []).find(item => item.ns === "security-audit");
    expect(security?.methodologies, dep).toEqual(["security-audit/client-and-agents"]);
  }
  expect(recommendPacks({ "package.json": '{"devDependencies":{"jose":"5.0.0"}}' }, []).some(item => item.ns === "security-audit")).toBe(false);
});

test("obvious-sinks is suggested only where one of its checks reads a source file", () => {
  expect(recommendPacks({ "cmd/server/main.go": "" }, ["Go"]).find(item => item.ns === "security-audit")).toEqual({
    ns: "security-audit", methodologies: ["security-audit/obvious-sinks"], reasons: ["security-audit/obvious-sinks checks apply to 1 source file"] });
  expect(recommendPacks({ "cmd/server/main.go": "" }, ["Go"], ["security-audit/obvious-sinks"]).some(item => item.ns === "security-audit")).toBe(false);
});

test("obvious-sinks needs evidence: a non-TypeScript production language, a production sink import or a security dependency", () => {
  const sinks = (files: Record<string, string>, languages: string[]) => recommendPacks(files, languages).find(item => item.ns === "security-audit")?.methodologies;
  expect(sinks({ "src/a.ts": 'import { readFile } from "node:fs";\nconst crypto = 1;\n' }, ["TypeScript"])).toBeUndefined();
  expect(sinks({ "src/a.ts": 'import { createHash } from "node:crypto";\n' }, ["TypeScript"])).toEqual(["security-audit/obvious-sinks"]);
  expect(sinks({ "src/a.js": 'const { exec } = require("child_process");\n' }, ["JavaScript"])).toEqual(["security-audit/obvious-sinks"]);
  expect(sinks({ "src/a.ts": "", "src/a.test.ts": 'import { load } from "js-yaml";\n' }, ["TypeScript"])).toBeUndefined();
  expect(sinks({ "src/a.ts": 'import type { KeyObject } from "node:crypto";\n', "src/env.d.ts": 'import { KeyObject } from "crypto";\n' }, ["TypeScript"])).toBeUndefined();
  expect(sinks({ "app/main.py": "" }, ["Python"])).toEqual(["security-audit/obvious-sinks"]);
  expect(sinks({ "package.json": '{"devDependencies":{"js-yaml":"4.0.0","jose":"5.0.0"}}', "src/a.ts": "" }, ["TypeScript"])).toBeUndefined();
  expect(sinks({ "package.json": '{"dependencies":{"jose":"5.0.0"}}', "src/a.ts": "" }, ["TypeScript"])).toEqual(["security-audit/client-and-agents", "security-audit/obvious-sinks"]);
});

test("layered folders suggest the language's architecture methodology with layers from the real folders", () => {
  const files = { "src/domain/order.ts": "", "src/infra/db.ts": "" };
  const architecture = recommendPacks(files, ["TypeScript"]).find(item => item.ns === "architecture")!;
  expect(architecture.methodologies).toEqual(["architecture/clean-architecture"]);
  expect(architecture.reasons).toEqual(["Layered folders detected: src/domain, src/infra. Layer paths come from these folders; review them."]);
  expect(architecture.layers).toEqual({ domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
    infra: { paths: ["src/infra/**"], mayImport: ["domain"], kind: "adapter" } });
  expect(recommendPacks(files, ["TypeScript"], ["architecture/functional-core-imperative-shell"]).some(item => item.ns === "architecture")).toBe(false);
  expect(recommendPacks({ "src/domain/order.ts": "" }, ["TypeScript"]).some(item => item.ns === "architecture")).toBe(false);
  const python = recommendPacks({ "app/domain/order.py": "", "app/infra/db.py": "" }, ["Python"]).find(item => item.ns === "python")!;
  expect(python.methodologies).toEqual(["python/quality", "python/architecture"]);
  expect(Object.keys(python.layers!)).toEqual(["domain", "infra"]);
});

test("docs sites, examples, fixtures, websites, CI workflows, and tiny scripts do not recommend a pack on their own", () => {
  const names = (files: Record<string, string>, languages: string[] = []) => recommendPacks(files, languages).map(item => item.ns);
  const docs = {
    "packages/zod/src/index.ts": "export const schema = 1;\n",
    "packages/docs/package.json": '{"dependencies":{"next":"15.0.0","react":"19.0.0"},"devDependencies":{"vitest":"4.0.0"}}',
    "packages/docs/app/page.tsx": "export const page = 1;\n",
  };
  expect(names(docs, ["TypeScript"])).toEqual(["clean-code", "typescript"]);
  expect(names({
    "fixtures/app/package.json": '{"dependencies":{"hono":"^4.6.0","react":"19.0.0"}}',
    "fixtures/app/index.ts": "export const page = 1;\n",
  }, ["TypeScript"])).toEqual([]);
  expect(names({
    "packages/docs/package.json": docs["packages/docs/package.json"]!,
    "packages/docs/app/page.tsx": docs["packages/docs/app/page.tsx"]!,
    "website/package.json": '{"dependencies":{"next":"15.0.0"}}',
    "examples/demo/package.json": '{"dependencies":{"react":"19.0.0"}}',
    "fixtures/app/package.json": '{"dependencies":{"astro":"^5.0.0","react":"19.0.0","@tanstack/react-query":"5.0.0"}}',
    "docs/app/page.tsx": "export const page = 1;\n",
  }, ["TypeScript"])).toEqual([]);
  expect(names({ "fixtures/App.svelte": "<h1>Hi</h1>\n", "fixtures/svelte.config.js": "export default {};\n" })).toEqual([]);
  expect(names({
    ".github/workflows/release-notes.py": "print('notes')\n",
    "src/lib.rs": "pub fn f() {}\n",
    "Cargo.toml": "[package]\nname = \"clap\"\nversion = \"0.1.0\"\n",
  }, ["Python", "Rust"])).toEqual(["rust", "security-audit"]);
  expect(names({ "scripts/release.py": "print(1)\n", "scripts/notes.py": "" }, ["Python"])).toEqual([]);
  expect(names({ "scripts/a.py": "", "scripts/b.py": "", "scripts/c.py": "" }, ["Python"])).toEqual([]);
  expect(names({ "scripts/a.py": "", "scripts/b.py": "", "scripts/c.py": "", "scripts/d.py": "" }, ["Python"])).toContain("python");
  const app = recommendPacks({
    "apps/web/package.json": '{"dependencies":{"next":"15.0.0","react":"19.0.0"}}',
    "apps/web/app/page.tsx": "export const page = 1;\n",
    "packages/docs/package.json": docs["packages/docs/package.json"]!,
  }, ["TypeScript"]);
  expect(app.find(item => item.ns === "nextjs")).toMatchObject({
    reasons: ["apps/web/package.json declares next"], scope: { include: ["apps/web/**"], exclude: [] } });
  expect(app.find(item => item.ns === "react")!.reasons).toEqual(["apps/web/package.json declares react"]);
  const root = recommendPacks({
    "package.json": '{"dependencies":{"next":"15.0.0","react":"19.0.0"}}',
    "app/page.tsx": "export const page = 1;\n",
    "packages/docs/package.json": docs["packages/docs/package.json"]!,
  }, ["TypeScript"]);
  expect(root.find(item => item.ns === "nextjs")).toMatchObject({
    reasons: ["package.json declares next"], scope: { include: ["**"], exclude: ["packages/docs/**"] } });
  const python = recommendPacks({
    "pyproject.toml": "[project]\nname = \"demo\"\n",
    "src/app/__init__.py": "",
    ".github/workflows/release-notes.py": "print('notes')\n",
    "scripts/release.py": "print(1)\n",
  }, ["Python"]);
  expect(python.map(item => item.ns)).toEqual(["python", "security-audit"]);
  expect(names({ "docs/domain/order.ts": "", "docs/infra/db.ts": "" }, ["TypeScript"])).not.toContain("architecture");
  const layered = recommendPacks({
    "src/domain/order.ts": "", "src/infra/db.ts": "", "docs/domain/page.ts": "", "docs/infra/db.ts": "",
  }, ["TypeScript"]).find(item => item.ns === "architecture")!;
  expect(layered.reasons[0]).toContain("src/domain, src/infra");
  expect(layered.layers).toEqual({ domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
    infra: { paths: ["src/infra/**"], mayImport: ["domain"], kind: "adapter" } });
});

test("scan recommends astro only for a real dependency outside docs, examples, and fixtures", () => {
  const astro = recommendPacks({
    "package.json": '{"dependencies":{"astro":"^5.0.0"}}',
    "astro.config.mjs": "export default {};\n",
    "src/pages/index.astro": "---\n---\n",
  }, ["TypeScript"]).find(item => item.ns === "astro")!;
  expect(astro.methodologies).toEqual(["astro/config", "astro/content", "astro/routing"]);
  expect(astro.reasons).toEqual(["package.json declares astro"]);
  expect(astro.scope).toEqual({ include: ["**"], exclude: [] });
  const peer = recommendPacks({
    "package.json": '{"dependencies":{"left-pad":"1.0.0"}}',
    "packages/web/package.json": '{"peerDependencies":{"astro":"^5.0.0"}}',
    "packages/web/src/content.config.ts": "export const collections = {};\n",
  }, ["TypeScript"]).find(item => item.ns === "astro")!;
  expect(peer.reasons).toEqual(["packages/web/package.json declares astro"]);
  expect(peer.scope).toEqual({ include: ["packages/web/**"], exclude: [] });
  expect(recommendPacks({ "package.json": '{"devDependencies":{"astro":"^5.0.0"}}' }, []).some(item => item.ns === "astro")).toBe(false);
  expect(recommendPacks({ "package.json": '{"dependencies":{"@astrojs/react":"^4.0.0","eslint-plugin-astro":"1.0.0"}}' }, []).some(item => item.ns === "astro")).toBe(false);
  expect(recommendPacks({ "package.json": '{"name":"astro"}', "astro.config.ts": "export default {};\n", "src/pages/index.astro": "" }, []).some(item => item.ns === "astro")).toBe(false);
  for (const path of ["docs/site/package.json", "examples/blog/package.json", "fixtures/app/package.json"]) {
    expect(recommendPacks({ [path]: '{"dependencies":{"astro":"^5.0.0"}}' }, []).some(item => item.ns === "astro"), path).toBe(false);
  }
  const selected = recommendPacks({
    "package.json": '{"dependencies":{"astro":"^5.0.0"}}',
    "docs/package.json": '{"dependencies":{"astro":"^5.0.0"}}',
    "examples/starter/package.json": '{"dependencies":{"astro":"^5.0.0"}}',
    "fixtures/app/package.json": '{"dependencies":{"astro":"^5.0.0"}}',
  }, []).find(item => item.ns === "astro")!;
  expect(selected.reasons).toEqual(["package.json declares astro"]);
  expect(selected.scope).toEqual({ include: ["**"], exclude: ["docs/**", "examples/starter/**", "fixtures/app/**"] });
});

test("scan recommends tanstack-query only from a real framework-adapter dependency", () => {
  const selected = recommendPacks({
    "package.json": '{"dependencies":{"@tanstack/react-query":"5.59.0"}}',
    "src/main.tsx": "export const page = 1;\n",
  }, ["TypeScript"]);
  expect(selected.find(item => item.ns === "tanstack-query")).toEqual({
    ns: "tanstack-query",
    methodologies: ["tanstack-query/keys", "tanstack-query/client"],
    reasons: ["package.json declares @tanstack/react-query"],
    scope: { include: ["**"], exclude: [] },
  });
  for (const dep of ["@tanstack/vue-query", "@tanstack/solid-query", "@tanstack/svelte-query", "@tanstack/angular-query", "@tanstack/angular-query-experimental"]) {
    const hit = recommendPacks({ "packages/web/package.json": JSON.stringify({ peerDependencies: { [dep]: "5.0.0" } }) }, []);
    expect(hit.find(item => item.ns === "tanstack-query")?.reasons, dep).toEqual([`packages/web/package.json declares ${dep}`]);
  }
  expect(recommendPacks({ "package.json": '{"devDependencies":{"@tanstack/react-query":"5.0.0"}}' }, []).some(item => item.ns === "tanstack-query")).toBe(false);
  expect(recommendPacks({ "package.json": '{"dependencies":{"@tanstack/query-core":"5.0.0","@tanstack/react-query-devtools":"5.0.0"}}' }, []).some(item => item.ns === "tanstack-query")).toBe(false);
  expect(recommendPacks({ "src/main.tsx": 'import { useQuery } from "@tanstack/react-query";\n' }, ["TypeScript"]).some(item => item.ns === "tanstack-query")).toBe(false);
  for (const path of ["docs/package.json", "examples/demo/package.json", "fixtures/query/package.json", "packages/docs/package.json"]) {
    expect(recommendPacks({ [path]: '{"dependencies":{"@tanstack/react-query":"5.0.0"}}' }, []).some(item => item.ns === "tanstack-query"), path).toBe(false);
  }
  const kept = recommendPacks({
    "apps/web/package.json": '{"dependencies":{"@tanstack/react-query":"5.0.0"}}',
    "docs/package.json": '{"dependencies":{"@tanstack/react-query":"5.0.0"}}',
    "examples/package.json": '{"dependencies":{"@tanstack/vue-query":"5.0.0"}}',
    "fixtures/package.json": '{"dependencies":{"@tanstack/svelte-query":"5.0.0"}}',
  }, []);
  expect(kept.find(item => item.ns === "tanstack-query")).toMatchObject({
    reasons: ["apps/web/package.json declares @tanstack/react-query"],
    scope: { include: ["apps/web/**"], exclude: [] },
  });
});

test("scan recommends hono only when an app depends on hono", () => {
  const root = recommendPacks({
    "package.json": '{"dependencies":{"hono":"^4.6.0"}}',
    "src/index.ts": "export const app = 1;\n",
  }, ["TypeScript"]).find(item => item.ns === "hono")!;
  expect(root.methodologies).toEqual(["hono/routing", "hono/middleware"]);
  expect(root.reasons).toEqual(["package.json declares hono"]);
  expect(recommendPacks({
    "apps/api/package.json": '{"peerDependencies":{"hono":"^4.6.0"}}',
    "apps/api/src/index.ts": "",
  }, ["TypeScript"]).find(item => item.ns === "hono")).toMatchObject({
    reasons: ["apps/api/package.json declares hono"],
    scope: { include: ["apps/api/**"], exclude: [] },
  });
  expect(recommendPacks({ "package.json": '{"devDependencies":{"hono":"^4.6.0"}}' }, []).some(item => item.ns === "hono")).toBe(false);
  expect(recommendPacks({ "package.json": '{"dependencies":{"@hono/node-server":"^1.0.0","hono-rate-limiter":"1.0.0"}}' }, []).some(item => item.ns === "hono")).toBe(false);
  expect(recommendPacks({ "package.json": '{"name":"hono"}' }, []).some(item => item.ns === "hono")).toBe(false);
  for (const path of ["docs/package.json", "examples/demo/package.json", "fixtures/app/package.json", "packages/docs/package.json"]) {
    expect(recommendPacks({ [path]: '{"dependencies":{"hono":"^4.6.0"}}' }, []).some(item => item.ns === "hono")).toBe(false);
  }
  const kept = recommendPacks({
    "package.json": '{"dependencies":{"hono":"^4.6.0"}}',
    "docs/package.json": '{"dependencies":{"hono":"^4.6.0"}}',
    "examples/package.json": '{"dependencies":{"hono":"^4.6.0"}}',
    "fixtures/package.json": '{"dependencies":{"hono":"^4.6.0"}}',
  }, []);
  expect(kept.find(item => item.ns === "hono")!.reasons).toEqual(["package.json declares hono"]);
  expect(kept.find(item => item.ns === "hono")!.scope).toEqual({ include: ["**"], exclude: ["docs/**", "examples/**", "fixtures/**"] });
});

test("clean-code and testing are suggested only where their checks read real source", () => {
  const withTests = recommendPacks({ "app/service.py": "", "tests/test_service.py": "" }, ["Python"]);
  expect(withTests.map(item => item.ns)).toEqual(["python", "security-audit", "testing"]);
  expect(withTests.find(item => item.ns === "testing")!).toMatchObject({ methodologies: ["testing/tdd"], reasons: ["testing/tdd checks apply to 1 source file"] });
  expect(recommendPacks({ "main.py": "" }, ["Python"]).map(item => item.ns)).toEqual(["python", "security-audit"]);
  expect(recommendPacks({ "src/a.ts": "" }, ["TypeScript"]).map(item => item.ns)).toEqual(["clean-code", "typescript"]);
  expect(recommendPacks({ "src/a.ts": "", "src/a.test.ts": "" }, ["TypeScript"], ["clean-code/clean-code", "testing/tdd", "security-audit/obvious-sinks"]).map(item => item.ns)).toEqual(["typescript"]);
});

test("a methodology that reads the core layer is left out, and named, when the project has no core layer", () => {
  const files = { "package.json": '{"dependencies":{"dcouplr":"0.1.3"}}', "src/lib/a.ts": "export const a = 1;\n" };
  const dcouplr = recommendPacks(files, ["TypeScript"]).find(item => item.ns === "dcouplr")!;
  expect(dcouplr.methodologies).toEqual(["dcouplr/factories"]);
  expect(dcouplr.reasons.at(-1)).toBe("dcouplr/managed-components left out: it checks the core layer and this project declares none. Propose layers with pregate layers apply, then add it.");
  expect(recommendPacks(files, ["TypeScript"], [], true).find(item => item.ns === "dcouplr")!.methodologies).toEqual(["dcouplr/factories", "dcouplr/managed-components"]);
  const layered = { ...files, "src/domain/order.ts": "export const order = 1;\n", "src/infra/db.ts": "export const db = 1;\n" };
  expect(recommendPacks(layered, ["TypeScript"]).find(item => item.ns === "dcouplr")!.methodologies).toEqual(["dcouplr/factories", "dcouplr/managed-components"]);
});
