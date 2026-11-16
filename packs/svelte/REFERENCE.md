# svelte pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## svelte/runes

Manifest version: `1.2.0`. Status: **complete**.

### svelte/SV-RUNE-001

Check: [`svelte/runes/no-state-destructure@1.0.0`](checks/runes/no-state-destructure/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.state-destructure`. Minimum severity: `none`.

A destructured binding holds the value from creation time. When the state updates, the copy stays stale while the template reads the live object.

Default parameters: `{}`.

**Repair:** Bind the whole object (const counter = $state(...)) and read counter.count at each use.

**Scope and limits:** Spreading the state into a new object ({...counter}) copies the same way. A factory that builds the initial value does not exempt the destructure.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, runes ($state)",
  "locator": "$state creates deeply reactive state",
  "paraphrase": "Keep the state object whole and read its properties. Destructuring copies the values out once, so later updates never reach the copy."
}
```

### svelte/SV-DERIVED-001

Check: [`svelte/runes/no-derived-write@1.1.0`](checks/runes/no-derived-write/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.derived-async`. Minimum severity: `none`.

An async derivation stores a promise instead of the value, and every reader must unwrap it. The derivation also reruns on each input change, refiring the request.

Default parameters: `{}`.

**Repair:** Load asynchronously in an $effect or an event handler, keep the result in $state, and derive synchronously from that state.

**Scope and limits:** Naming the async function (async function load) does not make it synchronous. A promise returned without the async keyword is still async and stays out of reach of this shape.

**Interactions when active together:**

- Duplicates `svelte/SV-DERIVED-003`: Both flag async callbacks passed to $derived or $derived.by; SV-DERIVED-001 also covers top-level await expressions inside $derived. Settle: Keep both enabled or turn svelte/SV-DERIVED-003 off in overrides when SV-DERIVED-001 is active.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, runes ($derived)",
  "locator": "$derived recomputes from its inputs",
  "paraphrase": "$derived recomputes whenever its inputs change, so it must be a pure synchronous expression. An async function returns a promise, and an await has nothing to suspend."
}
```

### svelte/SV-EFFECT-001

Check: [`svelte/runes/no-effect-state-loop@1.0.0`](checks/runes/no-effect-state-loop/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.effect-async`. Minimum severity: `none`.

The runtime treats the returned promise as the cleanup function. The real cleanup never runs, and a rejection escapes the effect instead of surfacing at the await.

Default parameters: `{}`.

**Repair:** Define an async function inside the synchronous callback and void it, or move the work into the event that caused it.

**Scope and limits:** An async helper declared inside the callback still matches the arguments text; hoist the helper out of the $effect call. $effect.pre and $effect.root take the same synchronous callback.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, runes ($effect)",
  "locator": "$effect callbacks are synchronous",
  "paraphrase": "An $effect callback runs its cleanup protocol on change. An async callback returns a promise instead of a cleanup, so teardown never runs and rejections escape."
}
```

### svelte/SV-INSPECT-001

Check: [`svelte/runes/no-inspect-in-prod@1.0.0`](checks/runes/no-inspect-in-prod/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.inspect-prod`. Minimum severity: `none`.

A shipped $inspect keeps logging internals on every state change, leaking data to the console and slowing the hot path.

Default parameters: `{}`.

**Repair:** Delete the $inspect call before commit. Keep the values it watched reachable through the state object for the next debug session.

**Scope and limits:** $inspect.trace is the same helper behind a member call and is still flagged. A comment that mentions $inspect is not a call and is ignored.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, runes ($inspect)",
  "locator": "$inspect traces reactive values",
  "paraphrase": "$inspect logs reactive values while developing. It is a debugger, not program output, so it does not ship."
}
```

### svelte/SV-DOLLAR-001

Check: [`svelte/runes/no-non-rune-dollar-fn@1.0.0`](checks/runes/no-non-rune-dollar-fn/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.dollar-fn`. Minimum severity: `none`.

A hallucinated rune compiles as a call to an undefined function and fails at runtime, far from the line that invented it.

Default parameters: `{}`.

**Repair:** Use the documented rune for the job ($state for state, $derived for computed values, $effect for side effects).

**Scope and limits:** Lowercase $names outside the rune list (for example a local helper) are not flagged; only $Uppercase calls are. A member call on a $UPPER object is the same hallucinated shape.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, runes",
  "locator": "the rune names are fixed",
  "paraphrase": "The runes are $state, $derived, $effect, $props, $bindable, $inspect and $host. A different $Name is not a rune; it calls something that does not exist."
}
```

### svelte/SV-MODULE-001

Check: [`svelte/runes/no-rune-outside-svelte-module@1.0.0`](checks/runes/no-rune-outside-svelte-module/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.rune-outside-module`. Minimum severity: `none`.

Svelte never compiles a plain .ts or .js module, so $state, $derived or $effect there is an undefined call that fails at runtime.

Default parameters: `{}`.

**Repair:** Rename the module to name.svelte.ts (tests to name.svelte.test.ts) and update its imports, or move the reactive code into a component.

**Scope and limits:** A directory named svelte does not opt a file in; only the .svelte.ts or .svelte.js file name does. Store helpers from svelte/store are plain functions and are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, .svelte.js and .svelte.ts files; runtime errors (https://svelte.dev/docs/svelte/svelte-js-files)",
  "locator": "What are runes?; rune_outside_svelte",
  "paraphrase": "Runes are only available in .svelte and .svelte.js/.svelte.ts files. Other modules are not compiled by Svelte, so a rune there is an error."
}
```

### svelte/SV-ORPHAN-001

Check: [`svelte/runes/no-module-level-effect@1.0.0`](checks/runes/no-module-level-effect/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.module-level-effect`. Minimum severity: `none`.

Module code runs once when the file is imported, with no parent effect, so a top-level $effect throws effect_orphan instead of syncing anything.

Default parameters: `{}`.

**Repair:** Move the $effect into a function that a component calls during setup, or wrap it in $effect.root and keep the returned cleanup.

**Scope and limits:** An if (typeof window ...) guard still runs while the module loads. Effects inside functions, constructors and $effect.root callbacks are not matched; plain .ts modules are reported by SV-MODULE-001 instead.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, runes ($effect); runtime errors (https://svelte.dev/docs/svelte/$effect)",
  "locator": "$effect.root; effect_orphan",
  "paraphrase": "Effects can only be created while a parent effect is running, for example during component initialisation. $effect.root creates effects outside that phase."
}
```

### svelte/SV-PROPS-001

Check: [`svelte/runes/no-component-rune-in-module@1.0.0`](checks/runes/no-component-rune-in-module/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.component-rune-in-module`. Minimum severity: `none`.

A .svelte.js or .svelte.ts module is not a component, so the compiler rejects $props, $props.id, $bindable and $host there and the build fails.

Default parameters: `{}`.

**Repair:** Read props in the component with $props() and pass the values, or the host element, to the module function as arguments.

**Scope and limits:** $props.id() is part of $props, not a general id helper. Plain .ts modules are reported by SV-MODULE-001 instead.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, compiler errors (https://svelte.dev/docs/svelte/compiler-errors)",
  "locator": "props_invalid_placement; bindable_invalid_location; host_invalid_placement",
  "paraphrase": "$props() only works at the top level of a component, $bindable() only inside a $props() declaration, and $host() only in custom element components."
}
```

### svelte/SV-DERIVED-002

Check: [`svelte/runes/no-function-in-derived@1.0.0`](checks/runes/no-function-in-derived/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.function-in-derived`. Minimum severity: `none`.

$derived(() => x) stores the arrow itself, and because nothing is read while deriving, the value never updates and readers get a function instead of the result.

Default parameters: `{}`.

**Repair:** Use $derived.by(() => ...) when the derivation needs a function body, or pass the expression directly: $derived(items.length).

**Scope and limits:** A type argument does not make the function intentional. Async functions are reported by SV-DERIVED-001 and are not matched here; callbacks inside the expression, such as filter((x) => ...), are fine.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, runes ($derived) (https://svelte.dev/docs/svelte/$derived)",
  "locator": "$derived.by",
  "paraphrase": "$derived takes an expression; $derived.by takes a function. $derived(expression) is equivalent to $derived.by(() => expression)."
}
```

### svelte/SV-DERIVED-003

Check: [`svelte/runes/no-async-derived@1.0.0`](checks/runes/no-async-derived/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.async-derived`. Minimum severity: `none`.

Passing an async function to $derived or $derived.by makes the derived state hold a Promise object and loses reactive tracking across await points.

Default parameters: `{}`.

**Repair:** Compute synchronous derivations in $derived.by(() => ...), and manage asynchronous fetching through $effect or an explicit async resource helper.

**Scope and limits:** Both async arrow functions and async function expressions passed directly to $derived or $derived.by are matched.

**Interactions when active together:**

- Duplicates `svelte/SV-DERIVED-001`: Both flag async callbacks passed to $derived or $derived.by; SV-DERIVED-001 also covers top-level await expressions inside $derived. Settle: Keep both enabled or turn svelte/SV-DERIVED-003 off in overrides when SV-DERIVED-001 is active.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, $derived and $derived.by (https://svelte.dev/docs/svelte/$derived)",
  "locator": "$derived.by synchronous callback requirement",
  "paraphrase": "$derived.by takes a synchronous function that returns the derived value. An async callback returns an unresolved Promise and stops tracking dependencies after the first await."
}
```

## svelte/stores

Manifest version: `1.0.0`. Status: **complete**.

### svelte/SV-EVT-001

Check: [`svelte/events/no-createeventdispatcher-in-runes@1.0.0`](checks/events/no-createeventdispatcher-in-runes/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.legacy-dispatcher`. Minimum severity: `none`.

A dispatcher event needs a forwarding listener at every level, while a callback prop is a typed function the parent passes down directly.

Default parameters: `{}`.

**Repair:** Declare the callback in $props (let { onsave } = $props()) and call it instead of dispatching.

**Scope and limits:** Importing the dispatcher from svelte/legacy is the same legacy call and is still flagged. Typing the dispatcher with a generic does not change the call shape.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, events",
  "locator": "callback props replace the dispatcher",
  "paraphrase": "In runes mode a component notifies its parent through a callback prop. createEventDispatcher is the legacy event API."
}
```

### svelte/SV-LEGACY-001

Check: [`svelte/classes/no-svelte-legacy-import@1.0.0`](checks/classes/no-svelte-legacy-import/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.legacy-import`. Minimum severity: `none`.

A legacy import pulls the compatibility layer into new code, so the next migration has to untangle both APIs from the same module.

Default parameters: `{}`.

**Repair:** Import from svelte (untrack, tick) or svelte/store. Isolate remaining legacy usage in one adapter module.

**Scope and limits:** A dynamic import or a require of the same path is still the compatibility layer. A comment that mentions the path is not an import and is ignored.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, legacy mode",
  "locator": "svelte/legacy is the compatibility layer",
  "paraphrase": "The svelte/legacy module keeps old components running. New runes code imports from svelte instead."
}
```

### svelte/SV-TICK-001

Check: [`svelte/async/no-floating-tick@1.0.0`](checks/async/no-floating-tick/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `svelte.floating-tick`. Minimum severity: `none`.

Code after a floating tick reads the DOM before the state change applied, so measurements and focus land on the previous render.

Default parameters: `{}`.

**Repair:** Await the tick, or return it when the caller waits. Chain .then only on an awaited or returned tick.

**Scope and limits:** A branch does not settle the promise: tick on one arm still floats when the arm runs. Awaiting the .then chain settles it and is ignored.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Svelte 5 documentation, tick",
  "locator": "tick returns a promise",
  "paraphrase": "tick settles after pending state changes apply. An un-awaited tick lets later lines run before the update landed."
}
```
