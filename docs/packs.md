# Packs, categories and presets

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Source inventory for engine `0.0.16`. Check [release notes](releases/0.0.1.md) and `pack list --library` on the installed engine before adoption.

## Categories

- `invariants`
- `language`
- `pattern`
- `library`
- `practice`
- `process`

Categories describe sources; they do not activate policy. `pack list --library --category <category>` filters bundled sources; omit `--library` to filter registered sources. A local source can omit category and is reported as unclassified. The builtin core is in the invariants category; the category list does not imply that every category already has an optional pack.

Discover, inspect and select:

```sh
pregate pack list --library --category language
pregate pack show --library typescript --json
pregate rules test --library typescript
pregate pack add --library typescript --preview
# Human reviews and approves the printed digest-bound command.
pregate pack enable typescript/strict-types --only TS-SWITCH-001 --preview
```

For one combined selection, use `guide --preview --packs <ns,ns>` or an edited `scan --plan` with `pack apply <plan.json> --preview`. Individual `pack add` and `pack enable` operations remain available. Defaults and manifests are listed below; effective parameters, scope and overrides come from `preset show`/`explain`. `deny` blocks under enforcing policy, `ask` requests permission where supported, `warn` reports, and `off` is inactive. Ordinary shadow findings are recorded. Core rules enforce unless explicitly disabled through reviewed overrides. Pack checks have documented static or project-evidence limits, not proof of complete framework compliance.

## Bundled library inventory

48 optional packs; 1132 distinct check IDs. Counts do not measure semantic coverage or precision.

| Checker family | Checks | Evidence needed for enforcement |
| --- | ---: | --- |
| Project fitness obligations | 581 | Reviewed current project assertions; unbound means UNVERIFIED |
| Static pattern, import and change checks | 531 | Precise applicability, valid alternatives and passing/failing/trap controls |
| Metrics | 20 | A measured project budget; a threshold is not a universal invariant |

These are implementation counts, not a certified enforce-ready total. Prefer stable conditions to prescribed mechanisms; keep contextual policies optional and heuristics advisory until admitted. See [invariant enforcement criteria](guides/invariant-enforcement.md).

| Pack | Category | Version | Checks | Methodologies and manifest status |
| --- | --- | --- | ---: | --- |
| [agent-practices](../packs/agent-practices/REFERENCE.md) | practice | 1.0.0 | 22 | `agent-practices/behavior-testing` (preview), `agent-practices/domain-ownership` (preview), `agent-practices/launch-safety` (preview), `agent-practices/security-review` (preview) |
| [angular](../packs/angular/REFERENCE.md) | library | 1.2.0 | 11 | `angular/components` (preview), `angular/rxjs` (preview) |
| [architecture](../packs/architecture/REFERENCE.md) | pattern | 1.4.1 | 25 | `architecture/anti-corruption` (complete), `architecture/clean-architecture` (complete), `architecture/cqrs` (complete), `architecture/dependency-rule` (complete), `architecture/functional-core-imperative-shell` (preview), `architecture/hexagonal` (complete), `architecture/layered` (complete), `architecture/modular-monolith` (complete), `architecture/repository` (complete), `architecture/structure` (complete), `architecture/vertical-slice` (complete) |
| [astro](../packs/astro/REFERENCE.md) | library | 1.0.0 | 7 | `astro/config` (preview), `astro/content` (preview), `astro/routing` (preview) |
| [authjs](../packs/authjs/REFERENCE.md) | library | 1.2.1 | 12 | `authjs/config` (preview), `authjs/session` (preview) |
| [clean-code](../packs/clean-code/REFERENCE.md) | practice | 1.2.0 | 5 | `clean-code/clean-code` (complete) |
| [consumer-saas](../packs/consumer-saas/REFERENCE.md) | invariants | 1.0.0 | 39 | `consumer-saas/readiness` (preview) |
| [dcouplr](../packs/dcouplr/REFERENCE.md) | library | 1.27.1 | 82 | `dcouplr/delivery` (preview), `dcouplr/events` (preview), `dcouplr/factories` (preview), `dcouplr/factory-runtime` (preview), `dcouplr/logging` (preview), `dcouplr/managed-components` (preview), `dcouplr/messages` (preview), `dcouplr/observability` (preview), `dcouplr/queue-runtime` (preview), `dcouplr/queues` (preview), `dcouplr/runtime` (preview), `dcouplr/saga-runtime` (preview), `dcouplr/sagas` (preview), `dcouplr/utility-runtime` (preview) |
| [ddd](../packs/ddd/REFERENCE.md) | pattern | 1.1.0 | 3 | `ddd/ddd-tactical` (preview) |
| [design-invariants](../packs/design-invariants/REFERENCE.md) | invariants | 1.0.0 | 48 | `design-invariants/architecture` (preview), `design-invariants/code-quality` (preview), `design-invariants/design-principles` (preview), `design-invariants/domain-state` (preview), `design-invariants/error-handling` (preview), `design-invariants/package-principles` (preview), `design-invariants/performance-and-data` (preview), `design-invariants/process` (preview), `design-invariants/security` (preview), `design-invariants/testing` (preview) |
| [drizzle](../packs/drizzle/REFERENCE.md) | library | 1.3.1 | 12 | `drizzle/queries` (preview), `drizzle/schema` (preview) |
| [enterprise-ready](../packs/enterprise-ready/REFERENCE.md) | invariants | 1.0.0 | 57 | `enterprise-ready/readiness` (preview) |
| [express](../packs/express/REFERENCE.md) | library | 1.2.1 | 12 | `express/middleware` (preview), `express/requests` (preview) |
| [firebase](../packs/firebase/REFERENCE.md) | library | 1.2.0 | 11 | `firebase/auth` (preview), `firebase/firestore` (preview) |
| [go](../packs/go/REFERENCE.md) | language | 1.2.0 | 10 | `go/architecture` (complete), `go/effects` (complete), `go/quality` (complete) |
| [hono](../packs/hono/REFERENCE.md) | library | 1.0.0 | 4 | `hono/middleware` (preview), `hono/routing` (preview) |
| [javascript](../packs/javascript/REFERENCE.md) | language | 1.2.2 | 19 | `javascript/esm` (complete), `javascript/legacy` (complete), `javascript/safety` (complete) |
| [maintainability](../packs/maintainability/REFERENCE.md) | practice | 1.3.0 | 216 | `maintainability/engineering` (preview), `maintainability/future-humans` (preview), `maintainability/maintainability` (complete), `maintainability/proxies` (preview) |
| [mattpocock](../packs/mattpocock/REFERENCE.md) | practice | 1.1.1 | 7 | `mattpocock/design` (preview), `mattpocock/diagnosis` (preview), `mattpocock/testing` (preview) |
| [mongodb](../packs/mongodb/REFERENCE.md) | library | 1.3.1 | 12 | `mongodb/models` (preview), `mongodb/queries` (preview) |
| [musk](../packs/musk/REFERENCE.md) | process | 1.0.1 | 5 | `musk/algorithm` (complete) |
| [nestjs](../packs/nestjs/REFERENCE.md) | library | 1.3.0 | 13 | `nestjs/controllers` (preview), `nestjs/providers` (preview), `nestjs/transport` (preview) |
| [next-website](../packs/next-website/REFERENCE.md) | library | 1.0.0 | 54 | `next-website/readiness` (preview) |
| [nextjs](../packs/nextjs/REFERENCE.md) | library | 1.5.1 | 22 | `nextjs/rendering` (preview), `nextjs/routing` (preview) |
| [node](../packs/node/REFERENCE.md) | library | 1.5.0 | 32 | `node/internals` (complete), `node/operations` (preview), `node/runtime` (complete), `node/security` (complete) |
| [nuxt](../packs/nuxt/REFERENCE.md) | library | 1.3.0 | 15 | `nuxt/data` (preview), `nuxt/security` (preview), `nuxt/server` (preview) |
| [postgres](../packs/postgres/REFERENCE.md) | library | 1.2.0 | 11 | `postgres/client` (preview), `postgres/safety` (preview) |
| [prisma](../packs/prisma/REFERENCE.md) | library | 1.3.0 | 14 | `prisma/client` (preview), `prisma/writes` (preview) |
| [pstack](../packs/pstack/REFERENCE.md) | process | 1.2.1 | 97 | `pstack/boundaries` (preview), `pstack/effects` (preview), `pstack/operations` (preview), `pstack/playbooks` (preview), `pstack/principles` (preview), `pstack/proof` (preview), `pstack/reader-load` (preview), `pstack/workspace` (preview) |
| [python](../packs/python/REFERENCE.md) | language | 1.4.0 | 25 | `python/architecture` (preview), `python/effects` (preview), `python/legacy` (preview), `python/quality` (preview) |
| [react](../packs/react/REFERENCE.md) | library | 1.2.1 | 14 | `react/components` (preview), `react/hooks` (preview) |
| [react-native](../packs/react-native/REFERENCE.md) | library | 1.2.0 | 10 | `react-native/platform` (preview), `react-native/security` (preview) |
| [redis](../packs/redis/REFERENCE.md) | library | 1.2.1 | 11 | `redis/client` (preview), `redis/keys` (preview) |
| [rust](../packs/rust/REFERENCE.md) | language | 1.2.0 | 9 | `rust/architecture` (preview), `rust/quality` (preview) |
| [security-audit](../packs/security-audit/REFERENCE.md) | practice | 1.0.1 | 18 | `security-audit/client-and-agents` (preview), `security-audit/obvious-sinks` (preview) |
| [senior](../packs/senior/REFERENCE.md) | practice | 1.3.0 | 13 | `senior/fowler` (complete), `senior/style` (complete) |
| [solana](../packs/solana/REFERENCE.md) | library | 1.2.0 | 12 | `solana/key-custody` (preview), `solana/kit-client` (preview), `solana/pda-safety` (preview), `solana/rpc-env` (preview), `solana/tx-safety` (preview) |
| [supabase](../packs/supabase/REFERENCE.md) | library | 1.2.1 | 10 | `supabase/client` (preview), `supabase/storage` (preview) |
| [svelte](../packs/svelte/REFERENCE.md) | library | 1.2.0 | 13 | `svelte/runes` (preview), `svelte/stores` (preview) |
| [sveltekit](../packs/sveltekit/REFERENCE.md) | library | 1.2.0 | 12 | `sveltekit/data` (preview), `sveltekit/routing` (preview) |
| [tailwind](../packs/tailwind/REFERENCE.md) | library | 1.2.1 | 9 | `tailwind/classes` (preview) |
| [tanstack-query](../packs/tanstack-query/REFERENCE.md) | library | 1.0.0 | 2 | `tanstack-query/client` (preview), `tanstack-query/keys` (preview) |
| [testing](../packs/testing/REFERENCE.md) | practice | 1.2.2 | 4 | `testing/tdd` (preview) |
| [trpc](../packs/trpc/REFERENCE.md) | library | 1.3.0 | 13 | `trpc/client` (preview), `trpc/router` (preview) |
| [typescript](../packs/typescript/REFERENCE.md) | language | 1.4.0 | 37 | `typescript/anti-evasion` (preview), `typescript/async-results` (preview), `typescript/checked` (preview), `typescript/compiler` (preview), `typescript/discipline` (preview), `typescript/framework-entries` (preview), `typescript/legacy` (preview), `typescript/named-exports` (preview), `typescript/strict-types` (preview) |
| [vercel](../packs/vercel/REFERENCE.md) | library | 1.0.0 | 15 | `vercel/configuration` (preview), `vercel/cron` (preview), `vercel/environment` (preview), `vercel/functions` (preview), `vercel/protection` (preview), `vercel/recovery` (preview) |
| [vibe-proof](../packs/vibe-proof/REFERENCE.md) | practice | 1.1.0 | 17 | `vibe-proof/hygiene` (preview), `vibe-proof/secrets` (preview), `vibe-proof/transport` (preview) |
| [vue](../packs/vue/REFERENCE.md) | library | 1.2.1 | 11 | `vue/reactivity` (preview), `vue/sfc` (preview) |

## Builtin core

The current core has 2 methodologies and 68 distinct check IDs: 64 language-independent project fitness requirements and 4 general change guards, all active by default. See [the complete core reference](core-catalog.md) and [verification setup](features/project-fitness.md). Clean Code, DDD, architecture, testing and TypeScript policies are optional packs.

## Preset recipes

`init` and `guide --preset` accept only: `backend-clean-ddd`, `functional-ts`, `legacy-safe`, `integrity-only`, `python-starter`, `go-starter`, `rust-starter`, `mixed-starter`. Other JSON files are example contracts (copy or `preset apply`; see [preset recipes](../packs/presets/README.md)). `guide` starts new projects in advisor mode (the agent sees findings; nothing blocks); `--enforcement enforce` blocks and `--enforcement shadow` observes silently. Existing projects keep their recorded mode. Legacy `init` starts optional rules in shadow when a starter recipe is selected. All 68 core requirements are active by default; the heuristic requirements among them start advisory (`warn`), the rest enforce. Use `fitness plan` to group missing evidence and `fitness bind <id[,id]> ... --preview` for requirements genuinely covered by one assertion. Unbound requirements stay active and unverified without blocking work, while adopted assertions require current passing evidence. Review effective scope and policy after approval.

| Recipe | `init` / `guide --preset` | Recipe enforcement | Methodologies |
| --- | --- | --- | --- |
| [backend-clean-ddd](../catalog/presets/backend-clean-ddd.json) | yes | enforce | `clean-code/clean-code`, `architecture/clean-architecture`, `ddd/ddd-tactical`, `testing/tdd`, `core/pregate-integrity`, `typescript/anti-evasion` |
| [functional-ts](../catalog/presets/functional-ts.json) | yes | enforce | `clean-code/clean-code`, `architecture/functional-core-imperative-shell`, `testing/tdd`, `core/pregate-integrity`, `typescript/anti-evasion` |
| [legacy-safe](../catalog/presets/legacy-safe.json) | yes | enforce | `clean-code/clean-code`, `testing/tdd`, `core/pregate-integrity`, `typescript/anti-evasion` |
| [framework-app](../packs/presets/framework-app.json) | manual | enforce | `core/pregate-integrity`, `typescript/strict-types`, `typescript/named-exports`, `typescript/framework-entries`, `typescript/anti-evasion` |
| [go-starter](../packs/presets/go-starter.json) | yes | shadow | `go/quality` |
| [hexagonal-backend](../packs/presets/hexagonal-backend.json) | manual | enforce | `architecture/clean-architecture`, `ddd/ddd-tactical`, `clean-code/clean-code`, `testing/tdd`, `core/pregate-integrity`, `architecture/hexagonal`, `architecture/cqrs`, `architecture/vertical-slice`, `architecture/modular-monolith`, `architecture/dependency-rule`, `architecture/anti-corruption`, `architecture/repository`, `architecture/layered`, `typescript/strict-types`, `typescript/async-results`, `typescript/named-exports`, `typescript/anti-evasion` |
| [human-maintainability](../packs/presets/human-maintainability.json) | manual | enforce | `clean-code/clean-code`, `core/pregate-integrity`, `maintainability/maintainability`, `typescript/anti-evasion` |
| [mixed-starter](../packs/presets/mixed-starter.json) | yes | shadow | `clean-code/clean-code`, `python/quality`, `go/quality`, `rust/quality`, `typescript/anti-evasion` |
| [musk-algorithm](../packs/presets/musk-algorithm.json) | manual | enforce | `clean-code/clean-code`, `core/pregate-integrity`, `musk/algorithm`, `typescript/anti-evasion` |
| [nextjs-fullstack](../packs/presets/nextjs-fullstack.json) | manual | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/async-results`, `typescript/discipline`, `typescript/named-exports`, `typescript/framework-entries`, `nextjs/routing`, `nextjs/rendering`, `prisma/client`, `prisma/writes`, `authjs/config`, `authjs/session`, `typescript/anti-evasion` |
| [node-api](../packs/presets/node-api.json) | manual | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/async-results`, `typescript/discipline`, `typescript/named-exports`, `node/runtime`, `node/security`, `express/middleware`, `express/requests`, `postgres/client`, `postgres/safety`, `typescript/anti-evasion` |
| [observe-only](../packs/presets/observe-only.json) | manual | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/async-results`, `typescript/named-exports`, `typescript/anti-evasion` |
| [pstack-way](../packs/presets/pstack-way.json) | manual | enforce | `testing/tdd`, `core/pregate-integrity`, `pstack/boundaries`, `pstack/reader-load`, `pstack/proof`, `pstack/effects`, `typescript/strict-types`, `typescript/async-results`, `typescript/named-exports`, `typescript/anti-evasion` |
| [python-starter](../packs/presets/python-starter.json) | yes | shadow | `python/quality` |
| [react-spa](../packs/presets/react-spa.json) | manual | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/discipline`, `typescript/named-exports`, `react/hooks`, `react/components`, `tailwind/classes`, `typescript/anti-evasion` |
| [rust-starter](../packs/presets/rust-starter.json) | yes | shadow | `rust/quality` |
| [senior-typescript-strict](../packs/presets/senior-typescript-strict.json) | manual | enforce | `clean-code/clean-code`, `testing/tdd`, `core/pregate-integrity`, `typescript/strict-types`, `typescript/async-results`, `typescript/named-exports`, `senior/fowler`, `senior/style`, `typescript/anti-evasion` |
| [solana-hackathon](../packs/presets/solana-hackathon.json) | manual | enforce | `core/pregate-integrity`, `solana/kit-client`, `solana/rpc-env`, `solana/tx-safety`, `solana/key-custody`, `typescript/anti-evasion` |
| [vibe-proof-production](../packs/presets/vibe-proof-production.json) | manual | enforce | `clean-code/clean-code`, `core/pregate-integrity`, `vibe-proof/secrets`, `vibe-proof/transport`, `vibe-proof/hygiene`, `typescript/anti-evasion` |
| [vue-spa](../packs/presets/vue-spa.json) | manual | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/discipline`, `typescript/named-exports`, `vue/sfc`, `vue/reactivity`, `tailwind/classes`, `typescript/anti-evasion` |
