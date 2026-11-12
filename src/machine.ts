import {
  chmodSync, closeSync, copyFileSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readlinkSync,
  readdirSync, renameSync, rmSync, type Stats, statSync, symlinkSync, writeFileSync, writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ASSETS } from "./assets.ts";
import { canonical, removeReleased, renameReleased } from "./disk.ts";
import { describeCi } from "./ci/detect.ts";
import { consentedPlaces, consentedRoots, dataHome, disable, enable, enabled, status } from "./consent.ts";
import { findRoot } from "./disk.ts";
import { launcherVersion } from "./inertia.ts";
import { readProposal } from "./proposal.ts";
import { cliVersion, TESTED as CODEX_TESTED } from "./harness/codex.ts";
import { compareVersions, ENGINE_VERSION, REPO } from "./product.ts";
import { VERSIONS } from "./versions.ts";
import { HARNESSES } from "./harness/profile.ts";
import { isObject, type Payload, parse } from "./harness/wire.ts";
import { AGY_PLUGIN, AGY_PROJECT_HOOK, agyPlugin, codexProjectTrust, drift, exact, gated, hookCommand, type MachineFiles, merge, mergeOpencode, opencodeState, ownedCommand, registered, type Target, unmerge, unmergeOpencode } from "./register.ts";
import { ENGINE_FILE, homeDir, WINDOWS } from "./platform.ts";
import { powershellCommand, PS_MODULES, psQuote } from "./windows-command.ts";
import { slash } from "./paths.ts";
import { stateDir } from "./state.ts";
import { installSkill, removeSkill, skillProblems } from "./skill.ts";
import type { HarnessId } from "./types.ts";
import { latestRelease } from "./release-download.ts";
import { verifiedEngineExtract } from "./release-install.ts";
import { pinnedEngine } from "./project-updates.ts";
import { PROJECT_AGY_HOOKS, PROJECT_CODEX_HOOKS, PROJECT_CURSOR_HOOKS, PROJECT_SETTINGS, projectLauncherState } from "./install.ts";
import { projectLauncherRel, projectScope } from "./project-claude.ts";

// Machine commands (MULTI-HARNESS MH-18, MH-22 to MH-27). Every write is tmp + fsync + rename and happens only when the bytes change, so a second run
// writes nothing; whatever cannot be done safely is left untouched and reported. setup exits 1 when no harness was wired or a real error occurred.
// A detected harness that cannot be wired is a warning with the next step, and does not fail setup when another harness was wired.

type Result = { code: 0 | 1; text: string };
type Line = { level: "ok" | "info" | "warn" | "fail"; text: string; wired?: boolean };
interface Paths {
  home: string; data: string; state: string; codexHome: string; grokHome: string; opencodeHome: string;
  shared: string[];   // ~/.claude/settings.json, then $CLAUDE_CONFIG_DIR/settings.json when it is another file
  launcher: string; link: string; plugin: string; trust: string;
}
// A hook process as the canary sees it.
interface Out { exit: number | null; stdout: string; stderr: string }

// MH-26: a harness is present when its home exists or its binary is on the PATH.
const BINARIES: Record<HarnessId, string[]> = { "claude-code": ["claude"], codex: ["codex"], cursor: ["cursor-agent", "agent"], grok: ["grok"], agy: ["agy"], opencode: ["opencode"] };
const SHARED: HarnessId[] = ["claude-code", "cursor", "grok"];
// The event part of a Codex trust key (<file>:<event>:<group>:<hook>).
const SNAKE: Record<string, string> = { PreToolUse: "pre_tool_use", Stop: "stop", SessionStart: "session_start", SubagentStart: "subagent_start", SubagentStop: "subagent_stop" };
const ok = (text: string, wired = false): Line => ({ level: "ok", text, ...(wired ? { wired: true } : {}) });
const info = (text: string, wired = false): Line => ({ level: "info", text, ...(wired ? { wired: true } : {}) });
const warn = (text: string): Line => ({ level: "warn", text });
const fail = (text: string): Line => ({ level: "fail", text });

// ── setup ────────────────────────────────────────────────────────────────────────────

// The running engine into <DATA>/<v>/, then the launcher, the CLI link and every registration of
// the harnesses found. The engine goes first: the launcher never names an engine that is not there.
export async function setup(): Promise<Result> {
  if (!Bun.main.startsWith("/$bunfs/") && !Bun.main.includes("~BUN/")) return { code: 1, text: "Run pregate setup from the compiled binary (bun run build)." };
  const p = paths();
  const failed = installEngine(p, process.execPath, VERSIONS.engine);
  if (failed !== null) return { code: 1, text: failed };
  const lines = [ok(`Engine ${VERSIONS.engine} installed at ${join(p.data, VERSIONS.engine)}.`), ...removeStaleCopies(p.data)];
  saveLauncher(p, VERSIONS.engine);
  lines.push(ok(`Launcher at ${p.launcher}.`), link(p));
  const found = detect(p);
  if (found.size === 0) lines.push(warn("No Claude Code, Codex, Cursor, Grok, agy or OpenCode found; no hooks registered. Install a harness and rerun pregate setup."));
  if (SHARED.some((h) => found.has(h))) lines.push(...p.shared.map((f) => register(f, "shared", p.data)));
  if (found.has("cursor")) lines.push(register(join(p.home, ".cursor/hooks.json"), "cursor", p.data));
  // An IDE or desktop app may run Codex or Antigravity without putting its CLI binary on PATH:
  // both global registrations are written either way.
  if (found.has("codex")) lines.push(await codex(p, found.get("codex") ?? null));
  if (found.has("agy")) lines.push(agy(p, found.get("agy") ?? null));
  if (found.has("opencode")) lines.push(opencode(p));
  installSkill();
  lines.push(ok("Installed /pregate skills. Global hooks remain inert until local worktree consent."));
  return finishSetup(lines);
}

// Exit 0 when at least one harness registration landed and nothing failed for real.
// A warning (Codex trust not confirmed, no harness found) stays in the text either way.
function finishSetup(lines: Line[]): Result {
  const result = report(lines);
  if (result.code !== 0 || lines.some((line) => line.wired)) return result;
  return { code: 1, text: result.text };
}

// guide and update keep going when setup only warned that nothing was wired. An ERROR line,
// a crash on stderr, or an exit that is not that warning still stops them.
export function setupBlocked(exit: number | null, stdout: string, stderr = ""): boolean {
  if (exit === 0) return false;
  if (exit !== 1 || stderr.trim() !== "") return true;
  const lines = stdout.split("\n");
  return lines.some((line) => line.startsWith("ERROR:")) || !lines.some((line) => line.startsWith("WARNING:"));
}

// MH-23 and MH-24 for one file. The first change to a file keeps its original as <file>.pregate.bak.
function register(file: string, t: Target, data: string): Line {
  const target = canonical(file);
  const before = read(target);
  const after = merge(before, t, data);
  if (after === null) return fail(`${file} must be a JSON object with event arrays; left unchanged. Fix it and rerun pregate setup.`);
  return ok(rewrite(target, before, after) ? `Hooks registered in ${file}.` : `${file}: unchanged.`, true);
}

// MH-24: Codex runs no user hook without trust, and a hook whose index moves loses it. setup trusts
// exactly the groups it wrote, and if a foreign hook that was trusted is not anymore, it puts the
// previous bytes back (which restores that trust) and fails.
async function codex(p: Paths, bin: string | null): Promise<Line> {
  const file = join(p.codexHome, "hooks.json");
  const target = canonical(file);
  const before = read(target);
  const after = merge(before, "codex", p.data);
  if (after === null) return fail(`${file} must be a JSON object with event arrays; left unchanged. Fix it and rerun pregate setup.`);
  if (bin === null) {
    rewrite(target, before, after);
    return info(`codex: binary not on PATH; hooks registered in ${file} but not trusted. Codex runs them only after approval in /hooks; put codex on PATH and rerun pregate setup to trust them.`, true);
  }
  const ours = owner(file, target, slots(after, p.data));
  // The photo is taken before the write. A key is ours when its command names this installation,
  // not when it will sit where the new group lands: an older group the merge drops would otherwise
  // look foreign and force a restore (MH-24).
  const ownBefore = oursKeys(file, target, before, p.data);
  // Codex refuses to start when CODEX_HOME names a folder that does not exist yet; setup is about to
  // write hooks.json there anyway.
  mkdirSync(p.codexHome, { recursive: true });
  const server = appServer(bin);
  return trustCodexHooks({ server, file, target, before, after, ours, ownBefore, trust: p.trust, wrote: false });
}

interface CodexInstall {
  server: Server; file: string; target: string; before: string | null; after: string;
  ours: ReturnType<typeof owner>; ownBefore: ReturnType<typeof oursKeys>; trust: string; wrote: boolean;
}

async function trustCodexHooks(i: CodexInstall): Promise<Line> {
  try {
    const photo = (await hooksList(i.server)).filter((h) => h.trustStatus === "trusted" && !i.ownBefore.has(h.key)).map((h) => h.key);
    i.wrote = rewrite(i.target, i.before, i.after);
    const pending = (await hooksList(i.server)).filter((h) => i.ours(h.key) && (h.trustStatus === "untrusted" || h.trustStatus === "modified"));
    const value = Object.fromEntries(pending.map((h) => [h.key, { trusted_hash: h.currentHash }]));
    if (pending.length > 0) await i.server.call("config/batchWrite", { edits: [{ keyPath: "hooks.state", mergeStrategy: "upsert", value }] });
    const now = await hooksList(i.server);
    const trusted = now.filter((h) => i.ours(h.key) && h.trustStatus === "trusted");
    const lost = photo.filter((k) => now.find((h) => h.key === k)?.trustStatus !== "trusted");
    if (trusted.length === Object.keys(SNAKE).length && lost.length === 0) {
      save(i.trust, `${JSON.stringify(Object.fromEntries(trusted.map((h) => [h.key, h.currentHash])), null, 2)}\n`);
      return ok(`Codex: hooks registered in ${i.file} and trusted.`, true);
    }
    if (i.wrote) save(i.target, i.before);
    // A foreign hook that lost trust is a real error: the previous bytes are restored and setup fails.
    // PREGATE's own trust not being confirmed leaves the file unchanged and is a warning. The caller
    // exits 0 when some other harness was wired.
    if (lost.length > 0) return fail(`Codex: these third-party hooks lost trust: ${lost.join(", ")}. Left ${i.file} unchanged.`);
    return warn(`Codex: Codex did not confirm trust for the PREGATE hooks. Left ${i.file} unchanged. Approve them in Codex with /hooks, then rerun pregate setup.`);
  } catch (e) {
    if (i.wrote) save(i.target, i.before);
    return fail(`Codex: ${(e as Error).message}. Left ${i.file} unchanged; rerun pregate setup.`);
  } finally {
    i.server.close();
  }
}

// Use a global identity so a disabled project plugin named pregate cannot shadow this installation.
// Antigravity 2.0 and Antigravity IDE read ~/.gemini/config/plugins/<name>/ directly, so when agy
// is not on PATH the plugin directory is written atomically in place.
function agy(p: Paths, bin: string | null): Line {
  const files = agyPlugin(p.data, VERSIONS.engine);
  const current = (): boolean => Object.entries(files).every(([f, text]) => read(join(p.plugin, f)) === text);
  if (bin === null) {
    for (const [f, text] of Object.entries(files)) save(join(p.plugin, f), text);
    if (agyDisabled(p)) return fail("agy: pregate-global is disabled (plugins.pregate-global.enabled = false in ~/.gemini/config/config.json); enable it.");
    return info(`agy: binary not on PATH; pregate-global plugin installed at ${p.plugin} for Antigravity IDE/App.`, true);
  }
  let done = "agy plugin: unchanged.";
  if (!current()) {
    const dir = join(mkdtempSync(join(tmpdir(), "pregate-agy-")), AGY_PLUGIN);
    mkdirSync(dir);
    for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
    const r = spawn([bin, "plugin", "install", dir]);
    rmSync(dirname(dir), { recursive: true, force: true });
    if (!current()) return fail(`agy plugin install did not install pregate-global (exit ${r.exit}): ${clip(r.stderr || r.stdout)}`);
    done = `pregate-global plugin installed at ${p.plugin}.`;
  }
  return agyDisabled(p) ? fail("agy: pregate-global is disabled (plugins.pregate-global.enabled = false in ~/.gemini/config/config.json); enable it.") : ok(done, true);
}

// OpenCode reads a plugin folder named by its own `plugins` array. setup writes the shim and adds
// that one entry; every other entry of the file, and every other key, stays. A disabled entry (a
// leading - or !) is the human's switch and is never turned back on here.

// OpenCode's plugin folder. register.ts stays pure: the path, the environment and the asset live here.
function opencodePluginDir(p: Paths): string {
  return slash(join(p.opencodeHome, "pregate"));
}

// opencode.json, or opencode.jsonc when that is the file the user keeps. Neither: opencode.json.
function opencodeConfigFile(p: Paths): string {
  const json = join(p.opencodeHome, "opencode.json"), jsonc = join(p.opencodeHome, "opencode.jsonc");
  return existsSync(json) || !existsSync(jsonc) ? json : jsonc;
}

// What setup writes at <opencodeHome>/pregate/index.ts: the shim that runs this installation.
function opencodePluginSource(p: Paths): string {
  return ASSETS["opencode/pregate/index.ts"]!.replaceAll("@PREGATE_LAUNCHER@", slash(`${p.data}/bin/${WINDOWS ? "pregate.cmd" : "pregate"}`));
}

// The plugin and its entry are both needed: one without the other gates nothing.
function opencodeDrift(p: Paths): string[] {
  const dir = opencodePluginDir(p), file = join(dir, "index.ts"), target = opencodeConfigFile(p);
  const plugin = read(file), config = read(target);
  const out: string[] = [];
  if (plugin === null && config !== null) out.push(`${file}: the PREGATE plugin is missing; run pregate setup.`);
  else if (plugin !== null && plugin !== opencodePluginSource(p)) out.push(`${file}: the PREGATE plugin differs from the reviewed one; run pregate setup.`);
  if (config !== null) {
    const state = opencodeState(config, dir);
    if (state === "invalid") out.push(`${target}: plugins must be an array; fix it and rerun pregate setup.`);
    else if (state === "missing") out.push(`${target}: the PREGATE plugin is not listed in plugins; run pregate setup.`);
    else if (state === "disabled") out.push(`${target}: the PREGATE plugin entry is disabled (leading - or !); enable it to gate OpenCode.`);
  }
  return out;
}

// Registered and unchanged: the folder is ours and the entry names it.
function opencodeGated(p: Paths): boolean {
  return read(join(opencodePluginDir(p), "index.ts")) === opencodePluginSource(p) && opencodeState(read(opencodeConfigFile(p)), opencodePluginDir(p)) === "ready";
}

function opencode(p: Paths): Line {
  const dir = opencodePluginDir(p), file = join(dir, "index.ts");
  save(file, opencodePluginSource(p));
  const target = canonical(opencodeConfigFile(p));
  const before = read(target), after = mergeOpencode(before, dir);
  if (after === null) return fail(`${target} must be a JSON object whose "plugins" is an array; left unchanged. Fix it and rerun pregate setup.`);
  rewrite(target, before, after);
  const state = opencodeState(read(target), dir);
  if (state === "disabled") return warn(`OpenCode: the PREGATE plugin entry in ${target} is disabled; remove the leading - or ! to gate OpenCode.`);
  if (state !== "ready") return fail(`OpenCode: ${target} does not list ${dir} in plugins; run pregate setup.`);
  return ok(`OpenCode: PREGATE plugin at ${file}, listed in ${target}.`, true);
}

// The mirror of unregister for the `plugins` array: our entry goes, the user's list stays.
function unregisterOpencode(p: Paths): Line | null {
  const target = canonical(opencodeConfigFile(p));
  const before = read(target);
  if (before === null) return null;
  const r = unmergeOpencode(before, opencodePluginDir(p));
  if (r === null) return fail(`${target} must be a JSON object whose "plugins" is an array; the PREGATE entry was left unchanged. Fix it and rerun pregate uninstall.`);
  const bak = read(`${target}.pregate.bak`);
  // The plugins key was setup's only change: the file goes with it.
  if (bak === null && sameJson(r.text, "{}")) {
    save(target, null);
    return ok(`PREGATE plugin entry removed from ${target}.`);
  }
  const after = bak !== null && sameJson(r.text, bak) ? bak : r.text;
  if (!rewrite(target, before, after)) return null;
  return ok(`PREGATE plugin entry removed from ${target}.`);
}

// ~/.local/bin/pregate → the launcher. Anything else already there is not ours to replace.
function link(p: Paths): Line {
  if (WINDOWS) {
    const text = `@echo off\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1" %*\r\nexit /b %errorlevel%\r\n`;
    if (existsSync(p.link) && read(p.link) !== text) return fail(`${p.link} already exists and is not PREGATE's; left unchanged.`);
    save(p.link, text);
    const bash = `#!/bin/sh\nexec powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File '${slash(p.launcher).replaceAll("'", "'\\''")}' "$@"\n`;
    save(join(p.data, "bin/pregate"), bash, 0o755);
    return ok(`CLI at ${p.link}; add ${dirname(p.link)} to PATH.`);
  }
  const s = stats(p.link, false);
  if (s === null) {
    mkdirSync(dirname(p.link), { recursive: true });
    symlinkSync(p.launcher, p.link);
  } else if (!s.isSymbolicLink() || readlinkSync(p.link) !== p.launcher) {
    return fail(`${p.link} already exists and does not point to ${p.launcher}; left unchanged. Remove it and rerun pregate setup.`);
  }
  return ok(`CLI at ${p.link}.`);
}

// ── update ───────────────────────────────────────────────────────────────────────────

// MH-27: the new engine is downloaded, verified and warmed up next to the others; only then does the
// launcher name it, and that engine's own setup runs. Every registered project that pins an older
// engine gets one preview from it; no active contract is touched. Engines no project pins any more
// are removed. --engine installs an engine a lock asks for and nothing else.
export async function update(o: { version?: string; engine?: string }): Promise<Result> {
  const p = paths();
  const asked = o.engine ?? o.version ?? latestRelease();
  if (typeof asked !== "string") return { code: 1, text: `Could not query the latest release of ${REPO}: ${asked.error}` };
  const v = asked.trim().replace(/^v/, "");
  if (!ENGINE_VERSION.test(v)) return { code: 1, text: `Invalid version: ${asked.trim()} (expected X.Y.Z or X.Y.Z-pre).` };
  const engine = join(p.data, v, ENGINE_FILE);
  const failed = ready(engine) ? null : download(p, v);
  if (failed !== null) return { code: 1, text: failed };
  if (o.engine !== undefined) return { code: 0, text: `Engine ${v} installed at ${dirname(engine)}.` };
  const previous = launcherVersion(p.data);
  saveLauncher(p, v);
  const r = spawn([engine, "setup"], 600_000);
  // A warning that no harness was wired still leaves a usable engine. A real setup error does not.
  const blocked = setupBlocked(r.exit, r.stdout, r.stderr);
  // Loaded here, not at the top: hooks import this module and must not load the update path.
  const registry = await import("./project-updates.ts");
  const review = blocked ? null : projectReviews(p, registry, engine, v);
  const pruned = blocked ? [] : pruneEngines(p.data, retained(p, registry, [v, previous]));
  // The new engine's setup opens with its own install line; this one already says it.
  const setupLines = r.stdout.trim().split("\n").filter((line) => line !== `Engine ${v} installed at ${dirname(engine)}.`).join("\n");
  const text = [`Engine ${v} installed at ${dirname(engine)}; the launcher now uses it.`, setupLines, r.stderr.trim(), ...(review?.lines ?? []), ...pruned]
    .filter((s) => s !== "").join("\n");
  return { code: !blocked && (review === null || review.exit === 0) ? 0 : 1, text };
}

// One batch preview, by the new engine, of every enabled registered project (with its worktrees)
// and the current one whose lock pins an older engine. A newer pin is never downgraded.
type Registry = typeof import("./project-updates.ts");

function projectReviews(p: Paths, registry: Registry, engine: string, v: string): { exit: number | null; lines: string[] } {
  const root = findRoot(canonical(process.cwd()), () => true);
  const registered = [...consentedRoots(p.data).filter((entry) => entry.enabled).map((entry) => entry.root), ...inheriting(p, registry)];
  const candidates = root === null ? registered : [...registered, root];
  const stale = registry.staleProjects(candidates, v);
  if (root !== null && registry.pinnedEngine(root) === null && !stale.includes(root)) stale.push(root);
  if (stale.length === 0) return { exit: 0, lines: candidates.length === 0 ? [] : ["All registered projects are current."] };
  if (!ready(engine)) return { exit: 1, lines: [`Engine ${v} is missing or not executable after setup; no project review was prepared. The human can run ! pregate update --engine ${v}, then pregate doctor.`] };
  // One run, so every prepared review shares one batch approval code. The current project's review
  // decides the exit: another registered project that cannot be previewed never fails the update.
  const run = spawn([engine, "update", "--projects", ...stale, "--preview"], 600_000);
  const ownFailed = root !== null && stale.includes(root) && run.exit !== 0 && !reviewTo(root, v, p.data);
  const othersFailed = run.exit !== 0 && !ownFailed && stale.some((dir) => dir !== root);
  return { exit: ownFailed ? run.exit : 0, lines: [run.stdout.trim(), run.stderr.trim(),
    ...(othersFailed ? ["WARNING: Some registered project reviews failed (named above). The engine update and the other reviews are unaffected; fix those projects and rerun pregate update."] : []),
    "Each project's preset, lock and consent remain unchanged until approval. Run pregate status to inspect effective protection."] };
}

// Whether `root` holds a pending review that moves its lock to engine `v`: its preview succeeded.
function reviewTo(root: string, v: string, data: string): boolean {
  const proposal = readProposal(root, data);
  return proposal !== null && (JSON.parse(proposal.lockText) as { engine?: unknown }).engine === v;
}

// Worktrees gated only through a repository-wide consent record (no record of their own).
function inheriting(p: Paths, registry: Registry): string[] {
  return consentedPlaces(p.data).repos.flatMap(registry.repoWorktrees).filter((dir) => consentOf(dir, p.data));
}

function consentOf(dir: string, data: string): boolean {
  try {
    return enabled(dir, data);
  } catch {
    return false;   // an unreadable .git pointer: its hooks fail closed on their own; nothing to review
  }
}

// Engines to keep: the new and previous launcher versions, the running one, and every engine pinned
// by a consented root, its worktrees, or any worktree of a consented repository (enabled or not,
// with or without a preset). Pruning a pin would fail closed there.
function retained(p: Paths, registry: Registry, versions: (string | null)[]): Set<string> {
  const root = findRoot(canonical(process.cwd()), () => true);
  const places = consentedPlaces(p.data);
  const roots = [...places.roots, ...(root === null ? [] : [root])];
  const dirs = [...roots.flatMap((dir) => [dir, ...registry.worktreesOf(dir)]), ...places.repos.flatMap(registry.repoWorktrees)];
  const pins = dirs.map(registry.pinnedEngine);
  return new Set([...versions, VERSIONS.engine, ...pins].filter((v): v is string => v !== null && ENGINE_VERSION.test(v)));
}

function pruneEngines(data: string, keep: Set<string>): string[] {
  const removed: string[] = [], failed: string[] = [];
  const engines = readdirSync(data, { withFileTypes: true }).filter((e) => e.isDirectory() && ENGINE_VERSION.test(e.name) && !keep.has(e.name));
  for (const { name } of engines) {
    const error = removeEngine(join(data, name));
    if (error === null) removed.push(name); else failed.push(`${name} (${error})`);
  }
  return [...(removed.length === 0 ? [] : [`Removed ${removed.length} older engines (${removed.join(", ")}); kept ${[...keep].sort().join(", ")}.`]),
    ...(failed.length === 0 ? [] : [`WARNING: Could not remove older engines: ${failed.join(", ")}. Rerun pregate update later.`])];
}

// null when removed; otherwise why it stays (on Windows, an engine that is running).
function removeEngine(dir: string): string | null {
  try {
    rmSync(dir, { recursive: true, force: true });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// The release archive of this platform, checked against SHA256SUMS and optional signatures, then installed.
function download(p: Paths, v: string): string | null {
  const dir = mkdtempSync(join(tmpdir(), "pregate-update-"));
  try {
    const extracted = verifiedEngineExtract(v, dir);
    if ("error" in extracted) return extracted.error;
    return installEngine(p, extracted.binary, v);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Downloads and verifies a release engine into the cache only. No harness registration, launcher, link or skills.
export async function prepare(o: { version?: string; engine?: string }): Promise<Result> {
  let asked = o.engine ?? o.version;
  if (asked === undefined) {
    const root = findRoot(canonical(process.cwd()), () => true);
    if (root === null) return { code: 1, text: "No engine version given and this directory is not in a Git project. Use pregate prepare --engine <v> or run from a project root with .pregate/pregate.lock.json." };
    const pin = pinnedEngine(root);
    if (pin === null) return { code: 1, text: "No engine version given and this project has no lock. Use pregate prepare --engine <v>." };
    if (pin === "" || !ENGINE_VERSION.test(pin)) return { code: 1, text: "This project's lock has no valid engine pin. Inspect pregate preset diagnose --json and use pregate prepare --engine <v>." };
    asked = pin;
  }
  const v = asked.trim().replace(/^v/, "");
  if (!ENGINE_VERSION.test(v)) return { code: 1, text: `Invalid version: ${asked.trim()} (expected X.Y.Z or X.Y.Z-pre).` };
  const p = paths();
  const engine = join(p.data, v, ENGINE_FILE);
  if (ready(engine)) return { code: 0, text: `Engine ${v} is already installed at ${dirname(engine)}.` };
  const dir = mkdtempSync(join(tmpdir(), "pregate-prepare-"));
  try {
    const extracted = verifiedEngineExtract(v, dir);
    if ("error" in extracted) return { code: 1, text: extracted.error };
    const failed = installEngine(p, extracted.binary, v);
    if (failed !== null) return { code: 1, text: failed };
    const extra = extracted.notices.length === 0 ? "" : `\n${extracted.notices.join("\n")}`;
    return { code: 0, text: `Engine ${v} installed at ${dirname(engine)}.${extra}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── uninstall ────────────────────────────────────────────────────────────────────────

// MH-27, in reverse: registrations by marker, the agy plugin, the link if it is ours, the launcher
// and the engines. The repos' .pregate/ and the backups stay.
export async function uninstall(purge: boolean): Promise<Result> {
  const p = paths();
  removeSkill();
  const lines: (Line | null)[] = p.shared.map((f) => unregister(f, "shared", p));
  lines.push(unregister(join(p.codexHome, "hooks.json"), "codex", p));
  lines.push(unregister(join(p.home, ".cursor/hooks.json"), "cursor", p));
  if (existsSync(p.plugin)) {
    const bin = which("agy");
    if (bin !== null) spawn([bin, "plugin", "uninstall", AGY_PLUGIN]);
    rmSync(p.plugin, { recursive: true, force: true });   // agy plugin uninstall is [E2E]
    lines.push(ok(`agy plugin removed from ${p.plugin}.`));
  }
  lines.push(unregisterOpencode(p));
  const pluginDir = opencodePluginDir(p);
  if (existsSync(pluginDir)) {
    rmSync(pluginDir, { recursive: true, force: true });
    lines.push(ok(`OpenCode plugin removed from ${pluginDir}.`));
  }
  const s = stats(p.link, false);
  if (s?.isSymbolicLink() === true && readlinkSync(p.link) === p.launcher) rmSync(p.link);
  lines.push(unpath(p));
  releaseTrust(p);
  removeData(p.data);
  rmSync(p.trust, { force: true });
  if (purge) rmSync(p.state, { recursive: true, force: true });
  lines.push(ok(`Removed ${p.data}${purge ? ` and ${p.state}` : ""}. Repo .pregate/ directories are preserved.`));
  const kept = [...p.shared, join(p.codexHome, "hooks.json"), join(p.home, ".cursor/hooks.json"), opencodeConfigFile(p)].map((f) => `${canonical(f)}.pregate.bak`).filter((f) => existsSync(f));
  if (kept.length > 0) lines.push(ok(`Backups from before the first setup remain: ${kept.join(", ")}.`));
  return report(lines.filter((l): l is Line => l !== null));
}

// The mirror of install.ps1: drop the launcher folder it put on the user PATH, keeping every other
// entry raw (REG_EXPAND_SZ). PREGATE_NO_MODIFY_PATH and PREGATE_PATH_KEY mean what they mean there.
function unpath(p: Paths): Line | null {
  if (!WINDOWS || process.env.PREGATE_NO_MODIFY_PATH === "1") return null;
  const key = process.env.PREGATE_PATH_KEY || "Environment";
  const refresh = key === "Environment"
    ? "[Environment]::SetEnvironmentVariable('PREGATE_PATH_REFRESH','1','User'); [Environment]::SetEnvironmentVariable('PREGATE_PATH_REFRESH',$null,'User'); " : "";
  const script = `${PS_MODULES}$ErrorActionPreference='Stop'; $bin=[IO.Path]::GetFullPath(${psQuote(dirname(p.link))}).TrimEnd('\\'); `
    + `$k=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey(${psQuote(key)}, $true); if (!$k) { exit 0 }; try { `
    + `$all=@([string]$k.GetValue('Path','',[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -split ';' | Where-Object { $_ -ne '' }); `
    + `$keep=@($all | Where-Object { [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\\') -ine $bin }); if ($keep.Count -eq $all.Count) { exit 0 }; `
    + `$k.SetValue('Path', ($keep -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString); ${refresh}[Console]::Out.Write('removed') } finally { $k.Close() }`;
  const r = spawn(["powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], 30_000);
  if (r.exit !== 0) return warn(`Could not remove ${dirname(p.link)} from your user PATH; remove it by hand.`);
  return r.stdout.trim() === "removed" ? ok(`Removed ${dirname(p.link)} from your user PATH.`) : null;
}

// Codex keeps no trust for a foreign hook whose index moved: the user approves it again in /hooks.
function unregister(file: string, t: Target, p: Paths): Line | null {
  const target = canonical(file);
  const before = read(target);
  if (before === null) return null;
  const r = unmerge(before, t, p.data);
  if (r === null) return fail(`${file} must be a JSON object with event arrays; hooks left unchanged. Fix it and rerun pregate uninstall.`);
  // unmerge re-stringifies. When that leaves exactly the file from before setup, write those bytes
  // back: the backup is the copy that still has the owner's formatting (MH-23, MH-27).
  const bak = read(`${target}.pregate.bak`);
  if (t === "cursor" && bak === null && sameJson(r.text, '{"version":1,"hooks":{}}')) {
    save(target, null);
    return ok(`PREGATE hooks removed from ${file}.`);
  }
  const after = bak !== null && sameJson(r.text, bak) ? bak : r.text;
  if (!rewrite(target, before, after)) return null;
  const moved = r.shifted.map((k) => `${target}:${k}`);
  return moved.length === 0 ? ok(`PREGATE hooks removed from ${file}.`)
    : warn(`PREGATE hooks removed from ${file}. These third-party hooks moved; Codex requires approval in /hooks: ${moved.join(", ")}.`);
}

// ── doctor ───────────────────────────────────────────────────────────────────────────

// MH-27: the installation, each harness's CLI against the version its adapter was verified on, the
// drift of every registration, Codex trust as Codex reports it, and a canary per harness: the
// registered command, literal, through $SHELL -c, has to deny in that harness's dialect.
export async function doctor(): Promise<Result> {
  const p = paths();
  const found = detect(p);
  // Codex and agy without a binary do not run here; the shared files stay checked for IDE apps.
  const checked = new Map([...found].filter(([h, bin]) => bin !== null || SHARED.includes(h)));
  const ci = describeCi(canonical(process.cwd()));
  const root = findRoot(canonical(process.cwd()), () => true);
  const { coverageLead, protectionStatus } = await import("./status.ts");
  // `project hooks` and `project setup` both write .claude/settings.json, and the bytes differ.
  // The hooks registration is what register.ts calls exact. The setup registration is what
  // project-claude.ts calls exact. Doctor follows the one that matches. Cursor and Antigravity
  // project registrations are separate files and stay in `scope`.
  const setup = root === null
    ? { active: false, exact: false, lines: [] as Line[], preCommand: null as string | null, consentActive: false }
    : localClaude(p, root);
  const scope = projectScopes(p, root, found);
  const hooksLocal = root !== null && registered(read(join(root, PROJECT_SETTINGS)), "project", p.data);
  const setupExact = setup.exact && !hooksLocal;
  const standalone = new Set(scope.standalone);
  if (setupExact) standalone.add("claude-code");
  // Harnesses that still depend on the machine installation.
  const machine = new Map([...checked].filter(([h]) => !standalone.has(h)));
  const optional = standalone.size > 0 && machine.size === 0;
  const lines = [...coverageLead(protectionStatus(root)).map((text) => ok(text))];
  if (setupExact) {
    lines.push(globalInstalled(p, true));
    lines.push(...skillProblems().map((text) => info(`${text} Repository hooks do not use the global companion skill.`)));
  } else lines.push(...installation(p, optional));
  lines.push(ok(status(root)), ci.providers.length === 0 ? info(ci.text) : ok(ci.text));
  if (found.size === 0 && setupExact) lines.push(info("No global harness home was found. This project uses repository-owned Claude hooks."));
  else if (found.size === 0 && standalone.size === 0) lines.push(fail("No harness found; PREGATE gates nothing on this machine."));
  else if (checked.size === 0 && setupExact) lines.push(info("No harness binary is on PATH. Repository Claude hooks are still checked below."));
  else if (checked.size === 0 && standalone.size === 0) lines.push(warn("No harness with its binary on PATH; PREGATE gates nothing yet."));
  for (const [h, bin] of found) lines.push(versionOf(h, bin));
  if (setupExact) {
    lines.push(...setup.lines);
    // The setup file is owned by the project-hooks matcher but is not that registration.
    // Reporting it as a broken project-hooks file would hide the scope doctor just stated.
    lines.push(...scope.lines.filter((line) => !line.text.includes("Claude Code hooks:") && !line.text.startsWith(`${PROJECT_SETTINGS}: PREGATE project hooks are missing`)));
  } else lines.push(...scope.lines);
  const m = machineFiles(p, machine);
  const hookTrust = machine.has("codex") ? trusts(p) : {};
  let hookDrift = drift(m, null, p.data, hookTrust);
  if (setupExact && !checked.has("cursor") && !checked.has("grok")) {
    const kept = hookDrift.filter((line) => !globalClaudeMissing(line));
    if (kept.length !== hookDrift.length) lines.push(info("This project uses repository-owned Claude hooks. Global Claude settings are not a fallback."));
    hookDrift = kept;
  }
  if (checked.has("opencode")) hookDrift.push(...opencodeDrift(p));
  lines.push(...hookDrift.map(fail));
  const supervisionLimit = "Direct engine hook calls have no launcher crash/timeout protection. Runtime canaries below exercise the launcher route; they do not override registration errors.";
  const admitted = gated(m, null, p.data, hookTrust);
  if (standalone.has("claude-code")) admitted.add("claude-code");
  if (standalone.has("cursor")) admitted.add("cursor");
  if (standalone.has("agy")) admitted.add("agy");
  if (checked.has("opencode") && opencodeGated(p)) admitted.add("opencode");
  lines.push((checked.size === 0 && standalone.size === 0) || [...checked.keys()].some((h) => !admitted.has(h))
    ? warn(`Hook supervision is not established for every detected harness. ${supervisionLimit} Run pregate setup and review the registrations.`)
    : ok(`Hook supervision: required launcher commands are registered. ${supervisionLimit}`));
  const codexBin = machine.get("codex");
  if (codexBin) lines.push(m.codexHooks === null ? fail("Codex has no hooks.json; run pregate setup.") : await trustOf(p, codexBin));
  else if (found.has("codex") && !standalone.has("codex")) lines.push(codexOffPath(p));
  const projectCodexBin = found.get("codex");
  if (root !== null && projectCodexBin && registered(read(join(root, PROJECT_CODEX_HOOKS)), "project-codex", p.data)) {
    lines.push(await projectCodexTrust(p, root, projectCodexBin));
  }
  if (machine.has("agy") && m.agyHooks === null) lines.push(fail("agy has no pregate-global plugin; run pregate setup."));
  else if (found.has("agy") && !checked.has("agy") && !standalone.has("agy")) lines.push(agyOffPath(p));
  if (checked.has("opencode") && read(join(opencodePluginDir(p), "index.ts")) === null && read(opencodeConfigFile(p)) === null) {
    lines.push(fail("OpenCode has no PREGATE plugin; run pregate setup."));
  }
  if (found.has("cursor") && !scope.standalone.has("cursor") && m.cursorHooks === null) lines.push(fail("Cursor has no native PREGATE Stop hook; run pregate setup."));
  const cli = which(WINDOWS ? "pregate.cmd" : "pregate");
  const onPath = cli !== null && canonical(cli) === canonical(WINDOWS ? p.link : p.launcher);
  lines.push(onPath ? ok(`pregate on PATH: ${cli}.`)
    : setupExact ? info(`pregate on PATH is not the global launcher (${cli ?? "none"}). This project runs its repository launcher and does not fall back to PATH.`)
    : optional ? info(`pregate on PATH is not the global launcher (${cli ?? "none"}); the project hooks do not use PATH.`)
      : warn(`pregate on PATH is not ${p.link} (${cli ?? "none"}); add ${dirname(p.link)} to PATH.`));
  lines.push(which("gh") !== null && spawn(["gh", "auth", "status"]).exit === 0 ? ok("gh authenticated; private release fallback is available.")
    : warn("Public releases use anonymous HTTPS. Private pilot releases require gh auth login and repository read access; no release access was tested."));
  if (setupExact && setup.consentActive && setup.preCommand !== null && root !== null) lines.push(projectCanary(root, setup.preCommand));
  for (const h of machine.keys()) lines.push(canary(p, h));
  return report(lines);
}

// The global launcher and the companion skills. `optional`: every harness checked here gets its
// registration from the project, so their absence is stated and is not an error.
function installation(p: Paths, optional: boolean): Line[] {
  const launcher = installed(p), skills = skillProblems();
  if (!optional) return [launcher, ...skills.map(fail)];
  return [
    launcher.level === "fail" ? info(`No global installation (${p.launcher}); this project runs its own launcher.`) : launcher,
    ...(skills.length === 0 ? [] : [info(`The /pregate companion skills are missing or stale in ${skills.length} harness folders; only pregate setup installs them.`)]),
  ];
}

// ── Claude Code scope ────────────────────────────────────────────────────────────────

// Where Claude Code gets its PREGATE hooks for this project: its own .claude/settings.json
// (`pregate project hooks`), the user's settings (`pregate setup`), both or neither. Claude Code
// merges the two files, so both means every tool call is evaluated twice. The lines state what the
// files hold; no Claude Code session runs here.
function claudeScope(p: Paths, root: string | null): { local: boolean; global: boolean; lines: Line[] } {
  const text = root === null ? null : read(join(root, PROJECT_SETTINGS));
  const local = registered(text, "project", p.data);
  const global = p.shared.some((f) => owned(read(f), "shared", p.data));
  const lines: Line[] = [];
  const fix = "pregate project hooks --harness claude-code --preview";
  if (!local && owned(text, "project", p.data)) lines.push(fail(`${PROJECT_SETTINGS}: PREGATE project hooks are missing, modified or written for another platform; run ${fix}.`));
  if (local && global) lines.push(warn(`Claude Code hooks: project-local and global. Claude Code runs both registrations, so every tool call is evaluated twice. Keep one: remove the PREGATE groups from ${PROJECT_SETTINGS}, or the global ones (pregate uninstall removes them for every harness).`));
  else if (local) lines.push(ok(`Claude Code hooks: project-local only. ${PROJECT_SETTINGS} runs the project launcher; no global registration is present.`));
  else if (global) lines.push(info(`Claude Code hooks: global only (pregate setup). ${root === null ? "No project here." : `${PROJECT_SETTINGS} of this project holds no complete PREGATE registration.`}`));
  else lines.push((root === null ? info : warn)(`Claude Code hooks: neither project-local nor global. Claude Code is not gated${root === null ? "" : " in this project"}. Run ${fix} in a project, or pregate setup.`));
  return { local, global, lines };
}

// For status: where Claude Code gets its hooks for this project, and whether the launcher that
// registration names is there.
export function claudeRegistration(root: string | null): { scope: "project" | "global" | "both" | "none"; projectLauncher: boolean } {
  const { local, global } = claudeScope(paths(), root);
  return { scope: local ? (global ? "both" : "project") : global ? "global" : "none", projectLauncher: local && projectLauncherState(root!) === "ready" };
}

// Some group in the file runs this installation's launcher (or, for "project", a project launcher).
function owned(text: string | null, t: Target, data: string): boolean {
  const without = text === null ? null : unmerge(text, t, data);
  return without !== null && without.text !== text;
}

// ── Codex scope ──────────────────────────────────────────────────────────────────────

// Where Codex gets its PREGATE hooks for this project: its own .codex/hooks.json (`pregate project
// hooks --harness codex`), the user's hooks.json (`pregate setup`), both or neither. Only files are
// read. `level` is the trust level the user's config.toml records for the project directory. The
// review of the project hooks themselves is Codex's own record and is not read here: it is reported
// as unknown, never as trusted. `present`: Codex was found on this machine.
function codexScope(p: Paths, root: string | null, present: boolean, inspectable = false): { local: boolean; global: boolean; level: string | null; lines: Line[] } {
  const text = root === null ? null : read(join(root, PROJECT_CODEX_HOOKS));
  const local = registered(text, "project-codex", p.data);
  const global = owned(read(join(p.codexHome, "hooks.json")), "codex", p.data);
  const level = local ? codexProjectTrust(read(join(p.codexHome, "config.toml")), root!) : null;
  const lines: Line[] = [];
  const fix = "pregate project hooks --harness codex --preview";
  const trust = level === "trusted" ? "Codex config.toml marks this project trusted." : `Codex config.toml does not mark this project trusted (trust_level: ${level ?? "no record"}).`;
  const review = `${trust} ${inspectable ? "Effective project hook review is queried below through Codex app-server." : "Hook review state unknown: check `/hooks` in Codex."}`;
  if (!local && owned(text, "project-codex", p.data)) lines.push(fail(`${PROJECT_CODEX_HOOKS}: PREGATE project hooks are missing, modified or written for another platform; run ${fix}.`));
  if (local && global) lines.push(warn(`Codex hooks: project-local and global. When Codex runs both registrations, every tool call is evaluated twice. Keep one: remove the PREGATE groups from ${PROJECT_CODEX_HOOKS}, or the global ones (pregate uninstall removes them for every harness). ${review}`));
  else if (local) lines.push((level === "trusted" ? info : warn)(`Codex hooks: project-local only. ${PROJECT_CODEX_HOOKS} runs the project launcher; no global registration is present. ${review}`));
  else if (global) lines.push(info(`Codex hooks: global only (pregate setup). ${root === null ? "No project here." : `${PROJECT_CODEX_HOOKS} of this project holds no complete PREGATE registration.`}`));
  else lines.push((root === null || !present ? info : warn)(`Codex hooks: neither project-local nor global. Codex is not gated${root === null ? "" : " in this project"}. Run ${fix} in a project, or pregate setup.`));
  return { local, global, level, lines };
}

// For status: where Codex gets its hooks for this project, and the project trust level on record.
export function codexRegistration(root: string | null): { scope: "project" | "global" | "both" | "none"; projectTrust: string | null } {
  const { local, global, level } = codexScope(paths(), root, true);
  return { scope: local ? (global ? "both" : "project") : global ? "global" : "none", projectTrust: level };
}

// ── Cursor scope ─────────────────────────────────────────────────────────────────────

// Where Cursor gets its PREGATE hooks for this project: its own .cursor/hooks.json (`pregate project
// hooks --harness cursor`), the machine registration (`pregate setup`: the shared Claude Code
// settings Cursor imports, and the native Stop in ~/.cursor/hooks.json), both or neither. Cursor
// runs every source it loads, so both means every tool call is evaluated twice. Cursor also runs the
// project's .claude/settings.json [V 2026.11.11], so a Claude Code project registration is one more
// Cursor registration. Workspace trust is Cursor's own record and is not read here.
function cursorScope(p: Paths, root: string | null, present: boolean): { local: boolean; global: boolean; double: boolean; lines: Line[] } {
  const text = root === null ? null : read(join(root, PROJECT_CURSOR_HOOKS));
  const native = registered(text, "project-cursor", p.data);
  const imported = root !== null && registered(read(join(root, PROJECT_SETTINGS)), "project", p.data);
  const local = native || imported;
  const global = owned(read(join(p.home, ".cursor/hooks.json")), "cursor", p.data) || p.shared.some((f) => owned(read(f), "shared", p.data));
  const lines: Line[] = [];
  const fix = "pregate project hooks --harness cursor --preview";
  const trust = "Cursor runs project hooks only in a trusted workspace.";
  if (!native && owned(text, "project-cursor", p.data)) lines.push(fail(`${PROJECT_CURSOR_HOOKS}: PREGATE project hooks are missing, modified or written for another platform; run ${fix}.`));
  if (native && imported) lines.push(warn(`Cursor hooks: ${PROJECT_CURSOR_HOOKS} and ${PROJECT_SETTINGS} of this project both register PREGATE, and Cursor runs both, so every tool call is evaluated twice. Keep one for Cursor. ${trust}`));
  else if (local && global) lines.push(warn(`Cursor hooks: project-local and global. Cursor runs both registrations, so every tool call is evaluated twice. Keep one: remove the PREGATE entries from ${native ? PROJECT_CURSOR_HOOKS : PROJECT_SETTINGS}, or the global ones (pregate uninstall removes them for every harness). ${trust}`));
  else if (native) lines.push(ok(`Cursor hooks: project-local only. ${PROJECT_CURSOR_HOOKS} runs the project launcher; no global registration is present. ${trust}`));
  else if (local) lines.push(info(`Cursor hooks: project-local through ${PROJECT_SETTINGS}, which Cursor imports; its Stop in Cursor is not established. ${PROJECT_CURSOR_HOOKS} is Cursor's native registration (${fix}). ${trust}`));
  else if (global) lines.push(info(`Cursor hooks: global only (pregate setup). ${root === null ? "No project here." : `${PROJECT_CURSOR_HOOKS} of this project holds no complete PREGATE registration.`}`));
  else lines.push((root === null || !present ? info : warn)(`Cursor hooks: neither project-local nor global. Cursor is not gated${root === null ? "" : " in this project"}. Run ${fix} in a project, or pregate setup.`));
  return { local, global, double: (native && imported) || (local && global), lines };
}

// For status: where Cursor gets its hooks for this project; "both" is any double registration.
export function cursorRegistration(root: string | null): "project" | "global" | "both" | "none" {
  const { local, global, double } = cursorScope(paths(), root, true);
  return double ? "both" : local ? "project" : global ? "global" : "none";
}

// Every scope for doctor. `standalone`: the harnesses whose only registration is the project's.
function projectScopes(p: Paths, root: string | null, present: Map<HarnessId, string | null>): { standalone: Set<HarnessId>; lines: Line[] } {
  const claude = claudeScope(p, root), codex = codexScope(p, root, present.has("codex"), present.get("codex") != null), cursor = cursorScope(p, root, present.has("cursor"));
  const standalone = new Set<HarnessId>();
  if (claude.local && !claude.global) standalone.add("claude-code");
  if (codex.local && !codex.global) standalone.add("codex");
  if (cursor.local && !cursor.global) standalone.add("cursor");
  const agy = agyScope(p, root, present.has("agy"));
  if (agy.local && !agy.global) standalone.add("agy");
  const checks = claude.local || codex.local || cursor.local || agy.local ? projectChecks(root!, p.data, claude.local) : [];
  return { standalone, lines: [...checks, ...claude.lines, ...codex.lines, ...cursor.lines, ...agy.lines] };
}

// ── Antigravity scope ────────────────────────────────────────────────────────────────

// Where Antigravity gets its PREGATE hooks for this project: its own .agents/hooks.json (`pregate
// project hooks --harness agy`), the global pregate-global plugin (`pregate setup`), both or
// neither. Antigravity merges workspace hooks and global plugins, so both means every tool call is
// evaluated twice.
function agyScope(p: Paths, root: string | null, present: boolean): { local: boolean; global: boolean; lines: Line[] } {
  const text = root === null ? null : read(join(root, PROJECT_AGY_HOOKS));
  const local = registered(text, "project-agy", p.data);
  const global = registered(read(join(p.plugin, "hooks.json")), "agy", p.data) && !agyDisabled(p);
  const lines: Line[] = [];
  const fix = "pregate project hooks --harness agy --preview";
  if (!local && owned(text, "project-agy", p.data)) lines.push(fail(`${PROJECT_AGY_HOOKS}: PREGATE project hooks are missing, modified or written for another platform; run ${fix}.`));
  if (local && global) lines.push(warn(`Antigravity hooks: project-local and global. Antigravity runs both registrations, so every tool call is evaluated twice. Keep one: remove ${AGY_PROJECT_HOOK} from ${PROJECT_AGY_HOOKS}, or the global ones (pregate uninstall removes them for every harness).`));
  else if (local) lines.push(ok(`Antigravity hooks: project-local only. ${PROJECT_AGY_HOOKS} runs the project launcher; no global registration is present.`));
  else if (global) lines.push(info(`Antigravity hooks: global only (pregate setup). ${root === null ? "No project here." : `${PROJECT_AGY_HOOKS} of this project holds no complete PREGATE registration.`}`));
  else lines.push((root === null || !present ? info : warn)(`Antigravity hooks: neither project-local nor global. Antigravity is not gated${root === null ? "" : " in this project"}. Run ${fix} in a project, or pregate setup.`));
  return { local, global, lines };
}

export function agyRegistration(root: string | null): { scope: "project" | "global" | "both" | "none"; projectLauncher: boolean } {
  const { local, global } = agyScope(paths(), root, true);
  return { scope: local ? (global ? "both" : "project") : global ? "global" : "none", projectLauncher: local && projectLauncherState(root!) === "ready" };
}

// What a project registration depends on, read from the files. No hook runs here.
function projectChecks(root: string, data: string, claude: boolean): Line[] {
  const lines: Line[] = [];
  for (const [path, text] of (claude ? [PROJECT_SETTINGS, ".claude/settings.local.json"] : []).map((f) => [f, read(join(root, f))] as const)) {
    if (parse(text ?? "")?.disableAllHooks === true) lines.push(fail(`${path}: disableAllHooks disables the PREGATE project hooks.`));
  }
  const launcher = projectLauncherState(root), pin = pinnedEngine(root);
  if (launcher !== "ready") lines.push(fail(`The project launcher in .pregate/bin ${launcher === "missing" ? "is missing" : "differs from the reviewed template"}; run pregate project launcher --preview.`));
  if (pin === null || !ready(join(data, pin, ENGINE_FILE))) lines.push(fail(`Engine ${pin ?? "(no pin)"} that this project pins is not in the cache; the project hooks deny every write. Run pregate prepare.`));
  if (lines.length === 0) lines.push(ok(`Project launcher matches the reviewed template and engine ${pin} is cached. No project canary ran: the project hooks were not exercised by doctor.`));
  return lines;
}

function localClaude(p: Paths, root: string) {
  const files = projectLauncherRel().map((rel) => join(root, rel));
  const pin = pinnedEngine(root);
  return projectScope({
    root,
    settings: read(join(root, ".claude/settings.json")),
    localSettings: read(join(root, ".claude/settings.local.json")),
    claudeConfig: read(join(p.home, ".claude.json")),
    launcherPresent: files.some((file) => stats(file)?.isFile() === true),
    launcherReady: files.every((file) => ready(file)),
    pin,
    engineReady: pin !== null && ENGINE_VERSION.test(pin) && ready(join(p.data, pin, ENGINE_FILE)),
    consentActive: enabled(root),
  });
}

function globalInstalled(p: Paths, localExact: boolean): Line {
  const line = installed(p);
  if (localExact && line.level === "fail" && line.text.startsWith("Missing launcher")) {
    return info(`No global launcher at ${p.launcher}. This project uses its repository launcher and does not fall back to it.`);
  }
  return line;
}

function globalClaudeMissing(line: string): boolean {
  return /^(?:~\/\.claude\/settings\.json|\$CLAUDE_CONFIG_DIR\/settings\.json): PREGATE hooks missing or modified/.test(line);
}

function projectCanary(root: string, command: string): Line {
  const c = CANARY["claude-code"];
  const shell = WINDOWS ? ["cmd.exe", "/d", "/s", "/c", command] : [process.env.SHELL || "/bin/sh", "-c", command];
  const env = { ...process.env, ...c.env(root) };
  const o = spawn(shell, 30_000, { cwd: root, env, stdin: JSON.stringify(c.payload(root, join(root, ".pregate/canary.json"))) });
  if (o.exit === c.exit && c.reason(o)?.includes(MARK) === true) return ok("claude-code: project hook denied in its native dialect.");
  return fail(`claude-code: project hook was not denied in its native dialect (exit ${o.exit}; stdout: ${clip(o.stdout) || "empty"}; stderr: ${clip(o.stderr) || "empty"}).`);
}

// The registration files doctor checks; Codex's and agy's only when that harness runs here.
function machineFiles(p: Paths, checked: Map<HarnessId, string | null>): MachineFiles {
  const codex = checked.has("codex"), agy = checked.has("agy");
  return {
    claude: SHARED.some((h) => checked.has(h)) ? p.shared.map((f) => read(f)) : [],
    codexHooks: codex ? read(join(p.codexHome, "hooks.json")) : null, codexConfig: codex ? read(join(p.codexHome, "config.toml")) : null,
    grokConfig: read(join(p.grokHome, "config.toml")),
    agyHooks: agy ? read(join(p.plugin, "hooks.json")) : null, agyConfig: agy ? read(join(p.home, ".gemini/config/config.json")) : null,
    cursorHooks: checked.has("cursor") ? read(join(p.home, ".cursor/hooks.json")) : null,
  };
}

function installed(p: Paths): Line {
  const v = (WINDOWS ? /^\$version = '(.+)'$/m : /^version=(.+)$/m).exec(read(p.launcher) ?? "")?.[1];
  if (v === undefined) return fail(`Missing launcher ${p.launcher}; run pregate setup.`);
  return ready(join(p.data, v, ENGINE_FILE)) ? ok(`Launcher at ${p.launcher} with engine ${v}.`) : fail(`Engine ${v} is not installed; run pregate setup.`);
}

function versionOf(h: HarnessId, bin: string | null): Line {
  if (bin === null && SHARED.includes(h)) return info(`${h}: its home exists but its binary is not on PATH; its shared hook registration is still checked for IDE apps.`);
  if (bin === null) return info(`${h}: config found but its binary is not on PATH; not checked. If you use it, put it on PATH and rerun pregate setup.`);
  const r = spawn([bin, "--version"], 15_000);
  const v = r.stdout.trim().split("\n")[0] ?? "";
  const verified = HARNESSES[h].VERIFIED;
  if (h === "codex") {
    const cli = cliVersion(r.stdout);
    const unknown = v || `unknown (exit ${r.exit})`;
    if (cli !== null && compareVersions(cli, verified) < 0) {
      return warn(
        `codex: version ${unknown}; ${verified} or newer is required. Direct Guardian review before ${verified} did not run PreToolUse hooks, so a PREGATE deny can be bypassed on that path (openai/codex#58368).`,
      );
    }
    if (cli !== null && compareVersions(cli, verified) >= 0 && cli === verified) return ok(`codex ${verified}.`);
    if (cli === CODEX_TESTED) return ok(`codex ${cli} (native lifecycle tested; minimum ${verified}).`);
  }
  return v.includes(verified) ? ok(`${h} ${verified}.`)
    : warn(`${h}: version ${v || `unknown (exit ${r.exit})`}; hooks verified with ${verified}. A changed contract may cause payload-unrecognized denials.`);
}

// A Codex home without the binary on PATH: an IDE's bundled Codex still reads hooks.json, so a home
// without the PREGATE groups is not reported as healthy.
function codexOffPath(p: Paths): Line {
  const file = join(p.codexHome, "hooks.json");
  if (!registered(read(file), "codex", p.data)) {
    return warn(`codex: ${file} has no PREGATE hooks; Codex sessions an IDE launches from its bundled binary are not protected. Run pregate setup.`);
  }
  return info(`codex: PREGATE hooks registered in ${file}; their trust cannot be verified without codex on PATH. Codex sessions an IDE launches run them only once approved in /hooks.`);
}

function agyOffPath(p: Paths): Line {
  const files = agyPlugin(p.data, VERSIONS.engine);
  if (!Object.entries(files).every(([f, text]) => read(join(p.plugin, f)) === text)) {
    return warn(`agy: ${p.plugin} is missing or modified; Antigravity IDE/App sessions are not protected. Run pregate setup.`);
  }
  if (agyDisabled(p)) return fail("agy: pregate-global is disabled (plugins.pregate-global.enabled = false in ~/.gemini/config/config.json); enable it.");
  return info(`agy: pregate-global plugin installed at ${p.plugin}; runtime canary skipped without agy on PATH.`);
}

async function trustOf(p: Paths, bin: string): Promise<Line> {
  const file = join(p.codexHome, "hooks.json");
  const expected = slots(read(file)!, p.data);
  const ours = owner(file, canonical(file), expected);
  return codexTrust(appServer(bin), ours);
}

async function codexTrust(server: Server, ours: ReturnType<typeof owner>): Promise<Line> {
  try {
    const trusted = (await hooksList(server)).filter((h) => ours(h.key) && h.trustStatus === "trusted" && h.enabled).length;
    return trusted === Object.keys(SNAKE).length ? ok("Codex runs the PREGATE hooks (trusted).")
      : fail(`Codex runs ${trusted} of ${Object.keys(SNAKE).length} PREGATE hooks; run pregate setup or approve them in /hooks.`);
  } catch (e) {
    return fail(`Codex: ${(e as Error).message}.`);
  } finally {
    server.close();
  }
}

// Read-only: ask Codex about the current directory's effective layers, including project trust.
// This never records a hash or treats an unreviewed/disabled hook as protection.
async function projectCodexTrust(p: Paths, root: string, bin: string): Promise<Line> {
  const server = appServer(bin);
  try {
    const cwd = canonical(process.cwd());
    const effective = await server.call("config/read", { cwd, includeLayers: false });
    if (!isObject(effective) || !isObject(effective.config)) throw new Error("Codex config/read: unexpected response");
    const features = effective.config.features;
    if (isObject(features) && (features.hooks ?? features.codex_hooks) === false) return fail("Codex project hooks are disabled by the effective configuration; review Codex /hooks and its configuration.");
    const file = join(root, PROJECT_CODEX_HOOKS);
    const wanted = slots(read(file)!, p.data, "project-codex");
    const target = canonical(file), ours = owner(file, target, wanted);
    const listed = (await hooksList(server, [cwd])).filter((h) => ours(h.key));
    const active = wanted.filter((slot) => listed.some((h) => owner(file, target, [slot])(h.key) && h.enabled && h.trustStatus === "trusted")).length;
    const expected = Object.keys(SNAKE).length;
    return active === expected ? ok(`Codex project hooks: ${active}/${expected} enabled and trusted for this directory (read-only app-server inspection).`)
      : fail(`Codex project hooks: ${active}/${expected} enabled and trusted; ${listed.length} discovered. Trust the project and review its hooks in Codex /hooks. No trust was changed.`);
  } catch (e) {
    // fail-closed: failed discovery never establishes project hook trust.
    return fail(`Codex project hook review could not be verified: ${(e as Error).message}. Check /hooks; no trust was changed.`);
  } finally {
    server.close();
  }
}

// A write to a protected path (`**/.pregate/**`, with or without a root) in a fresh folder, with
// state kept out of the user's: the deny it gets is the engine's own, decoded and encoded by the
// harness's adapter, which neither the inline guard nor the launcher can fake.
const MARK = "PREGATE DENY protected-path";
const SID = "pregate-doctor";
const denyJson = (o: Out): string | null => {
  const s = parse(o.stdout)?.hookSpecificOutput;
  return isObject(s) && s.permissionDecision === "deny" && typeof s.permissionDecisionReason === "string" ? s.permissionDecisionReason : null;
};
const CANARY: Record<HarnessId, { exit: number; env: (dir: string) => Record<string, string>; payload: (dir: string, file: string) => Payload; reason: (o: Out) => string | null }> = {
  "claude-code": {
    exit: 2, env: (dir) => ({ CLAUDE_PROJECT_DIR: dir }), reason: denyJson,
    payload: (dir, file) => ({ session_id: SID, cwd: dir, hook_event_name: "PreToolUse", tool_name: "Write", tool_use_id: SID, tool_input: { file_path: file, content: "{}\n" } }),
  },
  cursor: {
    exit: 0, env: (dir) => ({ CURSOR_VERSION: HARNESSES.cursor.VERIFIED, CURSOR_PROJECT_DIR: dir }), reason: denyJson,
    payload: (dir, file) => ({
      session_id: SID, cursor_version: HARNESSES.cursor.VERIFIED, workspace_roots: [dir], hook_event_name: "preToolUse",
      tool_name: "Write", tool_use_id: SID, tool_input: { file_path: file, content: "{}\n" },
    }),
  },
  grok: {
    exit: 2, env: (dir) => ({ GROK_HOOK_EVENT: "pre_tool_use", GROK_WORKSPACE_ROOT: dir }), reason: denyJson,
    payload: (dir, file) => ({
      sessionId: SID, cwd: dir, hookEventName: "pre_tool_use", toolName: "write", toolUseId: SID,
      toolInput: { file_path: file, content: "{}\n" }, toolInputTruncated: false,
    }),
  },
  codex: {
    exit: 2, env: () => ({}), reason: (o) => (o.stdout === "" ? o.stderr : null),
    payload: (dir, file) => ({
      session_id: SID, turn_id: SID, cwd: dir, hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_use_id: SID,
      tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+{}\n*** End Patch\n` },
    }),
  },
  agy: {
    exit: 0, env: () => ({}),
    reason: (o) => {
      const j = parse(o.stdout);
      return j?.decision === "deny" && typeof j.reason === "string" ? j.reason : null;
    },
    payload: (dir, file) => ({
      conversationId: SID, workspacePaths: [dir], cwd: dir, hookEventName: "PreToolUse", stepIdx: 0,
      toolCall: { id: SID, name: "write_file", args: { Path: file, Content: "{}\n", Overwrite: true } },
    }),
  },
  // The plugin sends the payload this adapter reads; the deny is stderr with exit 2, as Codex's.
  opencode: {
    exit: 2, env: () => ({}), reason: (o) => (o.stdout === "" ? o.stderr : null),
    payload: (dir, file) => ({
      hook_event_name: "PreToolUse", session_id: SID, cwd: dir, tool_name: "write", tool_use_id: SID,
      tool_input: { filePath: file, content: "{}\n" },
    }),
  },
};

function canary(p: Paths, h: HarnessId): Line {
  return runCanary(p, h, canonical(mkdtempSync(join(tmpdir(), "pregate-canary-"))));
}

function runCanary(p: Paths, h: HarnessId, dir: string): Line {
  try {
    mkdirSync(join(dir, ".pregate"), { recursive: true });
    writeFileSync(join(dir, ".pregate/preset.json"), "{}");
    const initialized = spawn(["git", "init", "-q", dir]);
    if (initialized.exit !== 0) return fail("Cannot initialize the isolated doctor canary repository.");
    enable(dir);
    const c = CANARY[h];
    const flag = h === "cursor" ? "claude-code" : h;
    const command = WINDOWS ? ["cmd.exe", "/d", "/s", "/c", hookCommand(p.data, "pre", flag)]
      : [process.env.SHELL || "/bin/sh", "-c", hookCommand(p.data, "pre", flag)];
    const env = { ...process.env, XDG_STATE_HOME: join(dir, "state"), ...c.env(dir) };
    const o = spawn(command, 30_000, { cwd: dir, env, stdin: JSON.stringify(c.payload(dir, join(dir, ".pregate/canary.json"))) });
    if (o.exit === c.exit && c.reason(o)?.includes(MARK) === true) return ok(`${h}: canary denied in its native dialect.`);
    return fail(`${h}: canary was not denied in its native dialect (exit ${o.exit}; stdout: ${clip(o.stdout) || "empty"}; stderr: ${clip(o.stderr) || "empty"}).`);
  } finally {
    disable(dir);
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Codex app-server (MH-24) ─────────────────────────────────────────────────────────

interface Listed { key: string; trustStatus: string; currentHash: string; enabled: boolean }
interface Server { call(method: string, params: unknown): Promise<unknown>; close(): void }

// JSON-RPC lines over `codex app-server` stdio, one call at a time, initialize first. A server that
// hangs is killed at 60 s, which ends its stdout and fails the pending call. When it exits early, its
// last stderr line says why (e.g. a CODEX_HOME that does not exist).
function appServer(bin: string): Server {
  const proc = Bun.spawn([bin, "app-server"], { stdin: "pipe", stdout: "pipe", stderr: "pipe", timeout: 60_000, killSignal: "SIGKILL" });
  const lines = linesOf(proc.stdout);
  const stderr = new Response(proc.stderr).text().catch(() => "");
  const exited = async (method: string): Promise<Error> => {
    const last = (await Promise.race([stderr, Bun.sleep(2000).then(() => "")])).split(/\r?\n/).filter((l) => l.trim() !== "").at(-1);
    return new Error(`codex app-server exited without answering ${method}${last === undefined ? "" : ` (${clip(last)})`}`);
  };
  let id = 0;
  const send = async (m: object, method: string): Promise<void> => {
    try {
      proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...m })}\n`);
      await proc.stdin.flush();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EPIPE") throw await exited(method);
      throw e;
    }
  };
  const call = async (method: string, params: unknown): Promise<unknown> => {
    const n = ++id;
    await send({ id: n, method, params }, method);
    for (let l = await lines.next(); !l.done; l = await lines.next()) {
      const m = parse(l.value);
      if (m?.id !== n) continue;
      if (m.error !== undefined) throw new Error(`codex app-server ${method}: ${clip(JSON.stringify(m.error))}`);
      return m.result;
    }
    throw await exited(method);
  };
  let ready: Promise<void> | null = null;
  return {
    call: async (method, params) => {
      ready ??= call("initialize", { clientInfo: { name: "pregate", version: VERSIONS.engine } }).then(() => send({ method: "initialized" }, "initialized"));
      await ready;
      return call(method, params);
    },
    close: () => proc.kill("SIGKILL"),
  };
}

async function hooksList(s: Server, cwds: string[] = []): Promise<Listed[]> {
  const r = await s.call("hooks/list", { cwds });
  if (!isObject(r) || !Array.isArray(r.data)) throw new Error("codex app-server hooks/list: unexpected response");
  if (r.data.some((d: unknown) => !isObject(d) || !Array.isArray(d.hooks) || (Array.isArray(d.errors) && d.errors.length > 0))) throw new Error("codex app-server hooks/list: hook discovery failed");
  return r.data.flatMap((d: unknown) => (isObject(d) && Array.isArray(d.hooks) ? d.hooks : [])).filter((h: unknown): h is Listed =>
    isObject(h) && typeof h.key === "string" && typeof h.trustStatus === "string" && typeof h.currentHash === "string" && typeof h.enabled === "boolean");
}

async function* linesOf(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    for (let i = buffer.indexOf("\n"); i >= 0; i = buffer.indexOf("\n")) {
      yield buffer.slice(0, i);
      buffer = buffer.slice(i + 1);
    }
  }
}

// Keys of groups this installation already owns, current or older: every handler names <DATA>/bin.
// Codex addresses a hook as <file>:<event>:<group>:<hook>, and may name the file either way.
function oursKeys(file: string, target: string, text: string | null, data: string): Set<string> {
  const hooks = parse(text ?? "")?.hooks;
  const keys = new Set<string>();
  if (!isObject(hooks)) return keys;
  for (const [event, snake] of Object.entries(SNAKE)) {
    const list = hooks[event];
    if (!Array.isArray(list)) continue;
    list.forEach((g, i) => {
      if (!isObject(g) || !Array.isArray(g.hooks)) return;
      const hs = g.hooks;
      if (hs.length === 0 || hs.some((h) => !isObject(h) || typeof h.command !== "string" || !ownedCommand(h.command, data))) return;
      hs.forEach((_, j) => {
        keys.add(`${file}:${snake}:${i}:${j}`);
        keys.add(`${target}:${snake}:${i}:${j}`);
      });
    });
  }
  return keys;
}

// <event>:<group>:<hook> of every group in a hooks.json text that is exactly what setup writes.
function slots(text: string, data: string, target: "codex" | "project-codex" = "codex"): string[] {
  const hooks = parse(text)?.hooks;
  return Object.entries(SNAKE).flatMap(([event, snake]) => {
    const list = isObject(hooks) ? hooks[event] : null;
    const g = Array.isArray(list) ? list.findIndex((x) => exact(x, target, data)) : -1;
    return g < 0 ? [] : [`${snake}:${g}:0`];
  });
}

// Whether a Codex key is one of ours: Codex names the file as configured or resolved.
function owner(file: string, target: string, ours: string[]): (key: string) => boolean {
  return (key) => ours.some((s) => key === `${file}:${s}` || key === `${target}:${s}`);
}

function trusts(p: Paths): Record<string, string> {
  const t = parse(read(p.trust) ?? "") ?? {};
  return Object.fromEntries(Object.entries(t).filter((e): e is [string, string] => typeof e[1] === "string"));
}

// setup's trust lands in config.toml as one two-line table per key. Uninstall drops those tables and
// nothing else: the bytes around them, including trust setup did not grant, stay.
function releaseTrust(p: Paths): void {
  const file = canonical(join(p.codexHome, "config.toml"));
  let text = read(file);
  if (text === null) return;
  const before = text;
  for (const key of Object.keys(trusts(p))) {
    const header = `[hooks.state.${JSON.stringify(key)}]\n`;
    const at = text.indexOf(header);
    if (at < 0) continue;
    const nl = text.indexOf("\n", at + header.length);
    text = text.slice(0, at) + text.slice(nl < 0 ? text.length : nl + 1);
  }
  if (text !== before) save(file, text);
}

function sameJson(a: string, b: string): boolean {
  const x = parse(a);
  const y = parse(b);
  return x !== null && y !== null && Bun.deepEquals(x, y, true);
}

// ── The machine ──────────────────────────────────────────────────────────────────────

// <DATA> and <STATE> as setup resolves them (MH-18); the harness homes as each harness does.
function paths(): Paths {
  const env = process.env;
  const home = homeDir();
  const data = slash(dataHome());
  const own = join(home, ".claude/settings.json");
  const moved = env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, "settings.json") : null;
  return {
    home, data, state: stateDir(), codexHome: env.CODEX_HOME || join(home, ".codex"), grokHome: env.GROK_HOME || join(home, ".grok"),
    opencodeHome: env.OPENCODE_CONFIG_DIR || join(home, ".config/opencode"),
    shared: moved === null || canonical(moved) === canonical(own) ? [own] : [own, moved],
    launcher: join(data, WINDOWS ? "bin/launcher.ps1" : "bin/pregate"), link: WINDOWS ? join(data, "bin/pregate.cmd") : join(home, ".local/bin/pregate"),
    plugin: join(home, `.gemini/config/plugins/${AGY_PLUGIN}`), trust: join(stateDir(), "codex-trust.json"),
  };
}

export function gatedHarnesses(root: string | null): Set<string> {
  const p = paths();
  const repo = Object.fromEntries([
    ".claude/settings.json", ".claude/settings.local.json", ".codex/config.toml", ".grok/config.toml",
    ".agents/hooks.json", ".agents/plugins.json", ".agent/hooks.json", ".agent/plugins.json",
  ].flatMap((f) => { const text = root === null ? null : read(join(root, f)); return text === null ? [] : [[f, text]]; }));
  const empty: MachineFiles = { claude: [], codexHooks: null, codexConfig: null, grokConfig: null, agyHooks: null, agyConfig: null, cursorHooks: null };
  const ids = gated({
    claude: p.shared.map(read), codexHooks: read(join(p.codexHome, "hooks.json")), codexConfig: read(join(p.codexHome, "config.toml")),
    grokConfig: read(join(p.grokHome, "config.toml")), agyHooks: read(join(p.plugin, "hooks.json")),
    agyConfig: read(join(p.home, ".gemini/config/config.json")), cursorHooks: read(join(p.home, ".cursor/hooks.json")),
  }, repo, p.data, trusts(p));
  if (opencodeGated(p)) ids.add("opencode");
  if (process.env.GROK_CLAUDE_HOOKS_ENABLED === "0") ids.delete("grok");
  // The project's own registration gates Claude Code or Antigravity here without a global one.
  if (registered(repo[PROJECT_SETTINGS] ?? null, "project", p.data) && !Object.keys(repo).some((f) => f.startsWith(".claude/") && parse(repo[f]!)?.disableAllHooks === true)) ids.add("claude-code");
  if (root !== null && registered(read(join(root, PROJECT_CURSOR_HOOKS)), "project-cursor", p.data)) ids.add("cursor");
  if (registered(repo[PROJECT_AGY_HOOKS] ?? null, "project-agy", p.data) && drift(empty, repo, p.data, {}).length === 0) ids.add("agy");
  return new Set([...ids].flatMap((h) => BINARIES[h]));
}

// Present harness → its binary on the PATH, or null when only its home exists.
function detect(p: Paths): Map<HarnessId, string | null> {
  const homes: Record<HarnessId, string[]> = {
    "claude-code": [join(p.home, ".claude")], cursor: [join(p.home, ".cursor")], grok: [p.grokHome], codex: [p.codexHome],
    agy: [join(p.home, ".gemini/antigravity-cli"), join(p.home, ".gemini/antigravity")],
    opencode: [p.opencodeHome],
  };
  const found = new Map<HarnessId, string | null>();
  for (const h of Object.keys(HARNESSES) as HarnessId[]) {
    const bin = BINARIES[h].map((b) => which(b)).find((b) => b !== null) ?? null;
    const hasHome = homes[h].some((dir) => {
      const entries = existsSync(dir) ? readdirSync(dir) : null;
      return entries !== null && (entries.length === 0 || entries.some((name) => name !== "skills"));
    });
    if (bin !== null || hasHome) found.set(h, bin);
  }
  return found;
}

function agyDisabled(p: Paths): boolean {
  const plugins = parse(read(join(p.home, ".gemini/config/config.json")) ?? "")?.plugins;
  return isObject(plugins) && isObject(plugins[AGY_PLUGIN]) && plugins[AGY_PLUGIN].enabled === false;
}

// MH-27: an engine is immutable per version and only lands after it answered, so the launcher never
// finds a partial one. The first exec of a new binary also pays the cold start (on macOS, the
// Gatekeeper scan), which could overrun the 5 s deadline of the first real hook.
function installEngine(p: Paths, from: string, v: string): string | null {
  const target = join(p.data, v, ENGINE_FILE);
  if (ready(target)) return null;
  mkdirSync(dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp${WINDOWS ? ".exe" : ""}`;
  copyFileSync(from, tmp);
  sync(tmp);
  chmodSync(tmp, 0o755);
  const r = spawn([tmp, "--version"], 60_000);
  const named = /^pregate (\S+)(?: \(core (\d+\.\d+\.\d+)\))?$/.exec(r.stdout.trim());
  if (r.exit !== 0 || named?.[1] !== v) {
    removeReleased(tmp);
    return `Engine ${v} does not start (exit ${r.exit}: ${clip(r.stdout + r.stderr) || "no output"}); not installed.`;
  }
  renameReleased(tmp, target);
  accompanyEngine(from, dirname(target));
  return null;
}

// The release archive carries LICENSE and THIRD_PARTY_NOTICES beside the binary. Copy them next
// to the installed engine so the copy a person runs still has the JavaScriptCore notice.
export function accompanyEngine(from: string, dir: string): void {
  for (const name of ["LICENSE", "THIRD_PARTY_NOTICES"]) {
    const source = join(dirname(from), name);
    if (existsSync(source)) copyFileSync(source, join(dir, name));
  }
}

// Engine copies an interrupted install left as <data>/<v>/pregate.<pid>.tmp (about 100 MB each). A copy
// whose installing process still runs is kept: that install renames it when it finishes.
const ENGINE_COPY = new RegExp(`^${ENGINE_FILE.replace(".", "\\.")}\\.(\\d+)\\.tmp(?:\\.exe)?$`);

function removeStaleCopies(data: string): Line[] {
  const stale = readdirSync(data, { withFileTypes: true }).filter((e) => e.isDirectory() && ENGINE_VERSION.test(e.name))
    .flatMap((e) => readdirSync(join(data, e.name)).filter(staleCopy).map((name) => join(data, e.name, name)));
  for (const file of stale) rmSync(file, { force: true });
  return stale.length ? [ok(`Removed ${stale.length} engine cop${stale.length === 1 ? "y" : "ies"} left by an interrupted install.`)] : [];
}

function staleCopy(name: string): boolean {
  const pid = Number(ENGINE_COPY.exec(name)?.[1] ?? process.pid);
  return pid !== process.pid && !running(pid);
}

function running(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }   // EPERM: alive, owned by another user
}

// The launcher's own test of an engine ([ -x ] && [ -s ]), for a regular file only.
function ready(file: string): boolean {
  const s = stats(file);
  return s !== null && s.isFile() && s.size > 0 && (WINDOWS || (s.mode & 0o111) !== 0);
}

function saveLauncher(p: Paths, version: string): void {
  save(p.launcher, ASSETS[WINDOWS ? "launcher.ps1" : "launcher.sh"]!.replace("@ENGINE_VERSION@", version), 0o755);
}

function removeData(data: string): void {
  if (!WINDOWS) { rmSync(data, { recursive: true, force: true }); return; }
  // Windows cannot delete the executing engine. Remove registrations synchronously, then a
  // cmd start escapes Bun's Windows child job, which otherwise dies with the parent (Bun #31603).
  // The helper removes the installation once this process releases the executable.
  const script = `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue; Remove-Item -LiteralPath ${psQuote(data)} -Recurse -Force`;
  const command = powershellCommand(script).split(" ");
  const boot = Bun.spawnSync(["cmd.exe", "/d", "/c", "start", "", "/b", ...command], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  if (boot.exitCode !== 0) throw new Error(`Could not schedule removal of ${data}`);
}

// A changed file of someone else's keeps its original once, as <file>.pregate.bak (MH-23).
function rewrite(target: string, before: string | null, after: string): boolean {
  if (before === after) return false;
  if (before !== null && !existsSync(`${target}.pregate.bak`)) copyFileSync(target, `${target}.pregate.bak`);
  return save(target, after);
}

// tmp + fsync + rename, only when the bytes (or the given mode) change; null removes the file. An
// existing file keeps its mode.
function save(file: string, text: string | null, mode?: number): boolean {
  const s = stats(file);
  if (read(file) === text && (WINDOWS || mode === undefined || (s !== null && (s.mode & 0o777) === mode))) return false;
  if (text === null) {
    rmSync(file, { force: true });
    return true;
  }
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.pregate.tmp`;
  writeFileSync(tmp, text);
  sync(tmp);
  chmodSync(tmp, mode ?? (s === null ? 0o644 : s.mode & 0o7777));
  renameSync(tmp, file);
  return true;
}

function sync(file: string): void {
  fsyncAndClose(openSync(file, WINDOWS ? "r+" : "r"));
}

function fsyncAndClose(fd: number): void {
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

// null: there is no such file.
function read(file: string): string | null {
  return absent(() => readFileSync(file, "utf8"));
}

function stats(file: string, follow = true): Stats | null {
  return absent(() => (follow ? statSync(file) : lstatSync(file)));
}

function absent<T>(f: () => T): T | null {
  try {
    return f();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT" || (e as NodeJS.ErrnoException).code === "ENOTDIR") return null;
    throw e;
  }
}

function spawn(cmd: string[], timeout = 120_000, o: { cwd?: string; env?: Record<string, string | undefined>; stdin?: string } = {}): Out {
  // An explicit `env: undefined` is not "inherit": omit the field so the child keeps this process.
  const r = Bun.spawnSync(cmd, {
    cwd: o.cwd, ...(o.env === undefined ? {} : { env: o.env }),
    stdin: o.stdin === undefined ? "ignore" : Buffer.from(o.stdin), stdout: "pipe", stderr: "pipe", timeout,
  });
  return { exit: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function clip(s: string): string {
  const line = s.trim().replace(/\s+/g, " ");
  return line.length > 300 ? `${line.slice(0, 300)}…` : line;
}

// Bun.which remembers PATH from process start unless the call passes the current value.
function which(name: string): string | null {
  return Bun.which(name, { PATH: process.env.PATH ?? process.env.Path ?? "" });
}

function report(lines: Line[]): Result {
  const prefix = { ok: "", info: "INFO: ", warn: "WARNING: ", fail: "ERROR: " };
  const text = lines.map((l) => `${prefix[l.level]}${l.text}`).join("\n");
  return { code: lines.some((l) => l.level === "fail") ? 1 : 0, text };
}
