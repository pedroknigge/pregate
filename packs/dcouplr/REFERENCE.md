# dcouplr pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.27.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## dcouplr/delivery

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-DELIVERY-001

Check: [`dcouplr/delivery/requirement-001@1.0.0`](checks/delivery/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r001`. Minimum severity: `deny`.

A path that requires completed local delivery must wait for the blocking event or message operation before it reports completion. It must handle the actual aggregate failure, including nested causes for a broadcast. Apply when a caller's success depends on local listeners or handlers finishing. A deliberate background path can use a different reviewed lifetime policy.

Default parameters: `{"verifier":"DCP-DELIVERY-001"}`.

**Repair:** Hold a real listener or handler on a deferred promise. Assert the application response remains pending until release. Make two listeners fail and verify the response/error policy preserves both causes, including the broadcast's nested errors. Bind DCP-DELIVERY-001 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-001.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IEventRaiser and IMessageGate; dist/index.mjs DBaseBus.emitBlocking/emitToAllBlocking, EventGate.raiseLocalBlocking, MessageGate.sendLocalBlocking",
  "paraphrase": "A path that requires completed local delivery must wait for the blocking event or message operation before it reports completion. It must handle the actual aggregate failure, including nested causes for a broadcast."
}
```

### dcouplr/DCP-DELIVERY-002

Check: [`dcouplr/delivery/requirement-002@1.0.0`](checks/delivery/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r002`. Minimum severity: `deny`.

A fire-and-forget path must own the listener lifetime and its failure policy. It must not treat awaiting a void local call or a synchronous try/catch as proof that delivery completed or that listener errors were handled. Apply to raise/raiseLocal and send/sendLocal paths. Preserve intentionally nonblocking long-lived work when its lifetime and error policy are explicit.

Default parameters: `{"verifier":"DCP-DELIVERY-002"}`.

**Repair:** Hold the listener while the application path returns and inspect its lifecycle policy. Inject a listener error and verify the onError/observability path records or handles it. A negative control that merely awaits the void call must fail the application's completion assertion. Bind DCP-DELIVERY-002 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-002.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IEventRaiser.raiseLocal and IMessageGate.sendLocal; dist/index.mjs EventGate.raiseLocal, MessageGate.sendLocal, DBaseBus.emit",
  "paraphrase": "A fire-and-forget path must own the listener lifetime and its failure policy. It must not treat awaiting a void local call or a synchronous try/catch as proof that delivery completed or that listener errors were handled."
}
```

### dcouplr/DCP-DELIVERY-003

Check: [`dcouplr/delivery/requirement-003@1.0.0`](checks/delivery/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r003`. Minimum severity: `deny`.

A broker path must preserve the adapter handoff for the caller's lifetime and must handle adapter failures through the configured error policy. A resolved broker promise must not be presented as proof of remote processing. Apply to raiseBroker and sendBroker. When remote completion is a requirement, use a separate acknowledgment or product contract rather than infer it from handoff.

Default parameters: `{"verifier":"DCP-DELIVERY-003"}`.

**Repair:** Delay the actual configured adapter's handoff and assert a short-lived entry point remains pending. Reject handoff and verify its error callback/policy. Assert no success claim of remote processing is made before the separate acknowledgment. Bind DCP-DELIVERY-003 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-003.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts broker method comments; dist/index.mjs EventGate.raiseBroker and MessageGate.sendBroker",
  "paraphrase": "A broker path must preserve the adapter handoff for the caller's lifetime and must handle adapter failures through the configured error policy. A resolved broker promise must not be presented as proof of remote processing."
}
```

### dcouplr/DCP-DELIVERY-004

Check: [`dcouplr/delivery/requirement-004@1.0.0`](checks/delivery/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r004`. Minimum severity: `deny`.

A path that permits broker fallback must verify the actual fallback against its lifetime and completion requirements. It must not assume that broker methods always wait for local listeners. The pinned fallback waits when ephemeral is omitted, undefined or true, and does not wait when ephemeral is false. Apply when no custom broker adapter is configured. A custom adapter has its own reviewed handoff contract. An explicitly nonblocking persistent-process policy remains valid.

Default parameters: `{"verifier":"DCP-DELIVERY-004"}`.

**Repair:** Exercise the deployed setup options without a broker adapter and hold a real fallback listener. Assert the required response/lifetime behavior for every supported environment. Check effective behavior rather than the stored setting alone. Bind DCP-DELIVERY-004 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-004.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs EventGate and MessageGate constructors: getSetting('ephemeral') ?? true and fallback emitBlocking versus emit; kernel/settings setup spread",
  "paraphrase": "A path that permits broker fallback must verify the actual fallback against its lifetime and completion requirements. It must not assume that broker methods always wait for local listeners. The pinned fallback waits when ephemeral is omitted, undefined or true, and does not wait when ephemeral is false."
}
```

### dcouplr/DCP-DELIVERY-005

Check: [`dcouplr/delivery/requirement-005@1.0.0`](checks/delivery/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r005`. Minimum severity: `deny`.

Each event subscription must have an owned listener reference or returned subscription ID for teardown. A function reference must not be subscribed twice through the gate. A display label must not be used as the subscription ID. Apply to event-gate subscriptions and their lifecycle. Distinct closures may share a display label. The explicit nonempty-channel policy remains a separate syntax rule for the built-in bus.

Default parameters: `{"verifier":"DCP-DELIVERY-005"}`.

**Repair:** Create and remove actual subscriptions through the owning application component. Assert delivery stops after disposal and repeated disposal is safe. Exercise duplicate references and display-label/subscription-ID confusion as negative controls. Bind DCP-DELIVERY-005 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-005.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IEventSubscriber; dist/index.mjs EventGate listener/subscription maps and teardown",
  "paraphrase": "Each event subscription must have an owned listener reference or returned subscription ID for teardown. A function reference must not be subscribed twice through the gate. A display label must not be used as the subscription ID."
}
```

### dcouplr/DCP-DELIVERY-006

Check: [`dcouplr/delivery/requirement-006@1.0.0`](checks/delivery/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r006`. Minimum severity: `deny`.

Each message handler must own its effective peer and returned subscription ID. Two active handlers must not claim the same trimmed peer. Teardown must use that peer or the returned subscription ID, not the handler display label. Apply to message-gate registration and disposal. Omitted or blank peers may generate distinct anonymous addresses; a product need not invent an address when no external caller needs one.

Default parameters: `{"verifier":"DCP-DELIVERY-006"}`.

**Repair:** Exercise application registration, resolution of anonymous peers and disposal. Assert only the intended handler owns a trimmed address and no delivery occurs after disposal. Include duplicate-peer and wrong-ID controls. Bind DCP-DELIVERY-006 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-006.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IMessageGate; dist/index.mjs MessageGate registration, peer normalization and teardown",
  "paraphrase": "Each message handler must own its effective peer and returned subscription ID. Two active handlers must not claim the same trimmed peer. Teardown must use that peer or the returned subscription ID, not the handler display label."
}
```

### dcouplr/DCP-DELIVERY-007

Check: [`dcouplr/delivery/requirement-007@1.0.0`](checks/delivery/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r007`. Minimum severity: `deny`.

A direct-message path must pass the intended destination as to. A path that omits or blanks to must permit broadcast explicitly. It must not use sourceType as the destination or an authorization decision. Apply when business behavior distinguishes directed messages from broadcast. Broadcast is valid when the product contract calls for it.

Default parameters: `{"verifier":"DCP-DELIVERY-007"}`.

**Repair:** Register two actual peers and exercise the product sender. Assert directed traffic reaches only the intended peer and broadcast reaches the permitted set. Include omitted-destination and sourceType-as-routing negative controls. Bind DCP-DELIVERY-007 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-007.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IMessageGate routing comments; dist/index.mjs MessageGate.#prepareForDelivery and DMessageBus.emit/emitBlocking",
  "paraphrase": "A direct-message path must pass the intended destination as to. A path that omits or blanks to must permit broadcast explicitly. It must not use sourceType as the destination or an authorization decision."
}
```

### dcouplr/DCP-DELIVERY-008

Check: [`dcouplr/delivery/requirement-008@1.0.0`](checks/delivery/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r008`. Minimum severity: `deny`.

A path that reads event or message context must distinguish caller correlation/source data from runtime timestamp, instanceId and delivery scope. Caller-supplied context must not be trusted as authentication or as an unchanged runtime identity. Apply to tracing, attribution, authorization and tests that depend on delivered context. The gate rewrites timestamp, instanceId and scope; it preserves other submitted context fields through a shallow copy.

Default parameters: `{"verifier":"DCP-DELIVERY-008"}`.

**Repair:** Submit known correlation/source values and conflicting valid runtime-context values through actual application paths. Assert which values survive and which the configured gate replaces. Test authorization independently of sourceType or correlation metadata. Bind DCP-DELIVERY-008 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-008.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs EventGate.#withRuntimeTimestamp and MessageGate.#withRuntimeTimestamp/#withRuntimeMessageScope",
  "paraphrase": "A path that reads event or message context must distinguish caller correlation/source data from runtime timestamp, instanceId and delivery scope. Caller-supplied context must not be trusted as authentication or as an unchanged runtime identity."
}
```

### dcouplr/DCP-DELIVERY-009

Check: [`dcouplr/delivery/requirement-009@1.0.0`](checks/delivery/requirement-009/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r009`. Minimum severity: `deny`.

A failure path that must stop execution must use an actual throwing or explicit rejection/return path. It must not rely on exception.report or legacy quiet throw to stop execution or return a business value. Apply when subsequent work would be invalid after the failure. Nonfatal reporting is valid when execution is intended to continue. The report method's never type is not a runtime guarantee.

Default parameters: `{"verifier":"DCP-DELIVERY-009"}`.

**Repair:** Exercise the product's actual failure branches. Assert forbidden effects and success responses do not occur after a fatal failure. Preserve deliberate reporting branches and test that report returns undefined and continues in the pinned runtime. Bind DCP-DELIVERY-009 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-009.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IExceptionGate explicit report/never qualification; dist/index.mjs DExceptionGate.throw/report",
  "paraphrase": "A failure path that must stop execution must use an actual throwing or explicit rejection/return path. It must not rely on exception.report or legacy quiet throw to stop execution or return a business value."
}
```

### dcouplr/DCP-DELIVERY-010

Check: [`dcouplr/delivery/requirement-010@1.0.0`](checks/delivery/requirement-010/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.delivery.r010`. Minimum severity: `deny`.

A custom event or message broker adapter must return the declared promise from raise or send and preserve its handoff/error behavior. The existence of a function member is not evidence that the adapter meets that contract. Apply to configured broker replacements and wrappers. Upstream output verification checks callable members; consumers must verify return and behavioral contracts too.

Default parameters: `{"verifier":"DCP-DELIVERY-010"}`.

**Repair:** Run the actual configured adapter with delayed handoff and rejection controls. Assert a promise is returned and the gate's error policy sees failures. Include an adapter whose member returns undefined; callable shape alone must not pass the product assertion. Bind DCP-DELIVERY-010 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-DELIVERY-010.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.d.mts IEventBrokerAdapter/IMessageBrokerAdapter; dist/index.mjs verifyEventBrokerAdapterFactoryOutput/verifyMessageBrokerAdapterFactoryOutput and broker gate calls",
  "paraphrase": "A custom event or message broker adapter must return the declared promise from raise or send and preserve its handoff/error behavior. The existence of a function member is not evidence that the adapter meets that contract."
}
```

## dcouplr/events

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-EVENT-SUB-001

Check: [`dcouplr/events/subscription-contract@1.0.0`](checks/events/subscription-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.event-subscription-contract`. Minimum severity: `none`.

EventGate and the low-level event bus have different argument order. Reversing them can fail immediately or retain a noncallable listener until delivery. Empty string event types are accepted by the published types/runtime, but the built-in bus fails to remove their listeners; the explicit nonempty-channel policy prevents this leak.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Call kernel.event.subscribe(listener, eventType, listenerId). Store the returned subscription ID when teardown uses that ID.

**Scope and limits:** Reserved event/message member policy in selected paths, not receiver-type inference. Direct dot, unescaped literal bracket/template and optional calls, comments and transparent parentheses/as/satisfies/non-null values are covered. Known literal argument failures and missing required slots are checked. Low-level eventBus/messageBus and unrelated receivers remain valid. Named gate/function aliases, dynamic/computed/escaped members, spreads, unknown expression types, callback return types and cross-call ownership are unresolved. Review narrower paths for an unrelated API with the same member names.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published public declarations and runtime; explicit PREGATE empty-channel policy",
  "locator": "dist/index-C3YI4Tf9.d.mts IEventSubscriber, lines 58–93; dist/index.mjs EventGate.subscribe, lines 1423–1464",
  "paraphrase": "EventGate.subscribe takes listener first, a nonempty eventType second, and an optional string listenerId."
}
```

### dcouplr/DCP-EVENT-TEARDOWN-001

Check: [`dcouplr/events/teardown-contract@1.0.0`](checks/events/teardown-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.event-teardown-contract`. Minimum severity: `none`.

The gate indexes listeners by function identity and subscription IDs separately. A string passed to unsubscribe or a new callback silently leaves the existing subscription active.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Use kernel.event.unsubscribe(originalListener), or kernel.event.unsubscribeBySubscriptionId(subscriptionId). Do not construct a new listener for removal.

**Scope and limits:** Reserved event/message member policy in selected paths, not receiver-type inference. Direct dot, unescaped literal bracket/template and optional calls, comments and transparent parentheses/as/satisfies/non-null values are covered. Known literal argument failures and missing required slots are checked. Low-level eventBus/messageBus and unrelated receivers remain valid. Named gate/function aliases, dynamic/computed/escaped members, spreads, unknown expression types, callback return types and cross-call ownership are unresolved. Review narrower paths for an unrelated API with the same member names.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published public declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IEventSubscriber, lines 58–93; dist/index.mjs EventGate.unsubscribe/unsubscribeBySubscriptionId, lines 1465–1489",
  "paraphrase": "EventGate teardown needs the original listener reference or the returned subscription ID through its matching API."
}
```

## dcouplr/factories

Manifest version: `1.10.1`. Status: **preview**.

### dcouplr/DCP-FACTORY-SYNC-001

Check: [`dcouplr/factories/synchronous-policies@1.2.0`](checks/factories/synchronous-policies/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.synchronous-policy`. Minimum severity: `none`.

An async validator returns a promise instead of the required result. A generator policy returns an iterator without executing its body. Async verification can finish after an unverified value has already escaped; TypeScript's void callback assignability does not prevent that behavior.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Use synchronous, nongenerator validation and verification callbacks. Finish required asynchronous work at an explicit boundary before resolving, then pass its admitted result into synchronous creation. Do not move required verification into an unawaited callback.

**Scope and limits:** Reserves addValidationPolicy/addVerificationPolicy member names in selected paths. Covers inline async/generator callbacks and initialized immutable const or unmodified function/generator declarations passed as the direct first argument in the same lexical scope, including exported definitions and hoisted declarations. Also follows one same-scope immutable const alias whose initialization precedes that argument. Explicit writes and duplicate declarations defer declaration inference; the write search conservatively includes nested shadows. Literal dot/bracket/template members, optional calls, comments and transparent expression wrappers are covered. A trailing argument spread cannot replace an explicit first callback; leading spreads remain unresolved. Mutable/imported/cross-scope policies, multiple or destructured aliases, dynamic members and indirect promise/return flow remain unresolved. Async verification is an explicit enforcement policy, not a claim that the public void type rejects it. This rule does not restrict async factory creators or event/message callbacks. Narrow paths for unrelated APIs.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published declarations/runtime; explicit synchronous-verification policy",
  "locator": "dist/index.mjs makeFactory.create, lines 513–524; dist/index-C3YI4Tf9.d.mts CreationValidationPolicy/AfterCreationVerificationPolicy, lines 743–760",
  "paraphrase": "Creation reads the validation result immediately and invokes verification without awaiting completion. Async validation violates its result contract; async/generator verification cannot guarantee that the created value is verified before resolution returns."
}
```

### dcouplr/DCP-FACTORY-VALIDATION-001

Check: [`dcouplr/factories/validation-result-contract@1.2.0`](checks/factories/validation-result-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.validation-result`. Minimum severity: `none`.

A malformed literal return can crash or reject creation. Truthy nonboolean valid fields can silently admit creation and bypass the intended validator.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Return true/false or { valid: boolean, msg?: string }. Use false or an explicit throw for rejected input. Keep verification as a separate policy. Correct an invalid return inside the validator itself.

**Scope and limits:** Checks inline arrow/function validation callbacks and initialized immutable const or unmodified function declarations passed as the direct first argument in the same lexical scope, including exported definitions and hoisted declarations. Also follows one same-scope immutable const alias whose initialization precedes that argument. Explicit writes and duplicate declarations defer declaration inference; the write search conservatively includes nested shadows. Known invalid expression returns, empty bodies, empty returns and invalid returns in the callback's own nested control flow are covered; nested helpers/classes are excluded. Plain literal objects use the last valid/msg assignment, including quoted keys and shorthand unknowns. Spreads, computed/escaped keys, getters and custom prototypes remain unresolved. Mutable/imported/cross-scope policies, multiple or destructured aliases, dynamic result values, call results, callable/class/regex values, reachability, fallthrough and complete return inference remain unresolved. Synchronous verification's return value is not restricted; this rule does not prove actual DTO validation or mandatory-field compliance. Narrow paths for unrelated APIs.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts ValidationResult, lines 740–754; dist/index.mjs makeFactory.create, lines 517–518",
  "paraphrase": "Validation returns a boolean or an object with boolean valid and optional string msg. The runtime reads valid synchronously; it does not validate that the result has this typed shape."
}
```

### dcouplr/DCP-FACTORY-SEQUENCE-001

Check: [`dcouplr/factories/admission-sequence@1.0.0`](checks/factories/admission-sequence/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.factory-admission-sequence`. Minimum severity: `none`.

Skipping, repeating or reversing a stage calls an unavailable method. createOnly returns a factory, while registration returns a distinct handle whose metadata operations can be chained in any order.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Call declareIntent(...).addMandatoryInputFields(...).addValidationPolicy(...).addVerificationPolicy(...).addFactoryMethod(creator), then createOnly or a registration method. Optional stage arguments can be omitted, but the stage itself cannot. Add interaction metadata only to the registration handle.

**Scope and limits:** Reserves adjacent direct fluent admission method names in selected paths, not receiver-type inference. Covers the 225 pairs of 15 documented stage/terminal/metadata methods, literal dot/bracket/template members, optional calls, comments and transparent expression wrappers. Unrelated APIs with these names need narrower paths. Named stage handles, aliases, dynamic/escaped methods, custom properties and whole-program bootstrap order remain unresolved. Does not validate arguments, metadata values, intent ownership or mode; separate rules cover some of those contracts. A factory's create call remains valid.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts DependencyAdmissionStep1–5 and DependencyAdmissionRegistration, lines 815–882; dist/index.mjs createStep2–5 and DependencyAdmission, lines 529–654",
  "paraphrase": "Admission follows declareIntent, mandatory fields, validation, verification, creator and a terminal action. Interaction metadata belongs to the returned registration handle, not the factory or unfinished stages."
}
```

### dcouplr/DCP-FACTORY-CALLABLE-001

Check: [`dcouplr/factories/callback-contract@1.0.0`](checks/factories/callback-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.factory-callback-contract`. Minimum severity: `none`.

A nonfunction creator or validation policy rejects factory construction. A nonfunction verification policy can remain admitted until resolution. Null verification is tolerated at runtime but violates the public typed contract.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Pass a function or a reviewed function reference to addFactoryMethod. Omit optional policies or pass functions; the default validation policy returns true and default verification does nothing.

**Scope and limits:** Reserves direct addFactoryMethod/addValidationPolicy/addVerificationPolicy method names in selected paths, not receiver-type inference. Checks absent creators and known noncallable literal values, dot/literal-bracket/optional calls, comments and transparent value wrappers. Spreads, dynamic/computed/escaped methods and unknown identifiers/expressions remain unresolved. Bare undefined can be shadowed; omitted arguments and void expressions have distinct coverage. Does not prove policy return types, factory effects, staged order or alias ownership. Narrow paths for unrelated APIs with these names.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published declarations and runtime",
  "locator": "dist/index.mjs makeFactory/createStep2–5, lines 504–570; dist/index-C3YI4Tf9.d.mts admission steps, lines 815–825",
  "paraphrase": "A creator is required and callable. Optional validation/verification policies may be omitted; supplied policies must be callable under the public contract."
}
```

### dcouplr/DCP-FACTORY-SINGLETON-001

Check: [`dcouplr/factories/singleton-input-contract@1.0.0`](checks/factories/singleton-input-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.factory-singleton-input-contract`. Minimum severity: `none`.

Fluent singleton registration rejects a primitive, null or a function before admitting the factory. Omitted input is valid; arrays and regular-expression objects are also objects and must not be denied merely for their form.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Use registerSingleton(inputDto) or registerSingletonForce(inputDto) with an object, or omit the argument when no creation input is needed. Force registration still requires test mode.

**Scope and limits:** Checks only direct fluent addFactoryMethod(...).registerSingleton/registerSingletonForce chains by method names in selected paths, not receiver-type inference. Dot/literal-bracket/optional calls, comments and transparent value wrappers are covered. Named stage handles, aliases, dynamic/computed/escaped members, spreads and unknown expression types remain unresolved. Does not prove mandatory input fields, singleton ownership, duplicate intent handling or test-mode configuration.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published declarations and runtime",
  "locator": "dist/index.mjs DependencyAdmission.#assertValidSingletonParams, lines 613–632; dist/index-C3YI4Tf9.d.mts terminal admission steps, lines 827–844",
  "paraphrase": "A supplied singleton input must be a nonnull object; omission is allowed. Arrays and other object values remain accepted."
}
```

### dcouplr/DCP-INJECT-001

Check: [`dcouplr/factories/no-uninjected-required-parameter@1.4.0`](checks/factories/no-uninjected-required-parameter/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.factory-injected-arguments`. Minimum severity: `none`.

A third required runtime parameter receives undefined even when the caller supplies an input DTO.

Default parameters: `{}`.

**Repair:** Put application data in inputDto and resolve collaborators through the injected dKernel. Keep at most two required runtime parameters.

**Scope and limits:** Identifies the first inline arrow/function creator argument through literal dot/bracket/template members, optional calls, comments and parenthesized/as/satisfies/non-null wrappers. Also follows an immutable const initialized with an arrow/function expression when its direct first-argument reference follows initialization in the same lexical scope. Same-scope function declarations, including hoisted and exported declarations, retain these policies only when no explicit assignment/update/loop target, variable declaration or duplicate function declaration can replace the name. The write search is conservative across nested scopes: a shadowed write can defer inference. Exported const creators retain the policies after initialization. These forms do not grant exclusive constructor-root ownership. Also follows one same-scope immutable const alias initialized before registration. Extra callbacks and leading spreads do not establish ownership. Zero/one/two parameters, optional/default later parameters, rest parameters and erased this remain valid. Multiple or destructured aliases, mutable/cross-scope/imported creators, receiver identity, dynamic/escaped names, generators, type assertions and indirect values remain unresolved.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published runtime",
  "locator": "dist/index.mjs invokeFactoryCreator, lines 461–465",
  "paraphrase": "Factory invocation supplies no argument after inputDto and dKernel."
}
```

### dcouplr/DCP-FACTORY-EFFECTS-001

Check: [`dcouplr/factories/no-ambient-factory-effects@1.5.0`](checks/factories/no-ambient-factory-effects/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.no-ambient-factory-effects`. Minimum severity: `none`.

An admission factory must use injected dependencies instead of ambient effects.

Default parameters: `{"allow":[]}`.

**Repair:** Receive dKernel as the second factory argument and use a gate or registered port. The adapter that implements that port, and a negative-control test of the runtime guard, are excluded file by file through an override's params.exclude; params.allow exempts a member in every factory.

**Scope and limits:** Identifies the first inline arrow/function creator argument through literal dot/bracket/template members, optional calls, comments and parenthesized/as/satisfies/non-null wrappers. Also follows an immutable const initialized with an arrow/function expression when its direct first-argument reference follows initialization in the same lexical scope. Same-scope function declarations, including hoisted and exported declarations, retain these policies only when no explicit assignment/update/loop target, variable declaration or duplicate function declaration can replace the name. The write search is conservative across nested scopes: a shadowed write can defer inference. Exported const creators retain the policies after initialization. These forms do not grant exclusive constructor-root ownership. Also follows one same-scope immutable const alias initialized before registration. Extra callbacks and leading spreads do not establish ownership. Reserves addFactoryMethod by name in reviewed paths. Erased type queries remain admitted, executable references remain checked. Multiple or destructured aliases, mutable/cross-scope/imported creators, dynamic/escaped names, generators, type assertions, indirect values and receiver identity remain unresolved.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "allow": {
    "type": "array",
    "items": {
      "type": "string",
      "pattern": "^[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)+$"
    }
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published source; explicit PREGATE project policies",
  "locator": "dist/eslint/index.mjs createForbiddenElementInFactoryRule; dist/index.mjs createForbiddenElementsGuardedFactory",
  "paraphrase": "An admission factory must use injected dependencies instead of ambient effects."
}
```

### dcouplr/DCP-ARITY-001

Check: [`dcouplr/factories/no-default-factory-parameters@1.4.0`](checks/factories/no-default-factory-parameters/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.no-default-factory-parameters`. Minimum severity: `none`.

A default factory parameter can change Function.length and prevent input or kernel injection.

Default parameters: `{}`.

**Repair:** Keep required positional inputDto and dKernel parameters when needed. Apply defaults in the body.

**Scope and limits:** Identifies the first inline arrow/function creator argument through literal dot/bracket/template members, optional calls, comments and parenthesized/as/satisfies/non-null wrappers. Also follows an immutable const initialized with an arrow/function expression when its direct first-argument reference follows initialization in the same lexical scope. Same-scope function declarations, including hoisted and exported declarations, retain these policies only when no explicit assignment/update/loop target, variable declaration or duplicate function declaration can replace the name. The write search is conservative across nested scopes: a shadowed write can defer inference. Exported const creators retain the policies after initialization. These forms do not grant exclusive constructor-root ownership. Also follows one same-scope immutable const alias initialized before registration. Extra callbacks and leading spreads do not establish ownership. Zero/one-argument creators remain supported. This advisory does not prove both values are needed; later defaults can be harmless. Multiple or destructured aliases, mutable/cross-scope/imported creators, dynamic/escaped names, generators, type assertions and indirect values remain unresolved.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published source; explicit PREGATE project policies",
  "locator": "dist/index.mjs invokeFactoryCreator, lines 461–465",
  "paraphrase": "A default factory parameter can change Function.length and prevent input or kernel injection."
}
```

## dcouplr/factory-runtime

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-FACTORY-RUNTIME-001

Check: [`dcouplr/factory-runtime/requirement-001@1.0.0`](checks/factory-runtime/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.factory-runtime.r001`. Minimum severity: `deny`.

The composition root must own setup before runtime access and must apply one reviewed configuration. A second setup call must not be used to change a running configuration. A system factory must not use normal dependency gates through the bootstrap placeholder. The product initializes dcouplr or supplies a system factory.

Default parameters: `{"verifier":"DCP-FACTORY-RUNTIME-001"}`.

**Repair:** Exercise the actual first setup, access before setup and attempted reconfiguration. Assert the effective configuration and system-factory bootstrap dependencies. The pinned setup ignores later calls; early system factories receive a placeholder whose dependency operations reject access. Inspector readiness is a separate asynchronous boundary. Bind DCP-FACTORY-RUNTIME-001 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-FACTORY-RUNTIME-001.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:780-837,1086-1154,3615-3620,3632-3660",
  "paraphrase": "The composition root must own setup before runtime access and must apply one reviewed configuration. A second setup call must not be used to change a running configuration. A system factory must not use normal dependency gates through the bootstrap placeholder."
}
```

### dcouplr/DCP-FACTORY-RUNTIME-002

Check: [`dcouplr/factory-runtime/requirement-002@1.0.0`](checks/factory-runtime/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.factory-runtime.r002`. Minimum severity: `deny`.

Each semantic identifier must have a documented owner and lifetime. Lookup and resolution must use the same lifetime. A transient and a singleton with the same identifier must be an explicit reviewed decision, not an accidental collision. The product admits or resolves dependencies.

Default parameters: `{"verifier":"DCP-FACTORY-RUNTIME-002"}`.

**Repair:** Assert ownership across both registration stores, regular and singleton presence, the matching resolver and missing or duplicate registrations. The pinned runtime permits the same identifier in both stores and has does not see a singleton. Do not infer singleton presence from has or use a wrong resolver as a fallback. Bind DCP-FACTORY-RUNTIME-002 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-FACTORY-RUNTIME-002.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:842-880,1020-1046,1081-1086",
  "paraphrase": "Each semantic identifier must have a documented owner and lifetime. Lookup and resolution must use the same lifetime. A transient and a singleton with the same identifier must be an explicit reviewed decision, not an accidental collision."
}
```

### dcouplr/DCP-FACTORY-RUNTIME-003

Check: [`dcouplr/factory-runtime/requirement-003@1.0.0`](checks/factory-runtime/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.factory-runtime.r003`. Minimum severity: `deny`.

Factory input admission must enforce the actual domain constraints before the creator runs. A mandatory shape is not proof of strict input types, own-property membership or an immutable validation contract. Shared input and shape mutation must have an explicit owner. A factory accepts untrusted input, a mandatory shape or singleton creation parameters.

Default parameters: `{"verifier":"DCP-FACTORY-RUNTIME-003"}`.

**Repair:** Reject invalid domain values and assert that rejected input never reaches the creator. Test coercion-compatible values and inherited properties at the real boundary. Freeze or own the shape and nested parameters: the pinned shape is retained by reference, the input is not copied, and singleton parameters receive only a shallow copy. Bind DCP-FACTORY-RUNTIME-003 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-FACTORY-RUNTIME-003.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:467-486,517-527,566-575,1041-1046",
  "paraphrase": "Factory input admission must enforce the actual domain constraints before the creator runs. A mandatory shape is not proof of strict input types, own-property membership or an immutable validation contract. Shared input and shape mutation must have an explicit owner."
}
```

### dcouplr/DCP-FACTORY-RUNTIME-004

Check: [`dcouplr/factory-runtime/requirement-004@1.0.0`](checks/factory-runtime/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.factory-runtime.r004`. Minimum severity: `deny`.

A creator must receive the input and injected kernel that its contract needs. Its result must have the promised synchronous or asynchronous lifetime. Resolution must not be treated as awaited initialization when a creator returns a promise or iterator. The product defines a factory creator or consumes its result.

Default parameters: `{"verifier":"DCP-FACTORY-RUNTIME-004"}`.

**Repair:** Assert actual argument delivery and result use, including default-parameter arity. If an asynchronous dependency is intentional, declare its promise contract and await it at the consuming boundary with an owned failure policy. The pinned runtime invokes creators according to Function.length and returns their result without awaiting it. Verify effects through the injected ports. Bind DCP-FACTORY-RUNTIME-004 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-FACTORY-RUNTIME-004.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:461-465,517-527,1020-1035",
  "paraphrase": "A creator must receive the input and injected kernel that its contract needs. Its result must have the promised synchronous or asynchronous lifetime. Resolution must not be treated as awaited initialization when a creator returns a promise or iterator."
}
```

### dcouplr/DCP-FACTORY-RUNTIME-005

Check: [`dcouplr/factory-runtime/requirement-005@1.0.0`](checks/factory-runtime/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.factory-runtime.r005`. Minimum severity: `deny`.

Required creation verification must complete before a value is admitted to use. A verification callback must reject a failed invariant by throwing; a false return is not rejection. A configured system factory must satisfy the actual contract used by its consumers, not only callable-member admission. Creation has an output invariant or the product replaces a system dependency.

Default parameters: `{"verifier":"DCP-FACTORY-RUNTIME-005"}`.

**Repair:** Assert rejection, completion order and required output behavior through actual resolution. An async verification callback is not awaited; a generator body does not run. The pinned runtime ignores verification return values and checks only selected callable members on system outputs. Failed singleton verification is not cached; test subsequent attempts and effect repeat safety. Bind DCP-FACTORY-RUNTIME-005 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-FACTORY-RUNTIME-005.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:517-527,1026-1035,3377-3386,3391-3547",
  "paraphrase": "Required creation verification must complete before a value is admitted to use. A verification callback must reject a failed invariant by throwing; a false return is not rejection. A configured system factory must satisfy the actual contract used by its consumers, not only callable-member admission."
}
```

### dcouplr/DCP-FACTORY-RUNTIME-006

Check: [`dcouplr/factory-runtime/requirement-006@1.0.0`](checks/factory-runtime/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.factory-runtime.r006`. Minimum severity: `deny`.

A dependency owner must choose transient or singleton lifetime and must verify the resulting identity, shared mutation and scope. A singleton must not hold one user's or organization's mutable state for unrelated callers. Resolution failure must have an owned retry and effect policy. A dependency is resolved repeatedly, shared across requests or materialized as a singleton.

Default parameters: `{"verifier":"DCP-FACTORY-RUNTIME-006"}`.

**Repair:** Assert repeated transient creation, singleton identity, actual constructor input and ownership of mutable fields. Exercise failed creation and null or undefined singleton results. The pinned singleton rejects only nullish results and caches other values; a transient can return null. A successful registration is not successful materialization. Bind DCP-FACTORY-RUNTIME-006 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-FACTORY-RUNTIME-006.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:846-875,1020-1035,1072-1076",
  "paraphrase": "A dependency owner must choose transient or singleton lifetime and must verify the resulting identity, shared mutation and scope. A singleton must not hold one user's or organization's mutable state for unrelated callers. Resolution failure must have an owned retry and effect policy."
}
```

### dcouplr/DCP-FACTORY-RUNTIME-007

Check: [`dcouplr/factory-runtime/requirement-007@1.0.0`](checks/factory-runtime/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.factory-runtime.r007`. Minimum severity: `deny`.

Force replacement must be confined to an owned test runtime. A replacement must not be treated as disposal or revocation of previously returned instances. The bootstrap-owned kernel must not be replaced through public admission. Tests use force registration or retain dependencies across replacement.

Default parameters: `{"verifier":"DCP-FACTORY-RUNTIME-007"}`.

**Repair:** Assert production-mode rejection, test-mode replacement and ownership of the retired instance. The pinned force singleton operation removes its cache entry but does not dispose the old value; retained references remain live. Follow the supported injected kernel instead of relying on a warning to reject reserved admission. Bind DCP-FACTORY-RUNTIME-007 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-FACTORY-RUNTIME-007.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:1047-1071,3636-3638",
  "paraphrase": "Force replacement must be confined to an owned test runtime. A replacement must not be treated as disposal or revocation of previously returned instances. The bootstrap-owned kernel must not be replaced through public admission."
}
```

### dcouplr/DCP-FACTORY-RUNTIME-008

Check: [`dcouplr/factory-runtime/requirement-008@1.0.0`](checks/factory-runtime/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.factory-runtime.r008`. Minimum severity: `deny`.

The application must own shutdown and test-reset boundaries. Shutdown must stop new application work and settle or cancel owned work and resources according to a named budget. Runtime shutdown or test reset alone must not be treated as disposal, drained handlers or revoked retained references. The product stops, resets a test runtime or replaces a runtime while references or work can remain live.

Default parameters: `{"verifier":"DCP-FACTORY-RUNTIME-008"}`.

**Repair:** Exercise the actual application's admission barrier, retained references, resource disposal, pending work and failure deadline. The pinned shutdown only records a flag; old runtime references still resolve after shutdown or global reset. Reset creates a new global runtime but does not revoke previous application references. Verify inspector closure separately. Bind DCP-FACTORY-RUNTIME-008 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-FACTORY-RUNTIME-008.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:1077-1080,1154-1180,3623-3633",
  "paraphrase": "The application must own shutdown and test-reset boundaries. Shutdown must stop new application work and settle or cancel owned work and resources according to a named budget. Runtime shutdown or test reset alone must not be treated as disposal, drained handlers or revoked retained references."
}
```

## dcouplr/logging

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-LOGGING-001

Check: [`dcouplr/logging/requirement-001@1.0.0`](checks/logging/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.logging.r001`. Minimum severity: `deny`.

Managed application logging must use the injected kernel logger or a child of that logger. A concrete logger must be constructed only in its declared adapter or composition root. The application uses dcouplr-managed components and logging. Pure value construction and a declared logger adapter are valid exceptions.

Default parameters: `{"verifier":"DCP-LOGGING-001"}`.

**Repair:** Assert the real construction and call graph, configured logger replacement, and child propagation. Add a failing control that creates or imports an unrelated logger in a managed component. Bind DCP-LOGGING-001 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-LOGGING-001.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:1564-1576,1921-1929; dist/index-C3YI4Tf9.d.mts:496-511",
  "paraphrase": "Managed application logging must use the injected kernel logger or a child of that logger. A concrete logger must be constructed only in its declared adapter or composition root."
}
```

### dcouplr/DCP-LOGGING-002

Check: [`dcouplr/logging/requirement-002@1.0.0`](checks/logging/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.logging.r002`. Minimum severity: `deny`.

A scoped logger must preserve its parent and sibling contexts. The application must verify the intended binding precedence and must not assume that a child logger deep-copies nested data. The application uses child loggers for request, organization, correlation, or other shared bindings.

Default parameters: `{"verifier":"DCP-LOGGING-002"}`.

**Repair:** Assert parent, sibling, child and call-local contexts through the actual configured adapter. Verify that context ownership prevents cross-request mutation and that sensitive data is removed before logging. Include a wrong-scope failing control. Bind DCP-LOGGING-002 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-LOGGING-002.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:2102-2133,2187-2195; dist/index-C3YI4Tf9.d.mts:498-504",
  "paraphrase": "A scoped logger must preserve its parent and sibling contexts. The application must verify the intended binding precedence and must not assume that a child logger deep-copies nested data."
}
```

### dcouplr/DCP-LOGGING-003

Check: [`dcouplr/logging/requirement-003@1.0.0`](checks/logging/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.logging.r003`. Minimum severity: `deny`.

The configured logger must enforce its level policy on writes. A caller must check isLevelEnabled before it constructs expensive optional logging data. The caller must not assume that the gate prevents adapter calls for a disabled level. The logger has disabled levels or a caller constructs costly optional context or messages.

Default parameters: `{"verifier":"DCP-LOGGING-003"}`.

**Repair:** Assert actual enabled and disabled writes for the configured adapter and confirm that a disabled expensive context builder is not called. Include a non-filtering adapter and an eager-context failing control. Bind DCP-LOGGING-003 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-LOGGING-003.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:1574-1583,2094-2133; dist/index-C3YI4Tf9.d.mts:506-511",
  "paraphrase": "The configured logger must enforce its level policy on writes. A caller must check isLevelEnabled before it constructs expensive optional logging data. The caller must not assume that the gate prevents adapter calls for a disabled level."
}
```

### dcouplr/DCP-LOGGING-004

Check: [`dcouplr/logging/requirement-004@1.0.0`](checks/logging/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.logging.r004`. Minimum severity: `deny`.

A caller must use the public logging overload that preserves its intended message, error, structured context and source attribution. A fatal log must not replace the actual throw, rejection, return or shutdown required by the application. The application uses context-first, source-instance or Error-first overloads, or relies on failure control flow.

Default parameters: `{"verifier":"DCP-LOGGING-004"}`.

**Repair:** Assert actual adapter arguments and caller control flow, including an Error with a message override. Keep attribution separate from identity or authorization. Include a fatal-only failing control when termination is required. Bind DCP-LOGGING-004 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-LOGGING-004.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:1618-1633,1660-1707,2143-2173; dist/index-C3YI4Tf9.d.mts:513-563",
  "paraphrase": "A caller must use the public logging overload that preserves its intended message, error, structured context and source attribution. A fatal log must not replace the actual throw, rejection, return or shutdown required by the application."
}
```

### dcouplr/DCP-LOGGING-005

Check: [`dcouplr/logging/requirement-005@1.0.0`](checks/logging/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.logging.r005`. Minimum severity: `deny`.

A buffered logger must have an owned flush and failure policy. A shutdown or checkpoint that requires completed logging must await the actual flush. A synchronous unbuffered logger may omit flush. The application buffers logging data or requires logging completion before it ends an operation or process.

Default parameters: `{"verifier":"DCP-LOGGING-005"}`.

**Repair:** Hold the configured adapter flush with a deferred promise and assert that the actual shutdown waits. Verify rejection handling and the unbuffered no-flush case. Include a missing-await failing control. A resolved flush does not prove remote retention unless the adapter contract says so. Bind DCP-LOGGING-005 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-LOGGING-005.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:1634-1636,2175-2177; dist/index-C3YI4Tf9.d.mts:565-570",
  "paraphrase": "A buffered logger must have an owned flush and failure policy. A shutdown or checkpoint that requires completed logging must await the actual flush. A synchronous unbuffered logger may omit flush."
}
```

### dcouplr/DCP-LOGGING-006

Check: [`dcouplr/logging/requirement-006@1.0.0`](checks/logging/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.logging.r006`. Minimum severity: `deny`.

An application must not treat a logger monitor event as proof of sink delivery, complete child bindings, serialized error data or authorization. Required audit evidence must come from an explicit tested contract. The application consumes logging monitor events, inspector output or logs as audit evidence.

Default parameters: `{"verifier":"DCP-LOGGING-006"}`.

**Repair:** Assert sink records and monitor payloads separately through the actual adapters, including child bindings, Error-first calls and disabled levels. Verify the required audit fields and retention at their owning boundary. Include a monitor-only failing control. Bind DCP-LOGGING-006 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-LOGGING-006.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:696-725,1618-1659; dist/index.d.mts:427-438",
  "paraphrase": "An application must not treat a logger monitor event as proof of sink delivery, complete child bindings, serialized error data or authorization. Required audit evidence must come from an explicit tested contract."
}
```

## dcouplr/managed-components

Manifest version: `1.4.1`. Status: **preview**.

### dcouplr/DCP-AMBIENT-001

Check: [`dcouplr/boundaries/no-ambient-effects@1.1.0`](checks/boundaries/no-ambient-effects/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.no-ambient-effects`. Minimum severity: `none`.

Managed components must use injected ports or kernel gates for logging, time, randomness, process access and I/O.

Default parameters: `{"paths":["src/application/**","src/services/**"],"exclude":["**/*.test.*","**/*.spec.*"],"allow":[]}`.

**Repair:** Resolve a registered dependency, pass data to the decision, or move the external effect to an adapter.

**Scope and limits:** Project policy, broader than the upstream factory-only rules. Configure paths for managed components, not adapters or pure value modules. Erased TypeScript typeof type queries are admitted; executable typeof expressions and value references beside type annotations remain checked.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "allow": {
    "type": "array",
    "items": {
      "type": "string",
      "pattern": "^[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)+$"
    }
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published source; explicit PREGATE project policies",
  "locator": "dist/eslint/index.mjs factory references; dist/index.mjs DKernel gates",
  "paraphrase": "Managed components must use injected ports or kernel gates for logging, time, randomness, process access and I/O."
}
```

### dcouplr/DCP-NEW-001

Check: [`dcouplr/boundaries/no-direct-construction@1.3.0`](checks/boundaries/no-direct-construction/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.no-direct-construction`. Minimum severity: `none`.

Managed components must resolve collaborators through the injected kernel instead of constructing them directly.

Default parameters: `{"paths":["src/application/**","src/services/**"],"exclude":["**/*.test.*","**/*.spec.*"]}`.

**Repair:** Register at the composition root and use dependencies.resolve or resolveSingleton. Direct root construction in an inline addFactoryMethod is allowed.

**Scope and limits:** Identifies the first inline arrow/function creator argument through literal dot/bracket/template members, optional calls, comments and parenthesized/as/satisfies/non-null wrappers. Also follows an immutable const initialized with an arrow/function expression when its direct first-argument reference follows initialization in the same lexical scope. A direct call of that name in the same scope, a declaration export or a local named/default value export removes the root exception. Type-only exports and foreign re-exports do not export the local creator; nested calls, other escapes and full call-graph ownership remain unresolved. Extra callbacks and leading spreads do not establish ownership. Strict policy over selected paths, including local classes; scope out value-only modules deliberately. Exclusive ownership of declared/exported creators, aliases, mutable/cross-scope/imported creators, dynamic/escaped names, generators, type assertions, indirect values and returned-constructor value wrappers remain unresolved.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published source; explicit PREGATE project policies",
  "locator": "dist/eslint/index.mjs noNewInDecoupledTypes; PREGATE managed-path project policy",
  "paraphrase": "Managed components must resolve collaborators through the injected kernel instead of constructing them directly."
}
```

### dcouplr/DCP-LOCATOR-001

Check: [`dcouplr/boundaries/no-runtime-locator-import@1.0.0`](checks/boundaries/no-runtime-locator-import/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.no-runtime-locator-import`. Minimum severity: `none`.

Managed components must receive the kernel; they must not import the global dcouplr runtime.

Default parameters: `{"paths":["src/application/**","src/services/**"],"exclude":["**/*.test.*","**/*.spec.*"]}`.

**Repair:** Pass the injected IDKernel from addFactoryMethod. Initialize the runtime at the composition boundary.

**Scope and limits:** Value named imports, including renamed imports, and direct namespace dot/bracket references and object destructuring are checked. Type-only imports, unrelated namespaces and lexical shadowing are admitted. Namespace aliases, computed members, dynamic/CommonJS imports and re-export barrels still need data-flow/import-graph coverage; nested-block var hoisting remains conservative.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published source; explicit PREGATE project policies",
  "locator": "dist/index.mjs runtime/setupDcouplr/getDcouplr; DFactoryFunction injection",
  "paraphrase": "Managed components must receive the kernel; they must not import the global dcouplr runtime."
}
```

### dcouplr/DCP-EDGE-001

Check: [`dcouplr/boundaries/layer-direction@1.0.0`](checks/boundaries/layer-direction/check.json). Default severity: **deny**.

Implementation: `layer-edge`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `dcouplr.layer-direction`. Minimum severity: `none`.

Managed components must depend on declared ports, not concrete adapters or undeclared implementation modules.

Default parameters: `{"paths":["@layers:core"]}`.

**Repair:** Declare managed, port, adapter and composition layers. Register adapters at the composition root and resolve a named port through the kernel.

**Scope and limits:** This is an explicit project import-graph policy. It requires a declared core layer and allowed edges; it does not infer the library receiver type.

**Interactions when active together:**

- Duplicates `architecture/CA-DEP-001`: Both check imports against the preset layers; DCP-EDGE-001 covers the core layer, which CA-DEP-001 already checks, so one forbidden core edge is reported twice. Settle: Turn DCP-EDGE-001 off while CA-DEP-001 is active, unless its managed-component wording is wanted.
- Duplicates `architecture/FCIS-DEP-001`: Both check imports from core-layer files against the preset layers, so one forbidden edge is reported twice. Settle: Keep one of them: both run the same layer-edge evaluation on the core layer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published source; explicit PREGATE project policies",
  "locator": "dist/index.mjs DependenciesGate and DFactoryFunction; explicit project construction boundaries",
  "paraphrase": "Managed components must depend on declared ports, not concrete adapters or undeclared implementation modules."
}
```

## dcouplr/messages

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-MESSAGE-SUB-001

Check: [`dcouplr/messages/subscription-contract@1.0.0`](checks/messages/subscription-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.message-subscription-contract`. Minimum severity: `none`.

The handler is invoked at delivery. A peer in the first slot can be registered as a noncallable handler; the peer and handler IDs occupy separate string slots.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Call kernel.message.registerHandler(handler, peer, handlerId). Omit peer when the intended contract is an anonymous address.

**Scope and limits:** Reserved event/message member policy in selected paths, not receiver-type inference. Direct dot, unescaped literal bracket/template and optional calls, comments and transparent parentheses/as/satisfies/non-null values are covered. Known literal argument failures and missing required slots are checked. Low-level eventBus/messageBus and unrelated receivers remain valid. Named gate/function aliases, dynamic/computed/escaped members, spreads, unknown expression types, callback return types and cross-call ownership are unresolved. Review narrower paths for an unrelated API with the same member names.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published public declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IMessageGate, lines 629–670; dist/index.mjs MessageGate.registerHandler, lines 1727–1775",
  "paraphrase": "MessageGate.registerHandler takes handler first, an optional string peer second, and an optional string handlerId third."
}
```

### dcouplr/DCP-MESSAGE-TEARDOWN-001

Check: [`dcouplr/messages/teardown-contract@1.0.0`](checks/messages/teardown-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.message-teardown-contract`. Minimum severity: `none`.

The gate indexes peers and subscription IDs. Passing a handler function can silently leave its registration active.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Use kernel.message.unregisterHandler(peer), or kernel.message.unregisterHandlerBySubscriptionId(subscriptionId).

**Scope and limits:** Reserved event/message member policy in selected paths, not receiver-type inference. Direct dot, unescaped literal bracket/template and optional calls, comments and transparent parentheses/as/satisfies/non-null values are covered. Known literal argument failures and missing required slots are checked. Low-level eventBus/messageBus and unrelated receivers remain valid. Named gate/function aliases, dynamic/computed/escaped members, spreads, unknown expression types, callback return types and cross-call ownership are unresolved. Review narrower paths for an unrelated API with the same member names.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published public declarations and runtime",
  "locator": "dist/index-C3YI4Tf9.d.mts IMessageGate, lines 647–670; dist/index.mjs MessageGate.unregisterHandler/unregisterHandlerBySubscriptionId, lines 1776–1794",
  "paraphrase": "MessageGate teardown uses a string peer or the returned subscription ID, never the handler function."
}
```

## dcouplr/observability

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-OBSERVABILITY-001

Check: [`dcouplr/observability/requirement-001@1.0.0`](checks/observability/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.observability.r001`. Minimum severity: `deny`.

Interaction declarations and graph metadata must match the owned application contract. A declaration or diagram must not be treated as proof that an effect occurred or that an architecture rule was satisfied. The product declares interactions or uses dependency information or a graph as architecture evidence.

Default parameters: `{"verifier":"DCP-OBSERVABILITY-001"}`.

**Repair:** Compare declared and actual registered interactions with a bounded application test. Keep declared, observed and omitted behavior distinct. Test the actual metadata ownership policy: snapshots copy top-level collections but can retain nested metadata references. Validate and redact labels and metadata before sharing them. Bind DCP-OBSERVABILITY-001 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-OBSERVABILITY-001.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:881-1066,2426-2511",
  "paraphrase": "Interaction declarations and graph metadata must match the owned application contract. A declaration or diagram must not be treated as proof that an effect occurred or that an architecture rule was satisfied."
}
```

### dcouplr/DCP-OBSERVABILITY-002

Check: [`dcouplr/observability/requirement-002@1.0.0`](checks/observability/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.observability.r002`. Minimum severity: `deny`.

A graph query must have an explicit input, cost and result-scope policy. Query filters and degrees of separation must not be used as tenant isolation or authorization. The product accepts graph queries, seed identifiers, diagram filters or regular-expression operators.

Default parameters: `{"verifier":"DCP-OBSERVABILITY-002"}`.

**Repair:** Test admitted fields, empty groups, unknown seeds, include/exclude precedence, views and the actual undirected expansion through connector nodes. Bound query size, degree, pattern cost and response size outside the pinned implementation. An empty include group matches every node. Reject unauthorized requests before graph construction; filtering alone cannot grant access. Bind DCP-OBSERVABILITY-002 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-OBSERVABILITY-002.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:2373-2425,2512-2698",
  "paraphrase": "A graph query must have an explicit input, cost and result-scope policy. Query filters and degrees of separation must not be used as tenant isolation or authorization."
}
```

### dcouplr/DCP-OBSERVABILITY-003

Check: [`dcouplr/observability/requirement-003@1.0.0`](checks/observability/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.observability.r003`. Minimum severity: `deny`.

A graph consumer must verify the returned graph and own timeout and readiness failures. A matching request identifier must not be treated as authenticated response provenance. The product calls requestGraph or supplies observability buses, handlers or engine lifecycle controls.

Default parameters: `{"verifier":"DCP-OBSERVABILITY-003"}`.

**Repair:** Verify actual wiring and a valid response contract. Test missing, paused and unwired responders, malformed results and forged matching identifiers. The pinned monitor uses predictable request counters, accepts a matching payload without graph validation and rejects after five seconds when no response arrives. Own any shorter operation budget and cancellation policy; a caller timeout alone does not cancel the underlying request. Bind DCP-OBSERVABILITY-003 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-OBSERVABILITY-003.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:725-750,2267-2296,2355-2372",
  "paraphrase": "A graph consumer must verify the returned graph and own timeout and readiness failures. A matching request identifier must not be treated as authenticated response provenance."
}
```

### dcouplr/DCP-OBSERVABILITY-004

Check: [`dcouplr/observability/requirement-004@1.0.0`](checks/observability/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.observability.r004`. Minimum severity: `deny`.

Monitor and inspector diagnostics must not be the sole source of a complete, immutable security audit. A subscriber must own its completion, failures and unsubscribe operation. The product consumes onActionOccurred, observed graph activity or inspection recordings for operational or audit decisions.

Default parameters: `{"verifier":"DCP-OBSERVABILITY-004"}`.

**Repair:** Test the required application events independently of diagnostic filters, pause controls and first-seen graph aggregation. The pinned monitor omits system identifiers and emits asynchronously; observed graph maps keep the first occurrence. Recording arrays and payload references are mutable. Use an owned durable audit channel when the product needs complete, tamper-resistant evidence. Bind DCP-OBSERVABILITY-004 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-OBSERVABILITY-004.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:698-771,2309-2354; dist/inspector/index.mjs:25-84",
  "paraphrase": "Monitor and inspector diagnostics must not be the sole source of a complete, immutable security audit. A subscriber must own its completion, failures and unsubscribe operation."
}
```

### dcouplr/DCP-OBSERVABILITY-005

Check: [`dcouplr/observability/requirement-005@1.0.0`](checks/observability/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.observability.r005`. Minimum severity: `deny`.

The inspector must remain an explicitly admitted development diagnostic. Access to its recording, commands and graph endpoints must be protected independently of CORS and the production environment flag. The product starts or exposes the dcouplr inspector.

Default parameters: `{"verifier":"DCP-OBSERVABILITY-005"}`.

**Repair:** Verify the actual environment, host binding, reachable network and access owner before startup. Reject production use even if NODE_ENV is absent or incorrect. Loopback is the default, but another host can be configured. The pinned startup rejects exact NODE_ENV=production; a denied preflight does not prevent direct POST commands or recording GET. Validate commands and results rather than treating every ok response as an applied command. Bind DCP-OBSERVABILITY-005 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-OBSERVABILITY-005.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/inspector/index.mjs:38-57,92-154,189-204,269-272",
  "paraphrase": "The inspector must remain an explicitly admitted development diagnostic. Access to its recording, commands and graph endpoints must be protected independently of CORS and the production environment flag."
}
```

### dcouplr/DCP-OBSERVABILITY-006

Check: [`dcouplr/observability/requirement-006@1.0.0`](checks/observability/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.observability.r006`. Minimum severity: `deny`.

Inspection data must have an explicit redaction, serialization, ownership and retention policy before capture or export. An event-count limit must not be treated as a byte budget. The product captures, exports or shares diagnostic events.

Default parameters: `{"verifier":"DCP-OBSERVABILITY-006"}`.

**Repair:** Test actual confidential fields and large or cyclic payloads before they reach the inspector. The pinned normalizer retains raw payload and detail references without redaction. Recording retains a bounded count only for a valid finite budget; one event can contain unbounded bytes and cyclic data can fail JSON serialization. Do not use mutable captured references as an admitted export value. Bind DCP-OBSERVABILITY-006 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-OBSERVABILITY-006.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/inspector/index.mjs:25-60,117-128,182-185",
  "paraphrase": "Inspection data must have an explicit redaction, serialization, ownership and retention policy before capture or export. An event-count limit must not be treated as a byte budget."
}
```

### dcouplr/DCP-OBSERVABILITY-007

Check: [`dcouplr/observability/requirement-007@1.0.0`](checks/observability/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.observability.r007`. Minimum severity: `deny`.

An inspector owner must await close and verify cleanup on successful startup, failed startup and shutdown. A failed bind must not be assumed to remove an observer created before listening. The product owns an inspector server or retries its startup.

Default parameters: `{"verifier":"DCP-OBSERVABILITY-007"}`.

**Repair:** Exercise occupied-port failure, repeated startup and actual shutdown. The pinned implementation subscribes before listening and does not undo that subscription on bind failure. Await the returned close promise after successful startup. Prevent uncontrolled retries or supply reviewed ownership for leaked observers; runtime reset alone is not evidence that asynchronous close completed. Bind DCP-OBSERVABILITY-007 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-OBSERVABILITY-007.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/inspector/index.mjs:54-84,237-245; dist/index.mjs:3568-3574",
  "paraphrase": "An inspector owner must await close and verify cleanup on successful startup, failed startup and shutdown. A failed bind must not be assumed to remove an observer created before listening."
}
```

### dcouplr/DCP-OBSERVABILITY-008

Check: [`dcouplr/observability/requirement-008@1.0.0`](checks/observability/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.observability.r008`. Minimum severity: `deny`.

A diagnostic transport or diagram consumer must own request, stream and rendering budgets and safe rendering of untrusted labels. Mermaid text must not be treated as sanitized HTML. The product exposes inspection HTTP or SSE routes or renders interactionGraphToMermaid output.

Default parameters: `{"verifier":"DCP-OBSERVABILITY-008"}`.

**Repair:** Bound HTTP body bytes and time, connected clients, replay bytes and slow-client buffers at an admitted boundary. The pinned inspector accumulates command bodies and writes SSE without an owned client/backpressure budget. The graph renderer escapes quotes and backslashes and handles reserved node IDs, but preserves markup in labels. Verify the selected rendering engine and its security configuration; source text alone cannot certify browser safety. Bind DCP-OBSERVABILITY-008 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-OBSERVABILITY-008.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/inspector/index.mjs:156-184,222-236; dist/index.mjs:4290-4398",
  "paraphrase": "A diagnostic transport or diagram consumer must own request, stream and rendering budgets and safe rendering of untrusted labels. Mermaid text must not be treated as sanitized HTML."
}
```

## dcouplr/queue-runtime

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-QUEUE-RUNTIME-001

Check: [`dcouplr/queue-runtime/requirement-001@1.0.0`](checks/queue-runtime/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.queue-runtime.r001`. Minimum severity: `deny`.

A queue producer must await admission and handle a false result with a named reject, retry or backpressure policy. Memory capacity and pending-persistence capacity must have explicit budgets. The application submits work through IQueue or a compatible configured queue.

Default parameters: `{"verifier":"DCP-QUEUE-RUNTIME-001"}`.

**Repair:** Hold an admission promise and assert that the actual producer does not report acceptance early. Fill memory and pending-persistence budgets separately and assert the false-result policy. Include missing-await and ignored-false failing controls. Bind DCP-QUEUE-RUNTIME-001 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-QUEUE-RUNTIME-001.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:2911-2959,3118-3122; dist/index.d.mts:39-63",
  "paraphrase": "A queue producer must await admission and handle a false result with a named reject, retry or backpressure policy. Memory capacity and pending-persistence capacity must have explicit budgets."
}
```

### dcouplr/DCP-QUEUE-RUNTIME-002

Check: [`dcouplr/queue-runtime/requirement-002@1.0.0`](checks/queue-runtime/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.queue-runtime.r002`. Minimum severity: `deny`.

A durability requirement must verify the queue's actual repository and persistence mode. Setting enabled to true or registering a system persistence singleton must not be treated as proof of persistence. A queue must survive process loss or satisfy a stored-work contract. Deliberately volatile queues are valid when their loss policy is explicit.

Default parameters: `{"verifier":"DCP-QUEUE-RUNTIME-002"}`.

**Repair:** Observe actual writes and recovery through the configured queue and repository. For the pinned default queue, pass the resolved singleton repository explicitly: its fallback uses a transient has lookup that does not see the registered singleton. Verify a direct repository's precedence and include an enabled-but-unpersisted failing control. Bind DCP-QUEUE-RUNTIME-002 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-QUEUE-RUNTIME-002.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:811-827,842-844,2927-2936,3563-3575; dist/index.d.mts:447-453",
  "paraphrase": "A durability requirement must verify the queue's actual repository and persistence mode. Setting enabled to true or registering a system persistence singleton must not be treated as proof of persistence."
}
```

### dcouplr/DCP-QUEUE-RUNTIME-003

Check: [`dcouplr/queue-runtime/requirement-003@1.0.0`](checks/queue-runtime/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.queue-runtime.r003`. Minimum severity: `deny`.

A leading-persistence queue caller must await the actual append or delete outcome and handle failure before it reports the corresponding admission or removal. A rejected operation must not be treated as a completed durable effect. The queue uses leading persistence or an adapter promises equivalent stored-before-return behavior.

Default parameters: `{"verifier":"DCP-QUEUE-RUNTIME-003"}`.

**Repair:** Hold actual repository append and delete promises; assert memory and caller state before and after completion. Reject each operation and assert retained work, later operation progress and the named retry or rejection policy. Verify storage idempotency separately when retries can repeat effects. Bind DCP-QUEUE-RUNTIME-003 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-QUEUE-RUNTIME-003.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:2947-2986,3092-3106,3129-3133; dist/index.d.mts:55-63,107-113",
  "paraphrase": "A leading-persistence queue caller must await the actual append or delete outcome and handle failure before it reports the corresponding admission or removal. A rejected operation must not be treated as a completed durable effect."
}
```

### dcouplr/DCP-QUEUE-RUNTIME-004

Check: [`dcouplr/queue-runtime/requirement-004@1.0.0`](checks/queue-runtime/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.queue-runtime.r004`. Minimum severity: `deny`.

A lagging-persistence queue must have an owned loss window, background lifetime and failure policy. Successful enqueue must not be reported as durable completion. A background storage failure must be observed and acted on. The queue uses lagging persistence. A caller can select leading persistence when its contract needs stored-before-return behavior.

Default parameters: `{"verifier":"DCP-QUEUE-RUNTIME-004"}`.

**Repair:** Exercise real scheduled batches, coalesced appends and inclusive deletions. Hold and reject the storage operation and verify the application's recovery, retry and shutdown policy. The pinned timer can emit an unhandled rejection after enqueue succeeds; do not assume caller catch handles it. Include early-durability and lost-background-failure controls. Bind DCP-QUEUE-RUNTIME-004 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-QUEUE-RUNTIME-004.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3108-3127,3134-3184; dist/index.d.mts:39-45,107-114",
  "paraphrase": "A lagging-persistence queue must have an owned loss window, background lifetime and failure policy. Successful enqueue must not be reported as durable completion. A background storage failure must be observed and acted on."
}
```

### dcouplr/DCP-QUEUE-RUNTIME-005

Check: [`dcouplr/queue-runtime/requirement-005@1.0.0`](checks/queue-runtime/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.queue-runtime.r005`. Minimum severity: `deny`.

A queue flush must be an explicit discard decision. It must not stand in for a persistence commit, a storage deletion or completed shutdown. A discard owner must first stop or settle concurrent writers that could refill the queue. The application calls IQueue.flush or clears work during shutdown, cancellation or recovery.

Default parameters: `{"verifier":"DCP-QUEUE-RUNTIME-005"}`.

**Repair:** Assert memory, pending timer and storage effects separately. Hold a leading enqueue across flush and verify the application's writer barrier. Use an actual owned storage removal or drain contract when deletion or durability is required. Include a flush-as-commit and pending-writer failing control. Bind DCP-QUEUE-RUNTIME-005 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-QUEUE-RUNTIME-005.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3003-3020,3203-3225; dist/index.d.mts:55-63,107-114",
  "paraphrase": "A queue flush must be an explicit discard decision. It must not stand in for a persistence commit, a storage deletion or completed shutdown. A discard owner must first stop or settle concurrent writers that could refill the queue."
}
```

### dcouplr/DCP-QUEUE-RUNTIME-006

Check: [`dcouplr/queue-runtime/requirement-006@1.0.0`](checks/queue-runtime/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.queue-runtime.r006`. Minimum severity: `deny`.

A recovery owner must verify claim ownership and snapshot validity before it admits recovered work. The repository must provide valid bounded entries with unique ordered sequences. A failed or partial recovery must not be treated as a healthy queue. The application uses IQueue.recover or a storage adapter returns IQueueRecoveryClaim snapshots.

Default parameters: `{"verifier":"DCP-QUEUE-RUNTIME-006"}`.

**Repair:** Validate acquired, snapshot shape, capacity, item values and finite valid unique sequence order at the adapter boundary. Exercise denied, missing, rejected, oversized and malformed claims. The pinned runtime trusts item order and duplicate sequences, ignores snapshot.size, and can retain partial memory or disable later persistence after malformed input. Reject unsafe recovery before business processing. Bind DCP-QUEUE-RUNTIME-006 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-QUEUE-RUNTIME-006.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3022-3052,3065-3075; dist/index.d.mts:91-109",
  "paraphrase": "A recovery owner must verify claim ownership and snapshot validity before it admits recovered work. The repository must provide valid bounded entries with unique ordered sequences. A failed or partial recovery must not be treated as a healthy queue."
}
```

### dcouplr/DCP-QUEUE-RUNTIME-007

Check: [`dcouplr/queue-runtime/requirement-007@1.0.0`](checks/queue-runtime/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.queue-runtime.r007`. Minimum severity: `deny`.

Each durable queue identity must have an explicit storage scope and writer-conflict rule. Independent queue instances must not be assumed to share sequence allocation or enforce exclusive ownership. More than one instance, process, organization or restart can use the same durable queue identity.

Default parameters: `{"verifier":"DCP-QUEUE-RUNTIME-007"}`.

**Repair:** Verify stable queue IDs, organization partitioning and actual claim or atomic storage conflict handling. The pinned code trims IDs but hashes their original case; two instances of the same ID can append sequence zero without automatic writer admission. Include duplicate-writer, wrong-scope and restart controls. A normalized storage key is not authorization. Bind DCP-QUEUE-RUNTIME-007 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-QUEUE-RUNTIME-007.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:2922-2924,3059-3075; dist/index.d.mts:99-114,447-453",
  "paraphrase": "Each durable queue identity must have an explicit storage scope and writer-conflict rule. Independent queue instances must not be assumed to share sequence allocation or enforce exclusive ownership."
}
```

### dcouplr/DCP-QUEUE-RUNTIME-008

Check: [`dcouplr/queue-runtime/requirement-008@1.0.0`](checks/queue-runtime/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.queue-runtime.r008`. Minimum severity: `deny`.

A custom queue must satisfy its declared contract and every operation its consumers use. Read views must not be treated as consumption, a concurrent snapshot or a deep copy of item data. The product replaces IQueue or uses size, isEmpty, peek, stream, flush or returned values in its decisions.

Default parameters: `{"verifier":"DCP-QUEUE-RUNTIME-008"}`.

**Repair:** Check actual return types, promises, metadata, mutation ownership and the consumer's required operations. The pinned callable-member admission permits missing size and flush and a nonboolean nonpromise enqueue result. Verify nonconsuming peek/stream and shared item references; add an incomplete-adapter and mutated-item control. Bind DCP-QUEUE-RUNTIME-008 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-QUEUE-RUNTIME-008.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:2983-3002,3439-3450; dist/index.d.mts:55-63,185-186",
  "paraphrase": "A custom queue must satisfy its declared contract and every operation its consumers use. Read views must not be treated as consumption, a concurrent snapshot or a deep copy of item data."
}
```

## dcouplr/queues

Manifest version: `1.1.0`. Status: **preview**.

### dcouplr/DCP-QUEUE-SHAPE-001

Check: [`dcouplr/queues/complete-literal-config@1.0.0`](checks/queues/complete-literal-config/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.queue-input-shape`. Minimum severity: `none`.

Keep queue configuration within the public typed contract and reject missing inputs before work starts. Runtime tolerance of boolean-like strings or arbitrary modes does not make them valid typed configuration.

Default parameters: `{"paths":["src/**"],"exclude":["**/*.test.*","**/*.spec.*","**/test/**","**/tests/**","**/__tests__/**"]}`.

**Repair:** Supply queueId, segmentCapacity, maxSegments and persistence. Supply enabled as a boolean, mode as leading or lagging, and aotMs and maxPendingOps as numbers inside persistence. Use a nonempty queueId and positive integer numeric bounds. Validate dynamic configuration before resolving I_QUEUE.

**Scope and limits:** This is a reviewed method/key policy for direct built-in queue resolve calls, not receiver/import type inference. Review applicability for custom I_QUEUE overrides. Checks missing DTOs, known invalid literal DTO types, missing fields in plain inline objects, wrong literal field types, literal modes outside leading/lagging and directly empty queueId strings. Later literal and shorthand overrides are respected. Variables, expressions, escaped keys, escaped mode/ID string contents, computed keys, getters, spreads and inherited persistence fields are unresolved; silence does not verify them. The runtime's semantic type checker tolerates boolean-like enabled strings and non-string modes; its mode check also accepts arbitrary strings. This rule enforces the stricter public type contract, not equivalent runtime rejection. Numeric positivity/integrality and complete queue budgets require additional checks.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published declarations and runtime",
  "locator": "dist/index.d.mts QueuePersistenceMode, IQueuePersistenceConfig and IDQueueConfigInternal, lines 39–50; dist/index.mjs validateQueueFactoryInput, lines 3425–3438; defaultQueueFactory, lines 3548–3573; DQueue constructor, lines 2912–2920",
  "paraphrase": "The public built-in queue contract requires a queueId string, numeric capacity bounds and persistence with a boolean enabled flag, leading/lagging mode and numeric aotMs/maxPendingOps. The constructor additionally requires a nonempty ID and positive integer bounds."
}
```

### dcouplr/DCP-QUEUE-NUM-001

Check: [`dcouplr/queues/no-invalid-literal-capacity@1.0.0`](checks/queues/no-invalid-literal-capacity/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.queue-numeric-limits`. Minimum severity: `none`.

Zero, negative and fractional capacity/persistence values reject queue construction before it can handle work.

Default parameters: `{"paths":["src/**"],"exclude":["**/*.test.*","**/*.spec.*","**/test/**","**/tests/**","**/__tests__/**"]}`.

**Repair:** Supply positive integer number limits for segmentCapacity, maxSegments, persistence.aotMs and persistence.maxPendingOps. Validate dynamically supplied values before resolving I_QUEUE.

**Scope and limits:** Checks direct resolve calls with an inline object, a literal I_QUEUE key or a dotted DependencyKeys.IQueue key. This is a reviewed method/key policy for the built-in queue, not receiver/import type inference; review applicability for custom queue overrides. Detects negative numeric literals, supported zero literal forms, ordinary nonintegral decimals and bigint literals. Later literal overrides are respected. Objects with spreads or computed keys are skipped because their effective values are unresolved. Configuration variables, escaped keys, signed-plus or wrapped expressions, nonintegral scientific notation and complete shape/budget requirements are not evaluated. An integer-valued decimal is valid; silence does not prove the complete configuration or its budget is correct.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published runtime",
  "locator": "dist/index.mjs DQueue constructor, lines 2912–2920; buildSystemDependencies defaultQueueFactory, lines 3548–3573",
  "paraphrase": "Built-in queue capacity and persistence bounds must be positive integer numbers."
}
```

## dcouplr/runtime

Manifest version: `1.5.0`. Status: **preview**.

### dcouplr/DCP-SETUP-001

Check: [`dcouplr/runtime/setup-literal-contract@1.3.0`](checks/runtime/setup-literal-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.bootstrap-configuration`. Minimum severity: `none`.

Invalid literal bootstrap options or factories reject initialization/resolution or are silently ignored. Missing charEncoding and factory identifiers are tolerated by this runtime but violate the public required-field contracts. Unknown literal keys can hide a misspelled setting. Async/generator create returns do not satisfy the synchronous system-factory output contracts. Infinity and NaN event budgets disable bounded retention; a negative infinite budget discards every event.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Supply charEncoding and use the public setup fields and types. Use only Logger, EventBus, MessageBus, DCast, IQueue, IQueuePersistence, MessageBrokerAdapter and EventBrokerAdapter system overrides. Each supplied factory needs a string __semanticIdentifier and synchronous callable create; its output must satisfy that system contract. Inspector host/instanceId/path are strings, port/maxEvents are finite numbers, and captureOnStart/announce/enabled are booleans. Use object options for startDcouplrInspector; only setup's inspector also accepts a boolean. Choose mode and ephemeral for the actual runtime; keep dynamic configurations, output behavior and inspector access/resource limits under a project verifier. Use only supported forbiddenElements.

**Scope and limits:** Reserved setupDcouplr/startDcouplrInspector call-name policy in reviewed paths, not import/receiver identity or whole-program setup/get order. Direct identifier/dot/literal-bracket calls and transparent wrappers are checked. Plain object fields use the last duplicate key at configuration, system-override, factory, inspector and debug-console levels; optional undefined, shorthand and dynamic values stay valid or unresolved. Spread/computed/getter/method/prototype/escaped-key configurations are deferred. Direct inspector options follow the second argument, unless the first is a spread. Known wrong literal field types, bigint numeric values and unknown keys reject; absent options and optional fields remain valid. Direct Infinity/NaN, Number.POSITIVE_INFINITY/NEGATIVE_INFINITY/NaN and globalThis.Infinity/NaN reject, including literal brackets and unary/value wrappers. A binding containing Infinity, NaN, Number or globalThis anywhere in the file, escaped binding text, or with defers those global predicates conservatively; this is not lexical resolution. Arithmetic, overflow literals, aliases, wrapped receivers, dynamic global changes, integer/range validity and class field values remain unresolved. Compatible static inspector/debug-console class options remain unresolved. Network binding, actual production mode, authorization, lifecycle and complete recording limits remain unverified. Literal factories check required __semanticIdentifier/create and known invalid types, including async/generator creators. The identifier need not equal a reserved system key: dictionary registration owns that key. Static class factories can satisfy the public structural contract and remain unresolved. Named/aliased factory shape, indirect asynchronous creators, actual output member/behavior contracts and escaped or dynamic enum strings are unresolved. Omitting ephemeral remains valid: the pinned setup path forwards undefined, so this rule does not promise the documented true default or broker delivery guarantees.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published public types and runtime; explicit PREGATE literal-configuration and finite inspector-budget policy",
  "locator": "dist/index.d.mts ISystemDependencyFactories/ISetupDcouplrConfig, lines 178–218; dist/index-C3YI4Tf9.d.mts IDFactory, lines 771–779, inspector options, lines 938–959; dist/index.mjs withVerifiedFactoryOutput, buildSystemDependencies, validateKernelFactoryInput and setupDcouplr, lines 3377–3386, 3480–3622; dist/inspector/index.mjs startDcouplrInspector and resolveDebugConsoleOptions",
  "paraphrase": "Setup and inspector options use the public keys and types. Inspector numeric options must be finite. Each supplied system override is an IDFactory with a string __semanticIdentifier and synchronous callable create."
}
```

### dcouplr/DCP-SETTINGS-001

Check: [`dcouplr/runtime/immutable-system-settings@1.0.0`](checks/runtime/immutable-system-settings/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.bootstrap-setting-ownership`. Minimum severity: `none`.

The runtime refuses to overwrite a key in its system configuration even when its bootstrap value is undefined. Mode, encoding, delivery settings, forbidden elements and instance identity belong to setup.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Set system options once in setupDcouplr. Use settings.setSetting only for application runtime keys and read system values with getSetting/getMode.

**Scope and limits:** Direct settings.setSetting receiver-shape policy in reviewed paths, not inferred IDKernel types. Covers the five pinned system keys with dot/literal-bracket/optional calls, transparent wrappers and literal keys. Detached settings/setter aliases, dynamic/escaped keys, custom bootstrap fields and unrelated receiver identities remain unresolved. The rule does not prohibit application-owned settings or prove setup occurs exactly once.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published runtime SettingsGate and DKernel",
  "locator": "dist/index.mjs SettingsGate.setSetting and DKernel resolvedConfig/systemConfig, lines 1870–1920",
  "paraphrase": "Bootstrap settings and instanceId are system-owned and must not be overwritten through settings.setSetting."
}
```

### dcouplr/DCP-KERNEL-001

Check: [`dcouplr/runtime/no-kernel-admission@1.0.0`](checks/runtime/no-kernel-admission/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.bootstrap-kernel-ownership`. Minimum severity: `none`.

Public kernel admission can reject as a duplicate or create a second kernel registration while managed factories still receive the bootstrap kernel. The runtime warns that this infrastructure is bootstrap-owned.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Remove the DKERNEL admission. Configure the supported system factories at setup and receive IDKernel as the factory's injected second argument.

**Scope and limits:** Reserved method/key policy in the selected paths, not receiver-type inference. Direct fluent register/registerSingleton/registerForce/registerSingletonForce chains cover literal DKERNEL and direct DependencyKeys.Kernel access, dot/literal-bracket/optional calls, parentheses and transparent as/satisfies/non-null wrappers. Only receiver links are followed; nested callbacks, arguments, strings and createOnly are not registrations. Tests have no ownership exemption. Named handles, function/key aliases, computed/escaped names, arbitrary chain methods and bootstrap order remain unresolved. Review narrower paths if an unrelated API uses the same reserved names. Runtime warnings and partial admission do not establish a safe kernel replacement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published runtime; explicit PREGATE project policy",
  "locator": "dist/index.mjs SystemDependencyKeys, DcouplrInternal constructor and #warnIfKernelIsRegisteredThroughAdmission, lines 675–689, 768–840, 1068–1071",
  "paraphrase": "DKERNEL is bootstrap-owned runtime infrastructure and must not be registered through public dependency admission."
}
```

### dcouplr/DCP-FORCE-001

Check: [`dcouplr/runtime/no-force-admission-in-production@1.0.0`](checks/runtime/no-force-admission-in-production/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.production-force-admission`. Minimum severity: `none`.

Production replacement bypasses normal duplicate-ownership checks and the runtime rejects it outside test mode.

Default parameters: `{"paths":["src/**"],"exclude":["**/*.test.*","**/*.spec.*","**/test/**","**/tests/**","**/__tests__/**"]}`.

**Repair:** Use register/registerSingleton in production. Keep force replacement in reviewed test modules with mode: test.

**Scope and limits:** Explicit method-name policy reserves registerForce/registerSingletonForce calls in the reviewed production paths; it does not infer receiver types. Dot, optional and unescaped literal bracket/template calls are covered. A project with an unrelated API of the same name must narrow paths or review an exception. Detached function aliases, computed names, escaped literals and actual runtime mode are not resolved; an excluded test file does not prove test mode.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published runtime; explicit PREGATE project policy",
  "locator": "dist/index.mjs DcouplrInternal.#internalRegisterForce/#internalRegisterSingletonForce/#assertTestMode, lines 1047–1062",
  "paraphrase": "Force admission is available only when the runtime mode is test."
}
```

### dcouplr/DCP-TEST-001

Check: [`dcouplr/runtime/no-test-helper-in-production@1.0.0`](checks/runtime/no-test-helper-in-production/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.no-test-helper-in-production`. Minimum severity: `none`.

Production code must not import dcouplr test reset or test runtime helpers.

Default parameters: `{"paths":["src/**"],"exclude":["**/*.test.*","**/*.spec.*","**/test/**","**/tests/**","**/__tests__/**"]}`.

**Repair:** Keep test helpers in test modules. Initialize the production runtime once at the application boundary.

**Scope and limits:** Value named imports and direct namespace dot/bracket references and object destructuring are checked. Type-only imports, shadowed namespaces, legitimate bootstrap and excluded test files are admitted. Namespace aliases, computed members, dynamic/CommonJS imports and re-export barrels remain gaps; nested-block var hoisting remains conservative.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published source; explicit PREGATE project policies",
  "locator": "dist/index.mjs resetDcouplrForTesting/getDcouplrForTesting",
  "paraphrase": "Production code must not import dcouplr test reset or test runtime helpers."
}
```

### dcouplr/DCP-EXPORTS-001

Check: [`dcouplr/runtime/no-private-package-imports@1.0.0`](checks/runtime/no-private-package-imports/check.json). Default severity: **deny**.

Implementation: `banned-import`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `dcouplr.no-private-package-imports`. Minimum severity: `none`.

Import dcouplr through its public package exports, not internal source or distribution paths.

Default parameters: `{"packages":["dcouplr/dist","dcouplr/src"]}`.

**Repair:** Use dcouplr, dcouplr/eslint or dcouplr/inspector. Receive IDKernel through the factory instead of trying to import its private implementation.

**Scope and limits:** Closed package export paths are verified for the pinned 0.1.3-beta package. New package versions require renewed source review.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "packages": {
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published source; explicit PREGATE project policies",
  "locator": "package.json exports: '.', './eslint', './inspector'",
  "paraphrase": "Import dcouplr through its public package exports, not internal source or distribution paths."
}
```

## dcouplr/saga-runtime

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-SAGA-RUNTIME-001

Check: [`dcouplr/saga-runtime/requirement-001@1.0.0`](checks/saga-runtime/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.saga-runtime.r001`. Minimum severity: `deny`.

A saga owner must register and validate the complete graph before start. Node identities and expected or previous step references must have one owner and an explicit meaning. Use of the deprecated structured-saga API must have a recorded version and replacement decision. The product uses DStructuredSaga or its public node and event-builder contracts. This pack must not force new adoption of a deprecated API.

Default parameters: `{"verifier":"DCP-SAGA-RUNTIME-001"}`.

**Repair:** Exercise the actual registered graph, including duplicate or missing references and registration after start. The pinned runtime validates join references to steps but does not validate previousStepId or wire nodes added while running. Joins cannot name another join as an expected step. Review the declaration's deprecation and the product's supported-version decision. Bind DCP-SAGA-RUNTIME-001 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-SAGA-RUNTIME-001.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3688-3764; dist/index.d.mts:251-315",
  "paraphrase": "A saga owner must register and validate the complete graph before start. Node identities and expected or previous step references must have one owner and an explicit meaning. Use of the deprecated structured-saga API must have a recorded version and replacement decision."
}
```

### dcouplr/DCP-SAGA-RUNTIME-002

Check: [`dcouplr/saga-runtime/requirement-002@1.0.0`](checks/saga-runtime/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.saga-runtime.r002`. Minimum severity: `deny`.

A saga boundary must validate authorization, organization scope, event identity and payload before admission. A matching sagaId must not be treated as authorization or proof that an internal step ran. Data shared with queued handlers must have explicit mutation ownership. An external, recovered or concurrently mutable event can reach a structured saga.

Default parameters: `{"verifier":"DCP-SAGA-RUNTIME-002"}`.

**Repair:** Reject wrong-organization, forged-source, malformed-context and invalid-payload events through the actual boundary. Verify exact saga identity and immutable or copied payload ownership. The pinned live matcher checks only a string sagaId; recovered events bypass that matcher. Its queue clone copies top-level context and saga context but shares payload and other nested values. Bind DCP-SAGA-RUNTIME-002 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-SAGA-RUNTIME-002.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:4029-4036,4072-4076,4240-4269; dist/index.d.mts:255-260; dist/index-C3YI4Tf9.d.mts:ISagaEventContext",
  "paraphrase": "A saga boundary must validate authorization, organization scope, event identity and payload before admission. A matching sagaId must not be treated as authorization or proof that an internal step ran. Data shared with queued handlers must have explicit mutation ownership."
}
```

### dcouplr/DCP-SAGA-RUNTIME-003

Check: [`dcouplr/saga-runtime/requirement-003@1.0.0`](checks/saga-runtime/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.saga-runtime.r003`. Minimum severity: `deny`.

A saga handler must complete its owned asynchronous work and return the declared outcome. It must use literal failure for an expected failed step, or an observed exception for an unexpected failure. Repeated delivery must not repeat an unsafe business effect. A registered structured-saga step performs a decision or effect.

Default parameters: `{"verifier":"DCP-SAGA-RUNTIME-003"}`.

**Repair:** Hold and reject actual step operations, verify success and failure signals, and test duplicate delivery, restart and replay with the product's effect idempotency key. Void means success in the pinned API; false and unknown values are also runtime successes and must not be used as failure signals. In-memory duplicate suppression ends when stop resets state. Bind DCP-SAGA-RUNTIME-003 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-SAGA-RUNTIME-003.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3746-3751,4077-4117; dist/index.d.mts:252-254,261-270,293",
  "paraphrase": "A saga handler must complete its owned asynchronous work and return the declared outcome. It must use literal failure for an expected failed step, or an observed exception for an unexpected failure. Repeated delivery must not repeat an unsafe business effect."
}
```

### dcouplr/DCP-SAGA-RUNTIME-004

Check: [`dcouplr/saga-runtime/requirement-004@1.0.0`](checks/saga-runtime/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.saga-runtime.r004`. Minimum severity: `deny`.

Each compensating effect must have an explicit failure, retry and idempotency policy. A checkpoint must define which successful effects are retained and which failed effects still need compensation. Compensation must not be assumed to be an atomic rollback. The graph has compensate, previousStepId or isCheckpoint behavior, or a join can compensate a completed branch.

Default parameters: `{"verifier":"DCP-SAGA-RUNTIME-004"}`.

**Repair:** Verify actual own-before-previous ordering, failure propagation and repeat safety. A succeeded checkpoint blocks a later compensation request, but a failed checkpoint still runs its own compensation. Reject a compensation promise and verify the owner's recovery policy: the pinned runtime can retain running state, remove the queued event and ignore later input without raising branch failure. Bind DCP-SAGA-RUNTIME-004 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-SAGA-RUNTIME-004.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:4093-4139,4199-4216; dist/index.d.mts:261-270,299",
  "paraphrase": "Each compensating effect must have an explicit failure, retry and idempotency policy. A checkpoint must define which successful effects are retained and which failed effects still need compensation. Compensation must not be assumed to be an atomic rollback."
}
```

### dcouplr/DCP-SAGA-RUNTIME-005

Check: [`dcouplr/saga-runtime/requirement-005@1.0.0`](checks/saga-runtime/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.saga-runtime.r005`. Minimum severity: `deny`.

A saga join must use trusted completion signals and a verified any or every branch policy. Winning, losing, failing and already completed branches must have explicit business outcomes. A join signal alone must not prove that its expected handlers ran. The graph registers a join or consumes structured-saga success, branch-failure or cancellation events.

Default parameters: `{"verifier":"DCP-SAGA-RUNTIME-005"}`.

**Repair:** Exercise distinct successes, duplicate or forged success, one or all failed branches, already succeeded losers and same-branch siblings. The pinned any join cancels a different idle branch but does not cancel an idle sibling in the winner's branch; an already succeeded loser can be compensated. Every failure cancels branches and requests compensation for recorded successes. Verify actual application effects and failure outputs, not only counter equality. Bind DCP-SAGA-RUNTIME-005 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-SAGA-RUNTIME-005.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:4140-4198; dist/index.d.mts:271-280,293-299",
  "paraphrase": "A saga join must use trusted completion signals and a verified any or every branch policy. Winning, losing, failing and already completed branches must have explicit business outcomes. A join signal alone must not prove that its expected handlers ran."
}
```

### dcouplr/DCP-SAGA-RUNTIME-006

Check: [`dcouplr/saga-runtime/requirement-006@1.0.0`](checks/saga-runtime/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.saga-runtime.r006`. Minimum severity: `deny`.

A saga recovery owner must establish readiness and observe recovery failure before admitting business work. Calling start must not be treated as awaited recovery or a healthy readiness check. A saga starts or restarts with queued or stored work.

Default parameters: `{"verifier":"DCP-SAGA-RUNTIME-006"}`.

**Repair:** Hold and reject the actual recovery operation and verify the product's readiness barrier, failure observation and admission policy. The pinned start returns void, recovery rejection can become unhandled, and live input can be processed while recovery is pending. Validate recovered identity and data before any handler effect. Bind actual queue/adapter and owner inputs. Bind DCP-SAGA-RUNTIME-006 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-SAGA-RUNTIME-006.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3726-3735,4029-4070; dist/index.d.mts:282-288,309-310",
  "paraphrase": "A saga recovery owner must establish readiness and observe recovery failure before admitting business work. Calling start must not be treated as awaited recovery or a healthy readiness check."
}
```

### dcouplr/DCP-SAGA-RUNTIME-007

Check: [`dcouplr/saga-runtime/requirement-007@1.0.0`](checks/saga-runtime/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.saga-runtime.r007`. Minimum severity: `deny`.

A saga's durable-work and replay contract must verify actual storage selection, recovery, acknowledgement and business-effect idempotency. A configured persistence singleton or in-memory step state must not stand in for durable execution state. A saga must survive process loss, resume effects or share a queue identity across instances. A deliberately volatile custom queue needs an explicit loss policy.

Default parameters: `{"verifier":"DCP-SAGA-RUNTIME-007"}`.

**Repair:** Observe actual queue storage calls and restart/replay through the configured adapter. The pinned saga admits a built-in queue when a persistence singleton exists, but that queue's transient fallback does not select the singleton repository. Step and join states are in memory and reset on stop. Verify writer ownership, loss windows and idempotent effect keys; an empty queue is not proof that effects were committed once. Bind DCP-SAGA-RUNTIME-007 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-SAGA-RUNTIME-007.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3746-3751,4039-4070,4270-4293; dist/index.d.mts:254,447-453",
  "paraphrase": "A saga's durable-work and replay contract must verify actual storage selection, recovery, acknowledgement and business-effect idempotency. A configured persistence singleton or in-memory step state must not stand in for durable execution state."
}
```

### dcouplr/DCP-SAGA-RUNTIME-008

Check: [`dcouplr/saga-runtime/requirement-008@1.0.0`](checks/saga-runtime/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.saga-runtime.r008`. Minimum severity: `deny`.

A saga lifecycle owner must stop new admission and await or explicitly reject in-flight effects before it reports shutdown. Cancellation, handler latency and queue saturation must have bounded named policies. A cancellation event or stop return must not be treated as an abort or completed drain. The product stops, cancels, times out or shuts down a running structured saga.

Default parameters: `{"verifier":"DCP-SAGA-RUNTIME-008"}`.

**Repair:** Hold actual handler work across stop and cancellation, and verify the caller's owned completion barrier, timeout and failure propagation. The pinned stop returns void and an in-flight handler can still emit success; queued cancellation cannot interrupt the handler ahead of it. Queue saturation rejects blocking delivery without running the handler. Include missing-await, lost-failure and unbounded-handler failing controls. Bind DCP-SAGA-RUNTIME-008 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-SAGA-RUNTIME-008.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3737-3753,4039-4069,4119-4130; dist/index.d.mts:268,287-288,311-312",
  "paraphrase": "A saga lifecycle owner must stop new admission and await or explicitly reject in-flight effects before it reports shutdown. Cancellation, handler latency and queue saturation must have bounded named policies. A cancellation event or stop return must not be treated as an abort or completed drain."
}
```

## dcouplr/sagas

Manifest version: `1.1.0`. Status: **preview**.

### dcouplr/DCP-SAGA-CTOR-001

Check: [`dcouplr/sagas/constructor-literal-contract@1.0.0`](checks/sagas/constructor-literal-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.saga-construction`. Minimum severity: `none`.

Empty identities reject construction before subscriptions or work can start. Primitive kernel values cannot supply the runtime gates.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Use the public DStructuredSaga constructor with both stable nonempty IDs and the factory's injected kernel. The API is deprecated but remains valid in the pinned release; do not replace its DSL with a dependency lookup that has no registered provider.

**Scope and limits:** Reserved DStructuredSaga constructor-name policy in reviewed paths, not import/type identity inference. Covers direct identifier, dot/literal-bracket constructor names and transparent wrappers; missing required arguments, directly blank string IDs and known invalid literal ID/kernel types. Explicit invalid arguments before the first spread remain checked; leading spreads leave later positions unresolved. Dynamic values, escaped blank IDs, aliases and actual kernel shape/ownership are unresolved. Bare undefined uses a direct-value policy; lexical shadow resolution is not proved. Does not certify persistence, queue overrides, graph/lifecycle or correlation. Required DSL construction is not itself a collaborator bypass; review managed-path scope instead of banning a public library construction.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published declarations and runtime; bounded PREGATE public-contract policy",
  "locator": "dist/index.d.mts IStructuredSagaStep, IStructuredSagaJoinStep and DStructuredSaga, lines 263–321; dist/index.mjs DStructuredSaga constructor/registerNode, lines 3689–3725",
  "paraphrase": "Structured saga construction requires a nonempty sagaType and sagaId and the injected IDKernel."
}
```

### dcouplr/DCP-SAGA-NODE-001

Check: [`dcouplr/sagas/node-literal-contract@1.2.0`](checks/sagas/node-literal-contract/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dcouplr.saga-node-contract`. Minimum severity: `none`.

Missing fields reject registration; truthy noncallable handlers fail only during delivery. Awaiting a generator object does not run its body. Duplicate join references reject start because a join must track each expected step once. Public kind/callback/boolean contracts are stricter than this runtime's truthiness checks.

Default parameters: `{"paths":["src/**"]}`.

**Repair:** Declare one valid step or join with a stable nonempty stepId. Use a callable handler that returns a Promise; use any/every and nonempty unique string step references for joins. Keep start/stop, duplicate IDs, reference existence, matching saga context, compensation and queue persistence under a project graph/runtime verifier.

**Scope and limits:** Reserved registerNode method-name policy in reviewed paths, not receiver type inference. Direct dot/literal-bracket/optional calls, transparent wrappers and plain inline objects are covered. Later literal/shorthand keys win. Primitive DTOs, missing fields, known invalid literal field types, unknown literal kinds/modes, blank IDs/events and generator handlers are rejected. A trailing argument spread cannot replace an explicit first node; leading argument spreads remain unresolved. Bare undefined uses a direct-value policy; lexical shadow resolution is not proved. Dynamic fields/kinds, named callback types, Promise/return-flow correctness, escaped strings/keys, spreads, computed keys, getters, methods and prototypes are unresolved. Blank branchId is valid: upstream defaults it. Identical unescaped literal references with the same quote form are checked within one array, including explicit duplicates beside an argument/element spread. Mixed quote forms, escapes, interpolated templates and dynamic value equality remain unresolved. Duplicate/cross-call node IDs, reference existence, lifecycle, cancellation/checkpoint and persistence are not proved by syntax. No general same-named API ownership or complete saga compliance is inferred.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta published declarations and runtime; bounded PREGATE public-contract policy",
  "locator": "dist/index.d.mts IStructuredSagaStep, IStructuredSagaJoinStep and DStructuredSaga, lines 263–321; dist/index.mjs DStructuredSaga registerNode/validate, lines 3697–3780",
  "paraphrase": "Steps require stepId, on and a Promise-compatible handler; joins require stepId, any/every mode and a nonempty expectedStepIds collection with unique references."
}
```

## dcouplr/utility-runtime

Manifest version: `1.0.0`. Status: **preview**.

### dcouplr/DCP-UTILITY-RUNTIME-001

Check: [`dcouplr/utility-runtime/requirement-001@1.0.0`](checks/utility-runtime/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.utility-runtime.r001`. Minimum severity: `deny`.

A domain boundary must validate the complete admitted value and its bounds. TypeCompatibilityCheck and DCast must not be treated as strict type, complete collection or domain validation. The product uses compatibility or conversion helpers to admit external or stored values.

Default parameters: `{"verifier":"DCP-UTILITY-RUNTIME-001"}`.

**Repair:** Test actual strict types, every collection item, numeric precision and domain constraints. Own input depth and size budgets; recursive compatibility on a cyclic object can overflow the stack. Compatibility admits numeric strings, inspects only the first array element, and can match an object's keys without validating field values. Boolean conversion of the strings false and no returns true. Reject unsafe values before the domain decision. Bind DCP-UTILITY-RUNTIME-001 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-UTILITY-RUNTIME-001.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:188-275,3245-3345",
  "paraphrase": "A domain boundary must validate the complete admitted value and its bounds. TypeCompatibilityCheck and DCast must not be treated as strict type, complete collection or domain validation."
}
```

### dcouplr/DCP-UTILITY-RUNTIME-002

Check: [`dcouplr/utility-runtime/requirement-002@1.0.0`](checks/utility-runtime/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.utility-runtime.r002`. Minimum severity: `deny`.

A conversion caller must choose an explicit target order and verify the actual returned type and domain value. A TypeScript generic argument must not be treated as a runtime output guarantee. The product consumes a DCast result or supplies more than one conversion target.

Default parameters: `{"verifier":"DCP-UTILITY-RUNTIME-002"}`.

**Repair:** Exercise the selected targets in their real order and assert the result before use. Verify the configured DCast replacement as well as the default. The first successful target wins; a generic can claim string while the selected number target returns a number. Include reversed-order and wrong-result-type controls. Bind DCP-UTILITY-RUNTIME-002 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-UTILITY-RUNTIME-002.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3292-3345,3421-3423,3575; dist/index.d.mts:170-177,324",
  "paraphrase": "A conversion caller must choose an explicit target order and verify the actual returned type and domain value. A TypeScript generic argument must not be treated as a runtime output guarantee."
}
```

### dcouplr/DCP-UTILITY-RUNTIME-003

Check: [`dcouplr/utility-runtime/requirement-003@1.0.0`](checks/utility-runtime/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.utility-runtime.r003`. Minimum severity: `deny`.

A conversion boundary must have an explicit policy for absent values, fallback values and exceptions. A fallback must satisfy the consumer's domain contract. A fallback must not be assumed to handle every conversion failure. DCast can receive nullish or invalid data or a caller supplies a fallback.

Default parameters: `{"verifier":"DCP-UTILITY-RUNTIME-003"}`.

**Repair:** Test null, undefined, unsupported conversion, absent and explicit fallback, malformed target configuration and native conversion exceptions. The pinned runtime returns nullish input even for a different requested target, returns a supplied fallback without converting or copying it, and validates target shape before fallback. An invalid Date can throw despite a fallback. Bind DCP-UTILITY-RUNTIME-003 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-UTILITY-RUNTIME-003.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3292-3303,3330-3345",
  "paraphrase": "A conversion boundary must have an explicit policy for absent values, fallback values and exceptions. A fallback must satisfy the consumer's domain contract. A fallback must not be assumed to handle every conversion failure."
}
```

### dcouplr/DCP-UTILITY-RUNTIME-004

Check: [`dcouplr/utility-runtime/requirement-004@1.0.0`](checks/utility-runtime/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.utility-runtime.r004`. Minimum severity: `deny`.

A date boundary must name the admitted date format, calendar validity, time basis and mutation owner. A returned Date must be verified before use and must not be assumed to be a fresh immutable value. The product uses date or formatted-date DCast targets.

Default parameters: `{"verifier":"DCP-UTILITY-RUNTIME-004"}`.

**Repair:** Exercise explicit ymd, dmy and mdy metadata on ambiguous input and reject invalid calendar dates. Assert the UTC representation where this contract requires it. The pinned runtime passes a Date through by identity, including an invalid Date for the date target; formatted output can fail. Copy or own mutable dates when they cross a sharing boundary. Bind DCP-UTILITY-RUNTIME-004 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-UTILITY-RUNTIME-004.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3246-3291,3308-3324",
  "paraphrase": "A date boundary must name the admitted date format, calendar validity, time basis and mutation owner. A returned Date must be verified before use and must not be assumed to be a fresh immutable value."
}
```

### dcouplr/DCP-UTILITY-RUNTIME-005

Check: [`dcouplr/utility-runtime/requirement-005@1.0.0`](checks/utility-runtime/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.utility-runtime.r005`. Minimum severity: `deny`.

An array passed to DCast must be an intentional value-and-format tuple. A caller must not use this argument as a whole-collection conversion. Tuple contents and metadata must be validated before use. The product passes array or tuple input to DCast.

Default parameters: `{"verifier":"DCP-UTILITY-RUNTIME-005"}`.

**Repair:** Assert the actual value at index zero and format metadata at index one. Verify collections item by item through an owned bounded operation instead. The pinned runtime takes the first array item as the value, treats the second as metadata and ignores later items; an empty array becomes undefined. Bind DCP-UTILITY-RUNTIME-005 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-UTILITY-RUNTIME-005.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:3296-3303; dist/index.d.mts:175-177",
  "paraphrase": "An array passed to DCast must be an intentional value-and-format tuple. A caller must not use this argument as a whole-collection conversion. Tuple contents and metadata must be validated before use."
}
```

### dcouplr/DCP-UTILITY-RUNTIME-006

Check: [`dcouplr/utility-runtime/requirement-006@1.0.0`](checks/utility-runtime/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.utility-runtime.r006`. Minimum severity: `deny`.

A field-helper caller must distinguish absence, null and valid falsy values and must validate the actual output. Inherited fields, shared references and callback failures must have an explicit admission and ownership policy. The product uses withDefaultValue or straightValue on domain or configuration data.

Default parameters: `{"verifier":"DCP-UTILITY-RUNTIME-006"}`.

**Repair:** Test missing, null, undefined, zero, false and empty text. The pinned withDefaultValue keeps nonnull falsy values but straightValue returns undefined for them. Both accept inherited fields; withDefaultValue does not perform its documented expected-type check and its callback exceptions propagate. Verify returned references and defaults independently of generic types. Bind DCP-UTILITY-RUNTIME-006 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-UTILITY-RUNTIME-006.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:168-183; dist/index.d.mts:327-337",
  "paraphrase": "A field-helper caller must distinguish absence, null and valid falsy values and must validate the actual output. Inherited fields, shared references and callback failures must have an explicit admission and ownership policy."
}
```

### dcouplr/DCP-UTILITY-RUNTIME-007

Check: [`dcouplr/utility-runtime/requirement-007@1.0.0`](checks/utility-runtime/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.utility-runtime.r007`. Minimum severity: `deny`.

A product that needs a priority queue must select and verify an actual implementation. The IPriorityQueue declaration and QueuePriorities values must not be treated as an available queue instance or a tested scheduling policy. The product promises priority ordering or consumes an IPriorityQueue implementation.

Default parameters: `{"verifier":"DCP-UTILITY-RUNTIME-007"}`.

**Repair:** Verify the selected adapter's ordering between and within priorities, capacity, starvation decision, peek and stream views, clearing and per-priority flush. Assert named DPriority inputs and any numeric-rank translation. The pinned package exports numeric ranks and a type-only interface, with no public priority-queue constructor; its built-in IQueue remains FIFO. Own configuration instead of trusting readonly types to freeze runtime values. Bind DCP-UTILITY-RUNTIME-007 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-UTILITY-RUNTIME-007.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:2940-3004,3239-3244,4547-4574; dist/index.d.mts:66-88",
  "paraphrase": "A product that needs a priority queue must select and verify an actual implementation. The IPriorityQueue declaration and QueuePriorities values must not be treated as an available queue instance or a tested scheduling policy."
}
```

### dcouplr/DCP-UTILITY-RUNTIME-008

Check: [`dcouplr/utility-runtime/requirement-008@1.0.0`](checks/utility-runtime/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `dcouplr.utility-runtime.r008`. Minimum severity: `deny`.

A priority-queue producer must validate the named priority before admission, await enqueue and handle a false result with an explicit reject, retry or backpressure policy. Numeric QueuePriorities ranks must not be forwarded as DPriority names. IQueue must not be called with the IPriorityQueue argument order. The product submits work through an IPriorityQueue adapter or translates external priority data into queue calls.

Default parameters: `{"verifier":"DCP-UTILITY-RUNTIME-008"}`.

**Repair:** Hold actual admission and verify that the producer does not report acceptance early. Reject invalid or numeric priorities before adapter use, handle false and propagate the owned failure policy. The priority interface expects name then item; the built-in IQueue expects only the item and stores a supplied priority string as work. Include missing-await, ignored-false, invalid-name and wrong-adapter controls. Bind DCP-UTILITY-RUNTIME-008 to a human-reviewed project assertion with explicit applicability, owner, actual application inputs and freshness. Include a failing control. Run pregate fitness run DCP-UTILITY-RUNTIME-008.

**Scope and limits:** Project evidence gate, not a syntax detector or complete library certification. Source canaries verify the upstream contrast, not consumer compliance. Receipt fixtures verify evidence admission only. No executable command is supplied by this pack. Missing bindings remain UNVERIFIED; an adopted enforcing binding blocks stale or failed evidence, while shadow stays diagnostic. Conditional non-use requires an explicit reviewed reason and evidence, not an unexplained success.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "dcouplr 0.1.3-beta integrity-pinned published declarations and runtime",
  "locator": "dist/index.mjs:2940-2959,3239-3244; dist/index.d.mts:55-63,67-86",
  "paraphrase": "A priority-queue producer must validate the named priority before admission, await enqueue and handle a false result with an explicit reject, retry or backpressure policy. Numeric QueuePriorities ranks must not be forwarded as DPriority names. IQueue must not be called with the IPriorityQueue argument order."
}
```
