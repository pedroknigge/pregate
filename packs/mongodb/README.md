# mongodb

TypeScript client-side MongoDB driver/mongoose rules. Source version **1.3.1**, for engine **0.0.20**.
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
| `MONGO-OIDC-001` | `MongoClient` options or a connection string that combine `ENVIRONMENT` with `OIDC_CALLBACK` or `OIDC_HUMAN_CALLBACK`. | That pair leaks an OIDC bearer token to a domain outside the allowlist on driver versions before 7.9.0. | deny |
| `MONGO-OIDC-002` | `package.json` or a lockfile pins `mongodb` at >=6.7.0 and <7.9.1. | The pin can still install a driver that writes connection-string credentials into errors and logs, and that accepts a NUL in SASL PLAIN. | warn |
| `MONGO-DELETEMANY-001` | `deleteMany()` or `deleteMany({})` with an omitted or empty filter document. | An empty filter matches and deletes every document in the collection. | deny |

## Methodologies

- `mongodb/models` — MONGO-SCHEMA-001, MONGO-CONNECT-001, MONGO-TX-001, MONGO-INDEX-001, MONGO-OIDC-001, MONGO-OIDC-002
- `mongodb/queries` — MONGO-FIND-001, MONGO-INJECT-001, MONGO-OBJECTID-001, MONGO-AGG-001, MONGO-UPDATE-001, MONGO-DELETEMANY-001

## Driver 7.9.1

These notes follow the [7.9.1 release](https://github.com/mongodb/node-mongodb-native/releases/tag/v7.9.1). The [7.9.0 notes](#driver-790) below still describe `dropIndexes`, `createIndex`, and the mixed-OIDC deny.

`MONGO-OIDC-002` warns when a manifest or lockfile pins `mongodb` at >=6.7.0 and <7.9.1, and it recommends >=7.9.1. A pin of 7.9.0 is inside that window. The release says versions before 7.9.1 let a NUL in `PLAIN` credentials change the identity the server authenticates ([CVE-2026-129929](https://github.com/mongodb/node-mongodb-native/security/advisories/GHSA-prmg-mvj2-c4f7), NODE-7828). It also says versions from 4.0.0 before 7.9.1 can place connection-string values, including credentials, in errors and in logged representations of the client ([CVE-2026-129930](https://github.com/mongodb/node-mongodb-native/security/advisories/GHSA-779g-w5r4-wr2x), NODE-7799). A pin below 6.7.0 stays quiet on this rule even when those CVEs apply. `MONGO-OIDC-001` still repairs with one mechanism and mongodb >=7.9.0, the release that throws on the mixed OIDC pair.

## Driver 7.9.0

These notes follow the [7.9.0 release](https://github.com/mongodb/node-mongodb-native/releases/tag/v7.9.0) and [HISTORY.md](https://github.com/mongodb/node-mongodb-native/blob/master/HISTORY.md). Index builds on a request path stay denied.

`dropIndexes` used to swallow almost every error. As of 7.9.0 (NODE-6517) it only swallows `NamespaceNotFound`. Every other error is thrown.

`createIndex` overloads, after 7.8.0 split index options from command options (NODE-6893) and 7.9.0 corrected the deprecation (NODE-7968):

- `createIndex(keys)` is not deprecated.
- `createIndex(keys, mixedIndexAndCommandOptions)` stays deprecated and will be removed in a future major.
- `createIndex(keys, indexOptions, commandOptions)` is the new form and is not deprecated.

`MONGO-INDEX-001` still denies `createIndex`, `ensureIndex`, and `createIndexes` in application code. A migration that must pass command options uses the three-argument form.

The same release stops forcing `autoSelectFamily: true` when the option is unset, so Node's process default applies. `SelectServerOptions` is deprecated. The pack records both as driver behavior.

`MONGO-OIDC-001` denies a visible `ENVIRONMENT` plus `OIDC_CALLBACK` or `OIDC_HUMAN_CALLBACK` on one `MongoClient` or `MongoClient.connect` call. The release names both callbacks. A callback-only call and an environment-only call are each one mechanism. Use one mechanism only and mongodb >=7.9.0. A URI kept in a variable is not a visible `ENVIRONMENT`. The driver pin floor is 7.9.1; see [Driver 7.9.1](#driver-791).

## Fixture coverage and limits

`pregate rules test packs/mongodb` runs **66** real fixtures (at least 2 pass, 2 fail, 1 trap per check).
Every check has a failing trap with exact lines: sort-without-limit, `$expr` equality over
request input, bracket query-id access, `$function` stages, multi-option `strict: false`,
empty connect options, aliased sessions, `db.collection()` index builds, a plain
update through a Mongoose model's raw `Model.collection`, a connection string that
carries `ENVIRONMENT` beside a callback, and a nested 7.9.0 pin under a 7.9.1 root.

MONGO-INJECT-001 complements `vibe-proof/security/mass-assignment` (which guards
`insert`/`update`/`create`/`save(req.body)`): that rule owns the write call, this one owns
operator expressions (`$where`/`$expr`) built from request input. Query-operator injection
through `$gt`/`$ne`/`$regex` values needs taint flow the syntax tree cannot prove; those
cases are backlog, not claimed coverage (see [BACKLOG.md](BACKLOG.md)).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.3.1`. 12 distinct check IDs.

Methodologies: `mongodb/models` (preview), `mongodb/queries` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
