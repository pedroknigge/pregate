# OpenCode payloads

The OpenCode plugin, `assets/opencode/pregate/index.ts`, normalizes each hook into the JSON below and
runs `pregate hook <event> --harness opencode`. These files are that payload, not a capture of the
OpenCode process: they are written by hand from `@opencode/plugin@2.2.7`
(`dist/promise/tool.d.ts`, `dist/promise/session.d.ts`) and from the fields the plugin sends.

What the API fixes:

- `execute.before` carries `tool` (name), `id` (`Tool.CallID`), `sessionID`, `agent` and `input`.
  A throw rejects that call alone; its message reaches the model.
- `execute.after` carries the same fields plus `status` and, when completed, `result`.
- `experimental.idle` carries `sessionID` and `background` only.
- `ctx.location.directory` is the session directory; the plugin fills `cwd` from it, and resolves a
  relative `filePath` or `workdir` against it, because the engine reads absolute paths only.
- `agent` is sent as `agent_id`. `stop_hook_active` counts the Stop blocks the plugin itself sent.

What no capture proves `[E2E]`:

- That OpenCode runs `execute.before` for every tool call, including the nested calls of the `execute`
  (code mode) tool. The adapter denies `execute` in an enabled project until that is proven.
- That the message of a throw reaches the model, and that `execute.after` content does.
- That `session.instructions.entry.put` reaches the model before the next request.
- That `session.synthetic` continues the turn after a Stop block.

The deny dialect is the Codex one: exit 2, empty stdout, the full text on stderr. Advice, the
session-start briefing and the Stop reply use stdout, which the plugin reads itself.
