# Verify the release candidate on Windows

This is the manual handoff for David or another Windows tester. It runs the same
native Windows suites used by CI and the supplied production archive. The report
identifies the source commit, runtime, artifact hashes and each check's exit code.
Writing this guide does not mean Windows has passed.

## Published 0.2.13 assets

The [0.2.13 release](https://github.com/pedroknigge/pregate/releases/tag/v0.2.13)
is a Mac ARM64 pilot; its Windows archive remains experimental. For a current
retry, use a clean checkout of tag commit
`b2cec675c4abc2fb7b5ed11230c39d113d9fa743` and download its metadata and three
Windows inputs into an empty candidate directory:

```powershell
git clone -c core.longpaths=true https://github.com/pedroknigge/pregate.git pregate-0213
if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
Set-Location pregate-0213
git checkout --detach b2cec675c4abc2fb7b5ed11230c39d113d9fa743
if ($LASTEXITCODE -ne 0) { throw 'Checkout failed' }
gh release download v0.2.13 --repo pedroknigge/pregate --pattern CANDIDATE.json --pattern pregate-0.2.13-windows-x64.zip --pattern install.ps1 --pattern SHA256SUMS --dir C:\pregate-candidate
if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
```

For this route, HEAD must be the published `b2cec675` commit and status empty;
use Bun 1.4.2 and the hash/verifier controls below, skipping the retained
handoff's clone/checkout commands. Select a new report directory. `CANDIDATE.json` binds the
release tag to the unchanged wave 27 runtime inputs. The tag differs from the
retained `39ef4ebd` source binding only through documentation changes.
Publication does not supply a Windows native or manual harness result.

## Retained post-PR24 and PR30 handoff

[PR #24](https://github.com/pedroknigge/pregate/pull/24) and
[PR #30](https://github.com/pedroknigge/pregate/pull/30) are merged. Use the
maintainer's `pregate-windows-post-pr24-39ef4ebd.zip` handoff bundle, SHA256
`c04667fb5ee3f229fd4b6475e103af33ce050abb8d932c1bebdf51882831edca`.
Extract its `WINDOWS-HANDOFF.md`, production Windows ZIP, `install.ps1` and
`SHA256SUMS` together. This immutable earlier handoff remains valid for its exact
source binding and is retained independently of the published-tag route above.
Linux/Windows remain experimental; this retry does not depend on GitHub Actions.

The required clean source commit is
`39ef4ebd6556dc3961839cf6fc05fa4b1d851c05`. Its tree exactly matches the verified
source: 6,790 passes, four Windows-only skips, zero failures and 92,740
assertions in the complete Mac source suite. Human repository admission is
complete and issues #19 and #25–#29 are closed; #10 remains open. These results
do not certify Windows. Native Windows and manual harness checks remain pending.
Older candidate hashes, author reports and hosted-job records retain their
historical scope. See current integration.
The bundle's instructions were prepared before wave 33 and retain an earlier
failed latency result. The current complete budget capture
passes; the bundle bytes, source binding and asset hashes remain unchanged.

From a folder without an existing checkout, use PowerShell:

```powershell
git clone -c core.longpaths=true https://github.com/pedroknigge/pregate.git pregate-post-pr24
if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
Set-Location pregate-post-pr24
git checkout --detach 39ef4ebd6556dc3961839cf6fc05fa4b1d851c05
if ($LASTEXITCODE -ne 0) { throw 'Checkout failed' }
git rev-parse HEAD
git status --porcelain
bun --version
bun --revision
```

HEAD must match the exact commit, status must be empty and Bun must be 1.4.2.
Retain the version and revision output. Set `$candidate` to the extracted asset
folder and select a new report directory:

```powershell
$candidate = 'C:\pregate-candidate'
$expected = @{
  'pregate-0.2.13-windows-x64.zip' = '904cf6cbc4817f00a9557c8097400497e6b5e5ddb5cc5eadd1e29630271ee169'
  'install.ps1' = '4ccedc9bd0f33ff383014bb6ed78b715b06fb25f409405bf03057334a45aa28f'
  'SHA256SUMS' = 'd0389d18488bdc943ae5c6a18941432043bf86947cebf11bb1d3214de7c913cc'
}
foreach ($name in $expected.Keys) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $candidate $name)).Hash.ToLowerInvariant()
  if ($actual -ne $expected[$name]) { throw "Incorrect hash: $name" }
}
bun scripts/verify-windows.ts --artifacts $candidate --report C:\pregate-post-pr24-report
```

The immutable wave 27 runtime manifest SHA256 is
`a991c3aa5102ef8aa4653be243a172ca7e57ff4a18ab0a2cbf34c0d8755815d6`;
the Windows executable SHA256 is
`a6ba71d3cde476c3c26956804c90f4ac16157aa33fcc715f445c5a960ac3b8a5`.
The later test-fixture repair, plan changes and approved contract leave runtime
inputs identical. Keep this source/archive binding even if main later receives
documentation changes. A newer branch head or rebuilt binary needs its own
verified mapping and native report.

## Development follow-up

Native feedback on intermediate heads of PRs
[#13](https://github.com/pedroknigge/pregate/pull/13),
[#14](https://github.com/pedroknigge/pregate/pull/14) and
[#15](https://github.com/pedroknigge/pregate/pull/15) reports isolated suites
passing. The complete report was still in progress when reviewed on 2026-10-06.
Review then removed an unsafe inactive shortcut, added a final command-length
guard, bounded decoding of foreign compressed registrations, and included hidden
consent records in fallback discovery. Earlier results do not certify these edits.

[PR #24](https://github.com/pedroknigge/pregate/pull/24), now merged, reports native Windows
11 x64 results with Bun 1.4.2: the published 0.2.9 handoff passed 10 of 11 runner
steps, while the complete suite exceeded its 20-minute deadline. At PR head
`dc8eb434022b769920b0a45ba3c5d58992ea754d`, the author reports the affected suites,
typecheck, generated references and self-gate passing separately. These are
external results; no complete native report for the integrated candidate or
manual guide checks is recorded here. The manual checks still include two
disposable projects, cancellation, old-engine update, a custom pack and disabled
consent. Preserve the final source/artifact identities with those results.

The local review retains quoted launcher paths, bounded overlong path components
and the separate Windows suite deadline. Focused local regressions are not a
native Windows run. The PR's hosted test job did not start because of account
billing/spending limits, so its status supplies no additional test result.

For development validation, use a clean checkout of the final reviewed commit
with the pinned Bun version, then run from the repository root:

```powershell
bun test test/windows.test.ts test/windows-distribution.e2e.test.ts
bun run build
bun scripts/verify-windows.ts --artifacts dist --report C:\pregate-reviewed-report
```

The report directory must be new. The first command includes the new hidden-consent
regression for both a live and missing launcher. The complete runner isolates installs
and records the commit and archive hashes. Locally built development archives are
not substitutes for the current wave 27 handoff artifacts; retain their reports separately.
Actual harness UI approvals still require independent evidence. See the
reviewed command and latency limits.

The procedure is committed in the repository. Use the source commit associated
with the supplied candidate, not an older installed version or a moving branch.
The maintainer supplies the exact commit and artifact checksums together. An
intermediate candidate report does not automatically admit a later final build.

## Before running

Use Windows x64 with Git and the exact Bun version in `.bun-version`. Clone the
private project with your own authorized GitHub account and check out the candidate
commit supplied with the artifacts. Do not send credentials. Use a clean checkout.
The dependency install and dcouplr source probe need internet access.

Some fixture paths exceed Windows' 260-character limit, so a plain clone stops with
"Filename too long". Clone with long paths enabled for that repository:

```powershell
git clone -c core.longpaths=true https://github.com/pedroknigge/pregate.git
```

Put these files from the candidate build in a separate folder, for example
`C:\pregate-candidate`:

- `pregate-<version>-windows-x64.zip`
- `install.ps1`
- `SHA256SUMS`

Use the exact supplied production artifacts, rather than rebuilding the Windows
binary to substitute for them. Their checksums are verified before bootstrap.
The release maintainer must compare the report hashes with the admitted build;
a self-consistent checksum file alone does not establish its origin.

## One command

From the repository root in PowerShell:

```powershell
bun scripts/verify-windows.ts --artifacts C:\pregate-candidate
```

An optional `--report C:\pregate-report` selects a **new** output directory. Otherwise
the command prints its report directory under the Windows temporary directory.
Do not run as administrator. All PREGATE installs, updates, configuration and
test projects use temporary homes; the tester's global PREGATE is not updated.
Each subprocess has a 20-minute deadline, except the Windows suite, which gets 60
minutes. PR #24 reports about 33 minutes for a file-by-file run on Windows 11 x64;
that external timing does not certify the combined verifier or manual checks.
A dependency-install failure stops
dependent checks; other failures remain recorded and do not become a pass.

The run checks type analysis, generated documentation, native onboarding, Windows
bootstrap/update/uninstall, the Windows-compatible test suite, the pinned dcouplr
runtime, production-archive smoke flows and the repository's current self-gate.
Four POSIX-fixture suites are excluded explicitly; native bootstrap and supervisor
coverage run instead. Actual coding-harness UI approvals need separate evidence.
The reference checks accept a normal CRLF checkout without rewriting it; semantic
changes to generated output still fail. This behavior has a local regression test.
Since 0.2.20 ([PR #59](https://github.com/pedroknigge/pregate/pull/59)),
the verifier and isolated test suites set `PSModuleAnalysisCachePath` inside the
temporary home so Windows PowerShell 5.1 never writes `ModuleAnalysisCache` into
the repository checkout when `USERPROFILE` has no `AppData\Local`. When verifying a
release, check out the commit where the reviewed contract pin in `.pregate/pregate.lock.json`
matches `package.json` (or note that at a pre-contract tag commit `self-gate` records
a lagging-lock diagnostic because the isolated home has no older engine installed).

## Return the result

Send the report directory containing `report.json` and its stdout/stderr logs to
the maintainer. Inspect the files first: do not include private application code,
credentials or unrelated logs. The runner does not upload or create issues.
The maintainer checks the commit and hashes, reads every failure and records the
result in release verification. A different commit needs a new run. Cleanup
failure also makes the report fail and must be resolved locally.

Standard GitHub-hosted runners are free for public repositories. Private projects
have a plan-dependent free quota; availability is subject to account billing.
See [GitHub's billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
This repository stays private; the manual run avoids depending on hosted billing.
