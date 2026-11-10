import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// The same entry the hook runs: proposed source arrives on stdin and the gate reports JS-EVAL-001.
// The compiled engine, built once for the test process: it is what ships, and it starts faster
// than the source entry on every platform.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-js-eval-"));
afterAll(() => removeTree(area));

const indirect = `export function zero(code: string) {
  return (0, eval)(code);
}

export function one(code: string) {
  return (1, eval)(code);
}

export function blank(code: string) {
  return (void 0, eval)(code);
}

export function browser(code: string) {
  return window.eval(code);
}

export function globalEval(code: string) {
  return globalThis.eval(code);
}
`;

const negative = `export function run(code: string) {
  return evaluate(code);
}

export function score(item: { evaluate(value: string): string }) {
  return item.evaluate(item);
}

export function other(code: string) {
  return (0, evaluate)(code);
}

const sample = "(0, eval)(code)";
export const note = sample;
`;

const indirectJs = `export function run(code) {
  return (0, eval)(code);
}
`;

const negativeJs = `export function run(code) {
  return evaluate(code);
}

export function score(item) {
  return item.evaluate(item);
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
  return { root, put, run, git };
}

test("javascript pack fixtures accept the indirect eval cases", () => {
  const root = project("fixtures");
  const tested = root.run(["rules", "test", "--library", "javascript"]);
  expect(tested.code, tested.text).toBe(0);
  expect(tested.text).toContain("ok   javascript/safety/no-eval-call");
}, 60_000);

test("stdin check denies indirect eval and allows names that only contain those letters", () => {
  const p = project("gate");
  p.put("package.json", '{ "name": "sample" }\n');
  p.put("src/ok.ts", "export const ready = true;\n");
  p.git("init", "-q");
  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(p.run(["pack", "add", "--library", "javascript", "--source-only", "--yes"]).code).toBe(0);
  expect(p.run(["pack", "enable", "javascript/safety", "--only", "JS-EVAL-001", "--yes"]).code).toBe(0);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge JS-EVAL-001 in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");

  const denied = p.run(["check", "--stdin", "--path", "src/proposed.ts"], indirect);
  expect(denied.code, denied.text).toBe(1);
  expect(denied.text).toContain("javascript/JS-EVAL-001");
  expect(denied.text).toContain("javascript/safety/no-eval-call@1.0.1");
  expect(denied.text).toContain("src/proposed.ts:2");
  expect(denied.text).toContain("src/proposed.ts:6,10,14,18");

  const allowed = p.run(["check", "--stdin", "--path", "src/proposed.ts"], negative);
  expect(allowed.code, allowed.text).toBe(0);
  expect(allowed.text).not.toContain("JS-EVAL-001");
  expect(allowed.text).toContain("no introduced violations");

  const deniedJs = p.run(["check", "--stdin", "--path", "src/proposed.js"], indirectJs);
  expect(deniedJs.code, deniedJs.text).toBe(1);
  expect(deniedJs.text).toContain("javascript/JS-EVAL-001");
  expect(deniedJs.text).toContain("src/proposed.js:2");

  const allowedJs = p.run(["check", "--stdin", "--path", "src/proposed.js"], negativeJs);
  expect(allowedJs.code, allowedJs.text).toBe(0);
  expect(allowedJs.text).not.toContain("JS-EVAL-001");
}, 120_000);
