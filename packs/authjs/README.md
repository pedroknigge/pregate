# authjs

Data-only rule pack for Auth.js / NextAuth v5 configuration shapes (NextAuth config, callbacks, providers, middleware session access). Source version **1.2.0** in engine **0.0.4**. TypeScript only: the engine parses TS/JS, so provider-side OAuth behavior and adapter SQL stay in BACKLOG.md.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `authjs/AUTH-SECRET-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/` (see `solana-hackathon.json`).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `AUTH-SECRET-001` | `secret: "..."` hardcoded literal in the NextAuth config. | A committed secret forges every session token. | deny |
| `AUTH-PROVIDER-001` | `Credentials(...)` provider call without `authorize` in its text. | A login form with no verification step behind it. | deny |
| `AUTH-DEBUG-001` | `debug: true` (or truthy `debug: 1`) in the NextAuth config. | Debug logs the OAuth flow into log storage. | deny |
| `AUTH-PAGES-001` | `signIn:` pointing at an absolute or template URL. | An external login URL hands credentials to another origin. | deny |
| `AUTH-CALLBACK-001` | `authorized` callback returning `true` unconditionally (arrow or block form). | The middleware file protects nothing behind it. | deny |
| `AUTH-SERVER-001` | Exact `next-auth/react` module sources in selected server paths without a valid leading client directive. | Optional server-boundary policy; client modules and ordinary text are exempt. | deny |
| `AUTH-JWT-001` | `jwt` callback with no `!token`, `token?`, `token &&`, or `if (user` guard. | Sign-in-only fields are absent on later calls. | deny |
| `AUTH-TOKEN-001` | `session` callback whose pair contains a `refreshToken` property. | A refresh token sent to the client mints fresh sessions. | deny |
| `AUTH-STRATEGY-001` | A `Credentials(...)` provider in a config with `strategy: "database"`, or with an adapter and no strategy. | Credentials sign-in only works with JWT sessions. | deny |
| `AUTH-LINK-001` | `allowDangerousEmailAccountLinking: true` on a provider. | Linking by unverified email can hand over existing accounts. | warn |
| `AUTH-REDIRECT-001` | A `redirect` callback whose whole body returns `url` unchecked. | Removes the default same-host check on callback URLs. | warn |
| `AUTH-JWT-SECRET-001` | Assigning `password`, `passwordHash`, `secret`, `privateKey`, or `refreshToken` onto `token` in the `jwt` callback. | Secrets placed in the JWT payload travel in client cookies and leak if the token is inspected or compromised. | deny |

## Methodologies

- `authjs/config` — AUTH-SECRET-001, AUTH-PROVIDER-001, AUTH-DEBUG-001, AUTH-PAGES-001, AUTH-STRATEGY-001, AUTH-LINK-001
- `authjs/session` — AUTH-CALLBACK-001, AUTH-SERVER-001, AUTH-JWT-001, AUTH-TOKEN-001, AUTH-REDIRECT-001, AUTH-JWT-SECRET-001

## Fixture coverage and limits

`pregate rules test packs/authjs` runs **67** real fixtures. Every check has at least two passing
fixtures, two failing fixtures, and one failing trap with exact lines: placeholder
secrets, empty Credentials options, truthy non-boolean debug, template sign-in URLs,
block-form `return true`, `require` of the client module, unguarded token passthrough,
aliased refresh values, a quoted database strategy, a quoted `!0` linking flag, and a
commented `return params.url` redirect.

Default severities are project policies, not complete authentication proof. The
client-directive regression covers App Router client modules, including comments
and other leading directives, and rejects late/nested strings as exemptions.
Exported module-name notes and import option values remain allowed. The
[Auth.js v5 guide](https://authjs.dev/getting-started/migrating-to-v5) distinguishes
server auth() from client useSession(); cross-file client subtrees and rendering
client components require a more specific project contract. Concrete uncaught cases and the reason each stays out of scope
are in [BACKLOG.md](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 12 distinct check IDs.

Methodologies: `authjs/config` (complete), `authjs/session` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
