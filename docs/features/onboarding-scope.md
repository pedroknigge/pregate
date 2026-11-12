# Review the actual source scope

Initial onboarding adapts the selected recipe to the source
roots found in the repository. A root-layout Next.js project must not inherit
only `src/**`, `lib/**` and `test/**`. Detected `app`, `components`, `tests`,
`scripts`, `e2e`, workspace packages and root source files enter the proposal.
The recipe's existing exclusions remain. The human reviews the scope together
with policy before activation.

`init --preview` reports how many inventoried parser-supported source files lie inside the
candidate scope and samples any gaps/exclusions. Git inventory includes tracked
and unignored files; standalone directories use the existing traversal exclusions.
This denominator does not include every asset, unsupported source language or
dependency on the machine. A file in scope can still have no applicable optional
rule. Scope coverage, rule coverage and verified behavior are different facts.

Coverage also reports `sourceLikeInventoried`, unsupported source-like
paths and advisory role groups: production candidates, tests, examples, fixtures
and vendor/generated conventions. Unsupported `.astro`, `.vue`, `.svelte` and other
source-like files remain visible even though their bodies have no parser analysis.
`.astro` is inventoried and is not parsed.
Each role reports parser-supported, in-scope, outside-scope, excluded and unsupported
counts. Role labels come from path conventions; they do not exclude files or
certify that a file is production code. A monorepo cannot claim whole-project
coverage from a parser-supported numerator while concealing unsupported bodies.

`guide --json` and `scan --json` also show coverage before
initial setup. `coverageState: "proposed"` means counts use the default recipe's
scope plus detected source roots; recipe exclusions remain. No contract or
consent is created by inspection. A schema-valid existing preset reports
`"current"`; an invalid preset reports `"unavailable"` instead of inventing its
scope. The initial guide preview reports its exact candidate scope and
installation readiness before human approval. Missing harness registrations
remain degraded protection even if a valid contract is approved.

Existing projects are left unchanged by repeated init. Inspect them with:

```sh
pregate scan --json
pregate scan --plan
```

The JSON result adds `coverage`: inventoried parser-supported source count, in-scope count,
paths outside the include patterns and paths explicitly excluded. When include
patterns miss detected roots, the advisory plan adds a `scope` proposal. It
preserves exclusions rather than silently overriding a team's decision. No
contract or consent changes during scan. A malformed preset cannot supply a
trusted scope; diagnose and repair it before adoption.

Save and review the plan, remove optional pack suggestions you do not want, then
prepare one review:

```sh
pregate pack apply plan.json --preview
```

The plan contains `sources`, `methodologies`, an optional `scope` with the
normal preset scope format, and optional rule `overrides` for package applicability.
Scope-only plans can have empty sources/methodologies;
empty plans without a scope remain rejected. Invalid scope or any invalid pack
prevents activation of the whole candidate. The original contract and all core
rules remain intact until human approval of its exact digest. After approval,
scan again, audit, and commit the preset and lock.

Framework recommendations follow the package manifests that declare the relevant
dependency. Dependencies and peer dependencies count. A devDependency counts for
`vue` and `react`, and a test runner named there suggests testing. Other
devDependencies do not. A Next-owning workspace gets Next
rules; a sibling non-Next package does not inherit them. Nested manifests with
unrelated ownership are excluded from that recommendation. The generated rule
parameter `within` intersects the check's own file patterns, existing paths and
exclusions. It never broadens a TypeScript annotation rule into JS/MJS.
Existing user-authored rule paths, exclusions or `within` are preserved.
Exact `vue` declarations in dependencies, devDependencies, and peer dependencies
recommend Vue methodologies in their owning package. A `.vue` file also recommends
Vue; that file does not add a package owner. This does not add a Vue SFC parser;
`.vue` bodies remain visibly unsupported. A similarly named dependency does
not count as a declaration of Vue. A `.vue` file or `vue` declaration that appears
only under a docs site, examples tree, fixtures tree, or website folder does not
recommend Vue. The same evidence in primary source still does.

Exact `react` declarations in dependencies, devDependencies, and peer dependencies
recommend React methodologies in their owning package. A similarly named dependency
does not count. A declaration that appears only under a docs site, examples tree,
fixtures tree, or website folder does not recommend React.

Exact `svelte` declarations and `@sveltejs/*` dependencies, including peer
dependencies, recommend the Svelte methodologies in their owning package.
A devDependency does not.
A package named `svelte` does too, because that package is Svelte and does not
depend on `svelte`. A `.svelte` file or `svelte.config.*` also recommends
Svelte; those files do not add a package owner. A similarly named dependency
does not count as a declaration of Svelte. A `.svelte` file, `svelte.config.*`,
or Svelte dependency that appears only under a docs site, examples tree,
fixtures tree, or website folder does not recommend Svelte. The same evidence in primary source still does.

Exact `astro` dependencies and peer dependencies recommend the Astro
methodologies in their owning package. A devDependency does not. `astro.config.*`
and `.astro` files do not either: the engine does not parse `.astro` templates.
An `astro` dependency that appears only under `docs/`, `examples/`, or `fixtures/`
does not recommend Astro. The same dependency in primary source still does.

Exact `@tanstack/react-query`, `@tanstack/vue-query`, `@tanstack/solid-query`,
`@tanstack/svelte-query`, `@tanstack/angular-query`, and
`@tanstack/angular-query-experimental` dependencies and peer dependencies
recommend the TanStack Query methodologies in their owning package. A
devDependency does not. `@tanstack/query-core` and the devtools packages do
not, on their own. A declaration that appears only under a docs site, examples
tree, fixture tree, or website folder does not recommend TanStack Query. The
same dependency in primary source still does.

An exact `hono` dependency or peer dependency recommends `hono/routing` and
`hono/middleware` in the package that declares it. A devDependency does not.
A declaration that appears only under `docs/`, `examples/`, or `fixtures/`
does not recommend Hono. The same dependency in the app still does.

When nested related and unrelated owners cannot be represented by one include/
exclude policy, scan reports `scopeProblems` and `guide --json` includes that
error and exits non-zero. Choose an explicit reviewed scope, or leave the pack
out of this review with `guide --preview --packs <ns,ns>` (omit the blocked
pack; `--packs none` adds no optional packs). Test apps and fixtures under
`packages/<name>/test/` stay inside the owning package. A nested manifest there
does not split that package into an unrepresentable scope, and the pack is not
dropped. A nested owner outside that test tree still needs an explicit scope.
Dependency ownership is applicability evidence, not proof that the project
complies. Review unknown architecture and managed dcouplr boundaries using
actual project facts.

The [guided workflow](guided-project-workflow.md) can combine the selected packs,
local custom pack and detected scope into one initial proposal. For an existing
project, it prepares recovery/update/configuration and preserves the project's
existing consent unless activation is explicitly chosen. Redirected or agent
calls use structured preview and human digest approval instead of an unattended
prompt. These are the same contract and fixture checks as the direct commands.

This adapts known roots, not every directory that may appear later. Scan after
adding a new top-level workspace or moving source. Deliberately excluded folders
remain excluded and require an explicit reviewed decision to add them. Parser
support is unchanged. Layer ownership and dependency directions still need
project-specific declarations; a detected folder is not an inferred architecture.
The guide review shows what a derived map finds in the code today. A new project
can replace that map with `pregate guide --preview --layers <map.json>`, and
`pregate layers apply <map.json> --preview` stages a map once a contract exists.
A new project that already has `ark.config.json` imports that config in the first
review instead of a hand-written map.
See [layers with evidence](agent-proposed-contract.md#layers-with-evidence).

An informational `UNVERIFIED` Stop notice does not prevent editing. The engine
records it once per session unless the coverage notice changes. A harness can
display that message alongside other Stop hooks. Acknowledge the coverage gap
once and continue; do not repeatedly ask the user whether to begin a reversible
scope preview. Adopt bounded semantic assertions when the project can supply
meaningful evidence and negative controls.
