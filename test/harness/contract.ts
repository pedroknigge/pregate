import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HARNESSES, profile } from "../../src/harness/profile.ts";
import type { HarnessId, HookEnv, HookEvent, HookKind, Rejected } from "../../src/types.ts";

// The payload contract (MULTI-HARNESS §6.1): every captured payload of a harness has an expectation,
// so a new capture fails the suite until someone classifies it.

// A payload reaches decode with the event its registration names, or never reaches it at all.
export type Expectation =
  | { event: HookKind; env?: Partial<HookEnv>; out: HookEvent | Rejected | null }
  | { unregistered: string };      // why no registration of ours delivers it: event, matcher, or not a payload

export const ENV: HookEnv = { grokEvent: null, projectDir: null, remote: false };

// The registration each harness runs (MH-04): Cursor and Grok share Claude Code's.
const FLAG: Record<HarnessId, HarnessId> = { "claude-code": "claude-code", cursor: "claude-code", grok: "claude-code", codex: "codex", agy: "agy", opencode: "opencode" };

export function contract(h: HarnessId, dir: string, expectations: Record<string, Expectation>): void {
  const raw = (file: string): string => readFileSync(join(dir, file), "utf8");
  test(`${h}: every payload has an expectation, and every expectation a payload`, () => {
    expect(Object.keys(expectations).sort()).toEqual(readdirSync(dir).filter((f) => f.endsWith(".json")).sort());
  });
  for (const [file, x] of Object.entries(expectations)) {
    if ("unregistered" in x) continue;
    const env = { ...ENV, ...x.env };
    test(`${h}: ${file} (hook ${x.event})`, () => {
      expect(profile(FLAG[h], raw(file), env)).toBe(h);
      expect(HARNESSES[h].decode(x.event, raw(file), env)).toEqual(x.out);
    });
  }
}
