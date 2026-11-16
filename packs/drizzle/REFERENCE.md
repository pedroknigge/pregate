# drizzle pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.3.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## drizzle/queries

Manifest version: `1.3.0`. Status: **complete**.

### drizzle/DRIZ-RAW-001

Check: [`drizzle/queries/no-sql-concat@1.0.0`](checks/queries/no-sql-concat/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.raw-concat`. Minimum severity: `none`.

A value concatenated into SQL is syntax to the database. A quote in the value ends the literal and starts a new command.

Default parameters: `{}`.

**Repair:** Use the query builder, or sql`... ${value} ...` so the value travels as a parameter. Reserve sql.raw for constant fragments, never for input.

**Scope and limits:** sql.raw with a constant string still fires; once text is raw the engine cannot tell a constant from input. Sanitizing before sql.raw also fires: the check is the raw call, not the cleaner.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, querying with raw SQL",
  "locator": "sql`` template parameters and sql.raw",
  "paraphrase": "Build raw fragments with the sql`` template so values travel as parameters. sql.raw splices text straight into the statement, and string concatenation through execute does the same."
}
```

### drizzle/DRIZ-SQL-001

Check: [`drizzle/queries/no-template-injection@1.0.0`](checks/queries/no-template-injection/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.where-string`. Minimum severity: `none`.

A string argument to where is spliced into the statement. A template literal with ${} looks parameterized but is still a raw string in this position.

Default parameters: `{}`.

**Repair:** Replace the string with eq/and/or over columns, or pass a parameterized sql`` fragment.

**Scope and limits:** A where whose first argument is a helper passes even when a later argument is a string literal, as in eq(name, "x"). Only a leading string or template is the raw-string shape this rule sees.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, select with filters",
  "locator": "where() with the eq, and, and or helpers",
  "paraphrase": "Filter with the builder helpers: where(eq(table.col, value)) and its and/or combinations. A raw string passed to where bypasses the helpers and reaches SQL as written."
}
```

### drizzle/DRIZ-LIMIT-001

Check: [`drizzle/queries/no-unbounded-select@1.1.0`](checks/queries/no-unbounded-select/check.json). Default severity: **deny**.

Implementation: `drizzle-bounded-select`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `drizzle.unbounded-select`. Minimum severity: `none`.

On selected bounded-read paths, a select/from result can grow with the table. A limit or terminal SQLite get() bounds returned rows. A predicate covering a declared primary/unique key also bounds rows when every inArray input has a proved finite budget and joins preserve that bound. These result bounds do not prove database execution cost or index quality.

Default parameters: `{}`.

**Repair:** For pagination, add .limit(n) with a validated page size. Keep valid unique-key queries: declare the actual constraint in the imported Drizzle schema. Bound inArray input with a fixed list, literal slice(0, n), or a preceding rejecting length guard. Unknown flows need scoped project evidence rather than unnecessary pagination.

**Scope and limits:** The checker follows literal select().from() receiver chains and admits limit() or terminal get() on that same chain. It resolves static local imports/reexports and TypeScript aliases, recognizes imported Drizzle table/helper bindings, and checks declared column/composite primary keys and unconditional unique indexes/constraints. It excludes partial/functional indexes, self-column equality, unknown predicates and amplifying joins; a proved many-to-one left/inner join preserves a bound. Input guards must dominate the query in the same function with no intervening calls or writes. Names such as id/slug, arbitrary lists, split queries, aggregate SQL, schema wrappers and unseen database migrations do not prove a bound. Apply this optional result policy only to reviewed bounded-read paths.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, select with pagination",
  "locator": "db.select().from().limit(); sqlite-core query-builder and prepared-query get() contract",
  "paraphrase": "Use a result bound on selected read paths. A limit bounds returned rows; SQLite get returns one row or no row. An offset alone does not bound the result."
}
```

### drizzle/DRIZ-REL-001

Check: [`drizzle/queries/no-n-plus-one-loop@1.0.0`](checks/queries/no-n-plus-one-loop/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.loop-query`. Minimum severity: `none`.

A query per iteration turns one round trip into N. Latency multiplies by the list length and the pool drains under load.

Default parameters: `{}`.

**Repair:** Replace the loop with db.query.parents.findMany({ with: { children: true } }) or a single join, then group in memory.

**Scope and limits:** The rule sees an awaited db call inside for, for-in/of, or while. A loop that only builds the query without awaiting it is a different shape this rule does not see.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, relational queries",
  "locator": "db.query with the with option, and joins",
  "paraphrase": "Load related rows with one relational query using with, or with a join, instead of awaiting a query per parent inside a loop."
}
```

### drizzle/DRIZ-MIG-001

Check: [`drizzle/queries/no-db-execute-ddl@1.0.0`](checks/queries/no-db-execute-ddl/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.execute-ddl`. Minimum severity: `none`.

Runtime DDL changes the schema outside the migration history. Two deploys disagree about the tables, and there is no down path.

Default parameters: `{}`.

**Repair:** Move the statement into a drizzle-kit migration and run it through the migrator.

**Scope and limits:** The keyword match is case-insensitive and reads string and template arguments; SELECT, INSERT, UPDATE, and DELETE pass. DDL hidden behind a variable instead of a literal is a hole this rule does not see.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle Kit documentation, migrations",
  "locator": "drizzle-kit generate and the migrator",
  "paraphrase": "Change the schema through generated migrations, not through DDL executed at runtime. CREATE, DROP, ALTER, and TRUNCATE inside execute bypass review, ordering, and rollback."
}
```

### drizzle/DRIZ-TX-001

Check: [`drizzle/queries/no-outer-db-in-transaction@1.0.0`](checks/queries/no-outer-db-in-transaction/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.transaction-client`. Minimum severity: `none`.

A query on the outer db inside the callback runs on another connection. It commits on its own and survives tx.rollback(), and with a small pool it can wait on the connection the transaction holds.

Default parameters: `{}`.

**Repair:** Replace db with tx inside the callback, or pass tx to the helper that runs the query. Move work that must survive a rollback after the transaction.

**Scope and limits:** The rule reports select, insert, update, delete, execute, run, all, get, values, $count and query.<table>.findMany/findFirst on the outer receiver. A callback parameter that shadows the receiver, as in async (db) =>, passes. Queries inside a helper called from the callback are not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, transactions",
  "locator": "db.transaction(async (tx) => ...) with queries on tx, nested tx.transaction savepoints; https://orm.drizzle.team/docs/transactions",
  "paraphrase": "Run every statement of a transaction through the tx passed to the callback, including relational queries and nested savepoints. The outer db is not part of the transaction."
}
```

### drizzle/DRIZ-DELETE-001

Check: [`drizzle/queries/no-unbounded-delete@1.0.0`](checks/queries/no-unbounded-delete/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.unbounded-delete`. Minimum severity: `none`.

Forgetting .where(eq(...)) on db.delete(table) or tx.delete(table) silently truncates the entire table in production.

Default parameters: `{}`.

**Repair:** Chain .where(eq(table.id, id)) onto db.delete(table) before awaiting or returning the query.

**Scope and limits:** Matches db.delete(...) and tx.delete(...) calls that are not wrapped in a .where(...) call within the same expression.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, SQL Delete (orm.drizzle.team)",
  "locator": "https://orm.drizzle.team/docs/delete",
  "paraphrase": "db.delete(table) without a .where(...) clause emits an unfiltered DELETE FROM table statement that removes every row."
}
```

### drizzle/DRIZ-UPDATE-001

Check: [`drizzle/queries/no-unbounded-update@1.0.0`](checks/queries/no-unbounded-update/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.unbounded-update`. Minimum severity: `none`.

Omitting .where(...) on db.update(table).set(...) overwrites columns across the entire table instead of the target record.

Default parameters: `{}`.

**Repair:** Chain .where(eq(table.id, id)) onto db.update(table).set(values).

**Scope and limits:** Matches db.update(...).set(...) and tx.update(...).set(...) chains that do not chain .where(...) in the same statement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, SQL Update (orm.drizzle.team)",
  "locator": "https://orm.drizzle.team/docs/update",
  "paraphrase": "db.update(table).set(values) without a .where(...) clause emits an unfiltered UPDATE statement across every row in the table."
}
```

## drizzle/schema

Manifest version: `1.1.0`. Status: **complete**.

### drizzle/DRIZ-TABLE-001

Check: [`drizzle/schema/no-table-without-primary-key@1.0.0`](checks/schema/no-table-without-primary-key/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.table-pk`. Minimum severity: `none`.

Without a primary key, two rows can share an id and no constraint stops them. Deletes and updates by id hit an arbitrary row.

Default parameters: `{}`.

**Repair:** Chain .primaryKey() onto the id column, or declare the composite key the domain needs.

**Scope and limits:** The rule recognizes text("id") and uuid("id") without primaryKey. serial("id") and integer("id") without primaryKey, and a key declared on a differently named column, are shapes this rule does not see.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, PostgreSQL table definition",
  "locator": "pgTable with primaryKey on the id column",
  "paraphrase": "Give every pgTable an explicit primary key on its id column. A text or uuid id without primaryKey is a heap with no identity: updates and deletes have no row to aim at."
}
```

### drizzle/DRIZ-TABLE-002

Check: [`drizzle/schema/no-integer-id-without-primary-key@1.0.0`](checks/schema/no-integer-id-without-primary-key/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.integer-id-pk`. Minimum severity: `none`.

An auto-incrementing id looks like an identity, but without a primary key nothing stops a manual insert or a restored backup from duplicating it, and updates by id can hit several rows.

Default parameters: `{}`.

**Repair:** Chain .primaryKey() onto the id column, as in integer().primaryKey().generatedAlwaysAsIdentity(), or declare the composite key in the table's third argument.

**Scope and limits:** unique() or generatedAlwaysAsIdentity() is not a primary key. The rule reads pgTable calls whose id column, named "id" or keyed id:, is serial, bigserial, smallserial, integer, bigint or smallint; any primaryKey in the table passes. text and uuid ids belong to DRIZ-TABLE-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, PostgreSQL column types and indexes & constraints",
  "locator": "serial, integer identity columns and primaryKey; https://orm.drizzle.team/docs/column-types/pg and https://orm.drizzle.team/docs/indexes-constraints#primary-key",
  "paraphrase": "Declare the primary key explicitly with .primaryKey() or a composite primaryKey(). serial and identity columns only generate values; neither adds a primary key constraint."
}
```

### drizzle/DRIZ-TZ-001

Check: [`drizzle/schema/no-timestamp-without-mode@1.0.0`](checks/schema/no-timestamp-without-mode/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.timestamp-mode`. Minimum severity: `none`.

A timestamp with no mode shifts by the session timezone on read or write. Events move by hours and nobody touched them.

Default parameters: `{}`.

**Repair:** Pass { mode: "date" } (or string/number), and add withTimezone: true when the instant must carry its zone.

**Scope and limits:** Other options such as precision or defaultNow do not satisfy the rule; only mode or withTimezone counts. date columns are a different type this rule does not see.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, timestamp column",
  "locator": "timestamp with the mode and withTimezone options",
  "paraphrase": "Declare how a timestamp crosses the boundary: mode date, string, or number, and withTimezone where the domain needs it. A bare timestamp leaves the driver to guess, and two drivers guess differently."
}
```

### drizzle/DRIZ-REL-002

Check: [`drizzle/schema/no-relation-without-fields@1.0.0`](checks/schema/no-relation-without-fields/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `drizzle.relation-fields`. Minimum severity: `none`.

A dangling relation compiles and fails at query time, or joins on a guess. The error arrives in production, not at definition.

Default parameters: `{}`.

**Repair:** Pass { fields: [...], references: [...] } to one(), or use many() when the other side needs no key.

**Scope and limits:** many() without fields passes: only one() needs the key pair. A fields array that names the wrong columns still passes; the rule checks presence, not correctness.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Drizzle ORM documentation, relations",
  "locator": "relations with one(), fields, and references",
  "paraphrase": "A one() relation must name its fields and references so the join has columns to use. one() with no fields, or with an empty config, declares a relation that points nowhere."
}
```
