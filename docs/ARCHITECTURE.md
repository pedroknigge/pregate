# PREGATE: MVP architecture

> *A gate for explicit, executable code and architecture constraints.*

**Current source: published engine 0.0.7, core 0.0.1:** 68 default rules (64 project fitness requirements and four
general change guards); language/practice/pattern policies are optional packs.
Human-reviewed off overrides are supported. The pure evidence gate is
[fitness.ts](../src/fitness.ts); execution and file fingerprints live in
[fitness-command.ts](../src/fitness-command.ts). [Project fitness](features/project-fitness.md)
defines its approval, staleness, scope and semantic limits. Earlier core names,
non-disableable integrity claims and default rule counts below are historical.

**Current status:** 0.0.7 is the public release. macOS ARM64 is stable. Linux and
Windows builds are experimental. It adds
Python/Go/Rust demos, bounded Rust source analysis and public-ready HTTPS downloads
with private fallback. Core is unchanged. See
the pre-public scope and
[language-analysis limits](features/language-analysis.md).
[roadmap](ROADMAP.md) records pending requirements and evidence;
[ROADMAP.md](ROADMAP.md) replaces the historical phases of SPEC §18.
[MULTI-HARNESS.md](MULTI-HARNESS.md) describes the five adapters. Entries
O1–O73 and the original measurements in this document are a historical record;
they do not by themselves demonstrate current guarantees, performance, or compatibility.
The [command reference](CLI.md), the [pack inventory](packs.md), and the
[feature guides](README.md) describe the current code contract.

**Current limits:** prior evaluation depends on reconstructing a write from a supported tool. The shell guard is heuristic; dynamic writes can reach the Stop check, and some harnesses do not show all of their warnings. The audit lists static debt and pending coverage; it does not certify total quality or runtime behavior. Prose invariant catalogs are not executable checks. Automated protocol validation does not replace human interaction tests on each harness or native execution on each platform.

The incremental audit is opt-in: `audit-command.ts` keeps full validation of the contract, coverage, and fitness; `audit-cache.ts` stores static results per file and atomic checkpoints. The evaluator fingerprint is fixed at compile time, with sources, schemas, executable parsers, and the Bun version. Reuse checks content and dependency/configuration inputs, including absent files. Hooks and `check` do not read that cache. See
[budgets, invalidation, and recovery](features/whole-project-audit.md#incremental-audits-and-checkpoint-resume).

On reaching the Stop limit or reentering with a cause that requires human repair, the turn can end without approving compliance. The event keeps `stopIncomplete`, the cause, the notice, and findings for the selected root. `pregate report` highlights those terminations; its JSON keeps every recorded location even if the harness discards the notice. They are historical observations: after repairing, run `pregate check --all` and consult `audit` coverage. See the
[channel matrix and shell limits](features/harness-and-shell-guarantees.md).

Local human feedback labels individual observations and requires review with a digest. The report distinguishes judged, uncertain, and unlabeled cases; its reviewed precision describes only that selected sample, not general quality, recall, or executed repairs. See [human feedback](features/human-feedback.md).

[Local retention](features/local-storage.md) lets you inspect sessions and prepare a cleanup of old copies with digest review. It keeps every snapshot, event, and counter, and the shared or more recent code references. Writer leases and exclusive markers coordinate blob publication and cleanup. Digest recovery removes only single-owner markers recorded on this machine whose PID the system confirms absent; it keeps live, ambiguous, inaccessible, or non-matching-host cases and does not touch snapshots or counters. Shared storage across machines is not certified. There is no
automatic session expiration.

**Sources of truth.** `docs/SPEC.md` v2.1 (§4, 5, 6, 8, 9, 10, 11, 13, 14, 18, Appendix B) and `docs/inputs/decisiones-usuario.md` (D1–D17). If this document contradicts the SPEC, it marks that with **[Δ]** and lists it in §7.2 for your OK.

**Measurements.**
- Parser, startup, and git figures come from the proposals: macOS arm64, Bun 1.3.14, Node 26.8, p50 of 25 cold starts of `bun build --compile --minify --bytecode`.
- The launcher prototype with a watchdog (capture with `$(...)` and `wait`) was measured on bash 3.2 (macOS `/bin/sh`) and dash, 60 runs, with a 20 KB payload.
  - It adds between +0.8 and +1.3 ms of p50 relative to a direct `exec`.
  - A hung engine is cut off at 2.03 s.
  - SIGKILL and exit 1 become deny with exit 2.
  - W0 applies the §4.0 changes (deadline with `trap … USR1`, stdout to a file, `$# = 0`); e2e measures it again.
- An uncaught error in a Bun binary exits with code 1 (checked with `throw`, a rejected promise, and an async error). The launcher turns it into a deny (A6).

---

## Architecture decisions

| # | Decision | Discarded alternative | Why |
|---|---|---|---|
| A1 | **One `bun build --compile --bytecode` binary per platform, plus a global POSIX launcher** (MH-18/28) | Node + bundle; Rust | Zero runtime dependencies (D17); Rust remains conditional on latency (D15.7, §13.3) |
| A2 | **Parser: web-tree-sitter (WASM) + vendored TS/TSX grammars** (3.2 MB embedded; the grammar carries the O18 patch, recorded in ORIGIN and limited to what the pilot needed) | TypeScript 6.0.3 API (+32 MB, frozen); Babel; a custom scanner; native `.node` | It is the only option that meets U6/§13.3 (tree-sitter), D17 (zero dependencies, no natives), and the pilot pack's rule format at the same time. Its known failure mode is a false **deny**, the safe direction (§5.3) |
| A3 | **In-house pattern engine** (a subset of ast-grep rules over tree-sitter nodes) with a **differential oracle** against `@ast-grep/napi`, dev only | `@ast-grep/napi` at runtime | An embedded `.node` costs 295 ms per call; placing it beside the binary breaks "single binary". The oracle watches semantic drift, which is the main risk |
| A4 | **Rules in the ast-grep dialect over tree-sitter *kinds*** | A dialect over `ts.SyntaxKind`; no patterns | The `amarilla/` pack runs as data without porting it, the rules survive the migration to `ast-grep-core` (§13.3), and §18.1 requires patterns in `path` sources |
| A5 | **Hard watchdog in the launcher** (parent process: when the deadline expires, `kill -9` the engine and emit the event's fail-closed output, even if the engine has not died) | A worker with `terminate()`; a cooperative watchdog (`expired()`, `progressCallback`); fuel per rule | Cooperative checks do not cut off a catastrophic regex or a synchronous loop, and Claude Code fails open when its timeout is reached. The parent responds to anything (CPU, a blocked syscall, a filesystem hung in state D), costs ~1 ms (measured), and removes `expired()` and fuel from every core signature. The Worker required a second entrypoint and reinitializing the WASM |
| A6 | **The launcher supervises without `exec`**: if the engine is missing or exits with an `rc ∉ {0,2}`, the launcher emits the event's fail-closed output. It is the **only** implementation of fail-closed for unforeseen failures: the engine does not catch exceptions and exits with 1 | `exec` of the engine; also `uncaughtException` → `failClosed` in TS | It closes the residual risk in §13.6 (abort, OOM, SIGKILL, crash), which with `exec` ended in fail-open. A second fail-closed text in TS would be a duplicated contract that can diverge |
| A9 | **A stale or altered hook lock denies and halts. Admission recompiles policy in memory and compares the complete lock bytes after CRLF normalization.** | Trusting only the lock's metadata hashes; silently replacing the disk lock | `gate.lockOf` uses the same compiler as CLI/commit/CI, without running fixtures or writing a replacement. Hashes alone do not bind effective rules, scope, enforcement or failure policies. Explicit contract activation still requires human approval. This supersedes the earlier hash-only hot-path design; its compilation cost is part of the hook latency budget. |
| A10 | **Pre-commit and CI recompile from scratch and compare the lock byte for byte** | Trusting the lock's hashes | Detects a lock edited by hand or corrupted, not only an old one |
| A11 | **Append-only state: one immutable file per call, with the filter keys in the name** | A counters file (read-modify-write); reading every event | PreToolUse calls run in parallel (§11.3). The per-turn cap comes from a `readdir`, without reading contents, and only events for the same (agent, file) are read |
| A12 | **The "before" analysis is recomputed on every call; only its text is stored** (once per session and file, with `link`) | An analysis cache keyed by `sha(rel, sha(text), lockHash)` | `analyze` reads other files (barrels, tsconfig) that are not part of that key: a barrel that changes leaves the "before" stale and the count can offset a new violation (false allow, and an order-dependent verdict). Recomputing costs ~4 ms at 300 lines and ~25 ms at 2,000, inside the p95. The expensive part is the git spawn (~20 ms), and storing the text avoids that. It is reevaluated only if `bench.ts` measures a p95 > 150 ms on the reference machine (O31) |
| A13 | **JSON Schema (6 files) as the validation source + an interpreter for the subset (~90 lines)** | ajv; combinators that infer types and emit schemas | The schemas are product data that the editor consumes with `$schema` (§6.1). The interpreter is smaller than a generator. `schema.test.ts` fails on an unsupported keyword |
| A14 | **`Decision.verdict: "none" \| "deny" \| "ask"` and `Emission.exit: 0 \| 2`** | `verdict: "allow"`; a free exit | "allow" and exit 1 are unrepresentable. `claude.test.ts` verifies that the string `"allow"` never appears |
| A15 | **Closed `Cause` + `FIXABLE_BY: Record<Cause, "agent" \| "human">`** | Cause as a free string | Totally decides whether a deny is a form deny (it does not consume the (file, rule) counter, but it counts toward the per-turn cap, §4.1 step 14) or needs a human (deny + halt) |
| A16 | **`pre-edit.changes[]`**, each `{session, callId, tool, path, edit, from}`; `gate.onPreEdit(changes)` evaluates the whole call | Speculative batch metadata or before/after on the wire | MH-07–13: full, append, ranged old/new, exact Codex hunks, delete and move. Other files in the call overlay `Read`; one deny blocks the call |
| A17 | **Pure adapters in `src/harness/`**, constants per module; `HARNESSES` and `profile` in `harness/profile.ts` | `profile.json` + interpreter | MH-01/03: Grok needs `GROK_HOOK_EVENT` plus top-level `hookEventName`; Cursor needs top-level `cursor_version`; otherwise use the registration flag. `main` and `doctor` share the map |
| A18 | **D23: English first** for all product text, code and catalog metadata | Optional future localization | Humans and agents receive English with standard technical terms. Historical inputs and long design docs are translated separately before publication. |
| A19 | **Error window against the "before" of each face** and ERROR nodes that *intersect* the window ⇒ form deny | Denying any syntax error in the file | The SPEC asks for "in the changed range" (§4.4). What lies outside the window is byte for byte equal to a state already evaluated or to the base, so it cannot hide anything introduced (§4.1, note) |
| A20 | **Accept a root tracked in HEAD, registered by SessionStart, or whose preset ctime predates the session's first snapshot** | Requiring SessionStart for every uncommitted preset | MH-33: agy and new subagent sessions have no SessionStart. A nested preset created after first contact stays unaccepted. The first contact allows two seconds of file-clock skew, so a preset just written is not skipped when the file clock is slightly ahead |
| A21 | **Macro `@layers[:kind]` in `params.paths`** **[Δ, added to the format]**. `@layers` with no declared layers ⇒ `[]` (the rule applies to nothing); `@layers:<kind>` with no layers of that kind ⇒ compilation error | Duplicating layer globs in every preset | EVA-DYN-001 ("in a layer") is an integrity rule and is always active. Without the macro, its default `paths` would be empty and there would be an integrity hole. If an empty `@layers` were an error, no preset without layers (`legacy-safe`) would compile |
| A22 | **No `enforcement: "advise"` and no `loop.escalate: "ask"`** | Implementing them | §18.1 requires explicit `shadow` and `stop` escalation (D15.5). `ask` exists only as a severity (TDD-DEL-001) |
| A23 | **`Bun.Transpiler.scanImports` is not used** | Using it for imports | It silently omits `import(m)`, non-literal `require(m)`, and `import type` (verified), which would be a false allow. It would also be two parsers that can disagree |
| A24 | **A single `git cat-file --batch`** for every blob in pre-commit, Stop, and CI | One `git show` per file | A spawn of 17–24 ms per file does not scale |
| A25 | **vendor/ = artifacts taken unmodified (except `grammar.patch`, O18), with LICENSE, ORIGIN (package@version, URL, sha256), and THIRD_PARTY_NOTICES**; `vendor.test.ts` verifies all of it | An npm dependency in `dependencies` | D17: it does not couple to the package and attribution is preserved. It is the closest thing to a cherry-pick that a WASM runtime allows |
| A26 | **Case-insensitive path comparison everywhere**: protected paths, scope, layers, and rule `paths`/`exclude`, in the hook, pre-commit, and CI, with a single function (`paths.matches`) | Case-fold only for protected paths and only on volumes that do not distinguish case (volume probe) | It is a superset of "where it applies" (SPEC §6.7), removes the probe and the `caseFold` parameter, and gives the same verdict on macOS and on Linux CI. `Bun.Glob` is case-sensitive (verified), so the glob and the path are passed in lowercase |
| A27 | **Git is required**: without git on PATH, without a repository, or when git itself errors, deny + halt `git-missing`, `git-not-repository` or `git-error` **[Δ §9]** | "First contact" without git, with a notice | Pre-commit and CI require git anyway; a second path without git would be code for a case the guarantee (U10) does not cover |

A7 (fuel per rule) and A8 (one child process per check in `rules test`) were removed: they repeated what the watchdog already does (A5), added false denies, and their "determinism" did not exist (the hook deadline still depends on the machine). The numbers are not reused.

---

## 1. Principles

1. **The verdict is a pure function:** `(lock, before, after) → introduced violations`. Hook, pre-check, pre-commit, CI, and `rules test` call the same `analyze` + `introduced`. Only the source of the "before" changes: the session snapshot, HEAD, or the base.
2. **What cannot be established is denied, and the guarantee lives outside the code that can fail.**
   - Inside the engine, every known cause is a `Cause` that goes through `decide → encode`. There is no last-resort `try/catch`: the unforeseen exits with exit 1.
   - Outside the engine, the parent launcher turns any death, hang, or exit ∉ {0,2} into the event deny (A6).
3. **The lock is the only contract at evaluation time.** The hook does not compile. It verifies hashes and versions, and evaluates. Compiling and testing sources is a human act through the CLI (U4, U10).
4. **Rules are data over a closed vocabulary:** five primitives and a pattern language (the ast-grep subset over tree-sitter *kinds*). An unknown key, `kind`, `field`, or regex is a compilation error, never "does not match".
5. **One parser, one tree.** tree-sitter serves the file, the patterns, the imports, and error detection. There is no second oracle that can disagree at runtime.
6. **Functional core, imperative shell.**
   - Pure modules do not import `fs` or processes, and do not read the clock or the environment. They receive `Read` or `Files`.
   - Harness signals: `CLAUDE_CODE_REMOTE` controls Claude interactivity; only `GROK_HOOK_EVENT` plus the payload selects Grok. The shell reads `HOME`, `XDG_STATE_HOME`, `CODEX_HOME`, `GROK_HOME`, `CLAUDE_CONFIG_DIR` and project-directory hints for state and machine protection. `XDG_DATA_HOME` is used by machine setup, never to locate a running engine: `<DATA>` comes from `process.execPath` (MH-18).
   - The optional Functional Core pack checks `FCIS-DEP-001` (declared direction), `FCIS-IO-001` (I/O imports), and `FCIS-IO-002` (clock/environment/randomness). Repository self-verification is in repository-dependency-verification. The current preset does not activate `CA-DEP-001`. Shell obtains the version from `package.json` in `versions.ts`; core does not depend on the build file.
   - `assets.setUpGrammars` loads and initializes the vendored runtime in the shell. `ts.setGrammars` receives only `Parser`, `Language`, and the byte loader; each grammar's cache is built on first use and invalidated when the collaborator is replaced. The loader supplied by the shell is an explicit dependency, not a purity guarantee for any callback.
7. **Zero runtime dependencies, and a call pays only for what it needs.**
   - WASM is initialized only if something must be parsed, and only with the file's grammar.
   - The "before" text is requested from git once per session and file (A12).
   - Out of scope and shell do not load the parser.
8. **An abstraction exists only if it has two real uses in the MVP** (D16). That is why `Files` exists (disk and in-memory fixtures) and why `LanguagePack` and `profile.json` do not. The `HARNESSES` map in `src/harness/profile.ts` exists because it has two uses: `main` (which adapter decodes) and `doctor` (each `VERIFIED`).

---

## 2. Complete MVP file tree

```
pregate/
├─ package.json                 version (= ENGINE); build/test/typecheck/bench scripts; "dependencies": {} ;
│                               exact devDependencies: typescript (typecheck), @types/bun, @ast-grep/napi (oracle)
├─ bun.lock                     devDependency integrity
├─ .bun-version                 1.3.14
├─ tsconfig.json                strict, noUncheckedIndexedAccess, noEmit
├─ bunfig.toml                  [test] root = "test": `bun test` does not enter the pilot's `*.test.ts` fixtures
├─ LICENSE                    **[Δ wave 3] pending (user decision, SPEC P19)**: without it `build.ts` warns and the tar is emitted without it (O28)
├─ THIRD_PARTY_NOTICES          web-tree-sitter, tree-sitter-typescript, Bun runtime (MIT) + the LGPL-2.0
│                               text for JavaScriptCore and tinycc, and the pinned Bun, WebKit, and tinycc source links; included in each release archive
├─ README.md                    installation, contract, and honest limits (hook + pre-commit + CI)
├─ .github/workflows/ci.yml     typecheck · bun test · build 2 targets · e2e · dogfooding;
│                               separate job: bench (does not break the suite on noise)
├─ .gitignore                   node_modules · dist · `*.bun-build` (bun 1.3.14 leaves a ~63 MB copy per `--compile`)
├─ .claude/settings.json        dogfooding: hooks written by `pregate install` **[Δ wave 3] pending (requires the user's sign-off)**
├─ .pregate/                     dogfooding: preset.json (pinned in W0), pregate.lock.json (wave 3); bin/pregate and git-hooks/pre-commit pending
├─ vendor/
│  ├─ web-tree-sitter/          web-tree-sitter.js, web-tree-sitter.wasm, LICENSE, ORIGIN
│  └─ tree-sitter-typescript/   tree-sitter-typescript.wasm, tree-sitter-tsx.wasm (patched, O18), grammar.patch,
│                               LICENSE, ORIGIN (base, each change with its source, toolchain, reproducible sha256)
├─ schema/                      preset.v1 · check.v1 · methodology.v1 · fixture.v1 · source.v1 · request.v1 (.json)
├─ catalog/                     `core` source, embedded by macro (fixtures do not go into the binary)
│  ├─ source.json
│  ├─ checks/<area>/<check>/check.json + fixtures/{pass,fail,trap}/<case>/{fixture.json, files/, before/}  (17)
│  ├─ methodologies/            clean-code · clean-architecture · ddd-tactical · functional-core-imperative-shell
│  │                            · tdd · pregate-integrity (.json)
│  └─ presets/                  backend-clean-ddd · functional-ts · legacy-safe (.json)
├─ assets/                      embedded; `install` writes them into the repo
│  ├─ launcher.sh               supervises the engine: hard deadline, exit 3 ⇒ pinned engine, rc ∉ {0,2} ⇒ event fail-closed output
│  ├─ pre-commit.sh             global pregate check --staged --ratchet
│  └─ ci-github.yml             timeout-minutes; installs the base branch's engine (sha256 + cosign);
│                               pregate rules test (path sources) + pregate check --ratchet --base <sha>
├─ src/
│  ├─ main.ts        shell · argv → hook <event> | hook auto | CLI (no last-resort try/catch: A6)
│  ├─ types.ts       pure    · shared vocabulary (plain data) + FIXABLE_BY
│  ├─ harness/       pure    · [MH-W0] one adapter per harness (claude, codex, cursor, grok, agy): payload → HookEvent | Rejected; Decision → Emission
│  │                         · wire.ts (parse, closed keys, absolute paths) and profile.ts (HARNESSES, profile: MH-03)
│  ├─ gate.ts        shell · orchestrates session-start / pre-edit / pre-command / stop and `check`
│  ├─ reconstruct.ts pure    · Write/Edit + disk → after + reconstruction; BOM/CRLF; changed window
│  ├─ paths.ts       pure    · fixed protections + path sources, scope, layer, language; one case-insensitive comparison (A26)
│  ├─ ts.ts          pure    · tree-sitter: parse, errorIn(window), facts (functions, classes, imports), symbol, astHash
│  ├─ match.ts       pure    · pattern engine (ast-grep subset)
│  ├─ resolve.ts     pure    · imports: relative, tsconfig paths/baseUrl/extends, re-exports ≤ 3 hops (more ⇒ "too-deep")
│  ├─ evaluate.ts    pure    · analyze(): lock rules over a file state; placement() without parsing
│  ├─ ratchet.ts     pure    · introduced(): no-new (new symbols + count) and diff
│  ├─ decide.ts      pure    · severity × enforcement × counters × no-progress × ask → Decision; blocking() for check
│  ├─ message.ts     pure    · line ≤ 256, detail ≤ 4,000, sanitization, human-facing text (es); the only one that renders
│  ├─ shell.ts       pure    · shell guard: permissive POSIX/PowerShell lexer + §10.2.3 rules
│  ├─ schema.ts      pure    · JSON Schema subset interpreter
│  ├─ compile.ts     pure    · preset + sources → Lock; freshness (versions, preset, builtin catalog); sourcesHash; fixtureLock; JSON-patch of requests
│  ├─ fixtures.ts    pure    · rules test of a check: pass/fail/trap, determinism, minimums, IDs
│  ├─ assets.ts      shell · embedded bytes: catalog/ (BUILTIN) and assets/* (ASSETS) by macro (via embedded.ts), WASM (with {type:"file"})
│  ├─ embedded.ts    shell · catalog, assets, demo, and evaluator fingerprint by macro; like library-assets.ts, loaded with `require` because Bun 1.4 omits the macro if a static graph reaches the module twice
│  ├─ wasm.d.ts      types for `.wasm` imports (O13; avoids a suppression)
│  ├─ disk.ts        shell · canonical (lstat + ancestor realpath), root, readTree, atomic write (tmp+rename, link)
│  ├─ state.ts       shell · data directory: snapshot, "before" text, events, blobs, session roots
│  ├─ git.ts         shell · git spawn: HEAD, status -z, cat-file --batch, diff --name-only, ls-files, index
│  ├─ cli.ts         shell · check · explain · preset show|compile|apply · rules test · install
│  └─ install.ts     shell · versioned engine, launcher, idempotent merge of .claude/settings.json, pre-commit, CI
├─ scripts/
│  ├─ build.ts       rules test catalog (aborts on failure) → bun build --compile per target → tar + sha256
│  ├─ bench.ts       p50/p95 per path over test/demo-repo with the release binary (compileBinary from build.ts)
│  └─ demo.sh        UC1/UC2 end to end: two presets, the same Writes, opposite verdicts (POSIX; sh and dash)
├─ eval/                        MVP evaluation (W10, outside the binary): tasks, arms A/B/D/E, metrics from state/
└─ test/
   ├─ reconstruct · paths · shell · resolve · match · decide · message · schema · compile · state · ts · ratchet (.test.ts)
   ├─ catalog.test.ts   claude.test.ts   e2e.test.ts   vendor.test.ts
   ├─ payloads/         real Claude Code payloads + expected output (contract; closes each "to verify")
   ├─ presets/          invalid presets with their exact error
   └─ demo-repo/        fixture repo: src/{domain,application,infra}, presets backend-clean-ddd and functional-ts
```

There are **23 modules** in `src` (plus `wasm.d.ts`). Estimate: ~3,000 lines. **Measured after wave 3: 4,718**; the longest are `shell.ts` (603), `gate.ts` (546), `match.ts` (494, parity with ast-grep), and `compile.ts` (465).

**Dogfooding.** Pure (`core` layer): `types`, `claude`, `reconstruct`, `paths`, `ts`, `match`, `resolve`, `evaluate`, `ratchet`, `decide`, `message`, `shell`, `schema`, `compile`, and `fixtures`. Imperative shell: `main`, `gate`, `assets`, `disk`, `state`, `git`, `cli`, and `install`. The shell imports the core and never the reverse.

---

## 3. Central types (`src/types.ts`)

```ts
export type Severity = "deny" | "ask" | "warn";
export type Phase = "pre" | "stop" | "commit" | "ci";
export type Grammar = "typescript" | "tsx";       // .ts .mts .cts → typescript; .tsx .js .mjs .cjs .jsx → tsx [Δ]
export type Read = (rel: string) => string | null;              // relative to the root; null = does not exist
export type Files = Record<string, string>;                     // in-memory sources and fixtures
export type Reconstruction = "exact" | "tool-will-fail" | "unknown";
export type Clock = () => number;                               // monotonic ms; injected by the shell (O27)
export interface Host { read: Read; now: Clock }                // what analyze consults besides the file it judges (O29)

// ── Causes of a deny that is not a rule violation (closed list) ─────────
export type Cause =
  // the agent can fix it ⇒ form deny: does not consume the (file, rule) counter
  | "protected-path" | "request-invalid" | "tool-will-fail" | "cannot-reconstruct"
  | "syntax" | "unresolvable-import" | "shell-write" | "shell-admin" | "hook-switch"   // hook-switch: MH-17
  // only a human can fix it ⇒ deny + halt + notice
  | "payload-unrecognized" | "lock-stale" | "version-mismatch"
  | "snapshot-missing" | "state-io" | "git-missing" | "git-not-repository" | "git-error"
  | "regex-limit" | "contract-loosened";
export const FIXABLE_BY = {
  "protected-path": "agent", "request-invalid": "agent", "tool-will-fail": "agent",
  "cannot-reconstruct": "agent", "syntax": "agent", "unresolvable-import": "agent",
  "shell-write": "agent", "shell-admin": "agent", "hook-switch": "agent",
  "payload-unrecognized": "human", "lock-stale": "human", "version-mismatch": "human",
  "snapshot-missing": "human", "state-io": "human", "git-missing": "human", "git-not-repository": "human",
  "git-error": "human", "regex-limit": "human",
  "contract-loosened": "human",
} as const satisfies Record<Cause, "agent" | "human">;
// "lock-stale" covers a missing, invalid, or old lock, sources that do not verify, and a disappeared preset: same remedy.
// "regex-limit": a rule's regex may have given up on this file; its "does not match" is not an answer (O27).
// "contract-loosened": Stop or pre-commit found a looser lock than the session or HEAD started with, and no human approval record for it.
// "timeout" and "engine-crash" are not Cause: the launcher emits them (literal text in launcher.sh, A6).

// ── Normalized input (harness-agnostic) ─────────────────────────────────
// [MULTI-HARNESS MH-W0] A16 extended by MH-07: several changes per call, Move, agy and Codex forms.
export type HarnessId = "claude-code" | "codex" | "cursor" | "grok" | "agy";
export type HookKind = "pre" | "stop" | "session-start";       // what a registration names: hook <kind> --harness <id>
export interface HookEnv { grokEvent: string | null; projectDir: string | null; remote: boolean }
export interface Session {
  id: string;                      // the harness's own id; state indexes it together with `harness` (MH-05)
  harness: HarnessId;
  agentId: string | null;
  turnId: string | null;           // if missing, the turn is derived from the last recorded Stop
  interactive: boolean;            // Claude Code only: mode ∈ {default, acceptEdits, auto, plan}
}                                  //   ∧ no agentId ∧ CLAUDE_CODE_REMOTE ≠ "true"; if unknown ⇒ false
export interface ProposedChange {  // produced by an adapter and consumed by gate.onPreEdit (A16, MH-07)
  session: Session; callId: string; tool: string;
  path: string;                    // absolute, with no . .. segments or // (otherwise the adapter rejects the call)
  edit: Edit;
  from: string | null;             // origin of a Move, which carries its own change { form: "delete" }
}
export interface ProposedCommand { session: Session; callId: string; tool: string; command: string; cwd: string }
export type HookEvent =
  | { kind: "session-start"; session: Session; cwd: string }
  | { kind: "pre-edit"; changes: ProposedChange[] }           // ≥ 1, from a single call
  | { kind: "pre-command"; command: ProposedCommand }
  | { kind: "stop"; session: Session; cwd: string; reentry: boolean };
export interface Rejected { cause: Cause; kind: HookEvent["kind"]; reentry: boolean; session: Session | null; dirs: string[] }   // MH-06
export type Edit =
  | { form: "full"; content: string }
  | { form: "append"; text: string }
  | { form: "oldnew"; old: string; neu: string; all: boolean; lines: [number, number] | null }   // lines: 1-based, inclusive
  | { form: "hunks"; hunks: Hunk[] }
  | { form: "delete" }
  | { form: "unknown"; cause: string };
export interface Hunk { anchor: string | null; old: string[]; neu: string[]; eof: boolean }

// ── Output ───────────────────────────────────────────────────────────────────────
export interface Violation {       // data only: message.ts builds the text from lock.rules[].text
  rule: string;                    // FQN of the winning alias, e.g. "core/CC-FN-001"
  path: string; line: number;      // relative to the root; 1-based
  symbol: string;                  // "Invoice.calculateTotals" | "<module>" (not sanitized; message.ts sanitizes it)
  measured: number | null; limit: number | null; atSessionStart: number | null;
  severity: Severity;
}
export interface Decision {
  verdict: "none" | "deny" | "ask"; // "none" = no objection; "allow" does not exist
  halt: boolean;
  cause: Cause | null;             // null ⇔ the deny/ask is due to violations
  violations: Violation[];         // introduced and causing the verdict
  warnings: Violation[];           // introduced warns → additionalContext
  attempt: number;                 // attempt n on (agent, file, rule)
  compact: string; full: string;   // ≤ 256 / ≤ 4,000
  notice: string | null;           // to the human: systemMessage / stopReason
  lockHash: string | null;
}
export interface Emission { stdout: string; stderr: string; exit: 0 | 2 }   // exit 1 unrepresentable
export interface DecideInput {
  lock: Lock | null;               // null only with a human cause
  session: Session; event: HookEvent["kind"]; path: string | null;
  introduced: Violation[]; form: Form | null; protectedPath: boolean;
  history: CallEvent[];            // for the same (agent, file), ordered by `at`
  turnDenials: number;             // for the same agent in the turn, including form denies
  astHash: string | null;
  stop: { blocks: number; reentry: boolean; approved: Violation[] } | null;   // approved: asks already approved (§4.3)
}

// ── Pattern language: closed subset of ast-grep rules ─────────────────
export interface MatchRule {
  pattern?: string; kind?: string; regex?: string; matches?: string;
  nthChild?: number | { position: number; reverse?: boolean; ofRule?: MatchRule };
  has?: Relation; inside?: Relation; follows?: Relation; precedes?: Relation;
  all?: MatchRule[]; any?: MatchRule[]; not?: MatchRule;
}
export interface Relation extends MatchRule { field?: string; stopBy?: "neighbor" | "end" | MatchRule }
export interface PatternConfig {   // "x-*" keys are ignored (notes); any other unknown key ⇒ error
  id: string; rule: MatchRule;
  constraints?: Record<string, MatchRule>; utils?: Record<string, MatchRule>;
  files?: string[]; ignores?: string[];  // accepted in the format; compile copies them into params.paths/exclude
  since?: { dependencies: string[]; version: string };
  when?: { cacheComponents: "on" | "off" }; // literal cacheComponents on the first existing root next.config.js, .mjs, or .ts
}

export type Placement = "new-in-exclude" | "edit-generated-or-excluded" | "no-language-pack-in-layer";
export type Impl =
  | { kind: "pattern"; patterns: { typescript: PatternConfig[] } }
  | { kind: "primitive"; primitive: "metric"; metric: "fn.lines" | "fn.params" | "class.publicMethods" }
  | { kind: "primitive"; primitive: "banned-import" }                       // params.packages
  | { kind: "primitive"; primitive: "layer-edge" }                          // lock.layers
  | { kind: "primitive"; primitive: "diff"; op: "no-decrease" | "no-increase";
      count: "markers" | { pattern: PatternConfig } }                       // params.markers by substring, or AST count
  | { kind: "primitive"; primitive: "placement"; cases: Placement[] };

// ── On-disk formats (validated by schema/*.json; the engine reads these fields) ─────────
export interface Check {
  id: string; version: string; area: string;
  cardinality: "singleton" | "multi"; dimension: string; minSeverity: Severity | null;
  params: Record<string, unknown>;             // parameter JSON Schema
  impl: Impl; phase: Phase[]; feedback: { message: string };
}                                               // v1 keys (ir, measures, fingerprint…) accepted and ignored
export interface Alias {
  id: string; check: string; defaults: Record<string, unknown>; severity: Severity | "off";
  source: { work: string; locator: string; paraphrase: string };
  why: string; fixHint: string; avoid: string; examples?: { pass: string; fail: string };
}
export interface Manifest {
  id: string; version: string; status: "complete" | "preview";
  conflicts: { with: string; dimension: string; suggest: { use: string }; why: string }[];
  invariants: Alias[];
}
export interface Fixture {
  language: "typescript"; params: Record<string, unknown>;
  context?: { layers?: Record<string, Layer>; scope?: { include?: string[]; exclude?: string[] };
              generatedMarkers?: string[] };
  target: string; before: string | null;       // "before/" for diff and ratchet
  expect: { verdict: "pass" | "fail"; violations?: { line: number; measured?: number }[] };
  trap?: { family: string; origin: "real" | "corpus" | "forge"; discovered: string; note: string };
}

// ── Preset (MVP subset of §8.3) and lock ────────────────────────────────────────
export interface Layer { paths: string[]; mayImport: string[]; kind: "core" | "port" | "adapter" | "main" }
export interface Loop {
  maxDenialsPerFileRule: number; maxDenialsPerTurn: number; noProgressLimit: number;
  maxStopBlocks: number; allowAsk: boolean; maxDetailedViolations: number;
}
export interface Preset {
  name: string; version: string; engine: string;
  sources: ({ ns: "core"; kind: "builtin"; version: string } | { ns: string; kind: "path"; path: string })[];
  methodologies: string[];
  scope?: { include?: string[]; exclude?: string[] }; generatedMarkers?: string[];
  enforcement?: "enforce" | "shadow";
  layers?: Record<string, Layer>;
  resolve?: Record<string, { use: string; params?: Record<string, unknown>; severity?: Severity; note?: string }>;
  overrides?: Record<string, Severity | "off" | { severity?: Severity | "off"; params?: Record<string, unknown>; note?: string }>;
  ratchet?: { mode: "strict" | "no-new" };
  loop?: Partial<Loop> & { escalate?: "stop" };   // D15.5: stop only
  failMode?: "closed";                            // D15.6: closed only (accepted for compatibility)
  coexist?: { arkgate?: { ownedByArkgate: string[]; config?: string; note?: string } };
}
export interface LockRule {
  id: string;                      // FQN of the winning alias
  aliases: string[];               // every alias that shares the effective rule
  check: string;                   // "core/complexity/fn-max-lines@1.0.0"
  impl: Impl;
  params: Record<string, unknown>; // resolved; `paths`/`exclude` with @layers expanded and files/ignores copied in
  severity: Severity; phases: Phase[];
  integrity: boolean;              // immune to shadow; does not admit off
  origin: Record<string, string>;  // "params.max" → "resolve.fn.size" | "overrides.CC-FN-001" | "alias"
  text: { message: string; why: string; fix: string; avoid: string | null; source: string };
}
export interface Lock {            // lockHash = sha256 of the file bytes (the text is already canonical JSON)
  lockVersion: 1; engine: string; core: string;
  coreHash: string;                // Δ O41: sourcesHash of the builtin catalog it was compiled with
  presetHash: string; sourcesHash: string;
  preset: { name: string; version: string; methodologies: string[] };
  enforcement: "enforce" | "shadow";
  scope: { include: string[]; exclude: string[] }; generatedMarkers: string[];
  layers: Record<string, Layer>;
  sourceDirs: string[];            // path-source folders (protected in addition to the fixed ones, §4.1 step 5)
  ratchet: "strict" | "no-new"; loop: Loop;
  ownedByArkgate: string[];        // listed, never evaluated
  rules: LockRule[];               // canonical order by id
}

// ── Analysis and state ───────────────────────────────────────────────────────────
export interface Analysis {        // one file in one state
  symbols: string[]; violations: Violation[];
  counts: Record<string, number>;  // diff rules: rule → count
  astHash: string | null;          // normalized tree without comments or trivia (no progress)
}
export type Form = { cause: Cause; line: number | null };   // analysis impossible ⇒ deny
export interface Snapshot {        // sessions/<sid>/<rootHash>/snapshot.json
  root: string;                    // absolute root path (Stop needs it)
  head: string | null;             // null = repo with no commits ⇒ every file is new
  start: boolean;                  // created by SessionStart (accepts the root, A20)
  dirty: Record<string, string | null>;      // only if start: rel → blob sha256 | null (did not exist);
}                                            //   if !start, {} ⇒ every "before" = HEAD (never blanks it)
export interface CallEvent {       // contents of the event file (for decide and for manual labeling)
  at: number;                      // ms, set by the shell; history() sorts by at
  callId: string; turn: string; agentId: string | null; kind: HookEvent["kind"]; path: string | null;
  verdict: Decision["verdict"]; halted: boolean; form: Cause | null; shadowed: boolean;
  violations: Violation[];         // introduced deny/ask (counters, precision, correction in one attempt)
  afterSha: string | null;         // on deny, ask, or shadowed, `after` is copied to blobs/<afterSha>
  astHash: string | null;
}
// Name: <turnH>~<agentH>~<fileH>~<verdict>~<form:0|1>~<callIdH>.json   (H = sha256[:12]; agentH "-" = principal;
//         on Stop fileH = "stop" and callIdH = H(sid + at))
//   · per-turn cap: readdir and count of <turnH>~<agentH>~*~deny~* (includes form denies)
//   · counters, no progress, and consecutive form: only *~<agentH>~<fileH>~* are read
//   · Stop blocks for the turn: <turnH>~-~stop~deny~*
```

**Cuts relative to §13.2:** no `batchId`, `fromPath`, `change.kind: delete|move`, `tool.form`, or `before`/`after`/`reconstruction` on the type (A16), and no `Violation.why/fix/text` (they live in the lock and `message.ts` renders them).

**Data directory** (`${XDG_STATE_HOME:-$HOME/.local/state}/pregate/`, protected):

```
sessions/<harness>:<sid>/
  events/<turnH>~<agentH>~<fileH>~<verdict>~<form>~<callIdH>.json    CallEvent (tmp + rename)
  blobs/<sha256>                    content: dirty files at start and `after` of deny/ask/shadowed
  <rootHash>/snapshot.json          Snapshot. The <rootHash>/ directory is created complete in a temporary
                                    directory and moved with rename (fails if it already exists): there is never
                                    a <rootHash>/ without a snapshot
  <rootHash>/head/<H(rel)>.json     {text | null} of rel at snapshot.head; written once with link (A12)
  <rootHash>/sources.json           {lockHash, ok}: sourcesHash verification (§4.1 step 6)
```

Installation: `<DATA> = ${XDG_DATA_HOME:-$HOME/.local/share}/pregate` at setup. Engines: `<DATA>/<version>/pregate`; launcher: `<DATA>/bin/pregate`; CLI symlink: `~/.local/bin/pregate`. State: `<STATE> = ${XDG_STATE_HOME:-$HOME/.local/state}/pregate`, including `codex-trust.json`. Runtime derives `<DATA>` from its executable (MH-18).

---

## 4. Hook path, step by step

### 4.0 The launcher (parent process)

`pregate setup` writes it from `assets/launcher.sh` as `<DATA>/bin/pregate`, with its engine's version, and every global registration `exec`s it through the frozen MULTI-HARNESS MH-22 command (an inline guard that, when the launcher is missing or empty, denies Pre only if there is a preset).

1. It resolves the engine beside itself: `<DATA>/<version>/pregate`, with `<DATA>` = two levels above `$0` (because of the `~/.local/bin/pregate` symlink, one `readlink`). Never from the environment of the moment (MH-18). Its own commands run with `PATH=/usr/bin:/bin`; the engine receives the original PATH (MH-15).
2. If there are arguments and the first is not `hook` (`check`, `explain`, `setup`, …), it `exec`s the engine, without supervision: `check` can last more than 5 s in pre-commit and its exit 1 is legitimate. A missing or empty engine exits with 1 (empty, it would run as an empty script: exit 0).
3. If it is `hook <event>`, or if there are no arguments (`$# = 0` ⇒ `hook auto`, §13.7), it supervises:
   - Explicit Pre reads stdin directly. Only if the engine returns exit 3 is the replay that comes after the version line extracted. Stop, SessionStart, and auto keep the initial copy: Stop reads `stop_hook_active` and auto reads `hook_event_name`. stdout and stderr always go to files (not to `$(...)`).
   - Hard deadline without depending on `wait`: `trap … USR1`, and a background timer does `kill -USR1 $$` when it expires; the trap kills the engine with `kill -9` and emits the fail-closed output. The trapped signal interrupts the parent's `wait`, so the output arrives even if the engine does not die (filesystem hung in state D). Deadlines: Pre 5 s (O30), Stop 45 s, SessionStart 10 s. `TERM`/`HUP` (the harness cancelled) also deny.
4. Protocol (MULTI-HARNESS §10.1): `rc ∈ {0,2}` forwards stdout and stderr and exits with `rc`, except an exit 2 with blank stderr, which Codex would let through. Exit 3 with first line `ENGINE_VERSION` on stdout runs `<DATA>/<v>/pregate` **once**, with the same stdin and within the same deadline (MH-19). Pre returns its original stdin after that line; a missing replay or one that does not start with a JSON object is rejected. An invalid version, a missing engine, or a second exit 3 are fail-closed. Anything else (own engine missing or empty, crash, SIGKILL/OOM, deadline expired, exit 1) emits the **event's fail-closed output**, literal text in the script:
   - **Pre**, the same on all six harnesses: exit 2, empty stdout, and a stderr line of ≤ 256 characters, "PREGATE could not evaluate: …; report it to the user" (MH-15).
   - **Stop**, only on Claude Code (`--harness claude-code` without `GROK_HOOK_EVENT` or `CURSOR_VERSION`): `decision:"block"` + stderr, exit 2, if `stop_hook_active` is not `true`; if it is, `systemMessage` and exit 0. On the others, neutral.
   - **SessionStart**, only on Claude Code: `systemMessage`, exit 0. On the others, neutral.

**Verified in this synthesis** with the prototype (bash 3.2 and dash): a 400 KB stdin passes intact, exits 0 and 2 are forwarded, SIGKILL and exit 1 give deny with exit 2, and an infinite loop is cut off at 2.03 s. It adds between 0.8 and 1.3 ms. The `trap … USR1` and stdout-to-file are verified on day 1 (§9.3 f).

**Residual risk that remains.** That `sh` itself dies, or that the machine has no `/bin/sh`. Stop, pre-commit, and CI cover it (U10).

### 4.1 PreToolUse `Write | Edit`

Every known cause goes through `decide → encode`. The unforeseen exits with exit 1 and the launcher answers (A6).

| # | Step | Budget | If it fails |
|---|---|---|---|
| 0 | Launcher (§4.0) | ~1 ms (measured) | Event fail-closed output |
| 1 | Engine startup (Bun + bytecode, no WASM) | 14–16 ms (measured) | Crash ⇒ step 0 |
| 2 | `profile(flag, raw, env)` → adapter `decode` → `HookEvent`, `Rejected` or `null`; edit keys are closed per adapter | < 1 ms | `Rejected` with no directories denies; otherwise neutral only when no directory or recorded session root reaches a preset (MH-06). `null` ignores Grok shutdown. Unknown reconstruction denies inside scope |
| 3 | Adapter tool dispatch constructs all `ProposedChange`s; unsupported edits become `unknown`. Empty old text creates a missing file (MH-13) | 0 | — |
| 4 | Canonicalize paths and locate the first accepted preset (A20/MH-33), including a move's origin | < 1 ms (+ git on first contact) | No root: machine protections only, no git, WASM or state. A recorded root whose preset disappeared gives `lock-stale`; an unaccepted nested root is skipped |
| 5 | `paths.protects`: machine configs, installation/state and `**/.pregate/**` always; `.git/**`, project harness configs and `path` rule sources inside a rooted session. Realpaths and case-insensitive matching (A26/MH-17/30). Valid `.pregate/requests/*.json` is the only rooted exception | < 0.5 ms | `protected-path` / `request-invalid` |
| 6 | Parse lock and check engine/core. Recompile the current preset with current builtin/path/library/cached Git sources and compare the complete compiler output with normalized disk lock bytes. No fixture execution or replacement write. Within a Pre edit call, each root's admitted lock is reused for its overlay and dependency reviews; the next hook admits it again. `state.sourcesOk` additionally checks source identity per lock/session. | Compilation and source reads are measured as part of the total hook budget; the earlier 1–2 ms hash-only estimate does not describe this implementation. | `lock-stale` or `version-mismatch` ⇒ deny + halt and request explicit `pregate preset compile` (A9). |
| 7 | `evaluate.placement(lock, phase, …)` without parsing (only rules with that phase): EVA-SCOPE-001 (new file in `exclude`; language without a pack inside a layer) and EVA-GEN-002 (editing an existing file with a substring marker or in `exclude`). Out of scope and with no placement ⇒ `none` | < 0.5 ms | Violation ⇒ deny by rule |
| 8 | `reconstruct.apply(current, edit)` | < 1 ms | `tool-will-fail` (form deny "re-read and resend"); `unknown` ⇒ `cannot-reconstruct` |
| 9 | Snapshot (session, root): existing, or created on first contact (`start: false`, `dirty: {}` ⇒ every "before" = HEAD). `before_session` = blob from `dirty`, or `head/<H(rel)>.json` (the first time, `git cat-file` of `snapshot.head`, stored with `link`), or `null` if the file is new in the session | 0 after the first touch; ~20 ms on the first | `<rootHash>/` without `snapshot.json` ⇒ `snapshot-missing` (deny + halt). Git missing, not a repository, or a git error ⇒ `git-missing`, `git-not-repository` or `git-error` |
| 10 | Lazy WASM init (only the file's grammar) + `ts.parse(after)` + `ts.errorIn(parsed, window)`. **[Δ wave 3]** That `Parsed` is what `analyze(after)` receives: a single parse of the "after". The window is computed from the common prefix and suffix with `current`. An ERROR or MISSING node that **intersects** the window ⇒ error | 7 ms + ~11 µs/line | `syntax` with its line (form deny) |
| 11 | `analyze(after)`: rules with `phase ∋ pre`, filtered by `paths`/`exclude`/language and without `ownedByArkgate`. Patterns, metrics, imports + re-exports (≤ 3 hops, ≤ 32 files read) | 1–10 ms | In a layer with `mayImport ≠ ["*"]`: `unresolved` import, `too-deep` re-exports, or invalid tsconfig ⇒ `unresolvable-import` (form deny) **[Δ §4.4]** |
| 12 | `analyze(before_session)`, recomputed (A12), **[Δ wave 3]** under `comparedLock(lock, after)`: diff rules, those the "after" violates, and import rules; the rest cannot change `introduced()` (`ratchet.test.ts` proves it on the catalog fixtures) | ~4 ms (300 lines) / ~25 ms (2,000); less with `comparedLock` | **[Δ wave 2]** A form cause in the "before" counts as an absent `before`: all of `after` is new (strict), which the agent can correct; a deny on text that cannot change does not |
| 13 | `ratchet.introduced(lock, rel, before, after)` | < 1 ms | — |
| 14 | `decide()`: `readdir` of `events/` (the agent's per-turn cap, including form denies), read of events for the same (agent, file) ordered by `at` for counters, no progress (repeated `astHash` or a count that does not fall), and **3 form denies in a row on the file ⇒ halt** **[Δ]**. `ask` only if `session.interactive ∧ loop.allowAsk ∧ path not protected`. In `shadow`, `shadowed` is set (`blocking`, §7.2 #3) | 1–3 ms | — |
| 15 | Write the `CallEvent` (tmp + rename; name with keys) and, on deny, ask, or `shadowed`, `after` in `blobs/<afterSha>` | < 1 ms | `state-io` (deny + halt): without state there are no counters |
| 16 | Selected adapter `encode`, one `writeSync` per channel. Five dialects: MULTI-HARNESS MH-14; no adapter emits `allow` | < 1 ms | — |

**Why an ERROR outside the window cannot hide anything new (A19).** What is outside the window is byte for byte equal to `current`. `current` is either the state left by a call already evaluated in this session, or the base (snapshot or HEAD), or the result of a shell escape, which Stop evaluates with the window against `before_session`. That text contributes no introduced violations, and the ratchet discounts it. If the new text falls inside an ERROR node that starts outside, that node intersects the window and denies.

**Measured totals [Δ wave 3]** with `bun run bench` (30 runs per path, release binary behind the launcher via `sh -c`, new session per sample; macOS arm64, load ~2.2). Budgets: p95 ≤ 150 ms on every path, p50 ≤ 25 ms on shell (§7.2 #5):

| Path | p50 | p95 |
|---|---|---|
| Out of scope | 22.2 ms | 23.7 ms |
| Shell | 22.3 ms | 24.0 ms |
| 300 lines, first touch | 60.5 ms | 63.9 ms |
| 300 lines, second touch | 51.5 ms | 53.7 ms |
| 2,000 lines, first touch | 103.3 ms | 106.7 ms |
| 2,000 lines, second touch | 93.9 ms | 96.0 ms |
| 2,000 lines with committed debt, first touch | 117.8 ms | 123.9 ms |

The first touch costs ~10 ms more than the second: the A12 `git cat-file`. The most expensive part that remains is `match.ts` (~24 ms cold at 2,000 lines: one tree walk per pattern).

**The budget belongs to the reference machine (O31).** These numbers and the p95 ≤ 150 ms are from the reference development machine (macOS arm64, M5 Pro, 18 cores). One call uses about 3.5 times its wall-clock time in CPU (JavaScriptCore's JIT compilation runs on other threads and repeats in every process), so on a 2-core machine the same binary takes several times longer: on `ubuntu-latest` (2 vCPU x64), 2,000 lines with debt gives p95 469–844 ms depending on the runner. In CI the bench reports (§8). That 2 vCPU figure predates the compiled-lock cache and was not measured again on a 2-core runner.

**Compiled-lock cache.** Step 6 recompiles only when no valid entry exists. The key is the hash of the normalized lock, of the preset, of every pack the compiler reads (builtin, library, `path` and pinned git) and of this build (`engine`, `core` and the compiler fingerprint). The file lives in the state directory, `locks/<sha256(root)>.json`. If it is missing, truncated, or its digest does not match, the hook recompiles. The `before_session` analysis is still recomputed on every call (A12).

Measured with the real `hook pre` binary on a `backend-clean-ddd` fixture plus one `path` rule, a new session per sample, an allowed edit of `src/domain/values/money.ts` (linux-x64, 4 vCPU, recorded before this repository pinned Bun 1.4.4; not a v0.0.2 measurement). Before the cache, n=15: p50 72.6 ms, p95 100.9 ms. With the cache, `bun test test/lock-cache.e2e.test.ts`, n=25:

| Pass | p50 | p95 |
|---|---|---|
| Cold (the cache is deleted; recompiles) | 60.6 ms | 64.4 ms |
| Warm (reuses the compiled lock) | 41.1 ms | 43.5 ms |

The cold and the warm decision are identical. Changing the lock or that rule invalidates the entry and denies `lock-stale`; a corrupt entry is recompiled and leaves the same decision.

**Output in Claude Code:**

| Verdict | stdout / stderr / exit |
|---|---|
| `none` | empty / — / 0 |
| `none` with `warnings` | `hookSpecificOutput.additionalContext` ("informational; no action required for this task") / — / 0 |
| `deny` | `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":full}}` **[Δ wave 2: the whole `full`; its first line is the compact ≤ 256]**, plus `"continue":false,"stopReason":notice` if there is `halt` / `full` / **2** |
| `ask` | `permissionDecision:"ask"`, `permissionDecisionReason` = notice (to the human), `additionalContext` = `full` / — / 0 |

`encode()` has no "allow" branch.

### 4.2 PreToolUse `Bash | PowerShell | Monitor`

Steps 0–2 (in `tool_input` only `command` is read; the other keys are ignored, because they do not change what runs), the root from `cwd` (4), and `state.ensureSnapshot(sid, root)`, so that Stop sees the roots reached by `cd`. The step 5 protections always apply; source folders come from the lock or from `preset.json`, and without a valid lock everything under the root counts as in scope. Then `shell.guard(command, cwd, ctx)` runs. It does not load the WASM.

**Permissive lexer.** What it does not recognize (`$(…)`, `<(…)`, `[[ ]]`, PowerShell `{}` blocks) remains an opaque word, and that word is still checked against protected paths and write patterns. Unclosed quotes are not denied: the shell fails and does not write. `sh|bash -c '<literal>'` and `eval '<literal>'` are analyzed again on the inner string; a non-literal argument ⇒ `shell-write`. **[Δ waves 1–2] Pipe to an interpreter:** a script that arrives by pipe to a shell or interpreter (`… | bash`, `curl … | sh`, `cat s.py | python3`, `… | bash -s foo`) is unknown text ⇒ `shell-write`; a literal heredoc or here-string is re-analyzed as a `-c` and a non-literal one ⇒ `shell-write`; a script from a file (`bash f.sh`, `bash < f`) is not analyzed (Stop sees it). Also counted as inline code: `fish --command`, `npx -c`/`--call`, and `pnpm -c`. A single GNU option parser (`getopt`) serves every command (O21).

Outside every preset, only machine protections run: `hook-switch` blocks disabling PREGATE, editing global harness configs/installation/state, and setup/update/uninstall; no git, WASM or state writes. Other harness administration is restricted only inside a root. Codex relative shell write destinations and interactive shells are refused (MH-17/29).

**Denies:**
- writes to in-scope paths: output redirections (`>`, `>>`, `>|`, `&>`), `tee`, `sed -i`, `perl -pi`, the destination of `cp`/`mv`/`ln`/`install`, `dd of=`, `truncate`, `git apply|checkout --|restore`, `patch`, `curl -o`, `wget -O`, and `python|node|bun|perl -e/-c` that mention an in-scope path;
- a write whose destination is not literal (`$VAR`, `$(…)`, backtick, glob): it cannot be established whether it is in scope ⇒ `shell-write`;
- cmdlets `Set-Content|Out-File|Add-Content|New-Item -Value|Copy-Item|Move-Item`;
- any mention of a protected path, except the allowed pre-check;
- `pregate` subcommands other than `check|explain|preset show|rules test`, by any path;
- `--no-verify`, `core.hooksPath`, `disableAllHooks`, `claude plugin disable|uninstall`, and `--settings`;
- other harnesses' binaries;
- inline environment assignments (`VAR=… cmd`) that turn hooks off.

**Allows** reads and pre-check: `pregate` on PATH or `<DATA>/bin/pregate`, with `check --stdin`, `explain`, `preset show` or `rules test`. Input redirection and literal heredocs to these commands remain read-only (MH-29).

Deletions (`rm`, …) are not denied: the truth is the tree (SPEC §10.2.4) and Stop sees them. Git commands that move history or the worktree (`reset`, `checkout <commit>`, `switch`, `stash`, `clean -f`, `cherry-pick`, `revert`, `read-tree`, `checkout-index`) are judged as writes of the files Git reports they would change (`src/git-changes.ts`, read-only Git): a file under `.pregate/` is `protected-path`, and a form whose files cannot be listed is `shell-write`. A deletion of `.pregate/` is caught by step 4 (`lock-stale`) and pre-commit; a deletion of `sessions/<sid>/` makes the new snapshot take HEAD as the base (step 9).

**Cost:** ~20 ms p50, against the §13.6 target of ≤ 15 ms **[Δ: 25 ms budget]**. Bun's measured process floor is 13.7 to 16 ms; if 15 ms is hard, that is an argument for Rust in v1, not for a daemon.

### 4.3 Stop

The launcher watchdog is 45 s and the hook `timeout` is 60 s.

1. For each session root (`state.roots(sid)`: `snapshot.root` of each `<rootHash>/`), the candidates are `git diff --name-only <snapshot.head>`, plus the untracked, plus `snapshot.dirty`. A Stop with no snapshot still denies when `cwd` is an enabled project Git cannot read (`git-missing`, `git-not-repository`, or `git-error`). A readable repository the session never reached stays silent. Roots are judged one at a time: first those touched by this turn's events, then the `cwd`'s, then the rest. The first one that blocks decides and stops. With a 30 s budget (`STOP_BUDGET_MS`, under the watchdog), unjudged roots are named in an incomplete Stop (`stopIncomplete.reason = "budget"`, `stopSkipped`); pre-commit and CI keep judging them, and the next Stop judges them before the rest, so no root goes unjudged forever. `stopFingerprint` also stays within the budget: if it runs out, that Stop follows the per-turn rule. Each root emits `PREGATE-STOP-ROOT i/n <root>`, so a timeout names the root in progress.
2. The "befores" are read with **a single** `git cat-file --batch` (or the snapshot blobs). Then `analyze` (phase `stop`) and `introduced` run, with the error window against `before_session`.
3. **`ask` already approved.** If the on-disk file sha equals the `afterSha` of a `CallEvent` with verdict `ask`, those `ask` violations move to `stop.approved`: they are reported to the human via `systemMessage` and do not block. Otherwise Stop would push the agent to revert what the human accepted.
4. If introduced denies or asks remain and `state.stopBlocks(sid, turnH)` is less than `maxStopBlocks`: exit 2 + `{"decision":"block","reason":…}`. The reason includes "Do not remove functionality or tests to comply; if the fix exceeds the task, stop and report it to the user".
5. If the cap was reached, or if `reentry` and something fails: `systemMessage` to the human with what is pending and the open requests in `.pregate/requests/`.
6. Warns go out through `additionalContext`.
7. Each Stop records its `CallEvent` with `fileH = "stop"`.

### 4.4 SessionStart

- **Outside git:** Pre calls deny with `git-not-repository` (or `git-missing` / `git-error` when that is the failure) (A27).
- **No preset:** silent, with no session state (MH-17).
- **Invalid, old, or other-version lock:** notice; Pre calls will apply step 6.
- **Checks and snapshot:** the complete `sourcesHash` is verified (hash of the evaluable JSON of the `path` sources) and `<rootHash>/sources.json` is written. The snapshot (`start: true`) is built with `git rev-parse HEAD` + `git status -z --untracked-files=all`, copies dirty in-scope files to `blobs/`, and is created by renaming the temporary directory.
- **Context for the agent:** Claude `additionalContext` includes the lock summary and `<DATA>/bin/pregate check --stdin --path <file> --format agent`. Other adapters have no verified SessionStart channel; agy registers none.
- **Without SessionStart:** first Pre snapshots HEAD; root acceptance also permits an uncommitted preset that predates first contact (MH-33). That first contact allows two seconds of file-clock skew. Later contacts do not. An enabled preset the session has not accepted is `lock-stale`, not a silent allow.

### 4.5 `pregate check` (pre-check, pre-commit, and CI)

| Mode | "Before" | "After" | Preset, sources, and lock |
|---|---|---|---|
| `--stdin --path P --format agent` | HEAD **[Δ]** | stdin | Lock on disk. Read only, no state |
| `--staged --ratchet` | HEAD | Index | **From the index** (`cat-file --batch`, a single spawn for everything). Recompiled without running fixtures and compared byte for byte with the index's lock (A10) **[Δ §6.5]** |
| `--ratchet --base <sha>` (CI) | `merge-base` | Tree | From the tree. The CI template first runs `pregate rules test` on every `path` source (U2), then recompiles and compares |

- **Enforcement:** `check` and `decide` share `blocking(lock, violations, cause)`. The preset selects a default; an active alias/check override can select `enforce` or `shadow` independently (O53). Integrity always enforces. Form causes still use the preset default, with human causes and protected-path guards always blocking.
- **Output:** exit 1 if anything blocking remains (`deny` or `ask`), the lock does not match, or the version differs. `warn` ⇒ exit 0 with the text. In pre-commit and CI there is no state and no counters: every introduced blocking violation fails.
- MH-19/20/28: pre-commit invokes global `pregate` on PATH. `check`, `explain` and `preset show` delegate to the lock's engine; `preset compile` uses the current engine. Pins below `FLOOR = "0.0.1"` deny as `lock-stale`; missing pinned engines request `pregate update --engine <v>`. `check --staged` reports registration/trust drift without changing its verdict.

---

## 5. Dependencies (closed list)

### 5.1 What ships in the binary

| Item | Form | Why it is indispensable | License and attribution |
|---|---|---|---|
| `web-tree-sitter` 0.27.0: `web-tree-sitter.js` (156 KB) + `.wasm` (210 KB) | `vendor/`, unmodified, embedded. **It does not appear in `package.json`** | It is the parser runtime. It cannot be extracted by function: the emscripten glue and the API are one unit | MIT. LICENSE + ORIGIN (package@version, URL, sha256) in the folder and in THIRD_PARTY_NOTICES |
| `tree-sitter-typescript` 0.23.2: `tree-sitter-typescript.wasm` (1.42 MB) + `tree-sitter-tsx.wasm` (1.45 MB) | `vendor/`, embedded, **with `grammar.patch`** (O18) | TS and TSX/JS grammars. They share *kinds* and *fields* with ast-grep, so the pilot pack's pattern rules (~650 `kind`, 698 `has`, 422 `field`) run as data. Both grammars are required: `<T>x` is not valid in TSX | MIT. Same |
| Bun runtime | Embedded by `--compile` | — | MIT. Bun links JavaScriptCore (GNU Library General Public License, version 2) and tinycc (GNU Lesser General Public License, version 2.1). Both license texts, the pinned Bun, WebKit, and tinycc source links, and the rebuild note are in THIRD_PARTY_NOTICES |

**Runtime dependencies for whoever installs: zero.** The system tools are `git` (required, A27) and `/bin/sh` (the launcher).

### 5.2 Development and build (never distributed)

| Item | What for |
|---|---|
| Bun 1.3.14 | Compile to a single binary, `bun test`, macros to embed `catalog/` and the `.wasm` (verified) |
| `typescript` + `@types/bun` | `tsc --noEmit` |
| `@ast-grep/napi` 0.45.3 | Differential oracle for `match.ts` |
| `tree-sitter` CLI 0.24.4 + emsdk 3.1.64 (Docker) | Regenerate the grammar with `grammar.patch` (O18). Without the patch it reproduces the published WASM byte for byte; the recipe is in ORIGIN |

**Native APIs in use:** `Bun.Glob` (verified with paths that start with a dot; it is case-sensitive, which is why A26 passes the glob and the path in lowercase), `Bun.JSONC` (tsconfig), `Bun.spawnSync`, `Bun.file`/`Bun.write`, macros and `with {type:"file"}`, `node:fs` (realpath, rename, link, readdir), `node:crypto` (sha256), and `bun:test`.

**Written from first principles** (shorter than importing it):
- permissive shell lexer + rules (estimated ~70 lines; **measured 603** after O21: it does not shrink without losing proven vectors);
- JSON-patch with `add`/`remove`/`replace`/`test` (~40);
- JSON Schema subset interpreter: `type`, `properties`, `required`, `enum`, `const`, `items`, `pattern`, `additionalProperties`, `oneOf`, `minimum` (~90);
- canonical JSON (~15);
- version comparison by exact equality (the preset forbids ranges).

### 5.3 TS/JS parser: evaluation for a fail-closed gate

Cold start of the compiled binary plus a parse of 2,000 lines:

| Option | Runtime artifact | Time | False-deny risk | False-allow risk | Rule format | Verdict |
|---|---|---|---|---|---|---|
| **(a)** Custom scanner or parser of the subset | none | ~16–20 ms | Medium: generics in parameters, `<T,>` in tsx | **High.** JSX text, regex versus division, and nested templates desynchronize the tokenizer and hide code silently. It does not detect syntax errors, so U10 ("parser fails ⇒ deny") is impossible | custom | Discarded: it would end up a worse TS parser |
| **(b)** Cherry-pick by function | — | — | — | — | — | Does not apply. TS, Babel, and acorn are monolithic state machines: `scanner.ts` + `parser.ts` drag in factory, utilities, and diagnostics (30–40 thousand lines of fork) |
| **(c)** Embedded TypeScript 6.0.3 API | none (+32 MB; 96 MB binary) | 45–46 ms | ~0 today. It grows, because the JS API is frozen (TS 7 is Go) | ~0 | `ts.SyntaxKind`: the pack has to be ported and §13.3 is lost | Discarded: D17 allows a complete dependency only if its absence breaks fail-closed, and it does not break it |
| (d1) vendored `@babel/parser` 7.29.9 (513 KB) | none | 37 ms | Low, but it mixes scope errors with syntax errors (21 `VarRedeclaration` where tsc gives 0) | ~0 | Babel AST | Discarded: AST incompatible with the rule dialect (A4). `match.ts`, the catalog's 7 patterns, and the entire pilot pack would have to be rewritten |
| (d2) `oxc-parser` / (d3) `@ast-grep/napi` / (d4) native tree-sitter | `.node` per platform | Embedded: 290–520 ms. Beside the binary: 16–22 ms | Low / like tree-sitter | ~0 / like tree-sitter | ESTree / **native to the pack** | Discarded: embedded, they break the budget, and beside the binary they break "single binary". (d3) remains an oracle in the tests |
| `Bun.Transpiler.scanImports` | native | 17–19 ms | — | **High**: omits `import(m)`, non-literal `require(m)`, and `import type` (verified) | — | Discarded (A23) |
| **(d5) web-tree-sitter WASM + vendored grammars** | **none** (+3.2 MB) | **43 ms** (21 ms on a small file) | **Known and bounded.** `export type *` and `in/out` variance produce ERROR (`accessor` parses in 0.23.2) ⇒ form deny (the safe direction), with a message that names the line | Low. Error recovery marks ERROR/MISSING and any ERROR that intersects the window denies. Residual: a misinterpreted tree with no ERROR (generic ambiguity in TSX) | **ast-grep kinds and fields** | **Chosen** |

**Mitigations for (d5):**
1. **Day 1.** A disposable script (not committed) parses every `.ts/.tsx` in the pilot's HEAD and counts the files with ERROR; the rate is recorded in this document. If valid files fail, the grammar (which is data) is patched and the change is recorded in ORIGIN and NOTICES. There is no parser plan B. **Done (O18):** 8,621 files; **before the patch 596 with ERROR (6.91%), after 4 (0.05%)**, the 4 with a literal NUL inside a string or comment (the tree-sitter-cli 0.24.4 lexer reads it as end of input; they still deny as `syntax`). No kind or field changed (fields 40/43, ABI 14); 102 trees in the pilot that already parsed changed, all corrections (generic tagged templates that were read as `<`/`>`). Residual with no ERROR: `await f<T>(x)` and `` await sql<T>`…` `` are built as a call of `await f`.
2. **In `rules test`** (which `preset compile` runs on every `path` source and `build.ts` runs on `catalog/`), `kind`, `field`, and regex are validated against both grammars (`idForNodeType`, `fieldIdForName`). A typo never "fails to match silently". **[Δ wave 2]** `compile` does not call `compilePattern`.
3. **Semantic coverage.** The differential oracle compares against ast-grep (unpatched native grammar): on the patched constructions the two differ, so its corpus does not include them.

### 5.4 Distribution

- `bun build --compile --minify --bytecode` for `darwin-arm64` and `linux-x64` ("macOS and Linux", §18.1; another target is added when someone asks for it): about 66 MB each. No top-level await, because `--bytecode` requires it; `main` is async because of `Parser.init()`.
- Release assets: platform tar (binary, LICENSE, THIRD_PARTY_NOTICES), `install.sh`, and one `SHA256SUMS` covering all assets (MH-32); private downloads use `gh`.
- With `--no-compile-autoload-bunfig --no-compile-autoload-dotenv` (O32): the binary does not read `bunfig.toml` or `.env` from the directory it runs in, which is the repo it judges.
- `setup` installs and warms the engine, then writes global launcher/registrations: Claude/Cursor/Grok share `~/.claude/settings.json`, Cursor additionally uses its native Stop dispatcher in `~/.cursor/hooks.json`, Codex uses trusted `~/.codex/hooks.json`, and agy uses the `pregate-global` plugin. Shared commands defer shell-local expansion for Grok; Cursor Stop followups share the cap across generation IDs (MULTI-HARNESS §6.4). `install` only manages repo pre-commit/CI and removes legacy 0.1.0 registrations/launcher. `update` retains pinned engines; `uninstall` removes owned entries and restores unchanged foreign configs' original bytes (MH-22–28).
- The CI template downloads the pinned version, verifies the sha256, and sets `timeout-minutes` (a catastrophic regex in a `path` source ends there, §6.1). The Vercel build recipe does the same install for linux-x64 and runs the gate before the framework build. Providers are aggregated in `src/ci/`; a required status that is missing or failing does not pass.

---

## 6. The 18 rules: representation, execution, and `rules test`

### 6.1 Vocabulary

| Type | What it covers | Where |
|---|---|---|
| `pattern` | ast-grep rules:<br>· `pattern` with `$X`, `$$$X`, `$_`;<br>· `kind`;<br>· `regex`: a leading `(?i)`/`(?s)` becomes a flag and `.` excludes only `\n`, as in Rust; lookaround, backreferences, `{` that is not a counted repetition, nested classes, and escapes with another meaning in JS are errors, for parity with Rust's linear regex (residue: `\w\d\s\b` are ASCII in JS);<br>· `has`/`inside`/`follows`/`precedes` with `field` and `stopBy`;<br>· `all`/`any`/`not`, `nthChild`, `matches` + `utils`, `constraints`; `compile` copies `files`/`ignores` into `params.paths`/`exclude`.<br>Metavariables are shared throughout `all`, in order. Comments are `comment` nodes | `match.ts` |
| `metric` | `fn.lines` = max(lines without blanks or comments, statements), which closes the line-compression trap.<br>`fn.params` counts the members of an inline or destructured object type, which closes `opts: {a;b;c;d}`.<br>`class.publicMethods` | `ts.ts` (facts) + `evaluate.ts` |
| `banned-import` | `params.packages`, with `fs` ≡ `node:fs`, subpaths `pkg/x`, `import type`, literal `import()` and `require`, and `export … from` (following re-exports); it compares the package name even if an alias resolves it to a local file | `evaluate.ts` + `resolve.ts` |
| `layer-edge` | The file's layer (most specific glob; a tie follows declaration order) against the resolved destination's layer **by path**, even if the file does not exist. It follows re-exports up to 3 hops and 32 files; beyond that, `too-deep`. `external` is only a node builtin or a valid npm name; `#x`, `~/x`, or `@/x` without a resolving alias are `unresolved`, as is **[Δ wave 2]** a specifier with `?`, `\`, or `#` outside the first character, a `.`/`..` segment in a bare specifier (also after expanding an alias), and a package that imports itself by name; a barrel with a parse error counts as `too-deep`. A file in a restricted layer that imports a module with a syntax error then receives `unresolvable-import`. In a layer with `mayImport ≠ ["*"]`, `unresolved`, `too-deep`, or an invalid tsconfig ⇒ `unresolvable-import` | Same |
| `diff` | `no-decrease` / `no-increase` over a count: `count: "markers"` (substrings of `params.markers` in the text) or `count: {pattern}` | `evaluate.ts` (count) + `ratchet.ts` |
| `placement` | Change type, `scope`, generated markers, layers, and languages with a pack, without parsing | `evaluate.placement` |

**Macro `@generatedMarkers`** in `params.markers` **[Δ O14]**: `compile` replaces it with `preset.generatedMarkers` and `fixtureLock` with `context.generatedMarkers`; `evaluate` never sees it.

**Macro `@layers` and `@layers:<kind>`** in `params.paths` **[Δ A21]**. `compile` expands it to the preset's layer globs. `@layers` with no layers ⇒ `[]` (the rule applies to no file; `[]` never means "everything"). `@layers:<kind>` with no layers of that kind is a compilation error.

**Catastrophic regex (O27).** JS regex backtracks and `(a+)+` passes compilation. It is not rejected by form: the pilot pack uses legitimate nested quantifiers (`^((\w+|getKernel\(\))\.)*(emit|…)$`). JavaScriptCore does not hang on a **repeated group**: it gives up and answers "does not match", without throwing. `match.ts` does not take that "does not match" from a regex with a repeated group if it took more than 50 ms (injected clock) or if the text exceeds 64 KB: the search ends in `regex-limit` (deny + halt + notice to the human, also in `shadow`). A regex with a repeated group and more than 16 groups does not compile: its memory would be exhausted before 64 KB. A regex without a repeated group never gives up and never reads the clock; if it hangs, the three faces block the same way: the hook denies by watchdog, pre-commit does not finish, and CI cuts it off with `timeout-minutes`.

### 6.2 Map of the 18 invariants

There are 17 checks, because `banned-imports` is `multi`. The traps column is the seed of the `trap/` fixtures.

| Alias | Check `core/…` | impl | Parameters | Minimum traps |
|---|---|---|---|---|
| CC-FN-001 | complexity/fn-max-lines | metric `fn.lines` | `max`, `paths` | Statements compressed onto one line; nested arrow |
| CC-FN-002 | complexity/fn-max-params | metric `fn.params` | `max`, `countInlineObjectMembers`, `exempt` | `opts: {a;b;c;d}`; destructured without a type; rest with a tuple |
| CC-ER-002 | errors/no-empty-catch | pattern: `catch_clause` whose body has only comments, `console.$M(...)`, `$L.(log\|warn\|error\|info\|debug)(...)`, or `void $X`; also `.catch(() => {})` | `loggers` | `catch (e) { void e }`, `catch {}`, log-only |
| CA-DEP-001 | dependencies/layer-direction | layer-edge | (`lock.layers`) | Barrel that re-exports infra, `import type`, `require('../infra')`, alias `@/infra`, `export * from` |
| CA-DEP-002 | dependencies/banned-imports | banned-import | `paths: ["@layers:core"]`, `packages` (ORM, frameworks) | `require`, literal `import()`, barrel, subpath `@prisma/client/runtime` |
| CA-UC-001 | api-surface/single-public-method | metric `class.publicMethods` | `paths`, `max: 1` | Public arrow property; `static` method |
| DDD-VO-001 | immutability/readonly-fields | pattern: field without `readonly`; `this.$F =`/`+=`/`++` or `Object.assign(this, …)` outside the constructor | `paths` | Mutable `private` field with a getter |
| DDD-ENT-001 | immutability/no-public-setters | pattern: public `set` accessor; public method that assigns `this.$F` from a parameter (structural, not by name) | `paths` | `set x()`, computed name |
| FCIS-IO-001 | dependencies/banned-imports (instance 2) | banned-import | `paths: ["@layers:core"]`, `packages` (fs, child_process, net, http…) | `fs` versus `node:fs`, `fs/promises`, barrel |
| FCIS-IO-002 | effects/no-clock-random-env | pattern: every reference in **value position** to `Date`, `process`, `performance`, `Math.random`, `crypto.randomUUID/getRandomValues`, or the same property on `globalThis`/`window`/`global`; a name the file binds (parameter, variable, relative import) is not the global | `paths`, `allow` (pure qualified names, e.g. `Bun.Glob`) | `const D = Date`, `Date['now']()`, `const {now} = Date`, `globalThis.Date.now`, `globalThis.window.x`, `new Date()`, a `window` bound in another function, `declare`/`import type`/namespace/`const enum` with the global's name |
| TDD-FOCUS-001 | testing/no-focused-tests | pattern: `(describe\|it\|test\|context\|suite)` followed by `.only`/`.skip` or `["only"]`/`["skip"]` as a reference (not only as a call), anywhere in the chain; also every reference to `fit`, `fdescribe`, `xit`, `xdescribe`, `xtest`, except **[Δ O40]** where the file binds that name (the FCIS-IO-002 scope walk, but an import never binds) and reads of those names from `globalThis`/`window`/`global`/`self` or from `require()`/`import()` of a package | `paths` (test globs) | `it["only"]`, `const o = it.only`, `it.concurrent.only`, a global `fit` beside a `const fit` in another test, `const fit = globalThis.fit` |
| TDD-DEL-001 | testing/assertions-no-decrease | diff `no-decrease` of the pattern `expect(...)` / `assert*(...)` | severity `ask` | Deleting the test through the shell (Stop sees it). Without interactivity ⇒ deny + halt |
| EVA-GEN-001 | integrity/new-generated-marker | diff `no-increase` of `markers` (substring) | `markers` = `lock.generatedMarkers` | Marker in a comment, a string, or JSX text |
| EVA-GEN-002 | integrity/edit-generated-or-excluded | placement `edit-generated-or-excluded` | — | Existing file with a marker or in `exclude` |
| EVA-SUP-001 | integrity/new-inline-suppression | diff `no-increase` of `markers` | `pregate-disable`, `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `biome-ignore` | `/* eslint-disable */` block |
| EVA-DYN-001 | integrity/no-dynamic-import-in-layer | pattern: `import($X)` / `require($X)` with a non-literal argument; `createRequire`, `eval`, `new Function`. **[Δ O35]** `require` and `eval` as a property count only on `module`/`globalThis`/`global`/`window`/`self` (by member, bracket, or destructuring, also with a cast or chaining); a method of another object named `require` or an `eval:` key are not loaders | `paths: ["@layers"]` | `require(name)` after a deny; `module.require(x)` and `globalThis.eval(x)` beside `x.require()` |
| EVA-CAST-001 | integrity/double-type-assertion | pattern: `$X as unknown as $T`, `$X as any as $T`, `<$T><unknown>$X`, with or without parentheses | — | `(x as unknown) as T` |
| EVA-SCOPE-001 | integrity/out-of-scope-file | placement `new-in-exclude` + `no-language-pack-in-layer`, the latter only for code **[Δ O34]** | `extensions`: programming languages without a pack, in lowercase and compared case-insensitively; `""` is the file with no extension. CSS, Markdown, JSON, SVG, HTML, and images are not denied | `.py`/`.sql` inside a layer; `.PY`; file with no extension; new file in `exclude` |

**Distribution:** 7 patterns, 3 metrics, 3 import rules, 3 diff, and 2 placement. All are `deny` by default except TDD-DEL-001 (`ask`).

**Wave 1 extensions (W7 review, each with its fixture; 112 fixtures in total, 117 after wave 4a, 122 after O34/O35, 123 after the O35 review (1.1.1), 125 after O40, and 126 after its review (1.1.1)):** EVA-DYN-001 adds aliased `require`, `require.call`, `module.require`, and `eval`/`Function` read from `globalThis` by member, bracket, or destructuring; DDD-VO-001, writes through casts on `this` and `Object`/`Reflect`; EVA-CAST-001, `never` and arrays of `unknown`/`any`/`never` as an intermediate step; DDD-ENT-001 binds the parameter by assignment; CC-ER-002, nested empty blocks and `() => undefined` handlers; TDD-FOCUS-001, destructured `only`/`skip`; FCIS-IO-002, `Temporal`, `random*` from `node:crypto`, `Bun`, `Deno`, `import.meta.env`, and `fetch`; FCIS-IO-001, database drivers, network clients, `vm`, and `bun:ffi`; EVA-SUP-001, `oxlint-disable` and `deno-lint-ignore`. EVA-GEN-001 uses `@generatedMarkers` (O14).

**Substring markers (EVA-GEN-001/002 and EVA-SUP-001).** It is conservative on purpose: a marker inside a string counts, and failure goes toward deny, consistently across the three rules. If it gets in the way in a linter repo, that false deny is measured in the pilot.

### 6.3 Execution

`analyze(lock, phase, rel, text, host)` parses once and walks the `lock.rules` applicable to the phase.
- `line` is the row + 1.
- `symbol` is the chain of named declarations that contains the match (`Class.method`, `fn`, `<module>`). Anonymous callbacks are attributed to the named symbol that contains them.

`introduced(lock, rel, before, after)` (mode = `lock.ratchet`; `rel` because `Analysis` does not carry a path):
- **`strict`, or null `before`:** everything in `after`.
- **`no-new`:**
  1. a violation on a symbol that is not in `before.symbols` is new, unless its body (without the declared name) is that of an earlier symbol whose body is gone, and only for the violations that symbol no longer has, each one once: a rename, a move or an extraction in the same file does not renew that debt. A copy next to an original that still carries it, with the same body or another, is new. `symbolBodies` is computed only when the analysis has at least one violation;
  2. among the preexisting ones, if the count per (rule, file) rises, the symbols whose count grew are reported.
- **`diff`:** the `after` count compared with the `before` count, according to `op`. `measured` = after, `limit` = before (0 if there is none), on line 1 with symbol `<module>`.

Each match counts (two on the same line raise the count); the output has one violation per (rule, line, symbol). MVP limits: in `no-new` a function with a preexisting violation can grow ("cannot grow" is v1), and import violations are attributed to `<module>`.

### 6.4 `pregate rules test <dir>`

1. **Structure.** `disk.readTree(dir, true)` loads `Files` (the binary does not carry fixtures; the catalog is tested from the repo, in `catalog.test.ts` and in `build.ts`). Validated:
   - schemas and IDs; namespace equal to that of `source.json`; versions; that the check exists;
   - `kind`, `field`, and regex of the patterns against the grammar;
   - `why`/`fixHint`/`avoid`/examples for every alias that can be `deny`.

   An unknown `impl` is a compilation error, never skipped silently. For example `sql-normalized@1`, `principal-path`, or `numericCheck` from the pilot pack.
2. **Fixtures, in the same process.** For each fixture (`pass`, `fail`, `trap`; **[Δ wave 2]** alias folders do not exist: an alias is tested with the fixtures of the check that name its `examples`):
   1. builds the project in memory with `files/` (without the `.fixture` suffix) and `before/`;
   2. builds the lock with `compile.fixtureLock(check, fixture.params, fixture.context)` (`ratchet: "no-new"`; without `before` it is equivalent to `strict`);
   3. runs `placement` + `analyze` + `introduced`;
   4. requires: `pass` ⇒ 0 violations; `fail`/`trap` ⇒ exactly the declared lines (and `measured`, if declared).
3. **Determinism.** A second run must give the same result: it detects state that leaks between runs. **[Δ wave 2]** Reversed order and another virtual root cannot change anything by construction (`Read` is relative and the core never lists files), so they are not run. Patterns are compiled on both grammars.
4. **Minimums.** Per check: 2 `pass`, 2 `fail`, and 1 `trap`. Per alias: 1 `pass` and 1 `fail` with its defaults (§5.4.1).

The output is one line per fixture (`ok   <check> <kind>/<case> -> fail [line(measured)]` or `FAIL … ` with what was expected), with exit 1 on any failure. `rules test catalog` gives 126/126 today. `preset compile` runs `rules test` on every `path` source (U2, DD-69), as does the CI template; pre-commit recompiles without fixtures (§4.5). `scripts/build.ts` runs it on `catalog/` and aborts if it fails.

**The `amarilla/` pack (27 rules) does not compile as-is against the closed `Impl`.** 17 are TS pattern rules and run as data. The other 10 do not:
- 7 primitives with parameters the MVP does not have: `banned-import` ×3 (`specifiers` as regex, `appliesWhen.directive: "use client"`, `follow: "values"`, `ignoreTypeOnly`, `clauses`), `placement` ×1 (`on`/`deny`), `diff` ×2 (`clauses` `unchanged-if-exists-at-ref`/`monotonic-name`, `identityKeys`/`numeric`), and `principal-path` ×1;
- 3 SQL-only rules (`sql-normalized@1`); `events-append-only` loses its SQL pattern and keeps the TS one.

**Proposed decision [Δ, needs your OK]: (b)** those 10 rules stay out of the PREGATE pilot and remain in ArkGate (`coexist.arkgate.ownedByArkgate`), consistent with D15.1; the engine does not grow. The pilot evaluates 17 pattern rules + the core methodologies (D15.3). Alternative **(a)** is to extend `banned-import` (`specifiers` regex, `appliesWhen.directive`, `ignoreTypeOnly`, `follow: "values"` with depth 3), `placement` (`deny` globs + `on: create`), and `diff` (`unchanged-if-exists-at-ref`): ~150 more lines in `evaluate.ts`/`resolve.ts` and schemas, with no §18.1 requirement that asks for them.

Data work in both cases: rename `rule.json` to `check.json` and `pack.json` to `source.json`, remove the SQL patterns, and complete the fixture minimums.

---

## 7. What is NOT built in the MVP

### 7.1 Out by SPEC §18.1

See SPEC §18.1, "Outside the MVP". In addition: SQL (`amarilla/` pack, §6.4), NotebookEdit (yields `unknown`), and SessionEnd. Grok's profile remains pending question 9 (D15.9): until then, a foreign payload ⇒ `payload-unrecognized`.

### 7.2 SPEC deviations and cuts that have no A# row

Those marked **[Δ]** contradict the SPEC and **need your OK**.

| # | Decision | Why | SPEC |
|---|---|---|---|
| 1 | **[Δ]** In-house pattern engine on web-tree-sitter instead of `@ast-grep/napi` + native tree-sitter | A3. The embedded native costs 295 ms per call. The rule format does not change | §13.3 |
| 2 | **[Δ]** A stale hook lock denies and halts. In-memory recompilation validates complete bytes; it does not repair or replace the lock. | A9; supersedes the earlier metadata-only admission | §4.2, §4.5 |
| 3 | **[Δ]** In `shadow`, every verdict becomes `none` except protected paths, integrity rules, and `human` causes; the rest is recorded as `shadowed`. `check` applies the same function (`blocking`), so the pilot's pre-commit does not block uncalibrated rules | It serves to calibrate in the pilot: a form deny from a grammar gap must not stop the team. What could not be evaluated still denies | §4.5, §8.5.7 |
| 4 | **[Δ]** Macro `@layers[:kind]`; `@layers` with no layers ⇒ `[]` | A21 | (added) |
| 5 | **[Δ]** Shell-guard budget: p50 ≤ 25 ms | It is Bun's process floor | §13.6 |
| 6 | **[Δ]** The `check --stdin` pre-check uses HEAD as the "before" | It does not know the session. It differs only if the file was already dirty at the start | §11.6 |
| 7 | **[Δ]** Launcher deadline of 5 s for every Pre (including shell) | The launcher does not read stdin on Pre. The deadline is wall-clock time, and parallel calls share the cores: with 2 s, three 2,000-line edits at once on a 2 vCPU runner were already cut off (O30). 5 s leaves half of the 10 s timeout | §13.6 (2 s edit, 1 s shell) |
| 8 | **[Δ]** State directory with the session first: `…/pregate/sessions/<sid>/` (events per session; snapshot per root) | Stop lists the roots with a `readdir`; the per-turn cap crosses roots | §11.3 |
| 9 | **[Δ]** Git is required | A27 | §9 |
| 10 | **[Δ]** `**/.git/**` protected from the MVP | An editable `.git/config` via Edit turns off pre-commit (`hooksPath`) | §10.2.6 (v1: `.git/hooks/**`) |
| 11 | **[Δ]** Extensions `.mts`, `.cts`, `.cjs`, `.jsx` in the TS/JS pack | Without them, changing the extension dodges every rule outside a layer. It is one line in `grammarOf` | §18.1 (`.ts .tsx .js .mjs`) |
| 12 | **[Δ]** `unresolvable-import` in every layer with `mayImport ≠ ["*"]` and in every phase; `too-deep` and an invalid tsconfig count as unresolved | Cutting off silently past the cap was a false allow. The reason for the exception (parallel batches) does not apply: layers are resolved by path, not by existence | §4.4 (only `core`/`port` in Pre) |
| 13 | **[Δ]** Case-insensitive paths everywhere | A26 | §6.7 ("where it applies") |
| 14 | **[Δ]** Form denies count toward the per-turn cap, and 3 in a row on the same file ⇒ halt | A grammar gap or a badly reconstructed CRLF produced an endless loop (go/no-go: loops < 5%) | §4.4, §11.3 |
| 15 | **[Δ]** Pre-commit recompiles without running fixtures; CI does run `rules test` | The lock does not depend on the fixtures; running them on every commit costs seconds with the pilot pack | §6.5 ("rules test required when compiling") |
| 16 | **[Δ]** `amarilla/` pack: 10 rules outside the pilot (§6.4, option b) | The closed `Impl` does not express them; extending it is not required by §18.1 | §18.1 (evaluation) |
| 17 | **[Δ]** D17: "anonymous" = without coupling to the package, **with** attribution (LICENSE, ORIGIN, THIRD_PARTY_NOTICES) | MIT requires keeping the notice; D17 left it "(To be confirmed)" | D17 |
| 18 | `install` does not edit the excludes of tsconfig, ESLint, or the test runner (D15.4) | The `.fixture` suffix already makes the fixtures inert (DD-72) | §6.2 |
| 19 | `install` merges `.claude/settings.json` and does not touch `core.hooksPath` if the repo already has a hook manager (`core.hooksPath`, `.husky`, `.githooks`, lefthook): it prints the line to add | Overwriting ArkGate's hook (D15.1) or the pilot's `.githooks` would break the pilot | §13.7, §10.2.9 |
| 20 | `bench` is `scripts/bench.ts` (latency), not a subcommand. The summary for arm D's CLAUDE.md is the output of `pregate preset show` | It is internal and does not go in the binary | §13.8, §16.2 |
| 21 | Stop does not keep a re-evaluation queue of `background_tasks` | What they write later is seen by the next Stop, pre-commit, and CI | §4.2 |
| 22 | TDD-DEL-001 with no exemption for also having deleted the production symbol | It requires a test → production mapping. Without it, the rule is conservative (ask or halt) | §11.3 |
| 23 | `file_path` paths with `.`, `..`, or `//` ⇒ `payload-unrecognized` | Claude Code sends normalized absolute paths; a `..` in the nonexistent part could change layer or leave the root | §4.3 |

---

## 8. Test strategy

Rule: test with real domain data (fixtures, payloads, evasion commands), with no mocks and no fault-injection flags. The core receives `Read`/`Files`, so the tests use in-memory maps.

| File | What it tests | How |
|---|---|---|
| `catalog.test.ts` | The 18 invariants: pass/fail/trap, determinism (second run), minimums, ratchet cases with `before/` and O14 | Golden output of `rules test catalog` (126 fixtures) |
| `match.test.ts` | Pattern-engine semantics | One table per operator, plus the **differential against `@ast-grep/napi`**: every pattern in the catalog and the pilot pack against every fixture file, on both grammars (~18,000 comparisons, 0 differences), with the same node, the same metavariables, and where each one binds |
| `reconstruct.test.ts` | Exact edit, not found or not unique, `replace_all`, empty `old`, BOM/CRLF, window calculation | Table |
| `paths.test.ts` | Protected at any depth and without a lock; `**/.git/**`; case in protected paths, scope, layers, and `paths` (A26); nested root and root registered only by SessionStart; realpath of nonexistent paths; symlink (including a dangling one) to a protected path; `grammarOf` extensions | Temporary repos |
| `shell.test.ts` | Every vector in §10.1; non-literal write destination; `sh -c`/`eval` with a literal and a non-literal string; protections without a lock; what is allowed (`<root>/.pregate/bin/pregate check --stdin <<EOF`, reads); unknown syntax and unclosed quotes **without** a deny | Table of ~400 POSIX and PowerShell commands |
| `resolve.test.ts` | Relatives, `.js`→`.ts`, `index`, tsconfig `paths`/`baseUrl`/`extends`, re-exports of 3 hops, `too-deep` past 3 hops or 32 files, invalid tsconfig (unreadable or missing `extends`), `external` only for builtins and npm names (`#x`, `~/x`, `@/x` ⇒ `unresolved`) | In-memory tree |
| `decide.test.ts` | §11.3 table (attempts, no progress, the agent's per-turn cap including form denies, subagent with its own budget, 3 form denies in a row ⇒ halt, `ask` according to interactivity, shadow without touching integrity, `blocking` for `check`, Stop with `blocks`/`reentry`/`approved`) | History table |
| `message.test.ts` | First line ≤ 256, total ≤ 4,000, sanitization (`[A-Za-z0-9@/._$-]`, ≤ 80), never strings or comments from the code, order, "+N more", literal pre-check with the launcher path | Properties |
| `schema.test.ts` | The schemas use only supported keywords; every JSON in the catalog, the presets, and the fixtures validates | Walk |
| `compile.test.ts` | The 3 presets compile with a byte-stable lock; `test/presets/*` fail with the exact error (unresolved conflict via a local manifest, override on an inactive one, integrity `off`, different ns, different engine, `path` source with a red fixture, `@layers:<kind>` with no layers of that kind); `@layers` with no layers ⇒ `[]`; `files`/`ignores` copied into `params` | Golden |
| `claude.test.ts` | Contract: `test/payloads/*.json` (Write, Edit, MultiEdit, Bash, PowerShell, Monitor, Stop, SessionStart, Grok-style payload) → exact stdout, stderr, and exit. **Each "(to verify)" is closed with a case:** `old_string: ""`, `continue:false` with exit 2, `additionalContext` next to `ask`, Stop with exit 2, CRLF in Edit. Also, a table: each required field × {missing, wrong type} ⇒ exit 2 + `payload-unrecognized`; extra key in Write/Edit ⇒ halt; extra key in Bash (`dangerouslyDisableSandbox`) ignored; `file_path` with `..` ⇒ `payload-unrecognized`; the string `"allow"` never appears | Golden |
| `e2e.test.ts` | Compiled binary + launcher over a git copy of `test/demo-repo`: SessionStart → deny → correction → `none` → Stop (UC1, UC2: the two presets deny different things and each deny is corrected in one attempt). Also:<br>· pre-commit with a staged violation ⇒ exit 1; in `shadow`, only integrity ⇒ exit 1;<br>· committed lock out of date ⇒ exit 1;<br>· missing engine ⇒ exit 2 + deny; missing launcher ⇒ the inline guard in `settings.json` denies;<br>· `hook auto` with no arguments ⇒ supervised;<br>· engine that throws ⇒ exit 1 ⇒ launcher deny; SIGKILL to the engine ⇒ deny;<br>· `path` source with a regex that gives up (`(a+)+b`) ⇒ `regex-limit` (deny + halt) before 2 s; with a polynomial regex without groups ⇒ watchdog at 5 s ⇒ deny (O30);<br>· deleted `snapshot.json` ⇒ deny + halt; deleted `sessions/<sid>/` ⇒ the "before" becomes HEAD;<br>· `.pregate/` deleted mid-session ⇒ `lock-stale`; uncommitted preset + SessionStart ⇒ gate active;<br>· `install` over a `settings.json` with another hook and a repo with `.githooks` ⇒ both intact;<br>· 20 parallel Pre calls on (file, rule) ⇒ counter = 20. They go through the placement path (new file in `exclude`, no parse): what is tested is the counter, not the latency (O30);<br>· `bunfig.toml` with `preload` and `.env` in the repo ⇒ the engine ignores them (O32).<br>**[Δ wave 3]** 34 tests: the binary is compiled with `compileBinary` from `build.ts`; launcher and watchdog under sh, bash, and dash; also a sibling and nested root, absolute shell destinations, Stop without `prompt_id`, inline guard via stderr, pre-commit with tsconfig imports from the index, approved ask | Real processes |
| `ratchet.test.ts` **[Δ wave 3]** | `comparedLock` and a supplied `Parsed` do not change any result: each fixture code file as the "after" of itself and of another, under the 3 presets and `strict` (> 100 with violations); through the gate, committed debt lets an innocuous edit through and denies a new violation | Real fixtures and a temporary git repo |
| `vendor.test.ts` | sha256 of `vendor/**` matches ORIGIN; NOTICES lists every component, including the LGPL note | Hash |

**Outside `bun test`:**
- `scripts/bench.ts` measures p50/p95 per path (§4.1). The budgets, p95 150 ms for a Pre path and p50 25 ms for the shell guard, belong to the reference development machine (O31: macOS arm64, M5 Pro, 18 cores). Run there without flags, the script exits 1 when a path is over its budget. CI does not apply that absolute budget: the `bench` and `latency` jobs pass `--inform`, so a hosted runner over 150 ms is reported in the job summary with the machine it ran on and does not fail for that. What fails in CI is the regression gate (`--gate bench/latency-baseline.json`): the median p95 of three repeats above 1.55 times that platform's committed baseline, or a hook that objects. `bench` is a required check on main. A second step in those jobs informs and cannot fail them: `--against <checkout>` builds the engine of the last release with the same toolchain, times both engines in turn on every sample, and reports the ratio per route. A hosted runner that is slow slows both, so the ratio reads a regression that the fixed baseline cannot. No ratio is a gate yet. The committed baselines per platform and runner are in [hook latency](benchmarks/hook-latency.md); the hosted Windows baseline is several times the reference budget.
- `scripts/build.ts`: `rules test catalog` and then darwin-arm64 and linux-x64 in `dist/` (tar with `pregate`, `THIRD_PARTY_NOTICES`, `LICENSE` if it exists (O28), and `.sha256`). CI: typecheck → unit → e2e → build → dogfooding.
- **Dogfooding:** the repo's `.pregate/` has `core`/`shell` layers (§2) and the FCIS + clean-code + tdd + integrity methodologies, pinned in W0 before writing code. With CC-FN-002 by default (max 3, counting inline object members), signatures such as `analyze` (5) or `placement` (4) are new files in `strict` and the gate would deny its own code. Proposal: override `CC-FN-002.params.max: 5` with a note ("pure core with explicit dependencies"); what needs more parameters receives a named type from `types.ts` (`DecideInput`). Pre-commit and CI run `pregate check --ratchet` on the code itself. **[Δ wave 3]** Lock committed; `check --ratchet --base 843d370` passes. Against the whole tree the preset marked 75 preexisting violations (67 CC-FN-001, 5 FCIS-IO-002, 2 CC-FN-002, 1 CC-ER-002). **[Δ O29]** Today it gives 0: `check --ratchet --base <first commit>` passes, with the CC-FN-001 threshold set explicitly in the preset.

---

## 9. Build plan and spec→code map

The initial build plan in independent units (`W0`–`W10`), the integration order, and the complete MVP requirement→file map (`SPEC §18.1` and decisions `D12`–`D17`) are kept in ARCHITECTURE-HISTORY.md.

---

## 10. Orchestrator decisions during construction

The historical log of decisions made during construction and evolution of the engine (`O1`–`O83`, including the grammar patch `O18`, the regex backtracking limit `O27`, the watchdog budget `O30` and the reference-machine budget `O31`, the protection against `bunfig.toml`/`.env` `O32`, and later deliveries) is kept in ARCHITECTURE-HISTORY.md.
