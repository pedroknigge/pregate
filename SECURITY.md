# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Security Model

Pregate enforces a strict trust boundary between AI coding agents and repository governance:

- **Protected Contract**: `.pregate/preset.json`, `.pregate/pregate.lock.json`, `.git/hooks`, and harness hook configurations (`~/.claude/settings.json`, `~/.cursor/hooks.json`, `~/.codex/`, `~/.grok/`, `~/.gemini/antigravity-cli/`) are guarded against unauthorized modification by agent tool calls and shell commands.
- **Human-Only Approval**: Contract mutations, pack adoptions, consent changes and ratcheted exceptions require an interactive human terminal. The human types `y` on `/dev/tty` (`CONIN$` on Windows). A pipe is not that confirmation. `--yes` skips the question only when `CI` is already set in the environment. The digest-bound command is `pregate approve <code>`.
- **Deterministic Offline Gate**: Pre-execution and commit checks execute locally without network calls or arbitrary code execution from untrusted repositories.

## Reporting a Vulnerability

Please **do not** report security vulnerabilities (such as shell-guard bypasses, harness hook escapes, consent forgery, or path-traversal flaws) in public GitHub issues.

Instead, report vulnerabilities privately via **[GitHub Security Advisories](https://github.com/pedroknigge/pregate/security/advisories/new)**.

Include:
1. The Pregate version (`pregate --version`) and operating system.
2. The agent harness (if applicable) and minimal reproduction steps or fixture.
3. The expected vs. actual security boundary behavior.

We will acknowledge receipt within 48 hours and coordinate a fix and disclosure timeline with you.
