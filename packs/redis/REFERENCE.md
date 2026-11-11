# redis pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## redis/client

Manifest version: `1.2.0`. Status: **complete**.

### redis/REDIS-CONNECT-001

Check: [`redis/client/no-client-without-error-handler@1.0.0`](checks/client/no-client-without-error-handler/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.client-error-handler`. Minimum severity: `none`.

An empty error handler swallows connection failures, so the app serves stale or missing data with no signal that Redis is down.

Default parameters: `{}`.

**Repair:** Log the error and surface it to health checks or metrics. Keep the handler next to createClient so every client gets one.

**Scope and limits:** function () {} swallows the error the same way an empty arrow does. The keyword form is not a real handler. Shape mirrors postgres/client/no-empty-pool-error-handler so both packs flag the same callback spellings.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-redis and ioredis client documentation",
  "locator": "error event on connection failure",
  "paraphrase": "A Redis client emits error when the connection drops. Registering a handler that does nothing hides outages from logs and alerts."
}
```

### redis/REDIS-PUBSUB-001

Check: [`redis/pubsub/no-publish-without-channel-ns@1.0.0`](checks/pubsub/no-publish-without-channel-ns/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.publish-channel-namespace`. Minimum severity: `none`.

Publishing to a bare channel mixes event streams, so a subscriber cannot tell which domain an event came from and replays hit the wrong handlers.

Default parameters: `{}`.

**Repair:** Publish to <domain>:<event>. Document the channel contract next to the subscriber that consumes it.

**Scope and limits:** A template channel without a colon still lands on the global bus. Interpolation does not namespace.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, Pub/Sub delivery contract",
  "locator": "fire-and-forget publish semantics",
  "paraphrase": "PUBLISH is fire-and-forget to current subscribers on a global bus. A namespaced channel keeps each event stream routable to its own subscribers."
}
```

### redis/REDIS-LUA-001

Check: [`redis/client/no-eval-with-keys-mix@1.0.0`](checks/client/no-eval-with-keys-mix/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.script-over-eval`. Minimum severity: `none`.

Inline eval resends and recompiles the script per call, and interpolated values bypass the KEYS/ARGV separation cluster routing depends on.

Default parameters: `{}`.

**Repair:** Load the script once with scriptLoad and call evalSha, or register it with defineCommand. Keep keys in KEYS and values in ARGV.

**Scope and limits:** Interpolating a value into the script text mixes code and data. A template script is still an inline eval.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, scripting with Lua",
  "locator": "KEYS and ARGV separation and script cache",
  "paraphrase": "EVAL ships source on every call. Scripts should be loaded once and invoked by hash so keys travel in KEYS and values in ARGV."
}
```

### redis/REDIS-TX-001

Check: [`redis/client/no-multi-without-exec@1.0.0`](checks/client/no-multi-without-exec/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.multi-requires-exec`. Minimum severity: `none`.

A multi chain without exec queues writes that never run, so the app reports success while Redis stored nothing.

Default parameters: `{}`.

**Repair:** Chain exec (or discard) onto the multi call in the same statement so the queue always closes.

**Scope and limits:** exec in a later statement is invisible to this single-statement rule. Chain it onto the multi call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, transactions with MULTI and EXEC",
  "locator": "queuing and EXEC requirement",
  "paraphrase": "MULTI only queues commands. Nothing runs until EXEC, and DISCARD is the only other way to close the queue."
}
```

### redis/REDIS-SUB-001

Check: [`redis/pubsub/no-commands-on-subscriber@1.0.0`](checks/pubsub/no-commands-on-subscriber/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.subscriber-connection`. Minimum severity: `none`.

Once the client subscribes, regular commands such as get, set or publish on it are rejected. The publish or cache write fails at runtime, often only after the first message arrives.

Default parameters: `{}`.

**Repair:** Subscribe on a dedicated connection (const subscriber = client.duplicate() in node-redis, a second new Redis() in ioredis) and keep the original client for commands and publish.

**Scope and limits:** Calls in different methods of the same injected client still share one connection. The rule needs a redis or ioredis import in the file and the same receiver text for subscribe and the command; a file mentioning RESP: 3, createCluster, createSentinel or Cluster passes. Two unrelated clients that share a local name in one file are reported.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "ioredis README (Pub/Sub) and node-redis documentation (Pub/Sub with RedisClient)",
  "locator": "subscriber mode and dedicated connections; https://github.com/redis/ioredis#pubsub and https://github.com/redis/node-redis/blob/master/docs/pub-sub.md",
  "paraphrase": "A connection cannot be both publisher and subscriber. After subscribe or psubscribe it only accepts subscription commands, so pub/sub needs a dedicated connection, for example from client.duplicate(). node-redis with RESP3, cluster and sentinel clients handle this themselves."
}
```

### redis/REDIS-QUIT-001

Check: [`redis/client/no-disconnect-without-quit@1.0.0`](checks/client/no-disconnect-without-quit/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.disconnect-without-quit`. Minimum severity: `none`.

Calling .disconnect() during graceful shutdown aborts in-flight writes and pub/sub flushes that were already handed to the client.

Default parameters: `{}`.

**Repair:** Await client.quit() (or redis.quit()) during shutdown so queued commands complete before the socket closes.

**Scope and limits:** Matches .disconnect() on receivers named redis, client, redisClient, sub, subscriber, pub, or publisher. Non-Redis MutationObserver.disconnect() on observer names is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "node-redis & ioredis documentation, Disconnecting (redis.io)",
  "locator": "https://redis.io/docs/latest/develop/clients/nodejs/",
  "paraphrase": "quit() waits for in-flight commands to receive replies before closing the connection, whereas disconnect() immediately closes the socket and rejects pending replies."
}
```

## redis/keys

Manifest version: `1.1.1`. Status: **complete**.

### redis/REDIS-KEY-001

Check: [`redis/keys/no-unprefixed-key@1.0.1`](checks/keys/no-unprefixed-key/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.key-namespace`. Minimum severity: `none`.

A bare global key collides with every other feature sharing the database, and a delete or expiry can take down unrelated data.

Default parameters: `{}`.

**Repair:** Name keys as <domain>:<id>, for example session:abc123. Keep the domain next to the module that owns it.

**Scope and limits:** Backticks do not add a namespace. A template literal without a colon is still a global key. The call must be on a Redis client: a receiver whose name contains redis or valkey, or a receiver named client, cache, db, kv, store, pub, sub, publisher or subscriber in a file that imports a module whose specifier contains redis, valkey or @vercel/kv. An Express app.get route, a req.get header read and a Map get are not matched. A client under another name is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, key naming and keyspace patterns",
  "locator": "data types and key expiry guidance",
  "paraphrase": "Give every key a namespaced name such as domain:id so keyspace scans, evictions, and deletes stay scoped to one owner."
}
```

### redis/REDIS-TTL-001

Check: [`redis/keys/no-set-without-ttl@1.0.0`](checks/keys/no-set-without-ttl/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.set-requires-ttl`. Minimum severity: `none`.

The syntax does not distinguish durable state from sessions. This matcher also treats NX/XX as if they were expiry, which they are not.

Default parameters: `{}`.

**Repair:** Pass { EX: seconds } (or PX/EXAT/PXAT) on every set, or call setEx. NX/XX alone do not bound lifetime.

**Scope and limits:** An options object with no expiry field still leaves the key immortal. The expiry must be visible in the call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, SET command options",
  "locator": "EX PX EXAT PXAT and KEEPTTL options",
  "paraphrase": "SET without expiry persists until deletion; persistence is a valid choice for many keys, while sessions and caches may need expiry."
}
```

### redis/REDIS-NAMESPACE-001

Check: [`redis/pubsub/no-publish-without-channel-ns@1.0.0`](checks/pubsub/no-publish-without-channel-ns/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.publish-channel-namespace`. Minimum severity: `none`.

A bare channel name collides across features, and a pattern subscriber on updates receives events from every domain that publishes there.

Default parameters: `{}`.

**Repair:** Publish to <domain>:<event>, for example orders:updates. Keep the channel next to the event type it carries.

**Scope and limits:** Backticks do not add a namespace. A template channel without a colon collides on the same global bus.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, Pub/Sub channels",
  "locator": "channel naming and pattern subscriptions",
  "paraphrase": "Channel names share one global bus, so publishers should namespace channels as domain:event to keep subscribers scoped."
}
```

### redis/REDIS-SCAN-001

Check: [`redis/keys/no-keys-command@1.0.1`](checks/keys/no-keys-command/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.scan-instead-of-keys`. Minimum severity: `none`.

A KEYS call blocks the single-threaded server while it walks every key, stalling all other clients until it returns.

Default parameters: `{}`.

**Repair:** Iterate with scanIterator (optionally with a MATCH pattern) instead of calling keys.

**Scope and limits:** A narrow prefix does not make KEYS cheap. Scope does not change the blocking scan; use SCAN. The call must be on a Redis client: a receiver whose name contains redis or valkey, or a receiver named client, cache, db, kv, store, pub, sub, publisher or subscriber in a file that imports a module whose specifier contains redis, valkey or @vercel/kv. Object.keys and Map keys are not matched. A client under another name is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, KEYS command",
  "locator": "warning on KEYS in production",
  "paraphrase": "KEYS scans the whole keyspace in one blocking call. Production iteration should use SCAN cursors instead."
}
```

### redis/REDIS-DANGER-001

Check: [`redis/keys/no-flush-in-app@1.0.0`](checks/keys/no-flush-in-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.app-danger-commands`. Minimum severity: `none`.

A flush in app code wipes every key for every feature, and a config rewrite from a request handler persists past the deploy that ran it.

Default parameters: `{}`.

**Repair:** Remove the call from app code. Keep flush and config changes in runbooks, migrations, or admin tooling with review.

**Scope and limits:** Casing does not make the wipe safe. ioredis spells it flushdb and node-redis flushDb; both are covered.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, FLUSHALL and server commands",
  "locator": "data loss warning on flush commands",
  "paraphrase": "FLUSHALL, FLUSHDB, CONFIG, and DEBUG reshape or wipe the server. They belong in ops tooling, never in application request paths."
}
```

### redis/REDIS-MGET-LOOP-001

Check: [`redis/keys/no-get-in-loop@1.0.0`](checks/keys/no-get-in-loop/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `redis.get-in-loop`. Minimum severity: `none`.

Sequential await redis.get(k) calls inside a loop turn a 1 ms cache lookup into N serial network round-trips under load.

Default parameters: `{}`.

**Repair:** Replace the loop with a single await redis.mget(...keys) (or redis.mGet(keys) in node-redis) or queue commands on a pipeline.

**Scope and limits:** Matches await redis.get / client.get / cache.get inside for, for-in, for-of, while, and do loops. Map.prototype.get is synchronous and not awaited.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Redis documentation, Redis pipelining (redis.io)",
  "locator": "https://redis.io/docs/latest/develop/use/pipelining/",
  "paraphrase": "Issuing individual commands sequentially in a loop pays a full TCP round-trip latency per command; batch multi-key reads with MGET or a pipeline."
}
```
