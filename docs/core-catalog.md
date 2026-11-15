# core pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `0.0.1`. Category: **invariants**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## core/pregate-integrity

Manifest version: `1.1.0`. Status: **complete**.

### core/EVA-GEN-001

Check: [`core/integrity/new-generated-marker@1.1.0`](../catalog/checks/integrity/new-generated-marker/check.json). Default severity: **deny**.

Implementation: `diff`. Phases: `pre`, `stop`.

Languages: language-independent change guard. Cardinality: `singleton`. Dimension: `integrity.generated-marker`. Minimum severity: `deny`.

A generated marker makes reviewers and tools skip the file and freezes it against later edits.

Default parameters: `{"markers":["@generatedMarkers"]}`.

**Repair:** Remove the marker; if the file really comes from a generator, run the generator and ask the user to commit its output.

**Scope and limits:** Actual line or block comments carry generated markers in supported source. Strings, templates, regular expressions, JSX text and JSON data do not. Markdown counts genuine HTML comments outside fenced, indented and matched backtick code; prose and examples do not exempt a file. Unsupported executable source retains conservative substring matching. Invalid parsed source cannot hide a marker through syntax recovery.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "markers": {
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
  "work": "PREGATE anti-evasion policy",
  "locator": "SPEC §10.1 (self-exemption) and DD-21",
  "paraphrase": "Marking hand-written code as generated exempts it from review and from later edits; only a generator may introduce the marker."
}
```

### core/EVA-GEN-002

Check: [`core/integrity/edit-generated-or-excluded@1.1.0`](../catalog/checks/integrity/edit-generated-or-excluded/check.json). Default severity: **deny**.

Implementation: `placement`. Phases: `pre`, `stop`.

Languages: language-independent change guard. Cardinality: `singleton`. Dimension: `integrity.generated-edit`. Minimum severity: `deny`.

Edits to generated or excluded files skip every rule and are lost or overwritten at the next regeneration.

Default parameters: `{}`.

**Repair:** Change the source the file is generated from, or ask the user to bring the file into scope in the preset.

**Scope and limits:** Deleting a genuine comment marker in the same edit, or moving code to an excluded path, does not bypass placement. Generated-marker detection uses the same comment and documentation semantics as EVA-GEN-001. Unsupported executable source retains conservative substring matching; unsupported language coverage remains incomplete.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE anti-evasion policy",
  "locator": "SPEC §8.5.10 and DD-21",
  "paraphrase": "Files that were generated or excluded before the session are regenerated or changed by people, never edited by the agent, because no rule evaluates them."
}
```

### core/EVA-SUP-001

Check: [`core/integrity/new-inline-suppression@1.1.0`](../catalog/checks/integrity/new-inline-suppression/check.json). Default severity: **deny**.

Implementation: `diff`. Phases: `pre`, `stop`.

Languages: language-independent change guard. Cardinality: `singleton`. Dimension: `integrity.suppression`. Minimum severity: `deny`.

Each new suppression silences a check exactly where it found a problem.

Default parameters: `{"markers":["pregate-disable","eslint-disable","@ts-ignore","@ts-nocheck","@ts-expect-error","biome-ignore","oxlint-disable","deno-lint-ignore"]}`.

**Repair:** Fix the reported problem; if the rule is wrong here, write a request under .pregate/requests/ proposing an override and tell the user.

**Scope and limits:** File-wide block comments and swapping one suppression for another tool's syntax remain checked. Supported source counts comment tokens, not strings, JSX text, templates, regular expressions or documentation examples. This counts marker occurrences in comments; it does not implement each linter's directive grammar. Unsupported executable source and invalid recovered trees retain conservative substring matching.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "markers": {
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
  "work": "PREGATE anti-evasion policy",
  "locator": "SPEC §10.1 (inline suppression)",
  "paraphrase": "An inline suppression turns a check off at the exact spot where it found a problem; suppressions are a human decision, so the agent does not add new ones."
}
```

### core/EVA-SCOPE-001

Check: [`core/integrity/out-of-scope-file@1.1.0`](../catalog/checks/integrity/out-of-scope-file/check.json). Default severity: **deny**.

Implementation: `placement`. Phases: `pre`, `stop`.

Languages: language-independent change guard. Cardinality: `singleton`. Dimension: `integrity.scope`. Minimum severity: `deny`.

Code outside the evaluated scope is code no invariant protects.

Default parameters: `{"extensions":["","py","pyi","go","rs","java","kt","kts","groovy","scala","clj","cljs","rb","php","cs","swift","ex","exs","erl","dart","lua","pl","r","c","h","cc","cpp","hpp","sql","sh","bash","zsh","fish","ps1","astro"]}`.

**Repair:** Write the code in an in-scope file of a supported language; if that path or language is required, ask the user to change the preset.

**Scope and limits:** Other excluded folders, other programming languages (also with the extension in capitals), or files without an extension inside a layer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "extensions": {
    "type": "array",
    "items": {
      "type": "string",
      "pattern": "^[a-z0-9]*$"
    }
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE anti-evasion policy",
  "locator": "SPEC §8.5.10-11",
  "paraphrase": "New code goes where the rules apply; a new file in an excluded path, or a file in a language without analysis inside a layer, escapes every check."
}
```

## core/software-invariants

Manifest version: `1.2.0`. Status: **preview**.

### core/CORE-INV-001

Check: [`core/invariants/reason-for-change@1.1.0`](../catalog/checks/invariants/reason-for-change/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r001`. Minimum severity: `deny`.

Divide the system by the reason for change, not by the technology. Put in one module the parts that change together for the same reason. Do not mix display logic, decision logic, and storage logic in one module. This requirement divides the system and its modules; the same condition for each unit is CORE-INV-007.

Default parameters: `{"verifier":"CORE-INV-001"}`.

**Repair:** Bind CORE-INV-001 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-001. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 1",
  "paraphrase": "Divide the system by the reason for change, not by the technology. Put in one module the parts that change together for the same reason. Do not mix display logic, decision logic, and storage logic in one module."
}
```

### core/CORE-INV-002

Check: [`core/invariants/cohesion-and-coupling@1.2.0`](../catalog/checks/invariants/cohesion-and-coupling/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r002`. Minimum severity: `warn`.

Keep related parts together. Keep unrelated parts separate. A dependency must be as small as possible. A module must not know the internal parts of another module. A change in one module does not force a change in an unrelated module. The encapsulation clause is CORE-INV-003 and the per-unit division is CORE-INV-007; this requirement owns the cohesion and dependency-size reading, and its size bound stays advisory until the project states a measurable bound.

Default parameters: `{"verifier":"CORE-INV-002"}`.

**Repair:** Bind CORE-INV-002 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-002. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 2; docs/features/core-maintainability-update.md, request 2",
  "paraphrase": "Keep related parts together. Keep unrelated parts separate. A dependency must be as small as possible. A module must not know the internal parts of another module. A change in one module does not force a change in an unrelated module."
}
```

### core/CORE-INV-003

Check: [`core/invariants/information-hiding@1.2.0`](../catalog/checks/invariants/information-hiding/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r003`. Minimum severity: `deny`.

Hide the parts that can change. The public contract must be stable. The representation, the algorithm, the storage, and the supplier must be private. A caller must depend only on the contract. Modules talk only through a stable interface. The product does not expose an internal type on a public boundary. A contract at a boundary is written and current. A public interface has current documentation. The written and current contract and current-documentation clauses are process obligations satisfied by reviewed project evidence, not by source syntax.

Default parameters: `{"verifier":"CORE-INV-003"}`.

**Repair:** Bind CORE-INV-003 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-003. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 3; docs/features/core-maintainability-update.md, request 3; docs/features/core-maintainability-update.md, request 12; docs/features/core-maintainability-update.md, request 13; docs/features/core-maintainability-update.md, request 41",
  "paraphrase": "Hide the parts that can change. The public contract must be stable. The representation, the algorithm, the storage, and the supplier must be private. A caller must depend only on the contract. Modules talk only through a stable interface. The product does not expose an internal type on a public boundary. A contract at a boundary is written and current. A public interface has current documentation."
}
```

### core/CORE-INV-004

Check: [`core/invariants/observable-contract@1.1.0`](../catalog/checks/invariants/observable-contract/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r004`. Minimum severity: `warn`.

Each observable behavior becomes a contract. For this reason, keep each contract small. A caller must not depend on operations that it does not call (CORE-INV-011), and 'small' stays advisory until the project states a measurable bound.

Default parameters: `{"verifier":"CORE-INV-004"}`.

**Repair:** Bind CORE-INV-004 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-004. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 4",
  "paraphrase": "Each observable behavior becomes a contract. For this reason, keep each contract small."
}
```

### core/CORE-INV-005

Check: [`core/invariants/stable-dependencies@1.1.0`](../catalog/checks/invariants/stable-dependencies/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r005`. Minimum severity: `warn`.

Dependencies must point to the stable part. Code that changes frequently must not be a dependency of code that changes rarely. A concrete part that changes must depend on a stable abstraction. Do not do the opposite. Change frequency is measured project evidence; until the project states the stability bound, this requirement is advisory.

Default parameters: `{"verifier":"CORE-INV-005"}`.

**Repair:** Bind CORE-INV-005 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-005. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 5",
  "paraphrase": "Dependencies must point to the stable part. Code that changes frequently must not be a dependency of code that changes rarely. A concrete part that changes must depend on a stable abstraction. Do not do the opposite."
}
```

### core/CORE-INV-006

Check: [`core/invariants/evidenced-abstraction@1.1.0`](../catalog/checks/invariants/evidenced-abstraction/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r006`. Minimum severity: `deny`.

Make an abstraction only when two real implementations exist, or when a change already occurred. The two real implementations, the change that already occurred, and the third real repetition (CORE-INV-026) are one demonstrated need; any one of them establishes it.

Default parameters: `{"verifier":"CORE-INV-006"}`.

**Repair:** Bind CORE-INV-006 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-006. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 6",
  "paraphrase": "Make an abstraction only when two real implementations exist, or when a change already occurred."
}
```

### core/CORE-INV-007

Check: [`core/invariants/single-change-reason@1.2.0`](../catalog/checks/invariants/single-change-reason/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r007`. Minimum severity: `deny`.

Give each unit one reason for change. This rule applies to a function, a module, a process, and a service. If two different forces change the same unit, divide the unit. Each module has one responsibility. A function does one job. The system-level division of the same idea is CORE-INV-001; this requirement owns each unit: a function, a module, a process, and a service.

Default parameters: `{"verifier":"CORE-INV-007"}`.

**Repair:** Bind CORE-INV-007 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-007. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 7; docs/features/core-maintainability-update.md, request 1; docs/features/core-maintainability-update.md, request 45",
  "paraphrase": "Give each unit one reason for change. This rule applies to a function, a module, a process, and a service. If two different forces change the same unit, divide the unit. Each module has one responsibility. A function does one job."
}
```

### core/CORE-INV-008

Check: [`core/invariants/explicit-dependencies@1.0.0`](../catalog/checks/invariants/explicit-dependencies/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r008`. Minimum severity: `deny`.

Make each dependency explicit. Do not use hidden global state. Do not use hidden context. Put the dependency in the signature or in the construction graph. If a dependency is not in the signature, the caller must not use it.

Default parameters: `{"verifier":"CORE-INV-008"}`.

**Repair:** Bind CORE-INV-008 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-008. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 8",
  "paraphrase": "Make each dependency explicit. Do not use hidden global state. Do not use hidden context. Put the dependency in the signature or in the construction graph. If a dependency is not in the signature, the caller must not use it."
}
```

### core/CORE-INV-009

Check: [`core/invariants/collaborator-knowledge@1.1.0`](../catalog/checks/invariants/collaborator-knowledge/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r009`. Minimum severity: `warn`.

A unit must use only the parts that it receives, the parts that it makes, or the parts that it owns. A unit must not go through the internal structure of a collaborator to reach a third unit. This is a heuristic: the target case is a call that goes through a collaborator's internals to reach a third unit; builders, data objects and fluent calls that expose the needed behavior are valid.

Default parameters: `{"verifier":"CORE-INV-009"}`.

**Repair:** Bind CORE-INV-009 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-009. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 9",
  "paraphrase": "A unit must use only the parts that it receives, the parts that it makes, or the parts that it owns. A unit must not go through the internal structure of a collaborator to reach a third unit."
}
```

### core/CORE-INV-010

Check: [`core/invariants/composition@1.1.0`](../catalog/checks/invariants/composition/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r010`. Minimum severity: `warn`.

Use composition to reuse behavior. Do not use an inheritance tree to reuse behavior. Use inheritance only for a real "is-a" relation in the domain that will not break. In a language without implementation inheritance this requirement holds vacuously; inheritance for a real domain is-a relation that will not break remains valid.

Default parameters: `{"verifier":"CORE-INV-010"}`.

**Repair:** Bind CORE-INV-010 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-010. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 10",
  "paraphrase": "Use composition to reuse behavior. Do not use an inheritance tree to reuse behavior. Use inheritance only for a real \"is-a\" relation in the domain that will not break."
}
```

### core/CORE-INV-011

Check: [`core/invariants/narrow-interfaces@1.1.0`](../catalog/checks/invariants/narrow-interfaces/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r011`. Minimum severity: `deny`.

Keep interfaces narrow. A caller must not depend on operations that it does not call. A large contract is coupling. Each observable behavior has a contract, and that contract stays small (CORE-INV-004).

Default parameters: `{"verifier":"CORE-INV-011"}`.

**Repair:** Bind CORE-INV-011 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-011. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 11",
  "paraphrase": "Keep interfaces narrow. A caller must not depend on operations that it does not call. A large contract is coupling."
}
```

### core/CORE-INV-012

Check: [`core/invariants/source-of-truth@1.0.0`](../catalog/checks/invariants/source-of-truth/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r012`. Minimum severity: `deny`.

Keep one source of truth for each fact. This rule applies to knowledge and to decisions. It does not apply to similar text. If two parts change for different reasons, you can duplicate the form.

Default parameters: `{"verifier":"CORE-INV-012"}`.

**Repair:** Bind CORE-INV-012 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-012. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 12",
  "paraphrase": "Keep one source of truth for each fact. This rule applies to knowledge and to decisions. It does not apply to similar text. If two parts change for different reasons, you can duplicate the form."
}
```

### core/CORE-INV-013

Check: [`core/invariants/domain-validation@1.0.0`](../catalog/checks/invariants/domain-validation/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r013`. Minimum severity: `deny`.

Boundary validation can repeat a domain rule. The domain must not depend on the boundary. The domain must keep its own rules.

Default parameters: `{"verifier":"CORE-INV-013"}`.

**Repair:** Bind CORE-INV-013 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-013. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 13",
  "paraphrase": "Boundary validation can repeat a domain rule. The domain must not depend on the boundary. The domain must keep its own rules."
}
```

### core/CORE-INV-014

Check: [`core/invariants/valid-state@1.0.0`](../catalog/checks/invariants/valid-state/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r014`. Minimum severity: `deny`.

Do not make an invalid state possible. The domain must keep its invariants at construction and at each state change. Do not put invariants only in comments. If an order cannot ship with no lines, that state must not exist as a value.

Default parameters: `{"verifier":"CORE-INV-014"}`.

**Repair:** Bind CORE-INV-014 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-014. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 14",
  "paraphrase": "Do not make an invalid state possible. The domain must keep its invariants at construction and at each state change. Do not put invariants only in comments. If an order cannot ship with no lines, that state must not exist as a value."
}
```

### core/CORE-INV-015

Check: [`core/invariants/shared-immutability@1.1.0`](../catalog/checks/invariants/shared-immutability/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r015`. Minimum severity: `deny`.

Use immutable data for shared data. Data that crosses a thread, a process, or a time boundary must be a value. Keep mutation local, explicit, and short. Shared mutable data can cause a race. The product does not share mutable state across a module boundary.

Default parameters: `{"verifier":"CORE-INV-015"}`.

**Repair:** Bind CORE-INV-015 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-015. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 15; docs/features/core-maintainability-update.md, request 5",
  "paraphrase": "Use immutable data for shared data. Data that crosses a thread, a process, or a time boundary must be a value. Keep mutation local, explicit, and short. Shared mutable data can cause a race. The product does not share mutable state across a module boundary."
}
```

### core/CORE-INV-016

Check: [`core/invariants/explicit-time-and-identity@1.0.0`](../catalog/checks/invariants/explicit-time-and-identity/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r016`. Minimum severity: `deny`.

Make time and identity data, not hidden context. Pass "now", "caller", and "version" as arguments or as parts of the message. A result must not depend on a hidden clock or on a hidden singleton.

Default parameters: `{"verifier":"CORE-INV-016"}`.

**Repair:** Bind CORE-INV-016 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-016. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 16",
  "paraphrase": "Make time and identity data, not hidden context. Pass \"now\", \"caller\", and \"version\" as arguments or as parts of the message. A result must not depend on a hidden clock or on a hidden singleton."
}
```

### core/CORE-INV-017

Check: [`core/invariants/command-query-effects@1.0.0`](../catalog/checks/invariants/command-query-effects/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r017`. Minimum severity: `deny`.

Separate a command from a query when the effect is important. An operation that returns a value must not change observable state. An operation that changes state must not be the source of a value that the caller uses to decide. Exception: if the domain action is "reserve and return the quota", the effect and the result are the same decision. Document this exception.

Default parameters: `{"verifier":"CORE-INV-017"}`.

**Repair:** Bind CORE-INV-017 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-017. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 17",
  "paraphrase": "Separate a command from a query when the effect is important. An operation that returns a value must not change observable state. An operation that changes state must not be the source of a value that the caller uses to decide. Exception: if the domain action is \"reserve and return the quota\", the effect and the result are the same decision. Document this exception."
}
```

### core/CORE-INV-018

Check: [`core/invariants/domain-language@1.2.0`](../catalog/checks/invariants/domain-language/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r018`. Minimum severity: `warn`.

Use the domain language for module names, operation names, and data names. Do not use framework names for these items. Keep technical translation at the boundary. A name in a module follows one rule. Names follow the project's declared domain vocabulary; the technical translation boundary is where framework names stay.

Default parameters: `{"verifier":"CORE-INV-018"}`.

**Repair:** Bind CORE-INV-018 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-018. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 18; docs/features/core-maintainability-update.md, request 46",
  "paraphrase": "Use the domain language for module names, operation names, and data names. Do not use framework names for these items. Keep technical translation at the boundary. A name in a module follows one rule."
}
```

### core/CORE-INV-019

Check: [`core/invariants/invariant-failure@1.0.0`](../catalog/checks/invariants/invariant-failure/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r019`. Minimum severity: `deny`.

Fail immediately when an invariant is broken or when the configuration is unknown. Report an impossible state, an unknown flag, or a broken contract at the source. Do not continue with a silent default. A silent default turns a defect into later corruption.

Default parameters: `{"verifier":"CORE-INV-019"}`.

**Repair:** Bind CORE-INV-019 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-019. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 19",
  "paraphrase": "Fail immediately when an invariant is broken or when the configuration is unknown. Report an impossible state, an unknown flag, or a broken contract at the source. Do not continue with a silent default. A silent default turns a defect into later corruption."
}
```

### core/CORE-INV-020

Check: [`core/invariants/failure-classification@1.0.0`](../catalog/checks/invariants/failure-classification/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r020`. Minimum severity: `deny`.

Separate a programmer failure from an expected failure. Stop and record a programmer failure. For an expected failure (timeout, rate limit, network loss, dependency down), use an explicit policy: retry, degrade, or reject. Do not retry a validation error. Do not retry an effect that is not idempotent.

Default parameters: `{"verifier":"CORE-INV-020"}`.

**Repair:** Bind CORE-INV-020 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-020. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 20",
  "paraphrase": "Separate a programmer failure from an expected failure. Stop and record a programmer failure. For an expected failure (timeout, rate limit, network loss, dependency down), use an explicit policy: retry, degrade, or reject. Do not retry a validation error. Do not retry an effect that is not idempotent."
}
```

### core/CORE-INV-021

Check: [`core/invariants/idempotency@1.0.0`](../catalog/checks/invariants/idempotency/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r021`. Minimum severity: `deny`.

Each operation that can run more than one time must be idempotent, or it must have an idempotency key. Queues, webhooks, clients with retry, and jobs that stop in the middle deliver the work at least one time. Do not promise global exactly-once delivery. Build "one effect for this key" with a unique constraint and a stored result.

Default parameters: `{"verifier":"CORE-INV-021"}`.

**Repair:** Bind CORE-INV-021 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-021. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 21",
  "paraphrase": "Each operation that can run more than one time must be idempotent, or it must have an idempotency key. Queues, webhooks, clients with retry, and jobs that stop in the middle deliver the work at least one time. Do not promise global exactly-once delivery. Build \"one effect for this key\" with a unique constraint and a stored result."
}
```

### core/CORE-INV-022

Check: [`core/invariants/remote-call-budget@1.0.0`](../catalog/checks/invariants/remote-call-budget/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r022`. Minimum severity: `deny`.

Do not trust a remote part. Each call outside the process must have a timeout, a retry limit, and a defined behavior when the peer does not answer. Without a timeout, there is no isolation. The failure of the peer becomes your failure.

Default parameters: `{"verifier":"CORE-INV-022"}`.

**Repair:** Bind CORE-INV-022 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-022. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 22",
  "paraphrase": "Do not trust a remote part. Each call outside the process must have a timeout, a retry limit, and a defined behavior when the peer does not answer. Without a timeout, there is no isolation. The failure of the peer becomes your failure."
}
```

### core/CORE-INV-023

Check: [`core/invariants/failure-isolation@1.0.0`](../catalog/checks/invariants/failure-isolation/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r023`. Minimum severity: `deny`.

Do not let a failure cascade. A boundary must isolate the failure with a budget, a bulkhead, a fast reject, or a queue. Do not retry without a limit against a dependency that is down.

Default parameters: `{"verifier":"CORE-INV-023"}`.

**Repair:** Bind CORE-INV-023 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-023. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 23",
  "paraphrase": "Do not let a failure cascade. A boundary must isolate the failure with a budget, a bulkhead, a fast reject, or a queue. Do not retry without a limit against a dependency that is down."
}
```

### core/CORE-INV-024

Check: [`core/invariants/effects-at-boundaries@1.1.0`](../catalog/checks/invariants/effects-at-boundaries/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r024`. Minimum severity: `deny`.

Keep external effects explicit and at the boundary. Do not hide persistence, network, clock, random values, or I/O inside a domain decision. The decision must be a function of data. A different part must apply the effect. Business decisions must have an explicit domain owner; no folder name or architectural style is required. A user-interface adapter must delegate business decisions to their domain owner. A database adapter must apply domain decisions, not own them. The product does not hide a side effect.

Default parameters: `{"verifier":"CORE-INV-024"}`.

**Repair:** Bind CORE-INV-024 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-024. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 24; docs/features/core-maintainability-update.md, request 4; docs/features/core-maintainability-update.md, request 6; docs/features/core-maintainability-update.md, request 7; docs/features/core-maintainability-update.md, request 47",
  "paraphrase": "Keep external effects explicit and at the boundary. Do not hide persistence, network, clock, random values, or I/O inside a domain decision. The decision must be a function of data. A different part must apply the effect. Business rules live in the domain layer. The user interface does not contain a business rule. The database client does not contain a business rule. The product does not hide a side effect."
}
```

### core/CORE-INV-025

Check: [`core/invariants/concurrency-conflicts@1.0.0`](../catalog/checks/invariants/concurrency-conflicts/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r025`. Minimum severity: `deny`.

Name the conflict rule for concurrent writes. Use a total order, a version, a unique constraint, or a commutative operation. "Last write wins" is valid only when the domain says so. Two writers on the same fact with no conflict rule are a defect.

Default parameters: `{"verifier":"CORE-INV-025"}`.

**Repair:** Bind CORE-INV-025 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-025. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 25",
  "paraphrase": "Name the conflict rule for concurrent writes. Use a total order, a version, a unique constraint, or a commutative operation. \"Last write wins\" is valid only when the domain says so. Two writers on the same fact with no conflict rule are a defect."
}
```

### core/CORE-INV-026

Check: [`core/invariants/demonstrated-need@1.1.0`](../catalog/checks/invariants/demonstrated-need/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r026`. Minimum severity: `deny`.

Do not build a part that you cannot show you need. You can use a clear name and a clean boundary. Do not add a second protocol, a plugin system, or an extra layer "for later". Add an abstraction at the third real repetition, or when the change already occurred. The two real implementations (CORE-INV-006) and the already-moved axis (CORE-INV-030) are the same demonstrated need; any one of them establishes it.

Default parameters: `{"verifier":"CORE-INV-026"}`.

**Repair:** Bind CORE-INV-026 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-026. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 26",
  "paraphrase": "Do not build a part that you cannot show you need. You can use a clear name and a clean boundary. Do not add a second protocol, a plugin system, or an extra layer \"for later\". Add an abstraction at the third real repetition, or when the change already occurred."
}
```

### core/CORE-INV-027

Check: [`core/invariants/sufficient-simplicity@1.1.0`](../catalog/checks/invariants/sufficient-simplicity/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r027`. Minimum severity: `warn`.

Use the simplest design that meets the current constraints. Simple means the smallest number of concepts, states, and failure modes. If a simpler design breaks an invariant or a current requirement, that design is incomplete. This requirement and CORE-INV-035 state one decision: the design with the fewest concepts, states, and failure modes that still meets the current constraints.

Default parameters: `{"verifier":"CORE-INV-027"}`.

**Repair:** Bind CORE-INV-027 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-027. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 27",
  "paraphrase": "Use the simplest design that meets the current constraints. Simple means the smallest number of concepts, states, and failure modes. If a simpler design breaks an invariant or a current requirement, that design is incomplete."
}
```

### core/CORE-INV-028

Check: [`core/invariants/replaceable-modules@1.1.0`](../catalog/checks/invariants/replaceable-modules/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r028`. Minimum severity: `deny`.

Design each module so that you can delete it. A replaceable module has a small contract, one owner, and no caller that knows its internal parts. Code that you cannot delete is a cost of change. An external service sits behind an interface. The product can replace that service without a rewrite of the domain.

Default parameters: `{"verifier":"CORE-INV-028"}`.

**Repair:** Bind CORE-INV-028 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-028. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 28; docs/features/core-maintainability-update.md, request 18; docs/features/core-maintainability-update.md, request 19",
  "paraphrase": "Design each module so that you can delete it. A replaceable module has a small contract, one owner, and no caller that knows its internal parts. Code that you cannot delete is a cost of change. An external service sits behind an interface. The product can replace that service without a rewrite of the domain."
}
```

### core/CORE-INV-029

Check: [`core/invariants/vertical-slices@1.2.0`](../catalog/checks/invariants/vertical-slices/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r029`. Minimum severity: `deny`.

Evolve the design with vertical slices, not with complete horizontal layers. Each increment must cross the real path: input, decision, and effect. Keep the fitness tests green. An architecture that exists only in a diagram has already diverged. Tests run before a merge. A fitness check guards each key architecture rule. The keep-fitness-tests-green and tests-before-merge clauses are owned by CORE-INV-044 and CORE-INV-056; this requirement owns the vertical-slice direction.

Default parameters: `{"verifier":"CORE-INV-029"}`.

**Repair:** Bind CORE-INV-029 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-029. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 29; docs/features/core-maintainability-update.md, request 27; docs/features/core-maintainability-update.md, request 30",
  "paraphrase": "Evolve the design with vertical slices, not with complete horizontal layers. Each increment must cross the real path: input, decision, and effect. Keep the fitness tests green. An architecture that exists only in a diagram has already diverged. Tests run before a merge. A fitness check guards each key architecture rule."
}
```

### core/CORE-INV-030

Check: [`core/invariants/observed-change-axis@1.1.0`](../catalog/checks/invariants/observed-change-axis/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r030`. Minimum severity: `deny`.

Prepare for a change only in the direction that you already see. This applies to an axis that already moved, for example the payment supplier or the report schema. Do not turn every part into a strategy for symmetry. This requirement and CORE-INV-026 state one demonstrated need; the moved axis is one of its triggers.

Default parameters: `{"verifier":"CORE-INV-030"}`.

**Repair:** Bind CORE-INV-030 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-030. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 30",
  "paraphrase": "Prepare for a change only in the direction that you already see. This applies to an axis that already moved, for example the payment supplier or the report schema. Do not turn every part into a strategy for symmetry."
}
```

### core/CORE-INV-031

Check: [`core/invariants/explicit-compatibility@1.1.0`](../catalog/checks/invariants/explicit-compatibility/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r031`. Minimum severity: `deny`.

Make compatibility an explicit decision. If you do not control the consumers of a contract, version the contract or add fields. Do not break the contract. If you control all consumers, change and migrate them together. Two truths cost more. An externally consumed public contract must have an explicit version; controlled consumers can migrate together under the original compatibility rule. An incompatible change to an externally consumed public contract must increment its version. An externally consumed public contract must have a written deprecation policy with scope, notice and support windows. The previous externally consumed public version must remain supported throughout its stated deprecation window.

Default parameters: `{"verifier":"CORE-INV-031"}`.

**Repair:** Bind CORE-INV-031 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-031. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 31; docs/features/core-maintainability-update.md, request 8; docs/features/core-maintainability-update.md, request 9; docs/features/core-maintainability-update.md, request 10; docs/features/core-maintainability-update.md, request 11",
  "paraphrase": "Make compatibility an explicit decision. If you do not control the consumers of a contract, version the contract or add fields. Do not break the contract. If you control all consumers, change and migrate them together. Two truths cost more. A public interface has a version. A breaking change increments the version. The product has a written deprecation policy. The product supports the previous public version during the deprecation window."
}
```

### core/CORE-INV-032

Check: [`core/invariants/clear-code@1.1.0`](../catalog/checks/invariants/clear-code/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r032`. Minimum severity: `warn`.

Prefer clear code to clever code. Persons read code more often than they write it. A trick that saves lines and hides an invariant costs more than the obvious form. This requirement is advisory: reading quality is a demonstrated review judgment, not a provable product condition.

Default parameters: `{"verifier":"CORE-INV-032"}`.

**Repair:** Bind CORE-INV-032 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-032. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 32",
  "paraphrase": "Prefer clear code to clever code. Persons read code more often than they write it. A trick that saves lines and hides an invariant costs more than the obvious form."
}
```

### core/CORE-INV-033

Check: [`core/invariants/predictable-names@1.1.0`](../catalog/checks/invariants/predictable-names/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r033`. Minimum severity: `warn`.

The name must predict the behavior. An operation with the name "save" must not send mail, must not recalculate tax, and must not delete rows. Use the domain language to decrease the translation between the business and the code. Name prediction is tested by behavior evidence about what the named operation does, not by the name text.

Default parameters: `{"verifier":"CORE-INV-033"}`.

**Repair:** Bind CORE-INV-033 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-033. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 33",
  "paraphrase": "The name must predict the behavior. An operation with the name \"save\" must not send mail, must not recalculate tax, and must not delete rows. Use the domain language to decrease the translation between the business and the code."
}
```

### core/CORE-INV-034

Check: [`core/invariants/abstraction-level@1.1.0`](../catalog/checks/invariants/abstraction-level/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r034`. Minimum severity: `warn`.

Use one level of abstraction in each unit. A function must not mix business policy, byte arithmetic, SQL, and date format. Mixed levels force the reader to change focus on each line. The level boundary is a reading judgment; the evidence is review, not a metric.

Default parameters: `{"verifier":"CORE-INV-034"}`.

**Repair:** Bind CORE-INV-034 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-034. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 34",
  "paraphrase": "Use one level of abstraction in each unit. A function must not mix business policy, byte arithmetic, SQL, and date format. Mixed levels force the reader to change focus on each line."
}
```

### core/CORE-INV-035

Check: [`core/invariants/least-power@1.1.0`](../catalog/checks/invariants/least-power/check.json). Default severity: **warn**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r035`. Minimum severity: `warn`.

Use the least powerful mechanism that solves the problem. A general rule engine for two conditions is borrowed complexity. This requirement and CORE-INV-027 state one decision: use the least powerful mechanism that meets the current constraints.

Default parameters: `{"verifier":"CORE-INV-035"}`.

**Repair:** Bind CORE-INV-035 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-035. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 35",
  "paraphrase": "Use the least powerful mechanism that solves the problem. A general rule engine for two conditions is borrowed complexity."
}
```

### core/CORE-INV-036

Check: [`core/invariants/named-policies@1.2.0`](../catalog/checks/invariants/named-policies/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r036`. Minimum severity: `deny`.

Give each constant and each policy a name and a location. A magic number, an inline timeout, or a threshold copied in four places is a decision with no owner. Keep the policy in one place and inject it. The product does not hard-code an environment value in source. Configuration is separate from code. A single literal whose meaning is obvious where it is used is not a policy; the hard-coded environment and configuration clause is the enforced condition, and repeated unnamed thresholds stay advisory.

Default parameters: `{"verifier":"CORE-INV-036"}`.

**Repair:** Bind CORE-INV-036 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-036. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 36; docs/features/core-maintainability-update.md, request 24; docs/features/core-maintainability-update.md, request 34",
  "paraphrase": "Give each constant and each policy a name and a location. A magic number, an inline timeout, or a threshold copied in four places is a decision with no owner. Keep the policy in one place and inject it. The product does not hard-code an environment value in source. Configuration is separate from code."
}
```

### core/CORE-INV-037

Check: [`core/invariants/dead-code@1.1.0`](../catalog/checks/invariants/dead-code/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r037`. Minimum severity: `deny`.

Delete dead code and dead configuration paths. A branch that no one activates is a defect surface and a reading cost. If you cannot delete it, a dependency exists. Make that dependency explicit. Dead code is removed.

Default parameters: `{"verifier":"CORE-INV-037"}`.

**Repair:** Bind CORE-INV-037 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-037. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 37; docs/features/core-maintainability-update.md, request 44",
  "paraphrase": "Delete dead code and dead configuration paths. A branch that no one activates is a defect surface and a reading cost. If you cannot delete it, a dependency exists. Make that dependency explicit. Dead code is removed."
}
```

### core/CORE-INV-038

Check: [`core/invariants/minimum-privilege@1.0.0`](../catalog/checks/invariants/minimum-privilege/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r038`. Minimum severity: `deny`.

Give the minimum privilege by default. A component, a credential, or a user must receive only the access that the operation needs. The default must be closed. An open permission must be a recorded decision.

Default parameters: `{"verifier":"CORE-INV-038"}`.

**Repair:** Bind CORE-INV-038 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-038. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 38",
  "paraphrase": "Give the minimum privilege by default. A component, a credential, or a user must receive only the access that the operation needs. The default must be closed. An open permission must be a recorded decision."
}
```

### core/CORE-INV-039

Check: [`core/invariants/boundary-validation@1.0.0`](../catalog/checks/invariants/boundary-validation/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r039`. Minimum severity: `deny`.

Do not trust input that crosses a boundary. Validate each external data item at the boundary: shape, range, size, and encoding. External sources are the user, the queue, the file, and the other service. The internal part can assume admitted data, and it must still keep its invariants.

Default parameters: `{"verifier":"CORE-INV-039"}`.

**Repair:** Bind CORE-INV-039 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-039. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 39",
  "paraphrase": "Do not trust input that crosses a boundary. Validate each external data item at the boundary: shape, range, size, and encoding. External sources are the user, the queue, the file, and the other service. The internal part can assume admitted data, and it must still keep its invariants."
}
```

### core/CORE-INV-040

Check: [`core/invariants/secret-isolation@1.1.0`](../catalog/checks/invariants/secret-isolation/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r040`. Minimum severity: `deny`.

Do not put secrets in the code or in the log. Credentials, tokens, and keys must come from a configuration channel that is separate from the artifact. A log must not write a payload that can contain a secret. A secret does not live in source code.

Default parameters: `{"verifier":"CORE-INV-040"}`.

**Repair:** Bind CORE-INV-040 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-040. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 40; docs/features/core-maintainability-update.md, request 48",
  "paraphrase": "Do not put secrets in the code or in the log. Credentials, tokens, and keys must come from a configuration channel that is separate from the artifact. A log must not write a payload that can contain a secret. A secret does not live in source code."
}
```

### core/CORE-INV-041

Check: [`core/invariants/decision-authorization@1.0.0`](../catalog/checks/invariants/decision-authorization/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r041`. Minimum severity: `deny`.

Do authorization on the server that makes the decision, not on the screen. A hidden button is not access control. The operation that changes state must check identity, scope, and state again.

Default parameters: `{"verifier":"CORE-INV-041"}`.

**Repair:** Bind CORE-INV-041 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-041. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 41",
  "paraphrase": "Do authorization on the server that makes the decision, not on the screen. A hidden button is not access control. The operation that changes state must check identity, scope, and state again."
}
```

### core/CORE-INV-042

Check: [`core/invariants/closed-failure@1.0.0`](../catalog/checks/invariants/closed-failure/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r042`. Minimum severity: `deny`.

Fail closed. If authentication, authorization, or integrity is not certain, the operation must not occur. A permissive default turns a configuration defect into an incident.

Default parameters: `{"verifier":"CORE-INV-042"}`.

**Repair:** Bind CORE-INV-042 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-042. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 42",
  "paraphrase": "Fail closed. If authentication, authorization, or integrity is not certain, the operation must not occur. A permissive default turns a configuration defect into an incident."
}
```

### core/CORE-INV-043

Check: [`core/invariants/boundary-observability@1.1.0`](../catalog/checks/invariants/boundary-observability/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r043`. Minimum severity: `deny`.

If you cannot observe a behavior, you cannot operate it. Each relevant boundary must emit the data that answers these questions: what occurred, to whom, with which result, and in which time. Emit a correlation identity, the decision, and the error class. A log of all data is not observation. It is noise. A failure writes a structured log. The product measures latency, errors, and saturation.

Default parameters: `{"verifier":"CORE-INV-043"}`.

**Repair:** Bind CORE-INV-043 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-043. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 43; docs/features/core-maintainability-update.md, request 36; docs/features/core-maintainability-update.md, request 37",
  "paraphrase": "If you cannot observe a behavior, you cannot operate it. Each relevant boundary must emit the data that answers these questions: what occurred, to whom, with which result, and in which time. Emit a correlation identity, the decision, and the error class. A log of all data is not observation. It is noise. A failure writes a structured log. The product measures latency, errors, and saturation."
}
```

### core/CORE-INV-044

Check: [`core/invariants/isolated-verification@1.1.0`](../catalog/checks/invariants/isolated-verification/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r044`. Minimum severity: `deny`.

You must be able to assert behavior without the full system. Test a domain decision with data. Test a boundary against the contract. A module that you can verify only in a full environment has no boundary. Each critical path has an automated test.

Default parameters: `{"verifier":"CORE-INV-044"}`.

**Repair:** Bind CORE-INV-044 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-044. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 44; docs/features/core-maintainability-update.md, request 26",
  "paraphrase": "You must be able to assert behavior without the full system. Test a domain decision with data. Test a boundary against the contract. A module that you can verify only in a full environment has no boundary. Each critical path has an automated test."
}
```

### core/CORE-INV-045

Check: [`core/invariants/startup-validation@1.0.0`](../catalog/checks/invariants/startup-validation/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r045`. Minimum severity: `deny`.

Invalid configuration must stop the start. An unknown value, a bad port, or a missing secret must stop the boot. A start with silent defaults that fails after one hour is an announced incident.

Default parameters: `{"verifier":"CORE-INV-045"}`.

**Repair:** Bind CORE-INV-045 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-045. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 45",
  "paraphrase": "Invalid configuration must stop the start. An unknown value, a bad port, or a missing secret must stop the boot. A start with silent defaults that fails after one hour is an announced incident."
}
```

### core/CORE-INV-046

Check: [`core/invariants/latency-isolation@1.0.0`](../catalog/checks/invariants/latency-isolation/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r046`. Minimum severity: `deny`.

Slow work must not block the fast path. An operation with a latency budget must not do unbounded I/O, unbounded calculation, or a wait for a report. Separate the work by budget.

Default parameters: `{"verifier":"CORE-INV-046"}`.

**Repair:** Bind CORE-INV-046 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-046. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 46",
  "paraphrase": "Slow work must not block the fast path. An operation with a latency budget must not do unbounded I/O, unbounded calculation, or a wait for a report. Separate the work by budget."
}
```

### core/CORE-INV-047

Check: [`core/invariants/resource-budgets@1.1.0`](../catalog/checks/invariants/resource-budgets/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r047`. Minimum severity: `deny`.

Put cost in a budget, not in a hope. CPU, memory, connections, payload size, and query cardinality must have an explicit limit. An unbounded query is a capacity incident that waits for traffic. A measured bottleneck must be scalable without rewriting domain decisions or unrelated modules. Preserve contracts and budgets; do not add speculative distribution.

Default parameters: `{"verifier":"CORE-INV-047"}`.

**Repair:** Bind CORE-INV-047 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-047. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 47; docs/features/core-maintainability-update.md, request 35",
  "paraphrase": "Put cost in a budget, not in a hope. CPU, memory, connections, payload size, and query cardinality must have an explicit limit. An unbounded query is a capacity incident that waits for traffic. The product can scale a bottleneck without a full rewrite."
}
```

### core/CORE-INV-048

Check: [`core/invariants/repeatable-migrations@1.1.0`](../catalog/checks/invariants/repeatable-migrations/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r048`. Minimum severity: `deny`.

A data migration is part of the change. If the contract or the schema changes, a forward path must exist. If external consumers exist, a compatibility path must also exist. You must be able to run the path more than one time without corruption. A schema change has a migration. A migration is reversible, or the plan states that it is forward-only. The product can read old data during a rollout.

Default parameters: `{"verifier":"CORE-INV-048"}`.

**Repair:** Bind CORE-INV-048 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-048. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/inputs/core-invariants-48.md, rule 48; docs/features/core-maintainability-update.md, request 21; docs/features/core-maintainability-update.md, request 22; docs/features/core-maintainability-update.md, request 23",
  "paraphrase": "A data migration is part of the change. If the contract or the schema changes, a forward path must exist. If external consumers exist, a compatibility path must also exist. You must be able to run the path more than one time without corruption. A schema change has a migration. A migration is reversible, or the plan states that it is forward-only. The product can read old data during a rollout."
}
```

### core/CORE-INV-049

Check: [`core/invariants/pinned-dependencies@1.2.0`](../catalog/checks/invariants/pinned-dependencies/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r049`. Minimum severity: `deny`.

Each resolved dependency version must be pinned through the ecosystem's explicit manifest or dependency lock. A committed dependency lock that records each resolved version satisfies the pin; a manifest range without a committed lock does not.

Default parameters: `{"verifier":"CORE-INV-049"}`.

**Repair:** Bind CORE-INV-049 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-049. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 14",
  "paraphrase": "The product pins each dependency version."
}
```

### core/CORE-INV-050

Check: [`core/invariants/locked-build@1.1.0`](../catalog/checks/invariants/locked-build/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r050`. Minimum severity: `deny`.

The build must use the ecosystem's committed dependency lock or equivalent deterministic dependency record; a locked rebuild must preserve resolution.

Default parameters: `{"verifier":"CORE-INV-050"}`.

**Repair:** Bind CORE-INV-050 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-050. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 15",
  "paraphrase": "The build uses a lockfile."
}
```

### core/CORE-INV-051

Check: [`core/invariants/dependency-update-schedule@1.2.0`](../catalog/checks/invariants/dependency-update-schedule/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r051`. Minimum severity: `deny`.

Dependencies must be updated on an owned, stated schedule, with dated update records. This is a process obligation: the stated schedule and its dated update records are the evidence, not source code.

Default parameters: `{"verifier":"CORE-INV-051"}`.

**Repair:** Bind CORE-INV-051 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-051. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 16",
  "paraphrase": "The product updates dependencies on a stated schedule."
}
```

### core/CORE-INV-052

Check: [`core/invariants/vulnerability-fix-window@1.1.0`](../catalog/checks/invariants/vulnerability-fix-window/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r052`. Minimum severity: `deny`.

The build must reject a known high-risk dependency defect after the project's stated fix window. Use dated authoritative vulnerability evidence.

Default parameters: `{"verifier":"CORE-INV-052"}`.

**Repair:** Bind CORE-INV-052 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-052. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 17",
  "paraphrase": "The build fails if a known high-risk defect stays past the fix window."
}
```

### core/CORE-INV-053

Check: [`core/invariants/supported-runtime@1.1.0`](../catalog/checks/invariants/supported-runtime/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r053`. Minimum severity: `deny`.

The product must use a supported runtime. Verify declared versions against dated authoritative support evidence.

Default parameters: `{"verifier":"CORE-INV-053"}`.

**Repair:** Bind CORE-INV-053 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-053. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 20",
  "paraphrase": "The product does not depend on an unsupported runtime."
}
```

### core/CORE-INV-054

Check: [`core/invariants/standard-value-facilities@1.2.0`](../catalog/checks/invariants/standard-value-facilities/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r054`. Minimum severity: `deny`.

Time, money and locale must use supported standard facilities appropriate to precision, time zones and locale. Do not add a dependency when supported ecosystem facilities satisfy the requirement. An equivalent reviewed library is valid when the platform's standard facilities lack the needed precision or locale data; reimplementing those semantics by hand is not.

Default parameters: `{"verifier":"CORE-INV-054"}`.

**Repair:** Bind CORE-INV-054 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-054. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 25",
  "paraphrase": "Time, money, and locale use a standard library."
}
```

### core/CORE-INV-055

Check: [`core/invariants/defect-regression@1.1.0`](../catalog/checks/invariants/defect-regression/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r055`. Minimum severity: `deny`.

A defect fix adds a test that fails before the fix.

Default parameters: `{"verifier":"CORE-INV-055"}`.

**Repair:** Bind CORE-INV-055 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-055. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 28",
  "paraphrase": "A defect fix adds a test that fails before the fix."
}
```

### core/CORE-INV-056

Check: [`core/invariants/static-analysis-merge-gate@1.1.0`](../catalog/checks/invariants/static-analysis-merge-gate/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r056`. Minimum severity: `deny`.

Static analysis runs before a merge.

Default parameters: `{"verifier":"CORE-INV-056"}`.

**Repair:** Bind CORE-INV-056 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-056. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 29",
  "paraphrase": "Static analysis runs before a merge."
}
```

### core/CORE-INV-057

Check: [`core/invariants/release-rollback@1.1.0`](../catalog/checks/invariants/release-rollback/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r057`. Minimum severity: `deny`.

A release has a rollback.

Default parameters: `{"verifier":"CORE-INV-057"}`.

**Repair:** Bind CORE-INV-057 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-057. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 31",
  "paraphrase": "A release has a rollback."
}
```

### core/CORE-INV-058

Check: [`core/invariants/controlled-risk-flags@1.2.0`](../catalog/checks/invariants/controlled-risk-flags/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r058`. Minimum severity: `deny`.

An identified risky feature must have a controlled safe-release flag with tested enable and disable behavior. Do not introduce speculative flags without a relevant risk. A feature is risky here when it is hard to reverse after release or it exposes new behavior to users; a feature that can be deleted safely does not need a flag.

Default parameters: `{"verifier":"CORE-INV-058"}`.

**Repair:** Bind CORE-INV-058 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-058. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 32",
  "paraphrase": "A risky feature can ship behind a flag."
}
```

### core/CORE-INV-059

Check: [`core/invariants/automated-deployment@1.1.0`](../catalog/checks/invariants/automated-deployment/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r059`. Minimum severity: `deny`.

A deployment is automated.

Default parameters: `{"verifier":"CORE-INV-059"}`.

**Repair:** Bind CORE-INV-059 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-059. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 33",
  "paraphrase": "A deployment is automated."
}
```

### core/CORE-INV-060

Check: [`core/invariants/operational-runbooks@1.1.0`](../catalog/checks/invariants/operational-runbooks/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r060`. Minimum severity: `deny`.

A common operational task has a runbook.

Default parameters: `{"verifier":"CORE-INV-060"}`.

**Repair:** Bind CORE-INV-060 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-060. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 38",
  "paraphrase": "A common operational task has a runbook."
}
```

### core/CORE-INV-061

Check: [`core/invariants/alert-ownership@1.1.0`](../catalog/checks/invariants/alert-ownership/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r061`. Minimum severity: `deny`.

An alert has an owner.

Default parameters: `{"verifier":"CORE-INV-061"}`.

**Repair:** Bind CORE-INV-061 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-061. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 39",
  "paraphrase": "An alert has an owner."
}
```

### core/CORE-INV-062

Check: [`core/invariants/architecture-decision-record@1.1.0`](../catalog/checks/invariants/architecture-decision-record/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r062`. Minimum severity: `deny`.

An architecture decision has a written record and a reason.

Default parameters: `{"verifier":"CORE-INV-062"}`.

**Repair:** Bind CORE-INV-062 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-062. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 40",
  "paraphrase": "An architecture decision has a written record and a reason."
}
```

### core/CORE-INV-063

Check: [`core/invariants/reproducible-onboarding@1.1.0`](../catalog/checks/invariants/reproducible-onboarding/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r063`. Minimum severity: `deny`.

A new engineer can build and run the product from the written steps.

Default parameters: `{"verifier":"CORE-INV-063"}`.

**Repair:** Bind CORE-INV-063 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-063. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 42",
  "paraphrase": "A new engineer can build and run the product from the written steps."
}
```

### core/CORE-INV-064

Check: [`core/invariants/debt-ownership@1.1.0`](../catalog/checks/invariants/debt-ownership/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `invariant.r064`. Minimum severity: `deny`.

Technical debt has an owner and a target date.

Default parameters: `{"verifier":"CORE-INV-064"}`.

**Repair:** Bind CORE-INV-064 to a project fitness function that tests every applicable condition in this requirement and documents its coverage and invalid controls. Review the binding as a contract change, then run pregate fitness run CORE-INV-064. Repair a failed verification. For dated runtime, vulnerability or operational facts, review an explicit maxAgeMs and inspect current authoritative evidence. A human can explicitly disable the requirement if it does not apply.

**Scope and limits:** A passing unrelated test, stale receipts, silence or a syntax-only approximation do not prove the full requirement. Verification is bounded by the human-reviewed command and rationale; inspect what it tests. Missing verification is unverified, not compliant. Packs never supply executable fitness commands.

Check-specific parameter schema (project fitness cannot be narrowed with per-file `paths`, `exclude` or `within`):

```json
{
  "verifier": {
    "type": "string",
    "pattern": "\\S"
  }
}
```

Source metadata:

```json
{
  "work": "User-supplied software and maintainability invariants",
  "locator": "docs/features/core-maintainability-update.md, request 43",
  "paraphrase": "Technical debt has an owner and a target date."
}
```
