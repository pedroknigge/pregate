# Agent practices

Included in 0.0.10.

22 optional preview evidence rules distilled from user-supplied posts. Choose
the relevant policy without changing core or adopting every recommendation:

| Methodology | IDs | Purpose |
| --- | --- | --- |
| `agent-practices/launch-safety` | PRACTICE-001–006 | Conditional child-data safeguards, font privacy, session replay, email, subscriptions and DMCA operations |
| `agent-practices/security-review` | PRACTICE-007–012 | Threat model, triage, restricted PoC execution, reproducibility, patch verification and reviewed reporting |
| `agent-practices/domain-ownership` | PRACTICE-013–016 | One rule owner, public contracts, verified consolidation and presentation boundaries |
| `agent-practices/behavior-testing` | PRACTICE-017–022 | Acceptance/failure analysis, realistic E2E, reproducible artifacts and behavioral regression coverage |

```sh
pregate pack show --library agent-practices --json
pregate rules test --library agent-practices
```

Save the policies you choose as `agent-practices.plan.json`. This example selects
all six launch-safety requirements; select other methodologies only when they
apply to the project:

```json
{
  "sources": [{"kind": "library", "ns": "agent-practices"}],
  "methodologies": ["agent-practices/launch-safety"]
}
```

```sh
pregate pack apply agent-practices.plan.json --preview
# Review the source and selected requirements together, then use the displayed
# digest-bound human approval command in the harness. One approval applies both.
pregate fitness status --json
```

`pack add` also permits source-only registration. For individual-rule selection,
`pack enable agent-practices/launch-safety --only PRACTICE-002,PRACTICE-003 --preview`
prepares a separate reviewed selection after registration.

These language-independent `fitness` obligations run at Stop/commit/CI after
project verifier adoption. Missing bindings remain **UNVERIFIED**. Enforcing
bindings require current passing proof; receipt fixtures validate this gate,
not a product's legal compliance, security or test quality. The pack supplies
no executable verifier, installs no skill and executes no exploit.

The [canonical requirements and evidence ledger](../../docs/features/agent-practices-pack.md)
explain applicability, authoritative sources, overlap with existing packs and
rejected literal interpretations. Legal thresholds and deadlines come from a
current jurisdiction-specific review; no universal age gate or fine is imposed.
See [binding and freshness](../../docs/features/project-fitness.md) and the
[documentation hub](../../docs/README.md). Generate data with
`bun scripts/readiness-packs.ts`; verify drift with `--check`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **practice**. Version: `1.0.0`. 22 distinct check IDs.

Methodologies: `agent-practices/behavior-testing` (preview), `agent-practices/domain-ownership` (preview), `agent-practices/launch-safety` (preview), `agent-practices/security-review` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
