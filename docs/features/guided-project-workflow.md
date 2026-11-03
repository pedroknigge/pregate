# Guided project workflow

Included in 0.0.2. Check [v0.0.1 release notes](../releases/0.0.1.md) for what the first public tag verified.
Check `pregate --help` for `guide`. The
[explicit update workflow](project-update.md) remains available.

## One entry

Run `pregate` in an interactive terminal. The guide inspects the project and
offers the useful next action:

| Observed state | Suggested action |
| --- | --- |
| No contract, in Git or a standalone directory | Configure this project |
| Older engine or sources | Review a complete project update |
| Invalid or missing lock | Explain the cause and prepare a supported repair |
| Current contract without consent | Review and activate protection |
| Active contract with scope gaps | Review coverage and packs |
| Active contract | Audit code and choose freeze or repairs |

Installation repair, doctor, the normal global updater and explicit multi-project
updates are also available. Previously recorded local projects are offered for
selection, including disabled ones; other paths can be entered. Repositories
are never migrated silently.

Bare `pregate` opens the guide only when input and output are terminals and CI is
not set. Redirected input retains the hook-auto protocol. Use explicit `guide`
for scripts and harness inspection; piping answers never grants approval.

## Modes and selections

| Command | Effect |
| --- | --- |
| `pregate guide` | Terminal choices, or a state card and next actions without a terminal |
| `pregate guide --json` | State, concrete errors, scope, recommendations and actions; no proposal or consent changes |
| `pregate guide --preview` | One candidate; active preset, lock and consent unchanged |
| `pregate guide --preview --full` | Complete review content rather than the compact summary |
| `pregate guide --projects <path...>` | Human terminal review of explicit existing projects |
| `pregate guide --json --projects <path...>` | Inspect those projects |
| `pregate guide --preview --projects <path...>` | Prepare all reviews without application |

First setup reviews actual source roots, stack and local documentation, recommends a recipe, selects
optional packs together, accepts custom-pack directories and asks whether
optional checks should observe or prevent new violations. Detected scope and
retained exclusions enter the same proposal. The review distinguishes blocking
checks, observations and requirements without evidence. Core rules remain active
by default.

Before a contract exists, inspection reports `coverageState: "proposed"` and the
default recipe's proposed scope with detected roots and retained exclusions.
Counts separate parser-supported files, explicit exclusions and unsupported
source-like files. They describe a candidate scope; no rule is active and no
behavior has been verified. Existing schema-valid presets use `"current"`;
damaged presets use `"unavailable"` until their scope can be reviewed safely.

Without `.pregate`, the first card proposes a documentation/stack/code scan and a
custom project pack immediately. Bounded documentation discovery reads up to 40
README/docs/ADR files, 128 KiB per file and 2 MiB in total. It proposes at most
12 requirement candidates, preserving path, the first line and source SHA-256.
Wrapped paragraphs and list items remain together so a keyword cannot become
an isolated fragment. Fenced examples, required-parameter descriptions and
statements longer than 600 characters are skipped. This is advisory extraction,
not semantic classification: a complete paragraph can still be irrelevant to
the project's product contract.
When requirements exist, `--custom-from-docs` adds a data-only local pack to the
same initial approval. The pack starts in shadow with unverified fitness
requirements; no executable project assertion is invented. Reject irrelevant
statements during review. With no explicit requirements, the card still proposes
custom rules and the agent must inspect domain evidence before authoring them.

The agent can prepare a chosen configuration:

```sh
pregate guide --preview --packs typescript,react,nextjs --enforcement enforce
pregate guide --preview --packs typescript --custom-pack "./team rules"
pregate guide --preview --packs typescript,react --custom-from-docs
```

`--custom-pack` can repeat. `--preset <name>` selects an initial recipe.
`--packs none` adds no optional policies; existing recipe policies remain.
Detected recommendations use their applicable methodologies; another bundled
namespace uses its authored methodologies and diagnoses conflicts. Local packs
must pass real fixtures. Unknown packs and invalid selections do not apply.

Selection flags require `--preview` and cannot combine with `--json` or
`--projects`. There is no `guide --yes`. Existing recipes, custom sources,
overrides and exclusions are retained. A hand-selected different scope uses a
[reviewed preset request](pack-composition.md). Detected folders do not prove
behavior coverage. An update or supported repair can include selected additions
in the same review, without a separate migration and approval for each pack.

## Human review

One terminal confirmation approves the displayed candidate. Initial setup
enables protection; adoption and updates preserve consent, including disabled
projects. Activation is a separate choice. The digest binds the stated consent
effect and contract bytes.

Compact and full guide previews state installation readiness before consent:
missing engine, launcher or harness registrations mean degraded protection.
Present registrations do not prove that hooks work. Run `pregate setup` for missing
installation or registrations, then `pregate doctor` for real denial canaries.
Approval can record a valid contract and enabled consent while agent-edit
protection remains degraded; preview does not silently install anything.

The compact review names enforcing import rules and estimates their applicable
source importers for resolver-impacting changes. Ordinary body edits use direct-file
review. Creation/deletion, parser-validity, re-export and resolver-configuration
changes can require a scoped importer sweep. Import facts and reads are shared
within the operation; there is no persistent graph on the interactive path. Shadow/warn importer
observations remain available without that blocking sweep. Inspect the cost
before activating an enforcing architecture contract on a larger repository.

Before that confirmation, the human guide installs this engine and its launcher
through `setup` if either is missing. A setup failure leaves the project previews
unapplied and names the recovery step. Without registered harness hooks, it warns
that CLI checks are available but agent-edit protection remains degraded.
JSON inspection and preview mode do not perform this installation.

For several projects, enter paths or run:

```text
! pregate guide --projects "/path/project-a" "/path/project-b"
```

Spaces and subdirectories are supported; roots are deduplicated. All candidates
preflight before application. After confirmation, every displayed digest and
source fixture validates again before any application, then each project
revalidates before its writes. A later race can leave earlier successes; the
summary retains those and lists only failed paths to retry. Current projects
need no approval or rewrite. An unrelated old pending proposal is not applied.
Updates do not initialize new projects or commit changes. A path without a
contract names `pregate guide --preview` in that project as its recovery route;
approve that initial digest before including it in a multi-project update.

Discovery examines the entire optional catalog, including inactive methodologies.
When the previous immutable engine is installed, it names new and changed packs;
otherwise it states that the historical count is unknown. It does not guess that
every unselected pack is new. After an interactive project update, the guide
labels untouched projects `Already current` and lists only missing recommended
methodologies, including missing methods in an already selected pack. One
follow-up menu, when missing recommendations exist, covers the entire selected group: review useful additions
together, audit all with their current rules, or finish. Chosen additions get
one combined review; subsequent audits show their results and repair commands
without repeating a menu for every project. Custom packs, deliberate exclusions
and disabled consent remain. Adding packs is optional and requires its displayed
review; declining them retains completed updates. With no missing recommendation,
the guide finishes with the explicit audit command and no additional menu.

The agent cannot run the interactive guide to approve itself. The human enters
`! pregate guide` where the supported harness route provides a terminal.
Without one, the agent reads `guide --json`, presents the relevant choices
together, prepares `guide --preview` and shows the complete review. The human
enters its exact displayed command:

```text
! pregate approve <code>
```

Each project preview has its own digest; the interactive confirmation can approve
the combined set. Existing native Claude permission and human shell routes keep
their [capability boundaries](approval-in-harness.md). Cursor's fallback requires
a human terminal. A terminal or an agent's claim is not a trusted human marker.

For a current cloned/disabled contract, a plain `guide --preview` is a no-op,
not an activation proposal. Choose activation in the interactive guide, or let
the human run `pregate enable` in a terminal after reviewing `status` and type `y`.
A harness `!` line qualifies only when that harness gives the command an interactive
stdin. `--yes` does not skip the question unless `PREGATE_UNATTENDED_APPROVAL=1` is already set. Updates and
pack adoption preserve disabled consent; the agent must not run the activation command.

## Audit and recovery

Successful configuration, adoption or activation audits the project and offers
no-new debt protection, the first bounded repairs with verification guidance, or
review later, or grouped project-assertion planning with `fitness plan`.
Changing strict to no-new needs a separate review; an already
selected no-new policy is not rewritten. Approval commits the contract when it
can; only when it could not does the guide ask to commit it before CI uses
`check --ratchet --base <commit>`. Freezing does not erase debt or verify
missing requirements. The repair
plan does not edit application code or run project tests.

Cancellation, EOF or unavailable approval leaves contracts and consent unchanged;
previews can remain available. Global setup that already completed is retained.
Changed/expired reviews require new preparation.
Recovery names invalid fields, pins or sources and reuses update, diagnosis and
setup. Download, authentication and checksum errors stay with the normal updater.
Do not disable protection, delete locks or reset valid policy to escape a failure.

[Coordinator](../../test/guided.test.ts), [API](../../test/project-setup-api.test.ts),
guard and launcher tests verify their stated scenarios. Compiled terminal
controls do not certify the entire guided journey in every native harness UI or
on Windows/Linux. Existing approval observations retain their recorded scope.
