import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled entrypoint: the hook and check see the same operations rules a repository does.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-node-ops-"));
afterAll(() => removeTree(area));

const passwordLog = `export function audit(password: string) {
  logger.info({ password });
}
`;
const requestIdLog = `export function audit(requestId: string) {
  logger.info({ requestId });
}
`;
const tokenWord = `export function audit(tokenCount: number) {
  logger.info("invalid token");
  console.log(tokenCount);
}
`;
const listenOnly = `import { createServer } from "node:http";

const server = createServer();
server.listen(3000);
`;
const parsedEnv = `const env = schema.parse(process.env);
export const port = process.env.PORT;
`;
const testEnv = `const port = process.env.PORT;
`;
const crashLog = `process.on("uncaughtException", (error) => {
  console.error(error);
});
`;
const crashRethrow = `process.on("uncaughtException", (error) => {
  throw error;
});
`;
const library = `export function add(left: number, right: number): number {
  return left + right;
}
`;

function project(name: string) {
  const root = join(area, name);
  const machine = join(area, `machine-${name}`);
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
  const write = (sid: string, id: string, path: string, content: string) => hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: id, tool_input: { file_path: join(root, path), content },
  });
  return { root, put, run, git, hook, write };
}

function enforce(p: ReturnType<typeof project>) {
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge the node operations rules in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
}

test("the node pack fixtures pass through the CLI", () => {
  const root = project("fixtures");
  const tested = root.run(["rules", "test", "--library", "node"]);
  expect(tested.code, tested.text).toBe(0);
  expect(tested.text).toContain("ok   node/supply/locked-ci-install");
  expect(tested.text).toContain("ok   node/process/crash-handler-exits");
  expect(tested.text).toContain("ok   node/logging/no-secret-log");
  expect(tested.text).toContain("ok   node/server/require-health-routes");
}, 60_000);

test("operations rules deny, warn, and allow only after the methodology is enabled", () => {
  const p = project("gate");
  p.put("package.json", '{ "name": "sample", "engines": { "node": ">=22" } }\n');
  p.put("src/ok.ts", library);
  p.git("init", "-q");
  const sid = randomUUID();

  const before = p.write(sid, "before", "src/audit.ts", passwordLog);
  expect(before.code, before.text).toBe(0);
  expect(before.text).not.toContain("NODE-LOGSECRET-001");
  expect(before.stdout).not.toContain('"permissionDecision":"deny"');

  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(p.run(["pack", "add", "--library", "node", "--source-only", "--yes"]).code).toBe(0);
  expect(p.run(["pack", "enable", "node/runtime", "--only", "NODE-EXIT-001", "--yes"]).code).toBe(0);
  enforce(p);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);

  const runtimeOnly = p.write(sid, "runtime", "src/audit.ts", passwordLog);
  expect(runtimeOnly.code, runtimeOnly.text).toBe(0);
  expect(runtimeOnly.text).not.toContain("NODE-LOGSECRET-001");
  expect(runtimeOnly.stdout).not.toContain('"permissionDecision":"deny"');

  expect(p.run(["pack", "enable", "node/operations", "--yes"]).code).toBe(0);
  const enabledSession = randomUUID();
  expect(p.hook("SessionStart", enabledSession, { source: "startup" }).code).toBe(0);

  const denied = p.write(enabledSession, "secret", "src/audit.ts", passwordLog);
  expect(denied.code, denied.text).toBe(2);
  expect(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(denied.text).toContain("node/NODE-LOGSECRET-001");

  const allowedId = p.write(enabledSession, "request", "src/audit.ts", requestIdLog);
  expect(allowedId.code, allowedId.text).toBe(0);
  expect(allowedId.text).not.toContain("NODE-LOGSECRET-001");
  expect(allowedId.stdout).not.toContain('"permissionDecision":"deny"');

  const allowedWord = p.write(enabledSession, "word", "src/audit.ts", tokenWord);
  expect(allowedWord.code, allowedWord.text).toBe(0);
  expect(allowedWord.text).not.toContain("NODE-LOGSECRET-001");

  const crash = p.write(enabledSession, "crash", "src/crash.ts", crashLog);
  expect(crash.code, crash.text).toBe(2);
  expect(crash.text).toContain("node/NODE-CRASH-001");

  const rethrow = p.write(enabledSession, "rethrow", "src/crash.ts", crashRethrow);
  expect(rethrow.code, rethrow.text).toBe(0);
  expect(rethrow.text).not.toContain("NODE-CRASH-001");

  const warned = p.write(enabledSession, "listen", "src/server.ts", listenOnly);
  expect(warned.code, warned.text).toBe(0);
  expect(warned.stdout).not.toContain('"permissionDecision":"deny"');
  expect(warned.text).toContain("PREGATE WARN node/NODE-ROUTE-001");
  expect(warned.text).toContain("PREGATE WARN node/NODE-SIGNAL-001");

  const parsed = p.write(enabledSession, "env", "src/config.ts", parsedEnv);
  expect(parsed.code, parsed.text).toBe(0);
  expect(parsed.text).not.toContain("NODE-ENVPARSE-001");

  const tests = p.write(enabledSession, "spec", "src/app.test.ts", testEnv);
  expect(tests.code, tests.text).toBe(0);
  expect(tests.text).not.toContain("NODE-ENVPARSE-001");

  const plain = p.write(enabledSession, "lib", "src/add.ts", library);
  expect(plain.code, plain.text).toBe(0);
  expect(plain.text).not.toContain("NODE-ROUTE-001");
  expect(plain.text).not.toContain("NODE-SIGNAL-001");

  expect(p.run(["disable", "--yes"]).code).toBe(0);
  const disabled = p.write(enabledSession, "after-disable", "src/audit.ts", passwordLog);
  expect(disabled.code, disabled.text).toBe(0);
  expect(disabled.stdout).not.toContain('"permissionDecision":"deny"');
  expect(disabled.text).not.toContain("NODE-LOGSECRET-001");
}, 180_000);
