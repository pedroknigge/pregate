# mongodb backlog

Judgment, server-side configuration, or checks the TS syntax tree cannot decide. Most need
a server-side language pack or preset knowledge (workload, topology, key policy) first.

## Value and flow limits

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate arbitrary
expressions, resolve imported values, or prove interprocedural data flow. The following
plausible evasions are backlog cases, not pass fixtures or claimed trap coverage.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| MONGO-FIND-001 | `const q = col.find(filter); ...; q.limit(n)` where the limit lands in another statement, or a helper that pages internally. | Same-cursor flow across statements; callee behavior. |
| MONGO-INJECT-001 | `col.find({ age: { $gt: req.query.age } })`, where an operator value (not `$where`/`$expr`) carries request input. | Value taint through operator objects; complements mass-assignment on writes. |
| MONGO-INJECT-001 | `col.find(buildFilter(req))`, where the helper returns `{ $where: ... }`. | Cross-function return-shape analysis. |
| MONGO-OBJECTID-001 | `new ObjectId(clean(req.params.id))`, where the helper validates but the rule cannot see it. | Callee trust; allowlist the validator by name in the preset. |
| MONGO-AGG-001 | `col.aggregate(pipeline)`, where `pipeline` is assembled in another module with a `$function` stage. | Imported-value and cross-file stage inspection. |
| MONGO-SCHEMA-001 | `new Schema(def, opts)`, where `opts` comes from a config module containing `strict: false`. | Imported-value evaluation. |
| MONGO-CONNECT-001 | A non-Mongo `.connect()` (e.g. another client) without those option names. | Library identity; the rule matches any `.connect(` call text. |
| MONGO-TX-001 | Manual `commitTransaction`/`abortTransaction` pairing done correctly in a helper. | Control-flow proof that every path commits or aborts. |
| MONGO-INDEX-001 | A migration runner that calls `createIndex` from a sanctioned migrations directory. | Path-scoped allowlisting; exclude `migrations/**` in the preset if that is the policy. |
| MONGO-UPDATE-001 | `const patch = { name }; users.updateOne(filter, patch)`, or a collection received as a function parameter (`(users: Collection) => users.updateOne(f, { name })`). | Same-file value evaluation and parameter types; only inline update objects on visible `.collection` receivers are read. |

## Server-side candidates (need a non-TS pack or human review)

- **`$jsonSchema` validation.** Enforcing validator documents on collections needs a server language (mongosh/mongoD config) the TS engine never parses.
- **Index selection.** Whether `{ email: 1 }` is the right index needs the workload's query shapes and cardinality, not syntax.
- **Replica-set transactions.** Multi-document `withTransaction()` only works against a replica set; topology is deployment fact, not code shape.
- **GridFS chunking.** Chunk size and file-vs-document policy need the payload sizes first.
- **Change-stream resume tokens.** Persisting and reusing resume tokens is lifecycle flow across restarts, not one statement.
- **Read/write concern policy.** `majority` vs `local` needs the durability budget per collection; presence of the option does not prove the level.
- **Connection-string secrets.** URIs with embedded credentials need secret-provenance tracking across config files.
- **Variable filter documents in deleteMany (`MONGO-DELETEMANY-001` limit).** `MONGO-DELETEMANY-001` denies `deleteMany()` and `deleteMany({})` where the first non-comment argument is an empty object literal. Passing a variable `deleteMany(filter)` whose runtime value is `{}` cannot be decided from syntax.
- **MongoDB file by import (`MONGO-CONNECT-001` and `MONGO-SCHEMA-001` limit).** Before pack 1.2.1 these rules matched every `.connect(` call and every `strict: false` pair in any file. Both findings on the public corpus were false: a Redis `db.connect()` and an `express.json({ strict: false })` option. `MONGO-CONNECT-001` now needs an import of `mongoose` or `mongodb`, and `MONGO-SCHEMA-001` an import of `mongoose`. A connection or schema made through a wrapper in a file with no such import is not matched. Another client's `connect()` in a file that also imports `mongodb` is still matched; patterns have no receiver types.
