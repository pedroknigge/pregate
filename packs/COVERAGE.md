# Coverage status

The pack count is not a documentation-coverage percentage. A fixture verifies
one positive or negative syntax example, not every use of a framework API.
The engine now parses TS/JS, Python, Go and Rust. The 23 framework packs added here
still inspect TS/JS client code only. The engine cannot inspect `.vue`,
`.svelte`, SQL, Firebase Rules, CSS or JSON configuration, type-checker facts,
or multi-file data flow.

Current pack/check/alias counts and default severities are generated below from
the manifests. Actual enforcement depends on selected methodologies, scope,
enforcement and overrides; syntax matches are not a documentation-coverage score.
The additional dcouplr pack is preview and does not close its runtime backlog.

The two normative Markdown catalogs contain 313 **nominal** entries: 100 FH,
100 SE, and 113 PS. [`invariant-coverage.json`](invariant-coverage.json)
records all 313 with source lines. The original syntax/workflow classification
has 56 partial syntax references, 167 former candidates and 90 process entries.
Every complete source clause now has an optional enforcing project-evidence
owner: 200 maintainability clauses and 86 pstack clauses, 286 obligations total.
The last 43 PS numbers share 16 authored clauses; each group has one rule whose
assertion must cover the whole clause. These are evidence requirements, not 286
universal semantic detectors. The inventory generator rejects missing IDs,
unknown syntax references and missing/incorrect evidence owners. See
[source-invariant adoption](../docs/guides/source-invariants.md).

The four new framework presets start in shadow while findings are calibrated;
builtin integrity remains enforced. Fixture verdicts test matcher behavior,
including optional heuristics, and do not certify every match as a defect.

| Documentation checked live | Verified consequence | Pack correction |
| --- | --- | --- |
| [Firebase Firestore writes](https://firebase.google.com/docs/firestore/manage-data/add-data) | `setDoc` can intentionally create or replace a document without merge. | `FB-WRITE-001` off; same-statement batch check `FB-BATCH-001` off. |
| [Next.js fetch](https://nextjs.org/docs/app/api-reference/functions/fetch) and [Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) | A fetch without cache options has a documented default in both models. `cache: 'no-store'` conflicts with a positive `next.revalidate` in the previous model. With `cacheComponents`, exporting `revalidate`, `dynamic`, `dynamicParams`, `fetchCache`, or `runtime` errors. | `NEXT-CACHE-001` stays off and does not run when the root Next config sets literal `cacheComponents: true`. `NEXT-REVAL-001` denies that `revalidate` export only then. `NEXT-SERVER-EXPORT-001` still denies client segment exports and, when the flag is on, those removed server exports. `NEXT-CONFLICT-001` denies the contradictory fetch options. |
| [tRPC procedures](https://trpc.io/docs/server/procedures) | The official example uses `publicProcedure.mutation`. | `TRPC-PROC-001` off; optional input/output/context policy bans also off. |
| [Vue API styles](https://vuejs.org/guide/introduction.html#api-styles) | Options API and Composition API are both supported. | `VUE-OPT-001` off. |
| [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files) | The scanner reads entire source files as text, including complete class literals in arrays and variables. | `TW-JOIN-001` and `TW-VAR-001` off; other style preferences advisory. |
| [node-postgres connections](https://node-postgres.com/features/connecting) | Both `Client` and `Pool` are documented connection choices. | `PG-POOL-001` off. |
| [Express parsers](https://expressjs.com/en/5x/api/express/#express.json) | Both parsers default to a 100kb cap. | `EX-LIMIT-001` off; no-limit claims corrected. |
| [React useState](https://react.dev/reference/react/useState#storing-information-from-previous-renders) | Guarded current-component updates during render can be valid; a `setX` name does not establish a setter binding. | `REACT-RENDER-001` off pending binding/control-flow analysis. |
| [Vue nextTick](https://vuejs.org/api/general.html#nexttick) | A callback is an alternative to awaiting the returned promise. | `VUE-TICK-001` warns on discarded zero-argument calls; callback pass fixtures added. DOM-use intent is not established. |
| [Prisma raw queries](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries#sql-injection-prevention) | `$queryRawUnsafe` with a constant SQL string and `$1` placeholders binds the extra arguments as parameters. | `PRISMA-RAW-001` reports only SQL built at runtime; constant-string pass fixture added. |
| [Prisma relation queries](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries) | `include: { posts: true }` is the documented way to load a relation. | `PRISMA-SELECT-001` warns instead of denying. |
| [Vue reactive](https://vuejs.org/guide/essentials/reactivity-fundamentals.html#limitations-of-reactive), [Pinia stores](https://pinia.vuejs.org/core-concepts/#destructuring-from-a-store) | Nested proxies retain reactivity; bound actions may be destructured directly. | `VUE-DEST-001` and `VUE-PINIA-001` off until value types/bindings are available. |

The remainder of the rules have executable fixtures, but have **not** been
systematically compared against all current official documentation pages,
versions, and realistic counterexamples. In particular, there is no honest
claim of 100% coverage for TypeScript, JavaScript, Node.js, React, Next.js,
Express, NestJS, tRPC, Angular, Vue, Nuxt, Svelte, SvelteKit, React Native,
Prisma, Drizzle, Tailwind CSS, Auth.js, PostgreSQL, MongoDB, Redis, Supabase,
or Firebase.

Before promoting an `off` or advisory rule to `deny`, establish what the
documentation actually requires, add a **passing counterexample for every
supported use** the matcher might flag, and prove the resulting preset compiles.
If a rule requires a grammar or cross-file capability the engine lacks, record
it in that pack's `BACKLOG.md` until the capability exists.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Current manifest inventory

48 packs, 1087 distinct checks and 1090 aliases.

| Default severity | Aliases |
| --- | ---: |
| deny | 947 |
| ask | 5 |
| warn | 111 |
| off | 27 |

These are declarations, not effective project policy or verification of complete semantic requirements. [All defaults, scope, phases and rule limits](../docs/packs.md).
<!-- END generated reference -->
