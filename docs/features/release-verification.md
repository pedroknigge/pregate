# Verify a packaged candidate before publication

## One evidence record

`bun run scripts/verify-candidate.ts <evidence.json>` runs typecheck, the complete
suite, the host build with all its pre-checks, native packaged smoke and strict
latency in order. It writes one JSON record: commit, dirty file count, Bun version,
target, each step's exit code, duration and result lines, and a `pass`, `fail` or
`incomplete` verdict. `--skip <step,step>` records a step as skipped rather than
hiding it. Cite this record in release notes instead of rebuilding the table by
hand. It covers the host target only; other platforms and actual harness UI
remain separate evidence.

## Published 0.0.2

[v0.0.2](https://github.com/pedroknigge/pregate/releases/tag/v0.0.2) is the published release. The tag commit is `92f60f0aa88cfc645d3aaea3181691065624fcbc`. macOS ARM64 is the stable platform. Linux and Windows archives are published and remain experimental until native validation is recorded. The manual Windows procedure is [windows verification](../guides/windows-verification.md). Cross-compilation and checksums do not by themselves prove a platform. See the [changelog](../../CHANGELOG.md) and [v0.0.1 release notes](../releases/0.0.1.md).

## Standard release workflow

The release workflow now builds once and uploads its archives, installers and
`SHA256SUMS` as `release-candidate`. A shared native workflow checks those same
files on macOS arm64, Linux x64, Linux arm64 and Windows x64. Publication depends
on both the build and the complete native matrix. A failed native job blocks
publication; the publish job downloads the checked artifact rather than rebuilding.
Ordinary CI calls the same native workflow. Post-publication bootstrap remains a
separate check of the GitHub download path.

The matrix uses `macos-15`, `ubuntu-24.04`, `ubuntu-24.04-arm` and `windows-2022`.
GitHub documents these images in its
[hosted-runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
This repository is public.
The verifier also checks the actual host against the declared target, so a runner
architecture mismatch cannot count as verification of another platform.

## Run the same check locally

After `bun run build`, run:

```sh
bun run scripts/smoke-native.ts
# Or verify downloaded candidate files and require the expected host:
bun run scripts/smoke-native.ts dist darwin-arm64
```

The script verifies the selected archive and installer against unique checksum
entries before running bootstrap. It uses the installer's existing offline
archive/hash inputs and temporary HOME, data, state and harness directories.
It checks the installed engine/core version and passes that exact installed
binary to the Stop/repair, storage/recovery, feedback, mixed-language and project
fitness smoke scripts. Fitness smoke asserts all
68 enforcing core defaults and 64 initially unverified requirements without blocking onboarding, then adopts
one explicitly reviewed domain assertion. It detects an actual empty-order shipping defect, stale source
evidence and an unreviewed verifier change. Its other 63 requirements are
active and explicitly unverified during that test; this is not certification of all 64
project semantics. It also runs the six documentation-to-pack fixtures. It never publishes
an issue or release. Temporary state is removed after completion or failure.
Feedback smoke also records a real finding, attaches an explicit public
reproduction to its issue draft and verifies that the exported JSON replays
identically through the installed binary, without submitting the issue.

The individual smoke scripts accept an optional candidate binary path; without
it they retain their existing `dist/` binary default:

```sh
bun run scripts/smoke-stop.ts /absolute/path/to/candidate
```

## Evidence and limits

Candidate SHAs, action-run links, and timings from before the public 0.0.x line are not evidence for v0.0.2. Quote a run only after you open it on [pedroknigge/pregate](https://github.com/pedroknigge/pregate) and it shows the commit you mean.

CI records whether the tested Linux job uploaded the candidate. Native bootstrap and smoke can then run even if a later repository self-gate fails, so platform evidence is available while the failed job still blocks admission. The release workflow still requires the native matrix before publication. Post-publication bootstrap checks the GitHub download, including signature verification when cosign is installed.

These smokes exercise production native protocols with explicit human CLI automation. Actual harness UI interaction remains a separate check. A passing smoke or an informational benchmark does not override a failed release gate.
