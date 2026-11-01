# The user's 48 core invariants

Authoritative English requirements supplied by the user. This file preserves the
requested requirements; it is **not** an executable rule pack or a claim that all
48 are enforced. Track admission and missing evidence in [roadmap](../ROADMAP.md).
Stable requirement IDs are `CORE-INV-001` through `CORE-INV-048`, corresponding to
the original numbers below. Future core policy must activate its rules by default;
explicit human-reviewed deactivation is permitted. Optional packs remain separate.

This text uses Simplified Technical English (ASD-STE100). Each rule is a requirement.
"Must" means the rule is mandatory. One word has one meaning in this text.

When two rules do not agree, use the rule that decreases the cost of change on a
change that you already see. Use the simple design until a real requirement makes
a complex design necessary. Tests and measures decide. Do not use a rule as a dogma.

## 1. Boundaries and dependencies

1. Divide the system by the reason for change, not by the technology. Put in one module the parts that change together for the same reason. Do not mix display logic, decision logic, and storage logic in one module.
2. Keep related parts together. Keep unrelated parts separate. A dependency must be as small as possible. A module must not know the internal parts of another module.
3. Hide the parts that can change. The public contract must be stable. The representation, the algorithm, the storage, and the supplier must be private. A caller must depend only on the contract.
4. Each observable behavior becomes a contract. For this reason, keep each contract small.
5. Dependencies must point to the stable part. Code that changes frequently must not be a dependency of code that changes rarely. A concrete part that changes must depend on a stable abstraction. Do not do the opposite.
6. Make an abstraction only when two real implementations exist, or when a change already occurred.
7. Give each unit one reason for change. This rule applies to a function, a module, a process, and a service. If two different forces change the same unit, divide the unit.
8. Make each dependency explicit. Do not use hidden global state. Do not use hidden context. Put the dependency in the signature or in the construction graph. If a dependency is not in the signature, the caller must not use it.
9. A unit must use only the parts that it receives, the parts that it makes, or the parts that it owns. A unit must not go through the internal structure of a collaborator to reach a third unit.
10. Use composition to reuse behavior. Do not use an inheritance tree to reuse behavior. Use inheritance only for a real "is-a" relation in the domain that will not break.
11. Keep interfaces narrow. A caller must not depend on operations that it does not call. A large contract is coupling.

## 2. State, data, and invariants

12. Keep one source of truth for each fact. This rule applies to knowledge and to decisions. It does not apply to similar text. If two parts change for different reasons, you can duplicate the form.
13. Boundary validation can repeat a domain rule. The domain must not depend on the boundary. The domain must keep its own rules.
14. Do not make an invalid state possible. The domain must keep its invariants at construction and at each state change. Do not put invariants only in comments. If an order cannot ship with no lines, that state must not exist as a value.
15. Use immutable data for shared data. Data that crosses a thread, a process, or a time boundary must be a value. Keep mutation local, explicit, and short. Shared mutable data can cause a race.
16. Make time and identity data, not hidden context. Pass "now", "caller", and "version" as arguments or as parts of the message. A result must not depend on a hidden clock or on a hidden singleton.
17. Separate a command from a query when the effect is important. An operation that returns a value must not change observable state. An operation that changes state must not be the source of a value that the caller uses to decide. Exception: if the domain action is "reserve and return the quota", the effect and the result are the same decision. Document this exception.
18. Use the domain language for module names, operation names, and data names. Do not use framework names for these items. Keep technical translation at the boundary.

## 3. Effects, failures, and distribution

19. Fail immediately when an invariant is broken or when the configuration is unknown. Report an impossible state, an unknown flag, or a broken contract at the source. Do not continue with a silent default. A silent default turns a defect into later corruption.
20. Separate a programmer failure from an expected failure. Stop and record a programmer failure. For an expected failure (timeout, rate limit, network loss, dependency down), use an explicit policy: retry, degrade, or reject. Do not retry a validation error. Do not retry an effect that is not idempotent.
21. Each operation that can run more than one time must be idempotent, or it must have an idempotency key. Queues, webhooks, clients with retry, and jobs that stop in the middle deliver the work at least one time. Do not promise global exactly-once delivery. Build "one effect for this key" with a unique constraint and a stored result.
22. Do not trust a remote part. Each call outside the process must have a timeout, a retry limit, and a defined behavior when the peer does not answer. Without a timeout, there is no isolation. The failure of the peer becomes your failure.
23. Do not let a failure cascade. A boundary must isolate the failure with a budget, a bulkhead, a fast reject, or a queue. Do not retry without a limit against a dependency that is down.
24. Keep external effects explicit and at the boundary. Do not hide persistence, network, clock, random values, or I/O inside a domain decision. The decision must be a function of data. A different part must apply the effect.
25. Name the conflict rule for concurrent writes. Use a total order, a version, a unique constraint, or a commutative operation. "Last write wins" is valid only when the domain says so. Two writers on the same fact with no conflict rule are a defect.

## 4. Change and evolution

26. Do not build a part that you cannot show you need. You can use a clear name and a clean boundary. Do not add a second protocol, a plugin system, or an extra layer "for later". Add an abstraction at the third real repetition, or when the change already occurred.
27. Use the simplest design that meets the current constraints. Simple means the smallest number of concepts, states, and failure modes. If a simpler design breaks an invariant or a current requirement, that design is incomplete.
28. Design each module so that you can delete it. A replaceable module has a small contract, one owner, and no caller that knows its internal parts. Code that you cannot delete is a cost of change.
29. Evolve the design with vertical slices, not with complete horizontal layers. Each increment must cross the real path: input, decision, and effect. Keep the fitness tests green. An architecture that exists only in a diagram has already diverged.
30. Prepare for a change only in the direction that you already see. This applies to an axis that already moved, for example the payment supplier or the report schema. Do not turn every part into a strategy for symmetry.
31. Make compatibility an explicit decision. If you do not control the consumers of a contract, version the contract or add fields. Do not break the contract. If you control all consumers, change and migrate them together. Two truths cost more.

## 5. Clarity

32. Prefer clear code to clever code. Persons read code more often than they write it. A trick that saves lines and hides an invariant costs more than the obvious form.
33. The name must predict the behavior. An operation with the name "save" must not send mail, must not recalculate tax, and must not delete rows. Use the domain language to decrease the translation between the business and the code.
34. Use one level of abstraction in each unit. A function must not mix business policy, byte arithmetic, SQL, and date format. Mixed levels force the reader to change focus on each line.
35. Use the least powerful mechanism that solves the problem. A general rule engine for two conditions is borrowed complexity.
36. Give each constant and each policy a name and a location. A magic number, an inline timeout, or a threshold copied in four places is a decision with no owner. Keep the policy in one place and inject it.
37. Delete dead code and dead configuration paths. A branch that no one activates is a defect surface and a reading cost. If you cannot delete it, a dependency exists. Make that dependency explicit.

## 6. Security and trust

38. Give the minimum privilege by default. A component, a credential, or a user must receive only the access that the operation needs. The default must be closed. An open permission must be a recorded decision.
39. Do not trust input that crosses a boundary. Validate each external data item at the boundary: shape, range, size, and encoding. External sources are the user, the queue, the file, and the other service. The internal part can assume admitted data, and it must still keep its invariants.
40. Do not put secrets in the code or in the log. Credentials, tokens, and keys must come from a configuration channel that is separate from the artifact. A log must not write a payload that can contain a secret.
41. Do authorization on the server that makes the decision, not on the screen. A hidden button is not access control. The operation that changes state must check identity, scope, and state again.
42. Fail closed. If authentication, authorization, or integrity is not certain, the operation must not occur. A permissive default turns a configuration defect into an incident.

## 7. Operation and verification

43. If you cannot observe a behavior, you cannot operate it. Each relevant boundary must emit the data that answers these questions: what occurred, to whom, with which result, and in which time. Emit a correlation identity, the decision, and the error class. A log of all data is not observation. It is noise.
44. You must be able to assert behavior without the full system. Test a domain decision with data. Test a boundary against the contract. A module that you can verify only in a full environment has no boundary.
45. Invalid configuration must stop the start. An unknown value, a bad port, or a missing secret must stop the boot. A start with silent defaults that fails after one hour is an announced incident.
46. Slow work must not block the fast path. An operation with a latency budget must not do unbounded I/O, unbounded calculation, or a wait for a report. Separate the work by budget.
47. Put cost in a budget, not in a hope. CPU, memory, connections, payload size, and query cardinality must have an explicit limit. An unbounded query is a capacity incident that waits for traffic.
48. A data migration is part of the change. If the contract or the schema changes, a forward path must exist. If external consumers exist, a compatibility path must also exist. You must be able to run the path more than one time without corruption.

## How the rules do not contradict

- Rule 12 controls duplication. Duplicate the form when the reason for change is different. Do not duplicate the decision.
- Rules 26 and 30 control "design for change". Design for an axis that you already see. Do not design for an imagined axis.
- Rules 19 and 20 control failure. Fail immediately for a broken invariant and for bad configuration. Use an explicit policy for an external failure.
- Rule 15 controls mutation. Shared data must be immutable. Local data can be mutable when the budget requires it and the mutation is measured.
- Rule 27 controls simplicity. Simple means the smallest number of concepts that meet the current constraints, the invariants, and the expected failures.
- Rules 6 and 26 control abstraction. Add an abstraction when it stabilizes a real dependency. Do not add it before the change.

These rules apply to a system that lives for years, has boundaries, changes for more
than one reason, and runs in production. These rules do not select a mechanism for
a quality attribute. Add a mechanism only when a fitness test requires it.
