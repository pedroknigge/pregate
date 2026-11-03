# Discover and compose rule packs

Packs expose independently selectable methodologies and invariants. These commands
compose the existing preset format; they do not rewrite pack internals or require
a new configuration format. All contract changes are validated against fixtures.

## Inspect before selecting

```sh
pregate pack list
pregate pack list --library
pregate pack list --library --category language
pregate pack show --library python/quality --json
pregate rules test --library python
pregate pack list --json
pregate pack show --library clean-code/clean-code
pregate pack show --library clean-code/clean-code --json
pregate pack show --path docs/examples/docs-to-pack --json
```

`list` summarizes registered sources and their methodologies. `show` includes
invariant IDs, defaults, provenance and checker definitions in JSON. `show --path`
also works before project initialization, as do `list --library`, `show --library`
and `rules test --library <ns>`. The [generated inventory](../packs.md) lists all
bundled packs, categories, checks and methodology IDs, including Python, Go and Rust.
`--category` filters list results; category metadata does not activate policy.
Discovery validates schemas, namespaces
and references; it does not run fixtures or certify precision. The working-tree engine
analyzes JS/TS, Python, Go, and Rust. `rules test` runs fixtures and `preset show` explains effective
policies, including overrides, shadow and ownership. A selected methodology can
still contain disabled rules.

## Add a bundled, local or pinned source

From an initialized consuming project, inspect the proposed addition:

```sh
pregate pack add --library python --preview
# Or use an authored local pack:
pregate pack add --path docs/examples/docs-to-pack --preview
```

Bundled sources need no network or copied files. They pin namespace/version and
the lock records their evaluable content hash separately from builtin core.
Fixtures are embedded and validated before approval. A binary with a different
bundled version rejects the old pin; review `pack update <ns> --preview` to adopt
its version. No source update silently changes the contract.

The path is resolved from the command's working directory and recorded relative
to the project root. Keep shared local packs in the consuming repository so other
users can resolve them. Local sources are verified against the compiled lock;
changing their check or methodology data requires recompilation and review.

A published Git repository must have `source.json` at its root:

```sh
pregate pack add https://github.com/<owner>/<pack>.git@<tag-or-commit> --preview
```

Git imports resolve the ref to an immutable commit and content hash, validate
fixtures and cache data. `--preview` may populate that cache and save a pending
proposal, but it does not change the project's preset, lock or local consent.
An already registered namespace is rejected rather than overwritten. Adding a
source alone does not activate its methodologies.

Read the displayed diff, then type its exact human command inside the harness:

```text
! pregate approve <displayed code>
```

The proposal expires in 24 hours. Changing the preset, lock or evaluable source
data invalidates the reviewed candidate. See [approval in the harness](approval-in-harness.md)
for protocol boundaries and outstanding runtime verification.

## Select a methodology or individual invariants

```sh
pregate pack enable docs-demo/migration --preview
pregate pack enable typescript/strict-types --only TS-SWITCH-001 --preview
```

The second example requires the `typescript` source to be registered first.
`--only` accepts bare invariant IDs or their namespace-qualified IDs and rejects
unknown or empty selections. It selects the methodology and sets its other
invariants to `off`. Reselecting a previously disabled invariant restores its
declared severity while preserving parameter, enforcement and note overrides.
An explicit check-wide `off` remains in place for other aliases. An invariant
whose declared severity is `off` remains off until its severity is reviewed.

Without `--only`, enabling a methodology preserves its existing overrides. It
does not erase custom limits or previously disabled optional rules. All core rules
activate automatically; removing a core methodology selection does not disable it.
Core enable restores explicitly disabled aliases, and --only proposes individual
selection through off overrides. Core enforces unless explicitly disabled in a
reviewed contract; its builtin source cannot be removed.

Every candidate is compiled before approval. Conflicting singleton check
parameters or severities are reported with the compiler's `resolve`/override
diagnostics; no rule wins silently. Existing dimension resolutions can also
exclude a newly selected alias; review those diagnostics and propose the intended
resolution explicitly.

Different checks can still interact, so each rule declares the rules it
interacts with when both are active (`relations` in its methodology manifest).
There are three kinds:

- `contradicts`: following one rule's repair violates the other, as with
  `typescript/TS-THROW-001` and `trpc/TRPC-ERR-001`. The candidate does not
  compile until the preset records the reviewed decision, or one rule is
  turned off:

  ```json
  "settled": [{ "rules": ["trpc/TRPC-ERR-001", "typescript/TS-THROW-001"],
    "note": "TS-THROW-001 excludes **/routers/**; tRPC owns those throws." }]
  ```

- `duplicates`: both rules report the same code, as with `clean-code/CC-FN-002`
  and `mattpocock/MP-PARAMS-001`. This compiles, and the settle text names the
  `resolve` or override that keeps one report.
- `idiom`: the rule works against the conventions of an active pack namespace,
  as with `typescript/TS-AWAIT-001` and Next.js server actions. This compiles,
  and the settle text names the exclude to add.

Active interactions are recorded in the lock's `relations`. They are listed by
`pregate preset show` and in the change review, together with their settle text
or the preset's `settled` note. Each pack's `REFERENCE.md` lists them per rule.
Relations cover interactions the pack authors reviewed. They do not prove that
two undeclared rules are compatible. Removing a pack also removes the `settled`
entries that name its rules.

After approving, inventory existing debt and inspect the effective policy:

```sh
pregate preset show
pregate audit --json
```

## Disable, remove or update deliberately

```sh
pregate pack disable docs-demo/migration --preview
pregate pack remove docs-demo --preview
pregate pack update my-published-pack --preview
```

Disabling removes the methodology selection and references that no remaining
methodology uses. For core, disable writes explicit off overrides because core
methodologies activate automatically. Removing an optional pack also unregisters its source and methodologies; it
preserves authored local files and cached Git objects. Shared check overrides and
unrelated policies remain. The review shows removals and any weaker coverage.

`update` adopts the current bundled version for library sources, or explicitly
fetches upstream `HEAD` for Git sources. It rejects a namespace change and validates the entire resulting contract before
approval. Pinned contracts never update automatically. Source changes during
approval are revalidated; a changed candidate is rejected.

All modifying commands retain a direct human terminal prompt when `--preview` is
omitted. A human can use `--yes` for automation. `--yes` and `--preview` cannot be
combined. Agents can inspect and prepare literal `--preview` commands through the
shell guard; ordinary agent shell calls cannot apply or self-approve the contract.
