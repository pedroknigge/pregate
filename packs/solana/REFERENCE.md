# solana pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## solana/key-custody

Manifest version: `1.0.1`. Status: **complete**.

### solana/SOL-SEC-001

Check: [`solana/security/no-secretkey-from-literal@1.0.1`](checks/security/no-secretkey-from-literal/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.custody-secretkey-source`. Minimum severity: `none`.

A secret in source ships into git, logs, and every worktree; rotation then means rewriting history. Static syntax cannot prove values or provenance across helpers and imports; see BACKLOG.md for this rule's uncaught flow and warning default.

Default parameters: `{}`.

**Repair:** Build keypairs from the wallet or the environment at runtime.

**Scope and limits:** Base64 of the same bytes in source, or a JSON file with the key committed next to the code.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "practices (SOLANA-RULES.md), keys",
  "paraphrase": "Keys never live in source; they arrive from the wallet or the environment."
}
```

### solana/SOL-SEC-002

Check: [`solana/security/no-key-logging@1.0.1`](checks/security/no-key-logging/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.custody-key-logging`. Minimum severity: `none`.

A leftover log prints key material to whatever stdout production captures. Static syntax cannot prove values or provenance across helpers and imports; see BACKLOG.md for this rule's uncaught flow and warning default.

Default parameters: `{}`.

**Repair:** Log ids and balances, never mnemonics, secret keys, or seed phrases. Never ask for them either.

**Scope and limits:** Debug-level logging of the same values: debug output ships too.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "practices (SOLANA-RULES.md), keys",
  "paraphrase": "Key material is never logged, asked for, or stored."
}
```

### solana/SOL-SEC-003

Check: [`solana/security/no-browser-key-storage@1.0.1`](checks/security/no-browser-key-storage/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.custody-browser-storage`. Minimum severity: `none`.

Browser storage is readable by any script on the page, including an injected one. Static syntax cannot prove values or provenance across helpers and imports; see BACKLOG.md for this rule's uncaught flow and warning default.

Default parameters: `{}`.

**Repair:** Keep keys in the wallet. Store only preferences and public state in browser storage.

**Scope and limits:** Encrypting the key with a password that sits next to it in the same storage.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "practices (SOLANA-RULES.md), keys",
  "paraphrase": "Browser storage holds preferences, never key material."
}
```

## solana/kit-client

Manifest version: `1.2.0`. Status: **complete**.

### solana/SOL-KIT-001

Check: [`solana/kit/no-web3js-import@1.0.0`](checks/kit/no-web3js-import/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.kit-web3js`. Minimum severity: `none`.

web3.js v1 is legacy: unmodular, un-tree-shakeable, and its idioms teach the agent 2023 code.

Default parameters: `{}`.

**Repair:** Use @solana/kit with plugins (createClient().use(...)). If legacy code remains, isolate it in one adapter module instead of importing it everywhere.

**Scope and limits:** Re-exporting web3.js from a shared barrel so every module keeps importing it.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "recommended-stack and client pages",
  "paraphrase": "New TypeScript speaks @solana/kit v8 with plugins; web3.js v1 stays only inside one legacy adapter."
}
```

### solana/SOL-KIT-002

Check: [`solana/kit/no-wallet-adapter-import@1.0.0`](checks/kit/no-wallet-adapter-import/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.kit-wallet-adapter`. Minimum severity: `none`.

The old wallet-adapter packages pull the legacy stack back in and bypass Wallet Standard.

Default parameters: `{}`.

**Repair:** Use @solana/kit-plugin-wallet with @solana/react (Wallet Standard), or Privy for embedded wallets.

**Scope and limits:** Wrapping the old adapter in a hook and calling that the new wallet layer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "recommended-stack and wallets pages",
  "paraphrase": "Wallet UI goes through Wallet Standard or an embedded wallet, not the legacy adapter packages."
}
```

### solana/SOL-KIT-003

Check: [`solana/kit/no-legacy-anchor-import@1.1.0`](checks/kit/no-legacy-anchor-import/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.kit-anchor-import`. Minimum severity: `none`.

Anchor 1.x moved the TypeScript client to @anchor-lang/core; the old package pins the repo to the 0.32 line.

Default parameters: `{}`.

**Repair:** Import from @anchor-lang/core and pin one Anchor line per repo from Anchor.toml. Prefer a Codama-generated client from the IDL over hand-written calls.

**Scope and limits:** Aliasing the old package to the new name so both lines coexist.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "install page, Anchor 1.x migration note",
  "paraphrase": "Anchor programs pair with the client package of their own line, and one repo pins one line."
}
```

### solana/SOL-KIT-004

Check: [`solana/kit/no-spl-token-import@1.0.0`](checks/kit/no-spl-token-import/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.kit-spl-token-import`. Minimum severity: `none`.

@solana/spl-token takes and returns web3.js v1 PublicKey and Transaction objects, so importing it pulls the legacy client back into a Kit codebase even when web3.js itself is never imported.

Default parameters: `{}`.

**Repair:** Use the Codama-generated program clients: @solana-program/token for the Token program and @solana-program/token-2022 for Token Extensions.

**Scope and limits:** Barrel re-exports, require() and deep subpath imports load the same package. Mentions in comments or plain strings are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Solana cookbook, tokens (https://solana.com/developers/cookbook/tokens/get-token-mint)",
  "locator": "Kit and Legacy tabs",
  "paraphrase": "Kit examples build token instructions with @solana-program/token and @solana-program/token-2022; @solana/spl-token appears only in the Legacy examples next to web3.js v1, which it requires as a peer dependency."
}
```

## solana/pda-safety

Manifest version: `1.2.0`. Status: **complete**.

### solana/SOL-PDA-001

Check: [`solana/security/no-create-program-address@1.0.0`](checks/security/no-create-program-address/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.create-program-address`. Minimum severity: `none`.

Calling createProgramAddress or createProgramAddressSync with user-supplied or unvalidated bump seeds throws when the hash lands on the curve or accepts non-canonical bumps.

Default parameters: `{}`.

**Repair:** Use getProgramDerivedAddress({ programAddress, seeds }) from @solana/kit (or PublicKey.findProgramAddressSync in legacy code) to derive the canonical bump.

**Scope and limits:** Direct calls and member calls to createProgramAddress or createProgramAddressSync are matched; pre-computed canonical bump caches should pass the address directly.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Solana documentation, Program Derived Addresses (solana.com)",
  "locator": "https://solana.com/docs/core/pda",
  "paraphrase": "createProgramAddress requires the caller to supply a bump seed that already pushes the point off the ed25519 curve, throwing whenever the seed lands on-curve; findProgramAddressSync / getProgramDerivedAddress derives the canonical bump deterministically."
}
```

## solana/rpc-env

Manifest version: `1.0.1`. Status: **complete**.

### solana/SOL-RPC-001

Check: [`solana/rpc/no-public-endpoint@1.0.1`](checks/rpc/no-public-endpoint/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.rpc-public-endpoint`. Minimum severity: `none`.

The public endpoint rate-limits and falls over, usually in the middle of the demo. Static syntax cannot prove values or provenance across helpers and imports; see BACKLOG.md for this rule's uncaught flow and warning default.

Default parameters: `{}`.

**Repair:** Read the RPC URL from .env.local (one Triton key per team) and never commit it.

**Scope and limits:** A committed .env.local, or a fallback constant that points back at the public endpoint.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "practices (SOLANA-RULES.md) and infra pages",
  "paraphrase": "The RPC URL comes from the environment and is never hardcoded or committed."
}
```

### solana/SOL-RPC-002

Check: [`solana/rpc/no-mainnet-cluster-literal@1.0.1`](checks/rpc/no-mainnet-cluster-literal/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.rpc-mainnet-default`. Minimum severity: `none`.

Nobody deploys to mainnet in a hackathon; a mainnet default burns real SOL and demo time. Static syntax cannot prove values or provenance across helpers and imports; see BACKLOG.md for this rule's uncaught flow and warning default.

Default parameters: `{}`.

**Repair:** Default to devnet. Touch mainnet only when explicitly asked.

**Scope and limits:** A flag that defaults to mainnet with a comment saying it should be devnet.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "avoid page and practices rules",
  "paraphrase": "Hackathon code runs on devnet unless the task says mainnet."
}
```

## solana/tx-safety

Manifest version: `1.0.1`. Status: **complete**.

### solana/SOL-TX-001

Check: [`solana/tx/no-tx-version-string@1.0.1`](checks/tx/no-tx-version-string/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.tx-version-type`. Minimum severity: `none`.

The RPC reads maxSupportedTransactionVersion as a number; the string is silently not 1. Static syntax cannot prove values or provenance across helpers and imports; see BACKLOG.md for this rule's uncaught flow and warning default.

Default parameters: `{}`.

**Repair:** Pass the integer 1, not the string.

**Scope and limits:** String(1) or a template that renders the digit as text.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "client page, reading transactions",
  "paraphrase": "Reads pass maxSupportedTransactionVersion as the integer 1."
}
```

### solana/SOL-TX-002

Check: [`solana/tx/no-bare-confirm@1.0.1`](checks/tx/no-bare-confirm/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `solana.tx-confirm-blockhash`. Minimum severity: `none`.

A blockhash is valid for about 150 blocks; confirming a bare signature cannot tell a lost reply from a landed transaction, and resending blind double-pays. Static syntax cannot prove values or provenance across helpers and imports; see BACKLOG.md for this rule's uncaught flow and warning default.

Default parameters: `{}`.

**Repair:** Keep { blockhash, lastValidBlockHeight }, confirm against it with an explicit compute budget, and on timeout check the signature status before resending.

**Scope and limits:** Retrying send in the catch block without looking the first signature up.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Superteam AR stack guide",
  "locator": "practices (SOLANA-RULES.md), client and transactions",
  "paraphrase": "Signatures confirm against a fresh blockhash, and a timeout looks before it resends."
}
```
