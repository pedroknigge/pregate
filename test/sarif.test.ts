import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { audit } from "../src/audit-command.ts";
import { compile } from "../src/compile.ts";
import { canonical } from "../src/disk.ts";
import { check, LOCK, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { sarifReport } from "../src/sarif.ts";
import { removeTree } from "./remove-tree.ts";

test("sarifReport, audit --sarif and check --format sarif emit valid SARIF 2.1.0 documents", async () => {
  const root = canonical(mkdtempSync(join(tmpdir(), "pregate-sarif-")));
  try {
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, ".pregate"), { recursive: true });
    const presetText = JSON.stringify({
      name: "sarif-test",
      version: "0.0.1",
      engine: VERSIONS.engine,
      sources: [
        { ns: "core", kind: "builtin", version: VERSIONS.core },
        { ns: "clean-code", kind: "library", version: "1.2.0" },
        { ns: "typescript", kind: "library", version: "1.3.0" },
      ],
      methodologies: ["core/pregate-integrity", "clean-code/clean-code", "typescript/anti-evasion"],
      scope: { include: ["src/**"], exclude: [] },
      overrides: { "CC-FN-002": { params: { max: 2 }, severity: "deny" } },
    }, null, 2) + "\n";
    writeFileSync(join(root, PRESET), presetText);
    const compiled = compile(presetText, sourcesOf(root), VERSIONS);
    expect("lock" in compiled).toBe(true);
    if (!("lock" in compiled)) return;
    writeFileSync(join(root, LOCK), compiled.text);
    writeFileSync(join(root, "src/bad.ts"), "export function tooMany(a: number, b: number, c: number) {\n  return a + b + c;\n}\n");

    const auditOut = await audit(["--repo", root, "--sarif"]);
    expect(auditOut.code).toBe(1);
    const sarif = JSON.parse(auditOut.text);
    expect(sarif.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    const run = sarif.runs[0];
    expect(run.tool.driver.name).toBe("PREGATE");
    expect(run.tool.driver.version).toBe(VERSIONS.engine);
    expect(run.tool.driver.informationUri).toBe("https://github.com/pedroknigge/pregate");
    expect(run.tool.driver.rules.some((r: { id: string }) => r.id === "clean-code/CC-FN-002")).toBe(true);
    expect(run.invocations).toEqual([{ executionSuccessful: true }]);
    expect(run.results).toEqual([
      expect.objectContaining({
        ruleId: "clean-code/CC-FN-002",
        level: "error",
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: "src/bad.ts", uriBaseId: "%SRCROOT%" },
            region: { startLine: 1 },
          },
        }],
      }),
    ]);

    const checkOut = await check(root, { kind: "tree" }, "sarif");
    expect(checkOut.code).toBe(1);
    const checkParsed = JSON.parse(checkOut.text);
    expect(checkParsed.version).toBe("2.1.0");
    expect(checkParsed.runs[0].results.some((r: { ruleId: string }) => r.ruleId === "clean-code/CC-FN-002")).toBe(true);

    const direct = JSON.parse(sarifReport(compiled.lock, [], false));
    expect(direct.runs[0].invocations).toEqual([{ executionSuccessful: false }]);
    expect(direct.runs[0].results).toEqual([]);
  } finally {
    removeTree(root);
  }
});
