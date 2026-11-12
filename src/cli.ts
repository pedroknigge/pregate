import { existsSync, readFileSync } from "node:fs";
import { approvalRefusal, approve, withholdApprovalCode } from "./approval.ts";
import { approveBatch, approvePending, applyPreset, pendingReview } from "./approval-command.ts";
import { enforcementOf } from "./enforcement.ts";
import { init } from "./init.ts";
import { layers, scan } from "./scan-command.ts";
import { report } from "./report-command.ts";
import { feedback } from "./feedback-command.ts";
import { dispute } from "./dispute-command.ts";
import { importReviewCost, pack, projectUpdate } from "./pack-command.ts";
import { projectUpdates, registryHint, worktreeHint } from "./project-updates.ts";
import { guide } from "./guided.ts";
import { bundledBetween, reviewDiff, validateContract } from "./contract.ts";
import { git } from "./git.ts";
import { recordApproval } from "./loosening.ts";
import { dirname, join, resolve } from "node:path";
import { relativePath as relative } from "./paths.ts";
import { writeAll } from "./write-all.ts";
import { applyRequest, listChecks } from "./compile.ts";
import { canonical, findRoot, readStdin, readTree, STDIN_TIMEOUT, writeAtomic } from "./disk.ts";
import { disable, enable } from "./consent.ts";
import { testCheck, testFixture } from "./fixtures.ts";
import { readFixture } from "./fixture-replay.ts";
import { check, clock, delegate, grammars, launcher, LOCK, lockOf, PRESET, readText, sourceDirs, sourcesOf, VERSIONS } from "./gate.ts";
import { tsconfigNotice } from "./resolve.ts";
import { install, projectClaudeSetup, projectHooks, projectLauncher } from "./install.ts";
import { doctor, prepare, setup, uninstall, update } from "./machine.ts";
import { contract, formText, POLICY_ADAPTATION } from "./message.ts";
import { inScope, layerOf, matches } from "./paths.ts";
import type { Lock, LockRule } from "./types.ts";
import { hasRepository } from "./workspace.ts";
import { issue } from "./issue-command.ts";
import { contractDiagnosis, protectionStatus, statusText } from "./status.ts";
import { librarySource } from "./library.ts";
import { audit, promote } from "./audit-command.ts";
import { fitness } from "./fitness-command.ts";
import { pendingRoot } from "./pending-review.ts";
import requestSchema from "../schema/request.v1.json" with { type: "json" };
import presetSchema from "../schema/preset.v1.json" with { type: "json" };
import { commandHelp } from "./shell.ts";

// The CLI (SPEC §13.8, MVP rows). The agent may run check, explain, preset show and rules test
// (§4.2). All output is English (D23). Every command rejects unknown options and operands.

type Result = { code: number; text: string };

const USAGE = `usage:
  pregate guide [--json|--preview [--full]] [--packs <ns,ns|none>] [--custom-pack <path>] [--custom-from-docs] [--layers <layers.json>] [--compile <proposals.json>] [--enforcement shadow|advisor|enforce] [--preset <name>]
  pregate guide [--json|--preview [--full]] --projects <path...>
  pregate check [--all] [--format agent|sarif]
  pregate audit [--repo <path>] [--json|--jsonl|--sarif|--full] [--plan] [--incremental] [--fresh]
  pregate promote [--rule <id,id>] [--repo <path>] [--preview|--yes]
  pregate fitness status [--json] | plan [--candidates <path>] [--json|--template [--auto]] | run <verifier|--all>
  pregate fitness fingerprint <glob...>
  pregate fitness bind <rule-id[,rule-id]> --command-json <argv-array> --inputs <glob,glob> --rationale <text> [--timeout-ms <n>] [--max-age-ms <n>] --preview
  pregate fitness bind --candidates <path> [--only <assertion-id,...>] --preview
  pregate check --stdin --path <file> [--format agent|sarif]
  pregate check --staged [--ratchet]
  pregate check --ratchet --base <sha>
  pregate explain <rule> | --path <file>
  pregate preset show [--json] | request-schema | compile [--yes] | apply <request.json> [--preview|--yes]
  pregate preset diagnose [--json] | schema
  pregate rules test [<dir> | --library <ns> | --fixture <dir|repro.json>]
  pregate rules add "<sentence>" [--fail <code>]... [--pass <code>]... [--files <glob>] [--rule <ns/ID>] [--draft]
  pregate compile <rules.md> [--json|--template|--preview] | compile apply <proposals.json> --preview
  pregate rules draft <pack-dir> <area>/<name> [--pattern <rule.json|auto> --message <text> --why <text> --fix <text>] [--files <glob>] [--fail <file>]... [--pass <file>]... [--trap <file> --trap-note <text>]...
  pregate storage inspect [--json] | prune --older-than <days> [--preview] | recover [--preview] | show <digest> | apply <digest> [--yes]
  pregate enable | disable [--yes] | status [--json|--verbose]
  pregate approve --preview [--full] | <code> [--no-commit] | [--yes] [--digest <sha256>] [--no-commit]
  pregate init [--preview|--yes] [--preset <name>]
  pregate scan [--json|--plan]
  pregate layers [--json] | layers apply <layers.json> --preview [--complete]
  pregate import arkgate --preview [--config <path>]
  pregate demo [--language python|go|rust|all] [--json]
  pregate report [--days <n>] [--repo <path>] [--json]
  pregate session rebase <harness:session-id> --preview | rebase <harness:session-id> --digest <sha256> [--yes]
  pregate feedback list [--days <n>] [--json]
  pregate feedback draft <finding-id> --as correct|false-positive|uncertain [--note <text>] [--days <n>]
  pregate feedback show | apply <digest> [--yes]
  pregate dispute [--last | <event id>]
  pregate issue list
  pregate issue draft (--last | <event id>) [--include-code | --repro <dir|repro.json>] [--note <text>] [--title <text>]
  pregate issue draft --no-event --title <text> --note <text> [--repro <dir|repro.json>]
  pregate issue show | submit <digest> [--yes]
  pregate pack list [--library] [--category invariants|language|pattern|library|practice|process] [--json]
  pregate pack show [--library] <ns|methodology> [--json] | show --path <dir> [--json]
  pregate pack add --library <ns> [--source-only] [--preview|--yes]
  pregate pack init <ns> | add <url>@<ref> [--source-only] [--preview|--yes] | add --path <dir> [--source-only] [--preview|--yes]
  pregate pack enable <ns/methodology> [--only <id,id>] [--preview|--yes]
  pregate pack apply <plan.json> [--preview|--yes] | restore
  pregate pack disable <ns/methodology> | remove <ns> | update <ns> [--preview|--yes]
  pregate pack update --all [--preview|--yes]
  pregate install [--git-hook] [--ci github|vercel|github,vercel]
  pregate ci detect [--json]
  pregate ci status [--sha <sha>] [--require github-actions|vercel] [--json]
  pregate ci wait [--sha <sha>] [--timeout <seconds>] [--interval <seconds>] [--require github-actions|vercel] [--json]
  pregate prepare [--version <v> | --engine <v>]
  pregate project launcher [--preview|--yes]
  pregate project hooks --harness claude-code [--preview|--yes]
  pregate project hooks --harness codex [--preview|--yes]
  pregate project hooks --harness cursor [--preview|--yes]
  pregate project hooks --harness agy [--preview|--yes]
  pregate project setup
  pregate setup | update [--version <v> | --engine <v>] | uninstall [--purge] [--yes] | doctor
  pregate update --project [--preview|--yes]
  pregate update --projects <path...> [--preview|--yes [--no-commit]]
  pregate --version | --help | -h`;
const BAD: Result = { code: 1, text: USAGE };

export async function run(argv: string[]): Promise<number> {
  const r = await command(argv);
  const text = withholdApprovalCode(r.text);
  if (text !== "") writeAll(1, Buffer.from(`${text}\n`, "utf8"));
  return r.code;
}

async function command([cmd, ...args]: string[]): Promise<Result> {
  if (cmd !== undefined && commandHelp([cmd, ...args])) return { code: 0, text: USAGE };
  switch (cmd) {
    case "guide": return guide(args);
    case "status": return statusCommand(args);
    case "approve": return approveCommand(args);
    case "enable": case "disable": {
      if (args.length > 1 || (args.length === 1 && args[0] !== "--yes")) return BAD;
      const root = here();
      if (root === null) return noPreset(process.cwd());
      if (!await approve(`${cmd === "enable" ? "Enable protection" : "Revoke local consent and stop protection"} for worktree ${root}.`, cmd === "disable", args.includes("--yes"))) return { code: 1, text: `pregate ${cmd} is a human-only command: ${approvalRefusal({ roots: [root], command: `pregate ${cmd}` })}` };
      if (cmd === "enable") enable(root); else disable(root);
      return { code: 0, text: statusText(protectionStatus(root)) };
    }
    case "check": return checkCommand(args);
    case "audit": case "promote": return cmd === "audit" ? audit(args) : promote(args);
    case "fitness": return fitness(args);
    case "init": return init(args);
    case "scan": return scan(args);
    case "layers": return layers(args);
    case "import": return (await import("./arkgate-command.ts")).importArkgate(args);
    case "demo": return (await import("./demo-command.ts")).demo(args);
    case "report": return report(args);
    case "session": return (await import("./session-command.ts")).sessionCommand(args);
    case "feedback": return feedback(args);
    case "storage": return (await import("./storage-command.ts")).storage(args);
    case "dispute": return dispute(args);
    case "issue": return issue(args);
    case "pack": return pack(args);
    case "explain": return explain(args);
    case "preset": return grammars().then(() => preset(args));
    case "rules": return args[0] === "test" ? grammars().then(() => rulesTest(args.slice(1)))
      : args[0] === "draft" ? grammars().then(async () => (await import("./rules-draft-command.ts")).rulesDraft(args.slice(1), here()))
      : args[0] === "add" ? grammars().then(async () => (await import("./rules-add-command.ts")).rulesAdd(args.slice(1), here())) : BAD;
    case "compile": return grammars().then(async () => (await import("./rules-add-command.ts")).rulesCompile(args, here()));
    case "install": return installCommand(args);
    case "ci": return (await import("./ci/command.ts")).ciCommand(args);
    case "setup": return args.length === 0 ? setup() : BAD;
    case "prepare": return prepareCommand(args);
    case "project": return args[0] === "launcher" ? projectLauncher(args.slice(1)) : args[0] === "hooks" ? projectHooks(args.slice(1)) : args[0] === "setup" ? projectClaudeSetup(args.slice(1)) : BAD;
    case "update": return updateCommand(args);
    case "uninstall": {
      // Removing the hooks ends protection for every project: the same human confirmation as disable.
      const purge = args.includes("--purge"), yes = args.includes("--yes");
      if (args.some((a) => a !== "--purge" && a !== "--yes") || args.length > 2) return BAD;
      if (!await approve(`Remove the pregate hooks, launcher and engines from this machine${purge ? " and its state" : ""}. Every project loses protection until setup runs again.`, true, yes)) return { code: 1, text: `pregate uninstall is a human-only command: ${approvalRefusal()}` };
      return uninstall(purge);
    }
    case "doctor": return args.length === 0 ? doctor() : BAD;
    case "--help": case "-h": return args.length === 0 ? { code: 0, text: USAGE } : BAD;
    case "--version": return args.length === 0 ? { code: 0, text: `pregate ${VERSIONS.engine} (core ${VERSIONS.core})` } : BAD;
    default: return BAD;
  }
}

function approveCommand(args: string[]): Result | Promise<Result> {
  const o = options(args, ["--digest"], ["--yes", "--preview", "--full", "--no-commit"]);
  if (o === null || o.operands.length > 1 || (o.opts.has("--full") && !o.opts.has("--preview"))
    || (o.opts.has("--preview") && o.opts.size > (o.opts.has("--full") ? 2 : 1))) return BAD;
  // `approve <code>` is the short human form of `approve --yes --digest <digest>`.
  const code = o.operands[0];
  if (code !== undefined && (o.opts.has("--digest") || !/^[0-9a-f]{12,64}$/.test(code))) return BAD;
  const given = code ?? o.opts.get("--digest"), yes = code !== undefined || o.opts.has("--yes");
  if (given === undefined) return approveHere(o.opts.has("--preview"), o.opts.has("--full"), yes, !o.opts.has("--no-commit"));
  // A batch code approves every project review it binds, whatever the current directory.
  return approveBatch(given, yes, !o.opts.has("--no-commit")).then((batch) => batch ?? approveCode(given, yes, !o.opts.has("--no-commit")));
}

function approveHere(preview: boolean, full: boolean, yes: boolean, commit: boolean): Result | Promise<Result> {
  const root = here() ?? pendingRoot(canonical(process.cwd()));
  if (root === null) return noPreset(process.cwd());
  return preview ? pendingPreview(root, full) : approvePending(root, yes, undefined, commit);
}

function approveCode(code: string, yes: boolean, commit: boolean): Result | Promise<Result> {
  const root = here() ?? pendingRoot(canonical(process.cwd()));
  if (root === null) return { code: 1, text: `No pending project review or batch review matches ${code} from ${process.cwd()}; nothing applied. Run the approval in the project it names, or prepare a fresh review.` };
  return approvePending(root, yes, code, commit);
}

function pendingPreview(root: string, full: boolean): Result {
  try { return pendingReview(root, undefined, full); } catch (e) { return { code: 1, text: (e as Error).message }; }
}

function statusCommand(args: string[]): Result {
  if (args.length > 1 || (args.length === 1 && !["--json", "--verbose"].includes(args[0]!))) return BAD;
  const result = protectionStatus(here());
  return { code: 0, text: args[0] === "--json" ? JSON.stringify(result, null, 2) : statusText(result, args[0] === "--verbose") };
}

// --ratchet is accepted as SPEC §13.8 spells it: staged and base always ratchet (§4.5).
async function checkCommand(args: string[]): Promise<Result> {
  const o = options(args, ["--path", "--format", "--base"], ["--stdin", "--staged", "--ratchet", "--all"]);
  const format = o?.opts.get("--format") ?? "agent";
  if (o === null || o.operands.length > 0 || (format !== "agent" && format !== "sarif")) return BAD;
  const path = o.opts.get("--path");
  const base = o.opts.get("--base");
  const modes = [o.opts.has("--stdin"), o.opts.has("--staged"), base !== undefined].filter(Boolean).length;
  if (modes > 1 || (o.opts.has("--all") && modes > 0) || o.opts.has("--stdin") !== (path !== undefined) || (base !== undefined && !o.opts.has("--ratchet"))) return BAD;
  const finish = (root: string, res: Result): Result => format === "sarif" ? res : withTsconfigNotice(root, res);
  if (path !== undefined) {
    const abs = canonical(resolve(path));
    const root = findRoot(dirname(abs), () => true);
    if (root === null) return noPreset(dirname(abs));
    const delegated = delegate(root, ["check", ...args]);
    if (delegated !== null) return delegated;
    const input = await readStdin();
    return input.timedOut ? { code: 1, text: `${STDIN_TIMEOUT}.` }
      : input.invalid ? { code: 1, text: "stdin must be valid UTF-8 and at most 16 MiB." }
      : finish(root, await check(root, { kind: "stdin", path: relative(root, abs), text: input.text }, format));
  }
  const root = here();
  if (root === null) return noPreset(process.cwd());
  const mode = o.opts.has("--all") || (modes === 0 && !hasRepository(root)) ? { kind: "tree" } as const
    : o.opts.has("--staged") ? { kind: "staged" } as const : { kind: "base", sha: base ?? "HEAD" } as const;
  return delegate(root, ["check", ...args]) ?? finish(root, await check(root, mode, format));
}

function withTsconfigNotice(root: string, result: Result): Result {
  const notice = tsconfigNotice((rel) => readText(join(root, rel)));
  return notice === null ? result : { ...result, text: result.text ? `${result.text}\n${notice}` : notice };
}

// The source, the why and the effective parameters of a rule, or every rule that applies to a file.
function explain(args: string[]): Result {
  const o = options(args, ["--path"], []);
  const path = o?.opts.get("--path");
  if (o === null || o.operands.length !== (path === undefined ? 1 : 0)) return BAD;
  const abs = path === undefined ? null : canonical(resolve(path));
  const root = abs === null ? here() : findRoot(dirname(abs), () => true);
  if (root === null) return noPreset(process.cwd());
  const delegated = delegate(root, ["explain", ...args]);
  if (delegated !== null) return delegated;
  const loaded = lockOf(root);
  if (typeof loaded === "string") return { code: 1, text: formText({ cause: loaded, line: null }, null).full };
  if (abs !== null) return { code: 0, text: `${applying(loaded.lock, relative(root, abs))}\n\n${POLICY_ADAPTATION}` };
  const id = o.operands[0]!;
  const hits = loaded.lock.rules.filter((r) => [r.id, ...r.aliases].some((a) => a === id || a.endsWith(`/${id}`)) || r.check.startsWith(`${id}@`));
  if (hits.length === 0) return { code: 1, text: `PREGATE: no rule ${id} in this lock. \`pregate preset show\` lists them.` };
  return { code: 0, text: hits.map((r) => describe(loaded.lock, r)).join("\n\n") + `\n\n${POLICY_ADAPTATION}` };
}

function preset(args: string[]): Promise<Result> | Result {
  const [sub, ...rest] = args;
  if (sub === "request-schema") return rest.length === 0 ? { code: 0, text: JSON.stringify(requestSchema, null, 2) } : BAD;
  if (sub === "schema") return rest.length === 0 ? { code: 0, text: JSON.stringify(presetSchema, null, 2) } : BAD;
  const root = here();
  if (root === null) return noPreset(process.cwd());
  if (sub === "diagnose" && (rest.length === 0 || (rest.length === 1 && rest[0] === "--json"))) {
    const diagnosis = contractDiagnosis(root);
    return { code: 0, text: rest.length ? JSON.stringify(diagnosis, null, 2) : [
      `Installed engine: ${diagnosis.installed.engine} (core ${diagnosis.installed.core}). Project engine: ${diagnosis.project.engine ?? "unreadable"}; lock engine: ${diagnosis.project.lockEngine ?? "missing/unreadable"}.`,
      ...diagnosis.errors, ...diagnosis.next,
    ].join("\n") };
  }
  if (sub === "show" && (rest.length === 0 || (rest.length === 1 && rest[0] === "--json"))) {
    // JSON is the editable document, not an admission claim. Keep it readable
    // during migration even when the existing contract cannot be evaluated.
    if (rest[0] === "--json") return { code: 0, text: readFileSync(join(root, PRESET), "utf8").trimEnd() };
    const delegated = delegate(root, ["preset", ...args]);
    if (delegated !== null) return delegated;
    const loaded = lockOf(root);
    return typeof loaded === "string" ? { code: 1, text: formText({ cause: loaded, line: null }, null).full }
      : { code: 0, text: contract(loaded.lock, launcher()) };
  }
  if (sub === "compile" && (rest.length === 0 || (rest.length === 1 && rest[0] === "--yes"))) return compileTo(root, readFileSync(join(root, PRESET), "utf8"), rest.length === 1);
  if (sub === "apply") {
    const o = options(rest, [], ["--yes", "--preview"]);
    if (o !== null && rest.length <= 2 && o.operands.length === 1) return applyTo(root, o.operands[0]!, o.opts.has("--yes"), o.opts.has("--preview"));
  }
  return BAD;
}

// U2: the `path` sources pass `rules test` before anything compiles from them.
async function compileTo(root: string, presetText: string, yes = false): Promise<Result> {
  const tested = sourceDirs(presetText).map((dir) => testDir(resolve(root, dir)));
  if (tested.some((t) => !t.ok)) {
    return { code: 1, text: [...tested.flatMap((t) => t.lines), "rules test failed; lock not written."].join("\n") };
  }
  const r = validateContract({ presetText, filesOf: sourcesOf(root, true), versions: VERSIONS, now: clock });
  if ("errors" in r) return { code: 1, text: [...new Set([...r.errors, ...contractDiagnosis(root).errors]), "Preset compilation failed; lock not written.",
    "Source and rule validation continue only after schema and pin errors are resolved; more errors can remain in those later checks.",
    "Compilation is not migration. Inspect pregate preset diagnose --json; prepare pregate update --project --preview to review engine, core, packs and supported override corrections together."].join("\n") };
  // A lock that enforces less than both the one on disk and the committed one is written only after
  // a human approves it on the terminal, which then records that approval. Either one alone may be
  // a stale or hand-edited lock that this compile repairs.
  const references = [
    { lock: readText(join(root, LOCK)), preset: readText(join(root, PRESET)) },
    { lock: git(root, ["show", `HEAD:./${LOCK}`]), preset: git(root, ["show", `HEAD:./${PRESET}`]) },
  ].filter((ref) => ref.lock !== null);
  const diffs = references.map((ref) => ref.lock!.replaceAll("\r\n", "\n") === r.text ? null : reviewDiff(ref.lock, r.lock, bundledBetween(ref.preset, presetText)));
  const diff = diffs.length > 0 && diffs.every((d) => d?.warning === true) ? diffs[0]! : null;
  if (diff !== null) {
    if (!await approve(`Compile a looser lock for ${root}.\n${diff.lines.join("\n")}`, true, yes)) {
      return { code: 1, text: ["This preset loosens the contract:", ...diff.lines.map((line) => `  ${line}`), approvalRefusal({ roots: [root], command: "pregate preset compile" }), "Lock not written."].join("\n") };
    }
    writeAtomic(join(root, LOCK), r.text);
    recordApproval(root, r.text);
  } else writeAtomic(join(root, LOCK), r.text);
  return { code: 0, text: [`${LOCK} written (${r.lock.rules.length} rules); commit it.`, ...importReviewCost(root, r.lock)].join("\n") };
}

// U4: validate the agent's request for preview or human activation. It shows the request,
// then patches, validates and compiles; only approval activates preset and lock. An identical
// preview rerun keeps the approval code the human already saw.
async function applyTo(root: string, file: string, yes: boolean, preview: boolean): Promise<Result> {
  if (!existsSync(resolve(file))) return { code: 1, text: `${file} does not exist.` };
  const requestText = readFileSync(resolve(file), "utf8");
  const r = applyRequest(readFileSync(join(root, PRESET), "utf8"), requestText);
  if ("errors" in r) return { code: 1, text: [requestText.trimEnd(), ...r.errors, "Request not applied."].join("\n") };
  const done = await applyPreset(root, r.presetText, { yes, preview, request: canonical(resolve(file)), stable: true });
  return { code: done.code, text: `${requestText.trimEnd()}\n\n${done.text}` };
}

// A folder, or every `path` source of the preset here.
function rulesTest(args: string[]): Result {
  if (args.length === 2 && args[0] === "--fixture") return fixtureReplay(args[1]!);
  if (args.length === 2 && args[0] === "--library") {
    const files = librarySource(args[1]!, true);
    const tested = files === null ? { ok: false, lines: ["No bundled pack " + args[1] + ". Use pack list --library."] } : testFiles(files);
    return { code: tested.ok ? 0 : 1, text: tested.lines.join("\n") };
  }
  if (args.length > 1 || args.some((a) => a.startsWith("-"))) return BAD;
  const root = args.length === 0 ? here() : null;
  if (args.length === 0 && root === null) return noPreset(process.cwd());
  const dirs = args.length === 1 ? [resolve(args[0]!)] : sourceDirs(readFileSync(join(root!, PRESET), "utf8")).map((d) => resolve(root!, d));
  const tested = dirs.map(testDir);
  if (root !== null) {
    const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8")) as import("./types.ts").Preset;
    for (const source of preset.sources.filter((s) => s.kind === "git" || s.kind === "library")) {
      const files = sourcesOf(root, true)(source);
      const listed = files === null ? { errors: [`${source.ns}: pinned cache missing or corrupt`] } : listChecks(files);
      tested.push("errors" in listed ? { ok: false, lines: listed.errors } : { ok: true, lines: listed.ids.flatMap((id) => testCheck(files!, id, clock).lines) });
    }
  }
  const lines = tested.flatMap((t) => t.lines);
  return { code: tested.every((t) => t.ok) && lines.every((l) => l.startsWith("ok")) ? 0 : 1, text: tested.length === 0 ? "PREGATE: the preset has no path, Git or library sources." : lines.join("\n") };
}

function fixtureReplay(file: string): Result {
  try {
    const tested = testFixture(readFixture(file), clock);
    return { code: tested.ok ? 0 : 1, text: tested.lines.join("\n") };
  } catch (e) { return { code: 1, text: `Cannot replay fixture: ${(e as Error).message}` }; }
}

function testDir(dir: string): { ok: boolean; lines: string[] } {
  if (!existsSync(dir)) return { ok: false, lines: [`${dir}: not found`] };
  return testFiles(readTree(dir, true));
}

function testFiles(files: import("./types.ts").Files): { ok: boolean; lines: string[] } {
  const listed = listChecks(files);
  if ("errors" in listed) return { ok: false, lines: listed.errors };
  const runs = listed.ids.map((id) => testCheck(files, id, clock));
  return { ok: runs.every((r) => r.ok), lines: runs.flatMap((r) => r.lines) };
}

function installCommand(args: string[]): Result {
  const o = options(args, ["--ci"], ["--git-hook"]);
  const ci = o === null ? null : ciProviders(o.opts.get("--ci"));
  if (o === null || ci === null || o.operands.length > 0) return BAD;
  const root = here();
  if (root === null) return { code: 1, text: `No ${PRESET} here or above; create one (see catalog/presets) and run pregate preset compile.` };
  return install(root, { gitHook: o.opts.has("--git-hook"), ci });
}

// `--ci github` stays the Actions workflow. `vercel` is the build recipe. A comma list writes both.
function ciProviders(value: string | undefined): Array<"github-actions" | "vercel"> | null {
  if (value === undefined) return [];
  const providers: Array<"github-actions" | "vercel"> = [];
  for (const part of value.split(",")) {
    const name = part.trim();
    const id = name === "github" ? "github-actions" : name === "vercel" ? "vercel" : null;
    if (id === null || name === "") return null;
    if (!providers.includes(id)) providers.push(id);
  }
  return providers.length === 0 ? null : providers;
}

function prepareCommand(args: string[]): Promise<Result> | Result {
  const o = options(args, ["--version", "--engine"], []);
  if (o === null || o.operands.length > 0 || o.opts.size > 1) return BAD;
  return prepare({ version: o.opts.get("--version"), engine: o.opts.get("--engine") });
}

function updateCommand(args: string[]): Promise<Result> | Result {
  if (args.filter(arg => arg === "--projects").length === 1) return projectUpdates(args.filter(arg => arg !== "--projects"));
  if (args.filter((arg) => arg === "--project").length === 1) return withWorktrees(projectUpdate(args.filter((arg) => arg !== "--project")));
  const o = options(args, ["--version", "--engine"], []);
  if (o === null || o.operands.length > 0 || o.opts.size > 1) return BAD;
  return update({ version: o.opts.get("--version"), engine: o.opts.get("--engine") });
}

async function withWorktrees(pending: Promise<Result> | Result): Promise<Result> {
  const result = await pending, root = here();
  const hint = root === null ? [] : [...worktreeHint(root), ...registryHint(root)];
  return hint.length === 0 ? result : { code: result.code, text: [result.text, ...hint].join("\n") };
}

// ── Text ──────────────────────────────────────────────────────────────────────────

function describe(lock: Lock, r: LockRule): string {
  const owned = lock.ownedByArkgate.includes(r.id) ? " · owned by ArkGate, not evaluated" : "";
  const params = Object.entries(r.params).map(([k, v]) => `  ${k} = ${JSON.stringify(v)} (${r.origin[`params.${k}`] ?? "default"})`);
  return [
    `${r.id} · ${r.severity} (${r.origin.severity ?? "alias"}) · ${enforcementOf(lock, r)} (${r.origin.enforcement ?? "preset"}) · ${r.check}${r.integrity ? " · integrity" : ""}${owned}`,
    ...(r.versionGate ? [`version: ${r.versionGate.severity} when ${r.versionGate.package} ${r.versionGate.range} matches entirely; otherwise ${r.versionGate.unmatched === "skip" ? "the rule does not run" : r.severity}`] : []),
    `aliases: ${r.aliases.join(", ")}`,
    `phases: ${r.phases.join(", ")}`,
    "params:", ...params,
    `why: ${r.text.why}`,
    `fix: ${r.text.fix}`,
    ...(r.text.avoid === null ? [] : [`avoid: ${r.text.avoid}`]),
    `source: ${r.text.source}`,
  ].join("\n");
}

// Every rule that applies to `rel`.
function applying(lock: Lock, rel: string): string {
  const hit = (globs: unknown): boolean => Array.isArray(globs) && globs.some((g) => matches(String(g), rel));
  const rules = lock.rules.filter((r) => hit(r.params.paths) && !hit(r.params.exclude) && !lock.ownedByArkgate.includes(r.id));
  const layer = layerOf(lock, rel);
  const head = `${rel}: ${inScope(lock, rel) ? "in scope" : "out of scope (only placement rules apply)"}${layer === null ? "" : ` · layer ${layer}`}`;
  const lines = rules.map((r) => `${r.id} · ${r.severity} (${r.origin.severity ?? "alias"}) · ${enforcementOf(lock, r)} · ${r.phases.join(", ")} · ${r.check}`);
  return [head, ...lines].join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────────

function here(): string | null {
  return findRoot(canonical(process.cwd()), () => true);
}

function noPreset(dir: string): Result {
  return { code: 1, text: `PREGATE: no ${PRESET} in ${dir} or above.` };
}

// null when an option is unknown or lacks its value.
function options(args: string[], valued: string[], flags: string[]): { opts: Map<string, string>; operands: string[] } | null {
  const opts = new Map<string, string>();
  const operands: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (valued.includes(a)) {
      const value = args[++i];
      if (value === undefined) return null;
      opts.set(a, value);
    } else if (flags.includes(a)) opts.set(a, "");
    else if (a.startsWith("-")) return null;
    else operands.push(a);
  }
  return { opts, operands };
}
