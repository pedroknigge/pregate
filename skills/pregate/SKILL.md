---
name: pregate
description: "0.0.7 — PREGATE: guide project setup and recovery, pre-check edits, audit debt, compose packs and prepare reviewed approvals"
---

# PREGATE

The human invokes `/pregate` in the coding harness, then states the desired outcome:
setup, update, audit, repair or pack authoring. This guide is installed by setup
and refreshed by update. Loading it changes no consent or contract; hooks enforce
the policy. Give one useful next action and present related choices together.

`pregate demo [--language python|go|rust|all]
[--json]` lets a human try the behavior first. It uses a compiled
binary and Git to create, approve, check and delete only owned toy projects and
settings. It accepts no consumer path. Use human `! pregate demo` where available;
do not treat sample automation as approval for this project. Native tools run
only if installed, absent tools remain not verified, and the 64 core fitness
requirements stay unverified. It demonstrates no-new, a denied new dependency
before writing, and accepted repairs; it does not test a live model or human UI.

Skill version: 0.0.7. Run `pregate --version` and compare the engine with
this skill and the lock's engine. Warn the human about mismatches. `doctor`
diagnoses missing/stale registrations and companion instructions. Do not repair
global settings without explicit authorization.

## Start here: the simple path

Most people who invoke `/pregate` want one thing: the agent stops breaking the
rules of their project. They do not need the vocabulary of this page. Do the
work below yourself, answer in the user's language, and show a short summary
with one action. The rest of this guide is reference for the cases this path
does not cover.

How to speak. Say "rule", "warns", "blocks" and "kept as it is". Do not say
digest, lock, ratchet, shadow, fitness, methodology or pack unless the user asks
how it works. Do not list rule counts per pack. Name real files and real
imports from this project instead of concepts. Keep a summary under eight lines.

1. Look first, without changing anything: `pregate guide --json`,
   `pregate layers --json`, and `pregate compile <file>` for each instruction
   file that exists (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`).
2. The project has no contract: prepare `pregate guide --preview`. Tell the user what will be watched in their own terms, for example
   "code in `src/domain` may not import `src/infra`; 3 files already do and
   are kept as they are; a new one gets a warning with the repair". Say that
   nothing blocks yet.
3. The project has a contract. Prepare one review at a time, because a newer
   review replaces the pending one:
   - Folders that no layer covers: read which folders they import in
     `layers --json`, write a layer map to a temporary file outside the
     repository, and run `pregate layers apply <file> --preview`. Give a
     one-sentence reason a reviewer can check against the code. Explain each
     existing import the map would flag. When the user wants no folder left
     outside the rules, add `--complete` and give the map a catch-all layer
     (for example `src/**`) for the code no other layer names.
   - Instruction files. Real ones are paragraphs, so reading them is your
     part and proving each rule is the engine's. Run `pregate compile <file>
     --template`, save the JSON to a temporary file outside the repository, and
     follow its `steps`: keep only the statements a check on one source file can
     decide (a forbidden import, call, syntax or name), and give each a short
     sentence, code from this project that must fail, the correct code, and one
     similar snippet that is allowed. Read the instruction file itself as well:
     rules also sit in tables and long paragraphs. Then run `pregate compile
     apply <proposals.json> --preview`. A refused proposal names its reason;
     correct it and run again, and add a `pattern` when the engine says it could
     only match the example's own text. Tell the user which statements became
     rules and which stay as guidance. Do not force guidance or agent actions
     (run the tests, use pnpm) into a rule.
   - After the human approves, offer to delete the compiled lines from the
     instruction file, and delete them only when the user agrees. The rules
     carry their own reason and repair, so the text no longer has to load in
     every session.
4. Approval is the only step the user performs. Give exactly two lines to type:
   `! pregate approve --preview` to read the change and see its code, then
   `! pregate approve <code>`. Never run either command yourself. In Cursor the
   user types them in a separate terminal.
5. A session starts with a `Promotion ready` line: tell the user once, in one
   sentence, that those rules warned about nothing for a week and can start to
   block. If the user agrees, run `pregate promote --preview` and give the two
   approval lines.
6. The user asks whether it works: read the `Agent loop` line of
   `pregate report` and repeat it in one sentence.

Statements that `compile` leaves in the file are guidance or agent actions. Say
so plainly; do not invent a rule for them.

## Read the active contract

When inspection is permitted and `--help` lists `guide`, first use `guide --json`.
It reports actual setup/update/repair/activation state, scope, policy counts and
recommended actions. Proactively present useful choices together; do not ask
separately for permission to inspect or prepare each pack. Otherwise use `status`
(enforced deny rules, advisor or monitor-only rules, unverified requirements
with no passing project evidence, or not adopted when no verifier is bound,
and harnesses gated versus channels not covered, with catalog totals after
that breakdown; `status --verbose` for the full report), then `preset show` and `explain <rule>`
or `explain --path <file>`. These commands and manual pre-checks are helpers, not
prerequisites for an edit. If the user prohibits shell use or a helper is
unavailable, use supplied context and permitted edit tools with hooks active.
Let the hook evaluate the edit. Report missing information honestly; do not
invent a passing check. An actual denial or required human approval still applies.

Global setup is inert until the human consents in a worktree. That consent covers
the repository: its other worktrees, including an agent's isolated worktree, are
protected without another approval unless a human disabled that worktree. A clone
or a committed preset does not grant consent. Repeating init
preserves disabled consent. Describe the actual effective policy in plain English.

The preset's enforcement defaults rules to enforce, advisor or shadow; individual
overrides can change it. Advisor mode (`"enforcement": "advisor"`) never blocks
edits or Stop (even for `core/*` rules when top-level or per-rule enforcement is
`advisor`), but surfaces non-blocking `PREGATE ADVISOR` guidance to the agent via
the harness warning channel so the agent decides how to proceed. Use
`pregate promote [--rule <id,id>] --preview` to promote `advisor` rules to
`enforce`. Clean rules are `enforceCandidates` (0 violations in audited scope,
core rules first). With ratchet `no-new`, rules that already have findings are
`ratchetCandidates`: the preview names each rule and its finding count, existing
findings stay grandfathered, and new findings are denied. A strict ratchet does
not grandfather, so those rules stay out. A rule that matches no audited file is
never proposed; `auditedRules` gives each rule's `files` count. Shadow records deny/ask findings silently without blocking.
Warn gives feedback; off removes a rule through a reviewed override. All 68 core
rules activate automatically and enforce by default unless `enforcement` is set
to `advisor` or a human explicitly overrides individual core rules. Optional packs remain selected.
Do not claim blocking when the selected policy only advises or observes.
An applicable static rule in enforce also blocks invalid syntax in its own
language, scope and phase, even if the optional-rule default is shadow. An
unrelated enforcing rule does not make all files a syntax gate.
An admitted lock must equal the complete canonical compilation of the current
preset and sources after CRLF normalization. Valid LF/CRLF checkouts remain
admitted; other formatting changes require regeneration. Matching metadata does
not establish integrity. Treat an
altered or malformed lock as stale; propose the required contract change or
regenerate it with `preset compile`. Do not edit lock bytes to weaken policy.
Valid admission does not supply consent or passing project verification.
Inspect policy with `preset show`; do not source-pre-check `.pregate/preset.json`.
Literal reads/diffs of the current root's preset/lock and inventory listing are
supported recovery exceptions; arbitrary state reads remain protected.
Stop and non-stdin checks validate the
exact preset/lock pair before excluding those two files from source rules.
Other `.pregate/` files retain protection and placement checks; do not move
application code there or edit lock bytes.

## Start and compose a project

The guided coordinator is included in 0.0.7.
Check installed help before relying on a flag. The human
can run `pregate` in an interactive terminal or `! pregate guide` where the harness
provides one. Bare no-argument input redirected by a hook retains hook-auto;
use explicit `guide --json` for agent/script inspection. There is no `guide --yes`.
Never run the interactive approval flow as an agent.

Before contract confirmation, the human guide runs setup if this engine or its
launcher is missing. It reports a setup failure without applying the preview,
and warns that agent-edit protection remains degraded without registered harness
hooks. Completed global setup is retained if the human cancels the contract
review. JSON inspection and preview mode do not install anything.

Without a terminal, present the `guide --json` recommendations in one selection,
including optional packs, tested local packs and the mode: advisor (default),
enforce or observe-only.

When this repo has no `.pregate`, immediately propose reviewing its stack and
source layout and selecting packs. `guide --json` and `scan --json` also expose
bounded documentation requirements with file/line/hash provenance and a
custom-pack suggestion. Offer drafting a custom project pack from them as an
optional extra, not part of the default selection: it adds many reviewed files.
Explicit requirement lines enter the same initial review only through
`guide --preview --custom-from-docs`; the generated data-only pack stays shadow
and unverified until meaningful project assertions are reviewed. Read and reject
irrelevant statements. No statements means no invented rules: propose a custom
domain/boundary pack and author it from observed evidence and real fixtures.
Prepare `guide --preview --packs <ns,ns|none> [--enforcement advisor|enforce|shadow]` with
repeatable `--custom-pack <path>` as needed. `--preset <name>` selects only an
initial recipe. Selection flags require preview and cannot combine with JSON or
multi-project mode. `--packs none` adds nothing; existing recipe policies remain.
Detected source roots and preserved exclusions enter the same review. The guide's
compact summary is the default; `guide --preview --full` and `approve --preview --full`
show complete content. Inspect
coverage and ask for a bounded preset request if a different scope is needed.
Unknown packs, missing fixtures and conflicts need correction, not disabling.
After presenting the complete review, leave its exact digest approval to the human.

On older engines, with no preset, prepare `init --preview`. It detects stack/layout, recommends a
recipe and shows project examples. Preview does not activate a contract or consent.
`guide` starts new projects in advisor mode: the agent sees findings and nothing
blocks. Protected paths and hook switches still deny. Pass `--enforcement shadow`
to observe silently or `enforce` to block. Existing projects keep their recorded
mode unless `--enforcement` is passed. Legacy `init --preview` still starts
ordinary rules in shadow; explicit `--preset <name>` selects a
recipe. Python/Go/Rust/mixed starters select language policies; architecture needs
deliberate layers. Do not replace unrelated project settings.

Discover `pack list --library` and inspect `pack show --library <ns|methodology>`.
Prepare `pack add --library <ns> --preview`, `pack add --path <dir> --preview` or
`pack add <url>@<ref> --preview`. Adding a source also selects its complete methodologies
that compile, in the same review, and names the skipped ones; `--source-only` only registers it.
Prepare `pack enable <ns/methodology> --only <id,id> --preview` for selective adoption; it
adds a missing bundled source in the same review.
Without --only, existing overrides remain. Check conflicts and effective policy.
Updates, disable and removal need review. Git pins never move automatically;
removal preserves authored local files and cached Git objects.

After guided configuration, adoption or activation, audit and offer no-new debt
protection, bounded repairs with their verification, or review later. Strict to
no-new needs a reviewed policy change; the guide does not rewrite an existing
no-new policy or automatically edit application code. On older engines or when
using explicit commands, after initialization offer `scan` and then an audit.
`scan --json` exposes
advisory stack facts, reasons and untested custom-pack candidates. Save
`scan --plan` to an editable plan, retain the chosen library/path/Git sources
and methodologies, and prepare `pack apply <plan.json> --preview` for one combined
approval. Do not require five approvals for five packs. Test custom fixtures
before adding them. Empty recommendations do not mean an empty plan can activate.
After approval, audit and offer behavior-preserving repairs or a reviewed no-new
ratchet. Freezing growth does not prove compliance or repair the existing debt.

For a cloned team contract, restore exact committed Git pins with `pack restore`.
It verifies namespace/hash/fixtures and changes no preset, lock or consent.
Use existing Git access for private packs; do not substitute pack update, which
chooses upstream HEAD. Share preset, lock and relative local pack files in the
project's repository; personal consent and credentials stay local.

## Prepare approval inside the harness

Propose contract edits through a supported edit tool or literal preview command.
PREGATE validates fixtures and the candidate before permission. Every harness
uses a validated queued proposal, and every harness denies an approval command
the agent issues: no native permission prompt approves on the human's behalf.
Hand the exact reviewed `!` command to the human in Claude Code, Codex, Grok and
agy; never execute it as an agent. See the documented approval limits.

Review `approve --preview`: the mode, one line per pack, every loosening, removal
and field change, the whole preset diff and every written file. A WARNING appears
only when protection may weaken; new contracts, added rules and stronger modes do
not warn. `approve --preview --full` adds every per-rule change and complete file
contents. Then ask the human to enter the exact displayed
`pregate approve <code>` in a terminal and type `y`. A harness `!` line qualifies
only when that harness gives the command an interactive stdin. The code is the
first 12 hex digits of the digest. `approve --yes --digest <sha256>` still asks
for `y` on the terminal unless `PREGATE_UNATTENDED_APPROVAL=1` is already set
(an unattended CI job; `CI` alone does not count).
Approval commits exactly the contract files it wrote, plus the rule pack folders the
lock compiles from, and removes applied or stale requests, so do not stage or commit
the preset, lock or packs yourself afterwards.
Controlled human `!` routes are verified in Claude Code, Codex, Grok and agy.
Cursor Shell Mode invokes gated Pre without a trusted human-origin marker;
its approval fallback requires a separate human terminal. Show the reviewed
command and this limitation; never disable PREGATE or route around the guard.
Direct human terminal approval remains available. Stale/replaced/expired
proposals cannot apply. Never execute approval or activation as agent self-approval.
Never loosen the contract by editing the preset and recompiling: Stop, pre-commit
and CI block a looser lock (`contract-loosened`) that no human approved.
Guided proposals bind their consent effect in the digest: initial
setup or explicit activation enables protection; existing adoption and updates
preserve consent. Show this effect. An update must not turn a disabled project on.
For a current cloned/disabled contract, plain `guide --preview` is a no-op,
not an activation proposal. Present `status`, then let the human choose activation
in the interactive guide or run `pregate enable` in a terminal and type `y`.
`--yes` does not replace that confirmation unless `PREGATE_UNATTENDED_APPROVAL=1`
is already set. Never run
that as an agent.
Agent text, stdin, --yes, request files and claimed approval are not permission.
Use status/doctor and the installed capability contract to establish available routes.

Draft incomplete pack fixtures outside active rule sources. Requests can use
`.pregate/requests/<name>.json`; human-approved `preset apply <file>` applies one.
`preset apply --help` and `check --help` (also `-h`) show the command reference
without reading a request or changing policy. Use `preset request-schema` to
inspect the official request format without reading protected installation files.
Use `preset apply <file> --preview` to validate a request and prepare its complete
diff and digest-bound review. Preview writes only a pending candidate, without
changing the active preset, lock or local consent. The agent may prepare it;
only the human executes the displayed approval command. Invalid requests leave
any existing pending candidate intact.
When preview succeeds, show its complete review to the user and wait for human
approval. Keep the proposed files. The active contract still governs checks;
do not compile the preset or retry a denied edit to test an unapproved candidate.
Codex 0.166 reports the command working directory. A relative request path
resolves there; name a file outside that directory with an absolute path.
`preset compile` validates source fixtures and refreshes the lock; it does not grant consent.

## Check changes and preserve behavior

Pre-check complete proposed contents:

```sh
pregate check --stdin --path src/example.ts --format agent < proposed-file.ts
```

Supply UTF-8 input no larger than 16 MiB and close stdin within five seconds.
The input deadline starts inside the engine; a wrapper that buffers input before
starting the engine needs its own bound.

Default check compares HEAD in Git and evaluates the whole tree without Git.
--all checks current selected code; --staged compares the index with HEAD;
--ratchet --base <sha> compares a Git base. These modes are separate from stdin.
When denied, cite the rule, path and line, explain why, preserve the requested
behavior and change the approach. For `fn.lines` and `control.nesting` violations,
the denial also includes an AST-derived `Suggested split` or `Suggested refactor`
line range/condition hint to guide extraction or guard-clause inversion. Do not suppress rules, weaken tests, delete
functionality or hide writes. A real task/contract conflict needs a reviewed human decision.
Do not relocate user/data/harness homes or override hooks to evade protection.

A block is not a reason to suggest disabling PREGATE, a pack or its hooks. First
inspect the rule and distinguish a real violation from a legitimate project use
case the rule does not model. Repair a real violation. For the latter, preserve
the invariant and prepare a bounded applicability/parameter change, corrected
rule or project-specific pack. Include a valid project example and an invalid
counterexample that must still be denied. Keep draft fixtures outside active rule
sources and run `rules test` there. Inspect the editable document with
`preset show --json` and the format with `preset request-schema`, then prepare
.pregate/requests/<name>.json and validate it with `preset apply <file> --preview`
for human review inside the harness. Show the rule ID, affected
paths, proposed change and verification evidence. Do not approve it yourself or
retry a halted edit. An explicit user decision to disable remains supported;
never present it as the default escape from a blocked task.

Use `fitness plan [--json]` to group the 64 CORE-INV obligations and inspect
candidate test files. File names are hints, not semantic evidence. Start a draft
with `fitness plan --template [--auto] > pregate.fitness.json` (`--auto` pre-populates
inferred test-slice commands, input globs and assertion counts from repository test
files). Fill in or verify actual verifier argv,
definition/helper/config input globs, per-rule conditions, negative controls,
domain/data/performance assumptions and limits. The template cannot be executed
or bound until authored. Inspect `fitness plan --candidates pregate.fitness.json
--json`, then prepare different assertion commands in one review with `fitness
bind --candidates pregate.fitness.json --preview`; `--only <assertion-id,...>` selects
the requested subset. Do not propose 64 unrelated green-suite bindings. The
manifest joins the reviewed definition fingerprint; changing its claims requires
a fresh human review. A no-op binding preserves the existing contract/consent.
The original 48
identities remain; additional maintainability requests extend them or add IDs
049–064. Verify every applicable condition, not only an older narrower statement.
A reviewed project fitness binding has command
array, verifier input globs, verificationHash, timeoutMs (1–120000), optional
maxAgeMs for time-limited evidence, and coverage rationale. Expired or future-dated
receipts cannot prove external facts. The verifier must inspect the actual
environment and authenticate dated external records. Propose bindings
as contract changes; never substitute an unrelated green test for semantic evidence.
Use `fitness bind <rule-id[,rule-id]> --command-json '["bun","test","test/boundaries.test.ts"]'
--inputs 'test/boundaries.test.ts,package.json,bun.lock' --rationale 'Explain the exact
condition this test proves for every selected rule' --preview` to scaffold bindings from an existing
test. It fingerprints the inputs and prepares human review without running the
command or changing policy. Quote the globs. It does not infer semantic coverage.
Optional `--max-age-ms` gives evidence an explicit freshness budget. Application
contents in preset scope already invalidate receipts; definition inputs should
identify the verifier, helpers and configuration, not accidentally demand a
contract approval for every routine application edit.
`fitness status [--json]` inspects evidence without executing code. `fitness run
<verifier|--all>` executes only reviewed bindings. Identical command/input/budget
groups run once. Changes to the contract or selected inputs invalidate receipts.
Unbound requirements stay active and UNVERIFIED without blocking work. Never
call that compliance or suggest disabling protection to clear missing coverage.
Status JSON summarizes adopted, passing, failed, needs-evidence and unbound
requirements; inspect the per-rule state before claiming completion.

For design work, read the project's explicit domain boundary, relationship,
cardinality, value units/precision, consistency, identity and work budgets. State
missing facts, observed change axes and real exceptions. Propose the smallest
change and assertions with invalid controls. Do not infer architecture or data
model correctness from a folder name or repeat a generic design prompt per rule.
The project guide `docs/guides/design-contract.md` provides a short worksheet.
`status` separates static checks from project assertion coverage; JSON exposes
`fitnessCoverage` (active, pass, fail, unverified, complete, adopted) from current receipts.
Active consent/configuration is not proof of unverified requirements. `doctor`
checks launcher registration; direct engine hook calls have no launcher
crash/timeout protection. A wrapper canary does not override registration errors.
Linux/Windows test builds have no production-support claim until their native
release gates pass; do not infer platform qualification from cross-compilation.
For an adopted binding on an enforcing rule, missing/stale/incomplete or failed
evidence blocks check and Stop. Optional shadow stays diagnostic; explicitly
review enforcement when adopting a readiness gate. Audit remains incomplete
while any requirement is unverified.
`fitness run --all` runs adopted bindings; its success does not certify unbound rules.
The original PR catalog is available through optional maintainability/future-humans,
maintainability/engineering and pstack/principles, operations, playbooks and workspace
methodologies. They preserve 313 source entries as 286 authored evidence obligations;
grouped entries share one complete-clause assertion, such as PS-71-74. Select only
applicable workflow policies and propose reviewed task/project assertions. Syntax
slices do not prove the full statements; selecting these rules does not invoke a skill.
Passing means only the reviewed
assertion passed; it is not general maintainability certification. Use `fitness
fingerprint <glob...>` to calculate the reviewed verifier-input checksum. A changed
verifier/helper/configuration requires a reviewed checksum change before execution.
Include all relevant verifier definitions in its inputs. Add meaningful
project tests, rerun fitness after repairs, and disclose uncovered requirements.
Read `statement` and `fixHint` in fitness/audit JSON to obtain each exact English
requirement and its next action; do not infer a requirement from its ID alone.

Keep type checking, lint and behavior tests. Stop is bounded and can finish with
unresolved findings; completion is not compliance. Reports retain incomplete
Stops even where the harness suppresses the notice. Run check --all for current code.

## Audit, calibrate and report

Informational warnings and shadow findings remain recorded. Nonblocking Claude
Stop output uses only the human notice channel, so it does not continue the
conversation. Inspect `report --json` for those observations. Actual denials and
bounded incomplete Stops retain their established policy.

Default `audit` text starts with totals and coverage/evaluation gaps, then shows
up to ten rule summaries, 25 locations and five entries per other detail category.
Read the shown/total counts; the compact view is not the full inventory. Use
`audit --full` for every text location or JSON/JSONL for complete machine evidence.
Unbound requirements keep their unverified total and an optional `fitness plan`
pointer; Stop and check no longer repeat it. Failed/stale adopted assertions remain
visible. These presentation modes do not change evaluation or exit codes. `--full` cannot combine with `--json`/`--jsonl`.
`--plan` explicitly includes the complete advisory plan in either text view.

Use `audit --plan --json` to prepare scoped repairs grouped by file and rule.
Its deterministic metadata classification and test-path conventions are advisory.
Benchmark, negative-fixture, example and declaration files need their purpose
reviewed first; generic parallelization, deduplication or annotation advice can
change what those files demonstrate. Preserve deliberate negative controls.
Resolve evaluation/coverage gaps, inspect failed assertions, and review business
priority before changing behavior. Name actual inputs/outputs and the project's
test commands; the plan did not run tests or infer ownership. Source/cache content
budgets are 32 MiB each; `audit-input-limit` means incomplete evaluation, not
compliance or a reason to disable protection.

Use `audit --incremental --plan --json` for repeated large audits. Reused files
and their dependency/configuration inputs are rehashed; changed inputs trigger
analysis. Rerunning the command resumes completed checkpoints after interruption.
`audit --fresh` bypasses reuse and refreshes the disposable cache. The default
audit stays cold. Read the incremental counters and errors; a cache hit is not
project fitness evidence. Fitness is evaluated again on every audit. Check and
hooks never use this cache. Cache files stay local in protected machine state;
they can contain finding paths and symbols, but no source-file bodies.

Use `audit --jsonl [--incremental|--fresh]` for results during analysis. Records
are `start`, one `file` per parsed source, and `end` with the exit code and
aggregate report without a findings array. `error` or missing `end` means no
completed audit. Earlier findings are provisional until final source/contract
validation. An `end` with code 2 is still incomplete compliance. JSONL cannot
combine with `--json` or `--plan`; use buffered JSON for ranked repairs. Per-file
output avoids retaining all findings, but inventory/cache metadata still uses memory.

`audit [--repo <path>] [--json|--jsonl|--full] [--plan] [--incremental] [--fresh] [--strict]` inventories existing selected static debt,
including shadow/warn findings. Exit 0 means nothing blocks; 1 means findings
that block under live policy (enforce mode; the ratchet is not applied) or
failed/unproven adopted assertions; 2 means incomplete analysis or invalid input.
`--strict` also returns 2 for unsupported/uncovered files and unverified
requirements, and 1 for any finding. Inspect the fitness array,
unsupported/uncovered files, errors, exclusions and skipped
change-only/delegated rules before describing coverage. Parsers cover JS/TS,
Python, Go, and Rust. Rust macros are not
expanded, and native Vue/Svelte parsing is not implemented. A framework
pack does not add a parser. Syntax does not certify security or maintainability.

`report [--days <n>] [--repo <path>] [--json]` shows recorded observations.
Its `sessionBaselines` shows each recorded session's retained HEAD, current HEAD,
SessionStart/first-contact origin, saved dirty-file count and capture time. Missing,
invalid or legacy untimed snapshots remain explicit. Reading the report does not
create or reset snapshots. Stop retains its session baseline across commits;
CLI check uses HEAD/index/merge-base and does not replay that baseline. A clean
CLI check cannot clear a Stop finding. Inspect the finding and baseline, preserve
behavior and propose a bounded reviewed adaptation where needed; do not delete
session state to make a finding disappear.
After a reviewed committed merge, prepare `session rebase <harness:session-id>
--preview` in a clean worktree. Show its retained-baseline-to-HEAD diff (above
8 MiB, the per-file summary and the `git diff` command it names) and exact digest. Only the human applies `session rebase <id> --digest <sha>
--yes`; original snapshots and events remain. This deliberately adopts the
committed tree as debt, does not prove authorship and does not fix findings.
Changed or expired reviews reject. Standalone/uncommitted trees cannot use it.
Unchanged blocking Stop findings are bounded across new turns as well as
reentry; after the cap they remain recorded as incomplete. A changed tree,
contract, baseline or result restarts blocking. Pre checks remain active.
Trees beyond the 128 MiB fingerprint budget keep the ordinary per-turn cap;
the engine does not infer that oversized trees are unchanged.
Its `timing` gives measured/unmeasured record counts and p50/p95/max gate decision
milliseconds. Legacy data stays unmeasured. These timings exclude startup, event
persistence and proposed tool execution; a multi-file call supplies multiple
elapsed-prefix samples. They do not replace the full compiled hook benchmark.
Reports and feedback default to seven days. `feedback list` gives finding IDs;
prepare `feedback draft <id> --as correct|false-positive|uncertain` with an optional
note, review `feedback show <digest>`, and let the human approve apply.
Reviewed precision describes a selected local sample, not a product quality score.

Ask the human to use `dispute --last` or an event ID for a suspected false positive.
It drafts a fixture with observed content/baseline under pregate-drafts and grants
no exception. Add the case to the check, repair it, and test the complete source.

Prepare `issue draft --last --note "Expected behavior"` for a tool issue.
Ordinary drafts omit code; --include-code or a public --repro can disclose source
and requires review. Inspect `issue show <digest>`. Only the human approves
`! pregate issue submit <digest> --yes`. The destination is PREGATE's native GitHub
repository. Missing gh/auth/network preserves drafts; do not bypass uncertain
interrupted publication by creating another report.
Each gh command has a 15-second deadline and a 16 MiB limit per output channel.
Deadline/output failure is not successful publication, even if a URL appeared.
If creation may have started, retry the same reviewed digest to reconcile; an
empty search retains uncertainty and does not authorize another create.

## Parallel agents, worktrees and branches

Subagents and isolated worktrees need no setup. A worktree of a consenting repository
is protected by its own committed contract; do not ask the human to enable it again.
In Claude Code each subagent is checked on its own files at SubagentStop, and the
parent's Stop leaves out files a running subagent is editing. Checking out or merging a
branch that existed before the session is not charged to it; commits made or pulled
during the session still are (adopt them with a reviewed session rebase). One proposal is pending per
project: a newer one names the code it replaced, so show the human the latest review.

## Turn a correction into a rule

When the human states a team rule in one sentence, start with one command:

```sh
pregate rules add "domain must not import infra"
pregate rules add "UI components must not call fetch"
pregate rules add "no moment" --fail 'import moment from "moment";' --pass 'export const t = Date.now();'
```

It selects a bundled catalog rule that says the same (alternatives: `--rule <ns/ID>`;
`--draft` skips the catalog), or drafts a check with generated fixtures into
`.pregate/packs/project` (import edges and banned calls from the sentence alone; any
other shape from `--fail`/`--pass` code). `--files <glob>` scopes it. It only prepares
one digest-bound review; nothing is written until the human approves, and approval
commits the pack with the preset and lock. Rerunning the same preview keeps its code.

When the human corrects code you wrote and no rule fired, offer to make the
mistake impossible instead of remembering it. Keep the rejected and corrected
versions as files (TypeScript/JavaScript, Python, Go or Rust; language is
inferred from the `--fail` file extension), and either write a pattern or omit
`--pattern` (or pass `--pattern auto`) so PREGATE synthesizes a pattern that matches
every `--fail` and `--trap` and no `--pass`, preferring the callee or imported module
over the literal line, and prints it:

```sh
pregate rules draft rules/<ns> <area>/<name> [--pattern rule.json|auto] [--files <glob>] \
  --message "..." --why "..." --fix "..." --fail <rejected-file> --pass <corrected-file>
```

`--files` scopes the rule and places its fixtures under that scope.

The draft refuses a pattern that misses the rejected file or flags the corrected
one. Repeat with more `--fail`, `--pass` and one `--trap <file> --trap-note <text>`
until it reports complete, then adopt the folder with `pack add --path rules/<ns> --preview`.
For a pack that is already active, pass every case in one run: the draft is staged
as one contract update for human approval (`pregate approve --preview`).

## Author a rule pack

`pack init <ns>` writes a local data-only scaffold. Each check needs check.json
and at least two pass, two fail and one trap fixture with actual source files.
A trap violates the invariant while trying to satisfy its wording. Methodologies
provide defaults, severity, why, repair guidance, avoid text and provenance.
Use builtin primitives or declarative patterns, never executable pack code.
Declarative patterns support cross-language semantic `kind` aliases (`@fn`, `@call`,
`@import`, `@loop`, `@branch`, `@class`, `@return`, `@throw`) across TypeScript/JS,
Python, Go and Rust, and lexical `scope` predicates (`"local"`, `"module"`,
`"parameter"`, `"unshadowed"`).
Run `rules test <dir>` before proposing adoption. --library tests a bundled pack;
--fixture replays a reduced fixture/repro and does not certify the complete pack.
Separate mechanical constraints from workflows or unsupported semantic claims.
Prefer stable product conditions with explicit applicability and exceptions.
Keep language/library/architecture choices in optional packs, not the agnostic
core. Metrics and name/text heuristics are advisory until the project justifies
their contract. Use AST roles and actual import/query chains; preserve valid
inference, client directives and unrelated text. Add false-positive regressions
and violating controls before proposing enforce. Use reviewed project fitness
for semantic facts; unbound requirements remain UNVERIFIED, not protected.
Promote an admitted set in one reviewed preset request, preserving severity,
parameters, scope and ratchet. Do not raise warn to deny or promote every pack
because its fixtures pass. When valid code is blocked, propose a bounded rule
correction or assertion instead of disabling PREGATE. The source repository's
docs/guides/invariant-enforcement.md documents these authoring criteria.
For library-derived rules, record the exact upstream artifact and declaration
origins. A related syntax check does not certify an entire API or its callers.
The dcouplr preview has a public API inventory in the project documentation;
unchecked contracts and partial associations remain explicit. Require actual
behavioral evidence before describing the library pack as complete.
`dcouplr/delivery` has ten optional project-evidence requirements for local
completion, broker handoff/fallback, ownership/routing/context and exception flow.
Bind actual application assertions and explicitly review enforcement; source
canaries and receipt fixtures do not certify consumer behavior. Do not infer
remote processing from a resolved broker promise or termination from report's
never type. Full library coverage remains incomplete.

## Installation and local state

For an existing project, inspect installed versus project/lock versions rather
than assuming `--version` identifies the engine used by every hook. Unified
migration forms are in 0.0.7; check `--help` when the installed engine is older.
Prepare `update --project --preview` or
`pack update --all --preview`: engine, core and every registered pack enter one
candidate and one digest-bound human approval. A single-pack update uses the
installed engine and expands to one project migration when other pins are stale.
`guide --preview --packs <ns,ns>` can combine that migration with
selected additions. Discovery examines the entire catalog, including inactive
methodologies. After update, suggest relevant new/changed packs and an audit;
never assume the user saw release notes. Historical comparisons use the previous
installed immutable engine; if unavailable, say the new-pack count is unknown.
Human `! pregate update` installs the release and prepares one preview of every
enabled registered project (this machine's consent records, their worktrees and
the current project) whose lock pins an older engine; a newer pin is never
downgraded. Engines no registered project pins are then removed. A
`update --project --preview` also names other registered projects with older
pins and the exact `update --projects ... --preview` command for them. When a
session starts in a project pinned to an older engine and a newer one is
installed, SessionStart says "PREGATE update ready"; ask the user to run
`! pregate update`. In a Git repository without a contract, SessionStart says
PREGATE is installed but not enabled; offer `guide --preview`.
Where `guide` is available, offer its explicit multi-project selection:
`! pregate guide --projects <path...>` is a human terminal flow with one
confirmation of all displayed digests. The agent can inspect `guide --json
--projects <path...>` and prepare `guide --preview --projects <path...>` instead.
Every candidate validates again after confirmation before any application; each
project revalidates at its writes. Successful projects remain if a later race
fails another; show only the failed paths to retry. Current projects need no
approval or rewrite, and unrelated pending proposals must not be applied.
Without a terminal, show each project's exact digest command in its own root.
Keep disabled consent and custom policies; native harness limits still apply.
Prepare `update --projects <path...> --preview` to migrate one or
several explicit project roots from any directory. Quote paths with spaces.
Show every project's diff, digest and failure. With two or more reviews it
prints one batch code: `! pregate approve <code>` approves every prepared project
from any directory, validates them all first and applies none if any changed then;
each is then applied and committed on its own.
A human can also rerun the same list with `--yes` for one execution, or approve
each exact digest in its own project.
The --yes run prepares fresh reviews; it is human automation, not approval of
the prior preview's digest. It applies each project through the approval path,
which commits that project's preset and lock (`--no-commit` opts out), and
prints one Updated/Current/Failed line per project. All candidates preflight
before application; later failures are reported per project and successful
updates are retained. Current contracts are no-ops; disabled consent stays
disabled. Never run --yes as an agent.
If an old hook rejects new helpers, leave this initial command to the human;
do not delete/move the lock, reset the preset or repeat blocked agent commands.

Use `preset diagnose --json` for invalid-contract inspection and simultaneous
schema/pin diagnostics; `preset schema` describes the actual editable preset.
`preset request-schema` describes only the request envelope and JSON patch.
`preset show --json` is raw document inspection, not proof of admission.
Literal `cat` and `git diff --` can inspect this root's preset/lock even when
invalid; `ls .pregate/` can list its inventory. Protected outputs remain denied.
Literal `git add -- .pregate/preset.json .pregate/pregate.lock.json` can stage the
exact admitted contract pair. It cannot stage invalid policy, mutate its content,
use arbitrary pathspec options or grant human approval. For Codex, establish a
literal `cd` to the project first when the shell cwd is unknown.

Isolated literal recovery previews and preset
diagnosis/schema/help use the installed guard instead of an older locked
guard. Use one helper per
call; combining it with other commands, wrappers or redirections retains locked
routing. Application edits, Stop and approval still use the locked engine.

During onboarding, inspect source inventory against the proposed scope before
approval. Do not assume src/lib/test cover app/components/tests/e2e, root files or
workspace packages. Init includes detected source roots while
preserving exclusions. scan --json reports scope gaps, and scan
--plan can include a scope expansion alongside packs. pack apply accepts that
optional scope in one reviewed plan; existing contracts are never widened silently.
Prepare the concrete proposal before requesting approval; avoid asking separately
for each pack or for permission to prepare a reversible preview.

Unverified requirements report missing evidence, not a demand to stop or disable
protection. Stop and check do not announce them; `audit` and `fitness status`
list them. Mention them only when the user asks about coverage. Bind assertions when their behavior and evidence scope are defined.

For a project DSL, use domain-approved terms, a closed command/data vocabulary,
explicit legal transitions and real negative controls. Prefer the project's
existing types and parser. The domain-language guide contains a runnable example
and shows how to combine pstack, mattpocock and domain-specific assertions without
claiming syntactic checks prove business semantics.

`--last` picks the newest denied, asked or advised event; shadow and muted
observations are skipped. `issue list` shows recorded event IDs, newest first;
draft one by ID (an observation also needs --note or --repro). When no recorded
event fits, use `issue draft --no-event --title "Short problem title" --note
"Expected behavior"`; the draft then carries no recorded evidence. The title
and note enter the reviewed draft and its deduplication identity; the recorded
evidence remains labeled as recorded evidence. Inspect it before human approval.
Timeout/crash diagnostics can name the last observed engine checkpoint. This is
a stage, not proof that a particular rule caused the failure.
Severity strings are deny/ask/warn/off. Enforcement uses an object, e.g.
`{"enforcement":"enforce"}`. Migration can propose corrections for mistaken
enforce/shadow strings, preserving previous effective severity/parameters, but
cannot recover notes already overwritten or guess a missing previous rule.
Show the complete diff, import-cost notice and digest before human approval.

Shadow/warn import rules do not initiate unchanged-importer sweeps in Pre/Stop
on the new source. Audit/commit/CI and direct-file observations remain available.
Ordinary body changes use direct-file review; dependency-sensitive Drizzle schema
changes can also review unchanged queries. Additions/deletions, parser validity,
re-exports and resolver configuration can sweep applicable importers. Facts and
reads are shared within the operation. This checkout can also reuse a disposable
persistent cache of exact resolver reads after validating importer content, policy
context, dependency content and path identity. Affected importers are evaluated
again; findings and passing verdicts are never cached. Missing, invalid or
unavailable cache state falls back to fresh resolution. The engine progress
protocol records rule operations that actually began and distinguishes shared
resolution work; a last checkpoint is an observation, not proof of crash cause
or completed native-harness certification. Report the remaining large-repository
limit and never present off as the normal performance fix.

Leave installation changes to explicitly authorized work. setup installs global
registrations/instructions (Codex and agy only when their binary is on PATH;
doctor reports a binary-less one as INFO); update selects latest or --version/--engine; uninstall
optionally --purge removes state. install --git-hook --ci github adds the GitHub
Actions workflow. install --ci vercel adds the Vercel build recipe, which can be the
only CI on a repository. install --ci github,vercel adds both, and both must pass.
enable/disable require human consent. Use top-level --help/-h for forms.

State can retain complete source blobs. Inspect `storage inspect --json`; prepare
`storage prune --older-than <days> --preview` or `storage recover --preview`.
Review show and leave digest-bound apply to the human. Unknown/foreign-host or
unproven owners remain retained; cleanup preserves snapshots, histories and counters.

Advisory repair and grouped evidence plans are implemented. Automated refactoring,
model classification and maintainability certification are not. Give concrete guidance and validate
changes with project tests, then rerun audit.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## All public command forms

```text
usage:
  pregate guide [--json|--preview [--full]] [--packs <ns,ns|none>] [--custom-pack <path>] [--custom-from-docs] [--enforcement shadow|advisor|enforce] [--preset <name>]
  pregate guide [--json|--preview [--full]] --projects <path...>
  pregate check [--all] [--format agent|sarif]
  pregate audit [--repo <path>] [--json|--jsonl|--sarif|--full] [--plan] [--incremental] [--fresh]
  pregate promote [--rule <id,id>] [--repo <path>] [--preview|--yes]
  pregate fitness status [--json] | plan [--candidates <path>] [--json|--template [--auto]] | run <verifier|--all>
  pregate fitness fingerprint <glob...>
  pregate fitness bind <rule-id[,rule-id]> --command-json <argv-array> --inputs <glob,glob> --rationale <text> [--timeout-ms <n>] [--max-age-ms <n>] --preview
  pregate fitness bind --candidates <path> [--only <assertion-id,...>] --preview
  pregate check --stdin --path <file> [--format agent|sarif]
  pregate check --staged [--ratchet]
  pregate check --ratchet --base <sha>
  pregate explain <rule> | --path <file>
  pregate preset show [--json] | request-schema | compile [--yes] | apply <request.json> [--preview|--yes]
  pregate preset diagnose [--json] | schema
  pregate rules test [<dir> | --library <ns> | --fixture <dir|repro.json>]
  pregate rules add "<sentence>" [--fail <code>]... [--pass <code>]... [--files <glob>] [--rule <ns/ID>] [--draft]
  pregate compile <rules.md> [--json|--template|--preview] | compile apply <proposals.json> --preview
  pregate rules draft <pack-dir> <area>/<name> [--pattern <rule.json|auto> --message <text> --why <text> --fix <text>] [--files <glob>] [--fail <file>]... [--pass <file>]... [--trap <file> --trap-note <text>]...
  pregate storage inspect [--json] | prune --older-than <days> [--preview] | recover [--preview] | show <digest> | apply <digest> [--yes]
  pregate enable | disable [--yes] | status [--json|--verbose]
  pregate approve --preview [--full] | <code> [--no-commit] | [--yes] [--digest <sha256>] [--no-commit]
  pregate init [--preview|--yes] [--preset <name>]
  pregate scan [--json|--plan]
  pregate layers [--json] | layers apply <layers.json> --preview [--complete]
  pregate demo [--language python|go|rust|all] [--json]
  pregate report [--days <n>] [--repo <path>] [--json]
  pregate session rebase <harness:session-id> --preview | rebase <harness:session-id> --digest <sha256> [--yes]
  pregate feedback list [--days <n>] [--json]
  pregate feedback draft <finding-id> --as correct|false-positive|uncertain [--note <text>] [--days <n>]
  pregate feedback show | apply <digest> [--yes]
  pregate dispute [--last | <event id>]
  pregate issue list
  pregate issue draft (--last | <event id>) [--include-code | --repro <dir|repro.json>] [--note <text>] [--title <text>]
  pregate issue draft --no-event --title <text> --note <text> [--repro <dir|repro.json>]
  pregate issue show | submit <digest> [--yes]
  pregate pack list [--library] [--category invariants|language|pattern|library|practice|process] [--json]
  pregate pack show [--library] <ns|methodology> [--json] | show --path <dir> [--json]
  pregate pack add --library <ns> [--source-only] [--preview|--yes]
  pregate pack init <ns> | add <url>@<ref> [--source-only] [--preview|--yes] | add --path <dir> [--source-only] [--preview|--yes]
  pregate pack enable <ns/methodology> [--only <id,id>] [--preview|--yes]
  pregate pack apply <plan.json> [--preview|--yes] | restore
  pregate pack disable <ns/methodology> | remove <ns> | update <ns> [--preview|--yes]
  pregate pack update --all [--preview|--yes]
  pregate install [--git-hook] [--ci github|vercel|github,vercel]
  pregate ci detect [--json]
  pregate ci status [--sha <sha>] [--require github-actions|vercel] [--json]
  pregate ci wait [--sha <sha>] [--timeout <seconds>] [--interval <seconds>] [--require github-actions|vercel] [--json]
  pregate prepare [--version <v> | --engine <v>]
  pregate project launcher [--preview|--yes]
  pregate project setup
  pregate setup | update [--version <v> | --engine <v>] | uninstall [--purge] [--yes] | doctor
  pregate update --project [--preview|--yes]
  pregate update --projects <path...> [--preview|--yes [--no-commit]]
  pregate --version | --help | -h
```

## Bundled categories and methodology IDs

Categories: `invariants`, `language`, `pattern`, `library`, `practice`, `process`. Filter with `pack list --library --category <category>`. Core is an invariant source with all 68 requirements active by default; optional packs are selected independently.

- `agent-practices@1.0.0` — practice: `agent-practices/behavior-testing` (preview), `agent-practices/domain-ownership` (preview), `agent-practices/launch-safety` (preview), `agent-practices/security-review` (preview)
- `angular@1.2.0` — library: `angular/components` (complete), `angular/rxjs` (complete)
- `architecture@1.3.0` — pattern: `architecture/anti-corruption` (complete), `architecture/clean-architecture` (complete), `architecture/cqrs` (complete), `architecture/dependency-rule` (complete), `architecture/functional-core-imperative-shell` (preview), `architecture/hexagonal` (complete), `architecture/layered` (complete), `architecture/modular-monolith` (complete), `architecture/repository` (complete), `architecture/vertical-slice` (complete)
- `astro@1.0.0` — library: `astro/config` (complete), `astro/content` (complete), `astro/routing` (complete)
- `authjs@1.2.0` — library: `authjs/config` (complete), `authjs/session` (complete)
- `clean-code@1.2.0` — practice: `clean-code/clean-code` (complete)
- `consumer-saas@1.0.0` — invariants: `consumer-saas/readiness` (preview)
- `dcouplr@1.27.1` — library: `dcouplr/delivery` (preview), `dcouplr/events` (preview), `dcouplr/factories` (preview), `dcouplr/factory-runtime` (preview), `dcouplr/logging` (preview), `dcouplr/managed-components` (preview), `dcouplr/messages` (preview), `dcouplr/observability` (preview), `dcouplr/queue-runtime` (preview), `dcouplr/queues` (preview), `dcouplr/runtime` (preview), `dcouplr/saga-runtime` (preview), `dcouplr/sagas` (preview), `dcouplr/utility-runtime` (preview)
- `ddd@1.1.0` — pattern: `ddd/ddd-tactical` (complete)
- `design-invariants@1.0.0` — invariants: `design-invariants/architecture` (preview), `design-invariants/code-quality` (preview), `design-invariants/design-principles` (preview), `design-invariants/domain-state` (preview), `design-invariants/error-handling` (preview), `design-invariants/package-principles` (preview), `design-invariants/performance-and-data` (preview), `design-invariants/process` (preview), `design-invariants/security` (preview), `design-invariants/testing` (preview)
- `drizzle@1.3.0` — library: `drizzle/queries` (complete), `drizzle/schema` (complete)
- `enterprise-ready@1.0.0` — invariants: `enterprise-ready/readiness` (preview)
- `express@1.2.0` — library: `express/middleware` (complete), `express/requests` (complete)
- `firebase@1.2.0` — library: `firebase/auth` (complete), `firebase/firestore` (complete)
- `go@1.2.0` — language: `go/architecture` (complete), `go/effects` (complete), `go/quality` (complete)
- `hono@1.0.0` — library: `hono/middleware` (complete), `hono/routing` (complete)
- `javascript@1.2.1` — language: `javascript/esm` (complete), `javascript/legacy` (complete), `javascript/safety` (complete)
- `maintainability@1.2.0` — practice: `maintainability/engineering` (preview), `maintainability/future-humans` (preview), `maintainability/maintainability` (complete)
- `mattpocock@1.1.1` — practice: `mattpocock/design` (preview), `mattpocock/diagnosis` (preview), `mattpocock/testing` (preview)
- `mongodb@1.2.0` — library: `mongodb/models` (complete), `mongodb/queries` (complete)
- `musk@1.0.1` — process: `musk/algorithm` (complete)
- `nestjs@1.2.0` — library: `nestjs/controllers` (complete), `nestjs/providers` (complete)
- `next-website@1.0.0` — library: `next-website/readiness` (preview)
- `nextjs@1.4.0` — library: `nextjs/rendering` (complete), `nextjs/routing` (complete)
- `node@1.3.0` — library: `node/internals` (complete), `node/runtime` (complete), `node/security` (complete)
- `nuxt@1.2.0` — library: `nuxt/data` (complete), `nuxt/server` (complete)
- `postgres@1.2.0` — library: `postgres/client` (complete), `postgres/safety` (complete)
- `prisma@1.3.0` — library: `prisma/client` (complete), `prisma/writes` (complete)
- `pstack@1.1.1` — process: `pstack/boundaries` (complete), `pstack/effects` (complete), `pstack/operations` (preview), `pstack/playbooks` (preview), `pstack/principles` (preview), `pstack/proof` (complete), `pstack/reader-load` (complete), `pstack/workspace` (preview)
- `python@1.4.0` — language: `python/architecture` (complete), `python/effects` (complete), `python/legacy` (complete), `python/quality` (complete)
- `react@1.2.0` — library: `react/components` (complete), `react/hooks` (complete)
- `react-native@1.2.0` — library: `react-native/platform` (complete), `react-native/security` (complete)
- `redis@1.2.0` — library: `redis/client` (complete), `redis/keys` (complete)
- `rust@1.2.0` — language: `rust/architecture` (complete), `rust/quality` (complete)
- `security-audit@1.0.0` — practice: `security-audit/client-and-agents` (preview), `security-audit/obvious-sinks` (preview)
- `senior@1.2.0` — practice: `senior/fowler` (complete), `senior/style` (complete)
- `solana@1.2.0` — library: `solana/key-custody` (complete), `solana/kit-client` (complete), `solana/pda-safety` (complete), `solana/rpc-env` (complete), `solana/tx-safety` (complete)
- `supabase@1.2.0` — library: `supabase/client` (complete), `supabase/storage` (complete)
- `svelte@1.2.0` — library: `svelte/runes` (complete), `svelte/stores` (complete)
- `sveltekit@1.2.0` — library: `sveltekit/data` (complete), `sveltekit/routing` (complete)
- `tailwind@1.2.0` — library: `tailwind/classes` (complete)
- `tanstack-query@1.0.0` — library: `tanstack-query/client` (complete), `tanstack-query/keys` (complete)
- `testing@1.2.1` — practice: `testing/tdd` (complete)
- `trpc@1.2.0` — library: `trpc/client` (complete), `trpc/router` (complete)
- `typescript@1.3.0` — language: `typescript/anti-evasion` (complete), `typescript/async-results` (complete), `typescript/discipline` (complete), `typescript/framework-entries` (complete), `typescript/legacy` (complete), `typescript/named-exports` (complete), `typescript/strict-types` (complete)
- `vercel@1.0.0` — library: `vercel/configuration` (preview), `vercel/cron` (preview), `vercel/environment` (preview), `vercel/functions` (preview), `vercel/protection` (preview), `vercel/recovery` (preview)
- `vibe-proof@1.1.0` — practice: `vibe-proof/hygiene` (complete), `vibe-proof/secrets` (complete), `vibe-proof/transport` (complete)
- `vue@1.2.0` — library: `vue/reactivity` (complete), `vue/sfc` (complete)

Inspect live defaults and scope with `pack show --library <ns> --json`; effective policy comes from `preset show`/`explain`. Check availability on the installed version before proposing a command.
<!-- END generated reference -->
