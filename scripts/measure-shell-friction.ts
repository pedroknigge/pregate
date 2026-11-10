// Measure what the shell guard refuses among routine developer commands. Each command of the
// committed corpus goes through the real pre hook as a Claude Code Bash call, in a scratch project
// with an approved contract. The hook only judges: no corpus command is run.
//
// Usage:
//   bun scripts/measure-shell-friction.ts [--check]
// Without a flag it rewrites docs/benchmarks/shell-friction.json and shell-guard-friction.md.
// With --check it exits 1 when those files differ from this run.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { canonical } from "../src/disk.ts";

const ROOT = resolve(import.meta.dir, "..");
const BENCH = join(ROOT, "docs", "benchmarks");
const ENGINE = ["bun", join(ROOT, "src", "main.ts")];
export type Intent = "read" | "outside" | "source" | "contract";
export interface Command { id: string; group: string; intent: Intent; command: string }
export interface Outcome { id: string; group: string; intent: Intent; command: string; decision: "allow" | "deny"; cause: string | null }
interface Field { session: string; commands: number; denied: number; byCause: Record<string, number>; labels: { count: number; verdict: string; cause: string; shape: string }[] }

// The project the commands are judged in. `test/contract.test.ts` and `scripts/docs.ts` are files a
// project about its own tooling has: their text names the contract folder and a control command.
const FILES: Record<string, string> = {
  "package.json": `${JSON.stringify({ name: "shop", type: "module", version: "1.0.0",
    scripts: { test: "bun test", build: "tsc -p .", lint: "eslint src", format: "prettier --write src", typecheck: "tsc --noEmit" } }, null, 2)}\n`,
  "tsconfig.json": '{"compilerOptions":{"strict":true,"outDir":"dist"},"include":["src"]}\n',
  "README.md": "# shop\n",
  "requirements.txt": "pytest\n",
  "Makefile": "build:\n\ttsc -p .\n\ntest:\n\tbun test\n",
  "src/a.ts": "export function total(lines: number[]): number {\n  return lines.reduce((sum, line) => sum + line, 0);\n}\n",
  "test/a.test.ts": 'import { expect, test } from "bun:test";\nimport { total } from "../src/a.ts";\ntest("total", () => expect(total([1, 2])).toBe(3));\n',
  "test/contract.test.ts": 'import { expect, test } from "bun:test";\nimport { existsSync } from "node:fs";\ntest("the contract is committed", () => expect(existsSync(".pregate/preset.json")).toBe(true));\n',
  "scripts/report.ts": 'import pkg from "../package.json" with { type: "json" };\nconsole.log(pkg.version);\n',
  "scripts/report.mjs": 'import { readFileSync } from "node:fs";\nconsole.log(JSON.parse(readFileSync("package.json", "utf8")).version);\n',
  "scripts/docs.ts": 'const STEPS = ["Install it.", "Run `pregate enable` in the project.", "Run `pregate setup` once per machine."];\nconsole.log(STEPS.join("\\n"));\n',
  "scripts/count.py": 'import pathlib\nprint(len(list(pathlib.Path("src").iterdir())))\n',
  "AGENTS.md": "# Rules\n\n- Never import `left-pad`.\n",
  "scripts/build.sh": "#!/bin/sh\nset -e\necho building\ntsc -p .\n",
};

function project(area: string) {
  const root = join(area, "repo"), machine = join(area, "machine");
  for (const [rel, text] of Object.entries(FILES)) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text, rel.endsWith(".sh") ? { mode: 0o755 } : {}); }
  const env = { ...process.env, HOME: join(machine, "home"), USERPROFILE: join(machine, "home"), CODEX_HOME: join(machine, "codex"), GROK_HOME: join(machine, "grok"),
    CLAUDE_CONFIG_DIR: join(machine, "claude"), XDG_DATA_HOME: join(machine, "data"), XDG_STATE_HOME: join(machine, "state"), CI: "1", PREGATE_UNATTENDED_APPROVAL: "1",
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" };
  const run = (command: string[], input?: string) => {
    const result = Bun.spawnSync(command, { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 60_000, ...(input === undefined ? {} : { stdin: Buffer.from(input) }) });
    return { code: result.exitCode, text: result.stdout.toString() + result.stderr.toString() };
  };
  const git = (...args: string[]) => run(["git", ...args]);
  git("init", "-q", "-b", "main"); git("config", "user.name", "t"); git("config", "user.email", "t@example.com"); git("config", "commit.gpgsign", "false");
  git("add", "-A"); git("commit", "-qm", "base");
  writeFileSync(join(root, "src/a.ts"), `${FILES["src/a.ts"]}export const none = total([]);\n`);
  git("commit", "-qam", "second");
  git("branch", "other", "HEAD~1");
  const review = run([...ENGINE, "guide", "--preview", "--enforcement", "enforce"]);
  const digest = review.text.match(/Digest: ([0-9a-f]{64})/)?.[1];
  if (digest === undefined) throw new Error(`no review to approve:\n${review.text}`);
  const applied = run([...ENGINE, "approve", "--yes", "--digest", digest]);
  if (applied.code !== 0) throw new Error(`the contract was not applied:\n${applied.text}`);
  return { root, run };
}

export function corpus(): Command[] {
  return (JSON.parse(readFileSync(join(BENCH, "shell-friction-corpus.json"), "utf8")) as { commands: Command[] }).commands;
}

export function measure(commands: Command[]): Outcome[] {
  const area = canonical(mkdtempSync(join(tmpdir(), "shell-friction-")));
  try {
    const p = project(area);
    return commands.map((entry, index) => {
      const id = String(index).padStart(12, "0");
      const out = p.run([...ENGINE, "hook", "pre", "--harness", "claude-code"], `${JSON.stringify({
        session_id: `00000000-0000-4000-8000-${id}`, cwd: p.root, hook_event_name: "PreToolUse", permission_mode: "acceptEdits",
        tool_name: "Bash", tool_use_id: `toolu_${id}`, tool_input: { command: entry.command } })}\n`);
      const cause = out.text.match(/PREGATE DENY ([a-z-]+)/)?.[1] ?? null;
      if (out.code !== 0 && cause === null) throw new Error(`${entry.id}: exit ${out.code} with no denial cause:\n${out.text}`);
      return { ...entry, decision: cause === null ? "allow" : "deny", cause };
    });
  } finally {
    rmSync(area, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

// The first words of the corpus that this machine's PATH resolves to a script and not to a native
// program. The guard reads such a file like a project script, so the result depends on them.
export function pathScripts(commands: Command[]): string[] {
  const heads = new Set(commands.flatMap((c) => c.command.split(/&&|\|\||[;|&\n]/).map((part) => part.trim().split(/\s+/).find((word) => !/^\w+=/.test(word)) ?? "")));
  return [...heads].filter((head) => /^[a-z][\w.-]*$/.test(head)).filter((head) => {
    const found = Bun.which(head);
    if (found === null) return false;
    try { return readFileSync(found).subarray(0, 2).toString() === "#!"; } catch { return false; }   // fail-closed: an unreadable program is not listed as a script
  }).sort();
}

// The reading of the numbers. It is written by hand and changes only with a new measurement.
const DECISION = [
  "## Keep, trim, hold",
  "",
  "No anti-evasion rule is added until the held refusals below are settled. The guard still refuses routine work that it should not.",
  "",
  "**Keep.** Every refusal of a command that changes the contract or the protection. The refusal of a shell write to a governed source file, and of a script or a target named through a variable: both are documented in [Guarantees and limits](../guarantees.md), and the edit tool is the supported route.",
  "",
  "**Trimmed.** The first measurement refused 32 of 101 routine commands. Three of its causes protected nothing, because the refused reading of the command is not what the shell runs. They are fixed, and the numbers above are from after the fix:",
  "",
  "- A shell builtin (`cd`, `type`, `wait`, `read`, `umask`) was looked up on `PATH`. macOS ships `/usr/bin/cd` and its siblings as scripts with a computed command name, so the guard read `cd src` as an unnamed command. The shell runs its builtin and never that file.",
  "- `bun test` was read as Bun running a script named `test`. With a `test` directory in the project, that path is not a readable file and the command was refused. `test` is a Bun subcommand.",
  "- `pregate layers` and `pregate compile` were refused in an enabled project. They read, or they prepare a review that only a human approves, like `pregate rules add`. The skill tells the agent to run them.",
  "",
  "**Trimmed, with a trade.** An installed tool that is a script, such as `npm` and `npx`, was read like a project script and refused because it uses the file system. A native tool with the same behavior (`bun`, `pnpm`) is not read at all. A script found on `PATH` whose real file lies outside every enabled project is now read for control commands only. What this gives up: a script an agent plants in a `PATH` folder outside the project is no longer refused for a write, only for a control command. Stop, the pre-commit check and the CI ratchet still judge the tree it leaves. A script on `PATH` inside a project, such as `node_modules/.bin`, is still read whole.",
  "",
  "**Hold, for a maintainer decision.** Each of these has a real bypass behind it, so trimming is a trade:",
  "",
  "- A literal read-only script is refused when it imports a file-system module (`node scripts/report.mjs`, `python3 scripts/count.py`). The scan cannot tell a read from a write.",
  "- A script whose text names a control command in prose or in generated documentation is refused as if it ran it. This is the false positive of the field sample.",
  "",
];

const INTENTS: [Intent, string][] = [
  ["read", "Reads only"], ["outside", "Writes nothing the contract governs"], ["source", "Writes a governed source file from the shell"], ["contract", "Changes the contract or the protection"],
];

export function page(outcomes: Outcome[], field: Field, machine: { platform: string; scripts: string[] }): string {
  const of = (intent: Intent) => outcomes.filter((o) => o.intent === intent);
  const denied = (rows: Outcome[]) => rows.filter((o) => o.decision === "deny");
  const routine = [...of("read"), ...of("outside")];
  const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ⏎ ");
  const lines = [
    "# Shell guard friction",
    "",
    "<!-- Generated by scripts/measure-shell-friction.ts. Edit the corpus, the field file or the script, not this page. -->",
    "",
    `The shell guard refused **${denied(routine).length} of ${routine.length}** routine commands in the corpus: commands that read, or that write nothing the contract governs. It refused ${denied(of("source")).length} of ${of("source").length} commands that write a governed source file from the shell, and ${denied(of("contract")).length} of ${of("contract").length} that change the contract or the protection. Refusing those two groups is what the guard is for.`,
    "",
    "## Method",
    "",
    "1. Build a scratch TypeScript project with a Makefile, shell, Node, Bun and Python scripts, two commits and a second branch. Approve a contract for it in enforce mode.",
    "2. Send each corpus command to the real pre hook (`pregate hook pre --harness claude-code`) as a Claude Code `Bash` call. The hook judges the command. The command is never run.",
    "3. Record the decision and, for a denial, its cause.",
    "",
    "The corpus is [`shell-friction-corpus.json`](shell-friction-corpus.json): hand-assembled commands for git, npm, Bun, make, Python, plain shell and Pregate itself. It is not a sample of what agents run, so the counts below are not a rate for any real session. The engine ran from source.",
    "",
    `The result depends on the machine. This run: ${machine.platform}. The guard resolves a bare command name on \`PATH\` and reads the file when it is a script. On this machine these corpus commands are scripts: ${machine.scripts.length === 0 ? "none" : machine.scripts.map((name) => `\`${name}\``).join(", ")}.`,
    "",
    "## Corpus result",
    "",
    "| What the command does | Commands | Refused |",
    "| --- | ---: | ---: |",
    ...INTENTS.map(([intent, label]) => `| ${label} | ${of(intent).length} | ${denied(of(intent)).length} |`),
    "",
    "### Routine commands the guard refused",
    "",
    ...(denied(routine).length === 0 ? ["None."] : ["| Id | Command | Cause |", "| --- | --- | --- |", ...denied(routine).map((o) => `| ${o.id} | \`${cell(o.command)}\` | \`${o.cause}\` |`)]),
    "",
    "### Source and contract writes the guard let through",
    "",
    "The pre hook is not the only check. A command the guard allows is still judged by Stop, the pre-commit check and the CI ratchet on the tree it leaves.",
    "",
    ...(of("source").concat(of("contract")).filter((o) => o.decision === "allow").length === 0 ? ["None."]
      : ["| Id | Command |", "| --- | --- |", ...of("source").concat(of("contract")).filter((o) => o.decision === "allow").map((o) => `| ${o.id} | \`${cell(o.command)}\` |`)]),
    "",
    "## Field sample",
    "",
    `${field.session} The guard refused **${field.denied} of ${field.commands}** shell commands (${Object.entries(field.byCause).map(([cause, count]) => `${count} \`${cause}\``).join(", ")}). The commands are not published. Each refusal was read and labeled:`,
    "",
    "| Refusals | Verdict | Cause | Shape |",
    "| ---: | --- | --- | --- |",
    ...field.labels.map((l) => `| ${l.count} | ${l.verdict} | \`${l.cause}\` | ${cell(l.shape)} |`),
    "",
    "One session on one repository is a sample, not a rate.",
    "",
    ...DECISION,
  ];
  return lines.join("\n");
}

if (import.meta.main) {
  const commands = corpus();
  const outcomes = measure(commands);
  const field = JSON.parse(readFileSync(join(BENCH, "shell-friction-field.json"), "utf8")) as Field;
  const machine = { platform: `${process.platform} ${process.arch}`, scripts: pathScripts(commands) };
  const files: [string, string][] = [
    [join(BENCH, "shell-friction.json"), `${JSON.stringify({ machine, outcomes: outcomes.map(({ id, decision, cause }) => ({ id, decision, cause })) }, null, 2)}\n`],
    [join(BENCH, "shell-guard-friction.md"), page(outcomes, field, machine)],
  ];
  if (process.argv.includes("--check")) {
    const stale = files.filter(([path, text]) => !existsSync(path) || readFileSync(path, "utf8") !== text).map(([path]) => path);
    if (stale.length > 0) { console.error(`stale: ${stale.join(", ")}; run bun scripts/measure-shell-friction.ts`); process.exit(1); }
  } else {
    for (const [path, text] of files) writeFileSync(path, text);
    for (const o of outcomes.filter((o) => o.decision === "deny")) console.log(`${o.intent.padEnd(8)} ${o.cause!.padEnd(15)} ${o.id}`);
  }
}
