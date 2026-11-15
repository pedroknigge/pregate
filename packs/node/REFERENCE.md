# node pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.3.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## node/internals

Manifest version: `1.1.0`. Status: **complete**.

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

Check: [`node/process/no-uncaught-exception-empty@1.0.0`](checks/process/no-uncaught-exception-empty/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `node.no-uncaught-exception-empty`. Minimum severity: `none`.

An empty listener keeps a process alive in an undefined state after an uncaught exception.

Default parameters: `{}`.

**Repair:** Report the failure and terminate cleanly, or omit the listener and let the runtime exit.

**Scope and limits:** Changing quote style or using an empty function callback does not handle the error.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, process events",
  "locator": "uncaughtException",
  "paraphrase": "An uncaughtException listener must perform emergency handling; an empty callback suppresses the default failure path."
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
