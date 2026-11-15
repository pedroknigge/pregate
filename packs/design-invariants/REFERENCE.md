# design-invariants pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **invariants**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## design-invariants/architecture

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-016

Check: [`design-invariants/architecture/requirement-016@1.0.0`](checks/architecture/requirement-016/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r016`. Minimum severity: `deny`.

Major components have no circular source dependency.

Default parameters: `{"verifier":"DESIGN-016"}`.

**Repair:** Bind DESIGN-016 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-016; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 16",
  "paraphrase": "Major components have no circular source dependency."
}
```

### design-invariants/DESIGN-017

Check: [`design-invariants/architecture/requirement-017@1.0.0`](checks/architecture/requirement-017/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r017`. Minimum severity: `deny`.

A decision that draws a component boundary records the team boundary it mirrors, or the reason it does not.

Default parameters: `{"verifier":"DESIGN-017"}`.

**Repair:** Bind DESIGN-017 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-017; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 17",
  "paraphrase": "A decision that draws a component boundary records the team boundary it mirrors, or the reason it does not."
}
```

### design-invariants/DESIGN-018

Check: [`design-invariants/architecture/requirement-018@1.0.0`](checks/architecture/requirement-018/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r018`. Minimum severity: `deny`.

The architecture records the quality attributes it prioritizes. A change that trades one of them off names that trade.

Default parameters: `{"verifier":"DESIGN-018"}`.

**Repair:** Bind DESIGN-018 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-018; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 18",
  "paraphrase": "The architecture records the quality attributes it prioritizes. A change that trades one of them off names that trade."
}
```

## design-invariants/code-quality

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-024

Check: [`design-invariants/code-quality/requirement-024@1.0.0`](checks/code-quality/requirement-024/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r024`. Minimum severity: `deny`.

Each function stays within the size bound the project has reviewed. The supplied expectation is that a function fits on one screen. This gate is that reviewed bound, not a universal line limit.

Default parameters: `{"verifier":"DESIGN-024"}`.

**Repair:** Bind DESIGN-024 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-024; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 24",
  "paraphrase": "Each function stays within the size bound the project has reviewed. The supplied expectation is that a function fits on one screen. This gate is that reviewed bound, not a universal line limit."
}
```

### design-invariants/DESIGN-025

Check: [`design-invariants/code-quality/requirement-025@1.0.0`](checks/code-quality/requirement-025/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r025`. Minimum severity: `deny`.

Each function stays within the reviewed parameter budget. The supplied expectation is at most two parameters and no boolean flag whose only job is to select behavior.

Default parameters: `{"verifier":"DESIGN-025"}`.

**Repair:** Bind DESIGN-025 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-025; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 25",
  "paraphrase": "Each function stays within the reviewed parameter budget. The supplied expectation is at most two parameters and no boolean flag whose only job is to select behavior."
}
```

### design-invariants/DESIGN-026

Check: [`design-invariants/code-quality/requirement-026@1.0.0`](checks/code-quality/requirement-026/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r026`. Minimum severity: `deny`.

A unit reads from the general statement down to the detail, and that detail is a named unit below it.

Default parameters: `{"verifier":"DESIGN-026"}`.

**Repair:** Bind DESIGN-026 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-026; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 26",
  "paraphrase": "A unit reads from the general statement down to the detail, and that detail is a named unit below it."
}
```

### design-invariants/DESIGN-027

Check: [`design-invariants/code-quality/requirement-027@1.0.0`](checks/code-quality/requirement-027/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r027`. Minimum severity: `deny`.

A name is declared in the smallest scope that uses it.

Default parameters: `{"verifier":"DESIGN-027"}`.

**Repair:** Bind DESIGN-027 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-027; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 27",
  "paraphrase": "A name is declared in the smallest scope that uses it."
}
```

### design-invariants/DESIGN-028

Check: [`design-invariants/code-quality/requirement-028@1.0.0`](checks/code-quality/requirement-028/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r028`. Minimum severity: `deny`.

A variable has a value before any read.

Default parameters: `{"verifier":"DESIGN-028"}`.

**Repair:** Bind DESIGN-028 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-028; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 28",
  "paraphrase": "A variable has a value before any read."
}
```

### design-invariants/DESIGN-029

Check: [`design-invariants/code-quality/requirement-029@1.0.0`](checks/code-quality/requirement-029/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r029`. Minimum severity: `deny`.

A binding that is not assigned again is constant or immutable.

Default parameters: `{"verifier":"DESIGN-029"}`.

**Repair:** Bind DESIGN-029 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-029; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 29",
  "paraphrase": "A binding that is not assigned again is constant or immutable."
}
```

## design-invariants/design-principles

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-001

Check: [`design-invariants/design-principles/requirement-001@1.0.0`](checks/design-principles/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r001`. Minimum severity: `deny`.

When a real new variant arrives, add it by extension. Do not rewrite the existing variant's behavior to make room for it, and do not add the extension point before that variant exists.

Default parameters: `{"verifier":"DESIGN-001"}`.

**Repair:** Bind DESIGN-001 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-001; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 1",
  "paraphrase": "When a real new variant arrives, add it by extension. Do not rewrite the existing variant's behavior to make room for it, and do not add the extension point before that variant exists."
}
```

### design-invariants/DESIGN-002

Check: [`design-invariants/design-principles/requirement-002@1.0.0`](checks/design-principles/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r002`. Minimum severity: `deny`.

A subtype can stand in for its base type for every caller of the base contract without changing the outcome that contract promises.

Default parameters: `{"verifier":"DESIGN-002"}`.

**Repair:** Bind DESIGN-002 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-002; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 2",
  "paraphrase": "A subtype can stand in for its base type for every caller of the base contract without changing the outcome that contract promises."
}
```

### design-invariants/DESIGN-003

Check: [`design-invariants/design-principles/requirement-003@1.0.0`](checks/design-principles/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r003`. Minimum severity: `deny`.

A change leaves the code it already edits cleaner than it found it, and does not open an unrelated cleanup.

Default parameters: `{"verifier":"DESIGN-003"}`.

**Repair:** Bind DESIGN-003 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-003; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 3",
  "paraphrase": "A change leaves the code it already edits cleaner than it found it, and does not open an unrelated cleanup."
}
```

### design-invariants/DESIGN-004

Check: [`design-invariants/design-principles/requirement-004@1.0.0`](checks/design-principles/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r004`. Minimum severity: `deny`.

A performance change targets a bottleneck a measurement has shown.

Default parameters: `{"verifier":"DESIGN-004"}`.

**Repair:** Bind DESIGN-004 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-004; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 4",
  "paraphrase": "A performance change targets a bottleneck a measurement has shown."
}
```

## design-invariants/domain-state

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-019

Check: [`design-invariants/domain-state/requirement-019@1.0.0`](checks/domain-state/requirement-019/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r019`. Minimum severity: `deny`.

Code outside an aggregate reads and changes that aggregate's internal entities only through the aggregate root.

Default parameters: `{"verifier":"DESIGN-019"}`.

**Repair:** Bind DESIGN-019 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-019; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 19",
  "paraphrase": "Code outside an aggregate reads and changes that aggregate's internal entities only through the aggregate root."
}
```

### design-invariants/DESIGN-020

Check: [`design-invariants/domain-state/requirement-020@1.0.0`](checks/domain-state/requirement-020/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r020`. Minimum severity: `deny`.

Where a loop's correctness depends on a stated property, that property holds at the start and at the end of each iteration.

Default parameters: `{"verifier":"DESIGN-020"}`.

**Repair:** Bind DESIGN-020 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-020; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 20",
  "paraphrase": "Where a loop's correctness depends on a stated property, that property holds at the start and at the end of each iteration."
}
```

### design-invariants/DESIGN-021

Check: [`design-invariants/domain-state/requirement-021@1.0.0`](checks/domain-state/requirement-021/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r021`. Minimum severity: `deny`.

A cache, index, or other derived structure matches the source it represents after every update the product claims is consistent.

Default parameters: `{"verifier":"DESIGN-021"}`.

**Repair:** Bind DESIGN-021 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-021; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 21",
  "paraphrase": "A cache, index, or other derived structure matches the source it represents after every update the product claims is consistent."
}
```

### design-invariants/DESIGN-022

Check: [`design-invariants/domain-state/requirement-022@1.0.0`](checks/domain-state/requirement-022/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r022`. Minimum severity: `deny`.

A local value that no requirement changes is immutable. Shared data that crosses a thread, process, or time boundary remains CORE-INV-015.

Default parameters: `{"verifier":"DESIGN-022"}`.

**Repair:** Bind DESIGN-022 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-022; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 22",
  "paraphrase": "A local value that no requirement changes is immutable. Shared data that crosses a thread, process, or time boundary remains CORE-INV-015."
}
```

### design-invariants/DESIGN-023

Check: [`design-invariants/domain-state/requirement-023@1.0.0`](checks/domain-state/requirement-023/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r023`. Minimum severity: `deny`.

When the product requires audit or rebuild, it records the events that produced the current state, and that state can be rebuilt from those events.

Default parameters: `{"verifier":"DESIGN-023"}`.

**Repair:** Bind DESIGN-023 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-023; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 23",
  "paraphrase": "When the product requires audit or rebuild, it records the events that produced the current state, and that state can be rebuilt from those events."
}
```

## design-invariants/error-handling

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-030

Check: [`design-invariants/error-handling/requirement-030@1.0.0`](checks/error-handling/requirement-030/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r030`. Minimum severity: `deny`.

A returned error or result is checked, or the choice to ignore it is explicit.

Default parameters: `{"verifier":"DESIGN-030"}`.

**Repair:** Bind DESIGN-030 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-030; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 30",
  "paraphrase": "A returned error or result is checked, or the choice to ignore it is explicit."
}
```

### design-invariants/DESIGN-031

Check: [`design-invariants/error-handling/requirement-031@1.0.0`](checks/error-handling/requirement-031/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r031`. Minimum severity: `deny`.

A fault that the language's type system can express is rejected at compile time.

Default parameters: `{"verifier":"DESIGN-031"}`.

**Repair:** Bind DESIGN-031 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-031; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 31",
  "paraphrase": "A fault that the language's type system can express is rejected at compile time."
}
```

### design-invariants/DESIGN-032

Check: [`design-invariants/error-handling/requirement-032@1.0.0`](checks/error-handling/requirement-032/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r032`. Minimum severity: `deny`.

An operation that can fail shows that failure in its type or in its control flow.

Default parameters: `{"verifier":"DESIGN-032"}`.

**Repair:** Bind DESIGN-032 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-032; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 32",
  "paraphrase": "An operation that can fail shows that failure in its type or in its control flow."
}
```

### design-invariants/DESIGN-033

Check: [`design-invariants/error-handling/requirement-033@1.0.0`](checks/error-handling/requirement-033/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r033`. Minimum severity: `deny`.

A resource is released on every path that acquires it, including a failure path.

Default parameters: `{"verifier":"DESIGN-033"}`.

**Repair:** Bind DESIGN-033 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-033; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 33",
  "paraphrase": "A resource is released on every path that acquires it, including a failure path."
}
```

## design-invariants/package-principles

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-005

Check: [`design-invariants/package-principles/requirement-005@1.0.0`](checks/package-principles/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r005`. Minimum severity: `deny`.

A reused package is released as one unit. Callers depend on that release, not on unpublished internals of a subset.

Default parameters: `{"verifier":"DESIGN-005"}`.

**Repair:** Bind DESIGN-005 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-005; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 5",
  "paraphrase": "A reused package is released as one unit. Callers depend on that release, not on unpublished internals of a subset."
}
```

### design-invariants/DESIGN-006

Check: [`design-invariants/package-principles/requirement-006@1.0.0`](checks/package-principles/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r006`. Minimum severity: `deny`.

Types that change for the same reason live in the same package.

Default parameters: `{"verifier":"DESIGN-006"}`.

**Repair:** Bind DESIGN-006 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-006; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 6",
  "paraphrase": "Types that change for the same reason live in the same package."
}
```

### design-invariants/DESIGN-007

Check: [`design-invariants/package-principles/requirement-007@1.0.0`](checks/package-principles/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r007`. Minimum severity: `deny`.

Types that callers use together live in the same package. Depending on the package does not force a caller to take types it does not use.

Default parameters: `{"verifier":"DESIGN-007"}`.

**Repair:** Bind DESIGN-007 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-007; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 7",
  "paraphrase": "Types that callers use together live in the same package. Depending on the package does not force a caller to take types it does not use."
}
```

### design-invariants/DESIGN-008

Check: [`design-invariants/package-principles/requirement-008@1.0.0`](checks/package-principles/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r008`. Minimum severity: `deny`.

The dependency graph among packages has no cycle.

Default parameters: `{"verifier":"DESIGN-008"}`.

**Repair:** Bind DESIGN-008 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-008; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 8",
  "paraphrase": "The dependency graph among packages has no cycle."
}
```

### design-invariants/DESIGN-009

Check: [`design-invariants/package-principles/requirement-009@1.0.0`](checks/package-principles/requirement-009/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r009`. Minimum severity: `deny`.

A package that others depend on for stability is more abstract than the packages that depend on it.

Default parameters: `{"verifier":"DESIGN-009"}`.

**Repair:** Bind DESIGN-009 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-009; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 9",
  "paraphrase": "A package that others depend on for stability is more abstract than the packages that depend on it."
}
```

### design-invariants/DESIGN-010

Check: [`design-invariants/package-principles/requirement-010@1.0.0`](checks/package-principles/requirement-010/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r010`. Minimum severity: `deny`.

A responsibility belongs to the type that already holds the information the responsibility needs.

Default parameters: `{"verifier":"DESIGN-010"}`.

**Repair:** Bind DESIGN-010 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-010; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 10",
  "paraphrase": "A responsibility belongs to the type that already holds the information the responsibility needs."
}
```

### design-invariants/DESIGN-011

Check: [`design-invariants/package-principles/requirement-011@1.0.0`](checks/package-principles/requirement-011/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r011`. Minimum severity: `deny`.

An object is created by a type that contains it, records it, or closely uses it.

Default parameters: `{"verifier":"DESIGN-011"}`.

**Repair:** Bind DESIGN-011 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-011; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 11",
  "paraphrase": "An object is created by a type that contains it, records it, or closely uses it."
}
```

### design-invariants/DESIGN-012

Check: [`design-invariants/package-principles/requirement-012@1.0.0`](checks/package-principles/requirement-012/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r012`. Minimum severity: `deny`.

A system event is handled by a controller that represents the use case or the system, not by a user-interface or persistence type.

Default parameters: `{"verifier":"DESIGN-012"}`.

**Repair:** Bind DESIGN-012 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-012; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 12",
  "paraphrase": "A system event is handled by a controller that represents the use case or the system, not by a user-interface or persistence type."
}
```

### design-invariants/DESIGN-013

Check: [`design-invariants/package-principles/requirement-013@1.0.0`](checks/package-principles/requirement-013/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r013`. Minimum severity: `deny`.

A type that is not a domain concept exists only when that type is what keeps cohesion high and coupling low.

Default parameters: `{"verifier":"DESIGN-013"}`.

**Repair:** Bind DESIGN-013 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-013; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 13",
  "paraphrase": "A type that is not a domain concept exists only when that type is what keeps cohesion high and coupling low."
}
```

### design-invariants/DESIGN-014

Check: [`design-invariants/package-principles/requirement-014@1.0.0`](checks/package-principles/requirement-014/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r014`. Minimum severity: `deny`.

An intermediate object exists only where it reduces a real coupling.

Default parameters: `{"verifier":"DESIGN-014"}`.

**Repair:** Bind DESIGN-014 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-014; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 14",
  "paraphrase": "An intermediate object exists only where it reduces a real coupling."
}
```

### design-invariants/DESIGN-015

Check: [`design-invariants/package-principles/requirement-015@1.0.0`](checks/package-principles/requirement-015/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r015`. Minimum severity: `deny`.

Where the set of alternatives is open, callers select among types by a polymorphic operation. A closed set may use an explicit exhaustive branch.

Default parameters: `{"verifier":"DESIGN-015"}`.

**Repair:** Bind DESIGN-015 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-015; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 15",
  "paraphrase": "Where the set of alternatives is open, callers select among types by a polymorphic operation. A closed set may use an explicit exhaustive branch."
}
```

## design-invariants/performance-and-data

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-044

Check: [`design-invariants/performance-and-data/requirement-044@1.0.0`](checks/performance-and-data/requirement-044/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r044`. Minimum severity: `deny`.

The structure used on a hot access path matches that path's dominant reads and writes.

Default parameters: `{"verifier":"DESIGN-044"}`.

**Repair:** Bind DESIGN-044 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-044; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 44",
  "paraphrase": "The structure used on a hot access path matches that path's dominant reads and writes."
}
```

## design-invariants/process

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-045

Check: [`design-invariants/process/requirement-045@1.0.0`](checks/process/requirement-045/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r045`. Minimum severity: `deny`.

A build, test, or formatting step that can run unattended does run unattended. Deployment automation remains CORE-INV-059.

Default parameters: `{"verifier":"DESIGN-045"}`.

**Repair:** Bind DESIGN-045 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-045; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 45",
  "paraphrase": "A build, test, or formatting step that can run unattended does run unattended. Deployment automation remains CORE-INV-059."
}
```

### design-invariants/DESIGN-046

Check: [`design-invariants/process/requirement-046@1.0.0`](checks/process/requirement-046/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r046`. Minimum severity: `deny`.

A product assumption is checked against real use before the work is treated as complete.

Default parameters: `{"verifier":"DESIGN-046"}`.

**Repair:** Bind DESIGN-046 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-046; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 46",
  "paraphrase": "A product assumption is checked against real use before the work is treated as complete."
}
```

### design-invariants/DESIGN-047

Check: [`design-invariants/process/requirement-047@1.0.0`](checks/process/requirement-047/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r047`. Minimum severity: `deny`.

A debugging or refactoring session changes one cause at a time, and the result of that change is known before the next change.

Default parameters: `{"verifier":"DESIGN-047"}`.

**Repair:** Bind DESIGN-047 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-047; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 47",
  "paraphrase": "A debugging or refactoring session changes one cause at a time, and the result of that change is known before the next change."
}
```

### design-invariants/DESIGN-048

Check: [`design-invariants/process/requirement-048@1.0.0`](checks/process/requirement-048/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r048`. Minimum severity: `deny`.

A change is reviewed by someone other than its author before it is integrated, or the project records an explicit exception for that change.

Default parameters: `{"verifier":"DESIGN-048"}`.

**Repair:** Bind DESIGN-048 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-048; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 48",
  "paraphrase": "A change is reviewed by someone other than its author before it is integrated, or the project records an explicit exception for that change."
}
```

## design-invariants/security

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-034

Check: [`design-invariants/security/requirement-034@1.0.0`](checks/security/requirement-034/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r034`. Minimum severity: `deny`.

A security-sensitive action is checked by more than one independent control.

Default parameters: `{"verifier":"DESIGN-034"}`.

**Repair:** Bind DESIGN-034 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-034; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 34",
  "paraphrase": "A security-sensitive action is checked by more than one independent control."
}
```

### design-invariants/DESIGN-035

Check: [`design-invariants/security/requirement-035@1.0.0`](checks/security/requirement-035/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r035`. Minimum severity: `deny`.

Sensitive data is encrypted at rest and in transit.

Default parameters: `{"verifier":"DESIGN-035"}`.

**Repair:** Bind DESIGN-035 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-035; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 35",
  "paraphrase": "Sensitive data is encrypted at rest and in transit."
}
```

### design-invariants/DESIGN-036

Check: [`design-invariants/security/requirement-036@1.0.0`](checks/security/requirement-036/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r036`. Minimum severity: `deny`.

A secret is rotated on a reviewed schedule. Keeping the secret out of code and logs remains CORE-INV-040.

Default parameters: `{"verifier":"DESIGN-036"}`.

**Repair:** Bind DESIGN-036 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-036; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 36",
  "paraphrase": "A secret is rotated on a reviewed schedule. Keeping the secret out of code and logs remains CORE-INV-040."
}
```

### design-invariants/DESIGN-037

Check: [`design-invariants/security/requirement-037@1.0.0`](checks/security/requirement-037/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r037`. Minimum severity: `deny`.

The configuration that applies when the operator sets nothing is the secure configuration.

Default parameters: `{"verifier":"DESIGN-037"}`.

**Repair:** Bind DESIGN-037 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-037; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 37",
  "paraphrase": "The configuration that applies when the operator sets nothing is the secure configuration."
}
```

## design-invariants/testing

Manifest version: `1.0.0`. Status: **preview**.

### design-invariants/DESIGN-038

Check: [`design-invariants/testing/requirement-038@1.0.0`](checks/testing/requirement-038/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r038`. Minimum severity: `deny`.

The project has automated unit tests and integration tests, and an end-to-end test where smaller tests cannot see the behavior.

Default parameters: `{"verifier":"DESIGN-038"}`.

**Repair:** Bind DESIGN-038 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-038; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 38",
  "paraphrase": "The project has automated unit tests and integration tests, and an end-to-end test where smaller tests cannot see the behavior."
}
```

### design-invariants/DESIGN-039

Check: [`design-invariants/testing/requirement-039@1.0.0`](checks/testing/requirement-039/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r039`. Minimum severity: `deny`.

An automated test is fast, isolated, and repeatable. It does not depend on order, another test's clock, or a shared mutable fixture it does not own.

Default parameters: `{"verifier":"DESIGN-039"}`.

**Repair:** Bind DESIGN-039 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-039; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 39",
  "paraphrase": "An automated test is fast, isolated, and repeatable. It does not depend on order, another test's clock, or a shared mutable fixture it does not own."
}
```

### design-invariants/DESIGN-040

Check: [`design-invariants/testing/requirement-040@1.0.0`](checks/testing/requirement-040/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r040`. Minimum severity: `deny`.

A unit test separates arrange, act, and assert.

Default parameters: `{"verifier":"DESIGN-040"}`.

**Repair:** Bind DESIGN-040 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-040; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 40",
  "paraphrase": "A unit test separates arrange, act, and assert."
}
```

### design-invariants/DESIGN-041

Check: [`design-invariants/testing/requirement-041@1.0.0`](checks/testing/requirement-041/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r041`. Minimum severity: `deny`.

Where the team uses test-first for a change, a failing test exists before the production change that makes it pass.

Default parameters: `{"verifier":"DESIGN-041"}`.

**Repair:** Bind DESIGN-041 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-041; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 41",
  "paraphrase": "Where the team uses test-first for a change, a failing test exists before the production change that makes it pass."
}
```

### design-invariants/DESIGN-042

Check: [`design-invariants/testing/requirement-042@1.0.0`](checks/testing/requirement-042/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r042`. Minimum severity: `deny`.

A complex invariant the project selects for generative testing has a property test that fails on a violating input.

Default parameters: `{"verifier":"DESIGN-042"}`.

**Repair:** Bind DESIGN-042 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-042; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 42",
  "paraphrase": "A complex invariant the project selects for generative testing has a property test that fails on a violating input."
}
```

### design-invariants/DESIGN-043

Check: [`design-invariants/testing/requirement-043@1.0.0`](checks/testing/requirement-043/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `design-invariants.r043`. Minimum severity: `deny`.

The main branch's continuous integration is green for the checks the project requires.

Default parameters: `{"verifier":"DESIGN-043"}`.

**Repair:** Bind DESIGN-043 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run DESIGN-043; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

**Scope and limits:** This is a project evidence gate, not a syntax detector or readiness certification. A receipt proves only the reviewed assertion ran on the current inputs. External legal, certification, deployment and performance evidence needs its own authenticity, scope and freshness checks inside that assertion. Missing evidence remains unverified. Pack fixtures test receipt admission, not the product requirement. Packs never supply executable commands.

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
  "work": "User-supplied software design invariants",
  "locator": "docs/features/design-invariants-pack.md, rule 43",
  "paraphrase": "The main branch's continuous integration is green for the checks the project requires."
}
```
