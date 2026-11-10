# One reviewed project update

Included in 0.0.5. Updating the global installation prepares a review;
only human approval migrates an existing project's contract.

The human starts `! pregate update` inside Claude Code, Codex, Grok or agy.
It installs the selected published engine and refreshes its registrations, then
prepares one review of every registered project that pins an older engine (see
[the machine's project registry](#the-machines-project-registry)). Installation
and project approval are separate: the existing preset, lock and consent remain
unchanged during preparation. Cursor's existing separate-terminal limit remains.
An unchanged contract can be degraded after an engine change; inspect `status`
instead of assuming that the former contract remains effective.

An isolated literal recovery preview (`update --project
--preview`, `pack update --all --preview`), preset diagnosis/schema inspection
and command help are guarded by the invoking installed engine, even when the
lock pins an older engine. This prevents an older guard from rejecting a recovery
command that it does not know. Application edits, checks, Stop and approval retain
locked-engine routing. Redirections, substitutions, wrappers and combined commands
do not receive this routing exception.

Literal `<command> --help` and supported `<command> <subcommand> --help` forms
exit before project or installation work. Extra flags and unknown command
paths are rejected. Help never activates a migration or substitutes for approval.

To prepare the project update with an already installed engine:

```sh
pregate update --project --preview
```

`pack update --all --preview` is the same operation. It updates the engine pin,
core pin and all registered bundled packs together. Registered Git packs are
fetched at upstream HEAD and proposed as exact commits with validated fixtures;
local packs remain at their authored paths. Existing methodologies, scope,
exclusions, overrides, notes, ratchet, layers and fitness bindings are retained.
One invalid pack prevents activation of the entire candidate. A single-pack
update also uses the installed engine; when other pins need migration it prepares
the complete project update instead of sending the user back to the old engine.

An override whose entire value is `"enforce"` or `"shadow"` is malformed. Update
proposes an explicit enforcement object and retains the previous lock's
effective severity and parameters. The diff shows that repair. It does not
recover a note or other authored information already overwritten by the malformed
string. Without a previous matching rule it refuses to guess. Other malformed
fields must be corrected explicitly; arbitrary schema errors are not repaired.

The preview includes one digest and the exact human approval command. Wrong
digests, changed contracts or changed source definitions reject approval.
Preparation never deletes the old lock, resets Git changes or disables protection.
After approval, audit and commit the preset and lock. `--yes` is human automation;
an agent cannot approve or perform the global update through a tool call.

## Guided updates

The [guide](guided-project-workflow.md) presents these
operations as choices from the actual project state. Check `--help` for `guide`.
In a terminal, run `pregate`, choose
update/repair or several projects, and inspect the complete reviews before one
human confirmation. Explicit paths work too:

```text
! pregate guide --projects "/path/project-a" "/path/project-b"
```

The guide approves the displayed digests rather than preparing fresh candidates
at application. After confirmation, all reviewed contracts and fixtures validate
again before any application. Each project revalidates at its writes; a later
race can leave earlier successes, which remain intact. The summary identifies
only failed projects for retry. Current projects need no rewrite or approval.
Custom packs, policy and disabled consent are preserved. Initial setup and
explicit activation reviews state when protection will be enabled; adoption and
update reviews state that consent is preserved. That intent is digest-bound.

Without a terminal, the agent inspects `guide --json --projects <path...>`,
presents the relevant choices and prepares `guide --preview --projects <path...>`.
The human can approve each displayed digest in its project through the supported
route. `guide` has no `--yes`. Its single combined confirmation requires a human
terminal; it does not infer approval from a pipe, an agent statement or a preview.
Native harness interaction retains the documented approval-route limitations.

## Update several projects from one directory

Give the existing project paths explicitly. Paths with spaces
are supported, and a project subdirectory resolves to its contract root. Duplicate
roots are processed once. This command uses the installed engine and does not
download another release:

```sh
pregate update --projects "/path/project-a" "/path/project-b" --preview
```

No contracts or consent change during preparation. Each project gets its own
diff and digest; inspect all reviews. With two or more reviews, the preview also
prints one batch code:

```text
Approve all 2 project updates: ! pregate approve <code>
```

The batch binds each project's exact proposal digest, and works from any
directory. Approval revalidates every project first, exactly as a single
approval does; if any project changed since the preview, nothing is applied and
each changed project is named. Each project is then applied and committed on
its own, as a single approval would commit it, and consent is never changed; a
project that changes while the human reviews fails alone and is named. The
per-project codes stay valid; after one of them is approved on its own, the
batch code applies nothing and names that project. In Claude
Code the batch dialog shows every project's review; a batch too long for the
dialog must be approved in a terminal.

For one human execution that updates the listed projects without a batch code,
rerun the same path list with `--yes`:

```text
! pregate update --projects "/path/project-a" "/path/project-b" --yes
```

All paths and candidates must pass preflight before application starts. The
human-automation run prepares fresh candidates and displays their complete diffs;
it is not digest approval of an earlier preview. To approve exactly a previewed
candidate, use the displayed digest command in that project's directory instead.
Application is independent per project: a later race or source change can fail
one project after another has succeeded. The final summary states how many
succeeded; successful updates remain. Fix the failing project and rerun.

Already-current contracts return without rewriting or requesting another approval.
Custom paths, selected rules, scope, parameters and existing consent are retained;
disabled projects stay disabled. This command does not initialize new projects.

`--yes` applies exactly the candidate it just prepared for each
project through the same path as `pregate approve`: each project's preset and lock
land as one commit (`chore: apply reviewed PREGATE contract <code>`), and other
staged or dirty work stays out of it. Add `--no-commit` to keep the files
uncommitted. The output has one line per project (`Updated`, `Current` or
`Failed`) and a final count. `--no-commit` is accepted only with `--yes`.

## The machine's project registry

Every `pregate enable`, `pregate disable` and approval that activates a project
writes a consent record on this machine. Those records are the registry: no
other file lists projects. `! pregate update` reads it after installing a release
and prepares one `update --projects ... --preview` with the new engine for every
enabled registered project, every worktree of it and the current project whose
lock pins an older engine. A lock that pins a newer engine (a teammate already
upgraded) is never proposed for a downgrade, and disabled projects are not
previewed. All of them share one preview, so two or more reviews get one batch
approval code. Nothing changes until the human approves the batch code or each
displayed code, or runs the same `--projects` list with `--yes`.

The first update to a release that reads the registry still runs the older
engine's single-project preview. That preview, from the new engine, names the
other registered projects with older pins and prints the exact
`update --projects ... --preview` command for them.

After the review, update removes installed engines that are not kept. It keeps
the new engine, the previous launcher engine, the running engine and every
engine pinned by a registered project (enabled or disabled) or its worktrees.
A clone that was never enabled on this machine is not in the registry; if its
pinned engine was removed, its launcher fails closed with
`pregate update --engine <v>` as the recovery.

When a session starts in a project whose lock pins an older engine and a newer
one is installed, the pinned engine's SessionStart briefing begins with
`PREGATE update ready (<pinned> -> <installed>). Ask the user to run: ! pregate update`.
An engine older than the one that added this notice answers
SessionStart without it.

`update --project` (run by `! pregate update`) lists the other
worktrees of the same Git repository whose lock pins another engine and prints the
ready `update --projects <paths> --preview` command for them. It only names them;
each worktree still changes through its own reviewed update. An agent may prepare the explicit `--preview` form but
must leave `--yes` to the human; Cursor retains its terminal fallback.

## Diagnosis without a valid lock

`preset diagnose --json` shows the installed engine/core, project and lock pins,
the editable preset, schema errors and pending bundled-version changes in one
read-only inspection. `preset schema` prints the actual preset schema;
`preset request-schema` prints the separate request envelope and JSON-patch schema.
`preset show --json` reads the editable document even if admission fails; its
successful output does not certify the contract. Plain `preset show` still
requires an admitted contract.

`preset compile` remains compilation, not migration. It reports schema/pin
diagnostics and explains that source/rule checks can expose further errors after
these prerequisites pass. JSON pointers escape `/` and `~` in names. Override
errors list allowed severity strings and the enforcement object form.

An older pinned hook cannot retroactively recognize new inspection commands.
Use the human `! pregate update` route once to install the new release and prepare
the review; do not loop on blocked helpers. Current guards allow the recovery
preview and inspection through the launcher or a known versioned engine path,
while activation, protected outputs and unknown executables remain denied.

Literal `cat .pregate/preset.json`, `git diff -- .pregate/preset.json` and
`ls .pregate/` can inspect the current root without admitting an invalid contract.
These bounded read exceptions do not authorize writes or arbitrary state reads.
After human approval, literal `git add -- .pregate/preset.json
.pregate/pregate.lock.json` can stage the exact admitted pair. Compilation and
source integrity must still validate; staging is not approval. Unknown
executables, pathspec-file options and protected output redirections are denied.
With Codex, establish a literal `cd` to the project when shell cwd is unknown.

## Import-rule cost

Shadow and warning import rules no longer initiate the unchanged-importer sweep
on Pre, Stop or stdin pre-check. Direct-file observations remain, and audit,
commit and CI retain the broader observations. A Stop with no changes does not
need that dependency sweep. With enforcing import rules, any changed resolver
input can matter, including configs without a conventional file extension.
Enforcing import rules still reevaluate unchanged importers when code or resolver
configuration changes affect resolution. Ordinary body edits with the
same parser validity and re-export surface use direct-file review. Creation,
deletion, parser validity, re-export changes and arbitrary resolver config edits
retain the scoped importer sweep; alias-remap, symlink and barrel controls remain
denied. Reads and parsed imports are shared inside each operation. A changed
resolver surface still has a cold sweep: there is no persistent graph.

Update previews and compilation name the interactive import rules and the number
of potential source importers. **This is not a persistent incremental dependency
graph.** Enforcing sweeps can still be expensive in a large repository. A timeout
can report the last observed engine checkpoint (input, admission, parse, rules,
dependency-review or stop-inventory). The launcher consumes the internal markers;
they cannot substitute for a denial reason. A checkpoint is a stage, not proof
of the culprit or an individual rule profiler. Dependency-stage diagnostics name
the active import rule IDs together and the observed shared duration/importer
count when available. They do not assign the shared cost to one culprit.
Persistent cross-process graph reuse and individual profiling remain future work.
