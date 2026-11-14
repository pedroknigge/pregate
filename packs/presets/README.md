# Example presets

These are contracts, not rule sources. Test a pack with `rules test --library <ns>`
or `rules test packs/<ns>`. Do not point `rules test` at `packs/presets`.

These source recipes pin engine 0.0.10 and builtin core 0.0.1; that engine is
the published release. The [generated inventory](../../docs/packs.md) lists every source
and methodology.

## Init and guide presets

`pregate init`, `pregate guide`, and `guide --preview --preset <name>` accept only:

`backend-clean-ddd`, `functional-ts`, `legacy-safe`, `integrity-only`,
`python-starter`, `go-starter`, `rust-starter`, `mixed-starter`.

For a new project, prefer `pregate init --preview` or `pregate guide --preview`:
they register bundled packs and propose detected scope in one review. Explicit
`--preset` uses one of the names above.

The three catalog recipes (`backend-clean-ddd`, `functional-ts`, `legacy-safe`)
live in `catalog/presets/`. Language starters are bundled and need no local copies.

Manual copies of other recipes with path sources need those pack directories at the
specified paths before `preset compile`. Paths are relative to the project root.
Compilation does not grant consent, migrate a contract or approve a new policy.

## Example recipes (manual apply)

The JSON files below are reference contracts. They are **not** accepted by
`init --preset` or `guide --preset` until wired into the catalog. To use one,
copy it into `.pregate/preset.json` (adjust path sources), compile with
`pregate preset compile`, and complete the normal human approval flow—or submit
the candidate through `preset apply <request.json> --preview`.

Framework-oriented examples (`react-spa`, `nextjs-fullstack`, `node-api`,
`vue-spa`, `hexagonal-backend`, and the rest of this table except the init
names) start in shadow for calibration unless the file sets another default.
Integrity remains enforced. Inspect findings with `pregate audit`, review false
positives and deliberately choose per-rule enforcement before using these examples
to block edits.

## Switching one rule

The preset's enforcement is the default. One rule moves independently with `overrides`. The key is the alias, `<ns>/<ALIAS>`, or a check ID for all its active aliases.

```json
"overrides": {
  "senior/SR-NEST-001": { "enforcement": "shadow" },
  "senior/SR-CHAIN-001": "warn",
  "senior/SR-BRACE-001": "off",
  "pstack/PS-COMMENT-001": {
    "enforcement": "enforce",
    "note": "enforce this rule even if the preset default is shadow."
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

## Init and guide preset files

| File | Sources beyond core | What it shows |
| --- | --- | --- |
| `backend-clean-ddd.json` | architecture, clean-code, ddd, testing, typescript | Catalog DDD + clean architecture starter (detected layered backends). |
| `functional-ts.json` | clean-code, architecture, testing, typescript | Catalog functional-core / imperative-shell starter. |
| `legacy-safe.json` | clean-code, testing, typescript | Catalog minimal TypeScript starter. |
| `integrity-only.json` | (none) | Core integrity only; no optional packs. |
| `python-starter.json` | bundled python | Python quality observations. |
| `go-starter.json` | bundled go | Go quality observations. |
| `rust-starter.json` | bundled rust | Rust quality observations. |
| `mixed-starter.json` | bundled python, go, rust | Detected language starters plus optional JS/TS clean-code observations. |

## Example recipe files

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

`resolve` is how a dimension with two active answers picks one.
`senior-typescript-strict` and `hexagonal-backend` select the optional clean-code
`CC-FN-001` function-size budget with `max` 40. A chosen budget is a project policy,
not a language-independent core invariant.
