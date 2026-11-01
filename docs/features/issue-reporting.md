# Report a finding to PREGATE

This workflow sends a reviewed finding to
[`pedroknigge/pregate`](https://github.com/pedroknigge/pregate/issues),
the project's native repository. It never chooses the application's Git remote.
There is no automatic publication when a check blocks an edit.

The engine asks the agent to offer reporting when a rule denies an edit. Prepare
the last recorded finding without contacting GitHub:

```sh
pregate issue draft --last --note "Expected behavior and why this needs investigation"
```

The preview shows the destination, title, complete body and SHA-256 digest.
It includes engine/core versions, harness, phase, verdict, cause and recorded
rule/check versions. It omits code, local paths, session identifiers and rule
parameters by default. Legacy events say when versions were not recorded.
New Pre and Stop observations retain the exact qualified check IDs at observation
time, so a later contract edit does not substitute a different check version.
Multi-rule titles summarize the number of rules and name the first rule; the
body preserves all IDs and the finding count for each. Without `--note` or a
public reproduction, the body explicitly identifies the missing expected
behavior and replay evidence rather than publishing placeholder instructions.
Legacy observations retain their existing deduplication fingerprints; new
versioned observations distinguish engine/check revisions.
Describe the expected result before approving; a denial is evidence to investigate,
not an assertion that the rule has a bug.

If the last event is context for a different problem, set an explicit title:

```sh
pregate issue draft --last --title "Project upgrade fails" --note "Expected the reviewed upgrade to complete"
```

`--title` requires an explanatory note, 1–200 characters and no control characters.
The original recorded evidence remains labeled as context. The title/note enter
the reviewed draft and its deduplication identity: repeating the same context
deduplicates; changing that explicit context produces a different report.
It does not claim that the recorded finding reproduces the titled problem.
Notes and titles accept guarded shell substitutions such as `$(cat note.md)`;
commands inside the substitution are independently inspected. Publication still
requires the human's approval of the complete digest-bound draft.

Use `--include-code` only after the user agrees to include the recorded attempted
file. The preview explicitly says whether it contains code. That option includes
the complete recorded file, so review it for private data and use a small public
reproduction when possible. Code never comes from reading the current working
file: retained blobs must match their recorded SHA-256.

```sh
pregate issue draft --last --include-code --note "Why this public example should pass"
pregate issue show <digest>
```

## Attach a small public reproduction

`--repro <directory>` includes a standalone fixture instead of the recorded
private file. Use the existing fixture format: `CHECK.json` holds the check
definition; `fixture.json` holds language, parameters, context, target, optional
baseline and expected result; `files/` and optional `before/` contain `.fixture`
source files. Include dependencies/configuration needed by the example.

A candidate produced by `pregate dispute --last` already has this layout for each
check. Copy that individual case to a public example, then reduce/redact its code,
paths, parameters and context before attaching it. Dispute candidates contain
the original recorded code and are not automatically safe to publish.

```sh
pregate rules test --fixture ./public-example
pregate issue draft --last --repro ./public-example --note "Expected behavior"
pregate issue show <digest>
```

The single-fixture command runs the same evaluator and debt comparison as pack
fixtures. It exits 0 when the observed result matches the fixture's expectation
and 1 on mismatch or invalid data; it does not admit a whole pack or activate a
policy. A valid example that fails its intended expectation can still become an
issue draft: that mismatch is useful evidence. Invalid schemas/parameters or
language/coverage mismatches cannot prepare a draft.

The preview includes the entire checker/configuration/source map and observed
fixture result, and marks source inclusion as **yes**. It records the current
replay engine/core separately from the original event's recorded versions.
Notes and unrelated files
outside `files/` and `before/` stay local. Review every included field: the engine
does not automatically redact the explicit reproduction. `--repro` and
`--include-code` are mutually exclusive.

An issue contains a JSON map of fixture filenames to their text. A maintainer
can copy that map to `repro.json` and run `pregate rules test --fixture repro.json`
without reconstructing a project or activating a preset. `--repro repro.json`
also accepts the same map. The draft copies the exact reviewed payload; later
changes to the original example cannot alter the approved issue body.

This is a reporter-provided public example. Its result is not proof of replaying
the original private event, which can depend on different configuration and files.

After reviewing, the user can type the following in a harness's human shell input:

```text
! pregate issue submit <digest> --yes
```

Claude Code interactive parent sessions can also request their native permission
prompt for that exact command. The prompt contains the complete preview. agy, Codex,
Cursor and Grok reject an agent's approval command and direct it to the human shell
route. A normal agent shell call is not human approval; wrappers, pipes, substitutions,
extra flags, known Claude Code subagents/noninteractive sessions and CI do not
qualify for the native route. agy's human Bash route works with normal and
skip-permissions settings; the engine does not infer parent identity from its hook.
See [approval limits](approval-in-harness.md). This operates through the registered
hooks, rather than treating a chat response as a receipt.

Submission requires GitHub CLI (`gh`) authentication. The engine searches open and
closed issues for the finding fingerprint before creating an issue, uses a body
file with literal newlines, and records the resulting URL locally. Concurrent
submissions for the same fingerprint are serialized. A repeated submission returns
the existing issue instead of adding a comment or creating another issue.

Each `gh` command has a 15-second deadline and a 16 MiB output limit on each
of stdout and stderr. Exceeding either limit terminates the immediate child and
reports an explicit deadline or output-budget failure. Ordinary command failures
retain at most the first 4096 stderr bytes in the diagnostic. A valid URL printed
before a command times out does not establish successful publication. These are
local process limits; they do not cancel an already received GitHub request or
guarantee termination of grandchildren.

New submission markers record a unique owner file, PID, host and phase. The phase
changes from checking to creating before contacting GitHub to create an issue.
Retry the same reviewed `issue submit <digest> --yes` command after an interruption:
if the OS proves the owner PID absent on this machine and creation had not begun,
the engine can recover its exact marker and retry. If creation may have begun,
the engine only searches for an issue with the fingerprint. A matching issue
restores the receipt and removes that exact abandoned owner; no new issue is created.

An empty search does not prove that an interrupted request failed. A timeout,
failure or unrecognized creation response retains its creating marker, and retries
will reconcile rather than publish again once the owner is provably absent.
Offline lookup, uncertain results, active/reused PIDs, inaccessible process probes,
foreign/missing hosts and ownerless/legacy/ambiguous markers stay retained.
Inspect GitHub before manually resolving those cases. This mechanism assumes
machine-local storage; it does not certify exact-once publication across machines
or treat the search index as immediate proof of absence.

Missing `gh`, authentication failures, connection failures and timeouts preserve
the draft and report the problem. If creation began and its result is uncertain,
check GitHub before retrying. The next attempt reconciles an identifiable abandoned
creation without issuing a second create request; unresolved outcomes stay blocked.
Declining approval runs no GitHub command. Preparing or reviewing a draft is offline.

Drafts, optional source content, submission markers and receipts live in the
installation's local data directory under `issues/`. They are protected from ordinary
agent edits by the existing machine guard. They are not committed to the application.

## Verification boundary

The automated coverage checks offline drafts, explicit code inclusion, altered
digests, destination binding, declined approval, failure/retry, remote/local
deduplication, concurrent submission, and native hook emissions. GitHub calls in
these tests are simulated; tests do not publish issues to the real repository.
Recovery tests kill real cooperating source-helper processes in both phases,
check existing-issue reconciliation without recreation, preserve uncertain/offline
outcomes and unknown ownership, and refuse to remove a successor owner that appears
during lookup. These killed helpers are not production CLI crash observations.
Additional tests exercise both the actual source CLI and production binary with
a native local `gh` fixture. They reject late success, terminate excessive output,
preserve exact output boundaries and kill the CLI during creation before retrying.
Retries retain uncertainty or restore the matching receipt without a second
create. An isolated mutation of the real creation phase exposes a duplicate
effect. See transport and recovery evidence.
These local fixture observations do not establish real GitHub or harness UI behavior.
Public-reproduction coverage checks offline evaluation, debt baselines,
expectation mismatch, exported JSON replay, invalid input refusal, exclusion of
private notes and immutable reviewed submission after the example changes.
Actual interactive approval in each supported harness remains a release check.

The human shell interface is documented for
[Claude Code](https://code.claude.com/docs/en/interactive-mode#shell-mode-with-prefix),
[Grok](https://docs.x.ai/build/keyboard-shortcuts) and
[Cursor's current client](https://cursor.com/en-US/download).
Codex 0.160.0's actual Mac TUI human shell route now has
contract-approval evidence;
issue submission in that UI, agy human-command behavior and supported native
prompts remain separate runtime checks. A captured hook payload does not prove
an interactive dialog was shown or approved.

GitHub CLI's official references describe
[`issue create --body-file`](https://cli.github.com/manual/gh_issue_create) and
[`issue list --state all --search`](https://cli.github.com/manual/gh_issue_list).
