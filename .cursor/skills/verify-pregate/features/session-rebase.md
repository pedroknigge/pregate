# Session rebase

`pregate session rebase` previews a retained session baseline. With no baseline it refuses and leaves the lock unchanged. A directory with no contract is not rebased.

## Sub-features

- `pregate session` with no arguments exits 1 and prints the usage line.
- In a directory with no preset, `pregate session rebase cursor:missing --preview` exits 1 and says a contract is required.
- After enable, `pregate session rebase cursor:verify-pregate --preview` exits 1, says there is no retained baseline, and leaves the lock unchanged.

## How to get to it (user POV)

The human runs the preview after a session has a baseline, reads the digest, and approves it in a terminal. This drive has no such session. It checks the refusal. It does not apply a baseline.

## Driving it

Launch in [../SKILL.md](../SKILL.md) has set `$PREGATE`, `$TMPDIR`, and `$repo`. Run this after enable and before the edit-gate denials.

```sh
session_usage_code=0
session_usage=$("$PREGATE" session) || session_usage_code=$?
test "$session_usage_code" -eq 1
printf '%s\n' "$session_usage" | grep -F "usage: pregate session rebase"
bare=$(mktemp -d "$TMPDIR/pregate-bare-XXXXXX")
session_bare_code=0
session_bare=$(cd "$bare" && "$PREGATE" session rebase cursor:missing --preview) || session_bare_code=$?
test "$session_bare_code" -eq 1
printf '%s\n' "$session_bare" | grep -F "Session rebasing requires a project contract."
before=$(sha256sum "$repo/.pregate/pregate.lock.json" | awk '{print $1}')
session_code=0
session_text=$(cd "$repo" && "$PREGATE" session rebase cursor:verify-pregate --preview) || session_code=$?
test "$session_code" -eq 1
printf '%s\n' "$session_text" | grep -F "No retained baseline for this session and project."
test "$(sha256sum "$repo/.pregate/pregate.lock.json" | awk '{print $1}')" = "$before"
printf '%s\n' "- Session rebase: no baseline, exit 1, lock unchanged. A directory with no contract is not rebased."
```

## Gotchas

- Do not pass `--yes`. There is no digest to approve.
- The id `cursor:verify-pregate` is not a session the hook recorded. A later edit denial does not create this baseline.
- Rebase in `$repo` does not move the baseline of another project.
