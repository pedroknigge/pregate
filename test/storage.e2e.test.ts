import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { compileBinary, hostTarget } from "../scripts/build.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { canonical } from "../src/disk.ts";
import { eventName, H, sha256 } from "../src/state.ts";
import type { CallEvent } from "../src/types.ts";

setDefaultTimeout(60_000);
const area = realpathSync(mkdtempSync(join(tmpdir(), "pregate-storage-")));
const binary = join(area, "engine/version", ENGINE_FILE);
const template = JSON.parse(readFileSync("test/fixtures/report-events.json", "utf8"))[1].event as CallEvent;
beforeAll(() => compileBinary(hostTarget(), binary, true));
afterAll(() => rmSync(area, { recursive: true, force: true }));

function put(path: string, text: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

function project() {
  const root = canonical(join(area, randomUUID()));
  mkdirSync(root);
  const env = { ...process.env, CI: "1", HOME: join(root, "home"), XDG_DATA_HOME: join(root, "data"), XDG_STATE_HOME: join(root, "state"),
    CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok") };
  const run = (args: string[], input?: object, ci = "1") => {
    const out = Bun.spawnSync([binary, ...args], { cwd: root, env: { ...env, CI: ci },
      stdin: input === undefined ? "ignore" : new Blob([JSON.stringify(input)]), stdout: "pipe", stderr: "pipe" });
    return { code: out.exitCode, text: out.stdout.toString(), error: out.stderr.toString() };
  };
  expect(run(["init", "--yes", "--preset", "legacy-safe"]).code).toBe(0);
  const folder = join(root, "state/pregate/sessions", WINDOWS ? "claude-code~shared" : "claude-code:shared");
  const baseline = "export const baseline = 1;\n", liveHash = sha256(baseline);
  put(join(root, "src/a.ts"), baseline);
  const snapshot = join(folder, H(root), "snapshot.json");
  put(snapshot, JSON.stringify({ root, head: null, start: true, at: Date.now(), dirty: { "src/a.ts": liveHash } }));
  put(join(folder, "blobs", liveHash), baseline);
  const record = (content: string, age: number, eventRoot = root, legacy = false) => {
    const hash = sha256(content), at = Date.now() - age * 86400000;
    const event = { ...template, callId: randomUUID(), root: eventRoot, path: join(eventRoot, "src/a.ts"), afterSha: hash, at };
    const file = join(folder, "events", ...(legacy ? [] : [new Date(at).toISOString().slice(0, 10)]), eventName(event));
    put(file, JSON.stringify(event)); put(join(folder, "blobs", hash), content);
    return { hash, event, file };
  };
  const draft = () => {
    const out = run(["storage", "prune", "--older-than", "30", "--preview"]);
    expect(out.code).toBe(0);
    return out.text.match(/Digest: ([a-f0-9]{64})/)![1]!;
  };
  return { root, folder, snapshot, run, record, draft, env, baseline, liveHash };
}

async function abandoned(dir: string, kind: "writer" | "cleanup") {
  const source = 'import { withStateWrite, lockPrune } from ' + JSON.stringify(join(import.meta.dir, "../src/state-lease.ts"))
    + '; import { writeSync } from "node:fs"; const dir = ' + JSON.stringify(dir)
    + '; const hold = () => { writeSync(1, "ready"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000); }; '
    + (kind === "writer" ? 'withStateWrite(dir, hold);' : 'const release = lockPrune(dir); hold(); release();');
  return killedHolder(Bun.spawn([process.execPath, "-e", source], { stdout: "pipe", stderr: "pipe", timeout: 10000 }));
}

async function killedHolder(child: Bun.Subprocess<"ignore", "pipe", "pipe">) {
  try {
    const ready = await child.stdout.getReader().read();
    expect(new TextDecoder().decode(ready.value)).toBe("ready");
    child.kill(9); await child.exited;
    return child.pid;
  } finally { if (child.exitCode === null) { child.kill(9); await child.exited; } }
}

function recoveryDraft(p: ReturnType<typeof project>) {
  const out = p.run(["storage", "recover", "--preview"]);
  expect(out.code).toBe(0);
  return out.text.match(/Digest: ([a-f0-9]{64})/)![1]!;
}

test("reviewed recovery removes a killed writer's lease without source or counter changes", async () => {
  const p = project(), old = p.record("old source", 60), pid = await abandoned(p.folder, "writer");
  const snapshot = readFileSync(p.snapshot, "utf8"), event = readFileSync(old.file, "utf8");
  const inspected = JSON.parse(p.run(["storage", "inspect", "--json"]).text);
  expect(inspected.sessions[0].markers).toMatchObject([{ kind: "writer", pid, state: "dead" }]);
  const id = recoveryDraft(p);
  const preview = p.run(["storage", "show", id]).text;
  expect(preview).toContain("PID " + pid);
  expect(preview).toContain("Claude Code, Codex, Grok or agy");
  expect(preview).toContain(`pregate storage apply ${id} --yes`);
  expect(preview).toContain("Cursor needs a separate terminal");
  expect(p.run(["storage", "apply", id]).code).toBe(1);
  expect(JSON.parse(p.run(["storage", "inspect", "--json"]).text).sessions[0].writers).toBe(1);
  expect(p.run(["storage", "apply", id, "--yes"]).code).toBe(0);
  expect(JSON.parse(p.run(["storage", "inspect", "--json"]).text).sessions[0].writers).toBe(0);
  expect(readFileSync(p.snapshot, "utf8")).toBe(snapshot); expect(readFileSync(old.file, "utf8")).toBe(event);
  expect(existsSync(join(p.folder, "blobs", old.hash))).toBe(true);
  expect(p.run(["storage", "apply", id, "--yes"]).code).toBe(1);
});

test("a killed cleaner can be recovered through the same native human permission route", async () => {
  const p = project(); p.record("old source", 60); await abandoned(p.folder, "cleanup");
  const id = recoveryDraft(p), payload = { hook_event_name: "PreToolUse", session_id: "shared", cwd: p.root,
    permission_mode: "default", tool_name: "Bash", tool_use_id: "recover",
    tool_input: { command: "pregate storage apply " + id + " --yes" } };
  const ask = p.run(["hook", "pre"], payload, "");
  expect(ask.code).toBe(0); expect(JSON.parse(ask.text).hookSpecificOutput.permissionDecision).toBe("ask");
  expect(ask.text).toContain("Recover abandoned storage");
  expect(p.run(["hook", "pre"], { ...payload, agent_id: "child" }, "").code).toBe(2);
  expect(p.run(["hook", "pre"], payload).code).toBe(2);
  expect(p.run(["storage", "apply", id, "--yes"]).code).toBe(0);
  expect(existsSync(join(p.folder, ".pruning"))).toBe(false);
  expect(p.run(["hook", "pre"], { ...payload, tool_name: "Write", tool_input: { file_path: join(p.root, "src/a.ts"), content: "export const changed = 2;\n" } }).code).toBe(0);
});

test("changed or forged owner metadata cannot turn recovery into arbitrary deletion", async () => {
  const p = project(); await abandoned(p.folder, "writer"); const id = recoveryDraft(p);
  const file = join(p.root, "data/pregate/storage-drafts", id + ".json"), plan = JSON.parse(readFileSync(file, "utf8"));
  const marker = plan.sessions[0].markers[0];
  put(join(p.folder, marker.path), JSON.stringify({ pid: process.pid, at: Date.now() }));
  expect(p.run(["storage", "apply", id, "--yes"]).code).toBe(1);
  expect(existsSync(join(p.folder, marker.path))).toBe(true);
  marker.path = "../../../../src/a.ts"; const text = JSON.stringify(plan), forged = sha256(text);
  put(join(p.root, "data/pregate/storage-drafts", forged + ".json"), text);
  expect(p.run(["storage", "apply", forged, "--yes"]).code).toBe(1);
  expect(readFileSync(join(p.root, "src/a.ts"), "utf8")).toBe(p.baseline);
});

test("recovery retains live, unidentified, legacy and other-project coordination", async () => {
  const p = project();
  const live = join(p.folder, ".leases", process.pid + "-live.json"); put(live, JSON.stringify({ pid: process.pid, at: 1, host: hostname() }));
  mkdirSync(join(p.folder, ".pruning"));
  expect(p.run(["storage", "recover", "--preview"]).text).toContain("No provably abandoned");
  expect(existsSync(live)).toBe(true); expect(existsSync(join(p.folder, ".pruning"))).toBe(true);
  rmSync(join(p.folder, ".pruning"), { recursive: true });
  const pid = await abandoned(p.folder, "writer");
  put(join(p.folder, ".pruning/owner.json"), JSON.stringify({ pid, at: 1 }));
  const id = recoveryDraft(p); expect(p.run(["storage", "apply", id, "--yes"]).code).toBe(0);
  expect(existsSync(live)).toBe(true); expect(existsSync(join(p.folder, ".pruning/owner.json"))).toBe(true);
  const q = project(), other = join(q.folder, "..", WINDOWS ? "claude-code~other" : "claude-code:other"), otherRoot = join(area, "other-project");
  put(join(other, H(otherRoot), "snapshot.json"), JSON.stringify({ root: otherRoot, head: null, start: true, at: Date.now(), dirty: {} }));
  await abandoned(other, "writer");
  expect(q.run(["storage", "recover", "--preview"]).text).toContain("No provably abandoned");
  expect(q.run(["storage", "recover", "--yes"]).code).toBe(1);
});

test("reviewed retention removes only eligible code and preserves resumable baselines and report counts", () => {
  const p = project();
  expect(p.run(["pack", "disable", "core/software-invariants", "--yes"]).code).toBe(0); // Isolate storage and Stop baseline retention.
  const old = p.record("old attempted source", 60, p.root, true);
  const recent = p.record("recent attempted source", 1);
  const shared = p.record("shared with a newer observation", 60);
  p.record("shared with a newer observation", 1);
  const other = p.record("other project source", 60, join(area, "other"));
  p.record(p.baseline, 60);
  const orphan = sha256("unattributed source"); put(join(p.folder, "blobs", orphan), "unattributed source");
  const head = join(p.folder, H(p.root), "head", H("src/clean.ts") + ".json"); put(head, JSON.stringify({ text: "cached baseline" }));
  const snapshot = readFileSync(p.snapshot, "utf8"), cache = readFileSync(head, "utf8");
  const before = JSON.parse(p.run(["report", "--days", "90", "--json"]).text);
  expect(before).toMatchObject({ calls: 5, denials: 5 });
  const inspection = JSON.parse(p.run(["storage", "inspect", "--json"]).text);
  expect(inspection.sessions[0]).toMatchObject({ session: "claude-code:shared", events: 6, writers: 0, pruning: false });
  const digest = p.draft();
  const preview = p.run(["storage", "show", digest]).text;
  expect(preview).toContain("1 blobs");
  expect(preview).toContain("Claude Code, Codex, Grok or agy");
  expect(preview).toContain(`pregate storage apply ${digest} --yes`);
  expect(preview).toContain("Cursor needs a separate terminal");
  expect(p.run(["storage", "apply", digest]).code).toBe(1);
  expect(existsSync(join(p.folder, "blobs", old.hash))).toBe(true);
  expect(p.run(["storage", "apply", digest, "--yes"]).code).toBe(0);
  expect(existsSync(join(p.folder, "blobs", old.hash))).toBe(false);
  for (const hash of [recent.hash, shared.hash, other.hash, p.liveHash, orphan]) expect(existsSync(join(p.folder, "blobs", hash))).toBe(true);
  expect(readFileSync(p.snapshot, "utf8")).toBe(snapshot); expect(readFileSync(head, "utf8")).toBe(cache);
  expect(existsSync(old.file)).toBe(true);
  const oldId = sha256((WINDOWS ? "claude-code~shared" : "claude-code:shared") + "\0" + eventName(old.event)).slice(0, 24);
  expect(p.run(["issue", "draft", oldId]).code).toBe(0);
  const reproduction = p.run(["issue", "draft", oldId, "--include-code"]);
  expect(reproduction.code).toBe(1); expect(reproduction.text).toContain("ENOENT");
  const after = JSON.parse(p.run(["report", "--days", "90", "--json"]).text);
  expect(after).toMatchObject({ calls: before.calls, denials: before.denials, halts: before.halts, shadow: before.shadow,
    rules: before.rules, files: before.files, examples: before.examples, calibration: before.calibration });
  expect(p.run(["hook", "stop"], { hook_event_name: "Stop", session_id: "shared", cwd: p.root, stop_hook_active: false }).code).toBe(0);
  expect(p.run(["storage", "apply", digest, "--yes"]).code).toBe(1);
});

test("new references and forged cleanup files invalidate a reviewed plan", () => {
  const p = project(), old = p.record("old source", 60), digest = p.draft();
  p.record("old source", 1);
  expect(p.run(["storage", "apply", digest, "--yes"]).code).toBe(1);
  expect(existsSync(join(p.folder, "blobs", old.hash))).toBe(true);
  const q = project(); q.record("another old source", 60);
  const id = q.draft(), draftFile = join(q.root, "data/pregate/storage-drafts", id + ".json");
  const plan = JSON.parse(readFileSync(draftFile, "utf8"));
  plan.sessions[0].files[0].path = "../../../../src/a.ts";
  const text = JSON.stringify(plan), forged = sha256(text);
  put(join(q.root, "data/pregate/storage-drafts", forged + ".json"), text);
  expect(q.run(["storage", "apply", forged, "--yes"]).code).toBe(1);
  expect(readFileSync(join(q.root, "src/a.ts"), "utf8")).toBe(q.baseline);
  const r = project(), candidate = r.record("snapshot now needs this source", 60), before = r.draft();
  const snap = JSON.parse(readFileSync(r.snapshot, "utf8")); snap.dirty["src/extra.ts"] = candidate.hash;
  put(r.snapshot, JSON.stringify(snap));
  expect(r.run(["storage", "apply", before, "--yes"]).code).toBe(1);
  expect(existsSync(join(r.folder, "blobs", candidate.hash))).toBe(true);
});

test("newer before-images and other roots retain shared source copies", () => {
  const p = project(), before = p.record("a retained before-image", 60), newer = p.record("newer after-image", 1);
  put(newer.file, JSON.stringify({ ...newer.event, beforeSha: before.hash }));
  const shared = p.record("same source across roots", 60);
  p.record("same source across roots", 60, join(area, "other"));
  const otherBaseline = p.record("other root snapshot source", 60);
  const otherRoot = join(area, "other-snapshot");
  put(join(p.folder, H(otherRoot), "snapshot.json"), JSON.stringify({ root: otherRoot, head: null, start: true,
    dirty: { "src/a.ts": otherBaseline.hash }, at: Date.now() }));
  expect(p.run(["storage", "prune", "--older-than", "30"]).text).toContain("No removable");
  for (const hash of [before.hash, shared.hash, otherBaseline.hash]) expect(existsSync(join(p.folder, "blobs", hash))).toBe(true);
});

test("expired, modified and wrong-project previews cannot authorize deletion", () => {
  const p = project(), old = p.record("old source", 60), id = p.draft();
  const file = join(p.root, "data/pregate/storage-drafts", id + ".json");
  const original = readFileSync(file, "utf8");
  put(file, original + " "); expect(p.run(["storage", "apply", id, "--yes"]).code).toBe(1);
  const source = JSON.parse(original);
  for (const changes of [{ at: Date.now() - 24 * 3_600_000 - 1 }, { at: Date.now() + 10000 }, { root: join(area, "another") }]) {
    const text = JSON.stringify({ ...source, ...changes }), digest = sha256(text);
    put(join(p.root, "data/pregate/storage-drafts", digest + ".json"), text);
    expect(p.run(["storage", "apply", digest, "--yes"]).code).toBe(1);
  }
  expect(existsSync(join(p.folder, "blobs", old.hash))).toBe(true);
});

test("active writers and an exclusive cleanup marker prevent unsafe source removal", () => {
  const p = project(), old = p.record("old source", 60), id = p.draft();
  const lease = join(p.folder, ".leases/busy.json"); put(lease, JSON.stringify({ pid: process.pid }));
  expect(p.run(["storage", "apply", id, "--yes"]).code).toBe(1);
  expect(existsSync(join(p.folder, ".pruning"))).toBe(false);
  expect(existsSync(join(p.folder, "blobs", old.hash))).toBe(true);
  rmSync(lease);
  mkdirSync(join(p.folder, ".pruning"));
  expect(p.run(["storage", "apply", id, "--yes"]).code).toBe(1);
  expect(existsSync(join(p.folder, ".pruning"))).toBe(true);
  const hook = p.run(["hook", "pre"], { hook_event_name: "PreToolUse", session_id: "shared", cwd: p.root, tool_name: "Write", tool_use_id: "busy",
    tool_input: { file_path: join(p.root, "src/a.ts"), content: "export const changed = 2;\n" } });
  expect(hook.code).toBe(2); expect(hook.text + hook.error).toContain("state-io");
  expect(hook.text + hook.error).toContain("storage inspect");
});

test("native cleanup approval is digest-bound and cannot be self-approved by children or wrappers", () => {
  const p = project(); p.record("old source", 60); const id = p.draft();
  const payload = { hook_event_name: "PreToolUse", session_id: "shared", cwd: p.root, permission_mode: "default", tool_name: "Bash", tool_use_id: "cleanup",
    tool_input: { command: "pregate storage apply " + id + " --yes" } };
  const parent = p.run(["hook", "pre"], payload, "");
  expect(parent.code).toBe(0); expect(JSON.parse(parent.text).hookSpecificOutput.permissionDecision).toBe("ask");
  expect(parent.text).toContain("Snapshots, baseline caches, histories");
  for (const input of [{ ...payload, agent_id: "child" }, { ...payload, tool_input: { command: "env " + payload.tool_input.command } }]) {
    expect(p.run(["hook", "pre"], input, "").code).toBe(2);
  }
  expect(p.run(["hook", "pre"], payload).code).toBe(2);
  expect(existsSync(join(p.folder, "blobs", sha256("old source")))).toBe(true);
});

test("corrupt or missing baselines and symbolic links refuse cleanup", () => {
  const p = project(); p.record("old source", 60);
  rmSync(p.snapshot);
  expect(p.run(["storage", "prune", "--older-than", "30"]).code).toBe(1);
  const q = project(); q.record("old source", 60);
  put(q.snapshot, "{}");
  expect(q.run(["storage", "inspect"]).code).toBe(1);
  if (!WINDOWS) {
    const r = project(); r.record("old source", 60);
    symlinkSync(join(r.root, "src/a.ts"), join(r.folder, "blobs", "outside"));
    expect(r.run(["storage", "prune", "--older-than", "30"]).code).toBe(1);
    const s = project(); s.record("old source", 60);
    symlinkSync(s.root, join(s.folder, ".leases"));
    expect(s.run(["storage", "inspect"]).code).toBe(1);
  }
});

test("an unfinished snapshot publication keeps its source references", () => {
  const p = project(), old = p.record("source awaiting snapshot publication", 60);
  put(join(p.folder, "tmp-interrupted", "snapshot.json"), JSON.stringify({ root: p.root, head: null, start: true,
    dirty: { "src/a.ts": old.hash }, at: Date.now() }));
  expect(p.run(["storage", "prune", "--older-than", "30"]).text).toContain("No removable");
  expect(existsSync(join(p.folder, "blobs", old.hash))).toBe(true);
});

test("strict flags and an empty cleanup never mutate source", () => {
  const p = project();
  for (const args of [["prune", "--older-than", "0"], ["prune", "--older-than", "30", "--yes"], ["inspect", "--json", "--json"],
    ["prune", "--older-than", "NaN"], ["apply", "a".repeat(64), "--yes", "--yes"]]) expect(p.run(["storage", ...args]).code).toBe(1);
  expect(p.run(["storage", "prune", "--older-than", "30"]).text).toContain("No removable");
  expect(readFileSync(join(p.root, "src/a.ts"), "utf8")).toBe(p.baseline);
});
