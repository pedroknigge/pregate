# PREGATE on five harnesses, installed once

**Current implementation references:** [commands/options](CLI.md),
[approval routes](features/approval-in-harness.md), [capability guarantees](features/harness-and-shell-guarantees.md)
and [v0.0.1 release notes](releases/0.0.1.md). The dated protocol/design and acceptance records
below describe their specific candidates. Current proposals can be reviewed and
approved with an exact human `!` command inside supported harness shell input;
they do not require an external-terminal round trip. Replay/native smoke is
distinct from current real harness interaction evidence.

**Status:** design to build (2026-10-02), reviewed in two adversarial reviews (fail-open and simplicity; §9 says what was applied and what was discarded). Implements D20: Codex CLI, Claude Code, Cursor (`cursor-agent`), Grok Build, and Antigravity (`agy`), with a global install, no per-repo configuration, plus update and uninstall.

**Sources of truth.** The contracts verified live today: `docs/research/harness-{codex,cursor,grok,agy}-live.md` and `test/payloads/{codex,cursor,grok,agy}/`. The distribution pattern: `docs/research/distribution-patterns.md`. The MVP: `docs/ARCHITECTURE.md` (§10, O1–O41) and `docs/SPEC.md` §14. If this document contradicts `distribution-patterns.md`, this one wins, because it was written against the live contracts. Examples: Grok does not read `~/.cursor/hooks.json` in 1.0.48, agy uses a plugin and not `~/.gemini/config/hooks.json`, and Cursor and Grok always read `~/.claude/settings.json`, with their native payload.

0.0.7 is the published release. The notes below are the harness design. Pack counts and acceptance evidence are in [packs](packs.md) and the [changelog](../CHANGELOG.md), not in a pre-rename version number.
Under [D29/O60](ARCHITECTURE.md), human commands prompt on /dev/tty (or CONIN$ on Windows);
interactive Claude Code and agy use enforced native permissions. Codex, Cursor,
Grok and headless sessions deny contract edits and direct the human to
`pregate approve` for the expiring validated proposal. OS dialogs are removed.

**Markers.** The markers **[V]**, **[C]**, **[D]**, and **[S]** mean the same thing as in the surveys. **[E2E]** marks something that is not verified and that the real test in §6.3 must confirm before installation on the user's machine. Until it is confirmed, the option that does not depend on it is used.

**Standard.** D16 and D17: zero runtime dependencies, a pure core, and an abstraction only if it has two real uses. Each decision below states which requirement demands it.

---

## 0. Overall shape on one screen

- **Three registrations for five harnesses.** `~/.claude/settings.json` serves Claude Code, Cursor, and Grok, because Cursor and Grok always read it and pass it their native payload [V]. `~/.codex/hooks.json` serves Codex, and a global plugin serves agy. Each harness runs **exactly one** PREGATE registration, so there is no double evaluation to deduplicate (MH-04).
- **One registered command, frozen across versions** (MH-22): an inline guard that `exec`s the global launcher. If the launcher is missing, it denies only when a preset is present.
- **Global launcher** `<DATA>/bin/pregate` = the same `assets/launcher.sh` with `version=<x>`. It supervises the engine and turns every failure into exit 2 + stderr, which blocks on all five [V] (MH-15).
- **The engine chooses the profile by sniff** (MH-03), decodes, and if the repo lock pins another engine, it exits with exit 3 so the launcher re-executes it (MH-19).
- **Outside a repo with a preset:** no state, no git, and no WASM. Only the machine protections run, which prevent turning PREGATE off from any repo (MH-17).

---

## 1. Adapter contract

**MH-01. One module per harness, with pure functions and its profile as constants. There is no `profile.json` and no interpreter.**
- `src/claude.ts` moves to `src/harness/claude.ts`. `codex.ts`, `cursor.ts`, `grok.ts`, and `agy.ts` are added. What is private to `claude.ts` today and shared by several modules (`parse`, `isObject`, `keys`, `absolute`, `json`) moves to `src/harness/wire.ts`.
- Each module exports the same thing (the exact signatures are in §10.1):
  ```ts
  decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null   // null: event that is ignored
  encode(kind: HookKind, d: Decision, stop: StopState | null): Emission
  VERIFIED: string                                   // CLI version whose contract is in test/payloads/<h>/
  ```
- `Rejected` replaces the separate `fallback`: when decode fails, the same parse returns the deny channel (`kind`, `reentry`) and the envelope directories used to locate the root (`dirs`, MH-06). It is one parse per call instead of two.
- **Why A17's data is not taken.** Extracting into data was intended for the second adapter. With five, what varies from one to another is structural: a multi-file patch (Codex), protojson without an event name (agy), camelCase keys with snake aliases (Grok), and `cursor_version` (Cursor). A declarative profile cannot express that without becoming a language (DD-51 already discarded that). What is data (tool names, matchers, timeouts, limits) stays as constants at the top of each module. That is the "profile" of SPEC §14.1.5. A17 and principle 8 of ARCHITECTURE are replaced where they say "there is no harness registry": the map `HARNESSES = { "claude-code", codex, cursor, grok, agy }` lives in `main.ts`, and `main` and `doctor` use it (two uses).
- Registration (file, events, matcher, timeouts) does not live in the adapters, because three harnesses share one registration: it lives in `src/register.ts` (MH-22).

**MH-02. IDs and flag.** The IDs are `claude-code`, `codex`, `cursor`, `grok`, and `agy`. Every global registration carries `hook <event> --harness <id>`, where the event is `pre`, `stop`, or `session-start`. The shared registration in `~/.claude/settings.json` carries `--harness claude-code`, and Cursor and Grok are recognized by sniff (MH-03). agy does not send the event name in the payload, so the only thing that identifies it is argv [V]. `hook auto` remains for §13.7.

**MH-03. Detection: sniff first, then the flag.** The profile that decodes is chosen as follows:
1. **Grok**, if `GROK_HOOK_EVENT` is not empty **and** the payload has the top-level key `hookEventName`. `GROK_HOOK_EVENT` is the signal Grok reserves and always overwrites [V]. Also requiring the key covers the case where the variable leaks to another process. Neither "any `GROK_*`" (what `main.ts` does today) nor `CLAUDECODE` counts, because harnesses inherit the parent's environment [V on Codex, Grok, and agy].
2. **Cursor**, if the payload has the top-level key `cursor_version`. It is checked after `JSON.parse` and never with a grep: a Claude `Write` whose content includes `"cursor_version"` cannot change the profile. `CLAUDE_PROJECT_DIR` does not work, because Cursor also defines it [V].
3. Otherwise, the registration's `--harness`. Codex and agy are identified **only** by flag: the Codex payload has the same shape as Claude's, and agy's does not carry the event.

**MH-04. One evaluation per call, by construction.** Each harness runs a single PREGATE registration:

| Harness | Registration it runs | How the rest is discarded |
|---|---|---|
| Claude Code | `~/.claude/settings.json` | MH-28 removes the per-repo hooks from 0.1.0. A project can carry its own registration (MH-28a); with both, each call is evaluated twice |
| Cursor | `~/.claude/settings.json` imported [V] | PREGATE does not write `~/.cursor/hooks.json` |
| Grok | `~/.claude/settings.json` [V] | PREGATE does not write `~/.grok/hooks/` |
| Codex | `~/.codex/hooks.json` | does not read Claude hooks [V] |
| agy | plugin `pregate` | does not read Claude hooks [V] |

- **What is lost and why it is accepted** (U-6):
  - On Cursor, `failClosed:true`: imported entries force it to `false` [C]. What `failClosed` covered beyond the launcher is that the inline `sh` itself cannot run (exit 126/127) or that the launcher does not respond within the harness's 30 s. The launcher already turns an engine crash and hang into exit 2 + stderr, which Cursor respects [V]. It is the same residue Claude Code has had since the MVP.
  - On Grok, independence from the Claude compatibility switch (`GROK_CLAUDE_HOOKS_ENABLED=0`, `[compat.claude] hooks=false`, the `/hooks` toggle). The agent cannot touch them (MH-17, MH-29). `doctor` and the pre-commit warn if they are off (MH-27).
- **What is gained:** nothing is written to `~/.cursor/hooks.json`. That file belongs to Orca, and a schema error invalidates it entirely [C], also turning off the user's hooks. The "native registration present" probe, the imported-call concept, deduplication by `callId`, and two of five merges disappear.

**MH-05. Session per harness.**

| | `Session.id` | `turnId` | `agentId` | `callId` | Root or cwd |
|---|---|---|---|---|---|
| claude-code | `session_id` | `prompt_id` | `agent_id` | `tool_use_id` | `cwd` |
| codex | `session_id` | `turn_id` [V] | `agent_id` (subagent) [V] | `tool_use_id` + `~` + `H(tool_input.command)` (code mode shares `exec-<uuid>` across calls [V]) | `cwd` |
| cursor | `session_id` | `generation_id` (also changes per followup; Stop counts session continuity until the turn ends, see §6.4) | null (subagent = its own session [V]) | `tool_use_id` | Shell: absolute `cwd`, or `workspace_roots[0]` if `cwd` is `""` and there is **one** root; otherwise, `workspace_roots[0]` (MH-06) |
| grok | `sessionId` | null (Pre does not carry `promptId` [V]) | null (the subagent has its own `sessionId` [V]) | `toolUseId` | `cwd` |
| agy | `conversationId` | null | null (its own session [V]) | `String(stepIdx)` | `run_command.Cwd`; otherwise, `workspacePaths[0]` |

- State is indexed by `<id>:<Session.id>`, so two harnesses do not share a session by chance.
- `interactive` is `false` on every harness other than Claude Code. So `decide` never emits `ask` where it cannot be trusted: Codex treats it as fail-open [D], Cursor does not apply it [D], Grok approves it with `--always-approve` [V], and headless agy has no one to ask [S].

**MH-06. `decode` returns `HookEvent | Rejected | null`.**
- `null` is an event that is recognized and ignored, with a neutral output: today, only Grok's shutdown Stop (`reason:"shutdown"`) [V].
- `Rejected` is an envelope or a tool that is not recognized (`payload-unrecognized`), or a case that is recognized but cannot be judged (`BAD`). It carries `dirs`: the envelope directories (`cwd`, `workspace_roots`, `workspacePaths`, `workspaceRoot`, the environment project dir).
- **A contract change does not break the machine.** `main` answers "no objection" to a `Rejected` if **none** of its `dirs` reaches a root and the session registered none. Otherwise, it denies. If the envelope is not JSON or carries no directory, it always denies. Without this, a `cursor-agent update` that changes the payload would deny every write in every repo on the machine.
- **Ambiguous directory ⇒ `BAD`:** Cursor Shell with `cwd:""` and `workspace_roots` empty or with more than one element; a non-empty `cwd` that is not absolute; an agy `run_command` without `Cwd` and with `workspacePaths` empty. Today those cases would resolve against the hook cwd (`~/.claude`) and pass with no root.

---

## 2. New edit forms

**MH-07. Minimal type changes (`types.ts`).**
```ts
type Edit =
  | { form: "full"; content: string }
  | { form: "append"; text: string }                                           // agy Append
  | { form: "oldnew"; old: string; neu: string; all: boolean; lines: [number, number] | null }  // lines: agy StartLine/EndLine
  | { form: "hunks"; hunks: Hunk[] }                                           // Codex *** Update File
  | { form: "delete" }                                                         // Codex Delete, Cursor Delete
  | { form: "unknown"; cause: string };
interface Hunk { anchor: string | null; old: string[]; neu: string[]; eof: boolean }
interface ProposedChange { session; callId; tool; path; edit; from: string | null }   // from: origin of a Move
type HookEvent = … | { kind: "pre-edit"; changes: ProposedChange[] }                  // ≥ 1, one call
```
A16 is extended only with what some adapter produces today. `batchId`, `before`, and `after` are not added to the type.

**MH-08. Codex patch: its own strict, pure parser, inside `codex.ts`.**
- Grammar that is accepted [V in the captures; D for `@@ ctx` and `*** End of File`]:
  ```
  patch  := "*** Begin Patch" NL op+ "*** End Patch" [NL]
  op     := "*** Add File: " P NL ("+" L NL)*
          | "*** Delete File: " P NL
          | "*** Update File: " P NL ["*** Move to: " P NL] chunk+
  chunk  := ("@@" | "@@ " CTX) NL ((" " | "-" | "+") L NL)* ["*** End of File" NL]
  ```
- **Paths: absolute only.** A relative path ⇒ `unknown`, and the deny says "resend the patch with absolute paths". Every capture was absolute [V], and a relative path is ambiguous: Codex resolves it against the shell `workdir`, which the payload does not carry [V]. A `.`, `..`, or empty segment ⇒ `unknown`.
- What each operation produces:
  - Add ⇒ `full`, with the content = the lines joined by `\n` and a final `\n` [S; the §6.3 E2E verifies it by equality with disk].
  - Delete ⇒ `delete`.
  - Update ⇒ `hunks`.
  - Update + Move ⇒ two changes: `{path: origin, delete}` and `{path: destination, hunks, from: origin}`. The destination's "actual" is the origin's text.
- It is applied with `reconstruct.apply`: each hunk looks for its `old` sequence (the `" "` and `"-"` lines) **exactly**, from the end of the previous hunk and after the `anchor` if it has one, and at the end of the file if it carries `eof`.
- **Codex's fuzzy cascade is not ported** (trim, Unicode normalization). A hunk that does not appear exactly, or that has no `old` lines (a pure insertion, whose semantics are not verified), yields `cannot-reconstruct`: a form deny that says "resend the patch with exact context lines". The error stays on the safe side, because a text different from what Codex would write is never judged. The cost is some false denies when the context differs in whitespace; it is measured in §6.3 and in the pilot, and the cascade is ported only if it shows up.
- What does not fit the grammar (a patch wrapped in a heredoc, missing `@@`) ⇒ `unknown("patch-grammar")` ⇒ `cannot-reconstruct`. It is a deny the agent can resolve, not `payload-unrecognized`.

**MH-09. Several files per call: all are evaluated and one deny is enough.** `gate.onPreEdit(changes)` does the following:
1. Reconstructs every `after`.
2. Judges each file with an **overlaid** `Read`: the other files in the same patch are seen with their `after`, or as nonexistent if they are deleted. Without this, a patch that creates `a.ts` and imports it from `b.ts` would yield `unresolvable-import` on `b.ts`.
3. Records one `CallEvent` per file (the `callId` is shared and the `fileH` differs).
4. Combines them with `merge(decisions)`, a pure function in `decide.ts`:
   - first the one that has `halt`; otherwise, the first deny; `ask` only if every blocking one is `ask`;
   - the chosen one's `full` adds one line per other blocked file (its `compact`), within `TEXT_MAX`.

A single-file patch follows exactly today's path.

**MH-10. Deletion (Codex Delete and Cursor Delete).** Only the step-5 protections apply (and MH-17). Stop judges the rest over the tree, the same as an `rm` through the shell (§4.2: "the truth is the tree"). So a deletion of `.pregate/**` or `.git/**` is denied, and an `rm`-equivalent of an in-scope file goes to Stop, pre-commit, and CI. A Move applies this to the origin and the full evaluation to the destination. Residue: Cursor `-p` has no Stop [V], so there an in-scope Delete reaches pre-commit and CI.

**MH-11. agy forms.**
- `write_to_file`: without `Append`, it is `full` (`TargetFile` and `CodeContent`) [V]. With `Append: true`, it is `append` and `after = actual + CodeContent`, or `CodeContent` if the file does not exist [V].
- `replace_file_content` is `oldnew`, with `lines = [StartLine, EndLine]` (1-indexed and inclusive) and `all = AllowMultiple`. Exact `TargetContent` is searched for **inside the range**.
  - If it does not appear, or appears more than once without `AllowMultiple`, it is `cannot-reconstruct`: agy might do fuzzy matching [S], so it is not claimed that the tool will fail.
  - If the range is missing, the whole file is searched.
- Closed key list: besides the required ones, `Overwrite`, `Description`, `Instruction`, `TargetLintErrorIds`, `ArtifactMetadata`, `toolAction`, and `toolSummary` are accepted. Any other ⇒ `unknown`, because it can change what is written (the same criterion as with Claude).
- `multi_replace_file_content` ⇒ `unknown`: it does not exist in 1.2.14 [V] and its form is [D]. It enters when there is a capture.
- **agy 1.5.3 renamed the edit tools** [V, captured 2026-11-10]. `write_file` (`Path`, `Content`, optional `Overwrite`) is `full`. `edit_file` (`Path`, `Target`, `Replacement`) is `oldnew` over the whole file with `all = false`; a `Target` that is missing or repeated is `cannot-reconstruct`, because what agy does with it is not verified. Any other argument on either tool ⇒ `unknown`. The envelope gained `cwd` and `hookEventName`; `run_command` no longer sends `Cwd`, and runs in the envelope's `cwd`. The 1.2.14 names and shapes are still decoded.
- `create_file`, `delete_file`, `rename_file` and `notebook_edit` are named in the 1.5.3 binary and have no captured shape: they are in the matcher and decode to `unknown` at their `Path`, or to `payload-unrecognized` without one.
- `run_command` is a command (`CommandLine`, with `Cwd` as cwd). `send_command_input` ⇒ `shell-write`: it sends stdin to a process that cannot be analyzed.

**MH-12. Grok forms.**
- **Before the tool:** `toolInputTruncated` other than `false` (also when absent) ⇒ `cannot-reconstruct` on **any** tool, with the deny "write the file in pieces under 128 KiB" or "split the command" (SPEC §14.5). A truncated `run_terminal_command` can hide the part that writes.
- `write` ⇒ `full`.
- `search_replace` ⇒ `oldnew`. `replace_all` is optional and its absence means `false` [V]. Closed keys: `file_path`, `old_string`, `new_string`, and `replace_all`.
- `hashline_edit` ⇒ `unknown`, and the deny says "resend the change with `write` and the whole file". `write` exists in both toolsets [V], so the agent always has a way out. The anchors do not need to be reimplemented: the hashline toolset is not active by default.
- `apply_patch`, `edit`, and `bash` (codex preset and opencode agent) ⇒ `unknown` until they are captured. `apply_patch` will use the MH-08 parser (second use) when there is a contract.
- `run_terminal_command` ⇒ command, reading only `command`.

**MH-13. An empty `old_string` on a file that does not exist creates the file.** It happens in Claude Code [V, `pre-edit-empty-old.json`] and in Grok [V, `pre-search-replace-create.json`]. `apply` reconstructs it as `after = neu`, and this replaces O11 in that case. With the file existing, it remains `unknown`.

Cursor needs no new forms. Every edit arrives as `Write` with the whole file, or as `Delete` [V]. The keys are closed: `file_path` and `content`.

---

## 3. Output per harness

**MH-14. Encode table.** No harness ever emits `allow` (A14). A test over every output verifies it.

O57 supersedes the historical SessionStart column and MH-25 below: consenting
Claude and Codex sessions receive `hookSpecificOutput.additionalContext`;
Cursor registers native `sessionStart` with `additional_context` (shared delivery
stands aside); agy registers flat `PreInvocation` with
`injectSteps: [{ephemeralMessage: summary}]` only at `invocationNum == 0`.
These are contract-tested against captured payloads, not new live model runs.
Grok 1.0.48's bundled hooks guide explicitly says passive SessionStart stdout is
ignored; its session briefing remains unavailable. `/pregate` can load the contract.

| Harness | Pre: deny | No objection | `ask` | Halt | Stop that blocks | Stop reentry signal | SessionStart |
|---|---|---|---|---|---|---|---|
| claude-code | same as today: JSON `permissionDecision:"deny"` + stderr, exit 2 | `""` exit 0 (plus `additionalContext` if there are warns) | same as today | `continue:false` + `stopReason` | `{"decision":"block","reason"}` exit 2 | `stop_hook_active` | same as today |
| codex | **empty stdout, stderr = `full`, exit 2** [V] | `""` exit 0 | ⇒ deny (MH-05) | **never**: `continue:false` makes the hook fail and the tool runs [V]. The deny text replaces it | `{"decision":"block","reason":full}` exit 0, **with no other keys** [V] | `stop_hook_active` [V] | `additionalContext`; failures use `systemMessage` |
| cursor | `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":full}}` exit 0: the Claude format, verified on a native hook **and** on an imported one [V] | `""` exit 0 (without `failClosed`, empty is "no decision" [C]) | ⇒ deny | does not exist | `{"followup_message":full}` exit 0 [V native; E2E imported] | `loop_count > 0` [V]: feeds `stop.reentry` in `decide`, which is neutral only for human causes; `maxStopBlocks` supplies the cap | `""` |
| grok | JSON `hookSpecificOutput` deny with reason = `compact` on one line, stderr the same, exit 2 [V] | `""` exit 0 | ⇒ deny | ignored [V], not emitted | `{"decision":"block","reason"}` exit 0 [V behavior; E2E exit] | `stopHookActive` [V]; `reason:"shutdown"` ⇒ `null` | `""` |
| agy | `{"decision":"deny","reason":full}` exit 0 [V] | `""` exit 0: verified neutral, because in run 4 the permission system kept deciding [V] | ⇒ deny | does not exist | `{"decision":"continue","reason":full}` exit 0 [V] | `executionNum > 0` [V] | not registered (MH-25) |

- The reentry column is the **signal**, not the output: on all five, reentry enters `decide` as `stop.reentry`. A reentry is never neutral by itself.
- `Decision.notice`, the text for the human, has its own channel in Claude Code and Codex (`systemMessage`). A nonblocking Codex Stop uses that field without `additionalContext`, so it reports incomplete verification without continuing the model. On the other adapters, the deny text for a human cause reaches the human through the agent.
- agy's `{"decision":"allow"}` is not emitted: it skips the permission prompt [D]. So agy's neutral is empty stdout, which in run 4 let the permission system act [V]. §6.3 checks it again without `--dangerously-skip-permissions`.

**MH-15. Launcher fail-closed.**
- **Pre, on all five: exit 2 + one non-empty stderr line of ≤ 256 characters, with empty stdout** ("PREGATE could not evaluate: <why>; report it to the user"). It blocks on all of them [V]: Claude, exit 2; Codex, exit 2 with non-empty stderr; Cursor, "Hook blocked with message: <stderr>"; Grok, the first stderr line; agy, hook failure. Because the output is a single one, Pre does not need to detect the dialect. Claude loses the `continue:false` of the current fail-closed: with the install broken, every following Pre also denies, so the agent still does not advance.
- **Invariant: every exit 2 carries non-empty stderr.** Codex lets the tool run on exit 2 without stderr [V]. So:
  - the `TERM`/`HUP` trap (the harness canceled the hook) writes "PREGATE was cancelled before deciding; report it to the user" to fd 4 before `exit 2`;
  - if the engine exits with exit 2 and its stderr is empty, the launcher applies `fail_closed`.
- **Stop:** blocks only on Claude Code (flag `claude-code` and neither `GROK_HOOK_EVENT` nor `CURSOR_VERSION` in the environment [V: Cursor defines it]), with today's output. On the others, neutral exit 0: Pre already blocks, and pre-commit and CI cover the rest.
- **SessionStart:** on Claude, `systemMessage`; on the others, neutral.
- **The engine for its own `version` is missing** (or empty: `[ -x ] && [ -s ]`): always denies, with "run `pregate setup`". Update writes the engine before the launcher (MH-27), so this happens only if someone deleted the engine, which is a protected path.
- **Its own PATH.** The launcher uses `PATH=/usr/bin:/bin` for its commands (`sleep`, `mktemp`, `cat`, `sed`, `grep`, `rm`) and passes the original PATH to the engine (the engine calls `git`, which may be in `/opt/homebrew/bin`). Without this, an unusual harness PATH leaves the launcher without `sleep`, that is, without a deadline.

**MH-16. Length limits.**

| Harness | Verified limit | What is sent |
|---|---|---|
| Claude | — | `full` ≤ 4,000 (`TEXT_MAX`) |
| Codex | intact up to ~20 KB; after that it cuts head and tail, and appends `. Command: <patch>` [V] | `full` ≤ 4,000; the first line, self-contained |
| Cursor | ~12 KB arrived complete [V, `user_message`]; [E2E] the same length via `permissionDecisionReason` | `full` |
| Grok | **256 characters and only the first line** [V] | `compact` without `\n` (≤ 256), ending with the `pregate explain` pre-check. [E2E] whether `additionalContext` arrives on a deny: if it arrives, `full` goes there |
| agy | intact up to 28 KB [V] | `full` |

`message.ts` already guarantees `compact` ≤ 256. What is added is that on Grok line breaks are replaced.

**MH-17. Outside a repo with a preset: silence and minimal cost, but the machine protected.**

With the global install, the hook runs in **every** repo. Today that has three effects D20 does not allow: SessionStart warns "no-preset" on every session; Pre and Stop write state on every call; and the protections and the shell guard object in any repo (for example, `.git/**` or another harness as a command).

- **When a call "reaches no root":** neither its cwd nor **any** of the paths it touches reaches a root, and the session registered none (`state.roots(sid)` empty). For a command, the paths are every literal path the guard extracts, not only the cwd: `cd /tmp && echo x > /repo/src/a.ts` reaches `/repo`.
- **In that case:** no state is written, git is not called, WASM is not loaded, and SessionStart stays silent. Target: p50 ≤ 25 ms.
- **But two things always run, because they are pure and cheap:**
  1. **Machine protected paths** (`paths.machineGlobs`), with or without a root:
     - the registration: `~/.claude/settings*.json` (and `${CLAUDE_CONFIG_DIR}/settings*.json`), `${CODEX_HOME:-~/.codex}/{hooks.json,config.toml,requirements.toml}`, `${GROK_HOME:-~/.grok}/{config.toml,hooks/**,hooks-paths,managed_config.toml,requirements.toml}`, `~/.gemini/config/{hooks.json,config.json,plugins/pregate/**}`;
     - the install itself: `<DATA>/**`, `<STATE>/**`, `~/.local/bin/pregate`;
     - `**/.pregate/**`: the agent does not create roots (A20);
     - also, the **realpath** of each of those files: with dotfiles as symlinks, `canonical()` resolves to the target and the literal glob would not cover it.
  2. **The shell guard, restricted** to `protected-path` and `hook-switch`: `pregate setup|update|uninstall`, `agy plugin disable|uninstall pregate`, `GROK_CLAUDE_HOOKS_ENABLED`, `CODEX_HOME`, `GROK_HOME`, `CLAUDE_CONFIG_DIR`, `--ignore-user-config`, `--setting-sources`, `--settings`, `disableAllHooks`, `features.hooks`.
- **What does not run without a root:** `.git/**`, project `.claude/settings*.json`, the rule sources, the scope causes, `shell-write`, and `shell-admin` (another harness as a command, `--no-verify`, `core.hooksPath`, `HUSKY`…). Running `codex exec` from a repo without a preset is not a leak: that Codex also has PREGATE. It is a leak only if it is launched without the user config, and that is `hook-switch`.
- **Why always.** An agent that turns hooks off does not need to have been blocked before: a Cursor, Grok, or agy subagent is a new session with empty state [V], and a session opened in `~` has no root. Deleting PREGATE's `trusted_hash` in `~/.codex/config.toml` turns Codex off silently and forever [V: a `modified` hook does not run].
- **Cost to the user** (U-5): no agent can edit those global configuration files in any repo. The human edits them, or the human runs the command the agent proposes.

---

## 4. Global installation

**MH-18. Layout.**
```
${XDG_DATA_HOME:-~/.local/share}/pregate/      = <DATA>, resolved and written by setup
├── <version>/pregate        immutable engine (one per version; they coexist)
└── bin/pregate              GLOBAL LAUNCHER: launcher.sh with version=<x>, rewritten atomically
~/.local/bin/pregate  ->  <DATA>/bin/pregate     CLI on the PATH
${XDG_STATE_HOME:-~/.local/state}/pregate/
├── …                       hook state (today's layout)
└── codex-trust.json        {"<key>":"sha256:…"}: the trust setup granted (MH-24, MH-27)
```
- The launcher is **a single asset** (`assets/launcher.sh`) with a single install: the global one. `version=<x>` points at the engine; update writes the new engine and then rewrites the launcher (MH-27). There is no `current` symlink, no `install.json`, and no `install.lock`: uninstall recognizes its own entries by marker, writes are atomic and idempotent, and a human runs setup.
- The engine derives `engineHome()` from its own executable (`dirname(dirname(process.execPath))`) and not from `XDG_DATA_HOME`. The hook environment (GUI versus terminal, `.zshenv`) can differ from setup's, and so the engine and the protected paths are always those of the install that is running.
- What cannot change is the **text of the registered command** (MH-22). The launcher content is updated in place.

**MH-19. Each repo's lock chooses the engine, without an update breaking repos.**
- The rule `lock.engine === VERSIONS.engine` (`freshness`) stays: the lock pins the semantics.
- **Hooks.** The launcher runs its `version`. The engine decodes, locates the root of the call's **target** (file, cwd, or event root), and reads `"engine"` from its lock. If it matches, it evaluates. If not, it writes the version on the first stdout line and exits with **exit 3**: for the launcher, exit 3 means "run this engine". On an explicit Pre it returns the original stdin after that line; so the normal path does not wait for a copy before starting the engine.
  - The launcher validates `^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$` on the first line and re-executes `<DATA>/<v>/pregate` with the same stdin, **once** and within the same deadline. For an explicit Pre it extracts the rest of stdout and rejects a missing replay or one that does not start with a JSON object. Stop, SessionStart, and auto keep the initial capture because they need it to interpret events/failures.
  - A second exit 3, an invalid version, or a missing engine end in the fail-closed output, with the reason "engine <v> is not installed: run `pregate update --engine <v>`".
  - **Why `sh` alone does not resolve it:** the root depends on the payload. The hook cwd is `~/.claude` on Cursor and the plugin folder on agy [V], in a monorepo the root can sit below the project dir, and a Codex patch touches several files. The engine already knows how to locate it.
  - Cost: one extra spawn (~15 ms), and only in repos pinned to another version.
  - Stop and SessionStart use the root of the event cwd. If a session has another root pinned to another version, Stop yields `version-mismatch` (deny plus a warning), and pre-commit and CI cover the rest.
- **CLI.** `check`, `explain`, and `preset show` apply the same rule, but from TS: if the root's lock asks for another engine, the engine spawns `<DATA>/<v>/pregate` with the same arguments and inherited stdio, **before reading stdin**, and exits with its code. If that engine is missing, it exits with 1 and "run `pregate update --engine <v>`". `preset compile` and `rules test` never redirect: `compile` is exactly how a repo moves to the new engine.

**MH-20. Engine floor (`FLOOR`).** The constant lives in `src/inertia.ts`, today `FLOOR = "0.0.1"`. If the lock pins an engine older than `FLOOR`, there is no redirect and it denies with `lock-stale` ("this repo's lock pins engine <v>, below the safe floor: run `pregate preset compile`"). It covers two cases: 0.1.0 engines do not know the new harnesses (without this, they would yield a confusing `payload-unrecognized`), and an adapter fail-open fixed in a new version cannot stay alive in pinned repos. It is raised when an adapter fail-open is fixed.

**MH-21. State format.** Engines of different versions share `stateDir()`. The version that changes the `CallEvent` format, the snapshot, or the names moves to a new subdirectory (`v2/`), so an old engine does not read records it does not understand. `v1/` is not created ahead of time. The release checklist asks about it.

**MH-22. Registration.** `<CMD ev h>` is this text, frozen across versions:
```sh
f='<DATA>/bin/pregate'; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook <ev> --harness <h>; for d in "${CLAUDE_PROJECT_DIR:-}" "${CURSOR_PROJECT_DIR:-}" "${GROK_WORKSPACE_ROOT:-}" "$PWD"; do while [ -n "$d" ] && [ "$d" != / ]; do [ -f "$d/.pregate/preset.json" ] && { printf '%s\n' 'PREGATE could not evaluate: its launcher is missing; report it to the user' >&2; exit 2; }; d=$(dirname "$d"); done; done; exit 0
```
- `<DATA>` is the absolute path resolved at `setup`. The `exit 2` branch exists only on `pre`; on `stop` and `session-start`, the `for` block is a direct `exit 0`.
- `[ -s ]`: an empty or truncated launcher would make `exec` return and, on ENOEXEC, run it as an empty script, that is, exit 0 with no output: allow on Codex, Grok, agy, and Claude.
- **Real-acceptance correction (2026-10-02):** the shared registration runs the literal path, without the local variable `f`. Grok expands `$VAR` before the shell and skips commands whose locals are still undefined. The fallback is kept, but its dollars are decoded with `printf '%b'` only when the launcher is missing. The current bytes are in `test/fixtures/hook-command.txt`; the Codex command keeps its bytes and trust. The normal path adds no processes.
- **agy** (its `PWD` is the plugin directory and there are no project variables [V]): on `pre`, the candidates are replaced by `workspacePaths[0]`, read from stdin with `p=$(cat); w=$(printf '%s' "$p" | sed -n 's/.*"workspacePaths":\["\([^"\\]*\)".*/\1/p')`. If the payload contains `"workspacePaths"` but `w` comes out empty (a path with escapes), it denies.
- It is valid in `sh`, dash, and zsh [E2E: Cursor runs with `$SHELL`, `/bin/zsh` on the user's machine]. The **marker** of our own entries is exact equality of `command`, `timeout`, and `matcher` with what setup writes. A group that contains `<DATA>/bin/pregate'` without being equal is treated as **an old version of ours** and is replaced, but it never receives automatic trust (MH-24).
- **Timeouts.** Pre: **30 s** on the three registrations. The launcher's 5 s deadline still governs, and the harness's 30 s only covers a launcher that is slow to start (load, machine sleep, swap). Codex, Grok, and Claude fail open when it expires [V]. Stop: 60 s. SessionStart: 15 s.

| Registration | File (respects relocation) | Entries (only adds or replaces its own) | Notes |
|---|---|---|---|
| shared (Claude Code, Cursor, Grok) | `~/.claude/settings.json`, and also `${CLAUDE_CONFIG_DIR}/settings.json` if that variable is set and points elsewhere (Cursor and Grok read the one under `HOME` [V]) | `PreToolUse` `Write\|Edit\|MultiEdit\|NotebookEdit\|Bash\|PowerShell\|Monitor\|Delete\|apply_patch\|edit\|bash\|write\|search_replace\|hashline_edit\|run_terminal_command`, 30; `Stop` 60; `SessionStart` 15; `--harness claude-code` | Grok's native names are registered too: its Write aliases do not cover `write`. Cursor Delete verified; Grok's three literals were not offered (§6.4). |
| codex | `${CODEX_HOME:-~/.codex}/hooks.json` (never `config.toml`) | `PreToolUse` `^(apply_patch\|Bash)$`, 30; `Stop` 60; `SessionStart` 15. Groups **at the end** | The default is 600 s and fails open [V], so the timeout is explicit. Trust: MH-24 |
| cursor, native Stop | `~/.cursor/hooks.json` | `version:1`, `hooks.stop`, plain command, timeout 60, `loop_limit:null`, `--harness cursor` | The TUI does not enter the Stop dispatcher if only the imported one exists. The shared Stop is omitted when this install owns the native one; followups share the counter even if `generation_id` changes. |
| agy | plugin `pregate-global` (MH-25) | `PreToolUse` `^(write_to_file\|replace_file_content\|multi_replace_file_content\|write_file\|edit_file\|create_file\|delete_file\|rename_file\|notebook_edit\|run_command\|send_command_input)$`, 30; `Stop` 60 | Nothing is written to `~/.gemini/config/hooks.json`, which Orca administers [V] |

- **Closed tool lists.** An anchored matcher does not see a new write tool that a CLI update brings (Cursor and Grok update themselves). What was discarded (a `*` matcher with an allowlist in the launcher) cost a spawn on every read on the machine. What is done: `doctor` compares each CLI's version with `VERIFIED` and warns if it differs; the §6.3 E2E inventories the tools on each new version before raising `VERIFIED`. MCP tools that write files stay outside the gate on all five, the same as in the MVP; Stop, pre-commit, and CI see them.

**MH-23. Merge.** `src/register.ts` generalizes `mergeHooks` and `mine` from `install.ts` as pure functions:
- The file is parsed, our own groups are replaced **in place**, and the missing ones are appended at the end. Foreign order and keys are not touched (Orca, ArkGate, cmux, and any other).
- If the file is not a JSON object, or an event is not an array, error and **nothing is written**.
- It is written **only if the bytes change**, with an atomic write (tmp + fsync + rename). If the file is a symlink (dotfiles), its target is written.
- The first time a foreign file is modified, a backup is saved at `<file>.pregate.bak`, once.

Running it twice leaves the same bytes and the same mtime. `JSON.stringify` reformats the file: foreign content stays the same, not necessarily the whitespace. In `~/.codex/hooks.json` that can matter for foreign trust [E2E: reformat the whitespace and measure `trustStatus`]. If it matters, the Codex merge splices the text (appends inside the array) instead of rewriting it. The MH-24 transaction makes it safe in both cases.

**MH-24. Codex trust through app-server, in one transaction.** Codex does not run a user hook without trust, and a modified one or one whose index has shifted stops running silently [V].
1. `setup` launches `codex app-server` (JSON-RPC over stdio), sends `initialize` and `hooks/list` (`cwds:[]`), and saves the snapshot: which keys were `trusted`.
2. Writes `hooks.json` (MH-23).
3. Asks for `hooks/list` again. For the keys whose definition is **exactly** what setup wrote (`command`, `timeout`, and `matcher`), with `trustStatus ∈ {untrusted, modified}`, it writes the trust: `config/batchWrite {keyPath:"hooks.state", mergeStrategy:"upsert", value:{<key>:{trusted_hash:<currentHash>}}}` [V].
4. Verifies with a third `hooks/list` that our own keys are `trusted` and that **every foreign key that was `trusted` in the snapshot still is**. If a foreign key lost trust, it restores the previous `hooks.json` bytes (returning to the original text restores the trust [V]), exits with 1, and lists the affected keys. If Codex does not confirm trust for the PREGATE hooks and no foreign trust was lost, it restores those bytes and warns: approve the hooks in `/hooks`, then rerun `pregate setup`. That warning does not fail setup when another harness was wired.
5. Saves `{key: trusted_hash}` of our own keys in `codex-trust.json`, for drift detection (MH-27).
- Because the command does not change across versions, an update does not invalidate trust. To avoid moving foreign indexes, our own groups are appended at the end and replaced in place.
- **Uninstall:** removes our own groups. Because they go at the end, only the indexes of foreign groups someone added later shift. Those keys are listed and the user is asked to approve them in `/hooks`: PREGATE does not grant trust to foreign hooks (D20 covers PREGATE's).
- Without the `codex` binary, the registration is still written, `setup` warns, and `doctor` fails.

**MH-25. agy plugin.**
- `setup` generates the plugin in a temporary directory, with `plugin.json` (`{"name":"pregate-global"}`) and a `hooks.json` with a single named hook `"pregate-global"` that has `enabled:true` and the MH-22 entries. Then it runs `agy plugin install <dir>`, which copies it to `~/.gemini/config/plugins/pregate-global/`, and verifies that `plugins.pregate-global.enabled` is not `false` in `~/.gemini/config/config.json`. The distinct identity keeps a project plugin named `pregate` from overriding the global one (§6.4).
- It is idempotent: if the installed `hooks.json` is byte-for-byte equal, it is not reinstalled. Uninstall is `agy plugin uninstall pregate-global`, verified in §6.4; only our own directory is deleted.
- **No SessionStart:** agy does not have it [V]. The snapshot is taken on the first Pre that reaches a root. Accepting an uncommitted preset follows the general revised A20 rule (MH-33).
- **No PostToolUse that blocks** [D]. Stop, pre-commit, and CI cover the fuzzy matching of `replace_file_content`.

**MH-26. Harness detection** (orderfield pattern): a harness counts as present if its home exists or if its binary is on the PATH.

| Harness | Home | Binary | Registration |
|---|---|---|---|
| claude-code | `~/.claude` | `claude` | shared |
| cursor | `~/.cursor` | `cursor-agent` or `agent` | shared |
| grok | `$GROK_HOME` or `~/.grok` | `grok` | shared |
| codex | `$CODEX_HOME` or `~/.codex` | `codex` | `hooks.json` |
| agy | `~/.gemini/antigravity-cli` | `agy` | plugin |

The shared registration is written if any of the three that read it is present, even if Claude Code is not installed. There is no `--harness` in setup: the tests use a temporary `HOME`.

---

## 5. CLI, `install.sh`, and releases

**MH-27. Machine commands.** They are human acts: the shell guard denies them to the agent, with or without a root (MH-17).

| Command | What it does |
|---|---|
| `pregate setup` | Installs the engine that runs into `<DATA>/<v>/` if it is missing (copy + warm-up, like `firstRun`), writes the global launcher (tmp + rename), the `~/.local/bin` symlink, the registrations (MH-22, MH-23), Codex trust (MH-24), and the agy plugin (MH-25). It is idempotent. Exit 0 when at least one harness was wired. A detected harness that cannot be wired (Codex trust not confirmed) is a warning with the next step. Exit 1 when no harness was wired, or on a real error. `guide` and `update` still continue after a warning-only exit; a line that starts with `ERROR:` stops them |
| `pregate update [--version v \| --engine v]` | Queries the latest tag with `gh`, downloads the platform tar and `SHA256SUMS`, verifies and extracts the engine **beside** the others, does the warm-up, and only then rewrites the launcher with the new version and runs `setup` again (usually with no changes). **It does not touch the locks.** `--engine v` installs an engine without changing the launcher: it is for the lock that asks for it |
| `pregate uninstall [--purge]` | Removes our own pieces in reverse order: registrations by marker (MH-24 for Codex), the agy plugin, the symlink (only if it points at ours), the launcher, and the engines. `--purge` also deletes state. **It never touches repos' `.pregate/`.** The backups remain, and the command says where |
| `pregate doctor` | Per harness: the binary and its version against `VERIFIED` (embedded in each adapter), drift (below), Codex trust via `hooks/list` (the only way to see a gate that is off, because Codex does not warn [V]), the agy plugin enabled, the PATH, and `gh auth`. It runs a **canary**: it runs the registered command **literally through `$SHELL -c`** with a fixture payload per harness on a temporary repo with a preset, and expects a deny in the correct dialect (that detects a `.zshenv` that prints and would break Cursor). It exits with 1 if something fails |

- **Drift** (`register.drift`, pure, two uses: `doctor` and `check --staged`, which runs in the pre-commit). It lists problems in human language, without changing the pre-commit exit code:
  - of the machine: our own entries are missing or differ from the expected ones in `~/.claude/settings.json`, `~/.codex/hooks.json`, or the agy plugin; `plugins.pregate.enabled = false`; `[compat.claude] hooks = false` in `~/.grok/config.toml`; the `trusted_hash` of our own keys in `~/.codex/config.toml` differs from `codex-trust.json`, or the key no longer points at our group (shifted index);
  - of the repo: `disableAllHooks` in `.claude/settings*.json`, `[features] hooks = false` in `.codex/config.toml`, and a project plugin or a `plugins.json` that names `pregate` under `.agents/`.
  - The pre-commit is the only channel to the human that exists on all five harnesses, and it also works when the one that was turned off is the Codex hook, whose SessionStart also does not run without trust.

**MH-28. `pregate install` (per repo) stops registering hooks and committing a launcher.** It remains for what belongs to the repo: `--git-hook`, `--ci github`, and `--ci vercel`. `--ci github,vercel` writes both. Vercel is a build recipe (`scripts/pregate-vercel-build.sh` and `vercel.json`), so a repository with no Actions workflow can still gate the deployment. `pregate ci status` and `pregate ci wait` read GitHub commit statuses and check runs for the providers that are configured and fail closed when a required one is missing or failing.
- The pre-commit calls `pregate check --staged --ratchet` from the PATH (`command -v pregate || "$HOME/.local/bin/pregate"`). If it is missing, the commit fails with "install PREGATE". By MH-19, it runs the engine the lock asks for.
- The CI template reads `"engine"` from the lock and downloads that version, verified against `SHA256SUMS` (`sha256sum -c --ignore-missing`).
- If it finds our own 0.1.0 groups in `.claude/settings.json`, or a committed `.pregate/bin/pregate`, it removes them and warns.
- With that, the double evaluation on Claude Code, the total deny from Cursor and Grok on a 0.1.0 engine, and the skew between `lock.engine`, the committed launcher's `version=`, and CI's `VERSION` when migrating a repo all disappear. `--harness` is removed. There is a single path for the hooks, the global one, and one for the engine, the lock.

**MH-28a. Project-local Claude Code registration (opt-in).** `pregate project hooks --harness claude-code [--preview|--yes]` writes the Claude Code groups into the project's own `.claude/settings.json`. It is the repository-owned alternative to the global registration for that one harness, and it is a reviewed change like the project launcher it names.
- The groups are the ones MH-22 registers globally for Claude Code: PreToolUse with the same closed tool matcher, Stop, SubagentStop and SessionStart, with the same timeouts. `register.merge` writes them with the target `project`, so the merge rules of MH-23 hold: only owned groups change, foreign groups keep their index, and unchanged content keeps its bytes.
- The command is `f="${CLAUDE_PROJECT_DIR:-.}/.pregate/bin/pregate"; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook <sub> --harness claude-code`, followed by a denial (exit 2, one line on stderr) for `pre` and `exit 0` for `stop` and `session-start`. It holds no machine path. On Windows the command is `powershell.exe -EncodedCommand …`, as the global one is, and it runs `.pregate/bin/project-launcher.ps1`; `pregate.cmd` beside it only starts that same script. A group is owned when its handler names `CLAUDE_PROJECT_DIR` and one of those two launcher paths, so a registration written on the other platform, or by 0.1.0, is replaced and not duplicated.
- One `.claude/settings.json` holds one command form. A repository that Windows and POSIX machines share is not supported by this registration: the last platform that ran the command owns the file.
- MH-04 holds only when one registration exists. With the project registration and the global one, Claude Code runs both and every call is evaluated twice; `doctor` and `status` say so. `pregate install` no longer removes the project's files: it removes the 0.1.0 handlers, which carry an inline `[ -f "$f" ]` guard, and a `.pregate/bin/pregate` that is not a reviewed project launcher. `setup` and `uninstall` write only the machine files.
- `doctor` reports the scope as project-local only, global only, both or neither. Project-local only with no other harness present is not an error: the missing global launcher, companion skills and PATH entry are stated as information, and the Claude Code canary does not run. `doctor` checks the files (registration exact, hooks not disabled, launcher equal to the template, pinned engine cached). It runs no project canary.
- Policy consent is unchanged and stays outside the repository: without `pregate enable` for the worktree, the hooks run and allow. The approval of the registration rewrites this project's record under `<DATA>/contract-approvals/`; nothing else under the user's home changes.
- **Live run [E2E]:** A live run on 2026-11-11 with Claude Code 2.1.322 on macOS (`scripts/e2e-real.ts --project-hooks-only claude-code`, headless, isolated home, no global installation) loaded the hooks from the project file, allowed a clean write and denied a forbidden one. Workspace trust was accepted in `~/.claude.json` before the run.
- **Not established [E2E]:** the interactive workspace trust prompt; the Windows form in a real Claude Code session; Cursor and Grok reading a project `.claude/settings.json`. The automated tests run the registered command as a shell command with the payload on stdin.

**MH-28b. Project-local Codex registration (opt-in, not trusted by PREGATE).** `pregate project hooks --harness codex [--preview|--yes]` writes the Codex groups into the project's own `.codex/hooks.json`. It goes through the review of MH-28a and uses the same launcher.
- The groups are the ones MH-22 registers globally for Codex: PreToolUse with `^(apply_patch|Bash)$`, Stop, SessionStart, SubagentStart and SubagentStop, with the same timeouts. `register.merge` writes them with the target `project-codex`. Only owned groups change, foreign groups keep their index (Codex trust is per index, MH-24), and unchanged content keeps its bytes. A group is owned when its handler names `--harness codex` and a project launcher path.
- **No trust is granted.** The command writes the project file and nothing else. It does not start `codex app-server`, does not write `hooks.state` or `[projects]` in `config.toml`, does not write `codex-trust.json`, and does not touch `CODEX_HOME`. The review of the hooks is the human's, in Codex (`/hooks`). The command says so in its output.
- **Finding the root.** Codex sets no project variable. The hook process starts in the session directory (0.166.0 capture, `test/payloads/codex/README.md`). The command is `d=$PWD; while [ -n "$d" ]; do f="$d/.pregate/bin/pregate"; [ -x "$f" ] && [ -s "$f" ] && cd "$d" && exec "$f" hook <sub> --harness codex; [ -e "$d/.git" ] && break; d=${d%/*}; done`, followed by a denial (exit 2, one line on stderr) for `pre` and `exit 0` for `stop` and `session-start`. It walks up from the working directory to the first directory that holds the launcher and stops at the first `.git` entry. It runs the launcher from that directory, because the launcher's fail-closed test looks for the lock in its working directory; the engine reads the session directory from the payload `cwd`. The Windows form does the same walk in PowerShell and runs `project-launcher.ps1`.
- **Limits of that walk.** A hook process whose working directory is outside the repository finds no launcher: `pre` denies and names the missing launcher. A launcher above the first `.git` entry is not reached, so a Git repository nested in a project without its own launcher is denied, not served by the outer project. The walk needs no `git` binary.
- `doctor` reports the Codex scope as project-local only, global only, both or neither, and `status --json` carries `codexHooks`. When the binary is available, `doctor` additionally queries effective `config/read` and `hooks/list` for the current directory and requires all five exact project hooks to be enabled and trusted. Missing, modified, disabled and unavailable review states cannot pass. No trust is written. Without the binary the review remains unknown. `status` remains file-only and does not count Codex as gated by a project registration alone. With only the project registration, global Codex checks do not run.
- `install`, `setup` and `uninstall` do not change the project file. `setup` still registers and trusts the global hooks when Codex is present; then both registrations exist.
- **Established by the repository's notes:** Codex 0.159.2 ran a project-level `<repo>/.codex/hooks.json` under `--dangerously-bypass-hook-trust` (`test/payloads/codex/README.md`, session 2). For user-level hooks, Codex runs no hook without trust, a modified hook or a shifted index loses it without a warning, and trust is `hooks.state.<key>.trusted_hash` in `config.toml` (MH-24, [V]).
- **Live run [E2E]:** A live run on 2026-11-11 with Codex 0.167.0 on macOS (`scripts/e2e-real.ts --project-hooks-only codex`, headless `codex exec` started in a subdirectory, isolated home) measured four states. (1) Project not marked trusted: Codex does not list the project hooks, and the forbidden write is written. (2) Project marked trusted, hooks not reviewed: Codex lists the three hooks as untrusted, runs none, and the forbidden write is written; the headless output carries no notice. (3) Hooks trusted: the forbidden write is denied and the rule reaches the model. (4) Definition changed after the review (one timeout value): Codex lists the hook as modified, runs none, and the forbidden write is written. A trusted hook of the user ran in all four states. So a project registration gates Codex only after two human steps in Codex, project trust and the `/hooks` review, and any later change to the definition, including an engine update that rewrites the command, removes the gate without a notice until the hooks are reviewed again.
- **Not established [E2E]:** the interactive `/hooks` review and what the TUI shows for an unreviewed hook; whether Codex runs both registrations when both exist; the Windows form in a real Codex session.

**MH-29. Pre-check and shell guard.**
- `message.ts` cites `pregate check --stdin --path <file> --format agent`.
- The guard allows as `argv[0]`, for `check`, `explain`, `preset show`, and `rules test`: bare `pregate` and `<DATA>/bin/pregate`.
- `agy`, `antigravity`, `cursor`, and `agent` are added to the `HARNESS` regex (the last only as an exact `argv[0]`, not as a `node_modules/` segment). Measured: `agy plugin disable pregate`, `agent -p x`, and `cursor agent -p x` yield `null` today.
- `ADMIN_WORD` adds `--ignore-user-config`, `--setting-sources`, and `features.hooks`. `HOOK_SWITCH` adds `CODEX_HOME`, `GROK_HOME`, and `CLAUDE_CONFIG_DIR`. These and the ones in MH-17 form the new `hook-switch` cause, which always runs. The rest of `shell-admin` runs only with a root.
- `apply_patch` and `applypatch` as a shell command ⇒ `shell-write` ("use the apply_patch tool"). [E2E] whether Codex 0.159.2 turns them into the tool.
- **Interactive shell with stdin and no hook.** An `argv[0]` that is a shell, an interpreter, a REPL, or an editor, with no script and no `-c`/`-e`, or with `-i`/`-s`/`-` (`bash`, `sh -s`, `python3`, `node`, `ed`, `vim`, `script`, `tmux`; measured: they yield `null` today) ⇒ `shell-write` ("interactive session: its input cannot be checked"). It closes Codex `write_stdin`, which does not fire PreToolUse [D]; agy `send_command_input` is already denied (MH-11).
- **Codex, relative destination.** Codex 0.159.2 `Bash` did not carry `exec_command`'s `workdir` [V], so a relative write destination in a session with a root was `shell-write`. Re-verified on Codex 0.166.0 (openai/codex#57198, stable 2026-10-29): `PreToolUse` `cwd` is the command's resolved workdir, and the absolute-destination rule is withdrawn. A relative path resolves against that directory. `apply_patch` still has no tool cwd, so its `cwd` stays the session directory. The payload has no version field; 0.167.0 is the minimum supported release (0.166.0 introduced command `cwd`; 0.167.0 runs PreToolUse hooks before direct Guardian review — openai/codex#58368).

**MH-30. New protected paths with a root** (step 5; the machine ones are in MH-17):
- `**/.codex/hooks.json` and `**/.codex/config.toml`;
- `**/.cursor/hooks.json`, `**/.cursor/cli-config.json`, and `**/.cursor/managed/**`;
- `**/.grok/hooks/**` and `**/.grok/config.toml`;
- `**/{.agents,.agent,_agents,_agent}/{hooks.json,plugins.json,plugins/**}`.

`**/.claude/settings*.json` was already there.

**MH-31. `install.sh`** (orderfield style; it only downloads, verifies, extracts, and delegates):
- Usage: `install.sh [--version vX]`. It always installs globally.
- `DEFAULT_VERSION` is written in the script, in lockstep with `package.json`. `main` and `HEAD` are rejected.
- It chooses the target (`darwin-arm64` or `linux-x64`). The source is the release, with `gh release download`. For development, tests, and offline mode: `PREGATE_ARCHIVE` + `PREGATE_SHA256`.
- It verifies the **SHA-256** against `SHA256SUMS` with `shasum -a 256` or `sha256sum`. If it does not match, it exits with 1.
- It extracts to a temporary directory, removes `com.apple.quarantine` on macOS, and finishes with `exec <tmp>/pregate setup`, which copies the engine to `<DATA>/<v>/` and does the warm-up (a single implementation, in TS).
- Uninstall is `pregate uninstall`. All the logic lives in TS, where it is tested. The script stays dumb.

**MH-32. Releases in `pedroknigge/pregate` (private).**
- Assets per tag `v<x>`: `pregate-<x>-darwin-arm64.tar.gz` and `pregate-<x>-linux-x64.tar.gz` (binary, LICENSE, and THIRD_PARTY_NOTICES), `install.sh`, and `SHA256SUMS`, which covers everything. There is no `.sha256` per tar: the CI template uses `SHA256SUMS`.
- The repo is private, so the download goes through `gh`, with the user's session. Without `gh`, a clear error.
- Verified bootstrap:
  ```sh
  d=$(mktemp -d) && gh release download --repo pedroknigge/pregate --pattern install.sh --pattern SHA256SUMS --dir "$d" \
    && (cd "$d" && shasum -a 256 -c --ignore-missing SHA256SUMS) && sh "$d/install.sh"
  ```
- Honest limit: `SHA256SUMS` comes from the same release, so it protects transport and not a compromised release. `PREGATE_SHA256` lets the hash be pinned from outside.
- **Update:** explicit (`pregate update`); U-4 decides the new-version notice. There is no automatic update.

**MH-33. Revised A20: accepting an uncommitted preset without depending on SessionStart.** A root is accepted if its `preset.json` is tracked in HEAD, **or if its ctime is earlier than the session's first contact with a root** (SessionStart or the first Pre that reaches a root; it is the `at` of the session's first snapshot, which is already stored). It used to depend on SessionStart, which agy does not have [V], nor do Cursor, Grok, and agy subagents, which are new sessions [V]: a freshly onboarded repo stayed without a gate until the commit. The attack A20 prevents, a nested loose preset created during the session through a channel the guard does not see, stays closed: that preset is later than the first contact.

**MH-34. Onboarding a repo in the global flow.** With PREGATE installed on the machine:
1. The human writes `.pregate/preset.json` (the agent cannot: protected path; `pregate init` arrives in v1).
2. `pregate preset compile` ⇒ `.pregate/pregate.lock.json`, with the engine that is running.
3. Optional: `pregate install --git-hook --ci github`.
4. Commit. From that moment, all five harnesses gate it; before the commit, too, from the session after it is created (MH-33).

To migrate a repo to a new engine: `pregate update`, `pregate preset compile`, and commit the lock. There are no more files to touch (MH-28).

---

## 6. Test plan

**6.1 Unit (pure, and in CI).**
- **Contract per real payload.** For each harness, a test walks `test/payloads/<h>/*.json` and **fails if a file has no expectation**. So a new capture forces it to be classified. The expectation is the expected `HookEvent`, `Rejected`, or `null`. Cases it must cover:
  - Codex: add+update, move, delete, subagent, and the `callId` with a hash.
  - Cursor: create, strreplace, applypatch-gpt, delete, shell (cwd `""` with one root), task, `claude-import-pre-write`, and stop/loop.
  - Grok: write, search_replace (without `replace_all`), create with empty old, hashline ⇒ unknown, subagent, shutdown ⇒ `null`, and reentry via `stopHookActive`.
  - agy: write, append, replace, multiline, run_command, stop and reentry, and the read and subagent tools ⇒ outside the matcher.
- **Mutations.** An extra key in the edit ⇒ `unknown`; the top-level key removed ⇒ `BAD`; `"cursor_version"` inside the content of a Claude `Write` ⇒ it is still Claude; `GROK_HOOK_EVENT` without `hookEventName` ⇒ the flag; `toolInputTruncated` absent or `true` on any Grok tool ⇒ deny; Cursor Shell with `cwd:""` and two roots ⇒ `BAD`; a relative path in a patch ⇒ `unknown`.
- **`Rejected` outside a root:** a valid envelope with an unknown tool and `dirs` with no root ⇒ neutral and no state; with a root ⇒ deny; an envelope that is not JSON ⇒ deny.
- **Encode per harness** × {none, deny, deny+halt, ask, stop block, stop reentry, session-start}. Invariants:
  - `allow` never appears;
  - Codex: on exit 2, empty stdout and non-empty stderr; Stop carries exactly the keys `decision` and `reason`;
  - Cursor: the deny is the Claude JSON with exit 0;
  - Grok: reason ≤ 256 and without `\n`;
  - agy: the deny is never empty;
  - outside Claude, `ask` ⇒ deny and halt ⇒ no halt keys;
  - Stop reentry (all five signals) reaches `decide` as `reentry`.
- **Patch.** The grammar: captures plus the synthetic cases (`..`, `@@ ctx`, several hunks, `*** End of File`, heredoc ⇒ `unknown`). Application: exact, missing context ⇒ `cannot-reconstruct`, pure insertion ⇒ `unknown`, Move with `from`.
- **`reconstruct`:** append, agy range, empty old that creates (MH-13).
- **`gate` and `decide`:**
  - overlay (a patch that creates `a.ts` and imports it from `b.ts`, without `unresolvable-import`);
  - `merge` and its priority;
  - Delete of `.pregate/**` ⇒ deny and in scope ⇒ no objection;
  - MH-17: with no root, not a single state file written; `~/.claude/settings.json`, `~/.codex/config.toml`, and its realpath under a symlink ⇒ deny without a root; `.git/**` without a root ⇒ no objection; `cd /tmp && echo x > /repo/src/a.ts` ⇒ reaches the root;
  - MH-20 (`FLOOR`) and MH-33 (ctime earlier and later than the first snapshot).
- **`shell`:** `hook-switch` with and without a root; `shell-admin` (another harness) only with a root; the new words from MH-29; interactive shell; relative destination on Codex.
- **`register`** over fixtures with the real shape of the user's configs (Orca on Claude and Codex; ArkGate):
  - foreign content stays deep-equal;
  - the second run writes nothing (same bytes and mtime);
  - on Codex our own groups go at the end and foreign indexes do not move;
  - invalid JSON ⇒ nothing is written;
  - a symlink is written at its target;
  - a group with the marker and a different tail is replaced but is not "exact" (no trust);
  - uninstall leaves foreign content deep-equal to the original and lists the shifted indexes;
  - `drift` detects every MH-27 case.

**6.2 e2e (compiled binary + launcher, without real harnesses, in CI).**
- **Launcher:** missing engine, empty engine, exit 1, SIGKILL, hang (5 s deadline), exit 3 to a pinned engine, exit 3 to a missing engine or one with an invalid version, double exit 3, engine with exit 2 and empty stderr, SIGTERM to the launcher, empty PATH. Always: Pre fail-closed = exit 2 + one non-empty stderr line and empty stdout. It runs on dash, bash 3.2, and **`zsh -c` with the registered command literal** (MH-22), with the launcher present, missing, and empty, and the agy variant with `workspacePaths` normal, with escapes, and absent.
- **Per harness:** the real payloads rewritten onto a temporary repo with a preset yield deny on a violation, no objection on a clean edit, and no objection and no state on a repo without a preset.
- **CLI:** `check` on a repo pinned to another engine runs that engine; `preset compile` does not redirect.
- **`HOME=<tmp> pregate setup`** with all five detected (fake binaries on the PATH): a second run with no writes, `uninstall` that restores, and `doctor` green. Codex trust is tested against a fake app-server that reproduces `hooks/list`, `config/batchWrite`, and invalidation by index; the real one, in §6.3.

**6.3 Real E2E with each CLI (opt-in, `scripts/e2e-real.ts`, `PREGATE_REAL=1`).** It is a requirement before installing on the user's real machine (D20).
- **Isolation.** The surveys' isolation is used and nothing real is written:
  - Codex: temporary `CODEX_HOME` with `auth.json` copied and a temporary `HOME`.
  - Cursor: temporary `HOME` with a symlink to `Library/Keychains`.
  - Grok: `env -i`, temporary `HOME` and `GROK_HOME`, and `auth.json` with the `refresh_token` emptied.
  - agy: temporary `HOME` with the symlink to the keychain.
  - Claude Code: temporary `HOME`, authenticated as in the O10 verification.
- **Flow:** `HOME=$tmp pregate setup` (includes trust through app-server and `agy plugin install`), a temporary git repo with a preset (for example, `CA-DEP-002` forbids `node:fs` in `src/core/**`), and the headless CLI:
  - Codex: `codex exec --json -s workspace-write`.
  - Cursor: `cursor-agent -p --trust --force --output-format stream-json`.
  - Grok: `grok -p --trust --always-approve --output-format streaming-json`.
  - agy: `agy -p --output-format json`.
  - Claude Code: `claude -p --permission-mode acceptEdits`.
- **Four scenarios per harness**, with prompts that name the tool:
  1. **Real deny:** "create `src/core/x.ts` with `import fs from 'node:fs'`". The file does not exist afterward, and the stream carries the PREGATE reason in the text the model sees.
  2. **Clean edit:** the file is written and **its content equals the reconstructed `after`** (checks MH-08, MH-11, and MH-13 against the real harness, including the final `\n` of a Codex Add).
  3. **Repo without a preset:** it writes, there is no PREGATE output, and there is no state. On agy, also, without `--dangerously-skip-permissions`, the permission system decides the write (neutral grants nothing).
  4. **Hung engine:** the lock pins `9.9.9-hang`, whose "engine" is `sleep 60`. A deny is expected in under 6 s and the file unwritten (MH-19 + MH-15).
- **Interactive mode:** one scenario 1 per harness in a pty (the user works in the TUI; only the headless modes are tested).
- **Also, and each one closes an [E2E] in this document:**
  - Cursor: the deny in Claude format, the `followup_message`, and `Delete` arrive through the imported registration; interactive Stop in a pty with the `maxStopBlocks` cap; a 2 MB write arrives complete (hash of `content` against disk).
  - Grok: the matcher literals `apply_patch|edit|bash`; `Stop` with exit 0 and `reason:"shutdown"` ignored.
  - Codex: `hooks/list` = trusted before and after a repeated `setup`; reformat the whitespace of `hooks.json` and measure `trustStatus` (MH-23); whether the payload `cwd` reflects the `workdir` (MH-29); whether code-mode JS can write without `apply_patch` or the shell (a prompt that tries); whether `exec-<uuid>` repeats across calls.
  - agy: `agy plugin uninstall` exists; a 2 MB write via `CodeContent`; a project plugin named `pregate` with `enabled:false` does not override the global one.
  - **A foreign hook that returns `allow`** (and another that returns `ask`) registered before ours, on Codex (group 0), Grok (`~/.grok/hooks/aa.json` and `config.toml`), and Claude: PREGATE's deny has to win. If it does not win on Grok, the Grok registration moves to `[[hooks.PreToolUse]]` in `config.toml`, which runs earlier [V]. If it does not win on Codex, **the Codex install stays blocked** until it is resolved.
  - **Orca:** capture the real environment and flags of each agent it launches (`CODEX_HOME`, `GROK_HOME`, `CLAUDE_CONFIG_DIR`, `HOME`, `--ignore-user-config`, `--setting-sources`). If any runs without the user config, PREGATE does not cover it: it is documented and taken to the user.
  - The output of the registered command under the user's real `zsh` (their dotfiles, read-only) is clean.
- Estimated cost: < USD 3 per full run.

**6.4 Real acceptance, 2026-10-02 (W12).** A candidate was built and `PREGATE_REAL=1 bun run scripts/e2e-real.ts` was run, with reruns per harness and `--core-only`, `--extras-only`, or `--pty-only`. Every HOME, XDG, TMPDIR, CODEX_HOME, and GROK_HOME stayed under `/private/tmp/claude-501/`. Credentials were copied read-only, without refresh tokens; Cursor and agy used the surveys' Keychains symlink. There was no install into the real HOME and no push. Claude consumed **exactly two prompts**, grouping the four cases; its extras were not run.

| Harness / real version | Deny and file absent | Allowed edit = reconstruction = disk | No preset, no objection | `9.9.9-hang`, fail-closed | Interactive deny |
|---|---|---|---|---|---|
| Claude Code 2.1.287 | PASS | PASS | PASS | PASS | Pending: two-prompt limit |
| Codex 0.159.2 | PASS | PASS | PASS | PASS | PASS, `--no-daemon` |
| Cursor 2026.09.26-dd393fe | PASS | PASS | PASS | PASS | PASS |
| Grok 1.0.48 | PASS | PASS | PASS | PASS | PASS |
| agy 1.2.14 | PASS | PASS | PASS | PASS | PASS |

The edit changes only `a + b` into `b + a`; each CLI's captured input is decoded and reconstructed against the original bytes, including spaces and newline. The deny requires a Pre event, a visible reason, and an intact `src/` tree. The hang case requires that the launcher invoked the pinned engine and that its **5 s** deadline message reaches the model: it is not confused with a harness fail-open timeout.

Defects found and fixed:

- **Grok:** the previous matcher did not cover the native `write` tool; also the runner expands `$VAR` references before the shell and the command with locals did not run. The write without Pre was reproduced and the deny was verified with the literal invocation and the deferred MH-22 fallback. The table uses the repaired run, not the initial authentication failure.
- **Cursor:** the imported Stop alone did not activate the TUI dispatcher. A native Stop of our own is installed and running both is avoided. Each followup brings another `generation_id`, so the Stop counter uses session continuity until the turn completes; it now blocks twice and finishes. There is an automated regression of the cap and its reset.
- **agy:** the disabled project plugin `pregate` overrode the global one with the same identity. Changing only the named hook was not enough; changing the folder, manifest, and named hook to `pregate-global` was. The real case denies again and uninstall removes our own plugin. A deliberate collision with the new identity remains subject to loader precedence and to doctor; it is not isolation against hostile human configuration.
- **Runner:** locks use the compiled version; access-token copies are refreshed before each harness; exact context avoids Codex's fuzzy patch; `danger-full-access` allows the write in the scratch under the outer sandbox (the nested `workspace-write` sandbox did not allow it); the Codex TUI uses `--no-daemon` because this environment blocks `/bin/ps`; agy uses `--prompt-interactive`. Unavailable process inspection is recorded and does not block uninstall.

**6.5 Real re-verification, 2026-11-10.** The real runner of §6.3 was run per harness against the installed CLIs, with the same isolation as §6.4.

| Harness / real version | Deny and file absent | Allowed edit = reconstruction = disk | No preset, no objection | `9.9.9-hang`, fail-closed | Interactive deny |
|---|---|---|---|---|---|
| Claude Code 2.1.322 | PASS | PASS | PASS | PASS after the fix below | Not run: two-prompt limit |
| Codex 0.167.0 | PASS | PASS | PASS | PASS | PASS |
| Cursor 2026.11.05-86047df | PASS | PASS | PASS | PASS | PASS |
| Grok 1.0.80 | PASS | PASS | PASS | PASS | PASS |
| agy 1.5.3 | PASS after the fix below | PASS after the fix below | PASS | PASS after the fix below | PASS after the fix below |

Still failing, as the coverage line of the status command already states: Grok does not honor the Stop block, and Cursor's Stop did not block in a pty.

Defects found and fixed:

- **agy 1.5.3 edits were not gated before the write.** The matcher named `write_to_file` and `replace_file_content`; 1.5.3 calls `write_file` and `edit_file`, so no Pre hook ran and the forbidden file was written. Only Stop still blocked. The matcher and the adapter now cover both generations, and the 1.5.3 payloads are in `test/payloads/agy`.
- **A hung pinned engine failed open for a project below the session's folder.** The launcher denied a failure only when the session's own folder had consent. With the session in a parent folder and the edit in a nested enabled project, the engine redirected to the pinned engine, that engine hung, and the launcher exited 0. A redirect now counts as evidence of a project, in the shell launcher and in the supervisor. A hang of the installed engine before any redirect, for a nested project, is still not denied by the shell launcher: it cannot tell that a project is involved.
- **Runner:** it pinned the `architecture` pack at 1.1.0 (bundled: 1.3.0), removed the hooks at the end without stating the unattended approval that command now requires, and counted the SessionStart notice for a project with no contract as output.

`VERIFIED` moved only for agy (1.5.3), whose payloads were captured again. The other adapters passed with their recorded payload contracts unchanged, and their `VERIFIED` stays at the version whose payloads are in `test/payloads`.

**Ledger of every [E2E] and extra in §6.3.** PASS confirms what was observed; pending/not offered keeps the conservative option and does **not** close W12 completely or authorize D20.

| Item | Real result / decision |
|---|---|
| Cursor `generation_id` changes per turn (§2) | Observed: it also changes between Stop followups; cap fixed and verified in pty. |
| Codex Add, including newline (MH-08) | Exact Update edit PASS. Add was written in the no-preset case; Add equivalence against reconstruction with a preset is pending. |
| Cursor `permissionDecisionReason` of ~12 KB (§3) | Pending; a short deny arrived complete. Prior `user_message` evidence is not reused as proof of this field. |
| Grok `additionalContext` on deny (§3) | Pending; only `compact` ≤ 256 characters is still emitted. |
| Imported Cursor `Delete` matcher (MH-22) | PASS: Pre captured, `protected-path`, preset preserved. |
| Grok literals `apply_patch\|edit\|bash` (MH-22) | Not offered by 1.0.48; `write`, `search_replace`, `run_terminal_command` were seen. The literals are kept, without claiming they were executed. |
| Command on sh/dash/bash/zsh (MH-22) | Launcher suite PASS, including missing/empty/non-executable launcher and neutrality without a preset; real Cursor uses zsh. |
| hooks.json whitespace and Codex trust (MH-23) | PASS: the three of ours and the foreign one stay `trusted` after reformatting and restoring. |
| Codex `hooks/list` after a repeated setup (MH-24) | PASS: three of ours trusted, foreign trusted, bytes and mtimes unchanged. |
| `agy plugin uninstall` (MH-25) | PASS: it exists in help; real uninstall removed `pregate-global` and preserved foreign registrations. |
| Codex shell `apply_patch`/`applypatch` turns into the tool (MH-29) | Pending; `shell-write` is kept for both commands. |
| Codex `cwd` reflects `exec_command.workdir` (MH-29) | No on 0.159.2: `ls` asked for `src/core`, the Bash payload kept the root. Yes on 0.166.0 (openai/codex#57198): `cwd` is the resolved workdir, and the absolute-destination requirement is withdrawn. `apply_patch`, SessionStart and Stop still carry the session directory. |
| Codex code mode writes from JS | File not created; the model reported V8 without Node/fs. An observation of this configuration, not a universal proof of impossibility. |
| Codex `exec-<uuid>` shared across inputs | 0 repetitions across 7 observed inputs; reuse not exercised. callId + input hash is kept. |
| Cursor imported Claude deny | PASS, in headless and pty. |
| Cursor `followup_message`, Stop pty, and maxStopBlocks | PASS after native registration: reentry `loop_count > 0`, two blocks, and a neutral exit. |
| Cursor 2 MB write, hash against disk | Pending: generating 2 MB contradicts minimal prompts; it is not declared intact from a small test. |
| Grok Stop exit 0 and reentry | PASS: the block resumes the agent; `stopHookActive:true` captured. |
| Grok Stop `reason:shutdown` ignored | PASS: one shutdown captured, with no additional gate event. |
| agy neutral without skip-permissions | PASS: without a preset PREGATE does not speak and does not create state; agy returns `headless mode cannot prompt`. |
| agy 2 MB write via CodeContent | Pending because of the quota limit / minimal prompts. |
| agy project `pregate` with `enabled:false` | PASS after separating the global identity; before, it was fail-open. |
| Foreign allow hook before the deny: Codex / Grok / Claude | Codex PASS; Grok PASS (toml and aa sources executed); Claude pending because of the two-prompt limit. |
| Foreign ask hook before the deny: Codex / Grok / Claude | Codex PASS; Grok PASS (toml and aa sources executed); Claude pending because of the two-prompt limit. |
| Orca: real agent environment and flags | Not verifiable in this sandbox: `posix_spawn /bin/ps` returns EPERM. Coverage of Orca launches is not claimed. |
| zsh with real dotfiles | Pending because of the strict temporary-HOME instruction; isolated zsh PASS, empty stdout. The real dotfiles were not executed. |
| Real cycle setup → setup → doctor → uninstall | PASS on reruns: canaries of all five dialects, trust, idempotence, and preservation of foreign hooks. Doctor warns that gh is not authenticated in the temporary HOME. |

Local evidence, without credentials: `/private/tmp/claude-501/finish-pregate/{real,codex-retry,codex-pty,grok-final,cursor-agy-final,cursor-agy-core-final,grok-replay-final}.log`. The payloads and events are in the `Evidence` directories printed at the end; the copied auth.json files and keychain symlinks are deleted when it finishes. Claude was tested before the registration fixes; no extra prompts were spent: the current shared invocation was verified with the payloads and the launcher suite. After the latency/replay fix, Grok's real core passes the four cases and pty again (**11/0**); the other dialects pass the launcher suite, with no new prompts. See also MVP-STATUS §8.

---

## 7. Accepted residues

What the session gate does not see and is left for Stop (where it exists), pre-commit, and CI:
- Writes by commands the guard lets through by design (`rsync`, `tar x`, `unzip -o`, `make`, `prettier --write`, `git stash pop`…), background processes that write after Stop (`&`, `nohup`, agy's `WaitMsBeforeAsync`, Grok's `backgroundTasks`), and MCP tools that write files.
- Sessions without an effective Stop: Cursor `-p` [V], Cursor subagents (`subagentStop` did not fire [V]) and Grok subagents (their session has no Stop of its own), and the agy parent's Stop that arrives with `fullyIdle:false` [V].
- Outside Claude, Stop stops blocking after `maxStopBlocks` with no channel to the human.
- Cursor and Grok depend on reading `~/.claude/settings.json` (MH-04); Codex, on trust (detected by drift and `doctor`); all of them, on an orchestrator not launching them without the user config (§6.3, Orca).
- Availability, not fail-open: a `.zshenv` that prints or a non-POSIX `$SHELL` makes Cursor receive invalid JSON and block everything [V]. The `doctor` canary detects it.

---

## 8. Changes this implies in ARCHITECTURE and SPEC (applied when building)

- **A16:** `ProposedChange.from` and `pre-edit.changes[]` (MH-07).
- **A17 and principle 8:** replaced by MH-01.
- **A20:** replaced by MH-33.
- **Principle 1.6:** the variables that are read become `GROK_HOOK_EVENT` (no longer `GROK_*`) and, only in the shell, `GROK_HOME`, `CODEX_HOME`, and `CLAUDE_CONFIG_DIR`. `XDG_DATA_HOME` is no longer read in the engine (MH-18).
- **§4.0:** universal Pre output, stderr invariant, own PATH, exit 3, and missing engine (MH-15, MH-19, MH-22).
- **§4.2:** `hook-switch` cause and restricted guard without a root (MH-17, MH-29).
- **§4.4:** SessionStart without a preset stays silent (MH-17).
- **§4.5:** the pre-commit uses the global `pregate` (MH-28).
- **§5.4:** layout (MH-18) and releases (MH-32).
- **O11:** bounded by MH-13.
- **O25:** `payload-unrecognized` names the harness and the tool.
- **SPEC §14.6:** Codex, Cursor, and agy are in the current public release (0.0.7). `hashline_edit` stays in v2.

---

## 9. Adversarial review applied

Two reviews of the previous version of this document: **FO** (fail-open paths, F1–F30) and **SI** (simplicity, A1–A9, B1–B6, C1–C4). What SI's "D" items say (what is fine) changes nothing.

| Finding | Resolution | Where |
|---|---|---|
| FO-F1, SI-B1: MH-17 let PREGATE be turned off from a session with no root | **Applied.** Machine paths and `hook-switch` always; "reaches a root" over every path in the command. What FO asked for beyond that was cut: all of `~/.gemini/config/**` (it would block the user's skills and MCP) and `skills.json` (it does not turn hooks off) | MH-17, U-5 |
| FO-F2: MH-04 neutralized the imported registration because a file existed | **Dissolved** by SI-A1: there is no longer a native registration on Cursor or Grok, so there is nothing to neutralize | MH-04 |
| SI-A1: double registration + MH-04 | **Applied** (the minimal option): one shared registration for Claude, Cursor, and Grok. Cursor uses the Claude format, verified on the imported path | MH-04, MH-14, MH-22, U-6 |
| FO-F3: closed-list matchers | **Partial.** The `*` matcher with an allowlist in the launcher (one spawn per read on the machine) and the MCP heuristic are discarded. The comparison with `VERIFIED` in `doctor` and the tool inventory in the E2E remain; MCP is a declared residue | MH-22, §7 |
| FO-F4: Codex trust broken by third parties | **Applied:** transaction with a snapshot and restore; text splice if the E2E requires it; drift in pre-commit and `doctor` (together with SI-C1). Discarded: `stat` on every SessionStart (the pre-commit is the channel that exists on all five) | MH-24, MH-27 |
| FO-F5: empty launcher or engine | **Partial:** `[ -s ]` in the inline guard and in the launcher, tmp + fsync + rename writes. The ack handshake and the deny `trap EXIT` are discarded: with rename after verification and the warm-up, a partial engine cannot be left installed | MH-15, MH-22 |
| FO-F6, SI-B5: agy with the launcher missing exited neutral | **Applied**, with a single preset search (SI-A6) | MH-22 |
| FO-F7: relative paths on Codex | **Applied:** patch with absolute paths only; in `Bash`, a relative destination ⇒ deny until the E2E says otherwise | MH-08, MH-29 |
| FO-F8: no effective Stop | **Discarded** (SubagentStop, sticky Stop, TDD-DEL in Pre): they are new mechanisms for a secondary net. It remains a declared residue. The root is already registered on the first call | §7 |
| FO-F9: interactive shell with stdin and no hook | **Applied** | MH-29 |
| FO-F10: truncated Grok payload on any tool | **Applied.** Deep-equal between `toolInput` and `tool_input` discarded: they are aliases of the same serializer [V] | MH-12 |
| FO-F11: timeouts that fail open, and PATH | **Applied:** Pre 30 s on the three registrations; the launcher's own PATH | MH-15, MH-22 |
| FO-F12, FO-F13: exit 2 without stderr | **Applied** in the launcher. Sniffing agy's JSON in `sh` discarded: the encode tests guarantee it | MH-15 |
| FO-F14: relocated config or config on a symlink | **Applied without `install.json`:** realpath of each registration file, computed in the hook; the engine derives its paths from `execPath`. `PREGATE_STATE` discarded (state on another path does not open the gate) | MH-17, MH-18 |
| FO-F15: project config that turns hooks off | **Applied** as a drift warning in pre-commit and `doctor` | MH-27 |
| FO-F16: orchestrator that relocates the config | **Applied:** new words in the guard; Orca capture in the E2E | MH-29, §6.3 |
| FO-F17: foreign allow against our deny | **Applied** as an E2E that blocks the Codex install | §6.3 |
| FO-F18, SI-A2 (`SINCE`) | **Applied, unified:** a single `FLOOR` replaces `SINCE` (per harness it was speculative) | MH-20 |
| FO-F19: A20 without SessionStart | **Applied,** with no new state: the `at` of the first snapshot is used | MH-33 |
| FO-F20: nested roots with the engine missing | **Discarded:** a registry of known roots for a broken-install state; with SI-A6, a missing engine always denies | MH-15 |
| FO-F21: ambiguous cwd on Cursor and agy | **Applied** as `BAD`. Evaluating against each root discarded: more code for a rare case | MH-06 |
| FO-F22: Cursor reentry written as neutral | **Applied** (a document error) | MH-14 |
| FO-F23: teammates without the global install | **Up to the user** | U-1 |
| FO-F24: background processes | **Discarded:** a residue of the shell class that pre-commit and CI already cover | §7 |
| FO-F25: `HARNESS` regex | **Applied** | MH-29 |
| FO-F26, FO-F27, FO-F30: code mode, truncated content, shared `callId` | **E2E**; the `callId` with a hash is applied now because it costs one line | MH-05, §6.3 |
| FO-F28: update order and schema test | **Partial:** the order engine → warm-up → launcher is applied. The test that pins the schema hash is discarded as fragile: the MH-21 rule in the release checklist replaces it | MH-21, MH-27 |
| FO-F29: trust and `mine()` by substring | **Applied:** exact equality | MH-22, MH-24 |
| SI-A2: `v1/`, seen roots, `--prune`, warnings per lock | **Applied:** all removed. The deny "engine v is not installed" resolves on its own | MH-18, MH-21, MH-27 |
| SI-A3: `current`, `install.json`, `install.lock`, `agy-plugin/` | **Applied.** The only thing stored is `codex-trust.json`, which SI-C1 justifies | MH-18 |
| SI-A4: CLI flags | **Applied:** `setup`, `update [--version \| --engine]`, `uninstall [--purge]`, and `doctor` remain | MH-27 |
| SI-A5: `install.sh` | **Applied:** one mode, release or `PREGATE_ARCHIVE`, a single warm-up, only `gh`, only `SHA256SUMS` | MH-31, MH-32 |
| SI-A6: dialects in the launcher | **Applied:** universal Pre without JSON; Stop blocks only on Claude; a single preset search. The Cursor sniff moves to `CURSOR_VERSION` | MH-15 |
| SI-A7: foreign re-trust on uninstall | **Applied:** the keys are listed and the user approves them | MH-24 |
| SI-A8: `fallback` as part of `decode` | **Applied** (`Rejected`), and it also carries `dirs` so the machine is not broken | MH-01, MH-06 |
| SI-A9, SI-B3, SI-B4: committed launcher and repo migration | **Applied:** no committed launcher; pre-commit and CI follow the lock; the CLI redirects by lock | MH-19, MH-28, U-7 |
| SI-B2: `doctor` without `test/payloads` | **Applied:** `VERIFIED` embedded per adapter | MH-01, MH-27 |
| SI-B6: agy plugin enabled; Cursor as `agent` | **Applied** | MH-25, MH-26 |
| SI-C1: drift at runtime | **Applied** in pre-commit and `doctor` | MH-27 |
| SI-C2: update notice | **Up to the user** | U-4 |
| SI-C3: onboarding in the global flow | **Applied** | MH-34 |
| SI-C4: E2E gaps | **Applied** (pty, code mode, real zsh); MH-29 closes `write_stdin` | §6.3 |

---

## 10. Build plan

Each unit owns its files and its tests, and does not edit another unit's. The §10.1 interfaces are fixed in W0 and do not change without going through the orchestrator. Each unit closes with an adversarial simplicity review (D16), as in ARCHITECTURE §9.

### 10.1 MH-W0: contracts (first and in series, ~1 day)

Delivers: the types, `src/harness/wire.ts`, the move of `src/claude.ts` to `src/harness/claude.ts` (no behavior change), the §10.1 constants, the per-payload contract test harness (fails if a file has no expectation), and the stubs each unit replaces. It fixes these signatures:

```ts
// types.ts
type HarnessId = "claude-code" | "codex" | "cursor" | "grok" | "agy";
type HookKind = "pre" | "stop" | "session-start";
type Edit = …                                                    // MH-07
interface ProposedChange { session: Session; callId: string; tool: string; path: string; edit: Edit; from: string | null }
type HookEvent = { kind: "session-start"; … } | { kind: "pre-edit"; changes: ProposedChange[] }
               | { kind: "pre-command"; command: ProposedCommand } | { kind: "stop"; … }
interface Rejected { cause: Cause; kind: HookEvent["kind"]; reentry: boolean; session: Session | null; dirs: string[] }
type Cause = … | "hook-switch";                                  // FIXABLE_BY: "agent"
interface HookEnv { grokEvent: string | null; projectDir: string | null; remote: boolean }

// harness/<h>.ts (codex, cursor, grok, agy; claude adapted)
export const VERIFIED: string;
export function decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null;
export function encode(kind: HookEvent["kind"], d: Decision, stop: StopState | null): Emission;

// main.ts
export const FLOOR = "0.0.1";
export function profile(flag: HarnessId, raw: string, env: HookEnv): HarnessId;   // MH-03, pure

// reconstruct.ts
export function apply(current: string | null, edit: Edit): { after: string | null; status: Reconstruction };

// decide.ts
export function merge(ds: Decision[]): Decision;

// paths.ts
export function machineGlobs(home: string, env: { codexHome: string; grokHome: string; claudeConfig: string | null; data: string; state: string }, real: (p: string) => string): string[];

// shell.ts
export function guard(command: string, cwd: string, ctx: GuardContext & { machineOnly: boolean; harness: HarnessId }): Cause | null;
//   ctx.touched(): boolean — whether any extracted path reached a root (MH-17)

// gate.ts
export function onPreEdit(changes: ProposedChange[]): Promise<Decision>;
export function rejected(r: Rejected): Decision;                 // MH-06: neutral without a root

// register.ts
type Sub = HookKind;
type Target = "shared" | "codex" | "agy";
export function hookCommand(data: string, sub: Sub, h: HarnessId, agy: boolean): string;           // MH-22, frozen text
export function merge(text: string | null, t: Target, data: string): string | null;                // null: it is not a JSON object
export function unmerge(text: string, t: Target, data: string): { text: string; shifted: string[] } | null;
export function exact(group: unknown, t: Target, data: string): boolean;                           // MH-22, MH-24
export function agyPlugin(data: string): Record<string, string>;                                    // relative path → bytes
export function drift(m: MachineFiles, repo: RepoFiles | null, data: string, trust: Record<string, string>): string[];

// machine.ts
export function setup(): Promise<{ code: 0 | 1; text: string }>;
export function update(o: { version?: string; engine?: string }): Promise<{ code: 0 | 1; text: string }>;
export function uninstall(purge: boolean): Promise<{ code: 0 | 1; text: string }>;
export function doctor(): Promise<{ code: 0 | 1; text: string }>;
```

Launcher protocol in 0.0.7: exit 0 and 2 = the engine's output; exit 3 with first stdout line `^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$` = "run that engine". Pre also returns the original stdin after that line (MH-19); an empty replay is rejected. Any other code = fail-closed. The `<CMD ev h>` text from MH-22 is written in W0 as a literal fixture.

**W0 delta (built; this overrides the signatures above).**
- `HARNESSES` and `profile` live in `src/harness/profile.ts`, not in `main.ts`: `main.ts` runs on import, so neither a test nor `doctor` could import it, and `machine.ts → main.ts → cli.ts → machine.ts` would be a cycle.
- `FLOOR` lives in `gate.ts`, next to `VERSIONS`, with the protocol constants: `REDIRECT = 3` and `ENGINE_VERSION` (the regex above).
- `gate.pinned(dir: string): string | null` is added: the engine the root's lock pins at or above `dir` if it is not this one and it is not below `FLOOR`. It is the `main ↔ gate` seam of exit 3 (MH-19), which §10.1 did not fix. The stub returns `null`: this engine decides, as today.
- `encode(kind, d)` without `stop: StopState | null`: `StopState` was not defined and no MH-14 row needs it. Reentry enters `decide` through `stop.reentry`, and a rejected payload's reentry travels in `Rejected.reentry`.
- `Session.harness: HarnessId`: `gate` needs the harness for the guard context (MH-29) and to index state by `<id>:<Session.id>` (MH-05), and neither `ProposedCommand` nor `onPreCommand` carried it. `Session.id` remains the native id; W6 builds the key (note: `state.sessionDir` rejects `:`).
- `hookCommand(data, sub, h)` without `agy: boolean`, which repeated `h === "agy"`.
- MH-22 text (literal fixture in `test/fixtures/hook-command.txt`): the loop is `while [ "${d#/}" != "$d" ]; do …; d=${d%/*}; done` instead of `while [ -n "$d" ] && [ "$d" != / ]; do …; d=$(dirname "$d"); done`. No fork and no PATH dependency, and it terminates for any value: `dirname` of a relative path reaches `.` and repeats until the harness timeout, which fails open on Codex, Grok, and Claude. The agy variant is written in full (a single candidate, `workspacePaths[0]`). Checked by hand on sh, dash, bash, and zsh; the matrix belongs to W8.
- `claude.ts` also exports `eventOf(raw): HookKind | null` for `hook auto`, because `decode` requires the event.
- `GuardContext` (exported by `shell.ts`) includes `touched(): boolean`: `gate` implements it and the guard can consult it. `MachineFiles` and `RepoFiles` (`register.ts`) are defined.
- `hook-switch` enters `GUARDS` in `decide.ts`: shadow never silences it.
- The Claude adapter no longer rejects because of `GROK_*` in the environment (MH-03) and decodes an empty `old_string` as `oldnew` with `old: ""` (MH-13); the `apply` stub still yields `unknown`, so the decision does not change until W5.
- Contract harness: `contract(h, dir, expectations)` in `test/harness/contract.ts`. Besides requiring an expectation per file, it checks that `profile` chooses `h` for each payload that reaches `decode`. A capture that none of our registrations delivers is classified as `{ unregistered: "<why>" }`.

### 10.2 Units (in parallel, each in its own worktree)

| Unit | Files (exclusive) | Depends on | Acceptance | Size |
|---|---|---|---|---|
| **MH-W1 Codex** | `src/harness/codex.ts`, `test/harness/codex.test.ts`, expectations of `test/payloads/codex/` | W0 | Per-payload contract green; patch grammar and application (§6.1); relative paths ⇒ `unknown`; `callId` with a hash; encode with empty stdout on exit 2 and Stop with two keys | L |
| **MH-W2 Cursor** | `src/harness/cursor.ts`, its test and expectations | W0 | Per-payload contract; Shell with `cwd:""` and one or two roots; deny in Claude format at exit 0; Stop with `followup_message` and reentry via `loop_count` | S |
| **MH-W3 Grok** | `src/harness/grok.ts`, its test and expectations | W0 | Per-payload contract; `toolInputTruncated` on every tool; shutdown ⇒ `null`; reason ≤ 256 without `\n` | S |
| **MH-W4 agy** | `src/harness/agy.ts`, its test and expectations | W0 | Per-payload contract; append, range, closed keys; `send_command_input` ⇒ `shell-write`; missing `Cwd` with empty `workspacePaths` ⇒ `BAD` | M |
| **MH-W5 Reconstruction** | `src/reconstruct.ts` and its test | W0 | `append`, `oldnew` with a range, exact `hunks` with `anchor` and `eof`, `delete`, empty old that creates (MH-13) | M |
| **MH-W6 Core** | `src/gate.ts`, `src/decide.ts`, `src/state.ts`, and their tests | W0; W5 by interface | Overlay and `merge` (MH-09); MH-17 with no state; `rejected`; MH-33 by ctime; `FLOOR`; exit 3 and CLI redirection (MH-19); `engineHome` from `execPath` | L |
| **MH-W7 Edge** | `src/shell.ts`, `src/paths.ts`, `src/message.ts`, and their tests | W0 | `machineGlobs` with realpath; `hook-switch` always and the rest with a root; MH-29 words; interactive shell; relative destination on Codex; text of the new causes | M |
| **MH-W8 Launcher** | `assets/launcher.sh`, `test/launcher.e2e.test.ts` | W0 (protocol and MH-22 text) | §6.2 matrix on dash, bash 3.2, and `zsh -c` with the literal command; stderr invariant; own PATH | M |
| **MH-W9 Registration** | `src/register.ts`, `test/register.test.ts`, fixtures of real configs (Orca, ArkGate, cmux) | W0 | §6.1 `register` complete, including `drift` | M |
| **MH-W10 Machine** | `src/machine.ts`, `src/install.ts` (trimmed to MH-28), `assets/pre-commit.sh`, `assets/ci-github.yml`, `test/machine.e2e.test.ts` with a fake app-server | W0; W9 by interface | idempotent `HOME=<tmp> setup`; trust transaction with restore; `uninstall` that restores; `doctor` with a canary through `$SHELL -c`; update order | L |
| **MH-W11 Distribution** | `install.sh`, `scripts/build.ts` (tars + `SHA256SUMS`), `.github/workflows/release.yml` | W0 | Trial release on an `-rc` tag; verified MH-32 bootstrap on a clean machine; `PREGATE_ARCHIVE` + `PREGATE_SHA256` | S |
| **MH-W12 Real E2E** | `scripts/e2e-real.ts` | W0 (written against the MH-27 CLI; it runs after integration) | The §6.3 scenarios written and runnable with `PREGATE_REAL=1` | M |

### 10.3 Integration (MH-WI, in series, done by the orchestrator)

1. **W0**, in series.
2. In parallel: **W1–W5, W7, W8, W9, W11, W12**.
3. **W6** as soon as W5 is integrated (it consumes `apply`); **W10** as soon as W9 is integrated.
4. **MH-WI:** `src/main.ts` (`HARNESSES` map, `profile`, `Rejected`, `FLOOR`) and `src/cli.ts` (`setup`, `update`, `uninstall`, `doctor`). Then, complete §6.1 and §6.2 in CI, bench (p50 without a root ≤ 25 ms; Pre p95 ≤ 150 ms), and dogfooding.
5. **W12 runs** §6.3 with the five real CLIs. Each [E2E] is closed and noted in this document. An [E2E] that contradicts the design goes back to the owning unit.
6. Only then, and with the §11 decisions made, installation on the user's machine (D20), followed by `pregate doctor` green.

---

## 11. Decisions that require the user

| # | Question | Recommendation |
|---|---|---|
| U-1 | **Pilot migration.** The per-repo hooks have to come out of its `.claude/settings.json` and the committed launcher (MH-28), and its lock has to be recompiled with the current engine, 0.0.7 (MH-20). Teammates without the global install lose the session gate and their pre-commit asks them to install PREGATE. The alternative (FO-F23) is to keep the per-repo hook as a backup, with the `callId` deduplication that MH-04 no longer needs | Yes, in a single pilot PR, together with the install instruction. A single path for the hooks |
| U-2 | **Release downloads.** `pedroknigge/pregate` is public. Anonymous HTTPS downloads the release. `gh auth login` is only the fallback when that download fails | No extra repository grant. Use the installers in the [installation guide](guides/installation.md) |
| U-3 | **Codex trust.** `setup` grants it through app-server **only to the PREGATE keys whose definition is exactly what it wrote**, which is the same as approving them in `/hooks`. I understand D20's "yes" covers it. If a foreign hook loses trust, setup restores and fails: it never touches foreign trust | Confirm. If not, `setup` leaves it pending and `doctor` fails until it is approved by hand |
| U-4 | **New-version notice.** (a) `doctor` only; (b) one line in the pre-commit, at most once a day, from a background cached check with `gh`; (c) opt-in auto-update | (b): without a notice, nobody learns there is a new version, and the pre-commit is the only channel that exists on all five harnesses. Never auto-update |
| U-5 | **Machine protections always on (MH-17).** No agent, in any repo, can edit `~/.claude/settings*.json`, `~/.codex/{hooks.json,config.toml}`, `~/.grok/{config.toml,hooks/**}`, `~/.gemini/config/{hooks.json,config.json}`, or the PREGATE install, or run `pregate uninstall` or `agy plugin disable pregate`. That includes asking Claude to add a permission to `~/.claude/settings.json` (for example, with `/update-config`): the human does it | Yes. Without this, any session opened outside a repo with a preset can turn PREGATE off on the whole machine, and on Codex silently |
| U-6 | **Single registration for Claude, Cursor, and Grok (MH-04).** Cursor's `failClosed` is lost for failures where the inline `sh` does not even start, and Grok stays subject to its Claude compatibility switch (which the agent cannot touch and which the pre-commit detects). What is gained is not writing `~/.cursor/hooks.json` (Orca's, which a schema error invalidates entirely) and not having double evaluation | Yes |
| U-7 | **No committed launcher (MH-28).** The pre-commit uses the global `pregate` and CI downloads the engine the lock asks for. Every machine that commits in a repo with PREGATE needs the global install | Yes: it removes version skew when migrating a repo |

D15.9 ("does anyone use Grok?") is resolved by D20.
