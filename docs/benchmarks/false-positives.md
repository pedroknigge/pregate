# False-positive measurement

**False-positive rate: unmeasured.**

This run audited 45 optional packs and the builtin core against 8 pinned repositories (238 source files) and recorded **11737 raw findings**. The findings are not fully labeled, so the false-positive rate is unmeasured. Fixture density for `pregate rules test` is separate: 1114 checks, 1117 rules, 6281 fixtures, 0 rules with no positive fixture, and 0 rules with no negative fixture.

Labeled sample (not a rate): 11 correct, 12 false-positive, 0 uncertain, 11714 unlabeled findings.

## Method

1. Shallow-fetch each git corpus entry at its pinned commit into the gitignored cache (`.cache/false-positives` unless `--cache` is set). Reuse a clean cache whose HEAD is that commit. Verify the scanned source sha256 against the manifest. With `--skip-offline`, a failed fetch leaves committed results untouched. A path entry must already be a checkout of its commit and is never skipped.
2. For each pack, compile a shadow preset containing the builtin core and that pack's methodologies. Core methodologies are always part of a compiled preset. If the pack methodologies do not compile together, compile each methodology on its own.
3. Parse every tracked source file with an extension the engine supports, skipping `node_modules`, `vendor`, `dist`, `build`, `coverage`, `.next`, and `target`. Record static findings. Fitness, diff, and placement checks are counted as not field-audited.
4. Run the same check execution as `pregate rules test` on every check, and count `pass` fixtures as negative and `fail` plus `trap` fixtures as positive.
5. Apply labels from the label file. Each label names one site. The rate is `falsePositives / labeledFindings` only when every finding in that set is labeled `correct` or `false-positive`.

Engine 0.0.1, core 0.0.1. Evaluator fingerprint `ed602e645e7acf4c7196039075c2cf1135bf8e31ecfc69a4e57f0ffb36124a79` covers `src`, `schema`, the parser wasm, and the Bun version that ran this script.

## Corpus

| Id | Kind | Commit | Source files | Parsed | Syntax errors | Content hash |
| --- | --- | --- | ---: | ---: | ---: | --- |
| classnames | git | `abd6314010de053a09df5acc53e474ff65cea470` | 15 | 15 | 0 | `8d54dd17818c5dd273ae657de6980e1ba411b1a228be771667335bc43212a029` |
| errors | git | `87f8819acf6dc28bf5d3c14b334268236d686f48` | 10 | 10 | 0 | `7d4db480f1a57a282e6a4bc3d61087fcccf7c7fbe759910084811b65f414af30` |
| express | git | `1c6f1b0fe4000977b9a7b4f34097e4d527dd9824` | 142 | 142 | 0 | `b6a5d80e5fd5bfaa06111b889b34fe1f1717b94be83096f564ee2a98a568a0e3` |
| markupsafe | git | `4e111271b1494995708a9e878a10829b5e10c7ba` | 12 | 12 | 0 | `8e6f1f308abce08e450d3355468c0a444984970861c7bf80165819efcc9c70a8` |
| ms | git | `4ff48cec099f0514c3e9bbca18706c9c21122bfb` | 8 | 8 | 0 | `34988a5a925b620fae71bcdcad2de35ae9a6f4eae285ce71c8aa51a7a56d8877` |
| react-markdown | git | `f9ca66ec73d218127bff56b41a583bba1fb96125` | 5 | 5 | 0 | `8868bb5ff3a25201fad128947af8b66c941b27bd8b6962d99743971b7b079d33` |
| toml | git | `d733fc535e4a9f3c454e421a87b90ade5d49bf31` | 30 | 30 | 0 | `bd886f8b9122157f25ca32e4cc4b45e6ac2af9c39cbcfb253ab1fe24035680e3` |
| tslib | git | `1fd51ada1a20ce315805cdf63d0555a8b5fb33bb` | 16 | 16 | 0 | `94497775adc114b1f226893f2ecbcfd4ad8d7ab4607d218be865bb9a331fdc69` |

- classnames: https://github.com/JedWatson/classnames.git
- errors: https://github.com/pkg/errors.git
- express: https://github.com/expressjs/express.git
- markupsafe: https://github.com/pallets/markupsafe.git
- ms: https://github.com/vercel/ms.git
- react-markdown: https://github.com/remarkjs/react-markdown.git
- toml: https://github.com/BurntSushi/toml.git
- tslib: https://github.com/microsoft/tslib.git

## Fixture density

Fixtures per rule: min 5, median 5, max 48. Positive fixtures: 3679. Negative fixtures: 2602. Invalid fixtures: 0. `pregate rules test` failing lines: 0.

A positive fixture is a valid `fail/` or `trap/` case. A negative fixture is a valid `pass/` case. Totals count each fixture once per check. Min, median, and max count that check's fixtures again for every alias, so two aliases of one check contribute the same number twice. A rule with no positive or negative fixture is an alias whose check has none. `--out` writes per-rule counts to a local JSON file. That file is not part of the repository.

**Rules with no positive fixture:** none.

**Rules with no negative fixture:** none.

**Checks with no positive fixture:** none.

**Checks with no negative fixture:** none.

## Per-pack raw counts

| Pack | Activation | Findings | FP rate | Static rules | Idle | Not field-audited | Rules-test failures | Rules missing +fixture | Rules missing −fixture |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| agent-practices | combined | 0 | unmeasured | 0 | 0 | 22 | 0 | 0 | 0 |
| angular | combined | 0 | unmeasured | 11 | 1 | 0 | 0 | 0 | 0 |
| architecture | split | 0 | unmeasured | 17 | 14 | 0 | 0 | 0 | 0 |
| authjs | combined | 5 | unmeasured | 12 | 1 | 0 | 0 | 0 | 0 |
| clean-code | combined | 678 | unmeasured | 5 | 0 | 0 | 0 | 0 | 0 |
| consumer-saas | combined | 0 | unmeasured | 0 | 0 | 39 | 0 | 0 | 0 |
| core | builtin | 0 | unmeasured | 0 | 0 | 68 | 0 | 0 | 0 |
| dcouplr | split | 0 | unmeasured | 22 | 0 | 56 | 0 | 0 | 0 |
| ddd | combined | 0 | unmeasured | 3 | 3 | 0 | 0 | 0 | 0 |
| design-invariants | combined | 0 | unmeasured | 0 | 0 | 48 | 0 | 0 | 0 |
| drizzle | combined | 0 | unmeasured | 12 | 0 | 0 | 0 | 0 | 0 |
| enterprise-ready | combined | 0 | unmeasured | 0 | 0 | 57 | 0 | 0 | 0 |
| express | combined | 77 | unmeasured | 11 | 0 | 0 | 0 | 0 | 0 |
| firebase | combined | 0 | unmeasured | 8 | 1 | 0 | 0 | 0 | 0 |
| go | split | 108 | unmeasured | 8 | 0 | 0 | 0 | 0 | 0 |
| javascript | combined | 512 | unmeasured | 19 | 0 | 0 | 0 | 0 | 0 |
| maintainability | combined | 105 | unmeasured | 9 | 3 | 200 | 0 | 0 | 0 |
| mattpocock | combined | 12 | unmeasured | 7 | 0 | 0 | 0 | 0 | 0 |
| mongodb | combined | 2 | unmeasured | 10 | 0 | 0 | 0 | 0 | 0 |
| musk | combined | 40 | unmeasured | 5 | 0 | 0 | 0 | 0 | 0 |
| nestjs | combined | 0 | unmeasured | 10 | 0 | 0 | 0 | 0 | 0 |
| next-website | combined | 0 | unmeasured | 0 | 0 | 54 | 0 | 0 | 0 |
| nextjs | combined | 0 | unmeasured | 12 | 5 | 0 | 0 | 0 | 0 |
| node | combined | 31 | unmeasured | 16 | 0 | 0 | 0 | 0 | 0 |
| nuxt | combined | 0 | unmeasured | 12 | 8 | 0 | 0 | 0 | 0 |
| postgres | combined | 0 | unmeasured | 10 | 0 | 0 | 0 | 0 | 0 |
| prisma | combined | 0 | unmeasured | 11 | 1 | 0 | 0 | 0 | 0 |
| pstack | combined | 827 | unmeasured | 11 | 2 | 86 | 0 | 0 | 0 |
| python | split | 3 | unmeasured | 10 | 0 | 0 | 0 | 0 | 0 |
| react | combined | 0 | unmeasured | 13 | 0 | 0 | 0 | 0 | 0 |
| react-native | combined | 1 | 1 / 1 | 10 | 0 | 0 | 0 | 0 | 0 |
| redis | combined | 4686 | unmeasured | 8 | 0 | 0 | 0 | 0 | 0 |
| rust | split | 0 | unmeasured | 8 | 8 | 0 | 0 | 0 | 0 |
| security-audit | combined | 0 | unmeasured | 18 | 1 | 0 | 0 | 0 | 0 |
| senior | combined | 4355 | unmeasured | 12 | 0 | 0 | 0 | 0 | 0 |
| solana | combined | 0 | unmeasured | 12 | 0 | 0 | 0 | 0 | 0 |
| supabase | combined | 0 | unmeasured | 10 | 2 | 0 | 0 | 0 | 0 |
| svelte | combined | 0 | unmeasured | 13 | 2 | 0 | 0 | 0 | 0 |
| sveltekit | combined | 0 | unmeasured | 12 | 12 | 0 | 0 | 0 | 0 |
| tailwind | combined | 17 | unmeasured | 7 | 0 | 0 | 0 | 0 | 0 |
| testing | combined | 0 | unmeasured | 3 | 0 | 1 | 0 | 0 | 0 |
| trpc | combined | 51 | unmeasured | 7 | 0 | 0 | 0 | 0 | 0 |
| typescript | combined | 164 | unmeasured | 24 | 2 | 0 | 0 | 0 | 0 |
| vercel | combined | 0 | unmeasured | 0 | 0 | 15 | 0 | 0 | 0 |
| vibe-proof | combined | 55 | unmeasured | 17 | 0 | 0 | 0 | 0 | 0 |
| vue | combined | 8 | unmeasured | 8 | 1 | 0 | 0 | 0 | 0 |

Idle rules are static rules that applied to no parsed file. Not field-audited rules are fitness, diff, or placement checks. A zero in Findings is a raw count, not a measured false-positive rate. A pack false-positive cell is `k / n` only when every finding that pack produced on this corpus is labeled `correct` or `false-positive`. Otherwise that cell stays unmeasured, and `k / n` still describes only this corpus.

## Compile errors

### architecture

- architecture/CA-DEP-002: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"
- architecture/FCIS-DEP-001: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"
- architecture/FCIS-IO-001: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"
- architecture/FCIS-IO-002: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"

### dcouplr

- dcouplr/DCP-EDGE-001: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"

### go

- go/GO-IO-001: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"
- go/GO-LAYER-001: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"

### python

- python/PY-IO-001: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"
- python/PY-LAYER-001: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"

### rust

- rust/RUST-LAYER-001: params.paths: @layers:core matches no layer; the preset declares no layer of kind "core"

## Labeled sample

| Verdict | Pack | Rule | Location | Note |
| --- | --- | --- | --- | --- |
| correct | clean-code | `clean-code/CC-FN-001` | classnames `bind.js:16` `parseValue` | parseValue occupies lines 16-42, past the rule's limit of 20. The finding reports measured 21. |
| false-positive | tailwind | `tailwind/TW-DYN-001` | classnames `bind.js:49` `appendClass` | appendClass joins two runtime class strings with a space. It is not a Tailwind utility fragment hidden from the content scanner. |
| false-positive | tailwind | `tailwind/TW-DYN-001` | classnames `bind.js:49` `appendClass` | appendClass joins two runtime class strings with a space. It is not a Tailwind utility fragment hidden from the content scanner. |
| correct | typescript | `typescript/TS-ANY-001` | classnames `index.d.ts:11` `Mapping` | Mapping is declared as Record<string, any>, which is the explicit any this rule names. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | classnames `benchmarks/benchmarks.js:46` `runBenchmarks` | console.log prints the benchmark name. It is the runner's output, not a debug leftover in feature code. |
| false-positive | vibe-proof | `vibe-proof/VP-CONSOLE-001` | classnames `benchmarks/benchmarks.js:51` `runBenchmarks` | console.log prints that the benchmark run finished. It is the runner's output, not a debug leftover. |
| correct | go | `go/GO-FN-001` | errors `format_test.go:161` `TestFormatWithStack` | TestFormatWithStack starts at line 161 and the next test starts at line 230, past the limit of 50. The finding reports measured 67. |
| false-positive | authjs | `authjs/AUTH-SECRET-001` | express `examples/auth/index.js:25` `secret` | secret: 'shhhh, very secret' is the express-session option in an example. It is not an Auth.js config. |
| false-positive | express | `express/EX-STATUS-001` | express `examples/downloads/index.js:26` `<module>` | The handler sets res.statusCode = 404 and then calls res.send. The response is sent, so the connection is not left open. |
| false-positive | express | `express/EX-STATUS-001` | express `examples/downloads/index.js:27` `<module>` | Same handler as line 26: res.statusCode = 404 is followed by res.send, so the body is sent. |
| correct | javascript | `javascript/JS-REQ-001` | express `examples/auth/index.js:10` `session` | The line is var session = require('express-session'), a require call. |
| correct | javascript | `javascript/JS-REQ-001` | express `examples/auth/index.js:7` `express` | The line is var express = require('../..'), the require call this rule names. |
| false-positive | mongodb | `mongodb/MONGO-CONNECT-001` | express `examples/search/index.js:33` `initializeRedis` | initializeRedis calls db.connect() on the Redis client described in the comment above it. It is not a MongoDB driver connect. |
| false-positive | redis | `redis/REDIS-KEY-001` | express `examples/auth/index.js:100` `<module>` | app.get('/login') registers an Express route. The string is a path, not a Redis key. |
| false-positive | redis | `redis/REDIS-KEY-001` | express `examples/auth/index.js:104` `<module>` | The matched call text includes req.get('Referrer'), an HTTP header read inside app.post. It is not a Redis key. |
| correct | senior | `senior/SR-VAR-001` | express `examples/auth/index.js:10` `<module>` | The line declares var session. That is the var binding this rule names. |
| correct | senior | `senior/SR-VAR-001` | express `examples/auth/index.js:12` `<module>` | The line declares var app. That is the var binding this rule names. |
| false-positive | vue | `vue/VUE-PUSH-001` | express `test/req.baseUrl.js:60` `<module>` | urls.push concatenates a string onto an array in an Express routing test. It is not vue-router push. |
| correct | python | `python/PY-NEST-001` | markupsafe `src/markupsafe/__init__.py:213` `Markup.striptags` | The if that checks an unclosed comment sits inside the comment branch of a while. That is three nested controls, over the limit of 2. |
| correct | python | `python/PY-NEST-001` | markupsafe `src/markupsafe/__init__.py:220` `Markup.striptags` | The if that checks an unclosed tag sits inside the else branch of a while. That is three nested controls, over the limit of 2. |
| false-positive | react-native | `react-native/RN-PLAT-001` | react-markdown `test.jsx:537` `p` | The test returns a DOM div from a web Markdown component and checks it with renderToStaticMarkup. It is not a React Native render. |
| correct | node | `node/NODE-PREFIX-001` | tslib `test/runTests.js:2` `<module>` | require("child_process") is a bare builtin specifier, without the node: prefix this rule names. |
| correct | node | `node/NODE-PREFIX-001` | tslib `test/runTests.js:3` `fs` | require("fs") is a bare builtin specifier, without the node: prefix this rule names. |

Every label matched a finding.

## Limits

- The false-positive rate is unmeasured unless every corpus finding is labeled correct or false-positive. Reviewed-sample counts are not a rate, and this report does not turn them into one.
- A label says whether the finding matches the rule's stated condition. It is not a judgment that a project should adopt the rule, and it is not an 80% confidence estimate.
- The corpus is the pinned repositories in the manifest. It is not a random sample of public code.
- The audit reports every static match in the checked-out tree. It is not the no-new ratchet used on an edit, and it does not run fitness, diff, or placement checks.
- Methodologies that do not compile as one contract are audited separately. That pack's finding total is the sum of those audits, not one preset.
- The measurement preset declares no layers. A rule whose paths use @layers fails to compile and is listed under compile errors; it is not field-audited, and a missing finding is not evidence that the rule is clean. Imports resolve only from files inside the checkout.
- Fixture density and rules-test lines describe each pack's own fixtures. A passing fixture suite is not a field false-positive rate.
- Tracked files under node_modules, vendor, dist, build, coverage, .next, or target are not scanned. Symlinks are not followed.

## Reproduce

```sh
bun scripts/measure-false-positives.ts --skip-offline \
  --corpus docs/benchmarks/corpus.json \
  --labels docs/benchmarks/labels.json \
  --cache .cache/false-positives \
  --markdown docs/benchmarks/false-positives.md
```

