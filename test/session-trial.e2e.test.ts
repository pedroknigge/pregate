import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session, Summary } from "../scripts/session-trial-evidence.ts";
import { load, published, selfCheck } from "../scripts/session-trial.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { engineAt } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The session trial's self-check: the whole runner with the real compiled engine, `pregate setup`,
// the hook commands it registers and the contract the guide proposes, and a scripted stand-in in
// place of `claude` and `codex`. The stand-in drafts a file that the default contract denies, then a
// compliant one. No model runs, and nothing leaves the temporary folder. The stand-in and the
// machine are POSIX shell, as the real run is macOS only.
setDefaultTimeout(600_000);

const RULE = "clean-code/CC-ER-002";
const POSIX = process.platform !== "win32";
const area = mkdtempSync(join(tmpdir(), "pregate-session-trial-"));
// An engine protects the folder two levels above its binary: its own, not the scratch repositories.
const engine = join(area, "engine", "build", ENGINE_FILE);
let done: { out: string; summary: Summary; page: string };
let sessions: Session[];
const of = (id: string): Session => sessions.find((s) => s.id === id)!;

beforeAll(async () => {
  if (!POSIX) return;
  engineAt(engine);
  done = await selfCheck(area, engine);
  sessions = load(done.out).sessions;
}, 600_000);
afterAll(() => removeTree(area));

test.skipIf(!POSIX)("four sessions ran: both stand-in CLIs in both arms, each to a normal exit", () => {
  expect(sessions.map((s) => s.id)).toEqual(["scratch-count.claude-code.gated", "scratch-count.claude-code.control", "scratch-count.codex.gated", "scratch-count.codex.control"]);
  for (const s of sessions) {
    expect([s.id, s.exitCode, s.timedOut]).toEqual([s.id, 0, false]);
    expect(s.cliVersion).not.toBe("");
    expect(s.wallMs).toBeGreaterThan(0);
    expect(s.verify, s.id).toBe("pass");
    expect(existsSync(join(done.out, "sessions", s.diff))).toBe(true);
  }
});

test.skipIf(!POSIX)("the gated arm approved the same contract as the reference, and the guide chose its packs", () => {
  for (const s of sessions) expect(s.contractMatchesReference, s.id).toBe(s.arm === "gated" ? true : null);
  expect(done.summary.run!.contracts.scratch!.packs).toContain("clean-code@");
  expect(done.summary.run!.contracts.scratch!.rules).toMatch(/\d+ block/);
});

for (const [harness, tool] of [["claude-code", "Write"], ["codex", "apply_patch"]] as const) {
  test.skipIf(!POSIX)(`${harness} gated: the engine recorded the scripted denial with its rule, then the accepted edits`, () => {
    const s = of(`scratch-count.${harness}.gated`);
    const edits = s.hooks.filter((h) => h.event === "pre-edit");
    expect(edits.map((h) => [h.tool, h.path, h.decision])).toEqual([[tool, "src/parse.ts", "deny"], [tool, "src/parse.ts", "allow"], [tool, "src/format.ts", "allow"]]);
    expect(edits[0]!.findings).toEqual([{ rule: RULE, path: "src/parse.ts", line: 4 }]);
    expect(edits[0]!.message).toContain(`PREGATE DENY ${RULE}`);
    expect(edits[1]!.message).toBeNull();
    // The engine records its own evaluation time for every call; the script does not invent one.
    for (const h of edits) expect(h.evaluationMs).toBeGreaterThan(0);
    // The denied draft is kept for the person who labels the denial.
    expect(readFileSync(join(done.out, "sessions", edits[0]!.deniedContent!), "utf8")).toContain("JSON.parse(text)");
    // SessionStart, three PreToolUse and Stop went through the registered hook commands.
    expect(s.hookCalls).toEqual({ total: 5, pre: 3, stop: 1, sessionStart: 1 });
  });

  test.skipIf(!POSIX)(`${harness} gated: the denial is classified repaired and the final tree has no new finding`, () => {
    const s = of(`scratch-count.${harness}.gated`);
    expect(s.denials).toEqual([expect.objectContaining({ file: "src/parse.ts", rule: RULE, decision: "deny", attempts: 1, laterAccepted: true, changed: true, finalClean: true, outcome: "repaired" })]);
    expect(s.noNew).toEqual({ ran: true, exit: 0, findings: [], advisories: [], error: null });
    expect(s.changed).toEqual(["src/format.ts", "src/parse.ts"]);
    const diff = readFileSync(join(done.out, "sessions", s.diff), "utf8");
    expect(diff).toContain("+export function parseCount");
    expect(diff).not.toContain("JSON.parse");
    expect(diff).not.toContain(".pregate/");
  });

  test.skipIf(!POSIX)(`${harness} control: no hook ran, and the final check reports the finding that the gate prevented`, () => {
    const s = of(`scratch-count.${harness}.control`);
    expect([s.hooks, s.hookCalls, s.denials]).toEqual([[], null, []]);
    expect(s.noNew).toEqual({ ran: true, exit: 1, findings: [{ rule: RULE, path: "src/parse.ts", line: 4, level: "error" }], advisories: [], error: null });
    expect(readFileSync(join(done.out, "sessions", s.diff), "utf8")).toContain("JSON.parse(text)");
  });
}

test.skipIf(!POSIX)("the page states those counts and says that they are self-check data", () => {
  expect(done.page).toContain("**Self-check data. Not trial results.**");
  expect(done.page).toContain("4 sessions ran: 2 gated and 2 control.");
  expect(done.page).toContain("**2** (file, rule) pairs in the gated sessions: 2 repaired, 0 abandoned, 0 worked-around, 0 unknown.");
  expect(done.page).toContain("reported **0** findings in the gated arm and **2** in the control arm");
  expect(done.page).toContain("Labels: 0 of 2 denials are labeled (0 true-positive, 0 false-positive, 0 unclear); 2 are unlabeled.");
  expect(done.page).toContain(`| \`${RULE}\` | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |`);
  expect(done.page).toContain(`| scratch-count | codex | 0 | 1 | ${RULE} | pass | pass |`);
  expect(readFileSync(join(done.out, "page.md"), "utf8")).toBe(done.page);
});

test.skipIf(!POSIX)("self-check evidence is refused as the published page", () => {
  expect(() => published(done.out)).toThrow("self-check evidence");
});

test.skipIf(!POSIX)("nothing was written outside the temporary folder's machines", () => {
  const run = JSON.parse(readFileSync(join(done.out, "trial.json"), "utf8")) as { kind: string; sessions: string[] };
  expect(run.kind).toBe("self-check");
  expect(run.sessions).toHaveLength(4);
  for (const m of ["gated", "control"]) expect(existsSync(join(area, m, "home", "Library", "Keychains"))).toBe(false);
  expect(existsSync(join(area, "control", "home", ".local", "share", "pregate"))).toBe(false);
});
