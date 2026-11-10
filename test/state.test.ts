import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { canonical } from "../src/disk.ts";
import { WINDOWS } from "../src/platform.ts";
import { slash } from "../src/paths.ts";
import { catFileBatch, git, indexFiles } from "../src/git.ts";
import {
  H, beforeText, beforeTexts, ensureSnapshot, eventFiles, eventName, firstContact, history, key, record, roots, sha256, snapshot, sourcesOk, stateDir, stopBlocks, turnDenials,
} from "../src/state.ts";
import type { CallEvent, Snapshot } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

function withCleanup<T>(work: () => T, cleanup: () => void): T {
  try { return work(); } finally { cleanup(); }
}

async function withCleanupAsync<T>(work: () => Promise<T>, cleanup: () => void | Promise<void>): Promise<T> {
  try { return await work(); } finally { await cleanup(); }
}

const base = canonical(mkdtempSync(`${tmpdir()}/pregate-state-`));
// Children get `env` explicitly: Bun.spawn otherwise passes the environment the test started with.
process.env.XDG_STATE_HOME = `${base}/state`;
afterAll(() => removeTree(base));

// Setup only: the code under test runs git through src/git.ts.
function sh(cwd: string, ...args: string[]): string {
  const r = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd, stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
  return r.stdout.toString();
}

function put(path: string, text: string): void {
  mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  writeFileSync(path, text);
}

// A monorepo whose PREGATE root is the subdirectory pkg/, with every kind of dirty file.
const repo = `${base}/repo`;
const root = `${repo}/pkg`;
put(`${root}/.pregate/preset.json`, '{"name":"p"}');
put(`${root}/.pregate/rules/check.json`, '{"id":"c"}');
put(`${root}/.pregate/rules/fixtures/pass/a/fixture.json`, "{}");
put(`${root}/.pregate/rules/notes.md`, "notes");
put(`${root}/src/clean.ts`, "export const clean = 1;\n");
put(`${root}/src/edited.ts`, "export const v = 1;\n");
put(`${root}/src/deleted.ts`, "export const gone = 1;\n");
put(`${root}/src/moved.ts`, "export const moved = 1;\n");
put(`${root}/docs/readme.md`, "docs\n");
put(`${root}/src/in head.ts`, "export const h = 1;\n");
put(`${repo}/outside.ts`, "export const o = 1;\n");
sh(repo, "init", "-q");
sh(repo, "add", ".");
sh(repo, "commit", "-qm", "init");
const head = sh(repo, "rev-parse", "HEAD").trim();
put(`${root}/src/edited.ts`, "export const v = 2;\n");
put(`${root}/src/untracked.ts`, "export const u = 1;\n");
put(`${root}/src/with space.ts`, "export const s = 1;\n");
put(`${root}/docs/new.md`, "new\n");
put(`${repo}/outside.ts`, "export const o = 2;\n");
unlinkSync(`${root}/src/deleted.ts`);
sh(repo, "mv", "pkg/src/moved.ts", "pkg/src/renamed.ts");

const empty = `${base}/empty`;
put(`${empty}/.pregate/preset.json`, "{}");
sh(empty, "init", "-q");

const event = (over: Partial<CallEvent>): CallEvent => ({
  at: 1, callId: "c", turn: "t1", agentId: null, kind: "pre-edit", path: "src/a.ts", verdict: "deny",
  halted: false, form: null, shadowed: false, violations: [], afterSha: null, astHash: null, ...over,
});

describe("names and hashes", () => {
  test("H is the first 12 hex characters of sha256", () => {
    expect(H("x")).toBe(sha256("x").slice(0, 12));
    expect(H("x")).toMatch(/^[0-9a-f]{12}$/);
  });

  test("the filter keys are in the event name", () => {
    expect(eventName(event({ callId: "toolu_1", form: "syntax" })))
      .toBe(`${H("t1")}~-~${H("src/a.ts")}~deny~1~${H("toolu_1")}.json`);
    expect(eventName(event({ agentId: "a1", verdict: "none" })))
      .toBe(`${H("t1")}~${H("a1")}~${H("src/a.ts")}~none~0~${H("c")}.json`);
    expect(eventName(event({ kind: "pre-command", path: null, verdict: "ask" })))
      .toBe(`${H("t1")}~-~-~ask~0~${H("c")}.json`);
    expect(eventName(event({ path: "src/New.ts" }))).toBe(eventName(event({ path: "src/new.ts" })));   // A26
    expect(eventName(event({ path: "C:\\repo\\SRC\\a.ts" }))).toBe(eventName(event({ path: "c:/repo/src/a.ts" })));
    expect(eventName(event({ path: "\\\\?\\C:\\repo\\src\\a.ts" }))).toBe(eventName(event({ path: "c:/repo/src/a.ts" })));
    expect(eventName(event({ kind: "stop", path: null, at: 1234 })))
      .toBe(`${H("t1")}~-~stop~deny~0~${H("1234")}.json`);
  });

  test("XDG_STATE_HOME is respected, else the platform's state directory", () => {
    expect(stateDir()).toBe(`${base}/state/pregate`);
    process.env.XDG_STATE_HOME = "";
    withCleanup(() => {
      expect(stateDir()).toBe(WINDOWS ? `${slash(process.env.LOCALAPPDATA!)}/State/pregate` : `${process.env.HOME}/.local/state/pregate`);
    }, () => {
      process.env.XDG_STATE_HOME = `${base}/state`;
    });
  });

  test("a session id that could leave sessions/ throws", () => {
    for (const sid of ["..", "../x", "a/b", ".hidden", ""]) expect(() => history(sid, "-", "x")).toThrow();
  });

  test("native session ids are isolated by harness", () => {
    const claude = key({ harness: "claude-code", id: "same-id" });
    const codex = key({ harness: "codex", id: "same-id" });
    expect(record(claude, event({}), null)).toBeUndefined();
    expect(history(claude, "-", H("src/a.ts"))).toHaveLength(1);
    expect(history(codex, "-", H("src/a.ts"))).toEqual([]);
    expect(firstContact(codex)).toBeNull();
  });
});

test("batched baselines preserve committed/dirty/deleted/absent texts and cache their independent revision", () => {
  const snap = ensureSnapshot("batch-baseline", root, (rel) => rel.startsWith("src/"));
  if (typeof snap === "string") throw new Error(snap);
  const names = ["src/in head.ts", "src/edited.ts", "src/deleted.ts", "missing-config.json"];
  const expected = { "src/in head.ts": "export const h = 1;\n", "src/edited.ts": "export const v = 2;\n", "src/deleted.ts": null, "missing-config.json": null };
  expect(beforeTexts("batch-baseline", snap, names)).toEqual(expected);
  const saved = process.env.PATH;
  process.env.PATH = "";
  withCleanup(() => expect(beforeTexts("batch-baseline", snap, [...names, ...names])).toEqual(expected),
    () => { if (saved === undefined) delete process.env.PATH; else process.env.PATH = saved; });
});

describe("events", () => {
  const sid = "s-events";
  const a = H("src/a.ts");
  const after = "export const a = 2;\n";
  const events: [CallEvent, string | null][] = [
    [event({ at: 30, callId: "c3", verdict: "none" }), null],
    [event({ at: 10, callId: "c1", afterSha: sha256(after) }), after],
    [event({ at: 20, callId: "c2", form: "syntax" }), null],
    [event({ at: 40, callId: "c4", agentId: "sub" }), null],
    [event({ at: 50, callId: "c5", path: "src/b.ts" }), null],
    [event({ at: 60, callId: "c6", turn: "t2" }), null],
    [event({ at: 70, kind: "stop", path: null }), null],
    [event({ at: 80, kind: "stop", path: null }), null],
    [event({ at: 90, kind: "stop", path: null, verdict: "none" }), null],
  ];
  for (const [e, text] of events) expect(record(sid, e, text)).toBeUndefined();

  test("history is the (agent, file) events ordered by at", () => {
    expect(history(sid, "-", a).map((e) => e.callId)).toEqual(["c1", "c2", "c3", "c6"]);
    expect(history(sid, H("sub"), a).map((e) => e.callId)).toEqual(["c4"]);
    expect(history(sid, "-", H("src/none.ts"))).toEqual([]);
    expect(history("s-never", "-", a)).toEqual([]);
  });

  test("turn denials count the agent's denies in the turn, form denies included, Stop blocks not (O17)", () => {
    expect(turnDenials(sid, H("t1"), "-")).toBe(3);   // c1, c2, c5
    expect(turnDenials(sid, H("t1"), H("sub"))).toBe(1);
    expect(turnDenials(sid, H("t2"), "-")).toBe(1);
  });

  test("stop blocks count the turn's blocked stops", () => {
    expect(stopBlocks(sid, H("t1"))).toBe(2);
    expect(stopBlocks(sid, H("t2"))).toBe(0);
  });

  test("after is stored as a blob named by its sha256", () => {
    expect(readFileSync(`${stateDir()}/sessions/${sid}/blobs/${sha256(after)}`, "utf8")).toBe(after);
  });

  test("an afterSha that does not match after is a bug", () => {
    expect(() => record(sid, event({ afterSha: "0".repeat(64) }), after)).toThrow();
    expect(() => record(sid, event({ afterSha: sha256(after) }), null)).toThrow();
  });

  test("a state directory that cannot be written is state-io", () => {
    put(`${stateDir()}/sessions/s-file`, "not a directory");
    expect(record("s-file", event({}), null)).toBe("state-io");
  });

  test("20 concurrent processes record without losing an event", async () => {
    const script = `${base}/record.ts`;
    writeFileSync(script, [
      `import { record, sha256 } from ${JSON.stringify(`${import.meta.dir}/../src/state.ts`)};`,
      "const i = Number(process.argv[2]);",
      'const e = { at: 1000 + i, callId: `call-${i}`, turn: "t", agentId: null, kind: "pre-edit", path: "src/a.ts",',
      '  verdict: "deny", halted: false, form: null, shadowed: false, violations: [], afterSha: sha256("same after"), astHash: null };',
      'const result = record("s-conc", e, "same after"); if (result !== undefined) console.error("Concurrent record failed:", i, result); process.exit(result === undefined ? 0 : 3);',
    ].join("\n"));
    const runs = Array.from({ length: 20 }, (_, i) => Bun.spawn([process.execPath, script, String(i)], { env: { ...process.env }, stderr: "inherit" }).exited);
    expect(await Promise.all(runs)).toEqual(Array(20).fill(0));
    expect(history("s-conc", "-", a).map((e) => e.at)).toEqual(Array.from({ length: 20 }, (_, i) => 1000 + i));
    expect(turnDenials("s-conc", H("t"), "-")).toBe(20);
    expect(eventFiles(`${stateDir()}/sessions/s-conc`)).toHaveLength(20);
    expect(readdirSync(`${stateDir()}/sessions/s-conc/events/1970-01-01`)).toHaveLength(20);   // no temporary file left
    expect(readFileSync(`${stateDir()}/sessions/s-conc/blobs/${sha256("same after")}`, "utf8")).toBe("same after");
    expect(readdirSync(`${stateDir()}/sessions/s-conc/blobs`)).toEqual([sha256("same after")]);
  });

  test("date-scoped reads skip old partitions and preserve flat history and retry identity", () => {
    const id = "s-dated", folder = `${stateDir()}/sessions/${id}`;
    const old = event({ at: Date.parse("2026-01-01T23:59:00Z"), callId: "retry" });
    const next = { ...old, at: Date.parse("2026-01-02T00:01:00Z") };
    record(id, old, null); record(id, next, null);
    const legacy = event({ at: Date.parse("2025-12-31T12:00:00Z"), callId: "legacy" });
    put(`${folder}/events/${eventName(legacy)}`, JSON.stringify(legacy));
    const selected = eventFiles(folder, Date.parse("2026-01-02T00:00:00Z"));
    expect(selected).toHaveLength(2);
    expect(selected.some((file) => file.includes("2026-01-01"))).toBe(false);
    expect(history(id, "-", a).map((e) => e.callId)).toEqual(["legacy", "retry"]);
    expect(turnDenials(id, H("t1"), "-")).toBe(2);
    put(`${folder}/events/2026-01-01/unreadable.json`, "not JSON");
    expect(eventFiles(folder, Date.parse("2026-01-02T00:00:00Z"))).toEqual(selected);
  });
});

describe("snapshots", () => {
  test("concurrent first contacts agree on one snapshot, created by renaming its directory", async () => {
    const script = `${base}/snapshot.ts`;
    writeFileSync(script, [
      `import { ensureSnapshot } from ${JSON.stringify(`${import.meta.dir}/../src/state.ts`)};`,
      'console.log(JSON.stringify(ensureSnapshot("s-race", process.argv[2], (rel) => rel.startsWith("src/"))));',
    ].join("\n"));
    const children = Array.from({ length: 12 }, () => Bun.spawn([process.execPath, script, root], {
      env: { ...process.env }, stdout: "pipe", stderr: "pipe", timeout: 4000,
    }));
    const outputs = await withCleanupAsync(async () => {
      const results = await Promise.all(children.map(async (p) => {
        const [code, stdout, stderr] = await Promise.all([p.exited, new Response(p.stdout).text(), new Response(p.stderr).text()]);
        return { code, signal: p.signalCode, stdout, stderr };
      }));
      // Keep actual child failures and differing snapshots in the CI failure output.
      expect(results.map(({ code, signal, stderr }) => ({ code, signal, stderr }))).toEqual(Array(12).fill({ code: 0, signal: null, stderr: "" }));
      const outputs = results.map((r) => r.stdout);
      expect(outputs).toEqual(Array(12).fill(outputs[0]));
      return outputs;
    }, () => {
      for (const p of children) if (p.exitCode === null) p.kill();
    });
    const snap = JSON.parse(outputs[0]!) as Snapshot;
    expect(snap).toEqual(expect.objectContaining({
      root, head, start: true, at: expect.any(Number),
      dirty: {
        "src/edited.ts": sha256("export const v = 2;\n"),
        "src/untracked.ts": sha256("export const u = 1;\n"),
        "src/with space.ts": sha256("export const s = 1;\n"),
        "src/deleted.ts": null,
        "src/renamed.ts": sha256("export const moved = 1;\n"),
        "src/moved.ts": null,
      },
    }));
    expect(snapshot("s-race", root)).toEqual(snap);
    expect(readdirSync(`${stateDir()}/sessions/s-race`).sort()).toEqual([".leases", "blobs", H(root)].sort());
    expect(readdirSync(`${stateDir()}/sessions/s-race/.leases`)).toEqual([]);
  });

  test("a Pre's first contact takes HEAD as the base of every file", () => {
    expect(ensureSnapshot("s-pre", root, null)).toEqual(expect.objectContaining({ root, head, start: false, dirty: {}, at: expect.any(Number) }));
  });

  test("a repository without commits has no head", () => {
    expect(ensureSnapshot("s-pre", empty, null)).toEqual(expect.objectContaining({ root: empty, head: null, start: false, dirty: {}, at: expect.any(Number) }));
  });

  test("outside a repository the first contact is denied and no snapshot is stored", () => {
    mkdirSync(`${base}/plain/.pregate`, { recursive: true });
    expect(ensureSnapshot("s-pre", `${base}/plain`, null)).toBe("git-not-repository");
    expect(snapshot("s-pre", `${base}/plain`)).toBeNull();
  });

  test("roots lists every root the session touched", () => {
    expect(roots("s-pre")).toEqual([root, empty].sort());
    expect(roots("s-never")).toEqual([]);
  });

  test("a root directory without its snapshot is missing, never a fresh first contact", () => {
    ensureSnapshot("s-gone", root, null);
    unlinkSync(`${stateDir()}/sessions/s-gone/${H(root)}/snapshot.json`);
    expect(snapshot("s-gone", root)).toBe("missing");
    expect(ensureSnapshot("s-gone", root, null)).toBe("snapshot-missing");
  });

  test("a deleted session starts over with HEAD as the base", () => {
    ensureSnapshot("s-wiped", root, () => true);
    rmSync(`${stateDir()}/sessions/s-wiped`, { recursive: true });
    expect(ensureSnapshot("s-wiped", root, null)).toEqual(expect.objectContaining({ root, head, start: false, dirty: {}, at: expect.any(Number) }));
  });

  test("first contact is the earliest saved snapshot timestamp, including Pre", async () => {
    const sid = "s-contact";
    expect(firstContact(sid)).toBeNull();
    ensureSnapshot(sid, root, null);
    const at = firstContact(sid)!;
    await Bun.sleep(10);
    ensureSnapshot(sid, empty, () => true);
    expect(firstContact(sid)).toBe(at);
    const path = `${stateDir()}/sessions/${sid}/${H(root)}/snapshot.json`;
    const text = readFileSync(path, "utf8");
    writeFileSync(path, text);
    expect(firstContact(sid)).toBe(at);
    expect(firstContact("s-pre")).not.toBeNull();
  });
});

describe("before text", () => {
  const snap = () => snapshot("s-race", root) as Snapshot;   // read once the race test created it

  test("a file dirty at session start comes from its blob", () => {
    expect(beforeText("s-race", snap(), "src/edited.ts")).toBe("export const v = 2;\n");
    expect(beforeText("s-race", snap(), "src/renamed.ts")).toBe("export const moved = 1;\n");
  });

  test("a file absent at session start has no before", () => {
    expect(beforeText("s-race", snap(), "src/deleted.ts")).toBeNull();
    expect(beforeText("s-race", snap(), "src/brand-new.ts")).toBeNull();
  });

  test("any other file comes from HEAD once, then from head/", () => {
    expect(beforeText("s-race", snap(), "src/clean.ts")).toBe("export const clean = 1;\n");
    const cache = `${stateDir()}/sessions/s-race/${H(root)}/head/${H("src/clean.ts")}.json`;
    expect(JSON.parse(readFileSync(cache, "utf8"))).toEqual({ text: "export const clean = 1;\n" });
    expect(beforeText("s-race", snap(), "src/clean.ts")).toBe("export const clean = 1;\n");
    expect(beforeText("s-race", snap(), "src/brand-new.ts")).toBeNull();
  });

  test("a Pre-created snapshot reads HEAD even for files dirty now", () => {
    const pre = snapshot("s-pre", root) as Snapshot;
    expect(beforeText("s-pre", pre, "src/edited.ts")).toBe("export const v = 1;\n");
    expect(beforeText("s-pre", pre, "src/untracked.ts")).toBeNull();
  });

  test("a lost blob is a missing snapshot", () => {
    rmSync(`${stateDir()}/sessions/s-race/blobs/${sha256("export const u = 1;\n")}`);
    expect(beforeText("s-race", snap(), "src/untracked.ts")).toBe("snapshot-missing");
  });

  test("a root without commits has no before", () => {
    expect(beforeText("s-pre", snapshot("s-pre", empty) as Snapshot, "src/a.ts")).toBeNull();
  });
});

describe("sources verification", () => {
  test("cached per lockHash next to the snapshot, and only there", () => {
    let calls = 0;
    const verify = () => {
      calls++;
      return true;
    };
    expect(sourcesOk("s-src", root, "lock-1", verify)).toBe(true);
    expect(sourcesOk("s-src", root, "lock-1", verify)).toBe(true);
    expect(calls).toBe(2);   // no <rootHash>/ yet: nothing is cached and nothing is created
    expect(existsSync(`${stateDir()}/sessions/s-src/${H(root)}`)).toBe(false);
    ensureSnapshot("s-src", root, null);
    expect(sourcesOk("s-src", root, "lock-1", verify)).toBe(true);
    expect(sourcesOk("s-src", root, "lock-1", () => false)).toBe(true);
    expect(calls).toBe(3);
    expect(sourcesOk("s-src", root, "lock-2", () => false)).toBe(false);
    expect(sourcesOk("s-src", root, "lock-2", verify)).toBe(false);
    expect(calls).toBe(3);
  });
});

describe("git", () => {
  test("git returns stdout, or null when it fails", () => {
    expect(git(root, ["rev-parse", "--show-prefix"])).toBe("pkg/\n");
    expect(git(`${base}/plain`, ["rev-parse", "HEAD"])).toBeNull();
    expect(git(`${base}/no-such-dir`, ["status"])).toBeNull();
  });

  test("one cat-file batch answers every object, in order", () => {
    expect(catFileBatch(root, [`${head}:./src/clean.ts`, `${head}:./src/nope.ts`, `${head}:./src`, `${head}:./src/edited.ts`, `${head}:./src/in head.ts`]))
      .toEqual(["export const clean = 1;\n", null, null, "export const v = 1;\n", "export const h = 1;\n"]);
    expect(catFileBatch(root, [])).toEqual([]);
    expect(catFileBatch(`${base}/plain`, ["HEAD:x"])).toBeNull();
    expect(catFileBatch(root, ["HEAD:a\nb"])).toBeNull();
  });

  test("indexFiles reads the staged JSON sources, as readTree reads the disk", () => {
    writeFileSync(`${root}/.pregate/preset.json`, '{"name":"staged"}');
    sh(root, "add", ".pregate/preset.json");
    writeFileSync(`${root}/.pregate/preset.json`, '{"name":"unstaged"}');
    expect(indexFiles(root, ".pregate")).toEqual({ "preset.json": '{"name":"staged"}', "rules/check.json": '{"id":"c"}' });
    expect(indexFiles(root, ".pregate/rules/")).toEqual({ "check.json": '{"id":"c"}' });
    expect(indexFiles(root, "./.pregate/rules")).toEqual({ "check.json": '{"id":"c"}' });
    expect(indexFiles(root, `${root}/.pregate/rules`)).toEqual({ "check.json": '{"id":"c"}' });
    expect(indexFiles(root, "nothing-here")).toEqual({});
  });

  test("Git reads the caller's alternate index without changing the normal index", () => {
    const alternate = `${base}/alternate-index`;
    const index = sh(repo, "rev-parse", "--git-path", "index").trim();
    copyFileSync(index.startsWith("/") || /^[A-Z]:/i.test(index) ? index : `${repo}/${index}`, alternate);
    const previous = process.env.GIT_INDEX_FILE;
    process.env.GIT_INDEX_FILE = alternate;
    withCleanup(() => {
      put(`${root}/.pregate/alternate.json`, '{"id":"alternate"}');
      const staged = Bun.spawnSync(["git", "add", ".pregate/alternate.json"], { cwd: root, env: { ...process.env }, stdout: "pipe", stderr: "pipe", timeout: 5000 });
      expect(staged.exitCode, staged.stderr.toString()).toBe(0);
      expect(indexFiles(root, ".pregate")["alternate.json"]).toBe('{"id":"alternate"}');
    }, () => {
      if (previous === undefined) delete process.env.GIT_INDEX_FILE;
      else process.env.GIT_INDEX_FILE = previous;
    });
    expect(indexFiles(root, ".pregate")["alternate.json"]).toBeUndefined();
  });

  test("a staged symlink among the sources throws", () => {
    symlinkSync("check.json", `${root}/.pregate/rules/link.json`);
    sh(root, "add", ".pregate/rules/link.json");
    expect(() => indexFiles(root, ".pregate/rules")).toThrow();
  });

  test("indexFiles outside a repository throws", () => expect(() => indexFiles(`${base}/plain`, ".")).toThrow());
});
