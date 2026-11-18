import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { causeFix, ruleFix } from "../src/fix.ts";
import { validate } from "../src/schema.ts";
import type { Layer, Lock, LockRule, Violation } from "../src/types.ts";

const layers: Record<string, Layer> = {
  core: { paths: ["src/core/**"], mayImport: [], kind: "core" },
  shell: { paths: ["src/shell/**", "src/main.ts"], mayImport: ["core"], kind: "adapter" },
};

function rule(id: string, impl: LockRule["impl"], params: Record<string, unknown>, text: Partial<LockRule["text"]> = {}): LockRule {
  return {
    id, aliases: [id], check: `${id}@1.0.0`, impl, params, severity: "deny",
    phases: ["pre"], integrity: false, origin: {},
    text: {
      message: "the module breaks the rule.",
      why: "The rule says so.",
      fix: "Follow the pack hint.",
      avoid: null,
      source: "Fixture",
      ...text,
    },
  };
}

function lock(rules: LockRule[], scope: Lock["scope"] = { include: ["src/**"], exclude: ["src/generated/**"] }): Lock {
  return {
    lockVersion: 1, engine: "0.0.12", core: "0.0.1", coreHash: "c", presetHash: "p", sourcesHash: "s",
    preset: { name: "fix", version: "1.0.0", methodologies: ["architecture/clean-architecture"] },
    enforcement: "enforce", scope, generatedMarkers: [], layers, sourceDirs: [], ratchet: "strict",
    ownedByArkgate: [], rules,
    loop: { maxDenialsPerFileRule: 3, maxDenialsPerTurn: 15, noProgressLimit: 2, maxStopBlocks: 2, allowAsk: true, maxDetailedViolations: 5 },
  };
}

function violation(ruleId: string, path: string, extra: Partial<Violation> = {}): Violation {
  return { rule: ruleId, path, line: 1, symbol: "<module>", measured: null, limit: null, atSessionStart: null, severity: "deny", ...extra };
}

test("a layer edge names the allowed paths and the import to replace", () => {
  const edge = rule("architecture/CA-DEP-001", { kind: "primitive", primitive: "layer-edge" }, { paths: ["**"], exclude: [] });
  const fix = ruleFix(violation(edge.id, "src/core/order.ts", { edge: { from: "core", to: "shell", spec: "../shell/main" } }), lock([edge]));
  expect(fix.deterministic).toBe(true);
  expect(fix.where).toContain("src/core/");
  expect(fix.where).toContain("src/shell/");
  expect(fix.use).toContain("src/core/");
  expect(fix.use).toContain("../shell/main");
  expect(fix.text.startsWith("Put the code in")).toBe(true);
  expect(fix.text).toContain("Follow the pack hint.");
});

test("a banned import names an uncovered layer and says when no replacement API is declared", () => {
  const banned = rule("architecture/CA-DEP-002", { kind: "primitive", primitive: "banned-import" }, {
    paths: ["src/core/**"], exclude: [], packages: ["express"],
  });
  const fix = ruleFix(violation(banned.id, "src/core/db.ts", { spec: "express" }), lock([banned]));
  expect(fix.deterministic).toBe(false);
  expect(fix.where).toContain("src/shell/");
  expect(fix.use).toBeNull();
  expect(fix.text).toContain("src/shell/");
  expect(fix.text).toContain("No replacement API is declared for express.");
});

test("a declared fix.where and fix.use replace the derived sentence", () => {
  const banned = rule("local/LOCAL-FS-001", { kind: "primitive", primitive: "banned-import" }, {
    paths: ["src/core/**"], exclude: [], packages: ["left-pad"],
  }, { where: "src/shell/", use: "node:fs/promises" });
  const fix = ruleFix(violation(banned.id, "src/core/read.ts", { spec: "left-pad" }), lock([banned]));
  expect(fix.deterministic).toBe(true);
  expect(fix.where).toBe("src/shell/");
  expect(fix.use).toBe("node:fs/promises");
  expect(fix.text).toContain("Put the code in src/shell/. Use node:fs/promises.");
});

test("an outside-layer file names the layer paths and a checked extension", () => {
  const analyzed = rule("core/CC-FN-001", { kind: "primitive", primitive: "metric", metric: "fn.lines" }, { paths: ["src/**"], exclude: [], max: 40 });
  const placement = rule("core/EVA-SCOPE-001", { kind: "primitive", primitive: "placement", cases: ["new-in-exclude", "no-language-pack-in-layer"] }, {
    paths: ["**"], exclude: [], extensions: ["py"],
  });
  const fix = ruleFix(violation(placement.id, "src/core/note.py", { placed: "no-language-pack-in-layer" }), lock([analyzed, placement]));
  expect(fix.where).toContain("src/core/");
  expect(fix.use).toContain(".ts");
  expect(fix.text).toContain("src/core/");
  expect(fix.text).toContain(".ts");
});

test("a new file in an excluded path names the include scope", () => {
  const placement = rule("core/EVA-SCOPE-001", { kind: "primitive", primitive: "placement", cases: ["new-in-exclude"] }, { paths: ["**"], exclude: [] });
  const fix = ruleFix(violation(placement.id, "src/generated/out.ts", { placed: "new-in-exclude" }), lock([placement]));
  expect(fix.deterministic).toBe(true);
  expect(fix.where).toContain("src/");
  expect(fix.use).toBe("a source file under those paths");
});

test("a rule with no path and no replacement says so and keeps the hint", () => {
  const metric = rule("core/CC-FN-002", { kind: "primitive", primitive: "metric", metric: "fn.params" }, { paths: ["**"], exclude: [], max: 3 }, {
    fix: "Group parameters that always travel together into a named domain type.",
  });
  const fix = ruleFix(violation(metric.id, "src/billing/invoice.ts"), lock([metric]));
  expect(fix.deterministic).toBe(false);
  expect(fix.where).toBeNull();
  expect(fix.use).toBeNull();
  expect(fix.text.startsWith("No deterministic path or replacement is declared for core/CC-FN-002.")).toBe(true);
  expect(fix.text).toContain("Group parameters that always travel together");
});

test("shell, protected, and syntax causes name a concrete action", () => {
  const shell = causeFix("shell-write", null, null, "the write target `/repo/src/core/written.ts` is inside the project");
  expect(shell.deterministic).toBe(true);
  expect(shell.text).toContain("src/core/written.ts");
  expect(shell.text).toContain("Write, Edit, or apply_patch");
  const guarded = causeFix("protected-path", ".pregate/pregate.lock.json", null, null);
  expect(guarded.text).toContain(".pregate/requests/<name>.json");
  expect(guarded.text).toContain("pregate preset apply <request.json> --preview");
  const syntax = causeFix("syntax", "src/billing/invoice.ts", 7, null);
  expect(syntax.text).toContain("src/billing/invoice.ts:7");
  const git = causeFix("git-missing", null, null, null);
  expect(git.deterministic).toBe(false);
  expect(git.text).toContain("Install Git");
  expect(git.text.startsWith("No code path is declared")).toBe(true);
});

test("the methodology schema accepts a fix hint and rejects an unknown key", () => {
  const doc = JSON.parse(readFileSync("packs/architecture/methodologies/clean-architecture.json", "utf8")) as { invariants: Record<string, unknown>[] };
  expect(validate("methodology", doc)).toEqual([]);
  const withFix = structuredClone(doc);
  withFix.invariants[0]!.fix = { where: "src/core/", use: "a module under src/core/" };
  expect(validate("methodology", withFix)).toEqual([]);
  const extra = structuredClone(doc);
  extra.invariants[0]!.fix = { where: "src/core/", extra: "no" };
  expect(validate("methodology", extra).length).toBeGreaterThan(0);
  const blank = structuredClone(doc);
  blank.invariants[0]!.fix = { where: "" };
  expect(validate("methodology", blank).some((error) => error.includes("must match"))).toBe(true);
});
