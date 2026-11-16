# mattpocock pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.1.1`. Category: **practice**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## mattpocock/design

Manifest version: `1.1.0`. Status: **preview**.

### mattpocock/MP-PARAMS-001

Check: [`mattpocock/interfaces/fn-max-params@1.0.0`](checks/interfaces/fn-max-params/check.json). Default severity: **warn**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `fn.params`. Minimum severity: `none`.

A wide function input surface makes calling and testing the function harder. Four inputs is this pack's starting calibration, not an upstream numeric rule or a measure of module depth.

Default parameters: `{"max":4}`.

**Repair:** Group inputs that form a genuine domain concept, or simplify the function's responsibility.

**Scope and limits:** This metric counts effective inputs, including destructuring, inline object leaves and tuple-rest slots. Named aggregate types are opaque. It applies to parsed functions/methods, including internal helpers; it does not identify public seams or measure leverage, semantic depth, method count, ordering constraints or error modes. Tune max and paths; do not pad an implementation or disguise unrelated inputs in an options bag.

**Interactions when active together:**

- Duplicates `clean-code/CC-FN-002`: Both count parameters of TypeScript and JavaScript functions and share the fn.params dimension: CC-FN-002 denies above 3 and MP-PARAMS-001 warns above 4, so the warning only repeats a stricter denial. Settle: Pick the adopted limit with "resolve": {"fn.params": {"use": "clean-code/CC-FN-002"}} or the mattpocock alias.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "Matt Pocock — Skills For Real Engineers",
  "locator": "https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/codebase-design/SKILL.md — Designing for testability / Small surface area",
  "paraphrase": "Reduce the inputs a caller must understand when choosing a module interface."
}
```

### mattpocock/MP-ENUM-001

Check: [`mattpocock/types/no-enum@1.0.0`](checks/types/no-enum/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `mattpocock.no-enum`. Minimum severity: `none`.

TypeScript enums emit runtime objects, create reverse-mapping pitfalls for numeric enums, and require importing the enum symbol at every call site instead of passing plain literal values.

Default parameters: `{}`.

**Repair:** Replace the enum with a literal union (`type Status = 'pending' | 'paid'`) or an `as const` object (`const Status = { Pending: 'pending' } as const`).

**Scope and limits:** Both standard `enum` and `const enum` declarations are flagged as advisory warnings. Ambient `declare enum` declarations describing external packages are ignored.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Total TypeScript (Matt Pocock)",
  "locator": "Enums Considered Harmful / Prefer as const and union types over TypeScript enums",
  "paraphrase": "Avoid TypeScript enums in application code; use union types or as-const objects that do not emit runtime IIFEs or introduce nominal compatibility surprises."
}
```

## mattpocock/diagnosis

Manifest version: `1.0.1`. Status: **preview**.

### mattpocock/MP-DEBUG-001

Check: [`mattpocock/diagnostics/no-tagged-debug-log@1.0.0`](checks/diagnostics/no-tagged-debug-log/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `diagnostics.tagged-debug-log`. Minimum severity: `none`.

A tagged console message is a concrete remnant of temporary diagnostic instrumentation.

Default parameters: `{}`.

**Repair:** Remove the temporary tagged log after diagnosis, preserving any permanent operational logging the project needs.

**Scope and limits:** Detects direct console.log/debug/info/warn/error/trace calls with a string/template argument beginning [DEBUG-...]. It runs at all phases and can warn during active diagnosis; it cannot know when debugging is finished. A Phase 5 diff that proves a forced mutation landed is an execution step this check does not observe. Comments, unused strings and ordinary logs are allowed. Logger wrappers, console aliases, bracket calls, constructed prefixes and untagged instrumentation are outside scope. Use paths/exclude for deliberate debug artifacts.

**Interactions when active together:**

- Duplicates `vibe-proof/VP-CONSOLE-001`: A console.log tagged [DEBUG-...] outside tests is reported by both rules. Settle: Turn MP-DEBUG-001 off while VP-CONSOLE-001 already reports every console.log, or keep both for its debugging-session wording.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Matt Pocock — Skills For Real Engineers",
  "locator": "https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/diagnosing-bugs/SKILL.md — Phase 4: Instrument; Phase 6: Cleanup",
  "paraphrase": "Remove temporary debug instrumentation once the original reproduction and regression checks pass."
}
```

## mattpocock/testing

Manifest version: `1.0.0`. Status: **preview**.

### mattpocock/MP-SELF-001

Check: [`mattpocock/tests/no-self-equality@1.0.0`](checks/tests/no-self-equality/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tests.self-equality`. Minimum severity: `none`.

A positive equality assertion against the same stable expression cannot detect an incorrect result.

Default parameters: `{"paths":["**/*.test.*","**/*.spec.*","**/__tests__/**","test/**","tests/**"]}`.

**Repair:** Call the behavior under test and compare its result with an independently established expected value.

**Scope and limits:** Only direct expect(...).toBe/toEqual/toStrictEqual calls with the same identifier or scalar literal are covered. Calls, property getters, objects, negated assertions, modifiers, aliases, bracket access and recomputation through another variable are outside this slice. A custom local expect may match by name.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Matt Pocock — Skills For Real Engineers",
  "locator": "https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/tdd/SKILL.md — Anti-patterns / Tautological",
  "paraphrase": "An assertion needs an independent expected result; comparing an identifier or scalar literal with itself supplies none."
}
```

### mattpocock/MP-MOCK-001

Check: [`mattpocock/tests/no-internal-module-mock@1.0.0`](checks/tests/no-internal-module-mock/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tests.internal-module-mock`. Minimum severity: `none`.

Replacing a relative module can couple the test to internal wiring rather than behavior at its agreed seam.

Default parameters: `{"paths":["**/*.test.*","**/*.spec.*","**/__tests__/**","test/**","tests/**"]}`.

**Repair:** Exercise the owned module through its interface and inject a boundary adapter when substitution is necessary.

**Scope and limits:** This is a review warning for literal relative specifiers in vi/jest.mock, doMock, unstable_mockModule and Bun-style mock.module. A relative file can be a legitimate system adapter; review that case. Package/path aliases, computed paths, imports renamed from mock, bracket calls and spyOn are not resolved. Factory mocks remain covered by the module specifier.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Matt Pocock — Skills For Real Engineers",
  "locator": "https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/tdd/mocking.md — When to Mock",
  "paraphrase": "Use real owned modules in tests and substitute dependencies at system boundaries."
}
```

### mattpocock/MP-CALLS-001

Check: [`mattpocock/tests/no-call-count-or-order@1.0.0`](checks/tests/no-call-count-or-order/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tests.call-count-order`. Minimum severity: `none`.

Internal call counts and order often change during a refactor that preserves the user's result.

Default parameters: `{"paths":["**/*.test.*","**/*.spec.*","**/__tests__/**","test/**","tests/**"]}`.

**Repair:** Assert the returned value or the state visible through the interface. Keep count/order assertions only when they are part of the boundary contract.

**Scope and limits:** Only named count/order matchers on a receiver starting with expect(...) are recognized, including .not/.resolves chains. toHaveBeenCalledWith is allowed because an external protocol may require particular arguments. This check cannot distinguish internal collaboration from observable delivery count or ordering; aliases, bracket access and custom matchers are outside scope.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Matt Pocock — Skills For Real Engineers",
  "locator": "https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/tdd/tests.md — Bad Tests / Red flags",
  "paraphrase": "Prefer observed results at the tested interface over assertions about collaborator call counts or ordering."
}
```

### mattpocock/MP-MOCK-BRANCH-001

Check: [`mattpocock/tests/no-conditional-mock@1.0.0`](checks/tests/no-conditional-mock/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tests.mock-branch`. Minimum severity: `none`.

A branching mock duplicates endpoint routing or production decisions, making the setup harder to trust.

Default parameters: `{"paths":["**/*.test.*","**/*.spec.*","**/__tests__/**","test/**","tests/**"]}`.

**Repair:** Use operation-specific boundary methods with explicit responses. Review intentional protocol state machines before changing them.

**Scope and limits:** Only if/switch/ternary syntax nested in an inline arrow/function argument to vi.fn or jest.fn is detected, including branches in nested callback code. Named callback implementations, mockImplementation chains, Bun mock(), logical operators and helpers are outside scope. Stateful protocol fakes can legitimately branch.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Matt Pocock — Skills For Real Engineers",
  "locator": "https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/tdd/mocking.md — Designing for Mockability / Prefer SDK-style interfaces",
  "paraphrase": "Each boundary mock should provide a specific response rather than select response shapes through conditional logic."
}
```
