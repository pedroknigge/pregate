# Adopt the original source invariants

0.0.8 includes the conversion of every authored clause of the original
PR catalog into optional project-evidence rules. Inspect the engine and pack
versions before selecting these methods.

The source contains 313 numbered entries but 286 authored clauses. Its 43 workspace
entries share 16 grouped lines. Each group has one obligation, with all its entry
numbers retained in provenance and [the coverage ledger](../../packs/invariant-coverage.json).
The conversion preserves the source text and does not invent missing individual rules.

| Methodology | Clauses | Requirement IDs |
| --- | ---: | --- |
| `maintainability/future-humans` | 100 | `FH-01`–`FH-100` |
| `maintainability/engineering` | 100 | `SE-01`–`SE-100` |
| `pstack/principles` | 23 | `PS-01`–`PS-23` |
| `pstack/operations` | 24 | `PS-24`–`PS-47` |
| `pstack/playbooks` | 23 | `PS-48`–`PS-70` |
| `pstack/workspace` | 16 | Group IDs such as `PS-71-74` and `PS-112-113` |

Existing syntax methodologies remain independently selectable. They provide
partial controls, such as nesting limits; they do not prove a complete semantic
statement about readability, business ownership or a workflow. All 68 core
defaults remain active, regardless of which optional methods you select.

## Select several methods in one review

Save a plan as `source-rules.json`:

```json
{
  "sources": [
    { "kind": "library", "ns": "maintainability" },
    { "kind": "library", "ns": "pstack" }
  ],
  "methodologies": [
    "maintainability/future-humans",
    "maintainability/engineering",
    "pstack/principles"
  ]
}
```

```sh
pregate pack apply source-rules.json --preview
# Review the combined candidate and approve its exact digest in the harness.
pregate audit --json
pregate fitness status --json
```

Select workflow methods only when their policies apply to the team's work.
Selecting a methodology does not execute a skill or adopt a verification command.
For a subset of one method, use a valid command such as
`pack enable maintainability/future-humans --only FH-88 --preview`.
IDs belong to their respective methods: `SE-92` belongs to `maintainability/engineering`.
A batch plan accepts sources, methodologies, optional scope and optional preset
overrides. To review a subset across several methods together, select the methods
and disable only the unwanted rule IDs through explicit overrides in that same
plan. See [batch adoption](../features/guided-pack-adoption.md).

## Supply actual proof

An unbound obligation is `UNVERIFIED`, not a violation inferred from source and
not a passing result. It remains visible in audit; it does not stop all onboarding.
An adopted enforcing binding requires a current successful assertion: absent,
stale, expired or failed proof blocks check and Stop. Pack fixtures test that
receipt mechanism, not 286 independently certified properties of a product.

For each selected requirement:

1. State applicability, exact scope, owner and evidence source in the binding's
   rationale. A conditional workflow needs evidence from the applicable task,
   not a generic command that always exits zero.
2. Implement an assertion that tests the claimed condition and a violating
   control. For example, `FH-88` can test that an order constructor rejects empty
   input and protects its admitted value from caller mutation; `SE-92` can test
   that a linear aggregation has an explicit four-line bound. These examples
   establish only their declared API, not every state or algorithm in the product.
3. Pin the verifier's inputs with `fitness fingerprint`, review its binding in
   the preset, and run `fitness run <ID>`. Source and verification-input changes
   invalidate previous proof. Use freshness limits for external records.
4. Keep unsupported parts visible. A grouped requirement such as `PS-71-74`
   needs proof of its complete source clause, including its applicability.

[Project verification](../features/project-fitness.md) documents the exact binding
fields, fingerprint and reviewed preset commands. Several bindings can enter one
reviewed preset proposal. Reuse a command only when it actually verifies every
requirement to which it is bound; matching names or a green generic suite is insufficient.

## Reproduce the conversion

From the PREGATE source repository with its pinned Bun runtime:

```sh
bun scripts/source-invariants.ts --check
bun scripts/invariant-coverage.ts --check
bun test test/source-invariants.test.ts
bun test test/pack-adoption.test.ts -t 'original source invariants'
```

The generator owns the new evidence check/manifests and five receipt fixtures
per clause. It reads the two original `INVARIANTS.md` documents as data; it never
runs their embedded workflows. Build/CI check drift. The coverage ledger links
every original entry to its actual rule, while preserving separate syntax-slice
references. [Documentation-to-pack authoring](docs-to-rule-pack.md) explains how
to apply the same method to a team's policies or library documentation.
