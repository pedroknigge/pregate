import { afterAll, afterEach, beforeEach, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { canonical as lockText, compile } from "../src/compile.ts";
import * as compiler from "../src/compile.ts";
import { disable, disableProject, enable, enabled, explicitlyDisabled } from "../src/consent.ts";
import { check, delegate, engineHome, FLOOR, launcher, LOCK, lockOf, onPostInvocation, onPreCommand, onPreEdit, onSessionStart, onStop, sessionStart, pinned, PRESET, REDIRECT, redirect, rejected, sourcesOf, VERSIONS } from "../src/gate.ts";
import { protectionStatus, statusText } from "../src/status.ts";
import { decode as claude } from "../src/harness/claude.ts";
import { decode as codex } from "../src/harness/codex.ts";
import * as state from "../src/state.ts";
import * as workspace from "../src/workspace.ts";
import * as gitHost from "../src/git.ts";
import type { Decision, Edit, HookEvent, ProposedChange, Rejected, Session } from "../src/types.ts";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { canonical } from "../src/disk.ts";
import * as disk from "../src/disk.ts";
import { pathKey } from "../src/paths.ts";
import { report } from "../src/report-command.ts";
import { HARNESSES } from "../src/harness/profile.ts";
import { enabledWire } from "../src/harness/wire.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { proposeContract, readProposal, PENDING_MS } from "../src/approval.ts";
import { commandOnPath } from "../src/control-file.ts";
import { proposeBatch } from "../src/proposal.ts";
import { findings } from "../src/recorded.ts";
import { inert, projectUpdateMention } from "../src/admission.ts";
import { pendingRoot } from "../src/proposal.ts";
import { issueContent } from "../src/issue.ts";
import { removeTree } from "./remove-tree.ts";

// Many cases run git and the engine several times; on Windows a git or engine spawn is far slower.
setDefaultTimeout(60_000);

const base = realpathSync(mkdtempSync(join(tmpdir(), "mh-w6-gate-")));
const names = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "TMPDIR", "CODEX_HOME", "GROK_HOME", "CLAUDE_CONFIG_DIR", "PATH", "Path", "PREGATE_TESTING", "PREGATE_TEST_ANSWER"] as const;
let saved: Record<string, string | undefined>;
let run = 0;
let area: string;
beforeEach(() => {
  saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  area = join(base, String(++run));
  for (const [name, folder] of Object.entries({ HOME: "home", XDG_DATA_HOME: "data", XDG_STATE_HOME: "state", TMPDIR: "tmp", CODEX_HOME: "codex", GROK_HOME: "grok", CLAUDE_CONFIG_DIR: "claude" })) {
    const dir = join(area, folder);
    mkdirSync(dir, { recursive: true });
    process.env[name] = dir;
  }
});
afterEach(() => {
  for (const name of names) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});
afterAll(() => removeTree(base));

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function git(root: string, ...args: string[]): void {
  const r = Bun.spawnSync(["git", "-c", "user.name=W6", "-c", "user.email=w6@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: root, env: { ...process.env }, stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
}

function preset(root: string): void {
  const text = policyFixture(readFileSync(join(import.meta.dir, "../catalog/presets/backend-clean-ddd.json"), "utf8"));
  put(join(root, PRESET), text);
  const result = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  put(join(root, LOCK), result.text);
}

function repo(name = "repo", tracked = true): string {
  const root = canonical(join(area, name));
  put(join(root, "src/domain/a.ts"), "export const a = 1;\n");
  git(root, "init", "-q");
  if (tracked) preset(root);
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  if (!tracked) preset(root);
  enable(root);
  return root;
}

function session(harness: Session["harness"] = "claude-code", id = "session"): Session {
  return { id, harness, turnId: "turn", agentId: null, interactive: false };
}

// A public setter in the domain layer: ddd/DDD-ENT-001 is deny and enforce in the fixture preset.
const SETTER = "export class Invoice {\n  constructor(readonly id: string, private customer: string) {}\n  setCustomer(c: string): void { this.customer = c; }\n}\n";

test.each(["missing lock", "malformed lock", "changed preset", "incompatible pins"] as const)("%s: Pre, Stop and SessionStart judge from the preset without blocking or changing consent", async kind => {
  const root = repo(), s = session("claude-code", kind.replaceAll(" ", "-"));
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const original = readFileSync(join(root, LOCK), "utf8");
  if (kind === "missing lock") rmSync(join(root, LOCK));
  else if (kind === "malformed lock") put(join(root, LOCK), "{");
  else if (kind === "changed preset") put(join(root, PRESET), JSON.stringify({ ...JSON.parse(readFileSync(join(root, PRESET), "utf8")), name: "changed" }));
  else put(join(root, LOCK), JSON.stringify({ ...JSON.parse(original), engine: "0.2.5", core: "0.2.0" }));
  const pre = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)]);
  const stop = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  const start = onSessionStart({ kind: "session-start", session: s, cwd: root });
  for (const d of [pre, stop]) {
    expect(d.verdict).toBe("none");
    expect(d.halt).toBe(false);
    expect(d.cause).toBeNull();
    expect(d.full).toBe("");
    expect(d.notice).toBeNull();
  }
  expect(start.full).toContain(`PREGATE is active: preset ${kind === "changed preset" ? "changed" : "backend-clean-ddd"}`);
  expect(start.notice).toBeNull();
  // The lock in use is the preset compiled by this engine, so an enforced rule still denies.
  const loaded = lockOf(root);
  if (typeof loaded === "string") throw new Error(loaded);
  expect(loaded.lock.engine).toBe(VERSIONS.engine);
  expect(loaded.lock.core).toBe(VERSIONS.core);
  const breach = await onPreEdit([{ ...change(root, "src/domain/a.ts", { form: "full", content: SETTER }, s), callId: "breach" }]);
  expect(breach.verdict).toBe("deny");
  expect(breach.violations).toContainEqual(expect.objectContaining({ rule: "ddd/DDD-ENT-001" }));
  expect(enabled(root)).toBe(true);
  expect(readFileSync(join(root, "src/domain/a.ts"), "utf8")).toBe("export const a = 1;\n");
});

test("a missing preset is a note on Pre and Stop, and SessionStart tells the human how to recover", async () => {
  const root = repo(), s = session("claude-code", "missing-preset");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  rmSync(join(root, PRESET));
  const pre = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)]);
  const stop = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  const start = onSessionStart({ kind: "session-start", session: s, cwd: root });
  for (const d of [pre, stop]) {
    expect(d.verdict).toBe("none");
    expect(d.halt).toBe(false);
    expect(d.cause).toBe("lock-stale");
    expect(d.full).toContain("PREGATE NOTE lock-stale");
    expect(d.full).toContain("Not blocked.");
    expect(d.stopIncomplete).toBeUndefined();
  }
  expect(pre.full).toContain("src/domain/a.ts");
  // Stop has no agent turn left, so the human gets the note.
  expect(stop.notice).toContain("PREGATE NOTE lock-stale");
  expect(start.notice).toContain("Missing contract");
  expect(start.notice).toContain(`Installed engine ${VERSIONS.engine}, core ${VERSIONS.core}`);
  expect(start.notice).toContain("pregate update --project --preview");
  expect(start.notice).toContain("displayed digest-bound command");
  expect(enabled(root)).toBe(true);
  expect(readFileSync(join(root, "src/domain/a.ts"), "utf8")).toBe("export const a = 1;\n");
});

test("a lock left with merge conflict markers is rebuilt from the preset: Pre, Stop and SessionStart do not block", async () => {
  const root = repo("conflicted-lock"), s = session("claude-code", "conflicted-lock");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const original = readFileSync(join(root, LOCK), "utf8");
  put(join(root, LOCK), `<<<<<<< HEAD\n${original}=======\n${original.replace("{", "{\"x\":1,")}>>>>>>> dev\n`);
  const pre = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)]);
  const stop = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  const start = onSessionStart({ kind: "session-start", session: s, cwd: root });
  for (const d of [pre, stop]) {
    expect(d.verdict).toBe("none");
    expect(d.halt).toBe(false);
    expect(d.cause).toBeNull();
    expect(d.full).toBe("");
  }
  expect(start.full).toContain("PREGATE is active: preset backend-clean-ddd");
  expect(start.notice).toBeNull();
  // The preset is still enforced while the lock file stays conflicted.
  const breach = await onPreEdit([{ ...change(root, "src/domain/a.ts", { form: "full", content: SETTER }, s), callId: "breach" }]);
  expect(breach.verdict).toBe("deny");
  expect(breach.violations).toContainEqual(expect.objectContaining({ rule: "ddd/DDD-ENT-001" }));
  expect(readFileSync(join(root, LOCK), "utf8")).toContain("<<<<<<< HEAD");
  expect(enabled(root)).toBe(true);
});

test("explicit static enforcement keeps syntax strict in check; Pre and Stop record it and do not block", async () => {
  const root = repo("mixed-syntax"), s = session("claude-code", "mixed-syntax");
  put(join(root, "src/infra/unrelated.ts"), "export const unrelated = 1;\n");
  const next = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  next.enforcement = "shadow";
  next.overrides = { ...next.overrides, "clean-code/CC-FN-001": { severity: "deny", enforcement: "enforce", params: { paths: ["src/domain/**"] } } };
  const text = JSON.stringify(next), compiled = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  put(join(root, PRESET), text); put(join(root, LOCK), compiled.text);
  git(root, "add", "."); git(root, "commit", "-qm", "mixed source policy");
  await onSessionStart({ kind: "session-start", session: s, cwd: root });
  const invalid = "export const broken = ;\n";
  const edit = (rel: string): ProposedChange => ({ session: s, callId: rel, from: null, path: join(root, rel), tool: "Write", edit: { form: "full", content: invalid } });
  // Shadow says nothing: the cause is recorded, and the call passes.
  for (const rel of ["src/domain/a.ts", "src/infra/unrelated.ts"]) {
    const pre = await onPreEdit([edit(rel)]);
    expect(pre).toMatchObject({ verdict: "none", halt: false, cause: "syntax", full: "" });
    expect(events(s, join(root, rel)).at(-1)).toMatchObject({ verdict: "none", form: "syntax" });
  }
  expect((await check(root, { kind: "stdin", path: "src/domain/a.ts", text: invalid })).code).toBe(1);
  expect((await check(root, { kind: "stdin", path: "src/infra/unrelated.ts", text: invalid })).code).toBe(0);
  put(join(root, "src/infra/unrelated.ts"), invalid);
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("none");
  put(join(root, "src/domain/a.ts"), invalid);
  const stopped = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(stopped).toMatchObject({ verdict: "none", halt: false, cause: "syntax" }); expect(stopped.stopIncomplete).toBeUndefined();
  const based = await check(root, { kind: "base", sha: "HEAD" });
  expect(based.code).toBe(1); expect(based.text).toContain("PREGATE DENY syntax src/domain/a.ts");
  git(root, "add", "src");
  expect((await check(root, { kind: "staged" })).code).toBe(1);
  put(join(root, "src/domain/a.ts"), "export const a = 2;\n");
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("none");
});

test("a directory that was never enabled does not enforce guide or any other command", () => {
  const outside = canonical(area);
  const s = session("claude-code", "guide-neutral");
  const command = (text: string) => ({ session: s, callId: text, tool: "Bash", cwd: outside, command: text });
  for (const prefix of ["pregate", `'${launcher()}'`]) {
    for (const text of [prefix, `${prefix} guide`, `env ${prefix} guide`, `sh -c '${prefix} guide'`, `${prefix} guide --yes`, `env ${prefix} guide --json`,
      `${prefix} guide --json`, `${prefix} guide --preview`, `${prefix} guide --help`]) {
      const c = command(text);
      expect(inert({ kind: "pre-command", command: c }), text).toBe(true);
      expect(onPreCommand(c).verdict, text).toBe("none");
    }
  }
  expect(onPreCommand(command('echo "pregate guide"')).verdict).toBe("none");
  expect(state.roots(state.key(s))).toEqual([]);
});

test("a directory that was never enabled stays inert for a normalized guide invocation", () => {
  const outside = canonical(area);
  for (const harness of ["claude-code", "codex", "cursor", "grok", "agy"] as const) {
    const s = session(harness, "normalized-guide-" + harness);
    for (const text of ["pregate \\\n guide", "pre'gate' guide", "pregate g\\uide", "pre'gate'", 'env pre"gate" guide',
      "sh -c 'pregate g\\uide'", 'sh -c "pre\'gate\' guide"', "pre\\gate guide", `${launcher()} \\\n guide`, "script -q /dev/null pre'gate' guide"]) {
      const command = { session: s, callId: text, tool: "shell", cwd: outside, command: text };
      expect(inert({ kind: "pre-command", command }), text).toBe(true);
      expect(onPreCommand(command).verdict, text).toBe("none");
    }
    expect(state.roots(state.key(s))).toEqual([]);
  }
});

test("production hooks allow normalized guide calls from a directory that was never enabled", () => {
  const outside = canonical(area), installed = join(process.env.XDG_DATA_HOME!, "pregate", VERSIONS.engine, ENGINE_FILE);
  mkdirSync(dirname(installed), { recursive: true });
  engineAt(installed);
  const payload = (harness: Session["harness"], command: string) => {
    if (harness === "agy") return { conversationId: "normalized-guide", workspacePaths: [outside], stepIdx: 1, toolCall: { name: "run_command", args: { Cwd: outside, CommandLine: command } } };
    if (harness === "grok") return { hookEventName: "pre_tool_use", sessionId: "normalized-guide", cwd: outside, toolName: "run_terminal_command", toolUseId: "guide", toolInputTruncated: false, toolInput: { command } };
    if (harness === "cursor") return { hook_event_name: "preToolUse", session_id: "normalized-guide", tool_name: "Shell", tool_use_id: "guide", workspace_roots: [outside], tool_input: { cwd: outside, command } };
    return { hook_event_name: "PreToolUse", session_id: "normalized-guide", permission_mode: "default", tool_name: "Bash", tool_use_id: "guide", cwd: outside, tool_input: { command } };
  };
  for (const harness of ["claude-code", "codex", "cursor", "grok", "agy"] as const) {
    for (const command of ["pregate \\\n guide", "pre'gate' guide", "pregate g\\uide", "pre'gate'", 'env pre"gate" guide',
      "sh -c 'pregate g\\uide'", 'sh -c "pre\'gate\' guide"', "script -q /dev/null pre'gate' guide", `${installed} \\\n guide`]) {
      const raw = JSON.stringify(payload(harness, command));
      const decoded = HARNESSES[harness].decode("pre", raw, { projectDir: null, grokEvent: null, remote: false });
      expect(decoded).not.toBeNull(); expect(decoded !== null && !("cause" in decoded) && decoded.kind).toBe("pre-command");
      const out = Bun.spawnSync([installed, "hook", "pre", "--harness", harness], { cwd: outside, env: process.env, stdin: Buffer.from(raw), stdout: "pipe", stderr: "pipe", timeout: 5_000 });
      expect(out.exitCode, `${harness} ${command}\n${out.stderr.toString()}`).toBe(0);
      expect(out.stdout.toString(), command).not.toContain('"deny"');
    }
    for (const command of ["pregate guide --json", 'echo "pre\'gate\' guide"']) {
      const out = Bun.spawnSync([installed, "hook", "pre", "--harness", harness], { cwd: outside, env: process.env, stdin: Buffer.from(JSON.stringify(payload(harness, command))), stdout: "pipe", stderr: "pipe", timeout: 5_000 });
      expect(out.exitCode, out.stderr.toString()).toBe(0);
      expect(out.stdout.toString()).not.toContain('"deny"');
    }
  }
  expect(existsSync(join(outside, PRESET))).toBe(false);
  expect(existsSync(join(process.env.XDG_DATA_HOME!, "pregate", "consent"))).toBe(false);
}, 120_000);

test("git add can stage the admitted policy pair but cannot stage a preset that does not compile, or write policy", () => {
  const root = repo(), s = session();
  const command = (text: string) => onPreCommand({ session: s, callId: text, tool: "Bash", cwd: root, command: text });
  const files = `git add -- ${PRESET} ${LOCK} && git commit -m 'admitted policy'`;
  expect(command(files).verdict).toBe("none");
  expect(command(`git add ${PRESET} > ${LOCK}`).cause).toBe("protected-path");
  expect(command("git add .pregate/arbitrary.ts").cause).toBe("protected-path");
  expect(command(`/repo/bin/git add ${PRESET}`).cause).toBe("protected-path");
  expect(command(`git add --pathspec-from-file=${PRESET}`).cause).toBe("protected-path");
  const text = readFileSync(join(root, PRESET), "utf8");
  put(join(root, PRESET), text + "invalid");
  expect(command(files).cause).toBe("protected-path");
  expect(command(`git diff -- ${PRESET}`).verdict).toBe("none");
  expect(command(`cat ${PRESET}`).verdict).toBe("none");
  expect(command("ls .pregate/").verdict).toBe("none");
  expect(command(`git diff --output=${LOCK} -- ${PRESET}`).cause).toBe("protected-path");
  expect(command(`cat ${PRESET} > ${LOCK}`).cause).toBe("protected-path");
  // A read-only command may name anything inside .pregate/; a write or a redirection into it may not.
  for (const read of ["ls .pregate/private-state/", `head ${PRESET}`, `wc -l ${LOCK}`, "git log -- .pregate/"]) expect(command(read).verdict, read).toBe("none");
  for (const write of ["ls .pregate/private-state/ > .pregate/listing", `sed -i s/a/b/ ${PRESET}`, "tee .pregate/x < /dev/null"]) expect(command(write).cause, write).toBe("protected-path");
  put(join(root, PRESET), text);
  // A lock file behind a valid preset does not stop the staging: the preset is what is judged.
  put(join(root, LOCK), "{}");
  expect(command(files)).toMatchObject({ verdict: "none", cause: null });
  expect(command(`git add ${PRESET} > ${LOCK}`).cause).toBe("protected-path");
});

test("doctor inspection reads fixed global, configured and project settings while preserving mutation gates", () => {
  const root = repo(), s = session();
  const global = join(process.env.HOME!, ".claude/settings.json"), configured = join(process.env.CLAUDE_CONFIG_DIR!, "settings.json");
  const project = join(root, ".claude/settings.local.json"), linked = join(area, "settings-target.json");
  for (const file of [global, project, linked]) put(file, "{}\n");
  symlinkSync(linked, configured);
  const command = (text: string, cwd = root) => onPreCommand({ session: s, callId: text, tool: "Bash", cwd, command: text });
  for (const file of [global, configured, project, linked]) expect(command(`cat -- '${file}'`).verdict, file).toBe("none");
  expect(command("cat .claude/settings.local.json").verdict).toBe("none");
  expect(command(`cat -- '${global}' '${configured}' '${project}'`).verdict).toBe("none");
  const otherSettings = [join(process.env.CODEX_HOME!, "hooks.json"), join(process.env.GROK_HOME!, "config.toml"),
    join(process.env.HOME!, ".cursor/hooks.json"), join(process.env.HOME!, ".gemini/config/hooks.json"), join(root, ".agents/hooks.json")];
  for (const file of otherSettings) put(file, "{}\n");
  const cursorDir = join(area, "cursor-target");
  put(join(cursorDir, "hooks.json"), "{}\n");
  symlinkSync(cursorDir, join(root, ".cursor"));
  for (const harness of ["claude-code", "codex", "cursor", "grok", "agy"] as const) {
    for (const file of [...otherSettings, join(root, ".cursor/hooks.json"), join(cursorDir, "hooks.json")]) {
      expect(onPreCommand({ session: session(harness, harness), callId: file, tool: "Bash", cwd: root, command: `cat -- '${file}'` }).verdict, file).toBe("none");
    }
  }
  for (const text of [
    `jq empty '${global}'`, `jq '.disableAllHooks = true' '${global}'`, `unknown '${global}'`,
    `cat '${global}' > /tmp/doctor-copy`, `cat '${global}' > '${project}'`, `cat '${global}' 2>&1`,
    `sh -c "cat '${global}'"`, `cat '${global}' | jq .`, `git add '${global}'`,
    `for f in '${global}'; do jq empty "$f"; done`, `python3 -c 'open("${global}").read()'`,
    `sed -i s/x/y/ '${global}'`, `rm '${configured}'`, `cat '${join(process.env.XDG_STATE_HOME!, "pregate/private.json")}'`,
    "cat .pregate/private-state.json", "cat .git/config", "cat .claude/settings*.json", "cat $CLAUDE_CONFIG_DIR/settings.json",
  ]) expect(command(text).cause, text).toBe("protected-path");
  expect(command("claude --settings /tmp/settings.json").cause).toBe("hook-switch");
  expect(command("pregate approve --yes --digest " + "a".repeat(64)).verdict).toBe("none");
  expect(command("pregate approve").verdict).toBe("none");
  expect(command(`cat '${global}'`, process.env.HOME!).verdict).toBe("none");
  for (const file of [global, project, linked]) expect(readFileSync(file, "utf8")).toBe("{}\n");
});

test("configuration symlinks cannot expose private state or rule sources and non-files remain denied", () => {
  const root = repo(), s = session();
  const settings = join(root, ".claude/settings.json");
  const targets = [join(process.env.XDG_STATE_HOME!, "pregate/private.json"),
    join(root, ".pregate/private.json"), join(root, "team-rules/check.json"), join(process.env.HOME!, ".claude/skills/pregate/notes.md"), join(area, "worktree/.git")];
  const text = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  text.sources.push({ ns: "team", kind: "path", path: "team-rules" });
  put(join(root, PRESET), JSON.stringify(text));
  mkdirSync(dirname(settings), { recursive: true });
  for (const target of targets) {
    put(target, "{}\n");
    symlinkSync(target, settings);
    for (const file of [settings, target]) expect(onPreCommand({ session: s, callId: file, tool: "Bash", cwd: root, command: `cat '${file}'` }).cause, file).toBe("protected-path");
    rmSync(settings);
  }
  mkdirSync(settings);
  expect(onPreCommand({ session: s, callId: "directory", tool: "Bash", cwd: root, command: `cat '${settings}'` }).cause).toBe("protected-path");
  const sibling = repo("sibling"), siblingSource = join(sibling, "rules/check.json");
  const siblingPreset = JSON.parse(readFileSync(join(sibling, PRESET), "utf8"));
  siblingPreset.sources.push({ ns: "sibling", kind: "path", path: "rules" });
  put(join(sibling, PRESET), JSON.stringify(siblingPreset));
  put(siblingSource, "{}\n");
  const globalSettings = join(process.env.HOME!, ".claude/settings.json");
  mkdirSync(dirname(globalSettings), { recursive: true });
  symlinkSync(siblingSource, globalSettings);
  expect(onPreCommand({ session: s, callId: "sibling-source", tool: "Bash", cwd: root, command: `cat '${globalSettings}'` }).cause).toBe("protected-path");
});

test("a literal cat call reads the installed skill file, alone or in a sequence, and nothing else in its folder", () => {
  const root = repo(), home = process.env.HOME!;
  const skills = [join(home, ".agents/skills/pregate/SKILL.md"), join(home, ".claude/skills/pregate/SKILL.md"),
    join(process.env.CODEX_HOME!, "skills/pregate/SKILL.md"), join(home, ".cursor/skills/pregate/SKILL.md"),
    join(process.env.GROK_HOME!, "skills/pregate/SKILL.md"), join(home, ".gemini/antigravity-cli/skills/pregate/SKILL.md")];
  for (const file of skills) put(file, "name: pregate\n");
  const command = (text: string, harness: "claude-code" | "codex" = "codex") =>
    onPreCommand({ session: session(harness, `skill-${harness}`), callId: text, tool: "Bash", cwd: root, command: text });
  for (const file of skills) {
    expect(command(`cat ${file}`).verdict, file).toBe("none");
    expect(command(`cat -- '${file}'`, "claude-code").verdict, file).toBe("none");
  }
  // Codex 0.167.0 loads the skill at the end of a sequence, not as a command line of its own.
  for (const text of [`pwd && rg --files -g AGENTS.md && cat ${skills[0]}`, `pwd; rg --files -g package.json; cat ${skills[0]}`, `cat ${skills[0]}; git status --short`])
    expect(command(text).verdict, text).toBe("none");
  const skill = skills[0]!, other = join(dirname(skill), "notes.md"), secret = join(process.env.XDG_STATE_HOME!, "pregate/private.json");
  // Quoted, so that a Windows path reaches the guard as one literal word.
  put(other, "x\n"); put(secret, "{}\n");
  for (const text of [
    `cat '${other}'`, `cat ${dirname(skill)}/*`, `cat '${skill}' > /tmp/skill-copy`, `cat '${skill}' | sh`, `sed -i s/x/y/ '${skill}'`,
    `rm '${skill}'`, `echo x >> '${skill}'`, `cp '${secret}' '${skill}'`, `cat '${skill}' '${other}'`, `cat '${skill}' 2>&1`, `pwd | cat '${skill}'`,
    `cat -n '${skill}'`, `sh -c "cat '${skill}'"`, `echo $(cat '${skill}')`, `cat '${skill}' && cat '${secret}'`, `pwd; cat '${skill}' > '${other}'`,
  ]) expect(command(text).cause, text).toBe("protected-path");
  // The skill folder as a link into private state gives no read of that state.
  const linked = join(home, ".cursor/skills/pregate");
  rmSync(linked, { recursive: true });
  put(join(dirname(secret), "SKILL.md"), "{}\n");
  symlinkSync(dirname(secret), linked);
  expect(command(`cat ${join(linked, "SKILL.md")}`).cause).toBe("protected-path");
  for (const file of skills.filter(f => !f.startsWith(linked))) expect(readFileSync(file, "utf8")).toBe("name: pregate\n");
});

test("a project script as it was when the session began runs; one the session changed, added or committed is read for sinks", () => {
  const root = repo("scripts");
  const writer = "const fs = require('node:fs');\nfs.writeFileSync('out.txt', 'x');\n";
  put(join(root, "scripts/gen.js"), writer);
  put(join(root, "src/domain/a.test.js"), "import { test } from 'node:test';\nimport vm from 'node:vm';\nimport { a } from './a.js';\ntest('a', () => vm.runInNewContext('1') && a);\n");
  git(root, "add", "."); git(root, "commit", "-qm", "scripts");
  const run = (s: Session, text: string) => onPreCommand({ session: s, callId: text, tool: "Bash", cwd: root, command: text });
  for (const harness of ["claude-code", "codex", "cursor", "grok", "agy"] as const) {
    const s = session(harness, `scripts-${harness}`);
    for (const text of ["node scripts/gen.js", "node src/domain/a.test.js", "node --test src/domain/a.test.js", "bun scripts/gen.js"])
      expect(run(s, text).verdict, `${harness}: ${text}`).toBe("none");
  }
  const s = session("claude-code", "scripts-changed");
  expect(run(s, "node scripts/gen.js").verdict).toBe("none");
  // Changed in the session, by any route: the text is no longer the session's base.
  put(join(root, "scripts/gen.js"), `${writer}fs.writeFileSync('src/domain/a.ts', 'x');\n`);
  expect(run(s, "node scripts/gen.js").verdict).toBe("none");
  // Committed in the session: the base is the commit the session began on.
  git(root, "add", "."); git(root, "commit", "-qm", "changed in the session");
  expect(run(s, "node scripts/gen.js").verdict).toBe("none");
  // Restored to the base text: the project's program again.
  put(join(root, "scripts/gen.js"), writer);
  expect(run(s, "node scripts/gen.js").verdict).toBe("none");
  // New in the session, in the project or outside every root.
  put(join(root, "scripts/new.js"), writer);
  put(join(area, "outside-writer.js"), writer);
  expect(run(s, "node scripts/new.js").verdict).toBe("none");
  expect(run(s, `node '${join(area, "outside-writer.js")}'`).verdict).toBe("none");
  put(join(root, "scripts/gated.js"), "const fs = require('node:fs');\nfs.writeFileSync('src/domain/a.ts', 'x');\n");
  expect(run(s, "node scripts/gated.js").verdict).toBe("none");
  // A new test file with literal imports of modules that do not write runs; one that imports a writer does not.
  put(join(root, "src/domain/b.test.js"), "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { a } from './a.js';\ntest('a', () => assert.equal(a, 1));\n");
  put(join(root, "src/domain/c.test.js"), "import { test } from 'node:test';\nimport { writeFileSync } from 'node:fs';\ntest('c', () => writeFileSync('src/domain/a.ts', 'x'));\n");
  expect(run(s, "node --test src/domain/b.test.js").verdict).toBe("none");
  expect(run(s, "node --test src/domain/c.test.js").verdict).toBe("none");
  // A project test file that already imports `vm`, edited in the session: it runs while it gains no sink.
  const tested = join(root, "src/domain/a.test.js"), base = readFileSync(tested, "utf8");
  put(tested, `${base}test('more', () => a === 1);\n`);
  expect(run(s, "node --test src/domain/a.test.js").verdict).toBe("none");
  put(tested, `${base}test('more', () => vm.runInNewContext('2'));\n`);
  expect(run(s, "node --test src/domain/a.test.js").verdict).toBe("none");
  put(tested, `${base}import { writeFileSync } from 'node:fs';\nwriteFileSync('src/domain/a.ts', 'x');\n`);
  expect(run(s, "node --test src/domain/a.test.js").verdict).toBe("none");
  put(tested, base);
  // An unchanged script that names a control command is still denied: only the write sink is forgiven.
  const other = repo("scripts-control");
  put(join(other, "scripts/off.js"), "require('node:child_process').execSync('pregate uninstall');\n");
  git(other, "add", "."); git(other, "commit", "-qm", "control");
  expect(onPreCommand({ session: session("claude-code", "scripts-control"), callId: "off", tool: "Bash", cwd: other, command: "node scripts/off.js" }).verdict).toBe("deny");
});

test("Claude Code SubagentStart payloads decode as the subagent's session start and reply under that event name", () => {
  const env = { grokEvent: null, projectDir: null, remote: false };
  const base = { session_id: "s", cwd: "/repo", transcript_path: "/t.jsonl", prompt_id: "p" };
  expect(claude("session-start", JSON.stringify({ ...base, hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "general-purpose" }), env))
    .toMatchObject({ kind: "session-start", cwd: "/repo", session: { id: "s", agentId: "a1", interactive: false } });
  expect(claude("session-start", JSON.stringify({ ...base, hook_event_name: "SubagentStart" }), env)).toMatchObject({ cause: "payload-unrecognized" });
  expect(claude("session-start", JSON.stringify({ ...base, hook_event_name: "SessionStart", agent_id: "a1" }), env)).toMatchObject({ cause: "payload-unrecognized" });
  expect(claude("session-start", JSON.stringify({ ...base, hook_event_name: "SessionStart", source: "startup" }), env)).toMatchObject({ kind: "session-start", session: { agentId: null } });
  const briefing = { verdict: "none", full: "PREGATE is active", compact: "", notice: "for the human", halt: false, cause: null, violations: [], warnings: [], attempt: 0, fix: null, lockHash: null, shadowed: false } as Decision;
  const reply = HARNESSES["claude-code"].encode("session-start", enabledWire(briefing), true);
  expect(reply.exit).toBe(0);
  expect(JSON.parse(reply.stdout)).toEqual({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: "PREGATE is active" } });
  // A problem with the contract is the session's notice, not a subagent's context.
  expect(HARNESSES["claude-code"].encode("session-start", enabledWire({ ...briefing, verdict: "deny" }), true)).toEqual({ stdout: "", stderr: "", exit: 0 });
  expect(JSON.parse(HARNESSES["claude-code"].encode("session-start", enabledWire(briefing)).stdout)).toEqual({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "PREGATE is active" }, systemMessage: "for the human" });
});

function change(root: string, rel: string, edit: Edit, s = session(), from: string | null = null): ProposedChange {
  return { session: s, callId: "one-call", tool: "Write", path: join(root, rel), edit, from };
}

function events(s: Session, path: string): ReturnType<typeof state.history> {
  return state.history(state.key(s), "-", state.H(pathKey(path)));
}

function whileSpied(spy: { mockRestore(): void }, body: () => void): void {
  try { body(); } finally { spy.mockRestore(); }
}

async function whileSpiedAsync(spy: { mockRestore(): void }, body: () => Promise<void>): Promise<void> {
  try { await body(); } finally { spy.mockRestore(); }
}

test("Pre, Stop and stdin scan dependency importers only when the admitted contract has import checks", async () => {
  const minimal = repo("minimal"), imports = repo("imports");
  const text = JSON.stringify({ name: "minimal", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [] });
  const result = compile(text, sourcesOf(minimal), VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  expect(result.lock.rules.filter((r) => r.check.startsWith("core/") && r.enforcement === "enforce")).toHaveLength(68);
  put(join(minimal, PRESET), text); put(join(minimal, LOCK), result.text);
  git(minimal, "add", "."); git(minimal, "commit", "-qm", "minimal contract");
  const traced = spyOn(workspace, "workspacePaths");
  await whileSpiedAsync(traced, async () => {
    const valid = { form: "full", content: "export const a = 2;\n" } as const;
    expect((await onPreEdit([change(minimal, "src/domain/a.ts", valid, session("codex", "minimal"))])).verdict).toBe("none");
    expect(traced).not.toHaveBeenCalled();
    expect((await onPreEdit([change(minimal, "src/domain/a.ts", { form: "full", content: "export const a = ;\n" },
      session("codex", "invalid"))])).cause).toBe("syntax");
    expect(traced).not.toHaveBeenCalled();
    expect((await check(minimal, { kind: "stdin", path: "src/domain/a.ts", text: valid.content })).code).toBe(0);
    expect(traced).not.toHaveBeenCalled();
    put(join(minimal, "src/domain/a.ts"), valid.content);
    expect((await onStop({ kind: "stop", session: session("codex", "minimal"), cwd: minimal, reentry: false })).verdict).toBe("none");
    expect(traced).not.toHaveBeenCalled();
    expect((await onPreEdit([change(imports, "src/domain/a.ts", valid, session("codex", "imports"))])).verdict).toBe("none");
    expect(traced).not.toHaveBeenCalled();
    expect((await onPreEdit([change(imports, "src/domain/a.ts", { form: "full", content: 'export { a } from "./a";\n' }, session("codex", "imports-graph"))])).verdict).toBe("none");
    expect(traced).toHaveBeenCalledTimes(1);
  });
});

test("shadow import rules do not scan the repository on Pre, stdin or Stop; enforced importer checks remain active", async () => {
  const root = repo("shadow-imports");
  const value = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  const admitted = lockOf(root);
  if (typeof admitted === "string") throw new Error(admitted);
  const rules = admitted.lock.rules.filter(rule => rule.impl.kind === "primitive" && ["layer-edge", "banned-import"].includes(rule.impl.primitive));
  expect(rules.length).toBeGreaterThan(0);
  value.overrides ??= {};
  for (const rule of rules) value.overrides[rule.id] = { enforcement: "shadow" };
  const text = JSON.stringify(value);
  const compiled = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  put(join(root, PRESET), text); put(join(root, LOCK), compiled.text);
  git(root, "add", "."); git(root, "commit", "-qm", "shadow import policy");
  const s = session("codex", "shadow-imports");
  const traced = spyOn(workspace, "workspacePaths");
  await whileSpiedAsync(traced, async () => {
    const content = "export const a = 2;\n";
    expect((await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content }, s)])).verdict).toBe("none");
    expect((await check(root, { kind: "stdin", path: "src/domain/a.ts", text: content })).code).toBe(0);
    expect((await check(root, { kind: "stdin", path: "README.md", text: "One line\n" })).code).toBe(0);
    put(join(root, "src/domain/a.ts"), content);
    expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("none");
    expect(traced).not.toHaveBeenCalled();
  });
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("%s inspection preserves protection without compiling the catalog", (harness) => {
  const root = repo();
  const s = session(harness);
  const traced = spyOn(compiler, "compile");
  whileSpied(traced, () => {
    for (const command of ["git status --short && ls src", "git diff --stat", "rg --files src", "pregate status --json", `cat '${join(root, PRESET)}'`]) {
      expect(onPreCommand({ session: s, callId: "inspect", tool: "Bash", cwd: root, command }).verdict).toBe("none");
    }
    expect(traced).not.toHaveBeenCalled();
    expect(state.roots(state.key(s))).toEqual([root]);
    for (const command of [`printf changed > '${join(root, PRESET)}'`, "pregate disable --yes"]) {
      expect(onPreCommand({ session: s, callId: "protected", tool: "Bash", cwd: root, command }).verdict).toBe("deny");
    }
    expect(onPreCommand({ session: s, callId: "no-verify", tool: "Bash", cwd: root, command: "git commit --no-verify" }).verdict).toBe("none");
    expect(traced).not.toHaveBeenCalled();
    const forged = JSON.parse(readFileSync(join(root, LOCK), "utf8"));
    forged.scope = ["unrelated/**"];
    put(join(root, LOCK), lockText(forged));
    expect(onPreCommand({ session: s, callId: "write", tool: "Bash", cwd: root,
      command: `echo changed > '${join(root, "src/domain/a.ts")}'` }).verdict).toBe("none");
    expect(traced).toHaveBeenCalledTimes(1);
    // A lock file that does not match the preset is not admitted: the preset is compiled instead.
    const loaded = lockOf(root);
    if (typeof loaded === "string") throw new Error(loaded);
    expect(loaded.lock.scope).toEqual(JSON.parse(readFileSync(join(root, PRESET), "utf8")).scope);
    expect(loaded.lock.scope).not.toEqual(["unrelated/**"]);
  });
});

test("inspection protects preset source folders and symlink targets with an invalid contract", () => {
  const root = repo();
  const folder = join(root, "policies");
  put(join(folder, "check.json"), "{}");
  symlinkSync(folder, join(root, "policy-link"));
  const preset = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  preset.sources.push({ ns: "custom", kind: "path", path: "policies" });
  put(join(root, PRESET), JSON.stringify(preset));
  put(join(root, LOCK), "invalid");
  const traced = spyOn(compiler, "compile");
  whileSpied(traced, () => {
    for (const path of [join(folder, "check.json"), join(root, "policy-link/check.json")]) {
      expect(onPreCommand({ session: session(), callId: "custom", tool: "Bash", cwd: root, command: `cat '${path}'` }).cause).toBe("protected-path");
    }
    expect(traced).not.toHaveBeenCalled();
    expect(onPreCommand({ session: session(), callId: "inspect", tool: "Bash", cwd: root, command: "git status" }).verdict).toBe("none");
    expect(onPreCommand({ session: session(), callId: "write", tool: "Bash", cwd: root,
      command: `echo changed > '${join(root, "src/domain/a.ts")}'` }).verdict).toBe("none");
  });
});

test("shell scope admission remains per-root for sibling and nested destinations", () => {
  const root = repo();
  const sibling = repo("sibling");
  const nested = repo("repo/nested");
  const s = session();
  for (const destination of [sibling, nested]) {
    expect(onPreCommand({ session: s, callId: "other-root", tool: "Bash", cwd: root,
      command: `echo changed > '${join(destination, "src/domain/a.ts")}'` }).verdict).toBe("none");
  }
  expect(state.roots(state.key(s)).sort()).toEqual([root, sibling, nested].sort());
  const forged = JSON.parse(readFileSync(join(sibling, LOCK), "utf8"));
  forged.scope = [];
  put(join(sibling, LOCK), lockText(forged));
  expect(onPreCommand({ session: s, callId: "forged-sibling", tool: "Bash", cwd: root,
    command: `echo changed > '${join(sibling, "other.txt")}'` }).verdict).toBe("none");
});

test.each(["codex", "agy", "cursor"] as const)("%s pending review without enable does not enforce the directory", async harness => {
  const root = canonical(join(area, "initial"));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  const proposal = proposeContract({ root, lockText: "{}", baseline: state.sha256(""), writes: [] });
  const digest = state.sha256(JSON.stringify(proposal));
  const s = session(harness);
  const command = { session: s, callId: "initial-approval", tool: "Bash", cwd: join(root, "src"), command: `pregate approve --yes --digest ${digest}` };
  expect(inert({ kind: "pre-command", command })).toBe(true);
  expect(onPreCommand(command).verdict).toBe("none");
  for (const script of [`env pregate approve --yes --digest ${digest}`, `sh -c 'pregate approve --yes --digest ${digest}'`, "pregate init --yes", "rm -rf .pregate",
    "P=pre; ${P}gate approve --yes", "$(echo pregate) approve --yes", "pregate approve --preview", `echo ordinary > '${join(root, "src/new.ts")}'`]) {
    const call = { ...command, cwd: root, command: script };
    expect(inert({ kind: "pre-command", command: call }), script).toBe(true);
    expect(onPreCommand(call).verdict, script).toBe("none");
  }
  const write = change(root, PRESET, { form: "full", content: "{}" }, s);
  expect(inert({ kind: "pre-edit", changes: [write] })).toBe(true);
  expect((await onPreEdit([write])).verdict).toBe("none");
  expect(await onPreEdit([change(root, "src/a.ts", { form: "full", content: "export const a = ;" }, s)])).toMatchObject({ verdict: "none", cause: null });
  expect(readProposal(root)).toEqual(proposal);
  expect(enabled(root)).toBe(false);
  expect(existsSync(join(root, PRESET))).toBe(false);
  expect(state.roots(state.key(s))).toEqual([]);
  const malformed: Rejected = { cause: "payload-unrecognized", kind: "pre-command", reentry: false, session: null, dirs: [join(root, "src")] };
  expect(inert(malformed)).toBe(false);
});

function pathScripts(bin: string): void {
  const orcaName = WINDOWS ? "orca.cmd" : "orca";
  const browserName = WINDOWS ? "agent-browser.cmd" : "agent-browser";
  put(join(bin, orcaName), "#!/bin/bash\nELECTRON=\"/Applications/Orca.app/Contents/MacOS/Orca\"\nexec \"$ELECTRON\" \"$@\"\n");
  put(join(bin, browserName), "#!/usr/bin/env node\nconst { spawn } = require(\"node:child_process\");\nspawn(process.execPath, [\"-e\", \"console.log(1)\"]);\n");
  if (!WINDOWS) {
    chmodSync(join(bin, orcaName), 0o755);
    chmodSync(join(bin, browserName), 0o755);
  }
  process.env.PATH = `${bin}${delimiter}${process.env.PATH ?? ""}`;
  process.env.Path = process.env.PATH;
}

test("a project that was never enabled allows PATH scripts, skill reads, and a project write sink", () => {
  const root = canonical(join(area, "inactive"));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  git(root, "init", "-q");
  put(join(root, PRESET), "{}\n");
  proposeContract({ root, lockText: "{}", baseline: state.sha256(""), writes: [] });
  expect(enabled(root)).toBe(false);
  expect(pendingRoot(root)).toBe(root);
  pathScripts(join(area, "bin"));
  expect(commandOnPath("orca")?.replaceAll("\\", "/")).toContain("/bin/orca");
  expect(commandOnPath("agent-browser")?.replaceAll("\\", "/")).toContain("/bin/agent-browser");
  put(join(root, "scripts/write.js"), "const fs = require(\"node:fs\");\nfs.writeFileSync(\"out.txt\", \"x\\n\");\n");
  const skill = join(process.env.HOME!, ".agents/skills/pregate/SKILL.md");
  put(skill, "# pregate\n");
  const s = session("claude-code", "inactive");
  const command = (text: string) => onPreCommand({ session: s, callId: text, tool: "Bash", cwd: root, command: text });
  expect(command("orca console").verdict).toBe("none");
  expect(command("orca network").verdict).toBe("none");
  expect(command("agent-browser open").verdict).toBe("none");
  expect(command(`cat -- '${skill}'`).verdict).toBe("none");
  expect(command("node scripts/write.js").verdict).toBe("none");
  expect(findings(root)).toEqual([]);
});

test("a pending batch does not enforce a project that was never enabled", () => {
  const root = canonical(join(area, "batched"));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  git(root, "init", "-q");
  put(join(root, PRESET), "{}\n");
  proposeBatch([{ root, digest: "a".repeat(64) }]);
  expect(pendingRoot(root)).toBeNull();
  expect(projectUpdateMention("node scripts/write.js")).toBe(true);
  expect(enabled(root)).toBe(false);
  pathScripts(join(area, "batch-bin"));
  put(join(root, "scripts/write.js"), "const fs = require(\"node:fs\");\nfs.writeFileSync(\"out.txt\", \"x\\n\");\n");
  const s = session("claude-code", "batched");
  const command = (text: string) => onPreCommand({ session: s, callId: text, tool: "Bash", cwd: root, command: text });
  expect(command("orca console").verdict).toBe("none");
  expect(command("node scripts/write.js").verdict).toBe("none");
  expect(findings(root)).toEqual([]);
});

test("pregate uninstall is not denied in a repository that was never enabled", () => {
  const root = canonical(join(area, "nopreset"));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  git(root, "init", "-q");
  proposeContract({ root, lockText: "{}", baseline: state.sha256(""), writes: [] });
  const allowed = onPreCommand({ session: session("claude-code", "nopreset"), callId: "uninstall", tool: "Bash", cwd: root, command: "pregate uninstall" });
  expect(allowed.verdict).toBe("none");
  expect(findings(root)).toEqual([]);
});

test("initial review discovery stops at a nested repository and expires without granting consent", () => {
  const root = canonical(join(area, "initial"));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  proposeContract({ root, lockText: "{}", baseline: state.sha256(""), writes: [] });
  expect(pendingRoot(join(root, "src"))).toBe(root);
  mkdirSync(join(root, "nested/.git"), { recursive: true });
  expect(pendingRoot(join(root, "nested"))).toBeNull();
  const now = Date.now();
  const clock = spyOn(Date, "now").mockReturnValue(now + PENDING_MS + 1);
  whileSpied(clock, () => {
    expect(pendingRoot(join(root, "src"))).toBeNull();
    expect(inert({ kind: "pre-command", command: { session: session("codex"), callId: "expired", tool: "Bash", cwd: root, command: "pregate approve --yes" } })).toBe(true);
    expect(enabled(root)).toBe(false);
  });
});

test("a directory without git fails check; the hook and Stop note it and do not block", async () => {
  const root = canonical(join(area, "standalone"));
  put(join(root, "src/domain/a.ts"), "export const a = 1;\n");
  preset(root); enable(root);
  const s = session();
  const start = onSessionStart({ kind: "session-start", session: s, cwd: root });
  expect(start.notice ?? "").toContain("git init");
  const checked = await check(root, { kind: "stdin", path: "src/domain/a.ts", text: "export const a = 2;\n" });
  expect(checked.code).toBe(1);
  expect(checked.text).toContain("git init");
  const pre = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)]);
  expect(pre).toMatchObject({ verdict: "none", halt: false, cause: "git-not-repository" });
  expect(pre.full).toContain("PREGATE NOTE git-not-repository src/domain/a.ts");
  expect(pre.full).toContain("Not blocked.");
  expect(inert({ kind: "stop", session: s, cwd: root, reentry: false })).toBe(false);
  const stop = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(stop).toMatchObject({ verdict: "none", halt: false, cause: "git-not-repository" });
  expect(stop.notice).toContain("PREGATE NOTE git-not-repository");
  expect(stop.notice).toContain("Not blocked.");
});

test.each([{ exclude: [] }, { exclude: [".pregate/**"] }])("Stop does not treat an admitted untracked contract as source code (excludes %j)", async ({ exclude }) => {
  const root = repo("new-contract", false);
  const p = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  p.scope = { include: ["**"], exclude };
  const text = JSON.stringify(p);
  put(join(root, PRESET), text);
  const result = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  put(join(root, LOCK), result.text);
  expect(result.text).toContain("eslint-disable");
  const s = session("agy");
  expect(onPreCommand({ session: s, callId: "first-contact", tool: "Bash", cwd: root, command: "git status" }).verdict).toBe("none");
  const stopped = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(stopped.verdict).toBe("none");
  expect(stopped.violations).toEqual([]);
  expect(stopped.stopIncomplete).toBeUndefined();
  expect((await check(root, { kind: "tree" })).code).toBe(0);
  expect(readFileSync(join(root, PRESET), "utf8")).toBe(text);
  expect(readFileSync(join(root, LOCK), "utf8")).toBe(result.text);

  // These files remain protected. Inspection uses the dedicated read-only command.
  const blocked = onPreCommand({ session: s, callId: "policy-precheck", tool: "Bash", cwd: root,
    command: `${launcher()} check --stdin --path .pregate/preset.json --format agent < .pregate/preset.json` });
  expect(blocked.cause).toBe("protected-path");
  expect(blocked.verdict).toBe("deny");
  expect(blocked.full).toContain("PREGATE DENY protected-path");
  expect(blocked.full).toContain("Tell the user the change you want");
  expect(onPreCommand({ session: s, callId: "policy-show", tool: "Bash", cwd: root, command: "pregate preset show" }).verdict).toBe("none");

  // No folder-wide exception: source still has the suppression/placement guard.
  const source = exclude.length ? ".pregate/hidden.ts" : "src/domain/suppression.ts";
  put(join(root, source), "// eslint-disable-next-line\nexport const value = 1;\n");
  const breach = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(breach.verdict).toBe("deny");
  expect(breach.violations).toContainEqual(expect.objectContaining({ path: source,
    rule: exclude.length ? "core/EVA-SCOPE-001" : "core/EVA-SUP-001" }));
  rmSync(join(root, source));

  // Modified lock bytes are not admitted: Stop judges from the preset, and check still rejects them.
  put(join(root, LOCK), result.text.replace("eslint-disable", "eslint-allow"));
  expect(await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).toMatchObject({ verdict: "none", cause: null, violations: [] });
  const modified = lockOf(root);
  if (typeof modified === "string") throw new Error(modified);
  expect(lockText(modified.lock)).toBe(result.text);
  const strict = await check(root, { kind: "tree" });
  expect(strict.code).toBe(1);
  expect(strict.text).toContain("does not match the preset");
  put(join(root, LOCK), result.text);
  put(join(root, PRESET), text.replace('"include":["**"]', '"include":["src/**"]'));
  const stale = session("agy", "stale-preset");
  onPreCommand({ session: stale, callId: "inspect-stale", tool: "Bash", cwd: root, command: "git status" });
  expect(await onStop({ kind: "stop", session: stale, cwd: root, reentry: false })).toMatchObject({ verdict: "none", cause: null });
  // A lock behind the preset is replaced by the preset's compile.
  const behind = lockOf(root);
  if (typeof behind === "string") throw new Error(behind);
  expect(behind.lock.scope.include).toEqual(["src/**"]);
});

test("a default-core session reports unbound requirements without blocking a valid edit or Stop", async () => {
  const root = canonical(join(area, "progressive"));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  git(root, "init", "-q");
  git(root, "add", ".");
  git(root, "commit", "-qm", "base");
  const text = JSON.stringify({ name: "progressive", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }], methodologies: [] });
  const compiled = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  put(join(root, PRESET), text); put(join(root, LOCK), compiled.text); enable(root);
  const s = session();
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  expect((await onPreEdit([change(root, "src/a.ts", { form: "full", content: "export const a = 2;\n" }, s)])).verdict).toBe("none");
  put(join(root, "src/a.ts"), "export const a = 2;\n");
  const completed = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(completed.verdict).toBe("none"); expect(completed.full).not.toContain("UNVERIFIED");
  expect(completed.violations).toEqual([]); expect(completed.stopIncomplete).toBeUndefined();
  const repeated = await onStop({ kind: "stop", session: { ...s, turnId: "another-turn" }, cwd: root, reentry: false });
  expect(repeated.verdict).toBe("none"); expect(repeated.full).not.toContain("UNVERIFIED");
  expect(repeated.notice ?? "").not.toContain("UNVERIFIED");
  expect(readFileSync(join(root, PRESET), "utf8")).toBe(text);
  expect(compiled.lock.rules).toHaveLength(68);
  put(join(root, "src/a.ts"), "export const a = ;\n");
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).cause).toBe("syntax");
});

test("real edit, command and Stop decisions retain correlation, classified failures and evaluation time", async () => {
  const root = repo();
  const s = session();
  const path = join(root, "src/domain/a.ts");
  expect((await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)])).verdict).toBe("none");
  expect(onPreCommand({ session: s, callId: "command", tool: "Bash", cwd: root, command: "git status" }).verdict).toBe("none");
  const invalid = await onPreEdit([{ ...change(root, "src/domain/a.ts", { form: "full", content: "export const a = ;\n" }, s), callId: "invalid-edit" }]);
  expect(invalid).toMatchObject({ verdict: "none", halt: false, cause: "syntax" });
  expect(invalid.full).toContain("PREGATE WARN syntax src/domain/a.ts");
  const blocked = onPreCommand({ session: s, callId: "blocked-command", tool: "Bash", cwd: root, command: "echo x > .pregate/preset.json" });
  expect(blocked.verdict).toBe("deny");
  expect(blocked.cause).toBe("protected-path");
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("none");
  const recorded = [...events(s, path), ...state.history(state.key(s), "-", "-"), ...state.history(state.key(s), "-", "stop")];
  expect(recorded.map((e) => e.kind).sort()).toEqual(["pre-command", "pre-command", "pre-edit", "pre-edit", "stop"]);
  for (const event of recorded) {
    expect(event.root).toBe(root);
    expect(event.turn).toBe("turn");
    expect(event.callId).not.toBe("");
    expect(event.verdict).toBe(event.callId === "blocked-command" ? "deny" : "none");
    expect(event.form).toBe(event.callId === "invalid-edit" ? invalid.cause : event.callId === "blocked-command" ? blocked.cause : null);
    expect(Number.isFinite(event.evaluationMs)).toBe(true);
    expect(event.evaluationMs!).toBeGreaterThanOrEqual(0);
  }
  const summary = JSON.parse(report(["--json", "--repo", root]).text);
  expect(summary.timing.measured).toBe(5);
  expect(summary.timing.unmeasured).toBe(0);
});

test.each(["stdin", "staged", "base"] as const)("affected baseline %s batches importer objects from the exact Git revision", async mode => {
  const root = repo();
  put(join(root, "src/domain/value.ts"), "export const value = 1;\n");
  put(join(root, "src/infra/value.ts"), "export const value = 2;\n");
  put(join(root, "src/domain/barrel.ts"), 'export * from "./value";\n');
  for (let index = 0; index < 24; index++) put(join(root, `src/domain/use${index}.ts`), 'import { value } from "./barrel";\nexport const used = value;\n');
  git(root, "add", "."); git(root, "commit", "-qm", "affected baseline");
  const revision = mode === "base" ? Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root, stdout: "pipe" }).stdout.toString().trim() : "HEAD";
  const text = 'export * from "../infra/value";\n';
  if (mode !== "stdin") { put(join(root, "src/domain/barrel.ts"), text); git(root, "add", "src/domain/barrel.ts"); }
  // A disk repair must not hide the bad staged tree.
  if (mode === "staged") put(join(root, "src/domain/barrel.ts"), 'export * from "./value";\n');
  const traced = spyOn(gitHost, "catFileBatch");
  await whileSpiedAsync(traced, async () => {
    const result = await check(root, mode === "stdin" ? { kind: "stdin", path: "src/domain/barrel.ts", text } : mode === "staged" ? { kind: "staged" } : { kind: "base", sha: revision });
    expect(result.code).toBe(1); expect(result.text).toContain("Also at: src/domain/use0.ts:1"); expect(result.text).toContain("…+17");
    const batches = traced.mock.calls.filter(([, objects]) => objects.some(object => object.startsWith(`${revision}:./src/domain/use`)));
    expect(batches).toHaveLength(1);
    expect(batches[0]![0]).toBe(root); expect(batches[0]![1]).toHaveLength(24);
  });
});

test.each(["null batch", "missing importer", "deadline"] as const)("affected baseline preserves %s from Git", async failure => {
  const root = repo();
  put(join(root, "src/domain/value.ts"), "export const value = 1;\n");
  put(join(root, "src/infra/value.ts"), "export const value = 2;\n");
  put(join(root, "src/domain/barrel.ts"), 'export * from "./value";\n');
  put(join(root, "src/domain/use.ts"), 'import { value } from "./barrel";\n');
  git(root, "add", "."); git(root, "commit", "-qm", "Git baseline failures");
  const original = gitHost.catFileBatch, traced = spyOn(gitHost, "catFileBatch").mockImplementation((dir, objects) => {
    if (!objects.includes("HEAD:./src/domain/use.ts")) return original(dir, objects);
    if (failure === "deadline") throw new Error("Git exceeded its 5000 ms command deadline.");
    return failure === "null batch" ? null : objects.map(() => null);
  });
  await whileSpiedAsync(traced, async () => {
    const checked = check(root, { kind: "stdin", path: "src/domain/barrel.ts", text: 'export * from "../infra/value";\n' });
    if (failure === "deadline") await expect(checked).rejects.toThrow("5000 ms command deadline");
    else { const result = await checked; expect(result.code).toBe(1); expect(result.text).toContain("src/domain/use.ts"); }
  });
});

test("a missing importer baseline does not halt the turn, and the layer rule still denies the edit", async () => {
  const root = repo(), s = session();
  put(join(root, "src/domain/value.ts"), "export const value = 1;\n");
  put(join(root, "src/infra/value.ts"), "export const value = 2;\n");
  put(join(root, "src/domain/barrel.ts"), 'export * from "./value";\n');
  put(join(root, "src/domain/use.ts"), 'import { value } from "./barrel";\nexport const used = value;\n');
  git(root, "add", "."); git(root, "commit", "-qm", "affected snapshot");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const original = state.beforeTexts, traced = spyOn(state, "beforeTexts").mockImplementation((sid, snapshot, rels) => rels.includes("src/domain/use.ts") ? "snapshot-missing" : original(sid, snapshot, rels));
  await whileSpiedAsync(traced, async () => {
    const decision = await onPreEdit([change(root, "src/domain/barrel.ts", { form: "full", content: 'export * from "../infra/value";\n' }, s)]);
    expect(traced.mock.calls.some(([, , rels]) => rels.includes("src/domain/use.ts"))).toBe(true);
    expect(decision.verdict).toBe("deny"); expect(decision.halt).toBe(false); expect(decision.cause).toBeNull();
    expect(decision.violations).toContainEqual(expect.objectContaining({ rule: "architecture/CA-DEP-001" }));
  });
});

test("first-touch Pre batches its own immutable baseline with discovered dependency baselines", async () => {
  const root = repo();
  put(join(root, "src/domain/value.ts"), "export const value = 1;\n");
  const before = "import { value } from './value';\nexport const a = value;\n";
  put(join(root, "src/domain/a.ts"), before);
  git(root, "add", "."); git(root, "commit", "-qm", "dependency baseline");
  const s = session();
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const traced = spyOn(Bun, "spawnSync");
  await whileSpiedAsync(traced, async () => {
    const d = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: before + "export const b = value;\n" }, s)]);
    expect(d.verdict).toBe("none");
    const calls: readonly unknown[] = traced.mock.calls;
    const queries = calls.flatMap((call) => {
      if (!Array.isArray(call) || !Array.isArray(call[0]) || call[0][0] !== "git" || call[0][1] !== "cat-file" || call[0][2] !== "--batch") return [];
      const options: unknown = call[1];
      return typeof options === "object" && options !== null && "stdin" in options && options.stdin instanceof Uint8Array ? [options.stdin] : [];
    });
    expect(queries).toHaveLength(1);
    const objects = new TextDecoder().decode(queries[0]!);
    expect(objects).toContain(":./src/domain/a.ts\n");
    expect(objects).toContain(":./src/domain/value.ts\n");
    const snap = state.snapshot(state.key(s), root);
    if (snap === null || snap === "missing") throw new Error("Missing test snapshot");
    expect(state.beforeText(state.key(s), snap, "src/domain/a.ts")).toBe(before);
    expect(state.beforeText(state.key(s), snap, "src/domain/value.ts")).toBe("export const value = 1;\n");
  });
});

test.each(["export const a = 3;\n", "export const a = ;\n"])("a lost dirty baseline is a snapshot-missing note on deferred Pre, not a halt, for %s", async (content) => {
  const root = repo();
  put(join(root, "src/domain/a.ts"), "export const a = 2;\n");
  const s = session();
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const snap = state.snapshot(state.key(s), root);
  if (snap === null || snap === "missing") throw new Error("Missing test snapshot");
  rmSync(join(state.sessionDir(state.key(s)), "blobs", snap.dirty["src/domain/a.ts"]!));
  const d = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content }, s)]);
  expect(d.verdict).toBe("none"); expect(d.halt).toBe(false); expect(d.cause).toBe("snapshot-missing");
  expect(d.full).toContain("PREGATE NOTE snapshot-missing src/domain/a.ts");
  expect(d.full).toContain("Not blocked.");
  expect(events(s, join(root, "src/domain/a.ts")).at(-1)).toMatchObject({ verdict: "none", form: "snapshot-missing" });
});

test("ordinary check baselines that match a cause name remain source text", async () => {
  const root = repo();
  put(join(root, "src/domain/a.ts"), "syntax");
  git(root, "add", "."); git(root, "commit", "-qm", "cause-named expression");
  put(join(root, "src/domain/a.ts"), "export const a = 2;\n");
  expect((await check(root, { kind: "base", sha: "HEAD" })).code).toBe(0);
  git(root, "add", "src/domain/a.ts");
  expect((await check(root, { kind: "staged" })).code).toBe(0);
});

test("an alias remap is blocked through Pre, Stop, CI and the staged tree without editing its importer", async () => {
  const root = repo();
  put(join(root, "src/infra/a.ts"), "export const a = 2;\n");
  put(join(root, "src/domain/use.ts"), 'import { a } from "@shared";\nexport const used = a;\n');
  const config = (path: string) => JSON.stringify({ compilerOptions: { paths: { "@shared": [path] } } });
  put(join(root, "tsconfig.json"), config("src/domain/a.ts"));
  git(root, "add", "."); git(root, "commit", "-qm", "alias baseline");
  const proposedConfig = await check(root, { kind: "stdin", path: "tsconfig.json", text: config("src/infra/a.ts") });
  expect(proposedConfig.code).toBe(1);
  expect(proposedConfig.text).toContain("CA-DEP-001");
  const s = session();
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const after = config("src/infra/a.ts");
  expect((await onPreEdit([change(root, "tsconfig.json", { form: "full", content: after }, s)])).violations.some((v) => v.rule === "architecture/CA-DEP-001")).toBe(true);
  put(join(root, "tsconfig.json"), after);
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("deny");
  expect((await check(root, { kind: "base", sha: "HEAD" })).code).toBe(1);
  git(root, "add", "tsconfig.json");
  put(join(root, "tsconfig.json"), config("src/domain/a.ts"));
  expect((await check(root, { kind: "staged" })).code).toBe(1);
});

test("changed barrel exports reevaluate unchanged importers", async () => {
  const root = repo();
  put(join(root, "src/infra/a.ts"), "export const a = 2;\n");
  put(join(root, "src/domain/barrel.ts"), 'export { a } from "./a";\n');
  put(join(root, "src/domain/use.ts"), 'import { a } from "./barrel";\nexport const used = a;\n');
  git(root, "add", "."); git(root, "commit", "-qm", "barrel baseline");
  onSessionStart({ kind: "session-start", session: session(), cwd: root });
  expect((await onPreEdit([change(root, "src/domain/barrel.ts", { form: "full", content: 'export { a } from "../infra/a";\n' })])).verdict).toBe("deny");
  put(join(root, "src/domain/barrel.ts"), 'export { a } from "../infra/a";\n');
  expect((await check(root, { kind: "base", sha: "HEAD" })).text).toContain("src/domain/use.ts");
});

test("a changed physical barrel is reviewed through a symlink importer path", async () => {
  const root = repo();
  const value = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  value.overrides = { ...value.overrides, "architecture/CA-DEP-001": { params: { paths: ["src/domain/use.ts"] } } };
  const compiled = compile(JSON.stringify(value), sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  put(join(root, PRESET), JSON.stringify(value)); put(join(root, LOCK), compiled.text);
  put(join(root, "src/infra/a.ts"), "export const a = 2;\n");
  put(join(root, "src/shared/barrel.ts"), 'export { a } from "../domain/a";\n');
  symlinkSync("../shared/barrel.ts", join(root, "src/domain/link.ts"));
  put(join(root, "src/domain/use.ts"), 'import { a } from "./link";\nexport const used = a;\n');
  git(root, "add", "."); git(root, "commit", "-qm", "symlink baseline");
  const s = session();
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const next = 'export { a } from "../infra/a";\n';
  const decision = await onPreEdit([change(root, "src/shared/barrel.ts", { form: "full", content: next }, s)]);
  expect(decision.verdict).toBe("deny");
  expect(decision.violations.some(violation => violation.path === "src/domain/use.ts")).toBe(true);
});

test("real filesystem shell checks do not canonicalize long Git or PR descriptions as filenames", () => {
  const root = repo();
  const body = "A reviewed change.\n".repeat(80) + "The description refers to .pregate/preset.json and --no-verify.";
  const s = session();
  const command = (text: string) => ({ session: s, callId: state.H(text), tool: "Bash", cwd: root, command: text });
  for (const text of [`git commit -m '${body}'`, `gh pr create --body '${body}'`, `gh pr create --body "$(cat <<'EOF'\n${body}\nEOF\n)"`]) {
    expect(onPreCommand(command(text)).verdict).toBe("none");
  }
  expect(onPreCommand(command(`git commit -m '${body}' --no-verify`)).verdict).toBe("none");
  for (const count of [255, 256, 4096]) expect(onPreCommand(command(`echo '${"a".repeat(count)}'`)).verdict).toBe("none");
  expect(onPreCommand(command(`unknown '.pregate/${"a".repeat(500)}'`)).cause).toBe("protected-path");
  expect(onPreCommand(command(`echo x > ${"a".repeat(500)}`)).verdict).toBe("none");
  expect(onPreCommand(command("unknown 'null\0text'" )).cause).toBe("protected-path");
  expect(onPreCommand(command('cat ".pregate/message with spaces"')).verdict).toBe("deny");
});

test("D28: a clone is inert until locally enabled; a worktree of a consenting repository is protected until disabled itself", async () => {
  const root = repo();
  const worktree = canonical(join(area, "worktree"));
  const clone = canonical(join(area, "clone"));
  git(root, "-c", "core.autocrlf=true", "worktree", "add", "-q", worktree, "-b", "consent-test");
  git(root, "-c", "core.autocrlf=true", "clone", "-q", root, clone);
  for (const dir of [worktree, clone]) {
    expect(readFileSync(join(dir, LOCK), "utf8")).toContain("\r\n");
    const c = change(dir, "src/domain/bad.ts", { form: "full", content: "export const bad = ;" }, session("claude-code", state.H(dir)));
    expect(enabled(dir)).toBe(dir === worktree);
    if (dir === clone) {
      expect(await onPreEdit([c])).toMatchObject({ verdict: "none", cause: null });
      expect(onPreCommand({ session: c.session, callId: "shell", tool: "Bash", cwd: dir, command: "pregate uninstall" }).verdict).toBe("none");
      enable(dir);
    }
    expect(enabled(dir)).toBe(true);
    expect(await onPreEdit([c])).toMatchObject({ verdict: "none", cause: "syntax" });
    disable(dir);
    expect(enabled(dir)).toBe(false);
    expect(await onPreEdit([c])).toMatchObject({ verdict: "none", cause: null });
  }
  // A worktree disable withdraws repository consent. The checkout enabled by name stays enabled,
  // and a worktree added afterwards does not inherit. Project disable turns those off too.
  expect(enabled(root)).toBe(true);
  const other = canonical(join(area, "worktree-2"));
  git(root, "worktree", "add", "-q", other, "-b", "consent-test-2");
  expect(enabled(other)).toBe(false);
  expect(enabled(worktree)).toBe(false);
  enable(root);
  expect(enabled(other)).toBe(true);
  expect(enabled(worktree)).toBe(false);
  disableProject(root);
  expect(enabled(root)).toBe(false);
  expect(enabled(other)).toBe(false);
  expect(enabled(worktree)).toBe(false);
  enable(root);
  expect(enabled(root)).toBe(true);
  expect(enabled(other)).toBe(true);
  expect(enabled(worktree)).toBe(false);
});

test("a disabled worktree blocks nothing, including when a path cannot be resolved", () => {
  const root = repo("protect-fails");
  const kept = repo("protect-kept");
  disable(root);
  const s = session("claude-code", "protect-fails");
  onSessionStart({ kind: "session-start", session: s, cwd: kept });
  for (const command of ["git commit --no-verify -m x", "pregate approve --yes", "pregate enable --yes", "pregate uninstall", `echo x > '${join(root, ".pregate/preset.json")}'`]) {
    const decision = onPreCommand({ session: s, callId: command, tool: "Bash", cwd: root, command });
    expect(decision.verdict, command).toBe("none");
    expect(decision.cause, command).toBeNull();
  }
  const intoKept = onPreCommand({ session: s, callId: "sibling", tool: "Bash", cwd: root, command: `echo x > '${join(kept, "src/domain/a.ts")}'` });
  expect(intoKept.verdict).toBe("none");
  const target = join(root, "unresolved");
  const key = pathKey(target);
  const original = disk.canonical;
  const traced = spyOn(disk, "canonical").mockImplementation((abs: string) => {
    const asked = pathKey(abs);
    if (asked === key || asked.startsWith(`${key}/`)) throw new Error(`${abs}: too many symbolic links`);
    return original(abs);
  });
  try {
    const allowed = onPreCommand({ session: s, callId: "unresolved", tool: "Bash", cwd: root, command: `echo changed > '${target}'` });
    expect(allowed.verdict).toBe("none");
    expect(allowed.cause).toBeNull();
    expect(traced).toHaveBeenCalled();
  } finally {
    traced.mockRestore();
  }
  expect(explicitlyDisabled(root)).toBe(true);
  const reported = statusText(protectionStatus(root));
  expect(reported).toContain("disabled for this worktree (branch ");
  expect(reported).toContain("This worktree is disabled. Pre-command and pre-edit do not block it.");
});

test("a project disable blocks nothing and status names the project", () => {
  const root = repo("project-off");
  disableProject(root);
  expect(explicitlyDisabled(root)).toBe(true);
  expect(enabled(root)).toBe(false);
  const s = session("claude-code", "project-off");
  for (const command of ["pregate approve --yes", "pregate enable --yes", "git commit --no-verify -m x"]) {
    const decision = onPreCommand({ session: s, callId: command, tool: "Bash", cwd: root, command });
    expect(decision.verdict, command).toBe("none");
  }
  const text = statusText(protectionStatus(root));
  expect(text).toContain("disabled for this project");
  expect(text).toContain("This project is disabled. Pre-command and pre-edit do not block it.");
  expect(text).not.toContain("this worktree");
  disable(root);
  const both = statusText(protectionStatus(root));
  expect(both).toContain("disabled for this project and this worktree");
  expect(both).toContain("This project and this worktree are disabled. Pre-command and pre-edit do not block it.");
});

test("an agent's isolated worktree inside the project is protected by its own contract, never reported as the project's stale lock", async () => {
  const root = repo("isolated");
  const s = session("claude-code", "isolated");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  expect((await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)])).verdict).toBe("none");
  const tree = canonical(join(root, ".claude/worktrees/agent-1"));
  git(root, "worktree", "add", "-q", tree, "-b", "agent-1");
  const agent = { ...s, agentId: "agent-1" };
  expect((await onPreEdit([change(tree, "src/domain/b.ts", { form: "full", content: "export const b = 1;\n" }, agent)])).verdict).toBe("none");
  expect((await onPreEdit([change(tree, "src/domain/b.ts", { form: "full", content: "export const b = ;\n" }, agent)])).cause).toBe("syntax");
  expect(onPreCommand({ session: agent, callId: "ls", tool: "Bash", cwd: tree, command: "git status" }).verdict).toBe("none");
  disable(tree);
  expect(await onPreEdit([change(tree, "src/domain/b.ts", { form: "full", content: "export const b = ;\n" }, agent)])).toMatchObject({ verdict: "none", cause: null });
  expect(onPreCommand({ session: agent, callId: "ls-2", tool: "Bash", cwd: tree, command: "git status" }).verdict).toBe("none");
  put(join(tree, "src/domain/b.ts"), "export const b = ;\n");
  git(root, "worktree", "remove", "--force", tree);
  expect(await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).toMatchObject({ verdict: "none", cause: null });
});

test.each(["claude-code", "codex"] as const)("%s subagents: child checks are scoped and the parent's existing backstop is retained, as notes", async (harness) => {
  const root = repo(`subagents-${harness}`);
  const parent = session(harness, `subagents-${harness}`);
  const agent = { ...parent, agentId: "worker" };
  let turn = 0;
  const stop = (s: Session) => onStop({ kind: "stop", session: { ...s, turnId: `scope-${++turn}` }, cwd: root, reentry: false });
  onSessionStart({ kind: "session-start", session: parent, cwd: root });
  expect((await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, agent)])).verdict).toBe("none");
  put(join(root, "src/domain/a.ts"), "export const a = ;\n");
  // Nothing blocks: the cause tells whose Stop judged the file. Claude Code leaves a running child's file to the child.
  expect(await stop(parent)).toMatchObject({ verdict: "none", cause: harness === "codex" ? "syntax" : null });
  expect(await stop({ ...parent, agentId: "reader" })).toMatchObject({ verdict: "none", cause: null });
  const child = await stop(agent);
  expect(child).toMatchObject({ verdict: "none", halt: false, cause: "syntax" });
  expect(child.full).toContain("PREGATE WARN syntax src/domain/a.ts");
  // The child's Stop did not block, so the child is finished and the parent's Stop is the backstop for its file.
  expect(await stop(parent)).toMatchObject({ verdict: "none", cause: "syntax" });
  put(join(root, "src/domain/a.ts"), "export const a = 2;\n");
  expect(await stop(parent)).toMatchObject({ verdict: "none", cause: null });
  expect((await onPreEdit([change(root, "src/domain/c.ts", { form: "full", content: "export const c = 1;\n" }, parent)])).verdict).toBe("none");
  put(join(root, "src/domain/c.ts"), "export const c = ;\n");
  // c.ts is the only file that does not parse: the parent is charged for its own edit.
  expect(await stop(parent)).toMatchObject({ verdict: "none", cause: "syntax" });
  expect(await stop(agent)).toMatchObject({ verdict: "none", cause: null });
  put(join(root, "src/domain/c.ts"), "export const c = 1;\n");
  expect(await stop(agent)).toMatchObject({ verdict: "none", cause: null });
  put(join(root, "src/domain/a.ts"), "export const a = ;\n");
  expect((await stop(parent)).cause).toBe("syntax");
  // Harnesses without a verified SubagentStop still judge all files at the parent's Stop.
  for (const other of ["cursor", "grok", "agy"] as const) {
    const worker = { ...session(other, `subagents-${harness}-${other}`), agentId: "worker" };
    expect((await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 3;\n" }, worker)])).verdict).toBe("none");
    expect((await stop({ ...worker, agentId: null })).cause).toBe("syntax");
  }
});

test("Codex child commands review unattributed runtime changes without charging another agent's edits", async () => {
  const root = repo("codex-child-command"), parent = session("codex", "child-command");
  const child = { ...parent, agentId: "worker" };
  onSessionStart({ kind: "session-start", session: parent, cwd: root });
  expect(onPreCommand({ session: child, tool: "Bash", callId: "runtime", cwd: root, command: "git status --short" }).verdict).toBe("none");
  expect((await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, parent)])).verdict).toBe("none");
  put(join(root, "src/domain/a.ts"), "export const a = ;\n");
  put(join(root, "src/domain/runtime.ts"), "export const runtime = ;\n");
  const blocked = await onStop({ kind: "stop", session: child, cwd: root, reentry: false });
  expect(blocked.cause).toBe("syntax");
  expect(blocked.full).toContain("runtime.ts");
  expect(blocked.full).not.toContain("src/domain/a.ts");
  put(join(root, "src/domain/runtime.ts"), "export const runtime = 1;\n");
  expect(await onStop({ kind: "stop", session: child, cwd: root, reentry: false })).toMatchObject({ verdict: "none", cause: null });
  expect((await onStop({ kind: "stop", session: parent, cwd: root, reentry: false })).cause).toBe("syntax");
});

test("Stop does not charge the session for a branch that existed before it; commits made during it stay its own", async () => {
  const root = repo("moved-head");
  const s = session("claude-code", "moved-head");
  const stop = () => onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  git(root, "checkout", "-q", "-b", "theirs");
  put(join(root, "src/domain/theirs.ts"), "export const theirs = ;\n");
  git(root, "add", "."); git(root, "commit", "-qm", "their work");
  git(root, "checkout", "-q", "-");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  git(root, "checkout", "-q", "theirs");
  expect(await stop()).toMatchObject({ verdict: "none", cause: null });
  git(root, "checkout", "-q", "-");
  git(root, "merge", "-q", "--ff-only", "theirs");
  expect(await stop()).toMatchObject({ verdict: "none", cause: null });
  put(join(root, "src/domain/theirs.ts"), "export const theirs = ;\nexport const more = 1;\n");
  const changed = await stop();
  expect(changed.cause).toBe("syntax");
  expect(changed.full).toContain("src/domain/theirs.ts");
  git(root, "checkout", "-q", "src/domain/theirs.ts");
  expect(await stop()).toMatchObject({ verdict: "none", cause: null });
  put(join(root, "src/domain/mine.ts"), "export const mine = ;\n");
  git(root, "add", "."); git(root, "commit", "-qm", "my work through the shell");
  // mine.ts is the only file charged now. The note text was already given once in this session.
  expect(await stop()).toMatchObject({ verdict: "none", cause: "syntax" });
});

describe("#62: merge attribution", () => {
  const stopOf = (root: string, s: Session) => onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  const commit = (root: string, rel: string, text: string, message: string) => {
    put(join(root, rel), text);
    git(root, "add", ".");
    git(root, "commit", "-qm", message);
  };
  // A branch from the current HEAD with one commit, then back to the previous branch.
  const branch = (root: string, name: string, rel: string, text: string) => {
    git(root, "checkout", "-q", "-b", name);
    commit(root, rel, text, name);
    git(root, "checkout", "-q", "-");
  };
  const tests = (n: number) => ["import { expect, test } from \"bun:test\";", "test(\"t\", () => {",
    ...Array.from({ length: n }, (_, i) => `  expect(${i + 1}).toBe(${i + 1});`), "});", ""].join("\n");
  const broken = "export const theirs = ;\n";

  test("a no-ff merge of a branch that existed before the session is not charged, during or after the merge", async () => {
    const root = repo("merge-clean"), s = session("claude-code", "merge-clean");
    branch(root, "theirs", "src/domain/theirs.ts", broken);
    branch(root, "later", "src/domain/later.ts", broken);
    commit(root, "src/domain/b.ts", "export const b = 1;\n", "main moves");
    onSessionStart({ kind: "session-start", session: s, cwd: root });
    git(root, "merge", "-q", "--no-ff", "--no-edit", "theirs");
    expect(await stopOf(root, s)).toMatchObject({ verdict: "none", cause: null });
    git(root, "merge", "-q", "--no-ff", "--no-commit", "later");
    expect(await stopOf(root, s)).toMatchObject({ verdict: "none", cause: null });
    put(join(root, "src/domain/later.ts"), "export const later = ;\n");
    const evil = await stopOf(root, s);
    expect(evil.cause).toBe("syntax");
    expect(evil.full).toContain("src/domain/later.ts");
    git(root, "add", ".");
    git(root, "commit", "-q", "--no-edit");
    // Still charged after the merge commit; the note text is given once per session.
    expect((await stopOf(root, s)).cause).toBe("syntax");
  });

  test("a branch created during the session is charged when merged, in progress or committed", async () => {
    const root = repo("merge-launder"), s = session("claude-code", "merge-launder");
    commit(root, "src/domain/b.ts", "export const b = 1;\n", "main");
    onSessionStart({ kind: "session-start", session: s, cwd: root });
    git(root, "checkout", "-q", "-b", "side", "HEAD~1");
    commit(root, "src/domain/side.ts", broken, "side");
    git(root, "checkout", "-q", "-");
    git(root, "merge", "-q", "--no-ff", "--no-commit", "side");
    const merging = await stopOf(root, s);
    expect(merging.cause).toBe("syntax");
    expect(merging.full).toContain("src/domain/side.ts");
    git(root, "commit", "-q", "--no-edit");
    expect((await stopOf(root, s)).cause).toBe("syntax");
  });

  test("a take-theirs conflict resolution that weakens a test is charged", async () => {
    const root = repo("merge-theirs"), s = session("claude-code", "merge-theirs");
    commit(root, "test/x.test.ts", tests(5), "tests");
    git(root, "checkout", "-q", "-b", "theirs");
    commit(root, "test/x.test.ts", tests(4), "drop one");
    git(root, "checkout", "-q", "-");
    commit(root, "test/x.test.ts", tests(6), "add one");
    onSessionStart({ kind: "session-start", session: s, cwd: root });
    expect(Bun.spawnSync(["git", "-c", "user.name=W6", "-c", "user.email=w6@example.com", "merge", "-q", "theirs"], { cwd: root, stderr: "pipe", stdout: "pipe" }).exitCode).not.toBe(0);
    git(root, "checkout", "--theirs", "--", "test/x.test.ts");
    git(root, "add", ".");
    const rule = expect.objectContaining({ path: "test/x.test.ts", rule: "testing/TDD-DEL-001" });
    expect((await stopOf(root, s)).violations).toContainEqual(rule);
    git(root, "commit", "-q", "--no-edit");
    expect((await stopOf(root, s)).violations).toContainEqual(rule);
  });

  test("a file both sides changed is charged whole; octopus and squash merges are charged", async () => {
    const root = repo("merge-fallback");
    // One session per merge, each started on the same HEAD, so no Stop limit carries over.
    const start = (id: string) => {
      const s = session("claude-code", id);
      onSessionStart({ kind: "session-start", session: s, cwd: root });
      return s;
    };
    const lines = (first: string, last: string) => [first, "", "export const m1 = 1;", "export const m2 = 2;", "export const m3 = 3;", "", last, ""].join("\n");
    commit(root, "src/domain/both.ts", lines("export const x = 1;", "export const y = 1;"), "both");
    branch(root, "theirs", "src/domain/both.ts", lines("export const x = 1;", "export const y = ;"));
    branch(root, "o1", "src/domain/o1.ts", broken);
    branch(root, "o2", "src/domain/o2.ts", "export const o2 = 2;\n");
    branch(root, "squashed", "src/domain/squashed.ts", broken);
    commit(root, "src/domain/both.ts", lines("export const x = 2;", "export const y = 1;"), "ours");
    const both = start("merge-both");
    git(root, "merge", "-q", "--no-ff", "--no-edit", "theirs");
    expect((await stopOf(root, both)).full).toContain("src/domain/both.ts");
    git(root, "reset", "-q", "--hard", "HEAD~1");
    const octopus = start("merge-octopus");
    git(root, "merge", "-q", "--no-edit", "o1", "o2");
    expect((await stopOf(root, octopus)).full).toContain("src/domain/o1.ts");
    git(root, "reset", "-q", "--hard", "HEAD~1");
    const squash = start("merge-squash");
    git(root, "merge", "-q", "--squash", "squashed");
    git(root, "commit", "-qm", "squash");
    expect((await stopOf(root, squash)).full).toContain("src/domain/squashed.ts");
  });

  test("a partial merge that keeps only a weakened test from an existing branch is charged", async () => {
    const root = repo("merge-partial"), s = session("claude-code", "merge-partial");
    commit(root, "test/x.test.ts", tests(5), "tests");
    git(root, "checkout", "-q", "-b", "stale");
    commit(root, "test/x.test.ts", tests(1), "weaken");
    commit(root, "src/domain/other.ts", "export const other = 1;\n", "other");
    git(root, "checkout", "-q", "-");
    commit(root, "src/domain/b.ts", "export const b = 1;\n", "main moves");
    onSessionStart({ kind: "session-start", session: s, cwd: root });
    git(root, "merge", "-q", "--no-ff", "--no-commit", "stale");
    git(root, "rm", "-q", "-f", "src/domain/other.ts");
    const rule = expect.objectContaining({ path: "test/x.test.ts", rule: "testing/TDD-DEL-001" });
    expect((await stopOf(root, s)).violations).toContainEqual(rule);
    git(root, "commit", "-q", "--no-edit");
    expect((await stopOf(root, s)).violations).toContainEqual(rule);
  });

  test("a branch named MERGE_HEAD is not a merge in progress", async () => {
    const root = repo("merge-forged"), s = session("claude-code", "merge-forged");
    commit(root, "test/x.test.ts", tests(5), "tests");
    branch(root, "stale", "test/x.test.ts", tests(1));
    git(root, "branch", "MERGE_HEAD", "stale");
    onSessionStart({ kind: "session-start", session: s, cwd: root });
    git(root, "checkout", "stale", "--", "test/x.test.ts");
    expect((await stopOf(root, s)).violations).toContainEqual(expect.objectContaining({ path: "test/x.test.ts", rule: "testing/TDD-DEL-001" }));
  });

  test("merges past the per-Stop limit of per-side attribution are charged whole", async () => {
    const root = repo("merge-limit"), s = session("claude-code", "merge-limit");
    for (let i = 0; i < 33; i++) branch(root, `b${i}`, `src/domain/b${i}.ts`, i === 0 ? broken : `export const b${i} = ${i};\n`);
    onSessionStart({ kind: "session-start", session: s, cwd: root });
    // b0 is merged first, so it is the oldest of 33 merges and past the newest 32.
    for (let i = 0; i < 33; i++) git(root, "merge", "-q", "--no-ff", "--no-edit", `b${i}`);
    expect((await stopOf(root, s)).full).toContain("src/domain/b0.ts");
  });
});

test("SubagentStop: Claude Code scopes the agent, Grok judges the child session, Cursor stays ignored", () => {
  const env = { grokEvent: null, projectDir: null, remote: false };
  const base = { session_id: "s", cwd: "/repo", stop_hook_active: false };
  expect(claude("stop", JSON.stringify({ ...base, hook_event_name: "SubagentStop", agent_id: "a1", agent_type: "general-purpose" }), env))
    .toMatchObject({ kind: "stop", session: { agentId: "a1", interactive: false }, reentry: false });
  expect(claude("stop", JSON.stringify({ ...base, hook_event_name: "SubagentStop" }), env)).toMatchObject({ cause: "payload-unrecognized" });
  expect(claude("stop", JSON.stringify({ ...base, hook_event_name: "Stop", agent_id: "a1" }), env)).toMatchObject({ cause: "payload-unrecognized" });
  expect(HARNESSES.grok.decode("stop", JSON.stringify({ hookEventName: "subagent_stop", sessionId: "s", cwd: "/repo" }), env))
    .toMatchObject({ cause: "payload-unrecognized" });
  expect(HARNESSES.grok.decode("stop", JSON.stringify({ hookEventName: "subagent_stop", sessionId: "s", cwd: "/repo", stopHookActive: false }), env))
    .toMatchObject({ kind: "stop", session: { id: "s", harness: "grok", agentId: null }, cwd: "/repo", reentry: false });
  expect(HARNESSES.cursor.decode("stop", JSON.stringify({ hook_event_name: "subagentStop", conversation_id: "s" }), env)).toBeNull();
});

test("D27: headless contract edits and preset deletion are denied", async () => {
  const ci = process.env.CI;
  process.env.CI = "1";
  await restoringCI(ci, headlessContractEdits);
});

async function restoringCI(ci: string | undefined, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } finally {
    if (ci === undefined) delete process.env.CI; else process.env.CI = ci;
  }
}

async function headlessContractEdits(): Promise<void> {
  const root = repo();
  const next = JSON.parse(readFileSync(join(root, PRESET), "utf8"));
  next.enforcement = "shadow";
  const content = JSON.stringify(next);
  const c = change(root, PRESET, { form: "full", content });
  expect((await onPreEdit([c])).verdict).toBe("deny");
  expect((await onPreEdit([change(root, PRESET, { form: "delete" })])).verdict).toBe("deny");
}

test("a real Stop finding retains the observed check version for a private-by-default issue draft", async () => {
  const root = repo(), s = session("agy");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  put(join(root, "src/domain/a.ts"), "export class A {\n  private value = 1;\n  setValue(value: number): void { this.value = value; }\n}\n");
  const result = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(result.verdict).toBe("deny");
  const event = state.history(state.key(s), "-", "stop").at(-1)!;
  const loaded = lockOf(root);
  if (typeof loaded === "string") throw new Error(loaded);
  const check = loaded.lock.rules.find((r) => r.id === "ddd/DDD-ENT-001")!.check;
  expect(event.ruleChecks?.["ddd/DDD-ENT-001"]).toBe(check);
  const draft = issueContent(event, { harness: "agy", note: "", code: null, fingerprint: "f".repeat(64) });
  expect(draft.body).toContain(`check: ${check}`);
  expect(draft.body).toContain("No public reproduction was supplied");
  for (const omitted of [root, "src/domain/a.ts", "private value", "setValue"]) expect(draft.body).not.toContain(omitted);
});

test("Cursor Stop followups share the cap despite new generation IDs, and reset after completion", async () => {
  const root = repo();
  const s = session("cursor");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  put(join(root, "src/domain/a.ts"), "export class A {\n  private value = 1;\n  setValue(value: number): void { this.value = value; }\n}\n");
  const stop = (id: string) => onStop({ kind: "stop", session: { ...s, turnId: id }, cwd: root, reentry: false });
  expect((await stop("generation-1")).verdict).toBe("deny");
  expect((await stop("generation-2")).verdict).toBe("deny");
  expect((await stop("generation-3")).verdict).toBe("none");
  expect((await stop("generation-4")).verdict).toBe("none");
  put(join(root, "src/domain/a.ts"), "export class A {\n  private value = 2;\n  setValue(value: number): void { this.value = value; }\n}\n");
  expect((await stop("generation-5")).verdict).toBe("deny");
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("%s records incomplete Stop and uses only its supported notice channel", async (harness) => {
  const root = repo();
  const s = session(harness);
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  put(join(root, "src/domain/a.ts"), "export class A {\n  private value = 1;\n  setValue(value: number): void { this.value = value; }\n}\n");
  const stop = () => onStop({ kind: "stop", session: s, cwd: root, reentry: true });
  expect((await stop()).verdict).toBe("deny");
  expect((await stop()).verdict).toBe("deny");
  const last = await stop();
  expect(last.verdict).toBe("none");
  expect(last.stopIncomplete).toEqual({ reason: "limit", cause: null });
  const emission = HARNESSES[harness].encode("stop", enabledWire(last));
  expect(emission.exit).toBe(0);
  if (harness === "claude-code" || harness === "codex") {
    expect(JSON.parse(emission.stdout)).toEqual({ systemMessage: last.notice });
    expect(emission.stdout).toContain("pregate report --json");
  } else expect(emission.stdout).toBe("");
  const result = JSON.parse(report(["--repo", root, "--json"]).text);
  expect(result.incompleteStops).toHaveLength(1);
  expect(result.incompleteStops[0]).toMatchObject({ session: state.key(s), reason: "limit", cause: null });
  expect(result.incompleteStops[0].violations).toContainEqual(expect.objectContaining({ rule: "ddd/DDD-ENT-001", path: "src/domain/a.ts" }));
  expect(result.incompleteStops[0].message).toContain("pregate check --all");
  expect(report(["--repo", root]).text).toContain("1 incomplete Stops recorded");
  put(join(root, "src/domain/a.ts"), "export const a = 1;\n");
  expect((await stop()).stopIncomplete).toBeUndefined();
  expect((await check(root, { kind: "tree" })).code).toBe(0);
  expect(JSON.parse(report(["--repo", root, "--json"]).text).incompleteStops).toHaveLength(1);
});

test.each(["claude-code", "codex", "cursor", "grok", "agy"] as const)("%s reports why a clean HEAD check does not clear a committed Stop breach", async (harness) => {
  const root = repo();
  const s = session(harness);
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const before = state.snapshot(state.key(s), root);
  if (before === null || before === "missing") throw new Error("Missing test snapshot");
  put(join(root, "src/domain/a.ts"), "export class A {\n  private value = 1;\n  setValue(value: number): void { this.value = value; }\n}\n");
  git(root, "add", "."); git(root, "commit", "-qm", "committed breach during session");
  expect((await check(root, { kind: "base", sha: "HEAD" })).code).toBe(0);
  const stop = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(stop.verdict).toBe("deny");
  expect(stop.violations).toContainEqual(expect.objectContaining({ rule: "ddd/DDD-ENT-001" }));
  expect(stop.full).toContain("Stop uses the retained session snapshot");
  const baseline = JSON.parse(report(["--repo", root, "--json"]).text).sessionBaselines[0];
  expect(baseline).toMatchObject({ session: state.key(s), status: "available", head: before.head, startedWithSession: true });
  expect(baseline.currentHead).not.toBe(before.head);
  expect(state.snapshot(state.key(s), root)).toEqual(before);
});

test("a contract only a human can repair does not block Stop or record an incomplete Stop", async () => {
  const root = repo();
  const s = session();
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const stop = (reentry: boolean) => onStop({ kind: "stop", session: s, cwd: root, reentry });
  // An unreadable lock: Stop judges from the preset.
  put(join(root, LOCK), "invalid lock");
  for (const reentry of [false, true]) {
    const judged = await stop(reentry);
    expect(judged).toMatchObject({ verdict: "none", halt: false, cause: null });
    expect(judged.stopIncomplete).toBeUndefined();
  }
  // No preset: nothing can be judged. Stop says so once and lets the turn end.
  rmSync(join(root, PRESET));
  const first = await stop(false);
  expect(first).toMatchObject({ verdict: "none", halt: false, cause: "lock-stale" });
  expect(first.notice).toContain("PREGATE NOTE lock-stale");
  expect(first.notice).toContain("Not blocked.");
  expect(first.stopIncomplete).toBeUndefined();
  const again = await stop(true);
  expect(again).toMatchObject({ verdict: "none", halt: false, cause: "lock-stale", notice: null });
  expect(again.stopIncomplete).toBeUndefined();
  expect(JSON.parse(report(["--repo", root, "--json"]).text).incompleteStops).toEqual([]);
});

describe("multi-file overlay", () => {
  test("one edit call admits each root once; lock bytes changed afterwards are not admitted, and the preset's compile answers", async () => {
    const first = repo("first"), second = repo("second");
    const s = session();
    onSessionStart({ kind: "session-start", session: s, cwd: first });
    const old = readFileSync(join(first, LOCK), "utf8");
    const changes = [change(first, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s),
      change(first, "src/domain/b.ts", { form: "full", content: "export const b = 3;\n" }, s),
      change(second, "src/domain/a.ts", { form: "full", content: "export const a = 4;\n" }, s)];
    const traced = spyOn(compiler, "compile");
    await whileSpiedAsync(traced, async () => {
      const decision = await onPreEdit(changes);
      expect(decision.verdict).toBe("none");
      // SessionStart already compiled and cached the first root's lock; only the second root compiles here.
      expect(traced).toHaveBeenCalledTimes(1);
      for (const proposed of changes) expect(events(s, proposed.path).at(-1)?.verdict).toBe("none");
      traced.mockClear();
      const altered = JSON.parse(old);
      altered.rules[0].severity = "warn";
      put(join(first, LOCK), lockText(altered));
      // The altered lock is not the preset's compile: the cached compile of the preset answers, without a new one.
      expect(await onPreEdit([changes[0]!])).toMatchObject({ verdict: "none", cause: null, full: "" });
      expect(traced).toHaveBeenCalledTimes(0);
      const loaded = lockOf(first);
      if (typeof loaded === "string") throw new Error(loaded);
      expect(lockText(loaded.lock)).toBe(old);
      expect(loaded.lock.rules[0]!.severity).not.toBe("warn");
      // The altered lock never reached the cache, so restoring the admitted bytes is a cache hit.
      put(join(first, LOCK), old);
      expect((await onPreEdit([changes[0]!])).verdict).toBe("none");
      expect(traced).toHaveBeenCalledTimes(0);
    });
  });

  test("a native patch creates a dependency visible to its importer, with one event per file", async () => {
    const root = repo();
    const raw = JSON.parse(readFileSync(join(import.meta.dir, "payloads/codex/pre-apply-patch-add-update.json"), "utf8"));
    raw.cwd = root;
    raw.tool_input.command = `*** Begin Patch\n*** Add File: ${root}/src/domain/new.ts\n+export const fresh = 1;\n*** Add File: ${root}/src/application/use.ts\n+import { fresh } from '../domain/new';\n+export const used = fresh;\n*** End Patch`;
    const e = codex("pre", JSON.stringify(raw), { grokEvent: null, projectDir: null, remote: false });
    if (e === null || "cause" in e || e.kind !== "pre-edit") throw new Error("native patch did not decode");
    const d = await onPreEdit(e.changes);
    expect(d.verdict).toBe("none");
    expect(events(e.changes[0]!.session, e.changes[0]!.path)).toHaveLength(1);
    expect(events(e.changes[1]!.session, e.changes[1]!.path)).toHaveLength(1);
    expect(events(e.changes[0]!.session, e.changes[0]!.path)[0]!.callId).toBe(events(e.changes[1]!.session, e.changes[1]!.path)[0]!.callId);
    expect(existsSync(e.changes[0]!.path)).toBe(false);
    expect(existsSync(e.changes[1]!.path)).toBe(false);
  });

  test("a deleted tsconfig is absent from the overlay when resolving an alias", async () => {
    const root = repo();
    put(join(root, "tsconfig.json"), '{"compilerOptions":{"paths":{"#a":["src/domain/a"]}}}');
    const d = await onPreEdit([
      change(root, "tsconfig.json", { form: "delete" }),
      change(root, "src/application/use.ts", { form: "full", content: "import { a } from '#a';\nexport const used = a;\n" }),
    ]);
    expect(d).toMatchObject({ verdict: "none", halt: false, cause: "unresolvable-import" });
    expect(d.full).toContain("PREGATE WARN unresolvable-import src/application/use.ts");
  });

  test("a move reconstructs from the source and exposes the destination", async () => {
    const root = repo();
    const d = await onPreEdit([
      change(root, "src/domain/a.ts", { form: "delete" }),
      change(root, "src/domain/moved.ts", { form: "hunks", hunks: [{ anchor: null, old: ["export const a = 1;"], neu: ["export const a = 2;"], eof: false }] }, session(), join(root, "src/domain/a.ts")),
      change(root, "src/application/use.ts", { form: "full", content: "import { a } from '../domain/moved';\nexport const used = a;\n" }),
    ]);
    expect(d.verdict).toBe("none");
    expect(state.roots(state.key(session()))).toEqual([root]);
    expect(events(session(), join(root, "src/domain/moved.ts"))).toHaveLength(1);
    expect(readFileSync(join(root, "src/domain/a.ts"), "utf8")).toBe("export const a = 1;\n");
  });

  test("every file that does not parse is recorded and contributes to the merged advisory", async () => {
    const root = repo();
    const d = await onPreEdit([
      change(root, "src/domain/bad.ts", { form: "full", content: "export const bad = ;\n" }),
      change(root, "src/domain/also-bad.ts", { form: "full", content: "export const other = ;\n" }),
    ]);
    expect(d).toMatchObject({ verdict: "none", halt: false, cause: "syntax" });
    expect(d.full).toContain("PREGATE WARN syntax src/domain/bad.ts");
    expect(d.full).toContain("PREGATE WARN syntax src/domain/also-bad.ts");
    for (const rel of ["bad.ts", "also-bad.ts"]) expect(events(session(), join(root, "src/domain", rel))[0]).toMatchObject({ verdict: "none", form: "syntax" });
  });

  test("Delete only applies protections; Stop evaluates the resulting tree", async () => {
    const root = repo();
    expect((await onPreEdit([change(root, "src/domain/a.ts", { form: "delete" })])).verdict).toBe("none");
    for (const rel of [PRESET, ".git/config"]) {
      expect((await onPreEdit([change(root, rel, { form: "delete" })])).cause).toBe("protected-path");
    }
  });
});

describe("MH-17: no preset", () => {
  test("native Write, shell, SessionStart and Stop stay silent without git or state", async () => {
    const root = join(area, "plain");
    mkdirSync(root);
    const raw = JSON.parse(readFileSync(join(import.meta.dir, "payloads/pre-write.json"), "utf8"));
    raw.cwd = root;
    raw.tool_input.file_path = join(root, "a.ts");
    raw.tool_input.content = "not valid TypeScript {";
    put(raw.tool_input.file_path, "old text need not be read");
    const e = claude("pre", JSON.stringify(raw), { grokEvent: null, projectDir: null, remote: false });
    if (e === null || "cause" in e || e.kind !== "pre-edit") throw new Error("native Write did not decode");
    const path = process.env.PATH;
    process.env.PATH = "/no-git";
    try {
      expect((await onPreEdit(e.changes)).verdict).toBe("none");
      const s = e.changes[0]!.session;
      const shell = onPreCommand({ session: s, callId: "shell", tool: "Bash", cwd: root, command: "codex exec 'task' && echo x > a.ts && git commit --no-verify" });
      expect(shell.verdict).toBe("none");
      const start = onSessionStart({ kind: "session-start", session: s, cwd: root });
      expect(start.full).toBe("");
      expect(start.notice).toBeNull();
      expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("none");
      expect(existsSync(state.stateDir())).toBe(false);
    } finally {
      process.env.PATH = path;
    }
  });

  test("project .git and .claude settings are editable without a preset", async () => {
    for (const rel of [".git/config", ".claude/settings.json"]) {
      expect((await onPreEdit([change(area, `plain/${rel}`, { form: "full", content: "{}" })])).verdict).toBe("none");
    }
    expect(existsSync(state.stateDir())).toBe(false);
  });

  test("machine files and their symlink targets are inert without consent", async () => {
    const target = join(area, "dotfiles/settings.json");
    put(target, "{}");
    mkdirSync(join(process.env.HOME!, ".claude"));
    symlinkSync(target, join(process.env.HOME!, ".claude/settings.json"));
    for (const path of [target, join(process.env.HOME!, ".claude/settings.json"), join(process.env.CODEX_HOME!, "config.toml"), join(process.env.GROK_HOME!, "config.toml"), join(area, "plain/.pregate/preset.json")]) {
      const d = await onPreEdit([change(dirname(path), path.slice(path.lastIndexOf("/") + 1), { form: "delete" })]);
      expect(d.verdict).toBe("none");
    }
    expect(existsSync(state.stateDir())).toBe(false);
  });

  test("machine hook switches are inert without consent", () => {
    for (const command of ["pregate uninstall", "GROK_CLAUDE_HOOKS_ENABLED=0 grok -p task", "codex --ignore-user-config exec task"]) {
      expect(onPreCommand({ session: session(), callId: "switch", tool: "Bash", cwd: area, command }).verdict).toBe("none");
    }
    expect(existsSync(state.stateDir())).toBe(false);
  });

  test("a command outside a consenting root remains inert", () => {
    const root = repo();
    const d = onPreCommand({ session: session(), callId: "shell", tool: "Bash", cwd: area, command: `cd '${area}' && echo x > '${root}/src/domain/a.ts'` });
    expect(d.verdict).toBe("none");
    expect(state.roots(state.key(session()))).toEqual([]);
    expect(state.history(state.key(session()), "-", "-")).toHaveLength(0);
  });

  test("a read into a root also registers it, and source protections apply from outside", () => {
    const root = repo();
    const d = onPreCommand({ session: session(), callId: "read", tool: "Bash", cwd: area, command: `cat '${root}/src/domain/a.ts'` });
    expect(d.verdict).toBe("none");
    expect(state.roots(state.key(session()))).toEqual([]);
    expect(onPreCommand({ session: session(), callId: "delete", tool: "Bash", cwd: area, command: `rm '${root}/.git/config'` }).verdict).toBe("none");
  });
});

describe("rejected envelopes", () => {
  function refusal(dirs: string[], s: Session | null = session()): Rejected {
    return { kind: "pre-edit", cause: "payload-unrecognized", reentry: false, dirs, session: s };
  }
  test("unknown tools outside every root are neutral and write no state", () => {
    expect(rejected(refusal([area])).verdict).toBe("none");
    expect(existsSync(state.stateDir())).toBe(false);
  });
  test("a root in any directory, or a previously registered root, is noted and not denied", () => {
    const root = repo();
    const noted = { verdict: "none", halt: false, cause: "payload-unrecognized" };
    const reached = rejected(refusal([area, root]));
    expect(reached).toMatchObject(noted);
    expect(reached.full).toContain("PREGATE NOTE payload-unrecognized");
    expect(reached.full).toContain("Not blocked.");
    onSessionStart({ kind: "session-start", session: session(), cwd: root });
    expect(rejected(refusal([area]))).toMatchObject(noted);
    expect(rejected(refusal([area], session("codex")))).toMatchObject({ verdict: "none", cause: null, full: "" });
  });
  test("missing directories deny; a rejected Stop respects human-cause reentry", () => {
    expect(rejected(refusal([], null)).verdict).toBe("none");
    expect(rejected({ ...refusal([], null), kind: "stop", reentry: true }).verdict).toBe("none");
    expect(existsSync(state.stateDir())).toBe(false);
  });
});

test("#40: a git mv keeps the moved file's existing suppressions as baseline, and new ones still deny", async () => {
  const root = repo("moved"), s = session("claude-code", "moved");
  put(join(root, "src/domain/legacy.ts"), "// eslint-disable-next-line\nexport const legacy = 1;\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "legacy suppression");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  mkdirSync(join(root, "src/domain/billing"), { recursive: true });
  git(root, "mv", "src/domain/legacy.ts", "src/domain/billing/legacy.ts");
  expect(await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).toMatchObject({ verdict: "none", violations: [] });
  const edit = await onPreEdit([change(root, "src/domain/billing/legacy.ts",
    { form: "full", content: "// eslint-disable-next-line\nexport const legacy = 2;\n" }, s)]);
  expect(edit.verdict).toBe("none");
  put(join(root, "src/domain/billing/legacy.ts"), "// eslint-disable-next-line\nexport const legacy = 1;\n// eslint-disable-next-line\nexport const added = 2;\n");
  const added = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(added.verdict).toBe("deny");
  expect(added.violations).toContainEqual(expect.objectContaining({ path: "src/domain/billing/legacy.ts", rule: "core/EVA-SUP-001" }));
});

test("#61: a git mv of a test keeps its assertion count; a real delete or drop still denies", async () => {
  const root = repo("renamed-tests"), s = session("claude-code", "renamed-tests");
  const kept = ["import { expect, test } from \"bun:test\";", "test(\"keeps\", () => {",
    "  expect(1).toBe(1);", "  expect(2).toBe(2);", "  expect(3).toBe(3);", "  expect(4).toBe(4);", "  expect(5).toBe(5);", "});", ""].join("\n");
  put(join(root, "test/meta-events.test.ts"), kept);
  put(join(root, "test/support.test.ts"), kept.replace("keeps", "supports"));
  git(root, "add", ".");
  git(root, "commit", "-qm", "tests");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  mkdirSync(join(root, "test/infrastructure"), { recursive: true });
  git(root, "mv", "test/meta-events.test.ts", "test/infrastructure/meta-events.test.ts");
  const moved = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(moved.verdict).toBe("none");
  expect(moved.violations).toEqual([]);
  rmSync(join(root, "test/support.test.ts"));
  const deleted = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(deleted.violations).toContainEqual(expect.objectContaining({ path: "test/support.test.ts", rule: "testing/TDD-DEL-001" }));
  expect(deleted.violations).not.toContainEqual(expect.objectContaining({ path: "test/meta-events.test.ts", rule: "testing/TDD-DEL-001" }));
  const movedBody = readFileSync(join(root, "test/infrastructure/meta-events.test.ts"), "utf8");
  put(join(root, "test/infrastructure/meta-events.test.ts"), movedBody.replace("  expect(5).toBe(5);\n", ""));
  const dropped = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(dropped.violations).toContainEqual(expect.objectContaining({ path: "test/infrastructure/meta-events.test.ts", rule: "testing/TDD-DEL-001" }));
});

describe("MH-33: preset ctime against the first root contact", () => {
  test("an uncommitted preset that predates the first Pre is enforced without SessionStart", async () => {
    const root = repo("fresh", false);
    await Bun.sleep(10);
    const d = await onPreEdit([change(root, "src/domain/bad.ts", { form: "full", content: "export const bad = ;" })]);
    expect(d.cause).toBe("syntax");
    expect(state.roots(state.key(session()))).toEqual([root]);
  });
  test("first contact still enforces a preset whose timestamp is slightly ahead of the clock", async () => {
    const root = repo("ahead", false);
    const ctime = statSync(join(root, PRESET)).ctimeMs;
    const clock = spyOn(Date, "now").mockReturnValue(ctime - 500);
    try {
      const d = await onPreEdit([change(root, "src/domain/bad.ts", { form: "full", content: "export const bad = ;" })]);
      expect(d.cause).toBe("syntax");
    } finally {
      clock.mockRestore();
    }
  });
  test("an enabled preset the session has not accepted is not judged: lock-stale is noted, not denied", async () => {
    const root = repo("unaccepted", false);
    const ctime = statSync(join(root, PRESET)).ctimeMs;
    const clock = spyOn(Date, "now").mockReturnValue(ctime - 10_000);
    try {
      const d = await onPreEdit([change(root, "src/domain/bad.ts", { form: "full", content: "export const bad = ;" })]);
      expect(d).toMatchObject({ verdict: "none", halt: false, cause: "lock-stale" });
      expect(d.full).toContain("PREGATE NOTE lock-stale");
      expect(d.full).toContain("Not blocked.");
      expect(d.full).not.toContain("PREGATE WARN syntax");
    } finally {
      clock.mockRestore();
    }
  });
  test("a later nested preset cannot weaken the parent's rules, even with backdated mtime", async () => {
    const root = repo();
    onSessionStart({ kind: "session-start", session: session(), cwd: root });
    const at = state.firstContact(state.key(session()))!;
    await Bun.sleep(10);
    const nested = join(root, "src/domain/nested");
    preset(nested);
    utimesSync(join(nested, PRESET), new Date(0), new Date(0));
    expect(statSync(join(nested, PRESET)).ctimeMs).toBeGreaterThan(at);
    expect((await onPreEdit([change(nested, "bad.ts", { form: "full", content: "export const bad = ;" })])).cause).toBe("syntax");
    onSessionStart({ kind: "session-start", session: session(), cwd: nested });
    expect(state.roots(state.key(session()))).toEqual([root]);
    expect(events(session(), join(nested, "bad.ts"))).toHaveLength(1);
  });
  test("tracked nested presets and presets older than the session's first contact are accepted", async () => {
    const root = repo();
    const older = join(root, "older");
    preset(older);
    enable(older);
    await Bun.sleep(10);
    onSessionStart({ kind: "session-start", session: session(), cwd: root });
    expect((await onPreEdit([change(older, "src/domain/bad.ts", { form: "full", content: "export const bad = ;" })])).cause).toBe("syntax");
    const tracked = join(root, "tracked");
    preset(tracked);
    enable(tracked);
    git(root, "add", "tracked");
    git(root, "commit", "-qm", "human onboarded nested root");
    await onPreEdit([change(tracked, "src/domain/bad.ts", { form: "full", content: "export const bad = ;" })]);
    expect(state.roots(state.key(session()))).toEqual([root, older, tracked].map(canonical).sort());
  });
  test("#42: an unaccepted nested checkout is noted by its own path and not judged by the outer root's contract", async () => {
    const root = repo();
    onSessionStart({ kind: "session-start", session: session(), cwd: root });
    await Bun.sleep(10);
    const worktree = join(root, "worktrees/feature");
    git(root, "init", "-q", worktree);
    preset(worktree);
    enable(worktree);
    const d = await onPreEdit([change(worktree, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" })]);
    expect(d).toMatchObject({ verdict: "none", halt: false, cause: "lock-stale" });
    expect(d.full).toContain("PREGATE NOTE lock-stale");
    expect(d.full).toContain("worktrees/feature/src/domain/a.ts");
    expect(d.full).toContain("Not blocked.");
    expect(d.full).not.toContain("lock contents differ");
  });
  test("out-of-scope first contact establishes the same boundary", async () => {
    const root = repo();
    await onPreEdit([change(root, "notes.md", { form: "full", content: "notes" })]);
    expect(state.firstContact(state.key(session()))).not.toBeNull();
    await Bun.sleep(10);
    const nested = join(root, "src/domain/nested");
    preset(nested);
    await onPreEdit([change(nested, "bad.ts", { form: "full", content: "export const bad = ;" })]);
    expect(state.roots(state.key(session()))).toEqual([root]);
  });
});

describe("engine selection", () => {
  function pin(root: string, version: unknown): void {
    const lock = JSON.parse(readFileSync(join(root, LOCK), "utf8"));
    lock.engine = version;
    put(join(root, LOCK), lockText(lock));
  }
  test("engineHome and the cited launcher derive from execPath", () => {
    expect(engineHome()).toBe(dirname(dirname(process.execPath)));
    expect(launcher()).toBe(join(engineHome(), WINDOWS ? "bin/pregate.cmd" : "bin/pregate"));
    expect(engineHome()).not.toBe(join(process.env.XDG_DATA_HOME!, "pregate"));
    expect(REDIRECT).toBe(3);
  });
  test("a lock pinned below FLOOR, to a prerelease or to an invalid version is judged from the preset; pinned names only a valid other engine", () => {
    const root = repo();
    for (const v of ["0.0.0", `${FLOOR}-rc.1`, "garbage", "../../outside", "0.0.1\n", null]) {
      pin(root, v);
      expect(pinned(root)).toBeNull();
      const loaded = lockOf(root);
      if (typeof loaded === "string") throw new Error(`${String(v)}: ${loaded}`);
      expect(loaded.lock.engine).toBe(VERSIONS.engine);
    }
    pin(root, FLOOR);
    expect(pinned(root)).toBe(FLOOR === VERSIONS.engine ? null : FLOOR);
    pin(root, "0.10.0");
    expect(pinned(root)).toBe("0.10.0");
    pin(root, VERSIONS.engine);
    expect(pinned(root)).toBeNull();
  });
  test("no call is redirected to a pinned engine: edit targets, a command's cwd, event cwd and rejected directories stay with this engine", () => {
    const root = repo();
    pin(root, "9.9.9");
    expect(pinned(root)).toBe("9.9.9");
    const edit: HookEvent = { kind: "pre-edit", changes: [change(area, "outside.ts", { form: "full", content: "x" }), change(root, "src/a.ts", { form: "full", content: "x" })] };
    expect(redirect(edit)).toBeNull();
    expect(redirect({ kind: "pre-command", command: { session: session(), callId: "c", tool: "Bash", command: "pwd", cwd: root } })).toBeNull();
    expect(redirect({ kind: "stop", cwd: root, session: session(), reentry: false })).toBeNull();
    expect(redirect({ kind: "session-start", cwd: root, session: session() })).toBeNull();
    expect(redirect({ kind: "pre-edit", cause: "payload-unrecognized", dirs: [root], session: null, reentry: false })).toBeNull();
    expect(existsSync(state.stateDir())).toBe(false);
  });
  test("a lock another engine wrote is judged from the preset: an enforced rule denies, Stop blocks, and check stays strict", async () => {
    const root = repo(), s = session("claude-code", "other-engine");
    pin(root, "9.9.9");
    onSessionStart({ kind: "session-start", session: s, cwd: root });
    expect(await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)])).toMatchObject({ verdict: "none", cause: null, full: "" });
    const breach = await onPreEdit([{ ...change(root, "src/domain/a.ts", { form: "full", content: SETTER }, s), callId: "breach" }]);
    expect(breach.verdict).toBe("deny");
    expect(breach.violations).toContainEqual(expect.objectContaining({ rule: "ddd/DDD-ENT-001" }));
    expect((await check(root, { kind: "stdin", path: "src/domain/a.ts", text: "export const a = 2;\n" })).code).toBe(0);
    expect((await check(root, { kind: "stdin", path: "src/domain/a.ts", text: SETTER })).code).toBe(1);
    put(join(root, "src/domain/a.ts"), SETTER);
    const stopped = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
    expect(stopped.verdict).toBe("deny");
    expect(stopped.violations).toContainEqual(expect.objectContaining({ rule: "ddd/DDD-ENT-001" }));
    expect(JSON.parse(readFileSync(join(root, LOCK), "utf8")).engine).toBe("9.9.9");
  });
  test("with an old lock every command stays with this engine: recovery previews pass, and a write into the contract is still denied", () => {
    const root = repo();
    pin(root, "0.2.6");
    for (const harness of ["claude-code", "codex", "grok", "agy", "cursor"] as const) {
      const command = (text: string): HookEvent => ({ kind: "pre-command", command: { session: session(harness), callId: "recovery", tool: "shell", command: text, cwd: root } });
      const decided = (text: string) => onPreCommand((command(text) as Extract<HookEvent, { kind: "pre-command" }>).command);
      for (const args of ["update --project --preview", "pack update --all --preview", "preset diagnose --json", "preset schema", "update --help", "guide --json", "guide --preview", "guide --preview --packs typescript --enforcement shadow"]) {
        const text = `'${launcher()}' ${args}`;
        expect(redirect(command(text))).toBeNull();
        expect(decided(text).verdict).toBe("none");
        for (const suffix of [" > .pregate/preset.json", "; echo x > src/a.ts", " --yes"]) expect(redirect(command(text + suffix))).toBeNull();
        expect(decided(text + " > .pregate/preset.json"), `${harness}: ${args}`).toMatchObject({ verdict: "deny", cause: "protected-path" });
      }
      expect(redirect(command("pregate check --all"))).toBeNull();
      expect(redirect(command("pregate approve --yes"))).toBeNull();
      for (const text of ["pregate guide", "pregate guide --yes", "pregate guide --json --preview", "pregate guide --preview --unknown", "env pregate guide --json", "sh -c 'pregate guide --preview'"]) {
        expect(redirect(command(text))).toBeNull();
        expect(decided(text).verdict).toBe("none");
      }
    }
  });
  test("a pinned engine need not be installed: missing, empty or non-executable, nothing is delegated to it", () => {
    const root = repo();
    pin(root, "9.9.9");
    const data = join(area, "install");
    const engine = join(data, "9.9.9", ENGINE_FILE);
    for (const mode of WINDOWS ? ["missing", "empty"] : ["missing", "empty", "not-executable"]) {
      if (mode !== "missing") {
        put(engine, mode === "empty" ? "" : "not an executable");
        chmodSync(engine, mode === "empty" ? 0o755 : 0o644);
      }
      expect(delegate(root, ["check", "--staged"], data), mode).toBeNull();
    }
    expect(pinned(root)).toBe("9.9.9");
  });
  test("the installed engine answers the CLI and the hook itself for a root whose lock pins another engine", () => {
    const root = repo();
    pin(root, "9.9.9");
    const data = join(area, "install");
    const engine = join(data, VERSIONS.engine, ENGINE_FILE);
    engineAt(engine);
    const raw = JSON.parse(readFileSync(join(import.meta.dir, "payloads/pre-write.json"), "utf8"));
    raw.cwd = root;
    raw.tool_input.file_path = join(root, "src/domain/bad.ts");
    const env = { ...process.env };
    const run = (argv: string[], input: string) => {
      const child = spawnSync(engine, argv, { cwd: root, env, input, stdio: ["pipe", "pipe", "pipe"], timeout: 5_000 });
      expect(child.error).toBeUndefined(); expect(child.signal).toBeNull();
      return { exitCode: child.status, stdout: child.stdout.toString(), stderr: child.stderr.toString() };
    };
    const stdin = ["check", "--stdin", "--path", join(root, "src/domain/a.ts")], hook = ["hook", "pre", "--harness", "claude-code"];
    for (const argv of [["--version"], ["unknown-command"], stdin, hook]) expect(delegate(root, argv, data), argv.join(" ")).toBeNull();
    expect(delegate(area, ["--version"], data)).toBeNull();
    expect(run(["--version"], "")).toMatchObject({ exitCode: 0, stdout: `pregate ${VERSIONS.engine} (core ${VERSIONS.core})\n` });
    expect(run(stdin, "export const a = 2;\n")).toMatchObject({ exitCode: 0, stdout: "PREGATE: no introduced violations.\n" });
    const breach = run(stdin, SETTER);
    expect(breach.exitCode).toBe(1);
    expect(breach.stdout + breach.stderr).toContain("PREGATE DENY ddd/DDD-ENT-001");
    expect(run(hook, JSON.stringify(raw))).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    raw.tool_input.content = SETTER;
    const denied = run(hook, JSON.stringify(raw));
    expect(denied.stdout + denied.stderr).toContain("ddd/DDD-ENT-001");
    expect(denied.stdout + denied.stderr).not.toContain("9.9.9");
    const start = JSON.parse(readFileSync(join(import.meta.dir, "payloads/session-start.json"), "utf8"));
    start.cwd = root;
    const context = run(["hook", "session-start", "--harness", "claude-code"], JSON.stringify(start));
    expect(context.exitCode).toBe(0);
    expect(JSON.parse(context.stdout).hookSpecificOutput.additionalContext).toContain(join(data, WINDOWS ? "bin/pregate.cmd" : "bin/pregate"));
  }, 30_000);
});

test("SessionStart raises a promotion once a day when advisor rules stayed clean over a week of edits", async () => {
  const root = repo(), s = session("claude-code", "promotion");
  const text = JSON.stringify({ ...JSON.parse(readFileSync(join(root, PRESET), "utf8")), enforcement: "advisor" });
  const compiled = compile(text, sourcesOf(root), VERSIONS);
  if ("errors" in compiled) throw new Error(compiled.errors.join("\n"));
  put(join(root, PRESET), text); put(join(root, LOCK), compiled.text);
  git(root, "add", "."); git(root, "commit", "-qm", "advisor");
  const start = { kind: "session-start" as const, session: s, cwd: root };
  expect((await sessionStart(start)).full).not.toContain("Promotion ready");
  const base = (JSON.parse(readFileSync(join(import.meta.dir, "fixtures/report-events.json"), "utf8")) as { event: Parameters<typeof state.record>[1] }[])[0]!.event;
  const enforcement = Object.fromEntries(compiled.lock.rules.map((rule) => [rule.id, "advisor" as const]));
  const day = 86_400_000, now = Date.now();
  for (const [i, at] of [now - 9 * day, ...Array.from({ length: 20 }, (_, n) => now - day - n * 1000)].entries()) {
    state.record("history", { ...base, callId: `call-${i}`, root, path: join(root, "src/domain/a.ts"), at, kind: "pre-edit", verdict: "none", form: null, shadowed: false, afterSha: null, violations: [], warnings: [], enforcement }, null);
  }
  expect((await sessionStart(start)).full).not.toContain("Promotion ready");   // already asked today
  rmSync(join(state.stateDir(), "promotion-nudge"), { recursive: true });
  const nudged = (await sessionStart(start)).full;
  expect(nudged).toContain("PREGATE is active:");
  expect(nudged).toMatch(/Promotion ready: \d+ advisor rules? reported no finding in the last 7 days over 20 checked edits \(/);
  expect(nudged).toContain("`pregate promote --preview`");
  expect((await sessionStart(start)).full).not.toContain("Promotion ready");
  expect(onSessionStart(start).full).not.toContain("Promotion ready");
});

test("agy queues Pre warnings and halt notices for PostInvocation, clears stale entries on Stop, and protects Antigravity configs", async () => {
  const root = repo("agy-post"), s = session("agy", "agy-conv");
  const postEvent = { kind: "post-invocation" as const, session: s, cwd: root };
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  expect(inert(postEvent)).toBe(true);

  const advisorText = JSON.stringify({ ...JSON.parse(readFileSync(join(root, PRESET), "utf8")), enforcement: "advisor" });
  const advisorCompiled = compile(advisorText, sourcesOf(root), VERSIONS);
  if ("errors" in advisorCompiled) throw new Error(advisorCompiled.errors.join("\n"));
  put(join(root, PRESET), advisorText); put(join(root, LOCK), advisorCompiled.text);
  git(root, "add", "."); git(root, "commit", "-qm", "advisor");

  const setterViolation = "export class Invoice {\n  constructor(readonly id: string, private customer: string) {}\n  setCustomer(c: string): void { this.customer = c; }\n}\n";
  const preWarn = await onPreEdit([{ ...change(root, "src/domain/a.ts", { form: "full", content: setterViolation }, s), callId: "1" }]);
  expect(preWarn.verdict).toBe("none");
  expect(inert(postEvent)).toBe(false);
  const drainedWarn = onPostInvocation(postEvent);
  expect(drainedWarn.verdict).toBe("none");
  expect(drainedWarn.halt).toBe(false);
  expect(drainedWarn.full).toContain("ddd/DDD-ENT-001");
  expect(inert(postEvent)).toBe(true);
  expect(onPostInvocation(postEvent).full).toBe("");

  // Restore enforce mode and trigger file-rule retry limit halt.
  preset(root);
  git(root, "add", "."); git(root, "commit", "-qm", "enforce");
  let halted = false;
  for (let i = 1; i <= 5; i++) {
    const d = await onPreEdit([{ ...change(root, "src/domain/a.ts", { form: "full", content: setterViolation }, s), callId: `deny-${i}` }]);
    if (d.halt) { halted = true; break; }
  }
  expect(halted).toBe(true);
  const drainedHalt = onPostInvocation(postEvent);
  expect(drainedHalt.halt).toBe(true);
  expect(drainedHalt.notice).toContain("PREGATE stopped the turn");

  // Stale PostInvocation items are cleared when Stop completes a turn.
  await onPreEdit([{ ...change(root, "src/domain/a.ts", { form: "full", content: setterViolation }, s), callId: "stale-halt" }]);
  await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(inert(postEvent)).toBe(true);

  // Mutating Antigravity plugin or IDE settings (and even reading pregate-global) is denied as protected-path.
  // The hook process is started in the enabled project; that is what protects files outside it.
  const pluginHooks = join(process.env.HOME!, ".gemini/config/plugins/pregate-global/hooks.json");
  put(pluginHooks, "{}\n");
  expect(onPreCommand({ session: s, callId: "cmd-read", tool: "run_command", command: `cat "${pluginHooks}"`, cwd: root })).toMatchObject({ verdict: "deny", cause: "protected-path" });
  const previous = process.cwd();
  process.chdir(root);
  try {
    for (const rel of [".gemini/config/plugins/pregate-global/hooks.json", ".gemini/antigravity/settings.json", ".gemini/antigravity-cli/settings.json"]) {
      const target = join(process.env.HOME!, rel);
      put(target, "{}\n");
      const edit = await onPreEdit([change(dirname(target), basename(target), { form: "full", content: "{}\n" }, s)]);
      expect(edit).toMatchObject({ verdict: "deny", cause: "protected-path" });
      const cmd = onPreCommand({ session: s, callId: "cmd", tool: "run_command", command: `echo '{}' > "${target}"`, cwd: root });
      expect(cmd).toMatchObject({ verdict: "deny", cause: "protected-path" });
    }
  } finally {
    process.chdir(previous);
  }
});
