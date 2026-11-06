# hono pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## hono/middleware

Manifest version: `1.0.0`. Status: **complete**.

### hono/HONO-NEXT-001

Check: [`hono/middleware/no-unawaited-next@1.0.0`](checks/middleware/no-unawaited-next/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `hono.middleware-await`. Minimum severity: `none`.

A bare next() lets the code after it run before the handler finishes, so response changes and logs land on the wrong side of the request.

Default parameters: `{}`.

**Repair:** Make the middleware async and write await next(). return await next() is allowed. Returning a Response without calling next ends the chain.

**Scope and limits:** return next() is still not awaited. A function whose first parameter is not c or _ is not read as Hono middleware, so (items, next) and Express (req, res, next) stay quiet. next?.() is a different call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Hono documentation, Middleware",
  "locator": "https://hono.dev/docs/guides/middleware",
  "paraphrase": "Middleware continues the chain with await next() and then returns nothing, or it returns a Response and does not call next. The call is not thrown; do not wrap it in try/catch."
}
```

### hono/HONO-MW-001

Check: [`hono/middleware/no-untyped-middleware@1.0.0`](checks/middleware/no-untyped-middleware/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `hono.shared-middleware`. Minimum severity: `none`.

A bare (c, next) function used from several routes drops the Env type, so c.var and c.env are untyped at the boundary the handler trusts.

Default parameters: `{}`.

**Repair:** Wrap the function in createMiddleware or factory.createMiddleware. To share one Env, create the app with factory.createApp() and the middleware with factory.createMiddleware. Inline app.use(async (c, next) => ...) needs no wrapper.

**Scope and limits:** createMiddleware is the documented shortcut and is enough; a separate createFactory is not required when the middleware is already wrapped. A callback passed straight to app.use, a route verb, or createHandlers is inline. A first parameter other than c or _ is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Hono documentation, Middleware and Factory Helper",
  "locator": "https://hono.dev/docs/helpers/factory",
  "paraphrase": "Inline middleware on app.use keeps its types. Middleware declared for reuse should be created with createMiddleware or factory.createMiddleware so Context and the variables set on it stay typed. createFactory<Env>() is how one Env type is shared with createApp()."
}
```

## hono/routing

Manifest version: `1.0.0`. Status: **complete**.

### hono/HONO-CTRL-001

Check: [`hono/routing/no-detached-handler@1.0.0`](checks/routing/no-detached-handler/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `hono.detached-handler`. Minimum severity: `none`.

A handler declared away from the route loses the path-parameter type. Reviewers then see a controller that does not know which route called it.

Default parameters: `{}`.

**Repair:** Write the handler inline on app.get or the other verb. When the handlers must live elsewhere, use factory.createHandlers() and app.get('/api', ...handlers). Mount a sub-app with app.route('/books', books).

**Scope and limits:** Spreading createHandlers is the allowed split. app.route takes a Hono app, not a controller method. A class not named Controller, or a Controller method that is not typed Context, is not this rule. A Hono value built by a helper that does not textually contain new Hono or createApp is not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Hono documentation, Best Practices",
  "locator": "https://hono.dev/docs/guides/best-practices",
  "paraphrase": "Do not split a route into a Ruby-on-Rails-style controller. Write the handler on the route so path parameters infer, or build the separated handlers with factory.createHandlers() and spread them. Compose files with app.route()."
}
```

### hono/HONO-HEAD-001

Check: [`hono/routing/no-dedicated-head@1.0.0`](checks/routing/no-dedicated-head/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `hono.dedicated-head`. Minimum severity: `none`.

A dedicated HEAD handler looks registered and never runs, so its headers and status are not the ones the client receives.

Default parameters: `{}`.

**Repair:** Handle the request in app.get. When HEAD needs a different header, await next() in middleware and branch on c.req.method === 'HEAD'.

**Scope and limits:** Quote style does not matter. createApp() is still a Hono app. A string HEAD inside the GET handler is not a HEAD route. A .head call on a value that is not textually Hono is not this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Hono documentation, Best Practices",
  "locator": "https://hono.dev/docs/guides/best-practices",
  "paraphrase": "Hono answers HEAD by running the GET handler and dropping the body, before route matching. app.head and app.on('HEAD') are never called."
}
```
