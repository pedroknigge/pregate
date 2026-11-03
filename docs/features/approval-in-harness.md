# Review and approve a contract inside the harness

An agent's proposed contract change is validated before approval. The preview now
includes actual preset/checker source diffs as well as effective rule, severity,
scope and policy changes. Native approval does not require a controlling terminal:
the harness's permission channel is the interaction surface.

For a bounded request in `.pregate/requests/<name>.json`, the agent can run
`pregate preset apply <request.json> --preview`. This validates the patch and full
candidate contract and prepares the same digest-bound review without activating
it. The active preset, lock and local consent stay unchanged. Invalid requests
leave an existing pending review intact. Only the human runs the displayed
approval command; plain `preset apply` still requires human approval.
Successful preview states that review is pending and the active contract still
applies. The agent presents the complete review and waits for the human. Keep the
proposed files; further trial requests replace the review and its digest.
Use an absolute request path in Codex because its shell payload does not
establish the execution directory.

An actual command-discovery probe
reproduces a denied relative preview even after a valid request is created.
The corrected rule-conflict and protected-path messages name the absolute
path requirement. The repeated model turn prepares a valid review while
preserving active policy and consent; approval remains a separate human step.

For Claude Code interactive parent sessions, the engine asks through the native
permission protocol for the proposed edit. Known Claude Code subagents,
noninteractive sessions and CI cannot use this path. The pending lock becomes
current only after the tool writes the exact validated bytes.

For agy, the engine queues a validated proposal and denies agent approval commands
with the exact human `!` route. Its hook does not identify a trusted interactive
parent or permission mode. Earlier native `force_ask` requests stalled in
skip-permissions mode, so the engine no longer emits them. The actual agy 1.2.17
Bash input reviews and applies the exact candidate in normal and skip-permissions
sessions; a different digest applies nothing. These are controller-driven UI
observations in disposable projects, not receipts for a user's real approval.
See the human shell repair and the preserved
earlier native request observations.

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

The command applies only where stdin is an interactive terminal and the human types
`y` on `/dev/tty` (`CONIN$` on Windows). A harness `!` line qualifies only when that
harness gives the command an interactive stdin; otherwise the human runs it in a
terminal of their own.

The code is the first 12 hex digits of the digest. An agent cannot cheaply create a
different proposal that starts with the same 12 digits. The long form
`approve --yes --digest <sha256>` still works. In a Git worktree, approval commits
exactly the contract files it wrote (`chore: apply reviewed PREGATE contract <code>`)
and leaves other staged or dirty work out of that commit. If the repository cannot
commit at that moment (a merge, a hook or signing), the approval still applies and
prints the command to commit by hand. `--no-commit` keeps the files uncommitted. The
request that was applied, and any request that can no longer apply to the new preset,
is removed from `.pregate/requests/`.

The preview names Claude Code, Codex, Grok and agy beside the `!` command and
prints Cursor's separate-human-terminal command with the same digest. It does
not offer Cursor an unsupported in-harness approval path.
The user types that command in supported human shell input after reviewing it.
Current controlled observations pass in Claude Code, Codex, Grok and agy.
Cursor's tested Shell Mode invokes the same gated Pre without a trusted human
origin marker; use a separate human terminal there. Do not bypass its guard or
disable PREGATE. See native observations.
With `PREGATE_UNATTENDED_APPROVAL=1` already in the environment (an unattended CI job; `CI` alone does not count), `--yes` applies without the `/dev/tty` question; elsewhere `--yes` still asks. Every harness, Claude Code included,
rejects the agent's attempt to run the approval command and explains the human route: a
native permission prompt cannot give the command the terminal it needs. The digest binds the writes, compiled lock, baseline
and expiry; a replaced proposal, changed baseline or altered sources cannot apply
the reviewed proposal. It expires 24 hours after preparation.

`pregate approve` retains its direct terminal prompt for existing users. A bare
`--yes` is an unattended automation interface (`PREGATE_UNATTENDED_APPROVAL=1`), not a way around the terminal; the recommended
harness workflow always supplies the digest. Protected shell calls reject every
approval command an agent issues and name the human `!` route (a separate terminal in Cursor).

The automation verifies source diffs, altered/stale candidates, exact application,
no-TTY native hook output, known Claude Code headless/subagent rejection, CI
rejection and literal-command bounds. agy's native permission identity is not
inferred; it uses the verified human shell route.
An earlier Codex 0.160.0 TUI run on macOS ARM64 verifies the human `!` route:
initial activation, a source-only pack preview, rejection of the prior digest and
application of the current candidate's exact preset/lock bytes. Its transcript
classifies these as human shell commands, with no model tool calls. See the
observation and scope.
The current Codex 0.160.1 human-shell observation
passes four initial/existing normal/bypass cases.
A different digest leaves preset/lock unchanged; the reviewed digest applies
every expected write. All 68 core defaults remain active, with zero model Pre
calls. Controlled test inputs are not actual user consent receipts.
Actual Codex 0.160.0 headless and TUI model turns
reject one exact approval attempt per surface, record native tool denials and
completed turns, and preserve the contract and pending proposals. See the
model scenarios and limits.
Other approval commands, other harness UIs and native prompts remain separate
verification. The current human shell checks do not recapture every model tool
or certify every interaction in all five UIs.

Claude Code 2.1.289 and Grok 1.0.49 now also pass four initial/existing,
normal/bypass human-input cases with exact reviewed writes, wrong-digest
rejection and all 68 defaults. Read-only reporting probes in Codex and agy review
the issue draft and find an existing report on real GitHub without publication.
The evidence and failed probes
retain Cursor's limitation and Claude's attempted model continuation.

The same checks also pass four exact model rejection
cases with Codex 0.160.1, retaining all 68 defaults: existing/initial proposals in
headless/TUI surfaces. Native denial, displayed human command and unchanged
contract/proposal hashes are recorded. See current source evidence.
These are model rejection tests, not human approvals or checks of every command.
