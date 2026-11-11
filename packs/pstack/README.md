# pstack

Bounded syntax checks and optional project-evidence obligations for pstack principles
and workflows. `any`, enums, non-null assertions, exhaustive switches and
`console.log` stay in the typescript and vibe-proof packs. Process and design
requirements need reviewed task/project assertions; a syntax tree cannot prove them.

The joint conversation review
connects verification, deterministic tooling and recurring failures to PREGATE's
actual update/onboarding paths. The [domain-language guide](../../docs/guides/domain-language.md)
shows a runnable typed command vocabulary and how to combine this pack with
project assertions and the optional mattpocock testing/design slices. These are
workflow and project-design aids; the pack's 97 check contracts are unchanged.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `pstack/PS-ZOD-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `PS-ZOD-001` | Importing zod, valibot, ajv, superstruct, yup, or io-ts from domain, core, or entity files. | A validator in the domain makes the model depend on a parsing library and invites business rules to re-parse data they should already trust. | deny |
| `PS-AS-001` | A type assertion in a domain file, other than `as const`. | An assertion tells the checker to trust the author. In the domain that lie becomes a business rule that was never parsed. | deny |
| `PS-PARTIAL-001` | An exported function whose parameter type contains Partial<...>. | A Partial patch hides which fields the operation is allowed to change. Callers invent combinations the domain never named. | deny |
| `PS-LEGACY-001` | An import, re-export, `import()` or `require()` whose project-internal specifier (`./`, `../`, `@/`, `~/`, `#`) contains a `.legacy` suffix or a `/legacy` segment. | A compatibility path keeps two APIs alive. Callers of the old one never move, so the deletion the change was for does not happen. | deny |
| `PS-LET-001` | A `let` binding that is not inside a function, method, class, for loop, or catch. | A module-level let is hidden state. A reader of one function cannot know who else writes it. | deny |
| `PS-COMMENT-001` | A comment that is not a TODO/FIXME/HACK/XXX with an owner, a suppression the tools honor, a license, a triple-slash reference, a JSDoc block, a URL citation, or a comment with a reason word such as because, so or to avoid. A comment that carries `@deprecated` is always reported. The pattern cannot compare a comment with the code after it, so a finding is a candidate, not a proof of narration. | A narration comment goes stale and splits the reader's attention. The code should carry the fact. An owned TODO is a tracked debt, not narration. | warn |
| `PS-COMMENTED-001` | A comment whose body starts with const, let, function, class, import, return, or if. | Commented-out code is a second implementation. Readers do not know whether it is the old behavior, a sample, or the one that should run. | deny |
| `PS-WEAK-001` | toBeDefined, toBeTruthy, toBeFalsy, toBeUndefined, toHaveBeenCalled, or toHaveBeenCalledTimes in a test file. | Those matchers pass when the value is merely present or the function was merely called. A wrong total, a wrong argument, and undefined-returning fakes still go green. | deny |
| `PS-EXPECT-001` | An it() or test() call whose body contains no expect() or assert() / assert.* call. | A test that never asserts stays green when the behavior is wrong. Running a function is not a proof of what it returned. | deny |
| `PS-AAA-001` | `if`, `switch`, or ternary expressions inside a direct test/it callback. | SE-84: Branching tests can mirror the implementation; some property-based tests intentionally branch. | warn |
| `PS-IDEM-001` | A charges, paymentIntents, transfers, refunds, or payouts create/capture/confirm call whose arguments do not mention idempotency. | Those calls move money. Without a key, a timeout and a retry post the operation twice. | deny |

## Methodologies

- `pstack/boundaries` — PS-ZOD-001, PS-AS-001, PS-PARTIAL-001, PS-LEGACY-001
- `pstack/reader-load` — PS-LET-001, PS-COMMENT-001, PS-COMMENTED-001
- `pstack/proof` — PS-WEAK-001, PS-EXPECT-001, PS-AAA-001
- `pstack/effects` — PS-IDEM-001
- `pstack/principles` — 23 evidence obligations, `PS-01`–`PS-23`.
- `pstack/operations` — 24 evidence obligations, `PS-24`–`PS-47`.
- `pstack/playbooks` — 23 evidence obligations, `PS-48`–`PS-70`.
- `pstack/workspace` — 16 evidence obligations covering the source's grouped entries `PS-71`–`PS-113`.

The full 113-entry source catalog is in [INVARIANTS.md](INVARIANTS.md).
Its 86 authored clauses become 86 optional `fitness` obligations. For example,
source entries 71–74 share `PS-71-74`; one assertion must cover that whole clause.
No missing individual text is invented. Unbound obligations stay unverified;
adopted enforcing assertions require current passing evidence. Selecting a workflow
rule does not invoke its skill. See [adoption and evidence](../../docs/guides/source-invariants.md)
and the semantic limits in [BACKLOG.md](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **process**. Version: `1.2.0`. 97 distinct check IDs.

Methodologies: `pstack/boundaries` (complete), `pstack/effects` (complete), `pstack/operations` (preview), `pstack/playbooks` (preview), `pstack/principles` (preview), `pstack/proof` (complete), `pstack/reader-load` (complete), `pstack/workspace` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
