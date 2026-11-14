import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { relativePath as relative } from "./paths.ts";
import { approvePending } from "./approval-command.ts";
import { approvalDeadline, proposeContract } from "./approval.ts";
import { ASSETS } from "./assets.ts";
import type { CiProviderId } from "./ci/provider.ts";
import { dataHome } from "./consent.ts";
import { validateContract } from "./contract.ts";
import { grammars, sourcesOf } from "./contract-diagnostic.ts";
import { canonical, findRoot, writeAtomic } from "./disk.ts";
import { git } from "./git.ts";
import { isObject, parse } from "./harness/wire.ts";
import { mergeProjectClaude, projectLauncherRel, projectOwnedCommand } from "./project-claude.ts";
import { clock, LOCK, PRESET, readText, VERSIONS } from "./admission.ts";
import { pendingReview } from "./pending-review.ts";
import { ENGINE_FILE, WINDOWS } from "./platform.ts";
import { ENGINE_VERSION } from "./product.ts";
import { merge } from "./register.ts";
import { pinnedEngine } from "./project-updates.ts";
import { sha256 } from "./state.ts";

// `pregate install` (MULTI-HARNESS MH-28): the pre-commit and the CI template, on request. The project
// launcher stays, and so do repository-owned Claude hooks (`pregate project setup`). A 0.1.0 handler
// is still removed: its guard only tested that the file existed, and it would run beside the current
// registration. Run twice, it leaves the same files. Messages are for the human (A18).

const HOOKS_DIR = ".pregate/git-hooks";
// The inline guard of every 0.1.0 handler, which ran the committed launcher.
const OLD_LAUNCHER = ".pregate/bin/pregate";
const OLD_GUARD = `/${OLD_LAUNCHER}"; [ -f "$f" ]`;

export function install(root: string, opts: { gitHook: boolean; ci: CiProviderId[] }): { code: 0 | 1; text: string } {
  const top = git(root, ["rev-parse", "--show-toplevel"])?.trim();
  if (top === undefined) return { code: 1, text: "PREGATE requires Git; this directory is not in a Git repository." };
  const settings = join(root, ".claude/settings.json");
  const before = existsSync(settings) ? readFileSync(settings, "utf8") : null;
  const after = before === null ? null : withoutOld(before);
  if (before !== null && after === null) return { code: 1, text: `${settings} is not a valid JSON object; fix it and rerun pregate install.` };
  const lines: string[] = [];
  if (after !== before) {
    writeAtomic(settings, after!);
    lines.push("Removed PREGATE 0.1.0 hooks from .claude/settings.json. Repository-owned hooks were left in place. Commit the change.");
  }
  if (existsSync(join(root, OLD_LAUNCHER)) && !reviewedLauncher(readText(join(root, OLD_LAUNCHER)) ?? "")) {
    rmSync(join(root, OLD_LAUNCHER));
    lines.push(`Removed ${OLD_LAUNCHER}; the launcher is global (pregate setup). Commit the removal.`);
  }
  if (opts.gitHook) lines.push(gitHook(root, top));
  if (opts.ci.includes("github-actions")) lines.push(ci(root, top));
  if (opts.ci.includes("vercel")) lines.push(vercel(root));
  if (lines.length === 0) lines.push("Nothing to do. Options: --git-hook, --ci github, and --ci vercel.");
  return { code: 0, text: lines.join("\n") };
}

// The reviewed project launcher (`pregate project launcher`) has the path of the 0.1.0 launcher and
// stays. It is known by the title line of its template and not by all of its bytes: the template of
// another engine version, or a checkout with CRLF line ends, is still the project's launcher, and the
// project's hooks deny every write without it.
const LAUNCHER_TITLE = "#!/bin/sh\n# Project launcher:";
function reviewedLauncher(text: string): boolean {
  return text.replaceAll("\r\n", "\n").startsWith(LAUNCHER_TITLE);
}

// The settings without the 0.1.0 handlers; a group left empty goes too. null: not a JSON object.
function withoutOld(text: string): string | null {
  const settings = parse(text);
  if (settings === null || (settings.hooks !== undefined && !isObject(settings.hooks))) return null;
  const hooks = settings.hooks ?? {};
  let changed = false;
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    const kept = groups.flatMap((g: unknown) => {
      if (!isObject(g) || !Array.isArray(g.hooks)) return [g];
      const handlers = g.hooks.filter((h: unknown) => !(isObject(h) && typeof h.command === "string" && h.command.includes(OLD_GUARD) && !projectOwnedCommand(h.command)));
      if (handlers.length === g.hooks.length) return [g];
      changed = true;
      return handlers.length === 0 ? [] : [{ ...g, hooks: handlers }];
    });
    if (kept.length === 0 && groups.length > 0) delete hooks[event];
    else hooks[event] = kept;
  }
  if (!changed) return text;
  if (Object.keys(hooks).length === 0) delete settings.hooks;
  return `${JSON.stringify(settings, null, 2)}\n`;
}

// §10.2.9: the committed pre-commit, activated through core.hooksPath unless the repo already has a
// hook manager, whose hooks core.hooksPath would silently switch off (§7.2 #19).
function gitHook(root: string, top: string): string {
  write(join(root, HOOKS_DIR, "pre-commit"), ASSETS["pre-commit.sh"]!, true);
  const path = relative(top, join(root, HOOKS_DIR));
  const current = git(root, ["config", "--get", "core.hooksPath"])?.trim() ?? "";
  if (current === path) return `Pre-commit enabled (core.hooksPath=${path}).`;
  const own = git(root, ["rev-parse", "--git-path", "hooks/pre-commit"])?.trim();
  const other = current !== "" ? `core.hooksPath=${current}`
    : [".husky", ".githooks", "lefthook.yml", ".lefthook.yml", "lefthook.yaml", ".lefthook.yaml"].find((f) => existsSync(join(top, f)))
      ?? (own !== undefined && existsSync(resolve(root, own)) ? ".git/hooks/pre-commit" : null);
  if (other !== null) return `This repo already manages hooks (${other}); core.hooksPath unchanged. Add to its pre-commit: sh ${join(path, "pre-commit")}`;
  if (git(root, ["config", "core.hooksPath", path]) === null) return `Could not set core.hooksPath; run: git config core.hooksPath ${path}`;
  return `Pre-commit enabled (core.hooksPath=${path}); commit ${HOOKS_DIR}/.`;
}

// The template installs the engine pinned on the base branch, so a pull request cannot swap the
// binary by editing its own lock (MH-28).
function ci(root: string, top: string): string {
  const workflow = join(top, ".github/workflows/pregate.yml");
  write(workflow, ASSETS["ci-github.yml"]!.replaceAll("@ROOT@", relative(top, root) || "."), false);
  return `CI template at ${relative(top, workflow)}; commit it.`;
}

const VERCEL_BUILD = "bash scripts/pregate-vercel-build.sh -- npm run build";

// The Vercel recipe is a build command, not a GitHub workflow. It can stand on a repository
// that has no Actions. An existing vercel.json keeps a buildCommand the user already chose.
function vercel(root: string): string {
  const script = join(root, "scripts/pregate-vercel-build.sh");
  write(script, ASSETS["ci-vercel-build.sh"]!, true);
  const config = join(root, "vercel.json");
  const lines = [`Vercel build recipe at ${relative(root, script)}. It installs the pinned linux-x64 release, runs the gate, then the framework build. Commit it.`];
  if (!existsSync(config)) {
    write(config, `${JSON.stringify({ $schema: "https://openapi.vercel.sh/vercel.json", buildCommand: VERCEL_BUILD }, null, 2)}\n`, false);
    lines.push(`vercel.json buildCommand is \`${VERCEL_BUILD}\`. Change the command after -- when the framework build is not npm run build.`);
    return lines.join("\n");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(config, "utf8")); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return [...lines, "vercel.json is not valid JSON, so it was left unchanged.", `Set its buildCommand to \`${VERCEL_BUILD}\`.`].join("\n");
  }
  if (!isObject(parsed)) return [...lines, "vercel.json is not a JSON object, so it was left unchanged.", `Set its buildCommand to \`${VERCEL_BUILD}\`.`].join("\n");
  const current = parsed.buildCommand;
  if (typeof current === "string" && current.includes("pregate-vercel-build.sh")) {
    lines.push("vercel.json already runs the Pregate build.");
    return lines.join("\n");
  }
  if (current !== undefined) {
    lines.push(`vercel.json already has a buildCommand, so it was left unchanged. Run the gate first: \`${VERCEL_BUILD}\`.`);
    return lines.join("\n");
  }
  const next: Record<string, unknown> = {
    ...parsed,
    $schema: typeof parsed.$schema === "string" ? parsed.$schema : "https://openapi.vercel.sh/vercel.json",
    buildCommand: VERCEL_BUILD,
  };
  write(config, `${JSON.stringify(next, null, 2)}\n`, false);
  lines.push("Added buildCommand to the existing vercel.json. It runs the gate, then npm run build.");
  return lines.join("\n");
}

function write(path: string, text: string, executable: boolean): void {
  mkdirSync(dirname(path), { recursive: true });
  writeAtomic(path, text);
  if (executable) chmodSync(path, 0o755);
}

// ── project launcher ─────────────────────────────────────────────────────────────────

// `pregate project launcher`: a reviewed launcher in the repository that runs the engine the lock
// pins from the user cache and never the launcher on PATH. It is a contract write, so it goes
// through the same proposal and human approval as a preset change.
type LauncherWrite = { path: string; before: string | null; after: string };
const LAUNCHER_USAGE = "usage: pregate project launcher [--preview|--yes]";
const LAUNCHER_DIR = ".pregate/bin";
const LAUNCHER_PS1 = "project-launcher.ps1";

// The last file is the one a hook names. cmd.exe reads CRLF and the asset is stored with LF. The
// .cmd calls the .ps1 next to it by the name written here.
export function projectLauncherFiles(windows = WINDOWS): { name: string; text: string }[] {
  if (!windows) return [{ name: "pregate", text: ASSETS["project-launcher.sh"]! }];
  return [
    { name: LAUNCHER_PS1, text: ASSETS[LAUNCHER_PS1]! },
    { name: "pregate.cmd", text: ASSETS["project-launcher.cmd"]!.replace(/\r?\n/g, "\r\n") },
  ];
}

function launcherWrites(root: string): LauncherWrite[] {
  return projectLauncherFiles().map((file) => {
    const path = join(root, LAUNCHER_DIR, file.name);
    return { path, before: readText(path), after: file.text };
  });
}

// The launcher's own test of an engine ([ -x ] && [ -s ]), for a regular file only.
function cachedEngine(pin: string): boolean {
  const s = statSync(join(dataHome(), pin, ENGINE_FILE), { throwIfNoEntry: false });
  return s !== undefined && s.isFile() && s.size > 0 && (WINDOWS || (s.mode & 0o111) !== 0);
}

// The pinned engine version, or why this project cannot have a launcher yet.
function launcherPin(root: string): { pin: string } | { error: string } {
  const pin = pinnedEngine(root);
  if (pin === null || !ENGINE_VERSION.test(pin)) {
    return { error: "This project has no valid engine pin. Inspect pregate preset diagnose --json and compile the lock first." };
  }
  if (!cachedEngine(pin)) {
    return { error: `Engine ${pin} is not installed in the cache. Run pregate prepare (or pregate prepare --engine ${pin}) before installing the project launcher.` };
  }
  return { pin };
}

// The digest of the pending review of these writes. The contract itself does not change.
async function proposeLauncher(root: string, presetText: string, writes: LauncherWrite[]): Promise<{ digest: string } | { error: string }> {
  await grammars();
  const compiled = validateContract({ presetText, filesOf: sourcesOf(root, true), versions: VERSIONS, now: clock });
  if ("errors" in compiled) return { error: compiled.errors.join("\n") };
  const baseline = sha256(presetText + (readText(join(root, LOCK)) ?? ""));
  approvalDeadline();
  const proposal = proposeContract({ root, baseline, lockText: compiled.text, activate: false, writes });
  return { digest: sha256(JSON.stringify(proposal)) };
}

// The review of project files that are not the contract: --preview prepares it, a human approves it.
async function reviewedWrites(root: string, writes: LauncherWrite[], header: string, flags: string[]): Promise<{ code: number; text: string }> {
  const presetText = readText(join(root, PRESET));
  if (presetText === null) return { code: 1, text: "No .pregate/preset.json; initialize or migrate the project first." };
  const proposed = await proposeLauncher(root, presetText, writes);
  if ("error" in proposed) return { code: 1, text: proposed.error };
  if (flags.includes("--preview")) {
    return { code: 0, text: `${header}\n${pendingReview(root, proposed.digest).text}\nProject unchanged until the human approves the digest.` };
  }
  const applied = await approvePending(root, flags.includes("--yes"), proposed.digest);
  return applied.code !== 0 ? applied : { code: 0, text: `${header}\n${applied.text}` };
}

export async function projectLauncher(args: string[]): Promise<{ code: number; text: string }> {
  if (args.length > 1 || args.some((a) => a !== "--preview" && a !== "--yes")) return { code: 1, text: LAUNCHER_USAGE };
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null) return { code: 1, text: "Run from a Git project with .pregate/pregate.lock.json." };
  const pinned = launcherPin(root);
  if ("error" in pinned) return { code: 1, text: pinned.error };
  const writes = launcherWrites(root);
  const where = writes.at(-1)!.path;
  if (writes.every((w) => w.before === w.after)) {
    return { code: 0, text: `Project launcher at ${where} already matches the reviewed template; engine ${pinned.pin} is cached.` };
  }
  const header = `Install a project-local launcher at ${where}. It runs engine ${pinned.pin} from the cache only (no PATH fallback).`;
  const done = await reviewedWrites(root, writes, header, args);
  if (done.code === 0 && !args.includes("--preview") && !WINDOWS) for (const w of writes) chmodSync(w.path, 0o755);
  return done;
}

// ── project hooks ────────────────────────────────────────────────────────────────────

// `pregate project hooks --harness claude-code`: the Claude Code registration in the project's own
// .claude/settings.json. Its handlers run the project launcher, so no file under the user's home
// names this project and none is written. Only the groups this command owns change (register.ts);
// the file is a reviewed change, like the launcher it names.
//
// `--harness codex` writes the Codex groups into the project's .codex/hooks.json in the same way.
// It records no Codex trust and writes nothing in the Codex home: Codex runs a hook only after its
// own review, and that review stays with the human (`/hooks`).
//
// `--harness cursor` writes Cursor's native groups into the project's .cursor/hooks.json. Cursor
// runs them only in a trusted workspace, and its cloud agents load that file from the repository.
// `--harness agy` writes the `pregate-project` named hook into the project's .agents/hooks.json.
const HOOKS_USAGE = "usage: pregate project hooks --harness claude-code [--preview|--yes]\n       pregate project hooks --harness codex [--preview|--yes]\n       pregate project hooks --harness cursor [--preview|--yes]\n       pregate project hooks --harness agy [--preview|--yes]";
export const PROJECT_SETTINGS = ".claude/settings.json";
export const PROJECT_CODEX_HOOKS = ".codex/hooks.json";
export const PROJECT_CURSOR_HOOKS = ".cursor/hooks.json";
export const PROJECT_AGY_HOOKS = ".agents/hooks.json";
const CODEX_REVIEW = "No Codex trust is recorded and the Codex home is not written. Codex runs a hook only after its own review: start Codex in this project and review the hooks with /hooks. A changed definition needs that review again. Until then, treat Codex as not gated in this project.";
const CURSOR_REVIEW = "Cursor runs project hooks only in a trusted workspace. Its cloud agents load this file from the repository too: there the hooks deny every write until the pinned engine is cached (pregate prepare), and enforce nothing without a local consent record on that machine.";
const PROJECT_HOOKS: Record<string, { target: "project" | "project-codex" | "project-cursor" | "project-agy"; file: string; name: string; note: string }> = {
  "claude-code": { target: "project", file: PROJECT_SETTINGS, name: "Claude Code", note: "" },
  codex: { target: "project-codex", file: PROJECT_CODEX_HOOKS, name: "Codex", note: ` ${CODEX_REVIEW}` },
  cursor: { target: "project-cursor", file: PROJECT_CURSOR_HOOKS, name: "Cursor", note: ` ${CURSOR_REVIEW}` },
  agy: { target: "project-agy", file: PROJECT_AGY_HOOKS, name: "Antigravity", note: "" },
};

// "ready": every launcher file is the reviewed template. "differs": a launcher is there and is not.
export function projectLauncherState(root: string): "ready" | "differs" | "missing" {
  const writes = launcherWrites(root);
  if (writes.every((w) => w.before === w.after)) return "ready";
  return writes.some((w) => w.before !== null) ? "differs" : "missing";
}

export async function projectHooks(args: string[]): Promise<{ code: number; text: string }> {
  const flags = args.slice(2);
  const harness = args[0] === "--harness" && args[1] !== undefined && Object.hasOwn(PROJECT_HOOKS, args[1]) ? PROJECT_HOOKS[args[1]]! : null;
  if (harness === null || flags.length > 1 || flags.some((a) => a !== "--preview" && a !== "--yes")) {
    return { code: 1, text: HOOKS_USAGE };
  }
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null) return { code: 1, text: "Run from a Git project with .pregate/pregate.lock.json." };
  if (projectLauncherState(root) !== "ready") {
    return { code: 1, text: `The project launcher in ${LAUNCHER_DIR} is missing or differs from the reviewed template. Run pregate project launcher --preview first; the hooks run that launcher.` };
  }
  const path = join(root, harness.file);
  const { name, note } = harness;
  const before = readText(path);
  const after = merge(before, harness.target, dataHome());
  const shape = harness.target === "project-agy" ? "a JSON object" : "a JSON object with event arrays";
  if (after === null) return { code: 1, text: `${path} must be ${shape}; left unchanged. Fix it and rerun pregate project hooks.` };
  if (after === before) return { code: 0, text: `${name} hooks in ${path} already run the project launcher; nothing changed.${note}` };
  const header = `Register the ${name} hooks in ${path}. They run the project launcher in ${LAUNCHER_DIR}; no file under the user's home is written. Other entries of the file are kept.${note}`;
  return reviewedWrites(root, [{ path, before, after }], header, flags);
}

// `pregate project setup`: merge repository-owned Claude hooks into .claude/settings.json. The hooks
// name the project launcher. Preparation, the launcher, workspace trust and policy consent stay
// separate steps, and nothing is written under HOME.
const PROJECT_SETUP_USAGE = "usage: pregate project setup";

export function projectClaudeSetup(args: string[]): { code: number; text: string } {
  if (args.length > 0) return { code: 1, text: PROJECT_SETUP_USAGE };
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null) return { code: 1, text: "Run from a Git project with .pregate/pregate.lock.json." };
  const pinned = launcherPin(root);
  if ("error" in pinned) return { code: 1, text: pinned.error };
  const missing = projectLauncherRel().filter((rel) => !readyLauncher(join(root, rel)));
  if (missing.length > 0) {
    return { code: 1, text: `The project launcher is not installed (${missing.join(", ")}). Run pregate project launcher before pregate project setup. Hooks do not fall back to a global launcher.` };
  }
  const settings = join(root, ".claude/settings.json");
  const before = readText(settings);
  const after = mergeProjectClaude(before);
  if (after === null) return { code: 1, text: `${settings} must be a JSON object with event arrays; left unchanged. Fix it and rerun pregate project setup.` };
  if (after === before) return { code: 0, text: `.claude/settings.json already has the repository-owned Claude hooks for engine ${pinned.pin}.` };
  mkdirSync(dirname(settings), { recursive: true });
  writeAtomic(settings, after);
  const where = join(root, projectLauncherRel().at(-1)!);
  return { code: 0, text: `Repository-owned Claude hooks merged into .claude/settings.json. They run ${where} for engine ${pinned.pin}. Other hook groups were left in place. Claude workspace trust is separate from policy consent (pregate enable).` };
}

function readyLauncher(path: string): boolean {
  const s = statSync(path, { throwIfNoEntry: false });
  return s !== undefined && s.isFile() && s.size > 0 && (WINDOWS || (s.mode & 0o111) !== 0);
}
