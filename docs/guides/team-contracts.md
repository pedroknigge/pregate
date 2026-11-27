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

Each team member clones the project, installs Pregate and runs `pregate enable`
in the checkout. Any engine version reads the contract: when the lock was written
by another version, the engine judges from `.pregate/preset.json`. `pregate status`
says in three lines whether Pregate is on, what needs attention and the next step.
Machine state, credentials and local cache are not the shared contract. See
[installation](installation.md).

A change that loosens the contract is reviewed like any other change, in the pull
request. Locally it is a note and nothing blocks. `pregate check --ratchet` in CI
fails until a maintainer accepts that change's digest with the repository variable
`PREGATE_ACCEPT_CONTRACT`. A repository without that CI job has nothing that holds
a loosened contract. See [contract loosening](../guarantees.md#contract-loosening).

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
cloning the consuming project does not populate it. 0.0.19 provides
`pregate pack restore` to fetch exactly the committed pins and validate their
recorded content hashes and fixtures. It preserves preset, lock and local consent.
`pack update` is not equivalent: it selects upstream HEAD and prepares a contract
change. Do not describe it as reproducible restoration.

Restore before reviewing/enabling a cloned contract. Missing access, mismatched
hashes and corrupt existing objects fail explicitly. Private sources use the
team member's existing Git access.
[Combined adoption](../features/guided-pack-adoption.md) also adds a batch plan
for multiple sources/methodologies in one review, preserving existing overrides.
