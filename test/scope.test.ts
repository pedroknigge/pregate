import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectExclusions, gitignoreDirectories, gitmodulesPaths, type DirFacts, type ExcludeCandidate, type ExcludeFacts } from "../src/scope.ts";
import { scanExclusions } from "../src/exclude-scan.ts";
import { inScope } from "../src/paths.ts";
import type { Lock } from "../src/types.ts";

function dir(path: string, over: Partial<DirFacts> = {}): DirFacts {
  return { path, files: 1, generatedHeaders: 0, minified: 0, protobuf: 0, complete: true, ...over };
}

function facts(over: Partial<ExcludeFacts> = {}): ExcludeFacts {
  return { dirs: [], ignored: [], submodules: [], layerGlobs: [], excludeGlobs: [], cargoDirs: [], ...over };
}

function at(found: ExcludeCandidate[], path: string): ExcludeCandidate {
  const item = found.find((candidate) => candidate.path === path);
  if (item === undefined) throw new Error(`missing ${path}`);
  return item;
}

test("detection names each false-positive folder once, with a reason and evidence", () => {
  const found = detectExclusions(facts({
    dirs: [
      dir("vendor", { files: 4 }),
      dir("vendor/lib", { files: 4 }),
      dir("third_party"),
      dir("external"),
      dir("dist", { files: 312, generatedHeaders: 312 }),
      dir("build"),
      dir("out"),
      dir(".next"),
      dir("coverage"),
      dir("generated", { files: 2, generatedHeaders: 2 }),
      dir("api_pb", { files: 3, generatedHeaders: 3 }),
      dir("codegen", { files: 2, generatedHeaders: 0 }),
      dir("wire-codegen", { files: 2, generatedHeaders: 2 }),
      dir("node_modules", { files: 80 }),
      dir(".venv"),
      dir("pkg/target", { files: 10 }),
      dir("notes/target", { files: 1 }),
      dir("fixtures", { files: 6 }),
      dir("__snapshots__", { files: 2 }),
      dir("testdata", { files: 3 }),
      dir("assets", { files: 2, minified: 2 }),
      dir("public", { files: 2, minified: 1 }),
      dir("pb", { files: 1, protobuf: 1 }),
      dir("libs/dep"),
      dir("scratch", { files: 1 }),
      dir(".pregate"),
      dir(".git/objects"),
      dir("src", { files: 3 }),
    ],
    ignored: ["scratch", "dist"],
    submodules: ["libs/dep"],
    cargoDirs: ["pkg"],
  }));
  const paths = new Set(found.map((item) => item.path));
  expect(at(found, "vendor")).toMatchObject({ glob: "vendor/**", reason: "vendored code" });
  expect(at(found, "vendor").evidence).toContain("directory name vendor");
  expect(paths.has("vendor/lib")).toBe(false);
  expect(at(found, "third_party").reason).toBe("vendored code");
  expect(at(found, "external").reason).toBe("vendored code");
  expect(at(found, "dist")).toMatchObject({ reason: "generated output" });
  expect(at(found, "dist").evidence).toBe("contains 312 files with a @generated header");
  expect(at(found, "build").reason).toBe("generated output");
  expect(at(found, "out").reason).toBe("generated output");
  expect(at(found, ".next").glob).toBe(".next/**");
  expect(at(found, "coverage").reason).toBe("generated output");
  expect(at(found, "generated").evidence).toBe("contains 2 files with a @generated header");
  expect(at(found, "api_pb").reason).toBe("generated output");
  expect(paths.has("codegen")).toBe(false);
  expect(at(found, "wire-codegen").evidence).toContain("@generated header");
  expect(at(found, "node_modules").reason).toBe("dependency directory");
  expect(at(found, ".venv").reason).toBe("dependency directory");
  expect(at(found, "pkg/target").reason).toBe("dependency directory");
  expect(paths.has("notes/target")).toBe(false);
  expect(at(found, "fixtures").reason).toBe("test fixtures and snapshots");
  expect(at(found, "__snapshots__").reason).toBe("test fixtures and snapshots");
  expect(at(found, "testdata").reason).toBe("test fixtures and snapshots");
  expect(at(found, "assets")).toMatchObject({ reason: "minified bundle", evidence: "contains 2 minified files" });
  expect(paths.has("public")).toBe(false);
  expect(at(found, "pb").evidence).toBe("contains 1 generated protobuf file");
  expect(at(found, "libs/dep")).toMatchObject({ reason: "git submodule", evidence: "git submodule" });
  expect(at(found, "scratch")).toMatchObject({ reason: "listed in .gitignore", evidence: "gitignore lists scratch/" });
  expect(paths.has(".pregate")).toBe(false);
  expect(paths.has(".git/objects")).toBe(false);
  expect(paths.has("src")).toBe(false);
  expect(found.map((item) => item.path)).toEqual([...found.map((item) => item.path)].sort());
});

test("the same facts always return the same candidates", () => {
  const input = facts({
    dirs: [dir("vendor", { files: 2 }), dir("dist", { files: 4, generatedHeaders: 4 })],
    submodules: ["libs/dep"],
  });
  const forward = detectExclusions(input);
  const reverse = detectExclusions({ ...input, dirs: [...input.dirs].reverse() });
  expect(reverse).toEqual(forward);
  expect(JSON.stringify(detectExclusions(input))).toBe(JSON.stringify(forward));
});

test("a layer path and an existing exclude are not proposed", () => {
  const found = detectExclusions(facts({
    dirs: [
      dir("src"), dir("src/domain"), dir("src/domain/generated", { files: 2, generatedHeaders: 2 }),
      dir("src/generated", { files: 2, generatedHeaders: 2 }), dir("dist", { files: 1 }),
    ],
    layerGlobs: ["src/domain/**"],
    excludeGlobs: ["dist/**"],
  }));
  expect(found.map((item) => item.path)).toEqual(["src/generated"]);
});

test("gitignore directory patterns name only folders that exist", () => {
  const text = "# build output\ndist/\n!keep/\n*.log\n/secret/\nvendor\n**/coverage/\n";
  expect(gitignoreDirectories(text, "", ["dist", "src/dist", "secret", "vendor", "keep", "coverage", "web/coverage"])).toEqual([
    "coverage", "dist", "secret", "src/dist", "vendor", "web/coverage",
  ]);
  expect(gitignoreDirectories("/dist/\n", "packages/app", ["packages/app/dist", "other/dist"])).toEqual(["packages/app/dist"]);
  expect(gitmodulesPaths('[submodule "dep"]\n\tpath = libs/dep\n\tpath = ../outside\n')).toEqual(["libs/dep"]);
});

test("a real tree reports generated headers, a gitignored folder and a Cargo target", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-scope-"));
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "dist/app.js"), "/* @generated */\nfunction bad(a, b, c, d, e, f) { return a; }\n");
  writeFileSync(join(root, "dist/other.js"), "// Code generated by tool. DO NOT EDIT.\nexport const n = 1;\n");
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/app.ts"), "export const n = 1;\n");
  mkdirSync(join(root, "scratch"));
  writeFileSync(join(root, "scratch/out.js"), "export const n = 1;\n");
  writeFileSync(join(root, ".gitignore"), "scratch/\n");
  mkdirSync(join(root, "pkg"));
  writeFileSync(join(root, "pkg/Cargo.toml"), "[package]\nname = \"pkg\"\n");
  mkdirSync(join(root, "pkg/target"));
  writeFileSync(join(root, "pkg/target/lib.rs"), "fn main() {}\n");
  const found = scanExclusions(root, { layerGlobs: ["src/**"], excludeGlobs: [] });
  expect(at(found, "dist").evidence).toBe("contains 2 files with a @generated header");
  expect(at(found, "scratch").reason).toBe("listed in .gitignore");
  expect(at(found, "pkg/target").reason).toBe("dependency directory");
  expect(found.some((item) => item.path === "src")).toBe(false);
});

test("inScope skips an accepted folder and still analyzes source", () => {
  const lock = { scope: { include: ["**"], exclude: ["dist/**", "vendor/**"] } } as Lock;
  expect(inScope(lock, "dist/app.js")).toBe(false);
  expect(inScope(lock, "vendor/lib.js")).toBe(false);
  expect(inScope(lock, "src/app.ts")).toBe(true);
});
