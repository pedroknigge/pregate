# security-audit rules pack

Optional static hardening rules derived from the [Cloudflare security-audit skill](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8), reviewed at commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`. This is a PREGATE adaptation. It is not affiliated with or endorsed by Cloudflare. The upstream skill is source material only: selecting this pack does not run its audit workflow, prompts, profiles or validators, and none of them are bundled.

[BACKLOG.md](BACKLOG.md) records the upstream guidance this pack does not turn into checks yet and why. [REFERENCE.md](REFERENCE.md) gives each executable rule's precise scope, defaults, provenance and repairs. See the [pack library](../README.md) and [conversion guide](../../docs/guides/docs-to-rule-pack.md).

## What a finding means

Every rule is a hardening invariant: it names a code form that removes a safety control (certificate verification, a safe loader, an origin check) or that routes data into an obvious dangerous sink. A finding is a reason to review that line, not a confirmed vulnerability; exploitability depends on reachability and input trust that static syntax cannot establish.

A passing check is not a security proof. It says only that the listed forms were not found in the scanned files. It does not establish that the project was audited, that untrusted input is handled safely, or that any vulnerability class is absent. A real audit still needs threat modeling, reachability and independent validation of each candidate.

## Selectable policies

Both methodologies are **preview**. Exact forms that disable a control default to **deny**, forms whose risk depends on input trust default to **ask**, and name-based heuristics default to **warn** until a pilot measures their precision.

### `security-audit/obvious-sinks`

Python, Go, Rust and TypeScript forms that disable transport verification, deserialize or evaluate data unsafely, build shell commands from strings, use weak cipher modes or generate secrets from non-cryptographic sources.

| Rule | Language | Observable finding | Default |
| --- | --- | --- | --- |
| `SA-PY-YAML-001` | Python | `yaml.load` or `yaml.load_all` without a loader or with an object-constructing loader, or `yaml.unsafe_load`/`yaml.full_load` | deny |
| `SA-PY-DESER-001` | Python | `pickle`-family `load`/`loads`/`Unpickler`, `marshal.load(s)` or `shelve.open` | ask |
| `SA-PY-TLS-001` | Python | `verify=False` on a requests/httpx call or session, a fetch/request/download wrapper or a call on a URL, `ssl._create_unverified_context`, or `verify_mode = ssl.CERT_NONE` | deny |
| `SA-PY-SHELL-001` | Python | Any call with `shell=True` and a non-literal command, or `os.system`/`os.popen` with a built string (UPPER_CASE constants count as literal) | deny |
| `SA-PY-SHELL-002` | Python | `os.system`/`os.popen` with a command held in a variable, attribute or subscript | ask |
| `SA-PY-EVAL-001` | Python | Builtin `eval` or `exec` with a non-literal argument (`compile()` of a literal counts as literal) | ask |
| `SA-PY-DEBUG-001` | Python | `app.run(debug=True)` (Flask, Flask-SocketIO) without a literal loopback `host=` | warn |
| `SA-GO-TLS-001` | Go | `InsecureSkipVerify` is set to `true` in a TLS config literal or assignment | deny |
| `SA-GO-SHELL-001` | Go | `exec.Command("sh", "-c", ...)` with a script built by `fmt.Sprintf` or `+` | deny |
| `SA-RS-TLS-001` | Rust | `.danger_accept_invalid_certs(true)` or `.danger_accept_invalid_hostnames(true)` | deny |
| `SA-ECB-001` | TS/TSX | A `create(De)Cipher(iv)` algorithm literal ending in `-ecb` | deny |
| `SA-RANDOM-001` | TS/TSX, Python | `Math.random()` or `random.*` producing a value named like a token, secret, nonce, salt, password or OTP (not `key`, request guards or multipart boundaries), or in a helper a secret generator calls | warn |
| `SA-COMPARE-001` | TS/TSX, Python | `==`/`===` on a secret, an inline HMAC digest or digest call, a signature header, a signature or digest name in HMAC code, or a value read from a secret environment or config key, against a non-literal | warn |

Input-dependent and name-based rules (`SA-PY-DESER-001`, `SA-PY-SHELL-002`, `SA-PY-EVAL-001`, `SA-RANDOM-001`, `SA-COMPARE-001`) skip test files, and every ask and warn rule skips `vendor/`, `thirdparty/` and `third_party/` paths. Before admission the rules were run over about 15,000 installed Python files and 50,000 TypeScript/JavaScript files; that run narrowed `SA-COMPARE-001` away from bare `signature` and `digest` names, which mostly named content fingerprints and file-format magic numbers. A second pilot on six projects (about 2,700 Python files and one Next.js app) tightened `SA-RANDOM-001`, `SA-COMPARE-001`, `SA-PY-SHELL-001`, `SA-PY-EVAL-001` and `SA-PY-DEBUG-001` and widened `SA-PY-TLS-001`, `SA-COMPARE-001` and `SA-ORIGIN-001` where the misses had a precise form.

### `security-audit/client-and-agents`

TypeScript browser messaging, credentialed CORS, token verification options and LLM SDK clients exposed to the browser.

| Rule | Language | Observable finding | Default |
| --- | --- | --- | --- |
| `SA-POSTMSG-001` | TS/TSX | A parent, opener, top or `contentWindow` `postMessage` uses the `"*"` target origin | deny |
| `SA-ORIGIN-001` | TS/TSX | An inline or same-file named window `message` handler reads `data` but never the event's `origin` (worker files excluded) | warn |
| `SA-CORS-002` | TS/TSX | `origin: true` with `credentials: true`, or an unguarded `Access-Control-Allow-Origin` reflected from the request in a credentialed file | deny |
| `SA-JWT-001` | TS/TSX, Python | `ignoreExpiration: true`, an `algorithms` list containing `"none"`, or PyJWT `verify_signature` / `verify_exp` set to `False` | deny |
| `SA-LLM-001` | TS/TSX | An LLM SDK client sets `dangerouslyAllowBrowser: true`, or a request sends Anthropic's direct-browser-access header | ask |

## Coverage and compatibility

Version `1.0.0`; included with engine 0.0.6. Patterns use PREGATE's TypeScript/TSX, Python, Go and Rust grammars. Name-based patterns do not resolve imports, aliases or values that flow through variables. No YAML, Dockerfile, HCL or CI workflow checks are included; those need [engine support](../ENGINE-REQUESTS.md).

The existing `vibe-proof`, `express` and `agent-practices` packs cover adjacent forms (wildcard CORS with credentials, an open CORS header, security-review practices). Rules here that overlap them declare explicit relations.

## Inspect, validate and adopt

From the PREGATE repository:

```sh
bun src/main.ts rules test --library security-audit
bun src/main.ts pack show --library security-audit --json
```

With an engine built from this checkout:

```sh
pregate rules test --library security-audit
pregate pack add --library security-audit --preview
# Review and approve the displayed source candidate.
pregate pack enable security-audit/obvious-sinks --preview
pregate pack enable security-audit/client-and-agents --preview
```

Adding the source and selecting methodologies are separate operations. This contribution registers bundled data; it does not activate rules in an existing project.

## Provenance and changes

Review date: 2026-10-24. Every admitted invariant links a file at the pinned revision and names the relevant section. Requirements are paraphrased; upstream prose, prompts, schemas and validators are not copied. Upstream is MIT licensed; its copyright and permission notice are preserved in [LICENSE](LICENSE). Upstream is not versioned, so a changed pin requires a new review of every cited section before publishing a changed pack version.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **practice**. Version: `1.0.0`. 18 distinct check IDs.

Methodologies: `security-audit/client-and-agents` (preview), `security-audit/obvious-sinks` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
