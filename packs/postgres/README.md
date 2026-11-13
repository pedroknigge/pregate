# postgres

TypeScript client-side pack for PostgreSQL access via node-postgres (`pg` / `pg-pool`), postgres.js, and compatible `.query` clients. Source version **1.2.0**, for engine **0.0.9**. TypeScript client only: the engine parses TS/JS, so server-side SQL rules (RLS policies, index selection, migrations) wait for a SQL grammar and live in BACKLOG.md until then.

Relation to `vibe-proof/security/sql-interpolation`: that rule matches template `${}` inside `.(query|execute|raw|unsafe)(`, so it already fires on `pool.query`/`` ` `` `` `client.query` templates. This pack does not duplicate it. PG-CONCAT-001 complements it by catching `+` string concatenation in query arguments, which the template-only shape misses; its template arm is a second spelling of the same concat family.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `postgres/PG-POOL-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `PG-POOL-001` | `new Client(` anywhere. | A standalone Client is valid for one-off scripts; syntax cannot prove a per-request leak. | off |
| `PG-ERROR-001` | `pool.on("error", () => {})` or `function () {}` with an empty body. | Swallowed pool errors hide dead connections until queries fail. | deny |
| `PG-TX-001` | `pool.query("BEGIN")` in any quote style. | Pool calls can land on different backends; transactions need one dedicated client. | deny |
| `PG-SLEEP-001` | `pg_sleep(` inside a `.query(` call. | It parks a pooled connection for the whole delay. | deny |
| `PG-ROWS-001` | Chained reads off `rows[0]` (`rows[0].field`). | An empty result makes `rows[0]` undefined and the read throws. | deny |
| `PG-RELEASE-001` | `const c = await pool.connect()` with no `c.release` or `return c` in the file. | An unreleased client leaks a pool slot; an empty pool makes every checkout wait forever. | warn |
| `PG-CONCAT-001` | `+`, `+=` or `${}` in the first SQL argument of `.query(`, or in the `text` field of a config object (also through ternaries and `??`/`\|\|`/`&&` fallbacks). | Concatenated values are parsed as SQL: injection. Complements VP-SQL. | deny |
| `PG-SSL-001` | `ssl: false`, `rejectUnauthorized: false`, `sslmode=disable`. | Cleartext or MITM-able database link exposes credentials and rows. | deny |
| `PG-TIMEOUT-001` | `new Pool(` with no `statement_timeout`, `idleTimeoutMillis`, or `query_timeout`. | One runaway query can hold a connection forever and starve the pool. | deny |
| `PG-IDENT-001` | A `$n` placeholder after `FROM`, `INSERT INTO`, `UPDATE`, `JOIN`, `TABLE`, `ORDER BY` or `GROUP BY` in `.query(` text. | Parameters carry values, not identifiers: the query fails, or `ORDER BY $1` silently does not sort. | deny |
| `PG-TX-ROLLBACK-001` | A `try` block running `client.query('BEGIN')` without a `catch` block running `client.query('ROLLBACK')`. | Releasing a pooled client without `ROLLBACK` leaves the connection in an aborted transaction state for the next request. | deny |

## Methodologies

- `postgres/client` — PG-POOL-001, PG-ERROR-001, PG-TX-001, PG-SLEEP-001, PG-ROWS-001, PG-RELEASE-001, PG-TX-ROLLBACK-001
- `postgres/safety` — PG-CONCAT-001, PG-SSL-001, PG-TIMEOUT-001, PG-IDENT-001

## Fixture coverage and limits

`pregate rules test packs/postgres` runs **57** real fixtures. Every check has at least
two pass, two fail, and one failing trap with exact lines: the exported singleton
Client, the `function () {}` error handler, the backtick BEGIN, the parameterized
`pg_sleep` template, the `${rows[0].field}` template, the backtick query
template, the `?sslmode=disable` URL, the sized-but-timeout-less pool, the
committed-but-unreleased client, and `ORDER BY $1`.
Guarded rows, optional chaining, placeholder params, verified TLS, timed
pools, `finally` releases, returned clients and value placeholders after
`EXTRACT(... FROM` are pass guards.

The rules stay inside decidable syntax: transaction safety is scoped to
`pool.query("BEGIN")` (other receiver names are missed), the empty-handler rule
only sees literally empty callbacks, and the concat rule flags any `+` in query
arguments including arithmetic inside the params array. [node-postgres documents both `Client` and `Pool`](https://node-postgres.com/features/connecting), so PG-POOL-001 is off. Concrete uncaught cases
and the reason for each limit are in [BACKLOG.md](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 11 distinct check IDs.

Methodologies: `postgres/client` (complete), `postgres/safety` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
