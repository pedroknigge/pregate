# Rule precision

Two measurements are recorded here. Sample precision says how many labeled findings match the rule that produced them, and who wrote each label: the maintainer or an AI coding agent. Hook latency is the compiled Pre hook on 200-line and 2,000-line files. A pack with no labels has no precision, and a latency number from one OS is not the number for another.

## Rule changes since the 0.0.7 measurement

The 0.0.7 measurement had 28 maintainer labels in five packs. `redis` was 0 of 6 correct on 3,039 findings and `pstack` was 1 of 6 correct on 827 findings. Three rules were changed and the measurement was run again on the same pinned corpus.

| Pack | Before: findings | Before: sample | After: findings | After: sample | Labels after |
| --- | ---: | --- | ---: | --- | --- |
| redis | 3,039 | 0/6 | 0 | unmeasured | 6 maintainer false positives resolved |
| pstack | 827 | 1/6 | 516 | 2/6 | 1 maintainer, 5 agent; 5 maintainer false positives resolved |
| senior | 3,420 | 6/6 | 3,420 | 6/6 | 6 maintainer |
| clean-code | 565 | 5/5 | 565 | 5/5 | 5 maintainer |
| javascript | 512 | 5/5 | 512 | 5/5 | 5 maintainer |

- **`redis/REDIS-KEY-001` and `redis/REDIS-SCAN-001`** matched any `.get(`, `.set(` or `.keys(` call. They now match a call only on a Redis client receiver: a name that contains `redis` or `valkey`, or a name such as `client`, `cache` or `db` in a file that imports a Redis module. All six false positives are gone, and so is every other `redis` finding on this corpus. No file in the corpus has a Redis call these rules should report, so `redis` has no precision here. The pack's `fail` fixtures are the evidence that the rules still report a real call.
- **`pstack/PS-COMMENT-001`** reported every comment outside a marker allowlist. It now also exempts a JSDoc block, a URL citation, a comment that names a license, and a comment with a reason word. The five measured false positives are gone and 311 fewer comments are reported. The pattern language cannot compare a comment with the code after it, so the rule still reports comments that do not restate code: four of the five agent-sampled findings are false. Its default severity is now `warn`, not `deny`. The limit is recorded in [engine requests](../../packs/ENGINE-REQUESTS.md).

The 15 packs that had findings and no label then received agent labels: five findings each, or every finding when the pack had fewer than five, 71 labels in all. The agent that wrote them is the same agent session that changed the rules on this page. Read an agent fraction as a first look that a person can check row by row, not as a reviewed result.

### Second round: rules the agent sample measured as false

The agent sample found false positives in six more packs. The maintainer read those labels and accepted them, and eight rules were narrowed. No label was changed: a false-positive label whose finding is gone is listed under Resolved false positives.

| Pack | Before: findings | Before: sample | After: findings | After: sample | Labels after |
| --- | ---: | --- | ---: | --- | --- |
| trpc | 51 | 0/5 | 0 | unmeasured | 5 agent false positives resolved |
| vue | 8 | 0/5 | 0 | unmeasured | 5 agent false positives resolved |
| tailwind | 6 | 0/5 | 0 | unmeasured | 5 agent false positives resolved |
| authjs | 5 | 0/5 | 0 | unmeasured | 5 agent false positives resolved |
| mongodb | 2 | 0/2 | 0 | unmeasured | 2 agent false positives resolved |
| express | 77 | 3/5 | 56 | 3/3 | 3 agent; 2 agent false positives resolved |

- **`trpc/TRPC-ERR-001`** matched every `throw new Error(`. It now needs a file that imports a tRPC module, or a throw inside a `.query`, `.mutation` or `.subscription` call on a procedure builder.
- **`vue/VUE-PUSH-001`** matched every `.push(` with a `+` in its arguments, such as `urls.push(x)` on an array. It now needs a receiver that ends in `router`.
- **`vue/VUE-DOM-001`** matched every direct `document` query. It now needs a Vue import in the file, or a call inside a function. The second branch keeps the pack's own fail fixtures, which have no import, so a function in a file with no Vue code is still reported. The limit is in the pack backlog and the severity stays `warn`.
- **`tailwind/TW-DYN-001`** matched a concatenation under any ancestor whose text contained `className`. It now needs a `className` or `class` attribute, or a `className` or `class` property, around the expression.
- **`authjs/AUTH-SECRET-001`** matched every `secret: "..."` pair. It now needs an import of `next-auth` or an `@auth/` package in the file.
- **`mongodb/MONGO-CONNECT-001`** and **`mongodb/MONGO-SCHEMA-001`** matched every `.connect(` call and every `strict: false` pair. They now need an import of `mongoose` or `mongodb` (`mongoose` for the schema rule) in the file.
- **`express/EX-NEXT-001`** tested the text of a whole call, so an `it(...)` or `app.param(...)` call that contained `next('route')` was reported on its own line. This was the rule's pattern, not how the engine reports a line. The rule now tests the callee and the first argument of the call itself. 21 findings on enclosing calls are gone and the 11 that remain are `next('route')` or `next('router')` calls.

The corpus contains no project that uses tRPC, Vue, Tailwind, Auth.js, MongoDB or Redis. For `trpc`, `vue`, `tailwind`, `authjs`, `mongodb` and `redis`, no true positive is measured here: the run shows only that the rules no longer report unrelated code. The `fail` and `trap` fixtures of each pack are the only evidence that the rules still report the code they name. The measured false positives are `pass` fixtures, and for `EX-NEXT-001` a trap fixture with the exact line.

`pstack` stays at 2/6 with default severity `warn`. No other pack has a false positive in its sample. That is a statement about 64 labeled findings out of 5,508, not about the rules.

<!-- BEGIN measured precision -->

## Measured sample precision

This run audited 49 packs on 8 pinned trees (238 source files) and recorded **5508 findings**. Sample precision is shown for 14 labeled packs. Every other pack is unmeasured.

Engine 0.0.10, core 0.0.1.

Labeled sample: 60 true-positive, 4 false-positive. Packs that do not appear in that sample are unmeasured.

The maintainer wrote 17 of these labels and an AI coding agent wrote 47. Agent labels are not an independent human review. 35 earlier false-positive labels no longer match a finding and are listed as resolved.

## Method

1. Shallow-fetch each git entry at its pinned commit into `.cache/precision` (or `--cache`). Reuse a clean cache whose HEAD is that commit. Check the scanned source sha256 against the manifest. With `--skip-offline`, a failed fetch leaves the written report untouched. A path entry must already be a checkout of its commit.
2. For each pack, compile a shadow preset of the builtin core plus that pack's methodologies. If those methodologies do not compile together, compile each one on its own. Count static findings from the same file audit `pregate audit` uses. One finding is one site: corpus, pack, rule, path, line, and symbol.
3. Read every file in `bench/labels`. Each file names one pack and one labeler, `maintainer` or `agent`, and holds labels: `true-positive` or `false-positive`, plus a note. A `true-positive` label that does not match a finding is an error. A `false-positive` label that does not match a finding is recorded as resolved: the rules no longer report that site. Precision is `true-positive / (true-positive + false-positive)` for packs with at least one matching label.
4. An agent does not choose the findings it labels. Take the findings of one pack in the order of the `--findings` file (sorted as text by corpus, pack, rule, path, line and symbol). With n findings and k the smaller of 5 and n, the sample is the findings at positions floor(i × n / k) for i from 0 to k − 1. `bench/agent-sample.json` records the sites offered so far, and `--sample <file>` writes that record plus the sample of this run. An agent label for a site that is not in the record or in the sample of this run is an error. A rule change moves the positions; a label written before the change keeps the site it was offered.

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

A fraction is the labeled sample only. Labeled by says how many of those labels the maintainer wrote and how many an agent wrote. Unmeasured means this report states no precision for that pack.

| Pack | Findings | Labeled | True positives | False positives | Sample precision | Labeled by |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| senior | 3420 | 6 | 6 | 0 | 6/6 | maintainer 6 |
| clean-code | 565 | 5 | 5 | 0 | 5/5 | maintainer 5 |
| pstack | 516 | 6 | 2 | 4 | 2/6 | maintainer 1, agent 5 |
| javascript | 512 | 5 | 5 | 0 | 5/5 | maintainer 5 |
| maintainability | 105 | 5 | 5 | 0 | 5/5 | agent 5 |
| go | 101 | 5 | 5 | 0 | 5/5 | agent 5 |
| typescript | 91 | 5 | 5 | 0 | 5/5 | agent 5 |
| express | 56 | 3 | 3 | 0 | 3/3 | agent 3 |
| vibe-proof | 55 | 5 | 5 | 0 | 5/5 | agent 5 |
| musk | 40 | 5 | 5 | 0 | 5/5 | agent 5 |
| node | 31 | 5 | 5 | 0 | 5/5 | agent 5 |
| mattpocock | 12 | 5 | 5 | 0 | 5/5 | agent 5 |
| python | 3 | 3 | 3 | 0 | 3/3 | agent 3 |
| react-native | 1 | 1 | 1 | 0 | 1/1 | agent 1 |
| agent-practices | 0 | 0 | 0 | 0 | unmeasured | - |
| angular | 0 | 0 | 0 | 0 | unmeasured | - |
| architecture | 0 | 0 | 0 | 0 | unmeasured | - |
| astro | 0 | 0 | 0 | 0 | unmeasured | - |
| authjs | 0 | 0 | 0 | 0 | unmeasured | - |
| consumer-saas | 0 | 0 | 0 | 0 | unmeasured | - |
| core | 0 | 0 | 0 | 0 | unmeasured | - |
| dcouplr | 0 | 0 | 0 | 0 | unmeasured | - |
| ddd | 0 | 0 | 0 | 0 | unmeasured | - |
| design-invariants | 0 | 0 | 0 | 0 | unmeasured | - |
| drizzle | 0 | 0 | 0 | 0 | unmeasured | - |
| enterprise-ready | 0 | 0 | 0 | 0 | unmeasured | - |
| firebase | 0 | 0 | 0 | 0 | unmeasured | - |
| hono | 0 | 0 | 0 | 0 | unmeasured | - |
| mongodb | 0 | 0 | 0 | 0 | unmeasured | - |
| nestjs | 0 | 0 | 0 | 0 | unmeasured | - |
| next-website | 0 | 0 | 0 | 0 | unmeasured | - |
| nextjs | 0 | 0 | 0 | 0 | unmeasured | - |
| nuxt | 0 | 0 | 0 | 0 | unmeasured | - |
| postgres | 0 | 0 | 0 | 0 | unmeasured | - |
| prisma | 0 | 0 | 0 | 0 | unmeasured | - |
| react | 0 | 0 | 0 | 0 | unmeasured | - |
| redis | 0 | 0 | 0 | 0 | unmeasured | - |
| rust | 0 | 0 | 0 | 0 | unmeasured | - |
| security-audit | 0 | 0 | 0 | 0 | unmeasured | - |
| solana | 0 | 0 | 0 | 0 | unmeasured | - |
| supabase | 0 | 0 | 0 | 0 | unmeasured | - |
| svelte | 0 | 0 | 0 | 0 | unmeasured | - |
| sveltekit | 0 | 0 | 0 | 0 | unmeasured | - |
| tailwind | 0 | 0 | 0 | 0 | unmeasured | - |
| tanstack-query | 0 | 0 | 0 | 0 | unmeasured | - |
| testing | 0 | 0 | 0 | 0 | unmeasured | - |
| trpc | 0 | 0 | 0 | 0 | unmeasured | - |
| vercel | 0 | 0 | 0 | 0 | unmeasured | - |
| vue | 0 | 0 | 0 | 0 | unmeasured | - |

## Unmeasured packs

Packs with findings and no matching label: none.

Packs with no finding on this corpus, so there is nothing to label (35): `agent-practices`, `angular`, `architecture`, `astro`, `authjs`, `consumer-saas`, `core`, `dcouplr`, `ddd`, `design-invariants`, `drizzle`, `enterprise-ready`, `firebase`, `hono`, `mongodb`, `nestjs`, `next-website`, `nextjs`, `nuxt`, `postgres`, `prisma`, `react`, `redis`, `rust`, `security-audit`, `solana`, `supabase`, `svelte`, `sveltekit`, `tailwind`, `tanstack-query`, `testing`, `trpc`, `vercel`, `vue`. A zero here is not evidence that those rules are precise.

## Maintainer-labeled sample

These notes were written by the maintainer after reading the pinned source at that line. They are not a model-graded score.

| Verdict | Pack | Rule | Location | Note |
| --- | --- | --- | --- | --- |
| true-positive | clean-code | `clean-code/CC-FN-001` | classnames `bind.js:16` `parseValue` | parseValue runs from line 16 through the return on line 42, past the limit of 20. |
| true-positive | clean-code | `clean-code/CC-FN-001` | classnames `tests/bind.js:16` `<module>` | The describe callback starts at line 16 and still contains further tests past line 35, so it is over the 20-line limit. |
| true-positive | senior | `senior/SR-BRACE-001` | classnames `dedupe.js:21` `appendValue` | if (!arg) return has no braces. The rule requires braces on an if. |
| true-positive | senior | `senior/SR-CHAIN-001` | classnames `bind.js:29` `parseValue` | arg.toString.toString().includes walks three member or call hops, which is the chain this rule rejects. |
| true-positive | clean-code | `clean-code/CC-FN-001` | express `examples/mvc/lib/boot.js:11` `<module>` | The exported boot function starts at line 11 and is still loading controllers past line 40, over the 20-line limit. |
| true-positive | clean-code | `clean-code/CC-FN-002` | express `examples/error/index.js:20` `error` | error takes err, req, res, and next. Express uses that arity for error middleware, and the function is still four parameters over the limit of three. |
| true-positive | javascript | `javascript/JS-CJS-001` | express `examples/content-negotiation/db.js:9` `<module>` | module.exports = users publishes the array through CommonJS, which is the export this rule names. |
| true-positive | javascript | `javascript/JS-CJS-001` | express `examples/content-negotiation/users.js:11` `<module>` | exports.text assigns a CommonJS export. The rule asks for an export statement. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `examples/auth/index.js:10` `session` | require('express-session') loads that module with require, which is the call this rule names. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `examples/auth/index.js:9` `path` | require('node:path') is a require call. The rule asks for an import statement. |
| true-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/auth/index.js:109` `<module>` | Regenerate session when signing in restates the req.session.regenerate call it sits on. |
| true-positive | senior | `senior/SR-BRACE-001` | express `examples/auth/index.js:36` `<module>` | if (err) assigns res.locals.message with no braces around the branch. |
| true-positive | senior | `senior/SR-CHAIN-001` | express `examples/downloads/index.js:27` `<module>` | req.params.file.join walks params, file, and join. That is three member hops. |
| true-positive | senior | `senior/SR-VAR-001` | express `examples/auth/index.js:10` `<module>` | var session declares the express-session binding with var, which is the declaration this rule names. |
| true-positive | senior | `senior/SR-VAR-001` | express `examples/auth/index.js:31` `<module>` | var err reads the session error with var. const or let would be the binding this rule asks for. |
| true-positive | clean-code | `clean-code/CC-FN-002` | ms `src/index.ts:236` `plural` | plural takes ms, msAbs, n, and name. That is four parameters and the limit is three. |
| true-positive | javascript | `javascript/JS-REQ-001` | tslib `test/runTests.js:2` `<module>` | require("child_process") is a require call in the test runner. |

## Agent-labeled sample

These notes were written by an AI coding agent after reading the pinned source at that line. The agent did not choose the sites (Method, step 4). They are not an independent human review, and the maintainer has not confirmed them.

| Verdict | Pack | Rule | Location | Note |
| --- | --- | --- | --- | --- |
| true-positive | node | `node/NODE-VM-001` | classnames `tests/index.js:113` `<module>` | vm.runInContext(code, context) evaluates a string in a vm context, which is the call this rule names. The string is a fixed literal in a test. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | classnames `index.d.ts:2` `<module>` | The comment is an empty // line inside the license banner. It has no words, so it does not restate the Copyright line after it. |
| true-positive | typescript | `typescript/TS-DEFAULT-001` | classnames `bind.d.ts:3` `<module>` | export default function classNames declares a default export. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | classnames `benchmarks/benchmarks.js:46` `runBenchmarks` | console.log prints the benchmark name. The file is a benchmark script, not a test file, so the stated condition holds. |
| true-positive | go | `go/GO-FN-001` | errors `format_test.go:161` `TestFormatWithStack` | TestFormatWithStack runs from line 161 to line 228. That is 68 lines and the limit is 50. |
| true-positive | express | `express/EX-NEXT-001` | express `examples/mvc/controllers/pet/index.js:13` `<module>` | return next('route') passes the string route to next, which is the call this rule names. |
| true-positive | express | `express/EX-STATUS-001` | express `test/app.route.js:101` `handleError` | res.status(500) is a statement with no chained sender, which is the stated condition. res.send follows on the next line, so the request does not stay open. |
| true-positive | express | `express/EX-STATUS-001` | express `test/express.urlencoded.js:635` `<module>` | res.status(err.status \|\| 500) is a statement with no chained sender, which is the stated condition. res.send follows on the next line. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | express `examples/route-map/index.js:24` `<module>` | if (verbose) is inside a switch, which is inside a for-in loop. That is a third level and the limit is two. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | express `examples/params/index.js:23` `<module>` | The app.param callback takes req, res, next, num and name. That is five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | express `test/res.location.js:141` `testRequestedRedirect` | testRequestedRedirect takes app, inputUrl, expected, expectedHost and done. That is five inputs and the limit is four. |
| true-positive | musk | `musk/MUSK-FAST-001` | express `examples/mvc/lib/boot.js:14` `<module>` | fs.readdirSync(dir) is a synchronous filesystem call, and boot.js is not a test file. |
| true-positive | node | `node/NODE-ENV-001` | express `test/app.js:97` `<module>` | process.env.NODE_ENV = this.env assigns to the environment at runtime. The assignment restores the value after a test. |
| true-positive | node | `node/NODE-SYNC-001` | express `lib/view.js:201` `tryStat` | fs.statSync(path) is a synchronous filesystem call in library code. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/mvc/db.js:3` `<module>` | faux database says the module is a stand-in for a real store. The next statement, var pets = exports.pets = [], does not say that. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/vhost/index.js:11` `<module>` | The block comment tells the reader which lines to add to /etc/hosts before the example runs. It does not restate the code after it. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `lib/application.js:373` `set` | trust proxy inherit back-compat gives the purpose of the Object.defineProperty call that follows. The call itself does not name back-compat. |
| true-positive | pstack | `pstack/PS-COMMENT-001` | express `lib/view.js:93` `View` | lookup path sits on this.path = this.lookup(fileName) and repeats the two names in that statement. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/error/index.js:52` `<module>` | console.log('Express started on port 3000') is a console.log call in an example server, not in a test file. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/route-map/index.js:24` `<module>` | if (verbose) console.log('%s %s', key, route) is a console.log call outside a test file. The verbose guard does not change the call. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/static-files/index.js:43` `<module>` | console.log('  GET /css/style.css') is a console.log call in an example server, not in a test file. |
| true-positive | python | `python/PY-CLASS-001` | markupsafe `src/markupsafe/__init__.py:84` `Markup` | Markup declares 29 methods whose names do not start with an underscore, from join to format_map. The limit is 10. |
| true-positive | python | `python/PY-NEST-001` | markupsafe `src/markupsafe/__init__.py:213` `Markup.striptags` | The if on line 213 is inside if value.startswith("<!--", start), which is inside the while loop. That is a third level and the limit is two. |
| true-positive | python | `python/PY-NEST-001` | markupsafe `src/markupsafe/__init__.py:220` `Markup.striptags` | The if on line 220 is in the else branch of the if on line 211, inside the while loop. That is a third level and the limit is two. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/index.test.ts:344` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket, which is the directive this rule reports. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse-strict.test.ts:168` `<module>` | @ts-expect-error - We expect this to throw. gives a reason and no owner or ticket. The rule asks for an owner or a ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse-strict.test.ts:55` `<module>` | The @ts-expect-error comment explains that JS users can still pass the value. It names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse.test.ts:162` `<module>` | @ts-expect-error - We expect this to throw. has no owner and no ticket. |
| true-positive | react-native | `react-native/RN-PLAT-001` | react-markdown `test.jsx:537` `p` | return <div {...rest} /> returns a DOM tag, which is the stated condition. react-markdown renders to the web, so the pack does not fit this repository; the label does not judge that. |
| true-positive | typescript | `typescript/TS-DEFAULT-001` | react-markdown `index.js:10` `<module>` | The export list contains Markdown as default, which the rule names as a default export. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | react-markdown `script/load-jsx.js:98` `createLoader.transformSource` | console.log(warning.text) prints a build warning from a loader script. The file is not a test file. |
| true-positive | go | `go/GO-FN-001` | toml `decode.go:231` `MetaData.unify` | unify runs from line 231 to line 303. That is 73 lines and the limit is 50. |
| true-positive | go | `go/GO-FN-001` | toml `toml_test.go:262` `TestToml` | TestToml runs from line 262 to line 393. That is 132 lines and the limit is 50. |
| true-positive | go | `go/GO-NEST-001` | toml `encode.go:491` `Encoder.eStruct` | The if on line 491 is inside if isEmbed, which is inside the for loop over the struct fields. That is a third level and the limit is two. |
| true-positive | go | `go/GO-NEST-001` | toml `lex.go:740` `lexMultilineString` | The if on line 740 is inside if lx.peek(), which is inside two nested if lx.accept blocks. That is a fourth level and the limit is two. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.es6.js:143` `__generator.step` | The if on line 143 is in the default branch of a switch, inside a try, inside a while loop. That is more than two levels. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.es6.js:82` `__esDecorate` | The if on line 82 is inside if (kind === "accessor"), which is inside the for loop over the decorators. That is a third level and the limit is two. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.es6.mjs:345` `__disposeResources.next` | if (r.async) is inside if (r.dispose), inside a try, inside a while loop. That is more than two levels. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.js:183` `step` | The switch on line 183 is inside a try, which is the body of a while loop. That is a third level and the limit is two. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.es6.js:371` `__rewriteRelativeImportExtension` | The replace callback takes m, tsx, d, ext and cm. That is five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.es6.mjs:370` `__rewriteRelativeImportExtension` | The replace callback takes m, tsx, d, ext and cm. That is five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.js:115` `<module>` | The function assigned to __esDecorate takes ctor, descriptorIn, decorators, contextIn, initializers and extraInitializers. That is six inputs and the limit is four. |
| true-positive | node | `node/NODE-EXEC-001` | tslib `test/runTests.js:45` `results` | spawnSync("npm", ["test"], ...) is a synchronous subprocess call, which is the call this rule names. |
| true-positive | node | `node/NODE-PREFIX-001` | tslib `test/webpack-modules/webpack.config.js:1` `path` | require('path') loads the builtin without the node: prefix. |
| true-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.js:178` `__values` | throw new TypeError(...) is the last statement of export function __values. |
| true-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.js:76` `__esDecorate` | The throw is in the addInitializer function expression, which is declared inside export function __esDecorate. |
| true-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.mjs:310` `__addDisposableResource` | throw new TypeError("Symbol.asyncDispose is not defined.") is in the body of export function __addDisposableResource. |

## Resolved false positives

Each row is a false-positive label whose site the rules no longer report. These rows are not in any count above.

| Labeled by | Pack | Rule | Location | Note |
| --- | --- | --- | --- | --- |
| maintainer | pstack | `pstack/PS-COMMENT-001` | classnames `dedupe.js:1` `<module>` | The comment explains why StorageObject must not inherit from Object. The next line is only the constructor, so the comment does not restate it. |
| maintainer | pstack | `pstack/PS-COMMENT-001` | classnames `dedupe.js:65` `appendObject` | The comment records why the code assigns false instead of deleting a key. The assignment on the following line does not say that. |
| maintainer | pstack | `pstack/PS-COMMENT-001` | classnames `dedupe.js:66` `appendObject` | The line is a URL citation. It does not restate classSet[k] = !!object[k]. |
| maintainer | pstack | `pstack/PS-COMMENT-001` | classnames `index.d.ts:1` `<module>` | LICENSE is MIT is a license banner. It does not restate the types below, and it is not the Copyright line that the allowlist already names. |
| maintainer | pstack | `pstack/PS-COMMENT-001` | classnames `index.d.ts:15` `<module>` | The JSDoc sentence describes the package. It does not restate the classNames signature on the next line. |
| maintainer | redis | `redis/REDIS-SCAN-001` | classnames `benchmarks/benchmarks.js:72` `printTable.headers` | Object.keys lists the columns of a benchmark row. It is not the Redis KEYS command. |
| agent | tailwind | `tailwind/TW-DYN-001` | classnames `bind.js:49` `appendClass` | value + ' ' + newClass joins two class strings inside the classnames library. It is not inside a className attribute, which is the stated condition. |
| agent | tailwind | `tailwind/TW-DYN-001` | classnames `dedupe.js:13` `classNames` | ' ' + key builds the library's return string in a function named classNames. No className attribute contains the expression. |
| agent | tailwind | `tailwind/TW-DYN-001` | classnames `index.js:49` `appendClass` | value + ' ' + newClass joins two class strings inside the classnames library. It is not inside a className attribute. |
| agent | vue | `vue/VUE-DOM-001` | classnames `benchmarks/runInBrowser.js:3` `startButton` | document.getElementById('start') is at the top of a plain browser script. No Vue component or setup function owns the element, which is what the rule's condition requires. |
| agent | authjs | `authjs/AUTH-SECRET-001` | express `examples/auth/index.js:25` `secret` | secret: 'shhhh, very secret' is an option of express-session. The rule's condition is a literal secret in the NextAuth config, and this file has none. |
| agent | authjs | `authjs/AUTH-SECRET-001` | express `examples/cookie-sessions/index.js:13` `secret` | The literal secret is passed to cookieSession, the cookie-session middleware. It is not a NextAuth config. |
| agent | authjs | `authjs/AUTH-SECRET-001` | express `examples/mvc/index.js:43` `secret` | secret: 'some secret here' configures express-session. No NextAuth config is in this file. |
| agent | authjs | `authjs/AUTH-SECRET-001` | express `examples/session/index.js:19` `secret` | secret: 'keyboard cat' is an express-session option. The literal is hardcoded, but the object is not the NextAuth config the rule names. |
| agent | authjs | `authjs/AUTH-SECRET-001` | express `examples/session/redis.js:23` `secret` | secret: 'keyboard cat' sits beside store: new RedisStore in an express-session call. It is not a NextAuth config. |
| agent | express | `express/EX-NEXT-001` | express `test/app.param.js:294` `<module>` | Line 294 is the it(...) call of a test. The next('route') call is seven lines below, inside its callback, so the reported line is not the call the rule names. |
| agent | express | `express/EX-NEXT-001` | express `test/app.router.js:873` `<module>` | Line 873 is the it(...) call of a test. The next('router') call is six lines below, inside a nested function, so the reported line is not the call the rule names. |
| agent | mongodb | `mongodb/MONGO-CONNECT-001` | express `examples/search/index.js:33` `initializeRedis` | db is the Redis client from redis.createClient(). db.connect() is not a MongoDB connection, so maxPoolSize does not apply to it. |
| agent | mongodb | `mongodb/MONGO-SCHEMA-001` | express `test/express.json.js:243` `strict` | strict: false is an option of the express.json body parser in a test. It is not a Mongoose schema option. |
| maintainer | redis | `redis/REDIS-KEY-001` | express `examples/auth/index.js:100` `<module>` | app.get registers an HTTP route. The call is not a Redis GET of a key. |
| maintainer | redis | `redis/REDIS-KEY-001` | express `examples/auth/index.js:119` `<module>` | req.get reads the Referrer header. It is not a Redis GET. |
| maintainer | redis | `redis/REDIS-KEY-001` | express `examples/auth/index.js:16` `<module>` | app.set stores the Express view engine. It is not a Redis SET of a key. |
| maintainer | redis | `redis/REDIS-SCAN-001` | express `lib/response.js:578` `keys` | Object.keys copies header names. It is not a Redis KEYS scan. |
| maintainer | redis | `redis/REDIS-SCAN-001` | express `test/app.router.js:308` `keys` | Object.keys(req.params) reads route parameters in a test. It is not Redis KEYS. |
| agent | trpc | `trpc/TRPC-ERR-001` | express `examples/error/index.js:31` `<module>` | throw new Error('something broke!') is in an Express route handler. The file defines no tRPC procedure, so it is not a procedure file. |
| agent | trpc | `trpc/TRPC-ERR-001` | express `test/Route.js:252` `<module>` | throw new Error('boom!') is in a route.all handler of an Express test. The file is not a tRPC procedure file. |
| agent | trpc | `trpc/TRPC-ERR-001` | express `test/app.param.js:204` `<module>` | throw new Error('err!') is in an app.param callback of an Express test. The file is not a tRPC procedure file. |
| agent | trpc | `trpc/TRPC-ERR-001` | express `test/express.json.js:479` `app.verify` | throw new Error('no arrays') is in a body-parser verify option of an Express test. The file is not a tRPC procedure file. |
| agent | trpc | `trpc/TRPC-ERR-001` | express `test/express.urlencoded.js:533` `app.verify` | throw new Error('no leading space') is in a body-parser verify option of an Express test. The file is not a tRPC procedure file. |
| agent | vue | `vue/VUE-DOM-001` | express `examples/search/public/client.js:3` `search` | document.querySelector('[type=search]') is at the top of a plain browser script. The file has no Vue component, so there is no setup to run before mount. |
| agent | vue | `vue/VUE-PUSH-001` | express `test/req.baseUrl.js:60` `<module>` | urls is an array and urls.push('0@' + req.baseUrl) appends a string to it. It is not router.push. |
| agent | vue | `vue/VUE-PUSH-001` | express `test/req.baseUrl.js:65` `<module>` | urls.push('1@' + req.baseUrl) appends to an array in a test. It is not router.push. |
| agent | vue | `vue/VUE-PUSH-001` | express `test/req.baseUrl.js:74` `<module>` | urls.push('3@' + req.baseUrl) appends to an array in a test. It is not router.push. |
| agent | tailwind | `tailwind/TW-DYN-001` | react-markdown `lib/index.js:298` `createFile` | The concatenation builds the message of an unreachable(...) error about the children prop. It is not a class name. |
| agent | tailwind | `tailwind/TW-DYN-001` | react-markdown `lib/index.js:329` `post` | The concatenation builds the message of an unreachable(...) error about a deprecated prop. It is not a class name. |

## Limits

- Sample precision is true positives divided by the labeled findings of that pack. Unlabeled findings are not in the denominator and have no precision.
- A pack with no matching label is unmeasured. This report does not give it a precision.
- A sample of five or six findings does not estimate the precision of a pack with hundreds of findings. It says whether the sampled findings match the rule.
- Agent labels were written by an AI coding agent. They are not an independent human review, and the maintainer has not confirmed them. The Labeled by column separates them from maintainer labels.
- A resolved false positive says the rule no longer reports that site. It is not evidence about the findings that remain.
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
