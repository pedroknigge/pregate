# Human feedback and local calibration

Implemented in the working tree for the next release. Feedback labels individual
recorded rule observations, including warnings and shadow findings. It does not
change a rule, exempt an edit or publish anything. The labels are local human
judgments, not inferred outcomes of the agent's next action.

## Review and label one observation

From an initialized project:

```sh
pregate feedback list --days 7
pregate feedback list --days 7 --json
pregate feedback draft <finding-id> --as false-positive --note "Why this case should pass"
pregate feedback show <digest>
```

Use `correct` when the reported violation is valid, `false-positive` when it should
not trigger, and `uncertain` when you cannot judge the observation. One ID names
one observation at one location in one recorded call. Different locations and
repeated attempts have separate IDs. A valid violation is not evidence that a
repair was useful or that the task completed.

The preview identifies the rule, location, symbol, measurement, limit, session,
observation time, proposed label and note. Inspect the originally reported case
before judging it; the current file may have changed. Replayable denials can also
be examined through `pregate dispute`. To save the reviewed label, run the printed
command in a separate terminal:

```text
pregate feedback apply <digest> --yes
```

Every harness denies this digest-bound command when the agent issues it and names
the separate terminal; see [approval limits](approval-in-harness.md).
Agents can list, draft and show feedback; an ordinary protected shell call cannot
apply it. Actual human permission and self-approval
prevention in all harness UIs remain release verification items.
A human running the CLI directly can use its terminal prompt or `--yes`.

Drafts expire after 24 hours. A changed observation, draft or existing label
invalidates approval. To reclassify an observation, prepare and approve a new
draft; it explicitly replaces the previous label. Use the same `--days <n>` window
for list and draft when reviewing older observations; both default to seven days.
Date partitions outside that window are skipped before reading event content.
Legacy flat histories still require timestamp filtering.

## Read denominators before interpreting precision

```sh
pregate report --days 30
pregate report --days 30 --json
```

The report includes correct, false-positive, uncertain and unlabeled counts,
overall and per rule. JSON exposes `calibration.reviewedPrecision` as a fraction
from 0 to 1, or `null` when no observations have been judged. It is calculated as:

```text
correct / (correct + false-positive)
```

Uncertain and unlabeled cases are excluded from that denominator and remain
visible. For example, two correct, one false-positive and seven unlabeled
observations give reviewed precision 2/3 over three judged observations, not a
quality score over all ten. A label contributes only when its observation is in
the selected inventory and all metadata matches. Matching IDs with changed
metadata count as stale and remain excluded from precision. Removed observations
and labels outside the selected project/window do not contribute.

These observations are a selected local sample. Repeated attempts are counted
separately, so this is not precision over unique code sites or an unbiased
evaluation corpus. The report does not measure recall, compiler/runtime behavior,
executed repairs, beneficial fixes or task completion. The existing next-pre-edit
correction counter remains an observation of a subsequent accepted proposal.

## Local storage

Drafts live under the machine's data directory in `pregate/feedback/drafts/`.
Confirmed labels live in `pregate/feedback/<project-hash>/<finding-id>.json` and
contain observation metadata, event hash, human note and confirmation time.
Feedback does not copy source blobs or alter snapshots, event histories, denial
counters or pending contract approvals. Existing event storage can still contain
complete source blobs; labels do not make that storage hash-only. Nothing is sent
to GitHub or a model by this workflow. Explicit retention/cleanup remains separate
work tracked in [roadmap](../ROADMAP.md).

After building, `bun run scripts/smoke-feedback.ts` exercises the production
binary on a real recorded shadow observation in a temporary project. It checks
unattended refusal, explicit digest approval, report denominators and preservation
of the contract and resumable snapshot. This passes on macOS arm64; it simulates
human CLI automation and does not certify an actual UI interaction or a pilot corpus.
