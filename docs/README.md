# PREGATE documentation

Use this index for the current product contract. 0.0.6 is the published release.
[v0.0.1 release notes](releases/0.0.1.md) record the first public tag, and the
[changelog](../CHANGELOG.md) records 0.0.6. Historical research is evidence for
its recorded candidate, not proof that a later candidate passes.

## Start and use the tool

- [Install, update and remove](guides/installation.md)
- [Maintenance, reproducible build and rollback](guides/maintenance.md)
- [Gate a Vercel build](guides/vercel-ci.md)
- [Try the owned language demos](guides/demo.md)
- [Use the pregate skill in your coding harness](guides/pregate-skill.md)
- [Update one or several projects](features/project-update.md)
- [Daily use: onboarding, calibration, repairs and reporting](guides/daily-use.md)
- [Rule precision and hook latency](guides/rule-precision.md)
- [Share a reviewed contract and custom packs with a team](guides/team-contracts.md)
- [Product readiness packs and evidence adoption](guides/readiness-packs.md)
- [Run the candidate verification on a colleague's Windows machine](guides/windows-verification.md)
- [Every public command and option](CLI.md)
- [Packs, categories, methodology IDs and preset recipes](packs.md)
- [Current builtin core rules](core-catalog.md)
- [Project verification and negative controls for the core requirements](guides/core-verification-matrix.md)
- [Record domain, data and performance decisions for the agent](guides/design-contract.md)

## Implemented features

- [Layers with evidence, compiling an instruction file, and promotion raised by Pregate](features/agent-proposed-contract.md)
- [Initialization and stack detection](features/initialization.md)
- [Source coverage and combined onboarding plans](features/onboarding-scope.md)
- [Pack discovery, pins and selective composition](features/pack-composition.md)
- [Optional agent-practices pack](features/agent-practices-pack.md)
- [Optional design-invariants pack](features/design-invariants-pack.md)
- [Language analysis and resolution limits](features/language-analysis.md)
- [Whole-project static audit](features/whole-project-audit.md)
- [Prepare and review project evidence in groups](features/project-fitness.md)
- [Approval inside the harness](features/approval-in-harness.md)
- [GitHub finding reports and public reproductions](features/issue-reporting.md)
- [Human labels and reviewed precision](features/human-feedback.md)
- [Turn a correction into a rule](features/rule-drafting.md)
- [Parallel agents, worktrees and branches](features/parallel-agents.md)
- [Storage, source retention, cleanup and owner recovery](features/local-storage.md)
- [Harness, shell and incomplete Stop guarantees](features/harness-and-shell-guarantees.md)
- [Native candidate verification and publication gates](features/release-verification.md)

## Author and contribute

- [Convert library documentation or skills into a rule pack](guides/docs-to-rule-pack.md)
- [Pack worksheet](guides/rule-pack-worksheet.md) and [executable example](examples/docs-to-pack/README.md)
- [Architecture and implementation decisions](ARCHITECTURE.md)
- [Harness specifications and observed capabilities](MULTI-HARNESS.md)
- [Specification and design history](SPEC.md)
- [Roadmap](ROADMAP.md) and [v0.0.1 release notes](releases/0.0.1.md)
- [Pending guided refactoring, QA and bulk/classifier work](features/maintainability-and-bulk-audit.md)
- [Interactive daily workflow](features/guided-project-workflow.md)
- [Guided scan, combined pack approval and team restoration](features/guided-pack-adoption.md)
- Notes from before the public 0.0.x line (the Kragg audit, greenfield results, and the pre-public plan) are not in this tree. A bare title in an older page is history, not a file to open.

## Documentation maintenance

`bun scripts/docs-reference.ts` generates the command synopsis, pack/category/preset
inventory, every manifest rule's defaults/provenance/repair/limits, the installed
skill's command/category section, and the README facts block (engine version,
harnesses, parsed languages, and pack inventory). `bun scripts/docs-reference.ts --check` fails
when those references differ from the CLI or manifests. CI and release builds run
this check. Change behavior, its feature guide and its verification evidence
together; regenerate after changing options or pack data.

Research and input notes keep their dates. The current feature guides and
source-generated references take precedence when an older note describes
different behavior. The following index lists those records for traceability.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Complete document index

| Document | Role |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Product/reference |
| [benchmarks/case-study-production-repository.md](benchmarks/case-study-production-repository.md) | Measurement record |
| [benchmarks/false-positives.md](benchmarks/false-positives.md) | Measurement record |
| [benchmarks/hook-latency.md](benchmarks/hook-latency.md) | Measurement record |
| [CLI.md](CLI.md) | Product/reference |
| [core-catalog.md](core-catalog.md) | Product/reference |
| [examples/dcouplr-delivery/README.md](examples/dcouplr-delivery/README.md) | Executable example |
| [examples/dcouplr-factory/README.md](examples/dcouplr-factory/README.md) | Executable example |
| [examples/dcouplr-logging/README.md](examples/dcouplr-logging/README.md) | Executable example |
| [examples/dcouplr-managed-boundary/README.md](examples/dcouplr-managed-boundary/README.md) | Executable example |
| [examples/dcouplr-observability/README.md](examples/dcouplr-observability/README.md) | Executable example |
| [examples/dcouplr-queue/README.md](examples/dcouplr-queue/README.md) | Executable example |
| [examples/dcouplr-saga/README.md](examples/dcouplr-saga/README.md) | Executable example |
| [examples/dcouplr-system-bus/README.md](examples/dcouplr-system-bus/README.md) | Executable example |
| [examples/dcouplr-utility/README.md](examples/dcouplr-utility/README.md) | Executable example |
| [examples/docs-to-pack/README.md](examples/docs-to-pack/README.md) | Executable example |
| [examples/readiness-verification/README.md](examples/readiness-verification/README.md) | Executable example |
| [features/agent-practices-pack.md](features/agent-practices-pack.md) | Product/reference |
| [features/agent-proposed-contract.md](features/agent-proposed-contract.md) | Product/reference |
| [features/approval-in-harness.md](features/approval-in-harness.md) | Product/reference |
| [features/consumer-saas-pack.md](features/consumer-saas-pack.md) | Product/reference |
| [features/core-maintainability-update.md](features/core-maintainability-update.md) | Product/reference |
| [features/design-invariants-pack.md](features/design-invariants-pack.md) | Product/reference |
| [features/enterprise-ready-pack.md](features/enterprise-ready-pack.md) | Product/reference |
| [features/guided-pack-adoption.md](features/guided-pack-adoption.md) | Product/reference |
| [features/guided-project-workflow.md](features/guided-project-workflow.md) | Product/reference |
| [features/harness-and-shell-guarantees.md](features/harness-and-shell-guarantees.md) | Product/reference |
| [features/human-feedback.md](features/human-feedback.md) | Product/reference |
| [features/initialization.md](features/initialization.md) | Product/reference |
| [features/issue-reporting.md](features/issue-reporting.md) | Product/reference |
| [features/language-analysis.md](features/language-analysis.md) | Product/reference |
| [features/local-storage.md](features/local-storage.md) | Product/reference |
| [features/maintainability-and-bulk-audit.md](features/maintainability-and-bulk-audit.md) | Product/reference |
| [features/next-website-pack.md](features/next-website-pack.md) | Product/reference |
| [features/onboarding-scope.md](features/onboarding-scope.md) | Product/reference |
| [features/pack-composition.md](features/pack-composition.md) | Product/reference |
| [features/parallel-agents.md](features/parallel-agents.md) | Product/reference |
| [features/project-fitness.md](features/project-fitness.md) | Product/reference |
| [features/project-update.md](features/project-update.md) | Product/reference |
| [features/release-verification.md](features/release-verification.md) | Product/reference |
| [features/rule-drafting.md](features/rule-drafting.md) | Product/reference |
| [features/vercel-pack.md](features/vercel-pack.md) | Product/reference |
| [features/whole-project-audit.md](features/whole-project-audit.md) | Product/reference |
| [guarantees.md](guarantees.md) | Product/reference |
| [guides/core-verification-matrix.md](guides/core-verification-matrix.md) | Product/reference |
| [guides/daily-use.md](guides/daily-use.md) | Product/reference |
| [guides/demo.md](guides/demo.md) | Product/reference |
| [guides/design-contract.md](guides/design-contract.md) | Product/reference |
| [guides/docs-to-rule-pack.md](guides/docs-to-rule-pack.md) | Product/reference |
| [guides/domain-language.md](guides/domain-language.md) | Product/reference |
| [guides/installation.md](guides/installation.md) | Product/reference |
| [guides/invariant-enforcement.md](guides/invariant-enforcement.md) | Product/reference |
| [guides/maintenance.md](guides/maintenance.md) | Product/reference |
| [guides/pregate-skill.md](guides/pregate-skill.md) | Product/reference |
| [guides/readiness-packs.md](guides/readiness-packs.md) | Product/reference |
| [guides/rule-pack-worksheet.md](guides/rule-pack-worksheet.md) | Product/reference |
| [guides/rule-precision.md](guides/rule-precision.md) | Product/reference |
| [guides/source-invariants.md](guides/source-invariants.md) | Product/reference |
| [guides/team-contracts.md](guides/team-contracts.md) | Product/reference |
| [guides/vercel-ci.md](guides/vercel-ci.md) | Product/reference |
| [guides/windows-verification.md](guides/windows-verification.md) | Product/reference |
| [inputs/core-invariants-48.md](inputs/core-invariants-48.md) | Original input |
| [MULTI-HARNESS.md](MULTI-HARNESS.md) | Product/reference |
| [packs.md](packs.md) | Product/reference |
| [releases/0.0.1.md](releases/0.0.1.md) | Product/reference |
| [releases/0.0.3-windows-report-2026-11-03.md](releases/0.0.3-windows-report-2026-11-03.md) | Product/reference |
| [releases/0.0.3.md](releases/0.0.3.md) | Product/reference |
| [releases/0.0.4.md](releases/0.0.4.md) | Product/reference |
| [releases/0.0.5.md](releases/0.0.5.md) | Product/reference |
| [releases/0.0.6.md](releases/0.0.6.md) | Product/reference |
| [ROADMAP.md](ROADMAP.md) | Product/reference |
| [SPEC.md](SPEC.md) | Product/reference |
<!-- END generated reference -->
