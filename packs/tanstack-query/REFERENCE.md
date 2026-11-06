# tanstack-query pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.0.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## tanstack-query/client

Manifest version: `1.0.0`. Status: **complete**.

### tanstack-query/TQ-CLIENT-001

Check: [`tanstack-query/client/no-query-client-in-render@1.0.0`](checks/client/no-query-client-in-render/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tanstack-query.query-client-in-render`. Minimum severity: `none`.

A QueryClient created during render is a new cache on every render, so queries refetch and mutations lose the client they were given.

Default parameters: `{}`.

**Repair:** Create the client once at module scope, or keep one client with const [queryClient] = useState(() => new QueryClient()). https://tanstack.com/query/latest/docs/framework/react/quick-start

**Scope and limits:** An async function is not reported: an async Server Component runs once. useState and useMemo initializers are nested functions and are not reported. A lowercase factory, a renamed or member constructor, and a component wrapped in memo() or forwardRef() are not reported. The check looks at a synchronous component or hook (a function whose name starts with an uppercase letter or with use plus an uppercase letter) and at a render method.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TanStack Query documentation, Stable Query Client",
  "locator": "not a new instance on every render",
  "paraphrase": "The QueryClient owns the cache. One instance lasts for the application. A component that constructs a new client on each render throws that cache away."
}
```

## tanstack-query/keys

Manifest version: `1.0.0`. Status: **complete**.

### tanstack-query/TQ-KEY-001

Check: [`tanstack-query/keys/no-non-array-query-key@1.0.0`](checks/keys/no-non-array-query-key/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tanstack-query.non-array-query-key`. Minimum severity: `none`.

A query key that is not an array is not a cache identity. The same data is then stored under a key the rest of the app cannot invalidate.

Default parameters: `{}`.

**Repair:** Write an array: queryKey: ['todos', id]. Nested objects stay inside the array, as in queryKey: ['todos', { status, page }]. https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

**Scope and limits:** A variable, call, or key factory is not inspected, and neither is a computed property name. An array, including one asserted with as const, is allowed. The check reads a queryKey value inside useQuery, useSuspenseQuery, useInfiniteQuery, useSuspenseInfiniteQuery, useQueries, useSuspenseQueries, queryOptions, infiniteQueryOptions, createQuery, createInfiniteQuery, createQueries, injectQuery, injectInfiniteQuery, injectQueries, useIsFetching, and the QueryClient methods fetchQuery, prefetchQuery, prefetchInfiniteQuery, ensureQueryData, ensureInfiniteQueryData, invalidateQueries, refetchQueries, resetQueries, cancelQueries, removeQueries, getQueriesData, setQueriesData, and isFetching.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "TanStack Query documentation, Query Keys",
  "locator": "Query keys have to be an Array at the top level",
  "paraphrase": "A query key is an array so the cache can hash it. Strings, numbers, and objects belong inside that array, not in its place."
}
```
