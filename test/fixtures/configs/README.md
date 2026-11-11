Real configs from the author's machine (2026-10-02), read-only, with the home folder rewritten to
`/Users/user`. The register tests run against them, because what must stay untouched is exactly what
other tools write there.

- `claude-settings.json`: `hooks` of `~/.claude/settings.json` as written by Orca (every event) and
  gstack (a Stop group with an extra `_gstack_source` key). The other top-level keys are stand-ins.
- `codex-hooks.json`: `~/.codex/hooks.json` as written by Orca, byte for byte.
- `codex-config.toml`: the shape of `~/.codex/config.toml` (quoted dotted tables, `[hooks.state]`
  for ArkGate projects, a bundled plugin and Orca); the hashes are stand-ins.
- `grok-config.toml`: the head of `~/.grok/config.toml`, with a multi-line array.
- `gemini-config.json`: `plugins` of `~/.gemini/config/config.json`.
- `opencode.json`: `~/.config/opencode/opencode.json` with Orca's status plugin; setup must add its
  own `plugins` entry and leave that one alone.
- `arkgate/`: the per-repo hooks ArkGate writes (`.claude/settings.json`, `.codex/hooks.json`).

cmux registers only in `~/.grok/hooks/`, a file PREGATE never writes (MULTI-HARNESS MH-04).
