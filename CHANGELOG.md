# Changelog

All notable changes to **Pregate** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Development, CI, and release jobs install Bun 1.4.4 from `.bun-version`. Bun 1.4.2 can segfault while leaving `bun test --isolate` after the tests have passed ([oven-sh/bun#43056](https://github.com/oven-sh/bun/issues/43056)); that crash is fixed in 1.4.3 and later. The Windows suite is the job that runs with `--isolate`. GitHub Actions stay pinned to a full commit SHA.

### Fixed
- A compiled-lock cache write no longer drops every error in an empty `catch`. A filesystem failure leaves the cache unwritten and admission stands, so the next hook recompiles. Any other error propagates.
- Terminal approval reads `/dev/tty` directly. Bun 1.4.4 pauses stdin when a readline stream on that device is destroyed, so the next question never saw what was typed.
- Looking up the project that started a hook no longer drops every error in an empty `catch`. A path with no existing ancestor is still not a project. A symlink loop or any other error propagates.
- The two known symlink gaps stay skipped, and they are not a passing attack. They use `test.skipIf` until `PREGATE_RUN_KNOWN_GAPS` is set, so `check --all` no longer sees an unconditional `test.skip`.

## [0.0.2] - 2026-11-02

What changed for people installing or gating a repository. The first public tag remains [0.0.1](docs/releases/0.0.1.md).

### Added
- Pre hooks reuse a compiled lock when the contract and this build are unchanged. Admission still compares that compiler output with the lock bytes, and a corrupt cache is recompiled.
- Release archives and `SHA256SUMS` are signed with keyless cosign (GitHub OIDC). Each signed file is published as a `.bundle`, and the workflow also attests build provenance. Installers and the GitHub Action refuse a checksum or signature that does not match. Set `require-signature: false` only for a release that was cut before signing.
- The no-new ratchet keeps debt that moved with an unchanged function body, and still treats a copy sitting next to the original as new debt. A symlink is judged by the path you spelled: a target in another enabled root is that root's problem, and a target in no enabled root is denied.
- `docs/guarantees.md` records, from an adversarial end-to-end run, where each ratchet and trust-boundary case is sound, best-effort, or still a gap.
- A findings count for each bundled pack against pinned repositories. Unlabeled findings stay unlabeled. The report does not turn them into a false-positive rate.
- The GitHub Action has a default for each mode. `check` scans the whole tree. `audit` no longer receives `--all` (that flag is a usage error). `ratchet` requires `base` and stops before it can fall through to a full check. A SARIF path follows the same rules.
- CI, release, native-release, the bootstrap jobs, `action.yml`, and the generated consumer workflow pin every GitHub action to a full commit SHA with a `# vX` comment. A lint fails if one is unpinned.
- The generated CI workflow reads the engine version from the base branch lock and verifies the cosign bundles before it unpacks the binary.

### Changed
- The default TypeScript contract was recalibrated against mature repositories. Some findings that used to deny are now warnings. A project that needs the old hard stop opts that rule into deny.
- Hook pre denies more ways around control commands: inline interpreters, scripts fed on stdin, scripts with no suffix, Makefiles, and edits of user-level harness settings. `pregate approve` applies only after a person confirms it on a terminal.
- There is still no npm package. Install from the GitHub release. The README and install guide say so.
- The Action's default version is 0.0.2, the release this tree publishes. `scripts/build.ts` refuses to pack installers or an Action whose version disagrees with `package.json`. The previous default asked for v0.0.1 signature bundles that were not published.
- Signing tests stay offline unless `PREGATE_E2E_SIGSTORE=1`. CI sets that and uses real cosign. A local `bun test` does not download cosign or contact Sigstore.
- Docs generation sorts the same way on every machine. Bench and smoke approve `enable` at a terminal, so they do not skip the human gate. Stdout and stderr finish writing when the pipe is non-blocking, which matters for hook decisions on Windows and in CI.
- On Windows, setup waits for an on-access scanner to release a new `pregate.exe` before renaming it into place. Ordinary atomic writes use that same retry. A lock that outlasts the wait still fails.
- `node_modules` is not tracked.
- **Action needed for unattended jobs:** `CI` in the environment no longer approves anything. Tools and agent sessions set `CI` too, so it was never a safe signal that nobody was at the keyboard. A job that really runs without a person (for example, one that calls `pregate enable --yes` or `uninstall --yes`) now sets `PREGATE_UNATTENDED_APPROVAL=1` itself. The shell guard denies an agent command that sets it.

### Fixed
Thank you to the pre-release reviewers who found these trust-boundary holes. Each one now has an end-to-end test that runs the compiled binary.
- **Loosening the contract needs a person.** Before this fix, a short script could switch rules to `advisor` and run `pregate preset compile`, and every check accepted the result. Now:
  - `check --ratchet` compares the base lock with the head lock and fails on any loosening. It prints a digest for that exact change. A maintainer accepts it by putting the digest in the repository variable `PREGATE_ACCEPT_CONTRACT`, which a pull request cannot edit. The Action has a matching `accept-contract` input. Protect `.pregate/` and `.github/workflows/` with CODEOWNERS so a pull request cannot rewrite the check either.
  - Stop and the pre-commit hook block a looser lock unless this machine recorded a person approving that exact lock. These local records help, but the same user can forge them. CI is the boundary.
  - `preset compile` asks a person before it writes a looser lock.
  - Scripts that run `preset compile`/`apply`, `init` or `promote` without `--preview`, `feedback apply`, `storage apply` or `issue submit` count as control commands, like `approve` and `disable` already did.
- **Removing consent is no longer silent.** If consent for a project is disabled or deleted mid-session, Stop warns and names the project, and `pregate status` warns for a day. This works on Linux, macOS and Windows, even when every consent record is gone.
- **Git history commands are writes.** `reset --hard`, `checkout <commit>`, `switch --detach`, `stash`, `clean -f`, `cherry-pick`, `revert`, `read-tree` and `checkout-index` are judged by the files Git says they would change. They are denied when they would change `.pregate/`.
- **Agents cannot approve through a native permission prompt.** Every harness denies an approval command the agent issues and tells the person what to type: `! pregate approve <code>` in Claude Code, Codex, Grok and agy, or a separate terminal in Cursor.
- **The control-command scan is harder to dodge.** It joins lines split with `\`, a backtick or `^`, reads the whole script instead of stopping at 1 MiB (anything over 64 MiB is refused), and decodes UTF-16 and UTF-32 scripts such as Windows PowerShell files. Inline Python, Node, Bun, Deno, Perl, Ruby and PHP code is judged by the write calls it makes, not by whether an argument looks like a file name.
- `docs/guarantees.md` and `SECURITY.md` now say exactly which of these protections are enforced in CI, which are best-effort on a local machine, and which detect tampering rather than prevent it.

## [0.0.1] - 2026-11-01

Initial public open-source release of **Pregate** (`v0.0.1`, core `0.0.1`).

### Added
- **Multi-Harness Pre-Execution Gate**: Intercepts `Write`, `Edit`, `MultiEdit`, `Bash`, and `Stop` events across **Claude Code**, **Cursor**, **Codex**, **Grok**, and **Antigravity (`agy`)**, plus Git `pre-commit` and CI gates (`pregate check`).
- **Multi-Language Static & Architectural Analysis**:
  - TypeScript / JavaScript (`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`)
  - Vue and Svelte Single-File Components (`.vue`, `.svelte` `<script>` block extraction with exact line/column offset preservation)
  - Python (`.py`) via bundled WebAssembly Tree-sitter grammar
  - Go (`.go`) via bundled WebAssembly Tree-sitter grammar
  - Rust (`.rs`) via bundled WebAssembly Tree-sitter grammar
- **Architectural & Production-Readiness Catalog**:
  - **68** built-in core checks across **2** core methodologies (`core/pregate-integrity` and `core/software-invariants`).
  - **44** bundled optional packs providing **1,028** optional checks (**1,096** total checks across languages, architecture, frameworks, data, auth, and cloud).
- **Digest-Bound Human Approval & Protected Governance**:
  - `.pregate/preset.json` and `.pregate/pregate.lock.json` contract compilation with SHA-256 digest-bound human previews (`pregate approve <code>`) and shell-command guards.
- **Debt Ratchet, Advisor Mode & Repository Audit**:
  - Zero-friction `advisor` mode, `pregate promote` to graduate clean rules to `enforce`, and `pregate check --ratchet --base <ref>` to block new debt while allowing incremental cleanup of existing baselines.
  - `pregate audit` and `pregate fitness` to verify architectural layers, invariants, and bounded behavioral fitness tests.
- **SARIF 2.1.0 Output & GitHub Code Scanning Integration**:
  - `pregate check --format sarif` and `pregate audit --sarif` emit OASIS SARIF 2.1.0 reports compatible with `github/codeql-action/upload-sarif`.
- **Cross-Platform Distribution**:
  - Self-contained native binaries for `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, and `windows-x64`.
  - Public installers (`install.sh` and `install.ps1`) from the GitHub release, root GitHub Action (`uses: pedroknigge/pregate@3260996631bf29c93caa98fedc8e24d9ec14ffd5 # v0.0.1`), Homebrew formula (`dist/pregate.rb`), and Scoop manifest (`dist/pregate.json`). No npm package in this release.
