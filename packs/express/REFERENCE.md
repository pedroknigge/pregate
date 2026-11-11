# express pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## express/middleware

Manifest version: `1.0.0`. Status: **complete**.

### express/EX-ERR-001

Check: [`express/middleware/no-missing-error-handler@1.0.0`](checks/middleware/no-missing-error-handler/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.error-handler-arity`. Minimum severity: `none`.

A broken error signature leaves the app with no error middleware: the handler never runs and the failure surfaces as a hang or a default HTML page.

Default parameters: `{}`.

**Repair:** Give the handler four parameters (err, req, res, next) and register it with app.use after the routes.

**Scope and limits:** Renaming err to error, or switching arrow to function, does not add the missing parameter. Arity is what Express reads.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express 5 API reference (expressjs.com)",
  "locator": "Error handling",
  "paraphrase": "An error-handling middleware takes four arguments. Express selects it by arity, so a three-argument function is ordinary middleware and never receives the error."
}
```

### express/EX-LIMIT-001

Check: [`express/middleware/no-json-limit-missing@1.0.0`](checks/middleware/no-json-limit-missing/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.json-limit`. Minimum severity: `none`.

A missing explicit limit does not mean an unbounded parser; the documented default remains active.

Default parameters: `{}`.

**Repair:** Pass a limit option such as express.json({ limit: "100kb" }). Raise it per route only where a large payload is legitimate.

**Scope and limits:** The default 100kb cap is valid. Syntax cannot determine the appropriate per-route limit.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express 5 API reference (expressjs.com)",
  "locator": "express.json",
  "paraphrase": "Express JSON and urlencoded parsers enforce a default 100kb size limit. An explicit limit is an optional project policy."
}
```

### express/EX-FILE-001

Check: [`express/requests/no-req-files-without-filter@1.0.0`](checks/requests/no-req-files-without-filter/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.multer-limits`. Minimum severity: `none`.

Unbounded uploads fill the disk and smuggle executables or archives into a pipeline that expected an avatar.

Default parameters: `{}`.

**Repair:** Configure multer with limits (fileSize, files) and a fileFilter that accepts only the mime types the feature needs.

**Scope and limits:** A dest or storage option only chooses where files land. It does not bound size, count, or type.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Multer documentation (expressjs.com resources)",
  "locator": "Limits and fileFilter",
  "paraphrase": "An upload endpoint without limits or a file filter accepts files of any size and type. The disk and the downstream consumer pay for whatever the caller sends."
}
```

## express/requests

Manifest version: `1.2.1`. Status: **complete**.

### express/EX-BODY-001

Check: [`express/requests/no-req-body-spread@1.0.0`](checks/requests/no-req-body-spread/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.body-spread`. Minimum severity: `none`.

A spread or assign of req.body lets the caller set privileged fields that the form never showed, and the write persists them.

Default parameters: `{}`.

**Repair:** Destructure the named fields the handler needs from req.body, or validate the body against a schema and use the parsed output.

**Scope and limits:** Object.assign without a spread copies the same fields. A default object merged first does not stop the body from overriding it.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "OWASP API Security Top 10",
  "locator": "API8:2023 Unsafe consumption, mass assignment",
  "paraphrase": "The request body is caller-controlled input. Copying it whole into a record or a DTO copies fields the caller was never offered, such as role or owner."
}
```

### express/EX-QUERY-001

Check: [`express/requests/no-req-query-concat@1.0.0`](checks/requests/no-req-query-concat/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.query-redirect`. Minimum severity: `none`.

An open redirect turns the app's domain into a launchpad for phishing: the link looks internal until the browser lands elsewhere.

Default parameters: `{}`.

**Repair:** Redirect to a fixed path, or check the value against an allowlist of destinations before using it.

**Scope and limits:** A template literal around the query value is still the query value. Encoding it does not make it a destination you chose.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "OWASP Top 10",
  "locator": "A01:2021 Broken access control, open redirect",
  "paraphrase": "The query string and route params are caller-controlled. Sending the client to a URL taken from them lets an attacker bounce victims through your domain to a lookalike."
}
```

### express/EX-STATUS-001

Check: [`express/requests/no-status-without-send@1.0.0`](checks/requests/no-status-without-send/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.status-without-send`. Minimum severity: `none`.

A handler that sets a status and never sends holds the connection until the client times out, and the caller cannot tell an error from a slow success.

Default parameters: `{}`.

**Repair:** Chain a sender: res.status(201).json(order), .send, .end, or use res.sendStatus where no body is needed.

**Scope and limits:** Referencing .send without calling it sends nothing. Assigning res.statusCode directly has the same hang without a later send.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express 5 API reference (expressjs.com)",
  "locator": "res.status",
  "paraphrase": "status only sets the code. The request stays open until something sends the body, so a bare status call leaves the client hanging."
}
```

### express/EX-NEXT-001

Check: [`express/requests/no-next-route-string@1.0.1`](checks/requests/no-next-route-string/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.next-route-string`. Minimum severity: `none`.

String-skipping hides control flow in a magic value: readers cannot see which handlers are bypassed, and a misspelling changes routing without an error.

Default parameters: `{}`.

**Repair:** Call next() to continue or next(err) to fail. If a route must be skipped, restructure the middleware order instead.

**Scope and limits:** Quote style does not matter: next('route') skips exactly like next("route"). Passing an error object is the legitimate sibling and stays allowed. The finding is the next call itself, not a call that contains it. The callee must be named next; a callback under another name is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express 5 API reference (expressjs.com)",
  "locator": "Router, next(route)",
  "paraphrase": "Passing the string route or router to next skips the remaining stack by name. A typo in that string silently changes which handlers run."
}
```

### express/EX-CORS-001

Check: [`express/security/no-cors-open@1.0.0`](checks/security/no-cors-open/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.cors-open-header`. Minimum severity: `none`.

Manual wildcard headers bypass the cors middleware's origin list and expose authenticated responses to any site the user visits.

Default parameters: `{}`.

**Repair:** Serve CORS through the cors middleware with an explicit origin list, or set the header to the one origin the client runs on.

**Scope and limits:** Lowercasing the header name changes nothing on the wire. Using res.header instead of res.set is the same policy.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs",
  "locator": "Access-Control-Allow-Origin",
  "paraphrase": "A wildcard allow-origin header tells browsers every site may read the response. With credentials it hands the user's session to any origin that asks."
}
```

### express/EX-PATH-001

Check: [`express/requests/no-send-file-user-path@1.0.0`](checks/requests/no-send-file-user-path/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.send-file-user-path`. Minimum severity: `none`.

A route parameter such as ..%2F..%2Fetc%2Fpasswd decodes to ../ segments, so path.join walks out of the intended folder and the server sends any readable file.

Default parameters: `{}`.

**Repair:** Pass the user-supplied name as the path with { root: dir }, or reduce it to path.basename(name) before joining it to a fixed directory.

**Scope and limits:** A variable named rootDir inside path.join is not the root option. res.download has the same file-system reach. A path destructured from req.params into a local name first is not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express 5 API reference (expressjs.com)",
  "locator": "https://expressjs.com/en/5x/api.html#res.sendFile",
  "paraphrase": "res.sendFile reads the running file system. If the path contains user input, either build it securely or set the root option so Express keeps the resolved path inside that directory."
}
```

### express/EX-V5-001

Check: [`express/requests/no-removed-v5-api@1.0.0`](checks/requests/no-removed-v5-api/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.removed-v5-api`. Minimum severity: `none`.

On Express 5 these calls throw, send the status number as the body, or redirect to a literal /back path. On Express 4 they log deprecation warnings.

Default parameters: `{}`.

**Repair:** Use app.delete, req.params/req.body/req.query, res.sendFile, res.sendStatus(code), res.status(code).json(body), res.redirect(status, url), req.get('Referrer') || '/' and req.acceptsLanguages.

**Scope and limits:** res.send('200') with a quoted number is a valid body. res.redirect(301, url) puts the status first and is allowed. del on a cache or Redis client is not an Express router.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express documentation, Migrating to Express 5",
  "locator": "https://expressjs.com/en/guide/migrating-5.html#removed-methods-and-properties",
  "paraphrase": "Express 5 removed app.del, req.param(name), res.sendfile, the res.json(obj, status), res.send(body, status), res.send(status) and res.redirect(url, status) signatures, the back magic string and the singular req.accepts* names. Express 4 already deprecated them."
}
```

### express/EX-COOKIE-001

Check: [`express/security/no-insecure-cookie-options@1.0.0`](checks/security/no-insecure-cookie-options/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.cookie-options`. Minimum severity: `none`.

Explicitly setting httpOnly: false exposes cookies to document.cookie theft during XSS, and secure: false allows transmission over unencrypted HTTP.

Default parameters: `{}`.

**Repair:** Set { httpOnly: true, secure: true, sameSite: 'lax' } on res.cookie, or omit explicit false overrides.

**Scope and limits:** Only inline object literals passed to res.cookie or response.cookie with literal false for httpOnly or secure are matched. Options built in a separate variable are not tracked.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express Production Best Practices: Security (expressjs.com)",
  "locator": "https://expressjs.com/en/advanced/best-practice-security.html#use-cookies-securely",
  "paraphrase": "Cookies carrying session or identity state should set httpOnly and secure so client-side scripts cannot read them and plaintext connections cannot transmit them."
}
```

### express/EX-SYNC-001

Check: [`express/requests/no-sync-in-handlers@1.0.0`](checks/requests/no-sync-in-handlers/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `express.sync-in-handler`. Minimum severity: `none`.

A single readFileSync or writeFileSync inside a route callback blocks the entire Node process for the duration of disk I/O.

Default parameters: `{}`.

**Repair:** Use async fs/promises methods (await readFile, await writeFile) inside an async route handler, or load static files once at module startup.

**Scope and limits:** Synchronous calls at module top-level before app.listen are allowed. Sync calls hidden inside a helper function declared outside the app/router call are not followed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express Production Best Practices: Performance and Reliability (expressjs.com)",
  "locator": "https://expressjs.com/en/advanced/best-practice-performance.html#use-asynchronous-functions",
  "paraphrase": "Synchronous functions tie up the single-threaded Node.js execution loop until they return, stalling every concurrent request."
}
```
