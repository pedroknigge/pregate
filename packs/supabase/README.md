# supabase

Data-only rule pack for TypeScript `supabase-js` client usage. Source version **1.2.0**, for engine **0.0.5**. The engine parses TS/JS, so this pack enforces client call shapes; RLS policies, storage bucket policies, and edge function bodies need SQL and the Deno runtime and live in BACKLOG.md until then.

Complements `vibe-proof`: that pack's client-public-secret rule covers `NEXT_PUBLIC` service_role *names*, while this pack flags the `createClient` call that *uses* the key. The vibe BACKLOG explicitly punts open RLS; this pack does not claim it.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `supabase/SB-KEY-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `SB-KEY-001` | `createClient` with a service_role key in client-reachable files. | The bypass key ships to the browser. | deny |
| `SB-CLIENT-001` | `createClient` imported from the bare `supabase` package. | Wrong entrypoint; misses auth, cookie, and typing behavior. | deny |
| `SB-QUERY-001` | `.select()` with no range, limit, or order in the same statement. | One call can read the whole table. | deny |
| `SB-AUTH-001` | `supabase.auth.admin.*` in client-reachable files. | Admin API bypasses RLS; server only. | deny |
| `SB-HELPERS-001` | Imports, re-exports or requires of a deprecated `@supabase/auth-helpers-*` package. | Deprecated in favor of `@supabase/ssr`; fixes land there. | warn |
| `SB-STORAGE-001` | `.upload()` into the bucket literally named `public`. | Publishes whatever lands in it. | deny |
| `SB-RPC-001` | `.rpc("fn")` with no arguments object. | Untyped call; hides inputs from review. | deny |
| `SB-REALTIME-001` | `.channel()` subscribed with no `.on()` filter. | Streams everything the key can read. | deny |
| `SB-EDGE-001` | Raw `fetch` to a `functions/v1` URL. | Skips the client's auth header handling. | deny |
| `SB-GETUSER-001` | `supabase.auth.getSession()` inside server route handlers (`GET`, `POST`, ...), `'use server'` modules, or `createServerClient` files. | `getSession()` reads cookies without revalidating the token with Supabase Auth; server code must use `getUser()`. | deny |

## Methodologies

- `supabase/client` — SB-KEY-001, SB-CLIENT-001, SB-QUERY-001, SB-AUTH-001, SB-HELPERS-001, SB-GETUSER-001
- `supabase/storage` — SB-STORAGE-001, SB-RPC-001, SB-REALTIME-001, SB-EDGE-001

## Fixture coverage and limits

`pregate rules test packs/supabase` runs **50** real fixtures. Every check has a failing
trap with exact lines: env-read service_role keys, `require("supabase")`, `.csv()` exports
without bounds, admin `createUser` invites, barrel re-exports of auth-helpers, template-literal bucket names, template-literal
rpc names, template-literal channel names, and manual `Authorization` headers on raw
functions fetches. Server-side admin and service_role use, private-bucket uploads,
public-bucket downloads, presence filters, and `@supabase/auth-ui-*` imports remain pass guards.

The client-file rules (SB-KEY-001, SB-AUTH-001) scope to `app/**`, `components/**`,
`pages/**` (plus `src/` variants) and ignore `**/server/**` and `**/*.server.*`. Other
framework layouts outside those globs, and service_role keys arriving through helpers
or imports rather than visible arguments, are backlog cases, not claimed coverage.
Concrete uncaught cases are in [BACKLOG.md](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 10 distinct check IDs.

Methodologies: `supabase/client` (complete), `supabase/storage` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
