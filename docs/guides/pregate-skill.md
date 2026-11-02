# Use the pregate skill

The `/pregate` skill is the agent's companion guide to PREGATE. It teaches the installed
commands, discovery, updates, audits, pack composition, evidence adoption and
recovery. Hooks run the gate. Loading the skill grants no consent and changes no
contract.

## Install and open

The normal installer, `pregate setup` and `pregate update` install the companion
instructions. Setup writes `skills/pregate/SKILL.md` in the shared `.agents` directory
and the Claude Code, Codex, Cursor, Grok and agy skill directories. `CODEX_HOME`
and `GROK_HOME` are respected. `pregate doctor` reports missing or outdated copies.

Enter your project in the coding harness and invoke `/pregate`. If the harness does
not offer that slash command, ask it to load the installed `tlt` skill through
its normal skill discovery. A new session may be needed after installation.
Grok has no supported SessionStart context channel; explicitly load `/pregate`.

## Tell it the outcome you want

| Request | What the agent should do |
| --- | --- |
| “Show me what PREGATE protects” | With the 0.2.12 candidate or its released engine, suggest human `pregate demo` with owned Python/Go/Rust samples. Explain source and native-tool evidence separately; toy approval is not consumer consent. |
| “Set up PREGATE here” | Inspect `guide --json`, review documentation, stack and source layout, suggest useful official packs and a custom project pack together. |
| “Update this project and review new packs” | Compare installed and project versions, inspect the entire catalog, prepare one engine/core/official-pack update with selected additions. Preserve local packs and decisions. |
| “Audit this repo and freeze existing debt” | Run `audit --plan`, disclose coverage gaps and unverified requirements, propose no-new policy if needed. |
| “Repair these findings” | Explain the invariant, preserve behavior, repair a bounded change, run relevant project tests and re-audit. |
| “This valid use case is blocked” | Inspect the rule, reproduce the valid case and a violation, then propose a tested correction or project-specific adaptation. |
| “Help verify the core requirements” | Use `fitness plan` and its draft template, read actual assertions, name conditions and invalid controls, then prepare different verifier commands in one candidate review. |
| “Help design this change” | Read the project's domain, relationship, unit and work-budget contract; expose missing facts and propose bounded assertions rather than guessing the architecture. |
| “Report this tool problem” | Prepare a minimal reviewed issue draft; publish only through your explicit human approval. |

These are prompts, not new slash subcommands. The installed command reference
is included in the skill. Ask for one pack selection and one concrete review,
rather than approving each suggested pack separately.

## Review once

The agent can inspect and prepare. You approve the exact reviewed candidate.
For example, for a new project with documented requirements:

```sh
pregate guide --preview --packs typescript,react --custom-from-docs
```

The compact review lists scope, policy changes, consent effect and digest. Use
`guide --preview --full` or `approve --preview` to inspect complete content.
Inside a supported human shell route, enter the displayed command yourself:

```text
! pregate approve <displayed code>
```

Every harness denies an approval command the agent issues. Controlled human `!`
approval is verified for Claude Code, Codex, Grok and agy. Cursor's tested hook route cannot distinguish human Shell Mode from an
agent tool; use a separate human terminal there. The agent must not execute an
approval on your behalf. See [approval routes](../features/approval-in-harness.md).

Initial approval can activate this worktree. Updates preserve its consent,
including a disabled project. A cloned contract still needs local consent.
Global installation does not migrate every private project automatically.

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

In published 0.2.11, `audit` starts with a compact human summary. Read the shown/total
counts and coverage gaps; use `audit --full` or complete JSON/JSONL when choosing
repairs. `--plan` still includes the complete advisory plan. Older 0.2.10
prints all text findings and has no `audit --full` option.

The complete [command reference](../CLI.md), [daily workflow](daily-use.md) and
[pack inventory](../packs.md) describe the underlying tool independently of the skill.
