import { afterAll, afterEach, beforeEach, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { canonical as lockText, compile } from "../src/compile.ts";
import * as compiler from "../src/compile.ts";
import { enable, disable, enabled } from "../src/consent.ts";
import { check, delegate, engineHome, FLOOR, launcher, LOCK, lockOf, onPostInvocation, onPreCommand, onPreEdit, onSessionStart, onStop, sessionStart, pinned, PRESET, REDIRECT, redirect, rejected, sourcesOf, VERSIONS } from "../src/gate.ts";
import { decode as claude } from "../src/harness/claude.ts";
import { decode as codex } from "../src/harness/codex.ts";
import * as state from "../src/state.ts";
import * as workspace from "../src/workspace.ts";
import * as gitHost from "../src/git.ts";
import type { Edit, HookEvent, ProposedChange, Rejected, Session } from "../src/types.ts";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE, WINDOWS } from "../src/platform.ts";
import { canonical } from "../src/disk.ts";
import { pathKey } from "../src/paths.ts";
import { report } from "../src/report-command.ts";
import { HARNESSES } from "../src/harness/profile.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { proposeContract, readProposal, PENDING_MS } from "../src/approval.ts";
import { inert } from "../src/inertia.ts";
import { pendingRoot } from "../src/proposal.ts";
import { issueContent } from "../src/issue.ts";
import { removeTree } from "./remove-tree.ts";

// Many cases run git and the engine several times; on Windows a git or engine spawn is far slower.
setDefaultTimeout(60_000);

const base = realpathSync(mkdtempSync(join(tmpdir(), "mh-w6-gate-")));
const names = ["HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "TMPDIR", "CODEX_HOME", "GROK_HOME", "CLAUDE_CONFIG_DIR", "PATH", "PREGATE_TESTING", "PREGATE_TEST_ANSWER"] as const;
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

test.each(["missing lock", "malformed lock", "changed preset", "incompatible pins", "missing preset"] as const)("Pre, Stop and SessionStart identify %s without changing consent", async kind => {
  const root = repo(), s = session("claude-code", kind.replaceAll(" ", "-"));
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const original = readFileSync(join(root, LOCK), "utf8");
  if (kind === "missing lock") rmSync(join(root, LOCK));
  else if (kind === "missing preset") rmSync(join(root, PRESET));
  else if (kind === "malformed lock") put(join(root, LOCK), "{");
  else if (kind === "changed preset") put(join(root, PRESET), JSON.stringify({ ...JSON.parse(readFileSync(join(root, PRESET), "utf8")), name: "changed" }));
  else put(join(root, LOCK), JSON.stringify({ ...JSON.parse(original), engine: "0.2.5", core: "0.2.0" }));
  const expected = kind.startsWith("missing") ? "Missing contract" : kind === "malformed lock" ? "Malformed contract" : kind === "changed preset" ? "Changed contract" : "Incompatible contract";
  const pre = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)]);
  const stop = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  const start = onSessionStart({ kind: "session-start", session: s, cwd: root });
  for (const text of [pre.full, pre.notice, stop.full, start.notice]) {
    expect(text).toContain(expected);
    expect(text).toContain(`Installed engine ${VERSIONS.engine}, core ${VERSIONS.core}`);
    expect(text).toContain("pregate update --project --preview");
    expect(text).toContain("displayed digest-bound command");
  }
  expect(pre.verdict).toBe("deny");
  expect(stop.verdict).toBe("deny");
  expect(pre.halt).toBe(true);
  expect(enabled(root)).toBe(true);
  expect(readFileSync(join(root, "src/domain/a.ts"), "utf8")).toBe("export const a = 1;\n");
});

test("a lock left with merge conflict markers denies Pre, Stop and SessionStart with the merge recovery", async () => {
  const root = repo("conflicted-lock"), s = session("claude-code", "conflicted-lock");
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const original = readFileSync(join(root, LOCK), "utf8");
  put(join(root, LOCK), `<<<<<<< HEAD\n${original}=======\n${original.replace("{", "{\"x\":1,")}>>>>>>> dev\n`);
  const pre = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, s)]);
  const stop = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  const start = onSessionStart({ kind: "session-start", session: s, cwd: root });
  for (const text of [pre.full, pre.notice, stop.full, start.notice]) {
    expect(text).toContain(`Merge conflict: git left ${LOCK} unmerged or with conflict markers`);
    expect(text).toContain("pregate update --project --preview");
    expect(text).toContain("displayed digest-bound command");
  }
  expect(pre.verdict).toBe("deny");
  expect(stop.verdict).toBe("deny");
  expect(enabled(root)).toBe(true);
});

test("explicit static enforcement keeps syntax on Pre, check and Stop without a shadow form hiding another file", async () => {
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
  expect((await onPreEdit([edit("src/domain/a.ts")])).verdict).toBe("deny");
  expect((await onPreEdit([edit("src/infra/unrelated.ts")])).verdict).toBe("none");
  expect((await check(root, { kind: "stdin", path: "src/domain/a.ts", text: invalid })).code).toBe(1);
  expect((await check(root, { kind: "stdin", path: "src/infra/unrelated.ts", text: invalid })).code).toBe(0);
  put(join(root, "src/infra/unrelated.ts"), invalid);
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("none");
  put(join(root, "src/domain/a.ts"), invalid);
  const stopped = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(stopped.verdict).toBe("deny"); expect(stopped.cause).toBe("syntax"); expect(stopped.full).toContain("src/domain/a.ts");
  expect((await check(root, { kind: "base", sha: "HEAD" })).code).toBe(1);
  git(root, "add", "src");
  expect((await check(root, { kind: "staged" })).code).toBe(1);
  put(join(root, "src/domain/a.ts"), "export const a = 2;\n");
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("none");
});

test("guide cannot obtain human approval from an agent in a neutral directory", () => {
  const outside = canonical(area);
  const s = session("claude-code", "guide-neutral");
  const command = (text: string) => ({ session: s, callId: text, tool: "Bash", cwd: outside, command: text });
  // Quoted as the engine prints it: unquoted, a Windows path's backslashes are shell escapes.
  for (const prefix of ["pregate", `'${launcher()}'`]) {
    for (const text of [prefix, `${prefix} guide`, `env ${prefix} guide`, `sh -c '${prefix} guide'`, `${prefix} guide --yes`, `env ${prefix} guide --json`]) {
      const c = command(text);
      expect(inert({ kind: "pre-command", command: c })).toBe(false);
      expect(onPreCommand(c).verdict).toBe("deny");
    }
    for (const text of [`${prefix} guide --json`, `${prefix} guide --preview`, `${prefix} guide --help`]) {
      const c = command(text);
      expect(inert({ kind: "pre-command", command: c })).toBe(false);
      expect(onPreCommand(c).verdict).toBe("none");
    }
  }
  expect(onPreCommand(command('echo "pregate guide"')).verdict).toBe("none");
  expect(state.roots(state.key(s))).toEqual([]);
});

test("shell-normalized guide invocations cannot bypass rootless guard loading in any harness", () => {
  const outside = canonical(area);
  for (const harness of ["claude-code", "codex", "cursor", "grok", "agy"] as const) {
    const s = session(harness, "normalized-guide-" + harness);
    for (const text of ["pregate \\\n guide", "pre'gate' guide", "pregate g\\uide", "pre'gate'", 'env pre"gate" guide',
      "sh -c 'pregate g\\uide'", 'sh -c "pre\'gate\' guide"', "pre\\gate guide", `${launcher()} \\\n guide`, "script -q /dev/null pre'gate' guide"]) {
      const command = { session: s, callId: text, tool: "shell", cwd: outside, command: text };
      expect(inert({ kind: "pre-command", command })).toBe(false);
      expect(onPreCommand(command).verdict).toBe("deny");
    }
    expect(state.roots(state.key(s))).toEqual([]);
  }
});

test("production hooks deny normalized neutral-cwd guide calls in all five native protocols", () => {
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
      if (harness === "agy") { expect(out.exitCode).toBe(0); expect(JSON.parse(out.stdout.toString()).decision).toBe("deny"); }
      else if (harness === "cursor") { expect(out.exitCode).toBe(0); expect(JSON.parse(out.stdout.toString()).permission).toBe("deny"); }
      else { expect(out.exitCode).toBe(2); expect(out.stderr.toString().length).toBeGreaterThan(0); }
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

test("git add can stage the exact admitted policy pair but cannot stage invalid policy or write it", () => {
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
  expect(command("ls .pregate/private-state/").cause).toBe("protected-path");
  put(join(root, PRESET), text);
  put(join(root, LOCK), "{}");
  expect(command(files).cause).toBe("protected-path");
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
  expect(command("pregate approve --yes --digest " + "a".repeat(64)).verdict).toBe("deny");
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
  expect(run(s, "node scripts/gen.js").cause).toBe("shell-write");
  // Committed in the session: the base is the commit the session began on.
  git(root, "add", "."); git(root, "commit", "-qm", "changed in the session");
  expect(run(s, "node scripts/gen.js").cause).toBe("shell-write");
  // Restored to the base text: the project's program again.
  put(join(root, "scripts/gen.js"), writer);
  expect(run(s, "node scripts/gen.js").verdict).toBe("none");
  // New in the session, in the project or outside every root.
  put(join(root, "scripts/new.js"), writer);
  put(join(area, "outside-writer.js"), writer);
  expect(run(s, "node scripts/new.js").cause).toBe("shell-write");
  expect(run(s, `node '${join(area, "outside-writer.js")}'`).cause).toBe("shell-write");
  // A new test file with literal imports of modules that do not write runs; one that imports a writer does not.
  put(join(root, "src/domain/b.test.js"), "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { a } from './a.js';\ntest('a', () => assert.equal(a, 1));\n");
  put(join(root, "src/domain/c.test.js"), "import { test } from 'node:test';\nimport { writeFileSync } from 'node:fs';\ntest('c', () => writeFileSync('src/domain/a.ts', 'x'));\n");
  expect(run(s, "node --test src/domain/b.test.js").verdict).toBe("none");
  expect(run(s, "node --test src/domain/c.test.js").cause).toBe("shell-write");
  // A project test file that already imports `vm`, edited in the session: it runs while it gains no sink.
  const tested = join(root, "src/domain/a.test.js"), base = readFileSync(tested, "utf8");
  put(tested, `${base}test('more', () => a === 1);\n`);
  expect(run(s, "node --test src/domain/a.test.js").verdict).toBe("none");
  put(tested, `${base}test('more', () => vm.runInNewContext('2'));\n`);
  expect(run(s, "node --test src/domain/a.test.js").cause).toBe("shell-write");
  put(tested, `${base}import { writeFileSync } from 'node:fs';\n`);
  expect(run(s, "node --test src/domain/a.test.js").cause).toBe("shell-write");
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
  const briefing = { verdict: "none", full: "PREGATE is active", compact: "", notice: "for the human", halt: false } as unknown as Parameters<typeof HARNESSES["claude-code"]["encode"]>[1];
  const reply = HARNESSES["claude-code"].encode("session-start", briefing, true);
  expect(reply.exit).toBe(0);
  expect(JSON.parse(reply.stdout)).toEqual({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: "PREGATE is active" } });
  // A problem with the contract is the session's notice, not a subagent's context.
  expect(HARNESSES["claude-code"].encode("session-start", { ...briefing, verdict: "deny" } as typeof briefing, true)).toEqual({ stdout: "", stderr: "", exit: 0 });
  expect(JSON.parse(HARNESSES["claude-code"].encode("session-start", briefing).stdout)).toEqual({
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
    for (const command of [`printf changed > '${join(root, PRESET)}'`, "git commit --no-verify", "pregate disable --yes"]) {
      expect(onPreCommand({ session: s, callId: "protected", tool: "Bash", cwd: root, command }).verdict).toBe("deny");
    }
    expect(traced).not.toHaveBeenCalled();
    const forged = JSON.parse(readFileSync(join(root, LOCK), "utf8"));
    forged.scope = ["unrelated/**"];
    put(join(root, LOCK), lockText(forged));
    expect(onPreCommand({ session: s, callId: "write", tool: "Bash", cwd: root,
      command: `echo changed > '${join(root, "src/domain/a.ts")}'` }).cause).toBe("shell-write");
    expect(traced).toHaveBeenCalledTimes(1);
    expect(lockOf(root)).toBe("lock-stale");
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
      command: `echo changed > '${join(root, "src/domain/a.ts")}'` }).cause).toBe("shell-write");
  });
});

test("shell scope admission remains per-root for sibling and nested destinations", () => {
  const root = repo();
  const sibling = repo("sibling");
  const nested = repo("repo/nested");
  const s = session();
  for (const destination of [sibling, nested]) {
    expect(onPreCommand({ session: s, callId: "other-root", tool: "Bash", cwd: root,
      command: `echo changed > '${join(destination, "src/domain/a.ts")}'` }).cause).toBe("shell-write");
  }
  expect(state.roots(state.key(s)).sort()).toEqual([root, sibling, nested].sort());
  const forged = JSON.parse(readFileSync(join(sibling, LOCK), "utf8"));
  forged.scope = [];
  put(join(sibling, LOCK), lockText(forged));
  expect(onPreCommand({ session: s, callId: "forged-sibling", tool: "Bash", cwd: root,
    command: `echo changed > '${join(sibling, "other.txt")}'` }).cause).toBe("shell-write");
});

test.each(["codex", "agy", "cursor"] as const)("%s initial contract review denies agent approval and protects the candidate without activating project rules", async harness => {
  const root = canonical(join(area, "initial"));
  put(join(root, "src/a.ts"), "export const a = 1;\n");
  const proposal = proposeContract({ root, lockText: "{}", baseline: state.sha256(""), writes: [] });
  const digest = state.sha256(JSON.stringify(proposal));
  const s = session(harness);
  const command = { session: s, callId: "initial-approval", tool: "Bash", cwd: join(root, "src"), command: `pregate approve --yes --digest ${digest}` };
  expect(inert({ kind: "pre-command", command })).toBe(false);
  const denied = onPreCommand(command);
  expect(denied.verdict).toBe("deny");
  expect(denied.full).toContain(`run ${command.command} in a separate terminal`);
  expect(denied.full).not.toContain(`! ${command.command}`);
  for (const script of [`env pregate approve --yes --digest ${digest}`, `sh -c 'pregate approve --yes --digest ${digest}'`, "pregate init --yes", "rm -rf .pregate",
    "P=pre; ${P}gate approve --yes", "$(echo pregate) approve --yes"]) {
    expect(onPreCommand({ ...command, cwd: root, command: script }).verdict).toBe("deny");
  }
  const write = change(root, PRESET, { form: "full", content: "{}" }, s);
  expect(inert({ kind: "pre-edit", changes: [write] })).toBe(false);
  expect((await onPreEdit([write])).cause).toBe("protected-path");
  expect((await onPreEdit([change(root, "src/a.ts", { form: "full", content: "export const a = ;" }, s)])).verdict).toBe("none");
  expect(onPreCommand({ ...command, command: "pregate approve --preview" }).verdict).toBe("none");
  expect(onPreCommand({ ...command, command: `echo ordinary > '${join(root, "src/new.ts")}'` }).verdict).toBe("none");
  expect(readProposal(root)).toEqual(proposal);
  expect(enabled(root)).toBe(false);
  expect(existsSync(join(root, PRESET))).toBe(false);
  expect(state.roots(state.key(s))).toEqual([]);
  const malformed: Rejected = { cause: "payload-unrecognized", kind: "pre-command", reentry: false, session: null, dirs: [join(root, "src")] };
  expect(inert(malformed)).toBe(false);
  expect(rejected(malformed).verdict).toBe("deny");
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

test("a directory without git denies the hook, Stop and check", async () => {
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
  expect(pre.verdict).toBe("deny");
  expect(pre.cause).toBe("git-not-repository");
  expect(inert({ kind: "stop", session: s, cwd: root, reentry: false })).toBe(false);
  const stop = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(stop.verdict).toBe("deny");
  expect(stop.cause).toBe("git-not-repository");
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
  expect(blocked.full).toContain("pregate preset show");
  expect(blocked.full).toContain("do not run a source pre-check on policy files");
  expect(onPreCommand({ session: s, callId: "policy-show", tool: "Bash", cwd: root, command: "pregate preset show" }).verdict).toBe("none");

  // No folder-wide exception: source still has the suppression/placement guard.
  const source = exclude.length ? ".pregate/hidden.ts" : "src/domain/suppression.ts";
  put(join(root, source), "// eslint-disable-next-line\nexport const value = 1;\n");
  const breach = await onStop({ kind: "stop", session: s, cwd: root, reentry: false });
  expect(breach.verdict).toBe("deny");
  expect(breach.violations).toContainEqual(expect.objectContaining({ path: source,
    rule: exclude.length ? "core/EVA-SCOPE-001" : "core/EVA-SUP-001" }));
  rmSync(join(root, source));

  // Complete compilation still rejects modified contract bytes before the exception.
  put(join(root, LOCK), result.text.replace("eslint-disable", "eslint-allow"));
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).cause).toBe("lock-stale");
  expect((await check(root, { kind: "tree" })).code).toBe(1);
  put(join(root, LOCK), result.text);
  put(join(root, PRESET), text.replace('"include":["**"]', '"include":["src/**"]'));
  const stale = session("agy", "stale-preset");
  onPreCommand({ session: stale, callId: "inspect-stale", tool: "Bash", cwd: root, command: "git status" });
  expect((await onStop({ kind: "stop", session: stale, cwd: root, reentry: false })).cause).toBe("lock-stale");
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
  expect(invalid.verdict).toBe("deny");
  expect(invalid.cause).not.toBeNull();
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
    expect(event.verdict).toBe(["invalid-edit", "blocked-command"].includes(event.callId) ? "deny" : "none");
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

test("affected baseline snapshot batch causes deny and halt without permitting importers", async () => {
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
    expect(decision.verdict).toBe("deny"); expect(decision.halt).toBe(true); expect(decision.cause).toBe("snapshot-missing");
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

test.each(["export const a = 3;\n", "export const a = ;\n"])("a lost dirty baseline still halts deferred Pre before permitting %s", async (content) => {
  const root = repo();
  put(join(root, "src/domain/a.ts"), "export const a = 2;\n");
  const s = session();
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  const snap = state.snapshot(state.key(s), root);
  if (snap === null || snap === "missing") throw new Error("Missing test snapshot");
  rmSync(join(state.sessionDir(state.key(s)), "blobs", snap.dirty["src/domain/a.ts"]!));
  const d = await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content }, s)]);
  expect(d.verdict).toBe("deny"); expect(d.halt).toBe(true); expect(d.cause).toBe("snapshot-missing");
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
  expect(onPreCommand(command(`git commit -m '${body}' --no-verify`)).verdict).toBe("deny");
  for (const count of [255, 256, 4096]) expect(onPreCommand(command(`echo '${"a".repeat(count)}'`)).verdict).toBe("none");
  expect(onPreCommand(command(`unknown '.pregate/${"a".repeat(500)}'`)).cause).toBe("protected-path");
  expect(onPreCommand(command(`echo x > ${"a".repeat(500)}`)).cause).toBe("shell-write");
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
      expect((await onPreEdit([c])).verdict).toBe("none");
      expect(onPreCommand({ session: c.session, callId: "shell", tool: "Bash", cwd: dir, command: "pregate uninstall" }).verdict).toBe("none");
      enable(dir);
    }
    expect(enabled(dir)).toBe(true);
    expect((await onPreEdit([c])).cause).toBe("syntax");
    disable(dir);
    expect(enabled(dir)).toBe(false);
    expect((await onPreEdit([c])).verdict).toBe("none");
  }
  // Disabling a worktree withdraws repository consent; the worktree enabled by name keeps its own.
  expect(enabled(root)).toBe(true);
  const other = canonical(join(area, "worktree-2"));
  git(root, "worktree", "add", "-q", other, "-b", "consent-test-2");
  expect(enabled(other)).toBe(false);
  enable(root);
  expect(enabled(other)).toBe(true);
  expect(enabled(worktree)).toBe(false);
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
  expect((await onPreEdit([change(tree, "src/domain/b.ts", { form: "full", content: "export const b = ;\n" }, agent)])).verdict).toBe("none");
  expect(onPreCommand({ session: agent, callId: "ls-2", tool: "Bash", cwd: tree, command: "git status" }).verdict).toBe("none");
  put(join(tree, "src/domain/b.ts"), "export const b = ;\n");
  git(root, "worktree", "remove", "--force", tree);
  expect((await onStop({ kind: "stop", session: s, cwd: root, reentry: false })).verdict).toBe("none");
});

test.each(["claude-code", "codex"] as const)("%s subagents: child checks are scoped and the parent's existing backstop is retained", async (harness) => {
  const root = repo(`subagents-${harness}`);
  const parent = session(harness, `subagents-${harness}`);
  const agent = { ...parent, agentId: "worker" };
  let turn = 0;
  const stop = (s: Session) => onStop({ kind: "stop", session: { ...s, turnId: `scope-${++turn}` }, cwd: root, reentry: false });
  onSessionStart({ kind: "session-start", session: parent, cwd: root });
  expect((await onPreEdit([change(root, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" }, agent)])).verdict).toBe("none");
  put(join(root, "src/domain/a.ts"), "export const a = ;\n");
  expect((await stop(parent)).verdict).toBe(harness === "codex" ? "deny" : "none");
  expect((await stop({ ...parent, agentId: "reader" })).verdict).toBe("none");
  expect((await stop(agent)).cause).toBe("syntax");
  expect((await stop(parent)).verdict).toBe(harness === "codex" ? "deny" : "none");
  if (harness === "codex") put(join(root, "src/domain/a.ts"), "export const a = 2;\n");
  expect((await onPreEdit([change(root, "src/domain/c.ts", { form: "full", content: "export const c = 1;\n" }, parent)])).verdict).toBe("none");
  put(join(root, "src/domain/c.ts"), "export const c = ;\n");
  const own = await stop(parent);
  expect(own.cause).toBe("syntax");
  expect(own.full).toContain("src/domain/c.ts");
  put(join(root, "src/domain/c.ts"), "export const c = 1;\n");
  put(join(root, "src/domain/a.ts"), "export const a = 2;\n");
  expect((await stop(agent)).verdict).toBe("none");
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
  expect((await onStop({ kind: "stop", session: child, cwd: root, reentry: false })).verdict).toBe("none");
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
  expect((await stop()).verdict).toBe("none");
  git(root, "checkout", "-q", "-");
  git(root, "merge", "-q", "--ff-only", "theirs");
  expect((await stop()).verdict).toBe("none");
  put(join(root, "src/domain/theirs.ts"), "export const theirs = ;\nexport const more = 1;\n");
  expect((await stop()).cause).toBe("syntax");
  git(root, "checkout", "-q", "src/domain/theirs.ts");
  put(join(root, "src/domain/mine.ts"), "export const mine = ;\n");
  git(root, "add", "."); git(root, "commit", "-qm", "my work through the shell");
  const mine = await stop();
  expect(mine.cause).toBe("syntax");
  expect(mine.full).toContain("src/domain/mine.ts");
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
    expect((await stopOf(root, s)).verdict).toBe("none");
    git(root, "merge", "-q", "--no-ff", "--no-commit", "later");
    expect((await stopOf(root, s)).verdict).toBe("none");
    put(join(root, "src/domain/later.ts"), "export const later = ;\n");
    const evil = await stopOf(root, s);
    expect(evil.cause).toBe("syntax");
    expect(evil.full).toContain("src/domain/later.ts");
    git(root, "add", ".");
    git(root, "commit", "-q", "--no-edit");
    expect((await stopOf(root, s)).full).toContain("src/domain/later.ts");
  });

  test("a branch created during the session is charged when merged, in progress or committed", async () => {
    const root = repo("merge-launder"), s = session("claude-code", "merge-launder");
    commit(root, "src/domain/b.ts", "export const b = 1;\n", "main");
    onSessionStart({ kind: "session-start", session: s, cwd: root });
    git(root, "checkout", "-q", "-b", "side", "HEAD~1");
    commit(root, "src/domain/side.ts", broken, "side");
    git(root, "checkout", "-q", "-");
    git(root, "merge", "-q", "--no-ff", "--no-commit", "side");
    expect((await stopOf(root, s)).full).toContain("src/domain/side.ts");
    git(root, "commit", "-q", "--no-edit");
    expect((await stopOf(root, s)).full).toContain("src/domain/side.ts");
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
  const emission = HARNESSES[harness].encode("stop", last);
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

test("incomplete Stop persists the evaluation failure when a human must repair the contract", async () => {
  const root = repo();
  const s = session();
  onSessionStart({ kind: "session-start", session: s, cwd: root });
  put(join(root, LOCK), "invalid lock");
  const stop = (reentry: boolean) => onStop({ kind: "stop", session: s, cwd: root, reentry });
  expect((await stop(false)).verdict).toBe("deny");
  const last = await stop(true);
  expect(last.stopIncomplete).toEqual({ reason: "human-cause", cause: "lock-stale" });
  const result = JSON.parse(report(["--repo", root, "--json"]).text);
  expect(result.incompleteStops[0]).toMatchObject({ cause: "lock-stale", reason: "human-cause", violations: [] });
  expect(result.incompleteStops[0].message).toContain("preset diagnose --json");
  expect(result.incompleteStops[0].message).toContain("update --project --preview");
});

describe("multi-file overlay", () => {
  test("one edit call admits each root once, while the next call revalidates changed lock bytes", async () => {
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
      expect((await onPreEdit([changes[0]!])).cause).toBe("lock-stale");
      expect(traced).toHaveBeenCalledTimes(1);
      traced.mockClear();
      put(join(first, LOCK), old);
      // The stale lock never reached the cache, so restoring the admitted bytes is a cache hit.
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
    expect(d.verdict).toBe("deny");
    expect(d.cause).toBe("unresolvable-import");
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

  test("every blocked file is recorded and contributes to the merged reason", async () => {
    const root = repo();
    const d = await onPreEdit([
      change(root, "src/domain/bad.ts", { form: "full", content: "export const bad = ;\n" }),
      change(root, "src/domain/also-bad.ts", { form: "full", content: "export const other = ;\n" }),
    ]);
    expect(d.verdict).toBe("deny");
    expect(d.full).toContain("bad.ts");
    expect(d.full).toContain("also-bad.ts");
    for (const rel of ["bad.ts", "also-bad.ts"]) expect(events(session(), join(root, "src/domain", rel))[0]!.verdict).toBe("deny");
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
  test("a root in any directory, or a previously registered root, denies", () => {
    const root = repo();
    expect(rejected(refusal([area, root])).verdict).toBe("deny");
    onSessionStart({ kind: "session-start", session: session(), cwd: root });
    expect(rejected(refusal([area])).verdict).toBe("deny");
    expect(rejected(refusal([area], session("codex"))).verdict).toBe("none");
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
  test("an enabled preset the session has not accepted is denied, not skipped", async () => {
    const root = repo("unaccepted", false);
    const ctime = statSync(join(root, PRESET)).ctimeMs;
    const clock = spyOn(Date, "now").mockReturnValue(ctime - 10_000);
    try {
      const d = await onPreEdit([change(root, "src/domain/bad.ts", { form: "full", content: "export const bad = ;" })]);
      expect(d.verdict).toBe("deny");
      expect(d.cause).toBe("lock-stale");
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
  test("#42: an unaccepted nested checkout is named itself, not the outer root's contract", async () => {
    const root = repo();
    onSessionStart({ kind: "session-start", session: session(), cwd: root });
    await Bun.sleep(10);
    const worktree = join(root, "worktrees/feature");
    git(root, "init", "-q", worktree);
    preset(worktree);
    enable(worktree);
    const d = await onPreEdit([change(worktree, "src/domain/a.ts", { form: "full", content: "export const a = 2;\n" })]);
    expect(d.cause).toBe("lock-stale");
    expect(d.full).toContain(`${canonical(worktree)} has its own PREGATE contract, which this session did not open`);
    expect(d.full).toContain(`start a new agent session in ${canonical(worktree)}`);
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
  test("pins below FLOOR, prereleases of FLOOR and invalid versions are stale, never redirected", () => {
    const root = repo();
    for (const v of ["0.0.0", `${FLOOR}-rc.1`, "garbage", "../../outside", "0.0.1\n", null]) {
      pin(root, v);
      expect(pinned(root)).toBeNull();
      expect(lockOf(root)).toBe("lock-stale");
    }
    pin(root, FLOOR);
    expect(pinned(root)).toBe(FLOOR === VERSIONS.engine ? null : FLOOR);
    pin(root, "0.10.0");
    expect(pinned(root)).toBe("0.10.0");
    pin(root, VERSIONS.engine);
    expect(pinned(root)).toBeNull();
  });
  test("redirection uses edit targets, commands' cwd, event cwd and rejected directories", () => {
    const root = repo();
    pin(root, "9.9.9");
    const edit: HookEvent = { kind: "pre-edit", changes: [change(area, "outside.ts", { form: "full", content: "x" }), change(root, "src/a.ts", { form: "full", content: "x" })] };
    expect(redirect(edit)).toBe("9.9.9");
    expect(redirect({ kind: "pre-command", command: { session: session(), callId: "c", tool: "Bash", command: "pwd", cwd: root } })).toBe("9.9.9");
    expect(redirect({ kind: "stop", cwd: root, session: session(), reentry: false })).toBe("9.9.9");
    expect(redirect({ kind: "session-start", cwd: root, session: session() })).toBe("9.9.9");
    expect(redirect({ kind: "pre-edit", cause: "payload-unrecognized", dirs: [root], session: null, reentry: false })).toBe("9.9.9");
    expect(existsSync(state.stateDir())).toBe(false);
  });
  test("old locks cannot delegate the installed engine's recovery previews to an old guard", () => {
    const root = repo();
    pin(root, "0.2.6");
    for (const harness of ["claude-code", "codex", "grok", "agy", "cursor"] as const) {
      const command = (text: string): HookEvent => ({ kind: "pre-command", command: { session: session(harness), callId: "recovery", tool: "shell", command: text, cwd: root } });
      for (const args of ["update --project --preview", "pack update --all --preview", "preset diagnose --json", "preset schema", "update --help", "guide --json", "guide --preview", "guide --preview --packs typescript --enforcement shadow"]) {
        const text = `'${launcher()}' ${args}`;
        expect(redirect(command(text))).toBeNull();
        expect(onPreCommand((command(text) as Extract<HookEvent, { kind: "pre-command" }>).command).verdict).toBe("none");
        for (const suffix of [" > .pregate/preset.json", "; echo x > src/a.ts", " --yes"]) expect(redirect(command(text + suffix))).toBe("0.2.6");
      }
      expect(redirect(command("pregate check --all"))).toBe("0.2.6");
      expect(redirect(command("pregate approve --yes"))).toBe("0.2.6");
      for (const text of ["pregate guide", "pregate guide --yes", "pregate guide --json --preview", "pregate guide --preview --unknown",
        "env pregate guide --json", "sh -c 'pregate guide --preview'"]) {
        expect(redirect(command(text))).toBe("0.2.6");
        expect(onPreCommand((command(text) as Extract<HookEvent, { kind: "pre-command" }>).command).verdict).toBe("deny");
      }
    }
  });
  test("CLI delegation explains missing, empty and non-executable pinned engines", () => {
    const root = repo();
    pin(root, "9.9.9");
    const data = join(area, "install");
    const engine = join(data, "9.9.9", ENGINE_FILE);
    for (const mode of WINDOWS ? ["missing", "empty"] : ["missing", "empty", "not-executable"]) {
      if (mode !== "missing") {
        put(engine, mode === "empty" ? "" : "not an executable");
        chmodSync(engine, mode === "empty" ? 0o755 : 0o644);
      }
      const d = delegate(root, ["check", "--staged"], data);
      expect(d?.code).toBe(1);
      expect(d?.text).toContain("pregate update --engine 9.9.9");
    }
  });
  test("CLI delegation preserves argv, stdin, stdout, stderr and the real engine's exit code", async () => {
    const root = repo();
    pin(root, VERSIONS.engine);
    const data = join(area, "install");
    const engine = join(data, VERSIONS.engine, ENGINE_FILE);
    engineAt(engine);
    const driver = join(area, "delegate.ts");
    put(driver, `import { delegate, VERSIONS } from ${JSON.stringify(join(import.meta.dir, "../src/gate.ts"))};\nVERSIONS.engine = "0.0.0";\nconst r = delegate(process.argv[2]!, process.argv.slice(4), process.argv[3]!);\nif (r?.text) console.error(r.text);\nprocess.exit(r?.code ?? 42);\n`);
    const built = await Bun.build({ entrypoints: [driver], target: "bun", outdir: area, naming: "delegate.js" });
    expect(built.success).toBe(true);
    const raw = JSON.parse(readFileSync(join(import.meta.dir, "payloads/pre-write.json"), "utf8"));
    raw.cwd = root;
    raw.tool_input.file_path = join(root, "src/domain/bad.ts");
    const env = { ...process.env };
    const run = (argv: string[], input: string) => {
      const child = spawnSync(argv[0]!, argv.slice(1), { cwd: root, env, input, stdio: ["pipe", "pipe", "pipe"], timeout: 5_000 });
      expect(child.error).toBeUndefined(); expect(child.signal).toBeNull();
      return { exitCode: child.status, stdout: child.stdout.toString(), stderr: child.stderr.toString() };
    };
    const commands = [["--version"], ["unknown-command"], ["check", "--stdin", "--path", join(root, "src/domain/a.ts")], ["hook", "pre", "--harness", "claude-code"]];
    for (const argv of commands) {
      const direct = await run([engine, ...argv], JSON.stringify(raw));
      const through = await run([process.execPath, join(area, "delegate.js"), root, data, ...argv], JSON.stringify(raw));
      expect({ argv, exitCode: through.exitCode }).toEqual({ argv, exitCode: direct.exitCode });
      expect(through.stdout).toBe(direct.stdout);
      expect(through.stderr).toBe(direct.stderr);
    }
    expect(delegate(area, ["--version"], data)).toBeNull();
    pin(root, VERSIONS.engine);
    const start = JSON.parse(readFileSync(join(import.meta.dir, "payloads/session-start.json"), "utf8"));
    start.cwd = root;
    const context = await run([engine, "hook", "session-start", "--harness", "claude-code"], JSON.stringify(start));
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
  const pluginHooks = join(process.env.HOME!, ".gemini/config/plugins/pregate-global/hooks.json");
  put(pluginHooks, "{}\n");
  expect(onPreCommand({ session: s, callId: "cmd-read", tool: "run_command", command: `cat "${pluginHooks}"`, cwd: root })).toMatchObject({ verdict: "deny", cause: "protected-path" });
  for (const rel of [".gemini/config/plugins/pregate-global/hooks.json", ".gemini/antigravity/settings.json", ".gemini/antigravity-cli/settings.json"]) {
    const target = join(process.env.HOME!, rel);
    put(target, "{}\n");
    const edit = await onPreEdit([change(dirname(target), basename(target), { form: "full", content: "{}\n" }, s)]);
    expect(edit).toMatchObject({ verdict: "deny", cause: "protected-path" });
    const cmd = onPreCommand({ session: s, callId: "cmd", tool: "run_command", command: `echo '{}' > "${target}"`, cwd: root });
    expect(cmd).toMatchObject({ verdict: "deny", cause: "protected-path" });
  }
});
