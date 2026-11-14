# redis

TypeScript client-side Redis pack (node-redis / ioredis). Source version **1.2.1**, for engine **0.0.10**. The engine parses only TS/JS. Rules requiring key-lifetime intent or multi-statement tracking are off; naming conventions are advisory. Server-side policy (ACL users, persistence, eviction, cluster) needs the server config and lives in [BACKLOG.md](BACKLOG.md).

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `redis/REDIS-TTL-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `REDIS-TTL-001` | `set(` with no visible `EX`/`PX`/`EXAT`/`PXAT`/`KEEPTTL`/`NX`/`XX` arg. | Persistent keys are valid; `NX`/`XX` do not set an expiry. | off |
| `REDIS-KEY-001` | `set`/`get`/`del`/`expire`/`exists` on a Redis client receiver with a first arg string (or plain template) lacking a colon. | Key namespacing is a useful project convention. | warn |
| `REDIS-SCAN-001` | A `.keys(` call on a Redis client receiver, scoped or not. | KEYS blocks the single-threaded server while it walks the whole keyspace. | deny |
| `REDIS-DANGER-001` | `flushAll`/`flushDb` (either casing), `config`, `debug` in app code. | Flush/config/debug reshape or wipe the server from a request path. | deny |
| `REDIS-CONNECT-001` | `.on("error", () => {})` or the empty `function () {}` form. Shape mirrors `postgres/client/no-empty-pool-error-handler`. | An empty error handler swallows connection failures with no log or alert. | deny |
| `REDIS-PUBSUB-001` | `publish(` to a channel string (or plain template) lacking a colon. | Channel namespacing is a project convention. | warn |
| `REDIS-LUA-001` | Any `.eval(` call, including template-interpolated scripts. | `EVAL` can be used correctly with keys and arguments; this shape cannot judge it. | off |
| `REDIS-TX-001` | A `.multi(` statement with no `.exec(`/`.discard(` in the same statement. | A later statement may legitimately commit the transaction. | off |
| `REDIS-SUB-001` | `x.subscribe(`/`psubscribe(` plus a regular command (`get`, `set`, `publish`, ...) on the same `x` in a file importing `redis`/`ioredis`. | A subscribed connection rejects regular commands; pub/sub needs a dedicated connection. | warn |
| `REDIS-MGET-LOOP-001` | `await redis.get(...)` / `client.get(...)` / `cache.get(...)` inside a loop. | Serial `GET` calls pay a network round-trip per key instead of batching with `mget` or a pipeline. | warn |
| `REDIS-QUIT-001` | `redis.disconnect()` or `client.disconnect()` instead of graceful `quit()`. | `disconnect()` immediately destroys the socket and aborts in-flight commands. | warn |

## Methodologies

- `redis/client` — REDIS-CONNECT-001, REDIS-PUBSUB-001, REDIS-LUA-001, REDIS-TX-001, REDIS-SUB-001, REDIS-QUIT-001
- `redis/keys` — REDIS-KEY-001, REDIS-TTL-001, REDIS-NAMESPACE-001, REDIS-SCAN-001, REDIS-DANGER-001, REDIS-MGET-LOOP-001

`REDIS-NAMESPACE-001` and `REDIS-PUBSUB-001` both point at `redis/pubsub/no-publish-without-channel-ns`: the keys methodology reads it as the channel-namespace invariant, the client methodology as the delivery-contract invariant.

## Fixture coverage and limits

`pregate rules test packs/redis` runs **65** real fixtures. Every check has at least two pass fixtures, two fail fixtures, and one failing trap with exact lines: empty options objects, backtick keys/channels without colons, scoped-but-still-blocking KEYS, lowercase `flushdb`, the `function () {}` error handler, template-interpolated Lua, exec split across statements, and subscribe/get split across methods of one injected client. A Svelte store's `subscribe`/`set` is a pass guard for the subscriber rule.

`REDIS-KEY-001` and `REDIS-SCAN-001` match a call only on a Redis client receiver. A receiver is a Redis client when its name contains `redis` or `valkey`, or when it is named `client`, `cache`, `db`, `kv`, `store`, `pub`, `sub`, `publisher` or `subscriber` in a file that imports a module whose specifier contains `redis`, `valkey` or `@vercel/kv`. Pass fixtures hold the false positives measured on the public corpus: an Express `app.get("/x", handler)` route, `req.get("Referrer")`, `app.set("view engine", ...)`, `Object.keys(obj)`, and a `Map` beside a Redis client in one file. A client under another name, or one of the generic names in a file with no such import, is not matched.

Fixtures show syntax matches, not end-to-end behavior. `REDIS-TX-001` wrongly flags an ordinary split-statement `multi()`/`exec()` transaction, so it stays off. Value flow (imported keys, runtime TTLs) is backlog, not claimed coverage. Concrete uncaught cases are in [BACKLOG.md](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.1`. 11 distinct check IDs.

Methodologies: `redis/client` (complete), `redis/keys` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
