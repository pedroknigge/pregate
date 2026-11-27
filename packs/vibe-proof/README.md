# vibe-proof

Production-readiness checks from the vibe-proof auditor that the syntax tree can decide: secrets in source, client-exposed secret names, console and debugger leftovers, TODOs without an owner, unbounded reads, missing timeouts, stack traces in responses, SQL interpolation, timers without a clear, ignored build errors, wildcard CORS with credentials, raw request bodies written through, and dangerouslySetInnerHTML. Empty catch is core (`CC-ER-002`). Floating promises are the typescript pack. Everything that needs a running system or a human is in the backlog.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `vibe-proof/VP-SECRET-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `VP-SECRET-001` | A live-looking API key, cloud key id, private-key banner, or user:password@ URL in a string, template, or comment. | A secret in source is copied into git, into logs, and into every worktree. Rotation then means rewriting history. | deny |
| `VP-CLIENT-SECRET-001` | A NEXT_PUBLIC_, VITE_, or EXPO_PUBLIC_ name that also says SECRET, TOKEN, PASSWORD, SERVICE_ROLE, or PRIVATE_KEY. | Those prefixes are inlined into the client bundle. A server secret under that name ships to the browser. | deny |
| `VP-TIMEOUT-001` | fetch, axios verb, or http(s).get/request whose arguments do not mention signal, timeout, or AbortSignal. | A network call with no deadline can hang the request until the process is killed. | deny |
| `VP-SQL-001` | A .query, .execute, .raw, or .unsafe call whose text contains a template interpolation. | A value spliced into SQL is an injection point. The database sees the caller's text as syntax. | deny |
| `VP-CORS-001` | An object that sets origin to "*" and credentials to true. | A credentialed request reflected to every origin lets any site call the API with the user's cookies. | deny |
| `VP-MASS-001` | A call that spreads req.body or request.body, Object.assigns it, or passes it straight into insert, update, create, or save. | The body can carry role, price, or owner. Writing it through copies those fields into the row. | deny |
| `VP-HTML-001` | The name dangerouslySetInnerHTML. | The prop inserts markup. A string that passed through a user becomes script in the page. | deny |
| `VP-HTML-002` | Writing a non-literal string to innerHTML, outerHTML, insertAdjacentHTML or document.write. | The DOM parses the string as markup, so user text becomes script. | deny |
| `VP-STACK-001` | err.stack, error.stack, or exception.stack passed to send, json, end, write, or status. | A stack trace shows file paths, dependency versions, and sometimes query text to the caller. | deny |
| `VP-INPUT-001` | request.json() or req.json() in a function that does not call safeParse. | The JSON body is untyped input. Using it without a parser lets a missing field or an extra field through as if it were an invoice. | deny |
| `VP-CONSOLE-001` | console.log, debug, trace, info, dir, and table, including bracket access and globalThis.console. Not in test files. | A leftover log prints invoices, ids, and payloads to whatever stdout production captures. | deny |
| `VP-DEBUG-001` | A debugger statement outside tests. | debugger stops a browser or inspector on the production path when devtools are attached, and it marks a session that was not finished. | deny |
| `VP-TODO-001` | TODO, FIXME, HACK, or XXX unless the marker is TODO(owner) with an owner of at least two characters. | An ownerless TODO is a broken path with no one named to finish it. Six months later it still says later. | deny |
| `VP-FIND-MANY-001` | findMany() whose arguments do not mention take, limit, or cursor. | An unbounded findMany loads every matching row. The list grows with the table and the request grows with it. | deny |
| `VP-SELECT-001` | A call whose string or template contains select * and whose text has no limit. | select * with no limit pulls every column of every matching row into the process. | deny |
| `VP-INTERVAL-001` | setInterval when no ancestor block also calls clearInterval. | A timer that is never cleared keeps the callback and anything it closed over for the life of the process. | deny |
| `VP-BUILD-001` | ignoreBuildErrors: true or ignoreDuringBuilds: true. | The flag ships a build the type checker or the linter already rejected. The demo stays green while the errors stay. | deny |

## Methodologies

- `vibe-proof/secrets` — VP-SECRET-001, VP-CLIENT-SECRET-001
- `vibe-proof/transport` — VP-TIMEOUT-001, VP-SQL-001, VP-CORS-001, VP-MASS-001, VP-HTML-001, VP-HTML-002, VP-STACK-001, VP-INPUT-001
- `vibe-proof/hygiene` — VP-CONSOLE-001, VP-DEBUG-001, VP-TODO-001, VP-FIND-MANY-001, VP-SELECT-001, VP-INTERVAL-001, VP-BUILD-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **practice**. Version: `1.1.0`. 17 distinct check IDs.

Methodologies: `vibe-proof/hygiene` (preview), `vibe-proof/secrets` (preview), `vibe-proof/transport` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
