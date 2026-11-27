# Rule precision

Two measurements are recorded here. Sample precision says how many labeled findings match the rule that produced them, and who wrote each label: the maintainer or an AI coding agent. Hook latency is the compiled Pre hook on 200-line and 2,000-line files. A pack with no labels has no precision, and a latency number from one OS is not the number for another.

## Pack status from the 0.0.17 measurement

Engine 0.0.17 reports 5,948 findings on the pinned corpus: 49 packs, 8 repositories, 238 source files. 203 of those findings have a label. The maintainer wrote 17 labels and an AI coding agent wrote 186. No person has reviewed the agent labels. The [per-pack table](#per-pack-counts) has the findings, labels, correct, false-positive and uncertain counts, the sample precision and the status of each pack.

One bar decides the status. A pack is **validated** when it has at least 6 labeled findings and its sample precision, correct / (correct + false-positive), is at least 70%. A pack below either number is **not validated**. A pack with no finding on the corpus is **unmeasured**, which is also not validated.

| Status | Packs |
| --- | --- |
| Validated (9) | `architecture`, `clean-code`, `go`, `javascript`, `maintainability`, `mattpocock`, `musk`, `node`, `senior` |
| Not validated, precision below 70% (4) | `pstack` 5/17, `typescript` 7/16, `express` 5/14, `vibe-proof` 6/15 |
| Not validated, fewer than 6 labels (2) | `python` 3 labels, `react-native` 1 label |
| Unmeasured (33 packs and the builtin core) | every other pack: the corpus has no finding for it |

Every methodology of a pack that is not validated now has the manifest status `preview`. `pregate pack list`, `pregate pack show`, the pack README and [the pack reference](../packs.md) print that status. `pregate pack add` selects only `complete` methodologies, so it registers such a pack and selects none of its rules. `pregate pack enable <ns>/<methodology>`, a preset, `pregate init` and `pregate guide` still select a `preview` methodology when asked. This change moved 77 methodologies in 31 packs from `complete` to `preview`. No rule, pattern or severity changed. A validated pack keeps the statuses it had: a methodology that was `preview` stays `preview`.

### How the sample was drawn and labeled

- The agent did not choose the sites. For each pack, the findings are sorted as text by repository, rule, path, line and symbol, and the sample is 12 findings at equal steps through that list, or every finding when the pack has fewer. The earlier sample was 5 per pack. This round added 139 labels in 13 packs. They are in the `bench/labels/*.agent-2.json` files.
- Equal steps follow volume. A rule with few findings can fall between two steps: 43 of the 59 rules that reported a finding have a label, and 16 have none.
- The agent opened the pinned source at each site. It wrote `true-positive` (correct) only when the reason the rule states applies to that line. A line that only has the shape the pattern matches is `false-positive`. A rule that states a project choice, such as no `var`, no `require` or a size limit, is correct where the code has that construct or exceeds that limit. `uncertain` is a new verdict for a site where the reading depends on a judgment the agent could not settle. It counts as labeled and is on neither side of the fraction.
- This bar is stricter than the bar of the earlier labels, which asked only whether the finding matches the rule's stated condition. For example, the earlier agent sample marks `res.status(500)` with `res.send` on the next line as a true positive of `EX-STATUS-001`. The earlier labels were not changed, and a pack fraction mixes both.
- The same agent session wrote the labels and applied the bar. Read each fraction as a first look that a person can check row by row.

### What the status does not say

- A validated pack is validated only for the rules that reported a finding here. `architecture` is 12/12 on two size rules out of 25 checks. `musk` is 15/15, and 14 of those labels are one rule in one repository. `node` is 13/15, and 7 of the correct labels are example servers in the Express repository that have no security headers, health routes, timeouts or signal handling.
- Three validated packs are close to the bar. With the labels of this round alone, `maintainability` is 5/8, `senior` is 7/10 and `clean-code` is 2/3 with 8 uncertain. The 8 uncertain `clean-code` labels are mocha `describe` callbacks longer than 20 lines. The maintainer labeled that shape correct before. If they count as false positives, `clean-code` is 7/16 and is not validated.
- `python` and `react-native` have no false positive. They have too few findings on this corpus to say anything.
- The corpus is small and mostly JavaScript. It has no Rust file: the entry `toml` is `BurntSushi/toml`, a Go repository, and `bench/corpus.json` gives its language as `rust`. It has no project that uses React, Next.js, Vue, Svelte, a database client or any other framework pack except Express itself.
- The report committed before this change had 5,508 findings. The same corpus and the same labels give 5,948 with the current rules: `node` went from 31 to 191, `maintainability` from 105 to 358, `architecture` from 0 to 21 and `typescript` from 91 to 97. The commits that added those findings were not looked for.

### Rules with the worst sample

These rules were not changed. The labels are the evidence.

| Rule | Findings | Labels of this round | What the sample shows |
| --- | ---: | --- | --- |
| `express/EX-STATUS-001` (deny) | 42 | 0 correct, 9 false | The pattern takes any statement whose text contains `res.status(` and none of `.send(`, `.json(`, `.end(`, `.redirect(`, `.download(`. It reports `res.status(404)` when `res.send(...)` is the next statement (5 of 9), `res.status(500).render(...)` because `render` is not a sender, and the `describe('res', ...)` call that wraps a whole test file (`test/res.sendFile.js:15`). |
| `vibe-proof/VP-CONSOLE-001` (deny) | 54 | 1 correct, 9 false | It reports every `console.log` outside a `*.test.*` file: the start message of an example server, usage text, output behind a `verbose` option, and a test runner's progress line. The one correct label prints a user name and a password. |
| `typescript/TS-THROW-001` (deny) | 51 | 0 correct, 6 false | Every sampled site is a tslib runtime helper that must throw the `TypeError` the language defines. The rule text reserves `throw` for defects, and the pattern cannot tell a defect from an expected failure. |
| `typescript/TS-CONST-001` (deny) | 2 | 0 correct, 1 false | `let classes = ''` is assigned again with `classes += ...` four lines below (`classnames/dedupe.js:9`). The second finding on the corpus, not in the sample, is `let key` before `for (key in ...)` (`react-markdown/lib/index.js:380`). Both bindings are reassigned. |
| `pstack/PS-COMMENT-001` (warn) | 511 | 3 correct, 8 false | Unchanged from the earlier measurement: it reports comments that explain a reason, a setup step, or the meaning of a condition. With all labels it is 5/17. |
| `senior/SR-CHAIN-001` (deny) | 967 | 0 correct, 3 false, 1 uncertain | The three false labels are supertest fluent calls, `request(app).get(...).expect(...)`. The two maintainer labels on this rule are correct, so the rule is right on member chains and wrong on builder calls. |
| `typescript/TS-FLOAT-001` (deny) | 5 | 0 correct, 1 false | `Promise.resolve(v).then(onFulfilled, reject)` passes a rejection handler. |
| `node/NODE-ENVPARSE-001` (warn) | 15 | 0 correct, 1 false | It reports `process.env.NODE_ENV = this.env`, a write in a test teardown, as a scattered read. |

### Where the guided setup selects these packs

The guided setup does not read the manifest status or this measurement. It still proposes packs that are not validated:

- `recommendPacks` in `src/scan-command.ts` proposes `typescript/strict-types` and `typescript/anti-evasion`, `python/quality` and `rust/quality` from the language of the source, and the framework packs (`react`, `nextjs`, `vue`, `express`, `prisma` and the others in its `DEPENDENCIES` table) from `package.json`. `pregate guide`, `pregate scan` and `pregate enable` on a new project use that list.
- `onboardingPreset` in `src/onboard.ts` adds `<language>/quality` and `clean-code/clean-code` to the first contract, and the starter presets `python-starter`, `rust-starter` and `mixed-starter` in `packs/presets` select `python/quality`, `rust/quality` and `typescript/anti-evasion`.

Of those, only `go`, `javascript` and `clean-code` are validated. This was not changed here. A filter on status would leave a TypeScript, Python or Rust project with no language pack, which is a product decision and not a small change. A new project starts in advisor mode, where a finding is a note and nothing blocks.

## History: rule changes since the 0.0.7 measurement

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

After that round `pstack` was 2/6 with default severity `warn`, and no other pack had a false positive among 64 labeled findings out of 5,508. The 0.0.17 measurement above replaces those numbers.

<!-- BEGIN measured precision -->

## Measured sample precision

This run audited 49 packs on 8 pinned trees (238 source files) and recorded **5948 findings**. Sample precision is shown for 15 labeled packs. Every other pack is unmeasured.

Engine 0.0.17, core 0.0.1.

Labeled sample: 140 true-positive, 49 false-positive, 14 uncertain. Packs that do not appear in that sample are unmeasured.

The maintainer wrote 17 of these labels and an AI coding agent wrote 186. Agent labels are not an independent human review. 35 earlier false-positive labels no longer match a finding and are listed as resolved.

## Method

1. Shallow-fetch each git entry at its pinned commit into `.cache/precision` (or `--cache`). Reuse a clean cache whose HEAD is that commit. Check the scanned source sha256 against the manifest. With `--skip-offline`, a failed fetch leaves the written report untouched. A path entry must already be a checkout of its commit.
2. For each pack, compile a shadow preset of the builtin core plus that pack's methodologies. If those methodologies do not compile together, compile each one on its own. Count static findings from the same file audit `pregate audit` uses. One finding is one site: corpus, pack, rule, path, line, and symbol.
3. Read every file in `bench/labels`. Each file names one pack and one labeler, `maintainer` or `agent`, and holds labels: `true-positive`, `false-positive` or `uncertain`, plus a note. A `true-positive` or `uncertain` label that does not match a finding is an error. A `false-positive` label that does not match a finding is recorded as resolved: the rules no longer report that site. Precision is `true-positive / (true-positive + false-positive)` for packs with at least one such label. An `uncertain` label counts as labeled and is not in that fraction.
4. An agent does not choose the findings it labels. Take the findings of one pack in the order of the `--findings` file (sorted as text by corpus, pack, rule, path, line and symbol). With n findings and k the smaller of 12 and n, the sample is the findings at positions floor(i × n / k) for i from 0 to k − 1. `bench/agent-sample.json` records the sites offered so far, and `--sample <file>` writes that record plus the sample of this run. An agent label for a site that is not in the record or in the sample of this run is an error. A rule change moves the positions; a label written before the change keeps the site it was offered.
5. One bar gives each pack a status. A pack is validated when it has at least 6 labeled findings and a sample precision of at least 70%. A pack below either number is not validated. A pack with no true-positive or false-positive label is unmeasured, which is also not validated.

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

A fraction is correct labels over correct plus false-positive labels, in the labeled sample only. Correct is the `true-positive` verdict. Labeled by says how many of those labels the maintainer wrote and how many an agent wrote. Unmeasured means this report states no precision for that pack.

| Pack | Findings | Labeled | Correct | False positives | Uncertain | Sample precision | Status | Labeled by |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| senior | 3420 | 17 | 13 | 3 | 1 | 13/16 | validated | maintainer 6, agent 11 |
| clean-code | 565 | 16 | 7 | 1 | 8 | 7/8 | validated | maintainer 5, agent 11 |
| pstack | 516 | 17 | 5 | 12 | 0 | 5/17 | not validated: precision below 70% | maintainer 1, agent 16 |
| javascript | 512 | 17 | 16 | 1 | 0 | 16/17 | validated | maintainer 5, agent 12 |
| maintainability | 358 | 17 | 10 | 3 | 4 | 10/13 | validated | agent 17 |
| node | 191 | 15 | 13 | 2 | 0 | 13/15 | validated | agent 15 |
| go | 101 | 16 | 16 | 0 | 0 | 16/16 | validated | agent 16 |
| typescript | 97 | 16 | 7 | 9 | 0 | 7/16 | not validated: precision below 70% | agent 16 |
| express | 56 | 14 | 5 | 9 | 0 | 5/14 | not validated: precision below 70% | agent 14 |
| vibe-proof | 55 | 15 | 6 | 9 | 0 | 6/15 | not validated: precision below 70% | agent 15 |
| musk | 40 | 15 | 15 | 0 | 0 | 15/15 | validated | agent 15 |
| architecture | 21 | 12 | 12 | 0 | 0 | 12/12 | validated | agent 12 |
| mattpocock | 12 | 12 | 11 | 0 | 1 | 11/11 | validated | agent 12 |
| python | 3 | 3 | 3 | 0 | 0 | 3/3 | not validated: fewer than 6 labels | agent 3 |
| react-native | 1 | 1 | 1 | 0 | 0 | 1/1 | not validated: fewer than 6 labels | agent 1 |
| agent-practices | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| angular | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| astro | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| authjs | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| consumer-saas | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| core | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| dcouplr | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| ddd | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| design-invariants | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| drizzle | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| enterprise-ready | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| firebase | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| hono | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| mongodb | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| nestjs | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| next-website | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| nextjs | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| nuxt | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| postgres | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| prisma | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| react | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| redis | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| rust | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| security-audit | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| solana | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| supabase | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| svelte | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| sveltekit | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| tailwind | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| tanstack-query | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| testing | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| trpc | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| vercel | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |
| vue | 0 | 0 | 0 | 0 | 0 | unmeasured | unmeasured | - |

## Unmeasured packs

Packs with findings and no matching label: none.

Packs with no finding on this corpus, so there is nothing to label (34): `agent-practices`, `angular`, `astro`, `authjs`, `consumer-saas`, `core`, `dcouplr`, `ddd`, `design-invariants`, `drizzle`, `enterprise-ready`, `firebase`, `hono`, `mongodb`, `nestjs`, `next-website`, `nextjs`, `nuxt`, `postgres`, `prisma`, `react`, `redis`, `rust`, `security-audit`, `solana`, `supabase`, `svelte`, `sveltekit`, `tailwind`, `tanstack-query`, `testing`, `trpc`, `vercel`, `vue`. A zero here is not evidence that those rules are precise.

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
| false-positive | javascript | `javascript/JS-AWAIT-001` | classnames `benchmarks/benchmarks.js:47` `runBenchmarks.bench` | The loop runs one benchmark at a time on purpose. Running them together would spoil the timings, so the work could not run together. |
| false-positive | maintainability | `maintainability/MAINT-MAGIC-001` | classnames `tests/bind.test-d.ts:38` `<module>` | bound(42) passes an arbitrary number to show that a number is rejected by the types. The value has no unit and no reason to name. |
| true-positive | node | `node/NODE-VM-001` | classnames `tests/index.js:113` `<module>` | vm.runInContext(code, context) evaluates a string in a vm context, which is the call this rule names. The string is a fixed literal in a test. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | classnames `index.d.ts:2` `<module>` | The comment is an empty // line inside the license banner. It has no words, so it does not restate the Copyright line after it. |
| false-positive | typescript | `typescript/TS-CONST-001` | classnames `dedupe.js:9` `classNames.classes` | let classes = '' is assigned again with classes += on line 13. It cannot be const. |
| true-positive | typescript | `typescript/TS-DEFAULT-001` | classnames `bind.d.ts:3` `<module>` | export default function classNames declares a default export. |
| true-positive | typescript | `typescript/TS-INAME-001` | classnames `tests/bind.test-d.ts:10` `IFoo` | interface IFoo has the I prefix. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | classnames `benchmarks/benchmarks.js:46` `runBenchmarks` | console.log prints the benchmark name. The file is a benchmark script, not a test file, so the stated condition holds. |
| true-positive | go | `go/GO-FN-001` | errors `format_test.go:161` `TestFormatWithStack` | TestFormatWithStack runs from line 161 to line 228. That is 68 lines and the limit is 50. |
| true-positive | go | `go/GO-FN-002` | errors `format_test.go:481` `testFormatCompleteCompare` | testFormatCompleteCompare takes t, n, arg, format, want and detectStackBoundaries. That is six parameters and the limit is four. |
| true-positive | go | `go/GO-NEST-001` | errors `format_test.go:507` `testFormatCompleteCompare` | The if on line 507 is in the else branch of the if on line 495, inside the for loop. That is a third level and the limit is two. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | express `lib/response.js:1` `<module>` | lib/response.js has 1050 lines and the limit is 400. It holds every res method, from status to sendFile. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | express `test/Router.js:1` `<module>` | test/Router.js has 636 lines and the limit is 400. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | express `test/app.router.js:1` `<module>` | test/app.router.js has 1217 lines and the limit is 400. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | express `test/express.json.js:1` `<module>` | test/express.json.js has 755 lines and the limit is 400. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | express `test/express.static.js:1` `<module>` | test/express.static.js has 815 lines and the limit is 400. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | express `test/express.text.js:1` `<module>` | test/express.text.js has 566 lines and the limit is 400. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | express `test/res.download.js:1` `<module>` | test/res.download.js has 487 lines and the limit is 400. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | express `test/res.sendFile.js:1` `<module>` | test/res.sendFile.js has 1019 lines and the limit is 400. |
| uncertain | clean-code | `clean-code/CC-FN-001` | express `test/acceptance/auth.js:8` `<module>` | The describe callback runs from line 8 to line 117, over the limit of 20. It is a test suite container with no steps of its own, so the stated reason, mixed levels of abstraction, is doubtful. The maintainer labeled the same shape true-positive. |
| uncertain | clean-code | `clean-code/CC-FN-001` | express `test/app.render.js:397` `<module>` | The describe callback runs from line 397 to line 477. It only groups it() cases, so it is a long function by count and not by the stated reason. |
| uncertain | clean-code | `clean-code/CC-FN-001` | express `test/app.routes.error.js:7` `<module>` | The describe callback spans the whole 62-line file. It only groups test cases. |
| uncertain | clean-code | `clean-code/CC-FN-001` | express `test/express.static.js:17` `<module>` | The describe callback runs from line 17 to line 135. It only groups test cases. |
| uncertain | clean-code | `clean-code/CC-FN-001` | express `test/req.acceptsEncodings.js:6` `<module>` | The describe callback spans the 39-line file. It only groups test cases. |
| uncertain | clean-code | `clean-code/CC-FN-001` | express `test/req.stale.js:6` `<module>` | The describe callback spans the 50-line file. It only groups test cases. |
| uncertain | clean-code | `clean-code/CC-FN-001` | express `test/res.links.js:7` `<module>` | The describe callback runs from line 7 to line 64. It only groups test cases. |
| uncertain | clean-code | `clean-code/CC-FN-001` | express `test/res.sendFile.js:951` `<module>` | The describe callback runs from line 951 to line 1007. It only groups test cases. |
| false-positive | clean-code | `clean-code/CC-FN-002` | express `test/app.param.js:144` `<module>` | Express fixes the app.param callback signature as (req, res, next, value). The author cannot remove a parameter, so no unnamed concept hides in the list. |
| true-positive | clean-code | `clean-code/CC-FN-002` | express `test/res.location.js:141` `testRequestedRedirect` | testRequestedRedirect is a local helper with five parameters: app, inputUrl, expected, expectedHost and done. The limit is three. |
| true-positive | express | `express/EX-NEXT-001` | express `examples/mvc/controllers/pet/index.js:13` `<module>` | return next('route') passes the string route to next, which is the call this rule names. |
| true-positive | express | `express/EX-NEXT-001` | express `test/app.param.js:13` `<module>` | return next('route') passes the string route to next. |
| true-positive | express | `express/EX-NEXT-001` | express `test/app.router.js:854` `fn` | next('route') passes the string route to next. |
| false-positive | express | `express/EX-STATUS-001` | express `examples/error-pages/index.js:64` `<module>` | res.status(404) is followed by res.format(...), whose branches render or send. The response is sent. |
| false-positive | express | `express/EX-STATUS-001` | express `examples/mvc/index.js:78` `<module>` | Line 78 is the app.use(...) call. Inside it, res.status(500).render('5xx') sends the response. render is not in the rule's sender list, and the rule reports the enclosing statement. |
| false-positive | express | `express/EX-STATUS-001` | express `examples/web-service/index.js:109` `<module>` | res.send(...) is the next statement. The request does not stay open. |
| true-positive | express | `express/EX-STATUS-001` | express `test/app.route.js:101` `handleError` | res.status(500) is a statement with no chained sender, which is the stated condition. res.send follows on the next line, so the request does not stay open. |
| false-positive | express | `express/EX-STATUS-001` | express `test/app.route.js:182` `handleError` | res.send(...) is the next statement. The request does not stay open. |
| false-positive | express | `express/EX-STATUS-001` | express `test/express.raw.js:357` `<module>` | res.send(...) is the next statement. The request does not stay open. |
| false-positive | express | `express/EX-STATUS-001` | express `test/express.static.js:756` `<module>` | The middleware sets 501 and calls next(), and express.static then sends the file. The test is about that hand-over. |
| true-positive | express | `express/EX-STATUS-001` | express `test/express.urlencoded.js:635` `<module>` | res.status(err.status \|\| 500) is a statement with no chained sender, which is the stated condition. res.send follows on the next line. |
| false-positive | express | `express/EX-STATUS-001` | express `test/res.format.js:109` `<module>` | res.send(...) is the next statement. The request does not stay open. |
| false-positive | express | `express/EX-STATUS-001` | express `test/res.format.js:75` `<module>` | res.send(...) is the next statement. The request does not stay open. |
| false-positive | express | `express/EX-STATUS-001` | express `test/res.sendFile.js:15` `<module>` | Line 15 is the describe('res', ...) call that wraps the whole test file. It is not a handler that sets a status. |
| true-positive | javascript | `javascript/JS-CJS-001` | express `examples/route-separation/site.js:3` `<module>` | exports.index = function ... publishes through the CommonJS exports object. Express is a CommonJS package; the label does not judge that choice. |
| true-positive | javascript | `javascript/JS-CJS-001` | express `test/support/utils.js:18` `<module>` | exports.shouldNotHaveHeader = ... is a CommonJS export. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `examples/mvc/index.js:8` `logger` | require('morgan') is a require call. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `examples/view-constructor/index.js:9` `md` | require('marked') is a require call. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `lib/response.js:25` `statuses` | require('statuses') is a require call in library code. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `test/acceptance/error-pages.js:3` `request` | require('supertest') is a require call. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `test/app.param.js:3` `express` | require('../') is a require call. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `test/express.raw.js:8` `<module>` | require('node:buffer') is a require call. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `test/req.ip.js:4` `request` | require('supertest') is a require call. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `test/res.download.js:3` `after` | require('after') is a require call. |
| true-positive | javascript | `javascript/JS-REQ-001` | express `test/res.sendFile.js:13` `utils` | require('./support/utils') is a require call. |
| true-positive | maintainability | `maintainability/MAINT-MAGIC-001` | express `examples/route-separation/index.js:53` `<module>` | app.listen(3000) uses a bare port number. A named port constant is what the rule asks for. |
| false-positive | maintainability | `maintainability/MAINT-MAGIC-001` | express `test/Router.js:508` `<module>` | 42 stands for any value that is not a function in a test of the argument check. A name would add nothing. |
| true-positive | maintainability | `maintainability/MAINT-MAGIC-001` | express `test/express.json.js:402` `app.verify` | buf[0] === 0x5b compares with the byte of an opening bracket. The reader must know the character code. |
| true-positive | maintainability | `maintainability/MAINT-MAGIC-001` | express `test/express.text.js:318` `app.verify` | buf[0] !== 0x20 compares with the byte of a space. The reader must know the character code. |
| false-positive | maintainability | `maintainability/MAINT-MAGIC-001` | express `test/express.urlencoded.js:401` `parameterLimit` | parameterLimit: 10.1 is named by its property key, and the test title says it is a floating point limit. |
| uncertain | maintainability | `maintainability/MAINT-MAGIC-001` | express `test/res.send.js:185` `<module>` | Buffer.alloc(999, ...) is a test body size. The expected ETag two lines below depends on it, so a name could help, but the size itself is arbitrary. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | express `examples/route-map/index.js:24` `<module>` | if (verbose) is inside a switch, which is inside a for-in loop. That is a third level and the limit is two. |
| uncertain | maintainability | `maintainability/MAINT-NEST-001` | express `lib/response.js:679` `header` | The if on line 679 is at a third level, and its body is only a throw. The rule text says such a guard clause does not add a level. The engine exempts a guard only directly under a function or a loop, not under another if. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | express `examples/params/index.js:23` `<module>` | The app.param callback takes req, res, next, num and name. That is five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | express `examples/resource/index.js:53` `User.range` | range takes req, res, a, b and format. That is five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | express `test/res.location.js:141` `testRequestedRedirect` | testRequestedRedirect takes app, inputUrl, expected, expectedHost and done. That is five inputs and the limit is four. |
| true-positive | musk | `musk/MUSK-FAST-001` | express `examples/mvc/lib/boot.js:14` `<module>` | fs.readdirSync(dir) is a synchronous filesystem call, and boot.js is not a test file. |
| true-positive | node | `node/NODE-ENV-001` | express `test/app.js:97` `<module>` | process.env.NODE_ENV = this.env assigns to the environment at runtime. The assignment restores the value after a test. |
| false-positive | node | `node/NODE-ENVPARSE-001` | express `test/app.js:113` `<module>` | process.env.NODE_ENV = this.env is a write that restores the variable after a test. The rule is about a scattered read of the environment. |
| true-positive | node | `node/NODE-HEADERS-001` | express `examples/error-pages/index.js:1` `<module>` | The file starts a server with app.listen(3000) and sets no security header. It is an example server. |
| true-positive | node | `node/NODE-HEADERS-001` | express `examples/vhost/index.js:1` `<module>` | The file starts a server with app.listen(3000) and sets no security header. It is an example server. |
| true-positive | node | `node/NODE-OBSERVE-001` | express `examples/markdown/index.js:1` `<module>` | The file starts a server with app.listen(3000) and has no logger and no request id. It is an example server. |
| true-positive | node | `node/NODE-OBSERVE-001` | express `examples/web-service/index.js:1` `<module>` | The file starts a server with app.listen(3000) and has no logger and no request id. It is an example server. |
| true-positive | node | `node/NODE-ROUTE-001` | express `examples/online/index.js:1` `<module>` | The file starts a server with app.listen(3000) and registers neither /health nor /ready. It is an example server. |
| false-positive | node | `node/NODE-ROUTE-001` | express `test/res.sendFile.js:1` `<module>` | This is a mocha test file. Its app.listen() calls start short-lived servers inside test cases, which no platform probes. |
| true-positive | node | `node/NODE-SIGNAL-001` | express `examples/route-map/index.js:1` `<module>` | The file starts a server with app.listen(3000) and handles no SIGTERM or SIGINT. It is an example server. |
| true-positive | node | `node/NODE-SYNC-001` | express `lib/view.js:201` `tryStat` | fs.statSync(path) is a synchronous filesystem call in library code. |
| true-positive | node | `node/NODE-TIMEOUT-001` | express `examples/route-map/index.js:1` `<module>` | The file starts a server with app.listen(3000) and sets no header, request or keep-alive timeout. It is an example server. |
| true-positive | node | `node/NODE-URL-001` | express `test/res.location.js:159` `testRequestedRedirect.locationHost` | url.parse(...) is the legacy parser. |
| true-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/downloads/index.js:29` `<module>` | non-404 error repeats the condition err.status !== 404 on the same line. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/error/index.js:14` `<module>` | The block explains why Express error middleware takes four arguments. The code after it does not say that. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/mvc/db.js:3` `<module>` | faux database says the module is a stand-in for a real store. The next statement, var pets = exports.pets = [], does not say that. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/mvc/lib/boot.js:33` `<module>` | "reserved" exports gives the meaning of the name list in the next line. The code does not say the names are reserved. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/search/index.js:3` `<module>` | install redis first: is a setup instruction for the reader of the example. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/vhost/index.js:11` `<module>` | The block comment tells the reader which lines to add to /etc/hosts before the example runs. It does not restate the code after it. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/view-constructor/index.js:26` `<module>` | The comment says the views value is a GitHub repository. app.set('views', 'expressjs/express') does not say that. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `examples/web-service/index.js:107` `<module>` | The block explains why the 404 middleware is registered last. It does not restate the code. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `lib/application.js:220` `use` | non-express app gives the meaning of the duck-type test !fn \|\| !fn.handle \|\| !fn.set. The condition does not say that. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `lib/application.js:373` `set` | trust proxy inherit back-compat gives the purpose of the Object.defineProperty call that follows. The call itself does not name back-compat. |
| true-positive | pstack | `pstack/PS-COMMENT-001` | express `lib/response.js:195` `send` | freshness repeats req.fresh in the next line. |
| true-positive | pstack | `pstack/PS-COMMENT-001` | express `lib/response.js:928` `sendfile` | request aborted repeats the name of function onaborted in the next line. |
| true-positive | pstack | `pstack/PS-COMMENT-001` | express `lib/view.js:93` `View` | lookup path sits on this.path = this.lookup(fileName) and repeats the two names in that statement. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | express `test/express.static.js:726` `<module>` | The line is an empty // that opens a NOTE block. It has no words. |
| false-positive | senior | `senior/SR-CHAIN-001` | express `test/acceptance/web-service.js:99` `<module>` | request(app).get(...).expect(...).expect(...) is the supertest fluent builder. Each call returns the same test object, so the caller does not walk through objects it does not own. |
| false-positive | senior | `senior/SR-CHAIN-001` | express `test/express.static.js:667` `<module>` | request(this.app).get(...).set(...).expect(...) is the supertest fluent builder, not a chain of getters. |
| false-positive | senior | `senior/SR-CHAIN-001` | express `test/res.format.js:208` `test` | request(app).get(...).set(...).expect(...) is the supertest fluent builder, not a chain of getters. |
| true-positive | senior | `senior/SR-VAR-001` | express `examples/content-negotiation/index.js:3` `<module>` | var express declares a binding with var. |
| true-positive | senior | `senior/SR-VAR-001` | express `lib/response.js:19` `<module>` | var escapeHtml declares a binding with var. |
| true-positive | senior | `senior/SR-VAR-001` | express `test/app.listen.js:16` `<module>` | var app2 declares a binding with var. |
| true-positive | senior | `senior/SR-VAR-001` | express `test/app.use.js:38` `<module>` | var blog, forum and app are declared with var. |
| true-positive | senior | `senior/SR-VAR-001` | express `test/express.urlencoded.js:599` `<module>` | var test declares a binding with var. |
| true-positive | senior | `senior/SR-VAR-001` | express `test/res.download.js:472` `<module>` | var app declares a binding with var. |
| true-positive | senior | `senior/SR-VAR-001` | express `test/res.sendFile.js:674` `<module>` | var app declares a binding with var. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/auth/index.js:61` `authenticate` | console.log('authenticating %s:%s', name, pass) prints the user name and the password. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/ejs/index.js:56` `<module>` | console.log('Express started on port 3000') is the intended start message of the example, not a leftover debug print. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/error/index.js:52` `<module>` | console.log('Express started on port 3000') is a console.log call in an example server, not in a test file. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/markdown/index.js:43` `<module>` | The line is the intended start message of the example. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/mvc/lib/boot.js:76` `<module>` | verbose && console.log(...) is output the caller asks for with the verbose option. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/route-map/index.js:24` `<module>` | if (verbose) console.log('%s %s', key, route) is a console.log call outside a test file. The verbose guard does not change the call. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/session/index.js:36` `<module>` | The line is the intended start message of the example. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/static-files/index.js:42` `<module>` | The line is part of the usage text the example prints at start. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/static-files/index.js:43` `<module>` | console.log('  GET /css/style.css') is a console.log call in an example server, not in a test file. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | express `examples/view-constructor/index.js:47` `<module>` | The line is the intended start message of the example. |
| true-positive | python | `python/PY-CLASS-001` | markupsafe `src/markupsafe/__init__.py:84` `Markup` | Markup declares 29 methods whose names do not start with an underscore, from join to format_map. The limit is 10. |
| true-positive | python | `python/PY-NEST-001` | markupsafe `src/markupsafe/__init__.py:213` `Markup.striptags` | The if on line 213 is inside if value.startswith("<!--", start), which is inside the while loop. That is a third level and the limit is two. |
| true-positive | python | `python/PY-NEST-001` | markupsafe `src/markupsafe/__init__.py:220` `Markup.striptags` | The if on line 220 is in the else branch of the if on line 211, inside the while loop. That is a third level and the limit is two. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/format.test.ts:218` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/format.test.ts:239` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/index.test.ts:344` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket, which is the directive this rule reports. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/index.test.ts:358` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/index.test.ts:54` `<module>` | @ts-expect-error - We expect this to fail. names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse-strict.test.ts:168` `<module>` | @ts-expect-error - We expect this to throw. gives a reason and no owner or ticket. The rule asks for an owner or a ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse-strict.test.ts:196` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse-strict.test.ts:217` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse-strict.test.ts:55` `<module>` | The @ts-expect-error comment explains that JS users can still pass the value. It names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse-strict.test.ts:59` `<module>` | The @ts-expect-error comment gives a reason and names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse-strict.test.ts:70` `<module>` | The @ts-expect-error comment gives a reason and names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse.test.ts:162` `<module>` | @ts-expect-error - We expect this to throw. has no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse.test.ts:169` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket. |
| true-positive | musk | `musk/MUSK-REQ-001` | ms `src/parse.test.ts:190` `<module>` | @ts-expect-error - We expect this to throw. names no owner and no ticket. |
| false-positive | typescript | `typescript/TS-DEFAULT-001` | ms `jest.config.ts:24` `<module>` | export default config is the form Jest reads from a TypeScript config file. No importer renames it. |
| false-positive | pstack | `pstack/PS-COMMENT-001` | react-markdown `test.jsx:1129` `<module>` | Note: hooks are not supported on the server. states a limit that the test below does not say. |
| true-positive | react-native | `react-native/RN-PLAT-001` | react-markdown `test.jsx:537` `p` | return <div {...rest} /> returns a DOM tag, which is the stated condition. react-markdown renders to the web, so the pack does not fit this repository; the label does not judge that. |
| true-positive | typescript | `typescript/TS-DEFAULT-001` | react-markdown `index.js:10` `<module>` | The export list contains Markdown as default, which the rule names as a default export. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | react-markdown `script/load-jsx.js:43` `createLoader.load` | console.log(warning.location) reports a build warning from a loader script. That is the purpose of the lines. |
| true-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | react-markdown `script/load-jsx.js:98` `createLoader.transformSource` | console.log(warning.text) prints a build warning from a loader script. The file is not a test file. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | react-markdown `test.jsx:1205` `<module>` | console.info(...) tells the person who runs the tests that the next error is expected. test.jsx is a test file. |
| true-positive | go | `go/GO-FN-001` | toml `decode.go:231` `MetaData.unify` | unify runs from line 231 to line 303. That is 73 lines and the limit is 50. |
| true-positive | go | `go/GO-FN-001` | toml `decode_test.go:98` `TestDecodeEmbedded` | TestDecodeEmbedded runs from line 98 to line 149. That is 52 lines and the limit is 50. |
| true-positive | go | `go/GO-FN-001` | toml `error_test.go:100` `TestParseError` | TestParseError runs from line 100 to line 356. That is 257 lines and the limit is 50. |
| true-positive | go | `go/GO-FN-001` | toml `toml_test.go:262` `TestToml` | TestToml runs from line 262 to line 393. That is 132 lines and the limit is 50. |
| true-positive | go | `go/GO-FN-002` | toml `encode_test.go:1364` `encodeExpected` | encodeExpected takes t, label, val, want and wantErr. That is five parameters and the limit is four. |
| true-positive | go | `go/GO-NEST-001` | toml `decode.go:342` `MetaData.unifyStruct` | The else if on line 342 belongs to if isUnifiable(subv), inside if f != nil, inside the for loop over the mapping. That is a third level. |
| true-positive | go | `go/GO-NEST-001` | toml `encode.go:305` `Encoder.eElement` | The if on line 305 is inside else if math.IsInf, inside the switch on the kind. That is a third level and the limit is two. |
| true-positive | go | `go/GO-NEST-001` | toml `encode.go:491` `Encoder.eStruct` | The if on line 491 is inside if isEmbed, which is inside the for loop over the struct fields. That is a third level and the limit is two. |
| true-positive | go | `go/GO-NEST-001` | toml `internal/toml-test/runner.go:295` `Runner.Run` | The if on line 295 is in the else branch of if t.Failed(), inside if r.SkipMustError, inside the test loop. That is more than two levels. |
| true-positive | go | `go/GO-NEST-001` | toml `internal/toml-test/runner.go:621` `floatToInt` | The if on line 621 is inside a type switch, inside a for loop, inside the outer type switch. That is more than two levels. |
| true-positive | go | `go/GO-NEST-001` | toml `lex.go:740` `lexMultilineString` | The if on line 740 is inside if lx.peek(), which is inside two nested if lx.accept blocks. That is a fourth level and the limit is two. |
| true-positive | go | `go/GO-NEST-001` | toml `meta.go:108` `Key.String` | The for on line 108 is in the else branch of if kk == "", inside the outer for loop. That is a third level. |
| true-positive | go | `go/GO-NEST-001` | toml `parse.go:749` `parser.stripEscapedNewlines` | The switch on line 749 is inside the whitespace for loop, inside the outer for loop. That is a third level. |
| true-positive | architecture | `architecture/ARCH-EXPORT-001` | tslib `modules/index.d.ts:4` `<module>` | The export list names 32 helpers and the limit is 20. |
| true-positive | architecture | `architecture/ARCH-EXPORT-001` | tslib `modules/index.js:36` `<module>` | The export list republishes every tslib helper, more than 30 names, and the limit is 20. |
| true-positive | architecture | `architecture/ARCH-EXPORT-001` | tslib `tslib.es6.mjs:24` `<module>` | The file has 33 export statements and the limit is 20. Line 24 is the first one. |
| true-positive | architecture | `architecture/ARCH-FILE-001` | tslib `tslib.es6.mjs:1` `<module>` | tslib.es6.mjs has 410 lines and the limit is 400. It holds about 30 unrelated helpers. |
| true-positive | clean-code | `clean-code/CC-FN-001` | tslib `tslib.es6.js:305` `__addDisposableResource` | __addDisposableResource runs from line 305 to line 327. That is 23 lines and the limit is 20. |
| true-positive | maintainability | `maintainability/MAINT-MAGIC-001` | tslib `tslib.es6.js:234` `__asyncGenerator.resume` | q[0][3] reads the reject callback by its position in a four-item tuple. The index 3 has no name. |
| uncertain | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.es6.js:132` `__generator.step` | The if on line 132 is inside a try, inside a while loop, and its body is only return t. By the rule text a guard clause does not add a level; the engine counts this one because its parent is a try. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.es6.js:143` `__generator.step` | The if on line 143 is in the default branch of a switch, inside a try, inside a while loop. That is more than two levels. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.es6.js:82` `__esDecorate` | The if on line 82 is inside if (kind === "accessor"), which is inside the for loop over the decorators. That is a third level and the limit is two. |
| uncertain | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.es6.mjs:132` `__generator.step` | Same shape as tslib.es6.js:132: an if with only a return, inside a try, inside a while loop. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.es6.mjs:345` `__disposeResources.next` | if (r.async) is inside if (r.dispose), inside a try, inside a while loop. That is more than two levels. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.js:107` `<module>` | The if (d = decorators[i]) is inside the for loop, which is the else branch of the if on line 106. That is a third level and the limit is two. |
| true-positive | maintainability | `maintainability/MAINT-NEST-001` | tslib `tslib.js:183` `step` | The switch on line 183 is inside a try, which is the body of a while loop. That is a third level and the limit is two. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.es6.js:293` `__classPrivateFieldSet` | __classPrivateFieldSet takes receiver, state, value, kind and f. That is five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.es6.js:371` `__rewriteRelativeImportExtension` | The replace callback takes m, tsx, d, ext and cm. That is five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.es6.js:66` `__esDecorate` | __esDecorate takes six inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.es6.mjs:293` `__classPrivateFieldSet` | __classPrivateFieldSet takes five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.es6.mjs:370` `__rewriteRelativeImportExtension` | The replace callback takes m, tsx, d, ext and cm. That is five inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.es6.mjs:66` `__esDecorate` | __esDecorate takes six inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.js:115` `<module>` | The function assigned to __esDecorate takes ctor, descriptorIn, decorators, contextIn, initializers and extraInitializers. That is six inputs and the limit is four. |
| true-positive | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.js:342` `<module>` | The function assigned to __classPrivateFieldSet takes five inputs and the limit is four. |
| uncertain | mattpocock | `mattpocock/MP-PARAMS-001` | tslib `tslib.js:419` `<module>` | The String.replace callback takes m, tsx, d, ext and cm. Its arity follows the capture groups of the regular expression, so it is not a caller-facing interface. An earlier agent label marks the same callback true-positive. |
| true-positive | node | `node/NODE-EXEC-001` | tslib `test/runTests.js:45` `results` | spawnSync("npm", ["test"], ...) is a synchronous subprocess call, which is the call this rule names. |
| true-positive | node | `node/NODE-PREFIX-001` | tslib `test/webpack-modules/webpack.config.js:1` `path` | require('path') loads the builtin without the node: prefix. |
| uncertain | senior | `senior/SR-CHAIN-001` | tslib `tslib.es6.js:217` `__spreadArray` | Array.prototype.slice.call walks three members, which is the counted shape. It is a standard idiom on a builtin, not the layout of an object the caller does not own. |
| false-positive | typescript | `typescript/TS-FLOAT-001` | tslib `tslib.es6.js:252` `__asyncValues.settle` | Promise.resolve(v).then(onFulfilled, reject) passes reject as the rejection handler. The rejection is handled. |
| false-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.js:130` `__generator.step` | Generator is already executing. is a re-entrancy defect in a runtime helper, and the rule reserves throw for defects. The throw is in the nested step function. |
| true-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.js:178` `__values` | throw new TypeError(...) is the last statement of export function __values. |
| false-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.js:288` `__classPrivateFieldGet` | The helper must throw the TypeError that the language defines for a private accessor without a getter. It cannot return a value in its place. |
| false-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.js:314` `__addDisposableResource` | Symbol.dispose is not defined. reports a missing runtime feature. That is a defect, not an expected failure. |
| true-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.js:76` `__esDecorate` | The throw is in the addInitializer function expression, which is declared inside export function __esDecorate. |
| false-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.mjs:149` `__generator.step` | throw op[1] passes the error of the generator body on to the caller. The generator protocol needs that throw. |
| false-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.mjs:289` `__classPrivateFieldGet` | The helper must throw the TypeError that the language defines for a private member read on the wrong object. |
| true-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.mjs:310` `__addDisposableResource` | throw new TypeError("Symbol.asyncDispose is not defined.") is in the body of export function __addDisposableResource. |
| false-positive | typescript | `typescript/TS-THROW-001` | tslib `tslib.es6.mjs:318` `__addDisposableResource` | Object not disposable. is the TypeError the using declaration defines. The helper cannot return a value in its place. |
| true-positive | typescript | `typescript/TS-WRAPPER-001` | tslib `tslib.d.ts:185` `<module>` | generator: Function uses the Function type. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | tslib `test/runTests.js:31` `<module>` | console.log("Skipping") is the progress output of a command-line test runner. |

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

- Sample precision is true positives divided by true positives plus false positives of that pack. Uncertain labels and unlabeled findings are not in the denominator and have no precision.
- A pack with no true-positive or false-positive label is unmeasured. This report does not give it a precision.
- A sample of at most 12 findings does not estimate the precision of a pack with hundreds of findings. It says whether the sampled findings are correct.
- Validated means only this: at least 6 labeled findings and a sample precision of at least 70% on this corpus. It describes the rules of that pack that reported a finding here. The rules of that pack that reported nothing are not measured.
- Agent labels were written by an AI coding agent. They are not an independent human review, and the maintainer has not confirmed them. The Labeled by column separates them from maintainer labels.
- A resolved false positive says the rule no longer reports that site. It is not evidence about the findings that remain.
- A label is not a judgment that a project should adopt the rule. A rule that states a project choice, such as no var or no require, is correct where the code has that construct.
- The labels were written under two bars. The maintainer labels and the agent labels in the `.agent.json` files say whether the finding matches the rule's stated condition. The agent labels in the `.agent-2.json` files are stricter: true-positive only when the rule's stated reason applies to that line. A pack fraction can mix both.
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

CI runs this on `ubuntu-latest` (2 vCPU), `macos-latest`, and `windows-latest`. The `ubuntu-latest` job is the required check named `bench`. Linux and Windows run under `bench` and `latency (windows-latest)`. Each of those jobs takes 25 samples, repeats that three times, and keeps the median of the three p95 values. The job fails when that median is more than 55% above the committed baseline in `bench/latency-baseline.json` for the same OS and architecture. The macOS job takes the same 25 samples and three repeats, interleaves them with v0.0.12 built in that job, and fails when a route's p95 is above 1.31 times the v0.0.12 p95. It fails if that reference cannot be built or measured. The darwin rows below stay as the record of the retired absolute gate. The 150 ms budget in the architecture notes still belongs to the reference development machine. `--inform` keeps a miss of that budget from failing these runners.

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

Each baseline p95 is the median of eight hosted median p95s, including run 41575641391. The p50 is from the run whose p95 was nearest that median. The slowest of those medians was 44.7% above its baseline (macOS, 2,000 lines, second touch, 382.6 ms against 264.4 ms). Linux and Windows allow 55%: that excess plus 10 percentage points, so a repeat of the slowest recorded run stays under the limit (264.4 × 1.55 = 409.8 ms) and a larger jump still fails. One slow sample inside a job does not fail it: the compared figure is the median of three p95s. The macOS merge gate does not apply this absolute allowance. Its limit is 1.31 times v0.0.12 on the same runner, which is the same 10 percentage point margin above the worst same-runner p95 ratio measured on green macOS jobs (1.2019, rounded up).

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
