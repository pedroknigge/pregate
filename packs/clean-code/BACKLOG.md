# clean-code backlog

Practices from *Clean Code* (R. C. Martin, 2008) that are not binary syntax-tree invariants or that would be winnable by a rename or comment deletion.

## Implemented static slices in `clean-code/clean-code`

- **`CC-FN-001` (`clean-code/complexity/fn-max-lines`):** Caps function and method statement lines (`fn.lines`, default `max: 20`).
- **`CC-FN-002` (`clean-code/complexity/fn-max-params`):** Caps function parameter count (`fn.params`, default `max: 3`, constructors exempt).
- **`CC-NEST-001` (`clean-code/complexity/nesting-max-depth`):** Caps control-flow nesting depth (`control.nesting`, default `max: 4`). Guard clauses are not a level.
- **`CC-ERR-001` (`clean-code/errors/no-empty-catch`):** Denies empty or log-only `catch` blocks that swallow exceptions without throwing, returning, or handling fallback state.
- **`CC-ER-003` (`clean-code/errors/try-is-whole-function`):** Opt-in and advisory. Off in the default contract; enable with severity `warn`.

## Non-decidable practices kept out of static AST checks

- **Meaningful, intention-revealing names (Ch. 2):** Whether an identifier reveals intent or matches the domain ubiquitous language requires a project glossary and human reading; length or dictionary heuristics produce false positives on standard math/protocol variables.
- **One level of abstraction per function / Stepdown Rule (Ch. 3):** Line count (`CC-FN-001`) and control nesting (`CC-NEST-001`) bound structural complexity, but deciding whether two statements sit at the same conceptual level of abstraction is a design reading.
- **Command-Query Separation (Ch. 3):** Without cross-file purity and mutation analysis, a syntax parser cannot tell whether a function that returns a value also mutates collaborator state.
- **Comments that explain *why* vs. redundant noise (Ch. 4):** A blanket ban on comments violates D3 (an agent can pass by deleting useful warnings), while distinguishing a high-value rationale comment from restated code requires semantic judgment (see `pstack/PS-COMMENT-001` for the narrower narration slice).
- **Newspaper metaphor & vertical affinity (Ch. 5):** Ordering private helpers below their callers is partially measurable when call graphs are unambiguous, but utility sharing across multiple methods makes strict top-down ordering non-invariant.
- **Law of Demeter vs. Data Transfer Objects (Ch. 6):** Three-hop member chains on behavior objects are covered in `senior/SR-CHAIN-001`, whereas distinguishing a hybrid object from a legitimate nested configuration record requires type-level ownership facts.
