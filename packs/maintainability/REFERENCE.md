# maintainability pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **practice**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## maintainability/engineering

Manifest version: `1.0.0`. Status: **preview**.

### maintainability/SE-01

Check: [`maintainability/engineering/se-01@1.0.0`](checks/engineering/se-01/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-01`. Minimum severity: `deny`.

Every line of code exists to satisfy a verifiable problem; code with no associated problem is not written.

Default parameters: `{"verifier":"SE-01"}`.

**Repair:** Bind SE-01 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-01; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:138; SE-01",
  "paraphrase": "Every line of code exists to satisfy a verifiable problem; code with no associated problem is not written."
}
```

### maintainability/SE-02

Check: [`maintainability/engineering/se-02@1.0.0`](checks/engineering/se-02/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-02`. Minimum severity: `deny`.

Every fragment of code is intelligible to an engineer who did not author it, without reconstruction of the author's mental context.

Default parameters: `{"verifier":"SE-02"}`.

**Repair:** Bind SE-02 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-02; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:139; SE-02",
  "paraphrase": "Every fragment of code is intelligible to an engineer who did not author it, without reconstruction of the author's mental context."
}
```

### maintainability/SE-03

Check: [`maintainability/engineering/se-03@1.0.0`](checks/engineering/se-03/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-03`. Minimum severity: `deny`.

Every non-obvious design decision has a recorded trade-off (ADR) stating context and the rejected alternative.

Default parameters: `{"verifier":"SE-03"}`.

**Repair:** Bind SE-03 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-03; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:140; SE-03",
  "paraphrase": "Every non-obvious design decision has a recorded trade-off (ADR) stating context and the rejected alternative."
}
```

### maintainability/SE-04

Check: [`maintainability/engineering/se-04@1.0.0`](checks/engineering/se-04/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-04`. Minimum severity: `deny`.

No line of code exists without a justification of value; dead code is deleted.

Default parameters: `{"verifier":"SE-04"}`.

**Repair:** Bind SE-04 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-04; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:141; SE-04",
  "paraphrase": "No line of code exists without a justification of value; dead code is deleted."
}
```

### maintainability/SE-05

Check: [`maintainability/engineering/se-05@1.0.0`](checks/engineering/se-05/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-05`. Minimum severity: `deny`.

Every third-party dependency is declared, isolated, audited, and replaceable.

Default parameters: `{"verifier":"SE-05"}`.

**Repair:** Bind SE-05 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-05; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:142; SE-05",
  "paraphrase": "Every third-party dependency is declared, isolated, audited, and replaceable."
}
```

### maintainability/SE-06

Check: [`maintainability/engineering/se-06@1.0.0`](checks/engineering/se-06/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-06`. Minimum severity: `deny`.

No known design or code defect remains without an owner and a correction plan.

Default parameters: `{"verifier":"SE-06"}`.

**Repair:** Bind SE-06 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-06; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:143; SE-06",
  "paraphrase": "No known design or code defect remains without an owner and a correction plan."
}
```

### maintainability/SE-07

Check: [`maintainability/engineering/se-07@1.0.0`](checks/engineering/se-07/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-07`. Minimum severity: `deny`.

The adopted solution is the simplest one that satisfies the current requirement.

Default parameters: `{"verifier":"SE-07"}`.

**Repair:** Bind SE-07 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-07; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:144; SE-07",
  "paraphrase": "The adopted solution is the simplest one that satisfies the current requirement."
}
```

### maintainability/SE-08

Check: [`maintainability/engineering/se-08@1.0.0`](checks/engineering/se-08/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-08`. Minimum severity: `deny`.

No abstraction, parameter, or extension exists for a requirement that has not yet been confirmed.

Default parameters: `{"verifier":"SE-08"}`.

**Repair:** Bind SE-08 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-08; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:145; SE-08",
  "paraphrase": "No abstraction, parameter, or extension exists for a requirement that has not yet been confirmed."
}
```

### maintainability/SE-09

Check: [`maintainability/engineering/se-09@1.0.0`](checks/engineering/se-09/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-09`. Minimum severity: `deny`.

Each item of system knowledge has exactly one authoritative representation.

Default parameters: `{"verifier":"SE-09"}`.

**Repair:** Bind SE-09 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-09; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:146; SE-09",
  "paraphrase": "Each item of system knowledge has exactly one authoritative representation."
}
```

### maintainability/SE-10

Check: [`maintainability/engineering/se-10@1.0.0`](checks/engineering/se-10/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-10`. Minimum severity: `deny`.

Every module admits a one-sentence explanation containing no exceptional qualifiers.

Default parameters: `{"verifier":"SE-10"}`.

**Repair:** Bind SE-10 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-10; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:147; SE-10",
  "paraphrase": "Every module admits a one-sentence explanation containing no exceptional qualifiers."
}
```

### maintainability/SE-11

Check: [`maintainability/engineering/se-11@1.0.0`](checks/engineering/se-11/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-11`. Minimum severity: `deny`.

The intent of the code is evident to a human reader before it is evident to the compiler.

Default parameters: `{"verifier":"SE-11"}`.

**Repair:** Bind SE-11 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-11; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:148; SE-11",
  "paraphrase": "The intent of the code is evident to a human reader before it is evident to the compiler."
}
```

### maintainability/SE-12

Check: [`maintainability/engineering/se-12@1.0.0`](checks/engineering/se-12/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-12`. Minimum severity: `deny`.

No module is retained out of attachment; it is retained only while it remains the best representation of the problem.

Default parameters: `{"verifier":"SE-12"}`.

**Repair:** Bind SE-12 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-12; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:149; SE-12",
  "paraphrase": "No module is retained out of attachment; it is retained only while it remains the best representation of the problem."
}
```

### maintainability/SE-13

Check: [`maintainability/engineering/se-13@1.0.0`](checks/engineering/se-13/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-13`. Minimum severity: `deny`.

Every corrected defect has an identified root cause, not merely a suppressed symptom.

Default parameters: `{"verifier":"SE-13"}`.

**Repair:** Bind SE-13 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-13; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:150; SE-13",
  "paraphrase": "Every corrected defect has an identified root cause, not merely a suppressed symptom."
}
```

### maintainability/SE-14

Check: [`maintainability/engineering/se-14@1.0.0`](checks/engineering/se-14/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-14`. Minimum severity: `deny`.

No unexpected behaviour is left without a verified hypothesis.

Default parameters: `{"verifier":"SE-14"}`.

**Repair:** Bind SE-14 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-14; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:151; SE-14",
  "paraphrase": "No unexpected behaviour is left without a verified hypothesis."
}
```

### maintainability/SE-15

Check: [`maintainability/engineering/se-15@1.0.0`](checks/engineering/se-15/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-15`. Minimum severity: `deny`.

Every behavioural change is introduced singly, with verification between changes.

Default parameters: `{"verifier":"SE-15"}`.

**Repair:** Bind SE-15 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-15; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:152; SE-15",
  "paraphrase": "Every behavioural change is introduced singly, with verification between changes."
}
```

### maintainability/SE-16

Check: [`maintainability/engineering/se-16@1.0.0`](checks/engineering/se-16/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-16`. Minimum severity: `deny`.

Every communicated estimate is a range with explicit assumptions, never a point value.

Default parameters: `{"verifier":"SE-16"}`.

**Repair:** Bind SE-16 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-16; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:153; SE-16",
  "paraphrase": "Every communicated estimate is a range with explicit assumptions, never a point value."
}
```

### maintainability/SE-17

Check: [`maintainability/engineering/se-17@1.0.0`](checks/engineering/se-17/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-17`. Minimum severity: `deny`.

Every prototype is discarded or rewritten before it enters production; its only permanent product is learning.

Default parameters: `{"verifier":"SE-17"}`.

**Repair:** Bind SE-17 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-17; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:154; SE-17",
  "paraphrase": "Every prototype is discarded or rewritten before it enters production; its only permanent product is learning."
}
```

### maintainability/SE-18

Check: [`maintainability/engineering/se-18@1.0.0`](checks/engineering/se-18/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-18`. Minimum severity: `deny`.

Every large feature has at least one vertical slice operating end to end before it is widened.

Default parameters: `{"verifier":"SE-18"}`.

**Repair:** Bind SE-18 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-18; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:155; SE-18",
  "paraphrase": "Every large feature has at least one vertical slice operating end to end before it is widened."
}
```

### maintainability/SE-19

Check: [`maintainability/engineering/se-19@1.0.0`](checks/engineering/se-19/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-19`. Minimum severity: `deny`.

No irreversible decision is taken before the information that would make it reversible, or cheap to reverse, is available.

Default parameters: `{"verifier":"SE-19"}`.

**Repair:** Bind SE-19 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-19; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:156; SE-19",
  "paraphrase": "No irreversible decision is taken before the information that would make it reversible, or cheap to reverse, is available."
}
```

### maintainability/SE-20

Check: [`maintainability/engineering/se-20@1.0.0`](checks/engineering/se-20/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-20`. Minimum severity: `deny`.

No technology is adopted by fashion; every adoption has a documented criterion of fit to the problem.

Default parameters: `{"verifier":"SE-20"}`.

**Repair:** Bind SE-20 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-20; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:157; SE-20",
  "paraphrase": "No technology is adopted by fashion; every adoption has a documented criterion of fit to the problem."
}
```

### maintainability/SE-21

Check: [`maintainability/engineering/se-21@1.0.0`](checks/engineering/se-21/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-21`. Minimum severity: `deny`.

Every name discloses the intent of the entity without a comment.

Default parameters: `{"verifier":"SE-21"}`.

**Repair:** Bind SE-21 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-21; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:160; SE-21",
  "paraphrase": "Every name discloses the intent of the entity without a comment."
}
```

### maintainability/SE-22

Check: [`maintainability/engineering/se-22@1.0.0`](checks/engineering/se-22/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-22`. Minimum severity: `deny`.

Every name is pronounceable and searchable across the repository.

Default parameters: `{"verifier":"SE-22"}`.

**Repair:** Bind SE-22 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-22; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:161; SE-22",
  "paraphrase": "Every name is pronounceable and searchable across the repository."
}
```

### maintainability/SE-23

Check: [`maintainability/engineering/se-23@1.0.0`](checks/engineering/se-23/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-23`. Minimum severity: `deny`.

Every type bears a noun name; every function bears a verb or verb–noun name.

Default parameters: `{"verifier":"SE-23"}`.

**Repair:** Bind SE-23 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-23; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:162; SE-23",
  "paraphrase": "Every type bears a noun name; every function bears a verb or verb–noun name."
}
```

### maintainability/SE-24

Check: [`maintainability/engineering/se-24@1.0.0`](checks/engineering/se-24/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-24`. Minimum severity: `deny`.

Each domain concept has exactly one term in the code.

Default parameters: `{"verifier":"SE-24"}`.

**Repair:** Bind SE-24 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-24; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:163; SE-24",
  "paraphrase": "Each domain concept has exactly one term in the code."
}
```

### maintainability/SE-25

Check: [`maintainability/engineering/se-25@1.0.0`](checks/engineering/se-25/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-25`. Minimum severity: `deny`.

No name encodes type, scope, or visibility.

Default parameters: `{"verifier":"SE-25"}`.

**Repair:** Bind SE-25 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-25; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:164; SE-25",
  "paraphrase": "No name encodes type, scope, or visibility."
}
```

### maintainability/SE-26

Check: [`maintainability/engineering/se-26@1.0.0`](checks/engineering/se-26/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-26`. Minimum severity: `deny`.

No numeric or string literal carrying domain meaning appears outside a named constant.

Default parameters: `{"verifier":"SE-26"}`.

**Repair:** Bind SE-26 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-26; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:165; SE-26",
  "paraphrase": "No numeric or string literal carrying domain meaning appears outside a named constant."
}
```

### maintainability/SE-27

Check: [`maintainability/engineering/se-27@1.0.0`](checks/engineering/se-27/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-27`. Minimum severity: `deny`.

The entire repository conforms to a single set of formatting rules, enforced by tooling.

Default parameters: `{"verifier":"SE-27"}`.

**Repair:** Bind SE-27 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-27; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:166; SE-27",
  "paraphrase": "The entire repository conforms to a single set of formatting rules, enforced by tooling."
}
```

### maintainability/SE-28

Check: [`maintainability/engineering/se-28@1.0.0`](checks/engineering/se-28/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-28`. Minimum severity: `deny`.

Vertical whitespace separates distinct ideas; visual proximity groups what changes together.

Default parameters: `{"verifier":"SE-28"}`.

**Repair:** Bind SE-28 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-28; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:167; SE-28",
  "paraphrase": "Vertical whitespace separates distinct ideas; visual proximity groups what changes together."
}
```

### maintainability/SE-29

Check: [`maintainability/engineering/se-29@1.0.0`](checks/engineering/se-29/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-29`. Minimum severity: `deny`.

Every variable is declared in the narrowest scope that permits its use.

Default parameters: `{"verifier":"SE-29"}`.

**Repair:** Bind SE-29 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-29; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:168; SE-29",
  "paraphrase": "Every variable is declared in the narrowest scope that permits its use."
}
```

### maintainability/SE-30

Check: [`maintainability/engineering/se-30@1.0.0`](checks/engineering/se-30/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-30`. Minimum severity: `deny`.

No condition is expressed in negative form when an equivalent positive form exists.

Default parameters: `{"verifier":"SE-30"}`.

**Repair:** Bind SE-30 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-30; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:169; SE-30",
  "paraphrase": "No condition is expressed in negative form when an equivalent positive form exists."
}
```

### maintainability/SE-31

Check: [`maintainability/engineering/se-31@1.0.0`](checks/engineering/se-31/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-31`. Minimum severity: `deny`.

Every function has a single responsibility and a single level of abstraction.

Default parameters: `{"verifier":"SE-31"}`.

**Repair:** Bind SE-31 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-31; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:172; SE-31",
  "paraphrase": "Every function has a single responsibility and a single level of abstraction."
}
```

### maintainability/SE-32

Check: [`maintainability/engineering/se-32@1.0.0`](checks/engineering/se-32/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-32`. Minimum severity: `deny`.

Every function fits on one screen and is comprehensible without scrolling.

Default parameters: `{"verifier":"SE-32"}`.

**Repair:** Bind SE-32 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-32; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:173; SE-32",
  "paraphrase": "Every function fits on one screen and is comprehensible without scrolling."
}
```

### maintainability/SE-33

Check: [`maintainability/engineering/se-33@1.0.0`](checks/engineering/se-33/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-33`. Minimum severity: `deny`.

Every function has at most three arguments, or a single options object if more are required.

Default parameters: `{"verifier":"SE-33"}`.

**Repair:** Bind SE-33 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-33; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:174; SE-33",
  "paraphrase": "Every function has at most three arguments, or a single options object if more are required."
}
```

### maintainability/SE-34

Check: [`maintainability/engineering/se-34@1.0.0`](checks/engineering/se-34/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-34`. Minimum severity: `deny`.

No function receives a Boolean that selects between two behaviours.

Default parameters: `{"verifier":"SE-34"}`.

**Repair:** Bind SE-34 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-34; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:175; SE-34",
  "paraphrase": "No function receives a Boolean that selects between two behaviours."
}
```

### maintainability/SE-35

Check: [`maintainability/engineering/se-35@1.0.0`](checks/engineering/se-35/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-35`. Minimum severity: `deny`.

Every function is either a command or a query, never both.

Default parameters: `{"verifier":"SE-35"}`.

**Repair:** Bind SE-35 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-35; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:176; SE-35",
  "paraphrase": "Every function is either a command or a query, never both."
}
```

### maintainability/SE-36

Check: [`maintainability/engineering/se-36@1.0.0`](checks/engineering/se-36/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-36`. Minimum severity: `deny`.

Every side effect is declared in the function name or in its contract.

Default parameters: `{"verifier":"SE-36"}`.

**Repair:** Bind SE-36 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-36; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:177; SE-36",
  "paraphrase": "Every side effect is declared in the function name or in its contract."
}
```

### maintainability/SE-37

Check: [`maintainability/engineering/se-37@1.0.0`](checks/engineering/se-37/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-37`. Minimum severity: `deny`.

No function mutates its arguments unless the contract so declares.

Default parameters: `{"verifier":"SE-37"}`.

**Repair:** Bind SE-37 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-37; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:178; SE-37",
  "paraphrase": "No function mutates its arguments unless the contract so declares."
}
```

### maintainability/SE-38

Check: [`maintainability/engineering/se-38@1.0.0`](checks/engineering/se-38/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-38`. Minimum severity: `deny`.

Every non-trivial conditional branch body is extracted to a named function.

Default parameters: `{"verifier":"SE-38"}`.

**Repair:** Bind SE-38 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-38; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:179; SE-38",
  "paraphrase": "Every non-trivial conditional branch body is extracted to a named function."
}
```

### maintainability/SE-39

Check: [`maintainability/engineering/se-39@1.0.0`](checks/engineering/se-39/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-39`. Minimum severity: `deny`.

Every boundary condition is encapsulated in a single place.

Default parameters: `{"verifier":"SE-39"}`.

**Repair:** Bind SE-39 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-39; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:180; SE-39",
  "paraphrase": "Every boundary condition is encapsulated in a single place."
}
```

### maintainability/SE-40

Check: [`maintainability/engineering/se-40@1.0.0`](checks/engineering/se-40/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-40`. Minimum severity: `deny`.

No function has a control-nesting depth greater than two.

Default parameters: `{"verifier":"SE-40"}`.

**Repair:** Bind SE-40 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-40; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:181; SE-40",
  "paraphrase": "No function has a control-nesting depth greater than two."
}
```

### maintainability/SE-41

Check: [`maintainability/engineering/se-41@1.0.0`](checks/engineering/se-41/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-41`. Minimum severity: `deny`.

Every module has exactly one reason to change.

Default parameters: `{"verifier":"SE-41"}`.

**Repair:** Bind SE-41 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-41; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:184; SE-41",
  "paraphrase": "Every module has exactly one reason to change."
}
```

### maintainability/SE-42

Check: [`maintainability/engineering/se-42@1.0.0`](checks/engineering/se-42/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-42`. Minimum severity: `deny`.

Every new case of a known variation is added by extension, without modifying the module that already works.

Default parameters: `{"verifier":"SE-42"}`.

**Repair:** Bind SE-42 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-42; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:185; SE-42",
  "paraphrase": "Every new case of a known variation is added by extension, without modifying the module that already works."
}
```

### maintainability/SE-43

Check: [`maintainability/engineering/se-43@1.0.0`](checks/engineering/se-43/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-43`. Minimum severity: `deny`.

Every subtype is substitutable for its base type without altering the observable behaviour of the client.

Default parameters: `{"verifier":"SE-43"}`.

**Repair:** Bind SE-43 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-43; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:186; SE-43",
  "paraphrase": "Every subtype is substitutable for its base type without altering the observable behaviour of the client."
}
```

### maintainability/SE-44

Check: [`maintainability/engineering/se-44@1.0.0`](checks/engineering/se-44/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-44`. Minimum severity: `deny`.

Every interface exposes only operations that all of its implementers use.

Default parameters: `{"verifier":"SE-44"}`.

**Repair:** Bind SE-44 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-44; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:187; SE-44",
  "paraphrase": "Every interface exposes only operations that all of its implementers use."
}
```

### maintainability/SE-45

Check: [`maintainability/engineering/se-45@1.0.0`](checks/engineering/se-45/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-45`. Minimum severity: `deny`.

Every high-level module depends on abstractions it owns, never on infrastructure concretions.

Default parameters: `{"verifier":"SE-45"}`.

**Repair:** Bind SE-45 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-45; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:188; SE-45",
  "paraphrase": "Every high-level module depends on abstractions it owns, never on infrastructure concretions."
}
```

### maintainability/SE-46

Check: [`maintainability/engineering/se-46@1.0.0`](checks/engineering/se-46/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-46`. Minimum severity: `deny`.

Every module has high cohesion: its parts change for the same reason. Coupling between modules is explicit and minimal.

Default parameters: `{"verifier":"SE-46"}`.

**Repair:** Bind SE-46 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-46; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:189; SE-46",
  "paraphrase": "Every module has high cohesion: its parts change for the same reason. Coupling between modules is explicit and minimal."
}
```

### maintainability/SE-47

Check: [`maintainability/engineering/se-47@1.0.0`](checks/engineering/se-47/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-47`. Minimum severity: `deny`.

Every “has-a” relation is modelled by composition; inheritance is used only when substitutability holds.

Default parameters: `{"verifier":"SE-47"}`.

**Repair:** Bind SE-47 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-47; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:190; SE-47",
  "paraphrase": "Every “has-a” relation is modelled by composition; inheritance is used only when substitutability holds."
}
```

### maintainability/SE-48

Check: [`maintainability/engineering/se-48@1.0.0`](checks/engineering/se-48/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-48`. Minimum severity: `deny`.

No method navigates more than one level of indirection over objects it did not create, receive, or own.

Default parameters: `{"verifier":"SE-48"}`.

**Repair:** Bind SE-48 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-48; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:191; SE-48",
  "paraphrase": "No method navigates more than one level of indirection over objects it did not create, receive, or own."
}
```

### maintainability/SE-49

Check: [`maintainability/engineering/se-49@1.0.0`](checks/engineering/se-49/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-49`. Minimum severity: `deny`.

Every decision that depends on an object's state is taken by that object.

Default parameters: `{"verifier":"SE-49"}`.

**Repair:** Bind SE-49 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-49; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:192; SE-49",
  "paraphrase": "Every decision that depends on an object's state is taken by that object."
}
```

### maintainability/SE-50

Check: [`maintainability/engineering/se-50@1.0.0`](checks/engineering/se-50/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-50`. Minimum severity: `deny`.

Every point of variation lies behind a stable boundary.

Default parameters: `{"verifier":"SE-50"}`.

**Repair:** Bind SE-50 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-50; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:193; SE-50",
  "paraphrase": "Every point of variation lies behind a stable boundary."
}
```

### maintainability/SE-51

Check: [`maintainability/engineering/se-51@1.0.0`](checks/engineering/se-51/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-51`. Minimum severity: `deny`.

Construction of the object graph is separated from its use.

Default parameters: `{"verifier":"SE-51"}`.

**Repair:** Bind SE-51 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-51; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:194; SE-51",
  "paraphrase": "Construction of the object graph is separated from its use."
}
```

### maintainability/SE-52

Check: [`maintainability/engineering/se-52@1.0.0`](checks/engineering/se-52/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-52`. Minimum severity: `deny`.

Every dependency is received by constructor or parameter; no module resolves it from a global.

Default parameters: `{"verifier":"SE-52"}`.

**Repair:** Bind SE-52 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-52; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:195; SE-52",
  "paraphrase": "Every dependency is received by constructor or parameter; no module resolves it from a global."
}
```

### maintainability/SE-53

Check: [`maintainability/engineering/se-53@1.0.0`](checks/engineering/se-53/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-53`. Minimum severity: `deny`.

Every domain concept with value equality is immutable.

Default parameters: `{"verifier":"SE-53"}`.

**Repair:** Bind SE-53 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-53; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:196; SE-53",
  "paraphrase": "Every domain concept with value equality is immutable."
}
```

### maintainability/SE-54

Check: [`maintainability/engineering/se-54@1.0.0`](checks/engineering/se-54/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-54`. Minimum severity: `deny`.

No domain function returns null; absence is an explicit type.

Default parameters: `{"verifier":"SE-54"}`.

**Repair:** Bind SE-54 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-54; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:197; SE-54",
  "paraphrase": "No domain function returns null; absence is an explicit type."
}
```

### maintainability/SE-55

Check: [`maintainability/engineering/se-55@1.0.0`](checks/engineering/se-55/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-55`. Minimum severity: `deny`.

Every type has a name that a reviewer can speak aloud and understand.

Default parameters: `{"verifier":"SE-55"}`.

**Repair:** Bind SE-55 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-55; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:198; SE-55",
  "paraphrase": "Every type has a name that a reviewer can speak aloud and understand."
}
```

### maintainability/SE-56

Check: [`maintainability/engineering/se-56@1.0.0`](checks/engineering/se-56/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-56`. Minimum severity: `deny`.

Domain, application, infrastructure, and delivery occupy separate boundaries; none imports inward across a boundary.

Default parameters: `{"verifier":"SE-56"}`.

**Repair:** Bind SE-56 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-56; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:201; SE-56",
  "paraphrase": "Domain, application, infrastructure, and delivery occupy separate boundaries; none imports inward across a boundary."
}
```

### maintainability/SE-57

Check: [`maintainability/engineering/se-57@1.0.0`](checks/engineering/se-57/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-57`. Minimum severity: `deny`.

The domain references neither frameworks, drivers, nor transport protocols.

Default parameters: `{"verifier":"SE-57"}`.

**Repair:** Bind SE-57 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-57; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:202; SE-57",
  "paraphrase": "The domain references neither frameworks, drivers, nor transport protocols."
}
```

### maintainability/SE-58

Check: [`maintainability/engineering/se-58@1.0.0`](checks/engineering/se-58/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-58`. Minimum severity: `deny`.

Every complex system in production evolved from a simple system that already worked.

Default parameters: `{"verifier":"SE-58"}`.

**Repair:** Bind SE-58 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-58; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:203; SE-58",
  "paraphrase": "Every complex system in production evolved from a simple system that already worked."
}
```

### maintainability/SE-59

Check: [`maintainability/engineering/se-59@1.0.0`](checks/engineering/se-59/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-59`. Minimum severity: `deny`.

The boundary between modules reflects a real communication boundary of the team, or the discrepancy is documented.

Default parameters: `{"verifier":"SE-59"}`.

**Repair:** Bind SE-59 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-59; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:204; SE-59",
  "paraphrase": "The boundary between modules reflects a real communication boundary of the team, or the discrepancy is documented."
}
```

### maintainability/SE-60

Check: [`maintainability/engineering/se-60@1.0.0`](checks/engineering/se-60/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-60`. Minimum severity: `deny`.

Every module can be understood, tested, and replaced without reading the interior of its neighbours.

Default parameters: `{"verifier":"SE-60"}`.

**Repair:** Bind SE-60 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-60; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:205; SE-60",
  "paraphrase": "Every module can be understood, tested, and replaced without reading the interior of its neighbours."
}
```

### maintainability/SE-61

Check: [`maintainability/engineering/se-61@1.0.0`](checks/engineering/se-61/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-61`. Minimum severity: `deny`.

Every published API preserves backward compatibility, or the break is versioned and announced.

Default parameters: `{"verifier":"SE-61"}`.

**Repair:** Bind SE-61 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-61; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:206; SE-61",
  "paraphrase": "Every published API preserves backward compatibility, or the break is versioned and announced."
}
```

### maintainability/SE-62

Check: [`maintainability/engineering/se-62@1.0.0`](checks/engineering/se-62/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-62`. Minimum severity: `deny`.

Every invalid state is unrepresentable in the types of the public API.

Default parameters: `{"verifier":"SE-62"}`.

**Repair:** Bind SE-62 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-62; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:207; SE-62",
  "paraphrase": "Every invalid state is unrepresentable in the types of the public API."
}
```

### maintainability/SE-63

Check: [`maintainability/engineering/se-63@1.0.0`](checks/engineering/se-63/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-63`. Minimum severity: `deny`.

No secret, environment URL, or feature flag resides in source code.

Default parameters: `{"verifier":"SE-63"}`.

**Repair:** Bind SE-63 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-63; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:208; SE-63",
  "paraphrase": "No secret, environment URL, or feature flag resides in source code."
}
```

### maintainability/SE-64

Check: [`maintainability/engineering/se-64@1.0.0`](checks/engineering/se-64/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-64`. Minimum severity: `deny`.

Every backing service is interchangeable by configuration, without recompilation.

Default parameters: `{"verifier":"SE-64"}`.

**Repair:** Bind SE-64 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-64; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:209; SE-64",
  "paraphrase": "Every backing service is interchangeable by configuration, without recompilation."
}
```

### maintainability/SE-65

Check: [`maintainability/engineering/se-65@1.0.0`](checks/engineering/se-65/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-65`. Minimum severity: `deny`.

No application process stores session state in local memory as the source of truth.

Default parameters: `{"verifier":"SE-65"}`.

**Repair:** Bind SE-65 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-65; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:210; SE-65",
  "paraphrase": "No application process stores session state in local memory as the source of truth."
}
```

### maintainability/SE-66

Check: [`maintainability/engineering/se-66@1.0.0`](checks/engineering/se-66/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-66`. Minimum severity: `deny`.

Every retryable operation is idempotent.

Default parameters: `{"verifier":"SE-66"}`.

**Repair:** Bind SE-66 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-66; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:211; SE-66",
  "paraphrase": "Every retryable operation is idempotent."
}
```

### maintainability/SE-67

Check: [`maintainability/engineering/se-67@1.0.0`](checks/engineering/se-67/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-67`. Minimum severity: `deny`.

Every call to an external system has a timeout, a bounded retry policy, and a circuit breaker.

Default parameters: `{"verifier":"SE-67"}`.

**Repair:** Bind SE-67 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-67; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:212; SE-67",
  "paraphrase": "Every call to an external system has a timeout, a bounded retry policy, and a circuit breaker."
}
```

### maintainability/SE-68

Check: [`maintainability/engineering/se-68@1.0.0`](checks/engineering/se-68/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-68`. Minimum severity: `deny`.

Failure of one component does not propagate resource exhaustion to its neighbours.

Default parameters: `{"verifier":"SE-68"}`.

**Repair:** Bind SE-68 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-68; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:213; SE-68",
  "paraphrase": "Failure of one component does not propagate resource exhaustion to its neighbours."
}
```

### maintainability/SE-69

Check: [`maintainability/engineering/se-69@1.0.0`](checks/engineering/se-69/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-69`. Minimum severity: `deny`.

Every business operation emits a structured log, metric, or trace sufficient to diagnose it in production.

Default parameters: `{"verifier":"SE-69"}`.

**Repair:** Bind SE-69 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-69; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:214; SE-69",
  "paraphrase": "Every business operation emits a structured log, metric, or trace sufficient to diagnose it in production."
}
```

### maintainability/SE-70

Check: [`maintainability/engineering/se-70@1.0.0`](checks/engineering/se-70/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-70`. Minimum severity: `deny`.

The development environment executes the same boundaries and contracts as production, or the difference is isolated and tested.

Default parameters: `{"verifier":"SE-70"}`.

**Repair:** Bind SE-70 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-70; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:215; SE-70",
  "paraphrase": "The development environment executes the same boundaries and contracts as production, or the difference is isolated and tested."
}
```

### maintainability/SE-71

Check: [`maintainability/engineering/se-71@1.0.0`](checks/engineering/se-71/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-71`. Minimum severity: `deny`.

Every impossible state aborts immediately; no error is swallowed silently.

Default parameters: `{"verifier":"SE-71"}`.

**Repair:** Bind SE-71 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-71; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:218; SE-71",
  "paraphrase": "Every impossible state aborts immediately; no error is swallowed silently."
}
```

### maintainability/SE-72

Check: [`maintainability/engineering/se-72@1.0.0`](checks/engineering/se-72/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-72`. Minimum severity: `deny`.

Every failure carries sufficient context to diagnose it without reproducing the case.

Default parameters: `{"verifier":"SE-72"}`.

**Repair:** Bind SE-72 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-72; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:219; SE-72",
  "paraphrase": "Every failure carries sufficient context to diagnose it without reproducing the case."
}
```

### maintainability/SE-73

Check: [`maintainability/engineering/se-73@1.0.0`](checks/engineering/se-73/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-73`. Minimum severity: `deny`.

The happy path of a module can be read without traversing error handling.

Default parameters: `{"verifier":"SE-73"}`.

**Repair:** Bind SE-73 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-73; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:220; SE-73",
  "paraphrase": "The happy path of a module can be read without traversing error handling."
}
```

### maintainability/SE-74

Check: [`maintainability/engineering/se-74@1.0.0`](checks/engineering/se-74/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-74`. Minimum severity: `deny`.

Every assumption of the form “this cannot happen” is guarded by an assertion.

Default parameters: `{"verifier":"SE-74"}`.

**Repair:** Bind SE-74 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-74; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:221; SE-74",
  "paraphrase": "Every assumption of the form “this cannot happen” is guarded by an assertion."
}
```

### maintainability/SE-75

Check: [`maintainability/engineering/se-75@1.0.0`](checks/engineering/se-75/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-75`. Minimum severity: `deny`.

Every input that crosses a boundary is validated before use.

Default parameters: `{"verifier":"SE-75"}`.

**Repair:** Bind SE-75 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-75; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:222; SE-75",
  "paraphrase": "Every input that crosses a boundary is validated before use."
}
```

### maintainability/SE-76

Check: [`maintainability/engineering/se-76@1.0.0`](checks/engineering/se-76/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-76`. Minimum severity: `deny`.

Every process, credential, and role holds only the minimum permissions its function requires.

Default parameters: `{"verifier":"SE-76"}`.

**Repair:** Bind SE-76 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-76; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:223; SE-76",
  "paraphrase": "Every process, credential, and role holds only the minimum permissions its function requires."
}
```

### maintainability/SE-77

Check: [`maintainability/engineering/se-77@1.0.0`](checks/engineering/se-77/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-77`. Minimum severity: `deny`.

No secret appears in the repository, in the image, or in the logs.

Default parameters: `{"verifier":"SE-77"}`.

**Repair:** Bind SE-77 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-77; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:224; SE-77",
  "paraphrase": "No secret appears in the repository, in the image, or in the logs."
}
```

### maintainability/SE-78

Check: [`maintainability/engineering/se-78@1.0.0`](checks/engineering/se-78/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-78`. Minimum severity: `deny`.

No query or command is constructed by concatenating external input.

Default parameters: `{"verifier":"SE-78"}`.

**Repair:** Bind SE-78 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-78; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:225; SE-78",
  "paraphrase": "No query or command is constructed by concatenating external input."
}
```

### maintainability/SE-79

Check: [`maintainability/engineering/se-79@1.0.0`](checks/engineering/se-79/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-79`. Minimum severity: `deny`.

Every ingress boundary verifies authentication and authorisation; none trusts a prior check.

Default parameters: `{"verifier":"SE-79"}`.

**Repair:** Bind SE-79 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-79; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:226; SE-79",
  "paraphrase": "Every ingress boundary verifies authentication and authorisation; none trusts a prior check."
}
```

### maintainability/SE-80

Check: [`maintainability/engineering/se-80@1.0.0`](checks/engineering/se-80/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-80`. Minimum severity: `deny`.

Every dependency has an update owner and a security-patch policy.

Default parameters: `{"verifier":"SE-80"}`.

**Repair:** Bind SE-80 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-80; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:227; SE-80",
  "paraphrase": "Every dependency has an update owner and a security-patch policy."
}
```

### maintainability/SE-81

Check: [`maintainability/engineering/se-81@1.0.0`](checks/engineering/se-81/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-81`. Minimum severity: `deny`.

Test code satisfies the same naming and structural rules as production code.

Default parameters: `{"verifier":"SE-81"}`.

**Repair:** Bind SE-81 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-81; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:230; SE-81",
  "paraphrase": "Test code satisfies the same naming and structural rules as production code."
}
```

### maintainability/SE-82

Check: [`maintainability/engineering/se-82@1.0.0`](checks/engineering/se-82/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-82`. Minimum severity: `deny`.

Every test asserts a single behaviour.

Default parameters: `{"verifier":"SE-82"}`.

**Repair:** Bind SE-82 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-82; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:231; SE-82",
  "paraphrase": "Every test asserts a single behaviour."
}
```

### maintainability/SE-83

Check: [`maintainability/engineering/se-83@1.0.0`](checks/engineering/se-83/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-83`. Minimum severity: `deny`.

Every test is deterministic, order-independent, and self-evaluating.

Default parameters: `{"verifier":"SE-83"}`.

**Repair:** Bind SE-83 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-83; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:232; SE-83",
  "paraphrase": "Every test is deterministic, order-independent, and self-evaluating."
}
```

### maintainability/SE-84

Check: [`maintainability/engineering/se-84@1.0.0`](checks/engineering/se-84/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-84`. Minimum severity: `deny`.

Every test reads as Arrange–Act–Assert and contains no conditional logic of its own.

Default parameters: `{"verifier":"SE-84"}`.

**Repair:** Bind SE-84 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-84; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:233; SE-84",
  "paraphrase": "Every test reads as Arrange–Act–Assert and contains no conditional logic of its own."
}
```

### maintainability/SE-85

Check: [`maintainability/engineering/se-85@1.0.0`](checks/engineering/se-85/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-85`. Minimum severity: `deny`.

Every corrected defect has a test that failed before the correction.

Default parameters: `{"verifier":"SE-85"}`.

**Repair:** Bind SE-85 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-85; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:234; SE-85",
  "paraphrase": "Every corrected defect has a test that failed before the correction."
}
```

### maintainability/SE-86

Check: [`maintainability/engineering/se-86@1.0.0`](checks/engineering/se-86/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-86`. Minimum severity: `deny`.

Every assumption about a library or an external environment is covered by a boundary test.

Default parameters: `{"verifier":"SE-86"}`.

**Repair:** Bind SE-86 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-86; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:235; SE-86",
  "paraphrase": "Every assumption about a library or an external environment is covered by a boundary test."
}
```

### maintainability/SE-87

Check: [`maintainability/engineering/se-87@1.0.0`](checks/engineering/se-87/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-87`. Minimum severity: `deny`.

The test suite passes in full before integration; a broken test blocks the change.

Default parameters: `{"verifier":"SE-87"}`.

**Repair:** Bind SE-87 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-87; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:236; SE-87",
  "paraphrase": "The test suite passes in full before integration; a broken test blocks the change."
}
```

### maintainability/SE-88

Check: [`maintainability/engineering/se-88@1.0.0`](checks/engineering/se-88/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-88`. Minimum severity: `deny`.

Every third-party adapter has tests that fix the usage contract.

Default parameters: `{"verifier":"SE-88"}`.

**Repair:** Bind SE-88 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-88; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:237; SE-88",
  "paraphrase": "Every third-party adapter has tests that fix the usage contract."
}
```

### maintainability/SE-89

Check: [`maintainability/engineering/se-89@1.0.0`](checks/engineering/se-89/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-89`. Minimum severity: `deny`.

The majority of domain behaviours are covered by unit tests; integration and end-to-end tests cover boundaries, not internal logic.

Default parameters: `{"verifier":"SE-89"}`.

**Repair:** Bind SE-89 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-89; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:238; SE-89",
  "paraphrase": "The majority of domain behaviours are covered by unit tests; integration and end-to-end tests cover boundaries, not internal logic."
}
```

### maintainability/SE-90

Check: [`maintainability/engineering/se-90@1.0.0`](checks/engineering/se-90/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-90`. Minimum severity: `deny`.

No test depends on a private implementation detail.

Default parameters: `{"verifier":"SE-90"}`.

**Repair:** Bind SE-90 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-90; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:239; SE-90",
  "paraphrase": "No test depends on a private implementation detail."
}
```

### maintainability/SE-91

Check: [`maintainability/engineering/se-91@1.0.0`](checks/engineering/se-91/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-91`. Minimum severity: `deny`.

No optimisation is merged without a measurement that demonstrates the bottleneck.

Default parameters: `{"verifier":"SE-91"}`.

**Repair:** Bind SE-91 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-91; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:242; SE-91",
  "paraphrase": "No optimisation is merged without a measurement that demonstrates the bottleneck."
}
```

### maintainability/SE-92

Check: [`maintainability/engineering/se-92@1.0.0`](checks/engineering/se-92/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-92`. Minimum severity: `deny`.

Every algorithm over unbounded data has known complexity and an explicit bound.

Default parameters: `{"verifier":"SE-92"}`.

**Repair:** Bind SE-92 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-92; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:243; SE-92",
  "paraphrase": "Every algorithm over unbounded data has known complexity and an explicit bound."
}
```

### maintainability/SE-93

Check: [`maintainability/engineering/se-93@1.0.0`](checks/engineering/se-93/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-93`. Minimum severity: `deny`.

No mutable state is shared across threads without a demonstrated synchronisation protocol.

Default parameters: `{"verifier":"SE-93"}`.

**Repair:** Bind SE-93 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-93; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:244; SE-93",
  "paraphrase": "No mutable state is shared across threads without a demonstrated synchronisation protocol."
}
```

### maintainability/SE-94

Check: [`maintainability/engineering/se-94@1.0.0`](checks/engineering/se-94/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-94`. Minimum severity: `deny`.

No concurrent code exists unless a throughput or latency requirement demands it.

Default parameters: `{"verifier":"SE-94"}`.

**Repair:** Bind SE-94 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-94; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:245; SE-94",
  "paraphrase": "No concurrent code exists unless a throughput or latency requirement demands it."
}
```

### maintainability/SE-95

Check: [`maintainability/engineering/se-95@1.0.0`](checks/engineering/se-95/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-95`. Minimum severity: `deny`.

Every non-deterministic failure is treated as a concurrency or timing defect until shown otherwise.

Default parameters: `{"verifier":"SE-95"}`.

**Repair:** Bind SE-95 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-95; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:246; SE-95",
  "paraphrase": "Every non-deterministic failure is treated as a concurrency or timing defect until shown otherwise."
}
```

### maintainability/SE-96

Check: [`maintainability/engineering/se-96@1.0.0`](checks/engineering/se-96/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-96`. Minimum severity: `deny`.

Every data transformation has explicit input, output, and error policy.

Default parameters: `{"verifier":"SE-96"}`.

**Repair:** Bind SE-96 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-96; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:247; SE-96",
  "paraphrase": "Every data transformation has explicit input, output, and error policy."
}
```

### maintainability/SE-97

Check: [`maintainability/engineering/se-97@1.0.0`](checks/engineering/se-97/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-97`. Minimum severity: `deny`.

Every datum is immutable by default; mutation is local and visible.

Default parameters: `{"verifier":"SE-97"}`.

**Repair:** Bind SE-97 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-97; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:248; SE-97",
  "paraphrase": "Every datum is immutable by default; mutation is local and visible."
}
```

### maintainability/SE-98

Check: [`maintainability/engineering/se-98@1.0.0`](checks/engineering/se-98/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-98`. Minimum severity: `deny`.

Every API that returns or accepts collections has a limit, pagination, or backpressure.

Default parameters: `{"verifier":"SE-98"}`.

**Repair:** Bind SE-98 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-98; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:249; SE-98",
  "paraphrase": "Every API that returns or accepts collections has a limit, pagination, or backpressure."
}
```

### maintainability/SE-99

Check: [`maintainability/engineering/se-99@1.0.0`](checks/engineering/se-99/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-99`. Minimum severity: `deny`.

Every change is under version control, in a commit whose message explains the why, and does not break the build.

Default parameters: `{"verifier":"SE-99"}`.

**Repair:** Bind SE-99 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-99; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:252; SE-99",
  "paraphrase": "Every change is under version control, in a commit whose message explains the why, and does not break the build."
}
```

### maintainability/SE-100

Check: [`maintainability/engineering/se-100@1.0.0`](checks/engineering/se-100/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.se-100`. Minimum severity: `deny`.

Every repeatable step of build, test, lint, and deploy is automated; no release depends on an undocumented manual step.

Default parameters: `{"verifier":"SE-100"}`.

**Repair:** Bind SE-100 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run SE-100; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:253; SE-100",
  "paraphrase": "Every repeatable step of build, test, lint, and deploy is automated; no release depends on an undocumented manual step."
}
```

## maintainability/future-humans

Manifest version: `1.0.0`. Status: **preview**.

### maintainability/FH-01

Check: [`maintainability/future-humans/fh-01@1.0.0`](checks/future-humans/fh-01/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-01`. Minimum severity: `deny`.

Every module is intelligible to a competent engineer who has never seen the repository, given only the module and its public contract.

Default parameters: `{"verifier":"FH-01"}`.

**Repair:** Bind FH-01 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-01; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:14; FH-01",
  "paraphrase": "Every module is intelligible to a competent engineer who has never seen the repository, given only the module and its public contract."
}
```

### maintainability/FH-02

Check: [`maintainability/future-humans/fh-02@1.0.0`](checks/future-humans/fh-02/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-02`. Minimum severity: `deny`.

No understanding of a change requires oral history, a Slack thread, or the presence of the original author.

Default parameters: `{"verifier":"FH-02"}`.

**Repair:** Bind FH-02 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-02; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:15; FH-02",
  "paraphrase": "No understanding of a change requires oral history, a Slack thread, or the presence of the original author."
}
```

### maintainability/FH-03

Check: [`maintainability/future-humans/fh-03@1.0.0`](checks/future-humans/fh-03/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-03`. Minimum severity: `deny`.

The bus factor of every critical path is greater than one: a second person can modify it without a guided tour.

Default parameters: `{"verifier":"FH-03"}`.

**Repair:** Bind FH-03 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-03; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:16; FH-03",
  "paraphrase": "The bus factor of every critical path is greater than one: a second person can modify it without a guided tour."
}
```

### maintainability/FH-04

Check: [`maintainability/future-humans/fh-04@1.0.0`](checks/future-humans/fh-04/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-04`. Minimum severity: `deny`.

Every assumption a future reader must not violate is written next to the code that embodies it, not in a separate document that can drift.

Default parameters: `{"verifier":"FH-04"}`.

**Repair:** Bind FH-04 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-04; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:17; FH-04",
  "paraphrase": "Every assumption a future reader must not violate is written next to the code that embodies it, not in a separate document that can drift."
}
```

### maintainability/FH-05

Check: [`maintainability/future-humans/fh-05@1.0.0`](checks/future-humans/fh-05/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-05`. Minimum severity: `deny`.

No identifier requires the reader to know the author's private abbreviation, ticket number, or nickname.

Default parameters: `{"verifier":"FH-05"}`.

**Repair:** Bind FH-05 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-05; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:18; FH-05",
  "paraphrase": "No identifier requires the reader to know the author's private abbreviation, ticket number, or nickname."
}
```

### maintainability/FH-06

Check: [`maintainability/future-humans/fh-06@1.0.0`](checks/future-humans/fh-06/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-06`. Minimum severity: `deny`.

The happy path of every module is readable in one pass, top to bottom, without jumping to a definition to recover intent.

Default parameters: `{"verifier":"FH-06"}`.

**Repair:** Bind FH-06 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-06; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:19; FH-06",
  "paraphrase": "The happy path of every module is readable in one pass, top to bottom, without jumping to a definition to recover intent."
}
```

### maintainability/FH-07

Check: [`maintainability/future-humans/fh-07@1.0.0`](checks/future-humans/fh-07/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-07`. Minimum severity: `deny`.

Every surprise relative to the principle of least astonishment is marked at the point of surprise, with the reason it exists.

Default parameters: `{"verifier":"FH-07"}`.

**Repair:** Bind FH-07 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-07; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:20; FH-07",
  "paraphrase": "Every surprise relative to the principle of least astonishment is marked at the point of surprise, with the reason it exists."
}
```

### maintainability/FH-08

Check: [`maintainability/future-humans/fh-08@1.0.0`](checks/future-humans/fh-08/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-08`. Minimum severity: `deny`.

No comment restates what the code already says; every comment that remains answers a question the code cannot.

Default parameters: `{"verifier":"FH-08"}`.

**Repair:** Bind FH-08 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-08; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:21; FH-08",
  "paraphrase": "No comment restates what the code already says; every comment that remains answers a question the code cannot."
}
```

### maintainability/FH-09

Check: [`maintainability/future-humans/fh-09@1.0.0`](checks/future-humans/fh-09/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-09`. Minimum severity: `deny`.

Deleted explanations are deleted with the code they explained; no comment describes a world the code has left.

Default parameters: `{"verifier":"FH-09"}`.

**Repair:** Bind FH-09 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-09; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:22; FH-09",
  "paraphrase": "Deleted explanations are deleted with the code they explained; no comment describes a world the code has left."
}
```

### maintainability/FH-10

Check: [`maintainability/future-humans/fh-10@1.0.0`](checks/future-humans/fh-10/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-10`. Minimum severity: `deny`.

A future reader can answer "what does this do, and what must not change?" from the names and the tests alone.

Default parameters: `{"verifier":"FH-10"}`.

**Repair:** Bind FH-10 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-10; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:23; FH-10",
  "paraphrase": "A future reader can answer \"what does this do, and what must not change?\" from the names and the tests alone."
}
```

### maintainability/FH-11

Check: [`maintainability/future-humans/fh-11@1.0.0`](checks/future-humans/fh-11/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-11`. Minimum severity: `deny`.

Every name denotes a domain concept or an operation, never an implementation accident (`data`, `temp`, `flag`, `obj2`).

Default parameters: `{"verifier":"FH-11"}`.

**Repair:** Bind FH-11 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-11; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:26; FH-11",
  "paraphrase": "Every name denotes a domain concept or an operation, never an implementation accident (`data`, `temp`, `flag`, `obj2`)."
}
```

### maintainability/FH-12

Check: [`maintainability/future-humans/fh-12@1.0.0`](checks/future-humans/fh-12/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-12`. Minimum severity: `deny`.

The ubiquitous language of the domain is the language of the code; a term in the code means the same thing it means to a domain expert.

Default parameters: `{"verifier":"FH-12"}`.

**Repair:** Bind FH-12 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-12; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:27; FH-12",
  "paraphrase": "The ubiquitous language of the domain is the language of the code; a term in the code means the same thing it means to a domain expert."
}
```

### maintainability/FH-13

Check: [`maintainability/future-humans/fh-13@1.0.0`](checks/future-humans/fh-13/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-13`. Minimum severity: `deny`.

Each concept has one name; each name denotes one concept. Synonyms are treated as defects.

Default parameters: `{"verifier":"FH-13"}`.

**Repair:** Bind FH-13 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-13; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:28; FH-13",
  "paraphrase": "Each concept has one name; each name denotes one concept. Synonyms are treated as defects."
}
```

### maintainability/FH-14

Check: [`maintainability/future-humans/fh-14@1.0.0`](checks/future-humans/fh-14/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-14`. Minimum severity: `deny`.

A rename of a domain concept is atomic across code, tests, and the contract that exposes it.

Default parameters: `{"verifier":"FH-14"}`.

**Repair:** Bind FH-14 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-14; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:29; FH-14",
  "paraphrase": "A rename of a domain concept is atomic across code, tests, and the contract that exposes it."
}
```

### maintainability/FH-15

Check: [`maintainability/future-humans/fh-15@1.0.0`](checks/future-humans/fh-15/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-15`. Minimum severity: `deny`.

Boolean names state the true condition (`isClosed`, `hasPendingInvoice`), never a negated or ambiguous predicate.

Default parameters: `{"verifier":"FH-15"}`.

**Repair:** Bind FH-15 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-15; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:30; FH-15",
  "paraphrase": "Boolean names state the true condition (`isClosed`, `hasPendingInvoice`), never a negated or ambiguous predicate."
}
```

### maintainability/FH-16

Check: [`maintainability/future-humans/fh-16@1.0.0`](checks/future-humans/fh-16/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-16`. Minimum severity: `deny`.

Units, currencies, and time zones are in the type or the name; a bare number never carries an implicit unit.

Default parameters: `{"verifier":"FH-16"}`.

**Repair:** Bind FH-16 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-16; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:31; FH-16",
  "paraphrase": "Units, currencies, and time zones are in the type or the name; a bare number never carries an implicit unit."
}
```

### maintainability/FH-17

Check: [`maintainability/future-humans/fh-17@1.0.0`](checks/future-humans/fh-17/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-17`. Minimum severity: `deny`.

Abbreviations are expanded unless they are standard in the domain (`HTTP`, `URL`); project-local abbreviations are forbidden.

Default parameters: `{"verifier":"FH-17"}`.

**Repair:** Bind FH-17 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-17; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:32; FH-17",
  "paraphrase": "Abbreviations are expanded unless they are standard in the domain (`HTTP`, `URL`); project-local abbreviations are forbidden."
}
```

### maintainability/FH-18

Check: [`maintainability/future-humans/fh-18@1.0.0`](checks/future-humans/fh-18/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-18`. Minimum severity: `deny`.

The scope of a name matches its lifetime: a name used across a boundary is stable; a name used inside a function may be short only if its role is obvious in one line.

Default parameters: `{"verifier":"FH-18"}`.

**Repair:** Bind FH-18 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-18; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:33; FH-18",
  "paraphrase": "The scope of a name matches its lifetime: a name used across a boundary is stable; a name used inside a function may be short only if its role is obvious in one line."
}
```

### maintainability/FH-19

Check: [`maintainability/future-humans/fh-19@1.0.0`](checks/future-humans/fh-19/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-19`. Minimum severity: `deny`.

No name encodes a layer, a pattern, or a framework (`UserServiceImpl`, `ManagerHelper`) when a domain name would do.

Default parameters: `{"verifier":"FH-19"}`.

**Repair:** Bind FH-19 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-19; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:34; FH-19",
  "paraphrase": "No name encodes a layer, a pattern, or a framework (`UserServiceImpl`, `ManagerHelper`) when a domain name would do."
}
```

### maintainability/FH-20

Check: [`maintainability/future-humans/fh-20@1.0.0`](checks/future-humans/fh-20/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-20`. Minimum severity: `deny`.

A future reader can pronounce every public name and use it in a sentence about the business.

Default parameters: `{"verifier":"FH-20"}`.

**Repair:** Bind FH-20 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-20; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:35; FH-20",
  "paraphrase": "A future reader can pronounce every public name and use it in a sentence about the business."
}
```

### maintainability/FH-21

Check: [`maintainability/future-humans/fh-21@1.0.0`](checks/future-humans/fh-21/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-21`. Minimum severity: `deny`.

The effect of a function is fully described by its name, its arguments, and its declared result; hidden reads and writes of ambient state do not exist.

Default parameters: `{"verifier":"FH-21"}`.

**Repair:** Bind FH-21 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-21; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:38; FH-21",
  "paraphrase": "The effect of a function is fully described by its name, its arguments, and its declared result; hidden reads and writes of ambient state do not exist."
}
```

### maintainability/FH-22

Check: [`maintainability/future-humans/fh-22@1.0.0`](checks/future-humans/fh-22/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-22`. Minimum severity: `deny`.

No function both answers a question and changes the world.

Default parameters: `{"verifier":"FH-22"}`.

**Repair:** Bind FH-22 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-22; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:39; FH-22",
  "paraphrase": "No function both answers a question and changes the world."
}
```

### maintainability/FH-23

Check: [`maintainability/future-humans/fh-23@1.0.0`](checks/future-humans/fh-23/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-23`. Minimum severity: `deny`.

Mutable state does not escape the scope in which a reader can see every write.

Default parameters: `{"verifier":"FH-23"}`.

**Repair:** Bind FH-23 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-23; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:40; FH-23",
  "paraphrase": "Mutable state does not escape the scope in which a reader can see every write."
}
```

### maintainability/FH-24

Check: [`maintainability/future-humans/fh-24@1.0.0`](checks/future-humans/fh-24/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-24`. Minimum severity: `deny`.

Control-flow nesting never exceeds two levels; deeper decisions are named functions.

Default parameters: `{"verifier":"FH-24"}`.

**Repair:** Bind FH-24 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-24; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:41; FH-24",
  "paraphrase": "Control-flow nesting never exceeds two levels; deeper decisions are named functions."
}
```

### maintainability/FH-25

Check: [`maintainability/future-humans/fh-25@1.0.0`](checks/future-humans/fh-25/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-25`. Minimum severity: `deny`.

A function fits in working memory: one screen, one responsibility, one level of abstraction.

Default parameters: `{"verifier":"FH-25"}`.

**Repair:** Bind FH-25 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-25; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:42; FH-25",
  "paraphrase": "A function fits in working memory: one screen, one responsibility, one level of abstraction."
}
```

### maintainability/FH-26

Check: [`maintainability/future-humans/fh-26@1.0.0`](checks/future-humans/fh-26/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-26`. Minimum severity: `deny`.

Arguments are few enough that the call site reads as a sentence; a long argument list is a missing concept.

Default parameters: `{"verifier":"FH-26"}`.

**Repair:** Bind FH-26 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-26; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:43; FH-26",
  "paraphrase": "Arguments are few enough that the call site reads as a sentence; a long argument list is a missing concept."
}
```

### maintainability/FH-27

Check: [`maintainability/future-humans/fh-27@1.0.0`](checks/future-humans/fh-27/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-27`. Minimum severity: `deny`.

No Boolean argument selects a hidden second behaviour.

Default parameters: `{"verifier":"FH-27"}`.

**Repair:** Bind FH-27 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-27; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:44; FH-27",
  "paraphrase": "No Boolean argument selects a hidden second behaviour."
}
```

### maintainability/FH-28

Check: [`maintainability/future-humans/fh-28@1.0.0`](checks/future-humans/fh-28/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-28`. Minimum severity: `deny`.

Order of statements inside a function is the order of the story; setup, action, and result are not interleaved with unrelated concerns.

Default parameters: `{"verifier":"FH-28"}`.

**Repair:** Bind FH-28 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-28; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:45; FH-28",
  "paraphrase": "Order of statements inside a function is the order of the story; setup, action, and result are not interleaved with unrelated concerns."
}
```

### maintainability/FH-29

Check: [`maintainability/future-humans/fh-29@1.0.0`](checks/future-humans/fh-29/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-29`. Minimum severity: `deny`.

A reader can predict the next line. When they cannot, the unpredictability is the defect, not the reader's failure.

Default parameters: `{"verifier":"FH-29"}`.

**Repair:** Bind FH-29 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-29; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:46; FH-29",
  "paraphrase": "A reader can predict the next line. When they cannot, the unpredictability is the defect, not the reader's failure."
}
```

### maintainability/FH-30

Check: [`maintainability/future-humans/fh-30@1.0.0`](checks/future-humans/fh-30/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-30`. Minimum severity: `deny`.

Cyclomatic complexity of a function is low enough that every path can be named and tested.

Default parameters: `{"verifier":"FH-30"}`.

**Repair:** Bind FH-30 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-30; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:47; FH-30",
  "paraphrase": "Cyclomatic complexity of a function is low enough that every path can be named and tested."
}
```

### maintainability/FH-31

Check: [`maintainability/future-humans/fh-31@1.0.0`](checks/future-humans/fh-31/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-31`. Minimum severity: `deny`.

A requirement change touches one module, or a set of modules whose joint reason to change is explicit.

Default parameters: `{"verifier":"FH-31"}`.

**Repair:** Bind FH-31 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-31; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:50; FH-31",
  "paraphrase": "A requirement change touches one module, or a set of modules whose joint reason to change is explicit."
}
```

### maintainability/FH-32

Check: [`maintainability/future-humans/fh-32@1.0.0`](checks/future-humans/fh-32/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-32`. Minimum severity: `deny`.

Shotgun surgery — the same concept edited in many unrelated places — is treated as a design defect, not as normal work.

Default parameters: `{"verifier":"FH-32"}`.

**Repair:** Bind FH-32 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-32; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:51; FH-32",
  "paraphrase": "Shotgun surgery — the same concept edited in many unrelated places — is treated as a design defect, not as normal work."
}
```

### maintainability/FH-33

Check: [`maintainability/future-humans/fh-33@1.0.0`](checks/future-humans/fh-33/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-33`. Minimum severity: `deny`.

What changes together lives together; what changes for different reasons does not share a module.

Default parameters: `{"verifier":"FH-33"}`.

**Repair:** Bind FH-33 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-33; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:52; FH-33",
  "paraphrase": "What changes together lives together; what changes for different reasons does not share a module."
}
```

### maintainability/FH-34

Check: [`maintainability/future-humans/fh-34@1.0.0`](checks/future-humans/fh-34/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-34`. Minimum severity: `deny`.

A boundary is drawn where the rate of change differs, not where the technology differs.

Default parameters: `{"verifier":"FH-34"}`.

**Repair:** Bind FH-34 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-34; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:53; FH-34",
  "paraphrase": "A boundary is drawn where the rate of change differs, not where the technology differs."
}
```

### maintainability/FH-35

Check: [`maintainability/future-humans/fh-35@1.0.0`](checks/future-humans/fh-35/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-35`. Minimum severity: `deny`.

Feature flags and temporary branches have an owner and an expiry; an expired flag is a defect.

Default parameters: `{"verifier":"FH-35"}`.

**Repair:** Bind FH-35 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-35; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:54; FH-35",
  "paraphrase": "Feature flags and temporary branches have an owner and an expiry; an expired flag is a defect."
}
```

### maintainability/FH-36

Check: [`maintainability/future-humans/fh-36@1.0.0`](checks/future-humans/fh-36/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-36`. Minimum severity: `deny`.

No copy of a business rule exists outside its authoritative module. Callers depend on the rule, they do not reimplement it.

Default parameters: `{"verifier":"FH-36"}`.

**Repair:** Bind FH-36 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-36; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:55; FH-36",
  "paraphrase": "No copy of a business rule exists outside its authoritative module. Callers depend on the rule, they do not reimplement it."
}
```

### maintainability/FH-37

Check: [`maintainability/future-humans/fh-37@1.0.0`](checks/future-humans/fh-37/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-37`. Minimum severity: `deny`.

Configuration that operators change is outside the code; configuration that developers change is code, reviewed and versioned.

Default parameters: `{"verifier":"FH-37"}`.

**Repair:** Bind FH-37 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-37; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:56; FH-37",
  "paraphrase": "Configuration that operators change is outside the code; configuration that developers change is code, reviewed and versioned."
}
```

### maintainability/FH-38

Check: [`maintainability/future-humans/fh-38@1.0.0`](checks/future-humans/fh-38/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-38`. Minimum severity: `deny`.

A database migration is reversible or explicitly marked irreversible, with the recovery path written down before it runs.

Default parameters: `{"verifier":"FH-38"}`.

**Repair:** Bind FH-38 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-38; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:57; FH-38",
  "paraphrase": "A database migration is reversible or explicitly marked irreversible, with the recovery path written down before it runs."
}
```

### maintainability/FH-39

Check: [`maintainability/future-humans/fh-39@1.0.0`](checks/future-humans/fh-39/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-39`. Minimum severity: `deny`.

Public contracts change by addition or by a versioned break; silent changes of meaning are forbidden.

Default parameters: `{"verifier":"FH-39"}`.

**Repair:** Bind FH-39 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-39; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:58; FH-39",
  "paraphrase": "Public contracts change by addition or by a versioned break; silent changes of meaning are forbidden."
}
```

### maintainability/FH-40

Check: [`maintainability/future-humans/fh-40@1.0.0`](checks/future-humans/fh-40/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-40`. Minimum severity: `deny`.

The diff of a change is reviewable by a human in one sitting. A diff that cannot be reviewed is two changes.

Default parameters: `{"verifier":"FH-40"}`.

**Repair:** Bind FH-40 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-40; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:59; FH-40",
  "paraphrase": "The diff of a change is reviewable by a human in one sitting. A diff that cannot be reviewed is two changes."
}
```

### maintainability/FH-41

Check: [`maintainability/future-humans/fh-41@1.0.0`](checks/future-humans/fh-41/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-41`. Minimum severity: `deny`.

Every module has a public surface small enough to memorise and a private interior free to change.

Default parameters: `{"verifier":"FH-41"}`.

**Repair:** Bind FH-41 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-41; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:62; FH-41",
  "paraphrase": "Every module has a public surface small enough to memorise and a private interior free to change."
}
```

### maintainability/FH-42

Check: [`maintainability/future-humans/fh-42@1.0.0`](checks/future-humans/fh-42/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-42`. Minimum severity: `deny`.

Callers depend on the contract, never on the order of fields, the shape of errors, or the timing of internal calls.

Default parameters: `{"verifier":"FH-42"}`.

**Repair:** Bind FH-42 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-42; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:63; FH-42",
  "paraphrase": "Callers depend on the contract, never on the order of fields, the shape of errors, or the timing of internal calls."
}
```

### maintainability/FH-43

Check: [`maintainability/future-humans/fh-43@1.0.0`](checks/future-humans/fh-43/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-43`. Minimum severity: `deny`.

Third-party types do not leak across a boundary the team owns; an adapter is the only place that knows a vendor.

Default parameters: `{"verifier":"FH-43"}`.

**Repair:** Bind FH-43 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-43; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:64; FH-43",
  "paraphrase": "Third-party types do not leak across a boundary the team owns; an adapter is the only place that knows a vendor."
}
```

### maintainability/FH-44

Check: [`maintainability/future-humans/fh-44@1.0.0`](checks/future-humans/fh-44/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-44`. Minimum severity: `deny`.

A boundary documents what it guarantees, what it refuses, and what it leaves undefined.

Default parameters: `{"verifier":"FH-44"}`.

**Repair:** Bind FH-44 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-44; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:65; FH-44",
  "paraphrase": "A boundary documents what it guarantees, what it refuses, and what it leaves undefined."
}
```

### maintainability/FH-45

Check: [`maintainability/future-humans/fh-45@1.0.0`](checks/future-humans/fh-45/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-45`. Minimum severity: `deny`.

Error types at a boundary are part of the contract; a new failure mode is a contract change.

Default parameters: `{"verifier":"FH-45"}`.

**Repair:** Bind FH-45 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-45; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:66; FH-45",
  "paraphrase": "Error types at a boundary are part of the contract; a new failure mode is a contract change."
}
```

### maintainability/FH-46

Check: [`maintainability/future-humans/fh-46@1.0.0`](checks/future-humans/fh-46/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-46`. Minimum severity: `deny`.

Timeouts, retries, and idempotency keys are part of the boundary contract, not an implementation detail discovered in production.

Default parameters: `{"verifier":"FH-46"}`.

**Repair:** Bind FH-46 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-46; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:67; FH-46",
  "paraphrase": "Timeouts, retries, and idempotency keys are part of the boundary contract, not an implementation detail discovered in production."
}
```

### maintainability/FH-47

Check: [`maintainability/future-humans/fh-47@1.0.0`](checks/future-humans/fh-47/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-47`. Minimum severity: `deny`.

A module can be deleted. If it cannot, the reason is written on the module, not left implicit.

Default parameters: `{"verifier":"FH-47"}`.

**Repair:** Bind FH-47 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-47; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:68; FH-47",
  "paraphrase": "A module can be deleted. If it cannot, the reason is written on the module, not left implicit."
}
```

### maintainability/FH-48

Check: [`maintainability/future-humans/fh-48@1.0.0`](checks/future-humans/fh-48/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-48`. Minimum severity: `deny`.

Layering is one-directional. A domain concept does not import a delivery or infrastructure concept.

Default parameters: `{"verifier":"FH-48"}`.

**Repair:** Bind FH-48 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-48; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:69; FH-48",
  "paraphrase": "Layering is one-directional. A domain concept does not import a delivery or infrastructure concept."
}
```

### maintainability/FH-49

Check: [`maintainability/future-humans/fh-49@1.0.0`](checks/future-humans/fh-49/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-49`. Minimum severity: `deny`.

The dependency graph of the system is acyclic at the module level, or every cycle is named and justified.

Default parameters: `{"verifier":"FH-49"}`.

**Repair:** Bind FH-49 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-49; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:70; FH-49",
  "paraphrase": "The dependency graph of the system is acyclic at the module level, or every cycle is named and justified."
}
```

### maintainability/FH-50

Check: [`maintainability/future-humans/fh-50@1.0.0`](checks/future-humans/fh-50/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-50`. Minimum severity: `deny`.

A new team member can draw the boundaries of the system from the repository layout without a diagram that lives elsewhere.

Default parameters: `{"verifier":"FH-50"}`.

**Repair:** Bind FH-50 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-50; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:71; FH-50",
  "paraphrase": "A new team member can draw the boundaries of the system from the repository layout without a diagram that lives elsewhere."
}
```

### maintainability/FH-51

Check: [`maintainability/future-humans/fh-51@1.0.0`](checks/future-humans/fh-51/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-51`. Minimum severity: `deny`.

The reason for a non-obvious decision sits in an architecture decision record linked from the code it constrains.

Default parameters: `{"verifier":"FH-51"}`.

**Repair:** Bind FH-51 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-51; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:74; FH-51",
  "paraphrase": "The reason for a non-obvious decision sits in an architecture decision record linked from the code it constrains."
}
```

### maintainability/FH-52

Check: [`maintainability/future-humans/fh-52@1.0.0`](checks/future-humans/fh-52/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-52`. Minimum severity: `deny`.

ADRs are immutable records; a reversed decision is a new record that supersedes the old one, not an edit of history.

Default parameters: `{"verifier":"FH-52"}`.

**Repair:** Bind FH-52 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-52; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:75; FH-52",
  "paraphrase": "ADRs are immutable records; a reversed decision is a new record that supersedes the old one, not an edit of history."
}
```

### maintainability/FH-53

Check: [`maintainability/future-humans/fh-53@1.0.0`](checks/future-humans/fh-53/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-53`. Minimum severity: `deny`.

Comments explain why, never what. A "what" comment is a failed name.

Default parameters: `{"verifier":"FH-53"}`.

**Repair:** Bind FH-53 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-53; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:76; FH-53",
  "paraphrase": "Comments explain why, never what. A \"what\" comment is a failed name."
}
```

### maintainability/FH-54

Check: [`maintainability/future-humans/fh-54@1.0.0`](checks/future-humans/fh-54/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-54`. Minimum severity: `deny`.

TODO and FIXME carry an owner and a condition of removal; an ownerless TODO is deleted or promoted to a tracked defect.

Default parameters: `{"verifier":"FH-54"}`.

**Repair:** Bind FH-54 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-54; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:77; FH-54",
  "paraphrase": "TODO and FIXME carry an owner and a condition of removal; an ownerless TODO is deleted or promoted to a tracked defect."
}
```

### maintainability/FH-55

Check: [`maintainability/future-humans/fh-55@1.0.0`](checks/future-humans/fh-55/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-55`. Minimum severity: `deny`.

No commented-out code remains. History lives in version control.

Default parameters: `{"verifier":"FH-55"}`.

**Repair:** Bind FH-55 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-55; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:78; FH-55",
  "paraphrase": "No commented-out code remains. History lives in version control."
}
```

### maintainability/FH-56

Check: [`maintainability/future-humans/fh-56@1.0.0`](checks/future-humans/fh-56/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-56`. Minimum severity: `deny`.

The README of a module states its purpose, its non-purpose, and how to run its tests, in under one screen.

Default parameters: `{"verifier":"FH-56"}`.

**Repair:** Bind FH-56 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-56; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:79; FH-56",
  "paraphrase": "The README of a module states its purpose, its non-purpose, and how to run its tests, in under one screen."
}
```

### maintainability/FH-57

Check: [`maintainability/future-humans/fh-57@1.0.0`](checks/future-humans/fh-57/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-57`. Minimum severity: `deny`.

Onboarding to a critical path is a written path — build, test, change, observe — not a pairing session that vanishes.

Default parameters: `{"verifier":"FH-57"}`.

**Repair:** Bind FH-57 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-57; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:80; FH-57",
  "paraphrase": "Onboarding to a critical path is a written path — build, test, change, observe — not a pairing session that vanishes."
}
```

### maintainability/FH-58

Check: [`maintainability/future-humans/fh-58@1.0.0`](checks/future-humans/fh-58/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-58`. Minimum severity: `deny`.

Runbooks for operational failure live next to the code that fails, or link to it; they are exercised, not merely stored.

Default parameters: `{"verifier":"FH-58"}`.

**Repair:** Bind FH-58 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-58; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:81; FH-58",
  "paraphrase": "Runbooks for operational failure live next to the code that fails, or link to it; they are exercised, not merely stored."
}
```

### maintainability/FH-59

Check: [`maintainability/future-humans/fh-59@1.0.0`](checks/future-humans/fh-59/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-59`. Minimum severity: `deny`.

Glossaries of domain terms are generated from the code's public names or checked against them; a glossary that diverges is a defect.

Default parameters: `{"verifier":"FH-59"}`.

**Repair:** Bind FH-59 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-59; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:82; FH-59",
  "paraphrase": "Glossaries of domain terms are generated from the code's public names or checked against them; a glossary that diverges is a defect."
}
```

### maintainability/FH-60

Check: [`maintainability/future-humans/fh-60@1.0.0`](checks/future-humans/fh-60/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-60`. Minimum severity: `deny`.

A future reader can reconstruct the sequence of decisions that produced a module from the record, without interviewing anyone.

Default parameters: `{"verifier":"FH-60"}`.

**Repair:** Bind FH-60 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-60; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:83; FH-60",
  "paraphrase": "A future reader can reconstruct the sequence of decisions that produced a module from the record, without interviewing anyone."
}
```

### maintainability/FH-61

Check: [`maintainability/future-humans/fh-61@1.0.0`](checks/future-humans/fh-61/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-61`. Minimum severity: `deny`.

Tests describe behaviour in the language of the domain, not in the language of the implementation.

Default parameters: `{"verifier":"FH-61"}`.

**Repair:** Bind FH-61 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-61; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:86; FH-61",
  "paraphrase": "Tests describe behaviour in the language of the domain, not in the language of the implementation."
}
```

### maintainability/FH-62

Check: [`maintainability/future-humans/fh-62@1.0.0`](checks/future-humans/fh-62/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-62`. Minimum severity: `deny`.

A failing test names the behaviour that broke, without requiring the reader to open production code first.

Default parameters: `{"verifier":"FH-62"}`.

**Repair:** Bind FH-62 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-62; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:87; FH-62",
  "paraphrase": "A failing test names the behaviour that broke, without requiring the reader to open production code first."
}
```

### maintainability/FH-63

Check: [`maintainability/future-humans/fh-63@1.0.0`](checks/future-humans/fh-63/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-63`. Minimum severity: `deny`.

Every behaviour a future editor must preserve has a test that fails if it is lost.

Default parameters: `{"verifier":"FH-63"}`.

**Repair:** Bind FH-63 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-63; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:88; FH-63",
  "paraphrase": "Every behaviour a future editor must preserve has a test that fails if it is lost."
}
```

### maintainability/FH-64

Check: [`maintainability/future-humans/fh-64@1.0.0`](checks/future-humans/fh-64/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-64`. Minimum severity: `deny`.

Tests do not duplicate production logic; they state examples and boundaries.

Default parameters: `{"verifier":"FH-64"}`.

**Repair:** Bind FH-64 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-64; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:89; FH-64",
  "paraphrase": "Tests do not duplicate production logic; they state examples and boundaries."
}
```

### maintainability/FH-65

Check: [`maintainability/future-humans/fh-65@1.0.0`](checks/future-humans/fh-65/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-65`. Minimum severity: `deny`.

A test that fails intermittently is a defect in the test or in the system, and is not ignored.

Default parameters: `{"verifier":"FH-65"}`.

**Repair:** Bind FH-65 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-65; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:90; FH-65",
  "paraphrase": "A test that fails intermittently is a defect in the test or in the system, and is not ignored."
}
```

### maintainability/FH-66

Check: [`maintainability/future-humans/fh-66@1.0.0`](checks/future-humans/fh-66/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-66`. Minimum severity: `deny`.

Test data is recognisable as domain data. Obscure fixtures (`user1`, `foo`, `xxx`) are forbidden on public behaviour.

Default parameters: `{"verifier":"FH-66"}`.

**Repair:** Bind FH-66 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-66; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:91; FH-66",
  "paraphrase": "Test data is recognisable as domain data. Obscure fixtures (`user1`, `foo`, `xxx`) are forbidden on public behaviour."
}
```

### maintainability/FH-67

Check: [`maintainability/future-humans/fh-67@1.0.0`](checks/future-humans/fh-67/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-67`. Minimum severity: `deny`.

The test suite is the living specification: when the test and the comment disagree, the test is the authority, and the comment is fixed or removed.

Default parameters: `{"verifier":"FH-67"}`.

**Repair:** Bind FH-67 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-67; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:92; FH-67",
  "paraphrase": "The test suite is the living specification: when the test and the comment disagree, the test is the authority, and the comment is fixed or removed."
}
```

### maintainability/FH-68

Check: [`maintainability/future-humans/fh-68@1.0.0`](checks/future-humans/fh-68/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-68`. Minimum severity: `deny`.

Characterisation tests pin behaviour before a legacy module is changed; unpinned legacy behaviour is not modified.

Default parameters: `{"verifier":"FH-68"}`.

**Repair:** Bind FH-68 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-68; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:93; FH-68",
  "paraphrase": "Characterisation tests pin behaviour before a legacy module is changed; unpinned legacy behaviour is not modified."
}
```

### maintainability/FH-69

Check: [`maintainability/future-humans/fh-69@1.0.0`](checks/future-humans/fh-69/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-69`. Minimum severity: `deny`.

A test runs in seconds at the unit boundary and does not require a human environment, a secret, or a particular clock.

Default parameters: `{"verifier":"FH-69"}`.

**Repair:** Bind FH-69 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-69; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:94; FH-69",
  "paraphrase": "A test runs in seconds at the unit boundary and does not require a human environment, a secret, or a particular clock."
}
```

### maintainability/FH-70

Check: [`maintainability/future-humans/fh-70@1.0.0`](checks/future-humans/fh-70/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-70`. Minimum severity: `deny`.

Deleting a test requires a recorded reason. A deleted test is a deleted promise.

Default parameters: `{"verifier":"FH-70"}`.

**Repair:** Bind FH-70 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-70; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:95; FH-70",
  "paraphrase": "Deleting a test requires a recorded reason. A deleted test is a deleted promise."
}
```

### maintainability/FH-71

Check: [`maintainability/future-humans/fh-71@1.0.0`](checks/future-humans/fh-71/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-71`. Minimum severity: `deny`.

Code does not depend on the current date, the author's timezone, or the locale of the machine that builds it, except through an explicit clock and locale port.

Default parameters: `{"verifier":"FH-71"}`.

**Repair:** Bind FH-71 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-71; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:98; FH-71",
  "paraphrase": "Code does not depend on the current date, the author's timezone, or the locale of the machine that builds it, except through an explicit clock and locale port."
}
```

### maintainability/FH-72

Check: [`maintainability/future-humans/fh-72@1.0.0`](checks/future-humans/fh-72/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-72`. Minimum severity: `deny`.

No certificate, key, URL, or vendor endpoint is assumed permanent; each has a rotation or replacement path.

Default parameters: `{"verifier":"FH-72"}`.

**Repair:** Bind FH-72 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-72; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:99; FH-72",
  "paraphrase": "No certificate, key, URL, or vendor endpoint is assumed permanent; each has a rotation or replacement path."
}
```

### maintainability/FH-73

Check: [`maintainability/future-humans/fh-73@1.0.0`](checks/future-humans/fh-73/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-73`. Minimum severity: `deny`.

Deprecated surfaces announce their replacement and their removal condition at the point of use.

Default parameters: `{"verifier":"FH-73"}`.

**Repair:** Bind FH-73 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-73; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:100; FH-73",
  "paraphrase": "Deprecated surfaces announce their replacement and their removal condition at the point of use."
}
```

### maintainability/FH-74

Check: [`maintainability/future-humans/fh-74@1.0.0`](checks/future-humans/fh-74/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-74`. Minimum severity: `deny`.

A compatibility shim has a deletion criterion written on the shim.

Default parameters: `{"verifier":"FH-74"}`.

**Repair:** Bind FH-74 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-74; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:101; FH-74",
  "paraphrase": "A compatibility shim has a deletion criterion written on the shim."
}
```

### maintainability/FH-75

Check: [`maintainability/future-humans/fh-75@1.0.0`](checks/future-humans/fh-75/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-75`. Minimum severity: `deny`.

Log lines and error messages remain meaningful after the author has left: they name the operation, the entity, and the failure, not an internal nickname.

Default parameters: `{"verifier":"FH-75"}`.

**Repair:** Bind FH-75 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-75; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:102; FH-75",
  "paraphrase": "Log lines and error messages remain meaningful after the author has left: they name the operation, the entity, and the failure, not an internal nickname."
}
```

### maintainability/FH-76

Check: [`maintainability/future-humans/fh-76@1.0.0`](checks/future-humans/fh-76/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-76`. Minimum severity: `deny`.

Metrics and traces use stable names. Renaming an observability field is a contract change for the people who page on it.

Default parameters: `{"verifier":"FH-76"}`.

**Repair:** Bind FH-76 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-76; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:103; FH-76",
  "paraphrase": "Metrics and traces use stable names. Renaming an observability field is a contract change for the people who page on it."
}
```

### maintainability/FH-77

Check: [`maintainability/future-humans/fh-77@1.0.0`](checks/future-humans/fh-77/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-77`. Minimum severity: `deny`.

Data written today can be read by the code of next year, or a migration exists before the write format changes.

Default parameters: `{"verifier":"FH-77"}`.

**Repair:** Bind FH-77 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-77; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:104; FH-77",
  "paraphrase": "Data written today can be read by the code of next year, or a migration exists before the write format changes."
}
```

### maintainability/FH-78

Check: [`maintainability/future-humans/fh-78@1.0.0`](checks/future-humans/fh-78/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-78`. Minimum severity: `deny`.

A feature removed from the product is removed from the code. Dead feature paths are not kept "in case."

Default parameters: `{"verifier":"FH-78"}`.

**Repair:** Bind FH-78 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-78; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:105; FH-78",
  "paraphrase": "A feature removed from the product is removed from the code. Dead feature paths are not kept \"in case.\""
}
```

### maintainability/FH-79

Check: [`maintainability/future-humans/fh-79@1.0.0`](checks/future-humans/fh-79/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-79`. Minimum severity: `deny`.

Dependencies pin versions and record why a major upgrade is blocked; an unexplained pin is a defect.

Default parameters: `{"verifier":"FH-79"}`.

**Repair:** Bind FH-79 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-79; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:106; FH-79",
  "paraphrase": "Dependencies pin versions and record why a major upgrade is blocked; an unexplained pin is a defect."
}
```

### maintainability/FH-80

Check: [`maintainability/future-humans/fh-80@1.0.0`](checks/future-humans/fh-80/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-80`. Minimum severity: `deny`.

The oldest code in the repository is still approachable: it meets the same naming and test invariants, or it is isolated behind a boundary marked legacy.

Default parameters: `{"verifier":"FH-80"}`.

**Repair:** Bind FH-80 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-80; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:107; FH-80",
  "paraphrase": "The oldest code in the repository is still approachable: it meets the same naming and test invariants, or it is isolated behind a boundary marked legacy."
}
```

### maintainability/FH-81

Check: [`maintainability/future-humans/fh-81@1.0.0`](checks/future-humans/fh-81/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-81`. Minimum severity: `deny`.

A future editor can run the relevant tests with one command and trust a green result.

Default parameters: `{"verifier":"FH-81"}`.

**Repair:** Bind FH-81 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-81; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:110; FH-81",
  "paraphrase": "A future editor can run the relevant tests with one command and trust a green result."
}
```

### maintainability/FH-82

Check: [`maintainability/future-humans/fh-82@1.0.0`](checks/future-humans/fh-82/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-82`. Minimum severity: `deny`.

A wrong change fails in the test or at the boundary, not silently in production a week later.

Default parameters: `{"verifier":"FH-82"}`.

**Repair:** Bind FH-82 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-82; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:111; FH-82",
  "paraphrase": "A wrong change fails in the test or at the boundary, not silently in production a week later."
}
```

### maintainability/FH-83

Check: [`maintainability/future-humans/fh-83@1.0.0`](checks/future-humans/fh-83/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-83`. Minimum severity: `deny`.

Rollback of a release is a documented, practiced path, not a theory.

Default parameters: `{"verifier":"FH-83"}`.

**Repair:** Bind FH-83 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-83; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:112; FH-83",
  "paraphrase": "Rollback of a release is a documented, practiced path, not a theory."
}
```

### maintainability/FH-84

Check: [`maintainability/future-humans/fh-84@1.0.0`](checks/future-humans/fh-84/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-84`. Minimum severity: `deny`.

Feature introduction can be separated from feature activation, so a bad change can be disabled without a redeploy of logic.

Default parameters: `{"verifier":"FH-84"}`.

**Repair:** Bind FH-84 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-84; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:113; FH-84",
  "paraphrase": "Feature introduction can be separated from feature activation, so a bad change can be disabled without a redeploy of logic."
}
```

### maintainability/FH-85

Check: [`maintainability/future-humans/fh-85@1.0.0`](checks/future-humans/fh-85/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-85`. Minimum severity: `deny`.

Observability is sufficient for a stranger to tell whether their change worked in production, without asking the author.

Default parameters: `{"verifier":"FH-85"}`.

**Repair:** Bind FH-85 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-85; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:114; FH-85",
  "paraphrase": "Observability is sufficient for a stranger to tell whether their change worked in production, without asking the author."
}
```

### maintainability/FH-86

Check: [`maintainability/future-humans/fh-86@1.0.0`](checks/future-humans/fh-86/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-86`. Minimum severity: `deny`.

No global mutable singleton is the hidden input of a module a stranger must change.

Default parameters: `{"verifier":"FH-86"}`.

**Repair:** Bind FH-86 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-86; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:115; FH-86",
  "paraphrase": "No global mutable singleton is the hidden input of a module a stranger must change."
}
```

### maintainability/FH-87

Check: [`maintainability/future-humans/fh-87@1.0.0`](checks/future-humans/fh-87/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-87`. Minimum severity: `deny`.

Construction of collaborators is visible at the composition root; a stranger can substitute a fake without editing the module.

Default parameters: `{"verifier":"FH-87"}`.

**Repair:** Bind FH-87 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-87; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:116; FH-87",
  "paraphrase": "Construction of collaborators is visible at the composition root; a stranger can substitute a fake without editing the module."
}
```

### maintainability/FH-88

Check: [`maintainability/future-humans/fh-88@1.0.0`](checks/future-humans/fh-88/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-88`. Minimum severity: `deny`.

Invariants of a data structure are enforced by the type or by a constructor, not by the hope that every caller remembers them.

Default parameters: `{"verifier":"FH-88"}`.

**Repair:** Bind FH-88 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-88; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:117; FH-88",
  "paraphrase": "Invariants of a data structure are enforced by the type or by a constructor, not by the hope that every caller remembers them."
}
```

### maintainability/FH-89

Check: [`maintainability/future-humans/fh-89@1.0.0`](checks/future-humans/fh-89/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-89`. Minimum severity: `deny`.

Partial failure is explicit. A function does not return success while having done half the work, unless the contract says the operation is partial and how to resume it.

Default parameters: `{"verifier":"FH-89"}`.

**Repair:** Bind FH-89 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-89; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:118; FH-89",
  "paraphrase": "Partial failure is explicit. A function does not return success while having done half the work, unless the contract says the operation is partial and how to resume it."
}
```

### maintainability/FH-90

Check: [`maintainability/future-humans/fh-90@1.0.0`](checks/future-humans/fh-90/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-90`. Minimum severity: `deny`.

The cost of a mistake on a critical path is bounded: limits, quotas, and kill switches exist before they are needed.

Default parameters: `{"verifier":"FH-90"}`.

**Repair:** Bind FH-90 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-90; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:119; FH-90",
  "paraphrase": "The cost of a mistake on a critical path is bounded: limits, quotas, and kill switches exist before they are needed."
}
```

### maintainability/FH-91

Check: [`maintainability/future-humans/fh-91@1.0.0`](checks/future-humans/fh-91/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-91`. Minimum severity: `deny`.

Code review checks maintainability for a future stranger, not style preference and not the author's intent as privately understood.

Default parameters: `{"verifier":"FH-91"}`.

**Repair:** Bind FH-91 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-91; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:122; FH-91",
  "paraphrase": "Code review checks maintainability for a future stranger, not style preference and not the author's intent as privately understood."
}
```

### maintainability/FH-92

Check: [`maintainability/future-humans/fh-92@1.0.0`](checks/future-humans/fh-92/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-92`. Minimum severity: `deny`.

Review comments that encode a real invariant are promoted into code, a test, or an ADR; they do not remain only in the review.

Default parameters: `{"verifier":"FH-92"}`.

**Repair:** Bind FH-92 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-92; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:123; FH-92",
  "paraphrase": "Review comments that encode a real invariant are promoted into code, a test, or an ADR; they do not remain only in the review."
}
```

### maintainability/FH-93

Check: [`maintainability/future-humans/fh-93@1.0.0`](checks/future-humans/fh-93/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-93`. Minimum severity: `deny`.

Ownership of a module is a name a future reader can find. Unowned code is assigned or deleted.

Default parameters: `{"verifier":"FH-93"}`.

**Repair:** Bind FH-93 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-93; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:124; FH-93",
  "paraphrase": "Ownership of a module is a name a future reader can find. Unowned code is assigned or deleted."
}
```

### maintainability/FH-94

Check: [`maintainability/future-humans/fh-94@1.0.0`](checks/future-humans/fh-94/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-94`. Minimum severity: `deny`.

A module no one can explain is a risk, and is scheduled for characterisation or isolation.

Default parameters: `{"verifier":"FH-94"}`.

**Repair:** Bind FH-94 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-94; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:125; FH-94",
  "paraphrase": "A module no one can explain is a risk, and is scheduled for characterisation or isolation."
}
```

### maintainability/FH-95

Check: [`maintainability/future-humans/fh-95@1.0.0`](checks/future-humans/fh-95/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-95`. Minimum severity: `deny`.

Onboarding material is updated in the same change that invalidates it.

Default parameters: `{"verifier":"FH-95"}`.

**Repair:** Bind FH-95 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-95; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:126; FH-95",
  "paraphrase": "Onboarding material is updated in the same change that invalidates it."
}
```

### maintainability/FH-96

Check: [`maintainability/future-humans/fh-96@1.0.0`](checks/future-humans/fh-96/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-96`. Minimum severity: `deny`.

Commit messages state the problem and the reason, not only the file touched. A future bisect can be read as a narrative.

Default parameters: `{"verifier":"FH-96"}`.

**Repair:** Bind FH-96 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-96; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:127; FH-96",
  "paraphrase": "Commit messages state the problem and the reason, not only the file touched. A future bisect can be read as a narrative."
}
```

### maintainability/FH-97

Check: [`maintainability/future-humans/fh-97@1.0.0`](checks/future-humans/fh-97/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-97`. Minimum severity: `deny`.

Large rewrites are not the plan for unmaintainable code. Incremental characterisation and boundary extraction are.

Default parameters: `{"verifier":"FH-97"}`.

**Repair:** Bind FH-97 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-97; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:128; FH-97",
  "paraphrase": "Large rewrites are not the plan for unmaintainable code. Incremental characterisation and boundary extraction are."
}
```

### maintainability/FH-98

Check: [`maintainability/future-humans/fh-98@1.0.0`](checks/future-humans/fh-98/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-98`. Minimum severity: `deny`.

Cleverness that saves lines at the cost of a future reader's hour is rejected. The reader's hour is the scarce resource.

Default parameters: `{"verifier":"FH-98"}`.

**Repair:** Bind FH-98 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-98; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:129; FH-98",
  "paraphrase": "Cleverness that saves lines at the cost of a future reader's hour is rejected. The reader's hour is the scarce resource."
}
```

### maintainability/FH-99

Check: [`maintainability/future-humans/fh-99@1.0.0`](checks/future-humans/fh-99/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-99`. Minimum severity: `deny`.

The team can delete code. Addition without a path to removal is treated as debt.

Default parameters: `{"verifier":"FH-99"}`.

**Repair:** Bind FH-99 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-99; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:130; FH-99",
  "paraphrase": "The team can delete code. Addition without a path to removal is treated as debt."
}
```

### maintainability/FH-100

Check: [`maintainability/future-humans/fh-100@1.0.0`](checks/future-humans/fh-100/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `maintainability.fh-100`. Minimum severity: `deny`.

Every change leaves the touched region easier for the next stranger than it was found, or the reason it could not is written on the change.

Default parameters: `{"verifier":"FH-100"}`.

**Repair:** Bind FH-100 to a reviewed project assertion with applicability, scope, evidence source, owner and freshness in its rationale. Test a violating control. Run pregate fitness run FH-100; repair failed evidence or propose a bounded adaptation that preserves the requirement.

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
  "work": "User-requested future-human and software-engineering invariant catalog",
  "locator": "packs/maintainability/INVARIANTS.md:131; FH-100",
  "paraphrase": "Every change leaves the touched region easier for the next stranger than it was found, or the reason it could not is written on the change."
}
```

## maintainability/maintainability

Manifest version: `1.1.1`. Status: **complete**.

### maintainability/MAINT-NEST-001

Check: [`maintainability/control/no-deep-nesting@1.1.0`](checks/control/no-deep-nesting/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `control.nesting`. Minimum severity: `none`.

Deeply nested control structures strain working memory and obscure intent for future readers. An if whose body is only a return, continue, break, or throw is a guard clause and does not add a level.

Default parameters: `{"max":2}`.

**Repair:** Extract inner conditionals into small, well-named helper functions or use early return guard clauses.

**Scope and limits:** Hiding deep nesting in loops, switch branches, try blocks, or mixed control structures.

**Interactions when active together:**

- Duplicates `clean-code/CC-NEST-001`: Both measure control-flow nesting depth in TypeScript and JavaScript functions. clean-code/CC-NEST-001 defaults to 4 and ignores guard clauses. maintainability/MAINT-NEST-001 defaults to 2. Settle: Keep one active or turn clean-code/CC-NEST-001 off when maintainability/MAINT-NEST-001 already enforces the nesting limit.

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
  "work": "One Hundred Invariants for Code Maintainable by Future Humans",
  "locator": "FH Rule 24 / SE Rule 40",
  "paraphrase": "Control-flow nesting never exceeds two levels; deeper decisions are named functions."
}
```

### maintainability/MAINT-BOOL-001

Check: [`maintainability/naming/no-negated-boolean@1.0.0`](checks/naming/no-negated-boolean/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `naming.negated-boolean`. Minimum severity: `none`.

Negated boolean identifiers (e.g. isNotActive, hasNoAccess, isInvalid) force callers into confusing double-negative logic like !isNotActive.

Default parameters: `{}`.

**Repair:** Rename the boolean to state the positive condition (e.g. isActive, hasAccess, isValid).

**Scope and limits:** Prefixing booleans with isNot, hasNo, noError, or isInvalid.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariants for Code Maintainable by Future Humans",
  "locator": "FH Rule 15 / SE Rule 30",
  "paraphrase": "Boolean names state the true condition, never a negated or ambiguous predicate."
}
```

### maintainability/MAINT-NAME-001

Check: [`maintainability/naming/no-placeholder-name@1.0.0`](checks/naming/no-placeholder-name/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `naming.placeholder-name`. Minimum severity: `none`.

Placeholder names like temp, tmp, foo, bar, baz on exported declarations hide domain intent from future maintainers.

Default parameters: `{}`.

**Repair:** Replace placeholder names with specific domain nouns or action verbs.

**Scope and limits:** Exporting variables or functions named temp, tmp, foo, bar, baz, obj, flag.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariants for Code Maintainable by Future Humans",
  "locator": "FH Rule 11 & 22",
  "paraphrase": "Every name denotes a domain concept or an operation, never an implementation accident."
}
```

### maintainability/MAINT-EMPTY-001

Check: [`maintainability/contracts/no-empty-interface@1.0.0`](checks/contracts/no-empty-interface/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `contracts.empty-interface`. Minimum severity: `none`.

Empty interfaces declare speculative scaffolding with zero members, cluttering contracts and conveying no type safety.

Default parameters: `{}`.

**Repair:** Declare the necessary members on the interface, use an existing type, or delete the empty interface.

**Scope and limits:** Declaring interface Foo {} without members or heritage.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariant Rules for the Software Engineer–Architect",
  "locator": "SE Rule 8 & 1",
  "paraphrase": "No abstraction, parameter, or extension exists for a requirement that has not yet been confirmed."
}
```

### maintainability/MAINT-NULL-001

Check: [`maintainability/contracts/no-null-domain-return@1.0.0`](checks/contracts/no-null-domain-return/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `maintainability.null-domain-return`. Minimum severity: `none`.

Callers of a domain operation should see and handle absence as part of the declared variant.

Default parameters: `{}`.

**Repair:** Return a named absent variant or an existing result type when the domain contract calls for it.

**Scope and limits:** This advisory check matches direct null returns in domain paths only. It cannot infer the function's declared return type or detect indirect null values.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariant Rules for the Software Engineer–Architect",
  "locator": "SE-54",
  "paraphrase": "A domain function represents absence in its result contract rather than returning an untyped null sentinel."
}
```

### maintainability/MAINT-CLOCK-001

Check: [`maintainability/effects/no-ambient-clock-in-domain@1.0.0`](checks/effects/no-ambient-clock-in-domain/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `maintainability.ambient-clock`. Minimum severity: `none`.

Ambient time makes the same operation produce different outcomes under the same explicit inputs.

Default parameters: `{}`.

**Repair:** Accept a clock port or timestamp at the domain boundary and read the system clock in an adapter.

**Scope and limits:** Qualifying Date.now through globalThis still reads ambient time. An explicit date value is allowed.

**Interactions when active together:**

- Duplicates `architecture/FCIS-IO-002`: Both report Date.now() and new Date() in domain files of the core layer, so one clock read is reported twice. Settle: FCIS-IO-002 also covers randomness and the environment; turn MAINT-CLOCK-001 off when the core layer is the domain.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariants for Code Maintainable by Future Humans",
  "locator": "FH-71",
  "paraphrase": "A domain operation takes the time it uses as an explicit input instead of consulting the machine clock."
}
```

### maintainability/MAINT-IMPL-001

Check: [`maintainability/naming/no-impl-suffix@1.0.0`](checks/naming/no-impl-suffix/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `naming.impl-suffix`. Minimum severity: `none`.

InvoiceServiceImpl tells the reader only that something implements InvoiceService. The second implementation then has no honest name, and the reader still has to open the class to learn what it is built on.

Default parameters: `{}`.

**Repair:** Name the class after what distinguishes it: PostgresInvoiceRepository, InMemorySessionStore, StripePaymentGateway.

**Scope and limits:** Only class declarations, class expressions and consts bound to a class whose name ends in Impl or Implementation are checked. Helper, Manager and similar suffixes need a domain judgment and are not matched; neither are functions such as sortImpl.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariants for Code Maintainable by Future Humans",
  "locator": "FH-19",
  "paraphrase": "No name encodes a layer, a pattern, or a framework (UserServiceImpl, ManagerHelper) when a domain name would do."
}
```

### maintainability/MAINT-DEPR-001

Check: [`maintainability/contracts/deprecation-notice@1.0.0`](checks/contracts/deprecation-notice/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `contracts.deprecation-notice`. Minimum severity: `none`.

Editors strike through a @deprecated symbol at every call site. With no text, the caller learns the API is going away but not what to use instead or how long it has.

Default parameters: `{}`.

**Repair:** Write the replacement and the removal condition after the tag: @deprecated Use issueInvoice; removed when the v1 API is retired. If every caller can move now, migrate them and delete the deprecated API instead.

**Scope and limits:** Only JSDoc block comments are checked, because TypeScript tooling ignores @deprecated in line comments. Any text, an inline {@link}, or a following @see counts as the notice; whether it names a real replacement and a removal condition is not checked.

**Interactions when active together:**

- Duplicates `pstack/PS-COMMENT-001`: PS-COMMENT-001 reports every comment that carries @deprecated, so a bare @deprecated is reported by both rules, and a written notice is still reported by PS-COMMENT-001. Settle: Migrating the callers and deleting the deprecated API satisfies both. Teams that keep deprecated surfaces exclude the files that carry them from PS-COMMENT-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariants for Code Maintainable by Future Humans",
  "locator": "FH-73",
  "paraphrase": "Deprecated surfaces announce their replacement and their removal condition at the point of use."
}
```

### maintainability/MAINT-MIGR-001

Check: [`maintainability/migrations/reversible-migration@1.0.0`](checks/migrations/reversible-migration/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `migrations.reversible`. Minimum severity: `none`.

A migration with only an up step leaves the operator without a rollback when the deploy goes wrong, and nobody wrote down how to recover before it ran.

Default parameters: `{}`.

**Repair:** Add a down that reverses the change. If it cannot be reversed, add a down that throws an error stating the recovery path, such as the snapshot to restore.

**Scope and limits:** Only TS/JS modules under migrations/ are checked; SQL migration files are not parsed. A down that exists but does not reverse up is not detected. A comment saying irreversible is not the marker; the throwing down is.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "One Hundred Invariants for Code Maintainable by Future Humans",
  "locator": "FH-38",
  "paraphrase": "A database migration is reversible or explicitly marked irreversible, with the recovery path written down before it runs."
}
```
