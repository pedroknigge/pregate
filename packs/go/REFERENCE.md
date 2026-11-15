# go pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **language**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## go/architecture

Manifest version: `1.0.0`. Status: **complete**.

### go/GO-LAYER-001

Check: [`go/dependencies/layer-direction@1.0.0`](checks/dependencies/layer-direction/check.json). Default severity: **deny**.

Implementation: `layer-edge`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.deps.layers`. Minimum severity: `none`.

The import reaches a layer this core is not allowed to depend on.

Default parameters: `{"paths":["@layers:core"]}`.

**Repair:** Depend on a declared port and wire the adapter at the application boundary.

**Scope and limits:** Do not hide an adapter behind a package initializer, alias or local module replacement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "go deps.layers, revision 1",
  "paraphrase": "The import reaches a layer this core is not allowed to depend on."
}
```

## go/effects

Manifest version: `1.0.0`. Status: **complete**.

### go/GO-IO-001

Check: [`go/dependencies/no-core-io-imports@1.0.0`](checks/dependencies/no-core-io-imports/check.json). Default severity: **deny**.

Implementation: `banned-import`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `multi`. Dimension: `go.deps.packages`. Minimum severity: `none`.

The core imports a selected I/O package.

Default parameters: `{"paths":["@layers:core"],"packages":["os","net","database/sql"]}`.

**Repair:** Move this effect behind an injected port and implement the operation in an adapter.

**Scope and limits:** This checks literal imports, not all runtime effects; do not rename the package or obscure the loading call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "packages": {
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "go deps.packages, revision 1",
  "paraphrase": "The core imports a selected I/O package."
}
```

## go/quality

Manifest version: `1.2.0`. Status: **complete**.

### go/GO-FN-001

Check: [`go/complexity/fn-max-lines@1.0.0`](checks/complexity/fn-max-lines/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.fn.lines`. Minimum severity: `none`.

Function size exceeds the selected limit.

Default parameters: `{"max":50}`.

**Repair:** Extract a cohesive operation and preserve behavior with relevant tests.

**Scope and limits:** Do not compress statements onto one line or split a single state machine into arbitrary fragments.

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
  "work": "PREGATE language starter policies",
  "locator": "go fn.lines, revision 1",
  "paraphrase": "Function size exceeds the selected limit."
}
```

### go/GO-FN-002

Check: [`go/complexity/fn-max-params@1.0.0`](checks/complexity/fn-max-params/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.fn.params`. Minimum severity: `none`.

Function parameter count exceeds the selected limit.

Default parameters: `{"max":4}`.

**Repair:** Review whether the inputs describe a cohesive domain object.

**Scope and limits:** Do not hide unrelated inputs in a generic options map; Python self/cls and variadic parameters count, Go receivers do not.

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
  "work": "PREGATE language starter policies",
  "locator": "go fn.params, revision 1",
  "paraphrase": "Function parameter count exceeds the selected limit."
}
```

### go/GO-NEST-001

Check: [`go/control/max-nesting@1.0.0`](checks/control/max-nesting/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.control.nesting`. Minimum severity: `none`.

Control-flow nesting exceeds the selected limit.

Default parameters: `{"max":2}`.

**Repair:** Use an early return or name a cohesive inner operation.

**Scope and limits:** Do not hide nesting in loops, switch/match branches or exception handlers.

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
  "work": "PREGATE language starter policies",
  "locator": "go control.nesting, revision 1",
  "paraphrase": "Control-flow nesting exceeds the selected limit."
}
```

### go/GO-DOT-001

Check: [`go/dependencies/no-dot-import@1.0.0`](checks/dependencies/no-dot-import/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.deps.dot-import`. Minimum severity: `none`.

A dot import obscures the package owning an identifier.

Default parameters: `{}`.

**Repair:** Use a named package qualifier, unless a reviewed DSL intentionally requires a dot import.

**Scope and limits:** Do not replace a dot import with copied package identifiers.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "go deps.dot-import, revision 1",
  "paraphrase": "A dot import obscures the package owning an identifier."
}
```

### go/GO-IOUTIL-001

Check: [`go/dependencies/no-ioutil@1.0.0`](checks/dependencies/no-ioutil/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.deps.ioutil`. Minimum severity: `none`.

New code that imports io/ioutil depends on a deprecated package whose functions are now thin wrappers around io and os.

Default parameters: `{}`.

**Repair:** Call the replacement named in each function's doc: os.ReadFile, os.WriteFile, os.ReadDir, os.MkdirTemp, os.CreateTemp, io.ReadAll or io.Discard.

**Scope and limits:** Do not rename the import or switch to a raw string path; the package is still io/ioutil.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Go standard library documentation, package io/ioutil",
  "locator": "https://pkg.go.dev/io/ioutil (package deprecation notice, Go 1.16)",
  "paraphrase": "io/ioutil is deprecated. The same functionality is provided by package io or package os, and those should be preferred in new code."
}
```

### go/GO-CTX-001

Check: [`go/context/no-context-field@1.0.0`](checks/context/no-context-field/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.context.field`. Minimum severity: `none`.

A context stored in a struct outlives the call it belongs to, so callers cannot set a deadline or cancel one operation without affecting every method on the value.

Default parameters: `{}`.

**Repair:** Remove the field and add ctx context.Context as the first parameter of each method that needs it.

**Scope and limits:** Do not embed the context, store a pointer to it or hide it in a nested struct. Keep a context field only to preserve an existing public API, under a reviewed exclusion.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Go standard library documentation, package context",
  "locator": "https://pkg.go.dev/context (overview); https://go.dev/blog/context-and-structs",
  "paraphrase": "Do not store Contexts inside a struct type; pass a Context explicitly to each function that needs it. Backward compatibility of an existing API is the exception the Go blog describes."
}
```

### go/GO-CTX-002

Check: [`go/context/context-first@1.0.0`](checks/context/context-first/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.context.first-parameter`. Minimum severity: `none`.

A context in any other position breaks the convention callers and tools rely on to find and propagate cancellation.

Default parameters: `{}`.

**Repair:** Move ctx context.Context to the first parameter and update the callers. Test helpers may keep *testing.T or testing.TB before it.

**Scope and limits:** Do not move the context into an options struct or a struct field to satisfy the order.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Go standard library documentation, package context",
  "locator": "https://pkg.go.dev/context (overview)",
  "paraphrase": "The Context should be the first parameter, typically named ctx."
}
```

### go/GO-SELECT-001

Check: [`go/control/no-empty-select@1.0.0`](checks/control/no-empty-select/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `go`. Cardinality: `singleton`. Dimension: `go.control.empty-select`. Minimum severity: `none`.

select {} permanently halts the goroutine, leaking goroutine stacks and preventing graceful termination.

Default parameters: `{}`.

**Repair:** Use context cancellation (<-ctx.Done()) or signal coordination instead of an empty select.

**Scope and limits:** Do not use select {} to sleep or wait forever.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Effective Go / Concurrency Guidelines",
  "locator": "select statement",
  "paraphrase": "An empty select{} blocks the calling goroutine forever."
}
```
