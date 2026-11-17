# senior pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.3.0`. Category: **practice**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## senior/fowler

Manifest version: `1.0.2`. Status: **complete**.

### senior/SR-FLAG-001

Check: [`senior/api/no-boolean-flag@1.0.0`](checks/api/no-boolean-flag/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `api.boolean-flag`. Minimum severity: `none`.

A boolean flag hides two operations behind one name. The call site reads notify(user, true) and the reader has to open the function to know what true means.

Default parameters: `{}`.

**Repair:** Split into two named operations, or pass a union such as "email" | "none".

**Scope and limits:** Making the flag optional, or giving it a default, keeps the flag. A boolean property is not a parameter. Two or more boolean fields on one exported type are SR-FLAG-002 in this family, and that rule does not match a parameter.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Refactoring (M. Fowler, 1999)",
  "locator": "flag argument",
  "paraphrase": "A boolean argument that selects behavior is a flag. Replace it with two operations whose names say which behavior they run."
}
```

### senior/SR-FLAG-002

Check: [`senior/api/no-boolean-fields@1.0.0`](checks/api/no-boolean-fields/check.json). Default severity: **warn**.

Implementation: `typescript-fact`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `api.boolean-fields`. Minimum severity: `none`.

Fidelity: low. This is a count of boolean properties, not proof of a hidden mode. Two or more boolean fields on one directly exported interface, or on one object type alias, are reported. A union is already a discriminant and is skipped. A boolean parameter is SR-FLAG-001 in this same family, and that rule does not match a property.

Default parameters: `{}`.

**Repair:** Replace the pair of booleans with a union such as { kind: "on" } | { kind: "off" }. Leave a single boolean alone.

**Scope and limits:** Optional boolean properties count. boolean[] does not. A local interface does not. A union type alias does not. A boolean parameter is SR-FLAG-001, not this rule, even when a function takes several booleans. The two rules do not match the same syntax, so a file reports at most one of them for a given shape.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Refactoring (M. Fowler, 1999)",
  "locator": "flag argument",
  "paraphrase": "A set of booleans that select behavior hides a mode. A discriminant names the mode."
}
```

### senior/SR-CHAIN-001

Check: [`senior/design/no-message-chain@1.0.0`](checks/design/no-message-chain/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `design.message-chain`. Minimum severity: `none`.

The caller is navigating someone else's structure. When that structure changes, every chain breaks, which is the feature-envy smell in a form the tree can see.

Default parameters: `{}`.

**Repair:** Add a method on the owner that returns the value the caller actually needs, and call that once.

**Scope and limits:** Optional chaining does not shorten the chain. a.b.c is two hops and is allowed; a.b.c.d is the chain this rule rejects.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Refactoring (M. Fowler, 1999)",
  "locator": "message chains",
  "paraphrase": "A long chain of getters means the caller knows the layout of objects it does not own. Ask the first object for the result instead."
}
```

### senior/SR-EMPTY-001

Check: [`senior/design/no-empty-body@1.0.0`](checks/design/no-empty-body/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `design.empty-body`. Minimum severity: `none`.

An empty body is a stub that looks finished. Callers compile against a function that does not do the thing its name says.

Default parameters: `{}`.

**Repair:** Write the operation, or delete the function until there is a real body. An empty constructor can stay.

**Scope and limits:** A comment inside the braces is not an implementation. Filling the body with a log line only to silence the rule is a stub of a different shape and is called out in the avoid text of the vibe-proof console rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Refactoring (M. Fowler, 1999)",
  "locator": "speculative generality and stubs",
  "paraphrase": "Do not leave a function that has a name and no behavior. Either it does the work or it is not in the code yet."
}
```

### senior/SR-NEST-001

Check: [`senior/style/no-nested-ternary@1.0.0`](checks/style/no-nested-ternary/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `style.nested-ternary`. Minimum severity: `none`.

A nested ternary packs two decisions into one expression. The reader cannot see which branch matches which condition without counting question marks.

Default parameters: `{}`.

**Repair:** Use if statements, or a function whose name is the decision.

**Scope and limits:** Parentheses around the inner ternary do not flatten it.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Refactoring (M. Fowler) and Google TypeScript style",
  "locator": "nested conditional expressions",
  "paraphrase": "One conditional expression is enough. A second one inside it hides the decision."
}
```

### senior/SR-WIDE-001

Check: [`senior/design/wide-module@1.0.0`](checks/design/wide-module/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `design.module-width`. Minimum severity: `none`.

A wide class is a module that makes every caller learn a large surface. Ousterhout's deep module hides complexity behind a small interface; past eight public operations the type is doing several jobs.

Default parameters: `{"max":8}`.

**Repair:** Split the class by the reason its methods change. Keep the public operations the caller actually needs.

**Scope and limits:** Renaming methods to a private prefix with the private keyword or a # name removes them from the count without splitting the job. That is a hole. Arrow fields are public surface and count. The constructor does not.

**Interactions when active together:**

- Duplicates `architecture/CA-UC-001`: Both count public methods: in use-case files CA-UC-001 allows 1 and SR-WIDE-001 allows 8, so a wide use case is reported by both. Settle: Usually keep both, since CA-UC-001 is the narrower use-case rule; to report once, exclude the use-case globs from SR-WIDE-001.

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
  "work": "A Philosophy of Software Design (J. Ousterhout, 2018)",
  "locator": "deep modules",
  "paraphrase": "A module should hide a lot of complexity behind a small interface. A class with a long list of public operations is a shallow module."
}
```

## senior/style

Manifest version: `1.2.0`. Status: **complete**.

### senior/SR-VAR-001

Check: [`senior/style/no-var@1.0.0`](checks/style/no-var/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `style.var`. Minimum severity: `none`.

var is function-scoped and leaks out of the block the reader thinks it belongs to, including a for loop.

Default parameters: `{}`.

**Repair:** Use const when the binding does not change, and let when it does.

**Scope and limits:** A for loop does not make var block-scoped. The declaration is still var.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Google TypeScript style and Airbnb JavaScript style",
  "locator": "variable declarations",
  "paraphrase": "Use const by default and let when reassignment is required. Do not use var."
}
```

### senior/SR-EQ-001

Check: [`senior/style/eqeqeq@1.0.0`](checks/style/eqeqeq/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `style.eqeqeq`. Minimum severity: `none`.

Loose equality coerces. A string and a number can compare equal, and the bug looks like a passing check.

Default parameters: `{}`.

**Repair:** Use === and !==. Compare with null only when the code really means null or undefined.

**Scope and limits:** === contains the characters == and is not this rule. == null is the one allowed coercion. A comment claiming both sides are numbers does not make == strict.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Airbnb JavaScript style and Google TypeScript style",
  "locator": "equality",
  "paraphrase": "Use strict equality. The exception is a comparison with null, which is a deliberate check for both null and undefined."
}
```

### senior/SR-DEAD-001

Check: [`senior/control/no-unreachable-statement@1.0.0`](checks/control/no-unreachable-statement/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `control.unreachable`. Minimum severity: `none`.

The statement never runs. It misleads the next reader into thinking that charge or audit still happens.

Default parameters: `{}`.

**Repair:** Delete the dead statement, or move it before the exit.

**Scope and limits:** A comment between the return and the statement does not make the statement reachable. A statement after an if that returns is reachable on the other branch and is not this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Compilers, unreachable code",
  "locator": "statements after a jump",
  "paraphrase": "A statement after a return, throw, break, or continue in the same block does not run."
}
```

### senior/SR-WITH-001

Check: [`senior/style/no-with@1.0.0`](checks/style/no-with/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `style.with`. Minimum severity: `none`.

with adds the object's properties to the scope chain. A reader cannot tell whether a name is a local, a parameter, or a field.

Default parameters: `{}`.

**Repair:** Bind the object to a name and read its fields through that name.

**Scope and limits:** A with whose body is a block is still with.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "JavaScript language, strict mode",
  "locator": "the with statement",
  "paraphrase": "with is forbidden in strict mode because it makes every free name ambiguous."
}
```

### senior/SR-NATIVE-001

Check: [`senior/style/no-extend-native@1.0.0`](checks/style/no-extend-native/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `style.extend-native`. Minimum severity: `none`.

A method added to Array.prototype or String.prototype changes the type for every module and library in the process, and collides with the next language or library version that adds the same name.

Default parameters: `{}`.

**Repair:** Write a standalone function that takes the value, such as last(items), and import it where it is needed.

**Scope and limits:** Bracket access, a builtin read off globalThis and Object.defineProperty, Object.assign or Reflect.setPrototypeOf on the prototype are the same change. Static constructor settings such as Error.stackTraceLimit are not checked.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Google TypeScript style",
  "locator": "https://google.github.io/styleguide/tsguide.html#modifying-builtin-objects",
  "paraphrase": "Never modify builtin types, either by adding methods to their constructors or to their prototypes."
}
```

### senior/SR-BRACE-001

Check: [`senior/style/no-braceless-if@1.0.0`](checks/style/no-braceless-if/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `style.braceless-if`. Minimum severity: `none`.

A braceless branch makes the next line look like it belongs to the condition. Inserting a statement later changes which line runs.

Default parameters: `{}`.

**Repair:** Wrap the branch in braces.

**Scope and limits:** else if is an if, and it is allowed. An else that returns without braces is still braceless.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Google TypeScript style and Airbnb JavaScript style",
  "locator": "braces",
  "paraphrase": "Always use braces for if and else. A single-statement branch is how a later edit attaches the wrong line."
}
```

### senior/SR-MUT-001

Check: [`senior/style/no-param-reassign@1.0.0`](checks/style/no-param-reassign/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `senior.no-param-reassign`. Minimum severity: `none`.

Reassigning a parameter obscures the original input passed by the caller and mixes input bindings with local working state.

Default parameters: `{}`.

**Repair:** Declare a new `const` or `let` variable initialized from the parameter instead of overwriting the parameter identifier.

**Scope and limits:** Direct assignments (`param = ...`), compound assignments (`param += ...`), and increment/decrement operators (`param++`) on identifiers declared in the enclosing function's parameter list are flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Refactoring (M. Fowler, 1999) and Airbnb JavaScript Style Guide",
  "locator": "Remove Assignments to Parameters; Airbnb §7.12 no-param-reassign",
  "paraphrase": "Never reassign a function parameter; introduce a separate local variable when the value must be transformed."
}
```
