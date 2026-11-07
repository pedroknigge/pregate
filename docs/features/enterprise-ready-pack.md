# Enterprise-ready pack

Included in 0.0.4. This optional preview pack contains 57 project evidence gates.
Gate fixtures and a bounded
isolation example pass; a real enterprise product has not been certified.

The requested optional pack is `enterprise-ready`. It is separate from the 68
default core rules. Its scope is a multi-tenant product that an enterprise customer
can buy and operate. An invariant is a condition the product must satisfy at all
times; a false applicable condition means the product is not enterprise-ready.
A rule is complete only when the product can show evidence for it.

The full user-supplied English requirements are preserved below: **57 rules in
10 categories**. Each has a distinct `ENTERPRISE-NNN` gate, selectable through
`enterprise-ready/readiness` or `pack enable --only`. The gate enforces an adopted
project assertion; it is not an attestation. Conditional clauses remain conditional; the ISO 27001 requirement
applies when the customer requires it. HIPAA, FedRAMP, PCI DSS and DORA apply only
when the customer domain requires them, through separately selected domain policies.

## Evidence and implementation acceptance

- Implement all 57 as independently identifiable enforcing rules in an optional
  pack. Preserve their meaning and explicit conditions; do not replace them with
  weaker code-name patterns or count a manifest as product compliance.
- Specify applicability, owner, scope, evidence type and freshness per rule.
  Missing, failed or stale applicable evidence must remain unverified or failed.
  A conditional exception needs reviewed applicability, not an unexplained pass.
- Use actual behavioral contracts for isolation, identity/access revocation,
  separation of duties, audit access, webhooks and import/export. Test multiple
  organizations, negative permissions and cross-tenant attempts, including
  state changes and organization switching.
- Verify deployment/configuration for TLS, encryption, secrets, environment
  boundaries, redundancy, flags, health and telemetry. Show the controlled
  release/rollback and restore/drill outcomes. Source syntax alone is insufficient.
- Use reviewed, scoped and current documents for SLA/RPO/RTO, regions,
  subprocessors, retention, security practices, support, contracts and external
  attestations. A filename or a claim in README does not certify its content.
  Never generate or pretend to issue an external certification.
- Add valid, invalid and bypass/expiry controls for the evidence gates and the
  underlying project assertions. Receipt-shape tests must be distinguished from
  actual product behavior. Audit must report applicability and evidence gaps.
- Reconcile audit immutability, stated retention and data-deletion scope explicitly
  for the product. Preserve each requirement rather than silently assuming that
  one cancels another. Require bounded reviewed policy where requirements interact.
- Document categories, rules, selection, evidence binding, audit/repair workflows
  and limits; update the companion reference. Calibrate on a consuming product
  before making complete coverage or readiness claims.

## Requested invariant rules

### Identity

1. The product supports single sign-on with SAML 2.0.
2. The product supports single sign-on with OpenID Connect.
3. Each customer organization has its own identity-provider configuration.
4. The product supports SCIM for user create, update, and disable.
5. The product removes access when the identity provider disables the user.
6. The product enforces multi-factor authentication for administrator accounts.
7. The product supports just-in-time user creation at first sign-on.

### Access control

8. The product uses role-based access control.
9. The product applies the least-privilege rule by default.
10. A user receives only the permissions of the active organization.
11. The same person cannot request and approve a controlled action when policy forbids it.
12. Customer administrators manage users and roles in their organization.
13. The product records every permission change.

### Tenant isolation

14. One customer cannot read or change the data of another customer.
15. Sessions, roles, audit logs, and billing belong to one organization.
16. A user can belong to more than one organization and must switch organization to change scope.
17. Configuration for one organization does not apply to another organization.

### Audit

18. The product writes an audit record for each security-relevant action.
19. Each audit record contains the actor, the action, the target, and the time.
20. The customer can read and export only the audit records of that customer.
21. The product does not change or delete an audit record.
22. The product keeps audit records for a stated retention period.
23. The product can send audit records to the customer security system.

### Data protection

24. The product encrypts data in transit with TLS 1.2 or a later version.
25. The product encrypts data at rest.
26. The product stores secrets in a secrets store, not in source code.
27. The product supports a documented data-export request.
28. The product supports a documented data-deletion request.
29. The product states the regions where it stores customer data.
30. The product lists subprocessors and the data that each subprocessor receives.

### Reliability

31. The product has a written availability target and a service-level agreement.
32. The product defines a recovery-point objective and a recovery-time objective.
33. The product takes backups and tests restore.
34. The product has a disaster-recovery plan for production workloads.
35. The product removes single points of failure from the core path.
36. The product publishes service status and incident history.
37. The product tells customers about planned maintenance before the window starts.

### Secure development

38. The product follows a secure development lifecycle.
39. The vendor scans dependencies and fixes known high-risk defects on a stated schedule.
40. The vendor runs a penetration test at least once each year.
41. The vendor can show a current SOC 2 Type II report, or an equal attestation.
42. The vendor can show ISO 27001 certification when the customer requires it.
43. The product has a vulnerability-disclosure process.

### Operations and change

44. The product separates development, test, and production environments.
45. The product supports a controlled release and a rollback.
46. The product supports feature flags for a safe release.
47. The product exposes health checks, metrics, and structured logs.
48. An upgrade procedure and a rollback procedure exist in writing.
49. The customer can configure the product without a code change for standard options.

### Integration

50. The product provides a versioned API and a written deprecation policy.
51. The product supports webhooks with retry and idempotency.
52. The product supports bulk import and bulk export in an open format.
53. The product provides a sandbox for tests before production use.

### Commercial and support

54. The contract includes a data-processing agreement.
55. Billing is at organization level, not only at user level.
56. The product states support hours, severity levels, and response times.
57. The customer can obtain security answers from a trust page.

The minimum set contains 57 requirements. See the [pack reference](../../packs/enterprise-ready/REFERENCE.md)
and [evidence/adoption guide](../guides/readiness-packs.md) for the implementation,
scope, commands and remaining product-verification obligations.
