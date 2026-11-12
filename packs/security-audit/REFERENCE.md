# security-audit pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.1`. Category: **practice**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## security-audit/client-and-agents

Manifest version: `1.0.0`. Status: **preview**.

### security-audit/SA-POSTMSG-001

Check: [`security-audit/messaging/post-message-any-origin@1.0.0`](checks/messaging/post-message-any-origin/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security-audit.messaging.post-message-target-origin`. Minimum severity: `none`.

Hardening invariant: the target origin is the only control that keeps a cross-window message away from an unintended embedder or opener. A finding marks a missing control; whether the payload is sensitive needs review.

Default parameters: `{}`.

**Repair:** Pass the exact origin of the receiving window, for example from configuration, instead of "*". Broadcast only data that any site may read.

**Scope and limits:** Detects postMessage on parent, opener, top (optionally through window., globalThis. or self.) or any .contentWindow, with or without a non-null assertion, when the second argument is the literal "*" or an options object whose targetOrigin is "*". A window.postMessage to the sending window itself (a nextTick shim) reaches no other page and passes, as do Worker and MessagePort postMessage calls, which have no target origin. A wildcard held in a variable, event.source replies, window.frames[...] and aliased window references are not detected. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/CLIENT-SIDE.md — Cross-origin messaging and network attack classes; postMessage origin and source trust",
  "paraphrase": "A window message sent with a wildcard target origin can be delivered to whatever page currently embeds or opened the sender."
}
```

### security-audit/SA-ORIGIN-001

Check: [`security-audit/messaging/message-handler-without-origin@1.0.0`](checks/messaging/message-handler-without-origin/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security-audit.messaging.message-origin-check`. Minimum severity: `none`.

Hardening heuristic: any page that can hold a reference to this window can post to it, so a handler that uses event.data without looking at event.origin trusts every sender. A finding marks a missing check, not a confirmed exploit; the handler may only accept harmless data.

Default parameters: `{}`.

**Repair:** Return early unless event.origin equals an exact, configured origin (a Set lookup or ===, not includes, startsWith or an unanchored regex), and check event.source too when several frames share that origin.

**Scope and limits:** Detects window.addEventListener, globalThis.addEventListener or a bare addEventListener for "message", and window.onmessage or globalThis.onmessage assignments, when the handler reads data but never reads the event's origin (a field named origin inside data, or destructured out of it, does not count). The addEventListener handler is the inline function or a const, let, var or function declaration of that name in an enclosing block or the module; an onmessage assignment is checked only when the function is inline. A handler that compares a value with window, self or globalThis itself accepts only its own window's messages and passes; comparing window with one of its properties such as window.top does not. An imported or delegated handler is not resolved and passes, so is a weak origin comparison. WebSocket, MessagePort and Worker objects are not window receivers and pass; files named *worker.*, sw.* or under worker/ or workers/ are excluded. Stays warn until a pilot measures its precision. Vendored paths (vendor/, thirdparty/, third_party/) are skipped. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/CLIENT-SIDE.md — Cross-origin messaging and network attack classes; postMessage origin and source trust",
  "paraphrase": "A window message handler that acts on the message data must first match the sender's origin against an exact allowlist."
}
```

### security-audit/SA-CORS-002

Check: [`security-audit/cors/credentialed-origin-reflection@1.0.0`](checks/cors/credentialed-origin-reflection/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security-audit.cors.credentialed-origin`. Minimum severity: `none`.

Hardening invariant: reflecting the caller's Origin is an allow-every-origin policy that, unlike "*", browsers honor together with cookies. A finding marks a removed control; impact depends on what the credentialed responses expose.

Default parameters: `{}`.

**Repair:** Pass the cors middleware an explicit list of origins, or set Access-Control-Allow-Origin to the request Origin only after it matches an exact allowlist entry, and add Vary: Origin.

**Scope and limits:** Detects a cors options object with both origin: true and credentials: true in a file that names cors, and an Access-Control-Allow-Origin header (setHeader, header, set or append, or a headers object key) whose value is req.headers.origin, a get("origin") or header("origin") call, either with a fallback, or any of these under a type assertion, in a file that also names Access-Control-Allow-Credentials. The reflection is accepted when the nearest enclosing function has an if or ternary on the origin that does more than test presence (truthiness, a comparison with undefined, null or "", or typeof, alone or joined with &&); any such test there counts, even one that only gates another branch. A wildcard origin with credentials is VP-CORS-001's form and is not repeated here; an origin callback that accepts everything, a reflected value held in a variable and a regex or substring allowlist are not detected. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/CLIENT-SIDE.md — Cross-origin messaging and network attack classes; credentialed CORS trust",
  "paraphrase": "Echoing the request's Origin back while allowing credentials lets any site read credentialed responses; browsers already refuse a bare wildcard with credentials."
}
```

### security-audit/SA-JWT-001

Check: [`security-audit/tokens/jwt-verification-disabled@1.0.0`](checks/tokens/jwt-verification-disabled/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`, `python`. Cardinality: `singleton`. Dimension: `security-audit.tokens.jwt-verification`. Minimum severity: `none`.

Hardening invariant: accepting the none algorithm or skipping signature verification lets anyone mint a token, and ignoring expiry keeps a stolen token valid forever. A finding marks a removed control, not a confirmed exploit.

Default parameters: `{}`.

**Repair:** Verify with an explicit list of real algorithms (for example ["RS256"]), keep expiry checks on, and bind audience and issuer. To read claims before verification, keep the result out of any authorization decision.

**Scope and limits:** Detects, in TypeScript, an options key ignoreExpiration: true or an algorithms array containing "none" (any case, quoted keys included); in Python, verify_signature or verify_exp set to False in an options dictionary or dict() call, or an algorithms= keyword list or tuple containing "none". Values computed at run time, the PyJWT 1.x verify=False argument, jwt.decode or decodeJwt calls that never verify and missing audience or issuer checks are not detected. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/WEB-PROTOCOL-AND-AUTH.md — Federated-identity attack classes; JWT verification and claim binding",
  "paraphrase": "A token is trusted only after its signature is checked with an algorithm the server pins and its expiry and other claims are checked."
}
```

### security-audit/SA-LLM-001

Check: [`security-audit/agents/llm-client-in-browser@1.0.0`](checks/agents/llm-client-in-browser/check.json). Default severity: **ask**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security-audit.agents.browser-provider-key`. Minimum severity: `none`.

Hardening invariant: an LLM SDK client running in the browser needs the provider key there, so every visitor can read it and spend against it. Local demos and user-supplied keys are legitimate exceptions, so this asks instead of denying.

Default parameters: `{}`.

**Repair:** Call the provider from a server route that holds the key and enforces the caller's limits, and point the browser at that route. Keep the flag only where each user enters their own key.

**Scope and limits:** Detects the options key dangerouslyAllowBrowser: true (quoted or not) on any object, which the OpenAI and Anthropic SDKs read, and the anthropic-dangerous-direct-browser-access: true header that the same opt-in sends. A value computed at run time, keys exposed through public environment variables without the flag and other SDKs are not detected. Vendored paths (vendor/, thirdparty/, third_party/) are skipped. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Obvious things (API keys and secrets in source)",
  "paraphrase": "Check whether API keys or other secrets end up in code that ships to clients."
}
```

## security-audit/obvious-sinks

Manifest version: `1.0.1`. Status: **preview**.

### security-audit/SA-PY-YAML-001

Check: [`security-audit/deserialization/py-yaml-unsafe-load@1.0.0`](checks/deserialization/py-yaml-unsafe-load/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `security-audit.deserialization.python-yaml-loader`. Minimum severity: `none`.

Hardening invariant: PyYAML's default and full loaders can construct Python objects named in the document, so parsing a file becomes a way to run code. A finding marks a missing safe loader, not a confirmed exploit.

Default parameters: `{}`.

**Repair:** Use yaml.safe_load / yaml.safe_load_all, or pass Loader=yaml.SafeLoader (CSafeLoader for speed).

**Scope and limits:** Detects yaml.load and yaml.load_all with no Loader argument, or with Loader, UnsafeLoader, FullLoader or their C variants by name, as a keyword or the second positional argument, and the yaml.unsafe_load and yaml.full_load shortcuts (and their _all forms). A Loader held in a variable or a project subclass is treated as reviewed and passes. A bare load imported with from yaml import load is not resolved. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Resource and file handling (unsafe deserialization)",
  "paraphrase": "Deserializers that rebuild arbitrary objects from input are a dangerous sink to trace untrusted data into."
}
```

### security-audit/SA-PY-DESER-001

Check: [`security-audit/deserialization/py-unsafe-deserializer@1.0.0`](checks/deserialization/py-unsafe-deserializer/check.json). Default severity: **ask**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `security-audit.deserialization.python-object-deserializer`. Minimum severity: `none`.

Hardening invariant: pickle-family, marshal and shelve loads can execute code embedded in the data. Whether the bytes are trusted cannot be decided from syntax, so a finding asks for that review.

Default parameters: `{}`.

**Repair:** Load only bytes this process wrote to storage it controls, or switch to a data-only format (JSON, msgpack) for anything that crosses a trust boundary. If pickle is unavoidable, subclass Unpickler and restrict find_class.

**Scope and limits:** Detects calls to pickle, cPickle, _pickle, dill and cloudpickle load, loads and Unpickler, marshal.load(s) and shelve.open. A subclass of Unpickler that restricts find_class passes; a renamed module import, joblib, torch.load and pandas.read_pickle are not detected. Test files (tests/, test_*.py, *_test.py, conftest.py) are skipped. Vendored paths (vendor/, thirdparty/, third_party/) are skipped. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Resource and file handling (unsafe deserialization)",
  "paraphrase": "Deserializers that rebuild arbitrary objects from input are a dangerous sink to trace untrusted data into."
}
```

### security-audit/SA-PY-TLS-001

Check: [`security-audit/transport/py-unverified-tls@1.0.0`](checks/transport/py-unverified-tls/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `security-audit.transport.python-certificate-verification`. Minimum severity: `none`.

Hardening invariant: with certificate verification off, any network peer can impersonate the server, so TLS no longer authenticates the connection. A finding marks a removed control, not a confirmed exploit.

Default parameters: `{}`.

**Repair:** Remove verify=False. For a private CA pass its bundle path (verify="/path/ca.pem") or load it with ssl.create_default_context(cafile=...); never patch ssl._create_default_https_context.

**Scope and limits:** Detects verify=False in requests and httpx module calls, client and session HTTP methods (get, post, request, send, stream and similar), httpx Client constructors, project wrappers named like fetch*, *request, urlopen or download*, bare get/post/put/patch/delete/head/send calls, and any call whose first argument is named like a URL (url, page_url, self.base_url); verify = False assigned on an object named s, sess, or ending in session or client, or containing http; any reference to ssl._create_unverified_context; and verify_mode = ssl.CERT_NONE. A value computed at run time, a verify=False parameter default, aiohttp's ssl=False and urllib3 cert_reqs are not detected. HTTP libraries that implement a verify=False option themselves contain the CERT_NONE form; exclude vendored copies with paths/exclude. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Obvious things (TLS enforcement)",
  "paraphrase": "Check that transport security is actually enforced rather than switched off."
}
```

### security-audit/SA-PY-SHELL-001

Check: [`security-audit/execution/py-shell-string@1.0.0`](checks/execution/py-shell-string/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `security-audit.execution.python-shell-command`. Minimum severity: `none`.

Hardening invariant: a shell parses its command string, so a value built into that string can add commands, redirections or substitutions. A finding marks a string-built shell command, not a confirmed injection.

Default parameters: `{}`.

**Repair:** Pass an argument list (subprocess.run(["tar", "czf", name])) without shell=True. If a shell is required, keep the script literal and quote values with shlex.quote.

**Scope and limits:** Detects any call with shell=True (subprocess functions, from-imported or renamed ones and project wrappers alike) whose command, as the first argument or the args= keyword, is not a string literal (a variable, f-string, concatenation or call); subprocess.getoutput and getstatusoutput with a non-literal command; and os.system or os.popen with an f-string, + or % concatenation or .format() argument. A command that is an UPPER_CASE constant, or is built only from string literals and UPPER_CASE constants, is treated as fixed and passes. A shell=True value held in a variable is not detected; argument lists pass. os.system or os.popen with a command held in a variable is SA-PY-SHELL-002. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Injection (shell commands); Obvious things (dynamic input to exec and child processes)",
  "paraphrase": "Shell command construction is a dangerous sink: trace whether input reaches it, and look for process execution with dynamic input."
}
```

### security-audit/SA-PY-SHELL-002

Check: [`security-audit/execution/py-os-shell-variable@1.0.0`](checks/execution/py-os-shell-variable/check.json). Default severity: **ask**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `security-audit.execution.python-shell-variable`. Minimum severity: `none`.

Hardening invariant: os.system and os.popen always run their argument through the shell. Whether a command held in a variable can carry input is a reachability question, so a finding asks for that review.

Default parameters: `{}`.

**Repair:** Pass an argument list to subprocess.run without shell=True. If a shell is required, build the command from literals and quote each value with shlex.quote.

**Scope and limits:** Detects os.system and os.popen whose first argument is a name, attribute or subscript (line, conf.alert_command, sys.argv[1]) other than an UPPER_CASE constant. Literals pass; a built string is SA-PY-SHELL-001's form and is not repeated here. A from-imported system or popen, and commands returned by a call, are not detected. Test files are skipped. Vendored paths (vendor/, thirdparty/, third_party/) are skipped. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Injection (shell commands); Obvious things (dynamic input to exec and child processes)",
  "paraphrase": "Shell command construction is a dangerous sink: trace whether input reaches it, and look for process execution with dynamic input."
}
```

### security-audit/SA-PY-EVAL-001

Check: [`security-audit/execution/py-dynamic-eval@1.0.0`](checks/execution/py-dynamic-eval/check.json). Default severity: **ask**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `security-audit.execution.python-dynamic-eval`. Minimum severity: `none`.

Hardening invariant: eval and exec run whatever Python the string contains. Whether the argument can carry input is a reachability question, so a finding asks for that review.

Default parameters: `{}`.

**Repair:** Parse data with ast.literal_eval or json.loads, or map names to a fixed table of functions instead of evaluating text.

**Scope and limits:** Detects calls to the builtins eval and exec whose first argument is not a string literal or compile() of a string literal. Methods named eval or exec (model.eval(), cursor.exec()) pass, as do literal strings. builtins.eval and aliases are not detected. Test files are skipped. Vendored paths (vendor/, thirdparty/, third_party/) are skipped. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Obvious things (eval and exec with dynamic input)",
  "paraphrase": "Look for eval, exec and similar code-evaluating calls that receive dynamic input."
}
```

### security-audit/SA-PY-DEBUG-001

Check: [`security-audit/exposure/py-flask-debug-run@1.0.0`](checks/exposure/py-flask-debug-run/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `security-audit.exposure.python-debug-server`. Minimum severity: `none`.

Hardening invariant: the Werkzeug debugger served by app.run(debug=True) lets anyone who reaches it run code in the server process. A finding marks a hard-coded debug switch; whether that entry point ships to production needs review.

Default parameters: `{}`.

**Repair:** Read debug from configuration or an environment flag that defaults to off, and serve production through a WSGI server instead of app.run.

**Scope and limits:** Detects .run(debug=True) on an object whose name ends in app (app, flask_app, self.app, webapp) or is application or socketio, unless host= is the literal "127.0.0.1", "localhost" or "::1". Django's DEBUG = True in settings is deliberately not checked because every new project scaffold has it. asyncio.run(debug=True) and other runners pass, and debug set from a variable is not detected. Vendored paths (vendor/, thirdparty/, third_party/) are skipped. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Obvious things (debug mode gating)",
  "paraphrase": "Check that debug or development mode cannot be left on or switched on in production."
}
```

### security-audit/SA-GO-TLS-001

Check: [`security-audit/transport/go-insecure-skip-verify@1.0.0`](checks/transport/go-insecure-skip-verify/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `security-audit.transport.go-certificate-verification`. Minimum severity: `none`.

Hardening invariant: with certificate verification off, any network peer can impersonate the server, so TLS no longer authenticates the connection. A finding marks a removed control, not a confirmed exploit.

Default parameters: `{}`.

**Repair:** Remove InsecureSkipVerify. To trust a private or self-signed CA, load it into tls.Config.RootCAs; for a pinned peer, verify it in VerifyConnection instead of skipping verification.

**Scope and limits:** Detects InsecureSkipVerify set to the literal true in a composite literal or a field assignment. A value computed at run time (an environment flag, a variable) is not detected, and a renamed or embedded tls.Config field set through reflection is outside scope. Test-only clients that talk to httptest TLS servers can be excluded with paths/exclude. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Obvious things (TLS enforcement); Cryptography and secrets (misuse of crypto primitives)",
  "paraphrase": "Check that transport security is actually enforced and that cryptographic controls are not switched off."
}
```

### security-audit/SA-GO-SHELL-001

Check: [`security-audit/execution/go-shell-string@1.0.1`](checks/execution/go-shell-string/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `security-audit.execution.go-shell-command`. Minimum severity: `none`.

Hardening invariant: sh -c parses its script, so a script taken from a value, or a value formatted into that script, can add commands. A finding marks that shell call, not a confirmed injection.

Default parameters: `{}`.

**Repair:** Run the program directly with exec.Command(name, arg1, arg2) so each value is one argument. If a shell is required, keep the script literal and pass values as positional parameters ("sh", "-c", "grep -r \"$1\"", "sh", value).

**Scope and limits:** Detects exec.Command and exec.CommandContext when the program is a string literal sh, bash, zsh, dash, ksh or cmd, optionally under /bin or /usr/bin, written as an interpreted or raw string, the next argument is -c or /c, and the script argument is an identifier, a selector, an index, a slice, a parenthesized form of one of those, a fmt.Sprintf call, or a + concatenation. A constant string literal script such as exec.Command("sh", "-c", "ls -la") stays unreported, as does exec.Command("git", "status"). A value passed as a positional parameter after a literal script stays unreported. strings.Join, any other call, a shell name or flag held in a variable, and a renamed os/exec import stay undetected. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Injection (shell commands); Obvious things (dynamic input to exec and child processes)",
  "paraphrase": "Shell command construction is a dangerous sink: trace whether input reaches it, and look for process execution with dynamic input."
}
```

### security-audit/SA-RS-TLS-001

Check: [`security-audit/transport/rust-accept-invalid-certs@1.0.0`](checks/transport/rust-accept-invalid-certs/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `security-audit.transport.rust-certificate-verification`. Minimum severity: `none`.

Hardening invariant: accepting invalid certificates or hostnames lets any network peer impersonate the server. A finding marks a removed control, not a confirmed exploit.

Default parameters: `{}`.

**Repair:** Remove the danger_accept_invalid_* call. To trust a private CA, add it with add_root_certificate (reqwest) or the connector's root store.

**Scope and limits:** Detects .danger_accept_invalid_certs(true) and .danger_accept_invalid_hostnames(true) method calls (reqwest, native-tls and their builders) with the literal true. A value from configuration and custom rustls certificate verifiers are not detected. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Obvious things (TLS enforcement)",
  "paraphrase": "Check that transport security is actually enforced rather than switched off."
}
```

### security-audit/SA-ECB-001

Check: [`security-audit/crypto/ecb-cipher-mode@1.0.0`](checks/crypto/ecb-cipher-mode/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `security-audit.crypto.block-cipher-mode`. Minimum severity: `none`.

Hardening invariant: ECB encrypts equal plaintext blocks to equal ciphertext blocks and has no integrity, so structure leaks and blocks can be swapped. A finding marks a weak mode, not a demonstrated attack.

Default parameters: `{}`.

**Repair:** Use an authenticated mode such as aes-256-gcm with a fresh random 12-byte IV per message, and store the auth tag with the ciphertext.

**Scope and limits:** Detects createCipheriv, createDecipheriv, createCipher and createDecipher calls (directly or through a member such as crypto. or forge.cipher.) whose first argument is a string literal ending in -ecb, in any case. An algorithm held in a variable or configuration is not detected. Python and other languages are not covered by this rule. A passing check is not a security proof.

**Interactions when active together:**

- Duplicates `node/NODE-CIPHER-001`: createCipher or createDecipher with an ECB algorithm literal is reported by both rules. Settle: Keep both: NODE-CIPHER-001 flags the deprecated key derivation, SA-ECB-001 the mode. createCipheriv with aes-256-gcm satisfies both.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Cryptography and secrets (misuse of crypto primitives)",
  "paraphrase": "Review for misused cryptographic primitives such as ECB mode, unauthenticated encryption and static IVs."
}
```

### security-audit/SA-RANDOM-001

Check: [`security-audit/crypto/weak-secret-random@1.0.0`](checks/crypto/weak-secret-random/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`, `python`. Cardinality: `singleton`. Dimension: `security-audit.crypto.secret-randomness`. Minimum severity: `none`.

Hardening invariant: Math.random and Python's random module are predictable generators; a token, password, nonce, salt or OTP drawn from them can be guessed. The rule uses names, so a finding needs review of what the value protects.

Default parameters: `{}`.

**Repair:** Use crypto.randomBytes, crypto.randomUUID or crypto.getRandomValues in JavaScript, and the secrets module (secrets.token_urlsafe, secrets.choice) or random.SystemRandom in Python.

**Scope and limits:** Detects Math.random() and module-level random functions (random, randint, randrange, choice, choices, sample, getrandbits, randbytes, uniform, shuffle) inside a variable, assignment, compound assignment (token += ...), object key or Python keyword argument, or the nearest enclosing function, whose name contains token, secret, nonce, salt, password, passwd, passphrase or OTP; and, in TypeScript, Math.random() in a same-file helper that a generator-named secret function (generate, create, make, new, random or issue, then a secret word, such as generateTemporaryPassword) calls. key is deliberately not a trigger because it names React keys and map keys. Request guards named fetch, request, render, load, cancel, page, next, cursor, continuation or cache plus Token (or _token), refreshToken inside a React hook (a use* function), and anything named like a multipart boundary pass. Callbacks passed as arguments are looked through; a nested named helper stops the search. Renamed values, aliases of random and test files are not checked. Vendored paths (vendor/, thirdparty/, third_party/) are skipped. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Cryptography and secrets (weak randomness)",
  "paraphrase": "Values that must be unguessable, such as tokens, keys and nonces, need a cryptographic random source."
}
```

### security-audit/SA-COMPARE-001

Check: [`security-audit/crypto/secret-plain-compare@1.0.0`](checks/crypto/secret-plain-compare/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`, `python`. Cardinality: `singleton`. Dimension: `security-audit.crypto.secret-comparison`. Minimum severity: `none`.

Hardening invariant: == and === stop at the first differing character, so response time can reveal how much of a guessed signature or secret matched. The rule uses names, so a finding needs review of whether the value is secret.

Default parameters: `{}`.

**Repair:** Compare fixed-length buffers with crypto.timingSafeEqual (after checking lengths) or use hmac.compare_digest in Python.

**Scope and limits:** Detects ==, ===, != and !== where one operand is named like a secret (ending in secret or hmac), is an HMAC digest computed inline (createHmac(...).digest(), hmac.new(...).hexdigest()), is a call that produces a digest or token (hmac, *_hmac, *_signature or *_token such as make_token in Python; hmac, *Hmac, *Signature or makeToken in TypeScript; a bare sign is not one, since Math.sign and numpy.sign compare numbers), reads a header whose name contains signature or hmac, is named like a signature (ending in signature, sig, mac or digest) inside a function that mentions HMAC, or holds a configured secret: in TypeScript a `Bearer ${...}` template, or a name the same function assigned from process.env with SECRET, TOKEN, KEY, PASSWORD or PASSWD in the environment variable name, or from such a template (a module-level constant is not linked); in Python an f"Bearer {...}" string, or a token-, secret-, password- or api_key-named operand in a function that assigns such a name from os.environ, os.getenv, get_app_config, app.config or settings with such a key (Python patterns cannot bind the two names, so they are linked by naming); and neither side is null, undefined, None, a boolean, a number, a string literal, a PascalCase identifier (a class or sentinel) or a PascalCase.Member enum reference such as Kind.Secret or Kind.SECRET; a secret kept as such a class constant is therefore not detected. Outside HMAC code, signature and digest names usually mean content fingerprints or file-format magic numbers, so they are not triggers. Comparisons inside offline crackers and self-tests (an enclosing function named like crack, brute, livetest or selftest) pass. Test files are skipped. Vendored paths (vendor/, thirdparty/, third_party/) are skipped. A passing check is not a security proof.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloudflare security-audit skill (cloudflare/security-audit-skill, commit c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)",
  "locator": "https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/ATTACK-CLASSES.md — Cryptography and secrets (timing side-channels on secret comparison)",
  "paraphrase": "Comparisons against secrets can leak them through timing differences."
}
```
