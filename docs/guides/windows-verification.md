# Verify 0.0.3 on Windows

This is the manual check for David, or for anyone else confirming the published
[v0.0.3](https://github.com/pedroknigge/pregate/releases/tag/v0.0.3) release on a
Windows machine. The repository is public. The procedure uses that tag, the
Windows archive from that release, and the committed verifier
`scripts/verify-windows.ts`. A passing report is evidence for that commit and
those files. It does not by itself change the platform status in the README.

Do not run PowerShell as Administrator. The installer writes the current user's
PATH under `HKCU`.

## Before you start

> Close heavy applications and other coding-agent sessions. Expect about one hour.
>
> Disable sleep for the run (`powercfg /change standby-timeout-ac 0` and `powercfg /change standby-timeout-dc 0`), then restore the previous timeouts afterwards (30 minutes is a common default).
>
> Run the verifier in a plain PowerShell window. A coding agent's background job can be killed by the host when memory is short.

## Prerequisites

- 64-bit Windows 10 or Windows 11 (x64). `install.ps1` stops on 32-bit Windows and on ARM64.
- Windows PowerShell 5.1 or newer. PowerShell 7 can run the Git and Bun commands below.
- [Git for Windows](https://git-scm.com/).
- [Bun](https://bun.sh) **1.4.4**, the version in `.bun-version`. `bun --version` must print `1.4.4`. `bun upgrade` installs the latest Bun, not this pin. Install the pinned version with `powershell -c "& ([scriptblock]::Create((irm https://bun.sh/install.ps1))) -Version 1.4.4"`. Bun 1.4.2 can segfault while leaving `bun test --isolate` after the tests have passed ([oven-sh/bun#43056](https://github.com/oven-sh/bun/issues/43056)); that crash is fixed in 1.4.3 and later, and the Windows suite runs with `--isolate`.
- [GitHub CLI](https://cli.github.com/) (`gh`). The release is public, so a private-repository grant is not required. `gh auth login` is only needed if `gh` itself asks for it.

## Checkout the tag

Some fixture paths are longer than Windows' 260-character limit. A clone without
long paths stops with "Filename too long".

```powershell
git clone -c core.longpaths=true https://github.com/pedroknigge/pregate.git
if ($LASTEXITCODE -ne 0) { throw 'Clone failed' }
Set-Location pregate
git checkout --detach v0.0.3
if ($LASTEXITCODE -ne 0) { throw 'Checkout failed' }
$head = (git rev-parse HEAD).Trim()
$tag = (git rev-parse 'v0.0.3^{commit}').Trim()
if ($head -ne $tag) { throw "HEAD is $head, not the v0.0.3 tag" }
git status --porcelain
bun --version
```

`v0.0.3` is an annotated tag. The commit to verify is the v0.0.3 tag.
`git rev-parse HEAD` must equal `git rev-parse 'v0.0.3^{commit}'`.
`git rev-parse v0.0.3` prints the tag object, not that commit, so do not compare
HEAD to that other hash. `git status --porcelain` must print nothing.
`bun --version` must print `1.4.4`.

Stay in this checkout for the verifier. Later manual install checks use a
separate throwaway directory so this tree stays clean. The verifier refuses a
dirty checkout.

## Download the release files

Create an empty directory and download three assets from the v0.0.3 release:
`install.ps1`, `SHA256SUMS`, and `pregate-0.0.3-windows-x64.zip`. Use these
downloaded files. Do not substitute `install.ps1` from a later commit, and do
not rebuild the zip.

```powershell
$candidate = 'C:\pregate-0.0.3'
New-Item -ItemType Directory -Path $candidate | Out-Null
gh release download v0.0.3 --repo pedroknigge/pregate --pattern install.ps1 --pattern SHA256SUMS --pattern pregate-0.0.3-windows-x64.zip --dir $candidate
if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
```

## Check the hashes

`SHA256SUMS` lists each file as 64 lowercase hex digits, two spaces, then the
file name. The hashes to trust are the ones published with the v0.0.3 tag.
This guide does not copy them from an older release: `SHA256SUMS` downloaded
with that tag is the list. The script below fails if a file's hash disagrees
with that list, or if the list has no unique entry for the file.

```powershell
$expected = @(
  'pregate-0.0.3-windows-x64.zip',
  'install.ps1'
)
$sums = Get-Content -LiteralPath (Join-Path $candidate 'SHA256SUMS')
foreach ($name in $expected) {
  $line = @($sums | Where-Object { $_ -cmatch ('^[0-9a-f]{64}  ' + [regex]::Escape($name) + '$') })
  if ($line.Count -ne 1) { throw "SHA256SUMS has no unique entry for $name on the v0.0.3 tag" }
  $listed = $line[0].Substring(0, 64)
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $candidate $name)).Hash.ToLowerInvariant()
  if ($actual -ne $listed) { throw "Incorrect hash: $name" }
}
```

## Install dependencies and run the verifier

From the repository root, still on the v0.0.3 tag:

```powershell
bun install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'Dependency install failed' }
$report = 'C:\pregate-0.0.3-report'
bun scripts/verify-windows.ts --artifacts $candidate --report $report
```

`--artifacts` is the directory that contains the zip, `install.ps1`, and
`SHA256SUMS`. `--report` must be a new directory on every run. The verifier
creates it and refuses a path that already exists. A rerun needs a new name,
for example `C:\pregate-0.0.3-report-2`. Do not delete and reuse the old
directory: a viewer or real-time antivirus can lock it, and then it cannot be
deleted. Omit `--report` and the verifier chooses a new directory under the
Windows temp folder and prints its path. The only other accepted form is
`--help`, which prints usage and does not start a run.

`bun scripts/verify-windows.ts --help` prints:

```text
bun scripts/verify-windows.ts --artifacts <candidate-directory> [--report <new-directory>]
Requires native Windows x64, Git and the Bun version in .bun-version. Reports stay local.
```

The run refuses anything other than native Windows x64. It checks that HEAD is
a clean commit and that `bun --version` matches `.bun-version`. It then hashes
`pregate-0.0.3-windows-x64.zip`, `install.ps1`, and `SHA256SUMS`, and runs, in
order: `bun install --frozen-lockfile`, `bun run typecheck`, the core,
readiness, and documentation reference checks, the runtime and onboarding
tests, the Windows distribution test, the Windows suite (`bun test --isolate`,
excluding the four POSIX fixture suites), the pinned dcouplr source probe, the
packaged-candidate smoke for `windows-x64`, and `bun src/main.ts check
--ratchet --base <HEAD>`. A failed dependency install stops the later steps.
Other failures stay in the report. Each step's limit is 20 minutes, except the
Windows suite, which gets 60 minutes. A step that reaches its limit is recorded
with `timedOut: true`, and the verifier kills that step's process tree
(`taskkill /T /F /PID` on Windows) so the limit still holds when the step has
spawned children.

The verifier sets `HOME`, `USERPROFILE`, `LOCALAPPDATA`, and the other runtime
homes to a temporary directory, and sets `PSModuleAnalysisCachePath` there so
Windows PowerShell 5.1 does not write `ModuleAnalysisCache` into the checkout.
It does not install Pregate into your user profile, and it does not upload the
report or open a GitHub issue. It creates `report.json` as soon as the report
directory exists and rewrites that file after each step. `finished` is null
until the run ends. A killed run still leaves the steps that completed, plus
each step's stdout and stderr log. It prints that the run takes about one hour,
and warns, without stopping, when less than 2 GB of memory is free. On Windows
it asks the system to stay awake until the process exits. If that request
fails, it prints the `powercfg` commands from [Before you start](#before-you-start).
Disable sleep yourself as well. When the run ends it sets `finished` and prints
`PASS` or `FAIL` plus the report path. Exit 0 means every step exited 0, none
timed out, and the temporary home was removed.

## Manual checks

Do these after the verifier, in a normal user PowerShell window, not as
Administrator. They use your real profile. The automated run does not.

### Install as the current user

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\pregate-0.0.3\install.ps1 -Version 0.0.3
```

The script checks the zip against `SHA256SUMS`, runs `pregate setup`, and adds
`%LOCALAPPDATA%\pregate\bin` to your user PATH. Open a new terminal so that
PATH is visible. `pregate` from cmd or PowerShell is `pregate.cmd`.

Setup exits 0 when at least one installed harness was wired. A harness that could not be wired, such as Codex whose hook trust was not confirmed, is a warning with the next step and does not fail the install when another harness was wired. The install fails when setup exits non-zero: no harness was wired, or setup hit a real error. The same contract is in the [installation guide](installation.md).

### Version, doctor, and demo

```powershell
pregate --version
pregate doctor
pregate demo
```

`--version` prints `pregate 0.0.3 (core 0.0.1)`. `doctor` takes no arguments.
A harness whose program is not on `PATH` is reported as INFO. `demo` needs
Git. It creates and deletes its own temporary projects and does not accept a
project path. The default language is `all` (`python`, `go`, and `rust`). A
missing `python`, `go`, or `rustc` is reported as not verified. A tool that is
installed and fails the sample fails the demo. Real-time antivirus scanning of
new binaries can make the Go sample slow; keep that output with the report.
`pregate demo --language python` repeats only the Python sample.

### Configure a throwaway repository and approve it

Default `guide` starts in advisor mode, which explains findings and does not
block. This check asks for enforce so a later edit can be denied. `--packs
none` keeps the candidate on the core contract.

```powershell
$demo = Join-Path $env:TEMP ('pregate-throwaway-' + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Path $demo | Out-Null
git -C $demo init
git -C $demo config user.email "pregate-windows@example.com"
git -C $demo config user.name "Pregate Windows"
git -C $demo commit --allow-empty -m "init"
Set-Location $demo
pregate guide --preview --enforcement enforce --packs none
```

Run that preview in this window. Do not redirect it to a file: a preview that is
not a terminal withholds the approval code. The preview prints
`pregate approve` followed by the code (12 hex digits, or more). There is no
`guide --approve` and no `guide --yes`. Mode must say enforce. You approve by
typing the command the preview prints:

```powershell
pregate approve <code>
```

Replace `<code>` with the code from that preview. Type `y` when asked. Approval
commits `.pregate/preset.json` and `.pregate/pregate.lock.json` in the throwaway
repository. An agent must not run this command. `--yes` does not skip the
question unless `PREGATE_UNATTENDED_APPROVAL=1` is already set.

### Show the gate blocking an edit

Still in the throwaway repository, send a new file that adds an inline
suppression. Core rule `core/EVA-SUP-001` denies that under enforce:

```powershell
$result = @'
export const value = 1;
// eslint-disable-next-line no-unused-vars
'@ | pregate check --stdin --path src/sample.ts --format agent
$result
if ($LASTEXITCODE -eq 0 -or $result -notmatch 'PREGATE DENY core/EVA-SUP-001') { throw 'Expected core/EVA-SUP-001 to deny the new suppression' }
```

The command exits non-zero and prints `PREGATE DENY core/EVA-SUP-001`. That is the same decision
the pre-edit hook applies to a proposed file. A coding agent that is actually
installed (Claude Code, Cursor, Codex, Grok, or agy) is wired by `setup`; an
agent write of that suppression is denied there too. `doctor` says when a
harness was not found, in which case there is no agent UI to click.
`check --stdin` still shows the engine's decision. Input must be UTF-8, at
most 16 MiB, and stdin must close (a here-string does).

### Disable, uninstall, and confirm the install is gone

From the throwaway repository, revoke consent. Type `y`:

```powershell
pregate disable
```

From any directory, remove the machine install. Type `y`:

```powershell
pregate uninstall
Test-Path "$env:LOCALAPPDATA\pregate"
```

`Test-Path` must print `False`. `uninstall` removes
`%LOCALAPPDATA%\pregate` (the engine and `%LOCALAPPDATA%\pregate\bin`), the
launcher, and the harness registrations Pregate owns. It leaves
`%LOCALAPPDATA%\State\pregate` in place. `pregate uninstall --purge` also
deletes that state directory. Repository `.pregate/` directories, including
the throwaway one, stay on disk. You can delete the throwaway folder yourself.

Open a new terminal and confirm `pregate` is no longer on `PATH`.

## Return the report

Send the report directory (`report.json` plus each step's stdout and stderr
log) to the maintainer. Read it first. Do not include private application
code, credentials, or unrelated logs. The verifier does not upload anything
and does not open an issue. A `FAIL` report is still the result to return.
If the run was killed, send the report anyway: `finished` is null and `steps`
lists only the steps that completed.
Include `git rev-parse HEAD`, `bun --version`, and the manual command output
with it. A different commit or a rebuilt zip needs a new run.
