import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Lang, parse } from "@ast-grep/napi";
import { removeTree } from "./remove-tree.ts";

test.each(["readable", "minified"])("bundled library constructs policy and fixtures only at first lookup (%s)", async variant => {
  const area = mkdtempSync(join(tmpdir(), "pregate-library-loading-"));
  await inScratch(area, async () => {
    const entry = join(area, "entry.ts");
    writeFileSync(entry, `import { librarySource, librarySources } from ${JSON.stringify(join(import.meta.dir, "../src/library.ts"))};
const counts = () => [globalThis.policyConstructions ?? 0, globalThis.fixtureConstructions ?? 0];
const observed = [counts()];
const sources = librarySources(); observed.push(counts());
librarySource("typescript"); observed.push(counts());
const fixtures = librarySource("typescript", true); observed.push(counts());
librarySources(); librarySource("typescript", true); observed.push(counts());
console.log(JSON.stringify({ observed, sources: sources.length, fixtures: Object.keys(fixtures).some(path => path.includes("/fixtures/")) }));
`);
    const built = await Bun.build({ entrypoints: [entry], target: "bun", minify: variant === "minified" });
    expect(built.success, JSON.stringify(built.logs)).toBe(true);
    const code = await built.outputs[0]!.text();
    const root = parse(Lang.JavaScript, code).root();
    // Observe the actual emitted literals after bundling, so instrumentation cannot
    // change Bun's decision to hoist their initializers out of a lazy module.
    const literals = root.findAll({ rule: { kind: "pair", has: { field: "key", regex: '^"angular/source\\.json"$' } } })
      .map(pair => pair.parent()!);
    expect(literals).toHaveLength(2);
    const edits = literals.map(literal => {
      const counter = literal.text().includes("/fixtures/") ? "fixtureConstructions" : "policyConstructions";
      return literal.replace(`(globalThis.${counter} = (globalThis.${counter} ?? 0) + 1, ${literal.text()})`);
    });
    const executable = join(area, "observed.js");
    writeFileSync(executable, root.commitEdits(edits));
    const run = Bun.spawnSync([process.execPath, executable], { stdout: "pipe", stderr: "pipe" });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    expect(JSON.parse(run.stdout.toString())).toEqual({
      observed: [[0, 0], [1, 0], [1, 0], [1, 1], [1, 1]], sources: 48, fixtures: true,
    });
  });
}, 60_000); // Bun.build of the whole library alone takes ~5 s on a Windows runner.

async function inScratch(dir: string, use: () => Promise<void>): Promise<void> {
  try { await use(); } finally { removeTree(dir); }
}
