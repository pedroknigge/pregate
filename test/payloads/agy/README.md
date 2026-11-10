# Hook payloads: Antigravity CLI (`agy`)

Real stdin that `agy` hooks received, byte for byte, apart from the sanitization below. Each file is
compact protojson (camelCase keys, sorted alphabetically) **with no trailing newline**.

## Source

- Antigravity CLI **`agy` 1.2.14** (Google), macOS arm64, model `gemini-3.8-flash-high`. Captured 2026-10-02.
- Headless mode: `agy -p "<prompt>" --dangerously-skip-permissions --print-timeout 240s --output-format json`,
  run from a scratch git repo.
- Hooks were registered at project level in `<repo>/.agents/hooks.json` (named hook `pregate-gate`, matcher `"*"`).
  Each hook wrote its stdin to disk verbatim. Probes also ran from the global `~/.gemini/config/hooks.json`
  and from an installed plugin (`~/.gemini/config/plugins/<name>/hooks.json`). The payload is the same
  in all three scopes.
- Isolation: every run used `HOME=<scratch>/home`, with `<scratch>/home/Library/Keychains` symlinked to the
  real login keychain. That symlink is the only auth dependency: `agy` stores its OAuth token in the macOS
  keychain (service `gemini`, account `antigravity`). The real `~/.gemini` was never read or written by these runs.
- Sanitized: repo → `/home/user/project`, scratch HOME → `/home/user`, and every UUID (conversationId,
  `brain/<id>`, `send_message.Recipient`) → `00000000-0000-4000-8000-0000000000NN`, mapped consistently.
  In the subagent files, `…05` is the parent conversation and `…06` is the subagent.

## Files

The payload has **no** `hook_event_name`, `cwd`, `session_id` or `tool_use_id`. The event is known only
from the command that registered the hook. `stepIdx` plus `conversationId` identify a call.

| File | Event | What it shows |
|---|---|---|
| `pre-invocation.json` | PreInvocation | `invocationNum`, `initialNumSteps` |
| `post-invocation.json` | PostInvocation | same shape as PreInvocation |
| `pre-view_file.json` | PreToolUse `view_file` | Read tools also reach a `"*"` matcher: `{AbsolutePath, toolAction, toolSummary}` |
| `pre-write_to_file.json` | PreToolUse `write_to_file` | create: `{TargetFile, CodeContent, Overwrite:true, Description, toolAction, toolSummary}` with the full new content |
| `pre-write_to_file-append.json` | PreToolUse `write_to_file` | `Append:true, Overwrite:false`: `CodeContent` is only the appended text |
| `post-write_to_file.json` | PostToolUse `write_to_file` | same as Pre plus `"error":""` |
| `pre-replace_file_content.json` | PreToolUse `replace_file_content` | `{TargetFile, TargetContent, ReplacementContent, StartLine, EndLine, AllowMultiple, Instruction, Description, …}` |
| `pre-replace_file_content-multiline.json` | PreToolUse `replace_file_content` | two non-adjacent changes sent as one multi-line chunk (lines 2–4) |
| `pre-run_command.json` | PreToolUse `run_command` | `{CommandLine, Cwd, WaitMsBeforeAsync, toolAction, toolSummary}` |
| `post-run_command.json` | PostToolUse `run_command` | plus `"error":""` (no command output in the payload) |
| `stop.json` | Stop | `executionNum:0`, `fullyIdle:true`, `terminationReason:"NO_TOOL_CALL"`, `error:""` |
| `stop-reentry.json` | Stop | after a Stop hook returned `{"decision":"continue"}`: `executionNum:1` (the `stop_hook_active` equivalent) |
| `pre-invoke_subagent.json` | PreToolUse `invoke_subagent` | parent delegating: `Subagents:[{TypeName, Role, Prompt, Model, Workspace}]` |
| `pre-write_to_file-subagent.json` | PreToolUse `write_to_file` inside a subagent | the subagent's own `conversationId` and `brain/` dir; no parent-id field |
| `pre-send_message-subagent.json` | PreToolUse `send_message` inside a subagent | `Recipient` = parent conversationId (the only parent link) |
| `stop-parent-not-idle.json` | Stop (parent) | `fullyIdle:false` while the subagent is still running |

## agy 1.5.3 (captured 2026-11-10)

`agy` **1.5.3**, macOS arm64, model `gemini-4-argon-medium`, same headless mode and isolation as above, project hook with matcher `"*"`. The envelope adds `cwd`, `hookEventName`, `lastUserInput`, `modelName` and `toolCall.id`. The edit tools have new names and argument names, and `run_command` sends no `Cwd`.

| File | Event | What it shows |
|---|---|---|
| `pre-write_file.json` | PreToolUse `write_file` | create: `{Path, Content, Overwrite:true}` with the full content |
| `post-write_file.json` | PostToolUse `write_file` | same as Pre plus `"error":""` |
| `pre-edit_file.json` | PreToolUse `edit_file` | `{Path, Target, Replacement}`: one exact replacement, no range and no `AllowMultiple` |
| `pre-read_file.json` | PreToolUse `read_file` | `{Path}` |
| `pre-run_command-top-cwd.json` | PreToolUse `run_command` | `{CommandLine, WaitMsBeforeAsync, toolSummary}`; the directory is the envelope's `cwd` |
| `stop-top-cwd.json` | Stop | the 1.2.14 fields plus `cwd` and `hookEventName` |

Not captured in 1.5.3: `create_file`, `delete_file`, `rename_file` and `notebook_edit`, which the binary names; PreInvocation; what `edit_file` does when `Target` is missing or repeated.

## Not captured

- **`multi_replace_file_content`**: in 1.2.14 the tool is rejected with `unknown tool: "multi_replace_file_content"`.
  The model said its only file tools were `write_to_file`, `replace_file_content` and `generate_image`.
- There are no delete or move tools. Deletes and moves go through `run_command`.
- `send_command_input` (stdin to a running command) and `generate_image`.
- `PostToolUse` for a call that a hook denied: it does not fire.
