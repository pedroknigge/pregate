# dcouplr coverage still required

The current twenty-six syntax checks enforce bounded source predicates. Ten
additional delivery requirements, six logging, eight queue, eight saga, eight factory, eight utility and eight observability requirements use individually
reviewed project fitness assertions.
Full library coverage
has not been implemented or certified. Before claiming a complete dcouplr pack:

The [observability conditions](OBSERVABILITY-CONTRACT.json) now cover declarations,
query scope, graph response trust/readiness, diagnostic completeness, development
access, payload ownership/redaction, inspector lifecycle and bounded transport/rendering.
Thirteen actual runtime cases plus four existing inspector controls supply source
contrasts. A compiled export assertion denies removed redaction after binding.
Project associations reach 96 contracts; source review does not verify a consumer's
graph, access policy, renderer, capture storage or lifecycle.

The [utility conditions](UTILITY-RUNTIME-CONTRACT.json) cover strict domain
validation, actual cast target order, null/fallback/failure, explicit dates,
tuples, field helpers, actual priority implementation and named admission.
Twenty-nine canaries execute the pinned runtime. Seven selected type controls
keep named priorities distinct from numeric ranks and expose the difference
between generic cast types and actual targets. A compiled producer assertion
denies missing-await and ignored-false regressions; its verifier rejects numeric
and invalid priorities before adapter use. Project evidence associations reach
75 named contracts without increasing syntax coverage. The published package
has no public priority-queue implementation; scheduling, starvation, capacity
and destructive operations need the actual selected adapter. Consumer assertions
remain required for graph/monitor and inspector conditions.

The [factory conditions](FACTORY-RUNTIME-CONTRACT.json) cover setup/bootstrap,
intent/lifetime stores, actual input, creator result lifetime, output verification,
singleton scope, test replacement and owned shutdown/reset. Twenty source
canaries preserve runtime behavior and a compiled application assertion denies
removed validation and retained caller-mutation regressions. Combined evidence
associations reach 61 named contracts. This does not add syntax coverage or
prove actual consumer registration graphs, domain constraints, adapter outputs,
tenant scope, resource disposal or shutdown budgets. Graph/monitor conditions
now have separate source-backed requirements; all project
requirements still need reviewed application assertions.

The reproducible [API inventory](API-COVERAGE.json) now accounts for 115 exports,
154 reachable named contracts and 529 member-signature occurrences. It retains
declaration origins, inheritance and overloads, plus partial syntax-check
associations. 119 contracts have no syntax association. This is an inventory of the
public declarations; exhaustive behavioral conditions, consumer evidence and
enforcement remain separate work. Graph queries, complete logging/exception behavior,
complete queue recovery/persistence, service replacements and lifecycle are among
the visible gaps. Reproduction and verification.
The new [delivery conditions](DELIVERY-CONTRACT.json) associate seventeen API
contracts with project evidence requirements. Source canaries verify their
upstream contrasts and a compiled example enforces one caller's completion
assertion. Full application lifetimes, integration, aliases, configured
replacements and the remaining API conditions still require coverage.
The [logging conditions](LOGGING-CONTRACT.json) add configured logger ownership,
context, levels, overloads, flush and monitor evidence. Eighteen source canaries
preserve actual runtime distinctions; an isolated compiled shutdown caller
rejects a missing-await regression after reviewed binding. Combined evidence
associations now cover 22 named contracts. No new syntax coverage is claimed.
Complete consumer call graphs, configured adapters, secret filtering, error
policies, sink delivery and retention still require project verification.
The [queue conditions](QUEUE-RUNTIME-CONTRACT.json) add actual repository
selection, awaited admission/backpressure, leading/lagging outcomes, discard,
validated recovery, storage identity/conflicts and custom adapter/read contracts.
Twenty-nine actual runtime canaries expose the singleton fallback mismatch,
unhandled lagging rejection and malformed recovery that disables later
persistence. A compiled producer assertion denies missing await and ignored
false results. Combined project associations now cover 31 named contracts,
while 119 contracts still have no syntax association. Real storage integration,
restart/conflict handling, priority queues and complete consumer proof remain open.
The [saga conditions](SAGA-RUNTIME-CONTRACT.json) now cover graph/deprecation,
identity/data, handler outcomes, compensation/checkpoints, join policy,
recovery readiness, durable replay and owned shutdown. Thirty-one actual
source canaries preserve pinned behavior; a compiled caller denies missing
await and early-failure shutdown after reviewed binding. Combined evidence
associations reach 44 named contracts, with the syntax gap unchanged. Actual
consumer graphs, queue/storage wiring, idempotency, compensation failure
recovery and bounded lifecycle work still require application assertions.

- Resolve named/aliased factory callbacks and imports through namespace-alias,
  computed/dynamic/CommonJS and barrel indirection. Direct namespace dot/bracket
  access and object destructuring now have positive, negative and bypass fixtures.
  Distinguish owned returned component classes from unrelated values
  without silently weakening the strict managed-path policy.
  Four factory/construction predicates now track the first inline arrow/function
  creator through literal dot/bracket/template members, optional calls, comments
  and transparent member/callback wrappers. Extra callbacks do not become creators
  or component-root exceptions. Immutable const arrow/function creators now
  retain these policies when their direct first-argument reference follows
  initialization in the same lexical scope. Direct same-scope invocation removes
  the named root exception; shadowing parameters do not invoke the outer creator.
  Factory effect/parameter policies now cover same-scope function declarations
  (including hoisted/exported forms) when explicit writes and duplicate function
  declarations cannot replace the binding, plus initialized exported constants.
  Exported creators do not receive exclusive root ownership; named/default local
  value exports also revoke that exception. Type-only and foreign exports remain
  distinct. Aliases, mutable/imported/cross-scope,
  generator/type-asserted/indirect creators, nested direct calls, escaped values
  and returned-constructor value wrappers remain unresolved. Full lexical write
  resolution and exclusive root ownership for declared/exported creators still
  need evidence. See the declared-creator contrast,
  named-creator contrast and
  ownership contrast.
- Validate the actual admission chain, mandatory input shape, factory callback,
  explicit validation/verification policy and registration/singleton semantics.
  Required creators, known noncallable policies and direct fluent singleton input
  now have checks and source canaries. Defaults remain valid; null verification
  is rejected under the public typed contract despite runtime tolerance. Policy
  return flow, named handles, actual mandatory fields and ownership still need
  coverage. Inline async/generator validation and verification, wrong known
  validation returns and literal valid/msg shape now have checks, runtime canaries
  and independent public-type compiler controls. Direct same-scope initialized
  const callables and unique, unmodified function declarations now retain both
  policy checks, including hoisted/exported forms. Explicit rebinding or duplicate
  declarations defer inference; nested shadow writes do so conservatively.
  One same-scope immutable const policy alias now retains the checks after
  initialization, including exported and hoisted source definitions. Multiple
  or destructured aliases, imported/cross-scope or mutable policies, indirect asynchronous effects,
  dynamic returns, complete control flow and domain validity remain gaps. See the
  named-policy contrast and
  alias-policy contrast.
  Direct adjacent stage order now covers all 225 transitions among 15
  admission/terminal/metadata methods, checked against actual stage capabilities;
  aliases, unknown receivers and whole-program setup order remain unresolved.
  Optional stages/defaults in the runtime must remain valid where applicable.
- Complete bootstrap ownership, setup/get order, test-only force registration and
  duplicate intent/peer ownership with explicit project facts. Direct fluent
  DKERNEL admissions are now denied, including in tests; runtime canaries assert
  warnings, duplicate rejection and retained bootstrap injection after shadow
  registrations. Named admission handles, key/function aliases and dynamic names
  still require stronger evidence. Direct force calls are reserved in reviewed
  production paths; aliases and actual test-mode configuration remain unresolved.
  Plain direct setup options and direct immutable system-setting writes now have
  checks and published runtime/type contrasts. Dynamic/spread/computed/getter/
  prototype/escaped configurations, setup aliases and cross-module setup/get order
  remain unverified. Repeated setup is a no-op in the pinned runtime. Omitting
  ephemeral forwards undefined; the gates apply a separate nullish true default
  for broker fallback. The pinned omitted/undefined/true fallback selects blocking
  local delivery, and false selects nonblocking delivery. Actual caller lifetime,
  configured adapter and completion claims need project assertions.
- Verify selected system override contracts (logger, buses, queues, repositories,
  lifecycle, brokers, registries) against published signatures and runtime checks.
  The eight public setup keys and direct literal IDFactory fields now have checks;
  known async/generator creators reject while custom identifiers, optional
  undefined and compatible static class factories remain valid. Actual output
  members/behavior, named factory shape and indirect asynchronous creation remain
  unverified. Source canaries preserve actual creation for all eight overrides.
- Admit event/message subscription and teardown rules with the correct distinct
  argument order. Direct gate call shapes now have rules and runtime contrasts:
  listener/handler first, required event type, optional IDs/peer and the matching
  teardown APIs. Empty event channels have an explicit policy because the built-in
  bus retains their listeners after registry removal. Named gate/function aliases,
  receiver identity, cross-call display/subscription-ID ownership and callback
  types remain gaps. Track blocking effects and failure policies without assuming
  every similarly named member belongs to dcouplr.
- Check queue IDs and numeric configuration constraints, capacity/backpressure
  outcomes, recovery ownership and persistence semantics. `flush` drops pending
  memory; it is not a persisted-drain guarantee. Direct invalid numeric literals
  have checks and runtime canaries. Missing fields and wrong literal types in
  plain direct configurations are now checked; public leading/lagging modes and
  boolean enabled flags are enforced even where the runtime is permissive.
  Scientific expressions, dynamic shape/values, escaped string contents,
  computed/spread/getter/prototype configurations and custom implementations remain gaps.
- Check structured saga IDs, steps, joins, references, correlation, lifecycle,
  compensation and checkpoint cancellation. Built-in queue persistence is required;
  a custom queue contract can satisfy the saga through another implementation.
  Direct constructor identities/kernel and literal step/join contracts now have
  checks, fixtures and public type/runtime contrasts. The custom-queue canary
  preserves correlation, idempotent start/stop and removed subscriptions. Repeated
  unescaped literal join references are now checked within one array, including
  mixed single, double and template quote delimiters.
  Escapes, named/interpolated values, duplicate node IDs and
  unknown join references remain runtime-only controls;
  cross-call graph, named callback/return-flow, full compensation/checkpoint and
  built-in persistence ownership have conditional project gates and runtime
  contrasts, but complete consumer verification remains incomplete. Public deprecated
  saga DSL construction must not be mistaken for an unregistered collaborator.
- Verify inspector development-only access, local binding, recording controls and
  bounded diagnostics. Public literal inspector/debug-console fields now have
  checks for both setup and direct startup, plus pinned runtime/type controls.
  Actual loopback HTTP controls observe record retention, observer cleanup and
  the production startup guard; they do not prove consumer configuration.
  Untrusted-origin POST and recording GET still execute despite rejected
  preflight. Direct standard Infinity/NaN constant forms now reject, including
  unary and transparent value wrappers, before they disable retention or discard
  all events. Explicit numeric-global bindings anywhere in a file and with defer
  the predicate conservatively; lexical resolution is still required. Origin
  policy is not authorization. Arithmetic/overflow/dynamic numeric validity, access/production ownership,
  aliases, static class field values and dynamic options remain unresolved. Browser UI globals are not
  managed-factory violations.
- Extend the public API inventory with each inferred behavioral condition and
  its actual static or fitness evidence. Calibrate on a real consuming project with independently reviewed
  false positives, architectural bypasses and preserved behavior.

Some requirements need a project graph, configuration or runtime fitness tests.
Syntax matching alone must not claim proof of those properties.

A first private consumer diagnostic
now scans 7,940 JS/TS files with 23 checks and all 48 core fitness requirements
explicitly unverified. It exposes managed-path gaps, required DSL/value construction,
adapter ownership, helper bypasses and intentional dual-container persistence.
It repairs a directory-index audit defect but does not supply independently labeled
precision, project admission, complete graph coverage or behavioral repair evidence.

The later raw-NUL parser correction
removes all three private consumer syntax gaps. Repeating current 1.13.0 diagnostics
evaluates 25 of 26 checks and preserves identical seven/167 default/proposed-scope
finding arrays. The unadmitted graph and all 48 unverified fitness requirements
remain explicit; restoring parser coverage does not complete consumer calibration.

The 1.26.0 snapshot review
again evaluates 25 of 26 syntax checks on 7,940 files without errors, preserving
seven default-scope and 167 proposed-scope matches. It distinguishes construction,
ambient, adapter and test forms without inferring independent labels. The 64 core
and 56 optional pack fitness obligations all remain unverified. The authoritative
graph, approved ownership adaptation and behavioral consumer tests remain open;
the preserved snapshot is not the consumer's current live branch.

The later domain-direction proposal
retains the authoritative domain/shared globs and graph source exclusions. Its
exact native Mac audit evaluates all 26 syntax checks with zero errors, including
400 graph-covered files; new-file and shared-barrel canaries enforce that bounded
direction. The other external graph policies are not translated, the consumer
contract remains unadmitted and all 120 fitness obligations remain missing.

Both effect checks now admit erased TypeScript type queries while keeping executable
references beside annotations. The type/runtime contrast
repairs a confirmed consumer false positive; other ownership labels remain pending.

The configured bus and registry observations
associate the four public interfaces with the existing output-contract
requirement. Source canaries contrast premature completion and verify copied
registry records, semantic aggregation and removal. The compiled caller example
rejects eight separate completion, routing, disposal and error-policy defects.
These are owned application controls, not independently calibrated consumer
coverage. Project evidence associations now reach 100 named contracts; syntax
associations and the visible indirection/lifecycle gaps remain unchanged.

`bun scripts/dcouplr-source-probe.ts --fetch` verifies 764 controlled runtime scenarios
against integrity-pinned 0.1.3-beta source. Runtime-only cases must remain visible
until the corresponding pack coverage is implemented. This source contrast is
not independent consumer calibration or a complete contract audit. Seventy-eight compiler
assignment controls additionally verify selected integrity-pinned public types;
they do not typecheck a consuming project.
