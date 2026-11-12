# nextjs

App Router pack for Next.js TypeScript projects. Source version **1.4.1**. Data-only rule pack: every check is a syntax pattern, no executable code.

## Stance

This pack targets the App Router. The Pages Router still supports `next/head`; raw anchors and `img` elements can be intentional. Next.js also documents a default fetch cache behavior. Rules that cannot distinguish a valid option from a mistake are off or advisory. Next.js 16 denials run only when the nearest `package.json` declares `next` entirely on 16 or newer, including 16 prereleases. Next.js 15, an older release, and a range that can still install 15 are not denied. Route-handler contracts, server/client boundaries, and middleware matchers still need stronger analysis and live in [BACKLOG.md](BACKLOG.md).

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `nextjs/NEXT-LINK-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `NEXT-HEAD-001` | Importing `next/head` from `app/` or `src/app/`, including runtime loaders. | The Pages Router API does not configure App Router metadata. | deny |
| `NEXT-IMG-001` | JSX `<img>` elements, self-closing and open-plus-close forms. A template string is not an element. | May skip image optimization. | warn |
| `NEXT-FONT-001` | JSX `<link>` tags pointing at `fonts.googleapis.com`, literal and expression forms. A template string is not an element. | Remote font stylesheets undo self-hosting. | deny |
| `NEXT-CACHE-001` | `fetch(...)` with no `cache`, `revalidate`, or `next` key, only when Cache Components is off. | Both models allow a bare fetch. With `cacheComponents` the check does not run. | off |
| `NEXT-LINK-001` | `<a href="/internal">` anchors, literal and expression forms. `target="_blank"` and `download` are left alone. | A full reload may be intentional; consider `Link` for client-side transitions. | warn |
| `NEXT-DOC-001` | Importing `next/document` under `app/` or `src/app/`, including runtime loaders. | Pages Router document; inert under the App Router. | deny |
| `NEXT-ROUTE-001` | A proven imported Next Router or local imported `useRouter()` receiver pushes a `+`-built href. | Optional readability advice; Next accepts string hrefs and concatenation is not a universal production defect. | warn |
| `NEXT-REVAL-001` | An exported `revalidate` on a page, layout, or route when the root Next config sets `cacheComponents: true`. | That export errors under Cache Components. `false` remains the previous model's default and is not reported. | deny |
| `NEXT-CONFLICT-001` | `fetch` options containing both `cache: 'no-store'` and a positive `next.revalidate`. | Next.js ignores both conflicting cache settings. | deny |
| `NEXT-NAV-001` | A value import, re-export or runtime load of `next/router` under `app/` or `src/app/`. Type-only imports pass. | The Pages Router hook throws "NextRouter was not mounted" in the App Router. | deny |
| `NEXT-DIRECTIVE-001` | `'use client'`/`'use server'` after other code, `'use client'` inside a function, `'use server'` after a statement in a function body, or either in backticks. | A misplaced directive is an ordinary string; the boundary silently does not exist. | deny |
| `NEXT-META-001` | Exported `metadata` or `generateMetadata` (including `export { x as metadata }`) from a page or layout whose leading directive is `'use client'`. | Metadata exports are only supported in Server Components. | deny |
| `NEXT-ASYNC-001` | A member read directly on `cookies()`, `headers()` or `draftMode()` imported from `next/headers`, aliases included. | These APIs return Promises. Warning below Next.js 16; denial when `next` is entirely 16 or newer. | warn, deny on Next >= 16 |
| `NEXT-PARAMS-001` | Synchronous `params` or `searchParams`. A local of that name in the same block, including `await`, `useParams`, or `useSearchParams`, is left alone. | Next.js 16 makes both props Promises. Does not run below 16. | deny on Next >= 16 |
| `NEXT-SEGMENT-001` | Synchronous `params`. A local of that name in the same block, including `URLSearchParams`, is left alone. | The same Promise change. `generateImageMetadata` stays synchronous. Does not run below 16. | deny on Next >= 16 |
| `NEXT-SITEMAP-001` | A sitemap `id` used in arithmetic without `await`. | Next.js 16 passes `id` as a Promise. Does not run below 16. | deny on Next >= 16 |
| `NEXT-IMAGE-001` | An image `id` stored or read without `await` or `use()`. | `opengraph-image`, `twitter-image`, `icon`, and `apple-icon` receive `id` as a Promise. Does not run below 16. | deny on Next >= 16 |
| `NEXT-REVALTAG-001` | `revalidateTag` from `next/cache` with fewer than two arguments. | Next.js 16 requires a cacheLife profile or `{ expire }`. The one-argument form is a TypeScript error. Does not run below 16. | deny on Next >= 16 |
| `NEXT-PROXY-001` | A named `middleware` export in `proxy.ts`. | Proxy calls `proxy` or the default export. Does not run below 16. | deny on Next >= 16 |
| `NEXT-PROXY-002` | `middleware.ts` with `export const config = { runtime: "nodejs" }`. | That Node.js file is the deprecated filename; proxy owns Node. Edge middleware, the default, stays. Does not run below 16. | warn on Next >= 16 |
| `NEXT-SERVER-EXPORT-001` | Route segment exports from a `'use client'` page, layout, or route. With `cacheComponents: true`, also `dynamic`, `dynamicParams`, `fetchCache`, and `runtime` on the server, including `runtime = "nodejs"`. | Client Components cannot export them. Those four are removed or unsupported when Cache Components is on. | deny |

## Methodologies

- `nextjs/routing` — NEXT-LINK-001, NEXT-DOC-001, NEXT-ROUTE-001, NEXT-REVAL-001, NEXT-NAV-001, NEXT-SERVER-EXPORT-001, NEXT-PROXY-001, NEXT-PROXY-002
- `nextjs/rendering` — NEXT-HEAD-001, NEXT-IMG-001, NEXT-FONT-001, NEXT-CACHE-001, NEXT-CONFLICT-001, NEXT-DIRECTIVE-001, NEXT-META-001, NEXT-ASYNC-001, NEXT-PARAMS-001, NEXT-SEGMENT-001, NEXT-SITEMAP-001, NEXT-IMAGE-001, NEXT-REVALTAG-001

## Fixture coverage and limits

`pregate rules test packs/nextjs` runs **151** real fixtures. Every check has two passing and two failing cases plus a failing trap with exact lines. Regression cases preserve next/headers, exported module-name notes, import options, CMS HTML strings and unrelated attribute text; an arrow-rendered internal anchor still reports. External anchors, `next/image`, icon and local stylesheet links, explicit cache options, template-literal pushes, and numeric `revalidate` values remain pass guards. Next.js 16 fixtures also keep awaited props, `{ expire }` and a cacheLife profile, Edge middleware, a default export named `middleware`, and synchronous `params` inside `generateImageMetadata`. Cache Components fixtures cover a literal `cacheComponents: true` in the root Next config and the previous model without it.

Fixtures only prove the sample syntax. The [fetch reference](https://nextjs.org/docs/app/api-reference/functions/fetch) documents default `auto no cache`. With [Cache Components](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents), fetch stays uncached unless it runs inside `use cache`. NEXT-LINK-001 now identifies actual anchor/attribute structure anywhere in JSX and remains advisory because navigation intent is unknown. Other JSX rules still have their documented expression limits. Open cross-file questions are catalogued in [BACKLOG.md](BACKLOG.md).

The router rule preserves array `push`, arbitrary injected methods, non-Next
hooks and locally shadowed imported bindings. It admits imported hook aliases,
direct hook receivers and same-block initialized router bindings. Cross-scope
receiver ownership is not inferred. Routing safety needs a validated project
contract, not a string-format preference. Repo recommendations use Next-owning
package scopes; other workspace packages do not acquire Next rules solely from
a sibling dependency. Explicit user-authored scope still wins.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.4.1`. 21 distinct check IDs.

Methodologies: `nextjs/rendering` (complete), `nextjs/routing` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
