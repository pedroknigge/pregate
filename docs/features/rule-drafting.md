# Turn a correction into a rule

Included in 0.0.9. `rules draft` covers the
case the feedback commands do not: no rule fired, the agent wrote something a
reviewer rejected, and the team wants that mistake to be impossible next time.
`feedback`, `dispute` and `issue` handle the opposite case, a rule that was wrong.

For many rules at once, written as prose in an instruction file such as
`AGENTS.md`, use `pregate compile`: it sorts the file's statements, and
`compile apply <proposals.json> --preview` stages the rules an agent proposed
with failing and passing code, as one review. It uses the drafting described
here, and it refuses a pattern that is only the example's own text. See
[instruction files to rules](agent-proposed-contract.md#compile-an-instruction-file).

## One sentence, one review

`rules add` is the short path from a team rule to an active one:

```sh
pregate rules add "domain must not import infra"
pregate rules add "UI components must not call fetch"
pregate rules add "no moment" --fail 'import moment from "moment";' --pass 'export const t = Date.now();'
```

1. It first looks for a bundled catalog rule that says the same thing for the
   project's languages. A rule matches only when it mentions every content word of
   the sentence, at least two of them in what it checks (its IDs and message). The
   review names the match and up to two alternatives (`--rule <ns/ID>`). `--draft`
   skips the catalog. A rule that is already active is reported and nothing changes.
2. Otherwise it drafts a check into `.pregate/packs/project` (namespace `project`,
   methodology `project/corrections`). Three TypeScript sentence shapes need no code:
   `<from> must not import <to>` (any module specifier under `<to>`, scoped to a
   `<from>` folder), `never import <package>` (the package and its subpaths) and `[<subject>] must not call|use <callee>` (scoped to the
   subject's folder when one exists). Any other rule needs `--fail` and `--pass` code;
   variants are generated until the check has two fails, a trap and two passes.
   `--files <glob>` scopes the rule. Every generated case must pass `rules test`
   before anything is staged.

Either way the result is one digest-bound review of the preset and pack files.
Nothing is written before the human approves, and the approval commit includes the
pack folder with the preset and lock, so teammates never compile a stale lock.
`rules add` takes no `--yes`. An identical rerun keeps the pending approval code.
Python intent templates are not drafted from a sentence alone yet; give
`--fail`/`--pass` code for Python rules.

## One correction, one check

Keep the rejected and the corrected code as files (TypeScript/JavaScript, Python,
Go or Rust — language is inferred from the `--fail` file extension), and either
write a declarative pattern or omit `--pattern` (or pass `--pattern auto`) so
PREGATE synthesizes an AST pattern that matches every `--fail` and `--trap` and no
`--pass`. Synthesis tries the general shapes first (the callee under any receiver,
then the exact callee, then the imported module), preferring those that name a word
of the check name or message, and only then the literal single-line nodes; it
prints the chosen `Pattern:`. `--files <glob>` scopes the new check and places its
fixtures under that scope:

```json
{ "rule": { "kind": "@call", "has": { "field": "function", "regex": "^(window\\.|globalThis\\.)?fetch$" } } }
```

```sh
pregate rules draft rules/team net/no-raw-fetch --pattern rule.json \
  --message "{symbol} calls fetch directly; use the api client." \
  --why "The api client owns auth, retries and timeouts." \
  --fix "Call api.get or api.post from src/api." \
  --fail src/bad.ts --pass src/good.ts

# Or synthesize the distinguishing AST pattern automatically from --fail and --pass:
pregate rules draft rules/team net/no-raw-fetch --pattern auto \
  --message "{symbol} calls fetch directly; use the api client." \
  --why "The api client owns auth, retries and timeouts." \
  --fix "Call api.get or api.post from src/api." \
  --fail src/bad.py --pass src/good.py
```

Declarative patterns support cross-language semantic `kind` aliases (`@fn`, `@call`,
`@import`, `@loop`, `@branch`, `@class`, `@return`, `@throw`) across TypeScript/JS,
Python, Go and Rust, as well as lexical `scope` predicates (`"local"`, `"module"`,
`"parameter"`, `"unshadowed"`).

The correction is the proof. The command evaluates the pattern on both files
before writing: it refuses a pattern that misses the rejected file or reports the
corrected one. The lines it reports become the fixture's expected violations.

It writes a data-only pack under `rules/team`: `source.json`, the check, its
fixtures and a `team/corrections` methodology with the alias `TEAM-NO-RAW-FETCH`.

## Complete the evidence

A check needs at least two pass, two fail and one trap fixture, like every other
pack check. Each run adds cases and prints what is still missing:

```sh
pregate rules draft rules/team net/no-raw-fetch --fail src/bad2.ts --pass src/good2.ts
pregate rules draft rules/team net/no-raw-fetch --trap src/trap.ts --trap-note "window.fetch is the same raw call."
```

A trap is real code that dodges the wording of the rule but must still fail.
When the draft reports complete, `pregate rules test rules/team` passes.

## Activation stays human

A new folder is inactive until you adopt it through the normal review, which also
selects its `team/corrections` methodology:

```sh
pregate pack add --path rules/team --preview
```

Approval commits the folder together with the preset and lock. A folder outside the
project, or one Git ignores, is named in the approval output; `pregate status` lists
rule pack folders with uncommitted files.

Once the folder is an active source, the same command stages the next rule as one
contract update instead of writing the folder. Because that update is reviewed once,
the run must carry complete evidence; `--fail`, `--pass` and `--trap` repeat:

```sh
pregate rules draft rules/team net/window-fetch --pattern rule.json --message "..." --why "..." --fix "..." \
  --fail src/bad.ts --fail src/bad2.ts --pass src/good.ts --pass src/good2.ts \
  --trap src/trap.ts --trap-note "window.fetch is the same raw call."
```

It compiles the contract with the new rule, prints the file and rule diff and a
digest, and leaves the pack and lock untouched until the human approves with the
printed `pregate approve` route. Local consent is preserved. The command refuses
`.pregate` folders and folders inside a source that are not the whole source.

## Limits

Drafts support declarative pattern checks for TypeScript/JavaScript, Python, Go
and Rust (one language per check). Metrics,
import boundaries and project-fitness requirements still use their own primitives
or `pack init`. Fixture files are copies of the given files; reduce them before
drafting if they contain private code. A passing draft proves the pattern on the
supplied cases, not that it has no false positives elsewhere; start it in shadow
and watch `report` before enforcing.

