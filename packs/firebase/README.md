# firebase

TypeScript Firebase client/admin-SDK usage pack. Source version **1.2.0**, for engine **0.0.6**. The engine parses only TS/JS, so this pack enforces TypeScript Firebase usage; Firestore/Storage Security Rules languages live in BACKLOG.md until a rules-language pack exists.

Firebase `apiKey` is public by design (it identifies the project; Security Rules protect the data), so this pack deliberately does NOT forbid it — unlike real secrets, which stay covered by the vibe-proof client-secret rules. COMPLEMENT, don't duplicate: hardcoded private keys and service-account JSON stay with the secrets rules.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `firebase/FB-READ-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `FB-READ-001` | `getDocs` with no `limit`/`where`/`orderBy` in the call. | One call can pull the whole collection. | deny |
| `FB-WRITE-001` | `setDoc` with no `merge` option. | A partial overwrite can remove fields, but intentional replacement is supported. | off |
| `FB-QUERY-001` | `collection`/`doc` path built with `+` or `${}`. | Concatenated paths defeat Rules path matching. | deny |
| `FB-BATCH-001` | `writeBatch` with no `.commit()` in the same statement. | A later statement may commit the batch; one statement cannot prove a leak. | off |
| `FB-ADMIN-001` | `firebase-admin` imports in client files. | Service-account privilege in the browser is a full breach. | deny |
| `FB-AUTH-001` | Chained `auth.currentUser.foo` access. | Check nullability; a guard may already exist. | warn |
| `FB-FUNCTION-001` | `onRequest` with no `cors` handling in the same statement. | Server-to-server or same-origin functions do not need CORS. | off |
| `FB-STORAGE-001` | `listAll` on any ref. | Consider pagination for growing prefixes. | warn |
| `FB-COMPAT-001` | Imports, re-exports or requires of `firebase/compat/*`. | Compat libraries are temporary and will be removed in a future major SDK. | warn |
| `FB-INIT-001` | `initializeApp(...)` inside a function without a `getApps()` or `getApp()` guard. | Repeated calls crash with `Firebase App named '[DEFAULT]' already exists`. | deny |
| `FB-TX-ORDER-001` | `transaction.get(...)` after `transaction.set`, `update`, or `delete` inside `runTransaction`. | Firestore transactions throw at runtime if any read runs after a write. | deny |

## Methodologies

- `firebase/auth` — FB-ADMIN-001, FB-AUTH-001, FB-FUNCTION-001, FB-STORAGE-001, FB-COMPAT-001, FB-INIT-001
- `firebase/firestore` — FB-READ-001, FB-WRITE-001, FB-QUERY-001, FB-BATCH-001, FB-TX-ORDER-001

## Fixture coverage and limits

`pregate rules test packs/firebase` runs **55** real fixtures (2 pass + 2 fail + 1 trap per check). Every check has a failing trap with exact lines: unconstrained `query()` objects, empty options objects, template-literal paths, split-statement commits, `require("firebase-admin")`, getter-chain `currentUser` reads, bare async handlers, user-scoped `listAll` refs, and a compat side-effect import beside modular calls.

The fixtures prove only the listed syntax matches. In particular, the batch fixture labels a normal multi-statement commit as a failure, so `FB-BATCH-001` is off. `FB-WRITE-001` is off because [Firestore documents both creation/replacement and merge](https://firebase.google.com/docs/firestore/manage-data/add-data). Concrete uncaught cases and the reason each stays out of scope are in [BACKLOG.md](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 11 distinct check IDs.

Methodologies: `firebase/auth` (complete), `firebase/firestore` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
