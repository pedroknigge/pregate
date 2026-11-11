# Parallel agents, worktrees and branches

Several agents can work on one repository at the same time without blocking each
other.

## Worktrees share the repository's consent

When a human enables PREGATE in one worktree, that consent covers the whole
repository on this machine. Every other worktree of the same repository is protected
without another approval: a branch checked out beside the main one, or the isolated
worktree Claude Code creates for a subagent under `.claude/worktrees/`. Each worktree
is judged by its own committed contract. A human can still turn one worktree off with
`! pregate disable --yes`. Disabling a worktree also withdraws the repository-wide
consent. Worktrees that were enabled by name stay enabled. A clone is a different
repository and needs its own consent.

A checkout nested inside the project, such as an agent worktree or a vendored clone,
is never reported as the outer project's stale lock. A worktree that has been removed
is skipped at Stop.

## Subagents are checked when they finish

In Claude Code and Codex, `SubagentStop` checks each subagent on the files it edited, when it
finishes. A subagent that leaves broken code is told to repair it before it returns.
Claude Code's parent Stop leaves out files a subagent is still editing. Once the
subagent has finished, its files count as the parent's again. Codex's parent Stop
continues to check the whole session, so an older or disabled child hook cannot
hide a child's changes. Pre checks still run on every edit, whichever agent
makes it. The other adapters retain their existing behavior: their parent Stop judges all of the
session's files, as before.

Codex also registers `SubagentStart`. The child receives the bounded contract
briefing, workspace root and exact-patch guidance without a promotion or setup
notice. It shares the parent's retained snapshot; starting a child never accepts
new debt as its baseline. An older pinned engine receives neither new child
lifecycle event: its existing Pre and parent Stop checks continue to apply.
Updating the Codex hook definitions requires review again in `/hooks`.
Codex child commands also cause review of changed files without an edit-tool
owner in roots those commands visited. This is conservative coverage, not proof
of who authored a runtime write; files owned by another agent remain excluded
from the child's check.

`pregate update` registers `SubagentStop`; `pregate doctor` reports an older
registration. A live session checked this on 2026-10-12. A subagent's isolated worktree
was protected by inherited consent, and its SubagentStop ran on that worktree alone.

On 2026-11-11, `PREGATE_REAL=1 bun scripts/e2e-real.ts --project-hooks-only codex`
passed on Codex CLI 0.167.1, macOS arm64. A real child received the contract,
installed a known invalid fixture through a command, was blocked by its own
SubagentStop, repaired the file and completed. Captured native hook input/output
and state events distinguish the child's deny and successful completion. This
does not establish the interactive trust UI or native Windows harness behavior.

## Branch switches, pulls and merges

Checking out or merging a branch that already existed when the session started does
not count as the session's change. The snapshot taken at SessionStart records the branch and
remote-tracking tips. A file is left out of Stop when all of these hold:

- no commit made after the snapshot touches it;
- its working copy equals the new HEAD;
- it was not dirty at the start;
- no edit tool of the session wrote it.

Commits made during the session, including commits pulled during the session, still
count as the session's work. They are judged at Stop, or adopted on purpose with a
reviewed `pregate session rebase`. Pre-commit and CI still check every file.

## One pending contract proposal per project

A project holds one pending contract proposal at a time. When an agent prepares a
new one, its review names the approval code of the proposal it replaced, and that
code no longer approves anything.
