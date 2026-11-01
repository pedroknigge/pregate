# Guarantees and residual limits

Pre denies an agent tool call when the command text or the edited bytes are enough to show one of the following. The check is the real `hook pre` entrypoint. It does not run the command.

## What is denied

- A literal `pregate` control command: `approve` (except `approve --preview` with no `--yes` or `--digest`), `disable`, `enable`, `uninstall`, `setup`, `install`, `update` (except a preview with no `--yes`), and `pack enable|disable|remove|add|apply|update` without a preview.
- The same invocation inside inline interpreter code: `python -c` / `python3 -c`, `node -e` / `--eval`, `bun -e`, `deno eval`, `perl -e`, `ruby -e`, `php -r`, and a heredoc or stdin script the shell lexer can see.
- The same invocation in a literal script those interpreters execute (`python3 attack.py`), in a literal shell script (`bash ./run.sh`, `./run.sh`), and in a literal Makefile (`make approve`, `make -f Makefile`).
- Writing or editing a shell script, a Makefile, or a shebang program whose resulting text contains one of those invocations.
- Writing or editing user-level harness settings and the install/launcher paths, including `~/.claude/settings.json`, Cursor `hooks.json` and `cli-config.json`, Codex `hooks.json` and `config.toml`, Grok `config.toml`, Antigravity/agy `~/.gemini/config/config.json` and `hooks.json`, `~/.local/bin/pregate`, and the data-directory launcher. This matches the shell guard when the hook is running for an enabled project (the process directory or `CLAUDE_PROJECT_DIR`, `CURSOR_PROJECT_DIR`, or `GROK_WORKSPACE_ROOT`), including a fresh session that has not registered that root yet.
- Hook-trust edits in that scanned text (`trusted_hash` assignment, `hooks.state` assignment, `--dangerously-bypass-hook-trust`) and any mention of `PREGATE_TESTING` or `PREGATE_TEST_ANSWER`.

`pregate guide --preview`, `pregate approve --preview`, and `pregate status` stay allowed. When stdout is not a terminal, the approval code is also withheld unless `CI` or `PREGATE_TESTING=1` is already set. That withholding is not the control. `pregate approve` (including `approve <code>` and `--yes --digest`) applies only when:

- `PREGATE_TESTING=1` supplies `PREGATE_TEST_ANSWER` on a test build, or
- `CI` is already set and the command passes `--yes` or a code, or
- stdin is an interactive terminal and the human types `y` on `/dev/tty` (or `CONIN$` on Windows).

A pipe, including one that contains `y`, is not that channel. Recomputing the digest from the proposal file does not satisfy it. An agent shell cannot set `PREGATE_*` or prefix `CI=` onto `pregate`.

The shared Pre matcher (Claude Code, and Cursor and Grok when they use that registration) includes `Read`, `Grep`, and `Glob`. A read, search, or glob of the pending-proposal directory, or of the data directory that contains it, is denied. A search rooted above that directory is denied when its path or pattern names `pregate` or `proposals`. Reads of ordinary project files stay allowed. Codex and agy have no captured read tool in this registration; their shell guard still denies reading the directory.

Benign commands stay allowed: `python3 -c "print(1 + 1)"`, `node -e "console.log(1)"`, `pregate status`, a shell script that only echoes, and `make` on a Makefile that does not name a control command.

## Residual limits

These are heuristics over text, not a sandbox.

- The scan does not execute the program, expand variables, or decode encodings. Concatenation (`'pre' + 'gate'`), `base64`, `chr()`/`bytes` built strings, and a variable whose value is not in the scanned text are not recognized.
- Only the first 1 MiB of a literal file is read. A non-literal path is not read (`bash "$SCRIPT"`, `make -f "$FILE"`, `python3 "$PROGRAM"`).
- A Write of a `.py` or `.js` file that is not a shebang script is not denied for control text. Executing that file with a literal interpreter command is denied when the file text contains a control invocation. `python3 -c 'exec(open("a.py").read())'` is denied only when that one-liner itself names a control command.
- Knowing the digest is not approval. Outside `CI` and the test hook, apply still waits for `y` on `/dev/tty` or `CONIN$`. A process that already has `CI` set can pass `--yes` or a code without that prompt; assigning `CI` on the command is denied. A harness `!` command whose stdin is not a terminal cannot approve.
- Codex and agy do not send `Read` / `Grep` / `Glob` on the captured Pre registration. A read tool with an uncaptured name is not matched. Grok is covered when it uses those three names.
- A Glob or Grep of `/` or the home directory whose pattern does not mention `pregate` or `proposals` is not denied. Shell reads of the proposal directory remain denied.
- `script`, `tmux`, and `screen` are denied as interactive sessions. Another pty allocator can still give a child a terminal, and a terminal prints the approval code.
- Unknown shell syntax is not denied by itself. A command run outside every enabled project, with no project directory variable pointing at one, does not gain machine path protection. That is the same no-consent rule as the rest of Pre.
