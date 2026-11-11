# trpc pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## trpc/client

Manifest version: `1.1.1`. Status: **complete**.

### trpc/TRPC-BATCH-001

Check: [`trpc/router/no-http-batch-abuse@1.0.0`](checks/router/no-http-batch-abuse/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.batch-max-url-length`. Minimum severity: `none`.

Whether a batch can exceed the deployed server's URL limits depends on its inputs and transport configuration.

Default parameters: `{}`.

**Repair:** Pass maxURLLength (for example 2083) to httpBatchLink so oversized batches split before they hit the URL limit.

**Scope and limits:** A transformer or custom headers do not bound URL length. The non-batched httpLink is out of scope for this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, httpBatchLink",
  "locator": "batch link URL length",
  "paraphrase": "maxURLLength is a configurable safeguard for URL limits, not a required option on every httpBatchLink."
}
```

### trpc/TRPC-ERR-001

Check: [`trpc/server/no-throw-in-procedure@1.0.1`](checks/server/no-throw-in-procedure/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.procedure-error`. Minimum severity: `none`.

A plain Error crosses the boundary as an untyped internal failure. The client cannot tell NOT_FOUND from a bug.

Default parameters: `{}`.

**Repair:** Throw new TRPCError({ code: 'NOT_FOUND' }) (or the code the caller should handle) instead of new Error.

**Scope and limits:** This rule sees a throw only in a tRPC context: the file imports a module whose specifier contains trpc, or the throw is inside a query, mutation or subscription call on a receiver whose text contains procedure. A throw in an Express handler or a test with neither is not matched. AggregateError and other built-ins are still untyped throws.

**Interactions when active together:**

- Contradicts `typescript/TS-THROW-001` (compiles only once the preset records it in `settled`): TRPC-ERR-001 tells procedures to throw a TRPCError, and TS-THROW-001 denies every throw inside an exported function; routers are exported, so following one fix violates the other. Settle: Exclude router files from TS-THROW-001 (for example **/routers/** or **/server/api/**): tRPC turns a thrown TRPCError into the typed failure the client branches on.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, error handling with TRPCError",
  "locator": "throwing typed errors",
  "paraphrase": "Procedures throw TRPCError with a code, never a plain Error, so the client receives a typed failure it can match on."
}
```

### trpc/TRPC-CTX-001

Check: [`trpc/middleware/no-next-without-ctx@1.0.0`](checks/middleware/no-next-without-ctx/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.middleware-context`. Minimum severity: `none`.

A bare next() is correct for middleware that only observes or authorizes against the existing context.

Default parameters: `{}`.

**Repair:** Return next({ ctx: { ...ctx, user: ctx.user } }) so the narrowed context reaches the procedure.

**Scope and limits:** The rule matches a .use chain whose middleware calls bare next(). Middleware that only observes and changes nothing still needs to forward ctx explicitly.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, middleware and context",
  "locator": "calling next with narrowed context",
  "paraphrase": "Middleware may call next() to forward the existing context, or next({ ctx }) to extend or narrow it."
}
```

### trpc/TRPC-CALLER-001

Check: [`trpc/router/no-unvalidated-subscription@1.0.0`](checks/router/no-unvalidated-subscription/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.subscription-shape`. Minimum severity: `none`.

A subscription returning a static value or a bare emitter gives the caller no stream contract: no iteration, no cleanup, no backpressure.

Default parameters: `{}`.

**Repair:** Wrap the event source in observable() from @trpc/server/observable, or make the resolver an async generator that yields values.

**Scope and limits:** Returning emitter.on(...) directly still fails: the caller needs the observable wrapper. Queries and mutations are out of scope for this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, subscriptions",
  "locator": "subscription return contract",
  "paraphrase": "A subscription resolves to an observable or an async generator, so the subscribing caller gets a stream it can iterate and unsubscribe from."
}
```

### trpc/TRPC-DEV-001

Check: [`trpc/server/no-forced-dev-mode@1.0.0`](checks/server/no-forced-dev-mode/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.forced-dev-mode`. Minimum severity: `none`.

isDev: true sends server stack traces to every client in production too, exposing file paths and internals.

Default parameters: `{}`.

**Repair:** Remove isDev so tRPC uses the NODE_ENV default, or derive it from an environment check.

**Scope and limits:** A quoted key, a context or meta chain before .create, and other options next to it do not change the setting. Test files are not checked. A value read from a variable is not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, routers, runtime configuration",
  "locator": "https://trpc.io/docs/server/routers#runtime-configuration",
  "paraphrase": "isDev decides whether the API returns stack traces; it defaults to process.env.NODE_ENV !== 'production'."
}
```

## trpc/router

Manifest version: `1.2.0`. Status: **complete**.

### trpc/TRPC-PROC-001

Check: [`trpc/router/no-unprotected-procedure@1.0.0`](checks/router/no-unprotected-procedure/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.protected-procedure`. Minimum severity: `none`.

Sign-up, contact, and other intentionally public writes exist. The builder name alone cannot establish an authorization defect.

Default parameters: `{}`.

**Repair:** Build the mutation on protectedProcedure (or your authed procedure) so the caller is authenticated before the write runs.

**Scope and limits:** This rule sees the builder chain only: publicProcedure followed by .mutation in one chain. It does not read the auth model, so a protectedProcedure that checks nothing is outside what the tree can see. Keep one procedure per chain statement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, authorization and public procedures",
  "locator": "publicProcedure versus middleware-guarded procedures",
  "paraphrase": "Public mutations are supported; publicProcedure.mutation is used in the official procedures guide. Authorization depends on the product."
}
```

### trpc/TRPC-INPUT-001

Check: [`trpc/router/no-missing-input-validator@1.0.0`](checks/router/no-missing-input-validator/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.input-validator`. Minimum severity: `none`.

A procedure that accepts no input does not need an input validator, so missing .input alone is not a violation.

Default parameters: `{}`.

**Repair:** Add .input(z.object({ ... })) before .query or .mutation describing exactly the fields the resolver reads.

**Scope and limits:** The rule matches each builder chain on its own: a validated chain elsewhere in the file does not cover this one. .use(middleware) is not input validation. Keep one procedure per chain statement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, input validation with zod",
  "locator": "procedure input validators",
  "paraphrase": "Input validators are needed when a procedure accepts input; no-input procedures are valid."
}
```

### trpc/TRPC-OUTPUT-001

Check: [`trpc/router/no-missing-output-validator@1.0.0`](checks/router/no-missing-output-validator/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.output-validator`. Minimum severity: `none`.

Requiring .output on every mutation is a policy choice, not a framework invariant.

Default parameters: `{}`.

**Repair:** Add .output(schema) between .input and .mutation describing the value the mutation returns.

**Scope and limits:** The validator must come before .mutation; .output placed after the mutation does not declare the contract. Queries are out of scope for this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, output validation",
  "locator": "procedure output validators",
  "paraphrase": "Output validation is optional; tRPC infers a mutation's result type from its resolver."
}
```

### trpc/TRPC-MUT-001

Check: [`trpc/router/no-query-mutation-side-effect@1.0.0`](checks/router/no-query-mutation-side-effect/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.query-side-effect`. Minimum severity: `none`.

Clients cache and refetch queries freely. A write hidden in a query runs again on every refetch and corrupts state.

Default parameters: `{}`.

**Repair:** Move the write into a .mutation procedure and leave the .query to read the data the mutation changed.

**Scope and limits:** The rule matches write method names (create, update, delete, insert, upsert, save) inside a .query chain kept on one line. A read helper with one of these names is a false positive; rename it.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, queries versus mutations",
  "locator": "query handlers must be read-only",
  "paraphrase": "Query resolvers only read. Any create, update, delete, insert, upsert, or save belongs in a mutation, which the client caches differently."
}
```

### trpc/TRPC-SELFCALL-001

Check: [`trpc/router/no-caller-in-procedure@1.0.0`](checks/router/no-caller-in-procedure/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.caller-in-procedure`. Minimum severity: `none`.

A caller built inside a resolver creates context again and reruns every middleware and validator for work the outer procedure already authorized.

Default parameters: `{}`.

**Repair:** Move the shared logic into a plain function that takes ctx (or ctx.db) and call it from both procedures.

**Scope and limits:** router.createCaller(ctx), createCaller(ctx) from createCallerFactory, and createCallerFactory(router)(ctx) are the same call. Callers built outside a .query, .mutation or .subscription resolver, such as server components or scripts, are allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, server side calls",
  "locator": "https://trpc.io/docs/server/server-side-calls",
  "paraphrase": "createCaller should not be used to call procedures from within other procedures; extract the shared logic into a function and call it from each procedure."
}
```

### trpc/TRPC-CODE-001

Check: [`trpc/server/no-invalid-trpc-error-code@1.0.0`](checks/server/no-invalid-trpc-error-code/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.error-code`. Minimum severity: `none`.

Passing a numeric HTTP status (404) or an invented string ('UNAUTHENTICATED') falls back to INTERNAL_SERVER_ERROR (500) and breaks client error handling.

Default parameters: `{}`.

**Repair:** Replace the code with the matching official tRPC error code string (such as 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', or 'BAD_REQUEST').

**Scope and limits:** Only literal string, template, or numeric values on the code property of new TRPCError({...}) are checked. Imported constants or variables are not resolved.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, Error Handling (trpc.io)",
  "locator": "https://trpc.io/docs/server/error-handling#error-codes",
  "paraphrase": "TRPCError requires a predefined TRPC_ERROR_CODE_KEY string such as BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, or NOT_FOUND rather than numeric HTTP statuses or custom strings."
}
```

### trpc/TRPC-RET-NEXT-001

Check: [`trpc/middleware/no-unreturned-next@1.0.0`](checks/middleware/no-unreturned-next/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `trpc.unreturned-next`. Minimum severity: `none`.

Calling next() as a bare statement discards the procedure's resolved output and returns undefined to the tRPC runtime.

Default parameters: `{}`.

**Repair:** Return next({ ctx }) directly, or assign const result = await next({ ctx }) and return result afterwards.

**Scope and limits:** Express middleware (which takes (req, res, next) and calls bare next()) should not be registered via t.middleware.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "tRPC documentation, Middlewares (trpc.io)",
  "locator": "https://trpc.io/docs/server/middlewares",
  "paraphrase": "A tRPC middleware must return the result of calling next() (or await next(), inspect the result, and return it) so the procedure response and context reach the caller."
}
```
