# Choose project verification for every core requirement

Use this worksheet with the [48 original requirements](../inputs/core-invariants-48.md)
and the [additional maintainability reconciliation](../features/core-maintainability-update.md)
with the [project fitness binding contract](../features/project-fitness.md).
Core 0.0.1 retains all 64 project obligations introduced when the core was numbered 0.3.0 and the
four enforcing integrity guards, all active by default. The tables propose bounded assertions and
negative controls; it does not supply commands, approve bindings or certify a
project. A receipt proves what the reviewed verifier actually asserts.

For this repository, the historical nineteen concrete boundary verification
bindings and their negative controls
record proposed assertions for unknown-tool diagnostic privacy and gate telemetry.
The new dependency and decision assertions
also check the actual declared core graph and frozen decision inputs.
The stdin assertions exercise
actual compiled entry points with invalid encoding, oversized input and stalled EOF.
The configuration assertions
exercise actual preset compilation and detect removal of validation guards.
The process deadline assertions
exercise real Git and fitness children that ignore ordinary termination.
The output budget assertions terminate
oversized stdout/stderr writers and preserve both exact-boundary channels.
These research records retain the admission state and gaps of their tested
candidate. Check `pregate fitness status --json` for the current contract; a bounded
assertion does not establish full-project admission.
The shared contract admission assertion
checks direct domain admission and rejection of altered locks with matching metadata,
without depending on CLI validation. It supplies three proposed bindings and keeps
the historical 52 default rules active in both source and compiled controls.
The policy ownership and combined decision/effect assertions
add six bounded proposals with actual shared-policy mutations and isolated decision controls.
The issue transport and recovery assertions
add two proposals with actual CLI interruption, timeout/output controls and an
isolated creation-phase mutation that exposes duplicate effects. GitHub remains simulated.

For each requirement, identify the actual code paths, relevant constraints and
coverage gaps. Implement a verifier, show that the negative control fails, repair
the defect and show that verification passes. Fingerprint the verifier and its
helpers/configuration, then propose its command, budget, inputs and rationale for
human contract review. Run only the approved binding. Several requirements can
share execution when the command asserts each one explicitly.

Use the smallest useful test boundary. Test decisions with data, boundaries
against their contracts, and a critical user journey with integration or E2E tests
when that journey carries a risk that smaller tests cannot exercise. Test counts
and an unrelated green suite do not establish compliance.

Start with `pregate fitness plan --json` to group requirements and review candidate
project verifier files. File names are hints, not evidence. Select only the
requirements an assertion actually covers; `fitness bind` accepts several IDs
for one reviewed binding. A shared execution is useful only if it rejects a
violating control for every stated condition. Preview the complete proposal and
use the human approval route; never bind a generic passing command to all 64.

For a concrete editable proposal, use `pregate fitness plan --template` and keep only
the requirements you can verify now. The template's commands and inputs are empty
and cannot be bound until completed. In `pregate.fitness.json`, record per-rule
conditions, negative controls, domain/data/performance assumptions and coverage
limits. Each claim declares complete or partial coverage; templates default to
partial. Partial assertions remain in plan gaps and cannot produce a passing whole
requirement. Declare complete only after reviewing every applicable condition.
`fitness plan --json` discovers those project-authored candidates without
executing them. `fitness bind --candidates pregate.fitness.json --preview` collects
several different commands into one pending preset and one human digest review;
`--only <assertion-id,assertion-id>` selects a smaller batch. Existing bindings
and local consent are preserved. See the [candidate format and workflow](../features/project-fitness.md#prepare-several-assertions-in-one-review).

Candidate declarations are still assertions to inspect, not demonstrated evidence.
All uncovered requirements remain unverified. File presence alone does not prove
that builds use a lock, operations are authorized or tests cover the stated rule.
For pinning, inspect the complete supported dependency graph; for a locked build,
actually show that a rebuild preserves resolution. For a performance obligation,
state the workload and budget and measure the real path rather than infer speed
from a test's execution timeout.

The four general change guards need no project verifier. Their executable
placement and marker conditions remain active alongside the semantic requirements.
Read the marker scope and limits, including
the conservative unsupported-source fallback, separately from this fitness matrix.

## Boundaries and dependencies

| Requirement | Candidate project assertion | Negative control or review condition |
| --- | --- | --- |
| `CORE-INV-001` | Check the declared module ownership and dependency graph against the observed reasons for change. | Put display, decision and storage changes into one unit; assess whether they have distinct owners or change causes. A directory name is not proof. |
| `CORE-INV-002` | Exercise a collaborator through its smallest declared data/operation contract. Check prohibited graph edges. | Add an unrelated dependency or read an internal representation; verification must reject the agreed boundary breach. |
| `CORE-INV-003` | Replace a volatile implementation behind the same public contract and rerun consumer tests. | Make a consumer depend on the provider's private representation; the replacement must expose the breach. |
| `CORE-INV-004` | Test the explicitly supported observable outputs and document their public scope. | Expose an accidental internal field or side effect. Review which observed behaviors consumers already rely on; snapshots alone do not show that the contract is narrow. |
| `CORE-INV-005` | Assert dependency direction for project parts whose relative stability is evidenced by history. | Make a stable policy import a frequently replaced provider. Record the observation that establishes this stability axis. |
| `CORE-INV-006` | Check an abstraction's actual implementations and recorded change evidence. | Add an abstraction with neither two real implementations nor an observed change. Also apply requirement 26 and the precedence rule. |
| `CORE-INV-007` | Review a unit's change causes and enforce the resulting responsibility boundaries. | A second independent stakeholder, policy or release cadence starts changing the unit. Small functions alone do not establish one reason for change. |
| `CORE-INV-008` | Run the decision with explicitly supplied dependencies; restrict ambient dependency access in the declared decision scope. | Change global state, import order or hidden context while keeping the explicit inputs fixed; the result must not change. |
| `CORE-INV-009` | Test consumers against collaborator interfaces that expose no internal third-party structure. | Reach a third unit through the collaborator's internals. Counted dots are not a substitute for the knowledge boundary. |
| `CORE-INV-010` | Exercise reused behavior through composition contracts; review actual domain subtype contracts. | Reuse an inheritance tree without a stable domain "is-a" relation. Legitimate domain inheritance must remain valid. |
| `CORE-INV-011` | Compile or exercise each consumer against only the interface operations it needs. | Require an unused operation to implement or consume the contract. Review whether the narrow contract still covers the real use. |

## State and data

| Requirement | Candidate project assertion | Negative control or review condition |
| --- | --- | --- |
| `CORE-INV-012` | Assert that repeated consumers obtain a policy decision from its declared owner. | Change one duplicated decision and observe divergence. Similar text with different change causes is permitted. |
| `CORE-INV-013` | Invoke domain construction/transitions directly with invalid data, bypassing boundary validation. | Remove the domain guard while keeping boundary validation green; the domain test must fail. |
| `CORE-INV-014` | Exercise invalid construction and each protected transition, plus valid paths. | Permit an empty order to ship, or an equivalent actual invalid state. Verify the actual domain implementation. |
| `CORE-INV-015` | Exercise shared values across the project's relevant concurrency or time boundary. | Mutate a shared value and change another observer's result. Local measured mutation must remain valid. |
| `CORE-INV-016` | Repeat decisions with supplied time, identity and version while changing the ambient clock/context. | Introduce a hidden clock or singleton dependency; identical explicit inputs must expose a changed result. |
| `CORE-INV-017` | Assert query nonmutation and command semantics at observable boundaries. | Make a query mutate state. Preserve and document an atomic "reserve and return quota" operation where effect and result are one domain decision. |
| `CORE-INV-018` | Review a domain glossary and enforce declared technical translation boundaries. | Make domain operations depend on framework terminology or translation. A glossary spelling check alone does not prove the model matches the problem. |

## Effects and failures

| Requirement | Candidate project assertion | Negative control or review condition |
| --- | --- | --- |
| `CORE-INV-019` | Exercise broken invariants, unknown flags and invalid configuration at their source. | Replace rejection with a silent default; the test must detect continuation or later corruption. |
| `CORE-INV-020` | Exercise the actual failure classification and retry/degrade/reject decisions. | Retry validation failure or a nonidempotent effect. Expected remote failure must retain its explicit policy. |
| `CORE-INV-021` | Deliver the same work twice and interrupt/retry an effect around its persistence boundary. | Produce two effects under one key or lose the stored result. Do not assert global exactly-once delivery. |
| `CORE-INV-022` | Use a peer that never answers; measure the actual timeout and bounded retry behavior. | Remove the timeout or retry limit. Include all relevant outside-process call paths. |
| `CORE-INV-023` | Fail or saturate a dependency while checking other capacity and rejection behavior. | Allow unlimited retries or exhaust a shared resource so unrelated requests cannot proceed. |
| `CORE-INV-024` | Test the decision with data while replacing boundary effect adapters. | Hide network, persistence, clock, random values or I/O inside that decision. Verify both effect-free decisions and applied effects. |
| `CORE-INV-025` | Race two writers and assert the named conflict rule and preserved domain invariant. | Remove the version/constraint/order rule. Last-write-wins is admitted only by an explicit domain decision. |

## Change and evolution

| Requirement | Candidate project assertion | Negative control or review condition |
| --- | --- | --- |
| `CORE-INV-026` | Review additions against actual requirements, repetitions and observed change evidence. Enforce the resulting feature/dependency budget. | Add a speculative protocol/plugin/layer. Validate the need itself; merely counting a recorded explanation does not establish it. |
| `CORE-INV-027` | Exercise all current constraints, then measure the concepts, states and failure modes needed by the solution. | Remove a necessary state/guard and lose a current requirement; also flag added complexity with no measured need. |
| `CORE-INV-028` | Replace or remove a module through its declared contract and run affected consumer behavior tests. | Let a consumer rely on module internals or create an unowned replacement obligation. |
| `CORE-INV-029` | Exercise a delivered increment from real input through decision to applied effect. | Deliver only an unused horizontal layer while its promised path is absent. Repository/process evidence is necessary beyond a unit test. |
| `CORE-INV-030` | Review variation mechanisms against a change axis observed in the project. | Add strategies for untouched axes merely for symmetry. Record actual change evidence, not imagined future consumers. |
| `CORE-INV-031` | Exercise supported consumer versions and the selected migration/compatibility path. | Break an uncontrolled consumer; where all consumers are controlled, test their coordinated change instead of requiring perpetual dual contracts. |

## Clarity

| Requirement | Candidate project assertion | Negative control or review condition |
| --- | --- | --- |
| `CORE-INV-032` | Review representative code comprehension and make the agreed naming/control-flow constraints executable where possible. | A short trick hides an invariant that reviewers must reconstruct. Line count alone cannot decide clarity. |
| `CORE-INV-033` | Assert the operation's declared observable effects and domain vocabulary. | An operation named "save" also sends mail, recalculates tax or deletes rows without a declared domain contract. |
| `CORE-INV-034` | Enforce the project's declared policy/representation/effect boundaries and inspect representative units. | Mix business decisions with low-level byte, SQL or date-format details in the same unit. Function size alone is insufficient. |
| `CORE-INV-035` | Review mechanisms against the actual requirement and enforce an agreed mechanism/dependency budget. | Add a general engine to solve two fixed conditions without a demonstrated need. Complexity measurements require project interpretation. |
| `CORE-INV-036` | Assert policy ownership, injected values and consistent configured thresholds at the relevant call sites. | Copy a timeout or threshold so one path diverges; preserve constants whose change causes differ. |
| `CORE-INV-037` | Run reachability/configuration inventory and the declared supported paths. | Add a dead branch or config mode; review actual external consumers before deletion. Coverage alone cannot prove code is dead. |

## Security and trust

| Requirement | Candidate project assertion | Negative control or review condition |
| --- | --- | --- |
| `CORE-INV-038` | Exercise role/credential/component access against the operations each needs, including defaults. | Give unrelated access or make an undeclared permission open by default. |
| `CORE-INV-039` | Feed invalid shape, range, size and encoding through every actual external ingress. | Bypass a queue/file/API guard, or admit an oversized value. Domain invariants must still hold when tested directly. |
| `CORE-INV-040` | Scan declared artifact/config boundaries and capture logs produced by secret-bearing inputs. | Put a credential in an artifact or leak a token through an error/payload log. Pattern scans cannot guarantee discovery of all secret forms. |
| `CORE-INV-041` | Call the actual mutation endpoint directly with invalid identity, scope or state. | Hide the UI button but permit the server mutation; the server test must reject it. |
| `CORE-INV-042` | Exercise missing/ambiguous authentication, authorization and integrity evidence. | Fall back to permissive access or perform an uncertain operation. |

## Operation and verification

| Requirement | Candidate project assertion | Negative control or review condition |
| --- | --- | --- |
| `CORE-INV-043` | Capture real boundary telemetry and assert correlation, decision, classified result and duration without secret leakage. | Lose the correlation/error class or replace actionable telemetry with an unbounded payload dump. |
| `CORE-INV-044` | Exercise domain decisions with data and boundaries against their actual contracts. | Require the full environment to assert a decision that should have an isolated boundary. Keep necessary integration/E2E coverage. |
| `CORE-INV-045` | Start the real process with unknown config, an invalid port and absent required secrets. | Start successfully with silent defaults and defer failure until the operation runs. |
| `CORE-INV-046` | Saturate or stall the slow path while measuring the fast path against its declared latency budget. | Add an unbounded calculation/I/O wait or a report dependency on the fast path. |
| `CORE-INV-047` | Exercise CPU, memory, connection, payload and query-cardinality limits under representative bounds. | Remove a limit or create unbounded/N+1 queries. Limits must be appropriate to the measured workload. |
| `CORE-INV-048` | Run a migration twice on representative existing data and exercise required consumer compatibility. | Corrupt data on replay, omit a forward path, or break an uncontrolled consumer during schema change. |

## Record the limits

Reasons for change, domain language, simplicity and future change cost require
review of project facts. An executable check of a written assertion cannot prove
that the assertion is true. Keep that judgment and the uncovered scope explicit
in the binding rationale; do not convert a documentation-presence check into a
claim of architectural compliance.

## Additional distinct obligations

Existing IDs 001–048 also retain every applicable extended condition listed in
the reconciliation. For example, 031 now requires version/deprecation evidence
for uncontrolled public consumers, and 043 requires structured failure and
latency/error/saturation evidence. Reviewing only an older narrower verifier
does not establish the updated statement.

| Requirement | Bounded project evidence | Invalid control |
| --- | --- | --- |
| CORE-INV-049 | Resolve the actual dependency graph to pinned ecosystem versions. | Introduce an unpinned resolution and assert rejection. |
| CORE-INV-050 | Rebuild from a clean checkout with the committed dependency lock. | Change resolution without updating its locked record. |
| CORE-INV-051 | Verify an owned update schedule and dated execution records. | Omit the owner or miss the stated schedule. |
| CORE-INV-052 | Compare dated vulnerability facts with severity and the project's fix window; observe the failing build. | Keep an overdue known high-risk defect and assert the build fails. |
| CORE-INV-053 | Compare declared runtimes with current authoritative support records. | Supply an unsupported runtime and assert rejection. |
| CORE-INV-054 | Assert money precision, time-zone transitions and claimed locales using the supported facilities. | Exercise a rounding, daylight-saving or locale error. |
| CORE-INV-055 | Execute the defect regression against the affected old revision and the fix. | The same assertion must fail before the fix. |
| CORE-INV-056 | Observe the actual required static-analysis merge gate. | Introduce a known violating change and assert merge is blocked. |
| CORE-INV-057 | Exercise the release's rollback and compatible data recovery. | Use an unavailable artifact or incompatible recovery path. |
| CORE-INV-058 | Exercise enable/disable for an identified risky feature. | Assert the disabled feature cannot produce its risky effect. |
| CORE-INV-059 | Execute the versioned automated deployment workflow in its stated environment. | Inject a failed step and assert that deployment does not claim success. |
| CORE-INV-060 | Exercise the runbooks for named common operational tasks. | Omit a necessary step and observe the failed task. |
| CORE-INV-061 | Resolve each alert to a current accountable owner and test its notification route. | Remove an owner or break delivery and assert detection. |
| CORE-INV-062 | Trace each significant architecture decision to its written reason and implementation. | Introduce an undocumented or contradictory decision. |
| CORE-INV-063 | Follow only the written build/start steps in a clean environment. | Remove an essential prerequisite and observe the onboarding failure. |
| CORE-INV-064 | Check the debt inventory's accountable owners and target dates. | Introduce debt without either field and assert detection. |

Records need authenticity and coverage review. A file's presence alone does not
prove that a deployment, restore, notification or operational task succeeded.
Date-dependent evidence needs a reviewed expiry budget and current authoritative
inputs; PREGATE cannot infer external drift from unchanged local source.

Keep the original conditional exceptions. For conflicts, choose the rule that
reduces change cost on an observed axis and substantiate the decision with tests
or measures. Record the reviewed result in the project contract. Missing evidence
remains unverified. Explicit human disable means inactive, not compliant.
