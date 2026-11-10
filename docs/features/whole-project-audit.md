# Whole-project compliance audit

`pregate audit` inventories existing static violations under the established
preset and compiled lock. It includes brownfield debt, shadow findings and
warnings; it does not apply the no-new ratchet or activate/change protection.
No Git repository or machine-local consent is required for this read-only audit.

```sh
pregate audit
pregate audit --json
pregate audit --repo /path/to/project --json
pregate audit --incremental --plan --json
pregate audit --fresh --json
pregate audit --incremental --jsonl > audit.jsonl
```

Default text shows totals, live policy, analysis and
coverage gaps first, followed by at most ten rule summaries and 25 finding
locations with repair hints and explicit shown/total counts. Other detail categories
show up to five entries,
and an identical rule repair hint appears only once among the shown locations.
Unbound fitness requirements retain their
unverified total and grouped next step instead of repeating every missing
assertion. Adopted assertions with failed or missing evidence remain visible.
Use `pregate audit --full` for the complete human view, or `--json`/`--jsonl` for
all machine evidence. These output formats are mutually exclusive.
The compact presentation does not reduce analysis, change verdicts or impose a
total output-byte budget: an individual message can still be long. `--plan`
explicitly appends the complete advisory plan even to the compact view.

JSON preserves all findings and
exclusions, check versions, lock/content hashes, scanned-file hashes, analysis
errors and elapsed time. Findings are independent of the live enforcement policy:
a shadow or warning policy does not make existing debt disappear.

All 68 core defaults are active in core 0.0.1.
The 64 software and maintainability obligations appear in
the separate `fitness` array, evaluated once per project rather than once per
file. Each entry includes its exact English `statement`, `fixHint`, status and
evidence reason. Missing or stale verification is `unverified` and makes the
audit incomplete; it is not a counted static violation or a passing requirement.
See [project fitness](project-fitness.md) to bind and run reviewed assertions.

Static pattern, metric and import rules are evaluated regardless of their
configured hook phase. Their configured paths, intersected `within` restrictions,
pattern file sets and exclusions still apply. Change
guards (`diff`, `placement`) need an attempted change and baseline; rules owned
by ArkGate belong to its evaluator. Both appear in `skippedRules` with a reason.
Auditing static rules does not establish compliance with those skipped rules.

The audit covers the preset scope. JS/TS, Python, Go, and Rust parsing and selected
static checks are supported (see
[language boundaries](language-analysis.md)). `fileCoverage` lists the selected
static rules applying to every parsed file. Parsed Python/Go/Rust files without an
applicable language policy appear as `uncovered`; they do not pass silently.
Unsupported source files in scope and syntax/import failures are visible and make the result
incomplete. Nested projects with their own presets are excluded from the parent's
contract; audit each one separately. Engine/state, dependency/build folders and
symlinks are not traversed. Git-tracked regular authored files under a folder
named `build/` are inventoried; that folder name alone does not prove generated
output. Ignored/untracked build output, dependency folders and protected paths
remain excluded. This is source-rule compliance, not general proof of
correctness, security, runtime performance or complete QA coverage.

Directory imports resolve through their index files; a probed directory is not
treated as unreadable source. The patched parser handles the admitted literal-NUL
string/comment cases; the source and binary controls
document their scope. A syntax diagnostic is not proof of a compiler error.
The first private consumer diagnostic
records the directory-index repair, measured scope and remaining calibration limits.

Exit codes:

- `0`: no static violations, failed/unverified fitness requirements or unresolved
  analysis in the audited scope.
- `1`: static violations exist, including shadow observations and warnings, or
  a current project fitness verification failed.
- `2`: invalid contract/input, unsupported or uncovered source files, analysis failure or
  detected changes during the audit, or unverified fitness requirements; partial
  findings remain useful evidence. Incompleteness takes precedence over static debt.

Rules needing changes may still be skipped on exit 0; always read the coverage
inventory. Syntax failures cannot establish other rules on that file. Independent
metric/pattern findings remain available when import resolution fails.

The engine caches up to 32 MiB of UTF-8 dependency/source text within the invocation,
caps one input source at 32 MiB, frees each primary
syntax tree after analysis, and detects changes to read content, file inventory
or the established contract before reporting completion. Run against a stable
tree for reproducible results. `contentHash` identifies normalized scanned-source
contents, not a Git commit or a cryptographically frozen concurrent filesystem.
Oversized sources produce `audit-input-limit` and incomplete evaluation; findings
on other files remain available. Read-time growth/shrink also fails evaluation.
The JSON `budgets` object reports file/cache limits, peak cached bytes and single
parser concurrency. These content budgets do not cap total process memory.

For a brownfield project, establish the intended pack and scope, run the audit,
choose a small repair, characterize behavior with relevant tests, and rerun the
audit after the verified change. `check --ratchet --base <sha>` continues to
prevent new debt; `audit` shows existing debt left to repair. Use
`pregate explain <rule>` to understand each selected rule.

0.0.5 implements content-based incremental reuse and
checkpoint resume and streaming output described below. Parallel workers and model
classification remain pending in the [bulk-audit plan](maintainability-and-bulk-audit.md).
Timing is reported for the actual invocation; large-project speed claims need
representative benchmarks and unchanged correctness/coverage.

## Incremental audits and checkpoint resume

`audit --incremental` reuses complete file-analysis results after checking the
normalized source content and every dependency/configuration input read during
that analysis, including absent files. Imports, barrel exports and configuration
changes invalidate affected importers. A changed contract, inventory or evaluator
implementation starts a new cache. The build-time evaluator identity includes
source, schemas, executable parser inputs and Bun version, even for development
builds sharing an engine version.

Every invocation still walks the current inventory, verifies the complete
contract, checks coverage, detects read/tree changes and evaluates project fitness.
Missing proof remains unverified. Enforcement through hooks or `check` does not
read this cache. `audit` without cache flags remains cold; `audit --fresh` performs
a cold audit and refreshes the cache. It also works with `--incremental`.

Atomic checkpoints are saved after each 32 newly evaluated files and at normal
completion. Run the same command to resume an interrupted audit: valid completed
entries are reused, unfinished files are evaluated. A checkpoint is not a
completed audit. Transient I/O and regex-budget failures are not cached; syntax
and import-resolution diagnostics can be reused when all inputs remain equal.

The protected local state directory's `audits/` contains disposable JSON
checkpoints with hashes, finding locations/symbols, diagnostics and repair text,
but no source-file bodies. Persisted project files are capped at 4 MiB each;
checkpoint writes retain at most 64 recently written project files. Oversized
individual entries and external-root dependencies are evaluated without reuse.
Previously loaded entries remain available while the bounded write set changes,
so a tree larger than the cache can still reuse its retained subset. These are
cache/source budgets, not total-process memory limits. Text and JSON reports remain
buffered; JSONL emits findings by file. Concurrent writers can replace a checkpoint, reducing
reuse; input validation still applies. Interrupted temporary files are outside
the retained-project-file count.

JSON `incremental` reports the evaluator identity, reused/evaluated/invalidated
files, retained entries, checkpoint-write outcome, cache errors and limits. Text
shows work counts. Invalid or unavailable caches fall back to analysis. See
tests, resume evidence and cold/warm measurements.

`audit --plan [--json]` adds an advisory refactoring plan. Repairs are grouped by
file/rule and ranked using effective severity/enforcement and observed counts.
The local classifier uses declared check areas and test-path conventions; it does
not identify semantic defects or test coverage. The plan exposes missing behavior
ownership/commands, suggests test levels and preserves the audit's coverage and
exit code. See [maintainability progression](maintainability-and-bulk-audit.md).

## Streaming results

Use `audit --jsonl` to receive newline-delimited JSON during analysis. Combine it
with `--repo`, `--incremental` or `--fresh`. It cannot be combined with `--json`
or `--plan`; ranked plans require the complete buffered report.

All records have `schemaVersion: 1` and a `type`:

- `start` identifies the root, mode and admitted lock hash.
- `file` contains the path, normalized source hash, all findings and analysis
  errors for one parsed file. A source-read failure has a null hash. Findings
  have the same shape and deterministic order as the JSON report.
- `end` contains the exit `code` and `report`: the complete report metadata,
  summary, fitness, coverage, exclusions, errors and hashes, without the
  `findings` array. Read findings from the preceding file records.
- `error` reports invalid arguments or an unexpected failure with exit code 2.
  An unexpected failure after `start` has no `end` record.

An `end` record means evaluation finished, not that compliance passed. Exit 2
still reports unverified fitness, unsupported/uncovered files, analysis errors
or changes detected by the final content/contract check. Each earlier finding
is provisional until that check. A stream without `end` is interrupted or failed;
do not treat its partial count as a complete inventory. A broken output stops
the audit; it cannot emit a successful final record to that destination.

The producer writes each record synchronously and releases each file's finding
array after summary accumulation. This avoids keeping all finding objects and
one whole-report JSON string. It retains inventory, hashes, coverage, errors,
per-rule/file counters and bounded source/result caches; one file record can
still be large. It is not constant-memory auditing or a total-memory cap.
Parallel parsing and model classification are separate pending work.
See compiled interruption controls and first-result measurements.

## Initial scale evidence

On macOS arm64/Bun 1.3.14, a synthetic TypeScript tree with 100 files, 49,900
lines, 1,488,900 bytes and 10,000 known violations completed the measured audit
in 809.1–821.5 ms across five fresh process invocations. Full wall time was
834.5–844.3 ms after the first invocation, which took 1,850 ms. Every invocation
asserted the full violation count and no analysis/stability failures.

Run the current benchmark from the repository root with `bun run scripts/bench-audit.ts`.
It preserves all default core rules and currently expects 64 unverified requirements, so
the synthetic tree's audit is explicitly incomplete (exit 2) alongside its
10,000 static violations. It does not provide project verification bindings.
The timing above records the earlier Bun 1.3.14 run; new runs print their own
timings and incomplete state. This is
a generated scale fixture, not a pilot on a real dependency graph, a universal
latency promise or evidence for model-assisted classification. First-process
startup and representative import-heavy projects still need separate evaluation.

Timings from before Bun was pinned to 1.4.4 are not a v0.0.2 measurement. Run the benchmark above for a current figure. A passing count on this synthetic tree is not semantic compliance.
