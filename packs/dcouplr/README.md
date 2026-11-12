# dcouplr

**Preview library pack.** Twenty-six executable JS/TS checks help keep managed code
inside declared dcouplr boundaries: injected dependencies, factory construction,
explicit effects and composition-root ownership. Fifty-six optional project-evidence
gates verify delivery, exception, logging, queue, saga, factory, utility and observability behavior through reviewed application assertions.
This is an implemented slice;
it is not a complete dcouplr contract audit.

The source is the published npm package **dcouplr 0.1.3-beta**. Its non-minified
runtime, ESLint distribution and type declarations are the evidence available;
original TypeScript sources are not included in that tarball. Package integrity:

```text
sha512-lPvTKxbikMRLKmPPGUnam0X6aH10H8OY+ND2Zx53UpANuFxmnj4S12GxAmwr0kFN1eLN5ORx2mycJTg4T7Dlcw==
```

0.0.8 follows one same-scope immutable alias for factory effect
and injection policies without granting new constructor-root exemptions. The
source-backed review
records current canaries and static-analysis limits. Use the
[custom managed-boundary request](../../docs/examples/dcouplr-managed-boundary/README.md)
when your application lives outside the default `src/application` and `src/services`
paths. Project lifecycle and adapter requirements still need reviewed verifiers.

Fourteen independently selectable methodologies:

- `dcouplr/managed-components`: global effects, direct construction, runtime
  locator imports and declared import edges.
- `dcouplr/factories`: ambient effects inside inline, same-scope const or unmodified
  declared `addFactoryMethod` creators, including local exported definitions and
  one immutable const alias;
  required arguments after input/kernel are denied; default parameters remain
  advisory because their actual effect depends on position and use. Required
  creators and supplied policies must be callable; fluent singleton input must
  be an object when supplied. Direct fluent stage transitions must follow the
  admission protocol; interaction metadata is available only after registration.
- `dcouplr/runtime`: public literal setup and inspector configuration, immutable system settings,
  bootstrap-owned kernel admission, test helper imports, force admission calls
  in production and private package imports.
- `dcouplr/queues`: required fields and literal types from the public built-in
  I_QUEUE configuration contract, including leading/lagging mode, plus invalid
  literal capacity/persistence bounds. Dynamic configuration and some numeric
  spellings still need additional verification.
- `dcouplr/events`: listener-first subscription, required event type, matching
  listener-reference/subscription-ID teardown and an explicit empty-channel policy.
- `dcouplr/messages`: handler-first registration, optional peer/handler IDs and
  peer/subscription-ID teardown.
- `dcouplr/sagas`: required constructor identities/kernel and literal step/join
  contracts, including repeated unescaped literal join references across quote forms.
  Valid public DSL construction and custom queues remain valid;
  reference graphs, persistence ownership and lifecycle need project verification.
- `dcouplr/delivery`: completion, nonblocking lifetime/error policy, broker handoff
  and fallback, subscription/peer ownership, directed/broadcast routing, context
  and exception flow, and custom broker return contracts. These are project
  fitness requirements, not additional pre-edit syntax detectors.
- `dcouplr/logging`: injected gate ownership, child context isolation, level
  filtering, overload and failure control flow, owned flush and monitor limits.
  These six conditions need actual project assertions, not syntax guesses.
- `dcouplr/queue-runtime`: awaited admission/backpressure, actual repository
  connection, leading/lagging outcomes, discard ownership, valid recovery,
  stable storage identity/writer conflicts and custom queue/read contracts.
  These eight conditions need project assertions alongside literal queue checks.
- `dcouplr/saga-runtime`: graph ownership/deprecation, trusted identity and data,
  handler outcomes/idempotency, compensation/checkpoints, join branch policy,
  recovery readiness, actual durability/replay and owned shutdown/cancellation.
  These eight project conditions do not recommend adoption of the deprecated DSL.
- `dcouplr/factory-runtime`: owned setup/bootstrap, intent/lifetime lookup,
  domain input validation, injected creator result lifetime, output verification,
  shared singleton scope, test replacement and application shutdown/reset.
  These eight conditions need actual assertions, alongside factory syntax checks.
- `dcouplr/utility-runtime`: domain validation, actual conversion targets,
  null/fallback/failure policy, explicit date semantics, tuple input, field
  helpers, selected priority implementation and named-priority admission.
  These eight conditions need project assertions; priority types are not a queue.
- `dcouplr/observability`: truthful interaction declarations, admitted graph queries,
  response provenance/readiness, diagnostic completeness, inspector access,
  payload redaction/bounds, server ownership and transport/rendering budgets.
  These eight conditions require application assertions. CORS is not authorization,
  diagnostic recordings are not immutable audit logs and Mermaid is not an HTML sanitizer.

The [exact reference](REFERENCE.md) lists every rule, default and limit. The
[remaining coverage](BACKLOG.md) separates facts not yet checked from this slice.
The [public API inventory](API-COVERAGE.json) records all 115 exported names,
154 reachable named contracts and 529 member-signature occurrences in the pinned
declarations. Inherited and repeated signatures remain separate occurrences.
The graph and inspector source contrast
adds thirteen real runtime cases and brings project associations to 96 contracts.
The [bounded export example](../../docs/examples/dcouplr-observability/README.md)
shows how to bind one actual redaction assertion without certifying other exports.
119 contracts have no related syntax slice; an association on another contract
does not prove complete coverage. See inventory verification.
The [delivery contract](DELIVERY-CONTRACT.json) links ten conditions to actual
published-runtime canaries and seventeen API contracts. Those evidence
associations remain separate from syntax associations and consumer proof.
Use the [executable caller assertion](../../docs/examples/dcouplr-delivery/README.md)
to bind an actual application path, then extend it to your configured adapters,
lifetimes and failure branches. A binding in an enforcing rule blocks when its
evidence is stale or fails; unbound requirements remain explicitly UNVERIFIED.
The [logging contract](LOGGING-CONTRACT.json) adds six conditions from the
published logger and gate. Together the two contracts associate 22 named API
contracts with evidence requirements, without increasing syntax coverage.
The [queue contract](QUEUE-RUNTIME-CONTRACT.json) brings combined evidence
associations to 31 named contracts. Its [producer example](../../docs/examples/dcouplr-queue/README.md)
denies missing-await and ignored-false regressions after a reviewed binding.
For the pinned default queue, explicitly pass the resolved persistence repository:
the factory's transient `has` lookup does not select the configured singleton.
`flush()` discards work; it does not commit persistence. Validate recovery
snapshots before admission and own background failures and writer conflicts.
The [saga contract](SAGA-RUNTIME-CONTRACT.json) brings combined evidence
associations to 44 named contracts without increasing syntax coverage. Thirty-one
actual runtime contrasts show that start does not await recovery, stop does not
await handlers, and join success signals alone do not prove handlers ran.
The built-in saga queue can admit a persistence singleton while remaining volatile.
Use the [owned shutdown example](../../docs/examples/dcouplr-saga/README.md) to
bind actual in-flight work, then extend verification to the product's recovery,
effect idempotency and compensation policy. The structured-saga API is deprecated
in the pinned declarations; record the version and replacement decision instead
of forcing it into a greenfield design.
The [factory contract](FACTORY-RUNTIME-CONTRACT.json) brings combined evidence
associations to 61 named contracts. Twenty actual source canaries verify setup,
store collisions, retained input, creation, cache behavior and live retired
references. A second setup does not reconfigure the runtime; `has` does not see
a singleton. Verification ignores a false return and retries a failed singleton.
`shutdown()` and test reset do not dispose dependencies or revoke old references.
Use the [input assertion](../../docs/examples/dcouplr-factory/README.md) to enforce
actual domain constraints before injected resolution and retain admitted values
independently of caller mutation. Promise-returning creators can be intentional;
their consuming boundary must own completion and failure.
The [utility contract](UTILITY-RUNTIME-CONTRACT.json) brings combined evidence
associations to 75 named contracts. Twenty-nine source canaries verify actual
conversion, fallback, date, field-helper and priority behavior. Compatibility
checks the first array element; converting `"false"` to boolean produces `true`.
Nullish inputs and unchecked fallbacks can escape a requested cast target.
`straightValue` loses valid falsy values, unlike `withDefaultValue`.
The package publishes `IPriorityQueue` as a type but supplies no public priority
constructor. Numeric `QueuePriorities` ranks differ from named `DPriority` input;
the built-in `IQueue` remains FIFO with a different enqueue signature.
Use the [named-admission assertion](../../docs/examples/dcouplr-utility/README.md)
for actual producers and verify the selected scheduler separately.
The [shutdown assertion](../../docs/examples/dcouplr-logging/README.md) verifies
one caller's flush lifetime and failure policy. Custom adapters must filter their
own writes: the gate delegates before checking `isLevelEnabled`. `fatal()` logs
and returns. Monitor events do not prove sink delivery or contain all adapter
child bindings and serialized errors. Verify the configured implementation.

Named `const` creators retain the four factory/construction policies when their
first-argument reference follows initialization in the same lexical scope.
Direct same-scope invocation removes the named component-root exception.
Pack 1.16.0 additionally follows hoisted function declarations without explicit
rebinding or duplicate declarations, and initialized exported constants, for
effects and parameter policies. Exported factories do not receive exclusive
constructor-root ownership: declaration exports and local named/default value
exports revoke that exception. Type-only exports and foreign re-exports remain
distinct. The declared-creator contrast
records the controls and conservative write-resolution limits.
Mutable/imported/cross-scope creators and full call-graph ownership remain
unresolved. See the named-creator contrast.

Pack 1.10.0 checks literal join-reference uniqueness before the runtime rejects
start. Mixed quote forms, escapes, dynamic values and cross-call graph ownership
remain unresolved. The source contrast
records valid/bypass controls and the remaining graph gaps.

## Select the policy

```sh
pregate pack show --library dcouplr --json
pregate rules test --library dcouplr
```

Select the methodologies that apply in one `plan.json`, then run
`pregate pack apply plan.json --preview` and approve that combined candidate:

```json
{
  "sources": [{"kind": "library", "ns": "dcouplr"}],
  "methodologies": ["dcouplr/factories", "dcouplr/runtime", "dcouplr/queues", "dcouplr/events", "dcouplr/messages", "dcouplr/delivery"]
}
```

Add `dcouplr/sagas` when the project uses structured sagas. Review the managed
layers before selecting `dcouplr/managed-components`. After approval, audit and
bind applicable project requirements with explicit enforcement and actual tests.

`managed-components` requires declared core layers and permitted import edges.
By default, its construction/effect/locator checks cover `src/application/**`
and `src/services/**`; set reviewed paths/exclusions to match your actual managed
modules. The import-edge rule uses declared `@layers:core`. Keep ports separate
from concrete adapters, and register implementations at the composition root.
Pure value modules and adapters need deliberate scope decisions. Do not treat
the presence of a dcouplr import as evidence that the architecture is followed.

Before enabling managed boundaries in an existing project, inventory its factories,
injected ports, helpers, adapters and saga builders. Preview the actual paths;
`src/kernel/**` does not mean every file is a pure managed component. Review
findings before approval: local errors/collections and required `DStructuredSaga`
construction can conflict with a blanket no-`new` policy, while helpers outside
an inline factory can hide clock or database dependencies. Prepare narrow,
fixture-tested adaptations for the actual ownership instead of disabling dcouplr.
Do not infer wiring from registration alone or forbid intentional publication
into distinct dependency containers without checking their lookup contracts.
The consumer diagnostic
records these limits and an audit reader defect found with a real private project.

The pack deliberately includes stricter project policies than upstream ESLint:
selected managed modules prohibit direct `new` construction, except the direct
returned root of an inline or reviewed same-scope const factory; injected kernel gates/ports own effects.
This is explicit policy, not receiver/type-flow inference. Renamed value imports
and direct namespace dot/bracket access and object destructuring are detected.
Type-only imports, public constants and lexically shadowed namespaces remain
valid. Namespace alias data flow, computed members, dynamic/CommonJS imports and
re-export barrels remain gaps. The effect and parameter checks follow one immutable
same-scope alias; multi-alias, mutable, imported and cross-scope factories still
need data-flow coverage. Constructor-root ownership does not gain that alias exception.

TypeScript `typeof` type queries are erased and do not read a global at runtime.
Both effect checks admit those queries in aliases, annotations, generics, casts
and signatures. Executable `typeof fetch` and a value reference such as
`fetch as typeof fetch` remain checked. See the type/runtime contrast.

The force-admission rule reserves `registerForce` and `registerSingletonForce`
calls in selected production paths; it does not infer receiver types. Narrow the
reviewed scope if unrelated APIs use the same names. Excluded test files still
require a runtime configured with `mode: 'test'`. Queue rules are explicit
direct-call/key policies for the built-in I_QUEUE contract. Review applicability
for custom queue overrides. The shape rule checks missing DTOs/required fields,
literal types, empty queue IDs and literal leading/lagging mode. Later literal
and shorthand overrides are respected. Spreads, computed/escaped keys and getters
and inherited persistence fields are unresolved; escaped mode/ID string contents and dynamic values need separate
verification. The numeric rule does not evaluate all expressions.

Kernel ownership applies in test modules too. Direct fluent registration of
`'DKERNEL'` or `system.DependencyKeys.Kernel` is denied. Ordinary `register`
warns and rejects the duplicate at runtime, but `registerSingleton` and force
registration can create a second public value while factories still receive the
original bootstrap kernel. The policy prohibits this split ownership. It follows
the receiver chain, not arbitrary descendants: `createOnly`, declaration-only
calls and nested factory declarations remain valid. Named handles, aliases,
computed/escaped names and arbitrary chain methods remain unresolved. The rule
reserves the documented key and admission method names in reviewed paths; it
does not infer receiver types. Configure supported system factories at setup and
receive the kernel through the factory's second parameter.

The public queue type contract is stricter than this runtime's semantic type
checker. The pack denies `enabled: 'false'` and unknown modes even though the
runtime accepts them. With a repository, the string `'false'` enables persistence;
an unknown mode can silently skip persistence while enqueue succeeds. These
observed effects explain why the typed contract is enforced. They are not claims
that the runtime rejects every finding.

Event and message gates have different contracts from the low-level buses.
Use `kernel.event.subscribe(listener, eventType, listenerId)` and
`kernel.message.registerHandler(handler, peer, handlerId)`. The message peer is
optional; an anonymous address is valid. Event teardown uses the original listener
reference or the returned subscription ID through `unsubscribeBySubscriptionId`.
Message teardown uses the peer or the returned subscription ID. A fresh event
closure or a function passed as a message peer can silently leave a subscription
active. A listener/handler display ID is not the returned subscription ID.

The nonempty event-type restriction is explicit PREGATE policy: the published
types and runtime accept an empty channel, but the built-in bus fails to remove
its listener. Delivery can continue after the gate's registry reports removal.
Review applicability if the project replaces that bus. The syntax checks reserve
direct `event`/`message` members in the selected paths; they do not infer receiver
types, follow aliases or prove cross-call ownership. Spreads and unknown types
remain unresolved. Dot/literal brackets, optional calls, comments and transparent
value wrappers are covered; the low-level buses retain their own argument order.

## Verify the source contract

The direct admission sequence is `declareIntent`, `addMandatoryInputFields`,
`addValidationPolicy`, `addVerificationPolicy`, `addFactoryMethod`, then
`createOnly` or a registration method. An optional stage argument can be omitted;
the stage itself cannot be skipped. `createOnly` returns a factory with `create`.
Registration returns a distinct handle with `raisesEvents`, `sendsMessages`,
`usesDependencies`, `reactsTo` and `withExtendedInfo`, which can be chained in any
order. The source probe independently inspects the actual callable stage members
and executes all 225 transitions between these 15 methods. Named handles,
receiver types, dynamic/escaped methods and whole-program bootstrap order remain
outside the direct-chain rule.

Admission requires a callable creator. Optional validation defaults to a policy
that accepts input, and optional verification defaults to no action. Omitted
arguments or `void` values preserve those defaults. Noncallable validation or
creation rejects factory construction; noncallable verification can survive
registration and fail at resolution. The pack enforces the public typed contract
for `addVerificationPolicy(null)` even though this runtime tolerates null.
Correct policies that reject input or a created value remain valid policies.

Validation and verification must complete synchronously. Inline async or generator
policies and directly referenced same-scope const/function declarations are
denied: validation expects its result immediately, while verification
does not await a promise or execute an iterator. Async/generator verification is
an explicit enforcement policy; the public void callback type accepts it.
Validation returns must be booleans or `{ valid: boolean, msg?: string }`.
Known wrong literal returns, empty returns/bodies and malformed literal result
objects are denied, including the callback's own conditional returns. Nested
helpers are excluded, effective last field assignments are respected, and
legitimate false results or throws remain valid rejection policies. Pack 1.17.0
follows initialized const callables and unmodified, unique function declarations,
including hoisted/exported forms, at their direct first-argument use. Explicit
rebinding or duplicate declarations defer inference. The write search includes
nested shadows conservatively. Pack 1.18.0 also follows one immutable const alias
in the same scope, provided source and alias initialization precede their uses.
Hoisted function definitions remain valid sources. Multiple/destructured aliases,
imported/cross-scope policies, mutable bindings, dynamic returns,
computed/spread/getter/prototype shapes and complete return-flow
inference remain unresolved. Verification return values are not constrained.
See the named-policy contrast
for truthy malformed validation results, delayed verification and valid replacement
controls. This is optional-pack data; the core does not infer dcouplr semantics.
The alias-policy contrast
records the added controls and the retained multi-alias gap.

Setup requires a string `charEncoding` under the public type contract. Plain
literal configurations must use public keys, `run`/`test` mode, boolean `ephemeral`
and supported `forbiddenElements`; `inspector` accepts a boolean/object and
`systemDependencies` uses the eight public factory keys. A direct literal factory
requires a string `__semanticIdentifier` and callable synchronous `create`.
Identifiers can be application-specific; dictionary registration owns the system
key. Static class factories can satisfy the public structural contract and remain
unresolved. Duplicate keys use the last value at each nested level. Optional
undefined, shorthand and dynamic values remain valid or unresolved; spread,
computed, getter, method, prototype and escaped-key configurations need project
verification, as do named factories and actual output member/behavior contracts.
These are reserved call-name predicates, not imported receiver/type inference.
See system factory evidence.

Inspector options use the public field types: string `host`/`instanceId`, numeric
`port`/`maxEvents`, boolean `captureOnStart`/`announce`, and boolean or object
`debugConsole` with optional boolean `enabled` and string `path`. The check covers
setup's nested inspector options and direct `startDcouplrInspector(app, options)`.
Only setup's `inspector` also accepts a boolean. Absent/undefined fields, port zero
and zero stored events remain valid; effective last literal keys own their fields.
Compatible static class options remain unresolved; `bigint` literals do not
satisfy numeric fields.
Pack 1.13.0 also rejects direct `Infinity`/`NaN` and their `Number`/`globalThis`
constant forms in numeric inspector fields, with unary and transparent value
wrappers. These values can disable bounded retention or discard every event.
Any explicit binding of these global names anywhere in the file, escaped binding
text or `with` conservatively defers that predicate. This avoids treating local
values as standard globals; it does not resolve lexical scopes. Arithmetic,
overflow literals, aliases and wrapped receivers remain unresolved.
This is bounded field/value validation, not proof of valid numeric ranges, local-only
binding, authorization, production configuration or lifecycle. The actual inspector
has a production guard, but origin restrictions do not authorize HTTP commands.
See inspector evidence.
The finite-budget contrast
records the additional policy, valid controls and remaining numeric gaps.

The factory policies identify the first inline arrow/function creator through
literal dot/bracket/template members, optional calls and transparent member or
callback wrappers. Extra callbacks do not become creators or component-root
exceptions. Bounded named creator ownership follows the const/declaration rules
described above, plus one immutable const alias for effect and parameter checks.
Multi-alias, mutable, imported, cross-scope, generator and indirect creators remain
unresolved; returned-constructor value wrappers are a separate limitation.
See factory ownership evidence.

`settings.setSetting` cannot overwrite `charEncoding`, `mode`, `ephemeral`,
`forbiddenElements` or `instanceId`; configure system values in setup and use
runtime keys for application settings. Direct receiver shapes are covered; named
settings aliases and dynamic/escaped keys remain unresolved. Omitted `ephemeral`
remains valid, but the pinned setup path forwards undefined and overwrites the
kernel constructor's true stored default. The delivery gates separately apply
`getSetting('ephemeral') ?? true`: with no broker adapter, omitted/undefined/true
uses blocking local delivery, while false uses nonblocking local delivery.
The delivery contrast verifies
that behavior; a stored undefined value alone does not establish a nonblocking
default. Choose and verify the application's actual lifetime policy.
The pack does not certify consumer broker delivery or whole-program setup
order guarantees. See bootstrap evidence.

Direct fluent singleton registration accepts omitted input or a nonnull object.
Arrays and regular-expression objects remain valid under the actual object
contract; primitive values and functions reject registration. Named stage handles,
unknown values, spreads and callback aliases remain outside these syntactic checks.

```sh
bun scripts/dcouplr-source-probe.ts --fetch
# Or use an already extracted, matching package:
bun scripts/dcouplr-source-probe.ts /path/to/package
# Regenerate or verify the public API inventory against that exact artifact:
bun scripts/dcouplr-coverage.ts /path/to/package
bun scripts/dcouplr-coverage.ts --check /path/to/package
```

This development probe compares pack findings with 616 real executions of the
published runtime. Archive SHA-512 and runtime/declaration/ESLint/inspector/asset SHA-256 pins
reject unreviewed source before execution. Fetching has a 30-second/16 MiB budget;
scratch downloads and modules are removed. No runtime dependency is installed.
The probe also rejects a stale API inventory. The shared [upstream pin](upstream-pin.json)
is distinct from the pack's own source manifest and version.
Linux and Windows CI run the same probe. It verifies input/kernel injection,
production/test force admission, singleton replacement and queue capacity and
constructor bounds, required input shape and stricter public type contracts.
It records kernel ownership warnings and preserved injection as well as the
persistence effects of tolerated invalid flags/modes. Event/message delivery and
teardown cases expose delayed failures and retained listeners. Nonintegral
scientific-notation capacity and display-ID/subscription-ID ownership remain
explicit runtime-only cases. Controlled canaries do not replace
independently labeled calibration on a real consuming project.
Saga controls retain custom-queue construction, matching correlation, idempotent
start/stop and subscription removal. Generator handlers register but do not run
their bodies during delivery; the pack rejects their literal declarations.
Repeated unescaped literal join references are checked across single, double and
template quote forms. Duplicate node IDs, unknown references and dynamic/escaped reference equality remain
runtime-only graph controls. See saga contracts
and mixed-quote reference verification.
The probe also runs the repository's pinned TypeScript compiler against the
integrity-checked public declarations: twenty-five valid assignments pass and forty-six
invalid assignments produce the exact expected diagnostics. This independently confirms
validation/setup/saga/system-factory/inspector types and shows the void callback, forbidden-name, system-key
and nonempty-collection gaps in those public types; it is not a consumer's
whole-project typecheck. The development probe requires installed dev dependencies.
The 32 added delivery/exception cases expose delayed completion, nested broadcast
failures, resolved broker failures, actual fallback defaults, routing/context and
report-versus-throw behavior. Their runtime-only classification does not become
static coverage because a project requirement now references them. The compiled
example's consumer assertion is separate from these upstream canaries.
Eighteen added logging cases separately exercise configured delegation, child
and call context precedence, shallow bindings, all six levels, eager versus
guarded expensive data, overload arguments, fatal control flow, flush lifetime
and rejection, and monitor/sink differences. The complete probe now passes
634 runtime scenarios and the same 71 public-type controls. Reflection on the
unexported default logger constructor is only an internal runtime oracle in
those canaries; it is not a recommended public construction API.
Twenty-nine added queue cases distinguish memory admission from actual
durability, repository selection, held/rejected leading operations, lagging
batches and unhandled failure, discard races, recovery validation and storage
ownership. The complete probe now passes 663 runtime scenarios and the same
71 public-type controls. Controlled timer callbacks avoid sleeps and restore
globals/listeners afterward. The captured background rejection is an upstream
observation, not a fix to the library or proof of a consumer's failure policy.

Observed source facts guide the next checks: factories are invoked according to
`Function.length`; setup repeated after initialization is a no-op; the global
forbidden-element guard applies in test mode and cannot promise protection across
arbitrary awaited work. Queue persistence is optional for general queues, while
the built-in structured-saga queue requires a persistence provider. A complete
pack must preserve these conditions instead of inventing blanket requirements.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.27.1`. 82 distinct check IDs.

Methodologies: `dcouplr/delivery` (preview), `dcouplr/events` (preview), `dcouplr/factories` (preview), `dcouplr/factory-runtime` (preview), `dcouplr/logging` (preview), `dcouplr/managed-components` (preview), `dcouplr/messages` (preview), `dcouplr/observability` (preview), `dcouplr/queue-runtime` (preview), `dcouplr/queues` (preview), `dcouplr/runtime` (preview), `dcouplr/saga-runtime` (preview), `dcouplr/sagas` (preview), `dcouplr/utility-runtime` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
