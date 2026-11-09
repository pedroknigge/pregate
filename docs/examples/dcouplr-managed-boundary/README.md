# Enforce dcouplr at a project boundary

The library cannot infer which project modules must use dcouplr. Declare that
boundary once. This example makes `app/features/**` managed code, admits only
port imports there, and keeps concrete construction at `app/bootstrap/**`.
`app/values/**` is its own layer, so a value module is named and is not managed code. Pure values there can use local constructors. The selected
strict construction rule is a project policy, not a claim that every `new`
expression violates dcouplr.

The [request](request.json) is for a preset with `sources` and `methodologies`
arrays, an `overrides` object, and no existing dcouplr selection or layer map.
It intentionally replaces the layer map. Adapt the exact directories, allowed
edges and pinned pack version to the current project. For an existing map,
merge its layers in the proposal instead of replacing them. Preserve approved
exclusions and narrow any explicit value-only exception by path.

```sh
pregate preset show --json
pregate preset apply docs/examples/dcouplr-managed-boundary/request.json --preview
```

Review one proposal and use the displayed human digest approval command. Then
run `pregate audit --plan --json`. The default no-new ratchet preserves existing
debt; choose refactoring targets from the audit instead of disabling protection.
The request leaves other selected rules and core requirements active. It does
not prove actual registration, lifecycle or tenant ownership. Add the relevant
project fitness methods and reviewed verifiers for those behaviors.

The regression test compiles this exact request and checks valid injected
components, direct construction, ambient effects, runtime-locator imports and
invalid adapter edges outside the default `src/` layout. Separate pinned-source
canaries exercise one immutable factory alias; multiple, imported, mutable and
cross-scope aliases remain explicit static-analysis limits.
