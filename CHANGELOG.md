# Changelog

All notable changes to **Pregate** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
