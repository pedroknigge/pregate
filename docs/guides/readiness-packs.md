# Adopt product readiness requirements

0.0.2 includes these optional preview packs. They use the
language-independent fitness gate; they do not claim that syntax proves product
readiness. Requirements stay individually identifiable in audit and rule references.

| Pack | Methodology | Rules | Categories |
| --- | --- | ---: | --- |
| enterprise-ready | `enterprise-ready/readiness` | 57 | Identity; access control; tenant isolation; audit; data protection; reliability; secure development; operations/change; integration; commercial/support |
| consumer-saas | `consumer-saas/readiness` | 39 | Account; privacy/data rights; security; payments; reliability/support; legal/product |
| next-website | `next-website/readiness` | 54 | Rendering; server/client boundary; data/cache; routing/errors; security; metadata; assets/performance; build/access |

The [design-invariants pack](../features/design-invariants-pack.md) is separate
from those three. It has ten methodologies and 48 evidence gates for supplied
statements that core does not already own. Select only the methodologies that
apply. Its ledger maps the other supplied statements onto active core invariants.

The complete original requests and acceptance evidence appear in their feature
guides: [enterprise](../features/enterprise-ready-pack.md),
[consumer](../features/consumer-saas-pack.md), [Next.js](../features/next-website-pack.md),
[design invariants](../features/design-invariants-pack.md).
Generated pack references list every ID, requirement, provenance, repair and limit.
The 750 declarative fixtures verify receipt admission, failure and stale inputs.
They do not test 150 independent production behaviors.

## Select and audit

Select only the products you operate. Put all chosen sources and methodologies
in one [batch plan](../features/guided-pack-adoption.md), then run
`pregate pack apply plan.json --preview` and review one displayed digest. For
individual rule selection, use `pack enable <methodology> --only <ID,ID> --preview`.
Core requirements remain active independently of these optional selections.
Initial optional shadow policy is preserved; enforcing a selected assertion
requires an explicit reviewed enforcement override or enforcing preset.

Run `pregate audit --json` to inventory the current code and fitness requirements.
An unbound rule is unverified, not a confirmed code defect or a readiness pass.
Choose a small set of meaningful verifiers and adopt them through the
[project-fitness workflow](../features/project-fitness.md). Identical command,
input and timeout sets run once while preserving each requirement's rationale.

## Evidence worksheet for each rule

For each stable ID, record its applicability, accountable owner, product paths,
environment, assertion command, negative control, evidence source and expiry.
Put this scope and its omissions in the reviewed binding's rationale. Its inputs
must include the verifier, assertions, relevant policy/evidence documents and
configuration dependencies. Use `fitness fingerprint` for the verifier checksum.
Set `maxAgeMs` when time or external deployment facts matter; rerun after changes.
The verifier must validate the age and authenticity of external records itself.
A receipt cannot detect remote drift between runs.

| Requirement family | Necessary product evidence and negative controls |
| --- | --- |
| Identity/accounts | Offered protocols and login/reset/revocation flows; rejected wrong-tenant configuration, disabled users, expired tokens and missing administrator MFA. |
| Access/isolation | Direct read/write/export and organization-switch assertions; unauthorized roles, another tenant/user, stale sessions and forbidden self-approval must fail. |
| Audit/observability | Actual action-to-record assertions, actor/action/target/time, access/export scopes and retention/integrity policies; another tenant and forbidden mutation must fail. |
| Privacy/commercial/legal | Reviewed data inventory matched to collection, consent, exports, deletion and processors; applicable jurisdictions, valid retention and deadlines. Exercise withdrawal/deletion/payment flows rather than verifying a document filename. |
| Encryption/secrets/deployment | Effective deployment/configuration and controlled transport/storage/session/header assertions; wrong endpoint/environment, public secrets and insecure alternatives must fail. |
| Reliability/operations | Owned targets and budgets, observed restore/recovery/rollback, health/status and notification behavior; failed backups, stale drills or incompatible data must reject readiness. |
| Secure development | Scan/fix schedule and current authentic scoped external attestation when applicable; expired, unrelated or unverifiable records must fail. The pack cannot issue SOC 2 or ISO certification. |
| Integration/payments | Actual provider contracts and failure/retry/idempotency controls; duplicate/reordered events, canceled plans and unauthorized import/export must fail. |
| Next.js boundaries/build | Installed-version production build and import/boundary assertions; secret/client leakage, nonserializable values, unauthorized actions, route conflicts and failed server-only admission must fail. |
| Next.js browser/performance | Designated primary pages, devices and sample conditions; measure LCP/CLS, keyboard access, meaningful alt text and claimed contrast. A component import alone does not prove those results. |

Conditional requirements keep their conditions: offered social login, customer
certification requirements, law-dependent deadlines/age limits, indexability,
claimed languages/accessibility and the selected Next.js cache/router model.
A reviewed non-applicable decision can disable that rule with an explanation;
it must not manufacture passing evidence. Review interacting retention/deletion
and compatibility obligations explicitly.

## Repair and prove the gate

Run adopted verifiers, inspect failed assertions and fix behavior. Changed source
invalidates receipts; changed verifier definitions need review before execution.
An enforcing failed/unverified binding blocks check and Stop. Other requirements
remain unverified until evidence exists, so audit can correctly return incomplete.
The [bounded isolation example](../examples/readiness-verification/README.md)
demonstrates actual cross-tenant/user failure and repair. It is not a calibrated
enterprise, consumer or Next.js deployment and proves only its named paths.
