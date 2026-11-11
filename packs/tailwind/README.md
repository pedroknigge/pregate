# tailwind

Data-only rule pack for Tailwind class hygiene in TSX. Source version **1.2.1**.
The engine parses TS/JS, so every rule matches syntax shapes in `.tsx` files; no
executable code, no resolvers, no config reads.

## Stance

Tailwind scans whole source files as text, not just `className` attributes.
Concatenated **fragments** can hide classes, but joined **complete literals** and
variables initialized with complete literal classes are visible. See
[detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files).
Checks that cannot distinguish these cases are advisory or off.

The contract is the repository preset, not this pack. Omit the methodology,
or turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or
`deny`). The key is `tailwind/TW-DYN-001`. `TW-STYLE-001` defaults to `warn`
because some values (custom properties, measured pixels) have no utility
equivalent; no rule in this pack currently defaults to `deny`.

## Rules

| ID | Flags | Why | Severity |
| --- | --- | --- | --- |
| `TW-DYN-001` | String concat (`+`) or `${}` interpolation inside a `className`/`class` attribute, or in the value of a `className`/`class` property. | Fragments may be invisible; complete literal utilities remain visible. | warn |
| `TW-IMP-001` | `!` important prefix in `className`. | Importance is supported but can complicate the cascade. | warn |
| `TW-HEX-001` | Hardcoded hex in a `className`/`class` string or a `cn`/`clsx` call (`bg-[#1a2b3c]`). | Arbitrary values are supported but may diverge from theme tokens. Data and non-class attributes are not class values. | warn |
| `TW-JOIN-001` | `[...].join(" ")` for classes. | Complete literal utilities in the array are still scanned. | off |
| `TW-VAR-001` | Bare `className={identifier}` or member variables. | The variable definition may contain literal classes elsewhere in source. | off |
| `TW-STYLE-001` | Inline `style={{}}` objects. | Style objects split styling into a second authority outside utilities. | warn |
| `TW-V4-001` | v3 utilities removed in v4 (`bg-opacity-*` and the other `*-opacity-*`, `flex-grow`, `flex-shrink`, `overflow-ellipsis`, `decoration-slice/clone`) in class strings. | v4 generates no CSS for them; on v3 they still work. | warn |
| `TW-SPACE-001` | A space inside an arbitrary value (`grid-cols-[1fr 2fr]`) in class strings. | The class list splits on spaces, so the value breaks; use `_`. | warn |

## Methodologies

- `tailwind/classes` — TW-DYN-001, TW-IMP-001, TW-HEX-001, TW-JOIN-001, TW-VAR-001, TW-STYLE-001, TW-V4-001, TW-SPACE-001

## Fixture coverage and limits

`pregate rules test packs/tailwind` runs **52** real fixtures (at least 2 pass + 2 fail +
1 trap per check). Literal-only class concatenation now passes because both
complete utilities are visible in the source. Traps cover coerced fragments,
multi-important strings, 3-digit hex, variable-array joins, CSS
module members, computed style keys, variant-prefixed removed utilities and
a spaced arbitrary value inside a `cva` variant. Known syntax the closed vocabulary
cannot decide — class-name ordering, duplicate utilities, safelist and darkMode
configuration, `@apply` — is backlog, not claimed coverage (see [BACKLOG.md](BACKLOG.md)).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.1`. 9 distinct check IDs.

Methodologies: `tailwind/classes` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
