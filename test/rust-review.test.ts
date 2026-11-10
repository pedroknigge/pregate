import { beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { setUpGrammars } from "../src/assets.ts";
import { fixtureLock } from "../src/compile.ts";
import { dependencyReviews } from "../src/dependencies.ts";
import { analyze } from "../src/evaluate.ts";
import { imports, parse, type Parsed } from "../src/ts.ts";
import { resolve } from "../src/resolve.ts";
import { contextFile } from "../src/workspace.ts";
import type { Check, Files, Read } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

beforeAll(setUpGrammars);
const manifest = '[package]\nname = "rust_review"\nversion = "0.0.0"\nedition = "2021"\n';
const read = (files: Files): Read => path => files[path] ?? null;
const layerCheck: Check = { id: "review/rust/layers", version: "1.0.0", area: "dependencies", cardinality: "singleton", dimension: "deps.layers", minSeverity: null,
  params: {}, languages: ["rust"], impl: { kind: "primitive", primitive: "layer-edge" }, phase: ["pre", "stop", "commit", "ci"], feedback: { message: "Forbidden source dependency." } };
const policy = fixtureLock(layerCheck, {}, { layers: {
  domain: { paths: ["src/domain/**", "src/facade.rs"], mayImport: [], kind: "core" },
  infra: { paths: ["src/infra.rs", "src/std.rs"], mayImport: ["*"], kind: "adapter" },
} });
const facade: Files = { "Cargo.toml": manifest, "src/lib.rs": "pub mod domain; pub mod infra; pub mod facade;\n",
  "src/domain/mod.rs": "pub mod use_case; pub struct Value;\n", "src/domain/use_case.rs": "use crate::facade::Value; pub fn value() -> Value { Value }\n",
  "src/facade.rs": "pub use crate::domain::Value;\n", "src/infra.rs": "pub struct Value; pub struct Db<T>(pub T);\n" };
const generic: Files = { ...facade, "src/domain/use_case.rs": "pub fn accept(_: crate::infra::Db<u8>) {}\n" };
const leading: Files = { "Cargo.toml": manifest, "src/lib.rs": "pub mod domain; pub mod std;\n",
  "src/domain/mod.rs": "use ::std::vec::Vec; pub fn values() -> Vec<u8> { Vec::new() }\n", "src/std.rs": "pub mod vec { pub struct Vec; }\n" };

function direct(files: Files, path = "src/domain/use_case.rs") {
  return analyze(policy, "pre", path, files[path]!, { read: read(files), now: performance.now });
}

test("conventional Rust facade change retains the same new denial in direct and dependent importer review", () => {
  const after = { ...facade, "src/facade.rs": "pub use crate::infra::Value;\n" };
  expect(direct(facade)).toMatchObject({ violations: [] }); expect(direct(after)).toMatchObject({ violations: [{ line: 1 }] });
  for (const phase of ["pre", "stop", "commit", "ci"] as const) {
    const reviews = dependencyReviews(Object.keys(after), { lock: policy, phase, changed: new Set(["src/facade.rs"]), read: read(after), before: read(facade), now: performance.now });
    expect(reviews.find(review => review.rel === "src/domain/use_case.rs")).toMatchObject({ form: null, violations: [{ line: 1 }] });
  }
});

test("qualified generic parameter types carry their architectural dependency", () => {
  deletedAfter(parse("src/domain/use_case.rs", generic["src/domain/use_case.rs"]!), parsed => {
    expect(parsed.root.hasError).toBe(false); expect(imports(parsed)).toContainEqual({ spec: "crate::infra::Db", base: "", kind: "static", line: 1, literal: true });
  });
  expect(direct(generic)).toMatchObject({ violations: [{ line: 1 }] });
});

test("leading extern-prelude std paths cannot be mistaken for a local module", () => {
  expect(resolve("src/domain/mod.rs", "::std::vec::Vec", null, read(leading))).toBe("external");
  expect(direct(leading, "src/domain/mod.rs")).toMatchObject({ violations: [] });
});

test("inline self and super retain module context without inventing a physical file", () => {
  const files = { "Cargo.toml": manifest, "src/lib.rs": "pub mod infra; pub mod domain { pub mod nested { pub fn value() -> super::super::infra::Db<u8> { super::super::infra::Db(1) } } }\n", "src/infra.rs": facade["src/infra.rs"]! };
  expect(resolve("src/lib.rs", "super::super::infra::Db", null, read(files), "domain::nested")).toEqual({ rel: "src/infra.rs" });
  expect(resolve("src/lib.rs", "self::nested::value", null, read(files), "domain")).toEqual({ rel: "src/lib.rs" });
});

test("Cargo/root/module reads change resolution and do not retain stale source facts", () => {
  const files = { ...facade }, reads = new Set<string>(), reader: Read = path => { reads.add(path); return files[path] ?? null; };
  expect(resolve("src/domain/use_case.rs", "crate::facade::Value", null, reader)).toEqual({ rel: "src/facade.rs" });
  expect(reads.has("Cargo.toml")).toBe(true); expect(reads.has("src/lib.rs")).toBe(true);
  files["src/lib.rs"] = "pub mod domain; pub mod infra;\n";
  expect(resolve("src/domain/use_case.rs", "crate::facade::Value", null, reader)).toBe("unresolved");
  files["src/lib.rs"] = facade["src/lib.rs"]!; files["Cargo.toml"] = manifest + '[lib]\npath = "other.rs"\n';
  expect(resolve("src/domain/use_case.rs", "crate::facade::Value", null, reader)).toBe("unresolved");
});

test("shadow-only Rust import policy does not inventory or read an unchanged importer graph", () => {
  const shadow = { ...policy, enforcement: "shadow" as const };
  const reviews = dependencyReviews(() => { throw new Error("must not inventory"); }, { lock: shadow, phase: "pre", changed: new Set(["Cargo.toml"]),
    read: () => { throw new Error("must not read"); }, before: read(facade), now: performance.now });
  expect(reviews).toEqual([]);
});

test.each(["workspace", "patch", "replace", "config"])("unmodeled Cargo %s overrides are unresolved instead of an external dependency proof", mode => {
  const files: Files = { "Cargo.toml": manifest + '[dependencies]\nremote = "0.1"\n', "src/lib.rs": "use remote::Value; pub fn value() -> Value { Value }\n",
    "infra-crate/Cargo.toml": '[package]\nname = "remote"\nversion = "0.1.0"\nedition = "2021"\n', "infra-crate/src/lib.rs": "pub struct Value;\n" };
  if (mode === "workspace") files["Cargo.toml"] = manifest + '[dependencies]\nremote = { workspace = true }\n[workspace]\nmembers = ["infra-crate"]\n[workspace.dependencies]\nremote = { path = "infra-crate" }\n';
  if (mode === "patch") files["Cargo.toml"] += '[patch.crates-io]\nremote = { path = "infra-crate" }\n';
  if (mode === "replace") files["Cargo.toml"] += '[replace]\n"remote:0.1.0" = { path = "infra-crate" }\n';
  if (mode === "config") files[".cargo/config.toml"] = 'paths = ["infra-crate"]\n';
  expect(resolve("src/lib.rs", "remote::Value", null, read(files))).toBe("unresolved");
});

test("a parent workspace patch is a tracked resolver input for a member crate", () => {
  const files: Files = { "member/Cargo.toml": manifest + '[dependencies]\nremote = "0.1"\n', "member/src/lib.rs": "use remote::Value; pub fn value() -> Value { Value }\n",
    "Cargo.toml": '[workspace]\nmembers = ["member", "infra-crate"]\n[patch.crates-io]\nremote = { path = "infra-crate" }\n',
    "infra-crate/Cargo.toml": '[package]\nname = "remote"\nversion = "0.1.0"\nedition = "2021"\n', "infra-crate/src/lib.rs": "pub struct Value;\n" };
  const reads = new Set<string>(), reader: Read = path => { reads.add(path); return files[path] ?? null; };
  expect(resolve("member/src/lib.rs", "remote::Value", null, reader)).toBe("unresolved");
  expect(reads.has("Cargo.toml")).toBe(true);
  expect(contextFile(".cargo/config.toml")).toBe(true); expect(contextFile("member/.cargo/config")).toBe(true);
});

const rustcReady = Bun.which("rustc") !== null && Bun.spawnSync(["rustc", "--version"], { stdout: "pipe", stderr: "pipe" }).exitCode === 0;
test.skipIf(!rustcReady)("independent rustc accepts positive controls and rejects an unknown item", () => {
  removedAfter(mkdtempSync(join(tmpdir(), "pregate-rust-review-")), area => {
    const cases = [facade, { ...facade, "src/facade.rs": "pub use crate::infra::Value;\n" }, generic, leading];
    for (const [index, files] of cases.entries()) {
      const directory = join(area, String(index));
      for (const [path, text] of Object.entries(files)) { const target = join(directory, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, text); }
      const compiled = Bun.spawnSync(["rustc", "--edition=2021", "--crate-type=lib", "--emit=metadata", "--out-dir", directory, join(directory, "src/lib.rs")], { stdout: "pipe", stderr: "pipe", timeout: 30_000 });
      expect(compiled.exitCode, compiled.stderr.toString()).toBe(0);
    }
    const invalid = join(area, "invalid.rs"); writeFileSync(invalid, "pub fn value() -> crate::Missing { todo!() }\n");
    expect(Bun.spawnSync(["rustc", "--edition=2021", "--crate-type=lib", "--emit=metadata", "--out-dir", area, invalid], { stdout: "pipe", stderr: "pipe", timeout: 30_000 }).exitCode).not.toBe(0);
  });
});

function deletedAfter(parsed: Parsed, check: (parsed: Parsed) => void): void {
  try { check(parsed); } finally { parsed.root.tree.delete(); }
}

function removedAfter(area: string, use: (area: string) => void): void {
  try { use(area); } finally { removeTree(area); }
}
