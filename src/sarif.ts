import { enforcementOf } from "./enforcement.ts";
import { ruleFix } from "./fix.ts";
import { violationMessage } from "./message.ts";
import type { Lock, LockRule, Violation } from "./types.ts";

const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const REPO_URI = "https://github.com/pedroknigge/pregate";

function sarifLevel(lock: Lock, rule: LockRule | undefined, v: Violation): "error" | "warning" | "note" {
  const enforcement = rule ? enforcementOf(lock, rule) : lock.enforcement;
  if (enforcement === "shadow") return "note";
  if (v.severity === "warn" || enforcement === "advisor") return "warning";
  return "error";
}

function descriptor(lock: Lock, rule: LockRule) {
  const enforcement = enforcementOf(lock, rule);
  const level = enforcement === "shadow" ? "note" : rule.severity === "warn" || enforcement === "advisor" ? "warning" : "error";
  const avoid = rule.text.avoid ? `\n\nAvoid: ${rule.text.avoid}` : "";
  return {
    id: rule.id,
    name: rule.check,
    shortDescription: { text: rule.text.why },
    fullDescription: { text: `${rule.text.why} Fix: ${rule.text.fix}` },
    help: { text: `${rule.text.why}\n\nFix: ${rule.text.fix}${avoid}\n\nSource: ${rule.text.source}` },
    defaultConfiguration: { level },
  };
}

export function sarifReport(lock: Lock, violations: Violation[], executionSuccessful = true): string {
  const byId = new Map(lock.rules.map((r) => [r.id, r]));
  const results = violations.map((v) => {
    const rule = byId.get(v.rule);
    const msg = violationMessage(v, lock);
    const fix = ` Fix: ${ruleFix(v, lock).text}`;
    return {
      ruleId: v.rule,
      level: sarifLevel(lock, rule, v),
      message: { text: `${msg}${fix}` },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: v.path, uriBaseId: "%SRCROOT%" },
          region: { startLine: Math.max(1, v.line) },
        },
      }],
    };
  });
  return JSON.stringify({
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "PREGATE",
          version: lock.engine,
          informationUri: REPO_URI,
          rules: lock.rules.map((r) => descriptor(lock, r)),
        },
      },
      invocations: [{ executionSuccessful }],
      results,
    }],
  }, null, 2);
}
