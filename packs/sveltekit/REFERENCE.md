# sveltekit pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## sveltekit/data

Manifest version: `1.0.1`. Status: **preview**.

### sveltekit/SK-ENV-001

Check: [`sveltekit/data/no-private-env-in-load@1.0.0`](checks/data/no-private-env-in-load/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.private-env-in-load`. Minimum severity: `none`.

Universal load code ships to the browser, and its imports ship with it, so a private-env import publishes the secret it was meant to protect.

Default parameters: `{}`.

**Repair:** Read private env in +page.server.ts or +layout.server.ts and return only the derived public data.

**Scope and limits:** A lazy import() of the private module still bundles it. Reading through $env/dynamic/private instead of static is the same leak.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation",
  "locator": "$env modules",
  "paraphrase": "The $env/static/private and $env/dynamic/private modules are server-only. A universal load file that imports them leaks secrets into the client bundle."
}
```

### sveltekit/SK-FETCH-001

Check: [`sveltekit/data/no-load-fetch-absolute@1.0.0`](checks/data/no-load-fetch-absolute/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.load-fetch-absolute`. Minimum severity: `none`.

A hardcoded origin breaks previews, branches and region failover: the deployment serving the page is not the origin in the string.

Default parameters: `{}`.

**Repair:** Fetch a relative path such as /api/orders so the request stays on the serving origin.

**Scope and limits:** Building the absolute URL in a template string still hardcodes the origin. Interpolating params into the path does not fix the host.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation",
  "locator": "Load fetch",
  "paraphrase": "Load receives a fetch that talks to the app itself. An absolute http(s) URL pins one origin, so same-app data uses a relative path."
}
```

### sveltekit/SK-SECRET-001

Check: [`sveltekit/security/no-secret-in-load-return@1.0.0`](checks/security/no-secret-in-load-return/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.secret-in-load-return`. Minimum severity: `none`.

Load data crosses the server-client boundary by design, so a secret-shaped field in the return value is published to every visitor.

Default parameters: `{}`.

**Repair:** Use the secret server-side (sessions, API calls) and return only the derived public result such as the user profile.

**Scope and limits:** Nesting the token one level down still serializes it. Renaming the field hides the leak from review, not from the client.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation",
  "locator": "Load data serialization",
  "paraphrase": "Whatever a load function returns is serialized and sent to the client. Tokens and secrets must stay server-side and never appear in the returned object."
}
```

### sveltekit/SK-ERROR-001

Check: [`sveltekit/security/no-error-message-leak@1.0.0`](checks/security/no-error-message-leak/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.error-message-leak`. Minimum severity: `none`.

Raw error messages carry paths, query fragments and driver detail that help an attacker map the backend.

Default parameters: `{}`.

**Repair:** Log the original error server-side and throw error(500, ...) with a static message the user can act on.

**Scope and limits:** Concatenating err.message onto a static prefix still sends it. Interpolating it into a template still sends it.

**Interactions when active together:**

- Contradicts `typescript/TS-THROW-001` (compiles only once the preset records it in `settled`): SK-ERROR-001 tells load functions to throw error(500, ...) with a static message, and TS-THROW-001 denies that throw inside the exported load. Settle: On SvelteKit 2 call error(...) without the throw keyword: it throws itself and no throw statement remains. On SvelteKit 1, exclude the **/+page.server.ts, **/+layout.server.ts and **/+server.ts route files from TS-THROW-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation",
  "locator": "Errors: expected vs unexpected",
  "paraphrase": "error() renders its message to the client. Passing err.message forwards internal detail, so unexpected failures get a static message while the original is logged."
}
```

## sveltekit/routing

Manifest version: `1.2.0`. Status: **preview**.

### sveltekit/SK-PAGE-001

Check: [`sveltekit/routing/no-page-server-import-in-client@1.0.0`](checks/routing/no-page-server-import-in-client/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.page-server-import`. Minimum severity: `none`.

A .server import in a universal load drags server-only code into the client bundle, or fails the build once the boundary is enforced.

Default parameters: `{}`.

**Repair:** Move the server-only read into +page.server.ts and return public data for the universal load to consume.

**Scope and limits:** A lazy import() of the .server module is still a .server import. A re-export through an index file is still the same module.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation",
  "locator": "Universal vs server load functions",
  "paraphrase": "Universal load files run on the server and the client, so they must never import a .server module. Server-only reads stay in +page.server.ts; the universal load receives public data."
}
```

### sveltekit/SK-API-001

Check: [`sveltekit/routing/no-api-route-without-json@1.0.0`](checks/routing/no-api-route-without-json/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.api-redirect-status`. Minimum severity: `none`.

A redirect with a non-3xx status lies about the outcome: clients and caches treat the response as the status says, not as the location says.

Default parameters: `{}`.

**Repair:** Use a 3xx status (303 after a mutation, 307 to preserve the method) in redirect(). Use error(404, ...) or error(500, ...) for failure paths.

**Scope and limits:** A 404 that should show a page still needs error(), not redirect(). A 500 that should land somewhere still needs error() plus logging.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation",
  "locator": "redirect and error helpers",
  "paraphrase": "redirect() takes a 3xx status and a location. A 200, 404 or 500 status is not a redirect, so failure paths throw error() with the real status instead."
}
```

### sveltekit/SK-FORM-001

Check: [`sveltekit/routing/no-form-action-without-fail@1.0.0`](checks/routing/no-form-action-without-fail/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.form-throw-literal`. Minimum severity: `none`.

A thrown object bypasses both the use:enhance failure path and the error boundary, so the form never renders the validation message.

Default parameters: `{}`.

**Repair:** Return fail(status, data) for expected validation failures. Throw error(status, message) for unexpected failures.

**Scope and limits:** An object shaped like fail() output is still wrong when thrown. A thrown status field does not set the response status.

**Interactions when active together:**

- Contradicts `typescript/TS-THROW-001` (compiles only once the preset records it in `settled`): SK-FORM-001 tells form actions to throw error() for unexpected failures, and TS-THROW-001 denies that throw inside the exported actions object. Settle: On SvelteKit 2 call error(...) without the throw keyword: it throws itself and no throw statement remains. On SvelteKit 1, exclude **/+page.server.ts and **/+server.ts from TS-THROW-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation",
  "locator": "Form actions: fail and error",
  "paraphrase": "Actions signal expected form failures by returning fail() and unexpected failures by throwing error(). A thrown plain object reaches neither channel."
}
```

### sveltekit/SK-CONFIG-001

Check: [`sveltekit/routing/no-prerender-typo@1.0.0`](checks/routing/no-prerender-typo/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.prerender-typo`. Minimum severity: `none`.

A mis-cased option compiles and deploys, but the route is never prerendered, so the launch checklist passes while the behavior is missing.

Default parameters: `{}`.

**Repair:** Spell the option exactly `prerender` in lowercase, with a boolean or 'auto' value.

**Scope and limits:** preRender, PreRender and PRERENDER are all dead exports. Assigning 'auto' to a mis-cased name does not fix the casing.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation",
  "locator": "Page options: prerender",
  "paraphrase": "Page options are exact lowercase exports such as prerender. A differently cased export is an unused variable the router silently ignores."
}
```

### sveltekit/SK-LIBSERVER-001

Check: [`sveltekit/routing/no-server-dir-import-in-universal@1.0.0`](checks/routing/no-server-dir-import-in-universal/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.server-dir-import`. Minimum severity: `none`.

Universal loads and client hooks ship to the browser, so a $lib/server import either fails the build or drags database clients and secrets into the client bundle.

Default parameters: `{}`.

**Repair:** Do the server-only read in +page.server.ts or +layout.server.ts and return public data; the universal load receives it as data.

**Scope and limits:** A relative ../lib/server path or a lazy import() is the same module. Type-only imports are erased and are not matched; .server file names are covered by SK-PAGE-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation, server-only modules (https://svelte.dev/docs/kit/server-only-modules)",
  "locator": "Your modules",
  "paraphrase": "Modules placed in a server directory such as $lib/server are server-only. SvelteKit refuses to import them into code that runs in the browser."
}
```

### sveltekit/SK-TRY-001

Check: [`sveltekit/routing/no-redirect-in-try@1.0.0`](checks/routing/no-redirect-in-try/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.redirect-in-try`. Minimum severity: `none`.

redirect() works by throwing, so a surrounding catch turns the redirect into a failure response or an error page and the user never moves.

Default parameters: `{}`.

**Repair:** Keep only the fallible work inside try, store its result, and call redirect() after the try/catch block.

**Scope and limits:** A catch that throws a new error still swallows the redirect. Redirects inside catch or finally-only blocks, and catch blocks that rethrow the caught value, are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation, loading data (https://svelte.dev/docs/kit/load#Redirects)",
  "locator": "Redirects",
  "paraphrase": "Don't use redirect() inside a try block, as the redirect will immediately trigger the catch statement."
}
```

### sveltekit/SK-METHOD-001

Check: [`sveltekit/routing/no-lowercase-endpoint-export@1.0.0`](checks/routing/no-lowercase-endpoint-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.lowercase-endpoint-export`. Minimum severity: `none`.

The pre-1.0 lowercase names (get, post, del) are invalid exports, so the endpoint fails with Invalid export instead of answering the request.

Default parameters: `{}`.

**Repair:** Rename the handler to the uppercase verb (get to GET, del to DELETE) and type it with RequestHandler.

**Scope and limits:** A RequestHandler annotation or a named export list does not change the exported name. Local helpers named get, _-prefixed exports and page options are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation, routing (https://svelte.dev/docs/kit/routing#server)",
  "locator": "+server",
  "paraphrase": "+server files export functions named after HTTP verbs: GET, POST, PATCH, PUT, DELETE, OPTIONS and HEAD. SvelteKit throws on any other export without a _ prefix."
}
```

### sveltekit/SK-COOKIE-001

Check: [`sveltekit/routing/no-cookies-set-in-shared-load@1.0.0`](checks/routing/no-cookies-set-in-shared-load/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `sveltekit.cookies-shared-load`. Minimum severity: `none`.

Calling cookies.set or cookies.delete in a universal load file (+page.ts or +layout.ts) fails at runtime because universal loads do not receive the server cookies API.

Default parameters: `{}`.

**Repair:** Rename the load file to +page.server.ts or +layout.server.ts, or move the cookie write into a form action or +server.ts endpoint.

**Scope and limits:** Matches cookies.set and cookies.delete inside +page.ts, +layout.ts, +page.js, and +layout.js. Server load files (+page.server.ts) and differently named client cookie helpers pass.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "SvelteKit documentation, Loading data — Cookies (https://svelte.dev/docs/kit/load#Cookies)",
  "locator": "Server vs universal load functions",
  "paraphrase": "The cookies helper is only provided to server load functions (+page.server.ts and +layout.server.ts). Universal load functions (+page.ts and +layout.ts) run in the browser as well and cannot read or set server cookies."
}
```
