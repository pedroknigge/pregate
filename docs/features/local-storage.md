# Local source storage and reviewed retention

These commands are in 0.0.2. Linux and Windows builds stay experimental until native validation passes.

PREGATE's session state can contain complete local source text. It is not a
hash-only log. Session retention is explicit: session records do not expire or
get deleted automatically. The opt-in [audit cache](whole-project-audit.md#incremental-audits-and-checkpoint-resume)
is disposable and has separate automatic byte/project limits.

## Inspect what is retained

```sh
pregate storage inspect
pregate storage inspect --json
```

Inspection works without initializing a project. It inventories session storage
across local projects, including session identifiers, roots, event counts, bytes,
source-blob bytes, baseline/cache bytes and writer/cleanup activity. It does not
print source contents or upload anything. JSON exposes the state directory and
roots; treat that metadata as local project information.
These commands inventory and manage session storage, not the disposable
`audits/` checkpoints. `audit --fresh` bypasses reuse and refreshes that project's
cache; it does not retire sessions or alter evidence.

Session storage is under `XDG_STATE_HOME/pregate`, or the platform default:
`~/.local/state/pregate` on POSIX; `LOCALAPPDATA/State/pregate` on Windows.
It contains:

| Data | Why it exists | Retention |
| --- | --- | --- |
| `sessions/<session>/blobs/<sha256>` | Source captured at session start and denied, asked or shadowed attempts; replayable before-images | Live snapshot references stay; eligible historical event copies may be pruned |
| `<rootHash>/snapshot.json` | Stable session baseline, root, revision and dirty-source references | Preserved, regardless of age |
| `<rootHash>/head/*.json` | Cached source from the snapshot's Git revision | Preserved |
| `events/<UTC-date>/*.json` and legacy flat events | Findings, warnings, metadata and denial/Stop counters | Preserved |
| `<rootHash>/sources.json` | Verified rule-source cache | Preserved |

Hashes identify and verify content; they do not replace stored source or encrypt
it. Existing issue drafts can contain source when explicitly included; approval
proposals can contain candidate source. These and feedback data live separately
under PREGATE's data directory and are not included in this session inventory or
cleanup. Project-local dispute drafts are also outside this command's scope.

## Prepare and approve a cleanup inside the harness

From an initialized project:

```sh
pregate storage prune --older-than 30 --preview
pregate storage show <digest>
```

Both commands prepare or display a review; neither deletes code. `--preview` is
optional because `prune` always prepares a draft. The review lists the project,
cutoff, sessions, exact blob paths, content hashes, file counts and bytes.
After reading it, the human can type:

```sh
! pregate storage apply <digest> --yes
```

An agent's apply command is denied in every harness; the agent presents the review
and the human runs the digest-bound command with `!` or in a terminal. Actual UI
verification across all harnesses remains a release gate.

The preview expires after 24 hours. Apply rechecks its digest, project and
current storage, obtains exclusive cleanup markers, then validates again before
removing any file. Changed source references, event metadata or candidate bytes
require a fresh review. Unattended application without explicit human automation
or available approval is refused.

## What cleanup can remove

A blob is eligible only when an older event for the selected project references
it and no snapshot, newer event or event belonging to another project needs it.
Both before- and after-image references count. Unattributed/orphaned blobs remain
because the engine cannot safely assign them to the selected project. The
cleanup includes dated and legacy flat histories but does not remove the events.

All snapshots, their dirty-source blobs, cached baselines, histories and counters
stay intact. Old findings remain visible in reports and human feedback. Once
their source is removed, a new issue can still omit code; including that old code
or replaying a dispute fails with a missing-content error. Code already copied
into a draft remains there. A later observation can store that content again.

Snapshot age does not prove a session is finished: a harness may resume it.
This command therefore does not retire sessions, reset acceptance boundaries,
delete histories or promise to erase every local copy of source. File removal is
permanent for the selected copies, but is not secure disk erasure and cannot
remove filesystem backups.

## Concurrent or interrupted operations

Source/event writers announce leases; cleanup announces an exclusive marker
before checking writers. Concurrent hooks can coexist. Cleanup refuses when a
writer is active, and new writers fail closed while cleanup holds its marker.
Snapshot creation protects its blob publication with the same coordination.
Ordinary releases remove their markers in `finally`.

An abruptly killed process can leave a lease or exclusive marker. Inspection
shows each marker's owner PID and whether the OS reports it present, absent or
unknown. PREGATE does not remove a marker merely because it is old.

```sh
pregate storage recover --preview
pregate storage show <digest>
! pregate storage apply <digest> --yes
```

Recovery always prepares a review, even without `--preview`. It selects only
markers belonging to sessions whose recorded roots include this project and
whose recorded host matches this machine and process probe returns `ESRCH`
(no such process). The review lists all roots
sharing each selected session. Apply uses the same expiring digest and native
human permission route as source cleanup; it rechecks ownership, content hashes
and process absence before unlinking the exact reviewed owner files.

Recovery removes coordination metadata only. It does not delete source, retire
a session or reset counters. New cleaners use unique owner filenames so an old
recovery cannot unlink a successor's marker. An alive PID is retained even if
it may have been reused. Permission/probe failures, invalid ownership, ownerless
or ambiguous cleanup directories, missing/foreign host identity and legacy `owner.json` markers remain unknown
and cannot be automatically recovered. Inspect these before manual maintenance;
stop the relevant engine processes first. These limits prevent an unidentified
live owner from being cleared on the strength of age or a guessed PID.
Recovery assumes machine-local state; it does not certify cross-machine shared
storage or distinguish machines deliberately configured with identical hostnames.

If an apply fails midway, part of the approved operation may be complete;
inspect storage and prepare a new preview. Preserved baselines and events remain
authoritative. No storage operation uploads code or recovery metadata.

Corrupt/missing snapshots, invalid source references and nonregular storage
entries refuse cleanup. The coordination protects cooperating engine processes;
it is not an OS security boundary against arbitrary external state modification.

After building, reproduce the native workflow with
`bun run scripts/smoke-storage.ts`. It records a real shadow observation, uses a
short test retention window, refuses unattended cleanup, applies explicit digest
automation and checks preserved baseline/snapshot/contract bytes, report counts
and a resumed Stop. All data and approvals belong to a temporary test project;
this does not certify actual harness UI interaction or erase user state.
The same smoke kills real cooperating source-helper writer/cleaner processes,
then checks production-binary PID inspection, the denial of an agent's apply
with the human `!` route, unattended refusal, approved recovery and unchanged baseline/history. The
producer helpers use the source coordination module; this is not a claim that
an actual harness UI or a production gate process was killed during verification.
