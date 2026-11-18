# Shell gate

Cursor sends a command as `preToolUse` with `tool_name` `Shell` and `tool_input` `{command, cwd}`. An empty `cwd` plus one `workspace_roots` entry means the workspace root. The hook judges the command text. It does not execute it.

## Sub-features

- `git commit --no-verify -m "agent skips hooks"` is `shell-admin` after enable.
- `node -e 'require("fs").writeFileSync("agent-out.txt", "x")'` is `shell-write`. `agent-out.txt` stays absent because the command is not run.
- `pregate status`, `git status --short`, and `node -e "console.log(1)"` are allows.
- The same `git commit --no-verify` line before `pregate enable` is an allow. That pair is the enable feature, not a second shell rule.

## How to get to it (user POV)

The human enables the project. Cursor then asks Pregate before `Shell`. On deny, Cursor shows `user_message` and does not run the command. On allow, Cursor runs it. A directory that never ran `pregate enable` gets `{"permission":"allow"}` and an empty block list.

## Driving it with Cursor

`$repo` is enabled. Pipe each payload to `hook pre --harness cursor` and keep the JSON. Do not eval the command.

```sh
run_shell() {
  local command="$1" id="$2" out="$3"
  bun -e 'const [repo,command,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Shell",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{command,cwd:""}}))' "$repo" "$command" "$id" \
    | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$out"
}
run_shell 'git commit --no-verify -m "agent skips hooks"' verify-no-verify "$verify_root/no-verify-decision.json"
grep -q '"permission":"deny"' "$verify_root/no-verify-decision.json"
run_shell 'node -e '"'"'require("fs").writeFileSync("agent-out.txt", "x")'"'"'' verify-node-write "$verify_root/node-write-decision.json"
grep -q '"permission":"deny"' "$verify_root/node-write-decision.json"
test ! -e "$repo/agent-out.txt"
run_shell 'pregate status' verify-status-shell "$verify_root/status-shell-decision.json"
grep -q '"permission":"allow"' "$verify_root/status-shell-decision.json"
run_shell 'git status --short' verify-git-status "$verify_root/git-status-decision.json"
grep -q '"permission":"allow"' "$verify_root/git-status-decision.json"
run_shell 'node -e "console.log(1)"' verify-node-log "$verify_root/node-log-decision.json"
grep -q '"permission":"allow"' "$verify_root/node-log-decision.json"
```

## Gotchas

- Quoting `node -e` has to survive both the shell that starts `bun` and the command string Pregate scans. The helper script builds that string in TypeScript (`node -e 'require("fs").writeFileSync("agent-out.txt", "x")'`) so the scanned text matches [docs/guarantees.md](../../../../docs/guarantees.md).
- `pregate status` is allow. `pregate disable --yes` is not. The words are close and the verdicts are not.
- A denied command that the operator then runs by hand is not a hook result. Leave `agent-out.txt` uncreated.
- Cursor's allow and deny both exit 0. Read `permission`.
