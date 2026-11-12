# javascript backlog

Non-decidable JavaScript candidates. These are recorded as candidates and never warn: the syntax tree alone cannot decide them.

- **Implicit globals** (candidate, never warn): assigning to an undeclared name creates a global, but deciding whether a name is declared needs scope resolution across files, not a single syntax pattern.
- **== null idiom judgment** (candidate, never warn): whether a loose equality against null is a deliberate idiom or a bug needs intent the tree cannot see.
- **Magic numbers** (candidate, never warn): whether a numeric literal is self-explanatory or needs a named constant is a readability judgment, not a syntactic property.
- **package.json type-module interop** (candidate, never warn): whether a file means ESM or CommonJS depends on the nearest package.json scope and loader flags, which live outside the parsed file.
- **Loose equality across primitives** (candidate, never warn): aside from `== null`, loose equality across primitives causes unexpected type coercion, but legacy libraries sometimes rely on numeric string coercion.
- **Floating promises in plain JS** (candidate, never warn): without TypeScript type annotations or `.then()` chains, an un-awaited asynchronous function call cannot be distinguished from a synchronous void function.
- **Eval aliases beyond one binding (`JS-EVAL-001` limit).** The rule follows a const, let, var, assignment, or parameter default whose value is the `eval` identifier, including parentheses around that identifier. It does not follow `eval` through a member (`const alias = window.eval`), a type assertion (`eval as Function`), a template index (`window[\`eval\`]`), or a second name (`const alias = eval; const again = alias`). Another binding of the same name inside the statement or function that follows the initializer hides the call. A later assignment to the local does not.
