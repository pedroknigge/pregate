# Codex CLI hook payloads

Contract inputs for the Codex adapter. Each file is the exact stdin a hook received, byte for byte
(compact JSON, **no trailing newline**: verified with a raw `cat > file` capture), except for the
sanitization below.

## Source

- Codex CLI **0.159.2** (`codex-cli 0.159.2`, standalone release `0.159.2-aarch64-apple-darwin`), macOS arm64,
  model `gpt-6.1-sol`, captured 2026-10-02.
- Headless: `codex exec --json -s workspace-write "<prompt>" < /dev/null`, with `CODEX_HOME` pointing to a
  scratch copy that held only `auth.json` and a two-line `config.toml`. The user's real `~/.codex` was not touched.
- Hooks were registered for every event with matcher `"*"` and a script that stored stdin verbatim:
  - session 2 (`*-add-update`, `pre-bash`, `post-bash`): project-level `<repo>/.codex/hooks.json`, run with
    `--dangerously-bypass-hook-trust`;
  - sessions 1, 3 and 4: user-level `$CODEX_HOME/hooks.json`, trusted through the app-server API
    (`hooks/list` + `config/batchWrite`), run **without** any bypass flag.
- In session 4 the `Stop` hook blocked once (`{"decision":"block","reason":…}`), so the second `Stop` arrives
  with `stop_hook_active: true`.
- Sanitized: repo path → `/home/user/project`; `CODEX_HOME` → `/home/user/.codex`; rollout timestamp →
  `2026-10-02T00-00-00`; `session_id` → `00000000-0000-4000-8000-0000000000NN` (NN = capture session);
  `turn_id` → `…-a000000000NNxx`; subagent `agent_id` → `…-b000000000NNxx`; `exec-<uuid>` tool ids →
  `exec-…-c000000000NNxx`; `call_…` ids → `call_CAPTURENN00000000xx`; the encrypted `spawn_agent` message →
  `gAAAAA_REDACTED_ENCRYPTED_SPAWN_MESSAGE`. Key order and everything else is untouched.

## Files

| File | Event | Tool | What it shows |
|---|---|---|---|
| `session-start.json` | SessionStart | — | `source: "startup"`, `model`, `permission_mode`; no `turn_id` |
| `user-prompt-submit.json` | UserPromptSubmit | — | `prompt` (full text), `turn_id` |
| `pre-apply-patch-add-update.json` | PreToolUse | `apply_patch` | ONE patch touching two files: `*** Add File:` + `*** Update File:` with a bare `@@` hunk. Paths are **absolute** |
| `post-apply-patch-add-update.json` | PostToolUse | `apply_patch` | `tool_response` is a string: `Exit code: 0\nWall time…\nOutput:\nSuccess. Updated the following files:\nA …\nM …\n` |
| `pre-apply-patch-move.json` | PreToolUse | `apply_patch` | `*** Update File:` + `*** Move to:` + hunk (rename and edit) |
| `post-apply-patch-move.json` | PostToolUse | `apply_patch` | reports only `M <new path>` for a move |
| `pre-apply-patch-delete.json` | PreToolUse | `apply_patch` | `*** Delete File:` (no body) |
| `pre-bash.json` | PreToolUse | `Bash` | `tool_input` is `{command}` only, the raw command (no `zsh -lc` wrapper, no workdir/timeout) |
| `post-bash.json` | PostToolUse | `Bash` | `tool_response` is the plain output string |
| `pre-bash-redirect-write.json` | PreToolUse | `Bash` | The model created a file with `printf 'n\n' > n.txt` on a neutral prompt ("create a file …"): shell writes are a primary path, not an edge case |
| `pre-spawn-agent.json` / `post-spawn-agent.json` | Pre/PostToolUse | `collaborationspawn_agent` | subagent creation; `tool_use_id` is `call_…` (not code-mode) |
| `pre-wait-agent.json` | PreToolUse | `collaborationwait_agent` | `{timeout_ms}` |
| `subagent-start.json` | SubagentStart | — | `agent_id`, `agent_type: "default"`; `transcript_path` is the **subagent's** rollout |
| `pre-apply-patch-subagent.json` | PreToolUse | `apply_patch` | from inside the subagent: same `session_id` as the parent, adds `agent_id` + `agent_type`, `transcript_path` is the subagent rollout |
| `subagent-stop.json` | SubagentStop | — | `agent_transcript_path`, `last_assistant_message`, `stop_hook_active` |
| `stop.json` | Stop | — | `stop_hook_active: false`, `last_assistant_message` |
| `stop-block-first.json` | Stop | — | first Stop of session 4 (the hook blocked it) |
| `stop-reentry.json` | Stop | — | after the block: `stop_hook_active: true` |
| `session-end.json` | SessionEnd | — | `reason: "other"`; only `session_id`, `transcript_path`, `cwd`, `hook_event_name` (no `model`, no `permission_mode`). Default timeout for this event is 1 s |

Notes:

- `permission_mode` is `"bypassPermissions"` in every `codex exec` capture, even with `-s read-only -c approval_policy="on-request"`. Do not infer anything from it.
- `tool_use_id` is `exec-<uuid>` when the tool was called from code mode (the model's `exec` JS tool calling `tools.apply_patch(...)`, the default in 0.159.2 because `code_mode_host` is stable/on), and `call_<24 chars>` for direct tool calls.

## Codex 0.166.0

Captured 2026-11-02 from Codex CLI **0.166.0** (`codex-cli 0.166.0`, `codex-x86_64-unknown-linux-musl`, release `rust-v0.166.0` published 2026-10-29) on Linux x64. The model was a local Responses API stand-in addressed as `gpt-5.5` (a catalog slug whose `apply_patch` tool is freeform and whose shell tool is `exec_command`). `code_mode_host` was disabled so the tools were called directly. Hooks were user-level `$CODEX_HOME/hooks.json` with `--dangerously-bypass-hook-trust` and `--dangerously-bypass-approvals-and-sandbox`. No account credentials were used.

openai/codex#57198 (and #57203 for permission and post-tool hooks) puts the command's resolved workdir in `cwd`. The hook process itself still starts in the session directory. There is still no `workdir` key on `tool_input`, and no version field, so a 0.159.2 payload has the same shape. Payloads here were captured on 0.166.0; **0.167.0 is the minimum supported release** (`src/harness/codex.ts`): 0.166.x and older report the session directory in `cwd` on some paths and direct Guardian review skipped PreToolUse hooks (openai/codex#58368).

| File | Event | What the real process did |
|---|---|---|
| `session-start-166.json` | SessionStart | `cwd` is the session directory (`/tmp/.../repo`). The hook process cwd was the same directory |
| `pre-bash-workdir-nested.json` | PreToolUse `Bash` | `exec_command` with relative `workdir` `nested` and `printf 'n\\n' > notes.txt`. Payload `cwd` is the resolved directory `.../repo/nested`. The file was created there. The hook process cwd stayed the session directory |
| `pre-bash-workdir-outside.json` | PreToolUse `Bash` | `workdir` was an absolute path outside the repo. Payload `cwd` is that path. `out.txt` was created there. The hook process cwd stayed the session directory |
| `pre-apply-patch-166.json` | PreToolUse `apply_patch` | Freeform `apply_patch` adding `nested/added.txt` and updating `marker.txt`. Payload `cwd` stayed the session directory (apply_patch sets no tool cwd). Both files changed |
| `stop-166.json` | Stop | `cwd` is the session directory, `stop_hook_active: false` |

Sanitized the same way as the 0.159.2 captures: repo → `/home/user/project`, the outside directory → `/home/user/outside`, `CODEX_HOME` → `/home/user/.codex`, rollout timestamp → `2026-11-02T00-00-00`, `session_id` / `turn_id` → stable ULID-shaped ids (0.166 session ids are not UUIDs). The direct `call_*` tool ids are the ones this capture sent; they are not secrets. Compact JSON, no trailing newline.

Not captured: `PermissionRequest` (`codex exec` never asks: "Escalation is unavailable in this session"),
`PreCompact`/`PostCompact`, `Interrupt`, MCP tools, `write_stdin`, a relative path inside `apply_patch`
(the model always wrote absolute paths), `*** End of File`, multi-hunk `@@ <context>` headers.
