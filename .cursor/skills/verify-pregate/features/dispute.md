# Dispute

`pregate dispute` drafts a fixture from a recorded denial. With no denial it refuses and leaves the contract unchanged. A directory with no preset is not disputed.

## Sub-features

- In a directory with no preset, `pregate dispute --last` exits 1 and says a preset is required.
- After enable, and before any edit denial, the same command exits 1, says no denied call is recorded, and leaves the lock unchanged.

## How to get to it (user POV)

The human runs `pregate dispute --last` after a hook denial they want to turn into a fixture. This drive runs it while the fixture has no denial, so the draft directory is not created. The active contract stays the one `init` wrote.

## Driving it

Launch in [../SKILL.md](../SKILL.md) has set `$PREGATE`, `$TMPDIR`, and `$repo`. Run this after enable and before the edit gate. A denial recorded later would make `--last` draft a fixture, which this check does not want.

```sh
bare=$(mktemp -d "$TMPDIR/pregate-bare-XXXXXX")
dispute_bare_code=0
dispute_bare=$(cd "$bare" && "$PREGATE" dispute --last) || dispute_bare_code=$?
test "$dispute_bare_code" -eq 1
printf '%s\n' "$dispute_bare" | grep -F "Dispute needs a repository with a PREGATE preset."
before=$(sha256sum "$repo/.pregate/pregate.lock.json" | awk '{print $1}')
dispute_code=0
dispute_text=$(cd "$repo" && "$PREGATE" dispute --last) || dispute_code=$?
test "$dispute_code" -eq 1
printf '%s\n' "$dispute_text" | grep -F "No matching denied call recorded for this repository."
test "$(sha256sum "$repo/.pregate/pregate.lock.json" | awk '{print $1}')" = "$before"
test ! -e "$repo/pregate-drafts"
printf '%s\n' "- Dispute: no recorded denial, exit 1, lock unchanged. A directory with no preset is not disputed."
```

## Gotchas

- Run this before the edit gate. After that gate, a recorded denial is a different result and would write `pregate-drafts/`.
- The refusal is not a hook deny. The project stays enabled.
- Dispute in `$repo` does not read a denial from another project.
