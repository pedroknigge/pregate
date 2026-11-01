# pstack & Installed Skills Invariants Catalog (113 Rules)

This document integrates the complete 113 invariant rules converted from Lauren Tan's **pstack** principles, playbooks, operational skills, and installed workspace skills.

---

## Part A: pstack Principles (1–23)

### Core
1. **PS-01 (Laziness protocol):** The merged change is the smallest diff that solves the stated problem. Dead code, unused abstractions, and speculative generality are absent. *(Enforced: `maintainability/MAINT-EMPTY-001` & diff minimization)*
2. **PS-02 (Foundational thinking):** Core types, data structures, and the sharing relation among concurrent actors are fixed before behavioral logic is written.
3. **PS-03 (Redesign from first principles):** A new requirement is integrated as if it had been a foundational assumption from day one. It is not bolted onto the previous shape.
4. **PS-04 (Attack the premise):** After two or more fixes that share one premise fail the same gate, the premise is rejected before another patch that assumes it is written.
5. **PS-05 (Subtract before you add):** Dead weight, redundant validators, and stub references are removed before new structure is built on what remains. *(Enforced: `musk/MUSK-DEL-001`)*
6. **PS-06 (Minimize reader load):** The number of layers between a question and its answer is minimal. One-caller wrappers are collapsed. Mutable state a reader must hold in their head is absent. *(Enforced: `pstack/PS-LET-001`)*
7. **PS-07 (Outcome-oriented execution):** A planned rewrite converges on the target architecture. Throwaway compatibility states are not preserved to keep intermediate diffs smooth.
8. **PS-08 (Experience first):** When implementation convenience conflicts with the consumer’s experience, the consumer wins. Fewer polished capabilities ship in preference to more rough ones.
9. **PS-09 (Exhaust the design space):** Where no precedent decides the design, two or three competing prototypes are compared before a commitment.
10. **PS-10 (Build the lever):** Non-trivial edits, migrations, analyses, and checks are performed by a rerunnable tool — codemod, script, generator, or skill — not by unreproducible hand work.

### Architecture
11. **PS-11 (Model the domain):** A repeated domain rule lives in one structure — a state machine, a typed model, a table — not in scattered conditionals.
12. **PS-12 (Boundary discipline):** Guards, parsing, and validation sit at system boundaries (CLI, config, network, external APIs). Internal business logic is pure and trusts its types. *(AST slice: `pstack/PS-ZOD-001`; other boundaries need review)*
13. **PS-13 (Type-system discipline):** Illegal states are unrepresentable. Semantic primitives are branded. External data is parsed at the boundary. Variants are exhaustive. The compiler is not lied to. *(AST slices: `pstack/PS-AS-001` and `pstack/PS-PARTIAL-001`)*
14. **PS-14 (Idempotent operations):** A retried or partially rerun operation converges to the same end state as a single successful run. *(Enforced: `pstack/PS-IDEM-001`)*
15. **PS-15 (Migrate callers, then delete):** Callers of a legacy API are migrated and the old API is deleted in the same wave. A compatibility layer is not the resting state. *(Enforced: `pstack/PS-LEGACY-001`)*
16. **PS-16 (Separate before serializing):** Shared mutable state is eliminated before coordination is added. Serialization is introduced only when a single shared writer is a real invariant.

### Verification
17. **PS-17 (Prove it works):** A task is not done until the real artifact has been exercised — the feature run, the value read, the diff inspected.
18. **PS-18 (Fix root causes):** A defect is reproduced and traced to its cause before code changes. A nil-check or guard whose only effect is to silence the crash is absent.
19. **PS-19 (Sequence verifiable units):** Multi-step work is broken into units that each end in a checked state. The next unit does not start until the current unit is verified.
20. **PS-20 (Test behavior, not implementation):** A test calls the code as its user does and asserts an observed value against a literal expectation. *(AST slices: `pstack/PS-WEAK-001` and `pstack/PS-EXPECT-001`; observed behavior needs review)*

### Delegation and meta
21. **PS-21 (Guard the context window):** Bulk evidence is routed to a subagent. The coordinating thread holds the summary, not the raw payload.
22. **PS-22 (Never block on the human):** Reversible work proceeds and the result is presented. Confirmation is reserved for irreversible actions.
23. **PS-23 (Encode lessons in structure):** A lesson that has fired twice is encoded as a lint, a metadata flag, a runtime check, or a script. It is not left as additional prose.

---

## Part B: pstack Operational Skills (24–47)

24. **poteto-mode:** Every non-trivial task is routed through a named playbook. The playbook’s steps are copied into the working list before reasoning begins.
25. **how:** An explanation of a subsystem is grounded in the code path that implements it, not in recollection.
26. **why:** A claim about why something was built cites evidence from the record — commits, issues, decision records — not an unsupported assertion.
27. **recall:** Resumed work rebuilds recent context on the topic from the repository and the session record before new edits start.
28. **blast-radius:** The safety of a small-looking change is established by executing the code it can affect, not by asserting locality.
29. **architect:** Types, caller usage, and module shape are settled before code that crosses a function boundary is written.
30. **arena:** N parallel attempts at the same problem are reduced to one selected result. Competing diffs are not left as the deliverable.
31. **swarm:** N parallel workers on distinct slices or races produce one aggregated report.
32. **interrogate:** A diff is attacked by an independent reviewer before it is called done.
33. **automate-me:** A personal mode skill is drafted from observed working patterns, not from an invented persona.
34. **make-bot-ui:** A control surface that wakes an agent does so over an explicit webhook contract.
35. **setup-pstack:** Model assignment per role is written in one rule file. An unstated role keeps its default.
36. **reflect:** A finished hard task updates the skill or check that would have prevented the miss.
37. **teach:** A teaching pass leaves the reader able to reconstruct the change.
38. **tdd:** A bug fix on a cheap local test path has a test that failed before the fix and passes after it.
39. **no-comments:** Comments that restate the code are absent at review. *(AST slice: `pstack/PS-COMMENT-001`; meaning needs review)*
40. **typescript-best-practices:** TypeScript edits obey type-system discipline in syntax: no escaped `any`, exhaustive unions, parsed boundaries. *(Enforced: `typescript/TS-ANY-001`)*
41. **figure-it-out:** When no bundled playbook fits, a rigorous auditable playbook is designed for the task before execution.
42. **show-me-your-work:** Decisions of a non-trivial task are logged in a reviewable trail a later reader can open.
43. **create-verification-skill:** A project with no scripted proof of app behavior gains a project-local verify skill before “done” is claimed.
44. **maintain-verification-skill:** A verify skill whose feature map has drifted from the app is updated from source plus one live pass.
45. **unslop:** Delivered prose and code contain no filler a maintainer would have to delete to recover the claim.
46. **bro:** A restatement in plain language preserves the claim and drops the jargon.
47. **technical-writing:** Docs, RFCs, READMEs, PR descriptions, and commit messages follow a layered standard: claim, evidence, consequence.

---

## Part C: pstack Playbooks (48–70)

48. **Investigation** is read-only. It answers how, why, or whether, and it does not edit.
49. **Bug fix** reproduces the defect, names the root cause, and fixes it against runtime evidence.
50. **Performance** traces a measured slowness and reports the change against a baseline.
51. **Hill climb** improves one metric against a target by hypotheses with before-and-after measurement.
52. **Runtime forensics** diagnoses a live symptom from instrumentation, not from a guessed patch.
53. **Trace forensics** diagnoses a captured profile, trace, spindump, or heap snapshot.
54. **Feature** builds new or changed behavior from a named data shape.
55. **Refactoring** preserves observable behavior. A refactor that changes behavior is a feature or a bug fix.
56. **Prototype** is throwaway. Its product is a decision. It does not enter production without a rewrite.
57. **Visual parity** claims pixel-exact equivalence only after both implementations have been compared.
58. **Authoring a skill** produces a `SKILL.md` whose trigger, steps, and exit criteria a later agent can follow.
59. **Eval** tests a skill or prompt change with a blinded comparison.
60. **Babysit** drives a PR or a stack to merge-ready: conflicts, review threads, and CI are closed or deferred.
61. **Shipping** independently verifies a green stack, then lands the contiguous verified run bottom-up.
62. **Autonomous run** drives a long task to completion without stopping for reversible choices.
63. **Orchestrate** assigns a multi-day project to one coordinator.
64. **Autopilot full** runs independent PRs to merged with one owner per PR.
65. **Autopilot stack** builds and verifies one linear stack for the operator to review and land.
66. **Session pickup** resumes in-flight work from the recorded state, not from a reconstructed guess.
67. **Pause safely** suspends in-flight work so a later session can resume it.
68. **Multi-phase plan** names phases, the verifiable exit of each phase, and the order.
69. **Worktree cleanup** leaves no orphan worktree whose branch is unrecorded.
70. **Opening a PR** states the problem, the change, and the proof.

---

## Part D: Installed Workspace Skills Invariants (71–113)

71–74. **Scale-stack framework:** Stack decisions record ownership, control plane, edge; self-service is default; immutable delivery; not applied to tiny MVPs.
75–76. **Grok god mode:** Tools and first-principles over bulk prose; claims cite observations.
77–80. **Musk algorithm builder:** Deletion before optimization; question requirements; critical path visible daily; named responsible ownership.
81–83. **Webapp from first principles:** Phases advance only when gates are met; final artifact is implementation doc; open questions asked until answered.
84–86. **Learn-anything coach:** User language; retrieval and proof-of-learning gates; live performance required.
87–89. **Universal quoter:** Pricing derived from load, scope, value, not raw guesswork; opportunity cost included; options presented.
90–91. **Hour estimator:** Parkinson, Hofstadter, Murphy, Pareto applied explicitly; separate 20% driver from buffer.
92–94. **Browser-game prototype:** Single-file HTML5 canvas; keyboard/touch loop; seven-step process followed.
95–96. **Mega webapp generator:** One-sentence idea yields complete architecture; `ELEMENTOS_CLAVE.md` included.
97–99. **Use-case modeling:** Actors, goals, success scenario before extensions; functional requirements traceable; exception flows explicit.
100–103. **Winston / epic talk:** Empowerment promise opener; 3 cycles per major idea; slides minimal; close returns to promise.
104–105. **Gmail importance triage:** Ordered by urgency/importance with signals; no full unprioritized dump.
106–107. **Gmail summarizer:** Read under label; summary precedes permanent deletion.
108–109. **Calendar reviewer:** Inspects every calendar; report overlaps; clear calendar explicitly reported.
110–111. **Daily AI news:** Deduplicated against prior days; readable chat summary.
112–113. **Cloudflared tunnel:** Tunnel duration bounded; credentials never written to chat transcript.
