# Rule pack library

Choose the engineering policies your project needs. Bundled packs contain data:
source metadata, executable checks, pass/fail/trap fixtures and methodology manifests.
Local directories and pinned Git repositories use the same format.

The [design-invariants pack](design-invariants/README.md) adds 48 optional
evidence gates for supplied design statements that are not already active core
invariants. The ledger maps all 104 statements. Core stays on, and a receipt
does not prove the principle.

The [agent-practices pack](agent-practices/README.md) offers four independent
preview policies for launch safety, security review, domain ownership and
behavioral testing. Its 22 evidence gates preserve applicability and require
reviewed project assertions; they do not certify legal compliance or execute
security skills.

The [complete generated inventory](../docs/packs.md) lists every pack, category,
methodology ID, preset recipe and rule reference. Individual `REFERENCE.md` files
show defaults, provenance, repair guidance and limits; `BACKLOG.md` records coverage
that is not implemented. Manifest status does not certify the entire framework.

```sh
pregate pack list --library
pregate pack list --library --category language
pregate pack show --library typescript --json
pregate rules test --library typescript
pregate pack add --library typescript --preview
# Approve the displayed digest, then select what is useful.
pregate pack enable typescript/strict-types --only TS-SWITCH-001 --preview
```

Categories are `invariants`, `language`, `pattern`, `library`, `practice` and
`process`. They describe sources and filter discovery; they do not select rules.
The builtin core contains 64 project fitness requirements, retaining the original
48 identities, and four general change guards. All 68 are active by default.
Language and practice policies live in optional packs.
A category can
exist without a bundled source. TypeScript, JavaScript, Python, Go and Rust are parsed directly by the engine.

The [mattpocock pack](mattpocock/README.md) derives seven optional warning checks
from a pinned review of all 20 Matt Pocock engineering skills. Its
[coverage ledger](mattpocock/INVARIANTS.md) separates executable slices from
workflow requirements and semantic design judgments.

The [security-audit pack](security-audit/README.md) derives optional static
hardening checks for Python, Go, Rust and TypeScript from a pinned review of the
Cloudflare security-audit skill. It is not affiliated with Cloudflare, and a
passing check is not a security proof.

## Control adoption

Use `guide --preview --packs <ns,ns>` or an edited `scan --plan` with
`pack apply <plan.json> --preview` to combine source registration, rule selection
and scope in one review. Individual `pack add` and `pack enable` operations remain
available. Select individual invariants with `--only`, or propose parameter, severity and
enforcement overrides. Ordinary rules can enforce, observe in shadow, warn or
remain off. Core enforces by default and permits reviewed explicit disable.
Explicit resolutions settle
conflicting checks; different implementations are not automatically proven compatible.
See [composition and update semantics](../docs/features/pack-composition.md).

The [313-entry invariant inventory](invariant-coverage.json) records nominal
FH/SE/PS prose and referenced syntactic slices. A reference does not enforce the
entire claim; workflow entries are not executable checks. Regenerate/verify with
`bun scripts/invariant-coverage.ts [--check]`.
[Coverage corrections](COVERAGE.md) and [engine requests](ENGINE-REQUESTS.md)
describe known limits. The [dcouplr pack](dcouplr/README.md) contains 82 checks:
26 static slices and 56 project-evidence requirements. It remains a preview;
arbitrary library flow and semantic correctness are not statically proven.

## Publish your own pack

Follow the [documentation/skill conversion guide](../docs/guides/docs-to-rule-pack.md),
[worksheet](../docs/guides/rule-pack-worksheet.md) and
[tested example](../docs/examples/docs-to-pack/README.md). Publish precise,
provenance-backed requirements with real pass/fail/trap cases. Keep unsupported
semantic claims and open-ended workflows visible instead of labeling them enforced.
