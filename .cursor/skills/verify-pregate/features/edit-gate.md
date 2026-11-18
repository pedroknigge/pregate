# Edit gate

Cursor sends a file write as `preToolUse` with `tool_name` `Write` and `tool_input` `{file_path, content}`. `content` is the whole resulting file. The keys are closed: an extra key makes the edit unknown. Paths are absolute. The engine answers `hook pre --harness cursor`.

## Sub-features

- A new `scripts/agent-disable.sh` whose text is `pregate disable --yes` is a control-text edit. Deny. The harness does not create the file.
- A `Write` of `.pregate/preset.json` is `protected-path`. Deny. The bytes `init` wrote stay.
- A `Write` of `notes/agent-pass.txt` with a plain sentence is allow. The harness then creates the file.
- `init` leaves ordinary pack rules in shadow, so this replay does not claim a language-rule deny. Shell-script control text and protected paths still deny in shadow.

## How to get to it (user POV)

The human enables the project, then uses Cursor in that directory. Cursor runs `.cursor/hooks.json` when the project has that file, or the shared Claude settings Cursor imports. This drive calls the same CLI entry the hook script would exec: `pregate hook pre --harness cursor`, with the JSON Cursor would write to the hook's stdin. The human sees `user_message` when the decision is deny.

## Driving it with Cursor

`$repo` is the enabled ky clone from [../SKILL.md](../SKILL.md). These are the three writes the skill's Drive section runs.

```sh
test ! -e "$repo/scripts/agent-disable.sh"
content=$'#!/bin/sh\npregate disable --yes\n'
bun -e 'const [repo,file,content,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Write",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{file_path:file,content}}))' "$repo" "$repo/scripts/agent-disable.sh" "$content" verify-script \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$verify_root/script-decision.json"
grep -q '"permission":"deny"' "$verify_root/script-decision.json"
test ! -e "$repo/scripts/agent-disable.sh"
```

```sh
before=$(sha256sum "$repo/.pregate/preset.json" | awk '{print $1}')
bun -e 'const [repo,file,content,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Write",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{file_path:file,content}}))' "$repo" "$repo/.pregate/preset.json" "{}" verify-preset \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$verify_root/preset-decision.json"
grep -q '"permission":"deny"' "$verify_root/preset-decision.json"
test "$(sha256sum "$repo/.pregate/preset.json" | awk '{print $1}')" = "$before"
```

```sh
note=$'Passing edit. This note does not change project code.\n'
bun -e 'const [repo,file,content,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Write",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{file_path:file,content}}))' "$repo" "$repo/notes/agent-pass.txt" "$note" verify-note \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$verify_root/note-decision.json"
grep -q '"permission":"allow"' "$verify_root/note-decision.json"
mkdir -p "$repo/notes"
printf '%s' "$note" > "$repo/notes/agent-pass.txt"
test -s "$repo/notes/agent-pass.txt"
```

## Gotchas

- The preset payload in the skill is the two characters `{}` plus a newline only when the caller passes that string. The command above passes `"{}"` without a newline. Either document is a protected-path write. Compare the hash, not the text.
- `file_path` must be absolute and must not contain `..`. A relative path is `payload-unrecognized`.
- Exit 0 with `"permission":"deny"` is a deny. Do not treat exit 0 as allow.
- Writing the file after a deny is the harness breaking the decision. The hook will not have created it.
