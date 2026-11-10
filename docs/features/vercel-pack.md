# Vercel platform pack

Included in 0.0.5: 15 optional preview evidence gates in six separately
selectable methodologies.
No live customer deployment was inspected or certified.

Base the requirements on current official Vercel documentation. Keep platform
configuration and deployment requirements separate from the existing `nextjs`
pack and the `next-website` pack. Compose those packs when applicable;
do not require Next.js for a project hosted on Vercel.

## Documentation and candidate scope

Official entry points checked on 2026-10-05:

- [Project configuration](https://vercel.com/docs/project-configuration): build,
  routing and function configuration; documented defaults and supported file
  formats. Absence of a configuration file is not automatically a violation.
- [Environment variables](https://vercel.com/docs/environment-variables): scopes,
  sensitive values and deployment behavior.
- [Deployment protection](https://vercel.com/docs/deployment-protection): actual
  protection settings and authorized access to designated deployments.
- [Managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs): invocation
  security, delivery and operational behavior.
- [Functions](https://vercel.com/docs/functions): runtime, resource and lifecycle
  constraints for the selected execution model.
- [Instant rollback](https://vercel.com/docs/instant-rollback): release recovery
  and its documented limits.

These pages were rechecked for this implementation. Record the
documentation date, installed CLI/SDK versions, framework, runtime, compute mode,
plan and deployment environment for each version-dependent requirement.

## Implementation acceptance

1. Write a provenance ledger with a stable rule ID, exact official source,
   applicability, exceptions, evidence method and repair for each requirement.
   Separate a documented platform constraint from a stricter project policy.
2. Use source/configuration checks only for facts they can establish. Validate
   the supported configuration forms without rejecting valid defaults or
   pretending a dynamic configuration's text is its evaluated result.
3. Verify deployment protection, effective environment settings, deployed
   headers, cron authorization/delivery and recovery against actual approved
   deployment evidence. Missing evidence remains unverified.
4. Preserve framework-specific behavior and plan/runtime conditions. Do not
   hard-code changing platform quotas as universal invariants.
5. Add valid, invalid and bypass fixtures; test a real consuming project and
   document false positives and supported coverage before a readiness claim.
6. Provide independently selectable methodologies, preview/review activation,
   audit locations and actionable repairs. Update the pack reference and
   packaged command documentation when executable support exists.

The pack is data-only and changes no deployment or credentials. Bind actual
assertions through the [project-fitness workflow](project-fitness.md), with
`maxAgeMs` for effective deployment evidence and explicit enforcement when
leaving optional shadow. Missing evidence remains unverified. Receipt fixtures
test the gate; they do not establish live Vercel coverage.

## Provenance and applicability ledger

All source links above are official documents, checked 2026-10-05. A platform
constraint describes documented behavior; selected policy is a stricter requirement
the project adopts, not a claim that Vercel requires it for every public site.
Retain the actual plan, framework, runtime, CLI/SDK and compute mode in evidence.

| IDs | Methodology | Basis and applicability | Evidence and rejected control |
| --- | --- | --- | --- |
| VERCEL-001–002 | `vercel/configuration` | Configuration constraint; no file is valid when defaults suffice. | Evaluate the actual chosen format/build and settings; reject multiple active formats and invalid effective output. A text-only TypeScript scan cannot evaluate dynamic config. |
| VERCEL-003–004 | `vercel/environment` | Documented environment/branch scope and deployment-specific values. | Inspect effective deployment variables without copying secrets; wrong branch/environment and an old deployment after a required variable change must fail. |
| VERCEL-005–006 | `vercel/protection` | Selected access policy and allowed exceptions/bypasses. Public production access can be intentional. | Request designated deployments with permitted and forbidden identities; reject unintended access and leaked bypass credentials. |
| VERCEL-007–009 | `vercel/cron` | Selected authorization policy plus documented overlap/best-effort delivery and no automatic failed-job retry. Applies when cron is used. | Direct unauthorized call, simultaneous calls, duplicate/missed invocation and failed job; assert admission, safe effects, recovery and observable outcome. |
| VERCEL-010–012 | `vercel/functions` | Selected execution model and its current runtime/resource/lifecycle constraints. Applies when functions are used. | Real build/deployment and bounded load/lifecycle assertions; unsupported runtime, exceeded budget and lost required background work must fail. No universal numeric quota is hard-coded. |
| VERCEL-013–015 | `vercel/recovery` | Plan-dependent eligible rollback targets and deployment/configuration behavior, plus selected recovery policy. | Controlled rollback verifies domains, retained old variables/configuration/cron behavior and compatible external data/services. Rollback must not be described as automatic database rollback. |

See the [generated rule reference](../../packs/vercel/REFERENCE.md) for each stable
ID, check, original source, repair and limits. Select all desired methodologies
in one batch plan, or individual rules with `pack enable --only`.

## Requested invariant rules

These English requirements operationalize the documentation areas above. They
are the selected pack policy; conditional mechanisms apply only when used.

### Configuration

1. A Vercel project must use at most one active file-based configuration format. A project can use the documented defaults without a configuration file.
2. The effective configuration must be valid for the selected framework and configuration format, and its production build and routing must match the reviewed settings.

### Environment

3. Each deployed environment and branch must receive only its reviewed environment-variable scope, including applicable branch overrides.
4. A required environment-variable change must be verified in a new applicable deployment; a previous deployment must not be assumed to receive the change.

### Protection

5. Each deployment must enforce the project's reviewed access policy, including intentionally public environments and approved exceptions.
6. An automation bypass must be explicitly authorized and its credential must not enter public source, client output or logs.

### Cron

7. A protected cron endpoint must check its configured secret on the server and reject a missing or incorrect authorization value before effects.
8. A cron operation must handle overlapping runs and duplicate invocations without an unintended repeated or conflicting effect.
9. A cron operation must have a policy for missed runs and failed invocations; it must not assume automatic retries or exactly-once delivery.

### Functions

10. Each function must use a runtime and configuration supported by its selected Vercel execution model.
11. Each function must keep execution duration and resource use inside the current limits and the project's reviewed budget for that plan and compute mode.
12. Required work after a response must use a supported lifecycle mechanism or durable service; a detached promise must not be assumed to complete.

### Recovery

13. The release must identify and test an eligible rollback target under its current plan and deployment history.
14. Recovery must verify the restored deployment's domains, configuration, environment variables and cron state instead of assuming current project settings replace the old build.
15. The rollback procedure must verify compatibility with current external APIs, databases and content systems; deployment rollback must not be treated as data rollback.
