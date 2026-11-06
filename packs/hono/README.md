# hono

Data-only Hono checks the syntax tree can decide for Web Standards and edge apps. Handlers stay on the route, or move only through `factory.createHandlers()`. Sub-apps mount with `app.route()`. HEAD is served by GET. Middleware awaits `next()`, and shared middleware is built with `createMiddleware` or `factory.createMiddleware`. The rules come from the [Hono best-practices guide](https://hono.dev/docs/guides/best-practices), the [middleware guide](https://hono.dev/docs/guides/middleware), and the [factory helper](https://hono.dev/docs/helpers/factory).

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `hono/HONO-CTRL-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `HONO-CTRL-001` | A route verb on a Hono app whose handler is an identifier or a method, and a class named `*Controller` with a `Context` parameter. | The handler loses the path-parameter type. `factory.createHandlers()` and an inline handler keep it. `app.route()` is how a sub-app is mounted. | deny |
| `HONO-HEAD-001` | `app.head(...)` or `app.on('HEAD', ...)` on a Hono app. | Hono turns HEAD into GET and never calls that handler, so its headers are not sent. | deny |
| `HONO-NEXT-001` | `next()` inside middleware whose parameters are `(c, next)` or `(_, next)`, when the call is not awaited. | Code after `next()` runs before the rest of the chain finishes. | deny |
| `HONO-MW-001` | A `(c, next)` or `(_, next)` function declared outside `createMiddleware`, `createHandlers`, `app.use`, or a route verb. | Reused middleware without `createMiddleware` drops the `Env` type. `createFactory` is the way to share that type with `createApp`. | deny |

## Methodologies

- `hono/routing` — HONO-CTRL-001, HONO-HEAD-001
- `hono/middleware` — HONO-NEXT-001, HONO-MW-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

`pregate scan` recommends this pack when a `package.json` dependency or peer dependency is exactly `hono`. A devDependency does not count. A declaration that exists only under a docs site, examples tree, website folder, or `fixture/` / `fixtures/` directory does not count.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.0.0`. 4 distinct check IDs.

Methodologies: `hono/middleware` (complete), `hono/routing` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
