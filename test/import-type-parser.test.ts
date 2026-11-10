import { afterAll, beforeAll, expect, test } from "bun:test";
import { Lang, parse as oracleParse } from "@ast-grep/napi";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { removeReleased } from "./remove-tree.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { engineAt } from "./compiled-engine.ts";
import { BUILTIN, setUpGrammars } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { VERSIONS, LOCK, PRESET } from "../src/gate.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { errorIn, parse } from "../src/ts.ts";
import type { Preset } from "../src/types.ts";

const area = mkdtempSync(join(tmpdir(), "pregate-import-type-parser-"));
beforeAll(setUpGrammars);
afterAll(() => removeReleased(area), 20_000);

const calls = [
  "useRef<import('maplibre-gl').Marker[]>([])",
  "useRef<import('maplibre-gl').Marker[][]>([])",
  "useRef<import('maplibre-gl').Map | null>(null)",
  "useRef<import('maplibre-gl').Marker[] | null>(null)",
];
const invalid = [
  "useRef<import('maplibre-gl').Marker[>([])",
  "useRef<import('maplibre-gl').[]>([])",
  "useRef<import('maplibre-gl').Marker[]>([)",
];
const source = (call: string): string => `// marker: 🙂\r\nexport function useMarkers() {\r\n  return ${call};\r\n}\r\n`;

test("TypeScript accepts imported member arrays and unions as call type arguments, and rejects malformed controls", () => {
  const compiler = join(area, "compiler"); mkdirSync(compiler);
  writeFileSync(join(compiler, "types.d.ts"), 'declare module "maplibre-gl" { export interface Marker { id: string }; export interface Map { id: string }; }\ndeclare function useRef<T>(value: T): { current: T };\n');
  const config = { compilerOptions: { strict: true, noEmit: true, skipLibCheck: true, target: "es2022", module: "esnext", jsx: "preserve", types: [] }, files: ["types.d.ts", "case.ts", "case.tsx"] };
  writeFileSync(join(compiler, "tsconfig.json"), JSON.stringify(config));
  for (const [text, valid] of [[calls.map((call, i) => `const ref${i} = ${call};`).join("\n"), true], ...invalid.map(call => [source(call), false])] as [string, boolean][]) {
    for (const ext of ["ts", "tsx"]) writeFileSync(join(compiler, `case.${ext}`), text + "\nexport {};\n");
    const out = Bun.spawnSync([process.execPath, join(import.meta.dir, "../node_modules/typescript/bin/tsc"), "--project", join(compiler, "tsconfig.json")], { stdout: "pipe", stderr: "pipe" });
    expect(out.exitCode === 0, out.stdout.toString() + out.stderr.toString()).toBe(valid);
    if (!valid) expect(out.stdout.toString()).toMatch(/error TS1\d{3}/);
  }
});

for (const ext of ["ts", "tsx"] as const) {
  test(`import type arguments keep generic call identity, raw text and UTF-16 spans in ${ext}`, () => {
    for (const call of calls) {
      const text = source(call), parsed = parse(`case.${ext}`, text);
      expect(errorIn(parsed, null)).toBeNull(); expect(parsed.root.text).toBe(text);
      const invocation = parsed.root.descendantsOfType("call_expression").find(node => node.childForFieldName("function")?.text === "useRef")!;
      expect(invocation).toBeDefined(); expect(invocation.text).toBe(call);
      expect(invocation.childForFieldName("type_arguments")?.text).toBe(call.slice(call.indexOf("<"), call.lastIndexOf(">") + 1));
      expect(text.slice(invocation.startIndex, invocation.endIndex)).toBe(call);
      expect(invocation.startPosition.row).toBe(2);
      expect(parsed.root.descendantsOfType("binary_expression")).toHaveLength(0);
      parsed.root.tree.delete();
    }
    // The native oracle has no ERROR for the issue's minimal example, but still loses its type_arguments.
    expect(oracleParse(ext === "ts" ? Lang.TypeScript : Lang.Tsx, source(calls[0]!)).root().findAll({ rule: { kind: "ERROR" } })).toHaveLength(0);
  });

  test(`type import conflicts retain runtime import calls, indexed access and comparisons in ${ext}`, () => {
    const expressions = [
      "import('maplibre-gl').then(module => module.default)",
      "import('maplibre-gl').Marker[index]",
      "left < import('maplibre-gl').Marker[index]",
      "left < import('maplibre-gl').Marker[index] > right",
      "import('maplibre-gl').Map | null",
    ];
    for (const expression of expressions) {
      const parsed = parse(`case.${ext}`, `const result = ${expression};`);
      expect(errorIn(parsed, null)).toBeNull();
      expect(parsed.root.descendantsOfType("type_arguments")).toHaveLength(0);
      expect(parsed.root.descendantsOfType("array_type")).toHaveLength(0);
      if (expression.includes(" < ")) expect(parsed.root.descendantsOfType("binary_expression").length).toBeGreaterThan(0);
      if (expression.includes("[index]")) expect(parsed.root.descendantsOfType("subscript_expression")).toHaveLength(1);
      parsed.root.tree.delete();
    }
  });

  test(`malformed import generic syntax still errors in its original changed window in ${ext}`, () => {
    for (const call of invalid) {
      const text = source(call), parsed = parse(`case.${ext}`, text), start = text.indexOf("return");
      expect(errorIn(parsed, null)).not.toBeNull();
      expect(errorIn(parsed, [start, text.indexOf(";", start)])).toBe(3);
      expect(errorIn(parsed, [0, text.indexOf("\r\n")])).toBeNull();
      expect(parsed.root.text).toBe(text); parsed.root.tree.delete();
    }
  });
}

test("production audit and stdin checks accept inline import arrays and reject changed malformed syntax", () => {
  const root = join(area, "native"), binary = join(area, ENGINE_FILE);
  mkdirSync(join(root, "src"), { recursive: true }); mkdirSync(join(root, ".pregate"));
  const env = { ...process.env, HOME: join(area, "home"), XDG_DATA_HOME: join(area, "data"), XDG_STATE_HOME: join(area, "state") };
  for (const name of ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME"] as const) mkdirSync(env[name], { recursive: true });
  const preset = JSON.parse(readFileSync(join(import.meta.dir, "../catalog/presets/functional-ts.json"), "utf8")) as Preset;
  preset.engine = VERSIONS.engine; preset.sources = [{ ns: "core", kind: "builtin", version: VERSIONS.core }];
  preset.methodologies = ["core/pregate-integrity"]; delete preset.layers; delete preset.resolve;
  const presetText = JSON.stringify(preset), contract = compile(presetText, source => source.kind === "builtin" ? BUILTIN : null, VERSIONS);
  if ("errors" in contract) throw new Error(contract.errors.join("\n"));
  writeFileSync(join(root, PRESET), presetText); writeFileSync(join(root, LOCK), contract.text);
  for (const args of [["init", "-q"], ["add", "."], ["commit", "-qm", "base"]]) {
    const git = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd: root, stderr: "pipe" });
    if (git.exitCode !== 0) throw new Error(git.stderr.toString());
  }
  engineAt(binary);
  const invoke = (args: string[], stdin?: string) => Bun.spawnSync([binary, ...args], { cwd: root, env, stdin: stdin === undefined ? "ignore" : Buffer.from(stdin), stdout: "pipe", stderr: "pipe", timeout: 10_000 });
  for (const ext of ["ts", "tsx"]) {
    const path = join(root, `src/markers.${ext}`), baseline = "export const placeholder = 1;\n";
    writeFileSync(path, baseline);
    for (const call of calls) { const out = invoke(["check", "--stdin", "--path", path], source(call)); expect(out.exitCode, out.stdout.toString() + out.stderr.toString()).toBe(0); }
    for (const call of invalid) { const out = invoke(["check", "--stdin", "--path", path], source(call)); expect(out.exitCode).toBe(1); expect(out.stdout.toString()).toContain("syntax"); }
    expect(readFileSync(path, "utf8")).toBe(baseline);
    writeFileSync(path, source(calls[0]!));
    const valid = invoke(["audit", "--json"]), clean = JSON.parse(valid.stdout.toString());
    expect(valid.exitCode).toBe(0); expect(clean.errors).toEqual([]);
    expect(clean.fitness.length).toBeGreaterThan(0);
    expect(clean.fitness.every((entry: { status: string }) => entry.status === "unverified")).toBe(true);
    writeFileSync(path, source(invalid[0]!));
    const malformed = invoke(["audit", "--json"]), report = JSON.parse(malformed.stdout.toString());
    expect(malformed.exitCode).toBe(2);
    expect(report.errors).toContainEqual({ path: `src/markers.${ext}`, cause: "syntax", line: 3 });
    rmSync(path);
  }
}, 120_000);
