# Use the pregate skill

The `/pregate` skill is the agent's companion guide to PREGATE. It teaches the installed
commands, discovery, updates, audits, pack composition, evidence adoption and
recovery. Hooks run the gate. Loading the skill grants no consent and changes no
contract.

## Install and open

The normal installer, `pregate setup` and `pregate update` install the companion
instructions. Setup writes `skills/pregate/SKILL.md` in the shared `.agents` directory
and the Claude Code, Codex, Cursor, Grok, agy and OpenCode skill directories.
`CODEX_HOME`, `GROK_HOME` and `OPENCODE_CONFIG_DIR` are respected. `pregate doctor` reports missing or outdated copies.

The skill folders are protected: an agent cannot write them. An agent can read an
installed `SKILL.md` with a literal `cat <path>`, alone or as one step of a `;` or `&&`
sequence; other shell forms on that file are denied.

Enter your project in the coding harness and invoke `/pregate`. If the harness does
not offer that slash command, ask it to load the installed `tlt` skill through
its normal skill discovery. A new session may be needed after installation.
Grok has no supported SessionStart context channel; explicitly load `/pregate`.

## Tell it the outcome you want

| Request | What the agent should do |
| --- | --- |
| “Show me what PREGATE protects” | Suggest human `pregate demo` with owned Python, Go, and Rust samples. Explain source and native-tool evidence separately; toy approval is not consumer consent. |
| “Set up PREGATE here” | Inspect `guide --json`, `layers --json` and each instruction file, then prepare one `guide --preview` that carries the contract, the layer map and the rules that compile. Suggest useful official packs in that same review. |
| “Make my AGENTS.md rules real” | On a new project, pass the completed proposals to `guide --preview --compile <proposals.json>` so they join the contract review. Once a contract exists, run `compile apply <proposals.json> --preview`. Say which statements became rules and which stay as guidance. |
| “Protect my architecture” | Read `layers --json`. On a new project, pass the map with `guide --preview --layers <map.json>`. Once a contract exists, run `layers apply <map.json> --preview`. Explain each existing import the map would flag. |
| “Is it working?” | Read the `Agent loop` line of `pregate report` and repeat it in one sentence. |
| “Update this project and review new packs” | Compare installed and project versions, inspect the entire catalog, prepare one engine/core/official-pack update with selected additions. Preserve local packs and decisions. |
| “Audit this repo and freeze existing debt” | Run `audit --plan`, disclose coverage gaps and unverified requirements, propose no-new policy if needed. |
| “Repair these findings” | Explain the invariant, preserve behavior, repair a bounded change, run relevant project tests and re-audit. |
| “This valid use case is blocked” | Inspect the rule, reproduce the valid case and a violation, then propose a tested correction or project-specific adaptation. |
| “Help verify the core requirements” | Use `fitness plan` and its draft template, read actual assertions, name conditions and invalid controls, then prepare different verifier commands in one candidate review. |
| “Help design this change” | Read the project's domain, relationship, unit and work-budget contract; expose missing facts and propose bounded assertions rather than guessing the architecture. |
| “Report this tool problem” | Prepare a minimal reviewed issue draft; publish only through your explicit human approval. |

These are prompts, not new slash subcommands. The skill opens with a simple
path for the common case: the agent inspects the repository, prepares one review
of the contract, the layer map and the compiled instruction rules, reports in
plain language, and leaves you one action, the approval. See [the agent proposes, the engine verifies, a human
approves](../features/agent-proposed-contract.md). The installed command reference
is included in the skill. Ask for one pack selection and one concrete review,
rather than approving each suggested pack separately.

## Review once

The agent can inspect and prepare. You approve the exact reviewed candidate.
On a new project that candidate is the contract, the derived layer map and the
rules compiled from `AGENTS.md`, `CLAUDE.md` and `.cursorrules`. `--layers` replaces
the map and `--compile` adds rules that needed an example; both stay in the same
review. When `ark.config.json` exists, the preview imports that config's layers
and `coexist.arkgate` instead of a `--layers` file. For example, for a new project
with documented requirements:

```sh
pregate guide --preview --packs typescript,react --layers layers.json --compile proposals.json --custom-from-docs
```

Once a contract exists, a later layer map or a later batch of instruction rules
is its own review (`layers apply`, `compile apply`). A newer review replaces the
pending one, so approve the one you were shown before preparing another.

The compact review lists scope, policy changes, consent effect and digest. Use
`guide --preview --full` or `approve --preview` to inspect complete content.
Open a separate terminal in the project and enter the displayed command yourself:

```text
pregate approve <displayed code>
```

Every harness denies an approval command the agent issues. No harness `!` line
can approve, so Claude Code, Codex, Grok, agy, OpenCode and Cursor all use a
separate terminal. On agy 1.5.6, `! pregate approve <code>` was refused because
stdin is not a terminal. The earlier agy observation was only 1.2.17, and it ran
`pregate approve --yes --digest` without `PREGATE_UNATTENDED_APPROVAL=1`, which
also requires a terminal. Cursor's tested hook route cannot distinguish human
Shell Mode from an agent tool. The agent must not execute an approval on your
behalf. See [approval routes](../features/approval-in-harness.md).

Initial approval can activate this worktree. Updates preserve its consent,
including a disabled project. A cloned contract still needs local consent.
Global installation does not migrate every other project automatically.

For a current cloned/disabled contract, plain `guide --preview` makes no activation
proposal. Choose activation in the interactive guide, or run `pregate enable` in a
terminal after reviewing `status` and type `y`. `--yes` does not skip that question
unless `PREGATE_UNATTENDED_APPROVAL=1` is already set. Updates preserve disabled consent.

## Keep the guide current

Run `pregate --version` and `pregate doctor` after an update. `setup` refreshes owned
registrations and companion instructions from the running engine. Read installed
help when working with older releases: a source checkout can document options
that are not yet published. See [v0.0.1 release notes](../releases/0.0.1.md).

If a hook blocks a recovery command, the skill should name the cause and the
supported human route. It should propose preserving the invariant, not disabling
PREGATE to get past it. An `UNVERIFIED` notice is missing project evidence; it is
not a request to stop work or invent a passing test.

Prepare several assertions with `fitness plan --template [--auto] > pregate.fitness.json`.
Without `--auto`, the template deliberately lacks executable commands; `--auto`
pre-populates candidate test-slice commands, input globs and assertion counts from
repository test files. The agent must fill in or verify
real verifier commands, definition inputs, exact covered conditions, negative
controls and limits. Inspect `fitness plan --json`, then prepare one review with
`fitness bind --candidates pregate.fitness.json --preview`. Approval does not run the
commands; `fitness run --all` runs adopted groups and `fitness status --json`
separates passing, failed, missing evidence and unbound requirements. See
[project fitness](../features/project-fitness.md) and the
[design contract](design-contract.md).

`audit` starts with a compact human summary. Read the shown/total
counts and coverage gaps; use `audit --full` or complete JSON/JSONL when choosing
repairs. `--plan` still includes the complete advisory plan.

The complete [command reference](../CLI.md), [daily workflow](daily-use.md) and
[pack inventory](../packs.md) describe the underlying tool independently of the skill.
