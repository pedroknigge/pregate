# Language analysis

The published 0.2.11 pilot includes JS/TS, Python and Go analysis. The unpublished
0.2.12 checkout adds Rust with the vendored `tree-sitter-rust` 0.24.2 WASM grammar,
source metrics, structural patterns, comments and bounded Cargo module resolution.
Language policies remain optional packs; core policy remains language-independent.
See [v0.0.1 release notes](../releases/0.0.1.md) for verification of this checkout. Native pilot
release verification targets macOS ARM64; Linux and Windows remain experimental
until their native gates close.

Post-release public audits expose valid newline-separated generic type members
and type-only wildcard exports rejected by 0.2.5. Version 0.2.6 repairs those
cases and the subsequently reduced nested generic function type argument with
compiler/parser controls. The 0.2.5 observations
retain their historical scope. A new 0.2.6 held-out audit
finds valid `in`/`out` interface variance annotations rejected by the parser.
Version 0.2.7 repairs that defect in both TS and TSX grammars. Valid annotations,
constraints/defaults, AST names/spans and retained import locations pass; malformed
annotation controls remain rejected. The patched grammars pass all 112 upstream
corpus tests. The annotation syntax is defined in the
[TypeScript 4.7 documentation](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html#optional-variance-annotations-for-type-parameters).
Parser support is not compiler equivalence.

## Select policies independently

`pregate init --preview` recommends `python-starter`, `go-starter`, `rust-starter` or `mixed-starter`
from source files and project metadata. Mixed initialization includes only detected
Python/Go/Rust packs and adds JS/TS clean-code when applicable. Rust files and Cargo
metadata inform discovery. Quality starts in shadow;
all 68 core defaults remain active. The four integrity guards enforce attempted
changes. The 64 project requirements, including the
original 48 software invariants, need reviewed
[project verification](project-fitness.md) independently of language policy.
Existing projects are not replaced or re-enabled by init.

```sh
pregate pack list --library
pregate pack show --library python/quality --json
pregate rules test --library python
pregate pack add --library python --preview
# Review and approve the displayed digest, then select only what is useful:
pregate pack enable python/quality --only PY-FN-002,PY-NEST-001 --preview
```

Python adds seven checks and Go adds six; their 65 fixtures include passing,
failing and trap cases. Rust adds six checks with 30 pack fixtures. Quality
defaults use configurable function-size 50,
parameter-count 4 and nesting 2 limits; Python public-method count defaults to 10.
Bare-except and dot-import checks warn. These are PREGATE starter heuristics,
not official language guidance or proof of maintainability.

Python and Go provide `<ns>/architecture` and `<ns>/effects`; Rust provides
`rust/architecture`. These require explicitly declared layers and selection;
initialization does not infer or activate those policies. Python, Go and
Rust dimensions are independent of JS/TS, so selecting one does not change another
language's thresholds. Bundled sources pin version and evaluable content; see
[pack composition](pack-composition.md) for approval and update semantics.

Release archives embed the grammars. After building, run
`bun run scripts/smoke-languages.ts` to admit a
temporary ten-fixture Python/Go pack, audit both expected findings and reject
growth/syntax using the native binary. This passes on macOS arm64; cross-building
does not verify native Linux/Windows behavior or real harness UI interaction.

`check.languages` declares the languages of a primitive check. Pattern checks
declare their language implementations under `impl.patterns`. Existing checks
without a declaration retain their JS/TS scope. Integrity guards use supported
parser comment tokens and a conservative fallback for unsupported executable
source. In supported source, strings are not executable directives; JSON values
and Markdown examples do not count as source comment directives.
Read the marker contract and limits.
Each promised language needs its own minimum two
passing, two failing and one trap fixture, plus alias-default coverage. Empty
implementations, duplicate languages and a Go class metric are rejected.

`status --json` lists each rule's languages, phases, paths, intersected `within`
scope and exclusions. Audit
reports `fileCoverage` for each parsed source and separates unsupported files
from parsed Python/Go/Rust files with no applicable language policy (`uncovered`).
Those uncovered files make the audit incomplete (exit 2); installing a parser
does not establish compliance with a pack that has no rules for that language.
An intentionally scoped rule also does not cover files outside its paths or
`within` restriction. Framework recommendations use owning package scopes;
explicitly authored scope parameters are preserved. Annotation requirements in
the TypeScript pack apply to TS/TSX/MTS/CTS files, not JS/MJS files.

## Observable facts

Python function parameters include `self`/`cls` and each variadic argument as one
parameter, excluding positional/keyword separators. Go grouped names each count
as a parameter; a variadic argument counts as one and the receiver is excluded.
Function size is the greater of nonblank, noncomment source lines and observable
statement count. Nested statements remain part of their containing function.

Rust metrics inspect function bodies, trait signatures and closures. A receiver
is excluded from the parameter budget; tuple destructuring contributes its
observable elements. Rust has no `class.publicMethods` metric. Macros are parsed
as source token trees and are not expanded; generated bodies and trait/type
semantics are outside these measurements.

Nesting counts mixed control statements, keeps else-if chains at the same depth
and restarts at a nested function. Python public-method counts cover directly
declared function names without a leading underscore, including decorated
definitions. Properties are counted as declarations; this is not a count of
runtime-callable attributes. Go has no class metric.

Structural pattern predicates (`kind`, `has`, `inside`, `regex`, and supported
combinations) use the selected grammar. A TypeScript pattern string or `$X`
metavariable must not be assumed valid Python, Go or Rust. Whole-program Go snippets
require their package declaration; unsupported snippet syntax fails admission.

## Import boundaries

Python resolution models regular packages under the project root or `src/`,
explicit relative imports and `from module import name` as a child module or an
attribute of the base module. Ambiguous roots and known missing local modules
are unresolved. It follows imports in package initializers, including parent
initializers, within the same three-hop/32-file bounds used for JS/TS facades.
Unknown canonical dynamic loads in a restricted layer are unresolved.

Python namespace packages, arbitrary `PYTHONPATH`/`sys.path` mutation, search
hooks, loader aliases, dynamically assigned attributes and value flow are not
modeled. External dependency contents are not traversed. Canonical one-argument
literal `__import__`/`importlib.import_module` calls are observed; additional
arguments or relative dynamic loading require context the resolver does not infer.
The [Python import reference](https://docs.python.org/3/reference/import.html)
describes the runtime behavior beyond this static model.

Go resolution maps the nearest `go.mod` module prefix and unversioned local
replacements to package directories, such as `internal/infra/`. Layer paths must
include the package directory (for example `internal/infra/**`); a `.go`-only glob
does not classify a whole package. Blank/dot/renamed imports use their literal
package path, with escape decoding. Changed module files trigger unchanged
importer review against independently resolved before/after contexts.

Go workspaces, version-specific replacements and replacements outside the
project are unresolved. Remote dependency content, build tags, module graph
selection and actual compilation are not evaluated. The resolver does not prove
that a mapped package exists or builds. See the
[Go module reference](https://go.dev/ref/mod#go-mod-file) and
[import specification](https://go.dev/ref/spec#Import_declarations).

These checks inspect source facts, not compiler/type/runtime correctness. Run
the project's language-specific compiler, tests and linters alongside PREGATE.

## Rust module limits

Rust source analysis observes explicit `use` trees, grouped/renamed imports,
`extern crate`, module declarations, public re-exports and canonical qualified
paths, including qualified generic parameter types. Resolution follows
conventional Cargo `src/lib.rs` or `src/main.rs` roots and declared `foo.rs` or
`foo/mod.rs` modules. Relative `crate`, `self` and `super` paths use that module
context. Item suffixes map to their containing source module; this is not name
or type resolution. Inline modules share a source file, so file-based layer rules
cannot distinguish two inline modules in that same file.

Import resolution requires an explicit Cargo edition of 2018, 2021 or 2024.
The 2015 default and inherited workspace editions remain unresolved; source
metrics do not require Cargo module resolution.

Custom library/binary roots, ambiguous layouts, conditional/custom module
attributes, generated `include!` source and local path dependencies require context
this model does not resolve. Restricted import contracts report unresolved
analysis rather than treating those paths as verified. Ordinary `println!` or
`assert!` does not invalidate a source-only metric result. Macro expansion,
procedural macros, build scripts, feature selection and runtime linking remain
outside the source model.
Workspace-inherited dependencies, Cargo patch/replace tables and repository or
ancestor Cargo configuration also make restricted resolution incomplete. Cargo
and configuration files are tracked resolver inputs; changing them triggers
dependent importer review. This does not infer a full Cargo dependency graph.

The [Rust module reference](https://doc.rust-lang.org/reference/items/modules.html)
and [Cargo target reference](https://doc.rust-lang.org/cargo/reference/cargo-targets.html)
describe the compiler behavior beyond these limits. Use the optional pack only
for its declared scope and run `cargo test`, Clippy and your actual build separately.
