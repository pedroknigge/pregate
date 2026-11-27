# astro

Astro checks for the TypeScript and JavaScript files Astro reads outside a template: `astro.config.*`, content collection config, `src/middleware`, `src/pages` endpoints, and `src/actions`. [Astro's content collections](https://docs.astro.build/en/guides/content-collections/) take a Zod schema, and [environment variables](https://docs.astro.build/en/guides/environment-variables/) cannot be both client and secret.

The engine does not parse `.astro` files, the same limit as `.vue` and `.svelte`. `client:*` islands and `server:defer` are in `BACKLOG.md`. Fixtures are `.ts` and `.js` files.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `ASTRO-SCHEMA-001` | `defineCollection` / `defineLiveCollection` with a closed object and no `schema` in `src/content.config.*` or `src/content/config.*`. | A Zod schema is optional and recommended; without it, bad frontmatter shows up far from the collection. | warn |
| `ASTRO-LOADER-001` | The same calls with no `loader`, only when `astro` is entirely 5.0.0 or newer. | Astro 5 requires a loader. Astro 4 `type: "content"` stays quiet. | deny |
| `ASTRO-ENV-001` | `envField.*( { context: "client", access: "secret" } )` in `astro.config.*`. | A client secret would ship to the browser. The docs say that pair is impossible. | deny |
| `ASTRO-ADAPTER-001` | `defineConfig({ output: "server" })` with no `adapter` on that object. | Server output renders every page on demand, which needs an adapter. | deny |
| `ASTRO-MW-001` | `src/middleware.ts` or `src/middleware/index.ts` with no named `onRequest` export. | Astro ignores a default export and does not run the middleware. | deny |
| `ASTRO-ROUTE-001` | A lowercase `get`, `post`, `put`, `patch`, `options`, `head`, or `all` export from `src/pages`. | Only the uppercase method names are handlers. `_` files are not routes. | deny |
| `ASTRO-ACTION-001` | `defineAction` in `src/actions` with a closed object and no `handler`. | The handler is the server function. `input` may be omitted. | deny |

## Methodologies

- `astro/config` — ASTRO-ENV-001, ASTRO-ADAPTER-001
- `astro/content` — ASTRO-SCHEMA-001, ASTRO-LOADER-001
- `astro/routing` — ASTRO-MW-001, ASTRO-ROUTE-001, ASTRO-ACTION-001

Scan recommends this pack when `astro` is a dependency or peer dependency of a primary package. A devDependency, `astro.config.*`, or a `.astro` file does not. A match only under `docs/`, `examples/`, or `fixtures/` does not either.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.0.0`. 7 distinct check IDs.

Methodologies: `astro/config` (preview), `astro/content` (preview), `astro/routing` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
