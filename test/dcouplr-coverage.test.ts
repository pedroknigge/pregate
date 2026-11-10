import { beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apiInventory, pinnedSource } from "../scripts/dcouplr-coverage.ts";
import { grammars } from "../src/gate.ts";
import ledger from "../packs/dcouplr/API-COVERAGE.json" with { type: "json" };
import { removeTree } from "./remove-tree.ts";

beforeAll(grammars);
const entry = "dist/index.d.mts";
const inventory = (text: string) => apiInventory({ [entry]: text }, [entry]);

test("public aliases retain imported and inherited declarations, overloads and transitive types", () => {
  const result = apiInventory({
    [entry]: `import { Base as Local } from './shared.mjs';
      interface Hidden { value: string }
      interface Derived extends Local { run(input: Hidden): void; run(input: number): void }
      declare const api: { make(): Derived };
      export { Derived as Public, api };`,
    "dist/shared.d.mts": `interface Base { inherited: boolean }
      export { Base };`,
  }, [entry]);
  expect(result.publicExports.map(e => [e.name, e.declaration])).toEqual([
    ["Public", `${entry}:Derived`], ["api", `${entry}:api`],
  ]);
  expect(result.contracts.map(c => c.name).sort()).toEqual(["Base", "Derived", "Hidden", "api"]);
  const derived = result.contracts.find(c => c.name === "Derived")!;
  expect(derived.members.map(m => [m.name, m.declaredIn])).toEqual([
    ["inherited", "Base"], ["run", "Derived"], ["run", "Derived"],
  ]);
  expect(derived.members[0]!.source.path).toBe("dist/shared.d.mts");
  expect(derived.directExports).toEqual([`${entry}:Public`]);
  expect(result.contracts.find(c => c.name === "Hidden")!.directExports).toEqual([]);
});

test("declaration merging retains both the type and value surface", () => {
  const result = inventory(`type Events = 'start' | 'stop';
    declare const Events: { readonly Start: 'start'; readonly Stop: 'stop' };
    export { Events };`);
  expect(result.contracts).toHaveLength(1);
  expect(result.contracts[0]!.declarations.map(d => d.kind)).toEqual(["type_alias_declaration", "variable_declarator"]);
  expect(result.contracts[0]!.members.map(m => m.name)).toEqual(["Start", "Stop"]);
});

test("direct declaration exports retain ambient wrappers and multiple bindings", () => {
  const result = inventory(`export interface Input { value: string }
    export declare const one: Input, two: Input;
    export declare function run(input: Input): void;`);
  expect(result.publicExports.map(e => e.name)).toEqual(["Input", "one", "two", "run"]);
  expect(result.contracts.map(c => c.name).sort()).toEqual(["Input", "one", "run", "two"]);
});

test("public class constructors are inventoried while private and protected members are excluded", () => {
  const result = inventory(`declare class Service {
    #state: number; private secret: string; protected internal(): void;
    constructor(input: string); public run(): void;
  } export { Service };`);
  expect(result.contracts[0]!.members.map(m => m.name)).toEqual(["constructor", "run"]);
});

test("readonly aliases and union object signatures retain their named dependencies", () => {
  const result = inventory(`interface Value { valid: boolean }
    type Result = Readonly<Value> | { error: string };
    export { Result };`);
  expect(result.contracts.find(c => c.name === "Result")!.members.map(m => m.name)).toEqual(["valid", "error"]);
  expect(result.contracts.map(c => c.name).sort()).toEqual(["Result", "Value"]);
});

test("typeof references retain public namespace-like values and helper functions", () => {
  const result = inventory(`declare function helper(): string;
    declare const tools: { helper: typeof helper };
    export { tools };`);
  expect(result.contracts.map(c => c.name).sort()).toEqual(["helper", "tools"]);
});

test("generic parameters do not resolve to unrelated file-level contracts", () => {
  const result = inventory(`interface T { unrelated: string }
    interface Value { allowed: boolean }
    interface Box<T extends Value> { make<T>(input: T): T }
    export { Box };`);
  expect(result.contracts.map(c => c.name).sort()).toEqual(["Box", "Value"]);
});

test("enum values retain their literal member names", () => {
  const result = inventory("declare enum Kind { One = 1, Two } export { Kind };");
  expect(result.contracts[0]!.members.map(m => m.name)).toEqual(["One", "Two"]);
});

test.each([
  ["interface Broken {", "invalid declaration syntax"],
  ["export { Missing };", "Unresolved public export"],
  ["export * from './other.mjs';", "unsupported public re-export"],
  ["declare namespace Unsupported { const value: string; } export { Unsupported };", "unsupported declaration internal_module"],
  ["interface Derived extends Missing {} export { Derived };", "Unresolved inherited contract"],
  ["interface A extends B {} interface B extends A {} export { A };", "Cyclic inherited contract"],
])("unresolved inputs fail instead of producing a complete-looking report: %s", (text, error) => {
  expect(() => inventory(text)).toThrow(error);
});

test("cyclic imported aliases fail instead of recursing indefinitely", () => {
  expect(() => apiInventory({
    [entry]: "import { A } from './other.mjs'; export { A };",
    "dist/other.d.mts": "import { A } from './index.mjs'; export { A };",
  }, [entry])).toThrow("Cyclic declaration alias");
});

test("inventory source must match the reviewed upstream hash before parsing", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-dcouplr-pin-"));
  inScratch(dir, () => {
    mkdirSync(join(dir, "dist"));
    writeFileSync(join(dir, "dist/index.mjs"), "export const changed = true;");
    expect(() => pinnedSource(dir)).toThrow("Unreviewed dcouplr input: dist/index.mjs");
  });
});

test("published ledger exposes unchecked lifecycle and replacement surfaces", () => {
  for (const name of ["setupDcouplr", "runtime", "tools", "system", "DStructuredSaga", "startDcouplrInspector"])
    expect(ledger.publicExports.some(e => e.name === name)).toBe(true);
  for (const name of ["IEventGate", "IExceptionGate", "ILogger", "IDependenciesGate", "IQueue", "IStructuredSaga"])
    expect(ledger.contracts.some(c => c.name === name)).toBe(true);
  const saga = ledger.contracts.find(c => c.name === "IStructuredSaga")!;
  expect(saga.members.find(m => m.name === "registerNode")!.relatedSlices).toEqual(["dcouplr/DCP-SAGA-NODE-001"]);
  for (const name of ["start", "stop"]) expect(saga.members.find(m => m.name === name)!.relatedSlices).toEqual([]);
  const runtime = ledger.contracts.find(c => c.name === "runtime")!;
  expect(runtime.members.find(m => m.name === "getDcouplr")!.relatedSlices).toEqual([]);
  expect(ledger.limit).toContain("not exhaustive semantic conditions or proof of compliance");
});

function inScratch(dir: string, use: () => void): void {
  try { use(); } finally { removeTree(dir); }
}
