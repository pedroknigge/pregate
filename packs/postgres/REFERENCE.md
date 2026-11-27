# postgres pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## postgres/client

Manifest version: `1.2.0`. Status: **preview**.

### postgres/PG-POOL-001

Check: [`postgres/client/no-new-client-per-query@1.0.0`](checks/client/no-new-client-per-query/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.new-client-per-query`. Minimum severity: `none`.

A constructor match cannot tell a short-lived migration client from a client leaked on every request.

Default parameters: `{}`.

**Repair:** Create one Pool at startup and share it. Take a dedicated client from pool.connect only for multi-statement transactions, and release it in a finally.

**Scope and limits:** Exporting a single Client from a module is still one connection for every query; export a Pool instead.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, pooling guide",
  "locator": "pooling section on Pool versus Client",
  "paraphrase": "The driver supports both Client and Pool. Pool is useful for concurrency; a standalone Client is valid for one-off work."
}
```

### postgres/PG-ERROR-001

Check: [`postgres/client/no-empty-pool-error-handler@1.0.0`](checks/client/no-empty-pool-error-handler/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.empty-pool-error-handler`. Minimum severity: `none`.

An empty error callback acknowledges the listener contract while swallowing the failure, so dead connections and auth breaks stay invisible until queries start failing.

Default parameters: `{}`.

**Repair:** Log the error with the pool identity, or forward it to the app error reporter. Keep the handler to one call that cannot throw.

**Scope and limits:** A function-expression callback with an empty body is the same swallowed error as an empty arrow.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, pooling guide",
  "locator": "pool error handling section",
  "paraphrase": "Idle pool clients can error at any time, so the pool must have an error listener that observes or reports the failure instead of dropping it."
}
```

### postgres/PG-TX-001

Check: [`postgres/client/no-pool-query-begin@1.0.0`](checks/client/no-pool-query-begin/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.pool-query-begin`. Minimum severity: `none`.

pool.query borrows any idle connection per call, so BEGIN, the statements, and COMMIT can land on different backends and the transaction never holds.

Default parameters: `{}`.

**Repair:** Check out one client with pool.connect, run BEGIN through COMMIT on it, roll back on error, and release it in a finally.

**Scope and limits:** Wrapping pool.query BEGIN in backticks or single quotes does not pin it to one connection.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, transactions guide",
  "locator": "transaction section on dedicated clients",
  "paraphrase": "A transaction must run on one dedicated client checked out with pool.connect. pool.query may route each statement to a different connection, which splits the transaction."
}
```

### postgres/PG-SLEEP-001

Check: [`postgres/client/no-pg-sleep-query@1.0.0`](checks/client/no-pg-sleep-query/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.pg-sleep-query`. Minimum severity: `none`.

The sleeping backend holds its pool slot for the whole delay, so a few naps exhaust the pool and queue every other query.

Default parameters: `{}`.

**Repair:** Sleep in the app with a timer between queries, or move the wait into a job queue. Keep pooled connections for statements that return promptly.

**Scope and limits:** Parameterizing the delay inside a template still blocks the connection for the same seconds.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PostgreSQL documentation, pg_sleep",
  "locator": "delaying execution functions",
  "paraphrase": "pg_sleep blocks the backend for the delay. Issued from app code it parks a pooled connection that could serve real queries."
}
```

### postgres/PG-ROWS-001

Check: [`postgres/client/no-unchecked-row-access@1.0.0`](checks/client/no-unchecked-row-access/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.unchecked-row-access`. Minimum severity: `none`.

An empty result makes rows[0] undefined, so the chained property read throws far from the query that returned nothing.

Default parameters: `{}`.

**Repair:** Bind rows[0] to a name, throw or return early when it is missing, then read its fields. Optional chaining with a fallback also passes.

**Scope and limits:** Moving the chained read inside a template still throws on zero rows; string context is not a guard.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, query results",
  "locator": "result object rows array",
  "paraphrase": "A query result carries rows as a possibly empty array. Reading a property off rows[0] assumes a row came back, which an empty result breaks."
}
```

### postgres/PG-RELEASE-001

Check: [`postgres/client/no-unreleased-pool-client@1.0.0`](checks/client/no-unreleased-pool-client/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.client-release`. Minimum severity: `none`.

Each unreleased client keeps one pool slot. After max leaks every request that needs the database hangs instead of failing.

Default parameters: `{}`.

**Repair:** Call client.release() in a finally block after the work, passing the error when the client is broken. For one statement, use pool.query, which checks out and releases for you.

**Scope and limits:** COMMIT or ROLLBACK ends the transaction, not the checkout. The rule looks for any client.release reference or a return of the client in the same file; a release reached only on the error path, or a client handed to a helper that releases it, is not judged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, pooling guide",
  "locator": "Checkout, use, and return; https://node-postgres.com/features/pooling",
  "paraphrase": "You must always return a checked-out client to the pool, whether or not its queries failed. A client that is never released leaks, and once the pool is empty every later checkout waits forever."
}
```

### postgres/PG-TX-ROLLBACK-001

Check: [`postgres/client/no-tx-without-rollback@1.0.0`](checks/client/no-tx-without-rollback/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.tx-rollback`. Minimum severity: `none`.

Releasing a client after a failed query without issuing ROLLBACK poisons the pooled connection: every subsequent borrower hits 'current transaction is aborted, commands ignored until end of transaction block'.

Default parameters: `{}`.

**Repair:** Add a catch (err) block that awaits client.query('ROLLBACK') and rethrows err before finally { client.release(); }.

**Scope and limits:** Only try statements containing a literal BEGIN query are checked. Transactions wrapped in a reusable withTransaction(client, fn) helper only need the rollback inside that helper.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, Transactions (node-postgres.com)",
  "locator": "https://node-postgres.com/features/transactions",
  "paraphrase": "A pooled client that begins a transaction must execute ROLLBACK in its catch block before client.release(), or the connection returns to the pool stuck in an open/aborted transaction."
}
```

## postgres/safety

Manifest version: `1.1.0`. Status: **preview**.

### postgres/PG-CONCAT-001

Check: [`postgres/safety/no-query-concat@1.1.0`](checks/safety/no-query-concat/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.query-concat`. Minimum severity: `none`.

A concatenated or interpolated value is parsed as SQL, so a quote in user input escapes the literal and runs attacker SQL.

Default parameters: `{}`.

**Repair:** Rewrite the statement with $1, $2 placeholders and pass the values as the second query argument. Keep identifiers static or allowlist them.

**Scope and limits:** Backticks with ${} are still concatenation; only a params array parameterizes. The rule reads the first .query argument (or the text field of a config object), through parentheses, casts, ternaries and ??/||/&& fallbacks; values in the params array are not read. SQL built in a variable or inside a helper call is not seen, and any tagged template passes as a parameterizing tag.

**Interactions when active together:**

- Duplicates `vibe-proof/VP-SQL-001`: A .query() call with an interpolated template literal is reported by both rules. Settle: Keep both: a parameterized query ($1 placeholders with a values array) satisfies both, and PG-CONCAT-001 also catches + concatenation.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, parameterized queries",
  "locator": "parameterized query section with $1 placeholders",
  "paraphrase": "Pass values as a params array against $1 placeholders. Concatenating values into the SQL string sends them as code, which is injection."
}
```

### postgres/PG-SSL-001

Check: [`postgres/safety/no-sslmode-disable@1.0.0`](checks/safety/no-sslmode-disable/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.sslmode-disable`. Minimum severity: `none`.

sslmode=disable, ssl false, or rejectUnauthorized false leaves the database link cleartext or MITM-able, exposing credentials and row data.

Default parameters: `{}`.

**Repair:** Use sslmode=require or verify-full in the URL, or ssl with rejectUnauthorized true and the CA. Scope any exception to local-only config, not code.

**Scope and limits:** Moving the disable into the connection URL is the same open link as the ssl flag.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PostgreSQL documentation, libpq connection strings",
  "locator": "sslmode parameter and TLS verification",
  "paraphrase": "Keep TLS verification on for database links. Disabling it sends credentials and rows over a connection anyone on the path can read or rewrite."
}
```

### postgres/PG-TIMEOUT-001

Check: [`postgres/safety/no-pool-without-timeout@1.0.0`](checks/safety/no-pool-without-timeout/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.pool-without-timeout`. Minimum severity: `none`.

A pool with no statement or idle timeout lets one stuck query pin a connection indefinitely until the pool is exhausted.

Default parameters: `{}`.

**Repair:** Set statement_timeout for statements and idleTimeoutMillis for idle clients on every Pool, sized from the slowest legitimate query.

**Scope and limits:** Tuning max alone sizes the pool; it does not bound a runaway statement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, Pool configuration",
  "locator": "statement_timeout and idleTimeoutMillis options",
  "paraphrase": "Bound how long a statement and an idle client may live. Without a timeout one runaway query holds its connection forever and starves the pool."
}
```

### postgres/PG-IDENT-001

Check: [`postgres/safety/no-identifier-placeholder@1.0.0`](checks/safety/no-identifier-placeholder/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `postgres.identifier-placeholder`. Minimum severity: `none`.

A $n placeholder always carries a value. FROM $1 or INSERT INTO $1 fails with a syntax error, and ORDER BY $1 sorts by a constant, so the rows come back unsorted without any error.

Default parameters: `{}`.

**Repair:** Keep table and column names static, choose them from a fixed allowlist, or escape them with pg-format's %I. Keep $n placeholders for values only.

**Scope and limits:** ORDER BY $1 runs without an error but does not sort by the named column. Placeholders after FROM inside EXTRACT, substring or trim, followed by a cast, or in FROM unnest($1) are values and pass. The rule reads literal query text in the .query arguments; text built in a variable is not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-postgres documentation, queries",
  "locator": "Parameterized query; https://node-postgres.com/features/queries#parameterized-query",
  "paraphrase": "PostgreSQL does not support parameters for identifiers. Dynamic database, schema, table or column names need pg-format escaping instead of $n placeholders."
}
```
