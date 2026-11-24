# Features this skill can drive

The harness is Cursor. Each file is one user-facing surface of the checkout CLI. The commands assume Launch in [../SKILL.md](../SKILL.md) has set `$PREGATE`, `$verify_root`, and an isolated `HOME`. Enforcement still requires `pregate enable` in the repository being judged.

| Feature | File | What a session sees |
| --- | --- | --- |
| Enable and disable | [enable-disable.md](enable-disable.md) | `pregate enable` / `pregate disable` |
| Edit gate | [edit-gate.md](edit-gate.md) | Cursor `Write` on `preToolUse` |
| Shell gate | [shell-gate.md](shell-gate.md) | Cursor `Shell` on `preToolUse` |
| Pack enable | [pack-enable.md](pack-enable.md) | `pregate pack enable <ns/methodology>` |
| Doctor | [doctor.md](doctor.md) | `pregate doctor` and `pregate --version` |
| Fitness status | [fitness.md](fitness.md) | `pregate fitness status` |
| Demo | [demo.md](demo.md) | `pregate demo` refuses an unknown language |
| Session rebase | [session-rebase.md](session-rebase.md) | `pregate session rebase` with no baseline |
| Dispute | [dispute.md](dispute.md) | `pregate dispute --last` with no denial |

[scripts/real-repo-evidence.ts](../../../../scripts/real-repo-evidence.ts) replays enable, the shell list, the edit list, and the pack-enable denial against the pinned commits. It does not run `pregate pack enable --yes` as the CLI, because that would change the contract the other actions are judged under.
