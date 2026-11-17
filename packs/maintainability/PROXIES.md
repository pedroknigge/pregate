# Judgment proxy coverage

One hundred maintainability judgments, each bound to a rule that can fire or to no honest proxy. This is a map, not a second catalog: the label only identifies the binding. Item 25 and item 60 are the only rows without a proxy.

FH-01 through FH-100 and SE-01 through SE-100 stay project-evidence obligations in their own methodologies. This map does not copy them. A row names the rule that decides the judgment, or says there is no honest proxy. The seven proxies added in pack 1.3.0 are MAINT-MAGIC-001, MAINT-TEST-001, MAINT-ADR-001, MAINT-TODO-001, MAINT-FLAG-001, MAINT-CHURN-001, and MAINT-AND-001.

God-module file length, export counts, and import cycles are not in this pack. A separate architecture change owns those metrics.

Fidelity: high means the check decides the condition in the label. Medium means a structural stand-in: a token, a path, a count, a sibling file, or project evidence that a person still binds. Low means a name shape.

| # | Judgment | Binding | Fidelity |
| ---: | --- | --- | --- |
| 1 | Domain code does not import an adapter | architecture/HEX-EDGE-001 | high |
| 2 | A port names an implementation | architecture/HEX-PORT-001 | medium |
| 3 | Entities do not import outward | architecture/DEP-ENT-001 | high |
| 4 | Use cases do not import outward | architecture/DEP-UC-001 | high |
| 5 | Adapters do not import a framework | architecture/DEP-IA-001 | high |
| 6 | Adapters do not import each other | architecture/HEX-ADAPT-001 | high |
| 7 | A module does not import sibling internals | architecture/MOD-EDGE-001 | high |
| 8 | Shared code does not import a business module | architecture/MOD-SHARED-001 | high |
| 9 | The core does not read the clock, random, or the environment | architecture/FCIS-IO-002 | high |
| 10 | Dependencies point toward the domain | architecture/FCIS-DEP-001 | high |
| 11 | Presentation does not touch persistence | architecture/LAYER-CLOSE-001 | high |
| 12 | Presentation does not open a transaction | architecture/LAYER-TX-001 | high |
| 13 | A slice does not reach into a sibling | architecture/SLICE-EDGE-001 | high |
| 14 | A repository does not return a raw row | architecture/REPO-ROW-001 | medium |
| 15 | An anti-corruption layer does not re-export a foreign type | architecture/ACL-REEXPORT-001 | high |
| 16 | A query does not mutate | architecture/CQRS-QRY-001 | high |
| 17 | A command does not import a query | architecture/CQRS-CMD-001 | high |
| 18 | A use case class stays within a public-method budget | architecture/CA-UC-001 | medium |
| 19 | Domain code does not call crypto, time, or random | architecture/ARCH-EFF-002 | high |
| 20 | Banned imports stay outside the core | architecture/CA-DEP-002 | high |
| 21 | Control-flow nesting stays within two levels | maintainability/MAINT-NEST-001 | high |
| 22 | A boolean name states the positive condition | maintainability/MAINT-BOOL-001 | medium |
| 23 | An exported name is not a placeholder | maintainability/MAINT-NAME-001 | medium |
| 24 | An interface is not empty | maintainability/MAINT-EMPTY-001 | high |
| 25 | Reads like prose | no honest proxy | none |
| 26 | Domain code does not return null directly | maintainability/MAINT-NULL-001 | medium |
| 27 | Domain time is not an ambient clock | maintainability/MAINT-CLOCK-001 | high |
| 28 | A class name does not end in Impl | maintainability/MAINT-IMPL-001 | low |
| 29 | A deprecation names its replacement | maintainability/MAINT-DEPR-001 | medium |
| 30 | A migration defines a down path | maintainability/MAINT-MIGR-001 | medium |
| 31 | A function stays within a line budget | clean-code/CC-FN-001 | medium |
| 32 | A function stays within a parameter budget | clean-code/CC-FN-002 | high |
| 33 | Nesting stays within a depth budget | clean-code/CC-NEST-001 | high |
| 34 | A catch is not empty | clean-code/CC-ER-002 | high |
| 35 | A try is the whole function | clean-code/CC-ER-003 | medium |
| 36 | A boolean argument is not a mode flag | senior/SR-FLAG-001 | medium |
| 37 | A call chain stays short | senior/SR-CHAIN-001 | medium |
| 38 | A statement is not unreachable | senior/SR-DEAD-001 | high |
| 39 | var is not used | senior/SR-VAR-001 | high |
| 40 | Equality is strict | senior/SR-EQ-001 | high |
| 41 | A parameter is not reassigned | senior/SR-MUT-001 | high |
| 42 | A ternary is not nested | senior/SR-NEST-001 | high |
| 43 | A block body is not empty | senior/SR-EMPTY-001 | high |
| 44 | A class stays within a public-method budget | senior/SR-WIDE-001 | medium |
| 45 | Assertions do not decrease | testing/TDD-DEL-001 | high |
| 46 | A focused or skipped test does not hide the suite | testing/TDD-FOCUS-001 | high |
| 47 | A TODO names an owner | vibe-proof/VP-TODO-001 | medium |
| 48 | A secret is not a string literal | vibe-proof/VP-SECRET-001 | medium |
| 49 | SQL is not built by string interpolation | vibe-proof/VP-SQL-001 | high |
| 50 | A find-many query is bounded | vibe-proof/VP-FIND-MANY-001 | medium |
| 51 | Divide the system by the reason for change, not by the technology | core/CORE-INV-001 | medium |
| 52 | Keep related parts together | core/CORE-INV-002 | medium |
| 53 | Hide the parts that can change | core/CORE-INV-003 | medium |
| 54 | Each observable behavior becomes a contract | core/CORE-INV-004 | medium |
| 55 | Dependencies must point to the stable part | core/CORE-INV-005 | medium |
| 56 | Make an abstraction only when two real implementations exist, or when a change already occurred. | core/CORE-INV-006 | medium |
| 57 | Give each unit one reason for change | core/CORE-INV-007 | medium |
| 58 | Make each dependency explicit | core/CORE-INV-008 | medium |
| 59 | A unit must use only the parts that it receives, the parts that it makes, or the parts that it owns | core/CORE-INV-009 | medium |
| 60 | DRY only for the same business rule | no honest proxy | none |
| 61 | Use composition to reuse behavior | core/CORE-INV-010 | medium |
| 62 | Keep interfaces narrow | core/CORE-INV-011 | medium |
| 63 | Keep one source of truth for each fact | core/CORE-INV-012 | medium |
| 64 | Boundary validation can repeat a domain rule | core/CORE-INV-013 | medium |
| 65 | Do not make an invalid state possible | core/CORE-INV-014 | medium |
| 66 | Use immutable data for shared data | core/CORE-INV-015 | medium |
| 67 | Make time and identity data, not hidden context | core/CORE-INV-016 | medium |
| 68 | Separate a command from a query when the effect is important | core/CORE-INV-017 | medium |
| 69 | Use the domain language for module names, operation names, and data names | core/CORE-INV-018 | medium |
| 70 | Fail immediately when an invariant is broken or when the configuration is unknown | core/CORE-INV-019 | medium |
| 71 | Separate a programmer failure from an expected failure | core/CORE-INV-020 | medium |
| 72 | Each operation that can run more than one time must be idempotent, or it must have an idempotency key | core/CORE-INV-021 | medium |
| 73 | Do not trust a remote part | core/CORE-INV-022 | medium |
| 74 | Do not let a failure cascade | core/CORE-INV-023 | medium |
| 75 | Keep external effects explicit and at the boundary | core/CORE-INV-024 | medium |
| 76 | Name the conflict rule for concurrent writes | core/CORE-INV-025 | medium |
| 77 | Do not build a part that you cannot show you need | core/CORE-INV-026 | medium |
| 78 | Use the simplest design that meets the current constraints | core/CORE-INV-027 | medium |
| 79 | Design each module so that you can delete it | core/CORE-INV-028 | medium |
| 80 | Evolve the design with vertical slices, not with complete horizontal layers | core/CORE-INV-029 | medium |
| 81 | Prepare for a change only in the direction that you already see | core/CORE-INV-030 | medium |
| 82 | Make compatibility an explicit decision | core/CORE-INV-031 | medium |
| 83 | Prefer clear code to clever code | core/CORE-INV-032 | medium |
| 84 | The name must predict the behavior | core/CORE-INV-033 | medium |
| 85 | Use one level of abstraction in each unit | core/CORE-INV-034 | medium |
| 86 | Use the least powerful mechanism that solves the problem | core/CORE-INV-035 | medium |
| 87 | Give each constant and each policy a name and a location | core/CORE-INV-036 | medium |
| 88 | Delete dead code and dead configuration paths | core/CORE-INV-037 | medium |
| 89 | Give the minimum privilege by default | core/CORE-INV-038 | medium |
| 90 | Do not trust input that crosses a boundary | core/CORE-INV-039 | medium |
| 91 | Do not put secrets in the code or in the log | core/CORE-INV-040 | medium |
| 92 | Do authorization on the server that makes the decision, not on the screen | core/CORE-INV-041 | medium |
| 93 | Fail closed | core/CORE-INV-042 | medium |
| 94 | A numeric literal is on the allowlist or is a named constant | maintainability/MAINT-MAGIC-001 | medium |
| 95 | A domain file has a sibling or mirrored test | maintainability/MAINT-TEST-001 | medium |
| 96 | An architecture edit shares its diff with an ADR change | maintainability/MAINT-ADR-001 | medium |
| 97 | A TODO or FIXME cites an issue id | maintainability/MAINT-TODO-001 | medium |
| 98 | A risky path imports a feature-flag module | maintainability/MAINT-FLAG-001 | medium |
| 99 | A hot file does not grow | maintainability/MAINT-CHURN-001 | medium |
| 100 | A function name does not join two actions with And or Then | maintainability/MAINT-AND-001 | low |
