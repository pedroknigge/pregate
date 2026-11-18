# Pack enable

`pregate pack enable <ns/methodology>` selects a bundled methodology. `architecture/structure` is the id in [packs/architecture/methodologies/structure.json](../../../../packs/architecture/methodologies/structure.json). It is not part of the contract `init` writes. The human turns it on with a review.

## Sub-features

- `pregate pack enable architecture/structure --preview` prepares a review and does not change the lock.
- `pregate pack enable architecture/structure --yes` applies that review when `PREGATE_UNATTENDED_APPROVAL=1` is already set.
- The same command line on Cursor `Shell` is a pack mutation. The hook denies it. The methodology stays off.

## How to get to it (user POV)

After `pregate enable`, the human runs `pregate pack list --library` and `pregate pack show --library architecture/structure`, then `pregate pack enable architecture/structure --preview`, reads the digest, and approves it. An agent in Cursor does not get to skip the preview by adding `--yes`.

## Driving it with Cursor

Confirm the CLI still knows the methodology, then deny the agent form. Do not pass `--yes` to the CLI in this drive. That would change the lock the edit and shell samples are judged against.

```sh
( cd "$repo" && "$PREGATE" pack show --library architecture/structure ) | grep -F "architecture/structure"
bun -e 'const [repo,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Shell",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{command:"pregate pack enable architecture/structure --yes",cwd:""}}))' "$repo" verify-pack \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$verify_root/pack-decision.json"
grep -q '"permission":"deny"' "$verify_root/pack-decision.json"
```

`pack show` is a read. It is not the hook. The hook line is the denial.

## Gotchas

- The methodology id is `architecture/structure`, the `id` field of the methodology file, not the filename `structure.json` alone.
- `--preview` on the CLI is the human review. `--yes` on the hook is still denied.
- Enabling the methodology for real is a separate reviewed run. This skill's evidence run leaves the init contract in place so shadow stays the mode under test.
- A project that never ran `pregate enable` does not start enforcing `architecture/structure` just because the methodology was approved somewhere else.
