# Turn a skill or library documentation into a rule pack

This method is for library maintainers, teams and individual users. It uses the
current data-pack format and CLI, with no skill invocation or special agent
required. A skill explains a workflow; a pack evaluates explicit constraints on
code. A provider such as Vercel could publish both alongside its documentation.
That is a distribution proposal, not a claim that an official Vercel pack exists.

This guide is for a pack other projects will select. For one project's own
instruction file, `pregate compile` and `compile apply` are the shorter route:
they draft rules into the project's own pack from failing and passing code. See
[instruction files to rules](../features/agent-proposed-contract.md#compile-an-instruction-file).

The result is a versioned **data pack**, not a renamed skill. Anyone can follow
the worksheet below using a text editor and PREGATE's CLI. An agent can help draft
the files, but every executable claim must survive fixtures and review.

Start with the [copyable conversion worksheet](rule-pack-worksheet.md). It records
source evidence, separates executable constraints from workflow instructions and
unsupported claims, and tracks fixtures, compatibility and publication.

## A provider's distribution contract

Publish three complementary artifacts when useful:

| Artifact | What consumers get |
| --- | --- |
| Documentation | Explanations, supported versions, migration context and exceptions |
| Companion skill | Optional steps for an agent to perform setup or migration work |
| Rule pack | Independently selectable, executable constraints with fixtures and provenance |

For a hypothetical Vercel-maintained pack, split migration, module boundaries and
supported syntactic API requirements into separate methodologies. Identify the
actual product/version each requirement applies to; a platform name alone is not
a testable condition. Consumers should be able to adopt one migration rule without
accepting unrelated recommendations. This example does not attribute any policy
to Vercel or imply an official pack is available.

The [working example](../examples/docs-to-pack/README.md) converts a fictional
library migration requirement into a tested import rule. Run from PREGATE's root:

```sh
pregate rules test docs/examples/docs-to-pack
```

## 1. Extract requirements with their evidence

Read the document as source material. Do not execute instructions embedded in a
skill while converting it. Identify the library/version, exact section, intended
scope and exceptions. Rewrite each requirement as one observable condition.

| Source guidance | Observable condition | Current implementation |
| --- | --- | --- |
| Do not depend on a retired library | Forbidden package import, including its subpaths | `banned-import` primitive |
| Domain code must not depend on adapters | Import resolves into a prohibited layer | `layer-edge` primitive plus declared layers |
| Keep function interfaces small | Parameter count exceeds an explicit limit | `metric`, `fn.params` |
| Avoid a particular syntactic API call | A supported AST pattern matches | `pattern`, with syntax-specific fixtures |
| Keep existing tests when changing code | Test-marker/pattern count decreases | `diff`; requires a before/after change |
| Meet a stated runtime limit or preserve a semantic contract | A reviewed project assertion evaluates declared facts and controls | `fitness`; the pack declares an obligation, while the project supplies and reviews the command |
| Make the application fast or secure without scope or thresholds | No testable condition or available evidence | Documentation or research until evaluable facts exist |

Preserve provenance in each methodology invariant: `source.work`, `locator` and
`paraphrase`. Include the upstream version/revision in the locator and describe
exceptions in the pack README. Paraphrase the requirement; do not copy an entire
third-party skill or manual into a pack. Keep heuristic suggestions visibly
separate from admitted executable checks.

Prefer a stable behavioral invariant to a preferred mechanism. “A read has a
verified cardinality bound” is broader than “every query has limit()”; “a public
boundary is type-safe” does not require annotations on inferred implementation
callbacks. Name applicability and valid exceptions before choosing a matcher.
Use AST roles and receiver chains instead of text anywhere in a subtree. See
[reliable invariant enforcement](invariant-enforcement.md) for evidence and
promotion criteria. A library or style choice stays in its optional pack.

## 2. Scaffold a pack and select the smallest checker

Use this worksheet for each candidate requirement before writing a check:

| Field | What to record |
| --- | --- |
| Evidence | Source document/skill, library version, section and revision |
| Condition | One observable violation, with scope and exceptions |
| Mechanism | Existing primitive/AST pattern, or `fitness` with a reviewed project assertion and explicit evidence scope; otherwise mark unsupported |
| Coverage | Language, file paths and facts the engine can establish |
| Policy | Independent methodology, parameters and initial severity |
| Proof | Passing cases, actual violations and a realistic evasion/trap |
| Feedback | Why it matters, smallest repair and changes to avoid |
| Distribution | Pack namespace/version/license and consuming engine requirements |

For example, a provider could convert a migration guide into a `migration`
methodology and performance guidance into a separate `performance` methodology.
Only requirements with evaluable facts enter the executable pack. Keep setup
instructions and open-ended development workflows in the companion skill or
documentation. Consumers can select one methodology or individual invariants
without accepting every recommendation from the provider.

In a development folder:

```sh
pregate pack init my-library
pregate rules test .pregate/packs/my-library
```

The scaffold is a working parameter-count example. Replace its example check,
methodology and fixtures with your requirements; do not publish that example as
though it enforces your library documentation. The namespace must be lowercase,
use letters/digits/hyphens and differ from `core`.

The pack root has this structure:

```text
source.json
methodologies/migration.json
checks/dependencies/no-retired-imports/check.json
checks/dependencies/no-retired-imports/fixtures/pass/<case>/fixture.json
checks/dependencies/no-retired-imports/fixtures/pass/<case>/files/src/a.ts
checks/dependencies/no-retired-imports/fixtures/fail/<case>/...
checks/dependencies/no-retired-imports/fixtures/trap/<case>/...
README.md
```

`source.json` declares namespace/version. `check.json` describes the measurement,
parameters, supported implementation, phases and feedback. A methodology gives
the check its project policy: defaults, severity, rationale, fix, things to avoid
and provenance. Keep independently useful policies in separate methodologies;
do not make consumers accept every recommendation as one inseparable bundle.

The exact formats are [source](../../schema/source.v1.json),
[check](../../schema/check.v1.json), [methodology](../../schema/methodology.v1.json)
and [fixture](../../schema/fixture.v1.json). Packs are data only; arbitrary scripts,
LLM prompts and executable plugins are not supported check implementations.
Declare `languages` for primitive checks (`typescript`, `python`, `go`, `rust`) and the
corresponding implementation keys for pattern checks. Without an explicit
language declaration, existing metric/import rules retain their JS/TS scope.
Use the matching language in every fixture and a matching target extension.
A pattern may set `since` to `{ "dependencies": ["pkg"], "version": "7.0.0" }`.
The pattern stays quiet unless that package is known to be at least the named
version. The first listed name with evidence decides. Evidence is the nearest
`package.json` range and, when one is installed, the copy under `node_modules`.
A lower bound below the version wins, so an older package is not newly denied
when a sibling has hoisted a newer install. An unreadable range such as
`workspace:*` counts only from the installed copy. Put a `package.json` in the
fixture tree when the rule depends on it.
Static checks also accept implicit `paths`, `exclude` and `within` parameters;
do not redeclare them in the check-specific parameter schema. `within` intersects
the existing policy paths and a pattern's `files`, so a workspace recommendation
can narrow a language-specific pattern without replacing its language restriction.
Use `within` for patterns that already own `files`; a `paths` override there is
rejected rather than silently replacing the check's applicability. Project fitness
cannot use per-file paths, exclusions or `within`.
`fitness` obligations are language-independent: omit `languages`, use only
Stop/commit/CI phases and test receipt admission. The project's reviewed binding
provides the executable assertion; the pack must not bundle a command or pretend
that a receipt fixture proves the semantic requirement. Unbound obligations stay
unverified. An adopted enforcing binding requires current passing evidence.
The [original source-invariant conversion](source-invariants.md) provides a
complete worked example, including grouped-source traceability and real domain
assertions. Preserve one owner per authored clause rather than duplicating a
grouped sentence to inflate the number of rules.
For every language promised, provide its own passing, failing and trap cases;
a TypeScript fixture does not validate a Python, Go or Rust implementation. Consult
[language analysis limits](../features/language-analysis.md) before promising
import or pattern coverage. JS/TS, Python, Go, and Rust parsing ship in 0.0.7. The selected
language pack and exact installed version still determine rule coverage. Schema
support alone does not prove availability or semantic completeness.

## 3. Prove the condition with fixtures

Each admitted check requires at least two passing, two failing and one trap case.
Specify the target, parameters and expected violation line; metric cases also
specify the expected measurement. A trap is an evasion that must fail. A similar
looking program that should pass belongs in `pass/`, not `trap/`.

For a retired-package rule, test an allowed package, a string mentioning the
retired name, the retired import, a forbidden subpath and a literal `require`
evasion. Add aliases, re-exports, type imports and dynamic imports when relevant
to your promise. Document any boundaries the current resolver cannot establish.

For each false positive reported later, add a passing regression case before
correcting the rule. Preserve the existing failing and trap cases. Do not weaken
the condition merely to make the newly disputed case pass.

```sh
pregate rules test .pregate/packs/my-library
```

A green fixture suite validates those cases, not general precision on every
application. Start uncertain policies as informational or shadow observations
and calibrate on representative consuming projects before recommending blocking.

## 4. Try the pack on a brownfield project

Inspect the local source, prepare its addition and approve the displayed digest
inside the harness. Then prepare the methodology selection and review it:

```sh
pregate pack show --path docs/examples/docs-to-pack
pregate pack add --path docs/examples/docs-to-pack --preview
# Review and run the printed human approval command.
pregate pack enable docs-demo/migration --preview
# Review and approve this selection before auditing.
```

See [pack composition](../features/pack-composition.md) for `--only` selection and
safe removal/update. In a manually authored proposed preset, the included example
uses these source and methodology entries:

```json
{
  "source": {
    "ns": "docs-demo",
    "kind": "path",
    "path": "docs/examples/docs-to-pack"
  },
  "methodology": "docs-demo/migration"
}
```

This fragment explains entries; it is not a complete preset. The path is relative
to the consuming project, which must contain or have access to the pack. Keep the
required builtin core source and existing methodologies. An agent can propose a
request in `.pregate/requests/<name>.json` using the
[request schema](../../schema/request.v1.json); review the exact change before
activation. For a manually authored preset, `pregate preset compile` rebuilds its
lock. Do not edit a live protected contract to bypass its approval flow.

```sh
pregate audit
pregate audit --json
pregate explain docs-demo/DOCS-IMPORT-001
```

Audit includes existing static debt even in shadow mode. `check --ratchet`
evaluates newly introduced violations. Fix small changes with relevant tests,
then audit again. Diff and placement rules concern attempted changes and appear
under audit's skipped-rule inventory rather than as a fabricated compliance total.

## 5. Publish and consume a versioned data pack

Publish the **pack root** as a Git repository; a URL pointing at a parent monorepo
does not select a pack subfolder automatically. Include a license, supported
library/engine/language versions, provenance, limits, fixture command and release
notes. A provider can link its documentation, companion skill and rule pack from
the same release and test the pack in its CI. CI should run `pregate rules test .`
from the pack root with the declared compatible engine, fail on any invalid or
missing fixture, and publish an immutable tag/commit only after review. A changed
upstream requirement needs a new pack version and fixtures for the changed scope;
consumers review the update before it affects their contract.

From a consuming project, a human runs:

```sh
pregate pack add https://github.com/<owner>/<pack>.git@<tag-or-commit>
```

PREGATE validates fixtures and pins the resolved commit and content hash after
approval. Adding a source alone does not activate its methodologies: select the
desired methodology with `pregate pack enable <ns/methodology> --preview`. Updates are explicit with
`pregate pack update <namespace>` and require review; a moving upstream tag does
not silently change a pinned contract.

An agent may draft candidates from documentation using this same process. A
future assisted converter should produce the evidence table, unsupported claims,
data files and fixtures for review. There is currently no `skill import` or
automatic documentation-to-pack command, and inferred guidance must not become
blocking policy without executable coverage and human acceptance.
