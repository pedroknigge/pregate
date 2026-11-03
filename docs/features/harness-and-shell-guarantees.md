# Harness channels, shell inspection and incomplete Stop

These are the current adapter and engine contracts; [v0.0.1 release notes](../releases/0.0.1.md)
identifies the published candidate and historical verification.
Captured payloads and automated tests establish protocol behavior;
they do not certify interaction in every installed harness UI. The machine-readable
inventory is `pregate status --json`; its source is
[capabilities.ts](../../src/capabilities.ts).

`doctor` reports launcher registration separately from
runtime canaries. Direct engine hook calls do not have the launcher's crash and
timeout handling. A canary uses the generated wrapper command, so passing it
cannot clear a missing or modified registration. This diagnostic does not infer
how an arbitrary process was launched or certify a harness UI.
`status --json` separately exposes current `fitnessCoverage`; unverified
requirements are excluded from the static enforcement count. Active consent and
hook configuration do not mean every project assertion has evidence.

## What each adapter can communicate

| Harness | Pre denial | Native approval | Session context | Warnings | Human notice when Stop releases the turn |
| --- | --- | --- | --- | --- | --- |
| Claude Code | Deny JSON and stderr, exit 2 | Interactive parent sessions | Yes | Yes | `systemMessage` |
| Codex | stderr, exit 2 | Human command route | Yes | No | No supported channel |
| Cursor | Deny JSON, exit 0 | Separate human terminal; tested Shell Mode has no trusted human-origin marker | Yes | No | No supported channel |
| Grok | Compact deny JSON and stderr, exit 2 | Human command route | No | No | No supported channel |
| agy | Deny JSON, exit 0 | Human Bash `!` route; agent approval is denied because parent context is unavailable | Yes | No | No supported channel |

A nonblocking Claude Stop emits no
`hookSpecificOutput.additionalContext`: that channel continues the model's turn
even with exit 0. Human notices use `systemMessage`, and warning/shadow findings
stay recorded for `report`. Pre warning context remains available; real denials
and bounded incomplete-stop behavior retain their existing policy.

Grok's reason is a compact first line, at most 256 characters. The other adapters
can carry the engine's longer reason. A dropped warning or completion notice
does not mean the engine found nothing. Informational warnings and incomplete
Stop outcomes are retained in local events when recording succeeds. Review
[in-harness approval](approval-in-harness.md) for exact human consent and digest
requirements; a native permission packet is not proof of a successful UI prompt.
Current controlled `!` approval observations pass in Claude Code, Codex, Grok
and agy. Cursor's Shell Mode reaches the same gated Pre as agent tools and does
not establish a trusted approval route. See the native observations and limits.

Hook inputs must be valid UTF-8, at most 16 MiB and reach EOF within five seconds
after the engine starts reading. Rejected input cannot redirect to another engine
version. Supervisor Pre failures use the selected adapter's denial format,
including exit 0 with deny JSON for Cursor and agy. Input time consumes the
existing supervisor Pre budget. Inactive projects remain inert; a discarded
oversized payload needs a project known through cwd/environment. Buffering in
a wrapper before the engine runs is outside this deadline. These assertions use
compiled entry points and captured dialects. Windows transport verification
is covered by the Windows suite; actual harness UI observations
remain separate. See the transport evidence.

## Shell inspection has a bounded guarantee

The shell guard examines the submitted command, not every instruction executed
by a subprocess. It recognizes literal writes and redirections, known file
mutation commands, literal inline shell scripts, protected paths and attempts to
change hooks or the engine's administrative state. Substitutions and supported
wrappers are inspected; a recognized writer with an uncertain target can be
denied. Simple shell variable bindings (`bin="/path/to/pregate"`, `root=$(pwd)`)
are tracked across compound read-only commands and `for` loops so
read-only launcher loops are admitted while arbitrary dynamic interpolation and
protected paths remain denied. Literal read-only PREGATE commands do not grant permission to apply drafts,
change policy, delete state or publish issues. Source-code fixtures are data,
not executable extensions.

The shell guard admits a closed subset of isolated Python stdin JSON inspection.
For example, `pregate fitness plan --json | python3 -I -c 'import json,sys;
print(json.dumps(json.load(sys.stdin), indent=2))'` can format a diagnostic.
The subset supports standard `json`/`sys` imports, JSON-derived local values,
indexing, `get`/`keys`/`values`/`items`, selected pure builtins and stdout prints.
It does not admit arbitrary imports, aliases, dynamic calls, loops, file access
or writes. The command must use literal `-I -c` arguments. Unrecognized programs
retain ordinary heuristic inspection; this is not a general Python sandbox.
Other commands, substitutions, protected paths and output redirections remain
guarded. A literal output path outside project/protected scope is permitted;
uncertain targets or an output into source do not acquire that permission.

Pre-command loads the full contract when the guard queries project scope.
Inspection still checks protected paths, administrative commands and harness
registration; it retains root acceptance, snapshots and events. Local pack
folders stay protected from the preset even with an invalid lock. A scope query
compares the complete current compiler output, without trusting cached metadata.
Inspection events that do not query scope have no compiled enforcement metadata.
See the source verification and performance limits.

Unknown syntax is not automatically denied. Encoded paths, arbitrary interpreter
programs, package scripts, already-running processes and writes performed at
runtime can escape Pre. For Codex, relative command targets remain uncertain
until a literal directory change because its payload does not establish the
shell's actual working directory. Passing shell inspection is not a sandbox or
a guarantee that a command cannot modify source or protected state.

Stop checks the resulting tree against the retained session baseline, including
changes committed during the session. `report --json` exposes that snapshot's
HEAD, current HEAD, origin, saved dirty-file count and recorded time, or explicitly
reports missing/invalid metadata. Reading it does not reset or reconstruct a
baseline. CLI check uses HEAD/index/merge-base, so a clean check against another
baseline does not clear a Stop finding. Git pre-commit and
CI add checks at their own boundaries when configured. They do not undo a write
or prevent every side effect. Standalone directories have filesystem snapshots
and `check --all`, but no Git commit hook. Consult `status` for actual consent,
hook configuration and backstops rather than assuming installation means active
protection. Shell behavior and administrative protection regressions are in
[shell.test.ts](../../test/shell.test.ts) and
[gate.test.ts](../../test/gate.test.ts).

The root's exact preset and lock are contract data, not source code. Stop and
non-stdin checks first compare the complete compilation; only then do they omit
those two files from source suppression/placement rules. Altered locks still
fail admission. There is no folder-wide exemption: code added under `.pregate/`
still has placement checks. Use `pregate preset show` to inspect policy. Literal
reads/diffs of this root's preset/lock and inventory listing are supported recovery
exceptions; arbitrary state reads remain protected.

## Review a turn that finished with unresolved work

An unchanged unbound-fitness coverage notice is emitted once per
session, then repeated only when the reported count changes. The obligations
remain active and reports/audit/status still expose their evidence gaps.
Blocking decisions are not converted into successful checks by notice suppression.

The snapshot still retains its original Git baseline. Stop therefore includes
changes merged during a session; it does not prove who authored them. Automatic
upstream attribution is not inferred from a commit or remote reference.
the human can review and adopt a new committed baseline without deleting history:

```sh
pregate session rebase claude-code:<session-id> --preview
```

In a clean Git worktree with an admitted contract, the preview shows the diff from
the retained snapshot to HEAD and a digest. Files that arrived from a base that
existed at session start are left out and counted; Stop does not charge them either.
Committed changes no text diff shows (file mode, symlink, binary bytes) are named. The human enters its exact
`session rebase <id> --digest <sha> --yes` command through the supported approval
route. Approval revalidates the worktree, contract, snapshot and previous review,
then records a separate baseline overlay. The original snapshot and events remain.
It treats this committed tree as existing debt; it neither proves authorship nor
repairs it. The preview expires after 24 hours and rejects changed inputs. Above
8 MiB of diff it lists each file with its status, +/- lines and size (deletions and
test changes first, never cut by the 200-file cap), names the
`git diff` command for the full diffs, and binds the digest to the SHA-256 of both
sides of every file; above 128 MiB of content it refuses. Uncommitted and standalone trees cannot use it.
See [session controls](../../test/ux-release.test.ts).

For unchanged findings, the Stop cap also spans new turn IDs. The fingerprint
covers owned workspace bytes, contract, baseline and results; a changed input
restarts blocking. Trees over 128 MiB retain ordinary per-turn behavior rather
than an unproven shortcut. After the cap, a compact incomplete notice replaces
the repeated policy explanation. Findings stay recorded and Pre guards stay active.

Stop blocks up to the preset's `loop.maxStopBlocks`. A cause requiring human
repair blocks once and releases on reentry. This avoids an endless agent loop;
releasing the turn is **not a successful compliance check**.

Stop judges a session's roots one at a time: roots this turn edited, then the
working directory's root, then the rest. The first blocking root decides. After
a 30 s budget (below the 45 s supervisor limit) the remaining roots are named in
an incomplete Stop (`budget`); pre-commit and CI still judge them, and the next
Stop judges them before the rest, so no root is skipped forever.

New events record `stopIncomplete.reason` (`limit`, `human-cause` or `budget`), its cause,
the notice, the session/turn and the selected root's observed violations.
`pregate report` highlights these historical completions even if the harness
suppressed the notice. JSON includes all recorded incomplete Stops and all
their recorded violation locations; text lists the latest five completions.

```sh
pregate report
pregate report --json
pregate check --all
pregate audit --json
```

Use `report` to investigate what was observed, `check --all` to re-evaluate the
current tree under the selected contract, and `audit` to inventory existing
static debt including shadow/warn rules and coverage gaps. Change-dependent
rules still need their appropriate baseline and attempted change; read audit's
skipped-rule inventory. Repair findings and run the relevant tests. Propose a
policy change through `.pregate/requests/` for human review when the rule is wrong;
finishing a turn does not approve a weaker contract.

For a legitimate use case that conflicts with a rule, the feedback and `explain`
commands now direct the agent to propose a bounded rule/pack adaptation with a
valid example and an invalid counterexample. Preserve the invariant and requested
behavior, then submit the request for human review inside the harness. Do not
suggest switching protection off just to unblock the task. Explicit human disable
remains available. Grok's compact denial retains a short `pregate explain <rule>`
command when the global launcher's path is too long. The
recovery evidence verifies emitted feedback
and retained protection in captured protocols; live model behavior is not proven.

Incomplete completions remain historical after a later repair; their presence
does not prove a finding still exists. Legacy events without the explicit marker
are not guessed to be incomplete, because a quiet Stop can also contain shadow
findings or approved asks. Stop currently records one selected root per decision;
it does not certify that other roots touched by a session passed. Check or audit
each project. A failed event write, killed engine or launcher-only fallback
cannot promise a durable record. The recorded report is an independent review
surface, not a newly verified notification channel in the other four UIs.

After building, reproduce the production-binary path with
`bun run scripts/smoke-stop.ts`. It uses an isolated, Git-free temporary project:
it asserts init's shadow default, explicitly approves an enforcing contract,
real rule growth blocks two Stops, the third records an incomplete completion,
the current-tree check still fails, and a verified repair passes without erasing
history or changing the contract. This replays the native protocol; it is not an
actual harness UI session and does not modify personal state.
