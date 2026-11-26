---
name: pregate
description: "0.0.13 — PREGATE: set a project up, read its status, check changes, explain a rule, and fix or report a finding"
---

# PREGATE

Pregate checks an agent's edits against the rules in `.pregate/` before they
land. The human invokes `/pregate` and says what they want. Do the work
yourself, answer in the user's language, and give one next action. Keep a
summary under eight lines. Say "rule", "informs" and "blocks"; leave out lock,
digest, ratchet and pack unless the user asks how it works.

Skill version: 0.0.13.

## What blocks

In a project, a hook blocks two things and nothing else:

1. An edit that breaks a rule the project set to **enforce**. The message names
   the rule, the line and the fix. Fix the code and resend the edit.
2. The agent acting on Pregate itself: `pregate enable` or `pregate disable`,
   approving for the human, changing a harness's hooks, or writing inside
   `.pregate/`. Do not look for another way. Tell the user what you wanted to
   change and why.

Everything else is one line that starts with `PREGATE NOTE` or `PREGATE
ADVISOR`, and the call goes through. A project starts in **advisor** mode: every
rule informs and none blocks. An advisory is said once per file in a session;
read it, revise the code or keep it, and tell the user which you chose. A note
means Pregate could not check something. It is never a reason to stop the
user's task.

Reading is always allowed: `git status -- .pregate`, `cat .pregate/preset.json`,
`pregate status`, `pregate explain <rule>`, `pregate check`.

## The six things people ask for

**Set it up.** The user runs `pregate enable` in the project (in a harness:
`! pregate enable --yes`). It proposes an advisor contract for the stack it finds,
shows a short summary, and applies it on the user's `y`. If `pregate status`
then says no harness has hooks, the user runs `pregate setup` once on that
machine.

**See what is on.** `pregate status` answers in three lines: the state, what
needs attention, and the next step. Relay those lines. `pregate status
--verbose` and `pregate doctor` have the detail when something is wrong.

**Check the work.** `pregate check` judges the changed files; `pregate check
--all` judges every file. CI runs the same command, and CI is where a pull
request is held: locally nothing but the two cases above stops the agent.

**Understand a finding.** `pregate explain <rule>` prints why the rule exists,
its parameters and the fix. Run it before you argue with a rule or change code
for it.

**Change the rules.** The contract is `.pregate/preset.json`, committed with
the project. The agent does not edit it. Describe the change to the user
(switch a rule off, exclude a folder, make a rule block), or write it as a
request in `.pregate/requests/<name>.json` (`pregate preset request-schema`
prints the format) and run `pregate preset apply <request.json> --preview`.
The user applies the review with `pregate approve --yes`. A change that makes the contract looser is reviewed like any other
code: it goes in the pull request, and `pregate check --ratchet` in CI holds
it until a maintainer accepts it.

**Update or switch off.** `pregate update` installs the newest engine. Projects
need nothing after it: any engine version reads any project's contract. The
user runs `pregate disable` to switch Pregate off for a checkout, or `pregate
disable --project` for every checkout of the repository (in a harness, with
`!` and `--yes`).

## Branches, worktrees, subagents and teammates

None of these needs a step. The contract is the one in the checkout, so a
branch switch, a pull, a merge or a new worktree brings its own. Enabling one
checkout enables every worktree of the repository. A subagent inherits the
session's contract. A teammate without Pregate is not affected; a teammate
with another engine version is judged from the same preset.

## When a finding is wrong

Tell the user which rule, which file and why it does not apply. With their
agreement, `pregate issue draft --last` prepares a report without source code;
the user sends it with `pregate issue submit`. To silence a rule in this
project, the user changes the preset as described above.

Every command: `pregate --help --all`.
