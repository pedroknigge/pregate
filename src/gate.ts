import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { finishContract } from "./approval.ts";
import { enabled } from "./consent.ts";
import { delegate, form, globsOf, grammars, inputOf, type Loaded, locate, locatedForm, lockOf, machine, onSessionStart, pinned, redirect, rejected, settle, sourceDirs, sourcesOf, verify } from "./contract-diagnostic.ts";
import { decide } from "./decide.ts";
import { canonical, escapedRoot, findRoot } from "./disk.ts";
import { type Call, clock, ENGINE_VERSION, engineHome, FLOOR, guideMention, isCause, LAUNCHER, launcher, LOCK, NOTHING, PRESET, projectUpdateMention, readText, REDIRECT, told, VERSIONS, within } from "./inertia.ts";
import { gatedHarnesses } from "./machine.ts";
import { harnessConfigFiles, inScope, matches, pathKey, protects, relativePath as relative, scopeUnder, slash } from "./paths.ts";
import { APPROVE_CODE, literalPregate, pendingBatch } from "./pending-review.ts";
import { homeDir } from "./platform.ts";
import { pendingRoot } from "./proposal.ts";
import type { CheckMode } from "./recorded.ts";
import { commandOnPath, controlInFile, readScriptFile } from "./control-file.ts";
import { gitChanges } from "./git-changes.ts";
import { guard, type GuardContext } from "./shell.ts";
import { skillFiles } from "./skill.ts";
import * as state from "./state.ts";
import type { Cause, Decision, HookEvent, Lock, ProposedChange, ProposedCommand } from "./types.ts";

// The imperative shell around the pure core (ARCHITECTURE §4): one function per hook event, plus
// `check` for the pre-check, pre-commit and CI. Every known cause goes through decide; anything
// unforeseen throws, exits 1, and the launcher denies (A6).

export { ENGINE_VERSION, FLOOR, LAUNCHER, LOCK, PRESET, REDIRECT, VERSIONS, clock, delegate, engineHome, launcher, pinned, readText, redirect, rejected, within };
export { grammars, lockOf, onSessionStart, sourceDirs, sourcesOf };

// The hook's SessionStart: the contract briefing, and at most once a day per project the advisor
// rules that stayed clean while the agent worked. Pregate raises the promotion; the human decides.
const NUDGE_EVERY_MS = 24 * 3_600_000;

export async function sessionStart(e: Extract<HookEvent, { kind: "session-start" }>): Promise<Decision> {
  const decision = onSessionStart(e);
  if (!decision.full.includes("PREGATE is active:")) return decision;
  if (e.session.agentId !== null) return decision;
  const line = await promotionLine(e.cwd);
  return line === null ? decision : { ...decision, full: `${decision.full}\n${line}` };
}

async function promotionLine(cwd: string): Promise<string | null> {
  const root = findRoot(canonical(cwd), enabled);
  if (root === null) return null;
  const marker = join(state.stateDir(), "promotion-nudge", state.H(slash(root)));
  if (existsSync(marker) && Date.now() - statSync(marker).mtimeMs < NUDGE_EVERY_MS) return null;
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, "");
  try {
    const [{ records, unifyRoot }, { promotionReady, promotionText }, { applicable }] = await Promise.all([import("./recorded.ts"), import("./report.ts"), import("./report-command.ts")]);
    const now = Date.now();
    const ready = promotionReady(unifyRoot(records(now - 14 * 86_400_000), root), root, now);
    const rules = applicable(root, ready.rules);
    return rules.length === 0 ? null : promotionText({ rules, edits: ready.edits });
  } catch {
    // fail-closed: an unreadable event history omits this optional line only. The briefing and every
    // check are unchanged, and pregate report names the failure.
    return null;
  }
}

type Held = { root: string; loaded: Loaded | Cause; lock: Lock | null; rel: string };   // a path's root, for the guard

export async function onPreEdit(changes: ProposedChange[]): Promise<Decision> {
  const rec = await import("./recorded.ts");
  return rec.onPreEdit(changes);
}

export async function onStop(e: Extract<HookEvent, { kind: "stop" }>, budgetMs?: number): Promise<Decision> {
  const ses = await import("./session-command.ts");
  return ses.onStop(e, budgetMs);
}

export async function check(root: string, m: CheckMode, format: "agent" | "sarif" = "agent"): Promise<{ code: 0 | 1; text: string }> {
  const rec = await import("./recorded.ts");
  return rec.check(root, m, format);
}

// ── Pre command hook (§4.2) ───────────────────────────────────────────────────────────

// §4.2: the shell guard, with the root reached from cwd registered for Stop. A session that reached
// no root writes nothing, and the guard denies only what holds machine-wide unless a path of the
// command reaches a root (MH-17).
export function onPreCommand(c: ProposedCommand): Decision {
  const startedAt = clock();
  const sid = state.key(c.session);
  const cwd = canonical(c.cwd);
  if (findRoot(cwd, enabled) === null && state.roots(sid).filter((r) => enabled(r)).length === 0) {
    const root = pendingRoot(cwd);
    if (root === null && !projectUpdateMention(c.command) && !guideMention(c.command)) return told(null);
    const approval = administrativeApproval(root, c);
    if (approval !== null) return approval;
    const globs = machine();
    const ctx: GuardContext = { launcher: launcher(), engines: engineHome(), isProtected: (p) => protects(canonical(p), globs),
      inScope: () => false, under: () => false, touched: () => true, readControlFile: controlInFile, readScriptFile, commandPath: commandOnPath, gitChanges };
    const cause = guard(c.command, cwd, { ...ctx, machineOnly: root === null, harness: c.session.harness });
    const call: Call = { session: c.session, kind: "pre-command", callId: c.callId, abs: null, root, rel: null, startedAt };
    return decide(inputOf(call, { ...NOTHING, form: cause === null ? null : form(cause), protectedPath: cause === "protected-path" }));
  }
  const located = locate(sid, cwd);
  const root = isCause(located) ? null : located;
  const call: Call = { session: c.session, kind: "pre-command", callId: c.callId, abs: null, root, rel: null, startedAt };
  if (isCause(located)) return settle(call, { ...NOTHING, form: locatedForm(sid, located, cwd) });
  const approval = administrativeApproval(root, c);   // a batch code needs no root
  if (approval !== null) return approval;
  const machineOnly = root === null && state.roots(sid).length === 0;
  const snap = root === null ? null : state.ensureSnapshot(sid, root, null);
  if (isCause(snap)) return settle(call, { ...NOTHING, form: form(snap) });
  // Finalize an already approved contract before reading its protected source folders.
  if (root !== null) finishContract(root);
  let loaded: Loaded | Cause | null = null;
  const load = () => loaded ??= lockOf(root!);
  const ctx = shellContext(sid, root, load, machineOnly);
  const guarded = guard(c.command, cwd, { ...ctx, machineOnly, harness: c.session.harness });
  const valid = loaded === null || isCause(loaded) ? null : loaded as Loaded;
  const cause = ctx.failure() ?? guarded;
  const o = { ...NOTHING, lock: valid?.lock ?? null, lockHash: valid?.hash ?? null, form: cause === null ? null : form(cause), protectedPath: cause === "protected-path" };
  return machineOnly && !ctx.touched() ? decide(inputOf(call, o)) : settle(call, o);
}

// An approval command reads the human's y on a terminal, which an agent's shell tool does not
// have, so no harness can complete one from the agent: a permission prompt would only run a
// command that then refuses. The agent is told the human route instead. A batch code needs no
// root: it names its projects. Any other approval needs the pending root.
function administrativeApproval(root: string | null, c: ProposedCommand): Decision | null {
  const command = literalPregate(c.command, launcher());
  if (command === null) return null;
  const known = [/^issue submit [0-9a-f]{64} --yes$/, /^feedback apply [0-9a-f]{64} --yes$/, /^storage apply [0-9a-f]{64} --yes$/].some((re) => re.test(command));
  const contract = APPROVE_CODE.exec(command);
  if (!known && contract === null) return null;
  if (root === null && (contract === null || pendingBatch(contract[1] ?? contract[2]!) === null)) return null;
  const reason = c.session.harness === "agy"
    ? "agy approval uses human shell input because its hook cannot identify an interactive parent."
    : c.session.harness === "cursor" ? "Cursor Shell Mode has no trusted human-origin marker in its Pre hook."
    : "an approval command needs the human's confirmation on a terminal, which the agent's shell tool does not have.";
  const route = c.session.harness === "cursor" ? `run ${c.command} in a separate human terminal`
    : `type ! ${c.command} inside the harness`;
  const text = `PREGATE: ${reason} Show the complete preview and ask the user to ${route}. The agent must not run the approval command.`;
  return { ...told(null), verdict: "deny", full: text, compact: text, notice: text };
}

// What the guard asks about a path, answered on its canonical form by the root that holds it: a
// command run from one root can write into a sibling or a nested one. Any root counts, accepted or
// not, and without a valid lock every path below it is in scope (inScope(null, …)): both err
// towards deny. `machineOnly`: a path is guarded beyond the machine's files only by the root it
// reaches, and reaching one is what `touched` reports.
function shellContext(sid: string, root: string | null, load: () => Loaded | Cause, machineOnly: boolean): GuardContext & { failure: () => Cause | null } {
  // Valid compiled sourceDirs come directly from the preset's path sources.
  // Protect these even with an invalid contract, without compiling read commands.
  const globs = machineOnly ? machine() : globsOf(sid, root, null);
  const known = [...new Set([...(root === null ? [] : [root]), ...state.roots(sid)])];
  const held = holder(root, load);
  let touched = false;
  let failure: Cause | null = null;
  const registered = new Set(root === null ? [] : [root]);
  let gated: Set<string> | null = null;
  const reach = (abs: string, from: string): Held | null => {
    const h = held(abs, from);
    touched ||= h !== null;
    if (h !== null) {
      const located = locate(sid, from);
      if (isCause(located)) failure = located;
      else if (located !== null && !registered.has(located)) {
        registered.add(located);
        const snap = state.ensureSnapshot(sid, located, null);
        if (isCause(snap)) failure = snap;
      }
    }
    return h;
  };
  const judged = (p: string): string => {
    const abs = canonical(p);
    return escapedRoot(p, abs, enabled) === null ? abs : slash(resolve(p));
  };
  return {
    launcher: launcher(), engines: engineHome(), gated: { has: (name) => (gated ??= gatedHarnesses(root)).has(name) }, touched: () => touched, failure: () => failure,
    policyRead: (p, kind) => policyRead(sid, root, p, kind, load),
    configurationRead: (p) => configurationRead(sid, root, p, false), skillRead: (p) => configurationRead(sid, root, p, true), readControlFile: controlInFile, readScriptFile, commandPath: commandOnPath, gitChanges,
    // The real file decides: a link on PATH into a project is that project's code.
    outsideRoots: (p) => {
      const abs = canonical(p);
      return findRoot(dirname(abs), enabled) === null && !known.some((r) => within(abs, r));
    },
    isProtected: (p) => {
      const abs = canonical(p);
      if (protects(abs, globs)) return true;
      const h = machineOnly ? reach(abs, dirname(abs)) : null;
      return h !== null && protects(abs, globsOf(sid, h.root, h.loaded));
    },
    // A path whose real target leaves every accepted root is judged where it is spelled.
    inScope: (p) => {
      const abs = judged(p);
      const h = reach(abs, dirname(abs));
      return h !== null && inScope(h.lock, h.rel);
    },
    // A directory written whole writes into every root it holds, as well as below itself.
    under: (p) => {
      const abs = judged(p);
      const h = reach(abs, abs);
      return known.some((r) => within(abs, r)) || (h !== null && scopeUnder(h.lock, h.rel));
    },
  };
}

// `skill`: the question is about the installed skill file, not about a harness configuration file.
function configurationRead(sid: string, root: string | null, path: string, skill: boolean): boolean {
  if (path.includes("\0") || /^\/dev\//.test(path)) return false;
  return harnessConfigurationRead(sid, root, path, skill);
}

function harnessConfigurationRead(sid: string, root: string | null, path: string, skill: boolean): boolean {
  try {
    const actual = canonical(path), env = process.env, home = homeDir();
    // The skill is the text setup wrote for the agent to read. Its tree is protected against writes,
    // so a read of that one file discloses only what the installation gave the agent.
    const files = skill ? skillFiles() : harnessConfigFiles(home, {
      codexHome: env.CODEX_HOME || join(home, ".codex"), grokHome: env.GROK_HOME || join(home, ".grok"), claudeConfig: env.CLAUDE_CONFIG_DIR || null,
    }, root);
    if (!files.some(file => pathKey(actual) === pathKey(canonical(file))) || !statSync(actual).isFile()) return false;
    const targetRoot = findRoot(dirname(actual), enabled);
    const roots = [...new Set([...(root === null ? [] : [root]), ...(targetRoot === null ? [] : [targetRoot]), ...state.roots(sid)])];
    const sources = roots.flatMap(r => sourceDirs(readText(join(r, PRESET)) ?? "").map(dir => canonical(resolve(r, dir))));
    // Configuration symlinks cannot turn private state, installation or rule sources into inputs.
    return ![canonical(state.stateDir()), canonical(engineHome()), ...sources].some(dir => within(dir, actual))
      && !["**/.pregate", "**/.git", ...(skill ? [] : ["**/skills/pregate"]), "**/.gemini/config/plugins/pregate"].some(glob => matches(glob, actual) || matches(`${glob}/**`, actual))
      && !matches("**/.local/bin/pregate", actual);
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "ENAMETOOLONG", "ELOOP"].includes((error as { code?: string }).code ?? "")) return false;
    throw error;
  }
}

function policyRead(sid: string, root: string | null, path: string, kind: "admitted" | "inspect" | "inventory", load: () => Loaded | Cause): boolean {
  if (root === null) return false;
  const names = kind === "inventory" ? [".pregate", PRESET, LOCK] : [PRESET, LOCK];
  if (path.includes("\0") || /^\/dev\/(stdin|stdout|stderr|fd\/[0-9]+)$/.test(path)) return false;
  const actual = policyPath(path);
  if (actual === null) return false;
  if (!names.some(rel => pathKey(actual) === pathKey(join(root, rel)))) return false;
  return kind !== "admitted" || !isCause(verify(sid, root, load()));
}

function policyPath(path: string): string | null {
  try { return canonical(path); }
  catch (error) { if ((error as { code?: string }).code === "ENAMETOOLONG") return null; throw error; }
}

// The root that holds a path, with that root's lock (each read once; `lock` null without a valid one).
// `from` is where the search for the root starts: a file's folder, or a directory itself.
function holder(root: string | null, load: () => Loaded | Cause): (abs: string, from: string) => Held | null {
  const locks = new Map<string, Loaded | Cause>();
  const roots = new Map<string, string | null>();
  const lockAt = (r: string): Loaded | Cause => {
    if (!locks.has(r)) locks.set(r, r === root ? load() : lockOf(r));
    return locks.get(r)!;
  };
  return (abs, from) => {
    if (!roots.has(from)) roots.set(from, findRoot(from, enabled));
    const r = roots.get(from)!;
    if (r === null) return null;
    const l = lockAt(r);
    return { root: r, loaded: l, lock: isCause(l) ? null : l.lock, rel: relative(r, abs) };
  };
}
