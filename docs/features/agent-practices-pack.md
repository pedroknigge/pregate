# Agent practices pack

Included in 0.0.9.
See [v0.0.1 release notes](../releases/0.0.1.md) before selecting it from an installed catalog.

An optional preview pack derived from four user-supplied posts on 2026-10-07.
The posts have no author, URL or publication date in the supplied material;
their claims are input for project policy, not independent authority. The pack
contains 22 language-independent project-evidence obligations in four separately
selectable methodologies. It changes neither core defaults nor existing presets.

Read the [pack README](../../packs/agent-practices/README.md),
[rule reference](../../packs/agent-practices/REFERENCE.md) and
[project-fitness contract](project-fitness.md). The [documentation index](../README.md)
is the project hub. `bun scripts/readiness-packs.ts` owns the generated manifests,
checks and receipt fixtures; this document owns their requirements.

## Interpretation and provenance

| Post | Selected policy | Adaptations and existing coverage |
| --- | --- | --- |
| Six launch/legal traps | `agent-practices/launch-safety`, PRACTICE-001–006 | Apply laws by jurisdiction, audience, processing and offering. No fine schedule, universal age gate, automatic refund claim or legal certification. Existing `consumer-saas/readiness` covers broader consent, billing and age obligations; these rules add focused evidence criteria. |
| Google Mantis | `agent-practices/security-review`, PRACTICE-007–012 | Tool-independent threat model, triage, isolated reproduction, patch verification and reviewed report. This pack does not install, invoke or bundle Mantis. |
| AGENTS.md design principles/invariants 10–12 | `agent-practices/domain-ownership`, PRACTICE-013–016 | Preserve ownership, public contracts, consolidation and rendering boundaries without imposing Python/Flask paths on every stack. General SRP, KISS/YAGNI, composition, Demeter and fail-fast policies already live in `maintainability/engineering`, `maintainability/future-humans`, `pstack/principles` and `architecture` methodologies. Compose selectively instead of restating every principle. |
| Testing strategy | `agent-practices/behavior-testing`, PRACTICE-017–022 | Define behavior before implementation; favor realistic E2E for integrated features while retaining focused tests for isolated logic. No universal ban on tests written after code. Regression tests fill demonstrated gaps. `testing/tdd`, `maintainability/FH-61`, `maintainability/FH-64` and `mattpocock/testing` provide complementary coverage. |

When two selected design constraints conflict, record the concrete tradeoff and
why the chosen boundary costs less to maintain in the change description or
commit. Do not impose a refactor of an unrelated domain on a small change.
Existing rules are independently selectable; this pack does not auto-adopt them.

Authoritative launch sources checked 2026-10-07:

- [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions): applicability depends on child-directed services or actual knowledge in general-audience services. An age screen alone is not the complete protection or a universal signup requirement.
- [BayLDA FAQ on external fonts](https://www.lda.bayern.de/de/faq.html): self-hosting is recommended; external fonts require assessment of processing, disclosures and applicable transfers. This pack selects self-hosting as its default policy, allowing a documented reviewed exception.
- [FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business): commercial messages need sender identification, a postal address and effective opt-out handling; classification matters for transactional messages.
- [California DOJ automatic-renewal guidance](https://oag.ca.gov/node/608083): consent, notices and cancellation depend on the applicable offer. Showing terms beside consent is selected checkout policy; this pack makes no automatic damages or refund claim.
- [Copyright Office DMCA FAQ](https://www.copyright.gov/dmca-directory/faq.html): agent designation and renewal are only part of the conditions for a relevant safe harbor. Applicability must be assessed before registration.

Session replay is a selected privacy policy inspired by the post, not a legal
determination about CIPA. Consent and masking do not establish compliance with
every recording law. Review the actual SDK, captured data, applicable laws and
deployment before enabling it. No penalty amounts from the post are retained.

Security provenance: [Mantis README](https://github.com/google/mantis/blob/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80/README.md),
[reproduce skill](https://github.com/google/mantis/blob/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80/mantis-reproduce/SKILL.md) and
[patch skill](https://github.com/google/mantis/blob/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80/mantis-patch/SKILL.md),
reviewed 2026-10-07. The upstream warns that generated code needs a restricted
environment and that reproduction results still need expert verification. The
policies below paraphrase that workflow; they do not copy its skills or depend
on its commands or harness.

## Evidence and acceptance

Each adopted binding must declare applicability, owner, scope, evidence source,
verification inputs and any external-evidence freshness limit. Reviewed
inapplicability needs evidence of the absent offering or jurisdiction; a command
that always succeeds is insufficient. Assertions need a violating control, and
external legal/security records need authenticity and revision checks. Use
`maxAgeMs` for records that can change independently of source code.

The fitness receipt gate does not create a sandbox. Before binding generated
PoC execution, supply and verify the restricted executor described by rule 009;
neither a passing receipt nor a separate Git worktree establishes isolation.

| Rules | Project assertion and rejected control |
| --- | --- |
| 001 | Review audience/data inventory and exercise the applicable restricted-age or parental-consent flow. Reject a direct API bypass and premature collection. Do not collect dates of birth unnecessarily. |
| 002 | Inspect browser requests from the built pages, including CSS imports, preload/preconnect hints and third-party themes. Reject an unexpected font-provider request even if source imports look local. |
| 003 | Inspect SDK requests and payloads on initial load, consent refusal/withdrawal and sensitive/dynamically inserted inputs. Reject recording before consent or unmasked synthetic secrets. |
| 004 | Render every commercial template and follow its opt-out path through queued/retried deliveries. Reject missing address/opt-out, broken links and sends after suppression; review mixed transactional/marketing content. |
| 005 | Exercise the actual checkout at supported viewport sizes and trial/paid plans; check terms at consent, recorded acceptance and cancellation behavior. Reject hidden terms or a charge without required consent. |
| 006 | Verify the relevant legal review, public agent contact, directory record and current renewal evidence; exercise the applicable notice/takedown process. Reject an expired designation or an absent operational process. |
| 007–008 | Review assets, trust boundaries, entry points, attacker capabilities and each finding's concrete path/preconditions. Reject an invented path or an unreviewed severity; inability to reproduce is inconclusive. |
| 009 | Inspect the effective sandbox configuration and attempt denied access using harmless canaries. Reject access to host secrets, production credentials/services, sensitive mounts or internal networks. A worktree is not a sandbox. |
| 010–011 | Retain scoped commands, versions, synthetic inputs and before/after results; replay the original PoC after the patch and exercise legitimate behavior. Reject a modified exploit that hides the original failure or a patch that breaks valid access. |
| 012 | Check each reported finding against reviewed evidence and patch status; unresolved/unreproduced items remain explicit. Reject a report that treats scanner output as confirmed or claims all risks are closed. |
| 013–014 | Compare the domain/rules owner map with actual callers, imports and storage access. Reject a second owner or a cross-module private cache/table read. Documents alone do not prove encapsulation. |
| 015 | Search all affected expressions/callers, compare results before and after consolidation, including rounding/guards/clamps and representative domain outputs. Reject a surviving undeclared copy or a changed result in the refactor stage. |
| 016 | Trace pricing/classification/access decisions through presentation and routes to their owner. Reject an independent template, browser or view-builder decision; display formatting and application orchestration are allowed. |
| 017–018 | Review the pre-implementation acceptance/failure analysis and map concrete risks to test cases. Reject an isolated-system plan that lists only the happy path. Ordering requires task/revision evidence, not current test files alone. |
| 019–020 | Run representative multi-step scenarios with realistic state and dependencies; retain sanitized logs/traces/results, revision, environment, seed and replay command. Reject a trivial-only suite or a report that cannot be reproduced. |
| 021–022 | Mutate relevant behavior or replay the original bug to check assertion sensitivity. Reject copied production calculations, self-comparison or implementation-only snapshots; reuse an existing test when it already exposes the regression. |

These are acceptance criteria for consuming projects, not bundled product tests.
The 110 receipt fixtures test admission of current, missing, failed and stale
verification evidence. They do not demonstrate legal compliance, safe sandboxing,
architecture semantics or the quality of a consuming project's test suite.
Unbound requirements remain **UNVERIFIED**. A selected enforcing binding needs
current passing evidence at Stop/commit/CI; no new engine primitive is introduced.

## Requested invariant rules

### Launch safety

1. Before collecting personal data in signup, the product must have a reviewed audience and jurisdiction assessment and enforce any applicable child-access restrictions or parental-consent requirements at the server boundary; an age gate alone must not be treated as COPPA compliance.
2. Browser font delivery must use self-hosted assets by default; any third-party font requests must have an explicit reviewed privacy/transfer basis and matching disclosures, verified against the built application's actual network traffic.
3. Session replay must remain disabled unless its actual collection has been reviewed; enabled replay must enforce the applicable consent policy before capture, stop on withdrawal and exclude sensitive inputs and payloads, including dynamically added fields.
4. Every commercial email must include the applicable sender identification, valid postal address and working opt-out mechanism, and deliveries must honor suppression within the applicable deadline; transactional classification must match the actual content.
5. Subscription checkout must show the price, billing interval, renewal and trial-conversion terms clearly beside the request for consent, record the required affirmative acceptance and provide the applicable cancellation and renewal-notice behavior.
6. When a user-content service relies on a DMCA safe harbor requiring an agent, it must have a reviewed applicability decision, current agent designation and public contact, plus the applicable notice/takedown and repeat-infringer process; registration alone must not be treated as safe-harbor certification.

### Security review

7. A scoped security review must use a threat model tied to the current code and deployment assumptions, identifying protected assets, trust boundaries, entry points and attacker capabilities before prioritizing vulnerability research.
8. Each candidate security finding must be triaged against a reachable code path and explicit exploit preconditions, with evidence, impact and uncertainty reviewed before it is labeled confirmed; failed reproduction alone must not label it a false positive.
9. Generated exploit and patch-verification code must execute only in an isolated restricted environment with synthetic data, no production credentials or sensitive host access, and explicitly bounded filesystem, network and resource permissions.
10. Each attempted vulnerability reproduction must retain the scoped reproducer, versions, commands, preconditions and observed results so another reviewer can replay it safely; inconclusive and environment-limited outcomes must remain explicit.
11. A security patch must be checked against the original reproducer to show the attack no longer succeeds, with legitimate behavior and relevant regression coverage verified in the same restricted environment before the finding is marked fixed.
12. A final security report must trace findings to reviewed evidence and patch status, separate confirmed, unconfirmed and unresolved risks, and receive qualified human review before external reporting; it must not claim that a scan proves the absence of vulnerabilities.

### Domain ownership

13. Each business rule must have one declared owning domain module and rules document, and new callers must use that owner; a new owner requires an explicit domain-boundary justification rather than a dependency-cycle workaround.
14. Cross-module access to a domain's state, tables and caches must go through its public contracts; domain operations must accept and return plain domain values without importing delivery-framework request, response or template objects.
15. Before introducing a second use of a business rule, schema fact or repeated UI piece, identify its existing copies and consolidate the affected callers in a separately verifiable behavior-preserving stage; preserve guards, rounding and clamps and document any remaining copies before changing behavior.
16. Templates, client presentation code, routes and view builders must display or orchestrate values supplied by the domain owner instead of independently computing business prices, classifications or access decisions; authoritative access decisions must be enforced at a trusted server boundary.

### Behavior testing

17. Before implementing nontrivial behavior, define its observable acceptance cases and expected failures; use those cases to guide the implementation rather than deriving expectations from the finished code, without forbidding later tests that close a real gap.
18. Before designing tests for an isolated subsystem, enumerate credible boundary, dependency, invalid-input and state-transition failures and map the applicable risks to assertions before implementing it.
19. Complex integrated features must be verified primarily through representative end-to-end user or system scenarios with realistic state, multiple steps and relevant failure/retry cases; focused unit and integration tests remain appropriate for isolated contracts.
20. End-to-end verification must emit a reviewable sanitized artifact containing results, revision, environment and replay inputs/commands, with traces or logs sufficient to reproduce failures without exposing secrets or personal data.
21. Tests must assert independently specified observable behavior and react to relevant behavioral faults; self-comparisons, duplicated production calculations and implementation-only change detectors must not stand in for behavioral verification.
22. A bug fix must demonstrate the original failure and its corrected behavior using existing behavioral coverage where sufficient; add a focused regression test only when that coverage leaves a documented real gap.
