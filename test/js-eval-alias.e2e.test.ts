import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Proposed source arrives on stdin, the same entry the hook runs. Each new form of JS-EVAL-001
// has to be denied, and each named non-violation has to stay clean, in both JavaScript and TypeScript.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-js-eval-alias-"));
afterAll(() => removeTree(area));

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
  return { put, run };
}

const gate = project("gate");

beforeAll(() => {
  gate.put("package.json", '{ "name": "sample" }\n');
  gate.put("src/ok.ts", "export const ready = true;\n");
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], {
      cwd: join(area, "gate"),
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
      stdout: "pipe", stderr: "pipe", timeout: 20_000,
    });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  git("init", "-q");
  expect(gate.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(gate.run(["pack", "add", "--library", "javascript", "--source-only", "--yes"]).code).toBe(0);
  expect(gate.run(["pack", "enable", "javascript/safety", "--only", "JS-EVAL-001", "--yes"]).code).toBe(0);
  gate.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge JS-EVAL-001 in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const enforced = gate.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(enforced.code, enforced.text).toBe(0);
  git("add", "-A");
  git("commit", "-qm", "baseline");
}, 180_000);

function source(typed: boolean, body: string): string {
  const head = typed ? "export function run(code: string) {" : "export function run(code) {";
  return `${head}\n  ${body}\n}\n`;
}

function denied(path: string, text: string, line: number) {
  const out = gate.run(["check", "--stdin", "--path", path], text);
  expect(out.code, out.text).toBe(1);
  expect(out.text).toContain("javascript/JS-EVAL-001");
  expect(out.text).toContain("javascript/safety/no-eval-call@1.0.2");
  expect(out.text).toContain(`${path}:${line}`);
}

function clean(path: string, text: string) {
  const out = gate.run(["check", "--stdin", "--path", path], text);
  expect(out.code, out.text).toBe(0);
  expect(out.text).not.toContain("JS-EVAL-001");
  expect(out.text).toContain("no introduced violations");
}

const cases: Array<[string, () => void]> = [
  ['JS-EVAL-001 flags window["eval"](code) in TypeScript', () => {
    denied("src/proposed.ts", source(true, 'return window["eval"](code);'), 2);
  }],
  ['JS-EVAL-001 flags globalThis["eval"](code) in TypeScript', () => {
    denied("src/proposed.ts", source(true, 'return globalThis["eval"](code);'), 2);
  }],
  ['JS-EVAL-001 flags self["eval"](code) in TypeScript', () => {
    denied("src/proposed.ts", source(true, 'return self["eval"](code);'), 2);
  }],
  ['JS-EVAL-001 flags global["eval"](code) in TypeScript', () => {
    denied("src/proposed.ts", source(true, 'return global["eval"](code);'), 2);
  }],
  ["JS-EVAL-001 flags a local alias of eval in TypeScript", () => {
    denied("src/proposed.ts", source(true, "const alias = eval;\n  return alias(code);"), 3);
  }],
  ['JS-EVAL-001 flags window["eval"](code) in JavaScript', () => {
    denied("src/proposed.js", source(false, 'return window["eval"](code);'), 2);
  }],
  ['JS-EVAL-001 flags globalThis["eval"](code) in JavaScript', () => {
    denied("src/proposed.js", source(false, 'return globalThis["eval"](code);'), 2);
  }],
  ['JS-EVAL-001 flags self["eval"](code) in JavaScript', () => {
    denied("src/proposed.js", source(false, 'return self["eval"](code);'), 2);
  }],
  ['JS-EVAL-001 flags global["eval"](code) in JavaScript', () => {
    denied("src/proposed.js", source(false, 'return global["eval"](code);'), 2);
  }],
  ["JS-EVAL-001 flags a local alias of eval in JavaScript", () => {
    denied("src/proposed.js", source(false, "const alias = eval;\n  return alias(code);"), 3);
  }],
  ["JS-EVAL-001 allows an unrelated object property named eval in TypeScript", () => {
    clean("src/proposed.ts", source(true, "const box = { eval(value: string) { return value; } };\n  return box[\"eval\"](code);"));
  }],
  ["JS-EVAL-001 allows an unrelated object property named eval in JavaScript", () => {
    clean("src/proposed.js", source(false, "const box = { eval(value) { return value; } };\n  return box[\"eval\"](code);"));
  }],
  ["JS-EVAL-001 allows the string eval outside a call in TypeScript", () => {
    clean("src/proposed.ts", source(true, "const name = \"eval\";\n  const ref = window[\"eval\"];\n  return name + code + String(ref);"));
  }],
  ["JS-EVAL-001 allows the string eval outside a call in JavaScript", () => {
    clean("src/proposed.js", source(false, "const name = \"eval\";\n  const ref = window[\"eval\"];\n  return name + code + String(ref);"));
  }],
  ["JS-EVAL-001 allows a class method named eval in TypeScript", () => {
    clean("src/proposed.ts", "export class Runner {\n  eval(code: string) {\n    return code;\n  }\n}\n");
  }],
  ["JS-EVAL-001 allows a class method named eval in JavaScript", () => {
    clean("src/proposed.js", "export class Runner {\n  eval(code) {\n    return code;\n  }\n}\n");
  }],
];

for (const [name, run] of cases) test(name, run, 30_000);
