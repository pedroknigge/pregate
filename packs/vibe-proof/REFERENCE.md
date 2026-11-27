# vibe-proof pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.1.0`. Category: **practice**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## vibe-proof/hygiene

Manifest version: `1.0.2`. Status: **preview**.

### vibe-proof/VP-CONSOLE-001

Check: [`vibe-proof/debug/console-leftover@1.0.0`](checks/debug/console-leftover/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `debug.console`. Minimum severity: `none`.

A leftover log prints invoices, ids, and payloads to whatever stdout production captures.

Default parameters: `{}`.

**Repair:** Delete the call, or log through the application's logger at the level the operation actually needs. console.error and console.warn are left for real failures.

**Scope and limits:** console["log"] is the same call. Moving the call into a test file is fine because tests are ignored. Renaming to console.info is not.

**Interactions when active together:**

- Duplicates `mattpocock/MP-DEBUG-001`: A console.log tagged [DEBUG-...] outside tests is reported by both rules. Settle: Turn MP-DEBUG-001 off while VP-CONSOLE-001 already reports every console.log, or keep both for its debugging-session wording.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Maintainability, debug leftovers",
  "paraphrase": "Debug prints do not ship. A log that was useful while writing the feature is noise and sometimes data in production."
}
```

### vibe-proof/VP-DEBUG-001

Check: [`vibe-proof/debug/debugger-statement@1.0.0`](checks/debug/debugger-statement/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `debug.debugger`. Minimum severity: `none`.

debugger stops a browser or inspector on the production path when devtools are attached, and it marks a session that was not finished.

Default parameters: `{}`.

**Repair:** Delete the statement.

**Scope and limits:** Putting it behind if (false) still leaves the statement in the file.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "debug leftovers",
  "paraphrase": "A debugger breakpoint is a development aid. It does not belong in the code that ships."
}
```

### vibe-proof/VP-TODO-001

Check: [`vibe-proof/maintainability/todo-without-owner@1.0.0`](checks/maintainability/todo-without-owner/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `maintainability.todo-owner`. Minimum severity: `none`.

An ownerless TODO is a broken path with no one named to finish it. Six months later it still says later.

Default parameters: `{}`.

**Repair:** Write TODO(name): the blocked behavior and the next action, or delete the marker and fix the path.

**Scope and limits:** TODO: ada will fix does not put the owner in parentheses. TODO(t) is too short to be a handle. A fake owner satisfies the syntax and is a social hole, not a structural one.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Maintainability, critical TODO",
  "paraphrase": "A critical TODO names the blocked behavior and who picks it up. \"Fix later\" leaves the broken path active."
}
```

### vibe-proof/VP-FIND-MANY-001

Check: [`vibe-proof/performance/unbounded-find-many@1.0.0`](checks/performance/unbounded-find-many/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `performance.unbounded-find`. Minimum severity: `none`.

An unbounded findMany loads every matching row. The list grows with the table and the request grows with it.

Default parameters: `{}`.

**Repair:** Pass take or cursor and a stable order. Page until the caller stops.

**Scope and limits:** A field named taken is not take. Mentioning take inside a comment in the argument list is a hole because the rule sees the word.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Performance, list endpoints",
  "paraphrase": "A list path enforces a server-side size limit. One request must not load the whole growing table."
}
```

### vibe-proof/VP-SELECT-001

Check: [`vibe-proof/performance/unbounded-select-star@1.0.0`](checks/performance/unbounded-select-star/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `performance.select-star`. Minimum severity: `none`.

select * with no limit pulls every column of every matching row into the process.

Default parameters: `{}`.

**Repair:** Name the columns and add a limit, or page with a cursor.

**Scope and limits:** A comment that says the table is small does not add a limit. Writing LIMIT in the SQL does satisfy this rule; it does not prove the limit is sane.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Performance, bounded scans",
  "paraphrase": "A list query is bounded. select * without a limit is not a bounded scan."
}
```

### vibe-proof/VP-INTERVAL-001

Check: [`vibe-proof/reliability/setinterval-without-clear@1.0.1`](checks/reliability/setinterval-without-clear/check.json). Default severity: **deny**.

Implementation: `interval-cleanup`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `reliability.interval-clear`. Minimum severity: `none`.

A timer that is never cleared keeps the callback and anything it closed over for the life of the process.

Default parameters: `{}`.

**Repair:** Keep the interval handle and read that same handle with clearInterval on its cleanup path. Cleanup can live in a sibling function for a module-local ref/object field or the same local named container type. Verify that the owner actually calls cleanup on every required lifecycle path.

**Scope and limits:** The checker recognizes local handle bindings and exact property chains, const aliases and property types declared in this module. Sibling parameters sharing the same named container type and remaining handle fields provide syntactic evidence; this does not prove they are the same runtime instance or that cleanup executes. Different roots, named types and fields remain distinct. Unstored handles, imported type contracts and complex alias/call flows remain unproved; comments or unrelated clearInterval calls do not count.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "resource-leak",
  "paraphrase": "Whoever starts a timer clears it. A long-lived service that only acquires leaks the resource."
}
```

### vibe-proof/VP-BUILD-001

Check: [`vibe-proof/process/ignore-build-errors@1.0.0`](checks/process/ignore-build-errors/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `process.ignore-build`. Minimum severity: `none`.

The flag ships a build the type checker or the linter already rejected. The demo stays green while the errors stay.

Default parameters: `{}`.

**Repair:** Fix the diagnostic. Leave the flag false or delete it.

**Scope and limits:** Nesting the flag under eslint or typescript does not hide the pair. Setting it false is allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "ignore-build-errors",
  "paraphrase": "ignoreBuildErrors and eslint.ignoreDuringBuilds are evidence the demo was shipped past a failing check."
}
```

## vibe-proof/secrets

Manifest version: `1.0.2`. Status: **preview**.

### vibe-proof/VP-SECRET-001

Check: [`vibe-proof/security/hardcoded-secret@1.0.1`](checks/security/hardcoded-secret/check.json). Default severity: **deny**.

Implementation: `credential-literal`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `security.hardcoded-secret`. Minimum severity: `none`.

A secret in source is copied into git, into logs, and into every worktree. Rotation then means rewriting history.

Default parameters: `{}`.

**Repair:** Read the value from the environment or a secret manager. Commit a name, not the value.

**Scope and limits:** A short sk_live_test is below the token threshold. Only a complete static URL literal with password secret, password or changeme is exempt in a .test/.spec file; comments, production URLs, interpolated URLs and real-looking credentials still match. Splitting a real token across expressions hides it and does not remove the secret.

**Interactions when active together:**

- Duplicates `authjs/AUTH-SECRET-001`: A token-shaped literal assigned to the Auth.js secret is reported by both rules. Settle: Keep both: AUTH-SECRET-001 also catches secrets that do not look like a known token. Reading the secret from the environment satisfies both.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Security / Secrets, hardcoded secrets",
  "paraphrase": "Source does not contain real API keys, tokens, private keys or credentialed connection strings. Exact known URL-password placeholders in test fixtures are distinguished from real credentials."
}
```

### vibe-proof/VP-CLIENT-SECRET-001

Check: [`vibe-proof/security/client-public-secret@1.0.0`](checks/security/client-public-secret/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security.client-public-secret`. Minimum severity: `none`.

Those prefixes are inlined into the client bundle. A server secret under that name ships to the browser.

Default parameters: `{}`.

**Repair:** Keep the secret in an unprefixed server env var. Expose only values that are safe to publish, such as a public API URL.

**Scope and limits:** Renaming the suffix to KEY still matches when the name contains SECRET or TOKEN. A server-only STRIPE_SECRET without the public prefix is not this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Security / Secrets, client bundle",
  "paraphrase": "A public env prefix must not wrap a server secret. The value would be readable from shipped client code."
}
```

## vibe-proof/transport

Manifest version: `1.1.0`. Status: **preview**.

### vibe-proof/VP-TIMEOUT-001

Check: [`vibe-proof/reliability/fetch-without-timeout@1.0.0`](checks/reliability/fetch-without-timeout/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `reliability.fetch-timeout`. Minimum severity: `none`.

A network call with no deadline can hang the request until the process is killed.

Default parameters: `{}`.

**Repair:** Pass an AbortSignal with a timeout, or the client's timeout option, and decide what the caller does when it fires.

**Scope and limits:** Putting signal: null in the options still contains the word signal and is a hole. A headers bag is not a deadline.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Error handling, unsafe-retry / bounded timeout",
  "paraphrase": "An external call has a bounded timeout or deadline. An indefinite wait is a failure."
}
```

### vibe-proof/VP-SQL-001

Check: [`vibe-proof/security/sql-interpolation@1.0.1`](checks/security/sql-interpolation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security.sql-interpolation`. Minimum severity: `none`.

A value spliced into SQL is an injection point. The database sees the caller's text as syntax.

Default parameters: `{}`.

**Repair:** Pass the SQL text with placeholders and send values as a separate argument list.

**Scope and limits:** This syntax check inspects a directly interpolated first argument of a query, execute, raw or unsafe method. Scope strings in other arguments and outer callbacks are not SQL. A $1 placeholder passes. Variables, concatenations and tagged sql templates require separate review; this rule does not prove their data flow or parameterization.

**Interactions when active together:**

- Duplicates `postgres/PG-CONCAT-001`: A .query() call with an interpolated template literal is reported by both rules. Settle: Keep both: a parameterized query ($1 placeholders with a values array) satisfies both, and PG-CONCAT-001 also catches + concatenation.
- Duplicates `prisma/PRISMA-RAW-002`: Prisma.raw(`...${value}`) is a raw method with an interpolated first argument, so both rules report it. Settle: Keep both. A $queryRaw tagged template or Prisma.sql satisfies both; PRISMA-RAW-002 also catches + concatenation.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Input / output, parameterized queries",
  "paraphrase": "Queries go to the database through parameters. String concatenation and interpolation of SQL are not a query API."
}
```

### vibe-proof/VP-CORS-001

Check: [`vibe-proof/security/cors-wildcard-credentials@1.0.0`](checks/security/cors-wildcard-credentials/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security.cors-credentials`. Minimum severity: `none`.

A credentialed request reflected to every origin lets any site call the API with the user's cookies.

Default parameters: `{}`.

**Repair:** List the origins that may send credentials. A public API that needs no cookies can use * only without credentials.

**Scope and limits:** Splitting the two fields across lines does not split the object. A star origin without credentials is a different policy and is allowed here.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Input / output, production CORS",
  "paraphrase": "Production CORS is not Access-Control-Allow-Origin * together with credentials."
}
```

### vibe-proof/VP-MASS-001

Check: [`vibe-proof/security/mass-assignment@1.0.0`](checks/security/mass-assignment/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security.mass-assignment`. Minimum severity: `none`.

The body can carry role, price, or owner. Writing it through copies those fields into the row.

Default parameters: `{}`.

**Repair:** Pick the fields this operation accepts and pass only those.

**Scope and limits:** Aliasing the body to a local and then spreading the local is a hole. Spreading request.body under another name in the same call is still the raw body.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "mass-assignment-open",
  "paraphrase": "Writes bind an allowlist of client fields. Spreading the raw request body into a create or update lets the caller set any column."
}
```

### vibe-proof/VP-HTML-001

Check: [`vibe-proof/security/dangerous-html@1.0.0`](checks/security/dangerous-html/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security.dangerous-html`. Minimum severity: `none`.

The prop inserts markup. A string that passed through a user becomes script in the page.

Default parameters: `{}`.

**Repair:** Render text as text. If a subset of HTML is required, sanitize it in one named function and keep that function the only caller.

**Scope and limits:** Renaming a wrapper that still passes the prop through does not remove the prop. The name is the sink.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Input / output, XSS",
  "paraphrase": "HTML from a caller is encoded or sanitized. A raw HTML injection prop is a sink."
}
```

### vibe-proof/VP-HTML-002

Check: [`vibe-proof/security/dom-html-sink@1.0.0`](checks/security/dom-html-sink/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security.dom-html-sink`. Minimum severity: `none`.

innerHTML, outerHTML, insertAdjacentHTML and document.write parse their string as markup, so a value that passed through a user becomes script in the page.

Default parameters: `{}`.

**Repair:** Set textContent or build elements with createElement. If a subset of HTML is required, sanitize it in one named function and keep that function the only writer.

**Scope and limits:** Bracket access such as el["outerHTML"], += appends and template literals with ${} are the same sink. String literals, templates without ${} and ternaries of them are allowed, as is reading innerHTML.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist; MDN Web Docs, Element: innerHTML property",
  "locator": "Input / output, XSS; https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML#security_considerations",
  "paraphrase": "HTML from a caller is encoded or sanitized. Setting innerHTML to a string you do not control is a cross-site scripting vector; use textContent for plain text."
}
```

### vibe-proof/VP-STACK-001

Check: [`vibe-proof/errors/stack-in-response@1.0.0`](checks/errors/stack-in-response/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `errors.stack-response`. Minimum severity: `none`.

A stack trace shows file paths, dependency versions, and sometimes query text to the caller.

Default parameters: `{}`.

**Repair:** Send a stable message and a correlation id. Log the stack on the server.

**Scope and limits:** err["stack"] is the same property. logger.error(error.stack) is not a response and is not this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Error handling, stack traces not exposed",
  "paraphrase": "End users do not receive stack traces. Diagnostic detail stays in server logs."
}
```

### vibe-proof/VP-INPUT-001

Check: [`vibe-proof/security/unvalidated-body@1.0.0`](checks/security/unvalidated-body/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security.unvalidated-body`. Minimum severity: `none`.

The JSON body is untyped input. Using it without a parser lets a missing field or an extra field through as if it were an invoice.

Default parameters: `{}`.

**Repair:** Parse the JSON with a schema's safeParse and branch on the failure before the value reaches a write.

**Scope and limits:** A comment that says safeParse is not a call. A local function that is also named safeParse and does nothing is a hole: the call exists and the schema does not.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "vibe-proof auditor checklist",
  "locator": "Input / output, server-side validation",
  "paraphrase": "Entry points validate input on the server. A body that is used raw skipped that step."
}
```
