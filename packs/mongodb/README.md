# mongodb

TypeScript client-side MongoDB driver/mongoose rules. Source version **1.2.1**, for engine **0.0.7**.
The engine parses TS/JS only: this pack enforces client-side usage (queries, ObjectIds,
connections, sessions, schema options). Everything the engine cannot see — index selection,
`$jsonSchema` validation, replica-set topology, GridFS chunking, change-stream resume
tokens — lives in [BACKLOG.md](BACKLOG.md).

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `mongodb/MONGO-FIND-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `MONGO-FIND-001` | `find()` with no `.limit()` in the same statement. | One request can stream the whole collection. | deny |
| `MONGO-INJECT-001` | `$where`/`$expr` query objects built from `req.*` input. | Request-controlled expressions escape field comparison. | deny |
| `MONGO-OBJECTID-001` | `new ObjectId(req.*)` without an `isValid` guard on a local. | Garbage ids throw instead of returning 400s. | deny |
| `MONGO-AGG-001` | `aggregate()` stages using `$where`/`$function`/`$accumulator`. | Server-side JavaScript runs per document with server privileges. | deny |
| `MONGO-UPDATE-001` | Driver `updateOne`/`updateMany`/`findOneAndUpdate` whose update object has no `$` operator. | The driver throws "Update document requires atomic operators"; the write never runs. | deny |
| `MONGO-SCHEMA-001` | `strict: false` in an options object, in a file that imports `mongoose`. | Undeclared paths persist silently. | deny |
| `MONGO-CONNECT-001` | `.connect()` without `maxPoolSize`/`serverSelectionTimeoutMS`, in a file that imports `mongoose` or `mongodb`. | Default pool/timeout hangs or overloads under load. | deny |
| `MONGO-TX-001` | Raw `startTransaction()` instead of `withTransaction()`. | Open transactions hold locks without auto commit/abort/retry. | deny |
| `MONGO-INDEX-001` | `createIndex`/`ensureIndex`/`createIndexes` calls in app code. | Index builds belong in schemas or migrations, not request paths. | deny |
| `MONGO-DELETEMANY-001` | `deleteMany()` or `deleteMany({})` with an omitted or empty filter document. | An empty filter matches and deletes every document in the collection. | deny |

## Methodologies

- `mongodb/models` — MONGO-SCHEMA-001, MONGO-CONNECT-001, MONGO-TX-001, MONGO-INDEX-001
- `mongodb/queries` — MONGO-FIND-001, MONGO-INJECT-001, MONGO-OBJECTID-001, MONGO-AGG-001, MONGO-UPDATE-001, MONGO-DELETEMANY-001

## Fixture coverage and limits

`pregate rules test packs/mongodb` runs **53** real fixtures (at least 2 pass, 2 fail, 1 trap per check).
Every check has a failing trap with exact lines: sort-without-limit, `$expr` equality over
request input, bracket query-id access, `$function` stages, multi-option `strict: false`,
empty connect options, aliased sessions, `db.collection()` index builds, and a plain
update through a Mongoose model's raw `Model.collection`.

MONGO-INJECT-001 complements `vibe-proof/security/mass-assignment` (which guards
`insert`/`update`/`create`/`save(req.body)`): that rule owns the write call, this one owns
operator expressions (`$where`/`$expr`) built from request input. Query-operator injection
through `$gt`/`$ne`/`$regex` values needs taint flow the syntax tree cannot prove; those
cases are backlog, not claimed coverage (see [BACKLOG.md](BACKLOG.md)).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.1`. 10 distinct check IDs.

Methodologies: `mongodb/models` (complete), `mongodb/queries` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
