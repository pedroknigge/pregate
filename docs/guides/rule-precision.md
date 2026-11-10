# Rule precision

Two measurements are recorded here. Sample precision says how many maintainer-labeled findings match the rule that produced them. Hook latency is the compiled Pre hook on 200-line and 2,000-line files. A pack with no labels has no precision, and a latency number from one OS is not the number for another.

<!-- BEGIN measured precision -->

## Measured sample precision

This run audited 46 packs on 8 pinned trees (238 source files) and recorded **8951 findings**. Sample precision is shown for 5 maintainer-labeled packs. Every other pack is unmeasured.

Engine 0.0.5, core 0.0.1.

Maintainer-labeled sample: 17 true-positive, 11 false-positive. Packs that do not appear in that sample are unmeasured.

## Method

1. Shallow-fetch each git entry at its pinned commit into `.cache/precision` (or `--cache`). Reuse a clean cache whose HEAD is that commit. Check the scanned source sha256 against the manifest. With `--skip-offline`, a failed fetch leaves the written report untouched. A path entry must already be a checkout of its commit.
2. For each pack, compile a shadow preset of the builtin core plus that pack's methodologies. If those methodologies do not compile together, compile each one on its own. Count static findings from the same file audit `pregate audit` uses. One finding is one site: corpus, pack, rule, path, line, and symbol.
3. Read `bench/labels/<pack>.json`. Each file is a maintainer-labeled sample: `true-positive` or `false-positive`, plus a note. A label that does not match a finding is an error. Precision is `true-positive / (true-positive + false-positive)` for packs with at least one matching label.

Engine and core versions are recorded on the report. Re-running the command on the same pins and the same engine reproduces the counts.

## Corpus

| Id | Language | Kind | Commit | Source files | Parsed |
| --- | --- | --- | --- | ---: | ---: |
| classnames | javascript | git | `abd6314010de053a09df5acc53e474ff65cea470` | 15 | 15 |
| errors | go | git | `87f8819acf6dc28bf5d3c14b334268236d686f48` | 10 | 10 |
| express | javascript | git | `1c6f1b0fe4000977b9a7b4f34097e4d527dd9824` | 142 | 142 |
| markupsafe | python | git | `4e111271b1494995708a9e878a10829b5e10c7ba` | 12 | 12 |
| ms | javascript | git | `4ff48cec099f0514c3e9bbca18706c9c21122bfb` | 8 | 8 |
| react-markdown | javascript | git | `f9ca66ec73d218127bff56b41a583bba1fb96125` | 5 | 5 |
| toml | rust | git | `d733fc535e4a9f3c454e421a87b90ade5d49bf31` | 30 | 30 |
| tslib | typescript | git | `1fd51ada1a20ce315805cdf63d0555a8b5fb33bb` | 16 | 16 |

- classnames: https://github.com/JedWatson/classnames.git
- errors: https://github.com/pkg/errors.git
- express: https://github.com/expressjs/express.git
- markupsafe: https://github.com/pallets/markupsafe.git
- ms: https://github.com/vercel/ms.git
- react-markdown: https://github.com/remarkjs/react-markdown.git
- toml: https://github.com/BurntSushi/toml.git
- tslib: https://github.com/microsoft/tslib.git

## Per-pack counts

A fraction is the maintainer-labeled sample only. Unmeasured means this report states no precision for that pack.

| Pack | Findings | Labeled | True positives | False positives | Sample precision |
| --- | ---: | ---: | ---: | ---: | --- |
| senior | 3420 | 6 | 6 | 0 | 6/6 |
| redis | 3039 | 6 | 0 | 6 | 0/6 |
| pstack | 827 | 6 | 1 | 5 | 1/6 |
| clean-code | 565 | 5 | 5 | 0 | 5/5 |
| javascript | 512 | 5 | 5 | 0 | 5/5 |
| maintainability | 105 | 0 | 0 | 0 | unmeasured |
| go | 101 | 0 | 0 | 0 | unmeasured |
| typescript | 91 | 0 | 0 | 0 | unmeasured |
| express | 77 | 0 | 0 | 0 | unmeasured |
| vibe-proof | 55 | 0 | 0 | 0 | unmeasured |
| trpc | 51 | 0 | 0 | 0 | unmeasured |
| musk | 40 | 0 | 0 | 0 | unmeasured |
| node | 31 | 0 | 0 | 0 | unmeasured |
| mattpocock | 12 | 0 | 0 | 0 | unmeasured |
| vue | 8 | 0 | 0 | 0 | unmeasured |
| tailwind | 6 | 0 | 0 | 0 | unmeasured |
| authjs | 5 | 0 | 0 | 0 | unmeasured |
| python | 3 | 0 | 0 | 0 | unmeasured |
| mongodb | 2 | 0 | 0 | 0 | unmeasured |
| react-native | 1 | 0 | 0 | 0 | unmeasured |
| agent-practices | 0 | 0 | 0 | 0 | unmeasured |
| angular | 0 | 0 | 0 | 0 | unmeasured |
| architecture | 0 | 0 | 0 | 0 | unmeasured |
| consumer-saas | 0 | 0 | 0 | 0 | unmeasured |
| core | 0 | 0 | 0 | 0 | unmeasured |
| dcouplr | 0 | 0 | 0 | 0 | unmeasured |
| ddd | 0 | 0 | 0 | 0 | unmeasured |
| design-invariants | 0 | 0 | 0 | 0 | unmeasured |
| drizzle | 0 | 0 | 0 | 0 | unmeasured |
| enterprise-ready | 0 | 0 | 0 | 0 | unmeasured |
| firebase | 0 | 0 | 0 | 0 | unmeasured |
| nestjs | 0 | 0 | 0 | 0 | unmeasured |
| next-website | 0 | 0 | 0 | 0 | unmeasured |
| nextjs | 0 | 0 | 0 | 0 | unmeasured |
| nuxt | 0 | 0 | 0 | 0 | unmeasured |
| postgres | 0 | 0 | 0 | 0 | unmeasured |
| prisma | 0 | 0 | 0 | 0 | unmeasured |
| react | 0 | 0 | 0 | 0 | unmeasured |
| rust | 0 | 0 | 0 | 0 | unmeasured |
| security-audit | 0 | 0 | 0 | 0 | unmeasured |
| solana | 0 | 0 | 0 | 0 | unmeasured |
| supabase | 0 | 0 | 0 | 0 | unmeasured |
| svelte | 0 | 0 | 0 | 0 | unmeasured |
| sveltekit | 0 | 0 | 0 | 0 | unmeasured |
| testing | 0 | 0 | 0 | 0 | unmeasured |
| vercel | 0 | 0 | 0 | 0 | unmeasured |

## Maintainer-labeled sample

These notes were written by the maintainer after reading the pinned source at that line. They are not a model-graded score.

| Verdict | Pack | Rule | Location | Note |
| --- | --- | --- | --- | --- |
| true-positive | clean-code | `clean-code/CC-FN-001` | classnames `bind.js:16` `parseValue` | parseValue runs from line 16 through the return on line 42, past the limit of 20. |
| true-positive | clean-code | `clean-code/CC-FN-001` | classnames `tests/bind.js:16` `<module>` | The describe callback starts at line 16 and still contains further tests past line 35, so it is over the 20-line limit. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | classnames `dedupe.js:1` `<module>` | The comment explains why StorageObject must not inherit from Object. The next line is only the constructor, so the comment does not restate it. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | classnames `dedupe.js:65` `appendObject` | The comment records why the code assigns false instead of deleting a key. The assignment on the following line does not say that. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | classnames `dedupe.js:66` `appendObject` | The line is a URL citation. It does not restate classSet[k] = !!object[k]. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | classnames `index.d.ts:1` `<module>` | LICENSE is MIT is a license banner. It does not restate the types below, and it is not the Copyright line that the allowlist already names. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | classnames `index.d.ts:15` `<module>` | The JSDoc sentence describes the package. It does not restate the classNames signature on the next line. |
| false-positive | redis | `redis/REDIS-SCAN-001` | classnames `benchmarks/benchmarks.js:72` `printTable.headers` | Object.keys lists the columns of a benchmark row. It is not the Redis KEYS command. |
| true-positive | senior | `senior/SR-BRACE-001` | classnames `dedupe.js:21` `appendValue` | if (!arg) return has no braces. The rule requires braces on an if. |
| true-positive | senior | `senior/SR-CHAIN-001` | classnames `bind.js:29` `parseValue` | arg.toString.toString().includes walks three member or call hops, which is the chain this rule rejects. |
| true-positive | clean-code | `clean-code/CC-FN-001` | express `examples/mvc/lib/boot.js:11` `<module>` | The exported boot function starts at line 11 and is still loading controllers past line 40, over the 20-line limit. |
| true-positive | clean-code | `clean-code/CC-FN-002` | express `examples/error/index.js:20` `error` | error takes err, req, res, and next. Express uses that arity for error middleware, and the function is still four parameters over the limit of three. |
| true-positive | javascript | `javascript/JS-CJS-001` | express `examples/content-negotiation/db.js:9` `<module>` | module.exports = users publishes the array through CommonJS, which is the export this rule names. |
| true-positive | javascript | `javascript/JS-CJS-001` | express `examples/content-negotiation/users.js:11` `<module>` | exports.text assigns a CommonJS export. The rule asks for an export statement. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `examples/auth/index.js:10` `session` | require('express-session') loads that module with require, which is the call this rule names. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `examples/auth/index.js:9` `path` | require('node:path') is a require call. The rule asks for an import statement. |
| true-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/auth/index.js:109` `<module>` | Regenerate session when signing in restates the req.session.regenerate call it sits on. |
| false-positive | redis | `redis/REDIS-KEY-001` | express `examples/auth/index.js:100` `<module>` | app.get registers an HTTP route. The call is not a Redis GET of a key. |
| false-positive | redis | `redis/REDIS-KEY-001` | express `examples/auth/index.js:119` `<module>` | req.get reads the Referrer header. It is not a Redis GET. |
| false-positive | redis | `redis/REDIS-KEY-001` | express `examples/auth/index.js:16` `<module>` | app.set stores the Express view engine. It is not a Redis SET of a key. |
| false-positive | redis | `redis/REDIS-SCAN-001` | express `lib/response.js:578` `keys` | Object.keys copies header names. It is not a Redis KEYS scan. |
| false-positive | redis | `redis/REDIS-SCAN-001` | express `test/app.router.js:308` `keys` | Object.keys(req.params) reads route parameters in a test. It is not Redis KEYS. |
| true-positive | senior | `senior/SR-BRACE-001` | express `examples/auth/index.js:36` `<module>` | if (err) assigns res.locals.message with no braces around the branch. |
| true-positive | senior | `senior/SR-CHAIN-001` | express `examples/downloads/index.js:27` `<module>` | req.params.file.join walks params, file, and join. That is three member hops. |
| true-positive | senior | `senior/SR-VAR-001` | express `examples/auth/index.js:10` `<module>` | var session declares the express-session binding with var, which is the declaration this rule names. |
| true-positive | senior | `senior/SR-VAR-001` | express `examples/auth/index.js:31` `<module>` | var err reads the session error with var. const or let would be the binding this rule asks for. |
| true-positive | clean-code | `clean-code/CC-FN-002` | ms `src/index.ts:236` `plural` | plural takes ms, msAbs, n, and name. That is four parameters and the limit is three. |
| true-positive | javascript | `javascript/JS-REQ-001` | tslib `test/runTests.js:2` `<module>` | require("child_process") is a require call in the test runner. |

## Limits

- Sample precision is true positives divided by the maintainer-labeled findings of that pack. Unlabeled findings are not in the denominator and have no precision.
- A pack with no matching maintainer label is unmeasured. This report does not give it a precision.
- A label says whether the finding matches the rule's stated condition. It is not a judgment that a project should adopt the rule.
- The corpus is the pinned commits in the manifest. It is not a random sample of public code.
- The audit records static matches in the checked-out tree. It is not the no-new ratchet used on an edit, and it does not run fitness, diff, or placement checks.
- Vue and Svelte single-file components use the TypeScript grammar. This corpus has no .vue or .svelte file, so a zero there is not evidence about those rules.
- Tracked files under node_modules, vendor, dist, build, coverage, .next, or target are not scanned. Symlinks are not followed.

## Reproduce

```sh
bun scripts/bench-audit-repos.ts --precision \
  --corpus bench/corpus.json \
  --labels bench/labels \
  --cache .cache/precision \
  --out bench/precision-report.json \
  --markdown bench/precision.md
```

<!-- END measured precision -->

## Hook latency

`scripts/bench.ts` times the compiled binary behind the registered Pre hook. Linux and macOS run that command with `sh -c`. Windows runs the PowerShell command `setup` wrote, through `cmd.exe /d /c`. Each sample is a new session. The timed edit is an allowed change of a 200-line file and of a 2,000-line file, on the first touch and again on the second touch.

CI runs this on `ubuntu-latest` (2 vCPU), `macos-latest`, and `windows-latest`. The `ubuntu-latest` job is the required check named `bench`. macOS and Windows run the same command under `latency (macos-latest)` and `latency (windows-latest)`. Each job takes 25 samples, repeats that three times, and keeps the median of the three p95 values. The job fails when that median is more than 55% above the committed baseline in `bench/latency-baseline.json` for the same OS and architecture. The 150 ms budget in the architecture notes still belongs to the reference development machine. `--inform` keeps a miss of that budget from failing these runners.

Windows has no POSIX pseudo-terminal, so the bench enables the fixture once with `PREGATE_UNATTENDED_APPROVAL=1` and `--yes`. The timed hook does not inherit that variable.

A runner whose architecture does not match the baseline fails closed.

Run 41575641391 on `a6ad0c49` is not a hook regression. Each of the three jobs printed its median p95 and then exited 1 with `ENOENT` because `bench/latency-baseline.json` was not in that commit. Those medians are part of the sample below.

### Results

| OS | Runner | Architecture | Route | Nearby p50 ms | Baseline p95 ms |
| --- | --- | --- | --- | ---: | ---: |
| linux | ubuntu-latest | x64 | 200 lines, first touch | 111.9 | 127.8 |
| linux | ubuntu-latest | x64 | 200 lines, second touch | 106.3 | 118.4 |
| linux | ubuntu-latest | x64 | 2,000 lines, first touch | 228.4 | 252.9 |
| linux | ubuntu-latest | x64 | 2,000 lines, second touch | 226.1 | 241.5 |
| darwin | macos-latest | arm64 | 200 lines, first touch | 107.8 | 145.5 |
| darwin | macos-latest | arm64 | 200 lines, second touch | 102.4 | 137.3 |
| darwin | macos-latest | arm64 | 2,000 lines, first touch | 186.8 | 263.0 |
| darwin | macos-latest | arm64 | 2,000 lines, second touch | 206.1 | 264.4 |
| windows | windows-latest | x64 | 200 lines, first touch | 766.4 | 811.8 |
| windows | windows-latest | x64 | 200 lines, second touch | 766.8 | 801.6 |
| windows | windows-latest | x64 | 2,000 lines, first touch | 892.3 | 948.8 |
| windows | windows-latest | x64 | 2,000 lines, second touch | 874.3 | 928.4 |

Each baseline p95 is the median of eight hosted median p95s, including run 41575641391. The p50 is from the run whose p95 was nearest that median. The slowest of those medians was 44.7% above its baseline (macOS, 2,000 lines, second touch, 382.6 ms against 264.4 ms). The gate allows 55%: that excess plus 10 percentage points, so a repeat of the slowest recorded run stays under the limit (264.4 × 1.55 = 409.8 ms) and a larger jump still fails. One slow sample inside a job does not fail it: the compared figure is the median of three p95s.

## Rule behavior and proof limits

These rule precision refinements are part of the built-in catalog and bundled
packs in `v0.0.1`. See the [release notes](../releases/0.0.1.md).

## Cases distinguished by the current rules

| Policy | Valid case | Finding retained |
| --- | --- | --- |
| Node builtin prefix (`NODE-PREFIX-001`) | Application data such as `{ protocol: "http" }`, type literals and callback arguments | A bare builtin in an actual import/export source or the first static argument of `require`, `module.require` or `import`; use `node:http`, for example |
| Interval cleanup (`VP-INTERVAL-001`) | A stored interval handle with a matching `clearInterval` read, including a shared typed container field in sibling functions | A missing cleanup, a different handle or an unrelated container binding/type |
| SQL interpolation (`VP-SQL-001`) | An outer transaction callback, bound values, or an interpolated scope argument beside a transaction handle | Direct interpolation in the first SQL argument of `.query`, `.execute`, `.raw` or `.unsafe`, including transparent parentheses and TypeScript type wrappers |
| React index key (`REACT-KEY-001`) | `Array.from({ length: 3 }, (_, index) => <span key={index} />)` with a fixed numeric literal length and only positional placeholder rendering | Index keys for data rendering, dynamic lengths, custom components or transformed lists; a fixed length alone does not establish stable item identity |
| Credential literal (`VP-SECRET-001`) | A complete static credentialed URL in a `.test`/`.spec` file whose password is exactly `secret`, `password` or `changeme` | Production credentialed URLs, real-looking test passwords, prefixed tokens, private-key text, credentials in comments, interpolation, or a real secret beside a placeholder URL |

The SQL check inspects the actual callee and first argument. It still reports a
genuine unsafe SQL call nested inside a transaction callback. It does not prove
the safety of SQL assembled through variables, concatenation or tagged templates;
review those paths separately. The credential exception is a narrow fixture
distinction, not permission to store secrets in tests.

Matching interval cleanup is syntactic evidence that the same stored handle is
read by `clearInterval`. It does not prove that teardown runs on every lifecycle
path. React's placeholder exception likewise does not prove arbitrary list
stability. Keep runtime behavior tests for these requirements.
Sibling parameters sharing a local named container type do not prove that they
refer to the same runtime instance. Imported container types and complex
alias/call flows still need separate evidence.

## Drizzle result bounds

`DRIZ-LIMIT-001` accepts a modeled result bound from the evaluated query's
`limit`/terminal `get`, or proved schema and input cardinality. Static imported
schema, reexports and TypeScript aliases can supply actual declared primary or
unique keys, including composite keys. Names such as `id` and `slug` do not
establish uniqueness. A joined table must be reached through a proved unique
key; an amplifying join or union still needs a separate bound.

A fixed `inArray` list supplies a finite input budget. An array-typed parameter
can use a literal `slice(0, n)` or a preceding rejecting length guard in the same
function. Intervening mutation or opaque calls invalidate that evidence; normal
query construction and imported predicate helpers do not. Another query's
`limit`, `get`, `select` or `from` cannot supply this query's proof.

Partial or functional unique indexes, unknown validators, mutable initializer
flows, split query construction, schema wrappers and aggregates remain unproved.
This policy models result cardinality, not database execution cost or the schema
actually deployed by migrations. Supply project assertions for those guarantees.
See the [Drizzle pack](../../packs/drizzle/README.md) and
[invariant enforcement](invariant-enforcement.md).

## Verification scope

Paired public examples exercise valid cases alongside findings that must remain.
Read-only analysis of the reported consumer files supports the reported false
positive repairs; it does not migrate their active contracts. Earlier compiled
CLI controls identify their own source/artifact snapshot and do not certify a
later integrated build. Final generated references, full source verification,
packaged controls and latency measurements follow source freeze.

For policy changes, preserve existing aliases, severities and shadow overrides
and use the [reviewed contract workflow](daily-use.md#review-a-contract-change-inside-the-harness).
See the [documentation index](../README.md) and [pack reference](../packs.md).
