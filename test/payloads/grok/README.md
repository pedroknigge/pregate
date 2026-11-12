# Grok Build hook payloads (real)

Exact stdin that Grok Build hooks received, byte for byte except for the sanitization below.
Unlike Claude Code, **Grok sends compact JSON with no trailing newline**.

## Source

- Grok Build CLI **1.0.49** (`8e66fdf1fd8e`), macOS arm64, re-captured 2026-10-02.
- Headless: `grok -p "<prompt>" --trust --always-approve --no-auto-update --effort low -m grok-4.7-build-fast --output-format streaming-json`
  (`--trust` is a hidden flag that works and persists the grant to `$GROK_HOME/trusted_folders.toml`).
- Isolation: HOME, XDG_DATA_HOME, XDG_STATE_HOME, TMPDIR, CODEX_HOME and GROK_HOME
  under `/private/tmp/claude-501/pregate-022`. The real auth.json was read to copy
  credentials, with every nested refresh_token blanked; real harness homes were
  never written. A minimal config disables updates.
- Hooks: a capture script registered in `<GROK_HOME>/hooks/capture.json`.
  Stop block captured reentry. Separate runs verified explicit deny and both
  headless ask modes. No envelope or tool-input keys changed from 1.0.48.
- Sanitized: repo → `/home/user/project`, `HOME` → `/home/user` (including the URL-encoded cwd in
  `transcriptPath`), every UUID → `00000000-0000-4000-8000-0000000000NN`, assigned in order of first appearance.
  `toolUseId` keeps Grok's shape `call-<uuid>-<index in the batch>`. Timestamps and hashline anchors are real.

## Files

| File | Event / tool | What it shows |
|---|---|---|
| `session-start.json` | SessionStart | `source: "new"`. No `promptId`, `transcriptPath` or `toolName` |
| `user-prompt-submit.json` | UserPromptSubmit | `prompt`, `promptId` (= headless `requestId`) |
| `pre-write.json` | PreToolUse `write` | `{file_path, content}` = **whole file**. The model chose `write` to create the file |
| `pre-search-replace.json` | PreToolUse `search_replace` | `{file_path, old_string, new_string}`. **No `replace_all` key** when it is false (Claude always sends it) |
| `pre-search-replace-create.json` | PreToolUse `search_replace` | `old_string: ""` on a file that did not exist: the tool **created** it (another run chose this instead of `write`) |
| `pre-run-terminal-command.json` | PreToolUse `run_terminal_command` | `{command, description}` |
| `pre-hashline-read.json` | PreToolUse `hashline_read` | `{target_file}`. Only with `[toolset] file_toolset = "hashline"` |
| `pre-hashline-edit.json` | PreToolUse `hashline_edit` | `{file_path, edits:[{op:"replace", anchor:"2:ylx:ddw", content}]}`: an anchor patch, **neither whole content nor old/new** |
| `pre-spawn-subagent.json` | PreToolUse `spawn_subagent` | Parent session. `tool_input` carries `description`, `prompt` and more |
| `pre-write-subagent.json` | PreToolUse `write` inside a subagent | Adds `subagentType: "general-purpose"`. `sessionId` is the **child's** session. No `agent_id` |
| `subagent-start.json` | SubagentStart | Parent `sessionId`, plus `subagentId` (= the child's `sessionId`) and `subagentType` |
| `subagent-stop.json` | SubagentStop | Child `sessionId`, `phase: "gate"`, `stopHookActive`, `lastAssistantMessage`. The adapter decodes it as that session's Stop |
| `post-write.json` | PostToolUse `write` | `toolResult`/`tool_response` with `type: "SearchReplace"` and `old_string: ""` (write is implemented as a search_replace) |
| `post-search-replace.json` | PostToolUse `search_replace` | `toolResult.EditsApplied.edits.details[]` with line numbers |
| `post-run-terminal-command.json` | PostToolUse `run_terminal_command` | `toolResult.type: "Bash"`, `output` as a byte array, `exit_code` |
| `post-hashline-edit.json` | PostToolUse `hashline_edit` | `toolResult.EditsApplied.old_string/new_string` = **whole file before and after** |
| `stop.json` | Stop | `reason: "end_turn"`, `stopHookActive: false`, `backgroundTasks`, `sessionCrons` |
| `stop-reentry.json` | Stop | `stopHookActive: true` after a `{"decision":"block"}`. **No `stop_hook_active` (snake) alias** |
| `stop-shutdown.json` | Stop | The extra observe-only Stop at session end: `reason: "shutdown"`, no `promptId` |
| `session-end.json` | SessionEnd | `reason: "shutdown"` |
| `hook-env-pre-tool-use.txt` | — | Variables Grok injects into the hook (`GROK_HOOK_EVENT`, `GROK_HOOK_NAME`, `GROK_SESSION_ID`, `GROK_WORKSPACE_ROOT`, `CLAUDE_PROJECT_DIR`; the last two end in `/`). The rest of the environment is inherited from the process that launched `grok` |

Things common to every payload: camelCase keys (`hookEventName` carries the snake value, e.g.
`pre_tool_use`) plus snake aliases `hook_event_name` (PascalCase value), `session_id`,
`transcript_path`, `permission_mode`, `tool_name`, `tool_input`, `tool_use_id`, `tool_response`, `duration_ms`.
`workspaceRoot` has no trailing slash in these envelopes; the environment's
GROK_WORKSPACE_ROOT still has one. The adapter accepts both. **PreToolUse carries
no `promptId`**, and it has no snake alias anywhere.
`permissionMode` is `bypassPermissions` with `--always-approve` and `default` without it.

Not captured: `apply_patch` (the "codex" preset is not reachable from config in 1.0.48), toolInput
over 128 KiB (`toolInputTruncated: true`, documented only), PostToolUseFailure, PermissionDenied,
StopFailure, StopCancelled, Notification, Pre/PostCompact.

`../grok-pre-write.fabricated.json` predates this capture and its guesses are wrong. Compared with the
real thing, it lacks `transcriptPath` and has `promptId` and a `Z` timestamp. Use these files instead.
