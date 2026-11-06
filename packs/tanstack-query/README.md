# tanstack-query

TanStack Query cache rules the syntax tree can decide. The stance of this pack is: a query key is an array, and a component does not construct a new `QueryClient` on each render. Query-function dependencies and mutation invalidation need facts this matcher does not have. They are listed in `BACKLOG.md`, with TanStack Start and TanStack Router.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `tanstack-query/TQ-KEY-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `TQ-KEY-001` | A `queryKey` whose value is a string, template, number, object, boolean, `null`, or `undefined`, including one wrapped in `as`, `satisfies`, or parentheses. | A query key has to be an array. Anything else is not a cache identity the rest of the app can invalidate. | deny |
| `TQ-CLIENT-001` | `new QueryClient()` directly inside a synchronous component or hook, or inside a `render` method. | That constructor runs on every render and replaces the cache. | deny |

## Methodologies

- `tanstack-query/keys` — TQ-KEY-001
- `tanstack-query/client` — TQ-CLIENT-001

`pregate scan` recommends both when a package manifest declares `@tanstack/react-query`, `@tanstack/vue-query`, `@tanstack/solid-query`, `@tanstack/svelte-query`, `@tanstack/angular-query`, or `@tanstack/angular-query-experimental` in `dependencies` or `peerDependencies`. A devDependency does not. A declaration that appears only under `docs/`, `examples/`, `fixtures/`, or another peripheral folder does not. `@tanstack/query-core` and the devtools packages do not, on their own, select this pack.

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.0.0`. 2 distinct check IDs.

Methodologies: `tanstack-query/client` (complete), `tanstack-query/keys` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
