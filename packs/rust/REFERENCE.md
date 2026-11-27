# rust pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **language**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## rust/architecture

Manifest version: `1.0.0`. Status: **preview**.

### rust/RUST-LAYER-001

Check: [`rust/dependencies/layer-direction@1.0.0`](checks/dependencies/layer-direction/check.json). Default severity: **deny**.

Implementation: `layer-edge`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.deps.layers`. Minimum severity: `none`.

The reference reaches a layer this core cannot depend on.

Default parameters: `{"paths":["@layers:core"]}`.

**Repair:** Depend on a declared port and wire the adapter at the application boundary.

**Scope and limits:** Do not hide an adapter behind a pub-use facade, alias or canonical qualified path.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE Rust source policies",
  "locator": "rust.deps.layers, revision 1",
  "paraphrase": "The reference reaches a layer this core cannot depend on."
}
```

## rust/quality

Manifest version: `1.2.0`. Status: **preview**.

### rust/RUST-FN-001

Check: [`rust/complexity/fn-max-lines@1.0.0`](checks/complexity/fn-max-lines/check.json). Default severity: **warn**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.fn.lines`. Minimum severity: `none`.

Function size exceeds the selected source-code limit.

Default parameters: `{"max":45}`.

**Repair:** Extract a cohesive operation and preserve behavior with relevant tests.

**Scope and limits:** Do not compress statements or split a coherent operation arbitrarily.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE Rust source policies",
  "locator": "rust.fn.lines, revision 1",
  "paraphrase": "Function size exceeds the selected source-code limit."
}
```

### rust/RUST-FN-002

Check: [`rust/complexity/fn-max-params@1.0.0`](checks/complexity/fn-max-params/check.json). Default severity: **warn**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.fn.params`. Minimum severity: `none`.

Function parameter count exceeds the selected limit.

Default parameters: `{"max":4}`.

**Repair:** Review whether the inputs describe a cohesive domain value.

**Scope and limits:** Do not hide unrelated inputs in a generic map. Receivers do not count; tuple inputs count each element.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE Rust source policies",
  "locator": "rust.fn.params, revision 1",
  "paraphrase": "Function parameter count exceeds the selected limit."
}
```

### rust/RUST-NEST-001

Check: [`rust/control/max-nesting@1.0.0`](checks/control/max-nesting/check.json). Default severity: **warn**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.control.nesting`. Minimum severity: `none`.

Source control-flow nesting exceeds the selected limit.

Default parameters: `{"max":2}`.

**Repair:** Use an early return or name a cohesive inner operation.

**Scope and limits:** Do not hide nesting in macro token trees; this check measures source AST, not expanded code.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE Rust source policies",
  "locator": "rust.control.nesting, revision 1",
  "paraphrase": "Source control-flow nesting exceeds the selected limit."
}
```

### rust/RUST-GLOB-001

Check: [`rust/dependencies/no-wildcard-use@1.0.0`](checks/dependencies/no-wildcard-use/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.deps.wildcard`. Minimum severity: `none`.

A wildcard use obscures the owner of an identifier.

Default parameters: `{}`.

**Repair:** Use named imports, or document a deliberate prelude or DSL exception.

**Scope and limits:** Do not copy definitions to avoid an import. Reviewed preludes can remain an explicit exception.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE Rust source policies",
  "locator": "rust.deps.wildcard, revision 1",
  "paraphrase": "A wildcard use obscures the owner of an identifier."
}
```

### rust/RUST-STATE-001

Check: [`rust/state/no-mutable-static@1.0.0`](checks/state/no-mutable-static/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.state.mutable-static`. Minimum severity: `none`.

A mutable static needs an explicit synchronization and safety policy.

Default parameters: `{}`.

**Repair:** Prefer a value or a synchronized owner; review FFI and low-level requirements.

**Scope and limits:** Do not replace a mutable static with hidden unsafe global storage.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE Rust source policies",
  "locator": "rust.state.mutable-static, revision 1",
  "paraphrase": "A mutable static needs an explicit synchronization and safety policy."
}
```

### rust/RUST-DBG-001

Check: [`rust/debug/no-dbg-macro@1.0.0`](checks/debug/no-dbg-macro/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.debug.dbg`. Minimum severity: `none`.

dbg! writes file, line and value to stderr on every call, so a leftover one leaks values into production output.

Default parameters: `{}`.

**Repair:** Delete the dbg! and keep its inner expression, or replace it with a log or tracing macro at debug level.

**Scope and limits:** Do not move the call behind an alias, std::dbg! or a #[cfg(not(test))] block. Tests, benches, examples and #[cfg(test)] modules are not checked.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Rust standard library documentation, macro std::dbg",
  "locator": "https://doc.rust-lang.org/std/macro.dbg.html",
  "paraphrase": "dbg! is a debugging tool; avoid keeping uses of it in version control, other than in tests and similar. Production debug output belongs to facilities such as the log crate's debug! macro."
}
```

### rust/RUST-TODO-001

Check: [`rust/completeness/no-todo-macro@1.0.0`](checks/completeness/no-todo-macro/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.completeness.todo`. Minimum severity: `none`.

todo! compiles and type-checks, so a path that looks finished panics the first time it runs.

Default parameters: `{}`.

**Repair:** Implement the path, return an error the caller can handle, or use unimplemented! with a message when the operation is deliberately not provided.

**Scope and limits:** Do not swap todo! for panic!("todo"), an empty default value or core::todo!.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Rust standard library documentation, macros std::todo and std::unimplemented",
  "locator": "https://doc.rust-lang.org/std/macro.todo.html; https://doc.rust-lang.org/std/macro.unimplemented.html",
  "paraphrase": "todo! indicates unfinished code and conveys an intent to implement it later; unimplemented! makes no such claim. Both panic when reached."
}
```

### rust/RUST-UNIMPL-001

Check: [`rust/completeness/no-unimplemented-macro@1.0.0`](checks/completeness/no-unimplemented-macro/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `rust`. Cardinality: `singleton`. Dimension: `rust.completeness.unimplemented`. Minimum severity: `none`.

Leaving unimplemented!() in executable production code creates latent panics on unexplored branches.

Default parameters: `{}`.

**Repair:** Complete the implementation or return a Result::Err value that callers can handle.

**Scope and limits:** Do not deploy code containing active unimplemented!(), std::unimplemented!() or core::unimplemented!() branches.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Rust Standard Library Documentation",
  "locator": "https://doc.rust-lang.org/std/macro.unimplemented.html",
  "paraphrase": "unimplemented!() indicates unfinished or unimplemented code that panics at runtime when reached."
}
```
