# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Security Model

Pregate enforces a strict trust boundary between AI coding agents and repository governance:

- **Protected Contract**: agent edit tools and the shell commands the guard can read are denied when they write `.pregate/preset.json`, `.pregate/pregate.lock.json`, `.git/hooks`, or harness hook configurations (`~/.claude/settings.json`, `~/.cursor/hooks.json`, `~/.codex/`, `~/.grok/`, `~/.gemini/antigravity-cli/`). The shell guard is a heuristic over command text: a program it cannot read can still write these files. What closes that gap is the comparison, not the guard: `pregate check --ratchet` in CI fails on any contract loosening between the base and the head unless a maintainer accepts its digest in the repository variable `PREGATE_ACCEPT_CONTRACT`; Stop and the pre-commit check block a loosening that has no local human approval record. Local records live in the user's data directory and a same-user process can forge them, so the CI check is the boundary. Protect `.pregate/` and `.github/workflows/` with CODEOWNERS and required reviews. See [docs/guarantees.md](docs/guarantees.md).
- **Human-Only Approval**: Contract mutations, pack adoptions, consent changes and ratcheted exceptions require an interactive human terminal. The human types `y` on `/dev/tty` (`CONIN$` on Windows). A pipe is not that confirmation. `--yes` skips the question only when `PREGATE_UNATTENDED_APPROVAL=1` is already set in the environment (an unattended CI job; `CI` alone is not enough). Do not set it where an agent runs. The digest-bound command is `pregate approve <code>`, typed by the human; every harness denies it when the agent issues it.
- **Consent tampering is detected, not prevented**: consent and session records belong to the user account. When a session's root loses its consent, Stop and `pregate status` warn.
- **Deterministic Offline Gate**: Pre-execution and commit checks execute locally without network calls or arbitrary code execution from untrusted repositories.

## Reporting a Vulnerability

Please **do not** report security vulnerabilities (such as shell-guard bypasses, harness hook escapes, consent forgery, or path-traversal flaws) in public GitHub issues.

Instead, report vulnerabilities privately via **[GitHub Security Advisories](https://github.com/pedroknigge/pregate/security/advisories/new)**.

Include:
1. The Pregate version (`pregate --version`) and operating system.
2. The agent harness (if applicable) and minimal reproduction steps or fixture.
3. The expected vs. actual security boundary behavior.

We will acknowledge receipt within 48 hours and coordinate a fix and disclosure timeline with you.
