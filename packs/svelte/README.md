# svelte

Svelte 5 runes invariants that the syntax tree can decide. The stance of this pack is: $state objects stay whole (destructuring copies once and goes stale); $derived stays synchronous and pure while $effect callbacks stay synchronous; $inspect is a development helper that never ships; only the documented runes exist (a $Uppercase call is a hallucination); runes components notify parents through callback props, not createEventDispatcher; new code imports from svelte, never svelte/legacy; and tick is awaited or returned, never left floating.

Fixtures are `.ts` files with realistic Svelte 5 runes TypeScript (`.svelte.ts` module style). There is no `.svelte` grammar: runes are plain call syntax ($state(...), $derived(...), $effect(...), $props(...)), fully matchable in the typescript and tsx grammars. Older fixtures use plain `.ts` names for brevity; in a real project those files must be named `*.svelte.ts`, which SV-MODULE-001 enforces.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `svelte/SV-RUNE-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `SV-RUNE-001` | Destructuring `$state(...)` (`const { x } = $state(...)`). | The binding copies once and misses every later update. | deny |
| `SV-DERIVED-001` | `$derived` of an async function or an `await` (`$derived(async ...)`, `$derived(await ...)`). | The derivation stores a promise instead of the value and refires the request on each input change. | deny |
| `SV-EFFECT-001` | An `async` callback passed directly to `$effect` (also `$effect.pre`, `$effect.root`). | The runtime receives a promise instead of a cleanup function, so teardown never runs. | deny |
| `SV-INSPECT-001` | `$inspect(...)` calls, including `$inspect.trace(...)`. | A shipped `$inspect` logs internals on every state change. | deny |
| `SV-DOLLAR-001` | Calling `$Uppercase(...)` functions that are not documented runes. | A hallucinated rune compiles as a call to something that does not exist. | deny |
| `SV-EVT-001` | `createEventDispatcher()` calls. | Runes components notify parents through typed callback props. | deny |
| `SV-LEGACY-001` | Imports (static, dynamic, or `require`) from `svelte/legacy`. | New code imports from `svelte`; legacy compat stays isolated. | deny |
| `SV-TICK-001` | Bare `tick()` statements and un-awaited `tick().then(...)` chains. | Later lines run before the pending update landed. | deny |
| `SV-MODULE-001` | Rune calls in a TS/JS file whose name is not `*.svelte.*`. | Svelte only compiles `.svelte` and `.svelte.js/.svelte.ts` files; elsewhere a rune is an undefined call. | deny |
| `SV-ORPHAN-001` | `$effect` / `$effect.pre` outside any function in a `.svelte.*` module. | Module code has no parent effect, so Svelte throws `effect_orphan`; use `$effect.root`. | deny |
| `SV-PROPS-001` | `$props`, `$props.id`, `$bindable` or `$host` in a `.svelte.*` module. | These runes are component-only; the compiler rejects them in modules. | deny |
| `SV-DERIVED-002` | A non-async arrow or function expression as the `$derived(...)` argument. | The derived value becomes the function itself; `$derived.by` takes the function. | warn |
| `SV-DERIVED-003` | Passing an `async` arrow or function expression directly to `$derived(...)` or `$derived.by(...)`. | Derived runes are synchronous; an async callback stores a Promise and stops tracking dependencies after the first await. | deny |

## Methodologies

- `svelte/runes` — SV-RUNE-001, SV-DERIVED-001, SV-EFFECT-001, SV-INSPECT-001, SV-DOLLAR-001, SV-MODULE-001, SV-ORPHAN-001, SV-PROPS-001, SV-DERIVED-002, SV-DERIVED-003
- `svelte/stores` — SV-EVT-001, SV-LEGACY-001, SV-TICK-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 13 distinct check IDs.

Methodologies: `svelte/runes` (preview), `svelte/stores` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
