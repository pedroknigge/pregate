import { beforeAll, expect, test } from "bun:test";
import { setUpGrammars } from "../src/assets.ts";
import { fixtureLock } from "../src/compile.ts";
import { bundledBetween, reviewDiff } from "../src/contract.ts";
import { inlineSink } from "../src/inline-sinks.ts";
import { loosening } from "../src/loosening.ts";
import { layerOf } from "../src/paths.ts";
import { sha256 } from "../src/state.ts";
import { cycleImports, imports, parse, publicExports, sfcScript } from "../src/ts.ts";
import type { Check, Lock } from "../src/types.ts";

// Findings of an outside review of the engine, each fixed and pinned here. Two reported items are
// not here because the engine was right: a field with a stopBy rule follows ast-grep (see
// match.test.ts), and a literal </script> ends a Vue or Svelte script block for the HTML parser too.
beforeAll(setUpGrammars);

const check: Check = { id: "architecture/dependencies/layers", version: "1.0.0", area: "dependencies", cardinality: "singleton", dimension: "deps.layers",
  minSeverity: null, params: {}, languages: ["typescript"], impl: { kind: "primitive", primitive: "layer-edge" }, phase: ["pre", "stop", "commit", "ci"],
  feedback: { message: "m", why: "w", fix: "f", avoid: null, source: "s" } } as unknown as Check;
const lock: Lock = fixtureLock(check, { paths: ["src/**"] }, {});
const text = (value: Lock): string => JSON.stringify(value);

test("the ratchet reports a preset that no longer says uncertainty closed", () => {
  const base = { lockText: text(lock), presetText: '{"uncertainty":"closed"}' };
  const opened = loosening(base, { lock, hash: sha256(text(lock)), presetText: "{}" });
  expect(opened?.lines.join("\n")).toContain('Changes uncertainty from "closed"');
  expect(opened?.digest).toMatch(/^[0-9a-f]{64}$/);
  // Open stays open, closed stays closed, and open to closed is not looser.
  expect(loosening({ ...base, presetText: "{}" }, { lock, hash: sha256(text(lock)), presetText: "{}" })).toBeNull();
  expect(loosening(base, { lock, hash: sha256(text(lock)), presetText: '{"uncertainty":"closed"}' })).toBeNull();
  expect(loosening({ ...base, presetText: "{}" }, { lock, hash: sha256(text(lock)), presetText: '{"uncertainty":"closed"}' })).toBeNull();
});

test("a version gate or a when added to a rule is a change that may loosen, not documentation", () => {
  const gated: Lock = { ...lock, rules: lock.rules.map((rule) => ({ ...rule, versionGate: { package: "next", range: ">=99.0.0", severity: "deny", unmatched: "skip" } })) } as Lock;
  const withGate = reviewDiff(text(lock), gated, bundledBetween(null, null));
  expect(withGate.warning).toBe(true);
  expect(withGate.lines.join("\n")).not.toContain("effective check unchanged");
  const conditional: Lock = { ...lock, rules: lock.rules.map((rule) => ({ ...rule, when: { dependency: "typescript", min: "99.0.0" } })) } as Lock;
  expect(reviewDiff(text(lock), conditional, bundledBetween(null, null)).warning).toBe(true);
  expect(reviewDiff(text(lock), lock, bundledBetween(null, null)).warning).toBe(false);
});

test("a quote inside a comment does not hide an inline sink", () => {
  expect(inlineSink("node", "/* ' */ eval('1') /* ' */", [])).toBe(true);
  expect(inlineSink("node", "// it's\neval('1') // isn't", [])).toBe(true);
  expect(inlineSink("python3", "# '''\nimport os; os.remove('x')\n# '''", [])).toBe(true);
  // A sink named only inside a string or a comment is still not a sink.
  expect(inlineSink("node", "console.log('eval(1)') // eval('2')", [])).toBe(false);
  expect(inlineSink("node", "const url = 'http://x/y'; console.log(`a // ${url}`)", [])).toBe(false);
});

test("an escaped import specifier names the module the runtime loads", () => {
  const found = imports(parse("src/a.ts", 'import fs from "\\u0066s";\nconst child = require("child_\\x70rocess");\nimport("\\u{6e}ode:os");\n'));
  expect(found.map((edge) => edge.spec)).toEqual(["fs", "child_process", "node:os"]);
});

test("destructured exports count as the names they bind", () => {
  const parsed = parse("src/a.ts", "export const { a, b, c: d, ...rest } = obj;\nexport const [x, y = fallback] = list;\nexport const plain = 1;\n");
  expect(publicExports(parsed).count).toBe(7);
});

test("a value import beside a type import of the same module on one line is still a cycle edge", () => {
  const both = parse("src/a.ts", 'import type { A } from "./b"; import { value } from "./b";\n');
  expect(cycleImports(both).map((edge) => edge.spec)).toEqual(["./b"]);
  const typesOnly = parse("src/a.ts", 'import type { A } from "./b"; import { type B } from "./b";\n');
  expect(cycleImports(typesOnly)).toEqual([]);
});

test("a brace group or a bracket class does not make a broad layer glob outrank a specific one", () => {
  const layers = { broad: { paths: ["src/{alpha,beta,gamma,delta}/**"], mayImport: ["*"], kind: "adapter" }, exact: { paths: ["src/alpha/foo.ts"], mayImport: [], kind: "core" },
    classed: { paths: ["lib/[abcdefghijklmnop]/**"], mayImport: ["*"], kind: "adapter" }, file: { paths: ["lib/a/x.ts"], mayImport: [], kind: "core" } };
  const contract = { ...lock, layers } as unknown as Lock;
  expect(layerOf(contract, "src/alpha/foo.ts")).toBe("exact");
  expect(layerOf(contract, "src/beta/other.ts")).toBe("broad");
  expect(layerOf(contract, "lib/a/x.ts")).toBe("file");
});

test("a script block inside an HTML comment of a Vue or Svelte file is not read as code", () => {
  const source = "<!-- <script>const hidden = eval('1')</script> -->\n<script>\nconst shown = 1\n</script>\n";
  const script = sfcScript("src/App.vue", source);
  expect(script).toContain("const shown = 1");
  // The HTML comment becomes one JavaScript comment, so its script is text and not code.
  expect(script.split("\n")[0]).toMatch(/^\/\*.*hidden.*\*\/$/);
  expect(script.length).toBe(source.length);
});
