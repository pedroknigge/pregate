# architecture

Optional policies for declared dependency graphs and architecture boundaries. This pack owns layer direction, prohibited packages in core layers, and the use-case API constraint. It also checks path segments and declaration shapes: a domain file that names an adapter, a query that writes, a slice that reaches into a sibling's internals, a port module that grows an implementation, an anti-corruption module that re-exports a foreign type, and a repository that returns the raw row.

`architecture/structure` is the opt-in home for structural ceilings that sit on the same surface: import cycles on the module graph, file size and public export count as a single-responsibility proxy, and class inheritance depth. It is not part of the hexagonal, clean-architecture, or functional-core presets. A project that already enabled Pregate does not start denying these until someone adds the methodology. File size and export count live here, rather than in maintainability, because this pack already owns the dependency graph (`layer-edge`) and the class API surface (`class.publicMethods`). Maintainability owns naming, nesting, empty interfaces, clock and null checks, deprecation, and migrations.

`architecture/functional-core-imperative-shell` combines `FCIS-DEP-001` (permitted local dependency edges), `FCIS-IO-001` (prohibited I/O imports) and `FCIS-IO-002` (ambient clock, randomness and environment). Declare core, shell and any narrow data/port boundaries in `layers`; the graph check follows literal imports, type imports, path aliases and re-export chains. It does not infer ownership or prove the purity of arbitrary collaborators. This optional pattern pack is separate from the language-independent builtin core.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `architecture/HEX-EDGE-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `HEX-EDGE-001` | An import, re-export, or dynamic import whose path enters adapters, infra, or frameworks from domain or application. | A domain or application module that names an adapter compiles only when that adapter is present, so the policy can no longer be tested or reused on its own. | deny |
| `HEX-PORT-001` | A class, abstract class, function, or arrow function declared under ports/. | An implementation in the port folder pulls a concrete dependency into the boundary the domain is allowed to import. | deny |
| `CQRS-QRY-001` | A call that saves, inserts, updates, deletes, or upserts through db, prisma, a repository, or a transaction from a query file. | A query that writes makes the read model a second source of truth and breaks the assumption that repeating the query is safe. | deny |
| `CQRS-CMD-001` | An import, re-export, or dynamic import from a command file into a queries segment. | A command that calls the query stack couples the write to a read model and invites the command to trust a projection it should not update through. | deny |
| `CQRS-QRY-002` | An import, re-export, or dynamic import from a query file into a commands segment. | A query that calls a command changes state on every read, so repeating, caching or retrying it is no longer safe. | deny |
| `SLICE-EDGE-001` | A relative import that enters a sibling feature's internal, persistence, domain, infra, adapters, or application folder. | A slice that uses a neighbor's private folders breaks when that neighbor renames its insides, and the public entry stops being the only contract. | deny |
| `MOD-EDGE-001` | A relative import from one module into another module's internal or persistence folder. | A modular monolith stays one deployable only while modules meet at their public API. Crossing into internals couples two modules' private schemas. | deny |
| `DEP-ENT-001` | An entity file importing use-cases, interface-adapters, frameworks, adapters, or infra. | An entity that names a use case or a framework cannot move to another application without dragging that outer ring along. | deny |
| `DEP-UC-001` | A use-case file importing interface-adapters, frameworks, adapters, or infra. | A use case that names a web framework or a database client can only run where that detail runs. | deny |
| `DEP-IA-001` | An interface-adapters file importing a frameworks or frameworks-and-drivers segment. | An adapter that imports the framework glue can only be built and tested with that glue present. | deny |
| `ACL-REEXPORT-001` | An export from clause whose specifier is a package name rather than a relative path, inside acl/. | Re-exporting the foreign type lets the rest of the system depend on the other model's names, which is the coupling the anti-corruption layer exists to stop. | deny |
| `REPO-ROW-001` | return row, return record, return raw, a cast of those names, or a spread of them, from a repository file. | The row is the database's shape. Returning it makes every caller depend on column names and nullability the domain did not choose. | deny |
| `HEX-ADAPT-001` | An import, re-export, or dynamic import from an input adapter directly into an output adapter. | Input adapters speak to the core through input ports; calling output adapters directly bypasses domain logic and use-case orchestration. | deny |
| `MOD-SHARED-001` | An import, re-export, or dynamic import from shared code into a business module. | The shared kernel must remain free of business domain models and circular dependencies. | deny |
| `LAYER-CLOSE-001` | An import, re-export, or dynamic import from presentation code into persistence. | In strict closed layers, presentation calls business or application logic, never persistence or the database directly. | deny |
| `LAYER-TX-001` | Calling $transaction, beginTransaction, commit, or rollback directly from presentation code. | Transaction demarcation belongs in the application or service layer, not in HTTP controllers or UI presentation. | deny |
| `ARCH-EFF-002` | Calling `crypto.randomUUID()`, `crypto.getRandomValues()`, or `performance.now()` (including `globalThis.*` / `window.*`) inside `domain/`, `entities/`, or `use-cases/`. | Direct Web Crypto randomness and high-resolution timer reads make domain and use-case logic non-deterministic; inject an ID generator or clock port instead. | deny |
| `ARCH-CYCLE-001` | An edit that creates or enlarges an import cycle among TypeScript or JavaScript modules. | A cycle makes the modules load and change as one. `import type`, a type-only specifier list, and dynamic `import()` are not edges. An existing cycle may stay. | deny |
| `ARCH-FILE-001` | A file whose code lines, or whose statement count when statements are packed onto fewer lines, exceed the ceiling (default 400). | The file is standing in for several modules. Comments and blank lines do not count. A file already over the ceiling may be edited if the count does not grow. | deny |
| `ARCH-EXPORT-001` | A file that publishes more names than the ceiling (default 20), including types and each name in one `export { ... }` clause. | The public surface is too large to be one contract. A surface already over the ceiling may stay if this edit adds no name. | deny |
| `ARCH-HERIT-001` | A class whose `extends` chain is deeper than the ceiling (default 3). | Each hop hides behavior in another class. This is a warning. `interface extends`, a framework base such as `React.Component`, and `implements` do not deepen the chain. | warn |

## Methodologies

- `architecture/hexagonal` — HEX-EDGE-001, HEX-PORT-001, HEX-ADAPT-001, ARCH-EFF-002
- `architecture/cqrs` — CQRS-QRY-001, CQRS-CMD-001, CQRS-QRY-002
- `architecture/vertical-slice` — SLICE-EDGE-001
- `architecture/modular-monolith` — MOD-EDGE-001, MOD-SHARED-001
- `architecture/dependency-rule` — DEP-ENT-001, DEP-UC-001, DEP-IA-001
- `architecture/anti-corruption` — ACL-REEXPORT-001
- `architecture/repository` — REPO-ROW-001
- `architecture/layered` — LAYER-CLOSE-001, LAYER-TX-001
- `architecture/structure` — ARCH-CYCLE-001, ARCH-FILE-001, ARCH-EXPORT-001, ARCH-HERIT-001

Architectural invariants that are not decidable by the current engine are in [`BACKLOG.md`](BACKLOG.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **pattern**. Version: `1.4.1`. 25 distinct check IDs.

Methodologies: `architecture/anti-corruption` (complete), `architecture/clean-architecture` (complete), `architecture/cqrs` (complete), `architecture/dependency-rule` (complete), `architecture/functional-core-imperative-shell` (preview), `architecture/hexagonal` (complete), `architecture/layered` (complete), `architecture/modular-monolith` (complete), `architecture/repository` (complete), `architecture/structure` (complete), `architecture/vertical-slice` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
