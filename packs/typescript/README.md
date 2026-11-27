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
| `TS-NS-001` | A `namespace` declaration, including one that is exported. | A namespace merges values and types in a way modules already express. `namespace` remains valid TypeScript, so this stays a warning. | warn |
| `TS-MODKW-001` | A namespace written with the `module` keyword (`module Name {}`). Ambient `declare module "pkg"` stays allowed. | TypeScript 7 rejects that keyword. The finding denies when the project is on TypeScript 7.0.0 or newer, and warns on an older or unknown compiler. | deny |
| `TS-ASSERT-001` | `import ... assert { ... }` and `import(path, { assert: ... })` when the project is on TypeScript 7.0.0 or newer. | TypeScript 7 rejects import assertions. Write `with` instead. Older TypeScript still accepts `assert`, so the rule stays quiet there. | deny |
| `TS-WRAPPER-001` | The boxed types `String`, `Number`, `Boolean`, `Symbol` or `Object` in a TS type position, including generic constraints. | They name object wrappers, and Object accepts every primitive, so the annotation stops describing the value. | warn |
| `TS-FLOAT-001` | A statement whose expression is an async-shaped call or new Promise, and is not awaited. | A floating promise rejects into an unhandled rejection. The caller continues as if the work had been scheduled with a result. | deny |
| `TS-THROW-001` | A throw inside a function, method, or arrow that is declared in an export. | A throw on the exported boundary forces every caller into try/catch and loses the typed failure the caller could have handled. | deny |
| `TS-DEFAULT-001` | export default, and export { x as default }. | A default export is renamed by every importer, so a search for the function's name misses call sites. | deny |
| `TS-ENTRY-001` | A page or layout module that does not default-export. | Next.js and similar file routers call the default export of a page or layout. A named export alone is not the entry. | deny |
| `TS-RET-001` | An exported TypeScript function or arrow without a return type annotation. | Optional written public-return policy; JS/MJS files cannot receive TypeScript annotations and are excluded. | deny |
| `TS-AWAIT-001` | An async function or arrow that never awaits. | A needless async hides whether the function suspends; callers await a value that was already there. | deny |
| `TS-STAR-001` | `export *` (including `export * as ns`) re-exports. | A star barrel silently widens whenever the source module gains an export, including collisions across barrels. | deny |
| `TS-CFG-001` | A tsconfig whose merged options omit the strict contract: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`, `target` of ES2022 or newer, and `moduleResolution` of `bundler`, `node16`, or `nodenext`. | One rule. `strict: true` covers its eight flags. `skipLibCheck` and `exactOptionalPropertyTypes` warn and do not deny. | deny |
| `TS-IMPORT-001` | A value import whose uses in this file are only types. | Same-file proxy for `import type`. `verbatimModuleSyntax` is the compiler half, on TS-CFG-001. | warn |
| `TS-CONST-001` | A `let` this file never reassigns. | `const` is the binding that matches the use. `push` is not a reassignment. | deny |
| `TS-INAME-001` | An interface named `I` plus a capital letter. | Spelling. `Input`, `Image`, and `I18n` do not match. | warn |
| `TS-PARSE-001` | A `JSON.parse` or `.json()` result used with a type before a parser. | Same-function state. A parser call clears the binding. | warn |
| `TS-ROARR-001` | An exported array parameter or property that is not `readonly T[]` or `ReadonlyArray<T>`. | The callee can otherwise sort or push the caller's array. | deny |
| `TS-SORT-001` | `.sort()` or `.reverse()` on a parameter. | Copy with `[...items].sort()` or `toSorted`. | deny |
| `TS-CAUSE-001` | A `throw` inside `catch` with no `{ cause }`. | The original error stays on the chain. | deny |
| `TS-DIRECTIVE-001` | `@ts-expect-error` or `@ts-ignore` with no reason in the comment. | The suppression has to say why. | deny |
| `TS-ANY-002` | A file whose explicit `any` count increased. | Diff ratchet. Separate from the non-null count. | deny |
| `TS-BANG-002` | A file whose non-null assertion count increased. | Diff ratchet. `value!!` counts twice. | deny |

## Static analysis

`tsc --noEmit` and eslint are the static-analysis merge gate. They belong to `core/CORE-INV-056` (`core/invariants/static-analysis-merge-gate`). Bind that requirement with one project command that runs both. This pack does not declare a second fitness check for them. Packs never supply executable fitness commands.

## Fidelity

These checks say what they can see. The methodology `avoid` text is the limit.

- `TS-CFG-001` is a mechanical merge of `extends`. A package that is not installed is not proof an option is off. A references-only solution file is skipped. `skipLibCheck` and `exactOptionalPropertyTypes` are warnings.
- `TS-IMPORT-001` is a same-file proxy. A use in another file is invisible. An unused import is not reported. A namespace import is not classified.
- `TS-CONST-001` is same-file. An assignment in another file is invisible. A shadowed inner `let` is its own binding.
- `TS-INAME-001` is spelling. `ID` matches. `I18n` does not.
- Boolean parameters and boolean property bags are one family, `senior/SR-FLAG-001` and `senior/SR-FLAG-002`. This pack does not declare a second copy.
- `TS-PARSE-001` follows bindings in source order. Either branch of an `if` can keep the taint. A method named `json` that is not `Response.json` is still tainted, so a typed use of it is a false positive. `as unknown as User` is a typed use.
- `TS-ROARR-001` looks at the outermost array. `readonly tags: string[]` still fails. A class method and `export { load }` are not seen.
- `TS-SORT-001` requires the receiver to be the parameter. `const alias = items; alias.sort()` is not seen.
- `TS-CAUSE-001` requires a direct `{ cause }` on the thrown call. A cause nested inside another call does not count.
- `TS-DIRECTIVE-001` checks that the comment has a reason. It does not judge the reason. `@ts-nocheck` is not this rule. A reasoned `@ts-ignore` still fails `TS-IGNORE-001` when that rule is on.
- `TS-ANY-002` and `TS-BANG-002` count syntax nodes. Comments and strings do not count. The two counts cannot cancel each other.

## Methodologies

- `typescript/strict-types` — TS-ANY-001, TS-SWITCH-001, TS-BANG-001, TS-ENUM-001, TS-BOOL-001, TS-EXPORT-ANY-001, TS-READONLY-001, TS-NS-001, TS-MODKW-001, TS-WRAPPER-001
- `typescript/compiler` — TS-CFG-001. Opt in. Existing presets that enable `strict-types` do not gain this rule.
- `typescript/checked` — TS-IMPORT-001, TS-CONST-001, TS-INAME-001, TS-PARSE-001, TS-ROARR-001, TS-SORT-001, TS-CAUSE-001, TS-DIRECTIVE-001, TS-ANY-002, TS-BANG-002. Opt in.
- `typescript/async-results` — TS-FLOAT-001, TS-THROW-001
- `typescript/named-exports` — TS-DEFAULT-001
- `typescript/framework-entries` — TS-ENTRY-001
- `typescript/discipline` — TS-RET-001, TS-AWAIT-001, TS-STAR-001
- `typescript/legacy` also includes `TS-ASSERT-001` (with TS-LEGACY-001 through TS-LEGACY-005). It denies import assertions only when TypeScript 7.0.0 or newer is installed or declared.

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

Category: **language**. Version: `1.4.0`. 37 distinct check IDs.

Methodologies: `typescript/anti-evasion` (preview), `typescript/async-results` (preview), `typescript/checked` (preview), `typescript/compiler` (preview), `typescript/discipline` (preview), `typescript/framework-entries` (preview), `typescript/legacy` (preview), `typescript/named-exports` (preview), `typescript/strict-types` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
