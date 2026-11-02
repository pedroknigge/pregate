# Example presets

These are contracts, not rule sources. Test a pack with `rules test --library <ns>`
or `rules test packs/<ns>`. Do not point `rules test` at `packs/presets`.

These source recipes pin engine 0.0.2 and builtin core 0.0.1; that engine is
the published release. The [generated inventory](../../docs/packs.md) lists every source
and methodology. For a new project, prefer `pregate init --preview --preset <name>`:
it registers the bundled packs and proposes detected scope in one review. Manual
copies of recipes with path sources need those pack directories at the specified
paths before `preset compile`. Paths are relative to the project root. Compilation
does not grant consent, migrate a contract or approve a new policy.

The four language starters instead use versioned bundled sources and need no
copies. Prefer `pregate init --preview` for a new project: it recommends a starter
from actual files or Python/Go/Cargo metadata, selects only detected languages for
mixed projects and requests human review before writing the preset. Explicit
`--preset python-starter`, `go-starter`, `rust-starter` and `mixed-starter` are also supported.
All language starters observe in shadow; integrity remains enforced. Select
architecture/effects independently after declaring the intended layers.
Python and Go provide architecture and effects policies; Rust provides architecture.

The four framework examples (`react-spa`, `nextjs-fullstack`, `node-api`,
`vue-spa`) also start in shadow for calibration. Integrity remains enforced.
Inspect findings with `pregate audit`, review false positives and deliberately
choose per-rule enforcement before using these examples to block edits.

## Switching one rule

The preset's enforcement is the default. One rule moves independently with `overrides`. The key is the alias, `<ns>/<ALIAS>`, or a check ID for all its active aliases.

```json
"overrides": {
  "senior/SR-NEST-001": { "enforcement": "shadow" },
  "senior/SR-CHAIN-001": "warn",
  "senior/SR-BRACE-001": "off",
  "pstack/PS-COMMENT-001": {
    "enforcement": "enforce",
    "note": "Enforce this rule even if the preset default is shadow."
  }
}
```

- `deny` blocks when the rule's effective enforcement is `enforce`.
- `warn` reports and does not block, even while other rules deny.
- `off` removes the rule.
- `enforcement: "shadow"` on an override observes that ordinary rule's deny/ask findings without blocking. On the preset it sets the optional-rule default. An override can also select `enforce`. Core defaults enforce independently of recipe shadow; an integrity shadow override fails compilation. Unbound core requirements remain unverified, while adopted assertions require current evidence.

Omit an optional methodology from `methodologies` to drop its group. Omit its
source to remove a pack. Core activates automatically; dropping a core methodology
from this list does not disable the defaults. Use reviewed per-rule `off` overrides.

## Presets

| File | Sources beyond core | What it shows |
| --- | --- | --- |
| `senior-typescript-strict.json` | typescript, senior | Named exports, no framework-entry methodology. Nested ternaries, message chains and braceless `if` run in shadow. `fn.size` resolves to 40 lines. |
| `hexagonal-backend.json` | architecture, typescript | Core layers plus the architecture methodologies. Framework entries are not included. |
| `vibe-proof-production.json` | vibe-proof, clean-code, typescript | Selected secret/transport policies enforce. `console.log` runs in shadow. The optional clean-code pack checks empty catches. |
| `pstack-way.json` | pstack, typescript | Boundary, reader-load, proof, and idempotency, plus the typescript type rules. Narration comments run in shadow. |
| `framework-app.json` | typescript | Both export methodologies. `typescript/TS-DEFAULT-001` excludes the entry globs so named exports still apply everywhere else and pages still require a default export. Do not `resolve` `modules.default-export` to one alias: that disables the other check for the whole program. |
| `observe-only.json` | typescript | `"enforcement": "shadow"` observes optional rules; core defaults still enforce. |
| `solana-hackathon.json` | solana, typescript | Literal legacy-import denials and seven RPC/transaction/key-custody syntax warnings with documented flow limits. It selects no clean-code methodology. |
| `musk-algorithm.json` | musk | Elon Musk's 5-step engineering algorithm: owned suppressions, deletion of pass-through catches, guard clause simplification, non-blocking I/O acceleration, and automated test protection. |
| `human-maintainability.json` | maintainability | Future human maintainability & software engineering invariants: control-flow nesting depth <= 2, positive boolean naming, domain naming on exported declarations, and empty interface elimination. |
| `react-spa.json` | typescript, react, tailwind | React single-page app: strict types plus export discipline, hooks/components rules, and scannable Tailwind classes. |
| `nextjs-fullstack.json` | typescript, nextjs, prisma, authjs | Next.js App Router fullstack: routing/rendering rules, Prisma client safety, and Auth.js config/session contracts. Entry files keep their default-export exclusion. |
| `node-api.json` | typescript, node, express, postgres | Node API: runtime discipline, Express middleware/request contracts, and pg client safety. |
| `vue-spa.json` | typescript, vue, tailwind | Vue single-page app: strict types plus export discipline, Composition API rules, and scannable Tailwind classes. |
| `python-starter.json` | bundled python | Python quality observations, including function parameters/size, nesting, declared public methods and bare exceptions. |
| `go-starter.json` | bundled go | Go quality observations, including grouped function parameters, size, nesting and dot imports. |
| `rust-starter.json` | bundled rust | Rust quality observations for functions, closures, nesting, wildcard imports and mutable statics. Source-only checks do not expand macros. |
| `mixed-starter.json` | bundled python, go, rust | Independent Python/Go/Rust quality dimensions plus optional JS/TS clean-code observations. Initialization selects the languages detected in the project. |

`resolve` is how a dimension with two active answers picks one.
`senior-typescript-strict` and `hexagonal-backend` select the optional clean-code
`CC-FN-001` function-size budget with `max` 40. A chosen budget is a project policy,
not a language-independent core invariant.
