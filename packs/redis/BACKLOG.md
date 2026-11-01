# redis backlog

Judgment, server config, or checks the TS syntax tree cannot decide. Most need
the server configuration or workload knowledge; the rest need value flow the
closed pattern vocabulary cannot prove.

## Value and provenance limits

The closed pattern vocabulary inspects syntax in one file. It cannot evaluate
arbitrary expressions, resolve imported values, or prove interprocedural data flow.
The following plausible evasions therefore stay out of these rules. They are
backlog cases, not pass fixtures or claimed trap coverage.

| Rule | Uncaught flow | Missing capability |
| --- | --- | --- |
| REDIS-TTL-001 | `redis.set(key, value, opts)` where an imported `opts` carries `EX`. | Imported-value evaluation; only a visible expiry token in the call counts. |
| REDIS-TTL-001 | A wrapper `save(key, value)` that adds `{ EX }` before calling `set`. | Parameter taint and wrapper call graphs. |
| REDIS-KEY-001 | `redis.get(fullKey)` where `fullKey` was built with a namespace in another module. | Cross-file value propagation. |
| REDIS-KEY-001 | `redis.get(prefix + id)` split concatenation without a visible colon. | Constant evaluation of string expressions. |
| REDIS-SCAN-001 | `client.keys` passed as a callback or invoked via bracket access `client"keys"`. | Receiver alias and bracket-call resolution. |
| REDIS-DANGER-001 | `admin.flushall()` on a wrapped client that forwards to Redis. | Receiver aliases through wrappers. |
| REDIS-CONNECT-001 | `client.on("error", report)` where `report` is an empty imported function. | Imported-function body inspection. |
| REDIS-PUBSUB-001 | `redis.publish(channel, msg)` where `channel` is a namespaced imported constant. | Imported-value evaluation. |
| REDIS-LUA-001 | `client.eval` aliased to a local name before the call. | Local method alias tracking. |
| REDIS-TX-001 | `multi()` queued in one statement and `exec()` in a later statement (the documented trap). | Multi-statement queue-state flow; only same-statement chains are covered. |
| REDIS-SUB-001 | `const sub = client; sub.subscribe(...); client.set(...)`, a subscriber created in another module, or commands issued only after `unsubscribe()` returned the connection to normal mode. | Receiver alias tracking, cross-file identity and subscription-state flow; the rule compares receiver text in one file. |

Current coverage catches literal keys, channels, and options, both quote styles,
plain backtick templates, both `flushDb` casings, arrow and `function` empty
handlers, direct and interpolated `eval`, and bare plus assigned `multi()` without
a same-statement close. Alias matching is deliberately not attempted for client
methods: a shadowed or wrapped receiver is outside the single-file contract.

## Server-side candidates

These need the server configuration, the workload, or operational judgment, so
they are backlog until a Redis server-config source exists:

- **Key eviction policy.** `maxmemory-policy` (noeviction vs allkeys-lru vs volatile-ttl) decides what dies under pressure. Needs the server config, not client syntax.
- **ACL users.** Least-privilege Redis users per service (no default-user with `+@all`). Needs the ACL file and the deployment's user map.
- **Persistence (RDB/AOF).** `save` points, `appendonly`, and fsync policy trade durability against latency. Needs the server config and the workload's loss budget.
- **Cluster hash tags.** `{tag}` placement for multi-key Lua and MULTI across slots needs the workload's key layout; a tag rule without the layout is a guess.
- **Stream consumer groups.** XREADGROUP pending-ack flow, claim of idle messages, and group creation are product flow, not syntax; presence of a call does not prove the group drains.
- **Memory limits.** `maxmemory` sizing and big-key discipline need production sizes; a client rule cannot weigh a value.

## Client judgment calls

- **Reconnect strategy.** Backoff caps and retry budgets are numeric policy, not shapes; any literal threshold would be arbitrary.
- **Connection pool sizing.** One shared client vs per-request clients depends on the runtime; import counting does not prove a leak.
- **Pub/sub reconnection.** Re-subscribe after reconnect is flow across events, not one call site.
- **Pipeline vs MULTI.** Batching advice depends on whether atomicity is required; only the author knows.
- **Promise.all map reads (`REDIS-MGET-LOOP-001` limit).** `REDIS-MGET-LOOP-001` flags `await redis.get()` inside `for`, `for-in/of`, `while`, and `do` loops. Concurrent fan-out via `Promise.all(keys.map(k => redis.get(k)))` still sends N commands instead of `MGET` and is a candidate for callback-pattern expansion.
- **Custom client receiver names (`REDIS-QUIT-001` limit).** `REDIS-QUIT-001` matches `.disconnect()` on standard Redis receiver names (`redis`, `client`, `redisClient`, `sub`, `subscriber`, `pub`, `publisher`) so DOM `Observer.disconnect()` is not flagged.
