# astro pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## astro/config

Manifest version: `1.0.0`. Status: **complete**.

### astro/ASTRO-ENV-001

Check: [`astro/config/no-client-secret@1.0.0`](checks/config/no-client-secret/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `astro.client-secret`. Minimum severity: `none`.

A client variable is bundled into the browser. Marking it secret does not keep the value on the server.

Default parameters: `{}`.

**Repair:** Use context: "server" with access: "secret", and read the value from astro:env/server. A public client variable uses context: "client" and access: "public".

**Scope and limits:** A computed context or access is not read. Importing astro:env/server into a module that a client:* island pulls in is a template-graph question and stays out of this check.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Astro documentation, environment variables (https://docs.astro.build/en/guides/environment-variables/)",
  "locator": "Variable types",
  "paraphrase": "Secret client variables are not supported. A schema cannot set both context: \"client\" and access: \"secret\"."
}
```

### astro/ASTRO-ADAPTER-001

Check: [`astro/config/no-server-output-without-adapter@1.0.0`](checks/config/no-server-output-without-adapter/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `astro.server-adapter`. Minimum severity: `none`.

Without an adapter, the server build has no runtime to render those pages.

Default parameters: `{}`.

**Repair:** Import an adapter such as @astrojs/node and set adapter on the same defineConfig object. Leave output at "static" until a page opts out of prerender.

**Scope and limits:** A spread config or a defineConfig argument that is not an object literal is not inspected. output: "static" with prerender = false in a page still needs an adapter, and that export lives in the page.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Astro documentation, on-demand rendering (https://docs.astro.build/en/guides/on-demand-rendering/) and configuration reference (https://docs.astro.build/en/reference/configuration-reference/#output)",
  "locator": "output and adapter",
  "paraphrase": "output: \"server\" renders every page on demand, and on-demand rendering requires an adapter."
}
```

## astro/content

Manifest version: `1.0.0`. Status: **complete**.

### astro/ASTRO-SCHEMA-001

Check: [`astro/content/no-collection-without-schema@1.0.0`](checks/content/no-collection-without-schema/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `astro.collection-schema`. Minimum severity: `none`.

Without a schema, a missing or mistyped frontmatter field shows up later, at the template that reads it.

Default parameters: `{}`.

**Repair:** Add schema: z.object({ ... }) and import z from "astro/zod". A schema may be a function, as in schema: ({ image }) => z.object({ ... }).

**Scope and limits:** A spread object is not inspected, because the schema may arrive through the spread. A schema value that is not Zod is not distinguished from one that is. defineCollection outside src/content.config.* or src/content/config.* is not read.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Astro documentation, content collections (https://docs.astro.build/en/guides/content-collections/)",
  "locator": "Defining the collection schema",
  "paraphrase": "A collection schema is optional and recommended. When present, it is a Zod schema from astro/zod and validates every entry."
}
```

### astro/ASTRO-LOADER-001

Check: [`astro/content/no-collection-without-loader@1.0.0`](checks/content/no-collection-without-loader/check.json). Default severity: **deny**. Version gate: **deny** when the nearest `astro` declaration is entirely `>=5.0.0`; otherwise the rule does not run. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `astro.collection-loader`. Minimum severity: `none`.

Astro cannot load the entries, so the collection is empty or the build fails.

Default parameters: `{}`.

**Repair:** Pass loader: glob({ pattern, base }) or loader: file(...), or a live loader for defineLiveCollection.

**Scope and limits:** A spread object is not inspected. The rule does not run when the nearest astro declaration can still install Astro 4, or when no astro declaration is readable. Astro 4 keeps type and schema in src/content/config.ts.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Astro documentation, content collections (https://docs.astro.build/en/guides/content-collections/)",
  "locator": "Defining collections",
  "paraphrase": "Astro 5 build-time and live collections require a loader. The legacy type: \"content\" config does not supply one."
}
```

## astro/routing

Manifest version: `1.0.0`. Status: **complete**.

### astro/ASTRO-MW-001

Check: [`astro/routing/no-missing-onrequest@1.0.0`](checks/routing/no-missing-onrequest/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `astro.middleware-onrequest`. Minimum severity: `none`.

Astro does not call the file, so locals, auth, and rewrites never run.

Default parameters: `{}`.

**Repair:** Export onRequest as a function, as export const onRequest = defineMiddleware(...), or re-export that name. sequence() is a value you assign to onRequest.

**Scope and limits:** A destructuring export such as export const { onRequest } = handlers is reported. The check reads src/middleware and src/middleware/index only.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Astro documentation, middleware (https://docs.astro.build/en/guides/middleware/)",
  "locator": "Basic usage",
  "paraphrase": "src/middleware.ts, or src/middleware/index.ts, must export a named onRequest function. It must not be a default export."
}
```

### astro/ASTRO-ROUTE-001

Check: [`astro/routing/no-lowercase-endpoint-export@1.0.0`](checks/routing/no-lowercase-endpoint-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `astro.lowercase-endpoint`. Minimum severity: `none`.

A lowercase export is not a handler, so the route responds as if that method were missing.

Default parameters: `{}`.

**Repair:** Rename the export to the uppercase method. A local helper named get can stay unexported.

**Scope and limits:** Files and directories under src/pages whose names start with _ are not routes and are ignored. delete is a reserved word and is not matched as a binding. A non-exported function is not a handler.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Astro documentation, endpoints (https://docs.astro.build/en/guides/endpoints/)",
  "locator": "HTTP methods",
  "paraphrase": "An endpoint exports a function named for the HTTP method. Astro calls GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, and ALL."
}
```

### astro/ASTRO-ACTION-001

Check: [`astro/routing/no-action-without-handler@1.0.0`](checks/routing/no-action-without-handler/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `astro.action-handler`. Minimum severity: `none`.

An action without a handler has no server function to call.

Default parameters: `{}`.

**Repair:** Add handler: async (input) => ... or the method form async handler(input) {}. Export the action from the server object in src/actions/index.ts.

**Scope and limits:** A spread object is not inspected. defineAction outside src/actions/ is not read. Whether the action is also exported from the server object is a cross-file check.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Astro documentation, actions (https://docs.astro.build/en/guides/actions/)",
  "locator": "defineAction handler",
  "paraphrase": "An action's handler is the function Astro runs on the server. input is optional and validates with Zod when you set it."
}
```
