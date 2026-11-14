# Review and approve a contract inside the harness

An agent's proposed contract change is validated before approval. The preview
includes actual preset/checker source diffs as well as effective rule, severity,
scope and policy changes. The human then runs `pregate approve <code>` or
`pregate approve --yes` (optional `--digest`) in this shell, including a harness
`!` line. That command does not need a terminal.

This is a convenience, not a guarantee that the agent cannot type the same
command. An agent could run it. Pregate records a non-terminal approval in the
approval log (`via` is `yes` when stdin is not a terminal) so that is visible,
and the hook text tells the agent to ask the human and not to run the command
itself. A bare `pregate approve`, with no code and no `--yes`, still asks for
`y` on a terminal. `enable`, `disable`, `init`, `promote`, `pack`, `preset`,
`feedback apply`, `storage apply` and `issue submit` stay on a separate terminal.

For a bounded request in `.pregate/requests/<name>.json`, the agent can run
`pregate preset apply <request.json> --preview`. This validates the patch and full
candidate contract and prepares the same digest-bound review without activating
it. The active preset, lock and local consent stay unchanged. Invalid requests
leave an existing pending review intact. Only the human runs the displayed
approval command; plain `preset apply` still requires human approval.
Successful preview states that review is pending and the active contract still
applies. The agent presents the complete review and waits for the human. Keep the
proposed files; further trial requests replace the review and its digest.
Codex 0.166 reports the command working directory. A relative request path
resolves there; name a file outside that directory with an absolute path.

The protected-path guidance names that absolute path. A prepared review stays pending while
preserving active policy and consent; approval remains a separate human step.

For Claude Code interactive parent sessions, the engine asks through the native
permission protocol for the proposed edit. Known Claude Code subagents,
noninteractive sessions and CI cannot use this path. The pending lock becomes
current only after the tool writes the exact validated bytes.

For agy, the engine queues a validated proposal. Its hook does not identify a
trusted interactive parent or permission mode. Earlier native `force_ask` requests
stalled in skip-permissions mode, so the engine no longer emits them. The exact
`pregate approve` form above is allowed on agy the same way as on the other
harnesses. On agy 1.5.6 that `!` line was refused because stdin was not a terminal.
That observation describes the older gate.

For an expiring queued proposal, prepare the complete review:

```sh
pregate approve --preview
```

A mismatched supplied digest applies nothing and points to `approve --preview`
for the current proposal. It does not claim that the files changed. If the
contract or sources no longer match the preview, the stale/invalid response asks
for `pregate guide --preview` to prepare a fresh review. Run these commands in the
named project; never copy a digest from a different pending proposal.

For a first-time project, `pregate init --preview` prepares the same review flow
without creating a preset, lock or local consent. `approve` can find this initial
proposal from a project subdirectory before a preset exists. See
[initialization](initialization.md).

An initial pending proposal now activates administrative protection before the
project has a preset or local consent. The thin hook preflight, engine and
supervisor retain this review. Missing-engine and missing-launcher fallbacks also
protect the pending project. Fallbacks conservatively keep protection while the
stored proposal exists; a working engine validates its 24-hour expiry.
Ordinary project rules do not activate during preview. See
the reproduced initial-approval defect and controls.

It prints the review and the digest-bound human command:

```text
pregate approve <code>
```

A code or `--yes` applies with no terminal. A bare `pregate approve` still asks
for `y` on `/dev/tty` (`CONIN$` on Windows). A pipe that contains `y` is not that
typed confirmation. The code is the first 12 hex digits of the digest. An agent
cannot cheaply create a different proposal that starts with the same 12 digits.
The long form `approve --yes --digest <sha256>` still works, and it does not need
a terminal either. In a Git worktree, approval commits
exactly the contract files it wrote (`chore: apply reviewed PREGATE contract <code>`)
and leaves other staged or dirty work out of that commit. If the repository cannot
commit at that moment (a merge, a hook or signing), the approval still applies and
prints the command to commit by hand. `--no-commit` keeps the files uncommitted. The
request that was applied, and any request that can no longer apply to the new preset,
is removed from `.pregate/requests/`.

The preview tells the human to run that command in this shell and tells the agent
not to run it. Cursor's tested Shell Mode invokes the same gated Pre as an agent
tool, and the OpenCode plugin hook has no trusted human-origin marker either.
The shell guard allows the exact command anyway. Do not bypass the guard or
disable PREGATE. See native observations.
With `PREGATE_UNATTENDED_APPROVAL=1` already in the environment (an unattended CI
job; `CI` alone does not count), `--yes` on the other control commands applies
without the `/dev/tty` question. Assigning that variable on a command is still
denied. The digest binds the writes, compiled lock, baseline and expiry; a
replaced proposal, changed baseline or altered sources cannot apply the reviewed
proposal. It expires 24 hours after preparation. A non-terminal approval is
appended to `contract-approvals/log.jsonl` under the data directory.

`pregate approve` with no code and no `--yes` still prompts on a terminal.
`--yes` on `enable`, `disable`, `init`, `promote`, `pack` and the other control
commands is not this path: those stay denied from the harness shell and still
need a terminal or `PREGATE_UNATTENDED_APPROVAL=1`. A script that contains
`pregate approve` is still denied.

The automation verifies source diffs, altered/stale candidates, exact application,
a non-TTY harness shell that approves with a code or `--yes`, a bare `approve`
that still refuses, known Claude Code headless/subagent behavior, CI and
literal-command bounds. agy's native permission identity is not inferred.
Earlier Codex, Claude Code, Grok and agy human-shell runs were recorded while
the gate denied this command. Those notes describe that older gate. Controlled
test inputs are not actual user consent receipts.
The recorded Codex 0.160.0, Claude Code 2.1.289 and Grok 1.0.49 model turns
denied one exact approval attempt per surface while this command was still
refused by the gate. Those notes were not re-run after the in-harness form was
allowed. They are a record of that older gate, not of the current command.
Read-only reporting probes in Codex and agy still review the issue draft and
find an existing report on real GitHub without publication. `issue submit`,
`feedback apply` and `storage apply` stay on a separate terminal.
