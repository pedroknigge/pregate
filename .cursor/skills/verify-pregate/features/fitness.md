# Fitness status

`pregate fitness status` reports adopted project assertions. It does not enable a project and it does not change the lock. Unbound requirements stay unverified. A directory with no contract is not judged.

## Sub-features

- In a directory with no `.pregate/preset.json`, the command exits 1 and says a contract is required.
- After `pregate enable` in the fixture, the command exits 1, names unbound requirements, and leaves `.pregate/pregate.lock.json` byte-for-byte.

## How to get to it (user POV)

The human runs `pregate fitness status` in a project that already has a contract. The text counts passing, failed, and unbound requirements. Binding a verifier is a separate reviewed command. This drive does not bind one.

## Driving it

Launch in [../SKILL.md](../SKILL.md) has set `$PREGATE` and `$TMPDIR`. Run the bare directory before enable. Run the fixture line after enable, from `$repo`.

```sh
bare=$(mktemp -d "$TMPDIR/pregate-bare-XXXXXX")
fitness_bare_code=0
fitness_bare=$(cd "$bare" && "$PREGATE" fitness status) || fitness_bare_code=$?
test "$fitness_bare_code" -eq 1
printf '%s\n' "$fitness_bare" | grep -F "Fitness verification requires an established project contract."
before=$(sha256sum "$repo/.pregate/pregate.lock.json" | awk '{print $1}')
fitness_code=0
fitness_text=$(cd "$repo" && "$PREGATE" fitness status) || fitness_code=$?
test "$fitness_code" -eq 1
printf '%s\n' "$fitness_text" | grep -F "unbound requirements"
test "$(sha256sum "$repo/.pregate/pregate.lock.json" | awk '{print $1}')" = "$before"
printf '%s\n' "- Fitness status: exit 1, unbound requirements, lock unchanged. A directory with no contract is not judged."
```

## Gotchas

- Exit 1 here means the requirements are not adopted. It is not a hook deny.
- Do not run `pregate fitness bind` or `pregate fitness run` in this drive. Either one is a different review.
- Status in `$repo` does not start enforcing another checkout.
