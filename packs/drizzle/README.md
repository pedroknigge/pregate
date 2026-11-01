# drizzle

Optional Drizzle syntax and data-layer policies: raw SQL construction, raw strings in `where`, result cardinality, queries in loops, runtime DDL and schema/relationship declarations. These checks are not complete SQL or resource-cost proof. Running-database assertions, migration history and project-specific guarantees need explicit evidence.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `drizzle/DRIZ-RAW-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `DRIZ-RAW-001` | `db.execute` with a `+` next to a quote, or any `sql.raw(` call. | A value concatenated into SQL is syntax to the database; `sql.raw` splices text straight into the statement. | deny |
| `DRIZ-SQL-001` | `.where(` whose first argument is a string or template literal instead of an `eq`/`and`/`or` helper. | A raw string in `where` bypasses the builder and reaches SQL as written. (`sql`` itself parameterizes `${}`, so it passes.) | deny |
| `DRIZ-LIMIT-001` | A literal select/from chain without a result bound from limit/get or proved schema/input cardinality. | Optional policy for reviewed bounded-read paths; another query's limit/get and column names do not establish a bound. | deny |
| `DRIZ-REL-001` | An awaited `db.` call inside `for`, `for-in/of`, or `while`. | A query per iteration turns one round trip into N and drains the pool. | deny |
| `DRIZ-MIG-001` | `db.execute` whose arguments mention `CREATE`, `DROP`, `ALTER`, or `TRUNCATE` (any case). | Runtime DDL changes the schema outside the migration history, with no review and no down path. | deny |
| `DRIZ-TX-001` | A query on the outer `db` inside a `db.transaction(async (tx) => ...)` callback. | Only statements on `tx` run in the transaction; the others commit on their own and survive a rollback. | warn |
| `DRIZ-TABLE-001` | `pgTable` with a `text("id")` or `uuid("id")` column and no `primaryKey`. | Without a primary key two rows can share an id and updates by id hit an arbitrary row. | deny |
| `DRIZ-TABLE-002` | `pgTable` with a serial or integer-family `id` column and no `primaryKey`. | Serial and identity columns generate values but add no primary key constraint. | warn |
| `DRIZ-TZ-001` | `pgTable` with a `timestamp(` column and no `mode` or `withTimezone`. | A bare timestamp leaves the timezone to the driver, and events shift by hours. | deny |
| `DRIZ-REL-002` | `relations` with `one(` but no `fields`. | A `one()` with no fields and references points nowhere and fails at query time. | deny |
| `DRIZ-DELETE-001` | `db.delete(table)` or `tx.delete(table)` without a chained `.where(...)`. | Emits an unfiltered `DELETE FROM table` that wipes every row. | deny |
| `DRIZ-UPDATE-001` | `db.update(table).set(...)` or `tx.update(table).set(...)` without a chained `.where(...)`. | Emits an unfiltered `UPDATE table SET ...` that overwrites every row in the table. | deny |

## Methodologies

- `drizzle/queries` — DRIZ-RAW-001, DRIZ-SQL-001, DRIZ-LIMIT-001, DRIZ-REL-001, DRIZ-MIG-001, DRIZ-TX-001, DRIZ-DELETE-001, DRIZ-UPDATE-001
- `drizzle/schema` — DRIZ-TABLE-001, DRIZ-TABLE-002, DRIZ-TZ-001, DRIZ-REL-002

Non-decidable practices from the same sources are in `BACKLOG.md`.

Source 1.3.0 preserves Buffer.from(), query text and terminal single-row get().
The bounded-select primitive resolves current imported Drizzle schema sources,
including static reexports and TypeScript aliases. Predicates must cover an
actual declared primary/unique key, including composite keys. Partial and
functional unique indexes remain unproved. A joined table must be reached through
a proved unique key to preserve the result bound; amplifying joins and unions
still report. Column names such as id or slug provide no evidence.

For inArray, a fixed list proves a finite input budget. Array-typed parameters
can use a literal slice(0, n) or a preceding rejecting length guard in the same
function; intervening calls/writes and mutable initializer flows remain unproved.
Unknown validators, split query construction, schema wrappers, aggregates and
database migration state need project assertions. The policy proves modeled
result cardinality, not database execution cost or deployed schema integrity.
The issue controls
record the original reported cases. See [Drizzle select](https://orm.drizzle.team/docs/select)
and [invariant enforcement](../../docs/guides/invariant-enforcement.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.3.0`. 12 distinct check IDs.

Methodologies: `drizzle/queries` (complete), `drizzle/schema` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
