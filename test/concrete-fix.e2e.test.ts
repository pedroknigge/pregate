import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { slash } from "../src/paths.ts";
import { commandScript } from "../src/windows-command.ts";
import { engineAt } from "./compiled-engine.ts";
import { pathWithoutHarnesses } from "./host-path.ts";
import { policyFixture } from "./policy-fixtures.ts";
import { removeTree } from "./remove-tree.ts";

// The compiled hook binary, after `pregate setup` and `pregate enable`, must name a concrete path
// and a replacement in a layer-edge deny, a banned import, an outside-layer file, a shell write,
// a protected path, and a pack rule that declares fix.where and fix.use. A repo that never ran
// `pregate enable` is not blocked.

setDefaultTimeout(180_000);

const TMP = mkdtempSync(join(tmpdir(), "pregate-concrete-fix-"));
// Two directories above the binary are the engine home, and that tree is protected. The fixture
// repos stay outside it. A binary at <tmp>/bin/pregate would protect every repo under <tmp>.
const BIN = join(TMP, "engine/dist/pregate");
const HOME = join(TMP, "home");
const DATA = join(TMP, "data");
const WINDOWS = process.platform === "win32";
const HOOK_MARK = WINDOWS ? `${slash(join(DATA, "pregate"))}/bin/launcher.ps1` : join(DATA, "pregate/bin/pregate");

type Env = Record<string, string>;
interface Out { code: number; stdout: string; stderr: string }
interface Repo { dir: string; env: Env }
interface HookOutput {
  hookSpecificOutput: { permissionDecision?: string; permissionDecisionReason?: string };
}

const LAYER = "import { main } from \"../shell/main\";\nexport const order = main;\n";
const EXPRESS = "import express from \"express\";\nexport const app = express();\n";
const LEFT_PAD = "import pad from \"left-pad\";\nexport const n = pad(\"1\", 3);\n";
const PYTHON = "def note():\n    return 1\n";

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
    id: "local/imports/no-left-pad", version: "1.0.0", area: "imports", cardinality: "multi",
    dimension: "deps.packages", minSeverity: null,
    params: { packages: { type: "array", items: { type: "string" }, minItems: 1 } },
    impl: { kind: "primitive", primitive: "banned-import" },
    phase: ["pre", "stop", "commit", "ci"],
    feedback: { message: "{symbol} imports a package this layer may not use." },
  };
  const manifest = {
    id: "local/imports", version: "1.0.0", status: "complete", conflicts: [],
    invariants: [{
      id: "LOCAL-PAD-001", check: rule.id,
      defaults: { paths: ["src/core/**"], packages: ["left-pad"] },
      severity: "deny",
      fix: { where: "src/shell/", use: "node:fs/promises" },
      source: { work: "Fixture", locator: "declared replacement", paraphrase: "The core layer does not import left-pad." },
      why: "The package is banned in this layer.", fixHint: "Keep the dependency in the shell.", avoid: "A subpath of the same package.",
      examples: { pass: "pass/plain", fail: "fail/import" },
    }],
  };
  put(dir, ".pregate/rules/source.json", JSON.stringify({ ns: "local", version: "1.0.0", category: "pattern" }) + "\n");
  put(dir, ".pregate/rules/checks/imports/no-left-pad/check.json", JSON.stringify(rule, null, 2) + "\n");
  put(dir, ".pregate/rules/methodologies/imports.json", JSON.stringify(manifest, null, 2) + "\n");
  const base = ".pregate/rules/checks/imports/no-left-pad/fixtures";
  const params = { paths: ["src/core/**"], packages: ["left-pad"] };
  const spec = (name: string, target: string, body: string, lines: number[] | null, trap?: object) => {
    put(dir, `${base}/${name}/fixture.json`, JSON.stringify({
      language: "typescript", params, target, before: null,
      expect: lines === null ? { verdict: "pass" } : { verdict: "fail", violations: lines.map((line) => ({ line })) },
      ...(trap === undefined ? {} : { trap }),
    }, null, 2) + "\n");
    put(dir, `${base}/${name}/files/${target}.fixture`, body);
  };
  spec("pass/plain", "src/core/plain.ts", "export const n = 1;\n", null);
  spec("pass/shell", "src/shell/pad.ts", LEFT_PAD, null);
  spec("fail/import", "src/core/read.ts", LEFT_PAD, [1]);
  spec("fail/require", "src/core/require.ts", "const pad = require(\"left-pad\");\nexport const n = pad(\"1\", 3);\n", [1]);
  spec("trap/dynamic", "src/core/dynamic.ts", "export async function load(): Promise<string> {\n  const pad = await import(\"left-pad\");\n  return pad.default(\"1\", 3);\n}\n", [2], {
    family: "import-form", origin: "corpus", discovered: "2026-11-18",
    note: "A literal dynamic import of left-pad is the same banned package.",
  });
}

function presetText(): string {
  return policyFixture(JSON.stringify({
    name: "concrete-fix", version: "1.0.0", engine: pkg.version,
    sources: [
      { ns: "core", kind: "builtin", version: "0.0.1" },
      { ns: "architecture", kind: "library", version: "1.4.1" },
      { ns: "local", kind: "path", path: ".pregate/rules" },
    ],
    methodologies: ["core/pregate-integrity", "architecture/clean-architecture", "local/imports"],
    enforcement: "enforce",
    scope: { include: ["src/**"], exclude: [] },
    layers: {
      core: { paths: ["src/core/**"], mayImport: [], kind: "core" },
      shell: { paths: ["src/shell/**", "src/main.ts"], mayImport: ["core"], kind: "adapter" },
    },
  }));
}

function repo(turnOn: boolean): Repo {
  const dir = join(TMP, "repos", randomUUID());
  const env = envOf();
  const git = (...args: string[]) => ok(run(["git", ...args], dir, env), args.join(" "));
  mkdirSync(dir, { recursive: true });
  put(dir, "src/core/keep.ts", "export const keep = 1;\n");
  put(dir, "src/shell/main.ts", "export const main = 1;\n");
  put(dir, "src/main.ts", "export { main } from \"./shell/main\";\n");
  localPack(dir);
  put(dir, ".pregate/preset.json", presetText());
  git("init", "-q");
  git("config", "maintenance.auto", "false");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  ok(run([BIN, "preset", "compile"], dir, env), "preset compile");
  if (turnOn) ok(run([BIN, "enable", "--yes"], dir, env), "enable");
  return { dir, env };
}

interface Session { sid: string; project: string; env: Env }

let calls = 0;
function installedHook(s: Session, event: "PreToolUse" | "SessionStart", fields: object): Out {
  const body = JSON.stringify({
    session_id: s.sid, transcript_path: `${HOME}/.claude/projects/p/${s.sid}.jsonl`, cwd: s.project,
    ...(event === "SessionStart" ? {} : { permission_mode: "acceptEdits" }),
    hook_event_name: event, ...fields,
  });
  const settings = JSON.parse(readFileSync(join(s.env.HOME!, ".claude/settings.json"), "utf8")) as {
    hooks: Record<string, { hooks: { command: string }[] }[]>;
  };
  const name = event === "SessionStart" ? "SessionStart" : "PreToolUse";
  const ours = settings.hooks[name]!.flatMap((g) => g.hooks).find((h) => commandScript(h.command).includes(HOOK_MARK));
  if (ours === undefined) throw new Error(`no PREGATE ${name} hook`);
  const argv = WINDOWS ? ["cmd.exe", "/d", "/c", ours.command] : ["sh", "-c", ours.command];
  return run(argv, s.project, s.env, body);
}

function session(r: Repo): Session {
  return { sid: randomUUID(), project: r.dir, env: { ...r.env, CLAUDE_PROJECT_DIR: r.dir } };
}

function write(s: Session, rel: string, content: string): Out {
  return installedHook(s, "PreToolUse", {
    tool_name: "Write", tool_use_id: `toolu_fix_${++calls}`,
    tool_input: { file_path: join(s.project, rel), content },
  });
}

function reason(o: Out): string {
  expect(o.code, o.stdout + o.stderr).toBe(2);
  const out = JSON.parse(o.stdout) as HookOutput;
  expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
  const text = out.hookSpecificOutput.permissionDecisionReason ?? "";
  expect(o.stderr.trim()).toBe(text.trim());
  return text;
}

function has(text: string, rel: string): boolean {
  return text.includes(rel) || text.includes(rel.replaceAll("/", "\\"));
}

test("an enabled project names the path and the replacement for each block kind", () => {
  const r = repo(true);
  const s = session(r);
  ok(installedHook(s, "SessionStart", { source: "startup" }), "session start");
  const clean = write(s, "src/core/ok.ts", "export const ok = 1;\n");
  expect(clean.code, clean.stdout + clean.stderr).toBe(0);
  expect(clean.stdout + clean.stderr).not.toContain("PREGATE DENY");

  const layer = reason(write(s, "src/core/order.ts", LAYER));
  expect(layer).toContain("architecture/CA-DEP-001");
  expect(layer).toContain("src/core/");
  expect(layer).toContain("src/shell/");
  expect(layer).toContain("../shell/main");
  expect(layer).toContain("Put the code in");

  const banned = reason(write(s, "src/core/db.ts", EXPRESS));
  expect(banned).toContain("architecture/CA-DEP-002");
  expect(banned).toContain("src/shell/");
  expect(banned).toContain("No replacement API is declared for express");

  const outside = reason(write(s, "src/core/note.py", PYTHON));
  expect(outside).toContain("core/EVA-SCOPE-001");
  expect(outside).toContain("src/core/");
  expect(outside).toContain(".ts");

  const shell = reason(installedHook(s, "PreToolUse", {
    tool_name: "Bash", tool_use_id: `toolu_fix_${++calls}`,
    tool_input: { command: "echo x > src/core/written.ts" },
  }));
  expect(shell).toContain("shell-write");
  expect(has(shell, "src/core/written.ts")).toBe(true);
  expect(shell).toContain("apply_patch");

  const locked = reason(write(s, ".pregate/pregate.lock.json", "{}\n"));
  expect(locked).toContain("protected-path");
  expect(locked).toContain(".pregate/requests/");
  expect(locked).toContain("pregate preset apply");

  const declared = reason(write(s, "src/core/pad.ts", LEFT_PAD));
  expect(declared).toContain("LOCAL-PAD-001");
  expect(declared).toContain("src/shell/");
  expect(declared).toContain("node:fs/promises");

  const checked = run([BIN, "check", "--stdin", "--path", "src/core/order.ts", "--format", "agent"], r.dir, r.env, LAYER);
  expect(checked.code, checked.stdout + checked.stderr).toBe(1);
  const agent = checked.stdout + checked.stderr;
  expect(agent).toContain("src/core/");
  expect(agent).toContain("../shell/main");
  expect(agent).toContain("src/shell/");

  const evidence = { layer, banned, outside, shell, locked, declared, cli: agent };
  writeFileSync(join(tmpdir(), "pregate-after-blocks.json"), JSON.stringify(evidence, null, 2));
});

test("each harness renders the layer path and the replacement", () => {
  const r = repo(true);
  const file = join(r.dir, "src/core/order.ts");
  const cases: { harness: string; exit: number; body: string; read: (o: Out) => string }[] = [
    {
      harness: "grok", exit: 2,
      body: JSON.stringify({
        hookEventName: "pre_tool_use", sessionId: randomUUID(), cwd: r.dir, toolName: "write",
        toolUseId: "call_grok_fix", toolInputTruncated: false,
        toolInput: { file_path: file, content: LAYER },
      }),
      read: (o) => {
        const parsed = JSON.parse(o.stdout) as { hookSpecificOutput?: { permissionDecisionReason?: string } };
        return parsed.hookSpecificOutput?.permissionDecisionReason ?? o.stderr;
      },
    },
    {
      harness: "cursor", exit: 0,
      body: JSON.stringify({
        conversation_id: randomUUID(), generation_id: randomUUID(), session_id: randomUUID(),
        hook_event_name: "preToolUse", cursor_version: "2026.11.11", workspace_roots: [r.dir],
        tool_name: "Write", tool_use_id: "toolu_cursor_fix",
        tool_input: { file_path: file, content: LAYER },
      }),
      read: (o) => {
        const parsed = JSON.parse(o.stdout) as { agent_message?: string; permission?: string };
        expect(parsed.permission).toBe("deny");
        return parsed.agent_message ?? "";
      },
    },
    {
      harness: "codex", exit: 2,
      body: JSON.stringify({
        session_id: randomUUID(), cwd: r.dir, hook_event_name: "PreToolUse", tool_name: "apply_patch",
        tool_use_id: randomUUID(),
        tool_input: { command: `*** Begin Patch\n*** Add File: ${file}\n+${LAYER.trim().split("\n").join("\n+")}\n*** End Patch` },
      }),
      read: (o) => o.stderr,
    },
    {
      harness: "agy", exit: 0,
      body: JSON.stringify({
        conversationId: randomUUID(), workspacePaths: [r.dir], cwd: r.dir, hookEventName: "PreToolUse", stepIdx: 1,
        toolCall: { name: "write_file", id: "call_agy_fix", args: { Path: file, Content: LAYER, Overwrite: true } },
      }),
      read: (o) => {
        const parsed = JSON.parse(o.stdout) as { decision?: string; reason?: string };
        expect(parsed.decision).toBe("deny");
        return parsed.reason ?? "";
      },
    },
    {
      harness: "opencode", exit: 2,
      body: JSON.stringify({
        hook_event_name: "PreToolUse", session_id: randomUUID(), cwd: r.dir, tool_name: "write",
        tool_use_id: "call_opencode_fix", tool_input: { filePath: file, content: LAYER },
      }),
      read: (o) => o.stderr,
    },
  ];
  for (const item of cases) {
    const out = run([BIN, "hook", "pre", "--harness", item.harness], r.dir, r.env, item.body);
    expect(out.code, `${item.harness}\n${out.stdout}\n${out.stderr}`).toBe(item.exit);
    const text = item.read(out);
    expect(text, `${item.harness}\n${text}`).toContain("src/core/");
    expect(text, `${item.harness}\n${text}`).toContain("src/shell/");
    expect(text, `${item.harness}\n${text}`).toContain("../shell/main");
  }
});

test("a repository that never ran pregate enable is not blocked", () => {
  const r = repo(false);
  const wrote = write(session(r), "src/core/order.ts", LAYER);
  expect(wrote.code, wrote.stdout + wrote.stderr).toBe(0);
  expect(wrote.stdout + wrote.stderr).not.toContain("PREGATE DENY");
  expect(wrote.stdout).not.toContain("\"permissionDecision\":\"deny\"");
});
