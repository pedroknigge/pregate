# tailwind pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.1`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## tailwind/classes

Manifest version: `1.2.1`. Status: **complete**.

### tailwind/TW-DYN-001

Check: [`tailwind/classes/no-dynamic-class-concat@1.0.1`](checks/classes/no-dynamic-class-concat/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.no-dynamic-class-concat`. Minimum severity: `none`.

Constructing fragments can hide utility candidates, but concatenating complete literal class names leaves those candidates visible to the scanner.

Default parameters: `{}`.

**Repair:** Write the full class names as literals, or pass literals to clsx/cn with a boolean condition.

**Scope and limits:** clsx with a prebuilt dynamic string is still dynamic. Only literal arguments count. The expression must be inside a className or class attribute, or the value of a className or class property. A string built in a helper function or a variable and passed in later is not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS documentation, content configuration",
  "locator": "automatic content detection",
  "paraphrase": "The content scanner only sees full class names written literally in source files. Concatenated or interpolated fragments are invisible to it, so the utilities are never generated."
}
```

### tailwind/TW-IMP-001

Check: [`tailwind/classes/no-important-modifier@1.0.0`](checks/classes/no-important-modifier/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.no-important-modifier`. Minimum severity: `none`.

Important utilities paper over specificity conflicts instead of fixing them, and each one raises the cost of the next override.

Default parameters: `{}`.

**Repair:** Remove the ! prefix and reorder the utilities or restructure the selectors so the cascade resolves the conflict.

**Scope and limits:** Moving the bang behind a variant prefix (md:!) is still the important modifier.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS documentation, important modifier",
  "locator": "making utilities important",
  "paraphrase": "Prefixing a utility with ! forces it to win by importance instead of by the cascade the design system relies on."
}
```

### tailwind/TW-HEX-001

Check: [`tailwind/classes/no-arbitrary-hex@1.0.0`](checks/classes/no-arbitrary-hex/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.no-arbitrary-hex`. Minimum severity: `none`.

One-off hex values scatter the palette across files, so a rebrand or dark-mode pass has to hunt down literals instead of changing tokens.

Default parameters: `{}`.

**Repair:** Replace the hex with the closest theme color utility, or add the color to the theme and use its token.

**Scope and limits:** Shortening the hex to 3 digits does not make it a token. bg-[red] without a hex is the named escape hatch, not this pattern. A hex in stored data, a theme-color meta value, or any string outside a className or class attribute and outside a clsx, cn, cx, classnames, twMerge, twJoin, cva or tv call is not an arbitrary class value.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS documentation, theme and arbitrary values",
  "locator": "theme colors versus arbitrary values",
  "paraphrase": "Colors belong in the theme so every surface shares one palette. A hardcoded hex in an arbitrary value bypasses the theme and forks the palette."
}
```

### tailwind/TW-JOIN-001

Check: [`tailwind/classes/no-array-join@1.0.0`](checks/classes/no-array-join/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.no-array-join`. Minimum severity: `none`.

The call shape cannot distinguish full utility literals (safe) from fragments (unsafe).

Default parameters: `{}`.

**Repair:** Replace the array and .join with a clsx/cn call whose arguments are full class literals.

**Scope and limits:** Joining an array of pure literals is still a join. The scanner contract is on the call shape, not the contents.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS documentation, content configuration",
  "locator": "dynamic class construction",
  "paraphrase": "Tailwind scans source text. Complete class literals remain detectable even when an array joins them at runtime."
}
```

### tailwind/TW-VAR-001

Check: [`tailwind/classes/no-bare-class-variable@1.0.0`](checks/classes/no-bare-class-variable/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.no-bare-class-variable`. Minimum severity: `none`.

A reference alone cannot prove a missing utility; the variable may hold full literal class names visible elsewhere in source.

Default parameters: `{}`.

**Repair:** Inline the literal classes at the call site, or wrap them in clsx/cn with literal arguments.

**Scope and limits:** A member expression such as styles.card or props.className is still fully dynamic to the scanner.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS documentation, content configuration",
  "locator": "dynamic class names",
  "paraphrase": "The content scanner reads the entire source file, including definitions of class-name variables."
}
```

### tailwind/TW-STYLE-001

Check: [`tailwind/classes/no-style-prop@1.0.0`](checks/classes/no-style-prop/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.no-style-prop`. Minimum severity: `none`.

A style object bypasses the theme, variants, and content pipeline, so the rule it encodes cannot respond to design tokens or breakpoints.

Default parameters: `{}`.

**Repair:** Replace the style object with the matching utility class; keep style only for values utilities cannot express.

**Scope and limits:** A computed custom-property key is still an inline style object, not a utility.

**Interactions when active together:**

- Works against the conventions of `react-native`: React Native styles components through the style prop; without NativeWind there is no className to move the style into. Settle: Turn TW-STYLE-001 off for React Native code, or adopt NativeWind and keep it.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS documentation, utility-first workflow",
  "locator": "inline styles versus utilities",
  "paraphrase": "Styling belongs in utilities so spacing, color, and responsive behavior stay in one system. Inline style objects split the design into two authorities."
}
```

### tailwind/TW-V4-001

Check: [`tailwind/classes/no-removed-v3-utility@1.0.0`](checks/classes/no-removed-v3-utility/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.no-removed-v3-utility`. Minimum severity: `none`.

Tailwind v4 generates no CSS for these names, so the element silently loses its opacity, flex sizing or truncation.

Default parameters: `{}`.

**Repair:** Use the color opacity modifier (bg-black/50, text-white/75), grow and shrink, text-ellipsis, or box-decoration-slice and box-decoration-clone.

**Scope and limits:** Only string literals inside className or class attributes and clsx, cn, cx, classnames, twMerge, twJoin, cva or tv calls are read; variant and ! prefixes are included. backdrop-opacity-*, opacity-*, grow and shrink pass. Warn only: on Tailwind v3 these names still work.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS v4 upgrade guide, https://tailwindcss.com/docs/upgrade-guide",
  "locator": "Changes from v3: removed deprecated utilities",
  "paraphrase": "v4 removes utilities deprecated in v3: bg-, text-, border-, divide-, ring- and placeholder-opacity-*, flex-shrink-*, flex-grow-*, overflow-ellipsis and decoration-slice/clone. Use opacity modifiers like bg-black/50, shrink-*, grow-*, text-ellipsis and box-decoration-slice/clone."
}
```

### tailwind/TW-SPACE-001

Check: [`tailwind/classes/no-space-in-arbitrary-value@1.0.0`](checks/classes/no-space-in-arbitrary-value/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.no-space-in-arbitrary-value`. Minimum severity: `none`.

Class lists split on whitespace, so grid-cols-[1fr 2fr] becomes the two invalid classes grid-cols-[1fr and 2fr] and no style is generated.

Default parameters: `{}`.

**Repair:** Replace each space inside the brackets with an underscore, for example grid-cols-[1fr_2fr] or w-[calc(100%-2rem)]. Use \_ for a literal underscore.

**Scope and limits:** Only string literals inside className or class attributes and clsx, cn, cx, classnames, twMerge, twJoin, cva or tv calls are read. Brackets in titles, labels and other strings pass. Values split across a template substitution are not seen.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS documentation, adding custom styles, https://tailwindcss.com/docs/adding-custom-styles",
  "locator": "Handling whitespace",
  "paraphrase": "When an arbitrary value needs a space, use an underscore instead and Tailwind converts it to a space at build time."
}
```

### tailwind/TW-EMPTY-001

Check: [`tailwind/classes/no-empty-class-value@1.0.0`](checks/classes/no-empty-class-value/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `tailwind.empty-class`. Minimum severity: `none`.

An empty className="" or class="" attribute leaves dead markup in the rendered DOM and usually signals an incomplete refactor or missing utility string.

Default parameters: `{}`.

**Repair:** Delete the empty className/class attribute, or add the intended Tailwind utility classes.

**Scope and limits:** Only literal empty strings ("" or '') directly in className/class or wrapped in braces className={""} are matched. Dynamic expressions like clsx(...) pass.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Tailwind CSS documentation, Styling with utility classes (https://tailwindcss.com/docs/styling-with-utility-classes)",
  "locator": "Applying utility classes in markup",
  "paraphrase": "Utility classes style elements directly in className or class attributes; an empty class literal emits an unused empty DOM attribute with no utilities."
}
```
