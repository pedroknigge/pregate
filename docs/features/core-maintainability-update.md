# Core maintainability requirements

Requested on 2026-10-05 and included in 0.0.8, after the paired experiment
and the ordered optional packs. Exact macOS artifact verification passes;
native Linux/Windows validation remains deferred. These are enforcing
project-evidence obligations, not assertions that any product meets them.

Core **0.0.1** keeps that same 68-rule default set: 64 project obligations and
four enforcing change guards. The marker guards now use supported-source comment
tokens, preserving real directives while admitting strings, JSON and documentation
examples. Generated Markdown requires a genuine HTML comment outside code examples;
unsupported executable source stays conservative. See the
marker contract and controls.
The requirement statements and IDs do not change in this patch.

The following 48 English requirements in nine categories are additional input
for that review. They do not replace or defer the original
[48 original requirements](../inputs/core-invariants-48.md). They do not
create 48 duplicate IDs: 32 requests extend or reuse existing obligations and 16
add distinct obligations. Core now has 64 project obligations and four general
change guards, all 68 active by default.

An invariant is a condition the product must satisfy at all times. A false rule
makes a future change costly or unsafe. The purpose is to keep the product
maintainable and able to change without a rewrite. A rule is complete only when
a test, lint, metric or record shows evidence for it.

## Reconciliation and implementation acceptance

- Map every requested requirement to an existing invariant, a justified update,
  or a new invariant. Preserve traceability and stable IDs; do not count the same
  responsibility, effects, secrets or migration obligation twice.
- Keep the core language/framework/pattern independent. Implement evidence
  evaluation in the core; put language parsing, named architectural layers and
  library/pattern conventions in selected packs and project verification.
- The requested domain-layer rules (4, 6, 7) express ownership of business
  decisions. Do not require a folder called `domain`, a framework or an
  architectural style for every product. Review the ownership contract and
  detect actual leakage with project facts.
- Reconcile public version/deprecation rules (8–11) with original CORE-INV-031:
  externally consumed contracts need explicit compatibility, while consumers
  controlled together can migrate together. Do not impose permanent dual-version
  support on an internal contract without a real consumer/deprecation window.
- Interpret dependency pinning/lockfiles and time/money/locale libraries through
  the actual ecosystem. Do not require an npm lockfile in Go/Rust or add a new
  library when its supported standard facilities meet the requirement.
- Bind fix windows, update schedules, supported runtime status and records to
  dated authoritative evidence. No invented universal schedule, vulnerability
  feed result or runtime support claim.
- Verify critical paths, before-fix regressions, merge gates, rollback, controlled
  flags, deployment and architecture fitness with actual workflows/assertions.
  Verify documents, ownership and freshness where a record is required.
- Preserve the original simplicity/observed-change precedence: do not force a
  distributed scaling mechanism, flag system or speculative abstraction where
  there is no relevant risk or demonstrated bottleneck.
- For each admitted change, document applicability, evidence and limits, add
  useful invalid/bypass controls and observe a consuming project. All core rules
  activate by default, with explicit reviewed user deactivation still supported.
  Missing evidence is not a pass.

## Requirement reconciliation

Each row refers to the numbered request below. `Reuse` identifies an existing
obligation; `Extend` identifies an additional condition that its current wording
does not fully require; `Add` identifies a distinct obligation. These are proposed
implemented mapping decisions, not passing project checks or project admission.
Related references use the original `CORE-INV-001`–`CORE-INV-048` identities.
The enforcing obligation column identifies the actual generated owner of each
request. Its complete statement includes the applicable additional conditions.

An existing requirement is not verified merely because a row maps to it. The
evidence column describes what must be evaluated in a consuming project; it does
not assert that PREGATE or another project already supplies that evidence.

| Request | Action | Enforcing obligation | Related original requirements | Evidence needed |
| ---: | --- | --- | --- | --- |
| 1 | Reuse | CORE-INV-007 | CORE-INV-007 | Module responsibilities, change reasons and dependency checks against that ownership. |
| 2 | Extend | CORE-INV-002 | CORE-INV-002, CORE-INV-005 | Observed change history and a controlled change showing unrelated modules remain independent. |
| 3 | Reuse | CORE-INV-003 | CORE-INV-003 | Declared public contracts and dependency checks that reject internal access. |
| 4 | Reuse | CORE-INV-024 | CORE-INV-001, CORE-INV-024 | A project-defined owner of business decisions and checks of decision/effect boundaries. |
| 5 | Extend | CORE-INV-015 | CORE-INV-015 | Module-boundary mutation and aliasing controls, including boundaries inside one process. |
| 6 | Reuse | CORE-INV-024 | CORE-INV-001, CORE-INV-024 | UI adapters delegate decisions; boundary tests and source/graph checks reject decision leakage. |
| 7 | Reuse | CORE-INV-024 | CORE-INV-001, CORE-INV-024 | Persistence adapters apply domain decisions; checks reject business decisions inside database clients. |
| 8 | Extend | CORE-INV-031 | CORE-INV-031 | An inventory of public consumers and the version attached to each exposed contract. |
| 9 | Extend | CORE-INV-031 | CORE-INV-031 | A contract comparison and release gate showing that an incompatible public change increments its version. |
| 10 | Extend | CORE-INV-031 | CORE-INV-031 | A current published deprecation policy with scope, notice and supported windows. |
| 11 | Extend | CORE-INV-031 | CORE-INV-031 | Previous-version contract tests throughout the applicable deprecation window. |
| 12 | Reuse | CORE-INV-003 | CORE-INV-003 | Public export and payload checks reject internal representations and types. |
| 13 | Extend | CORE-INV-003 | CORE-INV-003, CORE-INV-004 | A written boundary contract compared with implementation and observable behavior. |
| 14 | Add | CORE-INV-049 | — | Ecosystem-specific dependency manifests resolve to explicitly pinned versions. |
| 15 | Add | CORE-INV-050 | — | The ecosystem's committed dependency lock and a reproducible locked build. |
| 16 | Add | CORE-INV-051 | — | An owned update schedule and dated update records. |
| 17 | Add | CORE-INV-052 | — | Current vulnerability evidence, the project's fix window and a failing build control for an overdue high-risk defect. |
| 18 | Reuse | CORE-INV-028 | CORE-INV-003, CORE-INV-024, CORE-INV-028 | External-service adapter contracts and dependency checks that isolate the provider. |
| 19 | Reuse | CORE-INV-028 | CORE-INV-028, CORE-INV-030 | A provider substitution that preserves domain behavior without rewriting domain decisions. |
| 20 | Add | CORE-INV-053 | — | Declared runtime versions, dated authoritative support evidence and a rejection control for an unsupported version. |
| 21 | Reuse | CORE-INV-048 | CORE-INV-048 | Schema changes paired with executable, repeatable migrations. |
| 22 | Extend | CORE-INV-048 | CORE-INV-048 | A tested reverse migration or a reviewed forward-only recovery plan. |
| 23 | Extend | CORE-INV-048 | CORE-INV-031, CORE-INV-048 | Mixed-version rollout tests reading retained old-format data. |
| 24 | Reuse | CORE-INV-036 | CORE-INV-024, CORE-INV-036 | Configuration ownership and checks that reject environment values embedded in implementation. |
| 25 | Add | CORE-INV-054 | — | Named supported time, money and locale facilities, with precision/time-zone/locale controls appropriate to the product. |
| 26 | Extend | CORE-INV-044 | CORE-INV-029, CORE-INV-044 | An owned critical-path inventory mapped to automated behavioral assertions. |
| 27 | Extend | CORE-INV-029 | CORE-INV-029 | An enforced merge workflow and a failed-test control that prevents merge. |
| 28 | Add | CORE-INV-055 | — | A regression assertion that fails on the affected pre-fix revision and passes with the defect fix. |
| 29 | Add | CORE-INV-056 | — | An enforced static-analysis merge gate and a violating-change rejection control. |
| 30 | Extend | CORE-INV-029 | CORE-INV-029 | Key architecture obligations mapped to executable fitness checks and violating-change controls. |
| 31 | Add | CORE-INV-057 | — | A release-specific rollback procedure and observed recovery of code and compatible data. |
| 32 | Add | CORE-INV-058 | — | Identified risky features, controlled flag behavior and safe enable/disable tests. |
| 33 | Add | CORE-INV-059 | — | A versioned deployment workflow and an observed automated deployment. |
| 34 | Reuse | CORE-INV-036 | CORE-INV-024, CORE-INV-036 | An explicit configuration boundary and configuration changes that require no source edits. |
| 35 | Extend | CORE-INV-047 | CORE-INV-028, CORE-INV-030, CORE-INV-047 | A measured bottleneck and a scoped scaling change with retained domain contracts and budget checks. |
| 36 | Extend | CORE-INV-043 | CORE-INV-020, CORE-INV-043 | Failure-path tests asserting structured, classified diagnostics without secret disclosure. |
| 37 | Extend | CORE-INV-043 | CORE-INV-043, CORE-INV-047 | Instrumented latency, error and saturation measures, including controlled load and failure observations. |
| 38 | Add | CORE-INV-060 | — | An inventory of common operational tasks and exercised runbooks for those tasks. |
| 39 | Add | CORE-INV-061 | — | Alert configuration mapped to a current accountable owner and a tested notification route. |
| 40 | Add | CORE-INV-062 | — | Architecture decisions with rationale and traceability to the implemented decision. |
| 41 | Extend | CORE-INV-003 | CORE-INV-003 | Public-contract documentation checked against the current interface and behavior. |
| 42 | Add | CORE-INV-063 | — | A clean-environment build and startup using only the written onboarding steps. |
| 43 | Add | CORE-INV-064 | — | A technical-debt register with an accountable owner and target date for each item. |
| 44 | Reuse | CORE-INV-037 | CORE-INV-037 | Reachability/configuration evidence and a change that removes confirmed dead paths. |
| 45 | Reuse | CORE-INV-007 | CORE-INV-007 | A function-level responsibility assertion, with a control that mixes independent decisions. |
| 46 | Extend | CORE-INV-018 | CORE-INV-018, CORE-INV-033 | A module naming policy and checks against its declared vocabulary and behavior. |
| 47 | Reuse | CORE-INV-024 | CORE-INV-024 | Effect inventory and boundary checks that reject hidden I/O, state, clock or random effects. |
| 48 | Reuse | CORE-INV-040 | CORE-INV-040 | Source/artifact secret checks with canary controls and an explicit external configuration channel. |

During implementation, preserve every added condition in an enforcing obligation.
Related IDs in this table do not imply that their current checks already enforce
that condition. Applicability and any conflict with the original compatibility,
simplicity or observed-change rules require an explicit review; they cannot be
resolved by silently omitting a request or returning a pass without evidence.

## Requested invariant rules

### Boundaries

1. Each module has one responsibility.
2. A change in one module does not force a change in an unrelated module.
3. Modules talk only through a stable interface.
4. Business rules live in the domain layer.
5. The product does not share mutable state across a module boundary.
6. The user interface does not contain a business rule.
7. The database client does not contain a business rule.

### Interfaces

8. A public interface has a version.
9. A breaking change increments the version.
10. The product has a written deprecation policy.
11. The product supports the previous public version during the deprecation window.
12. The product does not expose an internal type on a public boundary.
13. A contract at a boundary is written and current.

### Dependencies

14. The product pins each dependency version.
15. The build uses a lockfile.
16. The product updates dependencies on a stated schedule.
17. The build fails if a known high-risk defect stays past the fix window.
18. An external service sits behind an interface.
19. The product can replace that service without a rewrite of the domain.
20. The product does not depend on an unsupported runtime.

### Data

21. A schema change has a migration.
22. A migration is reversible, or the plan states that it is forward-only.
23. The product can read old data during a rollout.
24. The product does not hard-code an environment value in source.
25. Time, money, and locale use a standard library.

### Tests

26. Each critical path has an automated test.
27. Tests run before a merge.
28. A defect fix adds a test that fails before the fix.
29. Static analysis runs before a merge.
30. A fitness check guards each key architecture rule.

### Change

31. A release has a rollback.
32. A risky feature can ship behind a flag.
33. A deployment is automated.
34. Configuration is separate from code.
35. The product can scale a bottleneck without a full rewrite.

### Observability

36. A failure writes a structured log.
37. The product measures latency, errors, and saturation.
38. A common operational task has a runbook.
39. An alert has an owner.

### Knowledge

40. An architecture decision has a written record and a reason.
41. A public interface has current documentation.
42. A new engineer can build and run the product from the written steps.
43. Technical debt has an owner and a target date.
44. Dead code is removed.

### Code

45. A function does one job.
46. A name in a module follows one rule.
47. The product does not hide a side effect.
48. A secret does not live in source code.

The supplied set contains 48 requests. `scripts/core-invariants.ts` preserves
their exact source text and stable mapping together with the original 48.
The generated methodology and checks enforce receipt admission for all 64
obligations. Their 320 declarative fixtures test current/missing/failed/stale
evidence, not all product semantics. Actual behavior, records, authenticity,
coverage and freshness need reviewed project verifiers and invalid controls.
