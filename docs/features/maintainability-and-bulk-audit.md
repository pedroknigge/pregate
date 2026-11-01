# Maintainability progression and large-scale compliance audits

The advisory `audit --plan` workflow, introduced in 0.2.6, provides
deterministic classification from selected-rule metadata and bounded source reads.
It groups repairs by file/rule, preserves snapshot hashes and separates evaluation
errors, failed assertions and unverified requirements. It does not infer business
ownership, execute tests, upload code or rewrite the project. Opt-in persistent
incremental auditing, checkpoint resume and per-file JSONL streaming are now
implemented; parallel workers and model classification remain pending work below.
The ratchet prevents selected debt from growing; it does not certify maintainability.

## Current commands

Run `pregate audit --plan` for ranked repairs beside the complete audit. Add
`--json` for the structured `refactorPlan`, including classification basis,
locations, observed counts, suggested test levels, missing evidence and commands.
The audit's existing exit codes remain: incomplete coverage still returns 2.
For repeated audits use `audit --incremental --plan --json`; use `audit --fresh`
to force cold analysis and refresh the disposable cache. All dependency inputs
are rehashed, and fitness is evaluated on each invocation. The
[incremental audit contract](whole-project-audit.md#incremental-audits-and-checkpoint-resume)
describes invalidation, resume, budgets and counters.
Priority uses actual deny/ask/shadow/warning policy and match counts. It does not
invent Git change-frequency, criticality, coverage or a maintainability score.
Classification reads the selected check's area and identifier, excluding the
pack namespace. An effect check in a factory area still calls for boundary and
failure-case verification; this metadata label does not prove runtime ownership.

Scope summaries now separate parser-supported files, unsupported source-like
bodies and advisory production/test/example/fixture/vendor roles. Those labels
describe the inventory, not test coverage or an architectural judgment. Selected
static rules honor `paths`, `exclude`, check file patterns and the intersecting
`within` scope; optional framework recommendations follow package owners instead
of applying a sibling's framework to every workspace. An explicit authored scope
continues to win. See [onboarding scope](onboarding-scope.md).

Use `pregate fitness plan --json` to review groups of missing semantic evidence and
candidate verifier files, then bind only the requirements the actual assertion
proves. Several requirements can share one reviewed binding. This plan does not
run the candidate tests or infer verification from their file names.

The reader caps one source at 32 MiB and its per-invocation text cache at 32 MiB
of UTF-8 content. It keeps fingerprints for all read inputs and frees each primary
syntax tree. `audit-input-limit` reports an oversized source without discarding
other findings; read-time growth/shrink is an evaluation failure. Inventory,
findings, parser state and JavaScript string storage add memory beyond that cache
budget, so this is not a 32 MiB total-process memory promise. JSON output is
buffered by default; `audit --jsonl` streams findings and ends with aggregate
coverage/fitness metadata. It supports incremental reuse but not ranked `--plan`.
Read its [completion protocol](whole-project-audit.md#streaming-results) before
consuming partial output. The original acceptance targets below remain separate from
these implemented controls.

## Product outcome

A user should be able to enter a new or existing project, understand what PREGATE
can check, freeze current debt, and reduce it through small changes with explicit
verification. Freezing spaghetti code is the starting point for improving it.
“100% maintainable” expresses the desired direction, not an attainable universal
certificate or an invented aggregate score.

For greenfield projects, propose rules matching the detected stack and selected
architecture, preview coverage and activate the agreed contract. For brownfield
projects, audit the complete selected tree, identify unsupported files, record
existing violations and establish the approved baseline before recommending
changes. Ratchet checks and full-tree audits must remain visibly distinct.

The [guided project workflow](guided-project-workflow.md) exposes setup, recovery,
update and configuration, followed by an audit choice. Freeze records the chosen
Git baseline for no-new checks; it does not remove findings or repair code. Repair
adds the ranked audit plan and leaves edits to the normal gate. The
0.2.9 held-out observations are recorded
before these applicability fixes, with explicit unsupported/UNVERIFIED limits.
They establish concrete friction and false-positive cases, not a causal claim
that a greenfield project will remain maintainable with or without PREGATE.

## Refactoring loop

1. Inventory executable rule violations, dependency relationships, existing
   tests and available change history. Explain missing facts rather than
   inventing architectural intent or test coverage.
2. Rank candidates using visible evidence: severity, debt growth, affected
   dependencies, change frequency when Git history exists, and verification
   gaps. Allow the user to choose a different business priority. Git-free
   projects must work with the available facts.
3. Offer a small refactoring plan: affected behavior, proposed boundary or
   responsibility, relevant rules, suggested tests, expected debt reduction
   and how to validate it. Avoid a whole-project rewrite as the default.
4. Let an agent propose the diff through the existing gate. Require the
   applicable tests and checks; reducing a metric by deleting functionality,
   suppressing a rule or dropping a test is not successful refactoring.
5. Show before/after violations and actual verification results. Ratchet down
   the approved baseline after a verified improvement, preserving provenance
   and a reviewable contract change for any policy adjustment.

Suggested quality dimensions include clear module boundaries, controlled
dependencies, cohesive responsibilities, understandable control flow and tests
of externally observable behavior. Only supported executable rules may be
reported as enforced; other recommendations remain labeled suggestions.

## QA and test priorities

Choose tests by the risk they cover, not a fixed E2E-versus-unit quota. Begin
brownfield refactoring with characterization of behavior that must survive.
Use E2E tests for critical user journeys and cross-system failures; integration
tests for contracts between modules and external services; unit tests for
isolated algorithms, domain decisions and boundary cases. Consider existing
coverage, failure history, runtime, flakiness and maintenance cost.

Every recommendation should name the behavior, explain the missing evidence,
give a proposed test level and validation command, and identify any required
fixture or environment. Test-file existence must not be called coverage. An
unexecuted suggestion must not be called a passing test. QA packs should adopt
checks only when the required facts and ownership of existing tools are defined.

## Large ingests and classification

Provide a separate read-only audit over a declared snapshot, preserving normal
interactive-hook latency. Record the source/snapshot and rule versions, file
inventory, unsupported languages, exclusions, failures and completion state.
Bound memory and worker concurrency, stream results and support safe resume.
Cache by file content plus parser/rule configuration; invalidate dependent
analysis when imports, configuration or shared facts change. Reuse unchanged
facts while always re-evaluating affected dependencies.

Use a staged pipeline: inventory and language detection, parsing and shared
facts, deterministic rule evaluation, then candidate classification/triage.
Possible labels include rule family, layer, debt type, likely remediation and
uncertainty. Classification must distinguish confirmed rule violations from
inferred maintainability concerns and from a human-accepted conclusion.

Evaluate heuristics before adding models. Optional model-assisted classification
must identify the model/version, evidence and uncertainty; record disagreements
without silently overriding enforced checks. Default to local analysis. Remote
code processing requires explicit consent explaining destination and included
content. Audit results can use the reviewed GitHub-reporting flow; bulk findings
must not create an automatic flood of issues.

## Acceptance evidence

- Run greenfield and brownfield pilots, including a project without Git, and
  demonstrate debt cannot grow while a behavior-preserving refactor lowers it.
- Produce a ranked plan with traceable evidence, tests chosen for concrete risks,
  and actual test results; disclose unverified behavior and unsupported rules.
- Benchmark representative large, mixed-language trees with file/LOC counts,
  cold/warm timing, memory, incomplete inputs and dependency changes. Agree
  explicit budgets from those workloads before claiming rapid compliance audits.
- Compare full and incremental results for equivalence; test resume, stale-cache
  invalidation, cancellation and deterministic ordering.
- Evaluate classification with a labeled, versioned corpus, held-out projects,
  per-class precision/recall, false positives and uncertainty. A global accuracy
  number alone does not justify enforcement or a general quality claim.
- Measure whether subsequent changes are easier and safer: correction effort,
  regressions, false positives and time to complete real tasks, alongside debt.

Advance these capabilities in that order: trustworthy inventory and baseline,
guided verification and refactoring, scalable deterministic auditing, and only
then classification techniques that show an improvement over simpler methods.
