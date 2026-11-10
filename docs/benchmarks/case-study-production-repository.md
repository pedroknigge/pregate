# Case study: one production repository

One trial of Pregate on a private production repository, run by the maintainer's agent in
an isolated clone on 2026-11-09 and 2026-11-10. Nothing was written to the real
repository. This page reports what was measured and what was not. It is one repository
and one machine; it is not a claim about other projects.

## The repository and the machine

| | |
| --- | --- |
| Source files with a parser | 13,499 (TypeScript, TSX, JavaScript, Python) |
| Of those, production / tests | 9,375 / 4,081 |
| Stack detected | Next.js, React, Drizzle, Supabase, TanStack Query |
| Instruction files | `AGENTS.md` 33 KB (389 lines), `CLAUDE.md` 152 KB (2,157 lines) |
| Existing architecture tool | a separate layer checker with its own contract |
| Machine | Apple M5 Pro, 18 cores, 64 GB, macOS 26.6 |
| Engine | 0.0.5 run from source with Bun 1.4.4, plus the fixes named below |

## What was not measured

- **Stops before a pull request.** No live agent session ran against this repository, so
  there is no count of edits stopped or repaired. The hook path is covered by tests on
  sample projects, not here.
- **Harnesses.** None was driven live in this trial.
- **Hook latency with the compiled engine.** The numbers below are the pre-check command
  run from source. See [hook latency](hook-latency.md) for the compiled engine on fixtures.
- **A false-positive rate.** One rule was sampled, below. The other 46,000 findings were
  not labeled.

## Setup

`pregate guide --preview` failed on the first run: the repository depends on a library
whose recommended methodology reads the core layer, and no core layer was derived. That
is fixed (the methodology is left out and named). After the fix the guide proposed 13
packs and 126 rules in advisor mode. A guide review of this tree takes about 23 s.

Folder names placed no layer. The repository has `domain` and `application` folders
under each feature, and their code imports shared code outside every layer, so the
derived map was dropped. An agent-written map over `src/features/**/domain/**` and
`src/features/**/application/**` was accepted by `pregate layers apply` in 9 s and
reported 250 existing imports that break it. A first map with two folder names that did
not exist was refused, which is the check working.

## Instruction files to rules

| | `AGENTS.md` | `CLAUDE.md` |
| --- | ---: | ---: |
| Statements read | 102 | more than 400 |
| Compiled from a sentence shape | 0 | 0 |

No statement had a shape the drafter knows. The files are paragraphs and tables with
context, not short imperative bullets. This result is why `compile apply` exists: the
agent reads the prose and proposes each rule with code that must fail and code that must
pass.

Three rules were proposed from real lines of `CLAUDE.md`:

| Statement, in short | Rule as drafted | Findings in the audit |
| --- | --- | ---: |
| Call the model through the gateway client, never the vendor SDK outside the AI library | import of the SDK package | 2 |
| Round posted money once with the shared helper, never `Math.round(x * 100) / 100` | that expression | 114 in 84 files |
| Reconcile optimistic updates; do not mark a query stale without a refetch | call to that function | 22 in 9 files |

Each finding is a real match of the pattern: on six files checked by hand, the rule
reported exactly the lines a text search finds.

### What the sample of the money rule shows

Fifteen of the 114 findings, taken at a fixed stride, read against the statement's
intent ("posted money"):

| Reading | Count | Examples |
| --- | ---: | --- |
| Money | 5 | a unit price, a subtotal, a payment amount |
| Not money | 8 | hours worked, a screen coordinate, a percentage, an index |
| Unclear from the line | 2 | a generic `round2` helper, an earned-value figure |

The pattern is exact and the rule is still broader than the statement: the same
expression rounds hours and coordinates. A syntactic rule cannot tell them apart. For a
statement like this one, the rule needs a path scope (`files`) for the money modules, or
it stays in advisor mode. Enforcing it as drafted would stop correct code.

The first draft of this rule had a worse problem. The engine synthesized a pattern that
was the literal text of the example; it passed its own cases and matched nothing else.
`compile apply` now refuses that and asks for a pattern.

The SDK rule reported the one file inside the AI library, where the statement allows the
import. A proposal can now state that with `except`, and the engine proves the exception.

## Audit

The first audit did not finish in ten minutes. One vendored JavaScript bundle (1.9 MB,
68,000 lines) made six rules ask the same question of the same node once per candidate.
With that fixed:

| | Before | After |
| --- | --- | --- |
| Check of that one file, 194 rules | not finished at 120 s | 7.2 s |
| Audit of the repository | not finished at 600 s | 86 s |

The audit reported 46,790 findings in 10,257 files, 4 files it could not parse, and 3
without a parser. Two rules account for 71% of the findings: functions longer than the
default limit (26,423) and functions with more parameters than the default limit
(6,781). Those defaults were not tuned for this repository, and nobody labeled the
findings. In advisor mode with the no-new ratchet they are known debt, not blocks; a
team would raise the limits or leave those rules off before promoting anything.

The vendored bundle was in scope because the default excludes name `vendor/**` at the
root and this copy sits under `public/vendor/`. Excluding it is the project's choice and
was not made here.

## Pre-check latency

`pregate check --stdin --path <file>` on 60 real files chosen at a fixed stride, each
with its own content, one process per file, engine run from source:

| | |
| --- | ---: |
| p50 | 693 ms |
| p95 | 763 ms |
| Range | 680 to 764 ms |
| File size | median 97 lines, largest 1,652 |

The floor of about 680 ms is the start of Bun and the engine's modules from source. The
whole spread across file sizes is 84 ms. The compiled engine starts faster; its measured
numbers on fixtures are in [hook latency](hook-latency.md). This table does not measure
the registered hook.

## Reproduce

In a clone of a repository, with a human approving each review:

```sh
pregate guide --preview
pregate compile AGENTS.md
pregate compile CLAUDE.md --template        # an agent completes the proposals file
pregate compile apply proposals.json --preview
pregate layers --json
pregate layers apply layers.json --preview
pregate audit --json
```

## What this trial changed in Pregate

- `guide` no longer fails when a recommended methodology needs a core layer the project
  does not have.
- `compile apply`, `--template`, `pattern` and `except` came from the zero-of-500 result
  and from the two broad rules.
- A synthesized pattern that is only the example's text is refused.
- A first layer map no longer prints a weakening warning.
- One large file no longer stalls a check or an audit.

Open after it: a live agent session with counted stops, labeled findings for more than
one rule, and the same trial on a second repository.
