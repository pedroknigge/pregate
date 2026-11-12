# react pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## react/components

Manifest version: `1.2.1`. Status: **complete**.

### react/REACT-KEY-001

Check: [`react/components/no-array-index-key@1.0.1`](checks/components/no-array-index-key/check.json). Default severity: **deny**.

Implementation: `react-index-key`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript (includes JavaScript)`. Cardinality: `singleton`. Dimension: `react.array-index-key`. Minimum severity: `none`.

An index key makes React match the wrong item after a reorder, so inputs keep stale values and animations jump.

Default parameters: `{}`.

**Repair:** Use a stable item id for data-bearing or mutable lists. A direct Array.from({ length: N }, (_, index) => literal JSX) placeholder list may retain its index when N is a nonnegative integer literal and the element is unused.

**Scope and limits:** Direct index keys and call-wrapped forms still report for dynamic, data-bearing, reordered or transformed lists. The static exception requires unshadowed Array.from, one literal length property, an unused element parameter and literal intrinsic JSX containing only constants or the direct positional index. Nested data expressions, items[index], custom renderers, dynamic lengths and wrapped index keys remain unproved. This does not infer runtime identity across components or arbitrary generators.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, lists and keys",
  "locator": "Keys must be stable and unique",
  "paraphrase": "Keys reconcile list items across renders. An array index describes position, not identity, so inserts and deletes reuse the wrong state."
}
```

### react/REACT-NEST-001

Check: [`react/components/no-nested-component@1.0.1`](checks/components/no-nested-component/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.nested-component`. Minimum severity: `none`.

Each render creates a fresh component type, so the nested tree remounts: inputs lose focus and effects re-run.

Default parameters: `{}`.

**Repair:** Move the inner component next to its parent and pass the data it needs as props.

**Scope and limits:** The checker requires uppercase local function/component names and actual JSX in both the nested definition and its enclosing function declaration, without crossing another function. Ordinary helpers, markup strings and lowercase render callbacks are allowed. React.createElement, anonymous factories, outer arrow components and cross-file/runtime component identity need stronger evidence.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, component composition",
  "locator": "Define components at the top level",
  "paraphrase": "A component defined inside another component is a new type on every render, so React unmounts and remounts its whole subtree and loses state."
}
```

### react/REACT-REF-001

Check: [`react/components/no-string-ref@1.0.0`](checks/components/no-string-ref/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.string-ref`. Minimum severity: `none`.

String refs break under composition and minification, and the checker cannot type what they point at.

Default parameters: `{}`.

**Repair:** Create the ref with useRef and pass the object, or pass a callback that receives the node.

**Scope and limits:** Only literal string refs are flagged, double-quoted or single-quoted in an expression. A variable or callback in braces is the replacement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React legacy documentation, refs",
  "locator": "String refs are legacy",
  "paraphrase": "String refs resolve through the owner at runtime and cannot be typed or composed. An object or callback ref points at the node directly."
}
```

### react/REACT-BLANK-001

Check: [`react/components/no-unsafe-blank-target@1.0.1`](checks/components/no-unsafe-blank-target/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.unsafe-blank-target`. Minimum severity: `none`.

The opened page gains opener access and can redirect the original tab to a lookalike.

Default parameters: `{}`.

**Repair:** Add rel="noreferrer" to the anchor. Keep target="_blank" only for destinations outside the app.

**Scope and limits:** The rule matches a JSX target attribute, not the same characters inside a string. Same-tab links need no rel. rel on the same element silences the rule; rel on a different element does not. noreferrer is the value that cuts opener access.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Web security guidance for external links",
  "locator": "Links that open a new tab",
  "paraphrase": "A new tab keeps a reference to its opener. Without rel noreferrer the opened page can navigate the tab the user came from."
}
```

### react/REACT-PROP-001

Check: [`react/components/no-proptypes@1.0.0`](checks/components/no-proptypes/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.proptypes`. Minimum severity: `none`.

Runtime checks ship to development bundles and miss every caller the compiler could have stopped.

Default parameters: `{}`.

**Repair:** Declare an interface for the props and annotate the component. Delete the import and the assignment.

**Scope and limits:** Type-only imports from react are fine. Any import of the prop-types package and any .propTypes assignment are flagged.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, TypeScript",
  "locator": "Static typing replaces PropTypes",
  "paraphrase": "PropTypes check props at runtime in development only. A TypeScript interface checks the same contract at compile time on every build."
}
```

### react/REACT-ROOT-001

Check: [`react/components/no-legacy-root-api@1.0.0`](checks/components/no-legacy-root-api/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.legacy-root-api`. Minimum severity: `none`.

React 19 no longer exports these functions, so the app fails at startup; on React 18 the legacy root also opts out of concurrent features and logs an error.

Default parameters: `{}`.

**Repair:** Import createRoot or hydrateRoot from react-dom/client and call root.render or root.unmount. Replace findDOMNode with a ref on the element.

**Scope and limits:** Only these four names are flagged: as named imports from react-dom, or as members of a default or namespace react-dom import. render from @testing-library/react, root.render, react-dom/client, react-dom/server, createPortal and flushSync are allowed. require("react-dom") and re-exports are not traced.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React 19 upgrade guide, https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
  "locator": "Removed deprecated React DOM APIs: ReactDOM.render, ReactDOM.hydrate, unmountComponentAtNode, ReactDOM.findDOMNode",
  "paraphrase": "React 18 deprecated render, hydrate and unmountComponentAtNode, and React 19 removed them with findDOMNode. Apps mount with createRoot or hydrateRoot and reach DOM nodes through refs."
}
```

### react/REACT-JSURL-001

Check: [`react/components/no-javascript-url@1.0.0`](checks/components/no-javascript-url/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.javascript-url`. Minimum severity: `none`.

A javascript: link runs script from markup. React blocks it, so the link does nothing except throw, and the pattern is an injection path when the URL is built from data.

Default parameters: `{}`.

**Repair:** Use a button with an onClick handler for actions, or a real URL or #fragment for links.

**Scope and limits:** Only literal href and src values that start with javascript: are flagged, in any letter case, after leading spaces, in quotes, braces or a template whose first text is the scheme. URLs from variables or props are not resolved. Text that mentions javascript elsewhere is allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React 19 upgrade guide, https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
  "locator": "Changelog, other breaking changes: react-dom errors for javascript URLs in src and href",
  "paraphrase": "React DOM blocks javascript: URLs in src and href. Earlier versions warned; React 19 replaces them with a URL that throws."
}
```

### react/REACT-FIELD-001

Check: [`react/components/no-readonly-controlled-field@1.0.0`](checks/components/no-readonly-controlled-field/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.readonly-controlled-field`. Minimum severity: `none`.

The user types or clicks and nothing changes, because React forces the field back to the passed value on every render.

Default parameters: `{}`.

**Repair:** Pass an onChange handler that updates the state behind value or checked. For display-only fields add readOnly; for an initial value use defaultValue or defaultChecked.

**Scope and limits:** onChange, onInput, readOnly or disabled on the element satisfies the rule, as does any spread of props. For value, an input whose type is an expression or a non-text type such as hidden, submit, checkbox, radio or file is skipped; checked is checked on any input. Custom components such as <Input> and React Native TextInput are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React DOM documentation, <input>, https://react.dev/reference/react-dom/components/input",
  "locator": "Troubleshooting: my text input doesn't update when I type into it; my checkbox doesn't update when I click on it",
  "paraphrase": "An input, textarea or select given value (or a checkbox given checked) without onChange is read-only: React logs an error and reverts every edit. Add onChange, mark it readOnly, or use defaultValue."
}
```

### react/REACT-CONSUMER-001

Check: [`react/components/no-context-consumer@1.0.0`](checks/components/no-context-consumer/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.context-consumer`. Minimum severity: `none`.

Context.Consumer wraps children in a render-prop callback for every context read, deeply nesting the JSX tree when multiple contexts are consumed.

Default parameters: `{}`.

**Repair:** Call useContext(Context) or use(Context) at the top of the component and render the JSX directly.

**Scope and limits:** Only JSX elements whose tag is a member expression ending in .Consumer are matched. Bare <Consumer /> components are allowed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, useContext and use (https://react.dev/reference/react/useContext)",
  "locator": "Legacy way: Context.Consumer",
  "paraphrase": "Before useContext existed, Context.Consumer was the render-props way to read context. Modern React recommends useContext(Context) or use(Context)."
}
```

### react/REACT-LIFECYCLE-001

Check: [`react/components/no-legacy-lifecycle@1.0.0`](checks/components/no-legacy-lifecycle/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.legacy-lifecycle`. Minimum severity: `none`.

Legacy pre-commit lifecycle methods fire repeatedly when rendering is interrupted, causing duplicate requests, state tearing, and runtime warnings.

Default parameters: `{}`.

**Repair:** Move side effects to componentDidMount or componentDidUpdate, derive state in static getDerivedStateFromProps, or migrate the class to a function component.

**Scope and limits:** The UNSAFE_ prefix only silences one deprecation notice while keeping the unsafe execution model. Plain object methods outside classes are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, Component legacy lifecycle methods (https://react.dev/reference/react/Component)",
  "locator": "Deprecated lifecycle methods: componentWillMount, componentWillReceiveProps, componentWillUpdate",
  "paraphrase": "componentWillMount, componentWillReceiveProps, and componentWillUpdate (including UNSAFE_ aliases) are legacy lifecycles that run more than once under concurrent rendering."
}
```

## react/hooks

Manifest version: `1.0.2`. Status: **complete**.

### react/REACT-HOOK-001

Check: [`react/hooks/no-conditional-hook@1.0.1`](checks/hooks/no-conditional-hook/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.conditional-hook`. Minimum severity: `none`.

A Hook inside a branch runs on some renders and not others, so every Hook after it reads the wrong slot.

Default parameters: `{}`.

**Repair:** Move the Hook call above the branch and put only its result inside the condition.

**Scope and limits:** A custom Hook is still a plain function: the rule only fires inside a branch or loop, so a helper without JSX is not flagged. The condition of an if or a ternary runs on every render and is not a branch. A Hook on the right of &&, ||, or ?? is. A Hook inside a function nested in a branch is that function's own top-level call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, Rules of Hooks",
  "locator": "Only call Hooks at the top level",
  "paraphrase": "Call Hooks unconditionally at the top level of a component or custom Hook so every render runs them in the same order."
}
```

### react/REACT-EFFECT-001

Check: [`react/hooks/no-async-effect@1.0.1`](checks/hooks/no-async-effect/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.async-effect`. Minimum severity: `none`.

React treats the returned promise as a cleanup function that never runs, and rejections escape the effect.

Default parameters: `{}`.

**Repair:** Define an async function inside the effect and void it, or move the work into an event handler.

**Scope and limits:** An async helper declared inside a synchronous effect callback is fine; only the callback itself must stay synchronous.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, useEffect",
  "locator": "Effect callbacks are synchronous",
  "paraphrase": "An effect callback returns either nothing or a cleanup function. An async callback returns a promise, so the cleanup protocol cannot run."
}
```

### react/REACT-RENDER-001

Check: [`react/hooks/no-setstate-in-render@1.0.0`](checks/hooks/no-setstate-in-render/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.setstate-in-render`. Minimum severity: `none`.

The matcher cannot resolve setter bindings or prove a guarded update converges. A setX name alone does not establish a defect.

Default parameters: `{}`.

**Repair:** Review whether this is a React setter and whether a guarded update converges before changing it.

**Scope and limits:** Guarded previous-render updates are documented as valid. Ordinary functions named setX are also matched; keep this heuristic off until bindings and control flow are resolved.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, keeping components pure",
  "locator": "Do not update state during render",
  "paraphrase": "React permits guarded updates of the current component during render to track previous renders. Unconditional updates can loop."
}
```

### react/REACT-CALLBACK-001

Check: [`react/hooks/no-hook-in-callback@1.0.0`](checks/hooks/no-hook-in-callback/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react.hook-in-callback`. Minimum severity: `none`.

A callback can run outside render or a different number of times, so React cannot preserve the Hook call order.

Default parameters: `{}`.

**Repair:** Move the Hook to the top level of the component or custom Hook and pass its result into the callback.

**Scope and limits:** Renaming the callback does not turn it into a component. Components passed to memo remain valid and are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React documentation, Rules of Hooks",
  "locator": "Only call Hooks at the top level",
  "paraphrase": "Hooks cannot be called inside callbacks passed to iterators, effects, timers, or promise handlers."
}
```
