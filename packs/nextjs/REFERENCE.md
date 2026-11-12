# nextjs pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.4.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## nextjs/rendering

Manifest version: `1.3.1`. Status: **complete**.

### nextjs/NEXT-HEAD-001

Check: [`nextjs/rendering/no-next-head-import@1.0.1`](checks/rendering/no-next-head-import/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-next-head-import`. Minimum severity: `none`.

next/head belongs to the Pages Router and is valid there; in app/ files the metadata export owns the document head.

Default parameters: `{}`.

**Repair:** Export a metadata object from the page or layout. Keep next/head only in files that still run under the Pages Router.

**Scope and limits:** Only the exact next/head literal in an import/export source or first literal require/import argument is forbidden in app paths. next/headers, ordinary text and import option values are allowed. Computed specifiers and aliased runtime loaders are outside this syntax slice.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router migration guide",
  "locator": "next/head versus metadata API",
  "paraphrase": "The App Router declares head data with the metadata export. next/head is the Pages Router component and does not run under app."
}
```

### nextjs/NEXT-IMG-001

Check: [`nextjs/rendering/no-img-element@1.0.1`](checks/rendering/no-img-element/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-img-element`. Minimum severity: `none`.

A raw img skips resizing and lazy loading, shipping full-weight files and causing layout shift the Image component prevents.

Default parameters: `{}`.

**Repair:** Replace the element with Image from next/image and give it a width, height, or fill plus an alt description.

**Scope and limits:** The rule matches a JSX img element, including the open-plus-close form. Markup assembled as a string, including a template returned from a .ts helper, is not an element.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js image optimization docs",
  "locator": "next/image responsive sizing",
  "paraphrase": "Images go through the Image component so the framework can resize, lazy-load, and serve modern formats per viewport."
}
```

### nextjs/NEXT-FONT-001

Check: [`nextjs/rendering/no-google-font-link@1.0.1`](checks/rendering/no-google-font-link/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-google-font-link`. Minimum severity: `none`.

A googleapis link tag moves font loading back to a render-blocking remote request, undoing the self-hosting and shift guarantees.

Default parameters: `{}`.

**Repair:** Load the family with next/font and apply the generated class name or variable. Remove the link tag entirely.

**Scope and limits:** The rule matches a JSX link element whose text contains fonts.googleapis.com, including a preconnect to that host. A template string in a .ts helper is not a link element.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js font optimization docs",
  "locator": "next/font self-hosting",
  "paraphrase": "Fonts load through next/font so builds self-host the files. Remote stylesheet links reintroduce render-blocking requests and layout shift."
}
```

### nextjs/NEXT-CACHE-001

Check: [`nextjs/data/no-fetch-without-cache@1.1.0`](checks/data/no-fetch-without-cache/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-fetch-without-cache`. Minimum severity: `none`.

The default is valid in both models. The check stays off. It runs only when Cache Components is not enabled, so a bare fetch inside use cache is not reported as a missing fetch cache option.

Default parameters: `{}`.

**Repair:** In the previous model, pass cache or next.revalidate only when you want an explicit policy. With cacheComponents, cache the function with use cache and cacheLife instead of fetch cache options.

**Scope and limits:** An empty options object or an unrelated option such as signal does not declare a policy. The check does not run when the first existing root next.config.js, next.config.mjs, or next.config.ts sets cacheComponents to literal true. A nested experimental.cacheComponents, a comment, or a computed flag does not enable that exception. next.config.mts is not read.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js fetch reference, https://nextjs.org/docs/app/api-reference/functions/fetch; Migrating to Cache Components, https://nextjs.org/docs/app/guides/migrating-to-cache-components",
  "locator": "options.cache auto no cache; fetch cache options",
  "paraphrase": "In the previous model, fetch defaults to auto no cache, so a missing cache option is not a violation. With cacheComponents enabled, fetch is uncached unless it runs inside use cache, and cache or next options are not required."
}
```

### nextjs/NEXT-CONFLICT-001

Check: [`nextjs/data/no-conflicting-fetch-cache@1.0.0`](checks/data/no-conflicting-fetch-cache/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.conflicting-fetch-cache`. Minimum severity: `none`.

The developer requested incompatible cache lifetimes, so neither option governs the fetch as expected.

Default parameters: `{}`.

**Repair:** Keep cache: 'no-store' for uncached responses, or remove it and set next.revalidate to a positive interval.

**Scope and limits:** Swapping the order of the options does not change their conflict. An unrelated body object is not the fetch options object.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router API reference, fetch",
  "locator": "options.next.revalidate and options.cache",
  "paraphrase": "Conflicting cache options such as no-store together with a positive revalidation interval are both ignored."
}
```

### nextjs/NEXT-DIRECTIVE-001

Check: [`nextjs/rendering/no-misplaced-directive@1.0.0`](checks/rendering/no-misplaced-directive/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-misplaced-directive`. Minimum severity: `none`.

A directive anywhere else is an ordinary string. The file silently stays a Server Component, or the function never becomes a Server Action, and hooks or browser APIs then fail at build or run time.

Default parameters: `{}`.

**Repair:** Move the directive to the first line of the file, above every import, in single or double quotes. For an inline Server Action, put 'use server' as the first statement of the async function body.

**Scope and limits:** Comments and other quoted string statements before the directive are not flagged. 'use server' as the first statement of a function body is allowed. Strings that merely contain the words, in variables or JSX, are not directives and are not flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js API reference, use client, https://nextjs.org/docs/app/api-reference/directives/use-client; React reference, use server, https://react.dev/reference/rsc/use-server",
  "locator": "use client usage; use server caveats",
  "paraphrase": "'use client' goes at the top of the file, before imports, and cannot be placed inside a function. 'use server' must be at the very beginning of its file or function, above other code (comments are fine), in single or double quotes, not backticks."
}
```

### nextjs/NEXT-META-001

Check: [`nextjs/rendering/no-client-metadata-export@1.0.0`](checks/rendering/no-client-metadata-export/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-client-metadata-export`. Minimum severity: `none`.

Next.js rejects a metadata export from a 'use client' page or layout at build time, so the page loses its title and description or the build fails.

Default parameters: `{}`.

**Repair:** Remove 'use client' from the page or layout and move the interactive part into a child client component. Keep metadata or generateMetadata on the server file.

**Scope and limits:** Only exported metadata or generateMetadata in page and layout files under app/ or src/app/ whose leading directive is 'use client' are flagged, including export { x as metadata }. A local metadata constant that is not exported, and server files that mention the directive in a comment, are allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js API reference, generateMetadata, https://nextjs.org/docs/app/api-reference/functions/generate-metadata",
  "locator": "Metadata object and generateMetadata function, good to know",
  "paraphrase": "The metadata object and generateMetadata function exports are only supported in Server Components."
}
```

### nextjs/NEXT-ASYNC-001

Check: [`nextjs/data/no-sync-request-api@1.0.1`](checks/data/no-sync-request-api/check.json). Default severity: **warn**. Version gate: **deny** when the nearest `next` declaration is entirely `>=16.0.0`; otherwise severity stays **warn**. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-sync-request-api`. Minimum severity: `none`.

On Next.js 16 the call returns a Promise, so .get or .isEnabled reads undefined or throws. Next.js 15 still accepts the synchronous call and logs a deprecation warning.

Default parameters: `{}`.

**Repair:** Await the call first, for example const store = await cookies(); store.get('theme'). In a component that cannot be async, unwrap the Promise with React's use(). https://nextjs.org/docs/app/guides/upgrading/version-16

**Scope and limits:** Only a member read directly on cookies(), headers() or draftMode() imported from next/headers, including renamed imports, is flagged. Awaited calls, use(...), .then/.catch/.finally and same-named functions from other modules pass. A result stored in a variable first is not traced. The finding is a warning unless the nearest package.json declares next entirely on 16 or newer (including 16 prereleases). Next.js 15, an older release, and a specifier that can still install 15 stay warnings.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js API reference, cookies, https://nextjs.org/docs/app/api-reference/functions/cookies; Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16",
  "locator": "cookies good to know; Async Request APIs (breaking change)",
  "paraphrase": "cookies, headers and draftMode are async and must be awaited or unwrapped with React's use. Next.js 15 kept temporary synchronous access with a warning; Next.js 16 removes it."
}
```

### nextjs/NEXT-PARAMS-001

Check: [`nextjs/data/no-sync-page-props@1.0.1`](checks/data/no-sync-page-props/check.json). Default severity: **deny**. Version gate: **deny** when the nearest `next` declaration is entirely `>=16.0.0`; otherwise the rule does not run. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.sync-page-props`. Minimum severity: `none`.

The page props are Promises. Reading .slug or destructuring them without await yields undefined query data instead of the requested page.

Default parameters: `{}`.

**Repair:** Await the prop, then read it: const { slug } = await params and const query = await searchParams. In a Client Component, unwrap the Promise with React's use(). https://nextjs.org/docs/app/guides/upgrading/version-16

**Scope and limits:** Only page files under app/ or src/app/ are read. A member read, index read, or object destructure of params or searchParams is flagged, and so is props.params.x or props.searchParams.x when that access is not itself awaited. A nested parameter pattern is flagged. A use inside a block that declares a local of the same name, including one from await, use(), useParams(), or useSearchParams(), is not flagged. A parameter read in that same block is not flagged either. The rule runs only when next is declared entirely on 16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16",
  "locator": "Async Request APIs (Breaking change)",
  "paraphrase": "Next.js 16 removes synchronous access to params and searchParams in page.js. Next.js 15 kept a temporary synchronous compatibility path."
}
```

### nextjs/NEXT-SEGMENT-001

Check: [`nextjs/data/no-sync-segment-params@1.0.1`](checks/data/no-sync-segment-params/check.json). Default severity: **deny**. Version gate: **deny** when the nearest `next` declaration is entirely `>=16.0.0`; otherwise the rule does not run. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.sync-segment-params`. Minimum severity: `none`.

A synchronous read of the params Promise drops the dynamic segment, so the layout, route, or image is built for the wrong key.

Default parameters: `{}`.

**Repair:** Await params before reading it: const { slug } = await params. Keep the synchronous read inside generateImageMetadata. https://nextjs.org/docs/app/guides/upgrading/version-16

**Scope and limits:** Page files are covered by NEXT-PARAMS-001. This rule reads layout, route, default, and the image generator files. A member, index, destructure, or nested parameter pattern named params is flagged. A use inside a block that declares a local named params, including URLSearchParams, is not flagged. A parameter read in that same block is not flagged either. searchParams in a layout is not the page request API and is not flagged. generateImageMetadata is excluded. The rule runs only when next is declared entirely on 16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16",
  "locator": "Async Request APIs (Breaking change); Async parameters for icon and open-graph Image",
  "paraphrase": "params in layout, route, default, opengraph-image, twitter-image, icon, and apple-icon are Promises. generateImageMetadata still receives synchronous params. searchParams is documented for page.js."
}
```

### nextjs/NEXT-SITEMAP-001

Check: [`nextjs/data/no-sync-sitemap-id@1.0.0`](checks/data/no-sync-sitemap-id/check.json). Default severity: **deny**. Version gate: **deny** when the nearest `next` declaration is entirely `>=16.0.0`; otherwise the rule does not run. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.sync-sitemap-id`. Minimum severity: `none`.

Multiplying the Promise produces NaN, so the generated sitemap URLs start at the wrong offset.

Default parameters: `{}`.

**Repair:** Await id, then convert it: const resolved = await id; const start = Number(resolved) * 50000. https://nextjs.org/docs/app/guides/upgrading/version-16

**Scope and limits:** Only sitemap files under app/ or src/app/ are read. The flagged shape is an identifier named id used in arithmetic, including Number(id) and parentheses. await id passes. A local const that reuses the name id is flagged too. generateSitemaps is excluded. The rule runs only when next is declared entirely on 16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16",
  "locator": "Async id parameter for sitemap",
  "paraphrase": "The sitemap function receives id as a Promise. generateSitemaps still returns plain ids. The previous code multiplied the id number directly."
}
```

### nextjs/NEXT-IMAGE-001

Check: [`nextjs/data/no-sync-image-id@1.0.0`](checks/data/no-sync-image-id/check.json). Default severity: **deny**. Version gate: **deny** when the nearest `next` declaration is entirely `>=16.0.0`; otherwise the rule does not run. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.sync-image-id`. Minimum severity: `none`.

Storing or reading the Promise as if it were the image id string builds the wrong image, or none.

Default parameters: `{}`.

**Repair:** Await id, or unwrap it with React's use() in a Client Component: const imageId = await id. https://nextjs.org/docs/app/guides/upgrading/version-16

**Scope and limits:** Only opengraph-image, twitter-image, icon, and apple-icon files are read. An identifier named id is flagged when it is stored in a const, read as a member, or indexed, including through parentheses. await id and use(id) pass. A helper that copies an id parameter into a const is flagged too. The rule runs only when next is declared entirely on 16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16",
  "locator": "Async parameters for icon and open-graph Image",
  "paraphrase": "The image generating function in opengraph-image, twitter-image, icon, and apple-icon receives id as a Promise. generateImageMetadata still receives synchronous params and does not receive this id."
}
```

### nextjs/NEXT-REVALTAG-001

Check: [`nextjs/data/no-revalidate-tag-one-arg@1.0.0`](checks/data/no-revalidate-tag-one-arg/check.json). Default severity: **deny**. Version gate: **deny** when the nearest `next` declaration is entirely `>=16.0.0`; otherwise the rule does not run. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.revalidate-tag-one-arg`. Minimum severity: `none`.

A one-argument call no longer typechecks on Next.js 16, so the tag the author meant to refresh is not part of a typed cache profile. Next.js 15 still uses the single-argument form.

Default parameters: `{}`.

**Repair:** Pass a cacheLife profile, usually 'max', or { expire: seconds }: revalidateTag('posts', 'max'). For read-your-writes inside a Server Action, call updateTag(tag) instead. https://nextjs.org/docs/app/guides/upgrading/version-16

**Scope and limits:** Only a call whose function is revalidateTag imported from next/cache, including a renamed import, is flagged, and only when it has fewer than two arguments and no spread. A profile string, a variable, and { expire: number } all satisfy the second argument. updateTag and a same-named helper from another module pass. The rule runs only when next is declared entirely on 16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16; Next.js 16 release, https://nextjs.org/blog/next-16",
  "locator": "Caching APIs, revalidateTag; revalidateTag() (updated)",
  "paraphrase": "revalidateTag now requires a second argument. The upgrade guide shows a cacheLife profile such as 'max'. The Next.js 16 release also allows an inline { expire: number } object. The single-argument form is deprecated and is a TypeScript error."
}
```

## nextjs/routing

Manifest version: `1.4.1`. Status: **complete**.

### nextjs/NEXT-LINK-001

Check: [`nextjs/routing/no-anchor-navigation@1.0.2`](checks/routing/no-anchor-navigation/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-anchor-navigation`. Minimum severity: `none`.

A plain anchor to an internal route forces a full document reload and skips prefetching, losing the client-side navigation the router exists for.

Default parameters: `{}`.

**Repair:** Replace the anchor with Link from next/link. Keep anchors for external URLs only.

**Scope and limits:** This advisory policy checks actual anchor nodes with literal root-relative href attributes, including expression-wrapped strings, anywhere in JSX. It ignores CMS HTML strings, unrelated attributes, external and protocol-relative URLs, an anchor with target="_blank", and an anchor with a download attribute. Full reloads can be intentional; do not promote this suggestion without the project's navigation contract.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router docs, linking and navigating",
  "locator": "next/link client-side transitions",
  "paraphrase": "Internal navigation uses the Link component so the router can prefetch and transition client-side instead of reloading the page."
}
```

### nextjs/NEXT-DOC-001

Check: [`nextjs/routing/no-next-document-in-app@1.0.1`](checks/routing/no-next-document-in-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-next-document-in-app`. Minimum severity: `none`.

A Document import inside app/ silently does nothing while suggesting the Pages Router still controls the shell, so document changes never apply.

Default parameters: `{}`.

**Repair:** Move document-level markup into the app root layout and declare head data with the metadata export.

**Scope and limits:** Re-exporting next/document from a shared module so app files keep importing it indirectly. A string that mentions next/document without importing it is not an import.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router migration guide",
  "locator": "pages _document versus app root layout",
  "paraphrase": "The App Router owns the document through the root layout. next/document belongs to the Pages Router and has no effect under app."
}
```

### nextjs/NEXT-ROUTE-001

Check: [`nextjs/routing/no-router-push-concat@1.0.1`](checks/routing/no-router-push-concat/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-router-push-concat`. Minimum severity: `none`.

This optional readability policy observes concatenated destinations on recognized Next routers. Valid href strings remain valid; the syntax does not prove an unsafe destination or a typed-route failure.

Default parameters: `{}`.

**Repair:** Use a template or the project's tested route helper when this improves clarity. Validate untrusted destinations under the project's routing contract; interpolation alone is not a security fix.

**Scope and limits:** Checks cover imported Router and directly imported useRouter calls or same-block const receivers. Array.push, arbitrary injected push methods, indirect aliases, cross-scope bindings and dynamic receiver ownership are not inferred. Keep project routing safety in a reviewed assertion rather than enforcing a preferred spelling.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router docs, programmatic navigation",
  "locator": "typed route hrefs",
  "paraphrase": "Next routers accept href strings. A template or route helper can make the destination easier to read; concatenation alone is not a correctness violation."
}
```

### nextjs/NEXT-REVAL-001

Check: [`nextjs/data/no-revalidate-false@1.1.0`](checks/data/no-revalidate-false/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-revalidate-false`. Minimum severity: `none`.

A literal false or a number is legal in the previous model, so it is not reported unless the root Next config enables Cache Components. Then Next.js rejects the export at build time.

Default parameters: `{}`.

**Repair:** Remove the revalidate export. For data that should be cached, add use cache and cacheLife. For data that must run every request, leave it outside use cache.

**Scope and limits:** Only an exported revalidate on a page, layout, or route is matched, and only when the first existing root next.config.js, next.config.mjs, or next.config.ts sets cacheComponents to literal true. A 'use client' file is left to NEXT-SERVER-EXPORT-001. A local variable, a fetch next.revalidate option, and a commented or nested flag are not this export. Computed cacheComponents values are not detected.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Migrating to Cache Components, https://nextjs.org/docs/app/guides/migrating-to-cache-components; Caching and Revalidating (Previous Model), https://nextjs.org/docs/app/guides/caching-without-cache-components",
  "locator": "revalidate; Route segment config revalidate",
  "paraphrase": "Without Cache Components, revalidate = false is the documented default and caches indefinitely. With cacheComponents enabled, exporting revalidate from a page, layout, or route errors. Replace a positive interval with cacheLife inside use cache, and delete revalidate = 0."
}
```

### nextjs/NEXT-NAV-001

Check: [`nextjs/routing/no-pages-router-in-app@1.0.0`](checks/routing/no-pages-router-in-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.no-pages-router-in-app`. Minimum severity: `none`.

next/router needs the Pages Router context, which app/ does not provide, so the component throws when it renders.

Default parameters: `{}`.

**Repair:** Import useRouter from next/navigation. Read the path with usePathname and the query with useSearchParams. Shared components that must run under both routers can use next/compat/router.

**Scope and limits:** Only the exact next/router literal in a value import, re-export, require or import() inside app/ or src/app/ is flagged. Type-only imports, next/compat/router, next/navigation and files under pages/ are allowed. Components outside app/ that the App Router renders are not traced.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js App Router API reference, useRouter, https://nextjs.org/docs/app/api-reference/functions/use-router",
  "locator": "useRouter; error page next-router-not-mounted",
  "paraphrase": "In the App Router, useRouter must come from next/navigation, not next/router. Using the Pages Router hook under app throws 'NextRouter was not mounted'."
}
```

### nextjs/NEXT-SERVER-EXPORT-001

Check: [`nextjs/routing/no-export-in-client-component@1.1.0`](checks/routing/no-export-in-client-component/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.server-exports-in-client`. Minimum severity: `none`.

Exporting server route segment options or generateStaticParams from a file marked 'use client' either fails the Next.js build or is silently ignored. With cacheComponents enabled, Next.js also errors on server exports of dynamic, dynamicParams, revalidate, fetchCache, and runtime.

Default parameters: `{}`.

**Repair:** Move the export to a Server Component page, layout, or route. When cacheComponents is enabled, delete dynamic, dynamicParams, revalidate, fetchCache, and runtime. Cache with use cache and cacheLife, or leave the data uncached.

**Scope and limits:** Direct variable exports, function exports, and export list specifiers in 'use client' page, layout, and route files are matched, including dynamicParams and fetchCache. Local unexported variables pass. When the first existing root next.config.js, next.config.mjs, or next.config.ts sets cacheComponents to literal true, server files are also checked for dynamic, dynamicParams, fetchCache, and runtime. preferredRegion, maxDuration, generateStaticParams, ensureStatic, and instant are not flagged on the server. A nested or computed flag is not treated as enabled. An empty generateStaticParams return is a separate build error and is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Route Segment Config, https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config; cacheComponents, https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents; Migrating to Cache Components, https://nextjs.org/docs/app/guides/migrating-to-cache-components",
  "locator": "Version history v16.0.0; runtime; dynamic, revalidate, and fetchCache",
  "paraphrase": "Route segment options and generateStaticParams apply only in Server Components. When cacheComponents is enabled, dynamic, dynamicParams, revalidate, and fetchCache are removed, and runtime is unsupported, including runtime = 'nodejs'."
}
```

### nextjs/NEXT-PROXY-001

Check: [`nextjs/routing/no-middleware-named-export@1.0.0`](checks/routing/no-middleware-named-export/check.json). Default severity: **deny**. Version gate: **deny** when the nearest `next` declaration is entirely `>=16.0.0`; otherwise the rule does not run. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.middleware-named-export`. Minimum severity: `none`.

Proxy runs the default export or the export named proxy. A named middleware export is not that function, so the request reaches the route with none of the redirect, rewrite, or header changes.

Default parameters: `{}`.

**Repair:** Rename the named export to proxy: export function proxy(request) {}. A default export may keep its local name. https://nextjs.org/docs/app/api-reference/file-conventions/proxy

**Scope and limits:** Only proxy.ts and src/proxy.ts (and the same .js, .jsx, .tsx, .mjs, .cjs names) are read. export function, export const, and export { x as middleware } are flagged. export default function middleware is not, because a default export is a supported proxy function. A local unexported function named middleware passes. The rule runs only when next is declared entirely on 16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16; Proxy file convention, https://nextjs.org/docs/app/api-reference/file-conventions/proxy",
  "locator": "middleware to proxy; Migration to Proxy",
  "paraphrase": "The named export middleware is deprecated. proxy.ts must export a function named proxy, or a default export. The guide recommends renaming a default export too, and that remains a recommendation."
}
```

### nextjs/NEXT-PROXY-002

Check: [`nextjs/routing/no-nodejs-middleware-file@1.0.0`](checks/routing/no-nodejs-middleware-file/check.json). Default severity: **warn**. Version gate: **warn** when the nearest `next` declaration is entirely `>=16.0.0`; otherwise the rule does not run. A specifier that can still install an older release, or that cannot be read, does not match.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `nextjs.nodejs-middleware-file`. Minimum severity: `none`.

A Node.js middleware.ts file is the deprecated filename for the runtime proxy.ts now owns. Leaving it splits request interception across two conventions. Edge middleware is still the supported middleware.ts file.

Default parameters: `{}`.

**Repair:** Rename middleware.ts to proxy.ts, export proxy, and delete config.runtime. Keep middleware.ts when the file should stay on the Edge runtime, which is the default when config.runtime is not "nodejs". https://nextjs.org/docs/app/guides/upgrading/version-16

**Scope and limits:** Only middleware.ts and src/middleware.ts (and the same JavaScript extensions) are read. The finding is the exported config object's own runtime: "nodejs" pair, in either quote style. A matcher-only config, runtime: "edge", and a nested runtime string are not the Node.js opt-in. The rule runs only when next is declared entirely on 16 or newer, and it warns rather than denies because the file still runs.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Next.js 16 upgrade guide, https://nextjs.org/docs/app/guides/upgrading/version-16; Next.js 15 middleware runtime, https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware",
  "locator": "middleware to proxy; Runtime",
  "paraphrase": "The middleware filename is deprecated in favor of proxy. Proxy runs on Node.js and cannot set a runtime. Middleware defaults to the Edge runtime; Node.js is selected with export const config = { runtime: 'nodejs' }. Edge middleware stays in middleware.ts."
}
```
