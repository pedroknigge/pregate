# PREGATE

PREGATE turns engineering standards into executable contracts that AI coding agents can follow, verify, and learn from.

**Who it's for.** Teams and AI-heavy codebases, where more than one agent touches the same repo. It is likely overkill for a tiny solo project.

Supports **Claude Code**, **Cursor**, **Codex**, **Grok**, and **Antigravity (`agy`)**.

Hook-based pre-execution protection is best-effort. The shell guard in [`src/shell.ts`](src/shell.ts) is a heuristic: it can deny a write, an admin command, or a protected path when the command text establishes that, and it does not deny syntax it does not understand. A harness only reports the tools it chooses to expose, so some capabilities never arrive as a hook call. What escapes is caught by the Stop audit, the Git pre-commit check, and CI, which run the same contract on the tree that landed. Pregate is not a filesystem security boundary.

<p>
  <a href="https://github.com/pedroknigge/pregate/releases/tag/v0.0.1"><img alt="Release: v0.0.1" src="https://img.shields.io/badge/release-v0.0.1-0a0a0a.svg?style=for-the-badge&amp;labelColor=000000" height="28"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-0a0a0a.svg?style=for-the-badge&amp;labelColor=000000" height="28"></a>
</p>

The default contract is small. Core includes a handful of change guards that look at the edit itself: a new file in an excluded path or in a layer whose language Pregate cannot analyze, an edit to a file that was already generated or excluded, a new inline suppression, and a new generated-code marker. The other core entries are project fitness obligations. They stay unverified, and they do not block, until you bind a command. Optional packs stay off until a preview you approve turns them on. `guide` starts in advisor mode, so the guards explain instead of blocking until you promote them. The exact split of static checks and fitness obligations is generated from this tree below.

What the agent sees in advisor mode:

```text
PREGATE: ADVISOR (src/domain/order.ts) — 1 advisory finding (not blocking; agent decides):
- architecture/CA-DEP-001 [deny, advisor] line 4 (OrderService): OrderService imports code from a layer this layer may not depend on.
  Why: An inner layer that imports an outer one cannot be tested, reused or kept stable without dragging the details along.
  Fix: Declare what the inner layer needs as a port in a layer it may import, implement it in the outer layer, and wire both in the composition root the preset declares.
  Avoid: Barrels and re-exports that tunnel the same edge, type-only imports, require calls and path aliases that point at the same outer module.
```

## Why not native agent policies (Cursor rules, Claude Code hooks)?

Cursor rules and a Claude Code hook are useful, and Pregate does not delete them. They are not the contract CI runs.

- **One contract, several agents.** The same `.pregate/preset.json` and lock are what Claude Code, Cursor, Codex, Grok, and Antigravity adapters read. A rule that lives only in a Cursor rules file is not applied when someone opens the repo in Codex.
- **The same contract locally and in CI.** Hooks, `pregate check`, the Git pre-commit template from `pregate install --git-hook`, and the GitHub Action all evaluate that lock. A hook script in your home directory is not what the pull request runs.
- **A no-new ratchet.** Under `ratchet.mode: "no-new"`, a violation on a symbol that was not in the before is denied, and so is a rule whose count grew on a symbol that was. An existing violation that did not grow is not a block. `pregate audit` still lists that debt. Metric findings block when the measured value grew.
- **Repair text the agent can use.** A finding carries `Why`, `Fix`, and `Avoid` from the rule, so the next attempt has a concrete repair instead of a bare deny.

## Platform support

| Platform | Status |
| --- | --- |
| macOS Apple silicon (arm64) | Stable |
| Linux x64 and arm64 | Experimental |
| Windows x64 | Experimental |

macOS arm64 is the platform this release is published for. Linux and Windows archives are experimental test builds. They are not a promise of production support until native release validation passes. A focused source check does not admit a platform. Bun is only needed to develop or build Pregate. The standalone binary does not need it. Intel Mac archives (`darwin-x64`) are produced; this table does not call them stable.

## Install, preview, approve, feedback

Try it without turning on blocking hooks. The GitHub Action below never registers a hook on your machine. Advisor mode shows `Why` / `Fix` / `Avoid` and does not block the edit.

```bash
# 1. Install the binary, or skip this and use only the GitHub Action
curl -fsSL https://github.com/pedroknigge/pregate/releases/latest/download/install.sh | sh

# 2. Prepare one reviewed advisor contract. Nothing is committed yet.
pregate guide --preview --enforcement advisor

# 3. A human approves the 12-character digest the preview prints.
! pregate approve <code>

# 4. When a finding is wrong, draft a label. Applying it is a separate human approval.
pregate feedback draft <finding-id> --as false-positive --note "why this case is allowed"
! pregate feedback apply <digest> --yes
```

Windows PowerShell:

```powershell
irm https://github.com/pedroknigge/pregate/releases/latest/download/install.ps1 | iex
```

The installer downloads the archive for this machine (`darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, or `windows-x64`) and `SHA256SUMS`, checks the SHA-256 before extraction, and, when `cosign` is installed, also verifies the Sigstore signature of that archive and `SHA256SUMS`. It installs the engine and launcher, and registers global hooks for coding agents it finds. See the [installation guide](docs/guides/installation.md) for checksum and signature verification, Homebrew (`dist/pregate.rb`), and Scoop (`dist/pregate.json`). There is no npm package yet. Install from the [GitHub release](https://github.com/pedroknigge/pregate/releases) with `install.sh` or `install.ps1`.

Global setup also installs the `/pregate` companion skill. You can sync it with [`npx skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add pedroknigge/pregate
```

## What install touches and how to remove it

Start with advisor mode or the GitHub Action if you want to see findings before anything on your laptop changes.

A full install runs `pregate setup`. That write is global. It does not edit the repository. Hooks stay inert for project rules until a human approves a contract and consents in that worktree. A committed preset is not consent.

What setup registers, for harnesses it finds:

- The engine under the data home (`~/.local/share/pregate/<version>` on macOS and Linux, `%LOCALAPPDATA%\pregate` on Windows) and the launcher on `PATH` (`~/.local/bin/pregate`, or `%LOCALAPPDATA%\pregate\bin` on Windows)
- `~/.claude/settings.json`, and `$CLAUDE_CONFIG_DIR/settings.json` when that is a different file. Claude Code, Cursor, and Grok share this registration
- `~/.cursor/hooks.json` when Cursor is installed
- `${CODEX_HOME:-~/.codex}/hooks.json` for Codex
- The `pregate-global` plugin for Antigravity (`agy`)
- The `/pregate` companion skill

`pregate install --git-hook --ci github` is a separate command. It adds a repository pre-commit hook and a GitHub Actions workflow. Setup does not do that.

The shell guard is not a separate switch. It is the shell half of the same global Pre hook.

# 2. Human approves in a terminal with the short 12-character digest code printed by the preview
pregate approve <code>
```
- `pregate disable` revokes consent for the current worktree and withdraws repository-wide consent. The human types `y` on the terminal. `--yes` skips that question only when `CI` is already set. Project rules stop applying here. The global hook is still installed. While a consent record exists, the shell guard can still deny a command that rewrites Pregate's install paths or tries to turn hooks off.
- `pregate uninstall` removes the hook registrations Pregate owns, the launcher, the installed engines, and the companion skill. Harnesses stop calling Pregate, so the shell guard stops running. Repository `.pregate/` directories and the `.pregate.bak` copies of harness files from before the first setup stay.
- `pregate uninstall --purge` does that and also deletes local state (sessions and consent under the state home). It still does not delete repository contracts.

## How Pregate compares

These tools overlap in places. None of them is a reason to avoid the others. The notes below are what their public docs say, plus what this repository actually does.

**ArkGate** ([pedroknigge/arkgate](https://github.com/pedroknigge/arkgate)), same author. ArkGate's README describes a machine-readable `ark.config.json`: layer import rules, optional ArkRules, a write path on supported hosts, and `arkgate-check` as the check you can require on a pull request. The Pregate spec draws a line: Pregate's job is that a write which violates the preset does not land, it works without ArkGate, and the two can sit together without both enforcing the same invariant. Debt burn-down, coverage, and lifecycle reporting were specified as ArkGate's territory ([docs/SPEC.md](docs/SPEC.md)). Pregate today also keeps a local `pregate report` and can inventory a tree with `pregate audit`. Use ArkGate when you want that architecture file and merge status. Use Pregate when you want one reviewed preset across several agents, with advisor mode so the existing tree is not a wall.

**Phasegate** ([junpei-9898/phasegate](https://github.com/junpei-9898/phasegate)) says it makes agents design before they code. Its README describes project-local hooks that block an implementation write when required design documents are missing, then validators at pre-commit and CI. It targets Claude Code, Codex, Cursor, Copilot, and others, and it needs Node.js 18 or newer. Pregate does not require a design-doc phase before an edit. It checks the edit against the rules in your preset.

**dependency-cruiser** ([sverweij/dependency-cruiser](https://github.com/sverweij/dependency-cruiser)) validates and draws dependencies in JavaScript, TypeScript, CoffeeScript, and LiveScript against forbidden, allowed, and required rules. Its docs cover circular dependencies, orphans, and package.json mismatches, and it reports for builds. It does not install coding-agent hooks. It is a strong fit beside Pregate when the question is the module graph. Pregate does not draw that graph.

**Semgrep** ([Semgrep Code](https://docs.semgrep.dev/semgrep-code/overview)) is static analysis for security issues, style, and bugs, with pattern and data-flow rules, locally (`semgrep scan`) or in CI (`semgrep ci`, diff-aware on a pull request when you use Semgrep App). Its data-flow overview says the engine is not path-sensitive and does not offer soundness guarantees. A match is a finding to review. Pregate is not a taint analyzer and does not claim to find vulnerabilities. Keep Semgrep for that.

**Semgrep Guardian** ([overview](https://docs.semgrep.dev/semgrep-guardian/overview)) already meets coding agents with hooks. Semgrep's docs describe hooks and MCP that scan what an agent generated (Semgrep Code, Supply Chain, and Secrets) and hand findings back so the agent can regenerate. The published Claude Code setup registers a post-tool hook and uses a Semgrep account for the hosted plugin. Pre-write interception is not unique to Pregate. Pregate's pre-edit hook can deny a supported tool call against a local lock, without sending the file to Semgrep, and that denial is still best-effort.

**ArchUnit** ([archunit.org](https://www.archunit.org/)) is a Java library. It imports bytecode and checks architecture from a plain unit test: packages, classes, layers, slices, and cycles. It does not install an agent hook, and Pregate does not import Java bytecode. If the rule you want is a JUnit test on a Java build, ArchUnit is the direct tool.

**CodeRabbit** ([pull request reviews](https://docs.coderabbit.ai/overview/pull-request-review)) reviews a pull request with models, posts a summary and inline comments, and can suggest a one-click fix. It runs after the PR exists. It is not a local preset, and it is not the lock `pregate check` evaluates. A review comment and a deterministic contract answer different questions. Many teams will want both.

## Adoption in three steps

### 1. Start in advisor mode

In advisor mode a violating edit is not blocked. The agent gets `Why`, `Fix`, and `Avoid` and decides what to do.

```bash
pregate guide --preview --enforcement advisor
```

### 2. Freeze existing debt with the no-new ratchet

`pregate audit` still shows the debt. The ratchet keeps a violation that did not grow from becoming a block.

```bash
pregate audit --plan
```

### 3. Promote clean rules to enforce

`pregate audit` and `pregate report` list advisor rules with no findings as `enforceCandidates`. Promoting them is a preview a human approves.

```bash
pregate promote --preview
pregate promote --rule core/EVA-TS-001,clean-code/CC-FN-001 --preview
```

## GitHub Action and SARIF

Gate a pull request in CI without installing hooks on a laptop. `mode: ratchet` runs `pregate check --ratchet` against the lock in the repo.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: pedroknigge/pregate@3260996631bf29c93caa98fedc8e24d9ec14ffd5 # v0.0.1
  with:
    mode: ratchet
    base: ${{ github.event.pull_request.base.sha }}
    sarif-file: pregate.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: pregate.sarif
```

## CLI commands

| Command | Description |
| --- | --- |
| `pregate` / `pregate guide` | Interactive project setup, pack discovery, migration, and audit workflow |
| `pregate guide --preview [--enforcement advisor\|shadow\|enforce]` | Prepare a reviewed contract with detected scope and recommended packs |
| `pregate approve <code>` | Approve and commit a pending contract review using its 12-char digest code |
| `pregate feedback draft` / `feedback apply <digest> --yes` | Label one finding, then have a human apply that label |
| `pregate audit [--plan] [--incremental] [--sarif]` | Whole-project static and fitness audit with bounded refactoring plans |
| `pregate promote [--rule <id,id>] --preview` | Promote clean advisor rules (no findings) to enforce |
| `pregate check [--all \| --staged] [--format agent\|sarif]` | Evaluate changed files, the index, or the full tree against the lock |
| `pregate check --stdin --path <file>` | Pre-check proposed file contents from stdin before writing to disk |
| `pregate explain <rule> \| --path <file>` | Show a rule's rationale, parameters, and repair hint, or rules for a file |
| `pregate rules add "<sentence>"` | Turn one team rule into one review: a matching catalog rule, or a drafted rule with generated fixtures |
| `pregate report [--days <n>] [--json]` | Summarize hook decisions, rule velocity, and `enforceCandidates` |
| `pregate disable --yes` / `uninstall` / `uninstall --purge` | Revoke this worktree, remove global hooks, or also delete local state |
| `pregate status` / `pregate doctor` | Inspect worktree consent, active rule counts, and harness hook canaries |
| `pregate demo` | Run an isolated Python, Go, and Rust sandbox demonstration |

Read the [command reference](docs/CLI.md) or run `pregate --help`.

## Supported coding agents

| Agent / Harness | Pre-edit and shell guard | End-of-turn (`Stop`) audit | Advisor and warning channel | Human approval route |
| --- | --- | --- | --- | --- |
| **Claude Code** | `PreToolUse` | `Stop` | Yes (`systemMessage` / `additionalContext`) | Native permission prompt or `! pregate approve <code>` |
| **Cursor** | `preToolUse` | `stop` | Yes (`additional_context`) | `pregate approve <code>` in a terminal |
| **Codex CLI** | `PreToolUse` | `Stop` | Yes (`additionalContext`) | `! pregate approve <code>` |
| **Grok Build** | `pre_tool_use` | `stop` | Yes (`additionalContext`) | `! pregate approve <code>` |
| **Antigravity (`agy`)** | `PreToolUse` | `Stop` | Enforced boundaries (`Stop` / `check`) | `! pregate approve <code>` |

Hook consent and preset changes are meant to be human and digest-bound. That protection is best-effort: a hook only sees the calls a harness sends, and known bypasses are still being closed. Stop, the Git pre-commit check, and CI are the backstops when a write lands anyway. Consent in a repository covers Git worktrees of that repository. See [parallel agents](docs/features/parallel-agents.md).

The warning column is uneven on purpose. A harness that does not show advisory text still has Stop and `pregate check`. That is part of why the hook is best-effort.

## Languages and optional packs

<!-- BEGIN readme catalog -->

Static checks: **473** (4 in core, 469 in optional packs). These can run from syntax or a diff.
Fitness obligations: **641** (64 in core, 577 in optional packs). A fitness obligation stays unverified, and does not block, until a project binds a command.
Pattern checks by language: typescript 410, python 17, go 8, rust 6. A check with two languages is counted in each. These are pattern checks only, not a claim that every grammar has the same coverage.

45 optional packs, grouped by the category in each `source.json`. Names that are not in this table are not packs in this tree.

| Category | Packs |
| --- | --- |
| **invariants** | `consumer-saas`, `design-invariants`, `enterprise-ready` |
| **language** | `go`, `javascript`, `python`, `rust`, `typescript` |
| **library** | `angular`, `authjs`, `dcouplr`, `drizzle`, `express`, `firebase`, `mongodb`, `nestjs`, `next-website`, `nextjs`, `node`, `nuxt`, `postgres`, `prisma`, `react`, `react-native`, `redis`, `solana`, `supabase`, `svelte`, `sveltekit`, `tailwind`, `trpc`, `vercel`, `vue` |
| **pattern** | `architecture`, `ddd` |
| **practice** | `agent-practices`, `clean-code`, `maintainability`, `mattpocock`, `security-audit`, `senior`, `testing`, `vibe-proof` |
| **process** | `musk`, `pstack` |

<!-- END readme catalog -->

`pregate pack list --library` and the [pack catalog](docs/packs.md) are the inventory. Selecting a pack is a preview, not an install side effect. `scripts/readme-catalog.ts` rewrites the block above from `catalog/` and `packs/`.

## Documentation

- [Installation, updates, and removal](docs/guides/installation.md)
- [Daily workflow and the ratchet](docs/guides/daily-use.md)
- [The `/pregate` skill](docs/guides/pregate-skill.md)
- [Command reference](docs/CLI.md)
- [Pack and preset inventory](docs/packs.md)
- [Core catalog](docs/core-catalog.md)
- [Rule drafting](docs/features/rule-drafting.md)
- [Project fitness](docs/features/project-fitness.md)
- [Architecture and scope limits](docs/ARCHITECTURE.md)
- [Release notes (`v0.0.1`)](docs/releases/0.0.1.md) · [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Code of conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
