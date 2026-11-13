# javascript pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.2`. Category: **language**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## javascript/esm

Manifest version: `1.0.0`. Status: **complete**.

### javascript/JS-REQ-001

Check: [`javascript/modules/no-require-call@1.0.0`](checks/modules/no-require-call/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.require-call`. Minimum severity: `none`.

A require call hides the dependency from static analysis, so bundlers and the checker cannot see the edge.

Default parameters: `{}`.

**Repair:** Replace the call with an import statement at the top of the file, or await an import of the module specifier.

**Scope and limits:** Calling require through another object still loads a CommonJS module. A renamed local with the same call shape is still this call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, ECMAScript modules",
  "locator": "require versus import",
  "paraphrase": "ES modules load with import statements. require loads a CommonJS module at runtime and keeps the module graph dynamic."
}
```

### javascript/JS-CJS-001

Check: [`javascript/modules/no-module-exports@1.0.0`](checks/modules/no-module-exports/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.module-exports`. Minimum severity: `none`.

A CommonJS export in an ES module file splits the public surface across two module systems, and importers read a different shape.

Default parameters: `{}`.

**Repair:** Declare the value and export it with an export statement, or list it in one export block.

**Scope and limits:** Assigning into module.exports through a helper still publishes a CommonJS export. Adding one property at a time is still this export.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, ECMAScript modules",
  "locator": "module.exports versus export",
  "paraphrase": "ES modules publish values with export statements. Assigning to module.exports or exports keeps the file on the CommonJS export path."
}
```

## javascript/legacy

Manifest version: `1.0.0`. Status: **complete**.

### javascript/JS-LEGACY-001

Check: [`javascript/safety/no-implied-eval@1.0.0`](checks/safety/no-implied-eval/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.implied-eval`. Minimum severity: `none`.

A string that reaches a timer becomes code with full access, so any injection in the string is an injection in the program.

Default parameters: `{}`.

**Repair:** Pass an arrow function or a function reference instead of the code as a string.

**Scope and limits:** A template literal without placeholders is still a string argument and still compiles. Building the string by concatenation is the same call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, setTimeout and setInterval",
  "locator": "code string parameter",
  "paraphrase": "Passing a string to a timer compiles it as code when the timer fires. The string runs with the caller's privileges like eval."
}
```

### javascript/JS-LEGACY-002

Check: [`javascript/safety/no-new-literal@1.0.0`](checks/safety/no-new-literal/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.new-literal`. Minimum severity: `none`.

The constructor can be less clear than a literal, but a sparse array of a requested length can be intentional.

Default parameters: `{}`.

**Repair:** Write the literal. For a sized array, build it with Array.from so every slot is filled.

**Scope and limits:** new Array with several elements still routes through the constructor overloads. new on another builtin is a different call and stays out of this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, Object and Array constructors",
  "locator": "literal construction",
  "paraphrase": "The Object and Array constructors duplicate what literals already express. A single-number Array argument sets the length instead of adding an element."
}
```

### javascript/JS-LEGACY-003

Check: [`javascript/safety/no-delete-identifier@1.0.0`](checks/safety/no-delete-identifier/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.delete-identifier`. Minimum severity: `none`.

A delete on a plain identifier removes nothing while reading as cleanup, so the binding it names stays live and later code trusts the removal.

Default parameters: `{}`.

**Repair:** Delete the property on its owner, or bind a fresh object without the key.

**Scope and limits:** Deleting a computed element still deletes a property and passes. Deleting an arguments element is still flagged: accept rest parameters instead.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, delete operator",
  "locator": "deletable references",
  "paraphrase": "The delete operator only removes object properties. Deleting a bare name is a silent no-op, or an error in strict and module code."
}
```

### javascript/JS-LEGACY-004

Check: [`javascript/safety/no-labels@1.0.0`](checks/safety/no-labels/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.labels`. Minimum severity: `none`.

A labeled jump exits or restarts an outer loop from deep inside, so the reader must hold every nesting level to know where execution resumes.

Default parameters: `{}`.

**Repair:** Extract the labeled loop into a function and return instead of jumping to a label.

**Scope and limits:** A case label inside a switch is part of the switch, not a jump target. An object key with a colon is data, not a label.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, labeled statements",
  "locator": "labels with break and continue",
  "paraphrase": "A label lets break and continue jump across nesting levels. The jump target sits far from the jump, so the control flow reads as goto."
}
```

### javascript/JS-LEGACY-005

Check: [`javascript/safety/no-arguments-callee@1.0.0`](checks/safety/no-arguments-callee/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.arguments-callee`. Minimum severity: `none`.

A function that reaches itself through arguments.callee cannot be named, traced, or optimized like a plain call, and the caller link breaks as soon as the code runs strict.

Default parameters: `{}`.

**Repair:** Name the function and recurse by name. For variadic input, accept rest parameters instead of reading arguments.

**Scope and limits:** Reading arguments.length or an element still uses the arguments object and passes. Only the callee and caller links are flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, arguments.callee and arguments.caller",
  "locator": "deprecated arguments properties",
  "paraphrase": "The callee and caller properties expose the running function and its caller through the arguments object. Both are deprecated and forbidden in strict and module code."
}
```

## javascript/safety

Manifest version: `1.2.2`. Status: **complete**.

### javascript/JS-PROTO-001

Check: [`javascript/safety/no-proto-assign@1.0.0`](checks/safety/no-proto-assign/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.proto-assign`. Minimum severity: `none`.

Writing the prototype changes behavior for every object that shares it, and reading it mistakes shared behavior for own data.

Default parameters: `{}`.

**Repair:** Create the object with a null prototype, or change the prototype once with the named helper at construction.

**Scope and limits:** Destructuring __proto__ still reads the prototype. A quoted key with the same name is the same property.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, Object.prototype.__proto__",
  "locator": "prototype mutation",
  "paraphrase": "The __proto__ property exposes the prototype chain. Reading or writing it reaches past the object's own properties into shared behavior."
}
```

### javascript/JS-EVAL-001

Check: [`javascript/safety/no-eval-call@1.0.2`](checks/safety/no-eval-call/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.eval-call`. Minimum severity: `none`.

A string that reaches eval becomes code with full access, so any injection in the string is an injection in the program.

Default parameters: `{}`.

**Repair:** Parse the value with the parser for its format, or call the named function instead of compiling its name.

**Scope and limits:** A direct eval(...) call and new Function(...) are this call. A member call whose property is eval, such as window.eval(code) or box.eval(code), is the same call, and so are parentheses or a comma expression around one of those callees, such as (0, eval)(code). A bracket call whose object is window, globalThis, self, or global and whose index is the string literal "eval" or 'eval', such as a call of window["eval"], is the same call, including parentheses, a comma expression, and optional chaining. A const, let, or var initialized to the eval identifier, including in parentheses, an assignment of that identifier to a bare local, or a parameter defaulted to it, and a later call of that name, such as const alias = eval; alias(code), is the same call. A later assignment does not remove the match. Another binding of that name inside the statement or function that follows the initializer keeps the call out of this match. A bracket call on any other object, a template index, the string eval outside a call, and a method declaration named eval are not this call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, eval and Function",
  "locator": "dynamic code execution",
  "paraphrase": "eval and the Function constructor compile a string into code at runtime. The compiled string runs with the caller's privileges."
}
```

### javascript/JS-ASYNC-001

Check: [`javascript/safety/no-async-executor@1.0.0`](checks/safety/no-async-executor/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.async-executor`. Minimum severity: `none`.

A rejection inside an async executor settles the invisible promise, so the constructed promise never settles and the error is lost.

Default parameters: `{}`.

**Repair:** Make the executor synchronous and call resolve or reject, or move the awaits into the task the executor starts.

**Scope and limits:** An async function declaration as the executor has the same lost promise. Awaiting inside a synchronous executor body is fine.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, Promise constructor",
  "locator": "executor function",
  "paraphrase": "The Promise executor runs synchronously and reports through resolve and reject. An async executor returns a second promise the constructor never observes."
}
```

### javascript/JS-AWAIT-001

Check: [`javascript/safety/no-await-in-loop@1.0.1`](checks/safety/no-await-in-loop/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.await-in-loop`. Minimum severity: `none`.

Serial awaits cost latency when tasks are independent, but can be necessary for ordering, rate limits, or backpressure.

Default parameters: `{}`.

**Repair:** Confirm whether ordering, rate limits, backpressure or benchmark measurement require sequential work. Parallelize only independent tasks with an explicit concurrency budget; preserve deliberate serial behavior with a reviewed project policy.

**Scope and limits:** This advisory check follows awaits only within the current function. Awaiting inside a nested callback is not an await by the enclosing loop. Unbounded Promise.all can change ordering, error and capacity behavior.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Node.js documentation, event loop and concurrency",
  "locator": "serial awaits",
  "paraphrase": "Awaiting each item inside a loop serializes work that could run together. The loop pays the full latency of every item in turn."
}
```

### javascript/JS-THROW-001

Check: [`javascript/safety/no-throw-literal@1.0.0`](checks/safety/no-throw-literal/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.throw-literal`. Minimum severity: `none`.

A thrown literal gives the catcher no stack and no type, so every catch falls back to comparing raw values.

Default parameters: `{}`.

**Repair:** Throw an error object built for the failure, and keep the message next to the condition that raised it.

**Scope and limits:** Quoting the literal differently does not make it an error. Wrapping it in parentheses does not add a stack.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, throw statement",
  "locator": "thrown value",
  "paraphrase": "throw accepts any value, but catch branches on the value's shape. A literal carries no stack and no name the caller can match."
}
```

### javascript/JS-WRAP-001

Check: [`javascript/safety/no-new-wrappers@1.0.0`](checks/safety/no-new-wrappers/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.new-wrappers`. Minimum severity: `none`.

A wrapper object is always truthy and never equals its primitive, so equality checks and branches silently change meaning.

Default parameters: `{}`.

**Repair:** Call the converter as a function with no new, and keep the result a primitive.

**Scope and limits:** The Boolean wrapper is always truthy, even when it wraps false. Wrapping a different primitive has the same defect.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, primitive wrapper objects",
  "locator": "new String, Number, Boolean",
  "paraphrase": "Calling String, Number, or Boolean as functions converts the value. Calling them with new wraps it in an object instead."
}
```

### javascript/JS-NAN-001

Check: [`javascript/safety/no-nan-compare@1.0.0`](checks/safety/no-nan-compare/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.nan-compare`. Minimum severity: `none`.

x === NaN is always false and x !== NaN is always true, so the guard never fires and an invalid number flows on.

Default parameters: `{}`.

**Repair:** Replace the comparison with Number.isNaN(value), or !Number.isNaN(value) for the inverse.

**Scope and limits:** Number.NaN is the same value. Putting NaN on the left does not change the result. The global isNaN coerces its argument first; Number.isNaN does not.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, NaN",
  "locator": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN#testing_against_nan",
  "paraphrase": "NaN compares unequal to every value, including NaN itself, with ==, !=, === and !==. Use Number.isNaN to test for it."
}
```

### javascript/JS-TYPEOF-001

Check: [`javascript/safety/valid-typeof@1.0.0`](checks/safety/valid-typeof/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.valid-typeof`. Minimum severity: `none`.

Comparing typeof with any other string is always false, so the branch is dead and the value the check was meant to stop gets through.

Default parameters: `{}`.

**Repair:** Compare with one of the eight typeof results. Use value === null for null and Array.isArray(value) for arrays.

**Scope and limits:** typeof never returns null, array, date or integer. Swapping the operands or writing the string as a template literal is the same comparison. Comparing with a variable is not checked.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, typeof",
  "locator": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof#description",
  "paraphrase": "typeof returns one of undefined, object, boolean, number, bigint, string, symbol or function."
}
```

### javascript/JS-FOREACH-001

Check: [`javascript/safety/no-async-foreach@1.0.0`](checks/safety/no-async-foreach/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.async-foreach`. Minimum severity: `none`.

The caller continues before any callback finishes, and a rejected callback becomes an unhandled rejection instead of an error the caller sees.

Default parameters: `{}`.

**Repair:** Use await Promise.all(items.map(async (item) => ...)) for independent work, or for...of with await when order matters.

**Scope and limits:** A function expression instead of an arrow, or optional chaining on the receiver, is the same call. A sync callback that starts a promise is outside this rule. Only a forEach call used as a bare statement is reported; an awaited stream forEach is allowed. for...of with await is serial, which JS-AWAIT-001 advises on.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, Array.prototype.forEach",
  "locator": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#description",
  "paraphrase": "forEach expects a synchronous function and does not wait for promises an async callback returns."
}
```

### javascript/JS-FINALLY-001

Check: [`javascript/safety/no-return-in-finally@1.0.0`](checks/safety/no-return-in-finally/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `javascript.return-in-finally`. Minimum severity: `none`.

A return in finally discards the try block's result and swallows any thrown error, so a failure looks like success.

Default parameters: `{}`.

**Repair:** Keep finally for cleanup. Return from try or catch, or after the whole try statement.

**Scope and limits:** A return inside a nested try or catch within finally still completes the finally. A return inside a callback defined in finally is a different function and is not reported.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "MDN Web Docs, try...catch",
  "locator": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch#the_finally_block",
  "paraphrase": "A return in the finally block becomes the result of the whole try statement, regardless of returns in try or catch, including when catch throws."
}
```

### javascript/JS-SELF-001

Check: [`javascript/safety/no-self-compare@1.0.0`](checks/safety/no-self-compare/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `safety.self-compare`. Minimum severity: `none`.

Comparing an identifier or member expression to itself is tautological (or always false for inequality), and indicates a typo or broken logic. Use Number.isNaN() for NaN checks.

Default parameters: `{}`.

**Repair:** Compare against the intended target variable, or use Number.isNaN(x) if testing for NaN.

**Scope and limits:** Do not compare x === x or x !== x to test for NaN; use Number.isNaN().

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "ESLint Recommended Rules",
  "locator": "no-self-compare",
  "paraphrase": "Comparing a variable against itself is usually an error, either a typo or an incorrect check for NaN."
}
```

### javascript/JS-NEG-001

Check: [`javascript/safety/no-unsafe-negation@1.0.0`](checks/safety/no-unsafe-negation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `safety.unsafe-negation`. Minimum severity: `none`.

In JavaScript, !key in obj parses as (!key) in obj, evaluating key to a boolean and checking if 'true' or 'false' exists on obj.

Default parameters: `{}`.

**Repair:** Wrap the expression in parentheses: !(key in obj) or !(obj instanceof Cls).

**Scope and limits:** Do not rely on implicit precedence when negating binary relational operators.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "ESLint Recommended Rules",
  "locator": "no-unsafe-negation",
  "paraphrase": "Negating the left operand of in or instanceof is almost always a mistake because operator precedence binds ! first."
}
```
