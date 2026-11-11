# tailwind backlog

Candidate rules the current pack does not claim. Each needs judgment, preset
configuration, a richer grammar, or regex features the engine rejects — so each
stays a candidate until that capability exists.

## Candidates

- **Class order judgment.** Whether `p-4 text-sm` should read `text-sm p-4`
  follows a convention (e.g. prettier-plugin-tailwindcss), not an invariant the
  syntax tree can decide. Order carries no scanner meaning; enforcing one order
  is formatter territory.
- **Duplicate utilities need backrefs (unsupported).** Flagging `p-4 ... p-4`
  inside one class list requires matching a repeated token, i.e. a backreference
  (`\1`). The engine's Rust-subset regex rejects backreferences, so duplicates
  stay unclaimed rather than half-matched.
- **Safelist configuration.** Whether a dynamic class is safe depends on the
  `safelist` in `tailwind.config`, which lives outside any `.tsx` file the
  engine parses. Without the preset naming the safelist, a dynamic class the
  config covers would be a false positive.
- **darkMode configuration.** Whether `dark:` variants do anything depends on
  the `darkMode` strategy (`media` vs `class`) in the Tailwind config. The
  syntax shape is identical either way, so variant policy needs preset
  knowledge, not a pattern.
- **`@apply` is CSS grammar.** `@apply` directives live in `.css` files, which
  have no TypeScript language pack in this engine. Until a CSS grammar exists,
  `@apply` misuse (unknown utilities, ordering, nesting) is out of scope.

## Limits of the shipped rules

The eight shipped checks match syntax shapes in one `.tsx` file. They cannot
resolve imported values, read `tailwind.config`, or prove what a variable holds
at runtime. `clsx`/`cn` calls with non-literal arguments, aliased join methods
(`const j = parts.join; j(" ")`), and template literals without substitutions
(`className={`p-4 text-sm`}`) are known holes documented here rather than
claimed coverage.

`TW-DYN-001` matched a concatenation under any ancestor whose text contained
`className`, which included a function named `classNames` and a whole component.
All five sampled findings on the public corpus were false. Since pack 1.2.1 the
expression must be inside a `className`/`class` attribute or the value of a
`className`/`class` property. The pattern cannot name JSX node kinds in the
TypeScript grammar, so the attribute is found by its text (`className={`). A
class string built in a variable or a helper and passed to the attribute later
is not matched: that needs value flow.
