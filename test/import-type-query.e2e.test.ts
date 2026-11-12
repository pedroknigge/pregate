import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { testEngine } from "./compiled-engine.ts";
import { removeTree } from "./remove-tree.ts";

// Compiled CLI on fixture files: the import-type grammar and the advisor parse-failure warning.
const cli = testEngine();
const area = mkdtempSync(join(tmpdir(), "pregate-import-type-"));
afterAll(() => removeTree(area));

const declaration = `export type Value = import("m").Type<Args>;
export type Loaded = typeof import("m");
export type Qualified = import("m").Ns.Type<Args>;
export type Nested = import("m").Type<import("n").Other<Args>>;
export type Query = typeof import("m").Ns.Type<Args>;
`;

const evaluated = `${declaration}export function run(x: string) {
  return eval(x);
}
`;

const unparsed = "export const value = ;\neval(x);\n";

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

function ready(name: string) {
  const p = project(name);
  p.put("package.json", '{ "name": "sample" }\n');
  p.put("src/ok.ts", "export const ready = true;\n");
  p.git("init", "-q");
  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  return p;
}

test("a declaration file with an import type query audits clean", () => {
  const p = ready("declaration");
  p.put("src/types.d.ts", declaration);
  p.git("add", "-A");
  p.git("commit", "-qm", "types");
  const audited = p.run(["audit"]);
  expect(audited.code, audited.text).toBe(0);
  expect(audited.text).toContain("Exit 0: complete; nothing blocks under the live policy.");
  expect(audited.text).not.toContain("could not be analyzed");
  expect(audited.text).not.toContain("incomplete");
}, 120_000);

test("an import type query plus eval is flagged, and enforce still denies a file that does not parse", () => {
  const p = ready("evaluated");
  expect(p.run(["pack", "add", "--library", "javascript", "--source-only", "--yes"]).code).toBe(0);
  expect(p.run(["pack", "enable", "javascript/safety", "--only", "JS-EVAL-001", "--yes"]).code).toBe(0);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge JS-EVAL-001 in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  expect(p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]).code).toBe(0);
  p.put("src/run.ts", declaration);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  p.put("src/run.ts", evaluated);
  const audited = p.run(["audit"]);
  expect(audited.code, audited.text).toBe(1);
  expect(audited.text).toContain("javascript/JS-EVAL-001");
  expect(audited.text).toContain("src/run.ts");
  expect(audited.text).toContain("Exit 1: complete;");
  expect(audited.text).not.toContain("could not be analyzed");
  expect(audited.text).not.toContain("incomplete");
  const checked = p.run(["check", "--stdin", "--path", "src/run.ts"], evaluated);
  expect(checked.code, checked.text).toBe(1);
  expect(checked.text).toContain("javascript/JS-EVAL-001");
  expect(checked.text).toContain("src/run.ts:7");
  expect(checked.text).not.toContain("no introduced violations");
  expect(checked.text).not.toContain("PREGATE DENY syntax");
  const broken = p.run(["check", "--stdin", "--path", "src/broken.ts"], unparsed);
  expect(broken.code, broken.text).toBe(1);
  expect(broken.text).toContain("PREGATE DENY syntax");
  expect(broken.text).toContain("src/broken.ts");
  expect(broken.text).not.toContain("no introduced violations");
  expect(broken.text).not.toContain("parse failure");
}, 120_000);

test("advisor stdin and the hook warn when a file does not parse", () => {
  const p = ready("advisor");
  expect(p.run(["pack", "add", "--library", "javascript", "--source-only", "--yes"]).code).toBe(0);
  expect(p.run(["pack", "enable", "javascript/safety", "--only", "JS-EVAL-001", "--yes"]).code).toBe(0);
  p.put(".pregate/requests/advisor.json", JSON.stringify({
    why: "Report findings without blocking, including a file that does not parse.",
    patch: [{ op: "add", path: "/enforcement", value: "advisor" }],
  }));
  expect(p.run(["preset", "apply", ".pregate/requests/advisor.json", "--yes"]).code).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");
  const checked = p.run(["check", "--stdin", "--path", "src/broken.ts"], unparsed);
  expect(checked.code, checked.text).toBe(0);
  expect(checked.text).toContain("PREGATE WARN syntax src/broken.ts:");
  expect(checked.text).toContain("parse failure. This file does not parse, so its rules were not evaluated.");
  expect(checked.text).toContain("This is not a clean result. PREGATE did not check this file for violations.");
  expect(checked.text).not.toContain("no introduced violations");
  expect(checked.text).not.toContain("javascript/JS-EVAL-001");
  const payload = {
    hook_event_name: "PreToolUse",
    session_id: "advisor-parse",
    cwd: p.root,
    permission_mode: "default",
    tool_name: "Write",
    tool_use_id: "write-broken",
    tool_input: { file_path: join(p.root, "src/broken.ts"), content: unparsed },
  };
  const hook = p.run(["hook", "pre", "--harness", "claude-code"], JSON.stringify(payload));
  expect(hook.code, hook.text).toBe(0);
  expect(hook.stdout).toContain("parse failure");
  expect(hook.stdout).toContain("This is not a clean result. PREGATE did not check this file for violations.");
  expect(hook.stdout).not.toContain("no introduced violations");
  expect(hook.stdout).not.toContain("javascript/JS-EVAL-001");
}, 120_000);
