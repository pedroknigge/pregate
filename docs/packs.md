# Packs, categories and presets

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Source inventory for engine `0.0.3`. Check [release notes](releases/0.0.1.md) and `pack list --library` on the installed engine before adoption.

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

47 optional packs; 1082 distinct check IDs. Counts do not measure semantic coverage or precision.

| Checker family | Checks | Evidence needed for enforcement |
| --- | ---: | --- |
| Project fitness obligations | 577 | Reviewed current project assertions; unbound means UNVERIFIED |
| Static pattern, import and change checks | 488 | Precise applicability, valid alternatives and passing/failing/trap controls |
| Metrics | 17 | A measured project budget; a threshold is not a universal invariant |

These are implementation counts, not a certified enforce-ready total. Prefer stable conditions to prescribed mechanisms; keep contextual policies optional and heuristics advisory until admitted. See [invariant enforcement criteria](guides/invariant-enforcement.md).

| Pack | Category | Version | Checks | Methodologies and manifest status |
| --- | --- | --- | ---: | --- |
| [agent-practices](../packs/agent-practices/REFERENCE.md) | practice | 1.0.0 | 22 | `agent-practices/behavior-testing` (preview), `agent-practices/domain-ownership` (preview), `agent-practices/launch-safety` (preview), `agent-practices/security-review` (preview) |
| [angular](../packs/angular/REFERENCE.md) | library | 1.2.0 | 11 | `angular/components` (complete), `angular/rxjs` (complete) |
| [architecture](../packs/architecture/REFERENCE.md) | pattern | 1.3.0 | 21 | `architecture/anti-corruption` (complete), `architecture/clean-architecture` (complete), `architecture/cqrs` (complete), `architecture/dependency-rule` (complete), `architecture/functional-core-imperative-shell` (preview), `architecture/hexagonal` (complete), `architecture/layered` (complete), `architecture/modular-monolith` (complete), `architecture/repository` (complete), `architecture/vertical-slice` (complete) |
| [astro](../packs/astro/REFERENCE.md) | library | 1.0.0 | 7 | `astro/config` (complete), `astro/content` (complete), `astro/routing` (complete) |
| [authjs](../packs/authjs/REFERENCE.md) | library | 1.2.0 | 12 | `authjs/config` (complete), `authjs/session` (complete) |
| [clean-code](../packs/clean-code/REFERENCE.md) | practice | 1.2.0 | 5 | `clean-code/clean-code` (complete) |
| [consumer-saas](../packs/consumer-saas/REFERENCE.md) | invariants | 1.0.0 | 39 | `consumer-saas/readiness` (preview) |
| [dcouplr](../packs/dcouplr/REFERENCE.md) | library | 1.27.1 | 82 | `dcouplr/delivery` (preview), `dcouplr/events` (preview), `dcouplr/factories` (preview), `dcouplr/factory-runtime` (preview), `dcouplr/logging` (preview), `dcouplr/managed-components` (preview), `dcouplr/messages` (preview), `dcouplr/observability` (preview), `dcouplr/queue-runtime` (preview), `dcouplr/queues` (preview), `dcouplr/runtime` (preview), `dcouplr/saga-runtime` (preview), `dcouplr/sagas` (preview), `dcouplr/utility-runtime` (preview) |
| [ddd](../packs/ddd/REFERENCE.md) | pattern | 1.1.0 | 3 | `ddd/ddd-tactical` (complete) |
| [design-invariants](../packs/design-invariants/REFERENCE.md) | invariants | 1.0.0 | 48 | `design-invariants/architecture` (preview), `design-invariants/code-quality` (preview), `design-invariants/design-principles` (preview), `design-invariants/domain-state` (preview), `design-invariants/error-handling` (preview), `design-invariants/package-principles` (preview), `design-invariants/performance-and-data` (preview), `design-invariants/process` (preview), `design-invariants/security` (preview), `design-invariants/testing` (preview) |
| [drizzle](../packs/drizzle/REFERENCE.md) | library | 1.3.0 | 12 | `drizzle/queries` (complete), `drizzle/schema` (complete) |
| [enterprise-ready](../packs/enterprise-ready/REFERENCE.md) | invariants | 1.0.0 | 57 | `enterprise-ready/readiness` (preview) |
| [express](../packs/express/REFERENCE.md) | library | 1.2.0 | 12 | `express/middleware` (complete), `express/requests` (complete) |
| [firebase](../packs/firebase/REFERENCE.md) | library | 1.2.0 | 11 | `firebase/auth` (complete), `firebase/firestore` (complete) |
| [go](../packs/go/REFERENCE.md) | language | 1.2.0 | 10 | `go/architecture` (complete), `go/effects` (complete), `go/quality` (complete) |
| [javascript](../packs/javascript/REFERENCE.md) | language | 1.2.1 | 19 | `javascript/esm` (complete), `javascript/legacy` (complete), `javascript/safety` (complete) |
| [maintainability](../packs/maintainability/REFERENCE.md) | practice | 1.2.0 | 209 | `maintainability/engineering` (preview), `maintainability/future-humans` (preview), `maintainability/maintainability` (complete) |
| [mattpocock](../packs/mattpocock/REFERENCE.md) | practice | 1.1.1 | 7 | `mattpocock/design` (preview), `mattpocock/diagnosis` (preview), `mattpocock/testing` (preview) |
| [mongodb](../packs/mongodb/REFERENCE.md) | library | 1.2.0 | 10 | `mongodb/models` (complete), `mongodb/queries` (complete) |
| [musk](../packs/musk/REFERENCE.md) | process | 1.0.1 | 5 | `musk/algorithm` (complete) |
| [nestjs](../packs/nestjs/REFERENCE.md) | library | 1.2.0 | 11 | `nestjs/controllers` (complete), `nestjs/providers` (complete) |
| [next-website](../packs/next-website/REFERENCE.md) | library | 1.0.0 | 54 | `next-website/readiness` (preview) |
| [nextjs](../packs/nextjs/REFERENCE.md) | library | 1.4.0 | 21 | `nextjs/rendering` (complete), `nextjs/routing` (complete) |
| [node](../packs/node/REFERENCE.md) | library | 1.3.0 | 19 | `node/internals` (complete), `node/runtime` (complete), `node/security` (complete) |
| [nuxt](../packs/nuxt/REFERENCE.md) | library | 1.2.0 | 12 | `nuxt/data` (complete), `nuxt/server` (complete) |
| [postgres](../packs/postgres/REFERENCE.md) | library | 1.2.0 | 11 | `postgres/client` (complete), `postgres/safety` (complete) |
| [prisma](../packs/prisma/REFERENCE.md) | library | 1.3.0 | 14 | `prisma/client` (complete), `prisma/writes` (complete) |
| [pstack](../packs/pstack/REFERENCE.md) | process | 1.1.1 | 97 | `pstack/boundaries` (complete), `pstack/effects` (complete), `pstack/operations` (preview), `pstack/playbooks` (preview), `pstack/principles` (preview), `pstack/proof` (complete), `pstack/reader-load` (complete), `pstack/workspace` (preview) |
| [python](../packs/python/REFERENCE.md) | language | 1.3.0 | 24 | `python/architecture` (complete), `python/effects` (complete), `python/legacy` (complete), `python/quality` (complete) |
| [react](../packs/react/REFERENCE.md) | library | 1.2.0 | 14 | `react/components` (complete), `react/hooks` (complete) |
| [react-native](../packs/react-native/REFERENCE.md) | library | 1.2.0 | 10 | `react-native/platform` (complete), `react-native/security` (complete) |
| [redis](../packs/redis/REFERENCE.md) | library | 1.2.0 | 11 | `redis/client` (complete), `redis/keys` (complete) |
| [rust](../packs/rust/REFERENCE.md) | language | 1.2.0 | 9 | `rust/architecture` (complete), `rust/quality` (complete) |
| [security-audit](../packs/security-audit/REFERENCE.md) | practice | 1.0.0 | 18 | `security-audit/client-and-agents` (preview), `security-audit/obvious-sinks` (preview) |
| [senior](../packs/senior/REFERENCE.md) | practice | 1.2.0 | 12 | `senior/fowler` (complete), `senior/style` (complete) |
| [solana](../packs/solana/REFERENCE.md) | library | 1.2.0 | 12 | `solana/key-custody` (complete), `solana/kit-client` (complete), `solana/pda-safety` (complete), `solana/rpc-env` (complete), `solana/tx-safety` (complete) |
| [supabase](../packs/supabase/REFERENCE.md) | library | 1.2.0 | 10 | `supabase/client` (complete), `supabase/storage` (complete) |
| [svelte](../packs/svelte/REFERENCE.md) | library | 1.2.0 | 13 | `svelte/runes` (complete), `svelte/stores` (complete) |
| [sveltekit](../packs/sveltekit/REFERENCE.md) | library | 1.2.0 | 12 | `sveltekit/data` (complete), `sveltekit/routing` (complete) |
| [tailwind](../packs/tailwind/REFERENCE.md) | library | 1.2.0 | 9 | `tailwind/classes` (complete) |
| [tanstack-query](../packs/tanstack-query/REFERENCE.md) | library | 1.0.0 | 2 | `tanstack-query/client` (complete), `tanstack-query/keys` (complete) |
| [testing](../packs/testing/REFERENCE.md) | practice | 1.2.1 | 4 | `testing/tdd` (complete) |
| [trpc](../packs/trpc/REFERENCE.md) | library | 1.2.0 | 12 | `trpc/client` (complete), `trpc/router` (complete) |
| [typescript](../packs/typescript/REFERENCE.md) | language | 1.3.0 | 26 | `typescript/anti-evasion` (complete), `typescript/async-results` (complete), `typescript/discipline` (complete), `typescript/framework-entries` (complete), `typescript/legacy` (complete), `typescript/named-exports` (complete), `typescript/strict-types` (complete) |
| [vercel](../packs/vercel/REFERENCE.md) | library | 1.0.0 | 15 | `vercel/configuration` (preview), `vercel/cron` (preview), `vercel/environment` (preview), `vercel/functions` (preview), `vercel/protection` (preview), `vercel/recovery` (preview) |
| [vibe-proof](../packs/vibe-proof/REFERENCE.md) | practice | 1.1.0 | 17 | `vibe-proof/hygiene` (complete), `vibe-proof/secrets` (complete), `vibe-proof/transport` (complete) |
| [vue](../packs/vue/REFERENCE.md) | library | 1.2.0 | 11 | `vue/reactivity` (complete), `vue/sfc` (complete) |

## Builtin core

The current core has 2 methodologies and 68 distinct check IDs: 64 language-independent project fitness requirements and 4 general change guards, all active by default. See [the complete core reference](core-catalog.md) and [verification setup](features/project-fitness.md). Clean Code, DDD, architecture, testing and TypeScript policies are optional packs.

## Preset recipes

`guide` starts new projects in advisor mode (the agent sees findings; nothing blocks); `--enforcement enforce` blocks and `--enforcement shadow` observes silently. Existing projects keep their recorded mode. Legacy `init` starts optional rules in shadow, including an explicitly selected recipe. All 68 core requirements enforce by default. Use `fitness plan` to group missing evidence and `fitness bind <id[,id]> ... --preview` for requirements genuinely covered by one assertion. Unbound requirements stay active and unverified without blocking work, while adopted assertions require current passing evidence. Review effective scope and policy after approval.

| Recipe | Recipe enforcement | Methodologies |
| --- | --- | --- |
| [backend-clean-ddd](../catalog/presets/backend-clean-ddd.json) | enforce | `clean-code/clean-code`, `architecture/clean-architecture`, `ddd/ddd-tactical`, `testing/tdd`, `core/pregate-integrity`, `typescript/anti-evasion` |
| [functional-ts](../catalog/presets/functional-ts.json) | enforce | `clean-code/clean-code`, `architecture/functional-core-imperative-shell`, `testing/tdd`, `core/pregate-integrity`, `typescript/anti-evasion` |
| [legacy-safe](../catalog/presets/legacy-safe.json) | enforce | `clean-code/clean-code`, `testing/tdd`, `core/pregate-integrity`, `typescript/anti-evasion` |
| [framework-app](../packs/presets/framework-app.json) | enforce | `core/pregate-integrity`, `typescript/strict-types`, `typescript/named-exports`, `typescript/framework-entries`, `typescript/anti-evasion` |
| [go-starter](../packs/presets/go-starter.json) | shadow | `go/quality` |
| [hexagonal-backend](../packs/presets/hexagonal-backend.json) | enforce | `architecture/clean-architecture`, `ddd/ddd-tactical`, `clean-code/clean-code`, `testing/tdd`, `core/pregate-integrity`, `architecture/hexagonal`, `architecture/cqrs`, `architecture/vertical-slice`, `architecture/modular-monolith`, `architecture/dependency-rule`, `architecture/anti-corruption`, `architecture/repository`, `architecture/layered`, `typescript/strict-types`, `typescript/async-results`, `typescript/named-exports`, `typescript/anti-evasion` |
| [human-maintainability](../packs/presets/human-maintainability.json) | enforce | `clean-code/clean-code`, `core/pregate-integrity`, `maintainability/maintainability`, `typescript/anti-evasion` |
| [mixed-starter](../packs/presets/mixed-starter.json) | shadow | `clean-code/clean-code`, `python/quality`, `go/quality`, `rust/quality`, `typescript/anti-evasion` |
| [musk-algorithm](../packs/presets/musk-algorithm.json) | enforce | `clean-code/clean-code`, `core/pregate-integrity`, `musk/algorithm`, `typescript/anti-evasion` |
| [nextjs-fullstack](../packs/presets/nextjs-fullstack.json) | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/async-results`, `typescript/discipline`, `typescript/named-exports`, `typescript/framework-entries`, `nextjs/routing`, `nextjs/rendering`, `prisma/client`, `prisma/writes`, `authjs/config`, `authjs/session`, `typescript/anti-evasion` |
| [node-api](../packs/presets/node-api.json) | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/async-results`, `typescript/discipline`, `typescript/named-exports`, `node/runtime`, `node/security`, `express/middleware`, `express/requests`, `postgres/client`, `postgres/safety`, `typescript/anti-evasion` |
| [observe-only](../packs/presets/observe-only.json) | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/async-results`, `typescript/named-exports`, `typescript/anti-evasion` |
| [pstack-way](../packs/presets/pstack-way.json) | enforce | `testing/tdd`, `core/pregate-integrity`, `pstack/boundaries`, `pstack/reader-load`, `pstack/proof`, `pstack/effects`, `typescript/strict-types`, `typescript/async-results`, `typescript/named-exports`, `typescript/anti-evasion` |
| [python-starter](../packs/presets/python-starter.json) | shadow | `python/quality` |
| [react-spa](../packs/presets/react-spa.json) | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/discipline`, `typescript/named-exports`, `react/hooks`, `react/components`, `tailwind/classes`, `typescript/anti-evasion` |
| [rust-starter](../packs/presets/rust-starter.json) | shadow | `rust/quality` |
| [senior-typescript-strict](../packs/presets/senior-typescript-strict.json) | enforce | `clean-code/clean-code`, `testing/tdd`, `core/pregate-integrity`, `typescript/strict-types`, `typescript/async-results`, `typescript/named-exports`, `senior/fowler`, `senior/style`, `typescript/anti-evasion` |
| [solana-hackathon](../packs/presets/solana-hackathon.json) | enforce | `core/pregate-integrity`, `solana/kit-client`, `solana/rpc-env`, `solana/tx-safety`, `solana/key-custody`, `typescript/anti-evasion` |
| [vibe-proof-production](../packs/presets/vibe-proof-production.json) | enforce | `clean-code/clean-code`, `core/pregate-integrity`, `vibe-proof/secrets`, `vibe-proof/transport`, `vibe-proof/hygiene`, `typescript/anti-evasion` |
| [vue-spa](../packs/presets/vue-spa.json) | shadow | `core/pregate-integrity`, `typescript/strict-types`, `typescript/discipline`, `typescript/named-exports`, `vue/sfc`, `vue/reactivity`, `tailwind/classes`, `typescript/anti-evasion` |
