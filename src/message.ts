import { causeFix, ruleFix } from "./fix.ts";
import { NODE_PIN_DETAIL } from "./node-security-pin.ts";
import { FIXABLE_BY } from "./types.ts";
import { enforcementOf } from "./enforcement.ts";
import type { Cause, DecisionFix, Form, Lock, LockRelation, LockRule, Severity, Violation } from "./types.ts";

// Calls the engine could not classify. A rule violation, a protected path, and a shell write are not in this set.
export const UNCERTAINTY_CAUSES: ReadonlySet<Cause> = new Set<Cause>([
  "payload-unrecognized", "lock-stale", "version-mismatch", "cannot-reconstruct", "shell-uncertain",
]);

// Fits on the first deny line after the cause, including the harness label main adds to payload-unrecognized.
// A hook never denies these causes; `pregate check` still reports them, and no preset key overrides that.
export const UNCERTAINTY_OVERRIDE = "";

// All product text is English (D23). Nothing taken from code (paths, symbols) reaches a message unless it went
// through `safe`, and the engine never hands over code strings or comments, so the agent cannot
// write text that comes back as the hook's voice (SPEC §11.1).

export type Text = { compact: string; full: string; fix: DecisionFix | null };
export type Halt = "turn-cap" | "file-rule-cap" | "no-progress" | "form-run" | "ask-unavailable";
export type Close = "retry" | "stalled" | "halt" | "ask";            // how a deny or ask text ends
// launcher: what precheck cites; max: text budget (hooks keep TEXT_MAX; the CLI pre-check lists everything)
export type DenyContext = { launcher: string; lockHash: string | null; max?: number };
export type NoticeArgs = { path?: string; reason?: Cause | Halt; cause?: Cause };
export type NoticeKey =
  | "no-preset" | "no-git" | "lock-stale" | "halt" | "stop-cap" | "start-failed" | "ask" | "approved";

const LINE_MAX = 256;    // Grok Build cuts the reason at 256 chars; other UIs show only the start
const TEXT_MAX = 4000;
const NAME_MAX = 80;
const FIELD_MAX = 300;   // catalog paraphrases are ≤ 300; longer text from `path` sources is clipped
const BRIEF_MAX = 2000;  // rules listed even without a budget, so a huge tree cannot print megabytes
const LOCATIONS_MAX = 160;
const MORE_MAX = 80;     // room kept for the "+N more" line
const ARG_MAX = 300;     // a longer path in the pre-check becomes <file>
const WORD = /^[A-Za-z0-9@/._-]+$/;   // a shell word that needs no quoting (`$` would expand)
const EMPTY: Text = { compact: "", full: "", fix: null };

const ISSUE = "Ask the user whether to report this finding to the native PREGATE GitHub repository. Prepare a review with `pregate issue draft --last`; code is omitted unless explicitly included. Publication requires human approval in a separate terminal.";
const NO_PRESET_REPORT = "Ask the user whether to report this finding to the native PREGATE GitHub repository. This directory has no preset, so a draft cannot be prepared from here. Publication requires human approval in a separate terminal.";

// `issue draft` reads the preset in the working directory. A denial there must not name a command
// that cannot run.
export function withoutPresetDraft<T extends { compact: string; full: string; notice: string | null }>(decision: T): T {
  const swap = (text: string): string => text.includes(ISSUE) ? text.replaceAll(ISSUE, NO_PRESET_REPORT) : text;
  return { ...decision, compact: swap(decision.compact), full: swap(decision.full), notice: decision.notice === null ? null : swap(decision.notice) };
}
export const POLICY_ADAPTATION = "If a rule blocks a required use case, propose a bounded rule/pack change with a valid example and an invalid counterexample. Preserve the invariant and requested behavior. Inspect `pregate preset show --json` and `pregate preset request-schema`. Draft .pregate/requests/<name>.json. Codex 0.166 reports the command working directory, so name a file outside that directory with an absolute path. `pregate preset apply <request.json> --preview` prepares review without activating it. Only the human approves. Do not suggest disabling PREGATE or its hooks just to unblock the task.";
// SessionStart's form of POLICY_ADAPTATION; the denial texts carry the full procedure.
const ADAPTATION_BRIEF = "If a rule blocks a required use case, propose a bounded rule/pack change with a valid example and an invalid counterexample in .pregate/requests/<name>.json for human review. Do not suggest disabling PREGATE or its hooks just to unblock the task.";
const BRIEF_RULES = 20;  // executable checks listed at SessionStart; preset show lists the rest
const INSPECTION_GUIDANCE ="Inspection and pre-check commands are helpers, not prerequisites for an edit. If the user restricts shell use or a helper is unavailable, use supplied context and permitted edit tools; keep hooks active and let them evaluate the edit. Report missing information honestly. An actual denial or required human approval still applies.";

const RETRY = [
  "Rewrite until every listed violation is fixed. Do not resubmit the same edit and do not work around the rule.",
  "If the task cannot be done within these invariants, stop and tell the user which rule blocks you (ID and line) and why. Do not trim the task.",
  "If you believe this is a false positive, ask the user to run `pregate dispute --last` to turn the denied code into a rule fixture candidate. Do not route around the rule.",
  POLICY_ADAPTATION,
  ISSUE,
  "If a rule conflicts with an explicit user instruction, ask the user.",
].join("\n");
const STALLED = "This edit repeats a denied one or makes no progress on the listed rules: change the approach, not the wording.";
const HALTED = "PREGATE stopped this turn. Do not retry: tell the user which rule blocks you (ID and line) and why.";
const FORM_HALTED = "PREGATE stopped this turn. Do not retry: tell the user the cause and path.";
const ASKED = "PREGATE asked the user to approve this change. If they decline, rewrite it within the rule or tell them why you cannot.";
const ADVISOR = "Advisory: not blocked.";
const ADVISOR_BESIDE_DENY = "Advisory findings: these rules do not block; only the DENY above does. Revise the code for each advisory rule, or keep it and tell the user why.";
const STOP = `Fix them before finishing. Do not remove functionality or tests to comply; if the fix exceeds the task, stop and report it to the user.\nStop uses the retained session snapshot. Inspect it with pregate report --json; a clean CLI check against another baseline does not clear these findings. After a committed merge, prepare pregate session rebase <harness:session-id> --preview for human review. Do not delete session state to hide findings.\n${POLICY_ADAPTATION}`;
const INFO = " (informational; no action required for this task)";

const CAUSE_EN: Record<Cause, string> = {
  "protected-path": "protected configuration or state. Inspect the contract with `pregate preset diagnose --json` or `pregate preset show --json`. Inspect harness settings with one literal cat -- /absolute/path/to/settings.json command; changes require human review.",
  "request-invalid": "the request does not validate against schema/request.v1.json. Fix the JSON and resend it.",
  "tool-will-fail": "the text to replace is not in the current file, or is not unique. Re-read the file and resend the edit.",
  "cannot-reconstruct": "PREGATE cannot evaluate this edit. Resend it as an exact replacement or a full write of the file; a patch needs absolute paths and exact context lines, and a write over 128 KiB goes in pieces.",
  "syntax": "the edited range does not parse. Fix the syntax error and resend.",
  "unresolvable-import": "an import in a restricted layer cannot be resolved (unknown path or alias, more than 3 re-export hops, or an invalid tsconfig). Import by a path that resolves inside the repo.",
  "shell-write": "this command writes a project file, or runs a script that does. Write files with the edit tool (Write, Edit, apply_patch) so the change is evaluated.",
  "shell-admin": "this command skips git hooks, runs an ungated agent harness, changes PREGATE configuration or builds a command name from a variable, substitution or glob. Do not run it; spell every command name literally.",
  "hook-switch": "this command installs, removes or switches off PREGATE or the hooks of a harness. Do not run it. Do not ask to switch protection off merely to continue a blocked task; propose a reviewed rule adaptation.",
  "approval": "an agent cannot grant itself approval. Ask the human to run the approval command in a separate terminal. Setting PREGATE_UNATTENDED_APPROVAL, PREGATE_TESTING, PREGATE_TEST_ANSWER or PREGATE_ACCEPT_CONTRACT does not grant it.",
  "shell-uncertain": "this command has unfinished shell syntax, so it was not classified. Close every quote, substitution, and group.",
  "payload-unrecognized": "PREGATE could not evaluate this call: the hook payload does not match what this PREGATE version knows of the harness.",
  "lock-stale": "PREGATE could not evaluate this call: its lock is missing, does not match the preset and its sources, or pins an engine older than this one accepts.",
  "version-mismatch": "PREGATE could not evaluate this call: the engine or core version differs from the one the preset pins.",
  "snapshot-missing": "PREGATE could not evaluate this call: the session snapshot is missing.",
  "state-io": "PREGATE could not evaluate this call: its state is busy or unwritable. Run `pregate storage inspect`; the human can review abandoned-owner recovery with `pregate storage recover --preview`, or check permissions and disk space.",
  "git-missing": "PREGATE could not evaluate this call: git is not on PATH.",
  "git-not-repository": "PREGATE could not evaluate this call: this directory is not a Git repository, or its .git directory was removed.",
  "git-error": "PREGATE could not evaluate this call: git returned an error.",
  "regex-limit": "PREGATE could not evaluate this call: the regex of a rule hit the backtracking limit of the regex engine on this file.",
  "contract-loosened": "the contract enforces less than it did when the session started, and no human approval of that change was recorded. Do not loosen the contract; propose a request for human review instead.",
};

const WHY: Record<Cause | Halt, string> = {
  ...CAUSE_EN,
  "turn-cap": "the agent reached the denial limit for this turn.",
  "file-rule-cap": "the agent reached the retry limit for the same rule and file.",
  "no-progress": "the agent resubmitted edits without progress on the same rules.",
  "form-run": "three consecutive edits could not be evaluated.",
  "ask-unavailable": "human approval is required, but this session cannot ask (headless, subagent, loop.allowAsk=false or protected path).",
  "lock-stale": "the lock is missing or stale; inspect `pregate preset diagnose --json` and prepare `pregate update --project --preview`. Do not reset the preset or disable protection.",
  "version-mismatch": "the engine or core version differs from the preset; install the pinned engine or review `pregate update --project --preview` for one complete migration.",
  "snapshot-missing": "the session snapshot is missing; start a new session.",
  "state-io": "cannot write PREGATE state; run `pregate storage inspect`, check permissions/available disk space, and review abandoned-owner recovery with `pregate storage recover --preview`.",
  "git-missing": "git is not on PATH. Fix: install Git and open a new terminal so `git` is on PATH.",
  "git-not-repository": "this directory is not a Git repository, or its .git directory was removed. Fix: run `git init` here, or restore the removed .git directory. For a scratch directory that should not be gated, ask the human to run `pregate disable`.",
  "git-error": "git returned an error. Fix: run `git status` in this directory and repair the Git error. For a scratch directory that should not be gated, ask the human to run `pregate disable`.",
  "regex-limit": "a rule regex hit its backtracking limit; rewrite it without repeated groups and run `pregate preset compile`.",
  "contract-loosened": "the contract was loosened during the session without a recorded human approval; the human restores it (git checkout -- .pregate) or applies the change through a reviewed preview and their own approval.",
};

const RANK: Record<Severity, number> = { deny: 0, ask: 1, warn: 2 };

const CLOSING: Record<Close, string> = { retry: RETRY, stalled: `${STALLED}\n${RETRY}`, halt: `${HALTED}\n${POLICY_ADAPTATION}\n${ISSUE}`, ask: `${ASKED}\n${POLICY_ADAPTATION}\n${ISSUE}` };

// Grok shows the agent only the first line, up to 256 characters (MULTI-HARNESS MH-16).
// Keep an explain command there; use the PATH name when the absolute launcher does not fit.
export function denyText(vs: Violation[], lock: Lock, attempt: number, close: Close, ctx: DenyContext): Text {
  const sorted = ordered(vs);
  const first = sorted[0];
  if (first === undefined) return EMPTY;
  const count = hidden(sorted, ctx);
  const chosen = explainChoice(`PREGATE ${close === "ask" ? "ASK" : "DENY"}`, first, lock, count, ctx.launcher);
  const compact = headline(`PREGATE ${close === "ask" ? "ASK" : "DENY"}`, first, lock, count, chosen.end);
  const tail = `${CLOSING[close]}\n${chosen.spill === "" ? "" : `${chosen.spill}\n`}Optional pre-check when permitted: ${precheck(ctx.launcher, first.path)}`;
  return { compact, full: assemble(`${compact}\n\n${origin(lock, ctx, attempt)}`, sorted, lock, tail, ctx.max), fix: ruleFix(first, lock) };
}

// The first line's "+N more": hook UIs may show that line alone, while an unbounded text (the CLI
// pre-check) lists every finding below it, so there it would only repeat what follows.
function hidden(sorted: Violation[], ctx: DenyContext): number {
  return ctx.max === Infinity ? 0 : sorted.length - 1;
}

export function stopText(vs: Violation[], lock: Lock, ctx: DenyContext): Text {
  const sorted = ordered(vs);
  const first = sorted[0];
  if (first === undefined) return EMPTY;
  const n = sorted.length;
  const compact = headline(`PREGATE BLOCK end of turn: ${n} introduced violation${n === 1 ? "" : "s"} remain. First:`, first, lock, 0);
  const tail = `${STOP}\n${ISSUE}\nPre-check: ${precheck(ctx.launcher, first.path)}`;
  return { compact, full: assemble(`${compact}\n\n${origin(lock, ctx, null)}`, sorted, lock, tail, ctx.max), fix: ruleFix(first, lock) };
}

// `besideDeny`: the same text also carries a denial (a CLI check), so the tail must not say nothing blocked.
export function adviseText(vs: Violation[], lock: Lock, ctx: DenyContext, besideDeny = false): Text {
  const sorted = ordered(vs);
  const first = sorted[0];
  if (first === undefined) return EMPTY;
  const count = hidden(sorted, ctx);
  const chosen = explainChoice("PREGATE ADVISOR", first, lock, count, ctx.launcher);
  const compact = headline("PREGATE ADVISOR", first, lock, count, chosen.end);
  // One line per rule. The why, the fix and the origin are one `pregate explain` away, which the
  // first line names: an advisory that fills the context is read less than one that fits a line.
  const rest = groups(sorted).slice(1, 6).map((g) => clip(oneLine(briefGroup(g)), LINE_MAX));
  const close = besideDeny ? ADVISOR_BESIDE_DENY : ADVISOR;
  const tail = chosen.spill === "" ? close : `${close}\n${chosen.spill}`;
  return { compact, full: clip([compact, ...rest, tail].join("\n"), ctx.max ?? TEXT_MAX), fix: ruleFix(first, lock) };
}

export function warnText(vs: Violation[], lock: Lock): Text {
  const lines = ordered(vs).map((v) => {
    const head = `PREGATE WARN ${safe(v.rule)} ${where(v)} ${message(v, ruleOf(lock, v.rule))}`;
    return clip(oneLine(head), LINE_MAX - INFO.length) + INFO;
  });
  const items = lines.map((l, k) => (k === 0 ? l : `\n${l}`));
  const first = ordered(vs)[0];
  return { compact: lines[0] ?? "", full: fit(items, lines.length, TEXT_MAX - MORE_MAX, more), fix: first ? ruleFix(first, lock) : null };
}

export function violationMessage(v: Violation, lock: Lock): string {
  return message(v, ruleOf(lock, v.rule));
}

// MH-09: one text for a call that changes several files: the chosen file's, then one line per other
// file with something to say.
export function alsoInCall(full: string, compacts: string[]): string {
  const head = `${full}\n\nAlso in this call:`;
  if (compacts.length === 0 || head.length + MORE_MAX > TEXT_MAX) return full;
  const items = compacts.map((c) => `\n- ${c}`);
  return head + fit(items, items.length, TEXT_MAX - MORE_MAX - head.length, more);
}

// `halt`: the turn stops here (turn cap or a run of form denies), so the agent must not resend.
export function formText(f: Form, rel: string | null, halt = false): Text {
  const at = rel === null ? "" : ` ${safe(rel)}${f.line === null ? "" : `:${f.line}`}`;
  const control = CONTROL_EN[f.cause];
  if (control !== undefined) {
    // The causes a hook blocks on. Two sentences: what the agent does not do, and what to do instead.
    // A harness may show only the first 256 characters, so a long path yields before the instruction.
    const detailed = (f.cause === "shell-admin" || f.cause === "request-invalid") && f.detail ? `${clip(oneLine(f.detail), 220).replace(/[.\s]+$/, "")}.` : control.what;
    const line = (where: string) => `PREGATE DENY ${f.cause}${where}: ${detailed} ${control.instead}`;
    const room = LINE_MAX - line("").length - 2;
    const short = rel === null ? "" : at.length - 1 <= room ? at : room < 8 ? "" : ` …${at.slice(at.length - room + 1)}`;
    const compact = clip(line(short), LINE_MAX);
    // The full text starts with the first line; a path that did not fit there follows whole.
    const full = clip(short === at ? compact : `${compact}\nPath:${at}`, TEXT_MAX);
    return { compact, full: halt ? `${full}\n${FORM_HALTED}` : full, fix: causeFix(f.cause, rel, f.line, f.detail ?? null) };
  }
  const detail = ["lock-stale", "version-mismatch", "unresolvable-import", "shell-admin", "shell-write"].includes(f.cause) && f.detail ? clip(oneLine(f.detail), f.cause === "shell-admin" ? 220 : 2000) : null;
  const fix = causeFix(f.cause, rel, f.line, detail);
  const cue = f.cause === "shell-write" && detail !== null && fix.use ? `Use ${fix.use}. `
    : (f.cause === "protected-path" || f.cause === "hook-switch") && fix.where && fix.use ? `Put the change in ${fix.where}. Use ${fix.use}. `
    : "";
  const diagnosis = detail ?? CAUSE_EN[f.cause];
  const strict = UNCERTAINTY_CAUSES.has(f.cause);
  // payload-unrecognized grows by " (claude-code)" when main labels the harness. Leave that room.
  const limit = LINE_MAX - (f.cause === "payload-unrecognized" ? " (claude-code)".length : 0);
  const headline = `PREGATE DENY ${f.cause}${at}: ${cue}${diagnosis}`;
  // An unclassified deny leads with the concrete repair, then the override, inside Grok's line.
  const compact = strict ? strictCompact(f.cause, at, fix.text, limit) : clip(headline, LINE_MAX);
  // Grok sees only `compact`. The full text keeps that line, then the unclipped sentence when the
  // cue pushed a required cause phrase past 256 characters.
  const lead = strict ? compact
    : detail !== null || compact === headline ? (detail !== null ? headline : compact) : `${compact}\n${headline}`;
  const next = FIXABLE_BY[f.cause] === "human" ? "Only the user can fix this: stop and report it to them (cause and path)."
    : halt ? FORM_HALTED
    : "If you believe this is a false positive, stop and tell the user (cause and path).";
  const help = detail === null && ["lock-stale", "version-mismatch"].includes(f.cause) ? `\n${WHY[f.cause]} If an old hook rejects new helpers, the human can type ! pregate update inside the harness to install the current engine and prepare one review. Compilation alone does not migrate version pins.`
    : f.cause === "state-io" ? "\n" + WHY["state-io"]
    : f.cause === "git-missing" || f.cause === "git-not-repository" || f.cause === "git-error" ? "\n" + WHY[f.cause]
    : f.cause === "contract-loosened" ? `${f.detail ? `\n${f.detail}` : ""}\n${WHY["contract-loosened"]}` : f.cause === "protected-path"
    ? "\nPREGATE configuration, rule sources, harness settings and state are protected. Inspect fixed harness configuration files with one literal cat -- /absolute/path/to/settings.json command, without variables, loops, filters, wrappers, pipelines or redirections. Inspect the editable contract with `pregate preset show --json` and diagnose versions/schema with `pregate preset diagnose --json`; do not run a source pre-check on policy files. Read the request format with `pregate preset request-schema`. Propose a preset change in .pregate/requests/<name>.json for human review. Codex 0.166 reports the command working directory, so a relative path resolves there; name a file outside that directory with an absolute path. Validate and prepare its review with `pregate preset apply <request.json> --preview`; this does not activate it. Only the human approves."
    : f.cause === "shell-write"
    ? `\nWhy: ${detail === null ? "The command writes a project file, or runs a script that does." : `The command was refused because ${detail}.`} Write that file with the edit tool (Write, Edit, apply_patch). Running a script or an interpreter is allowed. A registry read, an install, git init, Docker, and a package script (pnpm lint, npm run, yarn, bun run) are allowed when that script does not edit gated source. A Python module invocation such as python3 -m unittest, python -m, or -m joined to the module name, is scanned for write sinks only when that dotted name resolves to a file in the working directory. A module that does not resolve there, such as unittest, pytest, or pip, is not a script path.\nFix: ${fix.text}`
    : f.cause === "approval"
    ? "\nAn agent cannot grant itself approval by setting PREGATE_UNATTENDED_APPROVAL, PREGATE_TESTING, PREGATE_TEST_ANSWER or PREGATE_ACCEPT_CONTRACT. A literal pregate approve with a code, or pregate approve --yes with an optional digest, is the in-harness confirmation, including a harness ! line. --yes on any other pregate command except enable and disable is accepted in that shell. enable and disable stay in a separate terminal."
    : "";
  const uncertainty = "";
  const fixAlready = help.includes("\nFix: ") || help.includes("Fix: ") || compact.includes(fix.text);
  const fixLine = fixAlready ? "" : `\nFix: ${fix.text}`;
  const carried = strict ? `${fixLine}\n${diagnosis}` : fixLine;
  return { compact, full: `${lead}${carried}${help}${uncertainty}\n\n${next}${f.cause === "hook-switch" ? `\n${POLICY_ADAPTATION}` : ""}\n${ISSUE}`, fix };
}

// The first line of an unclassified deny. The repair and the override stay; a long path yields.
function strictCompact(cause: string, at: string, fixText: string, limit: number): string {
  const fixSentence = `Fix: ${oneLine(fixText)}`;
  const tail = `${fixSentence}${UNCERTAINTY_OVERRIDE}`;
  const withPath = `PREGATE DENY ${cause}${at}: ${tail}`;
  if (withPath.length <= limit) return withPath;
  const head = `PREGATE DENY ${cause}: `;
  const bare = head + tail;
  if (bare.length <= limit) return bare;
  const room = limit - head.length - UNCERTAINTY_OVERRIDE.length;
  if (room >= "Fix: ".length + 8) return head + clip(fixSentence, room) + UNCERTAINTY_OVERRIDE;
  return clip(head + tail, limit);
}

// Advisor mode does not block a grammar failure. The file was not evaluated, so the text must not say it was clean.
export function syntaxAdvisory(f: Form, rel: string | null): Text {
  const at = rel === null ? "" : ` ${safe(rel)}${f.line === null ? "" : `:${f.line}`}`;
  const compact = clip(`PREGATE WARN syntax${at}: parse failure. This file does not parse, so its rules were not evaluated. Fix the syntax error and resend.`, LINE_MAX);
  return { compact, full: clip(`${compact}\n\nThis is not a clean result. PREGATE did not check this file for violations.`, TEXT_MAX), fix: causeFix(f.cause, rel, f.line, f.detail ?? null) };
}

// The causes a hook blocks on: the agent acting on Pregate itself. Short on purpose.
const CONTROL_EN: Partial<Record<Cause, { what: string; instead: string }>> = {
  "protected-path": { what: "the agent does not write Pregate's files or harness settings; reading is fine.",
    instead: "Tell the user the change you want, or put it in .pregate/requests/<name>.json and run pregate preset apply <file> --preview." },
  "request-invalid": { what: "the request file does not match schema/request.v1.json.",
    instead: "Fix the JSON and resend it." },
  "hook-switch": { what: "the agent does not install, remove, or switch off Pregate or the hooks of a harness.",
    instead: "Tell the user; they run pregate disable or pregate setup." },
  "approval": { what: "the agent does not approve for the human.",
    instead: "Ask the user to run the approval command themselves; in a harness, on a ! line." },
  "shell-admin": { what: "this command changes Pregate's configuration, skips its git hook, or hides a command name behind a variable.",
    instead: "Spell the command literally, or tell the user what you need; they run it." },
};

// What a hook says about a cause it does not block on. One line; `pregate doctor` has the detail.
const NOTE_EN: Partial<Record<Cause, string>> = {
  "tool-will-fail": "the text to replace is not in the current file, or is not unique, so the edit was not checked.",
  "cannot-reconstruct": "this edit could not be rebuilt, so it was not checked.",
  "shell-write": "this command writes a project file, so the change was not checked. The edit tool gets it checked.",
  "shell-uncertain": "this command has unfinished shell syntax, so it was not classified.",
  "payload-unrecognized": "this call has a shape this PREGATE version does not know, so it was not checked.",
  "lock-stale": "the lock does not match the preset or its sources, so this call was not checked. `pregate preset compile` rebuilds it.",
  "version-mismatch": "the lock was written by another PREGATE version, so this call was not checked. `pregate update` installs the newest engine.",
  "snapshot-missing": "this session has no starting snapshot here, so this call was not checked.",
  "state-io": "PREGATE state is busy or unwritable, so this call was not checked. `pregate doctor` explains.",
  "git-missing": "git is not on PATH, so this call was not checked.",
  "git-not-repository": "this directory is not a Git repository, so this call was not checked.",
  "git-error": "git returned an error, so this call was not checked.",
  "regex-limit": "a rule regex hit its backtracking limit on this file, so that rule was not checked.",
  "contract-loosened": "the contract here enforces less than at session start. Nothing is blocked locally; the pull request review and `pregate check --ratchet` in CI decide.",
};

export function notedText(f: Form, rel: string | null): Text {
  const at = rel === null ? "" : ` ${safe(rel)}${f.line === null ? "" : `:${f.line}`}`;
  const compact = clip(`PREGATE NOTE ${f.cause}${at}: ${f.said ? oneLine(f.said) : NOTE_EN[f.cause] ?? CAUSE_EN[f.cause]} Not blocked.`, LINE_MAX * 2);
  return { compact, full: compact, fix: null };
}

// Advisor mode does not block an import it could not resolve when no enforced rule would have judged the file.
export function unresolvedAdvisory(f: Form, rel: string | null): Text {
  const at = rel === null ? "" : ` ${safe(rel)}${f.line === null ? "" : `:${f.line}`}`;
  const detail = f.detail ? clip(oneLine(f.detail), 2000) : null;
  const compact = clip(`PREGATE WARN unresolvable-import${at}: ${detail ?? CAUSE_EN["unresolvable-import"]}`, LINE_MAX);
  return { compact, full: clip(`${compact}\n\nThis is not a clean result. PREGATE did not check this file for violations, and it did not block.`, TEXT_MAX), fix: causeFix(f.cause, rel, f.line, detail) };
}

// The literal invocation the shell guard allows (ARCHITECTURE §4.2; MH-29: `pregate` on the PATH or
// the global launcher's absolute path). A path that would not survive as one shell word, or that `safe` would alter, becomes <file>: a
// pre-check on another path can fall in another layer and give another verdict.
export function precheck(launcher: string, rel: string | null): string {
  const path = rel !== null && rel.length <= ARG_MAX && WORD.test(rel) ? rel : "<file>";
  return `\`${word(launcher)} check --stdin --path ${path} --format agent\``;
}

// What the agent is told at SessionStart and what `preset show` prints (§4.4, §7.2 #20).
export function contract(lock: Lock, launcher: string): string {
  const p = lock.preset;
  const rules = lock.rules.filter((r) => !lock.ownedByArkgate.includes(r.id)).map((r) => {
    const paths = (r.params.paths as string[] | undefined) ?? [];
    const where = paths.length === 1 && paths[0] === "**" ? "" : ` in ${paths.join(", ") || "no file"}`;
    return `- ${r.id} (${severityText(r)}, ${enforcementOf(lock, r)}${where}): ${clip(oneLine(r.text.why || r.text.message), 200)}`;
  });
  const layers = Object.entries(lock.layers).map(([name, l]) =>
    `- ${name} (${l.paths.join(", ")}) may import ${l.mayImport.length === 0 ? "nothing outside itself" : l.mayImport.join(", ")}`);
  const scope = lock.scope.include.join(", ") + (lock.scope.exclude.length === 0 ? "" : ` except ${lock.scope.exclude.join(", ")}`);
  const relations = (lock.relations ?? []).map(relationLine);
  return [
    `PREGATE is active: preset ${p.name} ${p.version} (${p.methodologies.join(" + ")}), ${lock.enforcement}, ratchet ${lock.ratchet}.`,
    `Every file write and edit in scope (${scope}) is checked before it is written. Per-rule policy (enforce blocks deny/ask; advisor informs so the agent decides; shadow observes; warn never blocks):`,
    ...rules,
    ...(layers.length === 0 ? [] : ["Layers:", ...layers]),
    ...(relations.length === 0 ? [] : ["Rule interactions declared by the packs:", ...relations]),
    `Optional pre-check when permitted, with file content on stdin: ${precheck(launcher, null)}`,
    INSPECTION_GUIDANCE,
    "Do not edit .pregate/, rule sources or harness settings: propose a preset change as .pregate/requests/<name>.json (schema/request.v1.json).",
    POLICY_ADAPTATION,
  ].join("\n");
}

export function relationLine(r: LockRelation): string {
  const [a, b] = r.rules;
  const head = r.kind === "idiom" ? `${a} works against ${b} conventions` : `${a} ${r.kind} ${b}`;
  return `- ${head}: ${clip(oneLine(r.why), 240)} ${r.note === undefined ? `Settle: ${clip(oneLine(r.settle), 240)}` : `Settled: ${clip(oneLine(r.note), 240)}`}`;
}

// Keep session context bounded; preset show remains the complete contract for large packs.
// `lead` is an optional first line (an available update); it counts against the same budget.
// Only executable checks are listed (at most BRIEF_RULES); fitness requirements without a reviewed
// verifier have nothing to run, so they are one count line.
export function briefing(lock: Lock, launcher: string, lead: string | null = null): string {
  const scope = clip(oneLine(lock.scope.include.join(", ") + (lock.scope.exclude.length ? ` except ${lock.scope.exclude.join(", ")}` : "")), 400);
  const head = `${lead === null ? "" : `${lead}\n`}PREGATE is active: preset ${safe(lock.preset.name)} ${safe(lock.preset.version)}, ${lock.enforcement}, ratchet ${lock.ratchet}. Scope: ${scope}.`;
  const own = lock.rules.filter((r) => !lock.ownedByArkgate.includes(r.id));
  const owed = own.filter((r) => unbound(lock, r)).length;
  // Only a rule that can block is listed: the agent has to know it before it edits. A rule that
  // informs is one count; it speaks for itself in one line when an edit meets it.
  const bound = own.filter((r) => !unbound(lock, r));
  const blockers = bound.filter((r) => enforcementOf(lock, r) === "enforce" && r.severity !== "warn");
  const informing = bound.length - blockers.length;
  const rules = blockers.map((r) => briefRule(lock, r));
  if (informing > 0) rules.push(`${informing} checks inform and never block.`);
  rules.push(...Object.entries(lock.layers).map(([name, layer]) => `Layer ${name} (${layer.paths.join(",")}): may import ${layer.mayImport.join(",") || "only itself"}.`));
  // Until the project binds its first verifier it has not adopted project verification, so the
  // unbound requirements are not session context; status and audit still report them.
  const obligations = owed === 0 || !adoptedFitness(lock) ? "" : `\nEvidence obligations: ${owed} requirements have no reviewed project verifier; preset show lists them (unverified is not compliance).`;
  const tail = `Enforce blocks deny/ask; advisor informs so the agent decides; shadow observes; warn never blocks. Existing metric debt must not grow.\nOptional pre-check when permitted: ${precheck(launcher, null)}\nUse /pregate for guidance and \`${word(launcher)} preset show\` for scope, parameters and layers when inspection is permitted. Contract changes require human approval. For onboarding or updates, inspect guide --json and offer relevant choices together; prepare one guide --preview for the chosen packs. Only the human confirms its review.\n${INSPECTION_GUIDANCE}\n${ADAPTATION_BRIEF}`;
  const budget = TEXT_MAX - head.length - obligations.length - tail.length - 100;
  const listed = fit(rules.slice(0, BRIEF_RULES).map((r) => `\n${r}`), rules.length, budget, (n) => `\n+${n} checks; preset show lists full details when inspection is permitted.`);
  return `${head}${listed === "" ? "" : `\nChecks:${listed}`}${obligations}\n${tail}`;
}

function briefRule(lock: Lock, r: LockRule): string {
  const params = Object.entries(r.params).filter(([key, value]) => key === "max" || key === "packages" || (key === "paths" && !equalPaths(value)));
  const detail = params.map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : String(value)}`).join("; ");
  return `- ${safe(r.id)} (${severityText(r)}, ${enforcementOf(lock, r)}): ${safe(r.check.split("/").at(-1)!.split("@")[0]!)}${detail ? ` (${clip(oneLine(detail), 160)})` : ""}`;
}

// A fitness requirement runs only through a reviewed binding (lock.fitness); without one it is evidence owed.
function severityText(r: LockRule): string {
  const gate = r.versionGate;
  if (!gate) return r.severity;
  if (gate.unmatched === "skip") return `${gate.severity} when ${gate.package} ${gate.range}`;
  if (gate.severity === r.severity) return r.severity;
  return `${gate.severity} when ${gate.package} ${gate.range}, otherwise ${r.severity}`;
}

export function adoptedFitness(lock: Lock): boolean {
  return Object.keys(lock.fitness ?? {}).length > 0;
}

function unbound(lock: Lock, r: LockRule): boolean {
  if (r.impl.kind !== "primitive" || r.impl.primitive !== "fitness") return false;
  const verifier = r.params.verifier;
  return typeof verifier !== "string" || !lock.fitness || !Object.hasOwn(lock.fitness, verifier);
}

function equalPaths(value: unknown): boolean {
  return Array.isArray(value) && value.length === 1 && value[0] === "**";
}

export function notice(key: NoticeKey, args: NoticeArgs = {}, vs: Violation[] = []): string {
  const at = args.path ? ` at ${safe(args.path)}` : "";
  const text = noticeHead(key, at, args);
  const items = ordered(vs).map((v) => `\n- ${brief(v)}`);
  return items.length === 0 ? text : text + fit(items, items.length, TEXT_MAX - MORE_MAX - text.length, more);
}

function noticeHead(key: NoticeKey, at: string, args: NoticeArgs): string {
  switch (key) {
    case "no-preset": return "PREGATE is inactive: no .pregate/preset.json in this repo.";
    case "no-git": return "PREGATE requires Git; this directory is not in a Git repository. All edits will be denied.";
    case "lock-stale": return `PREGATE: ${WHY["lock-stale"]} All edits are denied until then.`;
    case "start-failed": return "PREGATE: session start did not finish. The first edit takes the snapshot against HEAD; existing dirty files may receive stricter denials.";
    case "ask": return `PREGATE requests your approval${at}: the change violates a rule requiring human confirmation.`;
    case "approved": return "PREGATE: you approved these rule violations; they do not block the end of the turn.";
    case "stop-cap": return `PREGATE let the turn finish with pending changes after reaching the Stop limit. This is not a successful compliance check. Repair the findings; propose policy changes through .pregate/requests/ for human review.${pending(args)}\n${POLICY_ADAPTATION}`;
    case "halt": return haltHead(at, args) + (["turn-cap", "file-rule-cap", "no-progress", "ask-unavailable"].includes(args.reason ?? "") ? `\n${POLICY_ADAPTATION}` : "");
  }
}

function haltHead(at: string, { reason, cause }: NoticeArgs): string {
  if (reason !== undefined && Object.hasOwn(FIXABLE_BY, reason)) return `PREGATE cannot evaluate${at}: ${WHY[reason]}`;
  const last = reason === "form-run" && cause !== undefined ? ` Last cause: ${WHY[cause]}` : "";
  return `PREGATE stopped the turn${at}: ${reason === undefined ? "" : WHY[reason]}${last}`;
}

function pending({ reason }: NoticeArgs): string {
  return reason === undefined ? "" : ` Pending: ${WHY[reason]}`;
}

// Cites the lock that produced the deny (SPEC §7.7, O7).
// Whole methodology names only: those that fit, then how many more, so no name is cut mid-word.
function origin(lock: Lock, ctx: DenyContext, attempt: number | null): string {
  const p = lock.preset;
  const rest = [...(attempt === null ? [] : [`attempt ${attempt}`]), ...(ctx.lockHash === null ? [] : [`lock ${ctx.lockHash.slice(0, 6)}`])];
  const room = LINE_MAX - `Preset ${p.name} ${p.version} ()`.length - rest.reduce((sum, part) => sum + part.length + 3, 0);
  return clip([`Preset ${p.name} ${p.version} (${wholeNames(p.methodologies, room)})`, ...rest].join(" · "), LINE_MAX);
}

function wholeNames(names: string[], room: number): string {
  for (let n = names.length; n > 0; n--) {
    const text = names.slice(0, n).join(" + ") + (n < names.length ? ` + ${names.length - n} more` : "");
    if (text.length <= room) return text;
  }
  return `${names.length} methodologies`;
}

function headline(head: string, v: Violation, lock: Lock, more: number, end = ""): string {
  const r = ruleOf(lock, v.rule);
  const fix = ruleFix(v, lock);
  const tail = `${more > 0 ? ` +${more} more` : ""}${end === "" ? "" : ` ${end}`}`;
  const line = `${head} ${safe(v.rule)} ${where(v)}${fixCue(fix)} ${message(v, r)} Fix: ${fix.text}`;
  return clip(oneLine(line), LINE_MAX - tail.length) + tail;
}

// Grok shows one line of 256 characters. The concrete path and replacement stay on that line.
// A long absolute `explain` command moves to the body when it would cut them.
function explainChoice(head: string, v: Violation, lock: Lock, more: number, launcher: string): { end: string; spill: string } {
  const explain = `Details: \`${word(launcher)} explain ${safe(v.rule)}\``;
  const fallback = `Details: \`pregate explain ${safe(v.rule)}\``;
  const preferred = explain.length <= LINE_MAX / 2 ? explain : fallback;
  const lead = `${head} ${safe(v.rule)} ${where(v)}${fixCue(ruleFix(v, lock))}`;
  const moreText = more > 0 ? ` +${more} more` : "";
  const fits = (end: string): boolean => lead.length + moreText.length + (end === "" ? 0 : end.length + 1) + 1 <= LINE_MAX;
  if (fits(preferred)) return { end: preferred, spill: preferred === explain ? "" : explain };
  if (preferred !== fallback && fits(fallback)) return { end: fallback, spill: explain };
  return { end: "", spill: explain };
}

// The concrete path and replacement lead the first line. A cut lands on a separator, not inside a path.
function fixCue(fix: DecisionFix): string {
  if (!fix.where && !fix.use) return "";
  const parts = [fix.where ? `where ${fix.where}` : "", fix.use ? `use ${fix.use}` : ""].filter((part) => part !== "");
  const text = ` ${parts.join("; ")}.`;
  if (text.length <= 160) return text;
  const cut = text.slice(0, 159);
  const at = Math.max(cut.lastIndexOf(";"), cut.lastIndexOf(" "), cut.lastIndexOf(","));
  return `${at > 20 ? cut.slice(0, at) : cut}…`;
}

type Group = { rule: string; items: Violation[] };

// One entry per rule. Every rule gets a brief line first; then the first loop.maxDetailedViolations
// rules (detailed rules, not findings) are upgraded to full detail while the text stays in budget.
function assemble(head: string, vs: Violation[], lock: Lock, tail: string, max = TEXT_MAX): string {
  const gs = groups(vs);
  const budget = max - head.length - tail.length - MORE_MAX;
  const items = gs.slice(0, BRIEF_MAX).map((g, k) => `\n${k + 1}) ${briefGroup(g)}`);
  let used = items.reduce((sum, item) => sum + item.length, 0), detailed = 0;
  for (const [k, g] of gs.slice(0, Math.min(lock.loop.maxDetailedViolations, items.length)).entries()) {
    const upgraded = `\n\n${k + 1}) ${detailGroup(g, lock)}`;
    if (used - items[k]!.length + upgraded.length > budget) break;
    used += upgraded.length - items[k]!.length;
    items[k] = upgraded;
    detailed++;
  }
  if (detailed > 0 && detailed < items.length) items[detailed] = `\n${items[detailed]}`;
  const omitted = (n: number) => more(gs.slice(gs.length - n).reduce((sum, g) => sum + g.items.length, 0));
  return `${head}${fit(items, gs.length, budget, omitted)}\n\n${tail}`;
}

// First-occurrence order of an ordered() list, so grouping stays deterministic.
function groups(vs: Violation[]): Group[] {
  const byRule = new Map<string, Violation[]>();
  for (const v of vs) byRule.set(v.rule, [...(byRule.get(v.rule) ?? []), v]);
  return [...byRule].map(([rule, items]) => ({ rule, items }));
}

function briefGroup(g: Group): string {
  return g.items.length === 1 ? brief(g.items[0]!) : `${safe(g.rule)} ${locations(g.items)}`;
}

function detailGroup(g: Group, lock: Lock): string {
  const [first, ...rest] = g.items;
  return detail(first!, ruleOf(lock, g.rule), lock) + (rest.length ? `\n   Also at: ${locations(rest)}` : "");
}

// `a.ts:15,16; b.ts:3`, clipped with the count of locations left out.
function locations(vs: Violation[]): string {
  let out = "", shown = 0;
  for (const [k, v] of vs.entries()) {
    const part = k > 0 && vs[k - 1]!.path === v.path ? `,${v.line}` : `${k > 0 ? "; " : ""}${where(v)}`;
    if (k > 0 && out.length + part.length > LOCATIONS_MAX) break;
    out += part;
    shown++;
  }
  return shown < vs.length ? `${out} …+${vs.length - shown}` : out;
}

// Greedy: whole items while they fit, then one line with how many were left out.
function fit(items: string[], total: number, budget: number, rest: (n: number) => string): string {
  let out = "";
  let shown = 0;
  for (const item of items) {
    if (out.length + item.length > budget) break;
    out += item;
    shown++;
  }
  return shown < total ? out + rest(total - shown) : out;
}

function more(n: number): string {
  return `\n+${n} more findings not shown: run the pre-check to see them all.`;
}

const SAFE_REPAIR = /^Suggested (?:split|refactor): [A-Za-z0-9 .,:-]{1,120}$/;

function detail(v: Violation, r: LockRule | undefined, lock: Lock): string {
  const symbol = v.symbol === "<module>" ? "" : ` · ${name(v.symbol)}`;
  const repair = v.repair && SAFE_REPAIR.test(v.repair) ? ` ${v.repair}` : "";
  const lines = [
    `${safe(v.rule)} → ${r?.check ?? "?"} · ${where(v)}${symbol}`,
    message(v, r),
    measures(v),
    whyLine(v, r),
    `Fix: ${field(ruleFix(v, lock).text)}${repair}`,
    r?.text.avoid ? `Avoid: ${field(r.text.avoid)}` : "",
  ];
  return lines.filter((l) => l !== "").join("\n   ");
}

// A why that only repeats the message adds nothing; its source still names where the rule comes from.
function whyLine(v: Violation, r: LockRule | undefined): string {
  const why = field(r?.text.why), source = field(r?.text.source);
  if (why !== "" && why !== field(template(v, r))) return `Why: ${why} (${source})`;
  return source === "" ? "" : `Source: ${source}`;
}

function measures(v: Violation): string {
  if (v.measured === null && v.limit === null) return "";
  const s = v.atSessionStart;
  const start = s === null ? "" : ` · at session start ${s} (keep it ≤ ${s}, do not grow it)`;
  return `Measured ${num(v.measured)} · limit ${num(v.limit)}${start}`;
}

function brief(v: Violation): string {
  const ratio = v.measured === null && v.limit === null ? "" : ` ${num(v.measured)}/${num(v.limit)}`;
  return `${safe(v.rule)} ${where(v)}${ratio}`;
}

// Fills the check's feedback template. Placeholders come from the violation or the rule's scalar
// params; anything else (`{match}`, `{capture}`) would quote code, so it renders as "?".
function message(v: Violation, r: LockRule | undefined): string {
  return template(v, r) + edgeText(v);
}

// The layers and the import a layer-edge finding is about; names pass through `safe` like any path.
function edgeText(v: Violation): string {
  if (v.edge === undefined) return "";
  const to = v.edge.to === null ? "code outside every layer" : `layer ${name(v.edge.to)}`;
  return ` Layer ${name(v.edge.from)} imports ${to} via ${name(v.edge.spec)}.`;
}

function template(v: Violation, r: LockRule | undefined): string {
  if (v.detail !== undefined && NODE_PIN_DETAIL.test(v.detail)) return v.detail;
  return oneLine(r?.text.message ?? "").replace(/\{(\w+)\}/g, (_all, key: string) => {
    if (key === "symbol") return v.symbol === "<module>" ? "the module" : name(v.symbol);
    if (key === "path") return name(v.path);
    if (key === "line") return String(v.line);
    if (key === "measured") return num(v.measured);
    if (key === "limit") return num(v.limit);
    const p = r?.params[key];
    if (typeof p === "number" || typeof p === "boolean") return String(p);
    return typeof p === "string" ? name(p) : "?";
  });
}

function ruleOf(lock: Lock, id: string): LockRule | undefined {
  return lock.rules.find((r) => r.id === id);
}

// A total order over every rendered field, so the text never depends on the order of the input.
function ordered(vs: Violation[]): Violation[] {
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const n = (x: number | null): number => x ?? -1;
  return [...vs].sort((a, b) =>
    RANK[a.severity] - RANK[b.severity] || cmp(a.path, b.path) || a.line - b.line || cmp(a.rule, b.rule) ||
    cmp(a.symbol, b.symbol) || n(a.measured) - n(b.measured) || n(a.limit) - n(b.limit) ||
    n(a.atSessionStart) - n(b.atSessionStart));
}

function where(v: Violation): string {
  return `${safe(v.path)}:${v.line}`;
}

function num(n: number | null): string {
  return n === null ? "?" : String(n);
}

function name(s: string): string {
  return `\`${safe(s)}\``;
}

// Keeps the tail: the file name and the innermost symbol are the informative part. Never empty, so a
// literal command keeps its shape. [ and ] stay (O36): Next.js routes live under [id]/, and the agent
// must read a path that exists. A shell command never takes them: WORD excludes them.
function safe(s: string): string {
  return s.replace(/[^A-Za-z0-9@/._$[\]-]/g, "_").slice(-NAME_MAX) || "_";
}

// POSIX single quotes: the launcher lives under the root, which may hold spaces.
function word(s: string): string {
  return WORD.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`;
}

function field(s: string | undefined): string {
  return clip(oneLine(s ?? ""), FIELD_MAX);
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// A cut inside a `name` would leave its quote open, so the cut moves before it.
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const open = cut.split("`").length % 2 === 0;
  return `${open ? cut.slice(0, cut.lastIndexOf("`")) : cut}…`;
}
