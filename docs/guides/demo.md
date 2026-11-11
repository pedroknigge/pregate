# Try a guardrail before adopting a contract

`pregate demo` is included in 0.0.7. It needs the
compiled binary and Git. Check [v0.0.1 release notes](../releases/0.0.1.md) for what the first public tag verified.

```sh
pregate demo
pregate demo --language python
pregate demo --language go
pregate demo --language rust
pregate demo --json
```

The default runs all three languages. Each generated shop sample has a domain
module and a storage module. Its explicit contract forbids the domain from
importing storage. The same production launcher and native Claude Code Write
payload are used for each language.

The sample starts with an existing forbidden dependency. A no-new ratchet accepts
that unchanged debt. A new forbidden import is denied before a controller writes
the file. Malformed syntax and a new generated marker are denied too. A valid
repair passes, repeating it is a no-op, and removing the old dependency reduces
the static architecture findings to zero.
Both the rejected proposal and the accepted repair preserve the sample's
behavior. Native tests of the rejected proposal run only in a separate temporary
copy after the denial; it is never written to the protected sample.

## What the command changes

The command creates its own temporary Git repositories, machine homes, settings,
launcher and consent. It automates exact-digest approval only for those generated
samples. It accepts no project path and cleans up its temporary installation and
source files. Your project contracts and global settings are not its targets.

Run the command directly as a human, or use human `! pregate demo` in a supported
harness. It is sample automation, not a read-only consumer diagnosis command.
No live agent or human approval UI is exercised.

Python `unittest`, Go `go test`, and Rust compiler tests run when their tools are
already installed. The command downloads no toolchain or dependency. Missing
tooling is reported as `not-verified`; a present tool that fails the sample makes
the demo fail. JSON records command outcomes and output hashes, plus the exact
binary digest.

## What the result establishes

A successful demo shows bounded source checks and ratchet behavior on these
owned examples. It does not measure false-positive rates, compare live AI
maintainability, certify every harness, or prove general business correctness.
The 64 core project requirements remain unverified. Native compiler checks are
separate evidence; source analysis does not expand Rust macros or replace a
language compiler.

Read the [sample source](../../examples/demo), [language limits](../features/language-analysis.md),
then run `pregate guide` in your own project. Review its actual layout and packs,
approve its own candidate, and audit the existing debt before choosing repairs.
