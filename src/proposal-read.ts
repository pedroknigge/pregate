import { isAbsolute, join, resolve } from "node:path";
import { dataHome } from "./consent.ts";
import { canonical } from "./disk.ts";
import { told } from "./inertia.ts";
import { pathKey } from "./paths.ts";
import type { Decision, HookEvent } from "./types.ts";

// Read, Grep and Glob of the pending-proposal directory. Other reads stay allowed.
// A search rooted above that directory is denied when its path or pattern names it.
export function readDecision(event: Extract<HookEvent, { kind: "pre-read" }>): Decision {
  const hit = event.paths.length === 0
    ? mentions(event.hint) && touchesProposals(event.cwd, event.cwd, event.hint)
    : event.paths.some((path) => touchesProposals(path, event.cwd, event.hint));
  if (!hit) return told(null);
  const text = "PREGATE DENY protected-path: pending approval proposals are not readable by the agent. The human reviews them in a terminal.\n";
  return { ...told(text), verdict: "deny", halt: false, cause: "protected-path", full: text, compact: text.slice(0, 256), notice: text };
}

function mentions(text: string): boolean {
  return /pregate|proposals/i.test(text);
}

export function touchesProposals(target: string, cwd: string, hint = ""): boolean {
  const proposals = pathKey(join(dataHome(), "proposals"));
  const data = pathKey(dataHome());
  const abs = resolved(target, cwd);
  if (abs === proposals || abs.startsWith(`${proposals}/`)) return true;
  if (abs === data || abs.startsWith(`${data}/`)) return true;
  const root = abs.endsWith("/") ? abs : `${abs}/`;
  return mentions(`${target}\n${hint}`) && proposals.startsWith(root);
}

function resolved(target: string, cwd: string): string {
  const abs = isAbsolute(target) ? target : resolve(cwd, target);
  try { return pathKey(canonical(abs)); }
  catch { return pathKey(abs); }
}
