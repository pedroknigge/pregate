import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { foldArkgateText } from "../src/arkgate-import.ts";
import { grammars } from "../src/gate.ts";
import type { Preset } from "../src/types.ts";
import { arkConfig, arkFiles } from "./arkgate-fixture.ts";

const root = mkdtempSync(join(tmpdir(), "pregate-ark-"));
const preset = JSON.parse(readFileSync(new URL("../catalog/presets/legacy-safe.json", import.meta.url), "utf8")) as Preset;

beforeAll(() => grammars());

test("an unknown ArkGate key or a missing rules array is not imported", () => {
  const unknown = foldArkgateText(root, preset, arkFiles, "ark.config.json", JSON.stringify({ ...arkConfig, surprise: true }));
  expect("errors" in unknown).toBe(true);
  if ("errors" in unknown) expect(unknown.errors.join("\n")).toContain("surprise");
  const { rules: _rules, ...withoutRules } = arkConfig;
  const missing = foldArkgateText(root, preset, arkFiles, "ark.config.json", JSON.stringify(withoutRules));
  expect("errors" in missing).toBe(true);
  if ("errors" in missing) expect(missing.errors.join("\n")).toContain("rules");
  const self = foldArkgateText(root, preset, arkFiles, "ark.config.json", JSON.stringify({ ...arkConfig, rules: [{ from: "DomainModel", to: "DomainModel", allowed: false }] }));
  expect("errors" in self).toBe(true);
  if ("errors" in self) expect(self.errors.join("\n")).toContain("inside a layer");
});

test("ark.config.json becomes a layer map and coexist.arkgate, and a core layer is kept", () => {
  const folded = foldArkgateText(root, preset, arkFiles, "ark.config.json", JSON.stringify(arkConfig));
  expect("errors" in folded, "errors" in folded ? folded.errors.join("\n") : "").toBe(false);
  if ("errors" in folded) return;
  expect(folded.preset.layers?.["domain-model"]).toEqual({ paths: ["src/domain/**"], mayImport: ["kernel"], kind: "core" });
  expect(folded.preset.layers?.["application-orchestration"]).toEqual({ paths: ["src/application/**"], mayImport: ["domain-model", "kernel"], kind: "core" });
  expect(folded.preset.layers?.["persistence-adapters"]).toEqual({ paths: ["src/adapters/persistence/**"], mayImport: ["domain-model", "kernel"], kind: "adapter" });
  expect(folded.preset.layers?.["presentation-adapters"]).toEqual({ paths: ["src/adapters/http/**"], mayImport: ["application-orchestration", "kernel"], kind: "adapter" });
  expect(folded.preset.layers?.kernel).toEqual({
    paths: ["src/main.ts"], mayImport: ["application-orchestration", "domain-model", "persistence-adapters", "presentation-adapters"], kind: "main",
  });
  expect(folded.preset.coexist?.arkgate).toEqual({
    config: "ark.config.json", ownedByArkgate: ["architecture/CA-DEP-001"],
    note: "ArkGate enforces layer direction from this config. PREGATE lists those invariants in ownedByArkgate and does not evaluate them.",
  });
  expect(folded.preset.methodologies).toContain("architecture/clean-architecture");
  const text = [...folded.notes, ...folded.evidenceLines].join("\n");
  expect(text).toContain("schemaVersion is \"1.0\"");
  expect(text).toContain("src/domain/**/*.spec.ts");
  expect(text).toContain("forbiddenGlobals");
  expect(text).toContain("peerIsolation");
  expect(text).toContain("The 2 existing breaks stay as known debt under no-new.");
  expect(text).toContain("code outside every layer");
  expect(text).toContain("A new break is not reported by PREGATE; ArkGate already enforces layer direction.");
  expect(text).not.toContain("not proposed");
});
