# consumer-saas pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **invariants**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## consumer-saas/readiness

Manifest version: `1.0.0`. Status: **preview**.

### consumer-saas/CONSUMER-001

Check: [`consumer-saas/account/requirement-001@1.0.0`](checks/account/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r001`. Minimum severity: `deny`.

A person can create an account without a sales call.

Default parameters: `{"verifier":"CONSUMER-001"}`.

**Repair:** Bind CONSUMER-001 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-001; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 1",
  "paraphrase": "A person can create an account without a sales call."
}
```

### consumer-saas/CONSUMER-002

Check: [`consumer-saas/account/requirement-002@1.0.0`](checks/account/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r002`. Minimum severity: `deny`.

The product supports sign-in with an email address and a password.

Default parameters: `{"verifier":"CONSUMER-002"}`.

**Repair:** Bind CONSUMER-002 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-002; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 2",
  "paraphrase": "The product supports sign-in with an email address and a password."
}
```

### consumer-saas/CONSUMER-003

Check: [`consumer-saas/account/requirement-003@1.0.0`](checks/account/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r003`. Minimum severity: `deny`.

The product supports password reset by email.

Default parameters: `{"verifier":"CONSUMER-003"}`.

**Repair:** Bind CONSUMER-003 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-003; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 3",
  "paraphrase": "The product supports password reset by email."
}
```

### consumer-saas/CONSUMER-004

Check: [`consumer-saas/account/requirement-004@1.0.0`](checks/account/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r004`. Minimum severity: `deny`.

The product verifies the email address before it grants full access.

Default parameters: `{"verifier":"CONSUMER-004"}`.

**Repair:** Bind CONSUMER-004 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-004; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 4",
  "paraphrase": "The product verifies the email address before it grants full access."
}
```

### consumer-saas/CONSUMER-005

Check: [`consumer-saas/account/requirement-005@1.0.0`](checks/account/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r005`. Minimum severity: `deny`.

The product supports social sign-in when it offers that option.

Default parameters: `{"verifier":"CONSUMER-005"}`.

**Repair:** Bind CONSUMER-005 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-005; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 5",
  "paraphrase": "The product supports social sign-in when it offers that option."
}
```

### consumer-saas/CONSUMER-006

Check: [`consumer-saas/account/requirement-006@1.0.0`](checks/account/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r006`. Minimum severity: `deny`.

The product lets the user review and end active sessions.

Default parameters: `{"verifier":"CONSUMER-006"}`.

**Repair:** Bind CONSUMER-006 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-006; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 6",
  "paraphrase": "The product lets the user review and end active sessions."
}
```

### consumer-saas/CONSUMER-007

Check: [`consumer-saas/privacy-and-data-rights/requirement-007@1.0.0`](checks/privacy-and-data-rights/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r007`. Minimum severity: `deny`.

The product shows a privacy policy before or at account creation.

Default parameters: `{"verifier":"CONSUMER-007"}`.

**Repair:** Bind CONSUMER-007 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-007; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 7",
  "paraphrase": "The product shows a privacy policy before or at account creation."
}
```

### consumer-saas/CONSUMER-008

Check: [`consumer-saas/privacy-and-data-rights/requirement-008@1.0.0`](checks/privacy-and-data-rights/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r008`. Minimum severity: `deny`.

The privacy policy matches the data that the product collects.

Default parameters: `{"verifier":"CONSUMER-008"}`.

**Repair:** Bind CONSUMER-008 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-008; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 8",
  "paraphrase": "The privacy policy matches the data that the product collects."
}
```

### consumer-saas/CONSUMER-009

Check: [`consumer-saas/privacy-and-data-rights/requirement-009@1.0.0`](checks/privacy-and-data-rights/requirement-009/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r009`. Minimum severity: `deny`.

The product collects only the personal data that the service needs.

Default parameters: `{"verifier":"CONSUMER-009"}`.

**Repair:** Bind CONSUMER-009 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-009; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 9",
  "paraphrase": "The product collects only the personal data that the service needs."
}
```

### consumer-saas/CONSUMER-010

Check: [`consumer-saas/privacy-and-data-rights/requirement-010@1.0.0`](checks/privacy-and-data-rights/requirement-010/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r010`. Minimum severity: `deny`.

The product states each category of personal data and the reason for collection.

Default parameters: `{"verifier":"CONSUMER-010"}`.

**Repair:** Bind CONSUMER-010 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-010; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 10",
  "paraphrase": "The product states each category of personal data and the reason for collection."
}
```

### consumer-saas/CONSUMER-011

Check: [`consumer-saas/privacy-and-data-rights/requirement-011@1.0.0`](checks/privacy-and-data-rights/requirement-011/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r011`. Minimum severity: `deny`.

The product records consent before optional processing, such as marketing email.

Default parameters: `{"verifier":"CONSUMER-011"}`.

**Repair:** Bind CONSUMER-011 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-011; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 11",
  "paraphrase": "The product records consent before optional processing, such as marketing email."
}
```

### consumer-saas/CONSUMER-012

Check: [`consumer-saas/privacy-and-data-rights/requirement-012@1.0.0`](checks/privacy-and-data-rights/requirement-012/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r012`. Minimum severity: `deny`.

The product lets the user withdraw consent.

Default parameters: `{"verifier":"CONSUMER-012"}`.

**Repair:** Bind CONSUMER-012 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-012; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 12",
  "paraphrase": "The product lets the user withdraw consent."
}
```

### consumer-saas/CONSUMER-013

Check: [`consumer-saas/privacy-and-data-rights/requirement-013@1.0.0`](checks/privacy-and-data-rights/requirement-013/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r013`. Minimum severity: `deny`.

The product lets the user export personal data in a machine-readable format.

Default parameters: `{"verifier":"CONSUMER-013"}`.

**Repair:** Bind CONSUMER-013 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-013; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 13",
  "paraphrase": "The product lets the user export personal data in a machine-readable format."
}
```

### consumer-saas/CONSUMER-014

Check: [`consumer-saas/privacy-and-data-rights/requirement-014@1.0.0`](checks/privacy-and-data-rights/requirement-014/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r014`. Minimum severity: `deny`.

The product lets the user delete the account and the personal data.

Default parameters: `{"verifier":"CONSUMER-014"}`.

**Repair:** Bind CONSUMER-014 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-014; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 14",
  "paraphrase": "The product lets the user delete the account and the personal data."
}
```

### consumer-saas/CONSUMER-015

Check: [`consumer-saas/privacy-and-data-rights/requirement-015@1.0.0`](checks/privacy-and-data-rights/requirement-015/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r015`. Minimum severity: `deny`.

The product completes a deletion request within the time that the law requires.

Default parameters: `{"verifier":"CONSUMER-015"}`.

**Repair:** Bind CONSUMER-015 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-015; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 15",
  "paraphrase": "The product completes a deletion request within the time that the law requires."
}
```

### consumer-saas/CONSUMER-016

Check: [`consumer-saas/privacy-and-data-rights/requirement-016@1.0.0`](checks/privacy-and-data-rights/requirement-016/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r016`. Minimum severity: `deny`.

The product keeps billing records only for the period that tax law requires.

Default parameters: `{"verifier":"CONSUMER-016"}`.

**Repair:** Bind CONSUMER-016 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-016; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 16",
  "paraphrase": "The product keeps billing records only for the period that tax law requires."
}
```

### consumer-saas/CONSUMER-017

Check: [`consumer-saas/privacy-and-data-rights/requirement-017@1.0.0`](checks/privacy-and-data-rights/requirement-017/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r017`. Minimum severity: `deny`.

The product lists the processors that receive personal data.

Default parameters: `{"verifier":"CONSUMER-017"}`.

**Repair:** Bind CONSUMER-017 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-017; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 17",
  "paraphrase": "The product lists the processors that receive personal data."
}
```

### consumer-saas/CONSUMER-018

Check: [`consumer-saas/security/requirement-018@1.0.0`](checks/security/requirement-018/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r018`. Minimum severity: `deny`.

The product encrypts data in transit with TLS 1.2 or a later version.

Default parameters: `{"verifier":"CONSUMER-018"}`.

**Repair:** Bind CONSUMER-018 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-018; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 18",
  "paraphrase": "The product encrypts data in transit with TLS 1.2 or a later version."
}
```

### consumer-saas/CONSUMER-019

Check: [`consumer-saas/security/requirement-019@1.0.0`](checks/security/requirement-019/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r019`. Minimum severity: `deny`.

The product encrypts personal data at rest.

Default parameters: `{"verifier":"CONSUMER-019"}`.

**Repair:** Bind CONSUMER-019 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-019; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 19",
  "paraphrase": "The product encrypts personal data at rest."
}
```

### consumer-saas/CONSUMER-020

Check: [`consumer-saas/security/requirement-020@1.0.0`](checks/security/requirement-020/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r020`. Minimum severity: `deny`.

The product stores passwords only as a salted hash.

Default parameters: `{"verifier":"CONSUMER-020"}`.

**Repair:** Bind CONSUMER-020 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-020; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 20",
  "paraphrase": "The product stores passwords only as a salted hash."
}
```

### consumer-saas/CONSUMER-021

Check: [`consumer-saas/security/requirement-021@1.0.0`](checks/security/requirement-021/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r021`. Minimum severity: `deny`.

The product does not store a full payment-card number on its own servers.

Default parameters: `{"verifier":"CONSUMER-021"}`.

**Repair:** Bind CONSUMER-021 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-021; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 21",
  "paraphrase": "The product does not store a full payment-card number on its own servers."
}
```

### consumer-saas/CONSUMER-022

Check: [`consumer-saas/security/requirement-022@1.0.0`](checks/security/requirement-022/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r022`. Minimum severity: `deny`.

One user cannot read or change the private content of another user.

Default parameters: `{"verifier":"CONSUMER-022"}`.

**Repair:** Bind CONSUMER-022 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-022; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 22",
  "paraphrase": "One user cannot read or change the private content of another user."
}
```

### consumer-saas/CONSUMER-023

Check: [`consumer-saas/security/requirement-023@1.0.0`](checks/security/requirement-023/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r023`. Minimum severity: `deny`.

The product limits the rate of sign-up, sign-in, and password-reset requests.

Default parameters: `{"verifier":"CONSUMER-023"}`.

**Repair:** Bind CONSUMER-023 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-023; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 23",
  "paraphrase": "The product limits the rate of sign-up, sign-in, and password-reset requests."
}
```

### consumer-saas/CONSUMER-024

Check: [`consumer-saas/security/requirement-024@1.0.0`](checks/security/requirement-024/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r024`. Minimum severity: `deny`.

The product tells the user about a breach that affects their data when the law requires notice.

Default parameters: `{"verifier":"CONSUMER-024"}`.

**Repair:** Bind CONSUMER-024 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-024; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 24",
  "paraphrase": "The product tells the user about a breach that affects their data when the law requires notice."
}
```

### consumer-saas/CONSUMER-025

Check: [`consumer-saas/payments/requirement-025@1.0.0`](checks/payments/requirement-025/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r025`. Minimum severity: `deny`.

The product shows the price, the billing period, and the renewal rule before the user pays.

Default parameters: `{"verifier":"CONSUMER-025"}`.

**Repair:** Bind CONSUMER-025 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-025; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 25",
  "paraphrase": "The product shows the price, the billing period, and the renewal rule before the user pays."
}
```

### consumer-saas/CONSUMER-026

Check: [`consumer-saas/payments/requirement-026@1.0.0`](checks/payments/requirement-026/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r026`. Minimum severity: `deny`.

The product lets the user cancel a paid plan from the account settings.

Default parameters: `{"verifier":"CONSUMER-026"}`.

**Repair:** Bind CONSUMER-026 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-026; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 26",
  "paraphrase": "The product lets the user cancel a paid plan from the account settings."
}
```

### consumer-saas/CONSUMER-027

Check: [`consumer-saas/payments/requirement-027@1.0.0`](checks/payments/requirement-027/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r027`. Minimum severity: `deny`.

The product sends a receipt for each charge.

Default parameters: `{"verifier":"CONSUMER-027"}`.

**Repair:** Bind CONSUMER-027 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-027; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 27",
  "paraphrase": "The product sends a receipt for each charge."
}
```

### consumer-saas/CONSUMER-028

Check: [`consumer-saas/payments/requirement-028@1.0.0`](checks/payments/requirement-028/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r028`. Minimum severity: `deny`.

The product does not continue a charge after a valid cancellation takes effect.

Default parameters: `{"verifier":"CONSUMER-028"}`.

**Repair:** Bind CONSUMER-028 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-028; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 28",
  "paraphrase": "The product does not continue a charge after a valid cancellation takes effect."
}
```

### consumer-saas/CONSUMER-029

Check: [`consumer-saas/reliability-and-support/requirement-029@1.0.0`](checks/reliability-and-support/requirement-029/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r029`. Minimum severity: `deny`.

The product defines an availability target.

Default parameters: `{"verifier":"CONSUMER-029"}`.

**Repair:** Bind CONSUMER-029 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-029; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 29",
  "paraphrase": "The product defines an availability target."
}
```

### consumer-saas/CONSUMER-030

Check: [`consumer-saas/reliability-and-support/requirement-030@1.0.0`](checks/reliability-and-support/requirement-030/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r030`. Minimum severity: `deny`.

The product shows service status to users.

Default parameters: `{"verifier":"CONSUMER-030"}`.

**Repair:** Bind CONSUMER-030 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-030; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 30",
  "paraphrase": "The product shows service status to users."
}
```

### consumer-saas/CONSUMER-031

Check: [`consumer-saas/reliability-and-support/requirement-031@1.0.0`](checks/reliability-and-support/requirement-031/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r031`. Minimum severity: `deny`.

The product keeps the user's content available while the account is active.

Default parameters: `{"verifier":"CONSUMER-031"}`.

**Repair:** Bind CONSUMER-031 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-031; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 31",
  "paraphrase": "The product keeps the user's content available while the account is active."
}
```

### consumer-saas/CONSUMER-032

Check: [`consumer-saas/reliability-and-support/requirement-032@1.0.0`](checks/reliability-and-support/requirement-032/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r032`. Minimum severity: `deny`.

The product provides a way for the user to contact support.

Default parameters: `{"verifier":"CONSUMER-032"}`.

**Repair:** Bind CONSUMER-032 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-032; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 32",
  "paraphrase": "The product provides a way for the user to contact support."
}
```

### consumer-saas/CONSUMER-033

Check: [`consumer-saas/reliability-and-support/requirement-033@1.0.0`](checks/reliability-and-support/requirement-033/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r033`. Minimum severity: `deny`.

The product has a written procedure for backup and restore.

Default parameters: `{"verifier":"CONSUMER-033"}`.

**Repair:** Bind CONSUMER-033 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-033; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 33",
  "paraphrase": "The product has a written procedure for backup and restore."
}
```

### consumer-saas/CONSUMER-034

Check: [`consumer-saas/legal-and-product-rules/requirement-034@1.0.0`](checks/legal-and-product-rules/requirement-034/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r034`. Minimum severity: `deny`.

The product shows terms of service.

Default parameters: `{"verifier":"CONSUMER-034"}`.

**Repair:** Bind CONSUMER-034 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-034; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 34",
  "paraphrase": "The product shows terms of service."
}
```

### consumer-saas/CONSUMER-035

Check: [`consumer-saas/legal-and-product-rules/requirement-035@1.0.0`](checks/legal-and-product-rules/requirement-035/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r035`. Minimum severity: `deny`.

The product can suspend an account that breaks the terms.

Default parameters: `{"verifier":"CONSUMER-035"}`.

**Repair:** Bind CONSUMER-035 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-035; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 35",
  "paraphrase": "The product can suspend an account that breaks the terms."
}
```

### consumer-saas/CONSUMER-036

Check: [`consumer-saas/legal-and-product-rules/requirement-036@1.0.0`](checks/legal-and-product-rules/requirement-036/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r036`. Minimum severity: `deny`.

The product provides a way to report abuse.

Default parameters: `{"verifier":"CONSUMER-036"}`.

**Repair:** Bind CONSUMER-036 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-036; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 36",
  "paraphrase": "The product provides a way to report abuse."
}
```

### consumer-saas/CONSUMER-037

Check: [`consumer-saas/legal-and-product-rules/requirement-037@1.0.0`](checks/legal-and-product-rules/requirement-037/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r037`. Minimum severity: `deny`.

The product blocks access by a child when the law requires an age limit.

Default parameters: `{"verifier":"CONSUMER-037"}`.

**Repair:** Bind CONSUMER-037 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-037; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 37",
  "paraphrase": "The product blocks access by a child when the law requires an age limit."
}
```

### consumer-saas/CONSUMER-038

Check: [`consumer-saas/legal-and-product-rules/requirement-038@1.0.0`](checks/legal-and-product-rules/requirement-038/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r038`. Minimum severity: `deny`.

The product supports the languages and regions that it claims to serve.

Default parameters: `{"verifier":"CONSUMER-038"}`.

**Repair:** Bind CONSUMER-038 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-038; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 38",
  "paraphrase": "The product supports the languages and regions that it claims to serve."
}
```

### consumer-saas/CONSUMER-039

Check: [`consumer-saas/legal-and-product-rules/requirement-039@1.0.0`](checks/legal-and-product-rules/requirement-039/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `consumer-saas.r039`. Minimum severity: `deny`.

Primary user flows meet the accessibility level that the product claims.

Default parameters: `{"verifier":"CONSUMER-039"}`.

**Repair:** Bind CONSUMER-039 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run CONSUMER-039; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "User-supplied product invariants",
  "locator": "docs/features/consumer-saas-pack.md, rule 39",
  "paraphrase": "Primary user flows meet the accessibility level that the product claims."
}
```
