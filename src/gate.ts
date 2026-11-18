import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { agyNativeAsk, finishContract } from "./approval.ts";
import { disabledNotice, enabled, enforcedHere, explicitlyDisabled } from "./consent.ts";
import { delegate, form, globsOf, grammars, inputOf, type Loaded, locate, locatedForm, lockOf, machine, onSessionStart, pinned, redirect, rejected, settle, sourceDirs, sourcesOf, verify } from "./contract-diagnostic.ts";
import { decide } from "./decide.ts";
import { canonical, escapedRoot, findRoot } from "./disk.ts";
import { type Call, clock, commandGuarded, ENGINE_VERSION, engineHome, FLOOR, isCause, LAUNCHER, launcher, LOCK, NOTHING, PRESET, readText, REDIRECT, told, VERSIONS, within } from "./admission.ts";
import { gatedHarnesses } from "./machine.ts";
import { harnessConfigFiles, inScope, matches, pathKey, protects, relativePath as relative, scopeUnder, slash } from "./paths.ts";
import { approvalAskReview, literalPregate } from "./pending-review.ts";
import { homeDir } from "./platform.ts";
import type { CheckMode } from "./recorded.ts";
import { commandOnPath, controlInFile, readScriptFile } from "./control-file.ts";
import { gitChanges } from "./git-changes.ts";
import { directApprovalArgv, guard, type GuardContext } from "./shell.ts";
import { skillFiles } from "./skill.ts";
import * as state from "./state.ts";
import { causeFix, unknownFix } from "./fix.ts";
import type { Cause, Decision, HookEvent, Lock, ProposedChange, ProposedCommand, Session } from "./types.ts";

// The imperative shell around the pure core (ARCHITECTURE §4): one function per hook event, plus
// `check` for the pre-check, pre-commit and CI. Every known cause goes through decide; anything
// unforeseen throws, exits 1, and the launcher denies (A6).

export { ENGINE_VERSION, FLOOR, LAUNCHER, LOCK, PRESET, REDIRECT, VERSIONS, clock, delegate, engineHome, launcher, pinned, readText, redirect, rejected, within };
export { grammars, lockOf, onSessionStart, sourceDirs, sourcesOf };

// The hook's SessionStart: the contract briefing, and at most once a day per project the advisor
// rules that stayed clean while the agent worked. Pregate raises the promotion; the human decides.
const NUDGE_EVERY_MS = 24 * 3_600_000;

export async function sessionStart(e: Extract<HookEvent, { kind: "session-start" }>): Promise<Decision> {
  if (e.session.harness === "agy") state.clearPostInvocation(state.key(e.session));
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
  const d = await rec.onPreEdit(changes);
  if (changes[0]?.session.harness === "agy") state.queuePostInvocation(state.key(changes[0].session), d);
  return d;
}

export async function onStop(e: Extract<HookEvent, { kind: "stop" }>, budgetMs?: number): Promise<Decision> {
  if (e.session.harness === "agy") state.clearPostInvocation(state.key(e.session));
  const ses = await import("./session-command.ts");
  return ses.onStop(e, budgetMs);
}

export function onPostInvocation(e: Extract<HookEvent, { kind: "post-invocation" }>): Decision {
  if (e.session.harness !== "agy") return told(null);
  const { halt, warnings } = state.drainPostInvocation(state.key(e.session));
  if (halt !== null) return { ...told(halt), verdict: "deny", halt: true, fix: unknownFix("No deterministic path or replacement is declared for this halt. Follow the reason in this message and tell the user.") };
  return warnings.length > 0 ? told(null, warnings.join("\n\n")) : told(null);
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
  const d = approvalCommandAsk(c, askAboutApproval(evaluatePreCommand(c), c));
  if (c.session.harness === "agy") state.queuePostInvocation(state.key(c.session), d);
  return d;
}

// Same session as nativeApproval() in recorded.ts. That module is the edit gate; importing it
// here would load it on every command. `claude -p` does not mark the hook payload.
function claudeNativeAsk(session: Session): boolean {
  return !process.env.CI && session.agentId === null && session.harness === "claude-code" && session.interactive;
}

const CLAUDE_PROPOSE = "You may propose the literal command pregate approve <code> or pregate approve --yes --digest <sha> so the human gets Claude Code's permission prompt. Accept runs that command. Reject runs nothing.";
const AGY_PROPOSE = "You may propose the literal command pregate approve <code> or pregate approve --yes --digest <sha> so the human gets agy's permission prompt. Accept runs that command. Reject runs nothing.";
const ASK_HUMAN = "Ask the user to approve. Do not run the approval command yourself.";

// A denied approval attempt tells the agent what to do. Compact leads with that sentence because
// Grok shows only the first 256 characters. Where Claude Code or agy can show its own prompt, the
// agent may propose the literal command. Everywhere else it must not run the command.
function askAboutApproval(decision: Decision, c: ProposedCommand): Decision {
  if (decision.verdict !== "deny") return decision;
  if (decision.cause === "approval") {
    const command = c.command.replace(/\s+/g, " ").trim().slice(0, 500);
    decision = withInstruction(decision, `An agent cannot grant itself approval. Ask the human to run this exact command in a separate terminal: ${command}`);
  }
  if ((decision.cause !== "shell-admin" && decision.cause !== "hook-switch" && decision.cause !== "approval") || !/\bapprove\b/.test(c.command)) return decision;
  const ask = claudeNativeAsk(c.session) ? CLAUDE_PROPOSE : agyNativeAsk(c.session) ? AGY_PROPOSE : ASK_HUMAN;
  return withInstruction(decision, ask);
}

function withInstruction(decision: Decision, ask: string): Decision {
  const full = decision.full.includes(ask) ? decision.full : `${decision.full} ${ask}`.slice(0, 4000);
  const compact = `${ask} ${decision.compact}`.slice(0, 256);
  const notice = decision.notice === null || decision.notice.includes(ask) ? decision.notice : `${decision.notice} ${ask}`.slice(0, 4000);
  return { ...decision, full, compact, notice };
}

// An already-allowed literal approval becomes the native prompt in an interactive Claude Code
// parent, or an interactive agy session. Accept runs the command the agent proposed. Reject runs
// nothing. The hook does not apply the contract. Every other session keeps the allow.
function approvalCommandAsk(c: ProposedCommand, decision: Decision): Decision {
  if (!enforcedHere(c.cwd)) return decision;
  if (decision.verdict !== "none" || (!claudeNativeAsk(c.session) && !agyNativeAsk(c.session))) return decision;
  const reviews = directApprovalArgv(c.command).flatMap((argv) => {
    const review = approvalAskReview(c.cwd, argv);
    return review === null ? [] : [review];
  });
  if (reviews.length === 0) return decision;
  const warning = reviews.some((review) => review.warning);
  const summary = [...new Set(reviews.map((review) => review.summary))].join("\n");
  const detail = [...new Set(reviews.map((review) => review.detail))].join("\n\n");
  const lead = [
    warning ? "WARNING: this may weaken protection." : "PREGATE asks you to approve this contract change.",
    "Accept runs this command. Reject runs nothing.",
    c.command.trim(),
    summary,
  ].join("\n");
  const notice = lead.slice(0, 1500);
  return { ...decision, verdict: "ask", notice, compact: notice.slice(0, 256), full: `${notice}\n\n${detail}`.slice(0, 4000), fix: causeFix("approval", null, null, null) };
}

function evaluatePreCommand(c: ProposedCommand): Decision {
  const startedAt = clock();
  const sid = state.key(c.session);
  const cwd = canonical(c.cwd);
  const own = findRoot(cwd, () => true);
  // Disable prints its notice and denies only a write into another worktree this session
  // still has enabled. That comes before the allow, so the notice is not skipped.
  if (own !== null && explicitlyDisabled(own)) return disabledProjectCommand(c, sid, own, startedAt);
  // Same predicate as the hook's inert check. A directory that was never enabled allows.
  if (!commandGuarded(cwd, c.command, c.session)) return told(null);
  const located = locate(sid, cwd);
  const root = isCause(located) ? null : located;
  const call: Call = { session: c.session, kind: "pre-command", callId: c.callId, abs: null, root, rel: null, startedAt };
  if (isCause(located)) return settle(call, { ...NOTHING, form: locatedForm(sid, located, cwd) });
  const approval = administrativeApproval(root, c);   // a batch code needs no root
  if (approval !== null) return approval;
  // `enabled` can miss a root after `git init` changes its common dir. The consent record
  // still names it, so shell-admin is not dropped the way a never-enabled directory is.
  const machineOnly = root === null && state.roots(sid).length === 0 && !enforcedHere(cwd);
  const snap = root === null ? null : state.ensureSnapshot(sid, root, null);
  if (isCause(snap)) return settle(call, { ...NOTHING, form: form(snap) });
  // Finalize an already approved contract before reading its protected source folders.
  if (root !== null) finishContract(root);
  let loaded: Loaded | Cause | null = null;
  const load = () => loaded ??= lockOf(root!);
  const ctx = shellContext(sid, root, load, machineOnly);
  const noted = { text: null as string | null };
  const guarded = guard(c.command, cwd, { ...ctx, machineOnly, harness: c.session.harness, shellDetail: noted });
  const valid = loaded === null || isCause(loaded) ? null : loaded as Loaded;
  const cause = ctx.failure() ?? guarded;
  const o = { ...NOTHING, lock: valid?.lock ?? null, lockHash: valid?.hash ?? null, form: commandForm(cause, noted.text), protectedPath: cause === "protected-path" };
  return machineOnly && !ctx.touched() ? decide(inputOf(call, o)) : settle(call, o);
}

// A named shell-admin denial carries its own sentence. Every other cause keeps the generic text.
function commandForm(cause: Cause | null, detail: string | null) {
  return cause === null ? null : form(cause, undefined, cause === "shell-admin" || cause === "shell-write" ? detail : null);
}

// The human disabled this checkout. Nothing here is denied: shell-admin, hook-switch, approval,
// protected paths, `pregate approve`, `pregate enable`, and harness settings. A path that lands in
// a different worktree this session still has enabled is still that worktree's write.
function disabledProjectCommand(c: ProposedCommand, sid: string, own: string, startedAt: number): Decision {
  const notice = told(null, disabledNotice(own));
  const others = state.roots(sid).filter((r) => enabled(r) && r !== own);
  if (others.length === 0) return notice;
  const noted = { text: null as string | null };
  const base = shellContext(sid, others[0]!, () => lockOf(others[0]!), false);
  const elsewhere = (p: string): boolean => enforcedElsewhere(own, others, p);
  const ctx: GuardContext = {
    ...base, shellDetail: noted,
    isProtected: (p) => elsewhere(p) && base.isProtected(p),
    inScope: (p) => elsewhere(p) && base.inScope(p),
    under: (p) => elsewhere(p) && base.under(p),
  };
  const guarded = guard(c.command, canonical(c.cwd), { ...ctx, machineOnly: false, harness: c.session.harness });
  if (guarded !== "shell-write" && guarded !== "protected-path") return notice;
  const call: Call = { session: c.session, kind: "pre-command", callId: c.callId, abs: null, root: own, rel: null, startedAt };
  return settle(call, { ...NOTHING, form: commandForm(guarded, noted.text), protectedPath: guarded === "protected-path" });
}

// True only when the path is inside some other enabled root. A path in the disabled checkout, a
// machine file, and a path that cannot be resolved are not enforced from here.
function enforcedElsewhere(own: string, others: string[], p: string): boolean {
  try {
    const abs = canonical(p);
    return !within(own, abs) && others.some((root) => within(root, abs));
  } catch {
    return false; // fail-closed: an unresolvable path is not enforced from a disabled checkout
  }
}

// issue submit, feedback apply and storage apply stay on a separate terminal. `pregate approve`
// with a code or `--yes` is not in this list: the shell guard allows that exact command, and the
// approval log records a non-terminal confirmation. A batch code needs no root.
function administrativeApproval(root: string | null, c: ProposedCommand): Decision | null {
  const command = literalPregate(c.command, launcher());
  if (command === null) return null;
  const known = [/^issue submit [0-9a-f]{64} --yes$/, /^feedback apply [0-9a-f]{64} --yes$/, /^storage apply [0-9a-f]{64} --yes$/].some((re) => re.test(command));
  if (!known || root === null) return null;
  const text = `PREGATE: Ask the user to approve. Do not run the approval command yourself. Show the complete preview and ask the user to run ${c.command} in a separate terminal. The agent must not run the approval command.`;
  const fix = causeFix("approval", null, null, null);
  return { ...told(null), verdict: "deny", full: `${text}\nFix: ${fix.text}`, compact: text, notice: text, fix };
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
    configurationRead: (p) => configurationRead(sid, root, p, false), skillRead: (p) => configurationRead(sid, root, p, true),
    sessionBase: (p) => sessionBase(sid, p), readControlFile: controlInFile, readScriptFile, commandPath: commandOnPath, gitChanges,
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

// The text the session's snapshot gives as the file's "before": the session's base commit, or the
// dirty text recorded at the session start. null for a file the session added, an untracked or
// ignored file, a file outside every enabled root, and a root the session has no snapshot of.
function sessionBase(sid: string, path: string): string | null {
  try {
    const actual = canonical(path), holder = findRoot(dirname(actual), enabled);
    if (holder === null) return null;
    const snap = state.snapshot(sid, holder);
    if (snap === null || snap === "missing") return null;
    const before = state.beforeText(sid, snap, relative(holder, actual));
    return typeof before === "string" && !isCause(before) ? before : null;
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "ENAMETOOLONG", "ELOOP"].includes((error as { code?: string }).code ?? "")) return null;
    throw error;
  }
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
      codexHome: env.CODEX_HOME || join(home, ".codex"), grokHome: env.GROK_HOME || join(home, ".grok"),
      opencodeHome: env.OPENCODE_CONFIG_DIR || join(home, ".config/opencode"), claudeConfig: env.CLAUDE_CONFIG_DIR || null,
    }, root);
    if (!files.some(file => pathKey(actual) === pathKey(canonical(file))) || !statSync(actual).isFile()) return false;
    const targetRoot = findRoot(dirname(actual), enabled);
    const roots = [...new Set([...(root === null ? [] : [root]), ...(targetRoot === null ? [] : [targetRoot]), ...state.roots(sid)])];
    const sources = roots.flatMap(r => sourceDirs(readText(join(r, PRESET)) ?? "").map(dir => canonical(resolve(r, dir))));
    // Configuration symlinks cannot turn private state, installation or rule sources into inputs.
    return ![canonical(state.stateDir()), canonical(engineHome()), ...sources].some(dir => within(dir, actual))
      && !["**/.pregate", "**/.git", ...(skill ? [] : ["**/skills/pregate"]), "**/.gemini/config/plugins/pregate", "**/.gemini/config/plugins/pregate-global"].some(glob => matches(glob, actual) || matches(`${glob}/**`, actual))
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
