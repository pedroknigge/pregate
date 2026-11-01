# What the adversarial suite holds pregate to

`test/adversarial.e2e.test.ts` runs the compiled `pregate` binary against disposable
git repositories. The table is the claim those runs lock in. **Sound** means the
attack in that row cannot pass a consented check or hook. **Best-effort** means
pregate covers a stated slice and misses the rest on purpose or because the
comparison does not see it. **Not applicable** means the boundary belongs to
something outside pregate.

`no-new` (see `src/ratchet.ts`) counts violations. It does not prove two programs
are the same.

## Ratchet (`no-new`)

| Case | Verdict | What the binary does |
| --- | --- | --- |
| Violation moved inside the same symbol | Sound | The count for that rule and symbol is unchanged, so the move is not new debt. A second site in the same symbol is denied. |
| One violation removed and a different one added in the same function | Sound | Swapping two matches of the same rule is net zero. A different rule is not compensation and is denied. |
| Equivalent code in different syntax | Best-effort | Modeled forms of one rule (`as unknown as`, parentheses, `as any as`) stay one violation and are denied when newly introduced. Pregate does not decide that arbitrary programs are equivalent. |
| Symbol renamed, duplicated, or extracted | Sound | An unchanged function body in the same file keeps its debt across a rename (`parseBody` to `parseBody2`), a move onto another symbol, or an extraction that leaves the old name with a different body. The declared name is outside the body hash. Only the violations the old symbol no longer carries can follow its body, each once: a copy next to an original that still has the violation, with the same body or a changed one, is new debt. A body moved into a different file is not paired. |
| Import hidden behind a barrel or a path alias | Sound | A re-export and a `tsconfig` `paths` alias are resolved, including a package name that an alias points at a local file. A chain past three re-export hops fails closed (`unresolvable-import` or the layer edge on the hop that is still visible). |

## Trust boundaries

| Case | Verdict | What the binary does |
| --- | --- | --- |
| Config or lock tampering | Sound | `check` rebuilds the lock and rejects bytes that are not the compiler's output. A hook write while that lock is stale is `lock-stale`. A preset write is denied and not applied (an invalid document is an invalid contract change; other files under `.pregate/` are `protected-path`). `git commit --no-verify` is `shell-admin`. |
| Symlink that leaves the repository | Best-effort | A new symlink is read through, so its target is judged. An edit or shell redirect whose spelled path the lock judges, and whose real target sits in no enabled root, is denied (`protected-path`). A target in another enabled root, such as a nested one, is judged by that root. A spelled path out of scope stays out of scope. Two gaps are skipped below. |
| Parallel worktrees and consent | Sound | Enabling one checkout consents every linked worktree of that repository. A clone does not inherit it. Disabling a worktree withdraws the shared consent; a checkout that was enabled by name stays enabled, and a worktree added afterwards is inert until enabled. |
| Partial or invalid reconstructed edit | Sound | An edit whose old text is missing or not unique is `tool-will-fail`. A patch that does not match, and a pure insertion hunk, are `cannot-reconstruct`. An exact unique edit of clean code is allowed. |
| Hook process fails midway | Sound | The real engine exiting 1 is a denial, not an allow. A supervised child that prints an allow and then exits after the `rules` checkpoint does not have that stdout forwarded. The same failure against a directory with no consent stays inert. Killing the supervisor itself is not applicable: the harness owns that process. |

## Known gaps

These tests are skipped. They record a limit rather than a passing attack.

- **External target of a committed symlink.** Git diffs the link text. Changing the file outside the repo, without a hook write through the in-repo path, is not a `check --ratchet` diff.
- **Directory symlink out of the repo.** The workspace walk does not follow a symlink directory, and git lists the link rather than the files behind it. Violations that exist only there are not in the diff.
