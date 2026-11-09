# The agent proposes, the engine verifies, a human approves

An instruction in `AGENTS.md` is a suggestion: the agent can skip it, it loads in every
session, and it fades in a long one. A rule in the contract runs before the file is
written. These commands move a project from the first to the second without asking the
human to write configuration. Each one prepares a review. None of them changes the
contract or approves anything.

Most people reach all of this through the `/pregate` skill, which runs the commands and
reports in plain language. The commands are documented here for reviewers and for
anyone who scripts them.

## Layers with evidence

`pregate guide --preview` derives a layer map from conventional folder names. The review
now says what that map finds in the code as it is:

```text
Layers to review: domain (core; imports no other layer); infra (adapter; may import domain).
Layer domain (2 files): 1 existing import of infra, which it may not import. Example: src/domain/order.ts imports src/infra/db.ts.
Layers with no existing break: infra (1 file).
The 1 existing break stays as known debt under no-new. A new break is reported to the agent with the repair, and not blocked.
Not in any layer, so imports there are unrestricted: src/services (1 file; imports domain); src/ui (1 file; imports infra, src/services).
```

The counts cover production source files. The engine also checks test files inside a
layer path, so an audit can list more. A folder that is not in any layer is unrestricted;
the last line names those folders so the gap is visible.

`pregate layers [--json]` prints the same evidence for the current contract, or for the
derived map when the contract declares no layers.

Folder names cannot place `ui` or `services`. An agent can: it reads which folders import
which in `layers --json`, writes a map, and runs

```sh
pregate layers apply layers.json --preview
```

```json
{"why": "ui calls services, services call the domain; only infra adapts storage.",
 "layers": {"domain": {"paths": ["src/domain/**"], "mayImport": [], "kind": "core"},
            "ui": {"paths": ["src/ui/**"], "mayImport": ["services", "domain"], "kind": "adapter"}}}
```

The engine refuses a map that is not valid, or whose paths match no file. It prints the
evidence for the proposed map, adds a layer methodology when no selected rule reads
layers, and stages one digest-bound review for the human. `why` is one sentence a
reviewer can check against the code.

A layer map is a proposal about intent. The evidence shows what it would flag; it does
not show that the map is the right architecture.

## Compile an instruction file

```sh
pregate compile AGENTS.md
```

reads the file as a list of statements and sorts each one:

| Group | Meaning | What happens |
| --- | --- | --- |
| Rules | A bundled rule says the same, or the sentence has a shape the drafter knows | `--preview` stages it |
| Need one example | The statement forbids or requires something in code, with no known shape | The report prints the `rules add --fail --pass` command |
| Stay in the file | Guidance, or an action of the agent such as running tests | Nothing; no check on a file decides it |

Three sentence shapes compile without code, in TypeScript and JavaScript projects:
`<folder> must not import <folder>`, `never import <package>` (also `do not import
<package>` and `no <package> imports`), and `[<subject>] must not call <function>`
(also `never use <function>`). A bundled rule matches only when it shares three content
words with the statement, and the report quotes what that rule says.

`pregate compile AGENTS.md --preview` puts every compilable statement into one review:
bundled rules are switched on in the preset, and drafted rules go to the project's own
pack with generated pass, fail and trap cases. Rules that are already in the contract
are reported as such, so the command is safe to repeat.

The report ends with the lines that can leave the file once the rules are approved, and
an estimate of the tokens that stop loading in every session. The estimate is four
characters per token. The command never edits the instruction file.

The sorting is a text heuristic. A statement in the wrong group costs a review line, not
a wrong rule: every drafted rule must pass its own cases before it is staged, and the
human reads the review.

### When the file is prose: the agent proposes

Sentence shapes cover short bullets. A real instruction file is mostly paragraphs and
tables: on one production repository, 0 of about 500 statements had a known shape. An
agent can read that text. So the agent proposes and the engine proves:

```sh
pregate compile CLAUDE.md --template > proposals.json   # statements plus the steps to complete them
pregate compile apply proposals.json --preview
```

Each proposal names the statement's line and gives a short sentence, code that must
fail, and code that must pass:

```json
{"file": "CLAUDE.md", "rules": [
  {"line": 536, "sentence": "Never import @anthropic-ai/sdk; call the ai client",
   "fail": ["import Anthropic from \"@anthropic-ai/sdk\";"],
   "pass": ["import { aiComplete } from \"@/lib/ai/ai-client\";"]},
  {"line": 493, "sentence": "Never round money with Math.round by hand",
   "fail": ["export const total = Math.round(amount * 100) / 100;"],
   "pass": ["export const total = roundPostedMoney(amount);", "export const pages = Math.round(count);"],
   "pattern": {"kind": "binary_expression", "regex": "^Math\\.round\\(.*\\* 100\\) / 100$"}},
  {"line": 30, "rule": "architecture/HEX-EDGE-001"}]}
```

The engine synthesizes a pattern from the cases, or uses the agent's `pattern`. It adds
its own cases (the code after other declarations, nested in a callback, mentioned in a
string) and stages only the rules that pass all of them, in one review. It refuses, by
name and with the reason:

- a pattern that does not separate the failing code from the passing code;
- a synthesized pattern that is the example's own text, because it would miss the same
  mistake written another way;
- a bundled rule id that does not exist for the project's languages.

A blank template entry is a statement the agent judged not checkable; it is skipped.

Cases prove that a rule separates the examples it was given. They do not prove that it
matches every form of the mistake or nothing else. A similar allowed snippet in `pass`
is the main defence against a rule that matches too much, and `pregate audit` after
approval shows what the rule finds in the real code.

## Promotion raised by Pregate

Advisor rules inform and do not block. `pregate promote --preview` proposes the clean ones
for enforcement. A human no longer has to remember that. At most once a day per project,
SessionStart adds one line when all of these hold for a rule:

- it was in advisor mode before the last seven days began;
- the agent made at least 20 checked edits in the last seven days;
- it reported no finding and no warning in those seven days;
- it reads at least one file in scope.

The line tells the agent to tell the user once. The human still reviews and approves the
promotion. Zero findings is a reason to consider enforcement, not proof that the rule
covers every case.

`pregate report` adds one line that says what the gate did to the agent:

```text
Agent loop: stopped before a write 14 times, repaired on the next attempt 12 times; 9 advisor findings shown, 6 gone on the same file's next edit.
```

Both repairs are observations of the next edit of the same file by the same agent. They
are not proof that the code is correct.

## Requirements with no verifier stay quiet

The core declares 64 project requirements that check nothing until the project binds a
command to one. Before the first binding, the guide review, the pack summary lines and
the SessionStart briefing do not count them. `pregate status --verbose` and
`pregate audit` print one line: `Project verification: not adopted`.
`pregate fitness status`, `--json` outputs and the lock are unchanged. After the first
binding, every surface reports unbound and unverified requirements as before.
