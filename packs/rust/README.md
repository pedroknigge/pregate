# Rust source policies

`rust/quality` observes configurable function size, parameter count, nesting, wildcard imports, mutable statics, `dbg!` outside test code and `todo!` placeholders. These seven policies default to `warn`; a project can review their limits and promote them. `rust/architecture` denies new forbidden layer references after the project approves its layer contract. `rust-starter` uses quality in shadow with a no-new ratchet.

The engine parses `.rs` with pinned tree-sitter Rust. It checks source syntax, real comment markers, function/trait signatures and closures, source AST patterns, explicit use trees and canonical `crate::`, `self::`, `super::`, `std::`, `core::`, `alloc::` paths. Module resolution is bounded to explicit conventional Cargo source trees with editions 2018, 2021 or 2024. It does not run Cargo or expand macros, infer types or trait dispatch, validate compiler features, or certify an executable program.

Restricted unresolved module contracts fail closed: custom roots, inherited/default 2015 editions, `#[path]`/conditional module configuration, ambiguous module files, unknown external crates, path dependencies and `include!` need a supported explicit contract. Ordinary macros such as `println!` and `assert!` do not invalidate source-only metrics. Their token-tree internals and arbitrary macro-generated modules/imports remain outside AST-source coverage. Use compiler/build tests as separate evidence.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **language**. Version: `1.2.0`. 9 distinct check IDs.

Methodologies: `rust/architecture` (preview), `rust/quality` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
