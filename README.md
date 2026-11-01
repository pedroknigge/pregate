# PREGATE

Architectural guardrails and executable engineering rules for AI coding agents. Checks edits before they hit disk and teaches the agent how to fix violations.

Supports **Claude Code**, **Cursor**, **Codex**, **Grok**, and **Antigravity (`agy`)**.

<p>
  <a href="https://github.com/pedroknigge/pregate/releases/tag/v0.0.1"><img alt="Release: v0.0.1" src="https://img.shields.io/badge/release-v0.0.1-0a0a0a.svg?style=for-the-badge&amp;labelColor=000000" height="28"></a>
  <a href="docs/packs.md"><img alt="Catalog: 44 Packs · 1,096 Checks" src="https://img.shields.io/badge/catalog-44%20packs%20%C2%B7%201%2C096%20checks-0a0a0a.svg?style=for-the-badge&amp;labelColor=000000" height="28"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-0a0a0a.svg?style=for-the-badge&amp;labelColor=000000" height="28"></a>
</p>

```text
PREGATE: ADVISOR (src/domain/order.ts) — 1 advisory finding (not blocking; agent decides):
- architecture/CA-DEP-001 [deny, advisor] line 4 (OrderService): OrderService imports code from a layer this layer may not depend on.
  Why: An inner layer that imports an outer one cannot be tested, reused or kept stable without dragging the details along.
  Fix: Declare what the inner layer needs as a port in a layer it may import, implement it in the outer layer, and wire both in the composition root the preset declares.
  Avoid: Barrels and re-exports that tunnel the same edge, type-only imports, require calls and path aliases that point at the same outer module.
```

---

## Installation

### macOS & Linux (Standalone Binary)

```bash
curl -fsSL https://github.com/pedroknigge/pregate/releases/latest/download/install.sh | sh
```

### Windows PowerShell

```powershell
irm https://github.com/pedroknigge/pregate/releases/latest/download/install.ps1 | iex
```

The installer downloads the release archive (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `windows-x64`) and `SHA256SUMS`, verifies the SHA-256 checksum before extraction, installs the immutable engine and `~/.local/bin/pregate` launcher, and registers non-intrusive hooks for your installed coding agents. See the [installation guide](docs/guides/installation.md) for manual checksum verification, Homebrew (`dist/pregate.rb`), Scoop (`dist/pregate.json`), and `npx pregate`.

### Install the Agent Skill (`npx skills`)

Global setup installs the `/pregate` companion skill automatically. You can also install or sync it via [`npx skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add pedroknigge/pregate
```

---

## Quick Start

Run `pregate` from the root of your project:

```bash
pregate
```

The interactive guide scans your stack, source roots, and documentation, recommends relevant rule packs from the 44 bundled packs, and prepares a single reviewed contract.

Inside a coding agent (**Claude Code**, **Cursor**, **Codex**, **Grok**, or **Antigravity**), you can also use the `/pregate` skill or run:

```bash
# 1. Inspect stack and prepare a zero-friction Advisor contract
pregate guide --preview --enforcement advisor

# 2. Human approves in a terminal with the short 12-character digest code printed by the preview
pregate approve <code>
```

Want to see PREGATE in action before configuring a repo? Run the self-cleaning sandbox demo:

```bash
pregate demo
```

---

## Zero-Friction Adoption in 3 Steps

PREGATE is designed so you never have to pause feature work to clean up an existing codebase first:

### 1. Start in `advisor` mode (Zero Blocking)

Start every rule—including `core/*` rules—in **`advisor`** mode. When an agent writes code that violates a rule, PREGATE does **not** block the edit (`exit 0`). Instead, it injects structured `PREGATE ADVISOR` guidance (`Why`, `Fix`, `Avoid`) directly into the agent's context so the agent can self-correct on the spot.

```bash
pregate guide --preview --enforcement advisor
```

### 2. Freeze legacy debt with the `no-new` ratchet

Existing files keep working. Under the `no-new` ratchet, pre-existing violations remain visible in `pregate audit`, while hooks only evaluate newly introduced violations or growing metric debt on edited files.

```bash
pregate audit --plan
```

### 3. Promote clean rules to `enforce`

As rules reach `0` violations across your codebase, `pregate audit` and `pregate report` list them as `enforceCandidates` (`core/*` rules first). Graduate all clean rules—or specific rules—to hard blocking (`enforce`) in one command:

```bash
# Promote all advisor rules that have 0 violations in your codebase
pregate promote --preview

# Or promote specific clean rules
pregate promote --rule core/EVA-TS-001,clean-code/CC-FN-001 --preview
```

---

## GitHub Action & SARIF 2.1.0 Code Scanning

Gate pull requests in CI and upload SARIF 2.1.0 findings directly to GitHub Code Scanning:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: pedroknigge/pregate@v0.0.1
  with:
    mode: ratchet
    base: ${{ github.event.pull_request.base.sha }}
    sarif-file: pregate.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: pregate.sarif
```

---

## CLI Commands

| Command | Description |
| --- | --- |
| `pregate` / `pregate guide` | Interactive project setup, pack discovery, migration, and audit workflow |
| `pregate guide --preview [--enforcement advisor\|shadow\|enforce]` | Prepare a reviewed contract with detected scope and recommended packs |
| `pregate approve <code>` | Approve and commit a pending contract review using its 12-char digest code |
| `pregate audit [--plan] [--incremental] [--sarif]` | Whole-project static & fitness audit with bounded refactoring plans |
| `pregate promote [--rule <id,id>] --preview` | Promote clean `advisor` rules (`0` violations) to `enforce` |
| `pregate check [--all \| --staged] [--format agent\|sarif]` | Evaluate changed files, staged index, or full tree against the lock |
| `pregate check --stdin --path <file>` | Pre-check proposed file contents from stdin before writing to disk |
| `pregate explain <rule> \| --path <file>` | Show a rule's rationale, parameters, and repair hint, or rules for a file |
| `pregate rules add "<sentence>"` | Turn one team rule into one review: a matching catalog rule, or a drafted rule with generated fixtures |
| `pregate rules draft <pack-dir> <area>/<name>` | Turn a rejected and corrected file pair into a tested custom rule |
| `pregate report [--days <n>] [--json]` | Summarize hook decisions, rule velocity, and `enforceCandidates` |
| `pregate status` / `pregate doctor` | Inspect worktree consent, active rule counts, and harness hook canaries |
| `pregate demo` | Run an isolated Python, Go, and Rust sandbox demonstration |

Read the complete [CLI Reference](docs/CLI.md) or run `pregate --help`.

---

## Supported Coding Agents

| Agent / Harness | Pre-Edit & Shell Guard | End-of-Turn (`Stop`) Audit | `Advisor` & Warning Channel | Human Approval Route |
| --- | --- | --- | --- | --- |
| **Claude Code** | `PreToolUse` | `Stop` | Yes (`systemMessage` / `additionalContext`) | Native permission prompt or `! pregate approve <code>` |
| **Cursor** | `preToolUse` | `stop` | Yes (`additional_context`) | `pregate approve <code>` in terminal |
| **Codex CLI** | `PreToolUse` | `Stop` | Yes (`additionalContext`) | `! pregate approve <code>` |
| **Grok Build** | `pre_tool_use` | `stop` | Yes (`additionalContext`) | `! pregate approve <code>` |
| **Antigravity (`agy`)** | `PreToolUse` | `Stop` | Enforced boundaries (`Stop` / `check`) | `! pregate approve <code>` |

- **Human-only consent:** A cloned repository or agent tool call can never enable hooks or weaken `.pregate/preset.json` on its own. Every policy change is bound to a SHA-256 digest and approved by a human.
- **Parallel subagents & worktrees:** Consent in a main repository automatically protects isolated Git worktrees created by parallel subagents. See [parallel agents](docs/features/parallel-agents.md).

---

## Languages & Bundled Rule Catalog

PREGATE ships deterministic WebAssembly Tree-sitter and AST parsers for **TypeScript, TSX, JavaScript, JSX, Vue (`.vue`), Svelte (`.svelte`), Python, Go, and Rust**, plus **44 optional rule packs** (**1,028 optional checks** + **68 builtin core checks**):

| Category | Bundled Packs |
| --- | --- |
| **Core Invariants** | `core/pregate-integrity` (anti-evasion guards), `core/software-invariants` (64 project fitness obligations) |
| **Languages** | `typescript`, `javascript`, `python`, `go`, `rust`, `java`, `kotlin`, `swift`, `dart` |
| **Architecture & Design** | `architecture` (FCIS, Hexagonal, Layer Direction), `ddd`, `clean-code`, `maintainability`, `senior`, `vibe-proof`, `design-invariants`, `dcouplr`, `pstack`, `musk` |
| **Web & Mobile Frameworks** | `nextjs`, `react`, `vue`, `angular`, `nestjs`, `express`, `trpc`, `tailwind`, `shadcn`, `flutter`, `swiftui`, `jetpack-compose`, `springboot` |
| **Data, Auth & Cloud** | `drizzle`, `prisma`, `supabase`, `firebase`, `authjs`, `vercel`, `solana`, `testing`, `accessibility`, `seo`, `analytics`, `i18n` |

Browse all packs and rules with `pregate pack list --library` or read the [Pack & Preset Catalog](docs/packs.md).

---

## Documentation & Community

- [Installation, Updates & Removal](docs/guides/installation.md)
- [Daily Workflow & Ratchet Guide](docs/guides/daily-use.md)
- [Using the `/pregate` Companion Skill](docs/guides/pregate-skill.md)
- [Command Reference (`docs/CLI.md`)](docs/CLI.md)
- [Pack & Preset Inventory (`docs/packs.md`)](docs/packs.md)
- [Core Catalog Reference (`docs/core-catalog.md`)](docs/core-catalog.md)
- [Rule Drafting from Corrections](docs/features/rule-drafting.md)
- [Project Fitness Functions](docs/features/project-fitness.md)
- [Architecture & Scope Limits](docs/ARCHITECTURE.md)
- [Release Notes (`v0.0.1`)](docs/releases/0.0.1.md) · [Changelog](CHANGELOG.md)
- [Contributing Guide](CONTRIBUTING.md) · [Security Policy](SECURITY.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
