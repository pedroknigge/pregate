# node backlog (candidates — never warn)

These Node topics are not decidable as data-only singleton patterns yet. They
stay here as candidates and MUST NOT become warn-level checks without a
decidable shape plus fixtures.

- unhandledRejection coverage across files — `NODE-CRASH-001` sees one `on`/`once`/`addListener` call. A handler registered in another file, or a named function that exits, is still unseen. Status: candidate for cross-file proof.
- committed `.env` as a path fact — `NODE-ENVFILE-001` is fitness until the forbidden-path primitive in `packs/ENGINE-REQUESTS.md` section 6 lands. Status: waiting on the engine.
- stream backpressure — needs data-flow (write return + drain handling), not one call. Status: candidate.
- cluster sizing — needs deploy topology (CPU count, hosting), not syntax. Status: candidate.
- ESM/CJS package.json interop — needs package.json `type` plus import shape jointly. Status: candidate.
- listen backlog — needs runtime tuning context (port, backlog arg, platform). Status: candidate.
- Worker thread communication channel saturation — measuring message queue pressure on `Worker` instances requires runtime event loop metrics. Status: candidate.
- Memory leaks in EventEmitter listeners — unremoved `.on()` listeners cannot be distinguished from perpetual application-lifetime subscribers without lifecycle traces. Status: candidate.
