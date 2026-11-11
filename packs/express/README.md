# express

Data-only Express v5 checks the syntax tree can decide: broken error-middleware arity, whole-body spreads and assigns, redirects built from query or params, statuses that never send, manual wildcard CORS headers, optional explicit parser limits (off by default), string-skipping next calls, and unbounded multer uploads. Complements `vibe-proof` (VP-MASS-001 covers direct `create(req.body)` writes; this pack covers the spread into a DTO. VP-CORS-001 covers `cors({origin:"*"})` with credentials; this pack covers the manual header). Everything that needs runtime state or a human is in the backlog.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `express/EX-ERR-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `EX-ERR-001` | An `app.use` error callback with three parameters (`err, req, res`) instead of four. | Express selects error middleware by arity, so the three-arg handler never receives the error. | deny |
| `EX-LIMIT-001` | `express.json()` or `express.urlencoded()` whose call does not mention `limit`. | Express already enforces a default 100kb limit; an explicit limit is a project choice. | off |
| `EX-FILE-001` | A `multer(...)` call that mentions neither `limits` nor `fileFilter`. | Unbounded uploads fill the disk with files of any size and type. | deny |
| `EX-BODY-001` | Spreading `req.body` into an object literal, or `Object.assign`ing it. | The body can carry role, price, or owner. Copying it whole persists fields the caller was never offered. | deny |
| `EX-QUERY-001` | A `redirect(...)` whose arguments mention `req.query` or `req.params`. | The destination is caller-controlled, which turns the app's domain into a phishing launchpad. | deny |
| `EX-STATUS-001` | A `res.status(...)` statement with no chained sender, or a `res.statusCode =` assignment. | The request stays open until something sends, so the client hangs. | deny |
| `EX-NEXT-001` | `next("route")` or `next("router")`. | String-skipping hides control flow in a magic value a typo can silently change. | deny |
| `EX-CORS-001` | A `res.set`/`res.header` of `Access-Control-Allow-Origin` to `*`, any letter case. | Every site can then read the response, including one holding the user's credentials. | deny |
| `EX-PATH-001` | `res.sendFile`/`res.download` whose path mentions `req.params`, `req.query` or `req.body` with no `root` option, unless the path goes through `basename`. | Decoded `../` segments walk out of the folder and serve any readable file. | deny |
| `EX-V5-001` | Express 4 APIs removed in Express 5: `app.del`, `req.param()`, `res.sendfile`, `res.send(404)`, `res.json(body, 200)`, `res.redirect(url, 301)`, `res.redirect("back")`, singular `req.accepts*`. | Express 5 throws, sends the number as the body, or redirects to `/back`. | deny |
| `EX-COOKIE-001` | `res.cookie` or `response.cookie` options explicitly setting `httpOnly: false` or `secure: false`. | `httpOnly: false` exposes cookies to `document.cookie` during XSS; `secure: false` sends them over plaintext HTTP. | deny |
| `EX-SYNC-001` | Synchronous `fs.*Sync` calls (`readFileSync`, `writeFileSync`, etc.) inside `app.*` or `router.*` handlers. | Synchronous disk I/O blocks the single-threaded event loop for every concurrent request. | deny |

## Methodologies

- `express/middleware` — EX-ERR-001, EX-LIMIT-001, EX-FILE-001
- `express/requests` — EX-BODY-001, EX-QUERY-001, EX-STATUS-001, EX-NEXT-001, EX-CORS-001, EX-PATH-001, EX-V5-001, EX-COOKIE-001, EX-SYNC-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.1`. 12 distinct check IDs.

Methodologies: `express/middleware` (complete), `express/requests` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
