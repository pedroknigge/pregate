import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { engineAt } from "./compiled-engine.ts";
import { ENGINE_FILE } from "../src/platform.ts";
import { removeTree } from "./remove-tree.ts";

setDefaultTimeout(180_000);
const area = mkdtempSync(join(tmpdir(), "pregate-ts-invariants-"));
const binary = join(area, "engine", "version", ENGINE_FILE);
beforeAll(() => engineAt(binary, true), 120_000);
afterAll(() => removeTree(area));

const GOOD_CONFIG = `{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "exactOptionalPropertyTypes": true
  }
}
`;
const LOOSE_CONFIG = GOOD_CONFIG.replace('"strict": true', '"strict": false');
const ADVISOR_CONFIG = GOOD_CONFIG.replace('"skipLibCheck": true', '"skipLibCheck": false');
const REASONED = "// @ts-expect-error the fixture type is wrong\nexport const value = 1;\n";
const ONE_ANY = "export const value: any = 1;\n";
const ONE_BANG = "export const value = present!;\n";
const CHECKED = [
  "TS-IMPORT-001", "TS-CONST-001", "TS-INAME-001", "TS-MODE-001", "TS-PARSE-001",
  "TS-ROARR-001", "TS-SORT-001", "TS-CAUSE-001", "TS-DIRECTIVE-001", "TS-ANY-002", "TS-BANG-002",
].join(",");

function releasedCapture<T>(capture: string, descriptors: number[], body: () => T): T {
  try { return body(); } finally {
    for (const fd of descriptors) closeSync(fd);
    removeTree(capture);
  }
}

function project(name: string) {
  const root = join(area, name);
  mkdirSync(root);
  const env = {
    ...process.env, CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", HOME: join(root, "home"),
    XDG_DATA_HOME: join(root, "data"), XDG_STATE_HOME: join(root, "state"),
    CODEX_HOME: join(root, "codex"), GROK_HOME: join(root, "grok"),
    GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const capture = mkdtempSync(join(area, "capture-")), descriptors: number[] = [];
    const opened = (file: string, flags: string) => {
      const fd = openSync(join(capture, file), flags);
      descriptors.push(fd);
      return fd;
    };
    return releasedCapture(capture, descriptors, () => {
      if (input !== undefined) writeFileSync(join(capture, "stdin"), input);
      const out = spawnSync(binary, args, {
        cwd: root, env,
        stdio: [input === undefined ? "ignore" : opened("stdin", "r"), opened("stdout", "w"), opened("stderr", "w")],
        timeout: 30000,
      });
      const text = readFileSync(join(capture, "stdout"), "utf8");
      const error = readFileSync(join(capture, "stderr"), "utf8");
      if (out.error || out.signal) throw new Error(`${args.join(" ")} failed: ${out.error?.message ?? out.signal}\n${text}\n${error}`);
      return { code: out.status, text, error };
    });
  };
  const approve = (args: string[]) => {
    const preview = run(args);
    expect(preview.code, preview.text + preview.error).toBe(0);
    const digest = preview.text.match(/Digest: ([a-f0-9]{64})/)?.[1];
    expect(digest, preview.text).toBeTruthy();
    const applied = run(["approve", "--yes", "--digest", digest!]);
    expect(applied.code, applied.text + applied.error).toBe(0);
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${out.stderr.toString()}`);
  };
  const hook = (sid: string, path: string, content: string) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: "PreToolUse",
    permission_mode: "acceptEdits", prompt_id: "turn", tool_name: "Write", tool_use_id: path,
    tool_input: { file_path: join(root, path), content },
  }));
  const hookStart = (sid: string) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: "SessionStart",
    source: "startup",
  }));
  return { root, put, run, approve, git, hook, hookStart };
}

function denied(result: { code: number | null; text: string; error: string }, rule: string) {
  expect(result.code, result.text + result.error).toBe(2);
  expect(result.text).toContain(rule);
  expect(JSON.parse(result.text).hookSpecificOutput.permissionDecision).toBe("deny");
}

function allowed(result: { code: number | null; text: string; error: string }, rule: string) {
  expect(result.code, result.text + result.error).toBe(0);
  expect(result.text).not.toContain(rule);
  expect(result.text).not.toContain("\"permissionDecision\":\"deny\"");
}

function warned(result: { code: number | null; text: string; error: string }, rule: string) {
  expect(result.code, result.text + result.error).toBe(0);
  expect(result.text).toContain("PREGATE WARN");
  expect(result.text).toContain(rule);
  expect(result.text).not.toContain("\"permissionDecision\":\"deny\"");
}

test("a project that never ran pregate enable does not deny TypeScript writes", () => {
  const p = project("inert-" + randomUUID());
  p.git("init", "-q");
  const sid = randomUUID();
  allowed(p.hook(sid, "tsconfig.json", LOOSE_CONFIG), "typescript/TS-CFG-001");
  allowed(p.hook(sid, "src/open.ts", "let value = 1;\n"), "typescript/TS-CONST-001");
});

test("the hook allows and denies the new TypeScript rules only after they are enabled", () => {
  const p = project("enabled-" + randomUUID());
  const tested = p.run(["rules", "test", "--library", "typescript"]);
  expect(tested.code, tested.text + tested.error).toBe(0);
  expect(tested.text).toContain("ok   typescript/config/compiler-options pass/complete ->");
  expect(tested.text).toContain("ok   typescript/types/parsed-boundary trap/double-cast ->");

  p.git("init", "-q");
  p.approve(["init", "--preview", "--preset", "integrity-only"]);
  p.approve(["pack", "enable", "typescript/compiler", "--only", "TS-CFG-001", "--preview"]);
  p.approve(["pack", "enable", "typescript/checked", "--only", CHECKED, "--preview"]);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Exercise the new TypeScript rules under enforcement.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  const applied = p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]);
  expect(applied.code, applied.text + applied.error).toBe(0);

  p.put("src/reasoned.ts", REASONED);
  p.put("src/one-any.ts", ONE_ANY);
  p.put("src/one-bang.ts", ONE_BANG);
  p.git("add", "-A");
  p.git("commit", "-qm", "contract");
  const sid = randomUUID();
  expect(p.hookStart(sid).code, "session").toBe(0);

  denied(p.hook(sid, "tsconfig.json", LOOSE_CONFIG), "typescript/TS-CFG-001");
  allowed(p.hook(sid, "tsconfig.good.json", GOOD_CONFIG), "typescript/TS-CFG-001");
  const advisor = p.hook(sid, "tsconfig.advisor.json", ADVISOR_CONFIG);
  warned(advisor, "typescript/TS-CFG-001");
  const advisorCheck = p.run(["check", "--stdin", "--path", "tsconfig.advisor.json"], ADVISOR_CONFIG);
  expect(advisorCheck.code, advisorCheck.text).toBe(0);
  expect(advisorCheck.text).toContain("PREGATE WARN");
  expect(advisorCheck.text).toContain("typescript/TS-CFG-001");

  denied(p.hook(sid, "src/let.ts", "let value = 1;\n"), "typescript/TS-CONST-001");
  allowed(p.hook(sid, "src/const.ts", "export const value = 1;\n"), "typescript/TS-CONST-001");
  allowed(p.hook(sid, "src/loop.ts", "export function walk(): void {\n  for (let i = 0; i < 1; i++) {\n    const item = i;\n  }\n}\n"), "typescript/TS-CONST-001");

  denied(p.hook(sid, "src/array.ts", "export function load(ids: string[]): string[] {\n  return ids;\n}\n"), "typescript/TS-ROARR-001");
  allowed(p.hook(sid, "src/readonly.ts", "export function load(ids: readonly string[]): readonly string[] {\n  return ids;\n}\n"), "typescript/TS-ROARR-001");
  allowed(p.hook(sid, "src/local-array.ts", "function load(ids: string[]): string[] {\n  return ids;\n}\n"), "typescript/TS-ROARR-001");

  denied(p.hook(sid, "src/sort.ts", "export function order(items: string[]): string[] {\n  items.sort();\n  return items;\n}\n"), "typescript/TS-SORT-001");
  allowed(p.hook(sid, "src/copied.ts", "export function order(items: readonly string[]): readonly string[] {\n  return [...items].sort();\n}\n"), "typescript/TS-SORT-001");
  allowed(p.hook(sid, "src/alias.ts", "export function order(items: readonly string[]): readonly string[] {\n  const alias = items;\n  alias.sort();\n  return items;\n}\n"), "typescript/TS-SORT-001");

  const bareThrow = "export function wrap(run: () => void): void {\n  try {\n    run();\n  } catch (error) {\n    throw error;\n  }\n}\n";
  const caused = "export function wrap(run: () => void): void {\n  try {\n    run();\n  } catch (error) {\n    throw new Error(\"failed\", { cause: error });\n  }\n}\n";
  denied(p.hook(sid, "src/rethrow.ts", bareThrow), "typescript/TS-CAUSE-001");
  allowed(p.hook(sid, "src/caused.ts", caused), "typescript/TS-CAUSE-001");

  denied(p.hook(sid, "src/reasoned.ts", "// @ts-expect-error\nexport const value = 1;\n"), "typescript/TS-DIRECTIVE-001");
  allowed(p.hook(sid, "src/reasoned.ts", REASONED), "typescript/TS-DIRECTIVE-001");

  denied(p.hook(sid, "src/one-any.ts", "export const value: any = 1;\nexport const other: any = 2;\n"), "typescript/TS-ANY-002");
  allowed(p.hook(sid, "src/one-any.ts", ONE_ANY), "typescript/TS-ANY-002");
  denied(p.hook(sid, "src/one-bang.ts", "export const value = present!!;\n"), "typescript/TS-BANG-002");
  allowed(p.hook(sid, "src/one-bang.ts", ONE_BANG), "typescript/TS-BANG-002");

  const warns: [string, string, string][] = [
    ["src/prefix.ts", "export interface IUser {\n  id: string;\n}\n", "typescript/TS-INAME-001"],
    ["src/flags.ts", "export interface Mode {\n  on: boolean;\n  off: boolean;\n}\n", "typescript/TS-MODE-001"],
    ["src/parse.ts", "type User = { id: string };\nexport function load(text: string): User {\n  const raw = JSON.parse(text);\n  return raw as User;\n}\n", "typescript/TS-PARSE-001"],
    ["src/import.ts", "import { User } from \"./user\";\ntype Alias = User;\n", "typescript/TS-IMPORT-001"],
  ];
  for (const [path, content, rule] of warns) {
    warned(p.hook(sid, path, content), rule);
    const checked = p.run(["check", "--stdin", "--path", path], content);
    expect(checked.code, checked.text + checked.error).toBe(0);
    expect(checked.text).toContain("PREGATE WARN");
    expect(checked.text).toContain(rule);
  }

  const guards: [string, string, string][] = [
    ["src/i18n.ts", "export interface I18n {\n  locale: string;\n}\n", "typescript/TS-INAME-001"],
    ["src/kind.ts", "export type Kind =\n  | { kind: \"on\"; enabled: boolean }\n  | { kind: \"off\"; enabled: boolean };\n", "typescript/TS-MODE-001"],
    ["src/params.ts", "export function save(draft: boolean, notify: boolean): void {\n  return;\n}\n", "typescript/TS-MODE-001"],
    ["src/label.ts", "export function label(config: { json(): string }): string {\n  const text = config.json();\n  return text;\n}\n", "typescript/TS-PARSE-001"],
  ];
  for (const [path, content, rule] of guards) {
    allowed(p.hook(sid, path, content), rule);
    const checked = p.run(["check", "--stdin", "--path", path], content);
    expect(checked.code, checked.text + checked.error).toBe(0);
    expect(checked.text).not.toContain(rule);
  }
});
