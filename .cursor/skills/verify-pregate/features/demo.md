# Demo

`pregate demo` runs an isolated sample in a directory it creates, then removes it. An unknown language is refused before that directory exists. The refusal does not enable the caller's project.

## Sub-features

- `pregate demo --language ruby` exits 1 and prints the usage line.
- No `pregate-owned-demo-*` directory is left under `$TMPDIR`.

## How to get to it (user POV)

The human runs `pregate demo --language python` when they want the sample. This drive uses a language the command does not accept, so it stops at usage. It does not need `pregate enable`.

## Driving it

Launch in [../SKILL.md](../SKILL.md) has set `$PREGATE` and `$TMPDIR`. Run it from `$checkout`. Do not pass `--json` or a real language. Those start the sample.

```sh
before=$(find "$TMPDIR" -maxdepth 1 -name 'pregate-owned-demo-*' | wc -l)
demo_code=0
demo_text=$("$PREGATE" demo --language ruby) || demo_code=$?
test "$demo_code" -eq 1
printf '%s\n' "$demo_text" | grep -F "usage: pregate demo"
after=$(find "$TMPDIR" -maxdepth 1 -name 'pregate-owned-demo-*' | wc -l)
test "$after" -eq "$before"
printf '%s\n' "- Demo: unknown language exits 1 with usage and creates no sample. The caller is not enabled."
```

## Gotchas

- A real `--language python` run compiles a sample and is not this check.
- The usage refusal still requires the compiled binary. Source `bun src/main.ts demo` is not the binary this skill drives.
- Demo does not read `$repo` and does not write consent.
