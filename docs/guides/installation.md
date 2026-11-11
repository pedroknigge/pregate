# Install, update and remove PREGATE

PREGATE 0.0.7 distributes standalone engines for macOS ARM64, Linux x64/ARM64 and Windows
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

### npm (global or one-shot)

`pregate` is published on npm; `npm view pregate version` shows the latest release there. Install globally or invoke without a global install:

```sh
npm i -g pregate
npx pregate doctor
```

The npm tarball ships only the launcher (`bin/pregate.mjs`) plus `install.sh` / `install.ps1`. The first successful command for a version downloads the matching GitHub release archive (about 55 MB for 0.0.7), verifies it against `SHA256SUMS`, verifies Sigstore bundles when `cosign` is on `PATH` and bundles exist, and fails when `PREGATE_REQUIRE_SIGNATURE=1` and a bundle is missing or invalid. It then runs the same setup path as the shell installers: engine under the user data directory, launcher on `PATH`, harness hook registration, and the `/pregate` companion skill. Later invocations call the cached engine directly.

Older public tags (0.0.1 through 0.0.3) were never published to npm; use the GitHub release installers for those versions.

You can also install or sync the `/pregate` companion skill via [`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add pedroknigge/pregate
```

## Manual checksum verification (macOS and Linux)

Download the selected tag's installer and checksum manifest into an empty directory.
The examples select 0.0.7 for macOS ARM64. Install a tag that has actually been published.

```sh
gh release download v0.0.7 --repo pedroknigge/pregate --pattern install.sh --pattern SHA256SUMS
```

Verify the installer before running it. On macOS:

```sh
shasum -a 256 -c SHA256SUMS --ignore-missing
sh install.sh --version 0.0.7
```

On Linux, use `sha256sum -c SHA256SUMS --ignore-missing`, then the same installer
command. A failed checksum must stop installation. The installer verifies the
engine archive before setup. Add `~/.local/bin` to PATH.

## Verify Sigstore signatures

The release workflow signs every archive (`*.tar.gz`, `*.zip`) and `SHA256SUMS` with keyless [cosign](https://docs.sigstore.dev/cosign/signing/overview/) (`cosign sign-blob` through GitHub Actions OIDC). Each signed file is published as a `.bundle` (signature, certificate, and transparency-log proof). The same files also get a GitHub artifact attestation from `actions/attest-build-provenance`.

`install.sh` and `install.ps1` always check SHA-256. When `cosign` is on `PATH` and the release contains a bundle, they verify that bundle and stop if it does not match. Without `cosign`, or when a bundle is missing, the checksum check still runs and the installer prints a notice; `PREGATE_REQUIRE_SIGNATURE=1` turns both cases into a failure. The GitHub Action installs `cosign` and requires the signature by default: it compares the downloaded archive with `SHA256SUMS`, verifies the cosign bundles of `SHA256SUMS` and the archive, and only then extracts. Set the input `require-signature: false` to install a release that has no bundles on SHA-256 alone. The Action also verifies the GitHub artifact attestation with `gh` and the input `github-token` (default `github.token`); a digest with no attestation, or a `gh` without a token, is a notice, not a failure. A checksum, signature, or attestation mismatch installs nothing.

Use the published tag you are installing. The sample tag matches the checksum section above. Signature bundles are produced by the signing workflow; a historical tag that only published `SHA256SUMS` still installs on the checksum check.

```sh
tag=v0.0.7
asset=pregate-0.0.7-darwin-arm64.tar.gz
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
cosign verify-blob --bundle "$dir\pregate-0.0.7-windows-x64.zip.bundle" `
  --certificate-identity-regexp '^https://github\.com/pedroknigge/pregate/\.github/workflows/release\.yml@refs/tags/v' `
  --certificate-oidc-issuer https://token.actions.githubusercontent.com `
  "$dir\pregate-0.0.7-windows-x64.zip"
gh attestation verify "$dir\pregate-0.0.7-windows-x64.zip" --repo pedroknigge/pregate `
  --signer-workflow pedroknigge/pregate/.github/workflows/release.yml
```

## Windows

Use PowerShell (Windows PowerShell 5.1 or newer):

These commands select the 0.0.7 experimental Windows archive;
they do not establish native admission. See the [Windows retry](windows-verification.md).

```powershell
$dir = Join-Path $env:TEMP ('pregate-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $dir | Out-Null
gh release download v0.0.7 --repo pedroknigge/pregate --pattern install.ps1 --pattern SHA256SUMS --dir $dir
if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
$sum = Get-Content "$dir/SHA256SUMS" | Where-Object { $_ -match '  install.ps1$' } | Select-Object -First 1
if (!$sum -or (Get-FileHash "$dir/install.ps1" -Algorithm SHA256).Hash -ine $sum.Substring(0,64)) { throw 'Installer checksum mismatch' }
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$dir/install.ps1" -Version 0.0.7
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

`pregate setup` exits 0 when it wired at least one harness. A detected harness that could not be wired is a warning and names the next step. Codex that does not confirm hook trust is that warning: `hooks.json` is left unchanged, and the next step is to approve the PREGATE hooks in Codex with `/hooks`, then rerun `pregate setup`. The command exits 1 when it wired no harness, or when it hit a real error (a config it must not rewrite, a Codex trust rollback that would drop someone else's hooks, an app-server that does not answer, a failed engine install). `install.sh` and `install.ps1` both stop when setup exits non-zero, and both finish when setup exits 0, including when it printed a warning. `pregate guide` still applies a reviewed contract after a warning-only setup, and says agent-edit protection remains degraded until a harness is wired. `pregate update` still switches the launcher and prepares project reviews in that case. Either command stops when setup prints a line that starts with `ERROR:`.
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

The same gate can run inside the Vercel build, with or without that workflow:

```sh
pregate install --ci vercel
```

`pregate install --ci github,vercel` writes both. A repository that has both configured must see a passing Actions check and a passing Vercel deployment status. The [Vercel guide](vercel-ci.md) covers the build command, the linux-x64 install, the build cache, and preview versus production.

## Prepare an engine without global registration

`pregate prepare [--version <v> | --engine <v>]` downloads the release archive for this OS and architecture, verifies it against `SHA256SUMS`, and verifies Sigstore bundles with `cosign` when they are published (same rules as `install.sh` and `install.ps1`). It atomically installs that engine under `<DATA>/<version>/` and leaves harness homes, companion skills, PATH, the launcher, and hook registrations untouched. Without a version flag, it uses the engine pin from `.pregate/pregate.lock.json` in the current Git project. Use it to put a pinned engine in the cache before `pregate project launcher`, `pregate project hooks` and `pregate project setup`; `pregate setup` still performs the full machine registration.

## Project launcher

`pregate project launcher [--preview|--yes]` installs a launcher in the project at `.pregate/bin/pregate` (Windows: `.pregate/bin/pregate.cmd` and `project-launcher.ps1`). The launcher reads the engine pin from `.pregate/pregate.lock.json` and runs that engine from `<DATA>/<version>/`. It never uses a `pregate` found on PATH. The command needs a valid engine pin and that engine in the cache (`pregate prepare`). The files are a reviewed change: `--preview` prepares the review, and a human approves it as for any contract proposal. When the pinned engine is missing or empty, a hook call through the launcher denies (exit 2) with the reason, and any other call prints the reason and exits 1. `pregate install` keeps this launcher. It removes only a `.pregate/bin/pregate` that is not a project launcher, which is the file that 0.1.0 committed.

## Project-local Claude Code hooks

`pregate project hooks --harness claude-code [--preview|--yes]` registers the Claude Code hooks in the project's own `.claude/settings.json`. The hooks run the project launcher, so the project needs no `pregate setup` on the machine and the command writes no harness home. Run `pregate prepare` and `pregate project launcher` first; the command refuses a project without the reviewed launcher.

```sh
pregate prepare
pregate project launcher --preview                     # review, then the human approves
pregate project hooks --harness claude-code --preview  # review, then the human approves
pregate enable                                         # local consent, by the human
```

- **What it writes.** PreToolUse (the same tool matcher as the global registration), Stop, SubagentStop, SessionStart and SubagentStart. Each command is `"${CLAUDE_PROJECT_DIR:-.}/.pregate/bin/pregate" hook <event> --harness claude-code` behind a test that the launcher is there. It holds no path of this machine, so it can be committed.
- **What it keeps.** Other hooks, `permissions` and unknown keys stay. Only the groups that run the project launcher are replaced. A file that already holds the registration is not rewritten: a second run changes no byte. The first write re-serializes the file with two-space indentation, so the formatting of the other entries can change; their content does not.
- **Review.** The file is a reviewed change. `--preview` prepares the review and a human approves it, as for a contract proposal. Under the user's home, the approval rewrites this project's record in `<DATA>/contract-approvals/`. Nothing else there is created or changed.
- **Consent is separate.** The registration does not enable the project. Without `pregate enable` in the worktree the hooks run and allow. Claude Code's workspace trust is a third, independent step that Claude Code asks for.
- **Failure.** A missing or empty pinned engine denies the write (exit 2) and names `pregate prepare`. A missing launcher denies the write and lets Stop and SessionStart pass.
- **Windows.** The command is `powershell.exe -EncodedCommand …`, the form of the global registration, and it runs `.pregate\bin\project-launcher.ps1`. `pregate.cmd` in the same folder only starts that script. One settings file holds one command form: a repository that Windows and POSIX machines share is not supported by this registration.
- **With a global setup.** If `pregate setup` also registered Claude Code, Claude Code runs both registrations and every tool call is evaluated twice. `pregate doctor` reports the scope as project-local only, global only, both or neither, and `pregate status` names the project-local and the double case. In a project-local setup with no other harness, `doctor` states the missing global launcher, skills and PATH entry as information, not as errors. It checks the files; it runs no canary for the project hooks.
- **Removal.** Delete the Pregate groups from `.claude/settings.json`, or revert the commit that added them. `pregate setup`, `pregate uninstall` and `pregate install` do not change this registration or the launcher.

A live run on 2026-11-11 with Claude Code 2.1.322 on macOS (`scripts/e2e-real.ts --project-hooks-only claude-code`, headless, isolated home, no global installation) loaded the hooks from the project file, allowed a clean write and denied a forbidden one. Workspace trust was accepted in `~/.claude.json` before that run, so the interactive trust prompt is not established. The automated tests run the registered command as a shell command with the payload on stdin. The Windows form is not validated in a real Claude Code session, and Grok reading a project `.claude/settings.json` is not covered. Cursor 2026.11.11 runs that file too (see [project-local Cursor hooks](#project-local-cursor-hooks)).

## Repository-owned Claude setup

`pregate project setup` also merges Claude Code hooks into `.claude/settings.json`. Those hooks run the project launcher and the engine the lock pins. They do not call a `pregate` on PATH and they do not read a global launcher under `<DATA>/bin`. The events are PreToolUse, Stop, SubagentStop and SessionStart. This is a different registration from `pregate project hooks --harness claude-code`: that command is the one to commit (it includes SubagentStart and names no machine path), and this command is the merge `pregate doctor` treats as its own project scope.

Run it only after `pregate prepare` and `pregate project launcher`. It does not download the engine, install the launcher, write anything under your home directory, accept Claude's workspace-trust dialog, or grant policy consent. `pregate enable` is still required before a hook denies an edit. Accepting the trust dialog in Claude Code is also required before Claude runs repository hooks. Those two acts are separate.

A second run leaves `.claude/settings.json` byte for byte unchanged. Hook groups this command does not own stay in place, including their order. A file that is not a JSON object is left unchanged and the command fails. When this registration is the one in the file, `pregate doctor` reports the project scope on its own, runs a project-hook canary when policy consent is active, and reports workspace trust separately from policy consent. It does not treat a global Claude registration as a fallback for these hooks.

## Project-local Codex hooks

`pregate project hooks --harness codex [--preview|--yes]` registers the Codex hooks in the project's own `.codex/hooks.json`. The hooks run the project launcher. Run `pregate prepare` and `pregate project launcher` first.

```sh
pregate prepare
pregate project launcher --preview               # review, then the human approves
pregate project hooks --harness codex --preview  # review, then the human approves
pregate enable                                   # local consent, by the human
# then, in Codex, in this project: /hooks, and review the five Pregate hooks
```

- **What it writes.** PreToolUse with the matcher `^(apply_patch|Bash)$`, Stop, SessionStart, SubagentStart and SubagentStop, with the timeouts of the global Codex registration. It holds no path of this machine, so it can be committed.
- **It grants no trust.** Codex runs a hook only after its own review. This command does not record that review, does not mark the project trusted, and writes no file in the Codex home (`config.toml`, `hooks.json`). The human reviews the hooks in Codex with `/hooks`. Expect a changed definition to need the review again: Codex binds trust to a hash of the definition.
- **What it keeps.** Other hooks and unknown keys stay, and other groups keep their index, which is how Codex addresses a hook. A second run changes no byte. The first write re-serializes the file with two-space indentation.
- **Starting below the root.** Codex gives a hook no project variable. The command walks up from its working directory to the first directory that holds `.pregate/bin`, stops at the first `.git` entry, and runs the launcher from there. A working directory outside the repository finds no launcher and the write is denied.
- **Failure.** A missing or empty pinned engine denies the write (exit 2, one line on stderr) and names `pregate prepare`. A missing launcher denies the write and lets Stop and SessionStart pass.
- **What `doctor` and `status` say.** The scope is project-local only, global only, both or neither. With Codex on PATH, `doctor` uses read-only `config/read` and `hooks/list` requests for the current directory. It reports how many of the five project hooks are discovered, enabled and trusted, and rejects disabled hooks or failed discovery. It grants no trust and changes no Codex configuration. Without the binary it keeps the review state unknown and names `/hooks`. `status` remains a file-only diagnostic: it does not launch app-server, cache a live trust verdict or list Codex as gated by a project registration alone. Session-specific command-line overrides and native UI behavior remain separate checks.
- **With a global setup.** If `pregate setup` also registered Codex, both registrations exist and, when Codex runs both, every tool call is evaluated twice. `pregate setup`, `pregate uninstall` and `pregate install` do not change the project file.

A live run on 2026-11-11 with Codex 0.167.0 on macOS (`scripts/e2e-real.ts --project-hooks-only codex`, headless `codex exec` started in a subdirectory, isolated home) measured four states. (1) Project not marked trusted: Codex does not list the project hooks, and the forbidden write is written. (2) Project marked trusted, hooks not reviewed: Codex lists the three hooks as untrusted, runs none, and the forbidden write is written; the headless output carries no notice. (3) Hooks trusted: the forbidden write is denied and the rule reaches the model. (4) Definition changed after the review (one timeout value): Codex lists the hook as modified, runs none, and the forbidden write is written. A trusted hook of the user ran in all four states.

So a project registration gates Codex only after two human steps in Codex, project trust and the `/hooks` review, and any later change to the definition, including an engine update that rewrites the command, removes the gate without a notice until the hooks are reviewed again. Keep the machine setup for Codex if you need the gate to hold across updates without a new review.

Not established: the interactive `/hooks` review and what the TUI shows for an unreviewed hook; whether Codex runs both registrations when both exist; the Windows form in a real Codex session.

## Project-local Cursor hooks

`pregate project hooks --harness cursor [--preview|--yes]` registers Cursor's native hooks in the project's own `.cursor/hooks.json`. The hooks run the project launcher. Run `pregate prepare` and `pregate project launcher` first.

```sh
pregate prepare
pregate project launcher --preview                # review, then the human approves
pregate project hooks --harness cursor --preview  # review, then the human approves
pregate enable                                    # local consent, by the human
```

- **What it writes.** `version: 1` and three entries: `preToolUse` with the matcher `^(Write|Delete|Shell)$|^MCP:` (timeout 120), `stop` (timeout 60, `loop_limit: null`) and `sessionStart` (timeout 15). The commands find the launcher through `$CURSOR_PROJECT_DIR` and hold no path of this machine, so the file can be committed. Other entries and unknown keys stay, and a second run changes no byte.
- **MCP tools.** Every `MCP:` tool reaches the gate. A call that names no local absolute path is not judged; a call that names a protected file or a file in the contract's scope is denied, and the agent is told to write the file with its file tool instead.
- **No `failClosed`.** Cursor 2026.11.11 blocks a tool when a `failClosed` hook prints nothing, and printing nothing is how Pregate allows. A crash or a hang of the engine is still a deny: the launcher turns it into exit 2.
- **Trust.** Cursor runs project hooks only in a trusted workspace. Pregate does not read that record.
- **Cloud agents.** Cursor's cloud agents load `.cursor/hooks.json` from the repository and never the user's home. On a cloud machine the hooks deny every write until the pinned engine is cached (`pregate prepare` in the environment's setup), and they enforce nothing there without a local consent record. Cloud agents were not exercised.
- **What `doctor` and `status` say.** The scope is project-local only, global only, both or neither. Cursor also runs the project's `.claude/settings.json`, so a project registered for both Claude Code and Cursor is evaluated twice in Cursor, and `doctor` says so. A Claude Code project registration alone is reported as Cursor's registration through that file.
- **With a global setup.** If `pregate setup` also registered the machine, Cursor runs both registrations and every tool call is evaluated twice. `pregate setup`, `pregate uninstall` and `pregate install` do not change the project file.

A live run on 2026-11-11 with cursor-agent 2026.11.11 on macOS (`scripts/e2e-real.ts --project-hooks-only cursor`, headless with `--trust`, isolated home, no global installation) allowed a clean write, denied a forbidden one with the rule reaching the model, and denied an MCP tool that tried to write into `src/core`.

Not established: the interactive trust prompt, cloud agents, and the Windows form in a real Cursor session.

## Project-local Antigravity hooks

`pregate project hooks --harness agy [--preview|--yes]` registers the Antigravity hooks in the project's own `.agents/hooks.json`. The hooks run the project launcher, so the project needs no global `pregate setup` on the machine and the command writes no harness home. Run `pregate prepare` and `pregate project launcher` first.

```sh
pregate prepare
pregate project launcher --preview             # review, then the human approves
pregate project hooks --harness agy --preview  # review, then the human approves
pregate enable                                 # local consent, by the human
```

- **What it writes.** One named hook `pregate-project` (`enabled: true`) with `PreToolUse` (including `write_file`, `edit_file`, `run_command` and `manage_task`), `PostInvocation`, `Stop` and `SessionStart`. It holds no path of this machine, so it can be committed.
- **Working directory.** Antigravity runs workspace hooks from `<repo>/.agents`. The command walks up from its working directory first (reaching `<repo>/.pregate/bin` without reading stdin beforehand), and falls back to `workspacePaths[0]` from stdin when started outside the repository.
- **What it keeps.** Foreign named hooks stay untouched, and a second run changes no byte.
- **With a global setup.** Antigravity merges workspace `.agents/hooks.json` and global plugins (`~/.gemini/config/plugins/pregate-global`), so if both exist every tool call is evaluated twice. `pregate doctor` and `pregate status` report the scope as project-local only, global only, both or neither.

## Updates and removal

`pregate update` selects the latest published release. `update --version <v>` selects
a release; `update --engine <v>` installs a required engine pin. Updates preserve
project locks, so inspect each contract before adopting different bundled pack data.
`setup` refreshes global registrations and installed companion instructions from
the running engine. `doctor` reports missing or stale skills.

Update the global engine to 0.0.7 and review one or several
project contracts together:

```sh
pregate update --version 0.0.7
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
and the [changelog](../../CHANGELOG.md) for 0.0.7.

`disable` revokes consent for the current worktree. `uninstall` removes owned global
registrations and installation files; `uninstall --purge` also removes local state.
Both ask the human for `y` on the terminal (`--yes` skips that only when `PREGATE_UNATTENDED_APPROVAL=1` is already set).
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

## Release line

This guide describes 0.0.7. Public releases use the 0.0.x line. `pregate demo`,
`update --projects <path...> --preview`, the optional Rust pack, and the download
limits above (`curl -q`, TLS 1.2, redirect and size budgets) are what 0.0.7
installs. See the [v0.0.1 release notes](../releases/0.0.1.md) for what the first
public tag verified and the [changelog](../../CHANGELOG.md) for 0.0.7.
