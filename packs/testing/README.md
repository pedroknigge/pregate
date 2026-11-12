# testing rules pack

Optional practice policy, migrated from the pilot builtin core. Select the methodologies explicitly. These checks cover documented syntactic slices; they do not prove all semantic requirements.

`TDD-FOCUS-001` covers TypeScript and JavaScript test runners. Inside a test, hook, or describe callback it allows `test.skip()` and `test.skip(true, reason)` when they sit in an `if` whose condition is a runtime value and not always true. A top-level skip, `if (true)`, and `.only` stay reported. `TDD-SKIP-001` (warn) applies the same clean check-in rule to unconditional pytest/unittest skips in Python and `t.Skip` calls in Go; conditional skips such as `skipif` or `if testing.Short()` pass. `TEST-NOCATCH-001` (warn) flags manual `try/catch` blocks inside `test(...)` or `it(...)` callbacks so tests use `expect(() => ...).toThrow()` or `expect(...).rejects` instead of silently passing when an expected throw does not occur.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **practice**. Version: `1.2.2`. 4 distinct check IDs.

Methodologies: `testing/tdd` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
