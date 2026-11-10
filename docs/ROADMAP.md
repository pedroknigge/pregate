# Product roadmap

0.0.5 / core 0.0.1 is the public release. macOS ARM64 is stable. Linux and Windows
builds stay experimental until native release validation passes. See the
[v0.0.1 release notes](releases/0.0.1.md). Star counts are not an acceptance
criterion; useful activation and repeated use need actual independent users
before making adoption claims.

Latency figures from before this public line are not measurements of the 0.0.5
binaries. Re-run the benchmark in this tree before quoting a number.

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

This is a proposed distribution change. 0.0.5 still embeds the optional
packs in the engine. External discovery, selected-version cache lookup, exact
restoration and grouped migration need verification before removing those
bundled assets.

0.0.5 includes the [guided project workflow](features/guided-project-workflow.md),
multi-project updates, compact audits, and Rust source analysis. The current
inventory is [packs](packs.md). Remaining work includes native Windows and Linux
admission, a trusted Cursor human approval, persistent dependency-graph reuse,
and broader empirical maintainability evaluation. Rule fixtures do not establish
a false-positive rate ([measurement](benchmarks/false-positives.md)) or a general
maintainability certification.

## Published baseline

0.0.5 implements one interactive entry, proactive state diagnosis, a combined
setup and update review, and recovery that does not ask anyone to edit pins or
lock bytes by hand. See [v0.0.1 release notes](releases/0.0.1.md) for the first
public tag and the [changelog](../CHANGELOG.md) for 0.0.5.

Keep the existing core defaults, human approval, and the latency targets in
[ARCHITECTURE](ARCHITECTURE.md). Optional heuristic policies stay in shadow
until counterexamples support them. Explicit multi-project updates preserve
custom policy, and a current contract is a no-op.

The [project domain-language workflow](guides/domain-language.md) is available.
Unhappy-path gaps stay tracked. More packs do not replace a fix to the daily
update and scope experience.

macOS ARM64 is the stable platform. Independent native Windows and Linux
validation is still required. Shell latency that misses its target stays a miss;
do not count it as admission.

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

## Delivered in 0.0.5 and remaining limits

| Delivery | Product benefit | Release evidence |
| --- | --- | --- |
| Context-aware dependency checks | Configuration and barrel changes cannot silently weaken architecture | Pre/Stop/index/base regressions with independent baselines |
| Complete standalone mode | A user can protect a folder without first setting up Git | Real CLI and launcher workflows without Git |
| Active benchmark and measured optimization | Published timings describe work actually performed | Blocking canary, stage evidence, representative percentiles, unchanged budgets |
| Native candidate verification before publication | A supported-platform startup failure blocks release | The exact packaged Mac ARM64 archive/installer passes bootstrap and product smoke. The user permits deferring Linux/Windows native validation with experimental, partially functional disclosure and a reproducible handoff; no current certification for those targets. See [workflow and evidence](features/release-verification.md) |
| Effective status and capability matrix | A user knows whether protection is ready, active, degraded or missing | Text/JSON tests; exact rule policies and backstop state |
| Explicit incomplete Stop outcomes | Finishing a turn cannot be mistaken for passing compliance | Durable reason/cause/findings, actionable text/JSON reports, unchanged loop cap and verified repair; exact per-harness channels disclosed |
| Exact contract review | Approvals describe the code and coverage the user is accepting | Source diffs, visible invisible characters, stale-change rejection |
| Approval inside the harness | No external-terminal round trip for a normal approval | Verified human-command/native-prompt workflows in Claude Code, Codex, Grok and agy; no self-approval. Cursor's approval route is a separate human terminal |
| Optional native GitHub issue reporting | Real findings feed back into fixes and trap fixtures | Reviewed draft, human consent, minimal reproduction, deduplication and offline/auth recovery |
| Accurate coverage and quality evidence | Users can trust rule names and release notes | General nesting traps; no unsupported scores or universal guarantees |
| Whole-project compliance audit | Brownfield users can inventory existing debt and begin repairing it | Static totals, all locations, shadow/warn inclusion, unsupported/error coverage, text/JSON and Git-free workflow |
| Useful calibration and deliberate retention | Reports remain usable as histories grow | Date-scoped reads, warnings/labels, explicit code storage and safe cleanup |
| Pack discovery and selective composition | Users can take the useful part of a pack without editing internals | List/show/preview, local sources, selected methodologies/rules and conflict diagnostics |
| Simpler onboarding | The first useful protected edit takes fewer steps | Preview, detected stack, curated defaults, idempotence and actionable next commands |
| Additional languages with actual enforcement | The same workflow helps mixed repositories | Python and Go parsers, language-specific checks, syntax/import/metric fixtures and bundled binary workflows |
| Product documentation and companion instructions | The first page explains value and everyday use | Product-focused README; all public options, categories, packs and rule defaults documented; generated-reference drift check; packaged skill reflects the same candidate |
| Code-agnostic core and modular engineering policies | Users install only the language, pattern, library, practice and process policies they need | Migrate controlled consumers together; no pilot compatibility layer required; retain honest invariant/fitness coverage |
| Source-backed dcouplr enforcement | Agents cannot bypass selected construction/effect boundaries silently | Current preview has 26 syntax checks plus 56 project-evidence gates in fourteen methodologies. The pinned probe verifies 764 runtime scenarios and 78 public-type controls. Compiled application assertions reject bounded adapter/caller regressions after reviewed binding. Complete coverage and independent consumer calibration are not claimed; source probes do not certify consumer compliance |
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
Advisory scan and refactoring plans, and content-validated incremental audit with
checkpoint recovery and JSONL streaming, are included in 0.0.5.
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
4. **Large-scale compliance audits.** 0.0.5 includes a read-only,
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

0.0.5 is the published release. The
[guided scan/batch approval/audit workflow](features/guided-pack-adoption.md)
is delivered; it is not pending onboarding work.

Independent labels and complete consumer calibration remain. The first paired construction
and change experiment is recorded:
both arms pass external behavior; the treatment costs more time and produces
separate domain modules. It does not establish a general maintainability benefit;
independent review and replications remain.

The following packs ship in 0.0.5. Their original English
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
