# trpc

tRPC builder-chain syntax checks. [The official procedure guide](https://trpc.io/docs/server/procedures) uses `publicProcedure.mutation`; input/output validators and context extension are optional depending on the endpoint. Those global bans are off, pending project-specific contracts. Patterns match chain shapes, not authentication, input types, or authorization policy.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `trpc/TRPC-PROC-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `TRPC-PROC-001` | A `publicProcedure` chain ending in `.mutation(`. | Public writes can be intentional (e.g. sign-up). | off |
| `TRPC-INPUT-001` | A `publicProcedure` `.query(`/`.mutation(` chain with no `.input(` validator. | Procedures with no input need no input validator. | off |
| `TRPC-OUTPUT-001` | A `publicProcedure` `.mutation(` chain with no `.output(` before the mutation. | tRPC infers resolver output types; validation is optional. | off |
| `TRPC-MUT-001` | A `.query(` chain whose resolver calls create, update, delete, insert, upsert, or save. | Clients refetch queries freely; a hidden write runs again on every refetch. | deny |
| `TRPC-BATCH-001` | An `httpBatchLink(` call with no `maxURLLength`. | URL limits depend on transport and inputs. | off |
| `TRPC-ERR-001` | `throw new Error(` (or `throw new AggregateError`) in a file that imports a tRPC module, or inside a `.query`/`.mutation`/`.subscription` call on a procedure builder. | A plain Error crosses the boundary as an untyped internal failure. | deny |
| `TRPC-CTX-001` | A `.use(` middleware chain that calls bare `next()`. | Forwarding an unchanged context is valid. | off |
| `TRPC-CALLER-001` | A `.subscription(` chain with no `observable(` or `yield` in it. | The subscribing caller gets no stream contract: no iteration, no cleanup. | deny |
| `TRPC-SELFCALL-001` | `createCaller(...)` (or `createCallerFactory(router)(...)`) inside a `.query`, `.mutation` or `.subscription` resolver. | The nested caller rebuilds context and reruns middleware; share a function instead. | warn |
| `TRPC-DEV-001` | `isDev: true` in `initTRPC...create({...})` outside test files. | Stack traces reach every client in production. | warn |
| `TRPC-CODE-001` | `new TRPCError({ code })` with a numeric HTTP status or unknown literal string. | Unknown error codes fall back to 500 `INTERNAL_SERVER_ERROR` and break typed client handling. | deny |
| `TRPC-RET-NEXT-001` | A `.middleware(` or `.use(` callback that calls `next(...)` or `await next(...)` as a bare statement without returning or capturing it. | Discarding the `next()` result drops the procedure response and returns `undefined`. | deny |

## Methodologies

- `trpc/client` — TRPC-BATCH-001, TRPC-ERR-001, TRPC-CTX-001, TRPC-CALLER-001, TRPC-DEV-001
- `trpc/router` — TRPC-PROC-001, TRPC-INPUT-001, TRPC-OUTPUT-001, TRPC-MUT-001, TRPC-SELFCALL-001, TRPC-CODE-001, TRPC-RET-NEXT-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.1`. 12 distinct check IDs.

Methodologies: `trpc/client` (complete), `trpc/router` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
