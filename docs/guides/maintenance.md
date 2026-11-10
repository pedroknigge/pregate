# Maintenance, reproducible build and rollback

This page says who releases Pregate, how to build it and check a release yourself, and how to move a pinned project to a new engine and back. Each procedure names the test or workflow that runs it.

## Who maintains it

- Releases are cut by the owner of [`pedroknigge/pregate`](https://github.com/pedroknigge/pregate). A release is a tag `v<version>` on `main`; the [release workflow](../../.github/workflows/release.yml) builds, signs and publishes it. No other person or organization publishes Pregate.
- [`SECURITY.md`](../../SECURITY.md) is the support statement: the `0.0.x` line is supported, and a private vulnerability report is acknowledged within 48 hours. This page adds no other response time.
- A fix lands on `main` and ships in the next release. No older release has been patched after a newer one was published, and there is no long-term-support branch.
- A published release is not replaced or re-tagged. A defective release is followed by a new one. Until then, a project stays on its pinned engine or goes back to the previous one with the rollback below.

## Build it from a clean checkout

The Bun version is pinned in [`.bun-version`](../../.bun-version). CI and the release workflow install exactly that version.

```sh
git clone https://github.com/pedroknigge/pregate.git
cd pregate
git checkout v0.0.6            # the tag you want to check
bun install --frozen-lockfile  # fails when bun.lock does not match package.json
bun run typecheck
bun test
bun run scripts/build.ts darwin-arm64   # or linux-x64, linux-arm64, darwin-x64, windows-x64
```

`scripts/build.ts` first runs the fixtures of every catalog rule, then writes `dist/pregate-<version>-<target>.tar.gz` (`.zip` for Windows), `install.sh`, `install.ps1` and one `SHA256SUMS` for all of them. It refuses an installer whose default version is not the one in `package.json`.

`bun run scripts/verify-candidate.ts evidence.json` runs the typecheck, the complete suite, the host build, the packaged smoke test and the latency benchmark, and writes one JSON record with the commit, the tree state, the Bun version and the result of each step.

### What a rebuild proves

- Two builds of the same commit, on the same machine with the pinned Bun, produced the same engine bytes (macOS ARM64, Bun 1.4.4, engine 0.0.6).
- A local macOS ARM64 build of tag `v0.0.5` did **not** match the engine in the published `darwin-arm64` archive: same size, different bytes. The release workflow builds every target on a GitHub-hosted runner. Pregate does not claim that a local rebuild reproduces a published archive.

So a rebuild checks that the tag builds and passes its tests. It is not how a published archive is verified.

## Verify a published archive

Three independent checks are documented, with commands, in [Install, update and remove](installation.md#verify-sigstore-signatures):

1. `SHA256SUMS` lists the checksum of every archive and installer. The installers always check it and stop on a mismatch.
2. Every archive and `SHA256SUMS` has a Sigstore bundle signed by the release workflow with GitHub's identity for the tag. `cosign verify-blob` checks it; the installers do so when `cosign` is on `PATH`.
3. Every archive and `SHA256SUMS` has a GitHub build-provenance attestation. `gh attestation verify` checks that the release workflow of this repository produced it.

The npm package holds only a launcher. It downloads the release archive of its own version and checks it against `SHA256SUMS` before the first run.

## Upgrade a pinned project

A project pins one engine version in its contract. A newer engine installed on the machine does not change that pin.

```sh
pregate update                      # install the newer engine; it prepares the project review
pregate update --project --preview  # or prepare that review with an engine already installed
pregate approve --preview           # read it: "Engine: <old> -> <new>" and the rule changes, if any
pregate approve <code>              # the human approves; the contract change is committed
```

The review states whether any effective rule changes. When it says `No effective rule changes`, the approved rules are the same and only the pin moves. The approval is one commit that touches only `.pregate/`.

## Roll back a pinned project

The upgrade is one commit, so the rollback is its revert, run with the previous engine.

```sh
git log --oneline -3 -- .pregate      # find the commit "apply reviewed PREGATE contract <code>"
git revert --no-edit <that commit>    # the lock is the earlier lock again, byte for byte
pregate update --engine <old>         # only when that engine is no longer installed on this machine
pregate status                        # the project pins <old> and is enforced by it
```

- The contract after the revert is the contract a human approved before the upgrade. No new approval is needed, and none is possible from an agent.
- `pregate update` keeps the engine a registered project pins, so the previous engine is normally still installed. `pregate update --engine <old>` installs it again when it is not.
- A newer engine does not propose a downgrade, and it does not judge a project that pins an older engine: the hook routes to the pinned engine or fails closed.
- Roll back teammates the same way: they pull the revert. A clone whose pinned engine is missing fails closed and names `pregate update --engine <v>`.

[`test/upgrade-rollback.e2e.test.ts`](../../test/upgrade-rollback.e2e.test.ts) runs this procedure on every CI run with two real engines that differ only in version. It asserts that the upgrade changes the pin and no rule, that both engines deny the same edit for the same rule, that the upgrade commit touches only `.pregate/`, and that the revert restores the first lock byte for byte with the same verdict.

## What this page does not establish

- No second person reviews a release today. That decision is open and is not made here.
- The rollback test uses two builds of one source tree with different version numbers. It proves the procedure and the routing, not that two specific published releases judge every file the same way. A release that changes rule behavior says so in its notes and in the update review.
- Reproducibility across machines was checked once, on one target, and failed as stated above.
