# node pack

Data-only PREGATE rules for Node.js server code. Every check is a tree-sitter
pattern (`impl.kind: "pattern"`, `patterns.typescript` only). No executables,
no heuristics: a match is a violation.

Stance: the event loop stays unblocked, the process boundary stays owned by
the entry point, builtin imports are unambiguous, and legacy or eval-like APIs
stay out of new code.

`node/operations` is preview. `pack add` does not select it. It runs only
after `pregate pack enable node/operations`. A checkout that never ran
`pregate enable` is not enforced. A checkout disabled with `pregate disable`
is not enforced.

Ownership, so this pack does not take those rules: SQL concatenation, XSS,
CORS, secrets written in source, fetch timeouts, and stack traces sent to the
client stay in vibe-proof. An empty `catch` stays `clean-code/CC-ER-002`.
Import cycles stay in the architecture pack. Express parser limits stay
`express/EX-LIMIT-001` (off, because the 100kb default holds). Express 5 and
Hono already forward async rejections; those packs own that idiom.

## Rules

| ID | Forbids | Why | Severity |
|----|---------|-----|----------|
| `node/io/no-sync-io` | Blocking `*Sync` calls | A sync call stops every request on that process | deny |
| `node/process/no-process-exit` | Calling `process.exit()` | A library that exits kills its host without cleanup | deny |
| `node/process/no-env-assign` | Assigning `process.env.X` | A write leaks across modules and tests | deny |
| `node/modules/prefer-node-prefix` | Bare builtin imports without `node:` | A bare specifier can resolve to a package instead | deny |
| `node/security/no-exec-sync` | Sync subprocess calls | Sync calls freeze the process; shell strings inject | deny |
| `node/io/no-buffer-ctor` | `new Buffer()` | A size argument can expose uninitialized memory | deny |
| `node/security/no-vm-run` | `vm.runIn*` / `vm.compileFunction` | The vm module is not a sandbox | deny |
| `node/api/no-url-parse` | Legacy `url.parse()` | The frozen parser differs from the standard URL | deny |
| `node/modules/no-process-binding` | `process.binding()` | Internal bindings are unstable | deny |
| `node/process/no-uncaught-exception-empty` | `uncaughtException` or `unhandledRejection` handlers that resume | The process keeps taking work after an unknown failure. Exit or rethrow. Fidelity: proxy, same-call | deny |
| `node/security/no-tls-reject-unauthorized-false` | `rejectUnauthorized: false` | It disables peer certificate verification | deny |
| `node/security/no-shell-true` | Shell-enabled `spawn`/`execFile` | The shell interprets arguments as commands | deny |
| `node/modules/no-module-compile` | `module._compile` / `require.extensions` | Loader internals have unstable contracts | deny |
| `node/security/no-exec-interpolation` | `exec` with a template or concatenated command string | The shell parses the spliced value as commands | deny |
| `node/security/no-create-cipher` | `crypto.createCipher` / `createDecipher` | Removed in Node.js 22; weak key derivation | deny |
| `node/api/no-write-header` | `ServerResponse.writeHeader()` | Removed in Node.js 26 (DEP0063); use `writeHead` | deny |
| `node/modules/no-stream-internal` | `node:_stream_*` imports | Removed in Node.js 26 (DEP0193); use `node:stream` | deny |
| `node/modules/no-module-register` | `module.register()` | Runtime-deprecated in Node.js 26 (DEP0205); use `module.registerHooks` | warn |

## Operations (preview)

Enable with `pregate pack enable node/operations`. Fidelity is `evidence` when
only a reviewed project assertion can establish the fact, and `proxy` when the
syntax is a same-file stand-in. A proxy does not see another file, an edge
proxy, or a helper whose name is not the one listed.

| ID | Condition | Fidelity | Severity |
|----|-----------|----------|----------|
| `NODE-LOCK-001` | Committed lockfile and CI `npm ci`, `pnpm install --frozen-lockfile`, or `yarn install --immutable`. Binds core `CORE-INV-050`. Not a shell gate. | evidence | deny |
| `NODE-ENVFILE-001` | `.env` listed in `.gitignore` and `.env.example` present. Fitness until the forbidden-path primitive lands. | evidence | deny |
| `NODE-PIN-001` | A Node.js pin the pack can already read (`.nvmrc`, `.node-version`, `.tool-versions`, `engines.node`, `volta.node`). The assertion checks that the major is an LTS line. | evidence | deny |
| `NODE-SCRIPTS-001` | CI install uses `--ignore-scripts`, or install lifecycle scripts are on a reviewed allowlist. | evidence | deny |
| `NODE-EDGE-001` | Security headers are set at the edge when the process does not set them. | evidence | deny |
| `NODE-SIGNAL-001` | A file that calls `createServer` or `.listen(` registers SIGTERM and SIGINT handlers that call `.close(`. | proxy, same-file | warn |
| `NODE-TIMEOUT-001` | That server file sets `headersTimeout`, `requestTimeout`, `keepAliveTimeout`, and a `limit` / `maxBodySize` / `bodyLimit`. | proxy, same-file | warn |
| `NODE-ROUTE-001` | That server file registers `"/health"` and `"/ready"`. | proxy, same-file | warn |
| `NODE-ENVPARSE-001` | A raw `process.env` read shares a file with a schema `parse` / `safeParse` / `cleanEnv` of `process.env`. | proxy, same-file | warn |
| `NODE-HEADERS-001` | That server file calls `helmet` or sets a common security header. Edge proof is `NODE-EDGE-001`. | proxy, same-file | warn |
| `NODE-OBSERVE-001` | That server file imports or constructs pino or winston and names `requestId` or `x-request-id`. | proxy, same-file | warn |
| `NODE-ASYNC-001` | An async `get`/`post`/`put`/`patch`/`delete`/`all` or `createServer` callback is wrapped (`asyncHandler`, `catchAsync`, `wrap`) or contains `try`. | proxy, call | warn |
| `NODE-LOGSECRET-001` | A logger or `console` call argument is named password, secret, token, apiKey, or the other listed credential names. | proxy, argument name | deny |

## Methodologies

- `node/runtime` — NODE-SYNC-001, NODE-EXIT-001, NODE-ENV-001, NODE-PREFIX-001, NODE-BUF-001, NODE-URL-001, NODE-HEADER-001
- `node/security` — NODE-EXEC-001, NODE-VM-001, NODE-EXEC-002, NODE-CIPHER-001
- `node/internals` — NODE-BIND-001, NODE-UNCAUGHT-001, NODE-TLS-001, NODE-SHELL-001, NODE-COMPILE-001, NODE-STREAM-001, NODE-REGISTER-001
- `node/operations` (preview) — NODE-LOCK-001, NODE-ENVFILE-001, NODE-PIN-001, NODE-SCRIPTS-001, NODE-EDGE-001, NODE-SIGNAL-001, NODE-TIMEOUT-001, NODE-ROUTE-001, NODE-ENVPARSE-001, NODE-HEADERS-001, NODE-OBSERVE-001, NODE-ASYNC-001, NODE-LOGSECRET-001

The Node.js 26 rules apply only when every declared Node.js target for that file is 26 or newer. Pins are read from `package.json` `engines.node` and `volta.node`, `.nvmrc`, `.node-version`, and `.tool-versions`, walking from the file's directory to the repository root. A missing pin, an older pin beside a newer one, or an unreadable pin such as `lts/*` leaves the rule quiet, so a project that still supports an older Node.js is not newly denied or warned.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.4.0`. 32 distinct check IDs.

Methodologies: `node/internals` (complete), `node/operations` (preview), `node/runtime` (complete), `node/security` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
