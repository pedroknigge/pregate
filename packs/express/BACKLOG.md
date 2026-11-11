# express backlog

Express practices that are not a one-file syntax invariant. Each row names why the tree cannot decide it.

- **Middleware order (EX-ORDER-001 candidate).** Error middleware must be registered after the routes, and body parsers before them. Order is a cross-file sequence judgment: the check would need the whole `app.use` chain in registration order, including routers mounted from other modules.
- **Helmet presence.** A missing `helmet()` call is absence-detection: no single node proves the header policy was never set, and the policy may live in a reverse proxy outside the grammar.
- **Rate-limit configuration.** A limiter on one route and not another is a coverage judgment. The window, max, and key generator are numbers whose safety depends on the traffic the route takes.
- **Trust proxy behind a proxy.** `app.set("trust proxy", ...)` is correct only when the deployment actually terminates TLS at a proxy. The tree sees the flag, not the infrastructure.
- **Per-route body size.** EX-LIMIT-001 is off: Express already caps bodies at 100kb by default. Whether a route should change that cap is a product decision the matcher cannot infer.
- **v4-vs-v5 async error semantics.** Express 4 drops async handler rejections unless forwarded to `next`; Express 5 forwards them natively. A rule that forbids `asyncHandler` wrappers or demands them is version-dependent, and the installed version is package metadata, not syntax. APIs deprecated in Express 4 and removed in Express 5 are wrong on both versions, so EX-V5-001 reports them.
- **Session and cookie flags (`secure`, `httpOnly`, `sameSite`).** The right flags depend on whether the client is same-site and whether TLS terminates at the app. A keyword cannot tell a local demo from production.
- **Authentication and authorization on routes.** Which routes need a guard is a product invariant. The absence of an `auth` middleware in one handler is not proof without the route's threat model.
- **Request id propagation and structured error responses.** Conventions across handlers, not one call shape.
- **Graceful shutdown (`server.close` on SIGTERM).** Lifecycle wiring outside the request path; the signal handler and the listen call rarely share a file.
- **Cookie options via variables (`EX-COOKIE-001` limit).** `EX-COOKIE-001` denies inline `httpOnly: false` and `secure: false` object literals in `res.cookie`. Cookie options assembled in an external config object or omitted entirely depend on environment and deployment topology.
- **Indirect synchronous I/O in helpers (`EX-SYNC-001` limit).** `EX-SYNC-001` denies direct `fs.*Sync` calls inside `app.*` and `router.*` callbacks. A route handler calling an imported helper that runs `fs.readFileSync` requires interprocedural call-graph analysis.
- **Callee name (`EX-NEXT-001` limit).** Before pack 1.2.1 the rule tested the text of a whole call, so every call that contained `next('route')`, such as an enclosing `it(...)` or `app.param(...)`, was reported on its own line. That was the rule's pattern, not the engine's line reporting. The rule now tests the callee and the first argument of the call itself, and the callee must be named `next`. A handler that names its third parameter `done` or `cb` is not matched.
