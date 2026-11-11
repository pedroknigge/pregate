# pstack backlog

These practices cannot be inferred from a syntax tree. The optional principles,
operations, playbooks and workspace methodologies now track their authored clauses
as project-fitness obligations. A reviewed assertion needs actual task/project
evidence and explicit applicability; a renamed symbol or deleted sentence is not
proof. The sections below explain the judgment and facts still required.

The typescript pack already refuses `any`, enums, non-null assertions, and non-exhaustive switches. The vibe-proof pack already refuses `console.log` and debugger statements. This pack does not repeat them.

## Principles with a binary slice

The slice is a rule in this pack. What remains is judgment.

### Boundary discipline

PS-ZOD-001 refuses validator packages inside domain, core, and entity paths. Where a boundary should sit, whether a hand-written guard is the parser, and whether an application service may validate are judgment. A barrel that re-exports zod is a hole, recorded on the rule.

### Make operations idempotent

PS-IDEM-001 refuses a payment create, capture, or confirm whose arguments never mention an idempotency key. Whether the key is stable across retries, whether a database write is idempotent, and whether a lifecycle step converges after a crash are judgment.

### Migrate callers, then delete legacy APIs

PS-LEGACY-001 refuses an import whose specifier contains `.legacy` or `/legacy/`. The migration itself is a process: seeing that callers moved, that no behavior was kept "for compatibility," and that the old function was deleted. A file named `legacy-adapter.ts` does not match, on purpose.

### Minimize reader load

PS-LET-001 refuses a module-level `let`. PS-COMMENT-001 reports comments that may be narration. Counting layers between a question and its answer, and deciding that a one-caller wrapper should collapse, are judgment. Deleting the comment without changing the structure wins PS-COMMENT-001, which is why the preset `pstack-way` keeps it in shadow rather than pretending it is ungameable.

PS-COMMENT-001 cannot decide that a comment restates the next line. A pattern matches one node by kind and text; it cannot compare the words of a comment with the identifiers of the statement after it. Before pack 1.2.0 the rule reported every comment outside a marker allowlist with default severity `deny`, and on the pinned public corpus five of six maintainer-labeled findings were false: two comments that explain why, a URL citation, a license banner and a JSDoc package description. The rule now also exempts a JSDoc block, a comment with an `http`/`https` URL, a comment that names a license, and a comment with a reason word (because, since, so, otherwise, instead of, rather than, in order to, to avoid, to prevent, to ensure, due to, workaround, why). A comment that carries `@deprecated` is still reported, as `maintainability/MAINT-DEPR-001` documents. What remains is every other comment, whether or not it restates code: a section label, a shell example, the second line of a two-line explanation. For that reason the default severity is `warn`. The measured sample after the change is in [rule precision](../../docs/guides/rule-precision.md), and the missing capability is in [engine requests](../ENGINE-REQUESTS.md).

### Model the domain

PS-PARTIAL-001 refuses an exported `Partial<T>` parameter. PS-AS-001 refuses domain assertions other than `as const`. Choosing a state machine over booleans, and noticing that a shape assumption is copied across files, are judgment. A `type Patch = Partial<Order>` alias is not a parameter and is not the rule.

### Subtract before you add

PS-COMMENTED-001 refuses a comment that starts with a statement keyword. "This change should have deleted more" is judgment. History, not a comment, keeps the old line.

### Test behavior, not implementation

PS-WEAK-001 refuses matchers that pass on presence or truthiness. PS-EXPECT-001 refuses an `it` or `test` with no `expect` or `assert` call. Whether the assertion is the behavior a user sees, rather than a call count with the right name, is still judgment once the matcher is specific.

### Type system discipline

PS-AS-001 is the domain slice. Branded ids, making illegal states unrepresentable, and deriving types from a schema are design. `any`, enums, and exhaustive switches are the typescript pack.

### Prove it works

PS-EXPECT-001 only checks that a test calls `expect` or `assert`. Running the real artifact, reading the real value, and refusing a self-report are a human or a harness step. The tree cannot see that the expected literal is the right one.

## Principles with no binary slice

### Attack the premise

The trigger is two failed fixes that share a premise, then a census of who holds the imbalance. That is a history of attempts, not a shape in one file.

### Build the lever

Choosing to build a codemod instead of editing by hand is a plan. The tree cannot see the edits that were not made.

### Encode lessons in structure

This pack is that practice. Deciding that a correction has recurred often enough to become a rule is judgment. The decision log for rules that do not qualify is this file.

### Exhaust the design space

Two or three prototypes compared side by side are a process. No single tree is the wrong one.

### Experience first

User delight against implementation convenience is a product call.

### Fix root causes

A nil-check that hides a crash can be good or bad depending on the invariant. A comment that says "workaround" is deleted and the rule is won without a better structure, so it does not ship. Reproducing the bug is a process.

### Foundational thinking

Whether the core types are the right ones is a design review. The tree can see the types that were written, not the ones that should have been.

### Guard the context window

Routing bulk work to a subagent is a session tactic. It is not a property of the repository.

### Laziness protocol

The smallest change that solves the problem is a diff review. A line cap would ban a necessary migration and let a clever short wrong change through.

### Never block on the human

When to proceed on reversible work is a workflow rule for the agent, not an invariant of the code.

### Outcome-oriented execution

Throwaway compatibility code is PS-LEGACY-001 only when it is named legacy. Detecting a smooth intermediate architecture otherwise is judgment.

### Redesign from first principles

Bolting a requirement on versus redesigning around it is visible only against the history of the design.

### Separate before serializing shared state

Eliminating a shared writer versus locking one is a concurrency design. Two modules that both assign a binding are not proof they run concurrently.

### Sequence verifiable units

How to stack commits so each one is reviewable is a process. The tree of one commit cannot see the sequence.

## Workflow skills

These pstack skills are procedures with no general AST checker: ps-architect, ps-arena, ps-automate-me, ps-blast-radius, ps-bro, ps-create-verification-skill, ps-figure-it-out, ps-how, ps-interrogate, ps-maintain-verification-skill, ps-make-bot-ui, ps-no-comments (the comment rules above are the only structural slice), ps-poteto-mode, ps-recall, ps-reflect, ps-setup-pstack, ps-show-me-your-work, ps-swarm, ps-tdd, ps-teach, ps-technical-writing, ps-typescript-best-practices (owned by the typescript and vibe-proof packs), ps-unslop, ps-why, and the pstack router.
The source's observable process requirements are selectable evidence obligations;
they do not bundle commands, run these skills or certify their results.
