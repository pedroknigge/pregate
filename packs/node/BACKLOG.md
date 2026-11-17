# node backlog (candidates — never warn)

These Node topics are not decidable as data-only singleton patterns yet. They
stay here as candidates and MUST NOT become warn-level checks without a
decidable shape plus fixtures.

The engine primitive `forbidden-path` can name a committed `.env`, `*.pem`, or
private key. Binding it is still a candidate: the globs and the `exclude` for
samples such as `.env.example` are not a Node rule yet.

- unhandledRejection coverage — needs cross-file handler proof, not one call site. Status: candidate.
- stream backpressure — needs data-flow (write return + drain handling), not one call. Status: candidate.
- cluster sizing — needs deploy topology (CPU count, hosting), not syntax. Status: candidate.
- ESM/CJS package.json interop — needs package.json `type` plus import shape jointly. Status: candidate.
- listen backlog — needs runtime tuning context (port, backlog arg, platform). Status: candidate.
- Worker thread communication channel saturation — measuring message queue pressure on `Worker` instances requires runtime event loop metrics. Status: candidate.
- Memory leaks in EventEmitter listeners — unremoved `.on()` listeners cannot be distinguished from perpetual application-lifetime subscribers without lifecycle traces. Status: candidate.
