# typescript pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.4.0`. Category: **language**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## typescript/anti-evasion

Manifest version: `1.2.0`. Status: **complete**.

### typescript/EVA-DYN-001

Check: [`typescript/integrity/no-dynamic-import-in-layer@1.1.1`](checks/integrity/no-dynamic-import-in-layer/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `integrity.dynamic-load`. Minimum severity: `deny`.

A module name computed at runtime hides the dependency from every layer and package rule.

Default parameters: `{"paths":["@layers"]}`.

**Repair:** Import the module with a literal specifier from a layer this one may use; plugins come in as values from the composition root.

**Scope and limits:** Building the path in a variable, template literals with substitutions, aliasing require or calling it through .call or module.require, createRequire, eval or new Function, also read off globalThis.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE anti-evasion policy",
  "locator": "SPEC §10.1 (dynamic imports)",
  "paraphrase": "Inside a declared layer every dependency is statically resolvable; otherwise neither layer nor package rules can see it."
}
```

### typescript/EVA-CAST-001

Check: [`typescript/integrity/double-type-assertion@1.1.0`](checks/integrity/double-type-assertion/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `integrity.type-erasure`. Minimum severity: `none`.

A double assertion silences the compiler where the types disagree. `as unknown as T` is also the documented way to cross a boundary the checker cannot see, so the default contract advises.

Default parameters: `{}`.

**Repair:** Validate the value with a type guard or a parser and build the target type from it, or fix the type where the value comes from.

**Scope and limits:** Parentheses around the inner assertion, angle-bracket assertions, going through never or unknown[] instead of unknown, or an intermediate variable typed as unknown.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE anti-evasion policy",
  "locator": "SPEC §6.2 (EVA-CAST-001)",
  "paraphrase": "Asserting through unknown or any turns the type checker off for that value; a value that does not fit its type is converted or validated instead."
}
```

### typescript/TS-IGNORE-001

Check: [`typescript/integrity/no-ts-ignore@1.0.0`](checks/integrity/no-ts-ignore/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.ts-ignore`. Minimum severity: `none`.

A @ts-ignore comment suppresses the next line without requiring an error to be present. Prefer @ts-expect-error, but an existing @ts-ignore is not itself a defect, so the default contract advises. New suppressions are still denied by core/EVA-SUP-001.

Default parameters: `{}`.

**Repair:** Replace @ts-ignore with @ts-expect-error and provide an issue URL or description, or fix the underlying type error.

**Scope and limits:** Do not leave bare @ts-ignore without justification or in a block comment. Use narrowing or type assertions only when sound.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript Handbook: Release Notes 3.9",
  "locator": "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#-ts-expect-error-comments",
  "paraphrase": "Prefer @ts-expect-error comments to @ts-ignore comments because @ts-expect-error forces an error to be present."
}
```

## typescript/async-results

Manifest version: `1.0.1`. Status: **complete**.

### typescript/TS-FLOAT-001

Check: [`typescript/async/no-floating-promise@1.0.0`](checks/async/no-floating-promise/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `async.floating-promise`. Minimum severity: `none`.

A floating promise rejects into an unhandled rejection. The caller continues as if the work had been scheduled with a result.

Default parameters: `{}`.

**Repair:** Await the call, return the promise, or prefix it with void when the fire-and-forget is intentional.

**Scope and limits:** Adding .catch that ignores the error still leaves the promise floating. void is the explicit discard. fetch without an Async name is a timeout rule in the vibe-proof pack, not this one.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript ESLint, no-floating-promises",
  "locator": "floating promises",
  "paraphrase": "A promise that is not awaited, returned, or explicitly ignored can reject with nobody handling it."
}
```

### typescript/TS-THROW-001

Check: [`typescript/errors/no-throw-in-export@1.0.0`](checks/errors/no-throw-in-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `errors.exported-throw`. Minimum severity: `none`.

A throw on the exported boundary forces every caller into try/catch and loses the typed failure the caller could have handled.

Default parameters: `{}`.

**Repair:** Return a result object such as { ok: true, value } or { ok: false, error } and let the caller branch.

**Scope and limits:** Throwing from an exported arrow is the same boundary. A private function that is not inside the export may throw; the export should translate that into a result.

**Interactions when active together:**

- Contradicts `trpc/TRPC-ERR-001` (compiles only once the preset records it in `settled`): TRPC-ERR-001 tells procedures to throw a TRPCError, and TS-THROW-001 denies every throw inside an exported function; routers are exported, so following one fix violates the other. Settle: Exclude router files from TS-THROW-001 (for example **/routers/** or **/server/api/**): tRPC turns a thrown TRPCError into the typed failure the client branches on.
- Contradicts `sveltekit/SK-FORM-001` (compiles only once the preset records it in `settled`): SK-FORM-001 tells form actions to throw error() for unexpected failures, and TS-THROW-001 denies that throw inside the exported actions object. Settle: On SvelteKit 2 call error(...) without the throw keyword: it throws itself and no throw statement remains. On SvelteKit 1, exclude **/+page.server.ts and **/+server.ts from TS-THROW-001.
- Contradicts `sveltekit/SK-ERROR-001` (compiles only once the preset records it in `settled`): SK-ERROR-001 tells load functions to throw error(500, ...) with a static message, and TS-THROW-001 denies that throw inside the exported load. Settle: On SvelteKit 2 call error(...) without the throw keyword: it throws itself and no throw statement remains. On SvelteKit 1, exclude the **/+page.server.ts, **/+layout.server.ts and **/+server.ts route files from TS-THROW-001.
- Contradicts `nestjs/NEST-CODE-001` (compiles only once the preset records it in `settled`): NEST-CODE-001 directs error responses to a thrown HttpException, and TS-THROW-001 denies throws inside methods of an exported controller class. Settle: Exclude **/*.controller.ts from TS-THROW-001: Nest maps a thrown HttpException to the response. Keep TS-THROW-001 on services and domain code.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Functional error handling, typed results",
  "locator": "return a result instead of throwing across a boundary",
  "paraphrase": "Expected failures are values. Reserve throw for defects. An exported function lists its failures in its return type."
}
```

## typescript/checked

Manifest version: `1.0.0`. Status: **complete**.

### typescript/TS-IMPORT-001

Check: [`typescript/modules/type-only-import@1.0.0`](checks/modules/type-only-import/check.json). Default severity: **warn**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `modules.type-only-import`. Minimum severity: `none`.

Fidelity: same-file proxy. A value import whose uses in this file are only type positions is reported. The compiler half is verbatimModuleSyntax on TS-CFG-001. This check warns because it cannot see another file.

Default parameters: `{}`.

**Repair:** Write import type, or import { type Name }. Turn on verbatimModuleSyntax in tsconfig so the compiler checks the same choice across files.

**Scope and limits:** An unused import is not reported. A namespace import is not classified. typeof Name is a value use. A use in another file is invisible. import type and an inline type specifier already match this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, modules",
  "locator": "import type and verbatimModuleSyntax",
  "paraphrase": "A binding used only as a type should be imported as a type, so the emit does not keep a value import the program never calls."
}
```

### typescript/TS-CONST-001

Check: [`typescript/style/prefer-const@1.0.0`](checks/style/prefer-const/check.json). Default severity: **deny**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `style.prefer-const`. Minimum severity: `none`.

Fidelity: same-file. A let with no assignment, update, or destructuring assignment in this file should be const. Mutation such as push is not a reassignment, so the binding is still const. var and parameter mutation belong to senior, not this rule.

Default parameters: `{}`.

**Repair:** Change the let to const. If the binding is assigned later in this file, keep let.

**Scope and limits:** A for-loop i++ is a reassignment. An inner let is a different binding from an outer one with the same name. An assignment in another file, including to an export, is invisible. declare let is skipped. push, index writes, and property writes do not count as reassignment.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "ESLint, prefer-const",
  "locator": "let that is never reassigned",
  "paraphrase": "If a binding is never assigned again, const says so. let promises a later assignment that does not exist."
}
```

### typescript/TS-INAME-001

Check: [`typescript/types/no-i-prefix@1.0.0`](checks/types/no-i-prefix/check.json). Default severity: **warn**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `types.interface-prefix`. Minimum severity: `none`.

Fidelity: spelling. An interface whose name matches I followed by a capital letter is reported, exported or not. This warns because ID and similar abbreviations are the same spelling and the rule cannot tell them apart.

Default parameters: `{}`.

**Repair:** Drop the I. User stays User. Keep names such as Input, Image, and I18n; they do not match.

**Scope and limits:** I18n does not match because the character after I is a digit. Input, Image, and Id do not match. The rule does not look at type aliases or classes.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, do's and don'ts",
  "locator": "do not prefix interfaces with I",
  "paraphrase": "An I prefix names the declaration kind. The interface should be named for the concept."
}
```

### typescript/TS-PARSE-001

Check: [`typescript/types/parsed-boundary@1.0.0`](checks/types/parsed-boundary/check.json). Default severity: **warn**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `types.parsed-boundary`. Minimum severity: `none`.

Fidelity: state, same function. JSON.parse and any call named json start tainted. A later parse, safeParse, validate, decode, parseAsync, or safeParseAsync clears the binding. as T, other than as unknown alone, and a type annotation other than unknown are typed uses. An if keeps the taint when either branch leaves it tainted. This warns because a method named json is not always Response.json.

Default parameters: `{}`.

**Repair:** Pass the value through a parser before the annotation or the cast. as unknown is not a parser. schema.parse and schema.safeParse clear the binding.

**Scope and limits:** The check follows bindings and aliases in source order in this file only. A method named json that does not read a response is still tainted, so a typed use of it is a false positive. An untyped return is not a finding. as unknown as User is a finding on the outer cast. A parser named something else is not recognized.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Parse, don't validate (A. King, 2019)",
  "locator": "parse at the boundary",
  "paraphrase": "A value that crossed a text boundary is unknown until a parser returns a typed value. A cast only claims the type."
}
```

### typescript/TS-ROARR-001

Check: [`typescript/types/readonly-array@1.0.0`](checks/types/readonly-array/check.json). Default severity: **deny**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `types.readonly-array`. Minimum severity: `none`.

The outermost array of a directly exported function or arrow parameter, and of a property on a directly exported interface or type alias, must be readonly T[] or ReadonlyArray<T>. The same applies to an array property inside the type of such a parameter. TS-READONLY-001 is a different, opt-in rule about every public property.

Default parameters: `{}`.

**Repair:** Write readonly string[] or ReadonlyArray<string>. Copy before sorting. A readonly modifier on the property does not make the array readonly.

**Scope and limits:** Nested arrays inside an outer ReadonlyArray are not walked. Class methods are not included. A function that is only re-exported by export { load } is not seen. A local function is not included.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, readonly arrays",
  "locator": "readonly T[] and ReadonlyArray",
  "paraphrase": "A function that takes an array it only reads should say so. A mutable array type allows sort, reverse, and push on the caller's value."
}
```

### typescript/TS-SORT-001

Check: [`typescript/types/clone-before-mutation@1.0.0`](checks/types/clone-before-mutation/check.json). Default severity: **deny**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `types.clone-before-mutation`. Minimum severity: `none`.

A direct sort or reverse on an identifier that resolves to a parameter mutates the caller. [...items].sort(), items.slice().sort(), and toSorted or toReversed do not. The receiver has to be that identifier, parentheses included.

Default parameters: `{}`.

**Repair:** Copy first: return [...items].sort() or return items.toSorted(). toReversed is the copy for reverse.

**Scope and limits:** const alias = items; alias.sort() is not seen, because the receiver is not the parameter identifier. items[0] and a method call other than sort or reverse are not this rule. A local array is not a parameter.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, array methods",
  "locator": "sort, reverse, toSorted, toReversed",
  "paraphrase": "sort and reverse mutate the array they are called on. A parameter is the caller's array unless the function copies it first."
}
```

### typescript/TS-CAUSE-001

Check: [`typescript/errors/rethrow-cause@1.0.0`](checks/errors/rethrow-cause/check.json). Default severity: **deny**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `errors.rethrow-cause`. Minimum severity: `none`.

Every throw inside a catch must pass an object property named cause, either as a pair or as a shorthand. Empty catch stays clean-code CC-ER-002. A throw that is not inside catch is not this rule, and TS-THROW-001 still owns throws on an exported boundary.

Default parameters: `{}`.

**Repair:** throw new Error("failed", { cause: error }) or throw new Error("failed", { cause }).

**Scope and limits:** The cause property has to be a direct argument object of the thrown call, or the thrown object itself. A cause nested inside another call is not accepted. Putting the caught value in the message does not count.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "ECMAScript 2022, Error cause",
  "locator": "Error options cause",
  "paraphrase": "A thrown error can carry the error that caused it. A rethrow that drops the caught value drops the stack."
}
```

### typescript/TS-DIRECTIVE-001

Check: [`typescript/integrity/directive-reason@1.0.0`](checks/integrity/directive-reason/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `integrity.directive-reason`. Minimum severity: `none`.

A comment that is only @ts-expect-error or @ts-ignore has no reason. TS-IGNORE-001 still forbids @ts-ignore outright. core EVA-SUP-001 ratchets new suppressions. This rule is the missing reason, including on @ts-expect-error, which the ignore ban allows.

Default parameters: `{}`.

**Repair:** Write the reason on the same comment: // @ts-expect-error the generated type is wrong.

**Scope and limits:** @ts-nocheck is not this rule. A reason is any non-space text after the directive. A reasoned @ts-ignore still fails TS-IGNORE-001 when that rule is on. The reason is not checked for truth.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, ts-expect-error",
  "locator": "suppress a line with a reason",
  "paraphrase": "@ts-expect-error and @ts-ignore hide a compiler diagnostic. The comment has to say why the line is exempt."
}
```

### typescript/TS-ANY-002

Check: [`typescript/types/any-no-increase@1.0.0`](checks/types/any-no-increase/check.json). Default severity: **deny**.

Implementation: `diff`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `types.any-count`. Minimum severity: `none`.

Diff ratchet, no-increase. The count is syntax nodes of the any type. Existing any stays. A new any, including Array<any>, denies. TS-ANY-001 remains the opt-in ban and stays off. Comments and strings do not count. This count is separate from the non-null count so the two cannot cancel.

Default parameters: `{}`.

**Repair:** Name the type, or use unknown and narrow it. Do not add any to pay for removing a non-null assertion.

**Scope and limits:** The finding is the file's new total, reported on line 1. A comment that says any, or the string "any", is not a type. pregate-allow-any does not lower this count.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective TypeScript (D. Vanderkam)",
  "locator": "item on any versus unknown",
  "paraphrase": "any disables the checker for everything it touches. A file should not gain more of them."
}
```

### typescript/TS-BANG-002

Check: [`typescript/types/non-null-no-increase@1.0.0`](checks/types/non-null-no-increase/check.json). Default severity: **deny**.

Implementation: `diff`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `types.non-null-count`. Minimum severity: `none`.

Diff ratchet, no-increase. The count is non-null syntax nodes. Existing assertions stay. A new one denies. TS-BANG-001 remains the opt-in ban and stays off. value!! counts twice. This count is separate from the any count.

Default parameters: `{}`.

**Repair:** Narrow with a conditional, or change the type so the value is present. Do not add ! to pay for removing an any.

**Scope and limits:** The finding is the file's new total, reported on line 1. !== is a comparison, not this operator. A comment that contains ! is not an assertion.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective TypeScript (D. Vanderkam)",
  "locator": "non-null assertions",
  "paraphrase": "A postfix ! tells the checker a value is present. The file should not gain more of those claims."
}
```

## typescript/compiler

Manifest version: `1.0.0`. Status: **complete**.

### typescript/TS-CFG-001

Check: [`typescript/config/compiler-options@1.0.0`](checks/config/compiler-options/check.json). Default severity: **deny**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `config.compiler`. Minimum severity: `none`.

A project that compiles with strict off, an old target, or a classic module resolution accepts programs the rest of this pack assumes the compiler already rejected. One merged tsconfig finding covers that contract. skipLibCheck and exactOptionalPropertyTypes are advice: a finding for either is a warning and does not deny the edit.

Default parameters: `{}`.

**Repair:** Set strict, noUncheckedIndexedAccess, noImplicitOverride, noImplicitReturns, noFallthroughCasesInSwitch, forceConsistentCasingInFileNames, and verbatimModuleSyntax to true. Set target to ES2022 or newer. Set moduleResolution to bundler, node16, or nodenext, and pair node16 or nodenext with the same module kind. A solution file that only has references is skipped.

**Scope and limits:** strict: true is one finding when it is missing or false, not eight findings for the flags it implies. An explicit false on one of those eight is its own finding. A value inherited from an extended config counts, and the child wins. An extends that names a package which is not installed is not proof an option is off. A missing or cyclic local extends is one finding. skipLibCheck and exactOptionalPropertyTypes never deny. tsc --noEmit and eslint are not this check: bind both to core/CORE-INV-056, the static-analysis merge gate. This pack does not declare a second fitness command.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, compiler options",
  "locator": "strict and module resolution",
  "paraphrase": "strict turns on the null, any, function, bind, property, this, catch, and always-strict checks together. The rest of the contract is the flags and the module settings a current compiler expects."
}
```

## typescript/discipline

Manifest version: `1.0.2`. Status: **complete**.

### typescript/TS-RET-001

Check: [`typescript/types/require-return-on-export@1.0.1`](checks/types/require-return-on-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `typescript.export-return`. Minimum severity: `none`.

An inferred return type leaks implementation detail into the boundary. Renaming an internal helper silently changes every importer's type.

Default parameters: `{}`.

**Repair:** Annotate the return type on the exported function or arrow function.

**Scope and limits:** Marking the function async does not replace a return type. The promise still publishes an untyped boundary.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective TypeScript (D. Vanderkam)",
  "locator": "type annotations on exported signatures",
  "paraphrase": "An exported signature is a contract other modules compile against. Its return type should be written, not inferred."
}
```

### typescript/TS-AWAIT-001

Check: [`typescript/async/no-async-without-await@1.0.0`](checks/async/no-async-without-await/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `typescript.async-await-presence`. Minimum severity: `none`.

A needless async hides whether the function suspends. Callers await a value that was already there.

Default parameters: `{}`.

**Repair:** Remove async when nothing suspends, or await the asynchronous work the function performs.

**Scope and limits:** Mentioning await in a comment does not suspend the function. Only an await expression counts.

**Interactions when active together:**

- Works against the conventions of `nextjs`: Next.js server actions must be async functions even when they do not await anything. Settle: Exclude the files that declare server actions (for example **/actions.ts or app/**/actions/**) from TS-AWAIT-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, async functions",
  "locator": "async without await",
  "paraphrase": "An async function that never awaits wraps its result for no reason. Either the suspension is missing or async is decoration."
}
```

### typescript/TS-STAR-001

Check: [`typescript/exports/no-export-star@1.0.0`](checks/exports/no-export-star/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `typescript.export-star`. Minimum severity: `none`.

Adding an export to the source module silently widens every star barrel above it, including name collisions across barrels.

Default parameters: `{}`.

**Repair:** List the re-exported bindings by name in the barrel file.

**Scope and limits:** Aliasing the star to a namespace still republishes every binding it does not name.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, modules",
  "locator": "barrel re-exports",
  "paraphrase": "A barrel should name what it republishes. A star re-export publishes bindings the barrel never reviewed."
}
```

## typescript/framework-entries

Manifest version: `1.0.1`. Status: **complete**.

### typescript/TS-ENTRY-001

Check: [`typescript/exports/require-default-export@1.0.0`](checks/exports/require-default-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `modules.default-export`. Minimum severity: `none`.

Next.js and similar file routers call the default export of a page or layout. A named export alone is not the entry.

Default parameters: `{}`.

**Repair:** Default-export the page or layout component. typescript/named-exports excludes these globs by default and keeps the named-export ban for the rest of the program.

**Scope and limits:** A comment that looks like export default does not create one. export { Page as default } does. Assigning exports.default is not this syntax.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router and Pages Router",
  "locator": "page and layout modules",
  "paraphrase": "A page or layout module is loaded through its default export. The file is the route."
}
```

## typescript/legacy

Manifest version: `1.1.0`. Status: **complete**.

### typescript/TS-LEGACY-001

Check: [`typescript/types/no-triple-slash-reference@1.0.0`](checks/types/no-triple-slash-reference/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `typescript.triple-slash-reference`. Minimum severity: `none`.

A reference directive hides the dependency from the module graph. Imports name the dependency where the file declares it.

Default parameters: `{}`.

**Repair:** Replace the directive with an import of the types the file uses.

**Scope and limits:** A types directive is the same mechanism as a path directive. Both must become imports.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook",
  "locator": "triple-slash directives",
  "paraphrase": "Triple-slash reference directives are a legacy way to pull in declarations. Modules state their dependencies with imports."
}
```

### typescript/TS-LEGACY-002

Check: [`typescript/modules/no-declare-global@1.0.0`](checks/modules/no-declare-global/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `typescript.declare-global`. Minimum severity: `none`.

A declare global block lets any file depend on bindings no import names, so removing the augmentation breaks distant files silently.

Default parameters: `{}`.

**Repair:** Move the declarations to a module and import them where they are used.

**Scope and limits:** declare module is a different shape and stays allowed. A single var inside declare global is still a global augmentation.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook",
  "locator": "global augmentations",
  "paraphrase": "A global augmentation adds bindings to every module at once. Prefer explicit imports that name what a module needs."
}
```

### typescript/TS-LEGACY-003

Check: [`typescript/exports/no-anonymous-default@1.0.0`](checks/exports/no-anonymous-default/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `typescript.anonymous-default`. Minimum severity: `none`.

An anonymous default export shows up as unknown in stack traces and breaks fast refresh, which keys on the component name.

Default parameters: `{}`.

**Repair:** Name the function before default-exporting it, or export a named binding.

**Scope and limits:** Adding async does not name the function. Only a binding with a name counts.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook",
  "locator": "default exports",
  "paraphrase": "A default export should carry a name. An anonymous default leaves stack traces and tooling with nothing to display."
}
```

### typescript/TS-LEGACY-004

Check: [`typescript/modules/no-export-assign@1.0.0`](checks/modules/no-export-assign/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `typescript.export-assign`. Minimum severity: `none`.

An export assignment replaces the whole module surface with one value, so adding a second export changes what every importer receives.

Default parameters: `{}`.

**Repair:** Export each binding by name, and default-export a named binding where an entry point needs one.

**Scope and limits:** Assigning an object literal is the same form as assigning an identifier. export default is a different syntax and stays allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook",
  "locator": "export assignment",
  "paraphrase": "export = is the legacy CommonJS interop form. Modules publish their surface with named exports."
}
```

### typescript/TS-LEGACY-005

Check: [`typescript/types/no-constructor-param-property@1.0.0`](checks/types/no-constructor-param-property/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `typescript.param-property`. Minimum severity: `none`.

A parameter property hides an assignment inside the signature, so a reader of the body misses state the constructor sets.

Default parameters: `{}`.

**Repair:** Declare the field on the class and assign the parameter to it in the constructor body.

**Scope and limits:** A mixed list with one plain parameter still declares a property for each decorated one. readonly alone on a parameter is the same declaration.

**Interactions when active together:**

- Duplicates `ddd/DDD-ENT-002`: A public constructor parameter property is reported by TS-LEGACY-005 as a parameter property and by DDD-ENT-002 as mutable domain state. Settle: Declare a private field and assign it in the constructor body; that satisfies both rules.
- Contradicts `nestjs/NEST-CTRL-001` (compiles only once the preset records it in `settled`): NEST-CTRL-001 tells controllers to receive providers as private readonly constructor parameters, and TS-LEGACY-005 denies constructor parameter properties. Settle: Nest also injects plain constructor parameters: declare the field and assign it in the constructor body to satisfy both, or exclude Nest controllers and providers from TS-LEGACY-005.
- Contradicts `nestjs/NEST-INJ-001` (compiles only once the preset records it in `settled`): NEST-INJ-001 tells callers to receive providers as constructor parameters, the Nest idiom being private readonly parameter properties, which TS-LEGACY-005 denies. Settle: Nest also injects plain constructor parameters: declare the field and assign it in the constructor body to satisfy both, or exclude Nest controllers and providers from TS-LEGACY-005.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook",
  "locator": "constructor parameter properties",
  "paraphrase": "A visibility modifier on a constructor parameter silently declares and assigns a field. Declare the field and assign it in the body."
}
```

### typescript/TS-ASSERT-001

Check: [`typescript/modules/no-import-assert@1.0.0`](checks/modules/no-import-assert/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `modules.import-assert`. Minimum severity: `none`.

TypeScript 7.0 turns the TypeScript 6.0 deprecation of import assertions into a parse error, so the file does not compile. The replacement with is valid import-attribute syntax. The rule runs only when the project installs or declares TypeScript 7.0.0 or newer, because older compilers still accept assert.

Default parameters: `{}`.

**Repair:** Replace assert with with. A static import becomes import rates from "./rates.json" with { type: "json" }. A dynamic import renames the option: import("./rates.json", { with: { type: "json" } }).

**Scope and limits:** with { type: "json" } is the replacement and is allowed. A return type of asserts value is T, and a call to a function named assert, are not import assertions. The announcement's spelling asserts is not the keyword the compiler rejects. A re-export such as export { row } from "./rows.json" assert { type: "json" } is not recognized by the parser this check uses. The rule stays quiet when TypeScript is missing, older than 7.0.0, or only a pre-release.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Announcing TypeScript 7.0, and the TypeScript 6.0 implementation of the import-assertion deprecation",
  "locator": "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/",
  "paraphrase": "TypeScript 7 rejects an import assertion. Write with { type: \"json\" } instead of assert { type: \"json\" }. The announcement spells the keyword asserts; the compiler diagnostic says assert."
}
```

## typescript/named-exports

Manifest version: `1.1.0`. Status: **complete**.

### typescript/TS-DEFAULT-001

Check: [`typescript/exports/no-default-export@1.0.0`](checks/exports/no-default-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `modules.default-export`. Minimum severity: `none`.

A default export is renamed by every importer, so a search for the function's name misses call sites.

Default parameters: `{"exclude":["**/pages/**","**/app/**/page.ts","**/app/**/page.tsx","**/app/**/layout.ts","**/app/**/layout.tsx"]}`.

**Repair:** Export the function or class by name. Page and layout entries are excluded by default; enable typescript/framework-entries to require their default export.

**Scope and limits:** export { Page as default } is a default export. A comment that contains the words export default is not one. exports.default = Page is an assignment, not this syntax, and is a hole.

**Interactions when active together:**

- Works against the conventions of `nuxt`: Nuxt loads server routes, middleware and plugins from their default export (export default defineEventHandler(...)). Settle: Exclude server/**, middleware/**, plugins/** and nuxt.config.ts from TS-DEFAULT-001.
- Works against the conventions of `react-native`: Expo Router loads screens and layouts under app/ from their default export. Settle: Exclude the app/** route files from TS-DEFAULT-001 and keep named exports for components and modules elsewhere.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Google TypeScript style and Airbnb JavaScript style",
  "locator": "named exports",
  "paraphrase": "Prefer named exports so the binding has one name at the definition and at the import."
}
```

## typescript/strict-types

Manifest version: `1.5.0`. Status: **complete**.

### typescript/TS-ANY-001

Check: [`typescript/types/no-explicit-any@1.0.0`](checks/types/no-explicit-any/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.explicit-any`. Minimum severity: `none`.

any turns off checking for every value that flows through it. Banning it is a project type policy, and strict libraries still use it at boundaries, so the default contract leaves this check off. Opt in with an override severity of warn or deny.

Default parameters: `{}`.

**Repair:** Give the value a named type, or accept unknown and narrow it before use. If a third-party payload truly has no schema, put pregate-allow-any: and the reason on the comment directly above that statement.

**Scope and limits:** A marker inside a string, or a marker above an earlier statement, does not cover a later any. as unknown as T is a different escape and is still a cast.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective TypeScript (D. Vanderkam)",
  "locator": "item on any versus unknown",
  "paraphrase": "Prefer unknown when a value's type is not yet known. any disables the checker for everything it touches."
}
```

### typescript/TS-SWITCH-001

Check: [`typescript/types/exhaustive-switch@1.0.0`](checks/types/exhaustive-switch/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.exhaustive-switch`. Minimum severity: `none`.

A union that gains a member stays compilable when the switch has no exhaustiveness check. Requiring a throw, return, or never in default is a prescribed shape, so the default contract advises.

Default parameters: `{}`.

**Repair:** Add a default that assigns the remaining value to never and then throws or returns it, so a new union member fails the build.

**Scope and limits:** default: break compiles and does nothing. A nested switch's default does not count for the outer switch.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective TypeScript (D. Vanderkam)",
  "locator": "exhaustiveness checking",
  "paraphrase": "Use the type checker to prove a switch covered every member of a union. A default that accepts never fails the build when a member is added."
}
```

### typescript/TS-BANG-001

Check: [`typescript/types/no-non-null-assertion@1.0.0`](checks/types/no-non-null-assertion/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.non-null`. Minimum severity: `none`.

A non-null assertion is a local claim that a value is present, not proof that it is absent. Strict code uses it after a check the syntax rule cannot see, so the default contract leaves this check off. Opt in with an override severity of warn.

Default parameters: `{}`.

**Repair:** Narrow with a conditional, use optional chaining and a fallback, or change the callee so it does not return null.

**Scope and limits:** Writing the assertion twice (value!!) is still an assertion. !== is a comparison, not this operator.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective TypeScript (D. Vanderkam)",
  "locator": "non-null assertions",
  "paraphrase": "A postfix ! tells the checker to assume a value is present. That assumption is unchecked at runtime."
}
```

### typescript/TS-ENUM-001

Check: [`typescript/types/no-enum@1.0.0`](checks/types/no-enum/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.enum`. Minimum severity: `none`.

A numeric enum invents a reverse map. A string enum is still valid TypeScript, so banning every enum is a style choice and the default contract leaves this check off. Opt in with an override severity of warn.

Default parameters: `{}`.

**Repair:** Replace the enum with a union of string literals, and keep the list next to the function that switches on it.

**Scope and limits:** const enum still declares an enum. It only changes emit. A union is the replacement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective TypeScript (D. Vanderkam)",
  "locator": "enums versus unions",
  "paraphrase": "Prefer a union of string literals to an enum. The union does not emit a reverse mapping, and each member is its value."
}
```

### typescript/TS-BOOL-001

Check: [`typescript/types/strict-boolean-condition@1.0.0`](checks/types/strict-boolean-condition/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.strict-boolean`. Minimum severity: `none`.

A length or a literal used as a condition hides the comparison. Using length as a condition is idiomatic JavaScript, so the default contract advises.

Default parameters: `{}`.

**Repair:** Compare length to 0, or name a boolean. Leave a plain identifier alone when the checker cannot see the type.

**Scope and limits:** if (!!items.length) is still a length used as a boolean. if (items.length > 0) is the comparison.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, strict boolean checks, and Google TypeScript style",
  "locator": "boolean conditions",
  "paraphrase": "Conditions should be booleans. Do not rely on the truthiness of a number or a string when the comparison can be written."
}
```

### typescript/TS-EXPORT-ANY-001

Check: [`typescript/types/export-parameter-typed@1.0.2`](checks/types/export-parameter-typed/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.export-param`. Minimum severity: `none`.

This optional public-boundary policy requires explicit parameter annotations on directly exported TypeScript functions, including defaulted parameters. TypeScript correctly infers limit = 25 or now = new Date(). The default contract leaves the check off. Opt in with an override severity of warn. A finding does not prove implicit any or a type-checker defect.

Default parameters: `{}`.

**Repair:** Write limit: number = 25 or now: Date = new Date(), or annotate the exported function-valued variable. Keep inferred implementation callbacks unchanged. If inferred public defaults are the project policy, propose a scoped override or replace this optional style check with a compiler assertion; do not add impossible TypeScript annotations to JavaScript.

**Scope and limits:** Only .ts/.tsx/.mts/.cts parameters directly owned by a directly exported function or an unannotated exported function-valued variable are checked. Inferred literal and constructor defaults still require annotations under this selected policy. Nested callbacks, annotated function-valued variables and plain JavaScript are allowed. Re-exported declarations, class members and shorthand single-parameter arrows require compiler evidence; this syntax rule does not replace noImplicitAny.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript strict mode, noImplicitAny",
  "locator": "exported signatures",
  "paraphrase": "Explicit public function annotations are an optional boundary policy. TypeScript also supports contextual inference, so inferred inner callbacks and annotated function-valued exports are valid."
}
```

### typescript/TS-READONLY-001

Check: [`typescript/types/readonly-exported-property@1.1.0`](checks/types/readonly-exported-property/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.readonly-export`. Minimum severity: `none`.

A mutable field on an exported type lets any caller reassign data the owner thought it controlled. Requiring readonly on every public property changes library APIs, so the default contract leaves this check off. Opt in with an override severity of warn. Options, config, and input bags stay exempt either way, because marking them readonly would reject legal construction of the public API.

Default parameters: `{}`.

**Repair:** When the project opts in, add readonly to properties of exported data the caller must not mutate. Leave options, config, and input types mutable.

**Scope and limits:** The syntax check covers properties in directly exported interfaces, type aliases and explicit function/method signature annotations, including nested public types. It skips a directly exported interface or type alias whose name starts or ends with Options, Config, Configuration, or Input, including OptionsInit and RetryOptions, and nested properties of that type. Executable bodies, runtime assertions and runtime call type arguments are implementation context. Marking one public field readonly does not cover the next. Class field declarations and a non-exported type followed by export { Type } require additional compiler evidence.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective TypeScript (D. Vanderkam)",
  "locator": "readonly public data",
  "paraphrase": "Prefer readonly for data other modules can see, so a change has to go through an operation that returns a new value."
}
```

### typescript/TS-NS-001

Check: [`typescript/types/no-namespace@1.2.0`](checks/types/no-namespace/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.namespace`. Minimum severity: `none`.

A namespace merges values and types in a way modules already express. namespace remains valid TypeScript, including for declaration merging, so the default contract advises.

Default parameters: `{}`.

**Repair:** Move the values to an ES module and export them by name.

**Scope and limits:** export namespace is still a namespace. A namespace written with the module keyword is TS-MODKW-001. declare module "pkg" is an ambient module. A class or a plain object does not need a namespace.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, namespaces and modules",
  "locator": "modules over namespaces",
  "paraphrase": "For application code, ES modules replace namespaces. A namespace is an older container that merges across files."
}
```

### typescript/TS-MODKW-001

Check: [`typescript/types/no-module-keyword@1.0.0`](checks/types/no-module-keyword/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.module-keyword`. Minimum severity: `none`.

module Name is a hard compile error on TypeScript 7.0. namespace remains valid, so this rule denies only when the project installs or declares TypeScript 7.0.0 or newer. On an older or unknown compiler the same declaration is a warning.

Default parameters: `{}`.

**Repair:** Replace module with namespace, or move the values into an ES module and export them by name.

**Scope and limits:** declare module "pkg", declare module 'pkg' and declare module "*.json" name an ambient module and stay allowed. export module and declare module Billing are still the keyword form. A namespace keyword is TS-NS-001, not this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Announcing TypeScript 7.0",
  "locator": "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/",
  "paraphrase": "TypeScript 7 rejects a namespace written with the module keyword. Write namespace, or export the values from an ES module. declare module \"pkg\" stays valid."
}
```

### typescript/TS-WRAPPER-001

Check: [`typescript/types/no-boxed-primitive-type@1.1.0`](checks/types/no-boxed-primitive-type/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `types.boxed-primitive`. Minimum severity: `none`.

A boxed type names an object wrapper the code almost never holds, Object accepts every primitive, and Function accepts any callable without parameter or return type safety.

Default parameters: `{}`.

**Repair:** Write string, number, boolean or symbol. Replace Object with object, unknown or a named shape, and replace Function with a specific signature such as () => void.

**Scope and limits:** Generic constraints and type arguments are type positions too. Value calls such as String(x) or Object.keys are not types. A global interface String augmentation and a qualified name such as Wire.Object are allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TypeScript handbook, Do's and Don'ts",
  "locator": "https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html#number-string-boolean-symbol-and-object",
  "paraphrase": "Don't use the types Number, String, Boolean, Symbol, Object or Function. They refer to boxed objects or untyped callables. Use number, string, boolean, symbol, object, and specific function types."
}
```
