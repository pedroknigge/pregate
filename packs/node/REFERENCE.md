# node pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.5.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## node/internals

Manifest version: `1.2.0`. Status: **complete**.

### node/NODE-BIND-001

Check: [`node/modules/no-process-binding@1.0.0`](checks/modules/no-process-binding/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-process-binding`. Minimum severity: `none`.

Internal bindings can change between Node releases without the compatibility guarantees of public modules.

Default parameters: `{}`.

**Repair:** Import the documented Node module that exposes the needed capability.

**Scope and limits:** Bracket access to binding is the same internal call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, deprecated APIs",
  "locator": "process.binding()",
  "paraphrase": "process.binding is an undocumented internal entry point; application modules should use supported public APIs."
}
```

### node/NODE-UNCAUGHT-001

Check: [`node/process/no-uncaught-exception-empty@1.1.0`](checks/process/no-uncaught-exception-empty/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-uncaught-exception-empty`. Minimum severity: `none`.

The process keeps taking work after its state is unknown. The next request sees that state.

Default parameters: `{}`.

**Repair:** Rethrow from the handler, or call process.exit. Rethrow also satisfies NODE-EXIT-001. Setting process.exitCode and returning does not. Omitting the listener lets the runtime exit.

**Scope and limits:** Fidelity: proxy, same-call. A named listener such as process.on("uncaughtException", crash) is reported, because the body is another statement. shutdown() is not process.exit. NODE-EXIT-001 still reports process.exit outside this choice. This is the only id for that requirement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, uncaughtException and unhandledRejection",
  "locator": "warning: using these events incorrectly can cause an infinite loop or a process that resumes after a crash",
  "paraphrase": "A handler for uncaughtException or unhandledRejection exits with process.exit or rethrows. Logging and returning leaves the process running after an unknown failure. An empty callback is the same resume."
}
```

### node/NODE-TLS-001

Check: [`node/security/no-tls-reject-unauthorized-false@1.0.0`](checks/security/no-tls-reject-unauthorized-false/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-tls-reject-unauthorized`. Minimum severity: `none`.

Without certificate verification an active intermediary can impersonate the server.

Default parameters: `{}`.

**Repair:** Leave verification enabled and configure a trusted CA when necessary.

**Scope and limits:** Other TLS options do not restore certificate verification.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, TLS",
  "locator": "tls.connect options: rejectUnauthorized",
  "paraphrase": "TLS clients verify peer certificates by default; setting rejectUnauthorized to false explicitly disables verification."
}
```

### node/NODE-SHELL-001

Check: [`node/security/no-shell-true@1.0.0`](checks/security/no-shell-true/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-shell-true`. Minimum severity: `none`.

The extra shell interpreter can treat data as commands when arguments are assembled from input.

Default parameters: `{}`.

**Repair:** Invoke the program directly with an argument array.

**Scope and limits:** Specifying a working directory does not make shell execution safe.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, child_process",
  "locator": "spawn and execFile shell option",
  "paraphrase": "Enabling shell routes command and arguments through a shell instead of executing the program directly."
}
```

### node/NODE-COMPILE-001

Check: [`node/modules/no-module-compile@1.0.0`](checks/modules/no-module-compile/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-module-compile`. Minimum severity: `none`.

Loader internals have unstable contracts and execute source outside the normal import path.

Default parameters: `{}`.

**Repair:** Use import or a supported loader integration instead.

**Scope and limits:** Using Module._compile or assigning require.extensions is still a loader modification.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, Modules",
  "locator": "module._compile and require.extensions",
  "paraphrase": "Underscored module loader hooks and require.extensions are internal or deprecated extension mechanisms."
}
```

### node/NODE-STREAM-001

Check: [`node/modules/no-stream-internal@1.0.0`](checks/modules/no-stream-internal/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-stream-internal`. Minimum severity: `none`.

Those internal modules no longer resolve, so the import throws before the stream is used.

Default parameters: `{"minNode":26}`.

**Repair:** Import Readable, Writable, Duplex, Transform, or PassThrough from node:stream.

**Scope and limits:** node:stream and a string that only mentions an internal name are allowed. require('_stream_readable') and import('node:_stream_duplex') are the same removed modules. The check stays quiet unless every Node.js pin for this file is Node.js 26 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "minNode": {
    "type": "integer",
    "minimum": 1
  }
}
```

Source metadata:

```json
{
  "work": "Node.js 26.0.0 release notes and deprecated APIs",
  "locator": "https://nodejs.org/docs/latest-v26.x/api/deprecations.html#dep0193-requirenode_stream_",
  "paraphrase": "DEP0193 removed node:_stream_duplex, node:_stream_passthrough, node:_stream_readable, node:_stream_transform, node:_stream_wrap, and node:_stream_writable in Node.js 26.0.0. Import from node:stream."
}
```

### node/NODE-REGISTER-001

Check: [`node/modules/no-module-register@1.0.0`](checks/modules/no-module-register/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-module-register`. Minimum severity: `none`.

The call still runs, and Node.js prints a deprecation warning because register will be removed.

Default parameters: `{"minNode":26}`.

**Repair:** Call module.registerHooks with the hook callbacks.

**Scope and limits:** registerHooks is the replacement. A different object's register method is not this API. A renamed import, such as import { register as load }, is not seen. The warning stays quiet unless every Node.js pin for this file is Node.js 26 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "minNode": {
    "type": "integer",
    "minimum": 1
  }
}
```

Source metadata:

```json
{
  "work": "Node.js 26.0.0 release notes and deprecated APIs",
  "locator": "https://nodejs.org/docs/latest-v26.x/api/deprecations.html#dep0205-moduleregister",
  "paraphrase": "DEP0205 runtime-deprecates module.register in Node.js 26.0.0. module.registerHooks is the synchronous replacement and still covers every module type."
}
```

## node/operations

Manifest version: `1.0.0`. Status: **preview**.

### node/NODE-LOCK-001

Check: [`node/supply/locked-ci-install@1.0.0`](checks/supply/locked-ci-install/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `node.locked-ci-install`. Minimum severity: `deny`.

An unlocked install can resolve different bytes than the ones reviewed, so CI and production are not the same dependency tree.

Default parameters: `{"verifier":"NODE-LOCK-001"}`.

**Repair:** Bind NODE-LOCK-001 and core CORE-INV-050 to one reviewed assertion. The assertion checks that a lockfile is committed and that CI installs with npm ci, pnpm install --frozen-lockfile, or yarn install --immutable. Include a control that changes the lock without updating the install. Run pregate fitness run NODE-LOCK-001.

**Scope and limits:** Fidelity: evidence. This is the Node.js evidence for core CORE-INV-050, not a second product invariant and not a shell-gate pattern. The pack does not scan workflow YAML. A green test suite does not prove the install was frozen.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "Node.js and npm documentation, reproducible installs",
  "locator": "npm ci; pnpm install --frozen-lockfile; yarn install --immutable; core CORE-INV-050",
  "paraphrase": "A Node.js CI install uses the committed lockfile. npm ci, pnpm install --frozen-lockfile, and yarn install --immutable refuse a drift between the manifest and the lock."
}
```

### node/NODE-ENVFILE-001

Check: [`node/supply/env-file-hygiene@1.0.0`](checks/supply/env-file-hygiene/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `node.env-file-hygiene`. Minimum severity: `deny`.

A committed .env puts secrets in history. A missing example leaves the next checkout guessing names.

Default parameters: `{"verifier":"NODE-ENVFILE-001"}`.

**Repair:** Bind NODE-ENVFILE-001 to a reviewed assertion that fails when .env is not ignored or .env.example is absent, and that fails when the example contains a live secret. Run pregate fitness run NODE-ENVFILE-001.

**Scope and limits:** Fidelity: evidence. The forbidden-path primitive in packs/ENGINE-REQUESTS.md section 6 has landed. This pack has not bound it, so a committed .env is not a Node syntax finding. This obligation is the stand-in.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "Node.js and Twelve-Factor, config and secrets",
  "locator": ".gitignore and .env.example; packs/ENGINE-REQUESTS.md section 6, forbidden path",
  "paraphrase": ".env stays untracked because .gitignore lists it, and .env.example is committed with names and no secrets so a new checkout knows which variables exist."
}
```

### node/NODE-PIN-001

Check: [`node/supply/require-node-pin@1.1.0`](checks/supply/require-node-pin/check.json). Default severity: **deny**.

Implementation: `node-pin`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: language-independent Node.js pin files. Cardinality: `singleton`. Dimension: `node.require-node-pin`. Minimum severity: `deny`.

An exact pin below the security patch for its release line stays on a vulnerable build. An unpinned tool changes under the team, and a current major that is not LTS drops support on the next release train.

Default parameters: `{"verifier":"NODE-PIN-001"}`.

**Repair:** When the finding names a patched release, replace that exact pin with it. Keep NODE-PIN-001 bound to a reviewed assertion that reads one of .nvmrc, .node-version, .tool-versions, engines.node, or volta.node, checks the major, and checks that major against the current LTS list with an explicit maxAgeMs. Run pregate fitness run NODE-PIN-001.

**Scope and limits:** Fidelity: evidence for the LTS major, and an exact pin for the security patch. The patched versions are data on the check, with the source URL and date, and the gate reads them from the lock with no network. A range, a major-only pin, lts/*, a floating tag, a prerelease tag, or a release line absent from that table stays quiet. A comment is not a pin. Dockerfile distro suffixes and image digests still name that exact version. Which majors are LTS is a dated fact, so the assertion owns the list. The pack does not hardcode LTS majors.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "Node.js release schedule and November 2026 security releases",
  "locator": "https://nodejs.org/en/blog/vulnerability/november-2026-security-releases (2026-11-11); .nvmrc, .node-version, .tool-versions, package.json engines.node and volta.node, Dockerfile FROM node, actions/setup-node node-version, workflow and .gitlab-ci.yml image and container node tags, action.yml",
  "paraphrase": "An exact Node.js pin below the patched release for its line is named in the finding. The patched versions are data on the check, dated to that post. The project also keeps a reviewed assertion that the declared major is a current LTS line."
}
```

### node/NODE-SCRIPTS-001

Check: [`node/supply/install-scripts@1.0.0`](checks/supply/install-scripts/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `node.install-scripts`. Minimum severity: `deny`.

A postinstall script from a dependency runs at install time with the developer's privileges.

Default parameters: `{"verifier":"NODE-SCRIPTS-001"}`.

**Repair:** Bind NODE-SCRIPTS-001 to a reviewed assertion that accepts CI installs using --ignore-scripts, or an explicit allowlist of preinstall, install, postinstall, and prepare scripts. A script that is not listed fails the assertion. Run pregate fitness run NODE-SCRIPTS-001.

**Scope and limits:** Fidelity: evidence. Workflow YAML is not a pattern grammar. This is not a shell-gate rule. A package.json script name by itself is not the allowlist.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "npm documentation, ignore-scripts",
  "locator": "npm ci --ignore-scripts; pnpm install --frozen-lockfile --ignore-scripts; package.json install lifecycle",
  "paraphrase": "Dependency install scripts do not run unless they are on a reviewed allowlist. The default install passes --ignore-scripts."
}
```

### node/NODE-EDGE-001

Check: [`node/server/edge-security-headers@1.0.0`](checks/server/edge-security-headers/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `node.edge-headers`. Minimum severity: `deny`.

A process behind a proxy can look header-less in source while the browser still receives no framing or transport policy if the edge never set one.

Default parameters: `{"verifier":"NODE-EDGE-001"}`.

**Repair:** Bind NODE-EDGE-001 to a reviewed assertion that shows the edge or gateway config setting the security headers, or that shows the process sets them. Turn NODE-HEADERS-001 off when this evidence is the one you adopt. Run pregate fitness run NODE-EDGE-001.

**Scope and limits:** Fidelity: evidence. The syntax proxy cannot see the edge. A comment in server code is not this evidence.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "OWASP HTTP security response headers",
  "locator": "edge or gateway header policy",
  "paraphrase": "When the Node.js process does not set security headers, the edge that terminates the request sets them, and that configuration is reviewed evidence."
}
```

### node/NODE-SIGNAL-001

Check: [`node/server/require-graceful-close@1.0.0`](checks/server/require-graceful-close/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.graceful-close`. Minimum severity: `none`.

A process that exits without close drops requests that the kernel has already accepted.

Default parameters: `{}`.

**Repair:** In the file that calls createServer or listen, register process.on for SIGTERM and for SIGINT, and call server.close from each handler.

**Scope and limits:** Fidelity: proxy, same-file. A handler in another file is not seen. close under another name is not seen. Test files are ignored. A comment does not count.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, signal events and server.close",
  "locator": "SIGTERM, SIGINT, and server.close",
  "paraphrase": "A long-running server closes its listener when it receives SIGTERM or SIGINT so in-flight requests can finish."
}
```

### node/NODE-TIMEOUT-001

Check: [`node/server/require-http-timeouts@1.0.0`](checks/server/require-http-timeouts/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.http-timeouts`. Minimum severity: `none`.

An unbounded header read or body holds the socket and memory for as long as the client wants.

Default parameters: `{}`.

**Repair:** Set server.headersTimeout, server.requestTimeout, and server.keepAliveTimeout, and name a body limit, maxBodySize, or bodyLimit in that file.

**Scope and limits:** Fidelity: proxy, same-file. Express parser limits stay express/EX-LIMIT-001, which is off because the 100kb default holds. A variable merely named limit satisfies the body half. Timeouts configured in another file are not seen. Test files are ignored.

**Interactions when active together:**

- Works against the conventions of `express`: Express JSON and urlencoded parsers already cap bodies at 100kb. EX-LIMIT-001 is that optional explicit limit and stays off. Settle: Keep EX-LIMIT-001 off unless the project wants an explicit parser limit. This proxy is the raw server timeouts plus a named limit in the listen file.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, http.Server timeouts",
  "locator": "headersTimeout, requestTimeout, keepAliveTimeout, and a request body limit",
  "paraphrase": "An HTTP server bounds how long headers, the request, and a keep-alive socket may live, and it bounds the request body."
}
```

### node/NODE-ROUTE-001

Check: [`node/server/require-health-routes@1.0.0`](checks/server/require-health-routes/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.health-routes`. Minimum severity: `none`.

A platform that cannot probe those paths restarts a healthy process or sends traffic to one that is not ready.

Default parameters: `{}`.

**Repair:** Register both "/health" and "/ready" in the file that calls createServer or listen.

**Scope and limits:** Fidelity: proxy, same-file. /api/health and /healthz do not count. A router mounted from another file is not seen. Test files are ignored.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js production practice, health and readiness",
  "locator": "GET /health and GET /ready",
  "paraphrase": "A server registers /health for liveness and /ready for readiness so a platform can tell a live process from one that can take traffic."
}
```

### node/NODE-ENVPARSE-001

Check: [`node/process/env-schema-parse@1.0.0`](checks/process/env-schema-parse/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.env-schema-parse`. Minimum severity: `none`.

A scattered read accepts a missing or mistyped variable at the moment of use, which is often the first request.

Default parameters: `{}`.

**Repair:** Parse process.env once with parse, safeParse, or cleanEnv in the file that needs a value, and pass the result down. Prefer one config module.

**Scope and limits:** Fidelity: proxy, same-file. schema.parse(process.env) in the same file excuses every raw read there, including one the schema does not return. const raw = process.env; schema.parse(raw) is not seen. JSON.parse does not count as that schema parse, so the raw read is still reported. Test files are ignored.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, process.env",
  "locator": "validate environment at startup",
  "paraphrase": "The process reads process.env through one schema parse at startup. Later code uses the parsed value, not a fresh raw read."
}
```

### node/NODE-HEADERS-001

Check: [`node/server/security-headers@1.0.0`](checks/server/security-headers/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.security-headers`. Minimum severity: `none`.

Without those headers a browser will frame the response, sniff content, or skip transport rules the app thought it had.

Default parameters: `{}`.

**Repair:** Call helmet() or set one of the named headers in the listen file. When the edge sets them, bind NODE-EDGE-001 and turn this rule off.

**Scope and limits:** Fidelity: proxy, same-file. One header literal satisfies the proxy; it does not prove a complete policy. The edge is NODE-EDGE-001. Test files are ignored.

**Interactions when active together:**

- Works against the conventions of `express`: Helmet presence is an Express backlog item because the policy may live in a reverse proxy. Settle: Use this proxy for a header or helmet() call in the listen file. Use NODE-EDGE-001 when the edge owns the headers, and turn this rule off there.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "OWASP HTTP security response headers and Helmet",
  "locator": "helmet(), or Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options",
  "paraphrase": "A server sets a standard security-header policy in process, or the edge does and that fact is reviewed evidence."
}
```

### node/NODE-OBSERVE-001

Check: [`node/server/request-id-logger@1.0.0`](checks/server/request-id-logger/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.request-id-logger`. Minimum severity: `none`.

A text log with no request id cannot be joined to the request that failed.

Default parameters: `{}`.

**Repair:** Import pino or winston, or call pino() or winston.createLogger(), and use requestId or the header x-request-id in that file.

**Scope and limits:** Fidelity: proxy, same-file. The id does not have to be passed into the logger call. console.log does not count. A logger other than pino or winston is not seen. Test files are ignored.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js production practice, request ids and structured logs",
  "locator": "pino or winston, and requestId or x-request-id",
  "paraphrase": "A server log line can be tied to one request. The logger is pino or winston, and the file names a request id."
}
```

### node/NODE-ASYNC-001

Check: [`node/server/async-route-wrapped@1.0.0`](checks/server/async-route-wrapped/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.async-route-wrapped`. Minimum severity: `none`.

A rejected async handler that nobody catches becomes an unhandled rejection, and the client waits.

Default parameters: `{}`.

**Repair:** Wrap the handler with asyncHandler, catchAsync, or wrap, or put the awaited work in try. Sync handlers are out of scope.

**Scope and limits:** Fidelity: proxy, call. Express 5 and Hono forward async rejections, so this warns on a shape their runtime already handles. app.use is not a route verb here. A wrapper with another name is not seen. Test files are ignored. Empty catch stays clean-code/CC-ER-002.

**Interactions when active together:**

- Works against the conventions of `express`: Express 4 drops async rejections unless they are forwarded. Express 5 forwards them. The express pack left that as a backlog item because it depends on the major. Settle: Keep this proxy at warn. When an express rule for the installed major is admitted, enable that rule and turn NODE-ASYNC-001 off for those files.
- Works against the conventions of `hono`: Hono handlers are async and HONO-NEXT-001 owns awaiting next() in middleware. Settle: Turn NODE-ASYNC-001 off for Hono routes. Keep HONO-NEXT-001 for middleware that calls next().

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Express and Node.js HTTP, async route errors",
  "locator": "async handlers on get, post, put, patch, delete, all, and createServer",
  "paraphrase": "An async route callback is wrapped by asyncHandler, catchAsync, or wrap, or its body contains try, so a rejection reaches the error path."
}
```

### node/NODE-LOGSECRET-001

Check: [`node/logging/no-secret-log@1.0.0`](checks/logging/no-secret-log/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-secret-log`. Minimum severity: `none`.

The log line keeps the credential in the aggregator, which is a second copy of the secret.

Default parameters: `{}`.

**Repair:** Log an id or a redacted field. Do not pass password, secret, token, apiKey, accessToken, or the other listed names to logger or console.

**Scope and limits:** Fidelity: proxy, argument name. A binding literally named token is flagged even when it is not a credential. requestId and tokenCount are not. A string that merely says token is not. A spread of an object is not seen. Hardcoded secret literals stay vibe-proof/VP-SECRET-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js logging practice, redaction",
  "locator": "logger and console arguments named password, secret, token, apiKey, and the other credential names",
  "paraphrase": "A log call does not receive a value whose name is a credential. Secrets in source stay a vibe-proof rule."
}
```

## node/runtime

Manifest version: `1.1.0`. Status: **complete**.

### node/NODE-SYNC-001

Check: [`node/io/no-sync-io@1.0.0`](checks/io/no-sync-io/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-sync-io`. Minimum severity: `none`.

A sync call stops every request on that process while the disk or child answers.

Default parameters: `{}`.

**Repair:** Use the promises variant and await it, or move the work off the request path.

**Scope and limits:** Destructuring the function off its module still blocks. A helper whose name ends in Sync is still this call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, blocking versus non-blocking calls",
  "locator": "overview of blocking code",
  "paraphrase": "Sync filesystem and child-process calls block the event loop until they finish. Server code uses the async variants."
}
```

### node/NODE-EXIT-001

Check: [`node/process/no-process-exit@1.0.0`](checks/process/no-process-exit/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-process-exit`. Minimum severity: `none`.

A library that exits kills the host CLI, test runner, or server without cleanup.

Default parameters: `{}`.

**Repair:** Throw, return a failure, or set process.exitCode and return.

**Scope and limits:** Reading the exit code first does not excuse calling exit. A branch around the call is still a call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, process exit codes",
  "locator": "process.exitCode versus exit",
  "paraphrase": "Libraries report failure by throwing or setting the exit code. Only the entry point decides when the process ends."
}
```

### node/NODE-ENV-001

Check: [`node/process/no-env-assign@1.0.0`](checks/process/no-env-assign/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-env-assign`. Minimum severity: `none`.

A write changes every module in the process and leaks between tests.

Default parameters: `{}`.

**Repair:** Read the value into a local and pass it down. Keep test overrides in the test setup.

**Scope and limits:** Bracket access is the same write. A defaulting operator still assigns.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, process.env",
  "locator": "environment mutation",
  "paraphrase": "The environment is input to the process. Code reads it at startup and never rewrites it at runtime."
}
```

### node/NODE-PREFIX-001

Check: [`node/modules/prefer-node-prefix@1.0.1`](checks/modules/prefer-node-prefix/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.prefer-node-prefix`. Minimum severity: `none`.

A bare specifier resolves against packages first, so a new dependency can shadow the builtin.

Default parameters: `{}`.

**Repair:** Write the specifier with the node: prefix, including subpaths.

**Scope and limits:** A dynamic import needs the prefix too. A similarly named package is not the builtin.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, builtin modules",
  "locator": "node: prefix",
  "paraphrase": "Builtin imports carry the node: prefix so they cannot be confused with packages on disk."
}
```

### node/NODE-BUF-001

Check: [`node/io/no-buffer-ctor@1.0.0`](checks/io/no-buffer-ctor/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-buffer-ctor`. Minimum severity: `none`.

A size argument can expose old heap contents to the next reader.

Default parameters: `{}`.

**Repair:** Use the from factory for data and alloc for zeroed memory.

**Scope and limits:** A comment naming the factory does not replace the call. A size argument is still this constructor.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, Buffer",
  "locator": "deprecated constructor",
  "paraphrase": "The Buffer constructor is deprecated because a number argument leaves memory uninitialized. Factories state the intent."
}
```

### node/NODE-URL-001

Check: [`node/api/no-url-parse@1.0.0`](checks/api/no-url-parse/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-url-parse`. Minimum severity: `none`.

The legacy shape differs from the standard URL, so parsing moves behavior callers do not expect.

Default parameters: `{}`.

**Repair:** Construct a URL and read its fields.

**Scope and limits:** Passing the query flag stays on the legacy parser. Another parse function is not this call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, legacy URL API",
  "locator": "url.parse deprecation",
  "paraphrase": "The legacy parser is frozen and kept for compatibility. New code parses with the WHATWG URL class."
}
```

### node/NODE-HEADER-001

Check: [`node/api/no-write-header@1.0.0`](checks/api/no-write-header/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-write-header`. Minimum severity: `none`.

On Node.js 26 the method is gone, so the response never receives its status line.

Default parameters: `{"minNode":26}`.

**Repair:** Call writeHead with the status code and headers.

**Scope and limits:** writeHead is the replacement. A comment or a string that names writeHeader is not a call. The check stays quiet unless every Node.js pin for this file (package.json engines.node and volta.node, .nvmrc, .node-version, and .tool-versions, from the file's directory up to the repository root) is Node.js 26 or newer. An older pin, a missing pin, or a pin such as lts/* keeps the call allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "minNode": {
    "type": "integer",
    "minimum": 1
  }
}
```

Source metadata:

```json
{
  "work": "Node.js 26.0.0 release notes and deprecated APIs",
  "locator": "https://nodejs.org/docs/latest-v26.x/api/deprecations.html#dep0063-serverresponseprototypewriteheader",
  "paraphrase": "DEP0063 ServerResponse.writeHeader reached end of life in Node.js 26.0.0. The supported method is writeHead."
}
```

## node/security

Manifest version: `1.2.0`. Status: **complete**.

### node/NODE-EXEC-001

Check: [`node/security/no-exec-sync@1.0.0`](checks/security/no-exec-sync/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-exec-sync`. Minimum severity: `none`.

A sync call freezes the process, and a shell string lets input become commands.

Default parameters: `{}`.

**Repair:** Use the async spawn or execFile variant with an argument list.

**Scope and limits:** The execFile variant without a shell still blocks. Destructuring the call does not change it.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, child processes",
  "locator": "synchronous process creation",
  "paraphrase": "Sync subprocess calls block the loop and often run through a shell. Server code spawns async without a shell."
}
```

### node/NODE-VM-001

Check: [`node/security/no-vm-run@1.0.0`](checks/security/no-vm-run/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-vm-run`. Minimum severity: `none`.

Context code escapes to the host process, so a string that reaches it runs with full access.

Default parameters: `{}`.

**Repair:** Remove the evaluation path. Parse data with a parser instead of running it.

**Scope and limits:** Compiling without running still compiles untrusted code. Creating a context alone is not this call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, vm module",
  "locator": "vm is not a security boundary",
  "paraphrase": "The vm module runs code in a new context but is not a sandbox. Untrusted code does not go through it."
}
```

### node/NODE-EXEC-002

Check: [`node/security/no-exec-interpolation@1.0.0`](checks/security/no-exec-interpolation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-exec-interpolation`. Minimum severity: `none`.

A value spliced into the command string is parsed by the shell, so a file name such as a.png; rm -rf / runs a second command.

Default parameters: `{}`.

**Repair:** Call execFile or spawn with the program name and an argument array, so the value stays one argument.

**Scope and limits:** Concatenation with + is the same as a template literal. A fixed command string is fine. execSync is reported by NODE-EXEC-001. exec wrapped by promisify under another name is not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, child processes",
  "locator": "https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback",
  "paraphrase": "exec runs the command string in a shell. Never pass unsanitized user input to it: shell metacharacters can trigger arbitrary command execution."
}
```

### node/NODE-CIPHER-001

Check: [`node/security/no-create-cipher@1.0.0`](checks/security/no-create-cipher/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-create-cipher`. Minimum severity: `none`.

The call throws on current Node.js, and on older versions the derived key and IV are weak, so the ciphertext is easier to break.

Default parameters: `{}`.

**Repair:** Derive a key with crypto.scrypt or pbkdf2 and a random salt, then use createCipheriv or createDecipheriv with a random IV.

**Scope and limits:** createCipheriv and createDecipheriv are the replacements and are allowed. Reading the function by string key is the same call.

**Interactions when active together:**

- Duplicates `security-audit/SA-ECB-001`: createCipher or createDecipher with an ECB algorithm literal is reported by both rules. Settle: Keep both: NODE-CIPHER-001 flags the removed key derivation, SA-ECB-001 the mode. createCipheriv with aes-256-gcm satisfies both.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, deprecated APIs",
  "locator": "https://nodejs.org/api/deprecations.html#DEP0106",
  "paraphrase": "crypto.createCipher and crypto.createDecipher are End-of-Life and removed in Node.js 22. They use MD5 without salt as the key derivation and a static IV."
}
```

### node/NODE-EXISTS-001

Check: [`node/security/no-fs-exists@1.0.0`](checks/security/no-fs-exists/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.fs.exists`. Minimum severity: `none`.

Checking for file existence before opening or reading introduces a TOCTOU race condition where another process can delete or swap the file.

Default parameters: `{}`.

**Repair:** Open, read, or write the file directly and handle errors (e.g. ENOENT) in the catch block or error callback.

**Scope and limits:** Do not call fs.exists or fs.existsSync before fs.readFile or fs.open, including via destructured existsSync.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js File System Documentation",
  "locator": "DEP0007 / fs.exists",
  "paraphrase": "fs.exists() is an anti-pattern because it introduces a time-of-check to time-of-use vulnerability."
}
```
