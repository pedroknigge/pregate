import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled entrypoint: check and the hook see the same Node.js pin gate a repository does.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-node-pin-"));
afterAll(() => removeTree(area));

const stale = "22.23.4\n";
const patched = "22.23.5\n";
const range = "22\n";
const dockerfile = "FROM node:24.22.2\n";
const workflow = `name: ci
jobs:
  test:
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 26.13.0
`;

function project(name: string) {
  const root = join(area, name);
  const machine = join(area, `${name}-machine`);
  mkdirSync(root);
  const env = {
    ...process.env,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(machine, "home"),
    USERPROFILE: join(machine, "home"),
    XDG_DATA_HOME: join(machine, "data"),
    XDG_STATE_HOME: join(machine, "state"),
    XDG_CONFIG_HOME: join(machine, "config"),
    CODEX_HOME: join(machine, "codex"),
    GROK_HOME: join(machine, "grok"),
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const out = Bun.spawnSync([cli, ...args], {
      cwd: root, env, stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe", stderr: "pipe", timeout: 45_000,
    });
    if (out.signalCode) throw new Error(`${args.join(" ")} terminated: ${out.signalCode}\n${out.stderr.toString()}`);
    return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString(), text: out.stdout.toString() + out.stderr.toString() };
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  const hook = (event: string, sid: string, fields: object = {}) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: event,
    permission_mode: "acceptEdits", prompt_id: "turn", ...fields,
  }));
  return { root, put, run, git, hook };
}

test("the node pack fixtures pass through the CLI", () => {
  const root = project("fixtures");
  const tested = root.run(["rules", "test", "--library", "node"]);
  expect(tested.code, tested.text).toBe(0);
  expect(tested.text).toContain("ok   node/supply/require-node-pin");
}, 60_000);

test("an enabled project warns on a stale exact pin and stays quiet for a patched pin or a range", () => {
  const p = project("gate");
  const captured: string[] = [];
  const show = <T extends { code: number; text: string }>(label: string, out: T): T => {
    captured.push(`$ ${label}\nexit ${out.code}\n${out.text.trim()}\n`);
    return out;
  };
  p.put("package.json", '{ "name": "sample" }\n');
  p.git("init", "-q");
  p.git("add", "-A");
  p.git("commit", "-qm", "start");

  const sid = randomUUID();
  const before = show("hook before enable", p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "before", tool_input: { file_path: join(p.root, ".nvmrc"), content: stale },
  }));
  expect(before.code, before.text).toBe(0);
  expect(before.text).not.toContain("NODE-PIN-001");

  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(p.run(["pack", "add", "--library", "node", "--source-only", "--yes"]).code).toBe(0);
  expect(p.run(["pack", "enable", "node/operations", "--only", "NODE-PIN-001", "--yes"]).code).toBe(0);

  const shadow = show("check --stdin shadow", p.run(["check", "--stdin", "--path", ".nvmrc"], stale));
  expect(shadow.code, shadow.text).toBe(0);
  expect(shadow.text).toContain("PREGATE WARN node/NODE-PIN-001");
  expect(shadow.text).toContain("Bump this exact Node.js pin to 22.23.5.");

  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge the Node.js pin warning in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);

  const checked = show("check --stdin .nvmrc", p.run(["check", "--stdin", "--path", ".nvmrc"], stale));
  expect(checked.code, checked.text).toBe(0);
  expect(checked.text).toContain("PREGATE WARN node/NODE-PIN-001 .nvmrc:1 Bump this exact Node.js pin to 22.23.5.");
  expect(checked.text).not.toContain("22.23.4");

  const current = show("check --stdin patched", p.run(["check", "--stdin", "--path", ".nvmrc"], patched));
  expect(current.code, current.text).toBe(0);
  expect(current.text).not.toContain("NODE-PIN-001");

  const major = show("check --stdin range", p.run(["check", "--stdin", "--path", ".nvmrc"], range));
  expect(major.code, major.text).toBe(0);
  expect(major.text).not.toContain("NODE-PIN-001");

  const image = show("check --stdin Dockerfile", p.run(["check", "--stdin", "--path", "Dockerfile"], dockerfile));
  expect(image.code, image.text).toBe(0);
  expect(image.text).toContain("Bump this exact Node.js pin to 24.22.3.");

  const ci = show("check --stdin workflow", p.run(["check", "--stdin", "--path", ".github/workflows/ci.yml"], workflow));
  expect(ci.code, ci.text).toBe(0);
  expect(ci.text).toContain("Bump this exact Node.js pin to 26.13.1.");

  const eol = show("check --stdin eol", p.run(["check", "--stdin", "--path", ".nvmrc"], "20.18.1\n"));
  expect(eol.code, eol.text).toBe(0);
  expect(eol.text).not.toContain("NODE-PIN-001");

  const warned = show("hook stale .nvmrc", p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "stale", tool_input: { file_path: join(p.root, ".nvmrc"), content: stale },
  }));
  expect(warned.code, warned.text).toBe(0);
  expect(warned.stdout).not.toContain('"permissionDecision":"deny"');
  expect(warned.text).toContain("PREGATE WARN node/NODE-PIN-001");
  expect(warned.text).toContain("Bump this exact Node.js pin to 22.23.5.");

  const allowed = show("hook patched .nvmrc", p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "patched", tool_input: { file_path: join(p.root, ".node-version"), content: patched },
  }));
  expect(allowed.code, allowed.text).toBe(0);
  expect(allowed.text).not.toContain("NODE-PIN-001");

  const floating = show("hook range .nvmrc", p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "range", tool_input: { file_path: join(p.root, ".tool-versions"), content: "node 22\n" },
  }));
  expect(floating.code, floating.text).toBe(0);
  expect(floating.text).not.toContain("NODE-PIN-001");

  p.put(".nvmrc", stale);
  const tree = show("check --all", p.run(["check", "--all"]));
  expect(tree.code, tree.text).toBe(0);
  expect(tree.text).toContain("PREGATE WARN node/NODE-PIN-001 .nvmrc:1 Bump this exact Node.js pin to 22.23.5.");

  p.put(".nvmrc", patched);
  const clean = show("check --all patched", p.run(["check", "--all"]));
  expect(clean.code, clean.text).toBe(0);
  expect(clean.text).not.toContain("NODE-PIN-001");

  expect(p.run(["disable", "--yes"]).code).toBe(0);
  const disabled = show("hook after disable", p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "disabled", tool_input: { file_path: join(p.root, ".nvmrc"), content: stale },
  }));
  expect(disabled.code, disabled.text).toBe(0);
  expect(disabled.text).not.toContain("NODE-PIN-001");

  writeFileSync("/tmp/node-pin-e2e.txt", captured.join("\n"));
}, 120_000);
