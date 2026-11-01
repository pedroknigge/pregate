// Shared vocabulary (ARCHITECTURE §3): plain data only, plus FIXABLE_BY.

export type Severity = "deny" | "ask" | "warn";
export type Enforcement = "enforce" | "shadow" | "advisor";
export type Phase = "pre" | "stop" | "commit" | "ci";
export type RuleLanguage = "typescript" | "python" | "go" | "rust";
export type Grammar = RuleLanguage | "tsx"; // JS and JSX use the TSX grammar and TypeScript rule family.
export interface CodeImport { spec: string; line: number; kind: "static" | "type" | "dynamic" | "require" | "reexport"; literal: boolean; base?: string }
export type Read = (rel: string) => string | null;              // rel to the root; null = does not exist
export type BaselineRead = Read & { prime?: (rels: string[]) => Cause | void };
export interface ImportFacts { imports: CodeImport[]; hasError: boolean; resolutionKey?: string }
export type ImportsOf = (rel: string, text: string) => ImportFacts;
export type Files = Record<string, string>;                     // sources and fixtures in memory
export type Reconstruction = "exact" | "tool-will-fail" | "unknown";
export type Clock = () => number;                               // monotonic ms; the shell injects it (O27)
export interface Host {
  read: Read; now: Clock; hash?: boolean; importsOf?: ImportsOf;
  ruleProgress?: <T>(rule: string, run: () => T) => T;
  resolutionProgress?: <T>(run: () => T) => T;
} // baselines need findings, not a whole-tree hash

// ── Causes of a deny that is not a rule violation (closed list) ─────────────────
export type Cause =
  // the agent can fix it ⇒ form deny: does not consume the (file, rule) counter
  | "protected-path" | "request-invalid" | "tool-will-fail" | "cannot-reconstruct"
  | "syntax" | "unresolvable-import" | "shell-write" | "shell-admin" | "hook-switch"
  // only the human can fix it ⇒ deny + halt + notice
  | "payload-unrecognized" | "lock-stale" | "version-mismatch"
  | "snapshot-missing" | "state-io" | "git-failed" | "regex-limit";
export const FIXABLE_BY = Object.freeze({
  "protected-path": "agent", "request-invalid": "agent", "tool-will-fail": "agent",
  "cannot-reconstruct": "agent", "syntax": "agent", "unresolvable-import": "agent",
  "shell-write": "agent", "shell-admin": "agent", "hook-switch": "agent",
  "payload-unrecognized": "human", "lock-stale": "human", "version-mismatch": "human",
  "snapshot-missing": "human", "state-io": "human", "git-failed": "human", "regex-limit": "human",
} as const satisfies Record<Cause, "agent" | "human">);
// "lock-stale" covers a missing, invalid or old lock, sources that fail verification and a vanished
// preset: same remedy. "timeout" and "engine-crash" are not causes: launcher.sh emits them (A6).
// "regex-limit": a rule's regex may have given up on this file, so its "no match" is not an answer
// (O27); the rule's author fixes it.

// ── Normalized input (harness-agnostic) ──────────────────────────────────────────
export type HarnessId = "claude-code" | "codex" | "cursor" | "grok" | "agy";
export type HookKind = "pre" | "stop" | "session-start";       // what a registration names: hook <kind> --harness <id>
// What a hook call reads from its environment besides the payload (MULTI-HARNESS MH-03, MH-06).
export interface HookEnv {
  grokEvent: string | null;        // GROK_HOOK_EVENT; null when unset or empty
  projectDir: string | null;       // the harness's project dir variable: a hint for the root, never trusted alone
  remote: boolean;                 // CLAUDE_CODE_REMOTE = "true"
}
export interface Session {
  id: string;                      // the harness's own id; state keys it together with `harness` (MH-05)
  harness: HarnessId;
  agentId: string | null;
  turnId: string | null;           // when missing, the turn derives from the last recorded Stop
  interactive: boolean;            // only Claude Code can be: mode ∈ {default, acceptEdits, auto, plan} ∧ no agentId
}                                  //   ∧ CLAUDE_CODE_REMOTE ≠ "true"; unknown ⇒ false
export interface ProposedChange {  // an adapter produces it, gate.onPreEdit consumes it (A16, MH-07)
  session: Session; callId: string; tool: string;
  path: string;                    // absolute, no . .. or // segments (else the adapter rejects the call)
  edit: Edit;
  from: string | null;             // a move's origin, which gets its own { form: "delete" } change
}
export interface ProposedCommand { session: Session; callId: string; tool: string; command: string; cwd: string }
export type HookEvent =
  | { kind: "session-start"; session: Session; cwd: string }
  | { kind: "pre-edit"; changes: ProposedChange[] }           // ≥ 1, all from one tool call
  | { kind: "pre-command"; command: ProposedCommand }
  | { kind: "stop"; session: Session; cwd: string; reentry: boolean };
// A call the adapter cannot turn into a HookEvent. `kind` and `reentry` pick the channel of the
// refusal; `dirs` are the envelope's directories, which tell whether the call reaches a root (MH-06).
export interface Rejected { cause: Cause; kind: HookEvent["kind"]; reentry: boolean; session: Session | null; dirs: string[] }
export type Edit =
  | { form: "full"; content: string }
  | { form: "append"; text: string }
  | { form: "oldnew"; old: string; neu: string; all: boolean; lines: [number, number] | null }   // lines: 1-based, inclusive
  | { form: "hunks"; hunks: Hunk[] }
  | { form: "delete" }
  | { form: "unknown"; cause: string };
// One chunk of a patch: `old` (context and removed lines) is replaced by `neu` (context and added
// lines), searched after `anchor` when there is one, and at the end of the file when `eof`.
export interface Hunk { anchor: string | null; old: string[]; neu: string[]; eof: boolean }

// ── Output ───────────────────────────────────────────────────────────────────────
export interface Violation {       // data only: message.ts renders the text from lock.rules[].text
  rule: string;                    // FQN of the winning alias, e.g. "core/CC-FN-001"
  path: string; line: number;      // rel to the root; 1-based
  symbol: string;                  // "Invoice.calculateTotals" | "<module>" (raw; message.ts sanitizes it)
  measured: number | null; limit: number | null; atSessionStart: number | null;
  severity: Severity;
  repair?: string;                 // synthesized AST repair hint (line numbers and structure only)
  edge?: { from: string; to: string | null; spec: string };   // layer-edge: source layer, target layer (null: none), import as written
}
export interface Decision {
  contractApproval?: boolean;      // native, enforced human permission for the exact validated edit
  stopIncomplete?: { reason: "limit" | "human-cause" | "budget"; cause: Cause | null };
  verdict: "none" | "deny" | "ask"; // "none" = no objection; "allow" does not exist
  halt: boolean;
  cause: Cause | null;             // null ⇔ the deny/ask comes from violations (with "none": the muted form cause)
  violations: Violation[];         // introduced, and causing the verdict
  warnings: Violation[];           // introduced warn → additionalContext
  attempt: number;                 // attempt n on (agent, file, rule)
  compact: string; full: string;   // ≤ 256 / ≤ 4,000 chars
  notice: string | null;           // to the human: systemMessage / stopReason
  lockHash: string | null;
  shadowed: boolean;               // shadow muted a finding/cause, including calls with another blocking rule
}
export interface Emission { stdout: string; stderr: string; exit: 0 | 2 }   // exit 1 is unrepresentable
export interface DecideInput {
  lock: Lock | null;               // null only with a human cause
  lockHash: string | null;         // sha256 of the lock bytes; null without a lock (O7)
  launcher: string;                // absolute <root>/.pregate/bin/pregate, cited by the deny text (§4.2)
  session: Session; event: HookEvent["kind"]; path: string | null;
  introduced: Violation[]; form: Form | null; protectedPath: boolean;
  history: CallEvent[];            // same (agent, file), ordered by `at`
  turnDenials: number;             // same agent in the turn, form denies included
  astHash: string | null;
  stop: { blocks: number; reentry: boolean; approved: Violation[] } | null;   // approved: asks already accepted (§4.3)
}

// ── Pattern language: closed subset of ast-grep rules ───────────────────────────
export type ScopeKind = "local" | "module" | "parameter" | "unshadowed";
export interface MatchRule {
  pattern?: string; kind?: string; regex?: string; matches?: string; scope?: ScopeKind;
  nthChild?: number | { position: number; reverse?: boolean; ofRule?: MatchRule };
  has?: Relation; inside?: Relation; follows?: Relation; precedes?: Relation;
  all?: MatchRule[]; any?: MatchRule[]; not?: MatchRule;
}
export interface Relation extends MatchRule { field?: string; stopBy?: "neighbor" | "end" | MatchRule }
export interface PatternConfig {   // "x-*" keys are ignored (notes); any other unknown key ⇒ error
  id: string; rule: MatchRule;
  constraints?: Record<string, MatchRule>; utils?: Record<string, MatchRule>;
  files?: string[]; ignores?: string[];  // accepted by the format; compile moves them to params.paths/exclude
}

export type Placement = "new-in-exclude" | "edit-generated-or-excluded" | "no-language-pack-in-layer";
export type Impl =
  | { kind: "pattern"; patterns: Partial<Record<RuleLanguage, PatternConfig[]>> }
  | { kind: "primitive"; primitive: "metric"; metric: "fn.lines" | "fn.params" | "class.publicMethods" | "control.nesting" }
  | { kind: "primitive"; primitive: "banned-import" }                       // params.packages
  | { kind: "primitive"; primitive: "drizzle-bounded-select" }             // source-proven result cardinality
  | { kind: "primitive"; primitive: "interval-cleanup" }                  // matching local/typed handle cleanup reads
  | { kind: "primitive"; primitive: "react-index-key" }                   // fixed placeholder list exception
  | { kind: "primitive"; primitive: "credential-literal" }                // fixture-aware exact URL placeholders
  | { kind: "primitive"; primitive: "layer-edge" }                          // lock.layers
  | { kind: "primitive"; primitive: "fitness"; requirement: string }       // approved project verification, independent of source grammar
  | { kind: "primitive"; primitive: "diff"; op: "no-decrease" | "no-increase";
      count: "markers" | { pattern: PatternConfig } }                       // params.markers by substring, or AST count
  | { kind: "primitive"; primitive: "placement"; cases: Placement[] };

// ── Disk formats (validated by schema/*.json; the engine reads these fields) ────
export interface Check {
  id: string; version: string; area: string;
  cardinality: "singleton" | "multi"; dimension: string; minSeverity: Severity | null;
  params: Record<string, unknown>;             // JSON Schema per parameter
  impl: Impl; phase: Phase[]; feedback: { message: string }; languages?: RuleLanguage[];
}                                               // v1 keys (ir, measures, fingerprint…) are accepted and ignored
export interface Alias {
  id: string; check: string; defaults: Record<string, unknown>; severity: Severity | "off";
  source: { work: string; locator: string; paraphrase: string };
  why: string; fixHint: string; avoid: string; examples?: { pass: string; fail: string };
  relations?: RuleRelation[];
}
// `with` names another alias (ns/ALIAS-ID) or, for idiom, a pack namespace whose framework mandates the opposite.
export type RelationKind = "contradicts" | "duplicates" | "idiom";
export interface RuleRelation { with: string; kind: RelationKind; why: string; settle: string }
export interface LockRelation { rules: [string, string]; kind: RelationKind; why: string; settle: string; note?: string }
export interface Manifest {
  id: string; version: string; status: "complete" | "preview";
  conflicts: { with: string; dimension: string; suggest: { use: string }; why: string }[];
  invariants: Alias[];
}
export interface Fixture {
  language: RuleLanguage; params: Record<string, unknown>;
  context?: { layers?: Record<string, Layer>; scope?: { include?: string[]; exclude?: string[] };
              generatedMarkers?: string[];
              fitness?: { command: string[]; receipt: FitnessReceipt | null; contractHash: string; inputHash: string } };
  target: string; before: string | null;       // "before/" for diff and ratchet
  expect: { verdict: "pass" | "fail"; violations?: { line: number; measured?: number }[] };
  trap?: { family: string; origin: "real" | "corpus" | "forge"; discovered: string; note: string };
}

// ── Preset (MVP subset of SPEC §8.3) and lock ───────────────────────────────────
export interface Layer { paths: string[]; mayImport: string[]; kind: "core" | "port" | "adapter" | "main" }
export interface Loop {
  maxDenialsPerFileRule: number; maxDenialsPerTurn: number; noProgressLimit: number;
  maxStopBlocks: number; allowAsk: boolean; maxDetailedViolations: number;
}
export interface Preset {
  name: string; version: string; engine: string;
  sources: ({ ns: "core"; kind: "builtin"; version: string } | LibrarySource | { ns: string; kind: "path"; path: string } | GitSource)[];
  methodologies: string[];
  fitness?: Record<string, FitnessBinding>;
  scope?: { include?: string[]; exclude?: string[] }; generatedMarkers?: string[];
  enforcement?: Enforcement;
  layers?: Record<string, Layer>;
  resolve?: Record<string, { use: string; params?: Record<string, unknown>; severity?: Severity; note?: string }>;
  overrides?: Record<string, Severity | "off" | { severity?: Severity | "off"; enforcement?: Enforcement; params?: Record<string, unknown>; note?: string }>;
  settled?: { rules: string[]; note: string }[];
  ratchet?: { mode: "strict" | "no-new" };
  loop?: Partial<Loop> & { escalate?: "stop" };   // D15.5: stop only
  failMode?: "closed";                            // D15.6: closed only (accepted for compatibility)
  coexist?: { arkgate?: { ownedByArkgate: string[]; config?: string; note?: string } };
}
export interface LockRule {
  languages?: RuleLanguage[];      // absent: legacy TS rules; placement/marker guards are language-independent
  id: string;                      // FQN of the winning alias
  aliases: string[];               // every alias sharing the effective rule
  check: string;                   // "core/complexity/fn-max-lines@1.0.0"
  impl: Impl;
  params: Record<string, unknown>; // resolved; @layers expanded in paths/exclude, files/ignores moved in
  severity: Severity; phases: Phase[];
  enforcement?: Enforcement;       // older locks inherit the preset default
  integrity: boolean;              // builtin core: enforces by default; human-reviewed off is permitted
  origin: Record<string, string>;  // "params.max" → "resolve.fn.size" | "overrides.CC-FN-001" | "alias"
  text: { message: string; why: string; fix: string; avoid: string | null; source: string };
}
export interface Lock {            // lockHash = sha256 of the file bytes (the text is already canonical JSON)
  fitness?: Record<string, FitnessBinding>;
  gitSources?: (GitSource & { hash: string })[]; // immutable commit and complete data-tree hash
  lockVersion: 1; engine: string; core: string;
  coreHash: string;                // sourcesHash of the builtin catalog it was compiled from (O41)
  presetHash: string; sourcesHash: string;
  preset: { name: string; version: string; methodologies: string[] };
  enforcement: Enforcement;
  scope: { include: string[]; exclude: string[] }; generatedMarkers: string[];
  layers: Record<string, Layer>;
  sourceDirs: string[];            // path-source folders, protected on top of the fixed ones (§4.1 step 5)
  ratchet: "strict" | "no-new"; loop: Loop;
  ownedByArkgate: string[];        // listed, never evaluated
  rules: LockRule[];               // canonical order by id
  relations?: LockRelation[];      // declared interactions between active rules; absent when none
}
export interface GitSource { ns: string; kind: "git"; url: string; ref: string }
export interface LibrarySource { ns: string; kind: "library"; version: string }
export type PackCategory = "invariants" | "language" | "pattern" | "library" | "practice" | "process";

export interface FitnessBinding {
  command: string[];
  inputs: string[];
  verificationHash: string;        // reviewed fingerprint of verifier files; changes require contract approval
  timeoutMs: number;
  maxAgeMs?: number;              // reviewed time limit for external/deployment evidence
  rationale: string;
}
export interface FitnessReceipt {
  schemaVersion: 1;
  contractHash: string;
  inputHash: string;
  verifier: string;
  command: string[];
  exitCode: number | null;
  completed: boolean;
  recordedAt: string;
  diagnostics?: string;
}

// ── Analysis and state ──────────────────────────────────────────────────────────
export interface Analysis {        // one file in one state
  symbols: string[]; violations: Violation[];
  metricBodies: Record<string, string>; // symbol + line → normalized body hash, for rename matching
  symbolBodies: Record<string, string>; // symbol → body hash with the declared name outside it
  counts: Record<string, number>;  // diff rules: rule → count
  markerSites?: Record<string, { line: number; key: string }[]>;
  astHash: string | null;          // tree without comments or trivia (no-progress detection)
}
export type Form = { cause: Cause; line: number | null; detail?: string };   // analysis impossible ⇒ deny
export interface Snapshot {        // sessions/<sid>/<rootHash>/snapshot.json
  root: string;                    // absolute root path (Stop needs it)
  head: string | null;             // null = repo without commits ⇒ every file is new
  start: boolean;                  // created by SessionStart (accepts the root, A20)
  dirty: Record<string, string | null>;      // only if start: rel → blob sha256 | null (did not exist);
                                             //   if !start, {} ⇒ every "before" = HEAD (never whitewashes)
  tips?: string[];                 // branch and remote-tracking tips at creation: commits they reach predate the session
}
export interface CallEvent {       // event file content (for decide and for manual labeling)
  versions?: { engine: string; core: string };
  ruleChecks?: Record<string, string>; // exact check versions at observation; no source or private params
  dispute?: { rules: LockRule[]; checks: Record<string, Check>; context: Fixture["context"] };
  beforeSha?: string | null;       // baseline retained for disputed diff/metric fixtures
  root?: string | null; message?: string; // recorded context for human reports; older events use snapshots
  messages?: string[];             // feedback aligned with violations, including shadow observations
  warnings?: Violation[];          // informational findings, retained even when the harness drops them
  stopIncomplete?: Decision["stopIncomplete"]; // Stop released a turn with unresolved findings or evaluation failure
  stopFingerprint?: string;        // contract, tree and evaluation identity for bounded cross-turn repetition
  stopSkipped?: string[];          // roots a budget-bound Stop left unjudged; the next Stop judges them before the rest
  warningMessages?: string[];      // feedback aligned with warnings
  enforcement?: Record<string, Enforcement>; // effective policy at the time of the call
  evaluationMs?: number;           // monotonic gate evaluation through decision, before event persistence; absent in older events
  at: number;                      // ms, set by the shell; history() orders by it
  callId: string; turn: string; agentId: string | null; kind: HookEvent["kind"]; path: string | null;
  verdict: Decision["verdict"]; halted: boolean; form: Cause | null; shadowed: boolean;
  violations: Violation[];         // introduced deny/ask (counters, precision, one-attempt fix)
  afterSha: string | null;         // with deny, ask or shadowed, `after` is copied to blobs/<afterSha>
  astHash: string | null;
}
// The filter keys live in the event file name, so counting needs a readdir and no reads (A11):
//   <turnH>~<agentH>~<fileH>~<verdict>~<form:0|1>~<callIdH>.json   (H = sha256[:12]; agentH "-" = main agent;
//   in Stop fileH = "stop" and callIdH = H(sid + at))
