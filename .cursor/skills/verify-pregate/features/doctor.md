# Doctor

`pregate doctor` reads the isolated home and the current directory. `pregate --version` prints the engine and core versions. Neither command enables a project.

## Sub-features

- `--version` must equal `pregate <package.json version> (core <catalog/source.json version>)`.
- `command -v pregate` must be `$PREGATE`, the binary Launch compiled to `$verify_root/engine/<package version>/pregate`.
- In this home, doctor exits 1 with `ERROR: No harness found; PREGATE gates nothing on this machine.` and `Local consent is inactive` when the checkout has a preset and this home has no consent record. That error is the reading of Launch: `$CODEX_HOME` and `$GROK_HOME` are exported and not created. An empty directory at either path is a harness home.
- After `pregate enable` in the fixture, `pregate status` contains `Local consent is active`. A Cursor shell payload of `pregate status` returns `{"permission":"allow"}`, which shows `hook pre --harness cursor` is the entry a hook script would exec.

## How to get to it (user POV)

The human runs `pregate doctor` and `pregate --version` after install or update. Doctor lists harness homes, hook files, and consent for the directory they are in. A missing global harness install is an error on a machine that is supposed to gate Cursor. In this skill the home is empty on purpose, so that error is the expected read of an isolated home, not a failed compile.

## Driving it with Cursor

The commands are the Doctor block in [../SKILL.md](../SKILL.md). The hook probe is the one that proves the CLI entry, not `pregate doctor` itself. Doctor does not spawn Cursor.

```sh
version=$(bun -p 'require("./package.json").version')
core=$(bun -p 'require("./catalog/source.json").version')
test "$("$PREGATE" --version)" = "pregate $version (core $core)"
test "$(command -v pregate)" = "$PREGATE"
doctor_text=$("$PREGATE" doctor || true)
printf '%s\n' "$doctor_text" | grep -F "ERROR: No harness found; PREGATE gates nothing on this machine."
```

Run that from `$checkout` before enable. Run the status probe from the skill after enable.

## Gotchas

- `pregate doctor` can create local canary state when a harness is actually installed. This isolated home has none, so the command only reads. Do not run `pregate setup` to make doctor exit 0. Setup writes registrations and is not the read-only check.
- Doctor's consent line follows the current directory. In the Pregate checkout it talks about that checkout. In `$repo` after enable it talks about the fixture. Run it in the directory you mean.
- Exit 1 from doctor in this home is the no-harness result. A hook probe that prints `{"permission":"allow"}` or `{"permission":"deny"}` is a resolved hook entry either way.
- The binary under test is not `~/.local/bin/pregate`. If `command -v pregate` points there, Launch did not prefix `PATH`.
