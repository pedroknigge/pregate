# supabase pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## supabase/client

Manifest version: `1.2.1`. Status: **complete**.

### supabase/SB-KEY-001

Check: [`supabase/client/no-service-role-in-client@1.0.1`](checks/client/no-service-role-in-client/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.service-role-in-client`. Minimum severity: `none`.

A service_role key in client-reachable code hands every reader full bypass of row-level security. Rotation then means reissuing keys and auditing every row.

Default parameters: `{}`.

**Repair:** Build the browser client with the anon key. Move service_role use into server code and expose safe operations through routes.

**Scope and limits:** Reading the key from process.env does not make it safe. A SERVICE_ROLE value in a component or page file still ships to the browser. App Router and Pages Router handlers (app/api, pages/api, and route.ts) are server-only and are not flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, supabase-js client and API keys",
  "locator": "service_role versus anon key pages",
  "paraphrase": "The anon key is safe for the browser and obeys RLS. The service_role key bypasses RLS and must never ship to the client."
}
```

### supabase/SB-CLIENT-001

Check: [`supabase/client/no-singleton-client-missing@1.0.1`](checks/client/no-singleton-client-missing/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.wrong-client-package`. Minimum severity: `none`.

Importing createClient from the wrong package resolves to nothing maintained, so the client silently misses auth, cookie, and typing behavior the documented packages provide.

Default parameters: `{}`.

**Repair:** Import createClient from @supabase/supabase-js in the browser, or from @supabase/ssr where cookies are involved.

**Scope and limits:** Dynamic import and require of the same bare specifier are the same mistake, not an escape. A string that only says supabase inside an exported function is not an import.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, supabase-js and ssr client setup",
  "locator": "createClient import pages",
  "paraphrase": "Browser and server clients come from @supabase/supabase-js or @supabase/ssr. The bare supabase specifier is not the client entrypoint."
}
```

### supabase/SB-QUERY-001

Check: [`supabase/client/no-unbounded-select@1.0.1`](checks/client/no-unbounded-select/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.unbounded-select`. Minimum severity: `none`.

One unbounded read can pull the whole table into memory, the response, and the bill. The failure shows up in production data sizes, not in review.

Default parameters: `{}`.

**Repair:** Chain .range(from, to), .limit(n), .single(), or .maybeSingle() onto a table read. A select that returns rows from insert, update, upsert, or delete is already one row set.

**Scope and limits:** The rule reads a Supabase .from(...).select(...) in a file that imports @supabase/supabase-js or @supabase/ssr. .range(), .limit(), .order(), .single(), and .maybeSingle() are bounds. .csv() is not. A select that is not that chain, including Drizzle db.select().from(...) and DOM element.select(), is not this call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, querying with range and limit",
  "locator": "pagination pages for range and limit",
  "paraphrase": "Reads should page with range or cap with limit. An unbounded select returns the whole result set in one call."
}
```

### supabase/SB-AUTH-001

Check: [`supabase/client/no-auth-admin-in-client@1.0.1`](checks/client/no-auth-admin-in-client/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.auth-admin-in-client`. Minimum severity: `none`.

An admin call from the browser needs the bypass key next to it, so flagging the call also flags the key leak. Either one alone compromises every user row.

Default parameters: `{}`.

**Repair:** Move admin calls into server code and call them from the client through a route that checks the caller's session first.

**Scope and limits:** An invite-shaped createUser is still the admin API. getUser and session reads stay client-safe and are not flagged. App Router and Pages Router handlers (app/api, pages/api, and route.ts) are server-only and are not flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, auth admin API",
  "locator": "server-side auth admin pages",
  "paraphrase": "The auth admin API manages users with the service_role key and bypasses RLS. It runs server-side only."
}
```

### supabase/SB-HELPERS-001

Check: [`supabase/client/no-deprecated-auth-helpers@1.0.1`](checks/client/no-deprecated-auth-helpers/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.auth-helpers`. Minimum severity: `none`.

The deprecated helpers no longer get fixes, so session and cookie bugs stay in the app. A new file that imports them also grows a codebase that must migrate later.

Default parameters: `{}`.

**Repair:** Import createBrowserClient or createServerClient from @supabase/ssr and pass cookie getAll/setAll handlers, as in the Supabase SSR guide for your framework.

**Scope and limits:** Do not wrap the helpers in a local barrel to hide the import; the re-export is still flagged. A string that names the package without importing it is not an import. @supabase/auth-ui-react and @supabase/supabase-js are different packages and stay allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, Migrating to the SSR package from Auth Helpers",
  "locator": "https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers",
  "paraphrase": "The Auth Helpers packages are deprecated and replaced by @supabase/ssr. Bug fixes and new features land only in @supabase/ssr, so uninstall the helpers and create clients with createBrowserClient and createServerClient."
}
```

### supabase/SB-GETUSER-001

Check: [`supabase/client/no-server-get-session@1.0.0`](checks/client/no-server-get-session/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.server-get-session`. Minimum severity: `none`.

auth.getSession() reads the session cookie without revalidating its signature or revocation state with the Supabase Auth server, allowing spoofed or revoked sessions in server handlers.

Default parameters: `{}`.

**Repair:** Call await supabase.auth.getUser() in server actions, route handlers, and createServerClient contexts.

**Scope and limits:** Matches .auth.getSession() in files declaring HTTP route handlers (GET/POST/PUT/PATCH/DELETE), 'use server' directives, or createServerClient calls.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, Setting up Server-Side Auth for Next.js (supabase.com)",
  "locator": "https://supabase.com/docs/guides/auth/server-side/nextjs",
  "paraphrase": "Never trust supabase.auth.getSession() inside server code such as middleware, route handlers, or server actions; it does not revalidate the Auth token. Always use supabase.auth.getUser()."
}
```

## supabase/storage

Manifest version: `1.0.1`. Status: **complete**.

### supabase/SB-STORAGE-001

Check: [`supabase/storage/no-public-bucket-upload@1.0.0`](checks/storage/no-public-bucket-upload/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.public-bucket-upload`. Minimum severity: `none`.

Writing user uploads into a public bucket publishes them to anyone with the URL, including files the user thought were private.

Default parameters: `{}`.

**Repair:** Upload into a named private bucket such as avatars, then serve reads through signed URLs or storage policies.

**Scope and limits:** Quoting the name with backticks is still the public bucket. Reading from public with download is fine; writing is the flagged shape.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, storage buckets and access control",
  "locator": "public versus private bucket pages",
  "paraphrase": "Uploads belong in private buckets served through signed URLs or download policies. A bucket literally named public serves whatever lands in it."
}
```

### supabase/SB-RPC-001

Check: [`supabase/rpc/no-untyped-rpc@1.1.0`](checks/rpc/no-untyped-rpc/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.untyped-rpc`. Minimum severity: `none`.

Generated Database types check a static function name, including a function whose Args are an empty record. A computed name skips that check, so the call can name a function the schema does not have.

Default parameters: `{}`.

**Repair:** Pass the static function name from the generated types. Add the params object only when the function has arguments.

**Scope and limits:** The rule runs only in a file that imports @supabase/supabase-js or @supabase/ssr. A static string or a static template with no substitution is allowed, with or without a params object. An interpolated or computed name stays untyped. A client that is not Supabase is not this call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, calling Postgres functions",
  "locator": "rpc params pages",
  "paraphrase": "An rpc call names a Postgres function with a static string so generated types can check it. A zero-argument function is still rpc(\"name\"). A name computed at runtime is not."
}
```

### supabase/SB-REALTIME-001

Check: [`supabase/realtime/no-unfiltered-subscription@1.0.0`](checks/realtime/no-unfiltered-subscription/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.unfiltered-subscription`. Minimum severity: `none`.

An unfiltered subscription pushes every change the key can read to the browser, multiplying realtime traffic and leaking rows the UI never shows.

Default parameters: `{}`.

**Repair:** Add .on() with the event, schema, and table before .subscribe(), or use presence/broadcast with their own handlers.

**Scope and limits:** Interpolating an id into the channel name is not a filter. Presence .on() handlers count as filters and are not flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, realtime postgres_changes",
  "locator": "channel filter and subscribe pages",
  "paraphrase": "Subscriptions scope events with an .on() handler naming event, schema, and table. A bare channel streams everything it can see."
}
```

### supabase/SB-EDGE-001

Check: [`supabase/edge/no-direct-fetch-to-functions@1.0.0`](checks/edge/no-direct-fetch-to-functions/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `supabase.direct-fetch-to-functions`. Minimum severity: `none`.

A hand-rolled fetch must rebuild auth header forwarding, so tokens drift, refresh, and leak through manual plumbing instead of the client's handling.

Default parameters: `{}`.

**Repair:** Call supabase.functions.invoke(name, { body }) and let the client attach the session.

**Scope and limits:** A hand-set Authorization header is still manual plumbing. Plain fetch to the app's own routes is unaffected and is not flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Supabase documentation, invoking edge functions",
  "locator": "functions.invoke client pages",
  "paraphrase": "Clients invoke edge functions through supabase.functions.invoke, which attaches auth headers. A raw fetch to functions/v1 skips that handling."
}
```
