# OpenCode payloads

The OpenCode plugin, `assets/opencode/pregate/index.ts`, normalizes each hook into the JSON below and
runs `pregate hook <event> --harness opencode`. The files in this directory, except `capture/`, are
that payload.

The base files are written by hand from `@opencode/plugin@2.2.7` (`dist/promise/tool.d.ts`,
`dist/promise/session.d.ts`) and from the fields the plugin sends. `pre-codemode-*.json` are the
plugin envelopes of the OpenCode 2.4.0 captures in `capture/`. `VERIFIED` stays `2.2.7`, the CLI
those base payloads were written against. Code mode children start at `CODEMODE_SINCE` (`2.4.0`).

What the API fixes:

- `execute.before` carries `tool` (name), `id` (`Tool.CallID`), `sessionID`, `agent` and `input`.
  From 2.4.0 it also carries `codemode` (boolean) and `info` (the tool definition). A throw rejects
  that call alone; its message reaches the model.
- On 2.4.0, with `OPENCODE_FLAGS=full_codemode`, a tool call inside an `execute` script is its own
  `execute.before`. The script has `codemode: false`. Each child has `codemode: true` and its own id.
  `write` and `edit` name the file `path`. A shell child may omit `workdir`; the plugin fills it
  from the session directory.
- `execute.after` carries the same fields plus `status` and, when completed, `result`.
- `experimental.idle` carries `sessionID` and `background` only.
- `ctx.location.directory` is the session directory. `ctx.app.version` is the CLI version. The plugin
  fills `cwd` from the directory, resolves a relative `filePath`, `path` or `workdir` against it,
  and sends `codemode` (only when it is a boolean) and `opencode_version`.
- `agent` is sent as `agent_id`. `stop_hook_active` counts the Stop blocks the plugin itself sent.

What the adapter does with that:

- At `opencode_version` >= 2.4.0 with a boolean `codemode`, the `execute` script is not a file change.
  Each child call is judged as a write, edit or shell. Below 2.4.0, or when the version or a boolean
  `codemode` is missing, the script stays `cannot-reconstruct`.
- `automation_create` with `action.type` `shell` is `shell-admin`. OpenCode runs that command later
  without another `execute.before`. Any other automation stays `payload-unrecognized`.

What no capture proves `[E2E]`:

- That the message of a throw reaches the model, and that `execute.after` content does.
- That `session.instructions.entry.put` reaches the model before the next request.
- That `session.synthetic` continues the turn after a Stop block.

The deny dialect is the Codex one: exit 2, empty stdout, the full text on stderr. Advice, the
session-start briefing and the Stop reply use stdout, which the plugin reads itself.
