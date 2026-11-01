# pstack pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.1.1`. Category: **process**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## pstack/boundaries

Manifest version: `1.0.0`. Status: **complete**.

### pstack/PS-ZOD-001

Check: [`pstack/boundary/no-validator-in-domain@1.0.0`](checks/boundary/no-validator-in-domain/check.json). Default severity: **deny**.

Implementation: `banned-import`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `boundary.validator`. Minimum severity: `none`.

A validator in the domain makes the model depend on a parsing library and invites business rules to re-parse data they should already trust.

Default parameters: `{"packages":["zod","valibot","ajv","superstruct","yup","io-ts"],"paths":["**/domain/**","**/core/**","**/entities/**"]}`.

**Repair:** Parse the request in the adapter, then call the domain with the type the parser returned.

**Scope and limits:** A subpath such as zod/v4 is the same package. A relative barrel that re-exports the validator is a hole: the domain import no longer names the package.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "packages": {
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "boundary discipline",
  "paraphrase": "Guards sit at the system boundary. Inside that boundary the code trusts its types and keeps the business rules free of framework adapters."
}
```

### pstack/PS-AS-001

Check: [`pstack/types/no-assertion-in-domain@1.0.0`](checks/types/no-assertion-in-domain/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `domain.assertion`. Minimum severity: `none`.

An assertion tells the checker to trust the author. In the domain that lie becomes a business rule that was never parsed.

Default parameters: `{}`.

**Repair:** Parse untrusted input in the adapter. Inside the domain, narrow with a guard that returns the domain type.

**Scope and limits:** `as const` is a value narrowing, not a lie about a foreign row. A double assertion is still an assertion. Core already rejects the double-assertion form on its own; this rule rejects each `as` in the domain.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "type system discipline",
  "paraphrase": "Refuse to lie to the checker. External data is parsed at the boundary so the domain never asserts a type it did not construct."
}
```

### pstack/PS-PARTIAL-001

Check: [`pstack/types/no-partial-patch@1.0.0`](checks/types/no-partial-patch/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `domain.patch-bag`. Minimum severity: `none`.

A Partial patch hides which fields the operation is allowed to change. Callers invent combinations the domain never named.

Default parameters: `{}`.

**Repair:** Replace the patch with a named operation whose parameters are the fields it actually changes.

**Scope and limits:** A type alias `type Patch = Partial<Order>` is not a parameter, so this rule does not see it. Intersecting Partial with `{ id: string }` does not name the operation.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "model the domain",
  "paraphrase": "Stateful changes belong to named operations. A bag of optional fields repeats a shape assumption instead of encoding the change the domain allows."
}
```

### pstack/PS-LEGACY-001

Check: [`pstack/modules/no-legacy-import@1.0.1`](checks/modules/no-legacy-import/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `modules.legacy`. Minimum severity: `none`.

A compatibility path keeps two APIs alive. Callers of the old one never move, so the deletion the change was for does not happen.

Default parameters: `{}`.

**Repair:** Point the caller at the new module and delete the legacy file in the same change.

**Scope and limits:** Only module specifiers count (import/export sources, TS `import x = require()`, and the first argument of `import()` and `require()`), and only project-internal ones starting with `./`, `../`, `@/`, `~/` or `#`. A template literal counts when its text starts with one of those prefixes, even if a `${…}` comes before the legacy segment. Plain strings such as i18n namespaces (`estimateTemplates.legacy`) and bare package subpaths such as `pdfjs-dist/legacy/...` are not this rule. A name like legacy-adapter has no `.legacy` suffix and no `/legacy` segment, so it is not this rule either. Known holes: a specifier ending in `.legacy.ts` (the suffix is `.ts`, not end-of-string); custom tsconfig path aliases such as `@app/legacy/x`; bare specifiers resolved through `baseUrl` such as `src/legacy/x`; template literals that start with `${…}`; and resolver or mock calls that are not plain `require()`/`import()`, such as `require.resolve()`, `module.require()`, `(require)()`, `import.meta.resolve()`, `jest.mock()` and `vi.mock()`.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "migrate callers then delete legacy APIs",
  "paraphrase": "When a new internal API replaces an old one, move the callers and delete the old API in the same wave instead of leaving a compatibility layer behind."
}
```

## pstack/effects

Manifest version: `1.0.0`. Status: **complete**.

### pstack/PS-IDEM-001

Check: [`pstack/effects/payment-create-has-idempotency-key@1.0.0`](checks/effects/payment-create-has-idempotency-key/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `effects.idempotency-key`. Minimum severity: `none`.

Those calls move money. Without a key, a timeout and a retry post the operation twice.

Default parameters: `{}`.

**Repair:** Pass an idempotency key that is stable for the business operation, not a fresh random value per attempt.

**Scope and limits:** The word only has to appear in the call's text, so a comment above the call does not count and a decoy field name that contains idempotency does. Calls that are not on this object list are out of scope. Designing the key so a retry converges is still judgment.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "make operations idempotent",
  "paraphrase": "A command that can run twice because of a crash or a retry must converge to the same end state. A payment create without a stable key does not."
}
```

## pstack/operations

Manifest version: `1.0.0`. Status: **preview**.

### pstack/PS-24

Check: [`pstack/operations/ps-24@1.0.0`](checks/operations/ps-24/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-24`. Minimum severity: `deny`.

poteto-mode: Every non-trivial task is routed through a named playbook. The playbook’s steps are copied into the working list before reasoning begins.

Default parameters: `{"verifier":"PS-24"}`.

**Repair:** Bind PS-24 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-24; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:44; PS-24",
  "paraphrase": "poteto-mode: Every non-trivial task is routed through a named playbook. The playbook’s steps are copied into the working list before reasoning begins."
}
```

### pstack/PS-25

Check: [`pstack/operations/ps-25@1.0.0`](checks/operations/ps-25/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-25`. Minimum severity: `deny`.

how: An explanation of a subsystem is grounded in the code path that implements it, not in recollection.

Default parameters: `{"verifier":"PS-25"}`.

**Repair:** Bind PS-25 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-25; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:45; PS-25",
  "paraphrase": "how: An explanation of a subsystem is grounded in the code path that implements it, not in recollection."
}
```

### pstack/PS-26

Check: [`pstack/operations/ps-26@1.0.0`](checks/operations/ps-26/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-26`. Minimum severity: `deny`.

why: A claim about why something was built cites evidence from the record — commits, issues, decision records — not an unsupported assertion.

Default parameters: `{"verifier":"PS-26"}`.

**Repair:** Bind PS-26 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-26; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:46; PS-26",
  "paraphrase": "why: A claim about why something was built cites evidence from the record — commits, issues, decision records — not an unsupported assertion."
}
```

### pstack/PS-27

Check: [`pstack/operations/ps-27@1.0.0`](checks/operations/ps-27/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-27`. Minimum severity: `deny`.

recall: Resumed work rebuilds recent context on the topic from the repository and the session record before new edits start.

Default parameters: `{"verifier":"PS-27"}`.

**Repair:** Bind PS-27 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-27; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:47; PS-27",
  "paraphrase": "recall: Resumed work rebuilds recent context on the topic from the repository and the session record before new edits start."
}
```

### pstack/PS-28

Check: [`pstack/operations/ps-28@1.0.0`](checks/operations/ps-28/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-28`. Minimum severity: `deny`.

blast-radius: The safety of a small-looking change is established by executing the code it can affect, not by asserting locality.

Default parameters: `{"verifier":"PS-28"}`.

**Repair:** Bind PS-28 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-28; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:48; PS-28",
  "paraphrase": "blast-radius: The safety of a small-looking change is established by executing the code it can affect, not by asserting locality."
}
```

### pstack/PS-29

Check: [`pstack/operations/ps-29@1.0.0`](checks/operations/ps-29/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-29`. Minimum severity: `deny`.

architect: Types, caller usage, and module shape are settled before code that crosses a function boundary is written.

Default parameters: `{"verifier":"PS-29"}`.

**Repair:** Bind PS-29 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-29; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:49; PS-29",
  "paraphrase": "architect: Types, caller usage, and module shape are settled before code that crosses a function boundary is written."
}
```

### pstack/PS-30

Check: [`pstack/operations/ps-30@1.0.0`](checks/operations/ps-30/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-30`. Minimum severity: `deny`.

arena: N parallel attempts at the same problem are reduced to one selected result. Competing diffs are not left as the deliverable.

Default parameters: `{"verifier":"PS-30"}`.

**Repair:** Bind PS-30 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-30; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:50; PS-30",
  "paraphrase": "arena: N parallel attempts at the same problem are reduced to one selected result. Competing diffs are not left as the deliverable."
}
```

### pstack/PS-31

Check: [`pstack/operations/ps-31@1.0.0`](checks/operations/ps-31/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-31`. Minimum severity: `deny`.

swarm: N parallel workers on distinct slices or races produce one aggregated report.

Default parameters: `{"verifier":"PS-31"}`.

**Repair:** Bind PS-31 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-31; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:51; PS-31",
  "paraphrase": "swarm: N parallel workers on distinct slices or races produce one aggregated report."
}
```

### pstack/PS-32

Check: [`pstack/operations/ps-32@1.0.0`](checks/operations/ps-32/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-32`. Minimum severity: `deny`.

interrogate: A diff is attacked by an independent reviewer before it is called done.

Default parameters: `{"verifier":"PS-32"}`.

**Repair:** Bind PS-32 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-32; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:52; PS-32",
  "paraphrase": "interrogate: A diff is attacked by an independent reviewer before it is called done."
}
```

### pstack/PS-33

Check: [`pstack/operations/ps-33@1.0.0`](checks/operations/ps-33/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-33`. Minimum severity: `deny`.

automate-me: A personal mode skill is drafted from observed working patterns, not from an invented persona.

Default parameters: `{"verifier":"PS-33"}`.

**Repair:** Bind PS-33 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-33; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:53; PS-33",
  "paraphrase": "automate-me: A personal mode skill is drafted from observed working patterns, not from an invented persona."
}
```

### pstack/PS-34

Check: [`pstack/operations/ps-34@1.0.0`](checks/operations/ps-34/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-34`. Minimum severity: `deny`.

make-bot-ui: A control surface that wakes an agent does so over an explicit webhook contract.

Default parameters: `{"verifier":"PS-34"}`.

**Repair:** Bind PS-34 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-34; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:54; PS-34",
  "paraphrase": "make-bot-ui: A control surface that wakes an agent does so over an explicit webhook contract."
}
```

### pstack/PS-35

Check: [`pstack/operations/ps-35@1.0.0`](checks/operations/ps-35/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-35`. Minimum severity: `deny`.

setup-pstack: Model assignment per role is written in one rule file. An unstated role keeps its default.

Default parameters: `{"verifier":"PS-35"}`.

**Repair:** Bind PS-35 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-35; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:55; PS-35",
  "paraphrase": "setup-pstack: Model assignment per role is written in one rule file. An unstated role keeps its default."
}
```

### pstack/PS-36

Check: [`pstack/operations/ps-36@1.0.0`](checks/operations/ps-36/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-36`. Minimum severity: `deny`.

reflect: A finished hard task updates the skill or check that would have prevented the miss.

Default parameters: `{"verifier":"PS-36"}`.

**Repair:** Bind PS-36 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-36; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:56; PS-36",
  "paraphrase": "reflect: A finished hard task updates the skill or check that would have prevented the miss."
}
```

### pstack/PS-37

Check: [`pstack/operations/ps-37@1.0.0`](checks/operations/ps-37/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-37`. Minimum severity: `deny`.

teach: A teaching pass leaves the reader able to reconstruct the change.

Default parameters: `{"verifier":"PS-37"}`.

**Repair:** Bind PS-37 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-37; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:57; PS-37",
  "paraphrase": "teach: A teaching pass leaves the reader able to reconstruct the change."
}
```

### pstack/PS-38

Check: [`pstack/operations/ps-38@1.0.0`](checks/operations/ps-38/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-38`. Minimum severity: `deny`.

tdd: A bug fix on a cheap local test path has a test that failed before the fix and passes after it.

Default parameters: `{"verifier":"PS-38"}`.

**Repair:** Bind PS-38 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-38; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:58; PS-38",
  "paraphrase": "tdd: A bug fix on a cheap local test path has a test that failed before the fix and passes after it."
}
```

### pstack/PS-39

Check: [`pstack/operations/ps-39@1.0.0`](checks/operations/ps-39/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-39`. Minimum severity: `deny`.

no-comments: Comments that restate the code are absent at review.

Default parameters: `{"verifier":"PS-39"}`.

**Repair:** Bind PS-39 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-39; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:59; PS-39",
  "paraphrase": "no-comments: Comments that restate the code are absent at review."
}
```

### pstack/PS-40

Check: [`pstack/operations/ps-40@1.0.0`](checks/operations/ps-40/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-40`. Minimum severity: `deny`.

typescript-best-practices: TypeScript edits obey type-system discipline in syntax: no escaped `any`, exhaustive unions, parsed boundaries.

Default parameters: `{"verifier":"PS-40"}`.

**Repair:** Bind PS-40 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-40; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:60; PS-40",
  "paraphrase": "typescript-best-practices: TypeScript edits obey type-system discipline in syntax: no escaped `any`, exhaustive unions, parsed boundaries."
}
```

### pstack/PS-41

Check: [`pstack/operations/ps-41@1.0.0`](checks/operations/ps-41/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-41`. Minimum severity: `deny`.

figure-it-out: When no bundled playbook fits, a rigorous auditable playbook is designed for the task before execution.

Default parameters: `{"verifier":"PS-41"}`.

**Repair:** Bind PS-41 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-41; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:61; PS-41",
  "paraphrase": "figure-it-out: When no bundled playbook fits, a rigorous auditable playbook is designed for the task before execution."
}
```

### pstack/PS-42

Check: [`pstack/operations/ps-42@1.0.0`](checks/operations/ps-42/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-42`. Minimum severity: `deny`.

show-me-your-work: Decisions of a non-trivial task are logged in a reviewable trail a later reader can open.

Default parameters: `{"verifier":"PS-42"}`.

**Repair:** Bind PS-42 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-42; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:62; PS-42",
  "paraphrase": "show-me-your-work: Decisions of a non-trivial task are logged in a reviewable trail a later reader can open."
}
```

### pstack/PS-43

Check: [`pstack/operations/ps-43@1.0.0`](checks/operations/ps-43/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-43`. Minimum severity: `deny`.

create-verification-skill: A project with no scripted proof of app behavior gains a project-local verify skill before “done” is claimed.

Default parameters: `{"verifier":"PS-43"}`.

**Repair:** Bind PS-43 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-43; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:63; PS-43",
  "paraphrase": "create-verification-skill: A project with no scripted proof of app behavior gains a project-local verify skill before “done” is claimed."
}
```

### pstack/PS-44

Check: [`pstack/operations/ps-44@1.0.0`](checks/operations/ps-44/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-44`. Minimum severity: `deny`.

maintain-verification-skill: A verify skill whose feature map has drifted from the app is updated from source plus one live pass.

Default parameters: `{"verifier":"PS-44"}`.

**Repair:** Bind PS-44 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-44; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:64; PS-44",
  "paraphrase": "maintain-verification-skill: A verify skill whose feature map has drifted from the app is updated from source plus one live pass."
}
```

### pstack/PS-45

Check: [`pstack/operations/ps-45@1.0.0`](checks/operations/ps-45/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-45`. Minimum severity: `deny`.

unslop: Delivered prose and code contain no filler a maintainer would have to delete to recover the claim.

Default parameters: `{"verifier":"PS-45"}`.

**Repair:** Bind PS-45 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-45; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:65; PS-45",
  "paraphrase": "unslop: Delivered prose and code contain no filler a maintainer would have to delete to recover the claim."
}
```

### pstack/PS-46

Check: [`pstack/operations/ps-46@1.0.0`](checks/operations/ps-46/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-46`. Minimum severity: `deny`.

bro: A restatement in plain language preserves the claim and drops the jargon.

Default parameters: `{"verifier":"PS-46"}`.

**Repair:** Bind PS-46 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-46; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:66; PS-46",
  "paraphrase": "bro: A restatement in plain language preserves the claim and drops the jargon."
}
```

### pstack/PS-47

Check: [`pstack/operations/ps-47@1.0.0`](checks/operations/ps-47/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-47`. Minimum severity: `deny`.

technical-writing: Docs, RFCs, READMEs, PR descriptions, and commit messages follow a layered standard: claim, evidence, consequence.

Default parameters: `{"verifier":"PS-47"}`.

**Repair:** Bind PS-47 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-47; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:67; PS-47",
  "paraphrase": "technical-writing: Docs, RFCs, READMEs, PR descriptions, and commit messages follow a layered standard: claim, evidence, consequence."
}
```

## pstack/playbooks

Manifest version: `1.0.0`. Status: **preview**.

### pstack/PS-48

Check: [`pstack/playbooks/ps-48@1.0.0`](checks/playbooks/ps-48/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-48`. Minimum severity: `deny`.

Investigation is read-only. It answers how, why, or whether, and it does not edit.

Default parameters: `{"verifier":"PS-48"}`.

**Repair:** Bind PS-48 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-48; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:73; PS-48",
  "paraphrase": "Investigation is read-only. It answers how, why, or whether, and it does not edit."
}
```

### pstack/PS-49

Check: [`pstack/playbooks/ps-49@1.0.0`](checks/playbooks/ps-49/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-49`. Minimum severity: `deny`.

Bug fix reproduces the defect, names the root cause, and fixes it against runtime evidence.

Default parameters: `{"verifier":"PS-49"}`.

**Repair:** Bind PS-49 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-49; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:74; PS-49",
  "paraphrase": "Bug fix reproduces the defect, names the root cause, and fixes it against runtime evidence."
}
```

### pstack/PS-50

Check: [`pstack/playbooks/ps-50@1.0.0`](checks/playbooks/ps-50/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-50`. Minimum severity: `deny`.

Performance traces a measured slowness and reports the change against a baseline.

Default parameters: `{"verifier":"PS-50"}`.

**Repair:** Bind PS-50 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-50; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:75; PS-50",
  "paraphrase": "Performance traces a measured slowness and reports the change against a baseline."
}
```

### pstack/PS-51

Check: [`pstack/playbooks/ps-51@1.0.0`](checks/playbooks/ps-51/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-51`. Minimum severity: `deny`.

Hill climb improves one metric against a target by hypotheses with before-and-after measurement.

Default parameters: `{"verifier":"PS-51"}`.

**Repair:** Bind PS-51 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-51; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:76; PS-51",
  "paraphrase": "Hill climb improves one metric against a target by hypotheses with before-and-after measurement."
}
```

### pstack/PS-52

Check: [`pstack/playbooks/ps-52@1.0.0`](checks/playbooks/ps-52/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-52`. Minimum severity: `deny`.

Runtime forensics diagnoses a live symptom from instrumentation, not from a guessed patch.

Default parameters: `{"verifier":"PS-52"}`.

**Repair:** Bind PS-52 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-52; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:77; PS-52",
  "paraphrase": "Runtime forensics diagnoses a live symptom from instrumentation, not from a guessed patch."
}
```

### pstack/PS-53

Check: [`pstack/playbooks/ps-53@1.0.0`](checks/playbooks/ps-53/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-53`. Minimum severity: `deny`.

Trace forensics diagnoses a captured profile, trace, spindump, or heap snapshot.

Default parameters: `{"verifier":"PS-53"}`.

**Repair:** Bind PS-53 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-53; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:78; PS-53",
  "paraphrase": "Trace forensics diagnoses a captured profile, trace, spindump, or heap snapshot."
}
```

### pstack/PS-54

Check: [`pstack/playbooks/ps-54@1.0.0`](checks/playbooks/ps-54/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-54`. Minimum severity: `deny`.

Feature builds new or changed behavior from a named data shape.

Default parameters: `{"verifier":"PS-54"}`.

**Repair:** Bind PS-54 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-54; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:79; PS-54",
  "paraphrase": "Feature builds new or changed behavior from a named data shape."
}
```

### pstack/PS-55

Check: [`pstack/playbooks/ps-55@1.0.0`](checks/playbooks/ps-55/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-55`. Minimum severity: `deny`.

Refactoring preserves observable behavior. A refactor that changes behavior is a feature or a bug fix.

Default parameters: `{"verifier":"PS-55"}`.

**Repair:** Bind PS-55 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-55; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:80; PS-55",
  "paraphrase": "Refactoring preserves observable behavior. A refactor that changes behavior is a feature or a bug fix."
}
```

### pstack/PS-56

Check: [`pstack/playbooks/ps-56@1.0.0`](checks/playbooks/ps-56/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-56`. Minimum severity: `deny`.

Prototype is throwaway. Its product is a decision. It does not enter production without a rewrite.

Default parameters: `{"verifier":"PS-56"}`.

**Repair:** Bind PS-56 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-56; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:81; PS-56",
  "paraphrase": "Prototype is throwaway. Its product is a decision. It does not enter production without a rewrite."
}
```

### pstack/PS-57

Check: [`pstack/playbooks/ps-57@1.0.0`](checks/playbooks/ps-57/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-57`. Minimum severity: `deny`.

Visual parity claims pixel-exact equivalence only after both implementations have been compared.

Default parameters: `{"verifier":"PS-57"}`.

**Repair:** Bind PS-57 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-57; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:82; PS-57",
  "paraphrase": "Visual parity claims pixel-exact equivalence only after both implementations have been compared."
}
```

### pstack/PS-58

Check: [`pstack/playbooks/ps-58@1.0.0`](checks/playbooks/ps-58/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-58`. Minimum severity: `deny`.

Authoring a skill produces a `SKILL.md` whose trigger, steps, and exit criteria a later agent can follow.

Default parameters: `{"verifier":"PS-58"}`.

**Repair:** Bind PS-58 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-58; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:83; PS-58",
  "paraphrase": "Authoring a skill produces a `SKILL.md` whose trigger, steps, and exit criteria a later agent can follow."
}
```

### pstack/PS-59

Check: [`pstack/playbooks/ps-59@1.0.0`](checks/playbooks/ps-59/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-59`. Minimum severity: `deny`.

Eval tests a skill or prompt change with a blinded comparison.

Default parameters: `{"verifier":"PS-59"}`.

**Repair:** Bind PS-59 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-59; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:84; PS-59",
  "paraphrase": "Eval tests a skill or prompt change with a blinded comparison."
}
```

### pstack/PS-60

Check: [`pstack/playbooks/ps-60@1.0.0`](checks/playbooks/ps-60/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-60`. Minimum severity: `deny`.

Babysit drives a PR or a stack to merge-ready: conflicts, review threads, and CI are closed or deferred.

Default parameters: `{"verifier":"PS-60"}`.

**Repair:** Bind PS-60 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-60; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:85; PS-60",
  "paraphrase": "Babysit drives a PR or a stack to merge-ready: conflicts, review threads, and CI are closed or deferred."
}
```

### pstack/PS-61

Check: [`pstack/playbooks/ps-61@1.0.0`](checks/playbooks/ps-61/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-61`. Minimum severity: `deny`.

Shipping independently verifies a green stack, then lands the contiguous verified run bottom-up.

Default parameters: `{"verifier":"PS-61"}`.

**Repair:** Bind PS-61 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-61; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:86; PS-61",
  "paraphrase": "Shipping independently verifies a green stack, then lands the contiguous verified run bottom-up."
}
```

### pstack/PS-62

Check: [`pstack/playbooks/ps-62@1.0.0`](checks/playbooks/ps-62/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-62`. Minimum severity: `deny`.

Autonomous run drives a long task to completion without stopping for reversible choices.

Default parameters: `{"verifier":"PS-62"}`.

**Repair:** Bind PS-62 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-62; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:87; PS-62",
  "paraphrase": "Autonomous run drives a long task to completion without stopping for reversible choices."
}
```

### pstack/PS-63

Check: [`pstack/playbooks/ps-63@1.0.0`](checks/playbooks/ps-63/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-63`. Minimum severity: `deny`.

Orchestrate assigns a multi-day project to one coordinator.

Default parameters: `{"verifier":"PS-63"}`.

**Repair:** Bind PS-63 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-63; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:88; PS-63",
  "paraphrase": "Orchestrate assigns a multi-day project to one coordinator."
}
```

### pstack/PS-64

Check: [`pstack/playbooks/ps-64@1.0.0`](checks/playbooks/ps-64/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-64`. Minimum severity: `deny`.

Autopilot full runs independent PRs to merged with one owner per PR.

Default parameters: `{"verifier":"PS-64"}`.

**Repair:** Bind PS-64 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-64; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:89; PS-64",
  "paraphrase": "Autopilot full runs independent PRs to merged with one owner per PR."
}
```

### pstack/PS-65

Check: [`pstack/playbooks/ps-65@1.0.0`](checks/playbooks/ps-65/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-65`. Minimum severity: `deny`.

Autopilot stack builds and verifies one linear stack for the operator to review and land.

Default parameters: `{"verifier":"PS-65"}`.

**Repair:** Bind PS-65 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-65; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:90; PS-65",
  "paraphrase": "Autopilot stack builds and verifies one linear stack for the operator to review and land."
}
```

### pstack/PS-66

Check: [`pstack/playbooks/ps-66@1.0.0`](checks/playbooks/ps-66/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-66`. Minimum severity: `deny`.

Session pickup resumes in-flight work from the recorded state, not from a reconstructed guess.

Default parameters: `{"verifier":"PS-66"}`.

**Repair:** Bind PS-66 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-66; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:91; PS-66",
  "paraphrase": "Session pickup resumes in-flight work from the recorded state, not from a reconstructed guess."
}
```

### pstack/PS-67

Check: [`pstack/playbooks/ps-67@1.0.0`](checks/playbooks/ps-67/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-67`. Minimum severity: `deny`.

Pause safely suspends in-flight work so a later session can resume it.

Default parameters: `{"verifier":"PS-67"}`.

**Repair:** Bind PS-67 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-67; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:92; PS-67",
  "paraphrase": "Pause safely suspends in-flight work so a later session can resume it."
}
```

### pstack/PS-68

Check: [`pstack/playbooks/ps-68@1.0.0`](checks/playbooks/ps-68/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-68`. Minimum severity: `deny`.

Multi-phase plan names phases, the verifiable exit of each phase, and the order.

Default parameters: `{"verifier":"PS-68"}`.

**Repair:** Bind PS-68 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-68; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:93; PS-68",
  "paraphrase": "Multi-phase plan names phases, the verifiable exit of each phase, and the order."
}
```

### pstack/PS-69

Check: [`pstack/playbooks/ps-69@1.0.0`](checks/playbooks/ps-69/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-69`. Minimum severity: `deny`.

Worktree cleanup leaves no orphan worktree whose branch is unrecorded.

Default parameters: `{"verifier":"PS-69"}`.

**Repair:** Bind PS-69 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-69; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:94; PS-69",
  "paraphrase": "Worktree cleanup leaves no orphan worktree whose branch is unrecorded."
}
```

### pstack/PS-70

Check: [`pstack/playbooks/ps-70@1.0.0`](checks/playbooks/ps-70/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-70`. Minimum severity: `deny`.

Opening a PR states the problem, the change, and the proof.

Default parameters: `{"verifier":"PS-70"}`.

**Repair:** Bind PS-70 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-70; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:95; PS-70",
  "paraphrase": "Opening a PR states the problem, the change, and the proof."
}
```

## pstack/principles

Manifest version: `1.0.0`. Status: **preview**.

### pstack/PS-01

Check: [`pstack/principles/ps-01@1.0.0`](checks/principles/ps-01/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-01`. Minimum severity: `deny`.

PS-01 (Laziness protocol): The merged change is the smallest diff that solves the stated problem. Dead code, unused abstractions, and speculative generality are absent.

Default parameters: `{"verifier":"PS-01"}`.

**Repair:** Bind PS-01 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-01; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:10; PS-01",
  "paraphrase": "PS-01 (Laziness protocol): The merged change is the smallest diff that solves the stated problem. Dead code, unused abstractions, and speculative generality are absent."
}
```

### pstack/PS-02

Check: [`pstack/principles/ps-02@1.0.0`](checks/principles/ps-02/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-02`. Minimum severity: `deny`.

PS-02 (Foundational thinking): Core types, data structures, and the sharing relation among concurrent actors are fixed before behavioral logic is written.

Default parameters: `{"verifier":"PS-02"}`.

**Repair:** Bind PS-02 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-02; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:11; PS-02",
  "paraphrase": "PS-02 (Foundational thinking): Core types, data structures, and the sharing relation among concurrent actors are fixed before behavioral logic is written."
}
```

### pstack/PS-03

Check: [`pstack/principles/ps-03@1.0.0`](checks/principles/ps-03/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-03`. Minimum severity: `deny`.

PS-03 (Redesign from first principles): A new requirement is integrated as if it had been a foundational assumption from day one. It is not bolted onto the previous shape.

Default parameters: `{"verifier":"PS-03"}`.

**Repair:** Bind PS-03 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-03; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:12; PS-03",
  "paraphrase": "PS-03 (Redesign from first principles): A new requirement is integrated as if it had been a foundational assumption from day one. It is not bolted onto the previous shape."
}
```

### pstack/PS-04

Check: [`pstack/principles/ps-04@1.0.0`](checks/principles/ps-04/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-04`. Minimum severity: `deny`.

PS-04 (Attack the premise): After two or more fixes that share one premise fail the same gate, the premise is rejected before another patch that assumes it is written.

Default parameters: `{"verifier":"PS-04"}`.

**Repair:** Bind PS-04 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-04; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:13; PS-04",
  "paraphrase": "PS-04 (Attack the premise): After two or more fixes that share one premise fail the same gate, the premise is rejected before another patch that assumes it is written."
}
```

### pstack/PS-05

Check: [`pstack/principles/ps-05@1.0.0`](checks/principles/ps-05/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-05`. Minimum severity: `deny`.

PS-05 (Subtract before you add): Dead weight, redundant validators, and stub references are removed before new structure is built on what remains.

Default parameters: `{"verifier":"PS-05"}`.

**Repair:** Bind PS-05 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-05; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:14; PS-05",
  "paraphrase": "PS-05 (Subtract before you add): Dead weight, redundant validators, and stub references are removed before new structure is built on what remains."
}
```

### pstack/PS-06

Check: [`pstack/principles/ps-06@1.0.0`](checks/principles/ps-06/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-06`. Minimum severity: `deny`.

PS-06 (Minimize reader load): The number of layers between a question and its answer is minimal. One-caller wrappers are collapsed. Mutable state a reader must hold in their head is absent.

Default parameters: `{"verifier":"PS-06"}`.

**Repair:** Bind PS-06 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-06; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:15; PS-06",
  "paraphrase": "PS-06 (Minimize reader load): The number of layers between a question and its answer is minimal. One-caller wrappers are collapsed. Mutable state a reader must hold in their head is absent."
}
```

### pstack/PS-07

Check: [`pstack/principles/ps-07@1.0.0`](checks/principles/ps-07/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-07`. Minimum severity: `deny`.

PS-07 (Outcome-oriented execution): A planned rewrite converges on the target architecture. Throwaway compatibility states are not preserved to keep intermediate diffs smooth.

Default parameters: `{"verifier":"PS-07"}`.

**Repair:** Bind PS-07 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-07; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:16; PS-07",
  "paraphrase": "PS-07 (Outcome-oriented execution): A planned rewrite converges on the target architecture. Throwaway compatibility states are not preserved to keep intermediate diffs smooth."
}
```

### pstack/PS-08

Check: [`pstack/principles/ps-08@1.0.0`](checks/principles/ps-08/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-08`. Minimum severity: `deny`.

PS-08 (Experience first): When implementation convenience conflicts with the consumer’s experience, the consumer wins. Fewer polished capabilities ship in preference to more rough ones.

Default parameters: `{"verifier":"PS-08"}`.

**Repair:** Bind PS-08 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-08; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:17; PS-08",
  "paraphrase": "PS-08 (Experience first): When implementation convenience conflicts with the consumer’s experience, the consumer wins. Fewer polished capabilities ship in preference to more rough ones."
}
```

### pstack/PS-09

Check: [`pstack/principles/ps-09@1.0.0`](checks/principles/ps-09/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-09`. Minimum severity: `deny`.

PS-09 (Exhaust the design space): Where no precedent decides the design, two or three competing prototypes are compared before a commitment.

Default parameters: `{"verifier":"PS-09"}`.

**Repair:** Bind PS-09 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-09; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:18; PS-09",
  "paraphrase": "PS-09 (Exhaust the design space): Where no precedent decides the design, two or three competing prototypes are compared before a commitment."
}
```

### pstack/PS-10

Check: [`pstack/principles/ps-10@1.0.0`](checks/principles/ps-10/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-10`. Minimum severity: `deny`.

PS-10 (Build the lever): Non-trivial edits, migrations, analyses, and checks are performed by a rerunnable tool — codemod, script, generator, or skill — not by unreproducible hand work.

Default parameters: `{"verifier":"PS-10"}`.

**Repair:** Bind PS-10 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-10; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:19; PS-10",
  "paraphrase": "PS-10 (Build the lever): Non-trivial edits, migrations, analyses, and checks are performed by a rerunnable tool — codemod, script, generator, or skill — not by unreproducible hand work."
}
```

### pstack/PS-11

Check: [`pstack/principles/ps-11@1.0.0`](checks/principles/ps-11/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-11`. Minimum severity: `deny`.

PS-11 (Model the domain): A repeated domain rule lives in one structure — a state machine, a typed model, a table — not in scattered conditionals.

Default parameters: `{"verifier":"PS-11"}`.

**Repair:** Bind PS-11 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-11; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:22; PS-11",
  "paraphrase": "PS-11 (Model the domain): A repeated domain rule lives in one structure — a state machine, a typed model, a table — not in scattered conditionals."
}
```

### pstack/PS-12

Check: [`pstack/principles/ps-12@1.0.0`](checks/principles/ps-12/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-12`. Minimum severity: `deny`.

PS-12 (Boundary discipline): Guards, parsing, and validation sit at system boundaries (CLI, config, network, external APIs). Internal business logic is pure and trusts its types.

Default parameters: `{"verifier":"PS-12"}`.

**Repair:** Bind PS-12 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-12; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:23; PS-12",
  "paraphrase": "PS-12 (Boundary discipline): Guards, parsing, and validation sit at system boundaries (CLI, config, network, external APIs). Internal business logic is pure and trusts its types."
}
```

### pstack/PS-13

Check: [`pstack/principles/ps-13@1.0.0`](checks/principles/ps-13/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-13`. Minimum severity: `deny`.

PS-13 (Type-system discipline): Illegal states are unrepresentable. Semantic primitives are branded. External data is parsed at the boundary. Variants are exhaustive. The compiler is not lied to.

Default parameters: `{"verifier":"PS-13"}`.

**Repair:** Bind PS-13 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-13; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:24; PS-13",
  "paraphrase": "PS-13 (Type-system discipline): Illegal states are unrepresentable. Semantic primitives are branded. External data is parsed at the boundary. Variants are exhaustive. The compiler is not lied to."
}
```

### pstack/PS-14

Check: [`pstack/principles/ps-14@1.0.0`](checks/principles/ps-14/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-14`. Minimum severity: `deny`.

PS-14 (Idempotent operations): A retried or partially rerun operation converges to the same end state as a single successful run.

Default parameters: `{"verifier":"PS-14"}`.

**Repair:** Bind PS-14 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-14; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:25; PS-14",
  "paraphrase": "PS-14 (Idempotent operations): A retried or partially rerun operation converges to the same end state as a single successful run."
}
```

### pstack/PS-15

Check: [`pstack/principles/ps-15@1.0.0`](checks/principles/ps-15/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-15`. Minimum severity: `deny`.

PS-15 (Migrate callers, then delete): Callers of a legacy API are migrated and the old API is deleted in the same wave. A compatibility layer is not the resting state.

Default parameters: `{"verifier":"PS-15"}`.

**Repair:** Bind PS-15 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-15; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:26; PS-15",
  "paraphrase": "PS-15 (Migrate callers, then delete): Callers of a legacy API are migrated and the old API is deleted in the same wave. A compatibility layer is not the resting state."
}
```

### pstack/PS-16

Check: [`pstack/principles/ps-16@1.0.0`](checks/principles/ps-16/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-16`. Minimum severity: `deny`.

PS-16 (Separate before serializing): Shared mutable state is eliminated before coordination is added. Serialization is introduced only when a single shared writer is a real invariant.

Default parameters: `{"verifier":"PS-16"}`.

**Repair:** Bind PS-16 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-16; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:27; PS-16",
  "paraphrase": "PS-16 (Separate before serializing): Shared mutable state is eliminated before coordination is added. Serialization is introduced only when a single shared writer is a real invariant."
}
```

### pstack/PS-17

Check: [`pstack/principles/ps-17@1.0.0`](checks/principles/ps-17/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-17`. Minimum severity: `deny`.

PS-17 (Prove it works): A task is not done until the real artifact has been exercised — the feature run, the value read, the diff inspected.

Default parameters: `{"verifier":"PS-17"}`.

**Repair:** Bind PS-17 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-17; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:30; PS-17",
  "paraphrase": "PS-17 (Prove it works): A task is not done until the real artifact has been exercised — the feature run, the value read, the diff inspected."
}
```

### pstack/PS-18

Check: [`pstack/principles/ps-18@1.0.0`](checks/principles/ps-18/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-18`. Minimum severity: `deny`.

PS-18 (Fix root causes): A defect is reproduced and traced to its cause before code changes. A nil-check or guard whose only effect is to silence the crash is absent.

Default parameters: `{"verifier":"PS-18"}`.

**Repair:** Bind PS-18 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-18; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:31; PS-18",
  "paraphrase": "PS-18 (Fix root causes): A defect is reproduced and traced to its cause before code changes. A nil-check or guard whose only effect is to silence the crash is absent."
}
```

### pstack/PS-19

Check: [`pstack/principles/ps-19@1.0.0`](checks/principles/ps-19/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-19`. Minimum severity: `deny`.

PS-19 (Sequence verifiable units): Multi-step work is broken into units that each end in a checked state. The next unit does not start until the current unit is verified.

Default parameters: `{"verifier":"PS-19"}`.

**Repair:** Bind PS-19 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-19; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:32; PS-19",
  "paraphrase": "PS-19 (Sequence verifiable units): Multi-step work is broken into units that each end in a checked state. The next unit does not start until the current unit is verified."
}
```

### pstack/PS-20

Check: [`pstack/principles/ps-20@1.0.0`](checks/principles/ps-20/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-20`. Minimum severity: `deny`.

PS-20 (Test behavior, not implementation): A test calls the code as its user does and asserts an observed value against a literal expectation.

Default parameters: `{"verifier":"PS-20"}`.

**Repair:** Bind PS-20 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-20; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:33; PS-20",
  "paraphrase": "PS-20 (Test behavior, not implementation): A test calls the code as its user does and asserts an observed value against a literal expectation."
}
```

### pstack/PS-21

Check: [`pstack/principles/ps-21@1.0.0`](checks/principles/ps-21/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-21`. Minimum severity: `deny`.

PS-21 (Guard the context window): Bulk evidence is routed to a subagent. The coordinating thread holds the summary, not the raw payload.

Default parameters: `{"verifier":"PS-21"}`.

**Repair:** Bind PS-21 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-21; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:36; PS-21",
  "paraphrase": "PS-21 (Guard the context window): Bulk evidence is routed to a subagent. The coordinating thread holds the summary, not the raw payload."
}
```

### pstack/PS-22

Check: [`pstack/principles/ps-22@1.0.0`](checks/principles/ps-22/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-22`. Minimum severity: `deny`.

PS-22 (Never block on the human): Reversible work proceeds and the result is presented. Confirmation is reserved for irreversible actions.

Default parameters: `{"verifier":"PS-22"}`.

**Repair:** Bind PS-22 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-22; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:37; PS-22",
  "paraphrase": "PS-22 (Never block on the human): Reversible work proceeds and the result is presented. Confirmation is reserved for irreversible actions."
}
```

### pstack/PS-23

Check: [`pstack/principles/ps-23@1.0.0`](checks/principles/ps-23/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-23`. Minimum severity: `deny`.

PS-23 (Encode lessons in structure): A lesson that has fired twice is encoded as a lint, a metadata flag, a runtime check, or a script. It is not left as additional prose.

Default parameters: `{"verifier":"PS-23"}`.

**Repair:** Bind PS-23 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-23; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:38; PS-23",
  "paraphrase": "PS-23 (Encode lessons in structure): A lesson that has fired twice is encoded as a lint, a metadata flag, a runtime check, or a script. It is not left as additional prose."
}
```

## pstack/proof

Manifest version: `1.0.0`. Status: **complete**.

### pstack/PS-WEAK-001

Check: [`pstack/tests/no-weak-matcher@1.0.0`](checks/tests/no-weak-matcher/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tests.weak-matcher`. Minimum severity: `none`.

Those matchers pass when the value is merely present or the function was merely called. A wrong total, a wrong argument, and undefined-returning fakes still go green.

Default parameters: `{}`.

**Repair:** Assert the literal the caller should observe, or toHaveBeenCalledWith the arguments that matter.

**Scope and limits:** toHaveBeenCalledWith is not this list. A bracket call such as expect(x)["toBeDefined"]() is a hole. The rule only sees test files.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "test behavior, not implementation",
  "paraphrase": "A test that would still pass when the code returns undefined is not asserting the behavior the caller observes. Assert a literal expected value."
}
```

### pstack/PS-EXPECT-001

Check: [`pstack/tests/test-has-assertion@1.0.0`](checks/tests/test-has-assertion/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tests.assertion-present`. Minimum severity: `none`.

A test that never asserts stays green when the behavior is wrong. Running a function is not a proof of what it returned.

Default parameters: `{}`.

**Repair:** Assert the value the caller observes, with expect(...) or assert.equal(...).

**Scope and limits:** it.each and test.skip are not exactly the names it and test, so they are holes. A local named expect that is never called does not count. Core's assertion ratchet covers a drop in assertion count across a diff; this rule covers a test that has none.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "prove it works",
  "paraphrase": "Before calling the work done, check the real result. A test that does not assert a value is a self-report that the function ran."
}
```

### pstack/PS-AAA-001

Check: [`pstack/tests/no-branch-in-test@1.0.0`](checks/tests/no-branch-in-test/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tests.branching-in-case`. Minimum severity: `none`.

When the test chooses the expected result based on the same condition as production code, it can mirror the bug instead of detecting it.

Default parameters: `{}`.

**Repair:** Split concrete cases and assert a literal result in each. Review intentional branches in property-based tests.

**Scope and limits:** Only if, switch, and ternary expressions inside direct test/it calls in test files are matched; helper control flow is out of scope.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariant Rules for the Software Engineer–Architect",
  "locator": "SE-84",
  "paraphrase": "A test case reads as a linear arrange, act, assert story without selecting a result through its own branches."
}
```

## pstack/reader-load

Manifest version: `1.0.1`. Status: **complete**.

### pstack/PS-LET-001

Check: [`pstack/state/no-module-let@1.0.0`](checks/state/no-module-let/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `state.module-let`. Minimum severity: `none`.

A module-level let is hidden state. A reader of one function cannot know who else writes it.

Default parameters: `{}`.

**Repair:** Move the binding inside the function that uses it, or make it const if it never changes.

**Scope and limits:** `const` at module scope is not this rule. `var` belongs to the senior pack. A `let` inside a function, including a for loop initializer, is local and allowed. Renaming the binding does not move it.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "minimize reader load",
  "paraphrase": "Hidden mutable state is a fact the reader has to keep in their head. Shrink that scope to the operation that actually changes the value."
}
```

### pstack/PS-COMMENT-001

Check: [`pstack/comments/no-narration@1.0.0`](checks/comments/no-narration/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `comments.narration`. Minimum severity: `none`.

A narration comment goes stale and splits the reader's attention. The code should carry the fact. An owned TODO is a tracked debt, not narration.

Default parameters: `{}`.

**Repair:** Delete the comment. If the debt is real, write TODO(owner) with an owner of at least two characters, matching the vibe-proof TODO rule.

**Scope and limits:** Allowlisted: TODO/FIXME/HACK/XXX(owner), @ts-expect-error, eslint-, biome-ignore, pregate-, istanbul, c8, SPDX-License-Identifier, Copyright, @license, and /// <reference. @ts-ignore and @ts-nocheck are not allowlisted. A fake owner satisfies the spelling; that is a social hole, not a structural one.

**Interactions when active together:**

- Duplicates `maintainability/MAINT-DEPR-001`: A bare @deprecated JSDoc tag is reported by both rules, and the written notice MAINT-DEPR-001 asks for is still a comment PS-COMMENT-001 denies. Settle: Migrating the callers and deleting the deprecated API satisfies both. Teams that keep deprecated surfaces exclude the files that carry them from PS-COMMENT-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "minimize reader load; ps-no-comments",
  "paraphrase": "Comments that restate the next line add a second text the reader must keep in sync. The workflow that deletes them is a process; this rule is the comment shapes that process can refuse."
}
```

### pstack/PS-COMMENTED-001

Check: [`pstack/comments/no-commented-code@1.0.0`](checks/comments/no-commented-code/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `comments.dead-code`. Minimum severity: `none`.

Commented-out code is a second implementation. Readers do not know whether it is the old behavior, a sample, or the one that should run.

Default parameters: `{}`.

**Repair:** Delete the comment. History already keeps the old statement.

**Scope and limits:** A TODO(owner) or FIXME(owner) that mentions return is not this shape, because the comment does not start with the keyword. A comment that starts with a keyword and also carries an owner is exempt so it does not fight the owned-TODO allowlist.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "pstack principles (boundary, domain, reader load, idempotency, legacy deletion, proof)",
  "locator": "subtract before you add",
  "paraphrase": "Remove the dead statement before adding the new one. A comment that keeps the old statement around is the dead code, still in the file."
}
```

## pstack/workspace

Manifest version: `1.0.0`. Status: **preview**.

### pstack/PS-71-74

Check: [`pstack/workspace/ps-71-74@1.0.0`](checks/workspace/ps-71-74/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-71-74`. Minimum severity: `deny`.

Scale-stack framework: Stack decisions record ownership, control plane, edge; self-service is default; immutable delivery; not applied to tiny MVPs.

Default parameters: `{"verifier":"PS-71-74"}`.

**Repair:** Bind PS-71-74 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-71-74; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-71, PS-72, PS-73, PS-74 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:101; PS-71, PS-72, PS-73, PS-74",
  "paraphrase": "Scale-stack framework: Stack decisions record ownership, control plane, edge; self-service is default; immutable delivery; not applied to tiny MVPs."
}
```

### pstack/PS-75-76

Check: [`pstack/workspace/ps-75-76@1.0.0`](checks/workspace/ps-75-76/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-75-76`. Minimum severity: `deny`.

Grok god mode: Tools and first-principles over bulk prose; claims cite observations.

Default parameters: `{"verifier":"PS-75-76"}`.

**Repair:** Bind PS-75-76 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-75-76; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-75, PS-76 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:102; PS-75, PS-76",
  "paraphrase": "Grok god mode: Tools and first-principles over bulk prose; claims cite observations."
}
```

### pstack/PS-77-80

Check: [`pstack/workspace/ps-77-80@1.0.0`](checks/workspace/ps-77-80/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-77-80`. Minimum severity: `deny`.

Musk algorithm builder: Deletion before optimization; question requirements; critical path visible daily; named responsible ownership.

Default parameters: `{"verifier":"PS-77-80"}`.

**Repair:** Bind PS-77-80 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-77-80; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-77, PS-78, PS-79, PS-80 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:103; PS-77, PS-78, PS-79, PS-80",
  "paraphrase": "Musk algorithm builder: Deletion before optimization; question requirements; critical path visible daily; named responsible ownership."
}
```

### pstack/PS-81-83

Check: [`pstack/workspace/ps-81-83@1.0.0`](checks/workspace/ps-81-83/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-81-83`. Minimum severity: `deny`.

Webapp from first principles: Phases advance only when gates are met; final artifact is implementation doc; open questions asked until answered.

Default parameters: `{"verifier":"PS-81-83"}`.

**Repair:** Bind PS-81-83 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-81-83; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-81, PS-82, PS-83 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:104; PS-81, PS-82, PS-83",
  "paraphrase": "Webapp from first principles: Phases advance only when gates are met; final artifact is implementation doc; open questions asked until answered."
}
```

### pstack/PS-84-86

Check: [`pstack/workspace/ps-84-86@1.0.0`](checks/workspace/ps-84-86/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-84-86`. Minimum severity: `deny`.

Learn-anything coach: User language; retrieval and proof-of-learning gates; live performance required.

Default parameters: `{"verifier":"PS-84-86"}`.

**Repair:** Bind PS-84-86 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-84-86; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-84, PS-85, PS-86 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:105; PS-84, PS-85, PS-86",
  "paraphrase": "Learn-anything coach: User language; retrieval and proof-of-learning gates; live performance required."
}
```

### pstack/PS-87-89

Check: [`pstack/workspace/ps-87-89@1.0.0`](checks/workspace/ps-87-89/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-87-89`. Minimum severity: `deny`.

Universal quoter: Pricing derived from load, scope, value, not raw guesswork; opportunity cost included; options presented.

Default parameters: `{"verifier":"PS-87-89"}`.

**Repair:** Bind PS-87-89 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-87-89; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-87, PS-88, PS-89 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:106; PS-87, PS-88, PS-89",
  "paraphrase": "Universal quoter: Pricing derived from load, scope, value, not raw guesswork; opportunity cost included; options presented."
}
```

### pstack/PS-90-91

Check: [`pstack/workspace/ps-90-91@1.0.0`](checks/workspace/ps-90-91/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-90-91`. Minimum severity: `deny`.

Hour estimator: Parkinson, Hofstadter, Murphy, Pareto applied explicitly; separate 20% driver from buffer.

Default parameters: `{"verifier":"PS-90-91"}`.

**Repair:** Bind PS-90-91 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-90-91; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-90, PS-91 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:107; PS-90, PS-91",
  "paraphrase": "Hour estimator: Parkinson, Hofstadter, Murphy, Pareto applied explicitly; separate 20% driver from buffer."
}
```

### pstack/PS-92-94

Check: [`pstack/workspace/ps-92-94@1.0.0`](checks/workspace/ps-92-94/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-92-94`. Minimum severity: `deny`.

Browser-game prototype: Single-file HTML5 canvas; keyboard/touch loop; seven-step process followed.

Default parameters: `{"verifier":"PS-92-94"}`.

**Repair:** Bind PS-92-94 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-92-94; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-92, PS-93, PS-94 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:108; PS-92, PS-93, PS-94",
  "paraphrase": "Browser-game prototype: Single-file HTML5 canvas; keyboard/touch loop; seven-step process followed."
}
```

### pstack/PS-95-96

Check: [`pstack/workspace/ps-95-96@1.0.0`](checks/workspace/ps-95-96/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-95-96`. Minimum severity: `deny`.

Mega webapp generator: One-sentence idea yields complete architecture; `ELEMENTOS_CLAVE.md` included.

Default parameters: `{"verifier":"PS-95-96"}`.

**Repair:** Bind PS-95-96 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-95-96; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-95, PS-96 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:109; PS-95, PS-96",
  "paraphrase": "Mega webapp generator: One-sentence idea yields complete architecture; `ELEMENTOS_CLAVE.md` included."
}
```

### pstack/PS-97-99

Check: [`pstack/workspace/ps-97-99@1.0.0`](checks/workspace/ps-97-99/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-97-99`. Minimum severity: `deny`.

Use-case modeling: Actors, goals, success scenario before extensions; functional requirements traceable; exception flows explicit.

Default parameters: `{"verifier":"PS-97-99"}`.

**Repair:** Bind PS-97-99 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-97-99; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-97, PS-98, PS-99 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:110; PS-97, PS-98, PS-99",
  "paraphrase": "Use-case modeling: Actors, goals, success scenario before extensions; functional requirements traceable; exception flows explicit."
}
```

### pstack/PS-100-103

Check: [`pstack/workspace/ps-100-103@1.0.0`](checks/workspace/ps-100-103/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-100-103`. Minimum severity: `deny`.

Winston / epic talk: Empowerment promise opener; 3 cycles per major idea; slides minimal; close returns to promise.

Default parameters: `{"verifier":"PS-100-103"}`.

**Repair:** Bind PS-100-103 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-100-103; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-100, PS-101, PS-102, PS-103 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:111; PS-100, PS-101, PS-102, PS-103",
  "paraphrase": "Winston / epic talk: Empowerment promise opener; 3 cycles per major idea; slides minimal; close returns to promise."
}
```

### pstack/PS-104-105

Check: [`pstack/workspace/ps-104-105@1.0.0`](checks/workspace/ps-104-105/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-104-105`. Minimum severity: `deny`.

Gmail importance triage: Ordered by urgency/importance with signals; no full unprioritized dump.

Default parameters: `{"verifier":"PS-104-105"}`.

**Repair:** Bind PS-104-105 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-104-105; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-104, PS-105 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:112; PS-104, PS-105",
  "paraphrase": "Gmail importance triage: Ordered by urgency/importance with signals; no full unprioritized dump."
}
```

### pstack/PS-106-107

Check: [`pstack/workspace/ps-106-107@1.0.0`](checks/workspace/ps-106-107/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-106-107`. Minimum severity: `deny`.

Gmail summarizer: Read under label; summary precedes permanent deletion.

Default parameters: `{"verifier":"PS-106-107"}`.

**Repair:** Bind PS-106-107 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-106-107; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-106, PS-107 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:113; PS-106, PS-107",
  "paraphrase": "Gmail summarizer: Read under label; summary precedes permanent deletion."
}
```

### pstack/PS-108-109

Check: [`pstack/workspace/ps-108-109@1.0.0`](checks/workspace/ps-108-109/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-108-109`. Minimum severity: `deny`.

Calendar reviewer: Inspects every calendar; report overlaps; clear calendar explicitly reported.

Default parameters: `{"verifier":"PS-108-109"}`.

**Repair:** Bind PS-108-109 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-108-109; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-108, PS-109 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:114; PS-108, PS-109",
  "paraphrase": "Calendar reviewer: Inspects every calendar; report overlaps; clear calendar explicitly reported."
}
```

### pstack/PS-110-111

Check: [`pstack/workspace/ps-110-111@1.0.0`](checks/workspace/ps-110-111/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-110-111`. Minimum severity: `deny`.

Daily AI news: Deduplicated against prior days; readable chat summary.

Default parameters: `{"verifier":"PS-110-111"}`.

**Repair:** Bind PS-110-111 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-110-111; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-110, PS-111 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:115; PS-110, PS-111",
  "paraphrase": "Daily AI news: Deduplicated against prior days; readable chat summary."
}
```

### pstack/PS-112-113

Check: [`pstack/workspace/ps-112-113@1.0.0`](checks/workspace/ps-112-113/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `pstack.ps-112-113`. Minimum severity: `deny`.

Cloudflared tunnel: Tunnel duration bounded; credentials never written to chat transcript.

Default parameters: `{"verifier":"PS-112-113"}`.

**Repair:** Bind PS-112-113 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run PS-112-113; repair failed evidence or propose a bounded adaptation that preserves the requirement.

**Scope and limits:** This is a project evidence obligation, not a universal syntax detector or semantic certification. A receipt proves only the reviewed assertion ran on current inputs. Missing proof stays unverified; an adopted assertion with failed or stale proof blocks enforcing checks. Conditional workflow rules need explicit applicability and observed task evidence; selecting a rule does not run a skill or authorize an action. The source groups PS-112, PS-113 in one clause; one assertion must cover the complete group, not one selected sentence. Existing syntax references are partial controls, not proof of this full statement. Fixtures test receipt admission, not the project's semantics. Packs provide no executable commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-requested pstack and installed-workflow invariant catalog",
  "locator": "packs/pstack/INVARIANTS.md:116; PS-112, PS-113",
  "paraphrase": "Cloudflared tunnel: Tunnel duration bounded; credentials never written to chat transcript."
}
```
