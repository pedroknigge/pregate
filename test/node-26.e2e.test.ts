import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { removeTree } from "./remove-tree.ts";

// The compiled entrypoint: check and hook see the same Node.js 26 gate as a repository does.
const cli = join(import.meta.dir, "../src/main.ts");
const area = mkdtempSync(join(tmpdir(), "pregate-node-26-"));
afterAll(() => removeTree(area));

const writeHeader = `import { createServer } from "node:http";

export function listen() {
  return createServer((_req, res) => {
    res.writeHeader(200);
    res.end("ok");
  });
}
`;
const writeHead = writeHeader.replace("writeHeader", "writeHead");
const streamInternal = `import { Readable } from "node:_stream_readable";

export function open(source: Readable): Readable {
  return source;
}
`;
const register = `import * as module from "node:module";

export function load(url: string) {
  module.register("./hooks.mjs", url);
}
`;

function project(name: string) {
  const root = join(area, name);
  const machine = join(area, "machine");
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
    const out = Bun.spawnSync([process.execPath, cli, ...args], {
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
  expect(tested.text).toContain("ok   node/api/no-write-header");
  expect(tested.text).toContain("ok   node/modules/no-stream-internal");
  expect(tested.text).toContain("ok   node/modules/no-module-register");
}, 60_000);

test("hook and check deny Node.js 26 removals, warn on register, and stay quiet for older targets", () => {
  const p = project("gate");
  p.put("package.json", '{ "name": "sample", "engines": { "node": ">=26" } }\n');
  p.put("src/ok.ts", "export const ready = true;\n");
  p.git("init", "-q");
  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(p.run(["pack", "add", "--library", "node", "--source-only", "--yes"]).code).toBe(0);
  expect(p.run(["pack", "enable", "node/runtime", "--only", "NODE-HEADER-001", "--yes"]).code).toBe(0);
  expect(p.run(["pack", "enable", "node/internals", "--only", "NODE-STREAM-001,NODE-REGISTER-001", "--yes"]).code).toBe(0);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge the Node.js 26 rules in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");

  const header = p.run(["check", "--stdin", "--path", "src/proposed.ts"], writeHeader);
  expect(header.code, header.text).toBe(1);
  expect(header.text).toContain("node/NODE-HEADER-001");
  expect(header.text).toContain("writeHead");

  const internal = p.run(["check", "--stdin", "--path", "src/proposed.ts"], streamInternal);
  expect(internal.code, internal.text).toBe(1);
  expect(internal.text).toContain("node/NODE-STREAM-001");
  expect(internal.text).toContain("node:stream");

  const deprecated = p.run(["check", "--stdin", "--path", "src/proposed.ts"], register);
  expect(deprecated.code, deprecated.text).toBe(0);
  expect(deprecated.text).toContain("PREGATE WARN node/NODE-REGISTER-001");
  expect(deprecated.text).toContain("registerHooks");

  const replacement = p.run(["check", "--stdin", "--path", "src/proposed.ts"], writeHead);
  expect(replacement.code, replacement.text).toBe(0);
  expect(replacement.text).toContain("no introduced violations");

  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);
  const denied = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "header", tool_input: { file_path: join(p.root, "src/proposed.ts"), content: writeHeader },
  });
  expect(denied.code, denied.text).toBe(2);
  expect(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(denied.text).toContain("node/NODE-HEADER-001");
  expect(denied.text).toContain("writeHead");

  const warned = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "register", tool_input: { file_path: join(p.root, "src/hooks.ts"), content: register },
  });
  expect(warned.code, warned.text).toBe(0);
  expect(warned.stdout).not.toContain('"permissionDecision":"deny"');
  expect(warned.text).toContain("node/NODE-REGISTER-001");
  expect(warned.text).toContain("registerHooks");

  p.put("package.json", '{ "name": "sample", "engines": { "node": ">=20" } }\n');
  p.put(".nvmrc", "22\n");
  const older = p.run(["check", "--stdin", "--path", "src/proposed.ts"], writeHeader);
  expect(older.code, older.text).toBe(0);
  expect(older.text).not.toContain("NODE-HEADER-001");
  const olderHook = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "older", tool_input: { file_path: join(p.root, "src/proposed.ts"), content: writeHeader },
  });
  expect(olderHook.code, olderHook.text).toBe(0);
  expect(olderHook.text).not.toContain("NODE-HEADER-001");

  p.put("package.json", '{ "name": "sample" }\n');
  rmSync(join(p.root, ".nvmrc"));
  const undeclared = p.run(["check", "--stdin", "--path", "src/proposed.ts"], writeHeader);
  expect(undeclared.code, undeclared.text).toBe(0);
  expect(undeclared.text).not.toContain("NODE-HEADER-001");

  p.put(".nvmrc", "26\n");
  const pinned = p.run(["check", "--stdin", "--path", "src/proposed.ts"], streamInternal);
  expect(pinned.code, pinned.text).toBe(1);
  expect(pinned.text).toContain("node/NODE-STREAM-001");
}, 120_000);
