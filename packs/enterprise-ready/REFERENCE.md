# enterprise-ready pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **invariants**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## enterprise-ready/readiness

Manifest version: `1.0.0`. Status: **preview**.

### enterprise-ready/ENTERPRISE-001

Check: [`enterprise-ready/identity/requirement-001@1.0.0`](checks/identity/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r001`. Minimum severity: `deny`.

The product supports single sign-on with SAML 2.0.

Default parameters: `{"verifier":"ENTERPRISE-001"}`.

**Repair:** Bind ENTERPRISE-001 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-001; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 1",
  "paraphrase": "The product supports single sign-on with SAML 2.0."
}
```

### enterprise-ready/ENTERPRISE-002

Check: [`enterprise-ready/identity/requirement-002@1.0.0`](checks/identity/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r002`. Minimum severity: `deny`.

The product supports single sign-on with OpenID Connect.

Default parameters: `{"verifier":"ENTERPRISE-002"}`.

**Repair:** Bind ENTERPRISE-002 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-002; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 2",
  "paraphrase": "The product supports single sign-on with OpenID Connect."
}
```

### enterprise-ready/ENTERPRISE-003

Check: [`enterprise-ready/identity/requirement-003@1.0.0`](checks/identity/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r003`. Minimum severity: `deny`.

Each customer organization has its own identity-provider configuration.

Default parameters: `{"verifier":"ENTERPRISE-003"}`.

**Repair:** Bind ENTERPRISE-003 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-003; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 3",
  "paraphrase": "Each customer organization has its own identity-provider configuration."
}
```

### enterprise-ready/ENTERPRISE-004

Check: [`enterprise-ready/identity/requirement-004@1.0.0`](checks/identity/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r004`. Minimum severity: `deny`.

The product supports SCIM for user create, update, and disable.

Default parameters: `{"verifier":"ENTERPRISE-004"}`.

**Repair:** Bind ENTERPRISE-004 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-004; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 4",
  "paraphrase": "The product supports SCIM for user create, update, and disable."
}
```

### enterprise-ready/ENTERPRISE-005

Check: [`enterprise-ready/identity/requirement-005@1.0.0`](checks/identity/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r005`. Minimum severity: `deny`.

The product removes access when the identity provider disables the user.

Default parameters: `{"verifier":"ENTERPRISE-005"}`.

**Repair:** Bind ENTERPRISE-005 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-005; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 5",
  "paraphrase": "The product removes access when the identity provider disables the user."
}
```

### enterprise-ready/ENTERPRISE-006

Check: [`enterprise-ready/identity/requirement-006@1.0.0`](checks/identity/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r006`. Minimum severity: `deny`.

The product enforces multi-factor authentication for administrator accounts.

Default parameters: `{"verifier":"ENTERPRISE-006"}`.

**Repair:** Bind ENTERPRISE-006 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-006; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 6",
  "paraphrase": "The product enforces multi-factor authentication for administrator accounts."
}
```

### enterprise-ready/ENTERPRISE-007

Check: [`enterprise-ready/identity/requirement-007@1.0.0`](checks/identity/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r007`. Minimum severity: `deny`.

The product supports just-in-time user creation at first sign-on.

Default parameters: `{"verifier":"ENTERPRISE-007"}`.

**Repair:** Bind ENTERPRISE-007 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-007; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 7",
  "paraphrase": "The product supports just-in-time user creation at first sign-on."
}
```

### enterprise-ready/ENTERPRISE-008

Check: [`enterprise-ready/access-control/requirement-008@1.0.0`](checks/access-control/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r008`. Minimum severity: `deny`.

The product uses role-based access control.

Default parameters: `{"verifier":"ENTERPRISE-008"}`.

**Repair:** Bind ENTERPRISE-008 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-008; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 8",
  "paraphrase": "The product uses role-based access control."
}
```

### enterprise-ready/ENTERPRISE-009

Check: [`enterprise-ready/access-control/requirement-009@1.0.0`](checks/access-control/requirement-009/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r009`. Minimum severity: `deny`.

The product applies the least-privilege rule by default.

Default parameters: `{"verifier":"ENTERPRISE-009"}`.

**Repair:** Bind ENTERPRISE-009 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-009; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 9",
  "paraphrase": "The product applies the least-privilege rule by default."
}
```

### enterprise-ready/ENTERPRISE-010

Check: [`enterprise-ready/access-control/requirement-010@1.0.0`](checks/access-control/requirement-010/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r010`. Minimum severity: `deny`.

A user receives only the permissions of the active organization.

Default parameters: `{"verifier":"ENTERPRISE-010"}`.

**Repair:** Bind ENTERPRISE-010 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-010; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 10",
  "paraphrase": "A user receives only the permissions of the active organization."
}
```

### enterprise-ready/ENTERPRISE-011

Check: [`enterprise-ready/access-control/requirement-011@1.0.0`](checks/access-control/requirement-011/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r011`. Minimum severity: `deny`.

The same person cannot request and approve a controlled action when policy forbids it.

Default parameters: `{"verifier":"ENTERPRISE-011"}`.

**Repair:** Bind ENTERPRISE-011 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-011; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 11",
  "paraphrase": "The same person cannot request and approve a controlled action when policy forbids it."
}
```

### enterprise-ready/ENTERPRISE-012

Check: [`enterprise-ready/access-control/requirement-012@1.0.0`](checks/access-control/requirement-012/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r012`. Minimum severity: `deny`.

Customer administrators manage users and roles in their organization.

Default parameters: `{"verifier":"ENTERPRISE-012"}`.

**Repair:** Bind ENTERPRISE-012 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-012; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 12",
  "paraphrase": "Customer administrators manage users and roles in their organization."
}
```

### enterprise-ready/ENTERPRISE-013

Check: [`enterprise-ready/access-control/requirement-013@1.0.0`](checks/access-control/requirement-013/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r013`. Minimum severity: `deny`.

The product records every permission change.

Default parameters: `{"verifier":"ENTERPRISE-013"}`.

**Repair:** Bind ENTERPRISE-013 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-013; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 13",
  "paraphrase": "The product records every permission change."
}
```

### enterprise-ready/ENTERPRISE-014

Check: [`enterprise-ready/tenant-isolation/requirement-014@1.0.0`](checks/tenant-isolation/requirement-014/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r014`. Minimum severity: `deny`.

One customer cannot read or change the data of another customer.

Default parameters: `{"verifier":"ENTERPRISE-014"}`.

**Repair:** Bind ENTERPRISE-014 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-014; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 14",
  "paraphrase": "One customer cannot read or change the data of another customer."
}
```

### enterprise-ready/ENTERPRISE-015

Check: [`enterprise-ready/tenant-isolation/requirement-015@1.0.0`](checks/tenant-isolation/requirement-015/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r015`. Minimum severity: `deny`.

Sessions, roles, audit logs, and billing belong to one organization.

Default parameters: `{"verifier":"ENTERPRISE-015"}`.

**Repair:** Bind ENTERPRISE-015 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-015; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 15",
  "paraphrase": "Sessions, roles, audit logs, and billing belong to one organization."
}
```

### enterprise-ready/ENTERPRISE-016

Check: [`enterprise-ready/tenant-isolation/requirement-016@1.0.0`](checks/tenant-isolation/requirement-016/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r016`. Minimum severity: `deny`.

A user can belong to more than one organization and must switch organization to change scope.

Default parameters: `{"verifier":"ENTERPRISE-016"}`.

**Repair:** Bind ENTERPRISE-016 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-016; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 16",
  "paraphrase": "A user can belong to more than one organization and must switch organization to change scope."
}
```

### enterprise-ready/ENTERPRISE-017

Check: [`enterprise-ready/tenant-isolation/requirement-017@1.0.0`](checks/tenant-isolation/requirement-017/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r017`. Minimum severity: `deny`.

Configuration for one organization does not apply to another organization.

Default parameters: `{"verifier":"ENTERPRISE-017"}`.

**Repair:** Bind ENTERPRISE-017 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-017; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 17",
  "paraphrase": "Configuration for one organization does not apply to another organization."
}
```

### enterprise-ready/ENTERPRISE-018

Check: [`enterprise-ready/audit/requirement-018@1.0.0`](checks/audit/requirement-018/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r018`. Minimum severity: `deny`.

The product writes an audit record for each security-relevant action.

Default parameters: `{"verifier":"ENTERPRISE-018"}`.

**Repair:** Bind ENTERPRISE-018 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-018; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 18",
  "paraphrase": "The product writes an audit record for each security-relevant action."
}
```

### enterprise-ready/ENTERPRISE-019

Check: [`enterprise-ready/audit/requirement-019@1.0.0`](checks/audit/requirement-019/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r019`. Minimum severity: `deny`.

Each audit record contains the actor, the action, the target, and the time.

Default parameters: `{"verifier":"ENTERPRISE-019"}`.

**Repair:** Bind ENTERPRISE-019 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-019; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 19",
  "paraphrase": "Each audit record contains the actor, the action, the target, and the time."
}
```

### enterprise-ready/ENTERPRISE-020

Check: [`enterprise-ready/audit/requirement-020@1.0.0`](checks/audit/requirement-020/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r020`. Minimum severity: `deny`.

The customer can read and export only the audit records of that customer.

Default parameters: `{"verifier":"ENTERPRISE-020"}`.

**Repair:** Bind ENTERPRISE-020 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-020; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 20",
  "paraphrase": "The customer can read and export only the audit records of that customer."
}
```

### enterprise-ready/ENTERPRISE-021

Check: [`enterprise-ready/audit/requirement-021@1.0.0`](checks/audit/requirement-021/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r021`. Minimum severity: `deny`.

The product does not change or delete an audit record.

Default parameters: `{"verifier":"ENTERPRISE-021"}`.

**Repair:** Bind ENTERPRISE-021 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-021; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 21",
  "paraphrase": "The product does not change or delete an audit record."
}
```

### enterprise-ready/ENTERPRISE-022

Check: [`enterprise-ready/audit/requirement-022@1.0.0`](checks/audit/requirement-022/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r022`. Minimum severity: `deny`.

The product keeps audit records for a stated retention period.

Default parameters: `{"verifier":"ENTERPRISE-022"}`.

**Repair:** Bind ENTERPRISE-022 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-022; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 22",
  "paraphrase": "The product keeps audit records for a stated retention period."
}
```

### enterprise-ready/ENTERPRISE-023

Check: [`enterprise-ready/audit/requirement-023@1.0.0`](checks/audit/requirement-023/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r023`. Minimum severity: `deny`.

The product can send audit records to the customer security system.

Default parameters: `{"verifier":"ENTERPRISE-023"}`.

**Repair:** Bind ENTERPRISE-023 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-023; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 23",
  "paraphrase": "The product can send audit records to the customer security system."
}
```

### enterprise-ready/ENTERPRISE-024

Check: [`enterprise-ready/data-protection/requirement-024@1.0.0`](checks/data-protection/requirement-024/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r024`. Minimum severity: `deny`.

The product encrypts data in transit with TLS 1.2 or a later version.

Default parameters: `{"verifier":"ENTERPRISE-024"}`.

**Repair:** Bind ENTERPRISE-024 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-024; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 24",
  "paraphrase": "The product encrypts data in transit with TLS 1.2 or a later version."
}
```

### enterprise-ready/ENTERPRISE-025

Check: [`enterprise-ready/data-protection/requirement-025@1.0.0`](checks/data-protection/requirement-025/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r025`. Minimum severity: `deny`.

The product encrypts data at rest.

Default parameters: `{"verifier":"ENTERPRISE-025"}`.

**Repair:** Bind ENTERPRISE-025 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-025; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 25",
  "paraphrase": "The product encrypts data at rest."
}
```

### enterprise-ready/ENTERPRISE-026

Check: [`enterprise-ready/data-protection/requirement-026@1.0.0`](checks/data-protection/requirement-026/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r026`. Minimum severity: `deny`.

The product stores secrets in a secrets store, not in source code.

Default parameters: `{"verifier":"ENTERPRISE-026"}`.

**Repair:** Bind ENTERPRISE-026 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-026; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 26",
  "paraphrase": "The product stores secrets in a secrets store, not in source code."
}
```

### enterprise-ready/ENTERPRISE-027

Check: [`enterprise-ready/data-protection/requirement-027@1.0.0`](checks/data-protection/requirement-027/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r027`. Minimum severity: `deny`.

The product supports a documented data-export request.

Default parameters: `{"verifier":"ENTERPRISE-027"}`.

**Repair:** Bind ENTERPRISE-027 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-027; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 27",
  "paraphrase": "The product supports a documented data-export request."
}
```

### enterprise-ready/ENTERPRISE-028

Check: [`enterprise-ready/data-protection/requirement-028@1.0.0`](checks/data-protection/requirement-028/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r028`. Minimum severity: `deny`.

The product supports a documented data-deletion request.

Default parameters: `{"verifier":"ENTERPRISE-028"}`.

**Repair:** Bind ENTERPRISE-028 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-028; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 28",
  "paraphrase": "The product supports a documented data-deletion request."
}
```

### enterprise-ready/ENTERPRISE-029

Check: [`enterprise-ready/data-protection/requirement-029@1.0.0`](checks/data-protection/requirement-029/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r029`. Minimum severity: `deny`.

The product states the regions where it stores customer data.

Default parameters: `{"verifier":"ENTERPRISE-029"}`.

**Repair:** Bind ENTERPRISE-029 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-029; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 29",
  "paraphrase": "The product states the regions where it stores customer data."
}
```

### enterprise-ready/ENTERPRISE-030

Check: [`enterprise-ready/data-protection/requirement-030@1.0.0`](checks/data-protection/requirement-030/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r030`. Minimum severity: `deny`.

The product lists subprocessors and the data that each subprocessor receives.

Default parameters: `{"verifier":"ENTERPRISE-030"}`.

**Repair:** Bind ENTERPRISE-030 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-030; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 30",
  "paraphrase": "The product lists subprocessors and the data that each subprocessor receives."
}
```

### enterprise-ready/ENTERPRISE-031

Check: [`enterprise-ready/reliability/requirement-031@1.0.0`](checks/reliability/requirement-031/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r031`. Minimum severity: `deny`.

The product has a written availability target and a service-level agreement.

Default parameters: `{"verifier":"ENTERPRISE-031"}`.

**Repair:** Bind ENTERPRISE-031 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-031; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 31",
  "paraphrase": "The product has a written availability target and a service-level agreement."
}
```

### enterprise-ready/ENTERPRISE-032

Check: [`enterprise-ready/reliability/requirement-032@1.0.0`](checks/reliability/requirement-032/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r032`. Minimum severity: `deny`.

The product defines a recovery-point objective and a recovery-time objective.

Default parameters: `{"verifier":"ENTERPRISE-032"}`.

**Repair:** Bind ENTERPRISE-032 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-032; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 32",
  "paraphrase": "The product defines a recovery-point objective and a recovery-time objective."
}
```

### enterprise-ready/ENTERPRISE-033

Check: [`enterprise-ready/reliability/requirement-033@1.0.0`](checks/reliability/requirement-033/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r033`. Minimum severity: `deny`.

The product takes backups and tests restore.

Default parameters: `{"verifier":"ENTERPRISE-033"}`.

**Repair:** Bind ENTERPRISE-033 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-033; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 33",
  "paraphrase": "The product takes backups and tests restore."
}
```

### enterprise-ready/ENTERPRISE-034

Check: [`enterprise-ready/reliability/requirement-034@1.0.0`](checks/reliability/requirement-034/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r034`. Minimum severity: `deny`.

The product has a disaster-recovery plan for production workloads.

Default parameters: `{"verifier":"ENTERPRISE-034"}`.

**Repair:** Bind ENTERPRISE-034 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-034; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 34",
  "paraphrase": "The product has a disaster-recovery plan for production workloads."
}
```

### enterprise-ready/ENTERPRISE-035

Check: [`enterprise-ready/reliability/requirement-035@1.0.0`](checks/reliability/requirement-035/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r035`. Minimum severity: `deny`.

The product removes single points of failure from the core path.

Default parameters: `{"verifier":"ENTERPRISE-035"}`.

**Repair:** Bind ENTERPRISE-035 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-035; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 35",
  "paraphrase": "The product removes single points of failure from the core path."
}
```

### enterprise-ready/ENTERPRISE-036

Check: [`enterprise-ready/reliability/requirement-036@1.0.0`](checks/reliability/requirement-036/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r036`. Minimum severity: `deny`.

The product publishes service status and incident history.

Default parameters: `{"verifier":"ENTERPRISE-036"}`.

**Repair:** Bind ENTERPRISE-036 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-036; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 36",
  "paraphrase": "The product publishes service status and incident history."
}
```

### enterprise-ready/ENTERPRISE-037

Check: [`enterprise-ready/reliability/requirement-037@1.0.0`](checks/reliability/requirement-037/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r037`. Minimum severity: `deny`.

The product tells customers about planned maintenance before the window starts.

Default parameters: `{"verifier":"ENTERPRISE-037"}`.

**Repair:** Bind ENTERPRISE-037 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-037; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 37",
  "paraphrase": "The product tells customers about planned maintenance before the window starts."
}
```

### enterprise-ready/ENTERPRISE-038

Check: [`enterprise-ready/secure-development/requirement-038@1.0.0`](checks/secure-development/requirement-038/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r038`. Minimum severity: `deny`.

The product follows a secure development lifecycle.

Default parameters: `{"verifier":"ENTERPRISE-038"}`.

**Repair:** Bind ENTERPRISE-038 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-038; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 38",
  "paraphrase": "The product follows a secure development lifecycle."
}
```

### enterprise-ready/ENTERPRISE-039

Check: [`enterprise-ready/secure-development/requirement-039@1.0.0`](checks/secure-development/requirement-039/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r039`. Minimum severity: `deny`.

The vendor scans dependencies and fixes known high-risk defects on a stated schedule.

Default parameters: `{"verifier":"ENTERPRISE-039"}`.

**Repair:** Bind ENTERPRISE-039 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-039; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 39",
  "paraphrase": "The vendor scans dependencies and fixes known high-risk defects on a stated schedule."
}
```

### enterprise-ready/ENTERPRISE-040

Check: [`enterprise-ready/secure-development/requirement-040@1.0.0`](checks/secure-development/requirement-040/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r040`. Minimum severity: `deny`.

The vendor runs a penetration test at least once each year.

Default parameters: `{"verifier":"ENTERPRISE-040"}`.

**Repair:** Bind ENTERPRISE-040 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-040; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 40",
  "paraphrase": "The vendor runs a penetration test at least once each year."
}
```

### enterprise-ready/ENTERPRISE-041

Check: [`enterprise-ready/secure-development/requirement-041@1.0.0`](checks/secure-development/requirement-041/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r041`. Minimum severity: `deny`.

The vendor can show a current SOC 2 Type II report, or an equal attestation.

Default parameters: `{"verifier":"ENTERPRISE-041"}`.

**Repair:** Bind ENTERPRISE-041 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-041; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 41",
  "paraphrase": "The vendor can show a current SOC 2 Type II report, or an equal attestation."
}
```

### enterprise-ready/ENTERPRISE-042

Check: [`enterprise-ready/secure-development/requirement-042@1.0.0`](checks/secure-development/requirement-042/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r042`. Minimum severity: `deny`.

The vendor can show ISO 27001 certification when the customer requires it.

Default parameters: `{"verifier":"ENTERPRISE-042"}`.

**Repair:** Bind ENTERPRISE-042 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-042; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 42",
  "paraphrase": "The vendor can show ISO 27001 certification when the customer requires it."
}
```

### enterprise-ready/ENTERPRISE-043

Check: [`enterprise-ready/secure-development/requirement-043@1.0.0`](checks/secure-development/requirement-043/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r043`. Minimum severity: `deny`.

The product has a vulnerability-disclosure process.

Default parameters: `{"verifier":"ENTERPRISE-043"}`.

**Repair:** Bind ENTERPRISE-043 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-043; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 43",
  "paraphrase": "The product has a vulnerability-disclosure process."
}
```

### enterprise-ready/ENTERPRISE-044

Check: [`enterprise-ready/operations-and-change/requirement-044@1.0.0`](checks/operations-and-change/requirement-044/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r044`. Minimum severity: `deny`.

The product separates development, test, and production environments.

Default parameters: `{"verifier":"ENTERPRISE-044"}`.

**Repair:** Bind ENTERPRISE-044 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-044; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 44",
  "paraphrase": "The product separates development, test, and production environments."
}
```

### enterprise-ready/ENTERPRISE-045

Check: [`enterprise-ready/operations-and-change/requirement-045@1.0.0`](checks/operations-and-change/requirement-045/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r045`. Minimum severity: `deny`.

The product supports a controlled release and a rollback.

Default parameters: `{"verifier":"ENTERPRISE-045"}`.

**Repair:** Bind ENTERPRISE-045 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-045; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 45",
  "paraphrase": "The product supports a controlled release and a rollback."
}
```

### enterprise-ready/ENTERPRISE-046

Check: [`enterprise-ready/operations-and-change/requirement-046@1.0.0`](checks/operations-and-change/requirement-046/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r046`. Minimum severity: `deny`.

The product supports feature flags for a safe release.

Default parameters: `{"verifier":"ENTERPRISE-046"}`.

**Repair:** Bind ENTERPRISE-046 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-046; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 46",
  "paraphrase": "The product supports feature flags for a safe release."
}
```

### enterprise-ready/ENTERPRISE-047

Check: [`enterprise-ready/operations-and-change/requirement-047@1.0.0`](checks/operations-and-change/requirement-047/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r047`. Minimum severity: `deny`.

The product exposes health checks, metrics, and structured logs.

Default parameters: `{"verifier":"ENTERPRISE-047"}`.

**Repair:** Bind ENTERPRISE-047 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-047; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 47",
  "paraphrase": "The product exposes health checks, metrics, and structured logs."
}
```

### enterprise-ready/ENTERPRISE-048

Check: [`enterprise-ready/operations-and-change/requirement-048@1.0.0`](checks/operations-and-change/requirement-048/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r048`. Minimum severity: `deny`.

An upgrade procedure and a rollback procedure exist in writing.

Default parameters: `{"verifier":"ENTERPRISE-048"}`.

**Repair:** Bind ENTERPRISE-048 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-048; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 48",
  "paraphrase": "An upgrade procedure and a rollback procedure exist in writing."
}
```

### enterprise-ready/ENTERPRISE-049

Check: [`enterprise-ready/operations-and-change/requirement-049@1.0.0`](checks/operations-and-change/requirement-049/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r049`. Minimum severity: `deny`.

The customer can configure the product without a code change for standard options.

Default parameters: `{"verifier":"ENTERPRISE-049"}`.

**Repair:** Bind ENTERPRISE-049 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-049; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 49",
  "paraphrase": "The customer can configure the product without a code change for standard options."
}
```

### enterprise-ready/ENTERPRISE-050

Check: [`enterprise-ready/integration/requirement-050@1.0.0`](checks/integration/requirement-050/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r050`. Minimum severity: `deny`.

The product provides a versioned API and a written deprecation policy.

Default parameters: `{"verifier":"ENTERPRISE-050"}`.

**Repair:** Bind ENTERPRISE-050 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-050; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 50",
  "paraphrase": "The product provides a versioned API and a written deprecation policy."
}
```

### enterprise-ready/ENTERPRISE-051

Check: [`enterprise-ready/integration/requirement-051@1.0.0`](checks/integration/requirement-051/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r051`. Minimum severity: `deny`.

The product supports webhooks with retry and idempotency.

Default parameters: `{"verifier":"ENTERPRISE-051"}`.

**Repair:** Bind ENTERPRISE-051 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-051; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 51",
  "paraphrase": "The product supports webhooks with retry and idempotency."
}
```

### enterprise-ready/ENTERPRISE-052

Check: [`enterprise-ready/integration/requirement-052@1.0.0`](checks/integration/requirement-052/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r052`. Minimum severity: `deny`.

The product supports bulk import and bulk export in an open format.

Default parameters: `{"verifier":"ENTERPRISE-052"}`.

**Repair:** Bind ENTERPRISE-052 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-052; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 52",
  "paraphrase": "The product supports bulk import and bulk export in an open format."
}
```

### enterprise-ready/ENTERPRISE-053

Check: [`enterprise-ready/integration/requirement-053@1.0.0`](checks/integration/requirement-053/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r053`. Minimum severity: `deny`.

The product provides a sandbox for tests before production use.

Default parameters: `{"verifier":"ENTERPRISE-053"}`.

**Repair:** Bind ENTERPRISE-053 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-053; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 53",
  "paraphrase": "The product provides a sandbox for tests before production use."
}
```

### enterprise-ready/ENTERPRISE-054

Check: [`enterprise-ready/commercial-and-support/requirement-054@1.0.0`](checks/commercial-and-support/requirement-054/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r054`. Minimum severity: `deny`.

The contract includes a data-processing agreement.

Default parameters: `{"verifier":"ENTERPRISE-054"}`.

**Repair:** Bind ENTERPRISE-054 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-054; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 54",
  "paraphrase": "The contract includes a data-processing agreement."
}
```

### enterprise-ready/ENTERPRISE-055

Check: [`enterprise-ready/commercial-and-support/requirement-055@1.0.0`](checks/commercial-and-support/requirement-055/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r055`. Minimum severity: `deny`.

Billing is at organization level, not only at user level.

Default parameters: `{"verifier":"ENTERPRISE-055"}`.

**Repair:** Bind ENTERPRISE-055 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-055; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 55",
  "paraphrase": "Billing is at organization level, not only at user level."
}
```

### enterprise-ready/ENTERPRISE-056

Check: [`enterprise-ready/commercial-and-support/requirement-056@1.0.0`](checks/commercial-and-support/requirement-056/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r056`. Minimum severity: `deny`.

The product states support hours, severity levels, and response times.

Default parameters: `{"verifier":"ENTERPRISE-056"}`.

**Repair:** Bind ENTERPRISE-056 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-056; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 56",
  "paraphrase": "The product states support hours, severity levels, and response times."
}
```

### enterprise-ready/ENTERPRISE-057

Check: [`enterprise-ready/commercial-and-support/requirement-057@1.0.0`](checks/commercial-and-support/requirement-057/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `enterprise-ready.r057`. Minimum severity: `deny`.

The customer can obtain security answers from a trust page.

Default parameters: `{"verifier":"ENTERPRISE-057"}`.

**Repair:** Bind ENTERPRISE-057 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run ENTERPRISE-057; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/enterprise-ready-pack.md, rule 57",
  "paraphrase": "The customer can obtain security answers from a trust page."
}
```
