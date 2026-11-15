# agent-practices pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **practice**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## agent-practices/behavior-testing

Manifest version: `1.0.0`. Status: **preview**.

### agent-practices/PRACTICE-017

Check: [`agent-practices/behavior-testing/requirement-017@1.0.0`](checks/behavior-testing/requirement-017/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r017`. Minimum severity: `deny`.

Before implementing nontrivial behavior, define its observable acceptance cases and expected failures; use those cases to guide the implementation rather than deriving expectations from the finished code, without forbidding later tests that close a real gap.

Default parameters: `{"verifier":"PRACTICE-017"}`.

**Repair:** Bind PRACTICE-017 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-017; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied testing-strategy post, adapted to behavioral verification and applicable test scope",
  "locator": "docs/features/agent-practices-pack.md, rule 17; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Before implementing nontrivial behavior, define its observable acceptance cases and expected failures; use those cases to guide the implementation rather than deriving expectations from the finished code, without forbidding later tests that close a real gap."
}
```

### agent-practices/PRACTICE-018

Check: [`agent-practices/behavior-testing/requirement-018@1.0.0`](checks/behavior-testing/requirement-018/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r018`. Minimum severity: `deny`.

Before designing tests for an isolated subsystem, enumerate credible boundary, dependency, invalid-input and state-transition failures and map the applicable risks to assertions before implementing it.

Default parameters: `{"verifier":"PRACTICE-018"}`.

**Repair:** Bind PRACTICE-018 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-018; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied testing-strategy post, adapted to behavioral verification and applicable test scope",
  "locator": "docs/features/agent-practices-pack.md, rule 18; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Before designing tests for an isolated subsystem, enumerate credible boundary, dependency, invalid-input and state-transition failures and map the applicable risks to assertions before implementing it."
}
```

### agent-practices/PRACTICE-019

Check: [`agent-practices/behavior-testing/requirement-019@1.0.0`](checks/behavior-testing/requirement-019/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r019`. Minimum severity: `deny`.

Complex integrated features must be verified primarily through representative end-to-end user or system scenarios with realistic state, multiple steps and relevant failure/retry cases; focused unit and integration tests remain appropriate for isolated contracts.

Default parameters: `{"verifier":"PRACTICE-019"}`.

**Repair:** Bind PRACTICE-019 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-019; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied testing-strategy post, adapted to behavioral verification and applicable test scope",
  "locator": "docs/features/agent-practices-pack.md, rule 19; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Complex integrated features must be verified primarily through representative end-to-end user or system scenarios with realistic state, multiple steps and relevant failure/retry cases; focused unit and integration tests remain appropriate for isolated contracts."
}
```

### agent-practices/PRACTICE-020

Check: [`agent-practices/behavior-testing/requirement-020@1.0.0`](checks/behavior-testing/requirement-020/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r020`. Minimum severity: `deny`.

End-to-end verification must emit a reviewable sanitized artifact containing results, revision, environment and replay inputs/commands, with traces or logs sufficient to reproduce failures without exposing secrets or personal data.

Default parameters: `{"verifier":"PRACTICE-020"}`.

**Repair:** Bind PRACTICE-020 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-020; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied testing-strategy post, adapted to behavioral verification and applicable test scope",
  "locator": "docs/features/agent-practices-pack.md, rule 20; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "End-to-end verification must emit a reviewable sanitized artifact containing results, revision, environment and replay inputs/commands, with traces or logs sufficient to reproduce failures without exposing secrets or personal data."
}
```

### agent-practices/PRACTICE-021

Check: [`agent-practices/behavior-testing/requirement-021@1.0.0`](checks/behavior-testing/requirement-021/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r021`. Minimum severity: `deny`.

Tests must assert independently specified observable behavior and react to relevant behavioral faults; self-comparisons, duplicated production calculations and implementation-only change detectors must not stand in for behavioral verification.

Default parameters: `{"verifier":"PRACTICE-021"}`.

**Repair:** Bind PRACTICE-021 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-021; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied testing-strategy post, adapted to behavioral verification and applicable test scope",
  "locator": "docs/features/agent-practices-pack.md, rule 21; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Tests must assert independently specified observable behavior and react to relevant behavioral faults; self-comparisons, duplicated production calculations and implementation-only change detectors must not stand in for behavioral verification."
}
```

### agent-practices/PRACTICE-022

Check: [`agent-practices/behavior-testing/requirement-022@1.0.0`](checks/behavior-testing/requirement-022/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r022`. Minimum severity: `deny`.

A bug fix must demonstrate the original failure and its corrected behavior using existing behavioral coverage where sufficient; add a focused regression test only when that coverage leaves a documented real gap.

Default parameters: `{"verifier":"PRACTICE-022"}`.

**Repair:** Bind PRACTICE-022 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-022; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied testing-strategy post, adapted to behavioral verification and applicable test scope",
  "locator": "docs/features/agent-practices-pack.md, rule 22; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "A bug fix must demonstrate the original failure and its corrected behavior using existing behavioral coverage where sufficient; add a focused regression test only when that coverage leaves a documented real gap."
}
```

## agent-practices/domain-ownership

Manifest version: `1.0.0`. Status: **preview**.

### agent-practices/PRACTICE-013

Check: [`agent-practices/domain-ownership/requirement-013@1.0.0`](checks/domain-ownership/requirement-013/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r013`. Minimum severity: `deny`.

Each business rule must have one declared owning domain module and rules document, and new callers must use that owner; a new owner requires an explicit domain-boundary justification rather than a dependency-cycle workaround.

Default parameters: `{"verifier":"PRACTICE-013"}`.

**Repair:** Bind PRACTICE-013 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-013; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied AGENTS.md design post, hard invariants 10–12 and refactor-first workflow",
  "locator": "docs/features/agent-practices-pack.md, rule 13; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Each business rule must have one declared owning domain module and rules document, and new callers must use that owner; a new owner requires an explicit domain-boundary justification rather than a dependency-cycle workaround."
}
```

### agent-practices/PRACTICE-014

Check: [`agent-practices/domain-ownership/requirement-014@1.0.0`](checks/domain-ownership/requirement-014/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r014`. Minimum severity: `deny`.

Cross-module access to a domain's state, tables and caches must go through its public contracts; domain operations must accept and return plain domain values without importing delivery-framework request, response or template objects.

Default parameters: `{"verifier":"PRACTICE-014"}`.

**Repair:** Bind PRACTICE-014 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-014; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied AGENTS.md design post, hard invariants 10–12 and refactor-first workflow",
  "locator": "docs/features/agent-practices-pack.md, rule 14; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Cross-module access to a domain's state, tables and caches must go through its public contracts; domain operations must accept and return plain domain values without importing delivery-framework request, response or template objects."
}
```

### agent-practices/PRACTICE-015

Check: [`agent-practices/domain-ownership/requirement-015@1.0.0`](checks/domain-ownership/requirement-015/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r015`. Minimum severity: `deny`.

Before introducing a second use of a business rule, schema fact or repeated UI piece, identify its existing copies and consolidate the affected callers in a separately verifiable behavior-preserving stage; preserve guards, rounding and clamps and document any remaining copies before changing behavior.

Default parameters: `{"verifier":"PRACTICE-015"}`.

**Repair:** Bind PRACTICE-015 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-015; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied AGENTS.md design post, hard invariants 10–12 and refactor-first workflow",
  "locator": "docs/features/agent-practices-pack.md, rule 15; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Before introducing a second use of a business rule, schema fact or repeated UI piece, identify its existing copies and consolidate the affected callers in a separately verifiable behavior-preserving stage; preserve guards, rounding and clamps and document any remaining copies before changing behavior."
}
```

### agent-practices/PRACTICE-016

Check: [`agent-practices/domain-ownership/requirement-016@1.0.0`](checks/domain-ownership/requirement-016/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r016`. Minimum severity: `deny`.

Templates, client presentation code, routes and view builders must display or orchestrate values supplied by the domain owner instead of independently computing business prices, classifications or access decisions; authoritative access decisions must be enforced at a trusted server boundary.

Default parameters: `{"verifier":"PRACTICE-016"}`.

**Repair:** Bind PRACTICE-016 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-016; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied AGENTS.md design post, hard invariants 10–12 and refactor-first workflow",
  "locator": "docs/features/agent-practices-pack.md, rule 16; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Templates, client presentation code, routes and view builders must display or orchestrate values supplied by the domain owner instead of independently computing business prices, classifications or access decisions; authoritative access decisions must be enforced at a trusted server boundary."
}
```

## agent-practices/launch-safety

Manifest version: `1.0.0`. Status: **preview**.

### agent-practices/PRACTICE-001

Check: [`agent-practices/launch-safety/requirement-001@1.0.0`](checks/launch-safety/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r001`. Minimum severity: `deny`.

Before collecting personal data in signup, the product must have a reviewed audience and jurisdiction assessment and enforce any applicable child-access restrictions or parental-consent requirements at the server boundary; an age gate alone must not be treated as COPPA compliance.

Default parameters: `{"verifier":"PRACTICE-001"}`.

**Repair:** Bind PRACTICE-001 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-001; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied launch-risk post, qualified by the authoritative sources and selected privacy policies in the feature document",
  "locator": "docs/features/agent-practices-pack.md, rule 1; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Before collecting personal data in signup, the product must have a reviewed audience and jurisdiction assessment and enforce any applicable child-access restrictions or parental-consent requirements at the server boundary; an age gate alone must not be treated as COPPA compliance."
}
```

### agent-practices/PRACTICE-002

Check: [`agent-practices/launch-safety/requirement-002@1.0.0`](checks/launch-safety/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r002`. Minimum severity: `deny`.

Browser font delivery must use self-hosted assets by default; any third-party font requests must have an explicit reviewed privacy/transfer basis and matching disclosures, verified against the built application's actual network traffic.

Default parameters: `{"verifier":"PRACTICE-002"}`.

**Repair:** Bind PRACTICE-002 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-002; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied launch-risk post, qualified by the authoritative sources and selected privacy policies in the feature document",
  "locator": "docs/features/agent-practices-pack.md, rule 2; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Browser font delivery must use self-hosted assets by default; any third-party font requests must have an explicit reviewed privacy/transfer basis and matching disclosures, verified against the built application's actual network traffic."
}
```

### agent-practices/PRACTICE-003

Check: [`agent-practices/launch-safety/requirement-003@1.0.0`](checks/launch-safety/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r003`. Minimum severity: `deny`.

Session replay must remain disabled unless its actual collection has been reviewed; enabled replay must enforce the applicable consent policy before capture, stop on withdrawal and exclude sensitive inputs and payloads, including dynamically added fields.

Default parameters: `{"verifier":"PRACTICE-003"}`.

**Repair:** Bind PRACTICE-003 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-003; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied launch-risk post, qualified by the authoritative sources and selected privacy policies in the feature document",
  "locator": "docs/features/agent-practices-pack.md, rule 3; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Session replay must remain disabled unless its actual collection has been reviewed; enabled replay must enforce the applicable consent policy before capture, stop on withdrawal and exclude sensitive inputs and payloads, including dynamically added fields."
}
```

### agent-practices/PRACTICE-004

Check: [`agent-practices/launch-safety/requirement-004@1.0.0`](checks/launch-safety/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r004`. Minimum severity: `deny`.

Every commercial email must include the applicable sender identification, valid postal address and working opt-out mechanism, and deliveries must honor suppression within the applicable deadline; transactional classification must match the actual content.

Default parameters: `{"verifier":"PRACTICE-004"}`.

**Repair:** Bind PRACTICE-004 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-004; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied launch-risk post, qualified by the authoritative sources and selected privacy policies in the feature document",
  "locator": "docs/features/agent-practices-pack.md, rule 4; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Every commercial email must include the applicable sender identification, valid postal address and working opt-out mechanism, and deliveries must honor suppression within the applicable deadline; transactional classification must match the actual content."
}
```

### agent-practices/PRACTICE-005

Check: [`agent-practices/launch-safety/requirement-005@1.0.0`](checks/launch-safety/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r005`. Minimum severity: `deny`.

Subscription checkout must show the price, billing interval, renewal and trial-conversion terms clearly beside the request for consent, record the required affirmative acceptance and provide the applicable cancellation and renewal-notice behavior.

Default parameters: `{"verifier":"PRACTICE-005"}`.

**Repair:** Bind PRACTICE-005 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-005; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied launch-risk post, qualified by the authoritative sources and selected privacy policies in the feature document",
  "locator": "docs/features/agent-practices-pack.md, rule 5; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Subscription checkout must show the price, billing interval, renewal and trial-conversion terms clearly beside the request for consent, record the required affirmative acceptance and provide the applicable cancellation and renewal-notice behavior."
}
```

### agent-practices/PRACTICE-006

Check: [`agent-practices/launch-safety/requirement-006@1.0.0`](checks/launch-safety/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r006`. Minimum severity: `deny`.

When a user-content service relies on a DMCA safe harbor requiring an agent, it must have a reviewed applicability decision, current agent designation and public contact, plus the applicable notice/takedown and repeat-infringer process; registration alone must not be treated as safe-harbor certification.

Default parameters: `{"verifier":"PRACTICE-006"}`.

**Repair:** Bind PRACTICE-006 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-006; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied launch-risk post, qualified by the authoritative sources and selected privacy policies in the feature document",
  "locator": "docs/features/agent-practices-pack.md, rule 6; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "When a user-content service relies on a DMCA safe harbor requiring an agent, it must have a reviewed applicability decision, current agent designation and public contact, plus the applicable notice/takedown and repeat-infringer process; registration alone must not be treated as safe-harbor certification."
}
```

## agent-practices/security-review

Manifest version: `1.0.0`. Status: **preview**.

### agent-practices/PRACTICE-007

Check: [`agent-practices/security-review/requirement-007@1.0.0`](checks/security-review/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r007`. Minimum severity: `deny`.

A scoped security review must use a threat model tied to the current code and deployment assumptions, identifying protected assets, trust boundaries, entry points and attacker capabilities before prioritizing vulnerability research.

Default parameters: `{"verifier":"PRACTICE-007"}`.

**Repair:** Bind PRACTICE-007 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-007; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Google Mantis README and reproduce/patch skills at 2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80; https://github.com/google/mantis/tree/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80",
  "locator": "docs/features/agent-practices-pack.md, rule 7; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "A scoped security review must use a threat model tied to the current code and deployment assumptions, identifying protected assets, trust boundaries, entry points and attacker capabilities before prioritizing vulnerability research."
}
```

### agent-practices/PRACTICE-008

Check: [`agent-practices/security-review/requirement-008@1.0.0`](checks/security-review/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r008`. Minimum severity: `deny`.

Each candidate security finding must be triaged against a reachable code path and explicit exploit preconditions, with evidence, impact and uncertainty reviewed before it is labeled confirmed; failed reproduction alone must not label it a false positive.

Default parameters: `{"verifier":"PRACTICE-008"}`.

**Repair:** Bind PRACTICE-008 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-008; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Google Mantis README and reproduce/patch skills at 2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80; https://github.com/google/mantis/tree/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80",
  "locator": "docs/features/agent-practices-pack.md, rule 8; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Each candidate security finding must be triaged against a reachable code path and explicit exploit preconditions, with evidence, impact and uncertainty reviewed before it is labeled confirmed; failed reproduction alone must not label it a false positive."
}
```

### agent-practices/PRACTICE-009

Check: [`agent-practices/security-review/requirement-009@1.0.0`](checks/security-review/requirement-009/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r009`. Minimum severity: `deny`.

Generated exploit and patch-verification code must execute only in an isolated restricted environment with synthetic data, no production credentials or sensitive host access, and explicitly bounded filesystem, network and resource permissions.

Default parameters: `{"verifier":"PRACTICE-009"}`.

**Repair:** Bind PRACTICE-009 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-009; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Google Mantis README and reproduce/patch skills at 2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80; https://github.com/google/mantis/tree/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80",
  "locator": "docs/features/agent-practices-pack.md, rule 9; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Generated exploit and patch-verification code must execute only in an isolated restricted environment with synthetic data, no production credentials or sensitive host access, and explicitly bounded filesystem, network and resource permissions."
}
```

### agent-practices/PRACTICE-010

Check: [`agent-practices/security-review/requirement-010@1.0.0`](checks/security-review/requirement-010/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r010`. Minimum severity: `deny`.

Each attempted vulnerability reproduction must retain the scoped reproducer, versions, commands, preconditions and observed results so another reviewer can replay it safely; inconclusive and environment-limited outcomes must remain explicit.

Default parameters: `{"verifier":"PRACTICE-010"}`.

**Repair:** Bind PRACTICE-010 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-010; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Google Mantis README and reproduce/patch skills at 2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80; https://github.com/google/mantis/tree/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80",
  "locator": "docs/features/agent-practices-pack.md, rule 10; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "Each attempted vulnerability reproduction must retain the scoped reproducer, versions, commands, preconditions and observed results so another reviewer can replay it safely; inconclusive and environment-limited outcomes must remain explicit."
}
```

### agent-practices/PRACTICE-011

Check: [`agent-practices/security-review/requirement-011@1.0.0`](checks/security-review/requirement-011/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r011`. Minimum severity: `deny`.

A security patch must be checked against the original reproducer to show the attack no longer succeeds, with legitimate behavior and relevant regression coverage verified in the same restricted environment before the finding is marked fixed.

Default parameters: `{"verifier":"PRACTICE-011"}`.

**Repair:** Bind PRACTICE-011 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-011; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Google Mantis README and reproduce/patch skills at 2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80; https://github.com/google/mantis/tree/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80",
  "locator": "docs/features/agent-practices-pack.md, rule 11; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "A security patch must be checked against the original reproducer to show the attack no longer succeeds, with legitimate behavior and relevant regression coverage verified in the same restricted environment before the finding is marked fixed."
}
```

### agent-practices/PRACTICE-012

Check: [`agent-practices/security-review/requirement-012@1.0.0`](checks/security-review/requirement-012/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `agent-practices.r012`. Minimum severity: `deny`.

A final security report must trace findings to reviewed evidence and patch status, separate confirmed, unconfirmed and unresolved risks, and receive qualified human review before external reporting; it must not claim that a scan proves the absence of vulnerabilities.

Default parameters: `{"verifier":"PRACTICE-012"}`.

**Repair:** Bind PRACTICE-012 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run PRACTICE-012; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Google Mantis README and reproduce/patch skills at 2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80; https://github.com/google/mantis/tree/2b3bbdcbb8d259d1777b89dcfa3c8e87615ccc80",
  "locator": "docs/features/agent-practices-pack.md, rule 12; interpretation/provenance and evidence ledger; reviewed 2026-10-07",
  "paraphrase": "A final security report must trace findings to reviewed evidence and patch status, separate confirmed, unconfirmed and unresolved risks, and receive qualified human review before external reporting; it must not claim that a scan proves the absence of vulnerabilities."
}
```
