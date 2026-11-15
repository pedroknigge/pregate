# nestjs pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## nestjs/controllers

Manifest version: `1.2.0`. Status: **complete**.

### nestjs/NEST-CTRL-001

Check: [`nestjs/controllers/no-controller-business-logic@1.0.0`](checks/controllers/no-controller-business-logic/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.controller-logic`. Minimum severity: `none`.

A manually constructed provider skips scope, lifecycle hooks, and test doubles, so the handler runs a different object than the module built.

Default parameters: `{}`.

**Repair:** Declare the provider as a constructor parameter with private readonly and call it through this.

**Scope and limits:** Injecting the service but still calling new on a second helper inside the handler is the same bypass.

**Interactions when active together:**

- Contradicts `typescript/TS-LEGACY-005` (compiles only once the preset records it in `settled`): NEST-CTRL-001 tells controllers to receive providers as private readonly constructor parameters, and TS-LEGACY-005 denies constructor parameter properties. Settle: Nest also injects plain constructor parameters: declare the field and assign it in the constructor body to satisfy both, or exclude Nest controllers and providers from TS-LEGACY-005.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "controllers and providers with constructor injection",
  "paraphrase": "Controllers handle HTTP and delegate domain work to providers, which the injector supplies through the constructor.",
  "work": "NestJS documentation, Controllers"
}
```

### nestjs/NEST-VERB-001

Check: [`nestjs/controllers/no-verb-mismatch@1.0.0`](checks/controllers/no-verb-mismatch/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.verb-mismatch`. Minimum severity: `none`.

A GET handler named create lies in logs, traces, and generated clients, and reviewers approve a read that writes.

Default parameters: `{}`.

**Repair:** Pair create/update/delete/remove names with @Post/@Put/@Patch/@Delete, or rename the method to what the GET returns.

**Scope and limits:** @Get with a name like getCreatedOrders still starts with get, which is a read verb and is fine.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "route decorators @Get @Post @Put @Delete",
  "paraphrase": "Each route decorator declares the HTTP method. The handler name should read as that operation.",
  "work": "NestJS documentation, Controllers"
}
```

### nestjs/NEST-CODE-001

Check: [`nestjs/controllers/no-explicit-status-enum@1.0.0`](checks/controllers/no-explicit-status-enum/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.explicit-status`. Minimum severity: `none`.

A bare 200 hides whether the author meant OK, and res.status locks the handler to Express instead of the framework reply.

Default parameters: `{}`.

**Repair:** Return the value and set @HttpCode(HttpStatus.CREATED), or throw an HttpException built from HttpStatus.

**Scope and limits:** Returning an object with a status field is a payload, not this rule. Only res.status(NNN) matches.

**Interactions when active together:**

- Contradicts `typescript/TS-THROW-001` (compiles only once the preset records it in `settled`): NEST-CODE-001 directs error responses to a thrown HttpException, and TS-THROW-001 denies throws inside methods of an exported controller class. Settle: Exclude **/*.controller.ts from TS-THROW-001: Nest maps a thrown HttpException to the response. Keep TS-THROW-001 on services and domain code.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "@HttpCode and HttpStatus enum",
  "paraphrase": "Status codes have named enum members. @HttpCode sets the code without touching the response object.",
  "work": "NestJS documentation, Controllers"
}
```

### nestjs/NEST-GUARD-001

Check: [`nestjs/controllers/no-empty-useguards@1.0.0`](checks/controllers/no-empty-useguards/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.empty-guards`. Minimum severity: `none`.

An empty @UseGuards() reads as protected in review while enforcing nothing, so the route ships open.

Default parameters: `{}`.

**Repair:** Pass the guard class, for example @UseGuards(JwtAuthGuard), or delete the decorator.

**Scope and limits:** A filled @UseGuards(JwtAuthGuard) is the fix, not a second empty decorator on the same handler.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "authorization with @UseGuards",
  "paraphrase": "Guards decide who reaches a route. @UseGuards takes the guard classes that run before the handler.",
  "work": "NestJS documentation, Guards"
}
```

### nestjs/NEST-PARSE-001

Check: [`nestjs/controllers/no-param-without-pipe@1.0.0`](checks/controllers/no-param-without-pipe/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.param-pipe`. Minimum severity: `none`.

The route value may intentionally be a string. This check cannot tell when conversion is required.

Default parameters: `{}`.

**Repair:** Add the pipe inline: @Param("id", ParseIntPipe) id: number, or ParseUUIDPipe for uuid routes.

**Scope and limits:** @Param() with no key reads the whole params object and needs no pipe. Only a named key without a pipe matches.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "pipes with @Param and ParseIntPipe",
  "paraphrase": "Route values arrive as strings. A pipe such as ParseIntPipe converts and rejects them before the handler.",
  "work": "NestJS documentation, Pipes"
}
```

### nestjs/NEST-PASSTHROUGH-001

Check: [`nestjs/controllers/no-raw-res-without-passthrough@1.0.0`](checks/controllers/no-raw-res-without-passthrough/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.res-passthrough`. Minimum severity: `none`.

Without { passthrough: true }, Nest stops serializing the return value, skips response interceptors, and hangs if the handler returns a value without manually calling res.send().

Default parameters: `{}`.

**Repair:** Pass @Res({ passthrough: true }) so you can set cookies or headers while letting Nest send the returned value through its standard pipeline.

**Scope and limits:** Handlers that legitimately stream a raw response must disable this rule for that route. Options passed through a variable are not evaluated.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "NestJS documentation, Controllers (docs.nestjs.com)",
  "locator": "https://docs.nestjs.com/controllers#library-specific-approach",
  "paraphrase": "Injecting @Res() or @Response() puts the handler in library-specific mode and disables Nest interceptors and @HttpCode unless { passthrough: true } is passed."
}
```

## nestjs/providers

Manifest version: `1.1.0`. Status: **complete**.

### nestjs/NEST-INJ-001

Check: [`nestjs/providers/no-new-injectable@1.0.0`](checks/providers/no-new-injectable/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.new-provider`. Minimum severity: `none`.

A new-built provider duplicates singleton state, so two writers diverge and tests cannot substitute the module graph.

Default parameters: `{}`.

**Repair:** List the provider class in the module and declare it as a constructor parameter where it is used.

**Scope and limits:** Passing the dependency through a static factory that still calls new keeps the bypass. Register the class and inject it.

**Interactions when active together:**

- Contradicts `typescript/TS-LEGACY-005` (compiles only once the preset records it in `settled`): NEST-INJ-001 tells callers to receive providers as constructor parameters, the Nest idiom being private readonly parameter properties, which TS-LEGACY-005 denies. Settle: Nest also injects plain constructor parameters: declare the field and assign it in the constructor body to satisfy both, or exclude Nest controllers and providers from TS-LEGACY-005.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "providers and custom providers with useClass",
  "paraphrase": "Providers are classes the injector builds. Modules list the class and consumers declare it as a dependency.",
  "work": "NestJS documentation, Providers"
}
```

### nestjs/NEST-SCOPE-001

Check: [`nestjs/providers/no-request-scope@1.0.0`](checks/providers/no-request-scope/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.request-scope`. Minimum severity: `none`.

Request scope is supported for request-specific state; it can increase per-request allocations, so review the tradeoff.

Default parameters: `{}`.

**Repair:** Drop the scope option for the default singleton, or pass request state as a method argument.

**Scope and limits:** Scope.TRANSIENT is a separate scope and is allowed here. Only Scope.REQUEST matches.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "injection scopes, singleton default",
  "paraphrase": "Providers are singletons by default. Request scope rebuilds the provider subtree for every request.",
  "work": "NestJS documentation, Fundamentals"
}
```

### nestjs/NEST-PIPE-001

Check: [`nestjs/providers/no-validationpipe-any@1.0.0`](checks/providers/no-validationpipe-any/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.validation-pipe`. Minimum severity: `none`.

Without whitelist an attacker sets admin flags and relation ids that no DTO decorator mentions.

Default parameters: `{}`.

**Repair:** Construct the pipe with { whitelist: true }, and add forbidNonWhitelisted: true to reject instead of strip.

**Scope and limits:** transform: true without whitelist still passes unknown properties. Only whitelist or forbidNonWhitelisted counts.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "ValidationPipe with whitelist",
  "paraphrase": "ValidationPipe strips properties that have no decorator when whitelist is set, closing mass assignment.",
  "work": "NestJS documentation, Pipes"
}
```

### nestjs/NEST-SYNC-001

Check: [`nestjs/data/no-typeorm-synchronize@1.0.0`](checks/data/no-typeorm-synchronize/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.typeorm-synchronize`. Minimum severity: `none`.

With synchronize on, TypeORM alters the schema at startup to match the entities, so a renamed or removed column drops its production data.

Default parameters: `{}`.

**Repair:** Set synchronize: false and apply schema changes with TypeORM migrations, or derive the flag from configuration so production never receives true.

**Scope and limits:** A quoted key or a forRootAsync factory that returns synchronize: true is the same setting. A condition such as NODE_ENV === "development" is allowed. Test and e2e files are not checked. An options object built outside the call is not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "https://docs.nestjs.com/data/typeorm (synchronize warning)",
  "paraphrase": "Don't use synchronize: true in production; otherwise, you can lose production data.",
  "work": "NestJS documentation, TypeORM integration"
}
```

### nestjs/NEST-DECORATOR-001

Check: [`nestjs/providers/no-undecorated-provider@1.0.0`](checks/providers/no-undecorated-provider/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nestjs.undecorated-provider`. Minimum severity: `none`.

Omitting @Injectable() prevents TypeScript from emitting constructor design:paramtypes metadata, causing Nest DI resolution to fail when dependencies are injected.

Default parameters: `{}`.

**Repair:** Add @Injectable() (or @Catch(...) on an ExceptionFilter) above the class declaration.

**Scope and limits:** Only classes with an explicit implements clause for CanActivate, NestInterceptor, PipeTransform, or ExceptionFilter are checked.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "NestJS documentation, Guards / Interceptors / Pipes (docs.nestjs.com)",
  "locator": "https://docs.nestjs.com/guards",
  "paraphrase": "Guards, interceptors, pipes, and exception filters are providers managed by the Nest IoC container and must be decorated with @Injectable() (or @Catch() for filters)."
}
```
