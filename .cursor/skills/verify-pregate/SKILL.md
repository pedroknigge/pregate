---
name: verify-pregate
description: Build the Pregate CLI from this checkout, isolate HOME, and drive pregate enable, pregate doctor, pregate pack enable, and pregate hook pre --harness cursor (Write and Shell payloads). Use before a release, after a hook or consent change, or when a release needs evidence of what an enabled repository blocked and allowed.
---

# Verify Pregate against a real repository

Pregate enforces a project only where `pregate enable` ran. This skill builds the CLI from the checkout you have open, points `HOME` and the XDG directories at a temporary tree, and drives that binary the way Cursor's `preToolUse` hook does. It does not install into the operator's real `~/.local` or `XDG_DATA_HOME`.

The harness in these steps is Cursor. Payloads use the native shape in [src/harness/cursor.ts](../../../src/harness/cursor.ts). `cursor_version` is that file's `VERIFIED` value, `2026.11.11-043ef28`, the capture documented in [test/payloads/cursor/README.md](../../../test/payloads/cursor/README.md). A native Cursor reply is exit 0 for both decisions. Allow is `{"permission":"allow"}`. Deny is `{"permission":"deny","user_message","agent_message"}`. Empty stdout is not an allow.

Run every block below in one shell, from the checkout root, so `$verify_root`, `$PREGATE`, and `$repo` stay set. [scripts/build.ts](../../../scripts/build.ts) is the compiler. [scripts/real-repo-evidence.ts](../../../scripts/real-repo-evidence.ts) repeats this matrix on the pinned list.

## Launch

`compileBinary` in `scripts/build.ts` is the host compile `bun run scripts/build.ts` uses for one target. `PREGATE_TEST_BUILD` stays false, so the binary does not accept `PREGATE_TEST_ANSWER`. The full `bun run scripts/build.ts` also runs catalog fixtures and writes `dist/`; this launch does not.

```sh
set -euo pipefail
checkout=$(pwd)
original_home=$HOME
original_path=$PATH
original_tmpdir=${TMPDIR:-}
export PATH="${HOME}/.bun/bin:${PATH}"
verify_root=$(mktemp -d "${TMPDIR:-/tmp}/pregate-verify-XXXXXX")
export HOME="$verify_root/home"
export XDG_CONFIG_HOME="$verify_root/config"
export XDG_DATA_HOME="$verify_root/data"
export XDG_STATE_HOME="$verify_root/state"
export TMPDIR="$verify_root/tmp"
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL="$HOME/.gitconfig"
export CODEX_HOME="$HOME/.codex"
export GROK_HOME="$HOME/.grok"
unset CLAUDE_CONFIG_DIR OPENCODE_CONFIG_DIR PREGATE_TESTING PREGATE_TEST_ANSWER PREGATE_ACCEPT_CONTRACT
version=$(bun -p 'require("./package.json").version')
export PREGATE="$verify_root/engine/$version/pregate"
mkdir -p "$HOME" "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME" "$TMPDIR" "$(dirname "$PREGATE")"
export PATH="$(dirname "$PREGATE"):$PATH"
bun -e 'import { compileBinary, hostTarget } from "./scripts/build.ts"; compileBinary(hostTarget(), process.argv[1]);' "$PREGATE"
chmod +x "$PREGATE"
git config --global user.email "pregate-verify@example.com"
git config --global user.name "Pregate Verify"
git config --global commit.gpgsign false
```

`$PATH` lists the engine directory first. `command -v pregate` must print `$PREGATE`, not a global launcher. `engineHome` in [src/admission.ts](../../../src/admission.ts) is `dirname(dirname(process.execPath))`, the installation that owns protected paths. The binary sits at `$verify_root/engine/<package version>/pregate`, so that installation is `$verify_root/engine`. The scratch clone is under `$verify_root/tmp`, outside it. A binary at `$verify_root/bin/pregate` would protect the clone as installation state, and every command would be `protected-path`. `$CODEX_HOME` and `$GROK_HOME` stay unset as directories. An empty directory at either path is a harness home (`detect` in [src/machine.ts](../../../src/machine.ts)), and doctor would then report that home instead of no harness.

## Doctor

Read-only. Do not run `pregate setup`. Setup would write hook files into this temporary home.

Version and path, from `$checkout`:

```sh
version=$(bun -p 'require("./package.json").version')
core=$(bun -p 'require("./catalog/source.json").version')
test "$("$PREGATE" --version)" = "pregate $version (core $core)"
test "$(command -v pregate)" = "$PREGATE"
doctor_text=$("$PREGATE" doctor || true)
printf '%s\n' "$doctor_text" | grep -F "Local consent is inactive"
printf '%s\n' "$doctor_text" | grep -F "ERROR: No harness found; PREGATE gates nothing on this machine."
```

`pregate doctor` exits 1 in this home. The inactive-consent line is `status` in [src/consent.ts](../../../src/consent.ts): a preset in the checkout is not consent. The error line is `doctor` in [src/machine.ts](../../../src/machine.ts) when no Claude Code, Codex, Cursor, Grok, agy, or OpenCode install is visible. A warning that `pregate` on `PATH` is not `$XDG_DATA_HOME/pregate/bin/pregate` is expected: that path is the `pregate setup` launcher, and this binary is the checkout compile.

The fixture is one pinned commit of `sindresorhus/ky`, the same pin as `REPOS` in [scripts/real-repo-evidence.ts](../../../scripts/real-repo-evidence.ts). `init` writes the contract and, with `--yes` and `PREGATE_UNATTENDED_APPROVAL=1` already set, activates it (`activate: true` in [src/init.ts](../../../src/init.ts)). `enable` records consent again. Ordinary rules stay in shadow (`onboardingPreset` in [src/onboard.ts](../../../src/onboard.ts)). The shell guard and protected paths still deny.

```sh
scratch=$(mktemp -d "$TMPDIR/pregate-scratch-XXXXXX")
repo="$scratch/ky"
mkdir -p "$repo"
git -C "$repo" init -q
git -C "$repo" remote add origin https://github.com/sindresorhus/ky.git
git -C "$repo" fetch --depth 1 origin 3541888878c4d303a8bc2ad61815f4e048f55a5d
git -C "$repo" checkout -q -B pregate-verify FETCH_HEAD
test "$(git -C "$repo" rev-parse HEAD)" = "3541888878c4d303a8bc2ad61815f4e048f55a5d"
repo=$(realpath "$repo")
( cd "$repo" && PREGATE_UNATTENDED_APPROVAL=1 "$PREGATE" init --yes )
( cd "$repo" && PREGATE_UNATTENDED_APPROVAL=1 "$PREGATE" enable --yes )
status_text=$(cd "$repo" && "$PREGATE" status)
printf '%s\n' "$status_text" | grep -F "Local consent is active"
if printf '%s\n' "$status_text" | grep -F "Nothing is enforced"; then
  printf '%s\n' "status still says nothing is enforced" >&2
  exit 1
fi
```

Hook entry, after enable. Cursor Shell with an empty `cwd` and one `workspace_roots` entry is the workspace root ([src/harness/cursor.ts](../../../src/harness/cursor.ts)). `pregate status` is allowed in an enabled project ([docs/guarantees.md](../../../docs/guarantees.md)).

```sh
bun -e 'const [repo,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Shell",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{command:"pregate status",cwd:""}}))' "$repo" verify-status \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$verify_root/status-decision.json"
grep -q '"permission":"allow"' "$verify_root/status-decision.json"
```

## Drive

Feed Cursor `Write` payloads for the edit gate. The hook does not write the file. On deny, leave the tree alone and check the witness. On allow, write the payload, which is what the harness would do after `{"permission":"allow"}`.

Denied shell script. The file must stay absent.

```sh
test ! -e "$repo/scripts/agent-disable.sh"
content=$'#!/bin/sh\npregate disable --yes\n'
bun -e 'const [repo,file,content,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Write",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{file_path:file,content}}))' "$repo" "$repo/scripts/agent-disable.sh" "$content" verify-script \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$verify_root/script-decision.json"
grep -q '"permission":"deny"' "$verify_root/script-decision.json"
test ! -e "$repo/scripts/agent-disable.sh"
```

Denied preset replace. The bytes of `.pregate/preset.json` stay the file `init` wrote.

```sh
before=$(sha256sum "$repo/.pregate/preset.json" | awk '{print $1}')
bun -e 'const [repo,file,content,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Write",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{file_path:file,content}}))' "$repo" "$repo/.pregate/preset.json" "{}" verify-preset \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$verify_root/preset-decision.json"
grep -q '"permission":"deny"' "$verify_root/preset-decision.json"
test "$(sha256sum "$repo/.pregate/preset.json" | awk '{print $1}')" = "$before"
```

Allowed note. Write it only after allow.

```sh
note=$'Passing edit. This note does not change project code.\n'
bun -e 'const [repo,file,content,id]=process.argv.slice(1); process.stdout.write(JSON.stringify({hook_event_name:"preToolUse",session_id:"verify-pregate",generation_id:id,tool_use_id:id,tool_name:"Write",cursor_version:"2026.11.11-043ef28",workspace_roots:[repo],user_email:"verify@example.com",tool_input:{file_path:file,content}}))' "$repo" "$repo/notes/agent-pass.txt" "$note" verify-note \
  | ( cd "$repo" && "$PREGATE" hook pre --harness cursor ) > "$verify_root/note-decision.json"
grep -q '"permission":"allow"' "$verify_root/note-decision.json"
mkdir -p "$repo/notes"
printf '%s' "$note" > "$repo/notes/agent-pass.txt"
test -s "$repo/notes/agent-pass.txt"
```

Shell payloads, pack enable, and disable are the same `hook pre --harness cursor` invocation with `tool_name` `Shell` and `tool_input.command` set to the command line. The feature files list each command. Do not execute a denied command. `git commit --no-verify`, `pregate disable --yes`, `pregate pack enable architecture/structure --yes`, and `node -e 'require("fs").writeFileSync("agent-out.txt", "x")'` are denials after enable. The same `git commit --no-verify` line is an allow before enable. `git status --short` and `node -e "console.log(1)"` stay allowed after enable.

## Evidence

Write the proof under the checkout, not under `$verify_root`. The helper writes `real-repos.md` and `real-repos.json` in the same directory.

```sh
version=$(bun -p 'require("./package.json").version')
mkdir -p "$checkout/evidence/$version"
proof="$checkout/evidence/$version/skill-proof.md"
{
  printf '%s\n' "# Skill proof"
  printf '\n'
  printf '%s\n' "$("$PREGATE" --version)."
  printf '\n'
  printf '%s\n' "Repository sindresorhus/ky at 3541888878c4d303a8bc2ad61815f4e048f55a5d. Feature: edit gate."
  printf '\n'
  printf '%s\n' "## Doctor"
  printf '\n'
  printf '%s\n' '```text'
  printf '%s\n' "$doctor_text"
  printf '%s\n' '```'
  printf '\n'
  printf '%s\n' "## Denied shell script"
  printf '\n'
  printf '%s\n' '```json'
  cat "$verify_root/script-decision.json"
  printf '%s\n' '```'
  printf '\n%s\n' "Side effect: scripts/agent-disable.sh was not written."
  printf '\n'
  printf '%s\n' "## Denied preset replace"
  printf '\n'
  printf '%s\n' '```json'
  cat "$verify_root/preset-decision.json"
  printf '%s\n' '```'
  printf '\n%s\n' "Side effect: .pregate/preset.json SHA-256 unchanged ($before)."
  printf '\n'
  printf '%s\n' "## Allowed note"
  printf '\n'
  printf '%s\n' '```json'
  cat "$verify_root/note-decision.json"
  printf '%s\n' '```'
  printf '\n%s\n' "Side effect: notes/agent-pass.txt was written after allow."
} > "$proof"
test -s "$proof"
```

## Cleanup

Remove the temporary root. The scratch clone lives under `$verify_root/tmp`, so this removes the clone, the binary, the git identity, and the consent records. It does not remove `$checkout/evidence`.

```sh
rm -rf "$verify_root"
test ! -e "$verify_root"
test -s "$proof"
printf '\nEvidence file remains after cleanup.\n' >> "$proof"
export HOME="$original_home"
export PATH="$original_path"
if [ -n "$original_tmpdir" ]; then export TMPDIR="$original_tmpdir"; else unset TMPDIR; fi
unset XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME GIT_CONFIG_GLOBAL GIT_CONFIG_NOSYSTEM CODEX_HOME GROK_HOME PREGATE
```

`$proof` is under `$checkout`. The append above is the check that the file is still there after `$verify_root` is gone.

## Helpers

The executable helper is [scripts/real-repo-evidence.ts](../../../scripts/real-repo-evidence.ts). From the checkout, with Bun on `PATH`:

```sh
bun scripts/real-repo-evidence.ts
bun scripts/real-repo-evidence.ts --repo sindresorhus/ky
bun scripts/real-repo-evidence.ts --out "evidence/$(bun -p 'require("./package.json").version')"
```

`--repo` selects a name from the pinned `REPOS` array. The default run clones all five, writes `evidence/<package version>/real-repos.md` and `real-repos.json`, then deletes its temporary HOME. A false positive, a false negative, a witness that changed on deny, or an enable that did not stick exits 1 after the report is written.

Feature notes: [features/README.md](features/README.md).
