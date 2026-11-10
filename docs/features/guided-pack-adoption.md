# Guided pack adoption and one reviewed batch

Included in 0.0.6. `scan` prepares
advisory recommendations and `pack apply` validates all selected sources and
methodologies as one proposal. The human reviews one digest; no member activates
before approval. `pack restore` restores committed Git pins without consent or
contract mutation. The guided coordinator can include the selected packs and
scope in the first project proposal; see [guided setup](guided-project-workflow.md).

## Commands and plan format

```sh
pregate scan
pregate scan --plan > plan.json
# Edit the plan to keep only the recommendations you choose.
pregate pack apply plan.json --preview
# Review and use the displayed human approval command.
pregate audit --json
```

`scan --json` includes stack facts, recommendation reasons, custom-pack candidates,
the editable plan and coverage limits. Language and exact dependency names are
facts; custom boundary candidates remain suggestions requiring tested fixtures.
Scan is read-only and works before or after initialization. Unsupported languages
stay uncovered. No architecture or product readiness is inferred from filenames.

Plans accept `sources`, `methodologies`, optional `scope` and optional `overrides`.
A scope-only plan may have empty sources/methodologies. A plan with only overrides
must also name a selected methodology. Scope
and overrides use the preset schema and enter the same human review. No other
fields are accepted. Framework recommendations can include owning-workspace
restrictions through `params.within`; an authored scope or override takes
precedence over automatic suggestions. See [source-scope review](onboarding-scope.md).
For example:

```json
{
  "sources": [
    {"kind": "library", "ns": "typescript"},
    {"kind": "path", "path": ".pregate/packs/team"},
    {"kind": "git", "url": "https://github.com/<team>/<pack>.git", "ref": "<tag-or-commit>"}
  ],
  "methodologies": ["typescript/strict-types", "team/team", "shared/conventions"]
}
```

Paths resolve against the project root, not the plan file. Existing identical
sources are reused; mismatched namespace/source pins require explicit update
review. Unknown fields, namespaces, methodologies, conflicts or failing custom
fixtures reject the whole candidate. Existing overrides and unrelated project
settings are preserved. A plan need not add sources if they are already registered.
An empty plan without a scope proposal is rejected; inspect packs or audit.

## Required first-project workflow

1. Before initial approval, scan the repository and inspect the candidate source
   inventory and scope. Explain detected
   languages, frameworks, libraries, module boundaries and uncertain ownership.
2. Propose applicable optional packs and project-specific custom-pack candidates
   from the actual repository. Explain each recommendation's reason, scope,
   expected checks and evidence limits. Do not invent a custom pack from an
   untested inference or silently activate every methodology of a library.
3. Prepare the selected recommendations as one combined, reviewable contract
   proposal. A recommendation of five packs must be applicable through one
   approval, with source pins, selected methodologies, overrides, effective core
   defaults and the complete resulting diff visible together.
4. Validate the whole candidate before approval. Namespace conflicts, incompatible
   methodologies, missing sources or an invalid custom pack must prevent partial
   activation. A stale digest must preserve the original contract.
5. Apply the exact reviewed batch atomically using the existing in-harness
   approval routes. The agent must not approve its own changes or disable core
   requirements as an onboarding shortcut.
6. Offer a whole-project audit after activation. Show findings, locations,
   unsupported/error coverage and unverified requirements. Then let the user
   choose whether to repair/refactor existing findings or freeze the debt and
   start with protection against new violations. The guided freeze action selects
   no-new; commit a baseline explicitly and use check --ratchet --base <commit>.
   Repair produces a ranked plan and does not edit code.

Freezing a baseline does not declare the code compliant or hide coverage gaps.
Independent pack recommendations and custom-pack authoring remain optional.
Repeating the workflow must preserve existing consent, reviewed selections and
user changes. The user must be able to omit a recommendation from the batch.

## Share a reviewed contract with a team

Commit `.pregate/preset.json`, `.pregate/pregate.lock.json` and local custom-pack
sources, using repository-relative source paths. Another team member uses the
same engine and bundled-pack versions, installs the harness integration and
gives local consent. Repository files do not transfer that consent. Reusable
packs may instead live in their own public or private Git repositories; they do
not need to be submitted to the PREGATE project.

The Git pack importer pins a commit and the lock records its content hash.
Run `pregate pack restore` after cloning to fetch missing pinned Git sources,
verify hashes and fixtures, and preserve preset/lock bytes. It does not resolve
a moving ref or substitute
`pack update` (which selects upstream HEAD), or enable local consent as a side
effect. Private Git sources use the team member's existing Git access. Restore
needs an admitted preset/lock pair and its pinned engine. A corrupt existing
cache object fails validation; restoration does not silently overwrite it.

## Verification required for delivery

- A five-pack recommendation results in one candidate and one approval.
- Valid configurations behave as before; a failed member produces no partially
  applied preset/lock and no unreviewed activation.
- Conflict, stale review, namespace, pin and custom-fixture failures are shown
  before application, with the previous contract preserved.
- Greenfield and brownfield flows support the scan, batch review, audit and
  explicit repair-versus-baseline choice without weakening core defaults.
- A fresh machine can restore pinned Git packs for a cloned project without
  changing its contract or consent. Missing access and hash mismatches are
  explicit failures; a local custom pack works from a relative path after clone.
- CLI reference, daily-use guide and packaged companion document the command forms.

The compiled-engine tests cover five packs in one approval, a wrong digest,
invalid members/schema, changed reviewed source and failing custom fixtures,
advisory scan and a fresh exact-pin cache while upstream HEAD advances. All pass.
The readiness example separately exercises actual assertion failure and repair.
Current no-new ratchets compare changes with their documented Git/session bases;
this feature adds no hidden persistent baseline or automatic refactoring.
