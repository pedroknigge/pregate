import { expect, test } from "bun:test";
import {
  applyLabels, assertAgentSample, assertUniqueLabels, labelCounts, parseLabelFile, precisionRatio, precisionText, renderPrecision, strideSample,
  type FindingSite, type LabeledSample, type Labeler, type PackPrecision, type PrecisionReport, type SampleLabel,
} from "../scripts/precision.ts";

const site = (pack: string, rule: string, line: number): FindingSite => ({
  corpus: "express", pack, rule, path: "lib/app.js", line, symbol: "create",
});

function label(finding: FindingSite, verdict: SampleLabel["verdict"], note = "The finding matches the rule text."): SampleLabel {
  return { ...finding, verdict, note };
}

test("precision is true positives over labeled findings and is unmeasured at zero", () => {
  expect(precisionRatio(0, 0)).toBeNull();
  expect(precisionRatio(3, 1)).toBe(0.75);
  expect(precisionRatio(0, 4)).toBe(0);
  expect(precisionRatio(5, 0)).toBe(1);
  expect(precisionText({ pack: "redis", findings: 10, labeled: 0, truePositives: 0, falsePositives: 0, precision: null })).toBe("unmeasured");
  expect(precisionText({ pack: "clean-code", findings: 20, labeled: 4, truePositives: 3, falsePositives: 1, precision: 0.75 })).toBe("3/4");
});

test("unlabeled packs stay unmeasured and a sample does not absorb unlabeled findings", () => {
  const senior = [site("senior", "senior/SR-EQ-001", 1), site("senior", "senior/SR-EQ-001", 2), site("senior", "senior/SR-EQ-001", 3)];
  const redis = [site("redis", "redis/REDIS-KEY-001", 4)];
  const labels = [label(senior[0]!, "true-positive"), label(senior[1]!, "false-positive", "This == compares a value with null, which the rule allows.")];
  const applied = applyLabels(["senior", "redis", "go"], [...senior, ...redis], labels);
  expect(applied.unmatched).toEqual([]);
  expect(applied.packs.find((pack) => pack.pack === "senior")).toEqual({
    pack: "senior", findings: 3, labeled: 2, truePositives: 1, falsePositives: 1, precision: 0.5,
  });
  expect(applied.packs.find((pack) => pack.pack === "redis")?.precision).toBeNull();
  expect(applied.packs.find((pack) => pack.pack === "go")).toMatchObject({ findings: 0, labeled: 0, precision: null });
  const rendered = renderPrecision(report(applied.packs, labels));
  expect(rendered).toContain("| senior | 3 | 2 | 1 | 1 | 1/2 |");
  expect(rendered).toContain("| redis | 1 | 0 | 0 | 0 | unmeasured |");
  expect(rendered).not.toContain("redis | 1 | 0 | 0 | 0 | 0/");
});

test("a label that misses every finding is unmatched and duplicates are rejected", () => {
  const finding = site("node", "node/NODE-PREFIX-001", 8);
  const missed = label(site("node", "node/NODE-PREFIX-001", 9), "false-positive", "No call on this line imports a builtin.");
  const applied = applyLabels(["node"], [finding], [missed]);
  expect(applied.matched).toEqual([]);
  expect(applied.unmatched).toEqual([missed]);
  expect(applied.packs[0]?.precision).toBeNull();
  expect(() => assertUniqueLabels([label(finding, "true-positive"), label(finding, "false-positive", "Second note.")])).toThrow("duplicate label");
});

test("label files are maintainer samples with a note and a closed verdict", () => {
  const text = JSON.stringify({
    labeler: "maintainer", pack: "clean-code",
    items: [{ corpus: "express", pack: "clean-code", rule: "clean-code/CC-FN-001", path: "lib/app.js", line: 10, symbol: "app", verdict: "true-positive", note: "app occupies more lines than the rule's limit." }],
  });
  expect(parseLabelFile(text, "clean-code.json")).toHaveLength(1);
  expect(() => parseLabelFile(text.replace("maintainer", "model"), "clean-code.json")).toThrow("maintainer");
  expect(() => parseLabelFile(text.replace("true-positive", "correct"), "clean-code.json")).toThrow("verdict");
  expect(() => parseLabelFile(text.replace("app occupies more lines than the rule's limit.", "  "), "clean-code.json")).toThrow("note");
});

test("a label file names its labeler and each label keeps it", () => {
  const item = { corpus: "express", pack: "go", rule: "go/GO-FN-001", path: "lib/app.js", line: 10, symbol: "app", verdict: "true-positive", note: "app is longer than the limit." };
  const parsed = parseLabelFile(JSON.stringify({ labeler: "agent", pack: "go", items: [item] }), "go.agent.json");
  expect(parsed.map((label) => label.labeler)).toEqual(["agent"]);
  expect(parseLabelFile(JSON.stringify({ labeler: "maintainer", pack: "go", items: [item] }), "go.json")[0]?.labeler).toBe("maintainer");
  expect(() => parseLabelFile(JSON.stringify({ labeler: "reviewer", pack: "go", items: [item] }), "go.json")).toThrow("labeler must be maintainer or agent");
  expect(() => parseLabelFile(JSON.stringify({ pack: "go", items: [item] }), "go.json")).toThrow("missing labeler");
});

test("the agent sample is fixed by the number of findings and an agent label outside it is rejected", () => {
  const go = Array.from({ length: 12 }, (_, index) => site("go", "go/GO-FN-001", index + 1));
  expect(strideSample(go).map((finding) => finding.line)).toEqual([1, 3, 5, 8, 10]);
  expect(strideSample(go.slice(0, 3)).map((finding) => finding.line)).toEqual([1, 2, 3]);
  expect(strideSample([])).toEqual([]);
  const node = [site("node", "node/NODE-SYNC-001", 40)];
  const inside = labeled(label(go[2]!, "true-positive"), "agent");
  const outside = labeled(label(go[1]!, "true-positive"), "agent");
  expect(() => assertAgentSample([...go, ...node], [inside, labeled(label(node[0]!, "true-positive"), "agent")])).not.toThrow();
  expect(() => assertAgentSample([...go, ...node], [outside])).toThrow("agent label outside the stride sample: go go/GO-FN-001 lib/app.js:2");
  expect(() => assertAgentSample([...go, ...node], [labeled(label(go[1]!, "true-positive"), "maintainer")])).not.toThrow();
});

test("the page separates maintainer labels, agent labels and resolved false positives", () => {
  const senior = [site("senior", "senior/SR-EQ-001", 1), site("senior", "senior/SR-EQ-001", 2)];
  const go = [site("go", "go/GO-FN-001", 3)];
  const gone = labeled(label(site("redis", "redis/REDIS-KEY-001", 9), "false-positive", "app.get registers a route."), "maintainer");
  const labels = [
    labeled(label(senior[0]!, "true-positive"), "maintainer"),
    labeled(label(senior[1]!, "false-positive", "This == compares with null."), "agent"),
    labeled(label(go[0]!, "true-positive", "The function is longer than the limit."), "agent"),
    gone,
  ];
  const applied = applyLabels(["senior", "go", "redis"], [...senior, ...go], labels);
  expect(applied.unmatched).toEqual([gone]);
  const full: PrecisionReport = { ...report(applied.packs, []), sample: applied.matched, resolved: applied.unmatched, labels: labelCounts(applied.matched, applied.unmatched) };
  expect(full.labels).toEqual({ maintainer: 1, agent: 2, resolved: 1 });
  const rendered = renderPrecision(full);
  expect(rendered).toContain("| senior | 2 | 2 | 1 | 1 | 1/2 | maintainer 1, agent 1 |");
  expect(rendered).toContain("| go | 1 | 1 | 1 | 0 | 1/1 | agent 1 |");
  expect(rendered).toContain("| redis | 0 | 0 | 0 | 0 | unmeasured | - |");
  expect(rendered).toContain("The maintainer wrote 1 of these labels and an AI coding agent wrote 2. Agent labels are not an independent human review. 1 earlier false-positive label no longer matches a finding and is listed as resolved.");
  const agentSection = rendered.slice(rendered.indexOf("## Agent-labeled sample"), rendered.indexOf("## Resolved false positives"));
  expect(agentSection).toContain("They are not an independent human review");
  expect(agentSection).toContain("The function is longer than the limit.");
  expect(agentSection).not.toContain("app.get registers a route.");
  const maintainerSection = rendered.slice(rendered.indexOf("## Maintainer-labeled sample"), rendered.indexOf("## Agent-labeled sample"));
  expect(maintainerSection).not.toContain("This == compares with null.");
  expect(rendered.slice(rendered.indexOf("## Resolved false positives"))).toContain("| maintainer | redis | `redis/REDIS-KEY-001` | express `lib/app.js:9` `create` | app.get registers a route. |");
  expect(rendered).toContain("Packs with no finding on this corpus, so there is nothing to label (1): `redis`.");
});

function labeled(item: SampleLabel, labeler: Labeler): LabeledSample {
  return { ...item, labeler };
}

function report(packs: PackPrecision[], sample: SampleLabel[]): PrecisionReport {
  const maintainer = sample.map((item) => labeled(item, "maintainer"));
  return {
    schemaVersion: 2, engine: "0.0.2", core: "0.0.1", labels: labelCounts(maintainer, []),
    corpus: [{ id: "express", language: "javascript", kind: "git", url: "https://github.com/expressjs/express.git", commit: "1".repeat(40), sourceFiles: 3, parsed: 3 }],
    packs, sample: maintainer, resolved: [], limits: ["A pack with no matching maintainer label is unmeasured."],
  };
}
