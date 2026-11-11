// Sample precision for a pack audit. A pack with no matching label stays unmeasured.
// Precision is true positives / labeled findings, and it does not describe unlabeled findings.
// Every label names who wrote it: the maintainer, or an AI coding agent. The report keeps them apart.

export type SampleVerdict = "true-positive" | "false-positive";
export type Labeler = "maintainer" | "agent";
export const LABELERS: Labeler[] = ["maintainer", "agent"];
export const AGENT_SAMPLE = 5;

export interface FindingSite {
  corpus: string;
  pack: string;
  rule: string;
  path: string;
  line: number;
  symbol: string;
}

export interface SampleLabel extends FindingSite {
  verdict: SampleVerdict;
  note: string;
}

// A label as read from a file: the item plus the labeler its file names.
export interface LabeledSample extends SampleLabel {
  labeler: Labeler;
}

export interface LabelCounts {
  maintainer: number;
  agent: number;
  resolved: number;
}

export interface PackPrecision {
  pack: string;
  findings: number;
  labeled: number;
  truePositives: number;
  falsePositives: number;
  precision: number | null;
}

export interface CorpusRow {
  id: string;
  language: string;
  kind: "git" | "path";
  url: string | null;
  commit: string;
  sourceFiles: number;
  parsed: number;
}

// `sample` holds the labels that match a finding. `resolved` holds false-positive labels whose site
// the rules no longer report. `labels` counts the sample by labeler, and the resolved labels.
export interface PrecisionReport {
  schemaVersion: 2;
  engine: string;
  core: string;
  labels: LabelCounts;
  corpus: CorpusRow[];
  packs: PackPrecision[];
  sample: LabeledSample[];
  resolved: LabeledSample[];
  limits: string[];
}

export const LIMITS = [
  "Sample precision is true positives divided by the labeled findings of that pack. Unlabeled findings are not in the denominator and have no precision.",
  "A pack with no matching label is unmeasured. This report does not give it a precision.",
  "A sample of five or six findings does not estimate the precision of a pack with hundreds of findings. It says whether the sampled findings match the rule.",
  "Agent labels were written by an AI coding agent. They are not an independent human review, and the maintainer has not confirmed them. The Labeled by column separates them from maintainer labels.",
  "A resolved false positive says the rule no longer reports that site. It is not evidence about the findings that remain.",
  "A label says whether the finding matches the rule's stated condition. It is not a judgment that a project should adopt the rule.",
  "The corpus is the pinned commits in the manifest. It is not a random sample of public code.",
  "The audit records static matches in the checked-out tree. It is not the no-new ratchet used on an edit, and it does not run fitness, diff, or placement checks.",
  "Vue and Svelte single-file components use the TypeScript grammar. This corpus has no .vue or .svelte file, so a zero there is not evidence about those rules.",
  "Tracked files under node_modules, vendor, dist, build, coverage, .next, or target are not scanned. Symlinks are not followed.",
];

const FILE_KEYS = ["labeler", "pack", "items"];
const ITEM_KEYS = ["corpus", "pack", "rule", "path", "line", "symbol", "verdict", "note"];

export function siteKey(site: FindingSite): string {
  return [site.corpus, site.pack, site.rule, site.path, String(site.line), site.symbol].join("\0");
}

export function precisionRatio(truePositives: number, falsePositives: number): number | null {
  const labeled = truePositives + falsePositives;
  if (labeled === 0) return null;
  return truePositives / labeled;
}

export function precisionText(row: PackPrecision): string {
  if (row.precision === null || row.labeled === 0) return "unmeasured";
  return `${row.truePositives}/${row.labeled}`;
}

export function applyLabels<T extends SampleLabel>(packNames: string[], findings: FindingSite[], labels: T[]): {
  packs: PackPrecision[];
  matched: T[];
  unmatched: T[];
} {
  const known = new Set(findings.map(siteKey));
  const byPack = groupFindings(packNames, findings);
  const split = splitLabels(labels, known);
  const packs = [...byPack.entries()].map(([pack, rows]) => packRow(pack, rows, split.byKey));
  packs.sort(byVolume);
  return { packs, matched: split.matched, unmatched: split.unmatched };
}

export function parseLabelFile(text: string, file: string): LabeledSample[] {
  const doc = record(parseJson(text, file), file);
  exactKeys(doc, FILE_KEYS, file);
  const labeler = labelerOf(stringField(doc, "labeler", file), file);
  const pack = stringField(doc, "pack", file);
  return arrayField(doc, "items", file).map((item, index) => ({ ...parseItem(item, pack, `${file}#${index}`), labeler }));
}

// The sites an agent may label in one pack. The findings must be that pack's findings in the
// stable order of the findings file. The positions are fixed by the count, so nobody picks them.
export function strideSample<T extends FindingSite>(findings: T[], size = AGENT_SAMPLE): T[] {
  const count = Math.min(size, findings.length);
  const picked: T[] = [];
  for (let i = 0; i < count; i += 1) picked.push(findings[Math.floor((i * findings.length) / count)]!);
  return picked;
}

// An agent label outside its pack's stride sample is an error: the agent may not choose its sites.
// `recorded` holds the sites offered in earlier runs. A rule change moves the stride positions,
// and a label written before the change stays valid for the site it was offered.
export function assertAgentSample(findings: FindingSite[], labels: LabeledSample[], recorded: FindingSite[] = []): void {
  const allowed = new Set<string>(recorded.map(siteKey));
  for (const rows of groupFindings([], findings).values()) for (const site of strideSample(rows)) allowed.add(siteKey(site));
  const known = new Set(findings.map(siteKey));
  for (const label of labels) {
    if (label.labeler !== "agent" || !known.has(siteKey(label)) || allowed.has(siteKey(label))) continue;
    throw new Error(`agent label outside the stride sample: ${label.pack} ${label.rule} ${label.path}:${label.line}`);
  }
}

export function labelCounts(sample: LabeledSample[], resolved: LabeledSample[]): LabelCounts {
  const by = (labeler: Labeler) => sample.filter((item) => item.labeler === labeler).length;
  return { maintainer: by("maintainer"), agent: by("agent"), resolved: resolved.length };
}

export function assertUniqueLabels(labels: SampleLabel[]): void {
  const seen = new Set<string>();
  for (const label of labels) {
    const key = siteKey(label);
    if (seen.has(key)) throw new Error(`duplicate label for ${label.pack} ${label.rule} ${label.path}:${label.line}`);
    seen.add(key);
  }
}

export function renderPrecision(report: PrecisionReport): string {
  const lines = [
    "## Measured sample precision",
    "",
    intro(report),
    "",
    `Engine ${report.engine}, core ${report.core}.`,
    "",
    "Labeled sample: " + sampleSummary(report) + ". Packs that do not appear in that sample are unmeasured.",
    "",
    labelerSummary(report),
    "",
    ...methodSection(),
    ...corpusSection(report),
    ...countSection(report),
    ...unmeasuredSection(report),
    ...sampleSection(report, "maintainer"),
    ...sampleSection(report, "agent"),
    ...resolvedSection(report),
    "## Limits",
    "",
    ...report.limits.map((limit) => `- ${limit}`),
    "",
    "## Reproduce",
    "",
    "```sh",
    "bun scripts/bench-audit-repos.ts --precision \\",
    "  --corpus bench/corpus.json \\",
    "  --labels bench/labels \\",
    "  --cache .cache/precision \\",
    "  --out bench/precision-report.json \\",
    "  --markdown bench/precision.md",
    "```",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function groupFindings(packNames: string[], findings: FindingSite[]): Map<string, FindingSite[]> {
  const byPack = new Map<string, FindingSite[]>();
  for (const name of packNames) byPack.set(name, []);
  for (const finding of findings) {
    const list = byPack.get(finding.pack) ?? [];
    list.push(finding);
    byPack.set(finding.pack, list);
  }
  return byPack;
}

function splitLabels<T extends SampleLabel>(labels: T[], known: Set<string>): {
  matched: T[];
  unmatched: T[];
  byKey: Map<string, SampleLabel>;
} {
  const matched: T[] = [];
  const unmatched: T[] = [];
  const byKey = new Map<string, SampleLabel>();
  for (const label of labels) {
    const key = siteKey(label);
    if (!known.has(key)) unmatched.push(label);
    else { matched.push(label); byKey.set(key, label); }
  }
  return { matched, unmatched, byKey };
}

function packRow(pack: string, rows: FindingSite[], labels: Map<string, SampleLabel>): PackPrecision {
  let truePositives = 0;
  let falsePositives = 0;
  for (const row of rows) {
    const label = labels.get(siteKey(row));
    if (!label) continue;
    if (label.verdict === "true-positive") truePositives += 1;
    else falsePositives += 1;
  }
  const labeled = truePositives + falsePositives;
  return { pack, findings: rows.length, labeled, truePositives, falsePositives, precision: precisionRatio(truePositives, falsePositives) };
}

function byVolume(a: PackPrecision, b: PackPrecision): number {
  if (b.findings !== a.findings) return b.findings - a.findings;
  if (a.pack < b.pack) return -1;
  if (a.pack > b.pack) return 1;
  return 0;
}

function parseItem(value: unknown, pack: string, at: string): SampleLabel {
  const item = record(value, at);
  exactKeys(item, ITEM_KEYS, at);
  const got = stringField(item, "pack", at);
  if (got !== pack) throw new Error(`${at}: pack ${got} does not match ${pack}`);
  const verdict = verdictOf(stringField(item, "verdict", at), at);
  const note = stringField(item, "note", at);
  if (note.trim() === "") throw new Error(`${at}: note must explain the verdict`);
  return {
    corpus: stringField(item, "corpus", at), pack, rule: stringField(item, "rule", at),
    path: stringField(item, "path", at), line: lineOf(item.line, at), symbol: stringField(item, "symbol", at), verdict, note,
  };
}

function labelerOf(value: string, at: string): Labeler {
  if (value === "maintainer" || value === "agent") return value;
  throw new Error(`${at}: labeler must be maintainer or agent`);
}

function verdictOf(value: string, at: string): SampleVerdict {
  if (value === "true-positive" || value === "false-positive") return value;
  throw new Error(`${at}: verdict must be true-positive or false-positive`);
}

function lineOf(value: unknown, at: string): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) return value;
  throw new Error(`${at}: line must be a positive integer`);
}

function intro(report: PrecisionReport): string {
  const files = report.corpus.reduce((sum, row) => sum + row.sourceFiles, 0);
  const findings = report.packs.reduce((sum, row) => sum + row.findings, 0);
  const labeled = report.packs.filter((row) => row.precision !== null);
  return `This run audited ${report.packs.length} packs on ${report.corpus.length} pinned ${report.corpus.length === 1 ? "tree" : "trees"} (${files} source files) and recorded **${findings} findings**. Sample precision is shown for ${labeled.length} labeled ${labeled.length === 1 ? "pack" : "packs"}. Every other pack is unmeasured.`;
}

function labelerSummary(report: PrecisionReport): string {
  const counts = report.labels;
  const resolved = counts.resolved === 0 ? ""
    : ` ${counts.resolved} earlier false-positive ${counts.resolved === 1 ? "label no longer matches" : "labels no longer match"} a finding and ${counts.resolved === 1 ? "is" : "are"} listed as resolved.`;
  return `The maintainer wrote ${counts.maintainer} of these labels and an AI coding agent wrote ${counts.agent}. Agent labels are not an independent human review.${resolved}`;
}

function labeledBy(report: PrecisionReport, pack: string): string {
  const parts: string[] = [];
  for (const labeler of LABELERS) {
    const count = report.sample.filter((item) => item.pack === pack && item.labeler === labeler).length;
    if (count > 0) parts.push(`${labeler} ${count}`);
  }
  return parts.length ? parts.join(", ") : "-";
}

function sampleSummary(report: PrecisionReport): string {
  const tp = report.sample.filter((item) => item.verdict === "true-positive").length;
  const fp = report.sample.filter((item) => item.verdict === "false-positive").length;
  return `${tp} true-positive, ${fp} false-positive`;
}

function methodSection(): string[] {
  return [
    "## Method",
    "",
    "1. Shallow-fetch each git entry at its pinned commit into `.cache/precision` (or `--cache`). Reuse a clean cache whose HEAD is that commit. Check the scanned source sha256 against the manifest. With `--skip-offline`, a failed fetch leaves the written report untouched. A path entry must already be a checkout of its commit.",
    "2. For each pack, compile a shadow preset of the builtin core plus that pack's methodologies. If those methodologies do not compile together, compile each one on its own. Count static findings from the same file audit `pregate audit` uses. One finding is one site: corpus, pack, rule, path, line, and symbol.",
    "3. Read every file in `bench/labels`. Each file names one pack and one labeler, `maintainer` or `agent`, and holds labels: `true-positive` or `false-positive`, plus a note. A `true-positive` label that does not match a finding is an error. A `false-positive` label that does not match a finding is recorded as resolved: the rules no longer report that site. Precision is `true-positive / (true-positive + false-positive)` for packs with at least one matching label.",
    `4. An agent does not choose the findings it labels. Take the findings of one pack in the order of the \`--findings\` file (sorted as text by corpus, pack, rule, path, line and symbol). With n findings and k the smaller of ${AGENT_SAMPLE} and n, the sample is the findings at positions floor(i × n / k) for i from 0 to k − 1. \`bench/agent-sample.json\` records the sites offered so far, and \`--sample <file>\` writes that record plus the sample of this run. An agent label for a site that is not in the record or in the sample of this run is an error. A rule change moves the positions; a label written before the change keeps the site it was offered.`,
    "",
    "Engine and core versions are recorded on the report. Re-running the command on the same pins and the same engine reproduces the counts.",
    "",
  ];
}

function corpusSection(report: PrecisionReport): string[] {
  const rows = report.corpus.map((row) => `| ${row.id} | ${row.language} | ${row.kind} | \`${row.commit}\` | ${row.sourceFiles} | ${row.parsed} |`);
  const urls = report.corpus.filter((row) => row.url).map((row) => `- ${row.id}: ${row.url}`);
  return [
    "## Corpus",
    "",
    "| Id | Language | Kind | Commit | Source files | Parsed |",
    "| --- | --- | --- | --- | ---: | ---: |",
    ...rows,
    "",
    ...urls,
    "",
  ];
}

function countSection(report: PrecisionReport): string[] {
  const rows = report.packs.map((row) => `| ${row.pack} | ${row.findings} | ${row.labeled} | ${row.truePositives} | ${row.falsePositives} | ${precisionText(row)} | ${labeledBy(report, row.pack)} |`);
  return [
    "## Per-pack counts",
    "",
    "A fraction is the labeled sample only. Labeled by says how many of those labels the maintainer wrote and how many an agent wrote. Unmeasured means this report states no precision for that pack.",
    "",
    "| Pack | Findings | Labeled | True positives | False positives | Sample precision | Labeled by |",
    "| --- | ---: | ---: | ---: | ---: | --- | --- |",
    ...rows,
    "",
  ];
}

function unmeasuredSection(report: PrecisionReport): string[] {
  const open = report.packs.filter((row) => row.labeled === 0);
  const withFindings = open.filter((row) => row.findings > 0).map((row) => `\`${row.pack}\` (${row.findings})`);
  const silent = open.filter((row) => row.findings === 0).map((row) => `\`${row.pack}\``);
  return [
    "## Unmeasured packs",
    "",
    `Packs with findings and no matching label: ${withFindings.length ? withFindings.join(", ") : "none"}.`,
    "",
    `Packs with no finding on this corpus, so there is nothing to label (${silent.length}): ${silent.length ? silent.join(", ") : "none"}. A zero here is not evidence that those rules are precise.`,
    "",
  ];
}

const SAMPLE_TEXT: Record<Labeler, { title: string; lead: string }> = {
  maintainer: {
    title: "## Maintainer-labeled sample",
    lead: "These notes were written by the maintainer after reading the pinned source at that line. They are not a model-graded score.",
  },
  agent: {
    title: "## Agent-labeled sample",
    lead: "These notes were written by an AI coding agent after reading the pinned source at that line. The agent did not choose the sites (Method, step 4). They are not an independent human review, and the maintainer has not confirmed them.",
  },
};

function sampleRow(item: SampleLabel): string {
  return `| ${item.verdict} | ${item.pack} | \`${item.rule}\` | ${item.corpus} \`${item.path}:${item.line}\` \`${item.symbol}\` | ${cell(item.note)} |`;
}

function sampleSection(report: PrecisionReport, labeler: Labeler): string[] {
  const text = SAMPLE_TEXT[labeler];
  const items = report.sample.filter((item) => item.labeler === labeler);
  if (items.length === 0) return [text.title, "", "No finding was labeled.", ""];
  return [
    text.title,
    "",
    text.lead,
    "",
    "| Verdict | Pack | Rule | Location | Note |",
    "| --- | --- | --- | --- | --- |",
    ...items.map(sampleRow),
    "",
  ];
}

function resolvedSection(report: PrecisionReport): string[] {
  if (report.resolved.length === 0) return [];
  const rows = report.resolved.map((item) => `| ${item.labeler} | ${item.pack} | \`${item.rule}\` | ${item.corpus} \`${item.path}:${item.line}\` \`${item.symbol}\` | ${cell(item.note)} |`);
  return [
    "## Resolved false positives",
    "",
    "Each row is a false-positive label whose site the rules no longer report. These rows are not in any count above.",
    "",
    "| Labeled by | Pack | Rule | Location | Note |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ];
}

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function parseJson(text: string, file: string): unknown {
  try { return JSON.parse(text) as unknown; }
  catch { throw new Error(`${file}: invalid JSON`); }
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${at}: expected an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: string[], at: string): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`${at}: unknown field ${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) throw new Error(`${at}: missing ${key}`);
  }
}

function stringField(value: Record<string, unknown>, key: string, at: string): string {
  const got = value[key];
  if (typeof got !== "string" || got === "") throw new Error(`${at}: ${key} must be a non-empty string`);
  return got;
}

function arrayField(value: Record<string, unknown>, key: string, at: string): unknown[] {
  const got = value[key];
  if (!Array.isArray(got)) throw new Error(`${at}: ${key} must be an array`);
  return got;
}
