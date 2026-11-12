# Use PREGATE each day

## Starting work

The guided coordinator is included in 0.0.8; check `--help` for `guide`.
Use [the pregate skill](pregate-skill.md) in your coding harness: invoke `/pregate`, then ask
for setup, an update, an audit or a bounded repair. Setup/update installs the
matching companion instructions. Loading them grants no approval.
In a human terminal, start with `pregate`. It suggests
setup, an update/repair, activation or an audit from the actual project state.
In a supported harness, the human can enter `! pregate guide`. If that route has
no terminal, the agent reads `pregate guide --json`, presents the relevant choices
together and prepares `guide --preview` with the selected packs. The human
approves the displayed digest. The agent does not run the interactive approval.
Bare `pregate` with redirected input retains the hook-auto protocol; use explicit
`guide --json` for scripted inspection. See the [guided workflow](../features/guided-project-workflow.md).

Before a contract confirmation, the human guide runs `setup` if this engine or
its launcher is missing. It warns when harness hooks are absent: agent-edit
protection remains degraded. A failed setup leaves the preview unapplied;
cancelling the contract review retains completed global setup. Inspection and
preview modes do not install anything.

When inspection is permitted through explicit commands,
run `pregate status` when entering a project and `/pregate` in the harness. Status
leads with this repository's enforced deny rules, advisor or monitor-only rules,
and unverified requirements. Unverified means no passing project evidence, or
not adopted when no verifier is bound. The same summary then names which
harnesses are gated and which channels are not covered. Lock catalog totals
follow that breakdown. Consent, contract validity and whether protection is
degraded come after the counts. `doctor` prints the same breakdown for the
current repository, then checks the global installation. A disabled project
remains disabled when `init` is repeated. Grok cannot display SessionStart
contract context through the currently supported protocol; load `/pregate`
explicitly.

`status --json` exposes `fitnessCoverage` with `active`, `pass`, `fail`,
`unverified`, `complete` and `adopted`. Evidence is checked against current inputs
without running commands. An active setup does not mean every requirement has
proof; an unverified requirement is not a protected assertion.

`doctor` reports whether each detected harness has the required launcher
registration. Direct engine hook calls lack the launcher's crash and timeout
handling. A successful canary on the generated wrapper route does not clear
modified/missing registrations. Repair them with `setup` and review the result.

Use `preset show` for the effective policy and `explain --path <file>` for rules
that apply to the next change. Agent edit hooks evaluate proposed contents.
For a manual pre-check, use `check --stdin --path <file> --format agent` with the
complete proposed file on stdin. Supply UTF-8 input no larger than 16 MiB and
close stdin within five seconds; file redirection closes it automatically.
Source pre-checks are for application code. Inspect PREGATE policy with
`pregate preset show`, not `check --stdin --path .pregate/preset.json` or an arbitrary
state read. Literal reads/diffs of this root's preset/lock and inventory listing
are supported recovery exceptions. Stop and non-stdin checks validate the exact preset/lock
pair as a contract before excluding those two files from source rules. Other
files in `.pregate/` retain their protection and placement checks.

Inspection and manual pre-checks are helpers, not prerequisites for an edit.
If the user prohibits shell use or a helper is unavailable, the agent can use
supplied context and permitted edit tools while the hooks evaluate the change.
Keep hooks active, report missing information honestly and obey actual denials
and human approval requirements. A missing helper alone does not block an edit.

All 68 core rules enforce by default. Use `fitness plan` to group requirements,
then adopt meaningful assertions with comma-separated rule IDs when each is
actually covered by the same test. Run `fitness run --all` after changes. Unbound
requirements remain active and unverified without blocking work. Adopted
assertions block check and Stop until their current evidence passes.
`fitness status --json` identifies missing, failed and stale evidence. Follow
[project fitness](../features/project-fitness.md); a green unrelated test is not proof.

## Introducing rules into existing code

In the guide, select all useful recommended packs and any tested local packs in
one pass. The initial candidate includes detected source roots and keeps explicit
exclusions. Choose observation or no-new enforcement for optional rules, then
review the complete candidate once. In a new repo, review documentation, stack
and code and propose a custom project pack immediately. Explicit documented
requirements can enter the same initial review via `--custom-from-docs`, with
source path/line/hash and no invented verifier. `guide --preview --packs none` adds no packs;
it retains recipe policies. Adoption/update approval preserves disabled consent;
activation is an explicit separate choice.

The guide review names the layers it derived from folder names and what they
find today: the production imports that already break each layer, and the
folders no layer covers. Those folders are unrestricted until a map places
them. An agent can propose that map with `layers apply <map.json> --preview`.

Rules you already wrote as prose can enter the same way. `compile <file>` sorts
an instruction file such as `AGENTS.md` into rules, statements that need an
example, and guidance. For paragraphs and tables the agent completes
`compile <file> --template` and stages it with `compile apply <proposals.json>
--preview`. Only rules that pass their generated cases are staged, and the
instruction file is never edited. See [the feature guide](../features/agent-proposed-contract.md).

At most once a day, SessionStart names advisor rules that reported nothing for
seven days over at least 20 checked edits. Review them with `promote --preview`.
`pregate report` has an `Agent loop` line: how often an edit was stopped and
repaired on the next attempt, and how many advisor findings were gone on the
same file's next edit.

With the explicit workflow, begin with `scan` to inspect applicable pack
recommendations and custom-rule suggestions. Save `scan --plan` to `plan.json`,
keep your chosen recommendations, and run `pack apply plan.json --preview`.
Five selected packs can enter through one digest approval. A custom suggestion
needs meaningful pass/fail/bypass fixtures before it enters the batch.
See [guided adoption](../features/guided-pack-adoption.md). Then audit and choose
small repairs or explicit no-new protection for existing debt.

`scan --json` also reports source-scope gaps and can
propose detected roots plus selected packs in the same plan. Review exclusions
and the inventory before approval; a root-layout app must not be described as
covered merely because `lib/**` is in scope. Existing contracts are not widened
automatically. See [scope behavior](../features/onboarding-scope.md).

1. Inspect a pack and its documented scope/limits; select only useful rules.
2. Review `init --preview` or `pack enable ... --preview`; approve the exact digest
   through the supported human route. Preview does not change the active contract.
3. Run `audit --json` to inventory existing static debt and coverage gaps. Exit 1
   means findings; exit 2 means incomplete/invalid evaluation. Findings include
   ordinary shadow and warning policies.
4. Inspect representative findings and label actual observations with
   `feedback list`, `feedback draft <finding-id> --as correct|false-positive|uncertain`
   and human approval of `feedback apply <digest>`.
5. Deliberately enforce calibrated rules through a reviewed contract change.
   A no-new ratchet freezes growth; it does not certify or remove existing debt.

Choose small repairs that preserve behavior. Run the project's relevant tests and
rerun audit to compare locations/counts. Add integration tests at boundaries and
E2E tests for critical journeys; unit tests are useful for isolated decisions.
The command `audit --plan --json` ranks repairs by live policy and observed
matches, labels rule families and suggests test levels. It preserves missing
ownership, test commands and coverage instead of inventing them. Review its
priorities against your business risks; it does not certify maintainability.
Use `audit --incremental --plan --json` while repeating audits during refactoring.
It rehashes retained inputs and reports reused/evaluated files. Rerun the same
command after interruption to resume valid checkpoints. Use `audit --fresh` for
a cold comparison; incomplete coverage and fresh fitness evidence still apply.

The default `audit` is compact: totals and coverage gaps first,
then a limited number of examples. Use `audit --full` to see every text location;
JSON/JSONL retain all evidence. `--plan` still requests the complete plan.

## When an edit is denied

The [project-update workflow](../features/project-update.md)
provides `preset diagnose --json`, `preset schema` and
`update --project --preview`. It reviews engine/core/pack pins together and keeps
active files unchanged until approval. The current guide uses the same
repair mechanism; it displays the cause and supported next action.

For `lock-stale`, distinguish an invalid preset from a missing or outdated lock.
The unreleased source diagnostics distinguish missing inputs, malformed JSON or
fields, changed preset/source/lock contents, and incompatible formats or pins.
They name installed, preset and lock engine/core versions. Start with
`pregate preset diagnose --json` and `pregate preset schema`; the human restores or
corrects the input, reviews `pregate update --project --preview` and approves only
its displayed digest-bound command. Preparation does not change consent or
activate a contract. See [v0.0.1 release notes](../releases/0.0.1.md) for release state.
An override such as `"testing/TDD-FOCUS-001": "enforce"` is invalid: the string
form accepts severity (`deny`, `ask`, `warn`, `off`), while enforcement uses an
object, for example `{"severity":"deny","enforcement":"enforce"}`. Preserve
existing parameters, notes and severity when proposing that correction. The
human reviews the contract change; `preset compile` then validates the preset
and sources before writing its lock. Compilation errors leave the lock unchanged.
Do not disable protection, delete the lock or reset session state to bypass this
condition. A global update does not automatically migrate a pinned project.

If compilation reports engine/core/bundled-pack mismatches, compilation alone
cannot migrate them. The unified preview handles them together on the installed
engine. An older hook can reject new helpers; do not repeat them or have the
agent approve itself. Use the supported human update route to install the current release.

Read the rule ID, path, line, explanation and repair hint. Use `explain <rule>` and
pre-check the correction. Preserve the requested behavior; renaming, suppression,
weaker tests and hidden writes do not repair a violation. If the contract conflicts
with the task, prepare a concrete reviewed change and involve the human.

For a legitimate project use case that a rule does not model, propose a bounded
change to applicability or parameters, a corrected rule, or a project-specific
pack. Include the valid example that must pass and an invalid counterexample
that must still fail. Test draft fixtures outside active rule sources with
`rules test`, then inspect the exact editable document with `preset show --json`
and the request format with `preset request-schema`, and
prepare `.pregate/requests/<name>.json` or a supported preview. Schema inspection
does not require a preset, create consent, or apply a policy change.
The human reviews the invariant, affected paths and evidence inside the harness.
Do not suggest switching PREGATE or its hooks off simply because an edit is blocked.
Do not retry a halted edit or approve a proposal as the agent. Explicit human
disable remains available when the user deliberately chooses it.

Denial/Stop feedback, retry-limit notices, `preset show`, SessionStart context and
`explain` include this recovery guidance. Grok receives only the compact reason;
when the absolute launcher path is long, the reason uses the shorter
`pregate explain <rule>` command so the agent can obtain the complete guidance.
Protocol tests verify the emitted text, not whether every model follows it.

`report --days 7` shows recent observations and incomplete Stops. Historical
reports are not the current verdict: run `check --all` to evaluate current code.

If Stop blocks while `check --ratchet --base ...` is clean, inspect
`report --json` and its `sessionBaselines`. Stop compares against its retained
session snapshot, including saved dirty files at SessionStart. CLI check compares
against HEAD, the index or a Git merge-base; `check --all` and audit examine the
current tree. Commits do not reset the session snapshot, so committing a new
violation does not make it pre-existing debt for that session.

After reviewing a committed merge in a clean Git worktree, prepare
`pregate session rebase <harness:session-id> --preview`. Review its diff (or, above
8 MiB, its per-file summary and the `git diff` it names) and let the human apply the exact displayed digest. It adopts the committed tree as
existing debt, preserving original snapshots and events; it does not prove
authorship or repair findings. Dirty/standalone trees and changed or expired
reviews reject. Do not delete state to achieve the same effect.

Unchanged blocking findings remain capped across new turns, then emit a compact
incomplete notice. They stay recorded, and Pre protection remains active. A
changed tree, contract, baseline or result restarts blocking. A completed turn is
not evidence of compliance. See [Stop guarantees](../features/harness-and-shell-guarantees.md).

For each session with observations in the report window, `sessionBaselines`
contains `status`, retained `head`, `currentHead`, `startedWithSession`,
`dirtyFiles`, `createdAt` (Unix milliseconds) and `reason`. A legacy snapshot
without a recorded time has `createdAt: null`; missing/invalid metadata is not
reconstructed. The report does not include snapshot file contents or mutate the
baseline/history. Inspect the actual finding and preserve behavior; propose a
bounded reviewed policy adaptation for a valid use case. Do not delete state or
exclude the test tree to hide violations. Legacy events without a root still
require readable snapshots for root inference.

Reports also show recorded decision timing. `report --json` includes `timing`
with `measured`, `unmeasured`, `p50Ms`, `p95Ms` and `maxMs`. Legacy events and
invalid measurements remain unmeasured; unavailable percentiles are null.
`evaluationMs` uses a monotonic clock from the active Pre/Stop boundary through
its decision, before event persistence. It includes any approval wait. Multiple
file records from one Pre call share the boundary start and measure the elapsed
prefix at each decision; samples are records, not unique tool calls. This excludes
process startup, later event persistence and the actual proposed tool execution.
Use the compiled benchmark to verify the full hook latency budget. A Claude
`/doctor` Stop duration is a harness observation with a different boundary;
compare runtime, project window and registration before interpreting it as
engine evaluation time. Keep Stop synchronous: [async hooks cannot enforce a
blocking decision](https://code.claude.com/docs/en/hooks#run-hooks-in-the-background).
The historical native scan's zero outer timeouts does not establish zero engine
timeouts: its 45,096 ms maximum attachment reports the engine's 45-second Stop
watchdog. Stop has a 45-second deadline; the five-second deadline is for Pre.
The observed historical direct-engine command does not record its binary version.
Unreleased supervisor diagnostics separate an unfinished rule from shared
dependency resolution when progress is valid. The existing hook deadline still
applies. Passing byte controls do not certify performance.
See [v0.0.1 release notes](../releases/0.0.1.md) and the [changelog](../../CHANGELOG.md).

The source dependency checkpoint reuses authenticated resolver reads only after
rehashing the importer and every recorded input, including missing candidates,
and checking path identity, effective contract and phase. Creating a previously
missing module, changing an alias/barrel/schema input or retargeting a path can
invalidate it. A missing, invalid or unavailable checkpoint falls back to fresh
resolution. It caches no verdicts: affected unchanged importers are evaluated
again. The local state owner who controls both the checkpoint and its separate
authentication key remains trusted. A benchmark on an earlier runtime does not
guarantee latency for every load or contract approval.
The Stop loop is bounded; finishing a turn does not prove compliance.

For Claude skill cost, use the live `/context` Skills row after the listing
budget, rather than the supplied 21k raw estimate. Review router file reads
before interpreting zero direct invocations as unused skills. Consult the
doctor investigation
before changing visibility or plugins.

## Review a contract change inside the harness

The agent can prepare a literal supported preview command. The human reviews
`approve --preview` and runs `pregate approve <code>` in a separate terminal.
A harness `!` line has no terminal, so it cannot approve. The agent must not
execute the approval command itself. Proposals expire after 24 hours and
reject stale contracts or source data. See [the capability boundaries](../features/approval-in-harness.md).

If a request preview expires, renew it with
`pregate preset apply /absolute/path/to/request.json --preview`, then inspect
`pregate approve --preview` again. Review the current diff and use the digest and
exact human approval command displayed by this fresh review, rather than a saved
expired command. The agent may prepare the preview; only the human enters the
approval command in that separate terminal. Renewing the preview does
not apply the request or change consent. The new proposal retains the same
24-hour lifetime.

To change policy through a request, author `.pregate/requests/<name>.json` with a
reason and JSON patch, then let the human approve `preset apply <file>`.
`enforce`/`shadow` can vary per ordinary rule; `warn`/`off` are severity decisions.
Core rules enforce independently of shadow; a human can explicitly disable them
with reviewed `off` overrides. Disable does not establish compliance.
If an applicable static rule is explicitly enforcing, invalid syntax blocks that
file even when other optional rules stay in shadow. PREGATE cannot evaluate that
rule until parsing succeeds. Scope, language, phase and rule exclusions still
apply; an unrelated enforcing rule does not turn all files into a syntax gate.

## Capture a tool issue

`dispute --last` prepares a local candidate fixture retaining the observed source
and baseline. It does not change active rules. `issue draft --last --note "Expected behavior"`
prepares an offline report to PREGATE's GitHub repository. Inspect `issue show <digest>`.
Ordinary drafts omit source by default; `--include-code` or a public `--repro`
requires explicit review. Only human-approved `issue submit <digest> --yes`
publishes. Auth/network failures preserve drafts; interrupted publication retains
an uncertain marker instead of automatically creating another issue.

See [feedback](../features/human-feedback.md), [reporting](../features/issue-reporting.md),
[the full command reference](../CLI.md) and [pack composition](../features/pack-composition.md).
