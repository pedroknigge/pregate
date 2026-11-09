import { expect, test } from "bun:test";
import { packCatalog } from "../src/compile.ts";
import { librarySource, librarySources } from "../src/library.ts";
import { matches } from "../src/paths.ts";
import { type CatalogEntry, catalogMatches, fixtureTarget, intentDraft, ruleIntent, ruleSlug, ruleTokens, snippetCases } from "../src/pack-template.ts";

// `rules add` turns a sentence into a catalog match or a drafted check; these are its pure parts.

const entries: CatalogEntry[] = librarySources().flatMap((pin) => {
  const catalog = packCatalog(librarySource(pin.ns)!);
  if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
  return catalog.methodologies.flatMap((m) => m.invariants.flatMap((alias) => {
    const check = catalog.checks.find((c) => c.id === alias.check);
    return check === undefined || (check.impl.kind === "primitive" && check.impl.primitive === "fitness") ? [] : [{ fqn: `${pin.ns}/${alias.id}`, methodology: m.id, alias, check }];
  }));
});

test("sentence tokens keep content words, singular, and drop folders, digits and filler", () => {
  expect(ruleTokens("The domain layer must not import src/infra modules directly", true)).toEqual(["domain", "import"]);
  expect(ruleTokens("HEX-EDGE-001 architecture/boundaries/domain-imports-adapter")).toEqual(["hex", "edge", "architecture", "boundarie", "domain", "import", "adapter"]);
  expect(ruleTokens("assertions process")).toEqual(["assertion", "process"]);
  expect(ruleSlug("UI components must not call fetch")).toBe("ui-component-call-fetch");
  expect(ruleSlug("must not")).toBe("rule");
});

test("a sentence matches only catalog rules that mention all of it, mostly in what they check", () => {
  expect(catalogMatches("domain must not import infra", entries).map((e) => e.fqn)[0]).toBe("architecture/HEX-EDGE-001");
  expect(catalogMatches("no non-null assertions", entries).map((e) => e.fqn)[0]).toBe("typescript/TS-BANG-001");
  expect(catalogMatches("keep things tidy", entries)).toEqual([]);
  expect(catalogMatches("UI components must not call fetch", entries)).toEqual([]);
  expect(catalogMatches("fetch", entries)).toEqual([]);
});

test("two sentence shapes are recognized: an import edge and a banned call", () => {
  expect(ruleIntent("The domain layer must not import from the infra layer.")).toEqual({ kind: "import-edge", from: "domain", to: "infra" });
  expect(ruleIntent("domain should not depend on adapters")).toEqual({ kind: "import-edge", from: "domain", to: "adapters" });
  expect(ruleIntent("UI components must not call fetch")).toEqual({ kind: "call-ban", callee: "fetch", subject: "UI components" });
  expect(ruleIntent("never use console.log()")).toEqual({ kind: "call-ban", callee: "console.log" });
  expect(ruleIntent("keep things tidy")).toBeNull();
});

test("intent drafts carry the minimum cases: two fails, a trap and two passes", () => {
  for (const intent of [ruleIntent("domain must not import infra")!, ruleIntent("never call fetch")!]) {
    const draft = intentDraft(intent);
    expect(draft.cases.map((c) => c.kind).sort()).toEqual(["fail", "fail", "pass", "pass", "trap"]);
    expect(new Set(draft.cases.map((c) => c.name)).size).toBe(5);
  }
  expect(intentDraft(ruleIntent("domain must not import infra")!).files).toBe("**/domain/**");
});

test("snippet cases add variants until the minimum, keeping the user's code first", () => {
  const ts = snippetCases(['import moment from "moment"; moment();'], ["export const t = Date.now();"], "typescript");
  expect(ts.map((c) => `${c.kind}/${c.name}`)).toEqual(["fail/fail-1", "fail/fail-2", "trap/nested", "pass/pass-1", "pass/pass-2"]);
  expect(ts[0]!.text).toBe('import moment from "moment"; moment();\n');
  expect(ts[2]!.text.endsWith('import moment from "moment"; moment();\n')).toBe(true);
  const py = snippetCases(["eval(x)", "eval(y)"], [], "python");
  expect(py.filter((c) => c.kind === "fail")).toHaveLength(2);
  expect(py.find((c) => c.kind === "trap")!.text).toBe("def outer():\n    def inner():\n        eval(x)\n    return inner\n");
  expect(py.filter((c) => c.kind === "pass").map((c) => c.text)).toEqual(['note = "eval(x)"\n', "unrelated = 1\n"]);
});

test("a fixture moves under a rule's files scope", () => {
  expect(fixtureTarget("src/components/**", "tmp/bad.tsx")).toBe("src/components/bad.tsx");
  expect(fixtureTarget("**/components/**", "bad.ts")).toBe("components/bad.ts");
  expect(fixtureTarget("src/**/*.tsx", "tmp/bad.ts")).toBe("src/bad.tsx");
  expect(fixtureTarget("src/a.ts", "tmp/bad.ts")).toBe("src/a.ts");
  for (const [glob, rel] of [["src/components/**", "x/y.ts"], ["**/components/**", "y.ts"], ["src/**/*.tsx", "y.ts"]] as const) {
    expect(matches(glob, fixtureTarget(glob, rel))).toBe(true);
  }
});

test("a banned package import is a third shape that drafts without code, and statements sort by what could check them", async () => {
  const { statementKind } = await import("../src/pack-template.ts");
  expect(ruleIntent("Never import moment")).toEqual({ kind: "package-ban", name: "moment" });
  expect(ruleIntent("Do not import from the lodash library.")).toEqual({ kind: "package-ban", name: "lodash" });
  expect(ruleIntent("No @prisma/client imports")).toEqual({ kind: "package-ban", name: "@prisma/client" });
  const draft = intentDraft(ruleIntent("never import moment")!);
  expect(draft.files).toBeUndefined();
  expect(draft.cases.map((c) => c.kind)).toEqual(["fail", "fail", "trap", "pass", "pass"]);
  expect(JSON.stringify(draft.patterns[0]!.rule)).toContain("^moment(/|$)");
  expect(["Never import moment", "Domain must not import infra.", "never use console.log()"].map(statementKind)).toEqual(["rule", "rule", "rule"]);
  expect(["Never use `any` in exported types.", "Avoid default exports.", "Components must not own queries."].map(statementKind)).toEqual(["example", "example", "example"]);
  expect(["Write clear code and prefer small functions.", "Always run the tests before you finish.", "Be concise.", "Ask before you push."].map(statementKind)).toEqual(["prose", "prose", "prose", "prose"]);
});
