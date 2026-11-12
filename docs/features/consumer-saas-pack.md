# Consumer SaaS pack

Included in 0.0.8.
This optional preview pack contains 39 distinct `CONSUMER-NNN` evidence gates,
selected through `consumer-saas/readiness` or `pack enable --only`. It remains
separate from core and is not automatically selected for other products. No actual consumer product is certified.

The scope is a software product a person can buy or use without an enterprise
contract. An invariant is a condition the product must satisfy at all times.
A false applicable rule means the product is not ready for consumer use. A rule
is complete only when the product can show evidence for it.

The user-supplied English requirements below are preserved: **39 rules in six
categories**. Conditional social sign-in, law-dependent deadlines/retention/notice
and age limits, and claimed accessibility/languages/regions remain conditional.
Additional policies apply only when the product domain requires them, including
health data, children's services and stored payment data.

## Evidence and implementation acceptance

- Implement all 39 as independently identifiable enforcing rules in an optional
  pack, with applicability, owner, scope, evidence type and freshness. Do not
  weaken their meaning into a code-name check or claim a receipt proves behavior.
- Verify self-service account creation, email validation, reset, offered social
  login, session review/revocation, consent withdrawal and machine-readable export
  with actual user-flow and boundary tests, including invalid/expired tokens.
- Test cross-user privacy, abuse/rate limits, deletion completion and downstream
  processing. Inspect deployment/password/payment data handling through reviewed
  configuration and controlled assertions, without copying secrets or card data.
- Test paid-plan display, cancellation, charge/receipt behavior and repeated,
  delayed or retried payment events against the applicable provider contract.
  A cancellation button alone does not prove that future charges stop.
- Match privacy statements/processors and collection categories to an actual data
  inventory. Require the supported jurisdictions and current authoritative legal
  basis before deriving deletion, billing retention, breach notice or age limits.
  Do not invent one deadline, retention period or age threshold for every product.
- Bind availability/status, content availability, support, restore procedures,
  terms/abuse handling and promised accessibility/languages/regions to scoped
  reviewed documents and actual behavior. Files/screens alone are insufficient.
- Retain explicit review when privacy deletion, permitted billing retention,
  account suspension and active-account content availability interact. No rule
  silently cancels another or gives an unexplained conditional pass.
- Add valid, invalid and bypass/expiry controls for the evidence gates and actual
  product assertions. Audit must distinguish missing/stale evidence, a failed
  assertion and reviewed conditional applicability. Document all rules/categories,
  selection, binding, repair and limits; calibrate on a consuming product before
  claiming full coverage or readiness.

## Requested invariant rules

### Account

1. A person can create an account without a sales call.
2. The product supports sign-in with an email address and a password.
3. The product supports password reset by email.
4. The product verifies the email address before it grants full access.
5. The product supports social sign-in when it offers that option.
6. The product lets the user review and end active sessions.

### Privacy and data rights

7. The product shows a privacy policy before or at account creation.
8. The privacy policy matches the data that the product collects.
9. The product collects only the personal data that the service needs.
10. The product states each category of personal data and the reason for collection.
11. The product records consent before optional processing, such as marketing email.
12. The product lets the user withdraw consent.
13. The product lets the user export personal data in a machine-readable format.
14. The product lets the user delete the account and the personal data.
15. The product completes a deletion request within the time that the law requires.
16. The product keeps billing records only for the period that tax law requires.
17. The product lists the processors that receive personal data.

### Security

18. The product encrypts data in transit with TLS 1.2 or a later version.
19. The product encrypts personal data at rest.
20. The product stores passwords only as a salted hash.
21. The product does not store a full payment-card number on its own servers.
22. One user cannot read or change the private content of another user.
23. The product limits the rate of sign-up, sign-in, and password-reset requests.
24. The product tells the user about a breach that affects their data when the law requires notice.

### Payments

25. The product shows the price, the billing period, and the renewal rule before the user pays.
26. The product lets the user cancel a paid plan from the account settings.
27. The product sends a receipt for each charge.
28. The product does not continue a charge after a valid cancellation takes effect.

### Reliability and support

29. The product defines an availability target.
30. The product shows service status to users.
31. The product keeps the user's content available while the account is active.
32. The product provides a way for the user to contact support.
33. The product has a written procedure for backup and restore.

### Legal and product rules

34. The product shows terms of service.
35. The product can suspend an account that breaks the terms.
36. The product provides a way to report abuse.
37. The product blocks access by a child when the law requires an age limit.
38. The product supports the languages and regions that it claims to serve.
39. Primary user flows meet the accessibility level that the product claims.

The minimum set contains 39 requirements. See the [pack reference](../../packs/consumer-saas/REFERENCE.md)
and [evidence/adoption guide](../guides/readiness-packs.md) for commands, applicability
and the distinction between evidence-gate fixtures and actual product behavior.
