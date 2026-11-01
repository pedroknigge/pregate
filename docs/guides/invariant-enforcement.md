# Design rules for reliable enforcement

Prefer rules that preserve a product condition when implementation details change.
State the condition, its applicability, its exceptions and the evidence that can
establish it. Do not turn a preferred implementation into a universal requirement.
The language-independent core owns general obligations; language, pattern,
library and practice packs remain optional.

## Separate the condition from its implementation

| Condition | Possible evidence | What is insufficient |
| --- | --- | --- |
| A tenant cannot access another tenant's records | Project assertions with two tenants, valid access and cross-tenant rejection | A function named `authorize` |
| An admitted domain value remains valid through every supported transition | Constructor/transition assertions, caller-mutation controls and invalid inputs | An immutable-looking type declaration |
| A request has a bounded resource cost | Tested cardinality/latency budgets or a verified query contract | Finding `.limit(` anywhere in the statement |
| A public boundary never admits an implicit `any` | A reviewed compiler/type assertion over the actual boundary | Requiring annotations on every inner callback |
| An App Router module does not import the Pages Router head API | Exact literal module sources in the declared App Router paths | A substring that also matches `next/headers` |

Keep the public condition stable while allowing a measured replacement of the
mechanism. For example, a bounded aggregate or unique-key lookup can satisfy a
resource budget without pagination. Its project assertion must establish that
bound; a generic select/limit syntax policy does not prove it.

## Choose the appropriate contract

- **Product invariant:** a condition that must hold in its stated scope. Use
  an exact static check when the required facts are available; otherwise use a
  `fitness` requirement with reviewed, current project evidence.
- **Contextual policy:** an implementation or boundary restriction selected by
  the project. Explicit public annotations, a module import boundary or a
  pagination policy can enforce after their applicability is accepted. They are
  not universal correctness claims about the language or library.
- **Heuristic:** a proxy such as function length, identifier spelling or a text
  search over a statement. Keep it advisory/shadow until an observed project
  constraint justifies the bound and the checker covers its exceptions.

These are authoring decisions, not new schema fields. The inventory's checker
type does not automatically assign one of these contracts or certify precision.
A syntax rule with `deny` severity is still only as reliable as its scope and facts.

## Require evidence before blocking

Write the violating predicate in English: “When [applicability], [condition]
must hold, except [named exception].” Record source versions where applicability
depends on a library or runtime. Prefer behavioral statements to instructions
about which class, folder, helper name or algorithm to use.

Use AST roles, import resolution and the actual dependency/query chain instead of
text anywhere in a subtree. Bound traversal at function, argument and module
boundaries. Do not confuse a comment, CMS string, nested callback, unrelated
query or valid client directive with the code fact under review.

Apply a rule only where its required facts are available. TypeScript public
annotation policies exclude JS/MJS; Next/React recommendations follow the package
manifests that own those dependencies. The implicit static parameter `within`
intersects a pack's `files` restriction and its existing `paths` and `exclude`;
it cannot broaden a language-specific check. Explicit project-authored
paths/exclusions remain authoritative. A nested owner topology that cannot fit
one include/exclude contract requires scope review instead of guessed coverage.

For core integrity markers, use the shared comment contract.
Strings and documentation examples do not execute suppressions or mark supported
source as generated. Actual source comments still count; unsupported executable
source remains conservative. These controls establish their bounded cases, not
an empirical global accuracy score or a promotion threshold for every pack.

Every supported checker needs two passing, two failing and one failing trap
fixture at minimum. Add passing regressions for reported false positives, valid
inference and similar APIs; add traps where unrelated evidence must not satisfy
the condition. Preserve direct violations while fixing precision. Where it is
relevant, vary comments, whitespace, local names and equivalent supported forms.
Do not promise transformation coverage that was not tested.

For a semantic rule, a project verifier must test the condition and reject a
violating control. A green general test suite or a receipt fixture alone is not
proof. Pin verifier inputs and freshness where required. Unbound requirements
remain `UNVERIFIED`; adopted enforcing bindings reject missing, stale or failed
evidence. This lets more semantic rules enforce without inventing static proofs.

## Promote a reviewed set together

Run `scan` and a complete scoped `audit`; inspect analysis errors, excluded files,
skipped checks and fitness status. A zero-finding audit alone does not establish
checker precision. Validate the selected rules' fixtures and applicable project
assertions before preparing promotion.

Prepare one preset request for the whole admitted set, preserving existing
parameters, scope, exclusions and ratchet. Use an object override such as
`{ "enforcement": "enforce" }`, retaining the existing severity. Set `deny` only
when the reviewed condition is mandatory; `enforce` with `warn` remains advisory.
Several fitness bindings can enter that same reviewed preset request. Preview it
once and have the human approve its exact digest in the supported harness.

For brownfield code, `no-new` prevents additional findings; it does not mean the
whole codebase already satisfies an invariant. Keep existing debt visible in
audit and repair it toward an absolute passing condition. When a valid use case
conflicts with a rule, correct its applicability or supply a bounded alternative
assertion, then review the contract change. Do not recommend disabling PREGATE.

See [pack authoring](docs-to-rule-pack.md), [the conversion worksheet](rule-pack-worksheet.md),
[project fitness](../features/project-fitness.md) and
[source-invariant adoption](source-invariants.md). Updating the engine does not
approve a consumer's policy. The [guided project workflow](../features/guided-project-workflow.md)
can combine selected packs, updates and scope decisions in one digest-bound
review; a direct reviewed preset request can also combine admitted policies and
fitness bindings. Neither path grants the agent authority to approve its proposal.
