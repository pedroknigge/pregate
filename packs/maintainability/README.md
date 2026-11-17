# maintainability

Rules derived from **One Hundred Invariants for Code Maintainable by Future Humans**, **One Hundred Invariant Rules for the Software Engineer–Architect**, and **pstack & Installed Skill Invariants**.

Maintainability is a property of a future reader who was not in the room, does not share the author's vocabulary, and must change the system under incomplete information.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `maintainability/MAINT-NEST-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made preset: `packs/presets/human-maintainability.json`. It selects `maintainability/maintainability` and stays at version 1.0.0. `maintainability/proxies` is preview, so `pack add` does not select it, and the preset does not include it. `MAINT-TEST-001` and `MAINT-ADR-001` deny. A project already on `human-maintainability` does not gain those denials when the pack updates. Enable the proxies with `pregate pack enable maintainability/proxies`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `MAINT-NEST-001` | Control-flow nesting depth exceeding two levels (e.g. 3 nested `if` blocks). | FH Rule 24 / SE Rule 40: Deeply nested decision blocks strain working memory and obscure intent. Deeper decisions should be extracted to named functions. | deny |
| `MAINT-BOOL-001` | Negated or ambiguous boolean names (`isNotActive`, `hasNoAccess`, `noError`, `isInvalid`). | FH Rule 15 / SE Rule 30: Boolean names must state the positive condition. Negated names lead callers into confusing double-negative predicates (e.g. `!isNotActive`). | deny |
| `MAINT-NAME-001` | Placeholder or throwaway identifiers (`temp`, `tmp`, `foo`, `bar`, `baz`, `obj`, `flag`) in exported declarations. | FH Rule 11 & 22: Every exported symbol denotes a domain concept or operation, never an implementation accident. | deny |
| `MAINT-EMPTY-001` | Empty `interface` declarations without members or heritage (`interface Foo {}`). | SE Rule 8 & 1: No abstraction or parameter exists for an unconfirmed requirement. Empty interfaces clutter contracts with speculative type scaffolding. | deny |
| `MAINT-NULL-001` | Direct `return null` and `() => null` in `domain/` TypeScript files. | SE-54: Domain callers benefit from an explicit absent result. This syntax alone cannot establish the full return contract. | warn |
| `MAINT-CLOCK-001` | `Date.now()`, `performance.now()`, or `new Date()` with no arguments in `domain/` TypeScript files. | FH-71: Domain time must enter through an explicit clock or timestamp. | deny |
| `MAINT-IMPL-001` | A class (or const bound to a class) whose name ends in `Impl` or `Implementation`. | FH-19: A name says what the class is or is built on, not that it implements something. | warn |
| `MAINT-DEPR-001` | A JSDoc `@deprecated` tag with no text, inline link or following `@see`. | FH-73: A deprecated surface announces its replacement and removal condition where callers see it. | warn |
| `MAINT-MIGR-001` | A TS/JS module under `migrations/` that defines `up` but no `down`. | FH-38: A migration is reversible, or its `down` throws and states the recovery path. | warn |
| `MAINT-MAGIC-001` | A numeric literal outside 0, 1, -1, 2, 100, and HTTP 100-599, unless it is the direct value of a named binding. | A bare number hides its unit. Naming it is the repair. Warn. | warn |
| `MAINT-TEST-001` | A file under `**/domain/**` with no sibling or mirrored test. | The next reader needs a test next to the domain file. New files only, under the no-new ratchet. | deny |
| `MAINT-ADR-001` | An edit to a configured architecture file (`layers.json`, `boundaries.json`, `architecture.json`) whose diff has no change under `docs/adr/**`. | The decision record moves in the same diff as the map. | deny |
| `MAINT-TODO-001` | A TODO or FIXME comment with no issue id (`#123`, `ABC-123`, or `issues/123`). | The owner check is separate and is not repeated here. Warn. | warn |
| `MAINT-FLAG-001` | A file under the configured risky globs that does not import a feature-flag module. | Defaults cover payments, billing, and checkout. Override both globs and module names. Warn. | warn |
| `MAINT-CHURN-001` | Non-blank lines or the longest function grew in a file whose Git history is above `threshold` (default 8). | Hot files stop growing. Missing history stays quiet. Warn. | warn |
| `MAINT-AND-001` | A function or method name containing the camel-case words `And` or `Then`. | The name says the function has two jobs. Warn. | warn |

The judgment coverage map, including the two items with no honest proxy, is [PROXIES.md](PROXIES.md).

## Methodologies

- `maintainability/maintainability` — MAINT-NEST-001, MAINT-BOOL-001, MAINT-NAME-001, MAINT-EMPTY-001, MAINT-NULL-001, MAINT-CLOCK-001, MAINT-IMPL-001, MAINT-DEPR-001, MAINT-MIGR-001
- `maintainability/proxies` — MAINT-MAGIC-001, MAINT-TEST-001, MAINT-ADR-001, MAINT-TODO-001, MAINT-FLAG-001, MAINT-CHURN-001, MAINT-AND-001
- `maintainability/future-humans` — 100 project-evidence obligations, `FH-01`–`FH-100`.
- `maintainability/engineering` — 100 project-evidence obligations, `SE-01`–`SE-100`.

The complete 200-clause source catalog is in [INVARIANTS.md](INVARIANTS.md).
The two new optional methodologies preserve every complete clause as a `fitness`
obligation. A project binds reviewed assertions to those IDs; failed or stale
evidence for an adopted enforcing assertion blocks check/Stop. Unbound obligations
remain visible as unverified coverage. A syntax finding or a generic passing test
does not prove the full clause. See [adoption and evidence](../../docs/guides/source-invariants.md).
Semantic, human and multi-commit evaluation limits remain in [BACKLOG.md](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **practice**. Version: `1.3.0`. 216 distinct check IDs.

Methodologies: `maintainability/engineering` (preview), `maintainability/future-humans` (preview), `maintainability/maintainability` (complete), `maintainability/proxies` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
