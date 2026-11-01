# Install, update and remove PREGATE

PREGATE distributes standalone engines for macOS ARM64, Linux x64/ARM64 and Windows
x64. Published 0.2.26 targets macOS ARM64; Linux and Windows are experimental,
test builds, not supported for production until native release validation passes.
Focused source verification does not admit a final platform release.
Bun is required only for development/builds. See
[0.2.26 release notes](../releases/0.2.26.md) and [delivery status](../STATUS.md).
Private project migration still needs its own review.
The private pilot uses
authenticated [GitHub CLI](https://cli.github.com/) with access to this repository.
The installers and updater first try anonymous HTTPS, then
authenticated `gh` if public transport/assets are unavailable. Public releases
can therefore download without a GitHub account; this repository is still private.
Public transport is verified with isolated mocks, not a claim that the private
release is anonymously accessible.
Choose a **published** tag from [GitHub Releases](https://github.com/pedroknigge/pregate/releases);
the source tree can contain unreleased capabilities. Check [delivery status](../STATUS.md).

## Quick install (macOS and Linux)

Public release one-liner (verifies the archive SHA-256 against `SHA256SUMS`, and the Sigstore signature when `cosign` is installed, before setup):

```sh
curl -fsSL https://github.com/pedroknigge/pregate/releases/latest/download/install.sh | sh
```

Private pilot one-liner (using authenticated `gh`):

```sh
gh release download v0.2.26 --repo pedroknigge/pregate --pattern install.sh -O - | sh
```

You can also install or sync the `/pregate` companion skill via [`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add pedroknigge/pregate
```

## Manual checksum verification (macOS and Linux)

Download the selected tag's installer and checksum manifest into an empty directory.
The examples select the published 0.2.26 macOS pilot.

```sh
gh release download v0.2.26 --repo pedroknigge/pregate --pattern install.sh --pattern SHA256SUMS
```

Verify the installer before running it. On macOS:

```sh
shasum -a 256 -c SHA256SUMS --ignore-missing
sh install.sh --version 0.2.26
```

On Linux, use `sha256sum -c SHA256SUMS --ignore-missing`, then the same installer
command. A failed checksum must stop installation. The installer verifies the
engine archive before setup. Add `~/.local/bin` to PATH.

## Verify Sigstore signatures

The release workflow signs every archive (`*.tar.gz`, `*.zip`) and `SHA256SUMS` with keyless [cosign](https://docs.sigstore.dev/cosign/signing/overview/) (`cosign sign-blob` through GitHub Actions OIDC). Each signed file is published as a `.bundle` (signature, certificate, and transparency-log proof). The same files also get a GitHub artifact attestation from `actions/attest-build-provenance`.

`install.sh` and `install.ps1` always check SHA-256. When `cosign` is on `PATH` and the release contains a bundle, they verify that bundle and stop if it does not match. Without `cosign`, the checksum check still runs. The GitHub Action always compares the downloaded archive with `SHA256SUMS` before it extracts anything. When a cosign bundle or a GitHub artifact attestation is available, the Action verifies that too. A checksum, signature, or attestation mismatch installs nothing.

Use the published tag you are installing. The sample tag matches the checksum section above. Signature bundles are produced by the signing workflow; a historical tag that only published `SHA256SUMS` still installs on the checksum check.

```sh
tag=v0.2.26
asset=pregate-0.2.26-darwin-arm64.tar.gz
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
cosign verify-blob --bundle "$dir\pregate-0.2.26-windows-x64.zip.bundle" `
  --certificate-identity-regexp '^https://github\.com/pedroknigge/pregate/\.github/workflows/release\.yml@refs/tags/v' `
  --certificate-oidc-issuer https://token.actions.githubusercontent.com `
  "$dir\pregate-0.2.26-windows-x64.zip"
gh attestation verify "$dir\pregate-0.2.26-windows-x64.zip" --repo pedroknigge/pregate `
  --signer-workflow pedroknigge/pregate/.github/workflows/release.yml
```

## Windows

Use PowerShell (Windows PowerShell 5.1 or newer):

These commands select the published 0.2.26 experimental Windows archive;
they do not establish native admission. See the [Windows retry](windows-verification.md).

```powershell
$dir = Join-Path $env:TEMP ('pregate-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $dir | Out-Null
gh release download v0.2.26 --repo pedroknigge/pregate --pattern install.ps1 --pattern SHA256SUMS --dir $dir
if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
$sum = Get-Content "$dir/SHA256SUMS" | Where-Object { $_ -match '  install.ps1$' } | Select-Object -First 1
if (!$sum -or (Get-FileHash "$dir/install.ps1" -Algorithm SHA256).Hash -ine $sum.Substring(0,64)) { throw 'Installer checksum mismatch' }
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$dir/install.ps1" -Version 0.2.26
Remove-Item $dir -Recurse -Force
```

The installer adds `%LOCALAPPDATA%\pregate\bin` to your user PATH once, keeping existing
entries unexpanded; open a new terminal afterwards. Pass `-NoModifyPath` (or set
`PREGATE_NO_MODIFY_PATH=1`) to leave PATH alone and add it yourself. Use
`pregate` from cmd/PowerShell (`pregate.cmd`) or the shell wrapper from Git Bash.
Windows Git hooks require Git for Windows' shell.

## Verify and activate

In 0.2.12, `pregate demo` offers an owned sample before
you configure a project. It needs Git, runs the compiled engine and cleans up its
temporary projects and settings. See [the demo guide](demo.md).

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
choose it in the guide or enter human `! pregate enable --yes` after reviewing
`status`. Use `status --json` to inspect contract validity, effective policy,
capabilities and backstops. See [using the skill](pregate-skill.md).

Optionally add repository backstops after initialization:

```sh
pregate install --git-hook --ci github
```

## Updates and removal

`pregate update` selects the latest published release. `update --version <v>` selects
a release; `update --engine <v>` installs a required engine pin. Updates preserve
project locks, so inspect each contract before adopting different bundled pack data.
`setup` refreshes global registrations and installed companion instructions from
the running engine. `doctor` reports missing or stale skills.

Update the global engine to 0.2.13 and review one or several
project contracts together:

```sh
pregate update --version 0.2.13
pregate guide --projects "/path/project-a" "/path/project-b"
```

The guide reviews engine, core and registered-pack changes once for the selected
projects. It preserves custom packs, scope, exclusions, overrides and disabled
consent. Current projects remain unchanged. In a supported harness, the human can
enter the same commands with `!`; the agent must not approve its own proposal.

Version 0.2.7 introduced [one reviewed project update](../features/project-update.md):
`update` prepares a project review after global installation; `update --project
--preview` or `pack update --all --preview` prepares all registered pins with the
installed engine. Version 0.2.6 does not provide that migration workflow.
Do not move the lock aside, reset the preset or promise that global installation
alone migrates a consumer. Initial use with an older pinned hook requires the
human `! pregate update` route once the new release is available.

With 0.2.12 installed, `update --projects <path...> --preview` prepares one or
several explicit project roots from any directory. Review the output, then let
the human rerun the path list with `--yes` in the harness. All candidates preflight
before application; each project applies independently and current contracts are
no-ops. Custom policy and disabled consent stay unchanged. See the
[multi-project workflow](../features/project-update.md#update-several-projects-from-one-directory).

For interactive choices use `pregate guide --projects <path...>`. For one project,
`guide --preview --packs <ns,ns>` can combine selected additions with migration;
the guide inspects the complete installed catalog and offers a grouped pack/audit
choice when it finds missing recommendations. Otherwise it prints the audit
command. The 0.2.12 catalog also includes the optional Rust pack; check
[delivery status](../STATUS.md) for verification and platform limits.

`disable` revokes consent for the current worktree. `uninstall` removes owned global
registrations and installation files; `uninstall --purge` also removes local state.
Repository contracts and pre-install backups remain. Windows removes a running
engine after its process exits.

## Download checks in 0.2.12

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
