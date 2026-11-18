# Release notes template

Copy this into the GitHub release for the version in `package.json`. Replace each bracketed instruction with the text for that release. Historical notes in this directory are the copies that shipped. This file is the empty shape.

## Summary

[One paragraph: what changed for someone who already ran `pregate enable`. A project that never ran it is unchanged.]

## Real repositories

Attach `real-repos.md` and `real-repos.json` from the `real-repo-evidence` artifact of [real repository evidence](../../.github/workflows/real-repo-evidence.yml) for this tag. The [checklist](CHECKLIST.md) is the step that downloads them. The notes are not complete without those two files.

- Pregate version from the report: [paste the version line]
- Repositories: [one line per pinned repository: name, commit, blocked count, allowed count]
- False positive candidates: [none, or the action and the reason]
- False negative candidates: [none, or the action and the decision]
- Side effects checked: a denied edit left the witness file unchanged; an allowed edit was written by the harness after the allow

## Candidate record

[Link the `verify-candidate` record and the native smoke runs. See verify a packaged candidate.](../features/release-verification.md)

## Install

[The install line for this version, from the installation guide. Do not invent a second version.](../guides/installation.md)
