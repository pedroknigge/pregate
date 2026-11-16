# musk pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.1`. Category: **process**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## musk/algorithm

Manifest version: `1.0.0`. Status: **complete**.

### musk/MUSK-REQ-001

Check: [`musk/requirements/no-unowned-suppression@1.0.0`](checks/requirements/no-unowned-suppression/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `requirements.suppression`. Minimum severity: `none`.

Anonymous type and linter suppressions hide defects behind unaccountable shortcuts. A requirement to bypass safety must have a clear named owner.

Default parameters: `{}`.

**Repair:** Attribute the suppression to an owner or issue tracker (e.g. @ts-expect-error(owner) or eslint-disable -- owner: reason), or fix the underlying type/lint error.

**Scope and limits:** Bare @ts-ignore, @ts-nocheck, or eslint-disable without an attributed owner.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Elon Musk 5-Step Engineering Algorithm",
  "locator": "Step 1: Make requirements less dumb",
  "paraphrase": "Requirements are definitely dumb; it does not matter who gave them to you. Every requirement must come from a person with a name, not a department."
}
```

### musk/MUSK-DEL-001

Check: [`musk/deletion/no-useless-catch@1.0.0`](checks/deletion/no-useless-catch/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `deletion.useless-catch`. Minimum severity: `none`.

A try-catch block that only catches an exception and rethrows it unchanged is a redundant process step that adds noise and churn without value.

Default parameters: `{}`.

**Repair:** Delete the redundant try/catch wrapper and let the caller receive the exception naturally.

**Scope and limits:** Wrapping statements in try { ... } catch (err) { throw err; } 'just in case'.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Elon Musk 5-Step Engineering Algorithm",
  "locator": "Step 2: Delete the part or process step",
  "paraphrase": "If you are not adding things back 10% of the time, you are not deleting enough. Bias is always towards adding steps 'in case'."
}
```

### musk/MUSK-SIMP-001

Check: [`musk/simplification/no-else-after-return@1.0.0`](checks/simplification/no-else-after-return/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `simplification.guard-clause`. Minimum severity: `none`.

An else block following a return or throw statement adds gratuitous nesting and complexity to control flow.

Default parameters: `{}`.

**Repair:** Remove the else keyword, outdent the alternate block, and use early return guard clauses.

**Scope and limits:** Keeping else blocks when the preceding if branch terminates execution.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Elon Musk 5-Step Engineering Algorithm",
  "locator": "Step 3: Simplify or optimize",
  "paraphrase": "The most common error of a smart engineer is to optimize a thing that should not exist. Only simplify after you have deleted."
}
```

### musk/MUSK-FAST-001

Check: [`musk/acceleration/no-blocking-sync-io@1.0.0`](checks/acceleration/no-blocking-sync-io/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `acceleration.sync-io`. Minimum severity: `none`.

Synchronous blocking I/O calls stall the single-threaded event loop, serializing tasks and destroying cycle time and throughput.

Default parameters: `{}`.

**Repair:** Use non-blocking asynchronous APIs (e.g., node:fs/promises) with await instead of synchronous calls.

**Scope and limits:** Using readFileSync, writeFileSync, or execSync in application runtime paths.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Elon Musk 5-Step Engineering Algorithm",
  "locator": "Step 4: Accelerate cycle time",
  "paraphrase": "Move faster! But you may only accelerate cycle time after you have worked on the first three steps."
}
```

### musk/MUSK-AUTO-001

Check: [`musk/automation/no-skipped-tests@1.0.1`](checks/automation/no-skipped-tests/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `automation.skipped-tests`. Minimum severity: `none`.

Skipping or focusing tests in automated suites creates false confidence by silently dropping regression coverage.

Default parameters: `{}`.

**Repair:** Remove .skip, .only, fit, or xit modifiers so all automated tests run to completion.

**Scope and limits:** Leaving test.skip or it.only in committed test suites. Not reported: Playwright's runtime skip test.skip(condition, reason) called inside a test body, hook or describe callback, when the condition reads a runtime value (an identifier, member access, call or await) and the reason is a string; from a describe callback it conditionally skips the whole group, which is accepted. A top-level test.skip(cond, reason), a literal or always-true condition (true, 1, !0, !!1, an object, array, new expression, sequence, spread or function, also in parentheses or a cast), test.skip(title, fn), it.skip(...) and every .only stay reported. Known gaps: an always-true condition that still names a value (true || x, a const holding true), Mocha's TDD-UI test.skip(titleVar, 'reason'), and test.describe.skip / test.describe.only, which this check does not match (TDD-FOCUS-001 does).

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Elon Musk 5-Step Engineering Algorithm",
  "locator": "Step 5: Automate",
  "paraphrase": "The final step is automate. Only automate after you have designed, simplified, and deleted. And never bypass automated verification."
}
```
