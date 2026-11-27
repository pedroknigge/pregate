import { readFileSync } from "node:fs";
import parserPath from "../vendor/web-tree-sitter/web-tree-sitter.wasm" with { type: "file" };
import typescriptPath from "../vendor/tree-sitter-typescript/tree-sitter-typescript.wasm" with { type: "file" };
import tsxPath from "../vendor/tree-sitter-typescript/tree-sitter-tsx.wasm" with { type: "file" };
import pythonPath from "../vendor/tree-sitter-python/tree-sitter-python.wasm" with { type: "file" };
import goPath from "../vendor/tree-sitter-go/tree-sitter-go.wasm" with { type: "file" };
import rustPath from "../vendor/tree-sitter-rust/tree-sitter-rust.wasm" with { type: "file" };
import type { Files, Grammar } from "./types.ts";
import { setGrammars } from "./ts.ts";

function lazyFiles(load: () => Files): Files {
  let cached: Files | undefined;
  const get = (): Files => cached ??= load();
  return new Proxy({} as Files, {
    get: (_, prop) => Reflect.get(get(), prop),
    has: (_, prop) => Reflect.has(get(), prop),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_, prop) => Reflect.getOwnPropertyDescriptor(get(), prop),
  });
}

const embedded = require("./embedded.ts") as typeof import("./embedded.ts");
// Inlined at bundle time; "catalog" resolves against the bundler's cwd, so build and test run from
// the repo root (a wrong cwd fails the bundle, it never embeds an empty catalog).
export const BUILTIN: Files = lazyFiles(() => embedded.builtinCatalog());
// launcher.sh, pre-commit.sh and ci-github.yml, which `install` writes into the repo.
export const ASSETS: Files = lazyFiles(() => embedded.installAssets());

function parserWasm(): Uint8Array {
  return readFileSync(parserPath);
}

export function grammarWasm(g: Grammar): Uint8Array {
  return readFileSync({ typescript: typescriptPath, tsx: tsxPath, python: pythonPath, go: goPath, rust: rustPath }[g]);
}

// Runtime loading and initialization are shell effects. Core receives the initialized collaborator;
// grammar reads and compilation stay lazy so a file pays only for its own language.
export async function setUpGrammars(): Promise<void> {
  const runtime = require("../vendor/web-tree-sitter/web-tree-sitter.js") as typeof import("web-tree-sitter");
  await runtime.Parser.init({ wasmBinary: parserWasm() });
  setGrammars(runtime, grammarWasm);
}
