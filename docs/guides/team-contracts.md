# Share rules with a team

The project's reviewed contract belongs in the project's repository. You do not
need to submit it to the PREGATE repository or publish it publicly.

## One project

Commit these files after reviewing the contract:

- `.pregate/preset.json`: selected sources, methodologies, policies and overrides.
- `.pregate/pregate.lock.json`: compiled rules, engine/core versions and source pins.
- Local custom-pack directories referenced by the preset, including their fixtures.

Keep local pack paths relative to the project root. The `pack init` scaffold lives
under `.pregate/packs/<namespace>/`; `pack add --path` records a relative path. A
path to an uncommitted directory outside the project will not exist for another
team member. Review the pack and compile the lock before committing changes.

Each team member clones the project, installs the pinned engine and harness
integration, reviews the existing contract and enables local protection. Use
`pregate status` to check the contract, local consent and integration separately.
Repeating `pregate init` reuses an existing valid contract; it does not recreate
local consent. The human enables it with `pregate enable`, using the supported
approval route. Machine state, approvals, credentials and local cache are not
the shared contract. See [installation](installation.md) and
[in-harness approval](../features/approval-in-harness.md).

## Reuse a pack in several projects

Publish the pack root as its own public or private Git repository. Consumers
add it, review it and select its methodologies. For example:

```sh
pregate pack add https://github.com/<team>/<pack>.git@<tag-or-commit> --preview
# Review and approve, then select the desired methodology.
pregate pack enable <namespace>/<methodology> --preview
```

The importer resolves a commit and the lock records a content hash. A source
addition and methodology activation can be separate reviewed steps.
`pack apply` can combine them for several packs in one reviewed batch.
Updates require review; upstream changes do not silently replace pinned rules.
Private sources use the consumer's Git credentials. Follow the
[pack publishing guide](docs-to-rule-pack.md) for fixtures, provenance and limits.

## Restore a fresh machine

Committed local packs travel with the project. Bundled packs require a compatible
installed engine. External Git packs reside in a local content-addressed cache:
cloning the consuming project does not populate it. 0.0.5 provides
`pregate pack restore` to fetch exactly the committed pins and validate their
recorded content hashes and fixtures. It preserves preset, lock and local consent.
`pack update` is not equivalent: it selects upstream HEAD and prepares a contract
change. Do not describe it as reproducible restoration.

Restore before reviewing/enabling a cloned contract. Missing access, mismatched
hashes and corrupt existing objects fail explicitly. Private sources use the
team member's existing Git access.
[Combined adoption](../features/guided-pack-adoption.md) also adds a batch plan
for multiple sources/methodologies in one review, preserving existing overrides.
