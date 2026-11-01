# Verify configured system-bus completion

This example binds `DCP-FACTORY-RUNTIME-005` to two actual configured adapters
and their application callers. It asserts blocking completion, all-listener
failure causes, background error callbacks, direct routing, message broadcast
and repeatable subscription-ID disposal. Callable-member admission alone does
not prove these properties: a void-returning `emitBlocking` passes setup and
completes the gate early in integrity-pinned dcouplr 0.1.3-beta.

Copy both `.mjs.fixture` files into a temporary project, remove `.fixture`,
install the project's reviewed dcouplr version and run `bun quality/verify.mjs`.
Remove `return` from the adapter's `emitBlocking` implementation. The assertion
must fail even though dcouplr still accepts the adapter's callable shape.

Propose `dcouplr/factory-runtime` in a combined pack plan. Fingerprint the
verifier and the trusted dependency inputs with `pregate fitness fingerprint`.
Propose a [reviewed fitness binding](../../features/project-fitness.md) for
`DCP-FACTORY-RUNTIME-005`, an explicit command and timeout, and an enforcing
override. Human approval still applies; a shadow rule remains diagnostic.

Run `pregate fitness run DCP-FACTORY-RUNTIME-005`. A source change must invalidate
its old receipt. The broken adapter must fail the assertion and the enforcing
check; restoring its promise must pass again. A changed verifier or dependency
definition needs a new reviewed fingerprint before execution.

The native smoke introduces eight separate adapter regressions and checks that
each fails the real assertion, blocks the enforcing check and passes after
repair. It also rejects unreviewed verifier changes. See the
source and caller evidence.

This example does not prove registration replacement, durable delivery,
backpressure, cancellation, authorization or the behavior of a real consumer.
Replace these fixtures with the application's actual adapters and callers
before claiming project compliance. All other factory and core obligations
stay UNVERIFIED.
