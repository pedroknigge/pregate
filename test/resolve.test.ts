import { beforeAll, describe, expect, test } from "bun:test";
import { setUpGrammars } from "../src/assets.ts";
import { fixtureLock } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { dependencyReviews } from "../src/dependencies.ts";
import { clock } from "../src/gate.ts";
import { loadTsPaths, reexportTargets, resolve, tsconfigNotice } from "../src/resolve.ts";
import type { Check, Files, Read } from "../src/types.ts";
import { reader as workspaceReader } from "../src/workspace.ts";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTree } from "./remove-tree.ts";

beforeAll(setUpGrammars);

const reader = (files: Files): Read => (rel) => files[rel] ?? null;

function withRestore(use: () => void, restore: () => void): void {
  try { use(); } finally { restore(); }
}

describe("resolve", () => {
  const files: Files = {
    "src/domain/order.ts": "", "src/domain/kernel/index.ts": "", "src/infra/db.tsx": "", "src/lib/legacy.js": "",
    "src/shared/util.mts": "", "src/data.json": "{}",
  };
  test("relative paths: extensions, .js written for .ts, folder index, path-based when missing", () => {
    const table: [string, string, string][] = [
      ["src/application/a.ts", "../domain/order", "src/domain/order.ts"],
      ["src/application/a.ts", "../domain/order.js", "src/domain/order.ts"],
      ["src/application/a.ts", "../infra/db.jsx", "src/infra/db.tsx"],
      ["src/application/a.ts", "../shared/util.mjs", "src/shared/util.mts"],
      ["src/application/a.ts", "../lib/legacy.js", "src/lib/legacy.js"],
      ["src/application/a.ts", "../domain/kernel", "src/domain/kernel/index.ts"],
      ["src/application/a.ts", "../data.json", "src/data.json"],
      ["src/application/a.ts", "./not-written-yet", "src/application/not-written-yet"],
      ["src/a.ts", ".", "src"],
    ];
    for (const [from, spec, rel] of table) expect(`${spec} ${JSON.stringify(resolve(from, spec, null, reader(files)))}`).toBe(`${spec} {"rel":"${rel}"}`);
    expect(resolve("src/a.ts", "../../outside", null, reader(files))).toBe("unresolved");
  });

  test("bare specifiers: builtins and npm names are external; aliases without a match are unresolved", () => {
    const table: [string, string][] = [
      ["fs", "external"], ["node:fs/promises", "external"], ["bun:sqlite", "external"], ["@prisma/client/runtime/library", "external"],
      ["lodash.merge", "external"], ["#internal", "unresolved"], ["~/lib/x", "unresolved"], ["@/infra/db", "unresolved"],
    ];
    for (const [spec, expected] of table) expect(`${spec} ${resolve("src/a.ts", spec, null, reader(files))}`).toBe(`${spec} ${expected}`);
  });

  // Each one loads src/infra/db from src/domain in Node or Bun, while its text points elsewhere.
  test("specifiers the runtime reads differently from their text are unresolved", () => {
    const ts = { baseUrl: null, paths: [{ pattern: "@domain/*", targets: ["src/domain/*"] }] };
    const own = { ...files, "package.json": JSON.stringify({ name: "app", exports: { "./*": "./src/*" } }) };
    const table: [string, string][] = [
      ["anything/../../src/infra/db.js", "unresolved"],               // `..` after the package root
      ["../infra/db.mjs?x=/../../domain/ok.mjs", "unresolved"],       // the query is dropped, not joined
      ["../infra/db.mjs#/../../domain/ok.mjs", "unresolved"],         // so is the fragment
      ["..\\infra\\db", "unresolved"],
      ["@domain/../infra/db", "unresolved"],                          // the alias wildcard holds a `..`
      ["app/infra/db.mjs", "unresolved"],                             // the package imports itself by name
      ["app-two/x", "external"], ["@app/x", "external"],
    ];
    for (const [spec, expected] of table) expect(`${spec} ${JSON.stringify(resolve("src/domain/a.ts", spec, ts, reader(own)))}`).toBe(`${spec} "${expected}"`);
    const glued = { baseUrl: null, paths: [{ pattern: "@d*", targets: ["src/domain/*"] }] };
    expect(resolve("src/domain/a.ts", "@d../infra/db", glued, reader(files))).toEqual({ rel: "src/infra/db.tsx" });
  });

  test("tsconfig paths (longest prefix, first existing target) and baseUrl", () => {
    const tsconfig = `{
      // comments and trailing commas are fine (JSONC)
      "compilerOptions": {
        "baseUrl": "src",
        "paths": { "@/*": ["*"], "@/infra/*": ["missing/*", "infra/*"], "#db": ["infra/db"], },
      },
    }`;
    const ts = loadTsPaths(reader({ ...files, "tsconfig.json": tsconfig }));
    expect(ts).toEqual({
      baseUrl: "src",
      paths: [{ pattern: "@/*", targets: ["src/*"] }, { pattern: "@/infra/*", targets: ["src/missing/*", "src/infra/*"] }, { pattern: "#db", targets: ["src/infra/db"] }],
    });
    const at = (spec: string) => resolve("src/application/a.ts", spec, ts as Exclude<typeof ts, "invalid">, reader(files));
    expect(at("@/domain/order")).toEqual({ rel: "src/domain/order.ts" });
    expect(at("@/infra/db")).toEqual({ rel: "src/infra/db.tsx" });
    expect(at("#db")).toEqual({ rel: "src/infra/db.tsx" });
    expect(at("@/domain/new-file")).toEqual({ rel: "src/domain/new-file" });
    expect(at("domain/order")).toEqual({ rel: "src/domain/order.ts" });   // baseUrl
    expect(at("zod")).toBe("external");
  });

  test("@/* resolves Next.js dynamic segments and a directory index", () => {
    const tree: Files = {
      "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
      "src/app/api/projects/[projectCode]/drawings/catalog/handler.ts": "export const catalog = 1;\n",
      "src/app/api/projects/[projectCode]/drawings/[...path]/load.ts": "export const load = 1;\n",
      "src/app/api/projects/[[...slug]]/page.ts": "export const page = 1;\n",
      "src/lib/db/schema/index.ts": "export const users = 1;\n",
    };
    const ts = loadTsPaths(reader(tree));
    const from = "src/app/api/projects/[projectCode]/drawings/[...path]/route.ts";
    const at = (spec: string) => resolve(from, spec, ts, reader(tree));
    expect(at("@/app/api/projects/[projectCode]/drawings/catalog/handler")).toEqual({ rel: "src/app/api/projects/[projectCode]/drawings/catalog/handler.ts" });
    expect(at("@/app/api/projects/[projectCode]/drawings/[...path]/load")).toEqual({ rel: "src/app/api/projects/[projectCode]/drawings/[...path]/load.ts" });
    expect(at("@/app/api/projects/[[...slug]]/page")).toEqual({ rel: "src/app/api/projects/[[...slug]]/page.ts" });
    expect(at("@/lib/db/schema")).toEqual({ rel: "src/lib/db/schema/index.ts" });
    expect(at("@/lib/db/schema/index")).toEqual({ rel: "src/lib/db/schema/index.ts" });
    expect(at("../catalog/handler")).toEqual({ rel: "src/app/api/projects/[projectCode]/drawings/catalog/handler.ts" });
    const both = { ...tree, "src/lib/db/schema.ts": "export const users = 2;\n" };
    expect(resolve(from, "@/lib/db/schema", loadTsPaths(reader(both)), reader(both))).toEqual({ rel: "src/lib/db/schema.ts" });
  });

  test("extends: the config wins over its parents, the later over the earlier; paths are relative to baseUrl, else to their config", () => {
    const tree = {
      ...files,
      "tsconfig.json": JSON.stringify({ extends: ["./configs/a.json", "./configs/b"], compilerOptions: {} }),
      "configs/a.json": JSON.stringify({ compilerOptions: { paths: { "@a/*": ["a/*"] }, baseUrl: "../src" } }),
      "configs/b.json": JSON.stringify({ compilerOptions: { paths: { "@b/*": ["b/*"] } } }),
    };
    expect(loadTsPaths(reader(tree))).toEqual({ baseUrl: "src", paths: [{ pattern: "@b/*", targets: ["src/b/*"] }] });
    const noBase = { ...tree, "configs/a.json": "{}" };
    expect(loadTsPaths(reader(noBase))).toEqual({ baseUrl: null, paths: [{ pattern: "@b/*", targets: ["configs/b/*"] }] });
    const shared = { ...files, "tsconfig.json": JSON.stringify({ extends: "@acme/tsconfig" }), "node_modules/@acme/tsconfig/tsconfig.json": "{}" };
    expect(loadTsPaths(reader(shared))).toEqual({ baseUrl: null, paths: [] });
  });

  test("tsconfig: absent is null; unreadable, a missing local extends or a cycle is invalid, and makes bare specifiers unresolved", () => {
    expect(loadTsPaths(reader(files))).toBeNull();
    const invalid: Files[] = [
      { "tsconfig.json": "{ not json" },
      { "tsconfig.json": JSON.stringify({ extends: "./base.json" }) },
      { "tsconfig.json": JSON.stringify({ extends: "@acme/tsconfig" }), "node_modules/@acme/tsconfig/package.json": "{}" },
      { "tsconfig.json": JSON.stringify({ extends: "tsconfig.base.json" }), "tsconfig.base.json": "{}" },
      { "tsconfig.json": JSON.stringify({ extends: "./a.json" }), "a.json": JSON.stringify({ extends: "./tsconfig.json" }) },
      { "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": "src/*" } } }) },
    ];
    for (const tree of invalid) expect(loadTsPaths(reader(tree))).toBe("invalid");
    expect(resolve("src/a.ts", "zod", "invalid", reader(files))).toBe("unresolved");
    expect(resolve("src/application/a.ts", "../domain/order", "invalid", reader(files))).toEqual({ rel: "src/domain/order.ts" });
  });

  // A fresh clone of a repo whose tsconfig extends an npm preset (sindresorhus/ky) is not broken.
  test("tsconfig: an extended package that is not installed is named, and the rest of the chain still applies", () => {
    const ky = { ...files, "tsconfig.json": JSON.stringify({ extends: "@sindresorhus/tsconfig", compilerOptions: { exactOptionalPropertyTypes: true } }) };
    expect(loadTsPaths(reader(ky))).toEqual({ baseUrl: null, paths: [], missing: ["@sindresorhus/tsconfig"] });
    expect(resolve("src/domain/a.ts", "zod", loadTsPaths(reader(ky)), reader(ky))).toBe("external");
    expect(resolve("src/domain/a.ts", "@/infra/db", loadTsPaths(reader(ky)), reader(ky))).toBe("unresolved");
    expect(tsconfigNotice(reader(ky))).toBe("tsconfig extends @sindresorhus/tsconfig, which is not installed; run your package manager install for exact import resolution.");
    const own = { ...files, "tsconfig.json": JSON.stringify({ extends: ["@a/base", "./configs/b.json"], compilerOptions: { paths: { "@/*": ["*"] } } }),
      "configs/b.json": JSON.stringify({ extends: "@b/strict/tsconfig.json", compilerOptions: { baseUrl: "../src" } }) };
    const ts = loadTsPaths(reader(own));
    expect(ts).toEqual({ baseUrl: "src", paths: [{ pattern: "@/*", targets: ["src/*"] }], missing: ["@b/strict/tsconfig.json", "@a/base"] });
    expect(resolve("src/application/a.ts", "@/infra/db", ts, reader(own))).toEqual({ rel: "src/infra/db.tsx" });
    expect(tsconfigNotice(reader(own))).toContain("@b/strict/tsconfig.json, @a/base, which are not installed");
    expect(tsconfigNotice(reader({ ...files, "tsconfig.json": "{}" }))).toBeNull();
    expect(tsconfigNotice(reader({ ...files, "tsconfig.json": JSON.stringify({ extends: "./gone.json" }) }))).toBeNull();
  });

  // TypeScript finds a preset in any node_modules from the extending config up: one only there must
  // not pass as uninstalled, or its paths would hide an alias (`lib/db` read as the npm package lib).
  test("tsconfig: a preset installed in a nested node_modules is read, and a broken one there is invalid", () => {
    const nested = { ...files, "tsconfig.json": JSON.stringify({ extends: "./configs/base.json" }),
      "configs/base.json": JSON.stringify({ extends: "@x/cfg" }),
      "configs/node_modules/@x/cfg/tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "lib/*": ["../../../../src/infra/*"] } } }) };
    const ts = loadTsPaths(reader(nested));
    expect(ts).toEqual({ baseUrl: null, paths: [{ pattern: "lib/*", targets: ["src/infra/*"] }] });
    expect(resolve("src/domain/a.ts", "lib/db", ts, reader(nested))).toEqual({ rel: "src/infra/db.tsx" });
    const { "configs/node_modules/@x/cfg/tsconfig.json": _, ...broken } = nested;
    expect(loadTsPaths(reader({ ...broken, "configs/node_modules/@x/cfg/package.json": "{}" }))).toBe("invalid");
  });

  test("tsconfig: pre-commit reads an untracked installed preset from disk, not as uninstalled", () => {
    const root = mkdtempSync(join(tmpdir(), "pregate-staged-ts-"));
    withRestore(() => {
      writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ extends: "@x/cfg" }));
      mkdirSync(join(root, "node_modules/@x/cfg"), { recursive: true });
      writeFileSync(join(root, "node_modules/@x/cfg/tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: "../../.." } }));
      for (const args of [["init", "-q"], ["add", "tsconfig.json"]]) Bun.spawnSync(["git", "-C", root, ...args]);
      expect(loadTsPaths(workspaceReader(root, true))).toEqual({ baseUrl: "", paths: [] });
    }, () => removeTree(root));
  });
});

describe("reexportTargets", () => {
  const chain = (n: number): Files => Object.fromEntries(Array.from({ length: n }, (_, i) =>
    [`src/m${i}.ts`, i + 1 < n ? `export * from "./m${i + 1}";\nexport { x } from "node:fs";\n` : "export const end = 1;\n"]));

  test("follows export…from through local modules up to three hops; a fourth is too deep", () => {
    expect(reexportTargets("src/m0.ts", null, reader(chain(3)))).toEqual([
      { spec: "./m1", to: { rel: "src/m1.ts" } }, { spec: "node:fs", to: "external" },
      { spec: "./m2", to: { rel: "src/m2.ts" } }, { spec: "node:fs", to: "external" },
    ]);
    expect(reexportTargets("src/m0.ts", null, reader(chain(4)))).toHaveLength(6);
    expect(reexportTargets("src/m0.ts", null, reader(chain(5)))).toBe("too-deep");
  });

  test("more than 32 files is too deep; cycles, plain imports and missing modules end the chain", () => {
    const wide: Files = { "src/barrel.ts": Array.from({ length: 33 }, (_, i) => `export * from "./w${i}";`).join("\n") };
    for (let i = 0; i < 33; i++) wide[`src/w${i}.ts`] = "export const w = 1;\n";
    expect(reexportTargets("src/barrel.ts", null, reader(wide))).toBe("too-deep");
    const cycle = { "src/a.ts": 'export * from "./b";', "src/b.ts": 'export * from "./a";\nimport { y } from "../infra/y";' };
    expect(reexportTargets("src/a.ts", null, reader(cycle))).toEqual([
      { spec: "./b", to: { rel: "src/b.ts" } }, { spec: "./a", to: { rel: "src/a.ts" } },
    ]);
    expect(reexportTargets("src/gone.ts", null, reader({}))).toEqual([]);
    expect(reexportTargets("src/data.json", null, reader({ "src/data.json": "{}" }))).toEqual([]);
  });

  test("a module with a parse error is too deep: error recovery can hide its export…from", () => {
    const hidden = ['class A {\nexport * from "./db";\n}\n', 'function f( {\nexport * from "./db";\n', 'export * from "./db";\n<<<<<<< HEAD\n'];
    for (const text of hidden) expect(reexportTargets("src/barrel.ts", null, reader({ "src/barrel.ts": text, "src/db.ts": "" }))).toBe("too-deep");
  });
});

// The consequence the rules test cannot show: in a restricted layer an import that cannot be
// established denies by form instead of passing silently (ARCHITECTURE §7.2 #12).
describe("analyze: unresolvable imports in a restricted layer", () => {
  const check: Check = {
    id: "core/dependencies/layer-direction", version: "1.0.0", area: "dependencies", cardinality: "singleton",
    dimension: "deps.layers", minSeverity: null, params: {}, impl: { kind: "primitive", primitive: "layer-edge" },
    phase: ["pre", "stop", "commit", "ci"], feedback: { message: "{symbol} imports across layers." },
  };
  const layers = {
    domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" as const },
    main: { paths: ["src/main.ts"], mayImport: ["*"], kind: "main" as const },
  };
  const lock = fixtureLock(check, {}, { layers });
  const run = (rel: string, text: string, files: Files = {}) => analyze(lock, "pre", rel, text, { read: reader(files), now: clock });

  test("dependency review skips plain exports and still follows import and re-export changes", () => {
    const runtime = require("../vendor/web-tree-sitter/web-tree-sitter.js") as typeof import("web-tree-sitter");
    const original = runtime.Parser.prototype.parse;
    let parses = 0;
    withRestore(() => {
      runtime.Parser.prototype.parse = function (...args: Parameters<typeof original>) {
        parses++; return original.apply(this, args);
      };
      for (const text of ["export function value() { return 1; }", "export const value = 1;", "export default class Value {}"])
        for (const rel of ["src/domain/plain.ts", "src/domain/plain.tsx"]) {
          const before = parses;
          expect(dependencyReviews([rel], { lock, phase: "pre", changed: new Set(["tsconfig.json"]),
            read: reader({ [rel]: text }), before: reader({ [rel]: text }), now: clock })).toEqual([]);
          expect(parses).toBe(before);
        }
      const changed = new Set(["tsconfig.json"]);
      for (const text of ['import { x } from "dep";', 'export { x } /* gap */ from "dep";', 'export * from "dep";',
        'export const x = import("dep");', 'export const x = require("dep");', 'export const x = module.require("dep");']) {
        const rel = "src/domain/use.ts";
        const files = { [rel]: text, "src/domain/db.ts": "export const x = 1;", "src/infra/db.ts": "export const x = 1;" };
        const config = (dir: string) => JSON.stringify({ compilerOptions: { paths: { dep: [`src/${dir}/db`] } } });
        const before = parses;
        const result = dependencyReviews([rel], { lock, phase: "pre", changed,
          read: reader({ ...files, "tsconfig.json": config("infra") }),
          before: reader({ ...files, "tsconfig.json": config("domain") }), now: clock });
        expect(parses).toBeGreaterThan(before);
        expect(result).toMatchObject([{ rel, form: null, violations: [{ line: 1 }] }]);
      }
    }, () => { runtime.Parser.prototype.parse = original; });
  });

  test("unresolved alias, too-deep chain or invalid tsconfig ⇒ unresolvable-import at the import line", () => {
    expect(run("src/domain/a.ts", 'import { x } from "zod";\nimport { y } from "@/infra/y";\n')).toEqual({ cause: "unresolvable-import", line: 2 });
    expect(run("src/domain/a.ts", 'import { m } from "./m0";\n', Object.fromEntries(Array.from({ length: 5 }, (_, i) =>
      [`src/domain/m${i}.ts`, `export * from "./m${i + 1}";`])))).toEqual({ cause: "unresolvable-import", line: 1 });
    expect(run("src/domain/a.ts", 'import { x } from "zod";\n', { "tsconfig.json": "{" })).toEqual({ cause: "unresolvable-import", line: 1,
      detail: expect.stringContaining("tsconfig.json, or a local config it extends, is missing or invalid") });
    expect(run("src/domain/a.ts", 'import { x } from "./x?raw";\n', { "tsconfig.json": "{" })).toEqual({ cause: "unresolvable-import", line: 1 });
  });

  test("an uninstalled tsconfig preset leaves package imports judged and aliases still unresolvable", () => {
    const ky = { "tsconfig.json": JSON.stringify({ extends: "@sindresorhus/tsconfig" }), "src/domain/b.ts": "export const b = 1;\n" };
    expect(run("src/domain/a.ts", 'import { x } from "zod";\nimport { b } from "./b";\n', ky)).toMatchObject({ violations: [] });
    expect(run("src/domain/a.ts", 'import { x } from "~/infra/x";\n', ky)).toEqual({ cause: "unresolvable-import", line: 1 });
    expect(run("src/domain/a.ts", 'import { x } from "zod";\n', { "tsconfig.json": JSON.stringify({ extends: "./missing.json" }) })).toMatchObject({ cause: "unresolvable-import", line: 1 });
  });

  test("a restricted layer resolves @/* through Next.js segments and a schema index", () => {
    const route = "src/app/api/projects/[projectCode]/drawings/[...path]/route.ts";
    const text = [
      'import { catalog } from "@/app/api/projects/[projectCode]/drawings/catalog/handler";',
      'import { load } from "@/app/api/projects/[projectCode]/drawings/[...path]/load";',
      'import { users } from "@/lib/db/schema";',
      "export function GET() { return { catalog, load, users }; }",
      "",
    ].join("\n");
    const files: Files = {
      "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
      [route]: text,
      "src/app/api/projects/[projectCode]/drawings/catalog/handler.ts": "export const catalog = { id: \"catalog\" };\n",
      "src/app/api/projects/[projectCode]/drawings/[...path]/load.ts": "export const load = { id: \"load\" };\n",
      "src/lib/db/schema/index.ts": "export const users = { id: \"users\" };\n",
    };
    const layered = fixtureLock(check, {}, { layers: {
      domain: { paths: ["src/lib/**"], mayImport: [], kind: "core" },
      app: { paths: ["src/app/**"], mayImport: ["domain"], kind: "adapter" },
    } });
    const result = analyze(layered, "stop", route, text, { read: reader(files), now: clock });
    expect(result).toMatchObject({ violations: [] });
    const missing = run("src/domain/a.ts", 'import { missing } from "@/app/api/projects/[projectCode]/missing";\n', {
      "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    });
    expect(missing).not.toMatchObject({ cause: "unresolvable-import" });
    expect(run("src/domain/a.ts", 'import { missing } from "~/not-a-module";\n', files)).toEqual({ cause: "unresolvable-import", line: 1 });
  });

  test("outside a restricted layer the same imports are not judged", () => {
    expect(run("src/main.ts", 'import { y } from "@/infra/y";\n')).toMatchObject({ violations: [] });
    expect(run("scripts/a.ts", 'import { y } from "@/infra/y";\n')).toMatchObject({ violations: [] });
  });

  // The runtime ignores tsconfig paths: `fs` is node's fs even when a catch-all alias maps it to a file.
  test("banned-import judges the package name even when an alias makes it local", () => {
    const banned: Check = {
      ...check, id: "core/dependencies/banned-imports", impl: { kind: "primitive", primitive: "banned-import" },
      params: { packages: { type: "array", items: { type: "string" } } },
    };
    const lock = fixtureLock(banned, { paths: ["src/domain/**"], packages: ["fs"] }, { layers });
    const files = { "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "*": ["types/*"] } } }) };
    expect(analyze(lock, "pre", "src/domain/a.ts", 'import fs from "fs";\n', { read: reader(files), now: clock })).toMatchObject({ violations: [{ line: 1 }] });
  });
});
