import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { enable } from "../src/consent.ts";
import { engineAt } from "./compiled-engine.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// The real Claude PreToolUse hook, after `pregate setup`, against a fixture repo.
// Architecture structure is opt-in. Core reading-quality heuristics are off, as in the other hook suites.
// The preset ratchet is strict so the no-increase on the rule itself is what allows an existing excess.

setDefaultTimeout(180_000);

const TMP = mkdtempSync(join(tmpdir(), "pregate-structure-"));
const BIN = join(TMP, "bin/pregate");
const HOME = join(TMP, "home");
const DATA = join(TMP, "data");
const LAUNCHER = join(DATA, "pregate/bin/pregate");

type Env = Record<string, string>;
interface Out { code: number; stdout: string; stderr: string }
interface Repo { dir: string; env: Env }
interface HookOutput {
  hookSpecificOutput: { permissionDecision?: string; permissionDecisionReason?: string; additionalContext?: string };
}

const consts = (n: number): string => Array.from({ length: n }, (_, i) => `const n${i} = ${i};`).join("\n") + "\n";
const exported = (n: number): string => Array.from({ length: n }, (_, i) => `export const a${i} = ${i};`).join("\n") + "\n";

beforeAll(() => {
  mkdirSync(HOME, { recursive: true });
  mkdirSync(join(TMP, "tmp"), { recursive: true });
  engineAt(BIN, true);
  mkdirSync(join(HOME, ".claude"), { recursive: true });
  ok(run([BIN, "setup"], HOME, envOf()), "setup");
});

afterAll(() => removeTree(TMP));

let states = 0;
function envOf(): Env {
  // Keep git and sh. A unix-only PATH hides Git for Windows, and the hook command is `sh -c`.
  const env: Env = {
    CI: "1", PREGATE_UNATTENDED_APPROVAL: "1", PATH: pathWithoutHarnesses([join(HOME, ".local/bin")]), HOME, TMPDIR: join(TMP, "tmp"),
    CODEX_HOME: join(HOME, ".codex"), GROK_HOME: join(HOME, ".grok"),
    XDG_DATA_HOME: DATA, XDG_STATE_HOME: join(TMP, "state", String(++states)),
    GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.com",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.com",
  };
  if (process.platform === "win32" && process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  return env;
}

function run(cmd: string[], cwd: string, env: Env, stdin = ""): Out {
  const r = Bun.spawnSync(cmd, { cwd, env, stdin: new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe" });
  return { code: r.exitCode ?? -1, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

function ok(o: Out, what: string): Out {
  if (o.code !== 0) throw new Error(`${what} exited ${o.code}\n${o.stdout}\n${o.stderr}`);
  return o;
}

function put(dir: string, rel: string, text: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

function localPack(dir: string): void {
  const rule = {
    id: "local/secrets/forbidden-env", version: "1.0.0", area: "secrets", cardinality: "singleton",
    dimension: "secrets.env", minSeverity: null,
    params: { globs: { type: "array", items: { type: "string" }, minItems: 1 } },
    impl: { kind: "primitive", primitive: "forbidden-path" },
    phase: ["pre", "stop", "commit", "ci"],
    feedback: { message: "{symbol} matches a forbidden path." },
  };
  const manifest = {
    id: "local/secrets", version: "1.0.0", status: "complete", conflicts: [],
    invariants: [{
      id: "LOCAL-ENV-001", check: rule.id,
      defaults: { globs: [".env", "**/.env"], exclude: [".env.example", "**/.env.example"] },
      severity: "deny",
      source: { work: "Fixture", locator: "forbidden path", paraphrase: "A secret file is not source." },
      why: "The file is present.", fixHint: "Remove it.", avoid: "A sample named .env.example is excluded.",
      examples: { pass: "pass/sample", fail: "fail/secret" },
    }],
  };
  put(dir, ".pregate/rules/source.json", JSON.stringify({ ns: "local", version: "1.0.0", category: "pattern" }) + "\n");
  put(dir, ".pregate/rules/checks/secrets/forbidden-env/check.json", JSON.stringify(rule, null, 2) + "\n");
  put(dir, ".pregate/rules/methodologies/secrets.json", JSON.stringify(manifest, null, 2) + "\n");
  const base = ".pregate/rules/checks/secrets/forbidden-env/fixtures";
  const params = manifest.invariants[0]!.defaults;
  const spec = (name: string, target: string, body: string, fail = false, trap?: object) => {
    put(dir, `${base}/${name}/fixture.json`, JSON.stringify({
      language: "typescript", params, target, before: null,
      expect: fail ? { verdict: "fail", violations: [{ line: 1 }] } : { verdict: "pass" },
      ...(trap === undefined ? {} : { trap }),
    }, null, 2) + "\n");
    put(dir, `${base}/${name}/files/${target}.fixture`, body);
  };
  spec("pass/sample", ".env.example", "TOKEN=example\n");
  spec("pass/mention", "src/note.ts", "export const path = \".env\";\n");
  spec("fail/secret", ".env", "TOKEN=1\n", true);
  spec("fail/nested", "src/.env", "TOKEN=1\n", true);
  spec("trap/nested-env", "app/.env", "TOKEN=1\n", true, {
    family: "nested-env", origin: "forge", discovered: "2026-11-16",
    note: "A nested .env is still the secret file. .env.example is the sample and must pass.",
  });
}

function presetText(): string {
  return policyFixture(JSON.stringify({
    name: "structure", version: "1.0.0", engine: pkg.version,
    sources: [
      { ns: "core", kind: "builtin", version: "0.0.1" },
      { ns: "architecture", kind: "library", version: "1.4.0" },
      { ns: "local", kind: "path", path: ".pregate/rules" },
    ],
    methodologies: ["core/pregate-integrity", "architecture/structure", "local/secrets"],
    enforcement: "enforce",
    ratchet: { mode: "strict" },
    scope: { include: ["**"] },
    overrides: {
      "architecture/ARCH-FILE-001": { params: { max: 12 } },
      "architecture/ARCH-EXPORT-001": { params: { max: 4 } },
      "architecture/ARCH-HERIT-001": { params: { max: 2 } },
    },
  }));
}

function repo(turnOn: boolean): Repo {
  const dir = join(TMP, "repos", randomUUID());
  const env = envOf();
  const r: Repo = { dir, env };
  const git = (...args: string[]) => ok(run(["git", ...args], dir, env), args.join(" "));
  mkdirSync(dir, { recursive: true });
  const files: Record<string, string> = {
    "src/pair/a.ts": "export const a = 1;\n",
    "src/pair/b.ts": "import { a } from \"./a\";\nexport const b = a;\n",
    "src/loop/a.ts": "import { b } from \"./b\";\nexport const a = 1;\n",
    "src/loop/b.ts": "import { a } from \"./a\";\nexport const b = 1;\n",
    "src/loop/c.ts": "import { a } from \"./a\";\nexport const c = a;\n",
    "src/types/a.ts": "export interface A { n: number }\n",
    "src/types/b.ts": "import type { A } from \"./a\";\nexport interface B { a: A }\n",
    "src/dyn/a.ts": "export const a = 1;\n",
    "src/dyn/b.ts": "export async function load(): Promise<unknown> {\n  return import(\"./a\");\n}\n",
    "src/wide.ts": consts(13),
    "src/api.ts": exported(5),
    ".env.example": "TOKEN=example\n",
  };
  for (const [rel, text] of Object.entries(files)) put(dir, rel, text);
  localPack(dir);
  put(dir, ".pregate/preset.json", presetText());
  git("init", "-q");
  git("config", "maintenance.auto", "false");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  ok(run([BIN, "preset", "compile"], dir, env), "preset compile");
  if (turnOn) enable(dir, join(DATA, "pregate"));
  git("add", "-A");
  git("commit", "-q", "-m", "pregate");
  return r;
}

interface Session { sid: string; project: string; env: Env }

let calls = 0;
function hook(s: Session, event: "PreToolUse" | "SessionStart", fields: object): Out {
  const body = JSON.stringify({
    session_id: s.sid, transcript_path: `${HOME}/.claude/projects/p/${s.sid}.jsonl`, cwd: s.project,
    ...(event === "SessionStart" ? {} : { permission_mode: "acceptEdits" }),
    hook_event_name: event, ...fields,
  });
  const settings = JSON.parse(readFileSync(join(s.env.HOME!, ".claude/settings.json"), "utf8")) as {
    hooks: Record<string, { hooks: { command: string }[] }[]>;
  };
  const name = event === "SessionStart" ? "SessionStart" : "PreToolUse";
  const ours = settings.hooks[name]!.flatMap((g) => g.hooks).find((h) => h.command.includes(LAUNCHER));
  if (ours === undefined) throw new Error(`no PREGATE ${name} hook`);
  return run(["sh", "-c", ours.command], s.project, s.env, body);
}

function session(r: Repo): Session {
  return { sid: randomUUID(), project: r.dir, env: { ...r.env, CLAUDE_PROJECT_DIR: r.dir } };
}

function write(s: Session, rel: string, content: string): Out {
  return hook(s, "PreToolUse", {
    tool_name: "Write", tool_use_id: `toolu_structure_${++calls}`,
    tool_input: { file_path: join(s.project, rel), content },
  });
}

function json(o: Out): HookOutput {
  return JSON.parse(o.stdout) as HookOutput;
}

function denied(o: Out, id: string): void {
  expect(o.code, o.stdout + o.stderr).toBe(2);
  const out = json(o);
  expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(o.stderr.trim()).toBe(String(out.hookSpecificOutput.permissionDecisionReason).trim());
  expect(out.hookSpecificOutput.permissionDecisionReason).toContain(id);
}

function allowed(o: Out, what: string): string {
  expect(o.code, `${what}\n${o.stdout}\n${o.stderr}`).toBe(0);
  const text = `${o.stdout}\n${o.stderr}`;
  expect(text, what).not.toContain("permissionDecision\":\"deny");
  return text;
}

test("the hook denies a new cycle, a larger file, and a secret, and allows the look-alikes", () => {
  const r = repo(true);
  const s = session(r);
  ok(hook(s, "SessionStart", { source: "startup" }), "session start");

  denied(write(s, "src/pair/a.ts", "import { b } from \"./b\";\nexport const a = 1;\n"), "ARCH-CYCLE-001");
  denied(write(s, "src/loop/a.ts", "import { b } from \"./b\";\nimport { c } from \"./c\";\nexport const a = 1;\n"), "ARCH-CYCLE-001");
  denied(write(s, "src/fresh.ts", consts(13)), "ARCH-FILE-001");
  denied(write(s, "src/wide.ts", consts(14)), "ARCH-FILE-001");
  denied(write(s, "src/packed.ts", Array.from({ length: 13 }, (_, i) => `const v${i} = ${i};`).join(" ") + "\n"), "ARCH-FILE-001");
  denied(write(s, "src/api.ts", exported(6)), "ARCH-EXPORT-001");
  denied(write(s, ".env", "TOKEN=1\n"), "LOCAL-ENV-001");

  for (const [rel, content, label] of [
    ["src/types/a.ts", "import type { B } from \"./b\";\nexport interface A { b: B }\n", "type-only cycle"],
    ["src/dyn/a.ts", "export async function load(): Promise<unknown> {\n  return import(\"./b\");\n}\n", "dynamic import cycle"],
    ["src/loop/a.ts", "import { b } from \"./b\";\nexport const a = 1;\nexport function extra(): number {\n  return 1;\n}\n", "edit inside an existing cycle"],
    ["src/other.ts", "export const other = 1;\n", "edit beside an existing cycle"],
    ["src/wide.ts", `${consts(13)}// note\n`, "over-ceiling file with no growth"],
    ["src/notes.ts", `${Array.from({ length: 40 }, () => "// note").join("\n")}\n${consts(4)}`, "comment-heavy file"],
    ["src/api.ts", `${exported(5)}// note\n`, "export surface with no growth"],
    ["src/react.ts", "import { Component } from \"react\";\nexport class View extends Component {}\n", "framework base class"],
    [".env.example", "TOKEN=sample\n", "env sample"],
    ["src/mention.ts", "export const path = \".env\";\n", "source text that names .env"],
  ] as const) {
    const text = allowed(write(s, rel, content), label);
    expect(text, label).not.toContain("ARCH-CYCLE-001");
    expect(text, label).not.toContain("ARCH-FILE-001");
    expect(text, label).not.toContain("ARCH-EXPORT-001");
    expect(text, label).not.toContain("LOCAL-ENV-001");
    expect(text, label).not.toContain("ARCH-HERIT-001");
  }

  const deep = write(s, "src/view.ts", "class A {}\nclass B extends A {}\nclass C extends B {}\nclass D extends C {}\n");
  const warned = allowed(deep, "deep class chain");
  expect(warned).toContain("PREGATE WARN");
  expect(warned).toContain("ARCH-HERIT-001");
  expect(json(deep).hookSpecificOutput.permissionDecision).toBeUndefined();
});

test("a repository that never ran pregate enable allows the same cycle", () => {
  const r = repo(false);
  const s = session(r);
  const wrote = write(s, "src/pair/a.ts", "import { b } from \"./b\";\nexport const a = 1;\n");
  expect(wrote.code, wrote.stdout + wrote.stderr).toBe(0);
  expect(wrote.stdout + wrote.stderr).not.toContain("ARCH-CYCLE-001");
  expect(wrote.stdout).not.toContain("\"permissionDecision\":\"deny\"");
});
