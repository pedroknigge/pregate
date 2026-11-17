import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled hook, on a real git checkout. Warn stays a warning. Deny blocks.
// A checkout that was never enabled does not enforce.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-maint-proxy-"));
afterAll(() => removeTree(area));

const domain = "export function place(): number {\n  return 1;\n}\n";
const grown = "export function place(): number {\n  return 1;\n  return 2;\n}\n";

function project(name: string) {
  const root = join(area, name);
  mkdirSync(root);
  const env = {
    ...process.env,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(area, "home"),
    USERPROFILE: join(area, "home"),
    XDG_DATA_HOME: join(area, "data"),
    XDG_STATE_HOME: join(area, "state"),
    XDG_CONFIG_HOME: join(area, "config"),
    CODEX_HOME: join(area, "codex"),
    GROK_HOME: join(area, "grok"),
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
  const edit = (sid: string, path: string, content: string) => hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: path, tool_input: { file_path: join(root, path), content },
  });
  return { root, put, run, git, hook, edit };
}

function denies(out: { code: number; stdout: string; text: string }, rule: string): void {
  expect(out.code, out.text).toBe(2);
  expect(JSON.parse(out.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(out.text).toContain(rule);
}

function allows(out: { code: number; stdout: string; text: string }, absent: string): void {
  expect(out.code, out.text).toBe(0);
  expect(out.stdout).not.toContain('"permissionDecision":"deny"');
  expect(out.text).not.toContain(absent);
}

test("pack fixtures pass through the compiled CLI", () => {
  const tested = project("fixtures").run(["rules", "test", "--library", "maintainability"]);
  expect(tested.code, tested.text).toBe(0);
  for (const id of ["no-magic-number", "domain-sibling-test", "adr-touch", "todo-needs-issue", "risky-path-needs-flag", "no-size-increase", "no-and-then"]) {
    expect(tested.text).toContain(`ok   maintainability/`);
    expect(tested.text).toContain(id);
  }
}, 60_000);

test("hook pre allows a domain file with no test when the checkout was never enabled", () => {
  const p = project("inert");
  p.put("src/ok.ts", "export const ready = 1;\n");
  p.git("init", "-q");
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  const wrote = p.edit("inert", "src/domain/orders/place.ts", domain);
  allows(wrote, "MAINT-TEST-001");
});

test("an enabled checkout denies, warns, and stays quiet on the proxy false positives", () => {
  const p = project("gate");
  p.put("src/ok.ts", "export const ready = 1;\n");
  p.put("src/hot.ts", domain);
  p.put("src/cold.ts", domain);
  p.git("init", "-q");
  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(p.run(["pack", "enable", "maintainability/proxies", "--yes"]).code).toBe(0);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge the maintainability proxies in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  for (let n = 0; n < 8; n++) {
    p.put("src/hot.ts", domain.replace("return 1;", `return 1; // ${n}\n`));
    p.git("add", "src/hot.ts");
    p.git("commit", "-qm", `touch hot ${n}`);
  }
  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);

  denies(p.edit(sid, "src/domain/orders/place.ts", domain), "maintainability/MAINT-TEST-001");
  p.put("src/domain/orders/place.test.ts", "export const covered = true;\n");
  allows(p.edit(sid, "src/domain/orders/place.ts", domain), "MAINT-TEST-001");
  allows(p.edit(sid, "src/domain/index.ts", "export const barrel = 1;\n"), "MAINT-TEST-001");
  allows(p.edit(sid, "src/app/plain.ts", "export const ready = 1;\n"), "MAINT-TEST-001");

  denies(p.edit(sid, "layers.json", "{}\n"), "maintainability/MAINT-ADR-001");
  p.put("docs/adr/0001-boundary.md", "# Boundary\n");
  allows(p.edit(sid, "layers.json", "{}\n"), "MAINT-ADR-001");
  allows(p.edit(sid, "src/app/notes.ts", "export const note = 1;\n"), "MAINT-ADR-001");

  const magic = p.edit(sid, "src/app/retry.ts", "export function retry(left: number): boolean {\n  return left > 7;\n}\n");
  expect(magic.code, magic.text).toBe(0);
  expect(magic.stdout).not.toContain('"permissionDecision":"deny"');
  expect(magic.text).toContain("maintainability/MAINT-MAGIC-001");
  allows(p.edit(sid, "src/app/status.ts", "export const code = 404;\nconst limit = 42;\nexport const none = -1;\n"), "MAINT-MAGIC-001");

  const joined = p.edit(sid, "src/app/joined.ts", "export function saveAndNotify(): number { return 1; }\n");
  expect(joined.code, joined.text).toBe(0);
  expect(joined.text).toContain("maintainability/MAINT-AND-001");
  allows(p.edit(sid, "src/app/actions.ts", "export function handle(): number { return 1; }\nexport function Candidate(): number { return 1; }\n"), "MAINT-AND-001");

  const todo = p.edit(sid, "src/app/owned.ts", "// TODO(alice): later\nexport const ready = 1;\n");
  expect(todo.code, todo.text).toBe(0);
  expect(todo.text).toContain("maintainability/MAINT-TODO-001");
  allows(p.edit(sid, "src/app/linked.ts", "// TODO #12\nexport const ready = 1;\n"), "MAINT-TODO-001");

  const risky = p.edit(sid, "src/payments/charge.ts", "export function charge(): number { return 1; }\n");
  expect(risky.code, risky.text).toBe(0);
  expect(risky.text).toContain("maintainability/MAINT-FLAG-001");
  allows(p.edit(sid, "src/payments/refund.ts", "import { on } from \"../flags\";\nexport const refund = on;\n"), "MAINT-FLAG-001");
  allows(p.edit(sid, "src/app/catalog.ts", "export function list(): number { return 1; }\n"), "MAINT-FLAG-001");

  const hot = p.edit(sid, "src/hot.ts", grown);
  expect(hot.code, hot.text).toBe(0);
  expect(hot.text).toContain("maintainability/MAINT-CHURN-001");
  allows(p.edit(sid, "src/cold.ts", grown), "MAINT-CHURN-001");
}, 60_000);
