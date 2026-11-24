# Contributing to Pregate

Thank you for contributing to **Pregate** — the deterministic pre-execution gate for AI coding agents and repositories.

## Architecture and Design Principles

Before submitting changes, read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/SPEC.md`](docs/SPEC.md).

Judge these by hand:

1. **Where a new module lives.** Filesystem, Git, network, process execution, and harness hook protocols belong in the shell layer. A calculation belongs in the core. Name the new file under that layer in [`.pregate/preset.json`](.pregate/preset.json).
2. **Core results are values.** A core module does not throw to report a result.
3. **Bounds on the outside world.** Every external boundary enforces an explicit timeout and a byte cap.
4. **Latency budget.** Pre-execution hooks (`PreToolUse`, `preToolUse`, `pre_tool_use`) stay fast: p95 ≤ 150 ms on the reference hardware in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Corrections

When a correction happens, prefer this order:

1. **Redesign** so the mistake cannot happen.
2. A **lint, a type, or a test** that catches it.
3. **Runtime verification**.
4. **Prose**, last.

A paragraph does not hold a lesson that a redesign or a check can hold. Record the correction in [`corrections.json`](corrections.json).

## Development Setup

Prerequisites:
- [Bun](https://bun.sh) (pinned in `.bun-version`)
- Git 2.30+

Install dependencies and verify the workspace:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
```

`bun test` signs and verifies release archives offline. It uses the cosign shim at
`test/shims/cosign` (a fixed path in this repository). It does not download cosign, does
not copy a cosign binary into a temporary directory, and does not contact Sigstore.

To run the real Sigstore checks (keyed `cosign sign-blob` / `verify-blob` through
`install.sh` and the GitHub Action installer), install [cosign](https://docs.sigstore.dev/cosign/installation/)
3.x and opt in. GitHub Actions sets this variable after installing cosign. Without it,
`test/signing.e2e.test.ts` skips.

```sh
PREGATE_E2E_SIGSTORE=1 bun test test/signing.e2e.test.ts
```

## Authoring Checks and Rule Packs

Built-in core checks live under [`catalog/checks/`](catalog/checks/), core methodologies under [`catalog/methodologies/`](catalog/methodologies/), and optional bundled packs under [`packs/`](packs/).

## Whole tree

Exit 0 from both:

```sh
bun src/main.ts check --all
bun src/main.ts audit
```

## Pull Request Checklist

- [ ] `bun src/main.ts check --all` and `bun src/main.ts audit` exit `0`.
- [ ] A new correction is an entry in [`corrections.json`](corrections.json).
