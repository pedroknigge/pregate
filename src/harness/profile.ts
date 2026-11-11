import type { Decision, Emission, HarnessId, HookEnv, HookEvent, HookKind, Rejected } from "../types.ts";
import * as agy from "./agy.ts";
import * as claude from "./claude.ts";
import * as codex from "./codex.ts";
import * as cursor from "./cursor.ts";
import * as grok from "./grok.ts";
import { parse } from "./wire.ts";

// The adapter contract (MH-01). null from decode: an event that is recognized and ignored.
interface Adapter {
  VERIFIED: string;                // the CLI version whose payloads are in test/payloads/<harness>/
  decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null;
  encode(kind: HookEvent["kind"], d: Decision): Emission;
}
// The five adapters, for main (which one decodes a call) and doctor (each VERIFIED).
export const HARNESSES = { "claude-code": claude, codex, cursor, grok, agy } satisfies Record<HarnessId, Adapter>;

// MH-03: the payload names the harness before the flag does, because one registration in
// ~/.claude/settings.json serves Claude Code, Cursor and Grok. Only top-level keys count: content
// that spells "cursor_version" inside a Write cannot switch the profile. GROK_HOOK_EVENT alone does
// not either: harnesses inherit their parent's environment.
export function profile(flag: HarnessId, raw: string, env: HookEnv): HarnessId {
  const p = parse(raw);
  if (p === null) return flag;
  if (env.grokEvent !== null && Object.hasOwn(p, "hookEventName")) return "grok";
  return Object.hasOwn(p, "cursor_version") ? "cursor" : flag;
}

// Whether a payload names a subagent event, in the snake case of Cursor or the camel case of Grok.
export function subagentEvent(raw: string): boolean {
  const p = parse(raw);
  return p !== null && [p.hook_event_name, p.hookEventName].some((name) => typeof name === "string" && /^subagent/i.test(name));
}
