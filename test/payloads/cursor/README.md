# Cursor CLI hook payloads (real)

These are the exact bytes that Cursor CLI hooks received on stdin, changed only by the sanitization listed
below. Like Grok, **Cursor sends compact JSON with no trailing newline**. The keys are snake_case and
`hook_event_name` is lowerCamel (`preToolUse`, not `PreToolUse`).

## Source

- `cursor-agent` **2026.09.26-dd393fe** on macOS arm64, captured 2026-10-02.
- Headless runs used `cursor-agent -p --trust --force --model <m> --output-format stream-json "<prompt>"`.
  Models: `auto` (it routed to a Claude model, with `toolu_…` ids) and `gpt-5.3-codex-low` (`call_…\nfc_…`
  ids, and `ctc_` for apply_patch-style edits). Stop and beforeSubmitPrompt fire only in interactive mode,
  so they were captured from an interactive session in a pty: `cursor-agent --trust --force --model auto "<prompt>"`.
- Isolation: `HOME=<tmp>/fakehome`, with `<tmp>/fakehome/Library/Keychains` symlinked to the real login
  keychain so the session could authenticate. Cursor stores its credentials in the macOS keychain, not under
  `~/.cursor`. The user's real `~/.cursor`, `~/.claude` and their hooks were not read by the runs and were
  not written.
- Hooks: a capture script (`cat > file; env > file; printf '{}'`) was registered in four places:
  `<repo>/.cursor/hooks.json` (every event), `<fakehome>/.cursor/hooks.json` (preToolUse),
  `<repo>/.claude/settings.json` (PreToolUse `*`, Stop) and `<fakehome>/.claude/settings.json`
  (PreToolUse `Write|Edit|Bash`). **For a given call, all four received identical Cursor-shaped stdin.**
  The Claude-format hooks did not get a Claude-shaped payload.
- Sanitized: repo → `/home/user/project`, fake `HOME` → `/home/user`, transcript slug →
  `home-user-project`, email → `user@example.com`. Each UUID → `00000000-0000-4000-8000-0000000000NN`,
  numbered in order of first appearance across the files. `toolu_…` → `toolu_01CAPTURE…`.
  GPT ids keep their shape, `call_CAPTURE…\nfc_CAPTURE…` or `\nctc_…`, including the literal newline
  inside `tool_use_id`. Hook script paths → `/home/user/hooks/…`.

## Files

| File | Event / tool | What it shows |
|---|---|---|
| `session-start.json` | sessionStart | `is_background_agent`, `transcript_path: null`, no `cwd` |
| `pre-read-edit-probe.json` | preToolUse `Read` | The edit tool reads the target first. This shares its `tool_use_id` with the `Write` that follows. On a new file it is followed by postToolUseFailure "File not found" |
| `pre-write-create.json` | preToolUse `Write` | Creating a file: `{file_path, content}` with the **whole file** |
| `pre-write-strreplace.json` | preToolUse `Write` | **A str_replace edit (afterFileEdit shows old/new) arrives as `Write` with the whole resulting file** |
| `pre-write-applypatch-gpt.json` | preToolUse `Write` | GPT-5.3-codex changed line 3 of a 5-line file. It arrives as `Write` with **the whole 5-line resulting file**, not a patch |
| `pre-delete.json` | preToolUse `Delete` | `{file_path}` |
| `pre-shell.json` | preToolUse `Shell` | `{command, cwd: "", timeout: 30000}`, plus top-level `cwd: ""`. An empty cwd means the workspace root |
| `pre-task.json` | preToolUse `Task` | Subagent launch: `{description, prompt, model, subagent_type, run_in_background}` |
| `pre-write-subagent.json` | preToolUse `Write` inside a subagent | Same key set. `conversation_id`/`session_id` are the **child's**, with **no parent or subagent marker** |
| `claude-import-pre-write.json` | preToolUse `Write` delivered to a hook declared in `.claude/settings.json` | Byte-identical to the native one: Cursor shape, `tool_name: "Write"`, `hook_event_name: "preToolUse"` |
| `before-shell-execution.json` | beforeShellExecution | `{command, cwd: "", sandbox: false}` |
| `after-shell-execution.json` | afterShellExecution | `output`, `duration`, `sandbox` |
| `before-read-file.json` | beforeReadFile | `content` (whole file), `file_path`, `attachments` |
| `after-file-edit-create.json` | afterFileEdit | `edits: [{old_string: "", new_string: <whole file>}]` |
| `after-file-edit-strreplace.json` | afterFileEdit | `edits: [{old_string, new_string}]`, the line only, no trailing newline |
| `after-file-edit-applypatch-gpt.json` | afterFileEdit | Same old/new shape for the GPT patch edit |
| `post-tool-use-write.json` | postToolUse `Write` | `tool_output` is a JSON **string** `{"file_path","success":true}`, plus `duration` |
| `post-tool-use-failure-read.json` | postToolUseFailure `Read` | `error_message`, `failure_type: "error"`, `is_interrupt` |
| `post-tool-use-failure-denied.json` | postToolUseFailure `Write` | After a hook deny: `failure_type: "permission_denied"`, `error_message` = the deny text |
| `before-submit-prompt.json` | beforeSubmitPrompt (interactive only) | `prompt`, `attachments` |
| `stop.json` | stop (interactive only) | `status: "completed"`, `loop_count: 0`, token counts. No `stop_hook_active` |
| `stop-loop1.json` | stop after a `followup_message` | `loop_count: 1` |
| `session-end.json` | sessionEnd | `reason`/`final_status: "completed"`, `duration_ms` |
| `deny-matrix.observed.json` | — | Tool results from the stream for 19 hook behaviours: exit codes, JSON shapes, timeouts, failClosed. `result.error.modelVisibleError` / `result.rejected.reason` is **the exact text the model received**. The ~12 KB case is shortened here and was delivered whole |
| `hook-env-pre-tool-use.txt` | — | Environment that Cursor injects into hooks, and the cwd of each hook source |

Every payload carries `conversation_id`, `generation_id`, `model`, `session_id`, `hook_event_name`,
`cursor_version`, `workspace_roots`, `user_email` and `transcript_path` (null until the transcript exists).
File paths are absolute. Write and Delete payloads carry **no top-level `cwd`**.

## 2026.11.11 capture (`*-1111.json`)

- `cursor-agent` **2026.11.11-043ef28** on macOS arm64, captured 2026-11-11, model `auto`. Headless runs used
  `cursor-agent -p --trust --force --approve-mcps --model auto --output-format stream-json "<prompt>"`; `stop` and the
  deny came from an interactive session in a pty.
- Isolation as above: temporary `HOME` with the keychain symlink. Hooks: a capture script registered for every agent
  hook of Cursor's documentation in `<repo>/.cursor/hooks.json`, and for PreToolUse (with the shared matcher of
  MULTI-HARNESS MH-22), Stop, SubagentStop and SessionStart in `<repo>/.claude/settings.json`. The project declared a
  stdio MCP server (`/home/user/hooks/mcp.ts`) whose one tool, `write_note`, writes a file.
- Sanitized as above; UUIDs continue the numbering at `…0b`, `toolu_…` ids at `…0008`.

| File | Event / tool | What it shows |
|---|---|---|
| `session-start-1111.json`, `stop-1111.json` | sessionStart, stop | Same envelope as 2026.09.26 |
| `pre-write-strreplace-1111.json`, `pre-write-create-1111.json` | preToolUse `Write` | A str_replace edit and a creation still arrive as the whole resulting file |
| `pre-write-subagent-1111.json` | preToolUse `Write` in a subagent | The subagent's own `session_id`, no parent marker |
| `pre-task-1111.json`, `post-tool-use-task-1111.json` | preToolUse / postToolUse `Task` | The parent's `postToolUse` names the subagent as `agentId` |
| `pre-shell-1111.json`, `pre-delete-1111.json` | preToolUse `Shell`, `Delete` | Unchanged shapes |
| `pre-mcp-1111.json` | preToolUse `MCP:write_note` | MCP tools reach preToolUse as `MCP:<tool>` with object arguments |
| `claude-import-pre-mcp-1111.json` | preToolUse via `.claude/settings.json` | The shared matcher reaches `MCP:write_note`: `write` matches as a substring |
| `before-mcp-execution-1111.json`, `after-mcp-execution-1111.json` | beforeMCPExecution, afterMCPExecution | String `tool_input`, `mcp_server_name`, the stdio `command` |
| `after-file-edit-strreplace-1111.json` | afterFileEdit | Fired for `Write` edits only (none for Delete, Shell or MCP) |
| `post-tool-use-failure-denied-1111.json` | postToolUseFailure | After a JSON deny with `user_message` and `agent_message`: `error_message` is the `user_message`, which is also what the model read |
| `hook-env-pre-tool-use-1111.txt` | — | Environment of a project hook; it runs from the workspace root |

Also observed and not kept as files: `subagentStart` and `subagentStop` did not fire, headless or in a pty, natively or
through the imported `SubagentStop`; `preCompact` did not fire. A foreign native `preToolUse` answering
`{"permission":"allow"}` beside a Claude-format deny from `.claude/settings.json`: the deny won and the file was not
written. A native `preToolUse` with `failClosed: true` that printed nothing blocked the tool. The project registration
now prints `{"permission":"allow"}` for a call it does not block, and it sets `failClosed`. That allow was not re-run
in a Cursor session.

## Not captured

Not captured in 2026.09.26: subagentStart/subagentStop (they did not fire for a Task subagent in the CLI),
beforeMCPExecution, preCompact, afterAgentResponse, `Write` payloads above a few hundred bytes, NotebookEdit,
and any edit tool other than the three shapes above. In 2026.09.26 every file mutation that was observed
reached preToolUse as either `Write` (whole resulting content) or `Delete`.
