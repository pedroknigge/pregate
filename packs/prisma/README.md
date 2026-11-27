# prisma

Prisma client invariants that the syntax tree can decide. The stance of this pack is: raw SQL only through the parameterizing template forms; never load a full relation with `: true`; every findFirst names its winner with orderBy; bulk writes always carry a where filter; route handlers share one client; and query text never reaches the logs. This pack enforces TypeScript client usage only — `.prisma` schema files have no grammar, so schema-level rules live in `BACKLOG.md`.

This pack complements `vibe-proof`: VP-SQL-001 misses `$queryRaw` / `$executeRaw` shapes and VP-FIND-MANY-001 covers unbounded findMany, so this pack closes the Unsafe hole, the concat hole, and the nondeterministic findFirst instead of duplicating them.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `prisma/PRISMA-RAW-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `PRISMA-RAW-001` | `$queryRawUnsafe` / `$executeRawUnsafe` calls, which never parameterize. | An Unsafe call concatenates caller input straight into SQL. | deny |
| `PRISMA-SQL-001` | `$queryRaw` / `$executeRaw` with string concatenation (`+`) in the arguments. | Concatenation bypasses the parameterization the template form would apply. | deny |
| `PRISMA-RAW-002` | `Prisma.raw` whose first argument is a template with `${}` or a `+` concatenation. | `Prisma.raw` text is SQL syntax; the docs list interpolated `Prisma.raw` as injectable. | deny |
| `PRISMA-SELECT-001` | `include: { <relation>: true }`, loading a full relation without a nested select. | A full-relation include pulls every column of every related row. | deny |
| `PRISMA-TAKE-001` | `findFirst` / `findFirstOrThrow` with no `orderBy`. | Without an order the picked row is nondeterministic. | deny |
| `PRISMA-DELETE-001` | `deleteMany` with no `where` in the call. | A missing filter turns a scoped cleanup into a table wipe. | deny |
| `PRISMA-UPSERT-001` | `updateMany` with no `where` in the call. | A data-only call rewrites the column on every row. | deny |
| `PRISMA-TXCLIENT-001` | A model or raw query on the outer client inside an interactive `$transaction` callback. | Only queries on the callback's `tx` run in the transaction; the others commit on their own. | warn |
| `PRISMA-CONNECT-001` | `new PrismaClient()` inside route and API handler files. | A fresh client per request exhausts database connections. On Prisma ORM 7 the shared client takes a driver adapter. | deny |
| `PRISMA-LOG-001` | `new PrismaClient()` with a `query` log level. | Query logs carry SQL and bind parameters into log storage. | deny |
| `PRISMA-EMPTY-WHERE-001` | `.deleteMany({ where: {} })` or `.updateMany({ where: {}, ... })` with an empty `where` object. | An empty `where: {}` filter matches every row in the table just like omitting `where`. | deny |
| `PRISMA-MIDDLEWARE-001` | `prisma.$use(...)` on Prisma ORM 7, including a computed `prisma["$use"]` call. | Prisma ORM 7 removed client middleware. Client extensions replace it. | deny |
| `PRISMA-VALIDATOR-001` | `Prisma.validator(...)` on Prisma ORM 7. | The default `prisma-client` generator has no `Prisma.validator`. `satisfies` replaces it. | warn |
| `PRISMA-ADAPTER-001` | `new PrismaClient()` on Prisma ORM 7 with no `adapter` and no `accelerateUrl`. | SQL clients need a driver adapter. Accelerate passes `accelerateUrl` instead. `datasources` and `datasourceUrl` were removed. | warn |

## Prisma ORM 7

`PRISMA-MIDDLEWARE-001`, `PRISMA-VALIDATOR-001`, and `PRISMA-ADAPTER-001` stay quiet unless the project is on Prisma ORM 7 or newer. The check reads the nearest `package.json` that declares `@prisma/client`, and falls through to `prisma` only when the client package is absent. A parsed lower bound below `7.0.0`, including `^6.19.0`, wins over a newer install hoisted for a sibling, so a Prisma 6 package is not denied. An installed copy under `node_modules` is what actually runs: `^7.0.0` with `@prisma/client` `6.19.0` installed stays quiet, and `workspace:*` counts only when that installed copy is `7.0.0` or newer. No manifest and no install stays quiet.

`PRISMA-VALIDATOR-001` is a warning because the removal is confirmed for the default `prisma-client` generator. The deprecated `prisma-client-js` generator still provides `Prisma.validator`, and this pack cannot see the generator.

`PRISMA-TXCLIENT-001` cites the Prisma ORM 7 interactive-transactions page. The Prisma ORM 8 transactions page says: "Prisma ORM 8 has no `$transaction`, so both of the Prisma ORM 7 forms become `db.transaction(async (tx) => ...)`." ([Transactions, Coming from Prisma ORM 7](https://www.prisma.io/docs/orm/v8/fundamentals/transactions)). Prisma ORM 8 is still a release candidate ([changelog, 2026-10-02](https://www.prisma.io/changelog/2026-10-02)). Follow-up rules for that client are listed in `BACKLOG.md` and are not part of this pack.

## Methodologies

- `prisma/client` — PRISMA-RAW-001, PRISMA-SQL-001, PRISMA-RAW-002, PRISMA-SELECT-001, PRISMA-TAKE-001, PRISMA-CONNECT-001, PRISMA-LOG-001, PRISMA-MIDDLEWARE-001, PRISMA-VALIDATOR-001, PRISMA-ADAPTER-001
- `prisma/writes` — PRISMA-DELETE-001, PRISMA-UPSERT-001, PRISMA-TXCLIENT-001, PRISMA-EMPTY-WHERE-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.3.0`. 14 distinct check IDs.

Methodologies: `prisma/client` (preview), `prisma/writes` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
