# javascript

Optional JavaScript safety and module policies with explicit syntax limits. Select
ES modules when that is the project's runtime contract; use synchronous Promise
executors, error objects and reviewed modern replacements for legacy forms.
Serial loop work may be required for ordering or backpressure. These policies
remain optional and the reviewed preset determines which ones enforce.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `javascript/JS-REQ-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `JS-REQ-001` | A require(...) call, including one through another object. | A require call hides the dependency from static analysis, so bundlers and the checker cannot see the edge. | deny |
| `JS-CJS-001` | Assignment to module.exports or exports.x. | A CommonJS export in an ES module file splits the public surface across two module systems, and importers read a different shape. | deny |
| `JS-PROTO-001` | The __proto__ name in code. | Writing the prototype changes behavior for every object that shares it, and reading it mistakes shared behavior for own data. | deny |
| `JS-EVAL-001` | An eval(...) call, new Function(...), a member call whose property is eval, a bracket call of the string eval on window, globalThis, self, or global, a comma expression such as (0, eval)(...), and a later call of a local initialized to the eval identifier. | A string that reaches eval becomes code with full access, so any injection in the string is an injection in the program. | deny |
| `JS-ASYNC-001` | An async function passed to the Promise constructor. | A rejection inside an async executor settles the invisible promise, so the constructed promise never settles and the error is lost. | deny |
| `JS-AWAIT-001` | A direct await inside a for, for-in, for-of, while, or do loop, stopping at nested function/method boundaries. | Serial work may be intentional for ordering or backpressure; use bounded parallel work only when operations are independent. | warn |
| `JS-THROW-001` | A throw of a string, number, or template literal. | A thrown literal gives the catcher no stack and no type, so every catch falls back to comparing raw values. | deny |
| `JS-WRAP-001` | new String(...), new Number(...), and new Boolean(...). | A wrapper object is always truthy and never equals its primitive, so equality checks and branches silently change meaning. | deny |
| `JS-NAN-001` | A comparison (`==`, `===`, `!=`, `!==`, `<`, `>`, `<=`, `>=`) with `NaN` or `Number.NaN`. | NaN is unequal to every value, so the guard never fires. | deny |
| `JS-TYPEOF-001` | Comparing `typeof x` with a string literal that typeof never returns, such as `"null"`, `"array"` or a misspelling. | The branch is dead, so the value it should stop gets through. | deny |
| `JS-FOREACH-001` | A bare `forEach(...)` statement whose first callback is async. | forEach does not wait for the promises, and their rejections go unhandled. | warn |
| `JS-FINALLY-001` | A `return` inside a `finally` block, stopping at nested function boundaries. | It replaces the try result and swallows a thrown error. | warn |
| `JS-LEGACY-001` | A string passed to setTimeout, setInterval, or setImmediate. | A string that reaches a timer is compiled as code with full access, so any injection in the string is an injection in the program. | deny |
| `JS-LEGACY-002` | new Object(), an empty new Array(), and new Array(n). | `new Array(n)` can intentionally allocate a sparse array; blanket rejection is unjustified. | warn |
| `JS-LEGACY-003` | delete on a bare name, and delete on an arguments element. | Deleting a plain identifier removes nothing while reading as cleanup, so the binding stays live and later code trusts the removal. | deny |
| `JS-LEGACY-004` | A labeled statement. | A labeled jump exits or restarts an outer loop from deep inside, so the reader must hold every nesting level to know where execution resumes. | deny |
| `JS-LEGACY-005` | arguments.callee and arguments.caller. | The callee and caller links are deprecated and forbidden in strict code, and a function reaching itself through arguments cannot be traced like a plain call. | deny |

## Methodologies

- `javascript/esm` — JS-REQ-001, JS-CJS-001
- `javascript/safety` — JS-PROTO-001, JS-EVAL-001, JS-ASYNC-001, JS-AWAIT-001, JS-THROW-001, JS-WRAP-001, JS-NAN-001, JS-TYPEOF-001, JS-FOREACH-001, JS-FINALLY-001
- `javascript/legacy` — JS-LEGACY-001, JS-LEGACY-002, JS-LEGACY-003, JS-LEGACY-004, JS-LEGACY-005

Non-decidable practices from the same sources are in `BACKLOG.md`.

Source 1.0.1 keeps nested async callbacks and methods separate from an enclosing
loop. A loop inside that callback still owns its own await and receives advice.
This does not prove scheduling or independence; replacing serial execution with
unbounded `Promise.all` can break behavior and exceed a resource budget.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **language**. Version: `1.2.2`. 19 distinct check IDs.

Methodologies: `javascript/esm` (complete), `javascript/legacy` (complete), `javascript/safety` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
