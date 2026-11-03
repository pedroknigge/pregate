# mattpocock rules pack

Optional engineering practice rules derived from [Matt Pocock's engineering skills](https://github.com/mattpocock/skills/tree/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering), reviewed at commit `6fd947921b935b7e1e69293a200400f0fdd5c15f`. This is a PREGATE adaptation, not an official Matt Pocock pack. Upstream skills are source material; selecting this pack does not invoke their workflows.

The complete review of all 20 skills and their companion references is in [INVARIANTS.md](INVARIANTS.md). [BACKLOG.md](BACKLOG.md) records the requirements the current engine cannot establish. [REFERENCE.md](REFERENCE.md) gives each executable rule's precise scope, defaults, provenance and repairs. See the [pack library](../README.md) and [conversion guide](../../docs/guides/docs-to-rule-pack.md).

The conversation review and
[domain-language guide](../../docs/guides/domain-language.md) show how to combine
this pack with pstack and project-specific assertions. They add workflow guidance
and an executable example; the six bounded rule contracts remain unchanged.

## Selectable policies

| Methodology | Rule | Observable finding |
| --- | --- | --- |
| `mattpocock/testing` | `MP-SELF-001` | Positive equality assertion compares the same identifier or scalar literal with itself |
| `mattpocock/testing` | `MP-MOCK-001` | A recognized module-mock call replaces a literal relative module |
| `mattpocock/testing` | `MP-CALLS-001` | An `expect` chain uses a recognized call-count or call-order matcher |
| `mattpocock/testing` | `MP-MOCK-BRANCH-001` | An inline `vi.fn`/`jest.fn` implementation contains an if, switch or ternary |
| `mattpocock/design` | `MP-PARAMS-001` | A parsed function exposes more than four effective inputs |
| `mattpocock/design` | `MP-ENUM-001` | A TypeScript `enum` or `const enum` declaration is used instead of a literal union or `as const` object |
| `mattpocock/diagnosis` | `MP-DEBUG-001` | A direct console call contains a string/template argument starting with a temporary `[DEBUG-...]` tag |

All seven defaults are **warn**, and all three manifests are **preview**. Relative modules can be system adapters; call counts/order can be externally observable contracts; stateful boundary fakes can intentionally branch. Debug logs are useful during active diagnosis. Review these findings before changing the code or upgrading severity.

Four inputs is a local, configurable calibration of small function interfaces, not a threshold specified by Matt Pocock. The metric includes inline object/destructuring leaves and tuple-rest slots; a named aggregate type is opaque. It does not measure module depth. Upstream explicitly rejects depth inferred from code-line ratios and an interface reduced to TypeScript declarations.

## Coverage and compatibility

Version `1.1.0`; included in 0.0.2. TypeScript/TSX and JavaScript files use PREGATE's TypeScript/TSX grammars. Fixtures exercise TypeScript, TSX and JavaScript. No Python, Go, Markdown, HTML or Bash checks are promised.

Testing policies default to `*.test.*`, `*.spec.*`, `__tests__/`, `test/` and `tests/` paths. Design and diagnosis default to the selected project's scope. Every check runs at pre, stop, commit and CI phases. `paths`, `exclude`, severity and enforcement can be selected through the reviewed project contract.

Name-based AST patterns do not resolve imported bindings. Aliased test utilities, computed module paths, path aliases and bracket access are documented limits. The pack does not establish test execution, red-before-green order, user-approved seams, independent truth for every expected value, cleanup completion or conformity to a spec.

Existing `testing/tdd` and `pstack/proof` cover adjacent syntax; this pack does not copy their checks. Assertion-count ratchets must be reviewed when deepening modules: [upstream DEEPENING.md](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/codebase-design/DEEPENING.md) allows replacing old shallow tests with interface tests. `mattpocock/design` and `clean-code/clean-code` use different checks in the `fn.params` dimension. The engine can retain both policies; select one or use `resolve.fn.params` to choose the desired policy explicitly.

## Inspect, validate and adopt

From the PREGATE repository:

```sh
bun src/main.ts rules test packs/mattpocock
bun src/main.ts pack show --library mattpocock --json
```

With an engine built from this checkout:

```sh
pregate rules test --library mattpocock
pregate pack add --library mattpocock --preview
# Review and approve the displayed source candidate.
pregate pack enable mattpocock/testing --only MP-SELF-001,MP-MOCK-001 --preview
pregate pack enable mattpocock/design --preview
pregate pack enable mattpocock/diagnosis --preview
```

Adding the source and selecting methodologies are separate operations. This contribution registers bundled data; it does not activate rules in an existing project.

## Provenance and changes

Review date: 2026-10-06. Every admitted invariant links a source file at the pinned revision and names the relevant section. Requirements are paraphrased; upstream prompts and executable templates are not installed. Upstream is MIT licensed; its copyright and permission notice are preserved in [LICENSE](LICENSE). The upstream `pr` skill credits Dex Horthy / Humanlayer; it contributes only a workflow entry here.

Initial version: six bounded checks, pass/fail/trap fixtures and a complete engineering-skill review. Revisit the pinned source, scope and fixtures before publishing a changed pack version.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **practice**. Version: `1.1.0`. 7 distinct check IDs.

Methodologies: `mattpocock/design` (preview), `mattpocock/diagnosis` (preview), `mattpocock/testing` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
