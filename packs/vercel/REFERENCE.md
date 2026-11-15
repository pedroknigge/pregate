# vercel pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## vercel/configuration

Manifest version: `1.0.0`. Status: **preview**.

### vercel/VERCEL-001

Check: [`vercel/configuration/requirement-001@1.0.0`](checks/configuration/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r001`. Minimum severity: `deny`.

A Vercel project must use at most one active file-based configuration format. A project can use the documented defaults without a configuration file.

Default parameters: `{"verifier":"VERCEL-001"}`.

**Repair:** Bind VERCEL-001 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-001; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/project-configuration; checked 2026-10-05; docs/features/vercel-pack.md, rule 1",
  "paraphrase": "A Vercel project must use at most one active file-based configuration format. A project can use the documented defaults without a configuration file."
}
```

### vercel/VERCEL-002

Check: [`vercel/configuration/requirement-002@1.0.0`](checks/configuration/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r002`. Minimum severity: `deny`.

The effective configuration must be valid for the selected framework and configuration format, and its production build and routing must match the reviewed settings.

Default parameters: `{"verifier":"VERCEL-002"}`.

**Repair:** Bind VERCEL-002 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-002; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/project-configuration; checked 2026-10-05; docs/features/vercel-pack.md, rule 2",
  "paraphrase": "The effective configuration must be valid for the selected framework and configuration format, and its production build and routing must match the reviewed settings."
}
```

## vercel/cron

Manifest version: `1.0.0`. Status: **preview**.

### vercel/VERCEL-007

Check: [`vercel/cron/requirement-007@1.0.0`](checks/cron/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r007`. Minimum severity: `deny`.

A protected cron endpoint must check its configured secret on the server and reject a missing or incorrect authorization value before effects.

Default parameters: `{"verifier":"VERCEL-007"}`.

**Repair:** Bind VERCEL-007 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-007; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/cron-jobs/manage-cron-jobs; checked 2026-10-05; docs/features/vercel-pack.md, rule 7",
  "paraphrase": "A protected cron endpoint must check its configured secret on the server and reject a missing or incorrect authorization value before effects."
}
```

### vercel/VERCEL-008

Check: [`vercel/cron/requirement-008@1.0.0`](checks/cron/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r008`. Minimum severity: `deny`.

A cron operation must handle overlapping runs and duplicate invocations without an unintended repeated or conflicting effect.

Default parameters: `{"verifier":"VERCEL-008"}`.

**Repair:** Bind VERCEL-008 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-008; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/cron-jobs/manage-cron-jobs; checked 2026-10-05; docs/features/vercel-pack.md, rule 8",
  "paraphrase": "A cron operation must handle overlapping runs and duplicate invocations without an unintended repeated or conflicting effect."
}
```

### vercel/VERCEL-009

Check: [`vercel/cron/requirement-009@1.0.0`](checks/cron/requirement-009/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r009`. Minimum severity: `deny`.

A cron operation must have a policy for missed runs and failed invocations; it must not assume automatic retries or exactly-once delivery.

Default parameters: `{"verifier":"VERCEL-009"}`.

**Repair:** Bind VERCEL-009 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-009; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/cron-jobs/manage-cron-jobs; checked 2026-10-05; docs/features/vercel-pack.md, rule 9",
  "paraphrase": "A cron operation must have a policy for missed runs and failed invocations; it must not assume automatic retries or exactly-once delivery."
}
```

## vercel/environment

Manifest version: `1.0.0`. Status: **preview**.

### vercel/VERCEL-003

Check: [`vercel/environment/requirement-003@1.0.0`](checks/environment/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r003`. Minimum severity: `deny`.

Each deployed environment and branch must receive only its reviewed environment-variable scope, including applicable branch overrides.

Default parameters: `{"verifier":"VERCEL-003"}`.

**Repair:** Bind VERCEL-003 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-003; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/environment-variables; checked 2026-10-05; docs/features/vercel-pack.md, rule 3",
  "paraphrase": "Each deployed environment and branch must receive only its reviewed environment-variable scope, including applicable branch overrides."
}
```

### vercel/VERCEL-004

Check: [`vercel/environment/requirement-004@1.0.0`](checks/environment/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r004`. Minimum severity: `deny`.

A required environment-variable change must be verified in a new applicable deployment; a previous deployment must not be assumed to receive the change.

Default parameters: `{"verifier":"VERCEL-004"}`.

**Repair:** Bind VERCEL-004 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-004; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/environment-variables; checked 2026-10-05; docs/features/vercel-pack.md, rule 4",
  "paraphrase": "A required environment-variable change must be verified in a new applicable deployment; a previous deployment must not be assumed to receive the change."
}
```

## vercel/functions

Manifest version: `1.0.0`. Status: **preview**.

### vercel/VERCEL-010

Check: [`vercel/functions/requirement-010@1.0.0`](checks/functions/requirement-010/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r010`. Minimum severity: `deny`.

Each function must use a runtime and configuration supported by its selected Vercel execution model.

Default parameters: `{"verifier":"VERCEL-010"}`.

**Repair:** Bind VERCEL-010 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-010; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/functions; checked 2026-10-05; docs/features/vercel-pack.md, rule 10",
  "paraphrase": "Each function must use a runtime and configuration supported by its selected Vercel execution model."
}
```

### vercel/VERCEL-011

Check: [`vercel/functions/requirement-011@1.0.0`](checks/functions/requirement-011/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r011`. Minimum severity: `deny`.

Each function must keep execution duration and resource use inside the current limits and the project's reviewed budget for that plan and compute mode.

Default parameters: `{"verifier":"VERCEL-011"}`.

**Repair:** Bind VERCEL-011 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-011; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/functions; checked 2026-10-05; docs/features/vercel-pack.md, rule 11",
  "paraphrase": "Each function must keep execution duration and resource use inside the current limits and the project's reviewed budget for that plan and compute mode."
}
```

### vercel/VERCEL-012

Check: [`vercel/functions/requirement-012@1.0.0`](checks/functions/requirement-012/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r012`. Minimum severity: `deny`.

Required work after a response must use a supported lifecycle mechanism or durable service; a detached promise must not be assumed to complete.

Default parameters: `{"verifier":"VERCEL-012"}`.

**Repair:** Bind VERCEL-012 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-012; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/functions; checked 2026-10-05; docs/features/vercel-pack.md, rule 12",
  "paraphrase": "Required work after a response must use a supported lifecycle mechanism or durable service; a detached promise must not be assumed to complete."
}
```

## vercel/protection

Manifest version: `1.0.0`. Status: **preview**.

### vercel/VERCEL-005

Check: [`vercel/protection/requirement-005@1.0.0`](checks/protection/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r005`. Minimum severity: `deny`.

Each deployment must enforce the project's reviewed access policy, including intentionally public environments and approved exceptions.

Default parameters: `{"verifier":"VERCEL-005"}`.

**Repair:** Bind VERCEL-005 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-005; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/deployment-protection; checked 2026-10-05; docs/features/vercel-pack.md, rule 5",
  "paraphrase": "Each deployment must enforce the project's reviewed access policy, including intentionally public environments and approved exceptions."
}
```

### vercel/VERCEL-006

Check: [`vercel/protection/requirement-006@1.0.0`](checks/protection/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r006`. Minimum severity: `deny`.

An automation bypass must be explicitly authorized and its credential must not enter public source, client output or logs.

Default parameters: `{"verifier":"VERCEL-006"}`.

**Repair:** Bind VERCEL-006 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-006; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/deployment-protection; checked 2026-10-05; docs/features/vercel-pack.md, rule 6",
  "paraphrase": "An automation bypass must be explicitly authorized and its credential must not enter public source, client output or logs."
}
```

## vercel/recovery

Manifest version: `1.0.0`. Status: **preview**.

### vercel/VERCEL-013

Check: [`vercel/recovery/requirement-013@1.0.0`](checks/recovery/requirement-013/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r013`. Minimum severity: `deny`.

The release must identify and test an eligible rollback target under its current plan and deployment history.

Default parameters: `{"verifier":"VERCEL-013"}`.

**Repair:** Bind VERCEL-013 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-013; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/instant-rollback; checked 2026-10-05; docs/features/vercel-pack.md, rule 13",
  "paraphrase": "The release must identify and test an eligible rollback target under its current plan and deployment history."
}
```

### vercel/VERCEL-014

Check: [`vercel/recovery/requirement-014@1.0.0`](checks/recovery/requirement-014/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r014`. Minimum severity: `deny`.

Recovery must verify the restored deployment's domains, configuration, environment variables and cron state instead of assuming current project settings replace the old build.

Default parameters: `{"verifier":"VERCEL-014"}`.

**Repair:** Bind VERCEL-014 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-014; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/instant-rollback; checked 2026-10-05; docs/features/vercel-pack.md, rule 14",
  "paraphrase": "Recovery must verify the restored deployment's domains, configuration, environment variables and cron state instead of assuming current project settings replace the old build."
}
```

### vercel/VERCEL-015

Check: [`vercel/recovery/requirement-015@1.0.0`](checks/recovery/requirement-015/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `vercel.r015`. Minimum severity: `deny`.

The rollback procedure must verify compatibility with current external APIs, databases and content systems; deployment rollback must not be treated as data rollback.

Default parameters: `{"verifier":"VERCEL-015"}`.

**Repair:** Bind VERCEL-015 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run VERCEL-015; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "work": "Vercel official documentation and explicitly selected project policy",
  "locator": "https://vercel.com/docs/instant-rollback; checked 2026-10-05; docs/features/vercel-pack.md, rule 15",
  "paraphrase": "The rollback procedure must verify compatibility with current external APIs, databases and content systems; deployment rollback must not be treated as data rollback."
}
```
