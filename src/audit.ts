import { analyze, isImportRule } from "./evaluate.ts";
import { enforcementOf } from "./enforcement.ts";
import { ruleFix } from "./fix.ts";
import { grammarOf } from "./languages.ts";
import { violationMessage } from "./message.ts";
import { canonical } from "./ratchet.ts";
import { errorIn, parse, type Parsed } from "./ts.ts";
import type { Enforcement, Form, Host, Lock, LockRule, Violation } from "./types.ts";

export type AuditFinding = Violation & { check: string; enforcement: Enforcement; message: string; fix: string };
export type AuditError = { path: string; cause: Form["cause"] | "audit-input-limit"; line: number | null };

// An inventory evaluates static rules regardless of their hook phase or shadow policy. Diff and
// placement guards concern attempted changes, so a snapshot cannot establish their compliance.
export function auditRules(lock: Lock) {
  const skipped: { rule: string; check: string; reason: string }[] = [];
  const rules = lock.rules.filter((r) => {
    const reason = lock.ownedByArkgate.includes(r.id) ? "Owned by ArkGate; use its audit."
      : r.impl.kind === "primitive" && r.impl.primitive === "fitness" ? "Project fitness evidence is reported separately; syntax cannot prove this requirement."
      : r.impl.kind === "primitive" && ["diff", "placement"].includes(r.impl.primitive) ? "Change guard needs an attempted edit and a baseline." : null;
    if (reason !== null) skipped.push({ rule: r.id, check: r.check, reason });
    return reason === null;
  }).map((r): LockRule => ({ ...r, phases: ["ci"] }));
  return { lock: { ...lock, rules }, skipped };
}

export function auditFile(lock: Lock, rel: string, text: string, host: Host): { findings: AuditFinding[]; errors: AuditError[] } {
  if (grammarOf(rel) === null) return auditUnparsed(lock, rel, text, host);
  const parsed = parse(rel, text);
  return auditParsed(lock, rel, parsed, host);
}

function auditUnparsed(lock: Lock, rel: string, text: string, host: Host): { findings: AuditFinding[]; errors: AuditError[] } {
  const result = analyze(lock, "ci", rel, text, { ...host, hash: false });
  if ("cause" in result) return { findings: [], errors: [{ path: rel, cause: result.cause, line: result.line }] };
  const findings: AuditFinding[] = [];
  for (const v of canonical(result.violations)) {
    const rule = lock.rules.find((r) => r.id === v.rule)!;
    findings.push({ ...v, check: rule.check, enforcement: enforcementOf(lock, rule), message: violationMessage(v, lock), fix: ruleFix(v, lock).text });
  }
  return { findings, errors: [] };
}

function auditParsed(lock: Lock, rel: string, parsed: Parsed, host: Host): { findings: AuditFinding[]; errors: AuditError[] } {
  try {
    const line = errorIn(parsed, null);
    if (line !== null) return { findings: [], errors: [{ path: rel, cause: "syntax", line }] };
    const findings: AuditFinding[] = [], errors: AuditError[] = [];
    // Keep independently established metric/pattern findings even if import resolution fails.
    for (const imports of [false, true]) {
      const selected = { ...lock, rules: lock.rules.filter((r) => isImportRule(r) === imports) };
      if (selected.rules.length === 0) continue;
      const result = analyze(selected, "ci", rel, parsed, { ...host, hash: false });
      if ("cause" in result) errors.push({ ...result, path: rel });
      else for (const v of canonical(result.violations)) {
        const rule = lock.rules.find((r) => r.id === v.rule)!;
        findings.push({ ...v, check: rule.check, enforcement: enforcementOf(lock, rule), message: violationMessage(v, lock), fix: ruleFix(v, lock).text });
      }
    }
    return { findings, errors };
  } finally { parsed.root.tree.delete(); }
}

export function auditSummary(findings: AuditFinding[], errors: AuditError[]) {
  const summary = auditSummaryCollector();
  summary.add(findings, errors);
  return summary.finish();
}

export function auditSummaryCollector() {
  const rules = new Map<string, { rule: string; check: string; count: number; files: Set<string> }>();
  const affected = new Set<string>(), unresolved = new Set<string>();
  let violations = 0, blockingUnderLivePolicy = 0, shadow = 0, warnings = 0;
  return {
    add(findings: AuditFinding[], errors: AuditError[]) {
      for (const v of findings) {
        const r = rules.get(v.rule) ?? { rule: v.rule, check: v.check, count: 0, files: new Set<string>() };
        r.count++; r.files.add(v.path); rules.set(v.rule, r); affected.add(v.path); violations++;
        if (v.severity !== "warn" && v.enforcement === "enforce") blockingUnderLivePolicy++;
        if (v.enforcement === "shadow") shadow++;
        if (v.severity === "warn") warnings++;
      }
      for (const e of errors) unresolved.add(e.path);
    },
    finish() {
      return { violations, affectedFiles: affected.size, blockingUnderLivePolicy, shadow, warnings, unresolvedFiles: unresolved.size,
        rules: [...rules.values()].map((r) => ({ ...r, files: r.files.size })).sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule)) };
    },
  };
}
