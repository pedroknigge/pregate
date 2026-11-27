import type { CallEvent, Files } from "./types.ts";

export interface IssueReproduction {
  files: Files; result: string; versions: NonNullable<CallEvent["versions"]>;
}

interface IssueEvidence {
  harness: string; note: string; code: string | null; fingerprint: string; reproduction?: IssueReproduction; title?: string;
  versions?: CallEvent["versions"];
}

export interface IssueDraft {
  root: string; repo: string; title: string; body: string; fingerprint: string; includesCode: boolean;
}

export function issueContent(event: CallEvent | null, details: IssueEvidence): Pick<IssueDraft, "title" | "body" | "includesCode"> {
  const ids = [...new Set(event?.violations.map((v) => v.rule) ?? [])];
  const finding = event?.form ?? (ids.length > 1 ? `${ids.length} rules; first: ${ids[0]}` : ids[0] ?? "unclassified finding");
  const title = details.title ?? `[PREGATE finding] ${finding}`.slice(0, 200);
  const unexplained = event === null ? "" : `Recorded ${event.kind} verdict: ${event.verdict}. Expected behavior was not supplied; this is a diagnostic report, not a reproduced defect.`;
  const body = [
    "## Finding", details.note.trim() || unexplained,
    "", "## Recorded evidence", ...(event === null ? unrecorded(details) : recorded(event, details, ids)),
    "", "## Reproduction", ...(details.reproduction ? [
      `Replay engine: ${details.reproduction.versions.engine}; core: ${details.reproduction.versions.core}.`,
      "1. Save the reviewed JSON below as repro.json.", "2. Run `pregate rules test --fixture repro.json` with the replay engine above.",
      "3. Compare the observed fixture result with its expected result and the reporter's explanation.",
    ] : [event === null ? "No recorded event or public reproduction was supplied." : "No public reproduction was supplied; the original private event cannot be replayed from this report alone.",
      "1. Use the engine/core and any recorded check versions above.",
      "2. Reproduce the attempted edit or command under the same rule configuration.",
      "3. Describe the expected behavior and compare it with the observed finding."]),
    "", ...(details.reproduction ? ["Reporter-provided public fixture; this is not an automatic replay of the original private event.",
      `Observed fixture result:\n\n${fenced(details.reproduction.result)}`,
      `Explicitly included fixture/check/configuration and source files:\n\n${fenced(JSON.stringify(details.reproduction.files, null, 2))}`]
      : [details.code === null ? "Code and local paths were omitted. Add a minimal public example with --repro if needed." : `Code explicitly included by the reporter:\n\n${fenced(details.code)}`]),
    "", "This is a user-submitted finding requiring triage; a denial alone does not prove a bug.",
    "", `PREGATE-finding: ${details.fingerprint}`,
  ].join("\n");
  return { title, body, includesCode: details.code !== null || details.reproduction !== undefined };
}

function recorded(event: CallEvent, details: IssueEvidence, ids: string[]): string[] {
  const rules = event.dispute?.rules ?? [];
  return [`- Engine: ${event.versions?.engine ?? "not recorded (legacy event)"}`,
    `- Core: ${event.versions?.core ?? "not recorded (legacy event)"}`,
    `- Harness: ${details.harness}`, `- Phase: ${event.kind}`, `- Verdict: ${event.verdict}`,
    `- Cause: ${event.form ?? "rule violation"}`,
    `- Findings: ${event.violations.length}; distinct rules: ${ids.length}`,
    ...ids.map((id) => `- Rule: ${id}; check: ${event.ruleChecks?.[id] ?? rules.find((r) => r.id === id)?.check ?? "not recorded"}; policy: ${event.enforcement?.[id] ?? "not recorded"}; findings: ${event.violations.filter((v) => v.rule === id).length}`)];
}

// --no-event: the reporter's explanation is the whole report; only the reporting engine is known.
function unrecorded(details: IssueEvidence): string[] {
  return [`- Engine: ${details.versions?.engine ?? "not recorded"}`, `- Core: ${details.versions?.core ?? "not recorded"}`,
    "- Recorded event: none selected; this report relies on the reporter's explanation."];
}

function fenced(code: string): string {
  const runs = [...code.matchAll(/`+/g)].map((m) => m[0].length);
  const fence = "`".repeat(Math.max(3, ...runs.map((n) => n + 1)));
  return `${fence}\n${code}\n${fence}`;
}
