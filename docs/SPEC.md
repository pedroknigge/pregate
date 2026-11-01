# PREGATE: The Last Tool For AI
### Product and technical specification, v2.1 (2026-10-01)

**Design history, with later implementation notes.** Current behavior and options
are documented in [the command reference](CLI.md), [pack inventory](packs.md),
[feature guides](README.md) and [v0.0.1 release notes](releases/0.0.1.md). The original absolute
pre-write promise and early exclusions below are historical intent: supported edit
tools can be checked before writing, shell inspection is heuristic, and reports,
feedback and whole-project audits are now implemented. Catalog prose is not
executable enforcement. Historical pack counts/acceptance apply to their candidate.

The current core 0.0.1 activates 64 project requirements, including the original
48 software invariants, plus four general change guards by default, with reviewed
explicit disable. Unbound requirements remain unverified. Source engine 0.0.1
is the published release. Engineering
policies formerly named `core/clean-code`, `core/clean-architecture`, `core/tdd`
and `core/ddd-tactical` are now optional packs. [Project fitness](features/project-fitness.md)
supersedes the historical mandatory-integrity/default selection model below.

The current candidate also bounds engine stdin at 16 MiB, requires strict UTF-8
and EOF within five seconds, and rejects invalid input before version redirection.
Supervisor Pre failures use each harness's native denial format; the universal
exit-2 launcher description in the historical 0.2.4 contract below is superseded.
See [harness guarantees](features/harness-and-shell-guarantees.md) for scope and
stdin evidence for verification limits.

**0.2.4 implementation contract:** [MULTI-HARNESS.md](MULTI-HARNESS.md) supersedes the original per-repo installation and declarative profiles below. Five pure adapters (`claude-code`, `codex`, `cursor`, `grok`, `agy`) normalize calls to `pre-edit.changes[]` with optional move origin `from`. Reconstruction supports full, append, ranged old/new, exact Codex hunks and delete; multi-file calls overlay their proposed tree and one deny blocks all. Empty old text creates a missing file only. Standalone directories operate with or without Git: directory traversal and snapshot fallbacks decouple the Git/GitHub requirement (O72). Over 300 invariant rules covering software engineering, future human maintainability, modular monolith architecture, and agent skill contracts are systematically cataloged, with 81 automated checks active across 8 library packs and 9 presets (O73). Outside every preset, machine protection remains active with no git, parser or state; unreadable envelopes deny, while recognized rejected envelopes with only unrooted directories are neutral. Grok shutdown is ignored (MH-01–17).

Global `setup` installs engines under `<DATA>/<version>/`, launcher under `<DATA>/bin/`, and `~/.local/bin/pregate` on PATH. Claude/Cursor/Grok share one Claude settings registration; Cursor also has a native Stop registration; Codex has trusted hooks; agy has the `pregate-global` plugin. Real CLI corrections and acceptance are in MULTI-HARNESS §6.4. `update [--version v | --engine v]`, `uninstall [--purge]` and `doctor` operate on the machine; repo `install [--git-hook] [--ci github]` removes legacy registrations and only manages pre-commit/CI. Runtime derives DATA from its executable; hook exit 3 redirects once to the lock's engine, and CLI read-only repo commands delegate before reading stdin. Pins below `FLOOR = "0.2.0"` deny. Pre launcher faults universally emit exit 2, empty stdout and nonempty single-line stderr. SessionStart without a preset is silent. Roots whose preset predates first contact are accepted without SessionStart. `doctor` checks drift/trust and each adapter's canary through literal `$SHELL -c`. Releases carry LICENSE, THIRD_PARTY_NOTICES, installer and `SHA256SUMS` (MH-18–34). Release v0.2.4 is published on GitHub Releases and verified on macOS, Linux, and Windows.

> **A prevention gate for bad code and bad architecture. If it breaks your invariants, it never gets written.** *(chosen tagline, U11)*
>
> **In one sentence.** A PreToolUse with hundreds of invariants drawn from architecture and pattern books, chosen by methodology in a JSON preset, that validates or invalidates every write call so that what comes in already meets the maintainability contract the user chose.
>
> The step that breaks the invariant does not propagate.

> **Conventions**
> - **[V]** marks a behavior verified in official documentation or in source code. For Claude Code the source is the raw markdown at `https://code.claude.com/docs/en/<page>.md` (latest version in the changelog as of 2026-10-01: **v2.1.287**). For the other harnesses, the verified matrix in `docs/research/harnesses-2026-10-01.json` and `harnesses-grok-2026-10-01.json`.
> - **(to verify)** marks an assumption that must be confirmed with a contract test against the installed version before implementation.
> - **[MVP] / [v1] / [v1.1] / [v2]** indicates in which delivery each capability appears.
> - **U1–U11** are user decisions (Appendix A; in `docs/inputs/decisiones-usuario.md` they appear as D1–D11). They override anything else in this document. **DD-NN** are design decisions (Appendix B).
> - **Scope (U10).** PREGATE has a single responsibility: code that violates the preset **never gets written**. It is self-sufficient (it works without ArkGate) and composable (it can coexist with ArkGate without double enforcement). Reports, burn-down, coverage, and lifecycle flows are ArkGate's territory, its previous generation (U9, §15.0).
> - Methodologies are cited by book and chapter, always paraphrased. This document does not reproduce verbatim text from any book.
> - IDs, field names, and technical terms are in English.

---

## 1. Vision and problem

**What it is.** A pre-write gate. Before the agent writes or edits, every call is validated against a set of invariants. If it violates one, the call is invalidated and the reason comes back as a constraint on the next attempt. It is not a linter after the merge, and it is not a paragraph in the prompt: it is the equation of the step.

**Vision, in one verifiable sentence.** You choose one or more methodologies (for example Clean Architecture + DDD) and the AI cannot write code that violates them: every write is validated *before* it touches disk against the invariants your JSON preset activates, and the rejection tells the AI what to fix on the next attempt. ESLint does not know what an aggregate, a layer, or a value object is; PREGATE does.

**What it is for.** Today the agent wins if the code works. With the gate, correctness remains necessary but stops being sufficient. A call can compile, pass tests, and still be invalid if it concentrates complexity, crosses a layer, splits a responsibility, invents a single-use abstraction, or leaves a dependency in the forbidden direction.

**How the agent behaves in front of a rule.** The agent does not negotiate the rule. It rewrites until it complies, or it declares that the task does not fit the preset's envelope and stops. There is no third way: it does not dodge the rule, it does not shrink the task, and it does not retry the same edit hoping for a different result.

**What "100% maintainable" means.** It means **100% conformant to the invariants of the chosen preset**, not "100% proof against future context". The gate forces compliance with what is written; it does not force a human not to hate the code a year later, and that includes what no book has named yet. That is why the preset states explicitly which methodologies are on. If a rule can be satisfied in the letter and broken in the spirit, it is split into a smaller rule or removed. **A rule the agent can win without improving the structure does not stay in the catalog** (§5.4, §12).

**The preset travels with the project.** `.pregate/preset.json` is versioned in the repo and pins the versions of the rule sources. Another agent, another session, or another harness (Claude Code, Codex, Grok Build…) applies the same invariants. Methodology stops being a prompt preference and becomes configuration.

**Ambition, brought down to earth.**
- **Catalog:** hundreds of binary invariants traceable to books. The horizon is about 400 entries over about 265 deterministic canonical checks (§7). Practices that cannot be made binary today do not enter the catalog: they wait in a candidate backlog (§5.5).
- **What blocks:** in v1, between 60 and 120 deterministic invariants for TypeScript with measured precision. The MVP brings 18 (12 methodology and 6 integrity), chosen to show that the combination of methodologies changes what gets blocked.

**The problem.**
- Agents produce code that **works** (it compiles, it passes tests) and that often **is not maintainable by humans**:
  - violated layers (the domain imports the ORM);
  - long, nested functions;
  - speculative abstractions or, the other way around, fragmentation with no point;
  - swallowed errors;
  - duplicated knowledge;
  - tests weakened so they pass.
- Rules in the prompt (CLAUDE.md, AGENTS.md, `.cursorrules`) are **suggestions**: the model can ignore them.
- Existing linters have three limitations for this case:
  - they review **after** writing, or they depend on the agent deciding to call them over MCP;
  - they are not organized by **methodology**;
  - they do not produce messages designed for an LLM to correct itself.
- The human who inherits the code pays the debt.

**Product hypothesis.** If every AI write has to meet explicit constraints, chosen by the team and verifiable, and the rejection allows a correction in one attempt, then the cost of the **next** change goes down, whether a human or an AI makes it. It is measured in §16.

**Limit, stated inside the product.** Much of good design (real SRP, names that reveal intent, the right level of abstraction) **is not a mechanical invariant today**. Those practices are not disguised as rules: they stay as candidates in the backlog and enter the catalog only when the Rule Forge demonstrates a binary, non-gameable version, usually because the preset contributed knowledge (a glossary, a layer map, markers) (§5.5, §12). *(U3, decided: deterministic catalog only.)*

**"No matter what", stated honestly (U10).** The guarantee is the set **fail-closed hook + pre-commit + CI**, all three with the same binary and the same lock. The hook is the primary enforcement and, faced with input it cannot verify (truncated, unknown payload, parser failure), it denies. But several harnesses fail open on a timeout or a crash, and writes exist outside the edit tool (shell, MCP, generators). Pre-commit and CI close those gaps by running **exactly the same invariants**: that is not a lifecycle feature, it is part of the guarantee.

**Pilot repo (U7, U8).** `Amarilla-David/amarilla-platform`: mostly TypeScript (also JS, PLpgSQL, Python, and C#), large and alive, with ArkGate already installed as PreToolUse, eslint-rules with a warning ratchet, and about 240 architecture tests. That is why the legacy ratchet and coexistence with ArkGate are critical from the MVP.

---

## 2. What it is and what it is NOT

### What it is
- **[MVP]** A **pre-write gate** built on a **core that is agnostic of harness and language**. The core receives a normalized event (`ProposedChange`), reconstructs the resulting file, evaluates it against the preset's invariants, and returns a `Decision`:
  - `deny`, with an actionable reason the AI sees;
  - no objection (the harness's normal permission flow continues);
  - escalation (`ask` the human, or halt).
- **[MVP]** A **Claude Code adapter** (PreToolUse on `Write`/`Edit`, a guard on `Bash`/`PowerShell`/`Monitor`, a gate on `Stop`). **[v1→v2]** Adapters for other harnesses with pre-edit hooks, and **[v1.1]** post-edit adapters with revert where there is no pre-edit (§14).
- **[MVP]** A **JSON preset** where the user chooses methodologies, explicitly resolves conflicts between them, adjusts parameters and severities, and declares layers. It answers the question "which invariants does each call validate?" (§8.7).
- **[MVP]** **Rules in JSON, never in prose** (U1): one folder per canonical check, with its `check.json` and its `pass`/`fail`/`trap` fixtures. The rule travels with its proof (§6).
- **[MVP]** A **shadow mode** (`enforcement: "shadow"`) that evaluates without blocking. It is an **explicit calibration mode** (pilot, coexistence with ArkGate), never the default: the default is `enforce`.
- **[MVP]** An **integrity pack** that is always active, against cheap evasions.
- **[MVP]** A **single binary** used the same way in the hook, in pre-commit, and in CI, with the same lock on disk: each rule has a single implementation. From the MVP there is a versioned pre-commit and a minimal CI template; SARIF and per-platform templates arrive in v1.
- **[MVP]** **Coexistence with ArkGate** without double enforcement (`coexist` in the preset, §15.0). **[v1]** Importer `pregate import arkgate`.
- **[MVP→v1]** A **ratchet** for legacy code that blocks only what gets worse. In the MVP it denies every violation on a new symbol and compares counts per (rule, file) for pre-existing ones; in v1, fingerprints per symbol.
- **[v1]** A **curated catalog** of canonical checks grouped by area and of methodology manifests that reference them.
- **[MVP→v1]** A **preset compiler** that requires an explicit resolution of every conflict and produces a deterministic lockfile on disk (MVP); inheritance, scopes, and remote sources in v1.
- **[v1]** A **PREGATE MCP server** with two functions: introspection for the agent (`get_active_invariants`, `check`, `explain_rule`) and the **Rule Forge**, where the agent proposes new invariants and PREGATE acts as a deterministic judge (U2, U4; §12).
- **[v1]** Distribution as a Claude Code **plugin**.

Architecture: **one core, three faces.** The hook is enforcement, the CLI is the human's face, and MCP is the agent's face (U4).

### What it is NOT (non-goals)
1. **It is not a boundary against a malicious adversary.** The hook is **primary enforcement and fails closed**; pre-commit and CI run the same invariants with the same binary and the same lock, and they are part of the same guarantee (U10). What it does not promise is to resist someone with local permissions who wants to turn it off on purpose: the agent has write permissions and several harnesses fail open on a timeout or a crash (§14.5). Against that, the net is CI with CODEOWNERS.
2. **It does not contain judgment rules.** The catalog only has binary, deterministic rules (U3, decided). Judgment practices wait in the candidate backlog. LLM reviews **stay outside the product** (§18.6).
3. **It is not a lifecycle tool.** It does not do debt reports, burn-down, coverage, exploration, planning, or "before" guidance of the CLAUDE.md kind: that is ArkGate's territory (U10). PREGATE only prevents, and it verifies the same invariants in pre-commit and CI.
4. **It does not use MCP as enforcement.** MCP is optional: the agent may not call it. Enforcement is only the hook (and, as a net, pre-commit and CI).
5. **The agent does not write its own constraints.** It can **propose** rules through the Forge and propose preset changes as requests; it never **activates** them. Activating in the preset is a human act through the CLI (`pregate preset apply`, `pregate forge promote --activate`), and `preset.json` is always `deny` for the agent (U4, §8.6).
6. **It does not replace ESLint, Ruff, Sonar, or the compiler.** It does not validate syntax, types, formatting, or functional correctness. Its value is in the methodology layer and in the loop with the agent.
7. **It does not correct code on its own.** It never rewrites the tool input (`updatedInput` or equivalent): it denies and explains (§13.9).
8. **It does not guarantee "good design".** It guarantees compliance with an explicit contract.
9. **It does not reproduce the books.** Only short paraphrases with a citation.
10. **It does not implement every language or every harness in the MVP.** The MVP brings the TS/JS language pack and the Claude Code adapter, but the core is designed agnostic of harness and language from day 1 (U6).
11. **It does not replace human PR review.** It takes the mechanical problems off the reviewer.
12. **It is not for organizations in the MVP.** Managed settings, CODEOWNERS, and the pack registry arrive in v1 or v2.

---

## 3. Users and use cases

**Primary MVP user:** an individual dev or a small team that works in TypeScript and delegates heavily to a coding agent (Claude Code in the MVP).

| User | Delivery | Situation | What they need |
|---|---|---|---|
| **Individual dev** | MVP | New or medium project, delegates a lot to the AI | Choose 2 or 3 methodologies and have the AI stay on the rails without reviewing every diff. Installation in under 5 minutes |
| **Small team with legacy** | MVP (counts + new symbols) → v1 (fingerprints) | Repo with debt | The AI does not make the code worse (ratchet) without getting blocked by inherited violations |
| **Pilot repo team** (amarilla-platform, U7) | MVP | Large, live TS repo, with ArkGate already installed and its own rules in `arkrules`, CLAUDE.md, AGENTS.md, and `docs/north-star` | An `amarilla/` pack with its invariants (U8), coexistence with ArkGate without double enforcement (U9), and a reliable ratchet |
| **Multi-harness team** | v1 | One person uses Claude Code, another Codex or Grok Build, in the same repo | The same preset produces the same decisions in any supported harness |
| **Tech lead** | v1 | Several devs and agents in the same repo | A versioned preset as a design contract, the same in the hook and in CI, and exceptions with human approval |
| **Team with its own conventions** | v1 | Missing an invariant that no pack brings | Their agent proposes it through the Forge, PREGATE judges it, and a human activates it |
| **Organization or platform** | v2 | Many repos and shared policies | Corporate preset, packs shared by git or npm, hook in managed settings, aggregated metrics |
| **Rule author or community** | v2 | Wants to contribute a methodology or a language pack | Rules as data, fixtures as proof, trap corpus, measured precision |

**Use cases**
- **UC1. Greenfield with a chosen architecture [MVP].** Preset with `clean-architecture` + `ddd-tactical`. The AI imports `@prisma/client` from `src/domain/`. The hook denies with CA-DEP-002 and points to the ports path declared in the preset, and the AI corrects it.
- **UC2. Two presets, two behaviors [MVP, demo criterion].** On the same repo:
  - with `functional-core-imperative-shell`, `Date.now()` inside `src/core/` is denied (FCIS-IO-002);
  - with `clean-architecture` + `ddd-tactical`, that code passes, and what is denied is a public setter on an entity (DDD-ENT-001).
- **UC3. Legacy [MVP].** A 180-line function receives a bugfix. It is allowed if no new violations appear in the file relative to the start of the session, and every violation on a symbol that did not exist at the start of the session is denied with no compensation. In v1 it is also required that the function not grow, with a *sprout method* notice.
- **UC4. Weakened tests [MVP].** The AI deletes assertions so the test passes. TDD-DEL-001 escalates immediately to the human (`ask`) in interactive sessions of harnesses where `ask` is reliable and, in the others, denies and halts the turn.
- **UC5. Shell bypass [MVP].** After a deny, the AI tries `cat > src/x.ts <<EOF`. The shell guard denies it, the Stop gate detects it anyway if it got through, and pre-commit stops it before the commit.
- **UC6. Explain [MVP].** Two commands:
  - `pregate explain CC-FN-002` shows source, why, example fixtures, and effective parameters;
  - `pregate explain --path src/domain/invoice.ts` lists every invariant that applies to that file.
- **UC7. Conflict between methodologies [v1].** The user adds `code-complete` to a preset that already has `clean-code`. Both pin `fn.params` (3 versus 7). `pregate preset compile` fails, shows the conflict, proposes the `pairs.json` suggestion, and waits for the human to write the resolution in the preset. Nobody chooses the easy side for them. *(In the MVP the embedded manifests do not overlap each other; the compiler's error path is tested with a local fixture manifest that pins a different `fn.params`.)*
- **UC8. CI [MVP minimal template; v1 SARIF].** `pregate check --ratchet` applies in the pipeline the same lock the agent saw, with the same binary (U10).
- **UC9. Same preset, another harness [v1].** In a Grok Build session, the agent tries the same Prisma import from the domain. The Grok adapter normalizes the `search_replace`, the core denies with CA-DEP-002, and the compact reason (≤ 256 characters) reaches the model.
- **UC10. Forge an invariant [v1].** The team wants "no file in `src/domain/` declares a class with a `Repository` suffix that is not an interface". The agent, via MCP, creates the draft, writes `check.json` and fixtures, and asks for judgment. The judge runs the fixtures, checks determinism, and applies the trap corpus: it detects that renaming to `Repo` evades the rule and rejects it with that reason. The agent hardens the rule, the judge admits it, and the human promotes and activates it with the CLI.
- **UC11. Pilot with ArkGate [MVP].** On amarilla-platform, ArkGate keeps enforcing its layers. The preset declares in `coexist.arkgate` which invariants belong to ArkGate; PREGATE does not evaluate them (they stay in the lock with that origin) and applies the rest. No invariant is denied by both tools at once.

---

## 4. How it works (end-to-end flow)

### 4.1 Flow architecture: adapter → core → adapter

```
 Harness (Claude Code, Codex, Grok Build, …)
   │  native event (PreToolUse / BeforeTool / tool.execute.before / …)
   ▼
 Harness adapter  ──► ProposedChange { harness, tool, path, before, after, session, … }
   │                  (normalizes full file | old/new string(s) | patch)
   ▼
 PREGATE core (agnostic of harness and language)
   · project root + preset/lock + pinned rule sources
   · protected path? · scope · validated reconstruction
   · language pack → neutral IR (modules, resolved imports, functions, params,
     complexity, public surface)
   · active rules (phase=pre) · ratchet against before_session · counters
   ▼
 Decision { verdict: allow | deny | ask, halt, violations[], warnings[],
            reasonCompact (≤ 256), reasonFull }
   │
   ▼
 Harness adapter ──► native output (exit 2 + JSON, throw, {block, reason}, …)
                     allow ⇒ "no objection": NEVER a native allow
```

The same core serves the CLI (`pregate check`, pre-commit, CI) and the MCP server (`check` in dry-run mode). What changes between faces is only the input and the output.

### 4.2 Diagram of the reference adapter (Claude Code)

```
 SessionStart (startup|resume; and "compact" to reinject [v1])
   └─► pregate hook session-start --harness claude-code
        · looks for .pregate/preset.json (no preset → systemMessage once/session, inactive)
        · lock on disk current? (hash of preset + sources + engine) → if not, recompile in
          memory (deterministic, from the committed preset) + systemMessage "run pregate
          preset compile and commit the lock". If compilation fails → failMode on Pre.
          pre-commit and CI fail if the committed lock does not match the preset
        · session SNAPSHOT per (session_id, root): HEAD + git status + copy of the
          dirty/untracked files in scope. If SessionStart failed or expired, it is taken
          lazily on the first event of the session                                    [MVP]
        · additionalContext: compact preset summary + pre-check command               [MVP]

 Claude decides Write / Edit / (MultiEdit)
        │
        ▼
 ┌──── PreToolUse  matcher "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor" ─────────────┐
 │ 0. Dispatch by tool_name (a single handler; matching handlers run in parallel [V])              │
 │ 1. stdin: tool_name, tool_input, tool_use_id, cwd, session_id, permission_mode, agent_id?       │
 │ 2. Adapter: does the payload match the declared profile (--harness)? If not → failMode          │
 │ 3. ProposedChange; path = realpath of the deepest existing ancestor + remaining segments;       │
 │    root = first .pregate/ upward, accepted only if it existed in the snapshot or in HEAD,       │
 │    or if the root preset declares it (if not: the nested root is ignored and is a protected path)│
 │ 4. Protected path? (**/.pregate/**, rule folders, harness settings, data directory;             │
 │    case-insensitive on volumes that do not distinguish case) → deny                             │
 │ 5. Scope: include − exclude − generated − .pregate/** (always out). A generated marker or       │
 │    an exclude exempts only files the agent does not edit: creating a new one → EVA-GEN-001 /    │
 │    EVA-SCOPE-001; editing one that already existed → EVA-GEN-002                                │
 │ 6. Reconstruction: current = disk; after = apply tool_input (§4.4)                              │
 │ 7. before_session = snapshot (or HEAD; or ∅ if the file is new in the session). A snapshot      │
 │    missing for an already registered session → failMode, never a new "first contact"            │
 │ 8. Language pack: parse (tree-sitter) → IR. ERROR nodes in the changed range → formal deny      │
 │ 9. phase=pre rules from the lock (A, B-local, integrity) on after                               │
 │10. Ratchet: violations(after) against violations(before_session)                                │
 │11. Decision: severity × enforcement × counters (append-only state) × permission_mode            │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
    │ nothing new           │ warn only (introduced)       │ deny                │ escalation
    ▼                       ▼                              ▼                     ▼
 empty exit 0        exit 0 + additionalContext    exit 2 + JSON deny     interactive: exit 0 + ask
 (normal permission  ("informational; no action    + reason (Claude       (+ additionalContext)
  flow continues)     required for this task")      sees it)              otherwise: exit 2 + deny
                                                                          + continue:false + stopReason
    │
    ▼ the tool writes to disk
 PostToolUse Write|Edit [v1] ─► reread disk; emit ONLY if Pre did not evaluate or there is a new
                                unreported deny (dedupe by tool_use_id + fingerprint):
                                "This write WAS ALREADY APPLIED. Fix forward with Edit."
 PreToolUse Bash/PowerShell/Monitor [MVP]
                             ─► protected paths, administrative commands, other harness
                                binaries, writes to in-scope paths → deny.
                                Point snapshot only if the heuristic matches [v1]
 PostToolUse Bash [v1]       ─► if there was a point snapshot: diff → evaluate → block + reason
 PostToolBatch [v1]          ─► only records resolved imports inside the batch; additionalContext if
                                it is verified to accept it. NEVER block (that stops the agentic loop);
                                violations go to Stop
 ConfigChange [v1]           ─► block changes that turn off hooks or the plugin
    │
    ▼
 Stop [MVP] / SubagentStop [v1, only files of the agent_id]
   ─► git diff + status against the snapshot of each root touched in the session (includes worktrees;
      covers Bash, MCP, run_in_background)
   ─► if background_tasks[] is not empty: pending session → re-evaluate on the next Pre/Stop
      and on SessionEnd
   ─► phase=stop rules: per-session test integrity, counterweights, cycles, and duplication [v1]
   ─► violations introduced in the session: decision:block (max 2 per turn)
      inherited or low-impact: additionalContext (non-error feedback [V])
   ─► after the cap: systemMessage to the human with what is pending

 pre-commit [MVP] / CI [MVP minimal template; v1 SARIF] ─► same binary, same lock
   ─► close of the guarantee (U10): the same invariants for every harness, with or without hooks
```

The other harnesses follow the same scheme with their equivalent events (session start, pre-tool, post-tool, end of turn) when those exist. The equivalence table and what is missing in each one is in §14.

### 4.3 Input the Claude Code adapter receives [V]

**Common fields** (source: https://code.claude.com/docs/en/hooks, section "Common input fields"):
- `session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, and `effort.level`;
- `agent_id` and `agent_type` when the call comes from a subagent.

**PreToolUse fields:** `tool_name`, `tool_input`, and `tool_use_id`.

**Shapes of `tool_input`** (according to the hooks doc and the TypeScript SDK types):

| Tool | `tool_input` |
|---|---|
| `Write` | `{ file_path, content }` |
| `Edit` | `{ file_path, old_string, new_string, replace_all? }`. Exact replacement, no regex, against the current content [V] |
| `NotebookEdit` | `{ notebook_path, cell_id?, new_source, cell_type?, edit_mode? }`. Out of the MVP |
| `Bash` / `PowerShell` | `{ command, description?, timeout?, run_in_background? }`. `PowerShell` also exists as an opt-in on macOS and Linux [V] |
| `Monitor` | Runs commands in the background with the same permission rules as `Bash` [V]. Normalized to `ProposedCommand` with `background: true` |
| `MultiEdit` | **Does not appear** in the current documentation. It is in the matcher for compatibility; if it arrives, `reconstruction: unknown` ⇒ `failMode` until there is a contract test |

**Other verified facts:**
- On Write and Edit, `file_path` always arrives **absolute**. On Windows it uses backslashes.
- `cwd` follows Claude on `cd` and in worktrees, but `${CLAUDE_PROJECT_DIR}` does not. That is why the root is determined by searching upward for `.pregate/` from `file_path`.

### 4.4 Reconstruction of the resulting file

There are **three edit shapes** among the harnesses surveyed. The adapter translates each native tool to one of them and the core reconstructs `after` with a common algorithm (the per-harness detail is in §14.2):

| Shape | Native examples | Algorithm |
|---|---|---|
| **Full file** | Claude `Write`, Gemini/Qwen `write_file`, Copilot `create`, VS Code `create_file`, Grok `write`, opencode/Kilo `write`, Factory `Create`, pi `write` | `after = content`. If the profile marks the tool with `mayRewrite` (Gemini `write_file`: unescape with non-Gemini 2/3 models and `ModifyWithEditor` [V]), `exact` holds only for the declared content and post-tool re-evaluation is mandatory [v1] |
| **Insert / append** | Kiro `fs_write` insert/append, Cline `editor.insert_line` | Insert at the line or at the end according to the profile; if the position is not determinable, `unknown` |
| **old/new string(s)** | Claude `Edit`, Qwen `edit`, Gemini `replace`, Copilot `edit`, Grok `search_replace`, opencode/Kilo `edit`, Augment `str-replace-editor` (numbered pairs), pi `edit` (list of pairs against the original), Cline `editor`, VS Code `replace_string_in_file` / `multi_replace_string_in_file` | Read the disk and apply each replacement with the harness semantics: exact and unique unless `replace_all`; in sequence or against the original, as the profile declares |
| **Patch** | Codex `apply_patch` (`*** Begin Patch`, multi-file, context hunks), opencode/Kilo/Amp/Factory/Cline/VS Code/Grok-codex `apply_patch`, Grok `hashline_edit` (line-hash anchors) | Parse the patch with the dialect parser, produce one `ProposedChange` per affected file (add, delete, modify, move), and apply the hunks on disk with context or anchor matching |

**Reconstruction result.** Each `ProposedChange` carries a `reconstruction` field:
- `exact`: the final content was evaluated with certainty.
- `tool-will-fail`: in a harness with exact matching, `old_string` does not appear or is not unique. **It is denied on formal grounds**, without consuming the rule counter: "old_string not found / not unique; re-read the file and resend". The tool was going to fail anyway, so denying costs nothing, and it closes the gap of a parallel edit that makes `old_string` appear between Pre and execution (TOCTOU).
- `unknown`: the result cannot be determined. Cases: fuzzy matching by the harness (Gemini `replace` tries exact → flexible → regex → fuzzy [V]), placeholders of the "...existing code..." kind (VS Code `insert_edit_into_file` [V]), undocumented payload, patch dialect without a parser yet (for example `hashline_edit` before its support), empty `old_string` in a harness whose profile declares `emptyOld: "unknown"`.
- `truncated`: the harness truncated the input (Grok Build replaces a `toolInput` larger than 128 KiB with a string that ends in " [truncated]" and sets `toolInputTruncated` [V]).

**Empty `old_string`.** In Qwen and Grok it creates a new file [V]; in Claude Code it is not documented. The profile declares `emptyOld: "create" | "error" | "unknown"`; with `unknown`, `failMode` applies. There is a contract test for Claude `Edit` with `old_string: ""`.

**Hard rule (U10):** `unknown` and `truncated` **never** produce "no objection". `failMode` applies (default `closed`: deny) with a formal reason: "PREGATE cannot evaluate this edit; resend it as an exact replacement or a full write". The agent can comply deterministically.

**Truncated input (Grok Build).** If `tool_input` arrives as a string or `toolInputTruncated` is `true`, the adapter extracts `file_path` from the prefix with a tolerant JSON parser (key order is not guaranteed). If the path is out of scope (a lockfile, for example), there is no objection. If it cannot be extracted or it is in scope, `failMode` with the reason "input truncated by the harness (>128 KiB): create the file small, then extend it with search_replace edits under 128 KiB each".

**Details**
- **Normalization.** BOM and CRLF are detected, normalized to `\n`, and positions are mapped back for messages.
- **Syntax errors in `after` (U10: "parser fails ⇒ deny").** If `after` has `ERROR` nodes inside the range changed by the call, the output is a **formal deny** that does not consume a counter: "PREGATE cannot parse the edited region (<file>:<line>); send syntactically complete code". Pre-existing `ERROR` nodes outside the changed range do not block, but rules that need that subtree report it as not evaluated. That closes the evasion of writing code that tsc accepts and tree-sitter does not parse.
- **Deletion (`change.kind: delete`).** In Pre, protected paths and test deletion are evaluated (TDD-DEL-001, EVA-TEST-001); the rest of the rules are re-evaluated at Stop on the resulting tree.
- **Multi-file patch.** If any file in the patch produces `deny`, the entire call is denied: the harness does not allow applying it in part. The message groups by file.
- **Parallel calls.**
  - Layers are decided by the **resolved path** of the import, not by its existence. A relative import toward a file that does not exist yet (because it is written in the same batch) is still evaluated by glob.
  - An import that cannot be resolved (alias with no match) and that is not an external package: in a file of a layer `kind: core | port`, a **formal deny** ("unresolvable import in a core layer; use a relative path or a tsconfig alias that resolves"). Outside those layers, it does not produce a violation in Pre and is re-evaluated at Stop.
  - Two parallel edits on the same file are evaluated against the same disk. State marks them and Stop evaluates the combined result.

### 4.5 Decision and output (Claude Code adapter)

| Result | Output | Who sees it |
|---|---|---|
| Out of scope, or no new violations | `exit 0`, empty stdout. **[V]** "Staying silent doesn't approve it": the normal permission flow continues | nobody |
| `enforcement: shadow` | empty `exit 0`; what would have been denied goes to `state/` | nobody (log) |
| `warn` only, **introduced in this call** | `exit 0` + `hookSpecificOutput.additionalContext` | Claude, as a system-reminder **[V]** |
| `deny` | **`exit 2`** + JSON with `permissionDecision:"deny"` and `permissionDecisionReason`; stderr **always** carries the same `reasonFull` (with invalid JSON, Claude takes the reason from stderr) | **Claude** **[V]**: the self-correction channel |
| Escalation in an interactive session (`loop.escalate: "ask"`) | `exit 0` + `permissionDecision:"ask"` + reason + `additionalContext` with the violation (to verify that `additionalContext` is delivered together with `ask`) | the human sees the reason **[V]**; Claude sees the `additionalContext` |
| Default escalation (`"stop"`), or any `ask` in a non-interactive session | `exit 2` + JSON `deny` + `continue:false` + `stopReason` (to verify that `continue` is honored with exit 2) | the human (`stopReason`) and Claude (reason) |
| No preset in the repo | `exit 0` + `systemMessage` once per session: "PREGATE inactive: run `pregate init`" | the human |
| Stale lock | In-memory recompilation from the committed preset + `systemMessage`. If it fails, `failMode` applies. Pre-commit and CI fail with a stale lock | the human |
| Engine or `core` version different from the one pinned in the preset | `failMode` with "engine/core version mismatch"; `check` in pre-commit/CI exits with exit ≠ 0 | the human |
| Payload that does not match the declared harness profile | `failMode` with the reason "harness payload not recognized" | according to the mode |
| Internal error or watchdog expired | `failMode` (§13.6) | according to the mode |

**[V] Facts that constrain the design** (sources: hooks and https://code.claude.com/docs/en/hooks-guide):
- **Exit 2 always blocks**, even if the JSON is invalid (since v2.1.214), and uses the JSON `reason` as the reason. That is why every deny goes out with exit 2 **and** JSON. With exit 0, truncated JSON is equivalent to not deciding.
- Exit 1 without JSON, a crash, a timeout, or a mistyped path **do not block**: "a mistyped path in settings.json leaves the gate silently disabled".
- **Precedence** among hooks: `deny > defer > ask > allow`. A `deny` blocks in **every** mode, including `bypassPermissions`.
- `continue:false` takes priority over any decision.
- `ask` forces the prompt in `auto` mode. With `bypassPermissions` and `dontAsk`, its behavior is not documented. That is why, **hard rule**: `ask` is emitted only if all of these conditions hold:
  - `permission_mode ∈ {default, acceptEdits, auto, plan}`;
  - there is no `agent_id`;
  - `loop.allowAsk` is not `false`;
  - `CLAUDE_CODE_REMOTE` is not `true`;
  - the harness profile declares `ask` reliable **for that native mode** and there is an interactivity signal (`ask.modes`, `ask.headlessSignal`, §14.3);
  - **the path is not protected**: on PREGATE or harness configuration there is never `ask`, always `deny` (§8.6), because it is not verified that `ask` forces the prompt to be shown in every mode (for example `acceptEdits`; the changelog records a case where `auto` overrode a hook `ask`).

  In any other case, `ask` becomes deny with `continue:false`. Without an interactivity signal, `ask` becomes `deny`. `-p` or SDK sessions do not bring a documented field that identifies them (to verify), so for CI or headless, configure `loop.allowAsk: false`.
- PREGATE **never** emits `permissionDecision:"allow"` (nor the native allow of any harness): it only restricts, it does not grant permissions. In Qwen Code, for example, `allow` means "run without the approval prompt" [V].

---

## 5. Invariant model

### 5.1 What a rule is: four things

A rule is an invariant, not a style. It has exactly four things, and each one lives in a JSON field:

| What | Field | Example |
|---|---|---|
| **What it observes** | `check.observes` (`diff`, `file`, `import-graph`, `public-surface`, `session`) + `check.ir` (IR capabilities it needs) | the resulting file and its functions |
| **When it fails** | `check.impl` + parameters (alias defaults, preset resolution) | a function with more than 3 parameters |
| **What it returns for the retry** | `check.feedback` + `alias.why`, `alias.fixHint`, `alias.avoid` + data the engine computes | "group the parameters that travel together into a named type from the glossary" |
| **Which source it comes from** | `alias.source` (work, chapter, short paraphrase) | *Clean Code*, ch. 3 |

"Prefer clear names" does not enter. "No domain type imports an infrastructure framework" enters. "Do not raise the complexity mass of a function that is already over the threshold" enters. "Do not add a public abstraction with a single caller" enters.

An active invariant without a source does not compile: every rule the preset turns on arrives through a methodology alias with `source`, even if it is a local team methodology ("team ADR-012").

### 5.2 Verifiability levels and where each one runs

The catalog contains **only binary, deterministic rules**: same input, same verdict, and the verdict is "it holds" or "it does not hold" (U3, decided on 2026-10-01).

| Level | What it needs | Cost | Where it runs | Maximum severity |
|---|---|---|---|---|
| **A**, local deterministic | IR of the resulting file + preset | 1 to 30 ms | **Pre** + Stop + pre-commit + CI | `deny` |
| **A with `heuristic:true`** | Same as A; binary and deterministic, and **it passes the trap corpus like any other**, but with expected false positives from fuzzy thresholds and precision not yet measured. A lexical check without preset knowledge (glossary, markers) is not heuristic: it is gameable and goes to the backlog (§5.5) | 1 to 30 ms | Pre | `warn`. Rises to `deny` only with measured precision ≥ 0.9 or with explicit `allowHeuristicDeny` |
| **B-local**, structural, decidable from the touched file | Imports of the file resolved to layers by glob, following re-exports up to 3 hops | 5 to 50 ms | **Pre** | `deny` |
| **B-global**, project graph or state | Cached import and call graph, session history, git | 50 ms to several s | **Stop / SubagentStop**, pre-commit, CI | `deny` (via end-of-turn block) |
| **Diff / integrity** | `before_session` against `after` | 1 to 30 ms | Pre (per call) and Stop (per session) | `deny` / `ask` |
| ~~C, semantic~~ | — | — | **Does not exist in the catalog.** Judgment practices are *candidates* (§5.5) | — |

**Criterion for a rule to run in Pre:** its violation can **never** be a valid intermediate state of a good refactor.
- A forbidden import edge, an empty `catch`, or a new suppression: they go in Pre.
- A transient cycle, duplication while a module is extracted, or the "proportion of functions called once": they go in Stop.

**Counterweights (anti-Goodhart).** APOSD-CONJ-001 and the proportion of trivial functions called once need the call graph, so they are **B-global**.
- [v1] They run at Stop, pre-commit, and CI as a **session delta**, with `warn`, or with `ask` if they exceed a threshold. They are **never** `deny` per call: Extract Function produces, by definition, a function with a single caller.
- In Pre they appear only as "Avoid:" text in the message. In the MVP the counterweights exist **only** as that text.

**Precision: a single rule.** The measured-precision requirement of ≥ 0.9 for `deny` applies to `heuristic:true` rules. Non-heuristic A and B rules are `deny` by construction (binary, with fixtures and a trap corpus), and their precision is **monitored** afterward: if the measurement falls below 0.9, or beneficial correction does not reach the threshold (§16.1), the rule **leaves the catalog** (it returns to `forging` in the backlog) or is split into a smaller rule. It does not stay as `warn`: a rule that does not improve the structure does not stay.

**The preset can make a candidate verifiable.** If the user externalizes knowledge, practices that were judgment become A or B and can enter the catalog through the Forge:
- `glossary` turns "use the ubiquitous language" into DDD-UL-001 (forbidden synonyms), level A;
- `layers` turns "do not mix layers" into B-local;
- `markers` (suffix, folder, or decorator) turns several DDD rules into A.

`init` asks for these artifacts explicitly [v1].

### 5.3 Canonical checks and methodology aliases

About 35% of the rules from different books are the same check with another threshold. That is why there are two layers:

- **Canonical check** (`core/complexity/fn-max-lines`, `core/dependencies/layer-direction`, …).
  - It is the implementation, written once. If it operates on the neutral IR, it serves every language whose language pack provides those capabilities; if it is idiomatic, it lives in the language pack (§13.4).
  - It lives in **its own folder**, grouped by **area** (`dependencies`, `complexity`, `api-surface`, `errors`, `testing`, `naming`, …), with its `check.json` and its fixtures (§6).
  - **It owns the parameters, with canonical names** (`max`, `paths`, `packages`).
  - It declares its `cardinality`:
    - `singleton`: thresholds. There is **a single effective rule per (canonical, scope)**. If two active methodologies give it different **values or severities**, it is a **conflict** the preset has to resolve (§8.5).
    - `multi`: lists or patterns aimed at paths. There is one effective rule per instance, and instances with identical parameters are deduplicated. Combining is **union**: CA-DEP-002 and FCIS-IO-001 are two instances of `core/dependencies/banned-imports` and both apply. If two identical instances bring different severities, that is also a conflict to resolve.
  - **Single exception: integrity.** If an alias of `core/pregate-integrity` and a methodology alias use the same check (EVA-TEST-001 and TDD-DEL-001 on `assertions-no-decrease`), the integrity one absorbs the other: a single violation with the highest severity. It is not a silent default: integrity cannot be lowered (§8.5.7), so that is the only legal result.
- **Methodology invariant (alias)** (`CC-FN-001`, `CC2-RT-001`, `RF-SM-003`).
  - It lives **inside its methodology's manifest** (`methodologies/<id>.json`), which references the check by ID. The methodology is not a folder of rules: it is a manifest (U5).
  - **Correspondence with U5.** The U5 "rule" (`rule.json` in its folder, with its proof) is, in this spec, the **canonical check** (`check.json` + `fixtures/`). The alias is the methodology view of that check and lives in the manifest; if it needs its own fixtures with its defaults, they go in `methodologies/<id>/aliases/<ALIAS>/fixtures/{pass,fail}` (§6.2). The rule still travels with its proof even if the alias comes from a source other than the check.
  - It contributes defaults, source, `stance`, default severity, `why`, `fixHint`, `avoid`, and references to the check's fixtures as examples.
  - In the lock, the effective rule lists its `aliases[]`, and the message uses the ID of the winning alias (the one the preset chose in the resolution, or the only active one).

### 5.4 Anatomy in JSON

**Canonical check** (`checks/complexity/fn-max-params/check.json` in the `core` source):

```jsonc
{
  "$schema": "https://<domain-to-be-defined>/schema/check.v1.json",
  "id": "core/complexity/fn-max-params",     // <namespace>/<area>/<check>, stable forever (§6.5)
  "version": "1.2.0",                        // semver; see §6.6
  "area": "complexity",
  "observes": "file",                        // what it observes
  "ir": ["functions.params"],                // required IR capabilities
  "languages": "ir",                         // "ir" = every language pack that provides `ir`; or an explicit list
  "verifiability": "A",                      // A | B-local | B-global | diff
  "heuristic": false,
  "cardinality": "singleton",
  "dimension": "fn.params",                  // closed enum: dimensions.v1.json
  "measures": ["fn.input-arity"],            // structural properties the rule measures (§12.4, step 7)
  "minSeverity": null,                       // severity floor; only integrity checks use it
  "params": {
    "max":                      { "type": "integer", "minimum": 0 },
    "countInlineObjectMembers": { "type": "boolean", "default": true },  // closes the `opts: {a;b;c;d}` trap
    "exempt":                   { "type": "array", "items": { "type": "string" }, "default": ["constructor"] }
  },
  "impl": { "kind": "primitive", "primitive": "metric", "metric": "params", "op": "<=", "param": "max" },
  // other kinds: "pattern" (ast-grep or a tree-sitter query embedded in JSON, per language)
  //              "custom"  (checker.* in the folder; requires "customJustification")
  "phase": ["pre", "stop", "commit", "ci"],  // enum: pre | stop | commit | ci
  "fingerprint": "symbol",                   // symbol | file | edge | none
  "ratchetable": true,
  "feedback": {
    "message": "{symbol} takes {measured} parameters (limit {max}).",
    "computedHints": ["co-travelling-params"]   // [v1] data the engine computes for the retry
  },
  "fixtures": { "trapFamilies": ["inline-object", "options-bag"] }  // the author's; the judge adds
                                                                     // every applicable family from the corpus
}
```

**Methodology alias** (entry of the `methodologies/clean-code.json` manifest):

```jsonc
{
  "id": "CC-FN-002",                         // FQN: core/CC-FN-002; short form valid if unambiguous
  "check": "core/complexity/fn-max-params",
  "stance": "few",                           // stance within the dimension
  "defaults": { "max": 3 },
  "severity": "deny",                        // deny | ask | warn | off
  "source": {
    "work": "Clean Code (R. C. Martin, 2008)",
    "locator": "ch. 3, Functions",
    "paraphrase": "Each extra argument makes a function harder to understand, call, and test; there should be few of them."
  },                                         // ≤ 300 characters, no quotations in quotes
  "why": "Many parameters usually hide an unnamed concept or a function doing too much.",
  "fixHint": "Group parameters that always travel together into a named domain type, or split the function by responsibility. Take the type name from the glossary or the file's domain.",
  "avoid": "Untyped `options` bags; inline object types that just move the same parameters.",
  "examples": { "fail": "fail/four-primitive-params", "pass": "pass/grouped-domain-types" },  // fixtures of the check
  "counterweights": ["APOSD-CONJ-001"],
  "precision": { "measured": null, "sample": 0, "minForDeny": 0.9 }
}
```

Fixtures **replace** the prose `examples` and the `knownEvasions` of the earlier draft: the examples are executable cases and each known evasion is a `trap/` fixture.

**Catalog quality rules** (`pregate rules test` verifies them, in the catalog CI and in the Forge judge):
1. **No executable proof, no rule.** Each check has at least two `pass` fixtures, two `fail` fixtures, and one `trap` for each corpus family **applicable** according to `observes` and the language, whether or not the author declared that family in `trapFamilies`.
2. **Determinism.** The check produces the same result when run twice, with the file order permuted and from another `cwd`. A custom checker cannot read the clock, randomness, the network, environment variables, or the file system outside what the core hands it.
3. **Not gameable.** No transformation from the standard trap corpus turns a `fail` fixture into `pass` without improving the structural property that transformation preserves (§12.4). If any does, the rule is hardened or rejected.
4. An alias without `why`, `fixHint`, `avoid`, and examples **cannot have `deny`**.
5. `heuristic:true` starts at `warn` and rises to `deny` only with `precision.measured ≥ minForDeny` on a sample labeled by humans (§16).
6. The `fixHint` **never proposes concrete identifiers**. It asks that the name come from the glossary or the file's domain.
7. `source.paraphrase`: 300 characters maximum, zero quotations in quotes, and human review. There is no automatic comparison against the text of the books, because processing the full books would itself be a copyright problem.
8. **Satisfiability.** For each combination of rules of the same dimension with the default thresholds and those suggested in `pairs.json`, there is at least one `pass` fixture that satisfies all of them at once. The compiler emits a warning, and records it in the lock, when the user pins thresholds outside the tested combinations.
9. **No source loads rules without proof (U2).** `pregate preset compile` rejects every check from a source that is not `builtin` if its `provenance` does not carry a judge-report hash that matches the content hash + corpus version + engine version. In the MVP, without the full judge, the compiler runs `rules test` (fixtures + determinism) on the `path` source and fails if anything does not pass. A rule written "by hand" follows the same path.

### 5.5 Candidate backlog (former level C)

*(U3, decided.)* Practices that require human judgment today do not enter the invariant catalog. They live in a **candidate backlog**, also in JSON:

```jsonc
// backlog/naming/intention-revealing-names.json
{
  "$schema": "https://<domain-to-be-defined>/schema/candidate.v1.json",
  "id": "core/candidate/naming/intention-revealing-names",
  "practice": "Names reveal the responsibility and the intended use of the symbol.",
  "sources": [ { "work": "Clean Code (R. C. Martin, 2008)", "locator": "ch. 2" },
               { "work": "A Philosophy of Software Design, 2nd ed. (J. Ousterhout, 2021)", "locator": "ch. 14" } ],
  "whyNotBinary": "Without project vocabulary, any lexical check is satisfiable by renaming without improving structure.",
  "unlockedBy": ["glossary"],                // preset knowledge that would allow a binary version
  "partialInvariants": ["DDD-UL-001"],       // already admitted invariants that cover a part
  "status": "candidate"                      // candidate | forging | admitted | rejected
}
```

- The backlog is the Forge's work list: when the preset contributes `glossary`, `layers`, or `markers`, `pregate forge suggest` [v1] lists the candidates that could be attempted as binary.
- A candidate moves to the catalog only as a new check admitted by the judge. It is never activated "in warning mode" while it is still judgment.
- Examples of candidates: "the function does one thing", "the boundary has a real purpose", "the comment does not describe the implementation", "the pattern solves a real variation". Examples of candidates the preset unlocks: ubiquitous language (with `glossary`), "only adapters talk to the database" (with `layers`), "value objects are immutable" (with `markers`).
- Rules that **look** binary but that the trap corpus shows are gameable also go to the backlog: for example, a list of "noise words" in names is satisfied by renaming `data` to `payload` without improving anything.
- And those that read as judgment today even if they have a rule name: Feature Envy, "a `*Factory` matches the pattern's shape", "anemic model". They live as candidates with their `unlockedBy` (for example `markers`) until the Forge demonstrates a binary version.
- An admitted rule whose measured precision or beneficial correction does not reach the threshold (§16.1) comes back here with `status: "forging"`.

### 5.6 Fingerprints [v1]

```
fingerprint = ruleId | relativePath | symbolPath | discriminator
  symbolPath:    "InvoiceService.calculateTotals"
  discriminator: if the symbol is anonymous, parent + ordinal + hash of the normalized body
  value:         the measured metric (e.g. 64 lines), if the rule is a metric
before↔after matching: 1) symbolPath  2) hash of the normalized AST (without identifiers
  or trivia) or similarity ≥ 0.8, within the file and against files deleted in the session
```

- A fingerprint does not depend on the line number.
- **A rename does not create a new violation**: the symbol is matched by body.
- **Retry counters do not use fingerprints** (§11.3), because renaming must not reset them.

---

## 6. On-disk rule layout and sources

### 6.1 Principles (U1, U5)

1. **Rules are JSON, not prose.** Nobody writes rules in markdown. Each file has `$schema` for autocomplete and validation in the editor.
2. **The unit is one folder per canonical check**, with its proof inside. The rule travels with its fixtures.
3. **Grouping by area, not by methodology.** A check can belong to several methodologies; methodologies are manifests that reference it.
4. **Layered sources, declared in the preset**, with pinned versions.
5. **Namespaced IDs and no silent shadowing.**
6. **Editing a rule is publishing a new version** that still passes all of its previous fixtures.
7. **Every declared rule folder is protected** against agent writes.

### 6.2 Structure of a source

Every source (the built-in catalog, a shared pack, or the repo's local rules) has the same shape:

```
<source>/
├─ source.json                         namespace, version, minimum engine version
├─ checks/
│  ├─ dependencies/
│  │  ├─ layer-direction/
│  │  │  ├─ check.json
│  │  │  └─ fixtures/
│  │  │     ├─ pass/<case>/fixture.json + files/…
│  │  │     ├─ fail/<case>/fixture.json + files/…
│  │  │     └─ trap/<case>/fixture.json + files/…
│  │  └─ banned-imports/…
│  ├─ complexity/fn-max-lines/…
│  ├─ api-surface/…   errors/…   testing/…   naming/…
│  ├─ immutability/…  types/…    config/…    resilience/…
│  ├─ integrity/…                       (core only: always-active pack)
│  └─ idiom-ts/…                        (idiomatic rules of a language pack)
├─ methodologies/
│  ├─ clean-code.json                   manifest: aliases → checks, stances, requires, incompatibleWith,
│  │                                    conflicts[] (known conflicts: SUGGESTIONS ONLY)
│  ├─ clean-code/aliases/<ALIAS>/fixtures/{pass,fail}/   (optional) alias fixtures with its defaults
│  └─ …
├─ presets/<name>.json                  published presets (inheritable with `extends: ["preset:<ns>/<name>"]`)
├─ backlog/<area>/<candidate>.json      (only core and packs that publish it)
├─ pairs.json                           (core only) known conflicts between core methodologies
│                                       and SUGGESTED resolutions
├─ dimensions.v1.json                   (core only) closed enum of dimensions and stances
└─ corpus/<family>/<transformation>.json   (core only) standard trap corpus
```

Initial areas: `dependencies`, `complexity`, `api-surface`, `errors`, `testing`, `naming`, `immutability`, `types`, `config`, `resilience`, `persistence`, `comments`, `duplication`, `structure` (classes and modules), `integrity`, and `idiom-<language>` for idiomatic rules. Adding an area is a minor schema change. `presets` and `candidate` are reserved words: they cannot be area names.

**Non-executable fixture files.** `fail` and `trap` fixtures deliberately contain code that violates rules (for example a `*.spec.ts` with `.only`, which would focus the whole suite). That is why they are stored with a non-executable suffix (`files/src/x.spec.ts.fixture`) and the loader maps them to the real name in memory. Also, `.pregate/**` is always outside the evaluation scope, independent of the preset, and `pregate install` adds `.pregate/` to the excludes of tsconfig, ESLint, and the test runner.

### 6.3 `check.json` and the checker

`check.json` is the one in §5.4. The `impl.kind` field defines how it is verified, in this order of preference:

1. **`primitive`**: a parameterized built-in primitive. Examples: `metric` (threshold on an IR metric), `banned-import` (list of modules or packages per layer), `layer-edge` (dependency direction between preset layers), `graph` (cycles, fan-out, callers), `diff` (no decrease between `before` and `after`), `surface` (exports and visibility).
2. **`pattern`**: an ast-grep rule or a tree-sitter query, **embedded in JSON** inside `check.json`, one per language (`impl.patterns.typescript`, `impl.patterns.python`, …).
3. **`custom`**: a `checker.*` module in the check's folder, only if neither a primitive nor a pattern is enough. It requires the `customJustification` field (a human reviews it on promotion) and runs in a **deterministic sandbox**: it receives the IR and the AST from the core, returns violations, and has no access to the file system, network, clock, randomness, or environment (sandbox technology to be decided in the v1 spike: WASM or an isolated JS interpreter). [v1]

### 6.4 Fixtures

Each fixture is a folder with a `fixture.json` and the files it needs (a mini-project when the rule looks at imports or layers):

```jsonc
// checks/dependencies/banned-imports/fixtures/trap/require-variable/fixture.json
{
  "$schema": "https://<domain-to-be-defined>/schema/fixture.v1.json",
  "language": "typescript",
  "params": { "paths": ["src/domain/**"], "packages": ["@prisma/client"] },
  "context": {                                  // preset fragment the fixture needs
    "layers": { "entities": { "paths": ["src/domain/**"], "mayImport": [], "kind": "core" } }
  },
  "target": "src/domain/invoice.ts",            // evaluated file, inside files/
  "before": null,                               // or "before/" for diff and ratchet checks
  "expect": { "verdict": "fail", "violations": [ { "line": 2 } ] },
  "trap": {
    "family": "dynamic-import",                 // corpus family
    "origin": "real",                           // real | corpus | forge
    "discovered": "2026-10-01",
    "note": "Agent replaced a static import with require(name) after a deny."
  }
}
```

- `pass`: satisfies the rule with the declared `params`.
- `fail`: violates the rule; `expect.violations` pins lines and, optionally, measured values.
- `trap`: **satisfies the letter and breaks the spirit**. The rule has to fail anyway. A real trap discovered in use (for example in shadow mode, at Stop, or in CI) **is added as a `trap/` fixture with `origin: "real"`, and the rule has to be hardened to reject it** in its next version.
- Fixtures declare their own `params`, so the same check is tested with the defaults of each alias that uses it. CI requires, per alias, at least one `pass` fixture and one `fail` fixture with those defaults. If the alias lives in a source other than the check (for example an `amarilla/` alias over a `core/` check), those fixtures go next to the manifest (`methodologies/<id>/aliases/<ALIAS>/fixtures/`), because the check's folder belongs to another source and is protected.

### 6.5 Layered sources, namespaces, and overrides

The preset declares where the rules come from and pins exact versions:

```jsonc
"engine": "1.0.0",                                                                    // exact engine version
"sources": [
  { "ns": "core",  "kind": "builtin", "version": "1.0.0" },                         // embedded in the binary
  { "ns": "acme",  "kind": "git",  "url": "https://git.acme.dev/pregate-rules.git", "ref": "v2.1.0" },  // [v1]
  { "ns": "fintech", "kind": "npm", "package": "@acme/pregate-fintech", "version": "0.4.2" },       // [v1]
  { "ns": "amarilla", "kind": "path", "path": ".pregate/packs/amarilla" },           // [MVP] pilot pack (U8)
  { "ns": "local", "kind": "path", "path": ".pregate/rules" }                          // [MVP]
]
```

- **Layer order:** built-in → shared packs (path, git, npm) → local repo rules. The order is for listing and explaining, **not for resolving clashes**.
- **`core` and engine version.** The binary embeds a `core` version. If `engine` or the `core` version pinned in the preset do not match those of the installed binary, the hook applies `failMode` and `check` (pre-commit/CI) exits with exit ≠ 0 with "engine/core version mismatch". The embedded version is never used silently (U10: same binary, same lock).
- **Namespaces and IDs.** Each source owns a namespace (`core/`, `<pack>/`, `local/`), and the `ns` declared in the preset has to equal the one in its `source.json`, or compilation fails. ID grammar:
  - check: `<ns>/<area>/<check>` (three segments, area in lowercase; `presets` and `candidate` reserved);
  - methodology manifest: `<ns>/<methodology>` (two segments, lowercase);
  - alias: `<ns>/<ALIAS>` (two segments, uppercase and hyphens, e.g. `core/CC-FN-002`);
  - candidate: `<ns>/candidate/<area>/<name>`;
  - published preset: `preset:<ns>/<name>` (only in `extends`).

  An alias can be written in short form (`CC-FN-002`) while it is unambiguous; if it is ambiguous, the compiler fails and asks for the FQN.
- **No silent shadowing.** A source cannot declare IDs in another source's namespace. Two sources with the same namespace are a compilation error. To change a rule from another source there are two paths, both explicit:
  - `overrides` in the preset (parameters, severity, scope), which stay in the lock with their origin (§8);
  - a new check with its own ID and `derivedFrom: "core/complexity/fn-max-lines@1.2.0"`, which goes through the judge like any other.
- **Version pinning.** The preset pins exact versions, with no ranges, and the lock records the hash of each source. Another agent or another session sees exactly the same rules. `pregate sources update` [v1] shows which verdicts would change on the repo before updating.
- **Mandatory proof.** Every source that is not `builtin` goes through §5.4 rule 9 at compile time: without a judge report (v1) or without `rules test` green (MVP), its checks do not load. A verified hash guarantees integrity, not proof.
- **MVP:** `builtin` and `path` sources (local rules and the `amarilla/` pack, only with `primitive` and `pattern`). `git`, `npm`, and `custom` checkers arrive in v1.

### 6.6 Versioning and regression

- Each `check.json` and each manifest has `version` in semver.
- **Improving or editing a rule is a new version.** All existing fixtures have to keep passing (regression). Fixtures are *append-only*: removing one requires a major version and explicit human approval in the check's changelog.
- **Hardening** (a new trap starts being rejected) is a minor version. **Changing an alias default** is a minor version of the manifest and shows up in `pregate sources update`. **Changing the meaning of a parameter** is a major version.
- Weakening a rule without removing fixtures is impossible by construction: some `fail` or `trap` fixture would become `pass` and regression fails.

### 6.7 Protection

- The hook protects `**/.pregate/**` **at any depth** (a nested `.pregate/` written by the agent would hijack the root of everything that hangs from it), **every rule folder declared** in `sources` with `kind: "path"` even if it is outside `.pregate/`, and the PREGATE data directory (state and snapshots, §11.3).
- On case-insensitive volumes (APFS by default), protected paths are compared without distinguishing case: `.Pregate/preset.json` or `.Claude/settings.json` do not dodge the protection.
- `preset.json` is **always `deny`** for the agent, with no `ask` (§8.6).
- `git` and `npm` sources are materialized in the PREGATE data directory, outside the repo, verified by hash (integrity) and by judge report (proof).
- The only write exceptions for the agent:
  - `.pregate/requests/**`: requests in schema-validated JSON; they are never loaded as configuration (§10.3);
  - `.pregate/forge/drafts/**`: **only through the Forge MCP tools**, never with the harness edit tools (§12.3). Drafts are never a rule source.

---

## 7. Catalog of checks and methodologies

### 7.1 Methodology manifests

Sources are paraphrased. The totals are estimated catalog entries **A / B**, plus the candidates that stay in the backlog. They are estimates from before the Forge: some rules will not pass the trap corpus and will drop to the backlog.

| Methodology (manifest) | Source | Estimated invariants (A/B) + candidates | v1 status | Examples |
|---|---|---|---|---|
| `core/pregate-integrity` | Own (anti-evasion) | ~10 (A/diff) | **Always active** | EVA-GEN-001 new generated marker · EVA-GEN-002 the agent edits a generated or excluded file that already existed · EVA-SUP-001 new inline suppression · EVA-DYN-001 dynamic import in a layer · EVA-CAST-001 double assertion `as unknown as` · EVA-SCOPE-001 new file in `exclude`, or a file (new or existing) of a language without a language pack inside a declared layer · EVA-SCOPE-002 file that falls in two incompatible scopes · EVA-TEST-001 fewer assertions or weaker matchers in the session · EVA-FORGE-001 code that imports from Forge drafts |
| `core/clean-code` | Martin, *Clean Code* (2008) | ~35 (30/5) + 10 | **Complete** | CC-FN-001 function ≤ N lines · CC-FN-002 ≤ N parameters · CC-FN-003 no boolean flags in the public API · CC-ER-002 no empty `catch` and none that only logs · CC-OB-001 Demeter with `fluentAllow` · CC-G-001 no magic numbers |
| `core/clean-architecture` | Martin, *Clean Architecture* (2017) | ~17 (6/11) + 3 | **Complete** | CA-DEP-001 an inner ring does not import an outer one · CA-DEP-002 no framework or ORM in entities or use cases · CA-ENT-001 entities without persistence annotations · CA-UC-001 use case with a single public method |
| `core/ddd-tactical` | Evans (2003); Vernon, *Implementing DDD* (2013) | ~15 (8/7) + 5 | **Complete** | DDD-VO-001 immutable value objects · DDD-ENT-001 no public setters · DDD-AGG-001 reference between aggregates by ID only · DDD-UL-001 forbidden synonyms according to the glossary |
| `core/tdd` | Beck, *TDD by Example* (2002); *Test Desiderata* (2019) | ~15 (10/5) + 3 | **Complete** | TDD-DEL-001 assertions that do not decrease (`ask`) · TDD-FOCUS-001 no `.only` or `.skip` · TDD-ASSERT-001 every test has an assertion · TDD-DET-001 deterministic tests |
| `core/philosophy-of-software-design` | Ousterhout, *APoSD*, 2nd ed. (2021) | ~14 (8/6) + 11 | Preview (`warn`) | APOSD-PT-001 no pass-through · APOSD-DEEP-001 depth/surface ≥ R · APOSD-CONJ-001 anti-fragmentation counterweight · APOSD-CMT-001 interface comment on exports |
| `core/functional-core-imperative-shell` | Bernhardt, *Boundaries* (2012); Normand, *Grokking Simplicity* (2021) | ~13 (11/2) + 1 | Preview; **FCIS-IO-001/002 complete (`deny`)** | FCIS-IO-001 the core does not import modules with effects · FCIS-IO-002 no clock, random, or env in the core · FCIS-ASYNC-001 the core is not async · FCIS-PURE-001 do not mutate arguments |
| `core/ddd-strategic` | Evans, ch. 14 | ~7 (4/3) + 3 | Preview | DDD-BC-001 no access to another context's internals · DDD-ACL-001 no external SDK types in the domain |
| `core/solid` | Martin, *Agile Software Development: PPP* (2002), ch. 8–12; Liskov and Wing (1994) | ~12 (7/5) + 3 | Preview | SOLID-OCP-001 `switch` on a type tag outside factories · SOLID-LSP-001 "not implemented" override · SOLID-ISP-001 interface ≤ N methods |
| `core/refactoring-smells` | Fowler, *Refactoring*, 2nd ed. (2018), ch. 3 | ~27 (18/9) + 8 | Preview | RF-SM-002 clones (rule of three) · RF-SM-017 Middle Man · RF-SM-014 exported interface or abstract class with no implementations or uses in the project (exempts ports). Feature Envy stays a candidate |
| `core/effective-typescript` | Vanderkam, 2nd ed. (2024), by chapter | ~29 (26/3) + 6 | Preview | ETS-ANY-001 no unjustified `any` · ETS-TS-001 no `@ts-ignore` · ETS-EXH-001 exhaustive `switch` · ETS-CFG-001 do not turn off `strict` |
| `core/hexagonal` | Cockburn (2005); Cockburn and Garrido de Paz (2024) | ~11 (3/8) + 1 | Preview | HEX-CORE-001 the core does not import adapters · HEX-PORT-003 ports without a technology name · HEX-ADP-002 no calls between adapters |
| `core/pragmatic-programmer` | Thomas and Hunt, 20th anniversary (2019) | ~20 (13/7) + 10 | v1.1 | PP-DRY-001 an identical regex literal or constant appears ≥ 2 times in the module · PP-RES-001 whoever opens a resource closes it · PP-SEC-001 no secrets |
| `core/poeaa-*` (domain-model, transaction-script, active-record; mutually exclusive per scope) | Fowler, *PoEAA* (2002) | ~23 (15/8) + 7 | v2 | PEAA-SL-001 controllers without ORM · PEAA-LL-001 no repository or ORM call inside a loop · PEAA-QRY-001 no concatenated SQL · PEAA-MNY-001 no `float` for money |
| `core/gof` | Gamma et al., *Design Patterns* (1994) | ~30 (20/10) + 5 | v2 | GOF-P-002 inheritance depth ≤ 2 · GOF-OBS-001 every `subscribe` has its unsubscribe. "A `*Factory` matches the pattern's shape" stays a candidate |
| `core/code-complete` | McConnell, 2nd ed. (2004) | ~50 (45/5) + 10 | v2 | CC2-CPX-001 cyclomatic ≤ 10 · CC2-VAR-001 declaration near use · CC2-DATA-001 no exact equality between floats |
| `core/legacy-code` | Feathers, *WELC* (2004) | ~14 (8/6) + 1; more **mode** than rules | v1 (as ratchet options) | WELC-SPROUT-001 a large legacy method grows ≤ N lines · WELC-SEAM-001 constructors without I/O |
| `core/twelve-factor` | Wiggins, 12factor.net (2011) | ~17 (12/5) + 1 | v2 | TF-III-001 no literal hosts or credentials · TF-III-003 env only in config · TF-XI-001 logs to stdout |
| `core/release-it` | Nygard, 2nd ed. (2018) | ~18 (13/5) + 4 | v2 | RI-TO-001 timeout on outbound calls · RI-RETRY-001 bounded retries · RI-UNB-001 queries with LIMIT |
| `core/effective-java` | Bloch, 3rd ed. (2018) | ~42 (38/4) + 3 | v2 (delegating to Error Prone or PMD) | EJ-009 try-with-resources · EJ-011 equals implies hashCode |
| **Total** | | **≈ 409 entries (≈ 295 A, ≈ 114 B) not counting `pregate-integrity`, over ≈ 265 canonical checks, + ≈ 95 candidates in the backlog** | | |

**v2 candidates:** Object Calisthenics (Bay, 2008); the 4 rules of simple design and *Tidy First?* (Beck); "Parse, don't validate" (King, 2019); *Domain Modeling Made Functional* (Wlaschin, 2018); OWASP ASVS as a cross-cutting pack; Python, Go, and Rust idioms in their language packs.

**Shape of a manifest** (summary; aliases have the shape in §5.4):

```jsonc
{
  "$schema": "https://<domain-to-be-defined>/schema/methodology.v1.json",
  "id": "core/clean-code",
  "version": "1.0.0",
  "status": "complete",                       // complete | preview
  "source": { "work": "Clean Code (R. C. Martin, 2008)" },
  "stances": { "comments.policy": "minimal" }, // methodology-level stances
  "requires": [],                              // preset knowledge: layers | glossary | markers
  "incompatibleWith": [],                      // hard incompatibilities (per file)
  "conflicts": [                               // known conflicts: SUGGESTIONS ONLY, never resolutions
    { "with": "core/philosophy-of-software-design", "dimension": "comments.policy",
      "suggest": { "use": "core/philosophy-of-software-design" }, "why": "short string" }
  ],
  "invariants": [ /* aliases → checks */ ],
  "candidates": ["core/candidate/naming/intention-revealing-names"]
}
```

### 7.2 Checks by area (sample)

| Area | Example canonical checks | Aliases that use them |
|---|---|---|
| `dependencies` | `layer-direction`, `banned-imports`, `no-cycles` (B-global), `no-dynamic-import-in-layer` | CA-DEP-001, CA-DEP-002, HEX-CORE-001, FCIS-IO-001, DDD-ACL-001, EVA-DYN-001 |
| `complexity` | `fn-max-lines`, `fn-max-params`, `fn-max-nesting`, `fn-max-cyclomatic`, `fn-no-growth` (diff) | CC-FN-001/002/004, RF-SM-003/004, CC2-RT-001/002, CC2-CPX-001, WELC-MONSTER-001 |
| `api-surface` | `single-public-method`, `no-boolean-flag-param`, `interface-max-methods`, `exported-doc-comment`, `module-depth-ratio` | CA-UC-001, CC-FN-003, SOLID-ISP-001, APOSD-CMT-001, APOSD-DEEP-001 |
| `errors` | `no-empty-catch`, `no-log-and-continue`, `no-null-return-public`, `error-style` | CC-ER-001/002, PP-CRASH-001, RI-CATCH-001, FCIS-EXC-001 |
| `testing` | `no-focused-tests`, `assertions-no-decrease` (diff), `test-has-assertion`, `deterministic-tests` | TDD-FOCUS-001, TDD-DEL-001, TDD-ASSERT-001, TDD-DET-001, EVA-TEST-001 |
| `naming` | `glossary-synonyms`, `port-name-no-technology` | DDD-UL-001, HEX-PORT-003 |
| `immutability` | `readonly-fields-by-marker`, `no-public-setters-by-marker`, `no-arg-mutation` | DDD-VO-001, DDD-ENT-001, FCIS-PURE-001 |
| `integrity` | `new-generated-marker`, `edit-generated-or-excluded`, `new-inline-suppression`, `double-type-assertion`, `new-file-in-excluded-scope`, `incompatible-scope`, `no-import-from-forge-drafts` | EVA-* |

### 7.3 Honesty about volume

- **What blocks** with good precision in v1: between 60 and 120 deterministic rules in TS, coming from the 4 complete manifests plus integrity.
- The ~95 candidates **do not block, do not warn, and are never exported**: they are the Forge's work list. PREGATE does not generate CLAUDE.md, AGENTS.md, or any prose guide (U1, U10): prior context reaches the agent through SessionStart and through the MCP tool `get_preset_summary`, always derived from the lock.
- **Catalog writing cost.** A `deny` check takes alias wording, `pass`/`fail`/`trap` fixtures, a pass through the trap corpus, and precision labeling. Estimate: between **4 and 8 h per rule**, that is about 400 to 900 h for v1. The Forge reduces the cost of local rules, not of the curated catalog. Who writes the catalog is an open question (§19).

---

## 8. JSON presets

### 8.1 Artifacts

| File | Who writes it | Purpose |
|---|---|---|
| `.pregate/preset.json` (or `.jsonc`) | **only the human**: by hand, or with `pregate preset apply <request>` / `pregate forge promote --activate` from the CLI. For the agent it is always `deny` | Engine and sources with versions, chosen methodologies, conflict resolutions, overrides, layers, scopes, and coexistence. It is versioned and travels with the project |
| `.pregate/requests/preset-<ts>.json` | the agent (or the `/pregate:init` skill) | Proposed preset change as a schema-validated JSON patch. It changes nothing until the human applies it |
| `.pregate/pregate.lock.json` [MVP] | `pregate preset compile` (the human runs it; `preset apply` also compiles) | Effective rule per (check, scope, instance): parameters, severity, phase, `aliases[]`, provenance (source@version and hash, work, chapter) and **how each conflict was resolved** (which preset entry decided it). Includes `presetHash`, `sourcesHash`, and `engineVersion`, and `confirmedBy` for each inherited resolution. **The hook, pre-commit, and CI read the same lock** |
| `.pregate/rules/**` | the human (by hand or by promoting a Forge draft); in both cases it has to pass `rules test` at compile time (§5.4, rule 9) | `local` source: the repo's own checks, fixtures, and manifests (§6) |
| `pairs.json` (`core` source) | the catalog | Known conflicts between methodologies and **suggested resolutions**. It only suggests; it never resolves |
| `dimensions.v1.json` (`core` source) | the catalog | Closed enum of dimensions and valid stances |

In the MVP the `core` sources come embedded in the binary and **the lock is written to disk from the MVP**, because U10 requires the same lock in the hook, in pre-commit, and in CI.

### 8.2 Methodology selection (user experience) [v1, partial in the MVP]

1. **Card per methodology** (`pregate packs`, `pregate packs show ddd-tactical`):
   - what it prevents, with 3 `fail` fixtures as examples;
   - how many invariants block and how many warn;
   - which methodologies it clashes with (dimensions in conflict) and which it is incompatible with;
   - what it requires from the preset (`layers`, `glossary`, `markers`);
   - status (complete or preview) and associated candidates in the backlog.
2. **Named curated presets**, as a starting point. In the MVP there are three example files: `backend-clean-ddd`, `functional-ts`, and `legacy-safe`; `minimal-strict` arrives in v1. They bring **proposed** resolutions, not confirmed ones: when adopting a curated preset or inheriting it through `extends`, `init` shows each inherited resolution and asks to confirm it, and the lock records `confirmedBy` per conflict. Until confirmed, it does not compile.
3. **Impact preview:** `pregate preview --preset X` answers "with this preset, today there would be N blocks in M files; the 3 rules that block the most are…".
4. **Human reading of the contract** [MVP]: `pregate preset show` answers "with this preset, the AI will not be able to: …", grouped by methodology and by path, and includes "these invariants do NOT apply to files of languages X because there is no language pack", "this methodology today does not block N of M invariants (preview)", and, with `enforcement: shadow`, "this preset blocks NOTHING".
5. **From the conversation:** the plugin includes `/pregate:init` (skill), which asks the questions inside the harness and leaves a **proposal** in `.pregate/requests/preset-<ts>.json`. The human applies it with `pregate preset apply <request>`. There is also `pregate init` with flags for non-interactive use, which the human runs.
6. **Conflicts during `init`:** for each conflict between the chosen methodologies, `init` shows the two stances, the `pairs.json` suggestion and its why, and **the human confirms or chooses another** before writing it in `resolve`. There is no default resolution applied in silence.
7. `init` reads `eslint.config.*` and `tsconfig` and warns if there are thresholds in conflict (for example, `max-params: 5` in ESLint versus 3 in the preset). It offers to adopt them as an override.

### 8.3 Preset schema (v1)

```jsonc
{
  "$schema": "https://<domain-to-be-defined>/schema/preset.v1.json",
  "name": "string",                                 // required
  "version": "semver",                              // version of the team's preset
  "engine": "x.y.z",                                // exact engine version; different ⇒ failMode / exit ≠ 0

  // Rule sources (§6.5): exact versions, no ranges
  "sources": [ { "ns": "core", "kind": "builtin", "version": "1.0.0" },
               { "ns": "local", "kind": "path", "path": ".pregate/rules" } ],

  // Preset inheritance (not methodology inheritance). The child overrides the parent key by key
  "extends": ["./presets/acme-base.json"],         // or "preset:<ns>/<name>"

  // User choice: methodologies. Combining is UNION; order does not matter
  "methodologies": ["core/clean-architecture", "core/ddd-tactical"],

  "languages": ["typescript", "javascript"],        // if missing, it is inferred
  "scope": { "include": ["glob"], "exclude": ["glob"] },
  "generatedMarkers": ["@generated", "DO NOT EDIT"],

  // Global mode
  "enforcement": "enforce | shadow | advise",       // default: enforce. shadow and advise are explicit
                                                    // calibration modes; they do not affect core/pregate-integrity

  // Project knowledge (makes invariants and candidates verifiable)
  "layers": {
    "<layer>": { "paths": ["glob"], "mayImport": ["<layer>" | "*"], "kind": "core|port|adapter|main" }
  },
  "importPolicy": { "typeOnlyCountsAsEdge": true, "followReExports": 3, "denyDynamicInCore": true },
  "contexts": { "<bounded-context>": { "paths": ["glob"], "publicApi": ["glob"] } },
  "markers": {
    "valueObject":   { "suffix": ["Id", "Money"], "paths": ["glob"] },
    "entity":        { "paths": ["glob"] },
    "aggregateRoot": { "decorator": ["@AggregateRoot"] },
    "port":          { "paths": ["glob"] }
  },
  "glossary": "docs/ubiquitous-language.json",

  // Composition: EVERY conflict is resolved here or the preset does not compile
  "resolve": {                                      // includes errors.style (there is no other field for that)
    "<dimension>": { "use": "<methodology | alias>", "params": {}, "severity": "...", "note": "short string" }
                 | { "policy": "strictest | lenient", "note": "short string" }   // thresholds only
  },
  "overrides": {                                    // only on invariants of active methodologies
    "<aliasId | checkId>": "off | warn | ask | deny"
                         | { "severity": "...", "params": {}, "note": "short string" }
  },
  "severityCeiling": { "heuristic": "warn" },       // an override that exceeds it is a compilation ERROR
  "allowHeuristicDeny": false,
  "scopes": [ { "paths": ["glob"], "methodologies": ["<id>"], "resolve": {}, "overrides": {} } ],

  // Legacy
  "ratchet": { "mode": "strict | no-new | no-worse | boy-scout", "newFiles": "strict",
               "tolerance": { "core/complexity/fn-max-lines": 0 }, "lockImprovements": false,
               "baseline": ".pregate/baseline.json" },

  // Loop with the AI
  "loop": { "maxDenialsPerFileRule": 3, "maxDenialsPerTurn": 15, "noProgressLimit": 2,
            "maxStopBlocks": 2, "escalate": "stop | ask", "allowAsk": true,
            "maxDetailedViolations": 5, "showAttemptMax": false,
            "agentMessageLanguage": "en", "userMessageLanguage": "es" },

  // Coexistence with ArkGate (U9, U10; §15.0): ONE tool enforces a given invariant
  "coexist": { "arkgate": { "config": "ark.config.json",
                            "ownedByArkgate": ["<aliasId | checkId>"],   // PREGATE does not evaluate them; they stay in the lock
                            "note": "short string" } },

  // Robustness, harnesses, and anti-bypass
  "failMode": "closed | ask",                       // default: closed (U10). ask is opt-in and applies only
                                                    // where ask is reliable; otherwise, closed
  "harnesses": { "unrecognizedPayload": "fail-mode", "minVersions": { "copilot-cli": "1.0.70" } },
  "bash": { "guard": true, "diffCheck": true, "onWrite": "flag | revert" },
  "protectedPaths": ["**/.claude/settings*.json", "~/.claude/settings*.json", "~/.claude/plugins/**",
                     "**/.pregate/**", ".git/hooks/**", ".github/workflows/**",
                     ".codex/config.toml", "~/.codex/config.toml"],
                     // + declared rule folders, the PREGATE data directory, and config
                     //   files of each installed harness (automatic); case-insensitive
                     //   comparison on volumes that do not distinguish case
  "suppressions": { "inlineAllowed": false, "exceptionsFile": ".pregate/exceptions.json",
                    "requireExpires": false }
}
```

**MVP subset:** `name`, `engine`, `sources` (`builtin` + `path`), `methodologies`, `scope`, `enforcement`, `layers`, `resolve` (threshold or severity conflicts of the same check), `overrides` (including path parameters such as `paths` and `packages`), `coexist.arkgate.ownedByArkgate`, `ratchet.mode` (`no-new` by count + new symbols), `loop` (counters and `escalate`), and `failMode`.
- No `extends`, `scopes`, `markers`, or `glossary`.
- The MVP invariants do not have opposing stances among themselves, but the MVP compiler already fails on any unresolved threshold or severity conflict (tested with a local fixture manifest; full UC7 in v1).

### 8.4 Examples

**Example 1. TS backend that combines Clean Code, Clean Architecture, tactical DDD, Effective TypeScript, and Philosophy of Software Design** [v1].

```jsonc
{
  "$schema": "https://<domain-to-be-defined>/schema/preset.v1.json",
  "name": "billing-backend",
  "version": "1.0.0",
  "engine": "1.0.0",
  "sources": [ { "ns": "core", "kind": "builtin", "version": "1.0.0" } ],
  "methodologies": [
    "core/clean-code",
    "core/effective-typescript",
    "core/clean-architecture",
    "core/ddd-tactical",
    "core/philosophy-of-software-design"
  ],
  "languages": ["typescript"],
  "enforcement": "enforce",
  "scope": { "include": ["src/**", "test/**"], "exclude": ["src/infra/migrations/**"] },
  "layers": {
    "entities": { "paths": ["src/domain/**"],               "mayImport": [],                                "kind": "core" },
    "usecases": { "paths": ["src/application/**"],          "mayImport": ["entities", "ports"],             "kind": "core" },
    "ports":    { "paths": ["src/application/ports/**"],    "mayImport": ["entities"],                      "kind": "port" },
    "adapters": { "paths": ["src/infra/**", "src/http/**"], "mayImport": ["entities", "usecases", "ports"], "kind": "adapter" },
    "main":     { "paths": ["src/main.ts"],                 "mayImport": ["*"],                             "kind": "main" }
  },
  "markers": {
    "valueObject":   { "paths": ["src/domain/**/values/**"] },
    "entity":        { "paths": ["src/domain/**/entities/**"] },
    "aggregateRoot": { "suffix": ["Aggregate"] }
  },
  "glossary": "docs/ubiquitous-language.json",     // enables DDD-UL-001
  "resolve": {
    // Each resolution is a suggestion from pairs.json or from conflicts[], confirmed by the human in init.
    // Conflict: APoSD forbids pass-through; CA asks to map at each boundary.
    "module.pass-through": { "use": "APOSD-PT-001", "params": { "exemptAcrossLayers": true },
                             "note": "Forbidden inside a layer; allowed when crossing a declared boundary." },
    // Conflict: CC asks for small functions; APoSD asks for deep modules.
    "fn.size":             { "use": "CC-FN-001", "params": { "max": 40 },
                             "note": "Moderate threshold; APoSD counterweights at Stop." },
    // Conflict: CC minimizes comments; APoSD requires an interface comment on exports.
    "comments.policy":     { "use": "core/philosophy-of-software-design",
                             "note": "Docs on exports; CC-CM-001 (no commented-out code) stays active." }
  },
  "overrides": {
    "APOSD-CMT-001": "deny",                         // APoSD is in preview (warn); the team raises it
    "ETS-ANY-001":   "deny"
  },
  "ratchet": { "mode": "no-worse", "newFiles": "strict" },
  "loop": { "escalate": "stop" },
  "failMode": "closed"
}
```

**Example 2. Legacy monolith that inherits a corporate preset, with every conflict resolved** [v2, because of inherited `code-complete`].

```jsonc
{
  "name": "legacy-monolith",
  "version": "0.3.0",
  "engine": "1.0.0",
  "sources": [ { "ns": "core", "kind": "builtin", "version": "1.0.0" },
               { "ns": "acme", "kind": "git", "url": "https://git.acme.dev/pregate-rules.git", "ref": "v2.1.0" } ],
  "extends": ["preset:acme/base"],                  // acme/base activates code-complete and philosophy-of-software-design;
                                                    // its resolutions were confirmed in init (confirmedBy in the lock)
  "methodologies": ["core/clean-code", "core/pragmatic-programmer", "core/tdd", "core/legacy-code"],
  "languages": ["typescript", "javascript"],
  "scope": { "include": ["app/**", "lib/**"], "exclude": ["vendor/**", "public/**"] },
  "resolve": {
    "fn.size":         { "use": "CC-FN-001", "params": { "max": 30 }, "note": "CC asks for ~20, CC2 tolerates 200; APoSD supplies counterweights." },
    "fn.params":       { "use": "CC-FN-002", "params": { "max": 4 },  "note": "CC 3, CC2 7." },
    "fn.nesting":      { "policy": "strictest", "note": "CC 2 versus CC2 3: we choose 2." },
    "literals.magic":  { "use": "CC-G-001" },
    "comments.policy": { "use": "core/philosophy-of-software-design", "note": "Docs on exports; CC-CM-001 (no commented-out code) stays active." }
  },
  "overrides": {
    "WELC-SPROUT-001": { "params": { "legacyMinLines": 80, "maxAdded": 5 } }
  },
  "scopes": [
    { "paths": ["test/**", "**/*.spec.ts"],
      "overrides": { "CC-G-001": "off", "core/complexity/fn-max-lines": { "params": { "max": 60 } } } }
  ],
  "ratchet": { "mode": "no-worse", "baseline": ".pregate/baseline.json" },
  "bash": { "guard": true, "diffCheck": true, "onWrite": "flag" }
}
```

**Example 3. Combination by scope: Hexagonal across the repo, DDD in the domain, and FCIS in the pricing engine** [v2, because of `release-it`].

```jsonc
{
  "name": "pricing-platform",
  "version": "2.1.0",
  "engine": "1.0.0",
  "sources": [ { "ns": "core", "kind": "builtin", "version": "1.0.0" } ],
  "methodologies": ["core/hexagonal", "core/clean-code", "core/philosophy-of-software-design", "core/release-it"],
  "resolve": {
    "fn.size":             { "use": "CC-FN-001", "params": { "max": 60 }, "note": "Moderate size; APoSD counterweights at Stop." },
    "comments.policy":     { "use": "core/philosophy-of-software-design" },
    "module.pass-through": { "use": "APOSD-PT-001", "params": { "exemptAcrossLayers": true } }
  },
  "layers": {
    "core":     { "paths": ["src/core/**"],     "mayImport": [],       "kind": "core" },
    "adapters": { "paths": ["src/adapters/**"], "mayImport": ["core"], "kind": "adapter" },
    "config":   { "paths": ["src/config/**"],   "mayImport": ["*"],    "kind": "main" }
  },
  "scopes": [
    { "paths": ["src/core/domain/**"],  "methodologies": ["core/ddd-tactical"] },
    { "paths": ["src/core/pricing/**"], "methodologies": ["core/functional-core-imperative-shell"],
      "resolve": { "errors.style": { "use": "FCIS-EXC-001", "note": "In the functional core, errors as values." } } }
    // ddd-tactical (rich model) and FCIS (data + functions) are incompatible in the SAME file.
    // The compiler checks it against the real file list: today they do not overlap, so it compiles.
  ]
}
```

**Example 4. amarilla-platform pilot, coexisting with ArkGate** [MVP; template, the layers come from `ark.config.json` in the pilot].

```jsonc
{
  "$schema": "https://<domain-to-be-defined>/schema/preset.v1.json",
  "name": "amarilla-platform",
  "version": "0.1.0",
  "engine": "1.0.0",
  "sources": [ { "ns": "core",     "kind": "builtin", "version": "1.0.0" },
               { "ns": "amarilla", "kind": "path",    "path": ".pregate/packs/amarilla" } ],  // U8; passes rules test at compile time
  "methodologies": ["core/clean-architecture", "core/clean-code", "core/tdd", "amarilla/north-star"],
  "languages": ["typescript", "javascript"],          // .py, .sql, and .cs: no pack ⇒ EVA-SCOPE-001 in declared layers
  "enforcement": "shadow",                            // explicit: 2 weeks of calibration; then, enforce
  "scope": { "include": ["src/**"], "exclude": ["src/**/generated/**"] },
  "layers": { /* taken from ark.config.json */ },
  "coexist": { "arkgate": { "config": "ark.config.json",
                            "ownedByArkgate": ["CA-DEP-001"],
                            "note": "ArkGate already enforces layer direction; it moves to PREGATE with the importer (v1)." } },
  "ratchet": { "mode": "no-new" },
  "failMode": "closed"
}
```

Examples 1 to 3 are part of the compiler test suite and are validated in CI against the real compiler of their delivery. Example 4 is a pilot template.

### 8.5 Composition rules

**0.2.1 implementation (O53):** `preset.enforcement` supplies the default;
`overrides[aliasOrCheck].enforcement` independently selects `enforce` or `shadow`.
Severity remains `deny`/`ask`/`warn`/`off`. Effective aliases of one check must agree
on enforcement or explicitly resolve it. Integrity always enforces and cannot be
shadowed. Reports preserve effective policy at call time. Cross-check stance
conflicts and parameterized patterns remain open (O55); `advise` remains outside
the implemented preset schema.

1. **Methodologies: union, not average.**
   - Every invariant of every chosen methodology stays active. The order of `methodologies` does not matter.
   - On `multi` checks (lists of forbidden imports, per-path patterns) instances are added and identical ones are deduplicated. There is no conflict.
   - On `singleton` checks and on dimensions with a stance, if two methodologies active in the same scope do not agree, there is a **conflict**.
2. **Every conflict requires an explicit resolution in the preset, or the preset does not compile.** These are conflicts:
   - **same check with a different threshold** (for example `fn.params`: 3 in CC, 4 in RF, 7 in CC2);
   - **same effective check with a different severity** (two aliases, or two identical `multi` instances, one at `deny` and another at `warn`), except the integrity absorption of §5.3;
   - **opposing stances in the same dimension** (for example `comments.policy: minimal` versus `interface-required`, or `fn.size: small` versus `deep-modules`).

   Valid ways to resolve:
   - `resolve[dimension].use` = a methodology or an alias (with optional `severity` if the conflict is about severity). It deactivates the other invariants of that dimension in that scope (to turn off invariants outside the dimension, use `overrides: "off"`);
   - `resolve[dimension].policy` = `strictest` or `lenient`, **for thresholds only**, written by the user. `strictest` is not recommended on philosophical dimensions, because it induces fragmentation;
   - an `overrides[checkId].params` that pins the conflicting threshold value. It counts as an explicit resolution and the lock records it that way. Opposing stances are resolved only with `use`.
3. **`pairs.json` and the manifests' `conflicts[]` only suggest.** `init` and the Forge propose the suggestion; the human confirms it or chooses another, and only then is it written in `resolve`. There is no precedence default: not "the last in the list wins", not "the strictest wins", not "the newest pack wins". A resolution that arrives already written in a curated or inherited preset also requires confirmation (`confirmedBy` in the lock).
4. **Preset inheritance (`extends`).**
   - Accepts local files (`./presets/x.json`) or presets published by a declared source (`acme/presets/base`).
   - Resolved in depth and in order: the child overrides the parent key by key, the same as in tsconfig.
   - The `methodologies` of the whole chain are added (union).
   - A conflict that appears through inheritance is resolved at any link of the chain; if nobody resolves it, it does not compile. If a link the team did not write resolves it, the resolution has to be confirmed (point 3).
   - An `extends` cycle is an error.
5. **Precedence order** for pinning the effective value per (file, check, instance), from highest to lowest:
   1. `overrides` of the last matching scope;
   2. higher-level `overrides`;
   3. `resolve[dimension]` of the last matching scope, then the higher-level one;
   4. the defaults of the **only** active alias in that dimension.

   If at step 4 there is more than one alias with different values, it is the compilation error of point 2. Each effective value stays in the lock with its origin.
6. **Overrides only on what is active.** `overrides` modifies invariants of active methodologies; it does not turn on loose rules. To add an individual invariant, the team creates a local manifest (`local/team-conventions`) that references it with its source. The preset still reads as methodologies and every active rule has a source.
7. **Severities.**
   - The possible values are:
     - `deny`: blocks and the agent receives the reason;
     - `ask`: escalates to the human, only in interactive sessions and in harnesses where `ask` is reliable;
     - `warn`: does not block and adds context, only for introduced violations;
     - `off`.
   - `severityCeiling.heuristic` is a **ceiling**. An `overrides` that exceeds it is not silently clipped: it is a **compilation error** ("override exceeds heuristic ceiling; set allowHeuristicDeny or remove it"). The ceiling is lifted only if `precision.measured ≥ minForDeny`, or with `allowHeuristicDeny:true`, and the decision is recorded in the lock.
   - `enforcement` is applied last: `shadow` records without deciding and `advise` turns everything into `warn`. **Neither of the two affects `core/pregate-integrity`.**
   - Invariants of `core/pregate-integrity` **cannot be set to `off`** or lowered below their `minSeverity` (`check.json` field).
8. **Hard incompatibilities** (`incompatibleWith`: `ddd-tactical` with FCIS, `poeaa-active-record` with `clean-architecture`). They are checked against **the real file list** at compile time (if an existing file falls in two incompatible scopes, it does not compile) and again at runtime: a new file that falls in two incompatible scopes produces `deny` with EVA-SCOPE-002.
9. **Counterweights [v1].** If a preset limits size, the manifests declare counterweights. From v1, a preset that limits size without **declared** counterweights does not compile, and the counterweights are evaluated at Stop (§5.2). In the MVP the counterweights appear only as `Avoid:` text.
10. **Scoping by path and glob.**
    - `scope.include` and `scope.exclude` define the universe.
    - `scopes[]` is applied in order and the last match wins; its `methodologies` are added to the global ones.
    - Globs are evaluated on the path relative to the root, after `realpath`.
    - A **new** file that falls in `exclude` produces `deny` (EVA-SCOPE-001; `ask` only with `failMode: ask` and an interactive session), never a silent permission.
    - Editing an **existing** file that falls in `exclude` or has a generated marker produces `deny` (EVA-GEN-002): generated files are regenerated, not edited.
11. **Languages.**
    - Each check declares which IR capabilities it needs or which languages it implements.
    - The compiler warns if an active invariant has no implementation for a project language, records it as `unimplemented`, and `preset show` says so out loud.
    - A **new or existing** file of a language without a language pack, inside a declared layer, produces `deny` (EVA-SCOPE-001). In the pilot (`.py`, `.sql`, `.cs`) that forces those paths to be declared outside the layers or to wait for their pack.
12. **Coexistence with ArkGate (U9, U10).** Each invariant that ArkGate already enforces is listed in `coexist.arkgate.ownedByArkgate`: PREGATE does not evaluate it on any face and the lock records it with that origin. [v1] The importer reads `ark.config.json` and `arkrules/*.json`, detects the equivalent PREGATE invariants and, if any overlap is not assigned to a single tool, the preset does not compile. There is never double enforcement or an owner chosen in silence.

**Compilation error example:**
```
$ pregate preset compile
✗ Unresolved conflict in dimension "comments.policy" (scope: global)
  core/clean-code@1.0.0                          stance=minimal            (does not require documentation)
  core/philosophy-of-software-design@1.0.0       APOSD-CMT-001 stance=interface-required
  Suggestion (pairs.json): APoSD rules exported symbols; CC-CM-001 (no commented-out code) stays active.
  To accept it, add to the preset:
    "resolve": { "comments.policy": { "use": "core/philosophy-of-software-design" } }
  Or choose clean-code:
    "resolve": { "comments.policy": { "use": "core/clean-code" } }
✗ 1 conflict unresolved. The preset does not compile.
```

**Known conflicts** with their **suggested** resolution in `pairs.json` (never applied without confirmation):

| Conflict | Suggested resolution |
|---|---|
| Function length | Moderate threshold (40) and active counterweights |
| Parameters | Explicitly choose an alias and its threshold (there is no universal suggestion) |
| DRY versus the rule of three | Textual duplication with `minOcc=3`; knowledge DRY (constants, regex) from the second occurrence |
| Interface with a single implementation versus YAGNI | Exempt if it is a port or a test seam |
| Comments | No commented-out code; docs only on exports if APoSD is active |
| Small classes versus "classitis" | Depth is measured in addition to size |
| Layers versus pass-through | Exempt when crossing a declared boundary |
| Error style | Pin `resolve["errors.style"]` |
| Rich model versus data and functions | Incompatible in the same file; separate by scope |
| Active Record | Incompatible with CA, HEX, and DDD |
| Immutability | Mandatory on VO, core, and DTO; entities mutate through methods with intent |
| Demeter versus fluent APIs | `fluentAllow` |
| `switch` versus polymorphism | An exhaustive `switch` over a discriminated union is valid |
| Singleton | Only without state and wired at the composition root |
| Inheritance | Depth ≤ 2, never from third-party concrete classes |
| External configuration versus fewer knobs | Only what changes between deploys goes in the environment |
| TDD versus legacy | New file: TDD-FIRST; existing: characterization + ratchet |
| Getters and setters | Getters yes; public setters no on entities or VOs |

### 8.6 What the agent can do with the preset

- **Edit `preset.json`:** always `deny`, in every harness and every mode, with the edit tools and with the shell. The reason tells the agent how to propose: "write a JSON-patch request in .pregate/requests/preset-<ts>.json and ask the user to run `pregate preset apply`".
- **Propose preset changes:** the agent writes `.pregate/requests/preset-<ts>.json` (schema-validated JSON patch, with justification). The human reviews it and applies it with `pregate preset apply <request>`, which validates, compiles, and writes the preset and the lock. The shell guard denies that subcommand to the agent. **There is no `ask` on `preset.json`:** it is not verified that `ask` forces the prompt to be shown in every mode, and a click during the task would be negotiating the rule live.
- **Change `enforcement`** (for example to `shadow`): only by request + `preset apply`. The agent cannot lower the gate in the middle of a task.
- **Lock, baseline, exceptions, `.pregate/rules/**`, packs, and any declared rule folder:** always `deny`.
- **Forge:** the agent can propose rules and ask for their activation (a request); it cannot activate them (§12).
- **MCP:** exposes no tool to edit, suppress, or deactivate rules or the preset.
- **No preset:** the hook stays inactive and says so once per session.

### 8.7 "Which invariants does each call validate?"

The answer is **deterministic and queryable**:
- the lock (on disk from the MVP) lists each effective rule per scope, with its parameter, severity, phase, provenance, and the preset entry that resolved each conflict;
- `pregate explain --path <file>` shows exactly which invariants apply to that file and which methodology, scope, or override each one comes from;
- `get_active_invariants(path)` [v1] gives the same to the agent over MCP, before writing;
- each deny includes the hash of the lock that produced it.

---

## 9. Legacy code: baseline and ratchet

If the gate requires the whole file to comply, the first edit in any real repo gets blocked. Precedents: Betterer, the PHPStan and Psalm baselines, ESLint's mass suppressions, and CodeScene's no-regression gate. The ratchet is consistent with the vision: **what comes in** has to comply; inherited debt does not propagate and does not grow.

**The ratchet's "before" is the start of the session, not the disk of the previous call.**
- `before_session`:
  - the content in `HEAD` if the file was clean at start;
  - the copy saved in the session-start snapshot if it was dirty or untracked;
  - empty (∅) if the file was created in the session.
- Without git, a snapshot is used on first contact, with a warning: the protection is weaker.
- The current disk is used only to reconstruct `after` and to detect retries.
- **Reason.** If the "before" were the disk of each call, any escape would be laundered as the new baseline: shell, an approved `ask`, the Stop cap, or a fallen hook. Tolerance would also accumulate (ten edits of +2 lines with tolerance 2 add up to +20 without a single deny).
- In **pre-commit**, the "before" is `HEAD`. In **CI**, the committed baseline (or the merge-base).
- In harnesses **without a usable session-start event**, the snapshot is taken on the first session event that reaches the adapter; if there is also no session identifier, the "before" is `HEAD`.

| Mode | What it denies | Use |
|---|---|---|
| `strict` | Any violation in `after` | New files (always) and greenfield |
| `no-new` | New violations. **MVP:** (1) every violation on a `symbolPath` that did not exist in `before_session` is new **with no compensation**; (2) for pre-existing symbols, a count per (rule, file) against `before_session` | Minimum viable. A rename or a move of a pre-existing symbol does not change the count |
| **`no-worse`** [v1, default] | New fingerprints **and** metrics that get worse (`after > before_session + tolerance`) | Recommended |
| `boy-scout` [v1] | In addition, touched symbols have to comply | Opt-in; enlarges the task's scope |

- **MVP limitation:** because the count applies only to pre-existing symbols, a **new** long function can no longer be offset by a legacy one that dropped below the limit. What remains: among pre-existing symbols, making one worse and another better on the same rule and file passes; and a rename of a symbol with a violation looks like a new symbol (conservative false positive, which the agent resolves by not renaming). Both are resolved in v1 with fingerprints and body matching.
- **`lockImprovements`** [v1, default `false`]: an improvement achieved in the session becomes the new floor. It comes off so as not to punish multi-step refactors.
- **Project baseline** (`.pregate/baseline.json`) [v1]:
  - a human generates it with `pregate baseline` and it is committed;
  - it is protected, CI uses it, and CODEOWNERS covers it;
  - the agent never regenerates it: the shell guard denies that subcommand.
- **Messages with ratchet:** "legacy code: at session start it measured 64 lines; keep it ≤ 64, do not grow it".
- **Pre-existing violations are never mentioned in a `warn`** (except with `boy-scout`). If they were mentioned, they would push the agent to "fix along the way" code it was not asked to touch.
- **No burn-down or debt reports** (U10): managing inherited debt is ArkGate's territory. PREGATE uses the baseline only to decide what is new.
- **WELC rules** as ratchet options [v1]: sprout, monster method that does not grow, and large class that does not gain public methods.

---

## 10. Anti-bypass and escape hatches

**Threat model.** The agent is not malicious, but **it looks for the path of least resistance** (*specification gaming*). The defenses are designed for that behavior, and the guarantee is the set fail-closed hook + pre-commit + CI with the same binary and the same lock (U10). Against a real adversary with local permissions, the net is CI with CODEOWNERS.

### 10.1 Known vectors

| Vector | Examples |
|---|---|
| Write through the shell | `>`, `>>`, `tee`, heredoc, `sed -i`, `perl -pi`, `python -c`, `node -e`, `cp`, `mv`, `git apply`, `patch`, `git checkout -- file`, `curl -o`, scripts. **[V]** In Claude Code, a PostToolUse `Edit\|Write` does not fire if the shell rewrites the file, and `bashEditDiff` is beta, "not to enforce a policy". **[V]** In Codex the model was observed dodging an `apply_patch` deny with `perl -pi` |
| Deferred write | `run_in_background` and `Monitor` write after the shell's Post, and can keep writing after Stop. Stop covers them (with re-evaluation if `background_tasks[]` is not empty), SessionEnd, and pre-commit |
| MCP and other tools | Servers that write files; extension tools with their own schema (in pi, any extension tool fires its event with its name) |
| Self-exemption | Adding `// @generated` or `DO NOT EDIT`; creating code in an `exclude` path or in a language without a language pack; editing a generated or excluded file that already existed; inline suppression; writing a nested `.pregate/` to hijack the root; varying case on protected paths (`.Pregate/`); writing in a worktree the snapshot does not cover |
| Rule evasion | Dynamic import or `require(var)`; barrel that re-exports infra; `as unknown as T`; `catch (e) { void e }`; `const ONE_HUNDRED = 100`; `opts: {a;b;c;d}`; nested closures; lambda tables; `toBe(5)` → `toBeDefined()`; deleting the test file. **Each one is a family of the trap corpus** |
| Turning the gate off (Claude Code) | Editing `.claude/settings*.json` (project **or** user); `"disableAllHooks": true` **[V]**; `enabledPlugins: {"pregate": false}`; `claude plugin disable`; `--settings`; `--no-verify`; `git config core.hooksPath` |
| Invoking another harness without hooks from the shell | `claude -p --settings …`, `codex exec -c features.hooks=false`, `GROK_CLAUDE_HOOKS_ENABLED=0 grok -p`, `KILO_PURE=1 kilo`, `aider --yes`: one agent launches another agent that writes without a gate |
| Turning the gate off (other harnesses) | `disableAllHooks` in Qwen and Copilot; `[compat.claude] hooks=false` or `GROK_CLAUDE_HOOKS_ENABLED` in Grok Build; `KILO_PURE=1` in Kilo; `--yolo` disables hooks in Cline; `hooksConfig.enabled:false` in Gemini; `chat.useHooks` in VS Code; editing `.codex/hooks.json`, `[features] hooks` in `.codex/config.toml`, `.grok/hooks/`, `.gemini/settings.json`, `.qwen/settings.json`, `.cursor/hooks.json`, `.github/hooks/`, `.factory/hooks.json`, `.kiro/hooks/`, `.opencode/plugins/`, `.amp/plugins/` |
| Manipulating state | `preset.json`, lock, baseline, `exceptions.json`, `state/` and snapshots (deleting them to force a "first contact" that launders the ratchet), rule folders |
| Using the Forge as a bypass | Writing production code in a draft; proposing a "weaker" rule; asking for activation as if it were approval; fixtures that run as real tests (a `.only` in a fixture focuses the whole suite) |
| Optimizing against the metric | Fragmenting into trivial helpers; pass-through; renaming to dodge lists |

### 10.2 Layered defenses

1. **Prevention in context [MVP].**
   - **[V]** In Claude Code, SessionStart accepts `hookSpecificOutput.additionalContext`. A compact preset summary and the pre-check command are injected (§11.6). The other adapters use their equivalent channel when it exists.
   - [v1] Reinjection after compaction (matcher `compact`; the exact value of `source` is to verify), together with the rules denied most often in the session.
2. **Integrity pack [partial MVP, complete v1].** EVA-* invariants evaluated by diff against `before_session`:
   - a generated marker or an inline suppression counts only if it already existed before;
   - dynamic import in a layer is denied;
   - the double type assertion is denied;
   - a generated or excluded file that already existed is not edited (EVA-GEN-002);
   - assertions and matcher strength cannot drop in the session (at Stop) [v1];
   - no file outside `.pregate/forge/drafts/` can import from there (EVA-FORGE-001);
   - each check has `trap/` fixtures for each applicable family of the corpus.
3. **Shell guard on the pre-tool [MVP].** Heuristic, with no claim of completeness. It matches each harness's shell tool (`Bash|PowerShell|Monitor`, `run_terminal_command`, `exec_command`, `run_shell_command`, `bash`, `Execute`, `launch-process`, …, see §14.2). It denies:
   - a write pattern plus an in-scope path (reason: "use the edit tools");
   - any command that touches `protectedPaths`, the rule folders, or the hook configuration files of any installed harness;
   - administrative commands: `pregate baseline|approve|disable|exceptions|preset apply|preset compile|init|forge promote|sources update|import`, `--no-verify`, `core.hooksPath`, `disableAllHooks`, `claude plugin (disable|uninstall)`, `--settings`, and the variables and flags that turn hooks off in other harnesses (previous row);
   - **other harness binaries** (`claude`, `codex`, `grok`, `gemini`, `qwen`, `copilot`, `cursor-agent`, `aider`, `opencode`, `kilo`, `amp`, `cline`, `junie`, `kiro-cli`, `droid`, `auggie`), unless an explicit preset allowlist;
   - inline environment assignments (`VAR=… cmd`) that match hook switches.

   The write heuristic covers POSIX (`>`, `>>`, `tee`, heredoc, `sed -i`, …) and PowerShell (`Set-Content`, `Out-File`, `Add-Content`, `New-Item -Value`, redirections). It allows the read-only pre-check (`pregate check --stdin ...`). **[V]** `PowerShell` exists in Claude Code on Windows without Git Bash and as an opt-in on macOS and Linux; that is why it is in the matcher from the MVP. (To verify: in Codex, an `apply_patch <<EOF` invocation through the shell could arrive as `Bash` and the guard would deny it as a heredoc; the Codex profile recognizes it and normalizes it as a patch.)
4. **Working-tree diff.**
   - **[MVP]** At Stop: `git diff` + `git status` against the session snapshot. Covers shell, MCP, generators, and `run_in_background`: the truth is the tree, not the command.
   - **[v1]** Point snapshot on the shell pre-tool **only if the command matches the write heuristic**, and diff on the shell post. Doing it on every command would cost 100 ms or more on large repos. `core.untrackedCache` and fsmonitor are used if available.
   - `bash.onWrite:"revert"` is opt-in, because it can overwrite concurrent human edits. **It requires git.**
5. **Gate at end of turn [MVP in Claude Code] / end of subagent [v1].**
   - **[V]** In Claude Code, `decision:"block"` + `reason` on Stop makes Claude keep working. Claude Code has a cap of 8 consecutive continuations (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`). PREGATE uses its own cap (`maxStopBlocks=2`) and respects `stop_hook_active`.
   - `decision:block` only for violations **introduced in the session**. Inherited or low-impact ones go through `additionalContext` (**[V]** non-error feedback).
   - SubagentStop evaluates only the files that `agent_id` touched (recorded in state).
   - Stop walks **every root touched in the session** (recorded by Pre and shell events), including `EnterWorktree` worktrees and subagents with `isolation: worktree`. The snapshot is per (session, root), created on first contact with each root.
   - The Stop `reason` includes: "Do not remove functionality or tests to comply; if the fix exceeds the task, stop and report it to the user". [v1] Stop also verifies that assertions (EVA-TEST-001) and used public exports did not drop.
   - Other harnesses with an equivalent event (Stop in Grok, Codex, Qwen, Junie CLI, Kiro, Factory; `agentStop` in Copilot) receive the same gate through their adapter.
6. **Protected paths.**
   - [MVP] `**/.pregate/**` at any depth (except the root's `.pregate/requests/**` and Forge drafts via MCP), declared rule folders, `**/.claude/settings*.json`, `~/.claude/settings*.json`, the PREGATE data directory, and `.pregate/git-hooks/**`. Case-insensitive comparison on volumes that do not distinguish case.
   - [v1] `~/.claude/plugins/**`, `.git/hooks/**`, the CI configuration, `.codex/config.toml`, `~/.codex/config.toml`, and the hook configuration files of each harness with an installed adapter (the adapter profile declares them).
   - `preset.json`: always `deny`; changes arrive as a request (§8.6).
7. **`ConfigChange` hook [v1, Claude Code].** `decision:"block"` on configuration changes that turn off hooks or the plugin. **[V]** ConfigChange uses the `decision:block` pattern; which concrete changes it covers is to verify.
8. **Immune installation for teams [v1/v2].**
   - **[V]** In Claude Code, `allowManagedHooksOnly` blocks user, project, local, and plugin hooks, except plugins forced in `enabledPlugins` of managed settings. Only a `disableAllHooks` from managed settings turns managed hooks off.
   - **[V]** A *mod* that hooks `tool.check` can approve what a PreToolUse blocked, **unless the hook is in managed settings**. For immunity against mods, the handler is declared **directly in `hooks` of managed settings**. The plugin is the channel for individual devs.
   - Equivalents in other harnesses: `/etc/grok/requirements.toml` with `allow_managed_hooks_only` (Grok Build), `requirements.toml` with `allow_managed_hooks_only` (Codex), policies in `/etc/github-copilot/policy.d` (Copilot CLI), enterprise hooks of Cursor and of Factory. The per-harness deployment guide arrives with each adapter.
9. **Close of the guarantee (U10).** `pregate check --staged --ratchet` in pre-commit **[MVP]** and `pregate check --ratchet` in CI **[MVP: minimal GitHub Actions template; v1: SARIF and other platforms]**, against `HEAD` or the baseline, plus CODEOWNERS on `.pregate/**`. It is the only net that covers every harness equally, including those that fail open and those that have no hooks (§14.5).
   - The pre-commit script lives committed in `.pregate/git-hooks/` (or in the lefthook/Husky config if the repo already uses them), because `.git/hooks/` is not versioned and the rest of the team would not have it. Each clone activates it with `core.hooksPath=.pregate/git-hooks` via `pregate install --git-hook` or a package-manager `prepare` script. Because that activation is local and can be skipped, CI still runs the same invariants.
   - `--staged` evaluates the content of the **index** (`git show :<path>`) against `HEAD`, not the working tree.
   - Both fail if the committed lock does not match the preset, or if the engine version is not the pinned one.

### 10.3 Escape hatches with human approval

- **New inline suppressions** (`// pregate-disable-next-line`): they are a violation in themselves (EVA-SUP-001), unless they match an approved exception.
- **Exceptions file** [v1] `.pregate/exceptions.json`, protected:
  ```json
  {
    "exceptions": [
      {
        "fingerprint": "CC-FN-002|src/billing/report.ts|buildReport|-",
        "contentHash": "sha256:9f2c…",
        "reason": "Signature imposed by an external API",
        "approvedBy": "<user>",
        "approvedAt": "2026-10-01",
        "expires": "2027-01-01"
      }
    ]
  }
  ```
  - The fingerprint has the four segments of §5.6 (`-` when there is no discriminator).
  - `contentHash` makes the exception expire if the symbol changes.
  - `expires` is mandatory only with `suppressions.requireExpires:true` (team profile). In the individual profile it is optional.
- **Creation channels:**
  - `pregate approve <fingerprint|--last>` (with flags, no mandatory TTY);
  - in an `ask` prompt, the option "allow and record an exception", if the harness allows it (to verify);
  - otherwise, the human runs `pregate approve --last` (to verify whether Claude Code's prompt `!` mode goes through PreToolUse).
- **Honesty: locally, exceptions are best-effort.**
  - A TTY can be faked (`script -q /dev/null …`) and a string denylist can be dodged (`ap""prove`).
  - **Exceptions take effect in CI only if the commit that adds them has CODEOWNERS approval.**
- **Legitimate channel for the agent:** it can write `.pregate/requests/<timestamp>.json` (schema-validated) with its justification, or use the equivalent MCP tool [v1].
  - Writing a request **unblocks nothing and does not count as a resolution**.
  - Stop lists them to the human through `systemMessage`, and they count in `evasion_rate`.
- **There is no escape hatch through MCP.** The MCP server has no tools to suppress, deactivate, or edit rules, or to approve exceptions.

---

## 11. The AI's experience

### 11.1 Denial message format

**Principles**
- **Self-contained first line, 256 characters at most.** Grok Build trims the reason to 256 characters **[V]**, and other harnesses show only the beginning in the UI. The first line carries the essentials: alias ID, file:line, measured/limit, and the minimum correction. The rest of the message is detail. Each harness's adapter decides how much of the detail it delivers according to its channel limit (§14.3).
- **All** violations of the call at once. The first `maxDetailedViolations` (5) go in detail and the rest in **one line each** (`ID file:line measured/limit`), up to a cap of 30 lines. If there are more: "+N more: run the pre-check to see them all".
- Order: severity, then line.
- Each detailed violation carries:
  - ID (winning alias → canonical check);
  - location;
  - measured against limit;
  - value at session start if there is a ratchet;
  - why (`why` of the alias);
  - how to fix (`fixHint` + **data computed by the engine**: candidate line ranges with few shared variables, layer paths taken from the preset);
  - what to avoid (`avoid` + the counterweights).
- **The message is the binary's real output.** It never proposes identifiers or makes semantic judgments ("mixes taxes and formatting" would be a judgment practice, not an invariant).
- **Sanitization:**
  - symbols and specifiers are truncated to 80 characters, go in backticks, and may contain only `[A-Za-z0-9@/._$-]`;
  - comments and literal strings from the code are **never** interpolated, so text written by the agent does not come back as "the hook's voice".
- **Size:** a target of about 1,500 characters and a hard cap of 4,000. **[V]** The 10,000-character limit is documented in Claude Code for `additionalContext` and `systemMessage`; there is no documented limit for `permissionDecisionReason` (to verify). In Grok Build the cap is 256 **[V]**.
- **Language:** messages to the agent come out in English by default (`agentMessageLanguage: "en"`, so the catalog is written once). Messages to the human (`stopReason`, `systemMessage`, `ask` reason) come out in `userMessageLanguage` ("es"). The effect of language is measured in §16.
- **Counter:** "attempt n", without showing the maximum (`showAttemptMax:false`), so as not to announce when escalation arrives.
- **The line about the shell** appears only after a shell-write attempt is detected in the session, so as not to suggest the idea (it is measured with an A/B).

**Exact format** (v1 example, engine output; in the MVP the message has the same shape but without the `computedHints` data, such as the candidate line ranges, which require data-flow analysis and arrive in v1):

```
PREGATE DENY CA-DEP-002 src/domain/invoice.ts:3 layer `entities` imports `@prisma/client` (banned). Fix: depend on a port in src/application/ports/**, implement it in src/infra/**. +1 more. Details: pregate explain CA-DEP-002

Preset billing-backend 1.0.0 (clean-code + effective-typescript + clean-architecture + ddd-tactical + philosophy-of-software-design) · lock 3f9a1c · attempt 2

1) CA-DEP-002 → core/dependencies/banned-imports · line 3
   Layer `entities` must not import framework/ORM packages; found `@prisma/client`.
   Why: domain rules must not depend on persistence details (Clean Architecture, ch. 22 & 32, paraphrased).
   Fix: declare the interface you need under layer `ports` (src/application/ports/**) using only domain
        types; implement it under layer `adapters` (src/infra/**). Name it with a glossary term.

2) CC-FN-001 → core/complexity/fn-max-lines · line 42 · `Invoice.calculateTotals`
   Measured 71 · limit 40 (resolve fn.size) · at session start 64 (legacy: keep it ≤ 64, do not grow it).
   Why: long functions mix levels of abstraction and are hard to change safely (Clean Code, ch. 3, paraphrased).
   Fix: extract a cohesive block. Candidate ranges with few shared variables: 55–68 (2 in, 1 out),
        70–80 (1 in, 1 out). Name the result after the domain concept it computes.
   Avoid: one-line helpers, pass-through functions, helpers called once with ≥4 params
          (checked at end of turn).

Rewrite until every listed violation is fixed. Do not resubmit the same edit and do not work around the rule.
If the task cannot be done within these invariants, or you believe this is a false positive, stop and tell the
user which rule blocks you (ID and line) and why. Do not trim the task.
If a rule conflicts with an explicit user instruction, ask the user.
Pre-check before writing: `pregate check --stdin --path <file> --format agent` (or the MCP tool `check`).
```

(The first line of the example is 223 characters.)

**JSON emitted by the Claude Code adapter** (with `exit 2`):
```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
  "permissionDecisionReason":"PREGATE DENY CA-DEP-002 src/domain/invoice.ts:3 …"}}
```

**Variants**
- **`warn`:** through the harness's additional-context channel, in one or two lines per **introduced** violation, with the suffix "informational; no action required for this task".
- **Post [v1]:** emitted only if Pre did not evaluate or there is a new deny that Pre did not report. It starts with "This write WAS ALREADY APPLIED. Fix forward with the edit tool; do not revert with git or the shell."
- **Stop:** the `reason` lists the violations introduced in the session and the clause about not shrinking the task.
- **Shape (`reconstruction: unknown | truncated`):** "PREGATE cannot evaluate this edit (<cause>). Resend it as an exact replacement or a full write."

### 11.2 Escalation: `stop` by default

- Escalating to `ask` rewards persistence: the agent learns that, after N attempts, a human clicks.
- Also, **[V]** in Claude Code the agent does not see the reason of an `ask`, so if the human rejects, it learns nothing.
- That is why the default is `loop.escalate: "stop"`: deny + halt of the turn (`continue:false` + `stopReason` in Claude Code) for the human, who intervenes with context. In harnesses where halt is not reliable (for example Codex, where `continue:false` makes the hook fail and **the tool continues** **[V]**), the adapter emits only `deny` with the halt text and blocks the end of the turn if the harness has that event.
- `"ask"` is an explicit option, valid only in interactive sessions and in harnesses where `ask` is reliable, and always accompanied by the context with the violation.

### 11.3 Retry limit and state

**State:** `<PREGATE data>/state/<harness>/<session_id>/` as **append-only events**, one file per call id written atomically with rename. Counters are derived on read. This avoids losing increments with parallel hooks (**[V]** in Claude Code, PostToolUse runs concurrently when there are parallel calls, and matching PreToolUse hooks run in parallel).
- **Data directory.** MVP (installation by settings, no plugin): `${CLAUDE_PLUGIN_DATA:-${XDG_STATE_HOME:-~/.local/state}/pregate}/<hash of the project root>/`. From v1, with the plugin, `${CLAUDE_PLUGIN_DATA}`. It is in the protected paths from the MVP.
- **Missing snapshot** for an already registered session (for example, because the directory was deleted): `failMode`, never a new "first contact" that launders the ratchet.
- **Call id.** `tool_use_id` or equivalent. Gemini, Kiro, Junie, and Devin do not send an id: the adapter uses a synthetic `callId` = hash(session, tool, normalized input, monotonic process sequence). With it, identical retries are not deduplicated; this is documented.
- **Turn limit.** `prompt_id` in Claude Code (v2.1.196+), `turn_id` in Codex; if the harness brings neither, the last recorded end-of-turn event.

**Counter keys:** `(harness, session_id, agent_id, file, ruleId)`. **No `symbolPath`**, because renaming or extracting must not reset them. A subagent does not consume or reset the main agent's budget.

| Situation | Action |
|---|---|
| 1st and 2nd deny on (file, rule) | `deny` with the full message and "attempt n" |
| **No progress**: the normalized AST (without trivia or comments) matches a denied attempt, **or** the violation count of (file, rule) does not drop [MVP] / the vector `{fingerprint → measured value}` does not improve [v1], in `noProgressLimit` (2) consecutive attempts | `deny` with "same edit as a denied one / no progress", and early escalation |
| `maxDenialsPerFileRule` (3) is reached | `escalate` (default `stop`) |
| `maxDenialsPerTurn` (15) is exceeded | **`deny` + halt of the turn + notice to the human**. Severity is never relaxed |
| End of turn blocked `maxStopBlocks` (2) times | Ending is allowed and the human is notified with what is pending and the open requests |
| TDD-DEL-001 (assertions drop) | `ask` from the first attempt in interactive sessions where `ask` is reliable; otherwise, deny + halt. Exempt if the production symbol it covered was also deleted |
| `permission_mode` ∈ {`bypassPermissions`, `dontAsk`}, there is `agent_id`, `allowAsk:false`, remote session, no interactivity signal, or harness without reliable `ask` in that mode | Never `ask`: deny + halt |
| `permission_mode: "auto"` (Claude Code) | **[V]** `ask` forces the prompt (allowed) |

### 11.4 Conflict with the user's instructions
If complying with the preset contradicts an explicit user instruction, the fixed closing of the message asks the agent to ask instead of emptying the implementation. It is measured as `user_conflict_escalations`.

### 11.5 Outside the envelope, requests, and false positives
- The agent has two legitimate exits: **rewrite until it complies**, or **declare that the task does not fit the envelope and stop**, citing the rule ID and the line. It is measured as `envelope_declarations`.
- A false positive is treated the same way: cite ID and line, stop writing that file, and report it. It is never dodged.
- The exit "I left a request" closes nothing: Stop reports it and it counts in `evasion_rate`.

### 11.6 Pre-check and introspection for the agent
- **[MVP]** `pregate check --stdin --path <path> --format agent` is read-only, allowed by the guard, and mentioned at session start.
- **[v1]** The MCP tools `get_active_invariants(path)`, `check(...)`, and `explain_rule(id)` give the same without going through the shell (§12.2). Querying is not negotiating: the result is the same the gate would give.
- It allows validating before writing large files.
- The risk that it works as an oracle is accepted: the deny itself already is one.
- Its effect on denials per task is measured (arm H, §16).

---

## 12. Rule Forge and MCP

### 12.1 Principle: the invariant is programmed first, then the rule exists (U2)

If the user is missing an invariant, they do not "add a rule". First, how that practice becomes an invariant is programmed (what it observes, when it fails, how it is verified), and only when that is demonstrated does the rule enter the local catalog and can be activated in the preset. **No executable proof, no rule.**

The split of roles is fixed:

| Role | Who | What they do |
|---|---|---|
| **Creative part** | The user's agent (Claude Code or another MCP client) | Translates the practice into a check (primitive, pattern, or checker) and writes `pass`, `fail`, and `trap` fixtures |
| **Deterministic judge** | The PREGATE MCP server | Scaffold, fixture execution, determinism check, standard trap corpus, admission or rejection with a reason |
| **Activation** | The human, through the CLI | Reviews, promotes the draft to a rule source, and activates it in the preset (`pregate forge promote --activate` or `pregate preset apply`) |

**PREGATE needs no LLM and no API key of its own.** All generative intelligence is supplied by the agent the user already uses; PREGATE only executes and judges. Reason for the split between proposing and activating: **the constrained agent cannot be the one who writes its constraints** (U4).

### 12.2 The PREGATE MCP server [v1]

A single server (`pregate mcp serve`) with two groups of tools. All of them read the same lock as the hook.

**Introspection (querying is not negotiating):**

| Tool | Input | Output |
|---|---|---|
| `get_active_invariants` | `path` | Effective invariants for that file: alias, check, parameters, severity, phase, source, short why, and the preset entry that resolved each conflict |
| `check` | `path` + one of: `after` (full file), `old`/`new` (replacement), `patch` (declared dialect) | Dry-run: the same `Decision` the gate would give (verdict, violations, message). It does not increment retry counters; it is recorded as a pre-check for the metrics |
| `explain_rule` | `id` (alias or check) | Source, why, how to fix, what to avoid, effective parameters, example `pass`/`fail` fixtures, and covered trap families |
| `get_preset_summary` | — | The contract in compact form ("the AI will not be able to: …"), the same as `pregate preset show` |

**Forge:**

| Tool | What it does |
|---|---|
| `forge_list_primitives` | Built-in primitives, their parameters, and the IR capabilities of each language pack, so the agent prefers a primitive or a pattern before a checker |
| `forge_list_candidates` | Backlog candidates that the preset's current knowledge (`glossary`, `layers`, `markers`) could make binary |
| `forge_scaffold` | Creates a draft in `.pregate/forge/drafts/<draftId>/` with a skeleton `check.json`, fixture folders, the proposed alias, and a checklist |
| `forge_write_file` / `forge_delete_file` | Write or delete files **only inside the draft** (normalized relative paths, no `..` and no symlinks) |
| `forge_run` | Runs the draft's fixtures and returns the result per fixture |
| `forge_judge` | Runs the judge's full pipeline (§12.4) and returns `admissible` or `rejected` with the reasons and a report hash |
| `forge_propose_activation` | Records an activation request in `.pregate/requests/`. It activates nothing |

**Explicitly ruled out** (U4): tools to suppress, deactivate, or edit rules; tools to edit the preset, the lock, the baseline, or the exceptions; tools to change `enforcement`; and MCP as an enforcement mechanism. MCP is optional: an agent can never call it and the gate works the same.

**MCP permissions relative to the hook.** Calls to PREGATE MCP tools go through the harness pre-tool like any MCP tool (`mcp__pregate__*` in Claude Code). The adapter lets them through without evaluating them as code writes, because the server only writes inside `.pregate/forge/drafts/` and `.pregate/requests/`, with validated paths.

### 12.3 Forge flow

```
 Practice in natural language ("domain repositories are interfaces")
   │
   ▼ agent → forge_list_primitives / forge_list_candidates
   ▼ agent → forge_scaffold { practice, area, proposedId, kind }
 .pregate/forge/drafts/<id>/   (quarantine: never a rule source, never in scope)
   ├─ check.json              written by the agent via forge_write_file
   ├─ alias.json              proposed alias: source, why, how to fix, what to avoid
   ├─ fixtures/{pass,fail,trap}/…
   └─ checker.*               only if kind = custom, with customJustification
   │
   ▼ agent → forge_run (iterates) → forge_judge
 Judge report: admissible | rejected + reasons + evidence (variant that beats the rule, fixture
                   that fails, determinism difference) + hash
   │  rejected → the agent hardens and asks for judgment again
   ▼  admissible → forge_propose_activation (optional) → .pregate/requests/<ts>.json
 HUMAN:
   pregate forge show <id>        check, fixtures, checker, justification, and report, for review
   pregate forge promote <id>     runs the judge again (does not trust the stored report),
                                 copies to .pregate/rules/checks/<area>/<name>/ and adds the alias
                                 to a local manifest (e.g. local/team-conventions)
   pregate forge promote <id> --activate   also adds the local methodology to the preset
   (or applies the request with `pregate preset apply`, or edits preset.json by hand; never the agent)
```

**Prose inputs.** Rules a team already has written in prose (CLAUDE.md, AGENTS.md, `docs/north-star`, internal guides) **are never loaded as rules** (U1). They are Forge input: the agent reads a practice, translates it into a check + fixtures, and submits it to the judge. That is how the pilot's `amarilla/` pack is built (U8). ArkGate's `arkrules`, which are already programmed rules, enter through the importer [v1] (`pregate import arkgate`), which also produces Forge **drafts**: no imported rule is activated without passing the judge (§15.0).

**Draft quarantine.** Drafts deliberately contain code that violates rules (the `fail` and `trap` fixtures). That is why:
- they are written only by the MCP tools; the harness edit tools still cannot touch `.pregate/**`;
- they are never a rule source and they are not in the evaluation scope;
- `.pregate/**` is always outside the evaluation scope, and `install`/`init` add it to the excludes of tsconfig, the linters, and the test runner; fixtures carry a non-executable suffix (§6.2);
- no file outside the drafts can import them (EVA-FORGE-001, verified in Pre and at Stop).

### 12.4 The judge

Pipeline of `forge_judge` (and of `pregate rules test` for the catalog itself). Each step is deterministic; the first step that fails rejects with its reason:

1. **Schema.** `check.json`, alias, and `fixture.json` validate against their schemas. Valid IDs and namespace (`local/…` for repo drafts).
2. **Checker shape.** If `impl.kind` is `custom`, it requires `customJustification`. The report highlights it for human review.
3. **Fixture minimums.** At least two `pass`, two `fail`, and one `trap` for each corpus family applicable according to `observes` and the language (not only those the author declared), with the proposed alias's defaults.
4. **Fixtures.** Each one produces exactly the expected verdict and violations.
5. **Determinism.** Two runs, file order permuted, another `cwd`, sandbox with no I/O, clock, or randomness. Any difference rejects.
6. **Binariness.** The result is a set of violations; thresholds are explicit parameters. There are no "scores" without a threshold.
7. **Standard trap corpus.** For each `fail` fixture and each applicable family (according to `observes` and language), the judge applies the corpus transformations. Each transformation declares which **structural property it preserves** (for example, "renaming a symbol preserves the dependency graph and the complexity mass"; "moving the parameters into an inline object preserves the amount of information that enters the function"; "importing through a barrel preserves the dependency edge"). If a transformed variant **passes** the rule, the preserved property **did not change**, and that property **is listed in the check's `measures`**, the rule is **gameable without improving the structure**: it is rejected and the report shows the variant as evidence. That variant, once the rule is hardened, is added as a `trap/` fixture. The condition on `measures` avoids rejecting legitimate rules: `trivial-extract` preserves the total complexity mass, but `fn-max-lines` measures the function's **local** size (`fn.local-size`), so extracting functions does improve what it measures; fragmentation is watched by the counterweights at Stop, not by the size rule's judge.
8. **Intermediate refactor states** (only if it declares `phase: pre`). The judge runs a corpus of legitimate intermediate states (module extracted before deleting the original, import toward a file in the same batch, transient cycle). If the rule denies them, it has to move to `phase: stop`.
9. **Budget.** p95 of evaluation per file within its phase budget (≤ 20 ms for `pre`). If not, it moves to `stop` or is rejected.
10. **Regression** (if it is a new version of an existing check). All previous fixtures still pass.
11. **Satisfiability** with the active invariants of the same dimension. If there is no `pass` fixture that satisfies all of them, it is a warning in the report, not a rejection.

Output: `admissible | rejected`, the list of reasons, the evidence, and a hash of the report (check + fixtures + corpus version + engine version). The hash stays in the promoted check's `provenance`.

### 12.5 Standard trap corpus

PREGATE maintains it, versioned inside the `core` source (`corpus/`). It is independent of the author's fixtures: the fixtures the agent writes are not enough to admit a rule (U4).

| Family | Transformation | Property it preserves |
|---|---|---|
| `rename` | Rename symbols, files, or packages to dodge lexical lists | Dependency graph, complexity mass |
| `inline-object` / `options-bag` | Group parameters into an inline object or `opts: any` | Information that enters the function |
| `trivial-extract` | Split a function into trivial helpers called once | Total complexity mass and call path |
| `dynamic-import` | `import()` or `require(variable)` instead of a static import | Dependency edge |
| `barrel-reexport` | Import through a barrel of an allowed layer that re-exports | Effective dependency edge |
| `type-indirection` | Type alias, `as unknown as`, `Record<string, any>` | Effective type safety |
| `generated-marker` / `excluded-path` | Add `@generated` or move to an excluded path | Code effectively written by the agent |
| `inline-suppression` | Suppression comment | Effective violation |
| `split-across-files` | Spread the same logic across several files | Concept and coupling |
| `assertion-weakening` | `toBe(5)` → `toBeDefined()`, `expect.anything()`, wrap in `try` | Strength of the test's verification |
| `literal-renaming` | `const ONE_HUNDRED = 100` | Effective magic literal |

- The transformations are deterministic and are implemented per language in each language pack.
- **It grows with real traps.** An evasion observed in use (shadow mode, Stop, pre-commit, CI, or a human labeling) is added first as a `trap/` fixture of the affected check; if it is generalizable, it becomes a new corpus transformation, and every rule is judged again against the new corpus version in the catalog CI.

### 12.6 Place on the roadmap

**Recommendation: the Forge and MCP arrive in v1, not in the MVP.** Reasons:
- The Forge freezes the rule format. That format has to be proven first with the MVP's 18 rules, written by PREGATE with the same pipeline.
- The trap corpus needs real traps, and the first ones appear in the MVP's shadow-mode pilot.
- `custom` checkers need the deterministic sandbox, which is v1 work.
- The MVP's CLI pre-check already covers the introspection function for measuring its effect (arm H).

**What enters the MVP** because the Forge reuses it and the catalog itself needs it anyway: the folder format with `check.json` and fixtures, `pregate rules test` (fixtures, including hand-written `trap/` fixtures, determinism, and validation of schemas, IDs, and namespaces), and the `path` source limited to primitives and patterns. The standard transformation corpus arrives in v1 with the judge. The built-in catalog is written from day 1 as if it passed through the Forge (dogfooding).

### 12.7 Honest limits

- The corpus is finite. A rule can pass the judge and still be gameable by a path nobody modeled. Mitigation: human review on promotion, a cycle of real traps, and mandatory regression.
- The judge does not evaluate "the spirit" beyond the properties each transformation declares. What cannot be expressed as a preserved structural property is outside its reach.
- The agent's fixtures can be biased toward its own checker. That is why the corpus is independent and promotion judges again.

---

## 13. Technical architecture

### 13.1 One core, three faces

```
                     ┌───────────────────────── PREGATE core ─────────────────────────┐
  hook (enforcement) │ rules loader · preset compiler · reconstruct · language packs │
  ─ adapters ───────►│ → IR · engine · ratchet · decision · feedback · state        │
                     │                                                              │
  CLI (human) ──────►│ check · explain · preset · rules · forge promote · baseline  │
                     │                                                              │
  MCP (agent) ──────►│ introspection (dry-run) · forge (judge)                      │
                     └──────────────────────────────────────────────────────────────┘
```

A single implementation of each rule and of each decision. The faces only translate input and output.

### 13.2 Core contracts

```ts
interface ProposedChange {
  harness: { id: string; version?: string };            // "claude-code", "grok-build", "codex-cli", …
  tool: { native: string; form: "full" | "oldnew" | "insert" | "patch" };   // shape of the INPUT
  change: { kind: "create" | "modify" | "delete" | "move"; fromPath?: string };  // EFFECT of the change
  path: string;                                         // absolute: realpath of the deepest existing ancestor
                                                        // + remaining segments; base according to profile.pathBase
  before: string | null;                                // content on disk at the time of the call (null = does not exist)
  after: string | null;                                 // null ONLY if change.kind = "delete"; if it could not
                                                        // be reconstructed, `reconstruction` says so, not `after`
  reconstruction: "exact" | "tool-will-fail" | "unknown" | "truncated";
  session: { id: string; agentId?: string; permissionMode?: string; interactive?: boolean };
                                                        // interactive: only if the profile has a signal; if missing ⇒ not interactive
  callId: string;                                       // tool_use_id or equivalent; synthetic if the harness does not send it (§11.3)
  batchId?: string;                                     // multi-file patch or parallel batch
  projectRoot: string;                                  // first .pregate/ upward, validated (§4.2, step 3)
}
// `before` is the current disk; the ratchet's `before_session` is computed by the core from the snapshot.

interface ProposedCommand {                            // shell guard
  harness: { id: string; version?: string };
  session: ProposedChange["session"];
  callId: string;
  commands: string[];                                   // one or several (Cline `run_commands`)
  cwd: string; background?: boolean;                    // background: run_in_background, Monitor
  env?: Record<string, string>;                         // detected inline assignments (VAR=… cmd)
}

interface Decision {
  verdict: "allow" | "deny" | "ask";                    // allow = "no objection"; never translated to a native allow
  halt: boolean;                                        // halt the turn, if the harness supports it
  violations: Violation[];
  warnings: Violation[];                                // only those introduced in this call
  reasonCompact: string;                                // ≤ 256 characters, self-contained
  reasonFull: string;                                   // ≤ 4,000 characters
  lockHash: string;
}

interface Violation {
  aliasId: string; checkId: string; path: string; line: number; symbol?: string;
  measured?: number; limit?: number; atSessionStart?: number;
  severity: "deny" | "ask" | "warn"; why: string; fix: string; avoid?: string;
}
```

The adapter translates `Decision` with the harness capability profile (§14.3): if the harness does not support `ask` reliably in that mode, or there is no interactivity signal, `ask` becomes `deny`; if it does not support halting the turn, `halt` is expressed as text in the reason and as an end-of-turn block when that exists.

### 13.3 Stack

- **MVP:** **TypeScript compiled with Bun** (`bun build --compile`) + `@ast-grep/napi` and tree-sitter (TS, TSX, and JS grammars).
  - Criterion: time to first value.
  - Estimated startup of 10 to 40 ms (to be measured).
  - **On day 1 of the spike it is verified** that the native modules package correctly.
  - Additional advantage: harnesses with in-process JS/TS plugins (opencode, Kilo, Amp, Cline, pi) can load the core as a library, without launching a process per call [v2].
- **From day 1, the rules, the fixtures, the IR, the preset, and the harness profiles are data** (JSON + JSON Schema). The engine can be rewritten without touching the catalog.
- **v1:** if the p95 of §13.6 is not met, or the binary size prevents including it in the plugin, the engine migrates to **Rust** (tree-sitter, `ast-grep-core`, `serde`, `globset`). Precedents with that stack: ast-grep, Ruff, and Biome.
- **Platforms:** MVP on macOS and Linux. Windows in v1.1. (The matcher and the guard include `PowerShell` from the MVP because it also exists as an opt-in on macOS and Linux.)
- **The same binary** serves the hook, pre-check, pre-commit, CI, and the MCP server.

### 13.4 Language packs and neutral IR

A language pack brings: the tree-sitter grammar, the extractors toward the neutral IR, the ecosystem's import resolver, the trap-corpus transformations for that language, and the idiomatic checks (`checks/idiom-<language>/`).

```ts
interface LanguagePack {
  id: string;                                           // "typescript"
  extensions: string[];
  capabilities: IrCapability[];                         // which parts of the IR it provides
  parse(src: string): Tree;                             // tree-sitter
  extract(t: Tree, file: FileCtx): ModuleIR;
  resolve(i: RawImport, ctx: ProjectCtx): ResolvedPath | Unresolved; // relatives + tsconfig paths (MVP)
  trapTransforms: Record<TrapFamily, Transform>;        // corpus per language
}

type IrCapability =
  | "modules" | "imports.resolved" | "imports.dynamic" | "surface.exports"
  | "functions.params" | "functions.metrics"            // lines, nesting, cyclomatic, cognitive
  | "classes.members" | "calls.local" | "comments" | "tests.assertions";

interface ModuleIR {
  path: string; language: string;
  imports: { specifier: string; resolved: string | null; kind: "static" | "dynamic" | "type-only" | "re-export" | "require"; line: number }[];
  exports: { name: string; kind: string; line: number }[];
  symbols: { kind: "function" | "method" | "class" | "interface"; symbolPath: string; span: [number, number];
             visibility: "public" | "private" | "protected" | "module";
             params: { name: string; inlineMembers?: number }[];
             metrics: { lines: number; nesting: number; cyclomatic: number; cognitive: number };
             calls: string[] }[];
}
```

- **Rules over the IR** (complexity, parameters, dependency direction, cycles, public surface, single-caller abstraction) are **portable**: they work in any language whose pack provides the capabilities the check declares in `ir`.
- **Pattern rules** (`impl.kind: "pattern"`) declare one pattern per language; if the language's pattern is missing, the check stays `unimplemented` for that language.
- **Idiomatic rules** live in the language's pack.
- **Layer rules:** they use `imports.resolved` + preset globs, and follow re-exports up to 3 hops.
  - `import type` counts as an edge in CA and HEX (configurable).
  - The `exports` of `package.json` in monorepos arrives in v1.
- **MVP:** TS/JS pack (`.ts`, `.tsx`, `.js`, `.mjs`). **Next, according to demand:** Python (v1.1), then Go, Java/Kotlin, C#, Rust. The pilot also has PLpgSQL, Python, and C# (U7): until their pack exists, those files inside declared layers produce EVA-SCOPE-001 and stay outside layers in the pilot preset.

### 13.5 Components

```
pregate
├─ core/          evaluate(ProposedChange | ProposedCommand | SessionEnd) → Decision; no harness I/O
│  ├─ reconstruct/   shapes full | oldnew | patch (dialects: codex, unified; grok-hashline in v2)
│  ├─ engine/        evaluators by impl.kind: primitive (metric | banned-import | layer-edge | graph |
│  │                 diff | surface) | pattern | custom (sandbox, v1)
│  ├─ ratchet/       counts (MVP), fingerprints and matching (v1), baseline
│  ├─ decision/      severity × enforcement × counters × harness capabilities
│  ├─ feedback/      formatter (compact line ≤ 256 + detail), sanitization, i18n, truncation
│  └─ state/         append-only events per call; derived counters
├─ rules/         source loader (builtin | path | git | npm), namespaces, schemas, versions, hashes
├─ preset/        compiler: extends, methodologies, scopes, conflicts → mandatory resolve, lock
├─ lang/          language packs (TS/JS in the MVP)
├─ adapters/      claude-code (MVP; grok-build profile according to question 9); claude-wire family, codex,
│                 gemini (v1); post-edit class (v1.1); JS plugin shims (v2)
│  └─ <harness>/  profile.json + contracts/<version>/*.json
├─ forge/         judge: fixtures, determinism, corpus, intermediate states, satisfiability, report
│                 (`rules test` in the MVP; corpus, MCP, and sandbox in v1)
├─ import/        ArkGate importer: arkrules + ark.config → Forge drafts and `coexist` (v1)
├─ mcp/           MCP server: introspection + forge (v1)
├─ catalog/       core source: checks/, methodologies/, backlog/, pairs.json, dimensions.v1.json, corpus/
└─ cli/           see §13.8
```

### 13.6 Performance budget and fail mode

| Path | p50 | p95 | Internal watchdog | Configured hook `timeout` |
|---|---|---|---|---|
| Edit pre-tool (≤ 2,000 lines) | ≤ 50 ms | ≤ 150 ms | 2 s | 10 s effective (`install` always pins it explicitly, with each harness's key and unit: see below) |
| Shell pre-tool (guard only) | ≤ 15 ms | ≤ 50 ms | 1 s | 10 s |
| Shell pre-tool with point snapshot [v1] | ≤ 80 ms | ≤ 300 ms | 1 s | 10 s |
| Post-tool [v1] | ≤ 80 ms | ≤ 250 ms | 3 s | 15 s |
| End of turn (changed files; cached graph in v1) | ≤ 2 s | ≤ 8 s | 45 s | 60 s |
| MCP `check` [v1] | ≤ 60 ms | ≤ 200 ms | 2 s | — |

**Timeout units.** They are not the same across harnesses [V]: Gemini, Augment, and Cline's file hook use **milliseconds** (a `timeout: 10` there is 10 ms, fail-open on every call); Qwen interprets values ≥ 1000 as ms; Copilot uses the key `timeoutSec`. The profile declares `install.timeoutKey` and `install.timeoutUnit: "s" | "ms"`, and a contract test reads the installed file and checks the effective timeout.

**[V] Critical facts:**
- In Claude Code, a PreToolUse that hits the timeout **does not block**: "don't count on a stalled hook to act as a gate". The default `command` timeout is **600 s**. Exit 1 without JSON is a non-blocking error.
- In Grok Build the default timeout is **5 s** and a timeout, a crash, or invalid output lets the tool run. In Codex, Gemini, Qwen, VS Code, Devin, Junie, Kiro, Factory, and Augment, exit codes other than the blocking one also fail open (§14.5).

**Design responses**
- **Internal watchdog** well below the `timeout`. When it expires, `failMode` applies:
  - `closed` (**default**, U10): deny through the harness's most robust channel, with "PREGATE could not evaluate: <cause>" and the instruction to report it to the user. The counters avoid the loop.
  - `ask` (opt-in): the same reason, but it escalates to the human; only in interactive sessions of harnesses with reliable `ask` in that mode. In any other case it degrades to `closed`.
  - There is no mode that lets a call through without evaluating: the draft's `open-with-recheck` is removed because it breaks the U10 guarantee.
- **Every result other than "no objection" goes out through the harness's most robust channel** (in Claude Code, exit 2 + JSON).
  - Every exception is caught so an output is always emitted.
  - **Residual risk:** an abort, an OOM, or a SIGKILL cannot be caught. End of turn, pre-commit, and CI cover those cases.
- **No daemon in v1.**
  - A and integrity read only the touched file. B-local also opens the files that follow the re-exports (up to 3 hops) and `tsconfig`; that read is inside the budget, with a resolution cache on disk.
  - B-global uses a graph cache on disk, invalidated by hash or mtime.
  - The daemon is added only if the measurements exceed the p95.

### 13.7 Configuration and installation of the Claude Code adapter

**MVP:** `pregate install --harness claude-code` copies the launcher to `.pregate/bin/pregate` (committed), writes the hooks in `.claude/settings.json` and, with `--git-hook`, the pre-commit in `.pregate/git-hooks/` (§10.2.9).
- **Shell form with a path relative to the repo**, never an absolute path of the machine of whoever installed it: `.claude/settings.json` is committed and a path that does not exist on another team member's machine leaves the gate silently off [V]:
  ```json
  { "type": "command",
    "command": "\"${CLAUDE_PROJECT_DIR:-.}\"/.pregate/bin/pregate hook pre --harness claude-code", "timeout": 10 }
  ```
  The committed launcher looks for the engine (installed by `pregate install` or downloaded) and **fails closed** if it does not find it. The `:-.` covers harnesses that do not export `CLAUDE_PROJECT_DIR` (Gemini and Qwen export it [V]; Grok, Cursor, VS Code, and Devin, to verify with a contract test) and that run the hook with `cwd` at the root.
- **Invocation without a subcommand.** Grok Build runs Claude hooks discarding `args` (its `RawHandler` only has `type`, `command`, `url`, `timeout`, and `env`, verified in the `xai-grok-hooks` code); that is why shell form is used with the subcommand inside `command`. Also, the binary invoked **without a subcommand**, with non-TTY stdin that contains a hook payload (`hook_event_name`, `hookEventName`, or the `GROK_HOOK_EVENT` variable), behaves as `hook auto`: it detects the harness and the event, and never prints the help or exits with 0 or 1.
- **Fail-closed output according to the event.** Pre: deny with exit 2. Stop: `decision:block` once and then `systemMessage` (exit 2 on every Stop would provoke up to 8 consecutive continuations with "binary not found"). SessionStart: `systemMessage`.

**v1:** the plugin brings `<plugin>/hooks/hooks.json`:

```json
{
  "description": "PREGATE: design invariants by methodology",
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate",
                     "args": ["hook", "session-start", "--harness", "claude-code"], "timeout": 15 } ] }
    ],
    "PreToolUse": [
      { "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor",
        "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate",
                     "args": ["hook", "pre", "--harness", "claude-code"], "timeout": 10,
                     "statusMessage": "PREGATE: validating invariants…" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor",
        "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate",
                     "args": ["hook", "post", "--harness", "claude-code"], "timeout": 15 } ] }
    ],
    "PostToolBatch": [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate", "args": ["hook", "post-batch", "--harness", "claude-code"], "timeout": 15 } ] } ],
    "ConfigChange":  [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate", "args": ["hook", "config-change", "--harness", "claude-code"], "timeout": 10 } ] } ],
    "Stop":          [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate", "args": ["hook", "stop", "--harness", "claude-code"], "timeout": 60 } ] } ],
    "SubagentStop":  [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate", "args": ["hook", "stop", "--harness", "claude-code"], "timeout": 60 } ] } ]
  }
}
```

**Notes [V]** (https://code.claude.com/docs/en/hooks and https://code.claude.com/docs/en/plugins-reference):
- **Placeholders.** They are substituted both in `command` and in each element of `args`.
- **Exec form.** In exec form, `command` has to be a real executable (on Windows, an `.exe`).
  - On macOS and Linux, `bin/pregate` is a minimal POSIX launcher that chooses the binary by platform. **If it does not find it, it emits the event's fail-closed output** (deny + exit 2 on Pre; see above), so it never fails open in silence.
  - The plugin [v1] uses exec form with `args` because only Claude Code loads it; the MVP's settings installation uses shell form because other harnesses read it.
  - Windows [v1.1]: native `.exe` launcher, or shell form with `"shell": "powershell"` (to verify).
- **Matcher.** A matcher that contains only `[A-Za-z0-9_\- ,|]` is an exact list. With other characters it is evaluated as an unanchored RegExp.
- **A single handler** dispatches by `tool_name`: matching hooks run in parallel and multiplying processes is not worthwhile.
- **`if` only serves to optimize**: the doc describes it as *best-effort*.
- **Subagents.** Settings, managed, and plugin hooks **also run inside subagents**, with `agent_id` and `agent_type`.
- **Plugin paths.** `${CLAUDE_PLUGIN_ROOT}` changes with every update. State and cache go in `${CLAUDE_PLUGIN_DATA}`, which persists.
- **`userConfig`.** `presetPath` (default `.pregate/preset.json`) arrives as `CLAUDE_PLUGIN_OPTION_PRESETPATH` or as `${user_config.presetPath}` (the latter only in exec form).
- **stdout parsing.** It is parsed as JSON only if it starts with `{` and ends with `}`. Exec form avoids noise from the shell profile leaking in.
- **Other harnesses that read this file.** Grok Build, Devin Local, Cursor (with Third-Party Imports), and VS Code (with `chat.useClaudeHooks`) can run these hooks with **their own** payload; they also read `.claude/settings.local.json`, so installing there does not avoid them. The `--harness claude-code` argument makes the adapter detect the mismatch: if PREGATE has a profile for the real harness, it uses it; if not, it applies `failMode` (§14.1). In the MVP detection is only "the payload does not match ⇒ `failMode`"; autodetection of the real harness arrives with its profiles.
- **Double installation.** When a harness that reads `.claude/settings*.json` also has its own registered PREGATE installation (native adapter, v1+), the handler installed for Claude detects that harness and exits in silence (exit 0), because the native one already decides; so there are no duplicate decisions or counters. If the native installation is not registered or does not respond, there is no silence: `failMode` applies. For Grok Build, the alternative is `[compat.claude] hooks=false` when installing the native adapter.
- **Devin** compares the matcher as a regex against lowercase names (`write`, `edit`, `exec`); with `Write|Edit|…` the hook probably never fires (to verify with a contract test). Until then, Devin is covered only by pre-commit and CI.

**Installation checklist (day 1 of the spike):**
1. **MVP:** `pregate install --harness claude-code [--git-hook]` copies the launcher and the binary and writes the hooks. **v1:** `claude plugin install pregate` (channel to be defined). If the plugin accepts per-platform binaries, they are included (to verify). If not, they are downloaded to `${CLAUDE_PLUGIN_DATA}` on SessionStart, and the launcher fails closed.
2. **Workspace trust [V]:** in an interactive session, settings hooks do not run until the trust dialog is accepted. `doctor` detects it and reports it. (Codex, Grok Build, Qwen, Copilot, and VS Code have equivalent trust mechanisms.)
3. **No preset:** the hook warns once per session and stays inactive.
4. **`pregate doctor`** [v1, at session start] verifies registered hook, binary, preset, lock, sources, grammars, trust, and harness version against the tested matrix, and warns the human. **It does not replace the launcher's fail-closed behavior.**
5. **Definition of done:** "from zero to the first deny in under 5 minutes with an example preset in `enforce`", measured on macOS and Linux (and on Windows in v1.1).
6. **Contract tests** against the installed version of each supported harness, for each "(to verify)" in this document (§14.7).

### 13.8 CLI

| Command | Delivery | What it does |
|---|---|---|
| `pregate check [paths] [--stdin --path P] [--ratchet] [--staged] [--format agent\|json\|sarif\|text]` | MVP | Evaluation for the agent's pre-check, pre-commit, and CI |
| `pregate explain <id>` / `--path <file>` | MVP | Source, why, fixtures, and effective parameters; or every invariant that applies to a file and where it comes from |
| `pregate preset show` / `compile` | MVP | The contract in human language; compilation with conflict errors; writes the lock to disk. Human only (the guard denies it to the agent) |
| `pregate preset apply <request>` | MVP | Applies a proposal from `.pregate/requests/` (JSON patch) after showing it: validates, compiles, and writes the preset and the lock. It is the human act of activation (U4) |
| `pregate install [--git-hook] [--ci github]` | 0.2.0 | Repo pre-commit/CI only; removes legacy 0.1.0 hooks and launcher (MH-28) |
| `pregate setup` / `update [--version v \| --engine v]` / `uninstall [--purge]` | 0.2.0 | Global installation, explicit verified update, ownership-preserving removal (MH-27) |
| `pregate rules test [path]` | MVP | Runs fixtures (including `trap/`) and determinism; validates schemas, IDs, namespaces, and versions of a source. In v1 it adds the standard trap corpus |
| `pregate capture --harness <id>` | v1 | Records real harness payloads for contract fixtures (§14.7) |
| `pregate bench` | MVP (internal) | Benchmark of §16 on the fixture repos |
| `pregate packs [show <id>]` | v1 | Methodology cards (§8.2) |
| `pregate init` (+ skill `/pregate:init`) | v1 | Assistant: languages, methodologies, confirmed resolution of each conflict, layers by folders, glossary, ratchet, ESLint and tsconfig detection. Also with flags |
| `pregate preview --preset X` | v1 | Impact on the current repo before committing to it |
| `pregate preset diff <ref>` | v1 | Differences in rules, thresholds, and resolutions between versions |
| `pregate sources update [ns]` | v1 | Updates source versions showing which verdicts change |
| `pregate mcp serve` | v1 | MCP server (introspection + Forge) |
| `pregate import arkgate` | v1 | Reads `arkrules/*.json` + `ark.config.json` and produces Forge drafts (which have to pass the judge) and the proposed `coexist` section; never active rules without proof (§15.0) |
| `pregate forge list \| show \| promote [--activate] \| reject \| suggest` | v1 | Human review, promotion, and activation of drafts; suggestions from the backlog |
| `pregate baseline` | v1 | Generates the baseline. A human runs it; the guard denies it to the agent |
| `pregate approve <fingerprint\|--last>` | v1 | Records an exception (local best-effort; effective in CI with CODEOWNERS) |
| `pregate report` / `label` | v1 | Instrument calibration only: precision per rule, loops, evasions, real traps, `net_catches`, beneficial correction; human labeling. **No burn-down or debt report** (U10, ArkGate's territory). In the MVP pilot, labeling is done by hand on the `state/` records |
| `pregate doctor` | 0.2.0 | Versions, drift, Codex trust, PATH and canaries for all five adapters (MH-27) |

### 13.9 Scalability and discarded technical decisions

**Catalog scalability.** Rules are data with their proof. The catalog CI runs fixtures, determinism, the trap corpus, satisfiability, the paraphrase cap, harness contracts, and validation of the preset examples with the real compiler.

**Discarded:**
- **`updatedInput` (or equivalent) to self-correct.** **[V]** In Claude Code it replaces the full input and, with several hooks, the last one to finish wins, non-deterministically. Also, the human would lose traceability. In Qwen, `updatedInput` appears in the doc but is not read [V].
- **ESLint or Semgrep on the synchronous path.** They start in 0.3 to 2 s. They remain as optional adapters at Stop or CI [v2].
- **LLM judge in the gate, or an LLM of PREGATE's own.** See §2 and §18.6.
- **MCP as enforcement**, and MCP tools to suppress, deactivate, or edit rules or the preset (U4).
- **Rules in markdown or prose** (U1).
- **Implicit precedence between methodologies** ("the last wins", "the strictest wins" by default).
- **`failMode: open-with-recheck`** and any mode that lets a call through without evaluating (U10).
- **`ask` on `preset.json`** as an act of activation: the agent cannot write the preset (U4).
- **`pregate export` to CLAUDE.md or AGENTS.md**: it generates prose and "before" guidance, which is ArkGate's territory (U1, U10).
- **A validated MCP edit tool as a substitute for `Edit`/`Write`** in harnesses without a pre-edit hook (the research suggests it): the agent may not use it, and MCP is not enforcement (U4).
- **Automatic comparison of the paraphrases against the books**, for copyright and logistics.

---

## 14. Harnesses and adapters

### 14.1 Adapter principles (U6)

1. **The core does not know about harnesses.** Each adapter translates the native event to `ProposedChange` / `ProposedCommand` and the `Decision` to the native output.
2. **Never a native allow.** "No objection" is expressed with the harness's silence (exit 0 with no decision, do not throw, `action:"allow"` only where there is no other way to continue and it does not skip approvals).
3. **First line of the reason ≤ 256 characters, self-contained.**
4. **What cannot be evaluated does not pass (U10).** `reconstruction: unknown | truncated`, unknown payload, or parser failure ⇒ `failMode` (default `closed`), never "no objection".
5. **Capability profile per harness** (`profile.json`): tool names and their shape, output dialect, reliability of `ask` and of halt, reason limit, default timeout, truncation flags, configuration files to protect.
6. **Explicit detection first.** `install` pins `--harness <id>`. If the payload does not match that profile (for example, Grok Build running hooks from `.claude/settings.json`), the adapter tries to autodetect the real harness by environment variables and payload shape; if there is a profile, it uses it; if not, `failMode` with the reason "harness payload not recognized" (configurable in `harnesses.unrecognizedPayload`).
7. **Contracts per version.** Undocumented payloads are captured (`pregate capture`) and pinned as contract fixtures per harness version before supporting it (§14.7).
8. **Pre-commit and CI are mandatory as a net.** Many harnesses fail open, and some have no hooks.

### 14.2 Native tools and normalized shape

| Harness | Full file | old/new | Patch | Shell |
|---|---|---|---|---|
| Claude Code | `Write` | `Edit` (`MultiEdit` if it arrives) | — | `Bash`, `PowerShell` |
| Grok Build | `write` | `search_replace` (empty old = create); `edit` (opencode agent, keys to capture) | `hashline_edit` (anchors), `apply_patch` {patch} (codex toolset) | `run_terminal_command`; `bash` (opencode agent) |
| Codex CLI / IDE | — | — | `apply_patch` (text in `tool_input.command`; matcher alias `Edit`/`Write`) | `Bash` (includes `exec_command`) |
| Gemini CLI | `write_file` | `replace` (fuzzy matching) | — | `run_shell_command` |
| Qwen Code | `write_file` | `edit` (exact; empty old = create) | — | `run_shell_command` (alias `Bash`) |
| Copilot CLI / cloud | `create` {path, file_text} | `edit` {path, old_str, new_str} | `apply_patch` (Codex models; shape to capture) | `bash`, `powershell` |
| VS Code agent mode | `create_file` | `replace_string_in_file`, `multi_replace_string_in_file` | `apply_patch` {input}; `insert_edit_into_file` (**not reconstructable**) | `run_in_terminal` |
| Cursor | `Write` (payload to capture) | `StrReplace` (community evidence) | — | `Shell`, `beforeShellExecution` |
| Devin Local / CLI | `write` | `edit` | `apply_patch` | `exec` |
| Junie CLI | `Write` | `Edit` (probable) | — | `Bash` |
| Kiro | `fs_write`/`write` create | str_replace; insert / append (`insert` shape) | — | `shell`, `execute_bash` |
| Augment | `save-file` (to capture) | `str-replace-editor` (numbered pairs) | — | `launch-process` |
| Factory Droid | `Create` | `Edit` | `ApplyPatch` {input} | `Execute` |
| Cline | `editor` without `old_text` (new file) | `editor` {old_text, new_text}; `insert_line` (`insert` shape) | `apply_patch` {input} | `run_commands` (list) |
| opencode / Kilo | `write` | `edit` | `apply_patch` {patchText} | `bash` |
| Amp | `create_file` | `edit_file` | `apply_patch` | `shell_command` |
| pi | `write` | `edit` {edits[]} against the original | — | `bash` (and `user_bash`) |

### 14.3 Capability profile (example: Grok Build)

```jsonc
// adapters/grok-build/profile.json
{
  "$schema": "https://<domain-to-be-defined>/schema/harness-profile.v1.json",
  "id": "grok-build",
  "dialect": "claude-wire",                       // family that shares input and output shape
  "detect": { "env": ["GROK_HOOK_EVENT", "GROK_SESSION_ID"], "payloadKeys": ["toolName", "toolInputTruncated"] },
  "events": { "sessionStart": "SessionStart", "preTool": "PreToolUse", "postTool": "PostToolUse", "turnEnd": "Stop" },
  "tools": {
    "write":                { "form": "full",   "path": "file_path", "content": "content" },
    "search_replace":       { "form": "oldnew", "path": "file_path", "old": "old_string", "new": "new_string",
                              "all": "replace_all", "match": "exact", "emptyOld": "create" },
    "apply_patch":          { "form": "patch",  "dialect": "codex", "field": "patch" },
    "hashline_edit":        { "form": "patch",  "dialect": "grok-hashline", "supported": false },  // v2 → unknown
    "edit":                 { "form": "oldnew", "keys": "to capture", "supported": false },        // opencode agent → unknown
    "run_terminal_command": { "form": "shell",  "command": "command" },
    "bash":                 { "form": "shell",  "command": "command" }                               // opencode agent
  },
  "pathBase": "absolute",                         // absolute | cwd | project_path | plugin.directory
  "ask": { "modes": ["default", "auto", "plan"], "headlessSignal": null, "default": "deny" },
                                                  // -p and ACP not verified; no interactivity signal ⇒ deny
  "output": { "deny": "json+exit2", "stderr": "reasonFull", "reasonMaxChars": 256,
              "haltReliable": null, "contextOnDeny": false },
  "unverified": ["halt", "ask.headless", "env.CLAUDE_PROJECT_DIR"],
  "limits": { "truncationFlag": "toolInputTruncated", "defaultTimeoutSec": 5,
              "failOpenOn": ["timeout", "crash", "malformed-output", "unknown-decision"],
              "ignoresArgs": true },                // RawHandler without `args`: shell form mandatory
  "install": { "path": ".grok/hooks/pregate.json", "timeoutKey": "timeout", "timeoutUnit": "s", "timeout": 10,
               "matcher": "write|search_replace|hashline_edit|apply_patch|edit|run_terminal_command|bash" },
  "protect": [".grok/hooks/**", ".grok/config.toml", "~/.grok/hooks/**", "~/.grok/config.toml"],
  "contracts": ["contracts/1.0.45/", "contracts/1.0.46/"]
}
```

### 14.4 Harness matrix (summary as of 2026-10-01)

Source: `docs/research/harnesses-2026-10-01.json` and `harnesses-grok-2026-10-01.json` (verification against official documentation and source code; the JSON files have the URLs).

| Harness | Pre-edit event | Edit payload | Blocking | Claude compatibility | Confidence | Notes / caveats |
|---|---|---|---|---|---|---|
| **Claude Code** (v2.1.287) | `PreToolUse` | `Write` {file_path, content}; `Edit` {old_string, new_string, replace_all} | exit 2 + JSON deny; the agent sees the reason | native | high [V] | Timeout and crash do not block; default timeout 600 s; `ask` only in interactive modes; `MultiEdit` undocumented |
| **Grok Build** (xAI, CLI `grok` 1.0.45/46) | `PreToolUse` (camelCase + snake_case alias) | full `write`; `search_replace` old/new; `edit` (opencode agent); `hashline_edit` by anchors; `apply_patch` {patch} (codex toolset) | JSON deny (or `hookSpecificOutput`) or exit 2; the model sees "Hook denied: <reason>" | **Reads `.claude/settings*.json`** (user always; project with folder trust) and `.cursor/hooks.json`; Claude matchers are expanded by alias, but `tool_name` arrives with the native name | high | **Reason trimmed to 256 characters. `toolInput` > 128 KiB arrives truncated** (`toolInputTruncated`). **Default timeout 5 s.** Fail-open on timeout, crash, invalid output, or unknown decision. `additionalContext` arrives only after the tool runs. The opencode agent's `edit`/`bash` have no alias. **Discards `args` of Claude hooks** (shell form mandatory) |
| **Codex CLI** (0.160; hooks stable since 0.124) | `PreToolUse` (matcher `apply_patch`, alias `Edit`/`Write`) | `apply_patch`: raw patch text (Add/Update/Delete/Move, multi-file, context hunks) | exit 2 + stderr, or JSON deny (non-empty reason, no extra keys) | similar format in its own files (`.codex/hooks.json`, `config.toml`); plugins receive `CLAUDE_PLUGIN_ROOT` for compatibility | high | **Fail-open** on error, timeout, or invalid JSON; **`ask`, `continue:false`, and `stopReason` make the hook fail and the tool continues**. Requires trust. Bypass via `perl -pi` was observed: the shell guard is mandatory. `write_stdin` does not fire PreToolUse |
| Codex IDE / Codex Cloud | IDE: same as the CLI. Cloud: no user hooks | same as the CLI | same as the CLI | same as the CLI | medium | IDE: open bug of hooks that do not run in VS Code threads (#33413) and trust that skips in silence. Cloud: CI on the PR only |
| **Gemini CLI** (0.63) | `BeforeTool` | full `write_file`; `replace` {old_string, new_string, instruction} | JSON {decision:"deny", reason} or exit 2 | own format (`.gemini/settings.json`); exports `CLAUDE_PROJECT_DIR` | high | `replace` searches exact → flexible → regex → fuzzy: exact reconstruction may not match. `ModifyWithEditor` changes args after the hook. Other exits: fail-open. stdout only with the JSON |
| **Qwen Code** (0.24) | `PreToolUse` (accepts alias `Write`/`Edit`/`Bash`) | full `write_file`; exact old/new `edit` (empty old creates) | `hookSpecificOutput` deny or exit 2 | **Claude format and names** in `.qwen/settings.json` | high | **`allow` skips approval: do not emit it.** Fail-open on error or timeout. PreToolUse runs after user approval (it sees the final input). API changing |
| **GitHub Copilot CLI** (1.0.91; require ≥ 1.0.70) | `preToolUse` / `PreToolUse` | `create` {path, file_text}; `edit` {path, old_str, new_str}; `apply_patch` (undocumented shape) | JSON `permissionDecision: deny` or exit 2 | **accepts Claude's PascalCase structure and events** (≥ 1.0.21) | high (arg keys: medium) | In camelCase, `toolArgs` is a JSON string. **Timeout fail-open (30 s)**; other non-zero exits fail-closed (≥ 1.0.57). Matcher honored since 1.0.36; subagents since 1.0.49 |
| Copilot cloud agent | `preToolUse` | same as the CLI (inferred) | same as the CLI | only `.github/hooks/*.json` on the default branch | medium | Only the `bash` field; it ends in a PR, so CI covers it |
| **VS Code agent mode** (Preview) | `PreToolUse` | full `create_file`; `replace_string_in_file`; `multi_replace_string_in_file`; `apply_patch`; `insert_edit_into_file` (**not reconstructable**) | JSON deny or exit 2 | **reads `.claude/settings*.json`** with `chat.useClaudeHooks` | high | **Ignores the matcher:** the script filters by `tool_name`. Other exits: fail-open. Timeout 30 s. Requires workspace trust |
| **Cursor** (≥ 2.4) | `preToolUse` (matcher `Write`/`Delete`) | **Write with no documented payload** (contradictory community evidence: `StrReplace` with `path`, `old_string`, `new_string`) | exit 2 or JSON `permission: deny` + `agent_message` | **imports Claude hooks** with Third-Party Imports (maps `Edit`→`Write`) | medium | **Only `deny` is effective** (`ask`/`allow` are not applied; open bug). `failClosed:true` available. Capture payload per version |
| Devin Local / Devin CLI | `PreToolUse` (regex) | undocumented `edit`/`write`/`apply_patch` | exit 2 or JSON `decision: block` | **reads `.claude/settings*.json`** by default | medium | Fail-open on other exits. Regex matcher against lowercase names: the Claude matcher probably does not fire (to verify). Windsurf Cascade (legacy) was removed on 2026-09-08: do not invest |
| JetBrains Junie CLI (EAP) | `PreToolUse` | `Write` {file_path, content} (secondary evidence); `Edit` probable old/new | exit 2 or JSON `decision` | Claude format in `~/.junie/config.json` (project config is ignored) | medium-high | Timeout 10 s; fail-open; no PostToolUse; ACP and server hosts do not invoke hooks |
| Kiro (IDE 1.x / CLI 3.x) | `PreToolUse` (`write`/`fs_write`) | undocumented (ancestor: create \| str_replace \| insert \| append) | exit 2 + stderr only | own format (`.kiro/hooks/*.json`) | high (mechanism) / low (payload) | The IDE passed empty context until ~1.0.116; the CLI with `--no-interactive` does not load hooks; exit 2 did not block on Windows (2.2.2) |
| Augment (Auggie CLI + IDE) | `PreToolUse` | `str-replace-editor` {path, old_str_1, new_str_1, …}; undocumented `save-file` | exit 2 or JSON deny (only `deny` supported) | Claude-like format (`.augment/settings.json`) | high | Project hooks only in the CLI. PostToolUse brings complete `file_changes` (useful for re-evaluation) |
| Factory Droid | `PreToolUse` | `Create` {file_path, content}; old/new `Edit` (keys unverified); `ApplyPatch` {input} | exit 2 or JSON deny | format almost identical to Claude (`.factory/hooks.json`) | high | Fail-open on other exits |
| Cline (VS Code 4.x, CLI 3.x, SDK) | file hook `PreToolUse` / plugin `beforeTool` | `editor` {path, old_text, new_text}; `apply_patch` {input} | file hook: `cancel` **stops the whole run with no feedback**; plugin: `{skip:true, reason}` returns to the model | no | high | Use the plugin, not the file hook. File hooks fail-open. `--yolo` turns hooks off. Plugins in VS Code unconfirmed |
| opencode (1.18) / Kilo Code (7.x) | JS plugin `tool.execute.before` | `write` {filePath, content}; `edit` {filePath, oldString, newString, replaceAll}; `apply_patch` {patchText} (with `gpt-` models, patch only) | `throw new Error(reason)` | no | high | `opencode run` (headless) may not fire; plugin API v2 breaks v1 handlers; no `cwd`. Kilo: `KILO_PURE=1` turns plugins off |
| Amp (Neo) | plugin `tool.call` | `create_file` / `edit_file` / `apply_patch`: undocumented schemas | `{action:"reject-and-continue", message}` | no | medium | In `amp -x` the turn can start before plugins load (`--plugin-ready-timeout`); order among plugins undefined |
| pi (earendil-works/pi; includes pi-grok-cli) | `tool_call` extension | `write` {path, content}; `edit` {path, edits[{oldText, newText}]} against the original | `{block:true, reason}`; an exception blocks (fail-closed) | no | medium-high | The user's `!cmd` goes through `user_bash`; extension tools with their own schema |
| community grok-cli (superagent, `grok-dev` 1.1.7) | `PreToolUse` **only for `bash`** | `write_file`/`edit_file` with no hook | exit 2 (only stderr reaches the model) | Claude-like format in user settings; does not read `.claude/` | high | Partial: requires an upstream patch (~10 lines) or pre-commit only |
| **No pre-edit hook**: Aider, Continue (infra not wired), Zed (`tool_permissions` only), Roo Code (discontinued), Junie in the IDE / AI Assistant (ACP without hooks), legacy grok-cli forks, Codex Cloud | — | — | — | — | high | **Pre-commit/CI only.** In Aider, also, `lint-cmd = pregate check` returns the reason to the model after writing |

**Dialect families.** `claude-wire` (Claude Code, Grok Build, Qwen, Factory, Copilot in PascalCase, VS Code, Devin, Junie CLI, Augment): same input and output schema with different tool names and keys, which the profile translates. `codex` and `gemini`: own dialects per command. `js-plugin` (opencode, Kilo, Amp, Cline plugin, pi): in-process JS/TS shim.

### 14.5 Caveats and design response

| Caveat | Harnesses | Response |
|---|---|---|
| **Fail-open** on timeout, crash, or invalid output | Claude Code, Grok Build, Codex, Gemini, Qwen, VS Code, Devin, Junie, Kiro, Factory, Augment, Cline (file hooks), Copilot (timeout only), Cursor (by default) | Internal watchdog well below the timeout; every decision goes out through the most robust channel; `failClosed:true` where it exists; `failMode: closed` by default; fail-closed launcher; **pre-commit and CI mandatory from the MVP** (U10); post-edit with revert where there is no pre-edit [v1.1]; `doctor` with a canary at session start |
| **Short timeout** | Grok 5 s, Junie 10 s, Copilot 30 s, VS Code 30 s | `install` pins an explicit timeout ≥ 10 s; target p95 150 ms |
| **Different timeout units and keys** | Gemini, Augment, Cline file hook (ms); Qwen (≥ 1000 = ms); Copilot (`timeoutSec`) | `install.timeoutKey` + `install.timeoutUnit` in the profile; contract test of the effective timeout |
| **`args` discarded** | Grok Build running Claude hooks | Shell form with the subcommand in `command`; binary without a subcommand ⇒ `hook auto` (§13.7) |
| **Double execution** | Grok, Cursor, VS Code, and Devin with a native adapter in addition to `.claude/settings*.json` | The Claude handler exits in silence only if the native installation is registered; Grok: `[compat.claude] hooks=false` |
| **Trimmed reason** | Grok Build (256 characters) | Self-contained first line ≤ 256; the detail, through pre-check or `explain_rule` |
| **Truncated input** | Grok Build (> 128 KiB) | `file_path` extracted from the prefix with a tolerant parser: out of scope ⇒ no objection; otherwise ⇒ `failMode` (deny), never "no objection". Message: create the file small and extend it with `search_replace` under 128 KiB |
| **`ask` unreliable or mode-dependent** | Codex (`ask` fails open), Cursor (not applied), Augment (deny only), Kiro (no JSON), Qwen (modes default/plan/auto_edit/auto/yolo; in headless or ACP it equals deny), Grok (`-p` and ACP unverified) | Profile `ask: {modes, headlessSignal, default: "deny"}` per native mode; no interactivity signal ⇒ `deny` |
| **Turn halt unreliable** | Codex (`continue:false` fails open) | `deny` with halt text + block at end of turn |
| **Native `allow` skips approvals** | Qwen, Claude Code, Copilot, Factory | Never emitted |
| **Matcher ignored** | VS Code | A single handler; the adapter filters by `tool_name` |
| **Native `tool_name` different from the Claude alias** | Grok Build (`search_replace`…), Cursor (`Write` for `Edit`) | The profile maps native names; matchers with native names (or `*` + filter) |
| **Undocumented payload** | Cursor (Write), Devin, Kiro, Amp, Copilot (`apply_patch`), Factory (Edit keys), Augment (`save-file`) | `pregate capture` + contract fixtures per version; until there is a contract, `unknown` ⇒ `failMode` |
| **Fuzzy matching by the harness** | Gemini `replace` | If the exact match fails ⇒ `unknown` ⇒ formal deny ("resend as exact replacement"); re-evaluation on `AfterTool` [v1] |
| **Args or content modifiable after the hook** | Gemini (`ModifyWithEditor`; `write_file` unescapes with non-Gemini 2/3 models) | `mayRewrite` in the profile; mandatory re-evaluation on `AfterTool` + end of turn + pre-commit |
| **Codex: exit 2 ignores stdout and JSON rejects extra keys** | Codex, Qwen (exit 2) | Codex profile: exit 2 + stderr with the reason, empty stdout |
| **Block with no feedback to the model** | Cline file hooks | Adapter as a plugin (`beforeTool` → `skip` + `reason`) |
| **Hooks that do not fire in some modes** | `opencode run`, Kiro `--no-interactive`, Codex IDE (#33413), Junie ACP, Amp `-x` | Canary in `doctor`; pre-commit and CI |
| **Off switches** | `disableAllHooks`, `GROK_CLAUDE_HOOKS_ENABLED`, `KILO_PURE`, `--yolo`, `chat.useHooks`, hook files | Paths protected by profile + shell guard (§10) |

### 14.6 Adapter plan by phase

| Phase | Adapters | Why |
|---|---|---|
| **0.2.0** | **Claude Code, Codex CLI, Cursor CLI, Grok Build, Antigravity (`agy`)** | Captured payload contracts; pure adapters, strict Codex patch parser, one registration per harness and dialect-specific denies (MULTI-HARNESS MH-01–14). Real CLI §6.3 verification is required before installation on the user's machine |
| **v1 (wave 1)** | Gemini CLI, Qwen Code, Copilot CLI | Enter with captured and verified pre-edit contracts |
| **v1.1 (wave 2)** | Factory Droid, Augment, VS Code agent mode, Devin Local/CLI, Junie CLI, Kiro | Enter with captured and verified contracts; post-edit with revert where pre-edit is unavailable |
| **v2 (wave 3)** | In-process plugins: opencode, Kilo, Amp, Cline (plugin), pi. Grok's `hashline_edit`. Copilot cloud agent. Codex IDE when #33413 is resolved (until then, post-edit with revert) | They require a JS/TS shim (it takes advantage of the core in TS) and plugin APIs with active changes |
| **Always** | pre-commit and CI [MVP] for everyone, including harnesses without a hook. Aider: `lint-cmd` guide [v1] | It is the common net against fail-open and absence of hooks, and part of the guarantee (U10) |

### 14.7 Contracts per version and capture

- `pregate capture --harness <id>` installs a record-only hook (no decision) that stores the real payloads in the PREGATE data directory. The payloads include code, so they stay local.
- A captured case becomes a **contract fixture**: `adapters/<harness>/contracts/<version>/<case>.json` with the raw payload, the expected `ProposedChange`, and the expected native output for a deny. PREGATE's CI runs them on every change.
- `doctor` compares the installed harness version with the tested versions. A version without a contract produces a warning; a payload that does not match the profile produces `failMode`.
- Each adapter's "(to verify)" items are closed with a contract, not with a reading of the documentation.

### 14.8 Harnesses without a pre-edit hook: post-edit with revert and commit net

Aider, Continue, Zed, Roo Code, Junie inside the IDE, and Codex Cloud do not have a programmable pre-edit blocking point. Others have one but without a reconstructable payload on some tools (Cursor `Write`) or with hooks that do not run in some modes (Codex IDE, #33413).

**Post-edit adapter class (revert + feedback) [v1.1] (U6).** Where there is a programmable post-edit event but no usable pre-edit, the adapter evaluates **after** writing: if there is a violation, it **reverts** the file to `before` (snapshot taken on the pre-tool if it exists, or the session one) and returns the reason to the model with "This write was reverted: …". It is weaker than pre-edit (the file existed on disk for a few milliseconds and another process could have read it), so pre-commit and CI remain mandatory.

| Harness | Post-edit event | Revert | Feedback to the model | Phase |
|---|---|---|---|---|
| Cursor | `afterFileEdit` {file_path, edits} | Yes (snapshot or git) | `agent_message` | v1.1 |
| Codex IDE (while #33413 stays open) | `PostToolUse` | Yes | `decision: block` + reason | v2 |
| opencode / Kilo / Amp | `tool.execute.after`, `file.edited` | Yes | according to the plugin API | v2 (if pre-edit is not enough) |
| Aider | `lint-cmd` after writing | **No** (feedback only; the user decides `/undo`) | yes | v1, guide |
| Continue, Zed, Roo Code, Junie in the IDE, Codex Cloud | none programmable | No | No | — |

For the harnesses in the last row, and for everyone as a net, PREGATE covers with:
- **pre-commit** (`pregate check --staged --ratchet`) [MVP];
- **CI** (`pregate check --ratchet`) [MVP minimal template; v1 SARIF and templates];
- cooperatively, the introspection MCP, which the agent can query but is not obliged to use (it is not enforcement, U4).

Exposing a validated MCP edit tool as a substitute for `Edit`/`Write` is ruled out: the agent may not use it. The product documentation says it plainly: in these harnesses, PREGATE is not a pre-write gate but a commit gate.

---

## 15. Prior art and differentiation

### 15.0 ArkGate: the previous generation (U9, U10)

ArkGate (npm `arkgate`) is by the same author and is in production on amarilla-platform as a PreToolUse hook. It is not third-party prior art: PREGATE is its evolution. The two tools can coexist, with distinct responsibilities:
- **ArkGate:** full lifecycle. Before (explore, plan, locate), during, and after (fix, coverage, CI, explain, debt reports).
- **PREGATE:** a single responsibility, that code which violates the preset never gets written. Self-sufficient and composable.

| | What |
|---|---|
| **Inherited** (what worked in production) | PreToolUse hook that denies before writing; warning ratchet on legacy; the ~240 architecture and ratchet tests in `src/test/lint` as a source of already programmed invariants and of fixtures; layers declared in configuration |
| **Generalized** | Layers and `arkrules` → presets by methodology with canonical checks and aliases; one harness → core over `ProposedChange` with adapters; one language → language packs with neutral IR; hand-written rules → Forge with a deterministic judge and a trap corpus |
| **Left out of PREGATE** (stays in ArkGate) | Reports, burn-down, coverage, prior guidance in prose, and lifecycle flows. PREGATE only keeps verification of the same invariants in pre-commit and CI, as part of the guarantee |

**Coexistence without double enforcement.** A single tool enforces a given invariant, declared in `coexist.arkgate.ownedByArkgate` (§8.3, §8.5 rule 12). In the MVP the list is manual; in v1, `pregate import arkgate` reads `arkrules/*.json` + `ark.config.json`, proposes the equivalent invariants as Forge drafts (which have to pass the judge, U2), and detects overlaps: if any has no owner, the preset does not compile. The ArkGate hook is replaced when all of its rules have an admitted equivalent in PREGATE (open question about the schedule, §19).

**Pilot pack (U8).** The `amarilla/` pack is built with the Forge using `docs/north-star`, CLAUDE.md, AGENTS.md, and the `arkrules` as input; prose is never loaded as a rule (U1). The repo's eslint-rules with a warning ratchet are candidates to be adapted as checks or to coexist (open question).

### 15.1 Other tools

| Tool | What it does | Relationship to PREGATE |
|---|---|---|
| ESLint (+ sonarjs), Biome, Ruff, PMD, Error Prone | Per-file lint with thousands of rules | Reference for semantics and thresholds. Adapters at Stop or CI and configuration export [v2]. They are not organized by methodology |
| dependency-cruiser, import-linter, ArchUnit/ArchUnitTS | Layers and cycles over the full graph | Inspiration and export [v2]. The local edge is resolved in-house (cheap, in Pre); cycles, at Stop or CI. An empty layer configuration fails closed |
| ast-grep / tree-sitter | Multi-language structural engine with YAML rules | **Reused as the engine**; patterns are embedded in `check.json` |
| SonarQube (plugin for Claude Code) | Analyzes **after** writing (PostToolUse), it is paid, and its "for Agentic AI" gate deliberately relaxes maintainability | Direct differentiation: PREGATE blocks before and prioritizes maintainability |
| CodeScene CodeHealth MCP | Single metric, no-regression, via MCP | **The ratchet idea is copied.** Difference: choosable methodologies and an enforcement the agent does not decide whether to invoke (PREGATE's MCP is optional and is not enforcement) |
| Semgrep (Guardian), Codacy Guardrails | Security focus, with hooks or MCP | Complementary; a `secure` pack could delegate to them |
| TDD Guard (now Probity, multi-harness) | PreToolUse that blocks TDD violations, validating with an LLM | Proof that "deny and self-correction" works and that the pattern carries to several harnesses. PREGATE does it deterministically and for N methodologies |
| Archie | Rules inferred from the repo by an LLM, hooks before the edit | The closest conceptual competitor. PREGATE uses rules traceable to books, with executable proof, combinable presets, and determinism |
| Factory ESLint plugin | "Agent-native" rules for JS and TS | Reusable as an optional pack |
| rulesync, Cursor rules, AGENTS.md | Prose rules in the prompt, with no enforcement | PREGATE does not generate those formats (U1, U10): it enforces. Existing prose serves as Forge input |
| Qlty, Trunk, MegaLinter | Linter orchestration in CI | They do not solve the hook's hot path or the feedback for LLMs |

### 15.2 The homegrown alternative: "why not ESLint + a 30-line hook?"

It is the real competitor: an `eslint --stdin` in PreToolUse that denies with its output.

| Axis | ESLint + homegrown hook | PREGATE |
|---|---|---|
| Rules that exist only as methodology (entity layer without ORM, immutable VO, use case with a single method, core without a clock) | You have to write your own plugins or dependency-cruiser separately; no notion of methodology | Choosable manifests; two presets block different things |
| Combining methodologies with conflicts | Manual configuration with no conflict detection | Dimensions, mandatory explicit resolution, lock with provenance |
| New rules | Plugin code with no mandatory proof | Forge: check + fixtures + trap corpus + deterministic judge |
| Legacy | Blocks on inherited debt, or you have to maintain mass suppressions | Ratchet against the session and the baseline |
| Message for the LLM | Text for humans, one rule at a time; no counterweights or loop control | All violations, compact line ≤ 256, how to fix, what to avoid, counters, escalation |
| Anti-evasion | None | Integrity pack, shell guard, end of turn against the snapshot, pre-commit |
| Several harnesses | One script per harness, each with its payload | One core, profiles per harness, contracts per version |
| Hook and CI | Separate configurations | One binary and one lock |

**If the benchmark shows that PREGATE does not beat this alternative (arm E, §16), the course changes before v1.**

### 15.3 Differentiators
1. Methodologies choosable and combinable in a JSON preset, with conflicts resolved explicitly by the human and traceability back to the book.
2. Deterministic blocking before writing, inside a latency budget.
3. Rules as data with executable proof, and a Forge where the agent proposes and PREGATE judges with no LLM of its own.
4. Messages designed for the LLM to correct itself, with loop control.
5. Ratchet against the session, which makes it adoptable in legacy repos.
6. Explicit anti-evasion.
7. The same preset and the same decisions in several harnesses, and a single source for hook, pre-commit, and CI.

### 15.4 Reuse or reimplement
- Parsers and structural matching are **not** reimplemented: tree-sitter and ast-grep are used. The Codex patch parser is ported from the open-source crate.
- These **are** written in-house:
  - the rules, as data with fixtures;
  - the neutral IR and its extractors;
  - the local layer check;
  - the ratchet;
  - the harness adapters;
  - the judge and the trap corpus.

  Everything that runs in Pre has to fit in under 150 ms and with session semantics.
- ESLint, Ruff, and Semgrep arrive in v2 as adapters at Stop or CI and as export.

### 15.5 Empirical evidence (to verify before citing it in public)
- arXiv 2605.02741 reports that the quality deterioration of generated code is not mitigated with more prompting.
- arXiv 2510.03029 finds more *code smells* as task complexity grows.
- **Counterevidence:** ResearchGate 393853113 finds fewer smells in LLM code for most problem types.
- **Implication:** position PREGATE by **architectural coherence and design contract**, not by style.

---

## 16. Success metrics and validation

### 16.1 Instrument quality (operational definitions)

| Metric | Definition | Target |
|---|---|---|
| **Precision per `deny` rule** | Real denials labeled by humans (`pregate label`) as correct, over the total | ≥ 90%; if not, the rule **leaves the catalog** (it returns to the backlog with `status: forging`) or is split into a smaller rule. It does not stay as `warn` |
| **Beneficial correction per rule** | Pairs (denied content, content finally accepted in the same file), evaluated blind: is the accepted one more maintainable? | ≥ 70% of pairs better and ≤ 15% worse; if not, the rule leaves the catalog or is split, even if it has good precision: it is gameable without improving the structure |
| **Correction in one attempt** | After a deny, the next write of the same file removes the denied violations, introduces no new ones, and **fires no EVA, shell, or scope detector** | ≥ 70% |
| **Loop** | 3 or more denials on (file, rule) with no progress | < 5 per 100 denials, and reported per session |
| `evasion_rate` | EVA, shell, scope, and request detections per 100 denials | Must drop between versions |
| `real_trap_rate` | New real traps (that a rule did not detect and that were later added as a `trap/` fixture) per 100 denials | Must drop between versions of each rule |
| `envelope_declarations` | Times the agent declared that the task does not fit the envelope and stopped, and how many the human confirmed as correct | Informative; high + confirmed = preset too strict for the repo |
| `abandonment_rate` | Tasks in which the agent stops without declaring envelope or false positive | To calibrate |
| `task_shrink` | Hidden tests that fail only in the arm with the gate | ≈ 0 |
| `thrash_ratio` | Diff size after the deny / size of the denied edit | To calibrate (a high value indicates a panic rewrite) |
| `net_catches` | Violations that reached pre-commit or CI without having been denied in the hook, per harness | Must tend to 0 in harnesses with an adapter; measures real fail-open and bypass |
| Parity between harnesses | Contract fixtures green and the same `Decision` for the same change in every supported harness | 100% |
| Forge | Admission rate, rejection reasons, promoted rules that later received a real trap | Informative; the last must drop with each corpus version |
| Tokens per resolved deny | — | To calibrate |
| `user_conflict_escalations` | Times the agent asked when faced with a conflict between the preset and an instruction | Informative |
| Latency | p50 and p95 of §13.6 on the fixture repos | It is met |

### 16.2 Value: does it improve maintainability?

**Benchmark**
- 30 to 50 tasks on TS fixture repos: greenfield, legacy with violations, bugfixes, and **multi-step refactors**.
- Between 3 and 5 runs per task and arm.
- **At least 2 models** (one high-end and one low-end), because the tendency to cheat changes between models.
- [v1] A subset is repeated on a second harness (Grok Build or Codex) to measure parity.

| Arm | Configuration |
|---|---|
| A | Unmodified harness |
| **B** | Preset rules **only in CLAUDE.md / AGENTS.md**. Critical control: if B achieves 80% of the benefit, the gate's value is the remaining 20% and it has to be demonstrated |
| C | Gate without context injection |
| D | Gate + preset summary at session start and in CLAUDE.md (generated by `pregate bench` only for the experiment; the product does not export prose) |
| **E** | **ESLint + dependency-cruiser with equivalent thresholds + a homegrown hook of about 30 lines** (§15.2) |
| F | Same rules only as additional context, without deny (inform versus block) |
| G | Same rules in the post-tool with blocking, Sonar style (before versus after) |
| H | D + pre-check (CLI in the MVP; MCP `check` in v1) |

**Experimental variables:**
- language of the message to the agent (en/es);
- presence of the line about the shell;
- counter with or without a maximum;
- [v1] full message versus only the compact 256-character line (simulates Grok Build).

**What is measured:**
- completeness (hidden tests), tokens, cost, and time;
- all the metrics of §16.1;
- deltas of the proxy metrics and of their countermetrics:
  - cognitive and cyclomatic complexity, against the proportion of trivial functions called once;
  - size, against indirection depth;
  - layer violations and cycles, against abstractions with a single implementation;
  - duplication;
  - module depth (APoSD).

**Test of the cost of the next change** (the real test of maintainability). On the output of each arm, a new agent **and** human developers do a second modification task. Success, time, diff size, and introduced defects are measured.

**Blind human evaluation:** at least 3 senior developers compare pairs A against D and E against D.

**Evasion regression set:** tasks designed to tempt each family of the trap corpus. It is run on each new version of the model, the harness, or the corpus.

**Criteria defined before running (to calibrate):**
- **D against A:** completeness drop ≤ 5 pp, cost ≤ +30%, significant improvement in the cost of the next change, human preference ≥ 60%.
- **D against B and against E:** significant improvement in layer and methodology violations, **with no** increase in fragmentation.

### 16.3 MVP go/no-go
With arms **A, B, D, and E**, 10 to 15 tasks, and 2 models, the MVP passes if:
- D beats B **and** E on layer and methodology violations;
- correction in one attempt is ≥ 70%;
- loops are < 5 per 100 denials;
- p95 is ≤ 150 ms;
- `task_shrink` ≈ 0.

If D does not beat E, the course changes before v1.

### 16.4 Adoption
These are **instrument calibration** metrics, not debt management (burn-down is ArkGate's territory, U10).
- **Local** (`pregate report`, no telemetry):
  - exceptions per 1,000 denials (if high, there are poorly calibrated rules);
  - time in `shadow` before moving to `enforce`;
  - local rules promoted by the Forge and their real-trap rate.
- **With opt-in telemetry** (if approved, §19): active repos at 30 days and precision across users.
- If there is no telemetry, they are replaced by interviews with the pilot users.

---

## 17. Risks and mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Goodhart:** the AI meets the thresholds by fragmenting or with pass-through and the code gets worse | Critical | Declared counterweights mandatory and evaluated at Stop [v1]; in the MVP, `Avoid:` text. `avoid` in every message. Trap corpus (`trivial-extract` family). Measured beneficial correction. Countermetrics in the benchmark |
| R2 | **Cheap evasion** (generated markers, `exclude`, dynamic imports, casts, weakening tests) | Critical | Integrity pack always active. `trap/` fixtures and standard corpus. Evasion regression set |
| R3 | **Laundering the ratchet:** what escapes becomes the baseline | High | `before` = session snapshot or HEAD; never the disk of the previous call. Pre-commit against HEAD and CI against the baseline |
| R4 | Blocking legitimate intermediate states of a refactor | High | Pre/Stop criterion (§5.2); the judge tests `pre` rules against a corpus of intermediate states; cycles, duplication, and counterweights only at Stop |
| R5 | Bypass through the shell, MCP, or by editing settings and state | High | Layered defense (§10). End of turn against the snapshot. ConfigChange. Hook in managed settings. Pre-commit and CI |
| R6 | Retry loops | High | All violations at once. Counters per (file, rule). "No progress" detection. `stop` escalation. Turn halt |
| R7 | **Silent gate failure** (timeout, crash, mistyped path **[V]**, absolute path of another machine, `args` discarded by another harness) | High | Watchdog. Most robust blocking channel. `failMode: closed` by default. Committed launcher with a relative path and fail-closed; binary without a subcommand ⇒ `hook auto`. `doctor`. End of turn. Pre-commit and CI |
| R8 | `ask` with no human, or in a harness where `ask` fails open, equals approval | High | `ask` only in interactive modes verified by profile and with an interactivity signal; in the others, deny + halt. Never `ask` on protected paths |
| R9 | Friction that leads to uninstalling | High (commercial) | `shadow` as an explicit calibration mode (the pilot uses it for 2 weeks). Curated presets with proposed resolutions that are confirmed in one step. Heuristic rules at `warn` until measured. Ratchet. Preset-change requests that the human applies with one command. The guarantee is **not** relaxed to lower friction: the default remains `enforce` + `failMode: closed` |
| R10 | False positives of heuristics at `deny` | Medium-high | `heuristic` starts at `warn`. Precision ≥ 0.9 to rise |
| R11 | State races with parallel hooks | Medium | Append-only events with atomic rename. Derived counters. Concurrent edits reviewed at Stop |
| R12 | Accumulated latency | Medium | Compiled binary. No global evaluation in Pre. Shell snapshot only if there is a heuristic. Migration to Rust if the p95 is not met |
| R13 | Changes in the hook contract (in Claude Code, MultiEdit is already gone and `continueOnBlock` changed in v2.1.210; in other harnesses, changes almost weekly) | Medium-high | Thin adapters with profiles as data. Contract fixtures per version. `doctor` with a version matrix |
| R14 | **Configuration friction from explicit conflicts**: the user combines methodologies and the preset does not compile until they resolve | Medium | `init` proposes each resolution with its why and the human confirms in one step. Curated presets already resolved. Error message with the exact JSON to paste |
| R15 | Imprecise TS import resolution (paths, monorepos, barrels) | Medium | A single language in the MVP. Re-exports up to 3 hops. An unresolvable import in a `core`/`port` layer is a formal deny; outside layers it is re-evaluated at Stop. False positives measured in the pilot |
| R16 | Agent content reflected in the message (injection) | Medium | Sanitization; comments and strings are never interpolated |
| R17 | Copyright and **trademarks**: book titles as manifest names | Medium | Paraphrases of 300 characters at most, no quotations, with human review. Legal review of the IDs before a public registry; alternative: descriptive IDs with the book in `source` |
| R18 | Cost of writing the catalog (400 to 900 h for v1) | Medium | 4 complete manifests in v1 and the rest in preview. Rules as data with proof; the Forge opens contribution [v2] |
| R19 | **Double enforcement with ArkGate** in the pilot: the two hooks deny the same thing with different or contradictory messages | High (pilot) | `coexist.arkgate.ownedByArkgate` with a single owner per invariant; in v1, the importer detects overlaps and the preset does not compile if any has no owner. Pilot in `shadow` until calibrated |
| R20 | **Fail-open in most harnesses** (timeout, crash, invalid output) | High | Watchdog, robust channel, `failClosed` where it exists, `failMode: closed` by default, pre-commit and CI mandatory from the MVP, post-edit with revert where there is no pre-edit, `net_catches` as a metric |
| R21 | **Undocumented or changing payloads** (Cursor, Devin, Kiro, Amp, Copilot `apply_patch`) | High | `pregate capture` + contracts per version; without a contract, `unknown` ⇒ `failMode`; those harnesses enter in later waves |
| R22 | **Truncated reason** (Grok Build: 256 characters) or truncated input (> 128 KiB) | Medium | Self-contained compact line; `truncated` ⇒ deny unless an out-of-scope path can be extracted |
| R23 | **The Forge admits a gameable rule** because the corpus did not model that trap | Medium | Human review on promotion; real traps → `trap/` fixtures → hardening; versioned corpus and re-judgment of the catalog |
| R24 | **Custom checkers of shared packs** as execution of third-party code | Medium-high | Sandbox with no I/O; hash pinned in the lock; human review; option to allow only primitives and patterns in external sources (§19) |
| R25 | **The Forge as a bypass path** (production code in drafts, "weaker" rules) | Medium | Quarantine, EVA-FORGE-001, writes only through MCP, human promotion and activation, mandatory regression |
| R26 | **MCP as an oracle** for probing gaps | Low | Accepted: the deny is already an oracle. Queries stay recorded |
| R27 | **Cost of maintaining 20+ adapters** | Medium-high | Dialect families (`claude-wire`, `codex`, `gemini`, `js-plugin`), profiles as data, waves by confidence, pre-commit/CI as universal coverage |
| R28 | A foreign harness reads `.claude/settings*.json` (Grok, Cursor, VS Code, Devin; also `settings.local.json`) and the MVP hook **fails closed** (foreign payload ⇒ `failMode`) or **fails open in silence** (Devin with a matcher that does not fire; a harness that does not expand `CLAUDE_PROJECT_DIR` and runs with another `cwd`) | Medium-high | Shell form with `${CLAUDE_PROJECT_DIR:-.}`; binary without a subcommand ⇒ `hook auto`; bounded Grok profile in the MVP (question 9); contract tests per harness; pre-commit and CI as a net |
| R29 | **Hijack of the root or of protected paths** (nested `.pregate/`, case variants, deleted snapshot) | High | `**/.pregate/**` protected at any depth; nested root accepted only if it pre-existed or the root preset declares it; case-insensitive comparison; missing snapshot ⇒ `failMode` |
| R30 | **The MVP grows beyond the spike** | Medium | MVP split into spike (demo) and evaluation (go/no-go and pilot); `computedHints`, `capture`, standard corpus, harness autodetection, and ArkGate importer, in v1 |

---

## 18. Roadmap

**Update 2026-10-03:** the phases below keep the historical vision;
they do not describe the current inventory or promised versions. The current roadmap,
with its requirements and evidence, is in [ROADMAP.md](ROADMAP.md). Five adapters, init/doctor,
Windows distribution, pinned Git packs, and per-rule shadow already exist. The delivery under review
adds a full audit, pack-composition proposals, and issue reports;
its release remains conditional on the verifications listed there.

### 18.1 MVP: spike (4 to 6 weeks, one person) + evaluation (2 to 3 weeks)

**Spike, demo criterion: "two presets, two behaviors".**
- **Core** agnostic over `ProposedChange` → `Decision` from day 1, even if there is only one adapter.
- **Adapter:** Claude Code. `Write` and `Edit` (plus `MultiEdit` ⇒ `unknown`), guard on `Bash`/`PowerShell`/`Monitor` (POSIX + PowerShell cmdlets, other harness binaries, inline environment assignments), and `Stop` gate against the snapshot of each touched root. Payload that does not match ⇒ `failMode`. Installation in shell form with a relative path and a binary without a subcommand ⇒ `hook auto`. No NotebookEdit, Post, PostToolBatch, or SubagentStop. Bounded Grok Build profile if question 9 confirms it.
- **Close of the guarantee (U10):** versioned pre-commit in `.pregate/git-hooks/` (`pregate check --staged --ratchet`, index content against HEAD) and a minimal CI template (`pregate check --ratchet`), with the same binary and the same lock on disk.
- **Language pack:** TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.mjs`). Relative imports + tsconfig `paths` + re-exports. `ERROR` nodes in the changed range ⇒ formal deny.
- **Platforms:** macOS and Linux. Engine in TS/Bun with rules as data.
- **Definitive rule format** (U1, U5): one folder per check with `check.json` and `pass`/`fail`/`trap` fixtures (written by hand, with a non-executable suffix); methodology manifests with `conflicts[]`; `$schema` for everything. `pregate rules test` (fixtures, determinism, schemas, IDs, and namespaces).
- **Sources:** `builtin` + `path` (`.pregate/rules` and local packs such as `amarilla/`), primitives and patterns only, with `rules test` mandatory at compile time (§5.4 rule 9). `engine` and `core` version verified against the binary.
- **18 invariants in 6 embedded manifests**, so the combination of methodologies is visible:
  - generic (`clean-code`): CC-FN-001 `fn-max-lines`, CC-FN-002 `fn-max-params`, CC-ER-002 no empty `catch` and no log-only;
  - `clean-architecture`: CA-DEP-001 layer direction, CA-DEP-002 no framework or ORM in the core, CA-UC-001 use case with a single public method;
  - `ddd-tactical`: DDD-VO-001 immutable VOs, DDD-ENT-001 no public setters (paths passed as a parameter);
  - `functional-core-imperative-shell`: FCIS-IO-001 core without modules with effects, FCIS-IO-002 core without clock, random, or env;
  - `tdd`: TDD-FOCUS-001 no `.only` or `.skip`, TDD-DEL-001 assertions that do not decrease (`ask` where it is reliable; otherwise, deny + halt);
  - `pregate-integrity`: EVA-GEN-001, EVA-GEN-002, EVA-SUP-001, EVA-DYN-001, EVA-CAST-001, EVA-SCOPE-001.
- **JSON preset:**
  - `engine`, `sources`, `methodologies`, `overrides` with parameters, `layers`, `scope`, `enforcement` (default `enforce`), `ratchet`, `loop`, `failMode` (default `closed`), `coexist.arkgate.ownedByArkgate`;
  - `resolve` for threshold or severity conflicts; **every unresolved conflict fails compilation** (tested with a local fixture manifest);
  - **lock on disk**; `pregate preset apply` for the agent's requests; `preset.json` always `deny` for the agent;
  - **3 example presets** (`backend-clean-ddd`, `functional-ts`, `legacy-safe`) with proposed resolutions that are confirmed.
- **`no-new` ratchet**: violations on new symbols with no compensation + count (rule, file) for pre-existing ones, against `before_session`. New files in `strict`.
- **Explicit `shadow` mode**, with a record in `state/` to label precision by hand and capture real traps.
- **Messages** with the shape of §11.1 (compact line ≤ 256 + detail; real engine output), **without `computedHints`**. Counters per (file, rule) in append-only events. "No progress" = normalized AST equal to a denied attempt or a count that does not drop. `stop` escalation. Turn halt.
- **Robustness:** exit 2 + JSON + stderr on every deny, watchdog, `failMode: closed`, fail-closed launcher with per-event output, missing snapshot ⇒ `failMode`.
- **Protection:** `**/.pregate/**` at any depth, rule folders, `**/.claude/settings*.json`, `~/.claude/settings*.json`, data directory; case-insensitive comparison where it applies. Administrative commands and other harness binaries denied in the shell.
- **CLI:** `install` (`--git-hook`, `--ci github`), `check` (includes the `--stdin --format agent` pre-check), `explain` (with `--path`), `preset show`/`compile`/`apply`, `rules test`, `bench` (internal).

**Spike demo criterion:** on a **fixture repo**, the `backend-clean-ddd` preset and the `functional-ts` preset block visibly different things, and each deny is corrected in one attempt.

**Evaluation (2 to 3 weeks after the spike).**
- **Benchmark:** arms A, B, D, and E with 2 models and the go/no-go of §16.3.
- **Pilot on amarilla-platform (U7):** explicit `enforcement: shadow` for 2 weeks, with the `amarilla/` pack written by hand from `docs/north-star`, CLAUDE.md, AGENTS.md, and the `arkrules` (U8), and `coexist.arkgate` declaring which invariants remain ArkGate's. Precision is labeled by hand on `state/` and real traps are captured as `trap/` fixtures. At the close, the non-heuristic rules that passed calibration stay at `enforce`; those that did not leave the catalog or are split.

**Out of the MVP:** MCP (introspection and Forge), standard trap corpus, `custom` checkers, `git`/`npm` sources, `computedHints`, `capture`, autodetection of the real harness, other adapters (except the bounded Grok profile, if confirmed), ArkGate importer, fingerprints per symbol, `extends`, `scopes`, `markers`, `glossary`, `init`, `doctor`, plugin, Post, PostToolBatch, ConfigChange, SubagentStop, exceptions, committed baseline, SARIF, `report`/`label`, Windows, Python.

### 18.2 v1: "adoptable design contract, in several harnesses"
- **Catalog:** **4 complete manifests** (`clean-code`, `clean-architecture`, `ddd-tactical`, `tdd`) + complete `pregate-integrity`; between 60 and 120 `deny` rules with measured precision and beneficial correction. Manifests **in preview**: `philosophy-of-software-design`, `functional-core-imperative-shell`, `ddd-strategic`, `solid`, `refactoring-smells`, `effective-typescript`, and `hexagonal`. In preview, rules **with measured precision keep `deny`** (FCIS-IO-001/002 from the MVP) and the rest stays at `warn`; `preset show` and `init` warn "this methodology today does not block N of M invariants". Choosing a preview methodology thus turns on a real block, even if incomplete. Published candidate backlog.
- **Rule Forge and MCP server** (§12): introspection (`get_active_invariants`, `check`, `explain_rule`, `get_preset_summary`), Forge tools, full judge, versioned standard trap corpus, sandbox for `custom` checkers, `pregate forge show|promote|reject|suggest`.
- **Sources:** shared packs by `git` and `npm`, pinned versions, `pregate sources update`.
- **Full preset:**
  - lock (already on disk from the MVP) with `confirmedBy` per inherited resolution;
  - `extends`, `scopes` (additive), `resolve` for stances, `dimensions.v1.json`, `pairs.json` as suggestions, `markers`, `glossary`;
  - severity ceilings (exceeding them is a compilation error);
  - importer `pregate import arkgate` and automatic detection of overlaps with ArkGate;
  - incompatibilities verified against the real files.
- **Selection UX:** `packs`, `preview`, `init`, and `/pregate:init` (with confirmation of each resolution), conflict detection with ESLint and tsconfig, `doctor`.
- **Adapters, wave 1:** Grok Build, Codex CLI (`apply_patch` parser), Gemini CLI, Qwen Code, Copilot CLI. Contracts per version.
- **Ratchet:** `no-worse` with fingerprints per symbol, matching of renames and moves, opt-in `boy-scout`, WELC options, committed baseline (no burn-down: U10).
- **Claude Code hooks:** PostToolUse with dedupe, point shell snapshot and diff, PostToolBatch, ConfigChange, SubagentStop per `agent_id`, reinjection after compaction, B-global counterweights at Stop.
- **Exceptions:** `approve` and `exceptions.json` (effective in CI with CODEOWNERS); `report` (calibration only) and `label`.
- **CI:** on top of the MVP's minimal template, SARIF output and templates (GitLab, lefthook/Husky). `lint-cmd` guide for Aider.
- **`capture`** and autodetection of the real harness by profile; `computedHints` in the messages.
- **Distribution:** Claude Code plugin; managed-settings guide per harness (handler declared directly in managed for immunity against mods in Claude Code; `requirements.toml` in Grok Build and Codex).
- **Full benchmark** (arms A–H), test of the cost of the next change, and a parity subset on a second harness.
- **Stack:** the migration to Rust is decided according to the measurements.

### 18.3 v1.1
- **Python language pack**, `effective-python` and `pragmatic-programmer` manifests.
- **Adapters, wave 2:** Factory Droid, Augment, VS Code agent mode, Devin Local/CLI, Junie CLI, Kiro, Cursor (deny only).
- **Post-edit adapter class** (revert + feedback) for harnesses without a usable pre-edit (§14.8), starting with Cursor `afterFileEdit`.
- NotebookEdit at `warn`.
- **Windows** (native launcher).

### 18.4 v2
- Catalog of about 400 entries over about 265 checks.
- More language packs: Go, Java/Kotlin (delegating to Error Prone or PMD), C#, Rust (clippy).
- **Adapters, wave 3:** in-process plugins (opencode, Kilo, Amp, Cline, pi), Grok's `hashline_edit`, Copilot cloud agent, Codex IDE.
- Adapters toward ESLint, Ruff, and Semgrep at Stop or CI; export to `eslint.config`, `.dependency-cruiser.cjs`, `.importlinter`, and `sgconfig.yml`.
- Public pack registry, with fixture and corpus verification, published precision, and legal review of names.
- Daemon, only if the measurements justify it.

### 18.5 Place of the Forge
See §12.6: format and `rules test` in the MVP; MCP, full judge, corpus, and sandbox in v1.

### 18.6 Out of scope (future, separate from the invariant product)
- **Semantic reviews with an LLM.** Outside the product (U3, decided). They are not invariants, they are not in the catalog, and they do not block.
- **Lifecycle** (U10): debt reports and burn-down, coverage, exploration, planning, prior guidance in prose (export to CLAUDE.md or AGENTS.md), and "after" flows other than verifying the same invariants. That is ArkGate's territory.
- **An LLM of PREGATE's own.** Ruled out: the user's agent supplies the Forge's generative part.

---

## 19. Open questions for the user

### They block the MVP
1. **Coexistence with ArkGate in the pilot.** Which invariants remain ArkGate's during the pilot (`ownedByArkgate`) and which move to PREGATE from day 1? Is the ArkGate hook turned off when all of its rules have an admitted equivalent in PREGATE, or do they coexist indefinitely with separate owners?
2. **`arkrules` importer.** The spec places it in v1 and, in the MVP, the `amarilla/` pack is written by hand from `docs/north-star`, CLAUDE.md, AGENTS.md, and the `arkrules`. Do you need it already in the MVP?
3. **Combinations and the `amarilla/` pack.** Besides the pilot's own pack, which `core` methodologies would you activate on amarilla-platform on day one ("Clean Architecture + Clean Code + TDD", for example)? That defines the pilot preset and validates the MVP's 6 manifests.
4. **The pilot's eslint-rules with a warning ratchet.** Does PREGATE adopt their thresholds as overrides, turn them into checks of the `amarilla/` pack through the Forge, or do they coexist untouched?
5. **Escalation.** After N rejections, do you prefer the AI to stop and notify you (`stop`, the proposed default) or to ask you at the moment (`ask`)?
6. **`failMode: ask` as opt-in.** U10 pins `closed` by default. Do you want to keep `ask` as an explicit option for interactive sessions (a human decides whether to let through something PREGATE could not evaluate), or remove it entirely?
7. **Stack.** Do you confirm TypeScript/Bun for the MVP, with migration to Rust only if latency requires it?
8. **Calibration in the pilot.** The spec uses explicit `shadow` for 2 weeks on amarilla-platform (because of coexistence with ArkGate and to measure precision) and `enforce` as the default everywhere else. Does that work for you, or do you want to block in the pilot from day 1?
9. **Grok Build in the MVP.** Grok reads `.claude/settings.json`: without its own profile, the MVP hook fails closed on every edit. Does anyone on the pilot team use Grok Build? If yes, the spec recommends including in the MVP a bounded profile (`write`, `search_replace`, and shell; the rest ⇒ `failMode`). The same applies, with no profile in the MVP, to Cursor, VS Code, and Devin.
10. **U2, operational interpretation.** Do you confirm the Forge as §12 describes it (the agent proposes via MCP, a deterministic judge with a trap corpus, the human promotes and activates through the CLI) and its arrival in v1, with the rule format and `rules test` already in the MVP?

### For v1 onward
11. **Target user after the pilot.** The pilot is a company repo with a team. Does v1 aim at teams (CODEOWNERS, managed settings) or does it keep prioritizing the individual dev?
12. **Who writes the catalog** (400 to 900 h for v1): you, a team, the community, or a combination.
13. **Order of adapter wave 1.** The proposal is Grok Build, Codex CLI, Gemini CLI, Qwen Code, and Copilot CLI. Which does your team use, so it can be prioritized?
14. **Exceptions.** Who approves them in your context? Is `expires` mandatory or optional?
15. **Shell bypass.** `flag` (block and notify) or `revert` (automatically undo shell writes that violate rules)?
16. **Third-party checkers.** Can shared packs bring `custom` checkers (in a sandbox), or only primitives and patterns?
17. **Forge drafts.** Are they committed (to review them in a PR) or do they stay out of git?
18. **Opt-in telemetry** with anonymized denials to measure precision across users: yes or no?
19. **License and business model:** open source (MIT or Apache) with a community catalog, open core, or a paid product. Does anything change because of the relationship with ArkGate?
20. **Manifest names.** Do we use book titles (`clean-code`) or descriptive IDs (`small-functions`, `dependency-rule`) with the book as source? It affects legal risk.
21. **`$schema` domain** and the plugin's distribution channel (own marketplace or public).

(The language of messages to the agent is not asked: it is measured in the benchmark, §16.2. These are no longer asked, because they are decided: the reformulation of "100% maintainable" (the vision pins it), the deterministic-only catalog (U3), the initial language (TS, U6), the need for multi-harness (U6), whether the AI can activate rules (U4), the pilot repo (U7), the prevention-only scope with pre-commit/CI as part of the guarantee (U10), and the tagline (U11).)

---

## Appendix A. User decisions (U1–U11)

They override the rest of the document. In `docs/inputs/decisiones-usuario.md` they appear as D1–D11; here they are renamed so they do not clash with the design decisions.

| # | Decision | Text | Status | Where it applies |
|---|---|---|---|---|
| **U1** | Rules are JSON, not markdown | Users do not write rules in prose (CLAUDE.md style or Cursor rules). They build rules in JSON | **Decided** (2026-10-01) | §2, §5.4, §6, §7.3, §12.3 |
| **U2** | Rule Forge: the invariant is programmed first, then the rule exists | If the user is missing an invariant, a PREGATE tool helps them write it. First, how the practice becomes an invariant is programmed (what it observes, when it fails, how it is verified) and only when that is demonstrated does the rule enter. No executable proof, no rule | **Decided.** Operational interpretation proposed in §12, **to confirm** (question 10) | §5.4 (rule 9), §6, §12 |
| **U3** | Deterministic invariants only | The catalog contains only deterministic binary rules. Judgment practices (former level C) stay outside the catalog, in a candidate backlog that the forge tries to make verifiable | **Decided** (2026-10-01): option A | §1, §2, §5.2, §5.5, §18.6 |
| **U4** | PREGATE MCP: authorship + introspection, never enforcement | The Forge lives as MCP: the agent supplies the creative part and the MCP the deterministic judge. PREGATE needs no LLM or API key. Introspection: `get_active_invariants(path)`, `check(diff)`, `explain_rule(id)`. The agent can propose rules, never activate them; activating in the preset is a human act (CLI). The hook protects `.pregate/` (preset, local catalog, exceptions). The agent's fixtures are not enough: a standard trap corpus also runs and admission shows the human the fixtures and the checker. Ruled out: MCP tools to suppress, deactivate, or edit rules or the preset, and MCP as enforcement. One core, three faces: hook, CLI, MCP | **Decided** | §2, §8.1, §8.6, §10, §12, §13.1 |
| **U5** | Where the rules live and in what format | One folder per rule with `rule.json` (+ `$schema`), `fixtures/{pass,fail,trap}/`, and optional `checker.*`. Grouping by area. Methodology = manifest that references IDs + defaults + known conflicts. Layered sources declared in the preset (built-in → shared packs path/git/npm → `.pregate/rules/`). Namespaced IDs; no silent shadowing (explicit overrides or own ID). Editing = new semver version with fixture regression; real traps → `trap/` and hardening. Versions pinned in the preset. Protected rule folders | **Decided** (user proposal incorporated). **Documented deviation:** the U5 "rule" is the canonical check (`check.json` + fixtures); the methodology alias lives in the manifest, with optional own fixtures (§5.3, §6.2). The "known conflicts" are the manifest's `conflicts[]`, as suggestions only | §5.3, §5.4, §6, §8 |
| **U6** | Multi-language and multi-harness; start with TS | Core agnostic of harness and language over `ProposedChange` → `Decision`. Harness adapters (Claude Code first); harness without a pre-edit hook: post-edit fallback (revert + feedback) and, as a universal net, pre-commit and CI with the same core. Language packs with tree-sitter + extractors toward a neutral IR; rules over the IR are portable; idiomatic ones in the pack. MVP: TS/JS pack + Claude Code adapter | **Decided** | §4, §13, §14 (post-edit in §14.8), §18 |
| **U7** | Pilot repo | `Amarilla-David/amarilla-platform` (private): mostly TypeScript, also JS, PLpgSQL, Python, C#, and HTML. Large, live repo: the legacy ratchet is critical | **Decided** | §1, §3, §8.4 (example 4), §9, §18.1 |
| **U8** | Custom pack for the pilot | The rules that already live in the pilot (`docs/north-star`, CLAUDE.md, AGENTS.md, `arkrules`) are used to build the `amarilla/` pack. The repo already uses ArkGate as PreToolUse, has eslint-rules with a warning ratchet, and ~240 architecture tests | **Decided** | §6.5, §12.3, §15.0, §18.1 |
| **U9** | PREGATE is the evolution of ArkGate | ArkGate is the previous generation, not third-party prior art. What is inherited, what is generalized, and what is left out is documented. Migration: importer `arkrules/*.json` + `ark.config.json`; temporary coexistence without double enforcement until the ArkGate hook is replaced | **Decided** | §8.3 (`coexist`), §8.5 (rule 12), §13.8, §15.0 |
| **U10** | PREGATE is prevention only; fail-closed | A single responsibility: that code which violates the preset never gets written. Self-sufficient and composable with ArkGate. Fail-closed by default; unverifiable input (truncated, unknown payload, parser failure) ⇒ deny, never allow. No reports, burn-down, coverage, or lifecycle (ArkGate's territory). **Confirmed:** the close in pre-commit/CI runs exactly the same invariants, with the same binary and the same preset/lock, as part of the guarantee | **Decided** (2026-10-01) | §1, §2, §4.4, §6.5, §8.3, §9, §10, §13.6, §18 |
| **U11** | Tagline | "A prevention gate for bad code and bad architecture. If it breaks your invariants, it never gets written." Alternative: "Bad code and bad architecture don't get written. Not reviewed later — never written." | **Decided** (in English) | Header |

---

## Appendix B. Design decision log (DD)

DD-01 through DD-46 keep the numbering of the v1 draft (former D1–D46). Those marked **(updated)** changed to align with U1–U11 and the vision. DD-47 onward are new; DD-66 onward come from the v2.1 review.

| # | Decision | Why |
|---|---|---|
| DD-01 **(updated)** | The guarantee is fail-closed hook + pre-commit + CI with the same binary and the same lock; the hook is the primary enforcement | U10. Several harnesses fail open and the agent has local permissions, so the hook alone is not enough; against an adversary with local permissions, the net is CI with CODEOWNERS |
| DD-02 **(updated)** | The catalog contains only binary, deterministic rules; judgment practices go to a candidate backlog; LLM reviews stay outside the product | "A rule the agent can win without improving the structure does not stay". LLMs are not deterministic, they admit injection, and they reward retrying with no changes. U3 (decided) |
| DD-03 **(updated)** | Canonical checks (one folder per check, grouped by area) referenced by aliases inside methodology manifests | 35% of the rules repeat with another threshold; a check can belong to several methodologies (U5) |
| DD-04 | Parameters belong to the check; one effective rule per (check, scope, instance) | Avoids inconsistent parameter names and duplicate violations for the same fact |
| DD-05 **(updated)** | Dimensions in a closed enum; **every conflict (threshold, stance, or severity) requires an explicit resolution in the preset or it does not compile**; `pairs.json` and `conflicts[]` only suggest; inherited resolutions are confirmed | "If two methodologies disagree, the preset says so and the user resolves; the agent is not left to choose the easier side". The `precedence` default is removed |
| DD-06 **(updated)** | Explicit precedence order (scope overrides > global overrides > resolve > single alias) with no implicit precedence between methodologies; an override that exceeds a severity ceiling is a compilation error | Predictable and auditable in the lock; the order of `methodologies` decides nothing and nothing is clipped in silence |
| DD-07 **(updated)** | Sources with exact versions pinned in the preset and hash in the lock; no ranges | Reproducibility across sessions, agents, and harnesses (U5) |
| DD-08 | The ratchet's "before" is the session snapshot or HEAD, not the previous disk | With the disk, any escape is laundered and tolerance accumulates |
| DD-09 **(updated)** | MVP with a ratchet by new symbols with no compensation + count (rule, file) for pre-existing ones; fingerprints in v1 | A pure count let a new function through offset by a legacy one, exactly the pilot's critical case (U7) |
| DD-10 | Fingerprints matched by symbol and by normalized-body hash | A legitimate rename cannot look like a new violation |
| DD-11 | Counters per (harness, session, agent, file, rule), with no symbol | Renaming or extracting must not reset the retry cap |
| DD-12 | Default escalation `stop` (deny + halt); `ask` optional | `ask` rewards persistence and the agent does not see its reason |
| DD-13 **(updated)** | `ask` only in interactive modes verified by profile and with an interactivity signal; never on protected paths; in the others, deny + halt | In bypass, dontAsk, `-p`, subagents, or harnesses such as Codex, `ask` could equal approval |
| DD-14 | The circuit breaker halts the turn and never relaxes to `warn` | Relaxing rewarded the most stuck agent with a free pass |
| DD-15 **(updated)** | Every deny goes out through the harness's most robust channel (in Claude Code, exit 2 + JSON + the same reason on stderr; in Codex, exit 2 + stderr with empty stdout) | **[V]** Exit 2 blocks even with invalid JSON, and then the reason comes from stderr; exit 0 with truncated JSON lets it through |
| DD-16 **(updated)** | Committed launcher, invoked in shell form with a path relative to the repo, that fails closed (with per-event output) if the binary is missing; binary without a subcommand ⇒ `hook auto` | **[V]** A broken path or an exit 127 turns the gate off in silence; an absolute path does not exist on another machine; Grok discards `args` |
| DD-17 **(updated)** | `failMode: closed` by default; `ask` opt-in only where it is reliable; `open-with-recheck` removed | U10: unverifiable input ⇒ deny, never allow |
| DD-18 | Shell guard and end-of-turn gate inside the MVP | Without them, the gate is dodged in one line and the MVP cannot measure anything |
| DD-19 | Shell snapshot only if the heuristic matches; the robust defense is the end of the turn | `git status` on every command breaks the budget on large repos |
| DD-20 **(updated)** | Integrity pack always active; known evasions are `trap/` fixtures and families of the standard corpus | Cheap evasions appear at the first deny; fixtures replace `knownEvasions` (U5) |
| DD-21 **(updated)** | Generated markers and `exclude` count only if they already existed, and they never exempt an agent edit of that file (EVA-GEN-002) | Otherwise the agent exempts itself, or writes domain logic in a generated file that was already there |
| DD-22 **(updated)** | Counterweights at Stop [v1], as a session delta, never deny per call; in the MVP only as `Avoid:` text | They need the call graph and they contradict Extract Function itself |
| DD-23 **(updated)** | Satisfiability proven with `pass` fixtures in the catalog and in the judge; warning in the compiler (not an error) | An impossible combination guarantees loops, but failing would block legitimate custom thresholds |
| DD-24 | Messages with no proposed identifiers and with ranges computed by the engine | A deterministic engine cannot invent domain names |
| DD-25 | All violations listed (5 in detail, the rest in one line) | You cannot ask to "fix them all" if they are not all visible |
| DD-26 | Sanitization of what is reflected in the message | An identifier or string written by the agent could speak with "the hook's voice" |
| DD-27 | `warn` only for introduced violations | Warning about inherited debt pushes changes out of scope |
| DD-28 | State in append-only events per call | **[V]** Hooks run in parallel; read-modify-write loses increments |
| DD-29 | Layers decided by the resolved path, following re-exports; dynamic import denied in the core | Closes barrels and `import()` as a bypass, and works with files that do not exist yet |
| DD-30 **(updated)** | `enforce` by default; `shadow` only as an explicit calibration mode (pilot, coexistence with ArkGate) | U10 ("no matter what"). Non-heuristic rules are `deny` by construction; the ≥ 90% applies to heuristics and, as monitoring, to all of them |
| DD-31 | Agent: messages in English by default; human: in their language | The catalog is written once; the real effect of language is measured |
| DD-32 | MVP in TS/Bun with rules as data; Rust conditioned on latency | Time to first value; the rules survive an engine change; harnesses with JS plugins can load the core in-process |
| DD-33 | MVP with 18 rules (12 methodology, 6 integrity), mostly methodology, not generic | 6 of the 8 checks of an earlier version were already in ESLint; the value is the combination of methodologies |
| DD-34 | Arm E (ESLint + homegrown hook) in the go/no-go | It is the real competitor; if it is not beaten, there is no product |
| DD-35 | v1 with 4 complete manifests and the rest in preview | More complete manifests did not fit in 60–120 rules or in the writing cost |
| DD-36 | Primary MVP user: individual dev or small TS team | That is who asked for the tool; the organizational part is deferred |
| DD-37 **(updated)** | `preset.json` is always `deny` for the agent; it proposes changes as a JSON patch in `.pregate/requests/` and the human applies them with `pregate preset apply`. Lock, baseline, exceptions, and rule folders: never | U4: activating is a human act through the CLI. It is not verified that `ask` forces the prompt in every mode, and a click in the middle of the task would be negotiating the rule |
| DD-38 | Local exceptions best-effort; effective in CI only with CODEOWNERS | TTY and denylists are faked locally; honesty is required |
| DD-39 | Immunity against mods in Claude Code only with the handler declared in managed settings | **[V]** The documented exception is "hook in managed settings", not a forced plugin |
| DD-40 **(updated)** | ConfigChange and hook-configuration paths of each harness protected | `disableAllHooks`, disabling plugins, or editing hook files turned the gate off without touching the code |
| DD-41 | SubagentStop evaluates only the files of its `agent_id` | A subagent must not be blocked by someone else's changes |
| DD-42 | Post emits only what was not reported and asks to fix forward | Avoids duplicate feedback and panic reversions through git or shell |
| DD-43 **(updated)** | Requests (`.pregate/requests/`, or the equivalent MCP tool) do not count as a resolution and activate nothing | It was a cheaper exit than correcting |
| DD-44 **(updated)** | The tool input is never rewritten (`updatedInput`, `modifiedArgs`, mutating `args`) in any harness | **[V]** In Claude Code it replaces the entire input and the winner among hooks is not deterministic; in other harnesses it has documented bugs |
| DD-45 | `MultiEdit` in the Claude Code matcher for compatibility only | **[V]** It does not appear in the current tools; including it breaks nothing |
| DD-46 | Paraphrases with human review, with no automatic comparison against the books | Processing the full texts would itself be a copyright problem |
| DD-47 | Core agnostic over `ProposedChange` → `Decision` **from the MVP**; multi-harness is designed from day 1 even though the MVP only brings the Claude Code adapter | U6. Replaces "other harnesses in v2" of the draft |
| DD-48 | The adapter never emits a native allow; "no objection" is silence | In Qwen, Claude Code, and Copilot, `allow` skips the user's approval |
| DD-49 | First line of the reason ≤ 256 characters and self-contained | **[V]** Grok Build trims the reason to 256 characters |
| DD-50 | `reconstruction: unknown \| truncated` never produces "no objection" | **[V]** Grok truncates inputs > 128 KiB; Gemini applies fuzzy matching; VS Code uses placeholders |
| DD-51 | Harness profiles as data + contract fixtures per version + `pregate capture` | Payloads change almost weekly and several are undocumented |
| DD-52 **(updated)** | Versioned pre-commit and minimal CI template inside the MVP, with the lock on disk | U10: the close in pre-commit/CI with the same binary and the same lock is part of the guarantee |
| DD-53 | Adapters by waves according to confidence: v1 Grok Build, Codex, Gemini, Qwen, Copilot CLI; v1.1 the Claude-format ones in preview; v2 the in-process plugins | Reliable blocking and verified payloads first; they cover the three edit shapes |
| DD-54 | One folder per check with `check.json` + `pass`/`fail`/`trap` fixtures; methodologies as manifests; grouping by area | U1, U5. The rule travels with its proof |
| DD-55 | Layered sources with namespaces; no silent shadowing; changes through explicit `overrides` or a new check with `derivedFrom` | U5. Layer order does not resolve clashes |
| DD-56 | Semver versioning per check and manifest; append-only fixtures; mandatory regression | Weakening a rule without it being noticed is impossible by construction |
| DD-57 | Standard trap corpus with a structural property preserved per transformation | Makes "gameable without improving the structure" verifiable in a deterministic way |
| DD-58 | Forge via MCP: the agent proposes, the judge decides, the human promotes and activates; no LLM of its own | U2, U4 |
| DD-59 **(updated)** | Forge, MCP, and standard corpus in v1; rule format, `rules test`, and hand-written `trap/` fixtures in the MVP | The format is proven first with the catalog itself; real traps appear in the pilot; the MVP cannot grow beyond the spike |
| DD-60 | Forge drafts in quarantine, written only by MCP tools; EVA-FORGE-001 | They contain code that violates rules on purpose and cannot be a bypass path |
| DD-61 | `custom` checkers only with justification and in a deterministic sandbox with no I/O | Determinism and safety against third-party code |
| DD-62 | The MCP has no tools to suppress, deactivate, or edit rules or the preset, and it is not enforcement | U4 |
| DD-63 | `methodologies` separate from `extends`; `overrides` only on active invariants; loose invariants via a local manifest | "The user does not choose loose rules"; every active rule keeps a source |
| DD-64 | Language packs with IR by capabilities; rules over the IR portable, idiomatic ones in the pack | U6 |
| DD-65 | Every active invariant arrives through an alias with `source` | "The rule has four things", and one of them is which source it comes from |
| DD-66 | `tool-will-fail` ⇒ formal deny without consuming a counter; `emptyOld` declared by profile | Denying costs nothing (the tool was going to fail) and closes the TOCTOU and the empty `old_string` case that creates files |
| DD-67 | `ERROR` nodes in the changed range ⇒ formal deny; unresolvable import in a `core`/`port` layer ⇒ formal deny | U10 (parser failure ⇒ deny); closes the evasion of code that tsc accepts and tree-sitter does not parse |
| DD-68 | `**/.pregate/**` protected at any depth; nested root accepted only if it pre-existed or the root preset declares it; case-insensitive comparison on volumes that do not distinguish case | A nested `.pregate/` written by the agent hijacked the root of its subtree |
| DD-69 | Every non-builtin source needs proof at compile time: judge report (v1) or `rules test` green (MVP) | U2: no executable proof, no rule; a hash is integrity, not proof |
| DD-70 | Exact `engine` in the preset; a different engine or `core` version ⇒ `failMode` and exit ≠ 0 in `check` | U10: same binary, same lock |
| DD-71 | `measures` in `check.json`: a corpus transformation counts as a trap only if it preserves a property the check measures | Without this, `trivial-extract` rejected the size rules themselves |
| DD-72 | Fixtures with a non-executable suffix; `.pregate/**` always out of scope and in the project's excludes | `fail`/`trap` fixtures contain violating code (a `.only` focused the whole suite) |
| DD-73 | Integrity absorbs the methodology alias on the same check (maximum severity, a single violation); every other severity difference is a conflict | Integrity cannot be lowered; the preset decides the rest |
| DD-74 | Coexistence with ArkGate through `coexist.arkgate.ownedByArkgate` (manual MVP; v1 through the importer with overlap detection) | U9, U10: composable, with no double enforcement and no owner chosen in silence |
| DD-75 | No prose `export`, no burn-down or debt reports; `report` only calibrates the instrument | U1, U10: ArkGate's territory |
| DD-76 | Post-edit adapter class (revert + feedback) in v1.1 for harnesses without a usable pre-edit; the MCP edit tool as a substitute is ruled out | U6; MCP is not enforcement (U4) |
| DD-77 | Timeout units and keys per profile (`timeoutKey`, `timeoutUnit`) with a contract test | A `10` in ms is 10 ms: fail-open on every call |
| DD-78 | `ask` modeled by native mode and interactivity signal (`ask.modes`, `ask.headlessSignal`) instead of a boolean | The reliability of `ask` depends on the mode and on whether the session is headless |
| DD-79 | Snapshot per (session, root); Stop over every touched root; re-evaluation with background tasks; missing snapshot ⇒ `failMode` | Worktrees and background processes escaped Stop; deleting the snapshot laundered the ratchet |
| DD-80 | Shell guard also on `Monitor`, other harness binaries, and inline environment assignments | An agent could launch another agent without hooks |
| DD-81 | MVP split into spike (demo on a fixture repo) and evaluation (go/no-go and pilot in `shadow`) | The scope had grown for the same deadline; the real pilot does not fit the demo presets |

---

## Appendix C. Changes relative to the v1 draft

1. **Summary sentence and vision frame** at the start; "100% maintainable = 100% conformant to the preset"; "the agent does not negotiate the rule"; "the preset travels with the project"; the four things of a rule mapped to JSON fields.
2. **Level C out of the catalog** (U3, decided): candidate backlog in JSON; LLM reviews outside the product.
3. **Rule format and layout** (U1, U5): folder per check, `pass`/`fail`/`trap` fixtures that replace `examples` and `knownEvasions`, methodology manifests, layered sources with namespaces, versioning, and regression. New §6.
4. **Conflicts:** `conflictPolicy` and the `precedence` default are removed; every conflict requires `resolve` or the preset does not compile; `pairs.json` only suggests. Preset examples rewritten.
5. **Preset:** `methodologies` separate from `extends`; `sources`; `overrides` instead of `rules`; no `severityByLevel` for C and no `reviews`.
6. **Rule Forge and MCP** (U2, U4): new §12, in v1, with a deterministic judge and a standard trap corpus.
7. **Multi-harness and multi-language from the design** (U6): `ProposedChange`/`Decision`, three edit shapes, language packs with IR by capabilities. New §14 with the harness matrix, caveats, and plan by waves.
8. **Minimal pre-commit in the MVP** as a net against fail-open.
9. **Numbering:** U1–U11 (Appendix A) and DD-01… (Appendix B); open questions updated.

### Changes of the v2.1 review (fidelity critiques, harness technique, and coherence)

10. **Complete user decisions:** U3 becomes decided; U7 (pilot repo), U8 (`amarilla/` pack), U9 (evolution of ArkGate), U10 (prevention only, fail-closed, pre-commit/CI as part of the guarantee), and U11 (tagline) are incorporated. New §15.0 on ArkGate and coexistence without double enforcement (`coexist`).
11. **Fail-closed (U10):** `failMode: closed` by default, `open-with-recheck` removed, syntax errors in the changed range and unresolvable imports in core layers ⇒ formal deny, `tool-will-fail` ⇒ formal deny, `enforce` as the default and `shadow` only explicit.
12. **Human activation (U4):** `preset.json` always `deny`; JSON-patch requests + `pregate preset apply`.
13. **Mandatory proof (U2):** every non-builtin source passes `rules test` or brings a judge report; rules that do not reach quality leave the catalog instead of staying at `warn`; IDs that look like judgment rewritten or moved to candidates.
14. **No lifecycle (U10):** prose `export`, burn-down, and debt reports are out.
15. **Technical hardening:** installation in shell form with a relative path, binary without a subcommand ⇒ `hook auto`, protection of `**/.pregate/**` and case-insensitive comparison, `Monitor` and other harness binaries in the guard, MVP state and snapshot defined and protected, `engine` pinned, lock on disk from the MVP, `measures` in the judge, non-executable fixtures, corrected `ProposedChange` contract (`change.kind`, `insert`, `pathBase`, synthetic `callId`), timeout units, `ask` by mode, post-edit with revert (v1.1), worktrees and background tasks at Stop, versioned pre-commit.
16. **Coherence:** UC7 in v1, counterweights in v1, preset examples corrected and consistent (plus a pilot example), MVP of 18 rules split into spike + evaluation, MVP ratchet with no compensation for new symbols, FCIS-IO-001/002 at `deny` in v1 as well.
