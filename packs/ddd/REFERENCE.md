# ddd pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.1.0`. Category: **pattern**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## ddd/ddd-tactical

Manifest version: `1.1.0`. Status: **preview**.

### ddd/DDD-VO-001

Check: [`ddd/immutability/readonly-fields@1.0.0`](checks/immutability/readonly-fields/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `immutability.fields`. Minimum severity: `none`.

A shared value that changes in place changes every holder at once, breaking equality by value and the rules checked at construction.

Default parameters: `{"paths":["**/domain/**/values/**","**/domain/**/value-objects/**"]}`.

**Repair:** Make every field readonly and return a new instance from each operation that would change the value.

**Scope and limits:** Private mutable fields behind getters, public constructor parameter properties, and writes through Object.assign or casts.

**Interactions when active together:**

- Duplicates `ddd/DDD-ENT-002`: Under value-object paths DDD-ENT-002 also reports a public mutable field, which DDD-VO-001 already reports as a field that is not readonly. Settle: Keep both: the repair (a readonly or private field) satisfies each. To report it once, add the value-object globs to exclude on DDD-ENT-002.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Domain-Driven Design (E. Evans, 2003); Implementing Domain-Driven Design (V. Vernon, 2013)",
  "locator": "Evans ch. 5, Value Objects; Vernon ch. 6, Value Objects",
  "paraphrase": "A value object is defined only by its attributes and treated as immutable: to change a value, replace it with a new one instead of altering it in place."
}
```

### ddd/DDD-ENT-001

Check: [`ddd/immutability/no-public-setters@1.0.0`](checks/immutability/no-public-setters/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `immutability.setters`. Minimum severity: `none`.

A public setter lets any caller put the entity into a state its own rules never allowed.

Default parameters: `{"paths":["**/domain/**"]}`.

**Repair:** Replace the setter with a method named after the domain operation, which checks the entity's rules before changing state; take the name from the glossary or the domain.

**Scope and limits:** Renaming the setter, computing its name, returning this from it, or exposing it as an arrow-function property.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Domain-Driven Design (E. Evans, 2003); Implementing Domain-Driven Design (V. Vernon, 2013)",
  "locator": "Evans ch. 5, Entities; Vernon ch. 5, Entities",
  "paraphrase": "An entity keeps its identity and guards its own consistency: its state changes through operations that express domain intent, not through raw writes to its properties."
}
```

### ddd/DDD-ENT-002

Check: [`ddd/immutability/no-public-mutable-fields@1.0.0`](checks/immutability/no-public-mutable-fields/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `immutability.public-fields`. Minimum severity: `none`.

A public field that is not readonly is a setter with no body: any caller can write order.status = "paid" and skip every rule the entity checks.

Default parameters: `{"paths":["**/domain/**"]}`.

**Repair:** Make the field private (or readonly if it never changes), expose a getter if callers need to read it, and change it only inside a method named after the domain operation.

**Scope and limits:** Static fields, function-valued fields and fields outside the configured paths are not checked. Persistence-mapped classes kept under domain/ are reported too; map them to the domain type in the adapter instead of loosening the entity.

**Interactions when active together:**

- Duplicates `ddd/DDD-VO-001`: Under value-object paths DDD-VO-001 already reports every field that is not readonly, so a public mutable field there is reported by both rules. Settle: Keep both: the repair (a readonly or private field) satisfies each. To report it once, add the value-object globs to exclude on DDD-ENT-002.
- Duplicates `typescript/TS-LEGACY-005`: A public constructor parameter property is reported by DDD-ENT-002 as mutable state and by TS-LEGACY-005 as a parameter property. Settle: Declare a private field and assign it in the constructor body; that satisfies both rules.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Domain-Driven Design (E. Evans, 2003); Implementing Domain-Driven Design (V. Vernon, 2013)",
  "locator": "Evans ch. 5, Entities; Vernon ch. 5, Entities",
  "paraphrase": "An entity keeps its identity and guards its own consistency: its state changes through operations that express domain intent, not through raw writes to its properties."
}
```
