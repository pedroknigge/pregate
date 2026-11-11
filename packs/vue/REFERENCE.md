# vue pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## vue/reactivity

Manifest version: `1.1.1`. Status: **complete**.

### vue/VUE-DEST-001

Check: [`vue/reactivity/no-reactive-destructure@1.0.0`](checks/reactivity/no-reactive-destructure/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.reactive-destructure`. Minimum severity: `none`.

Destructured primitives lose reactivity, but nested object proxies retain it. This matcher cannot determine the extracted value type.

Default parameters: `{}`.

**Repair:** Keep the reactive object whole, or convert it with toRefs before destructuring so each key stays a ref.

**Scope and limits:** Nested reactive objects remain proxies. Keep the blanket matcher off until value types can be resolved.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "reactive destructuring",
  "paraphrase": "Destructuring a reactive primitive property loses reactivity. Extracted nested objects remain reactive proxies.",
  "work": "Vue documentation, reactivity fundamentals"
}
```

### vue/VUE-PINIA-001

Check: [`vue/state/no-store-destructure@1.0.0`](checks/state/no-store-destructure/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.store-destructure`. Minimum severity: `none`.

Destructured state loses reactivity, but bound actions may be destructured directly. This matcher cannot distinguish actions from state.

Default parameters: `{}`.

**Repair:** Wrap the store in storeToRefs first, then destructure. Actions can come off the store directly.

**Scope and limits:** Pinia actions can be extracted directly. Keep the blanket matcher off until state and actions can be resolved.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "storeToRefs",
  "paraphrase": "Use storeToRefs for reactive state and getters. Bound store actions can be destructured directly.",
  "work": "Pinia documentation, stores"
}
```

### vue/VUE-REF-001

Check: [`vue/reactivity/no-untyped-ref@1.0.0`](checks/reactivity/no-untyped-ref/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.untyped-ref`. Minimum severity: `none`.

An untyped ref(null) narrows to a type that holds nothing, so the first real assignment fails the build far from the cause.

Default parameters: `{}`.

**Repair:** Write the type argument: ref<string | null>(null). The checker then accepts later assignments of that type.

**Scope and limits:** A comment or a cast beside the call does not add a type. Only an explicit type argument counts.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "ref typing",
  "paraphrase": "ref infers from its argument. null and undefined infer to a type that rejects every later value.",
  "work": "Vue documentation, ref API"
}
```

### vue/VUE-TICK-001

Check: [`vue/reactivity/no-floating-nexttick@1.0.0`](checks/reactivity/no-floating-nexttick/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.floating-nexttick`. Minimum severity: `none`.

A floating nextTick lets the next lines run against the old DOM, so measurements and focus land on stale nodes.

Default parameters: `{}`.

**Repair:** If later code needs the updated DOM, await or return the promise, or pass that work as a callback.

**Scope and limits:** Passing a callback is supported and is not matched. The zero-argument matcher cannot establish whether later code needs the DOM update.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "nextTick promise",
  "paraphrase": "Wait for DOM updates by passing a callback to nextTick or by awaiting its promise.",
  "work": "Vue documentation, nextTick API"
}
```

### vue/VUE-PUSH-001

Check: [`vue/router/no-push-concat@1.0.1`](checks/router/no-push-concat/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.push-concat`. Minimum severity: `none`.

A renamed path breaks every concatenated push silently, and the failure only shows when a user reaches that screen.

Default parameters: `{}`.

**Repair:** Push a named route with a params object: push({ name: "user", params: { id } }). Renames then fail the build instead of the router.

**Scope and limits:** More segments do not help. Any plus inside push arguments is string-built routing, even with a shared base prefix. The receiver must end in router, for example router, this.$router or useRouter(). A push on an array is not matched. A router held under another name is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "named routes",
  "paraphrase": "Named routes with params keep navigation checkable. Concatenated paths hide renames until a user clicks.",
  "work": "Vue Router documentation, navigation"
}
```

### vue/VUE-COMPUTED-001

Check: [`vue/reactivity/no-async-computed@1.0.0`](checks/reactivity/no-async-computed/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.async-computed`. Minimum severity: `none`.

An async getter returns a Promise, so every reader and the template see a Promise instead of the value, and each dependency change fires another request.

Default parameters: `{}`.

**Repair:** Load the data in a watcher (or watchEffect) that writes a ref, then compute from that ref. VueUse computedAsync is the packaged form of the same idea.

**Scope and limits:** Moving the async getter into the options form (get: async () => ... or async get()) still returns a Promise. A sync setter beside it does not help.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "locator": "Computed Properties, Getters should be side-effect free",
  "paraphrase": "Computed getters only compute and return a value. Do not make async requests in them; use watchers for side effects.",
  "work": "Vue documentation, computed properties (https://vuejs.org/guide/essentials/computed.html#getters-should-be-side-effect-free)"
}
```

## vue/sfc

Manifest version: `1.2.1`. Status: **complete**.

### vue/VUE-OPT-001

Check: [`vue/sfc/no-options-api@1.0.0`](checks/sfc/no-options-api/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.options-api`. Minimum severity: `none`.

An Options API component is supported and may be appropriate; its syntax does not establish a defect.

Default parameters: `{}`.

**Repair:** Choose the component style that fits the project; migrate only when the team adopts that convention.

**Scope and limits:** Adding a setup key does not make an Options component invalid. This blanket style check remains off.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Vue guide, Introduction",
  "locator": "API Styles",
  "paraphrase": "Vue supports both Options API and Composition API. Either style can cover common use cases."
}
```

### vue/VUE-PROP-001

Check: [`vue/components/no-prop-mutation@1.0.0`](checks/components/no-prop-mutation/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.prop-mutation`. Minimum severity: `none`.

A child that writes a prop fights the parent on the next render, and the value snaps back without warning.

Default parameters: `{}`.

**Repair:** Emit an update event such as update:title and let the parent change the value. Keep a local copy in a ref when the child needs to edit.

**Scope and limits:** Reading props is fine. The rule only fires on writes: assignment and augmented assignment to props, dot or bracket.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Vue documentation, props",
  "locator": "one-way data flow for props",
  "paraphrase": "Props flow one way down. A child assigns to its own copy or emits; it never writes the prop."
}
```

### vue/VUE-THIS-001

Check: [`vue/sfc/no-this-in-composable@1.0.0`](checks/sfc/no-this-in-composable/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.this-in-composable`. Minimum severity: `none`.

A composable that reads this only works when something binds an instance, so it breaks the moment it is reused elsewhere.

Default parameters: `{}`.

**Repair:** Take state as an argument or close over a module-level reactive object. Composables receive everything through parameters.

**Scope and limits:** A bare this as a value (const self = this) is the same instance grab. Bracket access this["x"] is also covered.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Vue documentation, composables",
  "locator": "composables have no component instance",
  "paraphrase": "Composition functions run with no instance. this is undefined there; state arrives through arguments."
}
```

### vue/VUE-V2-001

Check: [`vue/app/no-vue2-global-api@1.0.0`](checks/app/no-vue2-global-api/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.vue2-global-api`. Minimum severity: `none`.

On Vue 3 these calls fail at runtime or register nothing, so plugins, components and config silently never reach the app.

Default parameters: `{}`.

**Repair:** Create the app with createApp(App) and call app.use, app.component, app.directive and app.config on it. Put shared globals on app.config.globalProperties; type components with defineComponent.

**Scope and limits:** Vue.extend is not a typing helper on Vue 3; use defineComponent. The CDN global build's Vue.createApp, Vue.ref and Vue.nextTick are valid and are not matched. A Vue 2.7 project can turn this rule off.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Vue 3 migration guide, Global API (https://v3-migration.vuejs.org/breaking-changes/global-api.html)",
  "locator": "A New Global API: createApp; 2.x Global API table",
  "paraphrase": "Vue 3 has no Vue constructor. Vue.config, component, directive, mixin, use and prototype move to the app from createApp; Vue.extend is removed."
}
```

### vue/VUE-DOM-001

Check: [`vue/components/no-dom-query-in-setup@1.0.1`](checks/components/no-dom-query-in-setup/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `vue.dom-query`. Minimum severity: `none`.

Global document queries fail during SSR, match elements from sibling component instances, and run before Vue mounts the template when called during setup.

Default parameters: `{}`.

**Repair:** Bind a ref attribute in the template and read it with useTemplateRef('name') or ref(null) inside onMounted.

**Scope and limits:** Direct calls on document, window.document, and globalThis.document for getElementById, querySelector, querySelectorAll, getElementsByClassName, and getElementsByTagName are matched. Queries on local Element or XMLDocument receivers pass. The call is matched when the file imports vue, a vue- or @vue/ package, nuxt, #imports or a .vue file, or when the call is inside a function. A query at the top level of a script with no such import is not matched. A function in a file that has no Vue code is still matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Vue documentation, Template Refs (https://vuejs.org/guide/essentials/template-refs.html)",
  "locator": "Accessing the Refs",
  "paraphrase": "Use template refs (useTemplateRef or ref) to obtain direct references to DOM elements owned by a component after mount instead of querying the global document."
}
```
