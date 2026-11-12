# vue

Vue TypeScript syntax checks for composables, services, and router helpers. [Vue documents both Options API and Composition API as fully capable](https://vuejs.org/guide/introduction.html#api-styles), so the blanket Options-API ban is off. Everything that needs a `.vue` template grammar or a running app is in `BACKLOG.md`.

Fixtures are `.ts` files with realistic Composition-API code. There is no `.vue` grammar; template-only shapes are out of scope.

`pregate scan` recommends this pack when a primary package declares exact `vue` in `dependencies`, `devDependencies`, or `peerDependencies`, or when a `.vue` file is present. The declaration is confined to the package that names `vue`. A `.vue` file does not add a package owner. A similarly named package, such as `vue-router`, does not count. Evidence that exists only under a docs site, examples tree, fixtures tree, website, CI workflow, or tiny `scripts/` folder does not count.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `VUE-OPT-001` | An Options-API object (`data`, `methods`, `mounted`, `created`, `computed`, `watch`) in `export default`. | Both API styles are supported; select a style by project convention. | off |
| `VUE-DEST-001` | `const { x } = reactive(...)`, including factory arguments. | Primitives lose reactivity, but nested object proxies remain reactive; value types are unresolved. | off |
| `VUE-PROP-001` | Writes to `props.x` or `props["x"]`, plain or augmented assignment. | Props flow one way down; a child write snaps back on the next render. | deny |
| `VUE-PINIA-001` | `const { x } = useXStore(...)`, including with an explicit pinia argument. | State requires refs, while bound actions can be extracted directly; the matcher cannot distinguish them. | off |
| `VUE-PUSH-001` | `push` with `+` in its arguments, on a receiver that ends in `router` (`router`, `this.$router`, `useRouter()`). An array `push` is not matched. | Concatenated paths hide renames until a user reaches that screen. | deny |
| `VUE-REF-001` | `ref(null)` or `ref(undefined)` with no type argument. | The inferred type holds nothing, so the first real assignment fails far from the cause. | deny |
| `VUE-TICK-001` | Zero-argument `nextTick()` that is neither awaited nor returned, including on a branch; callback calls pass. | Review whether later code needs to wait for the DOM update. | warn |
| `VUE-THIS-001` | `this` in `**/composables/**`: `this.x`, `this["x"]`, or bare `this`. | Composables run with no instance; `this` breaks the moment the function is reused. | deny |
| `VUE-COMPUTED-001` | An async getter in `computed(...)`: async arrow, async function, or async `get` in the options form. | The computed value becomes a Promise and each dependency change fires another request. | deny |
| `VUE-V2-001` | `new Vue(...)` and `Vue.config/component/directive/mixin/use/prototype/extend/filter`. | Vue 3 has no constructor; these moved to the `createApp` instance or were removed. Vue 2.7 projects can turn it off. | warn |

## Methodologies

- `vue/sfc` — VUE-OPT-001, VUE-PROP-001, VUE-THIS-001, VUE-V2-001
- `vue/reactivity` — VUE-DEST-001, VUE-PINIA-001, VUE-REF-001, VUE-TICK-001, VUE-PUSH-001, VUE-COMPUTED-001

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.1`. 11 distinct check IDs.

Methodologies: `vue/reactivity` (complete), `vue/sfc` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
