# clean-code pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **practice**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## clean-code/clean-code

Manifest version: `1.3.0`. Status: **complete**.

### clean-code/CC-FN-001

Check: [`clean-code/complexity/fn-max-lines@1.0.0`](checks/complexity/fn-max-lines/check.json). Default severity: **warn**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `fn.size`. Minimum severity: `none`.

A long function mixes steps at different levels of abstraction. The line budget is a project choice, not a defect, so the default contract advises instead of denying.

Default parameters: `{"max":20}`.

**Repair:** Extract each cohesive step into a function named after what it computes in this domain, and leave the original function as the sequence of those steps.

**Scope and limits:** Packing statements onto one line, moving the body into a nested arrow function, or cutting it into fragments that are called once and mean nothing on their own.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 1
  }
}
```

Source metadata:

```json
{
  "work": "Clean Code (R. C. Martin, 2008)",
  "locator": "ch. 3, Functions (Small!)",
  "paraphrase": "Keep functions short; a function that keeps growing usually mixes several levels of abstraction and ends up doing more than one thing."
}
```

### clean-code/CC-FN-002

Check: [`clean-code/complexity/fn-max-params@1.0.0`](checks/complexity/fn-max-params/check.json). Default severity: **warn**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `fn.params`. Minimum severity: `none`.

Many parameters usually hide an unnamed concept. How many is too many is a project budget, so the default contract advises instead of denying.

Default parameters: `{"max":3,"exempt":["constructor"]}`.

**Repair:** Group parameters that always travel together into a named domain type, or split the function by responsibility. Take the type name from the glossary or the file's domain.

**Scope and limits:** Untyped options bags, inline object types, destructured parameter objects and rest tuples that move the same inputs behind one name.

**Interactions when active together:**

- Duplicates `mattpocock/MP-PARAMS-001`: Both count parameters of TypeScript and JavaScript functions and share the fn.params dimension: CC-FN-002 denies above 3 and MP-PARAMS-001 warns above 4, so the warning only repeats a stricter denial. Settle: Pick the adopted limit with "resolve": {"fn.params": {"use": "clean-code/CC-FN-002"}} or the mattpocock alias.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  },
  "exempt": {
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
  "work": "Clean Code (R. C. Martin, 2008)",
  "locator": "ch. 3, Functions (Function Arguments)",
  "paraphrase": "The fewer arguments the better; each extra argument makes a function harder to understand, to call correctly and to test in all its combinations."
}
```

### clean-code/CC-ER-002

Check: [`clean-code/errors/no-empty-catch@1.0.0`](checks/errors/no-empty-catch/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `errors.swallowing`. Minimum severity: `none`.

A swallowed error turns a failure into wrong data or a silent stall far away from its cause.

Default parameters: `{}`.

**Repair:** Handle the error with a defined fallback, a retry or a translation into a domain error, or rethrow it with context; if only the caller can decide, let it propagate.

**Scope and limits:** Replacing the empty block with a log line, a void expression, a comment or a nested empty block, returning undefined from the catch callback, or passing a logger as the catch handler.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Clean Code (R. C. Martin, 2008)",
  "locator": "ch. 7, Error Handling",
  "paraphrase": "Error handling is part of what a function does: a caught error is dealt with, or passed on with enough context to act on it, never silently dropped."
}
```

### clean-code/CC-ER-003

Check: [`clean-code/errors/try-is-whole-function@1.0.0`](checks/errors/try-is-whole-function/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `errors.try-placement`. Minimum severity: `none`.

A try beside other work is a function-shape preference from Clean Code, not a defect. The default contract leaves this check off. Opt in with an override severity of warn so it stays advisory.

Default parameters: `{}`.

**Repair:** When the project opts in, extract the guarded work into its own function whose whole body is the try/catch. Keep the override at warn; deny treats the preference as a defect.

**Scope and limits:** The check is off until a reviewed override sets a severity. Wrapping the try in an if, or moving the surrounding statements into the try so it becomes the only statement, satisfies the pattern without separating the error path. Do not enable it as deny.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Clean Code (R. C. Martin, 2008)",
  "locator": "ch. 3, Functions (Extract Try/Catch Blocks; Error Handling Is One Thing)",
  "paraphrase": "Error handling is one thing, so a function that handles errors should do nothing else: if try appears in a function, it is the first word and nothing follows the catch/finally blocks."
}
```

### clean-code/CC-NEST-001

Check: [`clean-code/complexity/nesting-max-depth@1.1.0`](checks/complexity/nesting-max-depth/check.json). Default severity: **warn**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `clean-code.control.nesting`. Minimum severity: `none`.

Deeply nested control flow forces the reader to hold multiple active conditions at once. The default limit is 4, the same maximum ESLint max-depth ships, and an if that only returns, continues, breaks, or throws does not count.

Default parameters: `{"max":4}`.

**Repair:** Use a guard clause (if with no else whose body is only return, continue, break, or throw) or extract the inner control block into a well-named helper function.

**Scope and limits:** Collapsing nested if statements into a complex compound boolean or a nested ternary only hides the branching without simplifying the logic.

**Interactions when active together:**

- Duplicates `maintainability/MAINT-NEST-001`: Both measure control-flow nesting depth in TypeScript and JavaScript functions. clean-code/CC-NEST-001 defaults to 4 and ignores guard clauses. maintainability/MAINT-NEST-001 defaults to 2. Settle: Keep one active or turn clean-code/CC-NEST-001 off when maintainability/MAINT-NEST-001 already enforces the nesting limit.

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
  "work": "Clean Code (R. C. Martin, 2008)",
  "locator": "ch. 3, Functions (Blocks and Indenting)",
  "paraphrase": "The indent level of a function should not be greater than one or two, which keeps functions small and easy to read."
}
```
