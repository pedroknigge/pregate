# next-website pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## next-website/readiness

Manifest version: `1.0.0`. Status: **preview**.

### next-website/NEXT-WEBSITE-001

Check: [`next-website/rendering/requirement-001@1.0.0`](checks/rendering/requirement-001/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r001`. Minimum severity: `deny`.

A page and a layout are Server Components by default.

Default parameters: `{"verifier":"NEXT-WEBSITE-001"}`.

**Repair:** Bind NEXT-WEBSITE-001 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-001; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 1",
  "paraphrase": "A page and a layout are Server Components by default."
}
```

### next-website/NEXT-WEBSITE-002

Check: [`next-website/rendering/requirement-002@1.0.0`](checks/rendering/requirement-002/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r002`. Minimum severity: `deny`.

A Server Component does not use a browser-only API.

Default parameters: `{"verifier":"NEXT-WEBSITE-002"}`.

**Repair:** Bind NEXT-WEBSITE-002 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-002; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 2",
  "paraphrase": "A Server Component does not use a browser-only API."
}
```

### next-website/NEXT-WEBSITE-003

Check: [`next-website/rendering/requirement-003@1.0.0`](checks/rendering/requirement-003/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r003`. Minimum severity: `deny`.

A file uses the `use client` directive only when it needs state, events, or a browser API.

Default parameters: `{"verifier":"NEXT-WEBSITE-003"}`.

**Repair:** Bind NEXT-WEBSITE-003 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-003; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 3",
  "paraphrase": "A file uses the `use client` directive only when it needs state, events, or a browser API."
}
```

### next-website/NEXT-WEBSITE-004

Check: [`next-website/rendering/requirement-004@1.0.0`](checks/rendering/requirement-004/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r004`. Minimum severity: `deny`.

The `use client` directive is at the top of the file, before imports.

Default parameters: `{"verifier":"NEXT-WEBSITE-004"}`.

**Repair:** Bind NEXT-WEBSITE-004 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-004; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 4",
  "paraphrase": "The `use client` directive is at the top of the file, before imports."
}
```

### next-website/NEXT-WEBSITE-005

Check: [`next-website/rendering/requirement-005@1.0.0`](checks/rendering/requirement-005/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r005`. Minimum severity: `deny`.

The directive marks only the entry of a client subtree.

Default parameters: `{"verifier":"NEXT-WEBSITE-005"}`.

**Repair:** Bind NEXT-WEBSITE-005 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-005; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 5",
  "paraphrase": "The directive marks only the entry of a client subtree."
}
```

### next-website/NEXT-WEBSITE-006

Check: [`next-website/rendering/requirement-006@1.0.0`](checks/rendering/requirement-006/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r006`. Minimum severity: `deny`.

A component does not change props during render.

Default parameters: `{"verifier":"NEXT-WEBSITE-006"}`.

**Repair:** Bind NEXT-WEBSITE-006 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-006; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 6",
  "paraphrase": "A component does not change props during render."
}
```

### next-website/NEXT-WEBSITE-007

Check: [`next-website/rendering/requirement-007@1.0.0`](checks/rendering/requirement-007/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r007`. Minimum severity: `deny`.

Ordinary Hooks run at the top level of function components or custom Hooks. Apply React's separate documented rules for the use API. https://react.dev/reference/rules/rules-of-hooks; https://react.dev/reference/react/use

Default parameters: `{"verifier":"NEXT-WEBSITE-007"}`.

**Repair:** Bind NEXT-WEBSITE-007 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-007; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 7",
  "paraphrase": "A hook runs only at the top level of a function component."
}
```

### next-website/NEXT-WEBSITE-008

Check: [`next-website/server-and-client-boundary/requirement-008@1.0.0`](checks/server-and-client-boundary/requirement-008/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r008`. Minimum severity: `deny`.

Server Component code does not ship to the browser.

Default parameters: `{"verifier":"NEXT-WEBSITE-008"}`.

**Repair:** Bind NEXT-WEBSITE-008 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-008; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 8",
  "paraphrase": "Server Component code does not ship to the browser."
}
```

### next-website/NEXT-WEBSITE-009

Check: [`next-website/server-and-client-boundary/requirement-009@1.0.0`](checks/server-and-client-boundary/requirement-009/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r009`. Minimum severity: `deny`.

Code that a Client Component imports becomes part of the client bundle.

Default parameters: `{"verifier":"NEXT-WEBSITE-009"}`.

**Repair:** Bind NEXT-WEBSITE-009 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-009; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 9",
  "paraphrase": "Code that a Client Component imports becomes part of the client bundle."
}
```

### next-website/NEXT-WEBSITE-010

Check: [`next-website/server-and-client-boundary/requirement-010@1.0.0`](checks/server-and-client-boundary/requirement-010/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r010`. Minimum severity: `deny`.

Data that crosses the boundary is serializable.

Default parameters: `{"verifier":"NEXT-WEBSITE-010"}`.

**Repair:** Bind NEXT-WEBSITE-010 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-010; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 10",
  "paraphrase": "Data that crosses the boundary is serializable."
}
```

### next-website/NEXT-WEBSITE-011

Check: [`next-website/server-and-client-boundary/requirement-011@1.0.0`](checks/server-and-client-boundary/requirement-011/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r011`. Minimum severity: `deny`.

The server does not pass a function as a prop to a Client Component.

Default parameters: `{"verifier":"NEXT-WEBSITE-011"}`.

**Repair:** Bind NEXT-WEBSITE-011 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-011; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 11",
  "paraphrase": "The server does not pass a function as a prop to a Client Component."
}
```

### next-website/NEXT-WEBSITE-012

Check: [`next-website/server-and-client-boundary/requirement-012@1.0.0`](checks/server-and-client-boundary/requirement-012/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r012`. Minimum severity: `deny`.

A Server Function can cross the boundary as a reference.

Default parameters: `{"verifier":"NEXT-WEBSITE-012"}`.

**Repair:** Bind NEXT-WEBSITE-012 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-012; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 12",
  "paraphrase": "A Server Function can cross the boundary as a reference."
}
```

### next-website/NEXT-WEBSITE-013

Check: [`next-website/server-and-client-boundary/requirement-013@1.0.0`](checks/server-and-client-boundary/requirement-013/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r013`. Minimum severity: `deny`.

A Server Function is async.

Default parameters: `{"verifier":"NEXT-WEBSITE-013"}`.

**Repair:** Bind NEXT-WEBSITE-013 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-013; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 13",
  "paraphrase": "A Server Function is async."
}
```

### next-website/NEXT-WEBSITE-014

Check: [`next-website/server-and-client-boundary/requirement-014@1.0.0`](checks/server-and-client-boundary/requirement-014/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r014`. Minimum severity: `deny`.

The product does not pass a secret or a full database row to a Client Component.

Default parameters: `{"verifier":"NEXT-WEBSITE-014"}`.

**Repair:** Bind NEXT-WEBSITE-014 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-014; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 14",
  "paraphrase": "The product does not pass a secret or a full database row to a Client Component."
}
```

### next-website/NEXT-WEBSITE-015

Check: [`next-website/server-and-client-boundary/requirement-015@1.0.0`](checks/server-and-client-boundary/requirement-015/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r015`. Minimum severity: `deny`.

A module that must stay on the server imports `server-only`.

Default parameters: `{"verifier":"NEXT-WEBSITE-015"}`.

**Repair:** Bind NEXT-WEBSITE-015 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-015; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 15",
  "paraphrase": "A module that must stay on the server imports `server-only`."
}
```

### next-website/NEXT-WEBSITE-016

Check: [`next-website/data-and-cache/requirement-016@1.0.0`](checks/data-and-cache/requirement-016/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r016`. Minimum severity: `deny`.

A Server Component fetches data on the server.

Default parameters: `{"verifier":"NEXT-WEBSITE-016"}`.

**Repair:** Bind NEXT-WEBSITE-016 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-016; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 16",
  "paraphrase": "A Server Component fetches data on the server."
}
```

### next-website/NEXT-WEBSITE-017

Check: [`next-website/data-and-cache/requirement-017@1.0.0`](checks/data-and-cache/requirement-017/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r017`. Minimum severity: `deny`.

A Server Component does not call a Route Handler for its own data.

Default parameters: `{"verifier":"NEXT-WEBSITE-017"}`.

**Repair:** Bind NEXT-WEBSITE-017 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-017; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 17",
  "paraphrase": "A Server Component does not call a Route Handler for its own data."
}
```

### next-website/NEXT-WEBSITE-018

Check: [`next-website/data-and-cache/requirement-018@1.0.0`](checks/data-and-cache/requirement-018/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r018`. Minimum severity: `deny`.

The product validates every untrusted input before use.

Default parameters: `{"verifier":"NEXT-WEBSITE-018"}`.

**Repair:** Bind NEXT-WEBSITE-018 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-018; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 18",
  "paraphrase": "The product validates every untrusted input before use."
}
```

### next-website/NEXT-WEBSITE-019

Check: [`next-website/data-and-cache/requirement-019@1.0.0`](checks/data-and-cache/requirement-019/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r019`. Minimum severity: `deny`.

A Server Action checks authentication and authorization inside the action.

Default parameters: `{"verifier":"NEXT-WEBSITE-019"}`.

**Repair:** Bind NEXT-WEBSITE-019 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-019; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 19",
  "paraphrase": "A Server Action checks authentication and authorization inside the action."
}
```

### next-website/NEXT-WEBSITE-020

Check: [`next-website/data-and-cache/requirement-020@1.0.0`](checks/data-and-cache/requirement-020/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r020`. Minimum severity: `deny`.

A layout check is not the only authorization check.

Default parameters: `{"verifier":"NEXT-WEBSITE-020"}`.

**Repair:** Bind NEXT-WEBSITE-020 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-020; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 20",
  "paraphrase": "A layout check is not the only authorization check."
}
```

### next-website/NEXT-WEBSITE-021

Check: [`next-website/data-and-cache/requirement-021@1.0.0`](checks/data-and-cache/requirement-021/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r021`. Minimum severity: `deny`.

A mutation revalidates the cache tags that the write changes.

Default parameters: `{"verifier":"NEXT-WEBSITE-021"}`.

**Repair:** Bind NEXT-WEBSITE-021 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-021; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 21",
  "paraphrase": "A mutation revalidates the cache tags that the write changes."
}
```

### next-website/NEXT-WEBSITE-022

Check: [`next-website/data-and-cache/requirement-022@1.0.0`](checks/data-and-cache/requirement-022/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r022`. Minimum severity: `deny`.

Evaluate request-time data under the installed Next.js version and enabled cache model. With Cache Components it can stream behind Suspense alongside a static shell; do not require the whole route to become dynamic. https://nextjs.org/docs/app/getting-started/caching

Default parameters: `{"verifier":"NEXT-WEBSITE-022"}`.

**Repair:** Bind NEXT-WEBSITE-022 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-022; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 22",
  "paraphrase": "A request-time API such as `cookies()` or `headers()` opts that route into dynamic rendering."
}
```

### next-website/NEXT-WEBSITE-023

Check: [`next-website/data-and-cache/requirement-023@1.0.0`](checks/data-and-cache/requirement-023/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r023`. Minimum severity: `deny`.

Slow data sits behind `Suspense` or `loading.tsx` so the rest of the page can stream.

Default parameters: `{"verifier":"NEXT-WEBSITE-023"}`.

**Repair:** Bind NEXT-WEBSITE-023 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-023; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 23",
  "paraphrase": "Slow data sits behind `Suspense` or `loading.tsx` so the rest of the page can stream."
}
```

### next-website/NEXT-WEBSITE-024

Check: [`next-website/routing-and-errors/requirement-024@1.0.0`](checks/routing-and-errors/requirement-024/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r024`. Minimum severity: `deny`.

Each reachable endpoint has a page or Route Handler. Structural directories and route groups are not endpoints. Do not place page.tsx and route.ts at the same segment. https://nextjs.org/docs/app/getting-started/route-handlers

Default parameters: `{"verifier":"NEXT-WEBSITE-024"}`.

**Repair:** Bind NEXT-WEBSITE-024 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-024; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 24",
  "paraphrase": "Each route has a `page`, a route handler, or both."
}
```

### next-website/NEXT-WEBSITE-025

Check: [`next-website/routing-and-errors/requirement-025@1.0.0`](checks/routing-and-errors/requirement-025/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r025`. Minimum severity: `deny`.

The app has `error.tsx` for an unexpected failure.

Default parameters: `{"verifier":"NEXT-WEBSITE-025"}`.

**Repair:** Bind NEXT-WEBSITE-025 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-025; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 25",
  "paraphrase": "The app has `error.tsx` for an unexpected failure."
}
```

### next-website/NEXT-WEBSITE-026

Check: [`next-website/routing-and-errors/requirement-026@1.0.0`](checks/routing-and-errors/requirement-026/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r026`. Minimum severity: `deny`.

The app has `not-found` for a missing resource.

Default parameters: `{"verifier":"NEXT-WEBSITE-026"}`.

**Repair:** Bind NEXT-WEBSITE-026 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-026; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 26",
  "paraphrase": "The app has `not-found` for a missing resource."
}
```

### next-website/NEXT-WEBSITE-027

Check: [`next-website/routing-and-errors/requirement-027@1.0.0`](checks/routing-and-errors/requirement-027/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r027`. Minimum severity: `deny`.

Internal navigation uses the Next.js `Link` component.

Default parameters: `{"verifier":"NEXT-WEBSITE-027"}`.

**Repair:** Bind NEXT-WEBSITE-027 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-027; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 27",
  "paraphrase": "Internal navigation uses the Next.js `Link` component."
}
```

### next-website/NEXT-WEBSITE-028

Check: [`next-website/routing-and-errors/requirement-028@1.0.0`](checks/routing-and-errors/requirement-028/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r028`. Minimum severity: `deny`.

A dynamic route validates `params` before use.

Default parameters: `{"verifier":"NEXT-WEBSITE-028"}`.

**Repair:** Bind NEXT-WEBSITE-028 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-028; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 28",
  "paraphrase": "A dynamic route validates `params` before use."
}
```

### next-website/NEXT-WEBSITE-029

Check: [`next-website/routing-and-errors/requirement-029@1.0.0`](checks/routing-and-errors/requirement-029/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r029`. Minimum severity: `deny`.

A file in `public/` does not contain a secret.

Default parameters: `{"verifier":"NEXT-WEBSITE-029"}`.

**Repair:** Bind NEXT-WEBSITE-029 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-029; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 29",
  "paraphrase": "A file in `public/` does not contain a secret."
}
```

### next-website/NEXT-WEBSITE-030

Check: [`next-website/security/requirement-030@1.0.0`](checks/security/requirement-030/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r030`. Minimum severity: `deny`.

The site serves pages over HTTPS.

Default parameters: `{"verifier":"NEXT-WEBSITE-030"}`.

**Repair:** Bind NEXT-WEBSITE-030 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-030; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 30",
  "paraphrase": "The site serves pages over HTTPS."
}
```

### next-website/NEXT-WEBSITE-031

Check: [`next-website/security/requirement-031@1.0.0`](checks/security/requirement-031/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r031`. Minimum severity: `deny`.

A secret does not use the `NEXT_PUBLIC_` prefix.

Default parameters: `{"verifier":"NEXT-WEBSITE-031"}`.

**Repair:** Bind NEXT-WEBSITE-031 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-031; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 31",
  "paraphrase": "A secret does not use the `NEXT_PUBLIC_` prefix."
}
```

### next-website/NEXT-WEBSITE-032

Check: [`next-website/security/requirement-032@1.0.0`](checks/security/requirement-032/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r032`. Minimum severity: `deny`.

The product does not commit an environment file.

Default parameters: `{"verifier":"NEXT-WEBSITE-032"}`.

**Repair:** Bind NEXT-WEBSITE-032 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-032; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 32",
  "paraphrase": "The product does not commit an environment file."
}
```

### next-website/NEXT-WEBSITE-033

Check: [`next-website/security/requirement-033@1.0.0`](checks/security/requirement-033/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r033`. Minimum severity: `deny`.

A session cookie is `HttpOnly`, `Secure`, and `SameSite`.

Default parameters: `{"verifier":"NEXT-WEBSITE-033"}`.

**Repair:** Bind NEXT-WEBSITE-033 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-033; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 33",
  "paraphrase": "A session cookie is `HttpOnly`, `Secure`, and `SameSite`."
}
```

### next-website/NEXT-WEBSITE-034

Check: [`next-website/security/requirement-034@1.0.0`](checks/security/requirement-034/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r034`. Minimum severity: `deny`.

Responses set `Content-Security-Policy`.

Default parameters: `{"verifier":"NEXT-WEBSITE-034"}`.

**Repair:** Bind NEXT-WEBSITE-034 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-034; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 34",
  "paraphrase": "Responses set `Content-Security-Policy`."
}
```

### next-website/NEXT-WEBSITE-035

Check: [`next-website/security/requirement-035@1.0.0`](checks/security/requirement-035/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r035`. Minimum severity: `deny`.

Responses set `Strict-Transport-Security` after TLS is stable.

Default parameters: `{"verifier":"NEXT-WEBSITE-035"}`.

**Repair:** Bind NEXT-WEBSITE-035 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-035; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 35",
  "paraphrase": "Responses set `Strict-Transport-Security` after TLS is stable."
}
```

### next-website/NEXT-WEBSITE-036

Check: [`next-website/security/requirement-036@1.0.0`](checks/security/requirement-036/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r036`. Minimum severity: `deny`.

Responses set `X-Content-Type-Options` to `nosniff`.

Default parameters: `{"verifier":"NEXT-WEBSITE-036"}`.

**Repair:** Bind NEXT-WEBSITE-036 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-036; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 36",
  "paraphrase": "Responses set `X-Content-Type-Options` to `nosniff`."
}
```

### next-website/NEXT-WEBSITE-037

Check: [`next-website/security/requirement-037@1.0.0`](checks/security/requirement-037/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r037`. Minimum severity: `deny`.

The image config allows only known remote hosts.

Default parameters: `{"verifier":"NEXT-WEBSITE-037"}`.

**Repair:** Bind NEXT-WEBSITE-037 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-037; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 37",
  "paraphrase": "The image config allows only known remote hosts."
}
```

### next-website/NEXT-WEBSITE-038

Check: [`next-website/security/requirement-038@1.0.0`](checks/security/requirement-038/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r038`. Minimum severity: `deny`.

The build fails if a client bundle imports a server-only module.

Default parameters: `{"verifier":"NEXT-WEBSITE-038"}`.

**Repair:** Bind NEXT-WEBSITE-038 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-038; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 38",
  "paraphrase": "The build fails if a client bundle imports a server-only module."
}
```

### next-website/NEXT-WEBSITE-039

Check: [`next-website/metadata/requirement-039@1.0.0`](checks/metadata/requirement-039/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r039`. Minimum severity: `deny`.

Each indexable page sets a title and a description.

Default parameters: `{"verifier":"NEXT-WEBSITE-039"}`.

**Repair:** Bind NEXT-WEBSITE-039 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-039; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 39",
  "paraphrase": "Each indexable page sets a title and a description."
}
```

### next-website/NEXT-WEBSITE-040

Check: [`next-website/metadata/requirement-040@1.0.0`](checks/metadata/requirement-040/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r040`. Minimum severity: `deny`.

Each indexable page sets a canonical URL.

Default parameters: `{"verifier":"NEXT-WEBSITE-040"}`.

**Repair:** Bind NEXT-WEBSITE-040 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-040; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 40",
  "paraphrase": "Each indexable page sets a canonical URL."
}
```

### next-website/NEXT-WEBSITE-041

Check: [`next-website/metadata/requirement-041@1.0.0`](checks/metadata/requirement-041/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r041`. Minimum severity: `deny`.

The site provides a sitemap.

Default parameters: `{"verifier":"NEXT-WEBSITE-041"}`.

**Repair:** Bind NEXT-WEBSITE-041 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-041; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 41",
  "paraphrase": "The site provides a sitemap."
}
```

### next-website/NEXT-WEBSITE-042

Check: [`next-website/metadata/requirement-042@1.0.0`](checks/metadata/requirement-042/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r042`. Minimum severity: `deny`.

The site provides `robots` rules.

Default parameters: `{"verifier":"NEXT-WEBSITE-042"}`.

**Repair:** Bind NEXT-WEBSITE-042 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-042; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 42",
  "paraphrase": "The site provides `robots` rules."
}
```

### next-website/NEXT-WEBSITE-043

Check: [`next-website/metadata/requirement-043@1.0.0`](checks/metadata/requirement-043/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r043`. Minimum severity: `deny`.

A page that users share sets Open Graph fields.

Default parameters: `{"verifier":"NEXT-WEBSITE-043"}`.

**Repair:** Bind NEXT-WEBSITE-043 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-043; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 43",
  "paraphrase": "A page that users share sets Open Graph fields."
}
```

### next-website/NEXT-WEBSITE-044

Check: [`next-website/assets-and-performance/requirement-044@1.0.0`](checks/assets-and-performance/requirement-044/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r044`. Minimum severity: `deny`.

A content image uses the Next.js `Image` component.

Default parameters: `{"verifier":"NEXT-WEBSITE-044"}`.

**Repair:** Bind NEXT-WEBSITE-044 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-044; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 44",
  "paraphrase": "A content image uses the Next.js `Image` component."
}
```

### next-website/NEXT-WEBSITE-045

Check: [`next-website/assets-and-performance/requirement-045@1.0.0`](checks/assets-and-performance/requirement-045/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r045`. Minimum severity: `deny`.

A font loads with `next/font`.

Default parameters: `{"verifier":"NEXT-WEBSITE-045"}`.

**Repair:** Bind NEXT-WEBSITE-045 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-045; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 45",
  "paraphrase": "A font loads with `next/font`."
}
```

### next-website/NEXT-WEBSITE-046

Check: [`next-website/assets-and-performance/requirement-046@1.0.0`](checks/assets-and-performance/requirement-046/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r046`. Minimum severity: `deny`.

A third-party script loads with the `Script` component.

Default parameters: `{"verifier":"NEXT-WEBSITE-046"}`.

**Repair:** Bind NEXT-WEBSITE-046 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-046; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 46",
  "paraphrase": "A third-party script loads with the `Script` component."
}
```

### next-website/NEXT-WEBSITE-047

Check: [`next-website/assets-and-performance/requirement-047@1.0.0`](checks/assets-and-performance/requirement-047/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r047`. Minimum severity: `deny`.

The largest contentful paint stays under 2.5 seconds on a primary page.

Default parameters: `{"verifier":"NEXT-WEBSITE-047"}`.

**Repair:** Bind NEXT-WEBSITE-047 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-047; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 47",
  "paraphrase": "The largest contentful paint stays under 2.5 seconds on a primary page."
}
```

### next-website/NEXT-WEBSITE-048

Check: [`next-website/assets-and-performance/requirement-048@1.0.0`](checks/assets-and-performance/requirement-048/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r048`. Minimum severity: `deny`.

The cumulative layout shift stays under 0.1 on a primary page.

Default parameters: `{"verifier":"NEXT-WEBSITE-048"}`.

**Repair:** Bind NEXT-WEBSITE-048 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-048; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 48",
  "paraphrase": "The cumulative layout shift stays under 0.1 on a primary page."
}
```

### next-website/NEXT-WEBSITE-049

Check: [`next-website/build-and-access/requirement-049@1.0.0`](checks/build-and-access/requirement-049/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r049`. Minimum severity: `deny`.

Type checks pass before deploy.

Default parameters: `{"verifier":"NEXT-WEBSITE-049"}`.

**Repair:** Bind NEXT-WEBSITE-049 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-049; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 49",
  "paraphrase": "Type checks pass before deploy."
}
```

### next-website/NEXT-WEBSITE-050

Check: [`next-website/build-and-access/requirement-050@1.0.0`](checks/build-and-access/requirement-050/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r050`. Minimum severity: `deny`.

The production build runs with `NODE_ENV` set to `production`.

Default parameters: `{"verifier":"NEXT-WEBSITE-050"}`.

**Repair:** Bind NEXT-WEBSITE-050 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-050; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 50",
  "paraphrase": "The production build runs with `NODE_ENV` set to `production`."
}
```

### next-website/NEXT-WEBSITE-051

Check: [`next-website/build-and-access/requirement-051@1.0.0`](checks/build-and-access/requirement-051/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r051`. Minimum severity: `deny`.

The site runs a supported Next.js version with known security patches.

Default parameters: `{"verifier":"NEXT-WEBSITE-051"}`.

**Repair:** Bind NEXT-WEBSITE-051 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-051; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 51",
  "paraphrase": "The site runs a supported Next.js version with known security patches."
}
```

### next-website/NEXT-WEBSITE-052

Check: [`next-website/build-and-access/requirement-052@1.0.0`](checks/build-and-access/requirement-052/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r052`. Minimum severity: `deny`.

An interactive control is reachable by keyboard.

Default parameters: `{"verifier":"NEXT-WEBSITE-052"}`.

**Repair:** Bind NEXT-WEBSITE-052 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-052; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 52",
  "paraphrase": "An interactive control is reachable by keyboard."
}
```

### next-website/NEXT-WEBSITE-053

Check: [`next-website/build-and-access/requirement-053@1.0.0`](checks/build-and-access/requirement-053/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r053`. Minimum severity: `deny`.

An image that conveys meaning has alt text.

Default parameters: `{"verifier":"NEXT-WEBSITE-053"}`.

**Repair:** Bind NEXT-WEBSITE-053 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-053; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 53",
  "paraphrase": "An image that conveys meaning has alt text."
}
```

### next-website/NEXT-WEBSITE-054

Check: [`next-website/build-and-access/requirement-054@1.0.0`](checks/build-and-access/requirement-054/check.json). Default severity: **deny**.

Implementation: `fitness`. Phases: `stop`, `commit`, `ci`.

Languages: language-independent project verification. Cardinality: `singleton`. Dimension: `next-website.r054`. Minimum severity: `deny`.

Text contrast meets WCAG 2.1 AA on a primary screen.

Default parameters: `{"verifier":"NEXT-WEBSITE-054"}`.

**Repair:** Bind NEXT-WEBSITE-054 to a human-reviewed product assertion with scope, applicability, owner, evidence source and freshness controls in its rationale. Include a failing control. Run pregate fitness run NEXT-WEBSITE-054; repair failed assertions. Review conditional applicability instead of returning an unexplained pass.

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
  "locator": "docs/features/next-website-pack.md, rule 54",
  "paraphrase": "Text contrast meets WCAG 2.1 AA on a primary screen."
}
```
