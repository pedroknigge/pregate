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

## 0.2.13 manual Mac publication

The user authorized the now-published manual macOS ARM64 pilot and global update,
superseding the earlier publication deferral. This release uses the immutable
wave 27 archives, installers and manifest whose executable inputs match the
verified integrated source; it does not rebuild them or use GitHub Actions.
Its current source suite, packaged Mac checks and complete 230-sample budget
capture pass. The release tag points to `b2cec675c4abc2fb7b5ed11230c39d113d9fa743`.
Publication/download hashes and installed version/doctor are separate evidence.
See 0.2.13 release notes and
[v0.0.1 release notes](../releases/0.0.1.md).

Linux/Windows archives remain experimental. The current native Windows/manual
report, complete Linux admission and private #10 event evidence remain pending.
The historical workflow description below is unchanged; no workflow was modified
to grant this manual pilot scope. Cross-compilation does not supply native proof.

The first current published Linux ARM64 archive passes its confined native
Docker VM smoke after publication, with unchanged inputs and verified cleanup.
The dated observation
records its exact archive, coverage and remaining platform/UI limits.

## 0.2.5 through 0.2.12 macOS pilot scope

Versions 0.2.5 through 0.2.12 target macOS ARM64. Linux and Windows builds are experimental
and partially functional; complete validation is deferred to the next release
at the user's request. GitHub hosted jobs could not start because account billing
blocked execution. This pilot is published manually from locally verified archives,
with source-suite and exact packaged macOS evidence recorded in the release notes.
The tag workflow explicitly skips those eight pilot tags; later tags retain the
full matrix below. Check delivery status for current publication evidence.
Cross-compilation and checksums do not establish native platform correctness.
Actual harness interaction and full semantic coverage remain separately bounded.

## Standard release workflow

The release workflow now builds once and uploads its archives, installers and
`SHA256SUMS` as `release-candidate`. A shared native workflow checks those same
files on macOS arm64, Linux x64, Linux arm64 and Windows x64. Publication depends
on both the build and the complete native matrix. A failed native job blocks
publication; the publish job downloads the checked artifact rather than rebuilding.
Ordinary CI calls the same native workflow. Post-publication bootstrap remains a
separate check of the GitHub download path.

The matrix uses `macos-15`, `ubuntu-24.04`, `ubuntu-24.04-arm` and `windows-2022`.
GitHub lists these architectures for both public and private repositories in its
[hosted-runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
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
fitness smoke scripts. In the 0.2.7/core 0.3.0 candidate, fitness smoke asserts all
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

PR correction `38b48774` passed all four packaged native targets in
[CI run 37179614820](https://github.com/pedroknigge/pregate/actions/runs/37179614820),
but failed five Windows full-suite cases. The follow-up diagnostic candidate
`7773050a` failed a concurrent Windows event write and the first Linux E2E
repository copy in [run 37183114878](https://github.com/pedroknigge/pregate/actions/runs/37183114878);
all five fresh-process Windows diagnostic suites passed. The next correction,
`cb4ff10b`, passes Linux, the complete Windows suite/bootstrap and three native
targets in [run 37183758135](https://github.com/pedroknigge/pregate/actions/runs/37183758135).
Native Windows times out after printing all six documentation fixture results.
These observations do not establish a common runtime cause. The separate core-0.2.0
candidate passes 4,020 local tests, all-target packaging and exact Mac native
checks including bounded fitness verification. Its own 48 project assertions,
the complete hosted matrix and calibration remain pending. All 48 must ship
active in this next release. Project-specific semantic certification remains
distinct from verification of the shipped enforcement mechanism. These results
do not authorize publication.

The isolated Bun 1.4.2 core candidate passes 4,020 local tests (two Windows-only
skips), all packaged Mac product checks and the unchanged latency budgets in a
quiet 30-sample run. Its first Windows trial fails with empty successful stdin
responses. A minimal source/compiled reproduction confirms this behavior before
any PREGATE policy executes. The subsequent descriptor-read correction passes
the full PR matrix, including all four native targets and 2,079 Windows tests.
PR #1 is merged at `7685fc50`. The separate core candidate passes 4,022 local
tests, exact Mac native product checks and every unchanged latency budget.
The later core candidate `e99e3aa1` passes 4,025 Linux tests, 3,903 Windows tests,
Windows bootstrap and all four native product targets in
[run 37188481028](https://github.com/pedroknigge/pregate/actions/runs/37188481028).
Both repository self-gates still fail because the 48 project-specific bindings
are absent. Platform smoke success does not approve these assertions or admit the
release. Linux's fixture
copy failure is a disappearing Git maintenance lock, addressed by disabling
automatic maintenance/GC only in temporary fixture repositories. See the
[v0.0.1 release notes](../releases/0.0.1.md) for candidate links and exact boundaries.

CI records whether the tested Linux job successfully uploaded the candidate.
Native bootstrap/smoke can then run even if the subsequent repository self-gate
fails, so platform evidence is available for remediation. The self-gate failure
still fails CI; it does not grant admission or publication. The release workflow's
strict build/native publication dependencies are unchanged.

The following observations retain the boundaries of their earlier candidates.

Local macOS verification passes offline bootstrap and all native product checks,
including a candidate directory containing spaces and an apostrophe. Five
admission regressions reject altered archive/installer hashes, missing or
ambiguous archive checksum entries, and a wrong native target before bootstrap.
Workflow YAML parses and its publication dependency graph has been inspected.

Local Linux ARM64 verification now also passes in an offline, read-only-mounted
Docker container using the actual ARM64 image and packaged Linux binary. The same
candidate set passes Mac verification and all six archive/installer checksums.
A single-target build replaces the manifest with only its selected archive and
the installers; rebuild all targets before checking another leftover archive.
See the native observations.

The first hosted matrix for commit `f3f9fed` passed packaged Mac, Linux x64 and
Linux ARM64; its Windows candidate failed during offline bootstrap because
`Get-FileHash` was unavailable in the inherited PowerShell module environment.
See [CI run 37173177266](https://github.com/pedroknigge/pregate/actions/runs/37173177266).
The gate correctly kept that candidate from satisfying release verification.

The follow-up gives the running PowerShell host's own modules first priority in
the installer, launcher, encoded hooks, archive build and update extraction.
This preserves custom paths while avoiding incompatible modules inherited from
PowerShell 7 through an intermediate process, a failure mode described by
[Microsoft](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-7.6).
That explanation matches the log; corrected native Windows verification remains
pending. A Windows-only regression reproduces incompatible utility-module
autoloading, then checks hashing through the fixed hook command and installer
checksum rejection. It is skipped on Mac and must pass on Windows.
The separate Windows full-suite job timed out after fixture errors: feedback
used a colon-containing session folder, and issue tests recorded noncanonical
roots. Those fixtures now use Windows-safe session names and canonical roots.
The job also stalled in the language workflow; per-subprocess 20-second limits
now report the terminated command without increasing the job's 20-minute budget.
The cause of that language-workflow stall remains unproven until the corrected
Windows run supplies evidence.

These smokes exercise production native
protocols with explicit human CLI automation; actual harness interactions remain
separate checks. Codex 0.160.0's human `!` route now passes in an isolated Mac TUI,
while its model self-approval prevention and the other harness UIs remain pending.
The earlier reference-machine shell latency miss is historical. The later quiet
Bun 1.4.2 core candidate passes the unchanged budgets (30 samples per route), as
recorded in the current status ledger. Neither successful native smoke nor CI's
informational benchmark overrides a failed release gate.
