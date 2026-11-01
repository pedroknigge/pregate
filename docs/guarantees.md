# Guarantees and residual limits

Pre denies an agent tool call when the command text or the edited bytes are enough to show one of the following. The check is the real `hook pre` entrypoint. It does not run the command.

## What is denied

- A literal `pregate` control command: `approve` (except `approve --preview` with no `--yes` or `--digest`), `disable`, `enable`, `uninstall`, `setup`, `install`, `update` (except a preview with no `--yes`), and `pack enable|disable|remove|add|apply|update` without a preview.
- The same invocation inside inline interpreter code: `python -c` / `python3 -c`, `node -e` / `--eval`, `bun -e`, `deno eval`, `perl -e`, `ruby -e`, `php -r`, and a heredoc or stdin script the shell lexer can see.
- The same invocation in a literal script those interpreters execute (`python3 attack.py`), in a literal shell script (`bash ./run.sh`, `./run.sh`), and in a literal Makefile (`make approve`, `make -f Makefile`).
- Writing or editing a shell script, a Makefile, or a shebang program whose resulting text contains one of those invocations.
- Writing or editing user-level harness settings and the install/launcher paths, including `~/.claude/settings.json`, Cursor `hooks.json` and `cli-config.json`, Codex `hooks.json` and `config.toml`, Grok `config.toml`, Antigravity/agy `~/.gemini/config/config.json` and `hooks.json`, `~/.local/bin/pregate`, and the data-directory launcher. This matches the shell guard when the hook is running for an enabled project (the process directory or `CLAUDE_PROJECT_DIR`, `CURSOR_PROJECT_DIR`, or `GROK_WORKSPACE_ROOT`), including a fresh session that has not registered that root yet.
- Hook-trust edits in that scanned text (`trusted_hash` assignment, `hooks.state` assignment, `--dangerously-bypass-hook-trust`) and any mention of `PREGATE_TESTING` or `PREGATE_TEST_ANSWER`.

`pregate guide --preview`, `pregate approve --preview`, and `pregate status` stay allowed. When stdout is not a terminal, the approval code and the `Digest:` line are replaced with a withheld marker. A human terminal still prints the code. So does a process that already has `CI` set (this repo's tests and a CI job) or `PREGATE_TESTING=1`. An agent shell cannot set `PREGATE_*` or prefix `CI=` onto a `pregate` command (both are hook switches). Inline code that mentions `PREGATE_TESTING` / `PREGATE_TEST_ANSWER`, or that sets `CI` and names `pregate`, is denied.

Benign commands stay allowed: `python3 -c "print(1 + 1)"`, `node -e "console.log(1)"`, `pregate status`, a shell script that only echoes, and `make` on a Makefile that does not name a control command.

## Residual limits

These are heuristics over text, not a sandbox.

- The scan does not execute the program, expand variables, or decode encodings. Concatenation (`'pre' + 'gate'`), `base64`, `chr()`/`bytes` built strings, and a variable whose value is not in the scanned text are not recognized.
- Only the first 1 MiB of a literal file is read. A non-literal path is not read (`bash "$SCRIPT"`, `make -f "$FILE"`, `python3 "$PROGRAM"`).
- A Write of a `.py` or `.js` file that is not a shebang script is not denied for control text. Executing that file with a literal interpreter command is denied when the file text contains a control invocation. `python3 -c 'exec(open("a.py").read())'` is denied only when that one-liner itself names a control command.
- `pregate approve <code>` and `--yes` still apply a code the process already knows. The in-harness human `!` route and human automation depend on that. Withholding the code from captured stdout does not stop a caller who obtained it another way.
- The Read tool is not in the Pre matcher. An agent that can read the pending proposal JSON under the data directory can recompute its SHA-256. Shell and edit access to that directory is protected; a raw read is not.
- If `CI` is already set in the process environment, previews include the approval code. Assigning `CI` on the `pregate` command itself is denied. A subshell that exports `CI` only for a later process the guard does not model as the same shell (`CI=1 python3 -c 'import os; os.environ["CI"]="1"'` with the `pregate` call built at runtime) is not fully covered; the inline text is denied when both `CI` and `pregate` appear in it.
- `script`, `tmux`, and `screen` are denied as interactive sessions. Another pty allocator can still give a child a terminal, and a terminal prints the approval code.
- Unknown shell syntax is not denied by itself. A command run outside every enabled project, with no project directory variable pointing at one, does not gain machine path protection. That is the same no-consent rule as the rest of Pre.
