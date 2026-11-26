# Use the pregate skill

The `/pregate` skill is the agent's companion guide to PREGATE. It is one page.
It says what blocks locally and covers six requests: set a project up, see what
is on, check the work, understand a finding, change the rules, and update or
switch off. Hooks run the gate. Loading the skill grants no consent and changes
no contract. The skill does not hold the command list: every command is in
`pregate --help --all` and the [command reference](../CLI.md).

## Install and open

The normal installer, `pregate setup` and `pregate update` install the companion
instructions. Setup writes `skills/pregate/SKILL.md` in the shared `.agents` directory
and the Claude Code, Codex, Cursor, Grok, agy and OpenCode skill directories.
`CODEX_HOME`, `GROK_HOME` and `OPENCODE_CONFIG_DIR` are respected. `pregate doctor` reports missing or outdated copies.

The skill folders are protected: an agent cannot write them. An agent can read an
installed `SKILL.md` with a literal `cat <path>`, alone or as one step of a `;` or `&&`
sequence; other shell forms on that file are denied.

Enter your project in the coding harness and invoke `/pregate`. If the harness does
not offer that slash command, ask it to load the installed `pregate` skill through
its normal skill discovery. A new session may be needed after installation.
Grok has no supported SessionStart context channel; explicitly load `/pregate`.

## Tell it the outcome you want

| Request | What the agent should do |
| --- | --- |
| “Set up PREGATE here” | Tell you to run `pregate enable` in the project. It proposes an advisor contract for the stack it finds, shows a short summary and applies it on your `y`. If `pregate status` then says no harness has hooks, you run `pregate setup` once on that machine. |
| “What is on here?” | Run `pregate status` and relay its three lines: the state, what needs attention, and the next step. `status --verbose` and `doctor` have the detail. |
| “Check my work” | Run `pregate check` for the changed files, or `pregate check --all` for every file. CI runs the same command. |
| “Why did this rule fire?” | Run `pregate explain <rule>` before it argues with the rule or changes code for it. |
| “Change the rules” | Describe the change to you: switch a rule off, exclude a folder, make a rule block. The agent does not edit `.pregate/preset.json`. You edit the preset, or run `pregate guide --preview` and apply it with `pregate approve --yes`. A looser contract is reviewed in the pull request, where `pregate check --ratchet` in CI holds it. |
| “Update it” or “Switch it off” | You run `pregate update`. Projects need nothing after it. You run `pregate disable` for one checkout, or `pregate disable --project` for every checkout. |
| “This finding is wrong” | Say which rule, which file and why it does not apply. With your agreement, `pregate issue draft --last` prepares a report without source code, and you send it with `pregate issue submit`. |

These are prompts, not slash subcommands. The agent gives you one next action
and keeps its summary short.

## What the skill tells the agent about blocking

A hook blocks two things: an edit that breaks a rule the project set to enforce,
and the agent acting on Pregate itself (`pregate enable` or `pregate disable`,
approving for the human, changing a harness's hooks, writing inside `.pregate/`).
Everything else is one line that starts with `PREGATE NOTE` or `PREGATE ADVISOR`,
and the call goes through. A note is never a reason to stop your task. Reading
the contract is always allowed. See
[what blocks locally](../guarantees.md#what-blocks-locally).

The commands in the next section still exist. The skill no longer walks the
agent through them; ask for them by name when you want a pack selection, a layer
map or rules compiled from an instruction file in the first review. See [the
agent proposes, the engine verifies, a human approves](../features/agent-proposed-contract.md).

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
In this shell, including a harness `!` line, enter the displayed command yourself:

```text
pregate approve <displayed code>
```

A code or `--yes` needs no terminal on Claude Code, Codex, Grok, agy, OpenCode
and Cursor. An agent could run that command. The approval log records a
non-terminal approval, and the agent must not run it. Cursor's tested hook
route cannot distinguish human Shell Mode from an agent tool; the exact command
is allowed there anyway. See [approval routes](../features/approval-in-harness.md).

Initial approval can activate this worktree. Updates preserve its consent,
including a disabled project. A cloned contract still needs local consent.
After an engine update, no project needs a step.

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
