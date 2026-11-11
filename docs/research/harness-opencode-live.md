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
| `tool.hook("execute.before")` | `{ tool, sessionID, agent, messageID, id, input }`; `input` mutable **[V]** | the pre event |
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
not settled**. The observed input keys are `write {filePath, content}`, `edit {filePath, oldString,
newString, replaceAll?}`, `patch {patchText}`, `shell {command, workdir?, timeout?, background?}`; the
schemas were not readable from `tool.list()` in the later probe, so these keys come from the earlier
one. **[E2E: the exact key set of each built-in tool.]**

`patch` accepts the Codex `*** Begin Patch` grammar with an optional `*** Environment ID:` header. **[V]**

The adapter is a **closed set** on purpose: a name it does not know is refused as
`payload-unrecognized`, which fails that call and tells the user. So a built-in tool whose name differs
from the list above is denied until a release adds it. That is the fail-closed direction, and it is
also the reason the list lives in one place (`src/harness/opencode.ts`).

`execute` is code mode: one call runs a script that may call tools itself. No hook of 2.2.7 sees those
nested calls. **[E2E: whether they reach `execute.before`]** The adapter denies `execute` in an enabled
project until that is known.

## Not verified `[E2E]`

No model call reached this machine: `opencode run --standalone` answered "Insufficient balance". So
these stay open, and the shim does not depend on any of them for a deny:

1. That the text of a thrown rejection reaches the model as the tool error.
2. That `execute.after` content reaches the model.
3. That an instruction entry set during the first prompt is present in that request.
4. That `session.synthetic` continues the turn after a Stop block.
5. Whether a code-mode nested write fires `execute.before`.

A real denial, with `PREGATE_REAL=1` and a funded workspace, closes 1 to 3; a Stop that blocks twice
closes 4; a prompt that asks for one file written from a code-mode script closes 5.
