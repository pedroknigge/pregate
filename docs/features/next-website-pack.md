# Next.js website pack

Included in 0.0.5. The optional preview pack
contains 54 distinct `NEXT-WEBSITE-NNN` project evidence gates through
`next-website/readiness`. No deployment, browser performance or complete Next.js product
coverage is established merely by selecting the pack.

The scope is a production website using the App Router. A Pages Router site uses
the same security and metadata requirements, with API routes in place of Server
Actions. An invariant is a condition the website must satisfy at all times; a
false applicable condition means the website is not correct for production.
A rule is complete only when a build or test shows evidence.

The 54 original English requirements in eight categories are preserved below.
These gates compose with the existing Next.js/React static packs. Their assertions
must use the real build, runtime or browser when source syntax is insufficient.

## Evidence and implementation acceptance

- Record the actual router, installed Next.js/React versions, supported runtime,
  enabled cache model and deployment. Use version-specific primary documentation;
  do not hard-code the version displayed by an online documentation page.
- Map each requirement to a stable rule identity, applicability and bounded
  evidence: source/graph checks, real production build, boundary/auth tests,
  deployment checks or browser/performance tests. Report missing evidence.
- Verify transitive client imports, server-only admission and serializable public
  data with the real bundler and boundary tests. Preserve the Server Function
  reference exception. A substring or filename does not prove bundle secrecy.
- Test unauthorized mutations directly, without trusting a layout or UI gate.
  Test untrusted input and relevant cache invalidation after writes.
- Measure the designated primary pages and screen conditions for LCP/CLS and
  accessibility; declare environment, samples, keyboard flows and contrast
  assertions. Component-name checks do not prove a performance/accessibility goal.
- Verify headers, TLS, session attributes, public assets, remote image hosts,
  secrets and patched supported versions against actual deployment/configuration.
- Add valid, invalid and bypass controls; document all categories, selection,
  evidence binding and repair. Calibrate with a consumer before readiness claims.

## Technical qualifications in the implementation

The following qualifications are recorded in the corresponding rule statements,
with primary documentation checked on 2026-10-05. Original input stays traceable:

- Rule 7 must allow ordinary Hooks inside custom Hooks as well as function
  components. React's `use` API has distinct conditional/loop semantics; do not
  reject supported code with one universal name-prefix pattern.
  [React Hook rules](https://react.dev/reference/rules/rules-of-hooks),
  [React use reference](https://react.dev/reference/react/use).
- Rule 22 depends on the enabled rendering/cache model. With Cache Components,
  request data can stream inside Suspense alongside a static shell; reading
  cookies does not necessarily make the entire route dynamic.
  [Next.js caching](https://nextjs.org/docs/app/getting-started/caching).
- Rule 24 must distinguish route groups/structural directories from reachable
  endpoints. A page and Route Handler must not occupy the same route segment.
  Preserve endpoint completeness while rejecting that conflict.
  [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).

The original wording remains below for traceability. The generated rules preserve
it as provenance and use the qualified statement for requirements 7, 22 and 24.

## Requested invariant rules

### Rendering

1. A page and a layout are Server Components by default.
2. A Server Component does not use a browser-only API.
3. A file uses the `use client` directive only when it needs state, events, or a browser API.
4. The `use client` directive is at the top of the file, before imports.
5. The directive marks only the entry of a client subtree.
6. A component does not change props during render.
7. A hook runs only at the top level of a function component.

### Server and client boundary

8. Server Component code does not ship to the browser.
9. Code that a Client Component imports becomes part of the client bundle.
10. Data that crosses the boundary is serializable.
11. The server does not pass a function as a prop to a Client Component.
12. A Server Function can cross the boundary as a reference.
13. A Server Function is async.
14. The product does not pass a secret or a full database row to a Client Component.
15. A module that must stay on the server imports `server-only`.

### Data and cache

16. A Server Component fetches data on the server.
17. A Server Component does not call a Route Handler for its own data.
18. The product validates every untrusted input before use.
19. A Server Action checks authentication and authorization inside the action.
20. A layout check is not the only authorization check.
21. A mutation revalidates the cache tags that the write changes.
22. A request-time API such as `cookies()` or `headers()` opts that route into dynamic rendering.
23. Slow data sits behind `Suspense` or `loading.tsx` so the rest of the page can stream.

### Routing and errors

24. Each route has a `page`, a route handler, or both.
25. The app has `error.tsx` for an unexpected failure.
26. The app has `not-found` for a missing resource.
27. Internal navigation uses the Next.js `Link` component.
28. A dynamic route validates `params` before use.
29. A file in `public/` does not contain a secret.

### Security

30. The site serves pages over HTTPS.
31. A secret does not use the `NEXT_PUBLIC_` prefix.
32. The product does not commit an environment file.
33. A session cookie is `HttpOnly`, `Secure`, and `SameSite`.
34. Responses set `Content-Security-Policy`.
35. Responses set `Strict-Transport-Security` after TLS is stable.
36. Responses set `X-Content-Type-Options` to `nosniff`.
37. The image config allows only known remote hosts.
38. The build fails if a client bundle imports a server-only module.

### Metadata

39. Each indexable page sets a title and a description.
40. Each indexable page sets a canonical URL.
41. The site provides a sitemap.
42. The site provides `robots` rules.
43. A page that users share sets Open Graph fields.

### Assets and performance

44. A content image uses the Next.js `Image` component.
45. A font loads with `next/font`.
46. A third-party script loads with the `Script` component.
47. The largest contentful paint stays under 2.5 seconds on a primary page.
48. The cumulative layout shift stays under 0.1 on a primary page.

### Build and access

49. Type checks pass before deploy.
50. The production build runs with `NODE_ENV` set to `production`.
51. The site runs a supported Next.js version with known security patches.
52. An interactive control is reachable by keyboard.
53. An image that conveys meaning has alt text.
54. Text contrast meets WCAG 2.1 AA on a primary screen.

The minimum set contains 54 requested requirements. See the [pack reference](../../packs/next-website/REFERENCE.md)
and [evidence/adoption guide](../guides/readiness-packs.md). Receipt fixtures test
admission, not browser behavior; real consumer calibration remains outstanding.
