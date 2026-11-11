# authjs pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## authjs/config

Manifest version: `1.1.1`. Status: **complete**.

### authjs/AUTH-SECRET-001

Check: [`authjs/config/no-hardcoded-secret@1.0.1`](checks/config/no-hardcoded-secret/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.hardcoded-secret`. Minimum severity: `none`.

A committed secret signs every session token. Anyone holding it can forge sessions for any user.

Default parameters: `{}`.

**Repair:** Read the secret from the environment: secret: process.env.AUTH_SECRET. Never write the value into the config object.

**Scope and limits:** Renaming the key or moving the literal to a nearby const does not remove the committed value. The file must import next-auth or an @auth/ package. A literal secret in an express-session or cookie-session options object is not matched. A config object kept in a file that does not import Auth.js is not matched.

**Interactions when active together:**

- Duplicates `vibe-proof/VP-SECRET-001`: A token-shaped literal assigned to the Auth.js secret is reported by both rules. Settle: Keep both: AUTH-SECRET-001 also catches secrets that do not look like a known token. Reading the secret from the environment satisfies both.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js (NextAuth v5) documentation, Configuration section",
  "locator": "AUTH_SECRET environment variable",
  "paraphrase": "The library reads its encryption secret from the AUTH_SECRET environment variable. A secret written into the config object ships to the client bundle or the repo."
}
```

### authjs/AUTH-PROVIDER-001

Check: [`authjs/config/no-credentials-without-authorize@1.0.0`](checks/config/no-credentials-without-authorize/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.credentials-authorize`. Minimum severity: `none`.

A Credentials provider without authorize accepts the login UI with no verification step behind it.

Default parameters: `{}`.

**Repair:** Add an authorize callback that checks the credentials and returns the user or null.

**Scope and limits:** Listing credential fields is not verification. The callback is the check.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js (NextAuth v5) documentation, Credentials provider",
  "locator": "authorize callback",
  "paraphrase": "The Credentials provider authenticates through the authorize callback. Without it the provider renders a form that never verifies anyone."
}
```

### authjs/AUTH-DEBUG-001

Check: [`authjs/config/no-debug-in-config@1.0.0`](checks/config/no-debug-in-config/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.debug-config`. Minimum severity: `none`.

Committed debug output leaks authorization codes, token responses, and user data into log storage.

Default parameters: `{}`.

**Repair:** Remove the debug key, or set it to false. Turn it on locally through the environment when diagnosing.

**Scope and limits:** A truthy non-boolean such as 1 is still on. debug: false is the only explicit off.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js (NextAuth v5) documentation, Configuration section",
  "locator": "debug flag",
  "paraphrase": "The debug flag prints the OAuth and session flow to the logs. It exists for local diagnosis, not for committed configuration."
}
```

### authjs/AUTH-PAGES-001

Check: [`authjs/config/no-pages-signin-external@1.0.0`](checks/config/no-pages-signin-external/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.signin-external`. Minimum severity: `none`.

An external sign-in URL sends users and their credentials to a host the app does not control.

Default parameters: `{}`.

**Repair:** Point signIn at an in-app route such as /auth/signin.

**Scope and limits:** Building the URL from a template or a host variable still leaves the app.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js (NextAuth v5) documentation, pages option",
  "locator": "custom signIn page",
  "paraphrase": "The signIn page option points at the app's own login route. An absolute external URL hands credentials to another origin."
}
```

### authjs/AUTH-STRATEGY-001

Check: [`authjs/config/no-credentials-database-session@1.0.0`](checks/config/no-credentials-database-session/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.credentials-database-session`. Minimum severity: `none`.

With database sessions the Credentials login writes no session row, so the user appears signed out right after a successful login. An explicit database strategy with only Credentials providers is rejected at startup.

Default parameters: `{}`.

**Repair:** Set session: { strategy: "jwt" } in the same config. Keep the adapter if other providers need it.

**Scope and limits:** Flags a Credentials or CredentialsProvider call in providers when the same object sets strategy "database", or sets an adapter with no strategy. A session or config passed as a variable or spread is not resolved and passes.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js reference, Credentials provider, https://authjs.dev/reference/core/providers/credentials; Auth.js reference, session.strategy, https://authjs.dev/reference/nextjs",
  "locator": "Credentials provider description; session.strategy default",
  "paraphrase": "The Credentials provider can only be used if JSON Web Tokens are enabled for sessions. session.strategy defaults to jwt, but to database when an adapter is set."
}
```

### authjs/AUTH-LINK-001

Check: [`authjs/config/no-dangerous-email-linking@1.0.0`](checks/config/no-dangerous-email-linking/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.dangerous-email-linking`. Minimum severity: `none`.

A provider that lets users claim an unverified email can sign an attacker in to the existing account that owns that address.

Default parameters: `{}`.

**Repair:** Remove the option and let users link accounts while signed in. Keep it only for providers that verify email ownership, and record that decision in the preset.

**Scope and limits:** Only a literal true (or !0, !!1) on the allowDangerousEmailAccountLinking key, quoted or not, is flagged. false, a variable value and text that mentions the option pass. Warn only: the option is supported for trusted providers.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js reference, OAuth provider options, https://authjs.dev/reference/core/providers",
  "locator": "allowDangerousEmailAccountLinking",
  "paraphrase": "Auth.js does not link accounts from different providers by email by default, because that is not secure between arbitrary providers. The option is only for providers you trust to verify email addresses."
}
```

## authjs/session

Manifest version: `1.2.0`. Status: **complete**.

### authjs/AUTH-CALLBACK-001

Check: [`authjs/session/no-authorized-returns-true@1.0.0`](checks/session/no-authorized-returns-true/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.authorized-true`. Minimum severity: `none`.

An authorized callback that always returns true keeps the middleware file while protecting nothing behind it.

Default parameters: `{}`.

**Repair:** Decide on the session: return !!auth?.user, or check a role on the request path that needs it.

**Scope and limits:** A block body ending in return true is the same unconditional yes as the arrow form.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js (NextAuth v5) documentation, middleware and the authorized callback",
  "locator": "authorized callback return value",
  "paraphrase": "Middleware protects a route only when the authorized callback returns a decision based on the request. Returning true always admits every request."
}
```

### authjs/AUTH-SERVER-001

Check: [`authjs/session/no-client-getsession@1.0.1`](checks/session/no-client-getsession/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.client-getsession`. Minimum severity: `none`.

In the selected server-owned paths, session access must use the project's server auth API. A valid leading use client directive exempts a client module; importing client components for rendering is a separate project boundary decision.

Default parameters: `{}`.

**Repair:** Import { auth } from the server auth module and call await auth() in routes and server components.

**Scope and limits:** This is an optional module-boundary policy, not proof that every next-auth/react import is invalid. Only literal import/export sources and first literal require/import arguments are checked. Client directives must be in the top-level directive prologue; nested strings and late directives do not exempt the module. Cross-file client subtrees and symbol usage require project evidence.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js (NextAuth v5) documentation, server-side session access",
  "locator": "auth() versus next-auth/react in server code",
  "paraphrase": "Server code reads the session with auth(). The next-auth/react helpers are client bindings; importing them into routes and server components pulls the wrong layer."
}
```

### authjs/AUTH-JWT-001

Check: [`authjs/session/no-jwt-without-token-guard@1.0.0`](checks/session/no-jwt-without-token-guard/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.jwt-guard`. Minimum severity: `none`.

Spreading sign-in-only fields without a guard crashes or mints malformed tokens on every subsequent request.

Default parameters: `{}`.

**Repair:** Guard the callback: handle !token first, or apply user and account fields only inside if (user).

**Scope and limits:** Passing the token through untouched is still unguarded when later code assumes the sign-in fields exist.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js (NextAuth v5) documentation, jwt callback",
  "locator": "token and user/account trigger parameters",
  "paraphrase": "The jwt callback runs on every request, but user and account arrive only on sign-in. A callback that spreads them unconditionally reads fields that are absent on later calls."
}
```

### authjs/AUTH-TOKEN-001

Check: [`authjs/session/no-session-exposes-refresh-token@1.0.0`](checks/session/no-session-exposes-refresh-token/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.session-refresh-token`. Minimum severity: `none`.

A refresh token sent to the client lets anyone holding it mint fresh sessions until it is revoked.

Default parameters: `{}`.

**Repair:** Keep refresh credentials in the JWT or the database. Return only the access data the UI needs.

**Scope and limits:** Aliasing the refresh value under another key still sends it to the client.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js (NextAuth v5) documentation, session callback",
  "locator": "what the session callback returns to the client",
  "paraphrase": "The session callback shapes the object the client receives. Long-lived refresh credentials must stay server-side; only short-lived access data goes out."
}
```

### authjs/AUTH-REDIRECT-001

Check: [`authjs/session/no-open-redirect-callback@1.0.0`](checks/session/no-open-redirect-callback/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.open-redirect-callback`. Minimum severity: `none`.

Returning url unchanged removes the same-host check, so a crafted callbackUrl sends users from your login page to any site.

Default parameters: `{}`.

**Repair:** Return url only when it starts with / or its origin equals baseUrl; otherwise return baseUrl.

**Scope and limits:** Flags a redirect callback inside callbacks whose whole body is url or x.url (concise arrow, or a block with that single return; comments are ignored). Any extra statement, such as an origin check, passes. Warn only: the matcher cannot see an allowlist enforced elsewhere.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js reference, callbacks.redirect, https://authjs.dev/reference/nextjs#redirect",
  "locator": "callbacks.redirect",
  "paraphrase": "The redirect callback runs whenever the user is sent to a callback URL. By default only URLs on the same host as the origin are allowed; the documented example allows relative paths and same-origin URLs and otherwise returns baseUrl."
}
```

### authjs/AUTH-JWT-SECRET-001

Check: [`authjs/session/no-sensitive-in-jwt@1.0.0`](checks/session/no-sensitive-in-jwt/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `authjs.jwt-sensitive-field`. Minimum severity: `none`.

Copying password hashes, private keys, or secrets onto token bloat cookie size and expose credentials if the token secret leaks or is decoded.

Default parameters: `{}`.

**Repair:** Assign only safe identifiers such as token.sub = user.id or token.role = user.role inside the jwt callback.

**Scope and limits:** Only direct assignments to token.<sensitiveField> or returned object keys inside a jwt callback are matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Auth.js documentation, Callbacks (authjs.dev)",
  "locator": "https://authjs.dev/guides/basics/callbacks#jwt-callback",
  "paraphrase": "The jwt callback controls what is encoded into the session token stored in the client cookie; only minimal identity claims needed for authorization should be added."
}
```
