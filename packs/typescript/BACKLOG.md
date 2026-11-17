# typescript backlog

Judgment, or checks the syntax tree cannot decide without guessing types.

- **Branded IDs.** Whether `OrderId` and `InvoiceId` should be distinct brands is a domain decision. Two parameters that share a name is not proof they are the same concept.
- **satisfies versus as.** `as const` is allowed by other packs where they care. Choosing satisfies over a widening annotation needs the intended type, which the tree does not know.
- **Optional fields versus a union.** A missing field can be a real absence or a lazy model. The pack flags `Partial<T>` on an exported patch in the pstack pack, not every optional property.
- **Return-type annotations on locals.** Useful, and also noise. Only exported functions and arrows are required here (TS-RET-001).
- **Prefer interfaces or type aliases.** Both are structural. The choice is local style.
- **No type assertions at all.** Core already flags a double assertion. A single `as` outside domain code is often a boundary parse. pstack flags `as` inside domain files.
- **Template-literal types, variance, and conditional types.** Power tools. Banning them is a style preference, not an invariant.
- **Import type across files.** TS-IMPORT-001 sees a value import whose uses in the same file are only types. A binding used as a value in another file, and a namespace import, stay out of the rule.
- **Enum-like const objects that are mutated.** The pack bans `enum`. A mutable `const` object used as a union is a separate judgment.
- **Floating promises that do not look async.** A function named `save` that returns a promise is invisible without types. This pack only sees an Async suffix, `.then` / `.catch` / `.finally`, `Promise.all` and its siblings, an async IIFE, and `new Promise`.
- **`unknown` versus `any` in generic boundaries.** Requiring `unknown` instead of unbounded generics can impede ergonomic library consumption when callers need to supply concrete types.
- **Const assertions on arrays.** When an array literal represents a fixed tuple of options versus a mutable collection is a semantic choice.
- **TypeScript 7.0 compiler options.** TS-CFG-001 reads the merged tsconfig for `strict`, the flags named in the typescript README, `target` of ES2022 or newer, `verbatimModuleSyntax`, and `moduleResolution` of `bundler`, `node16`, or `nodenext`. Still unenforced: `baseUrl`, `downlevelIteration`, `moduleResolution` of `node`, `node10`, and `classic`, `module` of `amd`, `umd`, `systemjs`, and `none` except where that module is already an incoherent pair, `esModuleInterop: false`, `allowSyntheticDefaultImports: false`, `outFile`, and `types: []`. `skipLibCheck` and `exactOptionalPropertyTypes` are warnings on TS-CFG-001, not denials.
- **Re-export import assertions.** `export { row } from "./rows.json" assert { type: "json" }` is the same removed keyword, but the vendored grammar does not parse that clause as an import attribute. TS-ASSERT-001 does not guess at the error node.
