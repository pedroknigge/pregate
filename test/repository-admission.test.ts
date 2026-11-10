import { afterAll, afterEach, beforeEach, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { BUILTIN } from "../src/assets.ts";
import { canonical as lockText, compile, freshness } from "../src/compile.ts";
import { enable } from "../src/consent.ts";
import { canonical } from "../src/disk.ts";
import { check, LOCK, lockOf, onPreEdit, onSessionStart, onStop, PRESET, sourcesOf, VERSIONS } from "../src/gate.ts";
import { normalize } from "../src/reconstruct.ts";
import { sha256 } from "../src/state.ts";
import { contractState } from "../src/status.ts";
import { projectFitness } from "../src/fitness-command.ts";
import type { Lock, Session } from "../src/types.ts";
import { removeTree } from "./remove-tree.ts";

// Cases spawn git or the engine; on Windows each spawn costs 0.3-1 s.
setDefaultTimeout(60_000);

const actualPreset = readFileSync(join(import.meta.dir, "../.pregate/preset.json"), "utf8");
const area = canonical(mkdtempSync(join(tmpdir(), "pregate-admission-")));
const folders = { HOME: "home", USERPROFILE: "home", LOCALAPPDATA: "data", APPDATA: "config", XDG_DATA_HOME: "data",
  XDG_STATE_HOME: "state", XDG_CONFIG_HOME: "config", TMPDIR: "tmp", TMP: "tmp", TEMP: "tmp", CODEX_HOME: "codex",
  GROK_HOME: "grok", CLAUDE_CONFIG_DIR: "claude" };
let saved: Record<string, string | undefined>;
let turn = 0;
let work: string;

beforeEach(() => {
  saved = Object.fromEntries(Object.keys(folders).map((key) => [key, process.env[key]]));
  work = join(area, String(++turn));
  for (const [key, folder] of Object.entries(folders)) {
    const path = join(work, folder);
    mkdirSync(path, { recursive: true });
    process.env[key] = path;
  }
});
afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
afterAll(() => removeTree(area));

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function git(cwd: string, ...args: string[]): void {
  const result = Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd, stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

function project(preset = actualPreset, lockEnding = "LF") {
  const root = join(work, "repo");
  put(join(root, "src/decide.ts"), "export const value = 1;\n");
  put(join(root, PRESET), preset);
  const result = compile(preset, sourcesOf(root), VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  const core = result.lock.rules.filter((rule) => rule.id.startsWith("core/"));
  expect(core).toHaveLength(68);
  expect(core.every((rule) => rule.severity === "deny" && rule.enforcement === "enforce")).toBe(true);
  put(join(root, LOCK), lockEnding === "CRLF" ? result.text.replace(/\n/g, "\r\n") : result.text);
  git(root, "init", "-q");
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  enable(root);
  const session: Session = { id: `admission-${turn}`, harness: "claude-code", turnId: "turn", agentId: null, interactive: false };
  onSessionStart({ kind: "session-start", session, cwd: root });
  return { root, session, lock: result.lock };
}

async function edit(root: string, session: Session) {
  return onPreEdit([{ session, callId: "edit", tool: "Write", path: join(root, "src/decide.ts"),
    edit: { form: "full", content: "export const value = 2;\n" }, from: null }]);
}

async function rejects(root: string, session: Session) {
  const decision = await edit(root, session);
  expect(decision.verdict).toBe("deny");
  expect(decision.cause).toBe("lock-stale");
  expect(decision.halt).toBe(true);
  const precheck = await check(root, { kind: "stdin", path: "src/decide.ts", text: "export const value = 2;\n" });
  expect(precheck.code).toBe(1);
  expect(precheck.text).toContain("lock-stale");
  const stop = await onStop({ kind: "stop", session, cwd: root, reentry: false });
  expect(stop.verdict).toBe("deny");
  expect(stop.cause).toBe("lock-stale");
  expect(lockOf(root)).toBe("lock-stale");
  expect(contractState(root).valid).toBe(false);
}

test.each([["LF", "LF"], ["LF", "CRLF"], ["CRLF", "LF"], ["CRLF", "CRLF"]])("repository admission boundary: valid %s preset and %s lock retain the actual core and accept a legitimate edit", async (presetEnding, lockEnding) => {
  const { root, session } = project(presetEnding === "CRLF" ? actualPreset.replace(/\n/g, "\r\n") : actualPreset, lockEnding);
  expect(typeof lockOf(root)).toBe("object");
  expect(contractState(root).valid).toBe(true);
  expect((await edit(root, session)).verdict).toBe("none");
  expect((await check(root, { kind: "stdin", path: "src/decide.ts", text: "export const value = 2;\n" })).code).toBe(0);
  const tree = await check(root, { kind: "tree" });
  expect(tree.code).toBe(0);
  expect(tree.text).not.toContain("UNVERIFIED");
  expect(tree.text).not.toContain("does not match the preset");
  // Admission does not turn the 64 missing fitness bindings into passing evidence.
  const stop = await onStop({ kind: "stop", session, cwd: root, reentry: false });
  expect(stop.verdict).toBe("none");
  expect(stop.cause).toBeNull();
  expect(stop.violations).toEqual([]);
  expect(stop.full).not.toContain("UNVERIFIED");
  const current = lockOf(root);
  if (typeof current === "string") throw new Error(current);
  expect(projectFitness(root, current.lock, "ci").filter((r) => r.status === "unverified")).toHaveLength(64);
});

const altered: [string, (lock: Lock) => void][] = [
  ["removed rules", (lock) => { lock.rules = []; }],
  ["empty scope", (lock) => { lock.scope.include = []; }],
  ["excluded all files", (lock) => { lock.scope.exclude = ["**"]; }],
  ["shadow policies", (lock) => { lock.enforcement = "shadow"; for (const rule of lock.rules) rule.enforcement = "shadow"; }],
  ["weakened severity", (lock) => { for (const rule of lock.rules) rule.severity = "warn"; }],
  ["delegated all checks", (lock) => { lock.ownedByArkgate = lock.rules.map((rule) => rule.id); }],
  ["generated-code bypass", (lock) => { lock.generatedMarkers = ["export const"]; }],
  ["removed integrity", (lock) => { for (const rule of lock.rules) rule.integrity = false; }],
  ["unexpected source directories", (lock) => { lock.sourceDirs = ["src"]; }],
  ["malformed rule table", (lock) => { Object.assign(lock, { rules: null }); }],
  ["invalid failure budget", (lock) => { lock.loop.maxDenialsPerTurn = 0; }],
  ["unknown lock field", (lock) => { Object.assign(lock, { unknownPolicy: true }); }],
];
test.each(["BOM", "minified"])("repository admission boundary: rejects noncanonical %s lock formatting consistently", async (format) => {
  const { root, session, lock } = project();
  expect(freshness(lock, actualPreset, VERSIONS, BUILTIN)).toBeNull();
  put(join(root, LOCK), format === "BOM" ? "\uFEFF" + lockText(lock) : JSON.stringify(lock) + "\n");
  await rejects(root, session);
});
test.each(altered)("repository admission boundary: rejects metadata-preserving %s before edit, stdin and Stop evaluation", async (_name, alter) => {
  const { root, session, lock } = project();
  alter(lock);
  // Existing metadata checks alone consider every one of these altered bodies fresh.
  expect(freshness(lock, actualPreset, VERSIONS, BUILTIN)).toBeNull();
  put(join(root, LOCK), lockText(lock));
  await rejects(root, session);
});

test.each([
  ["lock version", { lockVersion: 2 }],
  ["preset hash", { presetHash: "0".repeat(64) }],
  ["core hash", { coreHash: "0".repeat(64) }],
  ["source hash", { sourcesHash: "0".repeat(64) }],
  ["missing preset hash", { presetHash: undefined }],
  ["missing core hash", { coreHash: undefined }],
])("repository admission boundary: complete compilation rejects %s", async (_name, metadata) => {
  const { root, session, lock } = project();
  Object.assign(lock, metadata);
  put(join(root, LOCK), lockText(lock));
  await rejects(root, session);
});

test.each([
  ["unknown failure policy", { failMode: "open" }],
  ["unknown enforcement", { enforcement: "silent" }],
] as const)("repository admission boundary: rejects %s even when the edited preset hash agrees", async (_name, policy) => {
  const { root, session, lock } = project();
  const preset = JSON.stringify({ ...JSON.parse(actualPreset), ...policy });
  lock.presetHash = sha256(normalize(preset));
  expect(freshness(lock, preset, VERSIONS, BUILTIN)).toBeNull();
  put(join(root, PRESET), preset);
  put(join(root, LOCK), lockText(lock));
  await rejects(root, session);
});
