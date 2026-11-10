import { beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { BUILTIN, setUpGrammars } from "../src/assets.ts";
import { auditFile, auditRules } from "../src/audit.ts";
import { compile, fixtureLock, listChecks } from "../src/compile.ts";
import { analyze, placement } from "../src/evaluate.ts";
import { testCheck } from "../src/fixtures.ts";
import { librarySource, librarySources } from "../src/library.ts";
import { missingLanguagePolicy } from "../src/languages.ts";
import { markerLocations } from "../src/markers.ts";
import { detectStack, onboardingPreset, scopeCoverage } from "../src/onboard.ts";
import { introduced } from "../src/ratchet.ts";
import { reexportTargets, resolve } from "../src/resolve.ts";
import { classes, errorIn, functions, imports, nestings, parse } from "../src/ts.ts";
import { contextFile, workspacePaths } from "../src/workspace.ts";
import type { Check, Files, Impl, Read } from "../src/types.ts";
import pkg from "../package.json" with { type: "json" };
import { removeTree } from "./remove-tree.ts";

beforeAll(setUpGrammars);
const read = (files: Files): Read => path => files[path] ?? null;
const now = performance.now;
const manifest = '[package]\nname="fixture"\nversion="0.0.0"\nedition="2021"\n';
const base: Files = { "Cargo.toml": manifest, "src/lib.rs": "pub mod domain; pub mod infra;\n",
  "src/domain/mod.rs": "pub mod value; pub struct Local;\n", "src/domain/value.rs": "pub fn value() {}\n",
  "src/infra.rs": "pub struct Store<T>(pub T); impl<T> Store<T> { pub fn load() {} }\n" };
const layer = { domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" as const },
  infra: { paths: ["src/infra.rs"], mayImport: ["*"], kind: "adapter" as const } };
function check(impl: Impl): Check {
  return { id: "example/rust/source", version: "1.0.0", area: "source", cardinality: "multi", dimension: "rust.source",
    minSeverity: null, languages: ["rust"], params: impl.kind === "primitive" && impl.primitive === "metric" ? { max: { type: "integer", minimum: 0 } }
      : impl.kind === "primitive" && impl.primitive === "banned-import" ? { packages: { type: "array", items: { type: "string" } } } : {},
    impl, phase: ["pre", "stop", "commit", "ci"], feedback: { message: "{symbol} breaks the reviewed source policy." } };
}
function parsed(text: string, run: (p: ReturnType<typeof parse>) => void) {
  inspectedTree(parse("src/domain/value.rs", text), p => { expect(errorIn(p, null)).toBeNull(); run(p); });
}
function inspectedTree(p: ReturnType<typeof parse>, inspect: (p: ReturnType<typeof parse>) => void) {
  try { inspect(p); } finally { p.root.tree.delete(); }
}

test("Rust function and trait signatures preserve receiver/tuple/closure semantics", () => {
  parsed("trait Store { fn get(&self, id:u64)->bool; }\nimpl Client { fn read(self: Box<Self>, (a,b):(u64,u64)) { let task = |value| { if true { loop {} } }; } }\n", p => {
    expect(functions(p).map(f => [f.symbol, f.params])).toEqual([["Store.get", 1], ["Client.read", 2], ["Client.read.task", 1]]);
    expect(classes(p)).toEqual([]);
    expect(nestings(p).map(n => [n.symbol, n.measured])).toEqual([["Client.read.task", 1], ["Client.read.task", 2]]);
  });
  parsed("fn f() {\n /* outer\n    /* nested */\n */\n let value = 1;\n}\n", p => expect(functions(p)[0]?.lines).toBe(3));
});

test("Rust grouped imports keep origins and inline module context", () => {
  parsed("mod nested { use crate::{domain::{self, Local as Model}, infra::*}; extern crate std as system; }\n", p => {
    expect(imports(p).map(i => [i.spec, i.base])).toEqual([["crate::domain", "nested"], ["crate::domain::Local", "nested"], ["crate::infra::*", "nested"], ["std", "nested"]]);
  });
});

test("Canonical calls and generic argument types reach their owner, associated type names remain unguessed", () => {
  parsed("fn f<T>() { crate::infra::Store::<u32>::load(); let _: Option<crate::infra::Store<u8>> = None; let _ = T::Assoc::new(); let _ = Local::new(); }\n", p => {
    expect(imports(p).map(i => i.spec)).toEqual(["crate::infra::Store::load", "crate::infra::Store"]);
  });
  const policy = fixtureLock(check({ kind: "primitive", primitive: "layer-edge" }), {}, { layers: layer });
  const source = "pub fn f() { crate::infra::Store::<u32>::load(); }\n";
  expect(analyze(policy, "pre", "src/domain/value.rs", source, { read: read({ ...base, "src/domain/value.rs": source }), now })).toMatchObject({ violations: [{ line: 1 }] });
});

test("Rust explicit module resolution rejects missing, ambiguous, custom and conditional trees", () => {
  expect(resolve("src/domain/value.rs", "super::Local", null, read(base))).toEqual({ rel: "src/domain/mod.rs" });
  expect(resolve("src/domain/value.rs", "crate::infra::Store", null, read(base))).toEqual({ rel: "src/infra.rs" });
  expect(resolve("src/domain/value.rs", "crate::missing::Store", null, read(base))).toBe("unresolved");
  expect(resolve("src/domain/value.rs", "super::Missing", null, read(base))).toBe("unresolved");
  expect(resolve("src/domain/value.rs", "super::super::super::infra::Store", null, read(base))).toBe("unresolved");
  for (const changes of [
    { "src/domain.rs": "pub mod value;\n" },
    { "Cargo.toml": manifest + '[lib]\npath="src/custom.rs"\n' },
    { "src/lib.rs": '#[cfg(feature="storage")] pub mod infra; pub mod domain;\n' },
    { "src/lib.rs": '#[path="other.rs"] pub mod infra; pub mod domain;\n' },
    { "Cargo.toml": manifest.replace('edition="2021"', 'edition="2015"') },
    { "src/lib.rs": 'include!("generated.rs"); pub mod domain; pub mod infra;\n' },
  ] as Files[]) expect(resolve("src/domain/value.rs", "crate::infra::Store", null, read({ ...base, ...changes }))).toBe("unresolved");
  expect(resolve("src/domain/value.rs", "crate::infra::Store", null, read({ ...base, "src/lib.rs": "#![no_std]\npub mod domain; pub mod infra;\n" }))).toEqual({ rel: "src/infra.rs" });
});

test("Nested Cargo ownership and names lib/main retain their real module paths", () => {
  const files = { ...base, "nested/Cargo.toml": manifest, "nested/src/lib.rs": "pub mod domain; pub mod infra;\n",
    "nested/src/domain/mod.rs": "pub mod value; pub mod lib;\n", "nested/src/domain/value.rs": "pub fn value() {}\n",
    "nested/src/domain/lib.rs": "pub struct Local;\n", "nested/src/infra.rs": "pub struct Store;\n" };
  expect(resolve("nested/src/domain/value.rs", "super::lib::Local", null, read(files))).toEqual({ rel: "nested/src/domain/lib.rs" });
  expect(resolve("nested/src/domain/lib.rs", "crate::infra::Store", null, read(files))).toEqual({ rel: "nested/src/infra.rs" });
});

test("Rust2018 bare use is relative to the current module, with alias shadows kept unknown", () => {
  const files = { ...base, "src/domain/mod.rs": "pub mod value; pub mod infra; use infra::Value;\n", "src/infra.rs": "pub struct Value;\n", "src/domain/infra.rs": "pub struct Value;\n" };
  expect(resolve("src/domain/mod.rs", "infra::Value", null, read(files))).toEqual({ rel: "src/domain/infra.rs" });
  const policy = fixtureLock(check({ kind: "primitive", primitive: "layer-edge" }), {}, { layers: {
    domain: { paths: ["src/domain/mod.rs", "src/domain/value.rs"], mayImport: ["ports"], kind: "core" },
    ports: { paths: ["src/infra.rs"], mayImport: [], kind: "port" },
    forbidden: { paths: ["src/domain/infra.rs"], mayImport: [], kind: "adapter" },
  } });
  expect(analyze(policy, "pre", "src/domain/mod.rs", files["src/domain/mod.rs"], { read: read(files), now })).toMatchObject({ violations: [{ line: 1 }, { line: 1 }] });
  expect(resolve("src/domain/value.rs", "infra::Value", null, read(files))).toBe("unresolved");
  const alias = { ...files, "src/domain/mod.rs": "use crate::infra as std; pub mod value;\n" };
  expect(resolve("src/domain/mod.rs", "std::Value", null, read(alias))).toBe("unresolved");
});

test("A public Rust facade cannot hide the adapter and known generated include remains unknown", () => {
  const files = { ...base, "src/domain/mod.rs": "pub mod value; pub use crate::infra::Store;\n" };
  expect(reexportTargets("src/domain/mod.rs", null, read(files))).toContainEqual({ spec: "crate::infra::Store", to: { rel: "src/infra.rs" } });
  const policy = fixtureLock(check({ kind: "primitive", primitive: "layer-edge" }), {}, { layers: layer });
  const code = 'include!("generated.rs");\n';
  expect(analyze(policy, "pre", "src/domain/value.rs", code, { read: read({ ...base, "src/domain/value.rs": code }), now })).toEqual({ cause: "unresolvable-import", line: 1 });
  const metric = fixtureLock(check({ kind: "primitive", primitive: "metric", metric: "fn.params" }), { max: 1 }, {});
  expect(auditFile(auditRules(metric).lock, "a.rs", 'fn f() { println!("ok"); assert!(true); }\n', { read: read({}), now })).toMatchObject({ findings: [], errors: [] });
});

test("Rust real comments carry core markers; raw strings and macro token strings do not", () => {
  const text = 'fn f() { let _ = r#"@generated"#; println!("@generated"); }\n// @generated\n/* @generated */\n';
  expect(markerLocations("a.rs", text, ["@generated"]).map(s => s.line)).toEqual([2, 3]);
  const marker: Check = { ...check({ kind: "primitive", primitive: "diff", count: "markers", op: "no-increase" }), params: { markers: { type: "array", items: { type: "string" } } } };
  delete marker.languages;
  const policy = fixtureLock(marker, { markers: ["@generated"] }, {});
  const before = analyze(policy, "pre", "a.rs", 'fn f() { let _ = "@generated"; }\n', { read: read({}), now });
  const after = analyze(policy, "pre", "a.rs", text, { read: read({}), now });
  expect("cause" in before || "cause" in after).toBe(false);
  if (!("cause" in before) && !("cause" in after)) expect(introduced(policy, "a.rs", before, after)).toMatchObject([{ measured: 2, limit: 0, line: 2 }]);
});

test("Rust syntax preserves valid 2024 unsafe extern and rejects malformed controls without hiding errors", () => {
  for (const source of ["unsafe extern \"C\" { static mut VALUE:u8; }", "async fn load() {}", "fn f() { let _ = || true; }", "macro_rules! f { ($x:expr) => { $x }; }"]) parsed(source, () => {});
  for (const source of ["fn broken(value:) {}", "fn broken( {}", "static VALUE: = 1;", "use crate::;"]) {
    inspectedTree(parse("a.rs", source), p => { expect(errorIn(p, null)).not.toBeNull(); });
  }
});

test("Rust policies use their own AST and forbidden std paths match canonical calls too", () => {
  const policy = fixtureLock(check({ kind: "primitive", primitive: "banned-import" }), { packages: ["std::fs"] }, {});
  for (const path of ["std::fs::read", "::std::fs::read"]) expect(analyze(policy, "pre", "src/domain/value.rs", `fn f() { let _ = ${path}("x"); }\n`, { read: read(base), now })).toMatchObject({ violations: [{ line: 1 }] });
  expect(analyze(policy, "pre", "src/domain/value.rs", 'fn f() { let _ = "std::fs::read"; }\n', { read: read(base), now })).toMatchObject({ violations: [] });
  expect(listChecks({ "source.json": '{"ns":"example","version":"1.0.0"}', "checks/rust/source/check.json": JSON.stringify(check({ kind: "primitive", primitive: "metric", metric: "class.publicMethods" })) })).toHaveProperty("errors");
});

test("Rust optional library passes real fixtures; starter and mixed selection keep core active", () => {
  const files = librarySource("rust", true)!;
  const listed = listChecks(files);
  expect("ids" in listed).toBe(true);
  if ("ids" in listed) { expect(listed.ids).toHaveLength(9); for (const id of listed.ids) expect(testCheck(files, id, now)).toMatchObject({ ok: true }); }
  for (const source of [{ "Cargo.toml": manifest }, { "src/lib.rs": "pub fn f() {}" }] as Files[]) expect(detectStack(source).recommended).toBe("rust-starter");
  const mixed = detectStack({ "src/lib.rs": "", "main.py": "", "main.ts": "" });
  expect(mixed.recommended).toBe("mixed-starter");
  const preset = onboardingPreset("mixed-starter", BUILTIN, { engine: pkg.version, core: "0.0.1" }, mixed, librarySources())!;
  expect(preset.sources.map(s => s.ns)).toEqual(["core", "python", "rust", "clean-code"]);
  const built = compile(JSON.stringify(preset), source => source.kind === "builtin" ? BUILTIN : librarySource(source.ns), { engine: pkg.version, core: "0.0.1" });
  expect("errors" in built ? built.errors : []).toEqual([]);
  if (!("errors" in built)) {
    expect(built.lock.rules.some(r => r.id === "core/EVA-GEN-001")).toBe(true);
    expect(missingLanguagePolicy(built.lock, "src/lib.rs")).toBe(false);
    expect(scopeCoverage({ "src/lib.rs": "", "target/generated.rs": "" }, built.lock.scope).inScope).toBe(1);
  }
});

test("Rust core placement still rejects layered files without a selected Rust policy", () => {
  const guard: Check = { ...check({ kind: "primitive", primitive: "placement", cases: ["no-language-pack-in-layer"] }), params: { extensions: { type: "array", items: { type: "string" } } } };
  delete guard.languages;
  const policy = fixtureLock(guard, { extensions: ["rs"] }, { layers: layer });
  expect(placement(policy, "pre", "src/domain/value.rs", false, "fn f() {}")).toHaveLength(1);
  expect(missingLanguagePolicy(policy, "src/domain/value.rs")).toBe(true);
});

test("Rust source inventory excludes conventional Cargo outputs, includes manifests/configs and unrelated target source", () => {
  const root = mkdtempSync(join(tmpdir(), "pregate-rust-inventory-"));
  removedAfter(root, () => {
    const files = { "Cargo.toml": manifest, "src/lib.rs": "", "target/debug/generated.rs": "", ".cargo/config.toml": "paths=[]",
      "nested/Cargo.toml": manifest, "nested/src/lib.rs": "", "nested/target/generated.rs": "", "other/target/authored.rs": "" };
    for (const [rel, text] of Object.entries(files)) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); }
    expect(workspacePaths(root)).toEqual([".cargo/config.toml", "Cargo.toml", "nested/Cargo.toml", "nested/src/lib.rs", "other/target/authored.rs", "src/lib.rs"]);
    expect(contextFile(".cargo/config")).toBe(true);
  });
});

function removedAfter(root: string, body: () => void) {
  try { body(); } finally { removeTree(root); }
}

test("Vendored Rust parser and license match the declared source-built provenance", () => {
  const origin = readFileSync("vendor/tree-sitter-rust/ORIGIN", "utf8");
  for (const name of ["LICENSE", "tree-sitter-rust.wasm"]) {
    const hash = createHash("sha256").update(readFileSync("vendor/tree-sitter-rust/" + name)).digest("hex");
    expect(origin).toContain(hash + "  " + name);
  }
});
