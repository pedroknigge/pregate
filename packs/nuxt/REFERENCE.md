# nuxt pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.3.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## nuxt/data

Manifest version: `1.1.0`. Status: **complete**.

### nuxt/NUXT-FETCH-001

Check: [`nuxt/data/no-bare-fetch-in-app@1.0.0`](checks/data/no-bare-fetch-in-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.no-bare-fetch-in-app`. Minimum severity: `none`.

A bare fetch in pages, components, or composables double-fires across SSR and hydration and skips the shared payload cache.

Default parameters: `{}`.

**Repair:** Replace fetch with useFetch or useAsyncData with a stable key so the server result replays on the client.

**Scope and limits:** Calling fetch through globalThis does not change the call. The receiver is not the rule; the fetch is.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt data fetching composables",
  "locator": "useFetch and useAsyncData SSR dedupe",
  "paraphrase": "useFetch and useAsyncData run once on the server and replay on the client. A bare fetch runs twice and can disagree."
}
```

### nuxt/NUXT-ENV-001

Check: [`nuxt/config/no-process-env-in-app@1.0.0`](checks/config/no-process-env-in-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.no-process-env-in-app`. Minimum severity: `none`.

Reading process.env in app code either inlines secrets into the client bundle or silently yields undefined where the build did not inject it.

Default parameters: `{}`.

**Repair:** Expose the value through runtimeConfig and read it with useRuntimeConfig in app code.

**Scope and limits:** Subscript access does not hide the read. process.env["X"] is the same environment read as process.env.X.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt runtime config",
  "locator": "useRuntimeConfig public and private values",
  "paraphrase": "Runtime config separates private server values from public client values. process.env has no such split in app code."
}
```

### nuxt/NUXT-STATE-001

Check: [`nuxt/state/no-unkeyed-usestate@1.0.0`](checks/state/no-unkeyed-usestate/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.no-unkeyed-usestate`. Minimum severity: `none`.

An unkeyed useState merges every component instance into one slot, so one cart, counter, or form overwrites another.

Default parameters: `{}`.

**Repair:** Pass a unique string key and an initializer: useState("cart", () => []).

**Scope and limits:** Type arguments do not key the state. useState<string>() without a key still shares one slot.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt useState keyed shared state",
  "locator": "useState key argument",
  "paraphrase": "useState without a key returns one shared ref for every caller. The key is what separates independent state."
}
```

### nuxt/NUXT-HYDR-001

Check: [`nuxt/hydration/no-random-in-setup@1.0.0`](checks/hydration/no-random-in-setup/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.no-random-in-setup`. Minimum severity: `none`.

Math.random and Date.now in setup code produce one value on the server and another on the client, so hydration patches or warns on every load.

Default parameters: `{}`.

**Repair:** Generate the value on the server and pass it down, or generate it after mount where only the client renders it.

**Scope and limits:** A lazy initializer does not defer past setup. useState("k", () => Date.now()) still stamps during SSR.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Vue SSR hydration matching",
  "locator": "server-rendered versus client values",
  "paraphrase": "Setup code runs on both server and client and must produce the same tree. Nondeterministic values render twice and mismatch."
}
```

### nuxt/NUXT-NAV-001

Check: [`nuxt/routing/no-floating-navigateto@1.0.0`](checks/routing/no-floating-navigateto/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.floating-navigateto`. Minimum severity: `none`.

A discarded navigateTo in middleware lets the original navigation continue, so the guarded page renders for a user who should have been redirected.

Default parameters: `{}`.

**Repair:** Write return navigateTo("/login") or return abortNavigation() in middleware, and await navigateTo(...) in handlers and composables.

**Scope and limits:** Putting the call on one arm of an if does not return it. An arrow with an expression body already returns its value and is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt navigateTo and route middleware (https://nuxt.com/docs/4.x/api/utils/navigate-to)",
  "locator": "navigateTo usage note; Within route middleware; middleware return values",
  "paraphrase": "Always await or return the result of navigateTo. In route middleware a redirect or cancellation happens only when navigateTo or abortNavigation is returned."
}
```

### nuxt/NUXT-ASYNC-001

Check: [`nuxt/data/no-empty-asyncdata-handler@1.0.0`](checks/data/no-empty-asyncdata-handler/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.empty-asyncdata-handler`. Minimum severity: `none`.

A handler that only fills a store or ref resolves to undefined, so the payload carries nothing and the client fetches the same data again during hydration.

Default parameters: `{}`.

**Repair:** Return the fetched data. When the handler only fills a store, return true after the store action.

**Scope and limits:** A return inside a nested callback, or a bare return, does not give the handler a value. Named handler references and expression-bodied arrows are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt useAsyncData (https://nuxt.com/docs/4.x/api/composables/use-async-data)",
  "locator": "Parameters, handler",
  "paraphrase": "The handler must return a truthy value, not undefined or null, or the request may be duplicated on the client."
}
```

### nuxt/NUXT-META-001

Check: [`nuxt/config/no-process-runtime-flags@1.0.0`](checks/config/no-process-runtime-flags/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.process-runtime-flags`. Minimum severity: `none`.

The process flags only exist through a compatibility define; newer Nuxt drops their types, so the branch stops type-checking and confuses server and client builds.

Default parameters: `{}`.

**Repair:** Replace process.client with import.meta.client, process.server with import.meta.server and process.dev with import.meta.dev.

**Scope and limits:** process.browser is the same deprecated flag under its Nuxt 2 name. process.env is a separate rule (NUXT-ENV-001).

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt import.meta (https://nuxt.com/docs/4.x/api/advanced/import-meta)",
  "locator": "Runtime (App) Properties",
  "paraphrase": "process.browser, process.client, process.dev, process.server and process.test are soft-deprecated since Nuxt 3.12. Prefer the matching import.meta flags."
}
```

## nuxt/security

Manifest version: `1.0.0`. Status: **complete**.

### nuxt/NUXT-PIN-001

Check: [`nuxt/security/no-vulnerable-nuxt-pin@1.0.0`](checks/security/no-vulnerable-nuxt-pin/check.json). Default severity: **warn**.

Implementation: `dependency-pin`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `nuxt.security.pin`. Minimum severity: `none`.

A nuxt pin that can still install 3.x or a 4.x release before 4.7.0 keeps the payload route-rule bypass, the repeated-slash route-rule bypass, and the dev-server runtime-config exposure.

Default parameters: `{"package":"nuxt","introduced":"3.0.0","fixed":"4.7.0"}`.

**Repair:** Upgrade nuxt to >= 4.7.0. Nuxt 3 has no patched line.

**Scope and limits:** The warning is a nuxt spec that can install >=3.0.0 and <4.7.0, from dependencies, devDependencies, peerDependencies, or optionalDependencies, or a resolved lockfile version in that range. A pin entirely below 3.0.0, a pin at >=4.7.0, and an unreadable spec such as *, latest, or a git URL do not warn. @nuxt/nitro-server, @nuxt/vite-builder, and @nuxt/vite-server move with the nuxt release; this check reads the nuxt pin. A package whose name merely starts with nuxt is not this package.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "package": {
    "const": "nuxt"
  },
  "introduced": {
    "const": "3.0.0"
  },
  "fixed": {
    "const": "4.7.0"
  }
}
```

Source metadata:

```json
{
  "work": "Nuxt security advisories GHSA-jxc9-w3j6-pwp2, GHSA-vrh2-cfcx-c3fg, and GHSA-h5xj-x893-p5f7",
  "locator": "https://github.com/nuxt/nuxt/security/advisories/GHSA-jxc9-w3j6-pwp2",
  "paraphrase": "The three advisories published on 2026-11-24 are fixed in 4.7.0. Each one lists the Nuxt 3 range with no patched version. Nuxt 3 has no patched line."
}
```

### nuxt/NUXT-RULES-001

Check: [`nuxt/security/no-payload-route-rules@1.0.0`](checks/security/no-payload-route-rules/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.security.route-rules`. Minimum severity: `none`.

Below 4.7.0, GET <route>/_payload.json ignores the page's redirect, proxy, headers, cors, ssr: false, and cache exclusion, and can store the rendered data for another user.

Default parameters: `{}`.

**Repair:** Upgrade to nuxt >= 4.7.0. Until then, add a /** rule with the same value beside each exact page rule so the payload URL is covered, and keep auth in server middleware or the handler.

**Scope and limits:** The pattern matches a routeRules object in nuxt.config that has '/**' with swr, isr, or cache (not false) and another path that does not end in /** and sets redirect, proxy, headers, cors, or ssr, isr, cache, or swr to false. It stays quiet when nuxt or, if nuxt is absent, @nuxt/nitro-server is entirely >= 4.7.0, and when that pin cannot be read. A covering sibling such as '/admin/**' next to '/admin' is not proof the payload is covered, so the exact key still warns. A key other than the literal '/**', a rule built from a spread, and route rules outside nuxt.config are not matched. Route rules are not an auth boundary.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt advisory GHSA-jxc9-w3j6-pwp2 (route rules skipped on _payload.json)",
  "locator": "https://github.com/nuxt/nuxt/security/advisories/GHSA-jxc9-w3j6-pwp2",
  "paraphrase": "A catch-all isr, swr, or cache rule plus a page rule for an exact path, a dynamic path, or a single-segment wildcard lets that page's payload render and be cached. The fix is nuxt 4.7.0. Nuxt 3 has no patched line."
}
```

### nuxt/NUXT-BUILDER-001

Check: [`nuxt/security/no-rspack-builder@1.0.0`](checks/security/no-rspack-builder/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.security.rspack-builder`. Minimum severity: `none`.

Nuxt 4.7.0 deprecates builder: 'rspack'. New builder work belongs on builder: 'rsbuild'.

Default parameters: `{}`.

**Repair:** Set builder to 'rsbuild' and depend on @nuxt/rsbuild-builder.

**Scope and limits:** The warning is a builder property whose value is the string rspack, including a const assertion, in nuxt.config, and only when nuxt is known to be >= 4.7.0. builder: 'vite', builder: 'rsbuild', and the same rspack string on an older nuxt stay quiet. A builder value held in a variable is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt v4.7.0 release notes (Rsbuild builder)",
  "locator": "https://github.com/nuxt/nuxt/releases/tag/v4.7.0",
  "paraphrase": "@nuxt/rsbuild-builder (builder: 'rsbuild') replaces @nuxt/rspack-builder, which is deprecated in 4.7.0."
}
```

## nuxt/server

Manifest version: `1.2.0`. Status: **complete**.

### nuxt/NUXT-SERVER-001

Check: [`nuxt/server/no-server-import-in-app@1.0.0`](checks/server/no-server-import-in-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.no-server-import-in-app`. Minimum severity: `none`.

Importing server modules into app code bundles server-only dependencies into the client and leaks secrets and database handles.

Default parameters: `{}`.

**Repair:** Expose the server logic through a server route or move the shared piece to a framework-agnostic util both sides may import.

**Scope and limits:** Lazy import() does not fix the boundary. A dynamic import of a server module still ships it to the client.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt directory structure and auto-imports",
  "locator": "server directory conventions",
  "paraphrase": "The server directory runs only on the server. App code reaches it through routes, never through imports."
}
```

### nuxt/NUXT-VALID-001

Check: [`nuxt/server/no-unvalidated-body@1.0.0`](checks/server/no-unvalidated-body/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.no-unvalidated-body`. Minimum severity: `none`.

An unshaped payload flows into database writes and business logic, so one malformed request corrupts state instead of failing at the boundary.

Default parameters: `{}`.

**Repair:** Call readValidatedBody with a schema parse function and handle the validation error it throws.

**Scope and limits:** A size limit is not validation. maxBodySize caps bytes but proves nothing about the payload shape.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "h3 request utilities",
  "locator": "readBody versus readValidatedBody",
  "paraphrase": "readBody returns the raw payload. readValidatedBody parses it against a schema and rejects what does not fit."
}
```

### nuxt/NUXT-URL-001

Check: [`nuxt/server/no-absolute-url-in-app-fetch@1.0.0`](checks/server/no-absolute-url-in-app-fetch/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.no-absolute-url-in-app-fetch`. Minimum severity: `none`.

An absolute URL pins an origin that differs between SSR, preview, and production, and it bypasses the Nitro proxy and its headers.

Default parameters: `{}`.

**Repair:** Replace the origin with a relative path such as /api/orders and let Nitro route it.

**Scope and limits:** Loopback is still an absolute origin. http://localhost works on one machine and breaks everywhere else.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt data fetching and Nitro proxy",
  "locator": "relative API paths in app code",
  "paraphrase": "App code calls same-origin APIs with relative paths. The Nitro server proxies them, so client and SSR agree on the origin."
}
```

### nuxt/NUXT-CTX-001

Check: [`nuxt/server/no-event-context-export@1.0.0`](checks/server/no-event-context-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.no-event-context-export`. Minimum severity: `none`.

A shared event binding leaks headers, sessions, and locals across requests, so one user sees another user's scope.

Default parameters: `{}`.

**Repair:** Keep the event inside the handler closure and pass only plain values to helpers.

**Scope and limits:** Renaming the binding to context does not change its scope. An exported alias leaks the same request.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "h3 event lifecycle",
  "locator": "per-request event scope",
  "paraphrase": "The event object lives for one request. Exporting it lets later requests observe or mutate earlier request state."
}
```

### nuxt/NUXT-ERR-001

Check: [`nuxt/server/no-return-create-error@1.0.0`](checks/server/no-return-create-error/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nuxt.return-create-error`. Minimum severity: `none`.

Returning createError() from a Nitro handler serializes the error object as a normal response instead of halting middleware execution and sending the HTTP error status.

Default parameters: `{}`.

**Repair:** Replace return createError(...) with throw createError(...).

**Scope and limits:** Only return statements in server/** or src/server/** whose returned expression is a direct createError(...) call are flagged. Throwing createError(...) or passing it to a helper is allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Nuxt documentation, createError utility and server error handling (https://nuxt.com/docs/api/utils/create-error)",
  "locator": "Server API error handling",
  "paraphrase": "In server routes and middleware, throw createError({ statusCode, statusMessage }) to trigger H3 error handling; returning the error object does not reject the request."
}
```
