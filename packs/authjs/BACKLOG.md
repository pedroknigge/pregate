# authjs backlog

Judgment, provider behavior, or checks the TS syntax tree cannot decide. Most need
preset knowledge (hosts, roles, session policy) or runtime facts; the rest need a
different language pack or cross-file flow the closed pattern vocabulary cannot prove.

## Value and provenance limits

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate
arbitrary expressions, resolve imported values, or prove interprocedural data flow.
The following plausible evasions are therefore backlog cases, not pass fixtures or
claimed trap coverage.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| AUTH-SECRET-001 | `secret: readSecret()`, where an imported helper returns a committed literal. | Imported-value evaluation and secret provenance. |
| AUTH-PROVIDER-001 | `Credentials(withAuthorize(opts))`, where an imported wrapper adds the callback. | Cross-file option flow and wrapper call graphs. |
| AUTH-DEBUG-001 | `debug: isDev`, where an imported flag is true in production builds. | Value propagation and environment policy. |
| AUTH-PAGES-001 | `signIn: joinUrl(publicHost, "/login")`, where the host is external. | Constant evaluation and host allowlists. |
| AUTH-CALLBACK-001 | A block body ending in `return true` after a real check, e.g. `if (!auth?.user) return false; return true;`. The rule flags the unconditional shape only by the presence of `return true`; guarded blocks that end in `return true` are flagged too. | Control-flow proof that the earlier return dominates. |
| AUTH-SERVER-001 | `import { getSession } from "../auth-client"`, where a barrel re-exports the client module. | Cross-file re-export resolution. |
| AUTH-JWT-001 | `jwt: async (params) => spread(params)`, where a helper spreads `user` without a guard. | Parameter taint through helpers. |
| AUTH-TOKEN-001 | `session: ({ session, token }) => ({ ...session, rt: token.rt })`, where `rt` holds the refresh value under a renamed field. | Value provenance, not just the `refreshToken` name. |

## Product and provider rules

- **Auth enumeration timing.** Whether sign-in errors distinguish unknown users from wrong passwords is response behavior, not syntax.
- **OAuth PKCE config.** Code-challenge selection lives in provider options and network behavior; the TS shape alone does not prove the flow.
- **Adapter schema.** Table presence, key rotation, and session cleanup are database facts, not config shapes.
- **Session fixation rotation.** Proving the session id rotates at login needs request-lifecycle flow, not one callback's text.
- **WebAuthn options.** Challenge freshness and origin binding are runtime values, not static pairs.
- **Email provider links.** Token expiry and single-use live in the mail flow, invisible to the config tree.
- **Matcher coverage.** Whether the middleware matcher actually covers every protected route needs the route table; the authorized callback alone cannot prove it.
- **Role depth.** A role string compared in `authorized` is only as trustworthy as the JWT that carried it; token forgery needs AUTH-SECRET-001 plus key custody, which this pack cannot prove end to end.
- **Indirect JWT token mutation (`AUTH-JWT-SECRET-001` limit).** `AUTH-JWT-SECRET-001` flags direct property writes (`token.passwordHash = ...`, `token.privateKey = ...`) and returned object literals bounded directly to the `jwt` callback's own `return_statement` (`stopBy: { kind: "@fn" }`). Mutating `token` via `Object.assign(token, user)` or a nested helper function requires value-shape tracking.
- **Auth.js config by import (`AUTH-SECRET-001` limit).** Before pack 1.2.1 the rule matched every `secret: "..."` pair in any file, and all five findings on the public corpus were express-session and cookie-session options. It now needs an import of `next-auth` or an `@auth/` package in the file. A config object declared in a file that does not import Auth.js and passed in from elsewhere is not matched; that needs cross-file value flow. `vibe-proof/VP-SECRET-001` still reports a token-shaped literal anywhere.
