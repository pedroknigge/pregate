# architecture backlog

Practices from the same sources that are not binary invariants. They stay out of the pack until a check can decide them from the syntax tree without a rename or a comment winning.

- **Use-case narrative quality.** Whether a use case "tells the business story" is a reading of names and level of abstraction. This pack can cap public methods on use-case paths; that does not establish narrative quality.
- **Aggregate consistency.** Whether two writes form one transaction, or whether a handler bypasses an invariant, depends on the domain rule. The syntax cannot see the invariant.
- **Port completeness.** Whether a port's methods are the right seam is design judgment. This pack only rejects an implementation living in the port folder.
- **Read-model shape.** Whether a query returns too much or too little is product judgment. The query rule only rejects a write through a known client name.
- **Slice size.** Whether a feature folder is "one capability" is a naming and scoping judgment.
- **Module granularity.** Whether two modules should be one is a change-coupling judgment, not an import the parser can score.
- **Semantic dependency ownership.** The engine's layer-edge primitive follows literal imports, barrels and path aliases using the preset's declared map. Both Clean Architecture and Functional Core policies activate it. Choosing the right owners and permitted edges requires project evidence; computed imports, arbitrary alias data flow and undeclared callback effects do not become proven by this graph check. `architecture/structure` counts a strongly connected component of literal value imports. A computed specifier, a type-only import, and dynamic `import()` stay outside that count on purpose.
- **Whether a large file is actually one responsibility.** File length and the number of public names are ceilings, not a proof that the module has one reason to change. A short file can still mix jobs. A destructured `export const { a, b } = value` is one name to the export counter.
- **Repository query objects.** Whether a specification object is better than a method is an API-design judgment. Returning the raw `row` / `record` / `raw` binding is the decidable slice.
- **Anti-corruption mapping quality.** Whether the translator dropped a field or leaked a foreign id inside a renamed local type is semantic. The rule only rejects re-exporting the package.
- **Screaming architecture / folder names that match the domain.** Naming is not a stable binary check.
- **Single deployable artifact identity.** Verifying that a modular monolith builds into a single artifact or container is a CI/CD pipeline step, not a pre-write syntax tree invariant.
- **Distributed consistency and saga coordination.** Whether cross-module or cross-service communication coordinates via sagas, choreography, or orchestration is a runtime distributed systems design decision.
- **Microservices extraction triggers (Strangler Fig).** Determining when team friction or scaling profiles justify extracting a module into an independent service is organizational judgment.
- **Serverless ephemeral runtime constraints.** Memory sizing, concurrency limits, and cold-start mitigations belong to infrastructure IaC templates rather than static code syntax checks.
