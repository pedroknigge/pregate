# Release checklist

A release is the tag `v<version>` where `<version>` is the `version` field of `package.json`. The [release workflow](../../.github/workflows/release.yml) builds and publishes that tag. This checklist is the human step that workflow does not do.

## Before the tag

- `package.json`, the installers, and the changelog name the same version.
- `bun scripts/docs-reference.ts --check` matches the generated references.
- [Candidate verification](../features/release-verification.md) has a record for this commit.

## Real repositories

Pull-request CI does not clone external repositories. The evidence run is [real repository evidence](../../.github/workflows/real-repo-evidence.yml). It starts on `workflow_dispatch`, and again when the version tag is pushed.

- Run it on the commit you are about to tag, or download the artifact from the tag's run.
- The artifact is `real-repo-evidence`. It contains `evidence/<version>/real-repos.md` and `evidence/<version>/real-repos.json`.
- Read the blocked rows (action, reason, fix, side effect), the allowed rows, and the false-positive and false-negative candidates. A candidate is a mismatch with the fixed replay, not a product change by itself. A failed job still uploads the directory when the script managed to write it.
- The report's pregate version is the `pregate --version` line of the binary built from that commit.

## Attach it

Release notes follow [TEMPLATE.md](TEMPLATE.md). They are not complete until `real-repos.md` and `real-repos.json` from that artifact are attached to the GitHub release. The publish job does not wait for the evidence job and does not upload those files. Downloading them and attaching them is part of cutting the release.

The same directory is gitignored. Do not commit a clone or a generated report to the repository.
