# OpenCode 2.2.7: the contract this adapter was built on

Verified on 2026-11-11 against `opencode v2.2.7` on macOS (arm64), from the published package
`@opencode/plugin@2.2.7` (`dist/promise/*.d.ts`) plus runtime probes with `opencode run --standalone`.
Markers: **[V]** verified here, **[E2E]** not verified and left to a real session with model credit.

## Shape

- A plugin is a module with `export default { id, setup }`. `setup(ctx)` may return a cleanup function. **[V]** A plain object loads; `@opencode/plugin` is not required and is not imported by the shim.
- `ctx.tool.hook(name, cb)` and `ctx.session.hook(name, cb)` return a registration. **[V]** Both exist and accept an `async` callback.
- `ctx.location.directory` is the session directory (absolute). **[V]**
- `ctx.session.instructions` is a value, not a function: `{ entry: { list, put, remove } }`. **[V]** `put` takes `{ key, value }`; the server keeps it under `api/<key>` and renders it into the request.
- `ctx.session.synthetic` exists in `SessionDomain`. **[V]** `session.synthetic({ sessionID, text })` is the documented way for an idle hook to admit a message instead of going idle.

## Hooks the shim uses

| Hook | Shape | Use |
| --- | --- | --- |
| `tool.hook("execute.before")` | `{ tool, sessionID, agent, messageID, id, input }`; from 2.4.0 also `codemode` (boolean) and `info` (the tool definition); `input` mutable **[V]** | the pre event |
| `tool.hook("execute.after")` | the same plus `status` and `result` **[V]** | the advice |
| `session.hook("prompt")` | `{ sessionID, messageID, prompt, metadata?, delivery }` **[V]** | the briefing |
| `session.hook("experimental.idle")` | `{ sessionID, background }` **[V]** | the Stop |

A throw from `execute.before` fails that call alone; the package documents that only `execute.before`
may reject a call. **[V: the constraint. E2E: that the message reaches the model.]**

## Loading

- `~/.config/opencode/plugins/*.ts` is **not** loaded in 2.2.7, and `opencode plugin list` shows nothing
  for a config without a `plugins` entry. **[V]** Two probes: a plugin folder under `plugins/` produced
  no side effect; the same folder named by `plugins` ran `setup` and wrote the marker file.
- `plugins` in `opencode.json` takes absolute paths; a folder holding `index.ts` is imported. **[V]**
  `OPENCODE_CONFIG_DIR` relocates the config home; `OPENCODE_CONFIG` names one file.
- `plugin list` reads a running background service, so it can ignore a new config. The load check is a
  side effect in `setup`, not `plugin list`. **[V]**

## Tools and payloads

An earlier probe of `ctx.tool.list()` in a configured session reported: `patch`, `edit`, `glob`,
`grep`, `read`, `write`, `shell`, `skill`, `subagent`, `webfetch`, `websearch`, `question`,
`experimental_image_generate` and the `opencode_*` management tools. A later probe at `setup` time,
with no model credit left, reported only the plugin-contributed `patch`, so **the exact name set is
not settled**. The observed input keys on 2.2.7 are `write {filePath, content}`, `edit {filePath, oldString,
newString, replaceAll?}`, `patch {patchText}`, `shell {command, workdir?, timeout?, background?}`.
On 2.4.0, `write` and `edit` name the file `path` (captured). The adapter accepts either key, and
refuses a call that sends both.

`patch` accepts the Codex `*** Begin Patch` grammar with an optional `*** Environment ID:` header. **[V]**

The adapter is a **closed set** on purpose: a name it does not know is refused as
`payload-unrecognized`, which fails that call and tells the user. So a built-in tool whose name differs
from the list above is denied until a release adds it. That is the fail-closed direction, and it is
also the reason the list lives in one place (`src/harness/opencode.ts`).

`execute` is code mode: one call runs a script that may call tools itself. No hook of 2.2.7 sees those
nested calls, so below 2.4.0 the adapter still denies the script as `cannot-reconstruct`. OpenCode
2.4.0 fires `execute.before` again for each tool call inside the script, with its own call id and
`codemode: true`. **[V, captured 2026-11-23, opencode 2.4.0, `OPENCODE_FLAGS=full_codemode`]** The
captures are in `test/payloads/opencode/capture/`. Without `full_codemode`, `write` and `shell` are
not in the script; they are direct calls. From 2.4.0 the script itself is not a file change, and each
child call is judged with the normal rules. `write` and `edit` name the file `path` on 2.4.0
(`filePath` on 2.2.7). An `automation_create` whose action is `shell` is denied: that command runs
later through `Shell.Service` and does not call `execute.before` again.

## Not verified `[E2E]`

A 2.4.0 session confirmed that a code-mode child call fires `execute.before`. These stay open, and
the shim does not depend on any of them for a deny:

1. That the text of a thrown rejection reaches the model as the tool error.
2. That `execute.after` content reaches the model.
3. That an instruction entry set during the first prompt is present in that request.
4. That `session.synthetic` continues the turn after a Stop block.

A real denial, with `PREGATE_REAL=1` and a funded workspace, closes 1 to 3; a Stop that blocks twice
closes 4.
