# Hook payloads

Contract inputs for `claude.test.ts`. Each file is the exact stdin a hook received, byte for byte
(compact JSON plus one trailing newline, as Claude Code sends it), except for the sanitization below.

## Source

- Claude Code **2.1.287**, macOS arm64, captured 2026-10-01 with `claude -p … --permission-mode acceptEdits`
  in a scratch git repo whose `.claude/settings.json` registered `PreToolUse` (matcher `*`), `Stop` and
  `SessionStart` hooks that stored stdin verbatim. The `Stop` hook blocked once so the second `Stop`
  arrives with `stop_hook_active: true`.
- Sanitized: repo path → `/home/user/project`, user home → `/home/user`, session/prompt ids →
  `00000000-0000-4000-8000-0000000000xx`, `tool_use_id` → `toolu_01CAPTURE…`, `agent_id` → `a0000000000000001`.

| File | Event | What it shows |
|---|---|---|
| `session-start.json` | SessionStart | `source: "startup"`; no `prompt_id`, `permission_mode` or `effort` |
| `pre-write.json` | PreToolUse `Write` | `{file_path, content}` |
| `pre-edit.json` | PreToolUse `Edit` | `replace_all: false` is sent even when the model did not set it |
| `pre-edit-replace-all.json` | PreToolUse `Edit` | `replace_all: true` |
| `pre-edit-empty-old.json` | PreToolUse `Edit` | `old_string: ""` on a file that did not exist; the tool then **created** it |
| `pre-bash.json` | PreToolUse `Bash` | `{command}` only |
| `pre-monitor.json` | PreToolUse `Monitor` | `{description, timeout_ms, command}`; captured in a separate session with a `Monitor` matcher |
| `pre-write-subagent.json` | PreToolUse `Write` from a subagent | adds `agent_id` and `agent_type` |
| `subagent-start.json` | SubagentStart | Claude Code **2.1.322**, captured 2026-11-11 with a hook that stored stdin while a `general-purpose` subagent started. `agent_id`, `agent_type` and `prompt_id`; no `source`, `permission_mode` or `effort` |
| `stop.json` | Stop | `stop_hook_active: false`, plus `last_assistant_message`, `background_tasks`, `session_crons` |
| `stop-reentry.json` | Stop | `stop_hook_active: true` |
| `grok-pre-write.fabricated.json` | — | **Not captured.** Built from `docs/research/harnesses-grok-2026-10-01.json` (camelCase keys plus snake_case aliases, `toolInputTruncated`); `timestamp` format is a guess |

Not captured: `MultiEdit` (no such tool is offered in 2.1.287), `PowerShell`, `NotebookEdit`.
