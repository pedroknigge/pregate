# architecture pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.3.0`. Category: **pattern**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## architecture/anti-corruption

Manifest version: `1.0.0`. Status: **complete**.

### architecture/ACL-REEXPORT-001

Check: [`architecture/acl/reexports-foreign-type@1.0.0`](checks/acl/reexports-foreign-type/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `acl.foreign-reexport`. Minimum severity: `none`.

Re-exporting the foreign type lets the rest of the system depend on the other model's names, which is the coupling the anti-corruption layer exists to stop.

Default parameters: `{}`.

**Repair:** Import the foreign type privately, map it to a type this system owns, and export only that local type.

**Scope and limits:** export type { X } from the package is still a re-export. A relative re-export of a local translation is fine.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Domain-Driven Design (E. Evans, 2003)",
  "locator": "anti-corruption layer",
  "paraphrase": "An anti-corruption layer translates the upstream model into the local one. Callers of the layer see the local model, not the foreign types."
}
```

## architecture/clean-architecture

Manifest version: `1.0.1`. Status: **complete**.

### architecture/CA-DEP-001

Check: [`architecture/dependencies/layer-direction@1.0.0`](checks/dependencies/layer-direction/check.json). Default severity: **deny**.

Implementation: `layer-edge`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `deps.layers`. Minimum severity: `none`.

An inner layer that imports an outer one cannot be tested, reused or kept stable without dragging the details along.

Default parameters: `{}`.

**Repair:** Declare what the inner layer needs as a port in a layer it may import, implement it in the outer layer, and wire both in the composition root the preset declares.

**Scope and limits:** Barrels and re-exports that tunnel the same edge, type-only imports, require calls and path aliases that point at the same outer module.

**Interactions when active together:**

- Duplicates `architecture/FCIS-DEP-001`: Both select architecture/dependencies/layer-direction: CA-DEP-001 checks every layer and FCIS-DEP-001 only the core layer, so the core check is contained in the wider one. Settle: Resolve deps.layers to architecture/CA-DEP-001; the core-layer check stays covered.
- Duplicates `dcouplr/DCP-EDGE-001`: Both check imports against the preset layers; DCP-EDGE-001 covers the core layer, which CA-DEP-001 already checks, so one forbidden core edge is reported twice. Settle: Turn DCP-EDGE-001 off while CA-DEP-001 is active, unless its managed-component wording is wanted.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Clean Architecture (R. C. Martin, 2017)",
  "locator": "ch. 22, The Clean Architecture (The Dependency Rule)",
  "paraphrase": "Compile-time dependencies run from the outer rings toward the inner ones; inner code never mentions what is declared further out, so policy does not depend on detail."
}
```

### architecture/CA-DEP-002

Check: [`architecture/dependencies/banned-imports@1.0.0`](checks/dependencies/banned-imports/check.json). Default severity: **deny**.

Implementation: `banned-import`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `multi`. Dimension: `deps.packages`. Minimum severity: `none`.

A framework or ORM type in the core ties business rules to a vendor's lifecycle and to infrastructure every test must then start.

Default parameters: `{"paths":["@layers:core"],"packages":["@prisma/client","prisma","typeorm","sequelize","mongoose","drizzle-orm","knex","kysely","@mikro-orm/core","pg","mysql2","mongodb","express","fastify","koa","hono","@nestjs/common","@nestjs/core","next","react","vue","@angular/core"]}`.

**Repair:** Move the framework or ORM call into an adapter outside the core layers and give the core a port that speaks in domain types.

**Scope and limits:** Reaching the same package through require, a literal dynamic import, a subpath or a local barrel.

**Interactions when active together:**

- Duplicates `architecture/FCIS-IO-001`: Both deny pg, mysql2, mongodb and @prisma/client in the core layer, so one import of those packages is reported twice. Settle: Keep both when each list is wanted; to report once, drop the shared packages from one alias with a packages override.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "packages": {
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

Source metadata:

```json
{
  "work": "Clean Architecture (R. C. Martin, 2017)",
  "locator": "ch. 30-32 (The Database Is a Detail; The Web Is a Detail; Frameworks Are Details)",
  "paraphrase": "Databases, the web and frameworks are details; the business rules do not know them, and the code keeps them at arm's length behind boundaries it owns."
}
```

### architecture/CA-UC-001

Check: [`architecture/api-surface/single-public-method@1.0.0`](checks/api-surface/single-public-method/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `class.public-surface`. Minimum severity: `none`.

Several entry points in one use case mix scenarios that change for different reasons.

Default parameters: `{"paths":["**/use-cases/**","**/*.use-case.ts"],"max":1}`.

**Repair:** Give each scenario its own use case class with one public entry method; shared steps go to private methods or to the domain model.

**Scope and limits:** Second entry points written as public arrow-function properties or static methods.

**Interactions when active together:**

- Duplicates `senior/SR-WIDE-001`: Both count public methods: in use-case files CA-UC-001 allows 1 and SR-WIDE-001 allows 8, so a wide use case is reported by both. Settle: Usually keep both, since CA-UC-001 is the narrower use-case rule; to report once, exclude the use-case globs from SR-WIDE-001.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 1
  }
}
```

Source metadata:

```json
{
  "work": "Clean Architecture (R. C. Martin, 2017)",
  "locator": "ch. 20, Business Rules (Use Cases)",
  "paraphrase": "A use case describes one application-specific rule: the input it accepts, the steps it runs and the output it returns, behind a single entry point."
}
```

## architecture/cqrs

Manifest version: `1.1.0`. Status: **complete**.

### architecture/CQRS-QRY-001

Check: [`architecture/cqrs/query-mutates@1.0.0`](checks/cqrs/query-mutates/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `cqrs.query-mutate`. Minimum severity: `none`.

A query that writes makes the read model a second source of truth and breaks the assumption that repeating the query is safe.

Default parameters: `{}`.

**Repair:** Return the read model from the query. Put the write in a command that is the only writer of that change.

**Scope and limits:** Calling db["update"] or prisma.invoice.update from the query is still a write. A local helper that does not go through those clients is outside this rule.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "CQRS (G. Young)",
  "locator": "command and query separation",
  "paraphrase": "A query answers a question and does not change observable state. A command changes state and is not used as a query."
}
```

### architecture/CQRS-CMD-001

Check: [`architecture/cqrs/command-imports-query@1.0.0`](checks/cqrs/command-imports-query/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `cqrs.command-query`. Minimum severity: `none`.

A command that calls the query stack couples the write to a read model and invites the command to trust a projection it should not update through.

Default parameters: `{}`.

**Repair:** Pass the facts the command needs as arguments, or read them through a port the command's application layer owns.

**Scope and limits:** export type { View } from a queries path is still a dependency on the query module.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "CQRS (G. Young)",
  "locator": "separate read and write models",
  "paraphrase": "The write model and the read model change for different reasons. The command path does not take a dependency on the query path."
}
```

### architecture/CQRS-QRY-002

Check: [`architecture/cqrs/query-imports-command@1.0.0`](checks/cqrs/query-imports-command/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `cqrs.query-command`. Minimum severity: `none`.

A query that calls a command changes state every time someone reads, so repeating, caching or retrying the query is no longer safe.

Default parameters: `{}`.

**Repair:** Return the read model from the query. If reading should record something, let the caller issue that command separately.

**Scope and limits:** A type-only import, re-export or import() of a commands path is the same dependency. A write helper outside a commands folder is outside this rule; CQRS-QRY-001 covers direct writes through a store.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "CQRS (G. Young)",
  "locator": "separate read and write models",
  "paraphrase": "The read side answers questions from its own model and changes nothing. Every state change goes through the write side, which the query path does not call."
}
```

## architecture/dependency-rule

Manifest version: `1.1.0`. Status: **complete**.

### architecture/DEP-ENT-001

Check: [`architecture/dependency-rule/entity-imports-outer@1.0.0`](checks/dependency-rule/entity-imports-outer/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dependency.entity-outer`. Minimum severity: `none`.

An entity that names a use case or a framework cannot move to another application without dragging that outer ring along.

Default parameters: `{}`.

**Repair:** Keep the entity on its own types. Let the use case call the entity, and let the adapter implement a port the use case declared.

**Scope and limits:** A type-only import or import() of the outer ring is the same dependency.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Clean Architecture (R. C. Martin, 2017)",
  "locator": "ch. 22, The Dependency Rule",
  "paraphrase": "Source dependencies point inward. Entities do not mention use cases, interface adapters, or frameworks."
}
```

### architecture/DEP-UC-001

Check: [`architecture/dependency-rule/usecase-imports-outer@1.0.0`](checks/dependency-rule/usecase-imports-outer/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dependency.usecase-outer`. Minimum severity: `none`.

A use case that names a web framework or a database client can only run where that detail runs.

Default parameters: `{}`.

**Repair:** Accept a port (repository, clock, gateway) as an argument. Implement the port in the adapter ring.

**Scope and limits:** Importing the detail through a barrel that still resolves to adapters/ or infra/ keeps the edge.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Clean Architecture (R. C. Martin, 2017)",
  "locator": "ch. 20-22, use cases and the dependency rule",
  "paraphrase": "Use cases orchestrate entities. They do not import the web, the database, or a framework. Those details implement interfaces the use case owns."
}
```

### architecture/DEP-IA-001

Check: [`architecture/dependency-rule/adapter-imports-framework@1.0.0`](checks/dependency-rule/adapter-imports-framework/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `dependency-rule.adapter-outer`. Minimum severity: `none`.

An adapter that imports the web or database glue in frameworks/ can only be built and tested with that glue present, so swapping the framework means rewriting the adapters too.

Default parameters: `{}`.

**Repair:** Let the frameworks ring call the controller or gateway and pass in what it needs. Declare the interface the adapter needs next to the adapter and implement it in frameworks/.

**Scope and limits:** A type-only import or import() of frameworks/ is the same dependency. Only folder segments named frameworks or frameworks-and-drivers are matched; package imports such as express belong to CA-DEP-002 when it is selected.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Clean Architecture (R. C. Martin, 2017)",
  "locator": "ch. 22, The Clean Architecture (Interface Adapters; Frameworks and Drivers)",
  "paraphrase": "Interface adapters convert data between the use cases and the outside world. The frameworks and drivers ring is the outermost circle: it depends on the adapters, never the reverse."
}
```

## architecture/functional-core-imperative-shell

Manifest version: `1.1.1`. Status: **preview**.

### architecture/FCIS-DEP-001

Check: [`architecture/dependencies/layer-direction@1.0.0`](checks/dependencies/layer-direction/check.json). Default severity: **deny**.

Implementation: `layer-edge`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `deps.layers`. Minimum severity: `none`.

A local shell import can hide external effects even when the core imports no I/O package directly.

Default parameters: `{"paths":["@layers:core"]}`.

**Repair:** Pass the required values or a narrow collaborator from the shell. Declare any stable data or port layer explicitly in the preset's layer map.

**Scope and limits:** Type-only imports, path aliases and local re-export chains retain the dependency. Unresolved dependencies cannot prove a permitted edge. This graph check does not prove that every implementation is pure or determine module ownership.

**Interactions when active together:**

- Duplicates `architecture/CA-DEP-001`: Both select architecture/dependencies/layer-direction: CA-DEP-001 checks every layer and FCIS-DEP-001 only the core layer, so the core check is contained in the wider one. Settle: Resolve deps.layers to architecture/CA-DEP-001; the core-layer check stays covered.
- Duplicates `dcouplr/DCP-EDGE-001`: Both check imports from core-layer files against the preset layers, so one forbidden edge is reported twice. Settle: Keep one of them: both run the same layer-edge evaluation on the core layer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Boundaries (G. Bernhardt, conference talk, 2012)",
  "locator": "the functional core and imperative shell section",
  "paraphrase": "The shell calls the core. The core must not depend on the shell that performs external effects."
}
```

### architecture/FCIS-IO-001

Check: [`architecture/dependencies/banned-imports@1.0.0`](checks/dependencies/banned-imports/check.json). Default severity: **deny**.

Implementation: `banned-import`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `multi`. Dimension: `deps.packages`. Minimum severity: `none`.

A core that performs I/O cannot be tested with plain values and hides its effects from its callers.

Default parameters: `{"paths":["@layers:core"],"packages":["fs","child_process","net","http","https","http2","dgram","dns","tls","cluster","worker_threads","readline","os","process","perf_hooks","timers","vm","bun","bun:sqlite","bun:ffi","undici","node-fetch","axios","ws","pg","mysql2","mongodb","redis","ioredis","@prisma/client","pino","winston"]}`.

**Repair:** Let the shell do the I/O and pass the resulting values into core functions; the core returns values that describe what the shell must do.

**Scope and limits:** Importing the same module with a node: prefix, through a subpath such as fs/promises, as a type-only import or through a local re-export.

**Interactions when active together:**

- Duplicates `architecture/CA-DEP-002`: Both deny pg, mysql2, mongodb and @prisma/client in the core layer, so one import of those packages is reported twice. Settle: Keep both when each list is wanted; to report once, drop the shared packages from one alias with a packages override.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "packages": {
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

Source metadata:

```json
{
  "work": "Boundaries (G. Bernhardt, conference talk, 2012)",
  "locator": "the functional core and imperative shell section",
  "paraphrase": "Keep decisions in a core of pure functions over plain values, and push every interaction with the outside world, such as files, network and processes, out to a thin shell."
}
```

### architecture/FCIS-IO-002

Check: [`architecture/effects/no-clock-random-env@1.0.0`](checks/effects/no-clock-random-env/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `effects.nondeterminism`. Minimum severity: `none`.

Reading the clock, randomness, the environment or the network makes the core nondeterministic, so its results cannot be reproduced in a test.

Default parameters: `{"paths":["@layers:core"],"allow":[]}`.

**Repair:** Read the time, random values and configuration in the shell and pass them to the core as parameters.

**Scope and limits:** Aliasing or destructuring the global, bracket access, going through globalThis, constructing a Date without arguments, or switching to Temporal, node:crypto, Bun, Deno, import.meta.env or the global fetch.

**Interactions when active together:**

- Duplicates `maintainability/MAINT-CLOCK-001`: Both report Date.now() and new Date() in domain files of the core layer, so one clock read is reported twice. Settle: FCIS-IO-002 also covers randomness and the environment; turn MAINT-CLOCK-001 off when the core layer is the domain.
- Duplicates `architecture/ARCH-EFF-002`: Both flag crypto randomness and performance.now() when domain, entity, or use-case folders belong to the core layer. Settle: Keep one active or turn architecture/ARCH-EFF-002 off when FCIS-IO-002 covers the core layer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "allow": {
    "type": "array",
    "items": {
      "type": "string",
      "pattern": "^[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)+$"
    }
  }
}
```

Source metadata:

```json
{
  "work": "Grokking Simplicity (E. Normand, 2021)",
  "locator": "ch. 3, Distinguishing actions, calculations, and data",
  "paraphrase": "Calculations turn equal inputs into equal outputs every time; code whose result depends on the moment it runs or on how many times it runs, like reading the clock or a random number, is an action."
}
```

## architecture/hexagonal

Manifest version: `1.1.0`. Status: **complete**.

### architecture/HEX-EDGE-001

Check: [`architecture/boundaries/domain-imports-adapter@1.0.0`](checks/boundaries/domain-imports-adapter/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `boundaries.domain-adapter`. Minimum severity: `none`.

A domain or application module that names an adapter compiles only when that adapter is present, so the policy can no longer be tested or reused on its own.

Default parameters: `{}`.

**Repair:** Depend on a port declared beside the domain, implement it in the adapter, and pass the implementation in from the composition root.

**Scope and limits:** Hiding the same path behind export * or import(). A string that merely mentions the folder, and is not an import specifier, is not this edge.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Hexagonal architecture (A. Cockburn; ports and adapters)",
  "locator": "ports and adapters, dependency direction",
  "paraphrase": "The application speaks to the outside through ports it owns. Adapters sit outside and may depend inward. The inside does not mention the adapter."
}
```

### architecture/HEX-PORT-001

Check: [`architecture/ports/port-has-implementation@1.0.0`](checks/ports/port-has-implementation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `ports.no-implementation`. Minimum severity: `none`.

An implementation in the port folder pulls a concrete dependency into the boundary the domain is allowed to import.

Default parameters: `{}`.

**Repair:** Leave an interface or type alias in the port module. Move the class or function to an adapter that implements the port.

**Scope and limits:** Marking the class abstract, or binding the body to an exported const arrow, still leaves an implementation in the port module.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Hexagonal architecture (ports and adapters)",
  "locator": "port versus adapter",
  "paraphrase": "A port is the shape the inside needs. The body that talks to a database, a network, or a framework is an adapter and lives outside."
}
```

### architecture/HEX-ADAPT-001

Check: [`architecture/hexagonal/no-cross-adapter@1.0.0`](checks/hexagonal/no-cross-adapter/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `hexagonal.cross-adapter`. Minimum severity: `none`.

Direct communication between adapters bypasses domain logic, use-case orchestration, and port contracts.

Default parameters: `{}`.

**Repair:** Dispatch the request through an application use case or input port, and let the use case call the output port.

**Scope and limits:** Importing repositories or secondary adapters directly into HTTP controllers or queue consumers.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Hexagonal architecture (A. Cockburn; ports and adapters)",
  "locator": "driving adapter to driven adapter boundary",
  "paraphrase": "Input/driving adapters speak to the application core through input ports; they do not reach directly into output/driven adapters, bypassing the center."
}
```

### architecture/ARCH-EFF-002

Check: [`architecture/effects/no-crypto-time-random@1.0.0`](checks/effects/no-crypto-time-random/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `architecture.domain-crypto-time`. Minimum severity: `none`.

Direct calls to crypto.randomUUID(), crypto.getRandomValues(), or performance.now() make domain and use-case logic non-deterministic and impossible to replay deterministically in unit tests.

Default parameters: `{}`.

**Repair:** Pass the generated identifier, random bytes, or timestamp as a parameter from an adapter or inject a narrow Clock / IdGenerator port.

**Scope and limits:** Qualifying the call with globalThis or window in domain, entities, or use-cases directories still couples core logic to ambient runtime effects.

**Interactions when active together:**

- Duplicates `architecture/FCIS-IO-002`: Both flag crypto randomness and performance.now() when domain, entity, or use-case folders belong to the core layer. Settle: Keep one active or turn architecture/ARCH-EFF-002 off when FCIS-IO-002 covers the core layer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Hexagonal architecture (A. Cockburn; ports and adapters) and Grokking Simplicity (E. Normand, 2021)",
  "locator": "driven ports for nondeterministic clock and ID generation",
  "paraphrase": "Domain entities and application use cases receive identifiers and timestamps through explicit inputs or driven ports instead of calling Web Crypto or high-resolution timers directly."
}
```

## architecture/layered

Manifest version: `1.0.0`. Status: **complete**.

### architecture/LAYER-CLOSE-001

Check: [`architecture/layers/no-presentation-to-persistence@1.0.0`](checks/layers/no-presentation-to-persistence/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `layers.presentation-persistence`. Minimum severity: `none`.

Presentation code that directly imports persistence bypasses domain invariants and couples the UI/API to the database schema.

Default parameters: `{}`.

**Repair:** Call the service or use-case in the application/business layer instead of importing the repository directly.

**Scope and limits:** Using dynamic import(), type-only re-exports or path aliases to reach the persistence folder directly from a controller.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Pattern-Oriented Software Architecture Vol 1 (Buschmann et al., 1996); Microsoft Application Architecture Guide (2009)",
  "locator": "Layered Architecture (Closed Layers)",
  "paraphrase": "In strict (closed) layers, a layer may only call the layer immediately below it; presentation calls business/application logic, never persistence or the database directly."
}
```

### architecture/LAYER-TX-001

Check: [`architecture/layers/no-transaction-in-presentation@1.0.0`](checks/layers/no-transaction-in-presentation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `layers.presentation-transaction`. Minimum severity: `none`.

Opening or committing database transactions in presentation code leaks infrastructure lifecycle into the UI layer.

Default parameters: `{}`.

**Repair:** Demarcate transaction boundaries in the service or use-case layer.

**Scope and limits:** Calling $transaction, beginTransaction, commit, or rollback directly within controllers or routes.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Patterns of Enterprise Application Architecture (M. Fowler, 2002)",
  "locator": "Unit of Work / Transaction Script in Service Layer",
  "paraphrase": "Transaction boundaries belong to business operations in the application or domain service layer, not to HTTP controllers or UI presentation."
}
```

## architecture/modular-monolith

Manifest version: `1.0.0`. Status: **complete**.

### architecture/MOD-EDGE-001

Check: [`architecture/modules/no-cross-module-internals@1.0.0`](checks/modules/no-cross-module-internals/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `modules.cross-internals`. Minimum severity: `none`.

A modular monolith stays one deployable only while modules meet at their public API. Crossing into internals couples two modules' private schemas.

Default parameters: `{}`.

**Repair:** Call the other module through the function or type it exports from its root. Keep persistence inside the owning module.

**Scope and limits:** export { row } from the other module's persistence path is still a cross-module edge.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Modular monolith (S. Newman; module boundaries)",
  "locator": "published interface of a module",
  "paraphrase": "Modules in one process still hide their internals. Callers use the published interface. Persistence and internal helpers stay inside the module that owns them."
}
```

### architecture/MOD-SHARED-001

Check: [`architecture/modules/no-shared-imports-business@1.0.0`](checks/modules/no-shared-imports-business/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `modules.shared-imports-business`. Minimum severity: `none`.

A shared module that imports business modules creates circular dependencies and entangles shared utilities with specific domain logic.

Default parameters: `{}`.

**Repair:** Remove business feature imports from shared code, or move the domain-specific logic into the owning module.

**Scope and limits:** Re-exporting feature types or dynamically importing business modules from within shared/common packages.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Domain-Driven Design (E. Evans, 2003); Modular Monolith (K. Grzybek)",
  "locator": "Shared Kernel",
  "paraphrase": "The shared module, if it exists, does not depend on any business module. Others may depend on it; it depends on none, staying free of business domain models."
}
```

## architecture/repository

Manifest version: `1.0.0`. Status: **complete**.

### architecture/REPO-ROW-001

Check: [`architecture/repository/returns-raw-row@1.0.0`](checks/repository/returns-raw-row/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `repository.raw-row`. Minimum severity: `none`.

The row is the database's shape. Returning it makes every caller depend on column names and nullability the domain did not choose.

Default parameters: `{}`.

**Repair:** Map the columns onto the domain type in the repository and return that value. Keep the row type private to the repository file.

**Scope and limits:** return row as Invoice and return { ...row } are the same leak. return row.id is a field read, not this rule; a mapper that still returns the whole row is.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Patterns of Enterprise Application Architecture (M. Fowler, 2002)",
  "locator": "Repository",
  "paraphrase": "A repository looks like a collection of domain objects. Callers do not see the query rows the infrastructure used to load them."
}
```

## architecture/vertical-slice

Manifest version: `1.0.0`. Status: **complete**.

### architecture/SLICE-EDGE-001

Check: [`architecture/slices/no-sibling-internals@1.0.0`](checks/slices/no-sibling-internals/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `slices.sibling-internals`. Minimum severity: `none`.

A slice that uses a neighbor's private folders breaks when that neighbor renames its insides, and the public entry stops being the only contract.

Default parameters: `{}`.

**Repair:** Import the other feature from its folder entry (../orders or ../orders/index) and keep the private folders unimported.

**Scope and limits:** export * from the sibling internal path publishes the same private modules.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Vertical slice architecture (J. Bogard)",
  "locator": "feature folders and public surface",
  "paraphrase": "A feature owns its handlers, model, and persistence. Another feature talks to it through the entry the slice chooses to expose, not through its private files."
}
```
