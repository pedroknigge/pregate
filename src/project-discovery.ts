import { closeSync, openSync, readSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { sha256 } from "./state.ts";
import { workspacePaths } from "./workspace.ts";
import type { Files } from "./types.ts";

export function discoverDocumentation(root: string) {
  const paths = workspacePaths(root, path => /(^|\/)(readme[^/]*\.md|docs\/.*\.(md|mdx|rst)|adr\/.*\.md)$/i.test(path)).sort((a, b) => Number(!/^readme/i.test(a)) - Number(!/^readme/i.test(b)) || a.localeCompare(b));
  const requirements: { path: string; line: number; statement: string; sourceHash: string }[] = [];
  const scanned: string[] = [], skipped: string[] = [];
  let bytes = 0;
  for (const path of paths) {
    const file = join(root, path), limit = Math.min(128 * 1024, 2 * 1024 * 1024 - bytes);
    if (scanned.length >= 40 || statSync(file).size > limit) { skipped.push(path); continue; }
    const text = boundedDocumentation(file, limit);
    if (text === null) { skipped.push(path); continue; }
    const size = Buffer.byteLength(text);
    bytes += size; scanned.push(path);
    for (const { line, statement } of documentationStatements(text)) {
      if (requirements.length >= 12 || statement.length < 20 || statement.length > 600
        || parameterDescription(statement) || !/\b(must|shall|required|deben?|obligatori[oa]|tiene que)\b/i.test(statement)
        || requirements.some(item => item.statement === statement)) continue;
      requirements.push({ path, line, statement, sourceHash: sha256(text) });
    }
  }
  const slug = basename(root).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return { scanned, skipped, requirements, customPack: { ns: "project-" + (slug || "rules"),
    reason: requirements.length ? `${requirements.length} documentation candidates may become project assertions after source and relevance review.` : "Review the repo's domain terms and boundaries to choose project rules; no documented requirement was inferred.",
    status: "proposal; no test or semantic coverage is inferred", next: "Review the statements and their sources. Draft a custom pack together with the suggested official packs; bind real project checks before claiming compliance." } };
}

// Keep wrapped paragraphs and list items together. A keyword on one line can be
// a fragment of an API explanation; reviewers need the whole bounded statement.
export function documentationStatements(text: string): { line: number; statement: string }[] {
  const statements: { line: number; statement: string }[] = [];
  let fenced = false, start = 0, parts: string[] = [];
  const flush = () => {
    if (parts.length) statements.push({ line: start, statement: parts.join(" ") });
    parts = [];
  };
  for (const [i, raw] of text.replace(/^\uFEFF/, "").split("\n").entries()) {
    if (/^\s*(```|~~~)/.test(raw)) { flush(); fenced = !fenced; continue; }
    if (fenced) continue;
    if (!raw.trim() || /^\s*#{1,6}\s/.test(raw)) { flush(); continue; }
    const list = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(raw);
    if (list) flush();
    if (!parts.length) start = i + 1;
    parts.push(raw.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim());
  }
  flush();
  return statements;
}

function parameterDescription(statement: string): boolean {
  return /^[`*]*[\w.$-]+[`*]*\s*\(required\)[*]*\s*:/i.test(statement)
    || /^\|[^|]+\|\s*(?:required|yes)\s*\|/i.test(statement);
}

function boundedDocumentation(path: string, limit: number): string | null {
  return documentationText(openSync(path, "r"), Buffer.alloc(limit + 1), limit);
}

function documentationText(file: number, buffer: Buffer, limit: number): string | null {
  try {
    let size = 0;
    while (size < buffer.length) {
      const count = readSync(file, buffer, size, buffer.length - size, null);
      if (!count) break;
      size += count;
    }
    return size > limit ? null : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, size));
  } finally { closeSync(file); }
}

// A project-specific draft is data only. Fixture receipts test the fitness primitive,
// never establish evidence for the customer's project.
export function documentationPack(discovery: ReturnType<typeof discoverDocumentation>): { ns: string; files: Files } | null {
  if (!discovery.requirements.length) return null;
  const ns = discovery.customPack.ns, files: Files = {}, json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  files["source.json"] = json({ ns, version: "1.0.0", category: "invariants" });
  const invariants = discovery.requirements.map((item, i) => {
    const requirement = `PROJECT-DOC-${String(i + 1).padStart(3, "0")}`, verifier = `${ns}/${requirement}`, check = `${ns}/requirements/doc-${i + 1}`, dir = `checks/requirements/doc-${i + 1}`;
    files[`${dir}/check.json`] = json({ id: check, version: "1.0.0", area: "requirements", cardinality: "singleton", dimension: `project.${ns}.doc-${i + 1}`, minSeverity: null,
      params: { verifier: { type: "string", pattern: "\\S" } }, impl: { kind: "primitive", primitive: "fitness", requirement }, phase: ["stop", "commit", "ci"], feedback: { message: `${requirement} needs reviewed project evidence: {symbol}.` } });
    for (const [name, code, receiptKind] of [["pass/current", "pass", "current"], ["pass/new-contract", "pass", "new"], ["fail/no-evidence", "fail", "missing"], ["fail/failed-assertion", "fail", "failed"], ["trap/stale-inputs", "fail", "stale"]] as const) {
      const contractHash = receiptKind === "new" ? "fixture-contract-2" : "fixture-contract";
      files[`${dir}/fixtures/${name}/files/.pregate/preset.json.fixture`] = "{}\n";
      files[`${dir}/fixtures/${name}/fixture.json`] = json({ language: "typescript", params: { verifier }, target: ".pregate/preset.json", before: null,
        context: { fitness: { contractHash, inputHash: "fixture-input", command: ["fixture-verifier"], receipt: receiptKind === "missing" ? null : { schemaVersion: 1, verifier, contractHash, inputHash: receiptKind === "stale" ? "old-input" : "fixture-input", command: ["fixture-verifier"], completed: true, exitCode: receiptKind === "failed" ? 1 : 0, recordedAt: "2026-10-07T00:00:00Z" } } },
        expect: { verdict: code, ...(code === "fail" ? { violations: [{ line: 1 }] } : {}) },
        ...(name.startsWith("trap/") ? { trap: { family: "stale-project-assertion", origin: "forge", discovered: "2026-10-07", note: "A prior green receipt does not establish evidence for changed inputs." } } : {}) });
    }
    return { id: requirement, check, defaults: { verifier }, severity: "deny", source: { work: "Project documentation (review before adoption)", locator: `${item.path}:${item.line}; SHA-256 ${item.sourceHash}`, paraphrase: item.statement },
      why: item.statement, fixHint: "Read this requirement and its source. Bind a bounded project assertion with positive and invalid controls, reviewed input globs and a coverage rationale; run it before claiming compliance.",
      avoid: "Document extraction is a suggestion. Fixtures only test the checker; they do not prove the project requirement. Reject irrelevant statements during review.", examples: { pass: "pass/current", fail: "fail/no-evidence" } };
  });
  files["methodologies/documented-requirements.json"] = json({ id: `${ns}/documented-requirements`, version: "1.0.0", status: "preview", conflicts: [], invariants });
  files["README.md"] = `# ${ns}\n\nDrafted from local documentation. Review every requirement and source before approval. These are unverified project assertions, not syntax guarantees. No executable command is supplied. Run pregate fitness plan and bind meaningful project checks.\n`;
  return { ns, files };
}
