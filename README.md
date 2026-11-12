# PREGATE

**Your `AGENTS.md` is a suggestion. Pregate turns it into rules that run before the agent writes the file.**

An AI agent can skip an instruction. The instruction loads in every session, and it fades in a long one. A rule in a Pregate contract does none of that. Pregate checks the edit the agent proposes, before a supported edit tool writes it, and tells the agent why the edit breaks the rule and how to repair it. CI checks the same contract again.

It fits any repository where an agent writes code, small or large, solo or team. It works alongside your linters, tests, CI, and review. It does not replace them.

[MIT license](LICENSE) · [Guarantees and limits](docs/guarantees.md) · [0.0.8 release notes](docs/releases/0.0.8.md)

## What it looks like

The agent proposes a file in `src/domain` that imports the database adapter. Before the file is written, the agent receives this:

```text
1) architecture/CA-DEP-001 → architecture/dependencies/layer-direction@1.0.0 · src/domain/order.ts:1
   the module imports code from a layer this layer may not depend on. Layer `domain` imports layer `infra` via `../infra/db.ts`.
   Why: An inner layer that imports an outer one cannot be tested, reused or kept stable without dragging the details along.
   Fix: Declare what the inner layer needs as a port in a layer it may import, implement it in the outer layer, and wire both in the composition root the preset declares.
   Avoid: Barrels and re-exports that tunnel the same edge, type-only imports, require calls and path aliases that point at the same outer module.
```

The agent repairs the edit and writes the corrected file. `Avoid` names the shortcuts that would pass the rule without fixing the problem. While a rule is in advisor mode, the same text arrives as a warning and nothing is blocked.

## Start in three steps

**1. Install.**

```sh
curl -fsSL https://github.com/pedroknigge/pregate/releases/latest/download/install.sh | sh
```

Or `npm i -g pregate`. Windows and the details are in [Install and adopt, step by step](#install-and-adopt-step-by-step).

**2. Type `/pregate` in your agent.** The skill inspects the repository, proposes the contract, the layer map and the rules from your instruction files, and reports in plain language. Without the skill, run `pregate guide --preview`.

**3. Approve.** This is the only step a human must do, in a terminal. That approval applies the contract, the layers and the compiled rules together:

```sh
pregate approve --preview     # read the change and see its code
pregate approve <code>
```

Nothing blocks on day one. Rules start in advisor mode: the agent sees each finding and decides. Violations that already exist are kept as known debt, and only new ones are reported. When a rule reports nothing for a week of real edits, Pregate says so at the start of a session and proposes to make it block. A rule that already has findings can block too: the existing ones stay as known debt and only new ones are denied. A human approves each promotion.

## Where the rules come from

| Layer | Source | When it applies |
| --- | --- | --- |
| **Core** | Pregate: the integrity of the contract and of generated files | Always |
| **Packs** | 48 optional packs derived from books, framework documentation and public agent skills, each with its source named | You choose them; `guide` suggests the ones your stack uses |
| **Yours** | Your own instruction files and your own architecture | Included in the one review you approve |

One mechanism serves all three: the agent or a pack proposes, the engine proves each rule against passing and failing code, and a human approves one exact change.

### Turn your instruction file into rules

```sh
pregate compile AGENTS.md
```

sorts every statement into one of three groups: it runs as a rule now, it needs an example, or it stays in the file as guidance. Real instruction files are mostly paragraphs, so the agent does the reading:

```sh
pregate compile AGENTS.md --template          # the statements, and the steps to complete them
pregate guide --preview --compile proposals.json
```

On a new project, pass that proposals file to `pregate guide --preview` so the rules join the contract review. `pregate compile apply proposals.json --preview` is the later review, once a contract exists. Before a contract exists, `compile apply` updates the pending guide review instead of starting a second approval.

For each rule the agent gives a short sentence, code that must fail, and code that must pass. Pregate keeps only the rules those cases prove and puts them in that one review. After approval, the report names the lines that can leave the instruction file, so they stop loading in every session. Pregate never edits that file.

A statement such as "write clear code" or "run the tests before you finish" is not a rule on a file, and Pregate says so instead of inventing one. [How it works and what it proves](docs/features/agent-proposed-contract.md).

### Let the agent propose your architecture

`pregate guide --preview` derives layers from conventional folder names and shows what they find today: which imports already break each layer, and which folders no layer covers. For folders it cannot place, the agent writes a layer map and passes it with `pregate guide --preview --layers <map.json>` on a new project. When `ark.config.json` is already in the repository, that same preview imports its layers and `coexist.arkgate` instead of a hand-written map. Once a contract exists, `pregate layers apply <map.json> --preview` reports the evidence before you approve, and `pregate import arkgate --preview` refreshes the ArkGate import.

A file in no layer is unrestricted, so a partial map leaves a way around it: move the code to a folder the map does not cover. Add `--complete` when you want no such folder. It refuses a map that leaves a source file, or a folder created later, outside every layer; a catch-all layer such as `src/**` closes the gap.

A statement that allows the code in one place ("only inside `src/lib/ai`") becomes a rule with an exception, and the exception is proved like the rule. What a real trial found, including a rule that was broader than its statement, is in the [case study](docs/benchmarks/case-study-production-repository.md).

## For the agent reading this

This section is written for an AI agent that reads this file to decide how to act. It is literal.

- Pregate is a command-line tool and a set of harness hooks. A repository uses it when `.pregate/preset.json` exists.
- When a human has enabled it, every file write and edit in scope is checked before it is written. A denial contains `Why`, `Fix` and `Avoid`. Revise the edit to satisfy the rule. Do not route the same change through a shell command, a script, or a different file.
- An advisor finding does not block. Revise the code, or keep it and tell the user why.
- You may run these, because they inspect or only prepare a review: `pregate guide --json`, `pregate guide --preview`, `pregate guide --preview --packs <ns,ns|none>`, `pregate guide --preview --layers <map.json> --compile <proposals.json>`, `pregate status`, `pregate explain <rule>`, `pregate check --stdin --path <file> --format agent`, `pregate audit`, `pregate report`, `pregate layers --json`, `pregate layers apply <map.json> --preview`, `pregate compile <file>`, `pregate compile <file> --template`, `pregate compile apply <proposals.json> --preview`, `pregate rules add "<sentence>"`, `pregate promote --preview`. On a new project, put the layer map and the compiled rules on `guide --preview` so one approval applies them. If `guide --preview` stops because one pack's nested packages cannot share a single include/exclude scope, run it again with `--packs` listing the packs to keep and omitting that pack. `guide --json` prints that scope error as JSON and exits non-zero. A project with no contract is told that none exists yet.
- You must not run these. Only a human does, in a terminal: `pregate approve`, `pregate enable`, `pregate disable`, `pregate uninstall`.
- Do not edit `.pregate/`, rule pack sources, or harness hook settings. Propose a change with the preview commands above.
- When you report to the user, use plain language, name real files from the repository, and give one action. The `/pregate` skill has the full procedure. The complete command list is in [docs/CLI.md](docs/CLI.md).
- Pregate does not prove that code is correct. Do not tell the user that a passing check means the change is right.

## What Pregate does

- Checks the proposed file content. Hooks reconstruct supported edits before evaluation. `pregate check --stdin --path <file>` accepts the complete proposed file without writing it.
- Shares one `.pregate/preset.json` and compiled `.pregate/pregate.lock.json` across the supported harnesses. Git pre-commit and CI evaluate that contract too.
- Lets you introduce rules gradually. Advisor rules explain without blocking. Enforce rules can block. The no-new ratchet blocks new or growing violations while allowing existing debt that did not grow.
- Lists existing findings with `audit`, then proposes advisor rules for enforcement with `promote`. Clean rules block every match. Under the no-new ratchet, rules that already have findings can move to enforce too: existing findings stay grandfathered and new ones are denied. A human reviews the change before it applies.
- Gives agents `Why`, `Fix`, and `Avoid` guidance, including known ways a superficial repair would miss the rule.
- Binds contract approval to a SHA-256 digest. A human approves the exact preview through a terminal, not through the agent's permission prompt.

The ratchet compares violations by rule and symbol, not arbitrary program meaning. It does not prove that code is correct. [Ratchet guarantees](docs/guarantees.md#ratchet-no-new).

## What Pregate does not do

Pregate is not a security boundary. Hooks provide early feedback, not a sandbox. They see only the calls an agent exposes. The shell guard uses text heuristics and does not deny unknown syntax by itself. Stop audits and Git pre-commit checks are local backstops, not tamper-proof controls. A local bypass is meant to be visible and to fail in CI, not to be impossible.

The [guarantees](docs/guarantees.md#contract-loosening) put the boundary in CI:

> This is the boundary: protect `.pregate/` and `.github/workflows/` with CODEOWNERS and required reviews, or a pull request can rewrite the workflow that runs the check.

CI's `check --ratchet` rejects contract loosening unless a maintainer accepts that exact change's digest outside the PR. Protect the Vercel build recipe the same way if you use that route.

- Keep your linters, formatter, type checker, tests, security scans, and human review. Pregate does not replace them.
- Pregate provides repair guidance, not source-code autofix. It has no editor diagnostics extension. Agent hook registrations, including the Antigravity plugin, are not that extension.
- The generated language list below is every extension the engine parses. Coverage differs by language and rule. Python, Go, and Rust need explicit language rules. Vue and Svelte `<script>` blocks are in the typescript row. Their templates are not a grammar.
- A framework pack is not a parser for every file that framework uses. The `astro` pack checks TypeScript and JavaScript files. The engine does not parse `.astro` templates.
- Textual integrity and placement guards can apply beyond parsed languages. Project fitness obligations need bound commands and current evidence. An unbound obligation is unverified, not a passing check.
- A rule made from your examples is proved against those examples. That does not prove it matches every form of the mistake.

See [language coverage](src/capabilities.ts), [architecture and scope limits](docs/ARCHITECTURE.md), and the [pack catalog](docs/packs.md).

## Supported agents and languages

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

This page describes engine 0.0.8.

[Release v0.0.8](https://github.com/pedroknigge/pregate/releases/tag/v0.0.8)

Supported harnesses, from `src/capabilities.ts`. A harness that is not in this table is not supported.

| Harness | Id | Session-start context | Advisory warnings |
| --- | --- | --- | --- |
| Claude Code | `claude-code` | yes | yes |
| Codex CLI | `codex` | yes | yes |
| Cursor | `cursor` | yes | yes |
| Grok Build | `grok` | no | yes |
| Antigravity (agy) | `agy` | yes | yes |
| OpenCode | `opencode` | yes | yes |

Grok Build has no session-start context.

Codex CLI 0.167.0 is the minimum supported version (`src/harness/codex.ts`).

Parsed languages, from `src/capabilities.ts`. This is the whole parser list.

- `typescript` — `.ts`, `.mts`, `.cts`, `.tsx`, `.vue`, `.svelte`. tree-sitter-typescript 0.23.2 (including <script> blocks in .vue and .svelte).
- `javascript` — `.js`, `.mjs`, `.cjs`, `.jsx`. TypeScript/TSX grammar; see each rule's paths.
- `python` — `.py`. tree-sitter-python 0.25.0. Explicit language rules required; root/src regular packages only, no search hooks or value-flow resolution.
- `go` — `.go`. tree-sitter-go 0.25.0. Explicit language rules required; single-module package directories and unversioned local replacements, no workspace/module-graph resolution.
- `rust` — `.rs`. tree-sitter-rust 0.24.2. Explicit language rules required; conventional Cargo modules, editions 2018/2021/2024, explicit use trees and canonical crate/self/super/std/core/alloc source paths. Source AST metrics/patterns only: no macro expansion, compiler/type/trait flow, cfg evaluation or Cargo graph. Custom roots, path/workspace dependencies and repository Cargo overrides are unresolved; restricted unresolved imports fail closed.

Not in that list: `.astro`, `.java`, `.kt`, `.kts`, `.swift`, `.dart`.

<!-- END generated reference -->

## How Pregate fits with your tools

Keep the tools you trust for their rule depth, fixes, and editor feedback. Pregate's distinction is the combination of a shared agent policy, pre-write evaluation, one ratchet and promotion workflow, and feedback written for the agent's next attempt.

| Keep using | For | Pregate adds alongside it |
| --- | --- | --- |
| [ESLint](https://eslint.org/docs/latest/use/command-line-interface) and [Ruff](https://docs.astral.sh/ruff/) | Language lint rules and supported automatic fixes | The same reviewed contract across supported agents, with pre-write feedback |
| [Semgrep](https://semgrep.dev/docs/semgrep-code/overview) | Security analysis with pattern and data-flow rules | Engineering-contract checks, not a replacement vulnerability scanner |
| [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | Dependency validation and visualization | Agent feedback for the architecture rules Pregate models |
| [ArchUnit](https://www.archunit.org/) | Architecture tests over Java bytecode | A separate policy for Pregate's supported languages, not Java analysis |
| CI and human review | Merge checks, behavioral evidence, and judgment | The same contract checked earlier in the edit loop and again in CI |

Pre-write checks, baselines, and agent integrations exist elsewhere. ESLint already accepts stdin and supports bulk suppressions. You can build your own hooks. Pregate packages its contract workflow across supported agents; it does not claim to have invented these mechanisms.

Pregate currently evaluates its own rules. It does not run ESLint, Ruff, or Semgrep as built-in analysis backends.

## Install and adopt, step by step

Start with advisor rules and inspect the findings before choosing what should block. The installer changes global agent settings, so read [what install touches](#what-install-touches-and-how-to-remove-it) first. For no local hooks, start with the [GitHub Action](#github-action-and-sarif).

### 1. Install the standalone binary

macOS and Linux:

```sh
curl -fsSL https://github.com/pedroknigge/pregate/releases/latest/download/install.sh | sh
```

Windows PowerShell, experimental:

```powershell
irm https://github.com/pedroknigge/pregate/releases/latest/download/install.ps1 | iex
```

You can also install from npm:

```sh
npm i -g pregate
npx pregate --version
```

The npm package is a launcher (`bin/pregate.mjs`). On first run it downloads the GitHub release archive for that package version (about 55 MB), verifies `SHA256SUMS`, optionally verifies Sigstore bundles when `PREGATE_REQUIRE_SIGNATURE=1` and `cosign` is available, then runs the same installer as `install.sh` / `install.ps1`, which registers harness hooks and the companion skill. Later runs use the cached engine. Bun is needed only for development or builds from source, not to run the standalone binary. See [installation and signature requirements](docs/guides/installation.md).

### 2. Preview an advisor contract in your Git repository

```sh
pregate guide --preview
pregate approve --preview
```

`guide --preview` selects the packs it infers. To leave one out, name the packs this review should keep. That is the escape hatch when onboarding stops because a pack's nested packages cannot share one include/exclude scope:

```sh
pregate guide --preview --packs typescript,javascript
```

`--packs none` adds no optional packs. Omit only the blocked pack unless an empty selection is the review you want. `guide --json` includes that scope error and exits non-zero; it does not write a contract.

A new project is proposed in advisor mode: the agent sees each finding and nothing blocks. Pass `--enforcement enforce` or `--enforcement shadow` to propose another mode. Review the proposed scope, selected packs, layers, and effective rule modes. Preview does not apply a contract or grant consent. In a separate human terminal, run the displayed command, replacing `<code>` with the preview's 12-character digest code:

```text
pregate approve <code>
```

Approval normally commits the contract in a Git worktree. Add `--no-commit` to leave it uncommitted. Claude Code, Codex, Grok, agy, OpenCode and Cursor each need a separate terminal: a harness `!` line has no terminal, so it cannot approve. On agy 1.5.6, `! pregate approve <code>` was refused because stdin is not a terminal; the earlier agy note was only 1.2.17. Open Terminal/iTerm on macOS or Linux, or a new PowerShell window on Windows, in the project and run `pregate approve <code>`. The agent must not run the approval command.

```sh
pregate status
pregate audit --plan
```

`audit` ends with a line that states its exit code. `Exit 0` and `Exit 1` are complete results: nothing blocks, or findings block. `Exit 2` is an incomplete audit, for example a file with a syntax error. It still prints a report, and it is not a count of violations.

A committed contract is not local consent. For an existing cloned or disabled contract, review `status`, then use `pregate enable` in a human terminal and confirm. Advisor rules do not block edits, but explicit enforcing overrides, contract integrity failures, and bound fitness requirements can still block. Review the preview rather than assuming every rule became advisory.

### 3. Calibrate, then promote

`audit` inventories debt. With `ratchet.mode: "no-new"`, enforcing rules prevent growth instead of demanding a clean tree on the first edit. See the [daily workflow](docs/guides/daily-use.md) for baseline and mode details.

```sh
pregate promote --preview
```

`audit` and `report` list clean advisor rules as `enforceCandidates`, and a session start names them when they have stayed clean for a week of edits. When the ratchet is `no-new`, `audit` also lists advisor rules that already have findings as `ratchetCandidates`. `pregate promote --preview` can move either set to enforce. A clean rule blocks every match. A rule with existing findings keeps those matches grandfathered by the no-new ratchet and denies new ones. A strict ratchet does not grandfather, so dirty rules stay out. Review and approve the promotion's new digest. Zero findings is a candidate for enforcement, not proof that a rule covers every case.

For a wrong finding, record feedback separately:

```sh
pregate feedback draft <finding-id> --as false-positive --note "why this case is allowed"
```

Applying the label needs its own human approval. See [feedback](docs/features/human-feedback.md). The `/pregate` companion skill helps the agent follow this workflow. Setup installs it, or you can sync it with [`npx skills`](https://github.com/vercel-labs/skills):

```sh
npx skills add pedroknigge/pregate
```

## What install touches and how to remove it

The full installer runs `pregate setup` globally. Setup installs the engine, launcher, and companion skill. For detected agents, it registers owned hooks in Claude settings, Cursor hooks, Codex hooks, the Antigravity `pregate-global` plugin, or the OpenCode plugin folder named by `~/.config/opencode/opencode.json`. Claude Code, Cursor, and Grok share the Claude settings registration. Setup does not create a repository contract or repository CI workflow.

Setup exits 0 when at least one detected harness was wired. A harness that could not be wired is a warning and names the next step. Codex that does not confirm hook trust is that warning: `hooks.json` is left unchanged, and the message says to approve the Pregate hooks in Codex with `/hooks`, then rerun `pregate setup`. Setup exits 1 when no harness was wired, or on a real error. `install.sh` and `install.ps1` stop only on that non-zero exit. `pregate guide` still applies a reviewed contract after a warning-only setup and says agent-edit protection stays degraded until a harness is wired.

A repository can register Claude Code on its own, without a machine-wide setup. `pregate prepare` caches the engine the lock pins, `pregate project launcher` installs the reviewed launcher, and `pregate project setup` merges hooks into `.claude/settings.json` that run that launcher. The hooks do not fall back to a global installation. Claude's workspace-trust dialog and `pregate enable` stay separate.

Project-rule hooks need local consent. A preset committed by someone else does not activate them. Read the [installation guide](docs/guides/installation.md) for exact paths, backups, updates, checksum verification, and signatures.

- `pregate disable` revokes current-worktree consent and withdraws repository-wide consent after human confirmation. Global hooks remain. While a consent record exists, the shell guard can still reject changes to Pregate's installation and hook settings.
- `pregate uninstall` removes owned global hook registrations, launcher, engines, and companion skill. Repository contracts and the original `.pregate.bak` settings backups remain.
- `pregate uninstall --purge` also deletes local session and consent state. It still leaves repository contracts alone.

## GitHub Action and SARIF

CI can evaluate the contract without installing hooks on a laptop. After initialization, generate a Git pre-commit hook and a GitHub Actions workflow with:

```sh
pregate install --git-hook --ci github
```

The generated workflow runs `check --ratchet` against the PR base and pins the engine from the base branch's lock. Protect the contract and workflow with CODEOWNERS and required reviews.

For a hand-written workflow, see the [Action inputs](action.yml) and [installation guide](docs/guides/installation.md). Pin the Action to a reviewed full commit SHA. `check --format sarif` and `audit --sarif` produce reports for GitHub Code Scanning. See the [command reference](docs/CLI.md).

## Vercel

The same gate can run in a Vercel build, including a repository with no GitHub Actions workflow:

```sh
pregate install --ci vercel
```

Use `--ci github,vercel` for both. When both providers are configured, both must pass. Protect `vercel.json` and the build script with CODEOWNERS too. See the [Vercel guide](docs/guides/vercel-ci.md).

## Platform support

| Platform | Status |
| --- | --- |
| macOS Apple silicon, arm64 | Stable |
| Linux x64 and arm64 | Experimental test builds |
| Windows x64 | Experimental test builds |

Intel Mac archives are produced but are not declared stable. Passing a CI job is not a promise of production support. 0.0.8 is this release. Windows users of 0.0.2 should upgrade. Two bugs in that release could let an edit through on Windows without a finding. 0.0.3 denies those calls. See the [0.0.8 release notes](docs/releases/0.0.8.md) and [Windows verification guide](docs/guides/windows-verification.md).

### Measured hook latency

CI measures the compiled Pre hook on 200-line and 2,000-line TypeScript fixtures and compares each route with that platform's baseline. The 150 ms p95 budget belongs to the reference M5 Pro with 18 cores, and a passing CI job does not mean that budget was met. Method, baselines, and one recorded hosted run: [hook latency](docs/benchmarks/hook-latency.md).

## Languages and optional packs

Counts and pack names below are generated from this tree. They are an implementation inventory, not a measure of semantic coverage or precision. The [pack catalog](docs/packs.md) records defaults and limits. Use `pregate pack list --library` on your installed engine and inspect a pack before selecting it. Selection is a reviewed preview, not an install side effect.

<!-- BEGIN readme catalog -->

Static checks: **514** (4 in core, 510 in optional packs). These can run from syntax or a diff.
Fitness obligations: **641** (64 in core, 577 in optional packs). A fitness obligation stays unverified, and does not block, until a project binds a command.
Pattern checks by language: typescript 438, python 18, go 8, rust 6. A check with two languages is counted in each. These are pattern checks only, not a claim that every grammar has the same coverage.

48 optional packs, grouped by the category in each `source.json`. Names that are not in this table are not packs in this tree.

| Category | Packs |
| --- | --- |
| **invariants** | `consumer-saas`, `design-invariants`, `enterprise-ready` |
| **language** | `go`, `javascript`, `python`, `rust`, `typescript` |
| **library** | `angular`, `astro`, `authjs`, `dcouplr`, `drizzle`, `express`, `firebase`, `hono`, `mongodb`, `nestjs`, `next-website`, `nextjs`, `node`, `nuxt`, `postgres`, `prisma`, `react`, `react-native`, `redis`, `solana`, `supabase`, `svelte`, `sveltekit`, `tailwind`, `tanstack-query`, `trpc`, `vercel`, `vue` |
| **pattern** | `architecture`, `ddd` |
| **practice** | `agent-practices`, `clean-code`, `maintainability`, `mattpocock`, `security-audit`, `senior`, `testing`, `vibe-proof` |
| **process** | `musk`, `pstack` |

<!-- END readme catalog -->

Regenerate the version, harness, language, and pack blocks with `bun scripts/docs-reference.ts`. `bun scripts/readme-catalog.ts` rewrites only the pack block.

## CLI commands

| Task | Command |
| --- | --- |
| Prepare an advisor contract | `pregate guide --preview` |
| Review a pending contract | `pregate approve --preview` |
| Inspect consent and installation | `pregate status` / `pregate doctor` |
| Sort an instruction file into rules and guidance | `pregate compile <rules.md>` |
| Stage rules an agent proposed from that file | `pregate compile apply <proposals.json> --preview` |
| Show the layer map with evidence | `pregate layers` |
| Stage a layer map an agent proposed | `pregate layers apply <map.json> --preview` |
| Evaluate proposed file content | `pregate check --stdin --path <file> --format agent` |
| Check the full tree or staged files | `pregate check --all` / `pregate check --staged` |
| Check new debt against a base | `pregate check --ratchet --base <sha>` |
| Inventory debt and plan repairs | `pregate audit --plan` |
| Propose clean rules for enforcement | `pregate promote --preview` |
| Explain a rule | `pregate explain <rule>` |
| Summarize what the gate did to the agent | `pregate report` |
| Run an isolated example | `pregate demo` |

Read the [command reference](docs/CLI.md) or run `pregate --help` for the complete CLI.

## Documentation

- [Installation, updates, and removal](docs/guides/installation.md)
- [Daily workflow and the ratchet](docs/guides/daily-use.md)
- [The `/pregate` skill](docs/guides/pregate-skill.md)
- [Instruction files to rules, layers with evidence, promotion](docs/features/agent-proposed-contract.md)
- [Command reference](docs/CLI.md)
- [Pack and preset inventory](docs/packs.md)
- [Core catalog](docs/core-catalog.md)
- [Rule drafting](docs/features/rule-drafting.md)
- [Project fitness](docs/features/project-fitness.md)
- [Hook latency](docs/benchmarks/hook-latency.md)
- [Case study: one production repository](docs/benchmarks/case-study-production-repository.md), with what was measured and what was not
- [Shell guard friction](docs/benchmarks/shell-guard-friction.md): which routine commands the guard refuses
- [Session trial](docs/benchmarks/session-trial.md): 48 real sessions of Claude Code and Codex on three pinned public repositories, with and without the gate: no new finding in either arm, 17 denial rows in the gated arm (7 labeled true, 8 false, 2 unclear; an AI coding agent wrote the labels)
- [Guarantees and residual limits](docs/guarantees.md)
- [Maintenance, reproducible build and rollback](docs/guides/maintenance.md)
- [Architecture and scope limits](docs/ARCHITECTURE.md)
- [Release notes for 0.0.8](docs/releases/0.0.8.md) · [First public release (`v0.0.1`)](docs/releases/0.0.1.md) · [Changelog](CHANGELOG.md)

## Contributing

Read [Contributing](CONTRIBUTING.md), [Security](SECURITY.md), and the [Code of conduct](CODE_OF_CONDUCT.md) before submitting a change or reporting a vulnerability. Include a valid example that should pass and an invalid example that should fail when proposing a rule change.

## License

[MIT](LICENSE). Release archives also include [third-party notices](THIRD_PARTY_NOTICES).
