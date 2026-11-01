# typescript

Optional TypeScript boundary policies and supported syntax checks. This pack prefers string unions, readonly exported data, named exports and result-returning functions. These choices are not universal language requirements. A justification comment exempts only the next statement. Framework entry files that must default-export opt into `typescript/framework-entries` instead of sharing the ban.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `typescript/TS-ANY-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `TS-ANY-001` | The any type, unless the immediately previous statement is a comment containing pregate-allow-any:. | any turns off checking for every value that flows through it. Opt-in project policy. | off |
| `TS-SWITCH-001` | A switch whose own default does not throw, return, or mention never. | A union that gains a member stays compilable when the switch has no exhaustiveness check, and the new member falls through. | warn |
| `TS-BANG-001` | A non-null assertion (! after an expression). | The assertion is a local presence claim. Opt-in. | off |
| `TS-ENUM-001` | enum and const enum declarations. | Enums are valid TypeScript. Opt-in style choice. | off |
| `TS-BOOL-001` | An if, while, do, or for condition whose expression is .length, a string literal, a number literal, or a ! chain on .length. | A length or a literal used as a condition hides the comparison. 0 and "" are easy to misread as a boolean the domain named. | warn |
| `TS-EXPORT-ANY-001` | An unannotated TS parameter directly owned by a directly exported function or unannotated exported function-valued variable, including defaulted parameters. | Optional explicit-boundary policy; inference is valid TypeScript. Opt-in. JS/MJS are excluded. | off |
| `TS-READONLY-001` | A property signature that is not readonly, inside an exported interface or type alias, except options, config, and input types. | Opt-in. Readonly on every public property changes library APIs. Options, config, and input bags stay exempt when the check is enabled. | off |
| `TS-NS-001` | A namespace declaration, including one that is exported. | A namespace merges values and types in a way modules already express, and it encourages a second module system inside the file. | warn |
| `TS-WRAPPER-001` | The boxed types `String`, `Number`, `Boolean`, `Symbol` or `Object` in a TS type position, including generic constraints. | They name object wrappers, and Object accepts every primitive, so the annotation stops describing the value. | warn |
| `TS-FLOAT-001` | A statement whose expression is an async-shaped call or new Promise, and is not awaited. | A floating promise rejects into an unhandled rejection. The caller continues as if the work had been scheduled with a result. | deny |
| `TS-THROW-001` | A throw inside a function, method, or arrow that is declared in an export. | A throw on the exported boundary forces every caller into try/catch and loses the typed failure the caller could have handled. | deny |
| `TS-DEFAULT-001` | export default, and export { x as default }. | A default export is renamed by every importer, so a search for the function's name misses call sites. | deny |
| `TS-ENTRY-001` | A page or layout module that does not default-export. | Next.js and similar file routers call the default export of a page or layout. A named export alone is not the entry. | deny |
| `TS-RET-001` | An exported TypeScript function or arrow without a return type annotation. | Optional written public-return policy; JS/MJS files cannot receive TypeScript annotations and are excluded. | deny |
| `TS-AWAIT-001` | An async function or arrow that never awaits. | A needless async hides whether the function suspends; callers await a value that was already there. | deny |
| `TS-STAR-001` | `export *` (including `export * as ns`) re-exports. | A star barrel silently widens whenever the source module gains an export, including collisions across barrels. | deny |

## Methodologies

- `typescript/strict-types` — TS-ANY-001, TS-SWITCH-001, TS-BANG-001, TS-ENUM-001, TS-BOOL-001, TS-EXPORT-ANY-001, TS-READONLY-001, TS-NS-001, TS-WRAPPER-001
- `typescript/async-results` — TS-FLOAT-001, TS-THROW-001
- `typescript/named-exports` — TS-DEFAULT-001
- `typescript/framework-entries` — TS-ENTRY-001
- `typescript/discipline` — TS-RET-001, TS-AWAIT-001, TS-STAR-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

Source 1.0.2 preserves inferred callbacks in
exported function bodies and parameters of explicitly annotated function-valued
exports. TS-EXPORT-ANY-001 expresses an optional explicit-annotation policy,
not proof that every missing annotation is implicit any. Defaults and contextual
types can provide inference. This selected policy still requires `limit: number = 25`
or `now: Date = new Date()` on a directly exported TS signature; plain JS/MJS files
are excluded from both public-annotation checks. Propose a scoped override if
inferred public defaults are the project decision; enforce noImplicitAny with a
compiler assertion. No new implicit-any diagnosis or causal maintainability
claim follows from these syntax findings.
See [TypeScript contextual typing](https://www.typescriptlang.org/docs/handbook/type-inference).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **language**. Version: `1.2.0`. 24 distinct check IDs.

Methodologies: `typescript/anti-evasion` (complete), `typescript/async-results` (complete), `typescript/discipline` (complete), `typescript/framework-entries` (complete), `typescript/legacy` (complete), `typescript/named-exports` (complete), `typescript/strict-types` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
