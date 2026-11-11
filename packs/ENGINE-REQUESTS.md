# Engine requests

Evaluation of the gaps found while building this library, current as of engine 0.0.7. See
[architecture decisions O52–O56, O68–O73](../docs/ARCHITECTURE.md).

## 1. Per-rule shadow

**Implemented.** `preset.enforcement` is the default; an override can set
`enforcement: "enforce"` or `"shadow"` for an active alias or check. Severity stays
independent (`deny`, `ask`, `warn`, `off`). Integrity always enforces and an
integrity shadow override fails compilation. Example:

```json
"overrides": {
  "pstack/PS-COMMENT-001": { "enforcement": "shadow" }
}
```

The reverse works too: a shadow preset can enforce selected rules. Effective
aliases of one check must agree on enforcement, or explicitly resolve the
conflict. The lock records each rule's policy and origin. Hook, Stop, check and
commit share it; reports preserve policy at the time of each finding. Example
presets now use shadow instead of the earlier warn/off workarounds.

## 2. Same dimension, different checks

**Implemented.** Checks and packs declare explicit rule interactions
(`contradicts`, `complements`, `supersedes`). When a preset activates two checks
that contradict each other on overlapping file globs, compilation fails until
`resolve` selects a winner or an override (`paths` / `exclude`) separates their
file scopes (as `packs/presets/framework-app.json` does for
`typescript/named-exports` and `typescript/framework-entries`).

## 3. Pattern checks cannot branch on a param

**Open.** No pack requires runtime pattern templating. A second check with explicit
file scope keeps the matcher deterministic and auditable. Parameterized patterns
need a defined substitution/type-validation contract and new trap fixtures;
adding interpolation without that would widen the language speculatively.

A pattern is fixed text. A policy choice such as "enums are allowed in tests" cannot be a param the pattern reads. The only knobs are `paths`, `exclude`, and the metric params the primitive already has. A second stance needs a second check, which then uses `contradicts` / `exclude` if they share a dimension.

## 4. "File does not contain X"

**Supported with existing primitives.** Use a `program` pattern with `not` and
explicit `files` globs. `typescript/framework-entries` already demonstrates this
with two pass, two fail and one trap fixture. A repo-specific port requirement
must likewise declare which modules are ports. No new engine primitive is needed.

The pattern engine matches nodes. The only way to say a file lacks a form is `kind: program` with `not`, which reports a hit on every file that lacks it. `typescript/framework-entries` does that and stays safe only because its `files` globs are the entry points. A general "this module must export a port" rule would flag the whole repository.

## 5. Counts beyond the four metrics

**Open.** No admitted rule here needs another count: `senior/SR-WIDE-001` explicitly
measures public methods. Imports, fields and statements each need precise counting
semantics (including type-only imports, aliases and accessors) and real traps
before a new metric is justified. Keep these candidates in the pack backlogs.

`metric` is `fn.lines`, `fn.params`, `class.publicMethods`, or `control.nesting`. A threshold on anything else (imports per file, statements per block, public fields that are not methods) cannot be expressed without a new primitive. `senior/SR-WIDE-001` uses `class.publicMethods` for that reason.

## 6. Security-audit gaps outside source grammars

**Open.** Found while deriving the [security-audit pack](security-audit/README.md). Each item stays in that pack's [backlog](security-audit/BACKLOG.md) until the engine can express it.

- **Python pattern metavariables.** A Python `pattern` cannot hold `$NAME` because `$` does not parse in the Python grammar (ast-grep substitutes an expando character). Without it a rule cannot require that a compared name is the one assigned from `os.environ` in the same function; `security-audit` SA-COMPARE-001 falls back to naming.
- **YAML grammar.** GitHub Actions risks are exact forms in YAML: a `pull_request_target` trigger that checks out the pull request head, `${{ github.event.* }}` interpolated into a `run:` script, a `uses:` reference not pinned to a commit SHA, and `permissions: write-all`. Pattern grammars are TypeScript, Python, Go and Rust only.
- **Forbidden path present.** A committed `.env`, `*.pem` or private key file is a fact about the tree, not about a node. A primitive that reports a matching path (with reviewed `exclude` for samples such as `.env.example`) would cover it.
- **One-hop alias taint.** Request sinks (redirect, path, SSRF) usually receive a local variable assigned from `req.query`, `req.params` or `req.body` one statement earlier. Matching only the direct expression misses that form; matching every variable flags internal calls. A bounded "assigned from X in the same function" matcher would make these rules precise enough to admit.
- **Go and Rust strings in `credential-literal`.** `src/credential-literal.ts` inspects `string`, `template_string` and `comment` nodes. Go literals are `interpreted_string_literal` and `raw_string_literal`; Rust literals are `string_literal`. Credentials in Go and Rust strings are therefore only found in comments.
