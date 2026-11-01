# Product roadmap

0.0.1 / core 0.0.1 is the public release. macOS ARM64 is stable. Linux and Windows
builds stay experimental until native release validation passes. See the
[v0.0.1 release notes](releases/0.0.1.md). Star counts are not an acceptance
criterion; useful activation and repeated use need actual independent users
before making adoption claims.

The sections below record earlier private pilots. Their release notes and evidence
files are not in this tree, so a bare title is history, not a link to follow.
The 0.2.14 macOS pilot reported shell/no-preset p50 24.9/21.8 ms against 25 ms
and route p95 at most 137.5 ms against 150 ms. That figure is not a measurement
of the 0.0.1 binaries.

## Proposed public pack distribution

Ship the engine, language-independent core and a small catalog index. Publish
optional data packs separately as immutable, versioned GitHub release assets.
Discovery uses catalog metadata (category, language, methodologies, compatibility
and origin); it must not download every rule to recommend a pack. Initially keep
the parsers in the engine, so language support does not require another runtime
plugin installation.

Onboarding scans the repository, offers applicable packs together, downloads and
validates only the selected packs, and prepares one contract review. Downloading
or discovering a pack does not activate it. Updates offer one compatible engine,
core and selected-pack change, preserving custom packs, overrides and consent.
New catalog entries produce a concise optional recommendation, not a new rule
silently added to the project.

The committed preset and lock pin pack origin, exact version and content digest.
An immutable cache is shared across local projects; an exact restore command and
offline export/vendor route let teammates and CI reproduce those pins. Hooks
must not contact the catalog or fetch a missing pack; they report the concrete
restore action instead. Resolve and validate a complete candidate before changing
the live contract, so a failed download cannot leave a half-updated project.

Reuse existing pinned Git/local pack infrastructure. Start with an official
GitHub catalog and allow team/private sources; a dedicated hosted registry is
unnecessary for the first public release. Official, community and team origin
labels describe provenance, not correctness certification. Engine and pack
versions can evolve independently within declared compatibility.

The current Git importer requires `source.json` at repository root, updates from
Git HEAD, and validates the lock against cached pinned sources without network.
Official versioned assets need an explicit download/source migration; a pack
monorepo also needs subdirectory support. Official updates must select released
versions and immutable content pins, rather than treating development HEAD as a
stable release. License and engine compatibility belong in the catalog metadata.
After adoption or restoration, offline checks still need matching local engine
and pack sources. Lock-only verification would need its own integrity design.

This is a proposed distribution change. Source 0.2.12 still embeds all 43 optional
packs. External discovery, selected-version cache lookup, exact restoration and
grouped migration need verification before removing those bundled assets.

**0.2.11 is published and globally installed on the user's Mac.** It delivers
different project-verifier commands in one review, inspectable partial drafts,
concrete conditions/negative controls and domain/data/performance assumptions.
Onboarding shows proposed scope and readiness before approval; multi-project
updates share follow-up choices and preserve custom policy and disabled consent.
Valid TypeScript parser/property ownership and tracked-build inventory repairs,
bounded stdin JSON diagnostics, passive advisory Stop, compact audits and the
design-contract guide address observed daily-use debt. Reviewed `agent-practices`
adds 22 optional requirements; source and installed catalogs have 42 packs.
Core defaults remain unchanged. See [v0.0.1 release notes](releases/0.0.1.md) and
exact verification for publication, global-install
preservation, original control failures and remaining latency limits.

Remaining work includes native Windows/Linux admission, trusted Cursor human
approval, persistent dependency-graph reuse, arbitrary dcouplr semantic/data flow,
and broader empirical maintainability evaluation. Rule fixtures and limited paired
experiments do not establish an 80% false-positive confidence estimate ([measurement](benchmarks/false-positives.md)) or general
maintainability certification. Keep no-new defaults and honest evidence limits.

The published 0.2.10 repository controls add seven
concrete follow-ups delivered in 0.2.11 with separate positive and negative cases:
valid optional `abstract` property parsing; local versus exported property
ownership; proposed coverage before first approval; Vue peer-dependency pack
recommendations; tracked authored files under `build/`; fallback-aware error
guidance; and generator/test repair ownership. The original audits remain frozen.
Their parser, discovery, inventory and repair-plan controls now pass in the frozen
source suite and admitted Mac artifact; no original audit was rewritten.
The paired greenfield calls also reproduce
read-only checks denied when the launcher is assigned to a shell variable before
a loop. Literal diagnostic commands remain the supported route. Improve bounded
binding-aware admission with write/substitution counterexamples; a blanket
variable exemption would not preserve protected-state guarantees.

The Kragg review adds a compact human audit in 0.2.11
while retaining full text and complete machine evidence. Next
evaluate concrete verifier-environment recovery and concise historical context
using existing fitness/report infrastructure. Public-symbol discovery for reuse
and domain language should be bounded and on demand. Criticality and selective
mutation may inform advisory test planning; graph reach and assertion syntax do
not establish product correctness. Keep qualified-call heuristics in optional
language/library packs until alias, rebinding and scope controls support them.

The prospective 0.2.11 dogfood and held-out checks
verify grouped updates with custom packs/disabled consent and complete audit
evidence on three fresh repos. They add a reduced valid `using` parameter parser
gap alongside the optional `abstract` property case. 0.2.11 carries hook readiness into
approval preview, shows provisional coverage before adoption, qualifies fragmented
documentation candidates and reduces repeated compact repair text. The independent
review is blind to engine findings; recognized source identities and insufficient
context prevent a precision claim. Preserve original results when fixing these
cases; these observations do not change core policy or admit a release.
The separate workflow review led to accurate `Already current` labels,
grouped post-update choices, missing-method names and concrete digest/setup
recovery commands. The final production controls verify these changes separately
from the original observations.

## Published baseline and research priorities

Published and globally installed 0.2.9 implements the [guided project workflow](features/guided-project-workflow.md):
one interactive entry, proactive state diagnosis, combined setup/update review,
and recovery of real failures without manual pin or lock edits. Exact Mac
artifact verification, publication and installation are complete.
Catalog expansion must not displace
evaluation of this daily experience.

The published-engine dogfood and
held-out first pass now prioritize the next
patch: incremental enforcing dependency review; language and owning-workspace
scopes; direct callback and router identity; contextual repair advice; complete
coverage labels; and grouped evidence planning. Keep the existing core defaults,
human approval and unchanged latency targets. Optional heuristic policies retain
shadow defaults until their applicability is supported by counterexamples.
0.2.8 adds explicit multi-project updates, preserved custom policy and current
contract no-ops; see [v0.0.1 release notes](releases/0.0.1.md) for its verified publication state.

The conversation and real-session review now
drives focused recovery/onboarding corrections and a
[project domain-language workflow](guides/domain-language.md). Unhappy-path
gaps remain explicitly tracked; additional packs do not substitute for fixing
the daily update and scope experience.

The published 0.2.7 macOS pilot delivers unified update preparation, fast interactive shadow
imports, variance parsing and focused diagnostic/Stop/report/fitness improvements.
The user authorizes the macOS pilot release while independent native Windows
validation remains pending. Current delivery and remaining issue requirements are
tracked in [v0.0.1 release notes](releases/0.0.1.md), the verification record
and the remaining scope. Shell p50 remains over its target;
the performance failure is retained rather than counted as full admission.

## 0.2.6 baseline and original 0.2.7 requests

Updated 2026-10-06. Published and globally installed 0.2.6 targets macOS ARM64,
with its bundled core (numbered 0.3.0 in that pilot). Full Linux and Windows
validation is deferred to the next release; those builds are experimental and
partially functional. This is the current delivery roadmap. SPEC §18 remains the
historical vision; its version waves are not a current feature inventory.
Implementation and verification are tracked in [roadmap](ROADMAP.md).

The user explicitly moves remaining **Cursor in-harness approval and complete
dcouplr coverage to 0.2.7**. They no longer block 0.2.6; Cursor retains its
human-terminal fallback and dcouplr retains its preview disclosure. See the
0.2.7 plan. Mac artifact admission, publication and
global update are complete for 0.2.6. Post-release audits
add a reduced valid-TypeScript variance parser defect to the 0.2.7 backlog.

## Evaluation of the previous roadmap

The original order assumed one harness and JS/TS first, then adoption tooling,
shared packs, Windows, and finally Python. Actual implementation already includes
five adapters, init/doctor, Windows distribution, pinned Git packs, reports,
contract proposals and per-rule shadow. Keeping those in future waves obscures
the work that matters now.

More catalog entries alone do not improve the product. A precise, independently
selectable rule with useful feedback is more valuable than an unenforced prose
invariant. More adapters also do not imply equivalent guarantees: each native
protocol needs a capability contract and a working end-to-end test.

The immediate bottlenecks are correctness of dependency context, standalone
operation, misleading performance measurements and friction in activation and
approval. Resolve those before expanding enforcement or making release claims.

## Delivered in 0.2.6 and remaining limits

| Delivery | Product benefit | Release evidence |
| --- | --- | --- |
| Context-aware dependency checks | Configuration and barrel changes cannot silently weaken architecture | Pre/Stop/index/base regressions with independent baselines |
| Complete standalone mode | A user can protect a folder without first setting up Git | Real CLI and launcher workflows without Git |
| Active benchmark and measured optimization | Published timings describe work actually performed | Blocking canary, stage evidence, representative percentiles, unchanged budgets |
| Native candidate verification before publication | A supported-platform startup failure blocks release | The exact packaged Mac ARM64 archive/installer passes bootstrap and product smoke. The user permits deferring Linux/Windows native validation with experimental, partially functional disclosure and a reproducible handoff; no current certification for those targets. See [workflow and evidence](features/release-verification.md) |
| Effective status and capability matrix | A user knows whether protection is ready, active, degraded or missing | Text/JSON tests; exact rule policies and backstop state |
| Explicit incomplete Stop outcomes | Finishing a turn cannot be mistaken for passing compliance | Durable reason/cause/findings, actionable text/JSON reports, unchanged loop cap and verified repair; exact per-harness channels disclosed |
| Exact contract review | Approvals describe the code and coverage the user is accepting | Source diffs, visible invisible characters, stale-change rejection |
| Approval inside the harness | No external-terminal round trip for a normal approval | Verified human-command/native-prompt workflows in Claude Code, Codex, Grok and agy; no self-approval. Cursor's remaining route is explicitly deferred to 0.2.7 |
| Optional native GitHub issue reporting | Real findings feed back into fixes and trap fixtures | Reviewed draft, human consent, minimal reproduction, deduplication and offline/auth recovery |
| Accurate coverage and quality evidence | Users can trust rule names and release notes | General nesting traps; no unsupported scores or universal guarantees |
| Whole-project compliance audit | Brownfield users can inventory existing debt and begin repairing it | Static totals, all locations, shadow/warn inclusion, unsupported/error coverage, text/JSON and Git-free workflow |
| Useful calibration and deliberate retention | Reports remain usable as histories grow | Date-scoped reads, warnings/labels, explicit code storage and safe cleanup |
| Pack discovery and selective composition | Users can take the useful part of a pack without editing internals | List/show/preview, local sources, selected methodologies/rules and conflict diagnostics |
| Simpler onboarding | The first useful protected edit takes fewer steps | Preview, detected stack, curated defaults, idempotence and actionable next commands |
| Additional languages with actual enforcement | The same workflow helps mixed repositories | Python and Go parsers, language-specific checks, syntax/import/metric fixtures and bundled binary workflows |
| Product documentation and companion instructions | The first page explains value and everyday use | Product-focused README; all public options, categories, packs and rule defaults documented; generated-reference drift check; packaged skill reflects the same candidate |
| Code-agnostic core and modular engineering policies | Users install only the language, pattern, library, practice and process policies they need | Migrate controlled consumers together; no pilot compatibility layer required; retain honest invariant/fitness coverage |
| Source-backed dcouplr enforcement | Agents cannot bypass selected construction/effect boundaries silently | Current preview has 26 syntax checks plus 56 project-evidence gates in fourteen methodologies. The pinned probe verifies 764 runtime scenarios and 78 public-type controls. Compiled application assertions reject bounded adapter/caller regressions after reviewed binding. Complete coverage and independent consumer calibration are explicitly deferred to 0.2.7; source probes do not certify consumer compliance |
| All 48 user invariants in the core | The requested invariant contract is part of this release, with all core policy active by default | All original 48 identities are included within 64 evidence obligations and four general guards. Missing project evidence remains UNVERIFIED; human-reviewed disable is possible |

Use conservative defaults for new rules until precision is measured. Integrity
stays enforced. Explicit user-selected rules can enforce immediately; observing
by default must not be presented as active blocking.

[Local retention](features/local-storage.md) now provides session inspection and
reviewed cleanup of eligible historical source copies while preserving snapshots,
histories and counters. No automatic session expiry is introduced. Reviewed
recovery now removes only identifiable owner markers recorded on this host with
OS-confirmed absent PIDs; unknown/legacy/foreign-host owners remain retained.
Cross-machine shared storage is not certified. Full Linux/Windows native
verification remains pending.

## Next product capabilities

Pack authors can already use the
[documentation-to-pack method](guides/docs-to-rule-pack.md) and its executable
example to turn precise skill/library requirements into data packs. An assisted
converter remains a future candidate and must emit reviewable fixtures and
unsupported-claim diagnostics rather than silently activating inferred policy.

1. **Pack quality and reuse.** Machine-readable coverage/limitations; standalone
   pack testing; safe updates/removal; scoped contradictory-policy diagnostics.
   Publish only data packs whose fixtures and provenance pass verification.
2. **Editor and CI consumption.** JSON diagnostics and SARIF, actionable rule
   explanations, consistent exit codes and a complete-tree check alongside the
   ratchet. Integrate existing linters through defined ownership instead of
   duplicating their whole rule sets.
3. **Calibration loop.** Individual human labels and reviewed precision are
   implemented; see [human feedback](features/human-feedback.md). Next, connect
   reviewed false positives to regression fixtures and evaluate beneficial fixes
   on a labeled pilot corpus. Distinguish observed next edits from executed tests
   or demonstrated task completion.
4. **Language expansion.** Extend the shared parser/metric/dependency interface
   rather than cloning the gate for each language. Add Rust or another language
   only with executable rules, traps and import-resolution boundaries documented.
5. **Additional harnesses.** Add a harness only when its current native protocol
   can be tested. Post-edit-only integrations must expose their weaker guarantee
   and never silently revert unrelated user edits.

## Future releases: from frozen debt to maintainable code

Requested 2026-10-03. Detailed scope and acceptance criteria are in
[the maintainability and bulk-audit plan](features/maintainability-and-bulk-audit.md).
The later confirmed 0.2.6 scope includes these pending capabilities. Advisory
scan/refactoring plans and content/dependency-validated incremental audit with
checkpoint recovery and JSONL streaming are shipped in 0.2.6.
Parallel workers and model classification remain pending; implementation is not
publication or evidence of general maintainability.

1. **Greenfield and brownfield entry.** Detect the stack and explain executable
   coverage before activation. For existing projects, inventory current debt,
   record a reproducible baseline and prevent growth while preserving behavior.
   New projects can enforce selected policies from the first change.
2. **Guided debt reduction.** Rank refactoring candidates by measured violations,
   change frequency, dependency impact and missing verification. Offer small,
   reviewable refactoring plans with characterization tests, behavior-preserving
   checks and a debt delta. Tighten the baseline as improvements are accepted.
3. **QA and test planning.** Recommend E2E tests for critical user journeys and
   integration tests for system boundaries; recommend unit tests for isolated
   logic and edge cases. Explain the risk addressed and existing coverage gaps.
   Admit QA rules only when the engine can actually evaluate their required facts.
4. **Large-scale compliance audits.** Version 0.2.6 implements a read-only,
   resumable whole-tree audit with bounded source/cache resources, content-based
   caching and dependency invalidation. Verify representative scale and add
   parallel work over independent files. JSONL streams per-file results with final
   contract/coverage validation. Separate complete-tree debt
   from newly introduced violations and disclose unsupported or skipped files.
5. **Classification-assisted triage.** Start with deterministic classification;
   evaluate optional statistical/model-assisted techniques against a labeled
   corpus. Separate verified violations, inferred candidates and human decisions.
   Keep model execution out of the synchronous hook path and require explicit
   consent before code leaves the machine.

“100% maintainable” is the direction of improvement, not a score or certification
the engine can prove. Progress must be demonstrated by lower debt, preserved
behavior, useful tests and reduced effort on subsequent changes.

## Research requiring real evidence

Version 0.2.9 is published and globally installed.
The guided workflow verification records current
admission and post-publication research. The
[guided scan/batch approval/audit workflow](features/guided-pack-adoption.md)
is delivered; it is not pending onboarding work.

The post-release 0.2.6 record verifies installation,
dogfooding and held-out public repositories without tuning rules to their findings.
It records coverage gaps, a confirmed parser defect and bounded timings; policy
matches are not independently labeled defects. The first installed 0.2.5 public
pass and bounded parser/onboarding repairs are recorded in
the pinned audit report. Independent
labels and complete consumer calibration remain. The first paired construction
and change experiment is now recorded:
both arms pass external behavior; the treatment costs more time and produces
separate domain modules. It does not establish a general maintainability benefit;
independent review and replications remain.

The following ordered requests are shipped in 0.2.6. Their original English
requirements and evidence limits remain documented; selection alone does not
certify the corresponding product:

1. [Enterprise-ready](features/enterprise-ready-pack.md): optional pack with 57
   requirements in ten categories for a multi-tenant enterprise product.
2. [Consumer SaaS](features/consumer-saas-pack.md): optional pack with 39 requirements
   in six categories for self-service consumer products.
3. [Next.js website](features/next-website-pack.md): optional pack with 54
   requirements in eight categories, qualified by router/version/cache model.
4. [Core maintainability update](features/core-maintainability-update.md): reconcile
   the additional 48 requirements with existing core policy after all previous
   work. Preserve agnosticism and stable IDs; do not count duplicate obligations
   twice or impose an architectural style or unconditional dual-version support.
5. [Vercel platform](features/vercel-pack.md): 15 optional evidence gates in six
   methodologies, derived from official platform documentation and separate from
   Next.js rules. Version, runtime, plan and deployment conditions remain relevant;
   deployed evidence is required where source checks cannot establish compliance.

The shipped inventory has 41 optional packs and 68 default core rules. The
original 48 identities are retained. Missing project evidence is UNVERIFIED;
adding an obligation does not create proof that a consuming project satisfies it.

- Compare task completion, beneficial corrections, false positives, time and
  the cost of the next change across at least two models and two harnesses.
- Complete native interactive smoke tests on all five supported harnesses and
  Windows. Captured payloads and cross-compilation are necessary but insufficient.
- Admit broader architectural rules only when the required project facts are
  explicit. Syntax cannot prove general security, design quality or runtime
  invariants.

MCP/Forge, custom executable checkers, npm distribution, registries, daemonization
and a runtime migration remain candidates. They are not prerequisites for making
the current workflow useful. Advance a candidate when it removes a demonstrated
limitation and its maintenance/latency cost is measured. Prefer data-only packs
and the current runtime while they satisfy the supported contracts.

## Release gate

For the next patch, prioritize measured friction from published-engine onboarding,
updates and audits, and the enforcing dependency-review cost seen in dogfood.
Preserve core identities, default activation, human-reviewed contracts and
optional packs. Full native Linux/Windows admission, trusted Cursor approval
and complete dcouplr semantics still require their own evidence. A passing
synthetic benchmark does not certify larger contracts. Record remaining
platform/protocol limits explicitly; unit checks do not replace native workflows
or a real pilot outcome.
