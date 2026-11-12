# Guarantees and residual limits

Pre denies an agent tool call when the command text or the edited bytes are enough to show one of the following. The check is the real `hook pre` entrypoint. It does not run the command.

## What is denied

- A literal `pregate` control command: `approve` (except `approve --preview` with no `--yes` or `--digest`), `disable`, `enable`, `uninstall`, `prepare`, `setup`, `install`, `update` (except a preview with no `--yes`), `pack enable|disable|remove|add|apply|update` without a preview, `preset compile`, `preset apply` without `--preview`, `init` and `promote` unless they are a preview, `feedback apply`, `storage apply`, and `issue submit`. A verb the scan cannot read literally (`pregate "$VERB"`, `pregate $(…)`) is treated as a control command. A `CI=` assignment on a `pregate` command is still denied, although `CI` no longer approves anything.
- Assigning or exporting `PREGATE_UNATTENDED_APPROVAL`, `PREGATE_ACCEPT_CONTRACT`, `PREGATE_TESTING` or `PREGATE_TEST_ANSWER`, and naming PREGATE's own records (`pregate/consent`, `pregate/sessions`, `pregate/contract-approvals`, `pregate/pending`, `pregate/proposals`, `pregate/reached`) in a script or inline program.
- The same invocation inside inline interpreter code: `python -c` / `python3 -c`, `node -e` / `--eval`, `bun -e`, `deno eval`, `perl -e`, `ruby -e`, `php -r`, and a heredoc or stdin script the shell lexer can see.
- Inline interpreter code that reaches a write or exec sink, whatever its file names look like: in Python an `os`/`shutil`/`subprocess`/`pathlib` call, `exec`/`eval`/`__import__`, an import outside a short read-only list, or `open` in a mode other than read; in Node, Bun and Deno `require`, `import`, `fs`, `child_process`, `eval`/`Function`, `process` members that are not read-only, and computed member access; the equivalent calls in Perl, Ruby and PHP. It is a write (`shell-write`) inside an enabled root. Read-only one-liners (`print(1 + 1)`, `console.log(1)`, `require("./package.json").version` under `node -p`) stay allowed.
- The same sink list on a literal script file those interpreters execute (`node writer.js`, `python3 attack.py`, `sh w.sh`, `powershell -File run.ps1`, a `./deploy`, and the same fed on stdin). A bare command name found on `PATH` is read the same way when its real file lies inside an enabled project, such as `node_modules/.bin`; an installed tool outside every project (`npm`, `npx`, `pip`) is read for control commands only, like the native tools that are not read at all. The file is unreadable, undecodable, or larger than 64 MiB → `shell-write` or `shell-admin`. A native executable is not scanned.
  - Two limits on the write sinks, so that a project's own programs run (`node tests/index.js`, `node --test`, `node --check`, `bun src/main.ts`). They do not apply to control invocations, which are denied as before.
    - A script whose text is the text it had when the session began is the project's program and is not read for write sinks. The base is the commit the session began on, or the dirty text recorded at the session start. A script that the session wrote, changed or committed, an untracked or ignored file (`node_modules/.bin/mocha`), and a file outside every enabled root are read.
    - A node, bun or deno script that the session changed keeps running while it gains no sink: the same writer modules as its base text and no more uses of any sink name, where a name counts with its member (`fs.readFileSync` and `fs.writeFileSync` are two). A test file that already imports `vm` and gets more assertions runs; one more call through `fs` or `vm`, or a new writer module, is denied.
    - A script file that node, bun or deno runs is read by the rules for a file. An `import` or `require` in its literal form is not a sink unless it names a module that writes files or starts programs (`fs`, `child_process`, `worker_threads`, `cluster`, `vm`, `module`, `bun`, `fs-extra`, `execa`, `shelljs` and similar). Any other use of `require` or `import`, and `fs`, `child_process`, `vm`, `eval`, `Function`, `Bun`, `Deno`, `WebAssembly`, `Worker` and the non-reporting members of `process`, are sinks. Inline code (`node -e`) keeps the full list.
- The same invocation in a literal script those interpreters execute (`python3 attack.py`, `python3 < attack.py`, `python3 - < attack.py`), in a literal shell script run by path or fed on stdin (`bash ./run.sh`, `./run.sh`, `./run` without a suffix, `bash < run.sh`, `bash -s < run.sh`), in a literal PowerShell or cmd script (`powershell -File x.ps1`, `.cmd`, `.bat`), and in a literal Makefile (`make approve`, `make -f Makefile`). The whole file is read: a control command after any amount of padding is seen, and a file larger than 64 MiB is denied rather than skipped. A backslash, backtick or caret before a line break joins the two lines first, so `pregate \` then `disable` on the next line is one invocation. UTF-8, UTF-16 and UTF-32 files (with or without a byte-order mark) are decoded; a file with NUL bytes that decodes as none of them is denied (`shell-admin`), and a native executable (ELF, Mach-O, PE) is not a script.
- `rsync`, `tar`/`unzip` extraction, and in-place formatters or fixers (`prettier --write`, `eslint --fix`, `ruff check --fix`, `biome` with `--write`, `gofmt -w`, and the like) whose destination or target path resolves inside an enabled root. List-only archive flags (`tar -t`), dry runs, and check-only formatters (`prettier --check`) stay allowed.
- Inside an enabled root, an interpreter or `make` whose script argument is not literal (`bash "$SCRIPT"`, `sh "$X"`, `bash < "$S"`, `python3 "$P"`, `node "$P"`, `make -f "$F"`, `powershell -File $P`). It is a write (`shell-write`). A bare command name (`deploy`, as opposed to `./deploy`) is resolved on `PATH` and, when that file is a script, scanned: like a literal path when its real file is inside an enabled project, and for control commands only when it is an installed tool outside every project. A read-only one-liner and a literal script path stay allowed. The denial says why the command was refused and how to name the script literally.
- A Git command that moves history or the worktree inside an enabled root: `reset` with `--hard`, `--merge`, `--keep` or a commit (not `--soft`), `checkout <commit>` (including `--detach`), `switch` (including `--detach`), `stash` (push, `-u`, pop, apply, branch), `clean -f` (not `-n`), `cherry-pick`, `revert`, `read-tree` and `checkout-index`. PREGATE asks Git (read-only) which files the command would change and judges them as writes: a change under `.pregate/` is `protected-path`, any other in-scope file is a write. A form whose files Git cannot list, or a non-literal command, is denied as `shell-write`. `merge`, `rebase`, `pull` and `am` are not judged here; their result is judged by Stop, the pre-commit check and the CI ratchet like any other tree.
- Writing or editing a shell script, a Makefile, or a shebang program whose resulting text contains one of those invocations.
- Writing or editing user-level harness settings and the install/launcher paths, including `~/.claude/settings.json`, Cursor `hooks.json` and `cli-config.json`, Codex `hooks.json` and `config.toml`, Grok `config.toml`, Antigravity/agy `~/.gemini/config/config.json` and `hooks.json`, `~/.local/bin/pregate`, and the data-directory launcher. This matches the shell guard when the hook is running for an enabled project (the process directory or `CLAUDE_PROJECT_DIR`, `CURSOR_PROJECT_DIR`, or `GROK_WORKSPACE_ROOT`), including a fresh session that has not registered that root yet.
- Hook-trust edits in that scanned text (`trusted_hash` assignment, `hooks.state` assignment, `--dangerously-bypass-hook-trust`) and any mention of `PREGATE_TESTING` or `PREGATE_TEST_ANSWER`.

`pregate guide --preview`, `pregate approve --preview`, and `pregate status` stay allowed. So do the commands that read the project or prepare one review for the human: `pregate layers`, `pregate layers apply <map.json> --preview`, `pregate compile <rules.md>`, `pregate compile apply <proposals.json> --preview`, and `pregate import arkgate --preview` (optional `--config <path>`), with every word literal and no `--yes` or `--digest`. When stdout is not a terminal, the approval code is also withheld unless `PREGATE_UNATTENDED_APPROVAL=1` or `PREGATE_TESTING=1` is already set. That withholding is not the control. `pregate approve` (including `approve <code>` and `--yes --digest`), `enable`, `disable`, `uninstall`, and a `preset compile` that would write a looser lock apply only when:

- `PREGATE_TESTING=1` supplies `PREGATE_TEST_ANSWER` on a test build, or
- `PREGATE_UNATTENDED_APPROVAL=1` is already set in the environment of the process and the command passes `--yes` or a code (an unattended CI job opts in this way; `CI` alone does not, because tools and agent sessions set it), or
- stdin is an interactive terminal and the human types `y` on `/dev/tty` (or `CONIN$` on Windows).

A pipe, including one that contains `y`, is not that channel. Recomputing the digest from the proposal file does not satisfy it. An agent shell cannot set `PREGATE_*` or prefix `CI=` onto `pregate`. A harness that starts the agent with `PREGATE_UNATTENDED_APPROVAL=1` already in its environment gives the agent the same power as that CI job: do not set it where an agent runs.

Every harness denies an approval command the agent issues and names the human route instead: `! pregate approve <code>` typed by the human in Claude Code, Codex, Grok or agy, or the command in a separate terminal for Cursor. No harness permission prompt can approve on the human's behalf.

## Contract loosening

A change that makes the contract looser (a rule's enforcement from `enforce` to `advisor` or `shadow`, a project default lowered, a rule removed or downgraded) is compared against a reference, not trusted because the lock matches the preset:

- **Stop** compares the lock at the start of the session with the lock on disk, and **pre-commit** (`check --staged`) compares `HEAD` with the staged lock. Both block (`contract-loosened`) unless this machine holds a human approval record for that exact lock: `pregate approve`, `pregate preset apply` and `pregate preset compile` write one after the human confirms at the terminal. The records live under the user's data directory; a process running as the same user can forge them, so they keep an honest agent on track and are not the boundary.
- **`check --ratchet`** compares the base lock with the head lock and fails on any loosening, whatever local records say. It prints a digest of that exact base and head pair. The check passes only when `PREGATE_ACCEPT_CONTRACT` in the job's environment lists that digest. The CI template reads it from the repository variable `vars.PREGATE_ACCEPT_CONTRACT`, which a pull request cannot change. This is the boundary: protect `.pregate/` and `.github/workflows/` with CODEOWNERS and required reviews, or a pull request can rewrite the workflow that runs the check. The template runs the engine that the base branch's lock pins, so a change cannot pick an older engine that lacks this check by editing its own lock.
- **The Vercel build** runs that same check before the framework build. A preview reads the engine pin from the merge base with the production branch, not from the commit being built. A non-zero exit fails the deployment. `vercel.json` and `scripts/pregate-vercel-build.sh` are part of the change under review, just like a workflow file: protect them with CODEOWNERS. `pregate ci status` fails closed when a required provider (Actions, Vercel, or both) is missing, still running, or failing.
- `preset compile` without a human at the terminal refuses to write a looser lock. A script that edits the preset and recompiles is a control command for the shell guard; the compile itself still asks.

## Consent removed during a session

Consent records and session state live in the user's data and state directories, which any process of that user can change. PREGATE cannot prevent that; it detects it. When a root the session reached is disabled or its consent record is gone, Stop says so in its notice, and `pregate status` warns for a day after any recorded session of that root.

Reads are not hooked (MH-22): the Pre matcher stays a closed list of edit and command tools, so a project that never ran `pregate enable` pays nothing for a `Read`, `Grep` or `Glob`. The pending-proposal file is readable by a tool that reads files; what it holds is the digest, and knowing the digest is not approval (the terminal rule above). The shell guard still denies shell reads of the proposal directory.

Benign commands stay allowed: `python3 -c "print(1 + 1)"`, `node -e "console.log(1)"`, `pregate status`, a shell script that only echoes, and `make` on a Makefile that does not name a control command. A shell builtin (`cd`, `read`, `type`, `wait`, `umask` and the like) is not looked up on `PATH`: the shell runs it itself, and the script macOS ships as `/usr/bin/cd` is never what `cd src` runs. A Bun subcommand (`bun test`, `bun run`, `bun install`) is not read as a script file of that name. What the guard still refuses among routine commands is measured in [Shell guard friction](benchmarks/shell-guard-friction.md). Prose is not an invocation: a comment line that mentions `pregate` followed by a line that starts with `install:` or `update()`, and a comment such as `# CI = GitHub Actions; run pregate status`, are not denied. The scan drops lines that are only a comment and does not let plain whitespace join `pregate` to a verb on the next line; a quoted argument list (`'pregate',` then a quoted verb on the next line) is still one invocation.

## Residual limits

These are heuristics over text, not a sandbox.

- The scan does not execute the program or expand variables. Concatenation (`'pre' + 'gate'`), `base64`, `chr()`/`bytes` built strings, encodings the decoder does not recognize, and a variable whose value is not in the scanned text are not recognized.
- A bare name is resolved on `PATH` only as a file this process can see. A name built by concatenation, and a script whose bytes are an encoding the decoder does not recognize, are still not read.
- A comment that is not a whole line (`echo ok # pregate approve x`) is scanned like code; a control command hidden in a string that is never executed is denied like one that is.
- A Write of a `.py` or `.js` file that is not a shebang script is not denied for control text. Executing that file with a literal interpreter command is denied when the file text contains a control invocation. `python3 -c 'exec(open("a.py").read())'` is denied only when that one-liner itself names a control command.
- Knowing the digest is not approval. Outside `PREGATE_UNATTENDED_APPROVAL=1` and the test hook, apply still waits for `y` on `/dev/tty` or `CONIN$`. A process that already has `PREGATE_UNATTENDED_APPROVAL=1` set can pass `--yes` or a code without that prompt; assigning it on a command, in a script or in inline code is denied. A harness `!` command whose stdin is not a terminal cannot approve; the printed instructions say so.
- Inline interpreter sinks are a list. A program that reaches a write through a name the list does not hold, or through a file it imports, is not seen here; Stop, pre-commit and CI judge the files it wrote.

### Shell residual bypasses the guard still does not see

| Attack | Pre shell guard | Backstop |
| --- | --- | --- |
| A literal dynamic command the scan does not execute (`eval 'echo ok'`, concatenation, `base64 -d`, `chr()`/template-built strings) | Not denied by itself | Stop, `check --ratchet`, CI |
| Encoded or compressed payloads the decoder does not recognize | Not read as a script | Same |
| Write sinks only in a module the script imports (no sink token in the file text) | Not denied at Pre | Stop, pre-commit, CI |
| In a node script file, access built through `constructor`, `prototype`, `globalThis` or a computed member, with no sink name in the text | Not denied at Pre | Same |
| A project script that already uses a sink, changed in the session so that the same call writes another file (new arguments, the same name and member) | Not denied at Pre | Same |
| A project script that already writes files when the session begins, run unchanged | Not denied: it is the project's program, as under `pnpm test` | Same |
| `rsync`/`tar`/`prettier` with destinations built at runtime, not spelled on the command line | Not denied | Same |
| MCP and other edit channels with no Pre matcher | Hook may not run; in Cursor, Pre judges the absolute paths an MCP call names | Stop, CI |
| Background/async writers (`&`, `nohup`, harness-specific delays) | May exit Pre before the write | Stop, CI |
| Git `merge`/`rebase`/`pull`/`am` | Judged after the fact | Stop, pre-commit, CI |

Stop, pre-commit, and the CI ratchet remain the deterministic boundary for anything Pre does not establish from the command text alone.
- Git history commands are judged by the files Git reports for them before they run. A hook, a filter or an alias that Git runs as part of the command is not.
- Local approval records and consent records can be rewritten by any process of the same user. Stop and pre-commit trust a matching approval record; only the CI ratchet with a repository variable is outside the agent's reach.
- `pregate prepare`, `pregate setup` and `pregate update` are denied to the agent but do not ask the human for `y`: they add or refresh protection rather than remove it.
- `script`, `tmux`, and `screen` are denied as interactive sessions. When the hook evaluates the command, a non-literal script is denied too (`shell-write`), including `bash -c 'while read l; do eval "$l"; done'`. `env -i` and `env -u` of a `PREGATE_` variable are `hook-switch`. Codex can still give `exec_command` a pty when `tty` is true, and `write_stdin` types into that pty without another PreToolUse. The PreToolUse payload is only `{command}`; it does not include `tty`. The read/eval loop above is denied before that child starts, so `write_stdin` has no terminal to type `pregate approve` into (`test/codex-pty-approve.e2e.test.ts`). Another pty allocator, or an obfuscation the lexer does not read as a non-literal script, can still give a child a terminal, and a terminal prints the approval code.
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
| Lock bytes edited by hand | Sound | `check` rebuilds the lock and rejects bytes that are not the compiler's output. A hook write while that lock is stale is `lock-stale`. A preset write through an edit tool is denied and not applied (an invalid document is an invalid contract change; other files under `.pregate/` are `protected-path`). `git commit --no-verify` is `shell-admin`. |
| Contract loosened by a script (preset edited, lock recompiled) | Sound in CI, best-effort locally | The lock then matches the preset, so the rebuild alone cannot see it. `check --ratchet` compares the base lock with the head lock and fails on any loosening unless the repository variable `PREGATE_ACCEPT_CONTRACT` lists that loosening's digest. Stop and pre-commit block it without a human approval record on this machine; a same-user process can forge that record, so the local checks are best-effort. The shell guard denies the literal and scripted `preset compile`/`apply`, and `preset compile` asks the human before writing a looser lock. |
| Git history commands that rewrite `.pregate/` | Sound for the listed commands | `reset`, `checkout <commit>`, `switch`, `stash`, `clean`, `cherry-pick`, `revert`, `read-tree` and `checkout-index` are judged by the files Git says they change; a change under `.pregate/` is `protected-path`. `merge`, `rebase`, `pull` and `am` are judged afterwards by Stop, pre-commit and the ratchet. |
| Consent removed or disabled by a script | Detected, not prevented | Stop's notice and `pregate status` warn when a root the session reached lost its consent. |
| Symlink that leaves the repository | Best-effort | A new symlink is read through, so its target is judged. An edit or shell redirect whose spelled path the lock judges, and whose real target sits in no enabled root, is denied (`protected-path`). A target in another enabled root, such as a nested one, is judged by that root. A spelled path out of scope stays out of scope. Two gaps are skipped below. |
| Parallel worktrees and consent | Sound | Enabling one checkout consents every linked worktree of that repository. A clone does not inherit it. Disabling a worktree withdraws the shared consent; a checkout that was enabled by name stays enabled, and a worktree added afterwards is inert until enabled. |
| Partial or invalid reconstructed edit | Sound | An edit whose old text is missing or not unique is `tool-will-fail`. A patch that does not match, and a pure insertion hunk, are `cannot-reconstruct`. An exact unique edit of clean code is allowed. |
| Hook process fails midway | Sound | The real engine exiting 1 is a denial, not an allow. A supervised child that prints an allow and then exits after the `rules` checkpoint does not have that stdout forwarded. The same failure against a directory with no consent stays inert. Killing the supervisor itself is not applicable: the harness owns that process. |
| Non-literal script | Sound | Inside an enabled root, `bash "$SCRIPT"`, `sh "$X"`, `bash < "$S"`, `python3 "$P"`, `node "$P"`, `make -f "$F"` and `powershell -File $P` are `shell-write`. A literal script path and a read-only one-liner stay allowed. |
| Script found on PATH | Sound for control commands, best-effort for writes | A bare command name is resolved on PATH. A script whose real file is inside an enabled project is scanned like a literal path. An installed tool outside every project is scanned for control commands only, so a script planted in a PATH folder outside the project can write project files without a Pre denial. Stop, the pre-commit check and the CI ratchet judge the resulting tree. |
| Unreadable or malformed status or lock JSON | Sound | A lock or preset that is not JSON is `lock-stale`. One the process cannot read (`EACCES`, or a path that is not a file) is denied. It is not treated as permission to edit. |

### Codex CLI version

PREGATE requires Codex CLI **0.167.0** or newer. Codex **0.166.x** and older are
unsupported: direct Guardian review on those releases did not run PreToolUse hooks
before approval policy, so a deny could be lost on that path
([openai/codex#58368](https://github.com/openai/codex/pull/58368)). Normal
PreToolUse hook execution and the `pregate doctor` canary still exercise the
direct hook route; they do not prove Guardian-path behavior on an old Codex.
`pregate doctor` prints an explicit warning when the Codex binary on `PATH` is
below 0.167.0.

### Known gaps

These tests stay skipped unless `PREGATE_RUN_KNOWN_GAPS` is set. They record a limit rather than a passing attack.

- **External target of a committed symlink.** Git diffs the link text. Changing the file outside the repo, without a hook write through the in-repo path, is not a `check --ratchet` diff.
- **Directory symlink out of the repo.** The workspace walk does not follow a symlink directory, and git lists the link rather than the files behind it. Violations that exist only there are not in the diff.
