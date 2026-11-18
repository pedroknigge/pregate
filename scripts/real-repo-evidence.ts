#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import core from "../catalog/source.json" with { type: "json" };
import pkg from "../package.json" with { type: "json" };
import { VERIFIED as CURSOR_VERIFIED } from "../src/harness/cursor.ts";
import { compileBinary, hostTarget } from "./build.ts";

// Real-repository evidence for a release. Shallow-clones the pinned commits below,
// enables Pregate only in those clones, replays one fixed set of Cursor preToolUse
// payloads, and writes evidence/<version>/real-repos.md and real-repos.json.
// The isolated HOME is removed afterwards. The evidence directory is not.
// Pull-request CI does not run this script. See .github/workflows/real-repo-evidence.yml
// and .cursor/skills/verify-pregate/SKILL.md.
//
// Pins are the default-branch HEAD of each repository as resolved on 2026-11-18.

const ROOT = join(import.meta.dir, "..");
const FETCH_MS = 120_000;
const INIT_MS = 180_000;
const HOOK_MS = 60_000;

interface PinnedRepo {
  name: string;
  url: string;
  commit: string;
  language: string;
}

const REPOS: readonly PinnedRepo[] = [
  { name: "sindresorhus/ky", url: "https://github.com/sindresorhus/ky.git", commit: "3541888878c4d303a8bc2ad61815f4e048f55a5d", language: "TypeScript" },
  { name: "pypa/packaging", url: "https://github.com/pypa/packaging.git", commit: "6a69a83d8d89c6a01d554a8ad1b420cbb45fb4bc", language: "Python" },
  { name: "spf13/pflag", url: "https://github.com/spf13/pflag.git", commit: "d77ebfaebd65f3d860d1351b6b4b01827e54e8e5", language: "Go" },
  { name: "dtolnay/anyhow", url: "https://github.com/dtolnay/anyhow.git", commit: "dd0c0a655a214add8fc986df34ea3823468fa4fb", language: "Rust" },
  { name: "tj/commander.js", url: "https://github.com/tj/commander.js.git", commit: "a5a7dc084d4d2b7932e85ca049c5204e50a2c721", language: "JavaScript" },
];

type Feature = "edit-gate" | "shell-gate" | "enable-disable" | "pack-enable";
type Phase = "before-enable" | "after-enable";
type Expectation = "deny" | "allow";

type Action = {
  id: string;
  feature: Feature;
  phase: Phase;
  expect: Expectation;
  summary: string;
  witness: string | null;
} & ({ kind: "shell"; command: string } | { kind: "edit"; rel: string; content: string });

const SCRIPT = "#!/bin/sh\npregate disable --yes\n";
const NOTE = "Passing edit. This note does not change project code.\n";
const WIPED_PRESET = "{}\n";

const ACTIONS: readonly Action[] = [
  { id: "before-enable-no-verify", feature: "enable-disable", phase: "before-enable", kind: "shell", expect: "allow", witness: null,
    command: "git commit --no-verify -m \"agent skips hooks\"",
    summary: "Before pregate enable, a hook bypass is not enforced." },
  { id: "no-verify", feature: "shell-gate", phase: "after-enable", kind: "shell", expect: "deny", witness: null,
    command: "git commit --no-verify -m \"agent skips hooks\"",
    summary: "git commit --no-verify skips the hook." },
  { id: "disable", feature: "enable-disable", phase: "after-enable", kind: "shell", expect: "deny", witness: null,
    command: "pregate disable --yes",
    summary: "An agent shell cannot disable the project." },
  { id: "pack-enable", feature: "pack-enable", phase: "after-enable", kind: "shell", expect: "deny", witness: null,
    command: "pregate pack enable architecture/structure --yes",
    summary: "An agent shell cannot enable a methodology." },
  { id: "node-write", feature: "shell-gate", phase: "after-enable", kind: "shell", expect: "deny", witness: "agent-out.txt",
    command: "node -e 'require(\"fs\").writeFileSync(\"agent-out.txt\", \"x\")'",
    summary: "An inline Node write is a shell write." },
  { id: "status", feature: "shell-gate", phase: "after-enable", kind: "shell", expect: "allow", witness: null,
    command: "pregate status",
    summary: "pregate status is a read." },
  { id: "git-status", feature: "shell-gate", phase: "after-enable", kind: "shell", expect: "allow", witness: null,
    command: "git status --short",
    summary: "git status does not change the tree." },
  { id: "node-log", feature: "shell-gate", phase: "after-enable", kind: "shell", expect: "allow", witness: null,
    command: "node -e \"console.log(1)\"",
    summary: "A read-only Node one-liner stays allowed." },
  { id: "shell-script", feature: "edit-gate", phase: "after-enable", kind: "edit", expect: "deny", witness: "scripts/agent-disable.sh",
    rel: "scripts/agent-disable.sh", content: SCRIPT,
    summary: "A new shell script that disables Pregate is denied, and the file is not written." },
  { id: "preset", feature: "edit-gate", phase: "after-enable", kind: "edit", expect: "deny", witness: ".pregate/preset.json",
    rel: ".pregate/preset.json", content: WIPED_PRESET,
    summary: "Replacing .pregate/preset.json is a protected path, and the file bytes stay." },
  { id: "note", feature: "edit-gate", phase: "after-enable", kind: "edit", expect: "allow", witness: "notes/agent-pass.txt",
    rel: "notes/agent-pass.txt", content: NOTE,
    summary: "A plain note outside project code is allowed, and the harness then writes it." },
];

interface Spawned { code: number; stdout: string; stderr: string }

interface ActionResult {
  id: string;
  feature: Feature;
  phase: Phase;
  kind: "shell" | "edit";
  summary: string;
  action: string;
  expect: Expectation;
  decision: "deny" | "allow" | "unrecognized";
  exitCode: number;
  reason: string;
  fix: string;
  sideEffect: string;
  message: string;
}

interface RepoReport {
  name: string;
  url: string;
  language: string;
  commit: string;
  enabled: boolean;
  status: string;
  failures: string[];
  actions: ActionResult[];
  blocked: ActionResult[];
  allowed: ActionResult[];
  falsePositives: ActionResult[];
  falseNegatives: ActionResult[];
}

interface Report {
  pregateVersion: string;
  coreVersion: string;
  packageVersion: string;
  packageCoreVersion: string;
  binarySha256: string;
  target: string;
  cursorVerified: string;
  generatedAt: string;
  doctor: { cwd: string; exitCode: number; text: string };
  repos: RepoReport[];
}

function usage(): string {
  return [
    "usage: bun scripts/real-repo-evidence.ts [--out <dir>] [--repo <owner/name>]...",
    `pinned: ${REPOS.map((repo) => repo.name).join(", ")}`,
    "Default output is evidence/<package.json version>/ under this checkout.",
    "The run builds the host CLI into a temporary HOME and deletes that HOME at the end.",
  ].join("\n");
}

function parseArgs(argv: string[]): { out: string | null; repos: string[] } {
  const repos: string[] = [];
  let out: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--out") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) throw new Error(usage());
      out = value;
      continue;
    }
    if (arg === "--repo") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) throw new Error(usage());
      repos.push(value);
      continue;
    }
    throw new Error(`unknown argument ${arg}\n${usage()}`);
  }
  return { out, repos };
}

function selectRepos(names: string[]): PinnedRepo[] {
  if (names.length === 0) return [...REPOS];
  return names.map((name) => {
    const repo = REPOS.find((item) => item.name === name);
    if (repo === undefined) throw new Error(`unknown repo ${name}; pinned: ${REPOS.map((item) => item.name).join(", ")}`);
    return repo;
  });
}

function childEnv(root: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  const home = join(root, "home");
  env.HOME = home;
  env.XDG_CONFIG_HOME = join(root, "config");
  env.XDG_DATA_HOME = join(root, "data");
  env.XDG_STATE_HOME = join(root, "state");
  env.TMPDIR = join(root, "tmp");
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = join(home, ".gitconfig");
  env.GIT_TERMINAL_PROMPT = "0";
  env.CODEX_HOME = join(home, ".codex");
  env.GROK_HOME = join(home, ".grok");
  env.PATH = `${join(root, "engine", pkg.version)}${delimiter}${env.PATH ?? ""}`;
  env.PREGATE_UNATTENDED_APPROVAL = "1";
  delete env.CLAUDE_CONFIG_DIR;
  delete env.OPENCODE_CONFIG_DIR;
  delete env.PREGATE_TESTING;
  delete env.PREGATE_TEST_ANSWER;
  delete env.PREGATE_ACCEPT_CONTRACT;
  return env;
}

function spawn(cmd: string[], cwd: string, env: Record<string, string>, timeout: number, stdin?: string): Spawned {
  const result = Bun.spawnSync(cmd, {
    cwd, env, timeout, stdin: stdin === undefined ? "ignore" : Buffer.from(stdin), stdout: "pipe", stderr: "pipe",
  });
  return { code: result.exitCode ?? 1, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function git(repo: string, env: Record<string, string>, args: string[], timeout = FETCH_MS): Spawned {
  return spawn(["git", ...args], repo, env, timeout);
}

function requireGit(result: Spawned, what: string): void {
  if (result.code !== 0) throw new Error(`${what} failed (${result.code}): ${result.stderr.trim() || result.stdout.trim()}`);
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function snap(root: string, rel: string): { exists: boolean; sha256: string | null } {
  const path = join(root, rel);
  if (!existsSync(path)) return { exists: false, sha256: null };
  return { exists: true, sha256: sha256(readFileSync(path)) };
}

function cursorPayload(repo: string, id: string, action: Action): string {
  const toolInput = action.kind === "shell"
    ? { command: action.command, cwd: "" }
    : { file_path: join(repo, action.rel), content: action.content };
  return JSON.stringify({
    hook_event_name: "preToolUse",
    session_id: "verify-pregate",
    generation_id: id,
    tool_use_id: id,
    tool_name: action.kind === "shell" ? "Shell" : "Write",
    cursor_version: CURSOR_VERIFIED,
    workspace_roots: [repo],
    user_email: "verify@example.com",
    tool_input: toolInput,
  });
}

function readDecision(stdout: string): { decision: "deny" | "allow" | "unrecognized"; message: string } {
  const text = stdout.trim();
  if (text === "") return { decision: "unrecognized", message: "" };
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return { decision: "unrecognized", message: text }; }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { decision: "unrecognized", message: text };
  const record = parsed as Record<string, unknown>;
  const message = typeof record.user_message === "string" ? record.user_message
    : typeof record.agent_message === "string" ? record.agent_message : "";
  if (record.permission === "deny") return { decision: "deny", message };
  if (record.permission === "allow") return { decision: "allow", message: "" };
  return { decision: "unrecognized", message };
}

function reasonAndFix(message: string): { reason: string; fix: string } {
  const lines = message.split("\n").map((line) => line.trim()).filter((line) => line !== "");
  const reason = lines[0] ?? "";
  const fixLine = lines.find((line) => line.startsWith("Fix:"));
  if (fixLine !== undefined) return { reason, fix: fixLine.slice("Fix:".length).trim() };
  const paragraphs = message.split("\n\n").map((part) => part.trim()).filter((part) => part !== "");
  const protectedPath = paragraphs.find((part) => part.startsWith("PREGATE configuration"));
  if (protectedPath !== undefined) return { reason, fix: protectedPath };
  const closing = lines.find((line) => line.startsWith("Only the user can fix this") || line.startsWith("If you believe this is a false positive"));
  return { reason, fix: closing ?? "" };
}

function sameSnap(left: { exists: boolean; sha256: string | null }, right: { exists: boolean; sha256: string | null }): boolean {
  return left.exists === right.exists && left.sha256 === right.sha256;
}

function play(bin: string, repo: string, env: Record<string, string>, action: Action, index: number): ActionResult {
  const witness = action.witness;
  const before = witness === null ? null : snap(repo, witness);
  const payload = cursorPayload(repo, `${action.id}-${index}`, action);
  const hook = spawn([bin, "hook", "pre", "--harness", "cursor"], repo, env, HOOK_MS, payload);
  const read = readDecision(hook.stdout);
  let sideEffect = "command not executed; the hook does not run it";
  if (action.kind === "edit" && read.decision === "deny" && before !== null && witness !== null) {
    const after = snap(repo, witness);
    sideEffect = sameSnap(before, after) ? "file not written on deny" : "deny did not keep the file unchanged";
  } else if (action.kind === "edit" && read.decision === "allow") {
    const path = join(repo, action.rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, action.content);
    const after = snap(repo, action.rel);
    sideEffect = after.sha256 === sha256(action.content) ? "harness wrote the allowed file" : "allowed file bytes differ from the payload";
  } else if (action.kind === "shell" && witness !== null && before !== null) {
    const after = snap(repo, witness);
    sideEffect = sameSnap(before, after) ? "witness unchanged; command not executed" : "witness changed although the command was not executed";
  } else if (read.decision === "unrecognized") sideEffect = "no side effect applied; the hook reply was not a Cursor permission object";
  const text = reasonAndFix(read.message);
  const shown = action.kind === "shell" ? action.command : action.rel;
  return {
    id: action.id, feature: action.feature, phase: action.phase, kind: action.kind, summary: action.summary,
    action: shown, expect: action.expect, decision: read.decision, exitCode: hook.code,
    reason: text.reason, fix: text.fix, sideEffect, message: read.message,
  };
}

function classify(results: ActionResult[]): Pick<RepoReport, "blocked" | "allowed" | "falsePositives" | "falseNegatives"> {
  return {
    blocked: results.filter((item) => item.decision === "deny"),
    allowed: results.filter((item) => item.decision === "allow"),
    falsePositives: results.filter((item) => item.expect === "allow" && item.decision === "deny"),
    falseNegatives: results.filter((item) => item.expect === "deny" && item.decision !== "deny"),
  };
}

function sideEffectFailure(item: ActionResult): string | null {
  if (item.kind === "edit" && item.decision === "deny" && item.sideEffect !== "file not written on deny") return `${item.id}: ${item.sideEffect}`;
  if (item.kind === "edit" && item.decision === "allow" && item.sideEffect !== "harness wrote the allowed file") return `${item.id}: ${item.sideEffect}`;
  if (item.kind === "shell" && item.sideEffect.startsWith("witness changed")) return `${item.id}: ${item.sideEffect}`;
  if (item.decision === "unrecognized") return `${item.id}: hook reply was not {"permission":"allow"|"deny"}`;
  if (item.exitCode !== 0) return `${item.id}: hook exited ${item.exitCode}`;
  return null;
}

function cloneRepo(repo: PinnedRepo, dest: string, env: Record<string, string>): string {
  mkdirSync(dest, { recursive: true });
  requireGit(git(dest, env, ["init", "-q"]), `git init ${repo.name}`);
  requireGit(git(dest, env, ["remote", "add", "origin", repo.url]), `git remote ${repo.name}`);
  requireGit(git(dest, env, ["fetch", "--depth", "1", "origin", repo.commit]), `git fetch ${repo.name}`);
  requireGit(git(dest, env, ["checkout", "-q", "-B", "pregate-verify", "FETCH_HEAD"]), `git checkout ${repo.name}`);
  const head = git(dest, env, ["rev-parse", "HEAD"]).stdout.trim();
  if (head !== repo.commit) throw new Error(`${repo.name} checked out ${head}, pin is ${repo.commit}`);
  return realpathSync(dest);
}

function enableRepo(bin: string, repo: string, env: Record<string, string>): { enabled: boolean; status: string; failure: string | null } {
  const init = spawn([bin, "init", "--yes"], repo, env, INIT_MS);
  if (init.code !== 0) return { enabled: false, status: init.stdout, failure: `init exited ${init.code}: ${(init.stderr || init.stdout).trim()}` };
  const enable = spawn([bin, "enable", "--yes"], repo, env, HOOK_MS);
  if (enable.code !== 0) return { enabled: false, status: enable.stdout, failure: `enable exited ${enable.code}: ${(enable.stderr || enable.stdout).trim()}` };
  const status = spawn([bin, "status"], repo, env, HOOK_MS);
  const text = status.stdout.trim();
  if (status.code !== 0) return { enabled: false, status: text, failure: `status exited ${status.code}` };
  if (!text.includes("Local consent is active") || text.includes("Nothing is enforced")) {
    return { enabled: false, status: text, failure: "status does not show an enabled project" };
  }
  return { enabled: true, status: text, failure: null };
}

function examine(bin: string, pinned: PinnedRepo, dest: string, env: Record<string, string>): { report: RepoReport; root: string | null } {
  const failures: string[] = [];
  let repo = dest;
  try { repo = cloneRepo(pinned, dest, env); }
  catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    return { report: { ...emptyRepo(pinned), failures, status: "" }, root: null };
  }
  const before = ACTIONS.filter((action) => action.phase === "before-enable").map((action, index) => play(bin, repo, env, action, index));
  const enabled = enableRepo(bin, repo, env);
  if (enabled.failure !== null) failures.push(enabled.failure);
  const after = enabled.enabled
    ? ACTIONS.filter((action) => action.phase === "after-enable").map((action, index) => play(bin, repo, env, action, index))
    : [];
  const actions = [...before, ...after];
  for (const item of actions) {
    const problem = sideEffectFailure(item);
    if (problem !== null) failures.push(problem);
  }
  return {
    report: { name: pinned.name, url: pinned.url, language: pinned.language, commit: pinned.commit, enabled: enabled.enabled, status: enabled.status, failures, actions, ...classify(actions) },
    root: repo,
  };
}

function emptyRepo(pinned: PinnedRepo): Omit<RepoReport, "failures" | "status"> {
  return { name: pinned.name, url: pinned.url, language: pinned.language, commit: pinned.commit, enabled: false, actions: [], blocked: [], allowed: [], falsePositives: [], falseNegatives: [] };
}

function cell(text: string): string {
  const flat = text.replaceAll("|", "/").replaceAll("\n", " ").trim();
  return flat.length <= 240 ? flat : `${flat.slice(0, 237)}...`;
}

function markdown(report: Report): string {
  const lines = [
    "# Real repository evidence",
    "",
    `Pregate \`${report.pregateVersion}\` (core \`${report.coreVersion}\`). Package \`${report.packageVersion}\` (core \`${report.packageCoreVersion}\`).`,
    "",
    `Host target \`${report.target}\`. Binary SHA-256 \`${report.binarySha256}\`. Cursor payload version \`${report.cursorVerified}\`, the \`VERIFIED\` constant in \`src/harness/cursor.ts\`. Generated ${report.generatedAt}.`,
    "",
    "Enforcement runs only in a project where `pregate enable` ran. Each repository was shallow-cloned at the pinned commit into a temporary directory, then `pregate init --yes` and `pregate enable --yes` ran with `PREGATE_UNATTENDED_APPROVAL=1` already set in that isolated home. `init` leaves ordinary rules in shadow. Shell, protected-path, and control-text denials still block. The hook does not run the command and does not write the file. On deny the witness path is unchanged. On an allowed edit the harness writes the payload.",
    "",
    "## Doctor",
    "",
    `Exit ${report.doctor.exitCode}, cwd \`${report.doctor.cwd || "none"}\`.`,
    "",
    "```text",
    report.doctor.text.trim() === "" ? "(no doctor output)" : report.doctor.text.trim(),
    "```",
    "",
  ];
  for (const repo of report.repos) {
    lines.push(`## ${repo.name}`, "", `Language: ${repo.language}. Commit \`${repo.commit}\`. Enabled: ${repo.enabled ? "yes" : "no"}.`, "");
    if (repo.failures.length > 0) {
      lines.push("Failures:", "");
      for (const failure of repo.failures) lines.push(`- ${failure}`);
      lines.push("");
    }
    lines.push("### Blocked", "");
    lines.push("| Action | Reason | Fix | Side effect |", "| --- | --- | --- | --- |");
    if (repo.blocked.length === 0) lines.push("| _None._ |  |  |  |");
    for (const item of repo.blocked) lines.push(`| \`${cell(item.action)}\` | ${cell(item.reason)} | ${cell(item.fix)} | ${cell(item.sideEffect)} |`);
    lines.push("", "### Allowed", "");
    lines.push("| Action | Phase | Side effect |", "| --- | --- | --- |");
    if (repo.allowed.length === 0) lines.push("| _None._ |  |  |");
    for (const item of repo.allowed) lines.push(`| \`${cell(item.action)}\` | ${item.phase} | ${cell(item.sideEffect)} |`);
    lines.push("", "### False positive candidates", "");
    if (repo.falsePositives.length === 0) lines.push("_None._", "");
    else for (const item of repo.falsePositives) lines.push(`- \`${item.id}\` expected allow, got deny. ${cell(item.reason)}`);
    lines.push("", "### False negative candidates", "");
    if (repo.falseNegatives.length === 0) lines.push("_None._", "");
    else for (const item of repo.falseNegatives) lines.push(`- \`${item.id}\` expected deny, got ${item.decision}. ${cell(item.reason)}`);
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function versionOf(text: string): { engine: string; core: string } | null {
  const match = /^pregate (\S+) \(core (\S+)\)$/.exec(text.trim());
  if (match === null) return null;
  const engine = match[1];
  const coreVersion = match[2];
  if (engine === undefined || coreVersion === undefined) return null;
  return { engine, core: coreVersion };
}

function prepare(root: string): { bin: string; env: Record<string, string> } {
  for (const name of ["home", "config", "data", "state", "tmp", "repos"]) mkdirSync(join(root, name), { recursive: true });
  const env = childEnv(root);
  // engineHome() is dirname(dirname(execPath)). The clone lives under tmp, outside that directory.
  const bin = join(root, "engine", pkg.version, "pregate");
  mkdirSync(dirname(bin), { recursive: true });
  compileBinary(hostTarget(), bin);
  requireGit(git(root, env, ["config", "--global", "user.email", "pregate-verify@example.com"], HOOK_MS), "git user.email");
  requireGit(git(root, env, ["config", "--global", "user.name", "Pregate Verify"], HOOK_MS), "git user.name");
  requireGit(git(root, env, ["config", "--global", "commit.gpgsign", "false"], HOOK_MS), "git commit.gpgsign");
  return { bin, env };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const pinned = selectRepos(args.repos);
  const out = args.out === null ? join(ROOT, "evidence", pkg.version) : (args.out.startsWith("/") ? args.out : join(ROOT, args.out));
  const isolated = mkdtempSync(join(tmpdir(), "pregate-verify-"));
  try {
    const { bin, env } = prepare(isolated);
    const versionText = spawn([bin, "--version"], ROOT, env, HOOK_MS);
    const parsed = versionOf(versionText.stdout);
    if (versionText.code !== 0 || parsed === null) throw new Error(`pregate --version failed: ${versionText.stdout} ${versionText.stderr}`);
    if (parsed.engine !== pkg.version || parsed.core !== core.version) {
      throw new Error(`binary is pregate ${parsed.engine} (core ${parsed.core}); checkout is ${pkg.version} (core ${core.version})`);
    }
    const examined = pinned.map((repo) => examine(bin, repo, join(isolated, "repos", repo.name.replaceAll("/", "__")), env));
    const repos = examined.map((item) => item.report);
    const doctorRoot = examined.find((item) => item.report.enabled)?.root ?? "";
    const doctor = doctorRoot === "" ? { code: 1, stdout: "", stderr: "no enabled repository to run doctor in" }
      : spawn([bin, "doctor"], doctorRoot, env, HOOK_MS);
    const report: Report = {
      pregateVersion: parsed.engine,
      coreVersion: parsed.core,
      packageVersion: pkg.version,
      packageCoreVersion: core.version,
      binarySha256: sha256(readFileSync(bin)),
      target: hostTarget(),
      cursorVerified: CURSOR_VERIFIED,
      generatedAt: new Date().toISOString(),
      doctor: { cwd: doctorRoot, exitCode: doctor.code, text: `${doctor.stdout}${doctor.stderr}` },
      repos,
    };
    mkdirSync(out, { recursive: true });
    const md = join(out, "real-repos.md");
    const json = join(out, "real-repos.json");
    writeFileSync(md, markdown(report));
    writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`wrote ${md}`);
    console.log(`wrote ${json}`);
    for (const repo of repos) {
      console.log(`${repo.name}: blocked ${repo.blocked.length}, allowed ${repo.allowed.length}, false positives ${repo.falsePositives.length}, false negatives ${repo.falseNegatives.length}, failures ${repo.failures.length}`);
    }
    const bad = parsed.engine !== pkg.version || repos.some((repo) => !repo.enabled || repo.failures.length > 0 || repo.falsePositives.length > 0 || repo.falseNegatives.length > 0);
    return bad ? 1 : 0;
  } finally {
    rmSync(isolated, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  try { process.exitCode = main(); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
