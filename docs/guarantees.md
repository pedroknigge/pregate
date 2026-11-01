# Guarantees and residual limits

Pre denies an agent tool call when the command text or the edited bytes are enough to show one of the following. The check is the real `hook pre` entrypoint. It does not run the command.

## What is denied

- A literal `pregate` control command: `approve` (except `approve --preview` with no `--yes` or `--digest`), `disable`, `enable`, `uninstall`, `setup`, `install`, `update` (except a preview with no `--yes`), and `pack enable|disable|remove|add|apply|update` without a preview. A `CI=` assignment binds only the command it prefixes and that command's children: `CI=1 pregate …` and `CI=1 sh -c 'pregate …'` are denied, `CI=1 bun test && pregate status` is not.
- The same invocation inside inline interpreter code: `python -c` / `python3 -c`, `node -e` / `--eval`, `bun -e`, `deno eval`, `perl -e`, `ruby -e`, `php -r`, and a heredoc or stdin script the shell lexer can see.
- The same invocation in a literal script those interpreters execute (`python3 attack.py`, `python3 < attack.py`, `python3 - < attack.py`), in a literal shell script run by path or fed on stdin (`bash ./run.sh`, `./run.sh`, `./run` without a suffix, `bash < run.sh`, `bash -s < run.sh`), and in a literal Makefile (`make approve`, `make -f Makefile`). A file that starts with a NUL byte in its first 8 KiB is a binary, not a script.
- Writing or editing a shell script, a Makefile, or a shebang program whose resulting text contains one of those invocations.
- Writing or editing user-level harness settings and the install/launcher paths, including `~/.claude/settings.json`, Cursor `hooks.json` and `cli-config.json`, Codex `hooks.json` and `config.toml`, Grok `config.toml`, Antigravity/agy `~/.gemini/config/config.json` and `hooks.json`, `~/.local/bin/pregate`, and the data-directory launcher. This matches the shell guard when the hook is running for an enabled project (the process directory or `CLAUDE_PROJECT_DIR`, `CURSOR_PROJECT_DIR`, or `GROK_WORKSPACE_ROOT`), including a fresh session that has not registered that root yet.
- Hook-trust edits in that scanned text (`trusted_hash` assignment, `hooks.state` assignment, `--dangerously-bypass-hook-trust`) and any mention of `PREGATE_TESTING` or `PREGATE_TEST_ANSWER`.

`pregate guide --preview`, `pregate approve --preview`, and `pregate status` stay allowed. When stdout is not a terminal, the approval code is also withheld unless `CI` or `PREGATE_TESTING=1` is already set. That withholding is not the control. `pregate approve` (including `approve <code>` and `--yes --digest`), `enable`, `disable` and `uninstall` apply only when:

- `PREGATE_TESTING=1` supplies `PREGATE_TEST_ANSWER` on a test build, or
- `CI` is already set and the command passes `--yes` or a code, or
- stdin is an interactive terminal and the human types `y` on `/dev/tty` (or `CONIN$` on Windows).

A pipe, including one that contains `y`, is not that channel. Recomputing the digest from the proposal file does not satisfy it. An agent shell cannot set `PREGATE_*` or prefix `CI=` onto `pregate`.

Reads are not hooked (MH-22): the Pre matcher stays a closed list of edit and command tools, so a project that never ran `pregate enable` pays nothing for a `Read`, `Grep` or `Glob`. The pending-proposal file is readable by a tool that reads files; what it holds is the digest, and knowing the digest is not approval (the terminal rule above). The shell guard still denies shell reads of the proposal directory.

Benign commands stay allowed: `python3 -c "print(1 + 1)"`, `node -e "console.log(1)"`, `pregate status`, a shell script that only echoes, and `make` on a Makefile that does not name a control command. Prose is not an invocation: a comment line that mentions `pregate` followed by a line that starts with `install:` or `update()`, and a comment such as `# CI = GitHub Actions; run pregate status`, are not denied. The scan drops lines that are only a comment and does not let plain whitespace join `pregate` to a verb on the next line; a quoted argument list (`'pregate',` then a quoted verb on the next line) is still one invocation.

## Residual limits

These are heuristics over text, not a sandbox.

- The scan does not execute the program, expand variables, or decode encodings. Concatenation (`'pre' + 'gate'`), `base64`, `chr()`/`bytes` built strings, and a variable whose value is not in the scanned text are not recognized.
- Only the first 1 MiB of a literal file or of an inline program is judged; a control command after that point is not seen. A non-literal path is not read (`bash "$SCRIPT"`, `make -f "$FILE"`, `python3 "$PROGRAM"`, `bash < "$SCRIPT"`), and neither is a command found on `PATH` by bare name (`run` as opposed to `./run`).
- A comment that is not a whole line (`echo ok # pregate approve x`) is scanned like code; a control command hidden in a string that is never executed is denied like one that is.
- A Write of a `.py` or `.js` file that is not a shebang script is not denied for control text. Executing that file with a literal interpreter command is denied when the file text contains a control invocation. `python3 -c 'exec(open("a.py").read())'` is denied only when that one-liner itself names a control command.
- Knowing the digest is not approval. Outside `CI` and the test hook, apply still waits for `y` on `/dev/tty` or `CONIN$`. A process that already has `CI` set can pass `--yes` or a code without that prompt; assigning `CI` on the command that runs pregate, or on an ancestor of it, is denied. A harness `!` command whose stdin is not a terminal cannot approve; the printed instructions say so.
- `pregate setup` and `pregate update` are denied to the agent but do not ask the human for `y`: they add or refresh protection rather than remove it.
- `script`, `tmux`, and `screen` are denied as interactive sessions. Another pty allocator can still give a child a terminal, and a terminal prints the approval code.
- Unknown shell syntax is not denied by itself. A command run outside every enabled project, with no project directory variable pointing at one, does not gain machine path protection. That is the same no-consent rule as the rest of Pre.

## What the adversarial suite holds pregate to

`test/adversarial.e2e.test.ts` runs the compiled `pregate` binary against disposable
git repositories. The table is the claim those runs lock in. **Sound** means the
attack in that row cannot pass a consented check or hook. **Best-effort** means
pregate covers a stated slice and misses the rest on purpose or because the
comparison does not see it. **Not applicable** means the boundary belongs to
something outside pregate.

`no-new` (see `src/ratchet.ts`) counts violations. It does not prove two programs
are the same.

### Ratchet (`no-new`)

| Case | Verdict | What the binary does |
| --- | --- | --- |
| Violation moved inside the same symbol | Sound | The count for that rule and symbol is unchanged, so the move is not new debt. A second site in the same symbol is denied. |
| One violation removed and a different one added in the same function | Sound | Swapping two matches of the same rule is net zero. A different rule is not compensation and is denied. |
| Equivalent code in different syntax | Best-effort | Modeled forms of one rule (`as unknown as`, parentheses, `as any as`) stay one violation and are denied when newly introduced. Pregate does not decide that arbitrary programs are equivalent. |
| Symbol renamed, duplicated, or extracted | Sound | An unchanged function body in the same file keeps its debt across a rename (`parseBody` to `parseBody2`), a move onto another symbol, or an extraction that leaves the old name with a different body. The declared name is outside the body hash. Only the violations the old symbol no longer carries can follow its body, each once: a copy next to an original that still has the violation, with the same body or a changed one, is new debt. A body moved into a different file is not paired. |
| Import hidden behind a barrel or a path alias | Sound | A re-export and a `tsconfig` `paths` alias are resolved, including a package name that an alias points at a local file. A chain past three re-export hops fails closed (`unresolvable-import` or the layer edge on the hop that is still visible). |

### Trust boundaries

| Case | Verdict | What the binary does |
| --- | --- | --- |
| Config or lock tampering | Sound | `check` rebuilds the lock and rejects bytes that are not the compiler's output. A hook write while that lock is stale is `lock-stale`. A preset write is denied and not applied (an invalid document is an invalid contract change; other files under `.pregate/` are `protected-path`). `git commit --no-verify` is `shell-admin`. |
| Symlink that leaves the repository | Best-effort | A new symlink is read through, so its target is judged. An edit or shell redirect whose spelled path the lock judges, and whose real target sits in no enabled root, is denied (`protected-path`). A target in another enabled root, such as a nested one, is judged by that root. A spelled path out of scope stays out of scope. Two gaps are skipped below. |
| Parallel worktrees and consent | Sound | Enabling one checkout consents every linked worktree of that repository. A clone does not inherit it. Disabling a worktree withdraws the shared consent; a checkout that was enabled by name stays enabled, and a worktree added afterwards is inert until enabled. |
| Partial or invalid reconstructed edit | Sound | An edit whose old text is missing or not unique is `tool-will-fail`. A patch that does not match, and a pure insertion hunk, are `cannot-reconstruct`. An exact unique edit of clean code is allowed. |
| Hook process fails midway | Sound | The real engine exiting 1 is a denial, not an allow. A supervised child that prints an allow and then exits after the `rules` checkpoint does not have that stdout forwarded. The same failure against a directory with no consent stays inert. Killing the supervisor itself is not applicable: the harness owns that process. |

### Known gaps

These tests are skipped. They record a limit rather than a passing attack.

- **External target of a committed symlink.** Git diffs the link text. Changing the file outside the repo, without a hook write through the in-repo path, is not a `check --ratchet` diff.
- **Directory symlink out of the repo.** The workspace walk does not follow a symlink directory, and git lists the link rather than the files behind it. Violations that exist only there are not in the diff.
