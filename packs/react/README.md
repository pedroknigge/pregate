# react

React syntax policies and bounded heuristics; see default severities and limitations below. The stance of this pack is: Hooks run unconditionally at the top level; effects stay synchronous and render stays pure; components are defined once at module scope; list keys identify the item; external tabs cut opener access; and props are typed at compile time, not checked at runtime. Legacy escapes (string refs, PropTypes) have typed replacements — use them.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `react/REACT-HOOK-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `REACT-HOOK-001` | A Hook call (`useX`) inside an if, loop, or conditional expression. | A Hook inside a branch runs on some renders and not others, so every Hook after it reads the wrong slot. | deny |
| `REACT-CALLBACK-001` | Hook calls inside array iterator, effect, timer, or promise callbacks. | Callbacks do not have a stable render order; components passed to `memo` still pass. | deny |
| `REACT-EFFECT-001` | A direct async callback or its immediately invoked promise passed to `useEffect` or `React.useEffect`. | A Promise does not satisfy the synchronous setup/cleanup callback contract. Nested async helpers and dependency-array values do not make the callback async. | deny |
| `REACT-RENDER-001` | A `setX` call inside a function declaration, outside a nested arrow or function expression. | This heuristic cannot resolve setter bindings or distinguish valid convergent updates during render. | off |
| `REACT-KEY-001` | `key={index}` (or `i`/`idx`), including call-wrapped forms like `key={String(index)}`. | An index key makes React match the wrong item after a reorder, so inputs keep stale values. | deny |
| `REACT-NEST-001` | An uppercase local function/arrow with actual JSX, nested in an uppercase function declaration with its own JSX. | Bounded syntax slice of unstable nested component identity. | deny |
| `REACT-REF-001` | A legacy string ref (`ref="panel"` or `ref={'panel'}`). | String refs break under composition and minification, and the checker cannot type them. | deny |
| `REACT-BLANK-001` | `<a target="_blank">` without a `rel` attribute. | The opened page gains opener access and can redirect the original tab to a lookalike. | deny |
| `REACT-PROP-001` | The `prop-types` package and `X.propTypes` assignments. | Runtime checks miss every caller the compiler could have stopped. | deny |
| `REACT-ROOT-001` | `render`, `hydrate`, `unmountComponentAtNode` or `findDOMNode` imported from `react-dom` or called on its default/namespace import. | React 19 removed them; mount with `createRoot`/`hydrateRoot` and use refs. | deny |
| `REACT-JSURL-001` | A literal `javascript:` URL in `href` or `src`, any case, quoted, braced or templated. | React blocks these URLs; the link only throws. | deny |
| `REACT-FIELD-001` | `<input>`/`<textarea>`/`<select>` with `value`, or `<input>` with `checked`, and no `onChange`, `onInput`, `readOnly`, `disabled` or prop spread. | React renders the field read-only and reverts every edit. | deny |
| `REACT-CONSUMER-001` | Rendering a legacy `<Context.Consumer>` JSX element. | Read context with `useContext(Context)` or `use(Context)` instead of render-prop consumers. | warn |
| `REACT-LIFECYCLE-001` | Declaring removed legacy lifecycle methods (`componentWillMount`, `componentWillReceiveProps`, `componentWillUpdate` and `UNSAFE_` variants). | Legacy `componentWill*` lifecycles are unsafe under concurrent rendering; migrate to `componentDidMount`, `componentDidUpdate`, `getDerivedStateFromProps`, or hooks. | deny |

## Methodologies

- `react/hooks` — REACT-HOOK-001, REACT-CALLBACK-001, REACT-EFFECT-001, REACT-RENDER-001
- `react/components` — REACT-KEY-001, REACT-NEST-001, REACT-REF-001, REACT-BLANK-001, REACT-PROP-001, REACT-ROOT-001, REACT-JSURL-001, REACT-FIELD-001, REACT-CONSUMER-001, REACT-LIFECYCLE-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

Source 1.0.2 distinguishes actual JSX structure
from comparisons and markup strings. Plain helpers and lowercase render callbacks
remain allowed; existing nested-component violations remain blocked. The checker
does not resolve runtime component identity or outer arrow components. See
[React's state/identity explanation](https://react.dev/learn/preserving-and-resetting-state)
and the rule's exact scope before adopting blocking policy.

A synchronous effect may declare an async loader, invoke it and return cleanup.
The effect rule checks its direct first argument, including transparent wrappers;
it does not scan nested callback bodies for the word async. Repo recommendations
are scoped to package manifests that declare React, with nested unrelated owners
excluded. Reviewed user paths and exclusions remain authoritative. Cross-file
Hook aliases, callback return flow and lifecycle correctness need stronger project
evidence. The reported-case controls
record the distinction.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 14 distinct check IDs.

Methodologies: `react/components` (complete), `react/hooks` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
