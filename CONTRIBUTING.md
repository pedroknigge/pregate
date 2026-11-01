# Contributing to Pregate

Thank you for contributing to **Pregate** — the deterministic pre-execution gate for AI coding agents and repositories.

## Architecture and Design Principles

Before submitting changes, read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/SPEC.md`](docs/SPEC.md):

1. **Pure Functional Core (`layers.core` in `.pregate/preset.json`)**:
   - Core modules in `src/` must remain 100% pure and deterministic (`FCIS-ENV-001`, `FCIS-IO-001`, `FCIS-IO-002`, `FCIS-THROW-001`, `FCIS-DEP-001`).
   - Core modules may not import from `shell` adapter modules.
2. **Imperative Shell (`layers.shell` in `.pregate/preset.json`)**:
   - Filesystem, Git, network, process execution, and harness hook protocols live in the `shell` layer.
   - Every external boundary must enforce explicit timeouts and byte caps.
3. **Human Digest-Bound Consent**:
   - No agent or automated code path may forge human consent. `enable`, `disable`, `uninstall` and `approve` apply only when the human types `y` on an interactive terminal. `--yes` skips that question only when `CI` is already set; it is not an agent switch. Contract files (`.pregate/preset.json`, `.pregate/pregate.lock.json`) change only through a verified SHA-256 preview digest (`pregate approve <code>`).
4. **Latency Budget**:
   - Pre-execution hooks (`PreToolUse`, `preToolUse`, `pre_tool_use`) must remain fast (p95 $\le 150\text{ ms}$ on reference hardware).

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

## Authoring Checks and Rule Packs

1. Built-in core checks live under [`catalog/checks/`](catalog/checks/), core methodologies under [`catalog/methodologies/`](catalog/methodologies/), and optional bundled packs under [`packs/`](packs/).
2. Every check requires positive (`fixtures/pass/`), negative (`fixtures/fail/`), and trap (`fixtures/trap/`) test fixtures.
3. Validate catalog fixtures and invariants before opening a pull request:

```sh
bun src/main.ts rules test catalog
bun scripts/core-invariants.ts --check
bun scripts/readiness-packs.ts --check
bun scripts/dcouplr-delivery-rules.ts --check
bun scripts/source-invariants.ts --check
bun scripts/invariant-coverage.ts --check
bun scripts/docs-reference.ts --check
```

## Self-Verification Gate

Pregate gates its own repository. Before submitting a PR, ensure both the full tree check and repository audit pass:

```sh
bun src/main.ts check --all
bun src/main.ts audit
```

## Pull Request Checklist

- [ ] `bun run typecheck` passes with zero errors.
- [ ] `bun test` and `bun src/main.ts rules test catalog` pass.
- [ ] If CLI flags, checks, or methodologies changed, run `bun scripts/docs-reference.ts` and `bun src/main.ts preset compile`.
- [ ] `bun src/main.ts check --all` and `bun src/main.ts audit` exit `0`.
