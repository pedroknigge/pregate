# nestjs

Senior NestJS invariants that the syntax tree can decide. The stance of this pack is: controllers handle HTTP and inject providers, they never construct them; route verbs match handler names; status codes are named enum members; guards that take no arguments protect nothing; providers stay singleton; validation pipes whitelist; and named route values carry a pipe. On NestJS 12.5 or newer, WebSocket and microservice limits stay at the framework defaults, and a TCP transport that should accept other hosts names its host. Framework entry files keep their decorators; this pack only bans the hollow forms.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `nestjs/NEST-CTRL-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `NEST-CTRL-001` | `new XService` / `new XRepository` / `new XUseCase` inside an `@Controller` class. | A manually constructed provider skips scope, lifecycle hooks, and test doubles. | deny |
| `NEST-VERB-001` | A `@Get` handler whose method name starts with create, update, delete, or remove. | A GET handler named create lies in logs and clients; reviewers approve a read that writes. | deny |
| `NEST-CODE-001` | `res.status(NNN)` with a numeric code inside an `@Controller` class. | A bare number hides intent and locks the handler to Express instead of the framework reply. | deny |
| `NEST-GUARD-001` | `@UseGuards()` with no arguments, including `@UseGuards(...[])`. | An empty guard decorator reads as protected in review while enforcing nothing. | deny |
| `NEST-PARSE-001` | `@Param("key")` / `@Query("key")` with a key but no pipe. | String-valued route parameters are valid; a parser is needed only when the target type requires it. | off |
| `NEST-INJ-001` | `new` on any `*Service`, `*Repository`, or `*Provider`, anywhere in the file. | A new-built provider duplicates singleton state and cannot be substituted in tests. | deny |
| `NEST-SCOPE-001` | `@Injectable({ ... Scope.REQUEST ... })`. | Request scope is supported for request-specific state; review its cost. | warn |
| `NEST-PIPE-001` | `new ValidationPipe(...)` without `whitelist` or `forbidNonWhitelisted`. | Without whitelist an attacker sets flags and ids that no DTO decorator mentions. | deny |
| `NEST-SYNC-001` | `synchronize: true` inside `TypeOrmModule.forRoot` or `forRootAsync`, outside test files. | Schema sync at startup can drop production columns and their data. | warn |
| `NEST-PASSTHROUGH-001` | `@Res()` or `@Response()` parameter decorator without `{ passthrough: true }`. | Bare `@Res()` disables Nest interceptors, `@HttpCode()`, and return-value serialization. | deny |
| `NEST-DECORATOR-001` | A class implementing `CanActivate`, `NestInterceptor`, `PipeTransform`, or `ExceptionFilter` without `@Injectable()` or `@Catch()`. | Without `@Injectable()`, TypeScript omits constructor metadata and Nest DI cannot inject dependencies. | deny |
| `NEST-LIMIT-001` | A NestJS 12.5 limit raised above its default, or set to the value that lifts it (`maxPayload: 0`, TCP `maxConcurrentMessages: 0`, `Infinity`, and the related caps). | One client can hold a large payload or an unbounded queue. Keep the default or set a bounded value on the adapter, gateway, or transport options. | deny |
| `NEST-TCP-001` | A TCP transport on NestJS 12.5 or newer whose host is empty, comes from an unset env or config read, or is omitted in a file that looks meant for other hosts. | An empty host now means localhost, so a service that expected other hosts never receives them. Set `host` explicitly. | warn |

## Methodologies

- `nestjs/controllers` — NEST-CTRL-001, NEST-VERB-001, NEST-CODE-001, NEST-GUARD-001, NEST-PARSE-001, NEST-PASSTHROUGH-001
- `nestjs/providers` — NEST-INJ-001, NEST-SCOPE-001, NEST-PIPE-001, NEST-SYNC-001, NEST-DECORATOR-001
- `nestjs/transport` — NEST-LIMIT-001, NEST-TCP-001. Opt-in with `pregate pack enable nestjs/transport`. Not added to existing presets. Runs only where `pregate enable` has turned the project on, and only when `@nestjs/core` is 12.5.0 or newer.

Non-decidable practices from the same sources are in `BACKLOG.md`.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.3.0`. 13 distinct check IDs.

Methodologies: `nestjs/controllers` (complete), `nestjs/providers` (complete), `nestjs/transport` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
