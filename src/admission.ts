import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { enabled, enforcedHere, explicitlyDisabled } from "./consent.ts";
import { canonical, findRoot } from "./disk.ts";
import { repositoryFailure } from "./git.ts";
import { absolutePath, pathKey } from "./paths.ts";
import { WINDOWS } from "./platform.ts";
import { compareVersions, ENGINE_VERSION } from "./product.ts";
import { pendingRoot, readBatch } from "./proposal.ts";
import { literalPaths } from "./shell.ts";
import { hasPostInvocation, key, roots, sessionDir } from "./state.ts";
import { FIXABLE_BY } from "./types.ts";
import { VERSIONS } from "./versions.ts";
import type { Cause, Clock, Decision, Form, HookEvent, Lock, Rejected, Session, Violation } from "./types.ts";

export const PRESET = ".pregate/preset.json";
export const LOCK = ".pregate/pregate.lock.json";
export const LAUNCHER = ".pregate/bin/pregate";
// The engine is package.json's version; core is the embedded catalog's.
export { VERSIONS } from "./versions.ts";
// MH-20: pins below FLOOR are denied rather than redirected.
// Raised whenever an adapter fail-open is fixed, so that no repo keeps running the engine that had it.
export const FLOOR = "0.0.1";
// The launcher protocol (MULTI-HARNESS §10.1): exit 0 and 2 carry the engine's own output; exit 3
// with stdout = one ENGINE_VERSION line means "run that engine"; any other exit is fail-closed.
export const REDIRECT = 3;
export { ENGINE_VERSION } from "./product.ts";

export interface Call {            // one hook call, as decide and its event record see it
  session: Session; kind: HookEvent["kind"]; callId: string;
  startedAt: number;               // monotonic boundary start, supplied by the imperative shell
  abs: string | null; root: string | null; rel: string | null;
}
export type Rooted = Call & { root: string; rel: string };   // a call on a file below an accepted root
export interface Outcome {
  lock: Lock | null; lockHash: string | null; introduced: Violation[]; form: Form | null;
  protectedPath: boolean; astHash: string | null; after: string | null; before: string | null;
}

export const NOTHING: Outcome = { lock: null, lockHash: null, introduced: [], form: null, protectedPath: false, astHash: null, after: null, before: null };
export const PROTECTED: Outcome = { ...NOTHING, form: { cause: "protected-path", line: null }, protectedPath: true };

export const clock: Clock = () => performance.now();

// MH-18: <DATA>, from this engine's own path (<DATA>/<v>/pregate) and never from the environment of
// the moment, which may differ from setup's: the engines and the protected paths are always those of
// the installation that runs.
export function engineHome(): string {
  return dirname(dirname(process.execPath));
}

// The global launcher (MH-18), which every text cites for the pre-check and the guard lets run it.
export function launcher(): string {
  return join(engineHome(), "bin", WINDOWS ? "pregate.cmd" : "pregate");
}

// A disabled checkout is not enforced, but the gate still loads so it can print one notice.
// `explicitlyDisabled` is the disable record. `enforcedHere` is the enable record, and it is
// already false after disable.
function disabledCheckout(dir: string): boolean {
  try {
    const root = findRoot(canonical(dir), () => true);
    return root !== null && explicitlyDisabled(root);
  } catch (error) {
    if (error instanceof Error && error.message.endsWith(": no existing ancestor")) return false;
    throw error;
  }
}

function here(dir: string): boolean {
  try { return enforcedHere(dir); }
  catch (error) {
    if (error instanceof Error && error.message.endsWith(": no existing ancestor")) return false;
    throw error;
  }
}

// The guard runs for this command when the cwd was enabled, when the command updates
// another enabled project, or when it names a path inside a root this session already
// reached. A directory that was never enabled stays quiet. Disable is decided before
// this predicate, so its notice still prints.
export function commandGuarded(cwd: string, command: string, session: Session): boolean {
  if (here(cwd) || namesProjectUpdate(command)) return true;
  const reached = roots(key(session)).filter((root) => enabled(root));
  return reached.length > 0 && literalPaths(command, cwd).some((abs) => reached.some((root) => within(root, abs)));
}

export function inert(event: HookEvent | Rejected): boolean {
  // A payload the adapter could not read is a protocol error, not enforcement of the directory.
  if ("cause" in event) return false;
  // An id that would leave the data directory is refused here, before admission records a checkpoint.
  const session = event.kind === "pre-command" ? event.command.session : event.kind === "pre-edit" ? event.changes[0]?.session : event.session;
  if (session !== undefined) sessionDir(key(session));
  if (event.kind === "pre-edit") {
    // An enabled file loads the gate. A disabled checkout still loads it so the notice can print.
    // The file is checked first: an enabled project never pays for the disable walk.
    const dirs = event.changes.map((c) => dirname(canonical(c.path)));
    if (dirs.some((dir) => here(dir))) return false;
    if (disabledCheckout(process.cwd()) || dirs.some((dir) => disabledCheckout(dir))) return false;
    // The hook was started for an enabled project: user-level harness files stay protected.
    const invoked = [process.cwd(), process.env.CLAUDE_PROJECT_DIR, process.env.CURSOR_PROJECT_DIR, process.env.GROK_WORKSPACE_ROOT];
    return !invoked.some((dir) => typeof dir === "string" && absolutePath(dir) && here(dir));
  }
  // A session that reached a root is judged at Stop even when its consent is gone: Stop warns.
  // No snapshot yet: an enabled project Git cannot read still denies. A readable repository
  // this session never reached stays quiet, without loading the gate.
  if (event.kind === "stop") {
    if (roots(key(event.session)).length > 0) return false;
    const hereRoot = findRoot(canonical(event.cwd), enabled);
    return hereRoot === null || repositoryFailure(hereRoot) === null;
  }
  if (event.kind === "post-invocation") return !hasPostInvocation(key(event.session));
  if (event.kind === "pre-command") {
    // `pregate disable` turns this checkout off. The gate runs so it can print one notice, then
    // allows the command. A project that was never enabled does not load the guard.
    if (disabledCheckout(event.command.cwd)) return false;
    return !commandGuarded(event.command.cwd, event.command.command, event.command.session);
  }
  return !here(event.cwd);
}

// Cross-project updates, and the pending batch approval they prepare, can affect consenting
// worktrees even from an inactive cwd. This only loads the normal shell guard; quoted mentions
// still get ordinary parsing. While a batch is pending every command is guarded: a batch approves
// from any directory, and a spliced name (`pre''gate approve`) defeats any text match.
function namesProjectUpdate(command: string): boolean {
  return /\bpregate(?:\.exe|\.cmd)?\b/i.test(command) && command.includes("--projects") && /\bupdate\b/.test(command);
}

export function projectUpdateMention(command: string): boolean {
  if (readBatch() !== null) return true;
  return namesProjectUpdate(command);
}

// The engine the installed launcher runs, as setup and update wrote it. null: no launcher.
export function launcherVersion(data: string): string | null {
  const text = readText(join(data, "bin", WINDOWS ? "launcher.ps1" : "pregate"));
  const version = (WINDOWS ? /^\$version = '(.+)'$/m : /^version=(.+)$/m).exec(text ?? "")?.[1];
  return version !== undefined && ENGINE_VERSION.test(version) ? version : null;
}

// A lock that pins an older engine is answered by that engine; it names the newer installed one.
export function updateReady(data = engineHome()): string | null {
  const installed = launcherVersion(data);
  if (installed === null || compareVersions(installed, VERSIONS.engine) <= 0) return null;
  return `PREGATE update ready (${VERSIONS.engine} -> ${installed}). Ask the user to run: ! pregate update`;
}

// Installed hooks stay silent in a repository without a contract; one SessionStart line says how to
// start. No state is written and no gate is loaded.
export function dormantNotice(cwd: string): string | null {
  const dir = canonical(cwd);
  if (findRoot(dir, () => true) !== null || pendingRoot(dir) !== null) return null;
  for (let at = dir; ; at = dirname(at)) {
    if (statSync(join(at, ".git"), { throwIfNoEntry: false }) !== undefined) break;
    if (dirname(at) === at) return null;
  }
  return "PREGATE is installed but not enabled in this repository. To set it up, run `pregate guide --preview` and show the user its review; only the user approves.";
}

export function told(notice: string | null, full = ""): Decision {
  return {
    verdict: "none", halt: false, cause: null, violations: [], warnings: [], attempt: 0, compact: "", full, fix: null, notice,
    lockHash: null, shadowed: false,
  };
}

// state.ts returns a text or a cause in one string: a file whose whole text is a cause name denies (safe side).
export function isCause<T>(v: T | Cause): v is Cause {
  return typeof v === "string" && Object.hasOwn(FIXABLE_BY, v);
}

// null: no such file (a folder is not a text the tools write).
export function readText(abs: string): string | null {
  return statSync(abs, { throwIfNoEntry: false })?.isFile() ? readFileSync(abs, "utf8") : null;
}

// A26: paths compare without case.
export function within(dir: string, abs: string): boolean {
  const d = pathKey(dir);
  const a = pathKey(abs);
  return a === d || a.startsWith(d.endsWith("/") ? d : `${d}/`);
}

export function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;   // invalid JSON is a known state: callers treat it as absent
  }
}
