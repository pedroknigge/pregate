# nestjs backlog

Judgment, cross-file wiring, or checks the TS syntax tree cannot decide without guessing types.

- **Module graph wiring.** Whether a provider is registered in the right module, `forwardRef` cycles, and global-module leakage need the module graph across files. This pack only sees construction shapes in one file.
- **Guard ordering.** `@UseGuards(A, B)` runs A before B; whether authentication precedes authorization is a semantic order the tree can read but not judge without the guard identities.
- **Interceptor serialization.** `ClassSerializerInterceptor` with `@Exclude()` / `@Expose()` is a presence check that proves nothing about what actually leaves over the wire without response-shape knowledge.
- **CQRS command/query split.** Whether a handler belongs in a command or a query, and saga placement, is architecture-pack territory.
- **E2e module init.** `Test.createTestingModule(...).compile()` versus full `init()` lifecycle in e2e setup is a test-harness flow, not a single-file syntax shape.
- **Public routes by absence.** A route with no guard may be intentionally public. Absence is not a shape, so the pack flags the hollow `@UseGuards()` instead (NEST-GUARD-001).
- **Non-exported controllers.** The class-decorator scope reads the enclosing `export` statement, where `@Controller` lives in the syntax tree. A never-exported `@Controller class` is invisible to NEST-CTRL-001 and NEST-CODE-001.
- **DTO validation completeness.** Whether every DTO field carries a validator decorator needs decorator-set knowledge per class, not one pattern.
- **Streaming response controllers (`NEST-PASSTHROUGH-001` limit).** `NEST-PASSTHROUGH-001` requires `@Res({ passthrough: true })` on controller parameters. Endpoints that genuinely stream binary chunks or SSE directly through the platform response must disable the rule per handler.
- **Indirect provider interfaces (`NEST-DECORATOR-001` limit).** `NEST-DECORATOR-001` checks classes with an explicit `implements CanActivate | NestInterceptor | PipeTransform | ExceptionFilter` clause. Providers that implement a base class or custom token without naming the Nest interface in `implements` are not matched.
- **Computed NestJS 12.5 limits (`NEST-LIMIT-001` limit).** A limit kept in a variable, built with a spread, or written with numeric separators is not evaluated. `1024*1024` without spaces is the payload default and is not flagged. `limits.jsonFieldsSize: 0` is not flagged: the 12.5 notes do not say that 0 lifts it, and the fastify implementation was not in the pages retrieved for this pack. Kafka `maxMessageSize` predates 12.5 and is out of scope. `fields`, `files`, and `maxCount` do not lift the multipart part cap, so only `limits.parts` is flagged.
- **Absent TCP host (`NEST-TCP-001` limit).** Since NestJS 11 a missing `host` key already meant localhost. The advisory warns on that omission only when the same file looks non-local. A host computed outside `process.env` or a `.get()` call, and `ClientsModule.register`, are not matched.
