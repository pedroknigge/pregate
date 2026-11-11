# mongodb pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## mongodb/models

Manifest version: `1.0.1`. Status: **complete**.

### mongodb/MONGO-SCHEMA-001

Check: [`mongodb/models/no-schema-any@1.0.1`](checks/models/no-schema-any/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.models.schema-strict`. Minimum severity: `none`.

A non-strict schema stores whatever the client sends, so typos and injected fields persist without an error.

Default parameters: `{}`.

**Repair:** Declare the paths on the schema, or use strict: "throw" so undeclared paths fail loudly instead of persisting.

**Scope and limits:** Extra options beside strict do not cancel it. The file must import mongoose; strict: false in a body-parser or other options object in a file with no such import is not matched. This rule complements mass-assignment: that one guards the write call, this one guards the schema.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Mongoose guide (Strict mode)",
  "locator": "strict option on schemas",
  "paraphrase": "With strict: false, paths not in the schema are stored silently. The default keeps undeclared paths out of the database."
}
```

### mongodb/MONGO-CONNECT-001

Check: [`mongodb/models/no-connect-without-options@1.0.1`](checks/models/no-connect-without-options/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.models.connect-options`. Minimum severity: `none`.

Default pool and timeout settings hang or overload under load instead of failing fast with a tuned budget.

Default parameters: `{}`.

**Repair:** Pass maxPoolSize and serverSelectionTimeoutMS in the connect() options for the workload this service runs.

**Scope and limits:** An empty options object sets nothing. Unrelated options such as dbName do not satisfy this rule. The file must import mongoose or mongodb. A connect call on a Redis or other client in a file with no such import is not matched. Any other connect call in a file that does import one is still matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Node.js driver docs (Connection pooling and server selection)",
  "locator": "maxPoolSize and serverSelectionTimeoutMS options",
  "paraphrase": "A bare connect() inherits the default pool size and waits the default timeout before failing over. Name both explicitly."
}
```

### mongodb/MONGO-TX-001

Check: [`mongodb/models/no-transaction-without-session@1.0.0`](checks/models/no-transaction-without-session/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.models.raw-transaction`. Minimum severity: `none`.

A raw transaction that throws mid-way stays open until it times out, holding locks and a session slot.

Default parameters: `{}`.

**Repair:** Run the writes inside session.withTransaction() so commit, abort, and transient-error retry are automatic.

**Scope and limits:** Renaming the session (sess) does not change the call. Passing { session } to a write outside withTransaction is still manual.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Manual (Transactions: withTransaction)",
  "locator": "withTransaction() retry, commit, and abort behavior",
  "paraphrase": "withTransaction() retries the body on transient errors and always commits or aborts. A raw startTransaction() leaves that to the caller."
}
```

### mongodb/MONGO-INDEX-001

Check: [`mongodb/models/no-index-in-code@1.0.0`](checks/models/no-index-in-code/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.models.index-in-code`. Minimum severity: `none`.

An index built from a request path runs at request time, blocking or slowing the collection it is supposed to speed up.

Default parameters: `{}`.

**Repair:** Declare the index with schema.index() (Mongoose) or in a migration script that runs outside request handling.

**Scope and limits:** Reaching the collection through db.collection() does not move the build out of code. ensureIndex() is the same call under an older name.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Manual (Index builds on populated collections)",
  "locator": "index build cost and foreground behavior",
  "paraphrase": "Building an index scans the collection and competes with traffic. Declare indexes with the schema or a migration, not inline."
}
```

## mongodb/queries

Manifest version: `1.2.0`. Status: **complete**.

### mongodb/MONGO-FIND-001

Check: [`mongodb/queries/no-unbounded-find@1.0.0`](checks/queries/no-unbounded-find/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.queries.unbounded-find`. Minimum severity: `none`.

An unbounded find streams the whole match set into memory, so one request can exhaust the server and the client.

Default parameters: `{}`.

**Repair:** Chain .limit(n) in the same statement as .find(), or use a paginated query with an explicit page size.

**Scope and limits:** Sorting without a limit only orders the rows; it does not bound them. findOne() is already bounded and needs no limit.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Manual (Cursors: limit and batch size)",
  "locator": "cursor.limit() and find() behavior",
  "paraphrase": "A find without limit returns every matching document. Cap the result with limit() before materializing it."
}
```

### mongodb/MONGO-INJECT-001

Check: [`mongodb/queries/no-nosql-injection@1.0.0`](checks/queries/no-nosql-injection/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.queries.nosql-injection`. Minimum severity: `none`.

Request-controlled expressions escape field comparison and run attacker-shaped logic inside the query.

Default parameters: `{}`.

**Repair:** Compare request values against named fields with plain equality, and allowlist any operator the client may choose.

**Scope and limits:** $expr with $eq looks declarative but still evaluates request input. Plain field equality with request values stays allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Manual ($where query operator)",
  "locator": "$where and $expr evaluate expressions per document",
  "paraphrase": "$where runs JavaScript per document and $expr evaluates an expression tree. Neither should be built from request input."
}
```

### mongodb/MONGO-OBJECTID-001

Check: [`mongodb/queries/no-unvalidated-objectid@1.0.0`](checks/queries/no-unvalidated-objectid/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.queries.unvalidated-objectid`. Minimum severity: `none`.

Building an ObjectId straight from request input turns garbage ids into unhandled throws instead of 400s.

Default parameters: `{}`.

**Repair:** Copy the input to a local, reject it when ObjectId.isValid() is false, then construct the ObjectId from the local.

**Scope and limits:** Bracket access (req.query["id"]) reads the same request input and throws the same way. Validating the local covers both.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Node.js driver API (ObjectId)",
  "locator": "ObjectId constructor and ObjectId.isValid()",
  "paraphrase": "The ObjectId constructor throws on values that are not 12 bytes or 24 hex characters. Validate with ObjectId.isValid() first."
}
```

### mongodb/MONGO-AGG-001

Check: [`mongodb/queries/no-unsafe-aggregation@1.0.0`](checks/queries/no-unsafe-aggregation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.queries.unsafe-aggregation`. Minimum severity: `none`.

Server-side JavaScript in a pipeline runs per document with the server's privileges and defeats operator-level optimization.

Default parameters: `{}`.

**Repair:** Rewrite the stage with declarative operators ($match, $group, $project, $addFields) instead of embedded functions.

**Scope and limits:** $function nested inside $project is the same server-side JavaScript, not a safe projection.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Manual ($function and $accumulator aggregation operators)",
  "locator": "server-side JavaScript in aggregation stages",
  "paraphrase": "$where, $function, and $accumulator execute JavaScript on the server for the documents they visit."
}
```

### mongodb/MONGO-UPDATE-001

Check: [`mongodb/queries/no-update-without-operator@1.0.0`](checks/queries/no-update-without-operator/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.update-operators`. Minimum severity: `none`.

A plain field object passed as the update throws MongoInvalidArgumentError ("Update document requires atomic operators") on every call, so the write never happens.

Default parameters: `{}`.

**Repair:** Wrap the fields in $set, or use another operator such as $inc or $unset. Use an update pipeline array for computed fields, and replaceOne to replace the whole document.

**Scope and limits:** Model.collection is the raw driver collection; it skips Mongoose's automatic $set cast. Mongoose Model.updateOne(filter, { name }) passes because Mongoose adds $set. The rule reads driver receivers: .collection(...), .collection, or a const bound to .collection(...) in the same file. An update object built in a variable, or one starting with a spread, is not judged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Manual (db.collection.updateOne and updateMany) and MongoDB Node.js driver",
  "locator": "update parameter: update operator expressions or an aggregation pipeline; https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/",
  "paraphrase": "The update argument holds only update operator expressions such as $set, or an aggregation pipeline. Replacing the whole document is replaceOne's job. The Node.js driver rejects an update document with no operators."
}
```

### mongodb/MONGO-DELETEMANY-001

Check: [`mongodb/queries/no-empty-deletemany@1.0.0`](checks/queries/no-empty-deletemany/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mongodb.empty-deletemany`. Minimum severity: `none`.

Calling collection.deleteMany({}) or Model.deleteMany() in application code drops every document in the collection in a single command.

Default parameters: `{}`.

**Repair:** Pass a non-empty filter document such as { tenantId, expiredAt: { $lt: now } } to deleteMany.

**Scope and limits:** Matches literal deleteMany() and deleteMany({}) calls (including with a second options argument). Dynamic filter variables are not evaluated.

**Interactions when active together:**

- Duplicates `prisma/PRISMA-DELETE-001`: A bare .deleteMany() or .deleteMany({}) call has no where property and an empty filter, so both rules report it when both packs are active. Settle: Keep both. Passing a non-empty filter (or a where clause in Prisma) satisfies both; disable the pack for the database you do not use in that module.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MongoDB Manual, db.collection.deleteMany() (mongodb.com)",
  "locator": "https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteMany/",
  "paraphrase": "Passing an empty filter document {} to deleteMany matches and removes every document in the collection."
}
```
