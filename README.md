# PREGATE

**Pregate checks an AI coding agent's edit against your project's own rules before the edit is written, and tells the agent why it fails and how to fix it.**

An agent can skip an instruction in `AGENTS.md`. A rule in a Pregate contract is checked on every edit, and CI checks the same contract again. Pregate works alongside your linters, tests, CI and review. It does not replace them, and it does not prove that code is correct.

[MIT license](LICENSE) · [Guarantees and limits](docs/guarantees.md) · [0.0.20 release notes](docs/releases/0.0.20.md)

## What it does that a linter does not

### 1. It turns your instruction file into rules that are checked

`pregate compile` reads `AGENTS.md`, `CLAUDE.md` or `.cursorrules` and sorts each statement: it is a rule now, it needs an example, or it stays as guidance.

```text
$ pregate compile AGENTS.md
Rules (1):
  L2 "Do not import `moment`. Use `date-fns`." -> project rule: no import of the package moment; cases generated
Need one example each (1):
  L3 "Never use `console.log` in `src/`." -> pregate rules add "Never use console.log in src/." --fail "<bad code>" --pass "<good code>"
Stay in AGENTS.md (2):
  L4 "Write clear code." -> guidance or an agent action; no check on a file decides it
  L5 "Run the tests before you finish." -> guidance or an agent action; no check on a file decides it
```

A rule is kept only when code that must fail does fail and code that must pass does pass. Pregate never edits your instruction file. [How it works and what it proves](docs/features/agent-proposed-contract.md).

### 2. It enforces architecture boundaries before the file is written

You declare layers, and Pregate checks each import against them: a file in `src/domain` that imports `../infra/db.ts` is reported as `architecture/CA-DEP-001` before the write, not in a review. The same step checks banned packages. It also checks import cycles in TypeScript: "This edit adds an import cycle". `pregate guide --preview` proposes layers from your folder names and shows which imports break them today.

### 3. It holds a "no new debt" line

Violations that exist when you start are kept as known debt. Only new ones are reported, so you do not need a clean tree first. The record follows the code: a function renamed from `parseBody` to `parseBody2` with the same body keeps its old debt and gets no new finding. [Ratchet guarantees](docs/guarantees.md#ratchet-no-new).

### 4. Every finding says Why, Fix and Avoid, in six agent harnesses

The text is written for the agent's next attempt. `Avoid` names the shortcuts that pass the rule without fixing the problem. For the layer rule above:

```text
why: An inner layer that imports an outer one cannot be tested, reused or kept stable without dragging the details along.
fix: Declare what the inner layer needs as a port in a layer it may import, implement it in the outer layer, and wire both in the composition root the preset declares.
avoid: Barrels and re-exports that tunnel the same edge, type-only imports, require calls and path aliases that point at the same outer module.
```

One contract serves Claude Code, Codex CLI, Cursor, Grok Build, Antigravity and OpenCode. Git pre-commit and CI read it too.

## Start

```sh
curl -fsSL https://github.com/pedroknigge/pregate/releases/latest/download/install.sh | sh
pregate enable     # in your project; a human runs this, not the agent
```

Or `npm i -g pregate`. Windows and the details are in [Install details](#install-details).

`pregate enable` proposes a contract for the stack it finds, prints a summary, and applies it when you answer `y`. It starts in advisor mode: the agent sees each finding and nothing blocks. `pregate status` then prints:

```text
Pregate is on in /path/to/your/project: advisor mode. 0 rules block, 24 inform.
Needs attention: no agent harness has Pregate hooks on this machine, so no agent is checked.
Next: pregate setup. Details: pregate status --verbose.
```

This sample is from a machine with no agent hooks installed. The second line appears only when something needs attention.

When an advisor rule reports nothing for a week of real edits, Pregate says so at the start of a session and proposes to make it block. A human approves each promotion with `pregate promote --preview`.

## What blocks and what does not

Locally, a hook blocks two things only: an edit that breaks a rule the project set to enforce, and an agent that acts on Pregate itself. Everything else Pregate cannot check is a one-line `PREGATE NOTE`, and the call goes through.

The cost: a repository without CI that runs `pregate check --ratchet` has only notes locally, and nothing holds a loosened contract there. Pregate is not a security boundary or a sandbox. [What blocks locally](docs/guarantees.md#what-blocks-locally) · [CI setup](#ci).

## Rule packs are optional

A contract has three sources: a small core that is always on, your own rules and layers, and optional packs for languages, frameworks and practices. The packs are not equally validated. Some have labeled findings on real repositories and many have none. Read the measured numbers in [rule precision](docs/guides/rule-precision.md) before you select a pack, and inspect it with `pregate pack list --library`. The [inventory](#rule-inventory) below is a count, not a quality claim.

## Platform support and limits

| Platform | Status |
| --- | --- |
| macOS Apple silicon, arm64 | Stable |
| Linux x64 and arm64 | Experimental test builds |
| Windows x64 | Experimental test builds |

Intel Mac archives are produced but are not declared stable. 0.0.20 is this release. Windows users of 0.0.2 must upgrade: two bugs in that release could let an edit through without a finding. See the [Windows verification guide](docs/guides/windows-verification.md).

- Pregate parses TypeScript, JavaScript, Python, Go and Rust. Coverage differs by language and rule. Python, Go and Rust need explicit language rules. The exact list is below.
- A framework pack is not a parser for that framework's files. The `astro` pack checks TypeScript and JavaScript; `.astro` templates are not parsed.
- Hooks see only the calls an agent exposes, and the shell guard uses text heuristics. A local bypass is meant to be visible and to fail in CI, not to be impossible.
- Pregate gives repair guidance, not source-code autofix. It has no editor diagnostics extension.
- It evaluates its own rules. It does not run ESLint, Ruff or Semgrep, and it is not a vulnerability scanner. Keep those tools.
- A rule made from your examples is proved against those examples. That does not prove it matches every form of the mistake.
- A fitness obligation needs a bound command and current evidence. An unbound obligation is unverified, not a passing check.

The Pre hook has a 150 ms p95 budget on the reference machine; a passing CI job does not mean that budget was met elsewhere. [Hook latency](docs/benchmarks/hook-latency.md) · [Architecture and scope limits](docs/ARCHITECTURE.md).

## Supported agents and languages

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

This page describes engine 0.0.20.

[Release v0.0.20](https://github.com/pedroknigge/pregate/releases/tag/v0.0.20)

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

## For the agent reading this

This section is written for an AI agent that reads this file to decide how to act. It is literal.

- Pregate is a command-line tool and a set of harness hooks. A repository uses it when `.pregate/preset.json` exists.
- When a human has enabled it, every file write and edit in scope is checked before it is written. A denial contains `Why`, `Fix` and `Avoid`. Revise the edit to satisfy the rule. Do not route the same change through a shell command, a script, or a different file.
- A hook blocks two things only: an edit that breaks a rule the project set to enforce, and an action on Pregate itself (`pregate enable` or `pregate disable`, approving for the human, changing a harness's hooks, writing inside `.pregate/`). Do not look for another way around the second one. Tell the user what you wanted to change.
- An advisor finding does not block. Revise the code, or keep it and tell the user why.
- A line that starts with `PREGATE NOTE` means Pregate could not check something. The call went through. It is not a reason to stop the user's task.
- You may run these, because they inspect or only prepare a review: `pregate guide --json`, `pregate guide --preview`, `pregate guide --preview --packs <ns,ns|none>`, `pregate guide --preview --layers <map.json> --compile <proposals.json>`, `pregate status`, `pregate explain <rule>`, `pregate check --stdin --path <file> --format agent`, `pregate audit`, `pregate report`, `pregate layers --json`, `pregate layers apply <map.json> --preview`, `pregate compile <file>`, `pregate compile <file> --template`, `pregate compile apply <proposals.json> --preview`, `pregate rules add "<sentence>"`, `pregate promote --preview`. On a new project, put the layer map and the compiled rules on `guide --preview` so one approval applies them. If `guide --preview` stops because one pack's nested packages cannot share a single include/exclude scope, run it again with `--packs` listing the packs to keep and omitting that pack.
- You must not run these. Only a human does, in a terminal: `pregate approve`, `pregate enable`, `pregate disable`, `pregate uninstall`.
- Do not edit `.pregate/`, rule pack sources, or harness hook settings. Reading them is allowed. Propose a change with the preview commands above.
- When you report to the user, use plain language, name real files from the repository, and give one action. The `/pregate` skill is a one-page guide to the common requests. The complete command list is in [docs/CLI.md](docs/CLI.md).
- Pregate does not prove that code is correct. Do not tell the user that a passing check means the change is right.

## Install details

Windows PowerShell, experimental:

```powershell
irm https://github.com/pedroknigge/pregate/releases/latest/download/install.ps1 | iex
```

The npm package is a launcher. On first run it downloads the release archive for that version (about 55 MB), verifies `SHA256SUMS`, and runs the same installer. Bun is needed only to build from source.

The installer runs `pregate setup`, which changes global agent settings. It installs the engine, a launcher and the `/pregate` skill, and registers hooks for each agent it detects. It does not create a repository contract or a CI workflow. The hooks act only in a directory where a human ran `pregate enable`; a contract committed by someone else does not activate them. A repository can also register its own hooks with no machine-wide setup.

- `pregate disable` turns the project off after human confirmation. Global hooks stay installed.
- `pregate uninstall` removes the global hooks, launcher, engines and skill. Repository contracts and the settings backups remain.
- `pregate uninstall --purge` also deletes local session and consent state.

Exact paths, backups, project-local hooks, checksums and signatures: [installation guide](docs/guides/installation.md).

## Choose what goes into the contract

`pregate enable` is the whole setup. To choose packs, a layer map, or rules from your instruction files before you approve, prepare the review yourself or type `/pregate` in your agent:

```sh
pregate guide --preview                             # propose a contract; add --packs <a,b|none> to choose packs
pregate guide --preview --layers map.json --compile proposals.json
pregate approve --preview                           # read it, then: pregate approve <code>
pregate audit --plan                                # list existing debt
pregate promote --preview                           # propose advisor rules for enforcement
```

A preview does not apply a contract. Approval is bound to a SHA-256 digest of the exact preview, and a human gives it in a terminal. A file in no layer is unrestricted; `--complete` refuses a layer map that leaves a source file outside every layer. For a wrong finding, record feedback with `pregate feedback draft <finding-id> --as false-positive`. See the [daily workflow](docs/guides/daily-use.md), [feedback](docs/features/human-feedback.md) and the [command reference](docs/CLI.md). `pregate --help` prints the seven everyday commands.

## CI

```sh
pregate install --git-hook --ci github     # or --ci vercel, or --ci github,vercel
```

The generated workflow runs `check --ratchet` against the PR base and pins the engine from the base branch's lock. It rejects a loosened contract unless a maintainer accepts that exact change outside the PR. The [guarantees](docs/guarantees.md#contract-loosening) state the boundary:

> This is the boundary: protect `.pregate/` and `.github/workflows/` with CODEOWNERS and required reviews, or a pull request can rewrite the workflow that runs the check.

Protect `vercel.json` and the build script the same way if you use the [Vercel route](docs/guides/vercel-ci.md). `check --format sarif` and `audit --sarif` produce reports for GitHub Code Scanning. For a hand-written workflow, see the [Action inputs](action.yml) and pin the Action to a reviewed full commit SHA.

## Rule inventory

Counts and pack names below are generated from this tree. They are an implementation inventory, not a measure of semantic coverage or precision. The [pack catalog](docs/packs.md) records defaults and limits.

<!-- BEGIN readme catalog -->

Static checks: **555** (4 in core, 551 in optional packs). These can run from syntax or a diff.
Fitness obligations: **645** (64 in core, 581 in optional packs). A fitness obligation stays unverified, and does not block, until a project binds a command.
Pattern checks by language: typescript 455, python 18, go 8, rust 6. A check with two languages is counted in each. These are pattern checks only, not a claim that every grammar has the same coverage.

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

## Documentation

- [Installation, updates, and removal](docs/guides/installation.md)
- [Daily workflow and the ratchet](docs/guides/daily-use.md)
- [The `/pregate` skill](docs/guides/pregate-skill.md)
- [Instruction files to rules, layers with evidence, promotion](docs/features/agent-proposed-contract.md)
- [Command reference](docs/CLI.md)
- [Guarantees and residual limits](docs/guarantees.md)
- [Rule precision](docs/guides/rule-precision.md) · [Pack and preset inventory](docs/packs.md) · [Core catalog](docs/core-catalog.md)
- [Rule drafting](docs/features/rule-drafting.md) · [Project fitness](docs/features/project-fitness.md)
- Measurements: [hook latency](docs/benchmarks/hook-latency.md), [one production repository](docs/benchmarks/case-study-production-repository.md), [shell guard friction](docs/benchmarks/shell-guard-friction.md), [session trial](docs/benchmarks/session-trial.md)
- [Maintenance, reproducible build and rollback](docs/guides/maintenance.md)
- [Architecture and scope limits](docs/ARCHITECTURE.md)
- [Release notes for 0.0.20](docs/releases/0.0.20.md) · [First public release (`v0.0.1`)](docs/releases/0.0.1.md) · [Changelog](CHANGELOG.md)

## Contributing

Read [Contributing](CONTRIBUTING.md), [Security](SECURITY.md), and the [Code of conduct](CODE_OF_CONDUCT.md) before submitting a change or reporting a vulnerability.

## License

[MIT](LICENSE). Release archives also include [third-party notices](THIRD_PARTY_NOTICES).
