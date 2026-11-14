# solana

Hackathon pack for the Superteam AR Solana stack (Anchor + @solana/kit v8 + Triton + devnet). Source version **1.2.0**, for engine **0.0.10**. TypeScript client only: the engine parses TS/JS, so Anchor/Rust program rules wait for a Rust language pack and live in BACKLOG.md until then.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `solana/SOL-KIT-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/` (see `solana-hackathon.json`).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `SOL-KIT-001` | Importing `@solana/web3.js` v1 in new code. | Legacy client; the agent learns 2023 idioms from it. | deny |
| `SOL-KIT-002` | Importing `@solana/wallet-adapter-*`. | Bypasses Wallet Standard and drags the legacy stack back. | deny |
| `SOL-KIT-003` | Importing `@coral-xyz/anchor` (0.32 line) or `@project-serum/anchor`. | Anchor 1.x clients live in `@anchor-lang/core`. | deny |
| `SOL-KIT-004` | Importing `@solana/spl-token` (including subpaths). | Built on web3.js v1; Kit clients use `@solana-program/token` / `token-2022`. | warn |
| `SOL-RPC-001` | Public endpoint literals and supported split/template/array forms. | Imported configuration values need review. | warn |
| `SOL-RPC-002` | Literal or supported reconstructed `mainnet-beta` values. | Helper-selected clusters need review. | warn |
| `SOL-TX-001` | Visible string expressions for `maxSupportedTransactionVersion`, including local const aliases. | Computed strings are text; imported values need review. | warn |
| `SOL-TX-002` | Confirmation without an explicit object containing both blockhash fields. | Local method aliases are covered; wrappers and runtime strategies need review. | warn |
| `SOL-SEC-001` | Key restoration without a visible environment read, including local method aliases. | An environment read does not prove key provenance. | warn |
| `SOL-SEC-002` | Sensitive-looking console arguments, including local aliases and bracket calls. | Wrappers and actual secret provenance need review. | warn |
| `SOL-SEC-003` | Sensitive-looking browser storage arguments, including local aliases and bracket calls. | Storage wrappers and key provenance need review. | warn |
| `SOL-PDA-001` | `createProgramAddress` or `createProgramAddressSync` calls instead of canonical bump derivation. | Throws when seeds land on the ed25519 curve and permits non-canonical bump spoofing. | warn |

## Methodologies

- `solana/key-custody` — SOL-SEC-001, SOL-SEC-002, SOL-SEC-003
- `solana/kit-client` — SOL-KIT-001, SOL-KIT-002, SOL-KIT-003, SOL-KIT-004
- `solana/pda-safety` — SOL-PDA-001
- `solana/rpc-env` — SOL-RPC-001, SOL-RPC-002
- `solana/tx-safety` — SOL-TX-001, SOL-TX-002

## Fixture coverage and limits

`pregate rules test packs/solana` runs **93** real fixtures. The ten old comment,
documentation and look-alike cases now live in `pass/`. Every check has a failing
trap with exact lines: namespace imports, re-exports and runtime literal imports;
split/template/joined endpoint and cluster values; split key bytes and restoration
aliases; renamed console/storage receivers; aliased/bound confirms; and computed
transaction-version strings. Safe aliases, shadowed parameters and numeric conversions
remain pass guards.

SOL-KIT-001 to 003 deny literal imports; SOL-KIT-004 warns, because the cookbook
still documents `@solana/spl-token` as the Legacy path. The other seven default to warn because the
closed syntax vocabulary cannot prove arbitrary value or provenance flow. Concrete
uncaught cases and the reason for each warning default are in [BACKLOG.md](BACKLOG.md).
Users can change severities in their preset after reviewing those limits.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 12 distinct check IDs.

Methodologies: `solana/key-custody` (complete), `solana/kit-client` (complete), `solana/pda-safety` (complete), `solana/rpc-env` (complete), `solana/tx-safety` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
