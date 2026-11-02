# Install, update and remove PREGATE

PREGATE 0.0.2 distributes standalone engines for macOS ARM64, Linux x64/ARM64 and Windows
x64. macOS ARM64 is the stable platform. Linux and Windows are experimental
test builds, not supported for production until native release validation passes.
Focused source verification does not admit a final platform release.
Bun is required only for development and builds. See the
[changelog](../../CHANGELOG.md) and the
[v0.0.1 release notes](../releases/0.0.1.md).
The installers and updater try anonymous HTTPS first, then authenticated `gh`
if that download is unavailable. A public release can be installed without a
GitHub account. Choose a **published** tag from
[GitHub Releases](https://github.com/pedroknigge/pregate/releases);
the source tree can contain unreleased capabilities.

## Quick install (macOS and Linux)

Public release one-liner (verifies the archive SHA-256 against `SHA256SUMS`, and the Sigstore signature when `cosign` is installed, before setup):

```sh
curl -fsSL https://github.com/pedroknigge/pregate/releases/latest/download/install.sh | sh
```

You can also install or sync the `/pregate` companion skill via [`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add pedroknigge/pregate
```

## Manual checksum verification (macOS and Linux)

Download the selected tag's installer and checksum manifest into an empty directory.
The examples select 0.0.2 for macOS ARM64. Install a tag that has actually been published.

```sh
gh release download v0.0.2 --repo pedroknigge/pregate --pattern install.sh --pattern SHA256SUMS
```

Verify the installer before running it. On macOS:

```sh
shasum -a 256 -c SHA256SUMS --ignore-missing
sh install.sh --version 0.0.2
```

On Linux, use `sha256sum -c SHA256SUMS --ignore-missing`, then the same installer
command. A failed checksum must stop installation. The installer verifies the
engine archive before setup. Add `~/.local/bin` to PATH.

## Verify Sigstore signatures

The release workflow signs every archive (`*.tar.gz`, `*.zip`) and `SHA256SUMS` with keyless [cosign](https://docs.sigstore.dev/cosign/signing/overview/) (`cosign sign-blob` through GitHub Actions OIDC). Each signed file is published as a `.bundle` (signature, certificate, and transparency-log proof). The same files also get a GitHub artifact attestation from `actions/attest-build-provenance`.

`install.sh` and `install.ps1` always check SHA-256. When `cosign` is on `PATH` and the release contains a bundle, they verify that bundle and stop if it does not match. Without `cosign`, or when a bundle is missing, the checksum check still runs and the installer prints a notice; `PREGATE_REQUIRE_SIGNATURE=1` turns both cases into a failure. The GitHub Action installs `cosign` and requires the signature by default: it compares the downloaded archive with `SHA256SUMS`, verifies the cosign bundles of `SHA256SUMS` and the archive, and only then extracts. Set the input `require-signature: false` to install a release that has no bundles on SHA-256 alone. The Action also verifies the GitHub artifact attestation with `gh` and the input `github-token` (default `github.token`); a digest with no attestation, or a `gh` without a token, is a notice, not a failure. A checksum, signature, or attestation mismatch installs nothing.

Use the published tag you are installing. The sample tag matches the checksum section above. Signature bundles are produced by the signing workflow; a historical tag that only published `SHA256SUMS` still installs on the checksum check.

```sh
tag=v0.0.2
asset=pregate-0.0.2-darwin-arm64.tar.gz
gh release download "$tag" --repo pedroknigge/pregate \
  --pattern "$asset" --pattern "$asset.bundle" \
  --pattern SHA256SUMS --pattern SHA256SUMS.bundle

cosign verify-blob --bundle SHA256SUMS.bundle \
  --certificate-identity-regexp '^https://github\.com/pedroknigge/pregate/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  SHA256SUMS

shasum -a 256 -c SHA256SUMS --ignore-missing

cosign verify-blob --bundle "$asset.bundle" \
  --certificate-identity-regexp '^https://github\.com/pedroknigge/pregate/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  "$asset"

gh attestation verify "$asset" --repo pedroknigge/pregate \
  --signer-workflow pedroknigge/pregate/.github/workflows/release.yml
gh attestation verify SHA256SUMS --repo pedroknigge/pregate \
  --signer-workflow pedroknigge/pregate/.github/workflows/release.yml
```

On Linux, use `sha256sum -c SHA256SUMS --ignore-missing` instead of `shasum`. On Windows, after the zip, `SHA256SUMS`, and both bundles are in one directory:

```powershell
# $dir is the folder that contains the zip, SHA256SUMS, and both .bundle files.
cosign verify-blob --bundle "$dir\SHA256SUMS.bundle" `
  --certificate-identity-regexp '^https://github\.com/pedroknigge/pregate/\.github/workflows/release\.yml@refs/tags/v' `
  --certificate-oidc-issuer https://token.actions.githubusercontent.com `
  "$dir\SHA256SUMS"
cosign verify-blob --bundle "$dir\pregate-0.0.2-windows-x64.zip.bundle" `
  --certificate-identity-regexp '^https://github\.com/pedroknigge/pregate/\.github/workflows/release\.yml@refs/tags/v' `
  --certificate-oidc-issuer https://token.actions.githubusercontent.com `
  "$dir\pregate-0.0.2-windows-x64.zip"
gh attestation verify "$dir\pregate-0.0.2-windows-x64.zip" --repo pedroknigge/pregate `
  --signer-workflow pedroknigge/pregate/.github/workflows/release.yml
```

## Windows

Use PowerShell (Windows PowerShell 5.1 or newer):

These commands select the 0.0.2 experimental Windows archive;
they do not establish native admission. See the [Windows retry](windows-verification.md).

```powershell
$dir = Join-Path $env:TEMP ('pregate-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $dir | Out-Null
gh release download v0.0.2 --repo pedroknigge/pregate --pattern install.ps1 --pattern SHA256SUMS --dir $dir
if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
$sum = Get-Content "$dir/SHA256SUMS" | Where-Object { $_ -match '  install.ps1$' } | Select-Object -First 1
if (!$sum -or (Get-FileHash "$dir/install.ps1" -Algorithm SHA256).Hash -ine $sum.Substring(0,64)) { throw 'Installer checksum mismatch' }
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$dir/install.ps1" -Version 0.0.2
Remove-Item $dir -Recurse -Force
```

The installer adds `%LOCALAPPDATA%\pregate\bin` to your user PATH once, keeping existing
entries unexpanded; open a new terminal afterwards. Pass `-NoModifyPath` (or set
`PREGATE_NO_MODIFY_PATH=1`) to leave PATH alone and add it yourself. Use
`pregate` from cmd/PowerShell (`pregate.cmd`) or the shell wrapper from Git Bash.
Windows Git hooks require Git for Windows' shell.

## Verify and activate

`pregate demo` offers an owned sample before you configure a project. It needs
Git, runs the compiled engine and cleans up its temporary projects and settings.
See [the demo guide](demo.md).

```sh
pregate --version
pregate doctor
pregate
```

Global setup installs owned harness registrations and `/pregate` companion instructions.
It remains inert until you approve a contract and consent in each worktree.
A committed preset does not grant consent. The guide offers setup, migration or
activation from the actual project state. In a harness, enter human
`! pregate guide`, or load `/pregate` and ask the agent to prepare one `guide --preview`
for your approval. Current cloned/disabled contracts need activation separately;
choose it in the guide, or run `pregate enable` in a terminal after reviewing
`status` and type `y`. `--yes` does not skip that question unless
`PREGATE_UNATTENDED_APPROVAL=1` is already set. Use `status --json` to inspect contract validity, effective policy,
capabilities and backstops. See [using the skill](pregate-skill.md).

Optionally add repository backstops after initialization:

```sh
pregate install --git-hook --ci github
```

The CI workflow runs `pregate check --ratchet` against the pull request's base. It
fails on any change that loosens the contract (a weaker enforcement, a removed or
downgraded rule) and prints that loosening's digest. A maintainer who accepts the
loosening sets the repository variable `PREGATE_ACCEPT_CONTRACT` to that digest
(several digests may be separated by spaces or commas) and reruns the job. The
engine that runs the check is the one the base branch's lock pins, so a change
cannot select an older engine by editing its own lock. Repository variables
are outside the change under review; the workflow file is not, so protect
`.pregate/` and `.github/workflows/` with CODEOWNERS and required reviews.

## Updates and removal

`pregate update` selects the latest published release. `update --version <v>` selects
a release; `update --engine <v>` installs a required engine pin. Updates preserve
project locks, so inspect each contract before adopting different bundled pack data.
`setup` refreshes global registrations and installed companion instructions from
the running engine. `doctor` reports missing or stale skills.

Update the global engine to 0.0.2 and review one or several
project contracts together:

```sh
pregate update --version 0.0.2
pregate guide --projects "/path/project-a" "/path/project-b"
```

The guide reviews engine, core and registered-pack changes once for the selected
projects. It preserves custom packs, scope, exclusions, overrides and disabled
consent. Current projects remain unchanged. In a supported harness, the human can
enter the same commands with `!`; the agent must not approve its own proposal.

`update` prepares a [reviewed project update](../features/project-update.md) after
global installation. `update --project --preview` or `pack update --all --preview`
prepares registered pins with the installed engine. Do not move the lock aside,
reset the preset or promise that global installation alone migrates a consumer.
Initial use with an older pinned hook requires the human `! pregate update` route
once the new release is available.

`update --projects <path...> --preview` prepares one or several explicit project
roots from any directory. Review the output, then let the human rerun the path
list with `--yes` in the harness. All candidates preflight before application;
each project applies independently and current contracts are no-ops. Custom policy
and disabled consent stay unchanged. See the
[multi-project workflow](../features/project-update.md#update-several-projects-from-one-directory).

For interactive choices use `pregate guide --projects <path...>`. For one project,
`guide --preview --packs <ns,ns>` can combine selected additions with migration;
the guide inspects the complete installed catalog and offers a grouped pack/audit
choice when it finds missing recommendations. Otherwise it prints the audit
command. The catalog includes the optional Rust pack; check the
[v0.0.1 release notes](../releases/0.0.1.md) for what the first public tag verified
and the [changelog](../../CHANGELOG.md) for 0.0.2.

`disable` revokes consent for the current worktree. `uninstall` removes owned global
registrations and installation files; `uninstall --purge` also removes local state.
Both ask the human for `y` on the terminal (`--yes` skips that only under `CI`).
Repository contracts and pre-install backups remain. Windows removes a running
engine after its process exits.

## Download checks

HTTPS downloads use `curl -q` (`curl.exe` on Windows), TLS 1.2 or newer,
HTTPS-only redirects, at most five redirects, a ten-second connect budget and a
120-second total budget per request. Metadata/manifests are limited to 1 MiB;
archives to 256 MiB. The archive and manifest come from one channel; partial
anonymous files are removed before authenticated fallback. A malformed manifest,
missing or duplicate selected checksum, oversized result or checksum mismatch
stops installation instead of selecting a different channel.

Curl before 8.4 cannot stop an unknown-length response exactly at `--max-filesize`.
The post-download size check still rejects it before reading, extracting or
executing it; transient disk use can exceed that limit on older curl versions.
The request deadline still applies. The offline `PREGATE_ARCHIVE` and
`PREGATE_SHA256` route remains available. A project update preserves custom packs,
disabled consent and the reviewed approval boundary.

## Storage locations

macOS/Linux engines live under the data home (`~/.local/share/pregate` by default)
and state under the state home (`~/.local/state/pregate`). Windows defaults use
`%LOCALAPPDATA%\pregate` and `%LOCALAPPDATA%\State\pregate`. `XDG_DATA_HOME` and
`XDG_STATE_HOME` override these roots. Harness settings use the user home, with
`CODEX_HOME`, `GROK_HOME` and `CLAUDE_CONFIG_DIR` respected.

Histories and source copies are local. Use `storage inspect` and a reviewed
`storage prune`/`recover` plan; see [storage and retention](../features/local-storage.md).
See [native release verification](../features/release-verification.md) for what
packaged smoke tests establish and what still needs actual harness testing.

## Release history

This guide describes 0.0.2. Public releases use the 0.0.x line. Earlier private
builds used 0.2.x numbers; those notes stay here so the steps above do not mix
two version lines.

- **0.2.6** did not prepare a project migration after a global install. That binary
  will not rewrite a consumer lock for you.
- **0.2.7** introduced one reviewed project update: `update` prepares a project
  review after global installation, and `update --project --preview` or
  `pack update --all --preview` prepares registered pins with the installed engine.
- **0.2.12** added `pregate demo`, `update --projects <path...> --preview`, the
  optional Rust pack, and the download limits above (`curl -q`, TLS 1.2, redirect
  and size budgets). Those behaviors are what 0.0.2 installs. See the
  [v0.0.1 release notes](../releases/0.0.1.md) for what the first public tag verified.
