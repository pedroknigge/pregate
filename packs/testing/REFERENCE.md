# testing pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.2`. Category: **practice**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## testing/tdd

Manifest version: `1.2.1`. Status: **complete**.

### testing/TDD-FOCUS-001

Check: [`testing/testing/no-focused-tests@1.1.3`](checks/testing/no-focused-tests/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tests.focus`. Minimum severity: `none`.

A focused or skipped test silently switches off the rest of the suite for everyone who runs it.

Default parameters: `{"paths":["**/*.test.*","**/*.spec.*","**/__tests__/**"]}`.

**Repair:** Remove the focus or skip modifier and make the test pass; if it cannot pass yet, report that instead of hiding the test.

**Scope and limits:** Bracket access, aliases or destructuring of the focused function, and modifiers in the middle of a chain. Not reported: Playwright's runtime skip test.skip(condition, reason) called inside a test body, hook or describe callback, when the condition reads a runtime value (an identifier, member access, call or await) and the reason is a string; from a describe callback it conditionally skips the whole group, which is accepted. Also not reported there: test.skip() and test.skip(true, reason) in the consequence of an if whose condition reads a runtime value and is not always-true. A top-level test.skip(cond, reason), a top-level if, if (true), a literal or always-true condition (true, 1, !0, !!1, an object, array, new expression, sequence, spread or function, also in parentheses or a cast), test.skip(title, fn), it.skip(...) and every .only stay reported. Known gaps: an always-true condition that still names a value (true || x, a const holding true) and Mocha's TDD-UI test.skip(titleVar, 'reason').

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Test-Driven Development: By Example (K. Beck, 2002)",
  "locator": "Part III, ch. 27, Testing Patterns (Clean Check-in)",
  "paraphrase": "Before integrating, the whole suite runs and passes; a change that leaves only part of the suite running hides the failures in the rest."
}
```

### testing/TDD-SKIP-001

Check: [`testing/testing/no-unconditional-skip@1.0.0`](checks/testing/no-unconditional-skip/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`, `go`. Cardinality: `singleton`. Dimension: `tests.skip`. Minimum severity: `none`.

An unconditional skip in Python or Go hides a test from every run, so the suite reports green without checking that behavior.

Default parameters: `{"paths":["**/test_*.py","**/*_test.py","**/*_test.go"]}`.

**Repair:** Make the test pass and remove the skip. If it can only run in some environments, state the condition with skipif, skipUnless, a guarded pytest.skip() or if testing.Short() { t.Skip(...) }.

**Scope and limits:** Moving the skip into pytestmark, a unittest class decorator, self.skipTest() or a subtest closure, or swapping it for an always-true skipif.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Test-Driven Development: By Example (K. Beck, 2002)",
  "locator": "Part III, ch. 27, Testing Patterns (Clean Check-in); pytest skipping docs https://docs.pytest.org/en/stable/how-to/skipping.html; Go testing package https://pkg.go.dev/testing#hdr-Skipping",
  "paraphrase": "Before integrating, the whole suite runs and passes. pytest and Go both offer conditional skips for tests that cannot run in a given environment."
}
```

### testing/TDD-DEL-001

Check: [`testing/testing/assertions-no-decrease@1.0.0`](checks/testing/assertions-no-decrease/check.json). Default severity: **ask**.

Implementation: `diff`. Phases: `pre`, `stop`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `tests.assertions`. Minimum severity: `none`.

Removing assertions to get a green run trades a visible failure for an invisible one.

Default parameters: `{"paths":["**/*.test.*","**/*.spec.*","**/__tests__/**"]}`.

**Repair:** Keep the assertions and change the production code; if the expected behavior really changed, ask the user and rewrite the assertion for the new behavior instead of deleting it.

**Scope and limits:** Commenting assertions out, deleting the test file, or moving the checks into code that never runs.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Test Desiderata (K. Beck, 2019)",
  "locator": "the behavioral and predictive properties",
  "paraphrase": "A test earns its keep by reacting to changes in behavior and by predicting whether the code works in production; a test that checks less predicts less."
}
```

### testing/TEST-NOCATCH-001

Check: [`testing/testing/no-try-catch-in-test@1.0.0`](checks/testing/no-try-catch-in-test/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `testing.no-try-catch`. Minimum severity: `none`.

When a test wraps an operation in try/catch and asserts inside the catch block, a regression where the operation stops throwing skips the catch block and lets the test pass silently.

Default parameters: `{"paths":["**/*.test.*","**/*.spec.*","**/__tests__/**"]}`.

**Repair:** Use `expect(() => fn()).toThrow(...)` for synchronous throws or `await expect(promise).rejects.toThrow(...)` for async rejections.

**Scope and limits:** try/finally blocks without a catch clause (used for resource teardown) pass. Only try statements with a catch clause inside test() or it() callbacks are flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "xUnit Test Patterns (G. Meszaros, 2007) and Jest / Vitest expect().toThrow documentation",
  "locator": "Expected Exception Test / Avoid manual try-catch in tests",
  "paraphrase": "Assert thrown exceptions and rejected promises through dedicated matcher APIs rather than wrapping the call in a manual try/catch block."
}
```
