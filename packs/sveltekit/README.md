# sveltekit

Data-only SvelteKit invariants that the syntax tree can decide. The stance of this pack is: universal loads (`+page.ts`, `+layout.ts`) run on the client, so they never touch `.server` modules or private `$env`; server code answers with `Response`/`json`, redirects with 3xx, fails forms with `fail()`, and never serializes secrets or internal messages to the client. Fixtures are `.ts` files only: the engine parses TypeScript, so `+page.server.ts` logic is expressed as `.ts` targets and route filenames are enforced with `files[]` globs.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `sveltekit/SK-PAGE-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `SK-PAGE-001` | A `.server` module import (static, re-export, or dynamic) in `+page.ts` / `+layout.ts`. | Universal loads run on the client; a `.server` import drags server-only code into the bundle. | deny |
| `SK-API-001` | `redirect()` with a 200, 404, or 500 status in server route files. | Only 3xx is a redirect; failure paths must throw `error()` with the real status. | deny |
| `SK-FORM-001` | `throw { ... }` of a plain object in `+page.server.ts` / `+server.ts`. | A thrown object reaches neither `fail()` nor `error()`; the form never sees the failure. | deny |
| `SK-CONFIG-001` | `preRender`, `PreRender`, or `PRERENDER` exports in route files. | Only exact lowercase `prerender` is read; any other casing is silently ignored. | deny |
| `SK-LIBSERVER-001` | A runtime import (static, re-export, or dynamic) from a `$lib/server`, `#lib/server`, or `../lib/server` directory in `+page.ts`, `+layout.ts`, `src/hooks.ts`, or `src/hooks.client.ts`. | Server-directory modules are server-only; universal code ships to the browser. | deny |
| `SK-TRY-001` | `redirect()` inside a `try` block whose `catch` neither checks `isRedirect()` nor rethrows the caught value. | `redirect()` throws, so the catch swallows it and the user never moves. | deny |
| `SK-METHOD-001` | Lowercase `get`, `post`, `put`, `patch`, `del`, `options`, or `head` exports from `+server.ts`. | Only uppercase verb exports are valid; SvelteKit throws `Invalid export`. | deny |
| `SK-ENV-001` | A `$env/static/private` or `$env/dynamic/private` import (static or dynamic) in `+page.ts` / `+layout.ts`. | Universal load imports ship to the browser, publishing the secret. | deny |
| `SK-FETCH-001` | An absolute `http(s)` URL in a route `fetch()` call. | A hardcoded origin breaks previews and failover; same-app data uses a relative path. | deny |
| `SK-SECRET-001` | A secret-shaped value (`SECRET`, `PRIVATE_KEY`, `SERVICE_ROLE`, `TOKEN`, `PASSWORD`, and lowercase forms) in a load `return`. | Load data is serialized to the client by design. | deny |
| `SK-ERROR-001` | `error()` whose message reads `.message` off a caught error. | Raw internal messages map the backend for an attacker; log server-side, throw static. | deny |
| `SK-COOKIE-001` | Calling `cookies.set(...)` or `cookies.delete(...)` (including `event.cookies.*`) in universal `+page.ts` / `+layout.ts` files. | Universal `load` functions have no access to HTTP response headers or server `cookies`; mutate cookies in `+page.server.ts`, `+layout.server.ts`, or `+server.ts`. | deny |

## Methodologies

- `sveltekit/routing` — SK-PAGE-001, SK-API-001, SK-FORM-001, SK-CONFIG-001, SK-LIBSERVER-001, SK-TRY-001, SK-METHOD-001, SK-COOKIE-001
- `sveltekit/data` — SK-ENV-001, SK-FETCH-001, SK-SECRET-001, SK-ERROR-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 12 distinct check IDs.

Methodologies: `sveltekit/data` (preview), `sveltekit/routing` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
