import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { labelCounts, packStatus, parseLabelFile, precisionText, renderPrecision, siteKey, statusText, type LabeledSample, type PrecisionReport } from "../scripts/precision.ts";

const root = join(import.meta.dir, "..");
const labeledKey = (label: LabeledSample) => `${label.labeler}\0${label.verdict}\0${siteKey(label)}`;

test("the guide reports sample precision only for labeled packs and says who labeled them", () => {
  const report = JSON.parse(readFileSync(join(root, "bench/precision-report.json"), "utf8")) as PrecisionReport;
  const guide = readFileSync(join(root, "docs/guides/rule-precision.md"), "utf8");
  const start = guide.indexOf("<!-- BEGIN measured precision -->");
  const end = guide.indexOf("<!-- END measured precision -->");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const body = guide.slice(start + "<!-- BEGIN measured precision -->".length, end).trim();
  expect(body).toBe(renderPrecision(report).trim());
  const labels = labeledItems();
  expect(labels.map(labeledKey).sort()).toEqual([...report.sample, ...report.resolved].map(labeledKey).sort());
  expect(report.labels).toEqual(labelCounts(report.sample, report.resolved));
  expect(report.resolved.every((label) => label.verdict === "false-positive")).toBe(true);
  for (const pack of report.packs) {
    const row = `| ${pack.pack} | ${pack.findings} | ${pack.labeled} | ${pack.truePositives} | ${pack.falsePositives} | ${pack.uncertain} | ${precisionText(pack)} | ${statusText(pack.status)} |`;
    expect(guide).toContain(row);
    expect(pack.labeled).toBe(report.sample.filter((label) => label.pack === pack.pack).length);
    expect(pack.labeled).toBe(pack.truePositives + pack.falsePositives + pack.uncertain);
    if (pack.precision === null) expect(pack.truePositives + pack.falsePositives).toBe(0);
    else expect(pack.precision).toBe(pack.truePositives / (pack.truePositives + pack.falsePositives));
    expect(pack.status).toBe(packStatus(pack.labeled, pack.precision));
  }
  expect(report.packs.some((pack) => pack.precision === null)).toBe(true);
  expect(report.packs.some((pack) => pack.precision !== null)).toBe(true);
});

test("agent labels are named as agent labels and are not presented as a human review", () => {
  const report = JSON.parse(readFileSync(join(root, "bench/precision-report.json"), "utf8")) as PrecisionReport;
  const guide = readFileSync(join(root, "docs/guides/rule-precision.md"), "utf8");
  const agent = report.sample.filter((label) => label.labeler === "agent");
  expect(agent.length).toBe(report.labels.agent);
  expect(guide).toContain(`The maintainer wrote ${report.labels.maintainer} of these labels and an AI coding agent wrote ${report.labels.agent}. Agent labels are not an independent human review.`);
  const maintainerSection = guide.slice(guide.indexOf("## Maintainer-labeled sample"), guide.indexOf("## Agent-labeled sample"));
  for (const label of agent) expect(maintainerSection).not.toContain(`\`${label.path}:${label.line}\` \`${label.symbol}\` | ${label.note.replaceAll("|", "\\|")} |`);
});

// The manifest status is what `pregate pack list`, `pack show`, the pack README and docs/packs.md print.
// `pack add` selects only complete methodologies, so a pack below the bar must not have one.
test("a bundled pack that the measurement does not validate has no complete methodology", () => {
  const report = JSON.parse(readFileSync(join(root, "bench/precision-report.json"), "utf8")) as PrecisionReport;
  const measured = new Map(report.packs.map((pack) => [pack.pack, pack.status]));
  const complete: string[] = [];
  const unlisted: string[] = [];
  for (const ns of bundledPacks()) {
    const status = measured.get(ns);
    if (status === undefined) unlisted.push(ns);
    if (status === "validated") continue;
    const dir = join(root, "packs", ns, "methodologies");
    for (const name of readdirSync(dir).filter((file) => file.endsWith(".json")).sort()) {
      const manifest = JSON.parse(readFileSync(join(dir, name), "utf8")) as { id: string; status: string };
      if (manifest.status !== "preview") complete.push(`${manifest.id} (${status ?? "not in the report"})`);
    }
  }
  expect(unlisted).toEqual([]);
  expect(complete).toEqual([]);
  expect(report.packs.filter((pack) => pack.status === "validated").map((pack) => pack.pack).sort()).toEqual(
    ["architecture", "clean-code", "go", "javascript", "maintainability", "mattpocock", "musk", "node", "senior"]);
});

function bundledPacks(): string[] {
  const dir = join(root, "packs");
  return readdirSync(dir).filter((name) => existsSync(join(dir, name, "source.json"))).sort();
}

function labeledItems(): LabeledSample[] {
  const dir = join(root, "bench/labels");
  return readdirSync(dir).filter((name) => name.endsWith(".json")).sort()
    .flatMap((name) => parseLabelFile(readFileSync(join(dir, name), "utf8"), name));
}
