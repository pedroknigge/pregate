# senior

Binary rules widely used by senior TypeScript codebases: Fowler's decidable smells, a width cap on a class's public surface, and the style bans that do not depend on taste (var, loose equality, dead statements, with, braceless if, built-in prototype changes). Deep modules, naming, DRY, and magic numbers are judgment and live in the backlog. Core already caps function length, parameter count, empty catches, and a use case's single public method. This pack does not repeat them.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `senior/SR-FLAG-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `SR-FLAG-001` | A parameter whose type is boolean. | A boolean flag hides two operations behind one name. The call site reads notify(user, true) and the reader has to open the function to know what true means. | deny |
| `SR-FLAG-002` | Two or more boolean properties on one exported interface or object type. | Low-fidelity count of a hidden mode. A union is already a discriminant. A boolean parameter stays `SR-FLAG-001`. | warn |
| `SR-CHAIN-001` | A member chain of three hops, including hops that pass through a call (a.b().c().d). | The caller is navigating someone else's structure. When that structure changes, every chain breaks, which is the feature-envy smell in a form the tree can see. | deny |
| `SR-EMPTY-001` | A function, method, or arrow whose body has no statement. A comment does not count. Constructors are exempt. | An empty body is a stub that looks finished. Callers compile against a function that does not do the thing its name says. | deny |
| `SR-NEST-001` | A conditional expression whose branch is another conditional expression. | A nested ternary packs two decisions into one expression. The reader cannot see which branch matches which condition without counting question marks. | deny |
| `SR-WIDE-001` | A class with more than 8 distinct public methods or public function fields. | A wide class is a module that makes every caller learn a large surface. Ousterhout's deep module hides complexity behind a small interface; past eight public operations the type is doing several jobs. | deny |
| `SR-VAR-001` | A var declaration, including one in a for loop. | var is function-scoped and leaks out of the block the reader thinks it belongs to, including a for loop. | deny |
| `SR-EQ-001` | == and !=, except comparisons with null or undefined. | Loose equality coerces. A string and a number can compare equal, and the bug looks like a passing check. | deny |
| `SR-DEAD-001` | A statement that follows a return, throw, break, or continue in the same block. | The statement never runs. It misleads the next reader into thinking that charge or audit still happens. | deny |
| `SR-WITH-001` | A with statement. | with adds the object's properties to the scope chain. A reader cannot tell whether a name is a local, a parameter, or a field. | deny |
| `SR-BRACE-001` | An if or else whose branch is not a block. else if may stay an if. | A braceless branch makes the next line look like it belongs to the condition. Inserting a statement later changes which line runs. | deny |
| `SR-NATIVE-001` | A write to a built-in prototype such as Array.prototype, by assignment, defineProperty, assign or setPrototypeOf. | A method added to a built-in changes the type for every module and library in the process and collides with the next version that adds the same name. | warn |
| `SR-MUT-001` | Reassigning or incrementing/decrementing a function parameter (`param = ...`, `param += ...`, `param++`). | Reassigning a parameter obscures the caller's input and mixes input bindings with local working state. | warn |

## Methodologies

- `senior/fowler` — SR-FLAG-001, SR-FLAG-002, SR-CHAIN-001, SR-EMPTY-001, SR-NEST-001, SR-WIDE-001
- `senior/style` — SR-VAR-001, SR-EQ-001, SR-DEAD-001, SR-WITH-001, SR-BRACE-001, SR-NATIVE-001, SR-MUT-001

## Fidelity

- `SR-FLAG-001` matches a boolean parameter, including an optional one and one with a default. A boolean property is not a parameter.
- `SR-FLAG-002` is a low-fidelity count. It does not prove a hidden mode. Two or more boolean fields on one directly exported interface, or on one object type alias, are reported. A union is already a discriminant and is skipped. A local type is skipped. Optional boolean properties count. `boolean[]` does not. A boolean parameter is `SR-FLAG-001` and is not this rule, so one shape fires one rule.

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **practice**. Version: `1.3.0`. 13 distinct check IDs.

Methodologies: `senior/fowler` (complete), `senior/style` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
