# Verify the core requirements

Core 0.0.1 keeps **68 rules by default**, introduced when the core was numbered 0.3.0: 64 project
obligations and four general change guards. The [original 48](../inputs/core-invariants-48.md)
retain their identities; the [additional maintainability set](core-maintainability-update.md)
extends overlapping conditions and adds 16 distinct obligations. Stable IDs are
`core/CORE-INV-001` through `core/CORE-INV-064`. Language, architecture, library,
practice and process packs are optional. Initial shadow mode applies to optional
policy; it does not turn off core requirements.

These requirements include facts that syntax cannot establish: reasons for change,
observed change history, business conflict policies and sufficient test coverage.
Verification requires a **human-reviewed project fitness function**. Adopt these
functions in bounded groups. One assertion can support several requirements only
when it actually tests all their relevant conditions. Unbound requirements remain active and
explicitly unverified; they do not block edits, check or Stop. Once a binding is
adopted, missing, stale, failed or incomplete evidence blocks check and Stop.
A current
passing command proves what that particular verifier asserts. It does not prove
the full semantic requirement just because its exit code is zero.

The evidence gate is currently a preview. Its receipt fixtures verify admission,
failure and staleness behavior; they are not general-purpose semantic auditors.

## Bind a verifier

Start with `pregate fitness plan` or `fitness plan --json`. It groups nonpassing
requirements and suggests existing test/configuration filenames for inspection.
Those filenames are hints, not evidence. The plan runs no code, binds no command
and changes no policy. Read the assertions and add invalid controls before adoption.

## Prepare several assertions in one review

The plan includes suggested conditions, negative controls and explicit domain,
data and performance assumptions for each group. They are prompts to adapt to the
project, not implemented assertions. Generate an editable project candidate file:

```sh
pregate fitness plan --template > pregate.fitness.json
# Or pre-populate candidate test-slice commands, input globs and assertion counts from repository tests:
pregate fitness plan --template --auto > pregate.fitness.json
```

The template writes JSON to stdout only. By default it lists unbound requirements with empty
commands and inputs and `coverage: "partial"`; with `--auto` (added in 0.2.19) it inspects
the project's test files and `package.json` to pre-populate candidate test-slice commands,
narrowed input globs and observed assertion counts. Keep the small set you can actually verify, replace the
prompts with project facts, implement the assertions and their negative controls,
and fill in or verify their commands and definition inputs. An unfinished template cannot
be bound. Do not fill all commands with the project's general test suite.
The read-only plan can display unfinished partial drafts. Complete selected
assertions can be reviewed with `--only` while other drafts remain unbound.

Each candidate has this shape:

```json
{
  "schemaVersion": 1,
  "assertions": [
    {
      "id": "order-state",
      "command": ["bun", "test", "quality/order-state.test.ts"],
      "inputs": ["quality/order-state.test.ts", "quality/helpers/**", "package.json", "bun.lock"],
      "timeoutMs": 30000,
      "claims": [
        {
          "rule": "core/CORE-INV-014",
          "coverage": "partial",
          "conditions": ["An empty order cannot ship through any declared shipping entry point."]
        }
      ],
      "negativeControls": ["Remove the empty-order guard; this same assertion must fail."],
      "assumptions": {
        "domain": ["The reviewed domain forbids shipping an order with no lines."],
        "data": ["Fixtures invoke the actual shipping transitions, with all relevant entry points enumerated."],
        "performance": ["This asserts domain behavior; it does not measure throughput or latency."]
      },
      "limits": "Only shipping transitions. Other invalid domain states need additional assertions."
    }
  ]
}
```

This example is a bounded proposal, not supplied code or proof of complete
CORE-INV-014 coverage; its partial claim cannot be adopted as a passing requirement.
Each claim requires `coverage: "complete"` or `"partial"`. Complete means the human
must review evidence for every applicable condition of the actual requirement.
It is a coverage declaration, not an engine-generated semantic proof. Keep partial
assertions in the plan until their gaps are covered; they remain in the gap count.
The batch refuses any selected partial claim. Use `--only` to adopt other complete
assertions without misclassifying partial evidence. `claims` names every condition the command is intended to
test for each selected active requirement. Read the actual assertion and ensure
it fails on each violating control. Domain, data and performance assumption arrays
are all required; an empty array means no assumptions were stated for that category.
It does not prove that no assumptions exist. `limits` records the unproven scope.
Add an optional positive `maxAgeMs` for time-sensitive facts. Timeout defaults to
30000 ms and must not exceed 120000 ms.

The file can contain different commands and several claims per command. Assertion
IDs must be distinct lowercase names. Each verifier can have only one candidate;
combine related checks in a single reviewed command if the same requirement needs
several assertions. The engine rejects incomplete or ambiguous candidates rather
than partially adopting the file. The file is limited to 1 MiB and 256 assertions.
Each declared definition input glob must match a current regular project file;
typos and missing test/helper files cannot be hidden by the manifest's fingerprint.

Inspect and prepare the selected assertions together:

```sh
pregate fitness plan --json
pregate fitness bind --candidates pregate.fitness.json --preview
# Or select several authored assertion IDs from a larger file:
pregate fitness bind --candidates pregate.fitness.json --only order-state,remote-budget --preview
```

`plan` discovers `pregate.fitness.json` at the project root. Use `fitness plan
--candidates quality/evidence.json --json` for another path. Candidate files must
be regular files inside the project, outside inventory-excluded/protected directories;
symlinks and external files are not candidate inputs. Discovery never executes a
command, creates a pending approval or changes active bindings. `--template` cannot
be combined with `--candidates`.

The batch preview creates **one pending preset and one digest**, including all
selected commands, conditions, assumptions, controls, limits and fingerprints.
It preserves existing unselected bindings and local consent. Show that complete
review to the human, approve its digest through the supported approval route,
then run `pregate fitness run --all`. Commands are not executed during discovery,
preview or contract approval. The manifest itself is automatically included in
definition inputs: changing its claims or controls requires a new binding review
before execution. Repeating an already adopted, identical proposal creates no
new pending review and runs nothing.

`fitness status --json` includes a `summary` with active, adopted, passing, failed,
needsEvidence and unbound counts. `needsEvidence` means an adopted assertion lacks
current usable evidence. An unbound requirement still needs a project assertion.
Three passing adopted assertions with remaining unbound requirements are incomplete project evidence,
not certification of all 64. The engine validates declarations and execution
receipts; it cannot establish that project-authored coverage claims are complete.

Since 0.2.7, scaffold a binding from an existing test with one preview:

```sh
pregate fitness bind core/CORE-INV-001 \
  --command-json '["bun","test","test/boundaries.test.ts"]' \
  --inputs 'test/boundaries.test.ts,package.json,bun.lock' \
  --rationale 'This test asserts the declared module responsibility and its boundary' \
  --timeout-ms 30000 --preview
```

The rule must be an active fitness requirement in the current contract. Quote
the comma-separated input globs; include the test helpers and configuration that
define its behavior. `--command-json` is an argument array, not an implicit shell.
The timeout defaults to 30 seconds. The helper fingerprints current input files
and prepares the standard digest-bound contract review. It does not execute the
command, change policy, enable consent or certify coverage. A replacement binding
is shown in the diff and may invalidate existing receipts. Invalid or old contracts
need the project-update review first. The manual request method below remains valid.
Use `--max-age-ms <positive integer>` when this binding needs a reviewed temporal
freshness limit; omitted means no time-based expiry. The bound input tree still
must match before any receipt passes.

To review several requirements together, use comma-separated IDs:

```sh
pregate fitness bind core/CORE-INV-001,core/CORE-INV-002 \
  --command-json '["bun","test","test/boundaries.test.ts"]' \
  --inputs 'test/boundaries.test.ts,package.json,bun.lock' \
  --rationale 'Tests module responsibility and separation; explain all covered conditions and remaining limits' \
  --preview
```

This is an illustrative binding, not a supplied test. All IDs must be distinct
active fitness requirements; one invalid ID rejects the whole proposal. Up to
256 requirements can enter one review. Each retains its own evidence receipt.
Passing one broad suite does not automatically prove every requirement in it.

Choose a project assertion and explain which part of the requirement it verifies.
For example, a boundary validation test can exercise invalid shape, range, size
and encoding at the actual public boundary. A dependency fitness test can assert
the project's declared graph. An arbitrary passing test is not sufficient evidence.

Propose a `fitness` entry in `.pregate/preset.json` through a supported contract edit
or `.pregate/requests/<name>.json`. The human reviews and approves the exact candidate
using the [supported approval route](approval-in-harness.md).

First fingerprint all files that define the verifier, including relevant helpers
and test/configuration dependencies. Run from the project root:

```sh
pregate fitness fingerprint 'test/api/**' package.json bun.lock
```

Copy the returned checksum into `verificationHash`, replacing the illustrative
checksum below. Fingerprinting reads files; it executes nothing and grants no approval.
A binding has this form:

```json
{
  "fitness": {
    "CORE-INV-039": {
      "command": ["bun", "test", "test/api/input-validation.test.ts"],
      "inputs": ["test/api/**", "package.json", "bun.lock"],
      "verificationHash": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "timeoutMs": 30000,
      "rationale": "Exercises invalid shape, range, size and encoding for each public API input. Queue/file boundaries require separate coverage."
    }
  }
}
```

This is an example of the configuration shape, not a supplied test or a complete
verification binding. Implement the assertion in the consuming project. Repeat
the review as project assertions are adopted. A rule's `verifier` parameter can select
a different named binding; the default name is its `CORE-INV-NNN` ID.

Commands are argument arrays, executed without an implicit shell. Timeout is a
positive integer no greater than 120000 milliseconds. `inputs` adds file globs to
the preset's entire selected scope; it does not narrow that scope. Those verifier
files must also retain their reviewed `verificationHash`. If they change, execution
is refused until the human reviews their new definition and approves its checksum
as a contract change. A nonempty
rationale describes the reviewed coverage. Packs supply declarative checks and
fixtures; they cannot supply executable verification commands.

The [core verification worksheet](../guides/core-verification-matrix.md)
suggests project assertions, negative controls and conditional exceptions for
each requirement. Its suggestions are not installed tests or approved bindings.

## Run and inspect

```sh
pregate fitness status --json
pregate fitness run CORE-INV-039
pregate fitness run --all
pregate audit --json
pregate check --all
```

`status` never executes a verifier. `run --all` executes the reviewed bindings
of active fitness rules and leaves unbound requirements unverified. An explicit
unbound selection, or `--all` with no bindings, executes nothing and returns 1. Identical
command arrays, input lists and timeouts run once for all matching requirements.
Separate bindings retain their own rationale and receipt.
The status summary distinguishes unbound requirements from adopted assertions that
need fresh evidence. Its passing count describes receipt admission, not unrestricted
semantic certification.
The JSON entries in `fitness status --json` and `audit --json` include the exact
English requirement in `statement` and its next action in `fixHint`, alongside
the requirement ID, verifier, status, reason and reviewed rationale. Agents can
read the requirement directly when preparing or repairing its project assertion.

There are three results:

| Result | Meaning |
| --- | --- |
| `pass` | The reviewed command completed with exit 0 for the current contract and input tree. |
| `fail` | The current reviewed command completed with a nonzero exit. |
| `unverified` | Binding/evidence is absent, stale, invalid, over budget, or incomplete. |

Missing verification is not counted as a static code violation or as compliance.
`fitness status` returns 1 if any active requirement fails or is unverified.
`fitness run` returns 0 when its selected, adopted assertions pass; it still prints
all active requirements and their remaining coverage gaps. `audit`
includes a separate `fitness` array: unverified requirements make it incomplete
(exit 2); a failed verifier with otherwise complete evaluation gives exit 1.
With both a failure and unverified coverage, exit 2 retains the failure in JSON.
`check` and Stop block nonpassing evidence for adopted bindings on enforcing rules
independently of the no-new ratchet. Optional rules in shadow stay diagnostic;
review an explicit `enforcement: "enforce"` override when adopting their gates.
They report unbound coverage without treating it as a violation.
A passing check means no blocking finding; it is not full-project certification. Proposed-file
Pre checks remain available so the agent can repair code before rerunning verification.
The existing bounded Stop loop can eventually end an incomplete turn; reports
retain that state and `check` still fails. Turn completion is not admission.

## Freshness, scope and local state

An optional binding field `maxAgeMs` sets a reviewed positive integer time limit.
At that age the receipt becomes unverified even when the code has not changed;
future or invalid recording times also fail admission. Rerun the reviewed verifier
to establish new evidence. Use this for deployment facts, dated documents and
external service checks. Source-only checks can omit it. The engine cannot detect
remote configuration drift between runs: the verifier must inspect the applicable
environment and validate external evidence's authenticity and expiry itself.

Before admitting a contract, the engine compiles the current preset and sources
and compares their complete canonical output with the on-disk lock after
CRLF normalization. Valid Git checkouts with LF or CRLF remain admitted;
other formatting changes require regeneration. Matching
version and metadata hashes alone cannot admit changed rules, scope, enforcement
or failure policy. An altered or malformed lock is rejected as `lock-stale`;
regenerate it with `pregate preset compile`. Admission grants neither consent nor
passing fitness evidence. See the actual admission controls.

Receipts live in PREGATE's local state, under `fitness/`, partitioned by project,
contract hash and verifier. They are not read from project fixtures or repros.
Successful evidence has no source output attached. Failed/incomplete execution
can retain the first 4096 bytes of each output channel for diagnosis. Review this
local data before sharing it; issue submission remains separately approved.
Existing session storage cleanup does not prune fitness receipts.

The engine hashes selected regular files and verifier inputs, with a 128 MiB total
input budget. Edits, additions and deletions invalidate evidence. It checks the
contract and inputs again after execution; a command that changes either cannot
establish passing evidence. Output beyond 16 MiB per channel terminates the
immediate verifier and makes execution incomplete. Exactly 16 MiB on stdout and
16 MiB on stderr together remain valid. Output is captured in bounded runtime
buffers rather than temporary files; the buffer can exceed its limit by the read
that detects overflow. Only the first 4096 bytes of each channel can enter a
failure receipt. This is not a whole-engine memory quota. At the configured timeout, the engine forcibly terminates
the immediate verifier process, including one that ignores SIGTERM, and rejects
its evidence. Input hashing and contract validation occur outside that subprocess
timeout. It is not a deadline for the whole fitness command or a sandbox for
arbitrary subprocess trees.

Workspace inventory omits `.git`, `.pregate`, installed dependency/environment
directories, untracked build output, `dist/` and harness settings. Regular tracked
authored files under `build/` remain inputs when selected; changing or deleting
them invalidates evidence. Symlinks are not traversed.
Declare and review scope deliberately; an excluded file is not verified.
The receipt does not fingerprint the operating system, environment, remote
dependencies or executable version. Rerun verification when those affect the
assertion. A verifier can inspect other resources, but the receipt's freshness
guarantee covers only the recorded contract and file inputs.

Include the verifier and its relevant helpers/configuration in `inputs`. A file
outside that list is not protected by the verifier definition fingerprint. Review
external executable/dependency assumptions alongside the binding rationale.

Staged checks fingerprint exact Git index bytes, including binary files. A verified
working tree cannot admit a different staged tree. Git filters or line-ending
conversion can therefore invalidate staged evidence; align the verifier's input
bytes with the committed inputs rather than treating a different tree as verified.

## Explicit disable

A human can disable any core rule through a reviewed override, for example:

```json
{ "overrides": { "core/CORE-INV-048": "off" } }
```

Disabling means the requirement is inactive; it does not mean the project complies.
Record why the requirement does not apply. `pack disable core/software-invariants
--preview` proposes disabling all 64, and `pack enable core/software-invariants
--only CORE-INV-039 --preview` proposes a selective configuration. Core activation
does not depend on listing its methodologies explicitly. The builtin core source
cannot be removed or shadowed by another pack.
