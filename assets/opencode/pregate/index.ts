// The PREGATE plugin for OpenCode (MULTI-HARNESS MH-05, MH-14). OpenCode has no hook process of its
// own, so this plugin is the thin shim that spawns the pinned engine for each event:
//
//   execute.before → pre          (exit 2 + stderr: throw, which fails that call alone)
//   execute.after  → the advice the pre call printed, appended to the tool result
//   first prompt   → session-start (the briefing, as an instruction entry)
//   idle           → stop         (a block reason, admitted as a synthetic message)
//
// It never decides anything: every verdict comes from `pregate hook <event> --harness opencode`.
// A project without .pregate/preset.json is inert, so the plugin costs nothing elsewhere.
// `plugins` in opencode.json names the folder that holds this file; see `pregate setup`.

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Replaced by `pregate setup` with the absolute path of <DATA>/bin/pregate.
const LAUNCHER = "@PREGATE_LAUNCHER@";
const PROJECT_LAUNCHER = ".pregate/bin/pregate";
const MISSING = "PREGATE could not evaluate: its launcher is missing; report it to the user";
const TIMEOUT_MS = 30_000;

type Payload = Record<string, unknown>;
interface Out { status: number | null; stdout: string; stderr: string }

// Read-only tools change nothing: their call reaches the engine, which ignores it. One list only, in
// src/harness/opencode.ts, so a new tool is classified in one place.

// The nearest project root: .pregate/preset.json above the nearest .git entry. `null`: inert.
function rootOf(dir: string): string | null {
  for (let d = resolve(dir); ; ) {
    if (existsSync(join(d, ".pregate/preset.json"))) return d;
    if (existsSync(join(d, ".git"))) return null;
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function present(file: string): boolean {
  try {
    const s = statSync(file);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

// The project launcher first: it runs the engine the lock pins. The installed launcher is the
// fallback, as in every other harness's global registration.
function engineOf(root: string): string | null {
  const own = join(root, PROJECT_LAUNCHER);
  if (present(own)) return own;
  return present(LAUNCHER) ? LAUNCHER : null;
}

function run(file: string, event: string, payload: Payload, cwd: string): Out {
  const r = spawnSync(file, ["hook", event, "--harness", "opencode"], {
    cwd, env: process.env, encoding: "utf8", timeout: TIMEOUT_MS, input: JSON.stringify(payload),
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function absolute(path: string): boolean {
  return path.startsWith("/") || /^[a-z]:[\\/]/i.test(path) || path.startsWith("\\\\");
}

// A tool may name a file relative to the session directory. The engine reads absolute paths only,
// so the shim resolves them against the same directory the tool resolves them against.
function located(input: unknown, dir: string): Payload {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const copy: Payload = { ...(input as Payload) };
  for (const key of ["filePath", "workdir"]) {
    const value = copy[key];
    if (typeof value === "string" && value !== "" && !absolute(value)) copy[key] = resolve(dir, value);
    else if (key === "workdir" && value === undefined && copy.command !== undefined) copy[key] = dir;
  }
  return copy;
}

function envelope(event: string, session: string, cwd: string, extra: Payload = {}): Payload {
  return { hook_event_name: event, session_id: session, cwd, ...extra };
}

// The engine's stdout on a deny is empty: the deny itself is stderr with exit 2.
function denied(o: Out): string | null {
  if (o.status === 2) return o.stderr.trim() === "" ? MISSING : o.stderr;
  return null;
}

function failed(o: Out): string {
  const line = (o.stderr.trim() || o.stdout.trim()).split("\n")[0] ?? "";
  return line === "" ? `${MISSING} (exit ${o.status ?? "none"})` : line;
}

export default {
  id: "pregate",
  setup(ctx: Record<string, any>) {
    // Advice from a pre call, to append to that call's result: key → text.
    const advice = new Map<string, string>();
    const briefed = new Set<string>();
    const attempted = new Set<string>();
    const stops = new Map<string, number>();
    const directory = (): string => {
      const dir = ctx?.location?.directory;
      return typeof dir === "string" && dir !== "" ? resolve(dir) : resolve(process.cwd());
    };
    const session = (input: Record<string, any>): string => String(input?.sessionID ?? "");

    // The briefing reaches the model as an instruction entry of this session. A project that is not
    // set up, or a missing launcher, says nothing: the pre hook reports it. `once` bounds the attempt
    // to one per session from a tool call; the next prompt tries again.
    const brief = async (sessionID: string, dir: string, once = false): Promise<void> => {
      if (briefed.has(sessionID) || (once && attempted.has(sessionID))) return;
      if (once) attempted.add(sessionID);
      const root = rootOf(dir);
      const bin = root === null ? null : engineOf(root);
      if (bin === null) return;
      const o = run(bin, "session-start", envelope("SessionStart", sessionID, dir), dir);
      if (o.status !== 0) return;
      const text = o.stdout.trim();
      if (text === "") return;
      briefed.add(sessionID);
      await ctx.session.instructions.entry.put({ key: "pregate", value: text });
    };

    ctx.tool.hook("execute.before", async (input: Record<string, any>) => {
      const dir = directory(), sessionID = session(input);
      const payload = envelope("PreToolUse", sessionID, dir, {
        tool_name: input.tool, tool_use_id: String(input.id), tool_input: located(input.input, dir),
        ...(typeof input.agent === "string" ? { agent_id: input.agent } : {}),
      });
      const root = rootOf(dir);
      const bin = root === null ? null : engineOf(root);
      if (bin === null) {
        // A project that holds a preset depends on a launcher: without one, a write must not pass.
        if (root === null) return;
        throw new Error(MISSING);
      }
      const o = run(bin, "pre", payload, dir);
      const deny = denied(o);
      if (deny !== null) throw new Error(deny);
      if (o.status !== 0) throw new Error(failed(o));
      if (o.stdout.trim() !== "") {
        if (advice.size > 500) advice.clear();
        advice.set(`${sessionID}\u0000${String(input.id)}`, o.stdout);
      }
      // The pre call of the first tool is the earliest point that has a session id: brief here too.
      await brief(sessionID, dir, true).catch(() => undefined);
    });

    ctx.tool.hook("execute.after", async (input: Record<string, any>) => {
      const key = `${session(input)}\u0000${String(input.id)}`;
      const text = advice.get(key);
      if (text === undefined) return;
      advice.delete(key);
      // Only a completed call has a result to carry the advice.
      if (input.status !== "completed") return;
      const result = input.result as { content?: string | { type: string; text?: string }[] } | undefined;
      if (result === undefined || result === null) return;
      const line = text.trimEnd();
      if (line === "") return;
      if (typeof result.content === "string") result.content = `${result.content}\n\n${line}`;
      else if (Array.isArray(result.content)) result.content = [...result.content, { type: "text", text: line }];
      else result.content = line;
    });

    ctx.session.hook("prompt", async (input: Record<string, any>) => {
      await brief(session(input), directory()).catch(() => undefined);
    });

    ctx.session.hook("experimental.idle", async (input: Record<string, any>) => {
      const dir = directory(), sessionID = session(input);
      const root = rootOf(dir);
      const bin = root === null ? null : engineOf(root);
      if (bin === null) return;
      const blocks = stops.get(sessionID) ?? 0;
      const o = run(bin, "stop", envelope("Stop", sessionID, dir, { stop_hook_active: blocks > 0 }), dir);
      if (o.status !== 0) return;
      const text = o.stdout.trim();
      if (text === "") return;
      let reason: string | null = null;
      try {
        const parsed = JSON.parse(text) as { decision?: unknown; reason?: unknown };
        if (parsed?.decision === "block" && typeof parsed.reason === "string") reason = parsed.reason;
      } catch {
        return;   // not a Stop reply: nothing to admit
      }
      if (reason === null) return;
      stops.set(sessionID, blocks + 1);
      await ctx.session.synthetic({ sessionID: input.sessionID, text: reason, description: "PREGATE Stop" });
    });
  },
};
