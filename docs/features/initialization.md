# Start with a reviewed contract

From a project root, prepare the initial contract inside the harness:

```sh
pregate init --preview
```

It detects supported and unsupported language names, recognizable dependencies,
candidate folders and resolvable import edges. It recommends a builtin preset,
shows example findings and the exact preset/rule changes, then prints:

```text
pregate approve <displayed code>
```

Review the proposal and run that command in this shell, including a harness
`!` line. A code or `--yes` needs no terminal. An agent could run it; the
approval log records a non-terminal approval, and the agent must not run it.
A bare `pregate approve` still asks for `y` on `/dev/tty` (`CONIN$` on Windows).
Preview saves an expiring proposal in local engine data. It does not create the
project preset or lock, or enable local consent. The initial proposal can also be
reviewed with `pregate approve --preview` from a project subdirectory before any
preset exists. Proposal discovery stops at another Git repository boundary.

While that proposal is pending, hooks protect contract administration in its
project even though local consent does not exist. Unsupported agent approval
attempts are denied with the exact human command. Protected
candidate writes, wrapped approval commands and malformed hook payloads cannot
skip this review. Ordinary project rules remain inactive until approval.

The digest binds the exact candidate, baseline and expiry. Approval revalidates
them before writing. A concurrently created preset or changed lock invalidates
the proposal; initialization does not overwrite another writer's contract. The
proposal expires after 24 hours. See [in-harness approval](approval-in-harness.md)
for native protocol routes and remaining interactive verification.

After approval:

```sh
pregate status
pregate audit
pregate pack list
```

Status checks effective protection, including the installation and harness hooks.
If they are missing, run the human setup command `pregate setup`. Local consent
alone does not establish that a harness is protected. Audit inventories static
debt and its unresolved or unsupported coverage. Onboarding examples are advisory
samples, not a complete audit or a measured quality score.

## Choose explicitly or reuse an existing project

```sh
pregate init --preview --preset functional-ts
```

`init` and `guide --preset` accept only `backend-clean-ddd`, `functional-ts`,
`legacy-safe`, `integrity-only`, `python-starter`, `go-starter`, `rust-starter`,
and `mixed-starter`. The [complete recipe inventory](../packs.md) lists every
packaged preset JSON file; other recipes are examples to copy or apply through a
reviewed preset change, not names for `--preset`.
Recommendations use the detected layout. The review shows what the derived
layers find in the code today, and a recommended methodology that needs a core
layer is left out, and named, when the project has none
([layers with evidence](agent-proposed-contract.md#layers-with-evidence)). Ordinary rules
start in shadow; per-rule overrides take precedence. All 68 core rules activate
and enforce by default, including the 48 software requirements. Missing project
verification keeps audit incomplete. Use `fitness plan` to group missing evidence.
Adopt [project verifiers](project-fitness.md) with
`fitness bind <id[,id]> ... --preview` for requirements genuinely covered by one
assertion. Unbound requirements do not block work, while adopted bindings require
current passing evidence for check and Stop.
The `integrity-only` recipe selects no optional packs; it still activates all core rules.
Python, Go, and Rust use their own parsers and selected language policies; detection
alone does not activate an architecture/effects methodology or cover other languages.

Repeating `init` returns the current verified contract/status and leaves the
preset, lock and consent unchanged. It does not reactivate a project the human
disabled, repair a stale lock silently, or replace an existing preset with a
different requested choice. A valid existing contract returns 0 even if hooks
are missing or consent is disabled; its status explains those separate conditions.
An invalid contract or a different requested preset returns 1 with next actions.

The direct human terminal prompt remains available with `pregate init`; piped input
cannot answer it. `--yes` skips the question only when `PREGATE_UNATTENDED_APPROVAL=1` is already set in the
environment; elsewhere it still asks on the terminal. It cannot be combined with
`--preview`. Agents can prepare literal previews through the shell
guard; applying an established protected contract uses the human review path.

## Inventory boundaries

Git projects honor tracked/unignored files and the engine's explicit directory
exclusions. Standalone projects use filesystem traversal with those exclusions,
including virtual environments and generated output. Both omit symlinks and
binary assets. Unsupported language files contribute names, not parsed bodies;
only supported source and JSON context are read for this analysis. Relevant
filesystem errors are reported instead of hidden. A detected Git repository with
failed Git discovery/inventory is not silently treated as a standalone project.
