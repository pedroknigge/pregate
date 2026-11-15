# Review and approve a contract inside the harness

An agent's proposed contract change is validated before approval. The preview
includes actual preset/checker source diffs as well as effective rule, severity,
scope and policy changes. The human then runs `pregate approve <code>` or
`pregate approve --yes` (optional `--digest`) in this shell, including a harness
`!` line. That command does not need a terminal.

This is a convenience, not a guarantee that the agent cannot type the same
command. An agent could run it. Pregate records a non-terminal approval in the
approval log (`via` is `yes` when stdin is not a terminal) so that is visible.
The log does not record `via: "native-ask"`. The approve process cannot see
that a hook returned ask and that the human clicked Accept, and a marker
written before Accept could be consumed by a command that was not asked.
A bare `pregate approve`, with no code and no `--yes`, still asks for
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
permission protocol in two places.

The proposed edit still uses that prompt. Known Claude Code subagents,
noninteractive sessions and CI cannot use this path. The pending lock becomes
current only after the tool writes the exact validated bytes.

The approval command uses it too, and only in that same parent session:
`permission_mode` is `default`, `acceptEdits`, `auto` or `plan`, there is no
`agent_id`, `CLAUDE_CODE_REMOTE` is not `true`, and `CI` is unset. When the
agent runs a literal `pregate approve <code>`, `pregate approve --yes`, or
`pregate approve --yes --digest <sha>` (optional `--no-commit`, a leading `!`,
or a quote-concatenated `pregate` that the shell reads as the same command)
and that command names a current proposal or batch, PreToolUse returns exit 0
with `hookSpecificOutput.permissionDecision` set to `ask`.
`permissionDecisionReason` summarizes the change: a WARNING when the review
warns, then "Accept runs this command. Reject runs nothing.", the command, and
the mode line. `additionalContext` carries the compact review and does not add
a digest the command did not already contain. Accept runs the command. Reject
runs nothing. The hook itself does not apply the contract. A bare `--yes` is
included because the shell guard already allows it and it applies the pending
review in the working directory; leaving it out would let that form skip the
prompt. A code or digest that matches nothing stays on the current path, so
the CLI can say the review does not match.

A subagent, `dontAsk`, `bypassPermissions`, a remote session and `CI` do not
get this prompt. They fall back to the current command: the shell guard allows
the literal form and the CLI applies it, recorded as `via: "yes"`. `claude -p`
does not mark the hook payload, so Pregate cannot tell it from an interactive
parent. Official Claude Code docs say an ask nobody can answer, including a
`-p` run, is denied by Claude Code. That is stricter than the fallback. Pregate
does not invent a headless signal and does not emit `permissionDecision: "allow"`.

A denial of any other approval attempt in that parent session tells the agent
it may propose the literal command so the human gets the prompt. In every
other session the denial still says to ask the human and not to run the
command. `issue submit`, `feedback apply` and `storage apply` stay on a
separate terminal in every session.

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

The preview tells the human to run that command in this shell. In an interactive
Claude Code parent session the agent may propose that exact command so the
human gets the permission prompt. In every other session the agent must not
run it. Cursor's tested Shell Mode invokes the same gated Pre as an agent
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
that still refuses, an interactive Claude Code parent whose literal approval
command returns `permissionDecision: "ask"`, a subagent, `dontAsk`,
`bypassPermissions`, a remote session and `CI` that do not, known Claude Code
headless/subagent behavior, and literal-command bounds. agy's native permission
identity is not inferred.
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

## Native prompts still to build

This release implements the Claude Code command prompt only. The other
harnesses keep the literal command and do not receive a hook ask. A follow-up
does one harness at a time, and none of them may emit an ask that fails open.

- **agy.** An interactive session that is not skip-permissions can return
  `decision: "force_ask"` for the literal approval command, so a cached Always
  Allow cannot apply the contract. Do not emit `auto_approve`. Do not emit
  `force_ask` in skip-permissions, Turbo, always-proceed or `-p` until a live
  run on the pinned agy shows it does not stall and does not apply. Earlier
  `force_ask` requests stalled in skip-permissions mode.
- **Cursor.** The native prompt is `beforeShellExecution` with
  `{ "permission": "ask", "user_message", "agent_message" }` and `failClosed`.
  Allow runs the command. `preToolUse` ask is not enforced, and this release
  does not emit it. Auto-review may ignore a hook ask; re-test that on the
  pinned Cursor before relying on it.
- **OpenCode.** The V2 plugin API documents
  `ctx.permission.hook("evaluate")` with `effect: "ask"`. Whether that hook
  exists on the pinned 2.2.7 is unverified, and the current plugin does not
  register it. A follow-up may set `effect: "ask"` only after that API is
  present on the pinned version. Do not invent the effect.
- **Codex and Grok.** Do not emit a hook ask. Codex parses PreToolUse `ask`
  and then continues the tool call. Grok's hooks page does not document `ask`.
  Both rely on their own approval policy, the literal command, and a separate
  terminal for every other control command.
