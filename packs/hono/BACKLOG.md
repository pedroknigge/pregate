# hono backlog

Hono practices from the best-practices guide that are not a one-file syntax invariant. Each row names why the tree cannot decide it.

- **Mounting a sub-app with `app.use` (route-composition candidate).** The guide says to compose larger apps with `app.route('/authors', authors)`. `app.use('/api', api)` where `api` is another Hono instance has the same call shape as `app.use('/api', authMiddleware)`. A rule that flags the identifier flags middleware. HONO-CTRL-001's repair is `app.route()` or `factory.createHandlers()`.
- **Route registration order.** Mounting `two` with `app.route` before `two.route` is registered returns 404. That is an ordering judgment across statements, not one call shape.
- **Cross-file controllers.** `app.get('/books', (c) => books.list(c))` is an inline handler. The class may live in another file. HONO-CTRL-001 sees a class named `*Controller` only in the file that declares it, and only when a parameter is typed `Context`.
- **Receivers that are not textually Hono.** `const app = buildApp()` is not treated as Hono. The check looks for `new Hono` or `createApp` in the initializer, or a call whose receiver is itself `new Hono` / `createApp`.
- **Pathless chained verbs.** `.get('/books', (c) => ...).post(createBook)` puts the named handler on a call whose receiver is the previous call, not the Hono binding.
- **Template-literal and computed paths.** `` app.get(`/books/${id}`, booksList) `` and `app['get']('/books', booksList)` are not the literal member call the check reads.
- **Middleware whose first parameter is not `c` or `_`.** `(ctx, next)` and `(context, next)` are not flagged. A second parameter named `next` on an unrelated helper, such as `(items, next)`, is not middleware.
- **`return next()` and optional calls.** `return next()` is reported because it is not `await next()`. `next?.()` is a different call shape and is not reported.
- **Env generics duplicated between `new Hono<Env>()` and `createMiddleware<Env>()`.** Both are typed. The guide's `createFactory<Env>()` is the way to declare `Env` once. The check cannot see that two generic arguments are the same type, and `createMiddleware` is the documented shortcut, so it is allowed.
