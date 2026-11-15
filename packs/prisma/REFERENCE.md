# prisma pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.3.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## prisma/client

Manifest version: `1.2.0`. Status: **complete**.

### prisma/PRISMA-RAW-001

Check: [`prisma/client/no-raw-unsafe@1.1.0`](checks/client/no-raw-unsafe/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.raw-unsafe`. Minimum severity: `none`.

SQL built at runtime and passed to an Unsafe call puts caller input straight into the query, so one malicious value owns it.

Default parameters: `{}`.

**Repair:** Switch to the $queryRaw or $executeRaw template form and interpolate values with ${}, or keep a constant SQL string with $1 placeholders and pass the values as extra arguments.

**Scope and limits:** Wrapping the string in a helper or awaiting the call does not parameterize it. A bare variable or an interpolated template is still runtime SQL. A constant string literal with $n placeholders passes; values given as extra arguments are bound.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, Raw queries",
  "locator": "section on $queryRawUnsafe and $executeRawUnsafe",
  "paraphrase": "The Unsafe raw methods run the string as SQL. Values are safe only as extra arguments bound to $1 placeholders; text built into the string is not parameterized."
}
```

### prisma/PRISMA-SQL-001

Check: [`prisma/client/no-raw-interpolation@1.0.0`](checks/client/no-raw-interpolation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.sql-concat`. Minimum severity: `none`.

String concatenation inside a raw call builds SQL by hand, defeating the parameterization the template form would have applied.

Default parameters: `{}`.

**Repair:** Rewrite the call as a template literal and interpolate each value with ${} instead of concatenating.

**Scope and limits:** $executeRaw has the same hole as $queryRaw. A constant string with no concatenation is fine and stays green.

**Interactions when active together:**

- Duplicates `prisma/PRISMA-RAW-002`: $queryRaw(Prisma.raw("..." + value)) is reported by both rules: this one sees + in the raw call's arguments, PRISMA-RAW-002 sees the assembled Prisma.raw text. Settle: Keep both. Moving the value into a $queryRaw tagged template or Prisma.sql satisfies both; PRISMA-RAW-002 also covers Prisma.raw fragments built outside the raw call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, Raw queries",
  "locator": "section on template versus string arguments to $queryRaw",
  "paraphrase": "Only the template form of $queryRaw and $executeRaw parameterizes values. A plain string argument is sent as-is, so concatenation reopens injection."
}
```

### prisma/PRISMA-RAW-002

Check: [`prisma/client/no-prisma-raw-interpolation@1.0.0`](checks/client/no-prisma-raw-interpolation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.raw-fragment`. Minimum severity: `none`.

Prisma.raw turns its text into SQL syntax. A value interpolated or concatenated into that text escapes parameterization, even inside an otherwise safe $queryRaw template.

Default parameters: `{}`.

**Repair:** Pass the value as ${value} in a $queryRaw tagged template or Prisma.sql, so it travels as a parameter. Keep Prisma.raw for constant fragments or identifiers chosen from a fixed allowlist.

**Scope and limits:** Nesting Prisma.raw inside a $queryRaw tagged template does not parameterize its text. The rule sees a template with ${} or + in the first Prisma.raw argument; Prisma.raw(variable) passes because an allowlisted identifier and raw input look the same here.

**Interactions when active together:**

- Duplicates `vibe-proof/VP-SQL-001`: Prisma.raw(`...${value}`) is a raw method with an interpolated first argument, so both rules report it. Settle: Keep both. A $queryRaw tagged template or Prisma.sql satisfies both; PRISMA-RAW-002 also catches + concatenation.
- Duplicates `prisma/PRISMA-SQL-001`: $queryRaw(Prisma.raw("..." + value)) is reported by both rules: PRISMA-SQL-001 sees + in the raw call's arguments, this one sees the assembled Prisma.raw text. Settle: Keep both. Moving the value into a $queryRaw tagged template or Prisma.sql satisfies both.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, Raw queries",
  "locator": "SQL injection prevention, unsafe use of $queryRaw and $executeRaw (misuse of Prisma.raw); https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries#sql-injection-prevention",
  "paraphrase": "Prisma.raw inserts its text into the query unescaped. The docs list Prisma.raw over an interpolated template as vulnerable to SQL injection, and use Prisma.sql or the tagged template for values."
}
```

### prisma/PRISMA-SELECT-001

Check: [`prisma/client/no-select-star-include@1.0.0`](checks/client/no-select-star-include/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.select-include`. Minimum severity: `none`.

A full-relation include pulls every column of every related row, including fields the caller never reads and should never see.

Default parameters: `{}`.

**Repair:** Replace `: true` with a nested select naming the fields the caller needs, or add take to bound the relation.

**Scope and limits:** Pushing `: true` one level down under a nested include is the same over-fetch. select without include is already scoped. Prisma documents include with `: true` as a supported query, so this stays advisory: whether the extra columns matter depends on the caller.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, Select and include",
  "locator": "section on include with nested select",
  "paraphrase": "include with `: true` loads the whole related record. Nesting a select keeps the join but fetches only the named fields."
}
```

### prisma/PRISMA-TAKE-001

Check: [`prisma/client/no-findmany-without-pagination@1.0.0`](checks/client/no-findmany-without-pagination/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.findfirst-orderby`. Minimum severity: `none`.

Without an order the same query returns different rows across replicas, vacuums, and plan changes, so behavior drifts silently.

Default parameters: `{}`.

**Repair:** Add an orderBy that names the winner, such as createdAt descending. Keep it on both findFirst and findFirstOrThrow.

**Scope and limits:** OrThrow only changes the missing-row case. It does not order anything.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, findFirst and sorting",
  "locator": "section on orderBy with findFirst",
  "paraphrase": "findFirst without an orderBy returns whichever row the database happens to visit first. An explicit order makes the pick deterministic."
}
```

### prisma/PRISMA-CONNECT-001

Check: [`prisma/client/no-multiple-clients@1.0.0`](checks/client/no-multiple-clients/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.client-singleton`. Minimum severity: `none`.

A fresh client per request opens a fresh pool per request, and the database runs out of connections under load.

Default parameters: `{}`.

**Repair:** Import one shared client and keep it on globalThis. On Prisma ORM 7, construct it with a driver adapter (new PrismaClient({ adapter })) or accelerateUrl for Accelerate. https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7

**Scope and limits:** Exporting the new client from the route file still builds one pool per route module. The singleton module itself is the only place that may construct.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, connection management",
  "locator": "section on instantiating PrismaClient per request",
  "paraphrase": "Each PrismaClient owns a connection pool. Constructing one per request exhausts the database, so handlers must share a singleton."
}
```

### prisma/PRISMA-LOG-001

Check: [`prisma/client/no-query-event-logging@1.0.0`](checks/client/no-query-event-logging/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.query-logging`. Minimum severity: `none`.

Query logs carry raw SQL and bound values into log storage, leaking personal data and query structure to anyone with log access.

Default parameters: `{}`.

**Repair:** Set log to error only, or drop the log option. Keep query logging behind a local debug flag.

**Scope and limits:** Appending error next to query keeps the query stream. The object form with level query is the same leak.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, logging",
  "locator": "section on the query log level",
  "paraphrase": "The query log level emits every SQL statement with its bound parameters. Production clients should log errors, not queries."
}
```

### prisma/PRISMA-MIDDLEWARE-001

Check: [`prisma/client/no-client-middleware@1.0.0`](checks/client/no-client-middleware/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.client-middleware`. Minimum severity: `none`.

On Prisma ORM 7 the $use call throws at runtime, so the query behavior it used to wrap never runs.

Default parameters: `{}`.

**Repair:** Replace $use with a client extension: db.$extends({ query: { $allModels: { async $allOperations({ args, query }) { return query(args); } } } }). https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7

**Scope and limits:** This runs only when @prisma/client, or prisma when the client package is absent, is known to be at least 7.0.0. A lower bound below 7, including ^6, wins over a newer hoisted install. workspace:* counts only when the installed copy is 7 or newer. A $use value that is not called stays quiet.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Upgrade to Prisma ORM 7",
  "locator": "Client middleware removed; https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7",
  "paraphrase": "Prisma ORM 7 removes the client middleware API. The upgrade guide replaces prisma.$use with a client extension created by $extends."
}
```

### prisma/PRISMA-VALIDATOR-001

Check: [`prisma/client/no-validator@1.0.0`](checks/client/no-validator/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.validator`. Minimum severity: `none`.

A Prisma.validator call fails to typecheck against the default Prisma ORM 7 client, which no longer generates that function.

Default parameters: `{}`.

**Repair:** Use satisfies instead of Prisma.validator, for example { email: true } satisfies Prisma.UserSelect. https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators

**Scope and limits:** Warns only on Prisma 7 or newer. prisma-client-js still has Prisma.validator; this check cannot read the generator, so that deprecated generator still warns. A Prisma.validator reference that is not called stays quiet.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma ORM v7 generators reference",
  "locator": "Breaking changes from prisma-client-js; https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators",
  "paraphrase": "The prisma-client generator, which is the default in Prisma ORM 7, has no Prisma.validator. TypeScript's satisfies keyword replaces it. The deprecated prisma-client-js generator still provides the helper."
}
```

### prisma/PRISMA-ADAPTER-001

Check: [`prisma/client/no-missing-adapter@1.0.0`](checks/client/no-missing-adapter/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.driver-adapter`. Minimum severity: `none`.

A Prisma ORM 7 client constructed without a driver adapter cannot connect, and the old datasources and datasourceUrl options are no longer accepted.

Default parameters: `{}`.

**Repair:** Pass a driver adapter: new PrismaClient({ adapter }). Accelerate uses new PrismaClient({ accelerateUrl }) and no adapter. https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7

**Scope and limits:** Warns only on Prisma 7 or newer. { adapter } and { accelerateUrl } pass, including quoted keys. A variable, call, spread, or nested adapter key stays quiet. Prisma 6 constructs without an adapter and stays quiet.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Upgrade to Prisma ORM 7",
  "locator": "Driver adapters; https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7",
  "paraphrase": "Prisma ORM 7 requires a driver adapter for every database when constructing PrismaClient. Accelerate is the documented exception and passes accelerateUrl with no adapter. The 7.0.0 changelog also removes the datasources and datasourceUrl constructor options."
}
```

## prisma/writes

Manifest version: `1.3.0`. Status: **complete**.

### prisma/PRISMA-DELETE-001

Check: [`prisma/writes/no-deletemany-without-where@1.0.0`](checks/writes/no-deletemany-without-where/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.deletemany-where`. Minimum severity: `none`.

A missing filter turns a scoped cleanup into a table wipe, and the call succeeds quietly with a count.

Default parameters: `{}`.

**Repair:** Add a where filter that names the rows to remove. For a real truncate, isolate it in a migration or seed script, not app code.

**Scope and limits:** An empty object argument is an empty filter. Awaiting the call sequences the wipe but does not scope it.

**Interactions when active together:**

- Duplicates `mongodb/MONGO-DELETEMANY-001`: A bare .deleteMany() or .deleteMany({}) call has no where property and an empty filter, so both rules report it when both packs are active. Settle: Keep both. Passing a non-empty where filter satisfies both; disable the pack for the database you do not use in that module.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, deleteMany",
  "locator": "section on the filter argument",
  "paraphrase": "deleteMany with an empty filter deletes every row in the table. A where clause must name exactly the rows to remove."
}
```

### prisma/PRISMA-UPSERT-001

Check: [`prisma/writes/no-updatemany-without-where@1.0.0`](checks/writes/no-updatemany-without-where/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.updatemany-where`. Minimum severity: `none`.

A data-only call rewrites the column on every row, and the damage looks like normal application writes.

Default parameters: `{}`.

**Repair:** Pass where alongside data so only the intended rows change.

**Scope and limits:** data alone is not a scope. An empty object argument carries no filter either.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, updateMany",
  "locator": "section on the filter argument",
  "paraphrase": "updateMany applies data to every row its filter matches. With no where clause the filter matches the whole table."
}
```

### prisma/PRISMA-TXCLIENT-001

Check: [`prisma/writes/no-outer-client-in-transaction@1.0.0`](checks/writes/no-outer-client-in-transaction/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.transaction-client`. Minimum severity: `none`.

A model or raw query on the outer client inside the callback runs on its own connection. It commits immediately and does not roll back when the transaction fails.

Default parameters: `{}`.

**Repair:** Call the query on the callback's tx parameter, or pass tx to the helper that runs it. Move work that must survive a rollback after the transaction instead.

**Scope and limits:** The rule only reports a callback whose parameter has a different name from the client; async (prisma) => shadows the client and passes. The array form $transaction([prisma.a.create(), ...]) is correct and passes. Queries inside a helper called from the callback are not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma docs, Transactions and batch queries",
  "locator": "Interactive transactions; https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions#interactive-transactions",
  "paraphrase": "The async function passed to $transaction receives a Prisma Client instance, tx. Only calls made on that tx instance are encapsulated in the transaction."
}
```

### prisma/PRISMA-EMPTY-WHERE-001

Check: [`prisma/writes/no-empty-where-delete@1.0.0`](checks/writes/no-empty-where-delete/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `prisma.empty-where-mutation`. Minimum severity: `none`.

Developers often write where: {} to satisfy a required key or lint check, not realizing Prisma treats an empty filter as an unconditional full-table delete or update.

Default parameters: `{}`.

**Repair:** Specify at least one concrete column condition inside where (for example where: { tenantId, expiredAt: { lt: now } }).

**Scope and limits:** Complements PRISMA-DELETE-001 and PRISMA-UPSERT-001, which catch calls that omit the where key altogether. Dynamic filter variables are not evaluated.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Prisma documentation, Prisma Client API reference (prisma.io)",
  "locator": "https://www.prisma.io/docs/orm/reference/prisma-client-reference#deletemany",
  "paraphrase": "Passing an empty object where: {} to deleteMany or updateMany matches all records in the table, identical to omitting where entirely."
}
```
