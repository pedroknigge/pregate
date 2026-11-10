import { expect, test } from "bun:test";
import { promotionReady, promotionText, reportText, summarize, type Recorded } from "../src/report.ts";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonical } from "../src/disk.ts";
import { report } from "../src/report-command.ts";
import { compile } from "../src/compile.ts";
import { sourcesOf, VERSIONS } from "../src/gate.ts";
import { staticRulesFor } from "../src/languages.ts";
import { ensureSnapshot, eventName, H, record, stateDir } from "../src/state.ts";
import { removeTree } from "./remove-tree.ts";

test("recorded events report shadow, rules, examples, halts, window and next-attempt correction", () => {
  const records = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const result = summarize(records, "/repo", 10);
  expect(result.calls).toBe(4);
  expect(result.denials).toBe(2);
  expect(result.shadow).toBe(1);
  expect(result.halts).toBe(1);
  expect(result.correctedInOneAttempt).toBe(1);
  expect(result.rules[0]).toEqual({ rule: "core/CC-FN-001", count: 2, shadow: 1, enforcement: "mixed" });
  expect(result.examples[0]!.message).toBe("Function exceeds 45 lines.");
  expect(reportText(result, "1970-01-01T00:00:00.010Z")).toContain("src/a.ts:8");
  expect(summarize(records, "/other", 0).calls).toBe(1);
  expect(summarize(records, "/repo", 100).calls).toBe(0);
});

test("one denied call distinguishes enforced findings from shadow observations", () => {
  const records = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const denied = records.find(({ event }) => event.root === "/repo" && event.verdict === "deny")!;
  const observed = records.find(({ event }) => event.root === "/repo" && event.shadowed)!;
  const event = { ...denied.event, shadowed: true,
    violations: [...denied.event.violations, { ...observed.event.violations[0]!, rule: "core/CC-FN-002" }],
    enforcement: { "core/CC-FN-001": "enforce", "core/CC-FN-002": "shadow" } as const };
  const result = summarize([{ session: denied.session, event }], "/repo", 0);
  expect(result.denials).toBe(1);
  expect(result.shadow).toBe(1);
  expect(result.rules).toEqual([
    { rule: "core/CC-FN-001", count: 1, shadow: 0, enforcement: "enforce" },
    { rule: "core/CC-FN-002", count: 1, shadow: 1, enforcement: "shadow" },
  ]);
  expect(result.examples.map((e) => e.shadow)).toEqual([false, true]);
});

test("decision timing includes real zero values and discloses legacy or invalid measurements", () => {
  const old = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const records = [0, 10, 20, Infinity, -1, undefined].map((evaluationMs, i) => ({
    session: `timing-${i}`, event: { ...old[0]!.event, root: "/repo", at: 10 + i, evaluationMs },
  }));
  const result = summarize(records, "/repo", 0);
  expect(result.timing).toEqual({ measured: 3, unmeasured: 3, p50Ms: 10, p95Ms: 20, maxMs: 20 });
  expect(reportText(result, "start")).toContain("3 measured · 3 unmeasured · p50 10.0 ms · p95 20.0 ms · max 20.0 ms");
  const legacy = summarize(old, "/repo", 10);
  expect(legacy.timing.measured).toBe(0);
  expect(legacy.timing.p50Ms).toBeNull();
  expect(reportText(legacy, "start")).toContain("timing unavailable");
  expect(summarize([], "/repo", 0).timing).toEqual({ measured: 0, unmeasured: 0, p50Ms: null, p95Ms: null, maxMs: null });
});

test("warnings remain informational and are visible independently of blocking counts", () => {
  const records = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const event = { ...records[0]!.event, warnings: [{ ...records[1]!.event.violations[0]!, severity: "warn" as const }],
    warningMessages: ["Consider simplifying this function.\nDetails"] };
  const result = summarize([{ session: "one", event }], "/repo", 0);
  expect(result.denials).toBe(0); expect(result.shadow).toBe(0); expect(result.rules).toEqual([]);
  expect(result.warnings).toBe(1);
  expect(result.warningRules).toEqual([{ rule: "core/CC-FN-001", count: 1 }]);
  expect(reportText(result, "start")).toContain("[warning]: Consider simplifying this function.");
  expect(summarize(records, "/repo", 0).warnings).toBe(0);
  const advised = summarize([{ session: "one", event: { ...event, violations: [], warnings: [{ ...records[1]!.event.violations[0]!, rule: "clean-code/CC-FN-002", severity: "deny" as const }],
    enforcement: { "clean-code/CC-FN-001": "advisor", "clean-code/CC-FN-002": "advisor", "core/EVA-CAST-001": "advisor", "core/EVA-SUP-001": "enforce" } as const } }], "/repo", 0);
  expect(advised.enforceCandidates).toEqual(["core/EVA-CAST-001", "clean-code/CC-FN-001"]);
  expect(reportText(advised, "start")).toContain("Ready to promote to enforce");
  expect(reportText(advised, "start")).toContain('core/EVA-CAST-001: set {"enforcement": "enforce"} in overrides');
});

test("incomplete Stops are explicit historical observations, not inferred from legacy none/shadow/approved events", () => {
  const records = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const v = records[1]!.event.violations[0]!;
  const stop = { ...records[0]!.event, at: 10, kind: "stop" as const, verdict: "none" as const, violations: [v],
    stopIncomplete: { reason: "limit" as const, cause: null }, message: "Incomplete Stop" };
  const result = summarize([{ session: "one", event: stop },
    { session: "two", event: { ...stop, at: 12, stopIncomplete: { reason: "human-cause", cause: "lock-stale" }, violations: [] } },
    { session: "legacy", event: { ...stop, at: 13, stopIncomplete: undefined } },
    { session: "before", event: { ...stop, at: 1 } },
    { session: "other", event: { ...stop, root: "/other" } }], "/repo", 10);
  expect(result.incompleteStops.map((e) => e.session)).toEqual(["one", "two"]);
  expect(result.incompleteStops[0]!.violations).toEqual([v]);
  expect(result.incompleteStops[1]!.cause).toBe("lock-stale");
  const text = reportText(result, "start");
  expect(text).toContain("2 incomplete Stops recorded");
  expect(text).toContain("historical events, not proof that findings are still present");
  expect(summarize(records, "/repo", 0).incompleteStops).toEqual([]);
});

test("report skips old dated content before parsing, reads flat events and filters within the day", () => inStateArea("pregate-report-", (area) => {
  const now = Date.now(), root = area;
  const records = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const event = { ...records[1]!.event, root, path: join(root, "a.ts"), at: now };
  record("report", event, null);
  const folder = join(stateDir(), "sessions/report/events");
  mkdirSync(join(folder, "2000-01-01")); writeFileSync(join(folder, "2000-01-01/broken.json"), "not JSON");
  const legacy = { ...event, callId: "legacy", at: now - 1000 };
  writeFileSync(join(folder, eventName(legacy)), JSON.stringify(legacy));
  const stale = { ...event, callId: "outside", at: now - 86400000 * 2 };
  record("report", stale, null);
  const result = report(["--json", "--days", "1", "--repo", root]);
  expect(result.code).toBe(0); expect(JSON.parse(result.text).calls).toBe(2);
  expect(report(["--days", "1e200"]).code).toBe(1);
}));

test("report shows the retained baseline after a commit without changing snapshot or history", () => inStateArea("pregate-report-baseline-", (area) => {
  const root = `${area}/repo`; // canonical form, as the engine records it (join would use \ on Windows)
  mkdirSync(join(root, ".pregate"), { recursive: true });
  const run = (args: string[]) => {
    const result = Bun.spawnSync(["git", "-c", "commit.gpgsign=false", ...args], { cwd: root, stdout: "pipe", stderr: "pipe",
      env: { ...process.env, GIT_AUTHOR_NAME: "report test", GIT_AUTHOR_EMAIL: "report@test.invalid",
        GIT_COMMITTER_NAME: "report test", GIT_COMMITTER_EMAIL: "report@test.invalid" } });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    return result.stdout.toString().trim();
  };
  writeFileSync(join(root, ".pregate/preset.json"), "{}\n");
  writeFileSync(join(root, "a.ts"), "export const value = 1;\n");
  run(["init", "-q"]); run(["add", "."]); run(["commit", "-qm", "initial"]);
  const head = run(["rev-parse", "HEAD"]);
  writeFileSync(join(root, "a.ts"), "export const value = 2;\n");
  const snapshot = ensureSnapshot("baseline", root, () => true);
  expect(typeof snapshot).toBe("object");
  const metadata = join(stateDir(), "sessions/baseline", H(root), "snapshot.json");
  const before = readFileSync(metadata, "utf8");
  run(["add", "."]); run(["commit", "-qm", "changed during session"]);
  const currentHead = run(["rev-parse", "HEAD"]);
  expect(currentHead).not.toBe(head);
  const old = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const event = { ...old[1]!.event, root, path: join(root, "a.ts"), at: Date.now() };
  record("baseline", event, null);
  const eventFile = join(stateDir(), "sessions/baseline/events", new Date(event.at).toISOString().slice(0, 10), eventName(event));
  const history = readFileSync(eventFile, "utf8");
  const result = report(["--json", "--repo", root]);
  expect(result.code).toBe(0);
  const json = JSON.parse(result.text);
  expect(json.sessionBaselines).toEqual([{ session: "baseline", status: "available", head, currentHead,
    startedWithSession: true, dirtyFiles: 1, createdAt: JSON.parse(before).at, reason: null }]);
  expect(json.sessionBaselines[0].createdAt).toBeGreaterThan(0);
  expect(report(["--repo", root]).text).toContain("A clean CLI check does not clear a Stop finding");
  expect(readFileSync(metadata, "utf8")).toBe(before);
  expect(readFileSync(eventFile, "utf8")).toBe(history);
}));

test("report discloses missing, invalid and legacy baselines without recreating state", () => inStateArea("pregate-report-baseline-", (area) => {
  const root = area;
  const old = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const event = { ...old[1]!.event, root, path: join(root, "a.ts"), at: Date.now() };
  for (const session of ["missing", "lost", "invalid", "legacy"]) record(session, event, null);
  const metadata = (session: string) => join(stateDir(), "sessions", session, H(root), "snapshot.json");
  for (const session of ["lost", "invalid", "legacy"]) mkdirSync(join(metadata(session), ".."), { recursive: true });
  writeFileSync(metadata("invalid"), "{broken");
  writeFileSync(metadata("legacy"), JSON.stringify({ root, head: null, start: false, dirty: {} }));
  const foreign = { ...event, root: "/other", callId: "other" };
  record("other", foreign, null);
  const result = report(["--json", "--repo", root]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.text).sessionBaselines).toEqual([
    { session: "invalid", status: "invalid", head: null, currentHead: null, startedWithSession: null,
      dirtyFiles: null, createdAt: null, reason: "Snapshot metadata cannot be read." },
    { session: "legacy", status: "available", head: null, currentHead: null, startedWithSession: false,
      dirtyFiles: 0, createdAt: null, reason: null },
    { session: "lost", status: "missing", head: null, currentHead: null, startedWithSession: null,
      dirtyFiles: null, createdAt: null, reason: "Snapshot file missing from the existing session root." },
    { session: "missing", status: "missing", head: null, currentHead: null, startedWithSession: null,
      dirtyFiles: null, createdAt: null, reason: "No retained snapshot." },
  ]);
  expect(readFileSync(metadata("invalid"), "utf8")).toBe("{broken");
  expect(report(["--repo", root]).text).toContain("invalid; Snapshot metadata cannot be read");
  expect(existsSync(metadata("missing"))).toBe(false);
  expect(existsSync(metadata("lost"))).toBe(false);
  for (const mutation of [{ root: "/wrong" }, { head: "not-a-commit" }, { start: "true" }, { dirty: null },
    { dirty: [] }, { dirty: { "a.ts": "wrong-hash" } }, { at: "wrong-time" }]) {
    writeFileSync(metadata("invalid"), JSON.stringify({ root, head: null, start: false, dirty: {}, ...mutation }));
    const baseline = JSON.parse(report(["--repo", root, "--json"]).text).sessionBaselines.find((b: { session: string }) => b.session === "invalid");
    expect(baseline.status).toBe("invalid");
    expect(baseline.reason).toBe("Snapshot metadata is invalid.");
  }
}));

test("report proposes for enforce only clean advisor rules that read a file in scope", () => inStateArea("pregate-report-idle-", (area) => {
  const root = `${area}/repo`;
  mkdirSync(join(root, ".pregate"), { recursive: true });
  const preset = JSON.stringify({ ...JSON.parse(readFileSync("catalog/presets/legacy-safe.json", "utf8")), enforcement: "advisor" });
  writeFileSync(join(root, ".pregate/preset.json"), preset);
  const compiled = compile(preset, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  writeFileSync(join(root, ".pregate/pregate.lock.json"), compiled.text);
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/a.ts"), "export const value = 1;\n");
  const old = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const enforcement = Object.fromEntries(compiled.lock.rules.map((rule) => [rule.id, "advisor" as const]));
  record("idle", { ...old[0]!.event, root, path: join(root, "src/a.ts"), at: Date.now(), violations: [], warnings: [], enforcement }, null);
  const read = new Set(staticRulesFor(compiled.lock, "src/a.ts").map((rule) => rule.id));
  const candidates = JSON.parse(report(["--json", "--repo", root]).text).enforceCandidates as string[];
  // Evidence obligations and rules for absent languages have 0 findings without reading anything.
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.length).toBeLessThan(compiled.lock.rules.length);
  expect(candidates.every((id) => read.has(id))).toBe(true);
  expect(candidates.some((id) => id.includes("CORE-INV"))).toBe(false);
}), 30_000);

function inStateArea(prefix: string, run: (area: string) => void): void {
  withStateHome(process.env.XDG_STATE_HOME, canonical(mkdtempSync(join(tmpdir(), prefix))), run);
}

function withStateHome(saved: string | undefined, area: string, run: (area: string) => void): void {
  try {
    process.env.XDG_STATE_HOME = join(area, "state");
    run(area);
  } finally {
    if (saved === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = saved;
    removeTree(area);
  }
}

test("the report says what the gate did to the agent: denials repaired and advisor findings gone on the next edit", () => {
  const records = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const base = records[0]!.event, finding = records[1]!.event.violations[0]!;
  const enforcement = { [finding.rule]: "advisor" } as const;
  const edit = (at: number, path: string, warnings: typeof base.violations) => ({ session: "one",
    event: { ...base, at, kind: "pre-edit" as const, path, verdict: "none" as const, form: null, shadowed: false, violations: [], warnings, enforcement } });
  const result = summarize([edit(1, "/repo/a.ts", [finding]), edit(2, "/repo/b.ts", [finding]), edit(3, "/repo/a.ts", []), edit(4, "/repo/b.ts", [finding])], "/repo", 0);
  expect([result.advised, result.advisedResolved]).toEqual([3, 1]);
  expect(reportText(result, "start")).toContain("Agent loop: stopped before a write 0 times, repaired on the next attempt 0 times; 3 advisor findings shown, 1 gone on the same file's next edit.");
  const fixture = summarize(records, "/repo", 10);
  expect(reportText(fixture, "start")).toContain(`Agent loop: stopped before a write ${fixture.denials} times, repaired on the next attempt 1 time;`);
});

test("promotion is ready only for advisor rules that were advisor before the window and stayed clean over enough edits", () => {
  const records = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8")) as Recorded[];
  const base = records[0]!.event, finding = records[1]!.event.violations[0]!;
  const day = 86_400_000, now = 20 * day;
  const enforcement = { "a/CLEAN": "advisor", "a/NOISY": "advisor", "a/BLOCKS": "enforce" } as const;
  const edit = (at: number, policy: Record<string, "advisor" | "enforce">, warnings: typeof base.violations = []) => ({ session: "one",
    event: { ...base, root: "/repo", at, kind: "pre-edit" as const, path: "/repo/a.ts", verdict: "none" as const, form: null, shadowed: false, violations: [], warnings, enforcement: policy } });
  const recent = Array.from({ length: 20 }, (_, i) => edit(now - day - i, { ...enforcement, "a/NEW": "advisor" }));
  const history = [edit(now - 9 * day, enforcement), ...recent, edit(now - 2 * day, enforcement, [{ ...finding, rule: "a/NOISY" }])];
  expect(promotionReady(history, "/repo", now)).toEqual({ rules: ["a/CLEAN"], edits: 21 });
  expect(promotionReady(history.slice(0, 15), "/repo", now)).toEqual({ rules: [], edits: 14 });
  expect(promotionReady(history.slice(1), "/repo", now).rules).toEqual([]);
  expect(promotionReady(history, "/other", now)).toEqual({ rules: [], edits: 0 });
  expect(promotionText({ rules: ["a/CLEAN"], edits: 21 })).toBe("Promotion ready: 1 advisor rule reported no finding in the last 7 days over 21 checked edits (a/CLEAN). Tell the user once in this session. The human reviews them with `pregate promote --preview`; do not run an approval.");
});
