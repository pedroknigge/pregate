# Enable and disable

`pregate enable` records consent for the worktree. `pregate disable` withdraws it. Hooks deny neither command until that consent exists. A committed `.pregate/preset.json` is not consent.

## Sub-features

- `pregate init --yes` writes `.pregate/preset.json` and `.pregate/pregate.lock.json` and, because the proposal sets `activate: true`, enables the worktree when `PREGATE_UNATTENDED_APPROVAL=1` is already in the environment.
- `pregate enable --yes` writes the consent record again. `pregate status` then contains `Local consent is active` and does not contain `Nothing is enforced`.
- `pregate disable --yes` is a human CLI. From Cursor `Shell` after enable it is `shell-admin` and the project stays enabled.
- Before enable, the same shell payload `git commit --no-verify -m "agent skips hooks"` is `{"permission":"allow"}`.

## How to get to it (user POV)

In a repository that already has a contract, the human runs `pregate enable` in a terminal and types `y`. `--yes` skips that question only when `PREGATE_UNATTENDED_APPROVAL=1` is already set. `CI` alone does not. `pregate disable` asks the same way. `pregate status` tells them whether this directory is enforced.

A new clone has no contract. `pregate init` is the human's first review. This verification uses `--yes` only inside the isolated home from Launch.

## Driving it with Cursor

Clone and enable are in the Doctor section of [../SKILL.md](../SKILL.md). After `$repo` exists and before `init`, this payload must allow. The hook does not run git.

```sh
bun -e 'const [repo,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Shell",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{command:"git commit --no-verify -m \"agent skips hooks\"",cwd:""}}))' "$repo" verify-before \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) | tee "$verify_root/before-decision.json"
grep -q '"permission":"allow"' "$verify_root/before-decision.json"
```

After enable, the agent command is denied. Do not run it. Consent stays active.

```sh
bun -e 'const [repo,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Shell",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{command:"pregate disable --yes",cwd:""}}))' "$repo" verify-disable \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) | tee "$verify_root/disable-decision.json"
grep -q '"permission":"deny"' "$verify_root/disable-decision.json"
( cd "$repo" && "$PREGATE" status ) | grep -F "Local consent is active"
```

## Gotchas

- `enable` from a directory with no `.pregate/preset.json` fails. `init` comes first.
- Setting `PREGATE_UNATTENDED_APPROVAL` on the command line the agent types is `approval`, not a way through the gate. The variable is already in the isolated home so the CLI's own `init` and `enable` can finish. The hook still denies `pregate disable --yes`.
- Do not enable the Pregate checkout itself when you only meant to enable the scratch clone. Consent is per root, stored under the isolated `XDG_DATA_HOME`.
- `pregate disable --yes` as a CLI in this home would turn the fixture off. The replay does not run that CLI. Later actions would then allow everything.
