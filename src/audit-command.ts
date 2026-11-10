import { closeSync, fstatSync, openSync, readFileSync, readSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { applyPreset } from "./approval-command.ts";
import { auditFile, auditRules, auditSummaryCollector, type AuditError, type AuditFinding } from "./audit.ts";
import { LANGUAGE_COVERAGE } from "./capabilities.ts";
import { enforcementOf } from "./enforcement.ts";
import { visible } from "./contract.ts";
import { canonical, findRoot } from "./disk.ts";
import { delegate, grammars, LOCK, PRESET, readText } from "./gate.ts";
import { tsconfigNotice } from "./resolve.ts";
import { inScope } from "./paths.ts";
import { normalize } from "./reconstruct.ts";
import { contractState } from "./status.ts";
import { sha256 } from "./state.ts";
import { grammarOf } from "./ts.ts";
import { missingLanguagePolicy, ruleLanguages, staticRulesFor } from "./languages.ts";
import { workspacePaths } from "./workspace.ts";
import { projectFitness } from "./fitness-command.ts";
import { fileRole, refactorPlan, refactorPlanText } from "./refactor-plan.ts";
import { sarifReport } from "./sarif.ts";
import type { Lock, LockRule, Preset, Read } from "./types.ts";
import { cachedAnalysis, openAuditCache, rememberAnalysis, saveAuditCache, type AuditCache } from "./audit-cache.ts";
import { writeAll } from "./write-all.ts";

const EVALUATOR = (require("./embedded.ts") as typeof import("./embedded.ts")).evaluator();

const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_SOURCE_CACHE_BYTES = 32 * 1024 * 1024;
const HUMAN_FINDING_LIMIT = 25;
const HUMAN_RULE_LIMIT = 10;
const HUMAN_DETAIL_LIMIT = 5;
interface AuditSource { rel: string; text: string; hash: string }
type Emit = (record: Record<string, unknown>) => void;
type AuditReport = Awaited<ReturnType<typeof scan>> & { root: string; elapsedMs: number; fitness: ReturnType<typeof projectFitness> };
interface AuditedFile { rel: string; hash: string | null }
interface AuditRun {
  lock: ReturnType<typeof auditRules>["lock"]; reader: ReturnType<typeof sourceReader>; cache: AuditCache | null;
  uncovered: string[]; fileCoverage: { path: string; language: string; rules: string[] }[]; hashes: { path: string; hash: string }[];
}
interface AuditOptions { repo?: string; json: boolean; jsonl: boolean; sarif: boolean; full: boolean; plan: boolean; incremental: boolean; fresh: boolean; strict: boolean }

export async function audit(args: string[], emit: Emit = writeRecord): Promise<{ code: number; text: string }> {
  const result = await completedAudit(args, emit);
  return args.includes("--jsonl") && result.text !== ""
    ? { code: result.code, text: JSON.stringify({ schemaVersion: 1, type: "error", code: result.code, message: result.text }) } : result;
}

async function completedAudit(args: string[], emit: Emit): Promise<{ code: number; text: string }> {
  try { return await runAudit(args, emit); }
  catch (e) { return { code: 2, text: `PREGATE audit incomplete: ${visible((e as Error).message)}` }; }
}

function writeRecord(record: Record<string, unknown>): void {
  writeAll(1, Buffer.from(JSON.stringify(record) + "\n", "utf8"));
}

function auditOptions(args: string[]): AuditOptions | { code: number; text: string } {
  let repo: string | undefined, json = false, jsonl = false, sarif = false, full = false, plan = false, incremental = false, fresh = false, strict = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json" && !json) json = true;
    else if (args[i] === "--strict" && !strict) strict = true;
    else if (args[i] === "--jsonl" && !jsonl) jsonl = true;
    else if (args[i] === "--sarif" && !sarif) sarif = true;
    else if (args[i] === "--full" && !full) full = true;
    else if (args[i] === "--plan" && !plan) plan = true;
    else if (args[i] === "--incremental" && !incremental) incremental = true;
    else if (args[i] === "--fresh" && !fresh) fresh = true;
    else if (args[i] === "--repo" && repo === undefined) repo = args[++i];
    else return { code: 2, text: "usage: pregate audit [--repo <path>] [--json|--jsonl|--sarif|--full] [--plan] [--incremental] [--fresh] [--strict]" };
  }
  if (full && (json || jsonl || sarif)) return { code: 2, text: "--full is the complete human view; use it without --json, --jsonl or --sarif. Machine output already includes all evidence." };
  if (jsonl && (json || sarif || plan)) return { code: 2, text: "--jsonl cannot be combined with --json, --sarif or --plan. Use --json --plan for a complete refactoring plan." };
  if (sarif && (json || plan)) return { code: 2, text: "--sarif cannot be combined with --json or --plan." };
  if (args.includes("--repo") && (!repo || repo.startsWith("--"))) return { code: 2, text: "Audit requires a valid project path." };
  return { repo, json, jsonl, sarif, full, plan, incremental, fresh, strict };
}

// Incomplete analysis is never green. By default only what blocks under live policy fails;
// --strict also fails on coverage gaps, unverified requirements and any finding.
function auditCode(r: AuditReport, strict: boolean): number {
  if (r.errors.length > 0 || r.changedDuringAudit) return 2;
  if (strict) return r.unsupported.length > 0 || r.uncovered.length > 0 || r.fitness.some(f => f.status === "unverified") ? 2
    : r.summary.violations > 0 || r.fitness.some(f => f.status === "fail") ? 1 : 0;
  return r.summary.blockingUnderLivePolicy > 0 || r.fitness.some(f => f.rationale !== null && f.status !== "pass") ? 1 : 0;
}

async function runAudit(args: string[], output: Emit): Promise<{ code: number; text: string }> {
  const options = auditOptions(args);
  if ("code" in options) return options;
  const { repo, json, jsonl, sarif, full, plan, incremental, fresh, strict } = options;
  const root = findRoot(canonical(resolve(repo ?? process.cwd())), () => true);
  if (root === null) return { code: 2, text: "Audit needs an established preset and compiled lock. Run pregate init first." };
  const delegated = delegate(root, ["audit", ...args]);
  if (delegated !== null) return delegated;
  const start = performance.now(), contract = contractState(root);
  if (contract.lock === null) return { code: 2, text: contract.errors.join("\n") };
  const lockHash = sha256(readFileSync(join(root, LOCK), "utf8"));
  await grammars();
  const emit = jsonl ? output : null;
  emit?.({ schemaVersion: 1, type: "start", mode: "whole-tree-static-audit", root, lockHash });
  const result = scan(root, contract.lock, incremental || fresh ? { lockHash, fresh } : null, emit);
  const fitness = projectFitness(root, contract.lock, "ci");
  result.changedDuringAudit ||= !contractState(root).valid || sha256(readFileSync(join(root, LOCK), "utf8")) !== lockHash;
  const report = { schemaVersion: 1, mode: "whole-tree-static-audit", root, versions: { engine: contract.lock.engine, core: contract.lock.core },
    preset: contract.lock.preset, lockHash, scope: contract.lock.scope, languages: LANGUAGE_COVERAGE, ...result, fitness, tsconfig: tsconfigNotice((rel) => readText(join(root, rel))),
    elapsedMs: Math.round((performance.now() - start) * 10) / 10 };
  const ranked = plan ? refactorPlan(report) : null;
  const code = auditCode(report, strict);
  if (emit !== null) {
    const { findings: _, ...streamReport } = report;
    emit({ schemaVersion: 1, type: "end", code, report: streamReport });
    return { code, text: "" };
  }
  if (sarif) return { code, text: sarifReport(contract.lock, report.findings, report.errors.length === 0 && !report.changedDuringAudit) };
  return { code, text: json ? JSON.stringify({ ...report, ...(ranked ? { refactorPlan: ranked } : {}) }, null, 2)
    : auditText(report, full) + (report.tsconfig ? `\n${report.tsconfig}` : "") + (ranked ? "\n\n" + visible(refactorPlanText(ranked)) : "") + `\n${visible(exitLine(report, code, strict))}` };
}

// The last human line says what this run's exit code means. Exit 2 prints a full report too, and it
// is "not finished", not "more violations": a script or a reader must not take it for either a pass
// or a count.
function exitLine(r: AuditReport, code: number, strict: boolean): string {
  if (code === 0) return `Exit 0: complete; nothing blocks under ${strict ? "--strict" : "the live policy"}.`;
  if (code === 1) return strict ? "Exit 1: complete; findings or a failed project assertion exist (--strict counts every finding)."
    : `Exit 1: complete; ${r.summary.blockingUnderLivePolicy} finding${r.summary.blockingUnderLivePolicy === 1 ? "" : "s"} block under the live policy, or an adopted project assertion has no passing evidence.`;
  const why = r.errors.length > 0 ? `${r.errors.length} file${r.errors.length === 1 ? "" : "s"} could not be analyzed (first: ${r.errors[0]!.path}: ${r.errors[0]!.cause})`
    : r.changedDuringAudit ? "project contents changed during the audit" : "--strict counts unsupported files, files with no language policy and unverified requirements";
  return `Exit 2: incomplete, not a count of violations: ${why}. The findings above hold for the files that were read. Fix the cause and run again for a complete result.`;
}

function sourceReader(root: string) {
  const contents = new Map<string, string | null>(); // fingerprints, not the complete code tree
  const cache = new Map<string, { text: string | null; bytes: number }>();
  let cachedBytes = 0, peakCachedBytes = 0, changedDuringRead = false;
  const read: Read = (rel) => {
    const cached = cache.get(rel);
    if (cached) { cache.delete(rel); cache.set(rel, cached); return cached.text; }
    const text = sourceText(join(root, rel)), hash = text === null ? null : sha256(text);
    if (contents.has(rel)) changedDuringRead ||= contents.get(rel) !== hash;
    else contents.set(rel, hash);
    const bytes = text === null ? 0 : Buffer.byteLength(text);
    if (bytes <= MAX_SOURCE_CACHE_BYTES) {
      while (cachedBytes + bytes > MAX_SOURCE_CACHE_BYTES && cache.size) {
        const oldest = cache.keys().next().value!;
        cachedBytes -= cache.get(oldest)!.bytes; cache.delete(oldest);
      }
      cache.set(rel, { text, bytes }); cachedBytes += bytes;
      peakCachedBytes = Math.max(peakCachedBytes, cachedBytes);
    }
    return text;
  };
  const changed = () => changedDuringRead || [...contents].some(([rel, hash]) => {
    try { const text = sourceText(join(root, rel)); return (text === null ? null : sha256(text)) !== hash; }
    catch { return true; }
  });
  return { read, changed, peakBytes: () => peakCachedBytes };
}

function scan(root: string, lock: NonNullable<ReturnType<typeof contractState>["lock"]>, reuse: { lockHash: string; fresh: boolean } | null, emit: Emit | null) {
  const inventory = workspacePaths(root, () => true), selected = auditRules(lock), reader = sourceReader(root);
  const cache = reuse === null ? null : openAuditCache(root, sha256(JSON.stringify([EVALUATOR, reuse.lockHash, inventory])), reuse.fresh);
  const findings: AuditFinding[] = [], errors: AuditError[] = [], unsupported: string[] = [];
  const uncovered: string[] = [], fileCoverage: { path: string; language: string; rules: string[] }[] = [];
  const excluded: { path: string; reason: string }[] = [], hashes: { path: string; hash: string }[] = [];
  const summary = auditSummaryCollector(), run: AuditRun = { lock: selected.lock, reader, cache, uncovered, fileCoverage, hashes };
  for (const rel of inventory) {
    const owner = findRoot(dirname(join(root, rel)), () => true);
    if (owner !== root || !inScope(lock, rel)) { excluded.push({ path: rel, reason: owner !== root ? "Nested project has its own contract." : "Outside preset scope." }); continue; }
    if (grammarOf(rel) === null) {
      if (/\.(py|go|rs|java|kt|rb|c|cc|cpp|cs|swift|php)$/i.test(rel)) unsupported.push(rel);
      else excluded.push({ path: rel, reason: "No executable source parser for this file." });
      continue;
    }
    const file: AuditedFile = { rel, hash: null }, result = auditedFile(file, run);
    summary.add(result.findings, result.errors); errors.push(...result.errors);
    if (emit === null) findings.push(...result.findings);
    else emit({ schemaVersion: 1, type: "file", path: rel, hash: file.hash, ...result });
  }
  const changedDuringAudit = reader.changed()
    || JSON.stringify(workspacePaths(root, () => true)) !== JSON.stringify(inventory);
  if (cache !== null && !changedDuringAudit) saveAuditCache(cache);
  const finished = summary.finish(), applied = appliedFiles(fileCoverage);
  const promotable = promotionCandidates(lock, selected.lock.rules, new Set(finished.rules.map((r) => r.rule)), applied);
  return { filesScanned: hashes.length, contentHash: sha256(JSON.stringify(hashes)), fileHashes: hashes, changedDuringAudit,
    incremental: cache === null ? { enabled: false as const } : { enabled: true as const, evaluator: EVALUATOR, ...cache.stats },
    budgets: { maxSourceBytes: MAX_SOURCE_BYTES, maxSourceCacheBytes: MAX_SOURCE_CACHE_BYTES, peakSourceCacheBytes: reader.peakBytes(), parserConcurrency: 1 },
    auditedRules: selected.lock.rules.map((r) => ({ rule: r.id, check: r.check, languages: ruleLanguages(r), paths: r.params.paths, exclude: r.params.exclude, files: applied.get(r.id) ?? 0 })),
    skippedRules: selected.skipped, enforceCandidates: promotable.ready, ratchetCandidates: promotable.debt, idleAdvisorRules: promotable.idle, findings, errors, unsupported, uncovered, fileCoverage, excluded, summary: finished };
}

// How many audited files each static rule applies to, by scope, paths and language.
function appliedFiles(fileCoverage: { rules: string[] }[]): Map<string, number> {
  const applied = new Map<string, number>();
  for (const file of fileCoverage) for (const id of file.rules) applied.set(id, (applied.get(id) ?? 0) + 1);
  return applied;
}

// A clean advisor rule is promotable only when it read at least one file: a rule that matches
// nothing has 0 violations without proving anything, so it stays idle. A dirty advisor rule is
// promotable under no-new: the existing ratchet grandfathers the current findings and denies new
// ones. Strict keeps every current violation, so those rules stay out.
function promotionCandidates(lock: Lock, rules: LockRule[], violating: Set<string>, applied: Map<string, number>) {
  const order = (a: string, b: string) => Number(b.startsWith("core/")) - Number(a.startsWith("core/")) || a.localeCompare(b);
  const advisor = rules.filter((r) => enforcementOf(lock, r) === "advisor" && r.severity !== "warn");
  const clean = advisor.filter((r) => !violating.has(r.id)).map((r) => r.id).sort(order);
  const debt = lock.ratchet === "strict" ? [] : advisor.filter((r) => violating.has(r.id) && (applied.get(r.id) ?? 0) > 0).map((r) => r.id).sort(order);
  return { ready: clean.filter(id => (applied.get(id) ?? 0) > 0), idle: clean.filter(id => !applied.get(id)), debt };
}

function auditedFile(file: AuditedFile, run: AuditRun): { findings: AuditFinding[]; errors: AuditError[] } {
  try {
    if (missingLanguagePolicy(run.lock, file.rel)) run.uncovered.push(file.rel);
    run.fileCoverage.push({ path: file.rel, language: grammarOf(file.rel)!, rules: staticRulesFor(run.lock, file.rel).map((r) => r.id) });
    const text = run.reader.read(file.rel);
    if (text === null) return { findings: [], errors: [{ path: file.rel, cause: "state-io", line: null }] };
    file.hash = sha256(text); run.hashes.push({ path: file.rel, hash: file.hash });
    return analyzeSource(run.lock, { rel: file.rel, text, hash: file.hash }, run.reader.read, run.cache);
  } catch (e) {
    if (typeof (e as NodeJS.ErrnoException).code !== "string") throw e;
    return { findings: [], errors: [{ path: file.rel, cause: (e as NodeJS.ErrnoException).code === "PREGATE_AUDIT_INPUT_LIMIT" ? "audit-input-limit" : "state-io", line: null }] };
  }
}

function analyzeSource(lock: NonNullable<ReturnType<typeof contractState>["lock"]>, file: AuditSource, source: Read, cache: AuditCache | null) {
  const reused = cache === null ? null : cachedAnalysis(cache, file.rel, file.hash, source);
  if (reused !== null) return reused;
  const inputs: Record<string, string | null> = Object.create(null);
  const read: Read = (path) => { const value = source(path); inputs[path] = value === null ? null : sha256(value); return value; };
  const result = auditFile(lock, file.rel, file.text, { read, now: () => performance.now(), hash: false });
  if (cache !== null) {
    rememberAnalysis(cache, file.rel, file.hash, inputs, result);
    if (cache.stats.evaluatedFiles % 32 === 0) saveAuditCache(cache);
  }
  return result;
}

// Resolution probes a directory before its index file. It is not an unreadable source.
function sourceText(path: string): string | null {
  try { return openSourceText(path, openSync(path, "r")); }
  catch (e) {
    if (["ENOENT", "ENOTDIR", "EISDIR"].includes((e as NodeJS.ErrnoException).code ?? "")) return null;
    throw e;
  }
}

function openSourceText(path: string, fd: number): string | null {
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) return null;
    if (stat.size > MAX_SOURCE_BYTES) throw Object.assign(new Error("Audit source exceeds the 32 MiB per-file budget: " + path), { code: "PREGATE_AUDIT_INPUT_LIMIT" });
    const bytes = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = readSync(fd, bytes, count, bytes.length - count, null);
      if (!read) break;
      count += read;
    }
    if (count !== stat.size) throw Object.assign(new Error("Source changed during bounded audit read: " + path), { code: "EAGAIN" });
    return normalize(bytes.subarray(0, count).toString("utf8"));
  }
  finally { closeSync(fd); }
}

function auditText(r: AuditReport, full: boolean) {
  if (full) return fullAuditText(r);
  const adopted = r.fitness.filter(f => f.status === "fail" || (f.status === "unverified" && f.rationale !== null));
  const requirements = new Set(r.fitness.map(f => f.rule));
  const skipped = r.skippedRules.filter(rule => !requirements.has(rule.rule));
  const repairs = new Set<string>();
  return visible([
    `PREGATE whole-project audit: ${r.root}`,
    `${r.summary.violations} violations in ${r.summary.affectedFiles} files; ${r.filesScanned} source files scanned in ${r.elapsedMs} ms.`, ...productionLines(r),
    `${r.summary.blockingUnderLivePolicy} blocking under live policy; ${r.summary.shadow} shadow; ${r.summary.warnings} warnings. Existing debt is included; the ratchet is not applied.`,
    ...(r.incremental.enabled ? [`Incremental audit: ${r.incremental.reusedFiles} files reused; ${r.incremental.evaluatedFiles} evaluated; ${r.incremental.invalidatedFiles} changed cached entries.`,
      ...(r.incremental.error ? [r.incremental.error] : [])] : []),
    `Coverage: ${r.auditedRules.length} static rules; ${r.skippedRules.length} rules not evaluated as static checks; ${r.errors.length} analysis errors; ${r.unsupported.length} unsupported source files; ${r.uncovered.length} files without language policy; ${r.excluded.length} excluded files.`,
    ...(r.changedDuringAudit ? ["INCOMPLETE: project contents changed during this audit; rerun against a stable tree."] : []),
    ...humanRows("Analysis errors", r.errors, e => `  UNRESOLVED ${e.path}${e.line === null ? "" : `:${e.line}`}: ${e.cause}`),
    ...humanRows("Unsupported source", r.unsupported, path => `  UNSUPPORTED ${path}`),
    ...humanRows("Missing language policy", r.uncovered, path => `  NOT COVERED ${path}: parser available, but no applicable language policy selected.`),
    ...humanRows("Other rules not audited", skipped, rule => `  NOT AUDITED ${rule.rule}: ${rule.reason}`),
    r.fitness.every(f => f.status === "unverified" && f.rationale === null)
      ? `Project verification: not adopted (${r.fitness.length} optional requirements have no verifier and check nothing; pregate fitness plan).`
      : `Project fitness: ${r.fitness.filter(f => f.status === "pass").length} verified; ${r.fitness.filter(f => f.status === "fail").length} failed; ${r.fitness.filter(f => f.status === "unverified").length} unverified requirements.${r.fitness.some(f => f.status === "unverified") ? " Optional: pregate fitness plan groups project assertions; unverified is not compliance." : ""}`,
    ...humanRows("Adopted assertions needing evidence", adopted, f => `  ${f.rule}: ${f.status.toUpperCase()} — ${f.reason}`),
    ...humanRows("By rule", r.summary.rules, rule => `  ${rule.rule}: ${rule.count} in ${rule.files} files (${rule.check})`, HUMAN_RULE_LIMIT),
    ...humanRows("Ready to promote to enforce (0 violations in audited scope; run pregate promote --preview)", r.enforceCandidates, id => `  ${promotableRow(r, id)}`, HUMAN_RULE_LIMIT),
    ...humanRows("Ready to promote under the no-new ratchet (existing findings grandfathered; new findings denied; run pregate promote --preview)", r.ratchetCandidates, id => `  ${debtRow(r, id)}`, HUMAN_RULE_LIMIT),
    ...humanRows("Locations", r.findings, v => {
      const key = JSON.stringify([v.rule, v.fix]), repeated = repairs.has(key);
      repairs.add(key);
      return `  ${v.path}:${v.line} ${v.rule} [${v.severity}, ${v.enforcement}]: ${v.message}${repeated ? "" : `\n    Fix: ${v.fix}`}`;
    }, HUMAN_FINDING_LIMIT),
    "Complete human view: pregate audit --full. Complete machine evidence: pregate audit --json or --jsonl. No findings are removed from those outputs.",
    "Next: review analysis/coverage gaps and failed or stale adopted assertions before static repairs. Use pregate explain <rule> for the contract; repair one behavior-preserving change, run its tests, then re-audit.",
  ].join("\n"));
}

function promotableRow(r: AuditReport, id: string): string {
  const files = r.auditedRules.find(rule => rule.rule === id)?.files ?? 0;
  return `${id} (${files} file${files === 1 ? "" : "s"}): set {"enforcement": "enforce"} in overrides`;
}

function debtRow(r: AuditReport, id: string): string {
  const found = r.summary.rules.find(rule => rule.rule === id);
  const count = found?.count ?? 0, files = found?.files ?? 0;
  return `${id} (${count} existing finding${count === 1 ? "" : "s"} in ${files} file${files === 1 ? "" : "s"}): set {"enforcement": "enforce"} in overrides`;
}

// Test, fixture and generated findings count as debt too; this line only says where they are.
function productionLines(r: AuditReport): string[] {
  const other = r.findings.filter(finding => fileRole(finding.path) !== "source").length;
  return other ? [`${r.findings.length - other} in production source; ${other} in tests, fixtures, examples or generated code.`] : [];
}

function humanRows<T>(title: string, items: T[], render: (item: T) => string, limit = HUMAN_DETAIL_LIMIT): string[] {
  const selected = items.slice(0, limit);
  return items.length ? [`${title} (showing ${selected.length} of ${items.length}):`, ...selected.map(render)] : [];
}

function fullAuditText(r: AuditReport) {
  return visible([
    `PREGATE whole-project audit: ${r.root}`,
    `${r.summary.violations} violations in ${r.summary.affectedFiles} files; ${r.filesScanned} source files scanned in ${r.elapsedMs} ms.`,
    `${r.summary.blockingUnderLivePolicy} blocking under live policy; ${r.summary.shadow} shadow; ${r.summary.warnings} warnings. Existing debt is included; the ratchet is not applied.`,
    ...(r.incremental.enabled ? [`Incremental audit: ${r.incremental.reusedFiles} files reused; ${r.incremental.evaluatedFiles} evaluated; ${r.incremental.invalidatedFiles} changed cached entries.`,
      ...(r.incremental.error ? [r.incremental.error] : [])] : []),
    `Coverage: ${r.auditedRules.length} static rules; ${r.skippedRules.length} change/delegated rules not audited; ${r.errors.length} analysis errors; ${r.unsupported.length} unsupported source files; ${r.excluded.length} excluded files.`,
    ...(r.changedDuringAudit ? ["INCOMPLETE: project contents changed during this audit; rerun against a stable tree."] : []),
    `Project fitness: ${r.fitness.filter((f) => f.status === "pass").length} verified; ${r.fitness.filter((f) => f.status === "fail").length} failed; ${r.fitness.filter((f) => f.status === "unverified").length} unverified requirements.`,
    ...r.fitness.map((f) => `  ${f.rule}: ${f.status.toUpperCase()} — ${f.reason}`),
    "By rule:", ...r.summary.rules.map((v) => `  ${v.rule}: ${v.count} in ${v.files} files (${v.check})`),
    ...(r.enforceCandidates.length ? ["Ready to promote to enforce (0 violations in audited scope; run pregate promote --preview):", ...r.enforceCandidates.map((id) => `  ${promotableRow(r, id)}`)] : []),
    ...(r.ratchetCandidates.length ? ["Ready to promote under the no-new ratchet (existing findings grandfathered; new findings denied; run pregate promote --preview):", ...r.ratchetCandidates.map((id) => `  ${debtRow(r, id)}`)] : []),
    "Locations:", ...r.findings.map((v) => `  ${v.path}:${v.line} ${v.rule} [${v.severity}, ${v.enforcement}]: ${v.message}\n    Fix: ${v.fix}`),
    ...r.errors.map((e) => `  UNRESOLVED ${e.path}${e.line === null ? "" : `:${e.line}`}: ${e.cause}`),
    ...r.unsupported.map((p) => `  UNSUPPORTED ${p}`),
    ...r.uncovered.map((p) => `  NOT COVERED ${p}: parser available, but no applicable language policy selected.`),
    ...r.skippedRules.map((r) => `  NOT AUDITED ${r.rule}: ${r.reason}`),
    "Next: repair one behavior-preserving change, run its tests, then rerun pregate audit. Use pregate explain <rule> for the rule contract; audit --json lists every finding and exclusion.",
  ].join("\n"));
}

interface PromoteOptions { repo?: string; rules?: string[]; preview: boolean; yes: boolean }
const PROMOTE_USAGE = "usage: pregate promote [--rule <id,id>] [--repo <path>] [--preview|--yes]";

export async function promote(args: string[]): Promise<{ code: number; text: string }> {
  try { return await runPromote(args); }
  catch (e) { return { code: 1, text: visible(`Promotion failed: ${(e as Error).message}`) }; }
}

function promoteOptions(args: string[]): PromoteOptions | null {
  let repo: string | undefined, rules: string[] | undefined, preview = false, yes = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--preview" && !preview) preview = true;
    else if (arg === "--yes" && !yes) yes = true;
    else if (arg === "--repo" && repo === undefined) repo = args[++i];
    else if (arg === "--rule" && rules === undefined) rules = (args[++i] ?? "").split(",").map(s => s.trim()).filter(Boolean);
    else return null;
  }
  if ((preview && yes) || (args.includes("--repo") && (!repo || repo.startsWith("-"))) || (rules !== undefined && !rules.length)) return null;
  return { repo, rules, preview, yes };
}

async function runPromote(args: string[]): Promise<{ code: number; text: string }> {
  const options = promoteOptions(args);
  if (options === null) return { code: 1, text: PROMOTE_USAGE };
  const root = findRoot(canonical(resolve(options.repo ?? process.cwd())), () => true);
  if (root === null) return { code: 1, text: "Promote needs an established preset and compiled lock. Run pregate init first." };
  const delegated = delegate(root, ["promote", ...args]);
  if (delegated !== null) return delegated;
  const contract = contractState(root);
  if (contract.lock === null) return { code: 1, text: contract.errors.join("\n") };
  await grammars();
  const result = scan(root, contract.lock, null, null);
  if (result.changedDuringAudit || !contractState(root).valid) return { code: 1, text: "Project contents changed during audit; rerun promote against a stable tree." };
  if (result.errors.length > 0) return { code: 1, text: `Cannot promote rules while ${result.errors.length} analysis error(s) remain (${result.errors[0]!.path}: ${result.errors[0]!.cause}). Fix analysis errors and retry.` };
  const findings = new Map(result.summary.rules.map(r => [r.rule, r.count]));
  const findingFiles = new Map(result.summary.rules.map(r => [r.rule, r.files]));
  const selected = selectedPromotions(options.rules, contract.lock, result, findings);
  if ("code" in selected) return selected;
  const counts = new Map(result.auditedRules.map(r => [r.rule, r.files]));
  const idle = options.rules === undefined ? result.idleAdvisorRules : [];
  if (!selected.ids.length) return { code: 0, text: ["No clean advisor rules are ready to promote to enforce. Run pregate audit to inspect current findings.", ...idleText(idle)].join("\n") };
  const next = promotedPreset(root, contract.lock.rules, selected.ids);
  const applied = await applyPreset(root, JSON.stringify(next, null, 2) + "\n", { preview: options.preview, yes: options.yes });
  if (applied.code !== 0) return options.preview || options.yes ? applied : { ...applied, text: `${applied.text}\n${PROMOTE_HINT}` };
  return { code: 0, text: [promotionText(selected.ids, counts, findings, findingFiles, options.preview), ...idleText(idle), applied.text].join("\n") };
}

type Promotable = { enforceCandidates: string[]; ratchetCandidates: string[]; idleAdvisorRules: string[] };

function selectedPromotions(requested: string[] | undefined, lock: Lock, scanned: Promotable, findings: Map<string, number>): { ids: string[] } | { code: number; text: string } {
  if (requested === undefined) return { ids: [...scanned.enforceCandidates, ...scanned.ratchetCandidates] };
  const eligible = new Set([...scanned.enforceCandidates, ...scanned.ratchetCandidates]), idle = new Set(scanned.idleAdvisorRules), ids: string[] = [];
  for (const token of requested) {
    const match = lock.rules.find(r => [r.id, ...r.aliases].some(a => a === token || a.endsWith(`/${token}`)) || r.check.startsWith(`${token}@`));
    if (!match) return { code: 1, text: `Unknown rule ${token}. Run pregate preset show to list active rules.` };
    if (idle.has(match.id)) return { code: 1, text: `Rule ${match.id} matches no files in the audited scope; promoting it would prove nothing. Check its paths with pregate explain ${match.id}.` };
    if (!eligible.has(match.id)) return { code: 1, text: ineligiblePromotion(lock, match, findings.get(match.id) ?? 0) };
    if (!ids.includes(match.id)) ids.push(match.id);
  }
  return { ids };
}

function ineligiblePromotion(lock: Lock, rule: LockRule, findings: number): string {
  if (findings > 0 && lock.ratchet === "strict" && enforcementOf(lock, rule) === "advisor" && rule.severity !== "warn") {
    return `Rule ${rule.id} is not eligible to promote under a strict ratchet: ${findings} existing finding${findings === 1 ? "" : "s"} would block, and strict does not grandfather them. Set ratchet no-new to freeze that debt, or clear the findings first.`;
  }
  return `Rule ${rule.id} is not eligible to promote (must be an active static advisor rule; warn rules never block).`;
}

const PROMOTE_HINT = "Run pregate promote --preview to prepare the review; the human approves it with the code it prints.";

function promotionText(ids: string[], counts: Map<string, number>, findings: Map<string, number>, findingFiles: Map<string, number>, pending: boolean): string {
  const described = ids.map(id => {
    const found = findings.get(id) ?? 0;
    if (found === 0) {
      const files = counts.get(id) ?? 0;
      return `${id} (${files} file${files === 1 ? "" : "s"})`;
    }
    const files = findingFiles.get(id) ?? 0;
    return `${id} (${found} existing finding${found === 1 ? "" : "s"} in ${files} file${files === 1 ? "" : "s"} grandfathered by the no-new ratchet; new findings are denied)`;
  });
  return `${pending ? `Would promote to enforce (${ids.length}, pending approval)` : `Promoted to enforce (${ids.length})`}: ${described.join(", ")}.`;
}

function idleText(idle: string[]): string[] {
  return idle.length ? [`Not proposed: ${idle.length} clean advisor rules match no files in scope (${idle.slice(0, 5).join(", ")}${idle.length > 5 ? ", …" : ""}).`] : [];
}

function promotedPreset(root: string, rules: LockRule[], ids: string[]): Preset {
  const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8")) as Preset;
  const overrides: NonNullable<Preset["overrides"]> = { ...preset.overrides };
  for (const id of ids) {
    const rule = rules.find(r => r.id === id)!;
    const key = [rule.id, ...rule.aliases, rule.check.replace(/@.*$/, "")].find(k => Object.hasOwn(overrides, k)) ?? rule.id;
    const prev = overrides[key];
    overrides[key] = typeof prev === "string" ? { severity: prev, enforcement: "enforce" } : { ...prev, enforcement: "enforce" };
  }
  preset.overrides = overrides;
  return preset;
}
