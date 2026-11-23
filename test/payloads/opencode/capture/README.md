# OpenCode 2.4.0 code-mode captures

Captured on 2026-11-23 from the official Linux x64 `opencode` binary `v2.4.0`
(`opencode --version` printed `2.4.0`), tag `v2.4.0`. The server was
`opencode serve` with `OPENCODE_FLAGS=full_codemode`. That flag puts `write`,
`edit`, `shell`, `patch` and `read` into the Code Mode catalog. Without it those
tools are direct calls, and a script that names them does not fire a child
`execute.before`.

`app.json` is `ctx.app` plus the session directory from plugin setup:
`{ "name": "cli", "version": "2.4.0", "channel": "latest" }`. The version is not
a field of the hook input. Pregate's plugin reads it from `ctx.app.version`.

Each other file is one `execute.before` input. `info` (the tool definition) is
omitted; its keys were `name`, `description`, `input`, `freeform`, `output`,
`execute`. The parent `execute` call has `codemode: false`. Each tool the script
called has `codemode: true` and its own call id.

- `execute-script.json` writes `src/note.txt`, runs `printf hi`, and schedules an
  automation whose action is `{ "type": "shell", "command": "printf pwned" }`.
- `child-write.json`, `child-shell.json` and `child-automation-shell.json` are
  the three calls that script made.
- `execute-shell-write.json` runs `printf 'n\n' > notes.txt`.
- `child-shell-write.json` is that shell call. `notes.txt` is outside the default source
  scope, so the shell guard does not treat it as a project write.
- `execute-shell-src.json` runs `printf 'n\n' > src/a.ts`.
- `child-shell-src.json` is that shell call. `src/a.ts` is in scope, so an enabled
  project denies it as `shell-write`.

OpenCode approves a shell automation once, at creation, and later runs it with
`Shell.Service`. That run does not call `execute.before` again. The adapter
denies the create call.

The files next to this directory (`pre-codemode-*.json`) are the payloads
`assets/opencode/pregate/index.ts` sends for these inputs: a relative `path` and
a missing `workdir` are resolved against the session directory, and `codemode`
plus `opencode_version` are added.
