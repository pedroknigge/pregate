import { describe, expect, spyOn, test } from "bun:test";
import { LOOP_DEFAULTS, blocking, decide, merge } from "../src/decide.ts";
import type { CallEvent, Cause, Decision, DecideInput, Lock, LockRule, Severity, Violation } from "../src/types.ts";

const FILE = "src/billing/invoice.ts";

function rule(id: string, check: string, severity: Severity, integrity: boolean): LockRule {
  return {
    id, aliases: [id], check, params: { max: 40, paths: ["**"], exclude: [] }, severity, phases: ["pre", "stop", "commit", "ci"], integrity,
    impl: { kind: "primitive", primitive: "metric", metric: "fn.lines" }, origin: { "params.max": "alias" },
    text: {
      message: "{symbol} has {measured} lines (limit {limit}).",
      why: "Long functions mix levels of abstraction and are hard to change safely.",
      fix: "Extract a cohesive block and name it after the domain concept it computes.",
      avoid: "One-line helpers and pass-through functions.",
      source: "Clean Code (R. C. Martin, 2008), ch. 3, paraphrased",
    },
  };
}

function lock(change: Partial<Lock> = {}): Lock {
  return {
    lockVersion: 1, engine: "0.1.0", core: "0.1.0", coreHash: "c".repeat(64), presetHash: "p".repeat(64), sourcesHash: "s".repeat(64),
    preset: { name: "functional-ts", version: "0.1.0", methodologies: ["core/clean-code", "core/tdd", "core/pregate-integrity"] },
    enforcement: "enforce", scope: { include: ["src/**"], exclude: [] }, generatedMarkers: ["@generated"],
    layers: {}, sourceDirs: [], ratchet: "no-new", loop: LOOP_DEFAULTS, ownedByArkgate: [],
    rules: [
      rule("core/CC-ER-002", "core/errors/no-empty-catch@1.0.0", "warn", false),
      rule("core/CC-FN-001", "core/complexity/fn-max-lines@1.0.0", "deny", false),
      rule("core/CC-FN-002", "core/complexity/fn-max-params@1.0.0", "deny", false),
      rule("core/EVA-SUP-001", "core/integrity/new-inline-suppression@1.0.0", "deny", true),
      rule("core/TDD-DEL-001", "core/testing/assertions-no-decrease@1.0.0", "ask", false),
    ],
    ...change,
  };
}

const SEVERITY: Record<string, Severity> = {
  "core/CC-ER-002": "warn", "core/CC-FN-001": "deny", "core/CC-FN-002": "deny",
  "core/EVA-SUP-001": "deny", "core/TDD-DEL-001": "ask",
};

function v(rule: string, line: number, symbol = "Invoice.calculateTotals"): Violation {
  return { rule, path: FILE, line, symbol, measured: 71, limit: 40, atSessionStart: null, severity: SEVERITY[rule] ?? "deny" };
}

let clock = 1000;
function ev(change: Partial<CallEvent>): CallEvent {
  clock += 10;
  return {
    at: clock, callId: `toolu_${clock}`, turn: "turn-1", agentId: null, kind: "pre-edit", path: FILE,
    verdict: "deny", halted: false, form: null, shadowed: false, violations: [], afterSha: null, astHash: `h${clock}`,
    ...change,
  };
}

const denied = (rules: string[], astHash: string | null = null): CallEvent =>
  ev({ violations: rules.map((r, k) => v(r, 10 + k)), ...(astHash === null ? {} : { astHash }) });
const formDenied = (form: Cause = "syntax"): CallEvent => ev({ form, astHash: null });

function input(change: Partial<DecideInput>): DecideInput {
  return {
    lock: lock(), lockHash: "a".repeat(64), launcher: "/repo/.pregate/bin/pregate",
    session: { id: "s1", harness: "claude-code", agentId: null, turnId: "turn-1", interactive: true },
    event: "pre-edit", path: FILE, introduced: [], form: null, protectedPath: false,
    history: [], turnDenials: 0, astHash: "h-now", stop: null, ...change,
  };
}

type Expect = Partial<Pick<Decision, "verdict" | "halt" | "cause" | "attempt">> & {
  violations?: number; warnings?: number; notice?: RegExp | null; full?: RegExp;
};
const CASES: [string, DecideInput, Expect][] = [
  ["nothing introduced", input({}), { verdict: "none", halt: false, cause: null, violations: 0, notice: null }],
  ["warn only goes to context", input({ introduced: [v("core/CC-ER-002", 4)] }),
    { verdict: "none", warnings: 1, full: /informational; no action required for this task/ }],
  ["first deny", input({ introduced: [v("core/CC-FN-001", 42)] }),
    { verdict: "deny", halt: false, attempt: 1, violations: 1, notice: null, full: /attempt 1/ }],
  ["second deny on (file, rule)", input({ introduced: [v("core/CC-FN-001", 42)], history: [denied(["core/CC-FN-001"])] }),
    { verdict: "deny", halt: false, attempt: 2 }],
  ["third deny escalates to stop", input({
    introduced: [v("core/CC-FN-001", 42)], history: [denied(["core/CC-FN-001"]), ev({ verdict: "none" }), denied(["core/CC-FN-001"])],
  }), { verdict: "deny", halt: true, attempt: 3, notice: /retry limit/, full: /PREGATE stopped this turn/ }],
  ["another rule has its own counter", input({
    introduced: [v("core/CC-FN-002", 3)], history: [denied(["core/CC-FN-001"]), denied(["core/CC-FN-001"])],
  }), { verdict: "deny", halt: false, attempt: 1 }],
  ["form denies do not consume the rule counter", input({
    introduced: [v("core/CC-FN-001", 42)], history: [formDenied(), formDenied(), denied(["core/CC-FN-001"])],
  }), { verdict: "deny", halt: false, attempt: 2 }],
  ["same AST as a denied attempt is flagged", input({
    introduced: [v("core/CC-FN-002", 3)], astHash: "h-same", history: [denied(["core/CC-FN-001"], "h-same")],
  }), { verdict: "deny", halt: false, attempt: 1, full: /repeats a denied one or makes no progress/ }],
  ["count that drops is progress", input({
    introduced: [v("core/CC-FN-001", 42)], history: [denied(["core/CC-FN-001", "core/CC-FN-001"])],
  }), { verdict: "deny", halt: false, attempt: 2, full: /^(?![\s\S]*makes no progress)/ }],
  ["no progress for noProgressLimit attempts escalates early", input({
    lock: lock({ loop: { ...LOOP_DEFAULTS, maxDenialsPerFileRule: 10 } }),
    introduced: [v("core/CC-FN-001", 42)], history: [denied(["core/CC-FN-001"]), denied(["core/CC-FN-001"])],
  }), { verdict: "deny", halt: true, attempt: 3, notice: /without progress/ }],
  ["a passing write breaks the no-progress run", input({
    lock: lock({ loop: { ...LOOP_DEFAULTS, maxDenialsPerFileRule: 10 } }),
    introduced: [v("core/CC-FN-001", 42)],
    history: [denied(["core/CC-FN-001"]), ev({ verdict: "none" }), denied(["core/CC-FN-001"])],
  }), { verdict: "deny", halt: false, attempt: 3 }],
  ["turn cap not exceeded yet", input({ introduced: [v("core/CC-FN-001", 42)], turnDenials: 14 }),
    { verdict: "deny", halt: false }],
  ["turn cap exceeded: deny + halt, severity never relaxed", input({ introduced: [v("core/CC-FN-001", 42)], turnDenials: 15 }),
    { verdict: "deny", halt: true, notice: /denial limit for this turn/ }],
  ["turn cap counts for form denies", input({ form: { cause: "syntax", line: 7 }, turnDenials: 15 }),
    { verdict: "deny", halt: true, cause: "syntax", notice: /denial limit/ }],
  ["subagent has its own budget", input({
    session: { id: "s1", harness: "claude-code", agentId: "a0000000000000001", turnId: "turn-1", interactive: false },
    introduced: [v("core/CC-FN-001", 42)], history: [denied(["core/CC-FN-001"]), denied(["core/CC-FN-001"])],
  }), { verdict: "deny", halt: false, attempt: 1 }],
  ["subagent attempts count among its own", input({
    session: { id: "s1", harness: "claude-code", agentId: "a1", turnId: "turn-1", interactive: false },
    introduced: [v("core/CC-FN-001", 42)],
    history: [{ ...denied(["core/CC-FN-001"]), agentId: "a1" }, { ...denied(["core/CC-FN-001"]), agentId: "a1" }],
  }), { verdict: "deny", halt: true, attempt: 3 }],
  ["one form deny", input({ form: { cause: "syntax", line: 7 } }),
    { verdict: "deny", halt: false, cause: "syntax", attempt: 1, violations: 0, notice: null }],
  ["three form denies in a row halt", input({ form: { cause: "tool-will-fail", line: null }, history: [formDenied(), formDenied()] }),
    { verdict: "deny", halt: true, attempt: 3, notice: /three consecutive edits[\s\S]*text to replace/, full: /Do not retry: tell the user the cause/ }],
  ["a rule deny breaks the form run", input({
    form: { cause: "syntax", line: 7 }, history: [formDenied(), denied(["core/CC-FN-001"]), formDenied()],
  }), { verdict: "deny", halt: false, attempt: 2 }],
  ["human cause: deny + halt + notice, without a lock", input({ lock: null, form: { cause: "lock-stale", line: null } }),
    { verdict: "deny", halt: true, cause: "lock-stale", notice: /pregate preset diagnose --json[\s\S]*pregate update --project --preview/ }],
  ["protected path without a lock is a form deny", input({ lock: null, form: { cause: "protected-path", line: null } }),
    { verdict: "deny", halt: false, cause: "protected-path", notice: null }],
  ["ask when interactive, allowed and not protected", input({ introduced: [v("core/TDD-DEL-001", 12)] }),
    { verdict: "ask", halt: false, notice: /requests your approval/, full: /PREGATE asked the user/ }],
  ["ask in a non-interactive session becomes deny + halt", input({
    session: { id: "s1", harness: "claude-code", agentId: null, turnId: "turn-1", interactive: false }, introduced: [v("core/TDD-DEL-001", 12)],
  }), { verdict: "deny", halt: true, notice: /cannot ask/ }],
  ["ask with allowAsk false becomes deny + halt", input({
    lock: lock({ loop: { ...LOOP_DEFAULTS, allowAsk: false } }), introduced: [v("core/TDD-DEL-001", 12)],
  }), { verdict: "deny", halt: true }],
  ["ask on a protected path becomes deny + halt", input({ protectedPath: true, introduced: [v("core/TDD-DEL-001", 12)] }),
    { verdict: "deny", halt: true }],
  ["ask next to a deny is a plain deny", input({ introduced: [v("core/TDD-DEL-001", 12), v("core/CC-FN-001", 42)] }),
    { verdict: "deny", halt: false, violations: 2 }],
  ["ask at the turn cap is deny + halt", input({ introduced: [v("core/TDD-DEL-001", 12)], turnDenials: 15 }),
    { verdict: "deny", halt: true }],
  ["shadow mutes a rule deny and keeps it for the record", input({
    lock: lock({ enforcement: "shadow" }), introduced: [v("core/CC-FN-001", 42), v("core/CC-ER-002", 4)],
  }), { verdict: "none", halt: false, violations: 1, warnings: 0, notice: null }],
  ["shadow keeps integrity rules", input({
    lock: lock({ enforcement: "shadow" }), introduced: [v("core/CC-FN-001", 42), v("core/EVA-SUP-001", 3)],
  }), { verdict: "deny", violations: 1 }],
  ["shadow mutes an agent form cause and keeps it for the record", input({
    lock: lock({ enforcement: "shadow" }), form: { cause: "syntax", line: 7 },
  }), { verdict: "none", halt: false, cause: "syntax" }],
  ["shadow keeps protected paths", input({ lock: lock({ enforcement: "shadow" }), form: { cause: "protected-path", line: null } }),
    { verdict: "deny", cause: "protected-path" }],
  ["shadow keeps shell writes: the target may be protected", input({
    lock: lock({ enforcement: "shadow" }), event: "pre-command", path: null, form: { cause: "shell-write", line: null },
  }), { verdict: "deny", cause: "shell-write" }],
  ["shadow keeps unresolvable imports: integrity cannot be evaluated", input({
    lock: lock({ enforcement: "shadow" }), form: { cause: "unresolvable-import", line: 2 },
  }), { verdict: "deny", cause: "unresolvable-import" }],
  ["shadow keeps shell admin commands", input({
    lock: lock({ enforcement: "shadow" }), event: "pre-command", path: null, form: { cause: "shell-admin", line: null },
  }), { verdict: "deny", cause: "shell-admin" }],
  ["shadow keeps human causes", input({ lock: lock({ enforcement: "shadow" }), form: { cause: "state-io", line: null } }),
    { verdict: "deny", halt: true, cause: "state-io" }],
  ["a regex that gave up is a human cause, in shadow too: its no match is not an allow (O27)", input({
    lock: lock({ enforcement: "shadow" }), form: { cause: "regex-limit", line: 3 },
  }), { verdict: "deny", halt: true, cause: "regex-limit", notice: /repeated groups/, full: /Only the user can fix this/ }],
  ["stop with nothing pending", input({ event: "stop", path: null, stop: { blocks: 0, reentry: false, approved: [] } }),
    { verdict: "none", notice: null }],
  ["stop blocks on introduced violations", input({
    event: "stop", path: null, introduced: [v("core/CC-FN-001", 42)], stop: { blocks: 0, reentry: false, approved: [] },
  }), { verdict: "deny", halt: false, attempt: 1, full: /Do not remove functionality or tests to comply/ }],
  ["stop blocks again on reentry below the cap", input({
    event: "stop", path: null, introduced: [v("core/CC-FN-001", 42)], stop: { blocks: 1, reentry: true, approved: [] },
  }), { verdict: "deny", attempt: 2 }],
  ["stop at the cap lets the turn end and tells the human", input({
    event: "stop", path: null, introduced: [v("core/CC-FN-001", 42)], stop: { blocks: 2, reentry: true, approved: [] },
  }), { verdict: "none", halt: false, cause: null, violations: 0, notice: /Stop limit[\s\S]*core\/CC-FN-001/ }],
  ["stop at the cap still reports approved asks", input({
    event: "stop", path: null, introduced: [v("core/CC-FN-001", 42)],
    stop: { blocks: 2, reentry: true, approved: [v("core/TDD-DEL-001", 12)] },
  }), { verdict: "none", notice: /Stop limit[\s\S]*core\/CC-FN-001[\s\S]*you approved[\s\S]*core\/TDD-DEL-001/ }],
  ["stop blocks an agent form cause", input({
    event: "stop", path: FILE, form: { cause: "syntax", line: 9 }, stop: { blocks: 0, reentry: false, approved: [] },
  }), { verdict: "deny", cause: "syntax" }],
  ["stop blocks a human cause once", input({
    event: "stop", path: null, lock: null, form: { cause: "git-not-repository", line: null }, stop: { blocks: 0, reentry: false, approved: [] },
  }), { verdict: "deny", halt: false, cause: "git-not-repository", notice: /git init/ }],
  ["stop does not block a human cause on reentry", input({
    event: "stop", path: null, lock: null, form: { cause: "git-not-repository", line: null }, stop: { blocks: 1, reentry: true, approved: [] },
  }), { verdict: "none", cause: null, notice: /cannot evaluate/ }],
  ["stop reports approved asks to the human", input({
    event: "stop", path: null, stop: { blocks: 0, reentry: false, approved: [v("core/TDD-DEL-001", 12)] },
  }), { verdict: "none", notice: /you approved[\s\S]*core\/TDD-DEL-001/ }],
  ["stop in shadow mutes non-integrity rules", input({
    event: "stop", path: null, lock: lock({ enforcement: "shadow" }), introduced: [v("core/CC-FN-001", 42)],
    stop: { blocks: 0, reentry: false, approved: [] },
  }), { verdict: "none", violations: 1 }],
  ["advisor warns when a file does not parse", input({
    lock: lock({ enforcement: "advisor" }), form: { cause: "syntax", line: 4 },
  }), { verdict: "none", halt: false, cause: "syntax", full: /parse failure/ }],
  ["advisor does not block an unresolvable import", input({
    lock: lock({ enforcement: "advisor" }), form: { cause: "unresolvable-import", line: 2 },
  }), { verdict: "none", halt: false, cause: "unresolvable-import", full: /did not block/ }],
  ["stop in advisor does not block an unresolvable import", input({
    lock: lock({ enforcement: "advisor" }), event: "stop", form: { cause: "unresolvable-import", line: 2 },
    stop: { blocks: 0, reentry: false, approved: [] },
  }), { verdict: "none", halt: false, cause: "unresolvable-import", full: /did not block/ }],
];

describe("decide: SPEC §11.3 table", () => {
  for (const [name, i, want] of CASES) {
    test(name, () => {
      const d = decide(i);
      const got = {
        verdict: d.verdict, halt: d.halt, cause: d.cause, attempt: d.attempt,
        violations: d.violations.length, warnings: d.warnings.length,
      };
      const { notice, full, ...fields } = want;
      expect(got).toMatchObject(fields);
      if (notice === null) expect(d.notice).toBeNull();
      if (notice instanceof RegExp) expect(d.notice ?? "").toMatch(notice);
      if (full !== undefined) expect(d.full).toMatch(full);
    });
  }
});

describe("decide: invariants over every case", () => {
  test("repository decision boundary: frozen explicit inputs produce stable results without ambient clock or randomness", () => {
    const freeze = (value: unknown): void => {
      if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    };
    const rows = CASES.map(([, i]) => {
      const data = structuredClone(i);
      freeze(data);
      return { data, before: JSON.stringify(data), expected: decide(data) };
    });
    const clock = spyOn(Date, "now").mockReturnValue(1);
    const random = spyOn(Math, "random").mockReturnValue(0.125);
    restoredAfter(clock, random, () => {
      for (const { data, before, expected } of rows) {
        clock.mockReturnValue(1);
        random.mockReturnValue(0.125);
        expect(decide(data)).toEqual(expected);
        clock.mockReturnValue(9_999_999_999);
        random.mockReturnValue(0.875);
        expect(decide(data)).toEqual(expected);
        expect(JSON.stringify(data)).toBe(before);
      }
      expect(clock).not.toHaveBeenCalled();
      expect(random).not.toHaveBeenCalled();
    });
  });

  test("released Stops carry an explicit incomplete result without changing the loop cap", () => {
    const stop = { blocks: 2, reentry: true, approved: [] };
    const capped = decide(input({ event: "stop", introduced: [v("core/CC-FN-001", 42)], stop }));
    expect(capped.verdict).toBe("none");
    expect(capped.stopIncomplete).toEqual({ reason: "limit", cause: null });
    expect(capped.notice).toContain("pregate report --json");
    expect(capped.notice).toContain("pregate check --all");
    const syntax = decide(input({ event: "stop", form: { cause: "syntax", line: 7 }, stop }));
    expect(syntax.stopIncomplete).toEqual({ reason: "limit", cause: "syntax" });
    const human = decide(input({ event: "stop", lock: null, form: { cause: "state-io", line: null },
      stop: { ...stop, blocks: 1 } }));
    expect(human.stopIncomplete).toEqual({ reason: "human-cause", cause: "state-io" });
    for (const introduced of [[], [v("core/CC-ER-002", 1)]]) {
      expect(decide(input({ event: "stop", introduced, stop })).stopIncomplete).toBeUndefined();
    }
    expect(decide(input({ event: "stop", introduced: [v("core/CC-FN-001", 42)],
      lock: lock({ enforcement: "shadow" }), stop })).stopIncomplete).toBeUndefined();
    const many = Array.from({ length: 200 }, (_, k) => v("core/CC-FN-001", k + 1));
    const notice = decide(input({ event: "stop", introduced: many, stop })).notice!;
    expect(notice.length).toBeLessThanOrEqual(4000);
    expect(notice.endsWith("pregate check --all to re-evaluate the current tree.")).toBe(true);
  });

  test("shape of every decision", () => {
    for (const [, i] of CASES) {
      const d = decide(i);
      expect(d.compact.length).toBeLessThanOrEqual(256);
      expect(d.full.length).toBeLessThanOrEqual(4000);
      expect(d.full.startsWith(d.compact)).toBe(true);
      expect(d.compact.includes("\n")).toBe(false);
      if (d.verdict === "none") expect(d.halt).toBe(false);
      if (d.halt || d.verdict === "ask") expect(d.notice).not.toBeNull();
      if (d.verdict !== "none") expect(d.compact).toMatch(/^PREGATE (DENY|ASK|BLOCK)/);
      expect(d.lockHash).toBe(i.lockHash);
      expect(d.shadowed).toBe((d.verdict === "none" && (d.violations.length > 0 || d.cause !== null))
        || (i.lock?.enforcement === "shadow" && i.form === null && i.introduced.some((v) =>
          v.severity !== "warn" && !i.lock!.rules.find((r) => r.id === v.rule)?.integrity)));
      if (d.verdict !== "none" && d.cause === null) expect(d.full).toContain(i.launcher);
    }
  });

  // The lists are records: only their content matters, so they are compared as sets.
  test("the order of the introduced violations does not change the decision", () => {
    const set = (vs: Violation[]): string[] => vs.map((x) => JSON.stringify(x)).sort();
    const norm = (d: Decision) => ({ ...d, violations: set(d.violations), warnings: set(d.warnings) });
    const tie = [v("core/CC-FN-001", 42, "a"), v("core/CC-FN-001", 42, "b"), v("core/EVA-SUP-001", 3)];
    for (const [, i] of [...CASES, ["tie", input({ introduced: tie }), {}] as const]) {
      expect(norm(decide({ ...i, introduced: [...i.introduced].reverse() }))).toEqual(norm(decide(i)));
    }
  });
});

describe("blocking: the enforcement check shares with decide", () => {
  const all = [v("core/CC-ER-002", 1), v("core/CC-FN-001", 2), v("core/EVA-SUP-001", 3), v("core/TDD-DEL-001", 4)];
  const rules = (vs: Violation[]): string[] => vs.map((x) => x.rule);
  const rows: [string, Lock, Cause | null, Cause | null, string[]][] = [
    ["enforce blocks deny and ask, never warn", lock(), null, null, ["core/CC-FN-001", "core/EVA-SUP-001", "core/TDD-DEL-001"]],
    ["enforce keeps an agent cause", lock(), "syntax", "syntax", ["core/CC-FN-001", "core/EVA-SUP-001", "core/TDD-DEL-001"]],
    ["shadow keeps only integrity", lock({ enforcement: "shadow" }), null, null, ["core/EVA-SUP-001"]],
    ["shadow drops a syntax error", lock({ enforcement: "shadow" }), "syntax", null, ["core/EVA-SUP-001"]],
    ["shadow keeps shell writes", lock({ enforcement: "shadow" }), "shell-write", "shell-write", ["core/EVA-SUP-001"]],
    ["shadow keeps unresolvable imports", lock({ enforcement: "shadow" }), "unresolvable-import", "unresolvable-import", ["core/EVA-SUP-001"]],
    ["advisor drops an unresolvable import when nothing is enforced", lock({ enforcement: "advisor" }), "unresolvable-import", null, []],
    ["shadow keeps protected paths", lock({ enforcement: "shadow" }), "protected-path", "protected-path", ["core/EVA-SUP-001"]],
    ["shadow keeps invalid requests", lock({ enforcement: "shadow" }), "request-invalid", "request-invalid", ["core/EVA-SUP-001"]],
    ["shadow keeps human causes", lock({ enforcement: "shadow" }), "version-mismatch", "version-mismatch", ["core/EVA-SUP-001"]],
  ];
  for (const [name, l, cause, wantCause, wantRules] of rows) {
    test(name, () => {
      const b = blocking(l, all, cause);
      expect(b.cause).toBe(wantCause);
      expect(rules(b.violations)).toEqual(wantRules);
    });
  }
});

test("mixed enforcement keeps syntax failures only for the applicable static policy and phase", () => {
  const policy: LockRule = { ...rule("python/PY-LAYER-001", "python/imports/layers@1.0.0", "deny", false),
    impl: { kind: "primitive", primitive: "layer-edge" }, languages: ["python"], enforcement: "enforce",
    params: { paths: ["src/**"], exclude: ["src/ignored/**"], within: ["src/domain/**"] } };
  const contract = lock({ enforcement: "shadow", rules: [policy] });
  for (const phase of ["pre", "stop", "commit", "ci"] as const) {
    expect(blocking(contract, [], "syntax", { rel: "src/domain/price.py", phase }).cause).toBe("syntax");
    for (const rel of ["src/infra/store.py", "src/domain/price.ts", "src/ignored/price.py", "outside/price.py"]) {
      expect(blocking(contract, [], "syntax", { rel, phase }).cause).toBeNull();
    }
    for (const variant of [{ ...policy, enforcement: "shadow" as const }, { ...policy, severity: "warn" as const },
      { ...policy, params: { ...policy.params, exclude: ["src/domain/price.py"] } },
      { ...policy, phases: policy.phases.filter(p => p !== phase) }]) {
      expect(blocking({ ...contract, rules: [variant] }, [], "syntax", { rel: "src/domain/price.py", phase }).cause).toBeNull();
    }
  }
  expect(blocking({ ...contract, ownedByArkgate: [policy.id] }, [], "syntax", { rel: "src/domain/price.py", phase: "pre" }).cause).toBeNull();
  expect(blocking({ ...contract, scope: { include: ["src/**"], exclude: ["src/domain/**"] } }, [], "syntax", { rel: "src/domain/price.py", phase: "pre" }).cause).toBeNull();
  expect(blocking(contract, [], "syntax", { rel: null, phase: "pre" }).cause).toBeNull();
  const form = { cause: "syntax" as const, line: 1 };
  for (const event of ["pre-edit", "stop"] as const) {
    expect(decide(input({ lock: contract, path: "src/domain/price.py", event, form })).verdict).toBe("deny");
    expect(decide(input({ lock: contract, path: "src/infra/store.py", event, form })).verdict).toBe("none");
  }
});

test("advisor mode warns on a file it could not parse, and enforce still denies that file", () => {
  const warned = decide(input({ lock: lock({ enforcement: "advisor" }), form: { cause: "syntax", line: 4 } }));
  expect(warned.verdict).toBe("none");
  expect(warned.halt).toBe(false);
  expect(warned.cause).toBe("syntax");
  expect(warned.shadowed).toBe(true);
  expect(warned.compact).toBe("PREGATE WARN syntax src/billing/invoice.ts:4: parse failure. This file does not parse, so its rules were not evaluated. Fix the syntax error and resend.");
  expect(warned.full.startsWith(warned.compact)).toBe(true);
  expect(warned.full).toContain("This is not a clean result. PREGATE did not check this file for violations.");
  expect(warned.full).not.toContain("no introduced violations");
  const mixed = decide(input({ lock: lock({ enforcement: "advisor" }), form: { cause: "syntax", line: 4 }, introduced: [v("core/CC-FN-001", 42)] }));
  expect(mixed.verdict).toBe("none");
  expect(mixed.compact).toBe(warned.compact);
  expect(mixed.full.startsWith(mixed.compact)).toBe(true);
  expect(mixed.full).toContain("PREGATE ADVISOR core/CC-FN-001");
  expect(mixed.full).not.toContain("no introduced violations");
  const shadow = decide(input({ lock: lock({ enforcement: "shadow" }), form: { cause: "syntax", line: 4 } }));
  expect(shadow.verdict).toBe("none");
  expect(shadow.compact).toBe("");
  expect(shadow.full).toBe("");
  const enforced = decide(input({ form: { cause: "syntax", line: 4 } }));
  expect(enforced.verdict).toBe("deny");
  expect(enforced.cause).toBe("syntax");
  expect(enforced.compact).toContain("PREGATE DENY syntax");
  expect(enforced.full).not.toContain("parse failure");
  const promoted = lock({ enforcement: "advisor", rules: lock().rules.map((r) => r.id === "core/CC-FN-001" ? { ...r, enforcement: "enforce" } : r) });
  const denied = decide(input({ lock: promoted, form: { cause: "syntax", line: 4 } }));
  expect(denied.verdict).toBe("deny");
  expect(denied.cause).toBe("syntax");
  expect(denied.compact).toContain("PREGATE DENY syntax");
  expect(denied.full).not.toContain("parse failure");
});

test("advisor mode warns and does not block an unresolvable import, and an enforced static rule still denies it", () => {
  const warned = decide(input({ lock: lock({ enforcement: "advisor" }), form: { cause: "unresolvable-import", line: 2 } }));
  expect(warned.verdict).toBe("none");
  expect(warned.halt).toBe(false);
  expect(warned.cause).toBe("unresolvable-import");
  expect(warned.shadowed).toBe(true);
  expect(warned.compact).toStartWith("PREGATE WARN unresolvable-import src/billing/invoice.ts:2:");
  expect(warned.full.startsWith(warned.compact)).toBe(true);
  expect(warned.full).toContain("This is not a clean result. PREGATE did not check this file for violations, and it did not block, because no enforced rule applies to this file.");
  expect(warned.full).not.toContain("PREGATE DENY");
  expect(warned.full).not.toContain("no introduced violations");
  const mixed = decide(input({ lock: lock({ enforcement: "advisor" }), form: { cause: "unresolvable-import", line: 2 }, introduced: [v("core/CC-FN-001", 42)] }));
  expect(mixed.verdict).toBe("none");
  expect(mixed.compact).toBe(warned.compact);
  expect(mixed.full).toContain("PREGATE ADVISOR core/CC-FN-001");
  const stopped = decide(input({
    lock: lock({ enforcement: "advisor" }), event: "stop", form: { cause: "unresolvable-import", line: 2 },
    stop: { blocks: 0, reentry: false, approved: [] },
  }));
  expect(stopped.verdict).toBe("none");
  expect(stopped.halt).toBe(false);
  expect(stopped.cause).toBe("unresolvable-import");
  expect(stopped.compact).toBe(warned.compact);
  const shadow = decide(input({ lock: lock({ enforcement: "shadow" }), form: { cause: "unresolvable-import", line: 2 } }));
  expect(shadow.verdict).toBe("deny");
  expect(shadow.cause).toBe("unresolvable-import");
  expect(shadow.compact).toContain("PREGATE DENY unresolvable-import");
  const enforced = decide(input({ form: { cause: "unresolvable-import", line: 2 } }));
  expect(enforced.verdict).toBe("deny");
  expect(enforced.cause).toBe("unresolvable-import");
  const promoted = lock({ enforcement: "advisor", rules: lock().rules.map((r) => r.id === "core/CC-FN-001" ? { ...r, enforcement: "enforce" } : r) });
  const denied = decide(input({ lock: promoted, event: "stop", form: { cause: "unresolvable-import", line: 2 }, stop: { blocks: 0, reentry: false, approved: [] } }));
  expect(denied.verdict).toBe("deny");
  expect(denied.cause).toBe("unresolvable-import");
  expect(denied.compact).toContain("PREGATE DENY unresolvable-import");
  expect(denied.full).not.toContain("did not block");
  const advisor = lock({ enforcement: "advisor" });
  expect(blocking(advisor, [], "unresolvable-import", { rel: FILE, phase: "stop" }).cause).toBeNull();
  expect(blocking(advisor, [], "unresolvable-import").cause).toBeNull();
  expect(blocking(promoted, [], "unresolvable-import", { rel: FILE, phase: "pre" }).cause).toBe("unresolvable-import");
  expect(blocking(promoted, [], "unresolvable-import", { rel: FILE, phase: "stop" }).cause).toBe("unresolvable-import");
  expect(blocking(promoted, [], "unresolvable-import", { rel: "notes.md", phase: "pre" }).cause).toBeNull();
  expect(blocking({ ...promoted, ownedByArkgate: ["core/CC-FN-001"] }, [], "unresolvable-import", { rel: FILE, phase: "pre" }).cause).toBeNull();
  const integrity = lock({ enforcement: "advisor", rules: advisor.rules.map((r) => r.id === "core/EVA-SUP-001" ? { ...r, enforcement: "enforce" } : r) });
  expect(blocking(integrity, [], "unresolvable-import", { rel: FILE, phase: "stop" }).cause).toBe("unresolvable-import");
  const preOnly = lock({ enforcement: "advisor", rules: advisor.rules.map((r) => r.id === "core/CC-FN-001" ? { ...r, enforcement: "enforce", phases: ["pre"] } : r) });
  expect(blocking(preOnly, [], "unresolvable-import", { rel: FILE, phase: "stop" }).cause).toBeNull();
  expect(blocking(preOnly, [], "unresolvable-import", { rel: FILE, phase: "pre" }).cause).toBe("unresolvable-import");
  const fitness: LockRule = { ...rule("core/CORE-INV-001", "core/fitness/boundaries@1.0.0", "deny", false),
    impl: { kind: "primitive", primitive: "fitness", requirement: "A reviewed assertion supplies evidence." }, enforcement: "enforce" };
  expect(blocking(lock({ enforcement: "advisor", rules: [fitness] }), [], "unresolvable-import", { rel: FILE, phase: "stop" }).cause).toBeNull();
  expect(blocking(lock({ enforcement: "shadow" }), [], "unresolvable-import", { rel: FILE, phase: "stop" }).cause).toBe("unresolvable-import");
  expect(blocking(lock(), [], "unresolvable-import", { rel: FILE, phase: "stop" }).cause).toBe("unresolvable-import");
});

test("an enforcing project requirement is not a source syntax policy", () => {
  const policy: LockRule = { ...rule("core/CORE-INV-001", "core/fitness/boundaries@1.0.0", "deny", false),
    impl: { kind: "primitive", primitive: "fitness", requirement: "A reviewed assertion supplies evidence." }, enforcement: "enforce" };
  expect(blocking(lock({ enforcement: "shadow", rules: [policy] }), [], "syntax", { rel: FILE, phase: "pre" }).cause).toBeNull();
});

test("advisor mode never blocks ordinary or core rules, emits PREGATE ADVISOR with full rule guidance, and enforces rules promoted to enforce", () => {
  const advisorLock = lock({ enforcement: "advisor" });
  const advised = decide(input({ lock: advisorLock, introduced: [v("core/EVA-SUP-001", 9), v("core/CC-FN-001", 42), v("core/TDD-DEL-001", 7)] }));
  expect(advised.verdict).toBe("none");
  expect(advised.shadowed).toBe(false);
  expect(advised.violations).toEqual([]);
  expect(advised.warnings.map((x) => x.rule)).toEqual(["core/EVA-SUP-001", "core/CC-FN-001", "core/TDD-DEL-001"]);
  expect(advised.compact).toStartWith("PREGATE ADVISOR core/EVA-SUP-001");
  expect(advised.full).toContain("Why:");
  expect(advised.full).toContain("Fix:");
  expect(advised.full).toContain("Advisory finding: this edit was not blocked.");
  const stop = decide(input({ lock: advisorLock, event: "stop", introduced: [v("core/EVA-SUP-001", 9), v("core/CC-FN-001", 42)], stop: { blocks: 0, reentry: false, approved: [] } }));
  expect(stop.verdict).toBe("none");
  const promotedLock = lock({ enforcement: "advisor", rules: advisorLock.rules.map((r) => r.id === "core/EVA-SUP-001" ? { ...r, enforcement: "enforce" } : r) });
  const promoted = decide(input({ lock: promotedLock, introduced: [v("core/EVA-SUP-001", 9), v("core/CC-FN-001", 42)] }));
  expect(promoted.verdict).toBe("deny");
  expect(promoted.violations.map((x) => x.rule)).toEqual(["core/EVA-SUP-001"]);
  expect(promoted.warnings.map((x) => x.rule)).toEqual(["core/CC-FN-001"]);
});

describe("merge: one decision per multi-file call", () => {
  const clean = decide(input({ introduced: [] }));
  const ask = decide(input({ introduced: [v("core/TDD-DEL-001", 3)] }));
  const deny = decide(input({ introduced: [v("core/CC-FN-001", 4)] }));
  const halted = decide(input({ form: { cause: "lock-stale", line: null } }));

  test("halt wins, then the first deny, then ask", () => {
    expect(merge([clean, ask, deny, halted]).cause).toBe("lock-stale");
    expect(merge([clean, ask, deny]).verdict).toBe("deny");
    expect(merge([clean, ask]).verdict).toBe("ask");
    expect(merge([clean, clean])).toEqual(clean);
  });

  test("the first deny supplies the primary reason and all other blockers are listed", () => {
    const second = decide(input({ introduced: [v("core/CC-FN-002", 10)], path: "src/other.ts" }));
    const result = merge([ask, clean, deny, second]);
    expect(result.compact).toBe(deny.compact);
    expect(result.full).toStartWith(deny.full);
    expect(result.full).toContain(ask.compact);
    expect(result.full).toContain(second.compact);
    expect(result.notice).toBeNull();
  });

  test("single-file decisions remain identical, including notices and warnings", () => {
    for (const d of [clean, ask, deny, halted, decide(input({ introduced: [v("core/CC-ER-002", 1)] }))]) {
      expect(merge([d])).toEqual(d);
    }
  });

  test("other blocked files still fit when the chosen file uses the whole text budget", () => {
    const long = { ...deny, full: deny.compact + "\n" + "details ".repeat(600) };
    const result = merge([long, ask, halted]);
    expect(result.full.length).toBeLessThanOrEqual(4000);
    // The halted file wins, so also exercise a long non-halted primary reason.
    const clipped = merge([long, ask]);
    expect(clipped.full).toStartWith(deny.compact);
    expect(clipped.full).toContain(ask.compact);
    expect(clipped.full.length).toBeLessThanOrEqual(4000);
  });

  test("an empty edit call is a contract violation", () => expect(() => merge([])).toThrow());

  test("large calls keep complete compact lines and report omitted files within TEXT_MAX", () => {
    const ds = Array.from({ length: 100 }, (_, k) => decide(input({ form: { cause: "syntax", line: 1 }, path: `src/${k}-${"long-name-".repeat(20)}.ts` })));
    const d = merge(ds);
    expect(d.full.length).toBeLessThanOrEqual(4000);
    expect(d.full).toMatch(/\n\d+ more files; run pregate check\.$/);
    expect(d.full).toContain(ds[1]!.compact);
  });
});

type Spy = { mockRestore(): void };

function restoredAfter(clock: Spy, random: Spy, check: () => void): void {
  try { check(); } finally { clock.mockRestore(); random.mockRestore(); }
}
